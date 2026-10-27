import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireUser, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { DEFAULT_CONFIG, ReconciliationConfig, ReconciliationStats, ResultsResponse, ResultGroup, ResultGroupItem, JobItem } from '@/lib/types'

export const runtime = 'nodejs'

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * GET /api/projects/[id]/results?reconciliationId=
 * Latest (or specified) reconciliation + its groups (with transactions + file names),
 * active jobs and the run config.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(req, async () => {
    const { id } = await params
    const user = await requireUser()

    const project = await db.project.findUnique({ where: { id }, select: { id: true, userId: true, config: true } })
    if (!project || project.userId !== user.id) throw new ApiError(404, 'پروژه یافت نشد', 'NOT_FOUND')

    const reconciliationId = req.nextUrl.searchParams.get('reconciliationId')
    const reconciliation = await db.reconciliation.findFirst({
      where: { projectId: id, ...(reconciliationId ? { id: reconciliationId } : {}) },
      orderBy: { startedAt: 'desc' },
    })

    let groups: ResultGroup[] = []
    let reconDto: ResultsResponse['reconciliation'] = null

    if (reconciliation) {
      const rows = await db.matchGroup.findMany({
        where: { reconciliationId: reconciliation.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { items: { orderBy: { createdAt: 'asc' } } },
      })

      // MatchItem stores transactionId as a plain string (no relation) — hydrate manually
      const txIds = [...new Set(rows.flatMap((g) => g.items.map((it) => it.transactionId)))]
      const txs = txIds.length
        ? await db.transaction.findMany({
            where: { id: { in: txIds } },
            select: { id: true, fileId: true, rowIndex: true, date: true, description: true, reference: true, amountMinor: true, balance: true, flags: true },
          })
        : []
      const txById = new Map(txs.map((t) => [t.id, t]))
      const fileIds = [...new Set(txs.map((t) => t.fileId))]
      const files = fileIds.length ? await db.file.findMany({ where: { id: { in: fileIds } }, select: { id: true, originalName: true } }) : []
      const fileNameById = new Map(files.map((f) => [f.id, f.originalName]))

      groups = rows.map((g): ResultGroup => ({
        id: g.id,
        type: g.type,
        status: g.status,
        confidence: g.confidence,
        amountDiffMinor: g.amountDiffMinor,
        dateDiffDays: g.dateDiffDays,
        descSimilarity: g.descSimilarity,
        explanation: g.explanation,
        evidence: parseJsonSafe<string[] | null>(g.evidence, null),
        validationStatus: g.validationStatus,
        userNote: g.userNote,
        decidedBy: g.decidedBy,
        items: g.items
          .filter((it) => txById.has(it.transactionId))
          .map((it): ResultGroupItem => {
            const t = txById.get(it.transactionId)!
            return {
              id: it.id,
              side: it.side as 'A' | 'B',
              transaction: {
                id: t.id,
                rowIndex: t.rowIndex,
                date: t.date?.toISOString() ?? null,
                description: t.description,
                reference: t.reference,
                amountMinor: t.amountMinor,
                balance: t.balance,
                flags: parseJsonSafe<string[]>(t.flags, []),
              },
              file: { id: t.fileId, originalName: fileNameById.get(t.fileId) ?? '' },
            }
          }),
      }))

      reconDto = {
        id: reconciliation.id,
        status: reconciliation.status,
        startedAt: reconciliation.startedAt.toISOString(),
        finishedAt: reconciliation.finishedAt?.toISOString() ?? null,
        providerName: reconciliation.providerName,
        model: reconciliation.model,
        config: parseJsonSafe<ReconciliationConfig>(reconciliation.config, { ...DEFAULT_CONFIG, ...parseJsonSafe<Partial<ReconciliationConfig>>(project.config, {}) }),
        stats: parseJsonSafe<ReconciliationStats | null>(reconciliation.stats, null),
      }
    }

    const activeJobs = await db.job.findMany({
      where: { projectId: id, status: { in: ['queued', 'running'] } },
      orderBy: { createdAt: 'desc' },
    })
    const jobs: JobItem[] = activeJobs.map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      progress: j.progress,
      total: j.total,
      stage: j.stage,
      error: j.error,
      createdAt: j.createdAt.toISOString(),
    }))

    const response: ResultsResponse = { reconciliation: reconDto, groups, jobs }
    return jsonOk(response)
  })
}
