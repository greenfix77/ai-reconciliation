import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, parseBody, requireUser, jsonOk, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { deleteStoredFile } from '@/lib/file-storage'
import { processFile } from '@/lib/engine/parse-service'
import { toFileItem } from '@/app/api/projects/_shared'

export const runtime = 'nodejs'

const patchSchema = z.object({
  action: z.enum(['reparse']),
})

async function findOwnedFile(fileId: string, userId: string) {
  const file = await db.file.findUnique({ where: { id: fileId } })
  if (!file || file.userId !== userId) throw new ApiError(404, 'File not found', 'NOT_FOUND')
  return file
}

/** DELETE /api/files/[id] — remove file + stored bytes */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      const { id } = await params
      const file = await findOwnedFile(id, user.id)

      deleteStoredFile(file.storedPath)
      await db.file.delete({ where: { id: file.id } })

      await audit({
        userId: user.id,
        action: 'delete_file',
        entityType: 'file',
        entityId: file.id,
        meta: { name: file.originalName, projectId: file.projectId },
        req,
      })

      return jsonOk({ deleted: true })
    },
    { mutating: true }
  )
}

/** PATCH /api/files/[id] — { action: 'reparse' } re-queues background parsing */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      const { id } = await params
      const file = await findOwnedFile(id, user.id)
      await parseBody(req, patchSchema)

      const updated = await db.file.update({
        where: { id: file.id },
        data: { status: 'parsing', parseError: null },
      })

      try {
        void processFile(file.id).catch(() => {})
      } catch {
        // defensive
      }

      await audit({
        userId: user.id,
        action: 'reparse_file',
        entityType: 'file',
        entityId: file.id,
        meta: { projectId: file.projectId },
        req,
      })

      return jsonOk({ file: toFileItem(updated) })
    },
    { mutating: true }
  )
}
