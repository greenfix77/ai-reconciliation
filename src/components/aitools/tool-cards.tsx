'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  BookPlus,
  Check,
  Copy,
  FileBarChart,
  GitBranch,
  GitCompareArrows,
  Lightbulb,
  Loader2,
  Radar,
  SearchCheck,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { AiToolType } from '@/lib/types'
import { MarkdownLite } from '@/components/aitools/markdown-lite'
import { cn } from '@/lib/utils'

const TOOLS: { key: AiToolType; icon: React.ReactNode; tone: string }[] = [
  { key: 'discrepancy_analysis', icon: <SearchCheck className="h-4 w-4" />, tone: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400' },
  { key: 'root_cause', icon: <GitBranch className="h-4 w-4" />, tone: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' },
  { key: 'resolution_recommendations', icon: <Lightbulb className="h-4 w-4" />, tone: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' },
  { key: 'accounting_entries', icon: <BookPlus className="h-4 w-4" />, tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' },
  { key: 'anomaly_detection', icon: <Radar className="h-4 w-4" />, tone: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400' },
  { key: 'report_generation', icon: <FileBarChart className="h-4 w-4" />, tone: 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400' },
  { key: 'project_comparison', icon: <GitCompareArrows className="h-4 w-4" />, tone: 'bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400' },
]

export function AiToolsLauncher({ projectId }: { projectId: string | null }) {
  const { t } = useI18n()
  const [runningTool, setRunningTool] = useState<AiToolType | null>(null)
  const [result, setResult] = useState<{ tool: AiToolType; content: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const runTool = async (tool: AiToolType) => {
    if (!projectId) {
      toast.info(t('aitools.toolResult.empty'))
      return
    }
    setRunningTool(tool)
    try {
      const res = await apiFetch<{ result: string; tool: AiToolType }>('/api/ai/tools', { method: 'POST', json: { projectId, tool } })
      setResult({ tool: res.tool, content: res.result })
    } catch (err) {
      toast.error(`${t('aitools.toolResult.failed')}${err instanceof Error ? ` — ${err.message}` : ''}`)
    } finally {
      setRunningTool(null)
    }
  }

  const copyResult = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.content)
      setCopied(true)
      toast.success(t('common.copied'))
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <Card className="rounded-2xl border bg-card card-soft">
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          {t('aitools.tools.title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t('aitools.tools.subtitle')}</p>
      </CardHeader>
      <CardContent className="grid gap-2 p-3">
        {TOOLS.map(({ key, icon, tone }) => {
          const busy = runningTool === key
          return (
            <div key={key} className="flex items-center gap-3 rounded-xl border p-2.5 transition-colors hover:border-violet-300 dark:hover:border-violet-800">
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone)}>{icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{t(`aitools.tool.${key}.title`)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{t(`aitools.tool.${key}.desc`)}</p>
              </div>
              <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 rounded-lg text-[11px]" onClick={() => void runTool(key)} disabled={runningTool !== null}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {busy ? t('aitools.running') : t('aitools.run')}
              </Button>
            </div>
          )
        })}
      </CardContent>

      {/* result dialog */}
      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="max-h-[85vh] rounded-2xl sm:max-w-xl">
          {result && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  {t(`aitools.tool.${result.tool}.title`)}
                </DialogTitle>
                <DialogDescription className="text-xs">{t('aitools.toolResult.title')}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[52vh] rounded-xl border bg-muted/20 p-3">
                <MarkdownLite content={result.content} />
                <div className="h-1" />
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={() => void copyResult()}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t('common.copied') : t('common.copy')}
                </Button>
                <Button size="sm" className="h-8 rounded-xl text-xs" onClick={() => setResult(null)}>
                  {t('common.close')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
