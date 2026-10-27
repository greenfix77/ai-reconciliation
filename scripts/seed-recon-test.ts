/**
 * Seeds a test project (2 fixture CSV files) directly in DB for E2E testing of the
 * reconciliation engine. Idempotent: removes a previous test project with the same name.
 *
 * Usage: bun run scripts/seed-recon-test.ts
 */
import fs from 'fs'
const fsStatSync = fs.statSync
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { processFile } from '@/lib/engine/parse-service'
import { aiChat } from '@/lib/ai-client'
import { writeFixtures, bankCsvPath, booksCsvPath } from './make-fixtures'

const TEST_PROJECT_NAME = 'تست موتور مغایرت‌یابی ۲د'
const ADMIN_EMAIL = 'admin@reconciliation.ir'

async function aiSmokeTest(): Promise<boolean> {
  try {
    const res = await aiChat({
      messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
      temperature: 0,
      timeoutMs: 60_000,
    })
    console.log(`[ai-smoke] provider=${res.providerName} model=${res.model} content=${res.content.trim().slice(0, 40)}`)
    return res.content.trim().length > 0
  } catch (err) {
    console.warn('[ai-smoke] FAILED:', err instanceof Error ? err.message : err)
    return false
  }
}

async function main() {
  const paths = writeFixtures()
  console.log('[fixtures]', paths)

  // 1) admin user
  let user = await db.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: 'علی رضایی',
        passwordHash: await bcrypt.hash('Admin1234', 12),
        role: 'admin',
      },
    })
    console.log('[seed] admin user created', user.id)
  }

  // 2) clean previous test project
  const old = await db.project.findMany({ where: { userId: user.id, name: TEST_PROJECT_NAME } })
  for (const p of old) {
    await db.project.delete({ where: { id: p.id } })
    console.log('[seed] removed old test project', p.id)
  }

  // 3) AI smoke test (1 call)
  const aiOk = await aiSmokeTest()

  // 4) project + files
  const project = await db.project.create({
    data: {
      userId: user.id,
      name: TEST_PROJECT_NAME,
      description: 'پروژه تست سرتاسری موتور مغایرت‌یابی — فیکسچر bank.csv و books.csv',
      status: 'ready',
      config: JSON.stringify({
        matchDirection: 'opposite',
        amountToleranceMinor: 0,
        dateToleranceDays: 0,
        requireExactDate: false,
        useDescriptionMatching: true,
        useReferenceMatching: true,
        allowOneToMany: true,
        allowManyToOne: true,
        detectDuplicates: true,
        aiBatchSize: 30,
        minAutoConfidence: 0.65,
      }),
    },
  })

  const bankFile = await db.file.create({
    data: {
      projectId: project.id,
      userId: user.id,
      originalName: 'bank.csv',
      storedPath: bankCsvPath(),
      mimeType: 'text/csv',
      size: fsStatSync(bankCsvPath()).size,
      side: 'A',
      status: 'uploaded',
    },
  })
  const booksFile = await db.file.create({
    data: {
      projectId: project.id,
      userId: user.id,
      originalName: 'books.csv',
      storedPath: booksCsvPath(),
      mimeType: 'text/csv',
      size: fsStatSync(booksCsvPath()).size,
      side: 'B',
      status: 'uploaded',
    },
  })

  // 5) parse both files (shared engine service)
  const r1 = await processFile(bankFile.id)
  const r2 = await processFile(booksFile.id)
  console.log('[parse] bank:', r1, 'books:', r2)

  if (!r1.ok || !r2.ok) {
    console.error('[seed] parse failed — aborting')
    process.exit(1)
  }

  const txA = await db.transaction.count({ where: { fileId: bankFile.id } })
  const txB = await db.transaction.count({ where: { fileId: booksFile.id } })
  const dupFlags = await db.transaction.count({ where: { fileId: bankFile.id, flags: { contains: 'duplicate' } } })

  console.log('[seed] DONE', {
    projectId: project.id,
    userId: user.id,
    bankFileId: bankFile.id,
    booksFileId: booksFile.id,
    txA,
    txB,
    duplicatesFlagged: dupFlags,
    aiOk,
  })
}

main()
  .catch((err) => {
    console.error('[seed] fatal', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
