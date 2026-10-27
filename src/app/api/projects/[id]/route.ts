import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { handleApi, parseBody, requireUser, jsonOk, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { assertRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { deleteStoredFile } from '@/lib/file-storage'
import { findOwnedProject, mergeConfig, parseConfig, toFileItem, toProjectListItem } from '../_shared'

export const runtime = 'nodejs'

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
  status: z.enum(['archived', 'draft']).optional(),
  aiProviderId: z.string().trim().min(1).nullable().optional(),
  aiModel: z.string().trim().max(120).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

async function buildDetail(projectId: string, userId: string, locale: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    include: {
      category: { select: { id: true, name: true, color: true } },
      files: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!project) throw new ApiError(404, 'Project not found', 'NOT_FOUND')

  const latestRec = await db.reconciliation.findFirst({
    where: { projectId: project.id, userId, status: 'completed' },
    orderBy: { startedAt: 'desc' },
    select: { stats: true },
  })

  const base = toProjectListItem(
    { ...project, files: project.files.map((f) => ({ txCount: f.txCount })) },
    latestRec?.stats ?? null,
    locale
  )

  return {
    ...base,
    config: parseConfig(project.config),
    aiProviderId: project.aiProviderId,
    aiModel: project.aiModel,
    files: project.files.map(toFileItem),
    category: project.category ?? null,
  }
}

/** GET /api/projects/[id] — full project detail */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(req, async () => {
    const user = await requireUser()
    const { id } = await params
    const detail = await buildDetail(id, user.id, user.locale)
    return jsonOk({ project: detail })
  })
}

/** PATCH /api/projects/[id] — update fields, archive/unarchive, merge config */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      assertRateLimit(`projects:update:${user.id}`, 60, 10 * 60 * 1000)
      const { id } = await params
      const project = await findOwnedProject(id, user.id)
      const body = await parseBody(req, patchSchema)

      const data: Prisma.ProjectUncheckedUpdateInput = {}

      if (body.name !== undefined) data.name = body.name
      if (body.description !== undefined) data.description = body.description
      if (body.aiProviderId !== undefined) {
        if (body.aiProviderId) {
          const provider = await db.aiProvider.findFirst({ where: { id: body.aiProviderId, userId: user.id } })
          if (!provider) throw new ApiError(400, 'AI provider not found', 'INVALID_PROVIDER')
        }
        data.aiProviderId = body.aiProviderId
      }
      if (body.aiModel !== undefined) data.aiModel = body.aiModel

      if (body.categoryId !== undefined) {
        if (body.categoryId) {
          const category = await db.category.findFirst({ where: { id: body.categoryId, userId: user.id } })
          if (!category) throw new ApiError(400, 'Category not found', 'INVALID_CATEGORY')
        }
        data.categoryId = body.categoryId
      }

      if (body.status !== undefined) {
        if (project.status === 'processing') {
          throw new ApiError(409, 'Project is processing; status cannot be changed right now', 'PROCESSING')
        }
        data.status = body.status
      }

      if (body.config !== undefined) {
        data.config = JSON.stringify(mergeConfig(parseConfig(project.config), body.config))
      }

      await db.project.update({ where: { id: project.id }, data })
      await audit({
        userId: user.id,
        action: 'update_project',
        entityType: 'project',
        entityId: project.id,
        meta: { fields: Object.keys(body) },
        req,
      })

      const detail = await buildDetail(project.id, user.id, user.locale)
      return jsonOk({ project: detail })
    },
    { mutating: true }
  )
}

/** DELETE /api/projects/[id] — blocked while processing; cascades files (+ storage cleanup) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      const { id } = await params
      const project = await findOwnedProject(id, user.id)

      if (project.status === 'processing') {
        throw new ApiError(409, 'Project is processing and cannot be deleted', 'PROCESSING')
      }

      const files = await db.file.findMany({ where: { projectId: project.id }, select: { id: true, storedPath: true } })
      for (const file of files) {
        deleteStoredFile(file.storedPath)
      }
      await db.project.delete({ where: { id: project.id } })

      await audit({
        userId: user.id,
        action: 'delete_project',
        entityType: 'project',
        entityId: project.id,
        meta: { name: project.name, filesRemoved: files.length },
        req,
      })

      return jsonOk({ deleted: true })
    },
    { mutating: true }
  )
}
