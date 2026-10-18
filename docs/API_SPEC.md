# Quy ước API — Makeup Pro

Ngày viết: 18/10/2026. Bảng đường API lấy đúng từ mã (`apps/api/src/modules/auth/routes.ts`, `apps/api/src/modules/orgs/routes.ts`). Nguồn sự thật cuối cùng là tài liệu tự sinh `GET /api/v1/openapi.json`, không phải tệp này.

> **Mốc dẫn chứng:** mọi `tệp:dòng` trong tài liệu này đúng với commit `f7b0805` (15:29 UTC ngày 18/10/2026). Lúc viết, các thợ khác đang sửa nhiều tệp lõi (chưa lưu vào kho, kể cả sửa theo biên bản nghiệm thu mốc 2); khi các sửa đó được lưu, số dòng có thể lệch và điều phối cần dò lại.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. API là gì
API là "quầy giao dịch" của máy chủ. Web, app iPhone, website giới thiệu đều gửi yêu cầu đến quầy này. Mỗi yêu cầu gồm: **cách làm** (xem `GET`, tạo `POST`, sửa `PATCH`, xoá `DELETE`), **địa chỉ** (ví dụ `/orgs/123/members`), **thẻ đăng nhập**, và **dữ liệu** (dạng JSON).

### 2. Quy ước nên có ở mọi API bán cho nhiều đơn vị
| Quy ước | Vì sao |
|---|---|
| Có số phiên bản trên địa chỉ (`/api/v1`) | Đổi lớn thì mở `/v2`, app cũ trên điện thoại khách không bị gãy |
| Mọi địa chỉ dữ liệu của một tổ chức nằm dưới `/orgs/:orgId/...` | Nhìn địa chỉ là biết đang đụng vào tổ chức nào; cửa gác kiểm một chỗ |
| Một dạng lỗi duy nhất, có mã lỗi máy đọc được và câu tiếng Việt người đọc được | Giao diện xử lý lỗi một kiểu; khách báo lỗi kèm mã số yêu cầu là tra được log |
| Danh sách dài thì chia trang | Không kéo cả nghìn dòng một lần |
| Thao tác tạo quan trọng có khoá chống gửi trùng | Bấm hai lần hoặc mạng chập chờn gửi lại không tạo hai đơn |
| Tài liệu API sinh từ mã | Tài liệu viết tay sẽ lệch khỏi mã sau vài tuần |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Quy ước chung
| Mục | Quy ước | Dẫn chứng |
|---|---|---|
| Gốc địa chỉ | Mọi đường nghiệp vụ nằm dưới `/api/v1` | `apps/api/src/app.ts:77` |
| Ngoài gốc | `GET /health` → `{"ok":true}` (kiểm máy chủ còn sống, không cần đăng nhập) | `app.ts:39-41` |
| Thẻ đăng nhập | Header `Authorization: Bearer <accessToken>`. Thẻ hết hạn sau 900 giây (mặc định) | `http/middleware.ts:18-29`, `env.ts:9` |
| Ba loại đường | `public` (không cần đăng nhập), `auth` (cần đăng nhập), `org` (cần đăng nhập + là thành viên tổ chức + có quyền khai cho đường đó) | `http/route.ts:8` |
| Đường thuộc tổ chức | Bắt buộc bắt đầu bằng `/orgs/:orgId` và bắt buộc khai quyền; sai thì máy chủ không khởi động | `route.ts:67-73` |
| Dữ liệu gửi lên | JSON, tối đa 100KB | `app.ts:29` |
| Mã số yêu cầu | Gửi header `x-request-id` (8–64 ký tự chữ, số, gạch ngang) hoặc để máy chủ tự sinh; luôn trả lại trong header `x-request-id` | `middleware.ts:10-16` |
| Giới hạn tốc độ | Đăng ký, đăng nhập, đổi thẻ: mặc định 10 lần/phút mỗi địa chỉ IP; quá thì lỗi `RATE_LIMITED` | `app.ts:31-37` |
| Tiền | Số nguyên đồng trong JSON (ví dụ `1500000`), không có số lẻ | `packages/shared/src/money.ts` |

### 2. Dạng lỗi
Mọi lỗi trả cùng một dạng (`middleware.ts:95-97`):
```json
{ "error": { "code": "FORBIDDEN", "message": "Bạn không có quyền thực hiện thao tác này", "details": { "required": "members.invite" }, "requestId": "…" } }
```

| `code` | Mã HTTP | Khi nào |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Dữ liệu sai dạng (chi tiết từng ô ở `details.fieldErrors`), JSON hỏng, thiếu/sai `Idempotency-Key` |
| `UNAUTHENTICATED` | 401 | Thiếu thẻ, thẻ sai/hết hạn, tài khoản bị khoá, sai email hoặc mật khẩu |
| `FORBIDDEN` | 403 | Là thành viên nhưng thiếu quyền (`details.required`), trao quyền mình không có (`details.missing`), tổ chức đang bị tạm khoá |
| `NOT_FOUND` | 404 | Không có đường API; **tổ chức không tồn tại hoặc bạn không phải thành viên** (cùng một lời, để người ngoài không dò được tổ chức nào có thật) |
| `CONFLICT` | 409 | Trùng dữ liệu (email, slug…), **trùng lịch thợ** (database từ chối), tổ chức sẽ mất chủ cuối cùng, `Idempotency-Key` đã dùng cho yêu cầu khác |
| `RATE_LIMITED` | 429 | Thử quá nhiều lần trong một phút |
| `INTERNAL` | 500 | Lỗi không lường trước; chi tiết chỉ ghi vào log máy chủ |

Danh sách mã lỗi: `apps/api/src/lib/errors.ts:1-18`.

Bộ bắt lỗi đổi hai loại lỗi database sang 409: trùng khoá duy nhất (`P2002`, `middleware.ts:85-86`) và trùng lịch (`23P01`, `middleware.ts:87-88`). Vi phạm CHECK (ví dụ sai công thức tiền) và trigger chỉ ghi thêm **vẫn rơi vào `INTERNAL` 500** — mã máy chủ phải kiểm trước. Xem `docs/DATABASE_SCHEMA.md` mục 3.5.

### 3. Chia trang
Đường danh sách nhận `?page=1&pageSize=20`. `page` ≥ 1 (mặc định 1), `pageSize` 1–100 (mặc định 20) (`modules/orgs/routes.ts:22-25`). Trả về:
```json
{ "items": [ … ], "page": 1, "pageSize": 20, "total": 57 }
```

### 4. Chống gửi trùng (Idempotency-Key)
Áp cho đường `POST` thuộc tổ chức có khai `idempotent: true` (`route.ts:52-53`, `route.ts:74-78`). Máy khách sinh một khoá mới cho **mỗi lần bấm "Lưu"**, gửi trong header `Idempotency-Key` (8–128 ký tự chữ, số, `-`, `_`).

| Tình huống | Kết quả | Dẫn chứng |
|---|---|---|
| Thiếu hoặc sai dạng khoá | 400 `VALIDATION_FAILED` | `app.ts:96-99` |
| Lần đầu | Xử lý bình thường, lưu kết quả | `app.ts:119-126` |
| Gửi lại cùng khoá, cùng nội dung, lần đầu đã xong | Trả lại **đúng** kết quả lần đầu, không tạo bản ghi thứ hai | `app.ts:117` |
| Gửi lại khi lần đầu đang xử lý | 409 "Yêu cầu giống hệt đang được xử lý" | `app.ts:114-116` |
| Cùng khoá nhưng nội dung hoặc đường khác | 409 | `app.ts:111-113` |
| Lần đầu thất bại | Nhả khoá, sửa rồi gửi lại được | `app.ts:127-130` |

Lúc viết, **chưa đường nào** khai `idempotent: true`. Module lịch đang dựng sẽ dùng (quyết định 15:15 ngày 18/10/2026).

### 5. Tài liệu OpenAPI tự sinh
`GET /api/v1/openapi.json` (không cần đăng nhập) trả tài liệu chuẩn OpenAPI 3.1 sinh thẳng từ bảng đường API (`app.ts:42-45`, `http/openapi.ts`). Mỗi đường có: tóm tắt, nhóm, tham số đường, dạng dữ liệu gửi lên, và trường `x-permission` ghi quyền yêu cầu. Bài thử `apps/api/test/openapi.test.ts` kiểm mọi đường đều có trong tài liệu kèm đúng quyền (lần chạy ngày 18/10/2026: 16/16 đường).

Tài liệu tự sinh **chưa có**: dạng dữ liệu trả về, mẫu lỗi (`openapi.ts:21` nhắc "schema ErrorResponse" nhưng phần `components` chưa khai schema này), tham số truy vấn theo chuẩn (đang để ở trường riêng `x-query-schema`).

Ví dụ lấy về máy khi máy chủ chạy ở cổng 4000:
```
curl http://localhost:4000/api/v1/openapi.json
```

### 6. Đường API — Đăng nhập (`modules/auth/routes.ts`)
| Method | Đường (sau `/api/v1`) | Loại | Quyền | Giới hạn tốc độ | Mô tả |
|---|---|---|---|---|---|
| POST | `/auth/register` | public | — | có | Đăng ký: `email`, `password` (10–128 ký tự), `fullName`. Trả `user`, `accessToken`, `refreshToken`, `expiresIn`. Email đã có → 409 |
| POST | `/auth/login` | public | — | có | Đăng nhập. Sai email hay sai mật khẩu đều trả cùng một lời 401 |
| POST | `/auth/refresh` | public | — | có | Gửi `refreshToken` trong thân, nhận cặp thẻ mới. Thẻ cũ hết dùng được; dùng lại thẻ cũ → thu hồi cả họ thẻ |
| POST | `/auth/logout` | public | — | **không** | Gửi `refreshToken`, thu hồi phiên trên thiết bị đó. Luôn trả 204 |
| GET | `/auth/me` | auth | — | không | Tài khoản + danh sách tổ chức đang tham gia (chỉ tổ chức và tư cách thành viên còn hoạt động) kèm vai trò |

### 7. Đường API — Tổ chức, nhân sự, vai trò, nhật ký (`modules/orgs/routes.ts`)
| Method | Đường (sau `/api/v1`) | Quyền | Mô tả |
|---|---|---|---|
| POST | `/orgs` | (chỉ cần đăng nhập) | Tạo tổ chức: `name`, `slug`, `kind` (`INDIVIDUAL`/`TEAM`/`ACADEMY`). Chép 9 vai trò mẫu, người tạo thành chủ |
| GET | `/orgs/:orgId` | `org.read` | Thông tin tổ chức + vai trò và quyền của chính mình |
| PATCH | `/orgs/:orgId` | `org.update` | Sửa tên, múi giờ |
| GET | `/orgs/:orgId/members` | `members.read` | Danh sách nhân sự, chia trang, lọc `status` |
| POST | `/orgs/:orgId/members` | `members.invite` | Thêm một tài khoản **đã đăng ký** bằng email + `roleKeys`. Không trao được quyền mình không có |
| PATCH | `/orgs/:orgId/members/:membershipId` | `members.update` | Đổi vai trò hoặc tạm khoá. Không phải chủ thì không đụng được vào chủ; tổ chức luôn còn ít nhất một chủ |
| DELETE | `/orgs/:orgId/members/:membershipId` | `members.remove` | Cho rời tổ chức (đánh dấu `REMOVED`, giữ lịch sử, không xoá dữ liệu) |
| GET | `/orgs/:orgId/roles` | `roles.read` | Danh sách vai trò |
| POST | `/orgs/:orgId/roles` | `roles.manage` | Tạo vai trò tuỳ chỉnh. Không dùng được mã của vai trò hệ thống; khoá quyền lạ → 400 |
| PATCH | `/orgs/:orgId/roles/:roleId` | `roles.manage` | Sửa vai trò tuỳ chỉnh. Vai trò hệ thống → 403 |
| GET | `/orgs/:orgId/audit-logs` | `audit.read` | Nhật ký thay đổi, mới nhất trước, chia trang |

Tổng phần đăng nhập + tổ chức: 16 đường (4 public, 2 auth, 10 org). Con số này khớp bài thử OpenAPI (16/16) và cửa gác (10 đường thuộc tổ chức) ở lần chạy 15:18 UTC, khi bảng giá và lịch chưa có đường nào.

### 8. Đường API — Bảng giá, Hợp đồng, Khách hàng, Lịch
**Đang dựng** — các thợ khác đang viết song song (`modules/catalog`, `modules/contracts`, `modules/schedule`), chưa lưu vào kho. Lần chạy bài thử OpenAPI lúc ≈15:35 UTC đã in 48/48 đường (gồm cả đường đang dựng). Điều phối sẽ cập nhật mục này. Quyền đã có sẵn trong danh mục (`packages/shared/src/permissions.ts:13-22`): `catalog.read`, `catalog.write`, `prices.write`, `customers.read`, `customers.write`, `schedule.read_own`, `schedule.read_all`, `schedule.write`, `contracts.read`, `contracts.write`.
