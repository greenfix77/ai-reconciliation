'use client'

import type { LucideIcon } from 'lucide-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Shared types + small building blocks for the admin panel (agent 5-b). */

// ---------- API DTOs (admin contracts) ----------

export type AdminKpis = {
  totalUsers: number
  activeUsers: number
  disabledUsers: number
  adminUsers: number
  newUsers30d: number
  totalProjects: number
  projects30d: number
  totalReconciliations: number
  reconciliations30d: number
  aiCallsToday: number
  aiCalls7d: number
  failedLogins7d: number
  blockedLogins7d: number
  storageBytes: number
}

export type AdminStats = {
  kpis: AdminKpis
  charts: {
    users14: { date: string; count: number }[]
    projects14: { date: string; count: number }[]
    recon7: { date: string; count: number }[]
    projectStatus: { status: string; count: number }[]
  }
  topUsers: { id: string; name: string; email: string; role: string; status: string; actions: number }[]
  recentUsers: { id: string; name: string; email: string; role: string; status: string; createdAt: string; lastLoginAt: string | null }[]
}

export type AdminUserRow = {
  id: string
  email: string
  name: string
  role: string
  status: string
  disabledAt: string | null
  maxProjects: number | null
  dailyAiLimit: number | null
  canUseAi: boolean
  lastLoginAt: string | null
  createdAt: string
  lockedUntil: string | null
  failedAttempts: number
  _count: { projects: number; providers: number; activityLogs: number }
}

export type AdminProvider = {
  id: string
  name: string
  type: string
  baseUrl?: string | null
  keyHint: string
  models: string[]
  isActive?: boolean
  status?: string
  isDefault?: boolean
  createdAt: string
}

export type AdminUserDetail = {
  user: {
    id: string
    email: string
    name: string
    role: string
    status: string
    disabledAt: string | null
    locale: string
    theme: string
    currency: string
    maxProjects: number | null
    dailyAiLimit: number | null
    canUseAi: boolean
    failedAttempts: number
    lockedUntil: string | null
    lastLoginAt: string | null
    createdAt: string
  }
  projects: { id: string; name: string; status: string; createdAt: string; updatedAt: string; _count: { files: number; reconciliations: number } }[]
  providers: AdminProvider[]
  defaults: { defaultMaxProjects: number; defaultDailyAiLimit: number; registrationOpen: boolean }
  aiToday: number
  recentActivity: { id: string; action: string; entityType: string; entityId: string; ip: string | null; createdAt: string }[]
}

export type AdminProjectRow = {
  id: string
  name: string
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
  lastReconciledAt: string | null
  owner: { id: string; name: string; email: string; role: string; status: string }
  category: { id: string; name: string; color: string } | null
  _count: { files: number; reconciliations: number }
}

export type AdminProjectDetail = {
  project: {
    id: string
    name: string
    description: string | null
    status: string
    config: string
    owner: { id: string; name: string; email: string; role: string; status: string }
    category: { id: string; name: string; color: string } | null
    createdAt: string
    updatedAt: string
    lastReconciledAt: string | null
  }
  files: { id: string; originalName: string; mimeType: string; size: number; side: 'A' | 'B'; status: string; txCount: number; parseError: string | null; createdAt: string }[]
  reconciliations: { id: string; status: string; stats: string; providerName: string; model: string; startedAt: string; finishedAt: string | null; _count: { groups: number } }[]
  transactions: { id: string; fileId: string; side: 'A' | 'B'; rowIndex: number; date: string | null; description: string | null; reference: string | null; amountMinor: number; debit: number | null; credit: number | null; currency: string | null; flags: string }[]
  matchGroups: {
    id: string
    type: string
    status: string
    confidence: number
    amountDiffMinor: number
    dateDiffDays: number | null
    explanation: string | null
    validationStatus: string
    userNote: string | null
    items: { side: 'A' | 'B'; transaction: { id: string; side: 'A' | 'B'; date: string | null; description: string | null; reference: string | null; amountMinor: number } }[]
  }[]
}

export type AuditLogRow = {
  id: string
  action: string
  entityType: string
  entityId: string
  ip: string | null
  userAgent: string | null
  createdAt: string
  meta: string | null
  user: { name: string; email: string; role: string } | null
}

export type PagedList<T> = { rows: T[]; total: number; page: number; pages: number }

// ---------- Helpers ----------

/** Defensive JSON.parse for string-typed JSON columns (stats / flags / config). */
export function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback
  if (typeof raw !== 'string') return raw as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function formatStorage(bytes: number, fmt: (n: number, opts?: Intl.NumberFormatOptions) => string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  const kb = bytes / 1024
  if (kb < 1) return `${fmt(bytes)} B`
  const mb = kb / 1024
  if (mb < 1) return `${fmt(kb, { maximumFractionDigits: 1 })} KB`
  const gb = mb / 1024
  if (gb < 1) return `${fmt(mb, { maximumFractionDigits: 1 })} MB`
  return `${fmt(gb, { maximumFractionDigits: 2 })} GB`
}

/** Minor units → major display (consistent with reports: amountMinor/100). */
export function majorFromMinor(amountMinor: number, fmt: (n: number, opts?: Intl.NumberFormatOptions) => string): string {
  return fmt((amountMinor ?? 0) / 100, { maximumFractionDigits: 2 })
}

// ---------- Badges ----------

export function RoleBadge({ role }: { role: string }) {
  const { t } = useI18n()
  if (role === 'admin') {
    return (
      <Badge variant="outline" className="border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-400">
        {t('admin.users.role.admin')}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
      {t('admin.users.role.user')}
    </Badge>
  )
}

export function UserStatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const active = status === 'active'
  return (
    <Badge variant="outline" className={cn('gap-1.5', active
      ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400'
      : 'border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-red-500')} aria-hidden />
      {active ? t('admin.users.status.active') : t('admin.users.status.disabled')}
    </Badge>
  )
}

/** Match-group type chip palette — mirrors reports/report-detail-dialog. */
const GROUP_TYPE_CHIP: Record<string, string> = {
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

export function groupTypeChipClass(type: string): string {
  return GROUP_TYPE_CHIP[type] ?? 'bg-slate-500/10 text-slate-700 dark:text-slate-400'
}

export function GroupTypeBadge({ type }: { type: string }) {
  const { t } = useI18n()
  return (
    <Badge variant="secondary" className={cn('border-transparent text-[10px]', groupTypeChipClass(type))}>
      {t(`reports.type.${type}`)}
    </Badge>
  )
}

/** MatchGroup approval status badge. */
export function MatchStatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const map: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    rejected: 'bg-red-500/10 text-red-700 dark:text-red-400',
    auto_cleared: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  }
  const label =
    status === 'pending'
      ? t('admin.projects.pending')
      : status === 'approved'
        ? t('admin.projects.approved')
        : status === 'rejected'
          ? t('admin.projects.rejected')
          : status === 'auto_cleared'
            ? t('admin.projects.autocleared')
            : <bdi dir="ltr">{status}</bdi>
  return (
    <Badge variant="secondary" className={cn('border-transparent text-[10px]', map[status] ?? 'bg-slate-500/10 text-slate-700 dark:text-slate-400')}>
      {label}
    </Badge>
  )
}

/** AI-provider status chip (optional fields — defensive). */
export function ProviderStatusChip({ provider }: { provider: AdminProvider }) {
  const { t } = useI18n()
  const status = provider.status
  if (status === 'connected') {
    return <Badge variant="secondary" className="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{t('providers.status.connected')}</Badge>
  }
  if (status === 'failed') {
    return <Badge variant="secondary" className="border-transparent bg-red-500/10 text-red-700 dark:text-red-400">{t('providers.status.failed')}</Badge>
  }
  return <Badge variant="secondary" className="border-transparent bg-slate-500/10 text-slate-600 dark:text-slate-400">{t('providers.status.untested')}</Badge>
}

// ---------- Pagination ----------

export function TablePagination({
  page,
  pages,
  total,
  onPrev,
  onNext,
}: {
  page: number
  pages: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  const { t, formatNumber } = useI18n()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
      <span className="tnum">{t('admin.users.total', { count: formatNumber(total) })}</span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={onPrev} disabled={page <= 1} aria-label={t('admin.page.prev')}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <span className="tnum min-w-16 text-center">
          {t('common.page')} {formatNumber(page)} {t('common.of')} {formatNumber(pages)}
        </span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={onNext} disabled={page >= pages} aria-label={t('admin.page.next')}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  )
}

// ---------- Error / empty states ----------

export function AdminErrorState({ onRetry, className }: { onRetry: () => void; className?: string }) {
  const { t } = useI18n()
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/60 py-14 text-center', className)}>
      <p className="text-sm font-bold">{t('admin.error.title')}</p>
      <p className="text-xs text-muted-foreground">{t('admin.error.body')}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="rounded-xl">
        {t('common.retry')}
      </Button>
    </div>
  )
}

export function AdminEmptyState({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card/50 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
    </div>
  )
}
