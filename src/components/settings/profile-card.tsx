'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { PublicUser } from '@/lib/types'

export function ProfileCard({
  user,
  onUserUpdate,
}: {
  user: PublicUser
  onUserUpdate: (u: PublicUser) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(user.name)
  }, [user.name])

  const save = async () => {
    if (saving) return
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      toast.error(t('settings.namePlaceholder'))
      return
    }
    setSaving(true)
    try {
      const data = await apiFetch<{ user: PublicUser }>('/api/auth/me', {
        method: 'PATCH',
        json: { name: trimmed },
      })
      onUserUpdate(data.user)
      toast.success(t('settings.saved'))
    } catch (err) {
      toast.error((err as Error).message || t('common.networkError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card-soft rounded-2xl border bg-card p-5" aria-labelledby="settings-profile-title">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 id="settings-profile-title" className="text-sm font-bold">{t('settings.profile')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('settings.profileDesc')}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="settings-name">{t('settings.name')}</Label>
          <Input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.namePlaceholder')}
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-email">{t('settings.email')}</Label>
          <Input
            id="settings-email"
            dir="ltr"
            value={user.email}
            disabled
            className="font-mono text-xs text-muted-foreground"
            aria-describedby="settings-email-hint"
          />
          <p id="settings-email-hint" className="text-[11px] text-muted-foreground">{t('settings.emailLocked')}</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving || name.trim() === user.name} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? t('settings.saving') : t('common.save')}
        </Button>
      </div>
    </section>
  )
}
