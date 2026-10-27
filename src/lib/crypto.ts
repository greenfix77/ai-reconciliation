import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

/**
 * AES-256-GCM encryption for secrets at rest (AI provider API keys).
 * Key derived from APP_SECRET env (or generated once and persisted to db/.app-secret).
 * Never log plaintext secrets. Never expose decrypted keys to the client.
 */

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const envSecret = process.env.APP_SECRET
  if (envSecret && envSecret.length >= 32) {
    cachedKey = crypto.createHash('sha256').update(envSecret).digest()
    return cachedKey
  }
  // Persist a generated secret so encrypted data stays readable across restarts
  const secretPath = path.join(process.cwd(), 'db', '.app-secret')
  try {
    const existing = fs.readFileSync(secretPath, 'utf8').trim()
    if (existing.length >= 32) {
      cachedKey = crypto.createHash('sha256').update(existing).digest()
      return cachedKey
    }
  } catch {
    // file missing — generate
  }
  const secret = crypto.randomBytes(48).toString('hex')
  fs.mkdirSync(path.dirname(secretPath), { recursive: true })
  fs.writeFileSync(secretPath, secret, { mode: 0o600 })
  cachedKey = crypto.createHash('sha256').update(secret).digest()
  return cachedKey
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted payload')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
  return decrypted.toString('utf8')
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 3)}…${key.slice(-4)}`
}
