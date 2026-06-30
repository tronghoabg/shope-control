// aiTasks.ts — TOÀN BỘ "bộ não" AI nằm ở server: prompt + bóc JSON + hậu xử lý.
// Extension chỉ gửi dữ liệu thô { task, args } tới /api/ai/task và nhận kết quả đã xử lý.
// (Trước đây các prompt này nằm trong extension/ai.js — đã chuyển hẳn sang đây.)
import { AiOpts } from './aiServer'

export type Built = AiOpts & { json?: boolean }
export interface TaskDef {
  build: (a: any) => Built
  post?: (result: any, a: any) => any
}

// ── Bóc JSON từ output model (chịu được fence ```json, thừa text, trailing comma) ──
export function extractJson(text: string): any {
  const raw = String(text || '')
  let s = raw.replace(/^﻿/, '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const oA = s.indexOf('{'), oB = s.lastIndexOf('}')
  const aA = s.indexOf('['), aB = s.lastIndexOf(']')
  if (oA !== -1 && oB > oA) s = s.slice(oA, oB + 1)
  else if (aA !== -1 && aB > aA) s = s.slice(aA, aB + 1)
  s = s.replace(/,\s*([}\]])/g, '$1')
  try { return JSON.parse(s) }
  catch {
    const snippet = (raw.trim() || '(rỗng)').slice(0, 140).replace(/\s+/g, ' ')
    throw new Error(`AI trả JSON không hợp lệ. Model nói: "${snippet}"`)
  }
}

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n)

export const TASKS: Record<string, TaskDef> = {
  // ── Bài có tiềm năng để comment không (theo mode) ──
  classify: {
    build: (a) => {
      const mode = a.mode === 'social' ? 'social' : 'affiliate'
      const system = mode === 'social'
        ? `Bạn đánh giá bài đăng Facebook xem có hợp để BÌNH LUẬN DẠO (tự nhiên, thân thiện) không.
HỢP: bài chia sẻ, khoe, hỏi đáp, xin ý kiến, kể chuyện đời thường, vui vẻ.
KHÔNG hợp: tin buồn/tang lễ, chính trị, tôn giáo nhạy cảm, tranh cãi gay gắt, bài bán hàng, spam.
Chỉ trả JSON: {"potential": bool, "score": 0-100, "intent": string, "reason": string ngắn}.`
        : `Bạn là trợ lý đánh giá bài đăng Facebook cho người làm affiliate Shopee.
Xác định một bài đăng có "tiềm năng" để comment giới thiệu sản phẩm hay không.
TIỀM NĂNG: hỏi mua/tư vấn, than thiếu món đồ, xin review, hỏi "shop nào", "ở đâu bán".
KHÔNG tiềm năng: tin buồn, chính trị, tranh cãi, đã chốt đơn, bài bán hàng người khác, spam.
Chỉ trả JSON: {"potential": bool, "score": 0-100, "intent": string, "reason": string ngắn}.`
      const user = `Nhóm: ${a.group || '(không rõ)'}\nBài:\n"""\n${clip(a.text, 2000)}\n"""`
      return { system, messages: [{ role: 'user', content: user }], maxTokens: 300, temperature: 0.2, json: true }
    },
  },

  // ── Comment dạo có sẵn nội dung tìm khách → viết lại biến thể chống trùng ──
  varySeed: {
    build: (a) => {
      const system = `Bạn là người bán hàng đi tìm khách trên Facebook, viết comment ${a.tone || 'tự nhiên, thân thiện'}.
Bạn có 1 NỘI DUNG GỐC (lời mời/tìm khách). Hãy VIẾT LẠI thành 1 comment KHÁC để thả dưới bài đăng:
- Giữ nguyên Ý CHÍNH & lời mời của NỘI DUNG GỐC (sản phẩm/dịch vụ, cách liên hệ, số điện thoại/link nếu có).
- ĐỔI cách diễn đạt/câu chữ để KHÔNG trùng khi đăng nhiều nơi (tránh bị gắn cờ spam).
- Cho hợp ngữ cảnh bài đăng một chút nếu phù hợp; tự nhiên như người thật, 1-3 câu, tối đa 1-2 emoji.
- Nếu bài không hợp (tin buồn nặng, nhạy cảm, chính trị) → skip.
Chỉ trả JSON: {"comment": string|null, "skip": bool, "reason": string}`
      const user = `Nhóm: ${a.group || '(không rõ)'}\nNỘI DUNG GỐC:\n"""\n${clip(a.seed, 1500)}\n"""\n\nBài đăng:\n"""\n${clip(a.text, 1500)}\n"""`
      return { system, messages: [{ role: 'user', content: user }], maxTokens: 400, temperature: 1.0, json: true }
    },
  },

  // ── Comment dạo tự nhiên, không link ──
  social: {
    build: (a) => {
      const system = `Bạn bình luận dạo trên Facebook như một người thật, ${a.tone || 'thân thiện, tự nhiên'}.
Cho 1 bài đăng, viết 1 comment NGẮN (1-2 câu) hợp ngữ cảnh: đồng cảm / khen / hỏi thêm / góp vui.
TUYỆT ĐỐI KHÔNG quảng cáo, KHÔNG link, KHÔNG bán hàng, KHÔNG xin info.
Tránh sáo rỗng ("hay quá ạ"), tránh spam, tối đa 1 emoji.
Nếu bài không hợp (tin buồn nặng, nhạy cảm, chính trị) → skip.
Chỉ trả JSON: {"comment": string|null, "skip": bool, "reason": string}`
      const user = `Nhóm: ${a.group || '(không rõ)'}\nBài:\n"""\n${clip(a.text, 2000)}\n"""`
      return { system, messages: [{ role: 'user', content: user }], maxTokens: 250, temperature: 0.8, json: true }
    },
  },

  // ── Chọn SP khớp + sinh comment; nối link thật ở server ──
  suggestProduct: {
    build: (a) => {
      const candidates: any[] = Array.isArray(a.candidates) ? a.candidates : []
      const list = candidates
        .map(p => `- id=${p.id} | ${p.name} | danh mục: ${p.category} | giá: ${p.price}đ | từ khoá: ${(p.keywords || []).join(', ')}`)
        .join('\n')
      const system = `Bạn là chuyên gia affiliate Shopee, viết comment Facebook tự nhiên như người thật.
Cho bài đăng + danh sách sản phẩm:
1. Chọn 1 sản phẩm KHỚP NHẤT (hoặc bỏ qua nếu không hợp).
2. Viết comment NGẮN 1-3 câu, thân thiện, không sượng, không sến, như gợi ý cho bạn bè.
   - KHÔNG bịa link; chèn đúng 1 token literal {{LINK}}.
   - Tối đa 1-2 emoji. Tránh từ spam ("mua ngay","giá sốc","inbox").
Giọng: ${a.tone || 'tự nhiên, thân thiện'}.
Chỉ trả JSON: {"productId": string|null, "comment": string|null, "score": 0-100, "reason": string, "skip": bool}`
      const user = `Nhóm: ${a.group || '(không rõ)'}\nBài:\n"""\n${clip(a.text, 2000)}\n"""\n\nSản phẩm:\n${list}`
      return { system, messages: [{ role: 'user', content: user }], maxTokens: 400, temperature: 0.7, json: true }
    },
    post: (ai, a) => {
      const candidates: any[] = Array.isArray(a.candidates) ? a.candidates : []
      const product = candidates.find(p => String(p.id) === String(ai?.productId)) || null
      return {
        productId: product?.id ?? null,
        link: product?.link ?? null,
        productName: product?.name ?? null,
        comment: ai?.comment && product ? String(ai.comment).replace(/\{\{LINK\}\}/g, product.link) : (ai?.comment ?? null),
        score: ai?.score ?? 0,
        reason: ai?.reason ?? '',
        skip: ai?.skip || !product,
      }
    },
  },

  // ── Tự nghĩ sản phẩm + từ khoá để tìm trên Shopee (rải link tự động, không catalog) ──
  searchKeyword: {
    build: (a) => {
      const system = `Bạn là chuyên gia affiliate Shopee. Đọc 1 bài đăng Facebook và quyết định:
1. Có nên giới thiệu một sản phẩm Shopee cho bài này không?
2. Nếu có, TỪ KHOÁ ngắn (2-5 từ tiếng Việt) để TÌM sản phẩm đó trên Shopee.
NÊN (wantProduct=true): bài hỏi mua/tư vấn, than thiếu món đồ, xin review, hỏi "shop nào / ở đâu bán", khoe nhu cầu rõ ràng.
KHÔNG (wantProduct=false): tin buồn, chính trị, tâm sự nặng, tranh cãi, đã chốt đơn, bài bán hàng người khác, spam.
keyword: cụm người Việt hay gõ để tìm (vd "giá đỡ điện thoại", "kem chống nắng", "đồ chơi mèo"). KHÔNG kèm thương hiệu lạ, KHÔNG dài dòng.
Chỉ trả JSON: {"wantProduct": bool, "keyword": string, "reason": string ngắn}.`
      const user = `Nhóm: ${a.group || '(không rõ)'}\nBài:\n"""\n${clip(a.text, 1500)}\n"""`
      return { system, messages: [{ role: 'user', content: user }], maxTokens: 200, temperature: 0.4, json: true }
    },
  },

  // ── Chấm điểm NHIỀU nhóm trong 1 lần (nhanh + rẻ) ──
  analyzeGroups: {
    build: (a) => {
      const groups: any[] = Array.isArray(a.groups) ? a.groups : []
      const list = groups.map((g, i) => `${i}. "${g.name}" — TV: ${g.memberCount ?? '?'}`).join('\n')
      const system = a.catalogContext
        ? `Bạn chấm điểm độ PHÙ HỢP của từng nhóm Facebook để rải link sản phẩm Shopee của shop dưới đây.

=== SẢN PHẨM SHOP ĐANG BÁN ===
${a.catalogContext}
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
Gắn "niche" = chủ đề chính của nhóm. Chỉ trả JSON: {"results":[{"i":number,"niche":string,"potential":bool,"score":number,"reason":string ngắn}]}`
      return { system, messages: [{ role: 'user', content: list }], maxTokens: 1800, temperature: 0.2, json: true }
    },
    post: (r) => (Array.isArray(r?.results) ? r.results : []),
  },

  // ── Gợi ý từ khoá tìm nhóm theo niche ──
  suggestNiches: {
    build: (a) => {
      const catalog: any[] = Array.isArray(a.catalog) ? a.catalog : []
      const hasCat = catalog.length > 0
      const ctx = hasCat
        ? `Shop đang bán — Danh mục: ${[...new Set(catalog.map(p => p.category).filter(Boolean))].join(', ')}; Sản phẩm: ${catalog.slice(0, 15).map(p => p.name).join('; ')}`
        : ''
      const system = `Bạn gợi ý TỪ KHOÁ để tìm NHÓM Facebook tiếng Việt phục vụ bán hàng affiliate Shopee.
${hasCat ? 'Dựa trên shop dưới đây' : 'Shopee bán đa dạng đồ tiêu dùng — chọn các niche DỄ BÁN nhất'}, đưa 10-12 từ khoá tìm nhóm tiềm năng (nơi người ta hỏi mua / quan tâm sản phẩm).
Mỗi từ khoá là cụm người Việt hay đặt tên nhóm (vd "hội nuôi mèo", "yêu cây cảnh", "cá cảnh", "mẹ bỉm sữa", "ô tô xe hơi", "đồ gia dụng", "mỹ phẩm chính hãng", "đồ câu cá", "phụ kiện điện thoại"...).
Chỉ trả JSON: {"keywords": string[]}`
      const user = ctx || 'Gợi ý các niche tiêu dùng dễ bán nhất trên Shopee tại Việt Nam.'
      return { system, messages: [{ role: 'user', content: user }], maxTokens: 700, temperature: 0.6, json: true }
    },
    post: (r) => (Array.isArray(r?.keywords) ? r.keywords.filter(Boolean) : []),
  },

  // ── Viết lại nội dung marketing (chống trùng khi đăng nhiều nhóm) ──
  rewrite: {
    build: (a) => ({
      system: 'Bạn là trợ lý viết nội dung marketing tiếng Việt, tự nhiên, đúng trọng tâm.',
      temperature: 1.0, maxTokens: 700,
      messages: [{ role: 'user', content:
`Viết lại đoạn nội dung marketing dưới đây thành MỘT phiên bản KHÁC bằng tiếng Việt:
- Giữ nguyên ý chính, thông điệp; giữ nguyên số điện thoại, link, hashtag, emoji nếu có.
- Thay đổi cách diễn đạt/câu chữ để KHÔNG trùng lặp khi đăng vào nhiều nhóm Facebook.
- Tránh từ ngữ dễ bị Facebook coi là spam/vi phạm.
- CHỈ trả về nội dung bài viết hoàn chỉnh, KHÔNG thêm lời giải thích, KHÔNG bọc trong dấu ngoặc.

"""
${clip(a.text, 4000)}
"""` }],
      json: false,
    }),
    post: (r) => String(r || '').trim(),
  },

  // ── Kiểm tra AI hệ thống có hoạt động không ──
  test: {
    build: () => ({
      messages: [{ role: 'user', content: 'Trả lời đúng 2 từ in hoa: OK SHOPE' }],
      maxTokens: 20, temperature: 0, json: false,
    }),
    post: (r) => String(r || '').trim(),
  },
}
