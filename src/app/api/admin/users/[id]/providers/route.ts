import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireAdmin, parseBody, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { encryptSecret, maskKey } from '@/lib/crypto'

export const runtime = 'nodejs'

/**
 * Admin-managed AI providers on behalf of a user.
 * SECURITY: identical to user-managed providers — apiKeyEnc is AES-256-GCM ciphertext,
 * never returned to any client; only keyHint (masked) is exposed. Plaintext never logged.
 */

const PROVIDER_TYPES = ['openai', 'anthropic', 'gemini', 'custom'] as const

const httpsUrlSchema = z
  .string()
  .trim()
  .max(300, 'Base URL must be at most 300 characters')
  .refine((v) => /^https:\/\/[^\s]+$/i.test(v), { message: 'Base URL must be a valid https:// URL' })

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(PROVIDER_TYPES),
  baseUrl: httpsUrlSchema.optional(),
  apiKey: z.string().trim().min(8).max(400),
  models: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  isDefault: z.boolean().default(false),
})

/** GET /api/admin/users/[id]/providers — masked list of a user's AI providers. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(req, async () => {
    await requireAdmin()
    const { id } = await ctx.params

    const user = await db.user.findUnique({ where: { id }, select: { id: true } })
    if (!user) throw new ApiError(404, 'کاربر یافت نشد', 'NOT_FOUND')

    const providers = await db.aiProvider.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, type: true, baseUrl: true, keyHint: true, models: true, isDefault: true, status: true, lastTestedAt: true, createdAt: true },
    })
    return jsonOk({ providers: providers.map((p) => ({ ...p, models: JSON.parse(p.models || '[]') as string[] })) })
  })
}

/** POST /api/admin/users/[id]/providers — create an AI provider for a user. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const admin = await requireAdmin()
      const { id } = await ctx.params
      const body = await parseBody(req, createSchema)

      const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true } })
      if (!user) throw new ApiError(404, 'کاربر یافت نشد', 'NOT_FOUND')

      const provider = await db.aiProvider.create({
        data: {
          userId: id,
          name: body.name,
          type: body.type,
          baseUrl: body.baseUrl ?? null,
          apiKeyEnc: encryptSecret(body.apiKey),
          keyHint: maskKey(body.apiKey),
          models: JSON.stringify(body.models),
          isDefault: body.isDefault,
        },
        select: { id: true, name: true, type: true, keyHint: true, isDefault: true, createdAt: true },
      })

      await audit({ userId: admin.id, action: 'admin_create_provider', entityType: 'user', entityId: id, meta: { providerId: provider.id, type: body.type }, req })
      await audit({ userId: id, action: 'provider_add', entityType: 'provider', entityId: provider.id, meta: { byAdmin: true }, req })
      return jsonOk({ provider })
    },
    { mutating: true }
  )
}
