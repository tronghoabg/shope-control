// Bộ UI primitive bằng Tailwind — dark thuần, nhất quán.
import { useState } from 'react'

const cx = (...a) => a.filter(Boolean).join(' ')

export function Card({ className, children, ...p }) {
  return <div className={cx('rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm', className)} {...p}>{children}</div>
}

export function Section({ title, right, children, className }) {
  return (
    <Card className={cx('p-5', className)}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between">
          {typeof title === 'string' ? <h2 className="text-sm font-semibold text-slate-100">{title}</h2> : title}
          {right}
        </div>
      )}
      {children}
    </Card>
  )
}

const BTN = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  brand: 'bg-brand hover:bg-brand-600 text-white',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  default: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  ghost: 'bg-transparent hover:bg-slate-800 text-slate-300',
}
export function Btn({ variant = 'default', size = 'md', icon: Icon, loading, className, children, onClick, ...p }) {
  const sz = size === 'sm' ? 'px-2.5 py-1 text-xs' : size === 'lg' ? 'px-4 py-2.5 text-sm' : 'px-3 py-1.5 text-sm'
  const [busy, setBusy] = useState(false)
  // Tự bật spinner nếu onClick trả về Promise (async) → mọi nút async đều có spin
  const handle = onClick ? (e) => {
    const r = onClick(e)
    if (r && typeof r.then === 'function') { setBusy(true); r.finally(() => setBusy(false)) }
  } : undefined
  const isLoading = loading || busy
  return (
    <button
      className={cx('inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed', BTN[variant], sz, className)}
      disabled={isLoading || p.disabled} onClick={handle} {...p}>
      {isLoading ? <Spinner /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  )
}

const BADGE = {
  gray: 'bg-slate-700/60 text-slate-300',
  green: 'bg-emerald-500/15 text-emerald-400',
  red: 'bg-red-500/15 text-red-400',
  yellow: 'bg-amber-500/15 text-amber-400',
  blue: 'bg-blue-500/15 text-blue-400',
  indigo: 'bg-indigo-500/15 text-indigo-300',
  orange: 'bg-orange-500/15 text-orange-400',
}
export function Badge({ color = 'gray', className, children }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', BADGE[color], className)}>{children}</span>
}

export function Field({ label, hint, children, right }) {
  return (
    <label className="block">
      {(label || right) && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">{label}</span>
          {right}
        </div>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </label>
  )
}

const INPUT = 'w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
export const Input = ({ className, ...p }) => <input className={cx(INPUT, className)} {...p} />
export const Textarea = ({ className, ...p }) => <textarea className={cx(INPUT, 'resize-y', className)} {...p} />
export const Select = ({ className, children, ...p }) => (
  <select className={cx(INPUT, 'appearance-none', className)} {...p}>{children}</select>
)

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 select-none">
      <button type="button" onClick={() => onChange(!checked)}
        className={cx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-indigo-600' : 'bg-slate-700')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {label && <span className="text-sm text-slate-300">{label}</span>}
    </label>
  )
}

export function Stat({ label, value, icon: Icon, color = 'indigo' }) {
  const ring = { indigo: 'text-indigo-400 bg-indigo-500/10', green: 'text-emerald-400 bg-emerald-500/10', blue: 'text-blue-400 bg-blue-500/10', orange: 'text-orange-400 bg-orange-500/10', red: 'text-red-400 bg-red-500/10', gray: 'text-slate-400 bg-slate-500/10' }[color]
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{value}</div>
        </div>
        {Icon && <div className={cx('grid h-10 w-10 place-items-center rounded-lg', ring)}><Icon size={20} /></div>}
      </div>
    </Card>
  )
}

export function Spinner({ className }) {
  return <span className={cx('inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />
}

export function Loading({ children = 'Đang tải…' }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
      <Spinner className="text-slate-400" /> {children}
    </div>
  )
}

export function Empty({ icon: Icon, children }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-12 text-center text-slate-500">
      {Icon && <Icon size={32} className="opacity-40" />}
      <div className="text-sm">{children}</div>
    </div>
  )
}
