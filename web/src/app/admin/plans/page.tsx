import { prisma } from '@/lib/prisma'
import { PLANS, PlanId } from '@/lib/plans'
import { Card, Badge, fmtVnd } from '@/components/ui'

export default async function AdminPlans() {
  // đếm số user đang ở mỗi gói (còn hạn)
  const subs = await prisma.subscription.findMany({ select: { plan: true, expiresAt: true } })
  const count: Record<string, number> = { free: 0, basic: 0, pro: 0, business: 0 }
  for (const s of subs) {
    const active = s.plan !== 'free' && (!s.expiresAt || s.expiresAt.getTime() > Date.now())
    count[active ? s.plan : 'free'] = (count[active ? s.plan : 'free'] || 0) + 1
  }

  const ids: PlanId[] = ['free', 'basic', 'pro', 'business']
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Gói cước</h1>
      <p className="text-sm text-slate-500">Hạn mức cố định trong code (<code className="rounded bg-slate-800 px-1">src/lib/plans.ts</code>). Mỗi gói có 2 trần: số comment+bài/ngày (bán cho khách) và trần lượt AI/ngày (chặn quét chùa / cháy ví).</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ids.map(id => {
          const p = PLANS[id]
          return (
            <Card key={id} className={`p-5 ${p.highlight ? 'ring-1 ring-indigo-500/50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-100">{p.name}</div>
                <Badge color="gray">{count[id] || 0} user</Badge>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-50">{p.price === 0 ? 'Free' : fmtVnd(p.price)}<span className="text-xs font-normal text-slate-500">{p.price ? '/tháng' : ''}</span></div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Comment+bài/ngày</span><span className="font-medium text-slate-100">{p.dailyActions}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Trần AI/ngày</span><span className="font-medium text-slate-100">{p.aiDailyCap}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Hiệu lực</span><span className="text-slate-300">{p.days ? `${p.days} ngày` : '—'}</span></div>
              </div>
              <div className="mt-2 text-xs text-slate-500">{p.desc}</div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
