import { Logo, Card, LinkBtn } from '@/components/ui'
import { Download, FolderOpen, Settings2, ToggleRight, FolderInput, Rocket, AlertTriangle, ArrowLeft, ExternalLink } from 'lucide-react'

export const metadata = { title: 'Hướng dẫn cài đặt Extension — ToolMKT AI' }

const STEPS = [
  { Icon: Download, t: 'Tải file extension', d: <>Bấm nút <b>Tải Extension</b> bên dưới để tải <code className="rounded bg-slate-800 px-1 text-slate-300">extension.zip</code> về máy.</> },
  { Icon: FolderOpen, t: 'Giải nén file zip', d: <>Chuột phải vào file vừa tải → <b>Extract All / Giải nén tất cả</b> → được <b>1 thư mục</b> (bên trong có file <code className="rounded bg-slate-800 px-1 text-slate-300">manifest.json</code>). Nhớ chỗ lưu thư mục này.</> },
  { Icon: Settings2, t: 'Mở trang tiện ích Chrome', d: <>Gõ vào thanh địa chỉ Chrome: <code className="rounded bg-slate-800 px-1 text-slate-300">chrome://extensions</code> rồi Enter.</> },
  { Icon: ToggleRight, t: 'Bật "Chế độ nhà phát triển"', d: <>Gạt công tắc <b>Developer mode / Chế độ dành cho nhà phát triển</b> ở góc <b>trên bên phải</b>.</> },
  { Icon: FolderInput, t: 'Tải tiện ích đã giải nén', d: <>Bấm <b>Load unpacked / Tải tiện ích đã giải nén</b> → chọn đúng <b>THƯ MỤC vừa giải nén</b> (thư mục chứa <code className="rounded bg-slate-800 px-1 text-slate-300">manifest.json</code>) → <b>Select Folder</b>.</> },
  { Icon: Rocket, t: 'Xong — mở công cụ', d: <>Icon ToolMKT AI hiện trên thanh Chrome. Bấm icon để mở cửa sổ công cụ, đăng nhập tài khoản là chạy được.</> },
]

const TROUBLE = [
  ['Không kéo-thả file .zip vào Chrome', 'Phải GIẢI NÉN trước rồi mới Load unpacked thư mục. Kéo thả file .zip có thể lỗi.'],
  ['Chọn đúng thư mục chứa manifest.json', 'Nếu giải nén ra thư mục lồng thư mục, hãy vào tới thư mục có file manifest.json rồi mới chọn.'],
  ['Báo "Could not load icon"', 'Bản cũ bị lỗi — hãy tải lại file extension.zip mới ở trang này rồi Load unpacked lại.'],
  ['Cập nhật phiên bản mới', 'Tải zip mới → giải nén đè → vào chrome://extensions bấm nút ⟳ Reload ở thẻ ToolMKT AI (hoặc Remove rồi Load unpacked lại).'],
  ['Windows báo file bị chặn', 'Chuột phải file zip → Properties → tích "Unblock / Bỏ chặn" → OK, rồi giải nén lại.'],
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
          <p className="mt-3 text-slate-400">Khoảng 2 phút — tải file zip, giải nén và nạp vào Chrome.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a download href="/extension.zip" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-orange-600/20 hover:from-orange-400 hover:to-red-500"><Download size={18} /> Tải Extension (.zip)</a>
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

        <div className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100"><AlertTriangle size={18} className="text-amber-400" /> Khắc phục sự cố</h2>
          <div className="mt-4 space-y-3">
            {TROUBLE.map(([q, a], i) => (
              <Card key={i} className="p-4">
                <div className="font-medium text-slate-200">{q}</div>
                <p className="mt-1 text-sm text-slate-400">{a}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
          <p className="text-slate-300">Cần hỗ trợ trực tiếp?</p>
          <a href="https://zalo.me/g/fsjwncgaupa915h891zx" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">💬 Vào nhóm hỗ trợ Zalo <ExternalLink size={14} /></a>
        </div>
      </main>
    </div>
  )
}
