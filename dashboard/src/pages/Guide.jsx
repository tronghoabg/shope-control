import { IconRocket, IconArrowRight, IconAlertTriangle, IconCheck } from '@tabler/icons-react'
import { Card, Section, Badge, Btn } from '../ui.jsx'

function Num({ n }) {
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">{n}</span>
}

export default function Guide({ goto }) {
  const Go = ({ to, children }) => <Btn size="sm" variant="ghost" onClick={() => goto?.(to)}>{children} <IconArrowRight size={13} /></Btn>

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <IconRocket size={22} className="text-indigo-400" />
        <h1 className="text-xl font-bold text-slate-100">Hướng dẫn sử dụng</h1>
      </div>

      <Card className="border-indigo-500/30 bg-indigo-500/[0.06] p-4 text-sm text-slate-300">
        <b className="text-slate-100">ToolMKT AI</b> giúp bạn <b>tìm khách & bán hàng trên Facebook bằng AI</b>: tìm nhóm tiềm năng,
        đọc bài để tìm khách đang có nhu cầu, tự soạn comment (kèm link Shopee nếu cần) và đăng bài hàng loạt — chạy ngay trong
        trình duyệt của bạn nên an toàn tài khoản.
      </Card>

      {/* Chuẩn bị */}
      <Section title="Chuẩn bị (1 lần)">
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex gap-2"><IconCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" /> <span><b>Đăng nhập tài khoản</b> (góc dưới trái). AI đã có sẵn theo gói — <b>không cần nhập API key</b>.</span></li>
          <li className="flex gap-2"><IconCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" /> <span>Mở sẵn <b>1 tab facebook.com đã đăng nhập</b> → chip <Badge color="green">Facebook</Badge> trên đầu chuyển xanh.</span></li>
          <li className="flex gap-2"><IconCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" /> <span>Chỉ khi <b>Rải link Shopee</b>: mở thêm <b>tab shopee.vn</b> + <b>affiliate.shopee.vn</b> (đã đăng nhập) → chip <Badge color="green">Shopee</Badge> xanh.</span></li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">3 chip <b>Extension · Facebook · Shopee</b> trên đầu cho biết đã sẵn sàng hay chưa (xanh = ok, đỏ = chưa).</p>
      </Section>

      {/* Các bước */}
      <Section title="Quy trình">
        <div className="space-y-4">
          <div className="flex gap-3">
            <Num n={1} />
            <div className="flex-1">
              <div className="flex items-center gap-2"><b className="text-slate-100">Tham gia nhóm</b> <Go to="discover">Mở</Go></div>
              <p className="text-sm text-slate-400">Nhập từ khoá (hoặc để AI gợi ý) để tìm nhóm theo ngành hàng → tick chọn → <b>Tham gia hàng loạt</b>.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Num n={2} />
            <div className="flex-1">
              <div className="flex items-center gap-2"><b className="text-slate-100">Nhóm của tôi</b> <Go to="groups">Mở</Go></div>
              <p className="text-sm text-slate-400">Bấm <b>Quét &amp; chấm điểm</b> → AI đánh giá nhóm nào hợp bán hàng. Lọc <b>Tiềm năng</b>, tick chọn <b>nhóm mục tiêu</b>, rồi <b>Lưu danh sách</b> để tái dùng.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Num n={3} />
            <div className="flex-1">
              <div className="flex items-center gap-2"><b className="text-slate-100">Comment dạo / Rải link</b> <Go to="queue">Mở</Go></div>
              <p className="text-sm text-slate-400">Chọn nhóm (hoặc 1 danh sách đã lưu) → chọn <b>kiểu đăng</b> (Comment dạo / Rải link Shopee / Catalog) → <b>Tìm bài tiềm năng</b> → tick chọn bài → bấm <b>Rải link / Đăng</b>. Hoặc bật <b>Auto</b> để tự chạy.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Num n={4} />
            <div className="flex-1">
              <div className="flex items-center gap-2"><b className="text-slate-100">Đăng bài nhóm</b> <Go to="postgroups">Mở</Go></div>
              <p className="text-sm text-slate-400">Soạn 1 bài (ảnh, màu nền, <b>spintax</b> <code className="rounded bg-slate-800 px-1">{'{a|b}'}</code>, <b>AI viết lại</b> mỗi nhóm) → chọn nhóm → đăng hàng loạt theo giãn cách. Lưu bài để tái dùng.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Lưu & an toàn */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Lưu & tái dùng">
          <p className="text-sm text-slate-400">Trang <b>Đã lưu</b> giữ <b>danh sách nhóm mục tiêu</b> và <b>bài viết mẫu</b> — chọn lại cả cụm chỉ với 1 chạm.</p>
          <div className="mt-2"><Go to="saved">Mở Đã lưu</Go></div>
        </Section>
        <Section title="An toàn tài khoản">
          <ul className="space-y-1.5 text-sm text-slate-400">
            <li>• Mọi thao tác chạy trong <b>tab Facebook thật</b> của bạn.</li>
            <li>• <b>Giãn cách ngẫu nhiên</b> giữa các lần đăng (chỉnh ở Cấu hình nâng cao).</li>
            <li>• <b>Duyệt tay</b> trước khi đăng + giới hạn theo gói/ngày.</li>
          </ul>
        </Section>
      </div>

      {/* Khắc phục sự cố */}
      <Section title={<span className="flex items-center gap-2"><IconAlertTriangle size={16} className="text-amber-400" /> Khắc phục sự cố</span>}>
        <div className="space-y-3 text-sm">
          {[
            ['Chip Extension đỏ / app kẹt "Đang kết nối"', <>Vào <code className="rounded bg-slate-800 px-1">chrome://extensions</code> → <b>Reload</b> ToolMKT AI → F5 lại trang.</>],
            ['Chip Facebook đỏ', <>Mở 1 tab <b>facebook.com</b> đã đăng nhập, rồi bấm chip Facebook để kết nối.</>],
            ['Rải link: "Shopee không có SP / bị chặn"', <>Tab Shopee nền bị Chrome "đóng băng". Giữ mở <b>1 tab shopee.vn</b> đã đăng nhập; hoặc đổi nguồn sang <b>Catalog</b> (nạp link sẵn) cho ổn định.</>],
            ['Quét báo lỗi "Đã đạt trần lượt AI/ngày"', <>Đã dùng hết hạn mức AI trong ngày của gói. Đợi sang ngày mới (reset 0h) hoặc <b>nâng cấp gói</b>.</>],
            ['Tìm bài xong 0 bài', <>Bài trong nhóm chưa đúng nhu cầu, hoặc (chế độ Rải link) không tìm được SP. Thử <b>Comment dạo</b>, hạ <b>ngưỡng điểm</b> ở Cấu hình nâng cao, hoặc đổi nhóm.</>],
          ].map(([q, a], i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="font-medium text-slate-200">{q}</div>
              <div className="mt-1 text-slate-400">{a}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
