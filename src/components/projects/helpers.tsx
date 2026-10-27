'use client'

import { FileSpreadsheet, FileText, FileImage, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Shared badges / icons / small formatters for projects & files UI (agent 2-b). */

const PROJECT_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground border-transparent',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  processing: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  reconciled: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
  failed: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  archived: 'bg-muted text-muted-foreground border-transparent',
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const key = PROJECT_STATUS_STYLES[status] ? status : 'draft'
  return (
    <Badge variant="outline" className={cn('gap-1', PROJECT_STATUS_STYLES[key])}>
      {status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
      {t(`projects.status.${key}`)}
    </Badge>
  )
}

const FILE_STATUS_STYLES: Record<string, string> = {
  uploaded: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  parsing: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  parsed: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  failed: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
}

export function FileStatusBadge({ status, parseError }: { status: string; parseError?: string | null }) {
  const { t } = useI18n()
  const key = FILE_STATUS_STYLES[status] ? status : 'uploaded'
  const label = t(`projects.status.${key}`)
  const badge = (
    <Badge variant="outline" className={cn('gap-1', FILE_STATUS_STYLES[key])}>
      {(status === 'parsing' || status === 'uploaded') && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </Badge>
  )
  if (status === 'failed' && parseError) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{badge}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64 text-xs">
            {parseError}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  return badge
}

export function SideBadge({ side }: { side: 'A' | 'B' }) {
  const { t } = useI18n()
  return side === 'A' ? (
    <Badge variant="outline" className="border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-400">
      {t('projects.sideA')} · A
    </Badge>
  ) : (
    <Badge variant="outline" className="border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-400">
      {t('projects.sideB')} · B
    </Badge>
  )
}

export function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return <FileText className={cn('h-5 w-5 text-red-500', className)} />
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') return <FileImage className={cn('h-5 w-5 text-amber-500', className)} />
  return <FileSpreadsheet className={cn('h-5 w-5 text-emerald-600', className)} />
}

export function formatBytes(size: number, locale: string): string {
  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 1 })
  if (size < 1024) return `${nf.format(size)} B`
  if (size < 1024 * 1024) return `${nf.format(size / 1024)} KB`
  return `${nf.format(size / (1024 * 1024))} MB`
}

export function matchRateTone(pct: number): string {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export const RUN_STATUS_STYLES: Record<string, string> = {
  running: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  failed: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
}

export function RunStatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const key = RUN_STATUS_STYLES[status] ? status : 'running'
  return (
    <Badge variant="outline" className={cn('gap-1', RUN_STATUS_STYLES[key])}>
      {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
      {t(`projects.status.${key}`)}
    </Badge>
  )
}
