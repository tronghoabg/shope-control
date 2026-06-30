// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  background.js — Service worker điều phối                                   ║
// ║  • Lấy creds FB (token/dtsg) từ tab thật  • Gọi API AI local                ║
// ║  • Scheduler an toàn: cap/ngày + delay ngẫu nhiên + kill-switch + chống trùng║
// ╚══════════════════════════════════════════════════════════════════════════╝
'use strict';
importScripts('catalog.js', 'ai.js', 'fb_api.js', 'shopee.js');

const TICK_ALARM = 'shope_tick';

// ─── Cấu hình mặc định ───────────────────────────────────────────────────────
const DEFAULTS = {
  // AI dùng KEY HỆ THỐNG qua web (/api/ai/task) — không còn provider/key riêng ở extension.
  autoEnabled: false,
  killSwitch: false,
  dailyCap: 30,               // tối đa comment/ngày
  minDelaySec: 90,            // delay tối thiểu giữa 2 comment
  maxDelaySec: 240,           // delay tối đa
  minScore: 60,               // ngưỡng điểm tiềm năng để comment
  postsPerScan: 5,            // số bài đọc mỗi nhóm mỗi lần quét
  groupIds: [],               // danh sách id nhóm mục tiêu
  tone: 'tự nhiên, thân thiện',
  requireApproval: true,      // true = chỉ đăng item đã được duyệt trong web app
  mode: 'affiliate',          // 'affiliate' = rải link Shopee · 'social' = comment dạo (không link, không cần catalog)
  seedContent: '',            // Comment dạo: nội dung tìm khách có sẵn → AI đổi lại mỗi bài (rỗng = AI tự soạn theo bài)
  shopeeFocusTab: true,       // Rải link Shopee: focus tab Shopee 1 nhịp khi tìm SP (chống tab nền bị đóng băng). Tắt để test.
  licenseToken: '',           // token tài khoản (lấy ở web Dashboard) — để đồng bộ hạn mức free/Pro
  webBase: 'https://toolmktai.com', // địa chỉ web SaaS production (auto-link sẽ ghi đè theo origin khi mở /app)
  productSource: 'catalog',   // (chế độ affiliate) 'catalog' = CSV tự nạp · 'shopee' = AI tự nghĩ SP + search Shopee + dựng link
  affiliateId: '',            // ID tiếp thị liên kết Shopee (dùng dựng link hoa hồng cho nguồn 'shopee')
  subId: '',                  // sub_id tracking (tối đa 5 giá trị, cách nhau '-'); để trống cũng được
  shopeeLimit: 10,            // số SP lấy về mỗi lần search Shopee
};

// Lỗi AI "cứng" → dừng cả mẻ quét/đăng + báo rõ (thay vì lặp lỗi từng nhóm).
const HARD_AI_ERRORS = new Set(['AI_CAP', 'NO_SYSTEM_KEY', 'BANNED', 'RATE_LIMIT', 'TOO_LARGE', 'UNAUTHORIZED']);

async function getCfg() {
  const s = await chrome.storage.local.get(['cfg', 'state', 'stats', 'commentedPosts', 'queue', 'catalog', 'discoveredGroups', 'groupsSyncedAt', 'logs', 'searchResults', 'searchAt', 'commentHistory', 'progress', 'license', 'savedGroupLists', 'savedPosts', 'targetPages', 'savedPageLists', 'pageSearchResults']);
  return {
    savedGroupLists: s.savedGroupLists || [],   // [{ id, name, groupIds:[], createdAt }]
    savedPosts: s.savedPosts || [],             // [{ id, title, content, link, bgPresetId, createdAt }]
    targetPages: s.targetPages || [],           // [{ pageId, name, url, icon }] — page mục tiêu comment dạo
    savedPageLists: s.savedPageLists || [],     // [{ id, name, pages:[{pageId,name,url,icon}], createdAt }]
    pageSearchResults: s.pageSearchResults || [], // [{ pageId, name, url, icon, snippet }]
    progress: s.progress || { active: false, phase: '', label: '', current: 0, total: 0, updatedAt: 0 },
    cfg: { ...DEFAULTS, ...(s.cfg || {}) },
    state: { dateKey: '', doneToday: 0, nextActionAt: 0, groupIdx: 0, cursor: null, ...(s.state || {}) },
    stats: { totalCommented: 0, lastRunAt: 0, lastError: '', ...(s.stats || {}) },
    commentedPosts: s.commentedPosts || {},
    queue: s.queue || [],   // [{ feedbackId, postId, comment, groupId, score }]
    catalog: s.catalog || [],
    discoveredGroups: s.discoveredGroups || [],   // [{ groupId, name, score, potential, reason, ... }]
    groupsSyncedAt: s.groupsSyncedAt || 0,
    logs: s.logs || [],     // [{ t, level, msg }] — nhật ký hoạt động (mới nhất ở cuối)
    searchResults: s.searchResults || [],   // [{ groupId, name, memberCount, score, niche, joined, ... }]
    searchAt: s.searchAt || 0,
    commentHistory: s.commentHistory || [], // [{ postId, groupId, productName, link, comment, permalink, time }] mới nhất đầu
    license: s.license || { linked: false }, // trạng thái tài khoản/quota web
  };
}
async function save(part) { await chrome.storage.local.set(part); }

// Nhật ký hoạt động (giữ 200 dòng gần nhất, bền qua reload)
// opts: { group: '<nhãn nhóm>', kind: 'group'|'post' } → để UI render phân cấp.
async function pushLog(level, msg, opts = {}) {
  try {
    const { logs = [] } = await chrome.storage.local.get('logs');
    const entry = { t: Date.now(), level, msg: String(msg).slice(0, 300) };
    if (opts.group) entry.group = String(opts.group).slice(0, 80);
    if (opts.kind) entry.kind = opts.kind;
    logs.push(entry);
    while (logs.length > 250) logs.shift();
    await chrome.storage.local.set({ logs });
  } catch {}
}

// ─── Tiến trình trực tiếp (cho thanh progress trong web app) ──────────────────
// phase: 'scan'|'discover'|'search'|'post' · current/total = bước/tổng · label = mô tả.
async function setProgress(p) {
  try {
    const prev = (await chrome.storage.local.get('progress')).progress || {};
    await chrome.storage.local.set({ progress: { active: true, ...prev, ...p, updatedAt: Date.now() } });
  } catch {}
}
async function endProgress(label) {
  try { await chrome.storage.local.set({ progress: { active: false, phase: '', label: label || '', current: 0, total: 0, updatedAt: Date.now() } }); } catch {}
}

// ─── Cờ DỪNG cho thao tác THỦ CÔNG (quét/tìm nhóm) — khác kill-switch của Auto ──
// Lưu ở session (reset khi SW khởi động lại). Vòng lặp dài check giữa mỗi bước → thoát sớm.
async function clearCancel() { try { await chrome.storage.session.set({ cancelRun: false }); } catch {} }
async function isCancelled() { try { return !!(await chrome.storage.session.get('cancelRun')).cancelRun; } catch { return false; } }

function todayKey() {
  // Theo giờ máy local
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const MIN_DELAY_SEC = 90;   // an toàn checkpoint: không cho nhanh hơn 90s giữa 2 lần đăng
function rndDelaySec(cfg) {
  const lo = Math.max(MIN_DELAY_SEC, cfg.minDelaySec | 0);
  const hi = Math.max(lo + 5, cfg.maxDelaySec | 0);
  return Math.floor(lo + Math.random() * (hi - lo));
}

// ─── Liên kết tài khoản web (quota free/Pro) ─────────────────────────────────
async function webFetch(cfg, path, method = 'GET', body) {
  if (!cfg.licenseToken) return null;   // chưa liên kết → bỏ qua (chạy local)
  try {
    const headers = { authorization: 'Bearer ' + cfg.licenseToken };
    const opts = { method, headers };
    if (body !== undefined) { headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch((cfg.webBase || 'https://toolmktai.com').replace(/\/$/, '') + path, opts);
    return { status: r.status, json: await r.json().catch(() => ({})) };
  } catch (e) { return { status: 0, json: { error: String(e?.message || e) }, neterr: true }; }
}

// Kiểm tra còn lượt trước khi đăng. Trả { ok, unlinked?, plan, remaining, msg }
async function checkQuota(cfg) {
  const r = await webFetch(cfg, '/api/usage', 'GET');
  if (!r) return { ok: true, unlinked: true };
  if (r.neterr) return { ok: true, neterr: true };   // mất mạng → không chặn (tránh kẹt)
  if (r.status === 401) return { ok: false, msg: 'Token tài khoản không hợp lệ — kiểm tra ở web Dashboard' };
  const q = r.json || {};
  if (q.remaining === -1) return { ok: true, plan: q.plan, remaining: -1 };
  return { ok: (q.remaining ?? 0) > 0, plan: q.plan, remaining: q.remaining ?? 0, used: q.usedToday, limit: q.dailyLimit,
    msg: (q.remaining ?? 0) <= 0 ? `Hết ${q.dailyLimit} lượt comment miễn phí hôm nay — nâng cấp Pro để dùng không giới hạn.` : '' };
}

// Báo đã đăng 1 comment (+1 quota). Trả { ok, quota?, msg }
async function reportComment(cfg, posted) {
  const r = await webFetch(cfg, '/api/usage', 'POST', posted ? { posted } : undefined);
  if (!r || r.neterr) return { ok: true };
  if (r.status === 429) return { ok: false, quota: true, msg: r.json?.error || 'Hết lượt' };
  return { ok: r.status < 300, remaining: r.json?.remaining };
}

// Lấy + lưu trạng thái license để hiển thị
async function refreshLicense(cfg) {
  const r = await webFetch(cfg, '/api/usage', 'GET');
  let license;
  if (!r) license = { linked: false };
  else if (r.status === 401) license = { linked: true, valid: false, error: 'Token không hợp lệ' };
  else if (r.neterr) license = { linked: true, valid: false, error: 'Không kết nối được web' };
  else license = { linked: true, valid: true, ...r.json };
  await save({ license });
  return license;
}

// AI dùng KEY HỆ THỐNG (managed) → bắt buộc đã đăng nhập tài khoản trên web. Thiếu → chặn sớm.
function requireApiKey(cfg) {
  if (!(cfg.webBase && cfg.licenseToken)) {
    const e = new Error('Chưa kích hoạt AI — hãy ĐĂNG NHẬP tài khoản trên web để dùng AI hệ thống theo gói.');
    e.code = 'NO_AI'; throw e;
  }
}

// ─── Lấy creds FB: ưu tiên session (tab FB đang mở), fallback local (đã lưu) ──
async function getCreds() {
  const ses = await chrome.storage.session.get(['fb_token', 'fb_dtsg', 'fb_lsd', 'fb_uid']);
  const loc = await chrome.storage.local.get(['fb_token', 'fb_dtsg', 'fb_lsd', 'fb_uid']);
  return {
    token: ses.fb_token || loc.fb_token || null,
    dtsg: ses.fb_dtsg || loc.fb_dtsg || null,
    lsd: ses.fb_lsd || loc.fb_lsd || null,
    uid: ses.fb_uid || loc.fb_uid || null,        // __user — cần cho GraphQL
  };
}

// Trạng thái kết nối FB (cho web app hiển thị tên + avatar tài khoản).
async function getConn() {
  const creds = await getCreds();
  const u = (await chrome.storage.local.get('fb_user')).fb_user || {};
  return { connected: !!(creds.dtsg || creds.token), hasToken: !!creds.token, name: u.name || null, id: u.id || null, picture: u.picture || null };
}

// Trạng thái Shopee: có tab shopee.vn đang mở & đã đăng nhập (đọc cookie SPC_U/SPC_EC).
// Cache ngắn 12s vì GET_STATE gọi mỗi 4s.
let _shopeeConnCache = { at: 0, val: { hasTab: false, loggedIn: false } };
async function getShopeeConn() {
  if (Date.now() - _shopeeConnCache.at < 12000) return _shopeeConnCache.val;
  const val = { hasTab: false, loggedIn: false };
  try {
    const tabs = await chrome.tabs.query({ url: ['https://shopee.vn/*', 'https://*.shopee.vn/*'] });
    const tab = (tabs || []).find(t => t.id != null);
    if (tab) {
      val.hasTab = true;
      try {
        const inj = await chrome.scripting.executeScript({
          target: { tabId: tab.id }, world: 'ISOLATED',
          func: () => { const c = document.cookie || ''; const m = c.match(/SPC_U=([^;]+)/); return (!!(m && m[1] && m[1] !== '-') || /SPC_EC=/.test(c)); },
        });
        val.loggedIn = !!inj?.[0]?.result;
      } catch {}
    }
  } catch {}
  _shopeeConnCache = { at: Date.now(), val };
  return val;
}

// Giải mã chuỗi unicode-escaped trong HTML (vd á → á)
function decodeJsonStr(s) { try { return JSON.parse('"' + s + '"'); } catch { return s; } }

// Avatar CÔNG KHAI theo USER_ID — KHÔNG cần token (endpoint /picture của Graph tự redirect ảnh).
function fbPublicAvatar(id) { return id ? `https://graph.facebook.com/${id}/picture?width=120&height=120` : null; }

// SW tự fetch facebook.com bằng cookie user → trích token EAA + dtsg + tên + USER_ID.
// CORS: token EAA nằm ở trang Trình quản lý QC (adsmanager/business — KHÁC origin). Để fetch được
// từ SW, ta (1) thêm 2 host đó vào host_permissions, (2) dùng DNR ghi đè origin/referer/sec-fetch
// (installFbDnr) cho FB phục vụ đúng trang đăng nhập. Avatar vẫn có endpoint /picture công khai dự phòng.
// KHÔNG poll/timer — chỉ chạy on-demand (mở app / bấm kết nối) để giảm rủi ro checkpoint.
async function fetchFbTokenFromSW() {
  const urls = [
    'https://adsmanager.facebook.com/adsmanager/manage/campaigns', // ← token EAA nằm ở đây
    'https://business.facebook.com/latest/home',
    'https://www.facebook.com/',                                    // ← tên + USER_ID + dtsg
    'https://www.facebook.com/me/',
  ];
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const acc = { token: null, dtsg: null, name: null, id: null };
  for (const url of urls) {
    const isTokenPage = /adsmanager\.facebook|business\.facebook/.test(url);
    try {
      const r = await fetch(url, { credentials: 'include', headers, redirect: 'follow' });
      if (!r.ok) continue;
      const html = await r.text();
      let m;
      // ── access token (EAA…) — mẫu chính xác trước, mẫu rộng chỉ áp cho trang adsmanager/business ──
      if (!acc.token && (m = html.match(/window\.__accessToken="(EAA[^"]+)"/))) acc.token = m[1];
      if (!acc.token && (m = html.match(/"access_token":"(EAA[^"]+)"/))) acc.token = m[1];
      if (!acc.token && (m = html.match(/"accessToken":"(EAA[^"]+)"/))) acc.token = m[1];
      if (!acc.token && (m = html.match(/"token":"(EAA[A-Za-z0-9_-]{40,})"/))) acc.token = m[1];
      if (!acc.token && isTokenPage && (m = html.match(/EAA[A-Za-z0-9]{0,4}[A-Za-z0-9_-]{20,}/))) acc.token = m[0];
      // ── fb_dtsg (CSRF cho GraphQL) — FB dùng cả "DTSGInitialData" lẫn "DTSGInitData" ──
      if (!acc.dtsg && (m = html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/))) acc.dtsg = m[1];
      if (!acc.dtsg && (m = html.match(/\["DTSGInitData",\[\],\{"token":"([^"]+)"/))) acc.dtsg = m[1];
      if (!acc.dtsg && (m = html.match(/name="fb_dtsg" value="([^"]+)"/))) acc.dtsg = m[1];
      // ── tên + USER_ID (đủ để hiện tên + avatar công khai) ──
      if (!acc.name && ((m = html.match(/"NAME":"([^"]+)","SHORT_NAME"/)) || (m = html.match(/"NAME":"([^"]+)"/)))) acc.name = decodeJsonStr(m[1]);
      if (!acc.id && ((m = html.match(/"USER_ID":"(\d+)"/)) || (m = html.match(/"ACCOUNT_ID":"(\d+)"/)))) acc.id = m[1];
      if (acc.token && acc.dtsg && acc.id) break;   // đủ token + creds → dừng (đỡ request thừa)
    } catch (e) { /* thử URL kế tiếp */ }
  }
  const data = {};
  if (acc.token) { data.fb_token = acc.token; data.fb_token_time = Date.now(); }
  if (acc.dtsg) data.fb_dtsg = acc.dtsg;
  if (acc.id) data.fb_uid = acc.id;
  if (Object.keys(data).length) await chrome.storage.local.set(data);
  return acc;
}

// Đảm bảo có creds (dtsg/uid). Thiếu → SW TỰ fetch facebook.com bằng cookie user (không cần tab mở).
// Vẫn thiếu sau khi thử → user thật sự chưa đăng nhập facebook.com trong trình duyệt này.
async function ensureCreds() {
  let creds = await getCreds();
  if (!creds.dtsg || !creds.uid) {
    await fetchFbTokenFromSW();
    creds = await getCreds();
  }
  return creds;
}

// Gọi Graph /me lấy tên + avatar chuẩn.
async function fetchMe(token) {
  try {
    const url = `https://graph.facebook.com/me?fields=name,id,picture.width(100).height(100)&access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j && j.id) return { id: j.id, name: j.name || null, picture: j.picture?.data?.url || null };
  } catch (e) {}
  return null;
}

// Tự kết nối: TÁI DÙNG token đã lưu (verify bằng /me lấy tên + avatar). CHỈ khi /me lỗi
// (token chết / chưa có) MỚI fetch lại token nặng từ adsmanager → đỡ request mỗi lần reload, giảm checkpoint.
async function connectFb({ forceRefresh = false } = {}) {
  let creds = await getCreds();
  let user = null;          // { id, name, picture }

  // 1) Đã có token lưu sẵn → /me xác thực CÒN SỐNG + lấy tên/avatar (KHÔNG đụng adsmanager)
  if (creds.token && !forceRefresh) {
    user = await fetchMe(creds.token);
    if (!user) {
      // token chết → xoá để bước 2 lấy mới
      await chrome.storage.local.remove(['fb_token', 'fb_token_time']);
      await chrome.storage.session.remove(['fb_token']);
      creds = await getCreds();
    }
  }

  // 2) Chưa có token / token chết → CHỈ KHI ĐÓ mới fetch lại token từ adsmanager rồi /me lần nữa
  if (!user) {
    const r = await fetchFbTokenFromSW();
    creds = await getCreds();
    if (creds.token) user = await fetchMe(creds.token);
    // /me vẫn lỗi nhưng có USER_ID → dựng tên + avatar từ endpoint /picture CÔNG KHAI (không cần token)
    const id = (user && user.id) || r.id || creds.uid || null;
    if (!user && id) user = { id, name: r.name || null, picture: fbPublicAvatar(id) };
  }

  // avatar dự phòng nếu /me không trả picture
  if (user && !user.picture && user.id) user.picture = fbPublicAvatar(user.id);

  // 3) Lưu kết quả — giữ tên/avatar cũ nếu lần này trống (badge khỏi mất tên khi mạng chập chờn)
  if (user && user.id) {
    const prev = (await chrome.storage.local.get('fb_user')).fb_user || {};
    await chrome.storage.local.set({
      fb_user: { ...prev, ...user, name: user.name || prev.name || null, picture: user.picture || prev.picture || null, time: Date.now(), verifiedAt: Date.now() },
    });
  }

  const conn = await getConn();
  conn.tokenAlive = !!(user && user.id);
  if (!conn.connected) conn.note = 'Chưa đăng nhập facebook.com (cùng trình duyệt này).';
  return conn;
}

// Chờ 1 tab load xong (status='complete'); trả false nếu tab biến mất.
async function waitTabComplete(tabId, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let t; try { t = await chrome.tabs.get(tabId); } catch { return false; }
    if (t && t.status === 'complete') return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return true;
}

// Tab có script được không? Chỉ www./web.facebook.com nằm trong host_permissions.
// (m./mbasic./facebook.com không-www, about:blank, chrome:// … đều KHÔNG script được → "cannot access".)
function isScriptableFbUrl(url) {
  return /^https:\/\/(www|web)\.facebook\.com\//.test(url || '');
}

// Tìm tab facebook.com đang mở, hoặc tự tạo tab NỀN nếu chưa có (đăng nhập sẵn qua cookie).
async function getFbTab() {
  const existing = await chrome.tabs.query({ url: ['https://www.facebook.com/*', 'https://web.facebook.com/*'] });
  const cur = (existing || []).find(t => t.id != null);
  if (cur) return cur.id;
  const saved = (await chrome.storage.session.get('fbTabId')).fbTabId;
  if (saved != null) {
    try {
      const t = await chrome.tabs.get(saved);
      if (t && t.id != null) {
        // Tab đã lưu nhưng lạc sang host khác (redirect m./mbasic./apex, hay user bấm đi nơi khác)
        // → điều hướng về www để executeScript khỏi bị "cannot access".
        if (!isScriptableFbUrl(t.url)) {
          await chrome.tabs.update(t.id, { url: 'https://www.facebook.com/' });
          await waitTabComplete(t.id);
          await new Promise(r => setTimeout(r, 1500));
        }
        return t.id;
      }
    } catch {}
    await chrome.storage.session.remove('fbTabId');   // id cũ đã chết → xoá
  }
  const created = await chrome.tabs.create({ url: 'https://www.facebook.com/', active: false });
  await chrome.storage.session.set({ fbTabId: created.id });
  await waitTabComplete(created.id);
  await new Promise(r => setTimeout(r, 1500));   // thêm chút cho content script inject + bơm creds
  return created.id;
}

// 1 lần fetch trong tab: thử content script, fallback executeScript.
async function fbTabFetchOnce(tabId, url, method, body, headers) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'SHOPE_FETCH', url, method, body, headers });
    if (res?.ok) return res.data;
    if (res?.error) throw new Error(res.error);
  } catch (e) { /* content script chưa sẵn → dùng executeScript */ }
  const inj = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    args: [url, method, body || '', headers || {}],
    func: async (u, m, b, h) => {
      try {
        const r = await fetch(u, { method: m, credentials: 'include', headers: h, body: m !== 'GET' ? b : undefined });
        return { ok: true, data: await r.text() };
      } catch (err) { return { ok: false, error: String(err?.message || err) }; }
    },
  });
  const r = inj?.[0]?.result;
  if (r?.ok) return r.data;
  throw new Error(r?.error || 'tab_fetch_failed');
}

// ─── Chạy fetch TRONG tab facebook.com thật (an toàn checkpoint) ──────────────
// Tab chết giữa chừng (No tab with id…) → xoá cache, tạo tab mới, thử lại 1 lần.
async function runFetchInFbTab(url, method, body, headers) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const tabId = await getFbTab();
    try {
      return await fbTabFetchOnce(tabId, url, method, body, headers);
    } catch (e) {
      const msg = String(e?.message || e);
      const tabDead = /No tab with id|No frame|Frame with ID|No window|cannot be scripted|cannot access|The tab was closed/i.test(msg);
      if (attempt === 0 && tabDead) {
        await chrome.storage.session.remove('fbTabId');
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      // Lần 2 vẫn "cannot access" → quyền host Facebook không có hiệu lực, hoặc không có tab FB script được.
      if (/cannot access|cannot be scripted|Extension manifest must request permission/i.test(msg)) {
        throw new Error('Không truy cập được tab Facebook. Hãy mở 1 tab facebook.com đã đăng nhập (www.facebook.com), rồi quét lại.');
      }
      throw e;
    }
  }
  throw new Error('tab_fetch_failed');
}

// URL có phải shopee.vn script được không?
function isShopeeUrl(url) {
  return /^https:\/\/shopee\.vn\//.test(url || '');
}

// Tìm tab shopee.vn đang mở (ưu tiên tab user) → tab nền đã lưu (còn ở shopee.vn) →
// tự tạo tab NỀN nếu chưa có. Cookie phiên áp theo domain nên tab nền vẫn "đăng nhập".
async function getShopeeTab() {
  const open = await chrome.tabs.query({ url: ['https://shopee.vn/*'] });
  const cur = (open || []).find(t => t.id != null);
  if (cur) return cur.id;
  const saved = (await chrome.storage.session.get('shopeeTabId')).shopeeTabId;
  if (saved != null) {
    try {
      const t = await chrome.tabs.get(saved);
      if (t && t.id != null) {
        if (!isShopeeUrl(t.url)) {   // tab nền lạc khỏi shopee → kéo về để script được
          await chrome.tabs.update(t.id, { url: 'https://shopee.vn/' });
          await waitTabComplete(t.id);
          await new Promise(r => setTimeout(r, 1200));
        }
        return t.id;
      }
    } catch {}
    await chrome.storage.session.remove('shopeeTabId');   // id cũ đã chết → xoá
  }
  const created = await chrome.tabs.create({ url: 'https://shopee.vn/', active: false });
  try { await chrome.tabs.update(created.id, { autoDiscardable: false }); } catch {}   // chống Chrome 'discard'
  await chrome.storage.session.set({ shopeeTabId: created.id });
  await waitTabComplete(created.id);
  await new Promise(r => setTimeout(r, 1500));
  return created.id;
}

// ─── Chạy fetch TRONG tab shopee.vn thật (đăng nhập) → search_items không bị chặn bot ──
// Không có tab → tự mở tab nền (giống Facebook), khỏi bắt user tự mở.
async function runFetchInShopeeTab(url, method, body, headers) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const tabId = await getShopeeTab();
    try {
      try {
        const res = await chrome.tabs.sendMessage(tabId, { type: 'SHOPE_FETCH', url, method, body, headers });
        if (res?.ok) return res.data;
        if (res?.error) throw new Error(res.error);
      } catch (e) { /* content script chưa sẵn → dùng executeScript */ }
      const inj = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'ISOLATED',
        args: [url, method, body || '', headers || {}],
        func: async (u, m, b, h) => {
          try {
            const r = await fetch(u, { method: m, credentials: 'include', headers: h, body: m !== 'GET' ? b : undefined });
            return { ok: true, data: await r.text() };
          } catch (err) { return { ok: false, error: String(err?.message || err) }; }
        },
      });
      const r = inj?.[0]?.result;
      if (r?.ok) return r.data;
      throw new Error(r?.error || 'shopee_tab_fetch_failed');
    } catch (e) {
      const msg = String(e?.message || e);
      const tabDead = /No tab with id|No frame|Frame with ID|No window|cannot be scripted|cannot access|The tab was closed/i.test(msg);
      if (attempt === 0 && tabDead) {
        await chrome.storage.session.remove('shopeeTabId');
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      throw e;
    }
  }
  throw new Error('shopee_tab_fetch_failed');
}

// ─── Tìm SP Shopee bằng cách SCRAPE trang search trong tab nền ────────────────
// API search_items bị chặn bot (error 90309999) → mở trang search thật, đọc DOM.
// Dùng 1 tab nền riêng (active:false), tái sử dụng qua các lần gọi.
async function getShopeeScrapeTab() {
  const saved = (await chrome.storage.session.get('shopeeTabId')).shopeeTabId;
  if (saved != null) {
    try { const t = await chrome.tabs.get(saved); if (t && t.id != null) return t.id; } catch {}
  }
  const tab = await chrome.tabs.create({ url: 'https://shopee.vn/', active: false });
  try { await chrome.tabs.update(tab.id, { autoDiscardable: false }); } catch {}   // chống Chrome 'discard' tab nền
  await chrome.storage.session.set({ shopeeTabId: tab.id });
  return tab.id;
}

// Đọc DOM trang search Shopee. THÍCH ỨNG: thử chạy NỀN (êm, không nháy) trước;
// nếu 0 SP (tab nền bị Chrome đóng băng) thì focus tab 1 nhịp cho render rồi trả focus.
async function searchShopeeDom(keyword, limit = 10, opts = {}) {
  const kw = String(keyword || '').trim();
  if (!kw) return [];
  const { cfg } = await getCfg();
  const url = `https://shopee.vn/search?keyword=${encodeURIComponent(kw)}`;
  const allowFocus = cfg.shopeeFocusTab !== false;   // cho phép focus dự phòng (mặc định cho)

  const scrape = async (tId) => {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tId }, world: 'MAIN',
      func: () => {
        try { window.scrollTo(0, document.body.scrollHeight * 0.6); } catch {}   // cuộn kích lazy-load
        const out = [], seen = new Set();
        for (const a of document.querySelectorAll('a[href*="-i."]')) {
          const href = a.getAttribute('href') || '';
          const m = href.match(/-i\.(\d+)\.(\d+)/);
          if (!m) continue;
          const key = m[1] + '.' + m[2];
          if (seen.has(key)) continue;
          let txt = (a.textContent || '').replace(/\s+/g, ' ').trim();
          const ci = txt.indexOf('₫');
          let name = (ci > 0 ? txt.slice(0, ci) : txt).trim().slice(0, 200);
          let price = 0;
          const pm = txt.match(/₫\s*([\d.]+)/);
          if (pm) price = parseInt(pm[1].replace(/\./g, ''), 10) || 0;
          if (!name) continue;
          seen.add(key);
          out.push({ shopid: +m[1], itemid: +m[2], name, price, path: href.split('?')[0] });
        }
        return out;
      },
    });
    return res?.[0]?.result || [];
  };

  // 1 lượt: điều hướng (focus hoặc nền) → poll tối đa maxMs → trả items + trả focus.
  const attempt = async (doFocus, maxMs) => {
    let tabId = await getShopeeScrapeTab();
    let prev = null;
    if (doFocus) {
      try { const w = await chrome.windows.getLastFocused(); const [a] = await chrome.tabs.query({ active: true, windowId: w.id }); if (a && a.id !== tabId) prev = { tabId: a.id, windowId: w.id }; } catch {}
    }
    try {
      await chrome.tabs.update(tabId, { url, active: doFocus });
      if (doFocus) { const wid = (await chrome.tabs.get(tabId)).windowId; if (wid != null) await chrome.windows.update(wid, { focused: true }); }
    } catch {
      await chrome.storage.session.remove('shopeeTabId');
      tabId = await getShopeeScrapeTab(); await chrome.tabs.update(tabId, { url, active: doFocus });
    }
    const deadline = Date.now() + maxMs;
    let items = [];
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1200));
      try { const arr = await scrape(tabId); if (arr.length) { items = arr; break; } } catch {}
    }
    if (doFocus && prev) { try { await chrome.tabs.update(prev.tabId, { active: true }); if (prev.windowId != null) await chrome.windows.update(prev.windowId, { focused: true }); } catch {} }
    return items;
  };

  let items;
  if (opts.focus !== undefined) {
    items = await attempt(!!opts.focus, 15000);   // TEST: đúng chế độ chỉ định
  } else {
    items = await attempt(false, 12000);          // AUTO: thử NỀN trước (êm, ~10s)
    if (!items.length && allowFocus) items = await attempt(true, 10000);   // 0 SP → focus 1 nhịp cho chắc
  }

  return items.slice(0, limit).map(it => ({
    ...it, sold: 0, rating: 0,
    productUrl: it.path && it.path.startsWith('/')
      ? `https://shopee.vn${it.path}`
      : `https://shopee.vn/product/${it.shopid}/${it.itemid}`,
  }));
}

// ─── Tạo link tiếp thị liên kết THẬT qua API custom-link của trang Affiliate ───
// Chạy fetch trong tab affiliate.shopee.vn đã đăng nhập → SDK bảo mật của trang
// tự gắn header chống bot (x-sap-sec, af-ac-enc-dat…). Trả { ok, shortLink, longLink, error }.
function buildSubIds(subId) {
  const parts = String(subId || '').split('-').map(s => s.trim());
  const o = {};
  ['subId1', 'subId2', 'subId3', 'subId4', 'subId5'].forEach((k, i) => { if (parts[i]) o[k] = parts[i]; });
  return o;
}

async function getAffiliateTab() {
  // Tái dùng tab nền do extension tạo trước đó (nếu còn sống)
  const saved = (await chrome.storage.session.get('affTabId')).affTabId;
  if (saved != null) { try { const t = await chrome.tabs.get(saved); if (t && t.id != null) return t.id; } catch {} }
  // Hoặc tab affiliate.shopee.vn user đang mở
  const open = await chrome.tabs.query({ url: ['https://affiliate.shopee.vn/*'] });
  const cur = (open || []).find(t => t.id != null);
  if (cur) return cur.id;
  // Không có → tạo tab NỀN tới trang custom_link rồi chờ load
  const created = await chrome.tabs.create({ url: 'https://affiliate.shopee.vn/offer/custom_link', active: false });
  await chrome.storage.session.set({ affTabId: created.id });
  await new Promise(r => setTimeout(r, 5000));
  return created.id;
}

const AFF_GQL_URL = 'https://affiliate.shopee.vn/api/v3/gql?q=batchCustomLink';
const AFF_GQL_QUERY = '\n    query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){\n      batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){\n        shortLink\n        longLink\n        failCode\n      }\n    }\n    ';

function buildLinkParam(originalLink, subIds) {
  const adv = subIds || {};
  return Object.keys(adv).length ? { originalLink, advancedLinkParams: adv } : { originalLink };
}
// Map 1 phần tử kết quả Shopee → { ok, shortLink, longLink, error }
function mapLinkResult(x) {
  if (!x) return { ok: false, error: 'null' };
  if (x.failCode && x.failCode !== 0) return { ok: false, error: 'failCode ' + x.failCode };
  if (!x.shortLink) return { ok: false, error: 'no_shortLink' };
  return { ok: true, shortLink: x.shortLink, longLink: x.longLink || '' };
}

// BATCH qua SW (headless): cookie phiên gửi kèm credentials:include, Origin/Referer do DNR gắn.
// Không đọc cookie qua API (khỏi cần quyền 'cookies') — csrftoken vẫn đi tự động dạng cookie.
// Trả mảng raw [{shortLink,longLink,failCode}] hoặc ném lỗi (để caller fallback qua tab).
async function affBatchSW(linkParams) {
  const body = { operationName: 'batchGetCustomLink', query: AFF_GQL_QUERY, variables: { linkParams, sourceCaller: 'CUSTOM_LINK_CALLER' } };
  const r = await fetch(AFF_GQL_URL, {
    method: 'POST', credentials: 'include',
    headers: { 'accept': 'application/json, text/plain, */*', 'content-type': 'application/json; charset=UTF-8', 'affiliate-program-type': '1' },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { throw new Error(`non-JSON ${r.status}: ${txt.slice(0, 120)}`); }
  const arr = j?.data?.batchCustomLink;
  if (!Array.isArray(arr)) throw new Error('no_data: ' + JSON.stringify(j).slice(0, 200));
  return arr;
}

// BATCH qua tab affiliate.shopee.vn — dùng XMLHttpRequest để SDK chống-bot của trang
// (hook XHR.prototype.send) tự gắn x-sap-sec / af-ac-enc-* / x-sz-sdk-version cho request.
async function affBatchTab(linkParams) {
  const tabId = await getAffiliateTab();
  const inj = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    args: [linkParams, AFF_GQL_URL, AFF_GQL_QUERY],
    func: (linkParams, url, query) => new Promise((resolve) => {
      try {
        const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('content-type', 'application/json; charset=UTF-8');
        xhr.setRequestHeader('accept', 'application/json, text/plain, */*');
        xhr.setRequestHeader('affiliate-program-type', '1');
        if (csrf) xhr.setRequestHeader('csrf-token', csrf);
        xhr.onload = () => {
          let j; try { j = JSON.parse(xhr.responseText); } catch { resolve({ __error: `non-JSON ${xhr.status}: ${String(xhr.responseText).slice(0, 120)}` }); return; }
          const arr = j?.data?.batchCustomLink;
          if (Array.isArray(arr)) resolve({ __data: arr });
          else resolve({ __error: 'no_data: ' + JSON.stringify(j).slice(0, 200) });
        };
        xhr.onerror = () => resolve({ __error: 'xhr_error' });
        xhr.ontimeout = () => resolve({ __error: 'xhr_timeout' });
        xhr.timeout = 25000;
        xhr.send(JSON.stringify({ operationName: 'batchGetCustomLink', query, variables: { linkParams, sourceCaller: 'CUSTOM_LINK_CALLER' } }));
      } catch (e) { resolve({ __error: String(e?.message || e) }); }
    }),
  });
  const res = inj?.[0]?.result;
  if (res?.__data) return res.__data;
  throw new Error(res?.__error || 'tab_no_result');
}

// Tạo NHIỀU link cùng lúc: thử SW trước, lỗi → fallback tab. items: [{ originalLink, subIds }]
// → [{ originalLink, ok, shortLink, longLink, via, error }]
async function makeBatchLinks(items) {
  const linkParams = items.map(it => buildLinkParam(it.originalLink, it.subIds));
  // ƯU TIÊN TAB: trang affiliate.shopee.vn có SDK tự ký x-sap-sec/af-ac-enc-* cho mỗi request.
  // (SW không ký được → Shopee trả failCode; chỉ dùng SW làm fallback khi không mở được tab.)
  let eTab = null;
  try {
    const arr = await affBatchTab(linkParams);
    return arr.map((x, i) => ({ originalLink: items[i].originalLink, via: 'tab', ...mapLinkResult(x) }));
  } catch (e) { eTab = e; }
  try {
    const arr = await affBatchSW(linkParams);
    return arr.map((x, i) => ({ originalLink: items[i].originalLink, via: 'sw', ...mapLinkResult(x) }));
  } catch (eSW) {
    return items.map(it => ({ originalLink: it.originalLink, ok: false, error: `tab: ${eTab?.message || eTab} | sw: ${eSW?.message || eSW}` }));
  }
}

// Tạo 1 link (cho pipeline). Trả { ok, shortLink, longLink, via, error }.
async function makeAffiliateLink(originalLink, subIds) {
  const [r] = await makeBatchLinks([{ originalLink, subIds }]);
  return r || { ok: false, error: 'no_result' };
}

// ─── Nạp thêm việc vào hàng đợi: quét feed 1 nhóm → classify → suggest ────────
async function refillQueue(opts = {}) {
  const { cfg, state, commentedPosts, catalog, discoveredGroups, searchResults } = await getCfg();
  requireApiKey(cfg);
  if (!cfg.groupIds.length) throw new Error('Chưa cấu hình nhóm mục tiêu (groupIds)');
  if (cfg.mode !== 'social' && cfg.productSource !== 'shopee' && !catalog.length) throw new Error('Catalog rỗng — nhập CSV sản phẩm (hoặc đổi nguồn sang "Shopee tự động", hoặc chuyển chế độ Comment dạo).');
  const creds = await ensureCreds();
  if (!creds.dtsg) throw new Error('Chưa đăng nhập Facebook — hãy đăng nhập facebook.com trong trình duyệt này rồi thử lại.');

  const cursors = state.cursors || {};
  const groupId = cfg.groupIds[state.groupIdx % cfg.groupIds.length];
  const gName = (discoveredGroups.find(g => g.groupId === groupId)?.name)
    || (searchResults.find(g => g.groupId === groupId)?.name) || `Nhóm ${groupId}`;
  // Mục lớn = nhóm
  await pushLog('info', gName, { group: groupId, kind: 'group' });
  // fresh=true (Quét thử thủ công): luôn đọc bài MỚI NHẤT (cursor=null). Auto: lật trang theo cursor.
  const useCursor = opts.fresh ? null : (cursors[groupId] || null);
  await setProgress({ label: `${gName}: đang đọc feed…` });
  const feed = await self.ShopeFbApi.fbFetchGroupFeed(runFetchInFbTab, creds, groupId, useCursor, cfg.postsPerScan || 5);
  const posts = feed.posts || [];
  await pushLog('info', `Đọc feed: ${feed.dbg || `${feed.rawCount} bài`}`, { group: groupId, kind: 'post' });
  let _pi = 0;

  const newQueue = [];
  for (const post of posts) {
    _pi++;
    await setProgress({ label: `${gName}: bài ${_pi}/${posts.length} · phân loại…` });
    if (commentedPosts[post.postId]) continue; // đã comment rồi
    // 1) bài có tiềm năng không (theo mode)
    const ex = String(post.text).replace(/\s+/g, ' ').slice(0, 45);
    const cls = await self.ShopeAI.classifyPost(cfg, post.text, groupId, cfg.mode);
    if (!cls.potential || (cls.score || 0) < cfg.minScore) {
      await pushLog('info', `✕ bỏ qua (${cls.score || 0}đ): "${ex}…"`, { group: groupId, kind: 'post' });
      continue;
    }
    await pushLog('success', `✓ tiềm năng ${cls.score}đ: "${ex}…" — soạn comment`, { group: groupId, kind: 'post' });
    await setProgress({ label: `${gName}: bài ${_pi}/${posts.length} · soạn comment…` });

    // 2) sinh comment theo mode
    let item;
    if (cfg.mode === 'social') {
      // Comment dạo: nếu có "nội dung tìm khách" → AI đổi lại mỗi bài (chống trùng); không thì AI tự soạn theo bài.
      const seed = (cfg.seedContent || '').trim();
      const sc = seed
        ? await self.ShopeAI.varySeedComment(cfg, post.text, groupId, seed, cfg.tone)
        : await self.ShopeAI.socialComment(cfg, post.text, groupId, cfg.tone);
      if (sc.skip || !sc.comment) continue;
      item = { comment: sc.comment, productName: null, link: null, score: cls.score || 0 };
    } else {
      // Rải link: chọn SP khớp + sinh comment kèm link
      let candidates;
      if (cfg.productSource === 'shopee') {
        // TỰ ĐỘNG: AI tự nghĩ sản phẩm + từ khoá → search Shopee → dựng link affiliate
        const kwr = await self.ShopeAI.extractSearchKeyword(cfg, post.text, groupId);
        if (!kwr.wantProduct || !kwr.keyword) {
          await pushLog('info', `✕ không hợp bán hàng: "${ex}…"`, { group: groupId, kind: 'post' });
          continue;
        }
        let items = [];
        try {
          items = await searchShopeeDom(kwr.keyword, cfg.shopeeLimit || 10);
        } catch (e) {
          await pushLog('error', `Search Shopee "${kwr.keyword}" lỗi: ${e?.message || e}`, { group: groupId, kind: 'post' });
          continue;
        }
        if (!items.length) {
          await pushLog('info', `Shopee không có SP cho "${kwr.keyword}" (trang chưa render / bị chặn)`, { group: groupId, kind: 'post' });
          continue;
        }
        await pushLog('info', `🔎 "${kwr.keyword}" → ${items.length} SP Shopee`, { group: groupId, kind: 'post' });
        // Dùng URL sản phẩm trần làm "link" tạm để AI chọn; link affiliate thật tạo SAU khi chốt SP.
        candidates = items.slice(0, 8).map((it, i) => ({
          id: 'sp' + i, name: it.name, category: '', price: Math.round(it.price), keywords: [], link: it.productUrl,
        }));
      } else {
        candidates = self.ShopeCatalog.prefilter(post.text, catalog, 8);
        if (!candidates.length) continue;
      }
      const sug = await self.ShopeAI.suggestProduct(cfg, post.text, groupId, candidates, cfg.tone);
      if (sug.skip || !sug.comment || !sug.link) continue;

      let finalComment = sug.comment, finalLink = sug.link;
      // Nguồn Shopee tự động: đổi URL trần → link hoa hồng thật (API custom-link của trang Affiliate).
      if (cfg.productSource === 'shopee') {
        await setProgress({ label: `${gName}: bài ${_pi}/${posts.length} · tạo link affiliate…` });
        let r = await makeAffiliateLink(sug.link, buildSubIds(cfg.subId));
        if (!(r?.ok && r.shortLink)) {   // thử lại 1 lần (lỗi thường do rate-limit/tab chưa sẵn)
          await new Promise(res => setTimeout(res, 1500));
          r = await makeAffiliateLink(sug.link, buildSubIds(cfg.subId));
        }
        if (r?.ok && r.shortLink) {
          finalLink = r.shortLink;
          finalComment = sug.comment.split(sug.link).join(r.shortLink);
          await pushLog('success', `🔗 Link hoa hồng (${r.via}): ${r.shortLink}`, { group: groupId, kind: 'post' });
        } else {
          // KHÔNG rải link thường (không có hoa hồng = vô nghĩa) → bỏ bài, báo cách khắc phục.
          await pushLog('error', `✕ Bỏ bài: chưa tạo được link hoa hồng (${r?.error || '?'}). Mở sẵn 1 tab affiliate.shopee.vn đã đăng nhập rồi thử lại.`, { group: groupId, kind: 'post' });
          continue;
        }
      }
      item = { comment: finalComment, productName: sug.productName, link: finalLink, score: sug.score };
    }

    newQueue.push({
      feedbackId: post.feedbackId,
      postId: post.postId,
      text: String(post.text || '').slice(0, 300),
      permalink: post.permalink || '',
      authorName: post.authorName || '',
      comment: item.comment,
      productName: item.productName,
      link: item.link,
      groupId,
      score: item.score,
      mode: cfg.mode,
      approved: false,        // chờ duyệt trong web app (nếu requireApproval)
      addedAt: Date.now(),
    });
  }

  // Xoay sang nhóm kế tiếp + lưu cursor phân trang theo nhóm (null = lần sau quay lại đầu feed)
  const nextIdx = (state.groupIdx + 1) % cfg.groupIds.length;
  // fresh: giữ cursor=null để lần sau lại đọc bài mới nhất. Auto: lưu cursor lật trang.
  const nextCursors = { ...cursors, [groupId]: opts.fresh ? null : (feed.nextCursor || null) };
  // GỘP vào hàng đợi cũ (chống trùng postId, giữ item cũ)
  const existing = (await getCfg()).queue;
  const seen = new Set(existing.map(it => it.postId));
  const merged = existing.concat(newQueue.filter(it => !seen.has(it.postId)));
  await save({ queue: merged, state: { ...state, groupIdx: nextIdx, cursors: nextCursors } });
  await pushLog(newQueue.length ? 'success' : 'info', `→ ${newQueue.length} bài tiềm năng vào hàng chờ`, { group: groupId, kind: 'post' });
  return newQueue.length;
}

// ─── Đăng 1 comment (đã chọn) + ghi sổ. Không đụng tới hàng đợi. ──────────────
async function commitComment(item) {
  let { cfg, state, stats, commentedPosts } = await getCfg();
  const tk = todayKey();
  if (state.dateKey !== tk) state = { ...state, dateKey: tk, doneToday: 0 };

  // Kiểm tra hạn mức tài khoản (free 10/ngày) TRƯỚC khi đăng — nếu đã liên kết web
  const qc = await checkQuota(cfg);
  if (!qc.ok) {
    await save({ stats: { ...stats, lastError: qc.msg } });
    await pushLog('error', `⛔ ${qc.msg}`);
    return { ok: false, error: qc.msg, quotaBlocked: true };
  }

  const creds = await getCreds();
  let ok = false, error = '';
  try {
    const res = await self.ShopeFbApi.fbPostComment(runFetchInFbTab, creds, item, item.comment);
    commentedPosts[item.postId] = Date.now();
    if (res.ok) {
      state = { ...state, doneToday: state.doneToday + 1 };
      stats = { ...stats, totalCommented: (stats.totalCommented || 0) + 1, lastRunAt: Date.now(), lastError: '' };
      ok = true;
      notify(`Đã comment (${state.doneToday}/${cfg.dailyCap})`, `${item.productName || ''} · điểm ${item.score}`);
      const where = item.isPage ? `page ${item.pageName || item.pageId}` : `nhóm ${item.groupId || ''}`;
      await pushLog('success', `✓ Đã comment ${where}: ${item.productName || 'comment dạo'} (điểm ${item.score})`);
      // Lưu lịch sử kết quả để xem/kiểm chứng
      try {
        const { commentHistory = [] } = await chrome.storage.local.get('commentHistory');
        commentHistory.unshift({
          postId: item.postId, groupId: item.isPage ? (item.pageId || '') : (item.groupId || ''),
          groupName: item.isPage ? (item.pageName || '') : null,
          productName: item.productName || null, link: item.link || null,
          comment: item.comment, permalink: item.permalink || '', score: item.score ?? null,
          mode: item.mode || cfg.mode, time: Date.now(),
        });
        while (commentHistory.length > 500) commentHistory.pop();
        await chrome.storage.local.set({ commentHistory });
      } catch {}
      // Báo +1 quota lên web (nếu liên kết) + lưu lịch sử "Đã đăng" vào DB + cập nhật trạng thái
      const rep = await reportComment(cfg, {
        mode: 'comment', groupId: item.isPage ? (item.pageId || '') : (item.groupId || ''),
        groupName: item.isPage ? (item.pageName || '') : '', postId: item.postId || '',
        content: item.comment || '', link: item.link || '', permalink: item.permalink || '',
      });
      if (!rep.ok && rep.quota) await pushLog('error', `⚠ ${rep.msg}`);
      await refreshLicense(cfg);
    } else {
      error = 'comment_failed: ' + JSON.stringify(res.errors || '');
      stats = { ...stats, lastError: error, lastRunAt: Date.now() };
      await pushLog('error', `✗ Đăng comment lỗi: ${error}`);
    }
  } catch (e) {
    error = String(e?.message || e);
    stats = { ...stats, lastError: error, lastRunAt: Date.now() };
    await pushLog('error', `✗ Đăng comment lỗi: ${error}`);
  }
  const delay = rndDelaySec(cfg);
  await save({ commentedPosts, state: { ...state, nextActionAt: Date.now() + delay * 1000 }, stats });
  return { ok, error, doneToday: state.doneToday, nextInSec: delay };
}

// ─── Upload ảnh (multipart) TRONG tab FB: dựng FormData + Blob từ base64 ──────
async function runUploadInFbTab(url, fields, file) {
  const tabId = await getFbTab();
  const inj = await chrome.scripting.executeScript({
    target: { tabId }, world: 'ISOLATED',
    args: [url, fields || {}, file],
    func: async (u, f, fileObj) => {
      try {
        const bin = atob(fileObj.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: fileObj.mime || 'image/jpeg' });
        const fd = new FormData();
        for (const k in f) fd.append(k, f[k]);
        fd.append('farr', blob, fileObj.name || 'photo.jpg');
        const r = await fetch(u, { method: 'POST', credentials: 'include', body: fd });
        return { ok: true, data: await r.text() };
      } catch (err) { return { ok: false, error: String(err?.message || err) }; }
    },
  });
  const r = inj?.[0]?.result;
  if (r?.ok) return r.data;
  throw new Error(r?.error || 'upload_failed');
}

// ─── AI viết lại nội dung — prompt nằm ở server (task 'rewrite') ──────────────
async function aiRewrite(text) {
  const { cfg } = await getCfg();
  return String(await self.ShopeAI.aiRewrite(cfg, text) || '').trim();
}

// ─── Đăng 1 bài vào 1 nhóm (ComposerStoryCreate) ─────────────────────────────
// opts: { link, bgPresetId, images:[dataURL] }
async function postToGroup(groupId, message, link, opts = {}) {
  const { cfg, discoveredGroups, searchResults } = await getCfg();
  const gName = (discoveredGroups.find(g => g.groupId === groupId)?.name)
    || (searchResults.find(g => g.groupId === groupId)?.name) || `Nhóm ${groupId}`;
  const qc = await checkQuota(cfg);
  if (!qc.ok) { await pushLog('error', `⛔ ${qc.msg}`); return { ok: false, error: qc.msg, quotaBlocked: true }; }
  const creds = await getCreds();
  if (!creds.dtsg || !creds.uid) return { ok: false, error: 'Chưa kết nối Facebook' };

  // Ghé trang nhóm 1 nhịp (tự nhiên hoá) — bỏ qua lỗi
  try { await runFetchInFbTab(`https://www.facebook.com/groups/${groupId}/`, 'GET'); } catch {}
  await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

  // Upload ảnh (nếu có) → photoIds. Lỗi 1 ảnh = bỏ ảnh đó, vẫn đăng phần còn lại.
  const photoIds = [];
  const images = opts.images || [];
  for (let i = 0; i < images.length; i++) {
    try { photoIds.push(await self.ShopeFbApi.fbUploadPhoto(runUploadInFbTab, creds, images[i], `photo_${i + 1}.jpg`)); }
    catch (e) { await pushLog('warn', `⚠ Ảnh ${i + 1} "${gName}" lỗi upload: ${e?.message || e}`); }
  }
  // Nền màu chỉ áp cho bài CHỮ thuần (FB bỏ nền nếu có ảnh/link)
  const bgPresetId = (!photoIds.length && !link) ? (opts.bgPresetId || '') : '';

  let res;
  try { res = await self.ShopeFbApi.fbCreateGroupPost(runFetchInFbTab, creds, groupId, message, { link, photoIds, bgPresetId }); }
  catch (e) { await pushLog('error', `✗ Đăng bài "${gName}" lỗi: ${e?.message || e}`); return { ok: false, error: String(e?.message || e) }; }

  if (res.ok) {
    await pushLog('success', `✓ Đã đăng bài vào ${gName}${photoIds.length ? ` (${photoIds.length} ảnh)` : ''}`);
    await reportComment(cfg, { mode: 'post', groupId, groupName: gName, content: message || '', link: link || '', permalink: res.postUrl || '' });
    await refreshLicense(cfg);
    try {
      const { commentHistory = [] } = await chrome.storage.local.get('commentHistory');
      commentHistory.unshift({ postId: '', groupId, productName: null, link: link || null, comment: message, permalink: res.postUrl, score: null, mode: 'post', time: Date.now() });
      while (commentHistory.length > 500) commentHistory.pop();
      await chrome.storage.local.set({ commentHistory });
    } catch {}
  } else {
    await pushLog('error', `✗ Đăng bài "${gName}" thất bại: ${JSON.stringify(res.errors || '')}`);
  }
  return res;
}

// ─── Một bước scheduler: chọn 1 item phù hợp rồi đăng ─────────────────────────
// manual=true (bấm "Đăng 1 comment"): bỏ qua check auto/delay, đăng item đầu hàng đợi.
async function processOneStep(opts = {}) {
  const manual = !!opts.manual;
  let { cfg, state, stats, queue } = await getCfg();

  const tk = todayKey();
  if (state.dateKey !== tk) state = { ...state, dateKey: tk, doneToday: 0 };

  if (cfg.killSwitch) return { skipped: 'kill-switch' };
  if (!manual && !cfg.autoEnabled) return { skipped: 'tắt' };
  if (state.doneToday >= cfg.dailyCap) return { skipped: 'đạt cap/ngày' };
  if (!manual && Date.now() < state.nextActionAt) return { skipped: 'đang chờ delay' };

  // Hết hàng đợi → nạp thêm
  if (!queue.length) {
    try {
      const n = await refillQueue();
      ({ queue } = await getCfg());
      if (!n) {
        await save({ state: { ...state, nextActionAt: Date.now() + rndDelaySec(cfg) * 1000 } });
        return { skipped: 'không có bài tiềm năng mới' };
      }
    } catch (e) {
      await save({ stats: { ...stats, lastError: String(e?.message || e), lastRunAt: Date.now() } });
      return { error: String(e?.message || e) };
    }
  }

  // Chọn item: nếu cần duyệt (và auto) → chỉ lấy item đã approved; còn lại lấy đầu hàng.
  const idx = (cfg.requireApproval && !manual) ? queue.findIndex(it => it.approved) : 0;
  if (idx < 0) {
    await save({ state: { ...state, nextActionAt: Date.now() + rndDelaySec(cfg) * 1000 } });
    return { skipped: 'chờ duyệt comment trong web app' };
  }
  const [item] = queue.splice(idx, 1);
  await save({ queue });
  const r = await commitComment(item);
  // Hết hạn mức free → tắt auto, trả item lại hàng đợi
  if (r.quotaBlocked) {
    const { queue: q2 } = await getCfg();
    await save({ queue: [item, ...q2] });
    await stopAuto(false);
    await pushLog('error', '⛔ Đã dừng Auto: hết hạn mức. Nâng cấp Pro để chạy tiếp.');
  }
  return { ...r };
}

// ─── Khám phá nhóm: quét nhóm đã tham gia → AI chấm điểm tiềm năng ────────────
// Mô tả catalog cho AI: danh mục + SP ví dụ + từ khoá (để chấm điểm nhóm theo KHỚP sản phẩm).
function buildCatalogContext(catalog) {
  if (!catalog.length) return '';
  const cats = [...new Set(catalog.map(p => p.category).filter(Boolean))];
  const names = catalog.slice(0, 25).map(p => p.name);
  const kws = [...new Set(catalog.flatMap(p => p.keywords || []))].slice(0, 50);
  return `Danh mục: ${cats.join(', ')}\nSản phẩm ví dụ: ${names.join('; ')}\nTừ khoá: ${kws.join(', ')}`;
}

// ─── PAGE: tìm page mục tiêu + comment dạo trên feed page ────────────────────
async function searchPagesByKeyword(keyword) {
  const { cfg } = await getCfg();
  requireApiKey(cfg);
  const creds = await ensureCreds();
  if (!creds.dtsg || !creds.uid) throw new Error('Chưa đăng nhập Facebook — hãy đăng nhập facebook.com rồi thử lại.');
  const kws = String(keyword || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!kws.length) throw new Error('Chưa nhập từ khoá tìm page');
  await clearCancel();
  const byId = new Map();
  let firstError = null;
  for (const kw of kws) {
    if (await isCancelled()) { await pushLog('info', '■ Đã dừng tìm page.'); break; }
    try {
      const { pages } = await self.ShopeFbApi.fbSearchPages(runFetchInFbTab, creds, kw, null);
      for (const p of pages) if (p.pageId && !byId.has(p.pageId)) byId.set(p.pageId, p);
      await pushLog('info', `Tìm page "${kw}": ${pages.length} kết quả`);
    } catch (e) { firstError = firstError || e; await pushLog('error', `Tìm page "${kw}" lỗi: ${e?.message || e}`); }
    await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
  }
  if (byId.size === 0 && firstError) throw firstError;
  const results = [...byId.values()];
  await save({ pageSearchResults: results });
  return results;
}

// Quét feed các Page mục tiêu → lọc bài tiềm năng (AI) → soạn comment dạo → đưa vào hàng chờ.
async function scanPagesOnce() {
  const { cfg, commentedPosts, targetPages, queue } = await getCfg();
  requireApiKey(cfg);
  const pages = targetPages || [];
  if (!pages.length) throw new Error('Chưa chọn Page mục tiêu');
  const creds = await ensureCreds();
  if (!creds.dtsg || !creds.uid) throw new Error('Chưa đăng nhập Facebook');
  const newQueue = [...queue];
  let total = 0;
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    if (await isCancelled()) break;
    await setProgress({ phase: 'scan', current: pi, total: pages.length, label: `Quét page ${page.name}…` });
    await pushLog('info', page.name, { group: page.pageId, kind: 'group' });
    let feed;
    try { feed = await self.ShopeFbApi.fbFetchPageFeed(runFetchInFbTab, creds, page.pageId, null, cfg.postsPerScan || 5); }
    catch (e) { await pushLog('error', `Đọc feed page lỗi: ${e?.message || e}`, { group: page.pageId, kind: 'post' }); continue; }
    await pushLog('info', `Đọc feed: ${feed.dbg}`, { group: page.pageId, kind: 'post' });
    for (const post of (feed.posts || [])) {
      if (commentedPosts[post.postId] || newQueue.some(q => q.postId === post.postId)) continue;
      const ex = String(post.text).replace(/\s+/g, ' ').slice(0, 45);
      let cls;
      try { cls = await self.ShopeAI.classifyPost(cfg, post.text, page.name, 'social'); }
      catch (e) { if (e?.code && HARD_AI_ERRORS.has(e.code)) throw e; continue; }
      if (!cls.potential || (cls.score || 0) < cfg.minScore) { await pushLog('info', `✕ bỏ qua (${cls.score || 0}đ): "${ex}…"`, { group: page.pageId, kind: 'post' }); continue; }
      const seed = (cfg.seedContent || '').trim();
      let sc;
      try { sc = seed ? await self.ShopeAI.varySeedComment(cfg, post.text, page.name, seed, cfg.tone) : await self.ShopeAI.socialComment(cfg, post.text, page.name, cfg.tone); }
      catch (e) { if (e?.code && HARD_AI_ERRORS.has(e.code)) throw e; continue; }
      if (sc.skip || !sc.comment) continue;
      newQueue.push({ postId: post.postId, feedbackId: post.feedbackId, text: post.text, comment: sc.comment, productName: null, link: null, score: cls.score || 0, mode: 'social', groupId: '', pageId: page.pageId, pageName: page.name, isPage: true, permalink: post.permalink });
      total++;
      await pushLog('success', `✓ tiềm năng ${cls.score}đ: "${ex}…" — soạn comment`, { group: page.pageId, kind: 'post' });
    }
  }
  await save({ queue: newQueue });
  return total;
}

async function discoverGroups(opts = {}) {
  const { cfg, catalog } = await getCfg();
  requireApiKey(cfg);
  await clearCancel();
  await pushLog('info', 'Đang lấy danh sách nhóm đã tham gia…');
  await setProgress({ phase: 'discover', current: 0, total: 0, label: 'Đang lấy danh sách nhóm đã tham gia…' });
  const creds = await getCreds();
  const groups = await self.ShopeFbApi.fbFetchJoinedGroups(runFetchInFbTab, creds, { maxPages: opts.maxPages ?? 20 });
  await pushLog('info', `Đã lấy ${groups.length} nhóm. AI bắt đầu chấm điểm theo niche…`);

  const catalogContext = buildCatalogContext(catalog);
  const limit = Math.min(groups.length, opts.maxAnalyze ?? 120);
  const subset = groups.slice(0, limit);

  // Chấm điểm theo lô 15 nhóm/lần (nhanh + rẻ)
  const scoreById = new Map();
  let hardErr = null;
  for (let i = 0; i < subset.length; i += 15) {
    if (await isCancelled()) { await pushLog('info', '■ Đã dừng chấm điểm theo yêu cầu.'); break; }
    const chunk = subset.slice(i, i + 15);
    await setProgress({ phase: 'discover', current: i, total: subset.length, label: `Chấm điểm nhóm ${i + 1}–${Math.min(i + 15, subset.length)}/${subset.length}…` });
    await pushLog('info', `AI chấm điểm nhóm ${i + 1}–${Math.min(i + 15, subset.length)}/${subset.length}…`);
    try {
      const results = await self.ShopeAI.analyzeGroupsBatch(cfg, chunk, catalogContext);
      for (const r of results) {
        const g = chunk[r.i];
        if (g) scoreById.set(g.groupId, { score: r.score ?? 0, potential: !!r.potential, reason: r.reason || '', niche: r.niche || '' });
      }
    } catch (e) {
      if (e?.code && HARD_AI_ERRORS.has(e.code)) { hardErr = e; break; }   // hết trần AI / chưa cấu hình → dừng
      /* lô lỗi mềm → để điểm mặc định */
    }
  }
  // Cả mẻ fail vì lỗi cứng → ném ra để báo rõ cho người dùng (thay vì "thành công" mà toàn điểm trống).
  if (hardErr && scoreById.size === 0) throw hardErr;

  const analyzed = groups.map(g => ({
    ...g,
    score: scoreById.get(g.groupId)?.score ?? null,
    potential: scoreById.get(g.groupId)?.potential ?? null,
    reason: scoreById.get(g.groupId)?.reason ?? '',
    niche: scoreById.get(g.groupId)?.niche ?? '',
  })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  await save({ discoveredGroups: analyzed, groupsSyncedAt: Date.now() });
  const good = analyzed.filter(g => (g.score ?? 0) >= 70).length;
  await pushLog('success', `Quét nhóm xong: ${analyzed.length} nhóm, ${good} nhóm tiềm năng (điểm ≥70)`);
  await endProgress(`Quét nhóm xong: ${analyzed.length} nhóm`);
  return analyzed;
}

// ─── Khám phá nhóm MỚI: gợi ý từ khoá → tìm → AI chấm điểm ────────────────────
async function suggestNiches() {
  const { cfg, catalog } = await getCfg();
  requireApiKey(cfg);
  await pushLog('info', 'AI đang gợi ý từ khoá niche…');
  const kw = await self.ShopeAI.suggestNicheKeywords(cfg, catalog);
  await pushLog('success', `AI gợi ý ${kw.length} từ khoá: ${kw.slice(0, 5).join(', ')}…`);
  return kw;
}

async function searchGroupsByKeyword(keyword) {
  const { cfg, catalog } = await getCfg();
  requireApiKey(cfg);
  const creds = await ensureCreds();
  const kws = String(keyword || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!kws.length) throw new Error('Chưa nhập từ khoá tìm nhóm');

  if (!creds.dtsg || !creds.uid) throw new Error('Chưa đăng nhập Facebook — hãy đăng nhập facebook.com trong trình duyệt này rồi thử lại.');
  await clearCancel();
  const joinedIds = new Set((await getCfg()).discoveredGroups.map(g => g.groupId));
  const byId = new Map();
  let firstError = null;
  for (const kw of kws) {
    if (await isCancelled()) { await pushLog('info', '■ Đã dừng tìm nhóm theo yêu cầu.'); break; }
    try {
      const { groups } = await self.ShopeFbApi.fbSearchGroups(runFetchInFbTab, creds, kw, null);
      for (const g of groups) if (g.groupId && !byId.has(g.groupId)) byId.set(g.groupId, { ...g, joined: g.joined || joinedIds.has(g.groupId) });
      await pushLog('info', `Tìm "${kw}": ${groups.length} nhóm`);
    } catch (e) { firstError = firstError || e; await pushLog('error', `Tìm "${kw}" lỗi: ${e?.message || e}`); }
    await new Promise(r => setTimeout(r, 700 + Math.random() * 500));   // giãn cách chống checkpoint
  }

  // Tất cả từ khoá đều lỗi → ném lỗi thật (không báo "đã tìm xong" giả)
  if (byId.size === 0 && firstError) throw firstError;

  let results = Array.from(byId.values());
  await pushLog('info', `Tìm được ${results.length} nhóm. AI đang chấm điểm theo niche…`);
  // AI chấm điểm theo niche/catalog (lô 15)
  const catalogContext = buildCatalogContext(catalog);
  const scoreById = new Map();
  for (let i = 0; i < results.length; i += 15) {
    if (await isCancelled()) { await pushLog('info', '■ Đã dừng chấm điểm theo yêu cầu.'); break; }
    const chunk = results.slice(i, i + 15);
    await setProgress({ phase: 'search', current: i, total: results.length, label: `Chấm điểm nhóm ${i + 1}–${Math.min(i + 15, results.length)}/${results.length}…` });
    await pushLog('info', `AI chấm điểm nhóm ${i + 1}–${Math.min(i + 15, results.length)}/${results.length}…`);
    try {
      const rs = await self.ShopeAI.analyzeGroupsBatch(cfg, chunk, catalogContext);
      for (const r of rs) { const g = chunk[r.i]; if (g) scoreById.set(g.groupId, { score: r.score ?? 0, niche: r.niche || '', reason: r.reason || '' }); }
    } catch (e) { /* lô lỗi → để mặc định */ }
  }
  results = results.map(g => ({
    ...g,
    score: scoreById.get(g.groupId)?.score ?? null,
    niche: scoreById.get(g.groupId)?.niche ?? '',
    reason: scoreById.get(g.groupId)?.reason ?? '',
  })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  await save({ searchResults: results, searchAt: Date.now() });
  await pushLog('info', `Tìm nhóm "${keyword}": ${results.length} kết quả`);
  await endProgress(`Tìm nhóm xong: ${results.length} kết quả`);
  return results;
}

async function joinGroupById(groupId) {
  const { searchResults } = await getCfg();
  const creds = await getCreds();
  if (!creds.dtsg || !creds.uid) throw new Error('Chưa kết nối Facebook');
  const g = (searchResults || []).find(x => x.groupId === groupId) || { groupId };
  const res = await self.ShopeFbApi.fbJoinGroup(runFetchInFbTab, creds, g);
  if (res.ok) {
    const sr = (searchResults || []).map(x => x.groupId === groupId ? { ...x, joined: true } : x);
    await save({ searchResults: sr });
    await pushLog('success', `➕ Đã tham gia nhóm: ${g.name || groupId}`);
  } else {
    await pushLog('error', `Tham gia nhóm lỗi: ${JSON.stringify(res.errors || '')}`);
  }
  return res;
}

// Giúp sửa hàng đợi an toàn (đọc → biến đổi → lưu)
async function mutateQueue(fn) {
  const { queue } = await getCfg();
  const next = fn(queue.slice());
  await save({ queue: next });
  return next;
}

function notify(title, message) {
  try { chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title, message }); } catch {}
}

// ─── Alarm tick ──────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === TICK_ALARM) { try { await processOneStep(); } catch (e) { console.warn(e); } }
});

// Bấm icon extension → mở (hoặc focus) control panel tại {webBase}/app
chrome.action.onClicked.addListener(async () => {
  const { cfg } = await getCfg();
  const base = (cfg.webBase || 'https://toolmktai.com').replace(/\/$/, '');
  const appUrl = base + '/app/';
  // Nếu /app đã mở ở đâu đó (tab hoặc popup) → focus lại
  const tabs = await chrome.tabs.query({ url: [base + '/app/*', 'https://toolmktai.com/app/*', 'http://localhost:3000/app/*'] });
  if (tabs[0]?.id != null && tabs[0].windowId != null) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
    return;
  }
  // Mở CỬA SỔ POPUP riêng (như adsmeta) thay vì 1 tab
  chrome.windows.create({ url: appUrl, type: 'popup', width: 1280, height: 860 });
});

// Khôi phục sau khi reload extension / mở lại Chrome:
// - cho phép content script ghi chrome.storage.session (mặc định chỉ trusted context)
// - nếu auto đang bật → tạo lại alarm tick (alarm bị xoá khi reload extension)
// DNR: spoof Origin/Referer/Sec-Fetch cho fetch tới API Affiliate từ SW (kiểu adsmeta) →
// cho phép gọi headless không cần tab, NẾU endpoint không ép chữ ký JS (x-sap-sec).
async function installShopeeDnr() {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [201],
      addRules: [{
        id: 201, priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'set', value: 'https://affiliate.shopee.vn' },
            { header: 'referer', operation: 'set', value: 'https://affiliate.shopee.vn/offer/custom_link' },
            { header: 'sec-fetch-site', operation: 'set', value: 'same-origin' },
            { header: 'sec-fetch-mode', operation: 'set', value: 'cors' },
            { header: 'sec-fetch-dest', operation: 'set', value: 'empty' },
          ],
        },
        condition: { urlFilter: 'https://affiliate.shopee.vn/api/', resourceTypes: ['xmlhttprequest'] },
      }],
    });
  } catch (e) { console.warn('installShopeeDnr', e); }
}

// DNR cho fetch HTML token-page (adsmanager/business) TỪ SW: bỏ Origin = id extension, giả lập
// một điều hướng trang thật (sec-fetch navigate/document) để FB phục vụ trang đăng nhập có token EAA.
async function installFbDnr() {
  const mk = (id, host) => ({
    id, priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'origin', operation: 'remove' },
        { header: 'referer', operation: 'set', value: `https://${host}/` },
        { header: 'sec-fetch-site', operation: 'set', value: 'same-origin' },
        { header: 'sec-fetch-mode', operation: 'set', value: 'navigate' },
        { header: 'sec-fetch-dest', operation: 'set', value: 'document' },
        { header: 'sec-fetch-user', operation: 'set', value: '?1' },
      ],
    },
    condition: { urlFilter: `||${host}/`, resourceTypes: ['xmlhttprequest', 'other'] },
  });
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [210, 211],
      addRules: [mk(210, 'adsmanager.facebook.com'), mk(211, 'business.facebook.com')],
    });
  } catch (e) { console.warn('installFbDnr', e); }
}

async function bootstrap() {
  try { await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }); } catch {}
  await installShopeeDnr();
  await installFbDnr();
  try {
    const { cfg } = await getCfg();
    if (cfg.autoEnabled && !cfg.killSwitch) chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5 });
  } catch {}
}
chrome.runtime.onInstalled.addListener(bootstrap);
chrome.runtime.onStartup.addListener(bootstrap);

async function startAuto() {
  const { cfg, state } = await getCfg();
  requireApiKey(cfg);
  await save({ cfg: { ...cfg, autoEnabled: true, killSwitch: false }, state: { ...state, nextActionAt: 0 } });
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5 }); // ~30s/tick (vẫn lệ thuộc delay riêng)
  await pushLog('info', '▶ Bật chế độ Auto');
}
async function stopAuto(kill) {
  const { cfg } = await getCfg();
  await save({ cfg: { ...cfg, autoEnabled: false, ...(kill ? { killSwitch: true } : {}) } });
  chrome.alarms.clear(TICK_ALARM);
  await pushLog('info', kill ? '■ DỪNG NGAY (kill-switch)' : '⏸ Tắt Auto');
}

// ─── Message bus: popup + dashboard (externally_connectable) ──────────────────
async function handle(request, sendResponse) {
  try {
    switch (request?.type) {
      case 'PING': sendResponse({ ok: true, version: chrome.runtime.getManifest().version }); break;
      case 'GET_STATE': sendResponse({ ok: true, ...(await getCfg()), conn: await getConn(), shopee: await getShopeeConn() }); break;
      case 'CONNECT_FB': sendResponse({ ok: true, conn: await connectFb() }); break;
      case 'CHECK_LICENSE': { const { cfg } = await getCfg(); const lic = await refreshLicense(cfg); sendResponse({ ok: true, license: lic }); break; }
      case 'SET_CFG': {
        const { cfg } = await getCfg();
        await save({ cfg: { ...cfg, ...(request.cfg || {}) } });
        sendResponse({ ok: true });
        break;
      }
      case 'START_AUTO': await startAuto(); sendResponse({ ok: true }); break;
      case 'STOP_AUTO': await stopAuto(false); sendResponse({ ok: true }); break;
      case 'KILL': await stopAuto(true); sendResponse({ ok: true }); break;
      case 'CANCEL_RUN': await chrome.storage.session.set({ cancelRun: true }); sendResponse({ ok: true }); break;
      case 'IMPORT_CSV': {
        const products = self.ShopeCatalog.parseCsv(request.csv || '');
        await save({ catalog: products });
        sendResponse({ ok: true, count: products.length, products });
        break;
      }
      case 'GET_CATALOG': { const { catalog } = await getCfg(); sendResponse({ ok: true, products: catalog }); break; }
      case 'TEST_AI': {
        const { cfg } = await getCfg();
        const t0 = Date.now();
        const reply = await self.ShopeAI.testAI(cfg);   // gọi AI hệ thống qua /api/ai/task
        sendResponse({ ok: true, reply: (reply || '').trim(), ms: Date.now() - t0, provider: 'hệ thống' });
        break;
      }
      case 'DISCOVER_GROUPS': { const g = await discoverGroups(request.opts || {}); sendResponse({ ok: true, count: g.length, groups: g }); break; }
      case 'SUGGEST_NICHES': { const kw = await suggestNiches(); sendResponse({ ok: true, keywords: kw }); break; }
      case 'SEARCH_GROUPS': { const r = await searchGroupsByKeyword(request.keyword); sendResponse({ ok: true, count: r.length, groups: r }); break; }
      case 'SEARCH_PAGES': { const r = await searchPagesByKeyword(request.keyword); sendResponse({ ok: true, count: r.length, pages: r }); break; }
      case 'SET_TARGET_PAGES': {
        const pages = (request.pages || []).map(p => ({ pageId: String(p.pageId), name: p.name || '', url: p.url || '', icon: p.icon || '' }));
        await save({ targetPages: pages });
        sendResponse({ ok: true });
        break;
      }
      case 'SAVE_PAGE_LIST': {
        const { savedPageLists } = await getCfg();
        const pages = (request.pages || []).map(p => ({ pageId: String(p.pageId), name: p.name || '', url: p.url || '', icon: p.icon || '' }));
        const list = { id: 'pl_' + Date.now().toString(36), name: String(request.name || 'Danh sách').slice(0, 60), pages, createdAt: Date.now() };
        await save({ savedPageLists: [list, ...savedPageLists].slice(0, 50) });
        sendResponse({ ok: true, list });
        break;
      }
      case 'DELETE_PAGE_LIST': {
        const { savedPageLists } = await getCfg();
        await save({ savedPageLists: savedPageLists.filter(l => l.id !== request.id) });
        sendResponse({ ok: true });
        break;
      }
      // Liệt kê bài viết gần đây của các Page (KHÔNG dùng AI lọc) → để user TỰ chọn bài cần comment.
      case 'LIST_PAGE_POSTS': {
        const { cfg, targetPages, commentedPosts } = await getCfg();
        const pages = (request.pages && request.pages.length ? request.pages : targetPages) || [];
        if (!pages.length) { sendResponse({ ok: false, error: 'Chưa chọn Page mục tiêu' }); break; }
        await clearCancel();
        const creds = await ensureCreds();
        if (!creds.dtsg || !creds.uid) { sendResponse({ ok: false, error: 'Chưa đăng nhập Facebook' }); break; }
        await setProgress({ phase: 'scan', current: 0, total: pages.length, label: 'Đang lấy bài từ Page…' });
        const out = [];
        try {
          for (let i = 0; i < pages.length; i++) {
            if (await isCancelled()) break;
            const page = pages[i];
            await setProgress({ phase: 'scan', current: i, total: pages.length, label: `Lấy bài: ${page.name || page.pageId}…` });
            let feed;
            try { feed = await self.ShopeFbApi.fbFetchPageFeed(runFetchInFbTab, creds, String(page.pageId), null, request.count || cfg.postsPerScan || 8); }
            catch (e) { await pushLog('error', `Đọc feed page lỗi: ${e?.message || e}`, { group: page.pageId, kind: 'post' }); continue; }
            for (const post of (feed.posts || [])) {
              out.push({
                postId: post.postId, feedbackId: post.feedbackId, text: post.text || '',
                permalink: post.permalink, authorName: post.authorName || '',
                pageId: String(page.pageId), pageName: page.name || '',
                already: !!commentedPosts[post.postId],
              });
            }
          }
        } finally { await endProgress(`Đã lấy ${out.length} bài từ Page`); }
        sendResponse({ ok: true, posts: out });
        break;
      }
      // Thêm các bài Page user đã chọn (kèm nội dung tự đặt) vào hàng chờ duyệt.
      case 'ADD_PAGE_POSTS_TO_QUEUE': {
        const { queue } = await getCfg();
        const items = request.posts || [];
        const newQueue = [...queue];
        let added = 0;
        for (const p of items) {
          if (!p.postId || newQueue.some(q => q.postId === p.postId)) continue;
          newQueue.push({
            postId: String(p.postId), feedbackId: p.feedbackId || null, text: p.text || '',
            comment: String(p.comment || '').trim(), productName: null, link: null, score: null,
            mode: 'social', groupId: '', pageId: String(p.pageId || ''), pageName: p.pageName || '',
            isPage: true, manual: true, permalink: p.permalink || '',
          });
          added++;
        }
        await save({ queue: newQueue });
        await pushLog('success', `Đã thêm ${added} bài Page (tự chọn) vào hàng chờ`);
        sendResponse({ ok: true, added });
        break;
      }
      case 'SCAN_PAGES': {
        const nPages = (await getCfg()).targetPages.length;
        await pushLog('info', `▶ Quét ${nPages} page mục tiêu…`);
        await setProgress({ phase: 'scan', current: 0, total: nPages || 1, label: 'Bắt đầu quét page…' });
        let total = 0, hardErr = null;
        try { total = await scanPagesOnce(); }
        catch (e) {
          if (e?.code && HARD_AI_ERRORS.has(e.code)) hardErr = e;
          else { await endProgress('Quét page lỗi'); await pushLog('error', `Quét page lỗi: ${e?.message || e}`); sendResponse({ ok: false, error: String(e?.message || e) }); break; }
        }
        await endProgress(`Quét page xong: +${total} bài`);
        if (hardErr) { await pushLog('error', `⛔ ${hardErr.message}`); sendResponse({ ok: false, error: hardErr.message, code: hardErr.code }); break; }
        await pushLog('success', `Quét page xong: +${total} bài vào hàng chờ duyệt`);
        sendResponse({ ok: true, queued: total });
        break;
      }
      case 'JOIN_GROUP': { const res = await joinGroupById(request.groupId); sendResponse({ ok: res.ok, error: res.ok ? '' : JSON.stringify(res.errors || 'join_failed') }); break; }
      case 'POST_GROUP': { const r = await postToGroup(request.groupId, request.message || '', request.link || '', { bgPresetId: request.bgPresetId || '', images: request.images || [] }); sendResponse({ ok: r.ok, error: r.ok ? '' : (r.error || JSON.stringify(r.errors || 'post_failed')), postUrl: r.postUrl || '', quotaBlocked: !!r.quotaBlocked }); break; }
      case 'AI_REWRITE': { try { const t = await aiRewrite(request.text || ''); sendResponse({ ok: !!t, text: t, error: t ? '' : 'AI không trả về nội dung' }); } catch (e) { sendResponse({ ok: false, error: String(e?.message || e) }); } break; }
      case 'GET_GROUPS': { const { discoveredGroups, groupsSyncedAt } = await getCfg(); sendResponse({ ok: true, groups: discoveredGroups, syncedAt: groupsSyncedAt }); break; }
      // Khôi phục dữ liệu nhóm từ bản sao trên localStorage của web (vd sau khi cài lại extension).
      // CHỈ ghi vào key đang TRỐNG để không đè dữ liệu mới hơn của extension.
      case 'RESTORE_GROUPS': {
        const cur = await getCfg();
        const snap = request.snapshot || {};
        const patch = {};
        if ((!cur.discoveredGroups?.length) && snap.discoveredGroups?.length) {
          patch.discoveredGroups = snap.discoveredGroups;
          patch.groupsSyncedAt = snap.groupsSyncedAt || Date.now();
        }
        if ((!cur.searchResults?.length) && snap.searchResults?.length) {
          patch.searchResults = snap.searchResults;
          patch.searchAt = snap.searchAt || Date.now();
        }
        if ((!cur.savedGroupLists?.length) && snap.savedGroupLists?.length) patch.savedGroupLists = snap.savedGroupLists;
        if ((!cur.savedPageLists?.length) && snap.savedPageLists?.length) patch.savedPageLists = snap.savedPageLists;
        if ((!cur.savedPosts?.length) && snap.savedPosts?.length) patch.savedPosts = snap.savedPosts;
        if (Object.keys(patch).length) await save(patch);
        sendResponse({ ok: true, restored: Object.keys(patch) });
        break;
      }
      case 'SET_TARGETS': {
        const { cfg } = await getCfg();
        await save({ cfg: { ...cfg, groupIds: Array.from(new Set(request.groupIds || [])) } });
        sendResponse({ ok: true });
        break;
      }
      case 'SAVE_GROUP_LIST': {
        const { savedGroupLists } = await getCfg();
        const list = { id: 'gl_' + Date.now().toString(36), name: String(request.name || 'Danh sách').slice(0, 60), groupIds: [...new Set(request.groupIds || [])], createdAt: Date.now() };
        await save({ savedGroupLists: [list, ...savedGroupLists].slice(0, 50) });
        sendResponse({ ok: true, list });
        break;
      }
      case 'DELETE_GROUP_LIST': {
        const { savedGroupLists } = await getCfg();
        await save({ savedGroupLists: savedGroupLists.filter(l => l.id !== request.id) });
        sendResponse({ ok: true });
        break;
      }
      case 'SAVE_POST': {
        const { savedPosts } = await getCfg();
        const p = request.post || {};
        const post = { id: 'pp_' + Date.now().toString(36), title: String(p.title || (p.content || '').trim().split('\n')[0] || 'Bài không tên').slice(0, 80), content: p.content || '', link: p.link || '', bgPresetId: p.bgPresetId || '', createdAt: Date.now() };
        await save({ savedPosts: [post, ...savedPosts].slice(0, 100) });
        sendResponse({ ok: true, post });
        break;
      }
      case 'DELETE_POST': {
        const { savedPosts } = await getCfg();
        await save({ savedPosts: savedPosts.filter(p => p.id !== request.id) });
        sendResponse({ ok: true });
        break;
      }
      case 'SCAN_NOW': {
        const { cfg } = await getCfg();
        const nGroups = cfg.groupIds.length || 1;
        await clearCancel();
        await pushLog('info', `▶ Quét thử ${cfg.groupIds.length} nhóm mục tiêu…`);
        await setProgress({ phase: 'scan', current: 0, total: nGroups, label: 'Bắt đầu quét…' });
        let total = 0, hardErr = null, stopped = false;
        try {
          for (let i = 0; i < nGroups; i++) {
            if (await isCancelled()) { stopped = true; await pushLog('info', '■ Đã dừng quét theo yêu cầu.'); break; }
            await setProgress({ phase: 'scan', current: i, total: nGroups, label: `Quét nhóm ${i + 1}/${nGroups}…` });
            try { total += await refillQueue({ fresh: true }); }
            catch (e) {
              if (e?.code && HARD_AI_ERRORS.has(e.code)) { hardErr = e; break; }   // hết trần AI / chưa cấu hình / bị chặn → dừng, khỏi lặp lỗi
              await pushLog('error', `Quét nhóm lỗi: ${e?.message || e}`);
            }
          }
        } finally { await endProgress(stopped ? `Đã dừng: +${total} bài` : `Quét xong: +${total} bài`); }
        if (stopped) { sendResponse({ ok: true, stopped: true, queued: total }); break; }
        if (hardErr) {
          await pushLog('error', `⛔ ${hardErr.message}`);
          sendResponse({ ok: false, error: hardErr.message, code: hardErr.code, queued: total });
          break;
        }
        await pushLog('success', `Quét xong: +${total} bài vào hàng chờ duyệt`);
        sendResponse({ ok: true, queued: total });
        break;
      }
      case 'STEP_NOW': { const r = await processOneStep({ manual: true }); sendResponse({ ok: true, result: r }); break; }
      case 'APPROVE_ITEM': await mutateQueue(q => q.map(it => it.postId === request.postId ? { ...it, approved: true } : it)); sendResponse({ ok: true }); break;
      case 'APPROVE_ALL': await mutateQueue(q => q.map(it => ({ ...it, approved: true }))); sendResponse({ ok: true }); break;
      case 'REJECT_ITEM': await mutateQueue(q => q.filter(it => it.postId !== request.postId)); sendResponse({ ok: true }); break;
      case 'EDIT_ITEM': await mutateQueue(q => q.map(it => it.postId === request.postId ? { ...it, comment: request.comment } : it)); sendResponse({ ok: true }); break;
      case 'POST_ITEM': {
        const { queue } = await getCfg();
        const item = queue.find(it => it.postId === request.postId);
        if (!item) { sendResponse({ ok: false, error: 'không thấy item' }); break; }
        await save({ queue: queue.filter(it => it.postId !== request.postId) });
        const r = await commitComment(item);
        sendResponse({ ok: r.ok, error: r.error, result: r });
        break;
      }
      case 'MAKE_LINKS': {
        const links = (request.links || []).map(s => String(s || '').trim()).filter(Boolean);
        if (!links.length) { sendResponse({ ok: false, error: 'Chưa nhập link nào' }); break; }
        const subIds = buildSubIds(request.subId || '');
        const results = await makeBatchLinks(links.map(originalLink => ({ originalLink, subIds })));
        sendResponse({ ok: true, results });
        break;
      }
      case 'TEST_SHOPEE_SEARCH': {
        const t0 = Date.now();
        try {
          const items = await searchShopeeDom(request.keyword || '', request.limit || 10, { focus: request.focus });
          sendResponse({ ok: true, items, ms: Date.now() - t0, focus: request.focus !== false });
        } catch (e) { sendResponse({ ok: false, error: String(e?.message || e), ms: Date.now() - t0 }); }
        break;
      }
      case 'GET_CREDS': sendResponse({ ok: true, creds: await getCreds() }); break;
      case 'RESET_HISTORY': await save({ commentedPosts: {}, queue: [] }); await pushLog('info', 'Đã xoá lịch sử + hàng chờ'); sendResponse({ ok: true }); break;
      case 'CLEAR_LOGS': await save({ logs: [] }); sendResponse({ ok: true }); break;
      case 'CLEAR_POSTED': await save({ commentHistory: [] }); sendResponse({ ok: true }); break;
      default: sendResponse({ ok: false, error: 'unknown_type' });
    }
  } catch (e) {
    sendResponse({ ok: false, error: String(e?.message || e) });
  }
}

chrome.runtime.onMessage.addListener((req, _s, sendResponse) => { handle(req, sendResponse); return true; });

chrome.runtime.onMessageExternal.addListener((req, sender, sendResponse) => {
  const origin = sender.origin || '';
  const allowed = ['https://toolmktai.com', 'http://localhost:5173', 'http://127.0.0.1:5173'];
  if (!allowed.includes(origin)) { sendResponse({ ok: false, error: 'forbidden' }); return true; }
  handle(req, sendResponse);
  return true;
});
