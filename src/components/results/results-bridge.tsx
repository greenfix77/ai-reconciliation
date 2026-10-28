'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import { JobItem } from '@/lib/types'

/**
 * Global bridge for project-detail → results flows.
 * Listens for window CustomEvents dispatched by other views:
 *  - 'recon:start'        { detail: { projectId } }              → POST reconcile + progress dialog
 *  - 'recon:open-results' { detail: { projectId, reconciliationId? } } → switch to AI tools view + select project
 * Emits:
 *  - 'recon:select-project' { detail: { projectId } }            → AiToolsView listens to sync its selector
 */

export const RECON_START_EVENT = 'recon:start'
export const RECON_OPEN_RESULTS_EVENT = 'recon:open-results'
export const RECON_SELECT_PROJECT_EVENT = 'recon:select-project'

/**
 * Last project id announced via RECON_SELECT_PROJECT_EVENT.
 * A view that mounts AFTER the event (view switch happens synchronously after
 * dispatch) reads this on mount instead of missing the notification — fixes the
 * race where "مشاهده نتایج" landed on the AI-tools view with no project selected.
 */
let lastSelectedProjectId: string | null = null
export function getLastSelectedProjectId(): string | null {
  return lastSelectedProjectId
}

type BridgeState = {
  jobId: string
  projectId: string
  job: JobItem | null
}

export function ResultsBridge() {
  const { t } = useI18n()
  const [run, setRun] = useState<BridgeState | null>(null)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const busyRef = useRef(false)
  const open = !!run

  const selectProject = useCallback((projectId: string) => {
    lastSelectedProjectId = projectId
    window.dispatchEvent(new CustomEvent(RECON_SELECT_PROJECT_EVENT, { detail: { projectId } }))
  }, [])

  // ---------- event listeners ----------
  useEffect(() => {
    const onStart = async (e: Event) => {
      if (busyRef.current) return
      const detail = (e as CustomEvent<{ projectId?: string }>).detail ?? {}
      const projectId = detail.projectId
      if (!projectId) return
      busyRef.current = true
      setDone(false)
      setFailed(false)
      setStartError(null)
      try {
        const res = await apiFetch<{ jobId: string; reconciliationId: string }>(`/api/projects/${projectId}/reconcile`, { method: 'POST', json: {} })
        toast.success(t('aitools.bridge.started'))
        setRun({ jobId: res.jobId, projectId, job: null })
      } catch (err) {
        setStartError(err instanceof Error ? err.message : null)
        setFailed(true)
        setRun({ jobId: '', projectId, job: null })
        toast.error(`${t('aitools.bridge.startFailed')}${err instanceof Error ? ` — ${err.message}` : ''}`)
      } finally {
        busyRef.current = false
      }
    }

    const onOpenResults = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail ?? {}
      if (!detail.projectId) return
      selectProject(detail.projectId)
      useAppStore.getState().setView('aitools')
    }

    window.addEventListener(RECON_START_EVENT, onStart as EventListener)
    window.addEventListener(RECON_OPEN_RESULTS_EVENT, onOpenResults as EventListener)
    return () => {
      window.removeEventListener(RECON_START_EVENT, onStart as EventListener)
      window.removeEventListener(RECON_OPEN_RESULTS_EVENT, onOpenResults as EventListener)
    }
  }, [t, selectProject])

  // ---------- job polling ----------
  useEffect(() => {
    if (!run || !run.jobId || done || failed) return
    const timer = setInterval(async () => {
      try {
        const job = await apiFetch<JobItem>(`/api/jobs/${run.jobId}`)
        setRun((p) => (p ? { ...p, job } : p))
        if (job.status === 'completed') {
          setDone(true)
          toast.success(t('aitools.bridge.done'))
          selectProject(run.projectId)
        } else if (job.status === 'failed') {
          setFailed(true)
          toast.error(`${t('aitools.bridge.failed')}${job.error ? ` — ${job.error}` : ''}`)
        }
      } catch {
        // transient polling error — ignore, next tick retries
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [run, done, failed, t, selectProject])

  const pct = run?.job ? (run.job.total > 0 ? Math.min(100, Math.round((run.job.progress / run.job.total) * 100)) : 0) : 0
  const stageKey = run?.job?.stage && run.job.stage.startsWith('stage.') ? `results.stage.${run.job.stage}` : null

  const close = () => {
    setRun(null)
    setDone(false)
    setFailed(false)
    setStartError(null)
  }

  const openResults = () => {
    if (run) selectProject(run.projectId)
    useAppStore.getState().setView('aitools')
    close()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md rounded-2xl" dir={undefined}>
        {run && !failed && !done && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                {t('aitools.bridge.progressTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs">{t('aitools.bridge.background')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{stageKey ? t(stageKey) : t('results.jobs.running')}</span>
                <span className="tabular-nums">{pct}٪</span>
              </div>
              <Progress value={pct} className="h-2" />
              {run.job && (
                <p className="text-[11px] tabular-nums text-muted-foreground" dir="ltr">
                  {run.job.progress} / {run.job.total}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" onClick={close}>
                {t('common.close')}
              </Button>
            </div>
          </>
        )}

        {run && done && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                {t('aitools.bridge.done')}
              </DialogTitle>
              <DialogDescription className="text-xs">{t('aitools.bridge.viewResults')} <span className="inline-block rtl:rotate-180">←</span></DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" onClick={close}>
                {t('common.close')}
              </Button>
              <Button size="sm" className="h-8 rounded-xl bg-emerald-600 text-xs text-white hover:bg-emerald-700 dark:bg-emerald-500" onClick={openResults}>
                {t('aitools.bridge.viewResults')}
              </Button>
            </div>
          </>
        )}

        {run && failed && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <XCircle className="h-5 w-5 text-red-500" />
                {startError ? t('aitools.bridge.startFailed') : t('aitools.bridge.failed')}
              </DialogTitle>
              {startError && <DialogDescription className="text-xs">{startError}</DialogDescription>}
            </DialogHeader>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" onClick={close}>
                {t('common.close')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
