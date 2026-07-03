import { useMemo, useRef, useState } from 'react'
import { 
  IconSend, IconPlayerPlay, IconPlayerStop, IconTarget, IconExternalLink, IconCheck, IconX, 
  IconWand, IconRefresh, IconPhoto, IconPalette, IconSparkles, IconTrash, IconBookmark,
  IconClock, IconMessageCircle, IconShare3, IconThumbUp
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Empty, Hint, Field, Input, Textarea, Toggle } from '../ui.jsx'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// spintax: {a|b|c}
function spin(t) {
  let out = String(t), guard = 0
  while (/\{[^{}]*\}/.test(out) && guard++ < 6) {
    out = out.replace(/\{([^{}]*)\}/g, (_, g) => { const o = g.split('|'); return o[Math.floor(Math.random() * o.length)] })
  }
  return out
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }

const BG_PRESETS = [
  { id: '106018623298955', color: '#7c3aed', label: 'Tím' },
  { id: '204187940028597', color: '#dc2626', label: 'Đỏ' },
  { id: '217761075370932', color: '#2563eb', label: 'Xanh' },
  { id: '301029513638534', color: '#0d9488', label: 'Ngọc' },
  { id: '1881421442117417', color: '#1f2937', label: 'Đen' },
  { id: '1777259169190672', color: 'linear-gradient(135deg,#7c3aed,#db2777)', label: 'Tím hồng' },
  { id: '901751159967576', color: 'linear-gradient(135deg,#ea580c,#dc2626)', label: 'Cam đỏ' },
  { id: '303063890126415', color: 'linear-gradient(135deg,#f59e0b,#ec4899)', label: 'Vàng hồng' },
]

export default function PostGroups() {
  const { s, aiReady, notify, refresh, account } = useShope()
  const [content, setContent] = useState('')
  const [link, setLink] = useState('')
  const [images, setImages] = useState([])   // [{ name, url(dataURL) }]
  const [bg, setBg] = useState('')            // text_format_preset_id ('' = không nền)
  const [useAi, setUseAi] = useState(false)
  const [sel, setSel] = useState(() => new Set(s?.cfg?.groupIds || []))
  const [gFilter, setGFilter] = useState('')
  const [randomize, setRandomize] = useState(true)
  const [stopOnError, setStopOnError] = useState(false)
  const [dMin, setDMin] = useState(s?.cfg?.minDelaySec ?? 45)
  const [dMax, setDMax] = useState(s?.cfg?.maxDelaySec ?? 120)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])
  const [wait, setWait] = useState(0)
  const stopRef = useRef(false)
  const fileRef = useRef(null)

  const pool = useMemo(() => {
    const m = new Map()
    for (const g of (s?.discoveredGroups || [])) m.set(g.groupId, { id: g.groupId, name: g.name, score: g.score, icon: g.icon, url: g.url })
    for (const g of (s?.searchResults || [])) if (!m.has(g.groupId)) m.set(g.groupId, { id: g.groupId, name: g.name, score: g.score, url: g.url })
    for (const id of (s?.cfg?.groupIds || [])) if (!m.has(id)) m.set(id, { id, name: id })
    return [...m.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  }, [s?.discoveredGroups, s?.searchResults, s?.cfg?.groupIds])
  const nameMap = useMemo(() => Object.fromEntries(pool.map(g => [g.id, g.name])), [pool])

  if (!s) return <p className="text-slate-500">Đang tải dữ liệu chiến dịch…</p>

  const variants = content.split(/\n=+\s*\n/).map(v => v.trim()).filter(Boolean)
  const hasVar = variants.length > 1
  const hasSpin = /\{[^{}]*\|[^{}]*\}/.test(content)
  const preview = spin(variants[0] || content)
  const bgDisabled = images.length > 0 || !!link.trim()
  const activeBg = !bgDisabled ? BG_PRESETS.find(b => b.id === bg) : null
  const shownPool = gFilter.trim() ? pool.filter(g => (g.name || '').toLowerCase().includes(gFilter.trim().toLowerCase())) : pool
  const allShownSelected = shownPool.length > 0 && shownPool.every(g => sel.has(g.id))

  const toggle = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const onFiles = (e) => {
    const files = [...(e.target.files || [])]
    files.forEach(f => {
      if (!f.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => setImages(prev => prev.length >= 8 ? prev : [...prev, { name: f.name, url: reader.result }])
      reader.readAsDataURL(f)
    })
    if (fileRef.current) fileRef.current.value = ''
  }
  const removeImg = (i) => setImages(prev => prev.filter((_, n) => n !== i))

  const savedPosts = s.savedPosts || []
  const savePost = async () => {
    if (!content.trim()) return notify('red', 'Chưa có nội dung để lưu')
    await ext({ type: 'SAVE_POST', post: { content, link: link.trim(), bgPresetId: bgDisabled ? '' : bg } })
    refresh(); notify('green', 'Đã lưu bài mẫu thành công')
  }
  const loadSaved = (id) => {
    const p = savedPosts.find(x => x.id === id); if (!p) return
    setContent(p.content || ''); setLink(p.link || ''); setBg(p.bgPresetId || '')
    notify('blue', `Đã tải bài viết mẫu "${p.title}"`)
  }

  async function run() {
    const ids = [...sel]
    if (!ids.length) return notify('red', 'Chưa chọn nhóm nào')
    if (!content.trim() && !images.length) return notify('red', 'Chưa có nội dung hoặc ảnh')
    if (randomize) shuffle(ids)
    let bag = []
    const pickVar = () => {
      if (!hasVar) return content
      if (!bag.length) bag = shuffle(variants.map((_, i) => i))
      return variants[bag.pop()]
    }
    const imgUrls = images.map(im => im.url)

    setRunning(true); stopRef.current = false
    setResults(ids.map(id => ({ id, name: nameMap[id] || id, status: 'pending' })))
    let ok = 0, fail = 0
    for (let i = 0; i < ids.length; i++) {
      if (stopRef.current) break
      const id = ids[i]
      setResults(rs => rs.map(r => r.id === id ? { ...r, status: 'posting' } : r))
      let message = spin(pickVar())
      if (useAi && aiReady && message.trim()) {
        try { const ar = await ext({ type: 'AI_REWRITE', text: message }, 60000); if (ar?.ok && ar.text) message = ar.text } catch {}
      }
      let r
      try { r = await ext({ type: 'POST_GROUP', groupId: id, message, link: link.trim(), images: imgUrls, bgPresetId: bgDisabled ? '' : bg }, 180000) }
      catch (e) { r = { ok: false, error: String(e?.message || e) } }

      if (r?.quotaBlocked) {
        setResults(rs => rs.map(x => x.id === id ? { ...x, status: 'error', error: r.error || 'Hết lượt' } : x))
        notify('red', r.error || 'Hết lượt đăng hôm nay'); break
      }
      if (r?.ok) { ok++; setResults(rs => rs.map(x => x.id === id ? { ...x, status: 'success', url: r.postUrl } : x)) }
      else { fail++; setResults(rs => rs.map(x => x.id === id ? { ...x, status: 'error', error: r?.error || 'Lỗi' } : x)); if (stopOnError) break }

      if (i < ids.length - 1 && !stopRef.current) {
        const lo = Math.max(5, Math.min(dMin, dMax)), hi = Math.max(lo, Math.max(dMin, dMax))
        let secs = lo + Math.floor(Math.random() * (hi - lo + 1))
        for (; secs > 0 && !stopRef.current; secs--) { setWait(secs); await sleep(1000) }
        setWait(0)
      }
    }
    setRunning(false); setWait(0)
    notify(fail ? 'blue' : 'green', `Hoàn tất: ${ok} thành công, ${fail} lỗi`)
  }
  const stop = () => { stopRef.current = true; notify('blue', 'Đang dừng chiến dịch sau bài hiện tại…') }

  const done = results.filter(r => r.status === 'success' || r.status === 'error').length
  const pct = results.length ? Math.round(done / results.length * 100) : 0

  const userFbName = s?.conn?.name || 'Tài khoản của bạn'
  const userFbPic = s?.conn?.picture

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Đăng bài tự động lên nhóm</h1>
          <p className="text-sm text-slate-400">Soạn thảo bài viết, tùy chọn spintax, biến thể và đăng tự động lên hàng loạt nhóm.</p>
        </div>
        <div className="flex items-center gap-3">
          {running
            ? <Btn variant="danger" icon={IconPlayerStop} onClick={stop}>Dừng chiến dịch</Btn>
            : <Btn variant="primary" icon={IconPlayerPlay} onClick={() => {
                if (!account?.loggedIn) return notify('red', 'Vui lòng đăng nhập tài khoản hệ thống để sử dụng tính năng này')
                run()
              }} disabled={!sel.size || (!content.trim() && !images.length)}>Khởi chạy ({sel.size} nhóm)</Btn>}
        </div>
      </div>

      <Hint id="postgroups">
        Nhập nội dung kèm tùy chọn spintax <code className="rounded bg-slate-800 px-1 font-mono">{`{xin chào|chào bạn}`}</code> để AI tự động biến đổi, tránh spam trùng lặp. 
        Nếu nội dung có các biến thể độc lập, ngăn cách chúng bằng dòng <code className="rounded bg-slate-800 px-1 font-mono">===</code>.
      </Hint>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Soạn bài (Left) */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-850 pb-4">
              <select value="" onChange={e => loadSaved(e.target.value)}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700/60 px-3.5 py-2.5 text-xs font-semibold text-slate-300 cursor-pointer outline-none">
                <option value="">Tải bài viết mẫu đã lưu…{savedPosts.length ? ` (${savedPosts.length})` : ''}</option>
                {savedPosts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <Btn size="sm" icon={IconBookmark} onClick={savePost} disabled={!content.trim()}>Lưu bài mẫu</Btn>
            </div>

            <Field label="Nội dung bài viết" hint={`${hasVar ? `${variants.length} biến thể · ` : ''}${hasSpin ? 'Có sử dụng Spintax' : 'Nhập spintax dạng {a|b|c}'}`}>
              <Textarea rows={6} value={content} onChange={e => setContent(e.target.value)}
                placeholder={'Ví dụ:\n{Chào cả nhà|Mọi người ơi}, bên mình đang giảm giá mạnh mẫu này ạ!\n===\nBiến thể 2: Deal hot hôm nay, chốt nhanh kẻo hết các bác.'} />
            </Field>

            <Field label="Liên kết đính kèm">
              <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://shopee.vn/product/..." />
            </Field>

            {/* Images layout */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ảnh đính kèm ({images.length}/8)</span>
                <Btn size="sm" variant="ghost" icon={IconPhoto} onClick={() => fileRef.current?.click()} disabled={images.length >= 8}>Thêm ảnh</Btn>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
              </div>
              {images.length > 0 && (
                <div className="grid grid-cols-6 gap-2">
                  {images.map((im, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                      <img src={im.url} alt="" className="h-full w-full object-cover" />
                      <button onClick={() => removeImg(i)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-xl">
                        <IconTrash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Colors Preset */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <IconPalette size={14} /> Màu nền bài viết {bgDisabled && <span className="text-[10px] text-slate-500 font-normal lowercase">(Chỉ áp dụng khi không đính kèm ảnh/link)</span>}
              </div>
              <div className={`flex flex-wrap gap-2 ${bgDisabled ? 'pointer-events-none opacity-30' : ''}`}>
                <button onClick={() => setBg('')} className={`h-8 px-3 rounded-lg border text-xs font-semibold transition-all ${!bg ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 bg-slate-900/40 text-slate-400'}`}>Không nền</button>
                {BG_PRESETS.map(b => (
                  <button key={b.id} title={b.label} onClick={() => setBg(b.id)}
                    className={`h-8 w-8 rounded-lg border-2 ${bg === b.id ? 'border-indigo-400 scale-105' : 'border-transparent'}`} style={{ background: b.color }} />
                ))}
              </div>
            </div>

            {/* AI Rewrite */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400"><IconSparkles size={16} /></div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">AI viết lại bài viết tự động</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">{aiReady ? 'Tự động biến đổi nội dung khác biệt ở mỗi nhóm để chống spam.' : 'Vui lòng đăng nhập tài khoản để kích hoạt.'}</p>
                </div>
              </div>
              <Toggle checked={useAi && aiReady} onChange={v => aiReady && setUseAi(v)} />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <Field label="Trễ tối thiểu (giây)"><Input type="number" min={5} value={dMin} onChange={e => setDMin(+e.target.value || 0)} /></Field>
              <Field label="Trễ tối đa (giây)"><Input type="number" min={5} value={dMax} onChange={e => setDMax(+e.target.value || 0)} /></Field>
            </div>

            <div className="flex flex-wrap gap-5 border-t border-slate-850 pt-4">
              <Toggle checked={randomize} onChange={setRandomize} label="Xáo trộn ngẫu nhiên thứ tự nhóm đăng" />
              <Toggle checked={stopOnError} onChange={setStopOnError} label="Dừng chiến dịch ngay lập tức nếu gặp lỗi" />
            </div>
          </Card>
        </div>

        {/* Preview & Groups (Right) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Real Facebook Post Preview */}
          <Card className="overflow-hidden border border-slate-800/80 bg-[#18191a] shadow-xl text-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-850 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/30">
              <IconWand size={13} className="text-indigo-400" /> Xem trước định dạng Facebook
            </div>
            
            {/* Header Facebook Post */}
            <div className="p-4 flex items-center gap-3">
              {userFbPic 
                ? <img src={userFbPic} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover border border-slate-800" />
                : <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-850 border border-slate-800 text-slate-400"><IconUserCircle size={22} /></div>}
              <div>
                <div className="text-sm font-bold text-slate-100 hover:underline cursor-pointer">{userFbName}</div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                  <span>Vừa xong</span>
                  <span>·</span>
                  <IconClock size={11} className="inline" />
                </div>
              </div>
            </div>

            {/* Content Facebook Post */}
            <div className="relative">
              {activeBg ? (
                <div className="flex items-center justify-center p-8 text-center text-lg font-extrabold text-white min-h-[160px] select-none break-words" style={{ background: activeBg.color }}>
                  <div className="whitespace-pre-wrap max-w-xs">{preview || 'Nội dung bài đăng…'}</div>
                </div>
              ) : (
                <div className="px-4 pb-3 space-y-3">
                  <p className="whitespace-pre-wrap text-sm text-slate-200 leading-relaxed">{preview || <span className="text-slate-600 italic">Nhập nội dung soạn thảo ở bên trái…</span>}</p>
                  
                  {link.trim() && (
                    <div className="rounded-lg border border-slate-800 bg-[#242526] overflow-hidden hover:bg-slate-800/40 transition-colors cursor-pointer select-none">
                      <div className="p-3 border-t border-slate-850">
                        <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider truncate">{new URL(link.trim()).hostname}</div>
                        <div className="text-xs font-bold text-slate-350 truncate mt-0.5">{link.trim()}</div>
                      </div>
                    </div>
                  )}

                  {images.length > 0 && (
                    <div className={`grid gap-1 overflow-hidden rounded-xl border border-slate-850 ${
                      images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                    }`}>
                      {images.slice(0, 3).map((im, i) => (
                        <div key={i} className="relative aspect-square">
                          <img src={im.url} className="h-full w-full object-cover" alt="" />
                          {i === 2 && images.length > 3 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-base font-extrabold">
                              +{images.length - 3}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions Panel Preview */}
            <div className="mx-4 py-2.5 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400 font-semibold select-none">
              <span className="flex items-center gap-1.5 hover:bg-slate-800/40 px-3 py-1.5 rounded-lg cursor-pointer flex-1 justify-center"><IconThumbUp size={14} /> Thích</span>
              <span className="flex items-center gap-1.5 hover:bg-slate-800/40 px-3 py-1.5 rounded-lg cursor-pointer flex-1 justify-center"><IconMessageCircle size={14} /> Bình luận</span>
              <span className="flex items-center gap-1.5 hover:bg-slate-800/40 px-3 py-1.5 rounded-lg cursor-pointer flex-1 justify-center"><IconShare3 size={14} /> Chia sẻ</span>
            </div>
          </Card>

          {/* Target groups chooser */}
          <Card className="flex flex-col h-80">
            <div className="flex items-center justify-between gap-2 border-b border-slate-850 px-4 py-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
                <input type="checkbox" checked={allShownSelected} disabled={!shownPool.length}
                  onChange={() => setSel(prev => { const n = new Set(prev); if (allShownSelected) shownPool.forEach(g => n.delete(g.id)); else shownPool.forEach(g => n.add(g.id)); return n })}
                  className="h-4.5 w-4.5 accent-indigo-500 rounded border-slate-850" />
                <span>Chọn nhóm ({sel.size})</span>
              </label>
              <Btn size="sm" variant="ghost" onClick={() => setSel(new Set(s.cfg?.groupIds || []))} disabled={!(s.cfg?.groupIds || []).length}>Theo mục tiêu</Btn>
            </div>
            {pool.length > 0 && (
              <div className="border-b border-slate-850 px-3 py-2 bg-slate-950/20">
                <Input value={gFilter} onChange={e => setGFilter(e.target.value)} placeholder={`Lọc theo từ khóa… (${shownPool.length}/${pool.length} nhóm)`} className="h-8 text-xs rounded-lg" />
              </div>
            )}
            {pool.length === 0 ? (
              <Empty icon={IconTarget}>Chưa có nhóm. Vào <b>Nhóm của tôi</b> để quét và lưu danh sách.</Empty>
            ) : shownPool.length === 0 ? (
              <Empty icon={IconTarget}>Không tìm thấy nhóm khớp với từ khóa.</Empty>
            ) : (
              <div className="flex-1 divide-y divide-slate-850 overflow-y-auto">
                {shownPool.map(g => (
                  <div key={g.id} onClick={() => toggle(g.id)}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-slate-900/30 transition-colors ${sel.has(g.id) ? 'bg-indigo-500/[0.03]' : ''}`}>
                    <input type="checkbox" checked={sel.has(g.id)} readOnly className="pointer-events-none h-4.5 w-4.5 accent-indigo-500 rounded border-slate-800" />
                    {g.icon
                      ? <img src={g.icon} alt="" referrerPolicy="no-referrer" className="h-6 w-6 shrink-0 rounded bg-slate-850 object-cover" />
                      : <div className="grid h-6 w-6 shrink-0 place-items-center rounded bg-slate-800 text-[10px] font-bold text-slate-400 border border-slate-800">{(g.name || '?')[0]}</div>}
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-350">{g.name}</span>
                    {g.score != null && <Badge color={g.score >= 70 ? 'green' : g.score >= 40 ? 'yellow' : 'gray'} className="text-[10px] px-1.5">{g.score}đ</Badge>}
                  </div>
                ))}
              </div>
            )}
          </Card>
          {/* Progress logs */}
          {results.length > 0 && (
            <Card className="p-5 space-y-4 border-indigo-500/20 bg-indigo-500/[0.02]">
              <div className="flex flex-wrap items-center justify-between text-sm gap-2">
                <span className="font-bold text-slate-200">Tiến trình đăng bài ({done} / {results.length} nhóm)</span>
                <span className="text-xs font-semibold text-slate-405 font-mono">{running ? (wait ? `Đang nghỉ trễ ${wait} giây…` : 'Đang xử lý đăng…') : 'Đã hoàn thành'}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-850">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 animate-pulse" style={{ width: `${pct}%` }} />
              </div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-slate-850/60 rounded-xl border border-slate-850/60 bg-slate-950/40">
                {results.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-slate-900/40">
                    {r.status === 'success' ? <IconCheck size={14} className="shrink-0 text-emerald-400 bg-emerald-500/10 p-0.5 rounded-full" />
                      : r.status === 'error' ? <IconX size={14} className="shrink-0 text-red-400 bg-red-500/10 p-0.5 rounded-full" />
                      : r.status === 'posting' ? <IconRefresh size={14} className="shrink-0 animate-spin text-indigo-400" />
                      : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-700/50" />}
                    <span className="min-w-0 flex-1 truncate text-slate-300">{r.name}</span>
                    {r.status === 'success' && r.url && <a href={r.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-bold text-indigo-400 hover:underline inline-flex items-center gap-1">Xem <IconExternalLink size={11} /></a>}
                    {r.status === 'error' && <span className="shrink-0 max-w-[40%] truncate font-mono text-[10px] text-red-400/80">{r.error}</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
