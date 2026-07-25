import { useState, useRef, useEffect } from 'react'
import { IconSend, IconTrash, IconExternalLink, IconDeviceFloppy, IconCheck, IconX, IconRefresh, IconListNumbers } from '@tabler/icons-react'
import { Card, Btn, Badge, Textarea } from './ui.jsx'
import { useShope } from './ShopeContext.jsx'
import { ext } from './ext.js'

export const MIN_DELAY = 90   // an toàn checkpoint: không cho nhanh hơn 90s
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// 1 bài trong hàng chờ — sửa nội dung, đăng, bỏ.
export function QueueItem({ it, onAct, selected, onSel }) {
  const [comment, setComment] = useState(it.comment || '')
  const dirty = comment !== it.comment
  return (
    <Card className={`p-4 ${selected ? 'border-indigo-500/60 bg-indigo-500/[0.06]' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={selected} onChange={() => onSel(it.postId)} className="h-4 w-4 accent-indigo-500" />
        {it.isPage ? <Badge color="blue">Page{it.pageName ? `: ${it.pageName}` : ''}</Badge> : <Badge color="yellow">điểm {it.score}</Badge>}
        {it.groupName && <Badge color="gray" className="max-w-[150px] truncate" title={it.groupName}>{it.groupName}</Badge>}
        {it.productName && <Badge color="blue">{it.productName}</Badge>}
        {it.link && <Badge color="indigo">có link</Badge>}
        {it.permalink && <a href={it.permalink} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline"><IconExternalLink size={13} /> xem bài</a>}
      </div>
      <p className="mb-2 line-clamp-2 text-xs text-slate-500">📄 {it.text || '(không có nội dung)'}</p>
      <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nội dung comment…" />
      <div className="mt-2 flex flex-wrap gap-2">
        {dirty && <Btn size="sm" icon={IconDeviceFloppy} onClick={() => onAct('EDIT_ITEM', it.postId, { comment })}>Lưu sửa</Btn>}
        <Btn size="sm" variant="primary" icon={IconSend} onClick={() => onAct('POST_ITEM', it.postId, null, 60000)}>Đăng bài này</Btn>
        <Btn size="sm" variant="ghost" icon={IconTrash} className="text-red-400" onClick={() => onAct('REJECT_ITEM', it.postId)}>Bỏ</Btn>
      </div>
    </Card>
  )
}

// Hook đăng hàng loạt — điều khiển chiến dịch CHẠY NỀN trong service worker (sống khi tab ẩn/đóng).
// UI chỉ khởi chạy + hiển thị tiến trình đọc từ state.job.
export function usePoster() {
  const { s, notify, refresh } = useShope()
  const job = (s?.job && s.job.kind === 'comment') ? s.job : null
  const [nowTs, setNowTs] = useState(Date.now())
  useEffect(() => {
    if (!job?.running || job?.paused) return
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [job?.running, job?.paused])

  const posting = !!job?.running
  const paused = !!job?.paused
  const results = job?.results || []
  const waitLeft = job?.nextAt ? Math.max(0, Math.ceil((job.nextAt - nowTs) / 1000)) : 0
  const pstat = { done: job?.idx || 0, total: job?.total || 0, wait: posting && !paused ? waitLeft : 0 }

  const post = async (ids) => {
    if (!ids?.length) return notify('red', 'Chưa chọn bài nào')
    const r = await ext({ type: 'START_JOB', kind: 'comment', items: ids })
    if (!r?.ok) notify('red', r?.error || 'Không khởi chạy được chiến dịch')
    else { notify('green', `Đã bắt đầu rải ${ids.length} bài — chạy nền, có thể đóng tab.`); refresh() }
  }
  const stop = () => { ext({ type: 'JOB_STOP' }).then(refresh); notify('blue', 'Đang dừng…') }
  const pause = () => ext({ type: 'JOB_PAUSE' }).then(refresh)
  const resume = () => ext({ type: 'JOB_RESUME' }).then(refresh)
  const skipWait = () => ext({ type: 'JOB_SKIP_WAIT' }).then(refresh)
  return { posting, paused, pstat, results, post, stop, skipWait, pause, resume }
}

export function ProgressPanel({ results, posting, pstat, children, onSkipWait, paused, onPause, onResume }) {
  const pct = pstat.total ? Math.round((pstat.done / pstat.total) * 100) : 0
  
  // Auto-scroll to bottom of progress list when new items arrive
  const listRef = useRef(null)
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [results])

  return (
    <Card className="p-0 flex flex-col xl:h-[calc(100vh-8rem)] border-slate-800 bg-slate-950/40">
      <div className="flex items-center gap-2 border-b border-slate-850 px-4 py-3 text-sm font-semibold text-slate-200 shrink-0">
        <IconListNumbers size={16} className="text-indigo-400" />
        <span>Tiến trình & Nhật ký</span>
      </div>
      
      <div className="flex-1 min-h-0 flex flex-col p-4 gap-4 overflow-hidden">
        {/* Bulk Post Progress (Only shows when results exist) */}
        {results.length > 0 && (
          <div className="space-y-4 animate-fadeIn flex flex-col min-h-0 flex-1">
            <div className="flex flex-wrap items-center justify-between text-sm gap-2 shrink-0">
              <span className="font-bold text-slate-200">Đăng hàng loạt ({pstat.done} / {results.length})</span>
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-405 font-mono">
                {posting ? (paused ? 'Đã tạm dừng' : pstat.wait ? `Nghỉ trễ ${pstat.wait}s…` : 'Đang đăng…') : 'Hoàn thành'}
                {posting && pstat.wait > 0 && !paused && onSkipWait && (
                  <button onClick={onSkipWait} className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300 hover:bg-indigo-500/20 transition-colors">Bỏ chờ</button>
                )}
                {posting && (paused ? onResume : onPause) && (
                  <button onClick={paused ? onResume : onPause}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold transition-colors ${paused ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'}`}>
                    {paused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
                  </button>
                )}
              </span>
            </div>
            <div className="h-2 w-full shrink-0 overflow-hidden rounded-full bg-slate-900 border border-slate-850">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 animate-pulse" style={{ width: `${pct}%` }} />
            </div>
            
            <div ref={listRef} className="flex-1 min-h-[150px] overflow-y-auto custom-scrollbar divide-y divide-slate-850/60 rounded-xl border border-slate-850/60 bg-slate-950/20">
              {results.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold transition-colors hover:bg-slate-900/40">
                  {r.status === 'success' ? <IconCheck size={14} className="shrink-0 text-emerald-400 bg-emerald-500/10 p-0.5 rounded-full" />
                    : r.status === 'error' ? <IconX size={14} className="shrink-0 text-red-400 bg-red-500/10 p-0.5 rounded-full" />
                    : r.status === 'posting' ? <IconRefresh size={14} className="shrink-0 animate-spin text-indigo-400" />
                    : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-700/50" />}
                  <div className="min-w-0 flex-1 flex flex-col">
                    <span className="truncate text-slate-300" title={r.name}>{r.name}</span>
                    <span className="truncate text-[10px] text-slate-500 font-normal mt-0.5" title={r.comment}>{r.comment}</span>
                  </div>
                  {r.status === 'success' && r.url && <a href={r.url} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] font-bold text-indigo-400 hover:underline inline-flex items-center gap-1">Link <IconExternalLink size={10} /></a>}
                  {r.status === 'error' && <span className="shrink-0 max-w-[30%] truncate font-mono text-[10px] text-red-400/80" title={r.error}>{r.error}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Realtime logs */}
        <div className={`flex flex-col flex-1 min-h-0 ${results.length > 0 ? 'border-t border-slate-800 pt-4' : ''}`}>
          <div className="mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">Log Hệ Thống (Auto)</div>
          <div className="flex-1 min-h-[150px] bg-slate-900/30 rounded-lg border border-slate-800/60 overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </div>
      </div>
    </Card>
  )
}
