import { NextRequest, NextResponse } from 'next/server'
import { handleApi, jsonOk, requireUser } from '@/lib/http'
import { audit } from '@/lib/audit'
import { computeBankReconStatement, BankReconStatement, StatementOpenItem } from '@/lib/engine/recon-statement'
import { formatDateDisplay } from '@/lib/jalali'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

/**
 * GET /api/reports/[projectId]/statement — صورت مغایرت بانکی
 * Query: ?format=json|xlsx (default json) & bankSide=A|B (default B)
 * - json : full statement DTO for the UI
 * - xlsx : the official «صورت مغایرت بانکی» form as a right-to-left Excel sheet
 * SECURITY: project ownership verified inside computeBankReconStatement.
 */

const JALALI_MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

function monthLabelFa(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  const idx = parseInt(m ?? '1', 10) - 1
  const yy = (y ?? '').slice(2)
  return `${JALALI_MONTHS_FA[idx] ?? m} ${yy}`
}

function money(minor: number): number {
  // numbers stay numeric in Excel; display format adds separators + parentheses
  return minor / 100
}

function itemRow(startIdx: number, it: StatementOpenItem) {
  const inflow = it.inflowMinor
  const deposit = inflow > 0 ? money(inflow) : null
  const withdraw = inflow < 0 ? money(-inflow) : null
  return {
    idx: startIdx,
    date: it.date ? formatDateDisplay(it.date, 'fa') : '—',
    time: it.time ?? '—',
    desc: it.description ?? '—',
    deposit,
    withdraw,
  }
}

function buildStatementSheet(st: BankReconStatement): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = []
  const push = (...cells: (string | number | null)[]) => rows.push(cells)

  // ---------- header ----------
  push(null, null, st.projectName, null, null, null, null, null)
  push(null, null, 'صورت مغایرت بانکی حساب جاری', null, null, null, null, null)
  const asOf = st.bankAsOfDate ?? st.bookAsOfDate
  push(null, null, asOf ? `در تاریخ: ${formatDateDisplay(asOf, 'fa')}` : null, null, null, `تاریخ تهیه گزارش: ${formatDateDisplay(new Date(), 'fa')}`, null, null)
  push(null, null, null, null, null, null, null, null)

  // ---------- balance block (two columns, like the official form) ----------
  push(null, 'مانده طبق دفتر', st.bookClosingMinor !== null ? money(st.bookClosingMinor) : '—', null, 'مانده طبق بانک', st.bankClosingMinor !== null ? money(st.bankClosingMinor) : '—')
  push(null, 'اضافه می‌شود اقلام بستانکار بانک:', money(st.totals.bankCreditsMinor), null, 'اضافه می‌شود اقلام بدهکار دفتر:', money(st.totals.bookDebitsMinor))
  push(null, 'کسر می‌شود اقلام بدهکار بانک:', money(-st.totals.bankDebitsMinor), null, 'کسر می‌شود اقلام بستانکار دفتر:', money(-st.totals.bookCreditsMinor))
  push(null, 'مانده واقعی', money(st.trueBalanceFromBookMinor), null, 'مانده واقعی', money(st.trueBalanceFromBankMinor))
  if (!st.converged) {
    push(null, 'اختلاف تفسیرنشده', money(st.residualMinor), null, null, null)
  }
  push(null, null, null, null, null, null, null, null)

  // ---------- book open items ----------
  const bookItems = [...st.bookDebitsOpen, ...st.bookCreditsOpen].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  push(null, 'ردیف', 'تاریخ', 'ساعت', 'شرح دفتر', 'واریز', 'برداشت', null)
  let idx = 1
  let sumDep = 0
  let sumWit = 0
  for (const it of bookItems) {
    const r = itemRow(idx, it)
    push(null, r.idx, r.date, r.time, r.desc, r.deposit, r.withdraw, null)
    sumDep += r.deposit ?? 0
    sumWit += r.withdraw ?? 0
    idx += 1
  }
  push(null, 'جمع اقلام باز دفتر', null, null, `${bookItems.length} قلم`, sumDep || null, sumWit || null, null)
  push(null, null, null, null, null, null, null, null)

  // ---------- bank open items (grouped by Jalali month, like the official form) ----------
  const bankItems = [...st.bankCreditsOpen, ...st.bankDebitsOpen].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  push(null, 'ردیف', 'تاریخ', 'ساعت', 'شرح صورتحساب بانک', 'واریز بانک', 'برداشت بانک', null)
  idx = 1
  sumDep = 0
  sumWit = 0
  let currentMonth: string | null = null
  for (const it of bankItems) {
    if (it.monthKey && it.monthKey !== currentMonth) {
      currentMonth = it.monthKey
      push(null, null, null, null, monthLabelFa(currentMonth), null, null, null)
    }
    const r = itemRow(idx, it)
    push(null, r.idx, r.date, r.time, r.desc, r.deposit, r.withdraw, null)
    sumDep += r.deposit ?? 0
    sumWit += r.withdraw ?? 0
    idx += 1
  }
  push(null, 'جمع اقلام باز بانک', null, null, `${bankItems.length} قلم`, sumDep || null, sumWit || null, null)
  push(null, 'جمع کل بد/بس', null, null, null, sumDep || null, sumWit || null, null)
  push(null, null, null, null, null, null, null, null)
  push(null, null, null, null, null, 'مهر و امضای صندوق', null, null)

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 3 }, { wch: 30 }, { wch: 14 }, { wch: 10 }, { wch: 52 }, { wch: 16 }, { wch: 16 }, { wch: 3 }]
  ws['!merges'] = [
    { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 2 }, e: { r: 1, c: 4 } },
  ]
  // number format: thousands separators, negatives in parentheses (accounting style)
  // NOTE: RTL view is applied at workbook level in the GET handler (SheetJS writes
  // the rightToLeft flag from wb.Workbook.Views[0].RTL when writing xlsx).
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr]
      if (cell && cell.t === 'n' && typeof cell.v === 'number') {
        cell.z = '#,##0;(#,##0)'
      }
    }
  }
  return ws
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  return handleApi(req, async () => {
    const { projectId } = await params
    const user = await requireUser()

    const url = new URL(req.url)
    const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'json'
    const bankSideParam = url.searchParams.get('bankSide')
    const bankSide: 'A' | 'B' = bankSideParam === 'A' ? 'A' : 'B'

    const st = await computeBankReconStatement(projectId, user.id, bankSide)
    if (!st) return jsonOk({ statement: null })

    if (format === 'xlsx') {
      const ws = buildStatementSheet(st)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'صورت مغایرت')
      // right-to-left workbook view (Persian official form layout)
      const wbMeta = (wb.Workbook ??= {}) as { Views?: { RTL?: boolean }[] }
      wbMeta.Views = [{ RTL: true }]
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
      await audit({
        userId: user.id,
        action: 'export_statement',
        entityType: 'reconciliation',
        entityId: st.reconciliationId,
        meta: { projectId, format: 'xlsx', bankSide },
        req,
      })
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="bank-recon-statement-${projectId}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    await audit({
      userId: user.id,
      action: 'view_statement',
      entityType: 'reconciliation',
      entityId: st.reconciliationId,
      meta: { projectId, bankSide },
      req,
    })
    return jsonOk({ statement: st })
  })
}
