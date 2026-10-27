import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { db } from '../db'
import { parseAmountToMinor } from '../money'
import { parseFlexibleDate, normalizeDigits } from '../jalali'
import { aiChat, extractJson } from '../ai-client'
import fs from 'fs'
import path from 'path'

/**
 * File parsing pipeline: xlsx/xls/csv/pdf → unified Transaction rows.
 * - Heuristic header detection (Persian + English financial column names)
 * - AI-assisted column mapping fallback (structured JSON)
 * - Data quality flags: invalid_date, invalid_amount, missing_description, suspect, duplicate
 * - Preserves source row references
 */

export type ParsedRow = {
  rowIndex: number // 1-based data row (excluding header)
  dateRaw: string | null
  description: string | null
  reference: string | null
  debitRaw: string | null
  creditRaw: string | null
  amountRaw: string | null
  balanceRaw: string | null
}

export type ColumnMapping = {
  date?: number
  description?: number
  reference?: number
  debit?: number
  credit?: number
  amount?: number
  balance?: number
}

type Cell = string | number | null

// ---------- helpers ----------

function cellToString(c: Cell): string | null {
  if (c === null || c === undefined) return null
  if (typeof c === 'number') {
    // Excel serial dates will be handled by date parsing fallback
    return String(c)
  }
  const s = c.trim()
  return s === '' ? null : s
}

const DATE_HINTS = ['تاریخ', 'تاريخ', 'date', 'تاریخ عملیات', 'تاریخ ثبت', 'تاریخ تراکنش']
const DESC_HINTS = ['شرح', 'توضیحات', 'شرح تراکنش', 'شرح عملیات', 'description', 'desc', 'عنوان', 'پیام', 'remittance', 'details']
const REF_HINTS = ['شماره پیگیری', 'مرجع', 'شماره مرجع', 'شناسه', 'شماره سند', 'reference', 'ref', 'tracking', 'id', 'شماره']
const DEBIT_HINTS = ['بدهکار', 'برداشت', 'debit', 'واریز به', 'خروجی', 'بدهکاری']
const CREDIT_HINTS = ['بستانکار', 'واریز', 'credit', 'دریافتی', 'ورودی', 'بستانکاری']
const AMOUNT_HINTS = ['مبلغ', 'مبلغ تراکنش', 'amount', 'value', 'مبلغ کل', 'مبلغ ریالی', 'مبلغ (ریال)', 'مبلغ (تومان)']
const BALANCE_HINTS = ['موجودی', 'مانده', 'balance', 'مانده حساب']

function matchHint(header: string, hints: string[]): boolean {
  const h = normalizeDigits(header.toLowerCase().trim())
  return hints.some((hint) => h.includes(hint.toLowerCase()))
}

function detectHeaderRow(rows: Cell[][]): number {
  // Scan first 15 rows; score by number of recognized financial hints
  let bestIdx = -1
  let bestScore = 0
  const limit = Math.min(rows.length, 15)
  for (let i = 0; i < limit; i++) {
    const row = rows[i]
    if (!row) continue
    const cells = row.map((c) => cellToString(c) || '')
    let score = 0
    for (const cell of cells) {
      if (!cell) continue
      if (matchHint(cell, DATE_HINTS)) score += 2
      if (matchHint(cell, DESC_HINTS)) score += 2
      if (matchHint(cell, AMOUNT_HINTS)) score += 2
      if (matchHint(cell, DEBIT_HINTS)) score += 1
      if (matchHint(cell, CREDIT_HINTS)) score += 1
      if (matchHint(cell, REF_HINTS)) score += 1
      if (matchHint(cell, BALANCE_HINTS)) score += 1
    }
    if (score >= 4 && score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestIdx
}

function detectMapping(headers: string[]): ColumnMapping {
  const map: ColumnMapping = {}
  headers.forEach((header, idx) => {
    if (map.date === undefined && matchHint(header, DATE_HINTS)) map.date = idx
    if (map.description === undefined && matchHint(header, DESC_HINTS)) map.description = idx
    if (map.reference === undefined && matchHint(header, REF_HINTS)) map.reference = idx
    if (map.debit === undefined && matchHint(header, DEBIT_HINTS)) map.debit = idx
    if (map.credit === undefined && matchHint(header, CREDIT_HINTS)) map.credit = idx
    if (map.amount === undefined && matchHint(header, AMOUNT_HINTS)) map.amount = idx
    if (map.balance === undefined && matchHint(header, BALANCE_HINTS)) map.balance = idx
  })
  return map
}

async function aiColumnMapping(headers: string[], sampleRows: string[][], providerId?: string | null, model?: string | null): Promise<ColumnMapping | null> {
  try {
    const prompt = `You are a financial data mapping expert. Given a table header and sample rows from a financial file, map columns to a unified schema.
Headers: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sampleRows.slice(0, 5))}

Return ONLY a JSON object with these optional numeric keys (0-based column indexes), only when confidently identified:
{"date": number|null, "description": number|null, "reference": number|null, "debit": number|null, "credit": number|null, "amount": number|null, "balance": number|null}
Rules:
- debit = money OUT (برداشت/بدهکار), credit = money IN (واریز/بستانکار)
- If a single amount column exists with sign direction, use "amount"
- Return null for unknown keys. JSON only, no explanation.`
    const result = await aiChat({
      providerId: providerId ?? null,
      model: model ?? null,
      messages: [{ role: 'system', content: 'You output valid JSON only.' }, { role: 'user', content: prompt }],
      temperature: 0,
      timeoutMs: 45_000,
    })
    const parsed = extractJson<Record<string, number | null>>(result.content)
    const clean: ColumnMapping = {}
    const keys: (keyof ColumnMapping)[] = ['date', 'description', 'reference', 'debit', 'credit', 'amount', 'balance']
    for (const k of keys) {
      const v = parsed[k]
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < headers.length) {
        clean[k] = v
      }
    }
    return Object.keys(clean).length > 0 ? clean : null
  } catch {
    return null
  }
}

function rowsFromSheetData(data: Cell[][]): { headerIndex: number; mapping: ColumnMapping; rows: ParsedRow[]; headers: string[] } | null {
  if (!data.length) return null
  const headerIndex = detectHeaderRow(data)
  const headers = (headerIndex >= 0 ? data[headerIndex] : data[0]).map((c) => cellToString(c) || '')
  let mapping = headerIndex >= 0 ? detectMapping(headers) : {}
  const dataRows = data.slice(headerIndex >= 0 ? headerIndex + 1 : 0)
  const rows: ParsedRow[] = []
  dataRows.forEach((row, i) => {
    const cells = row.map((c) => cellToString(c))
    if (cells.every((c) => c === null)) return
    rows.push({
      rowIndex: i + 1,
      dateRaw: mapping.date !== undefined ? cells[mapping.date] ?? null : null,
      description: mapping.description !== undefined ? cells[mapping.description] ?? null : null,
      reference: mapping.reference !== undefined ? cells[mapping.reference] ?? null : null,
      debitRaw: mapping.debit !== undefined ? cells[mapping.debit] ?? null : null,
      creditRaw: mapping.credit !== undefined ? cells[mapping.credit] ?? null : null,
      amountRaw: mapping.amount !== undefined ? cells[mapping.amount] ?? null : null,
      balanceRaw: mapping.balance !== undefined ? cells[mapping.balance] ?? null : null,
    })
  })
  return { headerIndex: Math.max(0, headerIndex), mapping, rows, headers }
}

// ---------- format-specific extractors ----------

function extractXlsx(buffer: Buffer): Cell[][] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: false, defval: null })
  return data
}

function extractCsv(buffer: Buffer): Cell[][] {
  // Try UTF-8, fall back to Latin1 for legacy exports
  let text = buffer.toString('utf8')
  if (text.includes('\uFFFD')) text = buffer.toString('latin1')
  // strip BOM
  text = text.replace(/^\uFEFF/, '')
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
  return (result.data as unknown as Cell[][]).map((row) => (Array.isArray(row) ? row : [String(row)]))
}

async function extractPdf(buffer: Buffer): Promise<Cell[][]> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  // Heuristic table reconstruction: split lines by 2+ spaces or tabs
  const rows: Cell[][] = lines.map((line) => line.split(/\s{2,}|\t+/).map((c) => c.trim() || null))
  // If no multi-column structure detected, treat whole line as description
  return rows
}

// ---------- main entry ----------

export async function processFile(fileId: string, opts: { aiAssist?: boolean } = {}): Promise<{ ok: boolean; error?: string; txCount?: number }> {
  const file = await db.file.findUnique({ where: { id: fileId } })
  if (!file) return { ok: false, error: 'File not found' }
  if (file.status === 'parsed') return { ok: true, txCount: file.txCount }

  await db.file.update({ where: { id: fileId }, data: { status: 'parsing', parseError: null } })
  await db.transaction.deleteMany({ where: { fileId } })

  try {
    let buffer: Buffer
    try {
      buffer = fs.readFileSync(file.storedPath)
    } catch {
      throw new Error('فایل ذخیره‌شده یافت نشد / Stored file missing on disk')
    }

    const ext = path.extname(file.originalName).toLowerCase().replace('.', '')
    let table: Cell[][]
    if (ext === 'xlsx' || ext === 'xls' || file.mimeType.includes('spreadsheet') || file.mimeType.includes('excel')) {
      table = extractXlsx(buffer)
    } else if (ext === 'csv' || file.mimeType === 'text/csv') {
      table = extractCsv(buffer)
    } else if (ext === 'pdf' || file.mimeType === 'application/pdf') {
      table = await extractPdf(buffer)
    } else {
      throw new Error(`فرمت پشتیبانی نمی‌شود / Unsupported format: ${ext}`)
    }

    if (!table.length) throw new Error('فایل خالی است / Empty file')

    let parsed = rowsFromSheetData(table)
    if (!parsed || parsed.rows.length === 0) throw new Error('هیچ ردیف داده‌ای شناسایی نشد / No data rows detected')

    // AI-assisted mapping fallback when heuristics found nothing useful
    const hasUsefulMapping =
      parsed.mapping.date !== undefined && (parsed.mapping.amount !== undefined || (parsed.mapping.debit !== undefined && parsed.mapping.credit !== undefined))
    if (!hasUsefulMapping && opts.aiAssist !== false) {
      const sample: string[][] = table.slice(0, 8).map((r) => r.map((c) => cellToString(c) || ''))
      const aiMap = await aiColumnMapping(parsed.headers, sample)
      if (aiMap) {
        // Re-run row extraction with the AI mapping
        const headerIndex = parsed.headerIndex
        const dataRows = table.slice(headerIndex + 1)
        const mapping = aiMap
        const rows: ParsedRow[] = []
        dataRows.forEach((row, i) => {
          const cells = row.map((c) => cellToString(c))
          if (cells.every((c) => c === null)) return
          rows.push({
            rowIndex: i + 1,
            dateRaw: mapping.date !== undefined ? cells[mapping.date] ?? null : null,
            description: mapping.description !== undefined ? cells[mapping.description] ?? null : null,
            reference: mapping.reference !== undefined ? cells[mapping.reference] ?? null : null,
            debitRaw: mapping.debit !== undefined ? cells[mapping.debit] ?? null : null,
            creditRaw: mapping.credit !== undefined ? cells[mapping.credit] ?? null : null,
            amountRaw: mapping.amount !== undefined ? cells[mapping.amount] ?? null : null,
            balanceRaw: mapping.balance !== undefined ? cells[mapping.balance] ?? null : null,
          })
        })
        if (rows.length > 0) parsed = { ...parsed, mapping, rows }
      }
    }

    // Build transactions
    const flagsSeen = new Set<string>()
    const records: {
      side: string
      rowIndex: number
      date: Date | null
      description: string | null
      reference: string | null
      debit: number | null
      credit: number | null
      amountMinor: number
      balance: number | null
      flags: string[]
    }[] = []

    let lastGoodAmount = 0
    for (const row of parsed.rows) {
      const flags: string[] = []
      const date = parseFlexibleDate(row.dateRaw)
      if (row.dateRaw && !date) flags.push('invalid_date')

      let debit: number | null = null
      let credit: number | null = null
      let amountMinor = 0

      if (row.debitRaw || row.creditRaw) {
        debit = row.debitRaw ? parseAmountToMinor(row.debitRaw) : null
        credit = row.creditRaw ? parseAmountToMinor(row.creditRaw) : null
        if (row.debitRaw && debit === null) flags.push('invalid_amount')
        if (row.creditRaw && credit === null) flags.push('invalid_amount')
        amountMinor = (credit ?? 0) - (debit ?? 0)
      } else if (row.amountRaw) {
        const amt = parseAmountToMinor(row.amountRaw)
        if (amt === null) {
          flags.push('invalid_amount')
          amountMinor = 0
        } else {
          amountMinor = amt
        }
      } else {
        flags.push('missing_amount')
        amountMinor = 0
      }

      if (amountMinor === 0 && !row.amountRaw && !row.debitRaw && !row.creditRaw) {
        // fully unusable row
        flags.push('suspect')
      }
      if (!row.description) flags.push('missing_description')

      records.push({
        side: file.side,
        rowIndex: row.rowIndex,
        date,
        description: row.description,
        reference: row.reference,
        debit: debit !== null ? debit / 100 : null,
        credit: credit !== null ? credit / 100 : null,
        amountMinor,
        balance: row.balanceRaw ? (parseAmountToMinor(row.balanceRaw) ?? 0) / 100 : null,
        flags,
      })
      if (amountMinor !== 0) lastGoodAmount = amountMinor
      for (const f of flags) flagsSeen.add(f)
    }

    // Duplicate detection (same file: identical date+amount+description)
    if (opts.aiAssist !== false) {
      const seen = new Map<string, number>()
      for (const rec of records) {
        const key = `${rec.date?.toISOString() ?? ''}|${rec.amountMinor}|${rec.description ?? ''}`
        const prev = seen.get(key)
        if (prev !== undefined) {
          rec.flags.push('duplicate')
          flagsSeen.add('duplicate')
        } else {
          seen.set(key, 1)
        }
      }
    }

    await db.$transaction(
      records.map((r) =>
        db.transaction.create({
          data: {
            fileId: file.id,
            side: file.side,
            rowIndex: r.rowIndex,
            date: r.date,
            description: r.description,
            reference: r.reference,
            debit: r.debit,
            credit: r.credit,
            amountMinor: r.amountMinor,
            balance: r.balance,
            flags: JSON.stringify(r.flags),
          },
        })
      )
    )

    await db.file.update({
      where: { id: file.id },
      data: {
        status: 'parsed',
        txCount: records.length,
        columnsMeta: JSON.stringify({ mapping: parsed.mapping, headers: parsed.headers, headerIndex: parsed.headerIndex, flags: [...flagsSeen] }),
      },
    })
    return { ok: true, txCount: records.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parsing error'
    await db.file.update({ where: { id: fileId }, data: { status: 'failed', parseError: message.slice(0, 500) } })
    return { ok: false, error: message }
  }
}
