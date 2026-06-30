// ai.js — THIN CLIENT. Toàn bộ prompt + logic AI đã chuyển sang server (web/src/lib/aiTasks.ts).
// Extension chỉ gửi { task, args } tới /api/ai/task (key hệ thống + quota do server lo) và nhận kết quả.
// Chạy trong service worker. Cần cfg.webBase + cfg.licenseToken (đã đăng nhập tài khoản).
'use strict';

async function aiTask(cfg, task, args) {
  const base = (cfg.webBase || '').replace(/\/$/, '');
  if (!base || !cfg.licenseToken) {
    const e = new Error('Chưa đăng nhập tài khoản — mở control panel và đăng nhập để dùng AI hệ thống.');
    e.code = 'NO_LICENSE'; throw e;
  }
  let r;
  try {
    r = await fetch(base + '/api/ai/task', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.licenseToken },
      body: JSON.stringify({ task, args }),
    });
  } catch (err) {
    const e = new Error('Không kết nối được máy chủ AI: ' + (err?.message || err)); e.code = 'NETWORK'; throw e;
  }
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) {
    let msg = j?.error;
    if (!msg) msg = r.status === 401 ? 'Phiên đăng nhập hết hạn — đăng nhập lại trên web rồi mở lại công cụ.' : `AI hệ thống lỗi ${r.status}`;
    const e = new Error(msg); e.code = j?.code || (r.status === 401 ? 'UNAUTHORIZED' : 'HTTP_' + r.status); throw e;
  }
  return j.result;
}

self.ShopeAI = {
  // Bài có tiềm năng để comment không (mode 'affiliate' | 'social')
  classifyPost: (cfg, text, group, mode = 'affiliate') => aiTask(cfg, 'classify', { text, group, mode }),

  // Comment dạo: viết lại biến thể từ nội dung gốc (chống trùng)
  varySeedComment: (cfg, text, group, seed, tone) => aiTask(cfg, 'varySeed', { text, group, seed, tone }),

  // Comment dạo tự nhiên, không link
  socialComment: (cfg, text, group, tone) => aiTask(cfg, 'social', { text, group, tone }),

  // Chọn SP khớp + sinh comment (server nối link thật, thay {{LINK}})
  suggestProduct: (cfg, text, group, candidates, tone) =>
    aiTask(cfg, 'suggestProduct', {
      text, group, tone,
      candidates: (candidates || []).map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, keywords: p.keywords, link: p.link })),
    }),

  // Tự nghĩ SP + từ khoá để tìm trên Shopee
  extractSearchKeyword: (cfg, text, group) => aiTask(cfg, 'searchKeyword', { text, group }),

  // Chấm điểm nhiều nhóm 1 lần → [{ i, niche, potential, score, reason }] (giữ nguyên thứ tự)
  analyzeGroupsBatch: (cfg, groups, catalogContext) =>
    aiTask(cfg, 'analyzeGroups', { groups: (groups || []).map(g => ({ name: g.name, memberCount: g.memberCount })), catalogContext }),

  // Gợi ý từ khoá tìm nhóm theo niche
  suggestNicheKeywords: (cfg, catalog) =>
    aiTask(cfg, 'suggestNiches', { catalog: (catalog || []).map(p => ({ category: p.category, name: p.name })) }),

  // Viết lại nội dung marketing (chống trùng khi đăng nhiều nhóm)
  aiRewrite: (cfg, text) => aiTask(cfg, 'rewrite', { text }),

  // Kiểm tra AI hệ thống có hoạt động
  testAI: (cfg) => aiTask(cfg, 'test', {}),
};
