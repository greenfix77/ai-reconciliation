'use client'

import { useCallback, useEffect, useState } from 'react'
import { ThemeProvider, useTheme } from 'next-themes'
import { DirectionProvider } from '@radix-ui/react-direction'
import { Toaster } from 'sonner'
import { AuthView } from '@/components/auth-view'
import { AppShell } from '@/components/shell/app-shell'
import { DashboardView } from '@/components/views/dashboard-view'
import { ProjectsView } from '@/components/views/projects-view'
import { ProjectDetailView } from '@/components/views/project-detail-view'
import { CategoriesView } from '@/components/views/categories-view'
import { ProvidersView } from '@/components/views/providers-view'
import { SettingsView } from '@/components/views/settings-view'
import { ReportsView } from '@/components/views/reports-view'
import { AiToolsView } from '@/components/views/aitools-view'
import { HelpView } from '@/components/views/help-view'
import { AdminView } from '@/components/views/admin-view'
import { useAppStore } from '@/lib/store'
import { I18nProvider } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { PublicUser } from '@/lib/types'
import { Loader2 } from 'lucide-react'

function ThemeSync({ theme, locale }: { theme: 'light' | 'dark' | 'system'; locale: string }) {
  const { setTheme } = useTheme()
  useEffect(() => {
    setTheme(theme)
  }, [theme, setTheme])
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr'
  }, [locale])
  return null
}

export default function HomePage() {
  const [authState, setAuthState] = useState<'loading' | 'guest' | 'authed'>('loading')
  const [user, setUser] = useState<PublicUser | null>(null)
  const themeFromStore = useAppStore((s) => s.theme) as 'light' | 'dark' | 'system'
  const locale = useAppStore((s) => s.locale)
  const setLocale = useAppStore((s) => s.setLocale)
  const view = useAppStore((s) => s.view)
  const projectId = useAppStore((s) => s.projectId)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<{ user: PublicUser | null }>('/api/auth/me')
        if (!cancelled) {
          if (data.user) {
            setUser(data.user)
            setAuthState('authed')
            if (data.user.locale === 'en') setLocale('en')
          } else {
            setAuthState('guest')
          }
        }
      } catch {
        if (!cancelled) setAuthState('guest')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setLocale])

  const handleAuthed = useCallback((u: PublicUser) => {
    setUser(u)
    setAuthState('authed')
    if (u.locale === 'en') setLocale('en')
  }, [setLocale])

  const handleLogout = useCallback(() => {
    setUser(null)
    setAuthState('guest')
  }, [])

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">…</p>
        </div>
      </div>
    )
  }

  const shell = (
    <>
      <ThemeSync theme={themeFromStore} locale={locale} />
      {authState === 'guest' || !user ? (
        <AuthView onAuthed={handleAuthed} />
      ) : (
        <AppShell user={user} onLogout={handleLogout}>
          {view === 'dashboard' && <DashboardView />}
          {view === 'projects' && <ProjectsView />}
          {view === 'project-detail' && <ProjectDetailView projectId={projectId} />}
          {view === 'categories' && <CategoriesView />}
          {view === 'providers' && <ProvidersView />}
          {view === 'settings' && <SettingsView user={user} onUserUpdate={setUser} />}
          {view === 'reports' && <ReportsView />}
          {view === 'aitools' && <AiToolsView />}
          {view === 'help' && <HelpView />}
          {view === 'admin' && user.role === 'admin' && <AdminView />}
        </AppShell>
      )}
      <Toaster position={locale === 'fa' ? 'top-left' : 'top-right'} richColors dir={locale === 'fa' ? 'rtl' : 'ltr'} />
    </>
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Radix portals (dialogs, dropdowns, selects, popovers, tooltips…) read direction
          from this provider — NOT from the DOM. Without it every portal renders dir="ltr"
          even in Persian, which was the root cause of broken RTL inside windows/menus. */}
      <DirectionProvider dir={locale === 'fa' ? 'rtl' : 'ltr'}>
        <I18nProvider locale={locale} setLocale={setLocale}>
          {shell}
        </I18nProvider>
      </DirectionProvider>
    </ThemeProvider>
  )
}
