'use client'

import { Bot, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

export function ProvidersEmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n()
  return (
    <div className="card-soft flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <Bot className="h-7 w-7" />
      </div>
      <h3 className="text-sm font-bold">{t('providers.emptyTitle')}</h3>
      <p className="max-w-sm text-xs leading-5 text-muted-foreground">{t('providers.emptyDesc')}</p>
      <Button onClick={onAdd} size="sm" className="mt-1 gap-1.5 bg-blue-600 hover:bg-blue-700">
        <Plus className="h-4 w-4" />
        {t('providers.addProvider')}
      </Button>
    </div>
  )
}
