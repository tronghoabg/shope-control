// Cầu nối tới extension qua content script dashboard_bridge.js (window.postMessage).
let _ready = false
let _seq = 0
const _pending = new Map()

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data) return
  if (e.data.__shopeReady) { _ready = true; return }
  if (e.data.__shopeRes) {
    const cb = _pending.get(e.data.id)
    if (cb) { _pending.delete(e.data.id); cb(e.data.res) }
  }
})

export function extReady() { return _ready }

export function ext(payload, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const id = ++_seq
    const timer = setTimeout(() => { _pending.delete(id); resolve({ ok: false, error: 'timeout: extension chưa cài hoặc chưa load trang này' }) }, timeoutMs)
    _pending.set(id, (res) => { clearTimeout(timer); resolve(res) })
    window.postMessage({ __shopeReq: true, id, payload }, '*')
  })
}

// Mở link Facebook: TÁI DÙNG tab facebook.com đang mở (điều hướng tab đó) thay vì luôn mở tab mới.
// Fallback: nếu extension không xử lý được → mở tab mới như bình thường.
export async function openFb(url, e) {
  if (e) { e.preventDefault(); e.stopPropagation() }
  if (!url) return
  const r = await ext({ type: 'OPEN_FB_URL', url })
  if (!r?.ok) window.open(url, '_blank', 'noopener')
}
