// catalog.js — parse CSV + lọc sơ bộ SP theo từ khoá (chạy trong service worker).
'use strict';

// Parser CSV tối giản, hỗ trợ trường bọc dấu " (vd cột keywords có dấu phẩy bên trong).
function parseCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// CSV → [{ id, name, keywords[], category, price, link }]
function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const products = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    const get = (n) => (idx(n) >= 0 ? (c[idx(n)] || '').trim() : '');
    const id = get('id'), link = get('link');
    if (!id || !link) continue;
    products.push({
      id, link,
      name: get('name'),
      category: get('category'),
      price: Number(get('price')) || 0,
      keywords: get('keywords').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    });
  }
  return products;
}

// Lọc sơ bộ theo từ khoá → giảm số SP gửi cho AI (tiết kiệm token).
function prefilter(postText, catalog, topN = 8) {
  const text = (postText || '').toLowerCase();
  const scored = catalog.map(p => {
    let score = 0;
    for (const kw of p.keywords) if (kw && text.includes(kw)) score += 2;
    for (const w of p.name.toLowerCase().split(/\s+/)) if (w.length >= 3 && text.includes(w)) score += 1;
    if (p.category && text.includes(p.category.toLowerCase())) score += 1;
    return { p, score };
  });
  const hits = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  return (hits.length ? hits : scored).slice(0, topN).map(s => s.p);
}

self.ShopeCatalog = { parseCsv, prefilter };
