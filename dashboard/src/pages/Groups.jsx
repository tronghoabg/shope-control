import { useState } from 'react'
import { IconExternalLink, IconStarFilled, IconUsersGroup, IconX, IconTarget, IconBookmark, IconPlayerStop, IconDownload, IconSparkles, IconFilter } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Empty, Hint, Input } from '../ui.jsx'

// Đổi "điểm số" (khó hiểu) → nhãn chữ dễ hiểu.
const verdict = (s) => s == null ? null
  : s >= 70 ? { color: 'green', label: '✓ Phù hợp' }
  : s >= 40 ? { color: 'yellow', label: 'Có thể phù hợp' }
  : { color: 'gray', label: 'Ít liên quan' }
const FILTERS = [{ k: 'all', l: 'Tất cả' }, { k: 'potential', l: 'Phù hợp' }, { k: 'weak', l: 'Ít liên quan' }]

export default function Groups() {
  const { s, aiReady, call, notify, account } = useShope()
  const [loading, setLoading] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [goal, setGoal] = useState('')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
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

  const busy = loading || scoring
  const load = async () => {
    setLoading(true)
    await call({ type: 'LOAD_JOINED_GROUPS' }, { okMsg: 'Đã tải danh sách nhóm đã tham gia', errMsg: 'Tải nhóm lỗi', timeout: 180000 })
    setLoading(false)
  }
  const score = async () => {
    if (!groups.length) return notify('red', 'Chưa có nhóm — bấm "Tải nhóm đã tham gia" trước')
    if (!account?.loggedIn) return notify('red', 'Vui lòng đăng nhập tài khoản để dùng AI chấm điểm')
    setScoring(true)
    const g = goal.trim()
    await call({ type: 'SCORE_GROUPS', goal: g }, { okMsg: g ? 'Đã lọc nhóm theo mục tiêu' : 'Đã chấm điểm theo sản phẩm shop', errMsg: 'Chấm điểm lỗi', timeout: 240000 })
    setScoring(false)
  }
  const qq = q.trim().toLowerCase()
  const shown = groups
    .filter(g => filter === 'all' ? true : filter === 'potential' ? (g.score ?? 0) >= 70 : (g.score ?? 100) < 40)
    .filter(g => !qq || (g.name || '').toLowerCase().includes(qq) || (g.niche || '').toLowerCase().includes(qq))

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Danh sách nhóm của tôi</h1>
          <p className="text-sm text-slate-400">Tải các hội nhóm Facebook bạn đã tham gia, rồi để AI lọc theo mục tiêu và chọn nhóm để rải bài.</p>
        </div>
        <div>
          {busy
            ? <Btn variant="danger" icon={IconPlayerStop} onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng</Btn>
            : <Btn variant="primary" icon={IconDownload} onClick={load}>Tải nhóm đã tham gia</Btn>}
        </div>
      </div>

      <Hint id="groups">
        **Bước 1:** Nhấn **Tải nhóm đã tham gia** để lấy danh sách hội nhóm trên tài khoản Facebook hiện tại. **Bước 2:** Nhập **mục tiêu** (vd: *nhóm rải link affiliate, nhóm tiếng Trung, nhóm về AI*) rồi bấm **Lọc theo mục tiêu** để AI chấm điểm & xếp hạng. Cuối cùng tick chọn nhóm tiềm năng và **Lưu Preset** làm nhóm mục tiêu.
      </Hint>

      {/* Bước 2: Lọc nhóm theo mục tiêu (AI) */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <IconFilter size={18} className="text-indigo-400" />
          <span>Lọc nhóm theo mục tiêu (AI)</span>
        </div>
        <p className="text-xs text-slate-500 leading-normal">Mô tả loại nhóm bạn muốn nhắm tới (cách nhau bởi dấu phẩy). AI sẽ chấm điểm ĐỘ KHỚP từng nhóm đã tải với mục tiêu này. Để trống = chấm theo sản phẩm trong Catalog.</p>
        <div className="flex gap-2.5">
          <Input placeholder="vd: nhóm rải link affiliate, nhóm tiếng Trung, nhóm về AI, hội mẹ bỉm…" value={goal}
            onChange={e => setGoal(e.target.value)} onKeyDown={e => e.key === 'Enter' && !busy && score()} />
          {scoring
            ? <Btn variant="danger" icon={IconPlayerStop} className="shrink-0" onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng</Btn>
            : <Btn variant="primary" icon={IconSparkles} className="shrink-0" disabled={!groups.length || loading} onClick={score}>Lọc theo mục tiêu</Btn>}
        </div>
        {!groups.length && <p className="text-xs text-amber-400">⚠️ Hãy bấm <b>Tải nhóm đã tham gia</b> ở góc trên trước khi lọc.</p>}
      </Card>


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
        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
          <span>Đồng bộ: <span className="font-semibold text-slate-350">{syncedAt}</span></span>
          <span>·</span>
          <Badge color="indigo">{groups.length} nhóm đã tải</Badge>
          <Input className="w-52 h-8 text-xs rounded-lg" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm nhóm theo tên / chủ đề…" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-slate-900/80 p-0.5 border border-slate-800">
            {FILTERS.map(f => (
              <button
                key={f.k}
                onClick={() => setFilter(f.k)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                  filter === f.k
                    ? 'bg-indigo-650 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>
          <Btn size="sm" icon={IconStarFilled} onClick={addGood} disabled={!groups.length} className="text-amber-400 hover:bg-amber-500/5 border border-amber-500/10">Chọn nhanh nhóm phù hợp</Btn>
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
            Chưa có dữ liệu nhóm. Hãy bấm nút <b>Tải nhóm đã tham gia</b> ở góc phải phía trên để lấy danh sách hội nhóm bạn đã vào.
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
                    {verdict(g.score) && <Badge color={verdict(g.score).color} className="text-[10px] px-1.5">{verdict(g.score).label}</Badge>}
                    {g.niche && <Badge color="indigo" className="text-[10px] px-1.5">{g.niche}</Badge>}
                    {g.url && (
                      <a href={g.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400 h-6 w-6 rounded-lg hover:bg-slate-800 flex items-center justify-center">
                        <IconExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {g.memberCount ? <span className="flex items-center gap-1"><IconUsersGroup size={11} className="text-slate-600" /> {g.memberCount.toLocaleString('vi')} thành viên</span> : null}
                    {g.reason && <><span>·</span><span className="text-slate-400 leading-normal max-w-2xl">{g.reason}</span></>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
