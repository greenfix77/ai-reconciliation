'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FolderOpen, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { CategoryItem } from '@/lib/types'
import { CategoryFormDialog } from '@/components/projects/category-form-dialog'

/** دسته‌بندی‌ها — categories grid (agent 2-b). */
export function CategoriesView() {
  const { t, formatNumber } = useI18n()
  const [categories, setCategories] = useState<CategoryItem[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CategoryItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiFetch<{ categories: CategoryItem[] }>('/api/categories')
      setCategories(data?.categories ?? [])
    } catch (err) {
      setCategories([])
      toast.error(err instanceof Error ? err.message : t('common.error'))
    }
  }, [t])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFetch(`/api/categories/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success(t('projects.cat.deleted'))
      setDeleteTarget(null)
      fetchCategories()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t('projects.cat.title')}</h1>
          {categories !== null && (
            <Badge variant="secondary" className="tabular-nums">
              {formatNumber(categories.length)}
            </Badge>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('projects.cat.add')}
        </Button>
      </div>

      {/* Content */}
      {categories === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border bg-card p-4">
              <Skeleton className="mb-3 h-5 w-1/2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card/50 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Tags className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">{t('projects.cat.empty')}</p>
          <p className="text-xs text-muted-foreground">{t('projects.cat.emptyDesc')}</p>
          <Button className="mt-3" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('projects.cat.add')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => (
            <Card key={c.id} className="card-soft gap-0 overflow-hidden rounded-2xl border bg-card p-0 transition-shadow hover:shadow-md">
              <div className="h-1.5 w-full" style={{ backgroundColor: c.color }} />
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-4 w-4 shrink-0 rounded-full ring-2 ring-muted" style={{ backgroundColor: c.color }} aria-hidden />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{c.name}</h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {t('projects.cat.projectCount', { count: formatNumber(c.projectCount) })}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('common.edit')} onClick={() => setEditTarget(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-400"
                    aria-label={t('common.delete')}
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CategoryFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={fetchCategories} />

      {/* Edit dialog */}
      <CategoryFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        category={editTarget}
        onSaved={fetchCategories}
      />

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.cat.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('projects.cat.deleteConfirmBody', {
                name: deleteTarget?.name ?? '',
                count: formatNumber(deleteTarget?.projectCount ?? 0),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
            >
              {deleting && <span className="animate-spin">◌</span>}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
