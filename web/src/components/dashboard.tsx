'use client'
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { PLANS, PAID_PLANS, PlanId } from '@/lib/plans'
import { fmtVnd } from './ui'

export function SignOutBtn() {
  return <button onClick={() => signOut({ callbackUrl: '/' })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">Đăng xuất</button>
}

export function ApiTokenBox({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">{token}</code>
      <button onClick={copy} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">{copied ? 'Đã chép ✓' : 'Sao chép'}</button>
    </div>
  )
}

export function UpgradePanel({ currentPlan }: { currentPlan: PlanId }) {
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)

  const buy = async (plan: PlanId) => {
    setLoading(plan)
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan }) })
    const j = await r.json(); setLoading(null)
    if (r.ok) setOrder(j)
  }

  // Poll kích hoạt sau khi đặt đơn
  useEffect(() => {
    if (!order || paid) return
    const t = setInterval(async () => {
      const r = await fetch('/api/me'); const j = await r.json()
      if (j.plan && j.plan !== 'free') { setPaid(true); clearInterval(t); setTimeout(() => location.reload(), 1500) }
    }, 4000)
    return () => clearInterval(t)
  }, [order, paid])

  if (order) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-slate-300">Quét QR hoặc chuyển khoản với <b>nội dung chính xác</b> bên dưới. Gói tự kích hoạt sau vài giây khi nhận tiền.</div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <img src={order.qr} alt="QR" className="h-52 w-52 rounded-xl border border-slate-700 bg-white" />
          <div className="space-y-2 text-sm">
            <Row k="Ngân hàng" v={order.bank} />
            <Row k="Số tài khoản" v={order.account} copy />
            <Row k="Chủ tài khoản" v={order.accountName} />
            <Row k="Số tiền" v={fmtVnd(order.amount)} copy raw={String(order.amount)} />
            <Row k="Nội dung CK" v={order.code} copy hot />
          </div>
        </div>
        {paid
          ? <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">✓ Đã nhận thanh toán — đang kích hoạt…</div>
          : <div className="flex items-center gap-2 text-sm text-amber-300"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" /> Đang chờ thanh toán…</div>}
        <button onClick={() => setOrder(null)} className="text-sm text-slate-500 hover:text-slate-300">← Chọn gói khác</button>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PAID_PLANS.map(id => {
        const p = PLANS[id]
        return (
          <div key={id} className={`rounded-xl border p-4 ${p.highlight ? 'border-orange-500/60 bg-orange-500/[0.06]' : 'border-slate-700 bg-slate-800/40'}`}>
            <div className="font-semibold text-slate-100">{p.name}</div>
            <div className="mt-1 text-2xl font-bold text-slate-50">{fmtVnd(p.price)}<span className="text-xs font-normal text-slate-500">/tháng</span></div>
            <div className="text-xs text-slate-500">{p.dailyActions} comment+bài/ngày · {p.desc}</div>
            <button onClick={() => buy(id)} disabled={!!loading}
              className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold ${p.highlight ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'} disabled:opacity-50`}>
              {loading === id ? 'Đang tạo…' : currentPlan === id ? 'Gia hạn' : 'Mua'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function Row({ k, v, copy, hot, raw }: { k: string; v: string; copy?: boolean; hot?: boolean; raw?: string }) {
  const [c, setC] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-slate-500">{k}</span>
      <b className={hot ? 'text-orange-300' : 'text-slate-100'}>{v}</b>
      {copy && <button onClick={() => { navigator.clipboard.writeText(raw || v); setC(true); setTimeout(() => setC(false), 1200) }} className="text-xs text-indigo-400 hover:underline">{c ? '✓' : 'chép'}</button>}
    </div>
  )
}
