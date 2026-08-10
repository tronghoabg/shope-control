import { useEffect, useState } from 'react'
import {
  IconActivity, IconRobot, IconChecks, IconListNumbers, IconTarget, IconClockPause,
  IconPlayerStop, IconPlayerPause, IconSearch, IconAlertTriangle, IconCircleCheck, IconHourglass, IconChevronRight
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Card, Btn, Stat } from '../ui.jsx'
import { Msg } from '../LogPanel.jsx'

const PHASE = { startup: 'Đang khởi động Auto', scan: 'Đang tìm bài mới', analyze: 'Đang phân tích bài viết', compose: 'Đang soạn comment', comment: 'Đang chuẩn bị comment', posting: 'Đang gửi comment', waiting: 'Đang chờ lượt tiếp theo', activity: 'Đang đồng bộ Activity Log', discover: 'Đang chấm điểm nhóm', search: 'Đang tìm & chấm điểm nhóm mới', post: 'Đang đăng bài' }
const TONE = {
  green: 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300',
  amber: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-300',
  blue: 'border-sky-500/30 bg-sky-500/[0.06] text-sky-300',
  indigo: 'border-indigo-500/30 bg-indigo-500/[0.06] text-indigo-300',
  red: 'border-red-500/30 bg-red-500/[0.06] text-red-300',
  gray: 'border-slate-700/40 bg-slate-800/20 text-slate-300',
}

// Icon theo level log → hoạt động dễ đọc
function logIcon(level) {
  if (level === 'success') return <IconCircleCheck size={15} className="text-emerald-400 shrink-0" />
  if (level === 'error') return <IconAlertTriangle size={15} className="text-red-400 shrink-0" />
  return <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
}

export default function Progress({ goto }) {
  const { s, call, notify } = useShope()
  const [now, setNow] = useState(Date.now())
  const [capVal, setCapVal] = useState(30)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (s?.cfg?.dailyCap != null) setCapVal(s.cfg.dailyCap) }, [s?.cfg?.dailyCap])
  const saveCap = () => { const n = Math.max(1, Number(capVal) || 1); setCapVal(n); call({ type: 'SET_CFG', cfg: { dailyCap: n } }, { okMsg: `Đã đặt hạn mức ${n} bài/ngày` }) }
  if (!s) return <p className="text-slate-500">Đang tải tiến trình…</p>

  const cfg = s.cfg || {}, state = s.state || {}, stats = s.stats || {}, job = s.job
  const prog = s.progress
  // Một lần đọc Facebook/AI có thể kéo dài vài phút. Giữ trạng thái hiện tại
  // đủ lâu để người dùng không thấy giao diện quay về thông báo chung giữa tác vụ.
  const progFresh = prog?.active && prog.updatedAt && (now - prog.updatedAt < 5 * 60 * 1000)
  const autoOn = cfg.autoEnabled && !cfg.killSwitch
  const jobOn = job?.running
  const waitLeft = autoOn && state.nextActionAt > now ? Math.ceil((state.nextActionAt - now) / 1000) : 0

  // ── Tính trạng thái chính (ngôn ngữ dễ hiểu) ──
  let st
  if (cfg.killSwitch) st = { tone: 'red', icon: IconPlayerStop, title: 'Đã dừng khẩn cấp (KILL)', desc: 'Vào Comment Nhóm bấm "Bật Auto" để khởi động lại.' }
  else if (jobOn) st = {
    tone: job.paused ? 'amber' : 'green', icon: job.paused ? IconPlayerPause : IconActivity,
    title: job.paused ? 'Đã tạm dừng chiến dịch' : (job.kind === 'postgroup' ? 'Đang đăng bài (chạy nền)' : 'Đang rải comment (chạy nền)'),
    desc: `Đã xử lý ${job.idx || 0}/${job.total || 0} — chạy trong nền, có thể đóng tab.`,
    bar: { cur: job.idx || 0, total: job.total || 0 },
    stop: () => call({ type: 'JOB_STOP' }, { okMsg: 'Đã dừng' }),
  }
  else if (progFresh) st = { tone: 'indigo', icon: IconSearch, title: PHASE[prog.phase] || 'Đang xử lý…', desc: prog.label || '', bar: prog.total > 0 ? { cur: prog.current || 0, total: prog.total } : null }
  else if (autoOn) {
    const note = stats.autoNote
    if (note === 'approve') st = { tone: 'amber', icon: IconHourglass, title: 'Auto đang chờ bạn DUYỆT comment', desc: `Có ${s.queue?.length || 0} comment trong hàng chờ chưa duyệt. Bạn đang bật "Duyệt tay = Có" nên Auto không tự đăng.`, fix: { label: 'Vào duyệt / tắt Duyệt tay', to: 'cmtgroups' } }
    else if (note === 'nopost') st = { tone: 'blue', icon: IconSearch, title: 'Đang tìm bài — chưa có bài phù hợp', desc: `AI chấm các bài quét được đều điểm thấp (không giống khách đang cần mua) nên bỏ qua. Sẽ thử nhóm khác ở lượt sau.`, fix: { label: 'Kiểm tra nhóm mục tiêu', to: 'groups' } }
    else if (note === 'cap') st = { tone: 'green', icon: IconCircleCheck, title: `Đã đủ ${cfg.dailyCap} bài hôm nay`, desc: 'Auto tạm nghỉ để an toàn, sang ngày mai tự chạy tiếp.' }
    else if (note === 'err') st = { tone: 'red', icon: IconAlertTriangle, title: 'Auto gặp lỗi', desc: stats.lastError || 'Xem Nhật ký để biết chi tiết.' }
    else st = { tone: 'green', icon: IconRobot, title: 'Auto đang hoạt động', desc: 'Đang quét nhóm và đăng comment tự động theo chu kỳ.' }
  }
  else st = { tone: 'gray', icon: IconClockPause, title: 'Chưa chạy chiến dịch nào', desc: 'Vào Comment Nhóm → bấm "Bật Auto" (tự động) hoặc chọn bài rồi "Đăng comment hàng loạt".', fix: { label: 'Tới Comment Nhóm', to: 'cmtgroups' } }

  const Icon = st.icon
  const bar = st.bar
  const pct = bar && bar.total > 0 ? Math.min(100, Math.round((bar.cur / bar.total) * 100)) : null
  const logs = (s.logs || []).slice(-40).reverse()

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="border-b border-slate-900/65 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Tiến trình hoạt động</h1>
        <p className="text-sm text-slate-400">Xem hệ thống đang làm gì theo thời gian thực — dễ hiểu, không cần đọc log kỹ thuật.</p>
      </div>

      {/* Trạng thái chính */}
      <Card className={`p-5 border ${TONE[st.tone]}`}>
        <div className="flex items-start gap-4">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${TONE[st.tone]}`}>
            <Icon size={24} className={jobOn && !job.paused || (autoOn && !st.fix) ? 'animate-pulse' : ''} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-100">{st.title}</h2>
              {waitLeft > 0 && !jobOn && <span className="rounded-full bg-slate-800/80 px-2.5 py-1 text-[11px] font-bold text-slate-300 font-mono">Lượt tiếp theo sau {waitLeft}s</span>}
            </div>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">{st.desc}</p>
            {bar && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] font-mono text-slate-400"><span>{bar.cur}/{bar.total}</span><span>{pct != null ? pct + '%' : ''}</span></div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                  {pct == null
                    ? <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500" />
                    : <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {st.fix && <Btn size="sm" variant="ghost" className="border border-slate-700" onClick={() => goto?.(st.fix.to)}>{st.fix.label} <IconChevronRight size={13} /></Btn>}
              {st.stop && <Btn size="sm" variant="danger" icon={IconPlayerStop} onClick={st.stop}>Dừng ngay</Btn>}
            </div>
          </div>
        </div>
      </Card>

      {/* Số liệu nhanh */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Đã đăng hôm nay" value={`${state.doneToday || 0}/${cfg.dailyCap || 0}`} icon={IconRobot} color={autoOn || jobOn ? 'green' : 'gray'} />
        <Stat label="Đang chờ trong hàng" value={(s.queue || []).length} icon={IconListNumbers} color="orange" />
        <Stat label="Nhóm mục tiêu" value={(cfg.groupIds || []).length} icon={IconTarget} color="indigo" />
        <Stat label="Tổng đã rải" value={stats.totalCommented || 0} icon={IconChecks} color="blue" />
      </div>

      {/* Chỉnh nhanh hạn mức đăng/ngày */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="text-sm font-bold text-slate-200">Hạn mức đăng / ngày (Daily Cap)</div>
        <input type="number" min={1} value={capVal}
          onChange={e => setCapVal(e.target.value === '' ? '' : +e.target.value)} onBlur={saveCap}
          onKeyDown={e => e.key === 'Enter' && saveCap()}
          className="w-24 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm font-bold text-slate-100 outline-none focus:border-indigo-500" />
        <span className="text-xs text-slate-400">bài/ngày</span>
        <Btn size="sm" variant="primary" onClick={saveCap}>Lưu</Btn>
        <span className="text-[11px] text-slate-500">Áp cho comment dạo / rải link. Giới hạn trên theo gói của bạn.</span>
      </Card>

      {/* Hoạt động gần đây */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-850 px-5 py-3.5 bg-slate-900/20">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-200"><IconActivity size={16} className="text-indigo-400" /> Hoạt động gần đây</h3>
          <span className="text-[11px] text-slate-500">Cập nhật tự động</span>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Chưa có hoạt động nào. Bấm "Bật Auto" hoặc "Tìm bài tiềm năng" để bắt đầu.</div>
        ) : (
          <div className="max-h-[26rem] divide-y divide-slate-900/60 overflow-y-auto">
            {logs.map((l, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-2.5 hover:bg-slate-900/20">
                {logIcon(l.level)}
                <div className="min-w-0 flex-1">
                  <span className={`text-xs leading-relaxed ${l.level === 'error' ? 'text-red-300' : l.level === 'success' ? 'text-slate-200' : 'text-slate-400'}`}><Msg text={l.msg} /></span>
                </div>
                <span className="shrink-0 text-[10px] font-mono text-slate-600">{l.t ? new Date(l.t).toLocaleTimeString('vi') : ''}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
