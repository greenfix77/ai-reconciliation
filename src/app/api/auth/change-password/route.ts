import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireUser, parseBody, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

export const runtime = 'nodejs'

const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(72),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72)
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
})

/** POST /api/auth/change-password — self-service password change (requires current password). */
export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()

      const rl = rateLimit(`pwd-change:${user.id}`, 5, 15 * 60 * 1000)
      if (!rl.allowed) throw new ApiError(429, 'تلاش بیش از حد؛ کمی بعد دوباره تلاش کنید.', 'RATE_LIMITED')

      const body = await parseBody(req, schema)

      const record = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
      if (!record) throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED')

      const valid = await verifyPassword(body.currentPassword, record.passwordHash)
      if (!valid) {
        await audit({ userId: user.id, action: 'password_change_failed', entityType: 'user', entityId: user.id, req })
        throw new ApiError(400, 'گذرواژه فعلی نادرست است', 'INVALID_CURRENT_PASSWORD')
      }

      if (await verifyPassword(body.newPassword, record.passwordHash)) {
        throw new ApiError(400, 'گذرواژه جدید نباید با گذرواژه فعلی یکسان باشد', 'SAME_PASSWORD')
      }

      await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } })
      await audit({ userId: user.id, action: 'password_changed', entityType: 'user', entityId: user.id, req })

      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
