import {
  IconAlertTriangle, IconRobot, IconChecks, IconClockHour4, IconListNumbers,
  IconTarget, IconUsersGroup, IconSend, IconBookmark, IconCrown,
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Stat, Badge, Card } from '../ui.jsx'

const PHASE_LABEL = { scan: '🔎 Đang quét bài & soạn comment', discover: '🧭 Đang chấm điểm nhóm', search: '🧭 Đang tìm & chấm điểm nhóm mới', post: '📤 Đang đăng' }
const PLAN_NAME = { free: 'Miễn phí', basic: 'Cơ bản', pro: 'Chuyên', business: 'Đại lý' }

function LiveProgress({ progress }) {
  const fresh = progress?.updatedAt && (Date.now() - progress.updatedAt < 20000)
  if (!progress?.active || !fresh) return null
  const { phase, current = 0, total = 0, label } = progress
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null
  return (
    <Card className="border-indigo-500/40 bg-indigo-500/[0.06] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-indigo-200">{PHASE_LABEL[phase] || 'Đang xử lý'}</span>
        <span className="text-xs text-slate-400">{total > 0 ? `${current}/${total}` : 'đang chạy…'}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        {pct === null
          ? <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500" />
          : <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />}
      </div>
      {label && <div className="mt-2 truncate text-xs text-slate-400">{label}</div>}
    </Card>
  )
}

export default function Overview() {
  const { s, account } = useShope()
  if (!s) return <p className="text-slate-500">Đang tải…</p>
  const { cfg, state, stats, queue } = s
  const running = cfg.autoEnabled && !cfg.killSwitch
  const mode = cfg.mode || 'affiliate'
  const a = account

  const nGroups = (cfg.groupIds || []).length
  const scored = (s.discoveredGroups || []).length
  const posted = (s.commentHistory || []).length
  const savedN = (s.savedGroupLists || []).length + (s.savedPosts || []).length
  const pro = a?.loggedIn && a.plan && a.plan !== 'free'
  const quota = a?.loggedIn ? (a.remaining === -1 ? 'Không giới hạn' : `${a.usedToday ?? 0}/${a.dailyLimit ?? 5}`) : '—'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-slate-100">Tổng quan</h1>
        <Badge color={mode === 'social' ? 'blue' : 'orange'}>{mode === 'social' ? 'Comment dạo' : 'Rải link'}</Badge>
        <Badge color={cfg.killSwitch ? 'red' : running ? 'green' : 'gray'}>{cfg.killSwitch ? 'KILL' : running ? 'Auto đang chạy' : 'Auto tắt'}</Badge>
      </div>

      <LiveProgress progress={s.progress} />

      {/* Tài khoản & gói */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold ${pro ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-600 text-white'}`}>
            {pro ? <IconCrown size={22} /> : (a?.name || a?.email || '?')[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-slate-100">{a?.loggedIn ? (a.name || a.email) : 'Chưa đăng nhập'}</div>
            <div className="text-xs text-slate-400">Gói {PLAN_NAME[a?.plan] || 'Miễn phí'} · hạn mức hôm nay {quota}{a?.expiresAt ? ` · hết hạn ${new Date(a.expiresAt).toLocaleDateString('vi')}` : ''}</div>
          </div>
        </div>
        <a href="/dashboard" className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-4 py-2 text-sm font-semibold text-white hover:from-orange-400 hover:to-red-500">{pro ? 'Quản lý gói' : 'Nâng cấp Pro'}</a>
      </Card>

      {/* Thống kê */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Hạn mức hôm nay" value={quota} icon={IconClockHour4} color="blue" />
        <Stat label="Tổng đã đăng" value={stats.totalCommented} icon={IconChecks} color="green" />
        <Stat label="Hàng chờ duyệt" value={queue.length} icon={IconListNumbers} color="orange" />
        <Stat label="Đã đăng (lịch sử)" value={posted} icon={IconSend} color="green" />
        <Stat label="Nhóm mục tiêu" value={nGroups} icon={IconTarget} color="indigo" />
        <Stat label="Nhóm đã chấm điểm" value={scored} icon={IconUsersGroup} color="indigo" />
        <Stat label="Mục đã lưu" value={savedN} icon={IconBookmark} color="gray" />
        <Stat label="Phiên gần nhất" value={state.doneToday} icon={IconRobot} color={running ? 'green' : 'gray'} />
      </div>

      {/* Trạng thái / lỗi */}
      {(cfg.killSwitch || stats.lastError) && (
        <Section title="Trạng thái">
          {cfg.killSwitch && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-300">Đang ở chế độ <b>KILL</b>. Vào <b>Comment dạo</b> → mục <b>Auto</b> bấm <b>Bật Auto</b> để chạy lại.</div>}
          {stats.lastError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <IconAlertTriangle size={16} className="mt-0.5 shrink-0" /> <span className="break-words">{stats.lastError}</span>
            </div>
          )}
        </Section>
      )}
    </div>
  )
}
