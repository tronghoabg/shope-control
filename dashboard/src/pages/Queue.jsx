import { useState, useEffect, useRef } from 'react'
import {
  IconDeviceFloppy, IconSend, IconTrash, IconExternalLink, IconListCheck, IconRadar,
  IconChevronDown, IconBookmark, IconPlayerPlay, IconPlayerStop, IconHandStop, IconUsersGroup, IconSettings, IconBolt,
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Btn, Badge, Field, Input, Textarea, Toggle, Card, Empty } from '../ui.jsx'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const MIN_DELAY = 90   // an toàn checkpoint: không cho nhanh hơn 90s
const NUM = [
  { k: 'dailyCap', l: 'Cap/ngày', min: 1 }, { k: 'minDelaySec', l: 'Delay min (s) · ≥90', min: MIN_DELAY },
  { k: 'maxDelaySec', l: 'Delay max (s)', min: MIN_DELAY }, { k: 'minScore', l: 'Ngưỡng điểm bài', min: 0 },
  { k: 'postsPerScan', l: 'Số bài/nhóm mỗi lần tìm', min: 1 },
]
const KINDS = [
  { k: 'social', t: 'Comment dạo', d: 'Comment tự nhiên, không link' },
  { k: 'shopee', t: 'Rải link · Shopee', d: 'AI tự tìm SP Shopee + link hoa hồng' },
  { k: 'catalog', t: 'Rải link · Catalog', d: 'Dùng SP + link trong Catalog' },
]

function QueueItem({ it, onAct, selected, onSel }) {
  const [comment, setComment] = useState(it.comment || '')
  const dirty = comment !== it.comment
  return (
    <Card className={`p-4 ${selected ? 'border-indigo-500/60 bg-indigo-500/[0.06]' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={selected} onChange={() => onSel(it.postId)} className="h-4 w-4 accent-indigo-500" />
        <Badge color="yellow">điểm {it.score}</Badge>
        {it.productName && <Badge color="blue">{it.productName}</Badge>}
        {it.link && <Badge color="indigo">có link</Badge>}
        {it.permalink && <a href={it.permalink} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline"><IconExternalLink size={13} /> xem bài</a>}
      </div>
      <p className="mb-2 line-clamp-2 text-xs text-slate-500">📄 {it.text || '(không có nội dung)'}</p>
      <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        {dirty && <Btn size="sm" icon={IconDeviceFloppy} onClick={() => onAct('EDIT_ITEM', it.postId, { comment })}>Lưu sửa</Btn>}
        <Btn size="sm" variant="primary" icon={IconSend} onClick={() => onAct('POST_ITEM', it.postId, null, 60000)}>Đăng bài này</Btn>
        <Btn size="sm" variant="ghost" icon={IconTrash} className="text-red-400" onClick={() => onAct('REJECT_ITEM', it.postId)}>Bỏ</Btn>
      </div>
    </Card>
  )
}

export default function Queue() {
  const { s, call, setCfg, notify, refresh } = useShope()
  const [cfgL, setLocal] = useState(null)
  const [panel, setPanel] = useState(null) // 'groups' | 'adv' | 'auto' | null
  const [sel, setSel] = useState(() => new Set())
  const [scanning, setScanning] = useState(false)
  const [posting, setPosting] = useState(false)
  const [pstat, setPstat] = useState({ done: 0, total: 0, wait: 0 })
  const [listName, setListName] = useState('')
  const stopRef = useRef(false)

  useEffect(() => { if (s?.cfg && !cfgL) setLocal(s.cfg) }, [s, cfgL])
  if (!s || !cfgL) return <p className="text-slate-500">Đang tải…</p>

  const cfg = s.cfg
  const queue = s.queue || []
  const mode = cfg.mode || 'affiliate'
  const source = cfg.productSource || 'catalog'
  const kind = mode === 'social' ? 'social' : (source === 'shopee' ? 'shopee' : 'catalog')
  const postLabel = kind === 'social' ? 'Đăng comment' : 'Rải link'
  const running = cfg.autoEnabled && !cfg.killSwitch
  const togglePanel = (p) => setPanel(cur => cur === p ? null : p)

  const setKind = (k) => { if (k === 'social') setCfg({ mode: 'social' }); else setCfg({ mode: 'affiliate', productSource: k === 'shopee' ? 'shopee' : 'catalog' }) }
  const setNum = (k) => (e) => setLocal({ ...cfgL, [k]: +e.target.value })
  const saveAdv = () => {
    const minD = Math.max(MIN_DELAY, cfgL.minDelaySec || MIN_DELAY)   // ép sàn 90s
    const maxD = Math.max(minD, cfgL.maxDelaySec || minD)
    setLocal({ ...cfgL, minDelaySec: minD, maxDelaySec: maxD })
    setCfg({ dailyCap: cfgL.dailyCap, minDelaySec: minD, maxDelaySec: maxD, minScore: cfgL.minScore, postsPerScan: cfgL.postsPerScan, requireApproval: cfgL.requireApproval, subId: cfgL.subId, shopeeLimit: cfgL.shopeeLimit, shopeeFocusTab: cfgL.shopeeFocusTab })
    if ((cfgL.minDelaySec || 0) < MIN_DELAY) notify('blue', `Delay tối thiểu 90s (an toàn) — đã đặt về ${minD}s`)
  }
  const act = (type, postId, extra, timeout) => call({ type, postId, ...(extra || {}) }, { timeout })

  const targets = cfg.groupIds || []
  const targetSet = new Set(targets)
  const poolMap = new Map()
  for (const g of (s.discoveredGroups || [])) poolMap.set(g.groupId, { id: g.groupId, name: g.name, score: g.score })
  for (const g of (s.searchResults || [])) if (!poolMap.has(g.groupId)) poolMap.set(g.groupId, { id: g.groupId, name: g.name, score: g.score })
  for (const id of targets) if (!poolMap.has(id)) poolMap.set(id, { id, name: id })
  const pool = [...poolMap.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const nGroups = targets.length
  const savedLists = s.savedGroupLists || []

  const saveTargets = (ids) => call({ type: 'SET_TARGETS', groupIds: [...new Set(ids)] })
  const toggleTarget = (id) => saveTargets(targetSet.has(id) ? targets.filter(x => x !== id) : [...targets, id])
  const applyList = (l) => call({ type: 'SET_TARGETS', groupIds: l.groupIds }, { okMsg: `Đã chọn "${l.name}" (${l.groupIds.length} nhóm)` })
  const allPoolSelected = pool.length > 0 && pool.every(g => targetSet.has(g.id))
  const togglePoolAll = () => saveTargets(allPoolSelected ? [] : pool.map(g => g.id))
  const saveList = async () => {
    if (!nGroups) return notify('red', 'Chưa chọn nhóm nào')
    const n = listName.trim() || `Danh sách ${new Date().toLocaleDateString('vi')}`
    await call({ type: 'SAVE_GROUP_LIST', name: n, groupIds: targets }, { okMsg: `Đã lưu "${n}"` }); setListName('')
  }

  const findPosts = async () => {
    if (!nGroups) return notify('red', 'Chọn ít nhất 1 nhóm mục tiêu')
    setScanning(true)
    await call({ type: 'SCAN_NOW' }, { okMsg: 'Đã tìm xong', errMsg: 'Tìm bài lỗi', timeout: 240000 })
    setScanning(false)
  }

  const toggleSel = (postId) => setSel(p => { const n = new Set(p); n.has(postId) ? n.delete(postId) : n.add(postId); return n })
  const allSelected = queue.length > 0 && queue.every(q => sel.has(q.postId))
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(queue.map(q => q.postId)))
  const selCount = queue.filter(q => sel.has(q.postId)).length

  const bulkPost = async () => {
    const ids = queue.filter(q => sel.has(q.postId)).map(q => q.postId)
    if (!ids.length) return notify('red', 'Chưa chọn bài nào')
    setPosting(true); stopRef.current = false; setPstat({ done: 0, total: ids.length, wait: 0 })
    let ok = 0, fail = 0
    for (let i = 0; i < ids.length; i++) {
      if (stopRef.current) break
      let r
      try { r = await ext({ type: 'POST_ITEM', postId: ids[i] }, 60000) } catch (e) { r = { ok: false, error: String(e?.message || e) } }
      if (r?.quotaBlocked) { notify('red', r.error || 'Hết hạn mức hôm nay'); break }
      if (r?.ok) ok++; else fail++
      setSel(prev => { const n = new Set(prev); n.delete(ids[i]); return n })
      setPstat(p => ({ ...p, done: i + 1 })); refresh()
      if (i < ids.length - 1 && !stopRef.current) {
        const lo = Math.max(MIN_DELAY, Math.min(cfg.minDelaySec, cfg.maxDelaySec)), hi = Math.max(lo, Math.max(cfg.minDelaySec, cfg.maxDelaySec))
        let secs = lo + Math.floor(Math.random() * (hi - lo + 1))
        for (; secs > 0 && !stopRef.current; secs--) { setPstat(p => ({ ...p, wait: secs })); await sleep(1000) }
      }
    }
    setPosting(false); setPstat({ done: 0, total: 0, wait: 0 })
    notify(fail ? 'blue' : 'green', `Đã đăng ${ok}/${ids.length} bài`)
  }

  const kindDesc = KINDS.find(k => k.k === kind)?.d

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-100">Comment dạo / Rải link</h1>
        <div className="flex items-center gap-2 text-sm">
          <Badge color={cfg.killSwitch ? 'red' : running ? 'green' : 'gray'}>{cfg.killSwitch ? 'KILL' : running ? 'Auto đang chạy' : 'Auto tắt'}</Badge>
          <span className="text-slate-400">{s.state.doneToday}/{cfg.dailyCap} hôm nay</span>
        </div>
      </div>

      {/* ───── THANH CÔNG CỤ ───── */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Nhóm */}
          <button onClick={() => togglePanel('groups')} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${panel === 'groups' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200' : 'border-slate-700 text-slate-200 hover:border-slate-600'}`}>
            <IconUsersGroup size={16} /> {nGroups} nhóm mục tiêu <IconChevronDown size={14} className={panel === 'groups' ? 'rotate-180' : ''} />
          </button>

          {/* Kiểu đăng — segmented */}
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
            {KINDS.map(m => (
              <button key={m.k} onClick={() => setKind(m.k)} title={m.d}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${kind === m.k ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}>{m.t}</button>
            ))}
          </div>

          {scanning
            ? <Btn variant="danger" icon={IconPlayerStop} onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng quét…') }} className="ml-auto">Dừng quét</Btn>
            : <Btn variant="primary" icon={IconRadar} disabled={!nGroups || posting} onClick={findPosts} className="ml-auto">Tìm bài tiềm năng</Btn>}
          <button onClick={() => togglePanel('adv')} title="Cấu hình nâng cao" className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors ${panel === 'adv' ? 'border-indigo-500 text-indigo-300' : 'border-slate-700 text-slate-400 hover:text-white'}`}><IconSettings size={16} /></button>
          <button onClick={() => togglePanel('auto')} title="Tự động (Auto)" className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors ${panel === 'auto' ? 'border-indigo-500 text-indigo-300' : running ? 'border-emerald-600 text-emerald-400' : 'border-slate-700 text-slate-400 hover:text-white'}`}><IconBolt size={16} /></button>
        </div>
        <div className="text-xs text-slate-500">{kindDesc}{kind === 'shopee' && ' — mở sẵn tab shopee.vn + affiliate.shopee.vn (đã đăng nhập).'}{kind === 'catalog' && ' — nạp SP + link ở trang Catalog.'}</div>

        {kind === 'social' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="mb-1.5 text-sm font-medium text-slate-200">Nội dung tìm khách <span className="text-xs font-normal text-slate-500">(tuỳ chọn — AI sẽ viết lại khác nhau mỗi bài để tránh trùng)</span></div>
            <Textarea rows={3} value={cfgL.seedContent || ''} onChange={e => setLocal({ ...cfgL, seedContent: e.target.value })}
              onBlur={() => setCfg({ seedContent: cfgL.seedContent || '' })}
              placeholder={'Ví dụ: Bên em chuyên sỉ/lẻ cây cảnh mini giá tốt, ai cần ib em tư vấn nhé. Zalo 09xxx.\n\nĐể trống = AI tự soạn comment hợp từng bài.'} />
            <p className="mt-1 text-xs text-slate-500">Có nội dung → AI biến tấu lời mời của bạn cho từng bài. Để trống → AI bình luận tự nhiên theo nội dung bài.</p>
          </div>
        )}

        {/* Panel: chọn nhóm */}
        {panel === 'groups' && (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            {savedLists.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">Danh sách đã lưu:</span>
                {savedLists.map(l => {
                  const active = l.groupIds.length > 0 && l.groupIds.every(id => targetSet.has(id)) && l.groupIds.length === nGroups
                  return <button key={l.id} onClick={() => applyList(l)} className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200' : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-indigo-500'}`}>{l.name} <span className="text-slate-500">({l.groupIds.length})</span></button>
                })}
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-200">
              <input type="checkbox" checked={allPoolSelected} disabled={!pool.length} onChange={togglePoolAll} className="h-4 w-4 accent-indigo-500" /> Chọn tất cả ({nGroups}/{pool.length})
            </label>
            {pool.length === 0
              ? <Empty icon={IconListCheck}>Chưa có nhóm. Sang <b>Nhóm của tôi</b> để quét & chọn.</Empty>
              : <div className="grid max-h-60 gap-px overflow-y-auto rounded-lg border border-slate-800 sm:grid-cols-2">
                {pool.map(g => (
                  <div key={g.id} onClick={() => toggleTarget(g.id)} className={`flex cursor-pointer items-center gap-2.5 p-2 hover:bg-slate-800/40 ${targetSet.has(g.id) ? 'bg-indigo-500/10' : 'bg-slate-900/30'}`}>
                    <input type="checkbox" checked={targetSet.has(g.id)} readOnly className="pointer-events-none h-4 w-4 accent-indigo-500" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{g.name}</span>
                    {g.score != null && <Badge color={g.score >= 70 ? 'green' : g.score >= 40 ? 'yellow' : 'gray'}>{g.score}đ</Badge>}
                  </div>
                ))}
              </div>}
            <div className="flex items-center gap-2">
              <Input className="flex-1" value={listName} onChange={e => setListName(e.target.value)} placeholder="tên danh sách để lưu" />
              <Btn size="sm" variant="ghost" icon={IconBookmark} onClick={saveList} disabled={!nGroups}>Lưu danh sách</Btn>
            </div>
          </div>
        )}

        {/* Panel: nâng cao */}
        {panel === 'adv' && (
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {NUM.map(f => <Field key={f.k} label={f.l}><Input type="number" min={f.min} value={cfgL[f.k]} onChange={setNum(f.k)} /></Field>)}
              {kind === 'shopee' && <Field label="Số SP/lần tìm"><Input type="number" value={cfgL.shopeeLimit ?? 10} onChange={e => setLocal({ ...cfgL, shopeeLimit: +e.target.value })} /></Field>}
              {kind === 'shopee' && <Field label="sub_id"><Input value={cfgL.subId || ''} onChange={e => setLocal({ ...cfgL, subId: e.target.value })} placeholder="vd: fbauto-sub2" /></Field>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Toggle checked={cfgL.requireApproval !== false} onChange={(v) => setLocal({ ...cfgL, requireApproval: v })} label="Duyệt tay trước khi đăng" />
              <Btn variant="primary" icon={IconDeviceFloppy} onClick={saveAdv}>Lưu cấu hình</Btn>
            </div>
          </div>
        )}

        {/* Panel: auto */}
        {panel === 'auto' && (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <p className="text-sm text-slate-400">Auto tự tìm bài & đăng theo giãn cách, không cần bấm tay. Hôm nay {s.state.doneToday}/{cfg.dailyCap} · Tổng {s.stats.totalCommented}.</p>
            <div className="flex flex-wrap gap-2">
              <Btn variant="success" icon={IconPlayerPlay} disabled={running} onClick={() => call({ type: 'START_AUTO' }, { okMsg: 'Đã bật Auto', errMsg: 'Không bật được' })}>Bật Auto</Btn>
              <Btn icon={IconPlayerStop} onClick={() => call({ type: 'STOP_AUTO' }, { okMsg: 'Đã tắt' })}>Tắt</Btn>
              <Btn variant="danger" icon={IconHandStop} onClick={() => call({ type: 'KILL' }, { okMsg: 'Đã DỪNG NGAY' })}>DỪNG NGAY</Btn>
              <Btn variant="ghost" icon={IconTrash} className="ml-auto text-red-400" onClick={() => call({ type: 'RESET_HISTORY' }, { okMsg: 'Đã xoá lịch sử' })}>Xoá lịch sử</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* ───── KẾT QUẢ ───── */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!queue.length} className="h-4 w-4 accent-indigo-500" />
          <h2 className="font-semibold text-slate-100">Bài tìm được</h2>
          <span className="text-xs text-slate-500">{queue.length} bài{selCount ? ` · chọn ${selCount}` : ''}</span>
          <div className="ml-auto">
            {posting
              ? <Btn size="sm" variant="danger" icon={IconPlayerStop} onClick={() => { stopRef.current = true; notify('blue', 'Đang dừng…') }}>Dừng {pstat.done}/{pstat.total}{pstat.wait ? ` (${pstat.wait}s)` : ''}</Btn>
              : <Btn size="sm" variant="success" icon={IconSend} disabled={!selCount} onClick={bulkPost}>{postLabel} ({selCount})</Btn>}
          </div>
        </div>
        <div className="p-3">
          {queue.length === 0
            ? <Empty icon={IconListCheck}>Chưa có bài. Chọn nhóm & kiểu đăng ở trên rồi bấm <b>Tìm bài tiềm năng</b>.</Empty>
            : <div className="grid gap-3 xl:grid-cols-2">{queue.map(it => <QueueItem key={it.postId} it={it} onAct={act} selected={sel.has(it.postId)} onSel={toggleSel} />)}</div>}
        </div>
      </Card>
    </div>
  )
}
