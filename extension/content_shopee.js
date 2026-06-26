// ISOLATED world trên shopee.vn — chạy fetch TRONG tab thật khi background yêu cầu
// (same-origin + cookie phiên user → search_items không bị chặn như gọi từ service worker).
'use strict';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'SHOPE_FETCH') return;
  const { url, method = 'GET', body, headers } = msg;
  fetch(url, {
    method,
    credentials: 'include',
    headers: headers || {},
    body: method !== 'GET' ? body : undefined,
  })
    .then(r => r.text())
    .then(text => sendResponse({ ok: true, data: text }))
    .catch(err => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true;
});
