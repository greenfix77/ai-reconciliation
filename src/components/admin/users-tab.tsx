'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Eye, KeyRound, LockOpen, MoreHorizontal, Search, ShieldPlus, ShieldMinus, SlidersHorizontal, Trash2, UserPlus, Users } from 'lucide-react'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  AdminUserRow,
  AdminErrorState,
  AdminEmptyState,
  PagedList,
  RoleBadge,
  TablePagination,
  UserStatusBadge,
} from './shared'
import { UserDetailDialog } from './user-detail-dialog'

const PAGE_SIZE = 20
const PWD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,72}$/

type ListState = PagedList<AdminUserRow>

function parseQuota(v: string, max: number): number | null {
  const s = v.trim()
  if (s === '') return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(0, Math.floor(n)))
}

/** کاربران — admin users directory: search, filters, CRUD, quotas, password reset. */
export function UsersTab({ active, refreshSignal }: { active: boolean; refreshSignal: number }) {
  const { t, formatNumber, formatDate } = useI18n()

  const [data, setData] = useState<ListState | null>(null)
  const [error, setError] = useState(false)
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [status, setStatus] = useState('all')
  const [role, setRole] = useState('all')
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [pwdTarget, setPwdTarget] = useState<AdminUserRow | null>(null)
  const [quotaTarget, setQuotaTarget] = useState<AdminUserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (dq.trim()) params.set('query', dq.trim())
    if (status !== 'all') params.set('status', status)
    if (role !== 'all') params.set('role', role)
    try {
      const res = await apiFetch<{ users: AdminUserRow[]; total: number; page: number; pages: number }>(`/api/admin/users?${params.toString()}`)
      setData({ rows: res.users ?? [], total: res.total, page: res.page, pages: res.pages })
      setError(false)
    } catch (e) {
      const s = (e as { status?: number }).status
      if (s === 401) return
      setError(true)
      setData((prev) => prev ?? { rows: [], total: 0, page: 1, pages: 1 })
    }
  }, [dq, status, role, page])

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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDq(q)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const patchUser = async (id: string, body: Record<string, unknown>, successMsg: string) => {
    setMutatingId(id)
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', json: body })
      toast.success(successMsg)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.networkError'))
    } finally {
      setMutatingId(null)
    }
  }

  const rows = data?.rows ?? []
  const loading = data === null && !error

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-72">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.users.search')} className="ps-9" aria-label={t('admin.users.search')} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-36" aria-label={t('admin.users.col.status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="active">{t('admin.users.status.active')}</SelectItem>
              <SelectItem value="disabled">{t('admin.users.status.disabled')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={(v) => { setRole(v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-32" aria-label={t('admin.users.col.role')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="admin">{t('admin.users.role.admin')}</SelectItem>
              <SelectItem value="user">{t('admin.users.role.user')}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            {t('admin.users.add')}
          </Button>
        </div>
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
        <AdminEmptyState icon={Users} title={t('common.empty')} desc={dq || status !== 'all' || role !== 'all' ? t('common.clearFilters') : undefined} />
      ) : (
        <div className={cn('overflow-hidden rounded-2xl border bg-card card-soft transition-opacity', mutatingId && 'opacity-70')}>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="text-xs text-muted-foreground">
                  <th className="p-3 text-start font-medium">{t('admin.users.col.name')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.users.col.role')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.users.col.status')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.users.col.quotas')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.users.col.projects')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.users.col.lastLogin')}</th>
                  <th className="p-3 text-start font-medium">{t('admin.users.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const locked = u.lockedUntil !== null && new Date(u.lockedUntil).getTime() > Date.now()
                  return (
                    <tr key={u.id} className="border-t transition-colors hover:bg-muted/40">
                      <td className="p-3">
                        <div className="font-medium">{u.name}</div>
                        <div dir="ltr" className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="p-3"><RoleBadge role={u.role} /></td>
                      <td className="p-3">
                        <div className="flex flex-col items-start gap-1">
                          <UserStatusBadge status={u.status} />
                          {locked && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400">
                              {t('admin.users.locked')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <span className="tnum">{t('admin.quota.maxProjects')}: <bdi>{u.maxProjects ?? t('admin.users.default')}</bdi></span>
                          <span aria-hidden>·</span>
                          <span className="tnum">{t('admin.quota.dailyAi')}: <bdi>{u.dailyAiLimit ?? t('admin.users.default')}</bdi></span>
                          {!u.canUseAi && (
                            <Badge variant="secondary" className="border-transparent bg-slate-500/10 text-slate-600 dark:text-slate-400">
                              {t('admin.users.aiOff')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 tnum">{formatNumber(u._count.projects)}</td>
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : t('admin.users.never')}</td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('admin.users.col.actions')}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setDetailId(u.id)}>
                              <Eye className="h-4 w-4" /> {t('admin.users.menu.detail')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPwdTarget(u)}>
                              <KeyRound className="h-4 w-4" /> {t('admin.users.menu.password')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setQuotaTarget(u)}>
                              <SlidersHorizontal className="h-4 w-4" /> {t('admin.users.menu.quotas')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={mutatingId === u.id}
                              onClick={() => void patchUser(u.id, { status: u.status === 'active' ? 'disabled' : 'active' }, u.status === 'active' ? t('admin.users.disabled') : t('admin.users.enabled'))}
                            >
                              {u.status === 'active' ? <ShieldMinus className="h-4 w-4" /> : <ShieldPlus className="h-4 w-4" />}
                              {u.status === 'active' ? t('admin.users.menu.disable') : t('admin.users.menu.activate')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={mutatingId === u.id}
                              onClick={() => void patchUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }, u.role === 'admin' ? t('admin.users.demoted') : t('admin.users.promoted'))}
                            >
                              {u.role === 'admin' ? <ShieldMinus className="h-4 w-4" /> : <ShieldPlus className="h-4 w-4" />}
                              {u.role === 'admin' ? t('admin.users.menu.demote') : t('admin.users.menu.promote')}
                            </DropdownMenuItem>
                            {locked && (
                              <DropdownMenuItem disabled={mutatingId === u.id} onClick={() => void patchUser(u.id, { clearLockout: true }, t('admin.users.lockCleared'))}>
                                <LockOpen className="h-4 w-4" /> {t('admin.users.menu.clearLock')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:text-red-600 dark:text-red-400" onClick={() => setDeleteTarget(u)}>
                              <Trash2 className="h-4 w-4" /> {t('admin.users.menu.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {data && <TablePagination page={data.page} pages={data.pages} total={data.total} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(data.pages, p + 1))} />}
        </div>
      )}

      {/* Create user */}
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void load()} />

      {/* Password reset (with AlertDialog confirm) */}
      <PasswordResetDialog target={pwdTarget} onOpenChange={(o) => !o && setPwdTarget(null)} onDone={() => void load()} />

      {/* Quotas */}
      <QuotasDialog target={quotaTarget} onOpenChange={(o) => !o && setQuotaTarget(null)} onSaved={() => void load()} />

      {/* Detail dialog */}
      <UserDetailDialog userId={detailId} open={detailId !== null} onOpenChange={(o) => !o && setDetailId(null)} onChanged={() => void load()} />

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.users.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.users.deleteBody', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={async () => {
                if (!deleteTarget) return
                const id = deleteTarget.id
                try {
                  await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
                  toast.success(t('admin.users.deleted'))
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

// ---------- Create user dialog ----------

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [maxProjects, setMaxProjects] = useState('')
  const [dailyAiLimit, setDailyAiLimit] = useState('')
  const [canUseAi, setCanUseAi] = useState(true)
  const [saving, setSaving] = useState(false)

  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && PWD_RE.test(password)

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        json: {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          maxProjects: parseQuota(maxProjects, 10000),
          dailyAiLimit: parseQuota(dailyAiLimit, 100000),
          canUseAi,
        },
      })
      toast.success(t('admin.users.created'))
      onOpenChange(false)
      setName(''); setEmail(''); setPassword(''); setRole('user'); setMaxProjects(''); setDailyAiLimit(''); setCanUseAi(true)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.networkError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.users.createTitle')}</DialogTitle>
          <DialogDescription>{t('admin.users.createDesc')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="admin-create-name">{t('admin.users.field.name')}</Label>
            <Input id="admin-create-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-create-email">{t('admin.users.field.email')}</Label>
            <Input id="admin-create-email" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-create-pwd">{t('admin.users.field.password')}</Label>
            <Input id="admin-create-pwd" dir="ltr" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <p className="text-[11px] text-muted-foreground">{t('admin.users.field.passwordHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('admin.users.field.role')}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger aria-label={t('admin.users.field.role')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t('admin.users.role.user')}</SelectItem>
                  <SelectItem value="admin">{t('admin.users.role.admin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="admin-create-mp">{t('admin.users.field.maxProjects')}</Label>
              <Input id="admin-create-mp" dir="ltr" type="number" min={0} value={maxProjects} onChange={(e) => setMaxProjects(e.target.value)} placeholder={t('admin.users.field.optional')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="admin-create-ai">{t('admin.users.field.dailyAiLimit')}</Label>
              <Input id="admin-create-ai" dir="ltr" type="number" min={0} value={dailyAiLimit} onChange={(e) => setDailyAiLimit(e.target.value)} placeholder={t('admin.users.field.optional')} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Switch checked={canUseAi} onCheckedChange={setCanUseAi} aria-label={t('admin.users.field.canUseAi')} />
                {t('admin.users.field.canUseAi')}
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving ? t('common.loading') : t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Password reset dialog (admin → user) ----------

function PasswordResetDialog({ target, onOpenChange, onDone }: { target: AdminUserRow | null; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { t } = useI18n()
  const [pwd, setPwd] = useState('')
  const [notify, setNotify] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) {
      setPwd('')
      setNotify(true)
      setConfirming(false)
    }
  }, [target])

  const valid = PWD_RE.test(pwd)

  const submit = async () => {
    if (!target || !valid || saving) return
    setSaving(true)
    try {
      await apiFetch(`/api/admin/users/${target.id}/password`, { method: 'POST', json: { newPassword: pwd, notifyUser: notify } })
      toast.success(t('admin.pwd.done'))
      onOpenChange(false)
      onDone()
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
          <DialogTitle>{t('admin.pwd.title')}</DialogTitle>
          <DialogDescription>{t('admin.pwd.desc', { name: target?.name ?? '' })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="admin-pwd-new">{t('admin.pwd.new')}</Label>
            <Input id="admin-pwd-new" dir="ltr" type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" />
            <p className="text-[11px] text-muted-foreground">{t('admin.pwd.hint')}</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={notify} onCheckedChange={setNotify} aria-label={t('admin.pwd.notify')} />
            {t('admin.pwd.notify')}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogTrigger asChild>
              <Button disabled={!valid || saving}>{t('admin.pwd.title')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('admin.pwd.confirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('admin.pwd.confirmBody', { name: target?.name ?? '' })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={submit}>{t('common.confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Quotas dialog ----------

function QuotasDialog({ target, onOpenChange, onSaved }: { target: AdminUserRow | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { t } = useI18n()
  const [maxProjects, setMaxProjects] = useState('')
  const [dailyAiLimit, setDailyAiLimit] = useState('')
  const [canUseAi, setCanUseAi] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) {
      setMaxProjects(target.maxProjects === null ? '' : String(target.maxProjects))
      setDailyAiLimit(target.dailyAiLimit === null ? '' : String(target.dailyAiLimit))
      setCanUseAi(target.canUseAi)
    }
  }, [target])

  const submit = async () => {
    if (!target || saving) return
    setSaving(true)
    try {
      await apiFetch(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        json: {
          maxProjects: parseQuota(maxProjects, 10000),
          dailyAiLimit: parseQuota(dailyAiLimit, 100000),
          canUseAi,
        },
      })
      toast.success(t('admin.quota.saved'))
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
          <DialogTitle>{t('admin.quota.title')}</DialogTitle>
          <DialogDescription>{t('admin.quota.desc', { name: target?.name ?? '' })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="admin-quota-mp">{t('admin.quota.maxProjects')}</Label>
            <Input id="admin-quota-mp" dir="ltr" type="number" min={0} value={maxProjects} onChange={(e) => setMaxProjects(e.target.value)} placeholder={t('admin.users.field.optional')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-quota-ai">{t('admin.quota.dailyAi')}</Label>
            <Input id="admin-quota-ai" dir="ltr" type="number" min={0} value={dailyAiLimit} onChange={(e) => setDailyAiLimit(e.target.value)} placeholder={t('admin.users.field.optional')} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={canUseAi} onCheckedChange={setCanUseAi} aria-label={t('admin.quota.canUseAi')} />
            {t('admin.quota.canUseAi')}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? t('common.loading') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
