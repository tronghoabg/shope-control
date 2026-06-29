import {
  IconPlayerPlay, IconPlayerStop, IconHandStop, IconRadar, IconSend, IconTrash,
  IconAlertTriangle, IconRobot, IconChecks, IconClockHour4, IconListNumbers, IconKey, IconCheck, IconArrowRight,
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Stat, Badge, Card } from '../ui.jsx'

const PHASE_LABEL = { scan: '🔎 Đang quét bài & soạn comment', discover: '🧭 Đang chấm điểm nhóm đã tham gia', search: '🧭 Đang tìm & chấm điểm nhóm mới', post: '📤 Đang đăng comment' }

function LiveProgress({ progress }) {
  // Coi như đang chạy nếu progress.active và mới cập nhật trong ~20s (tránh kẹt khi lỗi giữa chừng)
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

function Step({ n, done, current, title, desc, action }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${current ? 'border-indigo-500/60 bg-indigo-500/[0.07]' : done ? 'border-slate-800 bg-slate-800/20' : 'border-slate-800'}`}>
      <div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : current ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
        {done ? <IconCheck size={14} /> : n}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${done ? 'text-slate-400' : 'text-slate-100'}`}>{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      {action && !done && (
        <Btn size="sm" variant={current ? 'primary' : 'default'} onClick={action.fn}>
          {action.label} <IconArrowRight size={13} />
        </Btn>
      )}
    </div>
  )
}

export default function Overview({ goto }) {
  const { s, hasKey, call, connectFb } = useShope()
  if (!s) return <p className="text-slate-500">Đang tải…</p>
  const { cfg, state, stats, queue, conn } = s
  const running = cfg.autoEnabled && !cfg.killSwitch
  const mode = cfg.mode || 'affiliate'
  const nGroups = (cfg.groupIds || []).length
  const catalogN = (s.catalog || []).length

  // Các bước onboarding
  const rawSteps = [
    { key: 'key', done: hasKey, title: 'Nhập & test API key AI', desc: hasKey ? 'Đã có key ✓' : 'Bắt buộc — AI dùng để đọc & đánh giá nhóm/bài', action: { label: 'Cài đặt', fn: () => goto('settings') } },
    { key: 'fb', done: !!conn?.connected, title: 'Kết nối Facebook', desc: conn?.connected ? `Đã kết nối: ${conn.name || conn.id}` : 'Mở 1 tab facebook.com đã đăng nhập', action: { label: 'Kết nối', fn: () => connectFb(false) } },
    { key: 'groups', done: nGroups > 0, title: 'Chọn nhóm mục tiêu', desc: nGroups > 0 ? `${nGroups} nhóm đã chọn` : 'Tìm nhóm đúng niche & lưu mục tiêu', action: { label: 'Khám phá nhóm', fn: () => goto('discover') } },
    ...(mode === 'affiliate' && (cfg.productSource || 'catalog') === 'catalog'
      ? [{ key: 'catalog', done: catalogN > 0, title: 'Nhập catalog sản phẩm', desc: catalogN > 0 ? `${catalogN} sản phẩm` : 'Cần cho chế độ Rải link (Comment dạo thì bỏ qua)', action: { label: 'Catalog', fn: () => goto('catalog') } }]
      : []),
    ...(mode === 'affiliate' && cfg.productSource === 'shopee'
      ? [{ key: 'aff', done: true, title: 'Đăng nhập Shopee để tạo link hoa hồng', desc: 'Mở sẵn 1 tab shopee.vn (tìm SP) + 1 tab affiliate.shopee.vn (tạo link), cả hai đã đăng nhập', action: { label: 'Cấu hình', fn: () => goto('queue') } }]
      : []),
    { key: 'run', done: queue.length > 0 || stats.totalCommented > 0, title: 'Quét bài → duyệt → đăng', desc: queue.length > 0 ? `${queue.length} bài trong hàng chờ` : 'Quét nhóm tìm bài tiềm năng', action: { label: 'Quét thử nhóm', fn: () => call({ type: 'SCAN_NOW' }, { okMsg: 'Đã quét', timeout: 120000 }) } },
  ]
  const firstUndone = rawSteps.findIndex(s => !s.done)
  const allDone = firstUndone === -1

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-slate-100">Tổng quan</h1>
        <Badge color={mode === 'social' ? 'blue' : 'orange'}>{mode === 'social' ? 'Chế độ: Comment dạo' : 'Chế độ: Rải link'}</Badge>
      </div>

      <LiveProgress progress={s.progress} />

      {/* Hướng dẫn bắt đầu — gập gọn khi đã hoàn tất */}
      {allDone ? (
        <Section title="✅ Đã sẵn sàng">
          <p className="text-sm text-slate-300">Đã thiết lập xong các bước. Dùng <b>Điều khiển</b> bên dưới để <b>Quét bài</b> / <b>Bật Auto</b>, hoặc sang <b>Hàng chờ duyệt</b> để duyệt &amp; đăng.</p>
        </Section>
      ) : (
        <Section title="🚀 Bắt đầu từ đây">
          <div className="space-y-2">
            {rawSteps.map((st, i) => (
              <Step key={st.key} n={i + 1} done={st.done} current={i === firstUndone} title={st.title} desc={st.desc} action={st.action} />
            ))}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Trạng thái" value={cfg.killSwitch ? 'KILL' : running ? 'Đang chạy' : 'Tắt'} icon={IconRobot} color={cfg.killSwitch ? 'red' : running ? 'green' : 'gray'} />
        <Stat label="Hôm nay" value={`${state.doneToday}/${cfg.dailyCap}`} icon={IconClockHour4} color="blue" />
        <Stat label="Tổng đã comment" value={stats.totalCommented} icon={IconChecks} color="green" />
        <Stat label="Hàng chờ" value={queue.length} icon={IconListNumbers} color="orange" />
      </div>

      <Section title="Điều khiển">
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="success" icon={IconPlayerPlay} disabled={running} onClick={() => call({ type: 'START_AUTO' }, { okMsg: 'Đã bật Auto', errMsg: 'Không bật được' })}>Bật Auto</Btn>
          <Btn icon={IconPlayerStop} onClick={() => call({ type: 'STOP_AUTO' }, { okMsg: 'Đã tắt' })}>Tắt</Btn>
          <Btn variant="danger" icon={IconHandStop} onClick={() => call({ type: 'KILL' }, { okMsg: 'Đã DỪNG NGAY' })}>DỪNG NGAY</Btn>
          <div className="ml-auto flex flex-wrap gap-2">
            {queue.length > 0 && <Btn variant="success" icon={IconChecks} onClick={() => goto('queue')}>Duyệt hàng chờ ({queue.length})</Btn>}
            <Btn variant="primary" icon={IconRadar} onClick={() => call({ type: 'SCAN_NOW' }, { okMsg: 'Đã quét', timeout: 120000 })}>Quét thử nhóm</Btn>
            <Btn icon={IconSend} onClick={() => call({ type: 'STEP_NOW' }, { okMsg: 'Đã đăng 1 comment', timeout: 60000 })}>Đăng 1 comment</Btn>
            <Btn variant="ghost" icon={IconTrash} onClick={() => call({ type: 'RESET_HISTORY' }, { okMsg: 'Đã xoá lịch sử' })}>Xoá lịch sử</Btn>
          </div>
        </div>
        {cfg.killSwitch && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-300">Đang ở chế độ KILL. Bấm <b>Bật Auto</b> để chạy lại.</div>}
        {stats.lastError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <IconAlertTriangle size={16} className="mt-0.5 shrink-0" /> <span className="break-words">{stats.lastError}</span>
          </div>
        )}
      </Section>
    </div>
  )
}
