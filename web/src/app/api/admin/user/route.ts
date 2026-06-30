import { NextResponse } from 'next/server'
import { userFromRequest } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { PLANS, PlanId } from '@/lib/plans'

async function requireAdmin(req: Request) {
  const u = await userFromRequest(req)
  return u && u.role === 'admin' ? u : null
}

// POST /api/admin/user → { userId, action: 'ban'|'unban'|'setPlan', plan? }
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { userId, action, plan } = await req.json().catch(() => ({}))
  if (!userId || !action) return NextResponse.json({ error: 'bad_args' }, { status: 400 })

  if (action === 'ban') {
    await prisma.user.update({ where: { id: userId }, data: { bannedAt: new Date() } })
  } else if (action === 'unban') {
    await prisma.user.update({ where: { id: userId }, data: { bannedAt: null } })
  } else if (action === 'setPlan') {
    const pid = (plan as PlanId)
    if (!PLANS[pid]) return NextResponse.json({ error: 'bad_plan' }, { status: 400 })
    const days = PLANS[pid].days
    const expiresAt = pid === 'free' ? null : new Date(Date.now() + days * 86400_000)
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan: pid, expiresAt },
      update: { plan: pid, expiresAt, status: 'active' },
    })
  } else {
    return NextResponse.json({ error: 'bad_action' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
