# BÁO CÁO R&D 09 — MẪU IN HỢP ĐỒNG (chặng 1)

Ngày 19/10/2026 · Trung tâm R&D · Người đọc: anh Chiến (chủ studio)

> **Anh xem cái này trước:** `docs/rnd/anh-rnd09/00-bang-xem-nhanh.png`. Đây là bảng 5 mẫu in × 2 loại hợp đồng, mỗi ô là trang 1 của bản in thật. Bản có thể bấm được nằm ở `docs/rnd/v9-mau-in/index.html`: bấm vào một ô để mở mẫu, bấm "PDF" để mở tệp in thử.

**Đề xuất của R&D:**

1. Làm **Phương án 1**: chọn 1 trong 5 bố cục, bật/tắt từng khối, sửa chữ đầu và chữ cuối, rồi lưu thành "Mẫu in của studio". Phương án này làm đúng hai việc anh giao: có 5 mẫu in, và người dùng tự sửa nội dung rồi lưu lại làm mẫu cố định. Đây cũng là phương án ít rủi ro nhất, vì không thể tạo ra một bản in bị vỡ.
2. **Mẫu mặc định:** hợp đồng dịch vụ dùng mẫu 2 (Hiện đại), hợp đồng khoá học dùng mẫu 1 (Cổ điển, có quốc hiệu).
3. **Hợp đồng đã in thì giữ nguyên bản đã in.** Hệ thống ghi lại mẫu và số phiên bản đã dùng lúc in. Khi in lại, mặc định dùng đúng bản đó.

Giải thích từ dùng trong báo cáo (giải thích một lần):
- **Bố cục:** kiểu trình bày của tờ giấy (chữ có chân hay không, bảng kẻ hay danh sách, logo to hay nhỏ).
- **Khối:** một phần của tờ hợp đồng, ví dụ đầu trang, thông tin hai bên, bảng dịch vụ, tổng tiền, tiến độ thanh toán, điều khoản, chỗ ký.
- **Biến chèn:** chữ trong ngoặc nhọn như `{Tên khách}` hoặc `{Ngày sự kiện}`. Lúc in, máy tự thay biến bằng thông tin thật của hợp đồng.
- **Phiên bản (bản v1, v2…):** mỗi lần studio lưu mẫu, số bản tăng 1. Bản cũ vẫn được giữ.
- **Trường dữ liệu:** một ô thông tin lưu trong cơ sở dữ liệu, ví dụ "SĐT khách". "Trường mới" là ô hiện chưa có, phải thêm.
- **Máy chủ:** phần chương trình chạy trên server, nơi lưu dữ liệu. **Web:** phần màn hình anh thấy trên máy tính và điện thoại.
- **Buổi làm việc:** khoảng 4 giờ làm của một người.
- **Playwright / Chromium:** công cụ tự mở trình duyệt Chrome để in thử ra PDF, rồi máy tự kiểm kết quả. Không cần người bấm.

---

## 1. Việc anh giao (19/10/2026, nguyên văn)

> "Tất cả các tính năng tạo hợp đồng của khóa học và hợp đồng dịch vụ đều có tính năng in nhé"
> "Và các mẫu in tạo 5 mẫu in và có nội dung tùy chỉnh để người dùng có thể lưu lại làm mẫu in cố định học ssnew"

## 2. Hiện trạng trong mã (đã đọc, không sửa)

| Việc | Hiện trạng | Đường dẫn:dòng |
|---|---|---|
| Bản in hợp đồng khoá học | Đã có. Gồm tên tổ chức, tiêu đề, số HĐ, học viên, bảng dòng, giảm giá, tổng, cọc, tiến độ, điều khoản, nội quy, ghi chú, chỗ ký | `apps/web/src/features/contracts/ContractPrint.tsx:25` (dữ liệu in), `:44` (tờ giấy), `:113` (điều khoản), `:124` (chỗ ký), `:164` (nút "In / Lưu PDF" gọi `window.print()`) |
| Đầu trang bản in | Chỉ in **tên tổ chức viết hoa**, lấy từ `Organization.name`. **Chưa có** logo, địa chỉ, SĐT, tài khoản ngân hàng | `ContractPrint.tsx:48`, `apps/web/src/features/contracts/index.tsx:21` |
| Luật in (CSS) | Khổ A4, lề 16/15 mm. Lúc in ẩn màn ứng dụng, đưa hộp thoại về dòng chảy thường. Đây là bản đã sửa lỗi chồng trang | `apps/web/src/features/contracts/contracts.css:257` (`@page hop-dong`), `:258` (`@media print`), `:262`, `:274` |
| Bài thử bản in | Bài kiểm luật CSS (không cần trình duyệt), và bài in thật bằng Chromium (bản ngắn đúng 1 trang; bản 45 điều đủ trang, không lặp) | `apps/web/src/features/contracts/contracts-print-css.test.ts`, `ContractPrint.pdf.test.ts:122`, `:135`; trang in thử `__in-thu__/main.tsx` |
| Hợp đồng dịch vụ | **Chưa có bản in.** `ContractEditor.tsx` (1202 dòng) không có nút In, và cũng **chưa có thẻ chọn điều khoản** (thẻ này mới có ở màn khoá học) | `ContractEditor.tsx` (tìm "print" không thấy), `CourseContractEditor.tsx:725` (`ContractTextsCard`) |
| Mẫu điều khoản / nội quy có phiên bản | Có. Sửa nội dung thì `version + 1`. Mỗi loại hợp đồng có tối đa 1 mẫu mặc định. Hợp đồng đã xác nhận giữ **bản chụp** điều khoản (terms/rules + id + version). Nhưng **không giữ nội dung các bản cũ** của mẫu, chỉ giữ số bản | `apps/api/prisma/schema.prisma:1259` (ContractText), `:1264` (appliesTo), `:1268` (version), `:1270` (isDefault); `:688`, `:690`, `:693` (bản chụp trong Contract); `apps/api/src/modules/contracts/texts.ts:1-4`, `:178`, `:247`; màn `ContractTexts.tsx:48`, `:179` |
| Dữ liệu hợp đồng dịch vụ | Mỗi dòng có: nhân vật (`subjectName`), giờ, nơi làm, địa chỉ, thợ chính/phụ, dịch vụ phụ, phí di chuyển kèm số km đã chụp lúc lưu, phụ phí. Ngoài ra có giảm giá, cọc, tiến độ đợt, phiếu thu | `schema.prisma:672` (Contract), `:682` eventDate, `:684` discount, `:686` depositRequired, `:725` (ContractLine), `:735`, `:737`, `:739`, `:742`, `:754`, `:758`; `:871` (ContractLineStaff); `:947` (PaymentInstallment); `:981`, `:987`, `:989` (Payment); `apps/api/src/modules/contracts/present.ts:214` (travelBreakdown), `:288`, `:367` (loadContractDetail) |
| Dữ liệu khoá học | Lớp (tên, ngày khai giảng/kết thúc, thứ học, giờ, giảng viên, cơ sở), số buổi | `schema.prisma:1149` (Course), `:1161`, `:1183` (CourseClass), `:1191`, `:1193`, `:1198`; dòng COURSE `:764` |
| Hồ sơ thương hiệu | Đã có tên, khẩu hiệu, địa chỉ, SĐT, email, website, logo. **Chưa có:** tài khoản ngân hàng, người đại diện ký hợp đồng | `schema.prisma:1072`, `:1074`, `:1075`, `:1080`, `:1081`, `:1082`, `:1087`, `:1088`; API `apps/api/src/modules/profile/routes.ts:68` |
| Khách | Đã có họ tên, SĐT, email. **Chưa có:** địa chỉ, số CCCD (hợp đồng giấy ở Việt Nam thường ghi) | `schema.prisma:385`, `:388`, `:390`, `:391` |
| Đọc số tiền thành chữ | **Chưa có** hàm nào | tìm "bằng chữ" trong `packages/`, `apps/` không thấy |

## 3. ssnew và phần mềm tham khảo

- **Chưa khảo sát được ssnew.** Kho của anh đã bị chặn, R&D không lách. **Cần anh gửi ảnh màn mẫu in của ssnew**: màn danh sách mẫu, màn sửa mẫu, và một bản in ra. R&D sẽ đối chiếu với 3 phương án ở chặng 2.
- **Phần mềm khác:** máy R&D **không mở được trang** của các hãng (công cụ đọc trang báo lỗi không phân giải được tên miền). Các ý dưới đây **suy luận từ đoạn trích kết quả tìm kiếm**, chưa xem tận mắt màn hình:
  - **Sapo:** có ứng dụng "Cấu hình mẫu in". Hỗ trợ khổ A4, A5, K57, K80. Bật/tắt hơn 80 biến thông tin (logo, chữ ký, khách, sản phẩm, phí vận chuyển). Có trình sửa nâng cao đổi vị trí, phông, cỡ, màu. **Lưu lịch sử theo phiên bản để quay lại mẫu cũ.** Đặt ở Cấu hình → Máy in & Mẫu in. Nguồn: [nâng cấp cấu hình mẫu in](https://www.sapo.vn/cap-nhat-tinh-nang/nang-cap-cau-hinh-mau-in), [ứng dụng cấu hình mẫu in](https://www.sapo.vn/cap-nhat-tinh-nang/ung-dung-cau-hinh-mau-in), [bổ sung mẫu in](https://www.sapo.vn/cap-nhat-tinh-nang/bo-sung-mau-in-hoa-don), [khung viền mẫu hoá đơn](https://www.sapo.vn/cap-nhat-tinh-nang/khung-vien-mau-hoa-don).
  - **Pages POS:** tạo mẫu mới từ mẫu có sẵn hoặc từ đầu. Mỗi biến có một "key" để gắn vào nội dung. Bảng có bánh răng để chọn cột và thứ tự cột. Nguồn: [docs.pos.pages.fm — mẫu in](https://docs.pos.pages.fm/pos/thiet-lap-shop/mau-in).
  - **MISA AMIS:** thêm logo ở phần thiết lập, có nút "Sửa mẫu" để sửa chữ, thêm cột và trường dữ liệu. Nguồn: [helpact.misa.vn](https://helpact.misa.vn/?p=83383).
  - **Shopify Order Printer:** mẫu viết bằng HTML/CSS và biến Liquid. Đây là kiểu "tự do hoàn toàn", chỉ hợp người biết mã. Nguồn: [help.shopify.com](https://help.shopify.com/vi/manual/orders/printing-orders/shopify-order-printer/creating-templates).
  - **KiotViet, Fresha, Vagaro, "Studio Pro":** tìm kiếm **không ra** tài liệu về mẫu in. R&D không bịa. Theo một bài review, KiotViet có mục "Quản lý mẫu in" ([accgroup.vn](https://accgroup.vn/phan-mem-ke-toan-kiotviet)), nhưng chưa rõ cách sửa mẫu.
  - Phần mềm quản lý studio ảnh của nước ngoài: suy luận từ trích đoạn là "mỗi loại buổi chụp gắn một mẫu hợp đồng", và hợp đồng cưới hay có phụ lục riêng cho lịch thanh toán ([proposalkit.com](https://www.proposalkit.com/htm/legal-contract-templates/photography-contracts/wedding-photography-contract.htm), [shootq.com](https://shootq.com/client-management-software-helps-with-streamlining-contracts/)).
- **Rút ra:** phần mềm bán hàng ở Việt Nam đi theo hướng "mẫu có sẵn + bật/tắt trường + lưu lịch sử phiên bản" (giống Phương án 1, nhích dần sang 2). Hướng "soạn tự do bằng mã" chỉ dành cho người kỹ thuật.

## 4. Năm mẫu in (việc B): đã dựng thật, in thật, tự kiểm

Thư mục `docs/rnd/v9-mau-in/`. Mỗi mẫu có một tệp CSS: `mau-1-co-dien.css` … `mau-5-sang-trong.css`. Hai tệp dùng chung là bộ dựng `chung/ban-in.js` và dữ liệu mẫu `chung/du-lieu.js`. Mở `in.html?mau=1..5&loai=dich-vu|khoa-hoc&ban=dai|ngan`.

| Mẫu | Tính cách | HĐ dịch vụ dài | HĐ khoá học 45 điều | Bản ngắn |
|---|---|---|---|---|
| 1. Cổ điển trang trọng | Quốc hiệu – tiêu ngữ, chữ có chân, "Điều 1…5", ô **ký nháy** cuối mỗi trang | 2 trang | 3 trang | 1 trang |
| 2. Hiện đại tối giản | Phông của app, màu nhấn của studio, danh sách thay bảng kẻ, khung tổng bên phải, điều khoản 2 cột | 2 trang | 2 trang | 1 trang |
| 3. Bảng kẻ đầy đủ | Mọi phần trong bảng, nhiều cột (giờ/địa điểm/thợ, giảm từng dòng, đã thu từng đợt). Đầu bảng tự lặp khi sang trang | 2 trang | 3 trang | 1 trang |
| 4. Gọn một trang | Chữ nhỏ, lề hẹp, tiền + tiến độ + đã thu gom trong một dải, điều khoản 2 cột | **1 trang** | 2 trang | 1 trang |
| 5. Sang trọng viền & logo lớn | **Khung viền kép lặp ở mọi trang**, logo to giữa đầu trang, chữ thanh mảnh, hoa văn ngăn mục | 2 trang | 2 trang | 1 trang |

**Dữ liệu mẫu dùng để in:**
- **HĐDV-000128:** Cô dâu (gói 4.500.000 ₫, có nối mi, phí di chuyển 18,4 km → tính 16,8 km × 15.000 ₫ = 252.000 ₫), Phù dâu × 2 (2.400.000 ₫), phụ phí ca sớm 300.000 ₫, giảm 500.000 ₫. Tổng **7.152.000 ₫**, cọc 2.000.000 ₫ đã thu (PT-000341), 12 điều khoản.
- **HĐKH-000046:** lớp K12, Thứ 3-5-7, 18:00–21:00, 24 buổi, cộng bộ cọ, giảm 1.000.000 ₫. Tổng **15.200.000 ₫**, 3 đợt, **45 điều khoản + 8 nội quy**.
- **Bản ngắn:** 1 dòng, 4 điều khoản.

**Đã in bằng Chromium (A4) và máy tự kiểm 20/20 bản in đạt.** Bài kiểm: `docs/rnd/v9-mau-in/kiem-in-thu.js`. Các mục kiểm:
- Khổ A4.
- Bản ngắn ra đúng 1 trang.
- Tiêu đề xuất hiện đúng 1 lần (không lặp).
- Mỗi điều khoản và nội quy có đúng 1 lần (không thiếu, không trùng).
- Tổng tiền có trong PDF.
- Tiền cộng lại khớp: tổng các dòng = tạm tính, tạm tính − giảm = tổng, tổng các đợt = tổng. Số km × đơn giá khớp phí di chuyển. Số buổi tính theo lịch lớp khớp 24.
- Không có khối "cố định" chứa chữ (nguyên nhân lỗi chồng trang cũ). Không có khối bị cắt.
- Không có trang trống, không có mẩu chữ lẻ.

R&D đã tự mở xem từng trang ảnh.

**Lỗi tìm ra khi in thử và cách đã chặn.** Khi đưa vào sản phẩm phải giữ các luật này:
1. **Dấu tiếng Việt "rơi" sang trang trước.** Tiêu đề viết hoa như "ĐIỀU KHOẢN" bị đẩy sang trang sau, nhưng dấu mũ của chữ "Ề" vẫn in thành một chấm ở cuối trang trước. Cách sửa: thêm khoảng đệm trên tiêu đề. Bài kiểm nay bắt được lỗi này.
2. **Dòng tổng lặp ở mọi trang.** Khi bảng dài, Chrome mặc định in lại phần chân bảng (dòng Tổng cộng) ở mỗi trang. Cách sửa: chỉ cho lặp **đầu bảng**, không cho lặp chân bảng.
3. **Tiêu đề mục mồ côi.** Tiêu đề "ĐIỀU KHOẢN" bị nằm cuối trang, còn nội dung sang trang sau. Luật "đừng ngắt sau tiêu đề" của Chrome không đủ tin cậy, nên R&D kéo dài hộp tiêu đề thêm 14 mm (không nhìn thấy). Không đủ chỗ thì cả tiêu đề sang trang mới.
4. **Khung viền mọi trang (mẫu 5)** và **chân trang "HĐDV-000128 · Trang 1/2 · Ký nháy"** chạy được trên Chrome. Theo hiểu biết hiện tại của R&D, **Safari trên iPhone/Mac chưa hỗ trợ phần chân trang có số trang**, nên trên đó số trang và ô ký nháy sẽ không hiện. **Cần thử trên máy thật** (xem mục 8).

Ảnh từng trang: `docs/rnd/anh-rnd09/mau{1..5}-{dich-vu|khoa-hoc}-{dai|ngan}-trang-{n}.png` (31 ảnh). PDF: `docs/rnd/v9-mau-in/pdf/` (20 tệp). Ảnh có nhãn nguồn dữ liệu trên từng ô: `docs/rnd/anh-rnd09/01-nguon-du-lieu-mau1-dich-vu.png`.

## 5. Ba phương án "mẫu in tùy chỉnh lưu lại" (việc A)

Bản mẫu màn hình dựng bằng bộ thiết kế đang dùng. Token chép đúng `apps/web/src/styles/tokens.css` (qua `docs/rnd/v4-chung/v4.css`). Các thành phần tương ứng với `apps/web/src/ui/*`: Card, Button, Segmented, Switch, ListRow, StatusTag, Dialog/BottomSheet. Xem trước trong màn sửa là **trang in thật** (`v9-mau-in/in.html`), không phải ảnh vẽ. Mở kèm `?truong` để hiện nguồn dữ liệu của từng ô: tím = trường có sẵn, xanh = tính ra từ trường có sẵn, nâu = trường mới.

| | **PA1 — Chọn bố cục** `v9-pa1-chon-bo-cuc.html` | **PA2 — Khối kéo-thả** `v9-pa2-khoi-keo-tha.html` | **PA3 — Văn bản tự do** `v9-pa3-van-ban-tu-do.html` |
|---|---|---|---|
| Mức tùy chỉnh | Thấp: 1 trong 5 bố cục + bật/tắt ~14 khối + sửa tiêu đề, chữ mở đầu, chữ kết thúc (có biến) | Vừa: thêm/bớt/**đổi thứ tự** khối, chỉnh từng khối (cột bảng, gộp dòng phụ), khối "chữ tự do" có biến | Cao: gõ cả hợp đồng như Word, có biến `{…}` và thẻ khối `[[Bảng dịch vụ]]` |
| Màn quản lý | Hai nhóm Dịch vụ / Khoá học, ảnh thu nhỏ, mặc định, bản vN, số HĐ đã in + 5 bố cục có sẵn | Bảng mẫu + **ngăn lịch sử phiên bản** (xem, khôi phục) | Danh sách + cảnh báo "mẫu có biến lỗi" + "Nhập từ tệp Word" |
| Màn sửa | Form bên trái, xem trước bên phải, đổi công tắc là thấy ngay | Kho khối, trang (kéo đổi chỗ), xem trước. Điện thoại: nút ↑ ↓ thay kéo | Thanh công cụ chữ, chèn biến / khối, ô "Kiểm tra mẫu" |
| Chọn mẫu khi In | Hộp "In hợp đồng": ảnh từng trang + chọn mẫu + bản. Có cảnh báo "đã in bằng v3" | Như PA1 + kiểm "đủ dữ liệu cho 10/10 khối" | Như PA1 + kiểm "mọi biến đều có dữ liệu" |
| Mặc định theo loại HĐ | 1 mẫu mặc định / loại (giống mẫu điều khoản đang có) | như PA1 | như PA1 |
| Nguy cơ ra bản in xấu/sai | **Gần như không có**: bố cục do R&D thiết kế, đã thử chảy trang | Vừa: thứ tự lạ có thể gây trang lẻ, nhưng khối nào cũng tự đúng | **Cao**: chữ gõ tay, biến sai loại HĐ (ví dụ `{Tên lớp}` ở HĐ dịch vụ), bảng dài chảy trang khó đoán |
| Điện thoại | Dùng tốt (công tắc + ô chữ) | Dùng được (nút ↑ ↓) | Chỉ hợp sửa chữ nhỏ |

Ảnh chụp (1440 = máy tính, 390 = điện thoại) trong `docs/rnd/anh-rnd09/`:
- `pa1-quan-ly-*`, `pa1-sua-*`, `pa1-in-*`
- `pa2-quan-ly-*`, `pa2-sua-*`, `pa2-in-*`
- `pa3-quan-ly-*`, `pa3-sua-*`, `pa3-in-*`
- `pa3-tu-do-*-trang-*.png`: bản in thật của chế độ văn bản tự do. Bộ dựng đã đọc được văn bản tự do, thay biến và thay thẻ khối.

Lưu ý về bản mẫu PA2: xem trước dùng trang in mẫu 2 có sẵn, chưa đổi thứ tự theo các khối kéo.

## 6. Nguồn dữ liệu từng ô và đề xuất trường mới

Nguồn đầy đủ từng ô nằm ngay trên bản in khi mở `in.html?...&truong` (ảnh `01-nguon-du-lieu-mau1-dich-vu.png`). Tóm tắt:

| Ô trên bản in | Nguồn |
|---|---|
| Logo, tên, khẩu hiệu, địa chỉ, SĐT, email, website studio | `OrganizationProfile.logoFileId/brandName/tagline/address/phone/email/website` (`schema.prisma:1072-1088`). **Bản in hiện tại chưa dùng.** |
| Số HĐ, ngày lập, ngày sự kiện, ghi chú | `Contract.code`, `confirmedAt` (nháp thì `createdAt`), `eventDate`, `notes` |
| Khách: tên, SĐT, email | `Customer.fullName/phone/email` |
| Dòng: nhân vật — tên, giờ, nơi, địa chỉ, ghi chú | `ContractLine.subjectName/name/scheduledStart/scheduledEnd/locationType/address/note` |
| Thợ chính / thợ phụ | `ContractLineStaff.role` + `StaffProfile.displayName` |
| Dịch vụ phụ, phí di chuyển + công thức km | dòng ADDON / TRAVEL + `travelBreakdown` (`present.ts:214`) |
| Lớp, ngày, thứ, giờ, số buổi, giảng viên, cơ sở | `CourseClass.*`, `Course.sessionCount`, `StudioLocation.address` |
| Tạm tính, giảm, tổng, cọc | `Contract.subtotal/discount/total/depositRequired` |
| Số tiền bằng chữ | **TÍNH, hàm mới** (đọc số thành chữ tiếng Việt, đã viết trong `chung/ban-in.js`) |
| Tiến độ đợt | `PaymentInstallment.name/dueDate/amount/isDeposit` |
| Tình trạng từng đợt (đã thu / chưa thu) | **TÍNH:** chia tổng phiếu thu theo thứ tự đợt (phiếu thu chưa gắn với đợt) |
| Phiếu thu, đã thu, còn lại | `Payment.code/receivedAt/method/amount`. Đã thu = tổng phiếu thu chưa huỷ (trừ phiếu hoàn) |
| Điều khoản, nội quy + "bản vN" | `Contract.terms/rules` (bản chụp) + `termsTemplateId/Version` → `ContractText.name` |

**Đề xuất trường mới:**
- `OrganizationProfile`: `bankName`, `bankAccountNumber`, `bankAccountName` (để in khối chuyển khoản; mã QR VietQR có thể tự sinh từ ba trường này), `representative` và `representativeTitle` (người đại diện ký). Trường `taxCode` (mã số thuế) không bắt buộc.
- `Customer`: `address`, `idNumber` (CCCD). Để trống thì bản in hiện dòng chấm "……" để điền tay.
- `PrintTemplate` (mẫu in của studio): `name`, `appliesTo` (ContractKind[], giống ContractText), `layout` (1..5), `blocks` (JSON: khối nào bật; PA2 thêm thứ tự và cài đặt từng khối; PA3 dùng `body`), `title`, `openingText`, `closingText`, `version`, `isDefault` (mỗi loại 1 mẫu), `isActive`, `updatedById`.
- `PrintTemplateVersion`: bản chụp từng phiên bản, để in lại bản cũ cho y hệt.
- `ContractPrint` (nhật ký in): `contractId`, `templateId`, `templateVersion`, `printedAt`, `printedById`. Tuỳ chọn thêm: lưu luôn tệp PDF đã in (`StoredFile` với `FilePurpose` mới, ví dụ `CONTRACT_PDF`; danh sách hiện có ở `schema.prisma:888`).

## 7. Phiên bản: hợp đồng đã in, đã xác nhận giữ bản cũ hay theo mẫu mới?

**Đề xuất:** hợp đồng đã xác nhận, đã in, thì **giữ bản đã in**. Lần in đầu ghi lại mẫu + bản. Khi in lại, mặc định dùng đúng bản đó, người in có thể chọn bản mới nhưng sẽ thấy cảnh báo. Hợp đồng nháp luôn dùng bản mới nhất.

Rủi ro, anh cần biết:
1. **In lại theo mẫu mới thì bản giấy khác bản khách đã ký.** Khi có tranh chấp, hai bản không giống nhau. Vì vậy mặc định phải là bản cũ.
2. **Dù giữ đúng mẫu, nội dung vẫn có thể khác** nếu sau lần in đầu hợp đồng có thay đổi: thêm dòng phát sinh, huỷ dòng, thu thêm tiền. Cách làm: bản in lần 2 ghi "In lại ngày …" và đánh dấu dòng phát sinh.
3. **Hồ sơ thương hiệu đổi** (địa chỉ, logo, số tài khoản) thì in lại sẽ ra thông tin mới. Muốn in ra y hệt hoàn toàn thì phải **lưu tệp PDF lúc in lần đầu**. Việc này tốn chỗ lưu trữ, và nếu PDF do máy chủ tạo thì máy chủ phải chạy trình duyệt. R&D đề xuất chỉ lưu PDF khi hợp đồng đã xác nhận.
4. Điều khoản thì đã an toàn: máy chủ đã chụp nội dung lúc xác nhận (`schema.prisma:688-693`).

## 8. In trên điện thoại

- Nút In trên điện thoại mở hộp in của hệ điều hành. Trên iPhone in qua AirPrint hoặc chia sẻ ra PDF; trên Android chọn "Lưu dưới dạng PDF". Bản mẫu thay nút "Tải PDF" bằng nút "PDF / Chia sẻ" (ảnh `pa*-in-390.png`).
- Xem trước tờ A4 trên màn 390 px được thu nhỏ cho vừa bề ngang. Khi in vẫn ra A4 thật.
- **Chưa thử trên máy thật.** Cần thử trên iPhone (Safari và app đã thêm ra màn hình chính) và Android (Chrome). Hai điểm cần kiểm: số trang/ký nháy ở chân trang (mục 4.4), và màu nền/khung viền khi in. Nếu Safari in không đạt, phương án dự phòng là **máy chủ tạo PDF** (thêm khoảng 2–3 buổi, và máy chủ cần có Chromium).

## 9. Ước lượng công sức (buổi làm việc ≈ 4 giờ)

**Phần chung, phương án nào cũng phải làm:**

| Việc | Máy chủ | Web |
|---|---|---|
| Dữ liệu in gom một chỗ: hợp đồng + hồ sơ thương hiệu + lớp + phiếu thu | 1 | — |
| Trường mới: ngân hàng, người đại diện (thêm cả ô ở màn Hồ sơ thương hiệu) | 0,5 | 0,5 |
| Trường mới: CCCD, địa chỉ khách | 0,5 | 0,5 |
| 5 bố cục thành component in thật (đã có bản R&D chạy được) + đọc số thành chữ + bài thử | — | 3,5 |
| **Nút In cho hợp đồng dịch vụ** + hộp "In hợp đồng" (chọn mẫu, xem từng trang) | — | 1,5 |
| Thẻ chọn điều khoản cho hợp đồng dịch vụ (hiện mới có ở khoá học) | — | 0,5 |
| Nhật ký in `ContractPrint` (giữ bản cũ khi in lại) | 1 | 0,5 |
| Bài in Playwright 5 × 2 × 2 trong bộ thử sản phẩm (dựa trên `kiem-in-thu.js`) + thử điện thoại | — | 1,5 |
| **Cộng phần chung** | **3** | **8,5** |

**Phần riêng của từng phương án, cộng thêm vào phần chung:**

| | Máy chủ | Web | Tổng cả phần chung |
|---|---|---|---|
| **PA1:** bảng mẫu in + phiên bản + mặc định theo loại; màn quản lý, màn sửa có xem trước, biến ở 3 ô chữ | +2,5 | +3,5 | **≈ 17–18 buổi** |
| **PA2:** khối có thứ tự + cài đặt từng khối (kiểm chặt), bộ dựng theo danh sách khối, trình kéo-thả + nút ↑ ↓ trên điện thoại, lịch sử/khôi phục | +4 | +10 | **≈ 25–26 buổi** |
| **PA3:** lưu văn bản có định dạng (cần **thư viện soạn chữ mới**, phải duyệt), kiểm biến, nhập tệp Word (cần thư viện đọc .docx), trình soạn chữ trên điện thoại, nên lưu PDF đã in | +5 | +10 | **≈ 27–30 buổi**, rủi ro cao |

PA1 nên thiết kế ô `blocks` dạng JSON ngay từ đầu. Sau này muốn nâng lên PA2 (đổi thứ tự khối) thì không phải đổi cấu trúc dữ liệu.

## 10. Cần anh quyết / cấp

1. **Chọn phương án:** R&D đề xuất **PA1** (≈ 17–18 buổi), PA2 làm sau nếu studio cần đổi thứ tự khối.
2. **Gửi ảnh mẫu in của ssnew** (màn danh sách mẫu, màn sửa, một bản in). R&D chưa xem được ssnew.
3. **Chọn mẫu mặc định:** R&D đề xuất dịch vụ = mẫu 2 Hiện đại, khoá học = mẫu 1 Cổ điển. Anh có muốn giữ quốc hiệu – tiêu ngữ cho hợp đồng dịch vụ không?
4. **Chính sách in lại:** đồng ý "hợp đồng đã in giữ bản đã in" không? Có cần **lưu luôn tệp PDF** lúc in lần đầu không (tốn chỗ lưu, thêm việc)?
5. **Cho phép thêm trường mới:** tài khoản ngân hàng + người đại diện (hồ sơ thương hiệu), CCCD + địa chỉ khách. Có in mã QR chuyển khoản không?
6. **Phông chữ có chân cho mẫu 1 và mẫu 5:** dùng Lora và Cormorant Garamond (giấy phép OFL, miễn phí dùng thương mại). Hai phông này phải đóng gói kèm app, mỗi phông khoảng 130 KB–1,2 MB.
7. **Một máy iPhone và một máy Android để thử in thật** trước khi chốt (mục 8).

---

### Danh mục tệp

- Báo cáo: `docs/rnd/BAO-CAO-RND-09-MAU-IN-HOP-DONG.md`
- 5 mẫu in: `docs/rnd/v9-mau-in/`
  - `in.html`, `index.html` (bảng xem nhanh)
  - `mau-1-co-dien.css` … `mau-5-sang-trong.css`
  - `chung/ban-in.js`, `chung/ban-in.css`, `chung/du-lieu.js`, `chung/logo-mau.svg`
  - `phong/` (Lora, OFL)
  - `pdf/` (20 PDF)
  - `kiem-in-thu.js` (bài in thử + tự kiểm)
- Bản mẫu màn: `docs/rnd/v9-pa1-chon-bo-cuc.html`, `docs/rnd/v9-pa2-khoi-keo-tha.html`, `docs/rnd/v9-pa3-van-ban-tu-do.html`, dùng chung `docs/rnd/v9-chung/v9.css`, `v9.js`
- Ảnh: `docs/rnd/anh-rnd09/` (55 PNG, ảnh lớn nhất 526 KB)
  - `00-bang-xem-nhanh.png`
  - `01-nguon-du-lieu-mau1-dich-vu.png`
  - `mau*-trang-*.png` (31 trang in)
  - `pa{1,2,3}-{quan-ly,sua,in}-{1440,390}.png`
  - `pa3-tu-do-*.png`
- Không sửa `apps/**`, `packages/**`; không chạy git; không truy cập kho ssnew.
