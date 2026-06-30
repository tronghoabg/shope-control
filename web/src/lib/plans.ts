export type PlanId = 'free' | 'basic' | 'pro' | 'business'

export interface Plan {
  id: PlanId
  name: string
  price: number // VND/tháng, 0 = free
  days: number // số ngày hiệu lực mỗi lần mua
  dailyActions: number // trần comment + bài đăng / ngày (giá trị bán cho khách)
  aiDailyCap: number // trần TỔNG lượt gọi AI/ngày — chặn "quét chùa" + cháy ví
  desc: string
  highlight?: boolean
}

// 2 trần mỗi gói:
//  • dailyActions = số comment/bài user được đăng/ngày (khách thấy).
//  • aiDailyCap   = tổng lượt AI/ngày (gồm CẢ quét/chấm điểm/lọc bài) → ai chỉ quét không đăng vẫn bị chặn ở đây.
export const PLANS: Record<PlanId, Plan> = {
  free:     { id: 'free',     name: 'Miễn phí', price: 0,      days: 0,  dailyActions: 5,   aiDailyCap: 50,   desc: 'Dùng thử' },
  basic:    { id: 'basic',    name: 'Cơ bản',   price: 50000,  days: 30, dailyActions: 80,  aiDailyCap: 600,  desc: 'Người mới bán hàng' },
  pro:      { id: 'pro',      name: 'Chuyên',   price: 120000, days: 30, dailyActions: 200, aiDailyCap: 1500, desc: 'Bán hàng nghiêm túc', highlight: true },
  business: { id: 'business', name: 'Đại lý',   price: 250000, days: 30, dailyActions: 500, aiDailyCap: 4000, desc: 'Chạy nhiều tài khoản/khối lượng lớn' },
}

export const PAID_PLANS: PlanId[] = ['basic', 'pro', 'business']
export const FREE_DAILY_LIMIT = PLANS.free.dailyActions

export function isPaidPlan(id: string): id is PlanId {
  return (PAID_PLANS as string[]).includes(id)
}
