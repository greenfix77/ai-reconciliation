import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireAdmin } from '@/lib/http'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/** GET /api/admin/stats — global platform metrics for the admin dashboard widgets. */
export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    await requireAdmin()

    const dayMs = 24 * 60 * 60 * 1000
    const now = new Date()
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
    const start7 = new Date(now.getTime() - 7 * dayMs); start7.setHours(0, 0, 0, 0)
    const start30 = new Date(now.getTime() - 30 * dayMs); start30.setHours(0, 0, 0, 0)

    const [totalUsers, activeUsers, disabledUsers, adminUsers, newUsers30d, totalProjects, projects30d, totalReconciliations, reconciliations30d, aiCallsToday, aiCalls7d, failedLogins7d, blockedLogins7d, notifications] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: 'active' } }),
      db.user.count({ where: { status: 'disabled' } }),
      db.user.count({ where: { role: 'admin' } }),
      db.user.count({ where: { createdAt: { gte: start30 } } }),
      db.project.count(),
      db.project.count({ where: { createdAt: { gte: start30 } } }),
      db.reconciliation.count(),
      db.reconciliation.count({ where: { startedAt: { gte: start30 } } }),
      db.activityLog.count({ where: { action: { in: ['ai_chat', 'ai_tool_used'] }, createdAt: { gte: startToday } } }),
      db.activityLog.count({ where: { action: { in: ['ai_chat', 'ai_tool_used'] }, createdAt: { gte: start7 } } }),
      db.activityLog.count({ where: { action: 'login_failed', createdAt: { gte: start7 } } }),
      db.activityLog.count({ where: { action: 'login_blocked', createdAt: { gte: start7 } } }),
      db.notification.count(),
    ])

    // Users registered per day (last 14 days)
    const users14: { date: string; count: number }[] = []
    const projects14: { date: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const from = new Date(now.getTime() - i * dayMs); from.setHours(0, 0, 0, 0)
      const to = new Date(from.getTime() + dayMs)
      const [u, p] = await Promise.all([
        db.user.count({ where: { createdAt: { gte: from, lt: to } } }),
        db.project.count({ where: { createdAt: { gte: from, lt: to } } }),
      ])
      users14.push({ date: from.toISOString().slice(0, 10), count: u })
      projects14.push({ date: from.toISOString().slice(0, 10), count: p })
    }

    // Reconciliation volume per day (last 7 days)
    const recon7: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const from = new Date(now.getTime() - i * dayMs); from.setHours(0, 0, 0, 0)
      const to = new Date(from.getTime() + dayMs)
      recon7.push({ date: from.toISOString().slice(0, 10), count: await db.reconciliation.count({ where: { startedAt: { gte: from, lt: to } } }) })
    }

    // Top 5 most active users (by audited actions, last 30 days)
    const recentLogs = await db.activityLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: start30 }, userId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    })
    const topUsersRaw = await db.user.findMany({
      where: { id: { in: recentLogs.map((r) => r.userId as string) } },
      select: { id: true, name: true, email: true, role: true, status: true },
    })
    const topUsers = recentLogs
      .map((r) => {
        const u = topUsersRaw.find((t) => t.id === r.userId)
        return u ? { ...u, actions: r._count._all } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    // Recent registrations (last 8)
    const recentUsers = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, lastLoginAt: true },
    })

    // Project status distribution
    const projectStatus = await db.project.groupBy({ by: ['status'], _count: { _all: true } })

    // Storage used (files on disk under db/uploads) — approximate via file rows
    const fileRows = await db.file.findMany({ select: { size: true } }).catch(() => [] as { size: number }[])
    const storageBytes = fileRows.reduce((acc, f) => acc + (f.size ?? 0), 0)

    return jsonOk({
      kpis: {
        totalUsers, activeUsers, disabledUsers, adminUsers, newUsers30d,
        totalProjects, projects30d,
        totalReconciliations, reconciliations30d,
        aiCallsToday, aiCalls7d,
        failedLogins7d, blockedLogins7d,
        storageBytes,
      },
      charts: { users14, projects14, recon7, projectStatus: projectStatus.map((s) => ({ status: s.status, count: s._count._all })) },
      topUsers,
      recentUsers,
    })
  })
}
