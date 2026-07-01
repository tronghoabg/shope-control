import {
  IconAlertTriangle, IconRobot, IconChecks, IconClockHour4, IconListNumbers,
  IconTarget, IconUsersGroup, IconSend, IconBookmark, IconCrown, IconChevronRight, IconCircleCheck, IconAlertCircle, IconArrowRight
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Stat, Badge, Card, Btn } from '../ui.jsx'

const PHASE_LABEL = { scan: '🔎 Đang quét bài & soạn comment', discover: '🧭 Đang chấm điểm nhóm', search: '🧭 Đang tìm & chấm điểm nhóm mới', post: '📤 Đang đăng' }
const PLAN_NAME = { free: 'Miễn phí', basic: 'Cơ bản', pro: 'Chuyên', business: 'Đại lý' }

function LiveProgress({ progress }) {
  const fresh = progress?.updatedAt && (Date.now() - progress.updatedAt < 20000)
  if (!progress?.active || !fresh) return null
  const { phase, current = 0, total = 0, label } = progress
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null
  return (
    <Card className="border-indigo-500/40 bg-indigo-500/[0.04] p-5 shadow-indigo-950/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
          {PHASE_LABEL[phase] || 'Đang xử lý chiến dịch…'}
        </span>
        <span className="text-xs font-mono text-slate-400">{total > 0 ? `${current}/${total}` : 'đang tính toán…'}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
        {pct === null
          ? <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400" />
          : <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />}
      </div>
      {label && <div className="mt-2.5 truncate text-xs text-slate-400 font-mono bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-900">{label}</div>}
    </Card>
  )
}

export default function Overview({ goto }) {
  const { s, account, connectFb } = useShope()
  if (!s) return <p className="text-slate-500">Đang tải dữ liệu tổng quan…</p>
  const { cfg, state, stats, queue } = s
  const running = cfg.autoEnabled && !cfg.killSwitch
  const mode = cfg.mode || 'affiliate'
  const a = account

  const nGroups = (cfg.groupIds || []).length
  const nPages = (s.targetPages || []).length
  const scored = (s.discoveredGroups || []).length
  const posted = (s.commentHistory || []).length
  const savedN = (s.savedGroupLists || []).length + (s.savedPosts || []).length
  const pro = a?.loggedIn && a.plan && a.plan !== 'free'
  const quota = a?.loggedIn ? (a.remaining === -1 ? 'Không giới hạn' : `${a.usedToday ?? 0}/${a.dailyLimit ?? 5}`) : '—'

  // Step calculations for Setup Assistant
  const isFbConnected = !!s.conn?.connected
  const isShopeeConnected = !!s.shopee?.loggedIn
  const isSetupAccountOk = isFbConnected && isShopeeConnected

  const isCatalogOk = s.catalog?.length > 0 || mode === 'social'
  const isTargetsOk = nGroups > 0 || nPages > 0
  const isCampaignActive = running

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">Tổng quan tài khoản</h1>
          <p className="text-sm text-slate-400">Xem nhanh hiện trạng hệ thống và hiệu quả chạy rải link.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={mode === 'social' ? 'blue' : 'orange'}>{mode === 'social' ? 'Comment dạo' : 'Rải link affiliate'}</Badge>
          <Badge color={cfg.killSwitch ? 'red' : running ? 'green' : 'gray'}>
            {cfg.killSwitch ? 'Đã dừng khẩn cấp (KILL)' : running ? 'Auto đang hoạt động' : 'Chưa bật Auto'}
          </Badge>
        </div>
      </div>

      <LiveProgress progress={s.progress} />

      {/* ── TRÌNH TRỢ GIÚP KHỞI TẠO NHANH (SOP) ── */}
      <Section title="Quy trình thiết lập & vận hành chuẩn (SOP)">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-2">
          {/* Bước 1 */}
          <div className={`p-4 rounded-2xl border transition-all ${isSetupAccountOk ? 'bg-emerald-950/10 border-emerald-500/20' : 'bg-slate-900/20 border-slate-800'}`}>
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bước 1</span>
              {isSetupAccountOk 
                ? <IconCircleCheck size={18} className="text-emerald-400" />
                : <IconAlertCircle size={18} className="text-slate-500" />}
            </div>
            <h4 className="font-bold text-sm text-slate-200 mt-2">Liên kết tài khoản</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">Kết nối tài khoản Facebook & đăng nhập Shopee.</p>
            {!isSetupAccountOk && (
              <div className="mt-3 space-y-1.5">
                {!isFbConnected && (
                  <button onClick={() => connectFb(false)} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    → Kết nối FB <IconChevronRight size={10} />
                  </button>
                )}
                {!isShopeeConnected && (
                  <button onClick={() => window.open('https://shopee.vn', '_blank')} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    → Đăng nhập Shopee <IconChevronRight size={10} />
                  </button>
                )}
              </div>
            )}
            {isSetupAccountOk && <span className="inline-block mt-3 text-[11px] font-semibold text-emerald-400">✓ Đã sẵn sàng</span>}
          </div>

          {/* Bước 2 */}
          <div className={`p-4 rounded-2xl border transition-all ${isCatalogOk ? 'bg-emerald-950/10 border-emerald-500/20' : 'bg-slate-900/20 border-slate-800'}`}>
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bước 2</span>
              {isCatalogOk 
                ? <IconCircleCheck size={18} className="text-emerald-400" />
                : <IconAlertCircle size={18} className="text-slate-500" />}
            </div>
            <h4 className="font-bold text-sm text-slate-200 mt-2">Nguồn sản phẩm & AI</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">Cập nhật kho sản phẩm CSV hoặc chọn AI để soạn bài.</p>
            <div className="mt-3">
              <button onClick={() => goto('catalog')} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                → Quản lý Catalog <IconChevronRight size={10} />
              </button>
            </div>
          </div>

          {/* Bước 3 */}
          <div className={`p-4 rounded-2xl border transition-all ${isTargetsOk ? 'bg-emerald-950/10 border-emerald-500/20' : 'bg-slate-900/20 border-slate-800'}`}>
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bước 3</span>
              {isTargetsOk 
                ? <IconCircleCheck size={18} className="text-emerald-400" />
                : <IconAlertCircle size={18} className="text-slate-500" />}
            </div>
            <h4 className="font-bold text-sm text-slate-200 mt-2">Chọn nhóm mục tiêu</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">Quét tìm và tick chọn các nhóm/fanpage phù hợp để rải.</p>
            <div className="mt-3">
              <button onClick={() => goto('discover')} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                → Tìm nhóm mục tiêu <IconChevronRight size={10} />
              </button>
            </div>
          </div>

          {/* Bước 4 */}
          <div className={`p-4 rounded-2xl border transition-all ${isCampaignActive ? 'bg-emerald-950/10 border-emerald-500/20' : 'bg-slate-900/20 border-slate-800'}`}>
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bước 4</span>
              {isCampaignActive 
                ? <IconCircleCheck size={18} className="text-emerald-400 animate-pulse" />
                : <IconAlertCircle size={18} className="text-slate-500" />}
            </div>
            <h4 className="font-bold text-sm text-slate-200 mt-2">Bật rải tự động</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">Bật chế độ Auto rải bài hoặc quét bài tự động duyệt tay.</p>
            <div className="mt-3">
              <button onClick={() => goto('cmtgroups')} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                → Bật rải Nhóm ngay <IconChevronRight size={10} />
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Tài khoản & gói */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className={`grid h-12 w-12 place-items-center rounded-2xl text-base font-extrabold border ${
            pro ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30'
          }`}>
            {pro ? <IconCrown size={24} /> : (a?.name || a?.email || '?')[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-100">{a?.loggedIn ? (a.name || a.email) : 'Chưa đăng nhập'}</div>
            <div className="text-xs text-slate-400 mt-0.5">Gói {PLAN_NAME[a?.plan] || 'Miễn phí'} · Hạn mức hôm nay: <span className="font-semibold text-slate-300">{quota}</span>{a?.expiresAt ? ` · Hết hạn ${new Date(a.expiresAt).toLocaleDateString('vi')}` : ''}</div>
          </div>
        </div>
        <a href="/dashboard" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 px-5 py-2.5 text-xs font-bold tracking-wide uppercase text-white shadow-md shadow-orange-950/20 active:scale-98 transition-all">{pro ? 'Quản lý gói cước' : 'Nâng cấp Pro ngay'}</a>
      </Card>

      {/* Thống kê */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Hạn mức hôm nay" value={quota} icon={IconClockHour4} color="blue" />
        <Stat label="Tổng đã rải" value={stats.totalCommented} icon={IconChecks} color="green" />
        <Stat label="Hàng chờ duyệt" value={queue.length} icon={IconListNumbers} color="orange" />
        <Stat label="Đã đăng (Lịch sử)" value={posted} icon={IconSend} color="indigo" />
        <Stat label="Nhóm mục tiêu" value={nGroups} icon={IconTarget} color="indigo" />
        <Stat label="Nhóm đã chấm điểm" value={scored} icon={IconUsersGroup} color="blue" />
        <Stat label="Mục đã lưu" value={savedN} icon={IconBookmark} color="gray" />
        <Stat label="Phiên gần nhất" value={state.doneToday} icon={IconRobot} color={running ? 'green' : 'gray'} />
      </div>

      {/* Trạng thái / lỗi */}
      {(cfg.killSwitch || stats.lastError) && (
        <Section title="Cảnh báo trạng thái">
          {cfg.killSwitch && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-xs text-red-300 leading-relaxed flex items-start gap-2.5">
              <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
              <div>
                Hệ thống đang ở chế độ <b>DỪNG KHẨN CẤP (KILL)</b>. Vào mục <b>Vận hành chiến dịch → Rải link Nhóm</b> và nhấn <b>Bật Auto</b> để khởi động lại vòng lặp.
              </div>
            </div>
          )}
          {stats.lastError && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-xs text-red-300 leading-relaxed">
              <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" /> 
              <span className="break-words font-mono">Lỗi ghi nhận gần nhất: {stats.lastError}</span>
            </div>
          )}
        </Section>
      )}
    </div>
  )
}
