import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireAdmin, parseBody, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { notify } from '@/lib/audit'

export const runtime = 'nodejs'

const schema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72)
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
  notifyUser: z.boolean().default(true),
})

/** POST /api/admin/users/[id]/password — admin resets a user's password. Audited + rate-limited; plaintext never stored or logged. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const admin = await requireAdmin()
      const { id } = await ctx.params

      const rl = rateLimit(`admin-pwd:${admin.id}`, 20, 15 * 60 * 1000)
      if (!rl.allowed) throw new ApiError(429, 'تعداد درخواست‌ها زیاد است؛ بعداً تلاش کنید.', 'RATE_LIMITED')

      const body = await parseBody(req, schema)

      const target = await db.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } })
      if (!target) throw new ApiError(404, 'کاربر یافت نشد', 'NOT_FOUND')

      await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(body.newPassword), failedAttempts: 0, lockedUntil: null } })

      await audit({ userId: admin.id, action: 'admin_set_password', entityType: 'user', entityId: id, meta: { targetEmail: target.email }, req })

      if (body.notifyUser) {
        await notify({ userId: id, title: 'گذرواژه شما تغییر کرد', body: 'مدیر سیستم گذرواژه حساب شما را بازنشانی کرده است. در صورت نیاز با پشتیبانی تماس بگیرید.', type: 'warning' })
      }

      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
