# Báo cáo R&D 03 — Trung tâm đào tạo

- Sản phẩm: Makeup Pro
- Người đọc: anh Chiến
- Ngày: 18/10/2026
- Chặng: 1 — bày phương án có ảnh, **chưa dựng thông số**, chưa đưa vào app.

---

## 1. Kết luận

**Đề xuất màn hình: phương án C.**
- Hai cột, giống màn Lập hợp đồng C anh đã chọn:
  - cột trái: danh mục khoá, hàng đợi cần thu hoặc bộ lọc;
  - cột phải: việc đang làm.
- Hợp đồng khoá học và hợp đồng dịch vụ makeup sẽ có cùng một khuôn.

**Đề xuất hướng mẫu thẻ: "Sang trọng hiện đại"** (10 mẫu, mã `shd-01` → `shd-10`).
- Hướng này ghép chữ có chân với chữ viết tay, trên nền kem, đen vàng, xanh rêu hoặc xanh than.
- Đây là hướng anh nhắc tới trong 2 tin nhắn gần nhất.
- Anh chọn từng mẫu trên trang bày: /home/user/a/docs/rnd/v3-bay-mau.html

**Mẫu Feedback:** có 10 mẫu, mã `fb-01` → `fb-10`.
- Người dùng dán lời khen, tải lên 1–3 ảnh.
- Logo, tên thương hiệu, tên khoá hoặc dịch vụ và ngày được lấy từ dữ liệu.
- Có nút "Sao chép nội dung".

**Phông viết tay hiện là phông tạm**, giấy phép SIL OFL 1.1.
- Kho "SS-Album" (`H:\build_2_5_2d\src\dist\qt_studio_full\SS-Album\_internal\font_nguon`) nằm trên máy anh, phiên làm việc trên mây không mở được.
- Khi anh tải phông lên, chỉ cần thay ở **một tệp**: /home/user/a/docs/rnd/v3-mau-chao-mung/phong/phong.css

**Số mẫu chào mừng hiện có: 19/20.**
- Đợt 1: 9 mẫu (3 hướng × 3).
- Đợt 2: 10 mẫu sang trọng hiện đại.
- Còn thiếu 1 mẫu để đủ 20 theo yêu cầu đầu.

**Cần anh duyệt — thanh dưới điện thoại.** Ba phương án vòng này dùng: **Lịch · Hợp đồng · Thu tiền · Khoá học · Thêm**.
- Bản vẽ C mục 2.3 đang ghi: Lịch · Hợp đồng · Bảng giá · Khách · Thêm.
- Nếu anh đồng ý đổi, "Bảng giá" và "Khách" chuyển vào "Thêm".

## 2. Cách xem

Mở bằng trình duyệt, không cần mạng. Thêm `#…` vào cuối đường dẫn để mở đúng màn.

| Tệp | Các màn |
|---|---|
| /home/user/a/docs/rnd/v3-dao-tao-A.html | `#khoa-hoc`, `#khoa-hoc-ct`, `#hop-dong`, `#hop-dong-in`, `#thu-tien`, `#thu-tien-ct`, `#thong-ke`, `#the-chao`, `#feedback` |
| /home/user/a/docs/rnd/v3-dao-tao-B.html | `#khoa-hoc`, `#khoa-hoc-ct`, `#hop-dong-b1` → `#hop-dong-b2` → `#hop-dong` (bước 3) → `#hop-dong-b4`, `#thu-tien`, `#thu-tien-ct`, `#thu-tien-ghi`, `#thong-ke`, `#the-chao`, `#feedback` |
| **/home/user/a/docs/rnd/v3-dao-tao-C.html** (đề xuất) | `#khoa-hoc`, `#khoa-hoc-ct`, `#khoa-hoc-mo` (hộp sửa khoá), `#hop-dong`, `#hop-dong-in` (hộp xem bản in), `#thu-tien`, `#thu-tien-ct`, `#thong-ke`, `#the-chao`, `#feedback` |
| **/home/user/a/docs/rnd/v3-bay-mau.html** | Trang bày 10 mẫu chào mừng + 10 mẫu Feedback để anh chọn (có nút đổi khổ 1080×1350 / 1080×1080) |
| /home/user/a/docs/rnd/v3-mau-chao-mung/ | 9 mẫu đợt 1 (`sang-trong-1..3`, `pastel-1..3`, `tap-chi-1..3`) + 10 mẫu `shd-01..10`. Mỗi mẫu là một tệp `.html` tự điền dữ liệu, kèm ảnh `.png` |
| /home/user/a/docs/rnd/v3-mau-feedback/ | 10 mẫu `fb-01..10` (.html + .png) |

Thay dữ liệu trên mẫu bằng tham số đường dẫn.
- Ví dụ: `shd-01.html?ten=Quỳnh Như&khoa=Trang điểm cá nhân&kho=vuong`
- Danh sách khoá ở /home/user/a/docs/rnd/v3-mau-chao-mung/chung/mau.js

## 3. Ảnh chụp

**Màn hình.** Mỗi màn chính có 3 khổ: máy tính 1440, máy tính bảng 1024, điện thoại 390.
- Tên tệp: /home/user/a/docs/rnd/anh/v3-dao-tao-{A,B,C}-{khoa-hoc,hop-dong,thu-tien,thong-ke,the-chao,feedback}-{desktop,tablet,mobile}.png
- Màn phụ:
  - A: `…-A-hop-dong-in-desktop`, `…-A-khoa-hoc-ct-mobile`, `…-A-thu-tien-ct-mobile`
  - B: `…-B-hop-dong-b1/b2/b4-{desktop,mobile}`, `…-B-khoa-hoc-ct-…`, `…-B-thu-tien-ct-…`, `…-B-thu-tien-ghi-…`
  - C: `…-C-khoa-hoc-ct-mobile`, `…-C-thu-tien-ct-mobile`, `…-C-khoa-hoc-mo-{desktop,mobile}`, `…-C-hop-dong-in-{desktop,mobile}`

**Mẫu thẻ.**
- Đợt 2 xuất 2 khổ đăng mạng: `…-1080x1350.png` và `…-1080x1080.png`.
- Đợt 1 có 2 khổ: `-vuong.png` 1080×1080 và `-doc.png` 1080×1920.

**Ảnh tổng hợp:**
- /home/user/a/docs/rnd/anh/v3-mau-sang-trong-hien-dai-tong-hop.png
- /home/user/a/docs/rnd/anh/v3-mau-feedback-tong-hop.png
- /home/user/a/docs/rnd/anh/v3-mau-chao-mung-dot1-tong-hop.png
- /home/user/a/docs/rnd/anh/v3-bay-mau-{desktop,mobile}.png (trang bày mẫu)

**Phông:**
- /home/user/a/docs/rnd/anh/v3-phong-viet-tay-thu-dau-48px.png — 29 phông, chuỗi thử cỡ 48px.
- /home/user/a/docs/rnd/anh/v3-phong-viet-tay-can-canh.png — cận cảnh dấu.
- /home/user/a/docs/rnd/anh/v3-phong-dang-dung.png — 7 phông đang dùng trong mẫu.

**Kiểm tra đã làm.**
- R&D đã mở xem từng ảnh. Các chỗ vỡ đã sửa:
  - B: số tiền trong thẻ thu tiền dính nhau → đổi sang lưới 2×2.
  - Chữ trục biểu đồ trên điện thoại quá nhỏ → thêm biểu đồ khổ hẹp riêng.
  - Ảnh mẫu bị cắt ở thẻ chào mừng.
  - Nút "Cách trả" tràn trong ngăn kéo điện thoại.
  - A: 4 ô số tràn ngang trong chi tiết thu tiền trên điện thoại.
  - C: cột thống kê bị bóp còn 230px trên điện thoại.
  - Một số mẫu feedback: chữ dính vào dòng tên khi nội dung dài.
- Đã thử mọi mẫu với tên ngắn ("Quỳnh Như") và lời khen dài 387 ký tự. Chữ tự co, không tràn.

## 4. Học từ Studio Pro (đọc mã, không sửa)

Repo: /tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/repos/ssaas

| Điều thấy | Ở đâu | Dùng thế nào |
|---|---|---|
| Phiếu thu có: ngày, số tiền, cách trả, người nhận tiền (`recipientId`), ghi chú, ảnh minh chứng (`proofImageUrl`) | `types/api.types.ts` dòng 240–248 | Phiếu thu của mình có: ngày thu, số tiền, cách trả, vào tài khoản, người thu, ghi chú |
| **Ảnh minh chứng là bắt buộc**: thiếu thì báo "Vui lòng tải lên ảnh xác thực giao dịch (Bắt buộc)" | `pages/contracts/components/PaymentManagementModal.tsx` dòng 165–168 | Anh chưa yêu cầu nên **không vẽ**; ghi vào mục 11 (đề xuất) |
| Có chế độ hoàn tiền | cùng tệp, `isRefundMode` dòng 70, 178 | Máy chủ mình đã có `PaymentKind.REFUND`; chưa vẽ màn hoàn |
| Tiến độ thanh toán là các bước: theo %, số tiền, hoặc "phần còn lại". Hạn gắn với ngày của hợp đồng (`relatedDateKey`: ngày tạo, ngày chụp, ngày cưới…) | `utils/financialUtils.ts` dòng 360–390 | Nút "Chia gợi ý Cọc + 1/2/3". Hạn đợt "Khai giảng" lấy ngày khai giảng của lớp |
| **Khi in, điều khoản được đọc trực tiếp từ Cài đặt** (`contractConfig.terms`) → sửa cài đặt thì hợp đồng cũ in ra cũng đổi | `pages/contracts/components/print/PrintableContract.tsx` dòng 497 | Mình làm ngược lại: bấm Xác nhận thì **chụp** điều khoản + nội quy vào hợp đồng. Màn có dòng giải thích có biểu tượng khoá |
| Trang Tài chính chia "Thực tế / Dự kiến" và có ô "Lợi nhuận thực tế (Trong kỳ)" = thu − chi | `pages/financials/components/FinancialDetailContent.tsx` dòng 278, 288; ảnh /home/user/a/docs/rnd/tham-chieu/studio-pro-tai-chinh-1440.png | Mình **không gọi tiền thu là lợi nhuận**. Chỉ có: Doanh số, Cọc phải thu, Đã thu thực tế, Còn lại; thêm "thực thu trong tháng" theo ngày phiếu thu |

## 5. Phần mềm quản lý trung tâm ở Việt Nam

**Giới hạn.**
- Công cụ đọc trang (WebFetch) bị lỗi DNS.
- Trình duyệt tự động không vào được các trang này.
- R&D **chỉ đọc được đoạn trích của công cụ tìm kiếm**, chưa mở được trang nào.
- Không ghi tính năng nào mà đoạn trích không nói rõ.

| Nguồn | Đoạn trích nói gì |
|---|---|
| Halozend — phần mềm thu học phí: https://www.behance.net/phanmemthuhocphi/info | Phần mềm thu học phí cho trung tâm (chỉ có mô tả chung) |
| MISA AMIS giáo dục: https://amis.misa.vn/giai-phap/giao-duc-va-dao-tao/ | Giải pháp quản lý cho đơn vị giáo dục, đào tạo |
| MISA SME giáo dục: https://sme.misa.vn/giao-duc-dao-tao/ | Kế toán học phí theo khối lớp; có khái niệm "doanh thu chưa thực hiện" (tiền thu trước khi dạy) |
| MISA EMIS: https://emis.misa.vn/emisconglap/en/ | Quản lý trường ngoài công lập |
| Teach 'n Go (có trang tiếng Việt): https://www.teachngo.com/language-pages/vietnamese | Phần mềm quản lý trung tâm ngôn ngữ |
| Myspa (App Store): https://apps.apple.com/app/id1458962203 | Quản lý spa, thẩm mỹ |
| EnvisionNow — trường làm đẹp (nước ngoài): https://envisionnow.com/specialty/beauty-school-software | Phần mềm cho trường đào tạo làm đẹp |
| QuanLyHocVien (đồ án sinh viên, GitHub): https://github.com/chidokun/QuanLyHocVien | Mã nguồn quản lý học viên đơn giản |

**Điều rút ra.**
- Ý "doanh thu chưa thực hiện" của MISA SME khớp với việc tách **Doanh số** (ký hợp đồng) và **Đã thu**.
- Chưa nguồn nào xác nhận rõ tính năng thu theo đợt hoặc nhắc nợ. Mục này coi như **chưa khảo sát được**.

## 6. Ba phương án màn hình

**Phương án A — một trang, bảng và ngăn chi tiết bên phải**
- Màn:
  - Khoá: danh sách gọn theo nhóm, chi tiết khoá mở ở ngăn phải.
  - Hợp đồng: tất cả trên một trang.
  - Thu tiền: bảng tất cả hợp đồng, 4 ô số tổng; dưới bảng là chi tiết kèm form phiếu thu.
  - Thống kê: bảng xoay Nhóm → khoá → hợp đồng.
  - Thẻ và Feedback: ảnh nhỏ bên trái, xem trước và ô điền bên phải.
- Mạnh: nhìn được nhiều cùng lúc; hợp người quen Excel.
- Yếu: trang hợp đồng dài; trên điện thoại phải biến bảng thành thẻ.
- Hợp với: chủ trung tâm ngồi máy tính làm sổ sách.

**Phương án B — thẻ và các bước**
- Màn:
  - Khoá: thẻ theo nhóm.
  - Hợp đồng: 4 bước (Loại & học viên → Khoá & lớp → Học phí & tiến độ → Điều khoản & xác nhận), có ô tóm tắt bên phải.
  - Thu tiền: lưới thẻ hợp đồng, mỗi thẻ có thanh đã thu và vạch mức cọc.
  - Thống kê: ô số, biểu đồ, danh sách nhóm có thanh.
- Mạnh: người mới làm theo từng bước; đẹp trên điện thoại.
- Yếu: phải bấm nhiều lần; khó so sánh nhiều hợp đồng; khuôn khác Hợp đồng C.
- Hợp với: nhân viên tư vấn mới, làm trên điện thoại.

**Phương án C — hai cột như Hợp đồng C (đề xuất)**
- Màn:
  - Khoá: danh mục bên trái, khoá đang chọn bên phải, có "Lịch khai giảng" theo lớp. Mỗi lớp ghi ai dạy, khi nào, ở đâu, sĩ số, kèm nút "Ghi danh". Sửa khoá trong hộp thoại.
  - Hợp đồng: bên trái chọn loại Khoá học/Dịch vụ, rồi chọn khoá (hiện lớp còn chỗ). Bên phải là hợp đồng. Xem bản in trong hộp thoại.
  - Thu tiền: hàng đợi "Cần thu" bên trái (Quá hạn / 7 ngày tới / Sau đó / Đã thu đủ). Bên phải là chi tiết, các đợt và form phiếu thu.
  - Thống kê: bộ lọc bên trái (kỳ, loại, nhóm khoá), số liệu bên phải.
  - Thẻ và Feedback: 3 cột (hướng/mẫu · xem trước · ô điền).
- Mạnh:
  - Cùng khuôn với Bảng giá C và Hợp đồng C.
  - Hàng đợi "Cần thu" trả lời ngay câu "hôm nay thu ai".
  - Trên điện thoại, cột trái thành danh sách, bấm vào thì mở cột phải.
- Yếu: máy tính bảng hơi chật, nên đã cho bộ lọc hẹp lại và form thẻ xuống dưới.
- Hợp với: cả chủ lẫn nhân viên; giữ được một họ thiết kế cho toàn app.

| Tiêu chí | A | B | C |
|---|---|---|---|
| Cùng khuôn với Hợp đồng C đã chọn | một phần | không | **có** |
| Bấm để lập xong 1 hợp đồng khoá học | ít nhất | nhiều nhất (4 bước) | ít |
| "Hôm nay thu ai" | phải lọc | phải lọc | **có sẵn hàng đợi** |
| So sánh nhiều hợp đồng | **tốt** (bảng) | kém | khá |
| Dùng trên điện thoại | khá | **tốt** | khá |
| Số màn trong bản mẫu (gồm màn phụ) | 9 | 12 | 10 |

## 7. Mẫu chào mừng

**Đợt 1** — 9 mẫu, 3 hướng: Sang trọng tối giản, Tươi vui pastel, Tạp chí thời trang.
- Khổ 1080×1080 và 1080×1920.
- Phông: @fontsource 5.3.0, giấy phép OFL 1.1, nhúng sẵn trong tệp.

**Đợt 2** — 10 mẫu "Sang trọng hiện đại", khổ 1080×1350 và 1080×1080.

Ghi chú về 6 ảnh anh gửi:
- R&D không có ảnh gốc, chỉ có mô tả bằng chữ của điều phối.
- Cột "Nguồn" bên dưới nói mẫu học **ý bố cục** từ ảnh nào.
- Không chép logo hay tên thương hiệu trong ảnh.

| Mã | Tên | Nguồn |
|---|---|---|
| shd-01 | Thư mời kem | Học từ ảnh 6 (thư mời "Dear:", tháng/năm và địa chỉ ở chân). Bản mình viết "Thân gửi"; không có lỗi "WELCOM" |
| shd-02 | Đen vàng vòm cửa | Tự sáng tác |
| shd-03 | Ngày khai giảng lớn | Học từ ảnh 1 (ngày lớn, ảnh tròn, mã QR, website ở chân) |
| shd-04 | Ruy băng tên | Học từ ảnh 5 (ảnh tròn, ruy băng chứa tên, địa chỉ + số điện thoại) |
| shd-05 | Tạp chí tối giản | Tự sáng tác |
| shd-06 | Xanh rêu khung lệch | Tự sáng tác |
| shd-07 | Vé vào lớp | Tự sáng tác |
| shd-08 | Chữ ký trên nền trắng | Tự sáng tác |
| shd-09 | Thiệp vàng hồng khung bầu dục | Tự sáng tác (hoạ tiết lá do R&D vẽ) |
| shd-10 | Thư tay của giảng viên | Tự sáng tác: đoạn chào ghép từ khoá, lớp, thứ + ngày khai giảng, giờ, địa chỉ; ký tên giảng viên |

**Nguồn hình và mã:**
- Ảnh người, logo chữ "M" và hoạ tiết là hình vector **do R&D tự vẽ**, chỉ để minh hoạ.
- Mã QR tạo bằng thư viện qrcode-generator 1.4.4 (Kazuhiko Arase, giấy phép MIT, giữ nguyên lời ghi bản quyền), tệp /home/user/a/docs/rnd/v3-mau-chao-mung/chung/qrcode.js

## 8. Mẫu Feedback

**Cách dùng** (màn `#feedback` ở cả 3 phương án):
- Chọn người khen trong danh bạ khách/học viên.
- Chọn hợp đồng; tên khoá hoặc dịch vụ lấy từ hợp đồng.
- Dán nội dung lời khen, đã chép từ Zalo hoặc Facebook.
- Tải lên 1–3 ảnh, chọn ngày nhận.
- Chọn mẫu, xem trước, rồi bấm **Tải ảnh PNG**.
- Nút **Sao chép nội dung** nằm ngay dưới ô nội dung, để dán lại khi đăng bài.

**Ai, khi nào:** dòng "Ghi bởi Lương Hà My · 18/10/2026" trên đầu màn.

| Mã | Tên | Nguồn | Số ảnh |
|---|---|---|---|
| fb-01 | Tin nhắn và ảnh polaroid | Học từ ảnh 2 (bong bóng tin nhắn, polaroid nghiêng, chữ viết tay cảm ơn) | 1 |
| fb-02 | Thẻ trắng nổi có sao | Học từ ảnh 3–4 (thẻ trắng nổi, lời nhận xét, ảnh khách, sao) | 1 |
| fb-03 | Ảnh trên, lời khen dưới | Học từ ảnh 3–4 | 1 |
| fb-04 | Thư cảm ơn nền kem | Tự sáng tác | 3 |
| fb-05 | Đen vàng hai vòm ảnh | Tự sáng tác | 2 |
| fb-06 | Lưới ba ảnh | Tự sáng tác | 3 |
| fb-07 | Khung điện thoại tin nhắn | Học từ ảnh 2 (biến thể khung điện thoại) | 1 |
| fb-08 | Ảnh nền toàn khung | Tự sáng tác | 1 |
| fb-09 | Trước – sau | Tự sáng tác, hợp cho khách dịch vụ makeup | 2 |
| fb-10 | Câu nổi bật viết tay | Tự sáng tác: câu đầu tiên của lời khen viết tay, phần còn lại chữ thường | 1 |

Nội dung chia vào bong bóng tin nhắn và "câu nổi bật" được **tách tự động** từ nội dung dán vào, không cần thêm ô nhập.

## 9. Phông viết tay

**Tình hình.**
- Kho phông "auto ss / SS-Album" nằm ở ổ H: trên máy anh. Phiên trên mây không với tới; điều phối cũng đã dò, không thấy bản sao ở đâu khác.
- R&D tạm dùng phông viết tay **miễn phí, giấy phép SIL OFL 1.1** (dùng thương mại được, kèm được trong phần mềm).

**Cách thử.**
- Chuỗi thử: "Quỳnh Như · Thuý Tây · Nguyễn Hoa · Đặng Thị Ngọc Ánh · Phường Vạn Xuân", cỡ 48px.
- Bước 1 — đo máy: đo từng ký tự với 2 phông dự phòng khác nhau. Nếu chiều rộng đổi nghĩa là phông thiếu chữ đó.
- Bước 2 — nhìn ảnh: R&D mở ảnh, xem dấu có lệch, đè nét, hay đọc sai không.
- Một chuỗi coi là đạt khi đủ chữ **và** đọc đúng.
- Ảnh: /home/user/a/docs/rnd/anh/v3-phong-viet-tay-thu-dau-48px.png và /home/user/a/docs/rnd/anh/v3-phong-viet-tay-can-canh.png

**Lỗi hay gặp nhất:** chữ **T hoa đi liền â** ("Tây", "Tân", "Tấn"). Nét ngang của T chạm dấu mũ, nên đọc thành "Tẩy" hoặc "Tẫy". Họ và tên Việt có nhiều chữ như vậy, nên R&D loại các phông bị lỗi này.

**Nguồn bản thử và giấy phép chung:**
- Bản thử lấy từ gói npm `@fontsource/<tên>` bản 5.3.0.
- Tất cả 29 phông đều theo giấy phép OFL 1.1.

| Phông | Đạt | Ghi chú | Kết luận |
|---|---|---|---|
| Imperial Script | 5/5 | Dấu tách khỏi nét bay | **Dùng — MP Viết tay 1** |
| Italianno | 5/5 | Nét mảnh, thanh | **Dùng — MP Viết tay 2** |
| Birthstone | 5/5 | Dễ đọc, hiện đại | **Dùng — MP Viết tay 3** |
| Charm | 5/5 | Dễ đọc nhất, hợp câu dài | **Dùng — MP Viết tay 4** |
| Dancing Script | 5/5 | Đã dùng ở mẫu đợt 1 | Giữ |
| Corinthia | 5/5 | Nét rất mảnh, cỡ nhỏ khó đọc | Dự phòng |
| Carattere | 5/5 | "Ngọc Ánh" sát nhau | Dự phòng |
| Lavishly Yours | 5/5 | Nhiều nét trang trí | Dự phòng |
| Mea Culpa | 5/5 | Nét bay của "Đ" dài | Dự phòng |
| Moon Dance | 5/5 | — | Dự phòng |
| Oooh Baby | 5/5 | Nét đều, kiểu bút bi | Dự phòng |
| Playball | 5/5 | Đậm, kiểu thể thao | Dự phòng |
| Vujahday Script | 5/5 | — | Dự phòng |
| Waterfall | 5/5 | — | Dự phòng |
| Pacifico | 5/5 | Đậm, tròn, vui | Không hợp "sang trọng" |
| Love Light | 5/5 | Có hình tim trong nét | Không hợp "sang trọng" |
| Ole | 5/5 | Dấu chấm của "ị" là ngôi sao | Không hợp "sang trọng" |
| Babylonica | 5/5 | Nét xước, dấu nhỏ, khó đọc ở 48px | Loại |
| Ballet | 5/5 | Nét bay đè lên dấu ("Thị", "Ngọc") | Loại |
| Alex Brush | 4/5 | "Tây" đọc thành "Tẩy" | Loại |
| Allura | 4/5 | "Tây" đọc thành "Tẩy" | Loại |
| Ephesis | 4/5 | Dấu mũ "Tây" lượn như dấu ngã | Loại |
| Great Vibes | 4/5 | "Tây" đọc thành "Tẫy" | Loại |
| Petemoss | 4/5 | "Tây" đọc thành "Tẩy" | Loại |
| Pinyon Script | 4/5 | "Tây" đọc thành "Tẫy" | Loại |
| The Nautigal | 4/5 | "Tây" đọc thành "Tẫy" | Loại |
| Updock | 4/5 | "Tây" đọc thành "Tẫy" | Loại |
| Comforter | 3/5 | "Tây" và "Xuân" méo | Loại |
| Parisienne | 1/5 | **Thiếu chữ** ư ễ ặ ị ọ ờ ạ (gói không có tập con tiếng Việt) | Loại |

**Tệp phông đang dùng** nằm ở /home/user/a/docs/rnd/v3-mau-chao-mung/phong/
- Nguồn: kho chính thức github.com/google/fonts, thư mục `ofl/`. Mỗi phông có kèm tệp `OFL-*.txt`.
- Viết tay: ImperialScript, Italianno, Birthstone, Charm.
- Chữ in: Cormorant Garamond, Playfair Display, Montserrat.
- Không đưa phông nào vào `apps/web`.

**Thay bằng phông SS-Album** (khi anh tải lên):
1. Chép tệp phông vào thư mục `phong/` ở trên.
2. Trong `phong.css`, chỉ sửa dòng `src:` của khối `'MP Viết tay N'`. Giữ nguyên tên family.
3. Nếu phông mới to hoặc nhỏ hơn, chỉnh hệ số `--tay-co-N`.

Trang thử: /home/user/a/docs/rnd/v3-mau-chao-mung/phong/thu-phong.html

**Lưu ý về giấy phép:**
- Phông trong kho SS-Album cần được kiểm giấy phép **trước khi** nhúng vào app bán cho khách.
- Phông Việt hoá lấy từ các bộ sưu tập thường không ghi rõ quyền dùng thương mại.

## 10. Bảng ô ↔ trường dự kiến

Máy chủ (`apps/api/prisma/schema.prisma`) **đã có**: `OrganizationProfile` (brandName, logoFileId, address, phone, website…), `StudioLocation.address`, `Customer.fullName`, `Contract` (discount, total, depositRequired, terms, confirmedAt), `PaymentInstallment` (name, dueDate, amount, isDeposit, sortOrder), `Payment` (code, kind RECEIPT/REFUND, method CASH/BANK_TRANSFER/CARD/OTHER, amount, receivedAt, note, voidedAt/voidReason, createdById), `StoredFile` (có purpose `CUSTOMER_AVATAR`, `WELCOME_CARD`), `EventKind.COURSE_SESSION`.

**Chưa có:** khoá học, lớp, mẫu điều khoản, lời khen. Cột "Trạng thái" bên dưới ghi rõ trường đã có hay **đề xuất**.

### 10.1 Khoá & lớp

| Ô trên màn | Trường | Trạng thái |
|---|---|---|
| Nhóm khoá (chip, tiêu đề nhóm) | `CourseGroup.name`, `sortOrder`, `isActive` | đề xuất |
| Tên khoá, mã | `Course.name`, `Course.code`, `Course.groupId` | đề xuất |
| Học phí | `Course.tuitionFee` (hoặc qua `PriceVersion` như bảng giá) | đề xuất |
| Cọc mặc định | `Course.depositAmount` | đề xuất |
| Số buổi / Mỗi buổi | `Course.sessionCount`, `Course.sessionMinutes` | đề xuất |
| Mô tả | `Course.description` | đề xuất |
| Lớp, khai giảng | `CourseClass.code`, `CourseClass.startDate` | đề xuất |
| Lịch học (khi nào) | `CourseClass.weekdays[]`, `startTime`, `endTime` | đề xuất |
| Sĩ số x/y | đếm hợp đồng khoá học đã xác nhận / `CourseClass.capacity` | đề xuất |
| Giảng viên (ai) | `CourseClass.instructorMembershipId` | đề xuất |
| Ở đâu | `CourseClass.studioLocationId` → `StudioLocation.address` | đề xuất (bảng đích có) |
| Buổi học trên Lịch | `Appointment` với `EventKind.COURSE_SESSION` | đã có kiểu, chưa có liên kết lớp |

### 10.2 Lập hợp đồng

| Ô trên màn | Trường | Trạng thái |
|---|---|---|
| Loại: Khoá học / Dịch vụ makeup | `Contract.kind COURSE|SERVICE` (hoặc thêm `ContractLineKind.COURSE`) | đề xuất |
| Học viên | `Contract.customerId` → `Customer.fullName/phone/email` | có |
| Người phụ trách | `Contract.ownerMembershipId` (hiện chỉ có `createdById`) | đề xuất |
| Dòng khoá học + lớp | `ContractLine.courseId`, `ContractLine.courseClassId` | đề xuất |
| Học phí | `ContractLine.unitPrice/lineTotal` | có |
| Giảm giá | `Contract.discount` | có |
| Lý do giảm | `Contract.discountReason` | đề xuất (hoặc ghi vào `notes`) |
| Tổng | `Contract.total` | có |
| Cọc phải thu | `Contract.depositRequired` = đợt `isDeposit` | có |
| Các đợt (tên, hạn, số tiền) | `PaymentInstallment.name/dueDate/amount/sortOrder` | có |
| Mẫu điều khoản / nội quy (tên, bản, ngày sửa) | `ContractTemplate{kind TERMS|RULES, name, body, version, updatedAt}` | đề xuất |
| Bản chụp điều khoản + nội quy lúc xác nhận | `Contract.terms` (đã có, 1 chuỗi) + `Contract.termsTemplateVersion` | có một phần |
| Xem bản in / PDF | sinh từ dữ liệu trên | — |

### 10.3 Thu tiền

| Ô trên màn | Trường | Trạng thái |
|---|---|---|
| Tổng · Cọc phải thu · Đã thu thực tế · Còn lại | `Contract.total`, `depositRequired`, tổng `Payment.amount` (RECEIPT − REFUND, bỏ phiếu đã huỷ) | có (tính ra) |
| Số tiền, ngày thu, ghi chú | `Payment.amount`, `receivedAt`, `note` | có |
| Cách trả: Tiền mặt / Chuyển khoản | `Payment.method` (máy chủ còn có CARD, OTHER — chưa bày) | có |
| Áp vào đợt | `Payment.installmentId` (hoặc tự trừ dần theo thứ tự đợt) | đề xuất |
| Vào tài khoản / quỹ | `Payment.accountId` hoặc `Payment.accountLabel` | đề xuất |
| Người thu (ai) | `Payment.receivedByMembershipId` (hiện chỉ có `createdById` = người ghi) | đề xuất |
| Quá hạn | `PaymentInstallment.dueDate` < hôm nay và đợt chưa đủ tiền | tính ra |
| Hàng đợi Quá hạn / 7 ngày tới / Sau đó | tính từ các đợt chưa thu đủ | tính ra |

### 10.4 Thống kê

| Ô trên màn | Cách tính | Trạng thái |
|---|---|---|
| Doanh số | tổng `Contract.total` của hợp đồng có `confirmedAt` trong kỳ | có |
| Cọc phải thu | tổng `depositRequired` của các hợp đồng đó | có |
| Đã thu thực tế | tổng phiếu thu của các hợp đồng đó, tính đến hôm nay | có |
| Còn lại | Doanh số − Đã thu | tính ra |
| Thực thu trong tháng | tổng `Payment.amount` có `receivedAt` trong tháng (mọi hợp đồng) | có |
| Tách khoá học / dịch vụ | `Contract.kind` | đề xuất |
| Theo nhóm / khoá | `ContractLine.courseId` → `Course.groupId` | đề xuất |

### 10.5 Thẻ chào mừng (khoá `data-f` trong mẫu → trường)

| Khoá | Ô trên mẫu | Trường | Trạng thái |
|---|---|---|---|
| `th` | Tên thương hiệu | `OrganizationProfile.brandName` | có |
| `logo` | Logo | `OrganizationProfile.logoFileId` → `StoredFile` | có |
| `diachi` | Địa chỉ | `OrganizationProfile.address` (hoặc `StudioLocation.address` của lớp) | có |
| `sdt` | Số điện thoại | `OrganizationProfile.phone` | có |
| `web` | Website + mã QR | `OrganizationProfile.website` | có |
| `ten` | Tên học viên | `Customer.fullName` | có |
| `anh` | Ảnh học viên | `Customer.avatarFileId` (đã có purpose `CUSTOMER_AVATAR`, chưa có cột) | đề xuất |
| `khoa`, `lop` | Tên khoá, mã lớp | `Course.name`, `CourseClass.code` | đề xuất |
| `ngay` (→ ngày lớn, "Tháng 11 · 2026", thứ) | Ngày khai giảng | `CourseClass.startDate` | đề xuất |
| `lich` (→ giờ) | Lịch học | `CourseClass.weekdays/startTime/endTime` | đề xuất |
| `gv` | Giảng viên | `CourseClass.instructorMembershipId` → tên | đề xuất |
| Ảnh đã tải | — | `StoredFile` purpose `WELCOME_CARD` | có |
| Mẫu đã chọn | — | `WelcomeCard{contractId, templateCode, size, fileId, createdById, createdAt}` | đề xuất |

### 10.6 Feedback

| Khoá | Ô | Trường | Trạng thái |
|---|---|---|---|
| `nd` | Nội dung lời khen | `Testimonial.content` | đề xuất |
| `kh` | Tên người khen | `Testimonial.customerId` → `Customer.fullName` | đề xuất (đích có) |
| `dv` | Khoá học hoặc dịch vụ | `Testimonial.contractId` → tên khoá / `ContractLine.name` | đề xuất (đích có) |
| `nfb` | Ngày nhận | `Testimonial.receivedAt` | đề xuất |
| `a1`–`a3` | Ảnh 1–3 | `Testimonial.photoFileIds[]` → `StoredFile` (cần thêm purpose `TESTIMONIAL` hoặc dùng `ALBUM_IMAGE`) | đề xuất |
| `sao` | Số sao (chỉ fb-02, fb-03) | `Testimonial.rating` | đề xuất |
| Ghi bởi · ngày | Ai ghi, khi nào | `Testimonial.createdById`, `createdAt` | đề xuất |
| `th`, `logo`, `web` | Thương hiệu | `OrganizationProfile` | có |

## 11. Đề xuất (chưa vẽ vì anh chưa yêu cầu)

- **Ảnh minh chứng phiếu thu.** Studio Pro bắt buộc có. Nếu anh muốn: một ô "Ảnh chuyển khoản" trong form phiếu thu, trường `Payment.proofFileId`.
- **Màn hoàn tiền.** Máy chủ đã có `PaymentKind.REFUND`.
- **Nhắc hạn đợt.** Nhắc người phụ trách trước hạn 3 ngày.
- **Hạn đợt tự theo ngày khai giảng.** Học từ `relatedDateKey` của Studio Pro: đổi lớp thì hạn đợt "Khai giảng" đổi theo.
- **Feedback:**
  - Ô "Nguồn" (Zalo/Facebook/trực tiếp).
  - Ô "Khách đồng ý đăng" (`Testimonial.consentAt`), vì ảnh có mặt khách.
  - Ô tên hiển thị khác tên thật (giữ riêng tư).
- **Thẻ:** tự tạo thẻ khi hợp đồng khoá học được xác nhận.
- **Đủ 20 mẫu chào mừng:** thêm 1 mẫu nữa sau khi anh chọn hướng.

## 12. Chưa làm được / chưa khảo sát được

- **Kho phông SS-Album** trên máy anh: không truy cập được. Phông viết tay đang là phông tạm.
- **6 ảnh tham chiếu anh gửi:** không có ảnh gốc trên đĩa. R&D làm theo mô tả bằng chữ của điều phối, nên bố cục "học từ ảnh" có thể khác ảnh thật.
- **Phần mềm Việt Nam:** chỉ đọc được đoạn trích tìm kiếm (mục 5). Chưa mở được trang nào, chưa xem được màn hình thật.
- **Khổ ảnh chưa đủ:**
  - Mẫu đợt 1 chưa có khổ 1080×1350.
  - Mẫu đợt 2 chưa có khổ story 1080×1920.
  - Ô chọn khổ trên màn hiện chỉ có "Vuông · Dọc 4:5".
- **Phần chưa bày:** chi tiết hộp "Bộ lọc" trên điện thoại (phương án C) và màn "Sửa mẫu điều khoản".
- Chưa dựng thông số (Chặng 2). Chưa đụng vào `apps/web` và `apps/api`. Không chạy git.
