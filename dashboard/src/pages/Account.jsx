import { useState } from 'react'
import {
  IconCrown, IconShieldLock, IconLogout, IconExternalLink, IconPlugConnected, IconPlugConnectedX,
  IconBrandFacebook, IconShoppingCart, IconCopy, IconCheck, IconBolt, IconCalendarTime, IconGauge, IconUserCircle,
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Card, Badge, Stat } from '../ui.jsx'

const PLAN_NAME = { free: 'Miễn phí', basic: 'Cơ bản', pro: 'Chuyên', business: 'Đại lý' }

// Hàng trạng thái kết nối (Extension / Facebook / Shopee)
function ConnRow({ ok, icon: Icon, label, detail, picture }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {picture
          ? <img src={picture} alt="" referrerPolicy="no-referrer" className="h-7 w-7 shrink-0 rounded-full object-cover" />
          : <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}><Icon size={15} /></div>}
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200">{label}</div>
          {detail && <div className="truncate text-xs text-slate-500">{detail}</div>}
        </div>
      </div>
      <Badge color={ok ? 'green' : 'red'}>{ok ? 'Đã kết nối' : 'Chưa kết nối'}</Badge>
    </div>
  )
}

export default function Account() {
  const { s, connected, account } = useShope()
  const a = account
  const [copied, setCopied] = useState(false)

  if (a === null) return <p className="text-slate-500">Đang kiểm tra tài khoản…</p>

  if (!a.loggedIn) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-slate-400"><IconUserCircle size={36} /></div>
        <h1 className="text-lg font-bold text-slate-100">Chưa đăng nhập</h1>
        <p className="mt-1 text-sm text-slate-400">Đăng nhập để kích hoạt AI hệ thống và áp hạn mức theo gói.</p>
        <a href="/login" className="mt-5 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Đăng nhập</a>
      </div>
    )
  }

  const pro = a.plan && a.plan !== 'free'
  const initial = (a.name || a.email || '?')[0].toUpperCase()
  const conn = s?.conn
  const shopee = s?.shopee
  const usedTxt = a.remaining === -1 ? 'Không giới hạn' : `${a.usedToday ?? 0}/${a.dailyLimit ?? 5}`
  const remainTxt = a.remaining === -1 ? '∞' : `${a.remaining ?? 0}`
  const token = a.apiToken || ''
  const masked = token ? `${token.slice(0, 8)}••••••••${token.slice(-4)}` : ''

  const copyToken = () => {
    if (!token) return
    navigator.clipboard.writeText(token)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Tài khoản</h1>

      {/* ── Hồ sơ ── */}
      <Card className="overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-orange-500/30 via-rose-500/20 to-violet-500/30" />
        <div className="-mt-8 flex flex-wrap items-end justify-between gap-3 px-5 pb-5">
          <div className="flex items-end gap-3">
            <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-bold ring-4 ring-slate-900 ${pro ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-600 text-white'}`}>
              {pro ? <IconCrown size={28} /> : initial}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-100">{a.name || a.email}</span>
                {a.isAdmin && <Badge color="orange"><IconShieldLock size={12} /> Admin</Badge>}
              </div>
              <div className="text-sm text-slate-400">{a.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <a href="/api/auth/signout?callbackUrl=/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
              <IconLogout size={15} /> Đăng xuất
            </a>
          </div>
        </div>
      </Card>

      {/* ── Hạn mức ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Gói hiện tại" value={PLAN_NAME[a.plan] || 'Miễn phí'} icon={IconCrown} color={pro ? 'orange' : 'gray'} />
        <Stat label="Dùng hôm nay" value={usedTxt} icon={IconGauge} color="indigo" />
        <Stat label="Còn lại hôm nay" value={remainTxt} icon={IconBolt} color="green" />
      </div>

      {/* ── Gói & nâng cấp ── */}
      <Section title="Gói dịch vụ">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge color={pro ? 'green' : 'gray'}>{PLAN_NAME[a.plan] || 'Miễn phí'}</Badge>
            <span className="text-slate-400">{a.remaining === -1 ? 'Comment + bài không giới hạn' : `${a.dailyLimit ?? 5} comment + bài / ngày`}</span>
            {a.expiresAt && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <IconCalendarTime size={13} /> hết hạn {new Date(a.expiresAt).toLocaleDateString('vi')}
              </span>
            )}
          </div>
          <a href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-4 py-2 text-sm font-semibold text-white hover:from-orange-400 hover:to-red-500">
            {pro ? 'Quản lý gói' : 'Nâng cấp Pro'} <IconExternalLink size={13} />
          </a>
        </div>
      </Section>

      {/* ── Kết nối ── */}
      <Section title="Kết nối">
        <div className="space-y-2">
          <ConnRow ok={connected} icon={connected ? IconPlugConnected : IconPlugConnectedX} label="Extension"
            detail={connected ? 'Extension đang hoạt động' : 'Chưa kết nối — Reload extension + F5'} />
          <ConnRow ok={!!conn?.connected} icon={IconBrandFacebook} label="Facebook"
            picture={conn?.connected ? conn.picture : null}
            detail={conn?.connected ? (conn.name || conn.id) : 'Chưa kết nối tài khoản Facebook'} />
          <ConnRow ok={!!shopee?.loggedIn} icon={IconShoppingCart} label="Shopee"
            detail={shopee?.loggedIn ? 'Đã đăng nhập Shopee' : 'Chưa đăng nhập Shopee'} />
        </div>
      </Section>

      {/* ── API token (liên kết & phát triển) ── */}
      <Section title="Mã liên kết (API token)">
        <p className="mb-2 text-xs text-slate-500">Token này tự liên kết extension với tài khoản — dùng cho AI hệ thống và các tính năng nâng cao sau này. Giữ bí mật, không chia sẻ.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">{masked || 'Chưa có token'}</code>
          <button onClick={copyToken} disabled={!token}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40">
            {copied ? <><IconCheck size={15} /> Đã chép</> : <><IconCopy size={15} /> Sao chép</>}
          </button>
        </div>
      </Section>
    </div>
  )
}
