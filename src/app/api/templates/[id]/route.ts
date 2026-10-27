import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireUser, ApiError } from '@/lib/http'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/** DELETE /api/templates/[id] — owner-scoped template deletion. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const { id } = await params
      const user = await requireUser()

      const template = await db.template.findFirst({ where: { id, userId: user.id } })
      if (!template) throw new ApiError(404, 'Template not found', 'NOT_FOUND')

      await db.template.delete({ where: { id: template.id } })

      await audit({
        userId: user.id,
        action: 'template_delete',
        entityType: 'template',
        entityId: template.id,
        meta: { name: template.name },
        req,
      })

      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
