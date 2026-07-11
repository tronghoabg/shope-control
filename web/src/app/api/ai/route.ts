import { NextResponse } from 'next/server'
import { CORS } from '@/lib/apiAuth'
import { guardManaged, callProviderManaged, recordAiTokens, refundAiCall } from '@/lib/aiServer'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// POST /api/ai → gọi AI bằng KEY HỆ THỐNG (managed), prompt do caller cung cấp (generic).
// Body: { system?, messages:[{role,content}], temperature?, maxTokens?, json? }
// (Logic prompt theo từng tác vụ nằm ở /api/ai/task — đây chỉ là cổng generic.)
export async function POST(req: Request) {
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

  const guard = await guardManaged(req, opts)
  if (!guard.ok) return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status, headers: CORS })

  try {
    const { text, tokens } = await callProviderManaged(guard.cfg, opts)
    await recordAiTokens(guard.userId, tokens)
    return NextResponse.json({ text, provider: guard.cfg.provider, model: guard.cfg.model }, { headers: CORS })
  } catch (e: any) {
    await refundAiCall(guard.userId)   // provider lỗi → hoàn lại lượt đã giữ chỗ
    return NextResponse.json({ error: 'AI lỗi: ' + (e?.message || 'unknown'), code: 'PROVIDER_ERROR' }, { status: 502, headers: CORS })
  }
}
