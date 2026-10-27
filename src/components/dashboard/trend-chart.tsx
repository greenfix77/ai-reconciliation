'use client'

import { useId, useMemo, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartLine } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { DashboardStats } from '@/lib/types'
import { DashCard, SectionHeader } from './shared'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DISCREPANCY_COLOR = '#ef4444'
const MATCH_COLOR = '#10b981'
const AXIS_TICK = { fontSize: 10, fill: '#94a3b8' }

type TooltipEntry = { dataKey?: string | number; value?: number | string; color?: string; stroke?: string }

function TrendTooltip({
  active,
  label,
  payload,
  fmt,
  nameD,
  nameM,
}: {
  active?: boolean
  label?: string | number
  payload?: TooltipEntry[]
  fmt: (n: number) => string
  nameD: string
  nameM: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const rows = [
    { key: 'discrepancies', label: nameD, color: DISCREPANCY_COLOR },
    { key: 'matches', label: nameM, color: MATCH_COLOR },
  ]
  return (
    <div dir="rtl" className="min-w-[140px] rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur">
      <div className="mb-1.5 font-semibold">{label}</div>
      {rows.map((r) => {
        const entry = payload.find((p) => p.dataKey === r.key)
        const v = Number(entry?.value ?? 0)
        return (
          <div key={r.key} className="flex items-center gap-2 py-0.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
            <span className="text-white/70">{r.label}</span>
            <span className="ms-auto font-bold tnum">{fmt(v)}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Full-width area chart: daily discrepancies vs matches with range select (7/14/30 — data covers 7). */
export function TrendChart({ stats }: { stats: DashboardStats }) {
  const { t, formatNumber } = useI18n()
  const [range, setRange] = useState('7')
  const gidD = useId()
  const gidM = useId()

  const data = useMemo(() => {
    const arr = stats.trend7Days ?? []
    return arr.length > 0 ? arr : [{ day: '—', discrepancies: 0, matches: 0 }]
  }, [stats.trend7Days])

  const hasData = (stats.trend7Days ?? []).length > 0

  return (
    <DashCard>
      <SectionHeader
        icon={ChartLine}
        iconTone="bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
        title={t('dashboard.trend.title')}
        subtitle={t('dashboard.trend.subtitle')}
        action={
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger size="sm" className="h-8 w-[120px] rounded-lg text-xs" aria-label={t('dashboard.trend.title')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7" className="text-xs">
                {t('dashboard.trend.range7')}
              </SelectItem>
              <SelectItem value="14" className="text-xs">
                {t('dashboard.trend.range14')}
              </SelectItem>
              <SelectItem value="30" className="text-xs">
                {t('dashboard.trend.range30')}
              </SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {!hasData ? (
        <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">{t('dashboard.trend.empty')}</div>
      ) : (
        <div className="mt-4 h-[280px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gidD} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={DISCREPANCY_COLOR} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={DISCREPANCY_COLOR} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={gidM} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={MATCH_COLOR} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={MATCH_COLOR} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} dy={6} />
              <YAxis width={34} tickLine={false} axisLine={false} tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: 'rgba(148,163,184,0.4)', strokeDasharray: '4 4' }}
                content={<TrendTooltip fmt={formatNumber} nameD={t('dashboard.trend.discrepancies')} nameM={t('dashboard.trend.matches')} />}
              />
              <Area
                type="monotone"
                dataKey="matches"
                stroke={MATCH_COLOR}
                strokeWidth={2.2}
                fill={`url(#${gidM})`}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
              <Area
                type="monotone"
                dataKey="discrepancies"
                stroke={DISCREPANCY_COLOR}
                strokeWidth={2.2}
                fill={`url(#${gidD})`}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashCard>
  )
}
