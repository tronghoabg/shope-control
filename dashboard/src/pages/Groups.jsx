import { useState } from 'react'
import { IconRadar2, IconExternalLink, IconStarFilled, IconUsersGroup, IconX, IconTarget, IconBookmark, IconPlayerStop } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Empty, Hint } from '../ui.jsx'

const scoreColor = (s) => s == null ? 'gray' : s >= 70 ? 'green' : s >= 40 ? 'yellow' : 'red'
const FILTERS = [{ k: 'all', l: 'Tất cả' }, { k: 'potential', l: 'Tiềm năng' }, { k: 'weak', l: 'Kém' }]

export default function Groups() {
  const { s, aiReady, call, notify } = useShope()
  const [scanning, setScanning] = useState(false)
  const [filter, setFilter] = useState('all')
  if (!s) return <p className="text-slate-500">Đang tải…</p>

  const groups = s.discoveredGroups || []
  const targets = s.cfg?.groupIds || []
  const targetSet = new Set(targets)
  const syncedAt = s.groupsSyncedAt ? new Date(s.groupsSyncedAt).toLocaleString('vi') : 'chưa quét'

  // Tên nhóm cho id mục tiêu (gộp từ nhóm đã quét + kết quả tìm)
  const nameMap = {}
  for (const g of groups) nameMap[g.groupId] = g.name
  for (const g of (s.searchResults || [])) if (!nameMap[g.groupId]) nameMap[g.groupId] = g.name

  const saveTargets = (ids) => call({ type: 'SET_TARGETS', groupIds: [...new Set(ids)] })
  const toggle = (id) => saveTargets(targetSet.has(id) ? targets.filter(x => x !== id) : [...targets, id])
  const removeTarget = (id) => saveTargets(targets.filter(x => x !== id))
  const clearTargets = () => saveTargets([])
  const addGood = () => saveTargets([...targets, ...groups.filter(g => (g.score ?? 0) >= 70).map(g => g.groupId)])
  const saveList = () => {
    if (!targets.length) return
    const name = window.prompt('Tên danh sách nhóm mục tiêu:', `Danh sách ${new Date().toLocaleDateString('vi')}`)
    if (name === null) return
    call({ type: 'SAVE_GROUP_LIST', name: name.trim() || 'Danh sách', groupIds: targets }, { okMsg: 'Đã lưu danh sách (xem ở Đã lưu)' })
  }

  const scan = async () => {
    setScanning(true)
    await call({ type: 'DISCOVER_GROUPS' }, { okMsg: 'Đã quét & chấm điểm nhóm', errMsg: 'Quét nhóm lỗi', timeout: 240000 })
    setScanning(false)
  }
  const shown = groups.filter(g => filter === 'all' ? true : filter === 'potential' ? (g.score ?? 0) >= 70 : (g.score ?? 100) < 40)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Nhóm của tôi</h1>
        {scanning
          ? <Btn variant="danger" icon={IconPlayerStop} onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng</Btn>
          : <Btn variant="primary" icon={IconRadar2} disabled={!aiReady} onClick={scan}>Quét &amp; chấm điểm</Btn>}
      </div>

      <Hint id="groups">
        Nhóm bạn <b>đã tham gia</b>. Bấm <b>Quét &amp; chấm điểm</b> để AI đánh giá nhóm nào hợp bán hàng,
        rồi <b>tick nhóm</b> (hoặc <b>Chọn nhóm tốt</b>) để đưa vào <b>Nhóm mục tiêu</b> — tool chỉ rải link/comment ở các nhóm mục tiêu.
      </Hint>

      {/* Quản lý mục tiêu */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <IconTarget size={16} className="text-indigo-400" /> Nhóm mục tiêu ({targets.length})
          </div>
          {targets.length > 0 && (
            <div className="flex gap-1.5">
              <Btn size="sm" variant="ghost" icon={IconBookmark} onClick={saveList}>Lưu danh sách</Btn>
              <Btn size="sm" variant="ghost" className="text-red-400" onClick={clearTargets}>Xoá tất cả</Btn>
            </div>
          )}
        </div>
        {targets.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa chọn nhóm nào. Tick vào nhóm bên dưới (hoặc <b>Chọn nhóm tốt</b>) để thêm vào mục tiêu — tool chỉ rải link/comment ở các nhóm này.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {targets.map(id => (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 py-1 pl-3 pr-1.5 text-xs text-indigo-200">
                <span className="max-w-[200px] truncate">{nameMap[id] || id}</span>
                <button onClick={() => removeTarget(id)} className="rounded-full p-0.5 hover:bg-indigo-500/30"><IconX size={13} /></button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Danh sách nhóm đã quét */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Đồng bộ: {syncedAt}</span>
          <Badge>{groups.length} nhóm</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-700">
            {FILTERS.map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.k ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{f.l}</button>
            ))}
          </div>
          <Btn size="sm" icon={IconStarFilled} onClick={addGood} disabled={!groups.length}>Chọn nhóm tốt</Btn>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300">
            <input type="checkbox" disabled={!shown.length}
              checked={shown.length > 0 && shown.every(g => targetSet.has(g.groupId))}
              onChange={() => shown.length && shown.every(g => targetSet.has(g.groupId))
                ? saveTargets(targets.filter(id => !shown.some(g => g.groupId === id)))
                : saveTargets([...targets, ...shown.map(g => g.groupId)])}
              className="h-4 w-4 accent-indigo-500" />
            Chọn tất cả
          </label>
        </div>
      </Card>

      <Card>
        {groups.length === 0 ? (
          <Empty icon={IconUsersGroup}>
            Chưa có dữ liệu. Bấm <b>Quét &amp; chấm điểm</b> để lấy nhóm đã tham gia + AI đánh giá.
            {!aiReady && <div className="mt-1 text-amber-400">Cần đăng nhập tài khoản để dùng AI hệ thống (góc dưới trái).</div>}
          </Empty>
        ) : (
          <div className="max-h-[30rem] divide-y divide-slate-800 overflow-y-auto">
            {shown.map(g => (
              <div key={g.groupId} onClick={() => toggle(g.groupId)}
                className={`flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-800/40 ${targetSet.has(g.groupId) ? 'bg-indigo-500/10' : ''}`}>
                <input type="checkbox" checked={targetSet.has(g.groupId)} readOnly className="pointer-events-none mt-1.5 h-4 w-4 shrink-0 accent-indigo-500" />
                {g.icon
                  ? <img src={g.icon} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-slate-700 object-cover" />
                  : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-700 text-sm font-semibold text-slate-300">{(g.name || '?')[0]}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-slate-100">{g.name}</span>
                    <Badge color={scoreColor(g.score)}>{g.score == null ? '—' : `${g.score}đ`}</Badge>
                    {g.niche && <Badge color="indigo">{g.niche}</Badge>}
                    <a href={g.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400"><IconExternalLink size={14} /></a>
                  </div>
                  {g.reason && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{g.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
