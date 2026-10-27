'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FolderKanban, LayoutTemplate, Loader2, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { ProjectListItem, ReconciliationConfig } from '@/lib/types'

type TemplateItem = {
  id: string
  name: string
  config: ReconciliationConfig
  createdAt: string
}

export function TemplatesCard() {
  const { t, formatDate, formatNumber } = useI18n()
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null) // null = fetch failed
  const [projectId, setProjectId] = useState<string>('')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    try {
      const data = await apiFetch<{ templates: TemplateItem[] }>('/api/templates')
      setTemplates(data.templates)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
    ;(async () => {
      try {
        const data = await apiFetch<{ projects: ProjectListItem[] }>('/api/projects?limit=100')
        setProjects(data.projects ?? [])
      } catch {
        setProjects(null) // graceful: projects API belongs to another module
      }
    })()
  }, [loadTemplates])

  const createTemplate = async () => {
    if (creating) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('settings.templateNamePlaceholder'))
      return
    }
    if (!projectId) {
      toast.error(t('settings.fromProjectPlaceholder'))
      return
    }
    setCreating(true)
    try {
      // Pull the project's current config, then persist it as a template
      const detail = await apiFetch<{ config: ReconciliationConfig }>(`/api/projects/${projectId}`)
      await apiFetch('/api/templates', {
        method: 'POST',
        json: { name: trimmed, config: detail.config },
      })
      toast.success(t('settings.templateCreated'))
      setName('')
      setProjectId('')
      await loadTemplates()
    } catch (err) {
      toast.error((err as Error).message || t('common.networkError'))
    } finally {
      setCreating(false)
    }
  }

  const removeTemplate = async (id: string) => {
    setDeletingId(id)
    try {
      await apiFetch(`/api/templates/${id}`, { method: 'DELETE' })
      toast.success(t('settings.templateDeleted'))
      setTemplates((prev) => prev.filter((tp) => tp.id !== id))
    } catch (err) {
      toast.error((err as Error).message || t('common.networkError'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="card-soft rounded-2xl border bg-card p-5" aria-labelledby="settings-templates-title">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <LayoutTemplate className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 id="settings-templates-title" className="text-sm font-bold">{t('settings.templates')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('settings.templatesDesc')}</p>
        </div>
      </div>

      {/* Create from project */}
      <div className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="template-name">{t('settings.templateName')}</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.templateNamePlaceholder')}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.fromProject')}</Label>
            {projects === null ? (
              <Select disabled>
                <SelectTrigger aria-label={t('settings.fromProject')}>
                  <SelectValue placeholder={t('settings.noProjects')} />
                </SelectTrigger>
              </Select>
            ) : (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger aria-label={t('settings.fromProject')}>
                  <SelectValue placeholder={t('settings.fromProjectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] leading-4 text-muted-foreground">{t('settings.applyHint')}</p>
          <Button
            size="sm"
            onClick={createTemplate}
            disabled={creating || projects !== null && projects.length === 0}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {creating ? t('settings.creatingTemplate') : t('settings.createTemplate')}
          </Button>
        </div>
        {projects !== null && projects.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <FolderKanban className="h-4 w-4 shrink-0" />
            <span>{t('settings.noProjects')} — {t('settings.noProjectsDesc')}</span>
          </div>
        )}
      </div>

      {/* Template list */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-xl bg-muted" />
            <div className="h-12 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed py-8 text-center">
            <LayoutTemplate className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">{t('settings.noTemplates')}</p>
            <p className="max-w-xs text-xs text-muted-foreground">{t('settings.noTemplatesDesc')}</p>
          </div>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto pe-1">
            {templates.map((tp) => (
              <li
                key={tp.id}
                className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{tp.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{formatDate(tp.createdAt)}</span>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {t('settings.templateDateTol', { days: formatNumber(tp.config?.dateToleranceDays ?? 0) })}
                    </Badge>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {t('settings.templateAmountTol', {
                        amount: formatNumber((tp.config?.amountToleranceMinor ?? 0) / 100),
                      })}
                    </Badge>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                      aria-label={`${t('common.delete')} ${tp.name}`}
                    >
                      {deletingId === tp.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('settings.deleteTemplateTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('settings.deleteTemplateBody', { name: tp.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void removeTemplate(tp.id)} className="bg-red-600 text-white hover:bg-red-700">
                        {t('common.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
