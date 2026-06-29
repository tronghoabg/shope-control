import Link from 'next/link'

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('rounded-2xl border border-slate-800 bg-slate-900/60', className)}>{children}</div>
}

const BTN: Record<string, string> = {
  brand: 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white',
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  default: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  ghost: 'text-slate-300 hover:text-white',
}
export function LinkBtn({ href, variant = 'default', className, children }: { href: string; variant?: keyof typeof BTN; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors', BTN[variant], className)}>{children}</Link>
}

export function Logo({ size = 9 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`grid place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white`} style={{ width: size * 4, height: size * 4 }}>🛒</div>
      <div>
        <div className="font-bold leading-tight text-slate-100">Shope Control</div>
        <div className="text-[11px] text-slate-500">Rải link Shopee bằng AI</div>
      </div>
    </div>
  )
}

export function Badge({ color = 'gray', children }: { color?: string; children: React.ReactNode }) {
  const C: Record<string, string> = {
    gray: 'bg-slate-700/60 text-slate-300', green: 'bg-emerald-500/15 text-emerald-400',
    orange: 'bg-orange-500/15 text-orange-400', indigo: 'bg-indigo-500/15 text-indigo-300', red: 'bg-red-500/15 text-red-400',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', C[color])}>{children}</span>
}

export function fmtVnd(n: number) { return n.toLocaleString('vi') + '₫' }
