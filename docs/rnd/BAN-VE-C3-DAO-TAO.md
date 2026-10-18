# Bản vẽ C3 — Trung tâm đào tạo (Chặng 2)

- Sản phẩm: Makeup Pro
- Phương án: **C** (điều phối chọn thay anh Chiến, 18/10/2026)
- Mẫu thiết kế: người dùng chọn trong **toàn bộ** bộ mẫu. Mẫu là **dữ liệu**: thêm mẫu không phải sửa màn.
- Bản mẫu nhìn được: /home/user/a/docs/rnd/v3-dao-tao-C.html (các màn ở mục 2)
- Ảnh: /home/user/a/docs/rnd/anh/v3-dao-tao-C-*.png
- Đi kèm, không lặp lại:
  - /home/user/a/docs/rnd/BAN-VE-C.md (token, component, khung, Hợp đồng dịch vụ)
  - /home/user/a/docs/rnd/BAO-CAO-RND-03.md (khảo sát, lý do chọn)

Đọc theo thứ tự:
- **Mục 1 — dữ liệu và API.** Máy chủ khởi công từ đây.
- **Mục 2 — màn hình.**
- **Mục 3 — gói việc theo tệp.**

Quy ước chung (giống bản vẽ C):
- Tiền là `BigInt` đơn vị **đồng**, không có số lẻ.
- Mọi bảng có `organizationId`. Mọi khoá ngoại sang bảng của tổ chức là **khoá kép** `(id, organizationId)`: database chặn trỏ chéo tổ chức.
- Mỗi thay đổi ghi `writeAudit` trong cùng transaction.
- Thêm mới gọi `assertQuota` (lib/quota.ts) trong cùng transaction.

---

## 1. Phần dữ liệu cho máy chủ

### 1.0 Điều kiện "bật đào tạo"

- Dùng trường **đã có**: `Organization.kind = 'ACADEMY'`. Không thêm trường mới.
- `GET /orgs/:orgId` (đã có) trả `kind`. Web đọc trường này để quyết định thanh dưới trên điện thoại:

| Tổ chức | Thanh dưới (điện thoại) | Thanh trái thêm mục |
|---|---|---|
| `ACADEMY` | Lịch · Hợp đồng · Thu tiền · Khoá học · Thêm | Đào tạo (Khoá & lớp), Mẫu thiết kế |
| `INDIVIDUAL`, `TEAM` | Như BAN-VE-C mục 2.3: Lịch · Hợp đồng · Bảng giá · Khách · Thêm | Mẫu thiết kế (Feedback, Lời chúc vẫn dùng cho hợp đồng dịch vụ) |

- Máy chủ chặn khoá học ở tổ chức không phải `ACADEMY`:
  - Mọi đường `/courses`, `/course-groups`, `/classes` trả **403** `FORBIDDEN` với lời "Tổ chức chưa bật đào tạo".
  - Hợp đồng `kind = COURSE` cũng bị chặn như vậy.
- Giới hạn gói **đã có** trong `SubscriptionPlan`: `maxCourses`, `maxStudents`. Cần bổ sung bộ đếm trong `getUsage` (lib/quota.ts):
  - `courses` = số `Course` có `archivedAt IS NULL`.
  - `students` = số **khách khác nhau** có `Enrollment.status = 'ACTIVE'`.

### 1.1 Bảng và trường

Đánh dấu: **[mới]** là bảng hoặc trường cần thêm; **[có]** là đã có trong `schema.prisma`.

#### enum mới

```prisma
enum ContractKind      { SERVICE  COURSE }                 // loại hợp đồng
enum CourseMode        { SINGLE_CLASS  MULTI_CLASS }       // khoá một lớp / nhiều lớp
enum CourseClassStatus { OPEN  CLOSED  CANCELLED }         // CLOSED = ngừng nhận ghi danh (chưa đầy vẫn đóng được)
enum EnrollmentStatus  { ACTIVE  CANCELLED }
enum DesignCardKind    { WELCOME  FEEDBACK  GREETING }      // thẻ chào mừng / feedback / lời chúc
enum ContractTextKind  { TERMS  RULES }                     // điều khoản / nội quy
// thêm giá trị vào enum ĐÃ CÓ:
//   ContractLineKind += COURSE
//   FilePurpose      += DESIGN_PHOTO (ảnh người dùng tải lên cho thẻ), DESIGN_CARD (ảnh PNG đã xuất)
//   (WELCOME_CARD đã có — không dùng nữa, để nguyên cho khỏi đổi enum đang chạy)
```

#### CourseGroup [mới] — nhóm khoá (trung tâm tự đặt tên)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| organizationId | uuid | |
| name | String | duy nhất trong tổ chức |
| sortOrder | Int = 0 | |
| isActive | Boolean = true | ẩn nhóm, không xoá |
| createdAt, updatedAt | | |

- Ràng buộc: `@@unique([organizationId, name])`, `@@unique([id, organizationId])`.

#### Course [mới] — khoá học

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| organizationId | uuid | |
| groupId | uuid? | → CourseGroup (khoá kép). Null = "Chưa xếp nhóm" |
| code | String | mã khoá, ví dụ `NC-03`. Máy chủ tự sinh nếu bỏ trống: `KH-0001` qua `org_counters` key `course` |
| name | String | **bắt buộc**, 1–200 ký tự |
| mode | CourseMode | **bắt buộc**; Một lớp / Nhiều lớp |
| tuitionFee | BigInt | **bắt buộc**, học phí (đồng) |
| depositAmount | BigInt = 0 | cọc mặc định (gợi ý khi lập hợp đồng) |
| defaultCapacity | Int | **bắt buộc**; số học viên tối đa mặc định, gợi ý khi mở lớp |
| sessionCount | Int? | số buổi (không bắt buộc) |
| sessionMinutes | Int? | phút mỗi buổi (không bắt buộc) |
| description | String? | ≤ 2000 ký tự |
| sortOrder | Int = 0 | |
| archivedAt | DateTime? | lưu trữ thay cho xoá; khoá đã có hợp đồng không xoá được |
| createdById | uuid | |
| createdAt, updatedAt | | |

- Ràng buộc: `@@unique([organizationId, code])`, `@@unique([id, organizationId])`.
- CHECK:
  - `tuition_fee >= 0`
  - `deposit_amount >= 0 AND deposit_amount <= tuition_fee`
  - `default_capacity BETWEEN 1 AND 500`
  - `session_count IS NULL OR session_count BETWEEN 1 AND 365`
  - `session_minutes IS NULL OR session_minutes BETWEEN 15 AND 720`
- **Đổi học phí không đổi hợp đồng cũ.**
  - Dòng hợp đồng chép `unitPrice` lúc thêm, như dòng dịch vụ.
  - Vì vậy khoá học **không** dùng `PriceVersion`. Lịch sử giá xem ở nhật ký thay đổi.

#### CourseClass [mới] — lớp (đợt khai giảng)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| organizationId | uuid | |
| courseId | uuid | → Course (khoá kép) |
| name | String | **bắt buộc**. Khoá Một lớp: bằng tên khoá, máy chủ tự đặt, người dùng không thấy. Khoá Nhiều lớp: ví dụ "Nâng cao K1" |
| startDate | Date (`@db.Date`) | **bắt buộc** |
| endDate | Date (`@db.Date`) | **bắt buộc** |
| weekdays | Int[] | **bắt buộc**; 1 = Thứ Hai … 7 = Chủ nhật (ISO), không trùng, ít nhất 1 ngày |
| startMinute | Int? | giờ bắt đầu tính bằng phút từ 0:00 (18:00 → 1080) |
| endMinute | Int? | giờ kết thúc |
| capacity | Int | **bắt buộc**; số học viên tối đa **của lớp này** (mặc định lấy `Course.defaultCapacity`) |
| enrolledCount | Int = 0 | số đã ghi danh, máy chủ tự đếm (mục 1.2). Không nhận từ máy khách |
| status | CourseClassStatus = OPEN | |
| instructorMembershipId | uuid? | giảng viên (ai) → Membership (khoá kép) |
| studioLocationId | uuid? | ở đâu → StudioLocation (khoá kép) |
| note | String? | |
| createdById | uuid | |
| createdAt, updatedAt | | |

- Ràng buộc: `@@unique([id, organizationId])`, `@@unique([courseId, name])`, `@@index([organizationId, startDate])`.
- CHECK:
  - `capacity BETWEEN 1 AND 500`
  - `enrolled_count >= 0 AND enrolled_count <= capacity` — **chốt cuối chặn vượt số tối đa**
  - `end_date >= start_date`
  - `cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]`
  - `(start_minute IS NULL) = (end_minute IS NULL)`
  - `start_minute IS NULL OR (start_minute BETWEEN 0 AND 1439 AND end_minute > start_minute AND end_minute <= 1440)`
- **Khoá Một lớp chỉ có đúng 1 lớp chưa huỷ.** Dùng trigger, vì CHECK không đọc được bảng khác:
  - Tên trigger: `course_classes_single_guard`, chạy `BEFORE INSERT OR UPDATE OF course_id, status`.
  - Báo lỗi khi `courses.mode = 'SINGLE_CLASS'` mà khoá đã có một lớp khác với `status <> 'CANCELLED'`.
  - Mã lỗi Postgres `23514`. Máy chủ đổi thành 409 với lời "Khoá một lớp chỉ có một lớp — chuyển sang Nhiều lớp để mở thêm".

#### Enrollment [mới] — ghi danh (một học viên vào một lớp, sinh từ hợp đồng)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| organizationId | uuid | |
| courseClassId | uuid | → CourseClass (khoá kép) |
| contractId | uuid | → Contract (khoá kép) |
| contractLineId | uuid | → ContractLine (khoá kép), **unique**: một dòng khoá học = một ghi danh |
| customerId | uuid | → Customer (khoá kép), chép từ hợp đồng để đếm và chặn trùng |
| status | EnrollmentStatus = ACTIVE | |
| enrolledAt | DateTime | lúc hợp đồng xác nhận |
| cancelledAt | DateTime? | |
| cancelReason | String? | |

- Ràng buộc:
  - `@@unique([contractLineId])`
  - `@@index([courseClassId, status])`
  - Index duy nhất **một phần**: `CREATE UNIQUE INDEX enrollments_one_active ON enrollments(course_class_id, customer_id) WHERE status = 'ACTIVE'` — một học viên không ghi danh hai lần vào cùng một lớp.
- CHECK: `(status = 'CANCELLED') = (cancelled_at IS NOT NULL)`.
- **Hợp đồng nháp không giữ chỗ.** Chỗ chỉ bị trừ khi hợp đồng **xác nhận** (mục 1.2).

#### Contract [có] — thêm trường

| Trường | Kiểu | Ghi chú |
|---|---|---|
| kind | ContractKind = SERVICE | **[mới]**. Đặt lúc tạo, không đổi được sau đó |
| ownerMembershipId | uuid? | **[mới]**; người phụ trách (tư vấn, nhắc đóng tiền) → Membership (khoá kép) |
| rules | String? | **[mới]**; bản chụp nội quy lúc xác nhận (`terms` **[có]** giữ bản chụp điều khoản) |
| termsTemplateId, termsTemplateVersion | uuid?, Int? | **[mới]**; mẫu điều khoản đã chụp |
| rulesTemplateId, rulesTemplateVersion | uuid?, Int? | **[mới]**; mẫu nội quy đã chụp |

- Mã hợp đồng khoá học: tiền tố `HĐKH-` (dịch vụ giữ `HĐ-`), bộ đếm riêng key `contract_course`.
- CHECK: `kind = 'COURSE' OR (rules IS NULL)`. Nội quy chỉ có ở hợp đồng khoá học.

#### ContractLine [có] — thêm trường

| Trường | Kiểu | Ghi chú |
|---|---|---|
| courseClassId | uuid? | **[mới]** → CourseClass (khoá kép) |

- CHECK: `(kind = 'COURSE') = (course_class_id IS NOT NULL)`.
- Dòng `COURSE`:
  - `name` = tên khoá + " · " + tên lớp (chép lúc thêm).
  - `unitPrice` = `Course.tuitionFee` lúc thêm.
  - `quantity = 1`.
  - Không có `travel*`, `subject*`, `scheduledStart`.
- Luật trộn dòng (kiểm ở máy chủ, có bài thử):
  - Hợp đồng `COURSE` chỉ nhận dòng `COURSE` và `CUSTOM` (giáo trình, dụng cụ…).
  - Hợp đồng `SERVICE` không nhận dòng `COURSE`.

#### ContractText [mới] — mẫu điều khoản / nội quy

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| organizationId | uuid | |
| kind | ContractTextKind | |
| appliesTo | ContractKind[] | rỗng = cả hai loại |
| name | String | |
| body | String | ≤ 20000 ký tự |
| version | Int = 1 | tăng 1 mỗi lần sửa nội dung |
| isDefault | Boolean = false | mẫu gợi ý khi lập hợp đồng |
| isActive | Boolean = true | |
| updatedById | uuid | |
| updatedAt | | |

- Ràng buộc: `@@unique([id, organizationId])`.
- Mỗi `(organizationId, kind)` có tối đa 1 mẫu `isDefault`: index duy nhất một phần `WHERE is_default`.

#### Customer [có] — thêm trường

| Trường | Kiểu | Ghi chú |
|---|---|---|
| avatarFileId | uuid? | **[mới]** → StoredFile (khoá kép), purpose `CUSTOMER_AVATAR` |

Ảnh học viên trên thẻ chào mừng lấy từ đây.

#### GreetingPhrase [mới] — câu chúc soạn sẵn (cho Lời chúc)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| organizationId | uuid | |
| name | String | ví dụ "Ngày cưới" |
| appliesTo | ContractKind[] | rỗng = cả hai |
| title | String | ≤ 120, ví dụ "Trăm năm hạnh phúc" |
| body | String | ≤ 1000 |
| sortOrder | Int = 0 | |
| isActive | Boolean = true | |
| createdAt, updatedAt | | |

- Lúc tạo tổ chức, chép 6 câu mặc định `DEFAULT_GREETING_PHRASES` từ `packages/shared`, giống `DEFAULT_MAKEUP_SUBJECTS`.
- Nội dung 6 câu lấy nguyên văn trong `tpl_lc.py` / trang bày mẫu (BAO-CAO-RND-03 mục 8b).

#### DesignCard [mới] — thẻ đã tạo (chào mừng / feedback / lời chúc)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| organizationId | uuid | |
| kind | DesignCardKind | |
| templateCode | String | mã mẫu trong danh mục mẫu (mục 1.4), ví dụ `shd-01`, `fb-02`, `lc-01` |
| templateVersion | Int | phiên bản mẫu lúc tạo |
| contractId | uuid | **bắt buộc** → Contract (khoá kép); hợp đồng nguồn, khoá học hay dịch vụ |
| customerId | uuid | → Customer (khoá kép), chép từ hợp đồng |
| courseClassId | uuid? | → CourseClass (khoá kép); thẻ chào mừng / lời chúc khoá học |
| title | String? | ≤ 120; tiêu đề lời chúc |
| body | String? | ≤ 2000; lời khen (FEEDBACK) hoặc câu chúc (GREETING) |
| rating | Int? | 1–5; chỉ FEEDBACK |
| receivedAt | Date? | ngày nhận lời khen; chỉ FEEDBACK |
| fontOverride | String? | ví dụ `ky-2`; người dùng đổi sang phông chữ ký (mục 1.4) |
| size | String | `1080x1350` hoặc `1080x1080` |
| snapshot | Json | **giá trị đã điền lúc xuất ảnh**: tên, khoá, ngày, thương hiệu… Tải lại ảnh cũ ra đúng như cũ dù hồ sơ đã đổi |
| outputFileId | uuid? | → StoredFile (khoá kép), purpose `DESIGN_CARD`; ảnh PNG đã xuất |
| createdById | uuid | ai làm |
| createdAt, updatedAt | | khi nào |
| deletedAt | DateTime? | |

- Ràng buộc: `@@unique([id, organizationId])`, `@@index([organizationId, kind, createdAt])`, `@@index([contractId])`.
- CHECK:
  - `kind <> 'FEEDBACK' OR body IS NOT NULL`
  - `kind <> 'GREETING' OR body IS NOT NULL`
  - `rating IS NULL OR (kind = 'FEEDBACK' AND rating BETWEEN 1 AND 5)`
  - `size IN ('1080x1350','1080x1080')`
- Máy chủ kiểm thêm:
  - `templateCode` có trong danh mục mẫu.
  - Loại hợp đồng hợp với mẫu: `contractKinds` của mẫu chứa `Contract.kind`. Nếu không, trả 422 "Mẫu này chỉ dùng cho hợp đồng …".

#### DesignCardPhoto [mới] — ảnh người dùng tải lên cho thẻ (1–3 ảnh)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| cardId | uuid | → DesignCard (khoá kép), xoá thẻ thì xoá dòng |
| organizationId | uuid | |
| fileId | uuid | → StoredFile (khoá kép), purpose `DESIGN_PHOTO` |
| sortOrder | Int | 0, 1, 2 |

- Ràng buộc: `@@id([cardId, sortOrder])`.
- CHECK: `sort_order BETWEEN 0 AND 2` (tối đa 3 ảnh).
- Số ảnh tối thiểu theo mẫu (`photos.min` ở mục 1.4) do máy chủ kiểm.

### 1.2 Luật database và transaction phải chặn

| Luật | Chặn ở đâu | Lời báo (tiếng Việt) |
|---|---|---|
| Vượt số tối đa của lớp | (1) Xác nhận hợp đồng: `UPDATE course_classes SET enrolled_count = enrolled_count + 1 WHERE id = $1 AND organization_id = $2 AND status = 'OPEN' AND enrolled_count < capacity RETURNING id`. Không có dòng trả về → 409. (2) CHECK `enrolled_count <= capacity` chặn mọi đường khác | "Lớp Nâng cao K1 đã đủ 8/8 học viên" |
| Hai người cùng xác nhận vào chỗ cuối | Câu UPDATE có điều kiện ở trên khoá dòng lớp. Người thứ hai nhận 0 dòng → 409 | như trên |
| Giảm số tối đa xuống dưới số đã ghi danh | CHECK `enrolled_count <= capacity` (lỗi 23514 → 409) | "Lớp đã có 9 học viên — không đặt tối đa thấp hơn 9" |
| Ghi danh trùng một học viên vào một lớp | index duy nhất một phần `enrollments_one_active` | "Học viên này đã ghi danh lớp K12" |
| Khoá Một lớp có lớp thứ hai | trigger `course_classes_single_guard` | "Khoá một lớp chỉ có một lớp — chuyển sang Nhiều lớp để mở thêm" |
| Chuyển Nhiều lớp → Một lớp khi còn > 1 lớp chưa huỷ | kiểm trong transaction, khoá dòng `courses` | "Khoá đang có 3 lớp — chỉ chuyển về Một lớp khi còn 1 lớp" |
| Huỷ hợp đồng / huỷ dòng khoá học | Cùng transaction: `Enrollment.status = CANCELLED`, `enrolled_count - 1` | — |
| Huỷ lớp còn học viên | 409 | "Lớp còn 5 học viên — chuyển hoặc huỷ ghi danh trước" |
| Xoá khoá / lớp đã có dòng hợp đồng | khoá ngoại `onDelete: Restrict`; giao diện chỉ có "Lưu trữ" | "Khoá đã có hợp đồng — chỉ lưu trữ được" |
| Trỏ chéo tổ chức | khoá ngoại kép `(id, organization_id)` ở mọi quan hệ trên | — |
| Tiền | `BigInt` đồng; CHECK ≥ 0; cọc ≤ học phí; máy chủ tính lại `lineTotal`, `total` như hợp đồng dịch vụ | — |
| Hợp đồng khoá học chỉ có dòng COURSE + CUSTOM | kiểm ở máy chủ | "Hợp đồng khoá học không thêm được gói dịch vụ" |
| Mẫu thẻ không hợp loại hợp đồng | kiểm ở máy chủ theo danh mục mẫu | "Mẫu lc-05 chỉ dùng cho hợp đồng khoá học" |
| Giới hạn gói | `assertQuota(tx, orgId, 'courses')` khi tạo khoá; `assertQuota(tx, orgId, 'students')` khi xác nhận hợp đồng khoá học có học viên mới | lời sẵn có của `assertQuota` |

**Đổi Một lớp → Nhiều lớp:**
- `PATCH /courses/:id { mode: 'MULTI_CLASS' }`.
- Lớp duy nhất **giữ nguyên** id, học viên và hợp đồng; chỉ được đổi tên nếu thân yêu cầu có `firstClassName`.
- Không xoá, không chép gì.

### 1.3 Đường API

**Quy ước:**
- Tiền tố `/orgs/:orgId`, dùng `defineRoute` (scope `org`).
- Lỗi theo `AppError`. Mọi POST tạo mới nhận `Idempotency-Key` (`idempotent: true`).
- Phản hồi tiền là số nguyên đồng; ngày dạng `YYYY-MM-DD`; giờ dạng `HH:MM`. Máy chủ đổi giờ ↔ phút.

**Quyền mới** thêm vào `packages/shared/src/permissions.ts`:

| Quyền | Nội dung | Vai trò mẫu |
|---|---|---|
| `courses.read` | Xem khoá, lớp, danh sách học viên của lớp | owner, admin, manager, receptionist, accountant, **instructor** |
| `courses.write` | Thêm, sửa khoá, nhóm, mở/đóng lớp | owner, admin, manager |
| `designs.read` | Xem thẻ đã tạo | owner, admin, manager, receptionist, instructor |
| `designs.write` | Tạo thẻ, tải ảnh thẻ, sửa câu chúc soạn sẵn | owner, admin, manager, receptionist |
| `contracts.texts` | Sửa mẫu điều khoản / nội quy | owner, admin, manager |

- Giảng viên chỉ thấy lớp mình dạy khi không có `courses.read`. Hiện vai trò mẫu `instructor` **có** `courses.read`; nếu muốn hẹp hơn thì tách `courses.read_own`. Ghi lại để chủ đầu tư quyết.

#### Khoá & lớp

| Method | Path | Quyền | Thân (body / query) | Phản hồi |
|---|---|---|---|---|
| GET | `/course-groups` | courses.read | — | `[{ id, name, sortOrder, isActive, courseCount }]` |
| POST | `/course-groups` | courses.write | `{ name }` | nhóm vừa tạo (201) |
| PATCH | `/course-groups/:groupId` | courses.write | `{ name?, sortOrder?, isActive? }` | nhóm |
| GET | `/courses` | courses.read | query `groupId?`, `q?`, `includeArchived?` | `[{ id, code, name, mode, groupId, tuitionFee, depositAmount, defaultCapacity, classSummary: { total, open, withSeats, nextStartDate } }]` |
| POST | `/courses` | courses.write | `{ name, groupId?, code?, mode, tuitionFee, depositAmount?, defaultCapacity, sessionCount?, sessionMinutes?, description?, firstClass? }`. `mode = SINGLE_CLASS` thì `firstClass` **bắt buộc**: `{ startDate, endDate, weekdays, startTime?, endTime?, capacity, instructorMembershipId?, studioLocationId? }` (name tự đặt). `MULTI_CLASS` thì `firstClass` tuỳ chọn và có thêm `name` | `{ course, classes }` (201) |
| GET | `/courses/:courseId` | courses.read | — | `{ course, classes: [ClassView] }` |
| PATCH | `/courses/:courseId` | courses.write | `{ name?, groupId?, tuitionFee?, depositAmount?, defaultCapacity?, sessionCount?, sessionMinutes?, description?, mode?, firstClassName? }` | `{ course, classes }` |
| POST | `/courses/:courseId/archive` | courses.write | `{ reason? }` | `{ course }` |
| POST | `/courses/:courseId/classes` | courses.write | `{ name, startDate, endDate, weekdays, startTime?, endTime?, capacity?` (bỏ trống = `defaultCapacity`)`, instructorMembershipId?, studioLocationId?, note? }`; chặn khi khoá `SINGLE_CLASS` | `ClassView` (201) |
| PATCH | `/classes/:classId` | courses.write | `{ name?, startDate?, endDate?, weekdays?, startTime?, endTime?, capacity?, instructorMembershipId?, studioLocationId?, status?: 'OPEN'\|'CLOSED', note? }` | `ClassView` |
| POST | `/classes/:classId/cancel` | courses.write | `{ reason }` | `ClassView` |
| GET | `/classes` | courses.read | query `from?`, `to?`, `courseId?`, `hasSeats?`, `instructorId?` | `[ClassView]`; dùng cho ô chọn lớp ở hợp đồng và cho Lịch |
| GET | `/classes/:classId/enrollments` | courses.read | — | `[{ id, customer: { id, fullName, phone }, contract: { id, code, status, total, paid }, status, enrolledAt }]` |

**ClassView** gồm:
- `{ id, courseId, name, startDate, endDate, weekdays, startTime, endTime, capacity, enrolledCount, seatsLeft, seatState, status, instructor: { membershipId, name } | null, location: { id, name, address } | null }`
- `seatState` = `'AVAILABLE' | 'ALMOST_FULL' | 'FULL'`. Luật dùng chung `seatState()` trong `packages/shared`:
  - `FULL` khi `enrolledCount >= capacity`.
  - `ALMOST_FULL` khi `enrolledCount / capacity >= 0.75`.
- Máy chủ và web dùng **cùng một hàm**.

#### Hợp đồng khoá học (mở rộng module contracts đã có)

| Method | Path | Quyền | Thay đổi |
|---|---|---|---|
| POST | `/contracts` | contracts.write | thân thêm `kind: 'SERVICE' \| 'COURSE'` (mặc định `SERVICE`), `ownerMembershipId?`. `LineInputSchema` thêm nhánh `{ kind: 'COURSE', courseClassId }` |
| POST | `/contracts/quote` | contracts.read | nhận dòng `COURSE`. Trả thêm `classes: [{ classId, seatsLeft, seatState }]` để web báo lớp vừa đầy |
| POST | `/contracts/:id/lines` | contracts.write | nhận dòng `COURSE`; lớp `FULL` hoặc `CLOSED` → 409 ngay (báo sớm; chốt thật ở bước xác nhận) |
| POST | `/contracts/:id/status` | contracts.write | `to = CONFIRMED`, trong **cùng** transaction: (1) với mỗi dòng COURSE, chạy câu UPDATE giữ chỗ ở mục 1.2; (2) tạo `Enrollment`; (3) `assertQuota('students')`; (4) chụp `terms` / `rules` từ mẫu mặc định hoặc mẫu đã chọn. `to = CANCELLED`: huỷ ghi danh, trả chỗ |
| POST | `/contracts/:id/lines/:lineId/void` | contracts.adjust | dòng COURSE của hợp đồng đã xác nhận → huỷ ghi danh, trả chỗ |
| GET | `/contracts` | contracts.read | query thêm `kind?`; mỗi dòng trả thêm `kind` |
| GET | `/contract-texts` | contracts.read | query `kind?`, `appliesTo?` → `[ContractText]` |
| POST | `/contract-texts` | contracts.texts | `{ kind, appliesTo, name, body, isDefault? }` |
| PATCH | `/contract-texts/:id` | contracts.texts | sửa `body` thì `version + 1`; hợp đồng đã ký **không** đổi (đã chụp) |

- Thu tiền, tiến độ đợt, phiếu thu: **dùng nguyên module payments**. Hợp đồng khoá học là `Contract` như mọi hợp đồng khác.
- Báo cáo `/reports/revenue` thêm tham số `kind?` và nhóm theo `courseGroupId` / `courseId` (mục 1.5).

#### Mẫu thiết kế và thẻ

| Method | Path | Quyền | Thân (body / query) | Phản hồi |
|---|---|---|---|---|
| GET | `/design-templates` | designs.read | query `kind?`, `contractKind?` | danh mục mẫu (mục 1.4), đã lọc theo loại hợp đồng |
| GET | `/contracts/:contractId/design-data` | designs.read | — | các giá trị ô lấy từ dữ liệu, theo khoá ở mục 1.4: `{ contractKind, th, logoUrl, diachi, sdt, web, ten/kh, anhUrl, khoa, lop, ngay, nkt, lich, gv, nv, goi, nsk }`. Ô nào hợp đồng không có thì trả `null` |
| GET | `/greeting-phrases` | designs.read | query `contractKind?` | `[GreetingPhrase]` |
| POST | `/greeting-phrases` | designs.write | `{ name, appliesTo, title, body }` | 201 |
| PATCH | `/greeting-phrases/:id` | designs.write | `{ name?, appliesTo?, title?, body?, sortOrder?, isActive? }` | |
| POST | `/design-cards` | designs.write | `{ kind, templateCode, contractId, courseClassId?, title?, body?, rating?, receivedAt?, photoFileIds: uuid[0..3], fontOverride?, size, snapshot }` | `DesignCard` (201) |
| PATCH | `/design-cards/:cardId` | designs.write | như trên, trừ `kind`, `contractId` | `DesignCard` |
| PUT | `/design-cards/:cardId/output` | designs.write | `{ fileId }` (ảnh PNG đã tải lên qua `/files`, purpose `DESIGN_CARD`) | `DesignCard` |
| GET | `/design-cards` | designs.read | query `kind?`, `contractId?`, `customerId?`, `from?`, `to?` | `[DesignCard + photos + outputUrl]` |
| DELETE | `/design-cards/:cardId` | designs.write | — | 204 (đặt `deletedAt`) |
| PATCH | `/customers/:customerId` (đã có) | customers.write | thêm `avatarFileId?` | |

- Ảnh tải lên dùng `/files` (đã có), thêm purpose `DESIGN_PHOTO` và `DESIGN_CARD`.
- Ảnh tính vào `storageMb` như mọi tệp.

### 1.4 Danh mục mẫu là dữ liệu

- Tệp: `packages/shared/src/design-templates.ts`.
- Mẫu là **mã và tệp vẽ**, không phải dữ liệu của tổ chức, nên **không** để trong database.
- Máy chủ dùng danh mục để kiểm; web dùng để vẽ ô chọn mẫu và điền ô.
- Thêm mẫu: thêm 1 mục vào danh mục và 1 thư mục vẽ. **Không sửa màn nào.**

```ts
export type DesignKind = 'WELCOME' | 'FEEDBACK' | 'GREETING';
export type ContractKindKey = 'SERVICE' | 'COURSE';
// Khoá ô ↔ nguồn dữ liệu (một nơi duy nhất; DesignCard.snapshot lưu theo đúng các khoá này)
export const SLOT_SOURCES = {
  th:     { label: 'Tên thương hiệu',     from: 'OrganizationProfile.brandName',                 contract: 'BOTH' },
  logo:   { label: 'Logo',                from: 'OrganizationProfile.logoFileId',                contract: 'BOTH' },
  diachi: { label: 'Địa chỉ',             from: 'CourseClass.studioLocation.address ?? OrganizationProfile.address', contract: 'BOTH' },
  sdt:    { label: 'Số điện thoại',       from: 'OrganizationProfile.phone',                     contract: 'BOTH' },
  web:    { label: 'Website + mã QR',     from: 'OrganizationProfile.website',                   contract: 'BOTH' },
  ten:    { label: 'Tên học viên/khách',  from: 'Contract.customer.fullName',                    contract: 'BOTH' },
  anh:    { label: 'Ảnh học viên/khách',  from: 'Contract.customer.avatarFileId',                contract: 'BOTH' },
  khoa:   { label: 'Tên khoá',            from: 'CourseClass.course.name',                       contract: 'COURSE' },
  lop:    { label: 'Tên lớp',             from: 'CourseClass.name',                              contract: 'COURSE' },
  ngay:   { label: 'Ngày khai giảng',     from: 'CourseClass.startDate',                         contract: 'COURSE' },
  nkt:    { label: 'Ngày kết thúc',       from: 'CourseClass.endDate',                           contract: 'COURSE' },
  lich:   { label: 'Lịch học',            from: 'CourseClass.weekdays + startMinute/endMinute',  contract: 'COURSE' },
  gv:     { label: 'Giảng viên',          from: 'CourseClass.instructorMembershipId → tên',     contract: 'COURSE' },
  nv:     { label: 'Nhân vật makeup',     from: 'ContractLine.subjectName (dòng gói đầu tiên)',  contract: 'SERVICE' },
  goi:    { label: 'Tên gói',             from: 'ContractLine.name (dòng PACKAGE đầu tiên)',     contract: 'SERVICE' },
  nsk:    { label: 'Ngày sự kiện',        from: 'Contract.eventDate',                            contract: 'SERVICE' },
  nd:     { label: 'Lời khen',            from: 'DesignCard.body (người dùng dán)',              contract: 'BOTH', input: true },
  td:     { label: 'Tiêu đề lời chúc',    from: 'DesignCard.title (gợi ý GreetingPhrase.title)', contract: 'BOTH', input: true },
  cc:     { label: 'Câu chúc',            from: 'DesignCard.body (gợi ý GreetingPhrase.body)',   contract: 'BOTH', input: true },
  nfb:    { label: 'Ngày nhận lời khen',  from: 'DesignCard.receivedAt',                         contract: 'BOTH', input: true },
  sao:    { label: 'Số sao',              from: 'DesignCard.rating',                             contract: 'BOTH', input: true },
  a1:     { label: 'Ảnh 1', from: 'DesignCardPhoto[0]', contract: 'BOTH', input: true },
  a2:     { label: 'Ảnh 2', from: 'DesignCardPhoto[1]', contract: 'BOTH', input: true },
  a3:     { label: 'Ảnh 3', from: 'DesignCardPhoto[2]', contract: 'BOTH', input: true },
} as const;
export interface DesignTemplate {
  code: string;                 // 'shd-01'
  version: number;              // tăng khi đổi bố cục
  kind: DesignKind;
  name: string;                 // 'Thư mời kem'
  contractKinds: ContractKindKey[];   // ['COURSE'] | ['SERVICE'] | ['COURSE','SERVICE']
  slots: (keyof typeof SLOT_SOURCES)[];
  photos: { min: number; max: number };   // 0..3
  fonts: string[];              // 'MP Viết tay 1', 'MP Chữ có chân'…
  sizes: ('1080x1350' | '1080x1080')[];
  origin: 'HOC_TU_ANH' | 'TU_SANG_TAC'; // ghi nguồn
}
export const DESIGN_TEMPLATES: DesignTemplate[] = [ /* 26 mẫu đã bày: shd-01..10, fb-01..10, lc-01..06; 9 mẫu đợt 1 tuỳ chọn */ ];
```

**Danh mục đợt đầu** (theo bản mẫu, chi tiết ô ở trang bày /home/user/a/docs/rnd/v3-bay-mau.html):

| Mã | Loại | Dùng cho hợp đồng | Ảnh tải lên |
|---|---|---|---|
| shd-01 … shd-10 | WELCOME | COURSE | 0 (ảnh học viên lấy từ `anh`) |
| fb-01, fb-07, fb-10 | FEEDBACK | COURSE, SERVICE | 1 |
| fb-02, fb-03, fb-08 | FEEDBACK | COURSE, SERVICE | 1 (fb-02, fb-03 có sao) |
| fb-05 | FEEDBACK | COURSE, SERVICE | 2 |
| fb-04, fb-06 | FEEDBACK | COURSE, SERVICE | 3 |
| fb-09 (trước – sau) | FEEDBACK | SERVICE | 2 |
| lc-01, lc-03, lc-04, lc-06 | GREETING | SERVICE | 1 (lc-04: 2) |
| lc-02 | GREETING | COURSE, SERVICE | 1 |
| lc-05 (hoàn thành khoá) | GREETING | COURSE | 0 (ảnh từ `anh`) |

**Mẫu "cả hai loại"** đổi chữ theo loại hợp đồng. Ví dụ "Cảm nhận của học viên" ↔ "Cảm nhận của khách hàng"; dòng phụ "Khoá · Lớp" ↔ "Nhân vật · Gói · Ngày sự kiện". Chữ này nằm trong tệp vẽ mẫu, không lưu database.

**Phông:**
- Là biến CSS trong `phong.css`: `--f-tay-1..4` (viết tay), `--f-ky-1..4` (chữ ký), `--f-chan`, `--f-chan2`, `--f-sans`.
- `DesignCard.fontOverride = 'ky-N'` thay mọi phông viết tay của mẫu bằng chữ ký N.
- Khi có phông SS-Album, chỉ thay tệp và dòng `src`.

### 1.5 Báo cáo doanh thu (mở rộng `/reports/revenue` đã có)

- Thêm query `kind?: 'SERVICE' | 'COURSE'`, `groupBy?: 'kind' | 'courseGroup' | 'course' | 'contract'`.
- Định nghĩa giữ nguyên BAO-CAO-RND-03:
  - **Doanh số** = tổng `Contract.total` của hợp đồng có `confirmedAt` trong kỳ.
  - **Cọc phải thu** = tổng `depositRequired` của các hợp đồng đó.
  - **Đã thu thực tế** = tổng phiếu thu − hoàn của các hợp đồng đó, tính đến nay.
  - **Còn lại** = Doanh số − Đã thu.
  - **Thực thu trong kỳ** = tổng phiếu theo `receivedAt` trong kỳ.
- **Không có trường "lợi nhuận".**

---

## 2. Màn hình (phương án C)

Khung, token và component theo BAN-VE-C. Mỗi màn có 3 khổ: máy tính ≥ 1181px, máy tính bảng 641–1180px, điện thoại ≤ 640px.
- Ảnh từng màn: /home/user/a/docs/rnd/anh/v3-dao-tao-C-<màn>-{desktop,tablet,mobile}.png
- Bản mẫu: /home/user/a/docs/rnd/v3-dao-tao-C.html#<màn>

### 2.1 Khoá & lớp — `#khoa-hoc`, `#khoa-hoc-mot`, `#khoa-hoc-ct`, `#khoa-hoc-mot-ct`

**Bố cục:**
- Máy tính: hai cột `380px | 1fr`.
  - Trái: thẻ "Khoá học" có ô tìm, chip nhóm (đếm số khoá) và danh sách theo nhóm. Mỗi dòng có tên khoá, nhãn **Một lớp / Nhiều lớp** và học phí. Dòng phụ:
    - Một lớp: "31/10–21/11 · 7/10 học viên".
    - Nhiều lớp: "3 lớp · 2 còn chỗ".
  - Phải: thẻ đầu khoá, gồm nhãn nhóm, nhãn kiểu, tên, nút Sửa, 4 ô số.
    - Một lớp: Học phí, Cọc mặc định, Thời gian, Số học viên tối đa.
    - Nhiều lớp: Học phí, Cọc mặc định, Số buổi, Tối đa mặc định.
  - Dưới thẻ đầu:
    - Nhiều lớp: thẻ **Lịch khai giảng** với các thẻ lớp, nút "Mở lớp".
    - Một lớp: một thẻ lớp kèm nút "Chuyển sang nhiều lớp".
- Máy tính bảng: hai cột `320px | 1fr`.
- Điện thoại: chỉ danh sách; bấm khoá mở màn chi tiết (`#khoa-hoc-ct`) có nút quay lại.

**Thẻ lớp** — ai, khi nào, ở đâu:
- Tên lớp, nhãn trạng thái chỗ.
- Ngày bắt đầu → kết thúc; lịch học (thứ, giờ); giảng viên (ảnh đại diện + tên); cơ sở.
- Thanh đầy và dòng "**x** đã ghi danh / tối đa **y**".
- Nút "Ghi danh": mở Lập hợp đồng khoá học, chọn sẵn lớp.

**Trạng thái chỗ** — dùng `seatState()`:

| Trạng thái | Nhãn | Thanh | Nút |
|---|---|---|---|
| Còn chỗ (< 75%) | `ui-tag--accent` "còn N chỗ" | `--accent` | "Ghi danh" (primary) |
| Sắp đầy (≥ 75%) | `ui-tag--warn` "Sắp đầy · còn N" | `--warn` | "Ghi danh" (primary) |
| Hết chỗ | `ui-tag--neutral` "Hết chỗ" | `--faint`, nền thẻ `--soft` | "Hết chỗ" (tắt, tooltip "Lớp đã đủ số học viên tối đa") |

- Ảnh: /home/user/a/docs/rnd/anh/v3-dao-tao-C-trang-thai-lop.png

**Trạng thái màn:**
- Đang tải: khung xương.
- Chưa có khoá: "Chưa có khoá học" + nút "Thêm khoá".
- Lỗi tải: thông báo + "Thử lại".
- Quyền: không có `courses.write` thì ẩn Thêm khoá, Sửa, Mở lớp. Nút "Ghi danh" cần `contracts.write`.

### 2.2 Thêm / sửa khoá — `#khoa-moi`, `#khoa-moi-nhieu`, `#khoa-hoc-mo`; mở lớp — `#lop-moi`

- Máy tính và máy tính bảng: `ui-dialog` rộng 680px. Điện thoại: toàn màn.
- Mỗi dòng = nhãn + điều khiển; giải thích nằm trong tooltip. Ô bắt buộc có dấu `*` đỏ.

**Một lớp** — không nhắc tới chữ "lớp":
- Kiểu khoá: seg Một lớp / Nhiều lớp.
- Thông tin khoá: Tên khoá\*, Nhóm khoá, Học phí\*, Cọc mặc định.
- Thời gian & học viên:
  - Thời gian\*: hai ô ngày bắt đầu → kết thúc.
  - Lịch học\*: chip T2 … CN.
  - Giờ học: từ – đến.
  - Số học viên tối đa\*: đuôi "học viên".
  - Giảng viên, Ở đâu.

**Nhiều lớp:**
- Thông tin khoá + Số học viên tối đa\* (mặc định cho các lớp).
- Nhóm "Lớp đầu tiên":
  - Tên lớp\*, gợi ý "Tên khoá + K1".
  - Thời gian\*, Lịch học\*, Giờ học.
  - Số tối đa của lớp\*, lấy sẵn từ khoá.
  - Giảng viên.

**Mở lớp:**
- Tên lớp\*, gợi ý số K tiếp theo.
- Thời gian\*, Lịch học\*, Giờ học.
- Số học viên tối đa\*: lấy sẵn từ khoá, sửa riêng được.
- Giảng viên, Ở đâu.

**Sửa khoá Một lớp:**
- Có seg Kiểu khoá. Dưới seg có hộp nhắc vàng: "Bấm Nhiều lớp: khoá giữ tên, học phí; lớp hiện tại thành lớp đầu tiên. Không mất học viên hay hợp đồng".
- Số tối đa có tooltip "Không đặt thấp hơn số đã ghi danh".

**Kiểm ở web trước khi gửi** (máy chủ kiểm lại):
- Ngày kết thúc ≥ ngày bắt đầu.
- Có ít nhất 1 thứ trong tuần.
- Giờ kết thúc sau giờ bắt đầu.
- Tối đa ≥ 1.
- Cọc ≤ học phí.

### 2.3 Lập hợp đồng khoá học — `#hop-dong`, `#hop-dong-in`

- Như Hợp đồng C. Cột trái:
  - Seg loại: Khoá học / Dịch vụ makeup. Chọn Dịch vụ thì mở màn hợp đồng dịch vụ đã có.
  - Danh mục khoá; lớp hết chỗ → nút "Hết chỗ" tắt.
- Cột phải:
  - Học viên, Người phụ trách.
  - Thẻ **Khoá học**: danh sách **chọn lớp** dạng radio. Mỗi lớp ghi ngày → ngày, lịch, giảng viên, cơ sở, "x/y" và nhãn chỗ. **Lớp hết chỗ tắt, không chọn được.**
  - Học phí, Giảm giá, Lý do giảm, Tổng, Cọc phải thu.
  - Tiến độ thanh toán: chia gợi ý Cọc + 1/2/3 đợt.
  - Điều khoản & nội quy, kèm biểu tượng khoá: "Bấm Xác nhận: nội dung hai mẫu được chụp vào hợp đồng".
  - Thanh tổng dính đáy.
- Xác nhận mà lớp vừa đầy (409): hộp lỗi "Lớp K12 vừa đủ 12/12 — chọn lớp khác", danh sách lớp tự tải lại.
- Xem bản in: `ui-dialog`; điện thoại thì toàn màn.
- Quyền: `contracts.write`.

### 2.4 Thu tiền — `#thu-tien`, `#thu-tien-ct`

- Không đổi so với BAO-CAO-RND-03 mục 6C:
  - Hàng đợi "Cần thu" gồm Quá hạn / 7 ngày tới / Sau đó / Đã thu đủ, có chip Khoá học / Dịch vụ makeup.
  - Bên phải: 4 ô số, các đợt, phiếu đã thu, form phiếu thu.
- Dùng API module payments (đang làm). Chỉ thêm lọc `kind` ở danh sách.

### 2.5 Doanh thu — `#thong-ke`

- Bộ lọc trái: Kỳ, Loại hợp đồng, Nhóm khoá.
- Bên phải: 4 ô số, biểu đồ 5 tháng (Doanh số `#A63D62`, Thực thu `#5B45A0`), bảng Nhóm → khoá → hợp đồng.
- Điện thoại: bảng thành thẻ.
- Quyền: `reports.read`.

### 2.6 Mẫu thiết kế — `#the-chao`, `#feedback`, `#feedback-dv`, `#loi-chuc`

- Thanh trái: mục **"Mẫu thiết kế"** gồm Thẻ chào mừng · Feedback · Lời chúc. Có ở mọi tổ chức; tổ chức không bật đào tạo thì không có Thẻ chào mừng.
- Điện thoại: vào từ "Thêm".

**Bố cục ba cột** (máy tính):
- Cột 1, 260px: hướng/bộ lọc ("Hợp với hợp đồng này" / "Tất cả mẫu") + lưới ảnh nhỏ 2 cột. Mẫu không hợp loại hợp đồng hiện mờ, tắt, tooltip "Chỉ dùng cho hợp đồng …".
- Cột 2: xem trước + seg khổ Vuông / Dọc 4:5.
- Cột 3, 360px: ô điền + nút "Tải ảnh PNG".
- Máy tính bảng: hai cột, ô điền xuống dưới.
- Điện thoại: xem trước → lưới mẫu 5 cột → ô điền → nút tải dính đáy.

**Ô điền chung:**
- Loại hợp đồng (seg) và Hợp đồng (ô chọn).
- Hộp xám ghi các giá trị **tự lấy** từ hợp đồng:
  - Dịch vụ: Khách · Nhân vật · Gói · Ngày sự kiện.
  - Khoá học: Học viên · Khoá · Lớp.

**Ô riêng theo loại:**
- Feedback:
  - Nội dung lời khen (ô dài, dán từ Zalo/Facebook; số ký tự; nút **Sao chép nội dung**).
  - Ảnh 1–3 (ô thêm ảnh nét đứt, nút × bỏ ảnh).
  - Ngày nhận.
- Lời chúc:
  - Câu chúc soạn sẵn (radio từ GreetingPhrase, lọc theo loại hợp đồng).
  - Tiêu đề, Lời chúc (sửa được; nút Sao chép).
  - Ảnh.
- Thẻ chào mừng:
  - Học viên, Khoá · Lớp, Khai giảng (chỉ xem).
  - Đổi ảnh (cập nhật `Customer.avatarFileId`), Thương hiệu (tooltip "lấy từ Hồ sơ trung tâm").

**Ai, khi nào:** dòng "Ghi bởi <người> · <ngày>" ở đầu màn.

**Xuất ảnh — web làm, không cần máy chủ vẽ:**
1. Vẽ mẫu trong `iframe` cùng nguồn.
2. Chụp `#c` ra PNG bằng `html-to-image` (cdnjs, phiên bản cố định).
3. Tải lên `/files` (purpose `DESIGN_CARD`).
4. `PUT /design-cards/:id/output`.

**Trạng thái:**
- Hợp đồng thiếu dữ liệu ô (ví dụ chưa có ngày sự kiện): ô đó trong hộp xám ghi "chưa có", mẫu vẫn vẽ phần còn lại.
- Ảnh đang tải lên: ô ảnh có vòng quay.
- Lời khen dài: chữ trong mẫu tự co (hàm fit).

**Quyền:**
- Không có `designs.write` thì chỉ xem thẻ đã tạo.
- Không có `files.write` thì ẩn nút thêm ảnh.

---

## 3. Gói việc theo tệp

### 3.1 Máy chủ (`apps/api`)

| Gói | Tệp | Việc | Bài thử bắt buộc |
|---|---|---|---|
| **M1 Dữ liệu** | `prisma/schema.prisma`; `prisma/migrations/<ts>_dao_tao/migration.sql` | Enum, bảng, trường ở mục 1.1; CHECK, index một phần, trigger `course_classes_single_guard` (SQL tay trong migration) | Migration chạy sạch trên DB có dữ liệu cũ; `Contract.kind` cũ = SERVICE |
| M2 Danh mục dùng chung | `packages/shared/src/permissions.ts` (5 quyền + vai trò mẫu); `packages/shared/src/courses.ts` (`seatState`, `ALMOST_FULL_RATIO = 0.75`, `weekdaysLabel`, đổi phút ↔ `HH:MM`); `packages/shared/src/design-templates.ts` (mục 1.4); `packages/shared/src/greetings.ts` (`DEFAULT_GREETING_PHRASES`); `packages/shared/src/index.ts` | | `seatState` biên 0, 74%, 75%, 100%; mọi mẫu chỉ dùng khoá có trong `SLOT_SOURCES` |
| M3 Khoá & lớp | `src/modules/courses/{routes,schemas,service,present}.ts`; đăng ký ở `src/app.ts` | Đường mục 1.3 "Khoá & lớp"; chặn khi `kind ≠ ACADEMY`; `assertQuota('courses')` | Tạo Một lớp có `firstClass`; Một lớp không mở được lớp 2 (409); đổi Một → Nhiều giữ id lớp; Nhiều → Một khi > 1 lớp (409); giảm tối đa dưới số ghi danh (409); trỏ chéo tổ chức (404) |
| M4 Hợp đồng khoá học | `src/modules/contracts/{schemas,routes,sheet,present}.ts`; mới `src/modules/contracts/enroll.ts` (giữ chỗ / trả chỗ) | `kind`, `ownerMembershipId`, dòng COURSE, luật trộn dòng, giữ chỗ khi xác nhận, trả chỗ khi huỷ / huỷ dòng, chụp terms / rules | **Hai xác nhận đồng thời vào chỗ cuối: đúng 1 thành công**; huỷ hợp đồng trả chỗ; ghi danh trùng (409); `assertQuota('students')` |
| M5 Mẫu điều khoản | `src/modules/contracts/texts.ts` | Đường `/contract-texts` | Sửa mẫu không đổi `terms` của hợp đồng đã xác nhận |
| M6 Mẫu thiết kế | `src/modules/designs/{routes,schemas,data}.ts` | `/design-templates`, `/contracts/:id/design-data`, `/greeting-phrases`, `/design-cards` | Mẫu sai loại hợp đồng (422); > 3 ảnh (422); `design-data` của hợp đồng dịch vụ trả `khoa = null` |
| M7 Giới hạn và báo cáo | `src/lib/quota.ts` (bộ đếm `courses`, `students`); `src/modules/payments/reports.ts` (`kind`, `groupBy`); `src/modules/orgs/routes.ts` (tạo tổ chức chép `DEFAULT_GREETING_PHRASES`) | | Báo cáo tách khoá học / dịch vụ, cộng lại bằng tổng |
| M8 Tệp | `src/modules/files/routes.ts` | Nhận purpose `DESIGN_PHOTO`, `DESIGN_CARD` (giới hạn ảnh như `ALBUM_IMAGE`) | |

Thứ tự: **M1 → M2 → M3 → M4** (M4 phụ thuộc M3) → M5, M6, M7, M8 làm song song.

### 3.2 Web (`apps/web`)

**Hàm API** — `src/api/courses.ts` (mới):
- `listCourseGroups`, `createCourseGroup`, `updateCourseGroup`
- `listCourses`, `getCourse`, `createCourse`, `updateCourse`, `archiveCourse`
- `createClass`, `updateClass`, `cancelClass`, `listClasses`, `listEnrollments`

**Hàm API** — `src/api/designs.ts` (mới):
- `listDesignTemplates`, `getDesignData`
- `listGreetingPhrases`, `createGreetingPhrase`, `updateGreetingPhrase`
- `createDesignCard`, `updateDesignCard`, `setDesignCardOutput`, `listDesignCards`, `deleteDesignCard`

**Sửa** `src/api/contracts.ts`: thêm `kind`, `ownerMembershipId`, dòng `COURSE`, `listContractTexts`, `createContractText`, `updateContractText`.

**Sửa** `src/api/types.ts`: thêm kiểu `ClassView`, `SeatState`, `DesignCard`, `GreetingPhrase`; thêm bài khớp kiểu vào `khop-kieu.test.ts`.

| Gói | Tệp | Việc |
|---|---|---|
| W1 Khung | `src/layout/**` (thanh trái, thanh dưới) | Thanh dưới theo `Organization.kind` (mục 1.0); mục "Đào tạo", "Mẫu thiết kế" |
| W2 Khoá & lớp | `src/features/courses/{CoursesPage,CourseList,CourseDetail,ClassCard,SeatTag,CourseDialog,ClassDialog,WeekdayChips,DateRange}.tsx` | Mục 2.1, 2.2; `SeatTag` dùng `seatState` của shared |
| W3 Hợp đồng khoá học | `src/features/contracts/{CourseLine,ClassPicker,KindSwitch,ContractTexts}.tsx`, sửa trang lập hợp đồng | Mục 2.3; lớp FULL tắt; xử lý 409 lớp vừa đầy |
| W4 Thu tiền và báo cáo | `src/features/payments/**`, `src/features/reports/**` | Chip / lọc theo loại hợp đồng; bảng theo nhóm khoá |
| W5 Mẫu thiết kế | `src/features/designs/{DesignStudio,TemplateGrid,PreviewFrame,CardForm,PhotoSlots,GreetingPicker,exportPng}.tsx`; tệp vẽ mẫu `public/mau/<code>.html` + `public/mau/chung/{mau.css,mau.js,qrcode.js}` + `public/mau/phong/**` (chép từ /home/user/a/docs/rnd/v3-mau-chao-mung/, /home/user/a/docs/rnd/v3-mau-feedback/, /home/user/a/docs/rnd/v3-mau-loi-chuc/) | Mục 2.6. `PreviewFrame` nạp `public/mau/<code>.html?<khoá>=<giá trị>…`; khoá lấy từ `getDesignData` + ô người dùng nhập |

**Phông trong `public/mau/phong/`:**
- Chỉ phông OFL đã kiểm, kèm tệp `OFL-*.txt`.
- Phông SS-Album chỉ đưa vào sau khi anh Chiến xác nhận quyền dùng.

---

## 4. Việc còn chờ quyết

- Giảng viên xem mọi lớp (`courses.read`) hay chỉ lớp mình dạy (`courses.read_own`)?
- Buổi học có lên Lịch (`EventKind.COURSE_SESSION` đã có) không? Bản vẽ này **chưa** sinh buổi học. Đề xuất gói sau: sinh `Appointment` theo `weekdays` từ `startDate` đến `endDate`.
- Đề xuất cũ của RND-03 chưa đưa vào: ảnh minh chứng phiếu thu, nhắc hạn đợt, ô "khách đồng ý đăng ảnh" (`DesignCard.consentAt`).
