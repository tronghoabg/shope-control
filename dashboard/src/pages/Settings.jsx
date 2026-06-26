import { useState, useEffect } from 'react'
import { IconExternalLink, IconTestPipe, IconDeviceFloppy, IconKey } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { ext } from '../ext.js'
import { Section, Btn, Field, Input, Select, Badge } from '../ui.jsx'

const PROV = {
  anthropic: {
    name: 'Claude (Anthropic)', keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { v: 'claude-haiku-4-5-20251001', l: 'Haiku 4.5 — rẻ & nhanh (khuyên dùng)' },
      { v: 'claude-sonnet-4-6', l: 'Sonnet 4.6 — mạnh hơn' },
      { v: 'claude-opus-4-8', l: 'Opus 4.8 — mạnh nhất (đắt)' },
    ],
  },
  openai: {
    name: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { v: 'gpt-4o-mini', l: 'GPT-4o mini — rẻ & nhanh (khuyên dùng)' },
      { v: 'gpt-4o', l: 'GPT-4o' },
      { v: 'gpt-4.1-mini', l: 'GPT-4.1 mini' },
      { v: 'gpt-4.1', l: 'GPT-4.1' },
    ],
  },
  gemini: {
    name: 'Gemini (Google)', keyUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      { v: 'gemini-2.0-flash', l: 'Gemini 2.0 Flash — rẻ & nhanh (khuyên dùng)' },
      { v: 'gemini-2.5-flash', l: 'Gemini 2.5 Flash' },
      { v: 'gemini-1.5-flash', l: 'Gemini 1.5 Flash' },
      { v: 'gemini-1.5-pro', l: 'Gemini 1.5 Pro' },
    ],
  },
}

export default function Settings() {
  const { s, setCfg, hasKey, notify } = useShope()
  const [cfg, setLocal] = useState(null)
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState(null)

  useEffect(() => { if (s?.cfg && !cfg) setLocal(s.cfg) }, [s, cfg])
  if (!cfg) return <p className="text-slate-500">Đang tải…</p>

  const provider = cfg.provider || 'anthropic'
  const p = PROV[provider]
  const apiKey = (cfg.apiKeys || {})[provider] || ''
  const model = (cfg.models || {})[provider] || p.models[0].v

  const setKey = (v) => setLocal({ ...cfg, apiKeys: { ...(cfg.apiKeys || {}), [provider]: v } })
  const setModel = (v) => setLocal({ ...cfg, models: { ...(cfg.models || {}), [provider]: v } })
  const save = () => setCfg({ provider, apiKeys: cfg.apiKeys, models: cfg.models, tone: cfg.tone })

  const test = async () => {
    setTesting(true); setTestRes(null)
    const r = await ext({ type: 'TEST_AI', cfg: { provider, apiKeys: { [provider]: apiKey }, models: { [provider]: model } } }, 30000)
    setTesting(false)
    if (r?.ok) { setTestRes({ ok: true, text: `${r.reply} · ${r.ms}ms` }); notify('green', 'API hoạt động ✅') }
    else { setTestRes({ ok: false, text: r?.error || 'lỗi' }); notify('red', r?.error || 'Test thất bại') }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Cài đặt API</h1>

      {!hasKey && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300">
          <IconKey size={20} />
          <div className="text-sm">Chưa có API key — <b>bắt buộc nhập &amp; test</b> để mở khoá các tính năng.</div>
        </div>
      )}

      <Section title="Nhà cung cấp AI">
        <div className="space-y-4">
          <Field label="Provider">
            <Select value={provider} onChange={(e) => { setLocal({ ...cfg, provider: e.target.value }); setTestRes(null) }}>
              {Object.entries(PROV).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </Select>
          </Field>

          <Field label="API key" right={
            <a href={p.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline">
              <IconExternalLink size={13} /> Lấy API key
            </a>
          }>
            <div className="flex gap-2">
              <Input type="password" placeholder="dán API key…" value={apiKey} onChange={(e) => setKey(e.target.value)} />
              <Btn variant="default" icon={IconTestPipe} loading={testing} onClick={test} className="shrink-0">Test</Btn>
            </div>
            {testRes && <span className="mt-1.5 inline-block"><Badge color={testRes.ok ? 'green' : 'red'}>{testRes.text}</Badge></span>}
          </Field>

          <Field label="Model">
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              {p.models.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </Select>
          </Field>

          <Field label="Giọng văn comment">
            <Input value={cfg.tone || ''} onChange={(e) => setLocal({ ...cfg, tone: e.target.value })} placeholder="tự nhiên, thân thiện" />
          </Field>

          <div className="flex justify-end">
            <Btn variant="primary" icon={IconDeviceFloppy} onClick={save}>Lưu cài đặt</Btn>
          </div>
        </div>
      </Section>

      <p className="text-xs text-slate-500">API key lưu cục bộ trong extension (chrome.storage), không gửi lên server nào. Extension gọi thẳng nhà cung cấp AI.</p>
    </div>
  )
}
