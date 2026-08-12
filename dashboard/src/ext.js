// Cầu nối tới extension qua content script dashboard_bridge.js (window.postMessage).
import { runWebCommand } from './webController.js'
let _ready = false
let _extensionVersion = ''
let _seq = 0
const _pending = new Map()
const SIGNAL_PROTOCOL = 1

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data) return
  if (e.data.__shopeReady) { _ready = true; _extensionVersion = String(e.data.version || ''); return }
  if (e.data.__shopeRes) {
    const cb = _pending.get(e.data.id)
    if (cb) { _pending.delete(e.data.id); cb(e.data.res) }
  }
})

// Chủ động hỏi bridge nhiều lần: khắc phục race khi content script và bundle web
// tải theo thứ tự khác nhau trên máy mới hoặc sau khi extension vừa reload.
if (typeof window !== 'undefined') {
  window.postMessage({ __shopeProbe: true }, '*')
  let probeCount = 0
  const probeTimer = setInterval(() => {
    if (_ready || ++probeCount >= 12) return clearInterval(probeTimer)
    window.postMessage({ __shopeProbe: true }, '*')
  }, 500)
}

export function extReady() { return _ready }
export function extensionVersion() { return _extensionVersion }
function versionAtLeast(current, required) {
  const a = String(current || '').split('.').map(x => Number(x) || 0)
  const b = String(required || '').split('.').map(x => Number(x) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0)
  }
  return true
}
const NEEDS_CURRENT_EXTENSION = new Set([
  'START_AUTO', 'AUTO_TICK', 'SCAN_NOW', 'STEP_NOW', 'POST_ITEM', 'START_JOB', 'JOB_TICK',
  'LIST_PAGE_POSTS', 'SCAN_PAGES', 'ADD_PAGE_POSTS_TO_QUEUE', 'SYNC_FACEBOOK_ACTIVITY',
  'SEARCH_GROUPS', 'SEARCH_PAGES', 'LOAD_JOINED_GROUPS', 'JOIN_GROUP', 'LEAVE_GROUP',
  'LIST_POST_COMMENTS', 'HIDE_COMMENT', 'MAKE_LINKS', 'TEST_SHOPEE_SEARCH',
])

function sendSignal(payload, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const id = ++_seq
    const timer = setTimeout(() => { _pending.delete(id); resolve({ ok: false, error: 'timeout: extension chưa cài hoặc chưa load trang này' }) }, timeoutMs)
    _pending.set(id, (res) => { clearTimeout(timer); resolve(res) })
    // v1.5: every feature uses the same versioned signal envelope. Call sites
    // can keep passing { type, ...args }; this adapter owns the wire protocol.
    const { type: action, ...args } = payload || {}
    const signal = {
      protocol: SIGNAL_PROTOCOL,
      signalId: `web_${Date.now().toString(36)}_${id}`,
      sentAt: Date.now(),
      action,
      payload: args,
    }
    window.postMessage({ __shopeReq: true, id, payload: { type: 'WEB_SIGNAL', signal } }, '*')
  })
}

export async function ext(payload, timeoutMs = 20000) {
  try {
    if (NEEDS_CURRENT_EXTENSION.has(payload?.type) && !versionAtLeast(_extensionVersion, '1.5.6')) {
      return { ok: false, error: `Extension ${_extensionVersion || 'không xác định'} đã cũ. Hãy cập nhật/reload ToolMKT AI v1.5.6 trở lên trước khi bật Auto.` }
    }
    const handled = await runWebCommand(payload, sendSignal)
    return handled === null ? sendSignal(payload, timeoutMs) : handled
  } catch (error) {
    return { ok: false, error: String(error?.message || error || 'Lỗi web controller') }
  }
}

// Mở link Facebook: TÁI DÙNG tab facebook.com đang mở (điều hướng tab đó) thay vì luôn mở tab mới.
// Fallback: nếu extension không xử lý được → mở tab mới như bình thường.
export async function openFb(url, e) {
  if (e) { e.preventDefault(); e.stopPropagation() }
  if (!url) return
  const r = await ext({ type: 'OPEN_FB_URL', url })
  if (!r?.ok) window.open(url, '_blank', 'noopener')
}
