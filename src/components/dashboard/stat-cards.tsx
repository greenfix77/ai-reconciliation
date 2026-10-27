'use client'

import { useId, useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { AlertTriangle, CheckCircle2, FileText, Percent, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { DashboardStats } from '@/lib/types'
import { cn } from '@/lib/utils'

type Tone = 'emerald' | 'red' | 'sky' | 'violet'

const TONES: Record<Tone, { card: string; chip: string; color: string; up: string; down: string }> = {
  emerald: {
    card: 'border-emerald-200/70 bg-gradient-to-b from-emerald-50/90 to-transparent dark:border-emerald-500/20 dark:from-emerald-500/[0.09]',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    color: '#10b981',
    up: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    down: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  },
  red: {
    card: 'border-red-200/70 bg-gradient-to-b from-red-50/90 to-transparent dark:border-red-500/20 dark:from-red-500/[0.09]',
    chip: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    color: '#ef4444',
    up: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    down: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  },
  sky: {
    card: 'border-sky-200/70 bg-gradient-to-b from-sky-50/90 to-transparent dark:border-sky-500/20 dark:from-sky-500/[0.09]',
    chip: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
    color: '#0ea5e9',
    up: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    down: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  },
  violet: {
    card: 'border-violet-200/70 bg-gradient-to-b from-violet-50/90 to-transparent dark:border-violet-500/20 dark:from-violet-500/[0.09]',
    chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    color: '#8b5cf6',
    up: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    down: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  },
}

type StatDef = {
  key: string
  title: string
  value: string
  trendPct: number
  spark: number[]
  tone: Tone
  icon: LucideIcon
}

function Sparkline({ data, color }: { data: { i: number; v: number }[]; color: string }) {
  const gid = useId()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill={`url(#${gid})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function StatCards({ stats }: { stats: DashboardStats }) {
  const { t, formatNumber } = useI18n()

  const sparkData = (arr: number[]) => {
    const a = arr && arr.length > 0 ? arr : [0, 0]
    return (a.length < 2 ? [...a, ...a] : a).map((v, i) => ({ i, v }))
  }

  const defs = useMemo<StatDef[]>(
    () => [
      {
        key: 'successTx',
        title: t('dashboard.stats.successTx'),
        value: formatNumber(stats.successTransactions.total),
        trendPct: stats.successTransactions.trendPct,
        spark: stats.successTransactions.spark,
        tone: 'emerald',
        icon: CheckCircle2,
      },
      {
        key: 'discrepancies',
        title: t('dashboard.stats.discrepancies'),
        value: formatNumber(stats.discrepancies.total),
        trendPct: stats.discrepancies.trendPct,
        spark: stats.discrepancies.spark,
        tone: 'red',
        icon: AlertTriangle,
      },
      {
        key: 'reports',
        title: t('dashboard.stats.reports'),
        value: formatNumber(stats.reports.total),
        trendPct: stats.reports.trendPct,
        spark: stats.reports.spark,
        tone: 'sky',
        icon: FileText,
      },
      {
        key: 'matchRate',
        title: t('dashboard.stats.matchRate'),
        value: `${formatNumber(stats.matchRate.pct, { maximumFractionDigits: 1 })}${t('dashboard.unit.percent')}`,
        trendPct: stats.matchRate.trendPct,
        spark: stats.matchRate.spark,
        tone: 'violet',
        icon: Percent,
      },
    ],
    [stats, t, formatNumber]
  )

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {defs.map((d) => {
        const tone = TONES[d.tone]
        const positive = d.trendPct >= 0
        const TrendIcon = positive ? TrendingUp : TrendingDown
        return (
          <div key={d.key} className={cn('relative overflow-hidden rounded-2xl border p-4 card-soft sm:p-5', tone.card)}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone.chip)}>
                  <d.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="truncate text-xs font-medium text-muted-foreground">{d.title}</span>
              </div>
              <span
                title={t('dashboard.stats.trendHint')}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                  positive ? tone.up : tone.down
                )}
              >
                <TrendIcon className="h-3 w-3" />
                <bdi dir="ltr" className="tnum">
                  {positive ? '+' : '-'}
                  {formatNumber(Math.abs(d.trendPct))}%
                </bdi>
              </span>
            </div>

            <div className="mt-3 text-2xl font-extrabold leading-8 tnum sm:text-[26px]">{d.value}</div>

            <div className="mt-3 h-10" dir="ltr" aria-hidden>
              <Sparkline data={sparkData(d.spark)} color={tone.color} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
