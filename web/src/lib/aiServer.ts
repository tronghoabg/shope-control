import { prisma } from './prisma'
import { vnDateKey, getActivePlan } from './quota'
import { AiConfig, getAiConfig } from './aiConfig'
import { userFromRequest } from './apiAuth'
import { PLANS } from './plans'

// ─────────────────────────────────────────────────────────────────────────────
// Chống lạm dụng #1: rate-limit theo PHÚT (in-memory — server chạy 1 tiến trình PM2).
// Sliding window: mỗi user tối đa N lượt/60s. Chặn burst bot.
// ─────────────────────────────────────────────────────────────────────────────
const RATE_PER_MIN = 45
const _hits = new Map<string, number[]>()
export function rateLimitOk(userId: string): boolean {
  const now = Date.now()
  const arr = (_hits.get(userId) || []).filter(t => now - t < 60_000)
  if (arr.length >= RATE_PER_MIN) { _hits.set(userId, arr); return false }
  arr.push(now); _hits.set(userId, arr)
  if (_hits.size > 5000) { for (const [k, v] of _hits) if (!v.some(t => now - t < 60_000)) _hits.delete(k) } // dọn rác
  return true
}

// Chống lạm dụng #2: giới hạn KÍCH THƯỚC input (chống "token bomb").
export const MAX_INPUT_CHARS = 16_000
export function inputCharCount(opts: { system?: string; messages: { content: string }[] }): number {
  return (opts.system?.length || 0) + (opts.messages || []).reduce((s, m) => s + (m.content?.length || 0), 0)
}

// Số lượt AI đã dùng hôm nay (giờ VN).
export async function aiUsedToday(userId: string): Promise<number> {
  const u = await prisma.dailyUsage.findUnique({ where: { userId_date: { userId, date: vnDateKey() } } })
  return u?.aiCalls ?? 0
}

// Ghi nhận 1 lượt gọi AI + token (ngày + tổng đời).
export async function recordAiUsage(userId: string, tokens: number) {
  const date = vnDateKey()
  await prisma.dailyUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, aiCalls: 1, aiTokens: tokens },
    update: { aiCalls: { increment: 1 }, aiTokens: { increment: tokens } },
  })
  await prisma.user.update({ where: { id: userId }, data: { aiCallsTotal: { increment: 1 }, aiTokensTotal: { increment: tokens } } }).catch(() => {})
}

export interface AiOpts {
  system?: string
  messages: { role: string; content: string }[]
  temperature?: number
  maxTokens?: number
  json?: boolean
}

// Gọi provider bằng KEY HỆ THỐNG (managed). Trả { text, tokens }.
export async function callProviderManaged(cfg: AiConfig, opts: AiOpts): Promise<{ text: string; tokens: number }> {
  const { provider, model, key } = cfg
  const maxTokens = Math.min(opts.maxTokens ?? 600, 2000)
  const temperature = opts.temperature

  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, ...(opts.system ? { system: opts.system } : {}), ...(temperature !== undefined ? { temperature } : {}), messages: opts.messages }),
    })
    const j: any = await r.json()
    if (!r.ok) throw new Error(j?.error?.message || `anthropic ${r.status}`)
    const text = j.content?.[0]?.text || ''
    const tokens = (j.usage?.input_tokens || 0) + (j.usage?.output_tokens || 0)
    return { text, tokens: tokens || approxTokens(opts, text) }
  }

  if (provider === 'openai') {
    const messages: any[] = []
    if (opts.system) messages.push({ role: 'system', content: opts.system })
    messages.push(...opts.messages)
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, max_tokens: maxTokens, ...(temperature !== undefined ? { temperature } : {}), ...(opts.json ? { response_format: { type: 'json_object' } } : {}), messages }),
    })
    const j: any = await r.json()
    if (!r.ok) throw new Error(j?.error?.message || `openai ${r.status}`)
    const text = j.choices?.[0]?.message?.content || ''
    return { text, tokens: j.usage?.total_tokens || approxTokens(opts, text) }
  }

  // gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: opts.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        ...(/2\.5|thinking/i.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
  })
  const j: any = await r.json()
  if (!r.ok) throw new Error(j?.error?.message || `gemini ${r.status}`)
  const text = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
  const tokens = j.usageMetadata?.totalTokenCount || approxTokens(opts, text)
  return { text, tokens }
}

function approxTokens(opts: AiOpts, out: string): number {
  const inChars = (opts.system?.length || 0) + opts.messages.reduce((s, m) => s + m.content.length, 0)
  return Math.ceil((inChars + out.length) / 4) // ~4 ký tự/token
}

// ── Cổng chung cho mọi yêu cầu AI managed: auth + ban + rate-limit + input + cap/ngày + key hệ thống.
// Dùng cho cả /api/ai (generic) và /api/ai/task. Trả cfg + userId khi hợp lệ, hoặc lỗi để route trả về.
export type Guard =
  | { ok: true; cfg: AiConfig; userId: string }
  | { ok: false; status: number; error: string; code?: string }

export async function guardManaged(req: Request, opts: { system?: string; messages: { content: string }[] }): Promise<Guard> {
  const user = await userFromRequest(req)
  if (!user) return { ok: false, status: 401, error: 'unauthorized' }
  if (user.bannedAt) return { ok: false, status: 403, error: 'Tài khoản bị tạm khoá AI hệ thống (nghi lạm dụng). Liên hệ admin.', code: 'BANNED' }
  if (!rateLimitOk(user.id)) return { ok: false, status: 429, error: 'Quá nhiều yêu cầu, chậm lại chút nhé.', code: 'RATE_LIMIT' }
  if (inputCharCount(opts) > MAX_INPUT_CHARS) return { ok: false, status: 413, error: 'Nội dung quá dài.', code: 'TOO_LARGE' }
  const plan = await getActivePlan(user.id)
  const cap = PLANS[plan].aiDailyCap
  const used = await aiUsedToday(user.id)
  if (used >= cap) return { ok: false, status: 429, error: `Đã đạt trần ${cap} lượt AI/ngày của gói. Nâng cấp để dùng tiếp.`, code: 'AI_CAP' }
  const cfg = await getAiConfig()
  if (!cfg.key) return { ok: false, status: 503, error: 'AI hệ thống chưa được cấu hình. Vào /admin để nhập API key.', code: 'NO_SYSTEM_KEY' }
  return { ok: true, cfg, userId: user.id }
}
