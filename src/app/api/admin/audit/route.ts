import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireAdmin } from '@/lib/http'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/** GET /api/admin/audit — security & activity log viewer with filters. */
export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    await requireAdmin()

    const url = new URL(req.url)
    const action = (url.searchParams.get('action') || '').trim()
    const userId = (url.searchParams.get('userId') || '').trim()
    const q = (url.searchParams.get('query') || '').trim().toLowerCase()
    const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1)
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') || 30) || 30))

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (userId) where.userId = userId
    if (q) where.OR = [{ ip: { contains: q } }, { entityType: { contains: q } }]

    const [total, logs, distinctActions] = await Promise.all([
      db.activityLog.count({ where }),
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, email: true, role: true } } },
      }),
      db.activityLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { _count: { action: 'desc' } } }),
    ])

    return jsonOk({
      logs: logs.map((l) => ({
        id: l.id, action: l.action, entityType: l.entityType, entityId: l.entityId,
        ip: l.ip, userAgent: l.userAgent, createdAt: l.createdAt, meta: l.meta,
        user: l.user ? { name: l.user.name, email: l.user.email, role: l.user.role } : null,
      })),
      actions: distinctActions.map((a) => ({ action: a.action, count: a._count._all })),
      total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)),
    })
  })
}
