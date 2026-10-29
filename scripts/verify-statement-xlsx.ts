/** Verify the statement xlsx export structure + RTL view */
import { readFileSync } from 'fs'
import * as XLSX from 'xlsx'

const buf = readFileSync('/home/z/my-project/download/statement-test.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]!]!
console.log('sheets:', wb.SheetNames)
console.log('wb views (RTL):', JSON.stringify((wb.Workbook as { Views?: unknown } | undefined)?.Views ?? null))
const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null })
for (let i = 0; i < Math.min(rows.length, 46); i++) {
  const r = rows[i]!.map((c) => (c === null ? '' : String(c).slice(0, 34)))
  if (r.some((c) => c !== '')) console.log(String(i + 1).padStart(2), '|', r.filter((c) => c !== '').join(' | '))
}
