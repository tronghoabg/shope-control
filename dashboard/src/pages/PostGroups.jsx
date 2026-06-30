import { useMemo, useRef, useState } from 'react'
import { IconSend, IconPlayerPlay, IconPlayerStop, IconTarget, IconExternalLink, IconCheck, IconX, IconWand, IconRefresh, IconPhoto, IconPalette, IconSparkles, IconTrash, IconBookmark } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Empty, Hint, Field, Input, Textarea, Toggle } from '../ui.jsx'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
// spintax: {a|b|c} → chọn ngẫu nhiên (đệ quy nông cho lồng 1 lớp)
function spin(t) {
  let out = String(t), guard = 0
  while (/\{[^{}]*\}/.test(out) && guard++ < 6) {
    out = out.replace(/\{([^{}]*)\}/g, (_, g) => { const o = g.split('|'); return o[Math.floor(Math.random() * o.length)] })
  }
  return out
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }

// Màu nền bài viết (text_format_preset_id — hằng số chung của Facebook)
const BG_PRESETS = [
  { id: '106018623298955', color: '#7c3aed', label: 'Tím' },
  { id: '204187940028597', color: '#dc2626', label: 'Đỏ' },
  { id: '217761075370932', color: '#2563eb', label: 'Xanh dương' },
  { id: '301029513638534', color: '#0d9488', label: 'Xanh ngọc' },
  { id: '1881421442117417', color: '#1f2937', label: 'Đen' },
  { id: '1777259169190672', color: 'linear-gradient(135deg,#7c3aed,#db2777)', label: 'Tím-hồng' },
  { id: '901751159967576', color: 'linear-gradient(135deg,#ea580c,#dc2626)', label: 'Cam-đỏ' },
  { id: '303063890126415', color: 'linear-gradient(135deg,#f59e0b,#ec4899)', label: 'Vàng-cam' },
]

export default function PostGroups() {
  const { s, aiReady, notify, refresh } = useShope()
  const [content, setContent] = useState('')
  const [link, setLink] = useState('')
  const [images, setImages] = useState([])   // [{ name, url(dataURL) }]
  const [bg, setBg] = useState('')            // text_format_preset_id ('' = không nền)
  const [useAi, setUseAi] = useState(false)
  const [sel, setSel] = useState(() => new Set(s?.cfg?.groupIds || []))
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

  if (!s) return <p className="text-slate-500">Đang tải…</p>

  const variants = content.split(/\n=+\s*\n/).map(v => v.trim()).filter(Boolean)
  const hasVar = variants.length > 1
  const hasSpin = /\{[^{}]*\|[^{}]*\}/.test(content)
  const preview = spin(variants[0] || content)
  const bgDisabled = images.length > 0 || !!link.trim()
  const activeBg = !bgDisabled ? BG_PRESETS.find(b => b.id === bg) : null

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
    refresh(); notify('green', 'Đã lưu bài mẫu (xem ở Đã lưu)')
  }
  const loadSaved = (id) => {
    const p = savedPosts.find(x => x.id === id); if (!p) return
    setContent(p.content || ''); setLink(p.link || ''); setBg(p.bgPresetId || '')
    notify('blue', `Đã tải "${p.title}"`)
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
    notify(fail ? 'blue' : 'green', `Xong: ${ok} thành công, ${fail} lỗi`)
  }
  const stop = () => { stopRef.current = true; notify('blue', 'Đang dừng sau bài hiện tại…') }

  const done = results.filter(r => r.status === 'success' || r.status === 'error').length
  const pct = results.length ? Math.round(done / results.length * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Đăng bài vào nhóm</h1>
        {running
          ? <Btn variant="danger" icon={IconPlayerStop} onClick={stop}>Dừng</Btn>
          : <Btn variant="primary" icon={IconPlayerPlay} onClick={run} disabled={!sel.size || (!content.trim() && !images.length)}>Đăng vào {sel.size} nhóm</Btn>}
      </div>

      <Hint id="postgroups">
        Soạn 1 bài rồi đăng lần lượt vào nhiều nhóm (qua extension, an toàn checkpoint). Dùng <b>spintax</b> <code className="rounded bg-slate-800 px-1">{'{xin chào|chào cả nhà|hi}'}</code> hoặc nhiều <b>biến thể</b> ngăn bằng dòng <code className="rounded bg-slate-800 px-1">===</code>.
        Bật <b>AI viết lại</b> để mỗi nhóm 1 nội dung khác hẳn (chống trùng). <b>Màu nền</b> chỉ áp cho bài chữ thuần (không ảnh/link).
      </Hint>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Soạn bài */}
        <Card className="space-y-4 p-4">
          {/* Lưu / tải bài mẫu */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
            <select value="" onChange={e => loadSaved(e.target.value)}
              className="min-w-[160px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              <option value="">Tải bài đã lưu…{savedPosts.length ? ` (${savedPosts.length})` : ''}</option>
              {savedPosts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <Btn size="sm" icon={IconBookmark} onClick={savePost} disabled={!content.trim()}>Lưu bài</Btn>
          </div>
          <Field label="Nội dung bài" hint={`${hasVar ? variants.length + ' biến thể · ' : ''}${hasSpin ? 'có spintax' : 'spintax: {a|b|c}'}`}>
            <Textarea rows={8} value={content} onChange={e => setContent(e.target.value)}
              placeholder={'Ví dụ:\n{Chào cả nhà|Hi mọi người}, shop đang sale mạnh nha 🔥\nInbox để được tư vấn nhé!\n===\nBiến thể 2: deal hời hôm nay, ai cần ới em 😍'} />
          </Field>
          <Field label="Link đính kèm (tuỳ chọn)">
            <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://shopee.vn/..." />
          </Field>

          {/* Ảnh */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Ảnh đính kèm ({images.length}/8)</span>
              <Btn size="sm" variant="ghost" icon={IconPhoto} onClick={() => fileRef.current?.click()} disabled={images.length >= 8}>Thêm ảnh</Btn>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
            </div>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((im, i) => (
                  <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-700">
                    <img src={im.url} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => removeImg(i)} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"><IconTrash size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Màu nền */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-300"><IconPalette size={14} /> Màu nền {bgDisabled && <span className="text-xs text-slate-500">(tắt khi có ảnh/link)</span>}</div>
            <div className={`flex flex-wrap gap-2 ${bgDisabled ? 'pointer-events-none opacity-40' : ''}`}>
              <button onClick={() => setBg('')} className={`h-8 w-8 rounded-lg border-2 ${!bg ? 'border-indigo-400' : 'border-slate-700'} grid place-items-center bg-slate-800 text-xs text-slate-400`}>—</button>
              {BG_PRESETS.map(b => (
                <button key={b.id} title={b.label} onClick={() => setBg(b.id)}
                  className={`h-8 w-8 rounded-lg border-2 ${bg === b.id ? 'border-indigo-400' : 'border-transparent'}`} style={{ background: b.color }} />
              ))}
            </div>
          </div>

          {/* AI viết lại */}
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-center gap-2">
              <IconSparkles size={16} className="text-amber-400" />
              <div>
                <div className="text-sm font-medium text-slate-200">AI viết lại mỗi nhóm</div>
                <div className="text-xs text-slate-500">{aiReady ? 'Mỗi nhóm 1 nội dung khác — chống trùng/spam' : 'Cần đăng nhập tài khoản để dùng AI'}</div>
              </div>
            </div>
            <Toggle checked={useAi && aiReady} onChange={v => aiReady && setUseAi(v)} />
          </div>

          {/* Xem trước */}
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <div className="border-b border-slate-800 bg-slate-900/50 px-3 py-1.5 text-xs font-medium text-slate-400"><IconWand size={12} className="mr-1 inline" />Xem trước</div>
            <div className="p-3" style={activeBg ? { background: activeBg.color, minHeight: 120, display: 'grid', placeItems: 'center', textAlign: 'center' } : undefined}>
              <div className={`whitespace-pre-wrap text-sm ${activeBg ? 'font-semibold text-white' : 'text-slate-200'}`}>{preview || <span className="text-slate-600">—</span>}</div>
            </div>
            {!activeBg && link.trim() && <div className="px-3 pb-2 text-sm text-indigo-400">{link.trim()}</div>}
            {images.length > 0 && <div className="flex gap-1 px-3 pb-2">{images.slice(0, 4).map((im, i) => <img key={i} src={im.url} className="h-10 w-10 rounded object-cover" alt="" />)}</div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Chờ tối thiểu (giây)"><Input type="number" min={5} value={dMin} onChange={e => setDMin(+e.target.value || 0)} /></Field>
            <Field label="Chờ tối đa (giây)"><Input type="number" min={5} value={dMax} onChange={e => setDMax(+e.target.value || 0)} /></Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <Toggle checked={randomize} onChange={setRandomize} label="Xáo thứ tự nhóm" />
            <Toggle checked={stopOnError} onChange={setStopOnError} label="Dừng khi gặp lỗi" />
          </div>
        </Card>

        {/* Chọn nhóm */}
        <Card className="flex flex-col p-0">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-100">
              <input type="checkbox" checked={pool.length > 0 && pool.every(g => sel.has(g.id))} disabled={!pool.length}
                onChange={() => setSel(pool.length && pool.every(g => sel.has(g.id)) ? new Set() : new Set(pool.map(g => g.id)))}
                className="h-4 w-4 accent-indigo-500" />
              <IconTarget size={15} className="text-indigo-400" /> Chọn nhóm ({sel.size})
            </label>
            <Btn size="sm" variant="ghost" onClick={() => setSel(new Set(s.cfg?.groupIds || []))} disabled={!(s.cfg?.groupIds || []).length}>Theo mục tiêu</Btn>
          </div>
          {pool.length === 0 ? (
            <Empty icon={IconTarget}>Chưa có nhóm. Sang <b>Nhóm của tôi</b> để quét, hoặc <b>Tham gia nhóm</b> để tìm + vào nhóm.</Empty>
          ) : (
            <div className="max-h-[30rem] divide-y divide-slate-800 overflow-y-auto">
              {pool.map(g => (
                <div key={g.id} onClick={() => toggle(g.id)}
                  className={`flex cursor-pointer items-center gap-3 p-2.5 hover:bg-slate-800/40 ${sel.has(g.id) ? 'bg-indigo-500/10' : ''}`}>
                  <input type="checkbox" checked={sel.has(g.id)} readOnly className="pointer-events-none h-4 w-4 shrink-0 accent-indigo-500" />
                  {g.icon
                    ? <img src={g.icon} alt="" className="h-8 w-8 shrink-0 rounded bg-slate-700 object-cover" />
                    : <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-slate-700 text-xs font-semibold text-slate-300">{(g.name || '?')[0]}</div>}
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{g.name}</span>
                  {g.score != null && <Badge color={g.score >= 70 ? 'green' : g.score >= 40 ? 'yellow' : 'gray'}>{g.score}đ</Badge>}
                  {g.url && <a href={g.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-500 hover:text-indigo-400"><IconExternalLink size={14} /></a>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Tiến trình */}
      {results.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-100">Tiến trình {done}/{results.length}</span>
            <span className="text-slate-400">{running ? (wait ? `Chờ ${wait}s…` : 'Đang đăng…') : 'Hoàn tất'}</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {results.map(r => (
              <div key={r.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                {r.status === 'success' ? <IconCheck size={15} className="shrink-0 text-emerald-400" />
                  : r.status === 'error' ? <IconX size={15} className="shrink-0 text-red-400" />
                  : r.status === 'posting' ? <IconRefresh size={15} className="shrink-0 animate-spin text-indigo-400" />
                  : <span className="h-[15px] w-[15px] shrink-0 rounded-full border border-slate-600" />}
                <span className="min-w-0 flex-1 truncate text-slate-200">{r.name}</span>
                {r.status === 'success' && r.url && <a href={r.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-indigo-400 hover:underline">xem bài</a>}
                {r.status === 'error' && <span className="shrink-0 max-w-[45%] truncate text-xs text-red-400">{r.error}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
