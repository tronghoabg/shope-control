import { useState, useEffect } from 'react'
import { IconExternalLink, IconDeviceFloppy, IconSparkles, IconUserCircle, IconCrown, IconBolt, IconGauge, IconHistory, IconLock } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Field, Input, Badge, Hint } from '../ui.jsx'

export default function Settings() {
  const { s, setCfg, account } = useShope()
  const [cfg, setLocal] = useState(null)

  useEffect(() => { if (s?.cfg && !cfg) setLocal(s.cfg) }, [s, cfg])
  if (!cfg) return <p className="text-slate-500">Đang tải cấu hình cài đặt…</p>

  const save = () => setCfg({ tone: cfg.tone })

  return (
    <div className="max-w-3xl space-y-6 animate-fadeIn">
      <div className="border-b border-slate-900/65 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Cấu hình hệ thống</h1>
        <p className="text-sm text-slate-400">Thiết lập tham số AI, giọng văn bình luận và xem thông tin phân bổ hạn mức.</p>
      </div>

      <Hint id="settings">
        Hệ thống tự động sử dụng dịch vụ AI tích hợp sẵn đi kèm theo gói của bạn, không cần cài đặt API key phức tạp.
      </Hint>

      <div className="flex items-center gap-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-5 text-indigo-200">
        <IconSparkles size={22} className="text-indigo-400 shrink-0" />
        <div className="text-xs leading-relaxed">
          {account?.loggedIn
            ? <>Đang sử dụng dịch vụ <b>AI Hệ Thống cao cấp</b>. Hạn mức sẽ tự động được gia hạn và áp dụng hàng ngày theo gói tài khoản của bạn.</>
            : <>Bạn chưa đăng nhập. Vui lòng <b>Đăng nhập tài khoản</b> ở góc dưới bên trái để kích hoạt AI Hệ Thống và nâng cấp hạn mức rải bài.</>}
        </div>
      </div>

      <Section title="Cấu hình giọng điệu AI">
        <div className="space-y-4">
          <Field label="Giọng điệu văn phong viết comment" hint="Hướng dẫn AI sử dụng phong cách viết phù hợp (Ví dụ: tự nhiên, thân thiện, trẻ trung, hài hước, tư vấn lịch sự...)">
            <Input value={cfg.tone || ''} onChange={(e) => setLocal({ ...cfg, tone: e.target.value })} placeholder="tự nhiên, thân thiện, sử dụng emoji nhẹ nhàng…" />
          </Field>
          <div className="flex justify-end pt-2">
            <Btn variant="primary" icon={IconDeviceFloppy} onClick={save}>Lưu thiết lập</Btn>
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
    <Section title="Tài khoản & Hạn mức rải bài">
      {a === null ? (
        <p className="text-xs text-slate-500 font-semibold animate-pulse">Đang truy vấn thông tin tài khoản từ máy chủ…</p>
      ) : !a.loggedIn ? (
        <div className="flex flex-wrap items-center justify-between gap-4 py-2">
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">Chưa liên kết tài khoản web. Đăng nhập để áp dụng gói dịch vụ cao cấp và mở rộng giới hạn rải bài hàng ngày.</p>
          <a href="/login" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-indigo-500 transition-colors">Đăng nhập ngay</a>
        </div>
      ) : (
        <div className="space-y-4 py-1">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge color={a.plan && a.plan !== 'free' ? 'green' : 'gray'} className="text-[10px] font-extrabold">{planName[a.plan] || 'Miễn phí'}</Badge>
            <span className="font-bold text-slate-200">{a.name || a.email}</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-400 font-medium">{a.remaining === -1 ? 'Không giới hạn bài đăng' : `Đã sử dụng ${a.usedToday ?? 0}/${a.dailyLimit ?? 5} hôm nay`}</span>
            {a.expiresAt && <span className="text-slate-500 font-medium">· Hết hạn: {new Date(a.expiresAt).toLocaleDateString('vi')}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-900 pt-4">
            <a href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-650 hover:from-orange-400 hover:to-red-500 px-4 py-2 text-xs font-extrabold uppercase text-white shadow-md transition-all">
              {a.plan && a.plan !== 'free' ? 'Quản lý gói cước' : 'Nâng cấp lên PRO'} <IconExternalLink size={13} />
            </a>
            <span className="text-xs text-slate-500">Tài khoản web đã tự động liên kết thành công với Extension qua mã bảo mật.</span>
          </div>
        </div>
      )}
    </Section>
  )
}
