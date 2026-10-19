# Ký duyệt bản vẽ E — Cổng học viên + web cài lên màn hình chính (PWA)

Người ký: điều phối (kiến trúc sư trưởng), 19/10/2026, theo lệnh anh Chiến *"giao cho thợ sắp xếp làm giúp tôi đẩy nhanh tiến độ giúp tôi"*. Câu hỏi mở mục 9 trợ lý quyết thay, anh bác được.

Bản vẽ: `docs/rnd/BAN-VE-E-CONG-HOC-VIEN-PWA.md`. **Ký, với các quyết định:**

| # | Câu hỏi | Quyết | Lý do |
|---|---|---|---|
| 1 | Máy thứ hai của một đường dẫn đã mở | Không hạn theo ngày, nhưng vẫn tối đa 2 máy; trung tâm thu hồi được bất cứ lúc nào; máy đã mở nhớ 90 ngày như đã chốt | Học viên đổi điện thoại giữa khoá là thường gặp |
| 2 | Ảnh Feedback trên cổng | Hiện ảnh của chính học viên đó; trung tâm có nút ẩn từng thẻ (trường `portalVisible`, mặc định hiện) | Có ảnh khách không muốn lộ |
| 3 | Ai gửi đường dẫn / ai đổi số tài khoản | Như bản vẽ: gửi = Chủ, Quản trị, Quản lý, Lễ tân (có cả quyền xem khách, hợp đồng, phiếu thu); đổi số tài khoản = Chủ, Quản trị | Đụng tiền |
| 4 | Học viên đã huỷ ghi danh xem hợp đồng cũ | Được, khi còn phiên | Hợp đồng vẫn là của họ |
| 5 | Tên miền + máy thật | Chờ anh (việc tồn 1, docs/DUA-LEN-MANG.md) | — |

**Thứ tự:** các gói đụng `apps/api/prisma/schema.prisma` chạy **lần lượt**, không song song: K6 → D-M1 → E1 → F (giấy chứng nhận) → G (mẫu in). Gói W1 (PWA) chờ thợ K7 xong `apps/web/index.html`.

**Cửa gác bắt buộc:** cửa gác từ 10 lên 14 phép đều xanh, 5 đột biến mới đỏ, phép chống tái phạm 3 lỗi Studio Pro (mục 2.8) có mặt; nghiệm thu N1 do thợ KHÁC người làm.
