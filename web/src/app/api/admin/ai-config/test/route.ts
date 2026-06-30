import { NextResponse } from 'next/server'
import { userFromRequest } from '@/lib/apiAuth'
import { getAiConfig } from '@/lib/aiConfig'
import { callProviderManaged } from '@/lib/aiServer'

// POST /api/admin/ai-config/test → gọi thử AI bằng cấu hình đang lưu (admin).
export async function POST(req: Request) {
  const u = await userFromRequest(req)
  if (!u || u.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const cfg = await getAiConfig()
  if (!cfg.key) return NextResponse.json({ ok: false, error: 'Chưa có API key cho provider đang chọn — lưu key trước.' })

  const t0 = Date.now()
  try {
    const { text } = await callProviderManaged(cfg, { messages: [{ role: 'user', content: 'Trả lời đúng 1 từ: OK' }], maxTokens: 12 })
    return NextResponse.json({ ok: true, reply: (text || '').trim().slice(0, 40) || '(rỗng)', ms: Date.now() - t0, provider: cfg.provider, model: cfg.model })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'lỗi không rõ' })
  }
}
