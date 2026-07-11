import { useState, useRef } from 'react'
import {
  IconSparkles, IconSearch, IconPlus, IconCheck, IconExternalLink, IconCompass,
  IconStarFilled, IconUsersPlus, IconPlayerStop, IconTarget, IconUsers, IconChevronDown
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
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k'
  return n
}

export default function Discover() {
  const { s, aiReady, call, notify, account, refresh } = useShope()
  const [keyword, setKeyword] = useState('')
  const [suggested, setSuggested] = useState([])
  const [suggesting, setSuggesting] = useState(false)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
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
  const loadMore = async () => {
    setLoadingMore(true)
    await call({ type: 'SEARCH_GROUPS', more: true }, { errMsg: 'Tải thêm lỗi', timeout: 180000 })
    setLoadingMore(false)
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

  // Tham gia hàng loạt
  const bulkJoin = async () => {
    const targets = joinable.filter(g => selected.has(g.groupId))
    if (!targets.length) return notify('red', 'Chưa chọn nhóm nào')
    if (targets.length > 20 && !confirm(`Tham gia liên tục ${targets.length} nhóm dễ bị checkpoint Facebook. Bạn chắc chắn muốn tiếp tục?`)) return
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
        const wait = Math.round((delay + Math.random() * delay * 0.5) * 1000)
        for (let t = 0; t < wait && !stopRef.current; t += 500) await sleep(500)
      }
    }
    setBulk(null)
    notify('green', `Đã gửi yêu cầu tham gia thành công ${ok}/${targets.length} nhóm`)
  }

  const selCount = [...selected].filter(id => joinable.some(g => g.groupId === id)).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Tìm kiếm nhóm mục tiêu</h1>
          <p className="text-sm text-slate-400">Khám phá các hội nhóm Facebook thuộc phân khúc ngách (niche) phù hợp với sản phẩm của bạn.</p>
        </div>
      </div>

      <Hint id="discover">
        Tìm nhóm đúng phân khúc để tăng tỷ lệ chuyển đổi. Bấm **AI gợi ý từ khóa** hoặc gõ chủ đề bất kỳ, sau đó tick chọn nhóm điểm cao để gửi yêu cầu **Tham gia** tự động hàng loạt có giãn cách an toàn.
      </Hint>

      {!aiReady && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs text-amber-400">
          ⚠️ Hãy <b>Đăng nhập tài khoản</b> để sử dụng AI gợi ý từ khóa và tự động phân tích chấm điểm tiềm năng nhóm.
        </div>
      )}

      {joinedNotTargeted > 0 && (
        <div className="rounded-xl border border-indigo-550/20 bg-indigo-550/[0.04] p-4 text-xs text-indigo-300 flex items-center justify-between gap-3">
          <span>Bạn có <b>{joinedNotTargeted}</b> nhóm đã tham gia nhưng chưa được chọn làm mục tiêu chiến dịch.</span>
          <Btn size="sm" onClick={() => search(keyword)}>Hiển thị danh sách</Btn>
        </div>
      )}

      <Section title="Khám phá hội nhóm theo chủ đề"
        right={<Btn variant="ghost" icon={IconSparkles} loading={suggesting} className="text-amber-400 hover:bg-amber-500/10 border border-amber-500/20" onClick={() => {
          if (!account?.loggedIn) return notify('red', 'Vui lòng đăng nhập tài khoản hệ thống để sử dụng AI gợi ý')
          suggest()
        }}>AI gợi ý từ khóa</Btn>}>
        <div className="flex gap-2.5">
          <Input placeholder="Nhập các chủ đề cách nhau bởi dấu phẩy (vd: phụ kiện điện thoại, đồ gia dụng…)" value={keyword}
            onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
          {searching
            ? <Btn variant="danger" icon={IconPlayerStop} className="shrink-0" onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng</Btn>
            : <Btn variant="primary" icon={IconSearch} className="shrink-0" onClick={() => search()}>Tìm kiếm</Btn>}
        </div>
        
        {suggested.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-850">
            <div className="mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI gợi ý (Click để tìm):</div>
            <div className="flex flex-wrap gap-2">
              {suggested.map((k, i) => (
                <button key={i} onClick={() => search(k)} className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-all">{k}</button>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-4 pt-3 border-t border-slate-850">
          <div className="mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gói Niche có sẵn:</div>
          <div className="flex flex-wrap gap-2">
            {PACKS.map((k, i) => (
              <button key={i} onClick={() => search(k)} className="rounded-full border border-slate-800 bg-slate-900/40 hover:border-slate-700/60 px-3 py-1 text-xs text-slate-350 hover:bg-slate-900/80 transition-all">{k.split(',')[0]}</button>
            ))}
          </div>
        </div>
      </Section>

      {/* Bulk action deck */}
      {joinable.length > 0 && (
        <Card className="flex flex-wrap items-center gap-4 p-4 border border-indigo-500/10 bg-slate-900/10">
          <div className="flex items-center gap-2">
            <Badge color="green">{selCount} nhóm đã chọn</Badge>
            <Btn size="sm" icon={IconStarFilled} onClick={selectGood} disabled={!!bulk} className="text-amber-400 hover:bg-amber-500/5 border border-amber-500/10">Chọn nhóm tốt (≥70đ)</Btn>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/20 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900/30">
              <input type="checkbox" disabled={!!bulk || !joinable.length}
                checked={joinable.length > 0 && joinable.every(g => selected.has(g.groupId))}
                onChange={() => (joinable.length && joinable.every(g => selected.has(g.groupId))) ? clearSel() : selectAll()}
                className="h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800" />
              <span>Chọn tất cả</span>
            </label>
          </div>
          
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold">Giãn cách (giây)</span>
            <input type="number" min={20} value={delay} onChange={(e) => setDelay(+e.target.value)} disabled={!!bulk}
              className="w-20 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-bold text-slate-100 outline-none focus:border-indigo-500" />
            {bulk
              ? <Btn size="sm" variant="danger" icon={IconPlayerStop} onClick={() => { stopRef.current = true }}>Dừng gửi</Btn>
              : <Btn size="sm" variant="success" icon={IconUsersPlus} disabled={selCount === 0} onClick={bulkJoin}>Tham gia nhóm hàng loạt</Btn>}
          </div>

          {bulk && (
            <div className="w-full pt-2">
              <div className="mb-2 flex justify-between text-xs font-semibold text-slate-400">
                <span className="truncate pr-4">Đang gửi yêu cầu vào nhóm: {bulk.current}</span>
                <span className="font-mono">{bulk.done} / {bulk.total}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-900">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-300" style={{ width: `${(bulk.done / bulk.total) * 100}%` }} />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Results grid */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-850 px-5 py-4 flex items-center justify-between bg-slate-900/20">
          <h3 className="font-bold text-slate-200 text-sm">Kết quả tìm kiếm nhóm ({results.length})</h3>
        </div>

        {searching ? (
          <Empty icon={Spinner}>Hệ thống đang quét danh sách nhóm và sử dụng AI để đánh giá chấm điểm tiềm năng…</Empty>
        ) : results.length === 0 ? (
          <Empty icon={IconCompass}>Chưa có kết quả tìm kiếm nào. Vui lòng nhập từ khóa chủ đề và nhấn Tìm kiếm để khám phá.</Empty>
        ) : (
          <div className="max-h-[32rem] divide-y divide-slate-850 overflow-y-auto">
            {results.map(g => {
              const selectable = !g.joined && !bulk
              return (
                <div key={g.groupId}
                  onClick={() => selectable && toggle(g.groupId)}
                  className={`flex items-center gap-4 p-4 hover:bg-slate-900/30 transition-colors ${selectable ? 'cursor-pointer' : ''} ${selected.has(g.groupId) ? 'bg-indigo-500/[0.03]' : ''}`}>
                  {!g.joined ? (
                    <input type="checkbox" checked={selected.has(g.groupId)} readOnly
                      className="pointer-events-none h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800 shrink-0" />
                  ) : (
                    <div className="h-4.5 w-4.5 shrink-0" /> // spacer
                  )}
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-205 text-xs truncate max-w-sm sm:max-w-md">{g.name}</span>
                      <Badge color={scoreColor(g.score)} className="text-[10px] px-1.5">{g.score == null ? 'Chờ chấm' : `${g.score}đ`}</Badge>
                      {g.niche && <Badge color="indigo" className="text-[10px] px-1.5">{g.niche}</Badge>}
                      {g.url && (
                        <a href={g.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400 h-6 w-6 rounded-lg hover:bg-slate-800 flex items-center justify-center">
                          <IconExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="flex items-center gap-1"><IconUsers size={11} className="inline text-slate-600" /> {fmtMembers(g.memberCount)} thành viên</span>
                      <span>·</span>
                      <span>{g.privacy === 'public' ? 'Nhóm công khai' : g.privacy === 'private' ? 'Nhóm riêng tư' : '—'}</span>
                      {g.reason && (
                        <>
                          <span>·</span>
                          <span className="text-slate-400 truncate max-w-xs">{g.reason}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="shrink-0">
                    {g.joined ? (
                      <div className="flex items-center gap-2">
                        <Badge color="green" className="text-[10px] py-1 px-2.5">Đã gia nhập</Badge>
                        {targetSet.has(g.groupId)
                          ? <Btn size="sm" variant="success" icon={IconTarget} onClick={(e) => { e.stopPropagation(); setTargets(targets.filter(x => x !== g.groupId)) }}>Mục tiêu</Btn>
                          : <Btn size="sm" icon={IconTarget} onClick={(e) => { e.stopPropagation(); setTargets([...targets, g.groupId]) }}>+ Mục tiêu</Btn>}
                      </div>
                    ) : (
                      <Btn size="sm" variant="primary" icon={IconPlus} loading={joiningId === g.groupId} disabled={!!bulk} onClick={(e) => { e.stopPropagation(); join(g) }}>Gia nhập</Btn>
                    )}
                  </div>
                </div>
              )
            })}
            {s?.searchHasMore && (
              <div className="p-4 flex justify-center bg-slate-900/10">
                <Btn variant="ghost" icon={IconChevronDown} loading={loadingMore} disabled={!!bulk} onClick={loadMore}
                  className="border border-slate-800 hover:bg-slate-900/60">
                  Tải thêm kết quả
                </Btn>
              </div>
            )}
          </div>
        )}
      </Card>
      
      <p className="text-[10px] text-slate-500 leading-normal bg-slate-950/20 border border-slate-900 p-3 rounded-xl">
        ⚠️ <b>Mẹo vận hành an toàn:</b> Tránh tham gia quá nhiều nhóm trong thời gian ngắn để bảo vệ tài khoản Facebook. Khuyến nghị chỉ tham gia $\le$ 10-15 nhóm mỗi ngày và đặt thời gian giãn cách ngẫu nhiên từ 45-60 giây.
      </p>
    </div>
  )
}
