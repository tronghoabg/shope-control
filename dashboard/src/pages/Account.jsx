import { useState } from 'react'
import {
  IconCrown, IconShieldLock, IconLogout, IconExternalLink, IconPlugConnected, IconPlugConnectedX,
  IconBrandFacebook, IconShoppingCart, IconCopy, IconCheck, IconBolt, IconCalendarTime, IconGauge, IconUserCircle,
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Card, Badge, Stat } from '../ui.jsx'

const PLAN_NAME = { free: 'Miễn phí', basic: 'Cơ bản', pro: 'Chuyên', business: 'Đại lý' }

// Hàng trạng thái kết nối
function ConnRow({ ok, icon: Icon, label, detail, picture }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 hover:border-slate-700/60 transition-colors">
      <div className="flex min-w-0 items-center gap-3">
        {picture
          ? <img src={picture} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full object-cover border border-slate-800" />
          : <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800 border-slate-850 text-slate-500'}`}><Icon size={16} /></div>}
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-200">{label}</div>
          {detail && <div className="truncate text-[11px] text-slate-500 font-medium mt-0.5">{detail}</div>}
        </div>
      </div>
      <Badge color={ok ? 'green' : 'red'} className="text-[10px]">{ok ? 'Hoạt động' : 'Ngoại tuyến'}</Badge>
    </div>
  )
}

export default function Account() {
  const { s, connected, account } = useShope()
  const a = account
  const [copied, setCopied] = useState(false)

  if (a === null) return <p className="text-slate-500">Đang đồng bộ dữ liệu tài khoản…</p>

  if (!a.loggedIn) {
    return (
      <div className="mx-auto max-w-md py-20 text-center animate-fadeIn">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-500 shadow-lg"><IconUserCircle size={32} /></div>
        <h1 className="text-lg font-bold text-slate-100">Bạn chưa đăng nhập</h1>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">Vui lòng đăng nhập tài khoản hệ thống để đồng bộ giấy phép sử dụng và kích hoạt AI rải link tự động.</p>
        <a href="/login" className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-indigo-500 shadow-md transition-colors">Đăng nhập tài khoản</a>
      </div>
    )
  }

  const pro = a.plan && a.plan !== 'free'
  const initial = (a.name || a.email || '?')[0].toUpperCase()
  const conn = s?.conn
  const shopee = s?.shopee
  const usedTxt = a.remaining === -1 ? 'Không giới hạn' : `${a.usedToday ?? 0}/${a.dailyLimit ?? 5}`
  const remainTxt = a.remaining === -1 ? 'Không giới hạn' : `${a.remaining ?? 0} bài`
  const token = a.apiToken || ''
  const masked = token ? `${token.slice(0, 8)}••••••••${token.slice(-4)}` : ''

  const copyToken = () => {
    if (!token) return
    navigator.clipboard.writeText(token)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fadeIn">
      <div className="border-b border-slate-900/65 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Hồ sơ cá nhân</h1>
        <p className="text-sm text-slate-400">Quản lý giấy phép sử dụng, liên kết API token và kiểm tra trạng thái các cổng kết nối.</p>
      </div>

      {/* Profile Header */}
      <Card className="overflow-hidden border border-slate-800 bg-slate-900/20">
        <div className="h-20 bg-gradient-to-r from-orange-500/20 via-rose-500/10 to-violet-500/20" />
        <div className="-mt-8 flex flex-wrap items-end justify-between gap-4 px-6 pb-6">
          <div className="flex items-end gap-4">
            <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-extrabold ring-4 ring-[#0b0e17] ${
              pro ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' : 'bg-indigo-650 text-white'
            }`}>
              {pro ? <IconCrown size={28} /> : initial}
            </div>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-slate-100">{a.name || a.email}</span>
                {a.isAdmin && <Badge color="orange" className="text-[9px] font-extrabold"><IconShieldLock size={11} className="inline mr-0.5" /> Quản trị viên</Badge>}
              </div>
              <div className="text-xs text-slate-500 mt-1">{a.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <a href="/api/auth/signout?callbackUrl=/"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/30 transition-all">
              <IconLogout size={14} /> Đăng xuất tài khoản
            </a>
          </div>
        </div>
      </Card>

      {/* Quotas grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Gói dịch vụ" value={PLAN_NAME[a.plan] || 'Miễn phí'} icon={IconCrown} color={pro ? 'orange' : 'gray'} />
        <Stat label="Đã dùng hôm nay" value={usedTxt} icon={IconGauge} color="indigo" />
        <Stat label="Lượt còn lại" value={remainTxt} icon={IconBolt} color="green" />
      </div>

      {/* Subscription upgrade card */}
      <Section title="Thông tin dịch vụ">
        <div className="flex flex-wrap items-center justify-between gap-4 py-1">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <Badge color={pro ? 'green' : 'gray'} className="text-[9px] font-extrabold">{PLAN_NAME[a.plan] || 'Miễn phí'}</Badge>
              <span className="text-slate-350 font-bold">{a.remaining === -1 ? 'Không giới hạn comment & bài viết hàng ngày' : `Hạn mức ${a.dailyLimit ?? 5} comment & bài viết/ngày`}</span>
            </div>
            {a.expiresAt && (
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-1">
                <IconCalendarTime size={13} /> Ngày hết hạn gói: {new Date(a.expiresAt).toLocaleDateString('vi')}
              </div>
            )}
          </div>
          <a href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-650 hover:from-orange-400 hover:to-red-500 px-5 py-2.5 text-xs font-extrabold uppercase text-white shadow-md transition-all active:scale-98">
            {pro ? 'Nâng cấp / Gia hạn' : 'Nâng cấp lên PRO ngay'} <IconExternalLink size={13} />
          </a>
        </div>
      </Section>

      {/* Connection summary */}
      <Section title="Trạng thái các cổng kết nối">
        <div className="space-y-2.5">
          <ConnRow ok={connected} icon={connected ? IconPlugConnected : IconPlugConnectedX} label="Cầu nối Extension"
            detail={connected ? 'Đã kết nối thành công và sẵn sàng tự động hóa' : 'Không có phản hồi — Vui lòng bật Extension và tải lại (F5)'} />
          <ConnRow ok={!!conn?.connected} icon={IconBrandFacebook} label="Tài khoản Facebook"
            picture={conn?.connected ? conn.picture : null}
            detail={conn?.connected ? `Đang hoạt động: ${conn.name || conn.id}` : 'Chưa có thông tin kết nối Facebook'} />
          <ConnRow ok={!!shopee?.loggedIn} icon={IconShoppingCart} label="Cổng Shopee Affiliate"
            detail={shopee?.loggedIn ? 'Đã đăng nhập Shopee' : 'Chưa có phiên đăng nhập trên shopee.vn'} />
        </div>
      </Section>

      {/* API token row */}
      <Section title="Mã bảo mật liên kết (API Token)">
        <p className="text-xs text-slate-500 leading-relaxed mb-3">Mã API Token được dùng để xác thực và đồng bộ dữ liệu cấu hình/hạn mức giữa tài khoản web của bạn và Chrome Extension. Vui lòng giữ bí mật mã này.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-xs text-slate-400 font-mono">{masked || 'Chưa thiết lập token'}</code>
          <button onClick={copyToken} disabled={!token}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors h-10">
            {copied ? <><IconCheck size={14} /> Đã sao chép</> : <><IconCopy size={14} /> Sao chép</>}
          </button>
        </div>
      </Section>
    </div>
  )
}
