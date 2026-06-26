import { IconTrash, IconExternalLink, IconChecks } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Card, Btn, Badge, Empty } from '../ui.jsx'

export default function Posted() {
  const { s, call } = useShope()
  const history = s?.commentHistory || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Đã đăng ({history.length})</h1>
        {history.length > 0 && (
          <Btn size="sm" icon={IconTrash} onClick={() => call({ type: 'CLEAR_POSTED' })}>Xoá lịch sử</Btn>
        )}
      </div>

      <Card>
        {history.length === 0 ? (
          <Empty icon={IconChecks}>Chưa đăng comment nào. Sau khi đăng, kết quả + link bài sẽ hiện ở đây để kiểm chứng.</Empty>
        ) : (
          <div className="divide-y divide-slate-800">
            {history.map((h, i) => (
              <div key={i} className="p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge color={h.mode === 'social' ? 'blue' : 'orange'}>{h.mode === 'social' ? 'Comment dạo' : 'Rải link'}</Badge>
                  {h.productName && <Badge color="indigo">{h.productName}</Badge>}
                  {h.score != null && <Badge color="yellow">điểm {h.score}</Badge>}
                  <span className="text-xs text-slate-500">{new Date(h.time).toLocaleString('vi')}</span>
                  {h.permalink && (
                    <a href={h.permalink} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline">
                      <IconExternalLink size={13} /> Xem bài đã comment
                    </a>
                  )}
                </div>
                <div className="rounded-lg bg-slate-800/50 p-2.5 text-sm text-slate-200">{h.comment}</div>
                <div className="mt-1 text-xs text-slate-500">Nhóm: {h.groupId}{h.link ? ` · link: ${h.link}` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
