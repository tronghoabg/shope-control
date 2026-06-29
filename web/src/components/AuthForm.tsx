'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from './ui'

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const isLogin = mode === 'login'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      if (!isLogin) {
        const r = await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, name }) })
        const j = await r.json()
        if (!r.ok) { setErr(j.error || 'Đăng ký thất bại'); setBusy(false); return }
      }
      const res = await signIn('credentials', { email, password, redirect: false })
      if (res?.error) { setErr('Sai email hoặc mật khẩu'); setBusy(false); return }
      router.push('/dashboard'); router.refresh()
    } catch { setErr('Có lỗi xảy ra'); setBusy(false) }
  }

  const input = 'w-full rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h1 className="text-lg font-bold text-slate-100">{isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
          <p className="mt-1 text-sm text-slate-500">{isLogin ? 'Chào mừng trở lại 👋' : 'Miễn phí 10 comment/ngày'}</p>

          <button onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700">
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4 5.5l6.3 5.3C41.9 35.5 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
            Tiếp tục với Google
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-600"><div className="h-px flex-1 bg-slate-800" />hoặc<div className="h-px flex-1 bg-slate-800" /></div>

          <form onSubmit={submit} className="space-y-3">
            {!isLogin && <input className={input} placeholder="Tên hiển thị (tuỳ chọn)" value={name} onChange={e => setName(e.target.value)} />}
            <input className={input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input className={input} type="password" placeholder="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)} required />
            {err && <p className="text-sm text-red-400">{err}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-orange-400 hover:to-red-500 disabled:opacity-50">
              {busy ? 'Đang xử lý…' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            {isLogin ? <>Chưa có tài khoản? <Link href="/register" className="text-indigo-400 hover:underline">Đăng ký</Link></>
              : <>Đã có tài khoản? <Link href="/login" className="text-indigo-400 hover:underline">Đăng nhập</Link></>}
          </p>
        </div>
      </div>
    </div>
  )
}
