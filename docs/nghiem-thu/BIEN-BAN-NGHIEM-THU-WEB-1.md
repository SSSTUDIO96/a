# Biên bản nghiệm thu Web 1: móng phiên đăng nhập, W1 (lớp gọi API), W2 (giao diện chung)

- **Ngày chấm:** 18/10/2026
- **Người chấm:** thợ chấm độc lập (AI, không tham gia viết mã)
- **Bản được chấm:** commit `4e9423d`, bản sao riêng tại thư mục này
- **Database thử:** `makeup_test_nt_web`, đã bật `btree_gist`
- **Cam kết:** không sửa mã sản phẩm, không commit.
- **Cách chấm:**
  - Chạy đủ các lệnh kiểm tra.
  - Chạy e2e của dự án.
  - Viết bài thử riêng trong `apps/web/test-nghiem-thu/`, gồm: bài ô nhập (jsdom), bài trên Chromium thật (Playwright), bài gọi máy chủ bản build, bài thử cửa gác bí mật.
  - Đọc mã `apps/web/src/**`, `apps/web/scripts/**` và phần máy chủ mà web dựa vào (`apps/api/src/modules/auth/transport.ts`, `app.ts`).

---

## 0. Kết luận ngắn cho chủ studio

**KẾT LUẬN CHUNG: ĐẠT CÓ ĐIỀU KIỆN.** Không có lỗi nghiêm trọng.

**Những phần đã làm chắc:**
- **Bảo mật phiên đăng nhập trên web:**
  - Thẻ đăng nhập chỉ nằm trong bộ nhớ trang, không nằm trong kho của trình duyệt mà mã trang đọc được.
  - Thẻ dài hạn nằm trong cookie mà mã trang không đọc được.
  - Thiếu header `X-Client` thì cookie vô dụng.
  - 6 yêu cầu cùng hết hạn chỉ gây **1** lần xin thẻ mới.
  - Hai thẻ trình duyệt tải lại cùng lúc không đá nhau ra.
- **Báo lỗi đúng loại:** 400 (kèm lỗi dưới từng ô), 403, 404, 409, mất mạng, 502 trả trang HTML. Đã thử với máy chủ thật.
- **Nhập số:** dán chữ, số âm, phần lẻ, số quá lớn vào ô tiền đều bị chặn.
- **Hộp thoại:** Tab và Shift+Tab không rời hộp; Esc đóng hộp trên cùng; tiêu điểm trả về nút đã mở.
- **Tràn ngang ở 390px:** không trang nào bị.
- **Chữ tiếng Việt:** phông Be Vietnam Pro hiện đủ dấu.

**Phải sửa trước khi cho chủ xem lại (4 lỗi trung bình):**
1. **Hộp chi tiết gói ở trang xem thử vẫn thiếu đúng chỗ anh đã nhắc.** Thiếu 2 trong 5 nhóm của bản mẫu C ("Địa điểm cho phép", "Đã gồm trong gói"), tổng cộng thiếu 8 trong 19 ô. Trong khi đó, sổ ý muốn đã ghi "Thợ F bổ sung đủ 5 nhóm".
2. **Cửa gác bí mật để lọt khoá dịch vụ ngoài.** Tôi build thật một trang, nhét khoá Gemini đúng kiểu lỗi cũ của ssaas, cửa gác vẫn báo **0 vi phạm**.
3. **Tải lại trang khoảng 10 lần trong 1 phút là bị khoá đăng nhập 1 phút.** Ở giới hạn mặc định 10 lần/phút, lần tải trang thứ 10 bị chặn, và đăng nhập ngay sau đó cũng bị chặn. Studio dùng chung một mạng wifi sẽ gặp sớm hơn.
4. **Lệnh kiểm tra ở gốc đang đỏ.** `pnpm typecheck` và `pnpm test` ở gốc đều hỏng, vì một bài thử của máy chủ được commit trước khi có đường API tương ứng.

---

## 1. Bảng lệnh đã chạy và kết quả thật

| # | Lệnh | Kết quả thật |
|---|---|---|
| 1 | `pnpm install` (bản sao mới) | Xong; `postinstall` sinh Prisma client |
| 2 | `pnpm typecheck` (gốc) | **HỎNG**: 5 lỗi TypeScript tại `apps/api/test/staff.test.ts:538` |
| 3 | `pnpm --filter @makeup/web typecheck` | Qua, 0 lỗi |
| 4 | `pnpm test` (gốc) | **HỎNG.** `shared` 48/48; `web` 119/119; `api` dừng ở bước `tsc` (chính 5 lỗi trên), nên lượt test ô nhập (jsdom) của web không chạy hết |
| 5 | `cd apps/api && npx vitest run` (bỏ qua bước tsc) | **220/226**. 6 bài "mức rảnh của thợ" gọi `GET /orgs/:orgId/staff/availability`, nhưng đường này **chưa có** trong `apps/api/src` nên trả 404 |
| 6 | `cd apps/web && pnpm test` (biến `E2E_DATABASE_URL` trỏ vào database riêng) | Lượt 1: **119/119** (10 tệp, có bài "khớp hợp đồng" chạy máy chủ thật). Lượt 2 (jsdom): **28/28** (4 tệp) |
| 7 | `pnpm build` (gốc) | Thành công. Web: `index-*.js` 303,53 KB (gzip 97,48 KB). Cửa gác bí mật in "0 vi phạm / 13 tệp". `vercel.json` đang trỏ địa chỉ giữ chỗ |
| 8 | `pnpm e2e` (database riêng) | **1/1**. **Tác dụng phụ:** ghi đè 9 ảnh đang được git theo dõi trong `apps/web/e2e/anh/` (tôi đã khôi phục bằng `git checkout`) |
| 9 | Bài thợ chấm, ô nhập: `npx vitest run --config test-nghiem-thu/vitest.nt.config.ts` | **7/7** |
| 10 | Bài thợ chấm, trình duyệt thật: `npx playwright test --config test-nghiem-thu/playwright.nt.config.ts` (API thật cổng 4011, thẻ ngắn hạn 4 giây; Vite cổng 5181) | **9/9** |
| 11 | Cửa gác bí mật với bản build có bí mật cài sẵn (6 tệp) | **0 vi phạm**. Đối chứng: khi đặt `JWT_ACCESS_SECRET` đúng giá trị → 1 vi phạm |
| 12 | `vite build` thật, nhét khoá Gemini qua `define`, rồi chạy cửa gác | Khoá `AIzaSy…` nằm trong `assets/index-*.js`; cửa gác báo **0 vi phạm** |
| 13 | `node test-nghiem-thu/thu-may-chu.mjs` (API bản build, cổng 4012) | Đăng ký và tạo tổ chức gửi lại cùng khoá → 409. Đối chứng tạo khách → trả lại đúng bản cũ. 409 trùng lịch khi đua: **6/10** lượt không có `details.conflicts` |
| 14 | `node test-nghiem-thu/gioi-han-refresh.mjs` (API bản build, giới hạn mặc định) | `201 200×9 429 429 429`; đăng nhập ngay sau → 429 |
| 15 | curl `/auth/refresh` và `/auth/logout` với cookie `mp_refresh=%E0%A4%A` | **500** cả hai; log ghi `URIError` |

---

## 2. Chấm ĐÚNG / ĐẠT / ĐẸP

| Mục | ĐÚNG | ĐẠT | ĐẸP |
|---|---|---|---|
| **Phiên: thẻ chỉ trong bộ nhớ, thẻ dài hạn trong cookie httpOnly + `X-Client`** | ✔ `client.ts:9`; cookie `HttpOnly`, `SameSite=Strict`, chỉ gửi cho đường `/api/v1/auth` (e2e của dự án kiểm) | ✔ `document.cookie` không thấy `mp_refresh`; kho trình duyệt không chứa thẻ; thiếu `X-Client` → 401. ✘ Cookie hỏng → 500 (N3) | ✔ |
| **Xếp hàng refresh, nhiều thẻ trình duyệt** | ✔ Một lần refresh dùng chung (`client.ts:102-117`); khoá giữa các thẻ bằng `navigator.locks` (`client.ts:85-89`) | ✔ 6 yêu cầu cùng hết hạn → 1 lần refresh, cả 6 thành công. 2 thẻ cùng tải lại → 2 lần refresh xếp hàng, đều 200, không thẻ nào bị đá. ✘ Tải lại ~10 lần/phút là tự khoá mình (T3) | ✔ |
| **Đăng xuất** | ✔ Máy chủ thu hồi phiên và xoá cookie; lỗi mạng thì ở lại trang và báo | ⚠ Thẻ khác vẫn dùng được tới khi thẻ ngắn hạn hết hạn rồi mới về trang đăng nhập (G1) | ✔ |
| **Chống gửi trùng ở web** | ✔ Khoá sinh mỗi lần bấm (`CreateOrgPage.tsx:51`); tự gửi lại sau refresh thì giữ nguyên khoá (`client.ts:128-132` dùng lại cùng `opts`) | ✘ Hai đường web đang dùng (đăng ký, tạo tổ chức) **máy chủ bỏ qua khoá** (N2) | ✔ |
| **Ánh xạ lỗi 400/401/403/404/409/mạng** | ✔ `errors.ts:44-63` | ✔ Thử với máy chủ thật: 400 có lỗi theo ô (`fields.name`), 403, 404, 409, mất mạng → `network`, 502 HTML → `server` kèm mã 502 | ✔ |
| **types.ts khớp máy chủ** | ✔ Bài "khớp hợp đồng" so đủ tên trường của từng kiểu trả về với máy chủ thật | ⚠ Không xét dạng chi tiết lỗi; đã tìm thấy một chỗ lệch (N4) | ✔ |
| **Cửa gác bí mật bản build** | ✔ Có, chạy trong `pnpm build` | ✘ Chỉ dò 3 tên biến máy chủ, chuỗi `postgres://` và tên `VITE_*`. Lọt khoá dịch vụ ngoài (T2) | ✔ |
| **Component: bàn phím** | ✔ Dialog nhốt tiêu điểm, Esc đóng hộp trên cùng, trả tiêu điểm; Tooltip mở khi có tiêu điểm, Esc chỉ tắt tooltip; Segmented đi bằng mũi tên, ô khoá đọc được lý do | ✘ Bấm nền mờ rồi Esc → hộp không đóng (N1) | ✔ |
| **MoneyInput / parseMoney / parseKm** | ✔ Nhận "1.500.000 ₫", "1 500 000đ"; chặn chữ, âm, "1,5", "1,500,000", "1.5", vượt ngưỡng; km "12,35" | ⚠ 4 lỗi nhẹ (N5–N8) | ✔ Con trỏ giữ đúng chỗ khi tự chèn dấu chấm |
| **Tràn ngang 390px** | ✔ | ✔ Trang xem thử, hộp thoại, ngăn kéo đáy, đăng nhập, đăng ký, tạo tổ chức, khung tổ chức: chiều rộng nội dung không vượt 390px | ✔ |
| **Tiếng Việt có dấu** | ✔ | ✔ `document.fonts.check` cho "Nguyễn Thị Hoa đã đặt 1.500.000 ₫ …" → đúng; phông Be Vietnam Pro có cả bộ chữ Việt | ✔ |
| **Trang xem thử so với bản mẫu C** | ✘ Thiếu 2/5 nhóm (T1) | — | — |

---

## 3. Đếm từng nhóm và ô: hộp chi tiết gói

So `docs/rnd/anh/v2-phuong-an-C-bang-gia-chi-tiet-goi-desktop.png` và `…-mobile.png` (hai ảnh có cùng số nhóm và ô) với trang xem thử ở commit `4e9423d`:
- Mã: `apps/web/src/ui/__xem-thu__/UiGallery.tsx:782-850`.
- Ảnh tôi chụp lại ở 390px: `apps/web/test-nghiem-thu/anh/390-hop-thoai.png`.

| Nhóm (bản mẫu C) | Ô trong bản mẫu | Trang xem thử | Thiếu |
|---|---|---|---|
| 1. Thông tin & giá | 7: Tên gói, Nhân vật (?), Thời lượng (phút), **Số thợ**, Giá niêm yết, Giá bán (?), Cọc mặc định | 6 | **Số thợ** |
| 2. **Địa điểm cho phép** | 3: Tại studio / cửa hàng, Tại nhà khách (?), Địa điểm khác (?) | **0 (không có nhóm)** | **cả nhóm** |
| 3. **Đã gồm trong gói** | 2 dòng (Makeup cô dâu 1 lần, Làm tóc 1 lần) + nút "Thêm dịch vụ" | **0 (không có nhóm)** | **cả nhóm** |
| 4. Dịch vụ phụ cho tick (?) | 4: Làm tóc (mờ vì đã gồm), Làm nail, Lens, **Kẹp mi** | 3 | **Kẹp mi** |
| 5. Tiền công thợ theo bậc (?) | 3: Thợ chính bậc 1, **Thợ chính bậc 2**, Thợ phụ | 2 | **Thợ chính bậc 2** |
| **Tổng** | **5 nhóm / 19 ô** (+ 1 nút) | **3 nhóm / 11 ô** | **2 nhóm, 8 ô** |

Ảnh xem thử đã commit (`src/ui/__xem-thu__/anh/xem-thu-hop-thoai-desktop.png`) cũng chỉ có 3 nhóm. `docs/SO-Y-MUON.md:21` ghi "Thợ F bổ sung đủ 5 nhóm", nhưng mã ở commit này **chưa có**.

---

## 4. Lỗi đã tái hiện

### TRUNG BÌNH

**T1. Hộp chi tiết gói ở trang xem thử thiếu 2/5 nhóm của bản mẫu C, đúng chỗ chủ đầu tư đã nhắc**
- **Triệu chứng:** xem bảng ở mục 3.
- **Tái hiện:**
  - Mở `http://localhost:5181/xem-thu.html` (Vite dev), bấm "Mở hộp thoại".
  - Ảnh: `test-nghiem-thu/anh/390-hop-thoai.png`.
  - Đếm thẻ `<h3>` ở `UiGallery.tsx:782, 809, 816`: chỉ có 3 tiêu đề nhóm.
- **Gốc bệnh:** `apps/web/src/ui/__xem-thu__/UiGallery.tsx:780-850`.
- **Vì sao trung bình:** chủ đầu tư đã phải nhắc một lần, sổ ghi đã sửa mà mã chưa sửa. Đây là lỗi quy trình đúng như sổ đã cảnh báo.

**T2. Cửa gác bí mật để lọt khoá của dịch vụ ngoài (Gemini, Google Maps, cổng thanh toán, Supabase service role)**
- **Triệu chứng:**
  1. Bản build giả có 6 tệp chứa khoá (`AIzaSy…`, `sk_live_…`, khoá service role của Supabase, chuỗi `postgres` + `ql://` tách đôi, giá trị lấy từ `GEMINI_API_KEY`), chạy với môi trường build có các biến đó → **0 vi phạm**.
  2. `vite build` thật, nhét `process.env.GEMINI_API_KEY` qua `define`. Đây đúng là lỗi #5 của ssaas ghi trong `docs/PROJECT_AUDIT.md`. Khoá nằm nguyên trong `assets/index-*.js`, cửa gác vẫn **0 vi phạm**.
  3. Đối chứng: chỉ khi đặt `JWT_ACCESS_SECRET` đúng giá trị thì mới bắt được. Nhưng biến này nằm ở Railway, không có trong môi trường build trên Vercel, nên ở chỗ thật cửa gác chỉ còn là phép dò tên biến.
- **Tái hiện:** dòng 11–12 bảng lệnh. Tệp mẫu: `test-nghiem-thu/dist-gia/`, `test-nghiem-thu/vite-gia/vite.config.mjs`.
- **Gốc bệnh:** `apps/web/scripts/check-bundle-secrets.mjs:11-12` chỉ có 3 tên biến; `:34-43` chỉ dò giá trị của 3 tên đó và của `VITE_*`. Không dò dạng khoá phổ biến, không dò giá trị của mọi biến môi trường lúc build.

**T3. Tải lại trang khoảng 10 lần trong một phút là bị khoá đăng nhập một phút**
- **Giải thích bằng lời thường:**
  - Mỗi lần mở hoặc tải lại trang, web xin máy chủ một thẻ ngắn hạn mới (`session.tsx:84`).
  - Máy chủ đếm chung lần xin thẻ với lần đăng ký và đăng nhập, mặc định tối đa 10 lần/phút cho mỗi địa chỉ IP.
  - Cả studio dùng chung một mạng thì chung một IP.
- **Triệu chứng:**
  - Đăng ký rồi 12 lần "tải lại trang" → `201 200×9 429 429 429`.
  - Đăng nhập ngay sau đó → 429.
  - Trên web, lúc khôi phục phiên gặp 429 thì trang coi như chưa đăng nhập và hiện lỗi (`session.tsx:91-95`), dù cookie vẫn còn giá trị.
- **Tái hiện:** `node test-nghiem-thu/gioi-han-refresh.mjs` (máy chủ bản build, không đặt `AUTH_RATE_LIMIT_PER_MINUTE`).
- **Gốc bệnh:** `apps/api/src/modules/auth/routes.ts:100` (`/auth/refresh` dùng chung `rateLimit: 'auth'`); `apps/api/src/app.ts:46-48`; `apps/web/src/app/session.tsx:79-100`.

**T4. Lệnh kiểm tra ở gốc đỏ**
- **Triệu chứng:**
  - `pnpm typecheck`: 5 lỗi tại `apps/api/test/staff.test.ts:538`.
  - `pnpm test`: `api` dừng ở bước `tsc`.
  - Chạy vitest riêng: 6 bài gọi `/staff/availability` → 404, vì `apps/api/src` chưa có đường này.
- **Tái hiện:** dòng 2, 4, 5 bảng lệnh.
- **Ghi chú:** lỗi nằm ở máy chủ, không ở web. Nhưng commit đưa ra chấm phải qua đủ lệnh ở gốc; web chạy riêng thì 119/119 và 28/28.

### NHẸ

**N1. Bấm chuột ra nền mờ rồi Esc: hộp thoại không đóng**
- **Triệu chứng:** sau khi bấm vào nền mờ (ngoài khung hộp), tiêu điểm rơi ra `<body>`. Esc không còn tới hộp, hộp vẫn mở. Phải bấm Tab một lần để tiêu điểm bị kéo về hộp thì Esc mới có tác dụng.
- **Tái hiện:** `web.pw.ts`, bài "LỖI: bấm chuột ra nền mờ…" (log: `tiêu điểm ở <BODY>, hộp còn mở = true`).
- **Gốc bệnh:** `apps/web/src/ui/useModalBehavior.ts:94` gắn phím lên khung hộp, không gắn lên `document`; `:57` chỉ chạy khi tiêu điểm đang ở trong hộp.

**N2. Web gửi khoá chống gửi trùng cho đăng ký và tạo tổ chức, nhưng máy chủ bỏ qua**
- **Triệu chứng:** gửi lại **cùng khoá, cùng nội dung** (như khi mất mạng sau lần bấm đầu) → đăng ký 409 "Email này đã được đăng ký"; tạo tổ chức 409 "Đường dẫn tổ chức đã có người dùng" — tức là báo trùng với **chính tổ chức vừa tạo**. Người dùng dễ nghĩ đường dẫn bị người khác lấy, đổi tên rồi tạo **tổ chức thứ hai**. Đối chứng: tạo khách (đường có chống gửi trùng thật) trả lại đúng bản cũ.
- **Tái hiện:** `node test-nghiem-thu/thu-may-chu.mjs`, phần 1.
- **Gốc bệnh:**
  - `apps/api/src/modules/orgs/routes.ts:84` và `auth/routes.ts:23`: không phải đường có chống gửi trùng (`defineRoute` chỉ cho phép ở đường thuộc tổ chức).
  - `apps/web/src/api/auth.ts:61, 82` vẫn gọi qua `api.create` như thể có.
  - `CreateOrgPage.tsx:51` sinh khoá mới mỗi lần bấm, nên bấm lại sau lỗi mạng luôn là khoá mới.

**N3. Cookie đăng nhập bị hỏng làm máy chủ trả 500**
- **Triệu chứng:** cookie `mp_refresh=%E0%A4%A` → `/auth/refresh` và `/auth/logout` đều 500 (`URIError`). Web coi đó là lỗi máy chủ, không xoá được cookie qua nút đăng xuất. Người dùng phải đăng nhập lại mới thoát.
- **Tái hiện:** dòng 15 bảng lệnh.
- **Gốc bệnh:** `apps/api/src/modules/auth/transport.ts:23` gọi `decodeURIComponent` mà không bắt lỗi.

**N4. Lời hứa trong `types.ts` về lỗi 409 trùng lịch sai ở trường hợp đua**
- **Triệu chứng:** `types.ts:402` và `schedule.ts:46` hứa 409 "Trùng lịch" luôn có `error.details.conflicts`. Hai lịch cùng bị dời vào một giờ đồng thời: **6/10** lượt bên thua nhận 409 **không có** `details`, vì database chặn trước.
- **Tái hiện:** `node test-nghiem-thu/thu-may-chu.mjs`, phần 2.
- **Gốc bệnh:** `apps/api/src/http/middleware.ts:155-156` (lỗi trùng lịch từ database không kèm chi tiết).
- **Vì sao bài "khớp hợp đồng" không thấy:** bài đó chỉ so dạng câu trả lời thành công. Hiện chưa màn hình nào đọc `conflicts`, nên chưa hỏng gì; khi làm màn lịch sẽ hỏng.

**N5. Ô tiền: gõ "1.5" thì thành 15 đ, không báo gì**
- **Triệu chứng:** gõ từng phím thì dấu chấm bị nuốt. Trong khi **dán** "1.5" thì báo lỗi.
- **Tái hiện:** `test-nghiem-thu/nhap-so.test.tsx`.
- **Gốc bệnh:** `apps/web/src/ui/MoneyInput.tsx:114`.

**N6. Ô tiền hiện chữ cũ khác với số thật**
- **Triệu chứng:** ô đang báo lỗi (ví dụ gõ "-5"), rời ô, rồi form tự điền giá mới (3.000.000) → ô **vẫn hiện "-5"** kèm lỗi, trong khi giá trị thật là 3.000.000.
- **Tái hiện:** `nhap-so.test.tsx`.
- **Gốc bệnh:** `MoneyInput.tsx:84, 162` (chữ đang gõ được giữ lại khi còn lỗi, không làm mới theo giá trị bên ngoài).

**N7. Ô km: gõ "2.500" thì thành 2.500 km, không báo gì**
- **Triệu chứng:** dấu chấm được hiểu là ngăn nghìn. Người quen viết thập phân bằng dấu chấm sẽ ra phí di chuyển cực lớn. Ví dụ: 2.500 km × 2 chiều × 5.000 đ ≈ 25 triệu.
- **Tái hiện:** `nhap-so.test.tsx`.
- **Gốc bệnh:** `apps/web/src/ui/format.ts:76` dùng `readGroupedInteger` (`:17-20`) cho phần nguyên của km.

**N8. Ô km: dán "12,5 km" bị báo "Chỉ nhập chữ số"**
- **Triệu chứng:** `parseKm` nhận được đơn vị "km", nhưng ô km chặn chữ trước khi đọc.
- **Tái hiện:** `nhap-so.test.tsx`.
- **Gốc bệnh:** `apps/web/src/ui/UnitInput.tsx:36, 89`.

**N9. Chạy e2e làm bẩn kho**
- **Triệu chứng:** `pnpm e2e` ghi đè 9 ảnh đang được git theo dõi.
- **Tái hiện:** dòng 8 bảng lệnh; `git status` sau khi chạy.
- **Gốc bệnh:** `apps/web/e2e/luong-phien.spec.ts:3-4` lưu ảnh vào `e2e/anh`.

### Ghi nhận (hành vi có thật, cần chủ quyết)

- **G1.** Đăng xuất ở thẻ A thì thẻ B vẫn gọi API được tới khi thẻ ngắn hạn hết hạn (mặc định 15 phút), rồi mới về trang đăng nhập. Bài: `web.pw.ts`, nhóm 3.
- **G2.** Segmented: mũi tên chỉ dời tiêu điểm, Space hoặc Enter mới chọn. Mẫu nhóm nút chọn của WAI-ARIA (bộ hướng dẫn trợ năng web) cho mũi tên chọn luôn. Cách hiện tại có chủ ý (ghi trong mã), cần chủ xác nhận.

---

## 5. Đã tấn công nhưng KHÔNG phá được

- **Thẻ đăng nhập:**
  - Không thấy trong `localStorage`, `sessionStorage` hay `document.cookie`.
  - `fetch('/api/v1/auth/refresh')` không kèm `X-Client` → 401.
  - 6 yêu cầu đồng thời sau khi thẻ hết hạn → đúng 1 lần refresh, cả 6 thành công.
  - Hai thẻ trình duyệt tải lại cùng lúc → đều còn phiên, mọi lần refresh trả 200.
- **Ánh xạ lỗi (máy chủ thật):** 400 kèm `fields.name`; 404; 409 (bậc lương trùng tên); 403 (thợ makeup tạo dịch vụ); mất mạng; 502 trả HTML.
- **Bàn phím:**
  - 30 lần Tab và 30 lần Shift+Tab vẫn ở trong hộp.
  - Tooltip "?" trong hộp: có tiêu điểm thì hiện; Esc chỉ tắt tooltip, hộp còn mở.
  - Hộp nhỏ chồng lên: Esc chỉ đóng hộp nhỏ; Esc lần nữa đóng hộp lớn, tiêu điểm về nút "Mở hộp thoại".
  - Ô Segmented bị khoá hiện lý do khi có tiêu điểm, bấm Space không chọn được.
- **Hàm đọc số:**
  - Bị chặn: "abc", "-1", "−1", "1,5", "1,500,000", "1.5", "9007199254740993", "1.50.000", "1e6", "₫1.500.000".
  - Km bị chặn: "12.35", "12,345", "100.000".
  - Dán chữ, "1,5" hoặc số quá lớn vào ô tiền → báo lỗi, giá trị không đổi.
- **Tràn ngang 390px:** 7 trang và trạng thái, không trang nào tràn.
- **Phông:** đủ dấu tiếng Việt và ký hiệu ₫.

---

## 6. Nghi ngờ, chưa tái hiện

1. Trình duyệt không có `navigator.locks` (Safari cũ hơn 15.4) thì hai thẻ có thể cùng refresh bằng một cookie. Lần sau sẽ bị coi là dùng lại thẻ → thu hồi cả họ thẻ → cả hai thẻ bị đăng xuất (`client.ts:86-87` không có đường dự phòng). Chưa thử, vì máy chấm chỉ có Chromium.
2. Bài "khớp hợp đồng" chỉ so tên trường, không so kiểu giá trị. Một trường đổi từ số sang chuỗi, hoặc từ có sang null, sẽ lọt. Chưa tìm thấy trường nào lệch kiểu thật; chỗ lệch tìm được là N4.
3. Bài "khớp hợp đồng" mặc định dùng database `makeup_test_web` dùng chung (`khop-hop-dong.test.ts:55`). Nếu quên đặt `E2E_DATABASE_URL`, nó có thể chạy trên dữ liệu của người khác.

---

## 7. Kết luận

| Phần | Kết luận | Điều kiện |
|---|---|---|
| **Móng: đăng nhập, phiên, cookie** | **ĐẠT CÓ ĐIỀU KIỆN** | Sửa T3 (tách giới hạn refresh khỏi đăng nhập hoặc nới riêng cho refresh). N3 vào danh sách tồn đọng |
| **W1: kiểu dữ liệu, hàm gọi, useQuote** | **ĐẠT CÓ ĐIỀU KIỆN** | N2: hoặc máy chủ chống gửi trùng thật cho đăng ký và tạo tổ chức, hoặc web thôi coi hai đường này là có. N4: sửa lời hứa trong `types.ts`, hoặc máy chủ trả `conflicts` cả khi đua |
| **W2: token, phông, 22 component** | **ĐẠT CÓ ĐIỀU KIỆN** | N1 (Esc sau khi bấm nền), N5–N8 (ô nhập) |
| **Trang xem thử so với bản mẫu C** | **KHÔNG ĐẠT** | Bổ sung đủ 5 nhóm / 19 ô (T1), chụp lại ảnh, rồi **đếm theo bảng ở mục 3** trước khi cho chủ xem |
| **Cửa gác bí mật** | **KHÔNG ĐẠT** | Dò thêm dạng khoá phổ biến và giá trị của mọi biến môi trường lúc build (T2); dùng `test-nghiem-thu/vite-gia` làm bài thử phải đỏ |
| **Chung** | **ĐẠT CÓ ĐIỀU KIỆN** | Thêm: `pnpm typecheck` và `pnpm test` ở gốc phải xanh (T4) |

---

## 8. Tệp bằng chứng

Tất cả nằm trong `apps/web/test-nghiem-thu/`, chưa commit.
- `nhap-so.test.tsx`, `vitest.nt.config.ts`: bài ô tiền, ô km, hàm đọc số (jsdom).
- `web.pw.ts`, `playwright.nt.config.ts`: bài trên Chromium thật, ảnh chụp lưu ở `anh/`.
- `thu-may-chu.mjs`, `gioi-han-refresh.mjs`: bài gọi máy chủ bản build.
- `dist-gia/`, `vite-gia/`, `dist-vite-gia/`: bài thử cửa gác bí mật.

Lệnh chạy lại (trong `apps/web`):
```
npx vitest run --config test-nghiem-thu/vitest.nt.config.ts
npx playwright test --config test-nghiem-thu/playwright.nt.config.ts
node scripts/check-bundle-secrets.mjs --dir test-nghiem-thu/dist-gia          # phải ra vi phạm (hiện ra 0)
```
