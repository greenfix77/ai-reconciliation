'use client'

import { useEffect, useState } from 'react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useI18n } from '@/lib/i18n'
import { ViewName } from '@/lib/types'
import { apiFetch } from '@/lib/api-client'
import { LayoutDashboard, FolderClosed, Tags, Settings2, BarChart3, Sparkles, Settings, HelpCircle, FolderOpen } from 'lucide-react'

type SearchProject = { id: string; name: string; status: string; categoryName: string | null }

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onOpenProject,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: ViewName) => void
  onOpenProject: (id: string) => void
}) {
  const { t, locale } = useI18n()
  const [projects, setProjects] = useState<SearchProject[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{ projects: SearchProject[] }>(`/api/search?q=${encodeURIComponent(query)}`)
        setProjects(data.projects)
      } catch {
        setProjects([])
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [open, query])

  const navItems: { view: ViewName; label: string; icon: React.ElementType }[] = [
    { view: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { view: 'projects', label: t('nav.projects'), icon: FolderClosed },
    { view: 'categories', label: t('nav.categories'), icon: Tags },
    { view: 'providers', label: t('nav.aiSettings'), icon: Settings2 },
    { view: 'reports', label: t('nav.reports'), icon: BarChart3 },
    { view: 'aitools', label: t('nav.aiTools'), icon: Sparkles },
    { view: 'settings', label: t('nav.settings'), icon: Settings },
    { view: 'help', label: t('nav.help'), icon: HelpCircle },
  ]

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      draft: ['پیش‌نویس', 'Draft'],
      ready: ['آماده', 'Ready'],
      processing: ['در حال پردازش', 'Processing'],
      reconciled: ['مطابق‌شده', 'Reconciled'],
      archived: ['بایگانی', 'Archived'],
      failed: ['ناموفق', 'Failed'],
    }
    const pair = map[s] ?? [s, s]
    return locale === 'fa' ? pair[0] : pair[1]
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t('shell.searchPlaceholder')} value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{t('common.notFound')}</CommandEmpty>
        <CommandGroup heading={locale === 'fa' ? 'پرونده‌ها' : 'Projects'}>
          {projects.slice(0, 8).map((p) => (
            <CommandItem
              key={p.id}
              value={p.name}
              onSelect={() => {
                onOpenProject(p.id)
                onOpenChange(false)
              }}
            >
              <FolderOpen className="me-2 h-4 w-4 text-muted-foreground" />
              <span className="truncate">{p.name}</span>
              <span className="ms-auto text-xs text-muted-foreground">{statusLabel(p.status)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading={locale === 'fa' ? 'پیمایش' : 'Navigation'}>
          {navItems.map((item) => (
            <CommandItem
              key={item.view}
              value={item.label}
              onSelect={() => {
                onNavigate(item.view)
                onOpenChange(false)
              }}
            >
              <item.icon className="me-2 h-4 w-4 text-muted-foreground" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
