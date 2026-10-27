'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CloudUpload, Loader2, X } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { useI18n } from '@/lib/i18n'
import { apiUpload } from '@/lib/api-client'
import { FileItem } from '@/lib/types'
import { FileTypeIcon } from './helpers'

export const ACCEPTED_EXT = '.xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp'

type UploadEntry = {
  key: string
  name: string
  pct: number
  status: 'uploading' | 'done' | 'error'
}

type Props = {
  projectId: string
  disabled?: boolean
  onUploaded: (result: { uploaded: number; errors: { name: string; error: string }[] }) => void
}

/** Drag & drop + click upload zone — uploads files sequentially (preserves A/B side order), per-file progress. */
export function UploadZone({ projectId, disabled, onUploaded }: Props) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploads, setUploads] = useState<UploadEntry[]>([])

  const pickFiles = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || disabled) return
      const list = Array.from(fileList)
      const results: FileItem[] = []
      const errors: { name: string; error: string }[] = []

      const entries: UploadEntry[] = list.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, pct: 0, status: 'uploading' }))
      setUploads(entries)

      // Sequential to guarantee server-side side order: first file of empty project → A, rest → B
      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        const fd = new FormData()
        fd.append('files', file)
        try {
          const data = await apiUpload<{ files: FileItem[]; errors: { name: string; error: string }[] }>(
            `/api/projects/${projectId}/files`,
            fd,
            (pct) => {
              setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, pct } : u)))
            }
          )
          results.push(...(data.files ?? []))
          errors.push(...(data.errors ?? []))
          setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, pct: 100, status: data.files?.length ? 'done' : 'error' } : u)))
        } catch (err) {
          errors.push({ name: file.name, error: err instanceof Error ? err.message : 'Upload failed' })
          setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: 'error' } : u)))
        }
      }

      setTimeout(() => setUploads([]), 1500)

      if (results.length > 0) toast.success(t('projects.uploaded'))
      if (errors.length > 0) {
        toast.warning(t('projects.uploadPartial'))
        for (const e of errors) toast.error(`${e.name}: ${e.error}`)
      }
      onUploaded({ uploaded: results.length, errors })
    },
    [projectId, disabled, onUploaded, t]
  )

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('projects.uploadTitle')}
        onClick={pickFiles}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFiles() } }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files) }}
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50'
        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CloudUpload className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium">{t('projects.uploadHint')}</p>
        <p className="text-xs text-muted-foreground">{t('projects.uploadFormats')}</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_EXT}
          multiple
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">ℹ {t('projects.uploadNote')}</p>

      {uploads.length > 0 && (
        <ul className="flex max-h-40 flex-col gap-2 overflow-y-auto pe-1" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
              <FileTypeIcon name={u.name} className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium"><bdi dir="ltr">{u.name}</bdi></span>
                  {u.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  {u.status === 'done' && <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>}
                  {u.status === 'error' && <X className="h-3.5 w-3.5 text-red-500" />}
                </div>
                {u.status === 'uploading' && <Progress value={u.pct} className="mt-1.5 h-1.5" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
