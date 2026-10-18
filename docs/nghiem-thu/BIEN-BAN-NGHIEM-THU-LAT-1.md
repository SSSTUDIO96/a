# Biên bản nghiệm thu: chấm lại Mốc 2 và chấm mới máy chủ Lát 1

- **Ngày chấm:** 18/10/2026
- **Người chấm:** thợ chấm độc lập (AI, không tham gia viết mã)
- **Bản được chấm:** commit `a3757cc`, bản sao riêng tại thư mục này
- **Cách chấm:**
  - Cài mới, chạy lại toàn bộ lệnh, build, khởi động bản build rồi gọi thật bằng curl.
  - Chạy lại bộ bài của biên bản Mốc 2.
  - Viết bài tấn công mới cho Lát 1.
  - Đọc mã `apps/api/src/**`, `apps/api/prisma/**`, `packages/shared/src/contract.ts`.
- **Cam kết:** không sửa mã sản phẩm, không commit.
- **Yêu cầu chủ đầu tư dùng để đối chiếu:** `docs/SO-Y-MUON.md`, `docs/PRD.md`.

---

## 0. Kết luận ngắn cho chủ studio

| Phần | Kết luận |
|---|---|
| **Mốc 2, chấm lại** | **ĐẠT CÓ ĐIỀU KIỆN** |
| **Máy chủ Lát 1** | **ĐẠT CÓ ĐIỀU KIỆN** |

**Mốc 2:** 9/12 lỗi của biên bản trước đã hết, kiểm bằng chính các bài thử cũ: các bài "LỖI" nay đã đỏ. Ba lỗi chưa xong hẳn:
- **L4 (cửa gác):** đã sửa phần cũ, nhưng vẫn còn một kiểu mù mới, xem mục 3.1.
- **L8 (dò email):** chưa sửa, đã ghi là rủi ro chấp nhận.
- **L12 (tài liệu):** đã có tài liệu, nhưng tài liệu đang chậm hơn mã.

**Lát 1:** phần tính tiền, phí di chuyển 3 cách, chặn trùng lịch (kể cả do giờ di chuyển và đua đồng thời), khoá hợp đồng sau xác nhận, cách ly tổ chức qua thân yêu cầu đều đứng vững trước các đòn tôi thử. Không có lỗi nghiêm trọng. Có **3 lỗi trung bình** phải sửa trước khi cho studio thật dùng:

1. **Quản lý tự nâng bậc lương của chính mình.** Quản lý không có quyền xem hay đặt tiền công, nhưng vẫn đổi được bậc lương của mình. Quản lý cũng đổi được bậc lương, tên hiển thị, cờ "nhận lịch" của **chủ tài khoản**.
2. **Chống gửi trùng nhầm giữa hai hợp đồng.** Nếu hai lần bấm dùng cùng một "mã chống gửi trùng" với cùng nội dung, lần thứ hai bị coi là gửi lại của lần đầu dù **khác hợp đồng hoặc khác dịch vụ**. Máy chủ báo "đã tạo" (201) nhưng dòng phát sinh hoặc giá mới **không được ghi**.
3. **Cửa gác cách ly vẫn mù với id nằm trong thân yêu cầu và trong tham số lọc.** Cửa gác là bài kiểm tra tự động chặn rò dữ liệu giữa các studio. Tôi cài 2 lỗi lộ dữ liệu chéo studio, cửa gác vẫn báo 0 vi phạm.

---

## 1. Bảng lệnh đã chạy và kết quả thật

Database: `makeup_test_nt`, dùng lại. Migration tự áp khi chạy test, không cần cài `btree_gist` bằng tay. Không chạy lệnh xoá database nào.

| # | Lệnh | Kết quả thật |
|---|---|---|
| 1 | `pnpm install` (bản sao mới, chưa có `node_modules`) | Xong; bước `postinstall` tự chạy `prisma generate` |
| 2 | `pnpm typecheck` (ngay sau bước 1) | Qua, 2/2 gói, 0 lỗi. **Lỗi L5 của Mốc 2 đã hết** |
| 3 | `TEST_DATABASE_URL=…makeup_test_nt pnpm test` (trước khi thêm bài của thợ chấm) | `shared` **48/48** (4 tệp). `api` **191/191** (14 tệp). Cửa gác in: scope 59/59, người ngoài 59/59, thiếu quyền 59/59, chưa đăng nhập 61/61, id chéo 30/30, lộ dữ liệu 24/24, chủ đi qua 59/59. OpenAPI 65/65 đường |
| 4 | `pnpm --filter @makeup/api build` | Thành công: `dist/server.js` 190,39 KB và `dist/scripts/run-sync-system-roles.js` |
| 5 | Chạy lại bộ bài Mốc 2: `test-nghiem-thu/tan-cong.test.ts` | 30 bài: **17 xanh / 13 đỏ**. Cả 13 bài đỏ đều là đỏ đúng mong đợi (lỗi cũ đã hết), chi tiết ở mục 2 |
| 6 | `test-nghiem-thu/cua-gac-mu.test.ts` (cửa gác mù, bản cũ) | Không nạp được: `defineRoute` từ chối đột biến 2 ngay lúc khởi động. Đây là kết quả đúng mong đợi |
| 7 | `test-nghiem-thu/gio-nhat-ky.test.ts` | 1/1 |
| 8 | Bài tấn công Lát 1: `test-nghiem-thu/lat1-tan-cong.test.ts` | **27/27**. Bài "LỖI" xanh = lỗi có thật; "CHẶN" xanh = đòn bị chặn; "GHI NHẬN" xanh = hành vi có thật, cần chủ quyết |
| 9 | Đột biến mới chạy trên chính cửa gác của dự án: `test-nghiem-thu/lat1-cua-gac.test.ts` | **3/3** (kèm 8 bài cửa gác của dự án, được nạp theo). Cửa gác báo **0 vi phạm** trên bảng đường có 2 lỗi cài sẵn |
| 10 | Khởi động bản build (`NODE_ENV=production`, cổng 4556) và chạy `test-nghiem-thu/curl/luong-lat1.sh` | **25/25** |
| 11 | 45 lần đăng nhập sai, mỗi lần đổi `x-forwarded-for` (giới hạn đặt 40/phút) | 38 lần 401 rồi 7 lần 429. **Không lách được nữa: L7 đã hết** |
| 12 | Đọc log máy chủ sau bước 10–11 | 0 dòng lỗi mức "error"; 0 lần lộ mật khẩu hoặc mã băm |

Luồng curl ở bước 10 đi đủ các bước:
1. Đăng ký, tạo tổ chức, thêm thợ.
2. Nhân vật makeup mặc định (6 nhân vật).
3. Dịch vụ phụ tóc và lens, phụ phí ca sớm, gói cô dâu (giá niêm yết 3,5 tr, giá bán 3 tr, cọc 1 tr, chỉ làm tại studio hoặc tại nhà).
4. Cài phí di chuyển 5.000 đ/km, miễn 3 km, tính hai chiều.
5. Xem trước và lập hợp đồng tại nhà 12,5 km, khách mới, có dịch vụ phụ và phụ phí:
   - Tổng **3.610.000 đ** = 3.000.000 + 300.000 + (12,5 km × 2 chiều − 3 km miễn = 22 km × 5.000 đ = 110.000) + 200.000.
   - Xem trước và hợp đồng tạo ra khớp từng đồng.
6. Xác nhận hợp đồng → giảm giá sau xác nhận bị chặn (409) → thêm phát sinh 500.000, tổng thành 4.110.000, dòng được đánh dấu "thêm sau xác nhận".
7. Tạo lịch gắn dòng gói, có 45 phút di chuyển trước và 30 phút sau. Khoảng bận tính từ 03:15 đến 07:30 giờ VN.
8. Thử tạo lịch khác lúc 04:00–04:30 cùng thợ → 409 "Trùng lịch: Nguyễn Thị Hoa đã có lịch LH-000001".
9. Tạo bậc lương, gán bậc, đặt tiền công gói 450.000; số lẻ bị chặn (400).
10. Nhật ký có đủ 18 hành động.

---

## 2. Chấm lại Mốc 2: từng lỗi L1–L12

| Lỗi | Trước | Bây giờ | Bằng chứng |
|---|---|---|---|
| **L1** Quản lý hạ, khoá, cho rời Quản trị | 200/200/204 | **403/403/403. Đã hết** | 3 bài "LỖI" nhóm 2 của `tan-cong.test.ts` chuyển đỏ. Gốc sửa: `apps/api/src/modules/orgs/guards.ts:455-463` |
| **L2** Tước quyền khỏi vai trò mạnh hơn | 200 | **403. Đã hết** | Bài "LỖI" nhóm 2 chuyển đỏ. `guards.ts:467-469` |
| **L3** Kiểm quyền trước, khoá sau | Bài cố định: 200. Đua thật: 12–14/15 lượt | **Bài cố định: 403. Đua thật: 0/15. Đã hết** | Nhóm 5. Hàm `lockOrgAndRecheck` (`apps/api/src/http/middleware.ts:415-422`) được dùng ở mọi đường đổi người và vai trò trong `orgs/routes.ts` |
| **L4** Cửa gác mù | 3 kiểu mù | **Đã chặn 3 kiểu cũ. Mù kiểu mới (mục 3.1)** | Đột biến 2 cũ bị `route.ts:78-79` từ chối khi khởi động; đột biến 1 và 3 cũ được `test/gate-mutants.test.ts` bắt |
| **L5** Máy mới cài hỏng typecheck/test | 25 lỗi; 4/5 tệp hỏng | **Qua. Đã hết** | Dòng 1–3 bảng lệnh; `apps/api/package.json` có `postinstall` |
| **L6** `\u0000`, thân quá lớn, mã nén lạ → 500 | 500 | **400 cả ba. Đã hết** | Nhóm 8 chuyển đỏ. `apps/api/src/app.ts:127-137`, `middleware.ts:350-356` |
| **L7** Lách giới hạn tốc độ bằng `x-forwarded-for` | 8/8 lách được | **Không lách được (mặc định 0 lớp proxy). Đã hết** | Dòng 11 bảng lệnh; `apps/api/src/env.ts`, `app.ts:121` |
| **L8** Dò email qua đăng ký | 409 "đã được đăng ký" | **Chưa sửa.** Đã ghi là rủi ro chấp nhận tại `docs/SECURITY.md:104` | Bài "LỖI" nhóm 7 vẫn xanh |
| **L9** Mật khẩu > 72 byte bị cắt | Đăng nhập được bằng mật khẩu khác | **Đăng ký bị chặn 400. Đã hết** | `apps/api/src/modules/auth/routes.ts` (luật `Password`) |
| **L10** Báo động "đánh cắp" giả sau đăng xuất | Có | **Không còn. Đã hết** | Bài "LỖI" nhóm 9 chuyển đỏ; cột mới `revoke_reason` |
| **L11** Thiếu nhật ký | Thiếu đăng nhập, đăng nhập sai, đăng xuất, đổi thẻ; "cho rời" không ghi vai trò | **Đã có** đăng nhập, đăng nhập sai, đăng xuất; "cho rời" có ghi vai trò. **Còn thiếu:** đổi thẻ (refresh) | Bài nhóm 9: một tài khoản đi qua đăng nhập, đăng nhập sai, đổi thẻ, đăng xuất có đúng 4 dòng nhật ký (kể cả `user.registered`) |
| **L12** Tài liệu Mốc 2 không có | Không có | **Đã có** PRD, API, kiến trúc, cơ sở dữ liệu, bảo mật, triển khai, kế hoạch thử, `.env.example`. **Nhưng chậm hơn mã**, xem lỗi N4 ở mục 3.3 | `docs/*.md`, `apps/api/.env.example` |

Hai bài "CHẶN" cũ chuyển đỏ nhưng **không phải hồi quy**:
- "Quản trị thêm lại người đã REMOVED": bài này dựa vào việc lỗi L1 đã đẩy Quản trị ra khỏi tổ chức. Nay L1 hết nên Quản trị không bị đẩy ra, thêm lại thì 409.
- "lỗi 500 không lộ stack": nay không còn 500 nữa, máy chủ trả 400.

Các bài "CHẶN" còn lại vẫn xanh: truy cập chéo, uuid sai, tự nâng quyền qua vai trò tuỳ chỉnh, chủ cuối cùng (kể cả đua 10/10), refresh token.

**Kết luận Mốc 2: ĐẠT CÓ ĐIỀU KIỆN.**
- Điều kiện 1: cửa gác phủ thêm id trong thân yêu cầu và trong tham số lọc (lỗi T3).
- Điều kiện 2: tài liệu cập nhật theo mã hiện tại (lỗi N4).
- L8 do chủ quyết giữ hay sửa: đã ghi rủi ro, giới hạn 10 lần/phút/IP.

---

## 3. Máy chủ Lát 1

### 3.0 Chấm ĐÚNG / ĐẠT / ĐẸP

| Mục | ĐÚNG | ĐẠT | ĐẸP |
|---|---|---|---|
| **Bảng giá v2** (nhân vật, dịch vụ chính/phụ/phụ phí, gói, địa điểm cho phép, giá theo phiên bản) | ✔ Đủ các ý trong lời anh Chiến: tên gói, nhân vật, địa điểm, tick dịch vụ phụ | ✔ Giá chỉ ghi thêm (trigger database chặn sửa, xoá); giá khuyến mại không vượt giá niêm yết; trỏ sang danh mục, nhân vật, dịch vụ của tổ chức khác bị chặn (400) | ✔ Một hàm tra giá duy nhất (`catalog/prices.ts:326`) |
| **Phí di chuyển 3 cách** (cố định, theo km, nhập tay) | ✔ Tại nhà hoặc địa điểm khác bắt buộc có dòng phí; miễn phí thì nhập tay 0 đ; theo km làm tròn lên bội 1.000 đ | ✔ Tính bằng số nguyên (phần trăm km × đơn giá); km 3 chữ số lẻ, km khổng lồ, số tiền gửi sai cách → 400. ⚠ Bỏ trống loại địa điểm thì lọt luật "không được quên phí" (N1) | ✔ Công thức dùng chung ở `packages/shared/src/contract.ts:109-139` |
| **Hợp đồng** (nhiều dòng, dịch vụ phụ, phụ phí, phát sinh, huỷ dòng, xác nhận) | ✔ Đúng lời anh: "chọn hoặc thêm nhiều gói nhiều loại phụ phí phát sinh"; xem trước khớp từng đồng với hợp đồng tạo từ cùng nội dung | ✔ Sau xác nhận: 6 đường đổi tiền hoặc điều khoản qua API đều bị chặn (409); chỉ thêm dòng hoặc huỷ dòng có lý do. ✘ Chống gửi trùng nhầm giữa hai hợp đồng (T1). ⚠ Lớp database chỉ khoá dòng, không khoá hợp đồng (N3) | ✔ Một hàm dựng bảng tính cho xem trước, tạo, sửa nháp (`contracts/sheet.ts:491`) |
| **Khách + lịch** | ✔ Phân thợ chính và thợ phụ, giờ di chuyển trước và sau, lịch sử trạng thái, chặn trùng | ✔ Trùng do giờ di chuyển → 409; sát mép thì được; 8 yêu cầu đồng thời → đúng 1 lịch; 2 lịch cùng bị dời vào một giờ → 200 + 409, không 500; lịch nháp được chồng nhưng xác nhận thì 409. ⚠ Thợ đã tắt "nhận lịch" vẫn bị xếp (N2) | ✔ Khoảng bận do database tự tính (`migration 20261018160000:156-188`) và database có ràng buộc chặn chồng giờ |
| **Nhân sự & bậc lương, tiền công theo bậc** | ✔ Hồ sơ thợ (tên, ảnh, chữ viết tắt), bậc lương, tiền công theo gói hoặc dịch vụ cho từng bậc, đúng mô tả "hiển thị cấp bậc kèm avatar tên rồi nhập số tiền" | ✘ Quản lý tự nâng bậc của mình và đổi hồ sơ của chủ (T2). ✔ Số lẻ, số âm, chuỗi, bậc trùng, bậc đang ẩn, bậc của tổ chức khác → 400 | ✔ |
| **Cách ly tổ chức ở Lát 1** | ✔ Cửa gác của dự án phủ 59 đường | ✔ Đã thử 20 kiểu gắn id của tổ chức A vào thân yêu cầu hoặc tham số lọc của tổ chức B: 20/20 bị chặn. Database có khoá ngoại kép ở mọi chỗ trỏ sang tài nguyên khác. ✘ Cửa gác tự động không nhìn thấy kiểu lỗi này (T3) | ✔ |
| **Quyền theo vai trò mẫu** | ✔ Thợ chỉ thấy lịch mình; lễ tân lập hợp đồng nhưng không đổi giá, không đặt phí di chuyển, không đặt tiền công; kế toán không lập hợp đồng | ✘ T2. ⚠ Các mục "ghi nhận" ở 3.4 cần chủ quyết | — |

### 3.1 Lỗi TRUNG BÌNH (đã tái hiện)

**T1. Chống gửi trùng (Idempotency-Key) nhầm giữa các bản ghi khác nhau, và báo thành công giả**
- **Giải thích bằng lời thường:** mỗi lần bấm "Lưu", ứng dụng gửi kèm một mã để máy chủ nhận ra "đây là bấm lại", tránh tạo hai lần. Máy chủ chỉ so mã + nội dung + **mẫu** đường dẫn (`/contracts/:contractId/lines`), không so hợp đồng **thật** nào.
- **Triệu chứng:**
  - Thêm dòng phát sinh 500.000 đ vào hợp đồng 1, rồi dùng lại cùng mã, cùng nội dung cho hợp đồng 2: máy chủ trả 201 kèm **nội dung của hợp đồng 1**. Hợp đồng 2 **không** được thêm dòng, tổng vẫn 800.000.
  - Tương tự với đổi giá: dịch vụ "Nail" báo 201 mà giá vẫn 150.000.
- **Tái hiện:** `test-nghiem-thu/lat1-tan-cong.test.ts`, nhóm 5, hai bài "LỖI".
- **Gốc bệnh:**
  - `apps/api/src/app.ts:213-214`: `routeKey` là mẫu đường dẫn, không phải đường dẫn thật; mã băm chỉ tính trên thân yêu cầu.
  - `app.ts:224-230`: thấy trùng thì trả lại kết quả cũ.
- **Điều kiện xảy ra:** máy khách dùng lại một mã cho hai thao tác. Ví dụ: giao diện sinh mã theo nội dung form, hoặc thao tác "áp cùng phụ phí cho nhiều hợp đồng".
- **Vì sao trung bình:** hậu quả là **mất ghi tiền mà báo thành công**.

**T2. Quản lý tự nâng bậc lương của chính mình; đổi hồ sơ của chủ tài khoản**
- **Triệu chứng:**
  - Quản lý có quyền "sửa hồ sơ thợ, gán bậc lương", nhưng **không** có quyền xem hay đặt tiền công. Gửi `PATCH /staff/<chính mình> {tierId: "Bậc 5"}` → 200. Quản lý không xem được bảng tiền công (403), nhưng tự đưa mình vào bậc có tiền công cao hơn.
  - Quản lý cũng đổi được bậc lương, tên hiển thị và tắt "nhận lịch" của **chủ tài khoản** → 200.
- **Tái hiện:** `lat1-tan-cong.test.ts`, nhóm 6, hai bài "LỖI".
- **Gốc bệnh:** `apps/api/src/modules/staff/profiles.ts:314-334` không có luật "không tự gán bậc cho mình" và không có luật thứ bậc kiểu L1 (`guards.ts:455`). Vai trò Quản lý có `staff.write` theo mẫu: `packages/shared/src/permissions.ts`, mục `manager`.
- **Vì sao trung bình:** tiền công thật chưa được tính trong lát này, nhưng bậc là đầu vào trực tiếp của bảng tiền công.

**T3. Cửa gác cách ly mù với id nằm trong THÂN yêu cầu và trong THAM SỐ LỌC**
- **Triệu chứng:** tôi chạy đúng `test/gate.ts` và `SAMPLES` của dự án trên một bảng đường có 2 lỗi cài sẵn. Kết quả: 7 phép kiểm, **0 vi phạm**, trong khi:
  - **Đột biến A**, "xem trước hợp đồng" tra khách chỉ theo `customerId` trong thân: chủ studio B đọc được **tên và số điện thoại khách của studio A**.
  - **Đột biến B**, danh sách hợp đồng quên điều kiện tổ chức khi có `?customerId=`: chủ B liệt kê được **hợp đồng của A**.
- **Tái hiện:** `test-nghiem-thu/lat1-cua-gac.test.ts`, 3/3.
- **Gốc bệnh:**
  - `apps/api/test/gate.ts:162`: phép "id chéo" chỉ xét đường có id **trong đường dẫn**. Các đường tạo (`POST /contracts`, `/contracts/quote`, `/appointments`, `/packages`…) mang id trong thân nên không được xét.
  - `gate.ts:197-202`: phép "lộ dữ liệu" chỉ gọi các đường xem **không có tham số lọc**, và không xét đường POST.
- **Lưu ý:** mã thật hôm nay **không** có hai lỗi này. Tôi đã tự thử 20 kiểu gắn id chéo (nhóm 1 của `lat1-tan-cong.test.ts`), tất cả bị chặn, và database có khoá ngoại kép. Lỗi nằm ở lưới an toàn cho các lần sửa sau.

### 3.2 Lỗi NHẸ (đã tái hiện)

**N1. Bỏ trống loại địa điểm thì lọt luật "không được quên phí di chuyển"**
- **Triệu chứng:** dòng dịch vụ có `address: "12 Nguyễn Trãi, nhà khách"` nhưng không gửi `locationType` → 201, không có dòng phí di chuyển.
- **Tái hiện:** nhóm 2, bài "LỖI (nhẹ)".
- **Gốc bệnh:** `apps/api/src/modules/contracts/schemas.ts:36` (`locationType` tuỳ chọn); `contracts/sheet.ts:340-361` chỉ bắt phí khi `locationType` là CUSTOMER_HOME hoặc OTHER. Gói không giới hạn địa điểm và dòng dịch vụ lẻ đều lọt.

**N2. Thợ đã tắt "nhận lịch" vẫn bị xếp lịch**
- **Triệu chứng:** đặt `isBookable: false` cho thợ, rồi tạo lịch CONFIRMED cho thợ đó → 201.
- **Tái hiện:** nhóm 3, bài "LỖI (nhẹ)".
- **Gốc bệnh:** `apps/api/src/modules/schedule/service.ts:169-183` (`assertActiveStaff`) chỉ xét thành viên còn hoạt động. Ngoài module nhân sự, không chỗ nào trong `apps/api/src` đọc `isBookable`.

**N3. Lớp database chỉ khoá DÒNG hợp đồng đã xác nhận, không khoá chính HỢP ĐỒNG**
- **Triệu chứng:**
  - Ghi thẳng vào database: đổi `subtotal` và `total` của hợp đồng đã xác nhận (vẫn đúng công thức total = subtotal − giảm giá) → database cho qua.
  - Đổi trạng thái về `DRAFT` → trigger khoá dòng hết tác dụng → sửa giá dòng → đổi lại `CONFIRMED`. Kết quả: hợp đồng "đã xác nhận" với tổng 1 đ.
- **Tái hiện:** nhóm 4, bài "LỖI (nhẹ, lớp database)".
- **Gốc bệnh:** `apps/api/prisma/migrations/20261018160000_chot_chan_database/migration.sql:199-219` chỉ có trigger trên `contract_lines`; bảng `contracts` không có trigger chặn lùi trạng thái hay đổi tiền sau xác nhận.
- **Mức độ:** nhẹ. Qua API thì không làm được (mọi đường đều 409). Đây là lớp phòng thủ thứ hai.

**N4. Tài liệu chậm hơn mã**
- **Triệu chứng:**
  - `docs/API_SPEC.md:3` ghi bảng đường lấy từ `auth` và `orgs`; cả tệp chỉ có 1 dòng nhắc tới hợp đồng, lịch hoặc tiền công, trong khi mã có 65 đường.
  - `docs/DEPLOYMENT.md:52` ghi `TRUST_PROXY_HOPS` "đang thêm, chưa lưu vào kho", nhưng mã đã có.
  - `docs/DEPLOYMENT.md:82` ghi `db:sync-roles` "không nằm trong bản build", nhưng bản build đã có `dist/scripts/run-sync-system-roles.js`.
  - `docs/TEST_PLAN.md:73,80` còn số 36/36 và "đỏ 4 ca".
  - `docs/PRD.md:53` ghi Kế toán "chỉ xem", nhưng vai trò này có `payroll.write`. `PRD.md:57` có tự ghi chú là bảng đã cũ.
- **Tái hiện:** đọc các dòng trên và so với bảng lệnh ở mục 1.

**Còn lại từ Mốc 2**
- **L8** (dò email): đã ghi là rủi ro chấp nhận.
- **L11 (phần còn lại):** đổi thẻ (refresh) không có nhật ký.

### 3.3 Đã tấn công và KHÔNG phá được (bài "CHẶN" đều xanh)

**Tiền**

| Thử | Kết quả |
|---|---|
| Đơn giá lẻ, âm, dạng chuỗi, 1e21; số lượng lẻ hoặc 0; vượt ngưỡng số nguyên an toàn | 400 |
| Giảm giá vượt tổng; cọc vượt tổng; giảm giá dòng vượt thành tiền | 400 |
| Phụ phí ghi đè giá mà thiếu lý do | 400 |
| Km có 3 chữ số lẻ; km khổng lồ | 400 |
| Nhập tay thiếu số tiền; theo km mà gửi kèm số tiền | 400 |
| Tại nhà thiếu phí; tại studio có phí | 400 |
| Thêm dòng làm tổng vượt ngưỡng | 400, hợp đồng giữ nguyên |

Tổng cộng 17/17 trường hợp trả 400, không trường hợp nào ra 500.

Ba cách tính phí trong cùng một hợp đồng ra đúng từng đồng. Ví dụ theo km: 3,33 km × 2 chiều − 3 km miễn = 3,66 km × 5.000 = 18.300, làm tròn lên **19.000**. Xem trước khớp hợp đồng ở tổng, tạm tính và cọc.

**Lịch**

| Thử | Kết quả |
|---|---|
| Lịch chồng vào giờ di chuyển sau của lịch khác | 409 |
| Lịch có giờ di chuyển trước chồng vào lịch khác | 409 |
| Lịch sát mép (bắt đầu đúng lúc lịch trước hết bận) | 201 |
| 8 yêu cầu tạo đồng thời cùng thợ, cùng giờ | 1 thành công / 7 bị 409 |
| 2 lịch cùng bị dời vào một giờ, gửi đồng thời | 200 + 409 |
| Xác nhận lịch nháp đang chồng giờ | 409 |
| Huỷ lịch kia rồi xác nhận lại | 200 |

**Hợp đồng sau xác nhận, qua API**

| Thử | Kết quả |
|---|---|
| Đổi giảm giá, cọc, điều khoản, ngày sự kiện, thay dòng; lùi trạng thái về nháp | 409 cả 6 |
| Huỷ dòng mà không nêu lý do | 400 |
| Gửi thêm trường lạ (`subtotal`) | 400 |
| Sửa ghi chú | 200 |
| Thêm phát sinh | 201, tổng đúng |

**Chống gửi trùng:** 5 yêu cầu cùng mã, cùng hợp đồng gửi đồng thời → đúng 1 dòng.

**Gắn tài nguyên khác tổ chức**

| Thử | Kết quả |
|---|---|
| Hợp đồng và xem trước: khách, gói, dịch vụ, dịch vụ phụ, phụ phí, nhân vật, studio của A | 7/7 bị 404, không lộ tên khách |
| Lịch: khách, hợp đồng của A | 404 |
| Lịch: dòng hợp đồng của A; thợ của A (tạo và sửa) | 400 |
| Gói (dịch vụ, nhân vật), dịch vụ (danh mục), hồ sơ thợ (bậc), tiền công (bậc) trỏ sang A | 400 cả 6 |
| Lọc danh sách của B bằng `customerId` hoặc `membershipId` của A | Rỗng |

**Vai trò mẫu**
- Thợ makeup: chỉ thấy lịch mình. Lịch người khác → 404. Xem hợp đồng, khách, tiền công, xem trước hợp đồng → 403. Sửa lịch → 403.
- Lễ tân: đổi giá, đặt phí di chuyển, đặt tiền công, gán bậc → 403.

**Tiền công:** số lẻ, số âm, chuỗi, bậc gửi trùng → 400. Ẩn bậc còn thợ → 409. Đặt tiền công cho bậc đang ẩn → 400. Đặt `null` thì xoá mức.

**Tham số tìm kiếm** chứa `%00` → không trả 500.

### 3.4 Ghi nhận: hành vi có thật, cần chủ quyết (chưa xếp là lỗi)

- **G1.** Huỷ hợp đồng (hoặc huỷ dòng) **không** huỷ lịch đã gắn. Thợ vẫn bị giữ giờ, lịch khác cùng giờ bị 409. Bài: nhóm 3, "GHI NHẬN". Có thể là chủ ý (huỷ lịch là bước riêng), nhưng dễ quên.
- **G2.** Lễ tân không có quyền đổi giá, nhưng vẫn đưa hợp đồng về **0 đ** bằng giảm giá dòng, và huỷ được dòng của hợp đồng **đã xác nhận** (có ghi lý do, có nhật ký). Bài: nhóm 6.
- **G3.** Kế toán đặt được tiền công (`payroll.write`), trong khi `docs/PRD.md:53` ghi "Kế toán: chỉ xem". Bài: nhóm 6.
- **G4.** Hợp đồng nhận **mọi** dịch vụ phụ của tổ chức. Danh sách "dịch vụ phụ được tick" cài trong gói (`isOptional`) không giới hạn lựa chọn khi lập hợp đồng (`contracts/sheet.ts:382-399` chỉ chặn trùng với dịch vụ đã gồm trong gói). Cần chủ chốt nghĩa của câu "tùy chọn tick các dịch vụ phụ… để người dùng cài đặt".
- **G5.** Thợ makeup (quyền `staff.read`) xem được số điện thoại của mọi thợ khác. Lịch của mình cũng hiện số điện thoại khách, dù thợ không có quyền xem khách.

---

## 4. Nghi ngờ, chưa tái hiện

1. **Mã chống gửi trùng có thể kẹt vĩnh viễn.** Nếu máy chủ chết giữa lúc xử lý, dòng giữ chỗ (trạng thái 0) không bao giờ được xoá, nên gửi lại bằng mã đó luôn bị 409 "đang xử lý" (`app.ts:217-231`). Chưa tái hiện (phải giết tiến trình đúng lúc).
2. **Có thể tạo trùng khi gửi lại.** Ghi giữ chỗ, chạy thao tác và lưu kết quả là 3 bước tách rời, không chung một transaction (`app.ts:218-238`). Nếu thao tác đã xong mà bước lưu kết quả lỗi, mã bị nhả (`app.ts:242`), và gửi lại sẽ tạo bản ghi thứ hai. Chưa tái hiện.
3. **Chặn `\u0000` có thể chặn nhầm chữ hợp lệ.** Máy chủ dò chuỗi `\u0000` trên dữ liệu thô (`app.ts:132`), nên một ghi chú hợp lệ chứa đúng chữ `\u0000` (ví dụ đường dẫn tệp có dấu gạch chéo ngược) có thể bị 400 nhầm. Chưa chạy thử.
4. **Đổi phiên bản Prisma có thể làm lỗi trùng lịch thành 500.** Máy chủ nhận ra lỗi trùng lịch của database bằng cách dò mã lỗi trong câu thông báo của Prisma (`middleware.ts:367-376`). Bản Prisma khác có thể đổi câu đó. Hiện bài `exclusion-error.test.ts` của dự án đang giữ.
5. **Chặn trùng lịch trên Supabase chưa được thử.** Ràng buộc này cần `btree_gist`; `docs/DEPLOYMENT.md:81` cũng tự ghi là chưa thử.

---

## 5. Kết luận

| Phần | Kết luận | Điều kiện |
|---|---|---|
| **Mốc 2 (chấm lại)** | **ĐẠT CÓ ĐIỀU KIỆN** | 1) Cửa gác phủ id trong thân yêu cầu và trong tham số lọc (T3). 2) Tài liệu cập nhật theo mã (N4). L8 do chủ quyết |
| **Lát 1 (máy chủ)** | **ĐẠT CÓ ĐIỀU KIỆN** | Sửa **T1** (chống gửi trùng phải gắn với đường dẫn thật, khác bản ghi thì từ chối) và **T2** (không tự gán bậc cho mình; luật thứ bậc cho hồ sơ thợ) trước khi studio thật dùng. T3 như trên. N1–N3 vào danh sách tồn đọng. G1–G5 chờ chủ quyết |

Sửa xong thì chạy lại `npx vitest run test-nghiem-thu` trong `apps/api`. Các bài "LỖI" tương ứng phải chuyển sang đỏ.

---

## 6. Tệp bằng chứng

Tất cả nằm trong `apps/api/test-nghiem-thu/` của bản sao này, chưa commit.
- `tan-cong.test.ts`, `cua-gac-mu.test.ts`, `gio-nhat-ky.test.ts`: bộ bài Mốc 2, chép nguyên từ lần chấm trước.
- `lat1-tan-cong.test.ts`: 27 bài tấn công Lát 1.
- `lat1-cua-gac.test.ts`: 2 đột biến mới, chạy trên cửa gác của dự án.
- `curl/luong-lat1.sh`: luồng thật vào bản build (cổng 4556).
- `curl/smoke.sh`, `curl/badinput.sh`: bản cũ, dùng cổng 4555.

Lệnh chạy lại:
```
cd apps/api
TEST_DATABASE_URL=postgresql://makeup:makeup_local@localhost:5432/makeup_test_nt npx vitest run test-nghiem-thu
```

Lưu ý: chạy `pnpm test` ở gốc bây giờ sẽ gom luôn các tệp trên. Riêng `cua-gac-mu.test.ts` sẽ báo đỏ khi nạp, vì mã mới chặn đúng đột biến của nó. Số 191/191 ở mục 1 đo trước khi chép các tệp này vào.
