'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'Tổng quan', icon: '▦' },
  { href: '/admin/users', label: 'Người dùng', icon: '👤' },
  { href: '/admin/payments', label: 'Thanh toán', icon: '💳' },
  { href: '/admin/plans', label: 'Gói cước', icon: '🏷️' },
  { href: '/admin/ai', label: 'Cấu hình AI', icon: '✨' },
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
            <span className="w-4 text-center text-base leading-none">{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
