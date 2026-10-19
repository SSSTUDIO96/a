# Quy ước API — Makeup Pro

Cập nhật: 18/10/2026. **Đã đối chiếu với commit `634d6a3`** (17:00 UTC; mã giống hệt `bc9633a`, hai commit sau chỉ thêm sổ ghi). Danh sách đường ở mục 7 sinh thẳng từ bảng đường của máy chủ bằng lệnh:

```
cd apps/api && npx tsx -e "import('./src/app.ts').then(m=>m.ALL_ROUTES.forEach(r=>console.log(r.method.toUpperCase(),r.path,r.permission??'')))"
```

Ở commit `bc9633a` lệnh in **77 đường**. Nguồn sự thật cuối cùng là tài liệu tự sinh `GET /api/v1/openapi.json`, không phải tệp này.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. API là gì
API là "quầy giao dịch" của máy chủ. Web, app iPhone, website giới thiệu đều gửi yêu cầu đến quầy này. Mỗi yêu cầu gồm: **cách làm** (xem `GET`, tạo `POST`, ghi đè `PUT`, sửa `PATCH`, xoá `DELETE`), **địa chỉ**, **thẻ đăng nhập**, và **dữ liệu** dạng JSON.

### 2. Quy ước nên có ở mọi API bán cho nhiều đơn vị
| Quy ước | Vì sao |
|---|---|
| Số phiên bản trên địa chỉ (`/api/v1`) | Đổi lớn thì mở `/v2`, app cũ trên điện thoại khách không gãy |
| Dữ liệu của một tổ chức nằm dưới `/orgs/:orgId/...` | Nhìn địa chỉ là biết đụng vào tổ chức nào; cửa gác kiểm một chỗ |
| Đường của chủ nền tảng nằm riêng dưới `/platform/...` | Không lẫn với quyền trong tổ chức |
| Một dạng lỗi duy nhất: mã máy đọc + câu tiếng Việt + mã số yêu cầu | Khách báo lỗi kèm mã số là tra được log |
| Danh sách dài thì chia trang | Không kéo cả nghìn dòng một lần |
| Thao tác tạo quan trọng có khoá chống gửi trùng | Bấm hai lần không tạo hai đơn |
| Tài liệu API sinh từ mã | Tài liệu viết tay lệch khỏi mã sau vài tuần (đúng chuyện đã xảy ra với chính tệp này, lỗi N4) |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Quy ước chung
| Mục | Quy ước | Dẫn chứng (`apps/api/src/`) |
|---|---|---|
| Gốc địa chỉ | Mọi đường nghiệp vụ dưới `/api/v1` | `app.ts:114` |
| Ngoài gốc | `GET /health` → `{"ok":true}` | `app.ts:57-59` |
| Thẻ truy cập | Header `Authorization: Bearer <accessToken>`, sống 900 giây (mặc định) | `http/middleware.ts:18-29`, `env.ts:9` |
| Bốn loại đường | `public` (không cần đăng nhập), `auth` (cần đăng nhập), `org` (thành viên + quyền khai cho đường), `platform` (có tên trong bảng `platform_admins`; người khác nhận 404) | `http/route.ts:9`, `app.ts:71-83` |
| Luật lắp ráp | Đường tổ chức phải dưới `/orgs/:orgId` và khai quyền; đường `/platform/...` phải khai phạm vi platform; sai thì máy chủ không khởi động | `http/route.ts:73-109` |
| Dữ liệu gửi lên | JSON ≤ 100KB; ký tự `\u0000` bị từ chối 400. Riêng tải tệp: thân là nội dung nhị phân | `app.ts:37-47` |
| Mã số yêu cầu | Header `x-request-id` (8–64 ký tự) hoặc máy chủ tự sinh; luôn trả lại | `http/middleware.ts:10-16` |
| Giới hạn tốc độ | Đăng ký, đăng nhập, đổi thẻ: mặc định 10 lần/phút/IP | `app.ts:49-55` |
| Tiền | Số nguyên đồng trong JSON | `packages/shared/src/money.ts` |

### 2. Đăng nhập: app và web khác nhau
| | App điện thoại (mặc định) | Web (gửi header `X-Client: web`) |
|---|---|---|
| Thẻ dài hạn trả về | Trong thân JSON (`refreshToken`) | **Chỉ** trong cookie `mp_refresh`: httpOnly, SameSite=Strict, đường `/api/v1/auth`, Secure khi chạy thật |
| Đổi thẻ / đăng xuất | Gửi `refreshToken` trong thân | Thân `{}`; cookie chỉ được đọc khi có `X-Client: web` |
| Dẫn chứng | `modules/auth/transport.ts:28-37` | `modules/auth/transport.ts:11-16`, `:42-49`; `app.ts:96-105` |

Đăng xuất không gửi thẻ (thân rỗng, không có cookie hợp lệ) → 401 "Phiên đăng nhập không hợp lệ" (`modules/auth/transport.ts:48`). Có thẻ → 204 và xoá cookie.

**Quên mật khẩu** (`modules/auth/password-reset.ts`, thợ K1 19/10/2026):

| Bước | Gửi | Nhận |
|---|---|---|
| 1. Yêu cầu | `POST /api/v1/auth/password-reset/request` `{ "email": "..." }` | **Luôn** `202 { "message": "Nếu email này có tài khoản, chúng tôi đã gửi đường dẫn…" }` — giống hệt dù email có tài khoản hay không, sau ≥ 300 ms. Tối đa 3 thư/giờ/email (vượt vẫn 202). `429` theo bộ đếm `auth` của IP. `503 NOT_CONFIGURED` + `details.reason` khi máy chủ chưa cấu hình gửi thư (giống nhau cho mọi email) |
| 2. Thư | Đường dẫn `<WEB_APP_URL>/dat-lai-mat-khau#the=<thẻ>` — hết hạn sau `PASSWORD_RESET_TTL_MINUTES` (30) phút; thư mới làm thư cũ hết tác dụng | |
| 3. Đặt mật khẩu | `POST /api/v1/auth/password-reset/confirm` `{ "token": "<thẻ>", "password": "<10 ký tự – 72 byte>" }` | `204` + xoá cookie `mp_refresh`; mọi refresh token và mọi thẻ đặt lại khác của người đó bị thu hồi → đăng nhập lại bằng mật khẩu mới. Thẻ sai/hết hạn/đã dùng/tài khoản bị khoá → `400 VALIDATION_FAILED`, `details.reason = "RESET_TOKEN_INVALID"`, cùng một lời. Mật khẩu không hợp lệ → `400` theo ô `password`, thẻ chưa bị tiêu |

Thẻ truy cập (access token) đang cầm vẫn sống tới hết hạn (≤ 15 phút) — xem `docs/SECURITY.md` phần rủi ro mục 3.

### 3. Dạng lỗi
```json
{ "error": { "code": "FORBIDDEN", "message": "Bạn không có quyền thực hiện thao tác này", "details": { "required": "members.invite" }, "requestId": "…" } }
```
(`http/middleware.ts:103-105`)

| `code` | HTTP | Khi nào |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Dữ liệu sai dạng: `details.fieldErrors` theo ô và `details.issues` có đường dẫn đầy đủ (ví dụ `lines.0.travel.amount`) để giao diện đặt lỗi đúng ô (`http/middleware.ts:85-90`); JSON hỏng, quá 100KB; thiếu `Idempotency-Key`; database chặn vì vi phạm CHECK hoặc tham chiếu không có thật |
| `UNAUTHENTICATED` | 401 | Thiếu/sai/hết hạn thẻ; tài khoản bị khoá; sai email hoặc mật khẩu |
| `FORBIDDEN` | 403 | Thiếu quyền (`details.required`), trao quyền mình không có (`details.missing`), tổ chức bị tạm khoá |
| `NOT_FOUND` | 404 | Không có đường; **không phải thành viên hoặc tổ chức không tồn tại** (cùng một lời); người không phải quản trị nền tảng gọi `/platform/...` |
| `CONFLICT` | 409 | Trùng dữ liệu; **trùng lịch thợ**; database từ chối theo luật khoá (hợp đồng đã xác nhận, phiếu thu…) — lời của database trả nguyên văn; tổ chức sẽ mất chủ cuối; khoá chống gửi trùng dùng cho yêu cầu khác |
| `RATE_LIMITED` | 429 | Thử quá nhiều lần trong một phút |
| `INTERNAL` | 500 | Lỗi không lường trước, chỉ ghi log |

Bảng đổi lỗi database: `http/middleware.ts:153-169`.

### 4. Chia trang
Đường danh sách nhận `?page=1&pageSize=20`; `pageSize` 1–100, mặc định 20 (sổ thu: mặc định 50). Trả về `{ "items": [...], "page", "pageSize", "total" }`. Dẫn chứng: `modules/orgs/routes.ts:28`, `modules/catalog/common.ts:20`, `modules/contracts/schemas.ts:112`.

### 5. Chống gửi trùng (`Idempotency-Key`)
Áp cho đường `POST` thuộc tổ chức có cờ `idempotent` — ở `bc9633a` có **13 đường** (đánh dấu ở mục 7). Máy khách sinh khoá mới cho mỗi lần bấm "Lưu" (8–128 ký tự chữ, số, `-`, `_`).

| Tình huống | Kết quả | Dẫn chứng (`app.ts`) |
|---|---|---|
| Thiếu/sai dạng khoá | 400 | `:134-137` |
| Gửi lại cùng khoá, **cùng đường dẫn thật** (kèm id), cùng nội dung | Trả đúng kết quả lần đầu | `:140`, `:163` |
| Cùng khoá nhưng khác đường dẫn thật hoặc nội dung | 409 | `:151-153` |
| Lần đầu đang xử lý | 409; quá 2 phút (máy chủ chết giữa chừng) thì cho lấy lại khoá | `:154-162` |
| Lần đầu thất bại | Nhả khoá | `:173-177` |

### 6. Tài liệu OpenAPI tự sinh
`GET /api/v1/openapi.json` (không cần đăng nhập, `app.ts:60-63`). Mỗi đường có tóm tắt, nhóm, tham số đường và tham số truy vấn, header `Idempotency-Key` khi bắt buộc (`http/openapi.ts:25`), dạng dữ liệu gửi lên, `x-permission`, và dạng lỗi `ErrorResponse` (`http/openapi.ts:33-37`, `:54-71`). Bài thử `apps/api/test/openapi.test.ts` kiểm mọi đường đều có kèm đúng quyền (ở `bc9633a`: 77/77). Chưa có: dạng dữ liệu trả về khi thành công.

### 7. Toàn bộ đường API ở commit `bc9633a` (77 đường)

**Đăng nhập** (5 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| POST | `/auth/register` | — (công khai) | giới hạn tốc độ | Đăng ký tài khoản |
| POST | `/auth/login` | — (công khai) | giới hạn tốc độ | Đăng nhập bằng email và mật khẩu |
| POST | `/auth/refresh` | — (công khai) | giới hạn tốc độ | Đổi refresh token lấy cặp thẻ mới |
| POST | `/auth/logout` | — (công khai) |  | Đăng xuất: thu hồi phiên trên thiết bị này |
| GET | `/auth/me` | — (chỉ cần đăng nhập) |  | Thông tin tài khoản và các tổ chức đang tham gia |
| POST | `/auth/password-reset/request` | — (công khai) | giới hạn tốc độ | Quên mật khẩu: gửi đường dẫn đặt lại qua email. Luôn 202 cùng một lời; 503 `NOT_CONFIGURED` khi chưa cấu hình gửi thư (thợ K1, 19/10/2026) |
| POST | `/auth/password-reset/confirm` | — (công khai) | giới hạn tốc độ | Đặt mật khẩu mới bằng thẻ trong thư (một lần). 204; thu hồi mọi phiên (thợ K1, 19/10/2026) |

**Tổ chức** (3 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| POST | `/orgs` | — (chỉ cần đăng nhập) |  | Tạo tổ chức mới; người tạo thành chủ tài khoản |
| GET | `/orgs/:orgId` | `org.read` |  | Xem thông tin tổ chức |
| PATCH | `/orgs/:orgId` | `org.update` |  | Sửa tên, múi giờ tổ chức |

**Nhân sự** (10 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| GET | `/orgs/:orgId/members` | `members.read` |  | Danh sách nhân sự |
| POST | `/orgs/:orgId/members` | `members.invite` |  | Thêm một tài khoản đã đăng ký vào tổ chức |
| PATCH | `/orgs/:orgId/members/:membershipId` | `members.update` |  | Đổi vai trò hoặc tạm khoá nhân sự |
| DELETE | `/orgs/:orgId/members/:membershipId` | `members.remove` |  | Cho nhân sự rời tổ chức (giữ lịch sử, không xoá dữ liệu) |
| GET | `/orgs/:orgId/staff-tiers` | `staff.read` |  | Danh sách bậc lương (cả bậc đã ẩn), kèm số thợ đang thuộc mỗi bậc |
| POST | `/orgs/:orgId/staff-tiers` | `staff.write` | Idempotency-Key | Thêm bậc lương; không gửi sortOrder thì xếp cuối. Bắt buộc header Idempotency-Key |
| PATCH | `/orgs/:orgId/staff-tiers/:tierId` | `staff.write` |  | Đổi tên, thứ tự, ẩn/hiện bậc lương |
| GET | `/orgs/:orgId/staff/availability` | `staff.read` |  | Mức rảnh của thợ cho một khung giờ: trùng giờ / có lịch cùng ngày / rảnh, kèm giữ chỗ ở hợp đồng nháp khác |
| GET | `/orgs/:orgId/staff` | `staff.read` |  | Danh sách thợ đang hoạt động kèm hồ sơ; số điện thoại thợ chỉ hiện cho người có staff.write |
| PATCH | `/orgs/:orgId/staff/:membershipId` | `staff.write` |  | Sửa hồ sơ thợ: tên hiển thị, ảnh, số điện thoại, bậc lương (null = bỏ bậc), có nhận lịch không |

**Vai trò** (3 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| GET | `/orgs/:orgId/roles` | `roles.read` |  | Danh sách vai trò của tổ chức |
| POST | `/orgs/:orgId/roles` | `roles.manage` |  | Tạo vai trò tuỳ chỉnh |
| PATCH | `/orgs/:orgId/roles/:roleId` | `roles.manage` |  | Sửa vai trò tuỳ chỉnh |

**Nhật ký** (1 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| GET | `/orgs/:orgId/audit-logs` | `audit.read` |  | Nhật ký thay đổi của tổ chức, mới nhất trước |

**Bảng giá** (23 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| GET | `/orgs/:orgId/service-categories` | `catalog.read` |  | Danh sách danh mục dịch vụ |
| POST | `/orgs/:orgId/service-categories` | `catalog.write` | Idempotency-Key | Tạo danh mục dịch vụ |
| PATCH | `/orgs/:orgId/service-categories/:categoryId` | `catalog.write` |  | Đổi tên, thứ tự, bật/tắt danh mục dịch vụ |
| GET | `/orgs/:orgId/makeup-subjects` | `catalog.read` |  | Danh sách nhân vật makeup (cô dâu, mẹ cô dâu, phù dâu…) |
| POST | `/orgs/:orgId/makeup-subjects` | `catalog.write` | Idempotency-Key | Thêm nhân vật makeup |
| PATCH | `/orgs/:orgId/makeup-subjects/:subjectId` | `catalog.write` |  | Đổi tên, thứ tự, bật/tắt nhân vật makeup |
| GET | `/orgs/:orgId/services` | `catalog.read` |  | Danh sách dịch vụ kèm giá hiện hành |
| POST | `/orgs/:orgId/services` | `catalog.write` | Idempotency-Key | Tạo dịch vụ kèm giá đầu tiên (cần thêm quyền prices.write) |
| GET | `/orgs/:orgId/services/:serviceId` | `catalog.read` |  | Xem một dịch vụ kèm giá hiện hành |
| PATCH | `/orgs/:orgId/services/:serviceId` | `catalog.write` |  | Sửa thông tin dịch vụ (không đổi giá ở đây) |
| GET | `/orgs/:orgId/services/:serviceId/prices` | `catalog.read` |  | Lịch sử giá của dịch vụ, mới nhất trước |
| POST | `/orgs/:orgId/services/:serviceId/prices` | `prices.write` | Idempotency-Key | Đổi giá dịch vụ (thêm phiên bản giá; có thể hẹn ngày áp dụng) |
| GET | `/orgs/:orgId/packages` | `catalog.read` |  | Danh sách gói dịch vụ kèm giá gói và giá dịch vụ phụ |
| POST | `/orgs/:orgId/packages` | `catalog.write` | Idempotency-Key | Tạo gói dịch vụ kèm giá đầu tiên (cần thêm quyền prices.write) |
| GET | `/orgs/:orgId/packages/:packageId` | `catalog.read` |  | Xem một gói dịch vụ kèm giá |
| PATCH | `/orgs/:orgId/packages/:packageId` | `catalog.write` |  | Sửa gói dịch vụ; gửi items là thay toàn bộ danh sách dịch vụ trong gói (không đổi giá ở đây) |
| GET | `/orgs/:orgId/packages/:packageId/prices` | `catalog.read` |  | Lịch sử giá của gói, mới nhất trước |
| POST | `/orgs/:orgId/packages/:packageId/prices` | `prices.write` | Idempotency-Key | Đổi giá gói (thêm phiên bản giá; có thể hẹn ngày áp dụng) |
| GET | `/orgs/:orgId/studio-locations` | `catalog.read` |  | Danh sách studio/cửa hàng (điểm xuất phát tính km) |
| POST | `/orgs/:orgId/studio-locations` | `catalog.write` | Idempotency-Key | Thêm studio/cửa hàng; đặt mặc định thì bỏ mặc định ở studio khác |
| PATCH | `/orgs/:orgId/studio-locations/:locationId` | `catalog.write` |  | Sửa studio/cửa hàng; đặt mặc định thì bỏ mặc định ở studio khác |
| GET | `/orgs/:orgId/travel-fee-policy` | `catalog.read` |  | Cách tính phí di chuyển mặc định của tổ chức |
| PUT | `/orgs/:orgId/travel-fee-policy` | `prices.write` |  | Ghi đè toàn bộ cách tính phí di chuyển và bảng bậc km (gửi đủ mọi trường, kể cả tiers) |

**Khách hàng** (4 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| GET | `/orgs/:orgId/customers` | `customers.read` |  | Danh sách khách hàng, tìm theo tên hoặc số điện thoại |
| POST | `/orgs/:orgId/customers` | `customers.write` | Idempotency-Key | Thêm khách hàng. Bắt buộc header Idempotency-Key |
| GET | `/orgs/:orgId/customers/:customerId` | `customers.read` |  | Xem một khách hàng |
| PATCH | `/orgs/:orgId/customers/:customerId` | `customers.write` |  | Sửa thông tin khách hàng |

**Lịch** (5 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| GET | `/orgs/:orgId/appointments` | `schedule.read_own` |  | Lịch trong khoảng from–to (bắt buộc, tối đa 62 ngày); người chỉ có read_own thấy lịch mình |
| POST | `/orgs/:orgId/appointments` | `schedule.write` | Idempotency-Key | Tạo lịch; kiểm trùng giờ của thợ (cả thời gian di chuyển). Bắt buộc header Idempotency-Key |
| GET | `/orgs/:orgId/appointments/:appointmentId` | `schedule.read_own` |  | Xem một lịch kèm lịch sử trạng thái |
| PATCH | `/orgs/:orgId/appointments/:appointmentId` | `schedule.write` |  | Đổi giờ, thời gian di chuyển, địa điểm, ghi chú, thợ |
| POST | `/orgs/:orgId/appointments/:appointmentId/status` | `schedule.write` |  | Chuyển trạng thái lịch theo bảng chuyển trạng thái; huỷ phải ghi lý do |

**Hợp đồng** (8 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| POST | `/orgs/:orgId/contracts/quote` | `contracts.read` |  | Xem trước bảng tính hợp đồng (không ghi gì) — cùng công thức với lệnh tạo |
| POST | `/orgs/:orgId/contracts` | `contracts.write` | Idempotency-Key | Lập hợp đồng: nhiều gói/dịch vụ, nhân vật, dịch vụ phụ, phụ phí, phí di chuyển |
| GET | `/orgs/:orgId/contracts` | `contracts.read` |  | Danh sách hợp đồng (lọc trạng thái, khách, ngày sự kiện, tìm theo mã/tên/số điện thoại) |
| GET | `/orgs/:orgId/contracts/:contractId` | `contracts.read` |  | Xem hợp đồng: khách, các dòng (dịch vụ phụ, phí di chuyển gom dưới dòng cha), lịch đã gắn |
| PATCH | `/orgs/:orgId/contracts/:contractId` | `contracts.write` |  | Sửa hợp đồng: nháp sửa được mọi thứ (thay toàn bộ dòng); đã xác nhận chỉ sửa ghi chú |
| POST | `/orgs/:orgId/contracts/:contractId/lines` | `contracts.write` | Idempotency-Key | Thêm một dòng (kèm dịch vụ phụ, phí di chuyển); hợp đồng đã xác nhận thì là phụ phí phát sinh |
| POST | `/orgs/:orgId/contracts/:contractId/lines/:lineId/void` | `contracts.write` |  | Huỷ một dòng (kéo theo dịch vụ phụ, phí di chuyển của dòng đó) — không xoá, bắt buộc lý do |
| POST | `/orgs/:orgId/contracts/:contractId/status` | `contracts.write` |  | Đổi trạng thái hợp đồng: nháp → xác nhận/huỷ; xác nhận → hoàn thành/huỷ (huỷ bắt buộc lý do) |

**Tiền công** (4 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| GET | `/orgs/:orgId/packages/:packageId/pay-rates` | `payroll.read` |  | Tiền công theo bậc của một gói: mọi bậc đang hoạt động, thợ thuộc mỗi bậc, số tiền (null = chưa đặt) |
| PUT | `/orgs/:orgId/packages/:packageId/pay-rates` | `payroll.write` |  | Đặt tiền công nhiều bậc cùng lúc cho một gói (amount null = xoá mức); bậc không gửi giữ nguyên |
| GET | `/orgs/:orgId/services/:serviceId/pay-rates` | `payroll.read` |  | Tiền công theo bậc của một dịch vụ: mọi bậc đang hoạt động, thợ thuộc mỗi bậc, số tiền (null = chưa đặt) |
| PUT | `/orgs/:orgId/services/:serviceId/pay-rates` | `payroll.write` |  | Đặt tiền công nhiều bậc cùng lúc cho một dịch vụ (amount null = xoá mức); bậc không gửi giữ nguyên |

**Tệp** (3 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| POST | `/orgs/:orgId/files` | `files.write` | Idempotency-Key | Tải một tệp lên: THÂN là nội dung nhị phân của tệp (không multipart), ?purpose=&name=. Kiểm chữ ký đầu tệp, giới hạn dung lượng theo mục đích. Bắt buộc header Idempotency-Key |
| GET | `/orgs/:orgId/files/:fileId` | `files.read` |  | Thông tin tệp kèm URL đọc có hạn 10 phút |
| DELETE | `/orgs/:orgId/files/:fileId` | `files.write` |  | Xoá tệp (xoá mềm: đánh dấu DELETED, URL cũ thôi đọc được; xoá vật lý làm sau) |

**Quản trị nền tảng** (8 đường)

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| GET | `/platform/organizations` | quản trị nền tảng |  | Danh sách tổ chức thuê (lọc trạng thái, gói, sắp hết hạn, tìm theo tên/đường dẫn/email chủ) |
| GET | `/platform/organizations/:organizationId` | quản trị nền tảng |  | Chi tiết tổ chức: chủ, thuê bao hiện hành, mức dùng so với giới hạn, lịch sử thuê bao |
| POST | `/platform/organizations/:organizationId/subscriptions` | quản trị nền tảng |  | Đổi gói / gia hạn: thêm một dòng thuê bao mới (dòng cũ giữ nguyên làm lịch sử) |
| PATCH | `/platform/organizations/:organizationId` | quản trị nền tảng |  | Tạm khoá / mở khoá tổ chức (dữ liệu giữ nguyên) |
| GET | `/platform/plans` | quản trị nền tảng |  | Danh sách gói thuê bao và giới hạn (null = không giới hạn) |
| POST | `/platform/plans` | quản trị nền tảng |  | Tạo gói thuê bao |
| PATCH | `/platform/plans/:planId` | quản trị nền tảng |  | Sửa gói (mã gói không đổi được). Đổi giá áp cho mọi thuê bao đang dùng gói này. |
| GET | `/platform/stats` | quản trị nền tảng |  | Thống kê: tổ chức theo trạng thái, sắp hết hạn 30 ngày, doanh thu thuê bao DỰ KIẾN theo tháng |

### 8. Đường đang dựng — chưa lưu vào kho
Lúc ≈16:55 UTC, bản đang sửa trên máy có thêm 11 đường (tổng 88). Chưa nghiệm thu, có thể còn đổi:

| Method | Đường | Quyền | Mô tả |
|---|---|---|---|
| GET | `/orgs/:orgId/contracts/:contractId/payments` | `payments.read` | Tình hình thu tiền của hợp đồng: tiến độ, phiếu thu/hoàn, cọc – đã thu – còn lại |
| PUT | `/orgs/:orgId/contracts/:contractId/installments` | `payments.write` | Thay toàn bộ tiến độ thanh toán (tổng các đợt = tổng hợp đồng, tối đa 1 đợt cọc) |
| POST | `/orgs/:orgId/contracts/:contractId/payments` | `payments.write` (+ Idempotency-Key) | Ghi phiếu thu; phiếu hoàn cần quyền huỷ phiếu |
| POST | `/orgs/:orgId/payments/:paymentId/void` | `payments.void` | Huỷ phiếu, bắt buộc lý do, một lần |
| GET | `/orgs/:orgId/payments` | `payments.read` | Sổ thu theo kỳ |
| GET | `/orgs/:orgId/reports/revenue` | `reports.read` | Doanh số, cọc phải thu, đã thu, còn lại theo kỳ |
| GET | `/orgs/:orgId/profile` | `org.read` | Hồ sơ thương hiệu |
| PUT | `/orgs/:orgId/profile` | `org.update` | Ghi toàn bộ hồ sơ thương hiệu |
| POST | `/orgs/:orgId/profile/publish` | `org.update` | Xuất bản trang giới thiệu |
| POST | `/orgs/:orgId/profile/unpublish` | `org.update` | Gỡ trang giới thiệu |
| GET | `/public/sites/:slug` | — (công khai) | Dữ liệu trang giới thiệu đã xuất bản: hồ sơ, dịch vụ/gói công khai kèm giá |
