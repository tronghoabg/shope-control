import { useState } from 'react'
import { IconBookmark, IconTrash, IconTargetArrow, IconDeviceFloppy, IconFileText, IconUsersGroup, IconBuildingStore } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Card, Badge, Empty, Hint, Input } from '../ui.jsx'

export default function Saved() {
  const { s, call, notify } = useShope()
  const [name, setName] = useState('')
  if (!s) return <p className="text-slate-500">Đang tải danh sách lưu trữ…</p>

  const lists = s.savedGroupLists || []
  const pageLists = s.savedPageLists || []
  const posts = s.savedPosts || []
  const targets = s.cfg?.groupIds || []

  // tên nhóm để hiển thị
  const nameMap = {}
  for (const g of (s.discoveredGroups || [])) nameMap[g.groupId] = g.name
  for (const g of (s.searchResults || [])) if (!nameMap[g.groupId]) nameMap[g.groupId] = g.name

  const saveCurrent = async () => {
    if (!targets.length) return notify('red', 'Chưa có nhóm mục tiêu nào để lưu')
    const n = name.trim() || `Danh sách ${new Date().toLocaleDateString('vi')}`
    await call({ type: 'SAVE_GROUP_LIST', name: n, groupIds: targets }, { okMsg: `Đã lưu "${n}" (${targets.length} nhóm)` })
    setName('')
  }
  const apply = (l) => call({ type: 'SET_TARGETS', groupIds: l.groupIds }, { okMsg: `Đã áp dụng "${l.name}" (${l.groupIds.length} nhóm)` })
  const delList = (id) => call({ type: 'DELETE_GROUP_LIST', id }, { okMsg: 'Đã xoá danh sách' })
  const applyPages = (l) => call({ type: 'SET_TARGET_PAGES', pages: l.pages }, { okMsg: `Đã áp dụng "${l.name}" (${l.pages.length} page)` })
  const delPageList = (id) => call({ type: 'DELETE_PAGE_LIST', id }, { okMsg: 'Đã xoá danh sách page' })
  const delPost = (id) => call({ type: 'DELETE_POST', id }, { okMsg: 'Đã xoá bài' })

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Quản lý mục đã lưu</h1>
          <p className="text-sm text-slate-400">Danh sách các Preset cấu hình nhóm, Fanpage mục tiêu và các bài đăng mẫu đã lưu.</p>
        </div>
      </div>

      <Hint id="saved">
        Lưu trữ giúp bạn nhanh chóng hoán đổi cấu hình vận hành (Chiến dịch) chỉ với một cú click chuột thay vì phải thiết lập lại từ đầu.
      </Hint>

      {/* Nhóm mục tiêu đã lưu */}
      <Section title={<span className="flex items-center gap-2.5 text-sm font-bold text-slate-200"><IconUsersGroup size={18} className="text-indigo-400" /> Danh sách nhóm mục tiêu ({lists.length})</span>}>
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-3 p-3 bg-slate-950/20">
            <Input className="min-w-[180px] flex-1 h-10" value={name} onChange={e => setName(e.target.value)} placeholder={`Đặt tên preset (hiện chọn ${targets.length} nhóm)…`} />
            <Btn variant="primary" icon={IconDeviceFloppy} onClick={saveCurrent}>Lưu nhóm hiện tại làm Preset</Btn>
          </Card>
          
          {lists.length === 0 ? (
            <Empty icon={IconBookmark}>Chưa lưu danh sách nhóm mục tiêu nào.</Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {lists.map(l => (
                <Card key={l.id} className="p-4 flex flex-col justify-between h-32 hover:border-slate-700/80 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-205 truncate">{l.name}</span>
                      <Badge color="indigo" className="text-[9px] font-extrabold">{l.groupIds.length} nhóm</Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                      {l.groupIds.map(id => nameMap[id] || id).join(', ')}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-900 pt-2.5 mt-2">
                    <Btn size="sm" variant="default" icon={IconTargetArrow} onClick={() => apply(l)}>Áp dụng</Btn>
                    <Btn size="sm" variant="ghost" icon={IconTrash} className="text-red-400 h-8 w-8 !p-0 hover:bg-red-500/10" onClick={() => delList(l.id)} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Page mục tiêu đã lưu */}
      <Section title={<span className="flex items-center gap-2.5 text-sm font-bold text-slate-200"><IconBuildingStore size={18} className="text-indigo-400" /> Danh sách Page mục tiêu ({pageLists.length})</span>}>
        {pageLists.length === 0 ? (
          <Empty icon={IconBookmark}>Chưa có danh sách Page mục tiêu nào được lưu trữ.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pageLists.map(l => (
              <Card key={l.id} className="p-4 flex flex-col justify-between h-32 hover:border-slate-700/80 transition-all">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-205 truncate">{l.name}</span>
                    <Badge color="indigo" className="text-[9px] font-extrabold">{l.pages.length} page</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                    {l.pages.map(p => p.name || p.pageId).join(', ')}
                  </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-900 pt-2.5 mt-2">
                  <Btn size="sm" variant="default" icon={IconTargetArrow} onClick={() => applyPages(l)}>Áp dụng</Btn>
                  <Btn size="sm" variant="ghost" icon={IconTrash} className="text-red-400 h-8 w-8 !p-0 hover:bg-red-500/10" onClick={() => delPageList(l.id)} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Bài viết đã lưu */}
      <Section title={<span className="flex items-center gap-2.5 text-sm font-bold text-slate-200"><IconFileText size={18} className="text-indigo-400" /> Danh sách bài viết mẫu ({posts.length})</span>}>
        {posts.length === 0 ? (
          <Empty icon={IconBookmark}>Chưa có bài viết mẫu nào được lưu.</Empty>
        ) : (
          <div className="grid gap-4">
            {posts.map(p => (
              <Card key={p.id} className="p-4 space-y-3 hover:border-slate-700/80 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-xs text-slate-200">{p.title || 'Bài viết mẫu'}</h4>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-slate-400 leading-relaxed font-mono bg-slate-950/20 border border-slate-900/60 p-3 rounded-xl">{p.content}</p>
                    {p.link && <div className="mt-2 truncate text-xs text-indigo-400 hover:underline cursor-pointer">{p.link}</div>}
                  </div>
                  <Btn size="sm" variant="ghost" icon={IconTrash} className="shrink-0 text-red-400 h-9 w-9 hover:bg-red-500/10" onClick={() => delPost(p.id)} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
