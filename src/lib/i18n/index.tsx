'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Locale } from '../types'
import { BASE_DICT, Dict } from './base'
import { DASHBOARD_DICT } from './dicts/dashboard'
import { PROJECTS_DICT } from './dicts/projects'
import { PROVIDERS_DICT } from './dicts/providers'
import { SETTINGS_DICT } from './dicts/settings'
import { REPORTS_DICT } from './dicts/reports'
import { RESULTS_DICT } from './dicts/results'
import { AITOOLS_DICT } from './dicts/aitools'
import { HELP_DICT } from './dicts/help'
import { ADMIN_DICT } from './dicts/admin'

export const LOCALES: Locale[] = ['fa', 'en']

const MERGED: Record<Locale, Dict> = {
  fa: { ...BASE_DICT.fa, ...DASHBOARD_DICT.fa, ...PROJECTS_DICT.fa, ...PROVIDERS_DICT.fa, ...SETTINGS_DICT.fa, ...REPORTS_DICT.fa, ...RESULTS_DICT.fa, ...AITOOLS_DICT.fa, ...HELP_DICT.fa, ...ADMIN_DICT.fa },
  en: { ...BASE_DICT.en, ...DASHBOARD_DICT.en, ...PROJECTS_DICT.en, ...PROVIDERS_DICT.en, ...SETTINGS_DICT.en, ...REPORTS_DICT.en, ...RESULTS_DICT.en, ...AITOOLS_DICT.en, ...HELP_DICT.en, ...ADMIN_DICT.en },
}

type I18nContextValue = {
  locale: Locale
  dir: 'rtl' | 'ltr'
  t: (key: string, params?: Record<string, string | number>) => string
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string
  formatDate: (d: Date | string | null | undefined) => string
  setLocale: (l: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ locale, setLocale, children }: { locale: Locale; setLocale: (l: Locale) => void; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const dict = MERGED[locale] ?? MERGED.fa
    const t = (key: string, params?: Record<string, string | number>) => {
      let str = dict[key] ?? BASE_DICT[locale]?.[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) str = str.replaceAll(`{${k}}`, String(v))
      }
      return str
    }
    return {
      locale,
      dir: locale === 'fa' ? 'rtl' : 'ltr',
      t,
      formatNumber: (n, opts) => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', opts).format(n),
      formatDate: (d) => {
        if (!d) return '—'
        const date = typeof d === 'string' ? new Date(d) : d
        if (Number.isNaN(date.getTime())) return '—'
        try {
          return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
        } catch {
          return date.toISOString().slice(0, 10)
        }
      },
      setLocale,
    }
  }, [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
