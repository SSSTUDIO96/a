# Bản vẽ D — Trang "Hôm nay" · Loại sự kiện · Phụ phí tự động · Hợp đồng nhiều ngày (Chặng 2)

- Sản phẩm: Makeup Pro
- Ngày: 19/10/2026
- Phương án: trợ lý chọn thay anh Chiến (nhật ký /home/user/a/docs/NHAT-KY-QUYET-DINH-THAY.md dòng 93, "19/10 chiều"):
  1. **Thông báo = B**: trang "Hôm nay" (sau mới làm C bản tin trong app). **Không** gửi Zalo / SMS / Email.
  2. **Loại sự kiện = C**: danh sách studio tự đặt, gắn ở **dòng** hợp đồng; Lịch có công tắc **"Tô màu: Sự kiện / Nhân vật"**.
  3. **Phụ phí tự động = có**, dạng **luật** studio cài; khớp thì máy chủ **tự thêm dòng phụ phí**, người lập xoá / sửa được. Máy chủ tính, web không tự tính tiền.
  4. **Hợp đồng nhiều ngày = có**: máy chủ đã cho mỗi dòng một giờ riêng; web cho mỗi dòng chọn **ngày** (mặc định ngày sự kiện).
- Bản mẫu chặng 1 (nhìn để dựng màn, **không** chép số liệu):
  - /home/user/a/docs/rnd/v5-thong-bao.html `#b`, `#b-tho`; ảnh /home/user/a/docs/rnd/anh-rnd05/thong-bao-B-*
  - /home/user/a/docs/rnd/v5-su-kien.html `#c-c`, `#c-b`, `#c-a`, `#c-nv`, `#c-hd`, `#c-ds`; ảnh /home/user/a/docs/rnd/anh-rnd05/su-kien-C-*
  - Báo cáo chặng 1: /home/user/a/docs/rnd/BAO-CAO-RND-05-THONG-BAO-SU-KIEN.md
- Đi kèm, không lặp lại: /home/user/a/docs/rnd/BAN-VE-C.md (token, component, khung), /home/user/a/docs/rnd/BAN-VE-C3-DAO-TAO.md (lớp, ghi danh).

Đọc theo thứ tự: **mục 0** (mã dùng lại) → **mục 1** (database) → **mục 2** (máy chủ) → **mục 3** (web) → **mục 4** (bài thử, cửa gác) → **mục 5** (gói việc). Thợ chỉ sửa tệp trong gói của mình.

Thuật ngữ dùng trong bản vẽ:
- **Dòng đặt chỗ**: dòng hợp đồng loại `PACKAGE` hoặc `SERVICE` (dòng có giờ, nơi làm, thợ — `placement` ở schemas.ts).
- **Dòng tự thêm**: dòng `SURCHARGE` do luật sinh ra, là **dòng con** của một dòng đặt chỗ (giống dịch vụ phụ, phí di chuyển).
- **Ngày của dòng**: ngày (theo múi giờ tổ chức) của `scheduledStart`; dòng chưa có giờ thì lấy ngày sự kiện của hợp đồng.

---

## 0. Mã hiện có phải dùng lại (không viết lại)

| Thứ | Ở đâu | Dùng thế nào trong bản vẽ này |
|---|---|---|
| `defineRoute` — chốt khởi động | apps/api/src/http/route.ts:90-144 | Đường `scope: 'org'` **bắt buộc** khai `permission` và bắt đầu `/orgs/:orgId` (dòng 106-112). `idempotent` chỉ cho POST (dòng 113). PATCH có `.default()/.prefault()/.catch()` ở thân → **máy chủ không khởi động** (dòng 97-105) |
| Dò trường bị điền mặc định | apps/api/src/http/partial.ts:52 (`fieldsFilledWhenMissing`) | Mọi thân PATCH mới (loại sự kiện, luật phụ phí) **không** dùng `.default()`; mặc định để ở database |
| Tra quyền mỗi yêu cầu | apps/api/src/http/middleware.ts:35 (`loadOrgContext`) | Quyền tra từ database; `org.permissions` dùng để lọc thẻ trang Hôm nay |
| Đổi lỗi database | apps/api/src/http/middleware.ts:212 (`databaseError`), 204 (`FOREIGN_KEY_MESSAGE`) | Khoá ngoại kép bắt mã của tổ chức khác → 400 lời chung. CHECK → 400 |
| Chống gửi trùng | apps/api/src/app.ts:204-207 (header), 274 (`runIdempotent`) | POST tạo loại sự kiện, tạo luật: `idempotent: true` |
| Nhật ký thay đổi | apps/api/src/lib/audit.ts:14 (`writeAudit`) | Ghi **trong cùng transaction** với thay đổi |
| Lỗi có mã | apps/api/src/lib/errors.ts:24 (`AppError`) | `VALIDATION_FAILED` 400, `NOT_FOUND` 404, `CONFLICT` 409 |
| Trần tiền MỘT nguồn | packages/shared/src/money.ts:9 (`MAX_MONEY_VND` = 100 tỷ); apps/api/src/lib/money.ts:3-7 | Không chép số. Dòng tự thêm đi qua `assertLineCap`, tổng đi qua `assertTotalsCap` |
| Tiền là `BigInt` trong database, `Vnd` (số nguyên) ra ngoài | packages/shared/src/money.ts:2 (`Vnd`), :19 (`vndFromBigInt`) | Mọi tiền mới đọc từ database qua `vndFromBigInt` |
| Thành tiền dòng, tổng | packages/shared/src/contract.ts:74 (`computeLineTotal`), :204 (`computeContractTotals`) | Dòng tự thêm tính bằng đúng hàm này |
| Bảng tính hợp đồng duy nhất | apps/api/src/modules/contracts/sheet.ts:549 (`buildSheet`), :512 (`planLines`), :252 (`planPlaced`), :459 (`planOne`, nhánh SURCHARGE :467-487) | Luật phụ phí chạy **bên trong** `planPlaced`, sau dịch vụ phụ và phí di chuyển |
| Giá hiện hành | apps/api/src/modules/contracts/sheet.ts:147 (`priceOf`), apps/api/src/modules/catalog/prices.ts:54 (`resolveCurrentPrice`) | Giá dòng tự thêm = giá hiện hành của dịch vụ SURCHARGE |
| Kiểm dịch vụ / nhân vật thuộc tổ chức | sheet.ts:153 (`loadService`), :166 (`loadSubject`) | Mẫu cho `loadOccasion` |
| Trần dòng, trần tổng | sheet.ts:89 (`assertTotalsCap`), :95 (`assertLineCap`) | Áp cho dòng tự thêm |
| Ghi dòng | sheet.ts:603 (`insertLines`) | Thêm 5 cột mới vào `createMany` |
| Thân dòng hợp đồng | apps/api/src/modules/contracts/schemas.ts:38 (`placement`), :55 (`LineInputSchema`), :58-61 (SURCHARGE: ghi đè giá phải kèm ghi chú) | Thêm 3 trường vào `placement` |
| Nhóm dòng con | apps/api/src/modules/contracts/present.ts:217 (`GroupedLine`), :228 (`group`), :303 (`rowView`) | Thêm ngăn `surcharges` cho dòng con loại SURCHARGE |
| Sửa nháp = thay toàn bộ dòng | apps/api/src/modules/contracts/routes.ts:506 (PATCH), :572-573 (xoá dòng con trước, dòng cha sau) | Dòng tự thêm là dòng con nên xoá đúng thứ tự sẵn có |
| Thêm dòng phát sinh | routes.ts:628 | Dòng đặt chỗ thêm sau xác nhận cũng chạy luật |
| Huỷ dòng kéo theo dòng con | routes.ts:717 | Huỷ dòng gói thì huỷ luôn dòng tự thêm của nó (không phải sửa) |
| Quyền điều chỉnh sau xác nhận | routes.ts:199 (`assertCanAdjust`) | Huỷ một dòng tự thêm sau xác nhận cần `contracts.adjust` như dòng thường |
| Khoá dòng sau xác nhận | prisma/migrations/20261018160000_chot_chan_database/migration.sql:100-119 | So `to_jsonb(NEW)` với `to_jsonb(OLD)` → 5 cột mới **tự** nằm trong diện khoá, không sửa trigger |
| Chốt "loại dòng ↔ tham chiếu" | prisma/migrations/20261018230000_dao_tao/migration.sql:506-512 | Không đổi; SURCHARGE đã được có `service_id` |
| Nhân vật — mẫu cho Loại sự kiện | apps/api/src/modules/catalog/categories.ts:100-180; apps/api/src/modules/catalog/common.ts:25 (`BoolQuery`), :42 (`Name`), :45 (`SortOrder`), :85 (`strictBody`), :92 (`nonEmpty`), :97 (`withUniqueMessage`) | Chép kiểu đường, kiểu thân, kiểu báo trùng tên |
| Cài sẵn cho tổ chức mới | apps/api/src/modules/orgs/routes.ts:112-114 (nhân vật); apps/api/src/scripts/sync-system-roles.ts:55-62 (bù cho tổ chức cũ khi chưa có) | Cài 6 loại sự kiện mặc định theo đúng hai chỗ này |
| Múi giờ tổ chức | `Organization.timezone` (prisma/schema.prisma, model Organization); kiểm ở apps/api/src/modules/orgs/routes.ts:22; apps/api/src/modules/courses/sessions.ts:71 (`zonedInstant`), apps/api/src/modules/courses/present.ts:9 (`dateFromWire`), :13 (`dateToWire`), :22 (`todayIn`) | Ngày của dòng, "hôm nay", "ngày mai" đều theo múi giờ tổ chức. Đưa `zonedInstant` + một hàm mới `localDateAndMinute` vào packages/shared (mục 2.4) để hai module dùng chung |
| Lịch: dữ liệu ca + lọc "chỉ ca của mình" | apps/api/src/modules/schedule/service.ts:58 (`appointmentInclude`), :118 (`presentAppointment`); apps/api/src/modules/schedule/appointments.ts:104-137 (`read_all` / `read_own`) | Hôm nay lọc ca đúng như danh sách Lịch |
| Tiền đã thu, đợt quá hạn | packages/shared/src/payments.ts:77 (`summarizePayments`), :126 (`allocateToInstallments`); apps/api/src/modules/payments/common.ts:65 (`contractSummary`), :82 (`loadProgress` — ẩn SĐT khách khi thiếu `customers.read`) | Hôm nay tính trạng thái đợt bằng đúng hai hàm này |
| Chỗ của lớp | packages/shared/src/courses.ts:18 (`ALMOST_FULL_RATIO`), :30 (`seatState`), :36 (`seatsLeft`) | Thẻ "Lớp sắp đầy" |
| Danh mục quyền | packages/shared/src/permissions.ts:3, :61 (`SYSTEM_ROLES`) | **Không thêm quyền mới** (mục 2.1) → không cần `db:sync-roles` cho quyền (sổ lỗi 3) |
| Cửa gác cách ly | apps/api/test/gate.ts:178 (`setupOrg`), :87 (`refFieldPaths`), :462-523 (tham chiếu chéo) | Mọi đường mới, mọi trường `…Id`/`…Ids` mới phải có mẫu |
| Mẫu cửa gác | apps/api/test/gate-samples.ts:7 (`SAMPLES`), :66 (`packageLine`), :80 (`REF_SAMPLES`), :231 (`REF_VARIANTS`), :252 (`PARTIAL_SAMPLES`) | Thêm mẫu (mục 4.2) |
| Cửa gác sửa một phần | apps/api/test/gate-partial.ts | Mọi PATCH mới có mẫu `full` + `one` |
| Đột biến cửa gác | apps/api/test/gate-mutants.test.ts:34 | Thêm 3 đột biến (mục 4.3) |
| Bài thử ghi thẳng database | apps/api/test/db-guards.test.ts:103 | Mẫu cho bài thử CHECK (sổ lỗi 24) |
| Web: một ngày cho cả hợp đồng | apps/web/src/features/contracts/model.ts:337 (`lineInput`), **:359-361** (`zonedIso(eventDate, …)`), :370 (`buildBody`), :389 (`patchBody`), :401 (`placedFromView`), :423 (`draftFromDetail`), :456 (`matchQuote`), :471 (`groupTotal`) | Mục 3.4 |
| Web: điều hướng | apps/web/src/layout/nav.ts:42 (`NAV_ITEMS`), :119 (`BOTTOM_NAV`), :255 (`homeNavItem`); apps/web/src/layout/AppShell.tsx:130 (`OrgHome`) | Hôm nay là mục đầu → tự thành trang mở đầu |
| Web: màu Lịch | apps/web/src/features/schedule/model.ts:13 (`DEFAULT_MODE`), :25 (`SWATCHES`, 12 màu), :58 (`subjectSwatches`); deep link `?ngay=&ca=` ở apps/web/src/features/schedule/index.tsx:58, :91 | Màu sự kiện dùng đúng 12 tên màu này |
| Web: nhóm Bảng giá lấy từ điều hướng | apps/web/src/features/pricing/logic.ts:29, :41 (`PRICING_GROUPS` đọc con của mục `bang-gia`) | Thêm 2 mục con là có 2 nhóm mới |

---

## 1. Database

### 1.1 Tóm tắt thay đổi

| Bảng | Mới / sửa | Mục đích |
|---|---|---|
| `occasions` | **mới** | Loại sự kiện studio tự đặt (tên + màu + thứ tự + ẩn) |
| `surcharge_rules` | **mới** | Luật phụ phí |
| `surcharge_rule_targets` | **mới** | Điều kiện "loại sự kiện / gói / nhân vật" của luật (khoá ngoại kép, không dùng mảng mã) |
| `surcharge_rule_dates` | **mới** | Ngày cụ thể / ngày lễ của luật |
| `contract_lines` | thêm 5 cột | Sự kiện của dòng; dòng tự thêm theo luật nào; luật người lập đã bỏ |
| `payment_installments`, `contracts`, `enrollments` | thêm chỉ mục | Trang Hôm nay đọc nhanh theo hạn / lúc xác nhận / lúc ghi danh |

Không thêm quyền, không thêm enum, không đổi bảng `appointments` (màu ca đọc qua dòng hợp đồng, mục 2.5).

### 1.2 Dữ liệu cũ

- **Không tự đổi dòng cũ nào.** Migration chỉ thêm bảng, thêm cột cho phép NULL / mảng rỗng, thêm chỉ mục.
- Các chốt mới chỉ đụng cột mới. Dòng cũ có cột mới = NULL / `{}` nên **đạt mọi CHECK**. Vẫn phải đếm trước khi nâng cấp (sổ lỗi 22): gói H1 chạy câu đếm ở mục 1.5.
- Nghĩa của giá trị trống:

| Cột | NULL / rỗng nghĩa là |
|---|---|
| `contract_lines.occasion_id`, `occasion_name` | Dòng **chưa chọn sự kiện**. Lịch (tô theo Sự kiện) hiện "Chưa chọn sự kiện", màu `other` (nền trắng). Luật theo loại sự kiện **không** khớp |
| `contract_lines.surcharge_rule_id`, `surcharge_rule_name` | Dòng **không** do luật sinh (dòng nhập tay, mọi dòng cũ) |
| `contract_lines.dismissed_surcharge_rule_ids` = `{}` | Người lập chưa bỏ luật nào ở dòng này |
| `surcharge_rules.start_minute`, `end_minute` | Luật không xét giờ bắt đầu |
| `surcharge_rules.weekdays` = `{}` **và** không có dòng ở `surcharge_rule_dates` | Luật không xét ngày |
| `surcharge_rules.note` | Không có ghi chú |

- Hợp đồng **nháp cũ**: lần **lưu dòng** kế tiếp (PATCH có `lines`) thì luật mới chạy và có thể tự thêm dòng phụ phí. Đây là chủ đích; web báo rõ (mục 3.4). Hợp đồng đã xác nhận, đã hoàn thành, đã huỷ: **không bao giờ** bị luật chạm vào.
- Tổ chức cũ chưa có loại sự kiện nào: lệnh `db:sync-roles` (apps/api/src/scripts/sync-system-roles.ts) cài 6 loại mặc định, **chỉ khi tổ chức chưa có loại nào** (giống nhân vật). Migration **không** chèn dữ liệu.

### 1.3 Prisma (thêm vào `apps/api/prisma/schema.prisma`)

```prisma
// Loại sự kiện (ăn hỏi, lễ vu quy, lễ cưới, tiệc…) — studio tự đặt, giống MakeupSubject. Không xoá, chỉ ẩn.
// color: một trong 12 tên màu của Lịch (OCCASION_COLORS ở packages/shared; CHECK occasions_color).
model Occasion {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  name           String
  color          String
  sortOrder      Int      @default(0) @map("sort_order")
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  organization  Organization          @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  contractLines ContractLine[]
  ruleTargets   SurchargeRuleTarget[]

  @@unique([organizationId, name])
  @@unique([id, organizationId])
  @@map("occasions")
}

// Luật phụ phí: khớp thì máy chủ tự thêm một dòng SURCHARGE (dịch vụ service_id, giá theo bảng giá) làm dòng con của dòng đặt chỗ.
// Điều kiện đã điền nối bằng VÀ; trong nhóm "Ngày", thứ trong tuần và ngày cụ thể nối bằng HOẶC (mục 2.4).
// Không xoá luật (dòng hợp đồng trỏ về luật) — tắt bằng is_active.
model SurchargeRule {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  name           String
  serviceId      String   @map("service_id") @db.Uuid
  // Khung giờ BẮT ĐẦU theo múi giờ tổ chức, phút từ 0:00. Có cả hai hoặc không có cả hai (CHECK surcharge_rules_window).
  // start > end = khung qua nửa đêm (22:00–04:00).
  startMinute    Int?     @map("start_minute")
  endMinute      Int?     @map("end_minute")
  // 1 = Thứ Hai … 7 = Chủ nhật (ISO, giống CourseClass.weekdays). Rỗng = không xét thứ.
  weekdays       Int[]    @default([])
  // true: số lượng dòng tự thêm = số lượng dòng đặt chỗ (phù dâu × 2 → phụ phí × 2); false: luôn 1.
  perQuantity    Boolean  @default(true) @map("per_quantity")
  note           String?
  sortOrder      Int      @default(0) @map("sort_order")
  isActive       Boolean  @default(true) @map("is_active")
  createdById    String   @map("created_by_id") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  organization  Organization          @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  service       Service               @relation(fields: [serviceId, organizationId], references: [id, organizationId], onDelete: Restrict)
  createdBy     User                  @relation("SurchargeRuleCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  targets       SurchargeRuleTarget[]
  dates         SurchargeRuleDate[]
  contractLines ContractLine[]

  @@unique([organizationId, name])
  @@unique([id, organizationId])
  @@index([organizationId, isActive, sortOrder])
  @@map("surcharge_rules")
}

// Một điều kiện "thuộc tập" của luật: đúng MỘT trong ba mã (CHECK surcharge_rule_targets_one). Khoá ngoại kép: không trỏ chéo tổ chức.
model SurchargeRuleTarget {
  id             String  @id @default(uuid()) @db.Uuid
  organizationId String  @map("organization_id") @db.Uuid
  ruleId         String  @map("rule_id") @db.Uuid
  occasionId     String? @map("occasion_id") @db.Uuid
  packageId      String? @map("package_id") @db.Uuid
  subjectId      String? @map("subject_id") @db.Uuid

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  rule         SurchargeRule   @relation(fields: [ruleId, organizationId], references: [id, organizationId], onDelete: Cascade)
  occasion     Occasion?       @relation(fields: [occasionId, organizationId], references: [id, organizationId], onDelete: Restrict)
  package      ServicePackage? @relation(fields: [packageId, organizationId], references: [id, organizationId], onDelete: Restrict)
  subject      MakeupSubject?  @relation(fields: [subjectId, organizationId], references: [id, organizationId], onDelete: Restrict)

  @@unique([ruleId, occasionId])
  @@unique([ruleId, packageId])
  @@unique([ruleId, subjectId])
  @@map("surcharge_rule_targets")
}

// Ngày cụ thể / ngày lễ của luật (ngày theo lịch, không giờ — giống CourseClass.startDate).
model SurchargeRuleDate {
  organizationId String   @map("organization_id") @db.Uuid
  ruleId         String   @map("rule_id") @db.Uuid
  day            DateTime @db.Date

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  rule         SurchargeRule @relation(fields: [ruleId, organizationId], references: [id, organizationId], onDelete: Cascade)

  @@id([ruleId, day])
  @@map("surcharge_rule_dates")
}
```

Thêm vào model có sẵn:

```prisma
// model ContractLine — thêm trường
  // Loại sự kiện của dòng đặt chỗ + bản chụp tên lúc lưu (đổi tên loại sau không đổi hợp đồng — giống subjectName).
  occasionId                String?   @map("occasion_id") @db.Uuid
  occasionName              String?   @map("occasion_name")
  // Dòng SURCHARGE tự thêm theo luật: mã luật + bản chụp tên luật ("tự thêm theo luật …"). NULL = dòng nhập tay.
  surchargeRuleId           String?   @map("surcharge_rule_id") @db.Uuid
  surchargeRuleName         String?   @map("surcharge_rule_name")
  // Chỉ dòng đặt chỗ: luật người lập đã bỏ ở dòng này — không tự thêm lại. Không có khoá ngoại (mảng); máy chủ kiểm từng mã.
  dismissedSurchargeRuleIds String[]  @default([]) @map("dismissed_surcharge_rule_ids") @db.Uuid
// quan hệ
  occasion      Occasion?      @relation(fields: [occasionId, organizationId], references: [id, organizationId], onDelete: Restrict)
  surchargeRule SurchargeRule? @relation(fields: [surchargeRuleId, organizationId], references: [id, organizationId], onDelete: Restrict)
// chỉ mục
  @@index([occasionId])
  @@index([surchargeRuleId])

// model PaymentInstallment — thêm   @@index([organizationId, dueDate])
// model Contract           — thêm   @@index([organizationId, confirmedAt])
// model Enrollment         — thêm   @@index([organizationId, enrolledAt])
// model Organization       — thêm quan hệ: occasions Occasion[]; surchargeRules SurchargeRule[];
//                            surchargeRuleTargets SurchargeRuleTarget[]; surchargeRuleDates SurchargeRuleDate[]
// model Service, ServicePackage, MakeupSubject, User — thêm mảng quan hệ ngược tương ứng.
```

Thợ M1 chạy `prisma migrate diff` so schema với migration viết tay: **không được lệch** (chỉ mục có điều kiện ở 1.4 là ngoại lệ đã biết, ghi chú trong schema như `appointments_class_session_live_key`).

### 1.4 Migration `apps/api/prisma/migrations/20261019130000_hom_nay_su_kien_phu_phi/migration.sql`

Một tệp, viết **một lần** (sổ lỗi 14: không viết hai lần). Prisma chạy cả tệp trong một giao dịch: lỗi thì không áp dở.

```sql
-- Bản vẽ D (docs/rnd/BAN-VE-D-HOM-NAY-SU-KIEN-PHU-PHI.md): loại sự kiện, luật phụ phí, sự kiện + phụ phí tự động ở dòng hợp đồng,
-- chỉ mục cho trang "Hôm nay". KHÔNG đổi dữ liệu cũ: chỉ thêm bảng, cột NULL / mảng rỗng, chỉ mục.
-- Mọi CHECK có cột cho phép NULL viết rõ IS NOT NULL ở vế còn lại (sổ lỗi 24).

-- ---------- 1. Loại sự kiện ----------
CREATE TABLE "occasions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "occasions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "occasions_organization_id_name_key" ON "occasions"("organization_id", "name");
CREATE UNIQUE INDEX "occasions_id_organization_id_key" ON "occasions"("id", "organization_id");
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_name" CHECK (char_length("name") BETWEEN 1 AND 60 AND "name" = btrim("name"));
-- Đúng 12 tên màu của Lịch (OCCASION_COLORS ở packages/shared/src/occasions.ts = SWATCHES ở apps/web/src/features/schedule/model.ts).
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_color" CHECK ("color" IN
  ('rose','violet','amber','green','blue','taupe','brick','petrol','olive','plum','forest','brown'));
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_sort_order" CHECK ("sort_order" >= 0);

-- ---------- 2. Luật phụ phí ----------
CREATE TABLE "surcharge_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "service_id" UUID NOT NULL,
    "start_minute" INTEGER,
    "end_minute" INTEGER,
    "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "per_quantity" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "surcharge_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "surcharge_rules_organization_id_name_key" ON "surcharge_rules"("organization_id", "name");
CREATE UNIQUE INDEX "surcharge_rules_id_organization_id_key" ON "surcharge_rules"("id", "organization_id");
CREATE INDEX "surcharge_rules_organization_id_is_active_sort_order_idx" ON "surcharge_rules"("organization_id", "is_active", "sort_order");
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Khoá ngoại kép: luật chỉ trỏ được dịch vụ của CHÍNH tổ chức.
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_service_id_organization_id_fkey"
  FOREIGN KEY ("service_id", "organization_id") REFERENCES "services"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_name" CHECK (char_length("name") BETWEEN 1 AND 120 AND "name" = btrim("name"));
-- Khung giờ: không có cả hai, hoặc có cả hai và hợp lệ. start > end = qua nửa đêm. 1440 chỉ dùng cho giờ kết thúc.
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_window" CHECK (
  ("start_minute" IS NULL AND "end_minute" IS NULL)
  OR ("start_minute" IS NOT NULL AND "end_minute" IS NOT NULL
      AND "start_minute" BETWEEN 0 AND 1439
      AND "end_minute" BETWEEN 1 AND 1440
      AND "start_minute" <> "end_minute")
);
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_weekdays" CHECK (
  cardinality("weekdays") <= 7
  AND array_position("weekdays", NULL) IS NULL
  AND "weekdays" <@ ARRAY[1,2,3,4,5,6,7]
);
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_note" CHECK ("note" IS NULL OR ("note" IS NOT NULL AND char_length("note") <= 500));
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_sort_order" CHECK ("sort_order" >= 0);
-- Database KHÔNG chặn được "dịch vụ phải là SURCHARGE" (CHECK không đọc bảng khác; loại dịch vụ còn đổi được về sau):
-- máy chủ chặn lúc lưu luật và BỎ QUA luật lúc tính nếu dịch vụ đã đổi loại / ngừng (mục 2.4 bước 4).
-- "Luật có ít nhất một điều kiện giờ / ngày / sự kiện" cũng do máy chủ chặn (điều kiện nằm ở hai bảng con).

CREATE TABLE "surcharge_rule_targets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "occasion_id" UUID,
    "package_id" UUID,
    "subject_id" UUID,
    CONSTRAINT "surcharge_rule_targets_pkey" PRIMARY KEY ("id")
);
-- num_nonnulls trả số nguyên, không bao giờ NULL → không dính bẫy sổ lỗi 24.
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_one"
  CHECK (num_nonnulls("occasion_id", "package_id", "subject_id") = 1);
CREATE UNIQUE INDEX "surcharge_rule_targets_rule_id_occasion_id_key" ON "surcharge_rule_targets"("rule_id", "occasion_id");
CREATE UNIQUE INDEX "surcharge_rule_targets_rule_id_package_id_key" ON "surcharge_rule_targets"("rule_id", "package_id");
CREATE UNIQUE INDEX "surcharge_rule_targets_rule_id_subject_id_key" ON "surcharge_rule_targets"("rule_id", "subject_id");
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_rule_id_organization_id_fkey"
  FOREIGN KEY ("rule_id", "organization_id") REFERENCES "surcharge_rules"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_occasion_id_organization_id_fkey"
  FOREIGN KEY ("occasion_id", "organization_id") REFERENCES "occasions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_package_id_organization_id_fkey"
  FOREIGN KEY ("package_id", "organization_id") REFERENCES "service_packages"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_subject_id_organization_id_fkey"
  FOREIGN KEY ("subject_id", "organization_id") REFERENCES "makeup_subjects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "surcharge_rule_dates" (
    "organization_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    CONSTRAINT "surcharge_rule_dates_pkey" PRIMARY KEY ("rule_id", "day")
);
ALTER TABLE "surcharge_rule_dates" ADD CONSTRAINT "surcharge_rule_dates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_dates" ADD CONSTRAINT "surcharge_rule_dates_rule_id_organization_id_fkey"
  FOREIGN KEY ("rule_id", "organization_id") REFERENCES "surcharge_rules"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- 3. Dòng hợp đồng ----------
ALTER TABLE "contract_lines"
  ADD COLUMN "occasion_id" UUID,
  ADD COLUMN "occasion_name" TEXT,
  ADD COLUMN "surcharge_rule_id" UUID,
  ADD COLUMN "surcharge_rule_name" TEXT,
  ADD COLUMN "dismissed_surcharge_rule_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_occasion_id_organization_id_fkey"
  FOREIGN KEY ("occasion_id", "organization_id") REFERENCES "occasions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_surcharge_rule_id_organization_id_fkey"
  FOREIGN KEY ("surcharge_rule_id", "organization_id") REFERENCES "surcharge_rules"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sự kiện: có mã thì có tên chụp (và ngược lại); chỉ dòng đặt chỗ mới có sự kiện.
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_occasion" CHECK (
  ("occasion_id" IS NULL AND "occasion_name" IS NULL)
  OR ("occasion_id" IS NOT NULL AND "occasion_name" IS NOT NULL AND "kind" IN ('PACKAGE', 'SERVICE'))
);
-- Dòng tự thêm: có mã luật thì có tên luật, là dòng SURCHARGE và là dòng con.
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_auto_surcharge" CHECK (
  ("surcharge_rule_id" IS NULL AND "surcharge_rule_name" IS NULL)
  OR ("surcharge_rule_id" IS NOT NULL AND "surcharge_rule_name" IS NOT NULL
      AND "kind" = 'SURCHARGE' AND "parent_line_id" IS NOT NULL)
);
-- Luật đã bỏ: tối đa 50, không phần tử NULL, chỉ dòng đặt chỗ mới có.
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_dismissed_rules" CHECK (
  cardinality("dismissed_surcharge_rule_ids") <= 50
  AND array_position("dismissed_surcharge_rule_ids", NULL) IS NULL
  AND (cardinality("dismissed_surcharge_rule_ids") = 0 OR "kind" IN ('PACKAGE', 'SERVICE'))
);
-- Mỗi dòng đặt chỗ tối đa MỘT dòng tự thêm chưa huỷ cho mỗi luật. Chỉ mục có điều kiện — Prisma không ghi được
-- (ghi chú ở model ContractLine, giống appointments_class_session_live_key).
CREATE UNIQUE INDEX "contract_lines_one_auto_per_rule"
  ON "contract_lines"("parent_line_id", "surcharge_rule_id")
  WHERE "surcharge_rule_id" IS NOT NULL AND "voided_at" IS NULL;
CREATE INDEX "contract_lines_occasion_id_idx" ON "contract_lines"("occasion_id");
CREATE INDEX "contract_lines_surcharge_rule_id_idx" ON "contract_lines"("surcharge_rule_id");
-- Khoá dòng sau xác nhận (contract_lines_lock_after_confirm, migration 20261018160000) so to_jsonb(NEW) với to_jsonb(OLD):
-- 5 cột mới tự nằm trong diện "không được sửa sau xác nhận" — không sửa trigger.

-- ---------- 4. Chỉ mục cho trang "Hôm nay" ----------
CREATE INDEX "payment_installments_organization_id_due_date_idx" ON "payment_installments"("organization_id", "due_date");
CREATE INDEX "contracts_organization_id_confirmed_at_idx" ON "contracts"("organization_id", "confirmed_at");
CREATE INDEX "enrollments_organization_id_enrolled_at_idx" ON "enrollments"("organization_id", "enrolled_at");
```

### 1.5 Câu đếm trước khi nâng cấp (gói H1, ghi vào báo cáo)

Chạy trên **đúng** database sẽ nâng cấp (database thử của thợ; **không** chạy trên `makeup_dev`). Mọi số phải bằng 0 trước khi áp; khác 0 → dừng, báo điều phối (sổ lỗi 22).

```sql
SELECT count(*) AS bang_trung_ten FROM pg_tables WHERE tablename IN ('occasions','surcharge_rules','surcharge_rule_targets','surcharge_rule_dates');
SELECT count(*) AS cot_trung_ten FROM information_schema.columns
 WHERE table_name = 'contract_lines' AND column_name IN ('occasion_id','occasion_name','surcharge_rule_id','surcharge_rule_name','dismissed_surcharge_rule_ids');
```

Sau khi áp: `prisma migrate status` báo khớp; đếm lại 4 bảng mới = 4, 5 cột mới = 5; `SELECT count(*) FROM contract_lines WHERE occasion_id IS NOT NULL OR surcharge_rule_id IS NOT NULL OR cardinality(dismissed_surcharge_rule_ids) > 0` = **0** (dữ liệu cũ không bị đổi).

---

## 2. Máy chủ

### 2.1 Quyền (không thêm khoá quyền mới)

| Việc | Quyền | Ai có (vai trò mẫu, packages/shared/src/permissions.ts:61) |
|---|---|---|
| Xem loại sự kiện, xem luật phụ phí | `catalog.read` | mọi vai trò trừ Trợ giảng |
| Thêm / sửa / ẩn / đổi thứ tự loại sự kiện | `catalog.write` | Chủ, Quản trị, Quản lý (như Nhân vật) |
| Thêm / sửa / tắt luật phụ phí | `prices.write` | Chủ, Quản trị, Quản lý. Lý do: luật **sinh tiền** trên hợp đồng, giống đổi giá |
| Chọn sự kiện ở dòng, bỏ / sửa dòng tự thêm (hợp đồng nháp) | `contracts.write` | như hôm nay |
| Huỷ dòng tự thêm sau xác nhận | `contracts.write` + `contracts.adjust` (routes.ts:199) | như huỷ dòng thường |
| Trang Hôm nay | `org.read` để vào; **từng thẻ** theo quyền ở mục 2.6 | mọi vai trò |

### 2.2 Đường mới — Loại sự kiện (`apps/api/src/modules/catalog/occasions.ts`)

Kiểu thân giống apps/api/src/modules/catalog/categories.ts:100-180. Tag `Bảng giá`.

| Method · Path | Quyền | Idempotent | Thân (zod, `strictBody`) | Phản hồi | Lỗi |
|---|---|---|---|---|---|
| `GET /orgs/:orgId/occasions` | `catalog.read` | — | query `{ isActive?: BoolQuery }` | 200 `{ items: OccasionView[] }` sắp `sortOrder, name, id` | — |
| `POST /orgs/:orgId/occasions` | `catalog.write` | **có** | `{ name: OccasionName, color: z.enum(OCCASION_COLORS), sortOrder?: SortOrder, isActive?: z.boolean() }` | 201 `OccasionView` | 400 sai dữ liệu; 409 trùng tên "Tên loại sự kiện đã có trong tổ chức" (`withUniqueMessage`); 409 "Tối đa 50 loại sự kiện" |
| `PATCH /orgs/:orgId/occasions/:occasionId` | `catalog.write` | — | `{ name?, color?, sortOrder?, isActive? }` + `.refine(nonEmpty, 'Không có gì để sửa')` — **không** `.default()` | 200 `OccasionView` | 404 "Không tìm thấy loại sự kiện" (mã của tổ chức khác = mã bịa); 409 trùng tên |
| `PUT /orgs/:orgId/occasions/order` | `catalog.write` | — | `{ occasionIds: z.array(z.uuid()).min(1).max(50) }` | 200 `{ items: OccasionView[] }` | 400 "Danh sách phải gồm đủ mọi loại sự kiện của tổ chức, mỗi loại một lần" — **cùng một lời** cho mã trùng, thiếu, mã bịa, mã của tổ chức khác |

- `OccasionName` = `z.string().trim().min(1, 'Tên không được để trống').max(60)`.
- `OccasionView` = `{ id, name, color, sortOrder, isActive, lineCount, createdAt, updatedAt }`. `lineCount` = số dòng hợp đồng **chưa huỷ** có `occasion_id` này (một câu `groupBy`, không N+1). Màn cài đặt ghi "N dòng hợp đồng đang dùng".
- `PUT …/order` chạy trong transaction: khoá tổ chức (`SELECT … FOR UPDATE` như apps/api/src/modules/catalog/common.ts:50 `lockOrg`), đọc toàn bộ id loại sự kiện của tổ chức, so tập; đặt `sortOrder = vị trí`. Không có id nào của tổ chức khác lọt vì so với tập của chính tổ chức.
- Đổi tên / đổi màu / ẩn **không** đổi dòng hợp đồng đã lưu (`occasion_name` là bản chụp). Màu ca trên Lịch theo màu **hiện tại** của loại (mục 2.5).
- Không có đường xoá (dòng hợp đồng trỏ về loại). Ẩn = `isActive: false`: không chọn được cho dòng mới; dòng cũ giữ nguyên.
- Nhật ký: `occasion.created` (data = thân), `occasion.updated` (`{ before, after }`), `occasion.reordered` (`{ before: id[], after: id[] }`). `entityType: 'occasion'`.
- Cài sẵn: `DEFAULT_OCCASIONS` (packages/shared/src/occasions.ts) chép vào tổ chức mới trong **cùng transaction** tạo tổ chức (apps/api/src/modules/orgs/routes.ts, ngay sau dòng 112-114 chép nhân vật), và trong `sync-system-roles.ts` khi tổ chức có 0 loại (ghi `+occasions` vào `changes`, đếm `occasionSetsSeeded` trong báo cáo lệnh).

```ts
// packages/shared/src/occasions.ts
export const OCCASION_COLORS = ['rose','violet','amber','green','blue','taupe','brick','petrol','olive','plum','forest','brown'] as const;
export type OccasionColor = (typeof OCCASION_COLORS)[number];
export const MAX_OCCASIONS = 50;
export const DEFAULT_OCCASIONS: readonly { name: string; color: OccasionColor }[] = [
  { name: 'Ăn hỏi', color: 'amber' },
  { name: 'Lễ vu quy', color: 'taupe' },
  { name: 'Lễ cưới', color: 'rose' },
  { name: 'Tiệc', color: 'violet' },
  { name: 'Pre-wedding', color: 'green' },
  { name: 'Kỷ yếu', color: 'blue' },
];
```

### 2.3 Đường mới — Luật phụ phí (`apps/api/src/modules/catalog/surcharge-rules.ts`)

| Method · Path | Quyền | Idempotent | Thân | Phản hồi | Lỗi |
|---|---|---|---|---|---|
| `GET /orgs/:orgId/surcharge-rules` | `catalog.read` | — | query `{ isActive?: BoolQuery }` | 200 `{ items: SurchargeRuleView[] }` sắp `sortOrder, name, id` | — |
| `POST /orgs/:orgId/surcharge-rules` | `prices.write` | **có** | `RuleCreate` | 201 `SurchargeRuleView` | xem dưới |
| `PATCH /orgs/:orgId/surcharge-rules/:surchargeRuleId` | `prices.write` | — | `RulePatch` | 200 `SurchargeRuleView` | 404 luật; như POST |

Không có đường xoá: luật đã sinh dòng hợp đồng thì dòng trỏ về luật. Tắt = `isActive: false`.

```ts
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Giờ theo dạng HH:MM, ví dụ 05:30');
const Day = z.iso.date({ error: 'Ngày theo dạng YYYY-MM-DD' });
const ruleFields = {
  name: z.string().trim().min(1, 'Tên luật không được để trống').max(120),
  serviceId: z.uuid(),
  startTime: HHMM.nullable().optional(),       // null (PATCH) = bỏ khung giờ
  endTime: HHMM.nullable().optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  dates: z.array(Day).max(366).optional(),
  occasionIds: z.array(z.uuid()).max(50).optional(),
  packageIds: z.array(z.uuid()).max(100).optional(),
  subjectIds: z.array(z.uuid()).max(50).optional(),
  perQuantity: z.boolean().optional(),          // KHÔNG .default(): mặc định ở database (true)
  note: z.string().trim().max(500).nullable().optional(),
  sortOrder: SortOrder.optional(),
  isActive: z.boolean().optional(),
};
export const RuleCreate = strictBody(ruleFields).superRefine(checkRuleShape);              // name, serviceId bắt buộc
// Mọi trường tuỳ chọn — viết rõ, không có hàm "partial" (zod 4 vẫn điền .default() trong .partial(): http/partial.ts).
export const RulePatch  = strictBody({ ...ruleFields, name: ruleFields.name.optional(), serviceId: z.uuid().optional() })
  .refine(nonEmpty, 'Không có gì để sửa');
```

`checkRuleShape` (zod, lỗi đặt đúng ô):
- `startTime` và `endTime`: có cả hai hoặc không có cả hai → `path: ['endTime']` "Nhập cả giờ bắt đầu và giờ kết thúc của khung".
- `startTime === endTime` → "Giờ bắt đầu và kết thúc phải khác nhau". `startTime = '24:00'` → "Giờ bắt đầu từ 00:00 đến 23:59".
- `weekdays`, `dates`, `occasionIds`, `packageIds`, `subjectIds`: không trùng phần tử.
- **Ít nhất một điều kiện kích hoạt**: khung giờ, hoặc `weekdays` khác rỗng, hoặc `dates` khác rỗng, hoặc `occasionIds` khác rỗng. Thiếu → `path: ['startTime']` "Luật phải có ít nhất một điều kiện: khung giờ, ngày hoặc loại sự kiện". (Chỉ gói / nhân vật thì không phải phụ phí, đó là giá.)

PATCH: máy chủ **ghép** bản đang lưu với thân rồi chạy lại `checkRuleShape` trên bản ghép (400 cùng lời). Mảng gửi lên **thay toàn bộ** mảng cũ; không gửi = giữ nguyên.

Kiểm trong transaction (thứ tự cố định để lời lỗi ổn định):
1. `serviceId` thuộc tổ chức → không thấy: 404 "Không tìm thấy dịch vụ" (mã của tổ chức khác = mã bịa). `kind ≠ SURCHARGE` → 400 "Dịch vụ "X" là dịch vụ chính/phụ — luật chỉ nhận phụ phí". `isActive = false` → 400 "Phụ phí "X" đang ngừng hoạt động". **Không** bắt buộc có giá lúc lưu luật (giá có thể đặt sau) — thiếu giá thì luật hiện trạng thái `NO_PRICE`.
2. Mỗi `occasionIds[]` thuộc tổ chức → 404 "Không tìm thấy loại sự kiện" (cho phép loại đang ẩn).
3. Mỗi `packageIds[]` → 404 "Không tìm thấy gói dịch vụ"; mỗi `subjectIds[]` → 404 "Không tìm thấy nhân vật makeup".
4. Bật luật (tạo với `isActive` khác `false`, hoặc PATCH `isActive: true`) khi tổ chức đã có 50 luật đang bật → 409 "Tối đa 50 luật đang bật".
5. Ghi luật; xoá rồi ghi lại `surcharge_rule_targets` / `surcharge_rule_dates` khi trường tương ứng có trong thân.
6. Trùng tên → 409 "Tên luật đã có trong tổ chức".
7. Nhật ký `surcharge_rule.created` / `surcharge_rule.updated` với `{ before, after }` gồm cả mảng điều kiện.

`SurchargeRuleView`:

```ts
{
  id, name, serviceId,
  service: { id, name, kind, isActive, currentPrice: Vnd | null },   // currentPrice: giá hiện hành (resolveCurrentPrice)
  startTime: string | null, endTime: string | null,                  // "HH:MM" (minutesToTime, packages/shared/src/courses.ts:79)
  weekdays: number[], dates: string[],                               // dates "YYYY-MM-DD" tăng dần
  occasionIds: string[], packageIds: string[], subjectIds: string[],
  perQuantity: boolean, note: string | null, sortOrder: number, isActive: boolean,
  status: 'OK' | 'SERVICE_INACTIVE' | 'SERVICE_NOT_SURCHARGE' | 'NO_PRICE',  // tính lúc đọc — vì sao luật đang không sinh dòng
  usedLineCount: number,                                             // số dòng tự thêm chưa huỷ đang trỏ về luật
  createdAt, updatedAt,
}
```

Sửa / tắt luật **không** đổi hợp đồng đã lưu. Hợp đồng nháp nhận luật mới ở lần lưu dòng kế tiếp.

### 2.4 Luật tính phụ phí tự động (máy chủ là nơi duy nhất tính)

#### Hàm thuần (packages/shared/src/surcharges.ts — có bài thử đơn vị)

```ts
export interface RuleLike {
  id: string; name: string; serviceId: string; sortOrder: number;
  startMinute: number | null; endMinute: number | null;
  weekdays: readonly number[]; dates: readonly string[];          // "YYYY-MM-DD"
  occasionIds: readonly string[]; packageIds: readonly string[]; subjectIds: readonly string[];
  perQuantity: boolean;
}
export interface LineFacts {
  localDate: string | null;      // ngày của dòng theo múi giờ tổ chức
  startMinute: number | null;    // phút bắt đầu theo múi giờ tổ chức; null = dòng chưa có giờ
  occasionId: string | null; packageId: string | null; subjectId: string | null;
}
export function inWindow(minute: number, start: number, end: number): boolean;   // start<end: start<=m<end; start>end: m>=start || m<end
export function ruleMatches(rule: RuleLike, line: LineFacts): boolean;
// Trả các luật KHỚP, đã sắp (sortOrder, name, id), đã khử trùng dịch vụ (mỗi serviceId giữ luật đứng đầu), kèm danh sách bị che.
export function pickSurchargeRules(rules: readonly RuleLike[], line: LineFacts, dismissed: ReadonlySet<string>):
  { kept: RuleLike[]; shadowed: { rule: RuleLike; by: RuleLike }[] };
// Ngày + phút địa phương của một thời điểm (Intl, như tzOffsetMs ở apps/api/src/modules/courses/sessions.ts:54). Chuyển
// zonedInstant (sessions.ts:71) sang đây; sessions.ts nhập lại từ shared (không chép hai bản).
export function localDateAndMinute(instant: Date, timezone: string): { date: string; minute: number; weekday: number };
```

`ruleMatches` — mọi điều kiện **đã điền** đều phải đúng (VÀ):
1. **Khung giờ** (nếu có): `line.startMinute !== null` và `inWindow(line.startMinute, s, e)`. Dòng chưa có giờ → **không** khớp.
2. **Ngày** (nếu `weekdays` hoặc `dates` khác rỗng): `line.localDate !== null` và (thứ của `localDate` ∈ `weekdays` **HOẶC** `localDate` ∈ `dates`).
3. **Loại sự kiện** (nếu `occasionIds` khác rỗng): `line.occasionId ∈ occasionIds`.
4. **Gói** (nếu `packageIds` khác rỗng): `line.packageId ∈ packageIds` (dòng dịch vụ lẻ có `packageId = null` → không khớp).
5. **Nhân vật** (nếu `subjectIds` khác rỗng): `line.subjectId ∈ subjectIds`.

Khung giờ là **nửa mở** `[start, end)`: luật "trước 6:00" = `00:00–06:00`, ca bắt đầu đúng 06:00 **không** bị tính. Ghi rõ trên màn (mục 3.3).

#### Nối vào bảng tính (apps/api/src/modules/contracts/autoSurcharge.ts mới, gọi từ `planPlaced` ở sheet.ts:252)

`Ctx` (sheet.ts:197) thêm: `timezone: string`, `eventDate: Date | null`, `rules: () => Promise<LoadedRule[]>` (nạp **một lần** mỗi bảng tính, giống `policy`), `manualSurchargeServiceIds: Set<string>`.

Với **mỗi dòng đặt chỗ** (PACKAGE / SERVICE), sau khi đã tính dòng chính, dịch vụ phụ, phí di chuyển:

1. **Kiểm mã** người dùng gửi: mọi `surchargeOverrides[].ruleId` và `dismissedRuleIds[]` phải là luật của tổ chức (bật hay tắt đều được). Một câu `findMany({ where: { organizationId, id: { in } } })`. Thiếu → 404 "Không tìm thấy luật phụ phí" `{ line }` — **cùng lời** cho mã bịa và mã của tổ chức khác (cửa gác tham chiếu chéo đo đúng điều này; mảng `dismissed…` không có khoá ngoại nên đây là chốt duy nhất). Một luật vừa ở `surchargeOverrides` vừa ở `dismissedRuleIds` → 400 "Luật "X" vừa bị bỏ vừa được sửa ở cùng một dòng". `ruleId` trùng trong `surchargeOverrides` → 400.
2. **Sự kiện của dòng**: `occasionId` thuộc tổ chức → 404 "Không tìm thấy loại sự kiện"; đang ẩn → 400 "Loại sự kiện "X" đang ẩn"; ghi `occasionId` + `occasionName` (bản chụp) vào dòng chính.
3. **Sự thật của dòng**: `localDateAndMinute(scheduledStart, timezone)` nếu có giờ; không có giờ thì `localDate` = ngày địa phương của `eventDate` (nếu có), `startMinute = null`.
4. **Chọn luật**: `pickSurchargeRules(luật đang bật, sự thật, dismissed)`. Với mỗi luật trong `kept`:
   - Dịch vụ của luật không còn là SURCHARGE / đã ngừng → **bỏ qua**, ghi `skipped: { reason: 'SERVICE_UNAVAILABLE' }`. Không chặn hợp đồng.
   - Trong cùng yêu cầu có **dòng phụ phí nhập tay** (dòng SURCHARGE gốc, không có luật) cùng dịch vụ — hoặc, với đường thêm dòng phát sinh, hợp đồng đã có dòng như vậy chưa huỷ → **bỏ qua**, `skipped: { reason: 'MANUAL_LINE_EXISTS' }` (tránh thu hai lần).
   - Giá: có `surchargeOverrides` của luật này mà có `unitPrice` → dùng giá đó, `priceVersionId = null`, `note` bắt buộc (400 như schemas.ts:58-61). Không có → `priceOf(dịch vụ, at)`; **chưa có giá hiệu lực** → bỏ qua, `skipped: { reason: 'NO_PRICE' }` (khác dòng nhập tay — dòng nhập tay vẫn 400 như cũ).
   - Số lượng: `override.quantity` nếu có; không thì `perQuantity ? dòng chính.quantity : 1`.
   - Dòng sinh ra: `kind: 'SURCHARGE'`, `parentLineId = dòng chính.id`, `serviceId`, `priceVersionId`, `name = tên dịch vụ`, `unitPrice`, `quantity`, `lineDiscount = 0`, `lineTotal = computeLineTotal(...)` qua `money()`, `note = override.note ?? null`, `surchargeRuleId`, `surchargeRuleName = tên luật lúc tính`.
5. `shadowed` (hai luật cùng dịch vụ) → ghi `skipped: { reason: 'SAME_SERVICE', by: tên luật thắng }`.
6. `surchargeOverrides` của luật **không** còn trong `kept` (đổi giờ / ngày / sự kiện nên hết khớp, luật đã tắt, bị che) → **bỏ** phần sửa đó, ghi `removed: { reason: 'NO_LONGER_MATCHES' | 'RULE_INACTIVE' | 'SAME_SERVICE' }`.
7. Dòng chính lưu `dismissedSurchargeRuleIds` = `dismissedRuleIds` đã khử trùng (giữ cả luật hiện không khớp — đổi giờ đi rồi đổi lại vẫn **không** tự thêm lại).
8. Thứ tự dòng con: dịch vụ phụ → phí di chuyển → dòng tự thêm theo thứ tự `kept`. `insertLines` ghi theo đúng thứ tự mảng (sheet.ts:603).

Thứ tự áp và trùng nhiều luật — tóm tắt cho thợ và cho anh:
- Nhiều luật khớp **khác dịch vụ** → **cộng dồn**, mỗi luật một dòng.
- Nhiều luật khớp **cùng dịch vụ** → chỉ luật đứng đầu (thứ tự `sortOrder` nhỏ trước, rồi tên, rồi id) sinh dòng.
- Không có "luật này loại trừ luật kia" ngoài trường hợp cùng dịch vụ.

Làm tròn, trần tiền:
- Không có làm tròn: giá là số nguyên đồng từ bảng giá × số lượng nguyên (`computeLineTotal`). Luật **không** có phần trăm (mục 6).
- Thành tiền dòng tự thêm > `MAX_MONEY_VND` → 400 qua `assertLineCap` (sheet.ts:95), lời ghi tên dòng. Tổng > trần → `assertTotalsCap` (sheet.ts:89). Database còn chốt `contract_lines_line_total_cap` (migration 20261018250000_tran_so_tien dòng 51).

Khi nào luật chạy lại:

| Thao tác | Luật chạy? | Ghi chú |
|---|---|---|
| `POST /contracts/quote` | Có | Không ghi gì. Trả `autoSurcharge` |
| `POST /contracts` (tạo) | Có | |
| `PATCH /contracts/:id` có `lines` (hợp đồng nháp) | Có, cho **mọi** dòng | Đổi giờ / ngày / sự kiện / gói / nhân vật ở web đều gửi lại `lines` (apps/web/src/features/contracts/model.ts:389) → luật chạy lại |
| `PATCH` không có `lines` (chỉ đổi ghi chú, giảm giá, `eventDate`) | **Không** | Dòng giữ nguyên. Web luôn gửi `lines` cùng `eventDate` nên trường hợp này không xảy ra từ web |
| `POST /contracts/:id/lines` (nháp hoặc phát sinh sau xác nhận) | Có, cho dòng mới | `addedAfterConfirm` như dòng chính |
| Xác nhận hợp đồng | **Không** | Xác nhận không tính lại dòng (giá cũng không tính lại — giữ đúng như hôm nay) |
| Hợp đồng đã xác nhận / hoàn thành / huỷ | **Không bao giờ** | Dòng đã khoá (trigger) |
| Sửa / tắt luật, đổi giá phụ phí | Không chạm hợp đồng đã lưu | Nháp nhận ở lần lưu dòng sau |

Bỏ / sửa dòng tự thêm (người lập):
- **Hợp đồng nháp — bỏ**: web thêm `ruleId` vào `dismissedRuleIds` của dòng chính rồi lưu. Máy chủ không sinh dòng đó nữa, kể cả lần sau.
- **Hợp đồng nháp — sửa**: web gửi `surchargeOverrides: [{ ruleId, quantity?, unitPrice?, note? }]`. Dòng vẫn là dòng tự thêm (giữ nhãn luật), có nhãn phụ "đã sửa giá" khi `priceVersionId = null`.
- **Thêm lại luật đã bỏ**: web xoá `ruleId` khỏi `dismissedRuleIds` (nút "Áp lại").
- **Sau xác nhận**: không sửa được (như mọi dòng). Huỷ dòng tự thêm bằng đường huỷ dòng có lý do (routes.ts:717, cần `contracts.adjust`).

#### Thay đổi thân và phản hồi hợp đồng

`apps/api/src/modules/contracts/schemas.ts` — thêm vào `placement` (schemas.ts:38):

```ts
  occasionId: z.uuid().optional(),
  // Sửa dòng tự thêm (chỉ khi người lập đã sửa): không gửi = theo luật + bảng giá.
  surchargeOverrides: z.array(
    strict({ ruleId: z.uuid(), quantity: Quantity.optional(), unitPrice: Money.optional(), note: Note.optional() })
      .refine((s) => s.unitPrice === undefined || s.note !== undefined, { message: 'Ghi đè giá phụ phí phải kèm ghi chú lý do', path: ['note'] }),
  ).max(20).optional(),
  // Luật người lập đã bỏ ở dòng này — không tự thêm lại.
  dismissedRuleIds: z.array(z.uuid()).max(50).optional(),
```

Không `.default()` (thân PATCH hợp đồng dùng lại `Lines` — chốt khởi động sẽ bắt nếu lỡ thêm).

Phản hồi (apps/api/src/modules/contracts/present.ts):
- `LineView` (present.ts:178) thêm: `occasionId: string | null`, `occasionName: string | null`, `surchargeRuleId: string | null`, `surchargeRuleName: string | null`, `dismissedRuleIds: string[]`.
- `GroupedLine` (present.ts:217) thêm `surcharges: LineView[]`. `group()` (present.ts:228): dòng con `kind = 'SURCHARGE'` → `parent.surcharges`, `TRAVEL` → `travel`, còn lại → `addons`.
- `POST /contracts/quote` trả thêm:

```ts
autoSurcharge: {
  applied: { line: number; ruleId: string; ruleName: string; serviceName: string; quantity: number; lineTotal: Vnd; overridden: boolean }[];
  removed: { line: number; ruleId: string; ruleName: string; reason: 'NO_LONGER_MATCHES' | 'RULE_INACTIVE' | 'SAME_SERVICE' }[];
  skipped: { line: number; ruleId: string; ruleName: string; reason: 'SERVICE_UNAVAILABLE' | 'MANUAL_LINE_EXISTS' | 'NO_PRICE' | 'SAME_SERVICE'; by?: string }[];
}
```

`line` = vị trí dòng đặt chỗ trong mảng gửi lên (giống `details.line` của lỗi). Chỉ quote trả `autoSurcharge`; tạo / sửa / thêm dòng trả chi tiết hợp đồng như cũ (đã có dòng con).

Nhật ký: `contract.created`, `contract.updated` (khi có `lines`), `contract.line_added` thêm `autoSurcharges: [{ lineId, parentLineId, ruleId, amount }]`.

Đường gọi `buildSheet` / `planLines` phải truyền `timezone` (đọc `organizations.timezone` một lần) và `eventDate`:
- quote / tạo: `body.eventDate`;
- PATCH: `body.eventDate` nếu có trong thân, không thì `c.eventDate`;
- thêm dòng: `c.eventDate`; `manualSurchargeServiceIds` = dịch vụ của các dòng SURCHARGE gốc chưa huỷ của hợp đồng.

### 2.5 Lịch: màu theo sự kiện (apps/api/src/modules/schedule/service.ts)

- `appointmentInclude.contractLine` (service.ts:64) thêm `occasionName: true, occasion: { select: { id: true, color: true } }`. Quan hệ đi theo khoá ngoại kép nên chỉ đọc được loại của **chính** tổ chức.
- `presentAppointment` (service.ts:118) thêm `occasion: { id, name, color } | null` — `name` = bản chụp trên dòng, `color` = màu **hiện tại** của loại. Ca không gắn dòng / dòng chưa chọn sự kiện → `null`.
- Không thêm cột ở `appointments`. Ca tạo lẻ trên Lịch (không hợp đồng) **chưa** chọn được sự kiện (mục 6).

### 2.6 Đường mới — Trang Hôm nay (`apps/api/src/modules/today/`)

| Method · Path | Quyền | Thân / query | Phản hồi |
|---|---|---|---|
| `GET /orgs/:orgId/today` | `org.read` | không có | 200 `TodayView` |

Tệp: `today/routes.ts` (đường), `today/collect.ts` (gom từng thẻ, hàm thuần nhận `db` + ngữ cảnh — dùng lại được cho bản tin C và màn Thu tiền / việc tồn 12), `today/present.ts`. Đăng ký `todayRoutes` ở apps/api/src/app.ts (danh sách dòng 32-44).

Mốc thời gian (một lần mỗi yêu cầu, `now = new Date()`, `tz = organizations.timezone`):
- `today = todayIn(tz, now)`; `dayStart(d) = zonedInstant(d, 0, tz)`.
- Hôm nay = `[dayStart(today), dayStart(today+1))`; Ngày mai = `[dayStart(today+1), dayStart(today+2))`; Sau đó = `[dayStart(today+2), dayStart(today+8))`.
- "7 ngày tới" của tiền = hạn `< dayStart(today+8)` (hôm nay + 7 ngày nữa). "24 giờ qua" = `>= now − 24h`.

Thẻ, nguồn, quyền (thiếu quyền → trường là `null`, web **ẩn** thẻ; có quyền mà không có gì → mảng rỗng, web hiện câu "Không có …"):

| Trường | Ai thấy | Lấy từ | Lọc | Trần |
|---|---|---|---|---|
| `appointments.today / tomorrow / later` | `schedule.read_all`: mọi ca; chỉ `schedule.read_own`: **chỉ ca có mình** (lọc như appointments.ts:115-121) | `appointment` + `appointmentInclude` | `status NOT IN (CANCELLED, NO_SHOW)`; mọi `kind` | 200 mỗi danh sách, `truncated` |
| `unassigned` | `schedule.read_all` | `appointment` không có dòng `appointment_staff` | `kind = MAKEUP`, `status IN (PENDING_CONFIRMATION, CONFIRMED)`, `startsAt ∈ [now, dayStart(today+8))` | 50 |
| `installments.overdue / dueSoon` | `payments.read` | `payment_installments` của hợp đồng `status IN (CONFIRMED, COMPLETED)`; trạng thái từng đợt = `allocateToInstallments(mọi đợt của hợp đồng, summarizePayments(...).paid, now)` | overdue = `OVERDUE`; dueSoon = `DUE` hoặc `PARTIAL` có `dueDate < dayStart(today+8)` | 50 mỗi danh sách; đếm và cộng tiền trên **toàn bộ** |
| `newContracts` | `contracts.read` | `contracts.confirmed_at >= now − 24h`, `status IN (CONFIRMED, COMPLETED)`; người xác nhận = `audit_logs` `action = 'contract.status_changed'`, `data->>'to' = 'CONFIRMED'`, `entity_id` = hợp đồng | | 20 |
| `newEnrollments` | `courses.read` **và** tổ chức `ACADEMY` (không thì `null`) | `enrollments.enrolled_at >= now − 24h`, `status = ACTIVE` | | 20 |
| `almostFullClasses` | `courses.read` **và** `ACADEMY` | `course_classes` `status = OPEN`, `end_date >= today`, `seatState(enrolledCount, capacity) = 'ALMOST_FULL'` | sắp `start_date` | 20 |

Câu truy vấn đợt thu (không N+1, có trần):
1. `contractIds` = các hợp đồng (của tổ chức, trạng thái trên) có **ít nhất một** đợt `due_date < dayStart(today+8)`; tối đa 500 hợp đồng, sắp theo `min(due_date)`; vượt → `installments.truncated = true`.
2. Một câu đọc mọi đợt của các hợp đồng đó; một câu `groupBy` phiếu (`kind`, `voided_at IS NULL`) để có số đã thu — đúng luật `summarizePayments`.
3. Chạy `allocateToInstallments` theo từng hợp đồng.
- SĐT khách chỉ trả khi người xem có `customers.read` (đúng luật payments/common.ts:82): không có → `phone: null, phoneHidden: true`.
- Tổng tiền cộng bằng số nguyên; mỗi đợt ≤ trần, tối đa 500 × 24 đợt → luôn dưới `Number.MAX_SAFE_INTEGER`.

```ts
interface TodayView {
  generatedAt: string; timezone: string; today: string; tomorrow: string;   // "YYYY-MM-DD"
  scheduleScope: 'ALL' | 'OWN';
  counts: {
    appointmentsToday: number; appointmentsTomorrow: number;
    unassignedSoon: number | null;
    overdue: { count: number; amount: Vnd } | null;      // amount = tổng còn thiếu
    dueSoon: { count: number; amount: Vnd } | null;
  };
  appointments: { today: TodayAppointment[]; tomorrow: TodayAppointment[]; later: TodayAppointment[]; truncated: boolean };
  unassigned: TodayAppointment[] | null;
  installments: { overdue: TodayInstallment[]; dueSoon: TodayInstallment[]; truncated: boolean } | null;
  newContracts: TodayContract[] | null;
  newEnrollments: TodayEnrollment[] | null;
  almostFullClasses: TodayClass[] | null;
}
interface TodayAppointment {
  id: string; code: string; kind: EventKind; status: WorkStatus; title: string | null;
  startsAt: string; endsAt: string; travelBeforeMin: number;
  customer: { id: string; fullName: string } | null;
  subjectName: string | null; quantity: number | null;
  occasion: { id: string; name: string; color: OccasionColor } | null;
  locationType: LocationType | null; address: string | null;
  contract: { id: string; code: string } | null;
  courseClass: { id: string; name: string; courseId: string } | null;
  staff: { membershipId: string; displayName: string; role: 'PRIMARY' | 'ASSIST' }[];
}
interface TodayInstallment {
  installmentId: string; name: string; dueDate: string; amount: Vnd; outstanding: Vnd;
  status: 'OVERDUE' | 'DUE' | 'PARTIAL'; overdueDays: number;   // số ngày lịch theo múi giờ tổ chức; 0 khi chưa quá hạn
  isDeposit: boolean;
  contract: { id: string; code: string; eventDate: string | null };
  customer: { id: string; fullName: string; phone: string | null; phoneHidden: boolean };
  owner: { membershipId: string; displayName: string } | null;  // Contract.ownerMembershipId → StaffProfile.displayName / User.fullName
}
interface TodayContract { id: string; code: string; kind: 'SERVICE' | 'COURSE'; customerName: string; total: Vnd; eventDate: string | null; confirmedAt: string; confirmedBy: { userId: string; fullName: string } | null }
interface TodayEnrollment { id: string; enrolledAt: string; customer: { id: string; fullName: string }; courseClass: { id: string; name: string }; course: { id: string; name: string }; enrolledCount: number; capacity: number }
interface TodayClass { id: string; name: string; course: { id: string; name: string }; startDate: string; enrolledCount: number; capacity: number; seatsLeft: number }
```

Lỗi: chỉ lỗi chung (404 tổ chức, 403 tổ chức bị khoá). Không ghi nhật ký (chỉ đọc). Không idempotent.

---

## 3. Web

Quy ước chung: dùng đúng component đang có (`ui/Card`, `ui/StatTile`, `ui/ListRow`, `ui/ListGroupHeader`, `ui/Button`, `ui/Segmented`, `ui/Select`, `ui/Dialog`, `ui/BottomSheet`, `ui/EmptyState`, `ui/Skeleton`, `ui/StatusTag`, `ui/DateInput`, `ui/MoneyInput`). Màu chỉ từ `styles/tokens.css`. Ba khổ: **1440** (máy tính), **1024** (máy tính bảng ngang / máy tính nhỏ — vẫn có thanh trái), **390** (điện thoại — thanh dưới). Tiền luôn lấy từ máy chủ, web chỉ định dạng (`formatVnd`).

### 3.0 Điều hướng (apps/web/src/layout/nav.ts)

- Thêm **mục đầu** `{ key: 'hom-nay', path: 'hom-nay', label: 'Hôm nay', shortLabel: 'Hôm nay', icon: 'hom-nay', permission: 'org.read' }`. Vì `homeNavItem` (nav.ts:255) lấy mục đầu được thấy, **Hôm nay thành trang mở đầu** của mọi người.
- `BOTTOM_NAV` (nav.ts:119): ô đầu là Hôm nay. ACADEMY: Hôm nay · Lịch · Hợp đồng · Khoá học (Thu tiền vào "Thêm"). DEFAULT: Hôm nay · Lịch · Hợp đồng · Bảng giá (Khách vào "Thêm"). Thợ không có Hợp đồng / Bảng giá → chỉ còn Hôm nay · Lịch · Thêm (như ảnh `thong-bao-B-trang-hom-nay-tho-390`).
- Mục con của `bang-gia` thêm: `{ key: 'bang-gia-su-kien', path: 'bang-gia/su-kien', label: 'Loại sự kiện' }`, `{ key: 'bang-gia-luat-phu-phi', path: 'bang-gia/luat-phu-phi', label: 'Luật phụ phí' }`. **Khác bản mẫu** (bản mẫu để ở Cài đặt): đặt cạnh "Nhân vật" và "Dịch vụ phụ & phụ phí" vì cùng loại dữ liệu và cùng quyền `catalog.*`; mục Cài đặt cần `org.update` nên thợ (chỉ có `catalog.read`) sẽ không thấy.
- `navIcons.tsx`: thêm biểu tượng `hom-nay` (ngôi nhà, nét 1.5 như các biểu tượng khác).
- `app/routes.tsx`: `{ path: 'hom-nay', element: guarded('hom-nay', <TodayPage />) }` (tải lười như các màn khác).

### 3.1 Màn Hôm nay (`apps/web/src/features/today/`)

Tệp: `index.tsx` (`TodayPage`), `useToday.ts` (gọi `GET /today`, tải lại khi trang được mở lại / bấm "Làm mới"), `TodayTiles.tsx`, `NeedsActionCard.tsx`, `DueSoonCard.tsx`, `TomorrowCard.tsx`, `NewCard.tsx`, `MyDayCards.tsx` (giao diện thợ), `today.css`, `TodayPage.test.tsx`, `model.ts` (+ `model.test.ts`: gom ca theo thợ, nhãn "quá N ngày", chọn dòng đầu).

Tiêu đề trang: **"Hôm nay · {Thứ} {dd/mm}"** (ví dụ "Hôm nay · Thứ Bảy 21/11"), theo `today` của máy chủ (không theo đồng hồ máy). Nút phụ bên phải: "Làm mới" (biểu tượng xoay, tooltip "Tải lại số liệu mới nhất").

**Giao diện "ALL"** (người có `schedule.read_all`) — theo ảnh `thong-bao-B-trang-hom-nay-chu-studio-1440`:

| Khối | Nhãn + nội dung | Điều khiển | Tooltip |
|---|---|---|---|
| 4 ô số (`StatTile`) | "Ca hôm nay" — số + dòng phụ "HH:MM {tên thợ}" của ca kế tiếp; "Ca ngày mai" — số + "N ca chưa có thợ" (chữ đỏ, nền hồng khi N > 0); "Đợt thu quá hạn" — số đỏ + tổng tiền; "Đến hạn 7 ngày tới" — số + tổng tiền | Bấm ô → cuộn tới thẻ tương ứng | Ô tiền: "Tính theo tiền đã thu đến lúc mở trang" |
| Thẻ "Cần làm ngay · N việc" | Ba nhóm (`ListGroupHeader`): **TIỀN QUÁ HẠN** (tổng tiền bên phải), **CA CHƯA CÓ THỢ**, **LỚP SẮP ĐẦY**. Dòng tiền: "{tên đợt} · {mã HĐ} · {khách}" / "Hạn dd/mm (quá N ngày) · phụ trách: {tên} · {SĐT khách}" / số còn thiếu bên phải | Dòng tiền: nút chính **"Mở Thu tiền"** → `thu-tien/:contractId` (chỉ khi có `payments.write`, không thì bấm dòng để xem). Dòng ca: nút **"Phân thợ"** → `lich?ngay=YYYY-MM-DD&ca=:id` (chỉ khi có `schedule.write`). Dòng lớp: nút **"Mở lớp"** → `dao-tao/:courseId` | "Phân thợ": "Mở ca này trên Lịch để chọn thợ" |
| | Nút "Thu gọn / Mở rộng" ở đầu thẻ | Nhớ trên máy (`localStorage` khoá `hom-nay:thu-gon:{key}`, bọc try/catch) | |
| Thẻ "Thu tiền 7 ngày tới · N đợt" | Dòng: "{tên đợt} · {mã} · {khách}" / "Hạn {Thứ} dd/mm · phụ trách {tên}"; đợt hạn đúng ngày sự kiện ghi "(ngày sự kiện)" | Liên kết đầu thẻ **"Mở Thu tiền"** → `thu-tien` | |
| Thẻ "Ngày mai · {Thứ} dd/mm · N ca" | Gom theo thợ: avatar + "{tên ngắn} · N ca" / giờ bắt đầu nối "·". Ca chưa có thợ gom vào dòng "Chưa có thợ" cuối | Liên kết "Mở Lịch" → `lich?ngay=<ngày mai>` | |
| Thẻ "Mới trong 24 giờ · N" | Hợp đồng: "{mã} xác nhận · {khách}" / "{tổng} · ngày sự kiện dd/mm · {giờ} hôm qua/hôm nay · {người xác nhận}". Học viên: "{tên} ghi danh" / "{khoá lớp} · còn x/y chỗ · {giờ}" | "Mở" → `hop-dong/:id` hoặc `dao-tao/:courseId` | |

Thẻ có trường `null` (thiếu quyền) thì **không vẽ**; thẻ rỗng vẽ câu: "Không có đợt nào quá hạn.", "Mọi ca 7 ngày tới đã có thợ.", "Không có gì mới trong 24 giờ.". Thẻ "Cần làm ngay" rỗng cả ba nhóm: "Không có việc gấp. ✓" (dấu tick là biểu tượng, không phải ký tự emoji).

**Giao diện "OWN"** (thợ, giảng viên, trợ giảng) — theo ảnh `thong-bao-B-trang-hom-nay-tho-*`: không có 4 ô số. Ba thẻ: "Hôm nay", "Ngày mai · {Thứ} dd/mm · N ca", "Sau đó · 7 ngày tới · N ca". Dòng ca: cột giờ "HH:MM" đậm / "HH:MM" kết thúc mờ; dòng trên màu theo sự kiện (hoặc nhân vật nếu chưa có sự kiện) "{sự kiện} · {nhân vật}"; tên khách; nơi làm "{Studio | Tại nhà khách | Nơi khác} – {địa chỉ} · đi trước N phút"; thẻ trạng thái (`StatusTag`). Thẻ "Sau đó" gom theo ngày: "{Thứ} dd/mm · N ca" / "HH:MM {nhân vật} · {khách}". Bấm dòng → `lich?ngay=…&ca=…`. Hôm nay không có ca: "Bạn không có ca nào hôm nay."

Bố cục:

| Khổ | Bố cục |
|---|---|
| 1440 | Lưới 2 cột 3fr / 2fr, khe 16px. Trái: Cần làm ngay, Thu tiền 7 ngày tới. Phải: Ngày mai, Mới trong 24 giờ. 4 ô số một hàng trên cùng |
| 1024 | Một cột, rộng tối đa 760px. 4 ô số vẫn một hàng (mỗi ô ≥ 160px; hẹp hơn thì 2 × 2). Thứ tự: Cần làm ngay, Ngày mai, Thu tiền 7 ngày, Mới |
| 390 | Một cột, lề 16px. Ô số 2 × 2. Nút trong dòng ("Mở Thu tiền", "Phân thợ") xuống hàng dưới, cao ≥ 40px. Thanh dưới có ô Hôm nay đang chọn |

Trạng thái: đang tải → `Skeleton` đúng hình 4 ô + 2 thẻ; lỗi → `ErrorNotice` có nút "Thử lại"; `truncated` → dòng mờ cuối thẻ "Chỉ hiện 50 dòng đầu — xem đủ ở Thu tiền / Lịch".

### 3.2 Bảng giá › Loại sự kiện (`apps/web/src/features/pricing/OccasionsPage.tsx`, `OccasionDialog.tsx`)

Theo ảnh `su-kien-C-cai-dat-loai-su-kien-*`, dựng giống `SubjectsPage.tsx`.

- Tiêu đề thẻ: **"Loại sự kiện"** + chữ mờ "N loại · màu dùng chung 12 màu của Lịch". Nút **"+ Thêm loại"** (chỉ khi `catalog.write`).
- Mỗi hàng: tay nắm kéo `⋮⋮` (tooltip "Kéo để đổi thứ tự trong ô chọn"), tên đậm, dòng phụ "N dòng hợp đồng đang dùng", 12 ô màu (ô đang chọn có viền đậm; tooltip mỗi ô = tên màu tiếng Việt: Hồng, Tím, Hổ phách, Xanh lá, Xanh dương, Nâu xám, Đỏ gạch, Xanh dầu, Ô liu, Mận, Xanh rừng, Nâu), công tắc bật / ẩn (tooltip "Ẩn: không chọn được cho dòng mới; dòng cũ giữ nguyên").
- Bấm tên → `OccasionDialog` đổi tên. Bấm ô màu → `PATCH { color }` ngay. Kéo xong → `PUT /occasions/order` với **đủ** danh sách. Không có `catalog.write`: ẩn tay nắm, ô màu chỉ hiện màu đang chọn, công tắc tắt.
- Chân thẻ: "Kéo ⋮⋮ để đổi thứ tự trong ô chọn. Ẩn loại không xoá các ca cũ đã gắn."
- 409 trùng tên → lỗi ngay dưới ô tên. 409 "Tối đa 50" → dải lỗi đầu thẻ.
- 1024: như 1440, bảng rộng tối đa 760px. 390: 12 ô màu xuống hàng thứ hai dưới tên (6 × 2), công tắc ở cuối hàng tên; nút "+ Thêm loại" thành nút tròn nổi góc dưới phải trên thanh dưới; kéo thả thay bằng hai nút ↑ ↓ (dễ bấm hơn trên cảm ứng).

### 3.3 Bảng giá › Luật phụ phí (`SurchargeRulesPage.tsx`, `SurchargeRuleDialog.tsx`)

Màn mới, chưa có trong bản mẫu chặng 1 — dựng theo đúng kiểu thẻ + `ListRow` của `ServicesPage.tsx`.

Danh sách:
- Tiêu đề **"Luật phụ phí"**, chữ mờ "Khớp luật thì hợp đồng tự thêm dòng phụ phí; người lập bỏ được". Nút **"+ Thêm luật"** (khi `prices.write`).
- Mỗi hàng: tên luật đậm; dòng phụ tóm tắt điều kiện bằng chữ, ví dụ "Giờ bắt đầu 00:00–06:00 · Lễ cưới, Lễ vu quy · Gói Cô dâu cao cấp"; bên phải: tên phụ phí + giá hiện hành ("Phụ phí ca sớm · 200.000 ₫") và công tắc bật/tắt. Hàng `status ≠ OK` có thẻ vàng: `SERVICE_INACTIVE` "Phụ phí đang ngừng — luật không chạy", `SERVICE_NOT_SURCHARGE` "Dịch vụ không còn là phụ phí — luật không chạy", `NO_PRICE` "Phụ phí chưa có giá — luật không chạy". Chữ "Đang dùng ở N dòng".
- Sắp theo thứ tự ưu tiên; nút ↑ ↓ đổi `sortOrder` (tooltip "Hai luật cùng một phụ phí: luật đứng trên được áp").

Hộp thêm / sửa (`Dialog`; 390 là `BottomSheet` toàn màn):

| Ô | Điều khiển | Ghi chú / tooltip |
|---|---|---|
| Tên luật * | ô chữ, ≤ 120 | "Hiện trên hợp đồng: tự thêm theo luật {tên}" |
| Phụ phí thu * | `Select` các dịch vụ `SURCHARGE` đang bật, kèm giá hiện hành | Chưa có phụ phí nào → câu "Chưa có phụ phí nào — thêm ở Dịch vụ phụ & phụ phí" kèm liên kết |
| **Khi nào áp** (ít nhất một) | | Dòng đầu nhóm: "Điền điều kiện nào thì điều kiện đó phải đúng" |
| ☐ Theo giờ bắt đầu | hai ô giờ `HH:MM` "Từ" – "Đến" | "Tính theo giờ BẮT ĐẦU của ca. 'Đến' không tính: 00:00–06:00 áp cho ca bắt đầu 05:59, không áp cho 06:00. Đến nhỏ hơn Từ = qua nửa đêm" |
| ☐ Theo ngày | chip T2 … CN + danh sách ngày cụ thể (`DateInput` + "Thêm ngày"); nút nhanh "Thêm ngày lễ năm {năm}: 1/1, 30/4, 1/5, 2/9" | "Đúng thứ đã chọn HOẶC đúng một ngày trong danh sách. Tết âm lịch: thêm từng ngày" |
| ☐ Theo loại sự kiện | chip chọn nhiều từ Loại sự kiện (cả loại đang ẩn, ghi "(đang ẩn)") | |
| **Chỉ áp cho** (tuỳ chọn) | chip chọn nhiều Gói; chip chọn nhiều Nhân vật | "Để trống = mọi gói / mọi nhân vật" |
| Số lượng | `Segmented`: "Theo số người của dòng" / "Một lần mỗi dòng" | Ví dụ: "Phù dâu × 2 → phụ phí × 2" |
| Ghi chú | ô chữ ≤ 500 | |
| Bật luật | công tắc | |

Lỗi 400 của máy chủ đặt đúng ô theo `details.issues[].path`. Nút "Lưu" khoá khi đang gửi; POST kèm `Idempotency-Key` (apps/web/src/api/idempotency.ts).

Bố cục 1440 / 1024: hộp rộng 640px. 390: toàn màn, nút Lưu dính dưới.

### 3.4 Lập hợp đồng: ô Sự kiện, ngày của dòng, dòng phụ phí tự thêm (`apps/web/src/features/contracts/`)

Theo ảnh `su-kien-C-lap-hop-dong-*`.

**Mô hình** (`model.ts`):
- `PlacedDraft` (model.ts:57) thêm: `date: string` (`''` = theo ngày sự kiện), `occasionId: string | null`, `surchargeOverrides: { ruleId: string; quantity: number | null; unitPrice: Vnd | null; note: string }[]`, `dismissedRuleIds: string[]`.
- `lineInput` (model.ts:337): ngày dùng cho giờ = `l.date || eventDate` (thay chỗ model.ts:359-361 đang dùng `eventDate` cho mọi dòng). Có giờ mà không có ngày nào → không gửi giờ, và `validateDraft` báo ở ô ngày của dòng: "Chọn ngày cho dòng hoặc ngày sự kiện của hợp đồng". Gửi `occasionId`, `surchargeOverrides` (chỉ phần tử có sửa), `dismissedRuleIds` khi khác rỗng.
- `placedFromView` (model.ts:401): `date = dateOf(scheduledStart)` nếu khác ngày sự kiện của hợp đồng, bằng thì `''`; đọc `occasionId`, `dismissedRuleIds`; `surchargeOverrides` từ `surcharges[]` có `priceVersionId === null` hoặc số lượng khác mặc định.
- `draftFromDetail` (model.ts:423): dòng SURCHARGE **có** `surchargeRuleId` là dòng con → **không** đưa thành dòng gốc (chỉ dòng SURCHARGE gốc mới là `SurchargeDraft`).
- `groupTotal` (model.ts:471): cộng thêm `surcharges[]` chưa huỷ.
- Dòng mới thêm từ Bảng giá: `occasionId` = `occasionId` của dòng đặt chỗ ngay trên (nếu có); `date` = `date` của dòng trên.
- Đổi ngày sự kiện: dòng có `date = ''` đi theo; dòng có ngày riêng giữ nguyên.

**Thẻ dòng gói** (`PackageLineCard.tsx`):

| Hàng | Nhãn | Điều khiển | Tooltip / chú thích |
|---|---|---|---|
| Sự kiện (mới, ngay dưới tên gói) | "Sự kiện" | `OccasionPicker.tsx` (mới): `Select` có chấm màu, mục đầu "Chưa chọn sự kiện"; chỉ loại đang bật; liên kết bên phải **"Sửa danh sách"** → `bang-gia/su-kien` (chỉ khi `catalog.write`) | "Dùng để tô màu ca trên Lịch và để áp luật phụ phí theo sự kiện" |
| Ngày & giờ (đổi từ "Giờ") | "Ngày & giờ" | `DateInput` (giá trị mặc định hiện mờ = ngày sự kiện, chữ "Theo ngày sự kiện") + "HH:MM – HH:MM" như cũ | Ngày khác ngày sự kiện → chip vàng "Khác ngày sự kiện" và nút nhỏ "Về ngày sự kiện". Tooltip: "Mỗi dòng có thể một ngày riêng — ví dụ ăn hỏi 19/11, cưới 22/11 trong cùng hợp đồng" |
| Phụ phí tự thêm (mới, dưới dịch vụ phụ / phí di chuyển) | dòng con thụt lề, mỗi dòng một phụ phí | `AutoSurchargeRows.tsx` (mới): tên phụ phí · "× N" · thành tiền (từ quote) · nhãn mờ **"tự thêm theo luật {tên luật}"** (+ "· đã sửa giá" khi ghi đè) · nút "Sửa" (mở hộp: số lượng, giá ghi đè + lý do bắt buộc) · nút "×" Bỏ | "×": "Bỏ phụ phí này ở dòng này — sẽ không tự thêm lại". Sau khi bỏ hiện dòng mờ "Đã bỏ: {tên luật} · Áp lại" |

**Báo thay đổi** (từ `autoSurcharge` của quote; so với quote trước):
- Luật mới vào `applied` → thông báo nhỏ (toast, 5 giây): "Đã tự thêm {phụ phí} cho dòng {gói — nhân vật} theo luật {tên}".
- Luật rơi khỏi `applied` hoặc vào `removed` → "Đã bỏ {phụ phí} ở dòng {…} vì {không còn khớp luật | luật đã tắt}".
- `skipped` lý do `NO_PRICE` / `SERVICE_UNAVAILABLE` → dòng vàng trong thẻ dòng: "Luật {tên} khớp nhưng {phụ phí chưa có giá | phụ phí đang ngừng} — chưa thêm". `MANUAL_LINE_EXISTS` → "Đã có dòng phụ phí {tên} nhập tay — không tự thêm".
- Mở hợp đồng **nháp cũ** lần đầu: nếu quote có `applied` mà bản đã lưu chưa có → dải xanh đầu màn "Luật phụ phí đã thêm N dòng — kiểm lại trước khi lưu".

`matchQuote` (model.ts:456) **không** đổi: dòng tự thêm là dòng con nên số dòng gốc không đổi.

**Màn hợp đồng đã xác nhận / bản in** (`ContractEditor.tsx`, `ContractPrint.tsx`): dòng tự thêm hiện như dịch vụ phụ, kèm chữ nhỏ "(tự thêm theo luật …)" ở màn; bản in **không** in chữ luật (khách không cần), chỉ in tên phụ phí và tiền. Ngày của dòng in cạnh giờ khi hợp đồng có hơn một ngày.

Bố cục: 1440 / 1024 như hôm nay (thẻ dòng rộng). 390: hàng "Sự kiện" chiếm cả hàng, "Sửa danh sách" xuống dưới; hàng "Ngày & giờ" chia hai hàng: ngày / giờ – giờ; dòng tự thêm: tên + tiền một hàng, nhãn luật + nút hàng dưới.

### 3.5 Lịch: công tắc "Tô màu" (`apps/web/src/features/schedule/`)

Theo ảnh `su-kien-C-lich-*`.

- `ColorBySwitch.tsx` (mới): `Segmented` hai nút **"Sự kiện" / "Nhân vật"**, nhãn trước "Tô màu". Đặt trong `Toolbar.tsx` trước nhóm chế độ (Thợ × ngày · Ngày · Cột thợ). 390: thu thành một nút biểu tượng bảng màu mở `BottomSheet` hai lựa chọn. Tooltip: "Đổi cách tô màu ca: theo loại sự kiện của dòng hợp đồng, hoặc theo nhân vật".
- Mặc định: **"Nhân vật"** (giữ đúng màu hôm nay; dữ liệu cũ chưa có sự kiện sẽ toàn màu trắng nếu mặc định "Sự kiện"). **Không nhớ** lựa chọn (giống chế độ xem, model.ts:10-13). Đây là câu hỏi mở số 2 cho anh.
- `model.ts`: `SWATCHES` (model.ts:25) **nhập từ** `OCCASION_COLORS` của shared (một nguồn); hàm mới `occasionSwatch(a): Swatch` = `a.occasion?.color ?? 'other'`; `swatchOf(a, colorBy)` chọn theo công tắc.
- Chữ trên ô ca khi tô theo Sự kiện: **"{sự kiện} · {nhân vật}"** (ví dụ "Lễ cưới · Cô dâu"); ca chưa có sự kiện: "{tên ca} — {nhân vật}" như cũ. Khi tô theo Nhân vật: giữ nguyên chữ hôm nay.
- Chú thích dưới lưới đổi theo công tắc: Sự kiện → danh sách loại đang bật có ca trong tuần + "Chưa chọn sự kiện" (ô trắng viền) + "Chưa có thợ" + "Không chặn lịch"; Nhân vật → như hôm nay.
- `AppointmentDialog.tsx`: thêm dòng chỉ đọc "Sự kiện: {tên}" (chấm màu) khi ca có sự kiện.
- Áp cho cả `WeekGridC`, `WeekGridCMobile`, `DayListB`, `StaffColumnsA`, `parts.tsx` (mọi chỗ đang gọi `swatchOf`).

---

## 4. Bài thử bắt buộc, cửa gác, đột biến

### 4.1 Bài thử máy chủ (tệp mới, mỗi gói một tệp)

| Tệp | Gói | Ca bắt buộc |
|---|---|---|
| apps/api/test/hom-nay-su-kien-phu-phi-db.test.ts | M1 | **Ghi thẳng database** (đi vòng máy chủ, như db-guards.test.ts:103), mỗi chốt một ca sai + một ca đúng: `surcharge_rules_window` với (start NULL, end 300), (start 300, end NULL), (300, 300), (1440, 60) → bị chặn; (1320, 240) → được. `surcharge_rules_weekdays` với `{8}`, `{NULL}` → chặn. `occasions_color` 'red' → chặn. `surcharge_rule_targets_one` với 0 mã, 2 mã → chặn. `contract_lines_occasion`: có id không tên, có tên không id, id ở dòng CUSTOM → chặn. `contract_lines_auto_surcharge`: có luật mà kind PACKAGE, có luật mà không có dòng cha, có id không tên → chặn. `contract_lines_dismissed_rules`: mảng ở dòng SURCHARGE, có NULL, 51 phần tử → chặn. Chỉ mục `contract_lines_one_auto_per_rule`: hai dòng tự thêm cùng (cha, luật) chưa huỷ → chặn; một đã huỷ → được. Khoá ngoại kép: `occasion_id` của tổ chức khác → chặn. Dòng đã xác nhận: đổi `occasion_id` → bị trigger chặn. In số đếm "chặn được N/N" |
| apps/api/test/loai-su-kien.test.ts | M3 | Tổ chức mới có đúng 6 loại mặc định, đúng màu; `sync-system-roles` bù cho tổ chức 0 loại, chạy lần hai không thêm; trùng tên 409; quá 50 loại 409; PATCH một trường giữ các trường khác; `PUT order` thiếu / thừa / trùng / mã bịa / mã tổ chức khác → **cùng** 400 cùng lời; `lineCount` đếm đúng, bỏ dòng đã huỷ; người chỉ có `catalog.read` POST → 403; nhật ký có đủ 3 hành động |
| apps/api/test/luat-phu-phi.test.ts | M3 | Thiếu mọi điều kiện → 400 đúng `path`; chỉ có `packageIds` → 400; một đầu khung giờ → 400; dịch vụ MAIN → 400; dịch vụ ngừng → 400; dịch vụ / loại / gói / nhân vật của tổ chức khác → 404 **giống hệt** mã bịa; 51 luật bật → 409; PATCH ghép rồi kiểm (bỏ khung giờ khi không còn điều kiện nào khác → 400); `status` đúng 4 giá trị; `currentPrice` đúng giá hiện hành; Quản lý (có `prices.write`) được, Lễ tân (không có) → 403 |
| apps/api/test/phu-phi-tu-dong.test.ts | M4 | Bảng "khớp / không khớp" chạy qua **quote**: biên khung giờ 05:59 khớp, 06:00 không; khung qua nửa đêm 23:30 và 03:00 khớp, 12:00 không; ngày theo **múi giờ tổ chức** (tổ chức `Asia/Ho_Chi_Minh`, ca 2026-12-31T17:30Z = 00:30 ngày 01/01 → khớp luật ngày 01/01); thứ trong tuần HOẶC ngày cụ thể; sự kiện; gói; nhân vật; dòng chưa có giờ lấy ngày sự kiện. Hai luật khác dịch vụ → 2 dòng; hai luật cùng dịch vụ → 1 dòng (luật `sortOrder` nhỏ), `skipped SAME_SERVICE`. `perQuantity` true × 2 / false × 1. Phụ phí chưa có giá → không thêm, `skipped NO_PRICE`, hợp đồng vẫn tạo được. Có dòng phụ phí nhập tay cùng dịch vụ → `MANUAL_LINE_EXISTS`. **Bỏ** (dismissed) → không thêm; đổi giờ đi rồi đổi lại → vẫn không thêm. Ghi đè giá thiếu ghi chú → 400; có ghi chú → `priceVersionId = null`. Đổi giờ để hết khớp → dòng tự thêm mất, override vào `removed`. `dismissedRuleIds` / `surchargeOverrides` mã tổ chức khác = mã bịa = 404 cùng lời. Tổng = cộng mọi dòng (kể cả tự thêm) — so `subtotal` của database. Giá × số lượng vượt `MAX_MONEY_VND` → 400 lời có tên dòng. Hợp đồng đã xác nhận: sửa / tắt luật, đổi giá → hợp đồng **không đổi một đồng**. Thêm dòng phát sinh sau xác nhận khớp luật → dòng tự thêm có `addedAfterConfirm = true`. Huỷ dòng gói → dòng tự thêm huỷ theo. Nháp cũ (tạo trước khi có luật) PATCH `lines` → nhận dòng tự thêm. **Hai lần quote liên tiếp cùng thân → cùng kết quả** (không phụ thuộc thứ tự đọc database) |
| apps/api/test/su-kien-dong-hop-dong.test.ts | M4 | Chọn loại → dòng lưu `occasionId` + `occasionName`; đổi tên loại sau → dòng giữ tên cũ; loại ẩn → 400; dòng CUSTOM gửi `occasionId` → 400 (không nhận trường); hợp đồng nhiều ngày: hai dòng hai ngày khác nhau → xác nhận sinh 2 ca đúng 2 ngày |
| apps/api/test/lich-su-kien.test.ts | M5 | Ca sinh từ dòng có sự kiện trả `occasion { name, color }`; đổi màu loại → ca trả màu mới, tên giữ bản chụp; ca lẻ → `occasion = null`; thợ (`read_own`) đọc được `occasion` của ca mình |
| apps/api/test/hom-nay.test.ts | M6 | Mỗi vai trò mẫu (Chủ, Quản lý, Lễ tân, Kế toán, Thợ, Giảng viên, Trợ giảng) → đúng tập trường `null` / không `null` (bảng ở mục 2.6). Thợ chỉ thấy ca có mình. Đợt: thu một phần → `PARTIAL`; thu đủ → biến khỏi danh sách; quá hạn đúng `overdueDays` theo múi giờ tổ chức; hợp đồng nháp / huỷ có đợt quá hạn → **không** hiện. Lễ tân có `customers.read` thấy SĐT; Kế toán có — đổi vai trò tuỳ chỉnh không `customers.read` → `phoneHidden: true`. Ca chưa có thợ: chỉ MAKEUP, chỉ chờ xác nhận / đã xác nhận, trong 7 ngày. Hợp đồng xác nhận 25 giờ trước → không hiện. Tổ chức không phải ACADEMY → `newEnrollments = null`, `almostFullClasses = null`. Lớp 9/12 hiện, 8/12 không, 12/12 không. Số câu truy vấn không tăng theo số hợp đồng (đếm qua log Prisma: 5 hợp đồng và 50 hợp đồng cùng số câu) |

Bài thử shared: packages/shared/src/surcharges.test.ts (`inWindow` mọi biên, `ruleMatches` từng điều kiện, `pickSurchargeRules` thứ tự + khử trùng + dismissed, `localDateAndMinute` qua nửa đêm và múi giờ khác `Asia/Bangkok`); packages/shared/src/occasions.test.ts (12 màu không trùng, 6 mặc định dùng màu có trong danh sách).

### 4.2 Cửa gác (gói M7)

`apps/api/test/gate.ts` — `setupOrg` (gate.ts:178) thêm, **sau** phần tạo gói / nhân vật / khách:
- `surchargeServiceId` = POST `/services` `{ code: 'PP{label}', name: 'Phụ phí {label}', kind: 'SURCHARGE', listPrice: 200000 }`.
- `occasionId` = POST `/occasions` `{ name: 'Sự kiện {label}', color: 'brick' }`; đọc GET `/occasions`, ghi 6 loại mặc định vào `occasionSeed1` … `occasionSeed6` (cần cho mẫu `PUT /occasions/order`, vì cửa gác chỉ thay được giá trị là mã có trong `ids`).
- `surchargeRuleId` = POST `/surcharge-rules` `{ name: 'Ca sớm {label}', serviceId: surchargeServiceId, startTime: '04:00', endTime: '06:00' }`.
- `surchargeRule2Id` = POST `/surcharge-rules` `{ name: 'Theo sự kiện {label}', serviceId: surchargeServiceId, occasionIds: [occasionId] }`.
- `todayContractId`: hợp đồng một dòng CUSTOM 300.000 ₫, **xác nhận**, rồi PUT tiến độ hai đợt: 100.000 ₫ hạn `now − 2 ngày`, 200.000 ₫ hạn `now + 3 ngày`. Và một ca `PENDING_CONFIRMATION` không thợ, bắt đầu `now + 1 ngày` (`todayAppointmentId`). Mục đích: GET `/today` của tổ chức có dữ liệu thật để phép **leak** đo được.
- Thêm các khoá trên vào `ids`.

`apps/api/test/gate-samples.ts`:

```ts
// SAMPLES
'PATCH /orgs/:orgId/occasions/:occasionId': () => ({ name: 'Đổi tên thử' }),
'PATCH /orgs/:orgId/surcharge-rules/:surchargeRuleId': () => ({ note: 'Sửa thử' }),

// REF_SAMPLES — mẫu [0] của các đường hợp đồng GIỮ NGUYÊN (bài thử cũ dựng trên mẫu [0]); thêm mẫu MỚI ở cuối.
const placedWithRules = (o: GateOrg) => ({
  ...packageLine(o),
  occasionId: o.ids.occasionId,
  surchargeOverrides: [{ ruleId: o.ids.surchargeRuleId, quantity: 1 }],
  dismissedRuleIds: [o.ids.surchargeRule2Id],
});
// thêm vào 'POST /orgs/:orgId/contracts/quote', 'POST /orgs/:orgId/contracts', 'PATCH /orgs/:orgId/contracts/:contractId'
//   một mẫu dùng lines: [placedWithRules(o)]; thêm placedWithRules vào 'POST /orgs/:orgId/contracts/:contractId/lines'.
'POST /orgs/:orgId/surcharge-rules': [(o) => ({
  name: `Luật ${code()}`, serviceId: o.ids.surchargeServiceId, startTime: '04:00', endTime: '06:00',
  occasionIds: [o.ids.occasionId], packageIds: [o.ids.packageId], subjectIds: [o.ids.subjectId], isActive: false,
})],
'PATCH /orgs/:orgId/surcharge-rules/:surchargeRuleId': [(o) => ({
  serviceId: o.ids.surchargeServiceId, occasionIds: [o.ids.occasionId], packageIds: [o.ids.packageId], subjectIds: [o.ids.subjectId],
})],
'PUT /orgs/:orgId/occasions/order': [(o) => ({
  occasionIds: [1, 2, 3, 4, 5, 6].map((i) => o.ids[`occasionSeed${i}`]).concat(o.ids.occasionId),
})],

// PARTIAL_SAMPLES
'PATCH /orgs/:orgId/occasions/:occasionId': {
  full: () => ({ name: 'Sự kiện đủ', color: 'plum', sortOrder: 7, isActive: false }),
  one: () => ({ name: 'Sự kiện đổi tên' }),
},
'PATCH /orgs/:orgId/surcharge-rules/:surchargeRuleId': {
  full: (c) => ({
    name: 'Luật đủ', serviceId: c.o.ids.surchargeServiceId, startTime: '22:00', endTime: '04:00',
    weekdays: [6, 7], dates: ['2027-01-01'], occasionIds: [c.o.ids.occasionId], packageIds: [c.o.ids.packageId],
    subjectIds: [c.o.ids.subjectId], perQuantity: false, note: 'Ghi chú đủ', sortOrder: 9, isActive: false,
  }),
  one: () => ({ note: 'Ghi chú đổi' }),
},
```

Mẫu `isActive: false` ở POST luật để cửa gác chạy nhiều lần không chạm trần 50 luật bật. Phép **keep**: POST / PATCH / PUT thân rỗng phải 400 (không 404/409/500); GET `/today`, `/occasions`, `/surcharge-rules` phải 200.

Đo mẫu số: gói H1 ghi số đường và số phép của cửa gác **trước** khi làm; M7 ghi **sau**. Số đường tăng đúng **7** (`GET/POST /occasions`, `PATCH /occasions/:occasionId`, `PUT /occasions/order`, `GET/POST /surcharge-rules`, `PATCH /surcharge-rules/:surchargeRuleId`) **+ 1** (`GET /today`) = **8**; số phép crossRef tăng ít nhất số trường `…Id(s)` mới. Mẫu số tụt hoặc tăng lệch → dừng, tìm (sổ lỗi 15).

### 4.3 Đột biến phải có (gate-mutants.test.ts, đều phải làm cửa gác **đỏ**)

| # | Đột biến | Phép phải đỏ |
|---|---|---|
| D1 | `GET /occasions` quên `organizationId` trong `where` | leak |
| D2 | Kiểm `dismissedRuleIds` bằng `findMany({ where: { id: { in } } })` không lọc tổ chức (mảng không có khoá ngoại → mã của A lọt, 2xx) | crossRef |
| D3 | `GET /today` đọc đợt thu không lọc tổ chức | leak |

Đột biến tay (thợ chạy, ghi kết quả vào báo cáo, **không** để lại trong mã): (a) đổi `inWindow` thành `m <= end` → phu-phi-tu-dong.test.ts đỏ ở ca 06:00; (b) bỏ chuyển múi giờ trong `localDateAndMinute` → đỏ ở ca 00:30 ngày 01/01; (c) bỏ bước khử trùng dịch vụ → đỏ ở ca SAME_SERVICE; (d) bỏ lưu `dismissedSurchargeRuleIds` → đỏ ở ca "đổi giờ đi rồi đổi lại"; (e) trả `installments` khi thiếu `payments.read` → hom-nay.test.ts đỏ ở vai trò Thợ; (f) bỏ `IS NOT NULL` ở vế hai `surcharge_rules_window` trong migration thử → db test đỏ ở ca (NULL, 300). Mỗi đột biến: chạy, thấy đỏ, hoàn lại, thấy xanh.

### 4.4 Bài thử web

| Tệp | Gói | Ca |
|---|---|---|
| apps/web/src/api/khop-kieu.test.ts, duong-api.test.ts | W0 | Khuôn `TodayView`, `OccasionView`, `SurchargeRuleView`, `LineView` mới khớp JSON máy chủ thật; mỗi hàm gọi đúng đường, phương thức, `Idempotency-Key` chỉ ở POST tạo |
| apps/web/src/layout/AppShell.test.tsx (thêm ca) | W0 | Đăng nhập xong vào thẳng `/hom-nay`; thợ có thanh dưới Hôm nay · Lịch · Thêm |
| apps/web/src/features/today/TodayPage.test.tsx | W1 | Thẻ `null` không vẽ; thẻ rỗng có câu; nút "Mở Thu tiền" chỉ khi `payments.write`; "Phân thợ" dẫn đúng `lich?ngay=&ca=`; giao diện OWN không có 4 ô số; thu gọn nhớ qua lần tải lại; `localStorage` ném lỗi vẫn vẽ được |
| apps/web/src/features/pricing/PricingPage.test.tsx (thêm ca) | W2 | Loại sự kiện: đổi màu gửi PATCH; kéo / nút ↑↓ gửi PUT đủ danh sách; không quyền thì không có tay nắm. Luật: không tick điều kiện nào thì nút Lưu báo lỗi của máy chủ đúng ô; tóm tắt điều kiện đúng chữ; thẻ vàng theo `status` |
| apps/web/src/features/contracts/model.test.ts, ContractEditor.test.tsx (thêm ca) | W3 | Dòng có ngày riêng gửi `scheduledStart` đúng ngày đó; đổi ngày sự kiện kéo theo dòng `date=''`, không kéo dòng có ngày riêng; dòng mới lấy sự kiện + ngày của dòng trên; bỏ dòng tự thêm → gửi `dismissedRuleIds`; "Áp lại" → bỏ khỏi mảng; toast khi `applied` mới; dòng tự thêm **không** thành dòng gốc khi mở hợp đồng đã lưu; web **không** tự cộng tiền phụ phí (tổng lấy từ quote) |
| apps/web/src/features/schedule/model.test.ts, SchedulePage.test.tsx (thêm ca) | W4 | `SWATCHES` = `OCCASION_COLORS`; công tắc mặc định "Nhân vật"; bật "Sự kiện" → ô ca dùng màu loại, ca không sự kiện dùng `other`; chữ "Lễ cưới · Cô dâu"; chú thích đổi theo công tắc |

---

## 5. Gói việc theo tệp

Luật chung: mỗi tệp chỉ thuộc **một** gói. Gói chạy song song không chung tệp nào. Thợ **không** sửa tệp ngoài danh sách; cần sửa thì báo điều phối. Mỗi gói xong: `pnpm -r typecheck`, bài thử của gói xanh, bài thử cũ không đỏ thêm. Không chạy `git` (điều phối gom theo đúng danh sách tệp — sổ lỗi 23).

| Gói | Model | Tệp được sửa / tạo | Việc | Giờ |
|---|---|---|---|---|
| **H1 Đo trước** | **Haiku** | (không sửa tệp nào; chỉ ghi số vào báo cáo) | Chạy câu đếm mục 1.5 trên database thử; đếm số đường và số phép của cửa gác hiện tại (chạy `tenant-isolation.test.ts`, chép dòng "N/N") | 0,5 |
| **M1 Database** | **Opus** | apps/api/prisma/schema.prisma; apps/api/prisma/migrations/20261019130000_hom_nay_su_kien_phu_phi/migration.sql (mới); apps/api/test/hom-nay-su-kien-phu-phi-db.test.ts (mới) | Mục 1.3, 1.4; `prisma migrate diff` không lệch; áp trên database thử; bài thử ghi thẳng database | 3 |
| **M2 Shared** | **Opus** | packages/shared/src/occasions.ts (mới), surcharges.ts (mới), occasions.test.ts (mới), surcharges.test.ts (mới), index.ts; apps/api/src/modules/courses/sessions.ts (chỉ đổi `zonedInstant` thành nhập từ shared) | Mục 2.2 (hằng), 2.4 (hàm thuần) | 2,5 |
| **M3 Danh mục** | **Opus** | apps/api/src/modules/catalog/occasions.ts (mới), surcharge-rules.ts (mới), routes.ts; apps/api/src/modules/orgs/routes.ts (cài 6 loại); apps/api/src/scripts/sync-system-roles.ts; apps/api/test/loai-su-kien.test.ts (mới), luat-phu-phi.test.ts (mới) | Mục 2.2, 2.3 | 6 |
| **M4 Hợp đồng** | **Opus** | apps/api/src/modules/contracts/schemas.ts, sheet.ts, present.ts, routes.ts, autoSurcharge.ts (mới); apps/api/test/phu-phi-tu-dong.test.ts (mới), su-kien-dong-hop-dong.test.ts (mới) | Mục 2.4 | 9 |
| **M5 Lịch** | **Sonnet** | apps/api/src/modules/schedule/service.ts; apps/api/test/lich-su-kien.test.ts (mới) | Mục 2.5 | 1,5 |
| **M6 Hôm nay** | **Opus** | apps/api/src/modules/today/routes.ts, collect.ts, present.ts (mới); apps/api/src/app.ts (đăng ký); apps/api/test/hom-nay.test.ts (mới) | Mục 2.6 | 6 |
| **M7 Cửa gác** | **Opus** | apps/api/test/gate.ts, gate-samples.ts, gate-mutants.test.ts | Mục 4.2, 4.3; so mẫu số với H1 | 3 |
| **D1 Tài liệu** | **Sonnet** | docs/API_SPEC.md, docs/DATABASE_SCHEMA.md | Ghi 8 đường mới, trường mới của hợp đồng / lịch, 4 bảng + 5 cột | 1 |
| **W0 Nền web** | **Sonnet** | apps/web/src/api/types.ts, catalog.ts, contracts.ts, schedule.ts, today.ts (mới), khop-kieu.test.ts, duong-api.test.ts; apps/web/src/layout/nav.ts, navIcons.tsx, AppShell.test.tsx | Kiểu + hàm gọi API cho mọi đường mới; mục 3.0 (mục Hôm nay, thanh dưới, 2 mục con Bảng giá, biểu tượng) | 3 |
| **W1 Màn Hôm nay** | **Sonnet** | apps/web/src/app/routes.tsx; apps/web/src/features/today/** (mới) | Mục 3.1 | 7 |
| **W2 Bảng giá** | **Sonnet** | apps/web/src/features/pricing/index.tsx, logic.ts, hooks.ts, pricing.css, OccasionsPage.tsx (mới), OccasionDialog.tsx (mới), SurchargeRulesPage.tsx (mới), SurchargeRuleDialog.tsx (mới), PricingPage.test.tsx, logic.test.ts | Mục 3.2, 3.3 | 7 |
| **W3 Hợp đồng** | **Sonnet** | apps/web/src/features/contracts/model.ts, model.test.ts, PackageLineCard.tsx, OccasionPicker.tsx (mới), AutoSurchargeRows.tsx (mới), ContractEditor.tsx, ContractEditor.test.tsx, ContractPrint.tsx, useContractCatalog.ts, contracts.css | Mục 3.4 | 9 |
| **W4 Lịch** | **Sonnet** | apps/web/src/features/schedule/model.ts, model.test.ts, ColorBySwitch.tsx (mới), Toolbar.tsx, parts.tsx, WeekGridC.tsx, WeekGridCMobile.tsx, DayListB.tsx, StaffColumnsA.tsx, AppointmentDialog.tsx, index.tsx, schedule.css, SchedulePage.test.tsx, subjectColors.test.ts | Mục 3.5 | 5 |
| **N1 Nghiệm thu ảnh** | **Sonnet** | docs/nghiem-thu/anh-ban-ve-d/** (mới; chỉ ảnh + một tệp ghi chú) | Chạy app thật trên database thử, chụp mọi màn mục 3 ở 1440 / 1024 / 390, **mở xem từng ảnh**, so với bản mẫu chặng 1, liệt kê chỗ lệch | 3 |

**Tổng ước lượng: 66,5 giờ** (máy chủ + shared + đo + tài liệu 32,5 giờ; web 31 giờ; nghiệm thu ảnh 3 giờ).

Thứ tự và song song:

```
H1 ─► M1 ─┬─► M3 ─► M4 ─┐
     M2 ──┤             ├─► M7 ─► D1
          ├─► M5 ───────┤
          └─► M6 ───────┘
M1 + M2 xong ─► W0 ─┬─► W1 ─┐
                    ├─► W2  ├─► N1 (sau khi M3–M7 và W1–W4 đều xanh)
                    ├─► W3  │
                    └─► W4 ─┘
```

- **M1 trước mọi gói máy chủ** (migration trước). M2 chạy **song song với M1** (không chung tệp; không cần database).
- Sau M1 + M2: **M3, M5, M6 chạy song song** (tệp tách rời). M4 chờ M3 (bài thử M4 tạo luật qua đường của M3).
- **M7 chạy cuối** phía máy chủ: cửa gác cần mọi đường mới đã có.
- **W0 trước mọi gói web** (giữ `types.ts`, `nav.ts` — tệp nhiều gói cùng cần). W0 viết hàm theo hình dạng ở bản vẽ ngay khi M1 + M2 xong; bài khớp kiểu (`khop-kieu.test.ts`) chạy lại khi M3–M6 xong.
- Sau W0: **W1, W2, W3, W4 chạy song song**. W3 cần M4 để chạy thật; W2 cần M3; W1 cần M6; W4 cần M5 — trước đó thợ web dùng dữ liệu giả trong bài thử.
- Hai gói **không bao giờ** chạy cùng lúc trên cùng một tệp: `catalog/routes.ts` chỉ M3; `app.ts` chỉ M6; `sessions.ts` chỉ M2; `routes.tsx` chỉ W1; `nav.ts` chỉ W0.

---

## 6. Cái không làm (đợt này)

- **Không** gửi Zalo / SMS / Email, không chuông, không bảng thông báo, không việc chạy hẹn giờ (thông báo phương án A, C để sau; C dùng lại `today/collect.ts`).
- **Không** thẻ "Mới được phân 24 giờ" của thợ và "Thay đổi 24 giờ qua" (cần `AppointmentStaff.assignedAt` hoặc đọc nhật ký — bản mẫu đánh dấu viền nâu).
- **Không** nút "Ghi phiếu thu" mở sẵn form đúng đợt — đợt này nút đưa tới màn Thu tiền của đúng hợp đồng.
- **Không** đổi màn Thu tiền thành hàng đợi "Quá hạn / 7 ngày tới" (việc tồn 12): đợt này chỉ dựng phần gom dữ liệu `today/collect.ts`, dùng lại được.
- **Không** chọn sự kiện cho **ca lẻ** tạo trên Lịch (không có hợp đồng) — ca lẻ hiện "Chưa chọn sự kiện".
- **Không** phụ phí theo **phần trăm**, không phụ phí theo cả hợp đồng / cả ngày (luật áp theo từng dòng đặt chỗ), không "luật loại trừ luật".
- **Không** tự chạy luật lại lúc xác nhận, không chạm hợp đồng đã xác nhận khi sửa luật.
- **Không** xoá loại sự kiện / luật (chỉ ẩn / tắt).
- **Không** gắn ngày lễ âm lịch tự động (studio thêm từng ngày).
- **Không** đổi danh sách hợp đồng để hiện "nhiều ngày" (vẫn sắp và lọc theo ngày sự kiện của hợp đồng).
- **Không** chế độ tối, không nhớ lựa chọn công tắc Tô màu.

## 7. Câu hỏi còn mở cho anh

1. **Trang mở đầu**: bản vẽ để **Hôm nay** thay Lịch làm trang mở ra đầu tiên, và đẩy "Thu tiền" (ACADEMY) / "Khách" (studio) xuống ngăn "Thêm" trên điện thoại. Anh đồng ý không?
2. **Lịch mở ra tô theo gì**: bản vẽ để **Nhân vật** (giữ màu quen, vì ca cũ chưa có sự kiện). Anh muốn **Sự kiện** thì đổi một dòng.
3. **Luật phụ phí đặt ở Bảng giá** (cạnh Nhân vật, Dịch vụ phụ & phụ phí) thay vì Cài đặt như bản mẫu. Được không?
4. **Ai được cài luật phụ phí**: bản vẽ cho người có quyền **đổi giá** (Chủ, Quản trị, Quản lý). Lễ tân không cài được.
5. **Phụ phí tính theo người**: mặc định "phù dâu × 2 → phụ phí × 2". Studio anh tính theo người hay mỗi ca một lần?
6. **Hợp đồng nháp cũ**: khi mở và lưu lại, luật mới sẽ tự thêm phụ phí (có báo). Anh muốn vậy, hay chỉ áp cho hợp đồng lập từ nay?
