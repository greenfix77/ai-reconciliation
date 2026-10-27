'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Activity, Bot, BrainCircuit, FolderClosed, Gem, KeyRound, Plug, Plus, Sparkles, Trash2 } from 'lucide-react'
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
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AdminProvider, AdminUserDetail, RoleBadge, UserStatusBadge } from './shared'
import { ProjectStatusBadge } from '@/components/projects/helpers'

const PROVIDER_TYPE_ICONS: Record<string, typeof Bot> = {
  openai: Bot,
  anthropic: BrainCircuit,
  gemini: Gem,
  custom: Plug,
}

/** جزئیات کاربر — full oversight dialog: profile, quotas, providers, projects, activity. */
export function UserDetailDialog({
  userId,
  open,
  onOpenChange,
  onChanged,
}: {
  userId: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onChanged: () => void
}) {
  const { t, formatNumber, formatDate } = useI18n()
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<AdminProvider | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!userId) return
    try {
      const data = await apiFetch<AdminUserDetail>(`/api/admin/users/${userId}`)
      setDetail(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.networkError'))
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }, [userId, onOpenChange, t])

  useEffect(() => {
    if (!open || !userId) {
      setDetail(null)
      setAddOpen(false)
      setProviderToDelete(null)
      return
    }
    void fetchDetail()
  }, [open, userId, fetchDetail])

  const u = detail?.user

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('admin.detail.title')}
          </DialogTitle>
          <DialogDescription>{u ? <>{u.name} · <bdi dir="ltr">{u.email}</bdi></> : '…'}</DialogDescription>
        </DialogHeader>

        {loading || !detail || !u ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Profile */}
            <section aria-label={t('admin.detail.profile')} className="rounded-xl border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                <InfoCell label={t('admin.detail.role')}><RoleBadge role={u.role} /></InfoCell>
                <InfoCell label={t('admin.detail.status')}><UserStatusBadge status={u.status} /></InfoCell>
                <InfoCell label={t('admin.detail.createdAt')}>{formatDate(u.createdAt)}</InfoCell>
                <InfoCell label={t('admin.detail.lastLogin')}>{u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}</InfoCell>
                <InfoCell label={t('admin.detail.locale')}>{u.locale}</InfoCell>
                <InfoCell label={t('admin.detail.theme')}>{u.theme}</InfoCell>
                <InfoCell label={t('admin.detail.currency')}>{u.currency}</InfoCell>
                <InfoCell label={t('admin.detail.aiToday')}>
                  <span className="font-bold tnum text-primary">{formatNumber(detail.aiToday)}</span>
                </InfoCell>
                <InfoCell label={t('admin.detail.quotas')}>
                  <span className="tnum">
                    {t('admin.quota.maxProjects')}: <bdi>{u.maxProjects ?? t('admin.users.default')}</bdi> · {t('admin.quota.dailyAi')}: <bdi>{u.dailyAiLimit ?? t('admin.users.default')}</bdi>
                  </span>
                </InfoCell>
                <InfoCell label={t('admin.detail.lockInfo')}>
                  <span className="tnum">{formatNumber(u.failedAttempts)}</span>
                  {u.lockedUntil && <span className="ms-1 text-amber-600 dark:text-amber-400">· {t('admin.detail.lockedUntil')} {formatDate(u.lockedUntil)}</span>}
                </InfoCell>
                {u.disabledAt && <InfoCell label={t('admin.detail.disabledAt')}>{formatDate(u.disabledAt)}</InfoCell>}
              </div>
            </section>

            {/* Providers */}
            <section aria-label={t('admin.detail.providers')}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold">{t('admin.detail.providers')}</h3>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setAddOpen((v) => !v)}>
                  <Plus className="h-3.5 w-3.5" />
                  {t('admin.detail.addProvider')}
                </Button>
              </div>
              {addOpen && (
                <AddProviderForm
                  userId={u.id}
                  onDone={async () => {
                    setAddOpen(false)
                    await fetchDetail()
                    onChanged()
                  }}
                  onCancel={() => setAddOpen(false)}
                />
              )}
              {detail.providers.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t('admin.detail.providersEmpty')}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detail.providers.map((p) => {
                    const Icon = PROVIDER_TYPE_ICONS[p.type] ?? Plug
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-xs">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{p.name}</span>
                            <Badge variant="secondary" className="border-transparent bg-muted text-[10px]">{t(`providers.type.${p.type}`)}</Badge>
                            {p.isDefault && <Badge variant="secondary" className="border-transparent bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400">{t('admin.detail.providerDefault')}</Badge>}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-muted-foreground">
                            <span dir="ltr" className="font-mono">{p.keyHint}</span>
                            {p.baseUrl && <span dir="ltr" className="max-w-48 truncate font-mono text-[10px]">{p.baseUrl}</span>}
                          </div>
                          {p.models.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {p.models.slice(0, 4).map((m) => (
                                <Badge key={m} variant="outline" dir="ltr" className="rounded-full font-mono text-[10px]">{m}</Badge>
                              ))}
                              {p.models.length > 4 && <Badge variant="outline" dir="ltr" className="rounded-full font-mono text-[10px]">+{p.models.length - 4}</Badge>}
                            </div>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ms-auto h-8 w-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                          onClick={() => setProviderToDelete(p)}
                          aria-label={t('admin.detail.providerDeleteTitle')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <Separator />

            {/* Projects */}
            <section aria-label={t('admin.detail.projects')}>
              <h3 className="text-sm font-bold">{t('admin.detail.projects')}</h3>
              {detail.projects.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t('admin.detail.projectsEmpty')}</p>
              ) : (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border">
                  <table className="w-full min-w-[420px] text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="text-muted-foreground">
                        <th className="p-2 text-start font-medium">{t('admin.projects.col.name')}</th>
                        <th className="p-2 text-start font-medium">{t('common.status')}</th>
                        <th className="p-2 text-start font-medium">{t('admin.detail.files')}</th>
                        <th className="p-2 text-start font-medium">{t('admin.detail.recons')}</th>
                        <th className="p-2 text-start font-medium">{t('admin.projects.col.updated')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.projects.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="max-w-44 truncate p-2 font-medium" title={p.name}>
                            <span className="inline-flex items-center gap-1.5">
                              <FolderClosed className="h-3.5 w-3.5 text-muted-foreground" />
                              {p.name}
                            </span>
                          </td>
                          <td className="p-2"><ProjectStatusBadge status={p.status} /></td>
                          <td className="p-2 tnum text-muted-foreground">{formatNumber(p._count.files)}</td>
                          <td className="p-2 tnum text-muted-foreground">{formatNumber(p._count.reconciliations)}</td>
                          <td className="p-2 whitespace-nowrap text-muted-foreground">{formatDate(p.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <Separator />

            {/* Recent activity */}
            <section aria-label={t('admin.detail.activity')}>
              <h3 className="text-sm font-bold">{t('admin.detail.activity')}</h3>
              {detail.recentActivity.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t('admin.detail.activityEmpty')}</p>
              ) : (
                <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto rounded-xl border p-2">
                  {detail.recentActivity.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/50">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Activity className="h-3.5 w-3.5" />
                      </span>
                      <span dir="ltr" className="font-mono text-[11px] font-medium">{a.action}</span>
                      {a.entityType && <span dir="ltr" className="text-muted-foreground">({a.entityType})</span>}
                      {a.ip && <span dir="ltr" className="font-mono text-[10px] text-muted-foreground">{a.ip}</span>}
                      <span className="ms-auto shrink-0 text-[10px] text-muted-foreground">{formatDate(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>

      {/* Provider delete confirm */}
      <AlertDialog open={providerToDelete !== null} onOpenChange={(o) => !o && setProviderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.detail.providerDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.detail.providerDeleteBody', { name: providerToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={async () => {
                if (!providerToDelete || !userId) return
                const pid = providerToDelete.id
                try {
                  await apiFetch(`/api/admin/users/${userId}/providers/${pid}`, { method: 'DELETE' })
                  toast.success(t('admin.detail.providerDeleted'))
                  setProviderToDelete(null)
                  await fetchDetail()
                  onChanged()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t('common.networkError'))
                }
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px]">{children}</div>
    </div>
  )
}

// ---------- Add provider form ----------

function AddProviderForm({ userId, onDone, onCancel }: { userId: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [type, setType] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const modelList = models.split(',').map((m) => m.trim()).filter(Boolean)
  const valid = name.trim().length >= 1 && apiKey.trim().length >= 8 && modelList.length > 0 && modelList.length <= 20 && (baseUrl.trim() === '' || /^https:\/\/\S+$/i.test(baseUrl.trim()))

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      await apiFetch(`/api/admin/users/${userId}/providers`, {
        method: 'POST',
        json: {
          name: name.trim(),
          type,
          baseUrl: baseUrl.trim() || undefined,
          apiKey: apiKey.trim(),
          models: modelList,
          isDefault,
        },
      })
      toast.success(t('admin.detail.providerAdded'))
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.networkError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('mt-2 grid gap-2.5 rounded-xl border bg-muted/30 p-3')}>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="grid gap-1.5">
          <Label htmlFor="adm-prov-name">{t('admin.detail.providerName')}</Label>
          <Input id="adm-prov-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>{t('admin.detail.providerType')}</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label={t('admin.detail.providerType')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">{t('providers.type.openai')}</SelectItem>
              <SelectItem value="anthropic">{t('providers.type.anthropic')}</SelectItem>
              <SelectItem value="gemini">{t('providers.type.gemini')}</SelectItem>
              <SelectItem value="custom">{t('providers.type.custom')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adm-prov-url">{t('admin.detail.providerUrl')}</Label>
          <Input id="adm-prov-url" dir="ltr" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adm-prov-key">{t('admin.detail.providerKey')}</Label>
          <Input id="adm-prov-key" dir="ltr" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="adm-prov-models">{t('admin.detail.providerModels')}</Label>
        <Input id="adm-prov-models" dir="ltr" value={models} onChange={(e) => setModels(e.target.value)} placeholder="gpt-4o-mini, gpt-4o" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={isDefault} onCheckedChange={setIsDefault} aria-label={t('admin.detail.providerDefault')} />
          {t('admin.detail.providerDefault')}
        </label>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={submit} disabled={!valid || saving} className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            {saving ? t('common.loading') : t('common.add')}
          </Button>
        </div>
      </div>
    </div>
  )
}
