import { useState, useEffect } from 'react'
import {
  IconLayoutDashboard, IconUsersGroup, IconListCheck, IconShoppingCart,
  IconSettings, IconBrandFacebook, IconHistory, IconLock, IconPlugConnected, IconPlugConnectedX, IconCompass, IconChecks, IconLink,
} from '@tabler/icons-react'
import { useShope } from './ShopeContext.jsx'
import { Btn, Badge, Spinner } from './ui.jsx'
import LogPanel from './LogPanel.jsx'
import Overview from './pages/Overview.jsx'
import Discover from './pages/Discover.jsx'
import Groups from './pages/Groups.jsx'
import Queue from './pages/Queue.jsx'
import Posted from './pages/Posted.jsx'
import Catalog from './pages/Catalog.jsx'
import LinkTool from './pages/LinkTool.jsx'
import Logs from './pages/Logs.jsx'
import Settings from './pages/Settings.jsx'

const NAV = [
  { key: 'overview', label: 'Tổng quan', icon: IconLayoutDashboard, render: (goto) => <Overview goto={goto} /> },
  { key: 'discover', label: 'Khám phá nhóm', icon: IconCompass, render: () => <Discover /> },
  { key: 'groups', label: 'Nhóm của tôi', icon: IconUsersGroup, render: () => <Groups /> },
  { key: 'queue', label: 'Hàng chờ duyệt', icon: IconListCheck, render: () => <Queue /> },
  { key: 'posted', label: 'Đã đăng', icon: IconChecks, render: () => <Posted /> },
  { key: 'catalog', label: 'Catalog', icon: IconShoppingCart, render: () => <Catalog /> },
  { key: 'linktool', label: 'Tạo link (test)', icon: IconLink, render: () => <LinkTool /> },
  { key: 'logs', label: 'Nhật ký', icon: IconHistory, render: () => <Logs /> },
  { key: 'settings', label: 'Cài đặt API', icon: IconSettings, render: () => <Settings /> },
]

export default function App() {
  const { s, connected, hasKey, connectFb } = useShope()
  const [page, setPage] = useState('overview')
  const [showLogs, setShowLogs] = useState(true)
  const conn = s?.conn
  const queueCount = s?.queue?.length ?? 0
  const logCount = s?.logs?.length ?? 0

  useEffect(() => { if (connected && s && !hasKey) setPage('settings') }, [connected, s, hasKey])

  // Chưa kết nối được extension → màn hình hướng dẫn rõ ràng (thay vì các trang treo "Đang tải…")
  if (!connected || !s) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-900/40">
          <IconShoppingCart size={30} />
        </div>
        <div className="text-lg font-bold text-slate-100">Shope Control</div>
        <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner className="text-slate-400" /> Đang kết nối extension…</div>
        <div className="max-w-md text-sm leading-relaxed text-slate-500">
          Nếu chờ lâu: mở <code className="rounded bg-slate-800 px-1 text-slate-300">chrome://extensions</code> → bật <b>Developer mode</b> → <b>Load unpacked</b> thư mục <code className="rounded bg-slate-800 px-1 text-slate-300">extension/</code> (hoặc bấm ⟳ Reload), rồi <b>F5</b> trang này.
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
            <IconShoppingCart size={20} />
          </div>
          <div>
            <div className="font-bold leading-tight text-slate-100">Shope Control</div>
            <div className="text-[11px] text-slate-500">Rải link Shopee bằng AI</div>
          </div>
        </div>

        <nav className="mt-2 flex flex-col gap-1 px-2">
          {NAV.map(item => {
            const locked = !hasKey && item.key !== 'settings'
            const active = page === item.key
            return (
              <button key={item.key} disabled={locked} onClick={() => setPage(item.key)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40
                  ${active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <item.icon size={18} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.key === 'queue' && queueCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">{queueCount}</span>
                )}
                {item.key === 'settings' && !hasKey && <span className="rounded bg-red-500/20 px-1.5 text-[10px] font-semibold text-red-400">cần</span>}
                {locked && <IconLock size={13} className="opacity-50" />}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto p-3 text-[11px] text-slate-600">v0.1 · dùng cá nhân</div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-5">
          <div className="flex items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {connected ? <IconPlugConnected size={14} /> : <IconPlugConnectedX size={14} />}
              {connected ? 'Extension' : 'Chưa có extension'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {conn?.connected ? (
              <div className="flex items-center gap-2">
                {conn.picture
                  ? <img src={conn.picture} alt="" className="h-7 w-7 rounded-full" />
                  : <div className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-white"><IconBrandFacebook size={15} /></div>}
                <span className="text-sm font-medium text-slate-200">{conn.name || conn.id}</span>
              </div>
            ) : (
              <Btn variant="primary" size="sm" icon={IconBrandFacebook} onClick={() => connectFb(false)} disabled={!connected}>
                Kết nối Facebook
              </Btn>
            )}
            {!showLogs && (
              <button onClick={() => setShowLogs(true)} title="Hiện nhật ký"
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                <IconHistory size={15} /> Nhật ký{logCount ? ` (${logCount})` : ''}
              </button>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-5xl">
              {NAV.find(n => n.key === page)?.render(setPage)}
            </div>
          </main>
          {showLogs && <LogPanel onClose={() => setShowLogs(false)} />}
        </div>
      </div>
    </div>
  )
}
