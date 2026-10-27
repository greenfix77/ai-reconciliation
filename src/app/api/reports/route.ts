import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireUser } from '@/lib/http'
import { db } from '@/lib/db'
import { ReconciliationStats } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * GET /api/reports — the user's completed reconciliations with project names.
 * stats is a stored JSON snapshot of ReconciliationStats.
 */

export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    const user = await requireUser()

    const recons = await db.reconciliation.findMany({
      where: { userId: user.id, status: 'completed' },
      include: { project: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 200,
    })

    const reports = recons.map((r) => {
      let stats: ReconciliationStats | null = null
      if (r.stats) {
        try {
          stats = JSON.parse(r.stats) as ReconciliationStats
        } catch {
          stats = null
        }
      }
      return {
        id: r.id,
        projectId: r.projectId,
        projectName: r.project.name,
        status: 'completed' as const,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        providerName: r.providerName,
        model: r.model,
        stats,
      }
    })

    return jsonOk({ reports })
  })
}
