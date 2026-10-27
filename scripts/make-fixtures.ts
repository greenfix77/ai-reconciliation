/**
 * Fixture generator for reconciliation engine E2E tests.
 * Writes two CSV statements with a controlled overlap pattern:
 *  - 7 exact 1:1 matches (A1–A6, A10)
 *  - 1 amount typo within 5% (A7 → B7: 1,250,000 vs 1,255,000)
 *  - 1 date drift +2 days (A8 → B8)
 *  - 1 one-to-many split (A9 = B9 + B10)
 *  - 1 duplicate row in A (A11 copies A10)
 *  - 1 tx only in A (A12) and 2 txs only in B (B12, B13)
 * NOTE: amounts kept ≤ 21M major (Int32 amountMinor limit of current SQLite schema).
 */
import fs from 'fs'
import path from 'path'

const BANK_ROWS: [string, string, string, string][] = [
  ['1403/07/01', 'واریز فروش نقدی روزانه', '12500000', 'TRK-1001'],
  ['1403/07/02', 'واریز فاکتور 1201 شرکت آریا', '8900000', 'TRK-1002'],
  ['1403/07/03', 'پرداخت قسط وام بانکی', '-3200000', 'TRK-1003'],
  ['1403/07/05', 'کارمزد حساب جاری', '-250000', 'TRK-1004'],
  ['1403/07/07', 'واریز مشتری الف پارس', '15000000', 'TRK-1005'],
  ['1403/07/08', 'واریز مشتری ب نیکان', '18700000', 'TRK-1006'],
  ['1403/07/10', 'واریز فروشگاه پارس', '1250000', 'TRK-1007'],
  ['1403/07/12', 'واریز فروش نقدی روزانه', '6000000', 'TRK-1008'],
  ['1403/07/15', 'واریز فروش ترکیبی پروژه', '9500000', 'TRK-1009'],
  ['1403/07/18', 'واریز فروش نقدی روزانه', '2400000', 'TRK-1010'],
  ['1403/07/18', 'واریز فروش نقدی روزانه', '2400000', 'TRK-1010'],
  ['1403/07/20', 'واریز ناشناس شماره ۹۹', '950000', 'TRK-1011'],
]

const BOOKS_ROWS: [string, string, string, string][] = [
  ['1403/07/01', 'فروش نقدی روزانه', '-12500000', 'S-501'],
  ['1403/07/02', 'دریافت فاکتور 1201 آریا', '-8900000', 'S-502'],
  ['1403/07/03', 'قسط وام بانکی', '3200000', 'S-503'],
  ['1403/07/05', 'کارمزد بانکی', '250000', 'S-504'],
  ['1403/07/07', 'دریافت از مشتری الف', '-15000000', 'S-505'],
  ['1403/07/08', 'دریافت از مشتری ب', '-18700000', 'S-506'],
  ['1403/07/10', 'فروشگاه پارس', '-1255000', 'S-507'],
  ['1403/07/14', 'فروش نقدی', '-6000000', 'S-508'],
  ['1403/07/15', 'دریافت فروش ترکیبی قسمت اول', '-4250000', 'S-509'],
  ['1403/07/15', 'دریافت فروش ترکیبی قسمت دوم', '-5250000', 'S-510'],
  ['1403/07/18', 'فروش نقدی روزانه', '-2400000', 'S-511'],
  ['1403/07/22', 'هزینه حمل بار', '2000000', 'S-512'],
  ['1403/07/25', 'تنخواه گلخانه', '-750000', 'S-513'],
]

function toCsv(header: string[], rows: [string, string, string, string][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n'
}

export function fixtureDir(): string {
  return path.join(process.cwd(), 'db', 'fixtures')
}

export function bankCsvPath(): string {
  return path.join(fixtureDir(), 'bank.csv')
}

export function booksCsvPath(): string {
  return path.join(fixtureDir(), 'books.csv')
}

export function writeFixtures(): { bank: string; books: string } {
  fs.mkdirSync(fixtureDir(), { recursive: true })
  const bank = bankCsvPath()
  const books = booksCsvPath()
  fs.writeFileSync(bank, toCsv(['تاریخ', 'شرح', 'مبلغ', 'شماره پیگیری'], BANK_ROWS), 'utf8')
  fs.writeFileSync(books, toCsv(['تاریخ', 'شرح', 'مبلغ', 'شماره پیگیری'], BOOKS_ROWS), 'utf8')
  return { bank, books }
}

// run directly
if (import.meta.main) {
  const paths = writeFixtures()
  console.log('fixtures written:', paths)
}
