// Content script chạy trên web app (localhost:5173) — cầu nối window.postMessage ↔ background.
// Nhờ vậy app React không cần biết extension ID.
'use strict';

// Context còn sống không? (sau khi reload extension, content script cũ bị vô hiệu → mọi chrome.* ném lỗi)
function alive() {
  try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch { return false; }
}

function reply(id, res) {
  try { window.postMessage({ __shopeRes: true, id, res }, '*'); } catch {}
}

function onMsg(e) {
  if (e.source !== window || !e.data || e.data.__shopeReq !== true) return;
  const { id, payload } = e.data;

  // Context đã chết → trả lỗi nhẹ + GỠ listener để bản mồ côi ngừng bắn lỗi.
  if (!alive()) {
    reply(id, { ok: false, error: 'Extension vừa tải lại — hãy F5 trang này' });
    window.removeEventListener('message', onMsg);
    return;
  }

  try {
    chrome.runtime.sendMessage(payload, (res) => {
      // Truy cập lastError cũng có thể ném "context invalidated" → bọc try/catch.
      let err;
      try { err = chrome.runtime.lastError; } catch { err = { message: 'context invalidated' }; }
      reply(id, res || { ok: false, error: (err && err.message) || 'no_response' });
    });
  } catch (err) {
    reply(id, { ok: false, error: String((err && err.message) || err) });
  }
}

window.addEventListener('message', onMsg);

// Báo cho app biết extension đã sẵn sàng (để app load ngay, khỏi đợi timeout).
try {
  if (alive()) window.postMessage({ __shopeReady: true, version: chrome.runtime.getManifest().version }, '*');
} catch {}
