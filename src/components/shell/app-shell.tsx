'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { PublicUser } from '@/lib/types'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CommandPalette } from './command-palette'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  FolderClosed,
  Tags,
  Settings2,
  BarChart3,
  Sparkles,
  Settings,
  HelpCircle,
  ShieldCheck,
  Bell,
  Sun,
  Moon,
  Search,
  ChevronRight,
  ChevronLeft,
  LogOut,
  UserRound,
  Menu,
  Zap,
  Languages,
  X,
} from 'lucide-react'

type NotificationItem = {
  id: string
  title: string
  body: string | null
  type: string
  read: boolean
  createdAt: string
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 shadow-lg shadow-sky-500/20', className)}>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M7 8a5 5 0 0 1 8.5-3.5L18 7" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M17 16a5 5 0 0 1-8.5 3.5L6 17" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="18" cy="9.5" r="2.6" fill="white" />
        <circle cx="6" cy="14.5" r="2.6" fill="white" />
      </svg>
    </div>
  )
}

function SidebarContent({
  activeView,
  collapsed,
  isAdmin = false,
  onNavigate,
}: {
  activeView: string
  collapsed: boolean
  isAdmin?: boolean
  onNavigate: (key: string) => void
}) {
  const { t } = useI18n()
  const nav = [
    { key: 'dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { key: 'projects', icon: FolderClosed, label: t('nav.projects') },
    { key: 'categories', icon: Tags, label: t('nav.categories') },
    { key: 'providers', icon: Settings2, label: t('nav.aiSettings') },
    { key: 'reports', icon: BarChart3, label: t('nav.reports') },
    { key: 'aitools', icon: Sparkles, label: t('nav.aiTools') },
    ...(isAdmin ? [{ key: 'admin', icon: ShieldCheck, label: t('nav.adminPanel') }] : []),
    { key: 'settings', icon: Settings, label: t('nav.settings') },
    { key: 'help', icon: HelpCircle, label: t('nav.help') },
  ]
  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-4 pt-5">
        <LogoMark />
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold leading-5 text-white">{t('common.appName')}</div>
            <div className="truncate text-[11px] text-white/60">{t('common.appSub')}</div>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main navigation">
        {nav.map((item) => {
          const active = activeView === item.key || (activeView === 'project-detail' && item.key === 'projects')
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active ? 'nav-item-active text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-white' : 'text-white/60 group-hover:text-white')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>
      <div className="p-3">
        <div className={cn('rounded-xl border border-white/10 bg-white/5 p-3', collapsed && 'hidden')}>
          <div className="mb-1 text-[11px] text-white/50">{t('nav.systemVersion')}</div>
          <div className="flex items-center gap-2 text-[12px] font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t('nav.systemActive')}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-white/80">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            {t('nav.aiReady')}
          </div>
        </div>
      </div>
    </>
  )
}

export function AppShell({ user, onLogout, children }: { user: PublicUser; onLogout: () => void; children: React.ReactNode }) {
  const { t, locale, setLocale, formatDate } = useI18n()
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const openProject = useAppStore((s) => s.openProject)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen)
  const commandOpen = useAppStore((s) => s.commandOpen)
  const setCommandOpen = useAppStore((s) => s.setCommandOpen)
  const { theme, setTheme } = useTheme()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await apiFetch<{ notifications: NotificationItem[]; unread: number }>('/api/notifications')
        if (!cancelled) {
          setNotifications(data.notifications)
          setUnread(data.unread)
        }
      } catch {
        // silent — notifications are non-critical
      }
    }
    void load()
    const interval = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandOpen])

  const handleNavigate = (key: string) => {
    setView(key as never)
    setMobileNavOpen(false)
  }

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications', { method: 'PATCH' })
      const data = await apiFetch<{ notifications: NotificationItem[]; unread: number }>('/api/notifications')
      setNotifications(data.notifications)
      setUnread(data.unread)
    } catch {}
  }

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
      onLogout()
    } catch {
      toast.error(t('common.networkError'))
    }
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  const changeLocale = (l: 'fa' | 'en') => {
    setLocale(l)
    // Keep server-side locale (API labels, dates) in sync
    apiFetch('/api/auth/me', { method: 'PATCH', json: { locale: l } }).catch(() => {})
  }
  const Chevron = locale === 'fa' ? ChevronRight : ChevronLeft

  return (
    <div className="flex min-h-screen" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      {/* Desktop sidebar — first flex child => right side in RTL, left in LTR.
          Spacer width = sidebar width + 12px viewport inset (fixed sidebar uses right/left:12)
          so the topbar/content never slide under the floating sidebar. */}
      <div className={cn('no-print my-3 hidden shrink-0 transition-all duration-300 lg:block', sidebarCollapsed ? 'w-[92px]' : 'w-[262px]')}>
        <div className="brand-sidebar fixed bottom-3 top-3 flex w-[80px] flex-col rounded-2xl border border-white/5 shadow-xl transition-all" style={{ width: sidebarCollapsed ? 80 : 250, [locale === 'fa' ? 'right' : 'left']: 12 } as React.CSSProperties}>
          <SidebarContent activeView={view} collapsed={sidebarCollapsed} isAdmin={user.role === 'admin'} onNavigate={handleNavigate} />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} aria-hidden />
          <div className="brand-sidebar absolute bottom-0 top-0 flex w-[260px] flex-col shadow-2xl" style={{ [locale === 'fa' ? 'right' : 'left']: 0 } as React.CSSProperties}>
            <button className="absolute top-4 text-white/70 hover:text-white" style={{ [locale === 'fa' ? 'left' : 'right']: 16 } as React.CSSProperties} onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent activeView={view} collapsed={false} isAdmin={user.role === 'admin'} onNavigate={handleNavigate} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="no-print sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5">
            <div className="flex items-center gap-2">
              <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Menu">
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden items-center gap-2.5 rounded-xl border bg-card px-2.5 py-1.5 card-soft sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="max-w-[130px] truncate text-[13px] font-semibold">{user.name}</div>
                  <div className="text-[11px] text-muted-foreground">{user.role === 'admin' ? (locale === 'fa' ? 'مدیر سیستم' : 'Administrator') : locale === 'fa' ? 'کاربر' : 'User'}</div>
                </div>
                <button onClick={toggleSidebar} className="ms-1 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label={t('nav.collapse')} title={t('nav.collapse')}>
                  <Chevron className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
                </button>
              </div>
            </div>

            <button
              onClick={() => setCommandOpen(true)}
              className="mx-auto flex h-10 min-w-0 flex-1 max-w-md items-center gap-2 rounded-xl border bg-muted/60 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('shell.searchPlaceholder')}</span>
              <kbd dir="ltr" className="ms-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">Ctrl + K</kbd>
            </button>

            <div className="flex items-center gap-0.5 sm:gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={t('shell.notifications')}>
                    <Bell className="h-[18px] w-[18px]" />
                    {unread > 0 && (
                      <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="text-sm font-semibold">{t('shell.notifications')}</div>
                    {unread > 0 && (
                      <button className="text-xs text-primary hover:underline" onClick={markAllRead}>
                        {t('shell.markAllRead')}
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('shell.noNotifications')}</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={cn('border-b px-4 py-3 last:border-0', !n.read && 'bg-primary/5')}>
                          <div className="flex items-start gap-2">
                            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.type === 'success' ? 'bg-emerald-500' : n.type === 'warning' ? 'bg-amber-500' : n.type === 'error' ? 'bg-red-500' : 'bg-sky-500')} />
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium">{n.title}</div>
                              {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
                              <div className="mt-1 text-[10px] text-muted-foreground/70">{formatDate(n.createdAt)}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={t('shell.language')}>
                    <Languages className="h-[18px] w-[18px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => changeLocale('fa')} className={cn(locale === 'fa' && 'bg-accent')}>
                    <span className="font-semibold">فارسی</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLocale('en')} className={cn(locale === 'en' && 'bg-accent')}>
                    <span className="font-semibold">English</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={toggleTheme} aria-label={t('shell.themeToggle')}>
                <Sun className="hidden h-[18px] w-[18px] dark:block" />
                <Moon className="h-[18px] w-[18px] dark:hidden" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={t('nav.settings')}>
                    <Settings className="h-[18px] w-[18px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground"><bdi dir="ltr">{user.email}</bdi></DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setView('settings')}>
                    <Settings className="h-4 w-4" /> {t('nav.settings')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" /> {t('shell.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 pb-6 pt-4 sm:px-5">{children}</main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} onNavigate={(v) => setView(v)} onOpenProject={openProject} />
    </div>
  )
}
