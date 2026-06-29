import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActivePlan, vnDateKey } from '@/lib/quota'
import { PLANS } from '@/lib/plans'
import { Card, Logo, Badge, fmtVnd } from '@/components/ui'
import { SignOutBtn } from '@/components/dashboard'
import Link from 'next/link'

export default async function Admin() {
  const session = await auth()
  const uid = (session?.user as any)?.id
  if (!uid) redirect('/login')
  const me = await prisma.user.findUnique({ where: { id: uid } })
  if (me?.role !== 'admin') redirect('/dashboard')

  const [users, payments, paidAgg, todayUsage] = await Promise.all([
    prisma.user.findMany({ include: { subscription: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.payment.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),
    prisma.dailyUsage.aggregate({ _sum: { comments: true }, where: { date: vnDateKey() } }),
  ])
  const activeSubs = users.filter(u => u.subscription && u.subscription.plan !== 'free' && (!u.subscription.expiresAt || u.subscription.expiresAt.getTime() > Date.now())).length

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <Card className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold text-slate-50">{value}</div></Card>
  )

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3"><Logo /><Badge color="indigo">Admin</Badge></div>
          <div className="flex items-center gap-3"><Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">Dashboard</Link><SignOutBtn /></div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Người dùng" value={users.length} />
          <Stat label="Đang Pro" value={activeSubs} />
          <Stat label="Doanh thu" value={fmtVnd(paidAgg._sum.amount || 0)} />
          <Stat label="Comment hôm nay" value={todayUsage._sum.comments || 0} />
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">Người dùng</div>
          <div className="max-h-[26rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500">
                <tr><th className="p-3 text-left">Email</th><th className="p-3 text-left">Gói</th><th className="p-3 text-left">Hết hạn</th><th className="p-3 text-left">Quyền</th><th className="p-3 text-left">Tạo</th></tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const pl = u.subscription?.plan || 'free'
                  const active = pl !== 'free' && (!u.subscription?.expiresAt || u.subscription!.expiresAt!.getTime() > Date.now())
                  return (
                    <tr key={u.id} className="border-t border-slate-800/60">
                      <td className="p-3 text-slate-200">{u.email}</td>
                      <td className="p-3"><Badge color={active ? 'green' : 'gray'}>{PLANS[(active ? pl : 'free') as keyof typeof PLANS].name}</Badge></td>
                      <td className="p-3 text-slate-400">{u.subscription?.expiresAt ? new Date(u.subscription.expiresAt).toLocaleDateString('vi') : '—'}</td>
                      <td className="p-3 text-slate-400">{u.role}</td>
                      <td className="p-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString('vi')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">Thanh toán gần đây</div>
          <div className="max-h-[22rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500">
                <tr><th className="p-3 text-left">Mã</th><th className="p-3 text-left">User</th><th className="p-3 text-left">Gói</th><th className="p-3 text-right">Số tiền</th><th className="p-3 text-left">Trạng thái</th><th className="p-3 text-left">Lúc</th></tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-t border-slate-800/60">
                    <td className="p-3 font-mono text-xs text-slate-300">{p.code}</td>
                    <td className="p-3 text-slate-400">{p.user.email}</td>
                    <td className="p-3 text-slate-400">{PLANS[p.plan as keyof typeof PLANS]?.name || p.plan}</td>
                    <td className="p-3 text-right text-slate-200">{fmtVnd(p.amount)}</td>
                    <td className="p-3"><Badge color={p.status === 'paid' ? 'green' : p.status === 'pending' ? 'orange' : 'red'}>{p.status}</Badge></td>
                    <td className="p-3 text-slate-500">{new Date(p.createdAt).toLocaleString('vi')}</td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Chưa có thanh toán nào.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  )
}
