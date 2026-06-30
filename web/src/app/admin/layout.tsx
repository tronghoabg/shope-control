import Link from 'next/link'
import { requireAdmin } from '@/lib/adminGuard'
import { Logo, Badge } from '@/components/ui'
import { SignOutBtn } from '@/components/dashboard'
import { AdminNav } from '@/components/adminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2 px-4 py-4">
          <Logo /><Badge color="indigo">Admin</Badge>
        </div>
        <AdminNav />
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-800 p-3 text-xs">
          <Link href="/dashboard" className="text-slate-400 hover:text-white">← Dashboard</Link>
          <SignOutBtn />
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
