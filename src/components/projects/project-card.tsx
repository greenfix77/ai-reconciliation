'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeftRight, Archive, ArchiveRestore, CheckCircle2, Files, Loader2, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import { apiFetch } from '@/lib/api-client'
import { ProjectListItem } from '@/lib/types'
import { matchRateTone, ProjectStatusBadge } from './helpers'

type Props = {
  project: ProjectListItem
  onEdit: (project: ProjectListItem) => void
  onChanged: () => void
}

export function ProjectCard({ project, onEdit, onChanged }: Props) {
  const { t, formatNumber } = useI18n()
  const openProject = useAppStore((s) => s.openProject)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const isArchived = project.status === 'archived'
  const isProcessing = project.status === 'processing'
  const matchRate = project.latestStats?.matchRatePct ?? null

  const toggleArchive = async () => {
    setToggling(true)
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: 'PATCH', json: { status: isArchived ? 'draft' : 'archived' } })
      toast.success(t(isArchived ? 'projects.unarchived' : 'projects.archived'))
      setMenuOpen(false)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      toast.success(t('projects.deleted'))
      setDeleteOpen(false)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card className="card-soft group relative gap-0 overflow-hidden rounded-2xl border bg-card p-0 transition-shadow hover:shadow-md">
        {/* category color stripe */}
        <div className="h-1.5 w-full" style={{ backgroundColor: project.categoryColor ?? 'transparent' }} />
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold leading-6">{project.name}</h3>
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{project.description || '—'}</p>
            </div>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t('common.actions')}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => { setMenuOpen(false); onEdit(project) }}>
                  <Pencil className="h-4 w-4" />
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={toggling || isProcessing} onClick={toggleArchive}>
                  {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {t(isArchived ? 'projects.unarchive' : 'projects.archive')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={isProcessing} onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}>
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ProjectStatusBadge status={project.status} />
            {project.categoryName && (
              <Badge variant="outline" className="gap-1.5 border-transparent bg-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.categoryColor ?? 'var(--muted-foreground)' }} />
                {project.categoryName}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Files className="h-3.5 w-3.5" />
              {formatNumber(project.fileCount)} {t('projects.files')}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {formatNumber(project.txCount)} {t('projects.transactions')}
            </span>
            {matchRate !== null && (
              <span className={`inline-flex items-center gap-1 font-medium ${matchRateTone(matchRate)}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {formatNumber(matchRate, { maximumFractionDigits: 1 })}%
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">{project.dateLabel}</span>
            <Button size="sm" onClick={() => openProject(project.id)}>
              {t('projects.view')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('projects.deleteConfirmBody', { name: project.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700"
              disabled={deleting || isProcessing}
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
