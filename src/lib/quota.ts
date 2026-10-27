import { db } from './db'
import { User } from '@prisma/client'

/**
 * Per-user quota enforcement backed by PlatformSetting defaults.
 * Platform defaults are read from the PlatformSetting table (admin-editable);
 * per-user overrides on the User row take precedence when non-null.
 */

export type PlatformDefaults = {
  defaultMaxProjects: number
  defaultDailyAiLimit: number
  registrationOpen: boolean
}

export type EffectiveQuota = {
  maxProjects: number
  dailyAiLimit: number
  canUseAi: boolean
}

const FALLBACK: PlatformDefaults = {
  defaultMaxProjects: 20,
  defaultDailyAiLimit: 100,
  registrationOpen: true,
}

export async function getPlatformDefaults(): Promise<PlatformDefaults> {
  try {
    const rows = await db.platformSetting.findMany({ where: { key: { in: ['defaultMaxProjects', 'defaultDailyAiLimit', 'registrationOpen'] } } })
    const map = new Map(rows.map((r) => [r.key, r.value]))
    const num = (key: string, fb: number) => {
      const v = map.get(key)
      const n = v === undefined ? NaN : Number(v)
      return Number.isFinite(n) && n >= 0 ? n : fb
    }
    return {
      defaultMaxProjects: num('defaultMaxProjects', FALLBACK.defaultMaxProjects),
      defaultDailyAiLimit: num('defaultDailyAiLimit', FALLBACK.defaultDailyAiLimit),
      registrationOpen: map.get('registrationOpen') !== 'false',
    }
  } catch {
    return FALLBACK
  }
}

export function effectiveQuota(user: Pick<User, 'maxProjects' | 'dailyAiLimit' | 'canUseAi'>, defaults: PlatformDefaults): EffectiveQuota {
  return {
    maxProjects: user.maxProjects ?? defaults.defaultMaxProjects,
    dailyAiLimit: user.dailyAiLimit ?? defaults.defaultDailyAiLimit,
    canUseAi: user.canUseAi,
  }
}

/** Count AI calls made by a user today (chat + tools) from the audit trail. */
export async function aiCallsToday(userId: string): Promise<number> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return db.activityLog.count({
    where: { userId, action: { in: ['ai_chat', 'ai_tool_used'] }, createdAt: { gte: start } },
  })
}

export type QuotaCheck = { allowed: true } | { allowed: false; reason: 'ai_disabled' | 'ai_daily_limit' | 'projects_limit'; limit?: number; used?: number }

async function getUserQuotaRow(userId: string): Promise<Pick<User, 'id' | 'maxProjects' | 'dailyAiLimit' | 'canUseAi'> | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, maxProjects: true, dailyAiLimit: true, canUseAi: true },
  })
}

export async function checkAiQuota(userId: string): Promise<QuotaCheck> {
  const user = await getUserQuotaRow(userId)
  if (!user) return { allowed: false, reason: 'ai_disabled' }
  const defaults = await getPlatformDefaults()
  const quota = effectiveQuota(user, defaults)
  if (!quota.canUseAi) return { allowed: false, reason: 'ai_disabled' }
  const used = await aiCallsToday(user.id)
  if (used >= quota.dailyAiLimit) return { allowed: false, reason: 'ai_daily_limit', limit: quota.dailyAiLimit, used }
  return { allowed: true }
}

export async function checkProjectQuota(userId: string): Promise<QuotaCheck> {
  const user = await getUserQuotaRow(userId)
  if (!user) return { allowed: false, reason: 'projects_limit', limit: 0, used: 0 }
  const defaults = await getPlatformDefaults()
  const quota = effectiveQuota(user, defaults)
  const owned = await db.project.count({ where: { userId: user.id } })
  if (owned >= quota.maxProjects) return { allowed: false, reason: 'projects_limit', limit: quota.maxProjects, used: owned }
  return { allowed: true }
}
