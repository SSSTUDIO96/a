# Ký duyệt bản vẽ C3 — Trung tâm đào tạo (phần dữ liệu và gói máy chủ)

Người ký: điều phối (kiến trúc sư trưởng), 18/10/2026. Anh Chiến đang ngủ và đã giao: *"Cứ làm toàn bộ hết đi khi nào xong báo tôi để tôi vào thao tác thực tế"*. Đây là quyết định thay, anh bác được.

Bản vẽ: `docs/rnd/BAN-VE-C3-DAO-TAO.md`, mục 1 (dữ liệu) và mục 3.1 (gói máy chủ). **Ký, với 3 điều chỉnh:**

| # | Bản vẽ ghi | Điều chỉnh | Lý do |
|---|---|---|---|
| 1 | Mẫu sai loại hợp đồng, quá 3 ảnh → **422** | Trả **400** `VALIDATION_FAILED`, có `details.issues` chỉ đúng trường | Máy chủ chưa dùng mã 422 ở đâu; web đã ánh xạ lỗi theo 400/401/403/404/409. Thêm một mã mới thì phải sửa cả hai đầu. |
| 2 | Thứ tự M1 → M2 → M3 → M4, rồi M5–M8 | M1 + M2 làm trước (một thợ). Sau đó **chạy song song**: M3 (khoá & lớp) · M4 + M5 (hợp đồng khoá học + mẫu điều khoản, cùng thư mục `contracts`) · M6 (mẫu thiết kế) · M7 + M8 (giới hạn, báo cáo, tạo tổ chức, tệp) | M4 chỉ cần bảng của M1, không cần đường API của M3; bài thử của M4 tạo khoá/lớp bằng cách ghi thẳng vào database. Thư mục khác nhau nên không giẫm tệp. |
| 3 | M3, M6 "đăng ký ở `src/app.ts`" | Điều phối tạo sẵn `src/modules/courses/routes.ts` và `src/modules/designs/routes.ts` (mảng rỗng) rồi đăng ký vào `ALL_ROUTES` **một lần** sau M1. Thợ M3, M6 không sửa `app.ts`. | `app.ts` là tệp chung; nhiều thợ cùng sửa sẽ giẫm nhau. |

**Mục 4 (việc còn chờ quyết), quyết thay:**
- Giảng viên: giữ `courses.read` (xem mọi lớp), như bản vẽ. Tách `courses.read_own` để sau khi anh muốn hẹp hơn.
- Buổi học lên Lịch: **chưa làm** đợt này. Ghi vào việc tồn.
- Ảnh minh chứng phiếu thu, nhắc hạn đợt, ô "khách đồng ý đăng ảnh": **chưa làm** đợt này. Ghi vào việc tồn.

**Cửa gác bắt buộc khi nghiệm thu gói máy chủ đào tạo:**
- Cửa gác cách ly (`test/gate.ts`) phải phủ mọi đường mới. Điều phối thêm mã khoá/lớp/thẻ vào bộ dữ liệu mẫu sau M3/M6.
- Bài đua: 10 lần thử, mỗi lần 2 xác nhận đồng thời vào chỗ cuối. Đúng 1 thành công ở cả 10/10 lần.
