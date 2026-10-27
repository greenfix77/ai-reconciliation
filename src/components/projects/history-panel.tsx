'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { History, Inbox, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { ReconciliationStats } from '@/lib/types'
import { matchRateTone, RunStatusBadge } from './helpers'

export type HistoryRow = {
  id: string
  status: string
  startedAt: string
  finishedAt: string | null
  providerName: string
  model: string
  stats: ReconciliationStats | null
}

type Props = {
  projectId: string
  /** bumped by parent (e.g. 'recon:refresh' event) to refetch */
  refreshToken: number
}

/** Reconciliation run history for the project. */
export function HistoryPanel({ projectId, refreshToken }: Props) {
  const { t, formatNumber, formatDate } = useI18n()
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ reconciliations: HistoryRow[] }>(`/api/projects/${projectId}/reconciliations`)
      setRows(data?.reconciliations ?? [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load, refreshToken])

  const openResults = (reconciliationId: string) => {
    const event = new CustomEvent('recon:open-results', {
      detail: { reconciliationId, projectId },
      cancelable: true,
    })
    const handled = !window.dispatchEvent(event)
    if (!handled) {
      toast.info(t('projects.resultsNotReady'))
    }
  }

  if (loading && rows === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed py-10 text-center">
        <Inbox className="mb-1 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">{t('projects.historyEmpty')}</p>
        <p className="text-xs text-muted-foreground">{t('projects.historyEmptyDesc')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card card-soft">
      <div className="max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-32">
                <span className="inline-flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  {t('projects.startedAt')}
                </span>
              </TableHead>
              <TableHead>{t('projects.model')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead className="text-center">{t('projects.matchRatePct')}</TableHead>
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const rate = r.stats?.matchRatePct ?? null
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(r.startedAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="max-w-40 truncate text-sm font-medium"><bdi dir="ltr">{r.model || r.providerName}</bdi></span>
                      <span className="text-xs text-muted-foreground"><bdi>{r.providerName}</bdi></span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    {rate !== null ? (
                      <span className={`text-sm font-semibold tabular-nums ${matchRateTone(rate)}`}>
                        {formatNumber(rate, { maximumFractionDigits: 1 })}%
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="outline" size="sm" disabled={r.status !== 'completed'} onClick={() => openResults(r.id)}>
                      {t('projects.viewResults')}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
