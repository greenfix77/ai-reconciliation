import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireUser, ApiError, parseBody } from '@/lib/http'
import { audit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { runAiTool } from '@/lib/engine/tools-service'
import { checkAiQuota } from '@/lib/quota'
import { AiToolType } from '@/lib/types'

export const runtime = 'nodejs'

const TOOLS = ['discrepancy_analysis', 'root_cause', 'resolution_recommendations', 'accounting_entries', 'anomaly_detection', 'report_generation', 'project_comparison'] as const

const bodySchema = z.object({
  projectId: z.string().min(1).max(64),
  tool: z.enum(TOOLS),
})

/** POST /api/ai/tools — run one of the 7 AI analysis tools on real project data. */
export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      const body = await parseBody(req, bodySchema)

      const rl = rateLimit(`tool:${user.id}:${body.tool}`, 15, 5 * 60 * 1000)
      if (!rl.allowed) throw new ApiError(429, `تعداد درخواست‌ها برای این ابزار زیاد است. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید.`, 'RATE_LIMITED')

      // Per-user AI quota (admin-configurable: enable/disable + daily limit)
      const aiQuota = await checkAiQuota(user.id)
      if (!aiQuota.allowed) {
        const msg = aiQuota.reason === 'ai_disabled'
          ? 'استفاده از هوش مصنوعی برای حساب شما غیرفعال شده است. با مدیر سیستم تماس بگیرید.'
          : `سقف روزانه استفاده از هوش مصنوعی (${aiQuota.limit} درخواست) پر شده است. فردا دوباره تلاش کنید.`
        throw new ApiError(403, msg, 'AI_QUOTA')
      }

      const { result } = await runAiTool(body.projectId, user.id, body.tool as AiToolType)

      await audit({ userId: user.id, action: 'ai_tool_used', entityType: 'project', entityId: body.projectId, meta: { tool: body.tool }, req })

      return jsonOk({ result, tool: body.tool })
    },
    { mutating: true }
  )
}
