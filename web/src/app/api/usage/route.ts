import { NextResponse } from 'next/server'
import { userFromRequest, CORS } from '@/lib/apiAuth'
import { getQuota, recordComment } from '@/lib/quota'
import { prisma } from '@/lib/prisma'

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

// POST /api/usage → ghi nhận 1 comment/bài đã đăng (+ lưu chi tiết vào lịch sử), trả quota mới (429 nếu hết hạn mức)
// Body (tuỳ chọn): { posted: { mode, groupId, groupName, postId, content, link, permalink } }
export async function POST(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  const body = await req.json().catch(() => null)
  const p = body?.posted
  try {
    const q = await recordComment(user.id)
    if (p) {
      try {
        await prisma.postedComment.create({
          data: {
            userId: user.id, mode: p.mode === 'post' ? 'post' : 'comment',
            groupId: p.groupId ? String(p.groupId) : null, groupName: p.groupName ? String(p.groupName).slice(0, 200) : null,
            postId: p.postId ? String(p.postId) : null, content: String(p.content || '').slice(0, 2000),
            link: p.link ? String(p.link).slice(0, 1000) : null, permalink: p.permalink ? String(p.permalink).slice(0, 1000) : null,
          },
        })
      } catch { /* không chặn quota nếu ghi lịch sử lỗi */ }
    }
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
