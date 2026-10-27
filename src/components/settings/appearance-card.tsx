'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Loader2, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import { PublicUser } from '@/lib/types'
import { cn } from '@/lib/utils'

type ThemeOption = 'light' | 'dark' | 'system'
type Currency = 'IRR' | 'IRT' | 'USD'

const THEME_OPTIONS: { value: ThemeOption; icon: typeof Sun; labelKey: string }[] = [
  { value: 'light', icon: Sun, labelKey: 'settings.themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'settings.themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'settings.themeSystem' },
]

export function AppearanceCard({
  user,
  onUserUpdate,
}: {
  user: PublicUser
  onUserUpdate: (u: PublicUser) => void
}) {
  const { t, locale, setLocale } = useI18n()
  const storeSetTheme = useAppStore((s) => s.setTheme)
  const storeSetLocale = useAppStore((s) => s.setLocale)
  const { setTheme: nextSetTheme } = useTheme()
  const [currency, setCurrency] = useState<string>(user.currency || 'IRR')
  const [savingCurrency, setSavingCurrency] = useState(false)

  const patchProfile = async (json: Record<string, unknown>, successMsg: string) => {
    try {
      const data = await apiFetch<{ user: PublicUser }>('/api/auth/me', { method: 'PATCH', json })
      onUserUpdate(data.user)
      toast.success(successMsg)
    } catch (err) {
      toast.error((err as Error).message || t('common.networkError'))
    }
  }

  const changeTheme = (value: string) => {
    const theme = value as ThemeOption
    storeSetTheme(theme)
    nextSetTheme(theme) // immediate visual effect (shell reads next-themes)
    void patchProfile({ theme }, t('settings.appearanceSaved'))
  }

  const changeLanguage = (value: string) => {
    const next = value as 'fa' | 'en'
    storeSetLocale(next)
    setLocale(next)
    void patchProfile({ locale: next }, t('settings.appearanceSaved'))
  }

  const changeCurrency = async (value: string) => {
    setCurrency(value)
    setSavingCurrency(true)
    await patchProfile({ currency: value }, t('settings.appearanceSaved'))
    setSavingCurrency(false)
  }

  return (
    <section className="card-soft rounded-2xl border bg-card p-5" aria-labelledby="settings-appearance-title">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <Palette className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 id="settings-appearance-title" className="text-sm font-bold">{t('settings.appearance')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('settings.appearanceDesc')}</p>
        </div>
      </div>

      <div className="mt-4 space-y-5">
        {/* Theme */}
        <div className="space-y-2">
          <Label>{t('settings.theme')}</Label>
          <RadioGroup
            value={user.theme as ThemeOption}
            onValueChange={changeTheme}
            className="grid grid-cols-3 gap-2"
          >
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <Label
                  key={opt.value}
                  htmlFor={`theme-${opt.value}`}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors',
                    'hover:bg-muted/60 has-[button[data-state=checked]]:border-blue-500 has-[button[data-state=checked]]:bg-blue-500/5 has-[button[data-state=checked]]:text-blue-600 dark:has-[button[data-state=checked]]:text-blue-400'
                  )}
                >
                  <RadioGroupItem id={`theme-${opt.value}`} value={opt.value} className="sr-only" />
                  <Icon className="h-4 w-4" />
                  {t(opt.labelKey)}
                </Label>
              )
            })}
          </RadioGroup>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label>{t('settings.language')}</Label>
          <RadioGroup
            value={locale}
            onValueChange={changeLanguage}
            className="grid grid-cols-2 gap-2"
          >
            <Label
              htmlFor="lang-fa"
              className={cn(
                'flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors',
                'hover:bg-muted/60 has-[button[data-state=checked]]:border-blue-500 has-[button[data-state=checked]]:bg-blue-500/5 has-[button[data-state=checked]]:text-blue-600 dark:has-[button[data-state=checked]]:text-blue-400'
              )}
            >
              <RadioGroupItem id="lang-fa" value="fa" className="sr-only" />
              {t('settings.languageFa')}
            </Label>
            <Label
              htmlFor="lang-en"
              className={cn(
                'flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors',
                'hover:bg-muted/60 has-[button[data-state=checked]]:border-blue-500 has-[button[data-state=checked]]:bg-blue-500/5 has-[button[data-state=checked]]:text-blue-600 dark:has-[button[data-state=checked]]:text-blue-400'
              )}
            >
              <RadioGroupItem id="lang-en" value="en" className="sr-only" />
              {t('settings.languageEn')}
            </Label>
          </RadioGroup>
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label htmlFor="currency-select">{t('settings.currency')}</Label>
          <div className="flex items-center gap-2">
            <Select value={currency} onValueChange={changeCurrency}>
              <SelectTrigger id="currency-select" className="w-full sm:w-56" disabled={savingCurrency}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IRR">{t('settings.currency.IRR')}</SelectItem>
                <SelectItem value="IRT">{t('settings.currency.IRT')}</SelectItem>
                <SelectItem value="USD">{t('settings.currency.USD')}</SelectItem>
              </SelectContent>
            </Select>
            {savingCurrency && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </div>
    </section>
  )
}
