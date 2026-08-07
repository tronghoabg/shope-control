import { NextResponse } from 'next/server'
import { userFromRequest, CORS } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const text = (v: unknown, max: number) => String(v || '').slice(0, max)

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' } })
}

export async function GET(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  const [items, last] = await Promise.all([
    prisma.postedComment.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 1000 }),
    prisma.postedComment.findFirst({ where: { userId: user.id, source: 'facebook_activity' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ])
  return NextResponse.json({
    items,
    commentedPostIds: [...new Set(items.filter(x => x.mode !== 'post' && x.postId).map(x => x.postId))],
    lastSyncedAt: last?.createdAt?.getTime() || 0,
  }, { headers: CORS })
}

export async function POST(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body.items) ? body.items.slice(0, 1000) : []
  let added = 0, updated = 0, ignored = 0
  for (const p of items) {
    const postId = text(p?.postId, 100)
    const externalId = text(p?.commentId || p?.id || postId, 160)
    if (!postId || !externalId) { ignored++; continue }
    const kind = p?.kind === 'post' ? 'post' : 'comment'
    const sourceKey = `fb:${kind}:${externalId}`
    const existing = await prisma.postedComment.findUnique({ where: { userId_sourceKey: { userId: user.id, sourceKey } }, select: { id: true } })
    await prisma.postedComment.upsert({
      where: { userId_sourceKey: { userId: user.id, sourceKey } },
      create: {
        userId: user.id, source: 'facebook_activity', sourceKey,
        fingerprint: kind === 'comment' ? `comment:${postId}` : null,
        mode: kind === 'post' ? 'post' : 'social', postId,
        groupId: text(p?.groupId, 100) || null, groupName: text(p?.groupName, 200) || null,
        content: text(p?.content || p?.comment, 4000), permalink: text(p?.permalink, 1000) || null,
        createdAt: p?.createdAt ? new Date(Number(p.createdAt)) : new Date(),
      },
      update: {
        groupId: text(p?.groupId, 100) || null, groupName: text(p?.groupName, 200) || null,
        content: text(p?.content || p?.comment, 4000), permalink: text(p?.permalink, 1000) || null,
      },
    })
    existing ? updated++ : added++
  }
  const known = await prisma.postedComment.findMany({
    where: { userId: user.id, postId: { not: null }, mode: { not: 'post' } },
    select: { postId: true }, distinct: ['postId'], take: 10000,
  })
  return NextResponse.json({ ok: true, received: items.length, added, updated, ignored, commentedPostIds: known.map(x => x.postId).filter(Boolean) }, { headers: CORS })
}
