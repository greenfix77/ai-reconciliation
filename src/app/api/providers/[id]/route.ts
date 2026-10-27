import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireUser, parseBody, ApiError } from '@/lib/http'
import { assertRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'
import { encryptSecret, maskKey } from '@/lib/crypto'
import { AiProvider } from '@prisma/client'
import { ProviderItem } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * Single AI Provider (PATCH / DELETE) — always scoped to the session user.
 * SECURITY: apiKeyEnc is never serialized; only keyHint. Keys are never logged.
 */

const httpsOrEmpty = z
  .string()
  .trim()
  .max(300, 'Base URL must be at most 300 characters')
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/i.test(v), { message: 'Base URL must be a valid https:// URL or empty' })

const patchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name must be at most 60 characters').optional(),
  baseUrl: httpsOrEmpty.optional(),
  apiKey: z.string().trim().min(8, 'API key must be at least 8 characters').max(400, 'API key must be at most 400 characters').optional(),
  models: z
    .array(z.string().trim().min(1).max(120))
    .min(1, 'At least one model is required')
    .max(20, 'At most 20 models')
    .optional(),
  isDefault: z.boolean().optional(),
})

function parseModelsJson(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((m): m is string => typeof m === 'string' && m.length > 0)
  } catch {
    // corrupted row — fall through
  }
  return []
}

/** assertRateLimit throws a plain Error with .status — normalize it to ApiError 429 for handleApi. */
function rateGuard(key: string, max: number, windowMs: number) {
  try {
    assertRateLimit(key, max, windowMs)
  } catch (err) {
    const e = err as Error & { status?: number }
    throw new ApiError(e.status ?? 429, e.message || 'Too many requests', 'RATE_LIMITED')
  }
}

function serializeProvider(p: AiProvider): ProviderItem {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    baseUrl: p.baseUrl,
    keyHint: p.keyHint,
    models: parseModelsJson(p.models),
    isDefault: p.isDefault,
    status: p.status,
    lastTestedAt: p.lastTestedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const { id } = await params
      const user = await requireUser()
      rateGuard(`providers:update:${user.id}`, 40, 10 * 60_000)
      const body = await parseBody(req, patchSchema)

      const provider = await db.aiProvider.findFirst({ where: { id, userId: user.id } })
      if (!provider) throw new ApiError(404, 'Provider not found', 'NOT_FOUND')

      const data: {
        name?: string
        baseUrl?: string | null
        apiKeyEnc?: string
        keyHint?: string
        models?: string
        isDefault?: boolean
        status?: string
      } = {}
      let credentialChanged = false

      if (body.name !== undefined) data.name = body.name
      if (body.baseUrl !== undefined) {
        const nextBase = body.baseUrl === '' ? null : body.baseUrl
        if (nextBase !== provider.baseUrl) credentialChanged = true
        data.baseUrl = nextBase
      }
      if (body.apiKey !== undefined) {
        data.apiKeyEnc = encryptSecret(body.apiKey)
        data.keyHint = maskKey(body.apiKey)
        credentialChanged = true
      }
      if (body.models !== undefined) data.models = JSON.stringify(body.models)
      if (body.isDefault === true) {
        await db.aiProvider.updateMany({
          where: { userId: user.id, isDefault: true, NOT: { id: provider.id } },
          data: { isDefault: false },
        })
        data.isDefault = true
      }
      if (credentialChanged) data.status = 'untested'

      const updated = await db.aiProvider.update({ where: { id: provider.id }, data })

      await audit({
        userId: user.id,
        action: 'provider_update',
        entityType: 'ai_provider',
        entityId: provider.id,
        meta: { fields: Object.keys(body), credentialChanged },
        req,
      })

      return jsonOk({ provider: serializeProvider(updated) })
    },
    { mutating: true }
  )
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const { id } = await params
      const user = await requireUser()

      const provider = await db.aiProvider.findFirst({ where: { id, userId: user.id } })
      if (!provider) throw new ApiError(404, 'Provider not found', 'NOT_FOUND')

      await db.aiProvider.delete({ where: { id: provider.id } })

      await audit({
        userId: user.id,
        action: 'provider_delete',
        entityType: 'ai_provider',
        entityId: provider.id,
        meta: { name: provider.name, type: provider.type },
        req,
      })

      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
