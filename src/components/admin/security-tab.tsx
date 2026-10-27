'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Fingerprint, ScrollText, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AdminErrorState, AdminStats, AuditLogRow, PagedList, TablePagination } from './shared'

const PAGE_SIZE = 30

/** امنیت — security chips + platform-wide audit log viewer. */
export function SecurityTab({ active, refreshSignal, stats }: { active: boolean; refreshSignal: number; stats: AdminStats | null }) {
  const { t, formatNumber, formatDate } = useI18n()

  const [data, setData] = useState<PagedList<AuditLogRow> | null>(null)
  const [actions, setActions] = useState<{ action: string; count: number }[]>([])
  const [error, setError] = useState(false)

  const [action, setAction] = useState('all')
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (action !== 'all') params.set('action', action)
    if (dq.trim()) params.set('query', dq.trim())
    try {
      const res = await apiFetch<{ logs: AuditLogRow[]; actions: { action: string; count: number }[]; total: number; page: number; pages: number }>(`/api/admin/audit?${params.toString()}`)
      setData({ rows: res.logs ?? [], total: res.total, page: res.page, pages: res.pages })
      setActions(res.actions ?? [])
      setError(false)
    } catch (e) {
      const s = (e as { status?: number }).status
      if (s === 401) return
      setError(true)
      setData((prev) => prev ?? { rows: [], total: 0, page: 1, pages: 1 })
    }
  }, [action, dq, page])

  // Fetch on first activation and whenever filters/page change while active.
  // Fetches are deferred out of the effect body (no sync setState cascades), and the
  // last-scheduled load identity is tracked so tab re-activation does NOT refetch (per-tab cache).
  const scheduledLoadRef = useRef<typeof load | null>(null)
  useEffect(() => {
    if (!active || scheduledLoadRef.current === load) return
    scheduledLoadRef.current = load
    const h = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(h)
  }, [active, load])

  const seenSignalRef = useRef(refreshSignal)
  useEffect(() => {
    if (refreshSignal === seenSignalRef.current) return
    seenSignalRef.current = refreshSignal
    if (active && scheduledLoadRef.current !== null) {
      const h = setTimeout(() => { void load() }, 0)
      return () => clearTimeout(h)
    }
  }, [refreshSignal, active, load])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDq(q)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const rows = data?.rows ?? []
  const loading = data === null && !error

  return (
    <div className="flex flex-col gap-4">
      {/* Security chips (shared stats) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SecurityChip
          icon={ShieldAlert}
          label={t('admin.sec.failed7')}
          value={stats ? formatNumber(stats.kpis.failedLogins7d) : '—'}
          tone={stats && stats.kpis.failedLogins7d > 10 ? 'danger' : 'default'}
        />
        <SecurityChip icon={Fingerprint} label={t('admin.sec.blocked7')} value={stats ? formatNumber(stats.kpis.blockedLogins7d) : '—'} tone="default" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-56" aria-label={t('admin.sec.filterAction')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.sec.allActions')}</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a.action} value={a.action}>
                <span className="flex items-center justify-between gap-2">
                  <span dir="ltr" className="font-mono text-xs">{a.action}</span>
                  <span className="tnum text-[10px] text-muted-foreground">{formatNumber(a.count)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 sm:max-w-72">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.sec.searchIp')} aria-label={t('admin.sec.searchIp')} />
        </div>
      </div>

      {/* Audit table */}
      {loading ? (
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : error && data === null ? (
        <AdminErrorState onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card/50 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <ScrollText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">{t('common.empty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card card-soft">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="text-xs text-muted-foreground">
                  <th className="p-3 text-start font-medium">{t('admin.sec.col.time')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.sec.col.action')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.sec.col.user')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.sec.col.entity')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.sec.col.ip')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.sec.col.ua')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-t transition-colors hover:bg-muted/40">
                    <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{formatDate(l.createdAt)}</td>
                    <td className="p-3">
                      <Badge variant="secondary" dir="ltr" className={cn('border-transparent font-mono text-[10px]', actionTone(l.action))}>
                        {l.action}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {l.user ? (
                        <div>
                          <div className="text-[13px] font-medium">{l.user.name}</div>
                          <div dir="ltr" className="text-xs text-muted-foreground">{l.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('admin.sec.system')}</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{l.entityType ? <bdi dir="ltr">{l.entityType}</bdi> : '—'}</td>
                    <td dir="ltr" className="p-3 font-mono text-xs text-muted-foreground">{l.ip || '—'}</td>
                    <td className="max-w-52 p-3">
                      <div className="truncate text-[11px] text-muted-foreground" title={l.userAgent ?? ''} dir="ltr">{l.userAgent || '—'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && <TablePagination page={data.page} pages={data.pages} total={data.total} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(data.pages, p + 1))} />}
        </div>
      )}
    </div>
  )
}

function actionTone(action: string): string {
  if (action.includes('failed') || action.includes('blocked') || action.includes('error')) return 'bg-red-500/10 text-red-700 dark:text-red-400'
  if (action.includes('delete')) return 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
  if (action.includes('login') || action.includes('logout')) return 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
  if (action.includes('ai_')) return 'bg-violet-500/10 text-violet-700 dark:text-violet-400'
  if (action.includes('create') || action.includes('add')) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  return 'bg-slate-500/10 text-slate-700 dark:text-slate-400'
}

function SecurityChip({ icon: Icon, label, value, tone }: { icon: typeof ShieldAlert; label: string; value: string; tone: 'default' | 'danger' }) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-2xl border p-4 card-soft',
      tone === 'danger'
        ? 'border-red-200/70 bg-gradient-to-b from-red-50/90 to-transparent dark:border-red-500/20 dark:from-red-500/[0.09]'
        : 'border-border bg-card'
    )}>
      <span className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        tone === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
      )}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
        <div className="text-xl font-extrabold leading-7 tnum">{value}</div>
      </div>
    </div>
  )
}
