# Shope Auto-Comment — Extension rải link Shopee bằng AI

Công cụ **dùng cá nhân, chạy local**: tự tìm bài viết tiềm năng trong các nhóm Facebook,
dùng AI **chấm điểm** + chọn **sản phẩm Shopee khớp nhất** từ catalog của bạn, sinh **comment
tự nhiên** kèm link affiliate và tự động đăng (có throttle an toàn).

## Kiến trúc (2 phần)

```
shope/
├── extension/          # Chrome MV3 — CHỈ là cầu nối (không có UI riêng)
│   ├── inject.js              # lấy token + fb_dtsg từ tab Facebook đã đăng nhập
│   ├── content_fb.js          # chạy fetch GraphQL trong tab facebook.com thật
│   ├── fb_api.js              # executor Facebook; operation IDs nhận động từ web, có fallback offline
│   ├── ai.js                  # client gọi AI hệ thống trên web
│   ├── catalog.js             # parse CSV + lọc SP theo từ khoá
│   ├── background.js          # điều phối: scheduler + cap/ngày + delay + kill-switch
│   └── dashboard_bridge.js    # cầu nối postMessage ↔ web app
└── dashboard/          # Web app điều khiển (Vite + React + Tailwind) — TOÀN BỘ UI ở đây
```

- **Extension không có popup/HTML.** Bấm icon extension sẽ mở web app.
- **Web app là bộ não từ v1.5.** Prompt/AI, quota và runtime policy được phát hành từ web;
  extension giữ executor trình duyệt, scheduler nền và cache fallback.
- Mọi thao tác Facebook chạy **trong trình duyệt của bạn** (tab facebook.com đã đăng nhập) —
  không gửi token/cookie đi đâu cả.

## Chạy

### 1. Web app điều khiển
```bash
cd dashboard
npm install
npm run dev          # mở http://localhost:5173
```

### 2. Extension (cầu nối)
1. `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục `extension/`.
2. Bấm icon extension (hoặc mở `localhost:5173`) → web app hiện ra.
3. Trong web app:
   - **Cài đặt AI**: chọn provider, bấm **Lấy API ↗** để lấy key, dán vào, bấm **Test API**.
   - **Catalog**: dán CSV `id,name,keywords,category,price,link` → **Nhập catalog**.
   - **Cấu hình chạy**: cap/ngày, delay, ngưỡng điểm, **ID nhóm** mục tiêu → **Lưu**.
4. Mở 1 tab `facebook.com` đã đăng nhập (để extension lấy creds + đăng comment).
5. Bấm **Quét thử nhóm** rồi **Đăng 1 comment** để kiểm tra; ổn thì **Bật Auto**.

Chi tiết ranh giới và cơ chế cập nhật xem [ARCHITECTURE_V1_5.md](ARCHITECTURE_V1_5.md).

## ⚠️ Chống checkpoint (đọc kỹ)

Bạn chọn **tự động hoàn toàn**. Facebook khoá tài khoản rất nhanh khi comment hàng loạt theo
nhịp máy. Vì vậy dự án **luôn** ép các lớp an toàn (kể cả ở chế độ auto):

- **Cap/ngày** (mặc định 30), **delay ngẫu nhiên** (mặc định 90–240s), **không trùng bài**.
- **Kill-switch** (nút DỪNG NGAY) tắt toàn bộ vòng lặp tức thì.
- Chỉ chạy khi có tab Facebook đăng nhập đang mở.

> Khuyến nghị: cap nhỏ vài ngày đầu, dùng acc đã "nuôi", bật từ từ.

## Pháp lý
Comment hàng loạt vi phạm Điều khoản Facebook và có thể vi phạm chính sách affiliate Shopee.
Bạn tự chịu trách nhiệm; công cụ dành cho mục đích cá nhân trên tài khoản bạn sở hữu.
