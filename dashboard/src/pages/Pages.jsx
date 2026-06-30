import { useState } from 'react'
import { IconBuildingStore, IconSearch, IconExternalLink, IconTarget, IconX, IconPlayerStop, IconBookmark, IconTrash, IconListCheck } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Empty, Hint, Input, Section } from '../ui.jsx'

export default function Pages({ goto }) {
  const { s, aiReady, call, notify } = useShope()
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [listName, setListName] = useState('')
  if (!s) return <p className="text-slate-500">Đang tải…</p>

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

  const saveList = async () => {
    if (!targets.length) return notify('red', 'Chưa chọn Page nào')
    const n = (listName.trim() || `Danh sách ${new Date().toLocaleDateString('vi')}`)
    await call({ type: 'SAVE_PAGE_LIST', name: n, pages: targets }, { okMsg: `Đã lưu "${n}"` })
    setListName('')
  }
  const applyList = (l) => call({ type: 'SET_TARGET_PAGES', pages: l.pages }, { okMsg: `Đã chọn "${l.name}" (${l.pages.length} page)` })
  const deleteList = (l) => { if (window.confirm(`Xoá danh sách "${l.name}"?`)) call({ type: 'DELETE_PAGE_LIST', id: l.id }, { okMsg: 'Đã xoá' }) }
  const activeList = (l) => l.pages.length > 0 && l.pages.length === targets.length && l.pages.every(p => targetIds.has(p.pageId))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Page mục tiêu</h1>
        <Btn variant="ghost" icon={IconListCheck} onClick={() => goto?.('queue')}>Sang Comment dạo →</Btn>
      </div>

      <Hint id="pages">
        Trang này chỉ để <b>chọn &amp; lưu danh sách Page mục tiêu</b> (Page lớn cùng ngành — nơi khách tụ tập).
        {' '}Tìm page theo từ khoá → tick chọn → <b>Lưu danh sách</b>.
        {' '}Khi muốn comment, sang <b>Comment dạo</b>: chọn danh sách Page đã lưu, <b>tự chọn bài</b> và <b>tự đặt nội dung</b> comment.
      </Hint>

      {/* Mục tiêu đang chọn */}
      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <IconTarget size={16} className="text-indigo-400" /> Page mục tiêu ({targets.length})
          </div>
          {targets.length > 0 && (
            <div className="flex items-center gap-2">
              <Input className="w-48" value={listName} onChange={e => setListName(e.target.value)} placeholder="tên danh sách để lưu" />
              <Btn size="sm" variant="ghost" icon={IconBookmark} onClick={saveList}>Lưu danh sách</Btn>
            </div>
          )}
        </div>
        {targets.length === 0
          ? <p className="text-sm text-slate-500">Chưa chọn page nào. Tìm bên dưới rồi tick chọn, hoặc áp một danh sách đã lưu.</p>
          : <div className="flex flex-wrap gap-2">
            {targets.map(p => (
              <span key={p.pageId} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 py-1 pl-2 pr-1.5 text-xs text-indigo-200">
                {p.icon && <img src={p.icon} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded-full" />}
                <span className="max-w-[180px] truncate">{p.name}</span>
                <button onClick={() => removeTarget(p.pageId)} className="rounded-full p-0.5 hover:bg-indigo-500/30"><IconX size={12} /></button>
              </span>
            ))}
          </div>}
      </Card>

      {/* Danh sách đã lưu */}
      {savedLists.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <IconBookmark size={16} className="text-indigo-400" /> Danh sách Page đã lưu
          </div>
          <div className="flex flex-wrap gap-2">
            {savedLists.map(l => (
              <span key={l.id} className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-xs ${activeList(l) ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200' : 'border-slate-700 bg-slate-800 text-slate-200'}`}>
                <button onClick={() => applyList(l)} className="hover:underline">{l.name} <span className="text-slate-500">({l.pages.length})</span></button>
                <button onClick={() => deleteList(l)} className="rounded-full p-0.5 text-red-400 hover:bg-red-500/20"><IconTrash size={12} /></button>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Tìm page */}
      <Section title="Tìm Page theo từ khoá">
        <div className="flex gap-2">
          <Input placeholder="vd: mỹ phẩm, nước hoa, thời trang…" value={keyword}
            onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          {searching
            ? <Btn variant="danger" icon={IconPlayerStop} className="shrink-0" onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng</Btn>
            : <Btn variant="primary" icon={IconSearch} className="shrink-0" disabled={!aiReady} onClick={() => search()}>Tìm</Btn>}
        </div>
        {!aiReady && <p className="mt-2 text-xs text-amber-400">Cần đăng nhập tài khoản để dùng (AI hệ thống).</p>}
      </Section>

      {/* Kết quả */}
      <Card>
        {results.length === 0 ? (
          <Empty icon={IconBuildingStore}>Chưa có kết quả. Tìm page theo từ khoá ở trên.</Empty>
        ) : (
          <div className="max-h-[30rem] divide-y divide-slate-800 overflow-y-auto">
            {results.map(p => (
              <div key={p.pageId} onClick={() => toggle(p)}
                className={`flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-800/40 ${targetIds.has(p.pageId) ? 'bg-indigo-500/10' : ''}`}>
                <input type="checkbox" checked={targetIds.has(p.pageId)} readOnly className="pointer-events-none mt-1 h-4 w-4 shrink-0 accent-indigo-500" />
                {p.icon
                  ? <img src={p.icon} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-700 text-sm font-semibold text-slate-300">{(p.name || '?')[0]}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-100">{p.name}</span>
                    <a href={p.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400"><IconExternalLink size={14} /></a>
                  </div>
                  {p.snippet && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{p.snippet}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
