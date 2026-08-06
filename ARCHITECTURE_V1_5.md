# Kiến trúc ToolMKT AI v1.5

Từ v1.5, web app là nơi phát hành logic có thể thay đổi động; extension là executor có quyền trình duyệt và lớp chạy nền.

## Phân chia trách nhiệm

### Web app

- Toàn bộ UI và luồng tương tác.
- Prompt, hậu xử lý AI, quota và lịch sử server.
- Runtime policy tại `GET /api/extension/runtime`: mặc định vận hành, giới hạn an toàn và Facebook GraphQL operation IDs.
- `webController.js` sở hữu catalog, mục tiêu, kết quả tìm kiếm, preset, queue, cursor, cap/delay, Auto và background job.
- Dashboard chuyển các hành động thành executor nguyên tử (`EXEC_FETCH_GROUP_FEED`, `EXEC_POST_COMMENT`, `EXEC_SEARCH_GROUPS`, ...).
- Có thể cập nhật runtime mà không phát hành lại extension.

### Extension

- Đọc phiên đăng nhập từ trang Facebook nhưng không gửi cookie/token lên server.
- Thực thi request trong tab Facebook, upload media và thao tác Shopee cần phiên trình duyệt.
- Giữ alarm/kill-switch và executor trình duyệt. Workflow cũ chỉ còn là fallback tương thích trong giai đoạn v1.5.
- Cache runtime policy; nếu web lỗi hoặc mất mạng thì dùng bản cache, cuối cùng dùng cấu hình đóng gói trong extension.

## Giao thức v1.5

- Protocol hiện tại: `1`.
- `PING` trả `version`, `protocolVersion` và `capabilities`.
- Mọi chức năng từ dashboard đi qua một envelope `WEB_SIGNAL` chung gồm `signalId`, `sentAt`, `action` và `payload`.
- `REFRESH_RUNTIME` buộc tải lại policy phục vụ kiểm tra/vận hành.
- Runtime không chứa bí mật và được phép cache CDN.
- Extension chỉ nhận operation ID dạng số hợp lệ; payload sai protocol bị từ chối.

## Quyền điều phối

- Khi web đang mở, web gửi `WEB_HEARTBEAT` và giữ lease 45 giây.
- Trong thời gian lease còn hiệu lực, web phát `AUTO_TICK` hoặc `JOB_TICK`; alarm extension không chạy trùng.
- Chiến dịch v1.5 có cờ `webOwned`: đóng/treo tab web thì chiến dịch dừng, extension không chạy workflow cũ trên một queue khác.
- Alarm cũ chỉ được giữ để tương thích chiến dịch v1.4 chưa migrate; web v1.5 không tạo alarm workflow trong extension.
- Mọi thao tác ghi Facebook vẫn đi qua khóa tuần tự của executor.

## Tương thích và phát hành

- Dữ liệu v1.4 trong `chrome.storage.local` được giữ nguyên, không cần migration phá huỷ.
- Cấu hình người dùng luôn ưu tiên hơn default từ web.
- Các giới hạn an toàn tối thiểu đóng gói trong extension vẫn là hàng rào cuối cùng.
- Cần phát hành extension mới chỉ khi thay đổi quyền Chrome, content script, executor, hoặc giao thức không còn tương thích.
