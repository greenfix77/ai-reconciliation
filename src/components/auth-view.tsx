'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { PublicUser } from '@/lib/types'
import { apiFetch } from '@/lib/api-client'
import { LogoMark } from '@/components/shell/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ShieldCheck, BrainCircuit, FileCheck2, Loader2, Eye, EyeOff, CheckCheck } from 'lucide-react'

export function AuthView({ onAuthed }: { onAuthed: (user: PublicUser) => void }) {
  const { t, locale } = useI18n()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errorKey, setErrorKey] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorKey(null)
    if (mode === 'register') {
      if (form.password !== form.confirm) {
        toast.error(locale === 'fa' ? 'گذرواژه‌ها یکسان نیستند' : 'Passwords do not match')
        return
      }
      if (!/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password) || form.password.length < 8) {
        toast.error(t('auth.passwordHint'))
        return
      }
    }
    setLoading(true)
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload = mode === 'login' ? { email: form.email, password: form.password } : { name: form.name, email: form.email, password: form.password }
      const data = await apiFetch<{ user: PublicUser }>(url, { method: 'POST', json: payload })
      onAuthed(data.user)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('auth.emailTaken')) setErrorKey('auth.emailTaken')
      else if (msg.includes('auth.locked')) setErrorKey('auth.locked')
      else if (msg.includes('429') || msg.toLowerCase().includes('too many')) setErrorKey(null)
      else setErrorKey('auth.loginFailed')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = () => {
    setForm({ ...form, email: 'admin@reconciliation.ir', password: 'Admin1234' })
  }

  const features = [
    { icon: BrainCircuit, label: t('auth.feature1') },
    { icon: CheckCheck, label: t('auth.feature2') },
    { icon: FileCheck2, label: t('auth.feature3') },
  ]

  return (
    <div className="flex min-h-screen" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      {/* Brand panel */}
      <div className="brand-sidebar relative hidden flex-1 flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <div>
            <div className="text-lg font-bold">{t('common.appName')}</div>
            <div className="text-xs text-white/60">{t('common.appSub')}</div>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-extrabold leading-snug">{t('auth.tagline')}</h1>
          <p className="mt-4 text-sm leading-7 text-white/70">{t('auth.loginSub')}</p>
          <div className="mt-8 space-y-4">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <f.icon className="h-5 w-5 text-sky-300" />
                <span className="text-sm">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="h-4 w-4" />
          {t('auth.secureNote')}
        </div>
        {/* decorative rings */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full border border-white/5" />
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <LogoMark className="h-12 w-12" />
            <div className="text-center">
              <div className="text-lg font-bold">{t('common.appName')}</div>
              <div className="text-xs text-muted-foreground">{t('common.appSub')}</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold">{mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{mode === 'login' ? t('auth.loginSub') : t('auth.registerSub')}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t('auth.name')}</Label>
                <Input id="name" required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('auth.namePlaceholder')} autoComplete="name" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" required dir="ltr" className="text-start" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('auth.emailPlaceholder')} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  dir="ltr"
                  className="text-start pe-10"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={t('auth.passwordPlaceholder')}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button type="button" className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'register' && <p className="text-[11px] text-muted-foreground">{t('auth.passwordHint')}</p>}
            </div>
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">{t('auth.confirmPassword')}</Label>
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  dir="ltr"
                  className="text-start"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  placeholder={t('auth.passwordPlaceholder')}
                  autoComplete="new-password"
                />
              </div>
            )}

            {errorKey && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{t(errorKey)}</div>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? t('auth.login') : t('auth.register')}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === 'login' ? (
              <>
                <span className="text-muted-foreground">{t('auth.noAccount')} </span>
                <button className="font-semibold text-primary hover:underline" onClick={() => { setMode('register'); setErrorKey(null) }}>
                  {t('auth.register')}
                </button>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">{t('auth.hasAccount')} </span>
                <button className="font-semibold text-primary hover:underline" onClick={() => { setMode('login'); setErrorKey(null) }}>
                  {t('auth.login')}
                </button>
              </>
            )}
          </div>

          {mode === 'login' && (
            <button onClick={fillDemo} className="mt-4 w-full rounded-lg border border-dashed px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
              {t('auth.demoCreds')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
