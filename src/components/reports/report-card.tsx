'use client'

import { BarChart3, Bot, CalendarDays, Eye, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { ReportListItem } from '@/components/reports/report-detail-dialog'
import { cn } from '@/lib/utils'

export function ReportCard({ report, onView }: { report: ReportListItem; onView: (projectId: string) => void }) {
  const { t, formatNumber, formatDate } = useI18n()
  const stats = report.stats

  const discrepancy =
    (stats?.unmatched ?? 0) + (stats?.amountDiff ?? 0) + (stats?.dateDiff ?? 0) + (stats?.missingA ?? 0) + (stats?.missingB ?? 0)

  return (
    <article className="card-soft flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold" title={report.projectName}>
              {report.projectName}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {formatDate(report.startedAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Bot className="h-3 w-3" />
                <span dir="ltr" className="font-mono">{report.model}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {report.providerName}
              </span>
            </div>
          </div>
        </div>
        <Button size="sm" onClick={() => onView(report.projectId)} className="h-8 shrink-0 gap-1.5 bg-blue-600 hover:bg-blue-700">
          <Eye className="h-3.5 w-3.5" />
          {t('reports.view')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t pt-3">
        <Badge variant="secondary" className="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          {t('reports.stat.exact')}: {formatNumber(stats?.exactMatched ?? 0)}
        </Badge>
        <Badge variant="secondary" className="border-transparent bg-violet-500/10 text-violet-700 dark:text-violet-400">
          {t('reports.stat.aiMatch')}: {formatNumber(stats?.aiMatched ?? 0)}
        </Badge>
        <Badge variant="secondary" className="border-transparent bg-red-500/10 text-red-700 dark:text-red-400">
          {t('reports.stat.disc')}: {formatNumber(discrepancy)}
        </Badge>
        <Badge
          variant="secondary"
          className={cn(
            'border-transparent',
            (stats?.matchRatePct ?? 0) >= 80
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : (stats?.matchRatePct ?? 0) >= 50
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : 'bg-red-500/10 text-red-700 dark:text-red-400'
          )}
        >
          {t('reports.stat.rate')}: {formatNumber(stats?.matchRatePct ?? 0)}%
        </Badge>
      </div>
    </article>
  )
}
