'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Crown,
  Gem,
  Loader2,
  Pencil,
  Plug,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { ProviderItem } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPE_META: Record<string, { icon: typeof Bot; chip: string }> = {
  openai: { icon: Bot, chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  anthropic: { icon: BrainCircuit, chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  gemini: { icon: Gem, chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  custom: { icon: Plug, chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  if (status === 'connected') {
    return (
      <Badge className="gap-1 border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {t('providers.status.connected')}
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge className="gap-1 border-transparent bg-red-500/10 text-red-600 dark:text-red-400">
        <XCircle className="h-3 w-3" />
        {t('providers.status.failed')}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-slate-500/10 text-slate-600 dark:text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {t('providers.status.untested')}
    </Badge>
  )
}

export function ProviderCard({
  provider,
  onChanged,
  onEdit,
  onTested,
}: {
  provider: ProviderItem
  onChanged: () => void
  onEdit: (provider: ProviderItem) => void
  onTested: (ok: boolean) => void
}) {
  const { t, formatDate, formatNumber } = useI18n()
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const meta = TYPE_META[provider.type] ?? TYPE_META.custom
  const Icon = meta.icon

  const runTest = async () => {
    if (testing) return
    setTesting(true)
    try {
      const data = await apiFetch<{ status: string; message: string; latencyMs: number }>(
        `/api/providers/${provider.id}/test`,
        { method: 'POST' }
      )
      if (data.status === 'connected') {
        toast.success(t('providers.testSuccess'), {
          description: t('providers.latency', { ms: formatNumber(data.latencyMs) }),
        })
      } else {
        toast.error(t('providers.testFailed'), { description: data.message })
      }
      onTested(data.status === 'connected')
    } catch (err) {
      toast.error(t('providers.testFailed'), { description: (err as Error).message })
      onTested(false)
    } finally {
      setTesting(false)
      onChanged()
    }
  }

  const setDefault = async () => {
    try {
      await apiFetch(`/api/providers/${provider.id}`, { method: 'PATCH', json: { isDefault: true } })
      toast.success(t('providers.defaultSet'))
      onChanged()
    } catch (err) {
      toast.error((err as Error).message || t('common.networkError'))
    }
  }

  const remove = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await apiFetch(`/api/providers/${provider.id}`, { method: 'DELETE' })
      toast.success(t('providers.deleted'))
      onChanged()
    } catch (err) {
      toast.error((err as Error).message || t('common.networkError'))
    } finally {
      setDeleting(false)
    }
  }

  const visibleModels = provider.models.slice(0, 3)
  const extraCount = provider.models.length - visibleModels.length

  return (
    <div className="card-soft flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', meta.chip)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-bold">{provider.name}</h3>
            {provider.isDefault && (
              <Badge className="gap-1 border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Crown className="h-3 w-3" />
                {t('providers.defaultBadge')}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t(`providers.type.${provider.type}`)}</span>
            <span aria-hidden>·</span>
            <StatusBadge status={provider.status} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t('providers.apiKey')}: <span dir="ltr" className="font-mono">{provider.keyHint}</span>
        </span>
        {provider.baseUrl && (
          <span dir="ltr" className="max-w-full truncate font-mono text-[11px]">{provider.baseUrl}</span>
        )}
        <span>
          {t('providers.lastTested')}: {provider.lastTestedAt ? formatDate(provider.lastTestedAt) : t('providers.neverTested')}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visibleModels.map((m) => (
          <Badge key={m} variant="secondary" dir="ltr" className="rounded-full font-mono">
            {m}
          </Badge>
        ))}
        {extraCount > 0 && (
          <Badge variant="outline" dir="ltr" className="rounded-full font-mono">
            +{extraCount}
          </Badge>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={runTest}
          disabled={testing}
          className="h-8 gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {testing ? t('providers.testing') : t('providers.testConnection')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(provider)} className="h-8 gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          {t('common.edit')}
        </Button>
        {!provider.isDefault && (
          <Button size="sm" variant="ghost" onClick={setDefault} className="h-8 gap-1.5">
            <Crown className="h-3.5 w-3.5" />
            {t('providers.setAsDefault')}
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto h-8 gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {t('common.delete')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('providers.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('providers.deleteBody', { name: provider.name })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={remove}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
