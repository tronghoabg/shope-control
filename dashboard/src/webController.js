const STORE_KEY = 'toolmkt_web_state_v15'
let executorCfg = {}
const OWNED_KEYS = [
  'cfg', 'catalog', 'discoveredGroups', 'groupsSyncedAt', 'searchResults', 'searchAt',
  'searchCursors', 'searchKeywords', 'searchHasMore', 'targetPages', 'pageSearchResults',
  'pageSearchCursors', 'pageSearchKeywords', 'pageHasMore', 'savedGroupLists',
  'savedPageLists', 'savedPosts', 'queue', 'commentHistory', 'state', 'stats', 'job',
]

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {} } catch { return {} }
}
function save(patch) {
  const next = { ...load(), ...patch, updatedAt: Date.now(), schemaVersion: 1 }
  localStorage.setItem(STORE_KEY, JSON.stringify(next))
  return next
}
function id(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
async function ai(task, args) {
  const cfg = load().cfg || {}
  const r = await fetch((cfg.webBase || location.origin).replace(/\/$/, '') + '/api/ai/task', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (cfg.licenseToken || '') },
    body: JSON.stringify({ task, args }),
  })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `AI lỗi ${r.status}`); return j.result
}
async function usage(method = 'GET', posted) {
  const cfg = load().cfg || {}; if (!cfg.licenseToken) return { ok: true, remaining: -1 }
  try {
    const r = await fetch((cfg.webBase || location.origin).replace(/\/$/, '') + '/api/usage', { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.licenseToken }, body: method === 'POST' ? JSON.stringify({ posted }) : undefined })
    const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, ...j }
  } catch { return { ok: true, remaining: -1, offline: true } }
}
function keywordOk(text, required, banned) {
  const value = String(text || '').toLowerCase()
  const bad = String(banned || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  if (bad.some(x => value.includes(x))) return false
  const req = String(required || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  return !req.length || req.some(x => value.includes(x))
}
function candidates(text, catalog) {
  const words = new Set(String(text || '').toLowerCase().split(/\W+/).filter(x => x.length > 2))
  return (catalog || []).map(p => ({ p, score: (p.keywords || []).reduce((n, k) => n + (String(text).toLowerCase().includes(String(k).toLowerCase()) ? 3 : 0), 0) + String(p.name || '').toLowerCase().split(/\W+/).reduce((n, w) => n + (words.has(w) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score).slice(0, 8).map(x => x.p)
}

async function scanGroups(execute, fresh = false, limitGroups = Infinity) {
  const st = load(), cfg = st.cfg || {}, ids = cfg.groupIds || []
  if (!ids.length) return { ok: false, error: 'Chưa chọn nhóm mục tiêu' }
  const queue = [...(st.queue || [])], seen = new Set(queue.map(x => String(x.postId)))
  const commented = new Set((st.commentHistory || []).map(x => String(x.postId)))
  const cursors = { ...(st.groupCursors || {}) }; let added = 0, firstError = null
  const countGroups = Math.min(ids.length, limitGroups), start = Number(st.groupIdx || 0) % ids.length
  const selectedIds = Array.from({ length: countGroups }, (_, n) => ids[(start + n) % ids.length])
  for (const groupId of selectedIds) {
    const r = await execute({ type: 'EXEC_FETCH_GROUP_FEED', groupId, cursor: fresh ? null : cursors[groupId], count: cfg.postsPerScan || 5 }, 120000)
    if (!r?.ok) { firstError ||= r?.error || 'Không đọc được feed nhóm'; continue }
    cursors[groupId] = fresh ? null : (r.feed?.nextCursor || null)
    for (const post of (r.feed?.posts || [])) {
      if (seen.has(String(post.postId)) || commented.has(String(post.postId)) || !keywordOk(post.text, cfg.requiredKeywords, cfg.bannedKeywords)) continue
      const cls = await ai('classify', { text: post.text, group: groupId, mode: cfg.mode || 'affiliate', seed: cfg.seedContent || '' })
      if (!cls?.potential || Number(cls.score || 0) < Number(cfg.minScore || 60)) continue
      let made
      if (cfg.mode === 'social') made = cfg.seedContent
        ? await ai('varySeed', { text: post.text, group: groupId, seed: cfg.seedContent, tone: cfg.tone })
        : await ai('social', { text: post.text, group: groupId, tone: cfg.tone })
      else {
        let picks
        if (cfg.productSource === 'shopee') {
          const wanted = await ai('searchKeyword', { text: post.text, group: groupId })
          if (!wanted?.wantProduct || !wanted.keyword) continue
          const sr = await execute({ type: 'EXEC_SEARCH_SHOPEE', keyword: wanted.keyword, limit: cfg.shopeeLimit || 10 }, 120000)
          picks = (sr?.items || []).slice(0, 8).map((p, i) => ({ id: `sp${i}`, name: p.name, category: '', price: Math.round(p.price || 0), keywords: [], link: p.productUrl }))
        } else picks = candidates(post.text, st.catalog || [])
        if (!picks.length) continue
        made = await ai('suggestProduct', { text: post.text, group: groupId, tone: cfg.tone, candidates: picks })
        if (cfg.productSource === 'shopee' && made?.link) {
          const lr = await execute({ type: 'EXEC_MAKE_AFFILIATE_LINKS', links: [made.link], subId: cfg.subId || '' }, 120000)
          const short = lr?.results?.[0]?.shortLink
          if (!short) continue
          made.comment = String(made.comment || '').split(made.link).join(short); made.link = short
        }
      }
      if (made?.skip || !made?.comment) continue
      queue.push({ ...post, groupId: String(groupId), groupName: (st.discoveredGroups || []).find(g => String(g.groupId) === String(groupId))?.name || `Nhóm ${groupId}`, comment: made.comment, link: made.link || null, productName: made.productName || null, score: cls.score || made.score || 0, mode: cfg.mode || 'affiliate', approved: false, addedAt: Date.now() })
      seen.add(String(post.postId)); added++
    }
  }
  save({ queue, groupCursors: cursors, groupIdx: (start + countGroups) % ids.length })
  if (!added && firstError) return { ok: false, error: firstError, queued: 0 }
  return { ok: true, queued: added }
}

async function postQueueItem(postId, execute) {
  const st = load(), queue = [...(st.queue || [])], at = queue.findIndex(x => String(x.postId) === String(postId))
  if (at < 0) return { ok: false, error: 'Không tìm thấy bài trong hàng chờ' }
  const item = queue[at], cfg = { ...(st.cfg || {}), ...executorCfg }
  if (!String(item.comment || '').trim() && !cfg.commentImageBase64 && !cfg.commentVideoKey) return { ok: false, error: 'Nội dung comment rỗng' }
  const quota = await usage(); if (!quota.ok || quota.remaining === 0) return { ok: false, quotaBlocked: true, error: quota.error || 'Đã hết hạn mức hôm nay' }
  const r = await execute({ type: 'EXEC_POST_COMMENT', item, message: item.comment, imageBase64: item.mode === 'social' ? cfg.commentImageBase64 : '', videoKey: item.mode === 'social' ? cfg.commentVideoKey : '' }, 240000)
  if (!r?.ok) return r
  queue.splice(at, 1); const history = [{ ...item, time: Date.now() }, ...(st.commentHistory || [])].slice(0, 500)
  let state = st.state || {}; const key = todayKey(); if (state.dateKey !== key) state = { ...state, dateKey: key, doneToday: 0 }
  const lo = Math.max(90, Number(st.cfg?.minDelaySec || 90)), hi = Math.max(lo, Number(st.cfg?.maxDelaySec || lo))
  state = { ...state, doneToday: Number(state.doneToday || 0) + 1, nextActionAt: Date.now() + (lo + Math.floor(Math.random() * (hi - lo + 1))) * 1000 }
  save({ queue, commentHistory: history, state, stats: { ...(st.stats || {}), totalCommented: Number(st.stats?.totalCommented || 0) + 1, lastRunAt: Date.now(), lastError: '' } })
  await usage('POST', { mode: item.mode || 'comment', groupId: item.isPage ? item.pageId : item.groupId, groupName: item.isPage ? item.pageName : item.groupName, postId: item.postId, content: item.comment, link: item.link || '', permalink: item.permalink || '' })
  return { ok: true, result: r.result }
}

function spin(text) { return String(text || '').replace(/\{([^{}]+)\}/g, (_, x) => { const a = x.split('|'); return a[Math.floor(Math.random() * a.length)] }) }
async function jobTick(execute) {
  const st = load(), job = st.job
  if (!job?.running || job.paused || Date.now() < Number(job.nextAt || 0)) return { ok: true }
  if (job.idx >= job.total) { save({ job: { ...job, running: false, finishedAt: Date.now() } }); return { ok: true } }
  const i = job.idx, target = job.items[i]; let r
  if (job.kind === 'comment') r = await postQueueItem(target, execute)
  else if (job.kind === 'join') r = await execute({ type: 'EXEC_JOIN_GROUP', groupId: target }, 120000)
  else {
    const p = job.params || {}, variants = p.variants?.length ? p.variants : [p.content || '']; let message = spin(variants[i % variants.length])
    if (p.useAi && message) message = await ai('rewrite', { text: message })
    // Media upload still requires the extension media executor; reuse POST_GROUP
    // only for that exceptional path until upload ids are prepared by web.
    r = (p.images?.length || p.videoKey)
      ? await execute({ type: 'POST_GROUP', groupId: target, message, link: p.link, images: p.images, videoKey: p.videoKey, bgPresetId: p.bgPresetId }, 240000)
      : await execute({ type: 'EXEC_CREATE_GROUP_POST', groupId: target, message, link: p.link, bgPresetId: p.bgPresetId }, 120000)
  }
  const results = job.results.map((x, n) => n === i ? { ...x, status: r?.ok ? 'success' : 'error', error: r?.error || '', url: r?.postUrl || r?.result?.postUrl || x.url } : x)
  const lo = Math.max(20, Number(job.delayMin || 90)), hi = Math.max(lo, Number(job.delayMax || lo))
  const next = { ...job, idx: i + 1, results, consec: r?.ok ? 0 : Number(job.consec || 0) + 1, nextAt: Date.now() + (lo + Math.floor(Math.random() * (hi - lo + 1))) * 1000 }
  if (next.idx >= next.total || next.consec >= 3 || (!r?.ok && job.params?.stopOnError)) { next.running = false; next.finishedAt = Date.now() }
  save({ job: next }); return { ok: true, result: r }
}

function migrate(legacy) {
  const current = load()
  if (current.schemaVersion) {
    if (current.cfg && 'commentImageBase64' in current.cfg) {
      const cfg = { ...current.cfg }; delete cfg.commentImageBase64; return save({ cfg })
    }
    return current
  }
  const initial = {}
  for (const key of OWNED_KEYS) if (legacy?.[key] != null) initial[key] = legacy[key]
  if (initial.cfg) { initial.cfg = { ...initial.cfg }; delete initial.cfg.commentImageBase64 }
  return save(initial)
}

function mergedState(legacy) {
  const web = migrate(legacy)
  const out = { ...legacy }
  for (const key of OWNED_KEYS) if (web[key] != null) out[key] = web[key]
  // Large attachment data remains in unlimited chrome.storage. Merge instead
  // of replacing cfg so the web-owned settings do not hide executor-only data.
  out.cfg = { ...(legacy?.cfg || {}), ...(web.cfg || {}) }
  out.owner = 'web-v1.5'
  return out
}

async function searchMany(raw, execute, action, resultKey, cursorKey, more) {
  const st = load()
  const keywords = more ? (st[resultKey === 'groups' ? 'searchKeywords' : 'pageSearchKeywords'] || [])
    : String(raw || '').split(',').map(x => x.trim()).filter(Boolean)
  if (!keywords.length) return { ok: false, error: 'Chưa nhập từ khóa' }
  const oldCursors = more ? (st[cursorKey] || {}) : {}
  const existing = more ? (st[resultKey === 'groups' ? 'searchResults' : 'pageSearchResults'] || []) : []
  const byId = new Map(existing.map(x => [String(x.groupId || x.pageId), x]))
  const cursors = { ...oldCursors }
  for (const keyword of keywords) {
    if (more && keyword in oldCursors && !oldCursors[keyword]) continue
    const r = await execute({ type: action, keyword, cursor: more ? oldCursors[keyword] : null }, 120000)
    if (!r?.ok) return r
    for (const item of (r[resultKey] || [])) byId.set(String(item.groupId || item.pageId), item)
    cursors[keyword] = r.nextCursor || null
  }
  const values = [...byId.values()]
  const isGroups = resultKey === 'groups'
  save(isGroups
    ? { searchResults: values, searchKeywords: keywords, searchCursors: cursors, searchHasMore: Object.values(cursors).some(Boolean), searchAt: Date.now() }
    : { pageSearchResults: values, pageSearchKeywords: keywords, pageSearchCursors: cursors, pageHasMore: Object.values(cursors).some(Boolean) })
  return { ok: true, count: values.length, [resultKey]: values }
}

// Returns null when the command still belongs to an extension-only executor or
// to the temporary background failover state machine.
export async function runWebCommand(payload, execute) {
  const type = payload?.type
  if (type === 'GET_STATE') { const legacy = await execute(payload); executorCfg = { ...(legacy?.cfg || {}) }; return mergedState(legacy) }
  if (type === 'AI_REWRITE') { const text = await ai('rewrite', { text: payload.text || '' }); return { ok: !!text, text, error: text ? '' : 'AI không trả nội dung' } }
  if (type === 'TEST_AI') { const result = await ai('test', {}); return { ok: true, result } }
  if (type === 'GET_GROUPS') { const st = load(); return { ok: true, groups: st.discoveredGroups || [], syncedAt: st.groupsSyncedAt || 0 } }
  if (type === 'CLEAR_POSTED') { save({ commentHistory: [] }); return { ok: true } }
  if (type === 'RESET_HISTORY') { save({ commentHistory: [], queue: [] }); return { ok: true } }
  if (type === 'SCAN_NOW') return scanGroups(execute, true)
  if (type === 'POST_ITEM') return postQueueItem(payload.postId, execute)
  if (type === 'STEP_NOW') {
    const q = load().queue || []; if (!q.length) await scanGroups(execute, true, 1)
    const item = (load().queue || [])[0]
    return item ? postQueueItem(item.postId, execute) : { ok: true, result: { skipped: 'Không có bài phù hợp' } }
  }
  if (type === 'START_AUTO') {
    const st = load(); if (st.job?.running) return { ok: false, error: 'Đang có chiến dịch chạy — hãy dừng trước khi bật Auto' }
    const cfg = { ...(st.cfg || {}), autoEnabled: true, killSwitch: false }
    save({ cfg }); await execute({ type: 'EXEC_CONFIGURE_FAILOVER', autoEnabled: true, killSwitch: false })
    return { ok: true }
  }
  if (type === 'STOP_AUTO' || type === 'KILL') {
    const kill = type === 'KILL', st = load(), cfg = { ...(st.cfg || {}), autoEnabled: false, ...(kill ? { killSwitch: true } : {}) }
    save({ cfg }); await execute({ type: 'EXEC_CONFIGURE_FAILOVER', autoEnabled: false, killSwitch: kill })
    return { ok: true }
  }
  if (type === 'AUTO_TICK') {
    const st = load(), cfg = st.cfg || {}; let state = st.state || {}, key = todayKey()
    if (!cfg.autoEnabled || cfg.killSwitch) return { ok: true, result: { skipped: 'Auto tắt' } }
    if (state.dateKey !== key) { state = { ...state, dateKey: key, doneToday: 0 }; save({ state }) }
    if (Number(state.doneToday || 0) >= Number(cfg.dailyCap || 30)) return { ok: true, result: { skipped: 'Đạt cap ngày' } }
    if (Date.now() < Number(state.nextActionAt || 0)) return { ok: true, result: { skipped: 'Đang chờ delay' } }
    if (!(load().queue || []).length) await scanGroups(execute, false, 1)
    const queue = load().queue || []
    const item = cfg.requireApproval ? queue.find(x => x.approved) : queue[0]
    if (!item) return { ok: true, result: { skipped: queue.length ? 'Chờ duyệt' : 'Không có bài phù hợp' } }
    const result = await postQueueItem(item.postId, execute); return { ok: result.ok, result, error: result.error }
  }
  if (type === 'START_JOB') {
    if (!['comment', 'join', 'postgroup'].includes(payload.kind)) return { ok: false, error: 'Loại chiến dịch không hợp lệ' }
    if (load().cfg?.autoEnabled && !load().cfg?.killSwitch) return { ok: false, error: 'Đang bật Auto — hãy tắt trước khi chạy chiến dịch' }
    const items = [...new Set((payload.items || []).filter(Boolean).map(String))]
    if (!items.length) return { ok: false, error: 'Không có mục để chạy' }
    const old = load().job; if (old?.running) return { ok: false, error: 'Đang có chiến dịch chạy' }
    const params = payload.params || {}, delayMin = Math.max(payload.kind === 'join' ? 20 : 90, Number(params.delayMin || 90))
    const job = { running: true, paused: false, kind: payload.kind, items, idx: 0, total: items.length, params, delayMin, delayMax: Math.max(delayMin, Number(params.delayMax || delayMin)), nextAt: 0, consec: 0, startedAt: Date.now(), results: items.map(x => ({ id: x, name: String(x), status: 'pending', error: '' })) }
    save({ job }); setTimeout(() => { jobTick(execute).catch(error => save({ job: { ...(load().job || job), running: false, stoppedMsg: String(error?.message || error) } })) }, 0); return { ok: true, job }
  }
  if (type === 'JOB_TICK') return jobTick(execute)
  if (type === 'JOB_STOP' || type === 'JOB_PAUSE' || type === 'JOB_RESUME' || type === 'JOB_SKIP_WAIT' || type === 'JOB_CLEAR') {
    const job = load().job
    if (type === 'JOB_CLEAR' && !job?.running) { save({ job: null }); return { ok: true } }
    if (!job) return { ok: true }
    const patch = type === 'JOB_STOP' ? { running: false, paused: false, stoppedMsg: 'Đã dừng theo yêu cầu.' }
      : type === 'JOB_PAUSE' ? { paused: true }
      : type === 'JOB_RESUME' ? { paused: false }
      : type === 'JOB_SKIP_WAIT' ? { nextAt: 0 } : {}
    save({ job: { ...job, ...patch } }); return { ok: true }
  }
  if (type === 'APPROVE_ITEM' || type === 'REJECT_ITEM' || type === 'EDIT_ITEM' || type === 'APPROVE_ALL' || type === 'CLEAR_QUEUE') {
    let queue = [...(load().queue || [])]
    if (type === 'APPROVE_ITEM') queue = queue.map(x => String(x.postId) === String(payload.postId) ? { ...x, approved: true } : x)
    if (type === 'REJECT_ITEM') queue = queue.filter(x => String(x.postId) !== String(payload.postId))
    if (type === 'EDIT_ITEM') queue = queue.map(x => String(x.postId) === String(payload.postId) ? { ...x, comment: payload.comment } : x)
    if (type === 'APPROVE_ALL') queue = queue.map(x => ({ ...x, approved: true }))
    if (type === 'CLEAR_QUEUE') queue = payload.scope === 'group' ? queue.filter(x => x.isPage) : payload.scope === 'page' ? queue.filter(x => !x.isPage) : []
    save({ queue }); return { ok: true, remaining: queue.length }
  }
  if (type === 'SET_CFG') {
    executorCfg = { ...executorCfg, ...(payload.cfg || {}) }
    const st = load(), webPatch = { ...(payload.cfg || {}) }
    delete webPatch.commentImageBase64
    save({ cfg: { ...(st.cfg || {}), ...webPatch } })
    return execute(payload) // mirror only the executor/failover settings
  }
  if (type === 'IMPORT_CSV') {
    const lines = String(payload.csv || '').split(/\r?\n/).filter(Boolean)
    if (!lines.length) return { ok: false, error: 'CSV rỗng' }
    const head = lines[0].split(',').map(x => x.trim().toLowerCase())
    const products = lines.slice(1).map((line, i) => {
      const cols = line.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map(x => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) || []
      const o = {}; head.forEach((h, n) => { o[h] = cols[n] || '' })
      return { id: o.id || `p_${i + 1}`, name: o.name || '', category: o.category || '', price: Number(o.price || 0), link: o.link || '', keywords: String(o.keywords || '').split(/[|;]/).map(x => x.trim()).filter(Boolean) }
    }).filter(x => x.name || x.link)
    save({ catalog: products }); return { ok: true, count: products.length, products }
  }
  if (type === 'GET_CATALOG') return { ok: true, products: load().catalog || [] }
  if (type === 'SAVE_CATALOG_ITEM') {
    const st = load(), item = payload.item || {}, list = [...(st.catalog || [])]
    const at = list.findIndex(x => x.id === item.id); if (at >= 0) list[at] = item; else list.unshift(item)
    save({ catalog: list }); return { ok: true, products: list }
  }
  if (type === 'DELETE_CATALOG_ITEM' || type === 'CLEAR_CATALOG') {
    const list = type === 'CLEAR_CATALOG' ? [] : (load().catalog || []).filter(x => x.id !== payload.id)
    save({ catalog: list }); return { ok: true }
  }
  if (type === 'SET_TARGETS') {
    const st = load(); save({ cfg: { ...(st.cfg || {}), groupIds: [...new Set(payload.groupIds || [])] } })
    return execute(payload) // temporary mirror for background failover
  }
  if (type === 'SET_TARGET_PAGES') { save({ targetPages: payload.pages || [] }); return execute(payload) }
  if (type === 'LOAD_JOINED_GROUPS' || type === 'DISCOVER_GROUPS') {
    const r = await execute({ type: 'EXEC_GET_JOINED_GROUPS', opts: payload.opts || {} }, 180000)
    if (r?.ok) {
      save({ discoveredGroups: r.groups || [], groupsSyncedAt: Date.now() })
      await execute({ type: 'RESTORE_GROUPS', snapshot: { discoveredGroups: r.groups || [], groupsSyncedAt: Date.now() } })
    }
    return { ...r, count: r?.groups?.length || 0 }
  }
  if (type === 'SCORE_GROUPS') {
    const st = load(), groups = st.discoveredGroups || []
    const result = await ai('analyzeGroups', { groups: groups.map(g => ({ name: g.name, memberCount: g.memberCount })), catalogContext: (st.catalog || []).map(p => `${p.category}: ${p.name}`).join('; '), goal: payload.goal || '' })
    const scored = groups.map((g, i) => ({ ...g, ...(result?.find?.(x => Number(x.i) === i) || {}) }))
    save({ discoveredGroups: scored }); return { ok: true, count: scored.length, groups: scored }
  }
  if (type === 'SUGGEST_NICHES') {
    const keywords = await ai('suggestNiches', { catalog: load().catalog || [] }); return { ok: true, keywords }
  }
  if (type === 'SEARCH_GROUPS') return searchMany(payload.keyword, execute, 'EXEC_SEARCH_GROUPS', 'groups', 'searchCursors', !!payload.more)
  if (type === 'SEARCH_PAGES') return searchMany(payload.keyword, execute, 'EXEC_SEARCH_PAGES', 'pages', 'pageSearchCursors', !!payload.more)
  if (type === 'JOIN_GROUP') return execute({ type: 'EXEC_JOIN_GROUP', groupId: payload.groupId }, 60000)
  if (type === 'LEAVE_GROUP') {
    const r = await execute({ type: 'EXEC_LEAVE_GROUP', groupId: payload.groupId }, 60000)
    if (r?.ok) {
      const st = load(), gid = String(payload.groupId)
      save({ discoveredGroups: (st.discoveredGroups || []).filter(x => String(x.groupId) !== gid), cfg: { ...(st.cfg || {}), groupIds: (st.cfg?.groupIds || []).filter(x => String(x) !== gid) } })
    }
    return r
  }
  if (type === 'LIST_PAGE_POSTS') {
    const pages = payload.pages?.length ? payload.pages : (load().targetPages || []), posts = []
    for (const page of pages) {
      const r = await execute({ type: 'EXEC_FETCH_PAGE_FEED', pageId: page.pageId, count: payload.count || 8 }, 120000)
      if (r?.ok) for (const p of (r.feed?.posts || [])) posts.push({ ...p, pageId: String(page.pageId), pageName: page.name || '' })
    }
    return { ok: true, posts }
  }
  if (type === 'SCAN_PAGES') {
    const st = load(), cfg = st.cfg || {}, queue = [...(st.queue || [])], seen = new Set(queue.map(x => String(x.postId))), commented = new Set((st.commentHistory || []).map(x => String(x.postId))); let added = 0, firstError = null
    for (const page of (st.targetPages || [])) {
      const r = await execute({ type: 'EXEC_FETCH_PAGE_FEED', pageId: page.pageId, count: cfg.postsPerScan || 5 }, 120000)
      if (!r?.ok) { firstError ||= r?.error || 'Không đọc được feed Page'; continue }
      for (const post of (r.feed?.posts || [])) {
        if (seen.has(String(post.postId)) || commented.has(String(post.postId)) || !keywordOk(post.text, cfg.requiredKeywords, cfg.bannedKeywords)) continue
        const cls = await ai('classify', { text: post.text, group: page.pageId, mode: 'social', seed: cfg.seedContent || '' })
        if (!cls?.potential || Number(cls.score || 0) < Number(cfg.minScore || 60)) continue
        const made = cfg.seedContent ? await ai('varySeed', { text: post.text, group: page.pageId, seed: cfg.seedContent, tone: cfg.tone }) : await ai('social', { text: post.text, group: page.pageId, tone: cfg.tone })
        if (made?.skip || !made?.comment) continue
        queue.push({ ...post, pageId: String(page.pageId), pageName: page.name || '', isPage: true, mode: 'social', comment: made.comment, score: cls.score, approved: false, addedAt: Date.now() }); seen.add(String(post.postId)); added++
      }
    }
    save({ queue }); if (!added && firstError) return { ok: false, error: firstError, queued: 0 }; return { ok: true, queued: added }
  }
  if (type === 'ADD_PAGE_POSTS_TO_QUEUE') {
    const st = load(), queue = [...(st.queue || [])], seen = new Set(queue.map(x => String(x.postId))); let added = 0
    for (const p of (payload.posts || [])) if (p.postId && !seen.has(String(p.postId))) {
      queue.push({ ...p, postId: String(p.postId), pageId: String(p.pageId || ''), isPage: true, manual: true, mode: 'social', approved: false, addedAt: Date.now() }); seen.add(String(p.postId)); added++
    }
    save({ queue }); return { ok: true, added }
  }
  if (type === 'LIST_POST_COMMENTS') return execute({ type: 'EXEC_LIST_COMMENTS', postId: payload.postId, cursor: payload.cursor }, 60000)
  if (type === 'HIDE_COMMENT') return execute({ type: 'EXEC_HIDE_COMMENT', commentId: payload.commentId }, 30000)
  if (type === 'MAKE_LINKS') return execute({ type: 'EXEC_MAKE_AFFILIATE_LINKS', links: payload.links, subId: payload.subId }, 120000)
  if (type === 'TEST_SHOPEE_SEARCH') return execute({ type: 'EXEC_SEARCH_SHOPEE', keyword: payload.keyword, limit: payload.limit, focus: payload.focus }, 60000)

  const listOps = {
    SAVE_GROUP_LIST: ['savedGroupLists', { id: id('gl'), name: payload.name || 'Danh sách', groupIds: [...new Set(payload.groupIds || [])], createdAt: Date.now() }],
    SAVE_PAGE_LIST: ['savedPageLists', { id: id('pl'), name: payload.name || 'Danh sách', pages: payload.pages || [], createdAt: Date.now() }],
    SAVE_POST: ['savedPosts', { ...(payload.post || {}), id: payload.post?.id || id('pp'), createdAt: payload.post?.createdAt || Date.now() }],
  }
  if (listOps[type]) {
    const [key, item] = listOps[type], old = load()[key] || [], at = old.findIndex(x => x.id === item.id)
    const next = [...old]; if (at >= 0) next[at] = { ...next[at], ...item }; else next.unshift(item)
    save({ [key]: next }); return { ok: true, list: item, post: item, updated: at >= 0 }
  }
  const deletes = { DELETE_GROUP_LIST: 'savedGroupLists', DELETE_PAGE_LIST: 'savedPageLists', DELETE_POST: 'savedPosts' }
  if (deletes[type]) { const key = deletes[type]; save({ [key]: (load()[key] || []).filter(x => x.id !== payload.id) }); return { ok: true } }
  const renames = { RENAME_GROUP_LIST: 'savedGroupLists', RENAME_PAGE_LIST: 'savedPageLists' }
  if (renames[type]) { const key = renames[type]; save({ [key]: (load()[key] || []).map(x => x.id === payload.id ? { ...x, name: payload.name } : x) }); return { ok: true } }
  return null
}
