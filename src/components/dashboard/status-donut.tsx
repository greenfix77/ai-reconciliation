'use client'

import { useMemo, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ChartPie, Inbox } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { DashboardStats } from '@/lib/types'
import { DashCard, SectionHeader } from './shared'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DONUT_COLORS: Record<string, string> = {
  reconciled: '#10b981',
  draft: '#3b82f6',
  processing: '#f59e0b',
  ready: '#8b5cf6',
  archived: '#64748b',
  failed: '#f43f5e',
}
const FALLBACK_COLOR = '#64748b'

const colorOf = (key: string) => DONUT_COLORS[key] ?? FALLBACK_COLOR

/** Donut card: project status breakdown + local filter select + legend (RTL start side). */
export function StatusDonut({ stats }: { stats: DashboardStats }) {
  const { t, formatNumber } = useI18n()
  const [filter, setFilter] = useState('all')

  const breakdown = useMemo(() => stats.projectStatusBreakdown ?? [], [stats.projectStatusBreakdown])
  const data = useMemo(() => (filter === 'all' ? breakdown : breakdown.filter((d) => d.key === filter)), [breakdown, filter])
  const grandTotal = useMemo(() => breakdown.reduce((a, d) => a + d.count, 0), [breakdown])
  const filteredTotal = useMemo(() => data.reduce((a, d) => a + d.count, 0), [data])

  const centerValue = filter === 'all' ? stats.totalReports : filteredTotal
  const centerLabel = filter === 'all' ? t('dashboard.donut.centerLabel') : (data[0]?.label ?? t('dashboard.donut.centerLabel'))

  return (
    <DashCard>
      <SectionHeader
        icon={ChartPie}
        iconTone="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
        title={t('dashboard.donut.title')}
        subtitle={t('dashboard.donut.subtitle')}
        action={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger size="sm" className="h-8 w-[132px] rounded-lg text-xs" aria-label={t('dashboard.donut.filterAll')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {t('dashboard.donut.filterAll')}
              </SelectItem>
              {breakdown.map((d) => (
                <SelectItem key={d.key} value={d.key} className="text-xs">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {grandTotal === 0 || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Inbox className="h-5 w-5" />
          </span>
          <p className="text-xs text-muted-foreground">{t('dashboard.donut.empty')}</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5">
          {/* Legend — first in DOM = right side in RTL (start) */}
          <ul className="order-2 space-y-2.5 sm:order-1">
            {data.map((d) => {
              const pct = grandTotal > 0 ? (d.count / grandTotal) * 100 : 0
              return (
                <li key={d.key} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(d.key) }} aria-hidden />
                  <span className="truncate font-medium text-foreground/80">{d.label}</span>
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

          {/* Donut */}
          <div className="relative order-1 mx-auto h-[200px] w-[200px] sm:order-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="66%"
                  outerRadius="92%"
                  paddingAngle={3}
                  cornerRadius={6}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell key={d.key} fill={colorOf(d.key)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold tnum">{formatNumber(centerValue)}</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">{centerLabel}</span>
            </div>
          </div>
        </div>
      )}
    </DashCard>
  )
}
