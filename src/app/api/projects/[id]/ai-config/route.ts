import { NextRequest } from 'next/server'
import { handleApi, requireUser, jsonOk } from '@/lib/http'
import { db } from '@/lib/db'
import { assertRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { aiChat, extractJson } from '@/lib/ai-client'
import { findOwnedProject, mergeConfig, parseConfig, sanitizeConfig } from '../../_shared'

export const runtime = 'nodejs'

/**
 * POST /api/projects/[id]/ai-config — AI suggestion for ReconciliationConfig.
 * Builds a prompt from file column mappings + per-side sample stats, then
 * validates & merges the suggested JSON onto the existing config.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      assertRateLimit(`ai-config:${user.id}`, 10, 10 * 60 * 1000)
      const { id } = await params
      const project = await findOwnedProject(id, user.id)

      const files = await db.file.findMany({
        where: { projectId: project.id, userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { originalName: true, side: true, status: true, txCount: true, columnsMeta: true },
      })
      if (files.length === 0) {
        return jsonOk({ error: 'NO_FILES', message: 'Upload at least one file before requesting AI suggestions' })
      }

      const fileSummaries = files.map((f) => {
        let columns: unknown = null
        try {
          columns = f.columnsMeta ? JSON.parse(f.columnsMeta) : null
        } catch {
          columns = null
        }
        return { name: f.originalName, side: f.side, status: f.status, txCount: f.txCount, columns }
      })

      const system = [
        'You are a financial reconciliation expert configuring an automated engine.',
        'Return ONLY a JSON object (no prose) with EXACTLY these fields:',
        '{"matchDirection":"opposite"|"same","amountToleranceMinor":integer>=0,"dateToleranceDays":0..365,"requireExactDate":boolean,"useDescriptionMatching":boolean,"useReferenceMatching":boolean,"allowOneToMany":boolean,"allowManyToOne":boolean,"detectDuplicates":boolean,"aiBatchSize":5..100,"minAutoConfidence":0..1}',
        'Guidance: use "opposite" when comparing a bank statement against accounting books (amount signs cancel); use "same" for two same-perspective statements.',
        'Choose tolerances conservatively; prefer description+reference matching for bank data; minAutoConfidence between 0.6 and 0.85.',
      ].join('\n')

      const userPrompt = [
        `Project: ${project.name}`,
        project.description ? `Description: ${project.description}` : null,
        'Files:',
        JSON.stringify(fileSummaries, null, 2),
        'Suggest the optimal configuration JSON for this project.',
      ]
        .filter(Boolean)
        .join('\n\n')

      try {
        const result = await aiChat({
          providerId: project.aiProviderId,
          model: project.aiModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          maxTokens: 800,
        })

        const suggested = extractJson<Record<string, unknown>>(result.content)
        const merged = mergeConfig(parseConfig(project.config), suggested)
        const safe = sanitizeConfig(merged)

        await audit({
          userId: user.id,
          action: 'ai_config_suggestion',
          entityType: 'project',
          entityId: project.id,
          meta: { provider: result.providerName, model: result.model },
          req,
        })

        return jsonOk({ config: safe, providerName: result.providerName, model: result.model })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI request failed'
        return jsonOk({ error: 'AI_FAILED', message })
      }
    },
    { mutating: true }
  )
}
