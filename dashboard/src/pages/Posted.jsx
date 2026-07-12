import { useEffect, useState } from 'react'
import { IconTrash, IconExternalLink, IconChecks, IconCloud, IconSearch } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Card, Btn, Badge, Empty, Input } from '../ui.jsx'

const TYPES = [{ k: 'all', l: 'Tất cả' }, { k: 'post', l: 'Đăng bài' }, { k: 'social', l: 'Comment dạo' }, { k: 'comment', l: 'Rải link' }]
const typeOf = (h) => h.mode === 'post' ? 'post' : h.mode === 'social' ? 'social' : 'comment'

function Item({ h }) {
  const text = h.content || h.comment || ''
  const time = h.createdAt || h.time
  const isPost = h.mode === 'post'
  return (
    <div className="p-5 hover:bg-slate-900/10 transition-colors">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge color={isPost ? 'green' : h.mode === 'social' ? 'blue' : 'orange'}>{isPost ? 'Đăng bài' : h.mode === 'social' ? 'Comment dạo' : 'Comment / Rải link'}</Badge>
        {h.productName && <Badge color="indigo" className="text-[10px] px-1.5">{h.productName}</Badge>}
        {h.score != null && <Badge color="yellow" className="text-[10px] px-1.5">Điểm tiềm năng {h.score}</Badge>}
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
    </div>
  )
}

export default function Posted() {
  const { s, call, account, confirm } = useShope()
  const local = s?.commentHistory || []
  const [db, setDb] = useState(null)
  const [loading, setLoading] = useState(false)

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
        {history.length > 0 && <Btn size="sm" icon={IconTrash} className="text-red-400 hover:bg-red-500/5 border hover:border-red-500/10" onClick={clear}>Xoá lịch sử rải</Btn>}
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
            {shown.map((h, i) => <Item key={h.id || i} h={h} />)}
          </div>
        )}
      </Card>
    </div>
  )
}
