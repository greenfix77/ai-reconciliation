'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Save, Loader2, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { DEFAULT_CONFIG, ProjectDetail, ProviderItem, ReconciliationConfig } from '@/lib/types'
import { formatAmount } from '@/lib/money'

type Props = {
  project: ProjectDetail
  onChanged: () => void
}

type AiConfigResponse = {
  config?: ReconciliationConfig
  providerName?: string
  model?: string
  error?: string
  message?: string
}

/** Matching rules form + AI provider settings + AI config suggestion. */
export function ConfigPanel({ project, onChanged }: Props) {
  const { t, locale, formatNumber } = useI18n()
  const [cfg, setCfg] = useState<ReconciliationConfig>(project.config ?? DEFAULT_CONFIG)
  const [amountMajor, setAmountMajor] = useState<string>('0')
  const [saving, setSaving] = useState(false)

  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [providerId, setProviderId] = useState<string>('builtin')
  const [model, setModel] = useState<string>(project.aiModel ?? '')
  const [savingAi, setSavingAi] = useState(false)

  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<ReconciliationConfig | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)

  const parsedFiles = useMemo(() => (project.files ?? []).filter((f) => f.status === 'parsed').length, [project.files])

  // Sync local state when the project (or its config) changes (e.g. after refetch/apply)
  useEffect(() => {
    if (project.config) {
      setCfg(project.config)
      setAmountMajor(String(project.config.amountToleranceMinor / 100))
    }
    setProviderId(project.aiProviderId ?? 'builtin')
    setModel(project.aiModel ?? '')
  }, [project.id, project.config, project.aiProviderId, project.aiModel])

  // Providers list — owned by another agent; fetch defensively
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<{ providers?: ProviderItem[] } | undefined>('/api/providers')
        if (!cancelled) setProviders(Array.isArray(data?.providers) ? data.providers : [])
      } catch {
        if (!cancelled) setProviders([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const set = <K extends keyof ReconciliationConfig>(key: K, value: ReconciliationConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }))

  const saveConfig = async () => {
    setSaving(true)
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: 'PATCH', json: { config: cfg } })
      toast.success(t('projects.configSaved'))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const saveAiSettings = async () => {
    setSavingAi(true)
    try {
      await apiFetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        json: { aiProviderId: providerId === 'builtin' ? null : providerId, aiModel: model.trim() || null },
      })
      toast.success(t('projects.aiSettingsSaved'))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSavingAi(false)
    }
  }

  const requestSuggestion = async () => {
    if (parsedFiles === 0) {
      toast.info(t('projects.aiSuggestNeedFiles'))
      return
    }
    setSuggesting(true)
    try {
      const data = await apiFetch<AiConfigResponse>(`/api/projects/${project.id}/ai-config`, { method: 'POST' })
      if (data?.config) {
        setSuggestion(data.config)
        setSuggestOpen(true)
      } else {
        toast.error(data?.message || t('projects.aiFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.aiFailed'))
    } finally {
      setSuggesting(false)
    }
  }

  const applySuggestion = async () => {
    if (!suggestion) return
    setSaving(true)
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: 'PATCH', json: { config: suggestion } })
      setCfg(suggestion)
      setAmountMajor(String(suggestion.amountToleranceMinor / 100))
      toast.success(t('projects.aiApplied'))
      setSuggestOpen(false)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const toggles: { key: keyof ReconciliationConfig; label: string }[] = [
    { key: 'requireExactDate', label: t('projects.requireExactDate') },
    { key: 'useDescriptionMatching', label: t('projects.useDescriptionMatching') },
    { key: 'useReferenceMatching', label: t('projects.useReferenceMatching') },
    { key: 'allowOneToMany', label: t('projects.allowOneToMany') },
    { key: 'allowManyToOne', label: t('projects.allowManyToOne') },
    { key: 'detectDuplicates', label: t('projects.detectDuplicates') },
  ]

  const clampNum = (raw: string, min: number, max: number): number =>
    Math.min(max, Math.max(min, Math.round(Number(raw) || 0)))

  return (
    <div className="flex flex-col gap-4">
      {/* AI suggestion banner */}
      <Card className="card-soft rounded-2xl border bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('projects.aiSuggest')}</p>
              <p className="text-xs text-muted-foreground">{t('projects.configDesc')}</p>
            </div>
          </div>
          <Button onClick={requestSuggestion} disabled={suggesting} size="sm">
            {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t('projects.aiSuggest')}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Matching rules */}
        <Card className="card-soft rounded-2xl border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('projects.configTitle')}</CardTitle>
            <CardDescription>{t('projects.configDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>{t('projects.matchDirection')}</Label>
              <Select value={cfg.matchDirection} onValueChange={(v) => set('matchDirection', v as ReconciliationConfig['matchDirection'])}>
                <SelectTrigger className="w-full" aria-label={t('projects.matchDirection')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opposite">{t('projects.matchDirection.opposite')}</SelectItem>
                  <SelectItem value="same">{t('projects.matchDirection.same')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="amount-tolerance">{t('projects.amountTolerance')}</Label>
                <Input
                  id="amount-tolerance"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amountMajor}
                  onChange={(e) => {
                    setAmountMajor(e.target.value)
                    const minor = Math.round((Number(e.target.value) || 0) * 100)
                    set('amountToleranceMinor', Math.min(100000, Math.max(0, minor)))
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('projects.amountToleranceHint', { amount: formatAmount(cfg.amountToleranceMinor, locale) })}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="date-tolerance">
                  {t('projects.dateTolerance')} <span className="text-xs text-muted-foreground">({t('projects.days')})</span>
                </Label>
                <Input
                  id="date-tolerance"
                  type="number"
                  min={0}
                  max={365}
                  value={cfg.dateToleranceDays}
                  onChange={(e) => set('dateToleranceDays', clampNum(e.target.value, 0, 365))}
                />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-4">
              {toggles.map((toggle) => (
                <div key={toggle.key} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`cfg-${toggle.key}`} className="cursor-pointer text-sm font-normal">
                    {toggle.label}
                  </Label>
                  <Switch
                    id={`cfg-${toggle.key}`}
                    checked={Boolean(cfg[toggle.key])}
                    onCheckedChange={(checked) => set(toggle.key, checked as never)}
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="min-confidence">{t('projects.minAutoConfidence')}</Label>
                <span className="text-sm font-medium tabular-nums text-primary">{formatNumber(Math.round(cfg.minAutoConfidence * 100))}%</span>
              </div>
              <Slider
                id="min-confidence"
                min={0}
                max={100}
                step={1}
                value={[Math.round(cfg.minAutoConfidence * 100)]}
                onValueChange={(values) => set('minAutoConfidence', (values[0] ?? 65) / 100)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-batch">
                {t('projects.aiBatchSize')} <span className="text-xs text-muted-foreground">({t('projects.transactionsUnit')} 5–100)</span>
              </Label>
              <Input
                id="ai-batch"
                type="number"
                min={5}
                max={100}
                value={cfg.aiBatchSize}
                onChange={(e) => set('aiBatchSize', clampNum(e.target.value, 5, 100))}
                className="w-32"
              />
            </div>

            <Button onClick={saveConfig} disabled={saving} className="self-start">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('common.save')}
            </Button>
          </CardContent>
        </Card>

        {/* AI provider settings */}
        <Card className="card-soft h-fit rounded-2xl border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" />
              {t('projects.aiSection')}
            </CardTitle>
            <CardDescription>{t('projects.aiProvider')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t('projects.aiProvider')}</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger className="w-full" aria-label={t('projects.aiProvider')}>
                  <SelectValue placeholder={t('projects.aiProviderDefault')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builtin">{t('projects.aiProviderDefault')}</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-model">{t('projects.aiModel')}</Label>
              <Input
                id="ai-model"
                dir="ltr"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t('projects.aiModelPlaceholder')}
                maxLength={120}
              />
            </div>
            <Button onClick={saveAiSettings} disabled={savingAi} variant="outline" className="self-start">
              {savingAi && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* AI suggestion dialog */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('projects.aiSuggestTitle')}
            </DialogTitle>
            <DialogDescription>{t('projects.aiSuggestDesc')}</DialogDescription>
          </DialogHeader>
          {suggestion && (
            <div className="flex max-h-80 flex-col gap-2.5 overflow-y-auto rounded-xl border bg-muted/30 p-4 text-sm">
              <Row label={t('projects.matchDirection')} value={t(`projects.matchDirection.${suggestion.matchDirection}`)} />
              <Row label={t('projects.amountTolerance')} value={formatAmount(suggestion.amountToleranceMinor, locale)} />
              <Row label={t('projects.dateTolerance')} value={`${formatNumber(suggestion.dateToleranceDays)} ${t('projects.days')}`} />
              {toggles.map((toggle) => (
                <Row key={toggle.key} label={toggle.label} value={suggestion[toggle.key] ? t('common.yes') : t('common.no')} />
              ))}
              <Row label={t('projects.minAutoConfidence')} value={`${formatNumber(Math.round(suggestion.minAutoConfidence * 100))}%`} />
              <Row label={t('projects.aiBatchSize')} value={formatNumber(suggestion.aiBatchSize)} />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSuggestOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={applySuggestion} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('projects.aiApply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
