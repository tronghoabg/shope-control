import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getQuota } from '@/lib/quota'
import { genApiToken } from '@/lib/apiAuth'

// Control panel (/app, cùng origin, có session cookie) gọi để TỰ liên kết — không cần dán token tay.
export async function GET() {
  const session = await auth()
  const id = (session?.user as any)?.id
  if (!id) return NextResponse.json({ loggedIn: false }, { status: 401 })

  let user = await prisma.user.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ loggedIn: false }, { status: 401 })
  if (!user.apiToken) user = await prisma.user.update({ where: { id }, data: { apiToken: genApiToken() } })
  await prisma.subscription.upsert({ where: { userId: id }, create: { userId: id, plan: 'free' }, update: {} })

  const q = await getQuota(id)
  return NextResponse.json({
    loggedIn: true,
    email: user.email,
    name: user.name,
    apiToken: user.apiToken,
    plan: q.plan,
    isPro: q.isPro,
    usedToday: q.usedToday,
    dailyLimit: q.dailyLimit === Infinity ? -1 : q.dailyLimit,
    remaining: q.remaining === Infinity ? -1 : q.remaining,
    expiresAt: q.expiresAt,
  })
}
