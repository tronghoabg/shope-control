import { prisma } from '@/lib/prisma'
import { vnDateKey } from '@/lib/quota'
import { PLANS } from '@/lib/plans'
import { Card, Badge } from '@/components/ui'
import { UserActions } from '@/components/admin'

export default async function AdminUsers() {
  const date = vnDateKey()
  const [users, todayRows] = await Promise.all([
    prisma.user.findMany({ include: { subscription: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.dailyUsage.findMany({ where: { date }, select: { userId: true, comments: true, aiCalls: true, aiTokens: true } }),
  ])
  const usage: Record<string, { comments: number; aiCalls: number; aiTokens: number }> =
    Object.fromEntries(todayRows.map(r => [r.userId, r]))

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Người dùng ({users.length})</h1>
      <Card className="overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Gói</th>
                <th className="p-3 text-left">Hết hạn</th>
                <th className="p-3 text-right">AI hôm nay</th>
                <th className="p-3 text-right">Tổng AI</th>
                <th className="p-3 text-left">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const pl = u.subscription?.plan || 'free'
                const active = pl !== 'free' && (!u.subscription?.expiresAt || u.subscription!.expiresAt!.getTime() > Date.now())
                const plan = PLANS[(active ? pl : 'free') as keyof typeof PLANS] || PLANS.free
                const ut = usage[u.id]
                return (
                  <tr key={u.id} className="border-t border-slate-800/60">
                    <td className="p-3 text-slate-200">
                      <div className="flex items-center gap-2">
                        {u.email}
                        {u.role === 'admin' && <Badge color="indigo">admin</Badge>}
                        {u.bannedAt && <Badge color="red">bị chặn</Badge>}
                      </div>
                    </td>
                    <td className="p-3"><Badge color={active ? 'green' : 'gray'}>{plan.name}</Badge></td>
                    <td className="p-3 text-slate-400">{u.subscription?.expiresAt ? new Date(u.subscription.expiresAt).toLocaleDateString('vi') : '—'}</td>
                    <td className="p-3 text-right text-slate-300">{ut?.aiCalls || 0}<span className="ml-1 text-xs text-slate-600">({(ut?.aiTokens || 0).toLocaleString('vi')}tk)</span></td>
                    <td className="p-3 text-right text-slate-400">{u.aiCallsTotal.toLocaleString('vi')}</td>
                    <td className="p-3"><UserActions userId={u.id} banned={!!u.bannedAt} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
