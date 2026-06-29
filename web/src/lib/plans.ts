export type PlanId = 'free' | 'm1' | 'm6' | 'm12'

export interface Plan {
  id: PlanId
  name: string
  price: number // VND, 0 = free
  days: number // số ngày hiệu lực
  dailyComments: number // giới hạn comment/ngày (Infinity = không giới hạn)
  highlight?: boolean
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: 'free', name: 'Miễn phí', price: 0, days: 0, dailyComments: 10 },
  m1: { id: 'm1', name: 'Pro 1 tháng', price: 50000, days: 30, dailyComments: Infinity, highlight: true },
  m6: { id: 'm6', name: 'Pro 6 tháng', price: 250000, days: 180, dailyComments: Infinity },
  m12: { id: 'm12', name: 'Pro 12 tháng', price: 450000, days: 365, dailyComments: Infinity },
}

export const PAID_PLANS: PlanId[] = ['m1', 'm6', 'm12']
export const FREE_DAILY_LIMIT = PLANS.free.dailyComments

export function isPaidPlan(id: string): id is PlanId {
  return (PAID_PLANS as string[]).includes(id)
}
