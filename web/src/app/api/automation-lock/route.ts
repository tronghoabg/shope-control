import { NextResponse } from 'next/server'
import { userFromRequest, CORS } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST,PATCH,DELETE,OPTIONS' } })
}

export async function POST(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  const body = await req.json().catch(() => ({}))
  const targetKey = String(body.targetKey || '').slice(0, 300)
  const owner = String(body.owner || '').slice(0, 120)
  if (!targetKey || !owner) return NextResponse.json({ error: 'invalid_lock' }, { status: 400, headers: CORS })
  const now = new Date()
  const alreadyDone = await prisma.postedComment.findFirst({ where: { userId: user.id, fingerprint: targetKey }, select: { id: true } })
  if (alreadyDone) return NextResponse.json({ ok: false, duplicate: true, reason: 'already_completed' }, { status: 409, headers: CORS })
  await prisma.automationLock.deleteMany({ where: { expiresAt: { lt: now } } })
  try {
    await prisma.automationLock.create({
      data: { userId: user.id, targetKey, owner, expiresAt: new Date(Date.now() + Math.min(30 * 60_000, Math.max(60_000, Number(body.ttlMs) || 10 * 60_000))) },
    })
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch {
    return NextResponse.json({ ok: false, duplicate: true, reason: 'locked_elsewhere' }, { status: 409, headers: CORS })
  }
}

export async function DELETE(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  const body = await req.json().catch(() => ({}))
  await prisma.automationLock.deleteMany({
    where: { userId: user.id, targetKey: String(body.targetKey || '').slice(0, 300), owner: String(body.owner || '').slice(0, 120) },
  })
  return NextResponse.json({ ok: true }, { headers: CORS })
}

export async function PATCH(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
  const body = await req.json().catch(() => ({}))
  const targetKey = String(body.targetKey || '').slice(0, 300)
  if (!targetKey) return NextResponse.json({ error: 'invalid_target' }, { status: 400, headers: CORS })
  const recent = await prisma.postedComment.findFirst({
    where: {
      userId: user.id, groupId: String(body.groupId || ''),
      content: String(body.content || '').slice(0, 2000),
      createdAt: { gt: new Date(Date.now() - 30 * 60_000) },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (recent) {
    await prisma.postedComment.update({ where: { id: recent.id }, data: { fingerprint: targetKey, sourceKey: recent.sourceKey || `tool:${targetKey}` } })
  } else {
    await prisma.postedComment.create({
      data: {
        userId: user.id, mode: 'post', source: 'toolmkt', sourceKey: `tool:${targetKey}`, fingerprint: targetKey,
        groupId: String(body.groupId || '') || null, groupName: String(body.groupName || '').slice(0, 200) || null,
        content: String(body.content || '').slice(0, 2000), permalink: String(body.permalink || '').slice(0, 1000) || null,
      },
    })
  }
  return NextResponse.json({ ok: true }, { headers: CORS })
}
