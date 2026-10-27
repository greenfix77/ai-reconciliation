'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronLeft,
  Files,
  FolderOpen,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import { apiFetch } from '@/lib/api-client'
import { CategoryItem, ProjectDetail } from '@/lib/types'
import { ProjectFormDialog } from '@/components/projects/project-form-dialog'
import { UploadZone } from '@/components/projects/upload-zone'
import { FilesPanel } from '@/components/projects/files-panel'
import { ConfigPanel } from '@/components/projects/config-panel'
import { HistoryPanel } from '@/components/projects/history-panel'
import { ProjectStatusBadge } from '@/components/projects/helpers'

/** Project preparation workflow: files → config → history (agent 2-b). */
export function ProjectDetailView({ projectId }: { projectId: string | null }) {
  const { t, formatNumber, formatDate } = useI18n()
  const setView = useAppStore((s) => s.setView)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [historyToken, setHistoryToken] = useState(0)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!projectId) return
      if (!silent) setLoading(true)
      try {
        const data = await apiFetch<{ project: ProjectDetail }>(`/api/projects/${projectId}`)
        setProject(data?.project ?? null)
        setNotFound(false)
      } catch (err) {
        const status = (err as Error & { status?: number })?.status
        if (status === 404) setNotFound(true)
        else if (!silent) toast.error(err instanceof Error ? err.message : t('common.error'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [projectId, t]
  )

  useEffect(() => {
    setProject(null)
    setNotFound(false)
    load()
  }, [load])

  // categories for the edit dialog
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<{ categories: CategoryItem[] }>('/api/categories')
        if (!cancelled) setCategories((data?.categories ?? []).map((c) => ({ ...c, projectCount: c.projectCount ?? 0 })))
      } catch {
        /* non-critical */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pendingFiles = useMemo(
    () => (project?.files ?? []).some((f) => f.status === 'uploaded' || f.status === 'parsing'),
    [project?.files]
  )

  // Poll while any file is being parsed
  useEffect(() => {
    if (!pendingFiles || !projectId) return
    pollRef.current = setTimeout(() => load(true), 3000)
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [pendingFiles, projectId, load, project])

  // Engine dispatches 'recon:refresh' after runs — refetch detail + history
  useEffect(() => {
    const handler = () => {
      load(true)
      setHistoryToken((n) => n + 1)
    }
    window.addEventListener('recon:refresh', handler)
    return () => window.removeEventListener('recon:refresh', handler)
  }, [load])

  const parsedCount = useMemo(() => (project?.files ?? []).filter((f) => f.status === 'parsed').length, [project?.files])
  const canStart = parsedCount >= 2 && project?.status !== 'processing'

  const startReconciliation = () => {
    if (!projectId) return
    if (!canStart) {
      toast.warning(t('projects.needTwoFiles'))
      return
    }
    window.dispatchEvent(new CustomEvent('recon:start', { detail: { projectId } }))
    toast.info(t('projects.preparing'))
  }

  const handleDelete = async () => {
    if (!project) return
    setDeleting(true)
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      toast.success(t('projects.deleted'))
      setDeleteOpen(false)
      setView('projects')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDeleting(false)
    }
  }

  // ---------- Empty (no project selected) ----------
  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/50 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <FolderOpen className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">{t('projects.empty')}</p>
        <Button variant="outline" onClick={() => setView('projects')}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('projects.backToProjects')}
        </Button>
      </div>
    )
  }

  // ---------- Loading ----------
  if (loading && !project) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-9 w-full max-w-md" />
        <div className="rounded-2xl border bg-card p-6">
          <Skeleton className="mb-4 h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  // ---------- Not found ----------
  if (notFound || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/50 py-24 text-center">
        <p className="text-sm font-semibold">{t('projects.projectNotFound')}</p>
        <Button variant="outline" onClick={() => setView('projects')}>
          {t('projects.backToProjects')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t('common.back')} onClick={() => setView('projects')}>
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </Button>
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{project.name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 ps-10">
              <ProjectStatusBadge status={project.status} />
              {project.categoryName && (
                <Badge variant="outline" className="gap-1.5 border-transparent bg-secondary">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.categoryColor ?? 'var(--muted-foreground)' }} />
                  {project.categoryName}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{formatDate(project.createdAt)}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t('common.actions')}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={project.status === 'processing'} onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="files" className="gap-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="files" className="gap-1.5">
            <Files className="h-4 w-4" />
            {t('projects.filesTab')}
          </TabsTrigger>
          <TabsTrigger value="config">{t('projects.configTab')}</TabsTrigger>
          <TabsTrigger value="history">{t('projects.historyTab')}</TabsTrigger>
        </TabsList>

        {/* Tab 1: Files & data */}
        <TabsContent value="files" className="flex flex-col gap-4">
          <Card className="card-soft rounded-2xl border">
            <CardContent className="p-4">
              <UploadZone projectId={project.id} onUploaded={() => load(true)} />
            </CardContent>
          </Card>
          <FilesPanel project={project} onChanged={() => load(true)} />
        </TabsContent>

        {/* Tab 2: Matching config */}
        <TabsContent value="config">
          <ConfigPanel project={project} onChanged={() => load(true)} />
        </TabsContent>

        {/* Tab 3: History */}
        <TabsContent value="history">
          <HistoryPanel projectId={project.id} refreshToken={historyToken} />
        </TabsContent>
      </Tabs>

      {/* Start reconciliation CTA */}
      <Card className="card-soft rounded-2xl border bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t('projects.startRecon')}</p>
              <p className="text-xs text-muted-foreground">
                {parsedCount >= 2
                  ? `${formatNumber(parsedCount)} ${t('projects.files')} ✓`
                  : t('projects.startReconHint')}
              </p>
            </div>
          </div>
          <Button size="lg" disabled={!canStart} onClick={startReconciliation}>
            <Play className="h-4 w-4" />
            {t('projects.startRecon')}
          </Button>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        categories={categories}
        onSaved={() => load(true)}
      />

      {/* Delete confirm */}
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
              disabled={deleting || project.status === 'processing'}
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
    </div>
  )
}
