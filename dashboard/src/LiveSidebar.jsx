import { useShope } from './ShopeContext.jsx'
import { ext, openFb } from './ext.js'
import { LogFeed } from './LogPanel.jsx'
import {
  IconX, IconExternalLink, IconCheck, IconAlertTriangle, IconRefresh, IconPlayerPause,
  IconPlayerPlay, IconPlayerStop, IconActivity, IconChevronsRight, IconRobot
} from '@tabler/icons-react'

const KIND = { comment: 'Rải comment', postgroup: 'Đăng bài', join: 'Tham gia nhóm' }

function statusIcon(st) {
  if (st === 'success') return <IconCheck size={14} className="shrink-0 text-emerald-400" />
  if (st === 'error') return <IconAlertTriangle size={14} className="shrink-0 text-red-400" />
  if (st === 'skipped') return <IconChevronsRight size={14} className="shrink-0 text-amber-400" />
  if (st === 'posting') return <IconRefresh size={14} className="shrink-0 animate-spin text-indigo-400" />
  return <span className="h-2 w-2 shrink-0 rounded-full border border-slate-600" />
}

export default function LiveSidebar({ open, onClose }) {
  const { s } = useShope()
  if (!open) return null
  const job = s?.job
  const cfg = s?.cfg || {}, state = s?.state || {}, stats = s?.stats || {}
  const autoOn = cfg.autoEnabled && !cfg.killSwitch
  const running = !!job?.running
  const pct = job && job.total > 0 ? Math.min(100, Math.round((job.idx / job.total) * 100)) : 0
  const done = (job?.results || []).filter(r => r.status === 'success').length
  const skipped = (job?.results || []).filter(r => r.status === 'skipped').length
  const failed = (job?.results || []).filter(r => r.status === 'error').length

  const jobStatus = !job ? '' : running ? (job.paused ? 'Tạm dừng' : 'Đang chạy') : (job.stoppedMsg ? 'Đã dừng' : 'Đã xong')
  const AUTO_NOTE = { approve: 'Đang chờ bạn duyệt comment', nopost: 'Đang tìm bài phù hợp…', cap: 'Đã đủ số bài hôm nay', err: 'Auto gặp lỗi', active: 'Đang quét & đăng' }

  return (
    <aside className="flex w-[380px] min-h-0 shrink-0 flex-col border-l border-slate-800 bg-slate-950/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-850 px-4 py-3.5">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-100"><IconActivity size={17} className="text-indigo-400" /> Tiến trình</span>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"><IconX size={17} /></button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {/* Chiến dịch nền */}
          {job ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-slate-100">{KIND[job.kind] || 'Chiến dịch'} <span className="text-slate-500 font-semibold">· chạy nền</span></span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${running ? (job.paused ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300') : 'bg-slate-700/40 text-slate-300'}`}>{jobStatus}</span>
              </div>
              <div className="mt-2.5 flex justify-between text-[11px] font-mono text-slate-400"><span>{job.idx}/{job.total}</span><span>✓{done} · ⏭{skipped} · ✕{failed}</span></div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              {job.stoppedMsg && <div className="mt-2 text-[11px] text-amber-400 leading-relaxed">{job.stoppedMsg}</div>}
              {running && (
                <div className="mt-3 flex gap-2">
                  {job.paused
                    ? <button onClick={() => ext({ type: 'JOB_RESUME' })} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"><IconPlayerPlay size={13} /> Tiếp tục</button>
                    : <button onClick={() => ext({ type: 'JOB_PAUSE' })} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20"><IconPlayerPause size={13} /> Tạm dừng</button>}
                  <button onClick={() => ext({ type: 'JOB_STOP' })} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500/20"><IconPlayerStop size={13} /> Dừng</button>
                </div>
              )}

              {/* Danh sách kết quả + link */}
              <div className="mt-3 max-h-[16rem] space-y-1 overflow-y-auto rounded-xl border border-slate-850 bg-slate-950/40 p-2">
                {(job.results || []).map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${r.status === 'posting' ? 'bg-indigo-500/[0.06]' : ''}`}>
                    {statusIcon(r.status)}
                    <span className="min-w-0 flex-1 truncate text-slate-300" title={r.name}>{r.name}</span>
                    {r.status === 'error' && r.error && <span className="max-w-[38%] truncate text-red-400/80" title={r.error}>{r.error}</span>}
                    {r.url && (r.status === 'success' || r.status === 'skipped') && (
                      <a href={r.url} onClick={(e) => openFb(r.url, e)} className="shrink-0 text-indigo-400 hover:text-indigo-300 cursor-pointer" title={job.kind === 'join' ? 'Xem nhóm' : 'Xem bài'}><IconExternalLink size={13} /></a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : autoOn ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-300"><IconRobot size={17} /> Auto đang chạy</div>
              <div className="mt-1.5 text-xs text-slate-300">{AUTO_NOTE[stats.autoNote] || 'Đang quét nhóm & đăng comment tự động.'}</div>
              <div className="mt-2 text-[11px] font-mono text-slate-400">Đã đăng {state.doneToday || 0}/{cfg.dailyCap || 0} hôm nay</div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 text-center text-xs text-slate-500">
              Không có tiến trình nào đang chạy.<br />Bật Auto hoặc chạy đăng/tham gia hàng loạt để xem tiến trình ở đây.
            </div>
          )}

          {/* Nhật ký gần đây */}
          <div className="flex min-h-[10rem] flex-1 flex-col">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Nhật ký gần đây</div>
            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-850 bg-slate-900/30">
              <LogFeed className="p-2.5 font-mono text-[11px] leading-relaxed" />
            </div>
          </div>
        </div>
    </aside>
  )
}
