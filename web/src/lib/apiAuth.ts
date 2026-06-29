import { prisma } from './prisma'
import { auth } from './auth'
import crypto from 'crypto'

export function genApiToken(): string {
  return 'shk_' + crypto.randomBytes(24).toString('hex')
}

// Lấy user từ Bearer apiToken (extension) hoặc session đăng nhập (web).
export async function userFromRequest(req: Request) {
  const h = req.headers.get('authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  if (m) {
    const u = await prisma.user.findUnique({ where: { apiToken: m[1].trim() } })
    if (u) return u
  }
  const session = await auth()
  const id = (session?.user as any)?.id
  if (id) return prisma.user.findUnique({ where: { id } })
  return null
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type',
}
