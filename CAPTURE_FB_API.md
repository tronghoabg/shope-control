# Cách chụp request Facebook để điền vào `extension/fb_api.js`

Có **2 request** cần chụp. Cả hai đều ở: DevTools (F12) → tab **Network** → ô filter gõ `graphql`.

> Mẹo: bật **Preserve log**, cột hiển thị thêm "Request Method". Mỗi dòng `/api/graphql/`
> click vào → tab **Payload** (xem `variables`, `doc_id`, `fb_api_req_friendly_name`) và tab
> **Response** (xem cấu trúc JSON trả về).

---

## 1) Request ĐỌC FEED NHÓM  → điền vào `GROUP_FEED`

1. Mở 1 nhóm Facebook bất kỳ, **cuộn xuống** để FB tải thêm bài.
2. Trong Network, tìm request `/api/graphql/` xuất hiện đúng lúc cuộn (thường friendly_name chứa
   `GroupsCometFeed...Pagination` hoặc `..._GroupFeed...`).
3. Mở tab **Payload**, gửi cho tôi (hoặc tự điền):
   - `fb_api_req_friendly_name` → `GROUP_FEED.FRIENDLY_NAME`
   - `doc_id` → `GROUP_FEED.DOC_ID`
   - **toàn bộ object `variables`** (tôi sẽ thay id nhóm + cursor thành tham số) → `buildVariables`
4. Mở tab **Response**, copy 1 phần JSON (khoảng 100 dòng đầu có chứa 1 bài viết + `message.text`
   + `feedback.id`) để tôi chỉnh hàm `parse()` cho khớp đường dẫn.

## 2) Request ĐĂNG COMMENT  → điền vào `COMMENT`

1. Vào 1 bài trong nhóm, gõ 1 comment thử rồi **bấm gửi**.
2. Tìm request `/api/graphql/` bắn ra ngay lúc gửi (friendly_name thường chứa
   `CometUFICreateCommentMutation` hoặc tương tự).
3. Gửi cho tôi (hoặc tự điền):
   - `fb_api_req_friendly_name` → `COMMENT.FRIENDLY_NAME`
   - `doc_id` → `COMMENT.DOC_ID`
   - **object `variables`** (đặc biệt là `input.feedback_id`, `input.message.text`, `input.actor_id`) → `buildVariables`
   - 1 phần **Response** để xác nhận trường id comment khi thành công.

---

## Những gì đã tự lo sẵn (bạn KHÔNG cần chụp)

- `fb_dtsg`, `lsd`, cookie phiên: extension tự lấy qua `inject.js` từ trang đang đăng nhập.
- Header `origin`/`referer`/`sec-fetch`: vì fetch chạy **trong tab facebook.com thật** nên đã đúng.
- Định dạng body `x-www-form-urlencoded`: `buildBody()` trong `fb_api.js` dựng sẵn.

## Lấy ID nhóm

Mở nhóm → URL dạng `facebook.com/groups/<id-hoặc-slug>`. Nếu là slug chữ, lấy id số bằng cách
xem `variables` của request feed (trường `id` thường là số). Dán các id (số) vào ô **ID nhóm**
trong dashboard, cách nhau dấu phẩy.
