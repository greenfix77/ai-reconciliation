'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Standard dashboard card shell — consistent radius, border, soft shadow & padding. */
export function DashCard({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('min-w-0 rounded-2xl border bg-card card-soft p-4 sm:p-5', className)}>{children}</section>
}

/** Small section header: icon chip + bold title + muted subtitle + optional trailing action slot. */
export function SectionHeader({
  icon: Icon,
  iconTone = 'bg-primary/10 text-primary',
  title,
  subtitle,
  action,
  className,
}: {
  icon: LucideIcon
  iconTone?: string
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconTone)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-5">{title}</h3>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
