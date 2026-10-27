'use client'

import { Eye, FolderClosed, MoreHorizontal } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import type { ProjectListItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DashCard, SectionHeader } from './shared'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const BADGE = {
  completedStrong:
    'inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
  completedSoft:
    'inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:border-green-500/25 dark:bg-green-500/10 dark:text-green-300',
  review:
    'inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  failed:
    'inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300',
  archived:
    'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-500/25 dark:bg-slate-500/10 dark:text-slate-300',
}

function statusMeta(status: string, t: (k: string) => string): { label: string; cls: string } {
  switch (status) {
    case 'reconciled':
      return { label: t('dashboard.status.completed'), cls: BADGE.completedStrong }
    case 'draft':
      return { label: t('dashboard.status.completed'), cls: BADGE.completedSoft }
    case 'processing':
    case 'ready':
      return { label: t('dashboard.status.review'), cls: BADGE.review }
    case 'failed':
      return { label: t('dashboard.status.failed'), cls: BADGE.failed }
    default:
      return { label: t('dashboard.status.archived'), cls: BADGE.archived }
  }
}

/** Latest cases table with colored category/status badges, row click → open project, per-row menu. */
export function LatestCases({ projects }: { projects: ProjectListItem[] }) {
  const { t } = useI18n()
  const openProject = useAppStore((s) => s.openProject)

  return (
    <DashCard>
      <SectionHeader
        icon={FolderClosed}
        iconTone="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
        title={t('dashboard.table.title')}
        subtitle={t('dashboard.table.subtitle')}
      />

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <FolderClosed className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold">{t('dashboard.table.emptyTitle')}</p>
          <p className="max-w-xs text-xs text-muted-foreground">{t('dashboard.table.emptyBody')}</p>
        </div>
      ) : (
        <div className="mt-3 max-h-[340px] overflow-y-auto overflow-x-auto rounded-xl border">
          <Table className="min-w-[640px]">
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-start text-xs font-bold text-muted-foreground">{t('dashboard.table.col.name')}</TableHead>
                <TableHead className="text-start text-xs font-bold text-muted-foreground">{t('dashboard.table.col.category')}</TableHead>
                <TableHead className="text-start text-xs font-bold text-muted-foreground">{t('dashboard.table.col.status')}</TableHead>
                <TableHead className="text-start text-xs font-bold text-muted-foreground">{t('dashboard.table.col.progress')}</TableHead>
                <TableHead className="text-start text-xs font-bold text-muted-foreground">{t('dashboard.table.col.date')}</TableHead>
                <TableHead className="w-10" aria-label={t('common.actions')} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const meta = statusMeta(p.status, t)
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => openProject(p.id)}
                    className="cursor-pointer"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openProject(p.id)
                      }
                    }}
                  >
                    <TableCell className="max-w-[220px] py-2.5">
                      <div className="truncate text-[13px] font-semibold" title={p.name}>
                        {p.name || t('common.untitled')}
                      </div>
                      {p.description ? (
                        <div className="mt-0.5 max-w-[220px] truncate text-[11px] text-muted-foreground" title={p.description}>
                          {p.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {p.categoryName && p.categoryColor ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            color: p.categoryColor,
                            backgroundColor: `${p.categoryColor}14`,
                            borderColor: `${p.categoryColor}38`,
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.categoryColor }} aria-hidden />
                          {p.categoryName}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className={cn(meta.cls)}>{meta.label}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium tnum text-foreground/80">
                      <span dir="ltr">{p.progressLabel}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs tnum text-muted-foreground">{p.dateLabel}</TableCell>
                    <TableCell className="py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t('common.actions')}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => openProject(p.id)}>
                            <Eye className="h-4 w-4" />
                            {t('dashboard.table.open')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </DashCard>
  )
}
