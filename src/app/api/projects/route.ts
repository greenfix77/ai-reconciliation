import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { handleApi, parseBody, requireUser, jsonOk, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { assertRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { checkProjectQuota } from '@/lib/quota'
import { DEFAULT_CONFIG } from '@/lib/types'
import { toProjectListItem } from './_shared'

export const runtime = 'nodejs'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(500).optional().nullable(),
  categoryId: z.string().trim().min(1).optional().nullable(),
})

/** GET /api/projects — list user's projects (?categoryId=&status=&q=&archived=) */
export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    const user = await requireUser()
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('categoryId') || undefined
    const status = searchParams.get('status') || undefined
    const q = searchParams.get('q')?.trim() || undefined
    const archived = searchParams.get('archived')

    const where: Prisma.ProjectWhereInput = { userId: user.id }
    if (categoryId) where.categoryId = categoryId
    if (status && status !== 'all') {
      where.status = status
    } else if (archived === 'true') {
      where.status = 'archived'
    } else if (archived === 'false') {
      where.status = { not: 'archived' }
    }
    if (q) {
      where.OR = [{ name: { contains: q } }, { description: { contains: q } }]
    }

    const projects = await db.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        category: { select: { id: true, name: true, color: true } },
        files: { select: { txCount: true } },
      },
    })

    // Latest completed reconciliation per project (single query)
    const ids = projects.map((p) => p.id)
    const recs =
      ids.length > 0
        ? await db.reconciliation.findMany({
            where: { userId: user.id, projectId: { in: ids }, status: 'completed' },
            orderBy: { startedAt: 'desc' },
            select: { projectId: true, stats: true },
          })
        : []
    const latestByProject = new Map<string, string | null>()
    for (const r of recs) {
      if (!latestByProject.has(r.projectId)) latestByProject.set(r.projectId, r.stats)
    }

    const items = projects.map((p) => toProjectListItem(p, latestByProject.get(p.id) ?? null, user.locale))
    return jsonOk({ projects: items })
  })
}

/** POST /api/projects — create a project */
export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      assertRateLimit(`projects:create:${user.id}`, 30, 10 * 60 * 1000)
      const body = await parseBody(req, createSchema)

      // Per-user project quota (admin-configurable)
      const quota = await checkProjectQuota(user.id)
      if (!quota.allowed) {
        throw new ApiError(403, `سقف پروژه‌های شما پر است (${quota.limit} پروژه). برای افزایش ظرفیت با مدیر سیستم تماس بگیرید.`, 'PROJECTS_LIMIT')
      }

      if (body.categoryId) {
        const category = await db.category.findFirst({ where: { id: body.categoryId, userId: user.id } })
        if (!category) throw new ApiError(400, 'Category not found', 'INVALID_CATEGORY')
      }

      const project = await db.project.create({
        data: {
          userId: user.id,
          name: body.name,
          description: body.description ?? null,
          categoryId: body.categoryId ?? null,
          config: JSON.stringify(DEFAULT_CONFIG),
        },
      })

      await audit({ userId: user.id, action: 'create_project', entityType: 'project', entityId: project.id, meta: { name: project.name }, req })

      return jsonOk({ project: { ...project, config: project.config } })
    },
    { mutating: true }
  )
}
