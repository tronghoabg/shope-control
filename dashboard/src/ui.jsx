// Bộ UI primitive bằng Tailwind — dark thuần, nhất quán.
import { useState } from 'react'
import { IconInfoCircle, IconX } from '@tabler/icons-react'

const cx = (...a) => a.filter(Boolean).join(' ')

// Hộp hướng dẫn ngắn ở đầu trang — ẩn được, nhớ trạng thái theo id (localStorage).
export function Hint({ id, title = 'Hướng dẫn', children }) {
  const key = 'shope_hint_' + id
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  if (hidden) return null
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] backdrop-blur-md p-4 text-sm text-sky-100/90 shadow-sm shadow-sky-950/20">
      <IconInfoCircle size={18} className="mt-0.5 shrink-0 text-sky-400" />
      <div className="flex-1 leading-relaxed">
        <div className="mb-0.5 font-semibold text-sky-200">{title}</div>
        {children}
      </div>
      <button title="Ẩn hướng dẫn" onClick={() => { try { localStorage.setItem(key, '1') } catch {}; setHidden(true) }}
        className="shrink-0 rounded-lg p-1 text-sky-300/60 hover:bg-sky-500/10 hover:text-sky-200 transition-colors"><IconX size={15} /></button>
    </div>
  )
}

export function Card({ className, children, ...p }) {
  return (
    <div 
      className={cx(
        'rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md shadow-lg shadow-slate-950/40 transition-all duration-300 hover:border-slate-700/60 hover:shadow-xl hover:shadow-slate-950/60',
        className
      )} 
      {...p}
    >
      {children}
    </div>
  )
}

// Logo ToolMKT AI — mark gradient + mũi tên tăng trưởng
export function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden className="drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]">
      <defs>
        <linearGradient id="tmkt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8A3D" /><stop offset="1" stopColor="#E23112" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="112" height="112" rx="30" fill="url(#tmkt)" />
      <polyline points="33,84 56,64 73,76 95,46" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="95,46 74,49 92,66" fill="#fff" />
    </svg>
  )
}

export function Section({ title, right, children, className }) {
  return (
    <Card className={cx('p-6', className)}>
      {(title || right) && (
        <div className="mb-5 flex items-center justify-between">
          {typeof title === 'string' ? <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">{title}</h2> : title}
          {right}
        </div>
      )}
      {children}
    </Card>
  )
}

const BTN = {
  primary: 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-sm shadow-indigo-900/30 active:scale-98',
  brand: 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white shadow-sm active:scale-98',
  success: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm active:scale-98',
  danger: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-sm active:scale-98',
  default: 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-slate-600 shadow-sm active:scale-98',
  ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-300 active:scale-98',
}

export function Btn({ variant = 'default', size = 'md', icon: Icon, loading, className, children, onClick, ...p }) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-sm font-semibold' : 'px-4 py-2 text-sm font-medium'
  const [busy, setBusy] = useState(false)
  
  const handle = onClick ? (e) => {
    const r = onClick(e)
    if (r && typeof r.then === 'function') { setBusy(true); r.finally(() => setBusy(false)) }
  } : undefined
  const isLoading = loading || busy
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none select-none', 
        BTN[variant], 
        sz, 
        className
      )}
      disabled={isLoading || p.disabled} onClick={handle} {...p}>
      {isLoading ? <Spinner /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  )
}

const BADGE = {
  gray: 'bg-slate-800/80 text-slate-300 border border-slate-700/60',
  green: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  red: 'bg-red-500/10 text-red-400 border border-red-500/20',
  yellow: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
}

export function Badge({ color = 'gray', className, children }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide border uppercase', 
      BADGE[color], 
      className
    )}>
      {children}
    </span>
  )
}

export function Field({ label, hint, children, right }) {
  return (
    <label className="block space-y-1.5">
      {(label || right) && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">{label}</span>
          {right}
        </div>
      )}
      {children}
      {hint && <p className="text-[11px] text-slate-500 leading-normal">{hint}</p>}
    </label>
  )
}

const INPUT = 'w-full rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700/60 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 focus:shadow-[0_0_12px_rgba(99,102,241,0.15)] focus:bg-slate-950/80'

export const Input = ({ className, ...p }) => <input className={cx(INPUT, className)} {...p} />
export const Textarea = ({ className, ...p }) => <textarea className={cx(INPUT, 'resize-y min-h-[80px]', className)} {...p} />
export const Select = ({ className, children, ...p }) => (
  <div className="relative w-full">
    <select className={cx(INPUT, 'appearance-none pr-10 cursor-pointer', className)} {...p}>{children}</select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
    </div>
  </div>
)

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <button type="button" onClick={() => onChange(!checked)}
        className={cx('relative h-5.5 w-10.5 rounded-full transition-colors duration-200 outline-none', checked ? 'bg-indigo-600 shadow-inner' : 'bg-slate-800')}>
        <span className={cx('absolute top-0.75 h-4 w-4 rounded-full bg-white transition-all shadow duration-200', checked ? 'left-[22px]' : 'left-0.75')} />
      </button>
      {label && <span className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors">{label}</span>}
    </label>
  )
}

export function Stat({ label, value, icon: Icon, color = 'indigo' }) {
  const ring = { 
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', 
    green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20', 
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20', 
    red: 'text-red-400 bg-red-500/10 border-red-500/20', 
    gray: 'text-slate-400 bg-slate-500/10 border-slate-500/20' 
  }[color]
  
  return (
    <Card className="p-5 border-l-4" style={{ borderLeftColor: `var(--color-${color}-500)` }}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="text-2xl font-extrabold text-slate-100 tracking-tight">{value}</div>
        </div>
        {Icon && <div className={cx('grid h-11 w-11 place-items-center rounded-xl border', ring)}><Icon size={22} /></div>}
      </div>
    </Card>
  )
}

export function Spinner({ className }) {
  return <span className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent', className)} />
}

export function Loading({ children = 'Đang tải…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
      <Spinner className="text-indigo-400 h-5 w-5 border-t-transparent" /> {children}
    </div>
  )
}

export function Empty({ icon: Icon, children }) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-16 text-center text-slate-500 border border-dashed border-slate-800/60 rounded-2xl bg-slate-900/10 backdrop-blur-sm">
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-900/50 text-slate-600 border border-slate-800">
          <Icon size={24} className="opacity-75" />
        </div>
      )}
      <div className="text-sm font-medium text-slate-400 max-w-sm leading-relaxed">{children}</div>
    </div>
  )
}
