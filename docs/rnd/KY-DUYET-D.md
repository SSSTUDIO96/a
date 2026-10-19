# Ký duyệt bản vẽ D — Hôm nay, loại sự kiện, phụ phí tự động, hợp đồng nhiều ngày

Người ký: điều phối (kiến trúc sư trưởng), 19/10/2026. Anh Chiến giao: *"giao cho thợ sắp xếp làm giúp tôi đẩy nhanh tiến độ giúp tôi"*. Các câu hỏi mở mục 7 được trợ lý quyết thay, anh bác được.

Bản vẽ: `docs/rnd/BAN-VE-D-HOM-NAY-SU-KIEN-PHU-PHI.md`. **Ký, với các quyết định sau cho mục 7:**

| # | Câu hỏi | Quyết | Lý do |
|---|---|---|---|
| 1 | Hôm nay có thay Lịch làm trang mở đầu không | **Không.** Lịch vẫn là trang mở đầu. "Hôm nay" là mục ĐẦU TIÊN ở thanh bên máy tính và nằm trong ngăn "Thêm" trên điện thoại; thanh dưới điện thoại **giữ nguyên** như hiện nay | Không xáo thanh dưới anh đã quen; lùi được bằng một dòng nav.ts |
| 2 | Lịch mở ra tô theo gì | Nhân vật (như bản vẽ) | Ca cũ chưa có sự kiện |
| 3 | Luật phụ phí ở Bảng giá | Đồng ý | Cài đặt cần org.update, thợ không thấy |
| 4 | Ai cài luật | Người có quyền đổi giá (Chủ, Quản trị, Quản lý) | Đụng tiền |
| 5 | Phụ phí theo người | Theo số lượng của dòng (phù dâu × 2 → phụ phí × 2) | Mỗi người được trang điểm là một lần làm ngoài giờ/ngày lễ |
| 6 | Hợp đồng nháp cũ | Lưu lại thì luật tự thêm, có báo rõ dòng nào tự thêm; người lập bỏ được | Nháp chưa ký với khách |

**Thứ tự giao (giữ bản vẽ mục 5, thêm một chặn):** gói **M1 (schema.prisma) chỉ bắt đầu khi thợ K2 và K6 đã xong** — hai thợ này đang sửa cùng tệp `schema.prisma`. H1 và M2 bắt đầu ngay.

**Cửa gác bắt buộc khi nghiệm thu:** số đường cửa gác tăng đúng 8 so với số đo H1; 3 đột biến gate-mutants đỏ; bài thử ghi thẳng database của M1; một thợ KHÁC nghiệm thu (N1 chỉ chụp ảnh, không phải nghiệm thu).
