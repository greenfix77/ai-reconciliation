'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, Check, Folder, Plus, Search, Send, Sparkles, Smartphone, Upload, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { DashCard, SectionHeader } from './shared'

/* ---------- tiny primitives for the fake app screens (pure CSS/JSX, no images) ---------- */

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded bg-slate-200/90 dark:bg-slate-700/70', className)} />
}

function ChipDot({ tone }: { tone: string }) {
  return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone)} aria-hidden />
}

function MiniRow({ tone, children }: { tone?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-500/10">
        <Folder className="h-2.5 w-2.5 text-blue-500" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Sk className="h-1.5 w-3/4" />
        <Sk className="h-1 w-1/2" />
      </div>
      {tone ? <ChipDot tone={tone} /> : null}
      {children}
    </div>
  )
}

/* ---------- the 8 fake screens ---------- */

function ScreenCases() {
  const tones = ['bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-emerald-500']
  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-500/20" />
        <Sk className="h-2 w-14" />
        <div className="ms-auto h-4 w-4 rounded-md bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="flex h-5 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-1.5 dark:border-slate-700 dark:bg-slate-800">
        <Search className="h-2.5 w-2.5 text-slate-400" />
        <Sk className="h-1.5 w-12" />
      </div>
      <div className="space-y-1.5">
        {tones.map((tone, i) => (
          <MiniRow key={i} tone={tone} />
        ))}
      </div>
    </>
  )
}

function ScreenNewCase() {
  return (
    <>
      <Sk className="h-2 w-16" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1">
            <Sk className="h-1.5 w-10" />
            <div className="flex h-6 items-center rounded-lg border border-slate-200 bg-white px-1.5 dark:border-slate-700 dark:bg-slate-800">
              <Sk className="h-1.5 w-12" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex h-7 items-center justify-center gap-1 rounded-lg bg-blue-600 text-white shadow-sm">
        <Plus className="h-3 w-3" />
        <Sk className="h-1.5 w-12 bg-white/50" />
      </div>
    </>
  )
}

function ScreenUpload() {
  return (
    <>
      <Sk className="h-2 w-20" />
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex h-13 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 py-2 dark:border-blue-500/30 dark:bg-blue-500/10">
            <Upload className="h-3.5 w-3.5 text-blue-500" />
            <Sk className="h-1 w-14" />
            <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className={cn('h-full rounded-full bg-emerald-500', i === 0 ? 'w-2/3' : 'w-1/3')} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto space-y-1.5">
        {[true, false].map((on, i) => (
          <div key={i} className="flex items-center justify-between">
            <Sk className="h-1.5 w-14" />
            <span className={cn('flex h-3 w-6 items-center rounded-full p-0.5', on ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600')}>
              <span className={cn('h-2 w-2 rounded-full bg-white shadow', on ? 'ms-auto' : 'me-auto')} />
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function ScreenResults() {
  return (
    <>
      <Sk className="h-2 w-16" />
      <div className="flex items-center gap-2.5">
        <div
          className="relative h-14 w-14 shrink-0 rounded-full shadow-inner"
          style={{ background: 'conic-gradient(#10b981 0 68%, #f59e0b 68% 86%, #f43f5e 86% 100%)' }}
          aria-hidden
        >
          <div className="absolute inset-[9px] rounded-full bg-white dark:bg-slate-900" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <ChipDot tone="bg-emerald-500" />
            <Sk className="h-1.5 flex-1" />
          </div>
          <div className="flex items-center gap-1.5">
            <ChipDot tone="bg-amber-500" />
            <Sk className="h-1.5 flex-1" />
          </div>
          <div className="flex items-center gap-1.5">
            <ChipDot tone="bg-rose-500" />
            <Sk className="h-1.5 flex-1" />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Sk className="h-6 w-full rounded-lg border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <Sk className="h-6 w-full rounded-lg border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>
      <div className="mt-auto flex h-6 items-center justify-center rounded-lg bg-blue-600">
        <Sk className="h-1.5 w-12 bg-white/50" />
      </div>
    </>
  )
}

function ScreenReconciliation() {
  const ok = [true, false, true, true]
  return (
    <>
      <div className="flex items-center justify-between">
        <Sk className="h-2 w-16" />
        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 dark:bg-emerald-500/15">
          <Check className="h-2 w-2 text-emerald-600 dark:text-emerald-400" />
          <Sk className="h-1 w-6 bg-emerald-300/70 dark:bg-emerald-500/30" />
        </span>
      </div>
      <div className="space-y-1.5">
        {ok.map((isOk, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
            {isOk ? <Check className="h-2.5 w-2.5 shrink-0 text-emerald-500" /> : <X className="h-2.5 w-2.5 shrink-0 text-red-500" />}
            <Sk className="h-1.5 flex-1" />
            <Sk className="h-1.5 w-6" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
        <Sk className="h-1.5 flex-1" />
        <div className="flex h-4 w-4 items-center justify-center rounded bg-blue-600">
          <Search className="h-2 w-2 text-white" />
        </div>
      </div>
    </>
  )
}

function ScreenDiscrepancyDetail() {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 dark:bg-red-500/15">
          <AlertTriangle className="h-2 w-2 text-red-500" />
          <Sk className="h-1 w-8 bg-red-200/80 dark:bg-red-500/30" />
        </span>
        <Sk className="ms-auto h-1.5 w-8" />
      </div>
      <div className="space-y-1.5 rounded-lg border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <Sk className="h-1.5 w-full" />
        <Sk className="h-1.5 w-4/5" />
        <Sk className="h-1.5 w-3/5" />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1 rounded-lg border border-slate-100 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
            <Sk className="h-1 w-8" />
            <Sk className="h-2 w-12" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex h-6 items-center justify-center rounded-lg bg-red-500">
        <Sk className="h-1.5 w-14 bg-white/50" />
      </div>
    </>
  )
}

function ScreenCaseDetail() {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-4 rounded-md bg-slate-200 dark:bg-slate-700" />
        <Sk className="h-2 flex-1" />
        <ChipDot tone="bg-emerald-500" />
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'h-4 flex-1 rounded-md',
              i === 0 ? 'flex items-center justify-center bg-blue-600' : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
            )}
          >
            {i === 0 && <Sk className="h-1 w-6 bg-white/50" />}
          </div>
        ))}
      </div>
      <div className="space-y-1 rounded-lg border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <Sk className="h-1.5 w-12" />
          <Sk className="h-1.5 w-6" />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full w-2/3 rounded-full bg-emerald-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1 rounded-lg border border-slate-100 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
            <Sk className="h-2 w-8" />
            <Sk className="h-1 w-10" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex h-6 items-center justify-center gap-1 rounded-lg bg-blue-600">
        <Plus className="h-2.5 w-2.5 text-white" />
        <Sk className="h-1.5 w-10 bg-white/50" />
      </div>
    </>
  )
}

function ScreenAiAssistant() {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
          <Sparkles className="h-2.5 w-2.5 text-white" />
        </div>
        <Sk className="h-2 w-14" />
      </div>
      <div className="ms-auto w-3/4 space-y-1 rounded-xl rounded-se-sm bg-blue-600 p-1.5">
        <Sk className="h-1 w-full bg-white/50" />
        <Sk className="h-1 w-2/3 bg-white/50" />
      </div>
      <div className="w-3/4 space-y-1 rounded-xl rounded-ss-sm border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
        <Sk className="h-1 w-full" />
        <Sk className="h-1 w-3/4" />
      </div>
      <div className="ms-auto w-1/2 rounded-xl rounded-se-sm bg-blue-600 p-1.5">
        <Sk className="h-1 w-full bg-white/50" />
      </div>
      <div className="mt-auto flex h-6 items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 dark:border-slate-700 dark:bg-slate-800">
        <Sk className="h-1 flex-1" />
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
          <Send className="h-2 w-2 text-white rtl:rotate-180" />
        </div>
      </div>
    </>
  )
}

const SCREENS = [ScreenCases, ScreenNewCase, ScreenUpload, ScreenResults, ScreenReconciliation, ScreenDiscrepancyDetail, ScreenCaseDetail, ScreenAiAssistant]

/* ---------- phone frame + strip ---------- */

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-[230px] shrink-0 rounded-[2rem] border-4 border-slate-200 bg-white p-2 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-[290px] flex-col gap-2 overflow-hidden rounded-[1.35rem] border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />
        {children}
      </div>
    </div>
  )
}

/** Showcase strip: 8 pure-CSS phone mockups in a horizontally scrollable row. */
export function ShowcaseStrip() {
  const { t } = useI18n()

  return (
    <DashCard>
      <SectionHeader
        icon={Smartphone}
        iconTone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
        title={t('dashboard.showcase.title')}
        subtitle={t('dashboard.showcase.subtitle')}
      />
      <div className="-mx-1 mt-4 flex gap-4 overflow-x-auto px-1 pb-2 pt-1">
        {SCREENS.map((Screen, idx) => (
          <figure key={idx} className="flex w-[230px] shrink-0 flex-col">
            <PhoneFrame>
              <Screen />
            </PhoneFrame>
            <figcaption className="mt-3 text-center text-xs font-medium text-muted-foreground">{t(`dashboard.showcase.item${idx + 1}`)}</figcaption>
          </figure>
        ))}
      </div>
    </DashCard>
  )
}
