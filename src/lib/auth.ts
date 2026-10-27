import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from './db'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * Session: JWT (HS256) in httpOnly + sameSite=strict cookie.
 * Password: bcrypt cost 12.
 * Account lockout: 5 consecutive failures → 15 min lock.
 */

const SESSION_COOKIE = 'recon_session'
const SESSION_TTL_SEC = 60 * 60 * 24 * 7 // 7 days

function getSecretKey(): Uint8Array {
  const secret =
    process.env.APP_SECRET ||
    (() => {
      const secretPath = path.join(process.cwd(), 'db', '.app-secret')
      try {
        const existing = fs.readFileSync(secretPath, 'utf8').trim()
        if (existing.length >= 32) return existing
      } catch {}
      const secret = crypto.randomBytes(48).toString('hex')
      fs.mkdirSync(path.dirname(secretPath), { recursive: true })
      fs.writeFileSync(secretPath, secret, { mode: 0o600 })
      return secret
    })()
  return new TextEncoder().encode(secret)
}

export type AuthUser = {
  id: string
  email: string
  name: string
  role: string
  status: string
  locale: string
  theme: string
  currency: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(getSecretKey())
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, getSecretKey())
    const userId = payload.sub
    if (!userId) return null
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return null
    // Deactivated users are locked out of every authenticated surface immediately
    if (user.status === 'disabled') return null
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      locale: user.locale,
      theme: user.theme,
      currency: user.currency,
    }
  } catch {
    return null
  }
}

export const AUTH_CONSTANTS = {
  SESSION_COOKIE,
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,
}
