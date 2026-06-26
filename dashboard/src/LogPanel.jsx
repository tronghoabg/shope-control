import { useEffect, useRef } from 'react'
import { IconHistory, IconTrash, IconX, IconUsersGroup } from '@tabler/icons-react'
import { useShope } from './ShopeContext.jsx'

const DOT = { success: 'bg-emerald-400', error: 'bg-red-400', info: 'bg-sky-400' }
const TXT = { success: 'text-emerald-300', error: 'text-red-300', info: 'text-slate-300' }
const t = (ms) => new Date(ms).toLocaleTimeString('vi')

// Gom log thành block: kind 'group' mở 1 block, các 'post' kế tiếp thuộc block đó; còn lại là plain.
function toBlocks(logs) {
  const blocks = []
  for (const l of logs) {
    if (l.kind === 'group') blocks.push({ type: 'group', header: l, posts: [] })
    else if (l.kind === 'post' && blocks.length && blocks[blocks.length - 1].type === 'group') blocks[blocks.length - 1].posts.push(l)
    else blocks.push({ type: 'plain', log: l })
  }
  return blocks
}

export default function LogPanel({ onClose }) {
  const { s, call } = useShope()
  const logs = (s?.logs || []).slice(-150)        // chronological
  const blocks = toBlocks(logs)
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [logs.length])

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <IconHistory size={16} /> Nhật ký trực tiếp
        </div>
        <div className="flex items-center gap-1">
          <button title="Xoá log" onClick={() => call({ type: 'CLEAR_LOGS' })} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"><IconTrash size={15} /></button>
          <button title="Ẩn panel" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"><IconX size={15} /></button>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {blocks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-600">Chưa có hoạt động.<br />Quét/Tìm nhóm để xem log chạy.</div>
        ) : blocks.map((b, i) => b.type === 'group' ? (
          <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/30">
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <IconUsersGroup size={14} className="shrink-0 text-indigo-400" />
              <span className="flex-1 truncate text-xs font-semibold text-slate-100">{b.header.msg}</span>
              <span className="font-mono text-[10px] text-slate-600">{t(b.header.t)}</span>
            </div>
            {b.posts.length > 0 && (
              <div className="ml-3 border-l border-slate-700 pl-2 pb-1.5">
                {b.posts.map((p, j) => (
                  <div key={j} className={`py-0.5 text-[11px] leading-snug ${TXT[p.level] || TXT.info}`}>{p.msg}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div key={i} className="px-1">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[b.log.level] || DOT.info}`} />
              <span className="font-mono text-[10px] text-slate-500">{t(b.log.t)}</span>
            </div>
            <div className={`mt-0.5 break-words text-xs leading-snug ${TXT[b.log.level] || TXT.info}`}>{b.log.msg}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </aside>
  )
}
