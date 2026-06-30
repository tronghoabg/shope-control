import { prisma } from '@/lib/prisma'
import { vnDateKey } from '@/lib/quota'
import { PLANS } from '@/lib/plans'
import { Card, fmtVnd } from '@/components/ui'

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-50">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  )
}

export default async function AdminOverview() {
  const today = vnDateKey()
  // 7 ngày gần nhất (giờ VN)
  const days: string[] = []
  for (let i = 6; i >= 0; i--) days.push(vnDateKey(new Date(Date.now() - i * 86400_000)))

  const [users, activeSubsRows, paidAgg, todayAgg, weekRows] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.findMany({ where: { plan: { not: 'free' }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),
    prisma.dailyUsage.aggregate({ _sum: { comments: true, aiCalls: true, aiTokens: true }, where: { date: today } }),
    prisma.dailyUsage.findMany({ where: { date: { in: days } }, select: { date: true, comments: true, aiCalls: true } }),
  ])

  // gộp theo ngày
  const byDate: Record<string, { c: number; ai: number }> = {}
  for (const d of days) byDate[d] = { c: 0, ai: 0 }
  for (const r of weekRows) { byDate[r.date].c += r.comments; byDate[r.date].ai += r.aiCalls }
  const maxAi = Math.max(1, ...days.map(d => byDate[d].ai))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Tổng quan</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Người dùng" value={users} />
        <Stat label="Đang trả phí" value={activeSubsRows.length} />
        <Stat label="Doanh thu" value={fmtVnd(paidAgg._sum.amount || 0)} />
        <Stat label="Comment / Lượt AI hôm nay" value={`${todayAgg._sum.comments || 0} / ${todayAgg._sum.aiCalls || 0}`} sub={`${(todayAgg._sum.aiTokens || 0).toLocaleString('vi')} token`} />
      </div>

      <Card className="p-5">
        <div className="mb-4 text-sm font-semibold text-slate-100">Hoạt động 7 ngày (lượt AI)</div>
        <div className="flex h-40 items-end gap-2">
          {days.map(d => {
            const v = byDate[d].ai
            const h = Math.round((v / maxAi) * 100)
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-1">
                <div className="text-[10px] text-slate-500">{v}</div>
                <div className="flex w-full items-end" style={{ height: 120 }}>
                  <div className="w-full rounded-t bg-indigo-500/80" style={{ height: `${h}%` }} title={`${v} lượt AI · ${byDate[d].c} comment`} />
                </div>
                <div className="text-[10px] text-slate-500">{d.slice(5)}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['free', 'basic', 'pro', 'business'] as const).map(id => (
          <Card key={id} className="p-4">
            <div className="text-sm font-semibold text-slate-100">{PLANS[id].name}</div>
            <div className="mt-1 text-xs text-slate-500">{PLANS[id].dailyActions} comment+bài/ngày · trần AI {PLANS[id].aiDailyCap}/ngày</div>
          </Card>
        ))}
      </div>
    </div>
  )
}
