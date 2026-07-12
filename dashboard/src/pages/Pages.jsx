import { useState } from 'react'
import { IconBuildingStore, IconSearch, IconExternalLink, IconTarget, IconX, IconPlayerStop, IconBookmark, IconTrash, IconListCheck, IconChevronDown, IconPencil } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Empty, Hint, Input, Section } from '../ui.jsx'

export default function Pages({ goto }) {
  const { s, aiReady, call, notify, confirm, prompt } = useShope()
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listName, setListName] = useState('')
  if (!s) return <p className="text-slate-500">Đang tải danh sách Fanpage…</p>

  const results = s.pageSearchResults || []
  const targets = s.targetPages || []
  const targetIds = new Set(targets.map(p => p.pageId))
  const savedLists = s.savedPageLists || []

  const setTargets = (pages) => call({ type: 'SET_TARGET_PAGES', pages })
  const toggle = (p) => {
    const lite = { pageId: p.pageId, name: p.name, url: p.url, icon: p.icon }
    setTargets(targetIds.has(p.pageId) ? targets.filter(x => x.pageId !== p.pageId) : [...targets, lite])
  }
  const removeTarget = (id) => setTargets(targets.filter(x => x.pageId !== id))

  const search = async (kw) => {
    const q = (kw ?? keyword).trim()
    if (!q) return notify('red', 'Nhập từ khoá tìm page')
    setKeyword(q); setSearching(true)
    await call({ type: 'SEARCH_PAGES', keyword: q }, { okMsg: 'Đã tìm xong', errMsg: 'Tìm page lỗi', timeout: 120000 })
    setSearching(false)
  }
  const loadMore = async () => {
    setLoadingMore(true)
    await call({ type: 'SEARCH_PAGES', more: true }, { errMsg: 'Tải thêm lỗi', timeout: 120000 })
    setLoadingMore(false)
  }

  const saveList = async () => {
    if (!targets.length) return notify('red', 'Chưa chọn Page nào')
    const n = (listName.trim() || `Danh sách ${new Date().toLocaleDateString('vi')}`)
    await call({ type: 'SAVE_PAGE_LIST', name: n, pages: targets }, { okMsg: `Đã lưu "${n}"` })
    setListName('')
  }
  const applyList = (l) => call({ type: 'SET_TARGET_PAGES', pages: l.pages }, { okMsg: `Đã chọn "${l.name}" (${l.pages.length} page)` })
  const deleteList = async (l) => { if (await confirm(`Xoá danh sách "${l.name}"?`, { danger: true, confirmText: 'Xoá' })) call({ type: 'DELETE_PAGE_LIST', id: l.id }, { okMsg: 'Đã xoá' }) }
  const renameList = async (l) => { const n = await prompt('Đổi tên preset page:', l.name, { title: 'Đổi tên' }); if (n && n.trim() && n.trim() !== l.name) call({ type: 'RENAME_PAGE_LIST', id: l.id, name: n.trim() }, { okMsg: 'Đã đổi tên' }) }
  const activeList = (l) => l.pages.length > 0 && l.pages.length === targets.length && l.pages.every(p => targetIds.has(p.pageId))

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Tìm kiếm Fanpage mục tiêu</h1>
          <p className="text-sm text-slate-400">Tìm kiếm các trang Fanpage lớn cùng lĩnh vực để tiếp cận tệp khách hàng tiềm năng.</p>
        </div>
        <div>
          <Btn variant="ghost" icon={IconListCheck} onClick={() => goto?.('cmtpages')}>Vận hành rải Fanpage →</Btn>
        </div>
      </div>

      <Hint id="pages">
        Tìm các trang Fanpage lớn (nơi khách hàng mục tiêu của bạn hay tương tác), tick chọn để đưa vào danh sách **Page mục tiêu**. Khi muốn rải comment, bạn có thể chuyển sang mục **Rải Fanpage** để cào các bài đăng mới nhất của họ.
      </Hint>

      {/* Target pages deck */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <IconTarget size={18} className="text-indigo-400" />
            <span>Danh sách Page mục tiêu đã chọn ({targets.length})</span>
          </div>
          {targets.length > 0 && (
            <div className="flex items-center gap-2.5">
              <Input className="w-48 h-8.5 text-xs rounded-lg" value={listName} onChange={e => setListName(e.target.value)} placeholder="Tên Preset cần lưu…" />
              <Btn size="sm" variant="primary" icon={IconBookmark} onClick={saveList}>Lưu Preset</Btn>
            </div>
          )}
        </div>
        
        {targets.length === 0 ? (
          <p className="text-xs text-slate-500 leading-normal">Chưa chọn trang nào. Tìm kiếm bên dưới và tích chọn các trang mục tiêu của bạn.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {targets.map(p => (
              <span key={p.pageId} className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 py-1 pl-2.5 pr-1.5 text-xs text-indigo-300 font-semibold select-none">
                {p.icon && <img src={p.icon} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded-full object-cover border border-slate-800" />}
                <span className="max-w-[180px] truncate">{p.name}</span>
                <button onClick={() => removeTarget(p.pageId)} className="rounded-full p-0.5 hover:bg-indigo-500/30 text-indigo-400 hover:text-indigo-200 transition-colors"><IconX size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Saved Presets list */}
      {savedLists.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <IconBookmark size={15} className="text-indigo-400" />
            <span>Preset Page mục tiêu đã lưu:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedLists.map(l => (
              <span key={l.id} className={`inline-flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-2.5 text-xs font-semibold transition-all ${
                activeList(l) 
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200' 
                  : 'border-slate-800 bg-slate-900/40 text-slate-350 hover:border-slate-700/60'
              }`}>
                <button onClick={() => applyList(l)} className="hover:underline">{l.name} <span className="text-slate-500">({l.pages.length} page)</span></button>
                <button onClick={() => renameList(l)} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-700/40 transition-colors" title="Đổi tên"><IconPencil size={12} /></button>
                <button onClick={() => deleteList(l)} className="rounded-full p-0.5 text-red-400 hover:bg-red-500/10 transition-colors" title="Xoá"><IconTrash size={12} /></button>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Search block */}
      <Section title="Tìm kiếm Fanpage theo từ khóa">
        <div className="flex gap-2.5">
          <Input placeholder="Nhập ngành nghề hoặc chủ đề Fanpage (vd: nước hoa auth, thời trang công sở…)" value={keyword}
            onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          {searching
            ? <Btn variant="danger" icon={IconPlayerStop} className="shrink-0" onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng</Btn>
            : <Btn variant="primary" icon={IconSearch} className="shrink-0" disabled={!aiReady} onClick={() => search()}>Tìm kiếm</Btn>}
        </div>
        {!aiReady && <p className="mt-2 text-xs text-amber-400">⚠️ Vui lòng đăng nhập tài khoản để sử dụng chức năng tìm kiếm Fanpage.</p>}
      </Section>

      {/* Results grid */}
      <Card className="p-0 overflow-hidden">
        {results.length === 0 ? (
          <Empty icon={IconBuildingStore}>Chưa có kết quả tìm kiếm. Vui lòng nhập từ khóa chủ đề phía trên để quét.</Empty>
        ) : (
          <div className="max-h-[30rem] divide-y divide-slate-850 overflow-y-auto">
            {results.map(p => (
              <div key={p.pageId} onClick={() => toggle(p)}
                className={`flex cursor-pointer items-start gap-4 p-4 hover:bg-slate-900/30 transition-colors ${targetIds.has(p.pageId) ? 'bg-indigo-500/[0.03]' : ''}`}>
                <input type="checkbox" checked={targetIds.has(p.pageId)} readOnly className="pointer-events-none mt-1 h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800 shrink-0" />
                {p.icon
                  ? <img src={p.icon} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 object-cover" />
                  : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-sm font-extrabold text-slate-400 border border-slate-800">{(p.name || '?')[0]}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200 text-xs truncate max-w-sm sm:max-w-md">{p.name}</span>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400 h-6 w-6 rounded-lg hover:bg-slate-800 flex items-center justify-center">
                        <IconExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  {p.snippet && <div className="mt-1 text-[11px] text-slate-500 leading-normal max-w-2xl">{p.snippet}</div>}
                </div>
              </div>
            ))}
            {s.pageHasMore && (
              <div className="p-4 flex justify-center bg-slate-900/10">
                <Btn variant="ghost" icon={IconChevronDown} loading={loadingMore} onClick={loadMore}
                  className="border border-slate-800 hover:bg-slate-900/60">
                  Tải thêm kết quả
                </Btn>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
