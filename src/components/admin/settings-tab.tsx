'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Save, UserRoundPlus, Users } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { AdminErrorState } from './shared'

type PlatformSettings = { registrationOpen: boolean; defaultMaxProjects: number; defaultDailyAiLimit: number }

/** تنظیمات — registration switch + platform default quotas. */
export function SettingsTab({ active, refreshSignal }: { active: boolean; refreshSignal: number }) {
  const { t } = useI18n()

  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [error, setError] = useState(false)
  const [toggling, setToggling] = useState(false)

  const [maxProjects, setMaxProjects] = useState('')
  const [dailyAiLimit, setDailyAiLimit] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ settings: PlatformSettings }>('/api/admin/settings')
      setSettings(data.settings)
      setMaxProjects(String(data.settings.defaultMaxProjects))
      setDailyAiLimit(String(data.settings.defaultDailyAiLimit))
      setError(false)
    } catch (e) {
      const s = (e as { status?: number }).status
      if (s === 401) return
      setError(true)
    }
  }, [])

  // Fetch on first activation; the scheduled-load identity guard prevents refetching
  // on tab re-activation (per-tab cache). Deferred to avoid sync setState cascades.
  const scheduledLoadRef = useRef<typeof load | null>(null)
  useEffect(() => {
    if (!active || scheduledLoadRef.current === load) return
    scheduledLoadRef.current = load
    const h = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(h)
  }, [active, load])

  const seenSignalRef = useRef(refreshSignal)
  useEffect(() => {
    if (refreshSignal === seenSignalRef.current) return
    seenSignalRef.current = refreshSignal
    if (active && scheduledLoadRef.current !== null) {
      const h = setTimeout(() => { void load() }, 0)
      return () => clearTimeout(h)
    }
  }, [refreshSignal, active, load])

  const toggleRegistration = async (open: boolean) => {
    if (!settings || toggling) return
    const prev = settings.registrationOpen
    setSettings({ ...settings, registrationOpen: open }) // optimistic
    setToggling(true)
    try {
      const data = await apiFetch<{ settings: PlatformSettings }>('/api/admin/settings', { method: 'PUT', json: { registrationOpen: open } })
      setSettings(data.settings)
      toast.success(t('admin.settings.registrationUpdated'))
    } catch (err) {
      setSettings({ ...settings, registrationOpen: prev }) // revert
      toast.error(err instanceof Error ? err.message : t('common.networkError'))
    } finally {
      setToggling(false)
    }
  }

  const saveDefaults = async () => {
    if (saving) return
    const mp = Math.min(10000, Math.max(0, Math.floor(Number(maxProjects) || 0)))
    const ai = Math.min(100000, Math.max(0, Math.floor(Number(dailyAiLimit) || 0)))
    setSaving(true)
    try {
      const data = await apiFetch<{ settings: PlatformSettings }>('/api/admin/settings', {
        method: 'PUT',
        json: { defaultMaxProjects: mp, defaultDailyAiLimit: ai },
      })
      setSettings(data.settings)
      setMaxProjects(String(data.settings.defaultMaxProjects))
      setDailyAiLimit(String(data.settings.defaultDailyAiLimit))
      toast.success(t('admin.settings.saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.networkError'))
    } finally {
      setSaving(false)
    }
  }

  if (error && !settings) {
    return <AdminErrorState onRetry={() => void load()} />
  }

  if (!settings) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 lg:grid-cols-2">
      {/* Registration */}
      <section aria-labelledby="adm-reg-title" className="card-soft rounded-2xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserRoundPlus className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="adm-reg-title" className="text-sm font-bold">{t('admin.settings.registrationTitle')}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('admin.settings.registrationDesc')}</p>
          </div>
          <Switch
            checked={settings.registrationOpen}
            onCheckedChange={(v) => void toggleRegistration(v)}
            disabled={toggling}
            aria-label={t('admin.settings.registrationOpen')}
          />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">{t('admin.settings.registrationOpen')}</span>
          <span className={settings.registrationOpen ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-red-600 dark:text-red-400'}>
            {settings.registrationOpen ? t('admin.users.status.active') : t('admin.users.status.disabled')}
          </span>
        </div>
        {!settings.registrationOpen && (
          <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs font-bold">{t('common.warning')}</AlertTitle>
            <AlertDescription className="text-xs">{t('admin.settings.registrationClosedWarn')}</AlertDescription>
          </Alert>
        )}
      </section>

      {/* Default quotas */}
      <section aria-labelledby="adm-quota-title" className="card-soft rounded-2xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="adm-quota-title" className="text-sm font-bold">{t('admin.settings.quotasTitle')}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('admin.settings.quotasDesc')}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="adm-def-mp">{t('admin.settings.defaultMaxProjects')}</Label>
            <Input id="adm-def-mp" dir="ltr" type="number" min={0} max={10000} value={maxProjects} onChange={(e) => setMaxProjects(e.target.value)} className="tnum" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-def-ai">{t('admin.settings.defaultDailyAi')}</Label>
            <Input id="adm-def-ai" dir="ltr" type="number" min={0} max={100000} value={dailyAiLimit} onChange={(e) => setDailyAiLimit(e.target.value)} className="tnum" />
          </div>
        </div>
        <Button onClick={saveDefaults} disabled={saving} className="mt-4 gap-1.5">
          <Save className="h-4 w-4" />
          {saving ? t('common.loading') : t('common.save')}
        </Button>
      </section>
    </div>
  )
}
