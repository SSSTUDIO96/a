# Ký duyệt bản vẽ G — Mẫu in hợp đồng

Người ký: điều phối (kiến trúc sư trưởng), 19/10/2026, theo lệnh anh Chiến *"giao cho thợ sắp xếp làm giúp tôi đẩy nhanh tiến độ giúp tôi"*. Anh bác được.

Bản vẽ: `docs/rnd/BAN-VE-G-MAU-IN-HOP-DONG.md` (12 gói, ~75 giờ). **Ký, với các quyết định mục 8:**

| # | Câu hỏi | Quyết | Lý do |
|---|---|---|---|
| 1 | Lưu CCCD + địa chỉ khách | **Chưa lưu** đợt này; bản in để dòng chấm điền tay | Dữ liệu cá nhân nhạy cảm — cần anh quyết riêng (ghi việc tồn) |
| 2 | Mã QR chuyển khoản | Chưa làm đợt này | Cần chọn ngân hàng, chuẩn VietQR — để sau |
| 3 | Quốc hiệu cho hợp đồng dịch vụ | Tắt sẵn (như bản vẽ), bật được | Hợp đồng dịch vụ makeup thường không dùng quốc hiệu |
| 4 | "BẢN NHÁP" trên bản in nháp | Giữ | Tránh khách cầm bản nháp coi như bản ký |
| 5 | Phông Lora + Cormorant (OFL) | Đồng ý; ghi vào `docs/GHI-CHEP-MON-CUA-NGUOI-KHAC.md` | Giấy phép mở |
| 6 | Thử thật iPhone/Android | Chờ anh | — |
| 7 | Ảnh mẫu in ssnew | Chờ anh | — |
| 8 | Tiền bằng chữ "linh" hay "lẻ" | "linh" (mặc định) | Cách viết phổ biến trên chứng từ miền Bắc; đổi một dòng nếu anh muốn "lẻ" |

**Mốc migration:** đổi thành `20261019220000_mau_in_hop_dong` (sau K6 160000, E 200000, F 210000).

**Thứ tự đụng tệp:** `schema.prisma` sau D-M1, E1, F-S1a. Gói G-W5 (`features/contracts/**`) chạy SAU khi gói W3 của bản vẽ D xong và được chấm — hai gói không chạy cùng lúc.
