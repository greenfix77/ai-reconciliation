import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireAdmin } from '@/lib/http'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/** GET /api/admin/projects — all projects across all users, with owner info and aggregates. */
export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    await requireAdmin()

    const url = new URL(req.url)
    const q = (url.searchParams.get('query') || '').trim().toLowerCase()
    const status = url.searchParams.get('status') || ''
    const userId = url.searchParams.get('userId') || ''
    const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1)
    const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get('pageSize') || 20) || 20))

    const where: Record<string, unknown> = {}
    if (q) where.name = { contains: q }
    if (status) where.status = status
    if (userId) where.userId = userId

    const [total, projects] = await Promise.all([
      db.project.count({ where }),
      db.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, name: true, description: true, status: true, createdAt: true, updatedAt: true, lastReconciledAt: true,
          user: { select: { id: true, name: true, email: true, role: true, status: true } },
          category: { select: { id: true, name: true, color: true } },
          _count: { select: { files: true, reconciliations: true } },
        },
      }),
    ])

    // Expose owner as `owner` in the API contract (relation is `user` in Prisma)
    const items = projects.map((p) => {
      const { user, ...rest } = p
      return { ...rest, owner: user }
    })

    return jsonOk({ projects: items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) })
  })
}
