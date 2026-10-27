'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileBarChart2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportCard } from '@/components/reports/report-card'
import { ReportDetailDialog, ReportListItem } from '@/components/reports/report-detail-dialog'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'

export function ReportsView() {
  const { t, formatNumber } = useI18n()
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ reports: ReportListItem[] }>('/api/reports')
      setReports(data.reports ?? [])
    } catch {
      // silent — empty state is shown
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of reports) seen.set(r.projectId, r.projectName)
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [reports])

  const filtered = useMemo(
    () => (projectFilter === 'all' ? reports : reports.filter((r) => r.projectId === projectFilter)),
    [reports, projectFilter]
  )

  const openDetail = (projectId: string) => {
    setDetailProjectId(projectId)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight">{t('reports.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-56" aria-label={t('reports.filterPlaceholder')}>
            <SelectValue placeholder={t('reports.filterAll')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('reports.filterAll')}</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">{t('reports.count', { count: formatNumber(filtered.length) })}</p>
      )}

      {/* List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-soft flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <FileBarChart2 className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-bold">{t('reports.emptyTitle')}</h3>
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">{t('reports.emptyDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((r) => (
            <ReportCard key={r.id} report={r} onView={openDetail} />
          ))}
        </div>
      )}

      <ReportDetailDialog projectId={detailProjectId} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
