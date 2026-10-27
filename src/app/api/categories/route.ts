import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, parseBody, requireUser, jsonOk } from '@/lib/http'
import { db } from '@/lib/db'
import { assertRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

export const runtime = 'nodejs'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #10b981'),
})

/** GET /api/categories — list user's categories with project counts */
export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    const user = await requireUser()
    const categories = await db.category.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { projects: true } } },
    })
    return jsonOk({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        projectCount: c._count.projects,
        createdAt: c.createdAt.toISOString(),
      })),
    })
  })
}

/** POST /api/categories — create category */
export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      assertRateLimit(`categories:create:${user.id}`, 30, 10 * 60 * 1000)
      const body = await parseBody(req, createSchema)

      const category = await db.category.create({
        data: { userId: user.id, name: body.name, color: body.color.toLowerCase() },
      })

      await audit({ userId: user.id, action: 'create_category', entityType: 'category', entityId: category.id, meta: { name: category.name }, req })

      return jsonOk({
        category: { id: category.id, name: category.name, color: category.color, projectCount: 0, createdAt: category.createdAt.toISOString() },
      })
    },
    { mutating: true }
  )
}
