import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireAdmin, parseBody, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { fromDbMinor } from '@/lib/money'
import { audit } from '@/lib/audit'

export const runtime = 'nodejs'

/**
 * GET /api/admin/projects/[id] — full-depth oversight of any project:
 * owner identity, files, latest reconciliation with match groups AND actual
 * transaction rows (per the approved "full oversight depth" decision).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(req, async () => {
    await requireAdmin()
    const { id } = await ctx.params

    const project = await db.project.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, status: true, createdAt: true } },
        category: { select: { id: true, name: true, color: true } },
      },
    })
    if (!project) throw new ApiError(404, 'پروژه یافت نشد', 'NOT_FOUND')
    const { user: owner, ...projectRest } = project

    const [files, reconciliations] = await Promise.all([
      db.file.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, originalName: true, mimeType: true, size: true, side: true, status: true, txCount: true, parseError: true, createdAt: true },
      }),
      db.reconciliation.findMany({
        where: { projectId: id },
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: { id: true, status: true, stats: true, providerName: true, model: true, startedAt: true, finishedAt: true, _count: { select: { groups: true } } },
      }),
    ])

    // Full transaction content for the two most recent files (oversight depth: complete)
    const fileIds = files.slice(0, 2).map((f) => f.id)
    const rawTransactions = fileIds.length
      ? await db.transaction.findMany({
          where: { fileId: { in: fileIds } },
          orderBy: [{ fileId: 'asc' }, { rowIndex: 'asc' }],
          take: 400,
          select: { id: true, fileId: true, side: true, rowIndex: true, date: true, description: true, reference: true, amountMinor: true, debit: true, credit: true, currency: true, flags: true },
        })
      : []
    const transactions = rawTransactions.map((t) => ({ ...t, amountMinor: fromDbMinor(t.amountMinor) }))

    // Latest reconciliation match groups with the real matched rows.
    // MatchItem stores transactionId without a Prisma relation → manual join.
    const latestRecon = reconciliations[0]
    let matchGroups: unknown[] = []
    if (latestRecon) {
      const groups = await db.matchGroup.findMany({
        where: { reconciliationId: latestRecon.id },
        orderBy: { type: 'asc' },
        take: 100,
        include: { items: true },
      })
      const txIds = [...new Set(groups.flatMap((g) => g.items.map((it) => it.transactionId)))]
      const txs = txIds.length
        ? await db.transaction.findMany({
            where: { id: { in: txIds } },
            select: { id: true, side: true, date: true, description: true, reference: true, amountMinor: true },
          })
        : []
      const txMap = new Map(txs.map((t) => [t.id, { ...t, amountMinor: fromDbMinor(t.amountMinor) }]))
      matchGroups = groups.map((g) => ({
        id: g.id, type: g.type, status: g.status, confidence: g.confidence,
        amountDiffMinor: fromDbMinor(g.amountDiffMinor), dateDiffDays: g.dateDiffDays,
        explanation: g.explanation, validationStatus: g.validationStatus, userNote: g.userNote,
        items: g.items
          .map((it) => ({ side: it.side, transaction: txMap.get(it.transactionId) ?? null }))
          .filter((it) => it.transaction !== null),
      }))
    }

    return jsonOk({ project: { ...projectRest, owner }, files, reconciliations, transactions, matchGroups })
  })
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['draft', 'ready', 'processing', 'reconciled', 'failed', 'archived']).optional(),
})

/** PATCH /api/admin/projects/[id] — edit any user's project (approved managerial authority). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const admin = await requireAdmin()
      const { id } = await ctx.params
      const body = await parseBody(req, patchSchema)

      const project = await db.project.findUnique({ where: { id }, select: { id: true, userId: true, name: true } })
      if (!project) throw new ApiError(404, 'پروژه یافت نشد', 'NOT_FOUND')

      const updated = await db.project.update({ where: { id }, data: body, select: { id: true, name: true, description: true, status: true } })
      await audit({ userId: admin.id, action: 'admin_update_project', entityType: 'project', entityId: id, meta: { ownerId: project.userId, changes: Object.keys(body) }, req })
      return jsonOk({ project: updated })
    },
    { mutating: true }
  )
}

/** DELETE /api/admin/projects/[id] — delete any user's project (cascades files/transactions/recons). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const admin = await requireAdmin()
      const { id } = await ctx.params

      const project = await db.project.findUnique({ where: { id }, select: { id: true, userId: true, name: true } })
      if (!project) throw new ApiError(404, 'پروژه یافت نشد', 'NOT_FOUND')

      await db.project.delete({ where: { id } })
      await audit({ userId: admin.id, action: 'admin_delete_project', entityType: 'project', entityId: id, meta: { ownerId: project.userId, name: project.name }, req })
      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
