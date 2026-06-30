import { Logo, LinkBtn } from '@/components/ui'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Chính sách quyền riêng tư',
  description: 'Chính sách quyền riêng tư của ToolMKT AI — extension & dịch vụ tìm khách hàng tiềm năng trên Facebook bằng AI.',
  alternates: { canonical: '/privacy' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-100">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-900/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Logo />
          <LinkBtn href="/" variant="ghost"><ArrowLeft size={15} /> Trang chủ</LinkBtn>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-extrabold text-slate-50">Chính sách quyền riêng tư</h1>
        <p className="mt-2 text-sm text-slate-500">Cập nhật lần cuối: 30/06/2026</p>

        <p className="mt-6 text-sm leading-relaxed text-slate-300">
          Chính sách này mô tả cách extension và dịch vụ <b>ToolMKT AI — Tìm khách hàng trên Facebook</b> (“chúng tôi”)
          xử lý dữ liệu khi bạn sử dụng. Bằng việc cài đặt và dùng công cụ, bạn đồng ý với chính sách này.
        </p>

        <Section title="1. Chúng tôi xử lý dữ liệu gì">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><b>Nội dung trang bạn đang xem:</b> bài đăng/nhóm Facebook công khai mà bạn có quyền xem, và thông tin sản phẩm Shopee (chỉ khi bạn bật tính năng liên quan). Dữ liệu này được gửi tới nhà cung cấp AI bạn chọn để phân tích.</li>
            <li><b>Cấu hình & khoá API AI:</b> provider, model, khoá API (Claude/OpenAI/Gemini), danh sách nhóm mục tiêu, hàng chờ, nhật ký — tất cả lưu <b>cục bộ</b> trong trình duyệt của bạn (chrome.storage).</li>
            <li><b>Tài khoản dịch vụ:</b> nếu bạn liên kết gói ToolMKT AI, chúng tôi xử lý email tài khoản và trạng thái gói/hạn mức để cấp quyền sử dụng.</li>
            <li><b>Thông tin thanh toán:</b> được xử lý qua đối tác cổng thanh toán; chúng tôi không lưu thông tin thẻ/ngân hàng.</li>
          </ul>
        </Section>

        <Section title="2. Chúng tôi KHÔNG làm gì">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Không thu thập mật khẩu Facebook/Shopee. Công cụ dùng phiên đăng nhập sẵn có trong trình duyệt của bạn (cookie), không đăng nhập hộ.</li>
            <li>Không bán, cho thuê hay chia sẻ dữ liệu người dùng cho bên thứ ba vì mục đích quảng cáo.</li>
            <li>Không lưu trữ nội dung bài đăng được phân tích trên máy chủ của chúng tôi.</li>
            <li>Không dùng dữ liệu cho mục đích ngoài chức năng cốt lõi của công cụ.</li>
          </ul>
        </Section>

        <Section title="3. Khoá API và nhà cung cấp AI">
          <p>
            Khi bạn dùng tính năng phân tích, nội dung cần xử lý được gửi trực tiếp từ trình duyệt của bạn tới nhà cung cấp AI
            mà bạn chọn (Anthropic, OpenAI hoặc Google) bằng khoá API của bạn. Việc nhà cung cấp AI xử lý dữ liệu đó tuân theo
            chính sách riêng của họ. Khoá API của bạn được lưu cục bộ và chỉ dùng để gọi đúng nhà cung cấp đó.
          </p>
        </Section>

        <Section title="4. Quyền của extension và lý do">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><b>storage</b> — lưu cấu hình, khoá API, hàng chờ cục bộ.</li>
            <li><b>tabs, scripting</b> — mở/đọc nội dung công khai trên trang Facebook/Shopee bạn đang đăng nhập để phân tích.</li>
            <li><b>alarms</b> — lập lịch tác vụ định kỳ theo giãn cách an toàn.</li>
            <li><b>notifications</b> — báo khi tác vụ hoàn tất hoặc gặp lỗi.</li>
            <li><b>Quyền truy cập tên miền</b> facebook.com, shopee.vn, các API AI và toolmktai.com — phục vụ đúng các chức năng nêu trên.</li>
          </ul>
        </Section>

        <Section title="5. Lưu trữ và xoá dữ liệu">
          <p>
            Dữ liệu cục bộ nằm trong trình duyệt của bạn; gỡ extension hoặc xoá dữ liệu duyệt web sẽ xoá chúng.
            Với dữ liệu tài khoản dịch vụ, bạn có thể yêu cầu xoá bằng cách liên hệ chúng tôi qua email bên dưới.
          </p>
        </Section>

        <Section title="6. Sử dụng có trách nhiệm">
          <p>
            Công cụ hỗ trợ bạn nghiên cứu và ra quyết định; bạn chịu trách nhiệm tuân thủ Điều khoản dịch vụ của Facebook,
            Shopee và quy định của từng nhóm/cộng đồng đối với mọi nội dung bạn đăng.
          </p>
        </Section>

        <Section title="7. Thay đổi chính sách">
          <p>Khi cập nhật, chúng tôi sẽ đổi ngày “Cập nhật lần cuối” ở đầu trang. Vui lòng xem lại định kỳ.</p>
        </Section>

        <Section title="8. Liên hệ">
          <p>Mọi thắc mắc về quyền riêng tư, liên hệ: <a className="text-indigo-400 hover:underline" href="mailto:tronghoabg@gmail.com">tronghoabg@gmail.com</a></p>
        </Section>

        <hr className="my-10 border-slate-800" />

        <h2 className="text-lg font-bold text-slate-100">Privacy Policy (English summary)</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          ToolMKT AI is an AI assistant that helps you find and analyze potential customers on Facebook. It processes the
          public page content you are viewing and sends it to the AI provider you choose, using your own API key. Your
          configuration and API keys are stored locally in your browser. We do not collect your Facebook/Shopee passwords,
          we do not sell user data, and we do not store analyzed post content on our servers. Permissions (storage, tabs,
          scripting, alarms, notifications, host access) are used solely to deliver these features. Contact:
          tronghoabg@gmail.com.
        </p>
      </main>
    </div>
  )
}
