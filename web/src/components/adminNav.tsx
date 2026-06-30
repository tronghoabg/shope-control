'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, CreditCard, Tag, Sparkles } from 'lucide-react'

const NAV = [
  { href: '/admin', label: 'Tổng quan', Icon: LayoutDashboard },
  { href: '/admin/users', label: 'Người dùng', Icon: Users },
  { href: '/admin/payments', label: 'Thanh toán', Icon: CreditCard },
  { href: '/admin/plans', label: 'Gói cước', Icon: Tag },
  { href: '/admin/ai', label: 'Cấu hình AI', Icon: Sparkles },
]

export function AdminNav() {
  const path = usePathname()
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map(n => {
        const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href)
        return (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
            <n.Icon size={17} />
            <span>{n.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
