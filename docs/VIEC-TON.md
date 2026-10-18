# Việc tồn — đã biết, chưa làm

Danh sách việc các thợ, thợ chấm và R&D đã nêu nhưng **chưa làm** trong đợt này. Mỗi dòng ghi ai nêu và chỗ cần anh Chiến quyết. Điều phối cập nhật khi việc được làm hoặc bị bỏ.

## Cần anh Chiến quyết

| # | Việc | Ai nêu | Ghi chú |
|---|---|---|---|
| 1 | Cách anh vào thao tác thật: chạy trên máy anh, hay cho phép đưa lên Vercel/Railway | điều phối | Phát hành phải chờ anh (luật 10) |
| 2 | Lịch mới tạo mặc định "Nháp" (không giữ giờ thợ) hay "Đã xác nhận" | thợ Lịch | Đang giữ "Nháp" như máy chủ |
| 3 | Nhân vật thứ 7 trở đi dùng lại 6 màu — có thêm màu không, màu nào | thợ Lịch | Ví dụ "Bà nội" trùng màu "Cô dâu" |
| 4 | Thêm trường "loại sự kiện" (ăn hỏi, cưới, tiệc…) để tô màu ca theo sự kiện | điều phối | Hiện tô theo nhân vật |
| 5 | Giảng viên xem mọi lớp hay chỉ lớp mình dạy | R&D 3 | Đang cho xem mọi lớp |
| 6 | Sinh buổi học lên Lịch theo lịch học của lớp | R&D 3 | Chưa làm |
| 7 | Mẫu chào mừng thứ 20 | R&D 3 | Đang có 19 |
| 8 | Tổ chức bị khoá: chặn hẳn (hiện tại) hay chỉ cho đọc | thợ màn quản trị | Hết hạn quá ân hạn thì chỉ đọc; khoá thì chặn hẳn |
| 9 | Phông chữ ký: chọn MP Chữ ký 1–4, và tải phông SS-Album lên | R&D 3 | Đang dùng phông OFL tạm |
| 10 | "ssnew" — gửi ảnh màn trả lương của ssnew để so | R&D 2 | Màn tiền công đang dựng theo lời anh tả |

## Máy chủ

| # | Việc | Ai nêu |
|---|---|---|
| 11 | Đường đổi thứ tự nhân vật một lần (`PUT /makeup-subjects/order`) | thợ Bảng giá |
| 12 | Đường liệt kê đợt chưa thu của mọi hợp đồng (hàng đợi "Quá hạn / 7 ngày tới") | R&D 2 |
| 13 | `/auth/me` trả cả tổ chức đang bị khoá kèm trạng thái, để web báo "đang tạm khoá" thay vì đưa sang "Tạo tổ chức" | thợ màn quản trị |
| 14 | Quản trị nền tảng: cờ `isPlatformAdmin`, số tổ chức dùng mỗi gói, lý do khoá, nhật ký thao tác, tiền đã thu thật | R&D 2 mục 5.8 |
| 15 | Lọc "đang trong ân hạn" ở danh sách tổ chức | thợ màn quản trị |
| 16 | Xoá vật lý tệp đã xoá mềm và tệp mồ côi (việc chạy định kỳ) | thợ B |
| 17 | Thử driver S3 với dịch vụ thật (Supabase/AWS) | thợ B |
| 18 | Đo `TRUST_PROXY_HOPS` thật sau Vercel → Railway | thợ C, thợ chấm |
| 19 | Đặt lại mật khẩu qua email (thẻ một lần, nhà cung cấp email) | thợ H |
| 20 | Giá chốt lúc ký trên dòng thuê bao (doanh thu không đổi khi sửa giá gói) | thợ H |
| 21 | Database chặn: tổng phiếu thu ≤ tổng hợp đồng; tổng các đợt = tổng hợp đồng; thợ trùng lịch giữa hai tổ chức | thợ C |
| 22 | Lời báo của trigger database hiện nguyên văn cho người dùng (có thể lộ số nội bộ) | thợ C |
| 23 | Đổi thẻ đăng nhập thành công chưa ghi nhật ký (phần còn lại của L11) | thợ C |
| 24 | Ảnh minh chứng phiếu thu, nhắc hạn đợt, ô "khách đồng ý đăng ảnh" | R&D 3 |

## Web

| # | Việc | Ai nêu |
|---|---|---|
| 25 | Hộp thoại cỡ nhỏ trên điện thoại chưa giới hạn chiều cao; chưa có cỡ 600/640 | thợ màn quản trị |
| 26 | Bài khớp hai đầu chưa có module quản trị nền tảng | thợ màn quản trị |
| 27 | Chế độ tối | R&D 2 |
| 28 | Màn Thành viên & vai trò | R&D 2 |
| 29 | Huỷ riêng từng dịch vụ phụ trong hợp đồng đã xác nhận | thợ Hợp đồng |
| 30 | `src/api/types.ts` chưa khai `customer.phoneHidden`, `totalsOverflow`, tổng `null` khi vượt ngưỡng ở thu tiền (máy chủ đã trả) | thợ Thu tiền |
| 31 | DateInput/MoneyInput nhận `ref`; DateInput có giới hạn ngày min/max | thợ Thu tiền |
| 32 | Máy chủ: `GET /contracts` trả `paid`, `remaining`; lọc "chưa có ngày sự kiện"; phiếu thu có `installmentId`, tài khoản nhận, người thu; xuất CSV sổ thu ở máy chủ | thợ Thu tiền |
| 33 | Dịch vụ phụ có bật "công khai" hiện cả trên trang giới thiệu — anh xác nhận giữ hay chỉ hiện gói | thợ Thương hiệu |
| 34 | Thẻ `og:` cho Zalo/Facebook in sẵn từ máy chủ; đặt `VITE_PUBLIC_SITE_ORIGIN` trên Vercel | thợ Thương hiệu |
| 35 | `GET /staff` trả ngày vào studio ("tham gia …") và tên vai trò | thợ Nhân sự |
| 36 | src/ui thêm IconSearch, IconGrip, ô tìm có kính lúp, hộp thoại tự đổi Dialog/ngăn kéo đáy theo khổ (nay đang dựng tạm trong features/staff) | thợ Nhân sự |
| 37 | Web: hiện `totalsOverflow`/tổng null ở sổ thu–báo cáo; `phoneHidden`; quản trị gửi `replaceCurrent` khi cố ý cắt kỳ, hiện `renewedUntil` | thợ O |
| 38 | Thuê bao: đổi sang mô hình "dòng mới cắt kỳ cũ" để database chặn chồng thời gian bằng EXCLUDE | thợ O |
