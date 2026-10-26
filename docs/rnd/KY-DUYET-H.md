# Ký duyệt bản vẽ H — Mã số học viên trên thẻ chào mừng

Người ký: điều phối (kiến trúc sư trưởng), 26/10/2026 tối, trong lúc anh Chiến vắng (quyền "trợ lý quyết thay khi anh vắng"). Anh bác được — ghi ở `docs/NHAT-KY-QUYET-DINH-THAY.md`.

Bản vẽ: `docs/rnd/BAN-VE-H-MA-SO-CHAO-MUNG.md` (11 gói, 52 giờ ≈ 13 buổi, đường găng ≈ 33 giờ). **Ký, với các quyết định và điều kiện dưới đây.**

| # | Mục | Quyết | Lý do |
|---|---|---|---|
| 1 | Câu hỏi mở 1: cm-02 khung viên thuốc | **Đổi cm-02 sang khung tròn**. Không hỏi anh | Sổ ý muốn 19/10 (dòng 34) đã trả lời: *"Tôi muốn khung ảnh mặc định để hình tròn và có 1 mẫu để dạng viên thuốc"* — đúng 1 mẫu (shd-11). Bài thử khoá "đúng 1 mẫu viên thuốc" giữ nguyên |
| 2 | Phương án A + 4 đáp án chặng 1 | Giữ như bản vẽ | Nhật ký quyết định thay 26/10 tối |
| 3 | Ghi danh lại dùng lại dòng cũ? | Điều phối đã tra: KHÔNG có đường nào đổi dòng ghi danh về ACTIVE — `enroll.ts:161` luôn tạo dòng mới, chỗ `enrollment.update` duy nhất (`enroll.ts:169`) chỉ đổi sang CANCELLED. Nên trigger chỉ cần `UPDATE OF "seat_no"` như bản vẽ | Đã grep `apps/api/src` 26/10: 1/1 chỗ update là huỷ |
| 4 | Điều kiện cho H-M1 | Bài `ma-so-database.test.ts` thêm 1 ca ghi thẳng: đổi dòng CANCELLED (seat_no NULL) về ACTIVE → phải bị chặn bởi `enrollments_active_seat`; đổi dòng CANCELLED có số đã bị người khác giữ về ACTIVE → phải bị chặn bởi index một phần. Hai ca này giữ cho đường "kích hoạt lại" (nếu sau này ai thêm) không lặng lẽ tạo trùng | Luật 4 (không đường lui im lặng) |
| 5 | Điều kiện cho H-M3 | Đường sửa tay (`PUT …/seat`) khi trùng với người ĐÃ HUỶ thì cho ghi (index một phần), nhưng phản hồi và nhật ký ghi rõ "số này từng của <tên> (đã huỷ)" để tránh hai thẻ cùng số đang lưu hành mà không ai biết | Rủi ro chặng 1 nêu ở phương án C |
| 6 | Điều kiện chung mọi gói | Luật chung thợ 1–12, đặc biệt luật 11 bản sửa 26/10 (tệp khoá đột biến) và luật 12 (chỉ kill PID của mình) | Sổ lỗi 23 biến thể 4 |
| 7 | Thứ tự với bản vẽ khác | H-M1 chỉ vào khi không còn gói nào của G đang mở `schema.prisma` (G đã xong phần dữ liệu). H-T1 giữ `public/mau/chung/mau.js` và `shd-*.html` độc quyền trong lúc chạy | Bản đồ đụng tệp mục 6 |

**Mốc migration:** `20261026200000_ma_so_hoc_vien` (sau `20261019220000_mau_in_hop_dong`, đã tra 26/10). H-M1 tra lại lúc khởi công.
