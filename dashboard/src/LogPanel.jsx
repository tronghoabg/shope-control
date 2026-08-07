import { useEffect, useRef } from 'react'
import { IconHistory, IconTrash, IconX, IconUsersGroup, IconCircleCheck, IconExternalLink } from '@tabler/icons-react'
import { useShope } from './ShopeContext.jsx'
import { openFb } from './ext.js'

const TAG_STYLE = (tag = '') =>
  tag === 'Đăng bài' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  : tag.includes('Page') ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
  : tag === 'Comment dạo' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
  : 'bg-orange-500/15 text-orange-300 border-orange-500/30'   // Rải link

// Dòng log dạng THẺ (khi có dữ liệu cấu trúc): chip nhóm + nhãn loại + trích nội dung + nút xem bài.
function RichLog({ log }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <IconCircleCheck size={14} className="shrink-0 text-emerald-400" />
        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${TAG_STYLE(log.tag)}`}>{log.tag}</span>
        {log.groupName && <span className="max-w-[55%] truncate rounded-md border border-indigo-500/25 bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-200" title={log.groupName}>{log.groupName}</span>}
        <span className="ml-auto font-mono text-[10px] text-slate-600">{t(log.t)}</span>
        {log.link && <a href={log.link} onClick={(e) => openFb(log.link, e)} className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"><IconExternalLink size={11} /> Xem bài</a>}
      </div>
      {log.content && <div className="mt-1.5 border-l-2 border-slate-700 bg-slate-950/40 px-2 py-1 text-[11px] italic leading-relaxed text-slate-300">“{log.content}”</div>}
    </div>
  )
}

const DOT = { success: 'bg-emerald-400', error: 'bg-red-400', info: 'bg-sky-400' }
const TXT = { success: 'text-emerald-300', error: 'text-red-300', info: 'text-slate-300' }
const t = (ms) => new Date(ms).toLocaleTimeString('vi')
const LogLink = ({ log }) => log?.link ? (
  <a href={log.link} onClick={(e) => openFb(log.link, e)} className="ml-1 inline-flex items-center gap-0.5 font-bold text-indigo-400 hover:underline">
    <IconExternalLink size={10} /> xem bài
  </a>
) : null

// Biến URL trong log thành link bấm được (FB → mở tab FB đang có; Shopee → tab mới).
export function Msg({ text }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g)
  return <>{parts.map((p, i) => /^https?:\/\//.test(p)
    ? (/facebook\.com/i.test(p)
        ? <a key={i} href={p} onClick={(e) => openFb(p, e)} className="mx-0.5 font-bold text-indigo-400 hover:underline cursor-pointer">↗ xem</a>
        : <a key={i} href={p} target="_blank" rel="noreferrer" className="mx-0.5 font-bold text-indigo-400 hover:underline">↗ link</a>)
    : <span key={i}>{p}</span>)}</>
}

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

// Danh sách log dùng lại được (nhúng trong trang hoặc trong panel).
export function LogFeed({ max = 150, className = '' }) {
  const { s } = useShope()
  const logs = (s?.logs || []).slice(-max)
  const blocks = toBlocks(logs)
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [logs.length])

  return (
    <div className={`space-y-1.5 overflow-y-auto ${className}`}>
      {blocks.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-600">Chưa có hoạt động.<br />Bấm <b>Bắt đầu</b> để xem log chạy.</div>
      ) : blocks.map((b, i) => b.type === 'group' ? (
        <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/30">
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <IconUsersGroup size={14} className="shrink-0 text-indigo-400" />
            <span className="flex-1 truncate text-xs font-semibold text-slate-100">{b.header.msg}</span>
            <span className="font-mono text-[10px] text-slate-600">{t(b.header.t)}</span>
          </div>
          {b.posts.length > 0 && (
            <div className="ml-3 border-l border-slate-700 pl-2 pb-1.5">
              {b.posts.map((p, j) => p.tag
                ? <div key={j} className="py-1"><RichLog log={p} /></div>
                : <div key={j} className={`py-0.5 text-[11px] leading-snug ${TXT[p.level] || TXT.info}`}><Msg text={p.msg} /><LogLink log={p} /></div>
              )}
            </div>
          )}
        </div>
      ) : b.log.tag ? (
        <RichLog key={i} log={b.log} />
      ) : (
        <div key={i} className="px-1">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[b.log.level] || DOT.info}`} />
            <span className="font-mono text-[10px] text-slate-500">{t(b.log.t)}</span>
          </div>
          <div className={`mt-0.5 break-words text-xs leading-snug ${TXT[b.log.level] || TXT.info}`}><Msg text={b.log.msg} /><LogLink log={b.log} /></div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}

export default function LogPanel({ onClose }) {
  const { call } = useShope()
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
      <LogFeed className="flex-1 p-2" />
    </aside>
  )
}
