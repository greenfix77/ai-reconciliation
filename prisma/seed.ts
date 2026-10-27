import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@reconciliation.ir'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Seed: admin user already exists')
    return
  }
  const passwordHash = await bcrypt.hash('Admin1234', 12)
  const user = await prisma.user.create({
    data: {
      email,
      name: 'علی رضایی',
      passwordHash,
      role: 'admin',
      locale: 'fa',
      currency: 'IRR',
    },
  })

  const cat1 = await prisma.category.create({ data: { userId: user.id, name: 'شرکت X — مغایرت‌گیری', color: '#16a34a' } })
  await prisma.category.create({ data: { userId: user.id, name: 'حساب‌های بانکی', color: '#0ea5e9' } })
  await prisma.category.create({ data: { userId: user.id, name: 'پروژه‌های ماهانه', color: '#f59e0b' } })

  const p1 = await prisma.project.create({
    data: {
      userId: user.id,
      categoryId: cat1.id,
      name: 'مغایرت‌های شرکت × ماه',
      description: 'تطبیق صورتحساب بانک ملت با دفاتر شرکت',
      status: 'reconciled',
      lastReconciledAt: new Date(),
    },
  })
  await prisma.project.create({
    data: { userId: user.id, categoryId: cat1.id, name: 'بانک ملت — مهر', description: 'صورتحساب ماه مهر', status: 'draft' },
  })
  await prisma.project.create({
    data: { userId: user.id, name: 'گزارش ماهانه', status: 'ready' },
  })

  console.log('Seed complete:', { userId: user.id, projects: 3 })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
