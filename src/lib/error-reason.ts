/**
 * Extract the human-meaningful reason from noisy runtime errors.
 *
 * Why this exists: Prisma error messages embed large source-code context
 * (chunk paths, code frames) BEFORE the actual reason line. Storing the head
 * of such a message hides the cause entirely — users saw an unreadable
 * "Invalid … $transaction … invocation" wall while the real cause
 * ("Value 35000000000 does not fit in an INT column") was cut off by the
 * previous `message.slice(0, 500)` truncation.
 *
 * Strategy: drop obvious noise lines, take everything after the LAST
 * "invocation" marker, and fall back to the message tail when nothing
 * meaningful remains.
 */

const NOISE_PATTERNS: RegExp[] = [
  /__TURBOPACK__/, // bundler-mangled module ids
  /\$5b\$project\$5d2f\$/, // encoded path segments in chunk symbols
  /^\/(home|app|var|usr)\//, // absolute file paths
  /^\d+\s*[|>}]/, // code-frame line numbers ("1439 }")
  /^\d+\s+\w/, // code-frame source ("32 async function …")
  /^→\s*\d+/, // code-frame pointer ("→ 1442 await …")
  /^at\s+/, // stack frames
  /^\[?Object\s*\]?$/, // serialized object dumps
]

const PRISMA_CODE_HINTS: Record<string, string> = {
  P2002: 'رکورد تکراری (قید یکتا) / Unique constraint violation',
  P2003: 'ارتباط نامعتبر (کلید خارجی) / Foreign key constraint violation',
  P2025: 'رکورد مرتبط یافت نشد / Related record not found',
  P2021: 'جدول وجود ندارد / Table does not exist',
  P2001: 'رکورد یافت نشد / Record not found',
}

export function extractErrorReason(err: unknown): string {
  const anyErr = err as { code?: string; message?: string } | null
  const raw = anyErr && typeof anyErr.message === 'string' ? anyErr.message : String(err ?? 'Unknown error')

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const kept = lines.filter((l) => !NOISE_PATTERNS.some((re) => re.test(l)))

  // Prefer lines after the LAST "invocation" marker — the reason follows it.
  let invIdx = -1
  for (let i = 0; i < kept.length; i++) if (kept[i].includes('invocation')) invIdx = i
  let reason = invIdx >= 0 ? kept.slice(invIdx + 1).join(' — ') : kept.join(' — ')

  // Fallback: tail of the raw message (reasons live at the end of Prisma errors)
  if (reason.trim().length < 12) reason = lines.slice(-3).join(' — ')

  // Prefix a friendly hint when Prisma exposes a known error code
  const code = anyErr?.code
  const hint = code && PRISMA_CODE_HINTS[code] ? `(${code}) ${PRISMA_CODE_HINTS[code]} — ` : ''

  const text = `${hint}${reason}`.replace(/\s+/g, ' ').trim()
  return text.slice(0, 480)
}
