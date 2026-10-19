# Quy ước API — Makeup Pro

Cập nhật: 19/10/2026 (bổ sung mục 9 — bản vẽ D: Hôm nay, Loại sự kiện, Luật phụ phí; các mục 1–8 vẫn là hiện trạng 18/10, chưa rà lại — đường của đào tạo, cổng học viên… ra sau đó chưa được liệt kê ở mục 7; lệnh dưới in số đường hiện hành: 125 đường ngày 19/10). **Mục 1–8 đã đối chiếu với commit `634d6a3`** (17:00 UTC; mã giống hệt `bc9633a`, hai commit sau chỉ thêm sổ ghi). Danh sách đường ở mục 7 sinh thẳng từ bảng đường của máy chủ bằng lệnh:

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
| Người xem thiếu quyền cho một khối thì trường đó là `null`, không phải mảng rỗng | Mảng rỗng nói "không có gì" — báo sai khi thật ra người đó không được xem (ví dụ trang Hôm nay, mục 9.3) |

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

### 9. Bản vẽ D (19/10/2026): trang Hôm nay, Loại sự kiện, Luật phụ phí — 8 đường mới
Ghi **đúng như mã đã chạy** (bản vẽ: `docs/rnd/BAN-VE-D-HOM-NAY-SU-KIEN-PHU-PHI.md`; ký duyệt: `docs/rnd/KY-DUYET-D.md`; quyết định thay anh Chiến: `docs/NHAT-KY-QUYET-DINH-THAY.md`, hai dòng "19/10 tối"). Chỗ mã khác bản vẽ được đánh dấu **"khác bản vẽ"**; tổng hợp ở mục 9.7. Các đường này thêm vào danh sách ở mục 7 (đường tổ chức, đều qua cửa gác — mục 9.8).

**Từ cần biết (giải thích một lần):**
| Từ | Nghĩa |
|---|---|
| Loại sự kiện | Nhãn studio tự đặt cho một ca làm (ăn hỏi, lễ vu quy, lễ cưới, tiệc…) kèm một màu trong 12 màu của Lịch. Gắn ở **dòng** hợp đồng, không gắn ở cả hợp đồng |
| Dòng đặt chỗ | Dòng hợp đồng loại `PACKAGE` hoặc `SERVICE` — dòng có giờ, nơi làm, thợ |
| Luật phụ phí | Quy tắc studio cài: "ca bắt đầu trước 6:00 / rơi vào Chủ nhật / là lễ cưới thì cộng phụ phí X". Khớp thì **máy chủ** tự thêm một dòng phụ phí vào hợp đồng; web không tự tính tiền |
| Dòng tự thêm | Dòng `SURCHARGE` do luật sinh ra, là **dòng con** của dòng đặt chỗ (giống dịch vụ phụ, phí di chuyển). Người lập hợp đồng nháp bỏ hoặc sửa được |
| Bản chụp | Tên loại sự kiện / tên luật được chép vào dòng hợp đồng lúc lưu. Đổi tên sau đó không đổi hợp đồng đã lưu |
| Ghi đè | Người lập sửa số lượng, giá hoặc ghi chú của một dòng tự thêm. Ghi đè **giá** bắt buộc kèm ghi chú lý do |

| Method | Đường (sau `/api/v1`) | Quyền | Ghi chú | Mô tả |
|---|---|---|---|---|
| GET | `/orgs/:orgId/occasions` | `catalog.read` |  | Danh sách loại sự kiện kèm số dòng hợp đồng đang dùng |
| POST | `/orgs/:orgId/occasions` | `catalog.write` | Idempotency-Key | Thêm loại sự kiện |
| PATCH | `/orgs/:orgId/occasions/:occasionId` | `catalog.write` |  | Đổi tên, màu, thứ tự, ẩn/hiện (không đổi dòng hợp đồng đã lưu) |
| PUT | `/orgs/:orgId/occasions/order` | `catalog.write` |  | Đổi thứ tự: gửi đủ mọi loại của tổ chức, mỗi loại một lần |
| GET | `/orgs/:orgId/surcharge-rules` | `catalog.read` |  | Danh sách luật phụ phí kèm phụ phí, giá hiện hành, tình trạng, số dòng đang dùng |
| POST | `/orgs/:orgId/surcharge-rules` | `prices.write` | Idempotency-Key | Thêm luật phụ phí |
| PATCH | `/orgs/:orgId/surcharge-rules/:surchargeRuleId` | `prices.write` |  | Sửa / bật / tắt luật |
| GET | `/orgs/:orgId/today` | `org.read` |  | Trang Hôm nay: từng thẻ theo quyền người xem |

Hai đường `POST` trên có thêm cờ chống gửi trùng (`Idempotency-Key`, mục 5): số "13 đường" ở mục 5 là hiện trạng 18/10, chưa cộng hai đường này và các đường ra sau. Không đường nào trong tám đường thêm **quyền mới**: không cần `db:sync-roles` cho quyền. Lệnh in danh sách ở đầu tệp, ngày 19/10, cho đúng 8 dòng trên (`occasions` 4, `surcharge-rules` 3, `today` 1).

#### 9.1 Loại sự kiện (`apps/api/src/modules/catalog/occasions.ts`, nhóm "Bảng giá")

| Đường | Thân / query | Phản hồi | Lỗi (mã · lời tiếng Việt) |
|---|---|---|---|
| `GET …/occasions` | query `isActive=true\|false` (tuỳ chọn) | 200 `{ items: OccasionView[] }`, sắp `sortOrder`, `name`, `id` | chỉ lỗi chung (mục 3) |
| `POST …/occasions` | `{ name, color, sortOrder?, isActive? }` — `name` 1–60 ký tự sau khi cắt khoảng trắng; `color` ∈ 12 tên màu; `sortOrder` 0–1.000.000; không gửi `sortOrder` thì database đặt 0 | 201 `OccasionView` (`lineCount: 0`) | 400 `VALIDATION_FAILED` "Dữ liệu gửi lên không hợp lệ" + ô lỗi: "Tên không được để trống", "Màu phải là một trong 12 màu của Lịch", "Không nhận trường: …"; 400 thiếu `Idempotency-Key`; 409 `CONFLICT` "Tên loại sự kiện đã có trong tổ chức"; 409 "Tối đa 50 loại sự kiện" |
| `PATCH …/occasions/:occasionId` | `{ name?, color?, sortOrder?, isActive? }` — ít nhất một trường; không trường nào có giá trị mặc định (gửi gì sửa nấy) | 200 `OccasionView` | 400 "Không có gì để sửa" (thân rỗng); 404 `NOT_FOUND` "Không tìm thấy loại sự kiện" (mã của tổ chức khác = mã bịa); 409 "Tên loại sự kiện đã có trong tổ chức" |
| `PUT …/occasions/order` | `{ occasionIds: uuid[] }`, 1–50 phần tử; thứ tự = vị trí trong mảng | 200 `{ items: OccasionView[] }` theo thứ tự mới | 400 `VALIDATION_FAILED` "Danh sách phải gồm đủ mọi loại sự kiện của tổ chức, mỗi loại một lần" — **cùng một lời** cho mã trùng, thiếu, thừa, mã bịa, mã của tổ chức khác |

- Màu là một trong 12 tên: `rose`, `violet`, `amber`, `green`, `blue`, `taupe`, `brick`, `petrol`, `olive`, `plum`, `forest`, `brown` (`packages/shared/src/occasions.ts`; database cũng chặn — xem `DATABASE_SCHEMA.md` mục 6).
- `OccasionView` = `{ id, name, color, sortOrder, isActive, createdAt, updatedAt, lineCount }`. `lineCount` = số dòng hợp đồng **chưa huỷ** đang dùng loại này (một câu đếm gộp cho cả trang).
- **Không có đường xoá** (dòng hợp đồng trỏ về loại). Ẩn = `isActive: false`: không chọn được cho dòng mới, dòng cũ giữ nguyên.
- `POST` và `PUT …/order` chạy dưới khoá dòng tổ chức, nên hai lần thêm cùng lúc không vượt trần 50 và hai lần đổi thứ tự không đè nhau.
- Nhật ký (`entityType: 'occasion'`): `occasion.created` (data = thân), `occasion.updated` (`{ before, after }`), `occasion.reordered` (`{ before: id[], after: id[] }`).
- **Cài sẵn 6 loại** (Ăn hỏi, Lễ vu quy, Lễ cưới, Tiệc, Pre-wedding, Kỷ yếu): chép vào tổ chức mới trong cùng giao dịch tạo tổ chức (`modules/orgs/routes.ts:133`); với tổ chức cũ chạy `db:sync-roles` (`scripts/sync-system-roles.ts:67`) — chỉ khi tổ chức chưa có loại nào, để không thêm lại loại chủ đã đổi tên hoặc ẩn.

#### 9.2 Luật phụ phí (`apps/api/src/modules/catalog/surcharge-rules.ts`, nhóm "Bảng giá")
Cài luật là **đụng tiền** nên ghi cần `prices.write` (Chủ, Quản trị, Quản lý — ký duyệt D câu 4); xem cần `catalog.read`. Không có đường xoá (dòng hợp đồng trỏ về luật): tắt bằng `isActive: false`. Sửa hoặc tắt luật **không** đổi hợp đồng đã lưu; hợp đồng nháp nhận luật mới ở lần lưu dòng kế tiếp.

**Thân tạo** (`POST`; tên trường theo mã):
| Trường | Kiểu | Ghi chú |
|---|---|---|
| `name` | chuỗi 1–120, bắt buộc | "Tên luật không được để trống" |
| `serviceId` | uuid, bắt buộc | Dịch vụ loại **phụ phí** sẽ được thêm vào hợp đồng; giá lấy từ bảng giá hiện hành |
| `startTime`, `endTime` | `"HH:MM"` hoặc vắng | Khung giờ **bắt đầu** của dòng (theo múi giờ tổ chức): có cả hai hoặc không có cả hai. Khung **nửa mở** `[bắt đầu, kết thúc)` — luật "trước 6:00" ghi `00:00`–`06:00`, ca bắt đầu đúng 06:00 **không** bị tính. Bắt đầu lớn hơn kết thúc = qua nửa đêm (`22:00`–`04:00`). **Nửa đêm ở giờ kết thúc ghi `24:00`; `00:00` bị chặn** (mục 9.7). PATCH gửi `null` cả hai để bỏ khung |
| `weekdays` | mảng số 1–7, tối đa 7 | 1 = Thứ Hai … 7 = Chủ nhật. Rỗng = không xét thứ |
| `dates` | mảng `"YYYY-MM-DD"`, tối đa 366 | Ngày cụ thể / ngày lễ. Thứ trong tuần và ngày cụ thể nối bằng **HOẶC** (ví dụ "Thứ Bảy, Chủ nhật hoặc 01/01") |
| `occasionIds`, `packageIds`, `subjectIds` | mảng uuid, tối đa 50 / 100 / 50 | Loại sự kiện / gói / nhân vật mà dòng phải thuộc về. Điều kiện đã điền nối bằng **VÀ** |
| `perQuantity` | boolean, mặc định (ở database) `true` | `true`: số lượng dòng tự thêm = số lượng dòng đặt chỗ (phù dâu × 2 → phụ phí × 2 — ký duyệt D câu 5); `false`: luôn 1 |
| `note` | chuỗi ≤ 500 hoặc `null` | |
| `sortOrder`, `isActive` | số ≥ 0; boolean | Thứ tự ưu tiên khi hai luật cùng phụ phí; `isActive` mặc định `true` |

Hình dạng được kiểm cả khi tạo lẫn khi sửa (PATCH **ghép** bản đang lưu với thân rồi kiểm lại, nên bỏ khung giờ khi luật không còn điều kiện nào khác cũng bị 400). Lỗi 400 `VALIDATION_FAILED` "Dữ liệu gửi lên không hợp lệ" kèm `details.issues[].path`:
| Ô (`path`) | Lời |
|---|---|
| `endTime` | "Nhập cả giờ bắt đầu và giờ kết thúc của khung"; "Giờ bắt đầu và kết thúc phải khác nhau"; "Giờ kết thúc từ 00:01 đến 24:00 — nửa đêm ghi 24:00" |
| `startTime` | "Giờ bắt đầu từ 00:00 đến 23:59"; "Luật phải có ít nhất một điều kiện: khung giờ, ngày hoặc loại sự kiện" |
| `weekdays`, `dates`, `occasionIds`, `packageIds`, `subjectIds` | "Có giá trị bị chọn trùng" |
| ô `HH:MM` / ngày | "Giờ theo dạng HH:MM, ví dụ 05:30"; "Ngày theo dạng YYYY-MM-DD" |
Luật phải có **ít nhất một điều kiện kích hoạt** (khung giờ, thứ, ngày cụ thể hoặc loại sự kiện). Chỉ chọn gói hoặc nhân vật thì không phải phụ phí mà là giá, nên bị chặn.

| Đường | Phản hồi | Lỗi nghiệp vụ, theo thứ tự máy chủ kiểm |
|---|---|---|
| `GET …/surcharge-rules` (query `isActive`) | 200 `{ items: SurchargeRuleView[] }`, sắp `sortOrder`, `name`, `id` | chỉ lỗi chung |
| `POST …/surcharge-rules` | 201 `SurchargeRuleView` | 404 "Không tìm thấy dịch vụ"; 400 `Dịch vụ "X" là dịch vụ chính — luật chỉ nhận phụ phí` (hoặc "dịch vụ phụ"); 400 `Phụ phí "X" đang ngừng hoạt động`; 404 "Không tìm thấy loại sự kiện" / "Không tìm thấy gói dịch vụ" / "Không tìm thấy nhân vật makeup" (mã bịa và mã của tổ chức khác **cùng một lời**; loại sự kiện đang ẩn vẫn nhận); 409 "Tối đa 50 luật đang bật"; 409 "Tên luật đã có trong tổ chức" |
| `PATCH …/surcharge-rules/:surchargeRuleId` | 200 `SurchargeRuleView` | 404 "Không tìm thấy luật phụ phí" trước hết; rồi 400 hình dạng trên bản ghép; rồi như POST (chỉ kiểm phần tham chiếu có trong thân; trần 50 chỉ kiểm khi gửi `isActive: true`) |

- Mảng gửi lên **thay toàn bộ** mảng cũ; không gửi = giữ nguyên. Tạo luật **không** bắt buộc dịch vụ đã có giá (đặt giá sau được); lúc đó luật hiện tình trạng `NO_PRICE` và chưa sinh dòng nào.
- `SurchargeRuleView`:
```ts
{
  id, name, serviceId,
  startTime: string | null, endTime: string | null,        // "HH:MM"; nửa đêm kết thúc hiện "24:00"
  weekdays: number[], dates: string[],                    // dates "YYYY-MM-DD" tăng dần
  occasionIds: string[], packageIds: string[], subjectIds: string[],  // sắp theo mã cho ổn định
  perQuantity: boolean, note: string | null, sortOrder: number, isActive: boolean,
  service: { id, name, kind, isActive, currentPrice: Vnd | null },    // currentPrice = giá hiện hành, null = chưa có giá
  status: 'OK' | 'SERVICE_INACTIVE' | 'SERVICE_NOT_SURCHARGE' | 'NO_PRICE',
  usedLineCount: number,                                  // số dòng tự thêm CHƯA HUỶ đang trỏ về luật
  createdAt, updatedAt,
}
```
- `status` là **vì sao luật đang không chạy**, tính lúc đọc (dịch vụ có thể bị đổi loại, ngừng hoặc chưa có giá sau khi lưu luật), kiểm theo thứ tự: dịch vụ ngừng → `SERVICE_INACTIVE`; không còn là phụ phí → `SERVICE_NOT_SURCHARGE`; chưa có giá → `NO_PRICE`; còn lại `OK`.
- Giá hiện hành của mọi dịch vụ trong trang lấy bằng một câu, số dòng đang dùng bằng một câu đếm gộp — không N+1.
- Nhật ký (`entityType: 'surcharge_rule'`): `surcharge_rule.created` và `surcharge_rule.updated` với `{ before, after }` gồm cả các mảng điều kiện.
- Giới hạn: mỗi tổ chức tối đa **50 luật đang bật** (không giới hạn số luật đã tắt).

#### 9.3 Trang Hôm nay (`apps/api/src/modules/today/`, nhóm "Hôm nay")
`GET /orgs/:orgId/today` — quyền vào: `org.read` (mọi vai trò); **từng thẻ** theo quyền riêng. Không có thân, không query. Chỉ đọc: không ghi nhật ký, không `Idempotency-Key`. Lỗi: chỉ lỗi chung (401, 403 thiếu quyền hoặc tổ chức bị khoá, 404). Số câu truy vấn không tăng theo số hợp đồng hay số ca.

Mốc thời gian lấy **một lần** mỗi yêu cầu, theo múi giờ của tổ chức (`organizations.timezone`): *Hôm nay* = từ 0:00 hôm nay đến 0:00 ngày mai; *Ngày mai* = ngày kế; *Sau đó* = từ ngày kia đến hết ngày thứ 7 kể từ hôm nay; "7 ngày tới" của tiền = hạn trước 0:00 của ngày thứ 8; "24 giờ qua" = từ `now − 24 giờ`.

| Trường | Ai thấy (thiếu → `null`) | Lấy gì | Trần |
|---|---|---|---|
| `appointments.today/tomorrow/later`, `counts.appointmentsToday/Tomorrow`, `scheduleScope` | có `schedule.read_all` (mọi ca, `scheduleScope: 'ALL'`) hoặc `schedule.read_own` (chỉ ca có mình, `'OWN'` — dùng đúng hàm lọc của Lịch). **Không có cả hai → cả bốn trường là `null`** | Ca không ở trạng thái huỷ / không đến, mọi loại ca (kể cả buổi học) | 200 mỗi danh sách; `appointments.truncated` = true khi có danh sách bị cắt. Hai số đếm là số **thật** trên toàn bộ |
| `unassigned`, `counts.unassignedSoon` | `schedule.read_all` | Ca makeup chờ xác nhận / đã xác nhận, bắt đầu từ lúc này đến hết 7 ngày tới, **chưa có thợ nào** | 50; số đếm là số thật |
| `installments.overdue/dueSoon`, `counts.overdue/dueSoon` | `payments.read` | Đợt thu của hợp đồng đã xác nhận / hoàn thành; trạng thái từng đợt tính bằng đúng hai hàm của màn Thu tiền (`summarizePayments` + `allocateToInstallments`). `overdue` = quá hạn; `dueSoon` = đến hạn hoặc thu một phần, hạn trong 7 ngày tới. `counts.*` = `{ count, amount }` (tổng còn thiếu) trên **toàn bộ** các đợt đếm được | 50 mỗi danh sách; xét tối đa 500 hợp đồng (sắp theo hạn sớm nhất), vượt thì `installments.truncated = true` |
| `newContracts` | `contracts.read` | Hợp đồng xác nhận trong 24 giờ qua, mới nhất trước; `confirmedBy` lấy từ nhật ký `contract.status_changed` (`null` nếu không tìm thấy) | 20 |
| `newEnrollments` | `courses.read` **và** tổ chức loại `ACADEMY` | Ghi danh đang hiệu lực trong 24 giờ qua | 20 |
| `almostFullClasses` | `courses.read` **và** `ACADEMY` | Lớp đang mở, chưa kết thúc, mức chỗ `ALMOST_FULL` (quyết bằng đúng `seatState` của mã dùng chung với web), sắp theo ngày khai giảng | 20 |

Có quyền mà không có gì → mảng rỗng (hoặc `{ count: 0, amount: 0 }`); thiếu quyền → `null`. Số điện thoại khách ở đợt thu chỉ hiện khi người xem có `customers.read` (quyền thu tiền không kéo theo quyền xem liên lạc): không có thì `phone: null, phoneHidden: true`.

```ts
interface TodayView {
  generatedAt: string; timezone: string; today: string; tomorrow: string;          // ngày "YYYY-MM-DD"
  scheduleScope: 'ALL' | 'OWN' | null;
  counts: {
    appointmentsToday: number | null; appointmentsTomorrow: number | null; unassignedSoon: number | null;
    overdue: { count: number; amount: Vnd } | null; dueSoon: { count: number; amount: Vnd } | null;
  };
  appointments: { today: TodayAppointment[]; tomorrow: TodayAppointment[]; later: TodayAppointment[]; truncated: boolean } | null;
  unassigned: TodayAppointment[] | null;
  installments: { overdue: TodayInstallment[]; dueSoon: TodayInstallment[]; truncated: boolean } | null;
  newContracts: TodayContract[] | null;
  newEnrollments: TodayEnrollment[] | null;
  almostFullClasses: TodayClass[] | null;
}
interface TodayAppointment {
  id; code; kind; status; title: string | null; startsAt: string; endsAt: string; travelBeforeMin: number;   // thời điểm ISO
  customer: { id; fullName } | null; subjectName: string | null; quantity: number | null;
  occasion: { id; name; color } | null; locationType; address: string | null;
  contract: { id; code } | null; courseClass: { id; name; courseId } | null;
  staff: { membershipId; displayName; role: 'PRIMARY' | 'ASSIST' }[];
}
interface TodayInstallment {
  installmentId; name; dueDate: string /* thời điểm ISO */; amount: Vnd; outstanding: Vnd;
  status: 'OVERDUE' | 'DUE' | 'PARTIAL'; overdueDays: number /* ngày lịch theo múi giờ tổ chức; 0 khi chưa quá hạn */; isDeposit: boolean;
  contract: { id; code; eventDate: string | null }; customer: { id; fullName; phone: string | null; phoneHidden: boolean };
  owner: { membershipId; displayName } | null;
}
interface TodayContract { id; code; kind: 'SERVICE' | 'COURSE'; customerName; total: Vnd; eventDate: string | null; confirmedAt: string; confirmedBy: { userId; fullName } | null }
interface TodayEnrollment { id; enrolledAt: string; customer: { id; fullName }; courseClass: { id; name }; course: { id; name }; enrolledCount: number; capacity: number }
interface TodayClass { id; name; course: { id; name }; startDate: string /* YYYY-MM-DD */; enrolledCount: number; capacity: number; seatsLeft: number }
```
Tiền là số nguyên đồng đọc từ `BigInt` qua `vndFromBigInt`, cộng bằng số nguyên. Hàm gom (`today/collect.ts`) nhận `db` + ngữ cảnh nên dùng lại được cho các màn khác (bản tin trong app, hàng đợi Thu tiền).

#### 9.4 Hợp đồng: trường mới và phụ phí tự động (`apps/api/src/modules/contracts/`)
**Thân dòng** — thêm 3 trường **tuỳ chọn** vào dòng đặt chỗ (`PACKAGE`, `SERVICE`; `schemas.ts`, mọi đường nhận dòng: xem trước, tạo, sửa nháp, thêm dòng):

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `placement.occasionId` | uuid | Loại sự kiện của dòng. Lưu kèm **bản chụp tên** (`occasionName`) |
| `surchargeOverrides` | mảng ≤ 20 của `{ ruleId, quantity?, unitPrice?, note? }` | Người lập sửa dòng tự thêm của luật `ruleId`: số lượng 1–1000, giá (số nguyên đồng, ≤ trần tiền), ghi chú. **Có `unitPrice` thì bắt buộc có `note`** ("Ghi đè giá phụ phí phải kèm ghi chú lý do", ô `note`). Không gửi = theo luật + bảng giá |
| `dismissedRuleIds` | mảng uuid ≤ 50 | Luật người lập **đã bỏ** ở dòng này: không tự thêm lại — kể cả khi sau đó đổi giờ đi rồi đổi lại |

Mọi lỗi dưới đây trả `details.line` = vị trí dòng trong mảng gửi lên. Máy chủ kiểm theo thứ tự: nhân vật → **mã luật** → **loại sự kiện** → địa điểm/phí di chuyển → …

| Tình huống | Mã · lời |
|---|---|
| `ruleId` / `dismissedRuleIds` không phải luật của tổ chức (mã bịa **hoặc** mã của tổ chức khác; luật đang tắt vẫn được) | 404 `NOT_FOUND` "Không tìm thấy luật phụ phí" — **cùng một lời**. Mảng `dismissedRuleIds` không có khoá ngoại ở database nên đây là chốt **duy nhất** |
| Một luật vừa ở `dismissedRuleIds` vừa ở `surchargeOverrides` | 400 `Luật "X" vừa bị bỏ vừa được sửa ở cùng một dòng` |
| Một luật xuất hiện hai lần trong `surchargeOverrides` | 400 `Luật "X" được sửa hai lần ở cùng một dòng` |
| `occasionId` không phải loại của tổ chức | 404 "Không tìm thấy loại sự kiện" |
| Loại sự kiện đang ẩn | 400 `Loại sự kiện "X" đang ẩn` |
| Thành tiền dòng tự thêm hoặc tổng vượt trần 100 tỷ đồng | 400, lời của trần tiền hiện có (có tên dòng) |

**Luật chạy thế nào** (`contracts/autoSurcharge.ts`, gọi từ `planPlaced` trong `sheet.ts`; hàm thuần ở `packages/shared/src/surcharges.ts`): với **mỗi dòng đặt chỗ**, sau dòng chính, dịch vụ phụ, phí di chuyển:
1. Lấy "sự thật" của dòng: ngày và phút bắt đầu của `scheduledStart` theo múi giờ tổ chức; dòng chưa có giờ thì ngày = ngày sự kiện của hợp đồng (nếu có) và phút = không biết (khung giờ **không** khớp); cùng loại sự kiện, gói, nhân vật của dòng.
2. Luật đang bật khớp khi **mọi** điều kiện đã điền đều đúng (khung giờ; thứ **hoặc** ngày cụ thể; loại sự kiện; gói; nhân vật). Dòng dịch vụ lẻ không có gói thì không khớp luật có điều kiện gói; dòng chưa chọn sự kiện không khớp luật có điều kiện sự kiện. Luật không có điều kiện kích hoạt nào không bao giờ khớp.
3. Luật trong `dismissedRuleIds` bị loại trước, **không che** luật khác. Còn lại: nhiều luật khớp **khác phụ phí** thì cộng dồn, mỗi luật một dòng; nhiều luật khớp **cùng phụ phí** thì chỉ luật đứng đầu (`sortOrder` nhỏ, rồi tên, rồi mã) sinh dòng.
4. Mỗi luật được giữ: phụ phí đã đổi loại / ngừng → bỏ qua (`SERVICE_UNAVAILABLE`); hợp đồng đã có **dòng phụ phí nhập tay** cùng phụ phí → bỏ qua (`MANUAL_LINE_EXISTS`, tránh thu hai lần); giá = giá ghi đè nếu có, không thì giá hiện hành, **chưa có giá → bỏ qua** (`NO_PRICE`, khác dòng nhập tay vốn báo 400); số lượng = số đã sửa, không thì `perQuantity ? số lượng dòng đặt chỗ : 1`; thành tiền = giá × số lượng (số nguyên, không làm tròn, không phần trăm). Dòng sinh ra: `kind SURCHARGE`, là dòng con, kèm `surchargeRuleId` + `surchargeRuleName` (bản chụp). Ghi đè giá → dòng không trỏ về bản giá (`priceVersionId = null`).
5. Phần sửa (`surchargeOverrides`) của luật không còn được áp (hết khớp, luật đã tắt, bị che) thì **bỏ phần sửa** và báo trong `removed`.
6. `dismissedRuleIds` đã khử trùng được lưu vào dòng chính (giữ cả luật hiện không khớp). Thứ tự dòng con: dịch vụ phụ → phí di chuyển → dòng tự thêm theo thứ tự luật.

| Thao tác | Luật chạy? |
|---|---|
| `POST /contracts/quote` | Có, không ghi gì; trả `autoSurcharge` |
| `POST /contracts` | Có |
| `PATCH /contracts/:id` có `lines` (hợp đồng nháp) | Có, cho **mọi** dòng. Hợp đồng nháp lập trước khi có luật sẽ được thêm phụ phí ở lần lưu dòng này — chủ đích (ký duyệt D câu 6), web báo rõ dòng nào tự thêm |
| `PATCH` không có `lines` (chỉ ghi chú, giảm giá…) | Không — dòng giữ nguyên |
| `POST /contracts/:id/lines` (nháp, hoặc phát sinh sau xác nhận) | Có, cho dòng mới; phụ phí nhập tay sẵn có của hợp đồng được tính vào bước "tránh thu hai lần" |
| Xác nhận / hoàn thành / huỷ hợp đồng | **Không bao giờ** tính lại (dòng đã khoá bằng trigger) |
| Sửa / tắt luật, đổi giá phụ phí | Không chạm hợp đồng đã lưu |

Sau khi xác nhận không sửa được dòng tự thêm; huỷ nó như mọi dòng (`…/lines/:lineId/void`, bắt buộc lý do, cần `contracts.adjust`). Huỷ dòng đặt chỗ kéo theo huỷ các dòng tự thêm của nó. Mỗi dòng đặt chỗ có tối đa **một** dòng tự thêm chưa huỷ cho mỗi luật (database chặn — `DATABASE_SCHEMA.md` mục 6).

**Phản hồi:**
- `LineView` (dòng trong chi tiết hợp đồng và trong bảng tính) thêm 5 trường: `occasionId: string | null`, `occasionName: string | null`, `surchargeRuleId: string | null`, `surchargeRuleName: string | null`, `dismissedRuleIds: string[]` (dòng không phải đặt chỗ → `[]`). Dòng nhập tay và mọi dòng cũ: các trường `null`.
- `GroupedLine` (dòng đặt chỗ kèm dòng con) thêm `surcharges: LineView[]` — dòng con loại `SURCHARGE`. Phân nhóm: `SURCHARGE` → `surcharges`, `TRAVEL` → `travel`, còn lại → `addons`. (Dòng phụ phí nhập tay vẫn là dòng gốc, không nằm trong `surcharges`.)
- **Chỉ** `POST /contracts/quote` trả thêm `autoSurcharge`; tạo / sửa / thêm dòng trả chi tiết hợp đồng như cũ (đã có dòng con). `line` = vị trí dòng đặt chỗ trong mảng gửi lên:
```ts
autoSurcharge: {
  applied: { line: number; ruleId: string; ruleName: string; serviceName: string; quantity: number; lineTotal: Vnd; overridden: boolean }[];
  removed: { line: number; ruleId: string; ruleName: string; reason: 'NO_LONGER_MATCHES' | 'RULE_INACTIVE' | 'SAME_SERVICE' }[];
  skipped: { line: number; ruleId: string; ruleName: string; reason: 'SERVICE_UNAVAILABLE' | 'MANUAL_LINE_EXISTS' | 'NO_PRICE' | 'SAME_SERVICE'; by?: string }[];  // by = tên luật thắng (SAME_SERVICE)
}
```
- Nhật ký: `contract.created`, `contract.updated` (khi có `lines`), `contract.line_added` thêm `autoSurcharges: [{ lineId, parentLineId, ruleId, amount }]`.

#### 9.5 Lịch: màu theo sự kiện (`apps/api/src/modules/schedule/service.ts`)
Mọi phản hồi trả ca (`GET /appointments`, `GET /appointments/:id`, tạo, sửa, đổi trạng thái) thêm trường:
`occasion: { id, name, color } | null` — `name` = **bản chụp** trên dòng hợp đồng, `color` = màu **hiện tại** của loại (đổi màu loại thì Lịch đổi theo; đổi tên loại không đổi tên đã chụp). `null` khi ca không gắn dòng hợp đồng hoặc dòng chưa chọn sự kiện. Ca lẻ tạo trên Lịch (không hợp đồng) **chưa chọn được** sự kiện. Không có cột mới ở bảng lịch; quan hệ đi qua khoá ngoại kép nên chỉ đọc được loại của chính tổ chức. Cùng dạng `occasion` có ở `TodayAppointment` (mục 9.3).

#### 9.6 Các quyết định đã chốt (ký duyệt D + nhật ký 19/10 tối)
| Việc | Chốt |
|---|---|
| Giờ kết thúc của luật | Nửa đêm ghi **`24:00`**; **`00:00` bị chặn** (khớp CHECK phút 1–1440 của database). Web lo cách nhập "đến hết ngày" |
| Thứ tự `status` của luật | Dịch vụ ngừng → không phải dịch vụ phụ phí → chưa có giá → dùng được |
| Danh sách điều kiện của luật trả ra | Sắp theo mã (`occasionIds`, `packageIds`, `subjectIds`) cho ổn định giữa các lần gọi |
| Vai trò tuỳ chỉnh không có quyền xem lịch ở `/today` | Trường lịch là **`null`** (không phải mảng rỗng — mảng rỗng báo sai "không có ca"); web hiện ô đó là không có quyền, không hiện số 0. 7 vai trò mẫu không đổi |
| Ai cài luật | Người có quyền đổi giá (`prices.write`): Chủ, Quản trị, Quản lý |
| Phụ phí theo người | Theo số lượng dòng (phù dâu × 2 → phụ phí × 2) |
| Hợp đồng nháp cũ | Lưu lại thì luật tự thêm; có báo rõ dòng nào tự thêm; người lập bỏ được |

#### 9.7 Chỗ mã khác bản vẽ D (mã là đúng)
| Chỗ | Bản vẽ | Mã đã chạy |
|---|---|---|
| Giờ kết thúc luật | Chỉ nói chuỗi `HH:MM` hoặc `24:00` | Chặn thêm `00:00` ở giờ kết thúc, lời "Giờ kết thúc từ 00:01 đến 24:00 — nửa đêm ghi 24:00" (nhật ký thay, dòng "Luật phụ phí (gói M3)") |
| `/today` khi thiếu quyền xem lịch | `scheduleScope: 'ALL' \| 'OWN'`, hai số đếm ca là số | `scheduleScope`, `counts.appointmentsToday/Tomorrow` và `appointments` đều có thể là `null` (nhật ký thay, dòng "Trang Hôm nay (gói M6)") |
| Thứ tự `status`, thứ tự danh sách điều kiện | Bỏ ngỏ | Như mục 9.6 |
| Luật bị người lập bỏ có che luật cùng phụ phí không | Không nói | **Không che**: luật bị bỏ loại ra trước khi khử trùng, luật cùng phụ phí khớp thì được áp |
| Luật không có điều kiện kích hoạt | Chỉ chặn lúc lưu | Chặn lúc lưu **và** lúc tính (không bao giờ khớp dòng nào, để không tự cộng tiền vào mọi dòng) |
| Thời điểm trong thẻ tiền | Chỉ ghi `string` | `dueDate` và `contract.eventDate` là thời điểm ISO đầy đủ; `startDate` của lớp là ngày `YYYY-MM-DD` |

#### 9.8 Số đo cửa gác sau gói M7 (19/10/2026)
**Cửa gác** (`apps/api/test/gate*.ts`) là bộ bài thử tự động gọi **mọi** đường tổ chức của máy chủ bằng nhiều kiểu người dùng để chứng minh dữ liệu studio này không lộ sang studio khác. Các phép: `scope` (đường có `:orgId` phải khai phạm vi tổ chức), `outsider` (người tổ chức khác gọi → 404), `noPerms` (thành viên không quyền → 403), `unauth` (chưa đăng nhập → 401), `crossId` (chủ tổ chức B nhét mã tài nguyên của A → 404), `leak` (đường xem của B không chứa dữ liệu của A), `refBase` (mẫu thân hợp lệ chạy được), `crossRef` (thay **từng** trường `…Id`/`…Ids` trong thân bằng mã của tổ chức khác → bị từ chối), `keep` (chủ dùng thật được trả lời đúng nghĩa: xem 200, thân rỗng 400), `platform` (đường quản trị nền tảng trả 404 y hệt đường bịa với người thường). Phép riêng **sửa một phần** kiểm mọi đường `PATCH` không đổi trường không gửi.

Sau gói M7 (đủ 8 đường mới): scope/outsider/noPerms/keep **108** mỗi phép (trước D là 100: 100 + 8 = 108, đúng số ký duyệt D đã định), unauth **118** (trước 110), crossId **53** (trước 51), leak **43** (trước 40), refBase **52** (trước 45), crossRef **150** (trước 107), platform **40** (không đổi) — tổng **888/888** (trước D: 793/793). Sửa một phần **23/23**. Ba đột biến (cài lỗi cố ý vào bảng đường để thấy cửa gác chuyển đỏ) đều làm cửa gác đỏ đúng phép: **D1** `GET /occasions` quên lọc tổ chức → `leak`; **D2** kiểm `dismissedRuleIds` không lọc tổ chức → `crossRef`; **D3** `GET /today` đọc đợt thu không lọc tổ chức → `leak` (`apps/api/test/gate-mutants.test.ts`). Các số này do thợ M7 đo và điều phối giao lại; tài liệu chưa chạy lại cửa gác.
