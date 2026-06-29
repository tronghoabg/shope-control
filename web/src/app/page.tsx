import { LinkBtn, Logo, Card, Badge, fmtVnd } from '@/components/ui'
import { PLANS, PAID_PLANS } from '@/lib/plans'
import { auth } from '@/lib/auth'

const FEATURES = [
  { icon: '🔎', t: 'Tìm nhóm theo niche', d: 'AI gợi ý từ khoá + chấm điểm nhóm hợp sản phẩm, tham gia hàng loạt.' },
  { icon: '🎯', t: 'Lọc bài tiềm năng', d: 'AI đọc feed nhóm, chỉ chọn bài đang cần mua / hỏi sản phẩm.' },
  { icon: '🤖', t: 'AI soạn comment + link', d: 'Câu chữ tự nhiên như người thật, chèn link Shopee hoa hồng.' },
  { icon: '🛡️', t: 'An toàn tài khoản', d: 'Giới hạn/ngày, delay, duyệt tay, chống trùng — hạn chế checkpoint.' },
]

export default async function Home() {
  const session = await auth()
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3">
          <a href="#cai-dat" className="hidden text-sm text-slate-300 hover:text-white md:block">Cài đặt</a>
          <a href="#pricing" className="hidden text-sm text-slate-300 hover:text-white md:block">Bảng giá</a>
          <LinkBtn href="/app" variant="default">Mở App</LinkBtn>
          {session ? <LinkBtn href="/dashboard" variant="primary">Dashboard</LinkBtn>
            : <><LinkBtn href="/login" variant="ghost">Đăng nhập</LinkBtn><LinkBtn href="/register" variant="brand">Đăng ký</LinkBtn></>}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-20 text-center">
        <div className="absolute left-1/2 top-0 -z-10 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-600/20 to-indigo-600/20 blur-3xl" />
        <Badge color="orange">⚡ Claude · OpenAI · Gemini</Badge>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-50 sm:text-6xl">
          Rải link Shopee <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">tự động bằng AI</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
          Tìm nhóm Facebook tiềm năng → AI đọc bài → tự soạn comment kèm link hoa hồng. Bạn chỉ việc duyệt &amp; đăng.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a download href="/extension.zip"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 text-base font-semibold text-white hover:from-orange-400 hover:to-red-500">
            ⬇ Tải Extension (Chrome)
          </a>
          <LinkBtn href="/app" variant="default" className="px-6 py-3 text-base">Mở công cụ →</LinkBtn>
        </div>
        <p className="mt-3 text-xs text-slate-500">Miễn phí 10 comment/ngày · không cần thẻ</p>
      </section>

      {/* Cài đặt nhanh */}
      <section id="cai-dat" className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold text-slate-100">Cài đặt trong 4 bước</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: 1, t: 'Tải & cài extension', d: <>Bấm <b>Tải Extension</b> → giải nén. Vào <code className="rounded bg-slate-800 px-1 text-slate-300">chrome://extensions</code> → bật <b>Developer mode</b> → <b>Load unpacked</b> → chọn thư mục <code className="rounded bg-slate-800 px-1 text-slate-300">extension</code>.</> },
            { n: 2, t: 'Đăng nhập lấy token', d: <>Đăng ký/đăng nhập → vào <b>Dashboard</b> → <b>copy API token</b>.</> },
            { n: 3, t: 'Mở công cụ & liên kết', d: <>Bấm icon extension (hoặc <b>Mở App</b>) → <b>Cài đặt → Tài khoản</b> dán token + <b>API key AI</b>.</> },
            { n: 4, t: 'Tìm nhóm & chạy', d: <>Khám phá nhóm → chọn mục tiêu → quét bài → duyệt &amp; đăng. Xong!</> },
          ].map(s => (
            <Card key={s.n} className="p-5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white">{s.n}</div>
              <div className="mt-3 font-semibold text-slate-100">{s.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.d}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <a download href="/extension.zip" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 border border-slate-700">⬇ Tải Extension</a>
          <LinkBtn href="/app" variant="primary">Mở công cụ →</LinkBtn>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(f => (
          <Card key={f.t} className="p-5">
            <div className="text-3xl">{f.icon}</div>
            <div className="mt-3 font-semibold text-slate-100">{f.t}</div>
            <p className="mt-1 text-sm text-slate-400">{f.d}</p>
          </Card>
        ))}
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-center text-3xl font-bold text-slate-100">Bảng giá</h2>
        <p className="mt-2 text-center text-slate-400">Bắt đầu miễn phí, nâng cấp khi cần chạy nhiều.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <PriceCard plan={PLANS.free} />
          {PAID_PLANS.map(id => <PriceCard key={id} plan={PLANS[id]} />)}
        </div>
      </section>

      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-600">
        ToolMKT AI · Dùng cho mục đích cá nhân · Bạn tự chịu trách nhiệm tuân thủ điều khoản Facebook &amp; Shopee.
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
      <div className="text-xs text-slate-500">{pro ? `cho ${plan.days} ngày` : 'mãi mãi'}</div>
      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        <li>✓ {plan.dailyComments === Infinity ? 'Comment không giới hạn' : `${plan.dailyComments} comment/ngày`}</li>
        <li>✓ Tìm &amp; chấm điểm nhóm bằng AI</li>
        <li>✓ AI soạn comment + link Shopee</li>
        {pro && <li>✓ Hỗ trợ ưu tiên</li>}
      </ul>
      <LinkBtn href="/register" variant={plan.highlight ? 'brand' : 'default'} className="mt-6 w-full">
        {pro ? 'Nâng cấp' : 'Dùng miễn phí'}
      </LinkBtn>
    </Card>
  )
}
