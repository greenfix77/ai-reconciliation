import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireUser, ApiError, parseBody } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'note', 'resolve', 'reopen']),
  note: z.string().max(500).optional(),
})

const APPROVABLE_TYPES = ['ai_match', 'one_to_many', 'many_to_one', 'amount_diff', 'date_diff']

/** PATCH /api/matches/[id] — human decision on a match group. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const { id } = await params
      const user = await requireUser()

      const rl = rateLimit(`match:${user.id}`, 120, 60 * 1000)
      if (!rl.allowed) throw new ApiError(429, `تعداد درخواست‌ها زیاد است. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید.`, 'RATE_LIMITED')

      const body = await parseBody(req, bodySchema)

      const group = await db.matchGroup.findUnique({
        where: { id },
        include: { reconciliation: { select: { userId: true, projectId: true } } },
      })
      if (!group) throw new ApiError(404, 'تطبیق یافت نشد', 'NOT_FOUND')
      if (group.reconciliation.userId !== user.id) throw new ApiError(403, 'دسترسی غیرمجاز', 'FORBIDDEN')

      const historyAction = body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : body.action === 'note' ? 'note' : body.action === 'resolve' ? 'resolved' : 'reopened'

      const data: { status?: string; userNote?: string; decidedBy?: string } = {}
      switch (body.action) {
        case 'approve':
          if (!APPROVABLE_TYPES.includes(group.type)) throw new ApiError(400, 'این نوع تطبیق قابل تایید دستی نیست', 'NOT_APPROVABLE')
          data.status = 'approved'
          data.decidedBy = 'user'
          break
        case 'reject':
          data.status = 'rejected'
          data.decidedBy = 'user'
          break
        case 'note':
          if (!body.note || !body.note.trim()) throw new ApiError(400, 'متن یادداشت الزامی است', 'NOTE_REQUIRED')
          data.userNote = body.note.trim().slice(0, 500)
          break
        case 'resolve':
          data.status = 'resolved'
          data.decidedBy = 'user'
          break
        case 'reopen':
          data.status = 'pending'
          break
      }

      const updated = await db.matchGroup.update({ where: { id }, data })

      await db.matchHistory.create({
        data: {
          groupId: id,
          userId: user.id,
          action: historyAction,
          note: body.note?.trim().slice(0, 500) ?? null,
        },
      })

      await audit({ userId: user.id, action: 'match_decision', entityType: 'match_group', entityId: id, meta: { action: body.action, type: group.type, projectId: group.reconciliation.projectId }, req })

      return jsonOk({
        id: updated.id,
        status: updated.status,
        userNote: updated.userNote,
        decidedBy: updated.decidedBy,
        validationStatus: updated.validationStatus,
      })
    },
    { mutating: true }
  )
}
