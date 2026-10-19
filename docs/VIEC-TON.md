# Việc tồn — đã biết, chưa làm

Danh sách việc các thợ, thợ chấm và R&D đã nêu nhưng **chưa làm** trong đợt này. Mỗi dòng ghi ai nêu và chỗ cần anh Chiến quyết. Điều phối cập nhật khi việc được làm hoặc bị bỏ.

## Cần anh Chiến quyết

| # | Việc | Ai nêu | Ghi chú |
|---|---|---|---|
| 1 | Cách anh vào thao tác thật: chạy trên máy anh, hay cho phép đưa lên Vercel/Railway | điều phối | Phát hành phải chờ anh (luật 10) |
| 2 | Lịch mới tạo mặc định "Nháp" (không giữ giờ thợ) hay "Đã xác nhận" | thợ Lịch | Đang giữ "Nháp" như máy chủ |
| ~~3~~ | (đã làm 19/10, thợ K3: 12 nhân vật đầu khác màu) Nhân vật thứ 7 trở đi dùng lại 6 màu — có thêm màu không, màu nào | thợ Lịch | Ví dụ "Bà nội" trùng màu "Cô dâu" |
| 4 | Thêm trường "loại sự kiện" (ăn hỏi, cưới, tiệc…) để tô màu ca theo sự kiện | điều phối | Hiện tô theo nhân vật |
| 5 | Giảng viên xem mọi lớp hay chỉ lớp mình dạy | R&D 3 | Đang cho xem mọi lớp |
| ~~6~~ | ~~Sinh buổi học lên Lịch~~ — **đã làm** 19/10 (thợ K2): nút "Đưa lên Lịch" ở thẻ lớp | R&D 3 | |
| ~~7~~ | ~~Mẫu chào mừng thứ 20~~ — **đã làm** 19/10 (thợ K3, shd-11) | R&D 3 | |
| 8 | Tổ chức bị khoá: chặn hẳn (hiện tại) hay chỉ cho đọc | thợ màn quản trị | Hết hạn quá ân hạn thì chỉ đọc; khoá thì chặn hẳn |
| 9 | Phông chữ ký: chọn MP Chữ ký 1–4, và tải phông SS-Album lên | R&D 3 | Đang dùng phông OFL tạm |
| 10a | Áp giới hạn gói cước (số thành viên, lịch mỗi tháng, dung lượng) — hiện chỉ áp khoá học và học viên. Gói Dùng thử đang cho 1 thành viên, 0 khoá học | thợ chấm cuối T2, T3 | Việc thương mại của anh (luật 15) |
| 10b | Gói vừa tạo có tự "hiện trên trang công khai" không — hiện mặc định tắt, xuất bản xong trang chưa có bảng giá | thợ chấm cuối L5 | Đang giữ tắt |
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
| ~~30~~ | ~~`src/api/types.ts` chưa khai `phoneHidden`, `totalsOverflow`, tổng `null`~~ — **đã làm** 19/10 (W-HDKH, W-PP; commit 745f454, 6a6df30) | thợ Thu tiền |
| 31 | DateInput/MoneyInput nhận `ref`; DateInput có giới hạn ngày min/max | thợ Thu tiền |
| 32 | Máy chủ: `GET /contracts` trả `paid`, `remaining`; lọc "chưa có ngày sự kiện"; phiếu thu có `installmentId`, tài khoản nhận, người thu; xuất CSV sổ thu ở máy chủ | thợ Thu tiền |
| 33 | Dịch vụ phụ có bật "công khai" hiện cả trên trang giới thiệu — anh xác nhận giữ hay chỉ hiện gói | thợ Thương hiệu |
| 34 | Thẻ `og:` cho Zalo/Facebook in sẵn từ máy chủ; đặt `VITE_PUBLIC_SITE_ORIGIN` trên Vercel | thợ Thương hiệu |
| 35 | `GET /staff` trả ngày vào studio ("tham gia …") và tên vai trò | thợ Nhân sự |
| 36 | src/ui thêm IconSearch, IconGrip, ô tìm có kính lúp, hộp thoại tự đổi Dialog/ngăn kéo đáy theo khổ (nay đang dựng tạm trong features/staff) | thợ Nhân sự |
| 37 | Web: quản trị gửi `replaceCurrent` khi cố ý cắt kỳ, hiện `renewedUntil` (phần tổng null / `phoneHidden` đã làm 19/10) | thợ O |
| 38 | Thuê bao: đổi sang mô hình "dòng mới cắt kỳ cũ" để database chặn chồng thời gian bằng EXCLUDE | thợ O |
| ~~39~~ | ~~Lỗi khoá ngoại ra 500~~ — **đã làm** 19/10 (thợ U, commit 2f362c9): P2003 và 23503 đều ra 400 | thợ G2 |
| 40 | Phụ phí cũ đang mang số phút giả (1 phút do web cũ gửi) — chủ tự xoá trong hộp sửa dịch vụ, máy chủ không tự đổi | thợ V |
| 41 | Xoá bản ghi còn được tham chiếu nay ra 400 "không tìm thấy dữ liệu liên quan"; muốn báo 409 "đang được dùng" thì đường xoá phải tự kiểm trước | thợ U |
| 42 | Màn lập hợp đồng khoá học chưa có ô "Lý do giảm" (máy chủ chưa có trường) và chưa đổi "Người phụ trách" sau khi tạo (PATCH chưa nhận) | thợ W-HDKH |
| 43 | Hợp đồng đã xác nhận cũ có dòng thiếu giờ: máy chủ đã nhận tạo ca gắn đúng dòng (`contractLineId`), nhưng form Lịch trên web chưa gửi trường này — hiện chỉ sửa được bằng huỷ dòng + thêm phát sinh (giá lấy theo bảng giá hiện hành) | thợ Y1 |
| 44 | Thông báo "Máy chủ đang bận" (khi bị giới hạn lượt gọi) vẫn là chữ trần | thợ Y3 |
| 45 | Màn Tạo tổ chức: lỗi dưới ô chỉ tính lại khi bấm gửi, chọn xong loại tổ chức chữ đỏ vẫn còn | thợ Y3 |
| 46 | Mẫu shd-03: chữ "THÁNG 11" đè lên số "03" (có từ trước) | thợ Y4 |
| 47 | Ô chọn loại tổ chức dựng riêng trong auth.css vì `Segmented` không dùng `<label>` — nên thống nhất vào src/ui | thợ Y3 |
| 48 | Màu ảnh đại diện thợ mới đi qua hàm chung ở Lịch và Hợp đồng (4/13 chỗ); màn Thợ makeup, Khoá & lớp, Tiền công theo gói, thanh bên vẫn băm màu thẳng — hai thợ cùng chữ tắt có thể trùng màu ở các màn đó | thợ V2 |
| 49 | Hai màu ảnh đại diện nâu và nâu xám gần nhau, nên xem lại bảng màu trong ui.css | thợ V2 |
| 50 | Trang công khai lưu đệm 60 giây: tắt nhân vật xong, khách có thể còn thấy bản cũ tối đa 60 giây (web vẫn chặn gói đó) | thợ V1 |
| 51 | Lịch chế độ B trục giờ cố định 04:00–18:00: ca từ 18:00 (buổi học tối) không hiện trên thanh "Thợ trong ngày" | thợ K2 |
| 52 | Buổi học dùng chung nhãn nút trạng thái với ca makeup ("Bắt đầu làm", "Khách không đến") | thợ K2 |
| 53 | Lưu CCCD và địa chỉ khách để in lên hợp đồng (dữ liệu cá nhân) — anh quyết | bản vẽ G |
| 54 | Mã QR chuyển khoản (VietQR) trên bản in hợp đồng | bản vẽ G |
| 55 | Mã số trên thẻ chào mừng (anh 19/10): lưu mã ở học viên trong lớp, tự cấp theo thứ tự ghi danh (01, 02…), sửa tay được, không trùng trong một lớp; thẻ chào mừng hiện mã; sau này màn sắp ghế/vị trí dùng mã này | bản vẽ mới sau D-M1 (đụng schema.prisma, xếp hàng sau G-M1) |
| 56 | Cài lên màn hình iPhone (chế độ toàn màn hình): khung app chưa chừa tai thỏ ở đỉnh (`env(safe-area-inset-top)`); trang ngoại tuyến đã chừa. Chưa thử iPhone thật | thợ E-W1 báo, làm cùng W3 |
| 57 | Biểu tượng app: nhân viên = cây bút trắng nền đỏ mận, học viên = mũ cử nhân nền xanh ngọc (lệch bản vẽ E ghi chữ "M"/"HV") — anh xem lại | thợ E-W1 |
| 58 | (Chấm lần 5 T2) Dữ liệu cũ của lỗi N1: ca của dòng đã huỷ TRƯỚC bản sửa F1 vẫn "Đã xác nhận" và Lịch còn nhắc "Phân thợ". Bản sửa không có bước dọn dữ liệu cũ. Trước khi dùng dữ liệu thật phải chạy câu đếm chỉ-đọc trong docs/nghiem-thu/BIEN-BAN-NGHIEM-THU-LAN-5.md; có dòng thì cần anh cho phép dọn | chấm lần 5 |
| 59 | (Chấm lần 5 L1) Bài thử chống dò quên mật khẩu cho chênh 100 ms nên không canh được mức sàn 300 ms (apps/api/test/dat-lai-mat-khau.test.ts:100-120) | chấm lần 5 |
| 60 | (L2) Buổi học 18:00/18:30 bị xếp nhóm "Buổi chiều" (apps/web/src/features/schedule/model.ts:463-470) | chấm lần 5 |
| 61 | (L3) Lớp chưa có giảng viên mà hộp vẫn ghi "giữ giờ của giảng viên" (SessionSyncDialog.tsx:128) | chấm lần 5 |
| 62 | (L4) Hộp báo trùng giờ chỉ ghi mã lịch, không nói buổi học của lớp nào | chấm lần 5 |
| 63 | (L5) 390px: chữ "2 giờ" trong chi tiết buổi học bị tách dòng | chấm lần 5 |
| 64 | (L6) 5 tệp .bat hiện "đã sửa" ngay sau khi lấy mã (chỉ khác CRLF) — xem lại .gitattributes | chấm lần 5 |
| 65 | apps/api/src/scripts/run-sync-system-roles.ts:11 chưa in `occasionSetsSeeded` (giá trị đã có trong báo cáo, chỉ thiếu dòng in) | thợ M3 → giao M7/D1 |
