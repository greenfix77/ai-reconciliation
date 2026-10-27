'use client'

import type { ReactNode } from 'react'
import {
  BarChart3,
  Bot,
  FileQuestion,
  GitCompareArrows,
  Keyboard,
  LifeBuoy,
  Mail,
  Rocket,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Section = {
  id: string
  icon: typeof Rocket
  chip: string
  titleKey: string
  descKey: string
  content: ReactNode
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-[13px] leading-6 text-muted-foreground">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function HelpView() {
  const { t } = useI18n()

  const sections: Section[] = [
    {
      id: 'quickstart',
      icon: Rocket,
      chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      titleKey: 'help.sec.quickstart',
      descKey: 'help.sec.quickstartDesc',
      content: <List items={[t('help.qs.s1'), t('help.qs.s2'), t('help.qs.s3'), t('help.qs.s4'), t('help.qs.s5')]} />,
    },
    {
      id: 'files',
      icon: Upload,
      chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      titleKey: 'help.sec.files',
      descKey: 'help.sec.filesDesc',
      content: (
        <List
          items={[
            t('help.files.formats'),
            t('help.files.sideA'),
            t('help.files.sideB'),
            t('help.files.limit'),
            t('help.files.headerHint'),
          ]}
        />
      ),
    },
    {
      id: 'matching',
      icon: SlidersHorizontal,
      chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      titleKey: 'help.sec.matching',
      descKey: 'help.sec.matchingDesc',
      content: (
        <List
          items={[
            t('help.match.direction'),
            t('help.match.amountTolerance'),
            t('help.match.dateTolerance'),
            t('help.match.requireExactDate'),
            t('help.match.description'),
            t('help.match.reference'),
            t('help.match.oneToMany'),
            t('help.match.manyToOne'),
            t('help.match.duplicates'),
            t('help.match.batchSize'),
            t('help.match.confidence'),
          ]}
        />
      ),
    },
    {
      id: 'providers',
      icon: Bot,
      chip: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      titleKey: 'help.sec.providers',
      descKey: 'help.sec.providersDesc',
      content: (
        <List
          items={[
            t('help.providers.add'),
            t('help.providers.test'),
            t('help.providers.security'),
            t('help.providers.builtIn'),
          ]}
        />
      ),
    },
    {
      id: 'results',
      icon: GitCompareArrows,
      chip: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      titleKey: 'help.sec.results',
      descKey: 'help.sec.resultsDesc',
      content: (
        <List
          items={[
            t('help.results.workflow'),
            t('help.results.types'),
            t('help.results.approve'),
            t('help.results.evidence'),
          ]}
        />
      ),
    },
    {
      id: 'reports',
      icon: BarChart3,
      chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      titleKey: 'help.sec.reports',
      descKey: 'help.sec.reportsDesc',
      content: <List items={[t('help.reports.exports'), t('help.reports.filter'), t('help.reports.print')]} />,
    },
    {
      id: 'security',
      icon: ShieldCheck,
      chip: 'bg-red-500/10 text-red-600 dark:text-red-400',
      titleKey: 'help.sec.security',
      descKey: 'help.sec.securityDesc',
      content: (
        <List
          items={[t('help.security.list1'), t('help.security.list2'), t('help.security.list3'), t('help.security.list4')]}
        />
      ),
    },
    {
      id: 'shortcuts',
      icon: Keyboard,
      chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
      titleKey: 'help.sec.shortcuts',
      descKey: 'help.sec.shortcutsDesc',
      content: <List items={[t('help.shortcuts.ctrlk'), t('help.shortcuts.esc'), t('help.shortcuts.theme')]} />,
    },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight">{t('help.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('help.subtitle')}</p>
      </div>

      {/* Support card */}
      <div className="card-soft flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <LifeBuoy className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">{t('help.supportTitle')}</h2>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t('help.supportDesc')}</p>
          <p dir="ltr" className="mt-1 font-mono text-xs text-blue-600 dark:text-blue-400">support@reconciliation.ir</p>
        </div>
        <Button asChild className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          <a href="mailto:support@reconciliation.ir?subject=Reconciliation%20Support">
            <Mail className="h-4 w-4" />
            {t('help.supportBtn')}
          </a>
        </Button>
      </div>

      {/* Sections */}
      <Accordion type="multiple" defaultValue={['quickstart']} className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="card-soft rounded-2xl border bg-card px-5 !border-b-0"
            >
              <AccordionTrigger className="items-center py-4 hover:no-underline">
                <span className="flex items-center gap-3 text-start">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', section.chip)}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{t(section.titleKey)}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t(section.descKey)}</span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-5 pt-0">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* Footer note */}
      <p className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-muted-foreground">
        <FileQuestion className="h-3.5 w-3.5" />
        {t('common.appName')} · {t('help.subtitle')}
      </p>
    </div>
  )
}
