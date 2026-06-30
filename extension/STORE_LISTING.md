# Chrome Web Store — Nội dung đăng

> Copy từng mục dán vào trang **Developer Dashboard → Store listing / Privacy practices**.
> Tiếng Việt là ngôn ngữ chính; có kèm bản EN ngắn nếu muốn thêm locale.

---

## 1) Tên (Name) — tối đa 75 ký tự
```
ToolMKT AI — Tìm khách hàng trên Facebook
```

## 2) Tóm tắt ngắn (Summary) — tối đa 132 ký tự
```
Trợ lý AI giúp tìm & phân tích bài đăng, nhóm Facebook có khách hàng tiềm năng và gợi ý nội dung tương tác phù hợp.
```

## 3) Danh mục (Category)
- **Chính:** Workflow & Planning (hoặc Productivity)
- **Ngôn ngữ:** Tiếng Việt

---

## 4) Mô tả chi tiết (Detailed description)

```
ToolMKT AI là trợ lý tiếp thị dùng trí tuệ nhân tạo, giúp người bán hàng và nhà tiếp thị TÌM và ĐÁNH GIÁ cơ hội tiếp cận khách hàng tiềm năng trên Facebook một cách thông minh — thay vì dò thủ công từng nhóm, từng bài.

★ TÍNH NĂNG CHÍNH
• Phân tích nhóm Facebook bằng AI: chấm điểm mức độ phù hợp của từng nhóm với sản phẩm/lĩnh vực của bạn.
• Tìm bài đăng tiềm năng: AI đọc nội dung bài viết và đánh giá đâu là người đang có nhu cầu, hỏi mua, xin tư vấn.
• Gợi ý nội dung tương tác: AI soạn sẵn gợi ý bình luận tự nhiên, lịch sự, đúng ngữ cảnh để bạn tham khảo và chỉnh sửa.
• Quản lý tập trung: danh sách nhóm mục tiêu, hàng chờ duyệt, nhật ký hoạt động — tất cả trong một bảng điều khiển.
• Bạn toàn quyền kiểm soát: mọi nội dung đều cần BẠN xem lại và bấm duyệt trước khi sử dụng. Có nút Dừng cho mọi thao tác.

★ DÙNG AI CỦA BẠN
Extension hoạt động với khoá API AI do bạn cung cấp (Claude / OpenAI / Gemini) hoặc gói dịch vụ của ToolMKT AI. Khoá API được lưu cục bộ trong trình duyệt của bạn.

★ AI XỬ LÝ NGAY TRÊN TRÌNH DUYỆT
Extension dùng chính phiên đăng nhập Facebook sẵn có trong trình duyệt của bạn (qua cookie) để đọc nội dung công khai bạn có quyền xem. Không thu thập mật khẩu, không đăng nhập hộ.

★ DÀNH CHO AI?
Chủ shop online, người làm affiliate/tiếp thị, freelancer cần nghiên cứu thị trường và tìm khách hàng theo lĩnh vực.

★ LƯU Ý SỬ DỤNG CÓ TRÁCH NHIỆM
Hãy tuân thủ Điều khoản của Facebook và quy định cộng đồng của từng nhóm. Công cụ hỗ trợ bạn ra quyết định nhanh hơn; bạn chịu trách nhiệm về nội dung mình đăng. Đặt giãn cách hợp lý, tránh spam.

Hỗ trợ: <email/website của bạn>
Chính sách quyền riêng tư: https://toolmktai.com/privacy
```

---

## 5) Mục đích đơn (Single purpose) — BẮT BUỘC

```
Extension có một mục đích duy nhất: hỗ trợ người dùng tìm và phân tích bằng AI các bài đăng/nhóm Facebook có khách hàng tiềm năng, và gợi ý nội dung tương tác để người dùng tự xem lại trước khi sử dụng.
```

---

## 6) Giải trình quyền (Permission justifications) — BẮT BUỘC

| Quyền | Lý do (dán vào ô justification) |
|---|---|
| `storage` | Lưu cấu hình người dùng, danh sách nhóm mục tiêu, hàng chờ và khoá API cục bộ trong trình duyệt. |
| `tabs` | Tìm/mở tab Facebook và Shopee mà người dùng đang đăng nhập để đọc nội dung công khai phục vụ phân tích. |
| `scripting` | Chèn đoạn mã đọc nội dung công khai trên trang Facebook/Shopee đang mở để AI phân tích. |
| `alarms` | Lập lịch các tác vụ định kỳ (ví dụ kiểm tra hàng chờ) theo giãn cách an toàn. |
| `notifications` | Thông báo cho người dùng khi một tác vụ hoàn tất hoặc gặp lỗi. |
| `declarativeNetRequestWithHostAccess` | Thêm header cần thiết cho các yêu cầu tới đúng tên miền đã khai báo, giúp đọc dữ liệu hợp lệ. |
| Host: `*.facebook.com` | Đọc nội dung công khai trong phiên đăng nhập của người dùng để phân tích nhóm/bài. |
| Host: `*.shopee.vn`, `affiliate.shopee.vn` | (Chỉ khi người dùng bật tính năng liên quan) tra cứu sản phẩm để gợi ý nội dung. |
| Host: `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` | Gửi nội dung cần phân tích tới nhà cung cấp AI mà người dùng đã chọn, bằng khoá API của họ. |
| Host: `toolmktai.com` | Liên kết tài khoản và kiểm tra hạn mức gói dịch vụ. |

> Cần khai **"Có sử dụng remote code? → Không"** (toàn bộ code nằm trong gói; chỉ gọi API dữ liệu).

---

## 7) Khai báo sử dụng dữ liệu (Data usage / Privacy practices)

Tick các mục đúng thực tế:
- **Không** bán/chuyển dữ liệu người dùng cho bên thứ ba.
- **Không** dùng/chuyển dữ liệu ngoài mục đích cốt lõi.
- **Không** dùng dữ liệu cho mục đích chấm điểm tín dụng/cho vay.

Dữ liệu xử lý (khai trung thực):
- Nội dung trang web người dùng đang xem (bài đăng công khai) — gửi tới nhà cung cấp AI để phân tích, **không lưu trên máy chủ của chúng tôi**.
- Cấu hình & khoá API — lưu **cục bộ** trong trình duyệt.
- Thông tin xác thực (email tài khoản ToolMKT) — để liên kết gói dịch vụ.

> ⚠️ **Bắt buộc có trang Chính sách quyền riêng tư** công khai (URL) trước khi submit. Tôi có thể giúp bạn viết nếu chưa có.

---

## 8) Ảnh & đồ hoạ cần chuẩn bị
- **Icon 128×128** (đã có trong `icons/`).
- **Screenshots 1280×800 hoặc 640×400**: tối thiểu 1, nên 3–5 tấm:
  1. Bảng điều khiển tổng quan.
  2. Màn "Nhóm của tôi" có điểm AI.
  3. Màn "Tìm bài tiềm năng" + hàng chờ duyệt.
  4. Màn cài đặt AI (chọn provider).
  5. Nút Dừng / kiểm soát người dùng (làm nổi bật "bạn toàn quyền").
- **Ảnh quảng cáo nhỏ 440×280** (tuỳ chọn nhưng nên có).

---

## 9) VIỆC CẦN LÀM TRƯỚC KHI BUILD GÓI .ZIP NỘP STORE
1. **Gỡ URL dev khỏi manifest** (reviewer hay từ chối nếu thấy localhost):
   - Bỏ `http://localhost:3000/*`, `http://127.0.0.1:3000/*`, `http://localhost:5173/*` khỏi `host_permissions`.
   - Bỏ localhost khỏi `externally_connectable.matches`.
   - Bỏ localhost khỏi `content_scripts` (chỉ giữ `toolmktai.com`).
2. Đảm bảo `version` tăng mỗi lần nộp.
3. Kiểm tra icon 16/48/128 đầy đủ.
4. Có URL Chính sách quyền riêng tư hoạt động.
5. Đóng gói: zip **nội dung bên trong** thư mục `extension/` (không zip cả thư mục cha).

---

## 10) Bản tiếng Anh ngắn (nếu thêm locale EN)
- **Name:** ToolMKT AI — Find customers on Facebook
- **Summary:** AI assistant to find and analyze Facebook posts & groups with potential customers and suggest relevant engagement content.
