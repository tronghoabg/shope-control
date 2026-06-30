import { NextResponse } from 'next/server'
import { userFromRequest, CORS } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,DELETE,OPTIONS' } })
}

// GET /api/posted → lịch sử đã đăng của user (mới nhất trước)
export async function GET(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  const items = await prisma.postedComment.findMany({
    where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 300,
  })
  return NextResponse.json({ items }, { headers: CORS })
}

// DELETE /api/posted → xoá toàn bộ lịch sử của user
export async function DELETE(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  await prisma.postedComment.deleteMany({ where: { userId: user.id } })
  return NextResponse.json({ ok: true }, { headers: CORS })
}
