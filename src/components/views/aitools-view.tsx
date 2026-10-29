'use client'

import { useCallback, useEffect, useState } from 'react'
import { FolderKanban, Loader2, PlayCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiFetch } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { ResultsPanel } from '@/components/results/results-panel'
import { RECON_SELECT_PROJECT_EVENT, RECON_START_EVENT, getLastSelectedProjectId } from '@/components/results/results-bridge'
import { AiToolsLauncher } from '@/components/aitools/tool-cards'
import { AiChatCard } from '@/components/aitools/ai-chat'

type ProjectOption = { id: string; name: string; status?: string }

/**
 * ابزارهای هوشمند — AI tools hub:
 * (a) ResultsBridge listening globally for recon:start / recon:open-results events,
 * (b) project selector + results viewer + approval UI (ResultsPanel),
 * (c) AI tools launcher, (d) grounded AI chat.
 */
export function AiToolsView() {
  const { t } = useI18n()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const data = await apiFetch<unknown>('/api/projects')
      const list: ProjectOption[] = Array.isArray(data)
        ? (data as ProjectOption[])
        : Array.isArray((data as { projects?: ProjectOption[] })?.projects)
          ? (data as { projects: ProjectOption[] }).projects
          : []
      setProjects(list.filter((p) => p && p.id))
    } catch {
      // projects API may not be ready yet — show empty state gracefully
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  // sync with bridge events (project CTA / job completion / open-results)
  useEffect(() => {
    const onSelectProject = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail ?? {}
      if (detail.projectId) setSelectedProject(detail.projectId)
    }
    // Late-mount race: the bridge may announce the project BEFORE this view is
    // mounted (dispatch → setView in the same tick). Read the last announcement.
    const last = getLastSelectedProjectId()
    if (last) setSelectedProject(last)
    window.addEventListener(RECON_SELECT_PROJECT_EVENT, onSelectProject)
    return () => window.removeEventListener(RECON_SELECT_PROJECT_EVENT, onSelectProject)
  }, [])

  const startReconcile = () => {
    if (!selectedProject) return
    window.dispatchEvent(new CustomEvent(RECON_START_EVENT, { detail: { projectId: selectedProject } }))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ResultsBridge is mounted globally in page.tsx (was here — dead when the
          start CTA fired from other views; a second instance would also double-render
          the progress dialog). */}

      {/* header */}
      <div className="no-print flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            {t('aitools.title')}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">{t('aitools.subtitle')}</p>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        {/* ---------- left column ---------- */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* project selector */}
          <Card className="rounded-2xl border bg-card card-soft">
            <CardHeader className="border-b py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FolderKanban className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                {t('aitools.projectCard.title')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('aitools.projectCard.desc')}</p>
            </CardHeader>
            <CardContent className="no-print flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              {projectsLoading ? (
                <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : projects.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  {t('aitools.emptyProjects')}
                </p>
              ) : (
                <>
                  <Select value={selectedProject ?? ''} onValueChange={(v) => setSelectedProject(v)}>
                    <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:max-w-xs" aria-label={t('results.selectProject')}>
                      <SelectValue placeholder={t('results.selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="rounded-lg text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 sm:ms-auto">
                    <Button
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl bg-violet-600 text-xs text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
                      disabled={!selectedProject}
                      onClick={startReconcile}
                      title={t('aitools.startReconcileHint')}
                    >
                      <PlayCircle className="h-4 w-4" />
                      {t('aitools.startReconcile')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* results viewer + approvals */}
          {selectedProject ? (
            <ResultsPanel projectId={selectedProject} />
          ) : (
            !projectsLoading && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center card-soft">
                <Sparkles className="h-8 w-8 text-violet-500/70" />
                <p className="text-sm font-medium">{t('results.selectHint')}</p>
              </div>
            )
          )}
        </div>

        {/* ---------- right column ---------- */}
        <div className="no-print flex min-w-0 flex-col gap-4">
          <AiToolsLauncher projectId={selectedProject} />
          <AiChatCard projectId={selectedProject} />
        </div>
      </div>
    </div>
  )
}
