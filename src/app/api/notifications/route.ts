import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireUser } from '@/lib/http'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    const user = await requireUser()
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    return jsonOk({ notifications, unread: notifications.filter((n) => !n.read).length })
  })
}

export async function PATCH(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      const user = await requireUser()
      await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } })
      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
