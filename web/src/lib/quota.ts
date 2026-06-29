import { prisma } from './prisma'
import { PLANS, PlanId } from './plans'

// Ngày theo giờ VN (UTC+7) dạng YYYY-MM-DD — để reset quota lúc nửa đêm VN.
export function vnDateKey(d = new Date()): string {
  const vn = new Date(d.getTime() + 7 * 3600 * 1000)
  return vn.toISOString().slice(0, 10)
}

// Gói đang hiệu lực của user (hết hạn → tự về free).
export async function getActivePlan(userId: string): Promise<PlanId> {
  const sub = await prisma.subscription.findUnique({ where: { userId } })
  if (!sub || sub.plan === 'free') return 'free'
  if (sub.expiresAt && sub.expiresAt.getTime() < Date.now()) return 'free'
  return sub.plan as PlanId
}

export interface Quota {
  plan: PlanId
  isPro: boolean
  dailyLimit: number // Infinity nếu pro
  usedToday: number
  remaining: number // Infinity nếu pro
  expiresAt: string | null
}

export async function getQuota(userId: string): Promise<Quota> {
  const plan = await getActivePlan(userId)
  const limit = PLANS[plan].dailyComments
  const date = vnDateKey()
  const usage = await prisma.dailyUsage.findUnique({ where: { userId_date: { userId, date } } })
  const used = usage?.comments ?? 0
  const sub = await prisma.subscription.findUnique({ where: { userId } })
  return {
    plan,
    isPro: plan !== 'free',
    dailyLimit: limit,
    usedToday: used,
    remaining: limit === Infinity ? Infinity : Math.max(0, limit - used),
    expiresAt: sub?.expiresAt ? sub.expiresAt.toISOString() : null,
  }
}

// Ghi nhận 1 comment đã đăng. Trả về quota mới. Ném lỗi nếu vượt giới hạn free.
export async function recordComment(userId: string): Promise<Quota> {
  const plan = await getActivePlan(userId)
  const limit = PLANS[plan].dailyComments
  const date = vnDateKey()

  if (limit !== Infinity) {
    const cur = await prisma.dailyUsage.findUnique({ where: { userId_date: { userId, date } } })
    if ((cur?.comments ?? 0) >= limit) {
      const e = new Error(`Đã đạt giới hạn ${limit} comment/ngày của gói miễn phí. Nâng cấp Pro để dùng không giới hạn.`)
      ;(e as any).code = 'QUOTA_EXCEEDED'
      throw e
    }
  }

  await prisma.dailyUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, comments: 1 },
    update: { comments: { increment: 1 } },
  })
  return getQuota(userId)
}
