'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Badge } from './ui'

const PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', ph: 'AIza...', keyUrl: 'https://aistudio.google.com/app/apikey',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-pro'] },
  { id: 'anthropic', name: 'Anthropic Claude', ph: 'sk-ant-...', keyUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8'] },
  { id: 'openai', name: 'OpenAI', ph: 'sk-...', keyUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'] },
]

export function AiConfigCard() {
  const [st, setSt] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const load = async () => {
    const r = await fetch('/api/admin/ai-config', { credentials: 'include' })
    if (r.ok) setSt(await r.json())
  }
  useEffect(() => { load() }, [])

  const curSet = st?.keys?.[st?.provider]?.set
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <div className="text-sm font-semibold text-slate-100">AI hệ thống (managed)</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          {st ? <>
            <Badge color={curSet ? 'green' : 'red'}>{curSet ? 'Đã cấu hình' : 'Chưa có key'}</Badge>
            <span>{PROVIDERS.find(p => p.id === st.provider)?.name} · {st.model}</span>
            {curSet && <span className="text-slate-600">{st.keys[st.provider].hint}</span>}
          </> : 'Đang tải…'}
        </div>
      </div>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">Cấu hình API</button>
      {open && <AiConfigModal st={st} onClose={() => setOpen(false)} onSaved={load} />}
    </Card>
  )
}

function AiConfigModal({ st, onClose, onSaved }: { st: any; onClose: () => void; onSaved: () => void }) {
  const [provider, setProvider] = useState(st?.provider || 'gemini')
  const [model, setModel] = useState(st?.model || '')
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState('')
  const [test, setTest] = useState<any>(null)

  const cur = PROVIDERS.find(p => p.id === provider)!
  const onProvider = (id: string) => { setProvider(id); const p = PROVIDERS.find(x => x.id === id)!; setModel(p.models[0]); setTest(null) }

  const save = async () => {
    setSaving(true); setMsg('')
    const r = await fetch('/api/admin/ai-config', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider, model, keys: { [provider]: key } }),
    })
    setSaving(false)
    if (r.ok) { setKey(''); setMsg('Đã lưu ✓'); onSaved() } else setMsg('Lưu thất bại')
  }
  const runTest = async () => {
    setTesting(true); setTest(null)
    // lưu trước rồi mới test (test dùng cấu hình đã lưu)
    await fetch('/api/admin/ai-config', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider, model, keys: key ? { [provider]: key } : {} }) })
    if (key) setKey('')
    onSaved()
    const r = await fetch('/api/admin/ai-config/test', { method: 'POST', credentials: 'include' })
    const d = await r.json().catch(() => ({ ok: false, error: 'lỗi' }))
    setTesting(false); setTest(d)
  }

  const setHint = st?.keys?.[provider]?.set
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">Cấu hình AI hệ thống</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>
        <p className="text-xs text-slate-500">Key của bạn — dùng cho mọi user (theo hạn mức gói). Chọn model rẻ để tối ưu chi phí.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Provider</span>
            <select value={provider} onChange={e => onProvider(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Model</span>
            <select value={model} onChange={e => setModel(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
              {cur.models.map(m => <option key={m} value={m}>{m}</option>)}
              {model && !cur.models.includes(model) && <option value={model}>{model}</option>}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">API key {cur.name} {setHint && <span className="text-emerald-400">(đã lưu {st.keys[provider].hint})</span>}</span>
            <a href={cur.keyUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline">Lấy key ↗</a>
          </div>
          <input type="password" value={key} onChange={e => setKey(e.target.value)}
            placeholder={setHint ? 'Đã lưu — để trống nếu giữ nguyên' : cur.ph}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100" />
        </label>

        {test && <div className={`rounded-lg border px-3 py-2 text-sm ${test.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
          {test.ok ? `✓ OK · ${test.reply} · ${test.ms}ms · ${test.model}` : `✗ ${test.error}`}
        </div>}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button onClick={runTest} disabled={testing} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60">{testing ? 'Đang test…' : 'Test key'}</button>
          <div className="flex items-center gap-3">
            {msg && <span className="text-sm text-slate-400">{msg}</span>}
            <button onClick={save} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">{saving ? 'Đang lưu…' : 'Lưu'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const PLAN_OPTS = [
  { id: 'free', name: 'Miễn phí' }, { id: 'basic', name: 'Cơ bản' }, { id: 'pro', name: 'Chuyên' }, { id: 'business', name: 'Đại lý' },
]

export function UserActions({ userId, banned }: { userId: string; banned: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const act = async (action: string, plan?: string) => {
    setBusy(true)
    await fetch('/api/admin/user', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, action, plan }) })
    setBusy(false); router.refresh()
  }
  return (
    <div className="flex items-center gap-1.5">
      <select disabled={busy} defaultValue="" onChange={e => { if (e.target.value) act('setPlan', e.target.value) }}
        className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs text-slate-300">
        <option value="">Đổi gói…</option>
        {PLAN_OPTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button disabled={busy} onClick={() => act(banned ? 'unban' : 'ban')}
        className={`rounded px-2 py-1 text-xs font-medium ${banned ? 'bg-emerald-600/80 text-white' : 'bg-red-600/80 text-white'} disabled:opacity-50`}>
        {banned ? 'Mở khoá' : 'Chặn AI'}
      </button>
    </div>
  )
}
