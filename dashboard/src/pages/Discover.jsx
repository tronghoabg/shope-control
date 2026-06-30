import { useState, useRef } from 'react'
import {
  IconSparkles, IconSearch, IconPlus, IconCheck, IconExternalLink, IconCompass,
  IconStarFilled, IconUsersPlus, IconPlayerStop, IconTarget,
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Badge, Input, Card, Empty, Spinner, Hint } from '../ui.jsx'
import { ext } from '../ext.js'

const scoreColor = (s) => s == null ? 'gray' : s >= 70 ? 'green' : s >= 40 ? 'yellow' : 'red'
const PACKS = ['thú cưng, hội nuôi mèo, hội nuôi chó', 'cây cảnh, yêu cây cảnh', 'cá cảnh, thủy sinh',
  'mẹ bỉm sữa, mẹ và bé', 'ô tô xe hơi, mua bán xe', 'mỹ phẩm, skincare', 'đồ gia dụng, nhà bếp',
  'thời trang, quần áo', 'đồ câu cá', 'phụ kiện điện thoại']
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function fmtMembers(n) {
  if (!n) return '? thành viên'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'tr thành viên'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k thành viên'
  return n + ' thành viên'
}

export default function Discover() {
  const { s, aiReady, call, notify, refresh } = useShope()
  const [keyword, setKeyword] = useState('')
  const [suggested, setSuggested] = useState([])
  const [suggesting, setSuggesting] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [joiningId, setJoiningId] = useState(null)
  const [bulk, setBulk] = useState(null)   // { done, total, current } khi đang join hàng loạt
  const [delay, setDelay] = useState(60)
  const stopRef = useRef(false)

  const results = s?.searchResults || []
  const joinable = results.filter(g => !g.joined)
  const targets = s?.cfg?.groupIds || []
  const targetSet = new Set(targets)
  const setTargets = (ids) => call({ type: 'SET_TARGETS', groupIds: [...new Set(ids)] })
  const joinedNotTargeted = results.filter(g => g.joined && !targetSet.has(g.groupId)).length

  const suggest = async () => {
    setSuggesting(true)
    const r = await call({ type: 'SUGGEST_NICHES' }, { errMsg: 'Gợi ý lỗi', timeout: 30000 })
    setSuggesting(false)
    if (r?.ok) setSuggested(r.keywords || [])
  }
  const search = async (kw) => {
    const q = (kw ?? keyword).trim()
    if (!q) return notify('red', 'Nhập từ khoá trước')
    setKeyword(q); setSearching(true); setSelected(new Set())
    await call({ type: 'SEARCH_GROUPS', keyword: q }, { okMsg: 'Đã tìm xong', errMsg: 'Tìm nhóm lỗi', timeout: 180000 })
    setSearching(false)
  }
  const join = async (g) => {
    setJoiningId(g.groupId)
    await call({ type: 'JOIN_GROUP', groupId: g.groupId }, { okMsg: `Đã tham gia ${g.name}`, errMsg: 'Tham gia lỗi', timeout: 30000 })
    setJoiningId(null)
  }

  const toggle = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n) }
  const selectGood = () => setSelected(new Set(joinable.filter(g => (g.score ?? 0) >= 70).map(g => g.groupId)))
  const selectAll = () => setSelected(new Set(joinable.map(g => g.groupId)))
  const clearSel = () => setSelected(new Set())

  // Tham gia hàng loạt — tuần tự, giãn cách ngẫu nhiên, có thể dừng
  const bulkJoin = async () => {
    const targets = joinable.filter(g => selected.has(g.groupId))
    if (!targets.length) return notify('red', 'Chưa chọn nhóm nào')
    if (targets.length > 20 && !confirm(`Tham gia ${targets.length} nhóm liên tục dễ bị Facebook chặn. Vẫn tiếp tục?`)) return
    stopRef.current = false
    setBulk({ done: 0, total: targets.length, current: '' })
    let ok = 0
    for (let i = 0; i < targets.length; i++) {
      if (stopRef.current) break
      const g = targets[i]
      setBulk({ done: i, total: targets.length, current: g.name })
      const r = await ext({ type: 'JOIN_GROUP', groupId: g.groupId }, 30000)
      if (r?.ok) { ok++; setSelected(prev => { const n = new Set(prev); n.delete(g.groupId); return n }) }
      await refresh()
      setBulk({ done: i + 1, total: targets.length, current: g.name })
      if (i < targets.length - 1 && !stopRef.current) {
        const wait = Math.round((delay + Math.random() * delay * 0.5) * 1000)   // delay → delay×1.5
        for (let t = 0; t < wait && !stopRef.current; t += 500) await sleep(500)
      }
    }
    setBulk(null)
    notify('green', `Đã tham gia ${ok}/${targets.length} nhóm`)
  }

  const selCount = [...selected].filter(id => joinable.some(g => g.groupId === id)).length

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Tham gia nhóm</h1>

      <Hint id="discover">
        Tìm nhóm đúng niche để rải link. <b>1)</b> Bấm <b>AI gợi ý từ khoá</b> (hoặc gõ từ khoá) → <b>Tìm</b>.
        {' '}<b>2)</b> Chọn nhóm điểm cao → <b>Tham gia</b> (tick nhiều nhóm → <b>Tham gia N nhóm</b> có giãn cách).
        {' '}<b>3)</b> Nhóm đã tham gia bấm <b>+ Mục tiêu</b> để tool rải link/comment vào đó.
      </Hint>

      {!aiReady && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300">
          Cần đăng nhập tài khoản để AI gợi ý &amp; chấm điểm nhóm.
        </div>
      )}

      {joinedNotTargeted > 0 && (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3 text-sm text-indigo-200">
          Bạn đã tham gia <b>{joinedNotTargeted}</b> nhóm chưa đặt mục tiêu. Bấm <b>+ Mục tiêu</b> ở nhóm để tool rải link/comment vào đó.
        </div>
      )}

      <Section title="Tìm nhóm theo niche"
        right={<Btn variant="default" icon={IconSparkles} loading={suggesting} disabled={!aiReady} onClick={suggest}>AI gợi ý từ khoá</Btn>}>
        <div className="flex gap-2">
          <Input placeholder="từ khoá, cách nhau dấu phẩy (vd: thú cưng, cá cảnh)" value={keyword}
            onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
          {searching
            ? <Btn variant="danger" icon={IconPlayerStop} className="shrink-0" onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng</Btn>
            : <Btn variant="primary" icon={IconSearch} className="shrink-0" onClick={() => search()}>Tìm</Btn>}
        </div>
        {suggested.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-slate-500">AI gợi ý — bấm để tìm:</div>
            <div className="flex flex-wrap gap-2">
              {suggested.map((k, i) => (
                <button key={i} onClick={() => search(k)} className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-500/20">{k}</button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3">
          <div className="mb-1 text-xs text-slate-500">Gói niche sẵn:</div>
          <div className="flex flex-wrap gap-2">
            {PACKS.map((k, i) => (
              <button key={i} onClick={() => search(k)} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700">{k.split(',')[0]}</button>
            ))}
          </div>
        </div>
      </Section>

      {/* Thanh tham gia hàng loạt */}
      {joinable.length > 0 && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <Badge color="green">{selCount} đã chọn</Badge>
          <Btn size="sm" icon={IconStarFilled} onClick={selectGood} disabled={!!bulk}>Chọn nhóm tốt (≥70đ)</Btn>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300">
            <input type="checkbox" disabled={!!bulk || !joinable.length}
              checked={joinable.length > 0 && joinable.every(g => selected.has(g.groupId))}
              onChange={() => (joinable.length && joinable.every(g => selected.has(g.groupId))) ? clearSel() : selectAll()}
              className="h-4 w-4 accent-indigo-500" />
            Chọn tất cả
          </label>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Giãn cách (giây)</span>
            <input type="number" min={20} value={delay} onChange={(e) => setDelay(+e.target.value)} disabled={!!bulk}
              className="w-16 rounded-lg border border-slate-700 bg-slate-800/70 px-2 py-1 text-sm text-slate-100" />
            {bulk
              ? <Btn size="sm" variant="danger" icon={IconPlayerStop} onClick={() => { stopRef.current = true }}>Dừng</Btn>
              : <Btn size="sm" variant="success" icon={IconUsersPlus} disabled={selCount === 0} onClick={bulkJoin}>Tham gia {selCount} nhóm</Btn>}
          </div>
          {bulk && (
            <div className="w-full">
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>Đang tham gia: {bulk.current}</span><span>{bulk.done}/{bulk.total}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(bulk.done / bulk.total) * 100}%` }} />
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        {searching ? (
          <Empty icon={Spinner}>Đang tìm &amp; chấm điểm nhóm…</Empty>
        ) : results.length === 0 ? (
          <Empty icon={IconCompass}>Chưa có kết quả. Gợi ý từ khoá hoặc nhập niche rồi bấm Tìm.</Empty>
        ) : (
          <div className="max-h-[34rem] divide-y divide-slate-800 overflow-y-auto">
            {results.map(g => {
              const selectable = !g.joined && !bulk
              return (
                <div key={g.groupId}
                  onClick={() => selectable && toggle(g.groupId)}
                  className={`flex items-center gap-3 p-3 hover:bg-slate-800/40 ${selectable ? 'cursor-pointer' : ''} ${selected.has(g.groupId) ? 'bg-indigo-500/10' : ''}`}>
                  {!g.joined && (
                    <input type="checkbox" checked={selected.has(g.groupId)} readOnly
                      className="pointer-events-none h-4 w-4 shrink-0 accent-indigo-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-slate-100">{g.name}</span>
                      <Badge color={scoreColor(g.score)}>{g.score == null ? '—' : `${g.score}đ`}</Badge>
                      {g.niche && <Badge color="indigo">{g.niche}</Badge>}
                      <a href={g.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400"><IconExternalLink size={14} /></a>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {fmtMembers(g.memberCount)} · {g.privacy === 'public' ? 'Công khai' : g.privacy === 'private' ? 'Riêng tư' : '—'}
                      {g.reason ? ` · ${g.reason}` : ''}
                    </div>
                  </div>
                  {g.joined ? (
                    <div className="flex items-center gap-2">
                      <Badge color="green"><IconCheck size={13} /> đã tham gia</Badge>
                      {targetSet.has(g.groupId)
                        ? <Btn size="sm" variant="success" icon={IconTarget} onClick={(e) => { e.stopPropagation(); setTargets(targets.filter(x => x !== g.groupId)) }}>✓ Mục tiêu</Btn>
                        : <Btn size="sm" icon={IconTarget} onClick={(e) => { e.stopPropagation(); setTargets([...targets, g.groupId]) }}>+ Mục tiêu</Btn>}
                    </div>
                  ) : (
                    <Btn size="sm" variant="primary" icon={IconPlus} loading={joiningId === g.groupId} disabled={!!bulk} onClick={(e) => { e.stopPropagation(); join(g) }}>Tham gia</Btn>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-500">⚠️ Tham gia nhiều nhóm liên tục dễ bị Facebook chặn. Nên ≤10–15 nhóm/ngày, giãn cách ≥40–60s mỗi nhóm. Giữ tab này mở khi tham gia hàng loạt.</p>
    </div>
  )
}
