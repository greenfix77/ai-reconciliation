import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApi, parseBody, clientIp, jsonOk } from '@/lib/http'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { assertRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

export const runtime = 'nodejs'

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name too short').max(80),
  email: z.string().trim().toLowerCase().email('Invalid email').max(120),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72)
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
})

export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const ip = clientIp(req)
      assertRateLimit(`register:${ip}`, 5, 60 * 60 * 1000) // 5 per hour per IP

      const body = await parseBody(req, registerSchema)

      // Platform-level registration switch (admin panel → platform settings)
      const regSetting = await db.platformSetting.findUnique({ where: { key: 'registrationOpen' } })
      if (regSetting && regSetting.value === 'false') {
        await audit({ action: 'register_blocked', entityType: 'platform', meta: { email: body.email, reason: 'registration_closed' }, req })
        return NextResponse.json({ ok: false, error: 'auth.registrationClosed' }, { status: 403 })
      }

      const existing = await db.user.findUnique({ where: { email: body.email } })
      if (existing) {
        return NextResponse.json({ ok: false, error: 'auth.emailTaken' }, { status: 409 })
      }

      const passwordHash = await hashPassword(body.password)
      const user = await db.user.create({
        data: { name: body.name, email: body.email, passwordHash },
      })

      await createSession(user.id)
      await audit({ userId: user.id, action: 'register', entityType: 'user', entityId: user.id, req })

      return jsonOk({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, locale: user.locale, theme: user.theme, currency: user.currency },
      })
    },
    { mutating: true }
  )
}
