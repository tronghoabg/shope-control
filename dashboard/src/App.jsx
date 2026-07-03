import { useState, useEffect } from 'react'
import {
  IconLayoutDashboard, IconUsersGroup, IconListCheck, IconShoppingCart,
  IconSettings, IconBrandFacebook, IconHistory, IconLock, IconPlugConnected, IconPlugConnectedX, IconCompass, IconChecks, IconLink, IconUserCircle, IconCrown, IconSend, IconBookmark, IconHelp, IconLogout, IconShieldLock, IconBuildingStore, IconTestPipe,
} from '@tabler/icons-react'

console.log('Cache buster', Date.now());
const PLAN_NAME = { free: 'Miễn phí', basic: 'Cơ bản', pro: 'Chuyên', business: 'Đại lý' }

function AccountBox({ account, onManage }) {
  const a = account
  if (a === null) return <div className="mt-auto border-t border-slate-800/50 p-4 text-xs text-slate-500">Đang tải tài khoản…</div>
  if (!a.loggedIn) return (
    <div className="mt-auto border-t border-slate-800/50 p-3 bg-slate-950/20">
      <button onClick={onManage} className="flex w-full items-center gap-3 rounded-xl p-2.5 border border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 transition-colors">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-400 border border-slate-700"><IconUserCircle size={18} /></div>
        <div className="min-w-0 flex-1 text-left">
          <div className="text-xs font-semibold text-slate-300">Đăng nhập</div>
          <div className="text-[10px] text-slate-500 truncate">Kích hoạt AI & Hạn mức</div>
        </div>
      </button>
    </div>
  )
  const pro = a.plan && a.plan !== 'free'
  const usedTxt = a.remaining === -1 ? 'Không giới hạn' : `${a.usedToday ?? 0}/${a.dailyLimit ?? 5}`
  const initial = (a.name || a.email || '?')[0].toUpperCase()
  return (
    <div className="mt-auto p-4 bg-gradient-to-b from-transparent to-slate-950/50 border-t border-slate-900/50">
      <button onClick={onManage} className={`relative flex w-full items-center gap-3 rounded-2xl p-3 text-left border transition-all duration-300 shadow-lg overflow-hidden group ${
        pro ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 hover:border-amber-500/50' : 'border-slate-800/80 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-700'
      }`}>
        {pro && <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-transparent pointer-events-none" />}
        <div className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold shadow-inner ${
          pro 
            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-500/30' 
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/30'
        }`}>
          {pro ? <IconCrown size={18} /> : initial}
        </div>
        <div className="min-w-0 flex-1 relative z-10">
          <div className="truncate text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{a.name || a.email}</div>
          <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
            <span className={pro ? 'font-bold text-amber-400' : 'text-slate-500'}>{PLAN_NAME[a.plan] || 'Free'}</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-500 truncate">{usedTxt}</span>
          </div>
        </div>
      </button>
      <a href="/api/auth/signout?callbackUrl=/"
        className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-slate-850 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/30 transition-all">
        <IconLogout size={12} /> Đăng xuất
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
import Tools from './pages/Tools.jsx'
import PostGroups from './pages/PostGroups.jsx'
import Saved from './pages/Saved.jsx'
import CommentGroups from './pages/CommentGroups.jsx'
import CommentPages from './pages/CommentPages.jsx'
import Posted from './pages/Posted.jsx'
import Catalog from './pages/Catalog.jsx'
import Logs from './pages/Logs.jsx'
import Settings from './pages/Settings.jsx'
import Account from './pages/Account.jsx'
import Guide from './pages/Guide.jsx'

const NAV = [
  { key: 'overview', label: 'Tổng quan', icon: IconLayoutDashboard, render: (goto) => <Overview goto={goto} /> },
  // VẬN HÀNH CHIẾN DỊCH
  { key: 'cmtgroups', label: 'Comment Nhóm', icon: IconUsersGroup, render: () => <CommentGroups /> },
  { key: 'cmtpages', label: 'Comment Fanpage', icon: IconBuildingStore, render: (goto) => <CommentPages goto={goto} /> },
  { key: 'postgroups', label: 'Đăng bài tự động', icon: IconSend, render: () => <PostGroups /> },
  // MỤC TIÊU & NGUỒN LỰC
  { key: 'discover', label: 'Tìm kiếm Nhóm', icon: IconCompass, render: () => <Discover /> },
  { key: 'groups', label: 'Nhóm của tôi', icon: IconListCheck, render: () => <Groups /> },
  { key: 'pages', label: 'Tìm Fanpage', icon: IconCompass, render: (goto) => <Pages goto={goto} /> },
  { key: 'catalog', label: 'Catalog sản phẩm', icon: IconShoppingCart, render: () => <Catalog /> },
  { key: 'saved', label: 'Mục tiêu đã lưu', icon: IconBookmark, render: () => <Saved /> },
  // BÁO CÁO & HỆ THỐNG
  { key: 'posted', label: 'Lịch sử đã đăng', icon: IconChecks, render: () => <Posted /> },
  { key: 'logs', label: 'Nhật ký chạy', icon: IconHistory, render: () => <Logs /> },
  { key: 'tools', label: 'Công cụ debug', icon: IconLink, render: () => <Tools /> },
  { key: 'settings', label: 'Cấu hình AI', icon: IconSettings, render: () => <Settings /> },
  { key: 'guide', label: 'Tài liệu hướng dẫn', icon: IconHelp, render: (goto) => <Guide goto={goto} /> },
  // 'account' không nằm trong SECTIONS
  { key: 'account', label: 'Tài khoản', icon: IconUserCircle, render: () => <Account /> },
]

const NAV_BY_KEY = Object.fromEntries(NAV.map(n => [n.key, n]))
const SECTIONS = [
  { title: null, keys: ['overview'] },
  { title: 'Vận hành chiến dịch', keys: ['cmtgroups', 'cmtpages', 'postgroups'] },
  { title: 'Mục tiêu & Nguồn lực', keys: ['discover', 'groups', 'pages', 'catalog', 'saved'] },
  { title: 'Hệ thống & Báo cáo', keys: ['posted', 'logs', 'tools', 'settings', 'guide'] },
]

// Chip trạng thái kết nối ở header (xanh = ok, đỏ = chưa)
function StatusChip({ ok, icon: Icon, label, title, onClick }) {
  const cls = ok 
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
    : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
  return (
    <button type="button" onClick={onClick || undefined} title={title} disabled={!onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all duration-300 ${cls} ${onClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}>
      <Icon size={14} className="shrink-0" />
      <span className="hidden sm:inline">{label}</span>
      <span className="relative flex h-2 w-2 shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ok ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
        <span className={`relative inline-flex rounded-full h-2 w-2 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
      </span>
    </button>
  )
}

export default function App() {
  const { s, connected, aiReady, connectFb, account } = useShope()
  const [page, setPage] = useState(() => {
    const hash = window.location.hash.replace('#', '')
    return NAV_BY_KEY[hash] ? hash : 'overview'
  })

  useEffect(() => {
    window.location.hash = page
  }, [page])

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (NAV_BY_KEY[hash]) setPage(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const conn = s?.conn
  const shopee = s?.shopee
  const queueCount = s?.queue?.length ?? 0
  const logCount = s?.logs?.length ?? 0

  // Sau vài giây vẫn chưa kết nối
  const [notInstalled, setNotInstalled] = useState(false)
  useEffect(() => {
    if (connected && s) { setNotInstalled(false); return }
    const t = setTimeout(() => setNotInstalled(true), 6000)
    return () => clearTimeout(t)
  }, [connected, s])

  // Chưa kết nối được extension
  if (!connected || !s) {
    if (!notInstalled) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center animate-pulse">
          <LogoMark size={64} />
          <div className="text-xl font-extrabold text-slate-100 tracking-tight">ToolMKT AI</div>
          <div className="flex items-center gap-2.5 text-sm text-slate-400"><Spinner className="text-indigo-500 h-5 w-5 border-t-transparent" /> Đang thiết lập kết nối extension…</div>
        </div>
      )
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <LogoMark size={64} />
        <div className="text-xl font-extrabold text-slate-100 tracking-tight">Chưa cài đặt extension cầu nối</div>
        <div className="max-w-md text-sm leading-relaxed text-slate-400">
          Không tìm thấy extension <b>ToolMKT AI</b> trên trình duyệt của bạn. Hãy cài đặt extension để bắt đầu tự động hóa Facebook.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href="https://chromewebstore.google.com/detail/mocolnncfiogaiiijfkjnoggmeplbfel" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-900/30 hover:bg-indigo-500 transition-colors">
            <IconPlugConnected size={18} /> Cài đặt từ Chrome Store
          </a>
          <a href="/cai-dat"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/40 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors">
            Hướng dẫn cài đặt
          </a>
        </div>
        <div className="max-w-md text-xs leading-relaxed text-slate-500 bg-slate-900/30 border border-slate-800/60 p-4 rounded-2xl">
          Đã cài rồi? Hãy đảm bảo bạn đã bật Extension trên Chrome, sau đó bấm <b>F5 (Tải lại)</b> trang này.
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col font-sans">
      {/* ════ TOP HEADER (full khung) ════ */}
      <header className="grid h-16 shrink-0 grid-cols-3 items-center border-b border-slate-900/60 bg-slate-950/80 backdrop-blur-md px-6">
        {/* Trái: trạng thái kết nối */}
        <div className="flex items-center gap-2">
          <StatusChip ok={connected} icon={connected ? IconPlugConnected : IconPlugConnectedX} label="Extension"
            title={connected ? 'Extension đã kết nối' : 'Chưa kết nối extension — Hãy tải lại extension'} />
          <StatusChip ok={!!conn?.connected} icon={IconBrandFacebook} label="Facebook"
            title={conn?.connected ? `Facebook: ${conn.name || conn.id}` : 'Chưa kết nối Facebook — Bấm để kết nối'}
            onClick={conn?.connected ? null : () => connectFb(false)} />
          <StatusChip ok={!!shopee?.loggedIn} icon={IconShoppingCart} label="Shopee"
            title={shopee?.loggedIn ? 'Shopee đã đăng nhập' : shopee?.hasTab ? 'Có tab Shopee nhưng chưa đăng nhập — Bấm để mở' : 'Chưa mở Shopee — Bấm để mở & đăng nhập'}
            onClick={shopee?.loggedIn ? null : () => window.open('https://shopee.vn', '_blank')} />
        </div>

        {/* Giữa: logo + thương hiệu (bấm về trang chủ) */}
        <a href="https://toolmktai.com" title="toolmktai.com — Về trang chủ"
          className="flex items-center justify-center gap-2.5 transition hover:opacity-90">
          <LogoMark size={30} />
          <div className="text-left leading-tight">
            <div className="bg-gradient-to-r from-orange-400 via-rose-400 to-violet-400 bg-clip-text text-base font-extrabold tracking-tight text-transparent">
              ToolMKT AI
            </div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Hệ thống Marketing trên Facebook
            </div>
          </div>
        </a>

        {/* Phải: tài khoản Facebook (avatar FB) */}
        <div className="flex items-center justify-end gap-3">
          {conn?.connected ? (
            <div title={`Facebook: ${conn.name || conn.id}`}
              className="flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/30 py-1 pl-1 pr-3">
              {conn.picture
                ? <img src={conn.picture} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />
                : <div className="grid h-6 w-6 place-items-center rounded-full bg-[#1877F2] text-white"><IconBrandFacebook size={12} /></div>}
              <span className="max-w-[120px] truncate text-xs font-semibold text-slate-300">{conn.name || conn.id}</span>
            </div>
          ) : (
            <button onClick={() => connectFb(false)} disabled={!connected}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-40 transition-colors">
              <IconBrandFacebook size={14} /> Kết nối Facebook
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ════ SIDEBAR ════ */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-900/60 bg-slate-950/70 backdrop-blur-md">
          <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-3 space-y-4">
            {SECTIONS.map((sec, si) => (
              <div key={si} className="space-y-1">
                {sec.title && <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">{sec.title}</div>}
                <div className="flex flex-col gap-0.5">
                  {sec.keys.map(k => {
                    const item = NAV_BY_KEY[k]
                    const locked = !aiReady && item.key !== 'settings'
                    const active = page === item.key
                    return (
                      <button 
                        key={item.key} 
                        disabled={locked} 
                        onClick={() => setPage(item.key)}
                        className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold tracking-wide transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden
                          ${active 
                            ? 'text-white bg-indigo-500/[0.08] shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                          }`}
                      >
                        {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
                        <item.icon size={18} className={`shrink-0 z-10 relative transition-transform duration-300 ${active ? 'text-indigo-400 scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-105'}`} />
                        <span className="flex-1 text-left truncate z-10 relative">{item.label}</span>
                        {item.key === 'queue' && queueCount > 0 && (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{queueCount}</span>
                        )}
                        {item.key === 'settings' && !aiReady && <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400 border border-red-500/20">cần thiết</span>}
                        {locked && <IconLock size={12} className="opacity-50 text-slate-600" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {account?.isAdmin && (
              <div className="space-y-1">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">Quản trị</div>
                <a href="/admin"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold tracking-wide text-amber-400 border border-transparent hover:border-amber-500/20 hover:bg-amber-500/5 transition-all">
                  <IconShieldLock size={16} className="shrink-0" />
                  <span className="flex-1 text-left">Admin Panel</span>
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
            <main className="flex-1 overflow-y-auto p-6 md:p-8">
              <div className="w-full max-w-[1600px] mx-auto space-y-6">
                {NAV.find(n => n.key === page)?.render(setPage)}
              </div>
            </main>
          </div>

          {/* ── FOOTER ── */}
          <footer className="flex h-11 shrink-0 items-center justify-between border-t border-slate-900/60 bg-slate-950/40 px-6 text-xs text-slate-500 backdrop-blur-sm">
            <span>ToolMKT AI · Phiên bản 1.0</span>
            <div className="flex items-center gap-4">
              <button onClick={() => setPage('guide')} className="hover:text-slate-300 font-medium">Tài liệu</button>
              <span className="text-slate-700">|</span>
              <a href="https://zalo.me/g/fsjwncgaupa915h891zx" target="_blank" rel="noreferrer" className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">💬 Nhóm hỗ trợ Zalo</a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
