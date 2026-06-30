import { NextResponse } from 'next/server'
import { userFromRequest } from '@/lib/apiAuth'
import { getAiConfigStatus, saveAiConfig, AiProvider } from '@/lib/aiConfig'

async function requireAdmin(req: Request) {
  const u = await userFromRequest(req)
  return u && u.role === 'admin' ? u : null
}

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  return NextResponse.json(await getAiConfigStatus())
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const provider = ['anthropic', 'openai', 'gemini'].includes(body.provider) ? (body.provider as AiProvider) : undefined
  await saveAiConfig({ provider, model: body.model, keys: body.keys })
  return NextResponse.json(await getAiConfigStatus())
}
