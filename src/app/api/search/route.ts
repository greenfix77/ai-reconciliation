import { NextRequest } from 'next/server'
import { handleApi, jsonOk, requireUser } from '@/lib/http'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApi(req, async () => {
    const user = await requireUser()
    const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80)
    // Safe: Prisma parameterized contains — no raw SQL, no injection
    const projects = await db.project.findMany({
      where: {
        userId: user.id,
        ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, name: true, status: true, category: { select: { name: true } } },
    })
    return jsonOk({ projects: projects.map((p) => ({ ...p, categoryName: p.category?.name ?? null })) })
  })
}
