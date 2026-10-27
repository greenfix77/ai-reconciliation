'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Plus, ShieldCheck, X } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { ProviderItem } from '@/lib/types'

const MAX_MODELS = 20

const BASE_URL_PLACEHOLDER: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  custom: 'https://your-proxy.example.com/v1',
}

const QUICK_ADD_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-20250514'],
  gemini: ['gemini-2.0-flash'],
  custom: [],
}

export function ProviderFormDialog({
  open,
  onOpenChange,
  provider,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: ProviderItem | null
  onSaved: () => void
}) {
  const { t } = useI18n()
  const isEdit = Boolean(provider)

  const [name, setName] = useState('')
  const [type, setType] = useState<string>('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [modelInput, setModelInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (provider) {
      setName(provider.name)
      setType(provider.type)
      setBaseUrl(provider.baseUrl ?? '')
      setApiKey('')
      setModels([...provider.models])
    } else {
      setName('')
      setType('openai')
      setBaseUrl('')
      setApiKey('')
      setModels([])
    }
    setModelInput('')
    setShowKey(false)
  }, [open, provider])

  const quickAdd = useMemo(() => QUICK_ADD_MODELS[type] ?? [], [type])

  const addModel = (raw: string) => {
    const value = raw.trim()
    if (!value) return
    if (models.includes(value)) {
      setModelInput('')
      return
    }
    if (models.length >= MAX_MODELS || value.length > 120) {
      toast.error(t('providers.modelsHint'))
      return
    }
    setModels((prev) => [...prev, value])
    setModelInput('')
  }

  const removeModel = (m: string) => setModels((prev) => prev.filter((x) => x !== m))

  const handleModelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addModel(modelInput)
    }
  }

  const submit = async () => {
    if (submitting) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error(t('providers.namePlaceholder'))
      return
    }
    if (models.length === 0) {
      toast.error(t('providers.noModels'))
      return
    }
    const trimmedKey = apiKey.trim()
    if (!isEdit && trimmedKey.length < 8) {
      toast.error(t('providers.apiKeyPlaceholder'))
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = { name: trimmedName, type, models }
      const trimmedBase = baseUrl.trim()
      if (trimmedBase) payload.baseUrl = trimmedBase
      if (isEdit) {
        if (trimmedKey) payload.apiKey = trimmedKey
        await apiFetch(`/api/providers/${provider!.id}`, { method: 'PATCH', json: payload })
        toast.success(t('providers.updated'))
      } else {
        payload.apiKey = trimmedKey
        await apiFetch('/api/providers', { method: 'POST', json: payload })
        toast.success(t('providers.added'))
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message || t('common.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('providers.editProvider') : t('providers.newProvider')}</DialogTitle>
          <DialogDescription>{t('providers.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-name">{t('providers.name')}</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('providers.namePlaceholder')}
              maxLength={60}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('providers.typeLabel')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full" aria-label={t('providers.typeLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">{t('providers.type.openai')}</SelectItem>
                <SelectItem value="anthropic">{t('providers.type.anthropic')}</SelectItem>
                <SelectItem value="gemini">{t('providers.type.gemini')}</SelectItem>
                <SelectItem value="custom">{t('providers.type.custom')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-baseurl">{t('providers.baseUrl')}</Label>
            <Input
              id="provider-baseurl"
              dir="ltr"
              className="font-mono text-xs"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={BASE_URL_PLACEHOLDER[type] ?? BASE_URL_PLACEHOLDER.openai}
              maxLength={300}
              inputMode="url"
            />
            <p className="text-[11px] text-muted-foreground">{t('providers.baseUrlHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-key">{t('providers.apiKey')}</Label>
            <div className="relative">
              <Input
                id="provider-key"
                dir="ltr"
                className="pe-10 font-mono text-xs"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isEdit ? t('providers.apiKeyEditPlaceholder') : t('providers.apiKeyPlaceholder')}
                autoComplete="off"
                maxLength={400}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showKey ? t('providers.hideKey') : t('providers.showKey')}
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-models">{t('providers.models')}</Label>
            <Input
              id="provider-models"
              dir="ltr"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              onKeyDown={handleModelKeyDown}
              placeholder={t('providers.modelPlaceholder')}
              maxLength={120}
            />
            <p className="text-[11px] text-muted-foreground">{t('providers.modelsHint')}</p>

            {quickAdd.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">{t('providers.quickAdd')}</span>
                {quickAdd.map((m) => (
                  <button
                    key={m}
                    type="button"
                    dir="ltr"
                    onClick={() => addModel(m)}
                    disabled={models.includes(m)}
                    className="rounded-full border border-dashed border-blue-300 px-2 py-0.5 font-mono text-[11px] text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-40 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
                  >
                    + {m}
                  </button>
                ))}
              </div>
            )}

            {models.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {models.map((m) => (
                  <Badge key={m} variant="secondary" className="gap-1 rounded-full font-mono" dir="ltr">
                    {m}
                    <button
                      type="button"
                      onClick={() => removeModel(m)}
                      className="rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                      aria-label={`${t('common.delete')} ${m}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/70">{t('providers.noModels')}</p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-[11px] leading-5 text-emerald-700 dark:text-emerald-300">{t('providers.securityNote')}</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isEdit ? t('common.save') : t('providers.addProvider')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
