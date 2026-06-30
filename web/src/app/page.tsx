import { LinkBtn, Logo, Card, Badge, fmtVnd } from '@/components/ui'
import { PLANS, PAID_PLANS } from '@/lib/plans'
import { auth } from '@/lib/auth'

const FEATURES = [
  { icon: '🔎', t: 'Tìm nhóm tiềm năng', d: 'AI chấm điểm nhóm đã tham gia theo niche & gợi ý từ khoá tìm nhóm mới — tham gia hàng loạt 1 chạm.' },
  { icon: '🎯', t: 'Lọc bài đúng nhu cầu', d: 'AI đọc feed từng nhóm, chỉ chọn bài đang hỏi / cần mua sản phẩm để comment.' },
  { icon: '💬', t: 'Comment dạo & Rải link', d: 'AI soạn comment tự nhiên như người thật; chế độ Rải link tự tìm SP Shopee + tạo link hoa hồng.' },
  { icon: '📤', t: 'Đăng bài hàng loạt', d: 'Đăng vào nhiều nhóm cùng lúc: ảnh, màu nền, AI viết lại mỗi nhóm, spintax chống trùng lặp.' },
  { icon: '💾', t: 'Lưu & tái dùng', d: 'Lưu danh sách nhóm mục tiêu và bài viết mẫu — chọn lại cả cụm chỉ với 1 cú nhấp.' },
  { icon: '🛡️', t: 'An toàn checkpoint', d: 'Chạy ngay trong tab Facebook thật của bạn — máy chủ không bao giờ đụng vào tài khoản. Giãn cách ngẫu nhiên, duyệt tay.' },
]

const STEPS = [
  { n: 1, t: 'Tải & cài extension', d: <>Bấm <b>Tải Extension</b> → giải nén. Vào <code className="rounded bg-slate-800 px-1 text-slate-300">chrome://extensions</code> → bật <b>Developer mode</b> → <b>Load unpacked</b> → chọn thư mục <code className="rounded bg-slate-800 px-1 text-slate-300">extension</code>.</> },
  { n: 2, t: 'Đăng ký / Đăng nhập', d: <>Tạo tài khoản (email hoặc Google). Gói <b>Miễn phí</b> dùng được ngay, <b>không cần thẻ</b>.</> },
  { n: 3, t: 'Mở App — tự liên kết', d: <>Bấm icon extension (mở cửa sổ công cụ) → tự liên kết tài khoản, <b>không cần dán token</b>. AI đã sẵn — <b>không cần nhập API key</b>.</> },
  { n: 4, t: 'Chọn nhóm & chạy', d: <>Tìm nhóm → chọn mục tiêu → <b>Tìm bài tiềm năng</b> → tick chọn → <b>Rải link / Đăng</b>. Xong!</> },
]

export default async function Home() {
  const session = await auth()
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-900/80 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-3">
            <a href="#tinh-nang" className="hidden text-sm text-slate-300 hover:text-white md:block">Tính năng</a>
            <a href="#cai-dat" className="hidden text-sm text-slate-300 hover:text-white md:block">Cài đặt</a>
            <a href="#pricing" className="hidden text-sm text-slate-300 hover:text-white md:block">Bảng giá</a>
            <LinkBtn href="/app" variant="default">Mở App</LinkBtn>
            {session ? <LinkBtn href="/dashboard" variant="primary">Dashboard</LinkBtn>
              : <><LinkBtn href="/login" variant="ghost">Đăng nhập</LinkBtn><LinkBtn href="/register" variant="brand">Dùng thử</LinkBtn></>}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <div className="absolute left-1/2 top-0 -z-10 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-600/20 to-indigo-600/20 blur-3xl" />
        <Badge color="orange">⚡ AI sẵn trong hệ thống — không cần API key</Badge>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-50 sm:text-6xl">
          Bán hàng Facebook <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">tự động bằng AI</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
          AI tự tìm nhóm tiềm năng, đọc bài, soạn comment kèm link Shopee hoa hồng và đăng bài hàng loạt.
          Bạn chỉ việc chọn &amp; bấm — chạy ngay trong trình duyệt, an toàn tài khoản.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a download href="/extension.zip"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-orange-600/20 hover:from-orange-400 hover:to-red-500">
            ⬇ Tải Extension (Chrome)
          </a>
          <LinkBtn href="/app" variant="default" className="px-6 py-3 text-base">Mở công cụ →</LinkBtn>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <span>✓ Miễn phí {PLANS.free.dailyActions} comment+bài/ngày</span>
          <span>✓ Không cần thẻ</span>
          <span>✓ Không cần API key</span>
        </div>
      </section>

      {/* Value strip */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:grid-cols-3">
          {[
            { t: 'AI tích hợp sẵn', d: 'Claude · OpenAI · Gemini do hệ thống cung cấp — khỏi mua, khỏi cấu hình.' },
            { t: 'Không lộ tài khoản', d: 'Mọi thao tác chạy trong tab Facebook thật của bạn. Máy chủ không bao giờ đụng FB.' },
            { t: 'Cài trong 2 phút', d: 'Tải extension, đăng nhập, mở app — tự liên kết, bắt đầu chạy ngay.' },
          ].map(v => (
            <div key={v.t}>
              <div className="font-semibold text-slate-100">{v.t}</div>
              <p className="mt-1 text-sm text-slate-400">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="tinh-nang" className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold text-slate-100">Mọi thứ để rải link &amp; nuôi nhóm</h2>
        <p className="mt-2 text-center text-slate-400">Một công cụ — từ tìm nhóm, lọc bài, soạn nội dung tới đăng hàng loạt.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <Card key={f.t} className="p-5 transition-colors hover:border-slate-700">
              <div className="text-3xl">{f.icon}</div>
              <div className="mt-3 font-semibold text-slate-100">{f.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold text-slate-100">Luồng làm việc 3 bước</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { n: '01', t: 'Tìm nhóm tiềm năng', d: 'AI quét nhóm đã tham gia, chấm điểm nhóm hợp bán hàng; hoặc tìm & tham gia nhóm mới theo niche.' },
            { n: '02', t: 'Tìm bài & soạn nội dung', d: 'AI đọc bài trong nhóm mục tiêu, lọc bài đúng nhu cầu và soạn sẵn comment (kèm link nếu rải link).' },
            { n: '03', t: 'Chọn & đăng hàng loạt', d: 'Tick chọn bài → rải link/đăng theo giãn cách an toàn. Hoặc bật Auto để tự chạy.' },
          ].map(s => (
            <Card key={s.n} className="p-6">
              <div className="text-2xl font-extrabold text-indigo-400">{s.n}</div>
              <div className="mt-2 font-semibold text-slate-100">{s.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Cài đặt */}
      <section id="cai-dat" className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold text-slate-100">Cài đặt trong 4 bước</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(s => (
            <Card key={s.n} className="p-5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white">{s.n}</div>
              <div className="mt-3 font-semibold text-slate-100">{s.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.d}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <a download href="/extension.zip" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700">⬇ Tải Extension</a>
          <LinkBtn href="/app" variant="primary">Mở công cụ →</LinkBtn>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-center text-3xl font-bold text-slate-100">Bảng giá</h2>
        <p className="mt-2 text-center text-slate-400">Bắt đầu miễn phí. Nâng cấp theo nhu cầu — giới hạn theo số comment+bài/ngày.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <PriceCard plan={PLANS.free} />
          {PAID_PLANS.map(id => <PriceCard key={id} plan={PLANS[id]} />)}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Mọi gói đều dùng AI hệ thống — không phải mua API key riêng.</p>
      </section>

      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-600">
        ToolMKT AI · Bạn tự chịu trách nhiệm tuân thủ điều khoản của Facebook &amp; Shopee.
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
        <li>✓ <b className="text-slate-100">{plan.dailyActions}</b> comment + bài đăng / ngày</li>
        <li>✓ Tìm &amp; chấm điểm nhóm bằng AI</li>
        <li>✓ Comment dạo · Rải link Shopee</li>
        <li>✓ Đăng bài hàng loạt (ảnh/nền/AI)</li>
        {pro && <li>✓ Hỗ trợ ưu tiên</li>}
      </ul>
      <LinkBtn href="/register" variant={plan.highlight ? 'brand' : 'default'} className="mt-6 w-full">
        {pro ? 'Nâng cấp' : 'Dùng miễn phí'}
      </LinkBtn>
    </Card>
  )
}
