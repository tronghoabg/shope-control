import { useState, useEffect } from 'react'
import { IconExternalLink, IconDeviceFloppy, IconSparkles } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Field, Input, Badge, Hint } from '../ui.jsx'

export default function Settings() {
  const { s, setCfg, account } = useShope()
  const [cfg, setLocal] = useState(null)

  useEffect(() => { if (s?.cfg && !cfg) setLocal(s.cfg) }, [s, cfg])
  if (!cfg) return <p className="text-slate-500">Đang tải…</p>

  const save = () => setCfg({ tone: cfg.tone })

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Cài đặt</h1>

      <Hint id="settings">
        AI do <b>hệ thống cung cấp</b> — bạn không cần nhập API key. Chỉ cần <b>đăng nhập tài khoản</b> là dùng được
        (theo hạn mức gói: Miễn phí 5 comment+bài/ngày · gói trả phí nhiều hơn). Bên dưới chỉ cần chỉnh <b>giọng văn</b> cho hợp thương hiệu.
      </Hint>

      <div className="flex items-center gap-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-4 text-indigo-200">
        <IconSparkles size={20} />
        <div className="text-sm">{account?.loggedIn
          ? <>Đang dùng <b>AI hệ thống</b> theo gói của bạn — không cần cấu hình gì thêm.</>
          : <>Hãy <b>đăng nhập tài khoản</b> (góc dưới trái) để kích hoạt AI hệ thống &amp; áp hạn mức gói.</>}</div>
      </div>

      <Section title="Tuỳ chỉnh nội dung">
        <div className="space-y-4">
          <Field label="Giọng văn comment" hint="Cách AI viết comment — vd: tự nhiên thân thiện, trẻ trung, lịch sự…">
            <Input value={cfg.tone || ''} onChange={(e) => setLocal({ ...cfg, tone: e.target.value })} placeholder="tự nhiên, thân thiện" />
          </Field>
          <div className="flex justify-end">
            <Btn variant="primary" icon={IconDeviceFloppy} onClick={save}>Lưu</Btn>
          </div>
        </div>
      </Section>

      <AccountSection />
    </div>
  )
}

function AccountSection() {
  const { account } = useShope()
  const a = account
  const planName = { free: 'Miễn phí', basic: 'Cơ bản', pro: 'Chuyên', business: 'Đại lý' }

  return (
    <Section title="Tài khoản & hạn mức">
      {a === null ? (
        <p className="text-sm text-slate-500">Đang kiểm tra tài khoản…</p>
      ) : !a.loggedIn ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">Chưa đăng nhập. Đăng nhập để kích hoạt AI &amp; áp gói (Miễn phí 5 comment+bài/ngày).</p>
          <a href="/login" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">Đăng nhập</a>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge color={a.plan && a.plan !== 'free' ? 'green' : 'gray'}>{planName[a.plan] || 'Miễn phí'}</Badge>
            <span className="text-slate-300">{a.name || a.email}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">{a.remaining === -1 ? 'Comment không giới hạn' : `Hôm nay ${a.usedToday ?? 0}/${a.dailyLimit ?? 5} comment`}</span>
            {a.expiresAt && <span className="text-xs text-slate-500">· hết hạn {new Date(a.expiresAt).toLocaleDateString('vi')}</span>}
          </div>
          <div className="flex items-center gap-2">
            <a href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-3 py-2 text-sm font-semibold text-white hover:from-orange-400 hover:to-red-500">
              {a.plan && a.plan !== 'free' ? 'Quản lý gói' : 'Nâng cấp Pro'} <IconExternalLink size={13} />
            </a>
            <span className="text-xs text-slate-500">Đã tự liên kết tài khoản — khỏi dán token.</span>
          </div>
        </div>
      )}
    </Section>
  )
}
