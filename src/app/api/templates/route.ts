import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireUser, parseBody, ApiError } from '@/lib/http'
import { assertRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'
import { DEFAULT_CONFIG, ReconciliationConfig } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * Reconciliation configuration templates (Settings → قالب‌های تنظیمات).
 * Config is validated and clamped to safe bounds — never trusted as-is from the client.
 */

const num = (v: unknown, def: number, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : def
  return Math.min(max, Math.max(min, n))
}
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def)

function safeParse(raw: string | null | undefined): unknown {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return {}
  }
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

function clampConfig(raw: unknown): ReconciliationConfig {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    matchDirection: obj.matchDirection === 'same' ? 'same' : 'opposite',
    amountToleranceMinor: num(obj.amountToleranceMinor, DEFAULT_CONFIG.amountToleranceMinor, 0, 1_000_000_000),
    dateToleranceDays: num(obj.dateToleranceDays, DEFAULT_CONFIG.dateToleranceDays, 0, 365),
    requireExactDate: bool(obj.requireExactDate, DEFAULT_CONFIG.requireExactDate),
    useDescriptionMatching: bool(obj.useDescriptionMatching, DEFAULT_CONFIG.useDescriptionMatching),
    useReferenceMatching: bool(obj.useReferenceMatching, DEFAULT_CONFIG.useReferenceMatching),
    allowOneToMany: bool(obj.allowOneToMany, DEFAULT_CONFIG.allowOneToMany),
    allowManyToOne: bool(obj.allowManyToOne, DEFAULT_CONFIG.allowManyToOne),
    detectDuplicates: bool(obj.detectDuplicates, DEFAULT_CONFIG.detectDuplicates),
    aiBatchSize: num(obj.aiBatchSize, DEFAULT_CONFIG.aiBatchSize, 1, 200),
    minAutoConfidence: Math.min(1, Math.max(0, typeof obj.minAutoConfidence === 'number' && Number.isFinite(obj.minAutoConfidence) ? obj.minAutoConfidence : DEFAULT_CONFIG.minAutoConfidence)),
  }
}

const postSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters'),
  config: z.unknown().optional(),
})

export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    const user = await requireUser()
    const templates = await db.template.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return jsonOk({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        config: clampConfig(safeParse(t.config)),
        createdAt: t.createdAt.toISOString(),
      })),
    })
  })
}

export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      rateGuard(`templates:create:${user.id}`, 30, 10 * 60_000)
      const body = await parseBody(req, postSchema)
      const config = clampConfig(body.config)

      const template = await db.template.create({
        data: { userId: user.id, name: body.name, config: JSON.stringify(config) },
      })

      await audit({
        userId: user.id,
        action: 'template_add',
        entityType: 'template',
        entityId: template.id,
        meta: { name: template.name },
        req,
      })

      return jsonOk(
        {
          template: {
            id: template.id,
            name: template.name,
            config,
            createdAt: template.createdAt.toISOString(),
          },
        },
        { status: 201 }
      )
    },
    { mutating: true }
  )
}
