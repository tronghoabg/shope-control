import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLANS, PlanId } from '@/lib/plans'

// SePay gọi khi có tiền vào. Cấu hình URL: https://<domain>/api/sepay/webhook
// Header xác thực: Authorization: Apikey <SEPAY_WEBHOOK_APIKEY>
export async function POST(req: Request) {
  const key = process.env.SEPAY_WEBHOOK_APIKEY
  if (key) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Apikey ${key}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body: any = await req.json().catch(() => ({}))
  // SePay payload: { content, transferAmount, transferType, referenceCode/id, ... }
  const content: string = String(body.content || body.description || '')
  const amount: number = Number(body.transferAmount || body.amount || 0)
  const type: string = String(body.transferType || 'in')
  const ref: string = String(body.referenceCode || body.id || '')
  if (type && type !== 'in') return NextResponse.json({ ok: true, skipped: 'not incoming' })

  // Tìm mã thanh toán SHOPE... trong nội dung CK
  const m = content.toUpperCase().match(/SHOPE[A-Z0-9]{6,}/)
  if (!m) return NextResponse.json({ ok: true, skipped: 'no code' })
  const code = m[0]

  const payment = await prisma.payment.findUnique({ where: { code } })
  if (!payment) return NextResponse.json({ ok: true, skipped: 'unknown code' })
  if (payment.status === 'paid') return NextResponse.json({ ok: true, skipped: 'already paid' })
  if (amount && amount < payment.amount) return NextResponse.json({ ok: true, skipped: 'amount too low' })

  await prisma.payment.update({ where: { code }, data: { status: 'paid', paidAt: new Date(), ref } })

  // Kích hoạt/ gia hạn gói
  const plan = payment.plan as PlanId
  const days = PLANS[plan].days
  const cur = await prisma.subscription.findUnique({ where: { userId: payment.userId } })
  const base = cur?.expiresAt && cur.expiresAt.getTime() > Date.now() ? cur.expiresAt.getTime() : Date.now()
  const expiresAt = new Date(base + days * 24 * 3600 * 1000)
  await prisma.subscription.upsert({
    where: { userId: payment.userId },
    create: { userId: payment.userId, plan, status: 'active', expiresAt },
    update: { plan, status: 'active', expiresAt },
  })

  return NextResponse.json({ ok: true, activated: plan })
}
