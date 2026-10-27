'use client'

import type { LucideIcon } from 'lucide-react'
import { Clock, Folder, FolderOpen, Gauge, RefreshCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { DashboardStats } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DashCard, SectionHeader } from './shared'

type MiniStat = {
  key: string
  icon: LucideIcon
  chip: string
  value: number
}

/** "Overall statistics" card: 4 mini-stats in a 2×2 grid fed by stats.overall. */
export function OverallCard({ stats, className }: { stats: DashboardStats; className?: string }) {
  const { t, formatNumber } = useI18n()
  const o = stats.overall

  const minis: MiniStat[] = [
    { key: 'totalProjects', icon: Folder, chip: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400', value: o.totalProjects },
    { key: 'pendingReview', icon: Clock, chip: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', value: o.unmatchedTotal },
    { key: 'activeProjects', icon: RefreshCw, chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400', value: o.activeProjects },
    { key: 'currentFiles', icon: FolderOpen, chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400', value: o.totalFiles },
  ]

  return (
    <DashCard className={cn('flex flex-col', className)}>
      <SectionHeader
        icon={Gauge}
        iconTone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
        title={t('dashboard.overall.title')}
        subtitle={t('dashboard.overall.subtitle')}
      />
      <div className="mt-4 grid flex-1 grid-cols-2 gap-3">
        {minis.map((m) => (
          <div key={m.key} className="flex flex-col justify-center gap-1.5 rounded-xl border bg-muted/40 p-3">
            <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', m.chip)}>
              <m.icon className="h-4 w-4" />
            </span>
            <span className="text-lg font-extrabold leading-6 tnum">{formatNumber(m.value)}</span>
            <span className="text-[11px] font-medium text-muted-foreground">{t(`dashboard.overall.${m.key}`)}</span>
          </div>
        ))}
      </div>
    </DashCard>
  )
}
