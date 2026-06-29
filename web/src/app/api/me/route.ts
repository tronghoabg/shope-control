import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getQuota } from '@/lib/quota'

export async function GET() {
  const session = await auth()
  const id = (session?.user as any)?.id
  if (!id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const q = await getQuota(id)
  return NextResponse.json({ ...q, dailyLimit: q.dailyLimit === Infinity ? -1 : q.dailyLimit, remaining: q.remaining === Infinity ? -1 : q.remaining })
}
