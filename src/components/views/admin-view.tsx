'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts'
import {
  FolderClosed,
  HardDrive,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { DashCard, SectionHeader } from '@/components/dashboard/shared'
import { AdminErrorState, AdminStats, RoleBadge, UserStatusBadge, formatStorage } from '@/components/admin/shared'
import { UsersTab } from '@/components/admin/users-tab'
import { ProjectsTab } from '@/components/admin/projects-tab'
import { SecurityTab } from '@/components/admin/security-tab'
import { SettingsTab } from '@/components/admin/settings-tab'

const AXIS_TICK = { fontSize: 10, fill: '#94a3b8' }
const EMERALD = '#10b981'
const SKY = '#0ea5e9'
const VIOLET = '#8b5cf6'

const DONUT_COLORS: Record<string, string> = {
  reconciled: '#10b981',
  draft: '#3b82f6',
  processing: '#f59e0b',
  ready: '#8b5cf6',
  archived: '#64748b',
  failed: '#f43f5e',
}

type Point = { date: string; count: number }

/** پنل مدیریت — platform administration: overview, users, projects, security, settings. */
export function AdminView() {
  const { t } = useI18n()

  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch<AdminStats>('/api/admin/stats')
      setStats(data)
      setStatsError(false)
    } catch (e) {
      const status = (e as { status?: number }).status
      if (status === 401) return
      setStatsError(true)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadStats()
    } finally {
      setRefreshing(false)
    }
    setRefreshSignal((s) => s + 1)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{t('admin.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('admin.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing} className="gap-1.5 rounded-xl">
          <RotateCcw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          {t('admin.refresh')}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl bg-muted/70 p-1 sm:w-auto">
          <TabsTrigger value="dashboard" className="gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-[13px]">
            <TrendingUp className="h-4 w-4" />
            {t('admin.tab.dashboard')}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-[13px]">
            <Users className="h-4 w-4" />
            {t('admin.tab.users')}
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-[13px]">
            <FolderClosed className="h-4 w-4" />
            {t('admin.tab.projects')}
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-[13px]">
            <ShieldAlert className="h-4 w-4" />
            {t('admin.tab.security')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-[13px]">
            <Sparkles className="h-4 w-4" />
            {t('admin.tab.settings')}
          </TabsTrigger>
        </TabsList>

        {/* Dashboard tab — KPIs, charts, lists (stats-driven) */}
        <TabsContent value="dashboard" forceMount className="mt-4 data-[state=inactive]:hidden">
          {statsLoading ? (
            <DashboardSkeleton />
          ) : statsError ? (
            <AdminErrorState onRetry={() => void loadStats()} />
          ) : stats ? (
            <div className="flex flex-col gap-4">
              <KpiGrid stats={stats} />

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <CountAreaCard title={t('admin.chart.usersTitle')} data={stats.charts.users14} color={EMERALD} interval={1} />
                <CountBarCard title={t('admin.chart.projectsTitle')} data={stats.charts.projects14} color={SKY} interval={1} />
                <CountBarCard title={t('admin.chart.reconTitle')} data={stats.charts.recon7} color={VIOLET} interval={0} />
                <StatusDonutCard data={stats.charts.projectStatus} />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <TopUsersCard users={stats.topUsers} />
                <RecentUsersCard users={stats.recentUsers} />
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* Other tabs — each mounts once, fetches on first activation, caches state */}
        <TabsContent value="users" forceMount className="mt-4 data-[state=inactive]:hidden">
          <UsersTab active={tab === 'users'} refreshSignal={refreshSignal} />
        </TabsContent>

        <TabsContent value="projects" forceMount className="mt-4 data-[state=inactive]:hidden">
          <ProjectsTab active={tab === 'projects'} refreshSignal={refreshSignal} />
        </TabsContent>

        <TabsContent value="security" forceMount className="mt-4 data-[state=inactive]:hidden">
          <SecurityTab active={tab === 'security'} refreshSignal={refreshSignal} stats={stats} />
        </TabsContent>

        <TabsContent value="settings" forceMount className="mt-4 data-[state=inactive]:hidden">
          <SettingsTab active={tab === 'settings'} refreshSignal={refreshSignal} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------- KPI grid ----------

type KpiTone = 'emerald' | 'sky' | 'violet' | 'amber' | 'red' | 'slate'

const KPI_TONES: Record<KpiTone, { card: string; chip: string }> = {
  emerald: {
    card: 'border-emerald-200/70 bg-gradient-to-b from-emerald-50/90 to-transparent dark:border-emerald-500/20 dark:from-emerald-500/[0.09]',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  sky: {
    card: 'border-sky-200/70 bg-gradient-to-b from-sky-50/90 to-transparent dark:border-sky-500/20 dark:from-sky-500/[0.09]',
    chip: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  },
  violet: {
    card: 'border-violet-200/70 bg-gradient-to-b from-violet-50/90 to-transparent dark:border-violet-500/20 dark:from-violet-500/[0.09]',
    chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  },
  amber: {
    card: 'border-amber-200/70 bg-gradient-to-b from-amber-50/90 to-transparent dark:border-amber-500/20 dark:from-amber-500/[0.09]',
    chip: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  },
  red: {
    card: 'border-red-200/70 bg-gradient-to-b from-red-50/90 to-transparent dark:border-red-500/20 dark:from-red-500/[0.09]',
    chip: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  },
  slate: {
    card: 'border-border bg-card',
    chip: 'bg-muted text-muted-foreground',
  },
}

function KpiChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', className)}>
      {children}
    </span>
  )
}

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
  children,
}: {
  title: string
  value: string
  icon: typeof Users
  tone: KpiTone
  children?: React.ReactNode
}) {
  const t = KPI_TONES[tone]
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border p-4 card-soft', t.card)}>
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', t.chip)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="truncate text-xs font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="mt-3 text-2xl font-extrabold leading-8 tnum">{value}</div>
      {children && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{children}</div>}
    </div>
  )
}

function KpiGrid({ stats }: { stats: AdminStats }) {
  const { t, formatNumber } = useI18n()
  const k = stats.kpis
  const danger = k.failedLogins7d > 10

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      <KpiCard title={t('admin.kpi.users')} value={formatNumber(k.totalUsers)} icon={Users} tone="emerald">
        <KpiChip className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          {t('admin.kpi.active')}: {formatNumber(k.activeUsers)}
        </KpiChip>
        <KpiChip className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
          {t('admin.kpi.disabled')}: {formatNumber(k.disabledUsers)}
        </KpiChip>
        <KpiChip className="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          {t('admin.kpi.admins')}: {formatNumber(k.adminUsers)}
        </KpiChip>
        <KpiChip className="bg-muted text-muted-foreground">
          {t('admin.kpi.new30')}: {formatNumber(k.newUsers30d)}
        </KpiChip>
      </KpiCard>

      <KpiCard title={t('admin.kpi.projects')} value={formatNumber(k.totalProjects)} icon={FolderClosed} tone="sky">
        <KpiChip className="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
          {t('admin.kpi.new30')}: {formatNumber(k.projects30d)}
        </KpiChip>
      </KpiCard>

      <KpiCard title={t('admin.kpi.recons')} value={formatNumber(k.totalReconciliations)} icon={RefreshCw} tone="violet">
        <KpiChip className="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          {t('admin.kpi.new30')}: {formatNumber(k.reconciliations30d)}
        </KpiChip>
      </KpiCard>

      <KpiCard title={t('admin.kpi.aiCalls')} value={formatNumber(k.aiCallsToday)} icon={Sparkles} tone="amber">
        <KpiChip className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {t('admin.kpi.aiCalls7')}: {formatNumber(k.aiCalls7d)}
        </KpiChip>
      </KpiCard>

      <KpiCard title={t('admin.kpi.failedLogins')} value={formatNumber(k.failedLogins7d)} icon={ShieldAlert} tone={danger ? 'red' : 'slate'}>
        <KpiChip className={danger ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-muted text-muted-foreground'}>
          {t('admin.kpi.blocked')}: {formatNumber(k.blockedLogins7d)}
        </KpiChip>
      </KpiCard>

      <KpiCard title={t('admin.kpi.storage')} value={formatStorage(k.storageBytes, formatNumber)} icon={HardDrive} tone="slate" />
    </div>
  )
}

// ---------- Charts ----------

function shortDay(iso: string): string {
  return iso ? iso.slice(5).replace('-', '/') : '—'
}

function ChartTip({
  active,
  payload,
  label,
  fmt,
  name,
  color,
}: {
  active?: boolean
  payload?: { value?: number | string }[]
  label?: string | number
  fmt: (n: number) => string
  name: string
  color: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div dir="rtl" className="min-w-[120px] rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold">{label}</div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="text-white/70">{name}</span>
        <span className="ms-auto font-bold tnum">{fmt(Number(payload[0]?.value ?? 0))}</span>
      </div>
    </div>
  )
}

function CountAreaCard({ title, data, color, interval }: { title: string; data: Point[]; color: string; interval: number }) {
  const { t, formatNumber } = useI18n()
  const gid = useId()
  const chartData = (data.length > 0 ? data : [{ date: '', count: 0 }]).map((d) => ({ day: shortDay(d.date), count: d.count }))
  return (
    <DashCard>
      <SectionHeader icon={TrendingUp} iconTone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" title={title} />
      <div className="mt-4 h-[220px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={interval} dy={6} />
            <YAxis width={30} tickLine={false} axisLine={false} tick={AXIS_TICK} allowDecimals={false} />
            <Tooltip cursor={{ stroke: 'rgba(148,163,184,0.4)', strokeDasharray: '4 4' }} content={<ChartTip fmt={formatNumber} name={t('admin.chart.count')} color={color} />} />
            <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2.2} fill={`url(#${gid})`} isAnimationActive={false} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DashCard>
  )
}

function CountBarCard({ title, data, color, interval }: { title: string; data: Point[]; color: string; interval: number }) {
  const { t, formatNumber } = useI18n()
  const chartData = (data.length > 0 ? data : [{ date: '', count: 0 }]).map((d) => ({ day: shortDay(d.date), count: d.count }))
  return (
    <DashCard>
      <SectionHeader icon={FolderClosed} iconTone="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" title={title} />
      <div className="mt-4 h-[220px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={interval} dy={6} />
            <YAxis width={30} tickLine={false} axisLine={false} tick={AXIS_TICK} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<ChartTip fmt={formatNumber} name={t('admin.chart.count')} color={color} />} />
            <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashCard>
  )
}

function StatusDonutCard({ data }: { data: { status: string; count: number }[] }) {
  const { t, formatNumber } = useI18n()
  const total = data.reduce((a, d) => a + d.count, 0)
  return (
    <DashCard>
      <SectionHeader icon={FolderClosed} iconTone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" title={t('admin.chart.statusTitle')} />
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <FolderClosed className="h-5 w-5" />
          </span>
          <p className="text-xs text-muted-foreground">{t('admin.chart.empty')}</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5">
          {/* Legend — first in DOM = right side in RTL (start) */}
          <ul className="order-2 w-full max-w-64 space-y-2.5 sm:order-1">
            {data.map((d) => {
              const pct = total > 0 ? (d.count / total) * 100 : 0
              return (
                <li key={d.status} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[d.status] ?? '#64748b' }} aria-hidden />
                  <span className="truncate font-medium text-foreground/80">{t(`projects.status.${d.status}`)}</span>
                  <span className="ms-auto flex shrink-0 items-center gap-2">
                    <span className="tnum text-muted-foreground">{formatNumber(d.count)}</span>
                    <bdi dir="ltr" className="w-11 text-end font-bold tnum text-foreground/70">
                      {formatNumber(pct, { maximumFractionDigits: 1 })}%
                    </bdi>
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="relative order-1 h-[180px] w-[180px] sm:order-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="status" innerRadius="66%" outerRadius="92%" paddingAngle={3} cornerRadius={6} strokeWidth={0} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.status} fill={DONUT_COLORS[d.status] ?? '#64748b'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold tnum">{formatNumber(total)}</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">{t('admin.tab.projects')}</span>
            </div>
          </div>
        </div>
      )}
    </DashCard>
  )
}

// ---------- Dashboard lists ----------

function TopUsersCard({ users }: { users: AdminStats['topUsers'] }) {
  const { t, formatNumber } = useI18n()
  return (
    <DashCard>
      <SectionHeader icon={Users} iconTone="bg-primary/10 text-primary" title={t('admin.list.topUsers')} subtitle={t('admin.list.topUsersSub')} />
      {users.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">{t('common.empty')}</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pe-1">
          {users.map((u, i) => (
            <li key={u.id} className="flex items-center gap-3 rounded-xl border p-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary tnum">
                {formatNumber(i + 1)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{u.name}</div>
                <div dir="ltr" className="truncate text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div className="ms-auto flex shrink-0 items-center gap-1.5">
                <RoleBadge role={u.role} />
                <Badge variant="secondary" className="border-transparent bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400 tnum">
                  {t('admin.list.actions')}: {formatNumber(u.actions)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  )
}

function RecentUsersCard({ users }: { users: AdminStats['recentUsers'] }) {
  const { t, formatDate } = useI18n()
  return (
    <DashCard>
      <SectionHeader icon={Users} iconTone="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" title={t('admin.list.recentUsers')} subtitle={t('admin.list.recentUsersSub')} />
      {users.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">{t('common.empty')}</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pe-1">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-xl border p-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{u.name}</div>
                <div dir="ltr" className="truncate text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div className="ms-auto flex shrink-0 items-center gap-1.5">
                <RoleBadge role={u.role} />
                <UserStatusBadge status={u.status} />
              </div>
              <div className="hidden w-20 shrink-0 text-end text-[10px] text-muted-foreground sm:block">
                <div>{t('admin.list.joined')}</div>
                <div>{formatDate(u.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  )
}

// ---------- Skeleton ----------

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card card-soft p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="mt-4 h-7 w-16" />
            <Skeleton className="mt-3 h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[280px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
