import { useEffect, useState } from 'react'
import { IconTrash, IconExternalLink, IconChecks, IconCloud } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Card, Btn, Badge, Empty } from '../ui.jsx'

function Item({ h }) {
  const text = h.content || h.comment || ''
  const time = h.createdAt || h.time
  const isPost = h.mode === 'post'
  return (
    <div className="p-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Badge color={isPost ? 'green' : h.mode === 'social' ? 'blue' : 'orange'}>{isPost ? 'Đăng bài' : h.mode === 'social' ? 'Comment dạo' : 'Comment / Rải link'}</Badge>
        {h.productName && <Badge color="indigo">{h.productName}</Badge>}
        {h.score != null && <Badge color="yellow">điểm {h.score}</Badge>}
        <span className="text-xs text-slate-500">{time ? new Date(time).toLocaleString('vi') : ''}</span>
        {h.permalink && (
          <a href={h.permalink} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline">
            <IconExternalLink size={13} /> Xem bài
          </a>
        )}
      </div>
      <div className="whitespace-pre-wrap rounded-lg bg-slate-800/50 p-2.5 text-sm text-slate-200">{text}</div>
      <div className="mt-1 truncate text-xs text-slate-500">Nhóm: {h.groupName || h.groupId || '—'}{h.link ? ` · link: ${h.link}` : ''}</div>
    </div>
  )
}

export default function Posted() {
  const { s, call, account } = useShope()
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

  const clear = async () => {
    if (fromDb) { await fetch('/api/posted', { method: 'DELETE', credentials: 'include' }).catch(() => {}); setDb([]) }
    call({ type: 'CLEAR_POSTED' })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-100">Đã đăng ({history.length})</h1>
          {fromDb
            ? <Badge color="green"><IconCloud size={12} /> lưu máy chủ</Badge>
            : <Badge color="gray">lưu cục bộ</Badge>}
        </div>
        {history.length > 0 && <Btn size="sm" icon={IconTrash} onClick={clear}>Xoá lịch sử</Btn>}
      </div>

      <Card>
        {loading
          ? <p className="p-6 text-center text-sm text-slate-500">Đang tải…</p>
          : history.length === 0
            ? <Empty icon={IconChecks}>Chưa đăng gì. Sau khi đăng, kết quả + link bài sẽ hiện ở đây để kiểm chứng{fromDb ? ' (lưu bền trên máy chủ)' : ''}.</Empty>
            : <div className="divide-y divide-slate-800">{history.map((h, i) => <Item key={h.id || i} h={h} />)}</div>}
      </Card>
    </div>
  )
}
