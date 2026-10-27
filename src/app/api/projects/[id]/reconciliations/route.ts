import { NextRequest } from 'next/server'
import { handleApi, requireUser, jsonOk } from '@/lib/http'
import { db } from '@/lib/db'
import { parseReconciliationStats } from '../../_shared'

export const runtime = 'nodejs'

/** GET /api/projects/[id]/reconciliations — run history for the project */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(req, async () => {
    const user = await requireUser()
    const { id } = await params

    // Scope by owner first (404 if project is not the user's)
    const project = await db.project.findFirst({ where: { id, userId: user.id }, select: { id: true } })
    if (!project) {
      return jsonOk({ reconciliations: [] })
    }

    const reconciliations = await db.reconciliation.findMany({
      where: { projectId: project.id, userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        providerName: true,
        model: true,
        stats: true,
      },
    })

    return jsonOk({
      reconciliations: reconciliations.map((r) => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
        providerName: r.providerName,
        model: r.model,
        stats: parseReconciliationStats(r.stats),
      })),
    })
  })
}
