import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleApi, jsonOk, requireUser, ApiError, parseBody } from '@/lib/http'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { aiChat } from '@/lib/ai-client'
import { checkAiQuota } from '@/lib/quota'
import { buildChatSystemPrompt } from '@/lib/engine/prompts'
import { AiChatMessage, ReconciliationStats } from '@/lib/types'

export const runtime = 'nodejs'

const bodySchema = z.object({
  projectId: z.string().min(1).max(64),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(20),
})

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** POST /api/ai/chat — grounded assistant over the project's real reconciliation data. */
export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()

      const rl = rateLimit(`chat:${user.id}`, 20, 5 * 60 * 1000)
      if (!rl.allowed) throw new ApiError(429, `تعداد درخواست‌ها زیاد است. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید.`, 'RATE_LIMITED')

      // Per-user AI quota (admin-configurable: enable/disable + daily limit)
      const aiQuota = await checkAiQuota(user.id)
      if (!aiQuota.allowed) {
        const msg = aiQuota.reason === 'ai_disabled'
          ? 'استفاده از هوش مصنوعی برای حساب شما غیرفعال شده است. با مدیر سیستم تماس بگیرید.'
          : `سقف روزانه استفاده از هوش مصنوعی (${aiQuota.limit} درخواست) پر شده است. فردا دوباره تلاش کنید.`
        throw new ApiError(403, msg, 'AI_QUOTA')
      }

      const body = await parseBody(req, bodySchema)

      const project = await db.project.findUnique({ where: { id: body.projectId } })
      if (!project || project.userId !== user.id) throw new ApiError(404, 'پروژه یافت نشد', 'NOT_FOUND')

      const locale = user.locale === 'en' ? 'en' : 'fa'

      // ----- build grounded context from real data -----
      const recon = await db.reconciliation.findFirst({
        where: { projectId: project.id, status: 'completed' },
        orderBy: { startedAt: 'desc' },
      })

      const parts: string[] = []
      parts.push(`Project: ${project.name}${project.description ? ` — ${project.description}` : ''} | status: ${project.status}`)

      let diffTxIds: string[] = []
      let matchedTxIds: string[] = []
      if (recon) {
        const stats = parseJsonSafe<Partial<ReconciliationStats> | null>(recon.stats, null)
        parts.push(`Last run: ${recon.startedAt.toISOString().slice(0, 10)} | stats: ${JSON.stringify(stats)}`)
        const groups = await db.matchGroup.findMany({
          where: { reconciliationId: recon.id },
          include: { items: { select: { transactionId: true, side: true } } },
        })
        const diffTypes = ['unmatched', 'missing_a', 'missing_b', 'amount_diff', 'date_diff', 'duplicate', 'invalid']
        for (const g of groups) {
          if (diffTypes.includes(g.type)) {
            for (const it of g.items) if (it.side === 'A') diffTxIds.push(it.transactionId)
          } else if (['exact', 'ai_match', 'one_to_many', 'many_to_one'].includes(g.type)) {
            for (const it of g.items) matchedTxIds.push(it.transactionId)
          }
        }
      }

      const txCols = { reference: true, date: true, description: true, amountMinor: true } as const
      const fmtTx = (t: { reference: string | null; date: Date | null; description: string | null; amountMinor: number }) =>
        `- ${t.date ? t.date.toISOString().slice(0, 10) : '—'} | ref: ${t.reference ?? '—'} | ${t.description ?? ''} | ${(t.amountMinor / 100).toLocaleString('en-US')}`

      if (diffTxIds.length > 0) {
        const uniqueDiff = [...new Set(diffTxIds)].slice(0, 20)
        const diffTxs = await db.transaction.findMany({ where: { id: { in: uniqueDiff } }, select: txCols, orderBy: { date: 'asc' } })
        parts.push(`TOP UNMATCHED / DISCREPANT TRANSACTIONS (A side):\n${diffTxs.map(fmtTx).join('\n')}`)
      }
      if (matchedTxIds.length > 0) {
        const uniqueMatched = [...new Set(matchedTxIds)].slice(0, 10)
        const matchedTxs = await db.transaction.findMany({ where: { id: { in: uniqueMatched } }, select: txCols, orderBy: { date: 'asc' } })
        parts.push(`MATCHED SAMPLE:\n${matchedTxs.map(fmtTx).join('\n')}`)
      }
      if (!recon) {
        parts.push('No completed reconciliation yet for this project.')
      }

      const context = parts.join('\n\n').slice(0, 12000)

      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: buildChatSystemPrompt(context, locale) },
        ...body.messages.slice(-6).map((m) => ({ role: m.role, content: m.content }) as { role: 'user' | 'assistant'; content: string }),
      ]

      const result = await aiChat({
        providerId: project.aiProviderId,
        model: project.aiModel,
        messages,
        temperature: 0.3,
        maxTokens: 1200,
      })

      await audit({ userId: user.id, action: 'ai_chat', entityType: 'project', entityId: project.id, meta: { messages: body.messages.length }, req })

      const reply: AiChatMessage = { role: 'assistant', content: result.content }
      return jsonOk({ reply })
    },
    { mutating: true }
  )
}
