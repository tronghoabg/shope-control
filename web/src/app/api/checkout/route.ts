import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLANS, isPaidPlan } from '@/lib/plans'

// Tạo yêu cầu thanh toán → trả thông tin chuyển khoản + QR SePay.
export async function POST(req: Request) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { plan } = await req.json().catch(() => ({}))
  if (!isPaidPlan(plan)) return NextResponse.json({ error: 'Gói không hợp lệ' }, { status: 400 })

  const code = 'SHOPE' + crypto.randomBytes(4).toString('hex').toUpperCase()
  const amount = PLANS[plan].price
  await prisma.payment.create({ data: { userId, plan, amount, code, status: 'pending' } })

  const bank = process.env.SEPAY_BANK || 'MBBank'
  const acc = process.env.SEPAY_ACCOUNT_NUMBER || ''
  const name = process.env.SEPAY_ACCOUNT_NAME || ''
  const qr = `https://qr.sepay.vn/img?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}&amount=${amount}&des=${encodeURIComponent(code)}`

  return NextResponse.json({ code, amount, bank, account: acc, accountName: name, qr, plan })
}
