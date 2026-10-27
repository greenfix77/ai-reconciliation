import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireUser } from '@/lib/http'
import { db } from '@/lib/db'
import { DashboardStats, DEFAULT_CONFIG } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * Dashboard aggregate stats. All queries scoped to the authenticated user.
 * Trends compare the last 7 days vs the previous 7 days.
 */
export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    const user = await requireUser()

    const projects = await db.project.findMany({
      where: { userId: user.id },
      include: { category: true, files: { select: { txCount: true } }, reconciliations: { orderBy: { startedAt: 'desc' }, take: 1, include: { _count: { select: { groups: true } } } } },
      orderBy: { updatedAt: 'desc' },
    })

    const now = Date.now()
    const sevenDaysAgo = new Date(now - 7 * 86_400_000)
    const fourteenDaysAgo = new Date(now - 14 * 86_400_000)

    const recentRecons = await db.reconciliation.findMany({
      where: { userId: user.id, startedAt: { gte: fourteenDaysAgo } },
      include: { groups: { select: { type: true, status: true } }, project: { select: { name: true } } },
      orderBy: { startedAt: 'asc' },
    })

    // Daily buckets for last 7 days
    const trend: { day: string; discrepancies: number; matches: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * 86_400_000)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart.getTime() + 86_400_000)
      const dayRecons = recentRecons.filter((r) => r.startedAt >= dayStart && r.startedAt < dayEnd)
      let discrepancies = 0
      let matches = 0
      for (const r of dayRecons) {
        for (const g of r.groups) {
          if (g.type === 'unmatched' || g.type === 'missing_a' || g.type === 'missing_b') discrepancies++
          else if (g.type === 'exact' || g.type === 'ai_match') matches++
        }
      }
      const df = new Intl.DateTimeFormat(user.locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB', { month: 'short', day: 'numeric' })
      trend.push({ day: df.format(dayStart), discrepancies, matches })
    }

    const prevWeekRecons = recentRecons.filter((r) => r.startedAt < sevenDaysAgo)
    const curWeekRecons = recentRecons.filter((r) => r.startedAt >= sevenDaysAgo)

    const countTypes = (recons: typeof recentRecons) => {
      let matched = 0
      let discrepancy = 0
      for (const r of recons) {
        for (const g of r.groups) {
          if (g.type === 'exact' || g.type === 'ai_match' || g.type === 'one_to_many' || g.type === 'many_to_one') matched++
          else discrepancy++
        }
      }
      return { matched, discrepancy }
    }

    const prev = countTypes(prevWeekRecons)
    const cur = countTypes(curWeekRecons)

    const pctChange = (curVal: number, prevVal: number) => {
      if (prevVal === 0) return curVal > 0 ? 100 : 0
      return Math.round(((curVal - prevVal) / prevVal) * 100)
    }

    const successfulTx = cur.matched + prev.matched + projects.reduce((acc, p) => acc + p.files.reduce((a, f) => a + f.txCount, 0), 0)

    // Matching rate: matched groups / total groups over last 7 days
    const totalCur = cur.matched + cur.discrepancy
    const matchRate = totalCur > 0 ? cur.matched / totalCur : 0
    const totalPrev = prev.matched + prev.discrepancy
    const matchRatePrev = totalPrev > 0 ? prev.matched / totalPrev : 0

    const reportsCount = await db.reconciliation.count({ where: { userId: user.id, status: 'completed' } })
    const reportsPrev = await db.reconciliation.count({ where: { userId: user.id, status: 'completed', startedAt: { lt: sevenDaysAgo } } })

    // Project status breakdown for donut
    const statusLabels: Record<string, string> = user.locale === 'fa'
      ? { draft: 'تکمیل کامل', reconciled: 'تطبیق‌یاضافی', processing: 'در حال تطبیق', ready: 'آماده تطبیق', archived: 'بایگانی', failed: 'ناموفق' }
      : { draft: 'Fully matched', reconciled: 'AI recommended', processing: 'Under review', ready: 'Needs review', archived: 'Archived', failed: 'Failed' }

    const statusCounts: Record<string, number> = {}
    for (const p of projects) {
      statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1
    }
    const donutKeys = ['reconciled', 'draft', 'processing', 'ready', 'archived', 'failed']
    const projectStatusBreakdown = donutKeys
      .map((key) => ({ key, label: statusLabels[key] ?? key, count: statusCounts[key] ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .filter((x) => x.count > 0)

    const latestProjects = projects.slice(0, 6).map((p) => {
      const latest = p.reconciliations[0]
      let stats: DashboardStats['latestProjects'][number]['latestStats'] = null
      if (latest?.stats) {
        try {
          const s = JSON.parse(latest.stats) as { totalGroups?: number; matchedTotal?: number; aiMatched?: number; unmatched?: number }
          const total = s.totalGroups ?? 0
          const matched = s.matchedTotal ?? 0
          stats = {
            total,
            matched,
            aiMatched: s.aiMatched ?? 0,
            unmatched: s.unmatched ?? 0,
            matchRatePct: total > 0 ? Math.round((matched / total) * 100) : 0,
            discrepancies: s.unmatched ?? 0,
          }
        } catch {}
      }
      const df = new Intl.DateTimeFormat(user.locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })
      const fileTx = p.files.reduce((a, f) => a + f.txCount, 0)
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        lastReconciledAt: p.lastReconciledAt?.toISOString() ?? null,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        categoryColor: p.category?.color ?? null,
        fileCount: p.files.length,
        txCount: fileTx,
        latestStats: stats,
        dateLabel: df.format(p.lastReconciledAt ?? p.updatedAt),
        progressLabel: `${fileTx.toLocaleString(user.locale === 'fa' ? 'fa-IR' : 'en-US')} / ${p.files.length.toLocaleString(user.locale === 'fa' ? 'fa-IR' : 'en-US')}`,
      }
    })

    const spark = (arr: number[]) => arr
    const providersCount = await db.aiProvider.count({ where: { userId: user.id } })

    const stats: DashboardStats = {
      successTransactions: { total: successfulTx, trendPct: pctChange(cur.matched, prev.matched), spark: spark(trend.map((t) => t.matches)) },
      discrepancies: { total: projects.reduce((acc, p) => acc + (p.reconciliations[0]?.stats ? (JSON.parse(p.reconciliations[0].stats).unmatched ?? 0) : 0), 0) + cur.discrepancy, trendPct: pctChange(cur.discrepancy, prev.discrepancy), spark: spark(trend.map((t) => t.discrepancies)) },
      reports: { total: reportsCount, trendPct: pctChange(reportsCount - reportsPrev, reportsPrev), spark: spark(trend.map((t) => t.matches + t.discrepancies)) },
      matchRate: { pct: Math.round(matchRate * 1000) / 10, trendPct: pctChange(Math.round(matchRate * 100), Math.round(matchRatePrev * 100)), spark: spark(trend.map((t) => t.matches)) },
      projectStatusBreakdown,
      totalReports: reportsCount,
      trend7Days: trend,
      latestProjects,
      overall: {
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => ['processing', 'ready'].includes(p.status)).length,
        completedProjects: projects.filter((p) => p.status === 'reconciled').length,
        totalFiles: projects.reduce((acc, p) => acc + p.files.length, 0),
        aiReady: true,
        unmatchedTotal: cur.discrepancy,
      },
    }

    void DEFAULT_CONFIG
    return jsonOk(stats)
  })
}
