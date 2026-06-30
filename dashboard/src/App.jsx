import { useState, useEffect } from 'react'
import {
  IconLayoutDashboard, IconUsersGroup, IconListCheck, IconShoppingCart,
  IconSettings, IconBrandFacebook, IconHistory, IconLock, IconPlugConnected, IconPlugConnectedX, IconCompass, IconChecks, IconLink, IconUserCircle, IconCrown, IconSend, IconBookmark, IconHelp, IconLogout, IconShieldLock, IconBuildingStore, IconTestPipe,
} from '@tabler/icons-react'

const PLAN_NAME = { free: 'Miễn phí', basic: 'Cơ bản', pro: 'Chuyên', business: 'Đại lý' }

function AccountBox({ account, onManage }) {
  const a = account
  if (a === null) return <div className="mt-auto border-t border-slate-800 p-3 text-[11px] text-slate-600">Đang tải tài khoản…</div>
  if (!a.loggedIn) return (
    <div className="mt-auto border-t border-slate-800 p-3">
      <a href="/login" className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-slate-800">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-700 text-slate-300"><IconUserCircle size={20} /></div>
        <div><div className="text-sm font-medium text-slate-200">Đăng nhập</div><div className="text-[11px] text-slate-500">Để áp gói &amp; hạn mức →</div></div>
      </a>
    </div>
  )
  const pro = a.plan && a.plan !== 'free'
  const usedTxt = a.remaining === -1 ? 'Không giới hạn' : `${a.usedToday ?? 0}/${a.dailyLimit ?? 5} hôm nay`
  const initial = (a.name || a.email || '?')[0].toUpperCase()
  return (
    <div className="mt-auto border-t border-slate-800 p-3">
      <button onClick={onManage} className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-slate-800">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${pro ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-600 text-white'}`}>
          {pro ? <IconCrown size={18} /> : initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-100">{a.name || a.email}</div>
          <div className="truncate text-[11px] text-slate-500">{a.email}</div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className={pro ? 'font-medium text-amber-400' : 'text-slate-500'}>{PLAN_NAME[a.plan] || 'Miễn phí'}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{usedTxt}</span>
          </div>
        </div>
      </button>
      <a href="/api/auth/signout?callbackUrl=/"
        className="mt-1.5 flex items-center justify-center gap-2 rounded-lg border border-slate-800 px-2 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200">
        <IconLogout size={14} /> Đăng xuất
      </a>
    </div>
  )
}
import { useShope } from './ShopeContext.jsx'
import { Spinner, LogoMark } from './ui.jsx'
import LogPanel from './LogPanel.jsx'
import Overview from './pages/Overview.jsx'
import Discover from './pages/Discover.jsx'
import Groups from './pages/Groups.jsx'
import Pages from './pages/Pages.jsx'
import ShopeeTest from './pages/ShopeeTest.jsx'
import PostGroups from './pages/PostGroups.jsx'
import Saved from './pages/Saved.jsx'
import Queue from './pages/Queue.jsx'
import Posted from './pages/Posted.jsx'
import Catalog from './pages/Catalog.jsx'
import LinkTool from './pages/LinkTool.jsx'
import Logs from './pages/Logs.jsx'
import Settings from './pages/Settings.jsx'
import Account from './pages/Account.jsx'
import Guide from './pages/Guide.jsx'

const NAV = [
  { key: 'overview', label: 'Tổng quan', icon: IconLayoutDashboard, render: (goto) => <Overview goto={goto} /> },
  { key: 'discover', label: 'Tham gia nhóm', icon: IconCompass, render: () => <Discover /> },
  { key: 'groups', label: 'Nhóm của tôi', icon: IconUsersGroup, render: () => <Groups /> },
  { key: 'pages', label: 'Page mục tiêu', icon: IconBuildingStore, render: (goto) => <Pages goto={goto} /> },
  { key: 'postgroups', label: 'Đăng bài nhóm', icon: IconSend, render: () => <PostGroups /> },
  { key: 'saved', label: 'Đã lưu', icon: IconBookmark, render: () => <Saved /> },
  { key: 'queue', label: 'Comment dạo', icon: IconListCheck, render: () => <Queue /> },
  { key: 'posted', label: 'Đã đăng', icon: IconChecks, render: () => <Posted /> },
  { key: 'catalog', label: 'Catalog', icon: IconShoppingCart, render: () => <Catalog /> },
  { key: 'linktool', label: 'Tạo link (test)', icon: IconLink, render: () => <LinkTool /> },
  { key: 'shopeetest', label: 'Lấy link (test)', icon: IconTestPipe, render: () => <ShopeeTest /> },
  { key: 'logs', label: 'Nhật ký', icon: IconHistory, render: () => <Logs /> },
  { key: 'guide', label: 'Hướng dẫn', icon: IconHelp, render: (goto) => <Guide goto={goto} /> },
  { key: 'settings', label: 'Cài đặt', icon: IconSettings, render: () => <Settings /> },
  // 'account' không nằm trong SECTIONS → không hiện ở sidebar, chỉ mở khi bấm ô tài khoản
  { key: 'account', label: 'Tài khoản', icon: IconUserCircle, render: () => <Account /> },
]
const NAV_BY_KEY = Object.fromEntries(NAV.map(n => [n.key, n]))
const SECTIONS = [
  { title: null, keys: ['overview'] },
  { title: 'Bán hàng', keys: ['discover', 'groups', 'pages', 'postgroups', 'queue'] },
  { title: 'Dữ liệu', keys: ['saved', 'posted', 'catalog', 'linktool', 'shopeetest'] },
  { title: 'Hệ thống', keys: ['logs', 'guide', 'settings'] },
]

// Chip trạng thái kết nối ở header (xanh = ok, đỏ = chưa). Có onClick thì bấm được.
function StatusChip({ ok, icon: Icon, label, title, onClick }) {
  const cls = ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
  return (
    <button type="button" onClick={onClick || undefined} title={title} disabled={!onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls} ${onClick ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}>
      <Icon size={13} />
      <span className="hidden sm:inline">{label}</span>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
    </button>
  )
}

export default function App() {
  const { s, connected, aiReady, connectFb, account } = useShope()
  const [page, setPage] = useState('overview')
  const [showLogs, setShowLogs] = useState(true)
  const conn = s?.conn
  const shopee = s?.shopee
  const queueCount = s?.queue?.length ?? 0
  const logCount = s?.logs?.length ?? 0

  useEffect(() => { if (connected && s && !aiReady) setPage('settings') }, [connected, s, aiReady])

  // Sau vài giây vẫn chưa kết nối → coi như chưa cài extension (thay vì spinner treo mãi)
  const [notInstalled, setNotInstalled] = useState(false)
  useEffect(() => {
    if (connected && s) { setNotInstalled(false); return }
    const t = setTimeout(() => setNotInstalled(true), 6000)
    return () => clearTimeout(t)
  }, [connected, s])

  // Chưa kết nối được extension → màn hình hướng dẫn rõ ràng (thay vì các trang treo "Đang tải…")
  if (!connected || !s) {
    // Đang trong vài giây đầu: hiện spinner "đang kết nối"
    if (!notInstalled) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <LogoMark size={64} />
          <div className="text-lg font-bold text-slate-100">ToolMKT AI</div>
          <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner className="text-slate-400" /> Đang kết nối extension…</div>
        </div>
      )
    }
    // Quá thời gian → chưa cài đặt extension, dẫn link tải
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <LogoMark size={64} />
        <div className="text-lg font-bold text-slate-100">Chưa cài đặt extension</div>
        <div className="max-w-md text-sm leading-relaxed text-slate-400">
          Không tìm thấy extension <b>ToolMKT AI</b> trên trình duyệt. Hãy tải và cài đặt extension để bắt đầu sử dụng.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a download href="/extension.zip"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-900/40 hover:bg-indigo-500">
            <IconPlugConnected size={18} /> Tải Extension (Chrome)
          </a>
          <a href="/cai-dat"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800">
            Hướng dẫn cài đặt
          </a>
        </div>
        <div className="max-w-md text-xs leading-relaxed text-slate-500">
          Đã cài rồi? Mở <code className="rounded bg-slate-800 px-1 text-slate-300">chrome://extensions</code> → bật <b>Developer mode</b> → <b>Load unpacked</b> thư mục <code className="rounded bg-slate-800 px-1 text-slate-300">extension/</code> (hoặc bấm ⟳ Reload), rồi <b>F5</b> trang này.
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* ════ TOP HEADER (full khung) ════ */}
      <header className="grid h-14 shrink-0 grid-cols-3 items-center border-b border-slate-800 bg-slate-900/70 px-5">
        {/* Trái: trạng thái kết nối */}
        <div className="flex items-center gap-2">
          <StatusChip ok={connected} icon={connected ? IconPlugConnected : IconPlugConnectedX} label="Extension"
            title={connected ? 'Extension đã kết nối' : 'Chưa kết nối extension — Reload extension + F5'} />
          <StatusChip ok={!!conn?.connected} icon={IconBrandFacebook} label="Facebook"
            title={conn?.connected ? `Facebook: ${conn.name || conn.id}` : 'Chưa kết nối Facebook — bấm để kết nối'}
            onClick={conn?.connected ? null : () => connectFb(false)} />
          <StatusChip ok={!!shopee?.loggedIn} icon={IconShoppingCart} label="Shopee"
            title={shopee?.loggedIn ? 'Shopee đã đăng nhập' : shopee?.hasTab ? 'Có tab Shopee nhưng chưa đăng nhập — bấm để mở' : 'Chưa mở Shopee — bấm để mở & đăng nhập'}
            onClick={shopee?.loggedIn ? null : () => window.open('https://shopee.vn', '_blank')} />
        </div>

        {/* Giữa: logo + thương hiệu (bấm về trang chủ) */}
        <a href="https://toolmktai.com" title="toolmktai.com — Về trang chủ"
          className="flex items-center justify-center gap-2 transition hover:opacity-90">
          <LogoMark size={28} />
          <div className="text-left leading-tight">
            <div className="bg-gradient-to-r from-orange-400 via-rose-400 to-violet-400 bg-clip-text text-base font-extrabold tracking-tight text-transparent">
              ToolMKT AI
            </div>
            <div className="text-[10px] font-medium text-slate-400">
              toolmktai.com · Tìm khách hàng trên Facebook
            </div>
          </div>
        </a>

        {/* Phải: tài khoản Facebook (avatar FB) */}
        <div className="flex items-center justify-end gap-2">
          {!showLogs && (
            <button onClick={() => setShowLogs(true)} title="Hiện nhật ký"
              className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700">
              <IconHistory size={14} />{logCount ? ` ${logCount}` : ''}
            </button>
          )}
          {conn?.connected ? (
            <div title={`Facebook: ${conn.name || conn.id}`}
              className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 py-0.5 pl-0.5 pr-2.5">
              {conn.picture
                ? <img src={conn.picture} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />
                : <div className="grid h-6 w-6 place-items-center rounded-full bg-[#1877F2] text-white"><IconBrandFacebook size={13} /></div>}
              <span className="max-w-[130px] truncate text-xs font-medium text-slate-200">{conn.name || conn.id}</span>
            </div>
          ) : (
            <button onClick={() => connectFb(false)} disabled={!connected}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1668d8] disabled:opacity-40">
              <IconBrandFacebook size={14} /> Kết nối Facebook
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
      {/* ════ SIDEBAR ════ */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
        <nav className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
          {SECTIONS.map((sec, si) => (
            <div key={si} className={si > 0 ? 'mt-3' : 'mt-1'}>
              {sec.title && <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{sec.title}</div>}
              <div className="flex flex-col gap-0.5">
                {sec.keys.map(k => {
                  const item = NAV_BY_KEY[k]
                  const locked = !aiReady && item.key !== 'settings'
                  const active = page === item.key
                  return (
                    <button key={item.key} disabled={locked} onClick={() => setPage(item.key)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40
                        ${active ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/40' : 'text-slate-300 hover:bg-slate-800'}`}>
                      <item.icon size={18} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.key === 'queue' && queueCount > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">{queueCount}</span>
                      )}
                      {item.key === 'settings' && !aiReady && <span className="rounded bg-red-500/20 px-1.5 text-[10px] font-semibold text-red-400">cần</span>}
                      {locked && <IconLock size={13} className="opacity-50" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {account?.isAdmin && (
            <div className="mt-3">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Quản trị</div>
              <a href="/admin"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10">
                <IconShieldLock size={18} />
                <span className="flex-1 text-left">Admin</span>
              </a>
            </div>
          )}
        </nav>

        <AccountBox account={account} onManage={() => setPage('account')} />
      </aside>

      {/* ════ RIGHT: Container · Footer ════ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── CONTAINER ── */}
        <div className="flex min-h-0 flex-1">
          <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
            <div className="mx-auto max-w-5xl">
              {NAV.find(n => n.key === page)?.render(setPage)}
            </div>
          </main>
          {showLogs && <LogPanel onClose={() => setShowLogs(false)} />}
        </div>

        {/* ── FOOTER ── */}
        <footer className="flex h-9 shrink-0 items-center justify-between border-t border-slate-800 bg-slate-900/50 px-5 text-xs text-slate-500">
          <span>ToolMKT AI · v1.0</span>
          <div className="flex items-center gap-4">
            <button onClick={() => setPage('guide')} className="hover:text-slate-300">Hướng dẫn</button>
            <a href="https://zalo.me/g/fsjwncgaupa915h891zx" target="_blank" rel="noreferrer" className="font-medium text-emerald-400 hover:text-emerald-300">💬 Nhóm hỗ trợ Zalo</a>
          </div>
        </footer>
      </div>
      </div>
    </div>
  )
}
