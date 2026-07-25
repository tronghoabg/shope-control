import { useEffect, useState } from 'react'
import { IconTrash, IconExternalLink, IconChecks, IconCloud, IconSearch, IconMessageCircle, IconEyeOff, IconUserSearch, IconClockHour4 } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Empty, Input } from '../ui.jsx'

const TYPES = [{ k: 'all', l: 'Tất cả' }, { k: 'post', l: 'Đăng bài' }, { k: 'social', l: 'Comment dạo' }, { k: 'comment', l: 'Rải link' }]
const typeOf = (h) => h.mode === 'post' ? 'post' : h.mode === 'social' ? 'social' : 'comment'
// postId từ permalink (bài đăng lưu postId ở permalink .../permalink/<id>/ hoặc .../posts/<id>)
const postIdOf = (h) => String(h.postId || (String(h.permalink || '').match(/\/(?:permalink|posts)\/(\d{5,})/) || [])[1] || '')

// A + D: đọc comment trên bài mình đăng → tìm khách (lead) + ẩn comment spam/đối thủ.
function LeadsPanel({ postId }) {
  const { notify } = useShope()
  const [comments, setComments] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hidden, setHidden] = useState(() => new Set())

  const load = async () => {
    setLoading(true)
    const r = await ext({ type: 'LIST_POST_COMMENTS', postId }, 60000)
    setLoading(false)
    if (!r?.ok) return notify('red', r?.error || 'Đọc bình luận lỗi (mở sẵn 1 tab facebook.com đã đăng nhập rồi thử lại)')
    setComments(r.comments || [])
    notify(r.comments?.length ? 'green' : 'blue', `${r.comments?.length || 0} người bình luận`)
  }
  const hide = async (c) => {
    const r = await ext({ type: 'HIDE_COMMENT', commentId: c.commentId }, 30000)
    if (r?.ok) { setHidden(prev => new Set(prev).add(c.commentId)); notify('green', 'Đã ẩn bình luận') }
    else notify('red', r?.error || 'Ẩn bình luận lỗi')
  }

  if (comments === null) {
    return <Btn size="sm" variant="ghost" icon={IconUserSearch} loading={loading} onClick={load} className="border border-slate-800">Xem người bình luận (tìm khách)</Btn>
  }
  if (!comments.length) return <div className="text-xs text-slate-500 flex items-center gap-1.5"><IconMessageCircle size={13} /> Chưa có bình luận nào trên bài này.</div>
  return (
    <div className="mt-1 space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
      <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><IconMessageCircle size={13} className="text-indigo-400" /> {comments.length} người bình luận — khách tiềm năng</div>
      {comments.map(c => (
        <div key={c.commentId} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-900/40 ${hidden.has(c.commentId) ? 'opacity-40 line-through' : ''}`}>
          <div className="min-w-0 flex-1">
            <a href={c.authorUrl || '#'} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-300 hover:underline">{c.authorName || 'Ẩn danh'}</a>
            <span className="text-xs text-slate-400"> — {c.text}</span>
          </div>
          {!hidden.has(c.commentId) && (
            <button onClick={() => hide(c)} title="Ẩn bình luận này" className="shrink-0 text-slate-500 hover:text-red-400 p-0.5"><IconEyeOff size={14} /></button>
          )}
        </div>
      ))}
    </div>
  )
}

const PEND = { pending: { color: 'yellow', l: '⏳ Chờ duyệt' }, approved: { color: 'green', l: '✓ Đã lên' }, rejected: { color: 'red', l: '✗ Chưa lên' } }

function Item({ h, pendStatus }) {
  const text = h.content || h.comment || ''
  const time = h.createdAt || h.time
  const isPost = h.mode === 'post'
  const postId = postIdOf(h)
  return (
    <div className="p-5 hover:bg-slate-900/10 transition-colors">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge color={isPost ? 'green' : h.mode === 'social' ? 'blue' : 'orange'}>{isPost ? 'Đăng bài' : h.mode === 'social' ? 'Comment dạo' : 'Comment / Rải link'}</Badge>
        {h.productName && <Badge color="indigo" className="text-[10px] px-1.5">{h.productName}</Badge>}
        {h.score != null && <Badge color="yellow" className="text-[10px] px-1.5">Điểm tiềm năng {h.score}</Badge>}
        {isPost && pendStatus && PEND[pendStatus] && <Badge color={PEND[pendStatus].color} className="text-[10px] px-1.5">{PEND[pendStatus].l}</Badge>}
        <span className="text-[11px] text-slate-500 font-mono font-semibold">{time ? new Date(time).toLocaleString('vi') : ''}</span>
        {h.permalink && (
          <a href={h.permalink} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:underline">
            <span>Xem bài gốc</span>
            <IconExternalLink size={13} />
          </a>
        )}
      </div>
      
      <div className="whitespace-pre-wrap rounded-xl bg-slate-950/40 border border-slate-900 px-4 py-3 text-xs text-slate-300 leading-relaxed font-mono">{text}</div>
      
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div>Nhóm đăng: <span className="font-semibold text-slate-350">{h.groupName || h.groupId || '—'}</span></div>
        {h.link && (
          <div className="truncate max-w-xs">
            Link sản phẩm: <a href={h.link} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">{h.link}</a>
          </div>
        )}
      </div>

      {/* A + D: chỉ bài ĐĂNG của mình mới đọc được người bình luận (tìm khách) */}
      {isPost && postId && <div className="mt-3"><LeadsPanel postId={postId} /></div>}
    </div>
  )
}

export default function Posted() {
  const { s, call, account, confirm, notify, refresh } = useShope()
  const local = s?.commentHistory || []
  const [db, setDb] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // B) Bài chờ duyệt: map postId → trạng thái
  const pending = s?.pendingPosts || []
  const pendMap = Object.fromEntries(pending.map(p => [p.postId, p.status]))
  const nPending = pending.filter(p => p.status === 'pending').length
  const verify = async () => {
    setVerifying(true)
    const r = await ext({ type: 'VERIFY_PENDING', max: 15 }, 150000)
    setVerifying(false); await refresh()
    if (r?.ok) notify(r.live ? 'green' : 'blue', `Đã kiểm ${r.checked} bài: ${r.live} đã lên · ${r.pending} còn chờ · ${r.rejected} chưa lên`)
    else notify('red', r?.error || 'Kiểm tra lỗi (mở sẵn 1 tab facebook.com)')
  }

  useEffect(() => {
    if (!account?.loggedIn) { setDb(null); return }
    setLoading(true)
    fetch('/api/posted', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setDb(d.items || []))
      .catch(() => setDb(null))
      .finally(() => setLoading(false))
  }, [account?.loggedIn])

  const fromDb = account?.loggedIn && Array.isArray(db)
  const history = fromDb ? db : local
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')

  const qq = q.trim().toLowerCase()
  const shown = history
    .filter(h => type === 'all' || typeOf(h) === type)
    .filter(h => !qq || (h.content || h.comment || '').toLowerCase().includes(qq) || (h.groupName || '').toLowerCase().includes(qq) || (h.productName || '').toLowerCase().includes(qq))

  const clear = async () => {
    if (!(await confirm('Xoá TOÀN BỘ lịch sử rải tin? Không thể hoàn tác.', { danger: true, confirmText: 'Xoá tất cả' }))) return
    if (fromDb) { await fetch('/api/posted', { method: 'DELETE', credentials: 'include' }).catch(() => {}); setDb([]) }
    call({ type: 'CLEAR_POSTED' })
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Lịch sử đăng & rải link</h1>
          {fromDb
            ? <Badge color="green"><IconCloud size={13} className="inline mr-1" /> Đồng bộ server</Badge>
            : <Badge color="gray">Lưu cục bộ</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {nPending > 0 && <Btn size="sm" icon={IconClockHour4} loading={verifying} onClick={verify}>Kiểm tra bài chờ duyệt ({nPending})</Btn>}
          {history.length > 0 && <Btn size="sm" icon={IconTrash} className="text-red-400 hover:bg-red-500/5 border hover:border-red-500/10" onClick={clear}>Xoá lịch sử rải</Btn>}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-850 px-5 py-3.5 bg-slate-900/20 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-200 text-sm">Đã rải thành công ({shown.length}{(qq || type !== 'all') && `/${history.length}`})</h3>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex rounded-xl bg-slate-900/80 p-0.5 border border-slate-800">
              {TYPES.map(t => (
                <button key={t.k} onClick={() => setType(t.k)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${type === t.k ? 'bg-indigo-650 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>{t.l}</button>
              ))}
            </div>
            <div className="relative">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input className="w-52 h-8.5 pl-8 text-xs rounded-lg" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm nội dung / nhóm…" />
            </div>
          </div>
        </div>

        {loading ? (
          <p className="p-8 text-center text-xs text-slate-500 font-semibold animate-pulse">Đang tải lịch sử từ máy chủ…</p>
        ) : history.length === 0 ? (
          <Empty icon={IconChecks}>Lịch sử rải tin trống. Mọi bình luận hoặc bài viết đăng thành công qua extension sẽ được ghi nhận tại đây.</Empty>
        ) : shown.length === 0 ? (
          <Empty icon={IconSearch}>Không có mục nào khớp bộ lọc.</Empty>
        ) : (
          <div className="divide-y divide-slate-850 bg-slate-950/10">
            {shown.map((h, i) => <Item key={h.id || i} h={h} pendStatus={pendMap[postIdOf(h)]} />)}
          </div>
        )}
      </Card>
    </div>
  )
}
