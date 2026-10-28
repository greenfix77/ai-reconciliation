import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireAdmin, parseBody } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { getPlatformDefaults } from '@/lib/quota'

export const runtime = 'nodejs'

/** GET /api/admin/settings — platform settings (registration switch, default quotas). */
export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    await requireAdmin()
    const defaults = await getPlatformDefaults()
    return jsonOk({ settings: defaults })
  })
}

const putSchema = z.object({
  registrationOpen: z.boolean().optional(),
  defaultMaxProjects: z.number().int().min(0).max(10000).optional(),
  defaultDailyAiLimit: z.number().int().min(0).max(100000).optional(),
})

/** PUT /api/admin/settings — update platform settings. */
export async function PUT(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const admin = await requireAdmin()
      const body = await parseBody(req, putSchema)

      const entries: { key: string; value: string }[] = []
      if (body.registrationOpen !== undefined) entries.push({ key: 'registrationOpen', value: String(body.registrationOpen) })
      if (body.defaultMaxProjects !== undefined) entries.push({ key: 'defaultMaxProjects', value: String(body.defaultMaxProjects) })
      if (body.defaultDailyAiLimit !== undefined) entries.push({ key: 'defaultDailyAiLimit', value: String(body.defaultDailyAiLimit) })

      for (const e of entries) {
        await db.platformSetting.upsert({
          where: { key: e.key },
          update: { value: e.value, updatedBy: admin.id },
          create: { key: e.key, value: e.value, updatedBy: admin.id },
        })
      }

      await audit({ userId: admin.id, action: 'admin_update_settings', entityType: 'platform', entityId: 'settings', meta: { keys: entries.map((e) => e.key) }, req })

      const defaults = await getPlatformDefaults()
      return jsonOk({ settings: defaults })
    },
    { mutating: true }
  )
}
