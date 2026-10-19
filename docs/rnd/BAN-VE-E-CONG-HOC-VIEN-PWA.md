# Bản vẽ E: Cổng học viên (phương án B) và App iPhone (PWA), chặng 2

- Sản phẩm: Makeup Pro. Người đọc: thợ làm, điều phối, anh Chiến (mục 9).
- Ngày: 19/10/2026. Người vẽ: Trung tâm R&D, chặng 2.
- Đầu vào:
  - Quyết định thay anh Chiến: `docs/NHAT-KY-QUYET-DINH-THAY.md:93` (dòng "19/10 chiều"). Cổng học viên = **B**, App iPhone = **web cài lên màn hình chính**.
  - Báo cáo chặng 1: `docs/rnd/BAO-CAO-RND-06-HOC-VIEN-IPHONE.md` (mục 1.1 dữ liệu, 1.3 rủi ro + bài học Studio Pro, 1.6 trường mới, 2.1 PWA).
  - Bản mẫu: `docs/rnd/v6-hoc-vien.html` (màn `b-nv`, `b-mo`, `b-sai`, `b-trang`), `docs/rnd/v6-iphone.html`. Ảnh: `docs/rnd/anh-rnd06/hv-B-*.png`, `ip-1-*.png`.
- Một migration duy nhất: **`20261019140000_cong_hoc_vien`**.
- Thông báo đẩy: **GIAI ĐOẠN SAU**. Bản vẽ này không làm, chỉ chừa chỗ cắm (mục 5.4).

Cách đọc: mục 1 là mã đang có (để thợ khỏi đoán). Mục 2 là luật bảo mật, phải đọc trước khi viết dòng mã nào. Mục 3–5 là thông số. Mục 6 là bài thử bắt buộc. Mục 7 là gói việc.

---

## 0. Tóm tắt một trang

| Phần | Làm gì |
|---|---|
| Vào cổng | Trung tâm bấm "Tạo đường dẫn" ở hồ sơ học viên → máy chủ sinh **chìa** 32 byte, chỉ lưu bản băm → web ghép tin nhắn có `https://<web>/hv#k=<chìa>` → trung tâm "Sao chép tin nhắn", dán vào Zalo. Học viên mở, nhập **4 số cuối SĐT**, bấm "Mở trang của tôi" → máy chủ đổi chìa thành **phiên cổng** (cookie httpOnly riêng). |
| Con số chặn | Mỗi đường dẫn **tối đa 2 máy**. Đường dẫn **chưa mở** hết hạn sau **7 ngày**. Sai 4 số **5 lần** thì khoá đường dẫn. Máy được nhớ **90 ngày** (trượt theo lần dùng). |
| Học viên xem | Lớp, lịch học (nếu lớp đã sinh buổi học, việc của thợ K2), hợp đồng + đã đóng/còn lại + các đợt, nội quy bản lúc ký, ảnh Chào mừng/Feedback **của mình**, số tài khoản trung tâm (nếu trung tâm điền), cách liên hệ. Tất cả trên **một trang cuộn**, khổ 390 là chính. |
| Trung tâm làm | Thẻ "Cổng học viên" trên hồ sơ khách/học viên: tạo đường dẫn, sao chép tin, xem máy đã mở, chặn máy, thu hồi đường dẫn + chặn mọi máy. Trang "Cài đặt → Cổng học viên": số tài khoản ngân hàng. |
| Bảo mật | Phiên cổng là **loại thẻ riêng**: đường nhân viên từ chối nó, đường cổng từ chối thẻ nhân viên. Học viên lấy từ **phiên**, đường cổng **không có tham số nào** (không `:id`, không query, không trường `…Id`). Mọi lần mở hỏng trả **một lời chung**. Cửa gác cách ly thêm 4 phép, 5 đột biến. |
| PWA | Manifest + biểu tượng + service worker tối thiểu cho **cả app nhân viên (`/`) lẫn cổng (`/hv`)**. Cổng là một **trang vào riêng** (`hv.html`), không kéo mã app nhân viên. |
| Gói việc | **11 gói, khoảng 48 giờ** (mục 7). Máy chủ và cửa gác dùng Opus, màn web và PWA dùng Sonnet, tra cứu dùng Haiku. |

---

## 1. Mã đang có (đã tra ngày 19/10/2026, đường_dẫn:dòng)

Thợ K1 (đặt lại mật khẩu) và K2 (buổi học ↔ lớp) đang làm nên số dòng có thể lệch vài dòng. Gói E0 (mục 7) kiểm lại bảng này trước khi các gói khác bắt đầu.

### 1.1 Đăng nhập nhân viên, thẻ, giới hạn lượt

| Ở đâu | Có gì | Bản vẽ dùng thế nào |
|---|---|---|
| `apps/api/src/lib/tokens.ts:9-11` | `signAccessToken` ký JWT HS256 **chỉ có `sub`**, không có trường loại thẻ | Phiên cổng **không dùng JWT**. Nó là chuỗi ngẫu nhiên có tiền tố `mpp_`, tra bản băm trong database. Không thể bị nhầm thành thẻ nhân viên. |
| `apps/api/src/lib/tokens.ts:13-24` | `verifyAccessToken`: sai hoặc hết hạn → 401 | Giữ nguyên. Thêm chặn tường minh `mpp_` ở `authenticate` (mục 4.1). |
| `apps/api/src/lib/tokens.ts:27-34` | Refresh token 48 byte, chỉ lưu sha256 | Cùng cách cho chìa, phiên, mã chuyển máy |
| `apps/api/src/http/middleware.ts:18-29` | `authenticate`: chỉ đọc `Authorization: Bearer`, tra `users.status` | Đường nhân viên **không bao giờ** đọc cookie cổng |
| `apps/api/src/modules/auth/transport.ts:11-16` | Cookie `mp_refresh`, path `/api/v1/auth`; web phải gửi `X-Client: web` | Cookie cổng `mp_portal`, path **`/api/v1/portal`**, bắt buộc `X-Client: portal` |
| `apps/api/src/app.ts:151-160` | Ghi cookie: httpOnly, SameSite=Strict, Secure ở production | Dùng lại, không sửa |
| `apps/api/src/app.ts:71-77`, `:120-121`; `apps/api/src/http/route.ts:75-77` | Bộ đếm `'auth'` (10 lần/phút/IP, `env.ts:21`), `'refresh'` riêng | Thêm bộ đếm **`'portal'`** riêng (mục 4.1) |
| `apps/api/src/app.ts:123` | Chọn cách xác thực theo scope: `public` → không; `platform` → 404 giả; **còn lại → `authenticate`** | Phải thêm nhánh `'portal'` **trước** nhánh cuối, nếu không đường cổng sẽ rơi vào xác thực nhân viên |
| `apps/api/src/modules/auth/routes.ts:122-162` | Đăng nhập: cùng một lời "Email hoặc mật khẩu không đúng", băm giả `DUMMY_HASH` (`lib/password.ts:14`) | Cùng tinh thần: một lời chung + mức sàn thời gian |
| `apps/api/src/modules/auth/password-reset.ts:21`, `:25`, `:31-38`, `:174-228` | Thợ K1: thẻ sau dấu `#the=`, sàn 300 ms, thẻ 32 byte chỉ lưu sha256, giành thẻ bằng `updateMany` có điều kiện (`:208`) | Chép đúng khuôn: chìa sau `#k=`, sàn 300 ms, giành bằng khoá dòng |
| `apps/api/prisma/migrations/20261019110000_dat_lai_mat_khau/migration.sql` | `CHECK ("token_hash" ~ '^[0-9a-f]{64}$')` | Cùng CHECK cho `key_hash`, `token_hash`, `handoff_hash` |
| `apps/api/src/lib/logger.ts:7-17` | Che `authorization`, `cookie`, `set-cookie`, `*.password`, `*.refreshToken` | Thêm `*.key`, `*.last4`, `*.code` |
| `apps/web/src/features/auth/ResetPasswordPage.tsx:12-15`, `:30`, `:39` | Đọc thẻ từ `location.hash`, xoá `#` khỏi thanh địa chỉ | Cổng làm giống hệt cho `#k=` |

### 1.2 Khung đường API và cửa gác

| Ở đâu | Có gì | Bản vẽ dùng thế nào |
|---|---|---|
| `apps/api/src/http/route.ts:10` | `Scope = 'public' \| 'auth' \| 'org' \| 'platform'` | Thêm `'portal'` |
| `apps/api/src/http/route.ts:27-39` | `HandlerCtx` có `userId`, `org` | Thêm `portal: PortalContext \| null` |
| `apps/api/src/http/route.ts:90-144` | `defineRoute` từ chối khai sai ngay lúc khởi động (`:orgId` phải là `org`, `/platform/` phải là `platform`…) | Thêm luật cho `portal` (mục 4.1). Đây là cửa gác tĩnh đầu tiên chống lặp lỗi Studio Pro. |
| `apps/api/src/http/openapi.ts:41` | `security` bearer cho mọi scope trừ public | Scope `portal` khai `portalCookie` |
| `apps/api/test/gate.ts:47-50` | `GateReport` có **10 phép**: scope, outsider, noPerms, unauth, crossId, leak, refBase, crossRef, keep, platform | Thêm 4 phép: `portalScope`, `portalWall`, `portalLeak`, `portalProbe` |
| `apps/api/test/gate.ts:178-339` | `setupOrg` dựng tổ chức ACADEMY có đủ loại tài nguyên; `ids` cho mọi tham số đường dẫn | Thêm `portalCustomerId`, `deviceId`, và phiên cổng thật của tổ chức |
| `apps/api/test/gate.ts:431-442` | Phép `unauth`: mọi đường không phải `public` → 401 khi không có gì | Đường `portal` tự vào diện, phải trả 401 |
| `apps/api/test/gate.ts:524-539` | Phép `platform`: chọn đường **theo địa chỉ**, không theo nhãn (sổ lỗi mục 15) | `portalScope` cũng chọn theo **cả** địa chỉ `/portal/` **lẫn** nhãn |
| `apps/api/test/gate-samples.ts:7`, `:80`, `:231` | `SAMPLES`, `REF_SAMPLES`, `REF_VARIANTS` | Thêm mẫu cho 3 đường POST phía trung tâm |
| `apps/api/test/tenant-isolation.test.ts:32` | Danh sách tên phép kiểm "không vi phạm" | Thêm 4 tên mới |
| `apps/api/test/gate-mutants.test.ts:22-32`, `:166-174` | `replace()`, `gateOn()`; đột biến 9 dựng thẳng đối tượng route để vượt `defineRoute` | Đột biến 15–19 (mục 6.3) |
| `docs/SECURITY.md:79-115` | Luật cửa gác: in tử số/mẫu số, có vế GIỮ, thiếu mẫu thì đỏ, phải từng đỏ trước lỗi cài sẵn | Áp nguyên cho 4 phép mới |
| `docs/SO-LOI-DA-DO.md:157-162` (mục 24) | CHECK có cột NULL phải viết rõ `IS NOT NULL`; bài thử phải ghi thẳng database | Mọi CHECK ở mục 3.2 đã soát theo mục này |

### 1.3 Dữ liệu học viên đọc (`apps/api/prisma/schema.prisma`)

| Model | Dòng | Trường dùng | Trường **cấm** trả cho học viên |
|---|---|---|---|
| `Customer` | 385-409 (`phone` :390, `@@unique([id, organizationId])`) | `fullName`, `phone` (chỉ để so 4 số cuối), `avatarFileId` | `note`, `email`, `phone` (không trả lại) |
| `Enrollment` | 1223-1250 | `status = ACTIVE`, `customerId`, `courseClassId`, `contractId` | `cancelReason` |
| `CourseClass` | 1183-1221 | `name`, `startDate`, `endDate`, `weekdays`, `startMinute`, `endMinute`, `status`, `instructorMembershipId`, `studioLocationId` | `note`, `enrolledCount`, `capacity` |
| `StaffProfile` | 820-845 | `displayName`, `avatarFileId` | **`phone` (:828)** |
| `Appointment` | 435-484 (`courseClassId` :459, K2) | `kind = COURSE_SESSION`, `courseClassId`, `sessionDate`, `startsAt`, `endsAt`, `status` | `code`, `notes`, `cancelReason`, `createdById`, danh sách thợ |
| `Contract` | 672-723 | `code`, `kind = COURSE`, `status ∈ {CONFIRMED, COMPLETED}`, `confirmedAt`, `subtotal`, `discount`, `total`, `depositRequired`, `terms`, `rules` | `notes`, `cancelReason`, `ownerMembershipId`, `createdById` |
| `ContractLine` | 725-800 | `name`, `quantity`, `unitPrice`, `lineTotal` (dòng `voidedAt` trống) | `voidReason`, `note`, giá vốn, thợ |
| `PaymentInstallment` | 947-964 | `name`, `dueDate`, `amount`, `isDeposit`, `sortOrder` | — |
| `Payment` | 981-1006 | `code`, `kind`, `method`, `amount`, `receivedAt` (chỉ phiếu `voidedAt` trống) | `note`, `voidReason`, `createdById` |
| `DesignCard` | 1317-1356 | `kind ∈ {WELCOME, FEEDBACK}`, `customerId`, `outputFileId`, `createdAt`, `courseClassId` | `snapshot`, `body` thô, `GREETING` |
| `StoredFile` | 911-944 (`isPublic` :923) | Đọc `storageKey` để ký URL | `storageKey`, `originalName` |
| `OrganizationProfile` | 1072-1108 | `brandName`, `logoFileId`, `phone`, `zalo`, `address` | — |
| `AuditLog` | 223-241 (`actorUserId` **cho phép NULL** :226) | Ghi sự kiện cổng với `actorUserId = null` | — |

- **Ảnh:** cột `StoredFile.isPublic` có nhưng **không mã nào đọc** (đã grep `apps/api/src`). Mọi ảnh đi qua URL ký có hạn **10 phút**: `apps/api/src/modules/files/service.ts:37` (`SIGNED_URL_TTL_SEC = 600`), `:107-110` (`signedUrlOf`), `:146-165` (`resolveAvatarUrls`). Driver đĩa mã hoá vé, không lộ mã tổ chức: `apps/api/src/lib/storage/signing.ts:3-29`. Đường phát tệp kiểm tổ chức còn hoạt động: `apps/api/src/modules/files/raw.ts:8`, `:28-31`. Cổng dùng `signedUrlOf` và **không** bật `isPublic`.
- **Tiền:** `packages/shared/src/payments.ts:77` (`summarizePayments`) và `:126` (`allocateToInstallments`) đã có. Cổng dùng lại để số "Đã đóng / Còn lại / còn thiếu đợt" khớp màn Thu tiền.
- **Hồ sơ công khai** liệt kê từng trường, không trải `...p` (`apps/api/src/modules/profile/public.ts`, khối `profile: {…}` khoảng dòng 118-141). Vì vậy số tài khoản đặt ở **bảng riêng** `portal_settings` để chắc chắn không bao giờ lọt lên trang công khai.
- **Chỉ tổ chức ACADEMY:** khuôn kiểm ở `apps/api/src/modules/courses/service.ts:82-86` (`ACADEMY_REQUIRED`).
- **Quyền:** `packages/shared/src/permissions.ts:3-39` (danh mục), `:61-107` (vai trò mẫu); đồng bộ vai trò của tổ chức đang có: `apps/api/src/scripts/sync-system-roles.ts:15-42` (`pnpm --filter @makeup/api db:sync-roles`).
- **Đường `/hv` không đụng đường tổ chức:** web dùng `/:orgSlug/...` (`apps/web/src/app/routes.tsx:119`). Slug tổ chức tối thiểu **3 ký tự** (`apps/api/src/modules/orgs/routes.ts:13-19`), nên `hv` không bao giờ là slug.

### 1.4 Web

| Ở đâu | Có gì |
|---|---|
| `apps/web/index.html` | Chỉ có `<title>`: **chưa có** manifest, biểu tượng, `theme-color` |
| `apps/web/vite.config.ts` | Một trang vào; tách tệp theo màn bằng `React.lazy` (`src/app/routes.tsx:17-33`) |
| `apps/web/src/app/routes.tsx:103-123` | Trang công khai `trang/:slug` đặt trước `:orgSlug` |
| `apps/web/src/api/client.ts:6`, `:52-58` | Máy khách nhân viên: `X-Client: web`, `Authorization: Bearer`, tự refresh. **Cổng không được nhập tệp này.** |
| `apps/web/scripts/vercel-config.mjs:13-25`, `apps/web/vercel.json` | Rewrite `/api/(.*)` sang máy chủ; mọi đường khác → `/index.html` |
| `apps/web/scripts/check-bundle-secrets.mjs` | Cửa gác bí mật trong `dist/`, chạy trong `build` |
| `apps/web/src/features/customers/CustomerDetail.tsx:26-80` | Cột phải hồ sơ khách: Thông tin → Hợp đồng → Lịch |
| `apps/web/src/layout/nav.ts:99-107` | Mục "Cài đặt" (quyền `org.update`), con duy nhất "Hồ sơ thương hiệu" |
| `apps/web/src/styles/tokens.css` | Màu: `--accent #A63D62`, `--bg #F6F4F2`, `--ok #2F7D72` |

---

## 2. Mô hình bảo mật

### 2.1 Kẻ gây hại và lớp chặn

| # | Kẻ gây hại | Muốn gì | Lớp chặn (mục) |
|---|---|---|---|
| H1 | Bạn cùng lớp nhận được đường dẫn (học viên dán nhầm vào nhóm Zalo lớp) | Xem học phí của bạn | Phải biết 4 số cuối; tối đa 2 máy; sai 5 lần khoá; trung tâm thấy máy lạ và chặn (2.4, 4.3) |
| H2 | Học viên A tò mò | Sửa địa chỉ, đổi mã để xem của B | Đường cổng **không có tham số**; học viên lấy từ phiên (2.2, 4.1) |
| H3 | Học viên | Dùng phiên cổng gọi màn quản trị | Tường chắn hai chiều (2.3) |
| H4 | Người ngoài | Dò xem chìa nào có thật, ai là học viên | Chìa 256 bit; mọi lỗi một lời, cùng mã, cùng header, sàn 300 ms (2.5) |
| H5 | Máy xem trước của Zalo | Mở đường dẫn làm mất suất máy | Chìa sau `#` nên máy chủ không nhận; phải **bấm nút** mới đổi chìa thành phiên (2.4) |
| H6 | Kẻ lấy bản sao database | Dùng lại chìa, phiên | Chỉ lưu sha256; CHECK chặn ghi nhầm bản rõ (3.2) |
| H7 | Nhân viên có quyền hẹp | Tự tạo đường dẫn để xem tiền mà mình không có quyền xem | Tạo đường dẫn phải có `portal.manage` **và** `customers.read`, `contracts.read`, `payments.read` (4.3) |
| H8 | Nhân viên gian | Đổi số tài khoản ngân hàng thành của mình | Chỉ `org.update` (Chủ, Quản trị) được sửa; audit ghi trước/sau (4.4) |
| H9 | Mất điện thoại | Người nhặt được xem tiếp | Trung tâm "Chặn máy này", có hiệu lực ngay ở yêu cầu kế tiếp; học viên có nút "Thoát khỏi máy này" (4.2, 4.3) |
| H10 | Mã chính mình viết sai | Đường cổng mới quên lọc học viên, lộ ghi chú nội bộ | Cửa gác `portalLeak` + quét "không có UUID" + đột biến (6.3) |

### 2.2 Luật cứng (thợ không được làm khác)

1. **Học viên lấy từ phiên, không bao giờ từ yêu cầu.** Đường scope `portal` không có `:tham số`, không có `query`, thân không có trường tên kết thúc `Id`/`Ids`. `defineRoute` từ chối lúc khởi động. Mọi truy vấn dữ liệu lọc **cả** `organizationId = phiên.organizationId` **lẫn** `customerId = phiên.customerId`.
2. **Phản hồi cổng chỉ chứa trường liệt kê ở mục 4.2.** Không trải `...row`. Không trả UUID nào: mọi phần tử danh sách dùng khoá hiển thị như mã hợp đồng, ngày, số thứ tự. Bài thử quét UUID trong thân (bỏ qua giá trị của trường tên kết thúc bằng `Url`).
3. **Một lời báo chung** cho mọi lần mở hỏng (2.5).
4. **Không có chìa vượt quyền.** Không đường nào nhận thẻ, chìa hay mã qua query string. Không chuỗi `BYPASS`, `SUPER_ADMIN`, `accessToken=` trong mã máy chủ hay bản build cổng (6.4).
5. **Chỉ lưu bản băm** của chìa, phiên, mã chuyển máy. Đường tạo đường dẫn **không khai `idempotent`**: kho chống gửi trùng (`app.ts:274-336`) cất **nguyên phản hồi** vào `idempotency_keys`, nghĩa là sẽ cất chìa bản rõ. Bấm hai lần chỉ tạo hai đường dẫn, cái sau thu hồi cái trước. Web khoá nút trong lúc chờ.
6. **Ghi audit** mọi sự kiện ở 2.7, trong cùng transaction với thay đổi (`apps/api/src/lib/audit.ts:14-16`).

### 2.3 Tường chắn hai chiều

| Gọi | Kết quả |
|---|---|
| Đường nhân viên (`auth`, `org`) với `Authorization: Bearer mpp_…` | 401 "Thẻ đăng nhập không hợp lệ". `authenticate` chặn tiền tố `mpp_` **trước** khi gọi `jwt.verify`. |
| Đường nhân viên với cookie `mp_portal` + `X-Client: portal` | 401. Đường nhân viên không đọc cookie. Trình duyệt cũng không gửi cookie vì path là `/api/v1/portal`. |
| Đường `/platform/…` với phiên cổng | 404 giống hệt đường bịa (luật cũ, `app.ts:181-191`) |
| Đường cổng với `Authorization` bất kỳ (kể cả JWT nhân viên hợp lệ) | 401. Có header `Authorization` là từ chối, không xét tiếp. |
| Đường cổng với cookie `mp_refresh` của nhân viên | 401 (không đọc) |
| Đường cổng có cookie `mp_portal` nhưng thiếu `X-Client: portal` | 401 (chống trang lạ giả yêu cầu) |

### 2.4 Vòng đời đường dẫn, máy, phiên

```
Trung tâm "Tạo đường dẫn" ──► portal_links (key_hash, expires_at = +7 ngày)
   │  (tạo cái mới = thu hồi cái chưa thu hồi, lý do REPLACED; máy đã mở GIỮ NGUYÊN)
   ▼
Học viên mở /hv#k=<chìa>  (máy chủ không thấy gì: phần sau # không gửi lên)
   │  web gọi GET /portal/me trước: đã có phiên trên trình duyệt này → vào thẳng, KHÔNG tốn suất
   ▼
Nhập 4 số + bấm "Mở trang của tôi" ──► POST /portal/session
   │  đúng → portal_devices (+1 suất / tối đa 2) + portal_sessions (90 ngày trượt) + cookie mp_portal
   │  sai  → failed_attempts + 1; tới 5 → locked_at (máy đã mở vẫn dùng được)
   ▼
Dùng: GET /portal/me  (mỗi yêu cầu kiểm: phiên chưa thu hồi, chưa hết hạn, máy chưa kết thúc, tổ chức ACTIVE)
   │
   ├─ Cài lên màn hình chính: POST /portal/session/handoff → mã 8 ký tự (10 phút)
   │      app vừa cài: POST /portal/session/claim → phiên MỚI trên CÙNG máy (không tốn suất)
   ├─ Học viên "Thoát khỏi máy này": máy kết thúc SIGNED_OUT (suất vẫn tính)
   ├─ Trung tâm "Chặn máy này": máy kết thúc BLOCKED, mọi phiên của máy bị thu hồi
   └─ Trung tâm "Thu hồi đường dẫn và chặn mọi máy": link REVOKED + mọi máy của học viên LINK_REVOKED
```

Ghi chú:
- **Hết hạn 7 ngày** chỉ áp cho đường dẫn **chưa mở máy nào** (`first_opened_at` trống), đúng như quyết định. Đường dẫn đã mở một máy vẫn nhận máy thứ hai cho tới khi đủ suất, bị khoá hoặc bị thu hồi. Đây là câu hỏi mở số 1.
- **Suất máy tính trên số máy từng mở** (cả máy đã thoát hoặc đã chặn), không tính trên máy đang sống. Nếu không, thoát rồi mở trên máy khác sẽ lách được giới hạn 2.
- **Mã chuyển máy** cần vì iOS có thể tách kho cookie giữa Safari và app đã cài lên màn hình chính, và trình duyệt trong Zalo cũng có kho riêng. Không có mã thì cài app sẽ tốn suất thứ hai. R&D **chưa thử trên iPhone thật** (chưa có tên miền, `docs/DEPLOYMENT.md:5`). Nếu iOS có chép cookie sang app thì mã thừa nhưng vô hại.
- Mỗi máy giữ tối đa **3 phiên sống** (Zalo, Safari, app). Phiên thứ 4 → thu hồi phiên dùng lâu nhất.

### 2.5 Một lời báo chung và chống dò

`POST /portal/session` và `POST /portal/session/claim`, với **mọi** nguyên nhân hỏng (chìa không có, sai 4 số, đã khoá, đã thu hồi, hết hạn, đủ 2 máy, khách không còn SĐT, tổ chức bị khoá, thiếu `X-Client`; mã chuyển sai, hết hạn, đã dùng, máy đã kết thúc), đều trả:

```
HTTP 401
{ "error": { "code": "UNAUTHENTICATED",
             "message": "Không mở được trang. Kiểm tra lại 4 số cuối số điện thoại, hoặc nhắn trung tâm gửi đường dẫn mới.",
             "details": { "reason": "PORTAL_DENIED" }, "requestId": "…" } }
```

- Cùng bộ header (không đặt cookie khi hỏng).
- Mọi kết quả, kể cả thành công, trả sau **ít nhất 300 ms** tính từ lúc vào handler. Khuôn giống `RESET_REQUEST_MIN_RESPONSE_MS`.
- So 4 số bằng `timingSafeEqual` trên 4 byte. Chìa không có thì vẫn so với `"0000"`.
- `last4` sai dạng (không đúng 4 chữ số) → 400 lỗi dữ liệu. Lỗi này không phụ thuộc chìa có thật hay không nên không lộ gì. Chìa nhận chuỗi 1–200 ký tự (không kiểm độ dài 43, để chìa sai độ dài cũng rơi vào lời chung).
- Màn web **không** hiện "còn N lần thử" và **không** có màn "đã khoá" riêng. Đây là chỗ **khác bản mẫu** `b-sai`, có chủ đích. Thay vào đó luôn có dòng nhắc cố định "Nhập sai nhiều lần, đường dẫn sẽ bị khoá."
- Trung tâm thì thấy đủ trạng thái (Bị khoá / Đủ 2 máy / Hết hạn…) ở thẻ Cổng học viên.

### 2.6 Giới hạn lượt

| Lớp | Mức |
|---|---|
| Bộ đếm `'portal'` theo IP cho `POST /portal/session`, `POST /portal/session/claim` | `PORTAL_RATE_LIMIT_PER_MINUTE`, mặc định **10/phút/IP** (biến mới trong `env.ts`, `.env.example`). Bộ đếm **riêng**, không ăn vào hạn mức đăng nhập nhân viên. |
| Theo đường dẫn | Sai 4 số **5 lần** → khoá vĩnh viễn (trung tâm tạo đường dẫn mới). Đúng một lần thì bộ đếm về 0. |
| Mã chuyển máy | 8 ký tự trong bảng 31 chữ/số dễ đọc (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`), khoảng 8,5×10¹¹ khả năng, sống 10 phút, dùng một lần, cộng bộ đếm theo IP |
| `GET /portal/me` | Không giới hạn riêng. Thẻ phiên 256 bit, không dò được. |

### 2.7 Audit (`audit_logs`, `entity_type` / `action`)

| action | actor | entityType / entityId | data (không bao giờ có chìa, thẻ, mã, 4 số) |
|---|---|---|---|
| `portal.link_created` | nhân viên | `portal_link` / id | `{ customerId, expiresAt, replacedLinkId?, phoneConfirmed: true }` |
| `portal.link_revoked` | nhân viên | `portal_link` / id | `{ customerId, reason, devicesEnded }` |
| `portal.device_blocked` | nhân viên | `portal_device` / id | `{ customerId, reason }` |
| `portal.device_added` | null | `portal_device` / id | `{ customerId, linkId, label }` |
| `portal.open_rejected` | null | `portal_link` / id (chỉ khi chìa có thật) | `{ reason: WRONG_DIGITS \| LOCKED \| REVOKED \| EXPIRED \| FULL \| NO_PHONE \| ORG_SUSPENDED }` |
| `portal.link_locked` | null | `portal_link` / id | `{ customerId }` |
| `portal.handoff_created` / `portal.handoff_claimed` | null | `portal_device` / id | `{ customerId }` |
| `portal.signed_out` | null | `portal_device` / id | `{ customerId }` |
| `portal.settings_updated` | nhân viên | `portal_settings` / orgId | `{ before: {...}, after: {...} }` |

Không ghi audit khi chìa không có thật, để người ngoài không làm đầy bảng audit. Bộ đếm IP chặn phần còn lại. Không ghi audit mỗi lần xem trang; chỉ cập nhật `last_seen_at`.

### 2.8 Bài học Studio Pro → cửa gác chống lặp lại

Nguồn: `docs/rnd/BAO-CAO-RND-06-HOC-VIEN-IPHONE.md:177-182`.

| Lỗi Studio Pro | Ở Makeup Pro bị chặn bởi | Cửa gác nào chuyển đỏ nếu tái phạm |
|---|---|---|
| So SĐT + mã hợp đồng **trong trình duyệt**, trên **toàn bộ** danh sách hợp đồng đã tải về | So ở máy chủ; đường cổng không có tham số; phản hồi chỉ dữ liệu của mình | `defineRoute` (khởi động) + phép **`portalScope`** + phép **`portalLeak`** (thân của A1 không chứa gì của bạn cùng lớp A2 hay của tổ chức B) + đột biến 15, 16, 19 |
| Hai lời báo khác nhau → dò được mã có thật | Một lời chung, một mã, một bộ header, sàn 300 ms | Phép **`portalProbe`** + đột biến 18 + bài thử thời gian trong `cong-hoc-vien-vao.test.ts` |
| `?accessToken=SUPER_ADMIN_BYPASS` trên địa chỉ | Không nhận thẻ qua query; cổng không có query | `defineRoute` cấm `query` ở scope portal; bài thử quét chuỗi cấm trong `apps/api/src` và trong bản build cổng (`check-portal-bundle.mjs`) |
| Tài khoản khách chung cửa với nhân viên, phân biệt bằng `team === 'Khách hàng'` | Cửa, thẻ, cookie, scope riêng | Phép **`portalWall`** + đột biến 17 |

---

## 3. Dữ liệu

### 3.1 Tổng quan

| Bảng mới | Một dòng là | Ghi chú |
|---|---|---|
| `portal_links` | Một đường dẫn đã gửi | Mỗi học viên tối đa **một** đường dẫn chưa thu hồi (chỉ mục duy nhất có điều kiện) |
| `portal_devices` | Một máy (một kho trình duyệt) đã mở bằng đường dẫn | Tối đa 2 máy mỗi đường dẫn (trigger + khoá dòng). Kết thúc thì không sống lại được. |
| `portal_sessions` | Một thẻ phiên cổng | Nhiều phiên trên một máy (chuyển sang app) |
| `portal_settings` | Cài đặt cổng của một tổ chức | Số tài khoản ngân hàng: đủ cả 3 trường hoặc trống cả 3 |

Không đổi bảng cũ nào: không thêm `Customer.phoneVerifiedAt`, không thêm `DesignCard.portalVisible`, không đụng `OrganizationProfile`. Xác nhận SĐT là ô tick bắt buộc khi tạo đường dẫn, ghi vào audit. Khoá ngoại kép `(…, organization_id)` ở mọi chỗ; thêm khoá ngoại kép `(…, customer_id)` để máy và phiên không thể trỏ sang học viên khác, kể cả khi ghi thẳng database.

### 3.2 SQL đầy đủ: `apps/api/prisma/migrations/20261019140000_cong_hoc_vien/migration.sql`

```sql
-- Cổng học viên (bản vẽ E: docs/rnd/BAN-VE-E-CONG-HOC-VIEN-PWA.md). Chìa, thẻ phiên, mã chuyển máy CHỈ lưu sha256.
-- Mọi CHECK có cột cho phép NULL đã viết rõ IS NULL / IS NOT NULL ở từng vế (sổ lỗi mục 24).

CREATE TYPE "PortalLinkRevokeReason" AS ENUM ('REPLACED', 'REVOKED');
CREATE TYPE "PortalDeviceEndReason" AS ENUM ('SIGNED_OUT', 'BLOCKED', 'LINK_REVOKED');

-- ===== Đường dẫn =====
CREATE TABLE "portal_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Hạn cho đường dẫn CHƯA mở máy nào (created_at + 7 ngày). Đã mở thì cột này không còn xét.
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "first_opened_at" TIMESTAMPTZ(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" "PortalLinkRevokeReason",
    "revoked_by_id" UUID,

    CONSTRAINT "portal_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "portal_links_key_hash_sha256" CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "portal_links_expires_after_created" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "portal_links_opened_after_created" CHECK ("first_opened_at" IS NULL OR "first_opened_at" >= "created_at"),
    CONSTRAINT "portal_links_failed_range" CHECK ("failed_attempts" >= 0 AND "failed_attempts" <= 5),
    -- Khoá khi và chỉ khi đã sai đủ 5 lần (mọi toán hạng NOT NULL hoặc là IS [NOT] NULL — không có vế ra NULL).
    CONSTRAINT "portal_links_lock_pair" CHECK (
        ("locked_at" IS NULL AND "failed_attempts" < 5) OR ("locked_at" IS NOT NULL AND "failed_attempts" = 5)
    ),
    CONSTRAINT "portal_links_revoke_pair" CHECK (("revoked_at" IS NULL) = ("revoke_reason" IS NULL)),
    CONSTRAINT "portal_links_revoked_by_needs_revoked" CHECK ("revoked_by_id" IS NULL OR "revoked_at" IS NOT NULL)
);

CREATE UNIQUE INDEX "portal_links_key_hash_key" ON "portal_links"("key_hash");
CREATE UNIQUE INDEX "portal_links_id_organization_id_key" ON "portal_links"("id", "organization_id");
CREATE UNIQUE INDEX "portal_links_id_customer_id_key" ON "portal_links"("id", "customer_id");
CREATE INDEX "portal_links_organization_id_customer_id_created_at_idx" ON "portal_links"("organization_id", "customer_id", "created_at");
-- Mỗi học viên tối đa MỘT đường dẫn chưa thu hồi. Chỉ mục có điều kiện: Prisma không ghi được (chú thích ở model).
CREATE UNIQUE INDEX "portal_links_one_live_per_customer" ON "portal_links"("customer_id") WHERE "revoked_at" IS NULL;

ALTER TABLE "portal_links" ADD CONSTRAINT "portal_links_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_links" ADD CONSTRAINT "portal_links_customer_id_organization_id_fkey"
    FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_links" ADD CONSTRAINT "portal_links_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_links" ADD CONSTRAINT "portal_links_revoked_by_id_fkey"
    FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Không đổi chủ / chìa, không gỡ thu hồi, không gỡ khoá.
CREATE FUNCTION portal_links_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."organization_id" <> OLD."organization_id" OR NEW."customer_id" <> OLD."customer_id" OR NEW."key_hash" <> OLD."key_hash" THEN
    RAISE EXCEPTION 'Không đổi được học viên hoặc chìa của đường dẫn cổng' USING ERRCODE = '23514';
  END IF;
  IF OLD."revoked_at" IS NOT NULL AND NEW."revoked_at" IS NULL THEN
    RAISE EXCEPTION 'Đường dẫn đã thu hồi không mở lại được' USING ERRCODE = '23514';
  END IF;
  IF OLD."locked_at" IS NOT NULL AND NEW."locked_at" IS NULL THEN
    RAISE EXCEPTION 'Đường dẫn đã khoá không mở khoá được' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER portal_links_guard BEFORE UPDATE ON "portal_links" FOR EACH ROW EXECUTE FUNCTION portal_links_guard();

-- ===== Máy đã mở =====
CREATE TABLE "portal_devices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    -- Tên máy do MÁY CHỦ đọc từ User-Agent ("iPhone · Safari"), không nhận từ máy khách.
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "end_reason" "PortalDeviceEndReason",
    "ended_by_id" UUID,
    "end_note" TEXT,
    "handoff_hash" TEXT,
    "handoff_expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "portal_devices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "portal_devices_label_len" CHECK (char_length("label") BETWEEN 1 AND 80),
    CONSTRAINT "portal_devices_end_pair" CHECK (("ended_at" IS NULL) = ("end_reason" IS NULL)),
    -- Chặn / thu hồi phải có người làm; tự thoát thì không có.
    CONSTRAINT "portal_devices_staff_end_has_actor" CHECK (
        "end_reason" IS NULL OR "end_reason" = 'SIGNED_OUT' OR "ended_by_id" IS NOT NULL
    ),
    -- Bẫy sổ lỗi 24: "ended_by_id IS NULL OR end_reason <> 'SIGNED_OUT'" sẽ cho qua khi end_reason NULL → viết rõ IS NOT NULL.
    CONSTRAINT "portal_devices_actor_only_staff_end" CHECK (
        "ended_by_id" IS NULL OR ("end_reason" IS NOT NULL AND "end_reason" <> 'SIGNED_OUT')
    ),
    CONSTRAINT "portal_devices_note_only_ended" CHECK (
        "end_note" IS NULL OR ("ended_at" IS NOT NULL AND char_length("end_note") <= 200)
    ),
    CONSTRAINT "portal_devices_handoff_pair" CHECK (("handoff_hash" IS NULL) = ("handoff_expires_at" IS NULL)),
    CONSTRAINT "portal_devices_handoff_sha256" CHECK ("handoff_hash" IS NULL OR "handoff_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "portal_devices_handoff_only_live" CHECK ("handoff_hash" IS NULL OR "ended_at" IS NULL)
);

CREATE UNIQUE INDEX "portal_devices_id_organization_id_key" ON "portal_devices"("id", "organization_id");
CREATE UNIQUE INDEX "portal_devices_id_customer_id_key" ON "portal_devices"("id", "customer_id");
CREATE INDEX "portal_devices_link_id_idx" ON "portal_devices"("link_id");
CREATE INDEX "portal_devices_organization_id_customer_id_created_at_idx" ON "portal_devices"("organization_id", "customer_id", "created_at");

ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_customer_id_organization_id_fkey"
    FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_link_id_organization_id_fkey"
    FOREIGN KEY ("link_id", "organization_id") REFERENCES "portal_links"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Máy phải thuộc ĐÚNG học viên của đường dẫn (database tự chặn).
ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_link_id_customer_id_fkey"
    FOREIGN KEY ("link_id", "customer_id") REFERENCES "portal_links"("id", "customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_ended_by_id_fkey"
    FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lưới cuối: tối đa 2 máy mỗi đường dẫn. Khoá dòng đường dẫn trước khi đếm để hai lần mở đồng thời xếp hàng.
CREATE FUNCTION portal_devices_max_per_link() RETURNS trigger AS $$
DECLARE n INTEGER;
BEGIN
  PERFORM 1 FROM "portal_links" WHERE "id" = NEW."link_id" FOR UPDATE;
  SELECT count(*) INTO n FROM "portal_devices" WHERE "link_id" = NEW."link_id";
  IF n >= 2 THEN
    RAISE EXCEPTION 'Mỗi đường dẫn cổng học viên mở tối đa 2 máy' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER portal_devices_max_per_link BEFORE INSERT ON "portal_devices" FOR EACH ROW EXECUTE FUNCTION portal_devices_max_per_link();

-- Không đổi chủ / đường dẫn; máy đã kết thúc không sống lại.
CREATE FUNCTION portal_devices_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."organization_id" <> OLD."organization_id" OR NEW."customer_id" <> OLD."customer_id" OR NEW."link_id" <> OLD."link_id" THEN
    RAISE EXCEPTION 'Không đổi được học viên hoặc đường dẫn của máy' USING ERRCODE = '23514';
  END IF;
  IF OLD."ended_at" IS NOT NULL AND NEW."ended_at" IS NULL THEN
    RAISE EXCEPTION 'Máy đã chặn / đã thoát không mở lại được' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER portal_devices_guard BEFORE UPDATE ON "portal_devices" FOR EACH ROW EXECUTE FUNCTION portal_devices_guard();

-- ===== Phiên =====
CREATE TABLE "portal_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "portal_sessions_token_hash_sha256" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "portal_sessions_expires_after_created" CHECK ("expires_at" > "created_at")
);

CREATE UNIQUE INDEX "portal_sessions_token_hash_key" ON "portal_sessions"("token_hash");
CREATE INDEX "portal_sessions_device_id_idx" ON "portal_sessions"("device_id");

ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_customer_id_organization_id_fkey"
    FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_device_id_organization_id_fkey"
    FOREIGN KEY ("device_id", "organization_id") REFERENCES "portal_devices"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_device_id_customer_id_fkey"
    FOREIGN KEY ("device_id", "customer_id") REFERENCES "portal_devices"("id", "customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Không tạo phiên cho máy đã kết thúc; phiên đã thu hồi không sống lại; không đổi chủ / máy / thẻ.
CREATE FUNCTION portal_sessions_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM "portal_devices" WHERE "id" = NEW."device_id" AND "ended_at" IS NOT NULL) THEN
      RAISE EXCEPTION 'Máy đã chặn / đã thoát' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."device_id" <> OLD."device_id" OR NEW."customer_id" <> OLD."customer_id"
     OR NEW."organization_id" <> OLD."organization_id" OR NEW."token_hash" <> OLD."token_hash" THEN
    RAISE EXCEPTION 'Không đổi được chủ của phiên cổng' USING ERRCODE = '23514';
  END IF;
  IF OLD."revoked_at" IS NOT NULL AND NEW."revoked_at" IS NULL THEN
    RAISE EXCEPTION 'Phiên đã thu hồi không mở lại được' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER portal_sessions_guard BEFORE INSERT OR UPDATE ON "portal_sessions" FOR EACH ROW EXECUTE FUNCTION portal_sessions_guard();

-- ===== Cài đặt cổng (số tài khoản) — bảng RIÊNG, không nằm trong hồ sơ thương hiệu công khai =====
CREATE TABLE "portal_settings" (
    "organization_id" UUID NOT NULL,
    "bank_name" TEXT,
    -- Chỉ chữ số (web hiện cách nhóm 4 số).
    "bank_account_no" TEXT,
    "bank_account_name" TEXT,
    "updated_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "portal_settings_pkey" PRIMARY KEY ("organization_id"),
    CONSTRAINT "portal_settings_bank_all_or_none" CHECK (
        ("bank_name" IS NULL) = ("bank_account_no" IS NULL) AND ("bank_account_no" IS NULL) = ("bank_account_name" IS NULL)
    ),
    CONSTRAINT "portal_settings_account_no_digits" CHECK ("bank_account_no" IS NULL OR "bank_account_no" ~ '^[0-9]{6,20}$'),
    CONSTRAINT "portal_settings_bank_name_len" CHECK ("bank_name" IS NULL OR char_length("bank_name") BETWEEN 2 AND 80),
    CONSTRAINT "portal_settings_account_name_len" CHECK ("bank_account_name" IS NULL OR char_length("bank_account_name") BETWEEN 2 AND 80)
);

ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Ghi chú cho thợ gói E1:
- Trigger dùng `ERRCODE '23514'` nhưng **không** đăng ký vào `NAMED_CHECK_TRIGGERS` (`apps/api/src/http/middleware.ts:186-189`). Đây là lưới cuối, chạm tới nghĩa là máy chủ có lỗi. Người dùng nhận 400 lời chung, log ghi "Database chặn dữ liệu sai".
- Sau khi viết `schema.prisma`, chạy `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <database thử riêng>`. Chỉ được còn lệch phần Prisma không biểu diễn được: chỉ mục có điều kiện và 4 trigger. Tên chỉ mục và khoá ngoại trong SQL phải trùng tên Prisma tự sinh.
- Bài thử muốn giả "hết hạn" thì lùi **cả** `created_at` lẫn `expires_at` (CHECK `expires_at > created_at`).

### 3.3 Prisma (`apps/api/prisma/schema.prisma`, thêm cuối tệp)

```prisma
// ==================== CỔNG HỌC VIÊN (bản vẽ E) ====================

enum PortalLinkRevokeReason {
  REPLACED
  REVOKED
}

enum PortalDeviceEndReason {
  SIGNED_OUT
  BLOCKED
  LINK_REVOKED
}

// Đường dẫn gửi học viên. Chỉ lưu sha256 của chìa. Mỗi học viên tối đa MỘT đường dẫn chưa thu hồi: chỉ mục duy nhất CÓ ĐIỀU
// KIỆN portal_links_one_live_per_customer (customer_id) WHERE revoked_at IS NULL viết tay trong migration 20261019140000 —
// Prisma không ghi được. Trigger portal_links_guard: không đổi chủ/chìa, không gỡ thu hồi/khoá.
model PortalLink {
  id             String                  @id @default(uuid()) @db.Uuid
  organizationId String                  @map("organization_id") @db.Uuid
  customerId     String                  @map("customer_id") @db.Uuid
  keyHash        String                  @unique @map("key_hash")
  createdById    String                  @map("created_by_id") @db.Uuid
  createdAt      DateTime                @default(now()) @map("created_at") @db.Timestamptz(3)
  expiresAt      DateTime                @map("expires_at") @db.Timestamptz(3)
  firstOpenedAt  DateTime?               @map("first_opened_at") @db.Timestamptz(3)
  failedAttempts Int                     @default(0) @map("failed_attempts")
  lockedAt       DateTime?               @map("locked_at") @db.Timestamptz(3)
  revokedAt      DateTime?               @map("revoked_at") @db.Timestamptz(3)
  revokeReason   PortalLinkRevokeReason? @map("revoke_reason")
  revokedById    String?                 @map("revoked_by_id") @db.Uuid

  organization Organization   @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  customer     Customer       @relation(fields: [customerId, organizationId], references: [id, organizationId], onDelete: Restrict)
  createdBy    User           @relation("PortalLinkCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  revokedBy    User?          @relation("PortalLinkRevokedBy", fields: [revokedById], references: [id], onDelete: Restrict)
  devices      PortalDevice[]
  devicesOfCustomer PortalDevice[] @relation("PortalDeviceLinkOfCustomer")

  @@unique([id, organizationId])
  @@unique([id, customerId])
  @@index([organizationId, customerId, createdAt])
  @@map("portal_links")
}

// Một máy (một kho trình duyệt) đã mở cổng. Tối đa 2 máy mỗi đường dẫn (trigger portal_devices_max_per_link).
// Kết thúc (ended_at) thì không sống lại (trigger portal_devices_guard).
model PortalDevice {
  id               String                 @id @default(uuid()) @db.Uuid
  organizationId   String                 @map("organization_id") @db.Uuid
  customerId       String                 @map("customer_id") @db.Uuid
  linkId           String                 @map("link_id") @db.Uuid
  label            String
  createdAt        DateTime               @default(now()) @map("created_at") @db.Timestamptz(3)
  lastSeenAt       DateTime               @default(now()) @map("last_seen_at") @db.Timestamptz(3)
  endedAt          DateTime?              @map("ended_at") @db.Timestamptz(3)
  endReason        PortalDeviceEndReason? @map("end_reason")
  endedById        String?                @map("ended_by_id") @db.Uuid
  endNote          String?                @map("end_note")
  handoffHash      String?                @map("handoff_hash")
  handoffExpiresAt DateTime?              @map("handoff_expires_at") @db.Timestamptz(3)

  organization       Organization    @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  customer           Customer        @relation(fields: [customerId, organizationId], references: [id, organizationId], onDelete: Restrict)
  link               PortalLink      @relation(fields: [linkId, organizationId], references: [id, organizationId], onDelete: Restrict)
  // Máy phải thuộc ĐÚNG học viên của đường dẫn (database tự chặn).
  linkOfCustomer     PortalLink      @relation("PortalDeviceLinkOfCustomer", fields: [linkId, customerId], references: [id, customerId], onDelete: Restrict)
  endedBy            User?           @relation("PortalDeviceEndedBy", fields: [endedById], references: [id], onDelete: Restrict)
  sessions           PortalSession[]
  sessionsOfCustomer PortalSession[] @relation("PortalSessionDeviceOfCustomer")

  @@unique([id, organizationId])
  @@unique([id, customerId])
  @@index([linkId])
  @@index([organizationId, customerId, createdAt])
  @@map("portal_devices")
}

// Thẻ phiên cổng (cookie mp_portal, chuỗi "mpp_…"). Chỉ lưu sha256. Hết hạn trượt 90 ngày theo lần dùng.
model PortalSession {
  id             String    @id @default(uuid()) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  customerId     String    @map("customer_id") @db.Uuid
  deviceId       String    @map("device_id") @db.Uuid
  tokenHash      String    @unique @map("token_hash")
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  lastUsedAt     DateTime  @default(now()) @map("last_used_at") @db.Timestamptz(3)
  expiresAt      DateTime  @map("expires_at") @db.Timestamptz(3)
  revokedAt      DateTime? @map("revoked_at") @db.Timestamptz(3)

  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  customer         Customer     @relation(fields: [customerId, organizationId], references: [id, organizationId], onDelete: Restrict)
  device           PortalDevice @relation(fields: [deviceId, organizationId], references: [id, organizationId], onDelete: Restrict)
  deviceOfCustomer PortalDevice @relation("PortalSessionDeviceOfCustomer", fields: [deviceId, customerId], references: [id, customerId], onDelete: Restrict)

  @@index([deviceId])
  @@map("portal_sessions")
}

// Cài đặt cổng của tổ chức. Số tài khoản: đủ cả 3 hoặc trống cả 3 (CHECK). Bảng riêng để không bao giờ lên trang công khai.
model PortalSettings {
  organizationId  String   @id @map("organization_id") @db.Uuid
  bankName        String?  @map("bank_name")
  bankAccountNo   String?  @map("bank_account_no")
  bankAccountName String?  @map("bank_account_name")
  updatedById     String   @map("updated_by_id") @db.Uuid
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  updatedBy    User         @relation("PortalSettingsUpdatedBy", fields: [updatedById], references: [id], onDelete: Restrict)

  @@map("portal_settings")
}
```

Quan hệ ngược phải thêm:
- `Organization`: `portalLinks PortalLink[]`, `portalDevices PortalDevice[]`, `portalSessions PortalSession[]`, `portalSettings PortalSettings?`.
- `Customer`: `portalLinks PortalLink[]`, `portalDevices PortalDevice[]`, `portalSessions PortalSession[]`.
- `User`: `portalLinksCreated PortalLink[] @relation("PortalLinkCreatedBy")`, `portalLinksRevoked PortalLink[] @relation("PortalLinkRevokedBy")`, `portalDevicesEnded PortalDevice[] @relation("PortalDeviceEndedBy")`, `portalSettingsUpdated PortalSettings[] @relation("PortalSettingsUpdatedBy")`.

### 3.4 Hằng số và kiểu dùng chung: `packages/shared/src/portal.ts` (mới, export ở `index.ts`)

```ts
export const PORTAL_LINK_TTL_DAYS = 7;          // đường dẫn chưa mở
export const PORTAL_MAX_DEVICES = 2;            // mỗi đường dẫn
export const PORTAL_MAX_FAILED = 5;             // sai 4 số
export const PORTAL_SESSION_DAYS = 90;          // nhớ máy, trượt
export const PORTAL_SESSION_TOUCH_MINUTES = 60; // cập nhật last_used_at tối đa mỗi 60 phút
export const PORTAL_HANDOFF_MINUTES = 10;
export const PORTAL_MAX_SESSIONS_PER_DEVICE = 3;
export const PORTAL_MIN_RESPONSE_MS = 300;
export const PORTAL_WEB_PATH = '/hv';           // đường dẫn: <origin>/hv#k=<chìa>
export const PORTAL_DENIED_MESSAGE =
  'Không mở được trang. Kiểm tra lại 4 số cuối số điện thoại, hoặc nhắn trung tâm gửi đường dẫn mới.';
export const PORTAL_SESSION_INVALID_MESSAGE = 'Phiên đã hết. Mở lại đường dẫn trung tâm gửi qua Zalo.';

// Tên gọi: chữ cuối của họ tên ("Tôn Nữ … Phương Thảo" → "Thảo"). Hai chữ cuối nếu chữ cuối chỉ 1–2 ký tự.
export function callName(fullName: string): string;
// "HĐKH-000042 Phuong Thao" — bỏ dấu (NFD + đ→d), chỉ [A-Za-z0-9 -], tối đa 50 ký tự.
export function transferNote(contractCode: string, fullName: string): string;
// "iPhone · Safari", "Android · Chrome", "iPhone · Zalo", "Máy tính · Chrome", "Máy khác · Trình duyệt" — ≤ 80 ký tự.
export function deviceLabelFromUserAgent(ua: string | undefined): string;
// Tin nhắn dán Zalo (web ghép, máy chủ không gửi):
export function portalMessage(p: { callName: string; centerName: string; url: string }): string;
// = `Chào ${callName}, đây là trang học viên của em tại ${centerName} (lịch học, học phí, nội quy, ảnh):\n${url}\n`
//   + 'Mở bằng điện thoại của em và nhập 4 số cuối số điện thoại đã đăng ký. Đường dẫn chưa mở sẽ hết hạn sau 7 ngày. '
//   + 'Đường dẫn này chỉ dành cho em, đừng chuyển cho người khác nhé.'

export interface PortalMe { /* đúng như mục 4.2 */ }
export interface PortalAdminView { /* đúng như mục 4.3 */ }
```

Quyền mới trong `packages/shared/src/permissions.ts`:
- `'portal.manage': 'Gửi, thu hồi đường dẫn cổng học viên; xem, chặn máy đã mở'`.
- Thêm vào vai trò mẫu `manager` và `receptionist`. `owner`/`admin` tự có vì dùng `ALL_PERMISSIONS`.
- Sau khi lên máy: chạy `db:sync-roles` cho tổ chức đang có.

---

## 4. Máy chủ

### 4.1 Khung scope `'portal'` (gói E2)

**`apps/api/src/http/route.ts`**
- `Scope` thêm `'portal'`. `rateLimit` thêm `'portal'`.
- `HandlerCtx` thêm `portal: PortalContext | null`, với `PortalContext = { organizationId: string; customerId: string; deviceId: string; sessionId: string }`. Thêm `mustPortal(ctx)`, cùng khuôn với `mustOrg`.
- Hằng `PORTAL_PUBLIC_ROUTES = ['POST /portal/session', 'POST /portal/session/claim'] as const`.
- Luật mới trong `defineRoute` (sai → ném lỗi lúc khởi động):
  1. `scope === 'portal'`: đường phải bắt đầu `/portal/`; **không có `:`**; không `params`, không `query`; không `permission`, không `idempotent`; thân không có thuộc tính tên khớp `/Ids?$/` ở bất kỳ độ sâu nào. Dò bằng `z.toJSONSchema`, chép cách đi của `test/gate.ts:87-110` vào `route.ts`, **không** nhập từ thư mục test.
  2. Đường bắt đầu `/portal/` mà scope không phải `portal`: chỉ được là `public` **và** nằm trong `PORTAL_PUBLIC_ROUTES` **và** khai `rateLimit: 'portal'`. Ngoài ra là lỗi.
  3. Scope `auth`/`org`/`platform` mà đường bắt đầu `/portal/` → lỗi.

**`apps/api/src/app.ts`**
- Thêm `portalLimiter` (`rateLimit`, cửa sổ 60 giây, `deps.env.PORTAL_RATE_LIMIT_PER_MINUTE`, `standardHeaders: 'draft-8'`, handler `limited`).
- Ở dòng chọn xác thực (`:123`) đổi thành: `public → null`; `platform → platformAdminOrNotFound`; **`portal → authenticatePortal(req, deps)` (userId = null, portal = ctx)**; còn lại → `authenticate`.
- `ALL_ROUTES` thêm `...portalRoutes` (từ `modules/portal/routes.ts`).

**`apps/api/src/http/middleware.ts`**: trong `authenticate`, ngay sau khi lấy header:
```ts
const raw = header.slice(7);
// Thẻ phiên cổng học viên (mpp_…) KHÔNG BAO GIỜ là thẻ nhân viên — từ chối trước khi đụng jwt (bản vẽ E 2.3).
if (raw.startsWith('mpp_')) throw new AppError('UNAUTHENTICATED', 'Thẻ đăng nhập không hợp lệ');
```

**`apps/api/src/env.ts`**: `PORTAL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10)`. Thêm dòng vào `apps/api/.env.example`.

**`apps/api/src/http/openapi.ts:41`**: scope `portal` → `security: [{ portalCookie: [] }]`; khai `components.securitySchemes.portalCookie = { type: 'apiKey', in: 'cookie', name: 'mp_portal' }`.

**`apps/api/src/lib/logger.ts`**: thêm `'*.key'`, `'*.last4'`, `'*.code'` vào `redact.paths`.

**`apps/api/src/modules/portal/tokens.ts`** (mới):
```ts
newLinkKey(): { key: string; hash: string }        // randomBytes(32).base64url (43 ký tự)
newSessionToken(): { token: string; hash: string } // 'mpp_' + randomBytes(32).base64url
newHandoffCode(): { code: string; hash: string }   // 8 ký tự bảng 31 chữ/số; hiện "ABCD-EFGH"; băm dạng đã bỏ gạch, chữ hoa
sha256Hex(s: string): string
```

**`apps/api/src/modules/portal/cookie.ts`** (mới): `PORTAL_COOKIE = 'mp_portal'`, `PORTAL_COOKIE_PATH = '/api/v1/portal'`, `portalCookie(token)` (`CookieInstruction`, `maxAgeMs` = 90 ngày), `CLEAR_PORTAL_COOKIE`, `readPortalCookie(req)`. Tự tách header `cookie` giống `transport.ts:19-27`. Hỏng dạng → `null`, không ném.

**`apps/api/src/modules/portal/auth.ts`** (mới), `authenticatePortal(req, deps): Promise<PortalContext>`:
1. Có header `authorization` → 401. `x-client !== 'portal'` → 401.
2. Cookie phải khớp `/^mpp_[A-Za-z0-9_-]{43}$/`, không khớp → 401.
3. Tra `portalSession` theo `tokenHash`, kèm `device.endedAt`, `organization.status`. Phiên không có, `revokedAt` có, `expiresAt <= now`, hoặc `device.endedAt` có → 401 `PORTAL_SESSION_INVALID_MESSAGE`, `details.reason = 'PORTAL_SESSION_INVALID'`.
4. `organization.status !== 'ACTIVE'` → 403 `'Trang học viên đang tạm đóng. Vui lòng liên hệ trung tâm.'`.
5. Nếu `lastUsedAt` cũ hơn 60 phút: **một** transaction cập nhật `session.lastUsedAt = now`, `session.expiresAt = now + 90 ngày`, `device.lastSeenAt = now`.
6. Trả `PortalContext`.

**`apps/api/src/modules/portal/routes.ts`** (mới): `export const portalRoutes = [...studentPortalRoutes, ...centerPortalRoutes];`. Gói E2 tạo sẵn `student-routes.ts` và `center-routes.ts` với mảng rỗng, để E3 và E4 mỗi gói điền đúng tệp của mình.

### 4.2 Đường của học viên (gói E3): `modules/portal/student-routes.ts`, `redeem.ts`, `handoff.ts`, `me.ts`

Mọi phản hồi của 5 đường này đặt `Cache-Control: no-store` qua `req.res?.setHeader(...)`, tag OpenAPI `'Cổng học viên'`.

#### `POST /portal/session` (public, `rateLimit: 'portal'`): mở bằng đường dẫn

- Thân: `{ key: z.string().min(1).max(200), last4: z.string().regex(/^\d{4}$/) }`.
- Luồng (một transaction, **không ném lỗi bên trong**, trả về kết quả rồi mới quyết):
```
start = now
if header x-client !== 'portal' → deny (không audit)
link = SELECT … FROM portal_links WHERE key_hash = sha256(key) FOR UPDATE   (kèm customer.phone, organization.status)
if !link: so timingSafeEqual(last4, '0000'); deny (không audit)
reason =
   org.status !== 'ACTIVE'                         → ORG_SUSPENDED
   link.revokedAt                                  → REVOKED
   link.lockedAt                                   → LOCKED
   link.firstOpenedAt == null && now >= expiresAt  → EXPIRED
   count(devices of link) >= 2                     → FULL
   last4 của chuẩn hoá(customer.phone) không có    → NO_PHONE
   !timingSafeEqual(last4, phoneLast4)             → WRONG_DIGITS
if reason == WRONG_DIGITS:
   UPDATE portal_links SET failed_attempts = failed_attempts + 1,
          locked_at = CASE WHEN failed_attempts + 1 >= 5 THEN now() ELSE NULL END
   WHERE id = link.id AND locked_at IS NULL
   audit portal.open_rejected {reason}; nếu vừa khoá: audit portal.link_locked
if reason: audit portal.open_rejected {reason} (trừ WRONG_DIGITS đã ghi) → commit → deny
else:
   UPDATE link SET failed_attempts = 0, first_opened_at = COALESCE(first_opened_at, now())
   INSERT portal_devices (label = deviceLabelFromUserAgent(req.header('user-agent')))
   INSERT portal_sessions (token_hash, expires_at = now + 90 ngày)
   audit portal.device_added → commit
await sleep(max(0, 300 - (now - start)))
deny → throw AppError('UNAUTHENTICATED', PORTAL_DENIED_MESSAGE, { reason: 'PORTAL_DENIED' })
ok   → { status: 201, body: { ok: true }, cookies: [portalCookie(token)] }
```
- Trình duyệt này đã có phiên cổng sống cũ: thu hồi phiên cũ trong cùng transaction (một trình duyệt giữ một phiên).
- Không bao giờ trả tên học viên, tên trung tâm hay bất cứ gì khác trong phản hồi của đường này.

#### `POST /portal/session/claim` (public, `rateLimit: 'portal'`): nhận phiên bằng mã chuyển máy

- Thân: `{ code: z.string().min(1).max(20) }`. Chuẩn hoá: bỏ khoảng trắng và `-`, đổi thành chữ hoa.
- Tìm `portal_devices` theo `handoff_hash = sha256(code)` với `FOR UPDATE`. Hợp lệ khi `handoff_expires_at > now`, `ended_at` trống, tổ chức ACTIVE. Hợp lệ thì: đặt `handoff_hash = NULL, handoff_expires_at = NULL`; nếu máy đã có ≥ 3 phiên sống, thu hồi phiên có `last_used_at` cũ nhất; tạo phiên mới; audit `portal.handoff_claimed`.
- Cùng lời chung, cùng sàn 300 ms như đường trên.

#### `POST /portal/session/handoff` (scope `portal`): tạo mã chuyển sang app

- Không thân. Đặt `handoff_hash`, `handoff_expires_at = now + 10 phút` trên máy của phiên (ghi đè mã cũ). Audit `portal.handoff_created`.
- 201 `{ code: "ABCD-EFGH", expiresAt }`.

#### `DELETE /portal/session` (scope `portal`): "Thoát khỏi máy này"

- Một transaction: `device.ended_at = now, end_reason = 'SIGNED_OUT'`, xoá mã chuyển, thu hồi **mọi** phiên của máy. Audit `portal.signed_out`.
- 204 + `CLEAR_PORTAL_COOKIE`.

#### `GET /portal/me` (scope `portal`): toàn bộ dữ liệu một trang

Mọi câu truy vấn có `organizationId: p.organizationId`, và có `customerId: p.customerId` ở bảng mang cột đó. Dữ liệu lớp và buổi học đi qua `courseClassId ∈ {lớp của ghi danh ACTIVE của mình}`. Thân trả về (kiểu đặt ở `packages/shared/src/portal.ts`):

```ts
interface PortalMe {
  center: { name: string;               // OrganizationProfile.brandName ?? Organization.name
            logoUrl: string | null;     // URL ký 10 phút
            phone: string | null; zalo: string | null; address: string | null };
  bank: { bankName: string; accountNo: string; accountName: string } | null;  // portal_settings, đủ 3 trường mới trả
  student: { fullName: string; callName: string; avatarUrl: string | null };
  device: { label: string; openedAt: string };                               // máy của phiên
  timezone: string;                                                          // Organization.timezone
  serverTime: string;
  enrollments: {
    courseName: string; className: string; classStatus: 'OPEN' | 'CLOSED' | 'CANCELLED';
    startDate: string; endDate: string;           // 'YYYY-MM-DD'
    weekdays: number[]; startTime: string | null; endTime: string | null;     // 'HH:MM' từ startMinute/endMinute
    sessionCount: number | null;                  // Course.sessionCount
    instructor: { name: string; avatarUrl: string | null } | null;           // StaffProfile.displayName — KHÔNG phone
    location: { name: string; address: string | null; latitude: number | null; longitude: number | null } | null;
    contractCode: string;
    sessions: { date: string; startsAt: string; endsAt: string;
                status: 'SCHEDULED' | 'DONE' | 'CANCELLED' }[];              // [] khi lớp chưa sinh buổi học
  }[];
  contracts: {
    code: string; status: 'CONFIRMED' | 'COMPLETED'; confirmedAt: string | null;
    lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];  // dòng chưa huỷ
    subtotal: number; discount: number; total: number;
    paid: number; remaining: number;                                          // summarizePayments
    installments: { name: string; dueDate: string; amount: number; isDeposit: boolean;
                    paidAmount: number; status: 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE' }[];  // allocateToInstallments
    receipts: { code: string; kind: 'RECEIPT' | 'REFUND';
                method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER'; amount: number; receivedAt: string }[];  // chưa huỷ
    terms: string | null; rules: string | null;                               // bản chụp lúc xác nhận
    transferNote: string;                                                     // transferNote(code, fullName)
  }[];
  cards: { kind: 'WELCOME' | 'FEEDBACK'; createdAt: string; className: string | null;
           url: string; urlExpiresAt: string; width: number | null; height: number | null }[];
}
```

Luật chọn dữ liệu:

| Phần | Điều kiện |
|---|---|
| `enrollments` | `Enrollment.status = 'ACTIVE'`, `customerId` = mình. Sắp theo `startDate` giảm dần. |
| `sessions` | `Appointment.kind = 'COURSE_SESSION'`, `courseClassId` = lớp, `organizationId` = mình, `status ∉ {DRAFT, PENDING_CONFIRMATION}`. Đổi trạng thái: CONFIRMED / IN_PROGRESS → `SCHEDULED`; COMPLETED → `DONE`; CANCELLED / NO_SHOW → `CANCELLED`. Sắp theo `startsAt`. **Phụ thuộc K2** (`20261019120000_buoi_hoc_len_lich`). Lớp chưa sinh buổi thì trả `[]` và web hiện lịch theo thứ và giờ. **Không tự tính buổi dự kiến.** |
| `contracts` | `kind = 'COURSE'`, `customerId` = mình, `status ∈ {CONFIRMED, COMPLETED}`. Không có DRAFT, không có CANCELLED. |
| `cards` | `kind ∈ {WELCOME, FEEDBACK}`, `customerId` = mình, `deletedAt` trống, `outputFileId` có, tệp `status = 'READY'` và `deletedAt` trống. URL ký bằng `signedUrlOf`. Không có GREETING. |
| Tiền | `BigInt` → `number` theo cách các module tiền đang làm. |

Phản hồi đặt lại cookie (`portalCookie(token)`) để trượt hạn cookie cùng với hạn phiên. Token lấy lại từ cookie đã đọc ở `authenticatePortal`: thêm `rawToken` vào `PortalContext` nhưng **không** in ra log.

### 4.3 Đường phía trung tâm (gói E4): `modules/portal/center-routes.ts`, `center.ts`

Mọi đường: scope `org`, tổ chức phải `kind = 'ACADEMY'` (403 `ACADEMY_REQUIRED`, khuôn `courses/service.ts:82-86`), tag `'Cổng học viên'`. Thứ tự kiểm: **tìm bản ghi trong tổ chức trước** (không có → 404 `'Không tìm thấy khách hàng'` / `'Không tìm thấy máy'`), rồi mới kiểm điều kiện nghiệp vụ. Vì vậy mã của tổ chức khác luôn ra 404, như cửa gác `crossId` đòi.

| Đường | Quyền | Thân | Trả về |
|---|---|---|---|
| `GET /orgs/:orgId/customers/:customerId/portal` | `portal.manage` | — | 200 `PortalAdminView` |
| `POST /orgs/:orgId/customers/:customerId/portal/links` | `portal.manage` + kiểm thêm `customers.read`, `contracts.read`, `payments.read` (thiếu → 403, `details.required`) | `{ phoneConfirmed: z.literal(true) }` | 201 `{ key, expiresAt, callName, centerName, view: PortalAdminView }` |
| `POST /orgs/:orgId/customers/:customerId/portal/revoke` | `portal.manage` | `{ reason: z.string().trim().min(1).max(200) }` | 200 `{ devicesEnded: number, view }` |
| `POST /orgs/:orgId/portal-devices/:deviceId/block` | `portal.manage` | `{ reason: z.string().trim().min(1).max(200) }` | 200 `{ view }` (view của học viên sở hữu máy) |

- **Tạo đường dẫn**, kiểm theo thứ tự:
  1. Khách có trong tổ chức (không có → 404).
  2. Tổ chức là ACADEMY.
  3. `customer.phone` có và đủ ≥ 4 chữ số; nếu không → 409 `'Học viên chưa có số điện thoại — thêm số trước khi gửi đường dẫn'`.
  4. Một transaction: khoá `SELECT … FROM customers WHERE id = … FOR UPDATE`; thu hồi link chưa thu hồi (`revoke_reason = 'REPLACED'`, `revoked_by_id` = người làm; máy đã mở **giữ nguyên**); tạo link mới (`expires_at = now + 7 ngày`); audit `portal.link_created`.
  - **Không khai `idempotent`** (luật 2.2.5). Chìa chỉ xuất hiện trong phản hồi này, một lần.
  - Không đòi học viên phải có hợp đồng khoá học. Web nhắc nếu chưa có (mục 5.2).
- **Thu hồi**: thu hồi link chưa thu hồi (`REVOKED`); với **mọi** máy chưa kết thúc của học viên: `ended_at, end_reason = 'LINK_REVOKED', ended_by_id, end_note = reason`, xoá mã chuyển; thu hồi mọi phiên sống của học viên. Audit `portal.link_revoked`. Học viên không có link nào → vẫn 200, `devicesEnded` đếm thật.
- **Chặn máy**: tìm `portalDevice` theo `id` **và** `organizationId`. Máy đã kết thúc → 409 `'Máy này đã bị chặn hoặc đã thoát'`. Nếu không: `BLOCKED` + thu hồi phiên của máy + audit `portal.device_blocked`.

```ts
interface PortalAdminView {
  eligible: { ok: boolean; reasons: ('NOT_ACADEMY' | 'NO_PHONE')[] };
  phoneLast4: string | null;                 // nhắc nhân viên đối chiếu
  hasCourseContract: boolean;                // có hợp đồng khoá học CONFIRMED/COMPLETED
  link: null | {
    status: 'ACTIVE' | 'EXPIRED' | 'LOCKED' | 'FULL' | 'REVOKED';  // link mới nhất
    createdAt: string; createdByName: string; expiresAt: string; firstOpenedAt: string | null;
    failedAttempts: number; devicesUsed: number;
  };
  devices: { id: string; label: string; createdAt: string; lastSeenAt: string;
             status: 'ACTIVE' | 'BLOCKED' | 'SIGNED_OUT' | 'LINK_REVOKED';
             endedAt: string | null; endedByName: string | null }[];  // mọi máy của học viên, mới nhất trước, tối đa 20
  limits: { linkTtlDays: 7; maxDevices: 2; maxFailed: 5; rememberDays: 90 };
}
```
`status` của link, xét theo thứ tự: `REVOKED` (có `revokedAt`) → `LOCKED` → `EXPIRED` (chưa mở và quá hạn) → `FULL` (≥ 2 máy) → `ACTIVE`. Phản hồi **không bao giờ** có `keyHash`, `tokenHash`, `handoffHash`.

### 4.4 Cài đặt cổng (gói E4): `modules/portal/settings.ts` (đăng ký trong `center-routes.ts`)

| Đường | Quyền | Thân / trả |
|---|---|---|
| `GET /orgs/:orgId/portal-settings` | `org.read` | 200 `{ bankName, bankAccountNo, bankAccountName, updatedAt }`. Chưa có dòng → mọi trường `null`. |
| `PUT /orgs/:orgId/portal-settings` | **`org.update`** | `{ bankName: string \| null, bankAccountNo: string \| null, bankAccountName: string \| null }`: **bắt buộc đủ 3 khoá** (thân rỗng → 400). Đủ cả 3 hoặc `null` cả 3 (lệch → 400 `'Điền đủ ngân hàng, số tài khoản, chủ tài khoản — hoặc để trống cả ba'`). Số tài khoản bỏ khoảng trắng, dấu chấm, gạch rồi phải là 6–20 chữ số. Tên chủ tài khoản đổi thành chữ hoa, bỏ dấu. Upsert + audit `portal.settings_updated` có `before`/`after`. |

### 4.5 Tóm tắt các đường

| Đường | Scope | Gói |
|---|---|---|
| `POST /portal/session` | public (`rateLimit: 'portal'`) | E3 |
| `POST /portal/session/claim` | public (`rateLimit: 'portal'`) | E3 |
| `POST /portal/session/handoff` | portal | E3 |
| `DELETE /portal/session` | portal | E3 |
| `GET /portal/me` | portal | E3 |
| `GET /orgs/:orgId/customers/:customerId/portal` | org | E4 |
| `POST /orgs/:orgId/customers/:customerId/portal/links` | org | E4 |
| `POST /orgs/:orgId/customers/:customerId/portal/revoke` | org | E4 |
| `POST /orgs/:orgId/portal-devices/:deviceId/block` | org | E4 |
| `GET /orgs/:orgId/portal-settings` | org | E4 |
| `PUT /orgs/:orgId/portal-settings` | org | E4 |

---

## 5. Web

### 5.1 Cổng học viên `/hv` (gói W2), một trang vào riêng

- **Trang vào riêng** `apps/web/hv.html` → `src/portal/main.tsx`. Không dùng `src/app/routes.tsx`, không `SessionProvider`, không React Router (cổng chỉ có một địa chỉ).
- **Cấm nhập** `src/api/client.ts`, `src/app/**`, `src/layout/**`, `src/features/**`. Được nhập `src/styles/tokens.css`, `src/pwa/**` (gói W1) và những thành phần trong `src/ui/` không kéo theo gì của app nhân viên. `check-portal-bundle.mjs` (W1) chặn khi build.
- **Ngân sách:** JS của trang vào `hv` tối đa **90 KB gzip** (kể cả React). Tệp CSS cổng tối đa 15 KB gzip.
- **Máy khách** `src/portal/api.ts`: `fetch('/api/v1/portal/…', { credentials: 'same-origin', headers: { 'X-Client': 'portal', Accept: 'application/json' } })`. **Không bao giờ** đặt `Authorization`, không gọi `/api/v1/auth`.

**Máy trạng thái** `src/portal/PortalApp.tsx`:

```
khởi động: key = đọc '#k=' từ location.hash (khuôn ResetPasswordPage.tsx:12-15)
  GET /portal/me
    200 → [Trang]           (có key thì xoá # bằng history.replaceState — KHÔNG gọi mở lần nữa, không tốn suất)
    401 + có key → [Nhập 4 số]
    401 + không key → [Chưa có phiên]
    403 → [Tạm đóng]
[Nhập 4 số] → POST /portal/session {key, last4}
    201 → xoá # → GET /portal/me → [Trang]
    401 → giữ màn, xoá 4 ô, hiện PORTAL_DENIED_MESSAGE (dải đỏ)
    429 → "Thử quá nhiều lần, vui lòng đợi một phút"
[Chưa có phiên] → nút "Tôi có mã chuyển sang app" → ô 8 ký tự → POST /portal/session/claim → 201 → [Trang]
[Trang] → bất kỳ 401 nào → [Chưa có phiên]; quay lại trang (visibilitychange) sau ≥ 8 phút → tải lại /me (URL ảnh sống 10 phút)
"Thoát khỏi máy này" → hỏi lại → DELETE /portal/session → [Chưa có phiên] kèm dòng "Đã thoát khỏi máy này."
```

**Màn và chữ** (khổ 390 là chính; 1440 dùng cột trái neo mục như ảnh `hv-B-trang-1440.png`):

| Màn | Bám ảnh | Nội dung bắt buộc |
|---|---|---|
| Nhập 4 số | `hv-B-mo-may-moi-390.png` | Đầu trang **chung** "Trang học viên", không có logo trung tâm (mục 8). Tiêu đề "Mở trang học viên". Dòng "Đường dẫn này dành riêng cho một học viên. Nhập **4 số cuối số điện thoại** em đã đăng ký với trung tâm." 4 ô số (`inputmode="numeric"`, `autocomplete="off"`, tự nhảy ô, dán 4 số được). Nút chính "Mở trang của tôi" (khoá khi chưa đủ 4 số hoặc đang gửi). Dòng cố định "Nhập sai nhiều lần, đường dẫn sẽ bị khoá. Không phải em? Đóng trang này và báo trung tâm." **Không** có ô "Nhớ máy này". |
| Cảnh báo trong Zalo | — | User-Agent có `Zalo`: dải vàng trên nút "Em đang mở trong Zalo. Để lần sau mở nhanh, bấm ⋯ → Mở bằng trình duyệt." Vẫn cho bấm "Mở trang của tôi". |
| Lỗi | `hv-B-sai-khoa-390.png` (chỉ trạng thái 1, **bỏ** dòng "Còn 2 lần") | Dải đỏ đúng `PORTAL_DENIED_MESSAGE`. Không có màn "đã khoá" riêng (luật 2.5). |
| Chưa có phiên | — | "Mở trang học viên bằng đường dẫn trung tâm gửi qua Zalo." + nút phụ "Tôi có mã chuyển sang app". |
| Trang | `hv-B-trang-390.png`, `hv-B-trang-hoc-phi-390.png` | Theo thứ tự: đầu trang (logo, tên trung tâm, "Chào {callName}") → hàng chip neo (Lịch học, Học phí, Nội quy, Ảnh, Hợp đồng; chỉ hiện chip có dữ liệu) → **Buổi học tới** (buổi `SCHEDULED` gần nhất, "Buổi n/N" khi có `sessionCount`, nút "Chỉ đường" mở `https://www.google.com/maps/dir/?api=1&destination=lat,lng` khi có toạ độ) → **Học phí** (Tổng phải đóng / Đã đóng / Còn lại + thanh tiến độ; đợt `OVERDUE` thì dải vàng "Đợt … còn thiếu …") → **Tiến độ đóng tiền** (các đợt) → **Đã đóng** (phiếu) → **Cách đóng tiền** (khi `bank` có: ngân hàng, số tài khoản có nút "Chép", chủ tài khoản, nội dung = `transferNote` có nút "Chép", dòng "Chuyển xong trung tâm sẽ ghi phiếu thu, số Đã đóng cập nhật sau khi trung tâm xác nhận.") → **Lịch học** (khoá, lớp, thứ + giờ, thời gian, giảng viên, địa điểm; có `sessions` thì liệt kê từng buổi kèm nhãn Đã qua / Hôm nay / Huỷ; không có thì không liệt kê) → **Nội quy** (`rules`, giữ xuống dòng) → **Ảnh của tôi** (lưới 2 cột; bấm mở to; nút "Lưu vào Ảnh": `navigator.share({ files })` khi `navigator.canShare` cho phép, nếu không thì mở ảnh ở thẻ mới kèm chữ "Nhấn giữ ảnh để lưu") → **Hợp đồng** (mã, ngày ký, dòng, giảm, phải đóng; "Điều khoản hợp đồng" mở/thu `terms`) → **Liên hệ** (gọi `tel:`, nhắn `https://zalo.me/<số>`) → thẻ **Cài lên màn hình chính** (mục 5.3) → chân trang "Đang mở trên {device.label} · Thoát khỏi máy này" và "Chạy trên Makeup Pro". |
| Nhiều hợp đồng / lớp | — | Mỗi hợp đồng một khối Học phí; chip đầu trang theo tên khoá. Chưa có hợp đồng nào: "Trung tâm chưa có hợp đồng khoá học nào cho em." |
| Tiêu đề | — | Sau khi có `/me`: `document.title = center.name` và đặt `<meta name="apple-mobile-web-app-title">` = `center.name` (tên dưới biểu tượng khi học viên cài). |

Tiền định dạng `1.000.000 ₫`, ngày theo `timezone` của trung tâm. Không thêm thư viện ngày.

### 5.2 Phía trung tâm (gói W3)

**Thẻ "Cổng học viên"** (`src/features/customers/PortalCard.tsx`) đặt trong `CustomerDetail.tsx`, ngay **sau** thẻ Hợp đồng. Chỉ hiện khi tổ chức là ACADEMY **và** người xem có `portal.manage`. Bám ảnh `hv-B-trung-tam-gui-1440.png` và `-390.png`.

| Trạng thái | Hiện |
|---|---|
| Không đủ điều kiện (`NO_PHONE`) | Nút "Tạo đường dẫn" bị khoá + "Thêm số điện thoại cho học viên trước." |
| Chưa có link / link REVOKED, EXPIRED, LOCKED | Thẻ trạng thái (Chưa gửi / Đã thu hồi / Hết hạn / Bị khoá vì nhập sai 5 lần) + nút chính **"Tạo đường dẫn"**. `hasCourseContract = false` → dải xám "Học viên chưa có hợp đồng khoá học đã xác nhận — trang sẽ trống." |
| Hộp xác nhận tạo | Ô tick bắt buộc "Tôi đã đối chiếu số điện thoại đuôi **{phoneLast4}** với học viên". Nút "Tạo" khoá khi chưa tick hoặc đang gửi. |
| Vừa tạo xong | Hộp tin nhắn (chữ từ `portalMessage({ callName, centerName, url: location.origin + '/hv#k=' + key })`) + nút chính **"Sao chép tin nhắn"** (`navigator.clipboard.writeText`; không có thì chọn sẵn chữ) + dải vàng "Tin này chỉ hiện **một lần**. Đóng đi thì phải tạo đường dẫn mới." Chìa chỉ giữ trong state của component, không đưa vào URL hay localStorage. |
| Link ACTIVE / FULL | Thẻ trạng thái "Đang mở" / "Đủ 2 máy", "Tạo lúc …, hết hạn … nếu chưa mở", nút phụ "Tạo đường dẫn mới" (hỏi lại: "Đường dẫn cũ sẽ thôi nhận máy mới. Máy đã mở vẫn dùng được."). |
| Máy đã mở `(n/2)` | Mỗi dòng: tên máy, "Mở lần đầu … · lần cuối …", trạng thái. Máy ACTIVE có nút **"Chặn máy này"** (hỏi lại + ô lý do, điền sẵn "Học viên báo mất máy"). |
| Chân thẻ | Nút đỏ **"Thu hồi đường dẫn và chặn mọi máy"** (hỏi lại + ô lý do, điền sẵn "Đường dẫn bị lộ"). Dòng xám "Đường dẫn chưa mở hết hạn sau 7 ngày. Nhập sai 4 số cuối 5 lần là khoá, trung tâm phải tạo đường dẫn mới." |

**Khác bản mẫu, có chủ đích:** bản mẫu `b-nv` hiện tin nhắn mọi lúc. Vì máy chủ chỉ giữ bản băm, tin chỉ hiện ngay sau khi tạo.

**Cài đặt → Cổng học viên** (`src/features/portal-settings/PortalSettingsPage.tsx`, đường `/:orgSlug/cai-dat/cong-hoc-vien`, mục con nav quyền `org.update`): ba ô Ngân hàng, Số tài khoản, Chủ tài khoản; nút "Lưu"; khung xem trước thẻ "Cách đóng tiền" giống cổng. Tổ chức không phải ACADEMY: "Tổ chức chưa bật đào tạo".

**Cài đặt → Cài app lên điện thoại** (`src/features/portal-settings/InstallAppPage.tsx`, đường `/:orgSlug/cai-dat/cai-app`, quyền `org.read`): dùng `InstallGuide` của W1 cho app nhân viên.

### 5.3 PWA cho cả app nhân viên và cổng (gói W1)

| Tệp | Nội dung |
|---|---|
| `apps/web/index.html` | Thêm `<link rel="manifest" href="/manifest.webmanifest">`, `<meta name="theme-color" content="#A63D62">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="apple-mobile-web-app-title" content="Makeup Pro">`. **Không** thêm `viewport-fit=cover` (khung hiện tại chưa xử lý vùng tai thỏ). |
| `apps/web/hv.html` (mới) | Như trên nhưng: `manifest` → `/hv/manifest.webmanifest`, `theme-color` `#2F7D72`, `apple-touch-icon` → `/icons/hv-apple-touch-icon.png`, title "Trang học viên", script `/src/portal/main.tsx`. W1 tạo `src/portal/main.tsx` **tạm** (hiện "Đang dựng"), W2 thay. |
| `apps/web/public/manifest.webmanifest` | `{ "id": "/", "name": "Makeup Pro", "short_name": "Makeup Pro", "lang": "vi", "start_url": "/", "scope": "/", "display": "standalone", "background_color": "#F6F4F2", "theme_color": "#A63D62", "icons": [192, 512, 512 maskable] }` |
| `apps/web/public/hv/manifest.webmanifest` | `{ "id": "/hv", "name": "Trang học viên", "short_name": "Học viên", "start_url": "/hv", "scope": "/hv", "display": "standalone", "background_color": "#F6F4F2", "theme_color": "#2F7D72", "icons": [hv-192, hv-512, hv-512 maskable] }` |
| `apps/web/public/icons/` | `icon.svg` (nền `#A63D62`, chữ "M" trắng, Be Vietnam Pro 700 từ `public/fonts/be-vietnam-pro`), `hv-icon.svg` (nền `#2F7D72`, chữ "HV" trắng). PNG: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (chữ nằm trong vùng an toàn 80%), `apple-touch-icon.png` 180×180, cùng bộ `hv-*`. Mỗi tệp dưới 40 KB. |
| `apps/web/scripts/make-icons.mjs` | Dựng PNG từ SVG bằng Chromium của `@playwright/test` (đã có trong devDependencies). Chạy tay, nộp PNG vào kho. |
| `apps/web/public/sw.js` | Service worker **tối thiểu**, một tệp cho cả hai, phạm vi `/` (luật bên dưới) |
| `apps/web/public/offline.html` | Trang nhẹ, tự chứa CSS: "Không có mạng. Kiểm tra kết nối rồi thử lại." + nút "Thử lại" |
| `apps/web/src/pwa/registerSW.ts` | Chỉ đăng ký khi `import.meta.env.PROD` và có `'serviceWorker' in navigator`; `navigator.serviceWorker.register('/sw.js', { scope: '/' })`; lỗi thì nuốt và ghi `console.warn` |
| `apps/web/src/pwa/platform.ts` | `isIOS()`, `isStandalone()` (`matchMedia('(display-mode: standalone)')` hoặc `navigator.standalone`), `isZaloInApp()` (`/Zalo/i` trong UA), `isIOSSafari()` |
| `apps/web/src/pwa/useInstallPrompt.ts` | Bắt `beforeinstallprompt` (Android Chrome) |
| `apps/web/src/pwa/InstallGuide.tsx` | Hướng dẫn 4 bước theo ảnh `ip-1-huong-dan-cai-390.png`: (1) mở bằng **Safari**, (2) nút Chia sẻ, (3) "Thêm vào MH chính", (4) mở biểu tượng mới. Prop `variant: 'staff' \| 'portal'`. Variant `portal` thêm bước "Mở app, bấm **Tôi có mã chuyển sang app**, nhập mã" kèm nút "Lấy mã chuyển sang app" (prop `onGetHandoffCode`). Android có prompt thì hiện nút "Cài app". Đang trong Zalo: chỉ hiện "Mở bằng trình duyệt trước". Đã standalone: không hiện. |
| `apps/web/src/main.tsx` | Gọi `registerServiceWorker()` sau `createRoot(...).render` |
| `apps/web/vite.config.ts` | `build.rollupOptions.input = { main: 'index.html', hv: 'hv.html' }`; `build.manifest = true`; plugin nhỏ `configureServer` + `configurePreviewServer` đổi `/hv` và `/hv/` (không đuôi tệp) sang `/hv.html` để chạy thử được. Giữ nguyên `chunkFileNames`. |
| `apps/web/scripts/vercel-config.mjs` + `vercel.json` | Rewrite thêm, **trước** `/(.*)`: `{ "source": "/hv", "destination": "/hv.html" }`, `{ "source": "/hv/(.*)", "destination": "/hv.html" }`. Vercel phục vụ tệp có thật (`/hv/manifest.webmanifest`) trước khi xét rewrite. Thêm `headers`: `/sw.js` → `Cache-Control: no-cache` + `Service-Worker-Allowed: /`; `/(.*).webmanifest` → `Content-Type: application/manifest+json`. |
| `apps/web/scripts/check-portal-bundle.mjs` + `.test.ts` | Đọc `dist/.vite/manifest.json`. Lấy mọi tệp JS mà trang vào `hv.html` kéo theo (cả import tĩnh lẫn động). **Đỏ** khi: tổng gzip > 90 KB; có module nguồn thuộc `src/api/client.ts`, `src/app/`, `src/layout/`, `src/features/`; chứa chuỗi `BYPASS`, `SUPER_ADMIN`, `accessToken=`, `Authorization`. Có vế GIỮ: bản build thật → thoát mã 0. |
| `apps/web/package.json` | `build` thêm `&& node scripts/check-portal-bundle.mjs` |

**Luật `sw.js`** (bắt buộc; không có thông báo đẩy):
```js
const VERSION = 'mp-sw-1';              // đổi khi sửa tệp
const ASSETS = `assets-${VERSION}`;
self.addEventListener('install', (e) => { e.waitUntil(caches.open(ASSETS).then((c) => c.add('/offline.html'))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(/* xoá cache khác ASSETS */ …); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;            // KHÔNG BAO GIỜ chạm dữ liệu (riêng tư, máy dùng chung)
  if (req.mode === 'navigate') { e.respondWith(fetch(req).catch(() => caches.match('/offline.html'))); return; }  // không cache HTML
  if (url.pathname.startsWith('/assets/')) { e.respondWith(/* cache-first: tệp có mã băm, không đổi */ …); return; }
});
// THÔNG BÁO ĐẨY: GIAI ĐOẠN SAU (mục 5.4). Không thêm listener 'push' / 'notificationclick' ở bản này.
```

### 5.4 Thông báo đẩy: GIAI ĐOẠN SAU (chỉ ghi chỗ cắm)

Không làm ở bản vẽ này. Khi làm sẽ cần:
- Bảng `push_subscriptions` (người nhận là thành viên **hoặc** máy cổng, endpoint, khoá, lúc tạo, lúc gửi được gần nhất, lúc huỷ) và cặp khoá VAPID trong `env.ts`.
- Listener `push` / `notificationclick` trong `sw.js`, nút bật/tắt.
- Thử trên iPhone thật iOS 16.4 trở lên, đã cài lên màn hình chính (nguồn: báo cáo chặng 1 mục 2.1).

---

## 6. Bài thử bắt buộc

Mỗi thợ dùng database thử riêng `makeup_test_e<số gói>` (`TEST_DATABASE_URL`, `apps/api/test/global-setup.ts:6-11`). **Không đụng `makeup_dev`.** Mỗi chốt mới phải phá thử → thấy đỏ → khôi phục (khuôn thợ K1, `docs/SECURITY.md:77`). Kịch bản phá ghi trong báo cáo của gói, không lưu kho.

### 6.1 Database (E1): `apps/api/test/cong-hoc-vien-database.test.ts`

Ghi **thẳng database** (`$executeRaw`), không qua API. Mỗi ca dưới đây phải bị từ chối:
- `key_hash` / `token_hash` / `handoff_hash` không phải 64 ký tự hex (thử chìa base64url 43 ký tự).
- `failed_attempts = 6`; `locked_at` có mà `failed_attempts = 3`; `failed_attempts = 5` mà `locked_at` NULL.
- `revoked_at` có mà `revoke_reason` NULL, và ngược lại; `revoked_by_id` có mà `revoked_at` NULL.
- `ended_at` có mà `end_reason` NULL; `end_reason = 'BLOCKED'` mà `ended_by_id` NULL; **`ended_by_id` có mà `end_reason` NULL** (bẫy sổ lỗi 24); `ended_by_id` có với `SIGNED_OUT`.
- `handoff_hash` có mà `handoff_expires_at` NULL; mã chuyển trên máy đã kết thúc.
- Máy trỏ link của **học viên khác** cùng tổ chức (khoá ngoại `(link_id, customer_id)`); máy của **tổ chức khác**; phiên trỏ máy của học viên khác.
- Máy thứ 3 cho cùng link (trigger); hai link chưa thu hồi cho cùng học viên (chỉ mục có điều kiện).
- Gỡ thu hồi / gỡ khoá / đổi `customer_id` của link; gỡ `ended_at` của máy; tạo phiên cho máy đã kết thúc.
- `portal_settings` có 2 trên 3 trường; số tài khoản có chữ.

Vế GIỮ: dòng hợp lệ của từng bảng ghi được. Có thêm một ca đua: 5 lệnh `INSERT` máy đồng thời cho cùng link → đúng 2 thành công.

### 6.2 Máy chủ

**E2, `apps/api/test/cong-hoc-vien-khung.test.ts`**
- `defineRoute` từ chối: scope `portal` có `:id`; có `query`; thân có `customerId`; thân có `items[].contractIds`; khai `permission`; đường không bắt đầu `/portal/`; `public` dưới `/portal/` ngoài danh sách cho phép; `public` dưới `/portal/` thiếu `rateLimit: 'portal'`; scope `org` dưới `/portal/`.
- `Bearer mpp_<43 ký tự>` ở `/auth/me` → 401 và **không** có truy vấn database nào (spy trên `deps.db.user.findUnique`).
- Đường `portal` thử, đăng ký qua `createApp(deps, routes)`: không cookie → 401; có `Authorization` → 401; thiếu `X-Client` → 401.
- `PORTAL_RATE_LIMIT_PER_MINUTE=2` → lần thứ 3 bị 429.
- OpenAPI có `portalCookie`.

**E3, `apps/api/test/cong-hoc-vien-vao.test.ts`**
1. Đúng 4 số → 201; `Set-Cookie: mp_portal=mpp_…; Path=/api/v1/portal; HttpOnly; SameSite=Strict`; thân chỉ `{ ok: true }`; `GET /portal/me` → 200.
2. **Chống dò:** chìa không có, sai 4 số, link đã thu hồi, hết hạn, đã khoá, đủ 2 máy, khách đã xoá SĐT, thiếu `X-Client` → **cùng** status, **cùng** thân (bỏ `requestId`), **cùng tập tên header** (bỏ `date`, `x-request-id`, `ratelimit*`, `etag`, `content-length`). Mỗi lần mất ≥ 290 ms.
3. Sai 4 lần rồi đúng → vào được, `failed_attempts` về 0. Sai 5 lần → `locked_at`; đúng sau đó → từ chối. **GIỮ:** máy mở trước khi khoá vẫn 200.
4. Hết hạn: link chưa mở, lùi `created_at` / `expires_at` → từ chối. Link đã mở một máy, lùi quá 7 ngày → máy thứ hai vẫn vào được (theo quyết định).
5. Giới hạn máy: máy 1 và 2 vào được, máy 3 từ chối. Đua 5 yêu cầu đồng thời đúng 4 số → đúng 2 thành công.
6. Mở lại cùng đường dẫn trên trình duyệt **đang có phiên** (web gọi `/me` trước) không tạo máy mới. Gọi thẳng `POST /portal/session` lần nữa thì phiên cũ của trình duyệt bị thu hồi, chỉ còn một phiên sống.
7. Thu hồi (đi đường thật của E4): mọi máy → 401 ở yêu cầu kế tiếp; link → từ chối. Chặn một máy → máy đó 401, máy kia vẫn 200.
8. Tạo đường dẫn mới → link cũ từ chối, máy cũ vẫn 200.
9. Thoát máy → 401; cookie bị xoá; suất máy vẫn tính.
10. Phiên: `expires_at` lùi → 401. `last_used_at` cũ hơn 60 phút → sau `/me`, `expires_at` ≈ now + 90 ngày.
11. Chuyển sang app: mã → phiên mới, `devicesUsed` không đổi. Mã dùng lần 2 / quá 10 phút / máy đã chặn → lời chung. Phiên thứ 4 trên một máy → phiên cũ nhất bị thu hồi.
12. Tổ chức bị khoá → `/me` 403; mở khoá → 200.
13. **Không lộ:** sau khi tạo, mở, chuyển máy: quét toàn văn bảng `portal_links`, `portal_devices`, `portal_sessions`, `audit_logs`, `idempotency_keys`, và log (logger bắt vào mảng) → không chứa chìa, thẻ `mpp_`, mã chuyển, hay `last4`.
14. Audit: đủ các action ở 2.7, `actorUserId = null` với sự kiện của học viên, `organizationId` đúng.

**E3, `apps/api/test/cong-hoc-vien-du-lieu.test.ts`**
1. `/me` trả đúng: lớp; buổi học sau khi gọi `POST /orgs/:orgId/classes/:classId/sessions/sync` của K2; chỉ hợp đồng CONFIRMED/COMPLETED; đợt + đã đóng/còn lại khớp `summarizePayments` / `allocateToInstallments`; phiếu đã huỷ không hiện; `rules` là bản chụp (sửa mẫu sau không đổi); chỉ ảnh WELCOME/FEEDBACK của mình (GREETING, thẻ đã xoá, tệp DELETED không hiện); `bank` có khi đủ 3 trường, `null` khi trống.
2. **Cách ly:** hai bạn **cùng lớp** A1, A2 ở tổ chức A, mỗi người một hợp đồng, phiếu, thẻ; T1 ở tổ chức B. `/me` của A1 không chứa: tên, mã hợp đồng, mã phiếu của A2; tên lớp hay hợp đồng của B; email chủ; số điện thoại giảng viên (đặt chuỗi bí mật vào `StaffProfile.phone`); `Customer.note`, `Contract.notes`, `Payment.note`, `voidReason` (đặt chuỗi bí mật `BI-MAT-<uuid>`). **Không có UUID** trong thân, sau khi bỏ giá trị các trường tên kết thúc bằng `Url`.
3. Lớp chưa sinh buổi → `sessions: []`.

**E4, `apps/api/test/cong-hoc-vien-trung-tam.test.ts`**
1. Tạo → 201, `key` dài 43 ký tự; database chỉ có `sha256(key)`; `GET` trạng thái không có `key` hay hash; tạo lần 2 → link 1 `REVOKED/REPLACED`.
2. Quyền: thiếu `portal.manage` → 403. Vai trò tuỳ chỉnh có `portal.manage` + `customers.read` + `contracts.read` mà **thiếu `payments.read`** → 403, `details.required` chứa `payments.read`. Quản lý, lễ tân → được. Thợ, giảng viên → 403.
3. Thiếu `phoneConfirmed` → 400; khách không có SĐT → 409; tổ chức TEAM → 403 `ACADEMY_REQUIRED`.
4. Thu hồi → mọi máy kết thúc `LINK_REVOKED`, `ended_by_id` = người làm, audit có `reason`. Chặn máy đã chặn → 409.
5. Cài đặt: thiếu 1 trên 3 trường → 400; số tài khoản có chữ → 400; quản lý (không có `org.update`) → 403; audit có before/after; `GET /public/sites/:slug` **không** chứa số tài khoản.
6. `syncSystemRoles` → vai trò `manager` và `receptionist` của tổ chức cũ có `portal.manage`.
- Khi E3 chưa xong, máy và phiên dựng bằng ghi thẳng Prisma (bản băm tự sinh). Khi E3 xong, thêm một ca đi qua `POST /portal/session` thật.

### 6.3 Cửa gác cách ly mở rộng (E5)

Tệp: `apps/api/test/gate.ts`, `gate-samples.ts`, `gate-portal.ts` (mới), `tenant-isolation.test.ts`, `gate-mutants.test.ts`.

- **Dựng:** trong `setupOrg` (`gate.ts:178-339`) gọi `seedPortal(app, db, org)` của `gate-portal.ts`. Hàm này tạo khách `portalCustomerId` có SĐT, gọi đường E4 tạo link, gọi đường E3 mở bằng 4 số. Thêm vào `ids`: `portalCustomerId`, `deviceId`. Thêm vào `GateOrg`: `portal: { cookie: string; token: string }`. Thêm `buildPortalWorld(app, db, fx)` dựng A1, A2 (cùng lớp), T1 như 6.2 E3 mục 2.
- **Mẫu** (`SAMPLES`): `'POST /orgs/:orgId/customers/:customerId/portal/links': () => ({ phoneConfirmed: true })`, `…/portal/revoke: () => ({ reason: 'Thử cửa gác' })`, `'POST /orgs/:orgId/portal-devices/:deviceId/block': () => ({ reason: 'Thử cửa gác' })`. Phép `keep` với thân rỗng → 400 ở cả ba (zod chạy trước handler, `app.ts:133-144`).
- **Bốn phép mới** (`GateReport` từ 10 lên **14** phép; in tử số/mẫu số như cũ):

| Phép | Chọn đường | Kiểm |
|---|---|---|
| `portalScope` | Theo **địa chỉ** (`/portal/…`) **và** theo **nhãn** (`scope === 'portal'`) | Đường `/portal/` phải là `portal`, hoặc `public` trong danh sách cho phép có `rateLimit: 'portal'`. Đường `portal` không có `:`, không có `query`, không có trường `…Id(s)` (dùng `refFieldPaths`). |
| `portalWall` | Mọi đường `auth`/`org`/`platform` × 2 cách cầm (cookie cổng + `X-Client: portal`; `Bearer <thẻ mpp_>`) ; mọi đường `portal` × 4 cách cầm (`Bearer` chủ A; cookie `mp_refresh` + `X-Client: web`; cookie cổng thiếu `X-Client`; cookie cổng **kèm** `Authorization`) | Đường nhân viên: 401 (platform: 404 giống hệt đường bịa). Đường cổng: 401. |
| `portalLeak` | Mọi đường `portal` phương thức GET × phiên của A1, A2, T1 | Không chứa bí mật của người khác hay ghi chú nội bộ (như 6.2 E3 mục 2), không có UUID. **GIỮ:** chứa mã hợp đồng của chính mình. |
| `portalProbe` | Mọi đường public dưới `/portal/` | Bộ đầu vào hỏng (6.2 E3 mục 2; với `claim`: mã bịa, mã đã dùng, mã hết hạn, mã của máy đã chặn) → phản hồi giống hệt nhau |

- **Đột biến bắt buộc** (cùng khuôn `replace()` / `gateOn()`; số vi phạm phải > 0):

| # | Cài lỗi | Phép phải đỏ |
|---|---|---|
| 15 | Đường cổng đọc học viên từ thân (`body: { customerId }`) | `defineRoute` ném lỗi (expect `toThrow`); dựng thẳng đối tượng thì `portalScope` đỏ |
| 16 | `/portal/me` lọc thẻ thiết kế theo tổ chức, quên học viên | `portalLeak` (A1 thấy ảnh A2) |
| 17 | Một đường nhân viên (`GET /orgs/:orgId/customers`) bị gắn nhầm `scope: 'portal'` (dựng thẳng như đột biến 9) | `portalWall` và `portalScope` |
| 18 | Mở bằng 4 số: sai 4 số báo "Sai số điện thoại", chìa không có báo "Đường dẫn không tồn tại" | `portalProbe` |
| 19 | `/portal/me` trả thêm `Contract.notes` | `portalLeak` |

Phá tay (ghi trong báo cáo E3/E4, không lưu kho; mỗi cái phải làm đỏ ít nhất một bài thử ở 6.2): `authenticatePortal` quên kiểm `device.endedAt`; quên `x-client`; bỏ sàn 300 ms; thu hồi quên phiên; chặn máy tra theo `id` mà quên `organizationId`; bộ đếm sai không khoá ở lần 5; tạo link khai `idempotent: true`; `transferNote` lộ SĐT; `/me` không lọc `voidedAt`; `/me` trả hợp đồng DRAFT.

### 6.4 Chuỗi cấm và web

- E2 thêm vào `cong-hoc-vien-khung.test.ts`: grep toàn văn `apps/api/src` → không có `BYPASS`, `SUPER_ADMIN`, `accessToken=`.
- W1: `src/pwa/registerSW.test.ts` (không đăng ký ở dev; nuốt lỗi). `src/pwa/sw.test.ts` nạp `public/sw.js` trong `node:vm` với `self`/`caches`/`fetch` giả, rồi kiểm: yêu cầu `/api/v1/portal/me` → **không** gọi `respondWith`; điều hướng mất mạng → trả `/offline.html`; `/assets/x.js` → cache-first; POST → bỏ qua. `scripts/check-portal-bundle.test.ts` (vế đỏ: chèn chuỗi cấm hoặc import `client.ts` vào bản build giả; vế GIỮ: bản build thật).
- W2: `src/portal/*.test.tsx`: đọc `#k=`, xoá `#` sau khi vào; đã có phiên thì không gọi `POST /portal/session`; lỗi hiện đúng `PORTAL_DENIED_MESSAGE`, không có "còn N lần"; cảnh báo Zalo; trang đủ các mục với dữ liệu mẫu; `sessions: []` thì không có danh sách buổi; `bank: null` thì không có thẻ "Cách đóng tiền"; mọi lệnh `fetch` có `X-Client: portal` và **không** có `Authorization`. `e2e/cong-hoc-vien.spec.ts`: Playwright khổ 390 và 1440, giả API bằng `page.route`, chụp 5 ảnh vào `e2e/anh/`.
- W3: `PortalCard.test.tsx` (các trạng thái; "Sao chép tin nhắn" gọi `clipboard.writeText` đúng chữ `portalMessage`; chìa không vào URL / localStorage; ẩn khi thiếu `portal.manage` hoặc tổ chức không phải ACADEMY), `PortalSettingsPage.test.tsx` (đủ 3 hoặc trống 3).

---

## 7. Gói việc theo tệp

Luật: **không hai gói chung một tệp chạy cùng lúc.** Gói nào cần tệp của gói khác thì chờ gói đó xong. Không gói nào chạy `git`; điều phối gom tệp theo danh sách trong báo cáo của gói (sổ lỗi mục 23).

### 7.1 Danh sách gói

| Gói | Model | Tệp (chỉ gói này được sửa) | Việc | Chờ | Giờ |
|---|---|---|---|---|---|
| **E0** tra cứu | **Haiku** | không sửa tệp nào | Kiểm lại mọi `đường_dẫn:dòng` ở mục 1 sau khi K1, K2 xong; báo dòng lệch cho điều phối | K1, K2 xong | 0,5 |
| **E1** dữ liệu | **Opus** | `apps/api/prisma/migrations/20261019140000_cong_hoc_vien/migration.sql` (mới), `apps/api/prisma/schema.prisma`, `packages/shared/src/portal.ts` + `portal.test.ts` (mới), `packages/shared/src/index.ts`, `packages/shared/src/permissions.ts` (+ `permissions.test.ts` nếu đỏ), `apps/api/test/system-roles.test.ts` (chỉ khi đỏ vì quyền mới), `apps/api/test/cong-hoc-vien-database.test.ts` (mới) | Mục 3 toàn bộ; 6.1 | **K1 và K2 xong** `schema.prisma` + migrations | 4 |
| **E2** khung scope | **Opus** | `apps/api/src/http/route.ts`, `apps/api/src/app.ts`, `apps/api/src/http/middleware.ts`, `apps/api/src/env.ts`, `apps/api/.env.example`, `apps/api/src/http/openapi.ts`, `apps/api/src/lib/logger.ts`, `apps/api/src/modules/portal/{tokens,cookie,auth,routes}.ts` (mới), `apps/api/src/modules/portal/student-routes.ts` và `center-routes.ts` (mới, **mảng rỗng**, giao lại cho E3/E4), `apps/api/test/cong-hoc-vien-khung.test.ts` (mới), `apps/api/test/openapi.test.ts` (chỉ khi đỏ) | 4.1; 6.2 phần E2; 6.4 phần máy chủ | E1; **K1 xong** `app.ts`, `env.ts`, `auth/**` | 4 |
| **E3** đường học viên | **Opus** | `apps/api/src/modules/portal/{student-routes,redeem,handoff,me}.ts`, `apps/api/test/cong-hoc-vien-vao.test.ts`, `apps/api/test/cong-hoc-vien-du-lieu.test.ts`, `apps/api/test/portal-helpers.ts` (mới) | 4.2; 6.2 phần E3 | E2; **K2 xong** (đường sync buổi học) | 7 |
| **E4** đường trung tâm | **Opus** | `apps/api/src/modules/portal/{center-routes,center,settings}.ts`, `apps/api/test/cong-hoc-vien-trung-tam.test.ts` | 4.3, 4.4; 6.2 phần E4 | E2 (chạy **song song E3**) | 5 |
| **E5** cửa gác | **Opus** | `apps/api/test/gate.ts`, `apps/api/test/gate-samples.ts`, `apps/api/test/gate-portal.ts` (mới), `apps/api/test/tenant-isolation.test.ts`, `apps/api/test/gate-mutants.test.ts` | 6.3 | E3 **và** E4; **K2 xong** `gate-samples.ts` | 6 |
| **W1** PWA | **Sonnet** | `apps/web/index.html`, `apps/web/hv.html` (mới), `apps/web/src/portal/main.tsx` (**tạm**, giao W2), `apps/web/public/manifest.webmanifest`, `apps/web/public/hv/manifest.webmanifest`, `apps/web/public/icons/**`, `apps/web/public/sw.js`, `apps/web/public/offline.html`, `apps/web/src/pwa/**` (mới), `apps/web/src/main.tsx`, `apps/web/vite.config.ts`, `apps/web/scripts/vercel-config.mjs`, `apps/web/vercel.json`, `apps/web/scripts/make-icons.mjs`, `apps/web/scripts/check-portal-bundle.mjs` + `.test.ts`, `apps/web/package.json` | 5.3; 6.4 phần W1 | không (chạy **ngay**, song song phía máy chủ) | 4 |
| **W2** màn cổng | **Sonnet** | `apps/web/src/portal/**` (thay `main.tsx` tạm của W1), `apps/web/e2e/cong-hoc-vien.spec.ts`, `apps/web/e2e/anh/cong-hoc-vien-*` | 5.1; 6.4 phần W2. Giả API theo kiểu `PortalMe`; chạy lại với máy chủ thật khi E3 xong | W1 (tệp vào + `src/pwa`); E1 (kiểu `PortalMe` trong shared) | 8 |
| **W3** màn trung tâm | **Sonnet** | `apps/web/src/api/portal.ts` (mới), `apps/web/src/features/customers/{PortalCard.tsx, PortalCard.test.tsx, CustomerDetail.tsx, logic.ts, customers.css}`, `apps/web/src/features/portal-settings/**` (mới), `apps/web/src/app/routes.tsx`, `apps/web/src/layout/nav.ts` | 5.2; 6.4 phần W3. Chạy lại với máy chủ thật khi E4 xong | W1 (`InstallGuide`); E1 (quyền `portal.manage`, `portalMessage`); **K1 xong** `routes.tsx` | 5 |
| **D1** tài liệu | **Sonnet** | `docs/SECURITY.md` (thêm chốt 37+, cửa gác 14 phép, đột biến 15–19), `docs/API_SPEC.md`, `docs/DATABASE_SCHEMA.md`, `docs/TEST_PLAN.md` | Ghi lại đúng như mã **đã chạy**, có số đo | E5, W2, W3 | 1,5 |
| **N1** nghiệm thu độc lập | **Opus** | chỉ tạo `docs/nghiem-thu/cong-hoc-vien/BIEN-BAN.md` | Tự tìm cách phá cách ly / dò / tường chắn ngoài các bài thử đã có; chạy lại cả bộ, in tử số/mẫu số; chụp ảnh 390 | toàn bộ | 3 |

**Tổng: 11 gói, khoảng 48 giờ** (khoảng 13–16 buổi thợ). Phía máy chủ + cửa gác là 26,5 giờ, web + PWA 17 giờ, tài liệu + nghiệm thu 4,5 giờ. Báo cáo chặng 1 ước 9 buổi cho cổng + 2 buổi cho PWA không có thông báo đẩy. Phần thêm so với chặng 1 nằm ở cửa gác mở rộng, mã chuyển máy và bài thử database.

### 7.2 Thứ tự và song song

```
Đợt 1 (ngay):        W1 ─────────────┐
                      (chờ K1, K2)    │
Đợt 2:               E0 → E1          │
Đợt 3:               E2               ├──► W2  (sau W1 + E1)
                                      └──► W3  (sau W1 + E1 + K1)
Đợt 4:               E3  ∥  E4             (W2, W3 vẫn chạy song song: khác tệp)
Đợt 5:               E5                    W2, W3 chạy lại với máy chủ thật
Đợt 6:               D1 → N1
```

- **Song song được:** W1 với mọi gói máy chủ. E3 với E4 (khác tệp; E4 dựng máy bằng Prisma khi E3 chưa xong). W2 với W3. W2/W3 với E2–E5.
- **Phải chờ K1** (đặt lại mật khẩu): E1 (`schema.prisma`), E2 (`app.ts`, `env.ts`, `middleware.ts`, `auth/**`), W3 (`routes.tsx`).
- **Phải chờ K2** (buổi học ↔ lớp, migration `20261019120000`): E1 (`schema.prisma`), E3 (bài thử buổi học cần đường sync), E5 (`gate-samples.ts`).
- **Không ai khác** được sửa `schema.prisma`, `route.ts`, `app.ts`, `gate.ts` trong lúc E1, E2, E5 đang chạy.

---

## 8. Cái không làm (đợt này)

- **Thông báo đẩy** (GIAI ĐOẠN SAU, mục 5.4).
- Cách vào A (email + mật khẩu) và C (OTP Zalo/SMS). Chỉ làm B.
- Điểm danh (`SessionAttendance`); tự tính buổi học dự kiến khi lớp chưa sinh buổi.
- `Payment.installmentId`: tiền vẫn dồn theo thứ tự đợt (`allocateToInstallments`).
- Học viên sửa thông tin, đóng tiền online, mã QR chuyển khoản.
- Nút ẩn từng ảnh (`DesignCard.portalVisible`). Hiện tất cả ảnh WELCOME/FEEDBACK chưa xoá.
- Logo trung tâm trên màn nhập 4 số (sẽ phải mở thêm một đường đọc theo chìa). Biểu tượng app theo logo trung tâm (manifest động). Chỉ đổi **tên** dưới biểu tượng.
- "Còn N lần thử", màn "đã khoá" riêng, ô "Nhớ máy này 90 ngày": bỏ, xem 2.5 và 5.1.
- Một trình duyệt giữ phiên của hai trung tâm cùng lúc: mở đường dẫn trung tâm thứ hai sẽ thay phiên cũ.
- Cổng cho khách dịch vụ makeup: chỉ tổ chức ACADEMY.
- Xem dữ liệu khi mất mạng: service worker không cache dữ liệu.
- Chỉnh các con số 2 / 7 / 5 / 90 theo từng trung tâm: là hằng số dùng chung.
- RLS (luật lọc theo tổ chức trong PostgreSQL).
- Thử trên iPhone thật: chưa có tên miền.

## 9. Câu hỏi còn mở cho anh

1. Đường dẫn **đã mở một máy**: cho máy thứ hai vào **không hạn** (bản vẽ đang làm theo quyết định), hay cũng hết hạn, ví dụ 30 ngày sau lần mở đầu?
2. Ảnh Feedback: hiện **tất cả** cho học viên (bản vẽ), hay cần nút ẩn từng ảnh?
3. Ai được gửi đường dẫn: bản vẽ cho **Chủ, Quản trị, Quản lý, Lễ tân**. Ai được đổi số tài khoản: chỉ **Chủ, Quản trị**. Anh có đổi không?
4. Học viên đã huỷ ghi danh: còn phiên thì **vẫn xem** hợp đồng cũ (bản vẽ). Trung tâm muốn chặn thì bấm thu hồi. Được không?
5. Khi nào có **tên miền + máy thật**? Cần có để thử cổng và cài app trên iPhone, và để biết mã chuyển sang app có thật sự cần không.
