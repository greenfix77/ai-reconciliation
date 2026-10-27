'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2, RotateCw, Trash2 } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api-client'
import { ProjectDetail } from '@/lib/types'
import { FileTypeIcon, FileStatusBadge, formatBytes, SideBadge } from './helpers'

type Props = {
  project: ProjectDetail
  onChanged: () => void
}

/** Files table + actions. Upload zone is rendered by the parent above this list. */
export function FilesPanel({ project, onChanged }: Props) {
  const { t, formatNumber, locale } = useI18n()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)

  const confirmDelete = async () => {
    if (!target) return
    setDeleting(target.id)
    try {
      await apiFetch(`/api/files/${target.id}`, { method: 'DELETE' })
      toast.success(t('projects.fileDeleted'))
      setTarget(null)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDeleting(null)
    }
  }

  const reparse = async (fileId: string) => {
    setRetrying(fileId)
    try {
      await apiFetch(`/api/files/${fileId}`, { method: 'PATCH', json: { action: 'reparse' } })
      toast.success(t('projects.reparseQueued'))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setRetrying(null)
    }
  }

  const files = project.files ?? []

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed py-10 text-center">
        <p className="text-sm font-medium">{t('projects.filesEmpty')}</p>
        <p className="text-xs text-muted-foreground">{t('projects.filesEmptyDesc')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card card-soft">
      <div className="max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-52">{t('projects.fileName')}</TableHead>
              <TableHead>{t('projects.side')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead className="text-center">{t('projects.txCount')}</TableHead>
              <TableHead>{t('projects.size')}</TableHead>
              <TableHead className="text-end">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <FileTypeIcon name={f.originalName} />
                    <span className="max-w-52 truncate text-sm font-medium" title={f.originalName}>
                      <bdi dir="ltr">{f.originalName}</bdi>
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <SideBadge side={f.side} />
                </TableCell>
                <TableCell>
                  <FileStatusBadge status={f.status} parseError={f.parseError} />
                </TableCell>
                <TableCell className="text-center text-sm tabular-nums">{formatNumber(f.txCount)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground"><bdi dir="ltr">{formatBytes(f.size, locale)}</bdi></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8" title={t('projects.download')} aria-label={t('projects.download')}>
                      <a href={`/api/files/${f.id}/download`} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    {f.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={t('projects.retry')}
                        aria-label={t('projects.retry')}
                        disabled={retrying === f.id}
                        onClick={() => reparse(f.id)}
                      >
                        {retrying === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-400"
                      title={t('projects.deleteFile')}
                      aria-label={t('projects.deleteFile')}
                      onClick={() => setTarget({ id: f.id, name: f.originalName })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.deleteFileConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('projects.deleteFileConfirmBody', { name: target?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting !== null}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700"
              disabled={deleting !== null}
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              {deleting !== null && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
