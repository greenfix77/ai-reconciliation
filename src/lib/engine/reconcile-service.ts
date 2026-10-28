import { db } from '@/lib/db'
import { ApiError } from '@/lib/http'
import { DEFAULT_CONFIG, ReconciliationConfig, ReconciliationStats } from '@/lib/types'
import { descriptionSimilarity, fromDbMinor, toDbMinor } from '@/lib/money'
import { aiChat, extractJson } from '@/lib/ai-client'
import { audit, notify } from '@/lib/audit'
import { RECON_SYSTEM_PROMPT, buildReconcileUserPrompt, RECON_RETRY_SUFFIX } from './prompts'

/**
 * Reconciliation engine — job-driven pipeline (survives browser disconnect).
 * DB Job row is the source of truth for progress; Reconciliation row is created up-front.
 *
 * STAGE 1  deterministic exact pass (amount + date within tolerance, greedy best-first)
 * STAGE 2  candidate generation (scored top-K 1:1 pairs + 1:N / N:1 combo search)
 * STAGE 3  AI analysis of unresolved candidate pairs (batched, temperature 0)
 * STAGE 4  deterministic validation of AI verdicts (NEVER trust AI arithmetic)
 * STAGE 5  leftovers (missing_a / missing_b / unmatched) + duplicates + stats + persist
 */

const MAX_AI_CALLS = 40
const CANDIDATE_K = 6
const COMBO_CANDIDATES = 8
const DAY_MS = 86_400_000

// ---------- types ----------

type TxLite = {
  id: string
  side: 'A' | 'B'
  fileId: string
  rowIndex: number
  date: Date | null
  description: string | null
  reference: string | null
  amountMinor: number
  flags: string[]
}

type CandidatePair = {
  aId: string
  bId: string
  score: number
  amountDiff: number
  dateDiff: number
  descSim: number
  refMatch: boolean
}

type GroupDraft = {
  type: string
  status: string
  confidence: number
  amountDiffMinor: number
  dateDiffDays: number | null
  descSimilarity: number
  explanation: string | null
  evidence: string[] | null
  validationStatus: string
  decidedBy: string
  aIds: string[]
  bIds: string[]
}

export type PreparedRun = {
  jobId: string
  reconciliationId: string
  projectId: string
  userId: string
  config: ReconciliationConfig
}

// ---------- helpers ----------

function clampConfig(raw: Partial<ReconciliationConfig> | null | undefined): ReconciliationConfig {
  const c = { ...DEFAULT_CONFIG, ...(raw ?? {}) }
  return {
    matchDirection: c.matchDirection === 'same' ? 'same' : 'opposite',
    amountToleranceMinor: Math.min(1e12, Math.max(0, Math.round(Number(c.amountToleranceMinor) || 0))),
    dateToleranceDays: Math.min(365, Math.max(0, Math.round(Number(c.dateToleranceDays) || 0))),
    requireExactDate: Boolean(c.requireExactDate),
    useDescriptionMatching: Boolean(c.useDescriptionMatching),
    useReferenceMatching: Boolean(c.useReferenceMatching),
    allowOneToMany: Boolean(c.allowOneToMany),
    allowManyToOne: Boolean(c.allowManyToOne),
    detectDuplicates: Boolean(c.detectDuplicates),
    aiBatchSize: Math.min(100, Math.max(5, Math.round(Number(c.aiBatchSize) || DEFAULT_CONFIG.aiBatchSize))),
    minAutoConfidence: Math.min(1, Math.max(0, Number(c.minAutoConfidence))),
    }
}

function flipAmount(amount: number, direction: 'opposite' | 'same'): number {
  return direction === 'opposite' ? -amount : amount
}

/** Signed residual after applying direction (0 = perfect cancel). */
function residual(aAmounts: number[], bAmounts: number[], direction: 'opposite' | 'same'): number {
  const sumA = aAmounts.reduce((s, v) => s + v, 0)
  const sumB = bAmounts.reduce((s, v) => s + v, 0)
  return sumA - (direction === 'opposite' ? -sumB : sumB)
}

function dateDiffDays(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null
  return Math.round(Math.abs(a.getTime() - b.getTime()) / DAY_MS)
}

function refTokenOverlap(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const tokensA = a.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []
  const tokensB = new Set((b.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []))
  return tokensA.some((t) => tokensB.has(t))
}

function iso(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

function avgPairwiseDescSim(aTxs: TxLite[], bTxs: TxLite[]): number {
  if (aTxs.length === 0 || bTxs.length === 0) return 0
  let total = 0
  let n = 0
  for (const a of aTxs) {
    for (const b of bTxs) {
      total += descriptionSimilarity(a.description, b.description)
      n += 1
    }
  }
  return n > 0 ? total / n : 0
}

function maxDateDiff(aTxs: TxLite[], bTxs: TxLite[]): number | null {
  if (aTxs.length === 0 || bTxs.length === 0) return null
  let max = 0
  let any = false
  for (const a of aTxs) {
    for (const b of bTxs) {
      const d = dateDiffDays(a.date, b.date)
      if (d !== null) {
        max = Math.max(max, d)
        any = true
      }
    }
  }
  return any ? max : null
}

// ---------- preparation (synchronous part — creates Job + Reconciliation rows) ----------

export async function prepareReconciliation(
  projectId: string,
  userId: string,
  configOverride?: Partial<ReconciliationConfig>
): Promise<PreparedRun> {
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project || project.userId !== userId) throw new ApiError(404, 'پروژه یافت نشد', 'NOT_FOUND')
  if (project.status === 'processing') throw new ApiError(409, 'پروژه در حال پردازش است', 'BUSY')

  const files = await db.file.findMany({
    where: { projectId },
    select: { id: true, side: true, status: true },
    orderBy: [{ side: 'asc' }, { createdAt: 'asc' }], // A first
  })
  const parsedFiles = files.filter((f) => f.status === 'parsed')
  if (parsedFiles.length < 2) {
    throw new ApiError(400, 'برای مغایرت‌یابی به حداقل ۲ فایل تجزیه‌شده نیاز است', 'NO_PARSED_FILES')
  }

  const parsedConfig = (() => {
    try {
      return JSON.parse(project.config || '{}') as Partial<ReconciliationConfig>
    } catch {
      return {}
    }
  })()
  const config = clampConfig({ ...parsedConfig, ...(configOverride ?? {}) })

  const txCount = await db.transaction.count({ where: { file: { projectId } } })
  if (txCount === 0) throw new ApiError(400, 'هیچ تراکنشی برای تطبیق وجود ندارد', 'NO_TRANSACTIONS')

  let providerName = 'Built-in AI'
  let model = project.aiModel || 'z-ai'
  if (project.aiProviderId) {
    const provider = await db.aiProvider.findUnique({ where: { id: project.aiProviderId } })
    if (provider) {
      providerName = provider.name
      if (!project.aiModel) {
        try {
          const models = JSON.parse(provider.models || '[]') as string[]
          model = models[0] || model
        } catch {}
      }
    }
  }

  const job = await db.job.create({
    data: {
      userId,
      projectId,
      type: 'reconcile',
      status: 'queued',
      progress: 0,
      total: 5,
      stage: 'stage.load',
      payload: JSON.stringify({ reconciliationPending: true }),
    },
  })

  const reconciliation = await db.reconciliation.create({
    data: {
      projectId,
      userId,
      jobId: job.id,
      providerId: project.aiProviderId,
      providerName,
      model,
      config: JSON.stringify(config),
      status: 'running',
    },
  })

  await db.job.update({ where: { id: job.id }, data: { payload: JSON.stringify({ reconciliationId: reconciliation.id }) } })
  await db.project.update({ where: { id: projectId }, data: { status: 'processing' } })

  return { jobId: job.id, reconciliationId: reconciliation.id, projectId, userId, config }
}

// ---------- main entry ----------

/** Full pipeline (prepare + execute). Use for programmatic runs. */
export async function runReconciliation(projectId: string, userId: string, configOverride?: Partial<ReconciliationConfig>) {
  const prepared = await prepareReconciliation(projectId, userId, configOverride)
  await executeReconciliation(prepared)
  return { jobId: prepared.jobId, reconciliationId: prepared.reconciliationId }
}

/** Fire-and-forget executor used by the API after prepareReconciliation. */
export async function executeReconciliation(prepared: PreparedRun): Promise<void> {
  const { jobId, reconciliationId, projectId, userId, config } = prepared
  const locale = (await db.user.findUnique({ where: { id: userId }, select: { locale: true } }))?.locale === 'en' ? 'en' : 'fa'

  const safeJobUpdate = async (data: { status?: string; progress?: number; total?: number; stage?: string | null; error?: string | null }) => {
    try {
      await db.job.update({ where: { id: jobId }, data })
    } catch (err) {
      console.warn('[reconcile] job update failed', err)
    }
  }

  try {
    const warnings: string[] = []

    // ----- load transactions -----
    await safeJobUpdate({ status: 'running', stage: 'stage.load', progress: 1, total: 5 })
    const files = await db.file.findMany({
      where: { projectId, status: 'parsed' },
      select: { id: true, originalName: true, side: true },
      orderBy: [{ side: 'asc' }, { createdAt: 'asc' }],
    })
    const txs = await db.transaction.findMany({
      where: { file: { projectId } },
      select: { id: true, fileId: true, side: true, rowIndex: true, date: true, description: true, reference: true, amountMinor: true, flags: true },
      orderBy: [{ date: 'asc' }, { rowIndex: 'asc' }],
    })
    const txLite: TxLite[] = txs.map((t) => ({
      id: t.id,
      side: t.side as 'A' | 'B',
      fileId: t.fileId,
      rowIndex: t.rowIndex,
      date: t.date,
      description: t.description,
      reference: t.reference,
      amountMinor: fromDbMinor(t.amountMinor),
      flags: (() => {
        try {
          return JSON.parse(t.flags || '[]') as string[]
        } catch {
          return []
        }
      })(),
    }))
    const txById = new Map(txs.map((t) => [t.id, { ...t, amountMinor: fromDbMinor(t.amountMinor) }]))
    const fileNameById = new Map(files.map((f) => [f.id, f.originalName]))
    let txA = txLite.filter((t) => t.side === 'A')
    let txB = txLite.filter((t) => t.side === 'B')
    if (txA.length === 0 || txB.length === 0) {
      // fallback: if sides mislabeled, treat first parsed file as A, rest as B
      const firstFileId = files[0]?.id
      if (!firstFileId) throw new Error('No parsed files')
      txA = txLite.filter((t) => t.fileId === firstFileId)
      txB = txLite.filter((t) => t.fileId !== firstFileId)
    }
    if (txA.length === 0 || txB.length === 0) throw new ApiError(400, 'تراکنش‌های کافی برای تطبیق وجود ندارد (هر دو طرف لازم است)', 'NO_TRANSACTIONS')

    // Data-quality gate: rows whose amount could not be parsed (invalid_amount /
    // missing_amount) would enter matching as 0-amount noise. They are excluded
    // from the match pipeline and surface as `invalid` groups in the results
    // instead — nothing is silently dropped, and one bad row never fails a run.
    const isUnusable = (t: TxLite) => t.flags.includes('invalid_amount') || t.flags.includes('missing_amount')
    const invalidRows = [...txA, ...txB].filter(isUnusable)
    txA = txA.filter((t) => !isUnusable(t))
    txB = txB.filter((t) => !isUnusable(t))
    if (txA.length === 0 || txB.length === 0) throw new ApiError(400, 'پس از حذف ردیف‌های نامعتبر، تراکنش قابل تطبیق کافی وجود ندارد', 'NO_TRANSACTIONS')

    const direction = config.matchDirection
    const effDateTol = config.requireExactDate ? 0 : config.dateToleranceDays
    const used = new Set<string>()
    const groups: GroupDraft[] = []

    // ---------- STAGE 1: deterministic exact pass ----------
    await safeJobUpdate({ stage: 'stage.exact', progress: 2, total: 5 })
    {
      const pairs: { a: TxLite; b: TxLite; amountDiff: number; dateDiff: number; descSim: number }[] = []
      const sortedB = [...txB].sort((x, y) => flipAmount(x.amountMinor, direction) - flipAmount(y.amountMinor, direction))
      const flipped = sortedB.map((t) => flipAmount(t.amountMinor, direction))
      for (const a of txA) {
        if (used.has(a.id)) continue
        let lo = 0
        let hi = flipped.length
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (flipped[mid] < a.amountMinor - config.amountToleranceMinor) lo = mid + 1
          else hi = mid
        }
        for (let i = lo; i < sortedB.length && flipped[i] <= a.amountMinor + config.amountToleranceMinor; i++) {
          const b = sortedB[i]
          if (used.has(b.id)) continue
          const amountDiff = Math.abs(a.amountMinor - flipAmount(b.amountMinor, direction))
          if (amountDiff > config.amountToleranceMinor) continue
          const dd = dateDiffDays(a.date, b.date)
          if (dd === null || dd > effDateTol) continue
          pairs.push({ a, b, amountDiff, dateDiff: dd, descSim: config.useDescriptionMatching ? descriptionSimilarity(a.description, b.description) : 0 })
        }
      }
      pairs.sort((p1, p2) => p1.dateDiff - p2.dateDiff || p1.amountDiff - p2.amountDiff || p2.descSim - p1.descSim)
      const exactExplanation = locale === 'fa' ? 'تطبیق دقیق مبلغ و تاریخ' : 'Exact amount & date match'
      for (const p of pairs) {
        if (used.has(p.a.id) || used.has(p.b.id)) continue
        used.add(p.a.id)
        used.add(p.b.id)
        groups.push({
          type: 'exact',
          status: 'approved',
          confidence: 1,
          amountDiffMinor: residual([p.a.amountMinor], [p.b.amountMinor], direction),
          dateDiffDays: p.dateDiff,
          descSimilarity: p.descSim,
          explanation: exactExplanation,
          evidence: [
            locale === 'fa' ? `اختلاف مبلغ: ۰` : 'Amount diff: 0',
            locale === 'fa' ? `اختلاف تاریخ: ${p.dateDiff} روز` : `Date diff: ${p.dateDiff}d`,
          ],
          validationStatus: 'valid',
          decidedBy: 'ai',
          aIds: [p.a.id],
          bIds: [p.b.id],
        })
      }
    }

    // ---------- STAGE 2: candidate generation ----------
    await safeJobUpdate({ stage: 'stage.exact', progress: 3 })
    const candidates: CandidatePair[] = []
    const aWithCandidates = new Set<string>()
    {
      const unusedB = txB.filter((t) => !used.has(t.id))
      // sort by flipped amount for windowed scan
      const sortedB = [...unusedB].sort((x, y) => flipAmount(x.amountMinor, direction) - flipAmount(y.amountMinor, direction))
      const flipped = sortedB.map((t) => flipAmount(t.amountMinor, direction))
      for (const a of txA) {
        if (used.has(a.id)) continue
        const tol = Math.max(config.amountToleranceMinor, Math.round(Math.abs(a.amountMinor) * 0.05))
        const dateLimit = config.requireExactDate ? 0 : Math.max(config.dateToleranceDays, 7)
        // binary search window [a - tol, a + tol] over flipped amounts
        let lo = 0
        let hi = flipped.length
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (flipped[mid] < a.amountMinor - tol) lo = mid + 1
          else hi = mid
        }
        const scored: CandidatePair[] = []
        for (let i = lo; i < sortedB.length && flipped[i] <= a.amountMinor + tol; i++) {
          const b = sortedB[i]
          if (used.has(b.id)) continue
          const dd = dateDiffDays(a.date, b.date)
          if (dd === null || dd > dateLimit) continue
          const descSim = config.useDescriptionMatching ? descriptionSimilarity(a.description, b.description) : 0
          const refMatch = config.useReferenceMatching && refTokenOverlap(a.reference, b.reference)
          const amountCloseness = tol > 0 ? 1 - Math.abs(a.amountMinor - flipAmount(b.amountMinor, direction)) / tol : 1
          const score = Math.max(0, amountCloseness) + descSim * 0.5 + (refMatch ? 0.3 : 0)
          scored.push({ aId: a.id, bId: b.id, score, amountDiff: Math.abs(a.amountMinor - flipAmount(b.amountMinor, direction)), dateDiff: dd, descSim, refMatch })
        }
        scored.sort((s1, s2) => s2.score - s1.score)
        for (const s of scored.slice(0, CANDIDATE_K)) {
          candidates.push(s)
          aWithCandidates.add(s.aId)
        }
      }
    }

    // ---------- STAGE 3: AI analysis ----------
    const candidateBatches: CandidatePair[][] = []
    for (let i = 0; i < candidates.length && candidateBatches.length < MAX_AI_CALLS; i += config.aiBatchSize) {
      candidateBatches.push(candidates.slice(i, i + config.aiBatchSize))
    }
    const totalWithAi = 5 + candidateBatches.length
    await safeJobUpdate({ stage: 'stage.ai', progress: 3, total: totalWithAi })

    type AiVerdict = { pair: CandidatePair; verdict: string; confidence: number; reason: string; type: string; evidence: string[] }
    const aiVerdicts: AiVerdict[] = []
    let aiAvailable = true

    for (let bi = 0; bi < candidateBatches.length; bi++) {
      const batch = candidateBatches[bi]
      const items = batch.map((p, idx) => {
        const a = txById.get(p.aId)!
        const b = txById.get(p.bId)!
        return {
          i: idx,
          a: { d: iso(a.date), desc: a.description ?? '', ref: a.reference ?? '', amt: a.amountMinor },
          b: { d: iso(b.date), desc: b.description ?? '', ref: b.reference ?? '', amt: flipAmount(b.amountMinor, direction) },
        }
      })
      let parsed: { results?: { i?: number; verdict?: string; confidence?: number; reason?: string; type?: string; evidence?: string[] }[] } | null = null
      try {
        const res = await aiChat({
          providerId: null,
          model: null,
          messages: [
            { role: 'system', content: RECON_SYSTEM_PROMPT },
            { role: 'user', content: buildReconcileUserPrompt(items, config) },
          ],
          temperature: 0,
          timeoutMs: 90_000,
        })
        try {
          parsed = extractJson(res.content)
        } catch {
          const retry = await aiChat({
            providerId: null,
            model: null,
            messages: [
              { role: 'system', content: RECON_SYSTEM_PROMPT },
              { role: 'user', content: buildReconcileUserPrompt(items, config) + '\n\n' + RECON_RETRY_SUFFIX },
            ],
            temperature: 0,
            timeoutMs: 90_000,
          })
          parsed = extractJson(retry.content)
        }
      } catch (err) {
        aiAvailable = false
        const msg = err instanceof Error ? err.message : 'AI unavailable'
        warnings.push(`AI call failed (batch ${bi + 1}): ${msg.slice(0, 160)}`)
      }
      if (parsed?.results && Array.isArray(parsed.results)) {
        for (const r of parsed.results) {
          const pair = batch[Number(r?.i)]
          if (!pair) continue
          const verdict = r?.verdict === 'match' || r?.verdict === 'no_match' || r?.verdict === 'uncertain' ? r.verdict : 'uncertain'
          aiVerdicts.push({
            pair,
            verdict,
            confidence: Math.min(1, Math.max(0, Number(r?.confidence) || 0)),
            reason: typeof r?.reason === 'string' ? r.reason.slice(0, 500) : '',
            type: typeof r?.type === 'string' ? r.type : 'one_to_one',
            evidence: Array.isArray(r?.evidence) ? r.evidence.filter((e) => typeof e === 'string').slice(0, 3) : [],
          })
        }
      }
      await safeJobUpdate({ progress: 4 + bi })
    }

    // ---------- STAGE 4: deterministic validation of AI verdicts ----------
    await safeJobUpdate({ stage: 'stage.validate', progress: 4 + candidateBatches.length })
    {
      const matchedPairs = aiVerdicts.filter((v) => v.verdict !== 'no_match')
      // validate strongest first (higher confidence wins conflicts)
      matchedPairs.sort((v1, v2) => v2.confidence - v1.confidence)
      for (const v of matchedPairs) {
        const a = txById.get(v.pair.aId)!
        const b = txById.get(v.pair.bId)!
        const amountDiff = Math.abs(a.amountMinor - flipAmount(b.amountMinor, direction))
        const dd = dateDiffDays(a.date, b.date)
        const residualAbs = amountDiff
        const usedNow = used.has(a.id) || used.has(b.id)
        const evidence = [...v.evidence]
        if (v.pair.refMatch) evidence.unshift(locale === 'fa' ? 'تطابق شماره پیگیری' : 'Reference overlap')
        evidence.push(locale === 'fa' ? `اختلاف مبلغ: ${amountDiff.toLocaleString('fa-IR')}` : `Amount diff: ${amountDiff}`)
        if (dd !== null) evidence.push(locale === 'fa' ? `اختلاف تاریخ: ${dd} روز` : `Date diff: ${dd}d`)

        if (usedNow) {
          // conflicting AI claim — keep for review queue as invalid
          groups.push({
            type: 'invalid',
            status: 'pending',
            confidence: v.confidence,
            amountDiffMinor: residual([a.amountMinor], [b.amountMinor], direction),
            dateDiffDays: dd,
            descSimilarity: v.pair.descSim,
            explanation: locale === 'fa' ? 'تداخل در تطبیق‌ها' : 'Conflicting match — transaction already used in another group',
            evidence,
            validationStatus: 'invalid',
            decidedBy: 'ai',
            aIds: [a.id],
            bIds: [b.id],
          })
          continue
        }

        const dateOk = dd !== null && dd <= effDateTol
        const amountOk = residualAbs <= config.amountToleranceMinor
        const fivePct = Math.round(Math.abs(a.amountMinor) * 0.05)

        if (amountOk && dateOk) {
          used.add(a.id)
          used.add(b.id)
          groups.push({
            type: 'ai_match',
            status: 'pending',
            confidence: v.confidence,
            amountDiffMinor: residual([a.amountMinor], [b.amountMinor], direction),
            dateDiffDays: dd,
            descSimilarity: v.pair.descSim,
            explanation: v.reason || (locale === 'fa' ? 'تطبیق هوشمند' : 'AI match'),
            evidence,
            validationStatus: v.verdict === 'match' && v.confidence >= config.minAutoConfidence ? 'valid' : 'warning',
            decidedBy: 'ai',
            aIds: [a.id],
            bIds: [b.id],
          })
          continue
        }

        // amount within 5% but beyond tolerance → amount_diff (AI was directionally right)
        if (!amountOk && residualAbs <= Math.max(config.amountToleranceMinor, fivePct) && dateOk) {
          used.add(a.id)
          used.add(b.id)
          groups.push({
            type: 'amount_diff',
            status: 'pending',
            confidence: v.confidence,
            amountDiffMinor: residual([a.amountMinor], [b.amountMinor], direction),
            dateDiffDays: dd,
            descSimilarity: v.pair.descSim,
            explanation: v.reason || (locale === 'fa' ? 'اختلاف مبلغ جزئی — نیاز به بررسی' : 'Minor amount difference — review needed'),
            evidence,
            validationStatus: 'valid',
            decidedBy: 'ai',
            aIds: [a.id],
            bIds: [b.id],
          })
          continue
        }

        // amount ok but date beyond tolerance (≤ 30 days) → date_diff
        if (amountOk && dd !== null && dd > effDateTol && dd <= 30) {
          used.add(a.id)
          used.add(b.id)
          groups.push({
            type: 'date_diff',
            status: 'pending',
            confidence: v.confidence,
            amountDiffMinor: residual([a.amountMinor], [b.amountMinor], direction),
            dateDiffDays: dd,
            descSimilarity: v.pair.descSim,
            explanation: v.reason || (locale === 'fa' ? 'اختلاف تاریخ — نیاز به بررسی' : 'Date difference — review needed'),
            evidence,
            validationStatus: 'valid',
            decidedBy: 'ai',
            aIds: [a.id],
            bIds: [b.id],
          })
          continue
        }
        // else: pair stays unresolved → leftovers
      }
    }

    // ---------- STAGE 4b: one-to-many / many-to-one deterministic combos ----------
    {
      const comboTol = config.amountToleranceMinor
      const comboDateLimit = effDateTol + 3
      if (config.allowOneToMany) {
        for (const a of txA) {
          if (used.has(a.id)) continue
          const pool = txB.filter((t) => !used.has(t.id))
            .sort((x, y) => Math.abs(a.amountMinor - flipAmount(x.amountMinor, direction)) - Math.abs(a.amountMinor - flipAmount(y.amountMinor, direction)))
            .slice(0, COMBO_CANDIDATES)
          let best: { combo: TxLite[]; residualAbs: number; span: number } | null = null
          for (let size = 2; size <= 3; size++) {
            const combos = kCombos(pool, size)
            for (const combo of combos) {
              const res = residual([a.amountMinor], combo.map((b) => b.amountMinor), direction)
              const resAbs = Math.abs(res)
              if (resAbs > comboTol) continue
              const dates = combo.map((b) => b.date?.getTime() ?? Number.NaN)
              if (dates.some((d) => Number.isNaN(d))) continue
              const span = (Math.max(...dates) - Math.min(...dates)) / DAY_MS
              if (span > comboDateLimit) continue
              const aDd = dateDiffDays(a.date, new Date((Math.max(...dates) + Math.min(...dates)) / 2))
              if (aDd === null || aDd > comboDateLimit) continue
              if (!best || resAbs < best.residualAbs || (resAbs === best.residualAbs && span < best.span)) {
                best = { combo, residualAbs: resAbs, span }
              }
            }
            if (best) break // prefer smaller combo size
          }
          if (best) {
            used.add(a.id)
            for (const b of best.combo) used.add(b.id)
            groups.push({
              type: 'one_to_many',
              status: 'pending',
              confidence: 0.9,
              amountDiffMinor: residual([a.amountMinor], best.combo.map((b) => b.amountMinor), direction),
              dateDiffDays: maxDateDiff([a], best.combo),
              descSimilarity: avgPairwiseDescSim([a], best.combo),
              explanation: locale === 'fa'
                ? `یک تراکنش A با مجموع ${best.combo.length} تراکنش B تطبیق داشت`
                : `One A transaction matched a sum of ${best.combo.length} B transactions`,
              evidence: [locale === 'fa' ? `تعداد اقسام B: ${best.combo.length}` : `B parts: ${best.combo.length}`],
              validationStatus: 'valid',
              decidedBy: 'ai',
              aIds: [a.id],
              bIds: best.combo.map((b) => b.id),
            })
          }
        }
      }
      if (config.allowManyToOne) {
        for (const b of txB) {
          if (used.has(b.id)) continue
          const pool = txA.filter((t) => !used.has(t.id))
            .sort((x, y) => Math.abs(flipAmount(b.amountMinor, direction) - x.amountMinor) - Math.abs(flipAmount(b.amountMinor, direction) - y.amountMinor))
            .slice(0, COMBO_CANDIDATES)
          let best: { combo: TxLite[]; residualAbs: number; span: number } | null = null
          for (let size = 2; size <= 3; size++) {
            const combos = kCombos(pool, size)
            for (const combo of combos) {
              const res = residual(combo.map((a) => a.amountMinor), [b.amountMinor], direction)
              const resAbs = Math.abs(res)
              if (resAbs > comboTol) continue
              const dates = combo.map((a) => a.date?.getTime() ?? Number.NaN)
              if (dates.some((d) => Number.isNaN(d))) continue
              const span = (Math.max(...dates) - Math.min(...dates)) / DAY_MS
              if (span > comboDateLimit) continue
              if (!best || resAbs < best.residualAbs || (resAbs === best.residualAbs && span < best.span)) {
                best = { combo, residualAbs: resAbs, span }
              }
            }
            if (best) break
          }
          if (best) {
            used.add(b.id)
            for (const a of best.combo) used.add(a.id)
            groups.push({
              type: 'many_to_one',
              status: 'pending',
              confidence: 0.9,
              amountDiffMinor: residual(best.combo.map((a) => a.amountMinor), [b.amountMinor], direction),
              dateDiffDays: maxDateDiff(best.combo, [b]),
              descSimilarity: avgPairwiseDescSim(best.combo, [b]),
              explanation: locale === 'fa'
                ? `مجموع ${best.combo.length} تراکنش A با یک تراکنش B تطبیق داشت`
                : `Sum of ${best.combo.length} A transactions matched one B transaction`,
              evidence: [locale === 'fa' ? `تعداد اقسام A: ${best.combo.length}` : `A parts: ${best.combo.length}`],
              validationStatus: 'valid',
              decidedBy: 'ai',
              aIds: best.combo.map((a) => a.id),
              bIds: [b.id],
            })
          }
        }
      }
    }

    // ---------- STAGE 5: duplicates + leftovers ----------
    await safeJobUpdate({ stage: 'stage.validate' })
    const duplicateTxIds = new Set<string>()
    if (config.detectDuplicates) {
      const chainKey = (t: TxLite) => `${t.fileId}|${t.date?.toISOString() ?? ''}|${t.amountMinor}|${t.description ?? ''}`
      const chains = new Map<string, TxLite[]>()
      for (const t of txLite) {
        if (!t.flags.includes('duplicate') || used.has(t.id) || duplicateTxIds.has(t.id)) continue
        const key = chainKey(t)
        const arr = chains.get(key) ?? []
        arr.push(t)
        chains.set(key, arr)
      }
      for (const chain of chains.values()) {
        for (const t of chain) duplicateTxIds.add(t.id)
        groups.push({
          type: 'duplicate',
          status: 'pending',
          confidence: 1,
          amountDiffMinor: 0,
          dateDiffDays: 0,
          descSimilarity: 1,
          explanation: locale === 'fa' ? 'تراکنش تکراری شناسایی شد' : 'Duplicate transaction detected',
          evidence: chain.map((t) => `${fileNameById.get(t.fileId) ?? ''} — ردیف ${t.rowIndex}`),
          validationStatus: 'valid',
          decidedBy: 'ai',
          aIds: chain.filter((t) => t.side === 'A').map((t) => t.id),
          bIds: chain.filter((t) => t.side === 'B').map((t) => t.id),
        })
      }
    }

    const unusedA = txA.filter((t) => !used.has(t.id) && !duplicateTxIds.has(t.id))
    const unusedB = txB.filter((t) => !used.has(t.id) && !duplicateTxIds.has(t.id))
    const aiFailedExplanation = locale === 'fa' ? 'AI در دسترس نبود' : 'AI unavailable'

    // Unusable rows (unreadable amount) — kept visible for review, excluded from matching
    for (const t of invalidRows) {
      groups.push({
        type: 'invalid',
        status: 'pending',
        confidence: 0,
        amountDiffMinor: 0,
        dateDiffDays: null,
        descSimilarity: 0,
        explanation:
          locale === 'fa'
            ? 'مبلغ این ردیف قابل خواندن نیست؛ از تطبیق حذف شد ولی برای بررسی نمایش داده می‌شود'
            : 'Amount unreadable; excluded from matching but shown for review',
        evidence: [`${fileNameById.get(t.fileId) ?? ''} — ${locale === 'fa' ? 'ردیف' : 'row'} ${t.rowIndex}`],
        validationStatus: 'invalid',
        decidedBy: 'ai',
        aIds: t.side === 'A' ? [t.id] : [],
        bIds: t.side === 'B' ? [t.id] : [],
      })
    }
    for (const a of unusedA) {
      const hadCandidates = aWithCandidates.has(a.id)
      groups.push({
        type: hadCandidates ? 'unmatched' : 'missing_b',
        status: 'pending',
        confidence: 0,
        amountDiffMinor: a.amountMinor,
        dateDiffDays: null,
        descSimilarity: 0,
        explanation: hadCandidates ? (aiAvailable ? (locale === 'fa' ? 'تطبیق‌نشده — نیاز به بررسی دستی' : 'Unmatched — manual review needed') : aiFailedExplanation) : (locale === 'fa' ? 'این تراکنش در فایل B یافت نشد' : 'No counterpart found in file B'),
        evidence: [],
        validationStatus: 'valid',
        decidedBy: 'ai',
        aIds: [a.id],
        bIds: [],
      })
    }
    for (const b of unusedB) {
      groups.push({
        type: 'missing_a',
        status: 'pending',
        confidence: 0,
        amountDiffMinor: flipAmount(b.amountMinor, direction),
        dateDiffDays: null,
        descSimilarity: 0,
        explanation: locale === 'fa' ? 'این تراکنش در فایل A یافت نشد' : 'No counterpart found in file A',
        evidence: [],
        validationStatus: 'valid',
        decidedBy: 'ai',
        aIds: [],
        bIds: [b.id],
      })
    }

    // ---------- stats ----------
    const count = (type: string) => groups.filter((g) => g.type === type).length
    const exactMatched = count('exact')
    const aiMatched = count('ai_match')
    const oneToMany = count('one_to_many')
    const manyToOne = count('many_to_one')
    const amountDiff = count('amount_diff')
    const dateDiff = count('date_diff')
    const duplicates = count('duplicate')
    const missingA = count('missing_a')
    const missingB = count('missing_b')
    const unmatched = count('unmatched')
    const totalGroups = groups.length
    const matchedTotal = exactMatched + aiMatched + oneToMany + manyToOne
    const stats: ReconciliationStats = {
      totalA: txA.length,
      totalB: txB.length,
      exactMatched,
      aiMatched,
      oneToMany,
      manyToOne,
      amountDiff,
      dateDiff,
      duplicates,
      missingA,
      missingB,
      unmatched,
      invalid: count('invalid'),
      totalGroups,
      matchedTotal,
      matchRatePct: totalGroups > 0 ? Math.round((matchedTotal / totalGroups) * 100) : 0,
      amountDiffMinorTotal: groups.reduce((s, g) => s + g.amountDiffMinor, 0),
    }

    // ---------- persist groups + items ----------
    await safeJobUpdate({ stage: 'stage.save', total: totalWithAi + groups.length, progress: totalWithAi + 1 })
    const CHUNK = 40
    for (let i = 0; i < groups.length; i += CHUNK) {
      const chunk = groups.slice(i, i + CHUNK)
      await db.$transaction(async (tx) => {
        for (const g of chunk) {
          const group = await tx.matchGroup.create({
            data: {
              reconciliationId,
              type: g.type,
              status: g.status,
              confidence: g.confidence,
              amountDiffMinor: toDbMinor(g.amountDiffMinor),
              dateDiffDays: g.dateDiffDays,
              descSimilarity: g.descSimilarity,
              explanation: g.explanation,
              evidence: g.evidence ? JSON.stringify(g.evidence) : null,
              validationStatus: g.validationStatus,
              decidedBy: g.decidedBy,
            },
          })
          const items = [
            ...g.aIds.map((id) => ({ groupId: group.id, transactionId: id, side: 'A' })),
            ...g.bIds.map((id) => ({ groupId: group.id, transactionId: id, side: 'B' })),
          ]
          if (items.length > 0) await tx.matchItem.createMany({ data: items })
        }
      })
    }

    // ---------- finalize ----------
    await db.reconciliation.update({
      where: { id: reconciliationId },
      data: { status: 'completed', stats: JSON.stringify(stats), finishedAt: new Date() },
    })
    await db.job.update({ where: { id: jobId }, data: { status: 'completed', progress: totalWithAi + groups.length, total: totalWithAi + groups.length, stage: 'stage.done', error: warnings.length > 0 ? warnings.join(' | ').slice(0, 500) : null } })
    await db.project.update({ where: { id: projectId }, data: { status: 'reconciled', lastReconciledAt: new Date() } })

    const rateLabel = locale === 'fa' ? `${stats.matchRatePct.toLocaleString('fa-IR')}٪` : `${stats.matchRatePct}%`
    await notify({
      userId,
      title: locale === 'fa' ? 'مغایرت‌یابی تکمیل شد' : 'Reconciliation completed',
      body: locale === 'fa' ? `مغایرت‌یابی تکمیل شد — نرخ تطبیق ${rateLabel}` : `Reconciliation finished — match rate ${rateLabel}`,
      type: 'success',
    })
    await audit({ userId, action: 'reconcile_completed', entityType: 'reconciliation', entityId: reconciliationId, meta: { stats, warnings: warnings.length } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown reconciliation error'
    console.error('[reconcile] fatal', err)
    try {
      await db.reconciliation.update({ where: { id: reconciliationId }, data: { status: 'failed', finishedAt: new Date() } })
    } catch {}
    try {
      await db.job.update({ where: { id: jobId }, data: { status: 'failed', stage: null, error: message.slice(0, 500) } })
    } catch {}
    try {
      await db.project.update({ where: { id: projectId }, data: { status: 'failed' } })
    } catch {}
    await notify({ userId, title: locale === 'fa' ? 'مغایرت‌یابی ناموفق بود' : 'Reconciliation failed', body: message.slice(0, 300), type: 'error' })
    await audit({ userId, action: 'reconcile_failed', entityType: 'project', entityId: projectId, meta: { error: message.slice(0, 300) } })
  }
}

/** All k-sized combinations of arr (k ≤ 3, arr ≤ 8 → ≤ 92 combos). */
function kCombos<T>(arr: T[], k: number): T[][] {
  const out: T[][] = []
  const rec = (start: number, cur: T[]) => {
    if (cur.length === k) {
      out.push([...cur])
      return
    }
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i])
      rec(i + 1, cur)
      cur.pop()
    }
  }
  rec(0, [])
  return out
}
