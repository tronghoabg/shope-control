import { useState, useEffect, useMemo } from 'react'
import {
  IconUsersGroup, IconRadar, IconPlayerStop, IconBookmark, IconTarget, IconExternalLink,
  IconSend, IconHistory, IconDeviceFloppy, IconPlayerPlay, IconHandStop, IconTrash, IconSparkles,
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Field, Input, Textarea, Toggle, Empty, Hint } from '../ui.jsx'
import { QueueItem, usePoster, MIN_DELAY } from '../commentShared.jsx'
import { LogFeed } from '../LogPanel.jsx'

const KINDS = [
  { k: 'social', t: 'Comment dạo', d: 'Comment tự nhiên, không link' },
  { k: 'shopee', t: 'Rải link · Shopee', d: 'AI tự tìm SP Shopee + link hoa hồng' },
  { k: 'catalog', t: 'Rải link · Catalog', d: 'Dùng SP + link trong Catalog' },
]
const NUM = [
  { k: 'dailyCap', l: 'Cap/ngày', min: 1 }, { k: 'minDelaySec', l: 'Delay min (s)·≥90', min: MIN_DELAY },
  { k: 'maxDelaySec', l: 'Delay max (s)', min: MIN_DELAY }, { k: 'minScore', l: 'Ngưỡng điểm', min: 0 },
  { k: 'postsPerScan', l: 'Số bài/nhóm', min: 1 },
]
const scoreColor = (n) => n == null ? 'gray' : n >= 70 ? 'green' : n >= 40 ? 'yellow' : 'gray'

export default function CommentGroups() {
  const { s, call, setCfg, notify } = useShope()
  const { posting, pstat, post, stop } = usePoster()
  const [cfgL, setLocal] = useState(null)
  const [sel, setSel] = useState(() => new Set())
  const [scanning, setScanning] = useState(false)
  const [listName, setListName] = useState('')

  const pool = useMemo(() => {
    const m = new Map()
    for (const g of (s?.discoveredGroups || [])) m.set(g.groupId, { id: g.groupId, name: g.name, score: g.score, icon: g.icon, url: g.url })
    for (const g of (s?.searchResults || [])) if (!m.has(g.groupId)) m.set(g.groupId, { id: g.groupId, name: g.name, score: g.score, url: g.url })
    for (const id of (s?.cfg?.groupIds || [])) if (!m.has(id)) m.set(id, { id, name: id })
    return [...m.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  }, [s?.discoveredGroups, s?.searchResults, s?.cfg?.groupIds])

  useEffect(() => { if (s?.cfg && !cfgL) setLocal(s.cfg) }, [s, cfgL])
  if (!s || !cfgL) return <p className="text-slate-500">Đang tải…</p>

  const cfg = s.cfg
  const queue = (s.queue || []).filter(q => !q.isPage)
  const mode = cfg.mode || 'affiliate'
  const source = cfg.productSource || 'catalog'
  const kind = mode === 'social' ? 'social' : (source === 'shopee' ? 'shopee' : 'catalog')
  const postLabel = kind === 'social' ? 'Đăng comment' : 'Rải link'
  const running = cfg.autoEnabled && !cfg.killSwitch
  const setKind = (k) => { if (k === 'social') setCfg({ mode: 'social' }); else setCfg({ mode: 'affiliate', productSource: k === 'shopee' ? 'shopee' : 'catalog' }) }
  const setNum = (k) => (e) => setLocal({ ...cfgL, [k]: +e.target.value })
  const saveAdv = () => {
    const minD = Math.max(MIN_DELAY, cfgL.minDelaySec || MIN_DELAY)
    const maxD = Math.max(minD, cfgL.maxDelaySec || minD)
    setLocal({ ...cfgL, minDelaySec: minD, maxDelaySec: maxD })
    setCfg({ dailyCap: cfgL.dailyCap, minDelaySec: minD, maxDelaySec: maxD, minScore: cfgL.minScore, postsPerScan: cfgL.postsPerScan, requireApproval: cfgL.requireApproval, subId: cfgL.subId })
    notify('green', 'Đã lưu cấu hình')
  }
  const act = (type, postId, extra, timeout) => call({ type, postId, ...(extra || {}) }, { timeout })

  // ── Nhóm mục tiêu (chọn = lưu vào cfg.groupIds để SCAN_NOW dùng) ──
  const targets = cfg.groupIds || []
  const targetSet = new Set(targets)
  const nGroups = targets.length
  const savedLists = s.savedGroupLists || []
  const saveTargets = (ids) => call({ type: 'SET_TARGETS', groupIds: [...new Set(ids)] })
  const toggleTarget = (id) => saveTargets(targetSet.has(id) ? targets.filter(x => x !== id) : [...targets, id])
  const applyList = (l) => call({ type: 'SET_TARGETS', groupIds: l.groupIds }, { okMsg: `Đã chọn "${l.name}" (${l.groupIds.length} nhóm)` })
  const allSel = pool.length > 0 && pool.every(g => targetSet.has(g.id))
  const toggleAllPool = () => saveTargets(allSel ? [] : pool.map(g => g.id))
  const saveList = async () => {
    if (!nGroups) return notify('red', 'Chưa chọn nhóm nào')
    const n = listName.trim() || `Danh sách ${new Date().toLocaleDateString('vi')}`
    await call({ type: 'SAVE_GROUP_LIST', name: n, groupIds: targets }, { okMsg: `Đã lưu "${n}"` }); setListName('')
  }

  const start = async () => {
    if (!nGroups) return notify('red', 'Chọn ít nhất 1 nhóm mục tiêu')
    setScanning(true)
    await call({ type: 'SCAN_NOW' }, { okMsg: 'Đã tìm xong', errMsg: 'Tìm bài lỗi', timeout: 240000 })
    setScanning(false)
  }

  // queue select
  const toggleSel = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allQSel = queue.length > 0 && queue.every(q => sel.has(q.postId))
  const toggleAllQ = () => setSel(allQSel ? new Set() : new Set(queue.map(q => q.postId)))
  const selCount = queue.filter(q => sel.has(q.postId)).length
  const bulkPost = () => post(queue.filter(q => sel.has(q.postId)).map(q => q.postId), (id) => setSel(p => { const n = new Set(p); n.delete(id); return n }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-100">Comment Nhóm</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{s.state.doneToday}/{cfg.dailyCap} hôm nay</span>
          {scanning
            ? <Btn variant="danger" icon={IconPlayerStop} onClick={() => { ext({ type: 'CANCEL_RUN' }); notify('blue', 'Đang dừng…') }}>Dừng</Btn>
            : <Btn variant="primary" icon={IconRadar} disabled={!nGroups || posting} onClick={start}>Tìm bài tiềm năng ({nGroups} nhóm)</Btn>}
        </div>
      </div>

      <Hint id="cmtgroups">
        <b>1)</b> Chọn nhóm mục tiêu (tick thủ công bên phải, hoặc bấm 1 <b>danh sách đã lưu</b>).
        {' '}<b>2)</b> Bấm <b>Tìm bài tiềm năng</b> → AI quét bài & soạn comment.
        {' '}<b>3)</b> Tick bài ở dưới → <b>{postLabel}</b>.
      </Hint>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Cấu hình ── */}
        <Card className="space-y-4 p-4">
          <div>
            <div className="mb-1.5 text-sm font-medium text-slate-300">Kiểu đăng</div>
            <div className="inline-flex flex-wrap rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {KINDS.map(m => (
                <button key={m.k} onClick={() => setKind(m.k)} title={m.d}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${kind === m.k ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}>{m.t}</button>
              ))}
            </div>
          </div>

          {kind === 'social' && (
            <Field label="Nội dung tìm khách (tuỳ chọn)" hint="AI biến tấu khác nhau mỗi bài. Để trống = AI tự soạn theo bài.">
              <Textarea rows={3} value={cfgL.seedContent || ''} onChange={e => setLocal({ ...cfgL, seedContent: e.target.value })}
                onBlur={() => setCfg({ seedContent: cfgL.seedContent || '' })}
                placeholder={'Vd: Bên em chuyên sỉ/lẻ cây cảnh mini giá tốt, ai cần ib em tư vấn nhé.'} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {NUM.map(f => <Field key={f.k} label={f.l}><Input type="number" min={f.min} value={cfgL[f.k]} onChange={setNum(f.k)} /></Field>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Toggle checked={cfgL.requireApproval !== false} onChange={(v) => setLocal({ ...cfgL, requireApproval: v })} label="Duyệt tay trước khi đăng" />
            <Btn size="sm" variant="primary" icon={IconDeviceFloppy} onClick={saveAdv}>Lưu cấu hình</Btn>
          </div>

          {/* Auto */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <IconSparkles size={16} className="text-amber-400" />
            <span className="mr-auto text-sm text-slate-300">Tự động chạy (Auto) — tìm & đăng theo giãn cách</span>
            <Btn size="sm" variant="success" icon={IconPlayerPlay} disabled={running} onClick={() => call({ type: 'START_AUTO' }, { okMsg: 'Đã bật Auto', errMsg: 'Không bật được' })}>Bật</Btn>
            <Btn size="sm" icon={IconPlayerStop} onClick={() => call({ type: 'STOP_AUTO' }, { okMsg: 'Đã tắt' })}>Tắt</Btn>
            <Btn size="sm" variant="danger" icon={IconHandStop} onClick={() => call({ type: 'KILL' }, { okMsg: 'Đã DỪNG' })}>Kill</Btn>
          </div>
        </Card>

        {/* ── Chọn nhóm ── */}
        <Card className="flex flex-col p-0">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-100">
              <input type="checkbox" checked={allSel} disabled={!pool.length} onChange={toggleAllPool} className="h-4 w-4 accent-indigo-500" />
              <IconTarget size={15} className="text-indigo-400" /> Chọn nhóm ({nGroups}/{pool.length})
            </label>
            <div className="flex items-center gap-1.5">
              <Input className="w-32" value={listName} onChange={e => setListName(e.target.value)} placeholder="tên d.sách" />
              <Btn size="sm" variant="ghost" icon={IconBookmark} onClick={saveList} disabled={!nGroups}>Lưu</Btn>
            </div>
          </div>

          {savedLists.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 px-4 py-2.5">
              <span className="text-xs text-slate-500">Đã lưu:</span>
              {savedLists.map(l => {
                const active = l.groupIds.length > 0 && l.groupIds.every(id => targetSet.has(id)) && l.groupIds.length === nGroups
                return <button key={l.id} onClick={() => applyList(l)} className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200' : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-indigo-500'}`}>{l.name} <span className="text-slate-500">({l.groupIds.length})</span></button>
              })}
            </div>
          )}

          {pool.length === 0 ? (
            <Empty icon={IconUsersGroup}>Chưa có nhóm. Sang <b>Nhóm của tôi</b> để quét & lưu danh sách.</Empty>
          ) : (
            <div className="max-h-[26rem] divide-y divide-slate-800 overflow-y-auto">
              {pool.map(g => (
                <div key={g.id} onClick={() => toggleTarget(g.id)}
                  className={`flex cursor-pointer items-center gap-3 p-2.5 hover:bg-slate-800/40 ${targetSet.has(g.id) ? 'bg-indigo-500/10' : ''}`}>
                  <input type="checkbox" checked={targetSet.has(g.id)} readOnly className="pointer-events-none h-4 w-4 shrink-0 accent-indigo-500" />
                  {g.icon
                    ? <img src={g.icon} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded bg-slate-700 object-cover" />
                    : <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-slate-700 text-xs font-semibold text-slate-300">{(g.name || '?')[0]}</div>}
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{g.name}</span>
                  {g.score != null && <Badge color={scoreColor(g.score)}>{g.score}đ</Badge>}
                  {g.url && <a href={g.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400"><IconExternalLink size={14} /></a>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Bài tìm được ── */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
          <input type="checkbox" checked={allQSel} onChange={toggleAllQ} disabled={!queue.length} className="h-4 w-4 accent-indigo-500" />
          <h2 className="font-semibold text-slate-100">Bài tìm được</h2>
          <span className="text-xs text-slate-500">{queue.length} bài{selCount ? ` · chọn ${selCount}` : ''}</span>
          <div className="ml-auto">
            {posting
              ? <Btn size="sm" variant="danger" icon={IconPlayerStop} onClick={stop}>Dừng {pstat.done}/{pstat.total}{pstat.wait ? ` (${pstat.wait}s)` : ''}</Btn>
              : <Btn size="sm" variant="success" icon={IconSend} disabled={!selCount} onClick={bulkPost}>{postLabel} ({selCount})</Btn>}
          </div>
        </div>
        <div className="p-3">
          {queue.length === 0
            ? <Empty icon={IconRadar}>Chưa có bài. Chọn nhóm rồi bấm <b>Tìm bài tiềm năng</b>.</Empty>
            : <div className="space-y-3">{queue.map(it => <QueueItem key={it.postId} it={it} onAct={act} selected={sel.has(it.postId)} onSel={toggleSel} />)}</div>}
        </div>
      </Card>

      {/* ── Log ── */}
      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200">
          <IconHistory size={15} /> Nhật ký
          <button onClick={() => call({ type: 'CLEAR_LOGS' })} className="ml-auto text-xs font-normal text-slate-500 hover:text-slate-300">Xoá log</button>
        </div>
        <LogFeed className="max-h-72 p-2" />
      </Card>
    </div>
  )
}
