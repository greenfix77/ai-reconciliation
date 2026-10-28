import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireAdmin, parseBody, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { getPlatformDefaults, aiCallsToday } from '@/lib/quota'

export const runtime = 'nodejs'

/** GET /api/admin/users/[id] — full oversight profile of one user. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(req, async () => {
    await requireAdmin()
    const { id } = await ctx.params

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true, status: true, disabledAt: true,
        locale: true, theme: true, currency: true,
        maxProjects: true, dailyAiLimit: true, canUseAi: true,
        failedAttempts: true, lockedUntil: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      },
    })
    if (!user) throw new ApiError(404, 'کاربر یافت نشد', 'NOT_FOUND')

    const [projects, providers, defaults, aiToday, recentActivity] = await Promise.all([
      db.project.findMany({
        where: { userId: id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, status: true, createdAt: true, updatedAt: true, _count: { select: { files: true, reconciliations: true } } },
      }),
      db.aiProvider.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, type: true, baseUrl: true, keyHint: true, models: true, isDefault: true, status: true, lastTestedAt: true, createdAt: true },
      }),
      getPlatformDefaults(),
      aiCallsToday(id),
      db.activityLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: { id: true, action: true, entityType: true, entityId: true, ip: true, createdAt: true },
      }),
    ])

    return jsonOk({ user, projects, providers, defaults, aiToday, recentActivity })
  })
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  maxProjects: z.number().int().min(0).max(10000).nullable().optional(),
  dailyAiLimit: z.number().int().min(0).max(100000).nullable().optional(),
  canUseAi: z.boolean().optional(),
  clearLockout: z.boolean().optional(),
})

/** PATCH /api/admin/users/[id] — role, status (de/activate), quotas, unlock. Self-protection enforced. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const admin = await requireAdmin()
      const { id } = await ctx.params
      const body = await parseBody(req, patchSchema)

      const target = await db.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, status: true } })
      if (!target) throw new ApiError(404, 'کاربر یافت نشد', 'NOT_FOUND')

      const data: Record<string, unknown> = {}
      if (body.name !== undefined) data.name = body.name
      if (body.maxProjects !== undefined) data.maxProjects = body.maxProjects
      if (body.dailyAiLimit !== undefined) data.dailyAiLimit = body.dailyAiLimit
      if (body.canUseAi !== undefined) data.canUseAi = body.canUseAi
      if (body.clearLockout) {
        data.failedAttempts = 0
        data.lockedUntil = null
      }

      if (body.role !== undefined && body.role !== target.role) {
        if (target.id === admin.id) throw new ApiError(400, 'تغییر نقش حساب خودتان مجاز نیست', 'SELF_ROLE_CHANGE')
        if (target.role === 'admin') {
          const adminCount = await db.user.count({ where: { role: 'admin', status: 'active' } })
          if (adminCount <= 1) throw new ApiError(400, 'آخرین ادمین فعال قابل تغییر نقش نیست', 'LAST_ADMIN')
        }
        data.role = body.role
      }

      if (body.status !== undefined && body.status !== target.status) {
        if (target.id === admin.id) throw new ApiError(400, 'غیرفعال‌سازی حساب خودتان مجاز نیست', 'SELF_DISABLE')
        if (target.role === 'admin' && body.status === 'disabled') {
          const adminCount = await db.user.count({ where: { role: 'admin', status: 'active' } })
          if (adminCount <= 1) throw new ApiError(400, 'آخرین ادمین فعال قابل غیرفعال‌سازی نیست', 'LAST_ADMIN')
        }
        data.status = body.status
        data.disabledAt = body.status === 'disabled' ? new Date() : null
        data.failedAttempts = 0
        data.lockedUntil = null
      }

      if (Object.keys(data).length === 0) throw new ApiError(400, 'تغییری ارسال نشده است', 'EMPTY_PATCH')

      const updated = await db.user.update({
        where: { id },
        data,
        select: { id: true, email: true, name: true, role: true, status: true, maxProjects: true, dailyAiLimit: true, canUseAi: true, disabledAt: true, lockedUntil: true },
      })

      await audit({ userId: admin.id, action: 'admin_update_user', entityType: 'user', entityId: id, meta: { changes: Object.keys(data) }, req })
      return jsonOk({ user: updated })
    },
    { mutating: true }
  )
}

/** DELETE /api/admin/users/[id] — hard delete with full cascade. Default flow is deactivation; this is explicit. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const admin = await requireAdmin()
      const { id } = await ctx.params

      if (id === admin.id) throw new ApiError(400, 'حذف حساب خودتان مجاز نیست', 'SELF_DELETE')

      const target = await db.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, status: true } })
      if (!target) throw new ApiError(404, 'کاربر یافت نشد', 'NOT_FOUND')

      if (target.role === 'admin') {
        const adminCount = await db.user.count({ where: { role: 'admin', status: 'active' } })
        if (adminCount <= 1) throw new ApiError(400, 'آخرین ادمین فعال قابل حذف نیست', 'LAST_ADMIN')
      }

      await db.user.delete({ where: { id } })
      await audit({ userId: admin.id, action: 'admin_delete_user', entityType: 'user', entityId: id, meta: { email: target.email, status: target.status }, req })
      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
