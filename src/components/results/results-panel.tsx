'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  BadgeCheck,
  BrainCircuit,
  Check,
  CircleAlert,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  SquareCheckBig,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiFetch } from '@/lib/api-client'
import { formatAmount } from '@/lib/money'
import { useI18n } from '@/lib/i18n'
import { JobItem, ResultsResponse, ResultGroup, ResultGroupItem } from '@/lib/types'
import { StatementView } from '@/components/results/statement-view'
import { cn } from '@/lib/utils'

// ---------- small presentational helpers ----------

function txSummary(item: ResultGroupItem | undefined, extraCount: number) {
  if (!item) return null
  return {
    description: item.transaction.description,
    date: item.transaction.date,
    reference: item.transaction.reference,
    amountMinor: item.transaction.amountMinor,
    extraCount,
  }
}

function TxCell({ item, extraCount }: { item: ResultGroupItem | undefined; extraCount: number }) {
  const { t, formatDate, locale } = useI18n()
  const s = txSummary(item, extraCount)
  if (!s) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex min-w-40 flex-col gap-0.5 py-1">
      <span className="max-w-56 truncate text-xs font-medium" title={s.description ?? undefined}>
        {s.description || t('results.table.noDescription')}
      </span>
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span dir="ltr">{s.date ? formatDate(s.date) : '—'}</span>
        <span className="font-medium tabular-nums" dir="ltr">
          {formatAmount(s.amountMinor, locale)}
        </span>
        {s.extraCount > 0 && <span className="rounded bg-muted px-1">+{s.extraCount}</span>}
      </span>
    </div>
  )
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
    case 'rejected':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900'
    case 'resolved':
      return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900'
    default:
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900'
  }
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const key = `results.status.${status}`
  return <Badge variant="outline" className={cn('text-[11px]', statusBadgeClass(status))}>{t(key)}</Badge>
}

function ConfidenceCell({ value }: { value: number }) {
  const { t, formatNumber } = useI18n()
  const pct = Math.round(value * 100)
  const level = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low'
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  const label = t(`results.confidence.${level}`)
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex min-w-20 flex-col gap-1 py-1" aria-label={label}>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">{formatNumber(pct)}٪</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-44 text-xs">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 card-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tone)}>{icon}</span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums" dir="ltr">
        {value}
      </p>
    </div>
  )
}

function JobProgress({ job }: { job: JobItem }) {
  const { t, formatNumber } = useI18n()
  const pct = job.total > 0 ? Math.min(100, Math.round((job.progress / job.total) * 100)) : job.status === 'completed' ? 100 : 0
  const stageKey = job.stage && job.stage.startsWith('stage.') ? `results.stage.${job.stage}` : null
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-center justify-between text-xs font-medium text-amber-700 dark:text-amber-300">
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {job.status === 'queued' ? t('results.jobs.queued') : t('results.jobs.running')}
          {stageKey && <span className="text-muted-foreground">· {t(stageKey)}</span>}
        </span>
        <span className="tabular-nums">{formatNumber(pct)}٪</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  )
}

// ---------- main panel ----------

const TAB_TYPES: Record<string, string[]> = {
  all: [],
  exact: ['exact'],
  ai: ['ai_match'],
  oneToMany: ['one_to_many'],
  manyToOne: ['many_to_one'],
  amountDiff: ['amount_diff'],
  dateDiff: ['date_diff'],
  duplicate: ['duplicate'],
  missingA: ['missing_a'],
  missingB: ['missing_b'],
  unmatched: ['unmatched', 'invalid'],
}

const APPROVABLE = ['ai_match', 'one_to_many', 'many_to_one', 'amount_diff', 'date_diff']

function tabKeyForType(type: string): string {
  for (const [key, types] of Object.entries(TAB_TYPES)) {
    if (types.includes(type)) return key
  }
  return 'all'
}

export function ResultsPanel({ projectId }: { projectId: string }) {
  const { t, locale, formatDate } = useI18n()
  const [data, setData] = useState<ResultsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [busyAction, setBusyAction] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!projectId) return
      if (!silent) setLoading(true)
      try {
        const res = await apiFetch<ResultsResponse>(`/api/projects/${projectId}/results`)
        setData(res)
        setError(null)
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : 'error')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    setData(null)
    setTab('all')
    setSelected(new Set())
    setDetailId(null)
    void load()
  }, [projectId, load])

  // poll every 4s while any job is active
  const hasActiveJobs = (data?.jobs?.length ?? 0) > 0
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (hasActiveJobs && projectId) {
      pollRef.current = setInterval(() => void load(true), 4000)
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [hasActiveJobs, projectId, load])

  const recon = data?.reconciliation ?? null
  const stats = recon?.stats ?? null
  const groups = useMemo(() => data?.groups ?? [], [data])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: groups.length }
    for (const g of groups) {
      for (const [tabKey, types] of Object.entries(TAB_TYPES)) {
        if (types.includes(g.type)) c[tabKey] = (c[tabKey] ?? 0) + 1
      }
    }
    return c
  }, [groups])

  const visibleGroups = useMemo(() => {
    const types = TAB_TYPES[tab] ?? []
    if (types.length === 0) return groups
    return groups.filter((g) => types.includes(g.type))
  }, [groups, tab])

  const detail = detailId ? groups.find((g) => g.id === detailId) ?? null : null
  const detailA = detail?.items.filter((i) => i.side === 'A') ?? []
  const detailB = detail?.items.filter((i) => i.side === 'B') ?? []

  const patchGroup = useCallback(
    async (groupId: string, body: { action: string; note?: string }, optimistic: Partial<ResultGroup>, successMsg: string) => {
      const prev = groups.find((g) => g.id === groupId)
      // optimistic
      setData((d) => (d ? { ...d, groups: d.groups.map((g) => (g.id === groupId ? { ...g, ...optimistic } : g)) } : d))
      try {
        await apiFetch(`/api/matches/${groupId}`, { method: 'PATCH', json: body })
        toast.success(successMsg)
      } catch (err) {
        // rollback
        if (prev) setData((d) => (d ? { ...d, groups: d.groups.map((g) => (g.id === groupId ? prev : g)) } : d))
        toast.error(t('results.toast.error') + (err instanceof Error ? ` — ${err.message}` : ''))
      }
    },
    [groups, t]
  )

  const handleApprove = async (g: ResultGroup) => {
    if (g.type === 'exact') {
      toast.info(t('results.detail.exactApproved'))
      return
    }
    if (!APPROVABLE.includes(g.type)) {
      toast.info(t('results.detail.notApprovable'))
      return
    }
    await patchGroup(g.id, { action: 'approve' }, { status: 'approved', decidedBy: 'user' }, t('results.toast.approved'))
  }

  const handleReject = async (g: ResultGroup) => {
    await patchGroup(g.id, { action: 'reject' }, { status: 'rejected', decidedBy: 'user' }, t('results.toast.rejected'))
  }

  const handleResolve = async (g: ResultGroup) => {
    await patchGroup(g.id, { action: 'resolve' }, { status: 'resolved', decidedBy: 'user' }, t('results.toast.resolved'))
  }

  const handleReopen = async (g: ResultGroup) => {
    await patchGroup(g.id, { action: 'reopen' }, { status: 'pending' }, t('results.toast.reopened'))
  }

  const handleSaveNote = async (g: ResultGroup) => {
    if (!noteDraft.trim()) return
    setBusyAction(true)
    await patchGroup(g.id, { action: 'note', note: noteDraft.trim().slice(0, 500) }, { userNote: noteDraft.trim().slice(0, 500) }, t('results.toast.note'))
    setNoteEditing(false)
    setBusyAction(false)
  }

  const handleBulkApprove = async () => {
    const ids = groups.filter((g) => selected.has(g.id) && APPROVABLE.includes(g.type) && g.status !== 'approved').map((g) => g.id)
    if (ids.length === 0) return
    setBulkBusy(true)
    let ok = 0
    for (const id of ids) {
      try {
        await apiFetch(`/api/matches/${id}`, { method: 'PATCH', json: { action: 'approve' } })
        ok += 1
      } catch {}
    }
    if (ok > 0) {
      setData((d) => (d ? { ...d, groups: d.groups.map((g) => (ids.includes(g.id) ? { ...g, status: 'approved', decidedBy: 'user' } : g)) } : d))
      toast.success(t('results.toast.bulkApproved', { count: ok }))
    } else {
      toast.error(t('results.toast.error'))
    }
    setSelected(new Set())
    setBulkBusy(false)
  }

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const openDetail = (g: ResultGroup) => {
    setDetailId(g.id)
    setNoteDraft(g.userNote ?? '')
    setNoteEditing(false)
  }

  // ---------- render ----------

  if (!projectId) return null

  return (
    <div className="flex flex-col gap-4">
      {/* header + project-agnostic toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {t('results.title')}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('results.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t('results.refresh')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={() => {
              window.location.href = `/api/reports/${projectId}?format=csv`
            }}
          >
            <Download className="h-3.5 w-3.5" />
            {t('results.export.csv')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={() => {
              window.location.href = `/api/reports/${projectId}?format=xlsx`
            }}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {t('results.export.excel')}
          </Button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card py-14 text-sm text-muted-foreground card-soft">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('results.loading')}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {data && !recon && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center card-soft">
          <Sparkles className="h-8 w-8 text-violet-500/70" />
          <p className="text-sm font-medium">{t('results.empty')}</p>
          <p className="text-xs text-muted-foreground">{t('results.emptyHint')}</p>
        </div>
      )}

      {recon && (
        <>
          {/* active job progress */}
          {(data?.jobs ?? []).filter((j) => j.type === 'reconcile').map((j) => (
            <JobProgress key={j.id} job={j} />
          ))}

          {/* stats cards */}
          {stats && (
            <div className="no-print grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label={t('results.stats.exact')}
                value={new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(stats.exactMatched)}
                icon={<Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                tone="bg-emerald-100 dark:bg-emerald-950/60"
              />
              <StatCard
                label={t('results.stats.ai')}
                value={new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(stats.aiMatched + stats.oneToMany + stats.manyToOne)}
                icon={<BrainCircuit className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />}
                tone="bg-violet-100 dark:bg-violet-950/60"
              />
              <StatCard
                label={t('results.stats.discrepancies')}
                value={new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(stats.amountDiff + stats.dateDiff + stats.missingA + stats.missingB + stats.unmatched + stats.duplicates)}
                icon={<CircleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                tone="bg-amber-100 dark:bg-amber-950/60"
              />
              <StatCard
                label={t('results.stats.matchRate')}
                value={`${new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(stats.matchRatePct)}٪`}
                icon={<BadgeCheck className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />}
                tone="bg-sky-100 dark:bg-sky-950/60"
              />
            </div>
          )}

          {/* meta line */}
          <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              {t('results.stats.provider')}: <span className="font-medium text-foreground/80"><bdi>{recon.providerName}</bdi> · <bdi dir="ltr">{recon.model}</bdi></span>
            </span>
            <span dir="ltr">
              {formatDate(recon.startedAt)} {recon.finishedAt ? `→ ${formatDate(recon.finishedAt)}` : ''}
            </span>
            <span>
              {t('results.stats.totalGroups')}: {new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(stats?.totalGroups ?? groups.length)}
            </span>
          </div>

          {/* tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <ScrollArea className="no-print w-full whitespace-nowrap">
              <TabsList className="inline-flex h-9 w-max items-center gap-1 rounded-xl bg-muted/70 p-1">
                <TabsTrigger value="statement" className="gap-1.5 rounded-lg px-2.5 py-1 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <FileCheck2 className="h-3.5 w-3.5 text-slate-500" />
                  {t('results.statement.tab')}
                </TabsTrigger>
                {Object.keys(TAB_TYPES).map((key) => (
                  <TabsTrigger key={key} value={key} className="rounded-lg px-2.5 py-1 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    {t(`results.tab.${key}`)}
                    <span className="ms-1 rounded bg-muted px-1 text-[10px] tabular-nums text-muted-foreground">{counts[key] ?? 0}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Tabs>

          {/* statement view (صورت مغایرت بانکی) */}
          {tab === 'statement' && <StatementView projectId={projectId} />}

          {tab !== 'statement' && (
          <>
          {/* bulk bar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {t('common.selected')}: {selected.size}
              </span>
              <Button size="sm" className="h-7 gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600" onClick={() => void handleBulkApprove()} disabled={bulkBusy}>
                {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SquareCheckBig className="h-3.5 w-3.5" />}
                {t('results.bulk.approveSelected')}
              </Button>
            </div>
          )}

          {/* table */}
          <div className="overflow-hidden rounded-2xl border bg-card card-soft">
            <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-9 ps-3">
                      <Checkbox
                        aria-label={t('results.bulk.approveSelected')}
                        checked={visibleGroups.length > 0 && visibleGroups.every((g) => selected.has(g.id))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelected(new Set(visibleGroups.filter((g) => APPROVABLE.includes(g.type)).map((g) => g.id)))
                          } else setSelected(new Set())
                        }}
                      />
                    </TableHead>
                    <TableHead className="min-w-44">{t('results.table.sideA')}</TableHead>
                    <TableHead className="min-w-44">{t('results.table.sideB')}</TableHead>
                    <TableHead className="min-w-28">{t('results.table.amountDiff')}</TableHead>
                    <TableHead className="min-w-16">{t('results.table.dateDiff')}</TableHead>
                    <TableHead className="min-w-16">{t('results.table.similarity')}</TableHead>
                    <TableHead className="min-w-24">{t('results.table.confidence')}</TableHead>
                    <TableHead className="min-w-20">{t('results.table.status')}</TableHead>
                    <TableHead className="w-12 pe-3 text-center">{t('results.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleGroups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                        {t('common.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleGroups.map((g) => {
                    const aItems = g.items.filter((i) => i.side === 'A')
                    const bItems = g.items.filter((i) => i.side === 'B')
                    const diffAbs = Math.abs(g.amountDiffMinor)
                    return (
                      <TableRow key={g.id} className="cursor-pointer" onClick={() => openDetail(g)}>
                        <TableCell className="ps-3" onClick={(e) => e.stopPropagation()}>
                          {APPROVABLE.includes(g.type) ? (
                            <Checkbox checked={selected.has(g.id)} onCheckedChange={(c) => toggleSelect(g.id, c === true)} aria-label={t('results.detail.approve')} />
                          ) : (
                            <span className="block w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          <TxCell item={aItems[0]} extraCount={Math.max(0, aItems.length - 1)} />
                        </TableCell>
                        <TableCell>
                          <TxCell item={bItems[0]} extraCount={Math.max(0, bItems.length - 1)} />
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-semibold tabular-nums', diffAbs === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')} dir="ltr">
                            {formatAmount(g.amountDiffMinor, locale)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs tabular-nums text-muted-foreground">{g.dateDiffDays !== null ? t('results.days', { n: g.dateDiffDays }) : '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs tabular-nums text-muted-foreground">{Math.round(g.descSimilarity * 100)}٪</span>
                        </TableCell>
                        <TableCell>
                          <ConfidenceCell value={g.confidence} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={g.status} />
                        </TableCell>
                        <TableCell className="pe-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openDetail(g)} aria-label={t('common.detail')}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          </>
          )}
        </>
      )}

      {/* ---------- detail dialog ---------- */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl sm:max-w-3xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  {t('results.detail.title')}
                  <Badge variant="outline" className="ms-1 rounded-lg text-[11px]">
                    {t(`results.tab.${tabKeyForType(detail.type)}`)}
                  </Badge>
                  <StatusBadge status={detail.status} />
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {t('results.detail.decidedBy')}: {detail.decidedBy === 'user' ? t('results.detail.decidedByUser') : t('results.detail.decidedByAi')}
                  {' · '}
                  {t('results.table.confidence')}: {Math.round(detail.confidence * 100)}٪
                </DialogDescription>
              </DialogHeader>

              {detail.validationStatus === 'invalid' && (
                <Alert variant="destructive" className="rounded-xl">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription className="text-xs">{t('results.validation.invalidAlert')}</AlertDescription>
                </Alert>
              )}
              {detail.validationStatus === 'warning' && (
                <Alert className="rounded-xl border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertDescription className="text-xs">{t('results.validation.warningAlert')}</AlertDescription>
                </Alert>
              )}

              {/* side-by-side transactions */}
              <div className="grid gap-3 sm:grid-cols-2">
                {[detailA, detailB].map((items, sideIdx) => (
                  <div key={sideIdx} className="rounded-xl border bg-muted/30 p-3">
                    <p className="mb-2 text-[11px] font-semibold text-muted-foreground">{sideIdx === 0 ? t('results.table.sideA') : t('results.table.sideB')}</p>
                    <div className="flex max-h-52 flex-col gap-2 overflow-y-auto">
                      {items.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                      {items.map((item) => (
                        <div key={item.id} className="rounded-lg border bg-card p-2.5">
                          <p className="text-xs font-medium leading-5">{item.transaction.description || t('results.table.noDescription')}</p>
                          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <span>{t('common.amount')}: <b className="text-foreground tabular-nums" dir="ltr">{formatAmount(item.transaction.amountMinor, locale)}</b></span>
                            <span>{t('common.date')}: {item.transaction.date ? formatDate(item.transaction.date) : '—'}</span>
                            <span className="col-span-2 truncate">{t('results.detail.reference')}: <span dir="ltr">{item.transaction.reference ?? '—'}</span></span>
                            <span className="col-span-2 truncate">{t('results.detail.file')}: <bdi dir="ltr">{item.file.originalName || '—'}</bdi> · {t('results.detail.row')} {item.transaction.rowIndex}</span>
                          </div>
                          {item.transaction.flags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {item.transaction.flags.map((f) => (
                                <Badge key={f} variant="outline" className="rounded-md bg-red-50 px-1.5 py-0 text-[10px] text-red-600 dark:bg-red-950/50 dark:text-red-300">
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* AI explanation */}
              {detail.explanation && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-900 dark:bg-violet-950/30">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('results.detail.explanation')}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-violet-900/90 dark:text-violet-100/90">{detail.explanation}</p>
                  {detail.evidence && detail.evidence.length > 0 && (
                    <>
                      <Separator className="my-2 bg-violet-200/60 dark:bg-violet-900" />
                      <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">{t('results.detail.evidence')}</p>
                      <ul className="mt-1 space-y-0.5">
                        {detail.evidence.map((ev, i) => (
                          <li key={i} className="text-[11px] text-violet-900/80 dark:text-violet-100/80" dir="auto">
                            • {ev}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {/* note */}
              <div className="rounded-xl border p-3">
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t('results.detail.addNote')}</p>
                {noteEditing || !detail.userNote ? (
                  <>
                    <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} maxLength={500} rows={2} placeholder={t('results.detail.notePlaceholder')} className="rounded-lg text-xs" />
                    <div className="mt-2 flex justify-end gap-2">
                      {detail.userNote && (
                        <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs" onClick={() => { setNoteEditing(false); setNoteDraft(detail.userNote ?? '') }}>
                          {t('common.cancel')}
                        </Button>
                      )}
                      <Button size="sm" className="h-7 rounded-lg text-xs" onClick={() => void handleSaveNote(detail)} disabled={busyAction || !noteDraft.trim()}>
                        {t('results.detail.saveNote')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs leading-6 text-muted-foreground">{detail.userNote}</p>
                    <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-lg text-xs" onClick={() => { setNoteEditing(true); setNoteDraft(detail.userNote ?? '') }}>
                      {t('common.edit')}
                    </Button>
                  </div>
                )}
              </div>

              {/* actions */}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {detail.status === 'resolved' || detail.status === 'rejected' || detail.status === 'approved' ? (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={() => void handleReopen(detail)}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t('results.detail.reopen')}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 rounded-xl bg-emerald-600 text-xs text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      onClick={() => void handleApprove(detail)}
                      disabled={detail.type === 'exact' || !APPROVABLE.includes(detail.type)}
                      title={detail.type === 'exact' ? t('results.detail.exactApproved') : !APPROVABLE.includes(detail.type) ? t('results.detail.notApprovable') : undefined}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t('results.detail.approve')}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl border-red-200 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40" onClick={() => void handleReject(detail)}>
                      <X className="h-3.5 w-3.5" />
                      {t('results.detail.reject')}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl border-sky-200 text-xs text-sky-600 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-400 dark:hover:bg-sky-950/40" onClick={() => void handleResolve(detail)}>
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {t('results.detail.resolve')}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
