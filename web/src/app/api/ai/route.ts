import { NextResponse } from 'next/server'
import { userFromRequest, CORS } from '@/lib/apiAuth'
import { getActivePlan } from '@/lib/quota'
import { PLANS } from '@/lib/plans'
import { getAiConfig } from '@/lib/aiConfig'
import { callProviderManaged, rateLimitOk, aiUsedToday, recordAiUsage, inputCharCount, MAX_INPUT_CHARS } from '@/lib/aiServer'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// POST /api/ai → gọi AI bằng KEY HỆ THỐNG (managed). Extension gọi khi user KHÔNG nhập key riêng.
// Body: { system?, messages:[{role,content}], temperature?, maxTokens?, json? }
export async function POST(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  if (user.bannedAt) return NextResponse.json({ error: 'Tài khoản bị tạm khoá AI hệ thống (nghi lạm dụng). Liên hệ admin.', code: 'BANNED' }, { status: 403, headers: CORS })

  // Chống lạm dụng #1: rate-limit/phút
  if (!rateLimitOk(user.id)) return NextResponse.json({ error: 'Quá nhiều yêu cầu, chậm lại chút nhé.', code: 'RATE_LIMIT' }, { status: 429, headers: CORS })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400, headers: CORS }) }
  const opts = {
    system: typeof body.system === 'string' ? body.system : undefined,
    messages: Array.isArray(body.messages) ? body.messages.filter((m: any) => m && typeof m.content === 'string') : [],
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : undefined,
    json: !!body.json,
  }
  if (!opts.messages.length) return NextResponse.json({ error: 'messages rỗng' }, { status: 400, headers: CORS })

  // Chống lạm dụng #2: chặn input quá lớn (token bomb)
  if (inputCharCount(opts) > MAX_INPUT_CHARS) return NextResponse.json({ error: 'Nội dung quá dài.', code: 'TOO_LARGE' }, { status: 413, headers: CORS })

  // Chống lạm dụng #3: trần lượt AI/ngày theo gói
  const plan = await getActivePlan(user.id)
  const cap = PLANS[plan].aiDailyCap
  const used = await aiUsedToday(user.id)
  if (used >= cap) return NextResponse.json({ error: `Đã đạt trần ${cap} lượt AI/ngày của gói. Nâng cấp hoặc nhập API key riêng để dùng tiếp.`, code: 'AI_CAP' }, { status: 429, headers: CORS })

  // Key hệ thống
  const cfg = await getAiConfig()
  if (!cfg.key) return NextResponse.json({ error: 'AI hệ thống chưa được cấu hình. Vào /admin để nhập API key, hoặc nhập key riêng trong Cài đặt.', code: 'NO_SYSTEM_KEY' }, { status: 503, headers: CORS })

  try {
    const { text, tokens } = await callProviderManaged(cfg, opts)
    await recordAiUsage(user.id, tokens)
    return NextResponse.json({ text, provider: cfg.provider, model: cfg.model }, { headers: CORS })
  } catch (e: any) {
    return NextResponse.json({ error: 'AI lỗi: ' + (e?.message || 'unknown'), code: 'PROVIDER_ERROR' }, { status: 502, headers: CORS })
  }
}
