import { db } from '@/lib/db'
import { ApiError } from '@/lib/http'
import { AiToolType, DEFAULT_CONFIG, ReconciliationConfig, ReconciliationStats } from '@/lib/types'
import { fromDbMinor } from '@/lib/money'
import { aiChat } from '@/lib/ai-client'
import { buildToolSystemPrompt, toolUserPrompt } from './prompts'

/**
 * AI tools service — builds tight, data-grounded prompts from REAL project data
 * and executes the 7 analysis tools. Never invents data: everything in the prompt
 * comes from the user's own reconciliation rows.
 */

const MAX_DATA_CHARS = 9000

type TxRow = {
  ref: string | null
  date: string
  desc: string
  amount: number // major units
  side: string
}

function fmt(amountMinor: number): number {
  return Math.round(amountMinor) / 100
}

function txLine(t: TxRow): string {
  return `- [${t.side}] ${t.date} | ${t.ref ?? '—'} | ${t.desc.slice(0, 60)} | ${t.amount.toLocaleString('en-US')}`
}

function parseStats(raw: string | null): Partial<ReconciliationStats> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Partial<ReconciliationStats>
  } catch {
    return null
  }
}

function parseConfig(raw: string | null): ReconciliationConfig {
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw || '{}') as Partial<ReconciliationConfig>) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function truncate(s: string): string {
  if (s.length <= MAX_DATA_CHARS) return s
  return s.slice(0, MAX_DATA_CHARS) + '\n…(truncated)'
}

async function loadCoreData(projectId: string, userId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project || project.userId !== userId) throw new ApiError(404, 'پروژه یافت نشد', 'NOT_FOUND')
  const owner = await db.user.findUnique({ where: { id: userId }, select: { locale: true } })

  const reconciliations = await db.reconciliation.findMany({
    where: { projectId, status: 'completed' },
    orderBy: { startedAt: 'desc' },
    take: 2,
  })
  const latest = reconciliations[0] ?? null
  const previous = reconciliations[1] ?? null

  let groups: {
    id: string
    type: string
    status: string
    confidence: number
    amountDiffMinor: number
    dateDiffDays: number | null
    explanation: string | null
    items: { side: string; transaction: { reference: string | null; date: Date | null; description: string | null; amountMinor: number; flags: string } }[]
  }[] = []
  if (latest) {
    // MatchItem.transactionId is a plain string (no Prisma relation) — hydrate manually
    const rows = await db.matchGroup.findMany({
      where: { reconciliationId: latest.id },
      include: { items: true },
      orderBy: { amountDiffMinor: 'desc' },
    })
    const txIds = [...new Set(rows.flatMap((g) => g.items.map((it) => it.transactionId)))]
    const txs = txIds.length
      ? await db.transaction.findMany({
          where: { id: { in: txIds } },
          select: { id: true, reference: true, date: true, description: true, amountMinor: true, flags: true },
        })
      : []
    const txById = new Map(txs.map((t) => [t.id, t]))
    groups = rows.map((g) => ({
      id: g.id,
      type: g.type,
      status: g.status,
      confidence: g.confidence,
      amountDiffMinor: fromDbMinor(g.amountDiffMinor),
      dateDiffDays: g.dateDiffDays,
      explanation: g.explanation,
      items: g.items
        .filter((it) => txById.has(it.transactionId))
        .map((it) => {
          const t = txById.get(it.transactionId)!
          return {
            side: it.side,
            transaction: {
              reference: t.reference,
              date: t.date,
              description: t.description,
              amountMinor: fromDbMinor(t.amountMinor),
              flags: t.flags,
            },
          }
        }),
    }))
  }

  return { project, latest, previous, groups, locale: owner?.locale === 'en' ? 'en' : 'fa' }
}

function statsBlock(stats: Partial<ReconciliationStats> | null, config: ReconciliationConfig, recon: { startedAt: Date; providerName: string; model: string } | null): string {
  if (!recon || !stats) return 'No completed reconciliation yet.'
  return `Run date: ${recon.startedAt.toISOString().slice(0, 10)} | AI: ${recon.providerName}/${recon.model}
Config: direction=${config.matchDirection}, amountTolerance=${config.amountToleranceMinor / 100}, dateToleranceDays=${config.dateToleranceDays}
Stats: ${JSON.stringify(stats)}`
}

function toRow(t: { reference: string | null; date: Date | null; description: string | null; amountMinor: number }, side: string): TxRow {
  return {
    ref: t.reference,
    date: t.date ? t.date.toISOString().slice(0, 10) : '—',
    desc: t.description ?? '',
    amount: fmt(t.amountMinor),
    side,
  }
}

function discrepancyBlock(groups: Awaited<ReturnType<typeof loadCoreData>>['groups']): string {
  const interesting = groups.filter((g) => ['unmatched', 'missing_a', 'missing_b', 'amount_diff', 'date_diff', 'duplicate', 'invalid'].includes(g.type))
  const lines: string[] = []
  for (const g of interesting.slice(0, 60)) {
    const aRows = g.items.filter((i) => i.side === 'A').map((i) => toRow(i.transaction, 'A'))
    const bRows = g.items.filter((i) => i.side === 'B').map((i) => toRow(i.transaction, 'B'))
    lines.push(`[${g.type}] diff=${fmt(g.amountDiffMinor).toLocaleString('en-US')}${g.dateDiffDays !== null ? ` dateDiff=${g.dateDiffDays}d` : ''}`)
    for (const r of aRows) lines.push(txLine(r))
    for (const r of bRows) lines.push(txLine(r))
  }
  return lines.join('\n')
}

function matchedSampleBlock(groups: Awaited<ReturnType<typeof loadCoreData>>['groups']): string {
  const matched = groups.filter((g) => ['exact', 'ai_match', 'one_to_many', 'many_to_one'].includes(g.type)).slice(0, 10)
  const lines: string[] = []
  for (const g of matched) {
    const aRows = g.items.filter((i) => i.side === 'A').map((i) => toRow(i.transaction, 'A'))
    const bRows = g.items.filter((i) => i.side === 'B').map((i) => toRow(i.transaction, 'B'))
    lines.push(`[${g.type}] conf=${g.confidence.toFixed(2)}`)
    for (const r of aRows) lines.push(txLine(r))
    for (const r of bRows) lines.push(txLine(r))
  }
  return lines.join('\n')
}

function amountDiffBlock(groups: Awaited<ReturnType<typeof loadCoreData>>['groups']): string {
  const diffs = groups
    .filter((g) => g.type === 'amount_diff')
    .sort((x, y) => Math.abs(y.amountDiffMinor) - Math.abs(x.amountDiffMinor))
    .slice(0, 5)
  const lines: string[] = []
  for (const g of diffs) {
    const aRows = g.items.filter((i) => i.side === 'A').map((i) => toRow(i.transaction, 'A'))
    const bRows = g.items.filter((i) => i.side === 'B').map((i) => toRow(i.transaction, 'B'))
    lines.push(`[amount_diff] difference=${fmt(g.amountDiffMinor).toLocaleString('en-US')}`)
    for (const r of aRows) lines.push(`  A (bank): ${r.date} | ${r.ref ?? '—'} | ${r.desc.slice(0, 60)} | ${r.amount.toLocaleString('en-US')}`)
    for (const r of bRows) lines.push(`  B (books): ${r.date} | ${r.ref ?? '—'} | ${r.desc.slice(0, 60)} | ${r.amount.toLocaleString('en-US')}`)
  }
  return lines.join('\n')
}

async function anomalyBlock(projectId: string): Promise<string> {
  const txs = await db.transaction.findMany({
    where: { file: { projectId } },
    select: { side: true, reference: true, date: true, description: true, amountMinor: true, flags: true },
    orderBy: { amountMinor: 'desc' },
  })
  const rows = txs.map((t) => ({ ...toRow({ ...t, amountMinor: fromDbMinor(t.amountMinor) }, t.side), flags: (() => { try { return JSON.parse(t.flags || '[]') as string[] } catch { return [] } })() }))
  const lines: string[] = []
  const round = rows.filter((r) => r.amount !== 0 && Math.abs(r.amount) % 1000000 === 0)
  const amountCounts = new Map<number, TxRow[]>()
  for (const r of rows) {
    const arr = amountCounts.get(r.amount) ?? []
    arr.push(r)
    amountCounts.set(r.amount, arr)
  }
  const repeated = [...amountCounts.entries()].filter(([, arr]) => arr.length > 1).slice(0, 12)
  const dupes = rows.filter((r) => r.flags.includes('duplicate'))
  const largest = rows.slice(0, 8)
  lines.push(`Total transactions: ${rows.length}`)
  lines.push('Largest amounts:')
  for (const r of largest) lines.push(txLine(r))
  if (round.length) {
    lines.push('Round-number amounts (suspicious round figures):')
    for (const r of round.slice(0, 12)) lines.push(txLine(r))
  }
  if (repeated.length) {
    lines.push('Repeated identical amounts:')
    for (const [, arr] of repeated) for (const r of arr) lines.push(txLine(r))
  }
  if (dupes.length) {
    lines.push('Duplicate-flagged rows:')
    for (const r of dupes.slice(0, 12)) lines.push(txLine(r))
  }
  return lines.join('\n')
}

export async function runAiTool(projectId: string, userId: string, tool: AiToolType): Promise<{ result: string; tool: AiToolType }> {
  const { project, latest, previous, groups, locale } = await loadCoreData(projectId, userId)
  const config = latest ? parseConfig(latest.config) : parseConfig(project.config)
  const stats = parseStats(latest?.stats ?? null)

  const reconMeta = latest ? { startedAt: latest.startedAt, providerName: latest.providerName, model: latest.model } : null
  const header = `Project: ${project.name}${project.description ? ` — ${project.description}` : ''}
${statsBlock(stats, config, reconMeta)}`

  let data: string
  switch (tool) {
    case 'discrepancy_analysis':
      data = `${header}\n\nDISCREPANCY GROUPS:\n${discrepancyBlock(groups)}`
      break
    case 'root_cause':
      data = `${header}\n\nDISCREPANCY GROUPS (with refs/dates/amounts):\n${discrepancyBlock(groups)}\n\nMATCHED SAMPLE (for context):\n${matchedSampleBlock(groups)}`
      break
    case 'resolution_recommendations':
      data = `${header}\n\nDISCREPANCY GROUPS:\n${discrepancyBlock(groups)}`
      break
    case 'accounting_entries':
      data = `${header}\n\nTOP AMOUNT-DIFF GROUPS:\n${amountDiffBlock(groups)}`
      break
    case 'anomaly_detection':
      data = `${header}\n\nTRANSACTION ANOMALY SCAN:\n${await anomalyBlock(projectId)}`
      break
    case 'report_generation':
      data = `${header}\n\nMATCHED SAMPLE:\n${matchedSampleBlock(groups)}\n\nDISCREPANCY GROUPS:\n${discrepancyBlock(groups)}`
      break
    case 'project_comparison': {
      if (!previous) {
        throw new ApiError(400, 'برای مقایسه به حداقل ۲ مغایرت‌یابی تکمیل‌شده نیاز است', 'NOT_ENOUGH_RUNS')
      }
      const s1 = parseStats(latest?.stats ?? null)
      const s2 = parseStats(previous.stats)
      data = `Project: ${project.name}
RUN 1 (latest, ${latest!.startedAt.toISOString().slice(0, 10)}): ${JSON.stringify(s1)}
RUN 2 (previous, ${previous.startedAt.toISOString().slice(0, 10)}): ${JSON.stringify(s2)}`
      break
    }
    default:
      throw new ApiError(400, 'ابزار نامعتبر است', 'BAD_TOOL')
  }

  const result = await aiChat({
    providerId: project.aiProviderId,
    model: project.aiModel,
    messages: [
      { role: 'system', content: buildToolSystemPrompt(locale) },
      { role: 'user', content: toolUserPrompt(tool, truncate(data)) },
    ],
    temperature: 0.2,
    maxTokens: 1500,
  })

  return { result: result.content, tool }
}
