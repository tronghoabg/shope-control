import { LinkBtn, Logo, Card, fmtVnd } from '@/components/ui'
import { PLANS, PAID_PLANS } from '@/lib/plans'
import { auth } from '@/lib/auth'
import {
  Search, Target, MessagesSquare, Send, Bookmark, ShieldCheck, Sparkles, Lock, Zap,
  Download, ArrowRight, Check, ChevronRight,
} from 'lucide-react'

const FEATURES = [
  { Icon: Search, t: 'Tìm nhóm tiềm năng', d: 'AI chấm điểm nhóm đã tham gia theo ngành hàng & gợi ý từ khoá tìm nhóm mới — tham gia hàng loạt 1 chạm.' },
  { Icon: Target, t: 'Lọc bài đúng nhu cầu', d: 'AI đọc feed từng nhóm, chỉ chọn bài đang hỏi / cần mua sản phẩm để tiếp cận đúng khách.' },
  { Icon: MessagesSquare, t: 'Comment dạo & Rải link', d: 'AI soạn comment tự nhiên như người thật; chế độ Rải link tự tìm SP Shopee + tạo link hoa hồng.' },
  { Icon: Send, t: 'Đăng bài hàng loạt', d: 'Đăng vào nhiều nhóm cùng lúc: ảnh, màu nền, AI viết lại mỗi nhóm, spintax chống trùng lặp.' },
  { Icon: Bookmark, t: 'Lưu & tái dùng', d: 'Lưu danh sách nhóm mục tiêu và bài viết mẫu — chọn lại cả cụm chỉ với một cú nhấp.' },
  { Icon: ShieldCheck, t: 'An toàn tài khoản', d: 'Chạy ngay trong tab Facebook thật của bạn — máy chủ không bao giờ đụng vào tài khoản.' },
]

const VALUES = [
  { Icon: Sparkles, t: 'AI tích hợp sẵn', d: 'Claude · OpenAI · Gemini do hệ thống cung cấp — khỏi mua, khỏi cấu hình API key.' },
  { Icon: Lock, t: 'Không lộ tài khoản', d: 'Mọi thao tác chạy trong trình duyệt của bạn. Máy chủ không bao giờ truy cập Facebook.' },
  { Icon: Zap, t: 'Cài trong 2 phút', d: 'Tải extension, đăng nhập, mở app — tự liên kết và bắt đầu chạy ngay.' },
]

const STEPS = [
  { n: '01', t: 'Tìm nhóm tiềm năng', d: 'AI quét nhóm đã tham gia, chấm điểm nhóm hợp bán hàng; hoặc tìm & tham gia nhóm mới theo ngành hàng.' },
  { n: '02', t: 'Tìm bài & soạn nội dung', d: 'AI đọc bài trong nhóm mục tiêu, lọc bài đúng nhu cầu và soạn sẵn comment (kèm link nếu rải link).' },
  { n: '03', t: 'Chọn & đăng hàng loạt', d: 'Tick chọn bài → rải link/đăng theo giãn cách an toàn. Hoặc bật Auto để tự chạy.' },
]

const FAQS = [
  { q: 'Tôi có cần mua API key AI không?', a: 'Không. AI đã tích hợp sẵn theo gói — chỉ cần đăng nhập tài khoản là dùng được. Nếu muốn, bạn vẫn có thể dùng API key riêng.' },
  { q: 'Dùng tool có bị khoá Facebook không?', a: 'Tool chạy ngay trong tab Facebook thật của bạn (không qua máy chủ trung gian), có giãn cách ngẫu nhiên, giới hạn/ngày và duyệt tay để hạn chế rủi ro. Bạn nên dùng điều độ.' },
  { q: 'Cài đặt có khó không?', a: 'Khoảng 2 phút: tải extension, Load unpacked trên Chrome, đăng nhập rồi mở app — phần liên kết tài khoản diễn ra tự động.' },
  { q: 'Gói miễn phí dùng được gì?', a: `Miễn phí ${PLANS.free.dailyActions} comment + bài đăng mỗi ngày, đủ để trải nghiệm toàn bộ tính năng. Nâng cấp khi cần chạy nhiều hơn.` },
]

export default async function Home() {
  const session = await auth()
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-900/80 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-3">
            <a href="#tinh-nang" className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white md:block">Tính năng</a>
            <a href="#pricing" className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white md:block">Bảng giá</a>
            <a href="/cai-dat" className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white md:block">Cài đặt</a>
            <a href="#faq" className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white md:block">FAQ</a>
            <LinkBtn href="/app" variant="default">Mở App</LinkBtn>
            {session ? <LinkBtn href="/dashboard" variant="primary">Dashboard</LinkBtn>
              : <><LinkBtn href="/login" variant="ghost">Đăng nhập</LinkBtn><LinkBtn href="/register" variant="brand">Dùng thử</LinkBtn></>}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-[-6rem] -z-10 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-600/25 to-indigo-600/25 blur-3xl" />
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-300">
            <Sparkles size={13} className="text-orange-400" /> AI tích hợp sẵn — không cần API key
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-50 sm:text-6xl">
            Tìm khách &amp; bán hàng Facebook<br /><span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">tự động bằng AI</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            AI tự tìm nhóm tiềm năng, đọc bài tìm khách đang có nhu cầu, soạn comment kèm link Shopee và đăng bài hàng loạt.
            Bạn chỉ việc chọn &amp; bấm — chạy ngay trong trình duyệt, an toàn tài khoản.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a download href="/extension.zip"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-orange-600/20 transition-colors hover:from-orange-400 hover:to-red-500">
              <Download size={18} /> Tải Extension (Chrome)
            </a>
            <LinkBtn href="/app" variant="default" className="px-6 py-3 text-base">Mở công cụ <ArrowRight size={16} /></LinkBtn>
          </div>
          <a href="/cai-dat" className="mt-3 inline-block text-sm text-indigo-400 hover:underline">Xem hướng dẫn cài đặt chi tiết →</a>
          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-500">
            {[`Miễn phí ${PLANS.free.dailyActions} comment+bài/ngày`, 'Không cần thẻ', 'Không cần API key'].map(t => (
              <span key={t} className="inline-flex items-center gap-1"><Check size={13} className="text-emerald-400" /> {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Value strip */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:grid-cols-3">
          {VALUES.map(v => (
            <div key={v.t} className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-400"><v.Icon size={20} /></div>
              <div>
                <div className="font-semibold text-slate-100">{v.t}</div>
                <p className="mt-0.5 text-sm text-slate-400">{v.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="tinh-nang" className="mx-auto max-w-6xl px-6 pb-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-100">Một công cụ — trọn quy trình</h2>
          <p className="mt-2 text-slate-400">Từ tìm nhóm, lọc bài, soạn nội dung tới đăng hàng loạt.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <Card key={f.t} className="p-6 transition-colors hover:border-slate-700">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-orange-500/20 to-indigo-500/20 text-orange-300"><f.Icon size={22} /></div>
              <div className="mt-4 font-semibold text-slate-100">{f.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="quy-trinh" className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold text-slate-100">Luồng làm việc 3 bước</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(s => (
            <Card key={s.n} className="relative p-6">
              <div className="text-3xl font-extrabold text-indigo-400/90">{s.n}</div>
              <div className="mt-2 font-semibold text-slate-100">{s.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.d}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <a download href="/extension.zip" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700"><Download size={16} /> Tải Extension</a>
          <LinkBtn href="/cai-dat" variant="primary">Hướng dẫn chi tiết <ArrowRight size={16} /></LinkBtn>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold text-slate-100">Bảng giá đơn giản</h2>
        <p className="mt-2 text-center text-slate-400">Bắt đầu miễn phí. Nâng cấp theo số comment + bài đăng mỗi ngày.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <PriceCard plan={PLANS.free} />
          {PAID_PLANS.map(id => <PriceCard key={id} plan={PLANS[id]} />)}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Mọi gói đều dùng AI hệ thống — không phải mua API key riêng.</p>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold text-slate-100">Câu hỏi thường gặp</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map(f => (
            <details key={f.q} className="group rounded-xl border border-slate-800 bg-slate-900/50 p-4 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between font-medium text-slate-100 marker:content-['']">
                {f.q} <ChevronRight size={18} className="shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/40 px-6 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-orange-600/10 to-indigo-600/10" />
          <h2 className="text-3xl font-bold text-slate-50">Bắt đầu tìm khách hôm nay</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Cài extension, đăng nhập và để AI lo phần tìm nhóm, soạn nội dung và đăng bài.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkBtn href="/register" variant="brand" className="px-6 py-3 text-base">Dùng thử miễn phí</LinkBtn>
            <a download href="/extension.zip" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-base font-semibold text-slate-100 hover:bg-slate-700"><Download size={18} /> Tải Extension</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-slate-600 sm:flex-row">
          <Logo size={7} />
          <p>© ToolMKT AI · Bạn tự chịu trách nhiệm tuân thủ điều khoản của Facebook &amp; Shopee.</p>
          <a href="/privacy" className="text-slate-400 hover:text-white hover:underline">Chính sách quyền riêng tư</a>
        </div>
      </footer>
    </div>
  )
}

function PriceCard({ plan }: { plan: typeof PLANS[keyof typeof PLANS] }) {
  const pro = plan.id !== 'free'
  return (
    <Card className={plan.highlight ? 'relative p-6 ring-2 ring-orange-500' : 'p-6'}>
      {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-0.5 text-xs font-bold text-white">Phổ biến</span>}
      <div className="font-semibold text-slate-100">{plan.name}</div>
      <div className="mt-3 text-3xl font-extrabold text-slate-50">{plan.price === 0 ? 'Miễn phí' : fmtVnd(plan.price)}</div>
      <div className="text-xs text-slate-500">{pro ? `mỗi tháng · ${plan.desc}` : 'mãi mãi'}</div>
      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        {[
          <><b className="text-slate-100">{plan.dailyActions}</b> comment + bài đăng / ngày</>,
          'Tìm & chấm điểm nhóm bằng AI',
          'Comment dạo · Rải link Shopee',
          'Đăng bài hàng loạt (ảnh/nền/AI)',
          ...(pro ? ['Hỗ trợ ưu tiên'] : []),
        ].map((li, i) => (
          <li key={i} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /><span>{li}</span></li>
        ))}
      </ul>
      <LinkBtn href="/register" variant={plan.highlight ? 'brand' : 'default'} className="mt-6 w-full">
        {pro ? 'Nâng cấp' : 'Dùng miễn phí'}
      </LinkBtn>
    </Card>
  )
}
