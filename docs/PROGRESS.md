# Tiến độ — Makeup Pro

Cập nhật: 18/10/2026, ≈17:05 UTC (00:05 ngày 19/10 giờ Việt Nam). **Đã đối chiếu với commit `634d6a3`.** Nguồn: kho, `docs/BAN-GIAO-PHIEN.md`, biên bản nghiệm thu trong `docs/nghiem-thu/`. Điều phối sửa tệp này mỗi khi một mốc đổi trạng thái.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### Ghi tiến độ cho trung thực
| Luật | Vì sao |
|---|---|
| Chỉ dùng: **chưa bắt đầu / đang dựng / xong phần làm, chờ nghiệm thu / đạt có điều kiện / xong** | "Gần xong", "90%" không đo được |
| "Xong" chỉ khi **người khác** nghiệm thu | Người làm luôn thấy việc mình ổn |
| Mỗi dòng chỉ ra được bằng chứng: tệp, bài thử, biên bản, commit | Không có bằng chứng thì coi như chưa |
| Bản lưu "WIP" là bản chụp việc dở, **không** phải đã xong | Lịch sử kho có nhiều bản WIP để không mất việc |
| Cấu hình thiếu ghi rõ ai phải cấp | Việc kẹt vì thiếu khoá hay bị quên đến phút cuối |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Các mốc
| Mốc | Nội dung | Trạng thái | Bằng chứng |
|---|---|---|---|
| 0 | Khảo sát kho cũ, quyết định xây mới | **Xong** | `docs/PROJECT_AUDIT.md` |
| 1 | Bộ tài liệu | **Đang cập nhật** (lỗi N4) | 8 tệp trong `docs/` |
| 2 | Nền móng | **Đạt có điều kiện** (thợ chấm độc lập). Điều kiện T3 đã sửa; N4 đang làm; chờ chấm lại | `docs/nghiem-thu/BIEN-BAN-NGHIEM-THU-MOC-2.md`, `BIEN-BAN-NGHIEM-THU-LAT-1.md` phần 1 |
| 3 | R&D giao diện | Vòng 1–2 **xong**, anh chọn phương án C; bản vẽ thông số C đã ký. Vòng 3 (mẫu chào mừng, mẫu Feedback, đào tạo) **đang chạy** | `docs/rnd/BAN-VE-C.md`, `docs/rnd/BAO-CAO-RND-02.md`, `docs/rnd/v3-*` |
| 4 | Lát 1 — máy chủ (bảng giá, khách + lịch, hợp đồng, nhân sự & tiền công) | **Đạt có điều kiện**; T1, T2, T3, N1–N3, G1–G5 đã sửa; chờ chấm lại | `BIEN-BAN-NGHIEM-THU-LAT-1.md` phần 2 |
| 4 | Lát 1 — web | **Đang dựng.** W0, W1, W2, W3 có mã (bản WIP, chưa nghiệm thu); W4 Bảng giá, W5 Hợp đồng, W6 Lịch, W7 kiểm thử 3 khổ **chưa bắt đầu** | `apps/web/`, `docs/BAN-GIAO-PHIEN.md` |
| 5 | Nghiệm thu lát 1 (cả web) | **Chưa bắt đầu** | — |
| 6 | Trang quản trị nền tảng | Máy chủ **đang dựng** (8 đường trong kho, bài thử chưa lưu); giao diện chưa bắt đầu | `apps/api/src/modules/platform/` |
| 7–9 | Đào tạo: R&D → máy chủ → giao diện | R&D **đang chạy** | `docs/SO-Y-MUON.md` |

### 2. Module
| # | Module | Dữ liệu | Máy chủ | Giao diện | Trạng thái chung |
|---|---|---|---|---|---|
| 1 | Tổ chức, nhân sự, vai trò, đăng nhập | Có | 16 đường | Đăng nhập/đăng ký/tạo tổ chức + khung (WIP) | Máy chủ đạt có điều kiện; web đang dựng |
| 2 | Nhật ký thay đổi | Có | Có (xem nhật ký) | Chưa | Máy chủ đạt có điều kiện; đổi thẻ chưa ghi nhật ký |
| 3 | Bảng giá | Có | 23 đường | W4 chưa bắt đầu | Máy chủ đạt có điều kiện |
| 4 | Khách hàng | Có | 4 đường | Chưa | Máy chủ đạt có điều kiện |
| 5 | Hợp đồng (gồm thợ phụ trách, cảnh báo trùng giờ) | Có | 8 đường | W5 chưa bắt đầu | Máy chủ đạt có điều kiện; phần thợ phụ trách **chưa nghiệm thu** |
| 6 | Lịch makeup | Có | 5 đường | W6 chưa bắt đầu | Máy chủ đạt có điều kiện |
| 7 | Nhân sự & tiền công | Có | 6 + 4 đường | Chưa | Máy chủ đạt có điều kiện; mức rảnh của thợ **chưa nghiệm thu** |
| 8 | Thu tiền + báo cáo doanh thu | Có (đợt thanh toán, phiếu thu) | 0 đường trong kho; 6 đường đang viết | Chưa | **Đang dựng** |
| 9 | Lưu trữ tệp | Có | 3 đường trong kho, bài thử đang viết; cửa gác chưa có mẫu | Chưa | **Đang dựng** |
| 10 | Website giới thiệu | Có (hồ sơ thương hiệu) | 0 đường trong kho; 5 đường đang viết | Chưa | **Đang dựng** |
| 11 | Đào tạo + cổng học viên | Chưa (chỉ có loại lịch "buổi học", vai trò giảng viên) | Chưa | R&D vòng 3 | Chưa bắt đầu phần mã |
| 12 | Thông báo | Chưa | Chưa | Chưa | Chưa bắt đầu, chưa xếp mốc |
| 13 | Thuê bao + quản trị nền tảng | Có (gói, thuê bao, quản trị) | 8 đường | Chưa | Đang dựng (mốc 6) |
| — | App iPhone | — | Dùng chung API | Chưa | Chưa bắt đầu, chưa xếp mốc |

Số đường lấy từ bảng đường ở commit `634d6a3` (77 đường); chi tiết `docs/API_SPEC.md`.

### 3. Cấu hình còn thiếu
| Thiếu | Cần cho | Ai cấp | Trạng thái |
|---|---|---|---|
| Supabase riêng | Database thật, kho tệp | Anh Chiến | Chưa có |
| Railway riêng | Chạy API thật | Anh Chiến | Chưa có |
| Vercel | Chạy web | Anh Chiến | Chưa có; `vercel.json` đang trỏ địa chỉ giả `.invalid` cho tới khi có Railway |
| Tên miền | Web + API cùng tên miền | Anh Chiến | Chưa có |
| Khoá Google Maps | Tính km tự động | Anh Chiến | Chưa có; nhập km tay |
| Cổng thanh toán | Thu tiền online, thuê bao | Anh Chiến | Chưa có |
| Tài khoản Apple Developer | App iPhone | Anh Chiến | Chưa có |
| Quyền đẩy mã lên GitHub | Lưu kho `SSSTUDIO96/a` | Anh Chiến | **Đã có**: anh cài Claude GitHub App cho kho `a`, đã đẩy nhánh `claude/nen-mong-makeup` (17:10 theo `docs/NHAT-KY-QUYET-DINH-THAY.md`) |
| Hồ sơ làm việc trên ổ H:, thư mục phông "auto ss" trên máy anh | Luật làm việc chung; phông viết tay cho mẫu chào mừng | Anh Chiến | Phiên đám mây không đọc được ổ H: |

### 4. Cần anh Chiến quyết
| Việc | Nguồn |
|---|---|
| Phân quyền vai trò mẫu: thợ chính có cần thấy lịch cả đội không | `docs/NHAT-KY-QUYET-DINH-THAY.md` 15:16 |
| Chấp nhận hay sửa: đăng ký báo "email đã được đăng ký" (L8) | `docs/SECURITY.md` mục 3 |
| Có chặn trùng lịch của một thợ giữa hai tổ chức không | `docs/DATABASE_SCHEMA.md` mục 3.5 |
| 6 trường mới R&D đề xuất | `docs/rnd/BAN-VE-C.md` mục 8 |
| Có làm quên mật khẩu, 2FA, xuất/xoá dữ liệu cá nhân trước khi bán | `docs/SECURITY.md` mục 4 |
| Đối chiếu danh sách 13 module với bản yêu cầu gốc | `docs/PRD.md` mục 3 |
