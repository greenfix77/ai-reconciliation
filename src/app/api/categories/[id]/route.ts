import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, parseBody, requireUser, jsonOk, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

export const runtime = 'nodejs'

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #10b981').optional(),
})

async function findOwnedCategory(id: string, userId: string) {
  const category = await db.category.findFirst({ where: { id, userId } })
  if (!category) throw new ApiError(404, 'Category not found', 'NOT_FOUND')
  return category
}

/** PATCH /api/categories/[id] — rename / recolor */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      const { id } = await params
      const category = await findOwnedCategory(id, user.id)
      const body = await parseBody(req, patchSchema)

      const updated = await db.category.update({
        where: { id: category.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.color !== undefined ? { color: body.color.toLowerCase() } : {}),
        },
      })

      await audit({ userId: user.id, action: 'update_category', entityType: 'category', entityId: category.id, meta: { name: updated.name }, req })

      return jsonOk({ category: { id: updated.id, name: updated.name, color: updated.color } })
    },
    { mutating: true }
  )
}

/** DELETE /api/categories/[id] — projects fall back to no category (onDelete: SetNull) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      const { id } = await params
      const category = await findOwnedCategory(id, user.id)

      const affected = await db.project.count({ where: { categoryId: category.id, userId: user.id } })
      await db.category.delete({ where: { id: category.id } })

      await audit({
        userId: user.id,
        action: 'delete_category',
        entityType: 'category',
        entityId: category.id,
        meta: { name: category.name, affectedProjects: affected },
        req,
      })

      return jsonOk({ deleted: true, affectedProjects: affected })
    },
    { mutating: true }
  )
}
