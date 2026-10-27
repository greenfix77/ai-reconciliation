'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarDays,
  Cpu,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  Printer,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'
import { ReconciliationStats, ResultGroup } from '@/lib/types'
import { cn } from '@/lib/utils'

export type ReportListItem = {
  id: string
  projectId: string
  projectName: string
  status: 'completed'
  startedAt: string
  finishedAt: string | null
  providerName: string
  model: string
  stats: ReconciliationStats | null
}

export type ReportDetail = {
  project: { id: string; name: string }
  reconciliation: {
    id: string
    status: string
    startedAt: string
    finishedAt: string | null
    providerName: string
    model: string
    stats: ReconciliationStats | null
  }
  counts: Record<string, number>
  groups: ResultGroup[]
}

const GROUP_TYPES = [
  'exact',
  'ai_match',
  'one_to_many',
  'many_to_one',
  'amount_diff',
  'date_diff',
  'missing_a',
  'missing_b',
  'duplicate',
  'unmatched',
  'invalid',
] as const

const TYPE_CHIP: Record<string, string> = {
  exact: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  ai_match: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  one_to_many: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  many_to_one: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  amount_diff: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  date_diff: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  missing_a: 'bg-red-500/10 text-red-700 dark:text-red-400',
  missing_b: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  duplicate: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  unmatched: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
  invalid: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400',
}

function typeChipClass(type: string): string {
  return TYPE_CHIP[type] ?? 'bg-slate-500/10 text-slate-700 dark:text-slate-400'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .print-report, .print-report * { visibility: visible !important; }
  .print-report {
    display: block !important;
    position: absolute;
    inset-inline: 0;
    top: 0;
    background: #fff !important;
    color: #000 !important;
  }
}
`

export function ReportDetailDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, formatNumber, formatDate } = useI18n()
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [printReady, setPrintReady] = useState(false)

  useEffect(() => {
    if (!open || !projectId) {
      setDetail(null)
      setTypeFilter('all')
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const data = await apiFetchDetail(projectId)
        if (!cancelled) setDetail(data)
      } catch (err) {
        if (!cancelled) toast.error(t('reports.loadFailed'), { description: (err as Error).message })
        if (!cancelled) onOpenChange(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectId, onOpenChange, t])

  const filteredGroups = useMemo(() => {
    if (!detail) return []
    if (typeFilter === 'all') return detail.groups
    return detail.groups.filter((g) => g.type === typeFilter)
  }, [detail, typeFilter])

  const stats = detail?.reconciliation.stats ?? null
  const discrepancyCount = stats
    ? (stats.unmatched ?? 0) + (stats.amountDiff ?? 0) + (stats.dateDiff ?? 0) + (stats.missingA ?? 0) + (stats.missingB ?? 0)
    : 0

  const exportUrl = (format: 'xlsx' | 'csv') => {
    const type = typeFilter !== 'all' ? `&type=${typeFilter}` : ''
    return `/api/reports/${projectId}?format=${format}${type}`
  }

  const doPrint = () => {
    setPrintReady(true)
    setTimeout(() => {
      window.print()
      setPrintReady(false)
    }, 80)
  }

  const counts = detail?.counts ?? {}

  return (
    <>
      {/* Injected print stylesheet — scoped to @media print only */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {t('reports.detailTitle')}
            </DialogTitle>
            <DialogDescription>{detail?.project.name ?? '…'}</DialogDescription>
          </DialogHeader>

          {loading || !detail ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <h3 className="text-sm font-bold">{t('reports.summary')}</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <SummaryTile label={t('reports.stat.groups')} value={formatNumber(stats?.totalGroups ?? 0)} />
                  <SummaryTile
                    label={t('reports.stat.exact')}
                    value={formatNumber(stats?.exactMatched ?? 0)}
                    valueClass="text-emerald-600 dark:text-emerald-400"
                  />
                  <SummaryTile
                    label={t('reports.stat.aiMatch')}
                    value={formatNumber(stats?.aiMatched ?? 0)}
                    valueClass="text-violet-600 dark:text-violet-400"
                  />
                  <SummaryTile
                    label={t('reports.stat.rate')}
                    value={`${formatNumber(stats?.matchRatePct ?? 0)}%`}
                    valueClass="text-blue-600 dark:text-blue-400"
                  />
                  <SummaryTile
                    label={t('reports.stat.disc')}
                    value={formatNumber(discrepancyCount)}
                    valueClass="text-red-600 dark:text-red-400"
                  />
                  <SummaryTile
                    label={t('reports.amountDiffTotal')}
                    value={formatNumber((stats?.amountDiffMinorTotal ?? 0) / 100)}
                    valueClass="text-amber-600 dark:text-amber-400"
                  />
                  <SummaryTile label={t('reports.provider')} value={detail.reconciliation.providerName} />
                  <SummaryTile label={t('reports.model')} value={detail.reconciliation.model} ltr />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {t('common.date')}: {formatDate(detail.reconciliation.startedAt)}
                  </span>
                  {detail.reconciliation.finishedAt && (
                    <span className="inline-flex items-center gap-1">
                      <Cpu className="h-3 w-3" />
                      {t('reports.finishedAt')}: {formatDate(detail.reconciliation.finishedAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Per-type counts */}
              <div>
                <h3 className="text-sm font-bold">{t('reports.byType')}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {GROUP_TYPES.filter((gt) => (counts[gt] ?? 0) > 0).length === 0 && (
                    <p className="text-xs text-muted-foreground">{t('common.empty')}</p>
                  )}
                  {GROUP_TYPES.filter((gt) => (counts[gt] ?? 0) > 0).map((gt) => (
                    <Badge key={gt} variant="secondary" className={cn('gap-1 border-transparent', typeChipClass(gt))}>
                      {t(`reports.type.${gt}`)}: {formatNumber(counts[gt] ?? 0)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Type filter + group rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    {t('reports.items', { count: formatNumber(filteredGroups.reduce((acc, g) => acc + g.items.length, 0)) })}
                  </h3>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-8 w-44 text-xs" aria-label={t('reports.byType')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('reports.typeAll')}</SelectItem>
                      {GROUP_TYPES.map((gt) => (
                        <SelectItem key={gt} value={gt}>
                          {t(`reports.type.${gt}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr>
                        <th className="p-2 text-start font-medium">{t('common.status')}</th>
                        <th className="p-2 text-start font-medium">{t('common.date')}</th>
                        <th className="p-2 text-start font-medium">{t('common.description')}</th>
                        <th className="p-2 text-start font-medium">{t('common.amount')}</th>
                        <th className="p-2 text-start font-medium">{t('reports.project')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroups.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-muted-foreground">{t('common.empty')}</td>
                        </tr>
                      )}
                      {filteredGroups.flatMap((g) =>
                        g.items.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="p-2">
                              <Badge variant="secondary" className={cn('border-transparent text-[10px]', typeChipClass(g.type))}>
                                {t(`reports.type.${g.type}`)}
                              </Badge>
                            </td>
                            <td className="p-2 whitespace-nowrap text-muted-foreground">
                              {item.transaction.date ? formatDate(item.transaction.date) : '—'}
                            </td>
                            <td className="max-w-40 truncate p-2" title={item.transaction.description ?? ''}>
                              {item.transaction.description || '—'}
                            </td>
                            <td className="p-2 whitespace-nowrap font-mono" dir="ltr">
                              {formatNumber(item.transaction.amountMinor / 100)}
                            </td>
                            <td className="p-2 text-muted-foreground"><bdi dir="ltr">{item.file.originalName}</bdi></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Export actions */}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <a href={exportUrl('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4" />
                    {t('reports.exportExcel')}
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={exportUrl('csv')}>
                    <FileText className="h-4 w-4" />
                    {t('reports.exportCsv')}
                  </a>
                </Button>
                <Button size="sm" variant="outline" onClick={doPrint} className="gap-1.5">
                  <Printer className="h-4 w-4" />
                  {t('reports.print')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Printable area (visible only when printing) */}
      {printReady && detail && (
        <div className="print-report hidden" dir="rtl">
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            {t('reports.printTitle')} — {escapeHtml(detail.project.name)}
          </h1>
          <p style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>
            {t('common.date')}: {formatDate(detail.reconciliation.startedAt)} · {t('reports.provider')}: {escapeHtml(detail.reconciliation.providerName)} ·{' '}
            {t('reports.model')}: {escapeHtml(detail.reconciliation.model)}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 }} border={1}>
            <tbody>
              <tr>
                <td style={{ padding: 6, fontWeight: 600 }}>{t('reports.stat.groups')}</td>
                <td style={{ padding: 6 }}>{formatNumber(stats?.totalGroups ?? 0)}</td>
                <td style={{ padding: 6, fontWeight: 600 }}>{t('reports.stat.exact')}</td>
                <td style={{ padding: 6 }}>{formatNumber(stats?.exactMatched ?? 0)}</td>
              </tr>
              <tr>
                <td style={{ padding: 6, fontWeight: 600 }}>{t('reports.stat.aiMatch')}</td>
                <td style={{ padding: 6 }}>{formatNumber(stats?.aiMatched ?? 0)}</td>
                <td style={{ padding: 6, fontWeight: 600 }}>{t('reports.stat.rate')}</td>
                <td style={{ padding: 6 }}>{formatNumber(stats?.matchRatePct ?? 0)}%</td>
              </tr>
              <tr>
                <td style={{ padding: 6, fontWeight: 600 }}>{t('reports.stat.disc')}</td>
                <td style={{ padding: 6 }}>{formatNumber(discrepancyCount)}</td>
                <td style={{ padding: 6, fontWeight: 600 }}>{t('reports.amountDiffTotal')}</td>
                <td style={{ padding: 6 }}>{formatNumber((stats?.amountDiffMinorTotal ?? 0) / 100)}</td>
              </tr>
            </tbody>
          </table>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{t('reports.byType')}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }} border={1}>
            <thead>
              <tr>
                <th style={{ padding: 6, textAlign: 'start' }}>{t('common.status')}</th>
                <th style={{ padding: 6, textAlign: 'start' }}>{t('reports.stat.groups')}</th>
              </tr>
            </thead>
            <tbody>
              {GROUP_TYPES.filter((gt) => (counts[gt] ?? 0) > 0).map((gt) => (
                <tr key={gt}>
                  <td style={{ padding: 6 }}>{t(`reports.type.${gt}`)}</td>
                  <td style={{ padding: 6 }}>{formatNumber(counts[gt] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 10, color: '#777', marginTop: 12 }}>
            {t('reports.generatedAt')}: {formatDate(new Date().toISOString())} · {t('common.appName')}
          </p>
        </div>
      )}
    </>
  )
}

function SummaryTile({ label, value, valueClass, ltr }: { label: string; value: string; valueClass?: string; ltr?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 truncate text-sm font-bold', valueClass)} dir={ltr ? 'ltr' : undefined} title={value}>
        {value}
      </div>
    </div>
  )
}

async function apiFetchDetail(projectId: string): Promise<ReportDetail> {
  const res = await fetch(`/api/reports/${projectId}`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
  })
  const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: ReportDetail; error?: string }
  if (!res.ok || payload.ok === false || !payload.data) {
    throw new Error(payload.error || `HTTP ${res.status}`)
  }
  return payload.data
}
