import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApi, parseBody, clientIp, jsonOk } from '@/lib/http'
import { db } from '@/lib/db'
import { verifyPassword, createSession, AUTH_CONSTANTS } from '@/lib/auth'
import { assertRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

export const runtime = 'nodejs'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(1).max(72),
})

export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const ip = clientIp(req)
      // Rate limit: 10 attempts / 5 minutes per IP, 8 per 5 min per email
      assertRateLimit(`login:ip:${ip}`, 10, 5 * 60 * 1000)

      const body = await parseBody(req, loginSchema)
      assertRateLimit(`login:email:${body.email}`, 8, 5 * 60 * 1000)

      const user = await db.user.findUnique({ where: { email: body.email } })

      const fail = async () => {
        await audit({ userId: user?.id, action: 'login_failed', entityType: 'user', entityId: user?.id, meta: { email: body.email }, req })
        // Generic error — no user enumeration
        return NextResponse.json({ ok: false, error: 'auth.loginFailed' }, { status: 401 })
      }

      if (!user) {
        // Equalize timing roughly
        await verifyPassword(body.password, '$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZDZQj1Vp1p2b3c4d5e6f7g8h9i0jK')
        return fail()
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return NextResponse.json({ ok: false, error: 'auth.locked' }, { status: 423 })
      }

      const valid = await verifyPassword(body.password, user.passwordHash)
      if (!valid) {
        const attempts = user.failedAttempts + 1
        await db.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: attempts,
            lockedUntil: attempts >= AUTH_CONSTANTS.MAX_FAILED_ATTEMPTS ? new Date(Date.now() + AUTH_CONSTANTS.LOCKOUT_MINUTES * 60 * 1000) : null,
          },
        })
        return fail()
      }

      // Deactivated by admin — block login with a clear, non-enumerating message
      if (user.status === 'disabled') {
        await audit({ userId: user.id, action: 'login_blocked', entityType: 'user', entityId: user.id, meta: { reason: 'disabled' }, req })
        return NextResponse.json({ ok: false, error: 'auth.accountDisabled' }, { status: 403 })
      }

      await db.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } })
      await createSession(user.id)
      await audit({ userId: user.id, action: 'login', entityType: 'user', entityId: user.id, req })

      return jsonOk({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, locale: user.locale, theme: user.theme, currency: user.currency },
      })
    },
    { mutating: true }
  )
}
