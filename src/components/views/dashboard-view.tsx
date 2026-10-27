'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RotateCcw, Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import type { DashboardStats } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DashCard } from '@/components/dashboard/shared'
import { StatCards } from '@/components/dashboard/stat-cards'
import { AiBanner } from '@/components/dashboard/ai-banner'
import { StatusDonut } from '@/components/dashboard/status-donut'
import { TrendChart } from '@/components/dashboard/trend-chart'
import { LatestCases } from '@/components/dashboard/latest-cases'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { OverallCard } from '@/components/dashboard/overall-card'
import { ShowcaseStrip } from '@/components/dashboard/showcase-strip'
import { DashboardFooter } from '@/components/dashboard/dashboard-footer'

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted/70', className)} />
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card card-soft p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-9 w-9 rounded-lg" />
              <SkeletonBlock className="h-5 w-12 rounded-full" />
            </div>
            <SkeletonBlock className="mt-4 h-7 w-24" />
            <SkeletonBlock className="mt-4 h-10" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SkeletonBlock className="h-[128px] rounded-2xl xl:col-span-2" />
        <SkeletonBlock className="h-[248px] rounded-2xl" />
      </div>
      <SkeletonBlock className="h-[340px] rounded-2xl" />
      <SkeletonBlock className="h-[300px] rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SkeletonBlock className="h-[168px] rounded-2xl xl:col-span-2" />
        <SkeletonBlock className="h-[280px] rounded-2xl" />
      </div>
      <SkeletonBlock className="h-[420px] rounded-2xl" />
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <DashCard className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div>
        <h3 className="text-sm font-bold">{t('dashboard.error.title')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.error.body')}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 rounded-xl">
        <RotateCcw className="h-4 w-4" />
        {t('common.retry')}
      </Button>
    </DashCard>
  )
}

function WelcomeHeader() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{t('dashboard.welcome.title')}</h1>
        <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">{t('dashboard.welcome.subtitle')}</p>
      </div>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-blue-200/70 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:inline-flex dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
        <Sparkles className="h-3.5 w-3.5" />
        {t('dashboard.welcome.updated')}
      </span>
    </div>
  )
}

/** Main dashboard view — fetches /api/stats and lays out all dashboard sections. */
export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await apiFetch<DashboardStats>('/api/stats')
      setStats(data)
    } catch (e) {
      const status = (e as { status?: number }).status
      if (status === 401) return // auth gate handles unauthenticated sessions
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex min-h-[calc(100vh-88px)] flex-col gap-4">
      <WelcomeHeader />

      {loading && <DashboardSkeleton />}

      {!loading && error && <ErrorState onRetry={load} />}

      {!loading && !error && stats && (
        <>
          <StatCards stats={stats} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <AiBanner className="xl:col-span-2" />
            <StatusDonut stats={stats} />
          </div>

          <TrendChart stats={stats} />

          <LatestCases projects={stats.latestProjects ?? []} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <QuickActions className="xl:col-span-2" />
            <OverallCard stats={stats} />
          </div>

          <ShowcaseStrip />
        </>
      )}

      <DashboardFooter />
    </div>
  )
}
