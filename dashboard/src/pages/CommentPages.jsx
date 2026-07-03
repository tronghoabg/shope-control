import { useState, useMemo } from 'react'
import {
  IconBuildingStore, IconDownload, IconPlayerStop, IconSend, IconTarget, IconExternalLink,
  IconHistory, IconBookmark, IconListCheck, IconSettings, IconChevronRight
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Textarea, Empty, Hint, Input, Field } from '../ui.jsx'
import { QueueItem, usePoster } from '../commentShared.jsx'
import { LogFeed } from '../LogPanel.jsx'

export default function CommentPages({ goto }) {
  const { s, call, notify, account } = useShope()
  const { posting, pstat, post, stop } = usePoster()
  const [pagePosts, setPagePosts] = useState([])
  const [selPP, setSelPP] = useState(() => new Set())
  const [pageContent, setPageContent] = useState('')
  const [loadingPP, setLoadingPP] = useState(false)
  const [sel, setSel] = useState(() => new Set())
  const [listName, setListName] = useState('')
  const [step, setStep] = useState(2) // Default to step 3 (index 2) so they see queue immediately

  // Pool page chọn được
  const pool = useMemo(() => {
    const m = new Map()
    const add = (p) => { if (p?.pageId && !m.has(String(p.pageId))) m.set(String(p.pageId), { pageId: String(p.pageId), name: p.name || '', url: p.url || '', icon: p.icon || '' }) }
    for (const p of (s?.pageSearchResults || [])) add(p)
    for (const p of (s?.targetPages || [])) add(p)
    for (const l of (s?.savedPageLists || [])) for (const p of (l.pages || [])) add(p)
    return [...m.values()]
  }, [s?.pageSearchResults, s?.targetPages, s?.savedPageLists])

  if (!s) return <p className="text-slate-500">Đang tải cấu hình Fanpage…</p>

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
    notify(r.posts?.length ? 'green' : 'blue', `Đã lấy ${r.posts?.length || 0} bài viết từ Page`)
  }
  const toggleSelPP = (id) => setSelPP(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const addPagePosts = async () => {
    const chosen = pagePosts.filter(p => selPP.has(p.postId))
    if (!chosen.length) return notify('red', 'Chưa chọn bài nào')
    const content = pageContent.trim()
    if (!content) return notify('red', 'Nhập nội dung comment trước')
    const posts = chosen.map(p => ({ ...p, comment: content }))
    const r = await call({ type: 'ADD_PAGE_POSTS_TO_QUEUE', posts }, { okMsg: 'Đã thêm bài viết vào hàng chờ' })
    if (r?.ok) { setPagePosts(prev => prev.filter(p => !selPP.has(p.postId))); setSelPP(new Set()) }
  }

  const toggleSel = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allQSel = queue.length > 0 && queue.every(q => sel.has(q.postId))
  const toggleAllQ = () => setSel(allQSel ? new Set() : new Set(queue.map(q => q.postId)))
  const selCount = queue.filter(q => sel.has(q.postId)).length
  const bulkPost = () => post(queue.filter(q => sel.has(q.postId)).map(q => q.postId), (id) => setSel(p => { const n = new Set(p); n.delete(id); return n }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Vận hành Comment Fanpage</h1>
          <p className="text-sm text-slate-400">Chọn Page mục tiêu, cào bài viết mới nhất và soạn bình luận tự động.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge color="gray">{s.state.doneToday || 0}/{cfg.dailyCap} đã chạy hôm nay</Badge>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="grid grid-cols-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-1.5 backdrop-blur-xl shadow-lg shadow-black/20 relative">
        <button
          onClick={() => setStep(0)}
          className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold tracking-wide uppercase transition-all duration-300 ${
            step === 0 
              ? 'text-white' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          {step === 0 && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-md shadow-indigo-500/20 -z-10" />}
          <IconSettings size={16} />
          <span>Bước 1: Soạn comment</span>
        </button>
        <button
          onClick={() => setStep(1)}
          className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold tracking-wide uppercase transition-all duration-300 ${
            step === 1 
              ? 'text-white' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          {step === 1 && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-md shadow-indigo-500/20 -z-10" />}
          <IconBuildingStore size={16} />
          <span>Bước 2: Page mục tiêu ({nPages})</span>
        </button>
        <button
          onClick={() => setStep(2)}
          className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold tracking-wide uppercase transition-all duration-300 ${
            step === 2 
              ? 'text-white' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          {step === 2 && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-md shadow-indigo-500/20 -z-10" />}
          <IconListCheck size={16} />
          <span>Bước 3: Lấy bài & rải ({queue.length})</span>
        </button>
      </div>

      {/* Step 1: Configuration / Comment Template */}
      {step === 0 && (
        <div className="space-y-5 animate-fadeIn">
          <Hint id="cmtpages_content">
            Nhập nội dung phản hồi mặc định. Bạn có thể chèn link Shopee/Catalog hoặc để trống để soạn nội dung sau trong hàng chờ.
          </Hint>

          <Card className="p-6 space-y-4">
            <Field label="Nội dung comment mặc định" hint="Nội dung này sẽ tự động áp dụng cho các bài viết bạn chọn cào từ Page ở Bước 3.">
              <Textarea 
                rows={6} 
                value={pageContent} 
                onChange={e => setPageContent(e.target.value)}
                placeholder="Vd: Bên em đang có ưu đãi cho sản phẩm này ạ. Anh/chị xem chi tiết ở link nhé! 😍" 
              />
            </Field>
            <div className="flex justify-between items-center border-t border-slate-850 pt-4">
              <span className="text-xs text-slate-500">Khác với nhóm (quét tự động), Page yêu cầu bạn tự duyệt bài và tự đặt nội dung.</span>
              <Btn variant="primary" onClick={() => setStep(1)} className="group">
                Tiếp tục chọn Page mục tiêu <IconChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Step 2: Target Pages */}
      {step === 1 && (
        <div className="space-y-5 animate-fadeIn">
          <Hint id="cmtpages_targets">
            Tick chọn các Fanpage đối thủ hoặc fanpage cộng đồng cùng ngành nghề để cào bài viết mới nhất.
          </Hint>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <Card className="flex flex-col h-[32rem]">
                <div className="flex items-center justify-between border-b border-slate-850 px-5 py-4">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-slate-200">
                    <input type="checkbox" checked={allSel} disabled={!pool.length} onChange={toggleAllPool} className="h-4.5 w-4.5 accent-indigo-500 rounded border-slate-850" />
                    <span>Danh sách Page mục tiêu khả dụng ({pool.length})</span>
                  </label>
                  {nPages > 0 && <span className="text-xs text-slate-400">Đã chọn {nPages} page</span>}
                </div>

                {pool.length === 0 ? (
                  <Empty icon={IconBuildingStore}>
                    Chưa có Page nào trong danh sách. Hãy sang tab <button onClick={() => goto?.('pages')} className="text-indigo-400 hover:underline">Tìm Page</button> để tìm kiếm &amp; lưu Page mục tiêu.
                  </Empty>
                ) : (
                  <div className="flex-1 divide-y divide-slate-850 overflow-y-auto">
                    {pool.map(p => (
                      <div key={p.pageId} onClick={() => toggleTarget(p)}
                        className={`flex cursor-pointer items-center gap-3.5 px-5 py-3 hover:bg-slate-900/30 transition-colors ${targetIds.has(p.pageId) ? 'bg-indigo-500/[0.03]' : ''}`}>
                        <input type="checkbox" checked={targetIds.has(p.pageId)} readOnly className="pointer-events-none h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800" />
                        {p.icon
                          ? <img src={p.icon} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-lg bg-slate-800 object-cover" />
                          : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-bold text-slate-400 border border-slate-800">{(p.name || '?')[0]}</div>}
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-300">{p.name || p.pageId}</span>
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400 h-7 w-7 rounded-lg hover:bg-slate-800 flex items-center justify-center">
                            <IconExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div>
              <Card className="p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm mb-1.5">Lưu Preset Page</h3>
                  <p className="text-xs text-slate-500 mb-3">Lưu tập {nPages} page đang chọn làm Preset.</p>
                  <div className="space-y-2">
                    <Input value={listName} onChange={e => setListName(e.target.value)} placeholder="Tên danh sách Preset Page…" />
                    <Btn variant="primary" icon={IconBookmark} onClick={saveList} disabled={!nPages} className="w-full">
                      Lưu Preset Page
                    </Btn>
                  </div>
                </div>

                {savedPageLists.length > 0 && (
                  <div className="pt-4 border-t border-slate-850">
                    <h3 className="font-semibold text-slate-150 text-xs mb-2">Preset Page đã lưu:</h3>
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                      {savedPageLists.map(l => (
                        <button 
                          key={l.id} 
                          onClick={() => applyList(l)}
                          className={`text-xs text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                            activeList(l) 
                              ? 'border-indigo-500/40 bg-indigo-500/[0.04] text-indigo-300 font-bold' 
                              : 'border-slate-800 bg-slate-900/10 text-slate-400 hover:border-slate-700/60'
                          }`}
                        >
                          <span className="truncate pr-2">{l.name}</span>
                          <span className="text-[10px] text-slate-500">({l.pages.length} page)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-850">
                  <Btn variant="success" className="w-full" onClick={() => setStep(2)}>
                    Tiến tới lấy bài &amp; rải <IconChevronRight size={14} />
                  </Btn>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Fetch posts & Run */}
      {step === 2 && (
        <div className="flex flex-col xl:flex-row gap-6 animate-fadeIn items-start">
          <div className="flex-1 min-w-0 space-y-6">
          {/* Controls */}
          <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-205 text-sm">Cào bài viết từ Page mục tiêu</h3>
              <p className="text-xs text-slate-400 mt-0.5">Lấy các bài đăng mới nhất từ {nPages} Page mục tiêu để bắt đầu rải comment.</p>
            </div>
            <div>
              {loadingPP
                ? <Btn variant="danger" icon={IconPlayerStop} onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng cào bài</Btn>
                : <Btn variant="primary" icon={IconDownload} disabled={!nPages} onClick={loadPagePosts}>Cào bài từ Page</Btn>}
            </div>
          </Card>

          {/* Scraped posts to queue */}
          {pagePosts.length > 0 && (
            <Card className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-850">
                <div>
                  <h3 className="font-bold text-slate-200 text-sm">Bài viết cào được ({pagePosts.length} bài)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Chọn bài cần comment và nhấn nút thêm vào hàng chờ duyệt rải link.</p>
                </div>
                <Btn variant="success" icon={IconSend} disabled={!selPP.size || !pageContent.trim()} onClick={addPagePosts}>
                  Thêm vào hàng chờ ({selPP.size})
                </Btn>
              </div>
              
              {!pageContent.trim() && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-xs text-amber-400">
                  ⚠️ Vui lòng nhập <b>nội dung comment</b> tại <button onClick={() => setStep(0)} className="underline hover:text-amber-300 font-bold">Bước 1</button> trước khi thêm bài viết vào hàng chờ.
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-slate-850/80 bg-slate-950/15">
                <div className="max-h-80 divide-y divide-slate-850 overflow-y-auto">
                  {pagePosts.map(p => (
                    <div key={p.postId} onClick={() => toggleSelPP(p.postId)}
                      className={`flex cursor-pointer items-start gap-3 p-4 hover:bg-slate-900/30 transition-colors ${selPP.has(p.postId) ? 'bg-indigo-500/[0.02]' : ''}`}>
                      <input type="checkbox" checked={selPP.has(p.postId)} readOnly className="pointer-events-none mt-1 h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge color="blue">{p.pageName || 'Page'}</Badge>
                          {p.already && <Badge color="gray">Đã comment trước đây</Badge>}
                          {p.permalink && (
                            <a href={p.permalink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1">
                              Xem bài gốc <IconExternalLink size={12} />
                            </a>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-2">{p.text || '(Không có nội dung text)'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Queue Section */}
          <Card className="p-0 border border-slate-800 bg-slate-950/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <input type="checkbox" checked={allQSel} onChange={toggleAllQ} disabled={!queue.length} className="h-4.5 w-4.5 accent-indigo-500 rounded border-slate-850" />
                <h2 className="font-bold text-slate-100 text-sm">Hàng chờ duyệt comment ({queue.length} bài)</h2>
                {selCount > 0 && <Badge color="indigo">Đã chọn {selCount}</Badge>}
              </div>
              <div>
                {posting
                  ? <Btn size="sm" variant="danger" icon={IconPlayerStop} onClick={stop}>Dừng {pstat.done}/{pstat.total}{pstat.wait ? ` (nghỉ ${pstat.wait}s)` : ''}</Btn>
                  : <Btn size="sm" variant="success" icon={IconSend} disabled={!selCount} onClick={() => {
                      if (!account?.loggedIn) return notify('red', 'Vui lòng đăng nhập tài khoản hệ thống để sử dụng tính năng này')
                      bulkPost()
                    }}>Đăng comment ({selCount})</Btn>}
              </div>
            </div>

            <div className="p-4">
              {queue.length === 0 ? (
                <Empty icon={IconListCheck}>
                  Hàng chờ comment trống. Nhấn <b>Cào bài từ Page</b> bên trên và tích chọn bài viết để thêm vào.
                </Empty>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {queue.map(it => <QueueItem key={it.postId} it={it} onAct={act} selected={sel.has(it.postId)} onSel={toggleSel} />)}
                </div>
              )}
            </div>
          </Card>
          </div>
          {/* Logs Panel (Right Side) */}
          <div className="w-full xl:w-96 shrink-0 xl:sticky xl:top-6">
            <Card className="p-0 flex flex-col xl:h-[calc(100vh-8rem)] border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2 border-b border-slate-850 px-4 py-3 text-sm font-semibold text-slate-200 shrink-0">
                <IconHistory size={16} className="text-indigo-400" />
                <span>Nhật ký rải Fanpage</span>
                <button onClick={() => call({ type: 'CLEAR_LOGS' })} className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">Xóa</button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <LogFeed className="p-3 font-mono text-[11px] leading-relaxed" />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
