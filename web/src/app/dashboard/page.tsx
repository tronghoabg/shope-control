import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getQuota } from '@/lib/quota'
import { PLANS } from '@/lib/plans'
import { Card, Logo, Badge } from '@/components/ui'
import { SignOutBtn, ApiTokenBox, UpgradePanel } from '@/components/dashboard'
import { genApiToken } from '@/lib/apiAuth'
import { Shield, Gauge, Link2, Crown, ExternalLink } from 'lucide-react'

export default async function Dashboard() {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) redirect('/login')
  let user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) redirect('/login')

  if (!user.apiToken) user = await prisma.user.update({ where: { id: userId }, data: { apiToken: genApiToken() } })
  await prisma.subscription.upsert({ where: { userId }, create: { userId, plan: 'free' }, update: {} })

  const quota = await getQuota(userId)
  const plan = PLANS[quota.plan]
  const pct = Math.min(100, Math.round((quota.usedToday / Math.max(1, quota.dailyLimit)) * 100))
  const isAdmin = user.role === 'admin'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-900/80 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            {isAdmin && <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 px-3 py-1.5 text-sm text-indigo-300 hover:bg-indigo-500/10"><Shield size={15} /> Admin</Link>}
            <Link href="/app" className="hidden rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 sm:inline-flex">Mở công cụ</Link>
            <span className="hidden text-sm text-slate-400 md:block">{user.email}</span>
            <SignOutBtn />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-100">Bảng điều khiển</h1>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Gói + hạn mức */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm text-slate-400"><Gauge size={16} className="text-indigo-400" /> Gói hiện tại</span>
              <Badge color={quota.isPro ? 'green' : 'gray'}>{plan.name}</Badge>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-50">{quota.usedToday}<span className="text-lg text-slate-500">/{quota.dailyLimit}</span></div>
            <div className="text-xs text-slate-500">comment + bài hôm nay (reset 0h VN)</div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
            </div>
            {quota.expiresAt && <div className="mt-3 text-xs text-slate-500">Hết hạn gói: {new Date(quota.expiresAt).toLocaleDateString('vi')}</div>}
          </Card>

          {/* Kết nối extension */}
          <Card className="p-5">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100"><Link2 size={16} className="text-indigo-400" /> Kết nối extension</div>
            <p className="mt-1 text-xs text-slate-500">Bình thường extension <b>tự liên kết</b> khi bạn mở công cụ (/app) — không cần dán token. Token dưới đây chỉ dùng dự phòng.</p>
            <div className="mt-3"><ApiTokenBox token={user.apiToken || ''} /></div>
            <p className="mt-2 text-xs text-slate-600">Giữ bí mật token — ai có nó dùng được hạn mức của bạn.</p>
          </Card>
        </div>

        {/* Nâng cấp */}
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100"><Crown size={16} className="text-amber-400" /> Nâng cấp gói — tăng hạn mức/ngày</span>
            <Badge color="orange">Thanh toán chuyển khoản (SePay)</Badge>
          </div>
          <UpgradePanel currentPlan={quota.plan} />
        </Card>

        <p className="text-center text-xs text-slate-600">
          Cần hỗ trợ? <a href="https://zalo.me/g/fsjwncgaupa915h891zx" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-400 hover:underline">Nhóm Zalo <ExternalLink size={12} /></a>
        </p>
      </main>
    </div>
  )
}
