'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FolderOpen, Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { CategoryItem, ProjectListItem } from '@/lib/types'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectFormDialog } from '@/components/projects/project-form-dialog'

const STATUS_OPTIONS = ['draft', 'ready', 'processing', 'reconciled', 'archived'] as const

/** پرونده‌ها — projects grid with search & filters (agent 2-b). */
export function ProjectsView() {
  const { t, formatNumber } = useI18n()
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProjectListItem | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchProjects = useCallback(async () => {
    setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim())
      if (status !== 'all') params.set('status', status)
      if (categoryId !== 'all') params.set('categoryId', categoryId)
      const data = await apiFetch<{ projects: ProjectListItem[] }>(`/api/projects?${params.toString()}`)
      setProjects(data?.projects ?? [])
    } catch (err) {
      setProjects([])
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoadingMore(false)
    }
  }, [debouncedQ, status, categoryId, t])

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiFetch<{ categories: CategoryItem[] }>('/api/categories')
      setCategories(data?.categories ?? [])
    } catch {
      setCategories([])
    }
  }, [])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(timer)
  }, [q])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const refresh = useCallback(() => {
    fetchProjects()
    fetchCategories()
  }, [fetchProjects, fetchCategories])

  const filtered = projects ?? []
  const hasFilters = debouncedQ.trim() !== '' || status !== 'all' || categoryId !== 'all'

  const skeletons = useMemo(() => [0, 1, 2, 3, 4, 5], [])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t('projects.title')}</h1>
            {projects !== null && (
              <Badge variant="secondary" className="tabular-nums">
                {formatNumber(filtered.length)}
              </Badge>
            )}
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('projects.newProject')}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-72">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('projects.searchPlaceholder')} className="ps-9" aria-label={t('projects.searchPlaceholder')} />
          </div>
          <div className="flex gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40" aria-label={t('projects.statusFilter')}>
                <SelectValue placeholder={t('projects.statusFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`projects.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full sm:w-44" aria-label={t('projects.categoryFilter')}>
                <SelectValue placeholder={t('projects.categoryFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      {projects === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {skeletons.map((i) => (
            <div key={i} className="rounded-2xl border bg-card p-4">
              <Skeleton className="mb-3 h-5 w-2/3" />
              <Skeleton className="mb-4 h-4 w-1/2" />
              <Skeleton className="mb-4 h-4 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card/50 py-16 text-center ${loadingMore ? 'opacity-60' : ''}`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">{hasFilters ? t('projects.emptyFiltered') : t('projects.empty')}</p>
          <p className="text-xs text-muted-foreground">{hasFilters ? t('common.clearFilters') : t('projects.emptyDesc')}</p>
          {!hasFilters && (
            <Button className="mt-3" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('projects.newProject')}
            </Button>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${loadingMore ? 'opacity-60' : ''}`}>
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} onEdit={(project) => setEditTarget(project)} onChanged={refresh} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} categories={categories} onSaved={refresh} />

      {/* Edit dialog */}
      <ProjectFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        project={editTarget}
        categories={categories}
        onSaved={refresh}
      />
    </div>
  )
}
