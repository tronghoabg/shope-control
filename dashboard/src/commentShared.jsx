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

// Hook đăng hàng loạt (giãn cách ≥90s, có nút dừng). Dùng chung cho 2 trang comment.
export function usePoster() {
  const { s, notify, refresh } = useShope()
  const [posting, setPosting] = useState(false)
  const [pstat, setPstat] = useState({ done: 0, total: 0, wait: 0 })
  const [results, setResults] = useState([])
  const stopRef = useRef(false)
  const cfg = s?.cfg || {}

  const post = async (ids, afterEach) => {
    if (!ids.length) return notify('red', 'Chưa chọn bài nào')
    
    // Initialize results from queue
    const initialResults = ids.map(id => {
      const q = s.queue?.find(x => x.postId === id) || {}
      return { id, name: q.groupName || q.pageName || q.groupId || id, comment: q.comment, status: 'pending', url: q.permalink || q.link || q.url }
    })
    setResults(initialResults)
    
    setPosting(true); stopRef.current = false; setPstat({ done: 0, total: ids.length, wait: 0 })
    let ok = 0, fail = 0
    for (let i = 0; i < ids.length; i++) {
      if (stopRef.current) break
      
      setResults(prev => prev.map(r => r.id === ids[i] ? { ...r, status: 'posting' } : r))
      
      let r
      try { r = await ext({ type: 'POST_ITEM', postId: ids[i] }, 60000) } catch (e) { r = { ok: false, error: String(e?.message || e) } }
      
      setResults(prev => prev.map(res => res.id === ids[i] ? { ...res, status: r?.ok ? 'success' : 'error', error: r?.error, url: r?.result?.permalink || res.url } : res))
      
      if (r?.quotaBlocked) { notify('red', r.error || 'Hết hạn mức hôm nay'); break }
      if (r?.ok) ok++; else fail++
      afterEach?.(ids[i])
      setPstat(p => ({ ...p, done: i + 1 })); refresh()
      if (i < ids.length - 1 && !stopRef.current) {
        const lo = Math.max(MIN_DELAY, Math.min(cfg.minDelaySec, cfg.maxDelaySec)), hi = Math.max(lo, Math.max(cfg.minDelaySec, cfg.maxDelaySec))
        let secs = lo + Math.floor(Math.random() * (hi - lo + 1))
        for (; secs > 0 && !stopRef.current; secs--) { setPstat(p => ({ ...p, wait: secs })); await sleep(1000) }
      }
    }
    setPosting(false); setPstat({ done: 0, total: 0, wait: 0 })
    notify(fail ? 'blue' : 'green', `Đã đăng ${ok}/${ids.length} bài`)
  }
  const stop = () => { stopRef.current = true; notify('blue', 'Đang dừng…') }
  return { posting, pstat, results, post, stop }
}

export function ProgressPanel({ results, posting, pstat, children }) {
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
              <span className="text-xs font-semibold text-slate-405 font-mono">
                {posting ? (pstat.wait ? `Nghỉ trễ ${pstat.wait}s…` : 'Đang đăng…') : 'Hoàn thành'}
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
