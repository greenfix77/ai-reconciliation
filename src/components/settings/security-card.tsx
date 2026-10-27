'use client'

import { Activity, Lock, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n'

const SECURITY_ROWS = [
  { icon: Lock, titleKey: 'settings.secSession', descKey: 'settings.secSessionDesc' },
  { icon: ShieldCheck, titleKey: 'settings.secEncryption', descKey: 'settings.secEncryptionDesc' },
  { icon: Activity, titleKey: 'settings.secAudit', descKey: 'settings.secAuditDesc' },
]

export function SecurityCard() {
  const { t } = useI18n()
  return (
    <section className="card-soft rounded-2xl border bg-card p-5" aria-labelledby="settings-security-title">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 id="settings-security-title" className="text-sm font-bold">{t('settings.security')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('settings.securityDesc')}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {SECURITY_ROWS.map((row) => {
          const Icon = row.icon
          return (
            <li key={row.titleKey} className="flex items-start gap-3 rounded-xl border p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{t(row.titleKey)}</div>
                <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{t(row.descKey)}</div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <Badge variant="secondary" className="gap-1">
          {t('settings.version')}: ۱.۰.۰
        </Badge>
        <Badge variant="secondary" className="gap-1">
          {t('settings.statusActive')}: <span className="font-medium text-emerald-600 dark:text-emerald-400">{t('settings.enabled')}</span>
        </Badge>
        <Badge variant="secondary" className="gap-1">
          {t('settings.encryption')}: <span className="font-medium text-emerald-600 dark:text-emerald-400">{t('settings.enabled')}</span>
        </Badge>
      </div>
    </section>
  )
}
