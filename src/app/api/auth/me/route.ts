import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireUser, parseBody } from '@/lib/http'
import { destroySession, getSessionUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getSessionUser()
  return jsonOk({ user })
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  locale: z.enum(['fa', 'en']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  currency: z.enum(['IRR', 'IRT', 'USD']).optional(),
})

export async function PATCH(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      const body = await parseBody(req, patchSchema)
      const updated = await db.user.update({
        where: { id: user.id },
        data: body,
      })
      await audit({ userId: user.id, action: 'update_settings', entityType: 'user', entityId: user.id, meta: { keys: Object.keys(body) }, req })
      return jsonOk({
        user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, status: updated.status, locale: updated.locale, theme: updated.theme, currency: updated.currency },
      })
    },
    { mutating: true }
  )
}

export async function DELETE(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      await audit({ userId: user.id, action: 'logout', req })
      await destroySession()
      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
