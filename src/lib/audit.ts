import { db } from './db'
import { NextRequest } from 'next/server'

/** Append-only audit trail for traceability of important actions. */
export async function audit(params: {
  userId?: string | null
  action: string
  entityType?: string
  entityId?: string
  meta?: Record<string, unknown>
  req?: NextRequest
}) {
  try {
    await db.activityLog.create({
      data: {
        userId: params.userId ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        meta: params.meta ? JSON.stringify(params.meta) : undefined,
        ip: params.req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || params.req?.headers.get('x-real-ip') || undefined,
        userAgent: params.req?.headers.get('user-agent')?.slice(0, 250) || undefined,
      },
    })
  } catch (err) {
    console.error('[audit] failed to record log', err)
  }
}

export async function notify(params: {
  userId: string
  title: string
  body?: string
  type?: 'info' | 'success' | 'warning' | 'error'
}) {
  try {
    await db.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        type: params.type ?? 'info',
      },
    })
  } catch (err) {
    console.error('[notify] failed', err)
  }
}
