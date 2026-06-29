import { NextResponse } from 'next/server'
import { userFromRequest, CORS } from '@/lib/apiAuth'
import { getQuota, recordComment } from '@/lib/quota'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// GET /api/usage → quota hiện tại (extension gọi bằng Bearer apiToken)
export async function GET(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  const q = await getQuota(user.id)
  return NextResponse.json(serialize(q), { headers: CORS })
}

// POST /api/usage → ghi nhận 1 comment đã đăng, trả quota mới (429 nếu hết hạn mức free)
export async function POST(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  try {
    const q = await recordComment(user.id)
    return NextResponse.json(serialize(q), { headers: CORS })
  } catch (e: any) {
    if (e?.code === 'QUOTA_EXCEEDED') return NextResponse.json({ error: e.message, code: 'QUOTA_EXCEEDED' }, { status: 429, headers: CORS })
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: CORS })
  }
}

// Infinity → -1 cho JSON
function serialize(q: any) {
  return { ...q, dailyLimit: q.dailyLimit === Infinity ? -1 : q.dailyLimit, remaining: q.remaining === Infinity ? -1 : q.remaining }
}
