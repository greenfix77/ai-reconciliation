'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Plus, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProvidersEmptyState } from '@/components/providers/providers-empty-state'
import { ProviderCard } from '@/components/providers/provider-card'
import { ProviderFormDialog } from '@/components/providers/provider-form-dialog'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { ProviderItem } from '@/lib/types'

export function ProvidersView() {
  const { t } = useI18n()
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProviderItem | null>(null)
  const [banner, setBanner] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ providers: ProviderItem[] }>('/api/providers')
      setProviders(data.providers)
    } catch {
      // silent — view shows empty state on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (provider: ProviderItem) => {
    setEditing(provider)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight">{t('providers.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('providers.subtitle')}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          {t('providers.addProvider')}
        </Button>
      </div>

      {/* Post-test success banner */}
      {banner && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t('providers.testReadyBanner')}</span>
          <button
            onClick={() => setBanner(false)}
            className="rounded p-1 transition-colors hover:bg-emerald-500/10"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Built-in AI card (gradient blue border) */}
      <div className="rounded-2xl bg-gradient-to-l from-blue-600 via-sky-500 to-blue-700 p-[1.5px]">
        <div className="flex items-start gap-3 rounded-[calc(1rem-0.5px)] bg-card p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold">{t('providers.builtInTitle')}</h2>
              <Badge className="gap-1 border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t('providers.builtInBadge')}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('providers.builtInDesc')}</p>
          </div>
        </div>
      </div>

      {/* Provider list */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : providers.length === 0 ? (
        <ProvidersEmptyState onAdd={openAdd} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onChanged={() => void load()}
              onEdit={openEdit}
              onTested={(ok) => setBanner(ok)}
            />
          ))}
        </div>
      )}

      <ProviderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={editing}
        onSaved={() => void load()}
      />
    </div>
  )
}
