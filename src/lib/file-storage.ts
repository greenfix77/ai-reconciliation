import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * Secure file storage:
 * - Files stored OUTSIDE public webroot under db/uploads/{userId}/{fileId}{ext}
 * - Extension whitelist + magic-byte sniffing (never trust client MIME alone)
 * - Size limit 15MB
 * - Original filename sanitized for display only
 */

export const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

export const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'pdf', 'png', 'jpg', 'jpeg', 'webp'] as const

export class FileValidationError extends Error {
  status = 400
}

export function sanitizeFileName(name: string): string {
  // Remove path components & dangerous chars; keep readable display name
  const base = path.basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
  return base.slice(0, 180) || 'file'
}

export function validateFileMeta(originalName: string, size: number) {
  if (size <= 0) throw new FileValidationError('Empty file')
  if (size > MAX_FILE_SIZE) throw new FileValidationError('File exceeds 15MB limit')
  const ext = path.extname(originalName).toLowerCase().replace('.', '')
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new FileValidationError(`Unsupported file type: .${ext}`)
  }
  return ext
}

/** Verify magic bytes match the claimed extension. Throws FileValidationError. */
export function validateMagicBytes(buffer: Buffer, ext: string) {
  if (buffer.length < 8) throw new FileValidationError('File too small to be valid')
  const startsWith = (...bytes: number[]) => bytes.every((b, i) => buffer[i] === b)

  let ok = false
  switch (ext) {
    case 'xlsx':
    case 'xls':
      // xlsx = ZIP (PK), xls = OLE2 (D0 CF 11 E0)
      ok = startsWith(0x50, 0x4b) || startsWith(0xd0, 0xcf, 0x11, 0xe0)
      break
    case 'csv':
      // CSV is text — verify no binary nulls in first 1KB
      ok = !buffer.subarray(0, 1024).includes(0)
      break
    case 'pdf':
      ok = startsWith(0x25, 0x50, 0x44, 0x46) // %PDF
      break
    case 'png':
      ok = startsWith(0x89, 0x50, 0x4e, 0x47)
      break
    case 'jpg':
    case 'jpeg':
      ok = startsWith(0xff, 0xd8, 0xff)
      break
    case 'webp':
      ok = startsWith(0x52, 0x49, 0x46, 0x46) // RIFF
      break
    default:
      ok = false
  }
  if (!ok) throw new FileValidationError('File content does not match its extension (security check failed)')
}

/** Persist an uploaded buffer. Returns { storedPath, fileId } — caller creates DB row with fileId as PK. */
export function storeUpload(userId: string, ext: string, buffer: Buffer): { storedPath: string; fileId: string } {
  const fileId = crypto.randomBytes(12).toString('hex')
  const dir = path.join(process.cwd(), 'db', 'uploads', userId)
  fs.mkdirSync(dir, { recursive: true, mode: 0o750 })
  const storedPath = path.join(dir, `${fileId}.${ext}`)
  fs.writeFileSync(storedPath, buffer, { mode: 0o640 })
  return { storedPath, fileId }
}

export function deleteStoredFile(storedPath: string) {
  try {
    const normalized = path.resolve(storedPath)
    const uploadsRoot = path.resolve(process.cwd(), 'db', 'uploads')
    // Path traversal guard
    if (!normalized.startsWith(uploadsRoot)) return
    fs.unlinkSync(normalized)
  } catch {
    // already deleted
  }
}
