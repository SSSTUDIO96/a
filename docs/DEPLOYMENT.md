# Triển khai — Makeup Pro

Ngày viết: 18/10/2026.

> **Mốc dẫn chứng:** mọi `tệp:dòng` trong tài liệu này đúng với commit `f7b0805` (15:29 UTC ngày 18/10/2026). Lúc viết, các thợ khác đang sửa nhiều tệp lõi (chưa lưu vào kho, kể cả sửa theo biên bản nghiệm thu mốc 2); khi các sửa đó được lưu, số dòng có thể lệch và điều phối cần dò lại.

> **Chưa có môi trường thật nào.** Chưa tạo Supabase, Railway, Vercel cho Makeup Pro. Mọi bước dưới đây mới chạy trên máy đám mây (PostgreSQL 16.15 cài trong máy), **chưa chạy trên Supabase/Railway/Vercel**. Cột "Đã thử" ghi rõ từng bước.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. Vài từ phải biết
| Từ | Nghĩa bằng lời thường |
|---|---|
| Biến môi trường | Các thông số đặt cho máy chủ lúc chạy (địa chỉ database, khoá bí mật…). Không ghi vào mã, không đưa lên kho |
| Supabase | Dịch vụ thuê PostgreSQL + kho lưu file |
| Railway | Dịch vụ thuê máy chạy API |
| Vercel | Dịch vụ thuê chỗ chạy trang web |
| Pooler | "Tổng đài" đứng trước database, gom nhiều kết nối nhỏ thành ít kết nối. Lệnh đổi cấu trúc database không đi qua tổng đài được, phải gọi thẳng |
| Extension | Phần mở rộng của PostgreSQL. Ở đây cần `btree_gist` để chặn trùng lịch |

### 2. Luật triển khai
| # | Luật | Vì sao |
|---|---|---|
| 1 | Bí mật chỉ nằm ở trang cài đặt của dịch vụ (Railway/Supabase), không nằm trong kho, không gửi qua chat | Kho bị lộ không kéo theo lộ database |
| 2 | Thiếu biến bắt buộc thì máy chủ phải **từ chối chạy**, không tự lấy giá trị mặc định | Chạy với khoá rỗng còn nguy hiểm hơn không chạy |
| 3 | Đổi cấu trúc database bằng lệnh áp migration (`migrate deploy`), không bao giờ dùng lệnh xoá trắng trên máy thật | Mất dữ liệu khách |
| 4 | Thứ tự: database sẵn sàng → áp migration → bật máy chủ mới | Máy chủ mới chạy trên database cũ sẽ lỗi |
| 5 | "Xong" = bản build chạy thật trả lời được, không phải "bài thử qua" | Xem `docs/SO-LOI-DA-DO.md` lỗi 1 |
| 6 | Máy thật và máy thử dùng **database khác nhau** | Bài thử tạo dữ liệu rác |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Biến môi trường
Đọc và kiểm ở `apps/api/src/env.ts:4-14`. Thiếu biến bắt buộc → máy chủ báo "Cấu hình môi trường không hợp lệ" và không chạy (`env.ts:18-24`). Không ghi giá trị bí mật ở đây.

| Tên | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `NODE_ENV` | có | — | `development`, `test` hoặc `production` |
| `PORT` | không | 4000 | Cổng máy chủ nghe. Railway tự đặt biến này |
| `DATABASE_URL` | có | — | Chuỗi kết nối database mà **máy chủ dùng khi chạy**. Trên Supabase: chuỗi đi qua pooler |
| `DIRECT_URL` | có cho lệnh migration | — | Chuỗi kết nối **thẳng** tới database, không qua pooler. Chỉ lệnh Prisma (`migrate deploy`) đọc, khai ở `apps/api/prisma/schema.prisma:12`. Máy chủ khi chạy không đọc biến này (đã thử: chạy được khi thiếu) |
| `JWT_ACCESS_SECRET` | có | — | Khoá ký thẻ đăng nhập, ít nhất 32 ký tự. Lộ khoá này = ai cũng giả được thẻ của mọi người |
| `ACCESS_TOKEN_TTL_SECONDS` | không | 900 | Thẻ truy cập sống bao nhiêu giây |
| `REFRESH_TOKEN_TTL_DAYS` | không | 30 | Phiên đăng nhập dài hạn sống bao nhiêu ngày |
| `CORS_ORIGINS` | không | rỗng | Danh sách tên miền web được gọi API, cách nhau dấu phẩy. **Rỗng = không trang web nào gọi được** |
| `AUTH_RATE_LIMIT_PER_MINUTE` | không | 10 | Số lần đăng ký/đăng nhập/đổi thẻ mỗi phút mỗi IP |
| `LOG_LEVEL` | không | `info` | Mức chi tiết của log |
| `TRUST_PROXY_HOPS` | không | 0 | **Đang thêm, chưa lưu vào kho.** Số tầng proxy đứng trước máy chủ (Railway: 1). 0 = không tin header IP do máy khách gửi, chống lách giới hạn tốc độ |
| `TEST_DATABASE_URL` | chỉ cho bài thử | database `makeup_test` trên máy | Database dành cho bài thử; tên phải chứa `makeup_test` (`apps/api/test/global-setup.ts:7-9`) |

Kho có `.gitignore` chặn `.env` (dòng 3–4). Tệp mẫu `apps/api/.env.example` đang được thêm (chưa lưu vào kho lúc viết).

### 2. Thứ tự triển khai lần đầu
| Bước | Việc | Lệnh / nơi làm | Đã thử |
|---|---|---|---|
| 1 | Tạo project Supabase riêng cho Makeup Pro (không dùng chung với Studio Pro) | Trang quản trị Supabase | Chưa |
| 2 | Lấy hai chuỗi kết nối: qua pooler → `DATABASE_URL`; kết nối thẳng → `DIRECT_URL` | Supabase → Connect | Chưa |
| 3 | **Bật extension `btree_gist`** | Supabase → Database → Extensions | Chưa. Migration 2 có lệnh `CREATE EXTENSION IF NOT EXISTS btree_gist` (`20261018151403_bang_gia_lich/migration.sql:358`), nhưng tài khoản không đủ quyền thì lệnh này hỏng (`docs/SO-LOI-DA-DO.md` lỗi 5), nên bật trước bằng tay |
| 4 | Áp migration | `pnpm --filter @makeup/api db:deploy` (chạy `prisma migrate deploy`), cần `DATABASE_URL` và `DIRECT_URL` | Đã thử trên PostgreSQL 16.15 trong máy đám mây: áp đủ 3 migration lên database trống. **Chưa thử trên Supabase** |
| 5 | Đồng bộ vai trò mẫu cho tổ chức cũ | `pnpm --filter @makeup/api db:sync-roles` | Đã thử qua bài thử `system-roles.test.ts`. Lần đầu triển khai chưa có tổ chức nào nên không đổi gì |
| 6 | Tạo service Railway, đặt biến môi trường ở mục 1 | Trang quản trị Railway | Chưa |
| 7 | Lệnh build | `pnpm install --frozen-lockfile && pnpm --filter @makeup/api build` (chạy `prisma generate` rồi đóng gói ra `apps/api/dist/server.js`) | Build đã chạy trên máy đám mây (`docs/SO-LOI-DA-DO.md` lỗi 1). **Chưa chạy trên Railway** |
| 8 | Lệnh chạy | `pnpm --filter @makeup/api start` (= `node dist/server.js`) | Như trên |
| 9 | Kiểm tra sau khi chạy | `GET /health` → `{"ok":true}`; `GET /api/v1/openapi.json` có 16 đường trở lên; đăng ký một tài khoản thử | Chưa |
| 10 | Web trên Vercel | — | **Chưa có web** |

### 3. Mỗi lần triển khai về sau
1. Áp migration mới (`db:deploy`) **trước** khi bật bản máy chủ mới.
2. Bật bản máy chủ mới. Máy chủ tắt êm khi nhận tín hiệu dừng (`apps/api/src/server.ts:15-22`).
3. Nếu danh mục quyền có thay đổi: chạy `db:sync-roles`.
4. Gọi `/health` và thử một thao tác thật.

### 4. Những điểm CHƯA kiểm thử trên môi trường thật
| Điểm | Vì sao phải để ý |
|---|---|
| Prisma đi qua pooler của Supabase | Pooler kiểu "transaction" thường cần thêm tham số tắt prepared statement vào `DATABASE_URL` (theo tài liệu Prisma/Supabase). Chưa thử |
| Ràng buộc chặn trùng lịch trên Supabase | Cần `btree_gist`; Supabase cài extension vào schema riêng. Chưa thử |
| `prisma migrate deploy` và `db:sync-roles` trên Railway | `prisma` và `tsx` nằm ở nhóm thư viện chỉ dùng khi phát triển (`apps/api/package.json`, `devDependencies`). Nếu Railway chỉ cài thư viện chạy thật thì hai lệnh này không chạy được. `db:sync-roles` chạy thẳng mã nguồn bằng `tsx`, không nằm trong bản build (`tsup.config.ts` chỉ đóng gói `src/server.ts`) |
| Giới hạn tốc độ sau proxy của Railway | Ở commit `f7b0805` máy chủ tin cứng 1 lớp proxy (`app.ts:23`); bản đang sửa đổi sang biến `TRUST_PROXY_HOPS`. Số lớp proxy thật của Railway chưa đo |
| Chạy nhiều bản máy chủ cùng lúc | Bộ đếm giới hạn tốc độ nằm trong bộ nhớ từng máy |
| Sao lưu database | Chưa cấu hình, chưa diễn tập khôi phục |
| Tên miền, HTTPS, tên miền con theo slug tổ chức | Chưa có tên miền |
| Lưu file trên Supabase Storage | Chưa dùng |

### 5. Cấu hình còn thiếu (người cấp: anh Chiến)
Supabase riêng, Railway riêng, Vercel, tên miền, khoá Google Maps, cổng thanh toán, tài khoản Apple Developer. Danh sách đầy đủ và trạng thái: `docs/PROGRESS.md`.
