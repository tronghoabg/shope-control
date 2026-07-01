import { useState, useMemo } from 'react'
import {
  IconBuildingStore, IconDownload, IconPlayerStop, IconSend, IconTarget, IconExternalLink,
  IconHistory, IconBookmark, IconListCheck,
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Textarea, Empty, Hint, Input, Field } from '../ui.jsx'
import { QueueItem, usePoster } from '../commentShared.jsx'
import { LogFeed } from '../LogPanel.jsx'

export default function CommentPages({ goto }) {
  const { s, call, notify } = useShope()
  const { posting, pstat, post, stop } = usePoster()
  const [pagePosts, setPagePosts] = useState([])
  const [selPP, setSelPP] = useState(() => new Set())
  const [pageContent, setPageContent] = useState('')
  const [loadingPP, setLoadingPP] = useState(false)
  const [sel, setSel] = useState(() => new Set())
  const [listName, setListName] = useState('')

  // Pool page chọn được: kết quả tìm + page mục tiêu + page trong các danh sách đã lưu
  const pool = useMemo(() => {
    const m = new Map()
    const add = (p) => { if (p?.pageId && !m.has(String(p.pageId))) m.set(String(p.pageId), { pageId: String(p.pageId), name: p.name || '', url: p.url || '', icon: p.icon || '' }) }
    for (const p of (s?.pageSearchResults || [])) add(p)
    for (const p of (s?.targetPages || [])) add(p)
    for (const l of (s?.savedPageLists || [])) for (const p of (l.pages || [])) add(p)
    return [...m.values()]
  }, [s?.pageSearchResults, s?.targetPages, s?.savedPageLists])

  if (!s) return <p className="text-slate-500">Đang tải…</p>

  const cfg = s.cfg || {}
  const queue = (s.queue || []).filter(q => q.isPage)
  const targetPages = s.targetPages || []
  const targetIds = new Set(targetPages.map(p => p.pageId))
  const nPages = targetPages.length
  const savedPageLists = s.savedPageLists || []
  const act = (type, postId, extra, timeout) => call({ type, postId, ...(extra || {}) }, { timeout })

  const setTargets = (pages) => call({ type: 'SET_TARGET_PAGES', pages })
  const toggleTarget = (p) => setTargets(targetIds.has(p.pageId) ? targetPages.filter(x => x.pageId !== p.pageId) : [...targetPages, p])
  const allSel = pool.length > 0 && pool.every(p => targetIds.has(p.pageId))
  const toggleAllPool = () => setTargets(allSel ? [] : pool)
  const applyList = (l) => call({ type: 'SET_TARGET_PAGES', pages: l.pages }, { okMsg: `Đã chọn "${l.name}" (${l.pages.length} page)` })
  const activeList = (l) => l.pages.length > 0 && l.pages.length === nPages && l.pages.every(p => targetIds.has(p.pageId))
  const saveList = async () => {
    if (!nPages) return notify('red', 'Chưa chọn page nào')
    const n = listName.trim() || `Danh sách ${new Date().toLocaleDateString('vi')}`
    await call({ type: 'SAVE_PAGE_LIST', name: n, pages: targetPages }, { okMsg: `Đã lưu "${n}"` }); setListName('')
  }

  const loadPagePosts = async () => {
    if (!nPages) return notify('red', 'Chọn ít nhất 1 Page mục tiêu')
    setLoadingPP(true)
    const r = await ext({ type: 'LIST_PAGE_POSTS' }, 240000)
    setLoadingPP(false)
    if (!r?.ok) return notify('red', r?.error || 'Lấy bài Page lỗi')
    setPagePosts(r.posts || []); setSelPP(new Set())
    notify(r.posts?.length ? 'green' : 'blue', `Đã lấy ${r.posts?.length || 0} bài từ Page`)
  }
  const toggleSelPP = (id) => setSelPP(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const addPagePosts = async () => {
    const chosen = pagePosts.filter(p => selPP.has(p.postId))
    if (!chosen.length) return notify('red', 'Chưa chọn bài nào')
    const content = pageContent.trim()
    if (!content) return notify('red', 'Nhập nội dung comment trước')
    const posts = chosen.map(p => ({ ...p, comment: content }))
    const r = await call({ type: 'ADD_PAGE_POSTS_TO_QUEUE', posts }, { okMsg: 'Đã thêm vào hàng chờ' })
    if (r?.ok) { setPagePosts(prev => prev.filter(p => !selPP.has(p.postId))); setSelPP(new Set()) }
  }

  const toggleSel = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allQSel = queue.length > 0 && queue.every(q => sel.has(q.postId))
  const toggleAllQ = () => setSel(allQSel ? new Set() : new Set(queue.map(q => q.postId)))
  const selCount = queue.filter(q => sel.has(q.postId)).length
  const bulkPost = () => post(queue.filter(q => sel.has(q.postId)).map(q => q.postId), (id) => setSel(p => { const n = new Set(p); n.delete(id); return n }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-100">Comment Page</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{s.state.doneToday}/{cfg.dailyCap} hôm nay</span>
          {loadingPP
            ? <Btn variant="danger" icon={IconPlayerStop} onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng</Btn>
            : <Btn variant="primary" icon={IconDownload} disabled={!nPages} onClick={loadPagePosts}>Lấy bài từ Page ({nPages})</Btn>}
        </div>
      </div>

      <Hint id="cmtpages">
        <b>1)</b> Chọn Page mục tiêu (tick thủ công bên phải, hoặc bấm <b>danh sách đã lưu</b>).
        {' '}<b>2)</b> Bấm <b>Lấy bài từ Page</b> → hiện bài của page.
        {' '}<b>3)</b> Tự <b>tick bài</b> + <b>nhập nội dung</b> comment → Thêm vào hàng chờ → Đăng.
      </Hint>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Nội dung comment ── */}
        <Card className="space-y-3 p-4">
          <Field label="Nội dung comment (tự đặt)" hint="Áp cho các bài bạn tick chọn ở dưới. Có thể sửa riêng từng bài sau khi vào hàng chờ.">
            <Textarea rows={5} value={pageContent} onChange={e => setPageContent(e.target.value)}
              placeholder={'Vd: Bên em có mẫu này giá tốt lắm, ib em tư vấn nhé ạ! 😍'} />
          </Field>
          <p className="text-xs text-slate-500">Page = bạn tự chọn bài & tự viết nội dung (khác với Nhóm — AI tự tìm bài tiềm năng).</p>
        </Card>

        {/* ── Chọn Page ── */}
        <Card className="flex flex-col p-0">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-100">
              <input type="checkbox" checked={allSel} disabled={!pool.length} onChange={toggleAllPool} className="h-4 w-4 accent-indigo-500" />
              <IconTarget size={15} className="text-indigo-400" /> Chọn Page ({nPages}/{pool.length})
            </label>
            <div className="flex items-center gap-1.5">
              <Input className="w-32" value={listName} onChange={e => setListName(e.target.value)} placeholder="tên d.sách" />
              <Btn size="sm" variant="ghost" icon={IconBookmark} onClick={saveList} disabled={!nPages}>Lưu</Btn>
            </div>
          </div>

          {savedPageLists.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 px-4 py-2.5">
              <span className="text-xs text-slate-500">Đã lưu:</span>
              {savedPageLists.map(l => (
                <button key={l.id} onClick={() => applyList(l)} className={`rounded-full border px-2.5 py-1 text-xs ${activeList(l) ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200' : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-indigo-500'}`}>{l.name} <span className="text-slate-500">({l.pages.length})</span></button>
              ))}
            </div>
          )}

          {pool.length === 0 ? (
            <Empty icon={IconBuildingStore}>
              Chưa có Page. <button onClick={() => goto?.('pages')} className="text-indigo-400 hover:underline">Sang trang Tìm Page</button> để tìm &amp; lưu danh sách.
            </Empty>
          ) : (
            <div className="max-h-[26rem] divide-y divide-slate-800 overflow-y-auto">
              {pool.map(p => (
                <div key={p.pageId} onClick={() => toggleTarget(p)}
                  className={`flex cursor-pointer items-center gap-3 p-2.5 hover:bg-slate-800/40 ${targetIds.has(p.pageId) ? 'bg-indigo-500/10' : ''}`}>
                  <input type="checkbox" checked={targetIds.has(p.pageId)} readOnly className="pointer-events-none h-4 w-4 shrink-0 accent-indigo-500" />
                  {p.icon
                    ? <img src={p.icon} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded bg-slate-700 object-cover" />
                    : <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-slate-700 text-xs font-semibold text-slate-300">{(p.name || '?')[0]}</div>}
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{p.name || p.pageId}</span>
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400"><IconExternalLink size={14} /></a>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Bài của Page: tự chọn ── */}
      {pagePosts.length > 0 && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-100">Chọn bài cần comment <span className="text-xs font-normal text-slate-500">({pagePosts.length} bài)</span></div>
            <Btn size="sm" variant="success" icon={IconSend} disabled={!selPP.size || !pageContent.trim()} onClick={addPagePosts}>Thêm vào hàng chờ ({selPP.size})</Btn>
          </div>
          {!pageContent.trim() && <p className="text-xs text-amber-400">Nhập <b>nội dung comment</b> ở ô bên trên trước khi thêm.</p>}
          <div className="max-h-80 divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-800">
            {pagePosts.map(p => (
              <div key={p.postId} onClick={() => toggleSelPP(p.postId)}
                className={`flex cursor-pointer items-start gap-2.5 p-3 hover:bg-slate-800/40 ${selPP.has(p.postId) ? 'bg-indigo-500/10' : ''}`}>
                <input type="checkbox" checked={selPP.has(p.postId)} readOnly className="pointer-events-none mt-1 h-4 w-4 shrink-0 accent-indigo-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color="blue">{p.pageName || 'Page'}</Badge>
                    {p.already && <Badge color="gray">đã comment</Badge>}
                    {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-indigo-400 hover:underline">xem bài</a>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{p.text || '(không có nội dung text)'}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Hàng chờ duyệt ── */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
          <input type="checkbox" checked={allQSel} onChange={toggleAllQ} disabled={!queue.length} className="h-4 w-4 accent-indigo-500" />
          <h2 className="font-semibold text-slate-100">Bài chờ duyệt</h2>
          <span className="text-xs text-slate-500">{queue.length} bài{selCount ? ` · chọn ${selCount}` : ''}</span>
          <div className="ml-auto">
            {posting
              ? <Btn size="sm" variant="danger" icon={IconPlayerStop} onClick={stop}>Dừng {pstat.done}/{pstat.total}{pstat.wait ? ` (${pstat.wait}s)` : ''}</Btn>
              : <Btn size="sm" variant="success" icon={IconSend} disabled={!selCount} onClick={bulkPost}>Đăng comment ({selCount})</Btn>}
          </div>
        </div>
        <div className="p-3">
          {queue.length === 0
            ? <Empty icon={IconListCheck}>Chưa có bài. <b>Lấy bài từ Page</b> rồi tự chọn + nhập nội dung.</Empty>
            : <div className="space-y-3">{queue.map(it => <QueueItem key={it.postId} it={it} onAct={act} selected={sel.has(it.postId)} onSel={toggleSel} />)}</div>}
        </div>
      </Card>

      {/* ── Log ── */}
      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200">
          <IconHistory size={15} /> Nhật ký
          <button onClick={() => call({ type: 'CLEAR_LOGS' })} className="ml-auto text-xs font-normal text-slate-500 hover:text-slate-300">Xoá log</button>
        </div>
        <LogFeed className="max-h-72 p-2" />
      </Card>
    </div>
  )
}
