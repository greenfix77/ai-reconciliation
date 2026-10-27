import { NextRequest } from 'next/server'
import { handleApi, jsonOk } from '@/lib/http'
import { destroySession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleApi(
    req,
    async () => {
      await destroySession()
      return jsonOk({ done: true })
    },
    { mutating: true }
  )
}
