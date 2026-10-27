/** Shared DTOs & enums — single source of truth for frontend + backend. */

export type Locale = 'fa' | 'en'

export type ViewName =
  | 'dashboard'
  | 'projects'
  | 'project-detail'
  | 'categories'
  | 'reports'
  | 'aitools'
  | 'providers'
  | 'settings'
  | 'help'
  | 'admin'

// ---------- Config ----------

export type ReconciliationConfig = {
  matchDirection: 'opposite' | 'same' // opposite: bank vs books (sums cancel); same: two same-perspective statements (amounts equal)
  amountToleranceMinor: number // allowed |Δ| in minor units
  dateToleranceDays: number
  requireExactDate: boolean
  useDescriptionMatching: boolean
  useReferenceMatching: boolean
  allowOneToMany: boolean
  allowManyToOne: boolean
  detectDuplicates: boolean
  aiBatchSize: number // candidates per AI call
  minAutoConfidence: number // 0..1 — below → human review
}

export const DEFAULT_CONFIG: ReconciliationConfig = {
  matchDirection: 'opposite',
  amountToleranceMinor: 0,
  dateToleranceDays: 0,
  requireExactDate: false,
  useDescriptionMatching: true,
  useReferenceMatching: true,
  allowOneToMany: true,
  allowManyToOne: true,
  detectDuplicates: true,
  aiBatchSize: 30,
  minAutoConfidence: 0.65,
}

// ---------- Auth ----------

export type AuthResponse = {
  user: PublicUser
}

export type PublicUser = {
  id: string
  email: string
  name: string
  role: string
  status: string
  locale: string
  theme: string
  currency: string
}

// ---------- Dashboard ----------

export type DashboardStats = {
  successTransactions: { total: number; trendPct: number; spark: number[] }
  discrepancies: { total: number; trendPct: number; spark: number[] }
  reports: { total: number; trendPct: number; spark: number[] }
  matchRate: { pct: number; trendPct: number; spark: number[] }
  projectStatusBreakdown: { key: string; label: string; count: number }[]
  totalReports: number
  trend7Days: { day: string; discrepancies: number; matches: number }[]
  latestProjects: ProjectListItem[]
  overall: {
    totalProjects: number
    activeProjects: number
    completedProjects: number
    totalFiles: number
    aiReady: boolean
    unmatchedTotal: number
  }
}

// ---------- Projects ----------

export type ProjectListItem = {
  id: string
  name: string
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
  lastReconciledAt: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  fileCount: number
  txCount: number
  latestStats: {
    total: number
    matched: number
    aiMatched: number
    unmatched: number
    matchRatePct: number
    discrepancies: number
  } | null
  dateLabel: string // e.g. "1404/07/16"
  progressLabel: string // e.g. "1,320 / 150"
}

export type ProjectDetail = ProjectListItem & {
  config: ReconciliationConfig
  aiProviderId: string | null
  aiModel: string | null
  files: FileItem[]
  category?: { id: string; name: string; color: string } | null
}

export type FileItem = {
  id: string
  originalName: string
  side: 'A' | 'B'
  status: string
  txCount: number
  size: number
  parseError: string | null
  createdAt: string
}

// ---------- Categories ----------

export type CategoryItem = {
  id: string
  name: string
  color: string
  projectCount: number
  createdAt: string
}

// ---------- Results ----------

export type ResultGroup = {
  id: string
  type: string
  status: string
  confidence: number
  amountDiffMinor: number
  dateDiffDays: number | null
  descSimilarity: number
  explanation: string | null
  evidence: string[] | null
  validationStatus: string
  userNote: string | null
  decidedBy: string
  items: ResultGroupItem[]
}

export type ResultGroupItem = {
  id: string
  side: 'A' | 'B'
  transaction: {
    id: string
    rowIndex: number
    date: string | null
    description: string | null
    reference: string | null
    amountMinor: number
    balance: number | null
    flags: string[]
  }
  file: { id: string; originalName: string }
}

export type ResultsResponse = {
  reconciliation: {
    id: string
    status: string
    startedAt: string
    finishedAt: string | null
    providerName: string
    model: string
    config: ReconciliationConfig
    stats: ReconciliationStats | null
  } | null
  groups: ResultGroup[]
  jobs: JobItem[]
}

export type ReconciliationStats = {
  totalA: number
  totalB: number
  exactMatched: number
  aiMatched: number
  oneToMany: number
  manyToOne: number
  amountDiff: number
  dateDiff: number
  duplicates: number
  missingA: number
  missingB: number
  unmatched: number
  totalGroups: number
  matchedTotal: number
  matchRatePct: number
  amountDiffMinorTotal: number
}

export type JobItem = {
  id: string
  type: string
  status: string
  progress: number
  total: number
  stage: string | null
  error: string | null
  createdAt: string
}

// ---------- Providers ----------

export type ProviderItem = {
  id: string
  name: string
  type: string
  baseUrl: string | null
  keyHint: string
  models: string[]
  isDefault: boolean
  status: string
  lastTestedAt: string | null
  createdAt: string
}

// ---------- AI ----------

export type AiChatMessage = { role: 'user' | 'assistant'; content: string }

export type AiToolType =
  | 'discrepancy_analysis'
  | 'root_cause'
  | 'resolution_recommendations'
  | 'accounting_entries'
  | 'anomaly_detection'
  | 'report_generation'
  | 'project_comparison'
  | 'ai_config_recommendation'
  | 'file_structure_analysis'

// ---------- Jobs ----------

export type JobStatus = JobItem & { projectId: string | null }
