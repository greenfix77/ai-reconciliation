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
 * AI Provider management.
 * SECURITY: apiKeyEnc is AES-256-GCM ciphertext — NEVER returned to the client.
 * Only keyHint (masked) is exposed. Plaintext keys are never logged.
 */

const PROVIDER_TYPES = ['openai', 'anthropic', 'gemini', 'custom'] as const

const httpsUrlSchema = z
  .string()
  .trim()
  .max(300, 'Base URL must be at most 300 characters')
  .refine((v) => /^https:\/\/[^\s]+$/i.test(v), { message: 'Base URL must be a valid https:// URL' })

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name must be at most 60 characters'),
  type: z.enum(PROVIDER_TYPES),
  baseUrl: httpsUrlSchema.optional(),
  apiKey: z.string().trim().min(8, 'API key must be at least 8 characters').max(400, 'API key must be at most 400 characters'),
  models: z
    .array(z.string().trim().min(1).max(120))
    .min(1, 'At least one model is required')
    .max(20, 'At most 20 models'),
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

/** DTO serializer — strips apiKeyEnc entirely; keyHint only. */
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

export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    const user = await requireUser()
    const providers = await db.aiProvider.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    return jsonOk({ providers: providers.map(serializeProvider) })
  })
}

export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      rateGuard(`providers:create:${user.id}`, 20, 10 * 60_000)
      const body = await parseBody(req, createSchema)

      const existingCount = await db.aiProvider.count({ where: { userId: user.id } })
      const provider = await db.aiProvider.create({
        data: {
          userId: user.id,
          name: body.name,
          type: body.type,
          baseUrl: body.baseUrl || null,
          apiKeyEnc: encryptSecret(body.apiKey),
          keyHint: maskKey(body.apiKey),
          models: JSON.stringify(body.models),
          isDefault: existingCount === 0,
          status: 'untested',
        },
      })

      await audit({
        userId: user.id,
        action: 'provider_add',
        entityType: 'ai_provider',
        entityId: provider.id,
        meta: { name: provider.name, type: provider.type, modelCount: body.models.length },
        req,
      })

      return jsonOk({ provider: serializeProvider(provider) }, { status: 201 })
    },
    { mutating: true }
  )
}
