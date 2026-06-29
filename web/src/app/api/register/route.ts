import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { genApiToken } from '@/lib/apiAuth'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  name: z.string().optional(),
})

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 }) }
  const p = schema.safeParse(body)
  if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 })

  const email = p.data.email.toLowerCase()
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return NextResponse.json({ error: 'Email đã được đăng ký' }, { status: 409 })

  const passwordHash = await bcrypt.hash(p.data.password, 10)
  await prisma.user.create({
    data: {
      email, name: p.data.name || email.split('@')[0], passwordHash, apiToken: genApiToken(),
      subscription: { create: { plan: 'free' } },
    },
  })
  return NextResponse.json({ ok: true })
}
