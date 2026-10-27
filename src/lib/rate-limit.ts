/**
 * In-memory fixed-window rate limiter (single-instance deployment).
 * Keyed by arbitrary bucket names (e.g. `login:ip:1.2.3.4`).
 * Periodically pruned to avoid unbounded growth.
 */

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
let lastPrune = Date.now()

function prune(now: number) {
  if (now - lastPrune < 60_000) return
  lastPrune = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  prune(now)
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, retryAfterSec: 0 }
  }
  bucket.count += 1
  if (bucket.count > max) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { allowed: true, remaining: max - bucket.count, retryAfterSec: 0 }
}

export function assertRateLimit(key: string, max: number, windowMs: number) {
  const result = rateLimit(key, max, windowMs)
  if (!result.allowed) {
    const err = new Error(`Too many requests. Try again in ${result.retryAfterSec}s.`) as Error & { status?: number; code?: string }
    err.status = 429
    err.code = 'RATE_LIMITED'
    throw err
  }
}
