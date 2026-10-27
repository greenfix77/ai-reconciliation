/**
 * Jalali (Solar Hijri) ↔ Gregorian conversion — standard algorithm (jalaali-js compatible).
 * Robust date parsing for financial files: Jalali 1403/05/12, Gregorian ISO, dd/mm/yyyy.
 */

function div(a: number, b: number) {
  return ~~(a / b)
}

function jalCal(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]
  let bl = breaks.length
  const gy = jy + 621
  let leapJ = -14
  let jp = breaks[0]
  let jump = 0
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(jump % 33, 4)
    jp = jm
  }
  let n = jy - jp
  leapJ = leapJ + div(n, 33) * 8 + div((n % 33) + 3, 4)
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = (((n + 1) % 33) - 1) % 4
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * ((gm + 9) % 12) + 2, 5) + gd - 34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div((j % 1461) / 4, 1) * 5 + 308
  const gd = div((i % 153) / 5, 1) + 1
  const gm = (div(i, 153) % 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

export function jalaaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  const r = jalCal(jy)
  return d2g(g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1)
}

export function gregorianToJalaali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const jdn = g2d(gy, gm, gd)
  let jy = gy - 621
  const r = jalCal(jy)
  const jdn1f = g2d(r.gy, 3, r.march)
  let k = jdn - jdn1f
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: (k % 31) + 1 }
    }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }
  return { jy, jm: 7 + div(k, 30), jd: (k % 30) + 1 }
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export function normalizeDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

/**
 * Attempt to parse a date string from a financial file.
 * Returns null when unparseable. Supports:
 *  - Jalali: 1403/05/12, ۱۴۰۳-۰۵-۱۲, 12/05/1403
 *  - Gregorian ISO: 2024-08-02, 2024/08/02
 *  - Common: 02/08/2024 (assumed dd/mm)
 */
export function parseFlexibleDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const s = normalizeDigits(String(raw)).trim()
  if (!s) return null
  // ISO-like: yyyy-mm-dd or yyyy/mm/dd (optionally with time)
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    if (y > 1900 && y < 2100) return validDate(y, mo, d)
    if (y >= 1200 && y <= 1500) {
      const g = jalaaliToGregorian(y, mo, d)
      return validDate(g.gy, g.gm, g.gd)
    }
    return null
  }
  // dd/mm/yyyy or mm/dd/yyyy — assume dd/mm (common in Iranian banking exports)
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s)
  if (m) {
    const d1 = Number(m[1])
    const d2 = Number(m[2])
    const y = Number(m[3])
    if (y > 1900 && y < 2100) {
      // prefer dd/mm; if invalid swap
      const asDm = validDate(y, d2, d1)
      return asDm ?? validDate(y, d1, d2)
    }
    if (y >= 1200 && y <= 1500) {
      const g = jalaaliToGregorian(y, d2, d1)
      return validDate(g.gy, g.gm, g.gd)
    }
    return null
  }
  // Excel serial date
  m = /^(\d{4,6})$/.exec(s)
  if (m) {
    const serial = Number(m[1])
    if (serial > 25569 && serial < 80000) {
      return new Date(Math.round((serial - 25569) * 86400 * 1000))
    }
  }
  const native = new Date(s)
  if (!Number.isNaN(native.getTime())) return native
  return null
}

function validDate(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return dt
}

/** Format a Date for display: Jalali in fa, Gregorian in en. */
export function formatDateDisplay(date: Date | string, locale: 'fa' | 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

export function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000)
}
