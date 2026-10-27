'use client'

import type { LucideIcon } from 'lucide-react'
import { Check, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Chip = { key: string; icon: LucideIcon; cls: string }

const CHIPS: Chip[] = [
  { key: 'accuracy', icon: Check, cls: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'security', icon: ShieldCheck, cls: 'text-sky-600 dark:text-sky-400' },
  { key: 'ai', icon: Sparkles, cls: 'text-violet-600 dark:text-violet-400' },
  { key: 'instant', icon: Zap, cls: 'text-amber-600 dark:text-amber-400' },
]

/** Dashboard footer — sits at the bottom of the flex column (mt-auto). */
export function DashboardFooter() {
  const { t } = useI18n()

  return (
    <footer className="mt-auto flex flex-col items-center gap-3 border-t border-border/70 pt-5 text-center">
      <p className="text-sm font-semibold text-foreground/80">{t('dashboard.footer.tagline')}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {CHIPS.map((c) => (
          <span
            key={c.key}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground card-soft"
          >
            <c.icon className={cn('h-3.5 w-3.5', c.cls)} />
            {t(`dashboard.footer.${c.key}`)}
          </span>
        ))}
      </div>
    </footer>
  )
}
