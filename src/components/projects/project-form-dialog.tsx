'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { CategoryItem, ProjectListItem } from '@/lib/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set → edit mode (PATCH), otherwise create (POST) */
  project?: ProjectListItem | null
  categories: CategoryItem[]
  onSaved: () => void
}

/** Create / edit project dialog — simple controlled form. */
export function ProjectFormDialog({ open, onOpenChange, project, categories, onSaved }: Props) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(project?.name ?? '')
      setDescription(project?.description ?? '')
      setCategoryId(project?.categoryId ?? 'none')
      setNameError(null)
    }
  }, [open, project])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(t('projects.nameRequired'))
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: trimmed,
        description: description.trim() || null,
        categoryId: categoryId === 'none' ? null : categoryId,
      }
      if (project) {
        await apiFetch(`/api/projects/${project.id}`, { method: 'PATCH', json: payload })
        toast.success(t('projects.updated'))
      } else {
        await apiFetch('/api/projects', { method: 'POST', json: payload })
        toast.success(t('projects.created'))
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? t('projects.editTitle') : t('projects.createTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('projects.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">{t('projects.name')} *</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(null) }}
              placeholder={t('projects.namePlaceholder')}
              maxLength={120}
              autoFocus
              aria-invalid={!!nameError}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            />
            {nameError && <p className="text-xs text-red-600 dark:text-red-400">{nameError}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-description">{t('projects.description')}</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('projects.descriptionPlaceholder')}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('projects.category')}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full" aria-label={t('projects.category')}>
                <SelectValue placeholder={t('projects.noCategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                    {t('projects.noCategory')}
                  </span>
                </SelectItem>
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
