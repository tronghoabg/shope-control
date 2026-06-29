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
  provider: 'anthropic',      // anthropic | openai | gemini
  apiKeys: {},                // { anthropic:'', openai:'', gemini:'' } — nhập ở giao diện cài đặt
  models: {},                 // override model mỗi provider (để trống = mặc định)
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
  licenseToken: '',           // token tài khoản (lấy ở web Dashboard) — để đồng bộ hạn mức free/Pro
  webBase: 'https://toolmktai.com', // địa chỉ web SaaS
  productSource: 'catalog',   // (chế độ affiliate) 'catalog' = CSV tự nạp · 'shopee' = AI tự nghĩ SP + search Shopee + dựng link
  affiliateId: '',            // ID tiếp thị liên kết Shopee (dùng dựng link hoa hồng cho nguồn 'shopee')
  subId: '',                  // sub_id tracking (tối đa 5 giá trị, cách nhau '-'); để trống cũng được
  shopeeLimit: 10,            // số SP lấy về mỗi lần search Shopee
};

async function getCfg() {
  const s = await chrome.storage.local.get(['cfg', 'state', 'stats', 'commentedPosts', 'queue', 'catalog', 'discoveredGroups', 'groupsSyncedAt', 'logs', 'searchResults', 'searchAt', 'commentHistory', 'progress', 'license']);
  return {
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

function todayKey() {
  // Theo giờ máy local
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function rndDelaySec(cfg) {
  const lo = Math.max(20, cfg.minDelaySec | 0);
  const hi = Math.max(lo + 5, cfg.maxDelaySec | 0);
  return Math.floor(lo + Math.random() * (hi - lo));
}

// ─── Liên kết tài khoản web (quota free/Pro) ─────────────────────────────────
async function webFetch(cfg, path, method = 'GET') {
  if (!cfg.licenseToken) return null;   // chưa liên kết → bỏ qua (chạy local)
  try {
    const r = await fetch((cfg.webBase || 'http://localhost:3000').replace(/\/$/, '') + path, {
      method, headers: { authorization: 'Bearer ' + cfg.licenseToken },
    });
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
async function reportComment(cfg) {
  const r = await webFetch(cfg, '/api/usage', 'POST');
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

// Tool BẮT BUỘC có API key AI (để đọc/đánh giá nhóm + bài). Thiếu → chặn sớm với thông báo rõ.
function hasApiKey(cfg) {
  return !!((cfg.apiKeys || {})[cfg.provider || 'anthropic'] || '').trim();
}
function requireApiKey(cfg) {
  if (!hasApiKey(cfg)) throw new Error('Chưa có API key AI — vào trang "Cài đặt API" nhập key (tool cần AI để đọc & đánh giá nhóm/bài).');
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

// Giải mã chuỗi unicode-escaped trong HTML (vd á → á)
function decodeJsonStr(s) { try { return JSON.parse('"' + s + '"'); } catch { return s; } }

// SW tự fetch facebook.com bằng cookie user → trích token + dtsg + tên/ID (như smeta).
// KHÔNG cần mở tab, KHÔNG poll/timer — chỉ chạy khi user mở web app / bấm kết nối.
async function fetchFbTokenFromSW() {
  const urls = ['https://www.facebook.com/', 'https://www.facebook.com/me/'];
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  for (const url of urls) {
    try {
      const r = await fetch(url, { credentials: 'include', headers, redirect: 'follow' });
      if (!r.ok) continue;
      const html = await r.text();
      let token = null, dtsg = null, name = null, id = null, m;
      if ((m = html.match(/"accessToken":"(EAA[^"]+)"/))) token = m[1];
      if (!token && (m = html.match(/window\.__accessToken="([^"]+)"/))) token = m[1];
      if ((m = html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/))) dtsg = m[1];
      if (!dtsg && (m = html.match(/name="fb_dtsg" value="([^"]+)"/))) dtsg = m[1];
      if ((m = html.match(/"NAME":"([^"]+)","SHORT_NAME"/)) || (m = html.match(/"NAME":"([^"]+)"/))) name = decodeJsonStr(m[1]);
      if ((m = html.match(/"USER_ID":"(\d+)"/)) || (m = html.match(/"ACCOUNT_ID":"(\d+)"/))) id = m[1];
      if (token || dtsg || name) {
        const data = {};
        if (token) { data.fb_token = token; data.fb_token_time = Date.now(); }
        if (dtsg) data.fb_dtsg = dtsg;
        if (id) data.fb_uid = id;
        if (Object.keys(data).length) await chrome.storage.local.set(data);
        return { token, dtsg, name, id };
      }
    } catch (e) { /* thử URL kế tiếp */ }
  }
  return { token: null, dtsg: null, name: null, id: null };
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

// Tự kết nối (smeta-style): LUÔN verify token bằng /me để chắc còn sống + lấy info mới nhất.
// Token chết / chưa có → SW fetch lại từ facebook.com rồi /me lần nữa.
async function connectFb() {
  let creds = await getCreds();
  let user = null;          // chỉ coi là "đã xác thực" khi /me trả về id
  let htmlInfo = null;      // tên/ID lấy từ HTML (fallback khi không có token)

  // 1) Có token sẵn → /me để xác thực còn sống
  if (creds.token) {
    user = await fetchMe(creds.token);
    if (!user) {
      // token hết hạn → xoá để lấy lại
      await chrome.storage.local.remove(['fb_token', 'fb_token_time']);
      await chrome.storage.session.remove(['fb_token']);
    }
  }

  // 2) Chưa xác thực được → SW fetch token mới rồi /me lại
  if (!user) {
    const r = await fetchFbTokenFromSW();
    if (r.name || r.id) htmlInfo = { name: r.name, id: r.id };
    creds = await getCreds();
    if (creds.token) user = await fetchMe(creds.token);
  }

  // 3) Lưu kết quả — KHÔNG xoá tên cũ khi verify chợt lỗi (giữ qua reload)
  if (user && user.id) {
    await chrome.storage.local.set({ fb_user: { ...user, time: Date.now(), verifiedAt: Date.now() } });
  } else if (htmlInfo && (htmlInfo.name || htmlInfo.id)) {
    // Có dtsg + tên (đăng comment được) nhưng không lấy được token để /me
    const prev = (await chrome.storage.local.get('fb_user')).fb_user || {};
    await chrome.storage.local.set({ fb_user: { ...prev, ...htmlInfo, time: Date.now(), verifiedAt: 0 } });
  }
  // else: không lấy được gì mới → GIỮ NGUYÊN fb_user cũ (không xoá) để badge khỏi mất tên khi mạng chập chờn.

  const conn = await getConn();
  conn.tokenAlive = !!(user && user.id);   // /me thành công
  if (!conn.connected) conn.note = 'Chưa đăng nhập facebook.com (cùng trình duyệt) hoặc token hết hạn.';
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

// Tìm tab facebook.com đang mở, hoặc tự tạo tab NỀN + GHIM nếu chưa có (đăng nhập sẵn qua cookie).
async function getFbTab() {
  const existing = await chrome.tabs.query({ url: ['https://www.facebook.com/*', 'https://web.facebook.com/*'] });
  const cur = (existing || []).find(t => t.id != null);
  if (cur) return cur.id;
  const saved = (await chrome.storage.session.get('fbTabId')).fbTabId;
  if (saved != null) {
    try { const t = await chrome.tabs.get(saved); if (t && t.id != null) return t.id; } catch {}
    await chrome.storage.session.remove('fbTabId');   // id cũ đã chết → xoá
  }
  const created = await chrome.tabs.create({ url: 'https://www.facebook.com/', active: false, pinned: true });
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
      throw e;
    }
  }
  throw new Error('tab_fetch_failed');
}

// ─── Chạy fetch TRONG tab shopee.vn thật (đăng nhập) → search_items không bị chặn bot ──
async function runFetchInShopeeTab(url, method, body, headers) {
  const tabs = await chrome.tabs.query({ url: ['https://shopee.vn/*'] });
  const tab = (tabs || []).find(t => t.id != null);
  if (!tab) throw new Error('no_shopee_tab: hãy mở 1 tab shopee.vn đã đăng nhập (để extension search sản phẩm)');
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'SHOPE_FETCH', url, method, body, headers });
    if (res?.ok) return res.data;
    if (res?.error) throw new Error(res.error);
  } catch (e) {
    const inj = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
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
  const tab = await chrome.tabs.create({ url: 'https://shopee.vn/', active: false, pinned: true });
  await chrome.storage.session.set({ shopeeTabId: tab.id });
  return tab.id;
}

async function searchShopeeDom(keyword, limit = 10) {
  const kw = String(keyword || '').trim();
  if (!kw) return [];
  const tabId = await getShopeeScrapeTab();
  const url = `https://shopee.vn/search?keyword=${encodeURIComponent(kw)}`;
  try { await chrome.tabs.update(tabId, { url, active: false }); }
  catch { // tab bị đóng → tạo lại rồi thử lần nữa
    await chrome.storage.session.remove('shopeeTabId');
    const t = await getShopeeScrapeTab();
    await chrome.tabs.update(t, { url, active: false });
  }

  const scrape = async (tId) => {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tId }, world: 'MAIN',
      func: () => {
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

  // Chờ trang render danh sách SP (poll tối đa ~18s)
  const deadline = Date.now() + 18000;
  let items = [];
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500));
    try { const arr = await scrape(tabId); if (arr.length) { items = arr; break; } }
    catch { /* trang chưa sẵn sàng / đang điều hướng */ }
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
  // Không có → tạo tab NỀN + GHIM (ít vướng mắt) tới trang custom_link rồi chờ load
  const created = await chrome.tabs.create({ url: 'https://affiliate.shopee.vn/offer/custom_link', active: false, pinned: true });
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

// BATCH qua tab affiliate.shopee.vn (mượn SDK của trang ký request).
async function affBatchTab(linkParams) {
  const tabId = await getAffiliateTab();
  const inj = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    args: [linkParams, AFF_GQL_URL, AFF_GQL_QUERY],
    func: async (linkParams, url, query) => {
      try {
        const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
        const r = await fetch(url, {
          method: 'POST', credentials: 'include', mode: 'cors',
          headers: { 'accept': 'application/json, text/plain, */*', 'content-type': 'application/json; charset=UTF-8', 'affiliate-program-type': '1', ...(csrf ? { 'csrf-token': csrf } : {}) },
          body: JSON.stringify({ operationName: 'batchGetCustomLink', query, variables: { linkParams, sourceCaller: 'CUSTOM_LINK_CALLER' } }),
        });
        const txt = await r.text();
        let j; try { j = JSON.parse(txt); } catch { return { __error: `non-JSON ${r.status}: ${txt.slice(0, 120)}` }; }
        const arr = j?.data?.batchCustomLink;
        if (!Array.isArray(arr)) return { __error: 'no_data: ' + JSON.stringify(j).slice(0, 200) };
        return { __data: arr };
      } catch (e) { return { __error: String(e?.message || e) }; }
    },
  });
  const res = inj?.[0]?.result;
  if (res?.__data) return res.__data;
  throw new Error(res?.__error || 'tab_no_result');
}

// Tạo NHIỀU link cùng lúc: thử SW trước, lỗi → fallback tab. items: [{ originalLink, subIds }]
// → [{ originalLink, ok, shortLink, longLink, via, error }]
async function makeBatchLinks(items) {
  const linkParams = items.map(it => buildLinkParam(it.originalLink, it.subIds));
  let eSW = null;
  try {
    const arr = await affBatchSW(linkParams);
    return arr.map((x, i) => ({ originalLink: items[i].originalLink, via: 'sw', ...mapLinkResult(x) }));
  } catch (e) { eSW = e; }
  try {
    const arr = await affBatchTab(linkParams);
    return arr.map((x, i) => ({ originalLink: items[i].originalLink, via: 'tab', ...mapLinkResult(x) }));
  } catch (eTab) {
    return items.map(it => ({ originalLink: it.originalLink, ok: false, error: `sw: ${eSW?.message || eSW} | tab: ${eTab?.message || eTab}` }));
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
  const creds = await getCreds();
  if (!creds.dtsg) throw new Error('Chưa có fb_dtsg — mở tab facebook.com & đăng nhập để extension lấy creds');

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
      // Comment dạo: tự nhiên, không link, không cần catalog
      const sc = await self.ShopeAI.socialComment(cfg, post.text, groupId, cfg.tone);
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
        const r = await makeAffiliateLink(sug.link, buildSubIds(cfg.subId), { group: groupId, kind: 'post' });
        if (r?.ok && r.shortLink) {
          finalLink = r.shortLink;
          finalComment = sug.comment.split(sug.link).join(r.shortLink);
          await pushLog('success', `🔗 Link hoa hồng (${r.via}): ${r.shortLink}`, { group: groupId, kind: 'post' });
        } else {
          await pushLog('error', `Tạo link affiliate lỗi (${r?.error || '?'}) — tạm dùng link thường`, { group: groupId, kind: 'post' });
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
      await pushLog('success', `✓ Đã comment nhóm ${item.groupId || ''}: ${item.productName || 'comment dạo'} (điểm ${item.score})`);
      // Lưu lịch sử kết quả để xem/kiểm chứng
      try {
        const { commentHistory = [] } = await chrome.storage.local.get('commentHistory');
        commentHistory.unshift({
          postId: item.postId, groupId: item.groupId || '',
          productName: item.productName || null, link: item.link || null,
          comment: item.comment, permalink: item.permalink || '', score: item.score ?? null,
          mode: item.mode || cfg.mode, time: Date.now(),
        });
        while (commentHistory.length > 500) commentHistory.pop();
        await chrome.storage.local.set({ commentHistory });
      } catch {}
      // Báo +1 quota lên web (nếu liên kết) + cập nhật trạng thái
      const rep = await reportComment(cfg);
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

async function discoverGroups(opts = {}) {
  const { cfg, catalog } = await getCfg();
  requireApiKey(cfg);
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
  for (let i = 0; i < subset.length; i += 15) {
    const chunk = subset.slice(i, i + 15);
    await setProgress({ phase: 'discover', current: i, total: subset.length, label: `Chấm điểm nhóm ${i + 1}–${Math.min(i + 15, subset.length)}/${subset.length}…` });
    await pushLog('info', `AI chấm điểm nhóm ${i + 1}–${Math.min(i + 15, subset.length)}/${subset.length}…`);
    try {
      const results = await self.ShopeAI.analyzeGroupsBatch(cfg, chunk, catalogContext);
      for (const r of results) {
        const g = chunk[r.i];
        if (g) scoreById.set(g.groupId, { score: r.score ?? 0, potential: !!r.potential, reason: r.reason || '', niche: r.niche || '' });
      }
    } catch (e) { /* lô lỗi → để điểm mặc định */ }
  }

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
  const creds = await getCreds();
  const kws = String(keyword || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!kws.length) throw new Error('Chưa nhập từ khoá tìm nhóm');

  if (!creds.dtsg || !creds.uid) throw new Error('Chưa kết nối Facebook — mở 1 tab facebook.com đã đăng nhập rồi thử lại');
  const joinedIds = new Set((await getCfg()).discoveredGroups.map(g => g.groupId));
  const byId = new Map();
  let firstError = null;
  for (const kw of kws) {
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

// Bấm icon extension → mở (hoặc focus) control panel.
const DASHBOARD_URL = 'https://toolmktai.com/app/';
chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ['https://toolmktai.com/app/*', 'http://localhost:5173/*', 'http://127.0.0.1:5173/*'] });
  if (tabs[0]?.id != null) {
    chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId != null) chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: DASHBOARD_URL });
  }
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

async function bootstrap() {
  try { await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }); } catch {}
  await installShopeeDnr();
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
      case 'GET_STATE': sendResponse({ ok: true, ...(await getCfg()), conn: await getConn() }); break;
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
      case 'IMPORT_CSV': {
        const products = self.ShopeCatalog.parseCsv(request.csv || '');
        await save({ catalog: products });
        sendResponse({ ok: true, count: products.length, products });
        break;
      }
      case 'GET_CATALOG': { const { catalog } = await getCfg(); sendResponse({ ok: true, products: catalog }); break; }
      case 'TEST_AI': {
        const { cfg } = await getCfg();
        const testCfg = { ...cfg, ...(request.cfg || {}) };
        const t0 = Date.now();
        const reply = await self.ShopeAI.callAI(testCfg, {
          messages: [{ role: 'user', content: 'Trả lời đúng 2 từ in hoa: OK SHOPE' }],
          maxTokens: 20, temperature: 0,
        });
        sendResponse({ ok: true, reply: (reply || '').trim(), ms: Date.now() - t0, provider: testCfg.provider });
        break;
      }
      case 'DISCOVER_GROUPS': { const g = await discoverGroups(request.opts || {}); sendResponse({ ok: true, count: g.length, groups: g }); break; }
      case 'SUGGEST_NICHES': { const kw = await suggestNiches(); sendResponse({ ok: true, keywords: kw }); break; }
      case 'SEARCH_GROUPS': { const r = await searchGroupsByKeyword(request.keyword); sendResponse({ ok: true, count: r.length, groups: r }); break; }
      case 'JOIN_GROUP': { const res = await joinGroupById(request.groupId); sendResponse({ ok: res.ok, error: res.ok ? '' : JSON.stringify(res.errors || 'join_failed') }); break; }
      case 'GET_GROUPS': { const { discoveredGroups, groupsSyncedAt } = await getCfg(); sendResponse({ ok: true, groups: discoveredGroups, syncedAt: groupsSyncedAt }); break; }
      case 'SET_TARGETS': {
        const { cfg } = await getCfg();
        await save({ cfg: { ...cfg, groupIds: Array.from(new Set(request.groupIds || [])) } });
        sendResponse({ ok: true });
        break;
      }
      case 'SCAN_NOW': {
        const { cfg } = await getCfg();
        const nGroups = cfg.groupIds.length || 1;
        await pushLog('info', `▶ Quét thử ${cfg.groupIds.length} nhóm mục tiêu…`);
        await setProgress({ phase: 'scan', current: 0, total: nGroups, label: 'Bắt đầu quét…' });
        let total = 0;
        try {
          for (let i = 0; i < nGroups; i++) {
            await setProgress({ phase: 'scan', current: i, total: nGroups, label: `Quét nhóm ${i + 1}/${nGroups}…` });
            try { total += await refillQueue({ fresh: true }); }
            catch (e) { await pushLog('error', `Quét nhóm lỗi: ${e?.message || e}`); }
          }
        } finally { await endProgress(`Quét xong: +${total} bài`); }
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
