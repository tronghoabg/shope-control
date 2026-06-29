import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  trustHost: true,
  providers: [
    Google,
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email || '').trim().toLowerCase()
        const password = String(creds?.password || '')
        if (!email || !password) return null
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user?.passwordHash) return null
        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null
        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.uid = (user as any).id
        token.role = (user as any).role || 'user'
      }
      return token
    },
    session: ({ session, token }) => {
      if (session.user) {
        ;(session.user as any).id = token.uid
        ;(session.user as any).role = token.role || 'user'
      }
      return session
    },
  },
})
