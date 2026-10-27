'use client'

import { Sparkles, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** Blue-gradient AI banner with primary "new case" CTA and secondary AI-tools link. */
export function AiBanner({ className }: { className?: string }) {
  const { t } = useI18n()
  const setView = useAppStore((s) => s.setView)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-bl from-blue-50 via-blue-50/50 to-transparent p-4 card-soft sm:p-5 dark:border-blue-500/20 dark:from-blue-500/10 dark:via-blue-500/[0.05]',
        className
      )}
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-14 start-6 h-40 w-40 rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 end-10 h-36 w-36 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold leading-6">{t('dashboard.ai.title')}</h3>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t('dashboard.ai.subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setView('projects')}
            className="h-9 rounded-xl bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            {t('dashboard.ai.cta')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setView('aitools')}
            className="h-9 rounded-xl border-blue-200/80 bg-white/70 px-4 text-[13px] font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
          >
            {t('dashboard.ai.secondary')}
          </Button>
        </div>
      </div>
    </div>
  )
}
