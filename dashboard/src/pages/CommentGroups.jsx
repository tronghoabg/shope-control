import { useState, useEffect, useMemo } from 'react'
import {
  IconUsersGroup, IconRadar, IconPlayerStop, IconBookmark, IconTarget, IconExternalLink,
  IconSend, IconHistory, IconDeviceFloppy, IconPlayerPlay, IconHandStop, IconTrash, IconSparkles,
  IconSettings, IconChevronRight, IconListNumbers, IconPhoto, IconX
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Field, Input, Textarea, Toggle, Empty, Hint } from '../ui.jsx'
import { QueueItem, usePoster, MIN_DELAY, ProgressPanel } from '../commentShared.jsx'
import { LogFeed } from '../LogPanel.jsx'

const KINDS = [
  { k: 'social', t: 'Comment dạo', d: 'Comment tự nhiên, không kèm link' },
  { k: 'shopee', t: 'Rải link Shopee', d: 'AI tự tìm sản phẩm Shopee phù hợp bài viết' },
  { k: 'catalog', t: 'Rải link Catalog', d: 'Dùng sản phẩm và link sẵn có trong Catalog của bạn' },
]

const scoreColor = (n) => n == null ? 'gray' : n >= 70 ? 'green' : n >= 40 ? 'yellow' : 'gray'

export default function CommentGroups() {
  const { s, call, setCfg, notify, account } = useShope()
  const { posting, paused, pstat, results, post, stop, skipWait, pause, resume } = usePoster()
  const [cfgL, setLocal] = useState(null)
  const [sel, setSel] = useState(() => new Set())
  const [scanning, setScanning] = useState(false)
  const [listName, setListName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [step, setStep] = useState(2) // default to Step 3 (index 2) so they see queue immediately

  const pool = useMemo(() => {
    const m = new Map()
    for (const g of (s?.discoveredGroups || [])) m.set(g.groupId, { id: g.groupId, name: g.name, score: g.score, icon: g.icon, url: g.url })
    for (const g of (s?.searchResults || [])) if (!m.has(g.groupId)) m.set(g.groupId, { id: g.groupId, name: g.name, score: g.score, url: g.url })
    for (const id of (s?.cfg?.groupIds || [])) if (!m.has(id)) m.set(id, { id, name: id })
    return [...m.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  }, [s?.discoveredGroups, s?.searchResults, s?.cfg?.groupIds])

  useEffect(() => { if (s?.cfg && !cfgL) setLocal(s.cfg) }, [s, cfgL])
  
  // If targets are empty, fallback to Step 2
  const targets = s?.cfg?.groupIds || []
  useEffect(() => {
    if (cfgL && targets.length === 0 && step === 2) {
      setStep(1) // Show targets step instead of queue step
    }
  }, [targets.length, cfgL])

  const filteredPool = useMemo(() => {
    if (!searchQuery.trim()) return pool
    const q = searchQuery.toLowerCase()
    return pool.filter(g => (g.name || '').toLowerCase().includes(q) || (g.id || '').toLowerCase().includes(q))
  }, [pool, searchQuery])

  if (!s || !cfgL) return <p className="text-slate-500">Đang tải cấu hình chiến dịch…</p>

  const cfg = s.cfg
  const queue = (s.queue || []).filter(q => !q.isPage).map(q => {
    if (q.groupName) return q
    const g = pool.find(x => x.id === q.groupId)
    return { ...q, groupName: g ? g.name : q.groupId }
  })
  const mode = cfg.mode || 'affiliate'
  const source = cfg.productSource || 'catalog'
  const kind = mode === 'social' ? 'social' : (source === 'shopee' ? 'shopee' : 'catalog')
  const postLabel = kind === 'social' ? 'Đăng comment' : 'Rải link'
  const running = cfg.autoEnabled && !cfg.killSwitch
  
  const setKind = (k) => { 
    if (k === 'social') setCfg({ mode: 'social' }); 
    else setCfg({ mode: 'affiliate', productSource: k === 'shopee' ? 'shopee' : 'catalog' }) 
  }
  const setNum = (k) => (e) => setLocal({ ...cfgL, [k]: +e.target.value })
  
  const saveAdv = () => {
    const raised = (cfgL.minDelaySec && cfgL.minDelaySec < MIN_DELAY) || (cfgL.maxDelaySec && cfgL.maxDelaySec < MIN_DELAY)
    const minD = Math.max(MIN_DELAY, cfgL.minDelaySec || MIN_DELAY)
    const maxD = Math.max(minD, cfgL.maxDelaySec || minD)
    setLocal({ ...cfgL, minDelaySec: minD, maxDelaySec: maxD })
    setCfg({ dailyCap: cfgL.dailyCap, minDelaySec: minD, maxDelaySec: maxD, minScore: cfgL.minScore, postsPerScan: cfgL.postsPerScan, requireApproval: cfgL.requireApproval, subId: cfgL.subId, requiredKeywords: cfgL.requiredKeywords, bannedKeywords: cfgL.bannedKeywords })
    notify(raised ? 'blue' : 'green', raised ? `Đã lưu — giãn cách được tự nâng lên tối thiểu ${MIN_DELAY}s để an toàn chống checkpoint.` : 'Đã lưu cấu hình thành công')
  }
  
  const act = (type, postId, extra, timeout) => call({ type, postId, ...(extra || {}) }, { timeout })

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return notify('red', 'Vui lòng chọn file ảnh hợp lệ')
    const reader = new FileReader()
    reader.onload = (ev) => {
      setLocal({ ...cfgL, commentImageBase64: ev.target.result })
      setCfg({ commentImageBase64: ev.target.result })
    }
    reader.readAsDataURL(file)
  }
  const removeImage = () => {
    setLocal({ ...cfgL, commentImageBase64: null })
    setCfg({ commentImageBase64: null })
  }

  // ── Nhóm mục tiêu ──
  const targetSet = new Set(targets)
  const nGroups = targets.length
  const savedLists = s.savedGroupLists || []
  const saveTargets = (ids) => call({ type: 'SET_TARGETS', groupIds: [...new Set(ids)] })
  const toggleTarget = (id) => saveTargets(targetSet.has(id) ? targets.filter(x => x !== id) : [...targets, id])
  const applyList = (l) => call({ type: 'SET_TARGETS', groupIds: l.groupIds }, { okMsg: `Đã chọn "${l.name}" (${l.groupIds.length} nhóm)` })

  const allSel = filteredPool.length > 0 && filteredPool.every(g => targetSet.has(g.id))
  const toggleAllPool = () => {
    if (allSel) {
      saveTargets(targets.filter(x => !filteredPool.some(g => g.id === x)))
    } else {
      const adding = filteredPool.filter(g => !targetSet.has(g.id)).map(g => g.id)
      saveTargets([...targets, ...adding])
    }
  }
  
  const saveList = async () => {
    if (!nGroups) return notify('red', 'Chưa chọn nhóm nào')
    const n = listName.trim() || `Danh sách ${new Date().toLocaleDateString('vi')}`
    await call({ type: 'SAVE_GROUP_LIST', name: n, groupIds: targets }, { okMsg: `Đã lưu "${n}"` }); setListName('')
  }

  const start = async () => {
    if (!nGroups) return notify('red', 'Chọn ít nhất 1 nhóm mục tiêu')
    setScanning(true)
    await call({ type: 'SCAN_NOW' }, { okMsg: 'Đã quét xong bài viết', errMsg: 'Quét bài viết lỗi', timeout: 240000 })
    setScanning(false)
  }

  // queue select
  const toggleSel = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allQSel = queue.length > 0 && queue.every(q => sel.has(q.postId))
  const toggleAllQ = () => setSel(allQSel ? new Set() : new Set(queue.map(q => q.postId)))
  const selCount = queue.filter(q => sel.has(q.postId)).length
  const bulkPost = () => post(queue.filter(q => sel.has(q.postId)).map(q => q.postId), (id) => setSel(p => { const n = new Set(p); n.delete(id); return n }))

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Vận hành Comment Nhóm</h1>
          <p className="text-sm text-slate-400">Thiết lập cấu hình, khoanh vùng mục tiêu và kích hoạt AI bình luận tự động.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge color="gray">{s.state.doneToday || 0}/{cfg.dailyCap} đã chạy hôm nay</Badge>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="grid grid-cols-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-1.5 backdrop-blur-xl shadow-lg shadow-black/20 relative">
        <button
          onClick={() => setStep(0)}
          className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold tracking-wide uppercase transition-all duration-300 ${
            step === 0 
              ? 'text-white' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          {step === 0 && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-md shadow-indigo-500/20 -z-10" />}
          <IconSettings size={16} />
          <span>Bước 1: Cấu hình</span>
        </button>
        <button
          onClick={() => setStep(1)}
          className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold tracking-wide uppercase transition-all duration-300 ${
            step === 1 
              ? 'text-white' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          {step === 1 && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-md shadow-indigo-500/20 -z-10" />}
          <IconTarget size={16} />
          <span>Bước 2: Nhóm mục tiêu ({nGroups})</span>
        </button>
        <button
          onClick={() => setStep(2)}
          className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold tracking-wide uppercase transition-all duration-300 ${
            step === 2 
              ? 'text-white' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          {step === 2 && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-md shadow-indigo-500/20 -z-10" />}
          <IconRadar size={16} />
          <span>Bước 3: Vận hành ({queue.length})</span>
        </button>
      </div>

      {/* Step 1: Configuration */}
      {step === 0 && (
        <div className="space-y-5 animate-fadeIn">
          <Hint id="cmtgroups_setup">
            Thiết lập kiểu đăng, cấu hình thời gian nghỉ giữa các lần rải (giãn cách) và giới hạn mỗi ngày.
          </Hint>

          <Card className="p-6 space-y-6">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Kiểu đăng & hoạt động</span>
              <div className="grid gap-3 sm:grid-cols-3">
                {KINDS.map(m => (
                  <button 
                    key={m.k} 
                    onClick={() => setKind(m.k)}
                    className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
                      kind === m.k 
                        ? 'border-indigo-500/60 bg-indigo-500/[0.04] text-slate-100 shadow-sm' 
                        : 'border-slate-800 bg-slate-900/10 text-slate-400 hover:border-slate-700/80 hover:text-slate-250'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{m.t}</span>
                    <span className="text-[11px] text-slate-500 mt-1 leading-relaxed">{m.d}</span>
                  </button>
                ))}
              </div>
            </div>

            {kind === 'social' && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 mb-4">
                <Field label="Nội dung rải (tùy chọn)" hint="AI sẽ tự động viết các comment biến tấu linh hoạt dựa trên bài viết và nội dung gốc này. Để trống = AI tự soạn hoàn toàn theo ngữ cảnh bài viết.">
                  <Textarea 
                    rows={3} 
                    value={cfgL.seedContent || ''} 
                    onChange={e => setLocal({ ...cfgL, seedContent: e.target.value })}
                    onBlur={() => {
                      if (cfgL.seedContent !== (s.cfg?.seedContent || '')) {
                        setCfg({ seedContent: cfgL.seedContent || '' })
                      }
                    }}
                    placeholder="Vd: Bên em chuyên sỉ/lẻ tai nghe, phụ kiện giá tốt, bảo hành chính hãng ạ." 
                  />
                </Field>
                <div className="mt-4 border-t border-slate-800 pt-3">
                  <div className="mb-2 text-sm font-medium text-slate-200 flex items-center justify-between">
                    <span>Ảnh đính kèm <span className="text-xs font-normal text-slate-500">(sẽ đính kèm ảnh này vào mọi comment dạo)</span></span>
                  </div>
                  {cfgL.commentImageBase64 ? (
                    <div className="relative inline-block group">
                      <img src={cfgL.commentImageBase64} alt="Đính kèm" className="h-24 w-auto rounded-lg border border-slate-700 object-cover" />
                      <button onClick={removeImage} title="Xóa ảnh" className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-lg">
                        <IconX size={14} stroke={3} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex w-fit cursor-pointer items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
                      <IconPhoto size={16} /> Chọn ảnh đính kèm
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
              <Field label="Cap tối đa/ngày"><Input type="number" min={1} value={cfgL.dailyCap} onChange={setNum('dailyCap')} /></Field>
              <Field label="Delay min (giây)"><Input type="number" min={MIN_DELAY} value={cfgL.minDelaySec} onChange={setNum('minDelaySec')} /></Field>
              <Field label="Delay max (giây)"><Input type="number" min={MIN_DELAY} value={cfgL.maxDelaySec} onChange={setNum('maxDelaySec')} /></Field>
              <Field label="Ngưỡng điểm bài tiềm năng"><Input type="number" min={0} value={cfgL.minScore} onChange={setNum('minScore')} /></Field>
              <Field label="Quét bài/nhóm"><Input type="number" min={1} value={cfgL.postsPerScan} onChange={setNum('postsPerScan')} /></Field>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mt-4">
              <Field label="Từ khóa bắt buộc có" hint="Chỉ chọn bài viết có chứa các từ này (phân cách bằng dấu phẩy). Trống = không lọc.">
                <Textarea 
                  rows={2} 
                  value={cfgL.requiredKeywords || ''} 
                  onChange={e => setLocal({ ...cfgL, requiredKeywords: e.target.value })}
                  placeholder="Vd: cần mua, tư vấn, tool, phần mềm" 
                />
              </Field>
              <Field label="Từ khóa cấm (Spam filter)" hint="Bỏ qua ngay lập tức bài viết chứa các từ này (phân cách bằng dấu phẩy).">
                <Textarea 
                  rows={2} 
                  value={cfgL.bannedKeywords || ''} 
                  onChange={e => setLocal({ ...cfgL, bannedKeywords: e.target.value })}
                  placeholder="Vd: bán via, inbox, clone" 
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between border-t border-slate-850 pt-4 gap-4">
              <Toggle checked={cfgL.requireApproval !== false} onChange={(v) => setLocal({ ...cfgL, requireApproval: v })} label="Yêu cầu duyệt tay từng comment trước khi đăng" />
              <div className="flex gap-2">
                <Btn variant="primary" icon={IconDeviceFloppy} onClick={saveAdv}>Lưu cấu hình</Btn>
                <Btn variant="default" onClick={() => setStep(1)} className="group">
                  Tiếp tục chọn nhóm <IconChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Btn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Step 2: Target Groups */}
      {step === 1 && (
        <div className="space-y-5 animate-fadeIn">
          <Hint id="cmtgroups_targets">
            Chọn các nhóm bạn đã tham gia để công cụ rải bài. Bạn có thể lưu các tập nhóm đã chọn thành danh sách mục tiêu để áp dụng nhanh sau này.
          </Hint>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <Card className="flex flex-col h-[32rem]">
                <div className="flex items-center justify-between border-b border-slate-850 px-5 py-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-slate-200">
                      <input type="checkbox" checked={allSel} disabled={!filteredPool.length} onChange={toggleAllPool} className="h-4.5 w-4.5 accent-indigo-500 rounded border-slate-850" />
                      <span>Chọn / Bỏ chọn tất cả ({filteredPool.length})</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm nhóm..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-sm bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-500 w-64"
                    />
                  </div>
                  {nGroups > 0 && <span className="text-xs text-slate-400 self-start mt-1">Đã chọn {nGroups} / {pool.length} nhóm</span>}
                </div>

                {filteredPool.length === 0 ? (
                  <Empty icon={IconUsersGroup}>
                    {searchQuery ? 'Không tìm thấy nhóm nào khớp với từ khóa' : 'Không tìm thấy nhóm nào. Vui lòng sang tab Nhóm của tôi để Quét đồng bộ dữ liệu nhóm đã tham gia.'}
                  </Empty>
                ) : (
                  <div className="flex-1 divide-y divide-slate-850 overflow-y-auto">
                    {filteredPool.map(g => (
                      <div key={g.id} onClick={() => toggleTarget(g.id)}
                        className={`flex cursor-pointer items-center gap-3.5 px-5 py-3 hover:bg-slate-900/30 transition-colors ${targetSet.has(g.id) ? 'bg-indigo-500/[0.03]' : ''}`}>
                        <input type="checkbox" checked={targetSet.has(g.id)} readOnly className="pointer-events-none h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800" />
                        {g.icon
                          ? <img src={g.icon} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-lg bg-slate-800 object-cover" />
                          : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-bold text-slate-400 border border-slate-800">{(g.name || '?')[0]}</div>}
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-300">{g.name}</span>
                        {g.score != null && <Badge color={scoreColor(g.score)}>{g.score}đ</Badge>}
                        {g.url && (
                          <a href={g.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400 h-7 w-7 rounded-lg hover:bg-slate-800 flex items-center justify-center">
                            <IconExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div>
              <Card className="p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm mb-1.5">Lưu danh sách mục tiêu</h3>
                  <p className="text-xs text-slate-500 mb-3">Lưu tập {nGroups} nhóm đang chọn làm Preset.</p>
                  <div className="space-y-2">
                    <Input value={listName} onChange={e => setListName(e.target.value)} placeholder="Tên danh sách mục tiêu…" />
                    <Btn variant="primary" icon={IconBookmark} onClick={saveList} disabled={!nGroups} className="w-full">
                      Lưu Preset
                    </Btn>
                  </div>
                </div>

                {savedLists.length > 0 && (
                  <div className="pt-4 border-t border-slate-850">
                    <h3 className="font-semibold text-slate-150 text-xs mb-2">Preset mục tiêu đã lưu:</h3>
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                      {savedLists.map(l => {
                        const active = l.groupIds.length > 0 && l.groupIds.every(id => targetSet.has(id)) && l.groupIds.length === nGroups
                        return (
                          <button 
                            key={l.id} 
                            onClick={() => applyList(l)} 
                            className={`text-xs text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                              active 
                                ? 'border-indigo-500/40 bg-indigo-500/[0.04] text-indigo-300 font-bold' 
                                : 'border-slate-800 bg-slate-900/10 text-slate-400 hover:border-slate-700/60'
                            }`}
                          >
                            <span className="truncate pr-2">{l.name}</span>
                            <span className="text-[10px] text-slate-500">({l.groupIds.length} nhóm)</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-850">
                  <Btn variant="success" className="w-full" onClick={() => setStep(2)}>
                    Tiến tới quét & vận hành <IconChevronRight size={14} />
                  </Btn>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Run & Approve */}
      {step === 2 && (
        <div className="animate-fadeIn space-y-6">
          {/* Controls deck */}
          <div className="grid gap-5 md:grid-cols-3">
            <Card className="p-5 flex flex-col justify-between md:col-span-2 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-200 text-sm">Tìm kiếm & Khai thác</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Quét các bài viết mới tiềm năng trong {nGroups} nhóm đã chọn.</p>
                </div>
                <div>
                  {scanning
                  ? <Btn variant="danger" icon={IconPlayerStop} onClick={() => call({ type: 'CANCEL_RUN' }, { okMsg: 'Đang dừng quét…' })}>Dừng tìm kiếm</Btn>
                  : <Btn variant="primary" icon={IconTarget} disabled={!nGroups} onClick={() => {
                      if (!account?.loggedIn) return notify('red', 'Vui lòng đăng nhập tài khoản hệ thống để sử dụng tính năng này')
                      start()
                    }}>
                      Tìm bài tiềm năng ngay lập tức
                    </Btn>}
                </div>
              </div>

              {/* Auto mode settings */}
              <div className="flex flex-wrap items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/20 p-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20"><IconSparkles size={16} className="text-amber-400 animate-pulse" /></div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Tự động hóa hoàn toàn (Auto Mode)</h4>
                    <p className="text-[11px] text-slate-500">Hệ thống tự động quét và comment liên tục theo chu kỳ.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Btn size="sm" variant="success" icon={IconPlayerPlay} onClick={() => {
                    if (!account?.loggedIn) return notify('red', 'Vui lòng đăng nhập tài khoản hệ thống để sử dụng tính năng này')
                    call({ type: 'START_AUTO' }, { okMsg: 'Đã bật Auto' })
                  }}>Bật rải tự động liên tục (Auto)</Btn>
                  <Btn size="sm" icon={IconPlayerStop} onClick={() => call({ type: 'STOP_AUTO' }, { okMsg: 'Đã tắt Auto' })}>Tắt Auto</Btn>
                  <Btn size="sm" variant="danger" icon={IconHandStop} onClick={() => call({ type: 'KILL' }, { okMsg: 'Đã dừng khẩn cấp' })}>Kill</Btn>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Thông số vận hành hiện tại:</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                  <div className="text-slate-500 text-[10px]">Daily Cap</div>
                  <div className="font-bold text-slate-300 mt-0.5">{cfg.dailyCap} bài/ngày</div>
                </div>
                <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                  <div className="text-slate-500 text-[10px]">Giãn cách</div>
                  <div className="font-bold text-slate-300 mt-0.5">{cfg.minDelaySec} - {cfg.maxDelaySec}s</div>
                </div>
                <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                  <div className="text-slate-500 text-[10px]">Nguồn rải</div>
                  <div className="font-bold text-slate-300 mt-0.5 uppercase">{kind}</div>
                </div>
                <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
                  <div className="text-slate-500 text-[10px]">Duyệt tay</div>
                  <div className="font-bold text-slate-300 mt-0.5">{cfg.requireApproval !== false ? 'Có' : 'Không'}</div>
                </div>
              </div>
              <button onClick={() => setStep(0)} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                ⚙️ Thay đổi cài đặt cấu hình
              </button>
            </Card>
          </div>

          {/* Queue Section */}
          <Card className="p-0 border border-slate-800 bg-slate-950/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <input type="checkbox" checked={allQSel} onChange={toggleAllQ} disabled={!queue.length} className="h-4.5 w-4.5 accent-indigo-500 rounded border-slate-850" />
                <h2 className="font-bold text-slate-100 text-sm">Hàng chờ bài viết ({queue.length} bài)</h2>
                {selCount > 0 && <Badge color="indigo">Đã chọn {selCount}</Badge>}
              </div>
              <div>
                {posting
                  ? <Btn size="sm" variant="danger" icon={IconPlayerStop} onClick={stop}>Dừng {pstat.done}/{pstat.total}{pstat.wait ? ` (nghỉ ${pstat.wait}s)` : ''}</Btn>
                  : <Btn size="sm" variant="success" icon={IconSend} disabled={!selCount} onClick={() => {
                      if (!account?.loggedIn) return notify('red', 'Vui lòng đăng nhập tài khoản hệ thống để sử dụng tính năng này')
                      bulkPost()
                    }}>{postLabel} hàng loạt ({selCount})</Btn>}
              </div>
            </div>

            <div className="p-4">
              {queue.length === 0 ? (
                <Empty icon={IconListNumbers}>
                  Hàng chờ trống. Vui lòng bấm <b>Tìm bài tiềm năng</b> ở trên hoặc kiểm tra lại nhóm mục tiêu.
                </Empty>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {queue.map(it => <QueueItem key={it.postId} it={it} onAct={act} selected={sel.has(it.postId)} onSel={toggleSel} />)}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
      </div>

      {/* Logs Panel (Right Side) */}
      <div className="w-full xl:w-96 shrink-0 xl:sticky xl:top-6">
        <ProgressPanel results={results} posting={posting} pstat={pstat} onSkipWait={skipWait} paused={paused} onPause={pause} onResume={resume}>
          <LogFeed className="p-3 font-mono text-[11px] leading-relaxed" />
        </ProgressPanel>
      </div>
    </div>
  )
}
