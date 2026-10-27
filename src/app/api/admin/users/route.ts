import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireAdmin, parseBody } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

export const runtime = 'nodejs'

/** GET /api/admin/users — searchable, paginated user directory with per-user aggregates. */
export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    await requireAdmin()

    const url = new URL(req.url)
    const q = (url.searchParams.get('query') || '').trim().toLowerCase()
    const status = url.searchParams.get('status') || ''
    const role = url.searchParams.get('role') || ''
    const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1)
    const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get('pageSize') || 20) || 20))

    const where: Record<string, unknown> = {}
    if (q) where.OR = [{ name: { contains: q } }, { email: { contains: q } }]
    if (status === 'active' || status === 'disabled') where.status = status
    if (role === 'admin' || role === 'user') where.role = role

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, email: true, name: true, role: true, status: true, disabledAt: true,
          maxProjects: true, dailyAiLimit: true, canUseAi: true,
          lastLoginAt: true, createdAt: true, lockedUntil: true, failedAttempts: true,
          _count: { select: { projects: true, providers: true, activityLogs: true } },
        },
      }),
    ])

    return jsonOk({ users, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) })
  })
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z
    .string()
    .min(8).max(72)
    .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  role: z.enum(['user', 'admin']).default('user'),
  maxProjects: z.number().int().min(0).max(10000).nullable().optional(),
  dailyAiLimit: z.number().int().min(0).max(100000).nullable().optional(),
  canUseAi: z.boolean().optional(),
})

/** POST /api/admin/users — admin creates a user directly (bypasses registration switch). */
export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const admin = await requireAdmin()
      const body = await parseBody(req, createSchema)

      const { hashPassword } = await import('@/lib/auth')
      const existing = await db.user.findUnique({ where: { email: body.email } })
      if (existing) throw new (await import('@/lib/http')).ApiError(409, 'این ایمیل قبلاً ثبت شده است', 'EMAIL_TAKEN')

      const user = await db.user.create({
        data: {
          name: body.name,
          email: body.email,
          passwordHash: await hashPassword(body.password),
          role: body.role,
          maxProjects: body.maxProjects ?? null,
          dailyAiLimit: body.dailyAiLimit ?? null,
          canUseAi: body.canUseAi ?? true,
        },
        select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
      })

      await audit({ userId: admin.id, action: 'admin_create_user', entityType: 'user', entityId: user.id, meta: { email: user.email, role: user.role }, req })
      return jsonOk({ user })
    },
    { mutating: true }
  )
}
