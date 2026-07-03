import { Logo, Card, LinkBtn } from '@/components/ui'
import { Download, ExternalLink, Rocket, ArrowLeft, CheckCircle2 } from 'lucide-react'

export const metadata = {
  title: 'Hướng dẫn cài đặt Extension',
  description: 'Cài đặt extension ToolMKT AI từ cửa hàng Chrome Web Store chính thức chỉ với 1 cú click.',
  alternates: { canonical: '/cai-dat' },
}

const STEPS = [
  { Icon: Download, t: 'Truy cập Chrome Web Store', d: <>Bấm nút <b>Cài đặt từ Chrome Store</b> bên dưới để mở trang tiện ích chính thức của ToolMKT AI trên Google Chrome Web Store.</> },
  { Icon: CheckCircle2, t: 'Thêm vào Chrome', d: <>Bấm nút <b>Add to Chrome</b> (Thêm vào Chrome) và xác nhận <b>Add extension</b> (Thêm tiện ích).</> },
  { Icon: Rocket, t: 'Xong — mở công cụ', d: <>Icon ToolMKT AI sẽ xuất hiện trên thanh công cụ của Chrome. Bạn chỉ cần ghim icon ra ngoài, bấm vào để mở cửa sổ công cụ và đăng nhập là có thể sử dụng ngay.</> },
]

export default function CaiDatPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-900/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo />
          <LinkBtn href="/" variant="ghost"><ArrowLeft size={15} /> Trang chủ</LinkBtn>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-50 sm:text-4xl">Cài đặt Extension trên Chrome</h1>
          <p className="mt-3 text-slate-400">Chỉ mất 5 giây — cài đặt trực tiếp từ Chrome Web Store an toàn và nhanh chóng.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="https://chromewebstore.google.com/detail/mocolnncfiogaiiijfkjnoggmeplbfel" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-orange-600/20 hover:from-orange-400 hover:to-red-500">
              <Download size={18} /> Cài đặt từ Chrome Store
            </a>
            <LinkBtn href="/app" variant="default" className="px-6 py-3 text-base">Mở công cụ</LinkBtn>
          </div>
        </div>

        <ol className="mt-12 space-y-4">
          {STEPS.map((s, i) => (
            <Card key={i} className="flex items-start gap-4 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400"><s.Icon size={20} /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">{i + 1}</span>
                  <span className="font-semibold text-slate-100">{s.t}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.d}</p>
              </div>
            </Card>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
          <p className="text-slate-300">Bạn gặp khó khăn khi cài đặt?</p>
          <a href="https://zalo.me/g/fsjwncgaupa915h891zx" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
            💬 Vào nhóm hỗ trợ Zalo <ExternalLink size={14} />
          </a>
        </div>
      </main>
    </div>
  )
}
