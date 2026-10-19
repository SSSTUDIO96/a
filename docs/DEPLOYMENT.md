# Triển khai — Makeup Pro

Cập nhật: 19/10/2026. Đối chiếu lại với mã đang làm trên nhánh `claude/nen-mong-makeup` (cây làm việc ngày 19/10/2026): biến môi trường (`apps/api/src/env.ts`), `apps/web/vercel.json`, lệnh build/start, số migration. Chỗ đã sửa so với bản 18/10 ghi ở cuối tài liệu.

> **Chưa có môi trường thật nào.** Chưa tạo Supabase, Railway, Vercel cho Makeup Pro. Mọi bước dưới đây mới chạy trên máy đám mây (PostgreSQL 16 cài trong máy). Cột "Đã thử" ghi rõ từng bước.
>
> **Việc anh Chiến phải tự làm (tạo tài khoản, dự án, cấp quyền cho em) và cách gửi giá trị an toàn: `docs/DUA-LEN-MANG.md`.** Supabase, Railway, Vercel của Makeup Pro là tài khoản/dự án **mới, riêng** — không dùng chung với "App Studio Pro (ssaas)" hay Supabase/Railway đang chạy của anh.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. Vài từ phải biết
| Từ | Nghĩa bằng lời thường |
|---|---|
| Biến môi trường | Thông số đặt cho máy chủ lúc chạy (địa chỉ database, khoá bí mật…). Không ghi vào mã, không đưa lên kho |
| Supabase / Railway / Vercel | Thuê database + kho tệp / thuê máy chạy API / thuê chỗ chạy trang web |
| Pooler | "Tổng đài" đứng trước database, gom nhiều kết nối. Lệnh đổi cấu trúc database phải gọi thẳng, không qua tổng đài |
| Extension | Phần mở rộng của PostgreSQL; ở đây cần `btree_gist` để chặn trùng lịch và chặn bậc phí chồng nhau |
| Chuyển tiếp (rewrite) | Vercel nhận yêu cầu `/api/...` rồi chuyển sang máy chủ Railway; trình duyệt chỉ thấy một tên miền |
| Proxy | Máy đứng giữa người dùng và máy chủ; mỗi tầng proxy thêm một địa chỉ IP vào header |

### 2. Luật triển khai
| # | Luật | Vì sao |
|---|---|---|
| 1 | Bí mật chỉ nằm ở trang cài đặt của dịch vụ, không nằm trong kho, không gửi qua chat | Kho lộ không kéo theo lộ database |
| 2 | Thiếu biến bắt buộc thì máy chủ **từ chối chạy** | Chạy với khoá rỗng nguy hiểm hơn không chạy |
| 3 | Đổi cấu trúc database bằng `migrate deploy`, không bao giờ xoá trắng trên máy thật | Mất dữ liệu khách |
| 4 | Thứ tự: database sẵn sàng → áp migration → đồng bộ vai trò → bật máy chủ mới | Máy chủ mới trên database cũ sẽ lỗi |
| 5 | "Xong" = bản build chạy thật trả lời được, không phải "bài thử qua" | `docs/SO-LOI-DA-DO.md` mục 1 |
| 6 | Máy thật và máy thử dùng database khác nhau | Bài thử tạo dữ liệu rác |
| 7 | Bản web phải qua cửa gác bí mật trước khi đưa lên | Mọi thứ trong bản web ai mở trang cũng đọc được |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Biến môi trường của máy chủ API
Kiểm ở `apps/api/src/env.ts` (bảng `EnvSchema`, luật đi kèm ở `superRefine`); thiếu biến bắt buộc → "Cấu hình môi trường không hợp lệ" (chỉ nêu tên biến, không in giá trị) và không chạy (`loadEnv` trong `env.ts`, `server.ts:6` gọi lúc bật). Đã chạy lại 19/10/2026 với bản build: `NODE_ENV=production`, `STORAGE_DRIVER=local` thiếu hai biến → báo đủ tên `STORAGE_SIGNING_SECRET`, `STORAGE_PUBLIC_BASE_URL`, không chạy; đủ biến → `/health` trả `{"ok":true}`, SIGTERM → `Đang tắt máy chủ`. Tệp mẫu: `apps/api/.env.example` (chỉ có chỗ trống, không có giá trị thật).

**Bản thật lấy biến từ môi trường của nền tảng (Railway).** Các lệnh `start` và `…:prod` chạy `node dist/…` trần, không có cờ đọc `.env`; tệp `.env` bị `.gitignore` chặn nên không có trên Railway. (Riêng thư viện Prisma tự nạp `apps/api/.env` nếu tệp đó đã có mặt lúc `prisma generate` chạy — chỉ xảy ra trên máy phát triển, đã đo 18/10/2026, xem sổ lỗi mục 25.) Các lệnh chạy thử trên máy (`dev`, `db:sync-roles`, `platform:grant-admin`, `platform:seed-plans`) tự đọc `apps/api/.env` nếu có (cờ `--env-file-if-exists=.env` của Node 22, `apps/api/package.json`); biến đã đặt sẵn trong môi trường thắng giá trị trong `.env` (sổ lỗi mục 25).

| Tên | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `NODE_ENV` | có | — | `production` trên máy thật (cookie mới có cờ Secure, `app.ts:154`) |
| `PORT` | không | 4000 | Railway tự đặt |
| `DATABASE_URL` | có | — | Chuỗi kết nối máy chủ dùng khi chạy. Supabase: qua pooler, cổng 6543, thêm `?pgbouncer=true` (theo `.env.example`) |
| `DIRECT_URL` | có cho lệnh migration | — | Chuỗi kết nối **thẳng** (cổng 5432). Chỉ lệnh Prisma đọc (`prisma/schema.prisma:12`) |
| `JWT_ACCESS_SECRET` | có | — | Khoá ký thẻ, ≥ 32 ký tự, mỗi môi trường một khoá. Lộ = ai cũng giả được thẻ |
| `ACCESS_TOKEN_TTL_SECONDS` | không | 900 | Thẻ truy cập sống bao lâu |
| `REFRESH_TOKEN_TTL_DAYS` | không | 30 | Thẻ dài hạn (và cookie `mp_refresh`) sống bao lâu |
| `CORS_ORIGINS` | không | rỗng | Tên miền trình duyệt được gọi thẳng API. Web đi qua Vercel cùng tên miền nên **để rỗng được** |
| `AUTH_RATE_LIMIT_PER_MINUTE` | không | 10 | Số lần đăng ký/đăng nhập mỗi phút mỗi IP |
| `REFRESH_PROBE_LIMIT_PER_MINUTE` | không | 3 × `AUTH_RATE_LIMIT_PER_MINUTE` | Số lần đổi thẻ **sai** mỗi phút mỗi IP (chống dò) |
| `REFRESH_RATE_LIMIT_PER_MINUTE` | không | 30 × `AUTH_RATE_LIMIT_PER_MINUTE` | Trần tổng số lần đổi thẻ mỗi phút mỗi IP (web đổi thẻ mỗi lần tải trang) |
| `TRUST_PROXY_HOPS` | không | 0 | Số tầng proxy đứng trước máy chủ. 0 = không tin IP do máy khách khai. `.env.example` ghi Railway đặt 1 (xem mục 4 về tầng Vercel) |
| `LOG_LEVEL` | không | `info` | Mức chi tiết log |

**Gửi thư (quên mật khẩu)** — khai và kiểm ở `apps/api/src/env.ts` (thợ K1, 19/10/2026), dựng người gửi thư ở `apps/api/src/lib/mailer/index.ts`. **Chưa có trong `apps/api/.env.example`** (tệp đó ngoài phạm vi thợ K1 — cần người giữ tệp thêm). Production thiếu cấu hình thì máy chủ VẪN khởi động, nhưng `POST /auth/password-reset/request` trả 503 `NOT_CONFIGURED` kèm `details.reason` (`MAIL_NOT_CONFIGURED` / `MAIL_CONSOLE_IN_PRODUCTION` / `WEB_APP_URL_NOT_CONFIGURED`) và log máy chủ ghi hướng dẫn cho người vận hành:

| Tên | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `MAIL_DRIVER` | không | dev/test: `console`; production: bỏ trống | `console` = in thư ra nhật ký (production không nhận); `http` = gọi API gửi thư qua HTTPS. Production bỏ trống → đường quên mật khẩu trả 503 `NOT_CONFIGURED` |
| `MAIL_FROM`, `MAIL_HTTP_URL`, `MAIL_HTTP_API_KEY` | cả 3, khi `MAIL_DRIVER=http` (thiếu → máy chủ không khởi động, nêu tên biến) | — | Người gửi (vd `Makeup Pro <no-reply@makeup.vn>`, tên miền phải được nhà cung cấp xác minh), địa chỉ API gửi thư (production phải `https`), khoá API (bí mật — đặt thẳng trên Railway). Thân gửi đi theo dạng của Resend (`{ from, to: [..], subject, text, html }` + `Authorization: Bearer`); nhà cung cấp khác thì sửa `lib/mailer/http.ts` hàm `body()` |
| `WEB_APP_URL` | production, để gửi thư | dev/test: `http://localhost:5173` | Địa chỉ trang web; đường dẫn trong thư = `<địa chỉ>/dat-lai-mat-khau#the=…` (thẻ sau dấu `#`: không đi lên Vercel, không lọt Referer) |
| `PASSWORD_RESET_TTL_MINUTES` | không | 30 | Thẻ đặt lại mật khẩu sống bao lâu (5–1440 phút) |

**Kho tệp** — khai và kiểm cùng chỗ với các biến trên (`apps/api/src/env.ts`, luật ở `superRefine`); `lib/storage/config.ts` chỉ dựng kho tệp từ cấu hình đã kiểm:

| Tên | Khi nào cần | Ý nghĩa |
|---|---|---|
| `STORAGE_DRIVER` | bắt buộc khi `production` | `s3` (kho tương thích S3, ví dụ Supabase Storage) hoặc `local` (ổ đĩa máy). Chạy thử trên máy bỏ trống → `local`, thư mục tạm của máy |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | cả 6 biến, khi `s3` ở **mọi** môi trường | Địa chỉ và khoá của kho tệp |
| `STORAGE_LOCAL_DIR`, `STORAGE_SIGNING_SECRET` (≥ 32 ký tự, **khác** `JWT_ACCESS_SECRET`), `STORAGE_PUBLIC_BASE_URL` | cả 3 biến, khi `local` ở `production` | Thư mục, khoá ký đường đọc có hạn, địa chỉ gốc |

Thiếu biến kho tệp thì máy chủ **không khởi động** — báo ngay lúc bật, nêu tên biến thiếu. Đã chạy 18/10/2026: `NODE_ENV=production` không có `STORAGE_DRIVER` → `Cấu hình môi trường không hợp lệ — STORAGE_DRIVER: thiếu — production phải chọn kho tệp: local hoặc s3`, mã thoát 1; thêm `STORAGE_DRIVER=local` mà thiếu ba biến kia → báo đủ tên ba biến. Không còn kiểu khởi động được rồi hỏng khi có người tải tệp đầu tiên (bài thử `apps/api/test/cau-hinh-kho-tep.test.ts`). Ổ đĩa của Railway mất khi khởi động lại (trừ khi gắn Volume), nên máy thật nên dùng `s3`.

**Biến của web khi build trên Vercel:** `API_ORIGIN` = `https://<máy chủ Railway>` (chỉ tên miền, không đường dẫn, không `/` cuối). Web không có biến `VITE_*` nào; cửa gác bí mật chặn biến `VITE_*` lạ (`apps/web/scripts/check-bundle-secrets.mjs`). Vercel tự đặt `VERCEL=1` khi build; `vercel-config.mjs --check` chỉ đối chiếu `API_ORIGIN` khi có biến này. Đã chạy 19/10/2026: `VERCEL=1` thiếu `API_ORIGIN` → `Thiếu biến môi trường API_ORIGIN…`, mã 1; `VERCEL=1` có `API_ORIGIN` nhưng `vercel.json` còn trỏ chỗ giữ chỗ → báo lệch, mã 1.

**Bộ biến tối thiểu cho máy thật đã chọn (Railway + Supabase, kho tệp S3 của Supabase):**

| Nơi đặt | Biến | Ai tạo giá trị |
|---|---|---|
| Railway (máy chủ API) | `NODE_ENV=production` | em |
| Railway | `DATABASE_URL`, `DIRECT_URL` | Supabase → Connect (anh tạo dự án, đặt mật khẩu database) |
| Railway | `JWT_ACCESS_SECRET` | em tạo ngẫu nhiên, đặt thẳng trên Railway, không đi qua chat |
| Railway | `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE=true` | Supabase → Storage (bucket + khoá S3) |
| Railway | `TRUST_PROXY_HOPS` | em, sau khi đo số tầng proxy (mục 4) |
| Railway | `WEB_APP_URL` (+ `MAIL_*` khi có dịch vụ gửi thư) | em, sau khi có địa chỉ Vercel |
| Railway | `PORT` | Railway tự đặt — không khai |
| Vercel (web) | `API_ORIGIN` | em, sau khi có địa chỉ Railway |

### 2. Thứ tự triển khai lần đầu
| Bước | Việc | Lệnh / nơi làm | Đã thử |
|---|---|---|---|
| 1 | Tạo project Supabase riêng (không dùng chung Studio Pro) | Trang quản trị Supabase | Chưa |
| 2 | Lấy chuỗi qua pooler → `DATABASE_URL`; chuỗi thẳng → `DIRECT_URL` | Supabase → Connect | Chưa |
| 3 | **Bật extension `btree_gist`** bằng tài khoản quản trị database | Supabase → Database → Extensions | Chưa trên Supabase. Trên máy thử: `create extension btree_gist` (`docs/BAN-GIAO-PHIEN.md`). Migration có `CREATE EXTENSION IF NOT EXISTS` (`20261018151403_bang_gia_lich/migration.sql:358`) nhưng tài khoản thiếu quyền thì hỏng (`docs/SO-LOI-DA-DO.md` mục 5) |
| 4 | Áp migration | `pnpm --filter @makeup/api db:deploy` (cần `DATABASE_URL`, `DIRECT_URL`) | Áp đủ trên PostgreSQL 16 máy đám mây (19/10/2026: 15 migration ở commit nhánh; cây làm việc đang có 17 — số đổi theo mã, đếm thư mục trong `apps/api/prisma/migrations`). **Chưa trên Supabase** |
| 5 | Tạo kho tệp (bucket) và khoá truy cập | Supabase → Storage | Chưa |
| 6 | Tạo service Railway: Root là gốc kho; đặt biến mục 1. Build command = lệnh ở bước 7; Start command = `pnpm --filter @makeup/api start`; đường kiểm sức khoẻ = `/health`. Node lấy theo `engines` (`>=22`) trong `package.json` gốc — **chưa kiểm Railway đọc trường này thế nào** | Railway | Chưa |
| 7 | Build | `pnpm install --frozen-lockfile && pnpm --filter @makeup/api build` — `prisma` nay nằm ở thư viện chạy thật, `pnpm install` tự `prisma generate`; build ra `dist/server.js` và ba lệnh quản trị `dist/scripts/run-sync-system-roles.js`, `grant-platform-admin.js`, `seed-plans.js` (`apps/api/tsup.config.ts:6-11`) | Build chạy lại 19/10/2026 trên bản lấy mã mới: ra đúng 4 tệp trên. Chưa trên Railway |
| 8 | Đồng bộ vai trò mẫu | `pnpm --filter @makeup/api db:sync-roles:prod` (chạy bản build, không cần công cụ phát triển) | Qua bài thử `system-roles.test.ts`. Chưa trên máy thật |
| 9 | Chạy | `pnpm --filter @makeup/api start` (= `node dist/server.js`); tắt êm khi nhận SIGTERM | Chưa trên Railway |
| 10 | Kiểm tra | `GET /health` → `{"ok":true}`; `GET /api/v1/openapi.json` đủ số đường; đăng ký thử | Chưa |
| 11 | Ghi địa chỉ Railway vào web | Trên máy: `cd apps/web && API_ORIGIN=https://<railway> node scripts/vercel-config.mjs --write`, rồi lưu `vercel.json` vào kho | Chưa. Bản trong kho trỏ `https://API_ORIGIN-chua-dat.invalid` nên **không thể** đưa lên khi chưa làm bước này |
| 12 | Tạo project Vercel | Root Directory = `apps/web`; đặt biến `API_ORIGIN`. `apps/web/vercel.json` đã ghi `buildCommand: pnpm build`, `outputDirectory: dist`, hai luật chuyển (`/api/(.*)` → Railway, còn lại → `/index.html`). `pnpm build` = kiểm kiểu → build → cửa gác bí mật → đối chiếu `vercel.json` với `API_ORIGIN`; lệch thì dừng. Web dùng gói `@makeup/shared` nằm ngoài `apps/web` — **chưa thử Vercel cài cả kho (pnpm workspace) khi Root Directory là thư mục con** | `pnpm build` chạy lại 19/10/2026 ngoài Vercel: qua, cửa gác 0 vi phạm. Chưa trên Vercel |
| 13 | Kiểm tra web | Mở trang, đăng ký, tải lại (phiên khôi phục bằng cookie), đăng xuất | E2E luồng này chạy được trên máy đám mây (`apps/web/e2e/luong-phien.spec.ts`). Chưa trên Vercel |

**Quản trị nền tảng (làm một lần sau bước 9):**

| Việc | Máy thật (bản build, biến từ nền tảng) | Chạy thử trên máy (tự đọc `apps/api/.env`) |
|---|---|---|
| Tạo gói mẫu | `pnpm --filter @makeup/api platform:seed-plans:prod -- --with-trial` | `pnpm --filter @makeup/api platform:seed-plans -- --with-trial` |
| Cấp quyền quản trị nền tảng (người đó phải tự đăng ký trước) | `pnpm --filter @makeup/api platform:grant-admin:prod -- --email <email>` | `pnpm --filter @makeup/api platform:grant-admin -- --email <email>` |

- **Phải có `--with-trial`.** Cờ này tạo thêm gói mặc định mã `trial` ("Dùng thử", không bán) cho tổ chức chưa được gán thuê bao (`apps/api/src/scripts/seed-plans.ts:41-52`). Thiếu gói `trial` thì tổ chức chưa được cấp gói bị chặn ở mọi chỗ kiểm giới hạn gói — hiện là **tạo khoá học** (`courses/service.ts:420`) và **xác nhận hợp đồng khoá học có học viên mới** (`contracts/enroll.ts:146`): mã `NOT_CONFIGURED`, HTTP 503, người dùng thấy *"Tổ chức chưa được gán gói dịch vụ nên tạm thời chưa thêm mới được…"*; log máy chủ ghi lệnh sửa (`apps/api/src/lib/quota.ts:139-162`, bài thử `goi-chua-co-khoa-hoc.test.ts`). Chạy thiếu cờ thì lệnh in cảnh báo `Chưa có gói mặc định mã "trial"…`. Chạy lại có cờ lúc nào cũng được: gói đã có (theo mã) được giữ nguyên, kể cả giá đã đặt.
- Đã chạy 18/10/2026 trên PostgreSQL 16 máy đám mây (bản chạy thử, lệnh trần, đọc `.env`): tạo 6 gói `trial, individual, pro, team, academy, academy_pro`; chạy lại → giữ nguyên cả 6; cấp quyền → `đã ghi nhật ký`, chạy lại → `không đổi gì`. Bản `:prod` **chưa chạy trên Railway**.

### 3. Mỗi lần triển khai về sau
1. `db:deploy` **trước** khi bật bản máy chủ mới.
2. `db:sync-roles:prod` nếu danh mục quyền đổi (an toàn khi chạy lại: không đổi gì nếu đã khớp).
3. Bật bản máy chủ mới; gọi `/health`.
4. Web: Vercel tự build khi có commit mới.

### 4. CHƯA kiểm thử trên môi trường thật
| Điểm | Vì sao phải để ý |
|---|---|
| Prisma qua pooler Supabase (`?pgbouncer=true`) | Chưa chạy lần nào |
| Chuỗi kết nối nào Railway gọi được | Supabase có nhiều kiểu chuỗi (thẳng, qua pooler cổng 6543, qua pooler cổng 5432). Kiểu "thẳng" có thể chỉ có địa chỉ IPv6; phải kiểm Railway có gọi ra IPv6 được không trước khi chọn chuỗi cho `DIRECT_URL`. **Chưa kiểm** — trang tài liệu Supabase/Railway bị chặn từ máy thợ ngày 19/10/2026 |
| Ràng buộc EXCLUDE trên Supabase | Supabase đặt extension ở schema riêng; chưa thử |
| **Số tầng proxy thật** | App gọi thẳng Railway (1 tầng). Web đi Vercel → Railway, có thể là 2 tầng. Đặt `TRUST_PROXY_HOPS=1` thì mọi người dùng web có thể bị đếm chung theo IP của Vercel cho giới hạn đăng nhập; đặt 2 thì app gọi thẳng có thể tự khai IP. Phải đo trên máy thật rồi mới chọn |
| Cookie qua chuyển tiếp của Vercel | Cookie đặt cho đường `/api/v1/auth`, SameSite=Strict; chưa thử qua Vercel thật |
| Nhiều bản máy chủ cùng lúc | Bộ đếm giới hạn tốc độ nằm trong bộ nhớ từng máy |
| Kho tệp `s3` | Chưa thử với Supabase Storage thật |
| Sao lưu database | Đã diễn tập `pg_dump -Fc` → `pg_restore --no-owner` vào database mới trên PostgreSQL 16 máy Linux (18/10/2026; đếm lại hai bên khớp, bật máy chủ trên bản khôi phục đăng nhập được — `docs/CHAY-THU-TREN-MAY.md` mục Sao lưu). **Chưa trên Supabase**: chưa cấu hình sao lưu tự động của Supabase, chưa diễn tập khôi phục ở đó |
| Tên miền, HTTPS | Chưa có tên miền |

### 5. Cấu hình còn thiếu (người cấp: anh Chiến)
Supabase riêng, Railway riêng, Vercel, tên miền, khoá Google Maps, cổng thanh toán, tài khoản Apple Developer, dịch vụ gửi thư (cho quên mật khẩu). Trạng thái: `docs/PROGRESS.md` mục 3. Danh sách việc anh tự làm cho Supabase/Railway/Vercel, cách gửi giá trị an toàn, chi phí: `docs/DUA-LEN-MANG.md`.

### 6. Đã sửa ở bản 19/10/2026 (so với bản 18/10)
| Chỗ | Cũ | Mới | Vì sao |
|---|---|---|---|
| Đầu tài liệu | Đối chiếu commit `f4bc165` | Đối chiếu cây làm việc 19/10; trỏ sang `DUA-LEN-MANG.md`; ghi rõ dự án mới, riêng | Mã đã đổi từ đó |
| Mục 1, trích dẫn | `env.ts:11-56`, `env.ts:65-71`, `env.ts:29-41`, `env.ts:42-56` | Gọi theo tên (`EnvSchema`, `superRefine`, `loadEnv`) | `env.ts` dài thêm, số dòng cũ đã lệch |
| Mục 1, `NODE_ENV` | cookie Secure ở `app.ts:99` | `app.ts:154` | Dòng đã dời |
| Mục 1, bảng biến | Thiếu `REFRESH_PROBE_LIMIT_PER_MINUTE`, `REFRESH_RATE_LIMIT_PER_MINUTE`; ghi `AUTH_RATE_LIMIT_PER_MINUTE` gồm cả đổi thẻ | Thêm hai biến; đổi thẻ có bộ đếm riêng | Theo `env.ts` và `.env.example` |
| Mục 1, gửi thư | Không có | Thêm `MAIL_*`, `WEB_APP_URL`, `PASSWORD_RESET_TTL_MINUTES` | Có trong `env.ts` cây làm việc 19/10 |
| Mục 1 | Không có bảng "đặt biến ở đâu, ai tạo" | Thêm bảng bộ biến tối thiểu Railway/Vercel | Cho người làm triển khai |
| Mục 2, bước 4 | "Đủ 15 migration" | Số đổi theo mã (15 ở commit nhánh, 17 ở cây làm việc 19/10) | Đã có thêm migration |
| Mục 2, bước 6, 7, 12 | Thiếu lệnh start, đường kiểm sức khoẻ, ghi chú workspace | Thêm; ghi rõ phần chưa kiểm | Đối chiếu `package.json`, `vercel.json` |
| Mục 4 | Không nhắc IPv6 | Thêm dòng "chuỗi nào Railway gọi được" (chưa kiểm) | Rủi ro kết nối khi chọn `DIRECT_URL` |
