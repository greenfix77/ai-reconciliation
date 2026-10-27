'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Eye, FolderClosed, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ProjectStatusBadge, SideBadge, formatBytes } from '@/components/projects/helpers'
import {
  AdminErrorState,
  AdminEmptyState,
  AdminProjectDetail,
  AdminProjectRow,
  GroupTypeBadge,
  MatchStatusBadge,
  PagedList,
  TablePagination,
  majorFromMinor,
  parseJsonSafe,
} from './shared'
import { ReconciliationStats } from '@/lib/types'

const PAGE_SIZE = 20
const STATUS_OPTIONS = ['draft', 'ready', 'processing', 'reconciled', 'failed', 'archived'] as const

/** پروژه‌ها — all projects across the platform with full-depth oversight. */
export function ProjectsTab({ active, refreshSignal }: { active: boolean; refreshSignal: number }) {
  const { t, formatNumber, formatDate } = useI18n()

  const [data, setData] = useState<PagedList<AdminProjectRow> | null>(null)
  const [error, setError] = useState(false)

  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const [editTarget, setEditTarget] = useState<AdminProjectRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminProjectRow | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (dq.trim()) params.set('query', dq.trim())
    if (status !== 'all') params.set('status', status)
    try {
      const res = await apiFetch<{ projects: AdminProjectRow[]; total: number; page: number; pages: number }>(`/api/admin/projects?${params.toString()}`)
      setData({ rows: res.projects ?? [], total: res.total, page: res.page, pages: res.pages })
      setError(false)
    } catch (e) {
      const s = (e as { status?: number }).status
      if (s === 401) return
      setError(true)
      setData((prev) => prev ?? { rows: [], total: 0, page: 1, pages: 1 })
    }
  }, [dq, status, page])

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
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-72">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.projects.search')} className="ps-9" aria-label={t('admin.projects.search')} />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-44" aria-label={t('admin.projects.col.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{t(`projects.status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error && data === null ? (
        <AdminErrorState onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={FolderClosed} title={t('common.empty')} desc={dq || status !== 'all' ? t('common.clearFilters') : undefined} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card card-soft">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="text-xs text-muted-foreground">
                  <th className="p-3 text-start font-medium">{t('admin.projects.col.name')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.projects.col.owner')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.projects.col.category')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.projects.col.status')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.projects.col.files')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.projects.col.recons')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.projects.col.updated')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.projects.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t transition-colors hover:bg-muted/40">
                    <td className="max-w-52 p-3">
                      <div className="truncate font-medium" title={p.name}>{p.name}</div>
                      {p.description && <div className="mt-0.5 max-w-52 truncate text-xs text-muted-foreground" title={p.description}>{p.description}</div>}
                    </td>
                    <td className="p-3">
                      <div className="text-[13px] font-medium">{p.owner?.name}</div>
                      <div dir="ltr" className="text-xs text-muted-foreground">{p.owner?.email}</div>
                    </td>
                    <td className="p-3">
                      {p.category ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.category.color }} aria-hidden />
                          {p.category.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3"><ProjectStatusBadge status={p.status} /></td>
                    <td className="p-3 tnum">{formatNumber(p._count.files)}</td>
                    <td className="p-3 tnum">{formatNumber(p._count.reconciliations)}</td>
                    <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">{formatDate(p.updatedAt)}</td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('admin.projects.col.actions')}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => { setDetailId(p.id); setDetailOpen(true) }}>
                            <Eye className="h-4 w-4" /> {t('admin.projects.menu.view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditTarget(p)}>
                            <Pencil className="h-4 w-4" /> {t('admin.projects.menu.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-600 dark:text-red-400" onClick={() => setDeleteTarget(p)}>
                            <Trash2 className="h-4 w-4" /> {t('admin.projects.menu.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && <TablePagination page={data.page} pages={data.pages} total={data.total} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(data.pages, p + 1))} />}
        </div>
      )}

      {/* Edit dialog */}
      <EditProjectDialog target={editTarget} onOpenChange={(o) => !o && setEditTarget(null)} onSaved={() => void load()} />

      {/* Oversight dialog */}
      <ProjectOversightDialog projectId={detailId} open={detailOpen} onOpenChange={setDetailOpen} />

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.projects.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.projects.deleteBody', { name: deleteTarget?.name ?? '', owner: deleteTarget?.owner?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={async () => {
                if (!deleteTarget) return
                try {
                  await apiFetch(`/api/admin/projects/${deleteTarget.id}`, { method: 'DELETE' })
                  toast.success(t('admin.projects.deleted'))
                  setDeleteTarget(null)
                  await load()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t('common.networkError'))
                }
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------- Edit dialog ----------

function EditProjectDialog({ target, onOpenChange, onSaved }: { target: AdminProjectRow | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('draft')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) {
      setName(target.name)
      setDescription(target.description ?? '')
      setStatus(target.status)
    }
  }, [target])

  const submit = async () => {
    if (!target || saving) return
    setSaving(true)
    try {
      await apiFetch(`/api/admin/projects/${target.id}`, {
        method: 'PATCH',
        json: { name: name.trim(), description: description.trim() || null, status },
      })
      toast.success(t('admin.projects.saved'))
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.networkError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.projects.editTitle')}</DialogTitle>
          <DialogDescription>{t('admin.projects.editDesc', { name: target?.name ?? '' })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="adm-edit-name">{t('admin.projects.field.name')}</Label>
            <Input id="adm-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-edit-desc">{t('admin.projects.field.desc')}</Label>
            <Input id="adm-edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('admin.projects.field.status')}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label={t('admin.projects.field.status')}><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{t(`projects.status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={saving || name.trim().length < 1}>{saving ? t('common.loading') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Full oversight dialog ----------

function ProjectOversightDialog({ projectId, open, onOpenChange }: { projectId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, formatNumber, formatDate, locale } = useI18n()
  const [detail, setDetail] = useState<AdminProjectDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !projectId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const data = await apiFetch<AdminProjectDetail>(`/api/admin/projects/${projectId}`)
        if (!cancelled) setDetail(data)
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : t('common.networkError'))
        if (!cancelled) onOpenChange(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectId, onOpenChange, t])

  const p = detail?.project
  const groups = detail?.matchGroups ?? []
  const txByFile = new Map<string, AdminProjectDetail['transactions']>()
  for (const tx of detail?.transactions ?? []) {
    const arr = txByFile.get(tx.fileId) ?? []
    arr.push(tx)
    txByFile.set(tx.fileId, arr)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderClosed className="h-5 w-5 text-primary" />
            {t('admin.projects.oversightTitle')}
          </DialogTitle>
          <DialogDescription>{p?.name ?? '…'}</DialogDescription>
        </DialogHeader>

        {loading || !detail || !p ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Meta + owner */}
            <section className="rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold">{p.name}</h3>
                    <ProjectStatusBadge status={p.status} />
                    {p.category && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.category.color }} aria-hidden />
                        {p.category.name}
                      </span>
                    )}
                  </div>
                  {p.description && <p className="mt-1 max-w-xl text-xs text-muted-foreground">{p.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{t('common.date')}: {formatDate(p.createdAt)}</span>
                    <span>{t('admin.projects.col.updated')}: {formatDate(p.updatedAt)}</span>
                    {p.lastReconciledAt && <span>{t('admin.projects.lastReconciled')}: {formatDate(p.lastReconciledAt)}</span>}
                  </div>
                </div>
                <div className="shrink-0 rounded-xl border bg-card p-3 text-xs">
                  <div className="mb-1 font-semibold">{t('admin.projects.owner')}</div>
                  <div className="font-medium">{p.owner?.name}</div>
                  <div dir="ltr" className="text-muted-foreground">{p.owner?.email}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{p.owner?.role === 'admin' ? t('admin.users.role.admin') : t('admin.users.role.user')} · {p.owner?.status === 'active' ? t('admin.users.status.active') : t('admin.users.status.disabled')}</div>
                </div>
              </div>
            </section>

            {/* Files */}
            <section aria-label={t('admin.projects.files')}>
              <h3 className="mb-2 text-sm font-bold">{t('admin.projects.files')}</h3>
              {detail.files.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t('common.empty')}</p>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-xl border">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="text-muted-foreground">
                        <th className="p-2 text-start font-medium">{t('admin.users.col.name')}</th>
                        <th className="p-2 text-start font-medium">{t('admin.projects.col.status')}</th>
                        <th className="p-2 text-start font-medium">{t('admin.projects.col.files')}</th>
                        <th className="p-2 text-start font-medium">{t('admin.projects.size')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.files.map((f) => (
                        <tr key={f.id} className="border-t">
                          <td className="max-w-56 truncate p-2">
                            <span className="inline-flex items-center gap-1.5">
                              <SideBadge side={f.side} />
                              <span className="truncate" title={f.originalName}><bdi>{f.originalName}</bdi></span>
                            </span>
                            {f.parseError && <div className="mt-1 text-[10px] text-red-600 dark:text-red-400">{t('admin.projects.parseError')}: {f.parseError}</div>}
                          </td>
                          <td className="p-2"><ProjectStatusBadge status={f.status} /></td>
                          <td className="p-2 tnum text-muted-foreground">{formatNumber(f.txCount)}</td>
                          <td className="p-2 whitespace-nowrap text-muted-foreground">{formatBytes(f.size, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Transactions (grouped by file) */}
            {detail.transactions.length > 0 && (
              <section aria-label={t('admin.projects.transactions')}>
                <h3 className="mb-2 text-sm font-bold">{t('admin.projects.transactions')}</h3>
                <div className="max-h-96 overflow-y-auto rounded-xl border">
                  {[...txByFile.entries()].map(([fileId, txs]) => {
                    const file = detail.files.find((f) => f.id === fileId)
                    return (
                      <div key={fileId}>
                        <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/80 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
                          <SideBadge side={file?.side ?? txs[0].side} />
                          <span className="truncate"><bdi>{file?.originalName ?? fileId}</bdi></span>
                          <span className="ms-auto tnum text-muted-foreground">{formatNumber(txs.length)}</span>
                        </div>
                        <table className="w-full min-w-[640px] text-xs">
                          <tbody>
                            {txs.map((tx) => {
                              const flags = parseJsonSafe<string[]>(tx.flags, [])
                              return (
                                <tr key={tx.id} className="border-b last:border-0">
                                  <td className="w-14 p-2 text-muted-foreground tnum">#{formatNumber(tx.rowIndex)}</td>
                                  <td className="w-24 whitespace-nowrap p-2 text-muted-foreground">{tx.date ? formatDate(tx.date) : '—'}</td>
                                  <td className="max-w-52 truncate p-2" title={tx.description ?? ''}>{tx.description || '—'}</td>
                                  <td className="max-w-24 truncate p-2 text-muted-foreground" title={tx.reference ?? ''}><bdi>{tx.reference || '—'}</bdi></td>
                                  <td className="whitespace-nowrap p-2 text-end font-mono" dir="ltr">{majorFromMinor(tx.amountMinor, formatNumber)}</td>
                                  <td className="p-2">
                                    <div className="flex flex-wrap gap-1">
                                      {flags.slice(0, 2).map((fl) => (
                                        <Badge key={fl} variant="secondary" dir="ltr" className="border-transparent bg-amber-500/10 text-[9px] text-amber-700 dark:text-amber-400">{fl}</Badge>
                                      ))}
                                      {flags.length > 2 && <Badge variant="secondary" dir="ltr" className="border-transparent bg-amber-500/10 text-[9px] text-amber-700 dark:text-amber-400">+{flags.length - 2}</Badge>}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <Separator />

            {/* Latest reconciliation + match groups */}
            <section aria-label={t('admin.projects.matchGroups')}>
              <h3 className="mb-2 text-sm font-bold">{t('admin.projects.matchGroups')}</h3>
              {detail.reconciliations.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {detail.reconciliations.slice(0, 3).map((r) => {
                    const stats = parseJsonSafe<Partial<ReconciliationStats>>(r.stats, {})
                    return (
                      <div key={r.id} className="rounded-xl border bg-muted/30 px-3 py-2 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <ProjectStatusBadge status={r.status} />
                          <span dir="ltr" className="font-mono text-[10px] text-muted-foreground">{r.providerName} · {r.model}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                          <span>{t('common.date')}: {formatDate(r.startedAt)}</span>
                          <span className="tnum">{t('admin.projects.groups')}: {formatNumber(r._count.groups)}</span>
                          {typeof stats.matchRatePct === 'number' && (
                            <span className="tnum font-semibold text-foreground/80">{t('dashboard.stats.matchRate')}: {formatNumber(stats.matchRatePct)}%</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {groups.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t('admin.projects.noRecon')}</p>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto pe-1">
                  {groups.map((g) => (
                    <div key={g.id} className="rounded-xl border p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <GroupTypeBadge type={g.type} />
                        <MatchStatusBadge status={g.status} />
                        {typeof g.confidence === 'number' && g.confidence > 0 && (
                          <Badge variant="secondary" className="border-transparent bg-violet-500/10 text-[10px] text-violet-700 dark:text-violet-400">
                            {t('admin.projects.confidence')}: {formatNumber(Math.round(g.confidence * 100))}%
                          </Badge>
                        )}
                        {g.amountDiffMinor !== 0 && (
                          <Badge variant="secondary" className="border-transparent bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
                            {t('admin.projects.amountDiff')}: <bdi dir="ltr" className="tnum">{majorFromMinor(g.amountDiffMinor, formatNumber)}</bdi>
                          </Badge>
                        )}
                        {g.dateDiffDays !== null && g.dateDiffDays !== 0 && (
                          <Badge variant="secondary" className="border-transparent bg-orange-500/10 text-[10px] text-orange-700 dark:text-orange-400">
                            {t('admin.projects.dateDiff')}: {t('admin.projects.day', { n: formatNumber(g.dateDiffDays) })}
                          </Badge>
                        )}
                      </div>
                      {g.explanation && (
                        <p className="mt-2 rounded-lg bg-muted/50 p-2 leading-5 text-muted-foreground">
                          <span className="font-medium text-foreground/70">{t('admin.projects.explanation')}: </span>
                          {g.explanation}
                        </p>
                      )}
                      {g.userNote && (
                        <p className="mt-1.5 text-muted-foreground">
                          <span className="font-medium text-foreground/70">{t('admin.projects.note')}: </span>
                          {g.userNote}
                        </p>
                      )}
                      <div className="mt-2 overflow-hidden rounded-lg border">
                        <table className="w-full min-w-[520px]">
                          <tbody>
                            {g.items.map((item, idx) => (
                              <tr key={`${g.id}-${idx}`} className={cn('border-b last:border-0', item.side === 'A' ? 'bg-sky-500/[0.04]' : 'bg-violet-500/[0.04]')}>
                                <td className="w-16 p-1.5"><SideBadge side={item.side} /></td>
                                <td className="w-24 whitespace-nowrap p-1.5 text-muted-foreground">{item.transaction.date ? formatDate(item.transaction.date) : '—'}</td>
                                <td className="max-w-56 truncate p-1.5" title={item.transaction.description ?? ''}>{item.transaction.description || '—'}</td>
                                <td className="max-w-20 truncate p-1.5 text-muted-foreground" title={item.transaction.reference ?? ''}><bdi>{item.transaction.reference || '—'}</bdi></td>
                                <td className="whitespace-nowrap p-1.5 text-end font-mono" dir="ltr">{majorFromMinor(item.transaction.amountMinor, formatNumber)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
