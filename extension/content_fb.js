// ISOLATED world trên facebook.com — nhận creds từ inject.js (MAIN), cache vào chrome.storage.session,
// và chạy fetch GraphQL TRONG tab thật khi background yêu cầu (an toàn checkpoint: origin/cookie thật).
'use strict';

let CREDS = { token: null, dtsg: null, lsd: null, userName: null, userId: null };

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || !e.data.__shope) return;
  const c = e.data.creds || {};
  if (c.token) CREDS.token = c.token;
  if (c.dtsg)  CREDS.dtsg = c.dtsg;
  if (c.lsd)   CREDS.lsd = c.lsd;
  if (c.userName) CREDS.userName = c.userName;
  if (c.userId)   CREDS.userId = c.userId;
  try {
    chrome.storage.session.set({
      fb_token: CREDS.token, fb_dtsg: CREDS.dtsg, fb_lsd: CREDS.lsd, fb_uid: CREDS.userId, fb_creds_time: Date.now(),
    });
    // Lưu local để giữ lại khi đóng tab FB (token/dtsg/lsd/uid + tên/ID)
    const loc = {};
    if (CREDS.token) { loc.fb_token = CREDS.token; loc.fb_token_time = Date.now(); }
    if (CREDS.dtsg) loc.fb_dtsg = CREDS.dtsg;
    if (CREDS.lsd) loc.fb_lsd = CREDS.lsd;
    if (CREDS.userId) loc.fb_uid = CREDS.userId;
    if (CREDS.userName || CREDS.userId) loc.fb_user = { name: CREDS.userName, id: CREDS.userId, time: Date.now() };
    if (Object.keys(loc).length) chrome.storage.local.set(loc);
  } catch {}
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SHOPE_GET_CREDS') {
    sendResponse(CREDS);
    return true;
  }
  // Thực thi fetch ngay trong tab này (same-origin facebook.com + cookie phiên user)
  if (msg?.type === 'SHOPE_FETCH') {
    const { url, method = 'POST', body, headers } = msg;
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
  }
});
