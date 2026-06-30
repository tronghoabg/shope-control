import { prisma } from '@/lib/prisma'
import { vnDateKey } from '@/lib/quota'
import { PLANS } from '@/lib/plans'
import { Card, fmtVnd } from '@/components/ui'
import { Users, Crown, Wallet, Cpu, Coins, MessageSquare, Send, Sparkles } from 'lucide-react'

function Stat({ Icon, label, value, sub, color = 'indigo' }: { Icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  const ring: Record<string, string> = {
    indigo: 'text-indigo-400 bg-indigo-500/10', green: 'text-emerald-400 bg-emerald-500/10', blue: 'text-blue-400 bg-blue-500/10',
    orange: 'text-orange-400 bg-orange-500/10', amber: 'text-amber-400 bg-amber-500/10', violet: 'text-violet-400 bg-violet-500/10',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-50">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ring[color]}`}><Icon size={18} /></div>
      </div>
    </Card>
  )
}

const fmt = (n: number) => (n || 0).toLocaleString('vi')
const startOfVNDay = (key: string) => new Date(`${key}T00:00:00+07:00`)

export default async function AdminOverview() {
  const today = vnDateKey()
  const days: string[] = []
  for (let i = 6; i >= 0; i--) days.push(vnDateKey(new Date(Date.now() - i * 86400_000)))
  const startToday = startOfVNDay(today)
  const start7d = startOfVNDay(days[0])

  const [
    users, activeSubs, paidAgg, userTotals, todayAgg, weekRows,
    postedByMode, postedToday, posted7d, topUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { plan: { not: 'free' }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),
    prisma.user.aggregate({ _sum: { aiCallsTotal: true, aiTokensTotal: true } }),
    prisma.dailyUsage.aggregate({ _sum: { comments: true, aiCalls: true, aiTokens: true }, where: { date: today } }),
    prisma.dailyUsage.findMany({ where: { date: { in: days } }, select: { date: true, comments: true, aiCalls: true } }),
    prisma.postedComment.groupBy({ by: ['mode'], _count: { _all: true } }),
    prisma.postedComment.count({ where: { createdAt: { gte: startToday } } }),
    prisma.postedComment.count({ where: { createdAt: { gte: start7d } } }),
    prisma.user.findMany({ orderBy: { aiCallsTotal: 'desc' }, take: 8, select: { email: true, aiCallsTotal: true, aiTokensTotal: true } }),
  ])

  const cmtTotal = postedByMode.find(m => m.mode === 'comment')?._count._all || 0
  const postTotal = postedByMode.find(m => m.mode === 'post')?._count._all || 0
  const aiTotal = userTotals._sum.aiCallsTotal || 0
  const tokenTotal = userTotals._sum.aiTokensTotal || 0

  const byDate: Record<string, { c: number; ai: number }> = {}
  for (const d of days) byDate[d] = { c: 0, ai: 0 }
  for (const r of weekRows) { byDate[r.date].c += r.comments; byDate[r.date].ai += r.aiCalls }
  const maxAi = Math.max(1, ...days.map(d => byDate[d].ai))
  const maxAiTop = Math.max(1, ...topUsers.map(u => u.aiCallsTotal))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Thống kê tổng quan</h1>

      {/* Tổng toàn thời gian */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Toàn thời gian</div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat Icon={Users} label="Người dùng" value={fmt(users)} color="indigo" />
          <Stat Icon={Crown} label="Đang trả phí" value={fmt(activeSubs)} color="amber" />
          <Stat Icon={Wallet} label="Doanh thu" value={fmtVnd(paidAgg._sum.amount || 0)} color="green" />
          <Stat Icon={Cpu} label="Tổng lượt AI" value={fmt(aiTotal)} sub={`${fmt(tokenTotal)} token`} color="violet" />
          <Stat Icon={MessageSquare} label="Tổng comment đã đăng" value={fmt(cmtTotal)} color="blue" />
          <Stat Icon={Send} label="Tổng bài đăng" value={fmt(postTotal)} color="orange" />
          <Stat Icon={Sparkles} label="Tổng đăng (cmt+bài)" value={fmt(cmtTotal + postTotal)} color="green" />
          <Stat Icon={Coins} label="Token TB / lượt AI" value={aiTotal ? fmt(Math.round(tokenTotal / aiTotal)) : '0'} color="violet" />
        </div>
      </div>

      {/* Hôm nay + 7 ngày */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Hôm nay &amp; 7 ngày</div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat Icon={Cpu} label="Lượt AI hôm nay" value={fmt(todayAgg._sum.aiCalls || 0)} sub={`${fmt(todayAgg._sum.aiTokens || 0)} token`} color="violet" />
          <Stat Icon={MessageSquare} label="Comment+bài hôm nay" value={fmt(todayAgg._sum.comments || 0)} color="blue" />
          <Stat Icon={Send} label="Đã đăng hôm nay" value={fmt(postedToday)} sub="comment + bài (lịch sử)" color="orange" />
          <Stat Icon={Send} label="Đã đăng 7 ngày" value={fmt(posted7d)} color="green" />
        </div>
      </div>

      {/* Biểu đồ 7 ngày */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-100">Lượt AI 7 ngày gần nhất</div>
          <div className="text-xs text-slate-500">Tổng 7 ngày: {fmt(days.reduce((s, d) => s + byDate[d].ai, 0))} lượt AI · {fmt(days.reduce((s, d) => s + byDate[d].c, 0))} comment+bài</div>
        </div>
        <div className="flex h-44 items-end gap-2">
          {days.map(d => {
            const v = byDate[d].ai
            const h = Math.round((v / maxAi) * 100)
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-1">
                <div className="text-[10px] text-slate-400">{v}</div>
                <div className="flex w-full items-end" style={{ height: 120 }}>
                  <div className="w-full rounded-t bg-gradient-to-t from-indigo-600 to-indigo-400" style={{ height: `${h}%` }} title={`${v} lượt AI · ${byDate[d].c} comment+bài`} />
                </div>
                <div className="text-[10px] text-slate-500">{d.slice(5)}</div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Top user dùng AI */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">Top người dùng (theo lượt AI)</div>
        {topUsers.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">Chưa có dữ liệu.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {topUsers.map(u => (
              <div key={u.email} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{u.email}</span>
                <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-slate-800 sm:block">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round((u.aiCallsTotal / maxAiTop) * 100)}%` }} />
                </div>
                <span className="w-16 text-right text-sm font-medium text-slate-100">{fmt(u.aiCallsTotal)}</span>
                <span className="w-24 text-right text-xs text-slate-500">{fmt(u.aiTokensTotal)} tk</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Hạn mức gói */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['free', 'basic', 'pro', 'business'] as const).map(id => (
          <Card key={id} className="p-4">
            <div className="text-sm font-semibold text-slate-100">{PLANS[id].name} · {PLANS[id].price ? fmtVnd(PLANS[id].price) : 'Free'}</div>
            <div className="mt-1 text-xs text-slate-500">{PLANS[id].dailyActions} comment+bài/ngày · trần AI {fmt(PLANS[id].aiDailyCap)}/ngày</div>
          </Card>
        ))}
      </div>
    </div>
  )
}
