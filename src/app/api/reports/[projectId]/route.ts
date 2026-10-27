import { NextRequest, NextResponse } from 'next/server'
import { handleApi, jsonOk, requireUser, ApiError } from '@/lib/http'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'
import { ReconciliationConfig, ReconciliationStats, ResultGroup } from '@/lib/types'
import * as XLSX from 'xlsx'

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const runtime = 'nodejs'

/**
 * GET /api/reports/[projectId] — report of the LATEST completed reconciliation.
 * Query: ?type=<MatchGroup type>&format=csv|xlsx|json (default json)
 * - json: reconciliation + groups (ResultGroup[]) + per-type counts — for the UI dialog
 * - csv:  Excel-friendly UTF-8 (BOM) Persian report
 * - xlsx: binary workbook via `xlsx`
 * SECURITY: project ownership is verified before any data leaves the server.
 */

const GROUP_TYPES = [
  'exact',
  'ai_match',
  'one_to_many',
  'many_to_one',
  'amount_diff',
  'date_diff',
  'missing_a',
  'missing_b',
  'duplicate',
  'unmatched',
  'invalid',
] as const

const TYPE_LABELS_FA: Record<string, string> = {
  exact: 'تطبیق کامل',
  ai_match: 'تطبیق هوشمند',
  one_to_many: 'یک به چند',
  many_to_one: 'چند به یک',
  amount_diff: 'اختلاف مبلغ',
  date_diff: 'اختلاف تاریخ',
  missing_a: 'فاقد در فایل A',
  missing_b: 'فاقد در فایل B',
  duplicate: 'تراکنش تکراری',
  unmatched: 'تطبیق‌نشده',
  invalid: 'نامعتبر',
}

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeFlags(raw: string | null | undefined): string[] {
  const parsed = safeParse<unknown>(raw, [])
  return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === 'string') : []
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.split('"').join('""')}"`
  return value
}

type ReportRow = {
  idx: number
  date: string
  description: string
  reference: string
  debit: string
  credit: string
  amount: string
  side: string
  file: string
  type: string
}

function major(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })
}

function buildRows(groups: ResultGroup[]): ReportRow[] {
  let idx = 0
  const rows: ReportRow[] = []
  for (const g of groups) {
    for (const item of g.items) {
      idx += 1
      const t = item.transaction
      const amountMajor = major(t.amountMinor)
      rows.push({
        idx,
        date: t.date ? t.date.slice(0, 10) : '',
        description: t.description ?? '',
        reference: t.reference ?? '',
        debit: t.amountMinor < 0 ? major(Math.abs(t.amountMinor)) : '',
        credit: t.amountMinor > 0 ? amountMajor : '',
        amount: amountMajor,
        side: item.side,
        file: item.file.originalName,
        type: TYPE_LABELS_FA[g.type] ?? g.type,
      })
    }
  }
  return rows
}

const CSV_HEADERS = ['ردیف', 'تاریخ', 'شرح', 'مرجع', 'بدهکار', 'بستانکار', 'مبلغ', 'طرف', 'فایل', 'نوع']

function toCsv(rows: ReportRow[]): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const r of rows) {
    lines.push(
      [r.idx, r.date, r.description, r.reference, r.debit, r.credit, r.amount, r.side, r.file, r.type]
        .map((v) => csvEscape(String(v)))
        .join(',')
    )
  }
  // BOM (\uFEFF) so Excel renders Persian correctly
  return '\uFEFF' + lines.join('\r\n')
}

function toXlsxBuffer(rows: ReportRow[]): Buffer {
  const data = rows.map((r) => ({
    [CSV_HEADERS[0]]: r.idx,
    [CSV_HEADERS[1]]: r.date,
    [CSV_HEADERS[2]]: r.description,
    [CSV_HEADERS[3]]: r.reference,
    [CSV_HEADERS[4]]: r.debit,
    [CSV_HEADERS[5]]: r.credit,
    [CSV_HEADERS[6]]: r.amount,
    [CSV_HEADERS[7]]: r.side,
    [CSV_HEADERS[8]]: r.file,
    [CSV_HEADERS[9]]: r.type,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 7 }, // ردیف
    { wch: 12 }, // تاریخ
    { wch: 42 }, // شرح
    { wch: 18 }, // مرجع
    { wch: 15 }, // بدهکار
    { wch: 15 }, // بستانکار
    { wch: 15 }, // مبلغ
    { wch: 6 }, // طرف
    { wch: 26 }, // فایل
    { wch: 14 }, // نوع
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  return handleApi(req, async () => {
    const { projectId } = await params
    const user = await requireUser()

    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
      select: { id: true, name: true },
    })
    if (!project) throw new ApiError(404, 'Project not found', 'NOT_FOUND')

    const recon = await db.reconciliation.findFirst({
      where: { projectId, userId: user.id, status: 'completed' },
      orderBy: { startedAt: 'desc' },
    })
    if (!recon) throw new ApiError(404, 'No completed reconciliation found for this project', 'NOT_FOUND')

    const url = new URL(req.url)
    const format = (url.searchParams.get('format') ?? 'json').toLowerCase()
    const typeParam = url.searchParams.get('type')
    const type = typeParam && (GROUP_TYPES as readonly string[]).includes(typeParam) ? typeParam : null

    // Per-type counts over the WHOLE reconciliation (unfiltered summary)
    const allTypeRows = await db.matchGroup.findMany({
      where: { reconciliationId: recon.id },
      select: { type: true },
    })
    const counts: Record<string, number> = {}
    for (const row of allTypeRows) counts[row.type] = (counts[row.type] ?? 0) + 1

    // Groups (optionally filtered by type) with transactions + file names
    const groupsRaw = await db.matchGroup.findMany({
      where: { reconciliationId: recon.id, ...(type ? { type } : {}) },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const txIds = [...new Set(groupsRaw.flatMap((g) => g.items.map((i) => i.transactionId)))]
    const txs = await db.transaction.findMany({
      where: { id: { in: txIds } },
      include: { file: { select: { id: true, originalName: true } } },
    })
    const txMap = new Map(txs.map((t) => [t.id, t]))

    const groups: ResultGroup[] = groupsRaw.map((g) => ({
      id: g.id,
      type: g.type,
      status: g.status,
      confidence: g.confidence,
      amountDiffMinor: g.amountDiffMinor,
      dateDiffDays: g.dateDiffDays,
      descSimilarity: g.descSimilarity,
      explanation: g.explanation,
      evidence: parseJsonSafe<string[] | null>(g.evidence, null),
      validationStatus: g.validationStatus,
      userNote: g.userNote,
      decidedBy: g.decidedBy,
      items: g.items.map((item) => {
        const tx = txMap.get(item.transactionId)
        return {
          id: item.id,
          side: item.side === 'B' ? ('B' as const) : ('A' as const),
          transaction: {
            id: tx?.id ?? item.transactionId,
            rowIndex: tx?.rowIndex ?? 0,
            date: tx?.date?.toISOString() ?? null,
            description: tx?.description ?? null,
            reference: tx?.reference ?? null,
            amountMinor: tx?.amountMinor ?? 0,
            balance: tx?.balance ?? null,
            flags: safeFlags(tx?.flags),
          },
          file: { id: tx?.file?.id ?? '', originalName: tx?.file?.originalName ?? '' },
        }
      }),
    }))

    if (format === 'csv' || format === 'xlsx') {
      const rows = buildRows(groups)
      const typeSlug = type ?? 'all'
      if (format === 'csv') {
        const csv = toCsv(rows)
        await audit({
          userId: user.id,
          action: 'export_report',
          entityType: 'reconciliation',
          entityId: recon.id,
          meta: { projectId, type: typeSlug, format: 'csv', rows: rows.length },
          req,
        })
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="report-${projectId}-${typeSlug}.csv"`,
            'Cache-Control': 'no-store',
          },
        })
      }
      const buf = toXlsxBuffer(rows)
      await audit({
        userId: user.id,
        action: 'export_report',
        entityType: 'reconciliation',
        entityId: recon.id,
        meta: { projectId, type: typeSlug, format: 'xlsx', rows: rows.length },
        req,
      })
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="report-${projectId}-${typeSlug}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return jsonOk({
      project: { id: project.id, name: project.name },
      reconciliation: {
        id: recon.id,
        status: recon.status,
        startedAt: recon.startedAt.toISOString(),
        finishedAt: recon.finishedAt?.toISOString() ?? null,
        providerName: recon.providerName,
        model: recon.model,
        config: safeParse<ReconciliationConfig>(recon.config, {} as ReconciliationConfig),
        stats: safeParse<ReconciliationStats | null>(recon.stats, null),
      },
      counts,
      groups,
    })
  })
}
