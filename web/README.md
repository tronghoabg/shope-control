# Shope Web — Backend SaaS (Next.js)

Auth + gói thanh toán + quota + admin cho Shope Control. **Không chạm Facebook** (FB chạy ở extension) — web chỉ lo: đăng nhập, gói, hạn mức, thanh toán, admin.

## Stack
- Next.js 14 (App Router) · Auth.js v5 (email/mật khẩu + Google) · Prisma · Tailwind
- DB: SQLite (chạy local ngay) — đổi sang Postgres khi deploy (sửa `provider` trong `prisma/schema.prisma`).
- Thanh toán: **SePay** (webhook khớp nội dung CK → kích hoạt gói).

## Chạy local
```bash
cd web
cp .env.example .env          # điền AUTH_SECRET (openssl rand -base64 32), SePay account…
npm install
npx prisma db push            # tạo bảng
npm run db:seed               # tạo admin (admin@shope.local / admin123)
npm run dev                   # http://localhost:3000
```

## Gói (sửa ở `src/lib/plans.ts`)
| Gói | Giá | Hạn | Comment/ngày |
|---|---|---|---|
| Miễn phí | 0 | ∞ | **10** |
| Pro 1 tháng | 50.000₫ | 30 ngày | không giới hạn |
| Pro 6 tháng | 250.000₫ | 180 ngày | không giới hạn |
| Pro 12 tháng | 450.000₫ | 365 ngày | không giới hạn |

## Thanh toán SePay
1. Tạo Business ở SePay, thêm tài khoản ngân hàng, lấy **API Key** webhook.
2. Cấu hình webhook trỏ về `https://<domain>/api/sepay/webhook`, header `Authorization: Apikey <key>`.
3. Điền `SEPAY_*` trong `.env`. Khi khách CK đúng nội dung `SHOPE...`, webhook tự kích hoạt gói.

## API cho extension
- `GET /api/usage` (header `Authorization: Bearer <apiToken>`) → quota hiện tại.
- `POST /api/usage` → +1 comment, trả quota mới (HTTP 429 nếu free đã đủ 10/ngày).
- Lấy `apiToken` ở **Dashboard** sau khi đăng nhập → dán vào Cài đặt extension.

## Quota lưu ở đâu
- **DB (server)**: user, gói, thanh toán, **số comment/ngày** (chống bypass), lịch sử đăng.
- **Extension (chrome.storage.local)**: nhóm/queue/log/catalog/creds (dữ liệu vận hành, không lên server).
