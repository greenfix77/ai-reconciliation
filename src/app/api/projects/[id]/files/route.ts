import { NextRequest } from 'next/server'
import { handleApi, requireUser, jsonOk, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { assertRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { processFile } from '@/lib/engine/parse-service'
import { storeUpload, sanitizeFileName, validateFileMeta, validateMagicBytes, FileValidationError } from '@/lib/file-storage'
import { findOwnedProject, toFileItem } from '../../_shared'

export const runtime = 'nodejs'

const MAX_FILES_PER_PROJECT = 6

const MIME_BY_EXT: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

function isUploadFile(v: FormDataEntryValue | null): v is File {
  return typeof v === 'object' && v !== null && 'arrayBuffer' in v && 'size' in v
}

/**
 * POST /api/projects/[id]/files — multipart upload (field 'files', optional 'side').
 * Invalid files are skipped and reported; valid files are stored + parsed in background.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      assertRateLimit(`files:upload:${user.id}`, 20, 10 * 60 * 1000)
      const { id } = await params
      const project = await findOwnedProject(id, user.id)

      if (project.status === 'archived') {
        throw new ApiError(409, 'Unarchive the project before uploading files', 'ARCHIVED')
      }

      const existingCount = await db.file.count({ where: { projectId: project.id } })
      const remaining = MAX_FILES_PER_PROJECT - existingCount
      if (remaining <= 0) {
        throw new ApiError(400, `Project file limit reached (${MAX_FILES_PER_PROJECT})`, 'FILE_LIMIT')
      }

      let form: FormData
      try {
        form = await req.formData()
      } catch {
        throw new ApiError(400, 'Invalid multipart form data', 'BAD_FORM')
      }

      const entries = form.getAll('files').filter(isUploadFile)
      if (entries.length === 0) {
        throw new ApiError(400, 'No files provided (field "files")', 'NO_FILES')
      }

      const sideRaw = form.get('side')
      const explicitSide = sideRaw === 'A' || sideRaw === 'B' ? sideRaw : null
      // Default: first file of an empty project becomes base statement (A), others (B)
      const side: 'A' | 'B' = explicitSide ?? (existingCount === 0 ? 'A' : 'B')

      const files: ReturnType<typeof toFileItem>[] = []
      const errors: { name: string; error: string }[] = []

      for (const upload of entries) {
        const name = upload.name || 'file'
        if (files.length >= remaining) {
          errors.push({ name, error: `Project file limit reached (${MAX_FILES_PER_PROJECT})` })
          continue
        }
        try {
          const ext = validateFileMeta(name, upload.size)
          const buffer = Buffer.from(await upload.arrayBuffer())
          validateMagicBytes(buffer, ext)
          const { storedPath } = storeUpload(user.id, ext, buffer)
          const created = await db.file.create({
            data: {
              projectId: project.id,
              userId: user.id,
              originalName: sanitizeFileName(name),
              storedPath,
              mimeType: upload.type || MIME_BY_EXT[ext] || 'application/octet-stream',
              size: upload.size,
              side,
              status: 'uploaded',
            },
          })
          // Kick off parsing without blocking the response
          try {
            void processFile(created.id).catch(() => {})
          } catch {
            // processFile never throws synchronously; defensive only
          }
          files.push(toFileItem(created))
        } catch (err) {
          const message =
            err instanceof FileValidationError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'File validation failed'
          errors.push({ name, error: message })
        }
      }

      // draft/failed -> ready once files exist
      if (files.length > 0 && (project.status === 'draft' || project.status === 'failed')) {
        await db.project.update({ where: { id: project.id }, data: { status: 'ready' } })
      }

      if (files.length > 0) {
        await audit({
          userId: user.id,
          action: 'upload_files',
          entityType: 'project',
          entityId: project.id,
          meta: { uploaded: files.length, rejected: errors.length, side },
          req,
        })
      }

      return jsonOk({ files, errors })
    },
    { mutating: true }
  )
}
