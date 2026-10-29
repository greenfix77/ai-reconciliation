'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Loader2, Printer, RefreshCw, FileCheck2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { minorToMajor } from '@/lib/money'
import type { BankReconStatement, StatementOpenItem } from '@/lib/engine/recon-statement'

/**
 * صورت مغایرت بانکی — Bank Reconciliation Statement view
 * Renders the official Iranian form (extracted from the client's form.xlsx):
 * two balance columns converging to «مانده واقعی», open-item tables for the
 * book and the bank (bank items grouped by Jalali month), totals and a
 * signature area. Fully RTL, print-optimized (A4) and exportable to Excel.
 */

const JALALI_MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

function monthLabelFa(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  const idx = parseInt(m ?? '1', 10) - 1
  return `${JALALI_MONTHS_FA[idx] ?? m} ${(y ?? '').slice(2)}`
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .print-statement, .print-statement * { visibility: visible !important; }
  .print-statement {
    position: absolute !important; top: 0; inset-inline-start: 0; width: 100% !important;
    max-height: none !important; overflow: visible !important;
    box-shadow: none !important; border: none !important; border-radius: 0 !important;
    background: white !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .no-print { display: none !important; }
  html, body { height: auto !important; min-height: 0 !important; background: white !important; }
  body [class*="min-h-"], body [class*="h-screen"] { min-height: 0 !important; }
  @page { size: A4; margin: 12mm 10mm; }
}
`

function fmtDateJalali(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function ItemsTable({
  title,
  items,
  depositLabel,
  withdrawLabel,
  descLabel,
  fmtAmount,
  fmtInt,
  groupByMonth,
}: {
  title: string
  items: StatementOpenItem[]
  depositLabel: string
  withdrawLabel: string
  descLabel: string
  /** minor → formatted major amount */
  fmtAmount: (minor: number) => string
  /** plain integer formatter (row numbers, counts) */
  fmtInt: (n: number) => string
  groupByMonth: boolean
}) {
  const sorted = useMemo(() => [...items].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.rowIndex - b.rowIndex), [items])
  const sumDep = sorted.reduce((s, i) => s + (i.inflowMinor > 0 ? i.inflowMinor : 0), 0)
  const sumWit = sorted.reduce((s, i) => s + (i.inflowMinor < 0 ? -i.inflowMinor : 0), 0)

  const rows: { key: string; month?: string; item?: StatementOpenItem }[] = []
  if (groupByMonth) {
    let current: string | null = null
    for (const it of sorted) {
      if (it.monthKey && it.monthKey !== current) {
        current = it.monthKey
        rows.push({ key: `m-${current}`, month: monthLabelFa(current) })
      }
      rows.push({ key: it.transactionId, item: it })
    }
  } else {
    for (const it of sorted) rows.push({ key: it.transactionId, item: it })
  }

  return (
    <div className="break-inside-avoid">
      <h4 className="mb-2 border-b-2 border-slate-700 pb-1 text-sm font-bold text-slate-800">{title}</h4>
      {sorted.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">موردی برای نمایش وجود ندارد</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="w-10 border border-slate-300 px-2 py-1.5 font-medium">ردیف</th>
              <th className="w-24 border border-slate-300 px-2 py-1.5 font-medium">تاریخ</th>
              <th className="w-16 border border-slate-300 px-2 py-1.5 font-medium">ساعت</th>
              <th className="border border-slate-300 px-2 py-1.5 text-start font-medium">{descLabel}</th>
              <th className="w-28 border border-slate-300 px-2 py-1.5 font-medium">{depositLabel}</th>
              <th className="w-28 border border-slate-300 px-2 py-1.5 font-medium">{withdrawLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              r.month ? (
                <tr key={r.key} className="bg-slate-50">
                  <td colSpan={6} className="border border-slate-300 px-2 py-1 text-center text-[11px] font-bold text-slate-600">
                    {r.month}
                  </td>
                </tr>
              ) : (
                <tr key={r.key} className="hover:bg-slate-50/60">
                  <td className="border border-slate-300 px-2 py-1 text-center tabular-nums text-slate-600">{fmtInt(sorted.indexOf(r.item!) + 1)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center tabular-nums">{fmtDateJalali(r.item!.date)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center tabular-nums text-slate-500" dir="ltr">{r.item!.time ?? '—'}</td>
                  <td className="max-w-0 truncate border border-slate-300 px-2 py-1 text-slate-700" title={r.item!.description ?? ''}>{r.item!.description ?? '—'}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center tabular-nums text-emerald-700">
                    {r.item!.inflowMinor > 0 ? fmtAmount(r.item!.inflowMinor) : ''}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-center tabular-nums text-rose-700">
                    {r.item!.inflowMinor < 0 ? fmtAmount(-r.item!.inflowMinor) : ''}
                  </td>
                </tr>
              )
            )}
            <tr className="bg-slate-100 font-bold text-slate-800">
              <td colSpan={4} className="border border-slate-300 px-2 py-1.5 text-center">جمع اقلام باز — {fmtInt(sorted.length)} قلم</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums text-emerald-800">{sumDep ? fmtAmount(sumDep) : '—'}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums text-rose-800">{sumWit ? fmtAmount(sumWit) : '—'}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

export function StatementView({ projectId }: { projectId: string }) {
  const { t, formatNumber, formatDate } = useI18n()
  const [st, setSt] = useState<BankReconStatement | null | undefined>(undefined)
  const [bankSide, setBankSide] = useState<'A' | 'B'>('B')
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!projectId) return
      if (!silent) setLoading(true)
      try {
        const res = await apiFetch<{ statement: BankReconStatement | null }>(`/api/reports/${projectId}/statement?bankSide=${bankSide}`)
        setSt(res.statement)
      } catch {
        setSt(null)
      } finally {
        setLoading(false)
      }
    },
    [projectId, bankSide]
  )

  useEffect(() => {
    setSt(undefined)
    void load()
  }, [load])

  const fmt = useCallback((minor: number) => formatNumber(minorToMajor(minor)), [formatNumber])

  if (!projectId) return null

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* actions */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select
            value={bankSide}
            onValueChange={(v) => setBankSide(v === 'A' ? 'A' : 'B')}
          >
            <SelectTrigger className="h-8 w-[190px] rounded-xl text-xs" aria-label={t('results.statement.bankSide')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="B">{t('results.statement.bankIsB')}</SelectItem>
              <SelectItem value="A">{t('results.statement.bankIsA')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={() => void load(true)} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t('results.refresh')}
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={() => {
              window.location.href = `/api/reports/${projectId}/statement?format=xlsx&bankSide=${bankSide}`
            }}
            disabled={!st}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {t('results.statement.exportExcel')}
          </Button>
          <Button size="sm" className="h-8 gap-1.5 rounded-xl bg-slate-800 text-xs text-white hover:bg-slate-700" onClick={() => window.print()} disabled={!st}>
            <Printer className="h-3.5 w-3.5" />
            {t('results.statement.print')}
          </Button>
        </div>
      </div>

      {/* loading */}
      {st === undefined && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card py-14 text-sm text-muted-foreground card-soft">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('results.loading')}
        </div>
      )}

      {/* empty */}
      {st === null && (
        <div className="rounded-2xl border bg-card p-8 text-center card-soft">
          <FileCheck2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">{t('results.statement.noRecon')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('results.statement.noReconHint')}</p>
        </div>
      )}

      {/* the official form */}
      {st && (
        <div className="print-statement overflow-hidden rounded-2xl border bg-white text-slate-900 shadow-sm card-soft">
          <div className="mx-auto max-w-[860px] px-6 py-6" dir="rtl">
            {/* header */}
            <div className="mb-5 text-center">
              <h3 className="text-base font-extrabold tracking-tight">{st.projectName}</h3>
              <h2 className="mt-1 text-lg font-black underline decoration-1 underline-offset-4">صورت مغایرت بانکی حساب جاری</h2>
              <div className="mt-2 flex items-center justify-center gap-6 text-xs text-slate-600">
                <span>
                  در تاریخ: <b className="tabular-nums">{fmtDateJalali(st.bankAsOfDate ?? st.bookAsOfDate)}</b>
                </span>
                <span>
                  تاریخ تهیه گزارش: <b className="tabular-nums">{formatDate(st.generatedAt)}</b>
                </span>
              </div>
            </div>

            {/* balance block */}
            <table className="mb-6 w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <td className="w-[34%] border border-slate-300 bg-slate-100 px-3 py-2 font-bold">مانده طبق دفتر</td>
                  <td className="w-[16%] border border-slate-300 px-3 py-2 text-center font-bold tabular-nums">{st.bookClosingMinor !== null ? fmt(st.bookClosingMinor) : '—'}</td>
                  <td className="w-[34%] border border-slate-300 bg-slate-100 px-3 py-2 font-bold">مانده طبق بانک</td>
                  <td className="w-[16%] border border-slate-300 px-3 py-2 text-center font-bold tabular-nums">{st.bankClosingMinor !== null ? fmt(st.bankClosingMinor) : '—'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">اضافه می‌شود اقلام بستانکار بانک:</td>
                  <td className="border border-slate-300 px-3 py-2 text-center tabular-nums text-emerald-700">{fmt(st.totals.bankCreditsMinor)}</td>
                  <td className="border border-slate-300 px-3 py-2">اضافه می‌شود اقلام بدهکار دفتر:</td>
                  <td className="border border-slate-300 px-3 py-2 text-center tabular-nums text-emerald-700">{fmt(st.totals.bookDebitsMinor)}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">کسر می‌شود اقلام بدهکار بانک:</td>
                  <td className="border border-slate-300 px-3 py-2 text-center tabular-nums text-rose-700">{st.totals.bankDebitsMinor ? fmt(st.totals.bankDebitsMinor) : 0}</td>
                  <td className="border border-slate-300 px-3 py-2">کسر می‌شود اقلام بستانکار دفتر:</td>
                  <td className="border border-slate-300 px-3 py-2 text-center tabular-nums text-rose-700">{st.totals.bookCreditsMinor ? fmt(st.totals.bookCreditsMinor) : 0}</td>
                </tr>
                <tr className="bg-slate-100">
                  <td className="border border-slate-400 px-3 py-2 font-black">مانده واقعی</td>
                  <td className="border border-slate-400 px-3 py-2 text-center font-black tabular-nums">{fmt(st.trueBalanceFromBookMinor)}</td>
                  <td className="border border-slate-400 px-3 py-2 font-black">مانده واقعی</td>
                  <td className="border border-slate-400 px-3 py-2 text-center font-black tabular-nums">{fmt(st.trueBalanceFromBankMinor)}</td>
                </tr>
              </tbody>
            </table>

            {/* convergence */}
            <div className={`no-print mb-5 rounded-xl border p-3 text-xs ${st.converged ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
              {st.converged ? (
                <span className="font-bold">✓ {t('results.statement.converged')}</span>
              ) : (
                <div>
                  <p className="font-bold">
                    {t('results.statement.residual')}: <span className="tabular-nums">{fmt(st.residualMinor)}</span> {t('results.statement.rials')}
                  </p>
                  <p className="mt-1 leading-5 text-amber-700">{t('results.statement.residualHint')}</p>
                </div>
              )}
              {(st.bookBalanceSource === 'turnover' || st.bankBalanceSource === 'turnover') && (
                <p className="mt-1 text-[11px] text-slate-500">{t('results.statement.turnoverNote')}</p>
              )}
            </div>

            {/* open items */}
            <div className="space-y-6">
              <ItemsTable
                title="اقلام باز بانک"
                items={[...st.bankCreditsOpen, ...st.bankDebitsOpen]}
                depositLabel="واریز بانک"
                withdrawLabel="برداشت بانک"
                descLabel="شرح صورتحساب بانک"
                fmtAmount={fmt}
                fmtInt={(n) => formatNumber(n)}
                groupByMonth
              />
              <ItemsTable
                title="اقلام باز دفتر"
                items={[...st.bookDebitsOpen, ...st.bookCreditsOpen]}
                depositLabel="واریز"
                withdrawLabel="برداشت"
                descLabel="شرح دفتر"
                fmtAmount={fmt}
                fmtInt={(n) => formatNumber(n)}
                groupByMonth={false}
              />
            </div>

            {/* signature */}
            <div className="mt-8 flex justify-end">
              <div className="flex h-24 w-56 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-400">
                مهر و امضای صندوق
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
