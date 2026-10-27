'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { PublicUser } from '@/lib/types'
import { ProfileCard } from '@/components/settings/profile-card'
import { AppearanceCard } from '@/components/settings/appearance-card'
import { TemplatesCard } from '@/components/settings/templates-card'
import { SecurityCard } from '@/components/settings/security-card'

const PWD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,72}$/

/** Self-service password change (POST /api/auth/change-password) — added by agent 5-b. */
function PasswordChangeCard() {
  const { t } = useI18n()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const valid = current.length >= 1 && PWD_RE.test(next) && next === confirm

  const submit = async () => {
    if (!valid || saving) return
    if (next !== confirm) {
      toast.error(t('admin.selfPwd.mismatch'))
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/auth/change-password', { method: 'POST', json: { currentPassword: current, newPassword: next } })
      toast.success(t('admin.selfPwd.changed'))
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.networkError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card-soft rounded-2xl border bg-card p-5" aria-labelledby="settings-pwd-title">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 id="settings-pwd-title" className="text-sm font-bold">{t('admin.selfPwd.title')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('admin.selfPwd.desc')}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor="pwd-current" className="text-xs font-medium">{t('admin.selfPwd.current')}</label>
          <Input id="pwd-current" dir="ltr" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="pwd-next" className="text-xs font-medium">{t('admin.selfPwd.new')}</label>
          <Input id="pwd-next" dir="ltr" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="pwd-confirm" className="text-xs font-medium">{t('admin.selfPwd.confirm')}</label>
          <Input id="pwd-confirm" dir="ltr" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t('admin.selfPwd.hint')}</p>

      <div className="mt-3 border-t pt-3">
        <Button onClick={submit} disabled={!valid || saving} className="gap-1.5">
          <KeyRound className="h-4 w-4" />
          {saving ? t('common.loading') : t('admin.selfPwd.submit')}
        </Button>
      </div>
    </section>
  )
}

export function SettingsView({
  user,
  onUserUpdate,
}: {
  user: PublicUser
  onUserUpdate: (u: PublicUser) => void
}) {
  const { t } = useI18n()

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileCard user={user} onUserUpdate={onUserUpdate} />
        <AppearanceCard user={user} onUserUpdate={onUserUpdate} />
      </div>

      <TemplatesCard />

      <PasswordChangeCard />

      <SecurityCard />
    </div>
  )
}
