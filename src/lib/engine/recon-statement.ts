import { db } from '@/lib/db'
import { fromDbMinor } from '@/lib/money'
import { ApiError } from '@/lib/http'
import { gregorianToJalaali } from '@/lib/jalali'

/**
 * صورت مغایرت بانکی — Bank Reconciliation Statement
 * ---------------------------------------------------
 * Classic Iranian bank-reconciliation model (extracted from the client's
 * official form.xlsx / «صورت مغایرت بانکی حساب جاری»):
 *
 *   مانده طبق دفتر                              مانده طبق بانک
 * + اقلام بستانکار بانک (واریز ثبت‌نشده در دفتر)  + اقلام بدهکار دفتر (واریز ثبت‌شده ولی وصول‌نشده در بانک)
 * − اقلام بدهکار بانک (برداشت/کارمزد ثبت‌نشده)    − اقلام بستانکار دفتر (برداشت ثبت‌شده ولی نزد بانک انجام‌نشده)
 * = مانده واقعی                                 = مانده واقعی
 *
 * Both sides must converge to the same «مانده واقعی».
 * Open items (اقلام باز) = transactions that were NOT paired by the engine
 * (types missing_a / missing_b / unmatched / duplicate), each classified by
 * its cash-flow direction on its own side.
 */

export const PAIRED_GROUP_TYPES = ['exact', 'ai_match', 'one_to_many', 'many_to_one', 'amount_diff', 'date_diff'] as const
export const OPEN_GROUP_TYPES = ['missing_a', 'missing_b', 'unmatched', 'duplicate'] as const

/** balance precision: files store مانده as Float major units — treat diffs below this as zero */
const CONVERGENCE_TOLERANCE_MINOR = 1_000 // = 10 ریال

export interface StatementOpenItem {
  groupId: string
  groupType: string
  transactionId: string
  side: 'A' | 'B'
  rowIndex: number
  date: string | null
  time: string | null
  description: string | null
  reference: string | null
  fileName: string | null
  /** signed amount as stored in DB (minor units) */
  amountMinor: number
  /** positive = money flowing INTO the fund's account (واریز/بدهكار), negative = out */
  inflowMinor: number
  /** Jalali 'YYYY-MM' key for month grouping of bank items */
  monthKey: string | null
  flags: string[]
}

export interface BankReconStatement {
  projectId: string
  projectName: string
  reconciliationId: string
  finishedAt: string | null
  configDirection: 'opposite' | 'same'
  bookSide: 'A' | 'B'
  bankSide: 'A' | 'B'
  bookClosingMinor: number | null
  bankClosingMinor: number | null
  bookBalanceSource: 'file' | 'turnover' | 'none'
  bankBalanceSource: 'file' | 'turnover' | 'none'
  bookAsOfDate: string | null
  bankAsOfDate: string | null
  bankCreditsOpen: StatementOpenItem[] // اقلام بستانکار بانک → + to book side
  bankDebitsOpen: StatementOpenItem[] // اقلام بدهکار بانک   → − from book side
  bookDebitsOpen: StatementOpenItem[] // اقلام بدهکار دفتر   → + to bank side
  bookCreditsOpen: StatementOpenItem[] // اقلام بستانکار دفتر → − from bank side
  totals: {
    bankCreditsMinor: number
    bankDebitsMinor: number
    bookDebitsMinor: number
    bookCreditsMinor: number
    bankCreditsCount: number
    bankDebitsCount: number
    bookDebitsCount: number
    bookCreditsCount: number
  }
  trueBalanceFromBookMinor: number
  trueBalanceFromBankMinor: number
  residualMinor: number
  converged: boolean
  generatedAt: string
}

function parseFlags(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as string[]) : []
  } catch {
    return []
  }
}

/** extract HH:MM(:SS) from a description like «بابت ... 1405/08/04 * 10:16» */
function extractTime(desc: string | null | undefined): string | null {
  if (!desc) return null
  const m = desc.match(/(\d{1,2}:\d{2}(?::\d{2})?)/)
  return m ? m[1] : null
}

/**
 * Opening-balance carrier rows («گردش از قبل», «مانده ابتدای دوره», «افتتاحیه»)
 * are not transactions — they only carry the opening balance into the file and
 * must never appear as open items in the statement.
 */
function isOpeningRow(desc: string | null | undefined): boolean {
  if (!desc) return false
  return /گردش\s*از\s*قبل|مانده\s*ابتدا|افتتاحیه|opening\s*balance/i.test(desc)
}

function jalaliMonthKey(d: Date): string {
  const { jy, jm } = gregorianToJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return `${jy}-${String(jm).padStart(2, '0')}`
}

interface HydratedItem {
  groupId: string
  groupType: string
  transactionId: string
  side: 'A' | 'B'
  rowIndex: number
  date: Date | null
  description: string | null
  reference: string | null
  fileName: string | null
  amountMinor: number
  flags: string[]
}

/**
 * Infer the sign that converts a BOOK-side stored amount into «inflow».
 * Bank-statement vocabulary (واریز/برداشت) is customer-perspective: inflow = +amount.
 * Ledger vocabulary (بدهكار/بستانكار) is asset-perspective: inflow = −amount.
 * Instead of guessing vocabulary, we vote over MATCHED PAIRS: for each pair,
 * book inflow must equal bank inflow (same economic event) → the sign that makes
 * s*bookAmt correlate positively with bankAmt wins.
 */
function inferBookSign(pairs: { bankAmt: number; bookAmt: number }[], direction: 'opposite' | 'same'): number {
  if (pairs.length === 0) return direction === 'opposite' ? -1 : 1
  let plus = 0
  let minus = 0
  for (const { bankAmt, bookAmt } of pairs) {
    if (bankAmt === 0 || bookAmt === 0) continue
    if (bankAmt * bookAmt > 0) plus += 1
    else minus += 1
  }
  if (plus === minus) return direction === 'opposite' ? -1 : 1
  // s=+1 correlates when raw signs agree; s=−1 when they disagree
  return plus > minus ? 1 : -1
}

/** pair items within a group (1:N / N:1 aware) to feed the sign vote */
function pairGroupItems(a: HydratedItem[], b: HydratedItem[]): { bankAmt: number; bookAmt: number }[] {
  const out: { bankAmt: number; bookAmt: number }[] = []
  const [few, many, fewIsBank] = a.length <= b.length ? [a, b, true] : [b, a, false]
  const sortedMany = [...many].sort((x, y) => Math.abs(y.amountMinor) - Math.abs(x.amountMinor))
  for (const f of few) {
    // greedily take the largest remaining opposite item (amounts cancel under 'opposite')
    let bestIdx = -1
    let bestScore = Infinity
    for (let i = 0; i < sortedMany.length; i++) {
      const m = sortedMany[i]
      if (!m) continue
      const score = Math.abs(Math.abs(f.amountMinor) - Math.abs(m.amountMinor))
      if (score < bestScore) {
        bestScore = score
        bestIdx = i
      }
    }
    if (bestIdx >= 0) {
      const m = sortedMany[bestIdx]!
      sortedMany.splice(bestIdx, 1)
      const bankAmt = fewIsBank ? f.amountMinor : m.amountMinor
      const bookAmt = fewIsBank ? m.amountMinor : f.amountMinor
      out.push({ bankAmt, bookAmt })
    }
  }
  return out
}

export async function computeBankReconStatement(
  projectId: string,
  userId: string,
  bankSide: 'A' | 'B' = 'B'
): Promise<BankReconStatement | null> {
  const project = await db.project.findFirst({ where: { id: projectId, userId } })
  if (!project) throw new ApiError(404, 'پروژه یافت نشد', 'NOT_FOUND')

  const recon = await db.reconciliation.findFirst({
    where: { projectId, status: 'completed' },
    orderBy: { startedAt: 'desc' },
  })
  if (!recon) return null

  let config: { matchDirection?: string } = {}
  try {
    config = JSON.parse(recon.config || '{}') as { matchDirection?: string }
  } catch {
    config = {}
  }
  const direction: 'opposite' | 'same' = config.matchDirection === 'same' ? 'same' : 'opposite'
  const bookSide: 'A' | 'B' = bankSide === 'B' ? 'A' : 'B'

  // ---------- load groups + items + transactions (MatchItem has no relation) ----------
  const groups = await db.matchGroup.findMany({
    where: { reconciliationId: recon.id },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  })
  const txIds = [...new Set(groups.flatMap((g) => g.items.map((it) => it.transactionId)))]
  const txs = txIds.length
    ? await db.transaction.findMany({
        where: { id: { in: txIds } },
        select: {
          id: true,
          side: true,
          rowIndex: true,
          date: true,
          description: true,
          reference: true,
          amountMinor: true,
          flags: true,
          file: { select: { originalName: true } },
        },
      })
    : []
  const txById = new Map(txs.map((t) => [t.id, t]))

  const hydrated: HydratedItem[] = []
  for (const g of groups) {
    for (const it of g.items) {
      const t = txById.get(it.transactionId)
      if (!t) continue
      hydrated.push({
        groupId: g.id,
        groupType: g.type,
        transactionId: t.id,
        side: it.side === 'B' ? 'B' : 'A',
        rowIndex: t.rowIndex,
        date: t.date,
        description: t.description,
        reference: t.reference,
        fileName: t.file?.originalName ?? null,
        amountMinor: fromDbMinor(t.amountMinor),
        flags: parseFlags(t.flags),
      })
    }
  }

  // ---------- sign inference from matched pairs ----------
  const pairedItems = groups.filter((g) => (PAIRED_GROUP_TYPES as readonly string[]).includes(g.type) && g.status !== 'rejected')
  const pairVotes: { bankAmt: number; bookAmt: number }[] = []
  for (const g of pairedItems) {
    const a = hydrated.filter((h) => h.groupId === g.id && h.side === 'A')
    const b = hydrated.filter((h) => h.groupId === g.id && h.side === 'B')
    pairVotes.push(...pairGroupItems(a, b))
  }
  const bookSign = inferBookSign(pairVotes, direction)

  const inflowOf = (h: HydratedItem): number => {
    if (h.side === bankSide) return h.amountMinor // bank statement: واریز positive = inflow
    return bookSign * h.amountMinor
  }

  // ---------- classify open items ----------
  const usable = (h: HydratedItem) =>
    (OPEN_GROUP_TYPES as readonly string[]).includes(h.groupType) &&
    h.amountMinor !== 0 &&
    !h.flags.includes('invalid_amount') &&
    !h.flags.includes('missing_amount') &&
    !isOpeningRow(h.description)

  const toOpenItem = (h: HydratedItem): StatementOpenItem => ({
    groupId: h.groupId,
    groupType: h.groupType,
    transactionId: h.transactionId,
    side: h.side,
    rowIndex: h.rowIndex,
    date: h.date ? h.date.toISOString().slice(0, 10) : null,
    time: extractTime(h.description),
    description: h.description,
    reference: h.reference,
    fileName: h.fileName,
    amountMinor: h.amountMinor,
    inflowMinor: inflowOf(h),
    monthKey: h.date ? jalaliMonthKey(h.date) : null,
    flags: h.flags,
  })

  const bankCreditsOpen: StatementOpenItem[] = []
  const bankDebitsOpen: StatementOpenItem[] = []
  const bookDebitsOpen: StatementOpenItem[] = []
  const bookCreditsOpen: StatementOpenItem[] = []

  for (const h of hydrated) {
    if (!usable(h)) continue
    const inflow = inflowOf(h)
    const item = toOpenItem(h)
    if (h.side === bankSide) {
      if (inflow > 0) bankCreditsOpen.push(item)
      else bankDebitsOpen.push(item)
    } else {
      if (inflow > 0) bookDebitsOpen.push(item)
      else bookCreditsOpen.push(item)
    }
  }

  const byDateAsc = (x: StatementOpenItem, y: StatementOpenItem) => (x.date ?? '').localeCompare(y.date ?? '') || x.rowIndex - y.rowIndex
  bankCreditsOpen.sort(byDateAsc)
  bankDebitsOpen.sort(byDateAsc)
  bookDebitsOpen.sort(byDateAsc)
  bookCreditsOpen.sort(byDateAsc)

  // ---------- closing balances per side (last non-null مانده by row order) ----------
  const sideFiles = await db.file.findMany({ where: { projectId, side: { in: ['A', 'B'] } }, select: { id: true, side: true } })
  const fileIds = sideFiles.map((f) => f.id)
  const allTxs = fileIds.length
    ? await db.transaction.findMany({
        where: { fileId: { in: fileIds } },
        select: { side: true, rowIndex: true, balance: true, date: true, amountMinor: true, flags: true },
        orderBy: { rowIndex: 'asc' },
      })
    : []

  const closingFor = (side: 'A' | 'B'): { value: number | null; source: 'file' | 'turnover' | 'none'; asOf: string | null } => {
    const rows = allTxs.filter((t) => t.side === side)
    let last: (typeof rows)[number] | null = null
    for (const t of rows) if (t.balance !== null && t.balance !== undefined) last = t
    if (last && last.balance !== null && last.balance !== undefined) {
      return { value: Math.round(last.balance * 100), source: 'file', asOf: last.date ? last.date.toISOString().slice(0, 10) : null }
    }
    if (rows.length === 0) return { value: null, source: 'none', asOf: null }
    // fallback: net turnover (no opening balance known)
    let net = 0
    for (const t of rows) {
      const flags = parseFlags(t.flags)
      if (flags.includes('invalid_amount') || flags.includes('missing_amount')) continue
      const amt = fromDbMinor(t.amountMinor)
      net += side === bankSide ? amt : bookSign * amt
    }
    return { value: net, source: 'turnover', asOf: null }
  }

  const bookClosing = closingFor(bookSide)
  const bankClosing = closingFor(bankSide)

  // ---------- totals + convergence ----------
  const sumInflow = (arr: StatementOpenItem[]) => arr.reduce((s, i) => s + i.inflowMinor, 0)
  const totals = {
    bankCreditsMinor: sumInflow(bankCreditsOpen),
    bankDebitsMinor: Math.abs(sumInflow(bankDebitsOpen)),
    bookDebitsMinor: sumInflow(bookDebitsOpen),
    bookCreditsMinor: Math.abs(sumInflow(bookCreditsOpen)),
    bankCreditsCount: bankCreditsOpen.length,
    bankDebitsCount: bankDebitsOpen.length,
    bookDebitsCount: bookDebitsOpen.length,
    bookCreditsCount: bookCreditsOpen.length,
  }

  const bookClosingMinor = bookClosing.value
  const bankClosingMinor = bankClosing.value
  const trueFromBook = (bookClosingMinor ?? 0) + totals.bankCreditsMinor - totals.bankDebitsMinor
  const trueFromBank = (bankClosingMinor ?? 0) + totals.bookDebitsMinor - totals.bookCreditsMinor
  const residualMinor = trueFromBook - trueFromBank

  return {
    projectId,
    projectName: project.name,
    reconciliationId: recon.id,
    finishedAt: recon.finishedAt ? recon.finishedAt.toISOString() : null,
    configDirection: direction,
    bookSide,
    bankSide,
    bookClosingMinor,
    bankClosingMinor,
    bookBalanceSource: bookClosing.source,
    bankBalanceSource: bankClosing.source,
    bookAsOfDate: bookClosing.asOf,
    bankAsOfDate: bankClosing.asOf,
    bankCreditsOpen,
    bankDebitsOpen,
    bookDebitsOpen,
    bookCreditsOpen,
    totals,
    trueBalanceFromBookMinor: trueFromBook,
    trueBalanceFromBankMinor: trueFromBank,
    residualMinor,
    converged: Math.abs(residualMinor) <= CONVERGENCE_TOLERANCE_MINOR,
    generatedAt: new Date().toISOString(),
  }
}
