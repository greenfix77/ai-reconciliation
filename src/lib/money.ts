/**
 * Decimal-safe financial arithmetic.
 * All amounts are stored/processed as signed INTEGER minor units (scale = 2).
 * Floats are NEVER used for arithmetic — only for display formatting.
 */

export const SCALE = 2
const FACTOR = 100

/** Parse a human decimal string (handles Persian digits, thousand separators, +/-) to exact minor units. */
export function parseAmountToMinor(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null
    const m = Math.round(Math.abs(input) * FACTOR) * Math.sign(input)
    if (!Number.isSafeInteger(m)) return null
    return m
  }
  // Normalize Persian/Arabic digits → ASCII
  let s = input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .trim()
  s = s.replace(/[,،٬\s']/g, '')
  // Arabic decimal separator / Persian momayez
  s = s.replace(/[٫]/g, '.')
  const match = /^([+-]?)(\d*)(?:\.(\d{1,}))?$/.exec(s)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  const intPart = match[2] || '0'
  const fracRaw = match[3] || ''
  const frac = fracRaw.slice(0, SCALE).padEnd(SCALE, '0')
  // fractional remainder beyond scale → round half up
  const rest = fracRaw.slice(SCALE)
  let value = Number(intPart) * FACTOR + Number(frac)
  if (rest.length > 0 && Number(rest[0]) >= 5) value += 1
  const result = sign * value
  if (!Number.isSafeInteger(result)) return null
  return result
}

/** Exact sum of minor units. */
export function sumMinor(values: number[]): number {
  return values.reduce((acc, v) => {
    if (!Number.isSafeInteger(v)) throw new Error('Amount exceeds safe integer range')
    return acc + v
  }, 0)
}

/** Minor units → display major number (float, display only). */
export function minorToMajor(minor: number): number {
  return minor / FACTOR
}

/** Format minor units for display with locale grouping. */
export function formatAmount(minor: number, locale: string, currency?: string | null): string {
  const major = minorToMajor(minor)
  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    maximumFractionDigits: SCALE,
    minimumFractionDigits: Number.isInteger(major) ? 0 : SCALE,
  })
  const formatted = nf.format(major)
  if (currency === 'IRR') return locale === 'fa' ? `${formatted} ریال` : `${formatted} IRR`
  if (currency === 'IRT') return locale === 'fa' ? `${formatted} تومان` : `${formatted} IRT`
  if (currency === 'USD') return locale === 'fa' ? `${formatted} دلار` : `$${formatted}`
  return formatted
}

/** Percentage 0..1 → localized string */
export function formatPercent(ratio: number, locale: string): string {
  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  })
  return nf.format(Math.max(0, Math.min(1, ratio)))
}

/** Jaccard-like token similarity for descriptions (0..1) — deterministic, no AI. */
export function descriptionSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1)
  const ta = new Set(normalize(a))
  const tb = new Set(normalize(b))
  if (ta.size === 0 && tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter += 1
  const union = new Set([...ta, ...tb]).size
  return union === 0 ? 0 : inter / union
}
