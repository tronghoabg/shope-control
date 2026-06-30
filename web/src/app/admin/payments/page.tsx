import { prisma } from '@/lib/prisma'
import { PLANS } from '@/lib/plans'
import { Card, Badge, fmtVnd } from '@/components/ui'

export default async function AdminPayments() {
  const [payments, paidAgg, pendingCount] = await Promise.all([
    prisma.payment.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),
    prisma.payment.count({ where: { status: 'pending' } }),
  ])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-100">Thanh toán</h1>
        <div className="flex gap-2 text-sm">
          <Badge color="green">Đã thu: {fmtVnd(paidAgg._sum.amount || 0)}</Badge>
          <Badge color="orange">Chờ: {pendingCount}</Badge>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3 text-left">Mã CK</th>
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-left">Gói</th>
                <th className="p-3 text-right">Số tiền</th>
                <th className="p-3 text-left">Trạng thái</th>
                <th className="p-3 text-left">Lúc</th>
              </tr>
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
    </div>
  )
}
