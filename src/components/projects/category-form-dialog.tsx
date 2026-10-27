'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { CategoryItem } from '@/lib/types'
import { cn } from '@/lib/utils'

export const PRESET_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316'] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set → edit mode (PATCH), otherwise create (POST) */
  category?: CategoryItem | null
  onSaved: () => void
}

/** Inline create/edit category dialog with 8 preset colors. */
export function CategoryFormDialog({ open, onOpenChange, category, onSaved }: Props) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '')
      setColor(category?.color ?? PRESET_COLORS[0])
      setNameError(null)
    }
  }, [open, category])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(t('projects.cat.nameRequired'))
      return
    }
    setSaving(true)
    try {
      if (category) {
        await apiFetch(`/api/categories/${category.id}`, { method: 'PATCH', json: { name: trimmed, color } })
        toast.success(t('projects.cat.updated'))
      } else {
        await apiFetch('/api/categories', { method: 'POST', json: { name: trimmed, color } })
        toast.success(t('projects.cat.created'))
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? t('projects.cat.edit') : t('projects.cat.add')}</DialogTitle>
          <DialogDescription className="sr-only">{t('projects.cat.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">{t('projects.cat.name')} *</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(null) }}
              placeholder={t('projects.cat.namePlaceholder')}
              maxLength={60}
              autoFocus
              aria-invalid={!!nameError}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
            />
            {nameError && <p className="text-xs text-red-600 dark:text-red-400">{nameError}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('projects.cat.color')}</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`color ${preset}`}
                  aria-pressed={color === preset}
                  onClick={() => setColor(preset)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    color === preset && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                  )}
                  style={{ backgroundColor: preset }}
                >
                  {color === preset && <Check className="h-4 w-4 text-white drop-shadow" />}
                </button>
              ))}
            </div>
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
