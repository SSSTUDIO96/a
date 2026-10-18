# Biên bản nghiệm thu Mốc 2: nền móng máy chủ Makeup Pro

- **Ngày chấm:** 18/10/2026
- **Người chấm:** thợ chấm độc lập (AI, không tham gia viết mã)
- **Bản được chấm:** commit `7572db8`, bản sao riêng tại thư mục này
- **Cách chấm:** chạy lại toàn bộ lệnh, khởi động bản build rồi gọi thật bằng curl, viết bài thử tấn công riêng, đọc mã `apps/api/src/**` và `apps/api/prisma/**`. Không sửa mã sản phẩm, không commit.

---

## 0. Kết luận ngắn cho chủ studio

**KẾT LUẬN: KHÔNG ĐẠT (ở lần chấm này).**

Những phần đã làm chắc:
- **Cách ly giữa các studio:** người của studio B không đọc hay sửa được gì của studio A, kể cả khi cố tình dán mã nhân sự hay mã vai trò của A vào đường dẫn của B.
- **Tự nâng quyền trực tiếp bị chặn.**
- **Luôn còn chủ tài khoản:** không đường nào làm studio mất chủ cuối cùng.
- **Đăng nhập và phiên đăng nhập** chống dùng lại thẻ và chống bấm trùng.

Lý do chưa đạt: có **1 lỗi nghiêm trọng** và **3 lỗi trung bình** nằm đúng trong phạm vi đã hứa:

1. **Quản lý khoá hoặc hạ được Quản trị.** Ngay với các vai trò có sẵn, một "Quản lý" (5 quyền) hạ được "Quản trị" (9 quyền) xuống "Thợ makeup", hoặc tạm khoá Quản trị. Sau đó Quản trị không tự lấy lại quyền được.
2. **Người vừa bị hạ quyền vẫn ra lệnh được trong một khoảnh khắc.** Ví dụ: một đồng chủ đang bị hạ xuống thợ vẫn kịp trao quyền chủ cho người khác. Tôi đua thật qua API 3 lần, mỗi lần 15 lượt; lần lượt 12, 13 và 14 trong 15 lượt thì thao tác của người đã bị hạ vẫn được chấp nhận.
3. **Máy mới cài không chạy được kiểm tra.** Trên máy vừa cài, `pnpm typecheck` báo 25 lỗi và `pnpm test` hỏng 4/5 tệp. Phải chạy lệnh build trước thì mới qua.
4. **Bài kiểm tra tự động bảo vệ cách ly có chỗ không nhìn thấy.** Bài này tên là "cửa gác cách ly" (`test/tenant-isolation.test.ts`). Tôi cài sẵn lỗi lộ dữ liệu chéo studio vào mã mà nó vẫn báo "qua". Hôm nay mã chưa có lỗi đó, nhưng sau này ai thêm đường mới có lỗi kiểu này thì cửa gác không báo.

Khối lượng sửa của cả 4 lỗi đều nhỏ, mỗi lỗi chỉ ở một vài chỗ trong mã. Sửa xong thì chạy lại các bài thử trong `apps/api/test-nghiem-thu/` để chấm lại.

---

## 1. Bảng lệnh đã chạy và kết quả thật

Môi trường: PostgreSQL 16 tại máy, database riêng `makeup_test_nt` (tạo bằng `createdb`; không chạy lệnh xoá database nào).

| # | Lệnh | Kết quả thật |
|---|---|---|
| 1 | `pnpm install` (ở gốc bản sao mới) | Xong 255 gói. **Prisma client không được sinh** (cảnh báo "could not find your Prisma schema"). Prisma client là phần mã tự sinh để máy chủ nói chuyện với database. |
| 2 | `pnpm typecheck` (ngay sau bước 1) | **HỎNG: 25 lỗi TypeScript** ở `apps/api` (`Prisma.MembershipSelect`, `InputJsonValue`… không tồn tại) |
| 3 | `TEST_DATABASE_URL=…makeup_test_nt pnpm test` (ngay sau bước 1) | `packages/shared`: 8/8 qua. `apps/api`: **4/5 tệp hỏng** ("@prisma/client did not initialize yet"); chỉ 3/3 bài của `guards.test.ts` chạy được |
| 4 | `pnpm --filter @makeup/api build` | Thành công: `prisma generate` rồi `tsup`, ra `dist/server.js` 39,09 KB |
| 5 | `pnpm typecheck` (sau bước 4) | Qua, 2/2 gói, 0 lỗi |
| 6 | `TEST_DATABASE_URL=…makeup_test_nt pnpm test` (sau bước 4, trước khi thêm bài thử của thợ chấm) | `shared` **8/8**. `api` **35/35** bài, 5/5 tệp. Cửa gác tự in: người ngoài bị chặn 10/10, thiếu quyền bị chặn 10/10, chưa đăng nhập bị chặn 12/12, chủ đi qua 10/10. OpenAPI 16/16 đường |
| 7 | Khởi động bản build: `NODE_ENV=production PORT=4555 … node dist/server.js` | Chạy được, `/health` trả 200, có đủ header bảo vệ (helmet) |
| 8 | `test-nghiem-thu/curl/smoke.sh`: gọi thật bằng curl toàn bộ luồng (đăng ký → đăng nhập → refresh → dùng lại thẻ → tạo tổ chức → thêm/sửa/xoá thành viên → vai trò tuỳ chỉnh → nhật ký → đăng xuất) | **24/24** đúng mong đợi |
| 9 | `test-nghiem-thu/curl/badinput.sh`: dữ liệu xấu và giới hạn tốc độ | JSON hỏng → 400 ✔; kiểu sai → 400 ✔; email 309 ký tự → 400 ✔. Thân 200 KB → **500** ✘; mã nén lạ → **500** ✘; ký tự rỗng `\u0000` trong họ tên → **500** ✘. Giới hạn 5 lần/phút: cùng địa chỉ thì lần thứ 6 bị 429 ✔; đổi header `x-forwarded-for` mỗi lần thì **8/8 lần không bị chặn** ✘ |
| 10 | Đọc log máy chủ sau bước 8 và 9 | 0 lần lộ mật khẩu, 0 mã băm `$2b$`, 0 thẻ `eyJ…`; header `authorization` luôn hiện `[ẩn]` (15/15). Lỗi 500 không trả stack ra ngoài |
| 11 | `cd apps/api && TEST_DATABASE_URL=…makeup_test_nt npx vitest run test-nghiem-thu` (bài thử của thợ chấm) | **34/34**, 3 tệp. Bài tên "LỖI:" qua nghĩa là lỗi **có thật**; bài "CHẶN:" qua nghĩa là đòn đó **bị chặn** |
| 12 | Đua thật qua API (bài 5b), chạy 3 lần | Thao tác của người đã bị hạ vẫn được chấp nhận: **12/15, 13/15, 14/15** lượt |

Lưu ý: các bài thử của thợ chấm nằm trong `apps/api/test-nghiem-thu/`, chưa commit. Nếu chạy `pnpm test` ở gốc bây giờ, vitest sẽ gom luôn các tệp này (35 + 34 bài). Số 35/35 ở dòng 6 đo trước khi thêm chúng.

---

## 2. Chấm theo từng mục đã hứa

Ba thước đo:
- **ĐÚNG:** có làm đúng việc đã hứa không.
- **ĐẠT:** có đủ chắc trước tấn công không.
- **ĐẸP:** có phá thứ khác, có gọn và dễ giữ không.

| Mục | ĐÚNG | ĐẠT | ĐẸP |
|---|---|---|---|
| **Đăng ký, đăng nhập, refresh xoay vòng, đăng xuất, /auth/me** | ✔ Có đủ 5 đường; curl 24/24 | ⚠ Một phần. Chặn được: dùng lại thẻ cũ (thu hồi cả họ thẻ), 5 yêu cầu đổi cùng thẻ một lúc (chỉ 1 thành công), thẻ sau đăng xuất, thẻ sau khi khoá tài khoản. Chưa chắc: dò được email đã đăng ký (L8), mật khẩu quá 72 byte bị cắt (L9), lách giới hạn tốc độ khi chạy không có proxy (L7), báo động "bị đánh cắp" giả sau đăng xuất (L10) | ✔ Thẻ refresh chỉ lưu bản băm; access token ký cố định thuật toán HS256 |
| **Tổ chức, thành viên** | ✔ Tạo, xem, sửa tổ chức; thêm, đổi vai trò, tạm khoá, cho rời, thêm lại người đã rời | ✘ **Không đạt**: người có quyền "đổi nhân sự" hạ, khoá hoặc cho rời được người có nhiều quyền hơn mình, miễn người đó không phải chủ (L1) | ✔ Cho rời không xoá dữ liệu, có giữ lịch sử |
| **Vai trò hệ thống + tuỳ chỉnh** | ✔ 9 vai trò hệ thống chép vào mỗi tổ chức; vai trò tuỳ chỉnh từ chối quyền lạ và từ chối mượn mã hệ thống | ✘ Người có quyền "sửa vai trò" tước được quyền khỏi một vai trò đang mang quyền mà chính họ không có (L2) | ✔ Danh mục quyền một nguồn duy nhất (`packages/shared/src/permissions.ts`) |
| **Nhật ký thay đổi** | ✔ Mọi thay đổi tổ chức, thành viên, vai trò đều ghi. Database cấm sửa và xoá nhật ký (đã thử: bị chặn) | ⚠ Thiếu nhật ký đăng nhập, đăng nhập sai, đăng xuất, đổi thẻ; "cho rời" không ghi người đó từng giữ vai trò gì (L11) | ✔ Ghi cùng transaction với thay đổi: thay đổi hỏng thì nhật ký cũng không có |
| **Cách ly tổ chức** | ✔ Đã tấn công 5 kiểu dán mã của A vào đường của B: 5/5 bị 404, dữ liệu A không đổi. Database có khoá ngoại kép, chặn gán vai trò khác tổ chức kể cả khi ghi thẳng vào database | ✔ Với mã hôm nay. ⚠ Cửa gác tự động mù 3 kiểu lỗi (L4), nên không giữ được lời hứa "thêm đường mới là tự vào diện kiểm tra" | ✔ Người ngoài và tổ chức không tồn tại cùng nhận một lỗi, không lộ tổ chức nào có thật |
| **Thiếu quyền bị chặn** | ✔ Ở cửa vào: 10/10 đường trả 403 cho thành viên không quyền | ✘ L1 (thiếu quyền vẫn tước được người nhiều quyền); L3 (quyền đã bị thu hồi vẫn dùng được trong lúc đua) | ✔ |
| **Không tự nâng quyền** | ✔ Các đường thẳng đều bị chặn: tự gán admin, sửa chính vai trò mình đang giữ để thêm quyền, tạo vai trò mới mang quyền chưa có, thêm lại người đã rời với vai trò cao, 3 yêu cầu đua cùng lúc | ✘ Đường vòng qua đua: người đang bị hạ vẫn trao được quyền chủ cho đồng bọn (L3) | ✔ |
| **Không mất chủ cuối cùng** | ✔ Chủ duy nhất tự xoá, tự khoá, tự đổi vai trò: cả 3 đều 409; vai trò "chủ" không sửa được (403) | ✔ Hai chủ hạ nhau cùng lúc, 10/10 lượt vẫn còn ít nhất 1 chủ | ✔ Khoá dòng tổ chức xếp hàng các thay đổi |
| **Tiền (chỉ tiện ích)** | ✔ Đúng phạm vi: chỉ có `money.ts`, chưa có cột tiền nào trong database | ✔ 5/5 bài thử qua; từ chối số lẻ, không làm tròn im lặng | ✔ |
| **Tài liệu `docs/PROJECT_AUDIT.md`** | ⚠ Có tệp, nhưng nội dung là **báo cáo khảo sát trước khi xây** (vì sao không dùng lại `ssaas`). **Không mô tả gì về Mốc 2**: không có danh sách đường API, bảng quyền theo vai trò, cách cài và chạy, biến môi trường. Không có `.env.example`, dù `.gitignore` đã chừa chỗ cho tệp này | — | — |
| **Build, chạy** | ✔ Build và chạy bản build được | ✘ Máy mới cài: typecheck và test hỏng nếu chưa build (L5) | — |

---

## 3. Danh sách lỗi đã tái hiện

Mỗi lỗi đều có bài thử hoặc lệnh chạy thật. Đường dẫn tệp tính từ gốc bản sao.

### NGHIÊM TRỌNG

**L1. Người ít quyền hạ, khoá hoặc cho rời được người nhiều quyền hơn (chỉ "chủ" được bảo vệ)**
- **Triệu chứng:** "Quản lý" (vai trò có sẵn, 5 quyền, không có quyền sửa vai trò, xem nhật ký hay sửa tổ chức) đổi được "Quản trị" (9 quyền) thành "Thợ makeup" → 200, hoặc tạm khoá Quản trị → 200. Quản trị bị đẩy khỏi tổ chức và không tự khôi phục được (403). Tương tự, một vai trò tuỳ chỉnh "Nhân sự" chỉ có quyền đổi và cho rời nhân sự cũng cho Quản trị rời tổ chức được → 204.
- **Tái hiện:** `test-nghiem-thu/tan-cong.test.ts`, nhóm 2, ba bài "LỖI: Quản lý … hạ Quản trị", "LỖI: Quản lý tạm khoá Quản trị", "LỖI: vai trò tuỳ chỉnh "nhân sự" … cho Quản trị rời". Cả ba đều qua, tức là lỗi có thật.
- **Gốc bệnh:** `apps/api/src/modules/orgs/guards.ts:27-31`. Hàm `assertCanTouchMember` chỉ kiểm "người bị đụng có phải chủ không". Nó không kiểm "người bị đụng có quyền mà người sửa không có". Hàm được gọi ở `apps/api/src/modules/orgs/routes.ts:249` (đổi, khoá) và `routes.ts:294-297` (cho rời).
- **Vì sao nghiêm trọng:** chỉ cần cấu hình mặc định, không phải tạo vai trò tuỳ chỉnh nào. Một quản lý bất mãn khoá được toàn bộ quản trị viên, chỉ còn chủ tài khoản gỡ được.

### TRUNG BÌNH

**L2. Người có quyền "sửa vai trò" tước được quyền khỏi một vai trò mạnh hơn mình**
- **Triệu chứng:** người giữ vai trò tuỳ chỉnh "Sửa vai trò" (có quyền sửa vai trò, không có quyền xem nhật ký) sửa vai trò "Kế toán trưởng" của người khác, bỏ quyền xem nhật ký → 200. Kế toán trưởng mất quyền ngay (403).
- **Tái hiện:** `tan-cong.test.ts`, nhóm 2, bài "LỖI: người có roles.manage nhưng không có audit.read tước audit.read…".
- **Gốc bệnh:** `apps/api/src/modules/orgs/routes.ts:385-388`. Mã chỉ kiểm danh sách quyền **mới** có nằm trong quyền của người sửa hay không. Nó không kiểm danh sách quyền **cũ** của vai trò.
- **Đã thử và KHÔNG thành lỗi:** sửa chính vai trò mình đang giữ để thêm quyền mình chưa có bị chặn (403). Người sửa không tự nâng được mình qua đường này.

**L3. Kiểm quyền trước, khoá sau: quyền đã bị thu hồi vẫn dùng được trong lúc đua**
- **Giải thích bằng lời thường:** máy chủ tra "người này có quyền gì" ngay khi yêu cầu tới. Sau đó yêu cầu mới xếp hàng chờ lượt sửa dữ liệu của tổ chức. Nếu trong lúc chờ người đó bị hạ quyền, đến lượt máy chủ vẫn dùng kết quả tra cũ.
- **Triệu chứng:** A và B cùng là chủ. A hạ B xuống thợ, đúng lúc đó B trao vai trò chủ cho C. Sau cùng B là thợ nhưng C đã thành chủ, nhờ quyền mà B không còn.
- **Tái hiện:**
  - Bài cố định: `tan-cong.test.ts`, nhóm 5, bài "LỖI: chủ B đã bị hạ xuống thợ nhưng yêu cầu đang bay của B vẫn trao được vai trò chủ cho C". Bài giữ khoá tổ chức, cho yêu cầu của B vào hàng chờ, hạ B, rồi nhả khoá. Kết quả: 200, C thành chủ.
  - Bài đua thật chỉ qua API, không chạm database: nhóm 5, bài thứ hai. Thao tác của B chạy **sau** khi B đã bị hạ ở 12/15, 13/15, 14/15 lượt (3 lần chạy). Thứ tự được xác định bằng giờ ghi nhật ký. Bài `test-nghiem-thu/gio-nhat-ky.test.ts` đã kiểm rằng giờ này là giờ lúc ghi, không phải giờ bắt đầu transaction.
- **Gốc bệnh:** quyền được nạp ở `apps/api/src/app.ts:48-50` qua `apps/api/src/http/middleware.ts:34-75`, ngoài khoá. Khoá chỉ lấy sau đó, ở `apps/api/src/modules/orgs/routes.ts:193, 242, 288, 384` (`lockOrg`). Sau khi có khoá, mã không tra lại quyền.
- **Mức độ:** trung bình. Kẻ lợi dụng phải là chủ hoặc quản trị sắp bị hạ, và phải bắn yêu cầu đúng lúc. Nhưng như đo ở trên, bắn đồng thời là trúng gần như mọi lần.

**L4. Cửa gác cách ly tổ chức mù 3 kiểu lỗi**
- **Triệu chứng:** tôi chạy đúng logic của `test/tenant-isolation.test.ts` (chép nguyên, đúng thứ tự) lên một bảng đường API có cài sẵn 3 lỗi. Cả 4 phép kiểm của cửa gác vẫn xanh, trong khi cả 3 lỗi đều khai thác được:
  1. Đường sửa vai trò quên điều kiện "cùng tổ chức". Chủ B sửa được vai trò của A qua đường dẫn của B.
  2. Một đường nằm dưới `/orgs/:orgId/…` nhưng khai là "chỉ cần đăng nhập". Người ngoài lấy được email toàn bộ nhân sự của A.
  3. Đường danh sách nhân sự hỏng hẳn (luôn trả "không tìm thấy") vẫn được tính là "chủ đi qua".
- **Tái hiện:** `test-nghiem-thu/cua-gac-mu.test.ts`, 4/4 qua.
- **Gốc bệnh:**
  - `test/tenant-isolation.test.ts:58-66`: người ngoài chỉ được thử với đường dẫn mang mã tổ chức A. Cửa gác không bao giờ thử kiểu "mã tổ chức của B, mã nhân sự/vai trò của A".
  - `:17-18`: lọc theo "scope", không theo đường dẫn.
  - `:28-32` và `:95-106`: gửi thân rỗng `{}`, nên các đường sửa chỉ dừng ở lỗi 400 kiểm dữ liệu, không bao giờ chạm vào phần xử lý thật.
  - `apps/api/src/http/route.ts:65-74`: `defineRoute` không ép mọi đường dưới `/orgs/:orgId` phải là scope "org".
- **Mức độ:** trung bình. Hôm nay mã không có 3 lỗi này (nhóm 1 của `tan-cong.test.ts` đã thử thật: 5/5 bị chặn). Nhưng lưới an toàn cho các mốc sau thủng đúng chỗ hay xảy ra lỗi nhất.

**L5. Máy mới cài không chạy được typecheck và test**
- **Triệu chứng:** `pnpm install` rồi `pnpm typecheck` → 25 lỗi. `pnpm test` → 4/5 tệp của `apps/api` hỏng. Chỉ qua sau khi chạy `pnpm --filter @makeup/api build`.
- **Tái hiện:** dòng 1–3 của bảng lệnh ở mục 1.
- **Gốc bệnh:** `apps/api/package.json:7-12`. Chỉ lệnh `build` có `prisma generate`. Các lệnh `typecheck`, `test` không có, và không có bước `postinstall` sinh Prisma client với đường dẫn schema `apps/api/prisma/schema.prisma`.
- **Mức độ:** trung bình. Không phải lỗ bảo mật, nhưng máy kiểm tra tự động (CI) hoặc người mới tải về sẽ thấy đỏ.

### NHẸ

**L6. Một số dữ liệu xấu làm máy chủ trả 500 ("máy chủ gặp lỗi") thay vì báo lỗi dữ liệu**
- **Triệu chứng:**
  - Ký tự rỗng `\u0000` trong họ tên, tên tổ chức hoặc tên vai trò → 500.
  - Thân yêu cầu trên 100 KB → 500 (đúng phải là 413 "quá lớn").
  - Header `content-encoding` lạ → 500 (đúng phải là 415).
  - Mỗi lần như vậy ghi một dòng log mức "error" kèm stack. Kẻ phá có thể làm ngập log lỗi, che lỗi thật.
- **Tái hiện:** `tan-cong.test.ts`, nhóm 8, hai bài "LỖI"; `curl/badinput.sh`.
- **Gốc bệnh:** `apps/api/src/http/middleware.ts:87-92` chỉ nhận ra lỗi `entity.parse.failed`, các lỗi đọc thân yêu cầu khác rơi vào nhánh 500. Các trường chữ không lọc `\u0000`: `apps/api/src/modules/auth/routes.ts:23`, `apps/api/src/modules/orgs/routes.ts:77, 135, 340`.
- **Đã thử và KHÔNG lộ:** phản hồi 500 không có stack, không có tên Prisma hay Postgres, không có mã băm.

**L7. Lách giới hạn tốc độ đăng nhập bằng header `x-forwarded-for` khi máy chủ chạy không có proxy phía trước**
- **Triệu chứng:** giới hạn 5 lần/phút. Đổi `x-forwarded-for` mỗi lần thì 8/8 lần đăng nhập sai không bị chặn. Giữ nguyên thì lần thứ 6 bị 429.
- **Tái hiện:** `curl/badinput.sh`, phần đầu.
- **Gốc bệnh:** `apps/api/src/app.ts:18` (`trust proxy 1`) tin header do máy khách tự gửi.
- **Mức độ:** nhẹ, **phụ thuộc cách triển khai**. Nếu chạy sau đúng một lớp proxy có ghi đè header này (như các dịch vụ host thường làm) thì không lách được. Chưa có tài liệu nói sẽ triển khai ra sao.

**L8. Dò được email nào đã có tài khoản**
- **Triệu chứng:** đăng nhập cố tình trả cùng một câu cho "sai mật khẩu" và "email không tồn tại" (có cả băm giả để thời gian như nhau). Nhưng đăng ký với email đã có thì trả 409 "Email này đã được đăng ký". Người có quyền thêm nhân sự cũng dò được: 404 "Chưa có tài khoản" so với 201.
- **Tái hiện:** `tan-cong.test.ts`, nhóm 7, hai bài đầu.
- **Gốc bệnh:** `apps/api/src/modules/auth/routes.ts:26`; `apps/api/src/modules/orgs/routes.ts:195-197`.

**L9. Mật khẩu dài quá 72 byte bị cắt âm thầm**
- **Triệu chứng:** đăng ký bằng `a×72 + "DUNG-1"`, đăng nhập bằng `a×72 + "SAI-hoan-toan-khac"` → 200. Chữ Việt có dấu chiếm 2–3 byte mỗi chữ, nên mật khẩu tiếng Việt dài khoảng 25–30 chữ đã chạm ngưỡng này.
- **Tái hiện:** `tan-cong.test.ts`, nhóm 8, bài "LỖI (nhẹ): mật khẩu dài hơn 72 byte…".
- **Gốc bệnh:** `apps/api/src/lib/password.ts:5-11` (bcrypt chỉ đọc 72 byte đầu), trong khi `apps/api/src/modules/auth/routes.ts:13` cho phép tới 128 ký tự.

**L10. Báo động "thẻ bị đánh cắp" giả**
- **Triệu chứng:** người dùng đăng xuất rồi ứng dụng gửi lại thẻ cũ (chuyện thường gặp khi mạng chập chờn). Nhật ký ghi `auth.refresh_reuse_detected`, như thể có kẻ trộm thẻ.
- **Tái hiện:** `tan-cong.test.ts`, nhóm 9, bài "LỖI (nhẹ): gửi lại thẻ đã đăng xuất…".
- **Gốc bệnh:** `apps/api/src/modules/auth/service.ts:36-51` không phân biệt "bị thu hồi do đăng xuất" với "bị thu hồi do đã đổi thẻ".

**L11. Đường thiếu nhật ký**
- **Triệu chứng:**
  - Đăng nhập thành công, đăng nhập sai, đổi thẻ, đăng xuất: không có dòng nhật ký nào. Một tài khoản đi qua cả 4 việc này chỉ có đúng 1 dòng, là `user.registered`.
  - Nhật ký `member.removed` chỉ ghi mã người dùng, không ghi người đó từng giữ vai trò gì.
- **Tái hiện:** `tan-cong.test.ts`, nhóm 9, hai bài "GHI NHẬN".
- **Gốc bệnh:** `apps/api/src/modules/auth/routes.ts:55-67, 78-80, 90-93` không gọi `writeAudit`; `apps/api/src/modules/orgs/routes.ts:300-308`.

**L12. Tài liệu Mốc 2 không có**
- **Triệu chứng:** `docs/PROJECT_AUDIT.md` chỉ là báo cáo khảo sát trước khi xây. Không có danh sách API, bảng quyền theo vai trò, cách cài và chạy, các biến môi trường. Không có `.env.example`.
- **Tái hiện:** đọc tệp; `git ls-files` cho thấy không có tài liệu nào khác.

### Ghi nhận (hành vi có thật, chưa xếp là lỗi, cần chủ quyết)
- **Khoá tài khoản không thu hồi phiên.** Khoá tài khoản rồi mở lại thì thẻ refresh cũ dùng lại được (`apps/api/src/modules/auth/service.ts:56-59` chỉ chặn trong lúc đang khoá). Bài: nhóm 6.
- **Thẻ ngắn hạn vẫn dùng được tới khi hết hạn.** Access token (thẻ ngắn hạn 15 phút dùng cho mỗi yêu cầu) vẫn gọi được `/auth/me` sau khi đăng xuất, tới khi hết hạn. Cách làm này phổ biến; ghi lại để chủ biết. Nhân sự bị khoá thì vẫn mất quyền ngay, vì máy chủ tra lại database mỗi yêu cầu.

---

## 4. Nghi ngờ, chưa tái hiện thành lỗi

1. **Giới hạn tốc độ dùng chung cho cả studio.** Đăng ký, đăng nhập và đổi thẻ dùng chung một giới hạn theo địa chỉ IP (mặc định 10 lần/phút). Tôi đã thấy cơ chế: 6 nhân viên khác nhau, chung một IP, mỗi người đổi thẻ một lần, thì người thứ 6 bị 429 (giới hạn đặt 5 khi thử). Studio dùng chung một mạng wifi thì giờ cao điểm buổi sáng có thể bị văng đăng nhập. Chưa chứng minh được với lưu lượng thật.
2. **Đổi thẻ không gói trong một transaction.** Mã thu hồi thẻ cũ rồi mới tạo thẻ mới, ở hai bước tách rời (`apps/api/src/modules/auth/service.ts:61-73`). Nếu database lỗi đúng giữa hai bước, người dùng bị đăng xuất. Chưa tái hiện.
3. **Chủ mất đăng nhập vẫn được tính là chủ.** Chủ có tài khoản bị khoá (`users.status = DISABLED`) vẫn được đếm là "chủ đang hoạt động" (`apps/api/src/modules/orgs/routes.ts:37-41` không xét trạng thái tài khoản). Nếu đó là chủ cuối cùng, studio thực chất không còn ai quản trị. Hiện chưa có API khoá tài khoản nên không tái hiện qua API được.
4. **Quyền mới không tự đến tổ chức cũ.** Vai trò hệ thống được **chép** vào tổ chức lúc tạo. Khi danh mục quyền thêm quyền mới ở các mốc sau, chủ và quản trị của tổ chức cũ sẽ không có quyền đó, và chưa có cơ chế cập nhật. Hiện chưa có quyền mới nên chưa tái hiện.
5. **Mọi thành viên thấy email của nhau.** Ai có quyền xem nhân sự (thợ, lễ tân, giảng viên…) đều thấy email của mọi thành viên, kể cả người đã rời. Đây có thể là chủ ý; cần chủ quyết.

Giả thuyết đã bị bác: "số trang rất lớn ở danh sách làm máy chủ lỗi 500". Thực tế máy chủ trả 200 với danh sách rỗng (`tan-cong.test.ts`, nhóm 8).

---

## 5. Điều kiện để chấm lại thành ĐẠT

Sửa xong 5 việc dưới đây, rồi chạy lại `npx vitest run test-nghiem-thu`. Các bài "LỖI" tương ứng phải chuyển sang đỏ, tức là lỗi đã hết; sau đó viết thành bài "CHẶN" trong bộ thử chính.

1. **L1 và L2:** người sửa chỉ được đụng vào thành viên hoặc vai trò mà toàn bộ quyền hiện có nằm trong quyền của người sửa.
2. **L3:** tra lại quyền của người thao tác **sau khi** đã lấy khoá tổ chức, trong cùng transaction.
3. **L4:**
   - Cửa gác thử thêm kiểu "mã tổ chức của B, mã con của A".
   - Mọi đường dưới `/orgs/:orgId` bắt buộc phải là scope "org".
   - Vế "chủ đi qua" gửi dữ liệu hợp lệ để chạm được phần xử lý thật.
4. **L5:** `pnpm install && pnpm typecheck && pnpm test` chạy được trên máy mới.
5. **L12:** có tài liệu tối thiểu cho Mốc 2 (danh sách API, bảng quyền, cách chạy, `.env.example`).

Các lỗi nhẹ L6–L11 có thể đưa vào mốc kế tiếp, nhưng cần ghi vào danh sách việc tồn đọng.

---

## 6. Tệp bằng chứng

- `apps/api/test-nghiem-thu/tan-cong.test.ts`: 29 bài tấn công (chéo tổ chức, phân cấp, tự nâng quyền, chủ cuối cùng, đua, refresh, lộ thông tin, dữ liệu xấu, nhật ký)
- `apps/api/test-nghiem-thu/cua-gac-mu.test.ts`: 4 bài chứng minh cửa gác mù
- `apps/api/test-nghiem-thu/gio-nhat-ky.test.ts`: 1 bài xác nhận giờ nhật ký là giờ lúc ghi (dùng làm căn cứ cho L3)
- `apps/api/test-nghiem-thu/curl/smoke.sh`, `apps/api/test-nghiem-thu/curl/badinput.sh`: gọi thật vào bản build (cổng 4555)

Lệnh chạy lại:
```
cd apps/api
TEST_DATABASE_URL=postgresql://makeup:makeup_local@localhost:5432/makeup_test_nt npx vitest run test-nghiem-thu
```
