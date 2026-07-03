import { useState, useRef } from 'react'
import { IconSend, IconTrash, IconExternalLink, IconDeviceFloppy } from '@tabler/icons-react'
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
  const stopRef = useRef(false)
  const cfg = s?.cfg || {}

  const post = async (ids, afterEach) => {
    if (!ids.length) return notify('red', 'Chưa chọn bài nào')
    setPosting(true); stopRef.current = false; setPstat({ done: 0, total: ids.length, wait: 0 })
    let ok = 0, fail = 0
    for (let i = 0; i < ids.length; i++) {
      if (stopRef.current) break
      let r
      try { r = await ext({ type: 'POST_ITEM', postId: ids[i] }, 60000) } catch (e) { r = { ok: false, error: String(e?.message || e) } }
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
  return { posting, pstat, post, stop }
}
