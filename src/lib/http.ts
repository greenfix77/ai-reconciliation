import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema } from 'zod'
import { getSessionUser, AuthUser } from './auth'

export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init)
}

export function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status })
}

/**
 * Central handler for all API routes:
 * - error normalization (never leaks stack traces to clients)
 * - CSRF hardening: mutating requests must include X-Requested-With header
 *   (cannot be forged cross-origin without CORS preflight approval)
 */
export async function handleApi(
  req: NextRequest,
  fn: () => Promise<NextResponse>,
  opts: { mutating?: boolean } = {}
): Promise<NextResponse> {
  try {
    const mutating = opts.mutating ?? ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    if (mutating) {
      const xrw = req.headers.get('x-requested-with')
      if (xrw !== 'XMLHttpRequest') {
        throw new ApiError(403, 'CSRF validation failed', 'CSRF')
      }
    }
    return await fn()
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonError(err.status, err.message, err.code)
    }
    // Errors carrying an explicit numeric status (e.g. rate limiter) are intentional
    const status = (err as { status?: unknown })?.status
    if (typeof status === 'number' && status >= 400 && status < 600) {
      const msg = err instanceof Error ? err.message : 'Request failed'
      const code = (err as { code?: string })?.code
      return jsonError(status, msg, code)
    }
    console.error('[api-error]', err)
    return jsonError(500, 'Internal server error', 'INTERNAL')
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED')
  return user
}

/** Server-side role guard for /api/admin/* surfaces. Role is read from DB, never from client input. */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser()
  if (user.role !== 'admin') throw new ApiError(403, 'Administrator access required', 'FORBIDDEN')
  return user
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body', 'BAD_JSON')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new ApiError(400, `Invalid input: ${first?.path?.join('.') || 'body'} — ${first?.message || 'validation failed'}`, 'VALIDATION')
  }
  return result.data
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export function requireSameUser(user: AuthUser, resourceUserId: string) {
  if (user.id !== resourceUserId) {
    throw new ApiError(403, 'Access denied', 'FORBIDDEN')
  }
}
