import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getQuota } from '@/lib/quota'
import { PLANS } from '@/lib/plans'
import { Card, Logo, Badge } from '@/components/ui'
import { SignOutBtn, ApiTokenBox, UpgradePanel } from '@/components/dashboard'

export default async function Dashboard() {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) redirect('/login')

  const quota = await getQuota(userId)
  const plan = PLANS[quota.plan]
  const unlimited = quota.dailyLimit === Infinity
  const pct = unlimited ? 0 : Math.min(100, Math.round((quota.usedToday / Math.max(1, quota.dailyLimit)) * 100))
  const isAdmin = user.role === 'admin'

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            {isAdmin && <Link href="/admin" className="text-sm text-indigo-400 hover:underline">Admin</Link>}
            <span className="hidden text-sm text-slate-400 sm:block">{user.email}</span>
            <SignOutBtn />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-100">Bảng điều khiển</h1>

        {/* Gói + hạn mức */}
        <div className="grid gap-5 md:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Gói hiện tại</span>
              <Badge color={quota.isPro ? 'green' : 'gray'}>{plan.name}</Badge>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-50">{unlimited ? 'Không giới hạn' : `${quota.usedToday}/${quota.dailyLimit}`}</div>
            <div className="text-xs text-slate-500">comment hôm nay (reset 0h VN)</div>
            {!unlimited && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
              </div>
            )}
            {quota.expiresAt && <div className="mt-3 text-xs text-slate-500">Hết hạn: {new Date(quota.expiresAt).toLocaleString('vi')}</div>}
          </Card>

          {/* Kết nối extension */}
          <Card className="p-5">
            <div className="text-sm font-semibold text-slate-100">Kết nối extension</div>
            <p className="mt-1 text-xs text-slate-500">Dán token này vào <b>Cài đặt</b> của extension ToolMKT AI để đồng bộ tài khoản &amp; hạn mức.</p>
            <div className="mt-3"><ApiTokenBox token={user.apiToken || ''} /></div>
            <p className="mt-2 text-xs text-slate-600">Giữ bí mật token này — ai có nó dùng được hạn mức của bạn.</p>
          </Card>
        </div>

        {/* Nâng cấp */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">Nâng cấp Pro — comment không giới hạn</span>
            <Badge color="orange">Thanh toán qua chuyển khoản (SePay)</Badge>
          </div>
          <UpgradePanel currentPlan={quota.plan} />
        </Card>
      </main>
    </div>
  )
}
