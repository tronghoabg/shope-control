import { redirect } from 'next/navigation'
import { auth } from './auth'
import { prisma } from './prisma'

// Dùng trong server component admin: chặn non-admin (đọc role từ DB → cấp quyền tức thì, khỏi login lại).
export async function requireAdmin() {
  const session = await auth()
  const uid = (session?.user as any)?.id
  if (!uid) redirect('/login')
  const me = await prisma.user.findUnique({ where: { id: uid } })
  if (me?.role !== 'admin') redirect('/dashboard')
  return me
}
