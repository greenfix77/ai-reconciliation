import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireAdmin, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

export const runtime = 'nodejs'

/** DELETE /api/admin/users/[id]/providers/[providerId] — remove a user's AI provider. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; providerId: string }> }) {
  return handleApi(
    req,
    async () => {
      const admin = await requireAdmin()
      const { id, providerId } = await ctx.params

      const provider = await db.aiProvider.findUnique({ where: { id: providerId }, select: { id: true, userId: true, name: true } })
      if (!provider || provider.userId !== id) throw new ApiError(404, 'ارائه‌دهنده یافت نشد', 'NOT_FOUND')

      await db.aiProvider.delete({ where: { id: providerId } })
      await audit({ userId: admin.id, action: 'admin_delete_provider', entityType: 'user', entityId: id, meta: { providerId, name: provider.name }, req })
      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
