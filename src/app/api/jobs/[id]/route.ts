import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireUser, ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { JobItem } from '@/lib/types'

export const runtime = 'nodejs'

/** GET /api/jobs/[id] — job status polling (owner only). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(req, async () => {
    const { id } = await params
    const user = await requireUser()

    const job = await db.job.findUnique({ where: { id } })
    if (!job || job.userId !== user.id) throw new ApiError(404, 'کار یافت نشد', 'NOT_FOUND')

    const item: JobItem = {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      total: job.total,
      stage: job.stage,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
    }
    return jsonOk(item)
  })
}
