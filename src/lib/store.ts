'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ViewName, Locale } from './types'

type AppState = {
  view: ViewName
  projectId: string | null
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  locale: Locale
  theme: 'light' | 'dark' | 'system'
  commandOpen: boolean

  setView: (view: ViewName, opts?: { projectId?: string | null }) => void
  openProject: (projectId: string) => void
  toggleSidebar: () => void
  setMobileNavOpen: (open: boolean) => void
  setLocale: (locale: Locale) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setCommandOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      view: 'dashboard',
      projectId: null,
      sidebarCollapsed: false,
      mobileNavOpen: false,
      locale: 'fa',
      theme: 'system',
      commandOpen: false,

      setView: (view, opts) =>
        set((s) => ({
          view,
          projectId: opts?.projectId !== undefined ? opts.projectId : view === 'project-detail' ? s.projectId : null,
          mobileNavOpen: false,
        })),
      openProject: (projectId) => set({ view: 'project-detail', projectId, mobileNavOpen: false }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    {
      name: 'recon-app',
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, locale: s.locale, theme: s.theme }),
    }
  )
)
