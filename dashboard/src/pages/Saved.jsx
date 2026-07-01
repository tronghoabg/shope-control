import { useState } from 'react'
import { IconBookmark, IconTrash, IconTargetArrow, IconDeviceFloppy, IconFileText, IconUsersGroup, IconBuildingStore } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Card, Badge, Empty, Hint, Input } from '../ui.jsx'

export default function Saved() {
  const { s, call, notify } = useShope()
  const [name, setName] = useState('')
  if (!s) return <p className="text-slate-500">Đang tải…</p>

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
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Đã lưu</h1>
      <Hint id="saved">
        Quản lý mọi thứ đã lưu: <b>danh sách nhóm</b>, <b>danh sách Page</b> (đổi chiến dịch 1 chạm) và <b>bài viết mẫu</b>.
        Bấm <b>Áp dụng</b> để đặt làm mục tiêu hiện tại; <b>Xoá</b> để gỡ.
      </Hint>

      {/* Nhóm mục tiêu đã lưu */}
      <Section title={<span className="flex items-center gap-2"><IconUsersGroup size={16} className="text-indigo-400" /> Danh sách nhóm mục tiêu ({lists.length})</span>}>
        <Card className="mb-3 flex flex-wrap items-center gap-2 p-3">
          <Input className="min-w-[180px] flex-1" value={name} onChange={e => setName(e.target.value)} placeholder={`Tên danh sách (đang chọn ${targets.length} nhóm)`} />
          <Btn variant="primary" icon={IconDeviceFloppy} onClick={saveCurrent}>Lưu nhóm mục tiêu hiện tại</Btn>
        </Card>
        {lists.length === 0 ? (
          <Empty icon={IconBookmark}>Chưa lưu danh sách nào. Chọn nhóm mục tiêu ở <b>Nhóm của tôi</b> rồi lưu tại đây.</Empty>
        ) : (
          <div className="space-y-2">
            {lists.map(l => (
              <Card key={l.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-100">{l.name}</div>
                  <div className="truncate text-xs text-slate-500">{l.groupIds.length} nhóm · {l.groupIds.slice(0, 3).map(id => nameMap[id] || id).join(', ')}{l.groupIds.length > 3 ? '…' : ''}</div>
                </div>
                <Badge color="gray">{l.groupIds.length}</Badge>
                <Btn size="sm" variant="primary" icon={IconTargetArrow} onClick={() => apply(l)}>Áp dụng</Btn>
                <Btn size="sm" variant="ghost" icon={IconTrash} className="text-red-400" onClick={() => delList(l.id)}>Xoá</Btn>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Page mục tiêu đã lưu */}
      <Section title={<span className="flex items-center gap-2"><IconBuildingStore size={16} className="text-indigo-400" /> Danh sách Page mục tiêu ({pageLists.length})</span>}>
        {pageLists.length === 0 ? (
          <Empty icon={IconBookmark}>Chưa lưu danh sách Page nào. Chọn Page ở <b>Tìm Page</b> / <b>Comment Page</b> rồi lưu.</Empty>
        ) : (
          <div className="space-y-2">
            {pageLists.map(l => (
              <Card key={l.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-100">{l.name}</div>
                  <div className="truncate text-xs text-slate-500">{l.pages.length} page · {l.pages.slice(0, 3).map(p => p.name || p.pageId).join(', ')}{l.pages.length > 3 ? '…' : ''}</div>
                </div>
                <Badge color="gray">{l.pages.length}</Badge>
                <Btn size="sm" variant="primary" icon={IconTargetArrow} onClick={() => applyPages(l)}>Áp dụng</Btn>
                <Btn size="sm" variant="ghost" icon={IconTrash} className="text-red-400" onClick={() => delPageList(l.id)}>Xoá</Btn>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Bài viết đã lưu */}
      <Section title={<span className="flex items-center gap-2"><IconFileText size={16} className="text-indigo-400" /> Bài viết mẫu ({posts.length})</span>}>
        {posts.length === 0 ? (
          <Empty icon={IconBookmark}>Chưa lưu bài nào. Soạn ở <b>Đăng bài nhóm</b> rồi bấm <b>Lưu bài</b>.</Empty>
        ) : (
          <div className="space-y-2">
            {posts.map(p => (
              <Card key={p.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-100">{p.title}</div>
                  <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">{p.content}</div>
                  {p.link && <div className="mt-0.5 truncate text-xs text-indigo-400">{p.link}</div>}
                </div>
                <Btn size="sm" variant="ghost" icon={IconTrash} className="shrink-0 text-red-400" onClick={() => delPost(p.id)}>Xoá</Btn>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
