import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireUser, ApiError, parseBody } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { prepareReconciliation, executeReconciliation } from '@/lib/engine/reconcile-service'

export const runtime = 'nodejs'

const configSchema = z
  .object({
    matchDirection: z.enum(['opposite', 'same']).optional(),
    amountToleranceMinor: z.number().min(0).max(1e12).optional(),
    dateToleranceDays: z.number().min(0).max(365).optional(),
    requireExactDate: z.boolean().optional(),
    useDescriptionMatching: z.boolean().optional(),
    useReferenceMatching: z.boolean().optional(),
    allowOneToMany: z.boolean().optional(),
    allowManyToOne: z.boolean().optional(),
    detectDuplicates: z.boolean().optional(),
    aiBatchSize: z.number().min(5).max(100).optional(),
    minAutoConfidence: z.number().min(0).max(1).optional(),
  })
  .optional()

const bodySchema = z.object({ config: configSchema })

/** POST /api/projects/[id]/reconcile — start a reconciliation run (fire-and-forget job). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const { id } = await params
      const user = await requireUser()

      const rl = rateLimit(`reconcile:${user.id}`, 6, 10 * 60 * 1000)
      if (!rl.allowed) throw new ApiError(429, `تعداد درخواست‌ها زیاد است. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید.`, 'RATE_LIMITED')

      const body = await parseBody(req, bodySchema)

      // validation + Job/Reconciliation rows (throws ApiError on owner/processing/files issues)
      const prepared = await prepareReconciliation(id, user.id, body?.config)

      // persist merged config snapshot on the project
      await db.project.update({ where: { id }, data: { config: JSON.stringify(prepared.config) } })

      // kick the pipeline — never awaited; executeReconciliation handles all errors internally
      void executeReconciliation(prepared).catch((err) => console.error('[reconcile] escaped error', err))

      await audit({ userId: user.id, action: 'reconcile_started', entityType: 'project', entityId: id, meta: { jobId: prepared.jobId, reconciliationId: prepared.reconciliationId }, req })

      return jsonOk({ jobId: prepared.jobId, reconciliationId: prepared.reconciliationId })
    },
    { mutating: true }
  )
}
