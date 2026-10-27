import { ApiError } from '@/lib/http'
import { db } from '@/lib/db'
import { DEFAULT_CONFIG, FileItem, ProjectListItem, ReconciliationConfig, ReconciliationStats } from '@/lib/types'

/** Shared helpers for project-scoped API routes (agent 2-b). */

const CLAMP = { numeric: 100_000, aiBatchMin: 5, aiBatchMax: 100 }

export function parseConfig(raw: string | null | undefined): ReconciliationConfig {
  const base: ReconciliationConfig = { ...DEFAULT_CONFIG }
  if (!raw) return base
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.matchDirection === 'opposite' || parsed.matchDirection === 'same') base.matchDirection = parsed.matchDirection
    if (typeof parsed.amountToleranceMinor === 'number' && Number.isFinite(parsed.amountToleranceMinor)) base.amountToleranceMinor = parsed.amountToleranceMinor
    if (typeof parsed.dateToleranceDays === 'number' && Number.isFinite(parsed.dateToleranceDays)) base.dateToleranceDays = parsed.dateToleranceDays
    for (const key of ['requireExactDate', 'useDescriptionMatching', 'useReferenceMatching', 'allowOneToMany', 'allowManyToOne', 'detectDuplicates'] as const) {
      if (typeof parsed[key] === 'boolean') base[key] = parsed[key]
    }
    if (typeof parsed.aiBatchSize === 'number' && Number.isFinite(parsed.aiBatchSize)) base.aiBatchSize = parsed.aiBatchSize
    if (typeof parsed.minAutoConfidence === 'number' && Number.isFinite(parsed.minAutoConfidence)) base.minAutoConfidence = parsed.minAutoConfidence
  } catch {
    // corrupted config -> defaults
  }
  return sanitizeConfig(base)
}

/** Merge a partial (untrusted) config patch onto an existing config, clamping all numeric ranges. */
export function mergeConfig(existing: ReconciliationConfig, patch: Record<string, unknown>): ReconciliationConfig {
  const merged: ReconciliationConfig = { ...existing }
  if (patch.matchDirection === 'opposite' || patch.matchDirection === 'same') merged.matchDirection = patch.matchDirection
  if (typeof patch.amountToleranceMinor === 'number' && Number.isFinite(patch.amountToleranceMinor)) {
    merged.amountToleranceMinor = Math.round(clamp(patch.amountToleranceMinor, 0, CLAMP.numeric))
  }
  if (typeof patch.dateToleranceDays === 'number' && Number.isFinite(patch.dateToleranceDays)) {
    merged.dateToleranceDays = Math.round(clamp(patch.dateToleranceDays, 0, CLAMP.numeric))
  }
  for (const key of ['requireExactDate', 'useDescriptionMatching', 'useReferenceMatching', 'allowOneToMany', 'allowManyToOne', 'detectDuplicates'] as const) {
    if (typeof patch[key] === 'boolean') merged[key] = patch[key]
  }
  if (typeof patch.aiBatchSize === 'number' && Number.isFinite(patch.aiBatchSize)) {
    merged.aiBatchSize = Math.round(clamp(patch.aiBatchSize, CLAMP.aiBatchMin, CLAMP.aiBatchMax))
  }
  if (typeof patch.minAutoConfidence === 'number' && Number.isFinite(patch.minAutoConfidence)) {
    merged.minAutoConfidence = clamp(patch.minAutoConfidence, 0, 1)
  }
  return sanitizeConfig(merged)
}

export function sanitizeConfig(input: unknown): ReconciliationConfig {
  const c = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const num = (v: unknown, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt)
  const bool = (v: unknown, dflt: boolean) => (typeof v === 'boolean' ? v : dflt)
  return {
    matchDirection: c.matchDirection === 'same' ? 'same' : 'opposite',
    amountToleranceMinor: Math.round(clamp(num(c.amountToleranceMinor, DEFAULT_CONFIG.amountToleranceMinor), 0, CLAMP.numeric)),
    dateToleranceDays: Math.round(clamp(num(c.dateToleranceDays, DEFAULT_CONFIG.dateToleranceDays), 0, CLAMP.numeric)),
    requireExactDate: bool(c.requireExactDate, DEFAULT_CONFIG.requireExactDate),
    useDescriptionMatching: bool(c.useDescriptionMatching, DEFAULT_CONFIG.useDescriptionMatching),
    useReferenceMatching: bool(c.useReferenceMatching, DEFAULT_CONFIG.useReferenceMatching),
    allowOneToMany: bool(c.allowOneToMany, DEFAULT_CONFIG.allowOneToMany),
    allowManyToOne: bool(c.allowManyToOne, DEFAULT_CONFIG.allowManyToOne),
    detectDuplicates: bool(c.detectDuplicates, DEFAULT_CONFIG.detectDuplicates),
    aiBatchSize: Math.round(clamp(num(c.aiBatchSize, DEFAULT_CONFIG.aiBatchSize), CLAMP.aiBatchMin, CLAMP.aiBatchMax)),
    minAutoConfidence: clamp(num(c.minAutoConfidence, DEFAULT_CONFIG.minAutoConfidence), 0, 1),
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Ownership-checked project fetch. Throws 404 when missing or not owned. */
export async function findOwnedProject(projectId: string, userId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, userId } })
  if (!project) throw new ApiError(404, 'Project not found', 'NOT_FOUND')
  return project
}

export function toFileItem(file: {
  id: string
  originalName: string
  side: string
  status: string
  txCount: number
  size: number
  parseError: string | null
  createdAt: Date
}): FileItem {
  return {
    id: file.id,
    originalName: file.originalName,
    side: file.side === 'A' ? 'A' : 'B',
    status: file.status,
    txCount: file.txCount,
    size: file.size,
    parseError: file.parseError,
    createdAt: file.createdAt.toISOString(),
  }
}

/** Parse latest reconciliation stats JSON into the client DTO (computes matchRatePct when absent). */
export function parseLatestStats(raw: string | null | undefined) {
  if (!raw) return null
  let s: Record<string, unknown>
  try {
    s = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
  const n = (key: string): number => {
    const v = s[key]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  }
  const matched = Math.max(0, n('matchedTotal'))
  const unmatched = Math.max(0, n('unmatched'))
  const denom = matched + unmatched
  const matchRatePct = denom > 0 ? Math.round((matched / denom) * 1000) / 10 : 0
  return {
    total: Math.max(0, n('totalGroups')),
    matched,
    aiMatched: Math.max(0, n('aiMatched')),
    unmatched,
    matchRatePct,
    discrepancies: Math.max(0, n('unmatched') + n('missingA') + n('missingB')),
  }
}

export function parseReconciliationStats(raw: string | null | undefined): ReconciliationStats | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ReconciliationStats>
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as ReconciliationStats
  } catch {
    return null
  }
}

function dateLabelFor(date: Date, locale: string): string {
  const tag = locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB'
  try {
    return new Intl.DateTimeFormat(tag, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function numLabel(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n)
}

type ProjectWithRelations = {
  id: string
  name: string
  description: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  lastReconciledAt: Date | null
  categoryId: string | null
  category?: { id: string; name: string; color: string } | null
  files: { txCount: number }[]
}

export function toProjectListItem(
  project: ProjectWithRelations,
  latestStatsRaw: string | null,
  locale: string
): ProjectListItem {
  const fileCount = project.files.length
  const txCount = project.files.reduce((acc, f) => acc + f.txCount, 0)
  const numFmt = (n: number) => numLabel(n, locale)
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    lastReconciledAt: project.lastReconciledAt ? project.lastReconciledAt.toISOString() : null,
    categoryId: project.categoryId,
    categoryName: project.category?.name ?? null,
    categoryColor: project.category?.color ?? null,
    fileCount,
    txCount,
    latestStats: parseLatestStats(latestStatsRaw),
    dateLabel: dateLabelFor(project.createdAt, locale),
    progressLabel: `${numFmt(txCount)} / ${numFmt(fileCount)}`,
  }
}
