# @makeup/web — web quản trị Makeup Pro

Móng ứng dụng: Vite + React 19 + TypeScript strict + React Router 7. Giao diện **chưa định kiểu** — chờ gói W2/W3 theo `docs/rnd/BAN-VE-C.md`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy Vite ở http://localhost:5173, chuyển `/api` sang máy chủ API ở `http://localhost:4000` (đổi bằng biến `API_DEV_TARGET`) |
| `pnpm build` | Kiểm kiểu → `vite build` → cửa gác bí mật → đối chiếu `vercel.json` |
| `pnpm typecheck` | `tsc --noEmit` cho mã trình duyệt và mã chạy trên Node (cấu hình, bài thử, script) |
| `pnpm test` | Vitest: máy khách API (fetch giả lập), kiểm dữ liệu form, cửa gác bí mật |
| `pnpm e2e` | Playwright: tự chạy máy chủ API thật + Vite dev, đi luồng đăng ký → tạo tổ chức → tải lại → đăng xuất. Ảnh ở `e2e/anh/` |

E2E cần database thử riêng (một lần):

```sh
su postgres -c "createdb -O makeup makeup_test_web"
su postgres -c "psql -d makeup_test_web -c 'create extension btree_gist'"
cd apps/api && DATABASE_URL=postgresql://makeup:makeup_local@localhost:5432/makeup_test_web DIRECT_URL=$DATABASE_URL npx prisma migrate deploy
```

Đổi database bằng biến `E2E_DATABASE_URL`. Cổng 4000 và 5173 phải trống.

## Gọi API cùng tên miền

Trình duyệt luôn gọi đường tương đối `/api/v1/...`. Không có URL máy chủ nào trong mã web.

- **Dev:** `vite.config.ts` chuyển `/api` sang `http://localhost:4000`.
- **Vercel:** `vercel.json` chuyển `/api/(.*)` sang máy chủ Railway, mọi đường khác trả `index.html`.

Nhờ cùng tên miền, cookie refresh `mp_refresh` (httpOnly, SameSite=Strict, đường `/api/v1/auth`) là cookie cùng trang. Máy chủ không cần mở CORS cho trình duyệt.

### Đặt URL máy chủ Railway cho Vercel

`vercel.json` không đọc được biến môi trường, nên URL được ghi vào tệp bằng script, rồi kiểm lại lúc build:

1. Trên Vercel (Project → Settings → Environment Variables), đặt `API_ORIGIN` = `https://<TÊN-DỊCH-VỤ-RAILWAY>.up.railway.app` (hoặc tên miền riêng của API). Chỉ gồm `https://tên-miền`, không có đường dẫn, không có `/` cuối.
2. Trên máy, ghi `vercel.json` với đúng giá trị đó rồi commit:
   ```sh
   cd apps/web
   API_ORIGIN=https://<TÊN-DỊCH-VỤ-RAILWAY>.up.railway.app node scripts/vercel-config.mjs --write
   ```
3. Khi build trên Vercel (`VERCEL=1`), `pnpm build` chạy `vercel-config.mjs --check`: thiếu `API_ORIGIN`, hoặc `vercel.json` trỏ chỗ khác `API_ORIGIN` → **build dừng**. Bản trong kho đang trỏ `https://API_ORIGIN-chua-dat.invalid` (tên miền `.invalid` không bao giờ tồn tại), nên chưa làm bước 2 thì không thể đưa lên.

Thiết lập dự án Vercel: Root Directory = `apps/web`. Lệnh build và thư mục `dist` đã ghi trong `vercel.json`.

## Phiên đăng nhập

- Access token chỉ nằm trong biến của `src/api/client.ts` (bộ nhớ). Không dùng localStorage hay sessionStorage cho token.
- Refresh token nằm trong cookie httpOnly do máy chủ đặt khi có header `X-Client: web`. Mọi yêu cầu đều gửi header này và `credentials: 'same-origin'`.
- Gặp 401: gọi `POST /api/v1/auth/refresh` (thân `{}`) **một lần** cho mọi yêu cầu đang chờ, rồi gửi lại. Máy chủ từ chối refresh → xoá phiên, về `/dang-nhap`. Mất mạng hoặc máy chủ lỗi 5xx/429 khi refresh → báo lỗi, giữ phiên.
- Tải lại trang: `src/app/session.tsx` gọi refresh để khôi phục phiên.
- localStorage chỉ giữ id tổ chức đang chọn (`makeup-pro.to-chuc-dang-chon`). Mất thì chọn tổ chức đầu.
- POST tạo dữ liệu: `api.create(path, body, newIdempotencyKey())`. Khoá sinh khi bấm nút, giữ nguyên khi tự gửi lại sau refresh.

## Cửa gác bí mật

`scripts/check-bundle-secrets.mjs` quét `dist/` (chạy trong `pnpm build`). Nó tìm:

- tên biến máy chủ `JWT_ACCESS_SECRET`, `DATABASE_URL`, `DIRECT_URL`;
- chuỗi `postgresql://` (và `postgres://`);
- tên biến `VITE_*` không có trong `ALLOWED_VITE_VARS` (hiện rỗng);
- **giá trị** của các biến trên nếu chúng đang có trong môi trường build (log chỉ in tên biến, không in giá trị).

Có vi phạm → in tên tệp, `N vi phạm / M tệp`, thoát mã 1. Muốn dùng biến `VITE_*` mới thì thêm tên vào `ALLOWED_VITE_VARS` trong script. Mọi biến `VITE_*` đều lộ ra trình duyệt: không đặt bí mật vào đó.

## Thư mục

```
src/main.tsx             gốc
src/app/App.tsx          RouterProvider
src/app/routes.tsx       bảng đường (/dang-nhap, /dang-ky, /tao-to-chuc, /:orgSlug/...)
src/app/session.tsx      context phiên
src/app/OrgShell.tsx     khung tạm chưa định kiểu (gói W3 thay bằng src/layout/AppShell.tsx)
src/api/client.ts        fetch, token trong bộ nhớ, refresh xếp hàng
src/api/errors.ts        ApiError, ánh xạ 400/401/403/404/409 (bản vẽ mục 5)
src/api/idempotency.ts   khoá chống gửi trùng
src/api/auth.ts          đăng nhập, đăng ký, đăng xuất, me, tạo tổ chức
src/features/auth/       ba trang đăng nhập, đăng ký, tạo tổ chức
```
