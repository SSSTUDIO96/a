# Tiến độ — Makeup Pro

Cập nhật: 19/10/2026 (giờ Việt Nam). **Đã đối chiếu với commit `0802ee0` và biên bản `docs/nghiem-thu/BIEN-BAN-NGHIEM-THU-LAI.md` (chấm trên `d417acf`).** Điều phối sửa tệp này mỗi khi một mốc đổi trạng thái.

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
| 1 | Bộ tài liệu | **Đang cập nhật** theo mã | `docs/` |
| 2 | Nền móng (tổ chức, phân quyền, cách ly dữ liệu giữa studio) | **Xong** — cửa gác cách ly phủ 114 đường, 10 phép xanh, chấm lại độc lập trên `d417acf` | `docs/nghiem-thu/BIEN-BAN-NGHIEM-THU-LAI.md` mục 1 |
| 3 | R&D giao diện + đào tạo | **Xong** — phương án C; bản vẽ C, C2, C3 đã ký | `docs/rnd/` |
| 4 | Lát 1 máy chủ + web: bảng giá, khách, hợp đồng, lịch, nhân sự & tiền công | **Xong** (thợ chấm độc lập) — còn lỗi nhẹ đang sửa | `BIEN-BAN-NGHIEM-THU-CUOI.md`, `BIEN-BAN-NGHIEM-THU-LAI.md` |
| 5 | Thu tiền, báo cáo doanh thu, thương hiệu + trang giới thiệu công khai | **Xong** (thợ chấm độc lập) | như trên |
| 6 | Trang quản trị nền tảng | **Xong** (thợ chấm độc lập); giới hạn gói chỉ áp cho khoá học/học viên — chờ anh quyết | như trên, `docs/VIEC-TON.md` 10a |
| 7–9 | Đào tạo: khoá & lớp, hợp đồng khoá học, bản in, thu tiền, thống kê, mẫu thiết kế (chào mừng, Feedback, lời chúc) | **Xong** (thợ chấm độc lập) | như trên |
| 10 | Chạy thật: trên máy anh hoặc đưa lên Vercel/Railway | **Chờ anh quyết.** Hướng dẫn chạy trên máy: 12/13 bước đã chạy thật trên Linux, bước cài phần mềm Windows chưa thử | `docs/CHAY-THU-TREN-MAY.md`, `docs/DEPLOYMENT.md` |

### 2. Số đo lần chấm gần nhất (thợ chấm độc lập, commit `d417acf`)
| Phần | Số đo |
|---|---|
| Máy chủ | 597/597 bài (48 tệp); cửa gác: scope/outsider/noPerms/keep 99/99, unauth 109/109, crossId 50/50, leak 40/40, refBase 45/45, crossRef 107/107, platform 40/40 |
| Web | 850/850 bài, chạy 3 lần không bài chập chờn; khớp hai đầu 14/14 + 6/6; build xanh; tệp vào 360 KB |
| Thao tác thật | tràn ngang 0/90 (30 màn × 3 khổ); 111 nút bấm, 0 nút chết; tiền khớp giữa màn, báo cáo và database |
| Sau lần chấm | `0802ee0`: lệnh chạy thử tự đọc `.env` — máy chủ 601/601 (thợ Z2, chưa chấm độc lập) |

Module chưa làm: thông báo, cổng học viên tự đăng nhập, app iPhone, buổi học lên lịch (`docs/VIEC-TON.md`).

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
