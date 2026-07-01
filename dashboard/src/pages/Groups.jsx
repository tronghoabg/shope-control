import { useState } from 'react'
import { IconRadar2, IconExternalLink, IconStarFilled, IconUsersGroup, IconX, IconTarget, IconBookmark, IconPlayerStop } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Empty, Hint } from '../ui.jsx'

const scoreColor = (s) => s == null ? 'gray' : s >= 70 ? 'green' : s >= 40 ? 'yellow' : 'red'
const FILTERS = [{ k: 'all', l: 'Tất cả' }, { k: 'potential', l: 'Tiềm năng (≥70đ)' }, { k: 'weak', l: 'Kém (<40đ)' }]

export default function Groups() {
  const { s, aiReady, call, notify } = useShope()
  const [scanning, setScanning] = useState(false)
  const [filter, setFilter] = useState('all')
  if (!s) return <p className="text-slate-500">Đang tải danh sách nhóm…</p>

  const groups = s.discoveredGroups || []
  const targets = s.cfg?.groupIds || []
  const targetSet = new Set(targets)
  const syncedAt = s.groupsSyncedAt ? new Date(s.groupsSyncedAt).toLocaleString('vi') : 'chưa quét'

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
    const name = window.prompt('Tên danh sách Preset nhóm mục tiêu:', `Danh sách ${new Date().toLocaleDateString('vi')}`)
    if (name === null) return
    call({ type: 'SAVE_GROUP_LIST', name: name.trim() || 'Danh sách', groupIds: targets }, { okMsg: 'Đã lưu danh sách (Xem tại mục Đã lưu)' })
  }

  const scan = async () => {
    setScanning(true)
    await call({ type: 'DISCOVER_GROUPS' }, { okMsg: 'Đã quét & đánh giá nhóm thành công', errMsg: 'Quét nhóm lỗi', timeout: 240000 })
    setScanning(false)
  }
  const shown = groups.filter(g => filter === 'all' ? true : filter === 'potential' ? (g.score ?? 0) >= 70 : (g.score ?? 100) < 40)

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Danh sách nhóm của tôi</h1>
          <p className="text-sm text-slate-400">Danh sách các hội nhóm Facebook bạn đã tham gia. AI sẽ hỗ trợ đánh giá tiềm năng bán hàng.</p>
        </div>
        <div>
          {scanning
            ? <Btn variant="danger" icon={IconPlayerStop} onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng quét</Btn>
            : <Btn variant="primary" icon={IconRadar2} disabled={!aiReady} onClick={scan}>Quét &amp; Chấm Điểm AI</Btn>}
        </div>
      </div>

      <Hint id="groups">
        Nhóm bạn **đã tham gia** thành công trên tài khoản Facebook hiện tại. Nhấn **Quét & Chấm Điểm AI** để AI tự động lọc và xếp hạng chất lượng, sau đó tick chọn nhóm tiềm năng để đưa vào hàng chờ rải comment.
      </Hint>

      {/* Target configuration deck */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <IconTarget size={18} className="text-indigo-400" />
            <span>Danh sách nhóm mục tiêu hiện tại ({targets.length})</span>
          </div>
          {targets.length > 0 && (
            <div className="flex gap-2">
              <Btn size="sm" variant="ghost" icon={IconBookmark} onClick={saveList}>Lưu Preset</Btn>
              <Btn size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/10" onClick={clearTargets}>Hủy chọn tất cả</Btn>
            </div>
          )}
        </div>
        {targets.length === 0 ? (
          <p className="text-xs text-slate-500 leading-normal">Chưa có nhóm nào được chọn. Hãy tick chọn các nhóm ở danh sách bên dưới hoặc nhấn nút <b>Chọn nhanh nhóm tốt</b> để bắt đầu rải bài.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {targets.map(id => (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 py-1 pl-3 pr-1.5 text-xs text-indigo-300 font-semibold select-none">
                <span className="max-w-[200px] truncate">{nameMap[id] || id}</span>
                <button onClick={() => removeTarget(id)} className="rounded-full p-0.5 hover:bg-indigo-500/30 text-indigo-400 hover:text-indigo-200 transition-colors"><IconX size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Synchronized status bar */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Thời gian đồng bộ: <span className="font-semibold text-slate-350">{syncedAt}</span></span>
          <span>·</span>
          <Badge color="indigo">{groups.length} nhóm đã quét</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-slate-900/80 p-0.5 border border-slate-800">
            {FILTERS.map(f => (
              <button 
                key={f.k} 
                onClick={() => setFilter(f.k)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase transition-all ${
                  filter === f.k 
                    ? 'bg-indigo-650 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.l.split(' ')[0]}
              </button>
            ))}
          </div>
          <Btn size="sm" icon={IconStarFilled} onClick={addGood} disabled={!groups.length} className="text-amber-400 hover:bg-amber-500/5 border border-amber-500/10">Chọn nhanh nhóm tốt</Btn>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-850 bg-slate-950/20 px-3 py-2 text-xs font-semibold text-slate-305">
            <input type="checkbox" disabled={!shown.length}
              checked={shown.length > 0 && shown.every(g => targetSet.has(g.groupId))}
              onChange={() => shown.length && shown.every(g => targetSet.has(g.groupId))
                ? saveTargets(targets.filter(id => !shown.some(g => g.groupId === id)))
                : saveTargets([...targets, ...shown.map(g => g.groupId)])}
              className="h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800" />
            <span>Chọn tất cả lọc</span>
          </label>
        </div>
      </Card>

      {/* Main Groups list */}
      <Card className="p-0 overflow-hidden">
        {groups.length === 0 ? (
          <Empty icon={IconUsersGroup}>
            Chưa có dữ liệu nhóm đã đồng bộ. Hãy bấm nút <b>Quét & Chấm Điểm AI</b> ở góc phải phía trên để bắt đầu lấy thông tin nhóm.
          </Empty>
        ) : (
          <div className="max-h-[30rem] divide-y divide-slate-850 overflow-y-auto">
            {shown.map(g => (
              <div key={g.groupId} onClick={() => toggle(g.groupId)}
                className={`flex cursor-pointer items-start gap-4 p-4 hover:bg-slate-900/30 transition-colors ${targetSet.has(g.groupId) ? 'bg-indigo-500/[0.03]' : ''}`}>
                <input type="checkbox" checked={targetSet.has(g.groupId)} readOnly className="pointer-events-none mt-1 h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800 shrink-0" />
                {g.icon
                  ? <img src={g.icon} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 object-cover" />
                  : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-sm font-extrabold text-slate-400 border border-slate-800">{(g.name || '?')[0]}</div>}
                
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-200 text-xs truncate max-w-sm sm:max-w-md">{g.name}</span>
                    <Badge color={scoreColor(g.score)} className="text-[10px] px-1.5">{g.score == null ? 'Chưa điểm' : `${g.score}đ`}</Badge>
                    {g.niche && <Badge color="indigo" className="text-[10px] px-1.5">{g.niche}</Badge>}
                    {g.url && (
                      <a href={g.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400 h-6 w-6 rounded-lg hover:bg-slate-800 flex items-center justify-center">
                        <IconExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  {g.reason && <div className="mt-1 text-[11px] text-slate-500 leading-normal max-w-2xl">{g.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
