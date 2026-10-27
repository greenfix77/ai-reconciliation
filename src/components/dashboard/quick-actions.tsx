'use client'

import type { LucideIcon } from 'lucide-react'
import { ArrowLeftRight, BarChart3, MessageSquareText, Plus, Settings2, Zap } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import type { ViewName } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DashCard, SectionHeader } from './shared'

type ActionDef = {
  key: string
  icon: LucideIcon
  view: ViewName
  filled?: boolean
  tile: string
  chip: string
}

const ACTIONS: ActionDef[] = [
  {
    key: 'reports',
    icon: BarChart3,
    view: 'reports',
    tile: 'border-violet-200/80 bg-violet-50/70 hover:bg-violet-100/80 dark:border-violet-500/20 dark:bg-violet-500/[0.08] dark:hover:bg-violet-500/[0.15]',
    chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  },
  {
    key: 'assistant',
    icon: MessageSquareText,
    view: 'aitools',
    tile: 'border-emerald-200/80 bg-emerald-50/70 hover:bg-emerald-100/80 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08] dark:hover:bg-emerald-500/[0.15]',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  {
    key: 'reconciliation',
    icon: ArrowLeftRight,
    view: 'projects',
    tile: 'border-sky-200/80 bg-sky-50/70 hover:bg-sky-100/80 dark:border-sky-500/20 dark:bg-sky-500/[0.08] dark:hover:bg-sky-500/[0.15]',
    chip: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  },
  {
    key: 'aiSettings',
    icon: Settings2,
    view: 'providers',
    tile: 'border-orange-200/80 bg-orange-50/70 hover:bg-orange-100/80 dark:border-orange-500/20 dark:bg-orange-500/[0.08] dark:hover:bg-orange-500/[0.15]',
    chip: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
  },
  {
    key: 'newCase',
    icon: Plus,
    view: 'projects',
    filled: true,
    tile: 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 dark:hover:bg-blue-500',
    chip: 'bg-white/15 text-white',
  },
]

/** Quick actions card: 5 soft-colored tiles (2 cols mobile → 5 cols xl) + overall stats card sits beside it. */
export function QuickActions({ className }: { className?: string }) {
  const { t } = useI18n()
  const setView = useAppStore((s) => s.setView)

  return (
    <DashCard className={className}>
      <SectionHeader
        icon={Zap}
        iconTone="bg-primary/10 text-primary"
        title={t('dashboard.quick.title')}
        subtitle={t('dashboard.quick.subtitle')}
      />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setView(a.view)}
            className={cn(
              'group flex flex-col gap-2.5 rounded-xl border p-3 text-start transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              a.tile
            )}
          >
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105', a.chip)}>
              <a.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className={cn('block truncate text-[13px] font-bold', a.filled ? 'text-white' : 'text-foreground')}>{t(`dashboard.quick.${a.key}`)}</span>
              <span className={cn('mt-0.5 block truncate text-[11px]', a.filled ? 'text-blue-100' : 'text-muted-foreground')}>
                {t(`dashboard.quick.${a.key}Sub`)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </DashCard>
  )
}
