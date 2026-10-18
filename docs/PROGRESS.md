# Tiến độ — Makeup Pro

Cập nhật: 18/10/2026, khoảng 15:40 UTC (22:40 giờ Việt Nam). Người cập nhật: AI (thợ tài liệu). Điều phối sửa tệp này mỗi khi một mốc đổi trạng thái.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### Cách ghi tiến độ cho trung thực
| Luật | Vì sao |
|---|---|
| Chỉ dùng 4 trạng thái: **chưa bắt đầu / đang dựng / xong phần làm, chờ nghiệm thu / xong** | "Gần xong", "90%" không đo được |
| "Xong" chỉ khi có **người khác** nghiệm thu (không phải người làm tự chấm) | Người làm luôn thấy việc mình ổn |
| Mỗi dòng "xong" chỉ ra được bằng chứng: tệp, bài thử, commit | Không có bằng chứng thì coi như chưa |
| Cấu hình thiếu ghi rõ **ai phải cấp** | Việc kẹt vì thiếu khoá thường bị quên đến phút cuối |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Các mốc
| Mốc | Nội dung | Trạng thái | Bằng chứng |
|---|---|---|---|
| 0 | Khảo sát kho cũ, quyết định xây mới | **Xong** | `docs/PROJECT_AUDIT.md` |
| 1 | Bộ tài liệu (PRD, kiến trúc, dữ liệu, API, an ninh, triển khai, kiểm thử, tiến độ) | **Đang viết** | 8 tệp trong `docs/`; các mục bảng giá / hợp đồng / lịch chờ điều phối cập nhật |
| 2 | Nền móng: monorepo, đăng nhập, tổ chức, phân quyền, nhật ký, cấu trúc dữ liệu | **Xong phần làm, đang nghiệm thu độc lập** | Commit `608f3dc`, `7572db8`, `a83d187`, `0c55493`, `af43d6e`, `af80a10`; bài thử ở `docs/TEST_PLAN.md` mục 3 |
| 3 | R&D giao diện | **Đang chạy** | Vòng 1 xong: 3 phương án, ảnh 3 khổ (`docs/rnd/BAO-CAO-RND-01.md`, commit `462c1f0`). Lịch: anh Chiến chọn hiện cả 3 chế độ, mặc định C. Bảng giá: chưa chọn, đang vòng 2 (Bảng giá v2 + Lập hợp đồng) |
| 4 | Lát 1: Bảng giá + Hợp đồng + Lịch makeup | **Đang dựng** | Mã và bài thử đang viết, chưa lưu vào kho (`modules/catalog`, `modules/contracts`, `modules/schedule`) |
| 5 | Nghiệm thu lát 1 | **Chưa bắt đầu** | — |

### 2. Module theo bản yêu cầu
Danh sách module dựng lại từ kho (xem lưu ý ở `docs/PRD.md` mục 3: chưa đối chiếu được với bản yêu cầu gốc).

| # | Module | Dữ liệu (database) | Máy chủ (API) | Giao diện | Trạng thái chung |
|---|---|---|---|---|---|
| 1 | Tổ chức, nhân sự, vai trò, đăng nhập | Có | Có, 16 đường | Chưa | Xong phần máy chủ, đang nghiệm thu |
| 2 | Nhật ký thay đổi | Có | Có (xem nhật ký) | Chưa | Xong phần máy chủ, đang nghiệm thu. Đăng nhập/đăng xuất chưa ghi nhật ký |
| 3 | Bảng giá (gồm nhân vật, dịch vụ phụ, phụ phí, địa điểm, phí di chuyển) | Có | Đang viết | R&D vòng 2 | **Đang dựng** |
| 4 | Khách hàng | Có | Đang viết | Chưa | **Đang dựng** |
| 5 | Hợp đồng | Có | Đang viết | R&D vòng 2 | **Đang dựng** |
| 6 | Lịch makeup | Có | Đang viết | Đã chọn hướng (3 chế độ, mặc định C), chưa có mã | **Đang dựng** |
| — | Hồ sơ thợ, bậc thợ, tiền công theo gói | Migration thứ tư đang viết | Đang viết (`modules/staff`) | Chưa | **Đang dựng**, chưa lưu vào kho; chưa có trong PRD — điều phối xác nhận thuộc module nào |
| 7 | Tài chính | Chưa | Chưa | Chưa | Chưa bắt đầu |
| 8 | Website giới thiệu | Chỉ có cờ "công khai" trên dịch vụ/gói | Chưa | Chưa | Chưa bắt đầu |
| 9 | Đào tạo | Chỉ có loại lịch "buổi học" và vai trò giảng viên | Chưa | Chưa | Chưa bắt đầu |
| 10 | Cổng học viên | Chưa | Chưa | Chưa | Chưa bắt đầu |
| 11 | File | Chưa | Chưa | Chưa | Chưa bắt đầu |
| 12 | Thông báo | Chưa | Chưa | Chưa | Chưa bắt đầu |
| 13 | Thuê bao | Chưa | Chưa | Chưa | Chưa bắt đầu |
| — | App iPhone | — | Dùng chung API | Chưa | Chưa bắt đầu |
| — | Web quản trị (khung chung) | — | — | Đã chọn khung điều hướng (thanh bên trái trên máy tính/máy tính bảng, thanh dưới trên điện thoại), chưa có mã | Chưa bắt đầu phần mã |

### 3. Cấu hình còn thiếu
| Thiếu | Cần cho | Ai cấp | Trạng thái |
|---|---|---|---|
| Supabase riêng cho Makeup Pro | Database thật, lưu file | Anh Chiến | Chưa có |
| Railway riêng cho Makeup Pro | Chạy API thật | Anh Chiến | Chưa có |
| Vercel | Chạy web quản trị, website giới thiệu | Anh Chiến | Chưa có (cũng chưa có web) |
| Tên miền | Web, tên miền con theo từng studio | Anh Chiến | Chưa có |
| Khoá Google Maps | Tính km tự động cho phí di chuyển | Anh Chiến | Chưa có; lát 1 nhập km tay |
| Cổng thanh toán | Module tài chính, thuê bao | Anh Chiến | Chưa có |
| Tài khoản Apple Developer | App iPhone | Anh Chiến | Chưa có |
| Quyền đẩy mã lên GitHub | Lưu mã lên kho `SSSTUDIO96/a` trên GitHub | Anh Chiến (cài Claude GitHub App) | Chưa có. Anh đã cho phép, nhưng GitHub vẫn chặn vì chưa cài app (`docs/SO-Y-MUON.md`). Mã hiện chỉ lưu trong kho trên máy đám mây |
| Hồ sơ làm việc của anh Chiến (`H:\Code\HO-SO-LAM-VIEC-CHIEN.md`) | Luật làm việc chung | Anh Chiến | Phiên đám mây không mở được ổ H:; đề xuất chép vào kho (`docs/SO-Y-MUON.md`) |

### 4. Cần anh Chiến quyết
| Việc | Nguồn |
|---|---|
| Phân quyền vai trò mẫu: thợ chính có cần thấy lịch cả đội không | `docs/NHAT-KY-QUYET-DINH-THAY.md` dòng 15:16 |
| Chọn phương án giao diện Bảng giá (sau R&D vòng 2) | `docs/NHAT-KY-QUYET-DINH-THAY.md` dòng 15:24 |
| Có chặn trùng lịch của một thợ giữa hai tổ chức khác nhau không | `docs/DATABASE_SCHEMA.md` mục 3.5 |
| Thứ tự các lát sau lát 1 | `docs/PRD.md` mục 4 |
| Có làm quên mật khẩu, 2FA, xuất/xoá dữ liệu cá nhân trước khi bán cho studio khác không | `docs/SECURITY.md` mục 4 |
| Đối chiếu danh sách 13 module với bản yêu cầu gốc | `docs/PRD.md` mục 3 |
