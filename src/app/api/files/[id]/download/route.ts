import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { handleApi, requireUser, ApiError } from '@/lib/http'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const MIME_BY_EXT: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/** GET /api/files/[id]/download — stream the original upload (owner only, traversal-guarded). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(req, async () => {
    const user = await requireUser()
    const { id } = await params

    const file = await db.file.findUnique({ where: { id } })
    if (!file || file.userId !== user.id) throw new ApiError(404, 'File not found', 'NOT_FOUND')

    // Path traversal guard: stored path must resolve inside the uploads root
    const uploadsRoot = path.resolve(process.cwd(), 'db', 'uploads')
    const resolved = path.resolve(file.storedPath)
    if (!resolved.startsWith(uploadsRoot + path.sep) && resolved !== uploadsRoot) {
      throw new ApiError(400, 'Invalid storage path', 'BAD_PATH')
    }
    if (!fs.existsSync(resolved)) {
      throw new ApiError(404, 'File is missing from storage', 'MISSING')
    }

    const data = fs.readFileSync(resolved)
    const ext = path.extname(resolved).replace('.', '').toLowerCase()
    // ASCII-safe fallback for the classic header + RFC 5987 UTF-8 name for modern clients
    const asciiName = file.originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\;]/g, '_') || 'file'
    const utf8Name = encodeURIComponent(file.originalName)

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        'Content-Length': String(data.length),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  })
}
