// ai.js — gọi thẳng Claude / OpenAI / Gemini bằng fetch (key lưu trong cấu hình extension).
// Không cần SDK, không cần server. Chạy trong service worker.
'use strict';

const AI_DEFAULT_MODELS = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
};

function pickKey(cfg) {
  const k = (cfg.apiKeys || {})[cfg.provider];
  if (!k) throw new Error(`Chưa nhập API key cho provider "${cfg.provider}" (mục Cài đặt)`);
  return k;
}
function pickModel(cfg) {
  return (cfg.models || {})[cfg.provider] || AI_DEFAULT_MODELS[cfg.provider];
}

// opts: { system, messages:[{role,content}], maxTokens, temperature, json }
async function callAI(cfg, opts) {
  const provider = cfg.provider || 'anthropic';
  const model = pickModel(cfg);
  const key = pickKey(cfg);
  const maxTokens = opts.maxTokens ?? 500;

  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        ...(opts.system ? { system: opts.system } : {}),
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        messages: opts.messages,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `anthropic ${r.status}`);
    return j.content?.[0]?.text || '';
  }

  if (provider === 'openai') {
    const messages = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push(...opts.messages);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        messages,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `openai ${r.status}`);
    return j.choices?.[0]?.message?.content || '';
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
        contents: opts.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
          ...(opts.json ? { responseMimeType: 'application/json' } : {}),
          // Gemini 2.5 mặc định "thinking" ăn hết token output → JSON bị cắt. Tắt để trả thẳng.
          ...(/2\.5|thinking/i.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `gemini ${r.status}`);
    return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  }

  throw new Error('provider không hợp lệ: ' + provider);
}

function extractJson(text) {
  const raw = String(text || '');
  let s = raw.replace(/^﻿/, '').trim();
  // bóc fence ```json ... ```
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // lấy từ { đầu tới } cuối (object) hoặc [ ] (array)
  const oA = s.indexOf('{'), oB = s.lastIndexOf('}');
  const aA = s.indexOf('['), aB = s.lastIndexOf(']');
  if (oA !== -1 && oB > oA) s = s.slice(oA, oB + 1);
  else if (aA !== -1 && aB > aA) s = s.slice(aA, aB + 1);
  // bỏ trailing comma trước } hoặc ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(s); }
  catch (e) {
    const snippet = (raw.trim() || '(rỗng)').slice(0, 140).replace(/\s+/g, ' ');
    throw new Error(`AI trả JSON không hợp lệ. Model nói: "${snippet}"`);
  }
}

async function callAIJson(cfg, opts) {
  return extractJson(await callAI(cfg, { ...opts, json: true }));
}

// ─── Bài có tiềm năng để comment không (theo mode) ───────────────────────────
// mode 'affiliate': hợp để gợi ý sản phẩm.  mode 'social' (dạo): hợp để bình luận tự nhiên.
async function classifyPost(cfg, postText, groupName, mode = 'affiliate') {
  const system = mode === 'social'
    ? `Bạn đánh giá bài đăng Facebook xem có hợp để BÌNH LUẬN DẠO (tự nhiên, thân thiện) không.
HỢP: bài chia sẻ, khoe, hỏi đáp, xin ý kiến, kể chuyện đời thường, vui vẻ.
KHÔNG hợp: tin buồn/tang lễ, chính trị, tôn giáo nhạy cảm, tranh cãi gay gắt, bài bán hàng, spam.
Chỉ trả JSON: {"potential": bool, "score": 0-100, "intent": string, "reason": string ngắn}.`
    : `Bạn là trợ lý đánh giá bài đăng Facebook cho người làm affiliate Shopee.
Xác định một bài đăng có "tiềm năng" để comment giới thiệu sản phẩm hay không.
TIỀM NĂNG: hỏi mua/tư vấn, than thiếu món đồ, xin review, hỏi "shop nào", "ở đâu bán".
KHÔNG tiềm năng: tin buồn, chính trị, tranh cãi, đã chốt đơn, bài bán hàng người khác, spam.
Chỉ trả JSON: {"potential": bool, "score": 0-100, "intent": string, "reason": string ngắn}.`;
  const user = `Nhóm: ${groupName || '(không rõ)'}\nBài:\n"""\n${String(postText).slice(0, 2000)}\n"""`;
  return callAIJson(cfg, { system, messages: [{ role: 'user', content: user }], maxTokens: 300, temperature: 0.2 });
}

// ─── Comment dạo: bình luận tự nhiên, KHÔNG link, KHÔNG bán hàng ──────────────
async function socialComment(cfg, postText, groupName, tone) {
  const system = `Bạn bình luận dạo trên Facebook như một người thật, ${tone || 'thân thiện, tự nhiên'}.
Cho 1 bài đăng, viết 1 comment NGẮN (1-2 câu) hợp ngữ cảnh: đồng cảm / khen / hỏi thêm / góp vui.
TUYỆT ĐỐI KHÔNG quảng cáo, KHÔNG link, KHÔNG bán hàng, KHÔNG xin info.
Tránh sáo rỗng ("hay quá ạ"), tránh spam, tối đa 1 emoji.
Nếu bài không hợp (tin buồn nặng, nhạy cảm, chính trị) → skip.
Chỉ trả JSON: {"comment": string|null, "skip": bool, "reason": string}`;
  const user = `Nhóm: ${groupName || '(không rõ)'}\nBài:\n"""\n${String(postText).slice(0, 2000)}\n"""`;
  return callAIJson(cfg, { system, messages: [{ role: 'user', content: user }], maxTokens: 250, temperature: 0.8 });
}

// ─── Chọn SP khớp + sinh comment (nối link thật ở client) ────────────────────
async function suggestProduct(cfg, postText, groupName, candidates, tone) {
  const list = candidates
    .map(p => `- id=${p.id} | ${p.name} | danh mục: ${p.category} | giá: ${p.price}đ | từ khoá: ${p.keywords.join(', ')}`)
    .join('\n');
  const system = `Bạn là chuyên gia affiliate Shopee, viết comment Facebook tự nhiên như người thật.
Cho bài đăng + danh sách sản phẩm:
1. Chọn 1 sản phẩm KHỚP NHẤT (hoặc bỏ qua nếu không hợp).
2. Viết comment NGẮN 1-3 câu, thân thiện, không sượng, không sến, như gợi ý cho bạn bè.
   - KHÔNG bịa link; chèn đúng 1 token literal {{LINK}}.
   - Tối đa 1-2 emoji. Tránh từ spam ("mua ngay","giá sốc","inbox").
Giọng: ${tone || 'tự nhiên, thân thiện'}.
Chỉ trả JSON: {"productId": string|null, "comment": string|null, "score": 0-100, "reason": string, "skip": bool}`;
  const user = `Nhóm: ${groupName || '(không rõ)'}\nBài:\n"""\n${String(postText).slice(0, 2000)}\n"""\n\nSản phẩm:\n${list}`;
  const ai = await callAIJson(cfg, { system, messages: [{ role: 'user', content: user }], maxTokens: 400, temperature: 0.7 });

  const product = candidates.find(p => p.id === ai.productId) || null;
  return {
    productId: product?.id ?? null,
    link: product?.link ?? null,
    productName: product?.name ?? null,
    comment: ai.comment && product ? ai.comment.replace(/\{\{LINK\}\}/g, product.link) : (ai.comment ?? null),
    score: ai.score ?? 0,
    reason: ai.reason ?? '',
    skip: ai.skip || !product,
  };
}

// ─── Tự nghĩ sản phẩm + từ khoá để TÌM trên Shopee (chế độ rải link tự động, không catalog) ──
// Trả { wantProduct: bool, keyword: string, reason: string }.
async function extractSearchKeyword(cfg, postText, groupName) {
  const system = `Bạn là chuyên gia affiliate Shopee. Đọc 1 bài đăng Facebook và quyết định:
1. Có nên giới thiệu một sản phẩm Shopee cho bài này không?
2. Nếu có, TỪ KHOÁ ngắn (2-5 từ tiếng Việt) để TÌM sản phẩm đó trên Shopee.
NÊN (wantProduct=true): bài hỏi mua/tư vấn, than thiếu món đồ, xin review, hỏi "shop nào / ở đâu bán", khoe nhu cầu rõ ràng.
KHÔNG (wantProduct=false): tin buồn, chính trị, tâm sự nặng, tranh cãi, đã chốt đơn, bài bán hàng người khác, spam.
keyword: cụm người Việt hay gõ để tìm (vd "giá đỡ điện thoại", "kem chống nắng", "đồ chơi mèo"). KHÔNG kèm thương hiệu lạ, KHÔNG dài dòng.
Chỉ trả JSON: {"wantProduct": bool, "keyword": string, "reason": string ngắn}.`;
  const user = `Nhóm: ${groupName || '(không rõ)'}\nBài:\n"""\n${String(postText).slice(0, 1500)}\n"""`;
  return callAIJson(cfg, { system, messages: [{ role: 'user', content: user }], maxTokens: 200, temperature: 0.4 });
}

// ─── Phân tích 1 nhóm có tiềm năng để rải link không (dựa trên tên + thông tin nhóm) ──
// catalogSummary: chuỗi tóm tắt danh mục SP (vd "Thời trang nam, Mỹ phẩm, Gia dụng…")
async function analyzeGroup(cfg, group, catalogSummary) {
  const system = `Bạn đánh giá một NHÓM Facebook có phù hợp để giới thiệu sản phẩm Shopee hay không.
Danh mục sản phẩm đang bán: ${catalogSummary || '(đa dạng)'}.
NHÓM TIỀM NĂNG: nhóm mua bán, review, hỏi đáp sản phẩm, mẹ&bé, làm đẹp, công nghệ, gia dụng, thời trang, săn sale — nơi người ta hỏi mua/tư vấn đồ.
NHÓM KÉM: tâm sự, chính trị, tôn giáo, hội đồng hương, tin tức, nhóm nội bộ công ty/lớp học, nhóm chỉ đăng meme.
Cân nhắc cả quy mô thành viên (đông + đúng chủ đề = điểm cao).
Chỉ trả JSON: {"potential": bool, "score": 0-100, "reason": string ngắn tiếng Việt}.`;
  const user = `Nhóm: "${group.name}"
Thành viên: ${group.memberCount ?? 'không rõ'}
Quyền riêng tư: ${group.privacy || 'không rõ'}`;
  return callAIJson(cfg, { system, messages: [{ role: 'user', content: user }], maxTokens: 200, temperature: 0.2 });
}

// Phân tích NHIỀU nhóm trong 1 lần gọi (nhanh + rẻ hơn gọi từng nhóm).
// catalogContext: mô tả catalog (danh mục + SP ví dụ + từ khoá). Rỗng = chưa có catalog.
// groups: [{ name, memberCount }] → trả [{ i, niche, potential, score, reason }]
async function analyzeGroupsBatch(cfg, groups, catalogContext) {
  const list = groups.map((g, i) => `${i}. "${g.name}" — TV: ${g.memberCount ?? '?'}`).join('\n');

  const system = catalogContext
    ? `Bạn chấm điểm độ PHÙ HỢP của từng nhóm Facebook để rải link sản phẩm Shopee của shop dưới đây.

=== SẢN PHẨM SHOP ĐANG BÁN ===
${catalogContext}
=== HẾT ===

QUY TẮC chấm điểm 0-100 (QUAN TRỌNG):
- CAO (70-100): chủ đề nhóm KHỚP trực tiếp với sản phẩm shop (vd shop bán đồ thú cưng → nhóm "Hội nuôi mèo"; shop bán đồ cây → nhóm "Yêu cây cảnh").
- TRUNG BÌNH (40-69): liên quan gián tiếp, có thể bán được vài món.
- THẤP (0-39): nhóm KHÔNG liên quan sản phẩm shop (vd nhóm "Cộng đồng AI", "Lập trình", "Tâm sự") → dù đông cũng vô dụng vì không ai mua.
Đừng cho điểm cao chỉ vì nhóm đông; phải KHỚP sản phẩm mới có người mua.
Gắn "niche" = chủ đề chính của nhóm (vd: thú cưng, cây cảnh, cá cảnh, oto, mẹ&bé, làm đẹp, gia dụng, thời trang, công nghệ, không-thương-mại...).
Chỉ trả JSON: {"results":[{"i":number,"niche":string,"potential":bool,"score":number,"reason":string ngắn tiếng Việt}]}`
    : `Bạn chấm điểm độ phù hợp của từng nhóm Facebook để bán hàng tiêu dùng (affiliate Shopee) — CHƯA có catalog cụ thể nên đánh giá theo tiềm năng thương mại chung.
CAO (70-100): nhóm theo SỞ THÍCH/NHU CẦU mua đồ — thú cưng, cá cảnh, cây cảnh, oto-xe, mẹ&bé, làm đẹp/mỹ phẩm, thời trang, gia dụng, đồ bếp, thể thao, mẹo vặt, săn sale.
THẤP (0-39): nhóm phi thương mại — cộng đồng AI/lập trình/công nghệ thuần, tâm sự, chính trị, tôn giáo, đồng hương, tin tức, nội bộ lớp/công ty.
Gắn "niche" = chủ đề chính của nhóm. Chỉ trả JSON: {"results":[{"i":number,"niche":string,"potential":bool,"score":number,"reason":string ngắn}]}`;

  const out = await callAIJson(cfg, { system, messages: [{ role: 'user', content: list }], maxTokens: 1800, temperature: 0.2 });
  return Array.isArray(out?.results) ? out.results : [];
}

// ─── Gợi ý TỪ KHOÁ tìm nhóm theo niche (dựa catalog nếu có, không thì niche Shopee hot) ──
async function suggestNicheKeywords(cfg, catalog) {
  const hasCat = catalog && catalog.length;
  const ctx = hasCat
    ? `Shop đang bán — Danh mục: ${[...new Set(catalog.map(p => p.category).filter(Boolean))].join(', ')}; Sản phẩm: ${catalog.slice(0, 15).map(p => p.name).join('; ')}`
    : '';
  const system = `Bạn gợi ý TỪ KHOÁ để tìm NHÓM Facebook tiếng Việt phục vụ bán hàng affiliate Shopee.
${hasCat ? 'Dựa trên shop dưới đây' : 'Shopee bán đa dạng đồ tiêu dùng — chọn các niche DỄ BÁN nhất'}, đưa 10-12 từ khoá tìm nhóm tiềm năng (nơi người ta hỏi mua / quan tâm sản phẩm).
Mỗi từ khoá là cụm người Việt hay đặt tên nhóm (vd "hội nuôi mèo", "yêu cây cảnh", "cá cảnh", "mẹ bỉm sữa", "ô tô xe hơi", "đồ gia dụng", "mỹ phẩm chính hãng", "đồ câu cá", "phụ kiện điện thoại"...).
Chỉ trả JSON: {"keywords": string[]}`;
  const user = ctx || 'Gợi ý các niche tiêu dùng dễ bán nhất trên Shopee tại Việt Nam.';
  const out = await callAIJson(cfg, { system, messages: [{ role: 'user', content: user }], maxTokens: 700, temperature: 0.6 });
  return Array.isArray(out?.keywords) ? out.keywords.filter(Boolean) : [];
}

self.ShopeAI = { callAI, callAIJson, classifyPost, suggestProduct, socialComment, extractSearchKeyword, analyzeGroup, analyzeGroupsBatch, suggestNicheKeywords, AI_DEFAULT_MODELS };
