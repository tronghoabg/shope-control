import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'admin@shope.local').toLowerCase()
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'admin' },
    create: {
      email, name: 'Admin', role: 'admin', passwordHash,
      apiToken: 'shk_' + crypto.randomBytes(24).toString('hex'),
      subscription: { create: { plan: 'free' } },
    },
  })
  console.log('✓ Admin:', user.email, '(mật khẩu:', password + ')')
}

main().finally(() => prisma.$disconnect())
