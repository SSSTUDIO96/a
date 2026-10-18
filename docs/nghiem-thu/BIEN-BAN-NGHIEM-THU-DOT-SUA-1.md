# Biên bản nghiệm thu đợt sửa 1 (sau biên bản Web 1)

- **Ngày chấm:** 18/10/2026
- **Người chấm:** thợ chấm độc lập (AI, không tham gia viết mã). Không sửa mã sản phẩm, không commit.
- **Bản được chấm:** commit `9b1db79`, worktree riêng `scratchpad/cham-sua1` (đã gỡ sau khi chấm).
- **Cài đặt:** `pnpm install --offline --frozen-lockfile` ngay trong worktree (có node_modules riêng, không cần liên kết từ `/home/user/a`).
- **Database thử:** `makeup_test_cham_sua1`, có bật `btree_gist`, áp migration bằng `pnpm db:deploy-to <url>` (đặt cả `DATABASE_URL` lẫn `DIRECT_URL`, đúng sổ lỗi 16) → 11/11, kiểm lại khớp. Database phụ `makeup_test_cham_sua1_mig` dùng cho bài migration dữ liệu bẩn. Cả hai đã xoá.
- **Phạm vi:** đợt sửa của 5 thợ I, K, J, L, M. Phần màn hình đang làm dở (`src/features/{pricing,contracts,schedule}`, `layout/AppShell`) được tách riêng, không tính.
- **Trung thực về git:** ngoài `git worktree add/remove`, tôi có chạy vài lệnh git CHỈ ĐỌC lúc đầu (`git log`, `git diff --stat`, `git show`, `git grep`, `git status`) để biết đợt sửa đụng tệp nào. Không lệnh nào ghi vào kho. Từ giữa buổi tôi thôi dùng git, trả tệp về nguyên bản bằng bản sao lưu và so sha256.

Giải thích vài từ dùng nhiều lần:
- **Đột biến:** tôi cố ý cài một lỗi nhỏ vào mã rồi chạy bài thử của thợ. Bài thử đỏ là nó bắt được lỗi; bài thử vẫn xanh là lỗi **lọt**, tức bài thử không canh chỗ đó.
- **Đua:** gửi nhiều yêu cầu cùng một lúc để xem máy chủ có xử lý sai khi chúng chen nhau không.
- **Khoá chết (deadlock):** hai giao dịch database chờ nhau. A chờ B nhả, B chờ A nhả. Sau 1 giây PostgreSQL phải huỷ một bên.
- **Khoá chống gửi trùng (Idempotency-Key):** mã do web sinh ra cho mỗi lần bấm. Gửi lại cùng mã thì máy chủ trả đúng kết quả lần trước, không tạo bản thứ hai.

---

## 0. Kết luận ngắn cho chủ studio

| Thợ | Kết luận | Điều kiện / ghi chú |
|---|---|---|
| **I** (máy chủ: giới hạn refresh, chống gửi trùng, cookie hỏng, 409 trùng lịch) | **ĐẠT CÓ ĐIỀU KIỆN** | T3, N2, N3 sửa chắc. **N4 còn một lỗ (trung bình):** hai người cùng dời lịch vào một giờ, đôi khi bên thua nhận **500 "Máy chủ gặp lỗi"** thay vì 409 có danh sách lịch trùng. Đây là **lỗi máy chủ, không phải bài thử phụ thuộc thời điểm** (mục 4, T-I1). Bài thử của thợ lọt 6/15 đột biến |
| **K** (ảnh đại diện thợ, cấu hình kho tệp, script quản trị) | **ĐẠT** | Migration chịu được 14 kiểu dữ liệu bẩn. Thiếu biến thì máy chủ không khởi động, lời báo không lộ bí mật. 3 script chạy được từ bản build. 2 chỗ bài thử chưa canh (nhẹ) |
| **J** (cửa gác bí mật, ô tiền/km, hộp thoại, ảnh e2e) | **ĐẠT CÓ ĐIỀU KIỆN** | T2, N1, N5, N7, N8, N9 hết tái hiện. **N6 còn một nhánh (nhẹ):** form đặt lại đúng giá cũ thì ô vẫn hiện chữ sai và báo lỗi. Cửa gác còn lọt vài dạng khoá ít gặp (nhẹ) |
| **L** (types.ts khớp máy chủ, Retry-After) | **ĐẠT CÓ ĐIỀU KIỆN** | Bài khớp hai đầu chắc: 7/7 đột biến đều bị bắt. **`pnpm typecheck` của web, và vì thế của gốc, đang ĐỎ** ở chính tệp bài thử của thợ (`khop-hop-dong.test.ts:515`). Cùng loại lỗi T4 của lần trước (trung bình) |
| **M** (giữ khoá ở tạo tổ chức/đăng ký, 429 lúc khôi phục phiên) | **ĐẠT** | Trên Chromium thật: không có vòng lặp tự thử lại; mất trả lời rồi bấm lại vẫn chỉ 1 tổ chức. Bài thử bắt 6/7 đột biến; một chỗ chưa canh (nhẹ) |

**Câu hỏi điều phối gửi thêm (bài N4 khi chạy toàn bộ có lần ra 8/10 hoặc 9/10):**
- **Đó là lỗi máy chủ.** Mỗi lượt lệch là một lần **khoá chết** giữa hai yêu cầu dời lịch. Bên bị PostgreSQL huỷ nhận **500**. Bài thử đếm lượt đó là "không có bên thua" (vì chỉ tìm mã 409), nên in 9/10 hoặc 8/10.
- **Không có lượt nào cả hai bên cùng thắng** (database vẫn chặn trùng lịch: đếm khoảng bận thật luôn bằng 1). **Không có lượt nào bên thua là 409 mà thiếu `conflicts`.**
- Chi tiết ở mục 3 và T-I1.

---

## 1. Bảng lệnh đã chạy và kết quả thật

Toàn bộ log ở `cham-sua1-bien-ban/log/`.

| # | Lệnh | Kết quả thật |
|---|---|---|
| 1 | `apps/api: TEST_DATABASE_URL=…cham_sua1 pnpm test` (tsc + vitest) | **357/357**, 26/26 tệp, exit 0 (`api-test-1.log`). Cửa gác 10 phép xanh: scope 73/73, outsider 73/73, noPerms 73/73, unauth 83/83, crossId 36/36, leak 30/30, refBase 23/23, crossRef 54/54, keep 73/73, platform 24/24. 9 bài đột biến cửa gác đều đỏ đúng phép. Bài của thợ I `sua-nghiem-thu-web.test.ts` 26/26; `[N4] đua: 10/10` |
| 2 | `apps/api: npx vitest run test/` × 5 lần liền | 5/5 lần 357/357; dòng `[N4]` lần lượt 10/10, 10/10, 10/10, 10/10, 10/10 (`n4-5-lan.txt`) |
| 3 | Bài N4 trong mọi lần chạy có tệp `sua-nghiem-thu-web.test.ts` (1 + 5 + 15 lần chạy đột biến không đụng mã lịch = 21 lần) | 19 lần 10/10; 1 lần 10/10 nhưng thiếu `conflicts` (đây là đột biến I-h tôi cố ý cài); **1 lần 9/10** (lần chạy đột biến I-m, chỉ đổi mã tải tệp). Log PostgreSQL ghi đúng lúc đó (18:31:29) một khoá chết giữa hai câu `UPDATE appointments` |
| 4 | `packages/shared: npx vitest run` + `tsc --noEmit` | **78/78**; tsc 0 lỗi |
| 5 | `apps/web: pnpm typecheck` | **HỎNG**: `src/api/khop-hop-dong.test.ts(515,11): error TS2345` (cấu hình `tsconfig.node.json`). `tsconfig.json` (mã chạy thật) 0 lỗi |
| 6 | `pnpm typecheck` ở gốc | **HỎNG** (exit 2), cùng lỗi trên; shared và api xanh |
| 7 | `apps/web: KHOP_HOP_DONG_DATABASE_URL=…cham_sua1 KHOP_PORT=4051 npx vitest run` | **343/345**. Hai bài đỏ đều thuộc phần tách riêng: `PricingPage.test.tsx` 1, `AppShell.test.tsx` 1. Các tệp của đợt sửa đều xanh: khop-hop-dong 12, khop-kieu 6, client 19, errors 8, check-bundle-secrets 33, e2e-anh 2, format 23, MoneyInput 17, UnitInput 12, Dialog 10, session 9, RegisterPage 4, CreateOrgPage 6 |
| 8 | `apps/web: pnpm build` | Thành công. `index-*.js` 497,96 KB (gzip 155,72 KB). **Cửa gác bí mật: 0 vi phạm / 13 tệp** |
| 9 | `apps/web: pnpm e2e` (`E2E_DATABASE_URL` riêng) | 0/2. Cả hai đỏ vì đợi chữ "Đang dựng" trên màn Lịch, mà màn Lịch nay đã dựng (phần tách riêng). **N9:** md5 của 9 ảnh trong `e2e/anh/` không đổi (0 tệp khác); ảnh mới ra `e2e/anh-chay/` (3 tệp) |
| 10 | Bài tái hiện cũ `thu-may-chu.mjs` (đã sửa khoá k2, xem mục 2) với API bản build production, cổng 4042 | Đăng ký gửi lại cùng khoá → **201**; tạo tổ chức gửi lại → **201**; dùng lại khoá tạo tổ chức cho tạo khách → **409** "đã dùng cho một yêu cầu khác"; đối chứng tạo khách 201/201 cùng id; **409 khi đua: 10/10 có bên thua, 0 thiếu `details.conflicts`** |
| 11 | Bài cũ `gioi-han-refresh.mjs` (bản build, giới hạn mặc định 10/phút) | `201 200×12`; đăng nhập ngay sau → **200** (lần trước `201 200×9 429 429 429` rồi 429) |
| 12 | curl `/auth/refresh` và `/auth/logout` với 14 dạng cookie hỏng | 0 lần 500. Dạng `%` dở dang, `%ZZ`, `%C0%AF`, `%ED%A0%80`, hai cookie trùng tên → **401 `REFRESH_COOKIE_MALFORMED` kèm lệnh xoá cookie**. Dạng đọc được nhưng sai → 401 thường (refresh) / 204 (logout) (`cookie-hong.txt`) |
| 13 | Bài nhập số cũ `nhap-so.test.tsx` | 4 bài "LỖI:" (N5, N6, N7, N8) giờ **đều đỏ**, nghĩa là lỗi không còn tái hiện; 3 bài "CHẶN:" xanh |
| 14 | Bài Chromium cũ `web.pw.ts` | 16/18 ở lượt đầu. Bài "LỖI: bấm nền rồi Esc" đỏ (N1 đã sửa). Bài bàn phím đỏ vì trang xem thử không còn nút mở hộp chồng; bỏ đoạn đó (ca hộp chồng do `Dialog.test.tsx` phủ) thì xanh |
| 15 | Cửa gác bí mật với `dist-gia` cũ (6 tệp) | Môi trường build không có bí mật: **5 vi phạm, 4/6 tệp** (bắt theo hình dạng). Có `GEMINI_API_KEY` + `JWT_ACCESS_SECRET`: **7 vi phạm, 6/6 tệp**. `dist-vite-gia` (vite build thật, nhét khoá qua `define`): **bắt được** (lần trước 0) |
| 16 | Bài thợ chấm mới: xem mục 2 và mục 4 | — |

---

## 2. Bài thợ chấm viết thêm

Tất cả nằm trong `cham-sua1-bien-ban/`.

**Máy chủ:**
- `bai-tai-hien/apps-api-test-cham/` (chạy bằng vitest trong `apps/api`):
  - `dua-n4.test.ts`: đua N4, ghi chi tiết từng lượt.
  - `dua-20.test.ts`: 20 lịch cùng dời vào một giờ, kèm lịch của tổ chức B cùng giờ.
  - `khoa-chet.test.ts`: dựng khoá chết chắc chắn.
- `bai-cham/` (chạy bằng node, gọi máy chủ bản build):
  - `dua-khoa.mjs`: đua đăng ký và tạo tổ chức cùng khoá.
  - `tep.mjs`: tệp, URL ký, khoá chống gửi trùng.
  - `vercel-chung-ip.mjs`: mô phỏng tầng proxy của Vercel.
- `mig/du-lieu-ban.sql`: 14 kiểu dữ liệu bẩn trước migration ảnh đại diện.
- `dot-bien/chay.py`, `web.json`, `may-chu.json`: 49 đột biến (L-a, L-g cài hỏng lượt đầu, cài lại ở lượt hai). Kết quả ở `ket-qua-*.txt`, log từng đột biến ở `sao-luu/`.
- `tai-hien-cu/`: bản sao bài của lần chấm trước. `thu-may-chu.mjs` đã sửa: bản cũ dùng lại khoá `k2` (khoá tạo tổ chức) cho yêu cầu tạo khách, sai cách dùng khoá. Nay đối chứng dùng khoá riêng `k3`, và thêm một dòng kiểm "dùng lại k2 cho tạo khách → 409".

**Web:** `bai-tai-hien/apps-web-test-nghiem-thu/`, đặt vào `apps/web/test-nghiem-thu/`:
- `nhap-so-dot-sua.test.tsx`: 24 bài chuỗi lạ.
- `cham-dot-sua.pw.ts`: 9 bài Chromium (429, giữ khoá, N1).
- `web.pw.ts`, `nhap-so.test.tsx`: bài cũ.
- Hai tệp cấu hình đã đổi cổng sang 4052/5192 và trỏ database riêng.

**Cách chạy lại** (cần worktree mới ở `9b1db79` và database thử riêng):
```
# máy chủ
cp bai-tai-hien/apps-api-test-cham/*.ts <wt>/apps/api/test-cham/
cd <wt>/apps/api && TEST_DATABASE_URL=<db> npx vitest run test-cham/khoa-chet.test.ts   # phải ra 200 hoặc 409, hiện ra 500
# web
cp bai-tai-hien/apps-web-test-nghiem-thu/* <wt>/apps/web/test-nghiem-thu/
cd <wt>/apps/web && npx vitest run --config test-nghiem-thu/vitest.nt.config.ts
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test --config test-nghiem-thu/playwright.nt.config.ts
```

---

## 3. Đào gốc bài N4 "8/10, 9/10" (câu hỏi của điều phối)

**Bài thử đếm thế nào** (`apps/api/test/sua-nghiem-thu-web.test.ts:331-353`):
- Mỗi lượt gửi đồng thời hai lệnh dời lịch vào cùng một giờ.
- `loser = [x, y].find(r => r.status === 409)`.
- Lượt **không có mã 409 nào** thì không được đếm vào `races`.
- Vậy 9/10 nghĩa là có một lượt **không bên nào nhận 409**.

**Đo:**

| Nguồn | Số đo |
|---|---|
| Database của thợ K (`makeup_test_k`) | `pg_stat_database.deadlocks = 4`. Log PostgreSQL ghi 4 khoá chết lúc 17:25:33, 17:30:48, 17:30:50, 17:36:59. Cả 4 đều là hai câu `UPDATE "appointments" SET "starts_at", "ends_at"…` chờ nhau, "while checking exclusion constraint … in relation appointment_staff", trong trigger `appointments_sync_staff_block()`. Hai khoá chết cách nhau 2 giây lúc 17:30 khớp với lần K thấy 8/10; hai lần còn lại khớp với 9/10 |
| Database của tôi, 21 lần chạy bài N4 = 210 lượt đua | 1 lượt lệch (9/10, lần chạy lúc 18:31). Log PostgreSQL ghi đúng 1 khoá chết tự nhiên lúc 18:31:29.167, cùng hai câu lệnh, cùng chỗ (`log/pg-deadlock.txt`) |
| `dua-n4.test.ts`, 60 lượt khi máy rảnh + 60 lượt khi có 6 tiến trình chiếm CPU | 120/120 lượt `200 + 409(1 lịch trùng)`; khoảng bận thật luôn = 1 |
| `dua-20.test.ts`: 20 lịch cùng dời vào một giờ × 5 vòng | 5/5 vòng: 1×200, 19×409 có `conflicts`, 0 lộ lịch tổ chức B, 0 trỏ sai lịch, khoảng bận thật = 1 |
| `khoa-chet.test.ts` (dựng khoá chết chắc chắn: một giao dịch khác chiếm giờ, chờ API, rồi đụng lại dòng API vừa ghi) | API trả **500** `{"code":"INTERNAL","message":"Máy chủ gặp lỗi, vui lòng thử lại"}` sau **1088–1116 ms**; giao dịch kia commit; `deadlocks` tăng thêm 1. 2/2 lần chạy |

**Kết luận:**
- **Lỗi máy chủ**, không phải bài thử phụ thuộc thời điểm. Hai lệnh dời lịch đôi khi ghi khoảng bận mới gần như cùng lúc. Mỗi bên khi kiểm ràng buộc chặn trùng lịch lại thấy dòng chưa commit của bên kia, nên chờ nhau. PostgreSQL huỷ một bên với mã 40P01 (khoá chết).
- `guardOverlap` chỉ bắt mã 23P01 (trùng lịch), nên 40P01 rơi xuống bộ bắt lỗi chung và thành **500**.
- **Dữ liệu vẫn đúng:** không lượt nào hai bên cùng thắng, không lượt nào 409 thiếu `conflicts`.
- Lượt lệch hiếm khi máy rảnh (khoảng 1/210 lượt ở máy tôi). Khi máy bận nhiều tiến trình thì gặp nhiều hơn (K gặp 4 lần trong vài lần chạy).

---

## 4. Lỗi đã tái hiện

### TRUNG BÌNH

**T-I1 (thợ I). Hai người cùng dời lịch vào một giờ: đôi khi người thua nhận 500 "Máy chủ gặp lỗi" thay vì 409 "Trùng lịch" kèm danh sách**
- **Triệu chứng:**
  - Bên thua đợi khoảng 1 giây rồi nhận 500, không có `details.conflicts`.
  - Web sẽ hiện lỗi máy chủ chung, không nói "thợ X đã có lịch LH-…".
  - Log máy chủ ghi "Lỗi không lường trước".
  - Lời hứa N4 ("409 trùng lịch LUÔN kèm conflicts") sai ở nhánh này.
  - Bài thử N4 của thợ vì thế chập chờn (8/10, 9/10), làm "bài xanh" mất giá trị làm cửa gác.
- **Gốc:**
  - `apps/api/src/modules/schedule/service.ts:281-296`: `guardOverlap` chỉ xử lý `isStaffOverlapViolation` (23P01), không xử lý khoá chết 40P01.
  - `apps/api/src/http/middleware.ts` hàm `databaseError` (khoảng dòng 173-196): không có nhánh 40P01 hay P2034, nên thành 500.
  - Đường ghi: `apps/api/src/modules/schedule/appointments.ts:223-250`, cùng trigger `appointments_sync_staff_block` (`prisma/migrations/20261018160000_chot_chan_database/migration.sql:78-88`) ghi khoảng bận mới bên trong câu `UPDATE appointments`. Không có khoá theo thợ trước bước kiểm trước, nên hai giao dịch có thể cùng ghi rồi chờ nhau.
- **Số đo:** mục 3. Khoá chết tự nhiên: 4 ở database của thợ K, 1/210 lượt ở database của tôi. Dựng chắc chắn: 2/2 lần ra 500 sau khoảng 1,1 giây.
- **Bài tái hiện:** `bai-tai-hien/apps-api-test-cham/khoa-chet.test.ts` (đỏ: `expected [200, 409] to include 500`). Log `log/khoa-chet.log`, `log/pg-deadlock.txt`.
- **Hướng sửa (để thợ chọn):**
  - Trong `guardOverlap`: khi gặp 40P01 thì `ROLLBACK TO SAVEPOINT`, tra lại và trả 409 (hoặc thử ghi lại một lần).
  - Hoặc khoá theo thợ trước bước kiểm trước, ví dụ `pg_advisory_xact_lock` theo `membership_id`, để hai lệnh ghi cùng thợ xếp hàng.
  - Bài N4 nên đếm riêng "bên thua là 500" thay vì gộp vào "không có bên thua".

**T-L1 (thợ L). `pnpm typecheck` của web, và của gốc, đang đỏ**
- **Triệu chứng:** `src/api/khop-hop-dong.test.ts(515,11): error TS2345: Argument of type 'RevenueMonthRow[] | RevenueContractRow[]' is not assignable to parameter of type 'RevenueMonthRow[]'`. Lệnh `pnpm typecheck` ở gốc dừng với exit 2.
- **Gốc:** `apps/web/src/api/khop-hop-dong.test.ts:513-515`: `expect(byMonth.groupBy).toBe('month')` không thu hẹp kiểu, nên `first(byMonth.rows, …)` nhận kiểu hợp của hai loại hàng.
- **Số đo:** 1 lỗi TS, 1/1 lần chạy. Vitest vẫn chạy bài này xanh (12/12), vì vitest không kiểm kiểu. Bản build không bị, vì `tsconfig.json` loại `*.test.ts`.
- **Vì sao trung bình:** đúng loại lỗi T4 của biên bản trước. Commit đưa ra chấm phải qua đủ lệnh kiểm ở gốc.

### NHẸ

**N-J1 (thợ J). N6 còn một nhánh: ô đang lỗi, form đặt lại ĐÚNG giá cũ → ô vẫn hiện chữ sai và lỗi**
- **Triệu chứng:**
  - Ô tiền đang 3.000.000. Bôi đen, gõ đè "-5", rời ô.
  - Form "huỷ thay đổi" đặt lại 3.000.000. Ô vẫn hiện **"-5"**, `aria-invalid=true`, trong khi số thật là 3.000.000. Form vẫn bị chặn lưu tới khi người dùng sửa ô.
  - Ô km giống hệt: gõ ",," rồi đặt lại 12,5 → ô vẫn hiện ",,".
- **Gốc:** `apps/web/src/ui/MoneyInput.tsx:76-82` và `UnitInput.tsx:74-79` chỉ xoá chữ đang gõ khi `value` **khác** giá trị ô đã biết. Đặt lại cùng số thì không có gì thay đổi để nhận ra.
- **Số đo:** 2/2 (tiền, km). Log: `[N6-biến-thể] sau khi đặt lại: ô hiện "-5", aria-invalid=true, số thật=3000000`.
- **Tái hiện:** `nhap-so-dot-sua.test.tsx`, hai bài "N6 biến thể".

**N-J2 (thợ J). Cửa gác bí mật còn lọt vài dạng khoá khi môi trường build không có biến bí mật** (đúng tình cảnh Vercel)
- **Triệu chứng:** 10 tệp giả trong `dist-la/`, chạy với môi trường trống. Cửa gác báo **2 vi phạm / 10 tệp**. Bắt được: `'AIza'+'…'` và `sk_live_`. Lọt:
  - khoá bí mật Supabase dạng mới `sb_secret_…`;
  - thẻ bí mật Mapbox `sk.eyJ…`;
  - SID và thẻ Twilio;
  - khoá ghép bằng `["AIza","…"].join("")`;
  - khoá qua `atob(…)`;
  - khoá qua `String.fromCharCode(…)`;
  - chuỗi kết nối postgres mã hoá URL;
  - một tệp mẫu chuỗi thời gian (template).
  - Ghi chú: tệp mẫu chuỗi thời gian và cộng chuỗi đều được esbuild gộp lại khi build thật, nên ở bản build thật thì bắt được. Tôi đã thử `esbuild.transformSync`: hai cách này ra một chuỗi liền.
- **Gốc:** `apps/web/scripts/check-bundle-secrets.mjs:40-66`, danh sách hình dạng chưa có `sb_secret_`, Mapbox `sk.`, Twilio. Chuỗi ghép lúc chạy hay mã hoá thì không thể dò bằng hình dạng.
- **Đánh giá:** T2 cũ đã sửa: 6/6 tệp, và vite build thật bắt được. Phần còn lọt là dạng ít gặp, hoặc cố ý giấu. Riêng `sb_secret_` đáng thêm, vì dự án dùng Supabase.
- **Tái hiện:** `log/cua-gac-khoa-la.txt` (tệp mẫu đã nằm trong log, thư mục `dist-la/`).

**N-J3 (thợ J). Ô km không đọc lại được chữ do chính app in ra, và khoảng trắng giữa chữ số bị bỏ lặng lẽ**
- `parseKm(formatKm(2500))` = `parseKm("2.500 km")` → lỗi "Dấu chấm dễ nhầm". Chép số km từ chỗ khác trong app dán vào ô km sẽ bị từ chối (chỉ với số từ 1.000 km).
- `parseKm("1 5")` → 15 km, không báo gì.
- **Gốc:** `apps/web/src/ui/format.ts:81` (chặn dấu chấm mơ hồ) đối nghịch với `:118` (`formatKm` có ngăn nghìn); `:14` và `:64` bỏ mọi khoảng trắng trước khi đọc.
- **Tái hiện:** `nhap-so-dot-sua.test.tsx`, hai bài "km: …".

**N-I2 (thợ I). Bài thử của thợ I lọt 6/15 đột biến**

| Đột biến | Mã | Bằng chứng |
|---|---|---|
| I-a: bỏ khoá tư vấn khi tạo tổ chức | `apps/api/src/http/middleware.ts:221` | Bài "cùng khoá, khác thân, đồng thời" (`sua-nghiem-thu-web.test.ts:211-220`) chỉ gửi 2 yêu cầu, vẫn xanh. Tôi đo lại với 20 yêu cầu đồng thời trên máy chủ đã bỏ khoá: tạo **1, 3, 6 tổ chức** trong 3 vòng bằng **một** khoá. Có khoá: 3/3 vòng chỉ 1 tổ chức. Tức là khoá cần thiết và chạy đúng, nhưng bài thử không chứng minh được |
| I-d: bỏ hạn 24 giờ khi gửi lại đăng ký | `auth/routes.ts:54` | Không bài nào bắt |
| I-e: bỏ kiểm tài khoản còn hoạt động khi gửi lại đăng ký | `auth/routes.ts:53` | Không bài nào bắt. Thẻ của tài khoản bị khoá vẫn bị chặn ở mọi yêu cầu sau, nên thiệt hại thấp |
| I-f: chống dò đếm cả lần refresh thành công | `app.ts:77` | Bài "3 máy × 10 lần" đứng đúng biên 30 nên không thấy |
| I-n: không đếm thẻ gửi qua cookie (web) vào chống dò | `auth/transport.ts:52` | Bài dò chỉ gửi thẻ trong thân |
| I-o: lưới cuối 409 ở middleware bỏ `conflicts: []` | `middleware.ts` (nhánh 23P01) | Không bài nào bắt |

Chi tiết: `dot-bien/ket-qua-may-chu.txt`.

**N-K1 (thợ K). Hai chỗ bài thử chưa canh**
- K-c: bỏ lọc `status: 'READY', deletedAt: null` ở `apps/api/src/modules/files/service.ts:138` (ảnh của tệp đã xoá vẫn hiện) → `anh-dai-dien-tho` và `files` vẫn 24/24 xanh.
- K-d: bỏ `src/scripts/seed-plans.ts` khỏi `apps/api/tsup.config.ts`, tức bản build thiếu script → không bài nào bắt (5 tệp, 34/34 xanh). Mã hiện tại đúng; đây chỉ là bài thử chưa canh.

**N-J4 (thợ J), N-M1 (thợ M). Mỗi thợ một chỗ bài thử chưa canh**
- J-d: cửa gác bỏ điều kiện "tệp không đọc được thì không đạt" (`check-bundle-secrets.mjs:207`) → 33/33 vẫn xanh.
- M-d: `client.ts:136` coi 429 khi refresh giữa phiên là hết phiên (đá người dùng ra trang đăng nhập) → `client.test` và `session.test` 28/28 vẫn xanh. Mã hiện tại đúng (loại 429); chỉ thiếu bài thử.

**N-L2 (thợ L). Bài khớp hai đầu vẫn không so dạng chi tiết lỗi**
- `AppointmentConflict` trong `types.ts:445-454` hiện khớp tay đúng 8 trường của máy chủ (`schedule/service.ts` `OverlapConflict`).
- Nhưng `khop-hop-dong.test.ts` không gọi nhánh 409 nào, nên một trường đổi tên ở đây sẽ lọt. Đây là nghi ngờ số 2 của lần trước, còn một nửa.

### Ghi nhận (không phải lỗi, cần biết)

- **G-I1. Dấu vân tay chống gửi trùng phụ thuộc thứ tự trường.**
  - Gửi lại tạo tổ chức với cùng nội dung nhưng đổi thứ tự trường JSON → 409 "đã dùng cho một yêu cầu khác". Đổi thứ tự `?name=&purpose=` khi tải tệp cũng vậy (`app.ts:196-205`).
  - Web không bị, vì cùng một đoạn mã dựng thân. App điện thoại sau này phải giữ đúng thứ tự khi gửi lại.
- **G-I2.** Cùng khoá, gửi tệp B nhưng khai `X-Content-SHA256` của tệp A (đã tải) → 201 trả lại kết quả tệp A. Người gửi chỉ nhận lại kết quả của chính mình, không hại.
- **G-K1.** `node dist/scripts/grant-platform-admin.js` không tham số in hướng dẫn `pnpm --filter @makeup/api platform:grant-admin …` (lệnh dev cần tsx), trong khi trên máy thật phải dùng `platform:grant-admin:prod`.
- **G-J1.** Ô km gõ tay từng phím "12,5 km": phím "k" bị chặn ("Chỉ nhập chữ số") và không hiện lên ô. Chỉ dán thì nhận. Không hại, vì hậu tố "km" đã hiện sẵn.

---

## 5. Nghi ngờ, rủi ro chưa tái hiện trên máy thật

1. **Sau Vercel, mọi người dùng web có thể chung một địa chỉ IP với máy chủ.**
   - Đã ghi sẵn ở `docs/DEPLOYMENT.md:95`, đợt sửa không làm xấu thêm.
   - Mô phỏng (`bai-cham/vercel-chung-ip.mjs`, Railway nối IP Vercel vào cuối `X-Forwarded-For`):
     - `TRUST_PROXY_HOPS=1`: một kẻ phá gửi 31 refresh thẻ bịa (30×401, 1×429). Sau đó **một người dùng thật ở IP khác, cookie đúng, tải lại trang → 429**.
     - `TRUST_PROXY_HOPS=2` → người dùng thật **200**. Nhưng khi đó app điện thoại gọi thẳng Railway có thể tự khai IP.
   - Nghĩa là nếu chọn 1, chỉ khoảng 30 lần refresh sai mỗi phút từ bất kỳ đâu là chặn được việc khôi phục phiên của mọi người dùng web. Trần tổng 300 refresh/phút cũng thành trần chung cho cả nước.
   - Cần đo số tầng proxy thật trước khi ra mắt.
2. **Gửi lại đăng ký có thể dò mật khẩu không?** Tôi kết luận **không thực tế**.
   - Kẻ dò cần cả email, họ tên **và** khoá gốc (UUID máy khách sinh ra; máy chủ chỉ lưu mã băm trong nhật ký).
   - Đã thử: cùng khoá, sai mật khẩu → 409 như cũ; 20 yêu cầu đồng thời nửa đúng nửa sai mật khẩu → 10×201 (đúng mật khẩu) / 10×409 (sai). Đăng nhập chỉ được bằng mật khẩu thật.
   - Không có đường nào lấy được khoá gốc từ máy chủ.

---

## 6. Đã tấn công nhưng KHÔNG phá được

- **T3:**
  - 12 lần tải lại ở giới hạn mặc định → 12×200, đăng nhập sau đó 200.
  - Đổi `X-Forwarded-For` khi `TRUST_PROXY_HOPS=0` → vẫn 429 sau 3 lần sai (mức dò khi AUTH=1).
  - `TRUST_PROXY_HOPS=1`, chèn IP giả phía trước IP proxy → vẫn 429.
  - 429 của cả ba bộ đếm đều có `Retry-After`.
- **N2, tạo tổ chức** (máy chủ bản build):
  - 20 yêu cầu đồng thời cùng khoá, cùng thân × 3 vòng → 20×201, **1 id**.
  - 20 yêu cầu cùng khoá, 20 thân khác nhau × 3 vòng → **1×201 + 19×409**.
  - Hai người khác nhau cùng khoá → mỗi người 201 tổ chức của mình.
- **N2, đăng ký:**
  - 20 yêu cầu đồng thời cùng khoá × 3 vòng → 20×201, 1 tài khoản.
  - 20 yêu cầu cùng email, khác khoá → 1×201 + 19×409.
  - Email viết hoa có khoảng trắng, họ tên có khoảng trắng → vẫn nhận là gửi lại (201).
- **N3:** 14 dạng cookie hỏng, 0 lần 500 (mục 1 dòng 12).
- **N4 khi không khoá chết:** 20 lịch cùng dời vào một giờ × 5 vòng → 19 bên thua đều có `conflicts` trỏ đúng lịch thắng. **Không lộ lịch của tổ chức khác** (tổ chức B có lịch cùng giờ: lộ 0/95).
- **Tệp** (bản build production, driver đĩa cục bộ):
  - Tải ảnh → URL ký → 200 đúng từng byte, `nosniff`, CSP sandbox.
  - Vé sửa 1 ký tự → 403; vé `../../etc/passwd` → 403.
  - Cùng khoá + khác tệp → 409; khác mục đích → 409; đồng thời cùng khoá khác tệp → 201 / 409 "đang được xử lý".
  - Khai SHA không khớp nội dung → 400.
- **K, migration ảnh đại diện với 14 dòng bẩn** (`mig/du-lieu-ban.sql`):
  - Migration chạy trọn, không lỗi.
  - Chép đúng: tệp cùng tổ chức (cả UUID viết hoa).
  - Giữ nguyên, không vỡ: tệp tổ chức B, tệp không tồn tại, `file:khong-phai-uuid`, `file:`, có khoảng trắng hoặc xuống dòng, `FILE:`, dạng `{uuid}`, dạng không gạch, `https://…`.
  - Tệp đã xoá và tệp sai mục đích cũng được chép, nhưng đường hiện ảnh lọc `READY`, nên tệp đã xoá → null.
- **K, cấu hình:** bản build production:
  - thiếu `STORAGE_DRIVER` → exit 1;
  - thiếu từng biến của driver local hoặc s3 → exit 1, nêu đúng tên biến;
  - khoá ký ngắn, hoặc trùng `JWT_ACCESS_SECRET` → exit 1;
  - đủ biến → chạy;
  - **0 lần** lời báo chứa giá trị bí mật.
  - 3 script `dist/scripts/*.js` chạy được với `node` thuần: cấp và thu quyền có ghi nhật ký; thiếu `DATABASE_URL` thì từ chối.
- **M** (Chromium thật, `cham-dot-sua.pw.ts`, 9/9):
  - 429 kèm `Retry-After: 1` → đúng 2 lần refresh trong 6 giây (lần đầu + 1 lần tự thử), hiện nút "Thử lại", **không về trang đăng nhập**. Bấm nút → thêm đúng 2 lần.
  - `Retry-After` thiếu, `-1`, `abc` → chờ 60 giây; `0` hoặc ngày đã qua → chờ 1 giây; `999999` → kẹp 300 giây. Không lần nào quá 2 lần trong 4 giây.
  - Ảnh: `anh/429-khoi-phuc-phien.png`.
  - Tạo tổ chức: máy chủ đã tạo nhưng trình duyệt mất trả lời → bấm lại → **cùng khoá** (2/2 lần gửi giống nhau), vào đúng tổ chức, người dùng có **1** tổ chức.
- **J:**
  - N1: bấm nền rồi Esc → hộp đóng (Chromium thật).
  - N9: e2e không ghi đè ảnh tài liệu.
  - Chuỗi lạ ở ô tiền: "1.500,5", "1e6", số toàn chiều rộng, số Ả Rập, `"1.500.000"`, "1.500.000,00", ký tự rỗng vô hình, "–5" đều bị chặn. "  2 500 ", "1500000\t", "1.500.000\r\n" (dán từ Excel), "1 500 000 VND" đọc đúng.
- **Đột biến bị bắt** (`dot-bien/ket-qua-*.txt`):

| Thợ | Bị bắt | Lọt / ghi chú |
|---|---|---|
| J | 10/11 | J-d lọt. Hai đột biến tương đương, không tính: J-b (mẫu `_KEY$` vẫn bắt tên `*_API_KEY`; bản bỏ cả hai mẫu là J-b2, bị bắt) và J-e (bỏ đọc latin1 không đổi kết quả vì chuỗi ASCII vẫn còn khi đọc utf8) |
| L | 7/7 | — |
| M | 6/7 | M-d lọt |
| I | 9/15 | 6 lọt (bảng N-I2) |
| K | 5/7 | K-c, K-d lọt |

---

## 7. Lỗi cũ: còn tái hiện không

| Lỗi lần trước | Bây giờ |
|---|---|
| T1 trang xem thử thiếu 2/5 nhóm | Ngoài phạm vi đợt này, không chấm |
| T2 cửa gác lọt khoá dịch vụ ngoài | **Hết** (6/6 tệp; vite build thật bắt được) |
| T3 tải lại 10 lần/phút bị khoá đăng nhập | **Hết** (12×200, đăng nhập 200) |
| T4 lệnh kiểm ở gốc đỏ | Phần máy chủ **hết** (357/357). **`pnpm typecheck` gốc lại đỏ**, lần này ở web (T-L1) |
| N1 bấm nền rồi Esc | **Hết** |
| N2 đăng ký / tạo tổ chức bỏ qua khoá | **Hết** |
| N3 cookie hỏng → 500 | **Hết** |
| N4 409 khi đua thiếu `conflicts` | 409 luôn có `conflicts` (0/10 bài cũ; 0/95 bên thua ở bài 20 lịch). **Còn nhánh khoá chết → 500** (T-I1) |
| N5 gõ "1.5" thành 15 đ | **Hết** |
| N6 ô tiền hiện chữ cũ khác số thật | **Hết với giá trị mới khác**; **còn khi đặt lại đúng giá cũ** (N-J1) |
| N7 km "2.500" thành 2.500 km | **Hết** (giờ báo lỗi) |
| N8 dán "12,5 km" bị chặn | **Hết** |
| N9 e2e ghi đè ảnh tài liệu | **Hết** |
| Nghi ngờ 3: bài khớp dùng database chung | **Hết** (bắt buộc `KHOP_HOP_DONG_DATABASE_URL`) |

---

## 8. Dọn dẹp

- Đã tắt 8 máy chủ thợ chấm bật (cổng 4042–4048, 4054), kill theo PID có ghi trong tệp `pid-*`. Playwright tự tắt API và Vite của nó. Đã kiểm lại các cổng 4042–4054 và 5192 không còn trả lời.
- Đã gỡ worktree (`git worktree remove --force`, vì còn tệp bài thử chưa theo dõi; bản sao đã chép ra `bai-tai-hien/`).
- Đã xoá database `makeup_test_cham_sua1` và `makeup_test_cham_sua1_mig`.
