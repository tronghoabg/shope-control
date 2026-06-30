import { NextResponse } from 'next/server'
import { CORS } from '@/lib/apiAuth'
import { guardManaged, callProviderManaged, recordAiUsage } from '@/lib/aiServer'
import { TASKS, extractJson } from '@/lib/aiTasks'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// POST /api/ai/task → "bộ não" AI: build prompt + gọi AI (key hệ thống) + bóc JSON + hậu xử lý.
// Body: { task: string, args: object }. Extension chỉ gửi dữ liệu thô, nhận kết quả đã xử lý.
export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400, headers: CORS }) }

  const def = TASKS[body?.task]
  if (!def) return NextResponse.json({ error: 'task không hợp lệ: ' + body?.task }, { status: 400, headers: CORS })

  let opts
  try { opts = def.build(body.args || {}) } catch (e: any) {
    return NextResponse.json({ error: 'args lỗi: ' + (e?.message || 'unknown') }, { status: 400, headers: CORS })
  }

  const guard = await guardManaged(req, opts)
  if (!guard.ok) return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status, headers: CORS })

  try {
    const { text, tokens } = await callProviderManaged(guard.cfg, opts)
    await recordAiUsage(guard.userId, tokens)
    let result: any = opts.json ? extractJson(text) : text
    if (def.post) result = def.post(result, body.args || {})
    return NextResponse.json({ result, provider: guard.cfg.provider, model: guard.cfg.model }, { headers: CORS })
  } catch (e: any) {
    return NextResponse.json({ error: 'AI lỗi: ' + (e?.message || 'unknown'), code: 'PROVIDER_ERROR' }, { status: 502, headers: CORS })
  }
}
