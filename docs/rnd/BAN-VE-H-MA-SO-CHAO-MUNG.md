# Bản vẽ H — Mã số học viên trên thẻ chào mừng (R&D-11, chặng 2)

> **ĐÍNH CHÍNH 26/10/2026 tối (điều phối, sau gói H-H1 tra lại — bản gốc bên dưới GIỮ NGUYÊN; chỗ nào đá nhau thì theo đính chính này):**
> 1. Số dòng mục 1: đúng hết về nội dung, vài chỗ lệch đuôi 1–2 dòng (HEAD tra là 1f4e54d, mã app không đổi từ f489b3e). Không có dòng nào sai nội dung.
> 2. Mục 3.2: tên nhật ký "contract.confirmed / contract.lines_added" **không tồn tại**. Tên đúng: `contract.status_changed` (contracts/routes.ts:908), `contract.line_added` (:725), `contract.line_voided` (:815). `enroll.ts` không tự ghi nhật ký; ghi ở chỗ gọi.
> 3. Bài sẽ ĐỎ phải sửa theo gói: `apps/api/test/designs.test.ts:446-454` (bản chụp shd-02 so đủ khoá — thêm `ma`) → gói H-M3 phần designs; `apps/web/src/features/designs/mau-20.test.ts:46` (ô của shd-11) → gói H-T1; `apps/web/src/portal/fixtures.ts:12` thiếu `seatLabel` (lỗi typecheck) → H-M3 như đã ghi. Không có bài nào so khuôn đủ dòng ghi danh hay `PortalMe.enrollments`; 0 tệp snapshot.
> 4. Cửa gác: thẻ thiết kế trong fixture ở `apps/api/test/gate.ts:323` và `:484` (cardId) — H-M3 kiểm mẫu sửa một phần có `portalVisible` chạy đúng thẻ này.
> 5. `apps/api/test/gate-mutants.test.ts:523` chú thích ghi "(25)" đã cũ — số lớn nhất là 26 (:525). Đột biến mới của H là 27, 28.


- Sản phẩm: Makeup Pro. Ngày 26/10/2026. Người viết: Trung tâm R&D. Người đọc: điều phối, các thợ, thợ chấm.
- Phương án: **A — số theo thứ tự ghi danh, giữ nguyên, sửa tay được**. Trợ lý chọn thay anh Chiến (`docs/NHAT-KY-QUYET-DINH-THAY.md:114`).
- Quyết định đã chốt, thợ không bàn lại:
  1. Mã cấp tự động lúc ghi danh (hợp đồng khoá học xác nhận), số kế tiếp trong lớp: 01, 02… Không đổi về sau. Sửa tay được, không trùng với người **đang học** trong cùng lớp.
  2. Huỷ rồi ghi danh lại, hoặc chuyển lớp: nhận **số mới ở cuối hàng**. Số cũ nằm lại trên dòng ghi danh đã huỷ (lịch sử), không cấp lại cho ai.
  3. Sửa tay mã của học viên đã có thẻ chào mừng xuất ảnh: thẻ được đánh dấu **"Mang số cũ — cần xuất lại"**.
  4. Trang học viên (cổng) hiện **"Mã số của bạn"**.
  5. Mã là dữ liệu của học viên trong lớp; thẻ chỉ in lại; tính năng sắp ghế sau này đọc cùng mã (`docs/SO-Y-MUON.md:44`).
  6. Ô chọn mẫu chào mừng có **21 mẫu**: 11 cũ (shd) + 10 mới (cm) (`docs/SO-Y-MUON.md:43`). Mọi mẫu chào mừng có ô mã số (`SO-Y-MUON.md:44`).
  7. Thẻ mặc định hiện trên trang học viên (ký duyệt E câu 2); trung tâm ẩn được từng thẻ (việc tồn 73).
- Tài liệu đi kèm, bản vẽ này không chép lại:
  - Báo cáo chặng 1: `docs/rnd/BAO-CAO-RND-11-MA-SO-CHAO-MUNG.md` (commit f489b3e).
  - Bản mẫu chạy được: `docs/rnd/v11-ma-so/pa-A-co-dinh.html` (hộp học viên, màn Mẫu thiết kế), `docs/rnd/v11-ma-so/chung-mau-va-an-hien.html` (21 mẫu, Thẻ đã tạo: công tắc + nhãn "Mang số cũ" + nút Xuất lại).
  - Ảnh: `docs/rnd/anh-rnd11/pa-A-*.png`, `chung-*.png` (khổ 1440 và 390), bảng đo độ dài mã `do-do-dai-ma-1440.png`.
  - 10 mẫu mới: `docs/rnd/v10-chao-mung/cm-01…10.html` (đã có ô mã `data-seat`, đổi số bằng `?ma=`).
- **Sửa theo luật giao diện 7 (26/10, điều phối nhắc):** bản mẫu chặng 1 có dải chữ giải thích trên đầu hộp học viên ("Mã số tự cấp theo thứ tự ghi danh…") và đoạn ghi chú dưới ô mã ở màn Mẫu thiết kế. **Đã sửa trong bản mẫu**: giao diện chỉ còn nhãn + điều khiển, phần giải thích vào dấu "?" cạnh nhãn "Mã số" (ảnh `pa-A-lop-*`, `pa-A-the-*`, `chung-an-hien-*` đã chụp lại). Mọi gói web dưới đây giữ luật này: **không có dải chữ giải thích**, chỉ có nhãn, điều khiển, lời báo lỗi/kết quả sau thao tác, và "?".

Đọc theo thứ tự: mục 1 (hiện trạng) → 2 (dữ liệu, bản ghi cũ) → 3 (máy chủ) → 4 (web) → 5 (bài thử, cửa gác, đột biến) → 6 (gói việc) → 7 (không làm) → 8 (câu hỏi) → 9 (ký duyệt).

Quy ước chung (như các bản vẽ trước):
- Mọi bảng/khoá ngoại theo tổ chức, khoá kép `(id, organization_id)`.
- Mỗi lần ghi gọi `writeAudit` trong cùng transaction.
- Thân PATCH **không có** `.default()` (máy chủ từ chối khởi động, `apps/api/src/http/route.ts:97`).
- Mọi CHECK có cột cho phép NULL viết rõ `IS NULL` / `IS NOT NULL` ở từng vế (`docs/SO-LOI-DA-DO.md:164`, lỗi 24). Mục 2.4 ghi từng chỗ.
- Lỗi database không lộ nguyên văn cho người dùng: máy chủ kiểm trước dưới khoá dòng, database là lưới cuối.

---

## 1. Hiện trạng mã (đã tra, đúng đến 26/10/2026, HEAD f489b3e)

| Việc | Hiện trạng | Đường dẫn:dòng |
|---|---|---|
| Ghi danh (học viên trong lớp) | Bảng `Enrollment`: lớp, hợp đồng, dòng hợp đồng, khách, `status` ACTIVE/CANCELLED, `enrolledAt`. **Chưa có cột mã số** (tìm `seatCode/seat_code/seatNo/ma_so` trong apps, packages: 0) | `apps/api/prisma/schema.prisma:1397-1431` (`enrolledAt` :1406) |
| Lớp | `capacity`, `enrolledCount` (máy chủ đếm), CHECK `enrolled_count <= capacity` | `schema.prisma:1355-1395` (:1367-1368) |
| Một người một ghi danh còn hiệu lực mỗi lớp | Index một phần `enrollments_one_active (course_class_id, customer_id) WHERE status='ACTIVE'`; CHECK `enrollments_cancelled_at` | `apps/api/prisma/migrations/20261018230000_dao_tao/migration.sql:443-446` |
| Trigger trên `course_classes` | Chỉ `course_classes_single_guard` (BEFORE INSERT OR UPDATE OF `course_id`, `status`) — cập nhật cột khác không kích hoạt | `migrations/20261018230000_dao_tao/migration.sql:403-422` |
| Trigger trên `enrollments` | **Không có** | (tra cả thư mục migrations) |
| Ghi danh sinh ở đâu | DUY NHẤT `enrollContractLines`. Giữ chỗ = MỘT câu `UPDATE course_classes SET enrolled_count = enrolled_count + 1 … WHERE … enrolled_count < capacity RETURNING` — câu này khoá dòng lớp tới hết transaction, hai xác nhận cùng lúc xếp hàng. Mọi dòng của một lần xác nhận dùng chung một `enrolledAt` | `apps/api/src/modules/contracts/enroll.ts:3-5`, `:102`, `:108-111` (giữ chỗ), `:126-136` (`enrollment.create`) |
| Trả chỗ | `releaseEnrollments`: khoá dòng ghi danh (UPDATE status) **rồi** dòng lớp (UPDATE enrolled_count) — thứ tự khoá ghi danh → lớp | `enroll.ts:151-176` (:169, :170-173) |
| Gọi ghi danh / trả chỗ | Xác nhận hợp đồng `:873`; thêm dòng khoá học vào hợp đồng đã xác nhận `:706-713`; huỷ dòng `:783`; huỷ hợp đồng `:879`. **Chuyển lớp = huỷ dòng cũ + thêm dòng mới** (không có nút riêng) | `apps/api/src/modules/contracts/routes.ts` |
| Ghi thẳng `enrollment.create` ngoài máy chủ | Một chỗ trong bài thử của bản vẽ F (ghi ACTIVE không có mã) | `apps/api/test/giay-chung-nhan-database.test.ts:193-204` |
| Danh sách học viên lớp | `GET /orgs/:orgId/classes/:classId/enrollments` (`courses.read`), xếp `enrolledAt, id` | `apps/api/src/modules/courses/routes.ts:272-284`; `courses/service.ts:280-326` (:294) |
| Khoá dòng lớp, lỗi 409 trùng | `lockClass` (FOR UPDATE theo `(id, tổ chức)`), `uniqueOr409` | `courses/service.ts:99-104`, `:69` |
| Bộ đếm có sẵn trong app | Số giấy chứng nhận: bộ đếm `org_counters` không lùi, không tái dùng | `apps/api/src/modules/certificates/service.ts:296-307` |
| Ô dữ liệu của thẻ | `SLOT_SOURCES` — **chưa có ô mã** | `packages/shared/src/design-templates.ts:25-56` |
| Danh mục mẫu chào mừng | 11 mẫu `shd-01…11`, `version: 1` | `design-templates.ts:149-174`; `tpl()` :111-124 |
| Tệp vẽ trong app | `apps/web/public/mau/`: 11 `shd-*.html`, **0 `cm-*.html`**; ảnh nhỏ 216×270 `anh-nho/shd-NN.jpg` | thư mục |
| Ô mã trên tệp vẽ | 10/10 mẫu cm có `data-seat` (ẩn hẳn khi `?that=1` mà không có `?ma`); 0/11 mẫu shd | `docs/rnd/v10-chao-mung/chung/cm.js:2-12`, `cm.css:7-8` |
| Phông của mẫu cm (bản R&D) | Tự mang bản phông riêng, đặt tên `MP Viết tay 1/2` = MonteCarlo/Ephesis — **trùng tên** với phông khác trong app (`MP Viết tay 1` = Imperial Script). App đã có MonteCarlo/Ephesis là `MP Chữ ký 5/6` | `docs/rnd/v10-chao-mung/chung/phong.css:6-16`; `apps/web/public/mau/phong/phong.css:14-44`; `phong/ss-album/ss-album.css:16-17`, `:88-89` |
| Bộ điền dữ liệu tệp vẽ | `public/mau/chung/mau.js` (bản app mới hơn bản R&D: ô ảnh trống hiện gợi ý "Thêm ảnh"); `window.MAU_SAN_SANG` | `apps/web/public/mau/chung/mau.js:59-73`, `:95` |
| Luật khung ảnh | Đúng **1** mẫu khung viên thuốc (`shd-11`) — bài thử khoá cứng. **Mẫu cm-02 dùng khung viên thuốc** → đá luật (câu hỏi 1, mục 8) | `apps/web/src/features/designs/mau-20.test.ts:59-66`; `packages/shared/src/design-templates.test.ts:92-93` |
| Bài danh mục ↔ tệp vẽ | Mọi mẫu có tệp + ảnh nhỏ; ô `data-f` trên tệp = ô khai | `mau-20.test.ts:34-48` |
| Giá trị ô lấy từ dữ liệu | `loadDesignData`; `DATA_TEXT_SLOTS`; ô theo lớp `CLASS_SLOTS` (đổi lớp thì lấy lại) | `apps/api/src/modules/designs/data.ts:159-161`, `:182-261` |
| Bản chụp giá trị (snapshot) | Tạo/sửa thẻ dựng lại bản chụp; giữ giá trị cũ của ô dữ liệu trừ khi phải lấy lại; ghi đè chữ của người dùng | `data.ts:302-312` (`checkOverrides`), `:324-358` (`buildSnapshot`), `:361-371` (`slotsToRefresh`) |
| Trình bày thẻ | `presentCards` — **không trả `portalVisible`** | `data.ts:385-418` |
| Sửa thẻ | `PATCH /design-cards/:cardId` (`designs.write`): khoá thẻ, kiểm, dựng lại snapshot | `apps/api/src/modules/designs/routes.ts:313-389` |
| Thân sửa thẻ | `CardPatchBody` strictObject — **không có `portalVisible`** | `apps/api/src/modules/designs/schemas.ts:94-107` |
| Cột ẩn/hiện trên cổng | `DesignCard.portalVisible` mặc định true; `/portal/me` lọc theo cột | `schema.prisma:1521`; `apps/api/src/modules/portal/me.ts:135-148` (:141) |
| Ghi danh trên cổng | `/portal/me` đọc ghi danh ACTIVE của chính học viên; kiểu trả về `PortalMe.enrollments` | `portal/me.ts:79-95`, `:189-222`; `packages/shared/src/portal.ts:115-129` |
| Web — hộp học viên lớp | `EnrollmentsDialog` (Dialog 560): nhóm Đang học / Đã huỷ ghi danh; dòng: tên, SĐT · mã HĐ, tiền, trạng thái. Chưa có mã | `apps/web/src/features/courses/EnrollmentsDialog.tsx:12-93`; mở từ `CoursesPage.tsx:131`, `:210` |
| Web — màn Mẫu thiết kế | Studio 3 cột; hộp "tự lấy từ hợp đồng"; xuất PNG = lưu thẻ → vẽ trong trình duyệt → tải lên → gắn | `features/designs/DesignStudio.tsx:61-205`; `CardForm.tsx:125-150`; `model.ts:121-150` (`DATA_TEXT`, `autoFields`), `:189-228` (`frameQuery`) |
| Web — Thẻ đã tạo | Chỉ "Tải ảnh", "Xoá". Không có công tắc, không mở lại thẻ cũ để xuất lại | `features/designs/CardList.tsx:86-95` |
| Web — kiểu dữ liệu | `Enrollment` (`api/courses.ts:211-219`); `DesignCard` (`api/designs.ts:71`), `DesignData` (`:15`) | |
| Web — cổng học viên | `ScheduleCard` (Khoá, lớp · Giờ học · Thời gian · Giảng viên) | `apps/web/src/portal/sections.tsx:272-300`; dữ liệu mẫu `portal/fixtures.ts` |
| Cửa gác | **14 phép** (10 cách ly + 4 cổng) | `apps/api/test/gate.ts:57-73` |
| Fixture cửa gác | Có sẵn 2 ghi danh ACTIVE ở `endedClassId` (`enrollmentId`, `enrollment2Id`), thẻ `cardId` (FEEDBACK) | `gate.ts:396-412`, `:494-495` |
| Mẫu cửa gác | `SAMPLES` PATCH thẻ `:61`; `REF_SAMPLES` thẻ `:295`; `PARTIAL_SAMPLES` thẻ `:525-540` | `apps/api/test/gate-samples.ts` |
| Đột biến cửa gác | Số lớn nhất hiện có: **26** (+ D1–D3) | `apps/api/test/gate-mutants.test.ts:525` |
| Migration mới nhất | `20261019220000_mau_in_hop_dong` | `apps/api/prisma/migrations/` |

**Ba điều thợ phải biết trước khi khởi công:**
1. Câu giữ chỗ ở `enroll.ts:108-111` **đã** khoá dòng lớp. Cấp mã đúng trong câu đó là đủ chống đua — không thêm khoá mới.
2. Thứ tự khoá đang có ở đường huỷ là **ghi danh → lớp**. Đường sửa tay mã mới phải theo đúng thứ tự này, nếu không sẽ khoá chết (mục 3.3).
3. Ảnh thẻ được vẽ **ở trình duyệt**. Máy chủ không vẽ lại được; đổi mã thì chỉ **đánh dấu** thẻ, người dùng bấm "Xuất lại".

---

## 2. Dữ liệu

### 2.1 Thay đổi tổng quát

| Bảng | Mới / sửa | Mục đích |
|---|---|---|
| `enrollments` | thêm `seat_no integer NULL` | Mã số của học viên trong lớp. ACTIVE bắt buộc có; CANCELLED giữ số cũ (hoặc NULL nếu huỷ trước khi có tính năng) |
| `course_classes` | thêm `seat_counter integer NOT NULL DEFAULT 0` | Số lớn nhất **từng** cấp trong lớp. Không bao giờ lùi. Số tự cấp = `seat_counter + 1` |
| `design_cards` | **không đổi** | Mã trên ảnh đọc từ `snapshot.ma`; dấu "cần xuất lại" tính lúc đọc (mục 3.5). `portal_visible` đã có |

Mã lưu là **số nguyên** 1–999 (lớp tối đa 500 học viên, `packages/shared/src/courses.ts:8`; còn chỗ cho sửa tay). Hiển thị 2 chữ số: 7 → "07", 123 → "123" (hàm `seatLabel`, mục 3.1). Bảng đo chặng 1: "07" và "123" vừa 10/10 mẫu cm.

### 2.2 Prisma (`apps/api/prisma/schema.prisma`)

```prisma
model CourseClass {
  // … giữ nguyên …
  // Bản vẽ H: số lớn nhất từng cấp trong lớp (không lùi). Câu giữ chỗ tăng cùng lúc với enrolled_count.
  seatCounter            Int               @default(0) @map("seat_counter")
}

model Enrollment {
  // … giữ nguyên …
  // Bản vẽ H: mã số trong lớp (1–999). ACTIVE bắt buộc có (CHECK enrollments_active_seat); không trùng giữa các ghi danh
  // ACTIVE cùng lớp (index một phần enrollments_seat_active). Huỷ ghi danh giữ số (lịch sử), số không cấp lại.
  seatNo         Int?             @map("seat_no")
}
```

Không khai index một phần trong Prisma (Prisma không biểu diễn được), giống `enrollments_one_active`.

### 2.3 Migration — MỘT thư mục `apps/api/prisma/migrations/20261026200000_ma_so_hoc_vien/migration.sql`

Tên đặt **sau** migration mới nhất hiện có `20261019220000_mau_in_hop_dong` (tra 26/10). Gói H-M1 tra lại lúc khởi công; nếu đã có migration mới hơn thì đổi mốc cho lớn hơn và ghi vào báo cáo. Viết và thử ở thư mục nháp, đưa vào bằng **một lần `mv`** (luật chung 6).

```sql
-- Bản vẽ H — mã số học viên trong lớp.
ALTER TABLE "course_classes" ADD COLUMN "seat_counter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "enrollments" ADD COLUMN "seat_no" INTEGER;

-- BACKFILL BEGIN (bài thử đọc đoạn này và chạy lại trên dữ liệu tự dựng)
-- Học viên ĐANG HỌC: cấp 1..N theo thứ tự ghi danh (enrolled_at, id) trong từng lớp. Ghi danh đã huỷ trước ngày có tính
-- năng: không cấp (NULL), không chiếm số.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "course_class_id" ORDER BY "enrolled_at", "id") AS n
  FROM "enrollments" WHERE "status" = 'ACTIVE'
)
UPDATE "enrollments" e SET "seat_no" = r.n FROM ranked r WHERE e."id" = r."id";
UPDATE "course_classes" k SET "seat_counter" = COALESCE(
  (SELECT MAX(e."seat_no") FROM "enrollments" e WHERE e."course_class_id" = k."id"), 0);
-- BACKFILL END

-- Chốt (mỗi chốt có ca ghi thẳng database ở bảng 2.4)
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_seat_range"
  CHECK ("seat_no" IS NULL OR ("seat_no" >= 1 AND "seat_no" <= 999));
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_active_seat"
  CHECK ("status" <> 'ACTIVE' OR "seat_no" IS NOT NULL);
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_seat_counter_range"
  CHECK ("seat_counter" >= 0 AND "seat_counter" <= 999);
CREATE UNIQUE INDEX "enrollments_seat_active" ON "enrollments" ("course_class_id", "seat_no") WHERE "status" = 'ACTIVE';

-- Lưới cuối cho MỌI đường ghi (kể cả bài thử ghi thẳng): ghi danh ACTIVE chưa có số thì tự cấp seat_counter + 1;
-- có số thì nâng seat_counter lên ít nhất bằng số đó (số tự cấp sau này không đụng số sửa tay).
CREATE FUNCTION enrollments_seat_guard() RETURNS trigger AS $$
DECLARE n integer;
BEGIN
  IF TG_OP = 'INSERT' AND NEW."seat_no" IS NULL AND NEW."status" = 'ACTIVE' THEN
    UPDATE "course_classes" SET "seat_counter" = "seat_counter" + 1
      WHERE "id" = NEW."course_class_id" RETURNING "seat_counter" INTO n;
    NEW."seat_no" := n;
  ELSIF NEW."seat_no" IS NOT NULL THEN
    UPDATE "course_classes" SET "seat_counter" = NEW."seat_no"
      WHERE "id" = NEW."course_class_id" AND "seat_counter" < NEW."seat_no";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER enrollments_seat_guard BEFORE INSERT OR UPDATE OF "seat_no" ON "enrollments"
  FOR EACH ROW EXECUTE FUNCTION enrollments_seat_guard();

-- Bộ đếm không lùi.
CREATE FUNCTION course_classes_seat_counter_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."seat_counter" < OLD."seat_counter" THEN
    RAISE EXCEPTION 'Bộ đếm mã số của lớp không được lùi (% → %)', OLD."seat_counter", NEW."seat_counter"
      USING ERRCODE = '23514', CONSTRAINT = 'course_classes_seat_counter_guard';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER course_classes_seat_counter_guard BEFORE UPDATE OF "seat_counter" ON "course_classes"
  FOR EACH ROW EXECUTE FUNCTION course_classes_seat_counter_guard();
```

Thứ tự trong tệp là bắt buộc: **đổ số trước, tạo CHECK và trigger sau**. Tạo CHECK `enrollments_active_seat` trước khi đổ số thì migration hỏng trên database đã có học viên.

Trigger đứng sau đường máy chủ (mục 3.2): máy chủ cấp số trong câu giữ chỗ và truyền `seatNo` vào `create`, nên trigger chỉ chạy nhánh "nâng bộ đếm", mà điều kiện `seat_counter < n` không thoả → không ghi gì. Nhánh tự cấp chỉ chạy khi có đường ghi thẳng không truyền số — ví dụ `giay-chung-nhan-database.test.ts:193` — nên bài thử của bản vẽ F **không phải sửa**.

Kiểm migration (gói H-M1 nộp số đo):
- Áp sạch trên database thử mới, và trên database thử **có dữ liệu cũ** (database của cửa gác sau một lượt chạy, hoặc bản sao `makeup_test_*` có lớp + ghi danh ACTIVE + CANCELLED).
- Đếm: số ghi danh ACTIVE có `seat_no` = tổng ACTIVE; mỗi lớp `seat_counter` = số ACTIVE của lớp; CANCELLED có `seat_no` = 0 dòng.
- `prisma migrate diff --from-migrations … --to-schema-datamodel …` (shadow `makeup_test_h_shadow`) chỉ còn khác ở chốt viết tay (CHECK, index một phần, trigger).

### 2.4 Bảng kiểm "bẫy NULL" — mỗi dòng có một bài **ghi thẳng database** (không qua API)

| Chốt | Ca phải bị chặn | Vì sao dễ lọt |
|---|---|---|
| `enrollments_active_seat` | `UPDATE enrollments SET seat_no = NULL` trên dòng ACTIVE | Nếu viết `CHECK (status <> 'ACTIVE' OR seat_no > 0)` thì NULL > 0 ra NULL, FALSE OR NULL = NULL → **lọt**. Phải là `IS NOT NULL` |
| `enrollments_seat_range` | `seat_no = 0`, `seat_no = 1000`, `seat_no = -1` | Vế đầu `IS NULL` cho NULL qua **có chủ đích** (dòng huỷ cũ). Vế sau là so sánh thường |
| `enrollments_seat_active` | Hai dòng ACTIVE cùng lớp cùng số | Index một phần: một ACTIVE + một CANCELLED cùng số phải **ghi được** |
| `course_classes_seat_counter_range` | `seat_counter = -1`, `1000` | Cột NOT NULL, không bẫy NULL; vẫn ghi ca |
| `course_classes_seat_counter_guard` | `UPDATE course_classes SET seat_counter = seat_counter - 1` | Trigger, không phải CHECK |
| `enrollments_seat_guard` (nhánh tự cấp) | Không phải ca chặn: INSERT ACTIVE không có số → nhận `seat_counter + 1`, bộ đếm tăng 1 | Ca GIỮ |
| `enrollments_seat_guard` (nhánh nâng) | Không phải ca chặn: ghi `seat_no = 50` khi bộ đếm 3 → bộ đếm 50; ghi danh tiếp theo → 51 | Ca GIỮ |

### 2.5 Bản ghi cũ có phải nhập lại không? — **Không.**

1. **Học viên đang học** lúc chạy migration: đoạn BACKFILL tự cấp 01…N trong từng lớp theo thứ tự ghi danh (`enrolled_at`, rồi `id`). Lớp đã kết thúc cũng được cấp (để giấy chứng nhận và tính năng sắp ghế sau này đọc chung). Không ai phải gõ tay. Muốn đổi số nào thì sửa tay ở hộp học viên.
   - Hai người ghi danh **cùng một mili giây** vào cùng lớp (hai hợp đồng xác nhận cùng lúc): thứ tự theo `id` (ngẫu nhiên). Ghi vào báo cáo H-M1 số cặp như vậy trên database thử.
2. **Ghi danh đã huỷ trước ngày có tính năng**: không có số (NULL), không chiếm số. Hộp học viên hiện ô mã "—" ở nhóm "Đã huỷ ghi danh".
3. **Thẻ chào mừng đã xuất ảnh trước đó**: ảnh **giữ nguyên** (không có mã), trang học viên vẫn hiện đúng ảnh đó. Danh sách "Thẻ đã tạo" gắn nhãn **"Chưa có mã số"** (trạng thái `OLD_CARD`, mục 3.5) kèm nút **"Xuất lại"**. App **không** tự vẽ lại hàng loạt: ảnh vẽ ở trình duyệt, và anh có thể không muốn đổi ảnh đã gửi học viên.
4. **Thẻ đã lưu nhưng chưa xuất ảnh**: lần xuất sau tự có mã.
5. **Thẻ Feedback, Lời chúc**: không đổi gì (không có ô mã).

---

## 3. Máy chủ (`apps/api`, `packages/shared`)

### 3.1 Dùng chung — `packages/shared/src/seats.ts` (mới)

```ts
export const SEAT_MIN = 1;
export const SEAT_MAX = 999;
// 7 → "07"; 123 → "123". Hiển thị ở mọi nơi (hộp học viên, thẻ, cổng).
export function seatLabel(n: number): string;
// Ô nhập của hộp học viên: nhận "7", "07", " 07 " → 7. Rỗng, chữ, 0, > 999 → { ok: false, message } tiếng Việt.
export function parseSeatInput(s: string): { ok: true; value: number } | { ok: false; message: string };
```

`seatLabel` ném lỗi với số ngoài 1–999 hoặc không nguyên (luật chung 8: không mặc định im lặng). Xuất từ `packages/shared/src/index.ts`.

### 3.2 Cấp mã lúc ghi danh — `apps/api/src/modules/contracts/enroll.ts`

Sửa câu giữ chỗ (`:108-111`) thành **một câu**:

```sql
UPDATE course_classes
SET enrolled_count = enrolled_count + 1, seat_counter = seat_counter + 1, updated_at = now()
WHERE id = $classId AND organization_id = $orgId AND status = 'OPEN' AND enrolled_count < capacity
RETURNING id, name, seat_counter
```

Rồi `tx.enrollment.create({ data: { …, seatNo: held[0].seat_counter } })` (`:126-136`).

Luật:
- Cấp số **trong chính câu giữ chỗ** (đã khoá dòng lớp tới hết transaction). Hai xác nhận cùng lúc vào cùng lớp: người sau chờ, đọc lại `seat_counter` mới → không trùng, không hở. **Cấm** đọc `MAX(seat_no)` rồi ghi (đọc-rồi-ghi).
- Trùng ghi danh (`:120-124`) hoặc lỗi khác → cả transaction quay lui, bộ đếm quay lui theo. Không phát sinh "lỗ số" do lỗi.
- **Huỷ, rồi ghi danh lại** cùng lớp → dòng ghi danh mới → số mới cuối hàng (quyết định 2). **Chuyển lớp** (huỷ dòng + thêm dòng) → lớp mới cấp số cuối hàng của lớp mới; dòng huỷ ở lớp cũ giữ số cũ.
- `releaseEnrollments` (`:151-176`) **không đổi**: huỷ không xoá số, không lùi bộ đếm.
- Nhật ký `contract.confirmed` / `contract.lines_added` đang có: thêm `seatNo` vào phần ghi danh trong `data` nếu đường đó ghi danh sách ghi danh (H1 tra chỗ ghi).

### 3.3 Đường API

| # | Đường | Quyền | Chống trùng | Việc |
|---|---|---|---|---|
| 1 | `GET /orgs/:orgId/classes/:classId/enrollments` (sửa) | `courses.read` | — | Mỗi dòng thêm `seatNo: number \| null`, `seatLabel: string \| null`. Xếp `seatNo` tăng dần (NULL cuối), rồi `enrolledAt`, `id` |
| 2 | `PUT /orgs/:orgId/enrollments/:enrollmentId/seat` (**mới**) | `courses.write` | PUT (đặt toàn bộ) | Sửa tay mã. Thân `{ seatNo }` |
| 3 | `GET /orgs/:orgId/contracts/:contractId/design-data` (sửa) | như cũ | — | Thêm ô `ma` (nhãn mã của khách ở lớp của thẻ) |
| 4 | `PATCH /orgs/:orgId/design-cards/:cardId` (sửa) | `designs.write` | (PATCH) | Nhận `portalVisible`; luôn lấy lại ô `ma` khi dựng lại snapshot |
| 5 | `GET /orgs/:orgId/design-cards`, POST, PUT output (sửa phần trả về) | như cũ | — | Mỗi thẻ thêm `portalVisible` và `seat` (mục 3.5) |
| 6 | `GET /portal/me` (sửa) | cổng | — | `enrollments[].seatLabel` của **chính** học viên |

Đường 2 không có `classId` trong đường dẫn: mã ghi danh là duy nhất, máy chủ tra theo `(id, tổ chức)`. Cửa gác điền tham số theo tên (`gate.ts` hàm `fill`), nên đường này dùng thẳng `ids.enrollmentId` của fixture.

**Khuôn thân (zod 4)** — không `.default()`:

```ts
// courses/schemas.ts
export const EnrollmentParams = OrgParams.extend({ enrollmentId: z.uuid() });
export const SeatBody = z.strictObject({
  seatNo: z.number({ error: 'Mã số phải là số' }).int('Mã số phải là số nguyên')
    .min(SEAT_MIN, 'Mã số từ 01 đến 999').max(SEAT_MAX, 'Mã số từ 01 đến 999'),
});

// designs/schemas.ts — CardPatchBody thêm một dòng
portalVisible: z.boolean().optional(),
```

**Trả về đường 2:** `{ enrollment: EnrollmentView /* đúng khuôn một dòng của đường 1 */, staleCards: number }`. `staleCards` = số thẻ chào mừng của học viên này ở lớp này đang ở trạng thái `STALE` sau khi sửa (mục 3.5).

### 3.4 Luật xử lý đường 2 (sửa tay mã) — `apps/api/src/modules/courses/seats.ts` (mới)

Trong **một** transaction, theo đúng thứ tự (thứ tự khoá **ghi danh → lớp**, giống `releaseEnrollments`; ngược lại là khoá chết với đường huỷ):
1. Tổ chức phải là ACADEMY (`academy()` như các đường lớp).
2. `SELECT id, course_class_id, customer_id, status, seat_no FROM enrollments WHERE id = $1 AND organization_id = $org FOR UPDATE`. Không có → **404 "Không tìm thấy học viên trong lớp"** — lời **giống hệt** khi gửi mã bịa (sổ lỗi 12).
3. `status = 'CANCELLED'` → **409** `ENROLLMENT_CANCELLED` "Học viên đã huỷ ghi danh — không sửa mã".
4. `lockClass(tx, org, course_class_id)`.
5. Số mới = số cũ → trả 200 như hiện tại, **không ghi gì**, không ghi nhật ký (PUT lặp lại là idempotent).
6. Tìm ghi danh ACTIVE khác cùng lớp có `seat_no` = số mới → **409** `SEAT_TAKEN`, lời `Mã {nhãn} đã có trong lớp: {họ tên}`, `details: { seatNo, takenBy: { enrollmentId, fullName } }`. Người gọi có `courses.read` (đã xem được tên trong danh sách) nên lộ tên không phải rò rỉ. Số của người **đã huỷ** thì **được** dùng (quyết định 2 chỉ cấm *tự* cấp lại).
7. `UPDATE enrollments SET seat_no = $n`. Trigger tự nâng `seat_counter` nếu số mới lớn hơn. Máy chủ **cũng** ghi `UPDATE course_classes SET seat_counter = GREATEST(seat_counter, $n)` trong cùng transaction (không dựa riêng vào trigger). Lỗi `P2002` / 23505 từ `enrollments_seat_active` → 409 `SEAT_TAKEN` (không có tên), qua `uniqueOr409`.
8. Đếm `staleCards` bằng **một** câu: thẻ `kind = 'WELCOME'`, `deleted_at IS NULL`, `output_file_id IS NOT NULL`, `course_class_id` = lớp, `customer_id` = khách, `snapshot ? 'ma'`, `snapshot->>'ma' IS DISTINCT FROM $nhãnMới`.
9. `writeAudit('enrollment.seat_updated', { classId, customerId, before: seatNoCũ, after: seatNoMới, staleCards })`.

### 3.5 Thẻ chào mừng: ô `ma`, dấu "cần xuất lại", ẩn/hiện

**Ô mã — `packages/shared/src/design-templates.ts`** (gói H-T1):

```ts
ma: { label: 'Mã số trong lớp', from: 'Enrollment.seatNo (ghi danh ACTIVE của khách ở lớp của thẻ) → seatLabel', contract: 'COURSE' },
```

**`apps/api/src/modules/designs/data.ts`:**
- `DATA_TEXT_SLOTS` thêm `'ma'`; `CLASS_SLOTS` thêm `'ma'`.
- `loadDesignData`: hợp đồng khoá học có lớp → `enrollment.findFirst({ where: { organizationId, courseClassId, customerId: c.customerId, status: 'ACTIVE' }, select: { seatNo: true } })`; `text.ma = seatNo ? seatLabel(seatNo) : null`. Nháp chưa xác nhận → null → tệp vẽ ẩn ô mã.
- `checkOverrides`: khoá `ma` trong `snapshot` gửi lên → 400 đúng ô `snapshot.ma`, lời **"Mã số lấy từ danh sách học viên của lớp — sửa ở Đào tạo › Học viên"**.
- `slotsToRefresh`: mẫu có ô `ma` thì **luôn** lấy lại `ma` mỗi lần dựng lại snapshot (mã là dữ liệu của lớp; mỗi lần lưu là để xuất ảnh mới).
- `presentCards` thêm hai trường; giá trị `current` đọc bằng **một** câu `enrollment.findMany` cho mọi cặp `(courseClassId, customerId)` của trang (không truy vấn từng thẻ):

```ts
portalVisible: boolean,
seat: null /* không phải thẻ chào mừng, hoặc không có lớp */ | {
  onCard: string | null,   // snapshot.ma (null khi ô trống trên ảnh)
  current: string | null,  // nhãn mã ACTIVE hiện tại; null khi học viên đã huỷ ghi danh
  state: 'OK' | 'STALE' | 'OLD_CARD' | 'NOT_EXPORTED' | 'ENDED',
}
```

Bảng trạng thái (đi từ trên xuống, gặp dòng nào khớp thì dừng):

| Điều kiện | `state` | Web hiện |
|---|---|---|
| `outputFileId` null | `NOT_EXPORTED` | không gì |
| `current` null (đã huỷ ghi danh) | `ENDED` | không gì |
| snapshot **không có khoá** `ma` (thẻ làm trước khi có mã số) | `OLD_CARD` | nhãn "Chưa có mã số" + "?" + nút "Xuất lại" |
| `onCard` = `current` | `OK` | không gì |
| còn lại | `STALE` | nhãn "Mang số cũ {onCard} — cần xuất lại" + "?" + nút "Xuất lại" |

Rủi ro đã biết (ghi rõ, không che): người dùng bấm "Tải ảnh PNG", máy chủ lưu thẻ (snapshot mã mới) nhưng **tải ảnh hỏng** → snapshot nói mã mới, ảnh vẫn mã cũ → không bị đánh dấu `STALE`. Màn đã báo đỏ "Thẻ đã lưu nhưng chưa xuất được ảnh" (`DesignStudio.tsx:203-205`). Không thêm cột cho ca này.

**PATCH thẻ — `apps/api/src/modules/designs/routes.ts`:**
- Thân **chỉ có** `portalVisible` → **nhánh ngắn**:
  - vẫn `lockCard(tx, org, cardId)` (tra theo tổ chức);
  - thẻ `GREETING` → 400 ô `portalVisible` "Lời chúc không hiện trên trang học viên";
  - chỉ ghi `portal_visible`. **Không** dựng lại snapshot, không đụng ảnh, không đụng ô `ma` (bật/tắt không được xoá dấu "cần xuất lại");
  - `writeAudit('design_card.portal_visibility_changed', { before, after })`.
- Thân có `portalVisible` **và** trường khác → đường cũ, ghi thêm `portalVisible` (vẫn chặn `GREETING`).
- `{}` → 400 "Không có gì để sửa" (giữ `refine` có sẵn).

### 3.6 Cổng học viên — `apps/api/src/modules/portal/me.ts`, `packages/shared/src/portal.ts`

- `PortalMe.enrollments[]` thêm `seatLabel: string | null` (`portal.ts:115-129`).
- `me.ts:79-95` chọn thêm `seatNo`; `:192-220` thêm `seatLabel: e.seatNo ? seatLabel(e.seatNo) : null`.
- Câu đọc ghi danh đã lọc `organizationId` + `customerId` của phiên — giữ nguyên; không có đường mới ở cổng.

### 3.7 Bảng lỗi

| Tình huống | HTTP | `reason` | Lời |
|---|---|---|---|
| Ghi danh không có / của tổ chức khác (cùng lời) | 404 | — | Không tìm thấy học viên trong lớp |
| Ghi danh đã huỷ | 409 | `ENROLLMENT_CANCELLED` | Học viên đã huỷ ghi danh — không sửa mã |
| Mã trùng người đang học | 409 | `SEAT_TAKEN` | Mã {07} đã có trong lớp: {họ tên} |
| Mã ngoài 1–999, không nguyên, không phải số | 400 | — | Mã số từ 01 đến 999 / Mã số phải là số nguyên |
| Tổ chức không đào tạo | 403 | `ACADEMY_REQUIRED` | (lời có sẵn) |
| Ghi đè `snapshot.ma` | 400 | — | Mã số lấy từ danh sách học viên của lớp — sửa ở Đào tạo › Học viên |
| `portalVisible` ở thẻ Lời chúc | 400 | — | Lời chúc không hiện trên trang học viên |

---

## 4. Web (`apps/web`)

### 4.1 Hàm API và kiểu

- `src/api/courses.ts`: `Enrollment` thêm `seatNo`, `seatLabel`; hàm mới `setEnrollmentSeat(orgId, enrollmentId, seatNo)` → `PUT …/enrollments/:id/seat`, trả `{ enrollment, staleCards }`.
- `src/api/designs.ts`: `DesignCard` thêm `portalVisible`, `seat`; `DesignData` thêm `ma`; thân `updateDesignCard` nhận `portalVisible`.
- `src/api/duong-api.test.ts`: thêm ca đường 2 và PATCH chỉ `portalVisible`.

### 4.2 Hộp "Học viên lớp …" — `features/courses/EnrollmentsDialog.tsx`

Theo ảnh `docs/rnd/anh-rnd11/pa-A-lop-1440.png`, `pa-A-lop-sua-1440.png`, `pa-A-lop-390.png`, `pa-A-lop-sua-390.png`.
- Mỗi dòng có **ô mã** bên trái (ô số `num`, chữ số đều). Dòng đã huỷ: mã gạch ngang; dòng huỷ không có số: "—".
- Đầu nhóm "Đang học" có nhãn **"Mã số"** + dấu **"?"** (`Tooltip`). Chữ trong "?": *"Mã số tự cấp theo thứ tự ghi danh (01, 02…) và giữ nguyên. Bấm vào mã để sửa. Người huỷ ghi danh giữ số của mình trên dòng đã huỷ; số đó không cấp lại cho người khác."* **Không có dải chữ giải thích** trong thân hộp (luật 7).
- Người có `courses.write`: ô mã là nút (kèm biểu tượng bút), bấm → ô nhập 3 ký tự (`inputMode="numeric"`) + "Lưu" + "Huỷ". Enter lưu, Esc huỷ. Kiểm ở web bằng `parseSeatInput` trước khi gửi.
- Lỗi 409 `SEAT_TAKEN` hiện **dưới dòng**, đúng lời máy chủ; nút Lưu tắt tới khi đổi số. Ô nhập viền đỏ.
- Lưu xong: cập nhật dòng; danh sách xếp lại theo mã. Nếu `staleCards > 0`, hiện lời kết quả (`role="status"`, một dòng, không phải dải giải thích) *"Thẻ chào mừng của {tên} đang mang số cũ — Xuất lại ở Mẫu thiết kế"* kèm liên kết tới `mau-thiet-ke/da-tao`.
- Người chỉ có `courses.read`: ô mã chỉ đọc, không có bút.
- Điện thoại (390): hộp toàn màn hình như hiện tại (`courses.css:235`); dòng hai tầng: mã bên trái, tên + phụ + tiền/trạng thái bên phải (ảnh `pa-A-lop-390.png`).
- `CoursesPage.tsx` truyền `canEditSeat` (quyền `courses.write`) vào hộp — gói W2 sửa đúng dòng mở hộp (`:210`).

### 4.3 Màn Mẫu thiết kế — `features/designs/`

**Hộp "tự lấy từ hợp đồng"** (`CardForm.tsx:125-150`, `model.ts:133-150`): thẻ chào mừng thêm dòng **"Mã số trong lớp"** đứng đầu + "?" (*"Lấy từ danh sách học viên lớp {lớp}. Sửa ở Đào tạo › Học viên."*). Chưa có mã (nháp) → "chưa có" như các ô khác. Ảnh: `pa-A-the-1440.png`, `pa-A-the-390-o-ma.png`.

`model.ts`: `DATA_TEXT` thêm `'ma'`, nên `frameQuery` tự gửi `?ma=07` cho tệp vẽ (khoá tham số trùng tên ô).

**Ô chọn mẫu 21 mẫu** (`TemplateGrid.tsx` đọc danh mục, tự có 21 mẫu khi T1 xong): 10 mẫu cm đứng **trước** trong danh mục. Nhãn "Mới" **không** vẽ vào ảnh nhỏ: gói T1 thêm cờ `isNew: true` vào kiểu `DesignTemplate` và 10 mục cm; gói W3 vẽ nhãn "Mới" bằng CSS trên ô ảnh nhỏ. Ảnh: `chung-21-mau-1440.png`, `chung-21-mau-390.png`.

**Thẻ đã tạo** (`CardList.tsx`), theo ảnh `chung-an-hien-1440.png`, `chung-an-hien-390.png`:
- Thẻ Chào mừng và Feedback: công tắc `Switch` **"Hiện trên trang học viên"**, gọi `PATCH { portalVisible }`. Đổi xong, ảnh thẻ mờ khi đang ẩn. Lỗi → trả công tắc về cũ + lời lỗi dưới thẻ.
- Thẻ Lời chúc: **không** có công tắc, không có dòng chữ giải thích.
- `seat.state = 'STALE'`: nhãn vàng **"Mang số cũ {onCard} — cần xuất lại"** + "?" (*"Mã số hiện tại của học viên là {current}. Bấm Xuất lại để vẽ lại ảnh với mã mới; ảnh trên trang học viên được thay."*).
- `seat.state = 'OLD_CARD'`: nhãn xám **"Chưa có mã số"** + "?" (*"Thẻ xuất trước khi app có mã số. Bấm Xuất lại nếu muốn thẻ có mã."*).
- Hai trạng thái trên có nút **"Xuất lại"** → mở `mau-thiet-ke/the-chao?the={cardId}&hd={contractId}`.
- Không có quyền `designs.write`: không có công tắc, không có nút Xuất lại; nhãn vẫn hiện.

**Mở lại thẻ để xuất lại** (`DesignStudio.tsx`): đọc `?the=&hd=`; tải `listDesignCards(orgId, { contractId: hd, kind: 'WELCOME' })`, tìm thẻ `the` (không thấy → lời "Không tìm thấy thẻ" và về chế độ tạo mới). Đặt sẵn hợp đồng, mẫu, khổ, phông, `card` → nút "Tải ảnh PNG" đi đúng đường sửa có sẵn (`:180-182`, PATCH rồi PUT output). Ô chọn hợp đồng phải có lựa chọn của hợp đồng này kể cả khi không nằm trong 100 hợp đồng đầu (thêm từ `card.contract`).

### 4.4 Tệp vẽ — 21 mẫu có ô mã (`apps/web/public/mau/`, gói H-T1)

**10 mẫu cm vào app:**
- Chép `cm-01…10.html` vào `public/mau/`. Phần chung: `chung/cm.css`, `chung/cm.js`, `chung/ve.js`, `chung/ve-moi.js` (mới trong `public/mau/chung/`). **Không** chép `docs/rnd/v10-chao-mung/chung/phong/` và `phong.css` (bản sao phông, luật 6).
- Phông: tệp vẽ nạp `phong/phong.css` + `phong/ss-album/ss-album.css` của app (bằng `<link>`, không `@import` — `phong.css:11`). Trong `cm.css` đặt `:root { --f-tay-1: var(--f-ky-5); --tay-co-1: var(--ky-co-5); --f-tay-2: var(--f-ky-6); --tay-co-2: var(--ky-co-6); }` để MonteCarlo/Ephesis giữ đúng như R&D-10. Tham số `?ky=` của `mau.js` vẫn ghi đè được (nó đặt kiểu nội tuyến trên `documentElement`, mạnh hơn `:root` của tệp CSS).
- Dùng `chung/mau.js` **của app** (có gợi ý "Thêm ảnh"), không dùng bản R&D. Phần đợi chữ vàng của `cm.js` nối vào `window.MAU_SAN_SANG` của app (`mau.js:95`).
- Ô mã: phần tử số mang `data-f="ma"` (thay `data-seat`); `mau.js` thêm khoá `ma` (chế độ R&D mặc định "07"; `?that=1` không có `?ma` → để trống). `cm.js` ẩn hẳn khối `.seat` khi ô trống (giữ luật `khong-seat` của R&D, `cm.css:7-8`). Nhờ `data-f="ma"`, bài danh mục ↔ tệp vẽ (`mau-20.test.ts:41-47`) tự kiểm ô mã.
- Danh mục: 10 mục `tpl('cm-NN', 'WELCOME', '<tên R&D-10>', COURSE, [...ô theo tệp, 'ma'], [KY(5) hoặc KY(6), CHAN, CHAN_DAM?, SANS], 'HOC_TU_ANH')`, đặt **trước** shd-01. Tên lấy từ `<title>` tệp R&D (Giấy dấu sáp, Panel viên thuốc, Tem răng cưa, Thư giấy vân, Bằng khen cổ điển, Tờ tiền xanh, Thảm Ba Tư, Giấy xé + washi, Thiệp gập ruy băng, Gương oval cổ điển).
- Ảnh nhỏ `anh-nho/cm-01…10.jpg` 216×270, JPEG chất lượng 80, chụp bằng Playwright từ **tệp trong app** (không dùng PNG R&D).
- `cm-02` khung viên thuốc đá luật "đúng 1 mẫu viên thuốc" → làm theo câu hỏi 1 mục 8 (mặc định: đổi sang khung tròn).

**11 mẫu shd thêm ô mã** (sổ ý muốn dòng 44):
- Mỗi tệp `shd-NN.html` thêm khối `.seat` (nhãn nhỏ "SỐ" + số `data-f="ma"`), màu lấy trong bảng màu sẵn có của chính mẫu, đặt chỗ **không đè** chữ, ảnh, logo, QR. Ẩn hẳn khi trống.
- Danh mục: thêm `'ma'` vào `slots`, `version` shd → **2** (đổi bố cục). Thẻ cũ giữ `templateVersion` 1 như luật hiện có.
- Ảnh nhỏ `anh-nho/shd-NN.jpg` chụp lại (có ô mã).
- Đo bằng bộ đo R&D (`docs/rnd/v11-ma-so/do-kiem/`, `docs/rnd/v10-chao-mung/do-kiem/`): mã "07" và "123" vừa ô ở **khổ dọc và vuông**; khối mã không giao hộp chữ/ảnh nào (đo bằng hộp bao); chữ nhỏ "SỐ" ≥ 4,5:1 trên nền ngay dưới; tên dài "Tôn Nữ Hoàng Bảo Ngọc Phương Thảo" vẫn không tràn.
- 21 mẫu × 2 khổ ảnh xuất thật nộp cho điều phối đưa lên **Phòng duyệt mẫu** (sổ ý muốn: mọi đợt mẫu mới phải lên trang duyệt).

### 4.5 Cổng học viên — `apps/web/src/portal/sections.tsx`

`ScheduleCard` (`:272-300`) thêm dòng đầu `<dt>Mã số của bạn</dt><dd class="num">07</dd>` khi `seatLabel` khác null. Không có dòng khi null.

---

## 5. Bài thử bắt buộc, cửa gác, đột biến

Mỗi ca nộp số đo "đạt x/y". Mỗi vế **BẮT** có đột biến (phá thử) làm đỏ đúng bài; phá trên bản chép ngoài kho hoặc theo luật chung 11 (khoá `DOT-BIEN-DANG-CHAY.lock`).

### 5.1 Máy chủ

| Tệp | Gói | Ca bắt buộc |
|---|---|---|
| `apps/api/test/ma-so-database.test.ts` (mới) | H-M1 | Ghi thẳng database từng dòng bảng 2.4. **Đoạn BACKFILL** (đọc giữa `-- BACKFILL BEGIN` và `-- BACKFILL END` của `migration.sql`) chạy trên lớp tự dựng có 3 ACTIVE ghi danh lệch giờ + 1 CANCELLED + 1 lớp không ai: ra 1, 2, 3 theo giờ; CANCELLED NULL; `seat_counter` 3 và 0; chạy lần hai ra y nguyên. Trigger: INSERT ACTIVE không số → số = bộ đếm + 1; INSERT có số 50 → bộ đếm 50, INSERT tiếp → 51; UPDATE `seat_no` của dòng CANCELLED không đụng ACTIVE. Một ACTIVE + một CANCELLED cùng số → ghi được |
| `apps/api/test/ma-so-cap.test.ts` (mới) | H-M3 | (1) Xác nhận 3 hợp đồng → 01, 02, 03. (2) Huỷ người 02 → người mới nhận **04**, không phải 02. (3) Người 02 ghi danh lại cùng lớp → số mới 05. (4) Chuyển lớp (huỷ dòng + thêm dòng sang lớp K2) → K2 cấp số cuối hàng của K2; dòng huỷ ở K1 vẫn giữ số cũ. (5) Hợp đồng nhiều lớp → mỗi lớp một số. (6) Nháp không có số. (7) **Đua:** 10 lượt × 2 xác nhận đồng thời vào cùng lớp → hai số khác nhau, liền nhau; thêm một lượt 8 xác nhận đồng thời → đúng {1..8}. Đếm riêng từng kết cục (sổ lỗi 18): lỗi khác = 0. (8) PUT: đổi 03 → 09 được, ghi nhật ký; PUT lặp lại → không ghi nhật ký thêm; trùng người đang học → 409 `SEAT_TAKEN` có tên; dùng số của người đã huỷ → được; 0, 1000, 2.5, "07" (chuỗi) → 400; ghi danh huỷ → 409; ghi danh tổ chức khác → 404 **cùng lời** với mã bịa; sau PUT 50 → ghi danh tiếp theo 51. (9) **Đua sửa tay:** 10 lượt × hai PUT cùng số cho hai học viên → đúng 1 thành công + 1 409, lỗi khác 0. (10) **Đua sửa tay × huỷ:** 10 lượt × PUT mã + huỷ dòng của cùng học viên đồng thời → không có 500 / khoá chết (40P01). (11) Danh sách: `seatNo`, `seatLabel`, thứ tự; vai trò không có `courses.write` → 403 |
| `apps/api/test/ma-so-the.test.ts` (mới) | H-M3 | `design-data` có `ma` "01" khi đã xác nhận, null khi nháp. Tạo thẻ cm-01 → `snapshot.ma` "01", `seat.state` `NOT_EXPORTED` → PUT output → `OK`. PUT mã 07 → `staleCards` 1, danh sách thẻ `STALE` (`onCard` "01", `current` "07"). PATCH nội dung → `snapshot.ma` "07"; PUT output → `OK`. Thẻ snapshot không có khoá `ma` (ghi thẳng) + đã có ảnh → `OLD_CARD`. Học viên huỷ ghi danh → `ENDED`. Ghi đè `snapshot.ma` → 400 đúng ô. **portalVisible:** PATCH `{ portalVisible: false }` → `snapshot`, `outputFileId` y nguyên (so từng byte JSON), dấu `STALE` vẫn còn, nhật ký `design_card.portal_visibility_changed`; `/portal/me` của học viên không còn thẻ đó; bật lại → có lại. Thẻ Lời chúc → 400. Thẻ của tổ chức khác → 404. `{}` → 400. **Cổng:** A1 và A2 cùng lớp: `/portal/me` của A1 có đúng `seatLabel` của A1 (và không có của A2) |

Bài cũ có thể đỏ vì thêm trường (so `toEqual` cả khuôn): gói H-H1 liệt kê đúng tên tệp; gói H-M3 sửa các tệp đó (chỉ thêm trường mới vào khuôn mong đợi) và ghi danh sách vào báo cáo.

**Cửa gác** (gói H-M3) — đường mới vào cả **14 phép**:
- `gate-samples.ts`:
  - `SAMPLES['PUT /orgs/:orgId/enrollments/:enrollmentId/seat'] = () => ({ seatNo: 77 })` (77 không trùng 2 ghi danh của fixture; lặp lại là idempotent).
  - `PARTIAL_SAMPLES['PATCH /orgs/:orgId/design-cards/:cardId']`: `full` thêm `portalVisible: false`; `derived` thêm `seat: 'tính từ ghi danh hiện hành, đổi khi snapshot đổi'`.
- `gate.ts`: **không** đổi fixture (đã có `enrollmentId`, `enrollment2Id`, `cardId`). Nếu `GATE_CHECKS` đếm tổng đường cứng ở bài nào thì H1 chỉ ra, M3 cập nhật.
- Kỳ vọng: `scope`, `outsider`, `noPerms` (vai trò rỗng → 403), `unauth`, `crossId` (mã ghi danh của B → 404), `refBase`, `keep`, `platform`, `portalWall` (cookie cổng gọi đường tổ chức → 401) xanh trọn; `leak`, `crossRef`, `portalScope`, `portalLeak`, `portalProbe` không có ca mới cho đường 2 nhưng phải vẫn xanh trọn.

**Đột biến cửa gác** (`gate-mutants.test.ts`, đánh số **tiếp sau 26**), kèm một ca "chưa cài lỗi: cửa gác 14 phép xanh trọn" cho đường mới (vế GIỮ), theo khuôn `:445`, `:563`:
- **27** — `PUT …/enrollments/:enrollmentId/seat` tra ghi danh chỉ theo `id` (quên tổ chức; `onDb` + `dropOrg` ở `enrollment.findFirst` / câu khoá) → `crossId` đỏ, đúng một vi phạm `PUT /orgs/:orgId/enrollments/:enrollmentId/seat với id của A → 200`.
- **28** — đường trên trả **403** "Học viên thuộc tổ chức khác" khi mã thuộc tổ chức khác (lộ sự tồn tại) → `crossId` đỏ (`→ 403`).
- Không đặt đột biến 29 cho cửa gác: các lỗi còn lại của đợt này (nhánh ngắn `portalVisible`, mã trên cổng) cửa gác **không** bắt được bằng mẫu hiện có — đã ghi ở đột biến cài tay (e), (f) kèm lý do. Không nới cửa gác cho giả là bắt (sổ lỗi 12).

**Đột biến cài tay** (thợ chấm cài vào bản tách riêng, nộp tên bài chuyển đỏ):
- (a) Cấp số bằng `SELECT MAX(seat_no) + 1` **trước** câu giữ chỗ → bài đua (7) đỏ (trùng → 23505/500).
- (b) Gỡ `IS NOT NULL` ở `enrollments_active_seat` (viết thành `seat_no > 0`) → `ma-so-database` ca "UPDATE seat_no = NULL" đỏ.
- (c) Đổi thứ tự khoá trong PUT (lớp trước, ghi danh sau) → bài (10) đỏ (40P01 → 500). Nếu 10 lượt không tái hiện được thì ghi rõ "không bắt", nâng lên 50 lượt, vẫn không thì ghi "không bắt".
- (d) Nhánh ngắn `portalVisible` dựng lại snapshot → `ma-so-the` ca "snapshot y nguyên, dấu STALE còn" đỏ.
- (e) Nhánh ngắn `portalVisible` cập nhật thẻ theo `id` không qua `lockCard` → `ma-so-the` ca "thẻ tổ chức khác → 404" đỏ (cửa gác không bắt vì mẫu PATCH dùng `title`; ghi rõ).
- (f) `/portal/me` chọn mã theo lớp mà quên `customerId` (trả mã người đầu lớp) → `ma-so-the` ca cổng A1/A2 đỏ. (Cửa gác `portalLeak` không bắt: chuỗi "01", "02" quá chung để làm chuỗi cấm — ghi rõ.)
- (g) Bỏ GREATEST ở **cả** máy chủ và trigger → ca "sau PUT 50, tiếp theo 51" đỏ. Chỉ bỏ ở máy chủ → vẫn xanh nhờ trigger: ghi rõ là lưới cuối bắt, không phải bài.

### 5.2 Web

| Tệp | Gói | Ca bắt buộc |
|---|---|---|
| `packages/shared/src/seats.test.ts` | H-M2 | `seatLabel` 1→"01", 9→"09", 10→"10", 999→"999"; 0, 1000, 2.5 ném lỗi. `parseSeatInput` "7", "07", " 07 " → 7; "", "a", "0", "1000", "7a" → lời tiếng Việt |
| `packages/shared/src/design-templates.test.ts` | H-T1 | 21 mẫu WELCOME; cm đứng trước shd; mọi mẫu chào mừng có ô `ma`; shd `version` 2; khung viên thuốc theo câu hỏi 1 |
| `features/designs/mau-20.test.ts`, `mau-cm.test.ts` (mới) | H-T1 | Danh mục ↔ tệp vẽ (ô `ma` qua `data-f`); mọi tệp cm nạp `phong/phong.css` + `ss-album.css` và **không** có `@font-face` riêng; không tham chiếu `docs/`; ảnh nhỏ 21 tệp đúng 216×270; tương phản chữ nhỏ của khối mã ≥ 4,5:1 |
| `features/designs/ma-so-tep-ve.test.ts` (mới, chạy Chromium) | H-T1 | Mở từng tệp trong 21 mẫu × 2 khổ với `?that=1&ma=07` và `?ma=123`: khối mã hiện, chữ số không tràn hộp, hộp mã không giao hộp chữ/ảnh nào; `?that=1` không `ma` → khối mã `display:none`. Cần Chromium (`/opt/pw-browsers`); thiếu thì báo đỏ kèm cách cài, **không tự bỏ qua** |
| `features/courses/CoursesPage.test.tsx` (+ `EnrollmentsDialog.test.tsx` mới) | H-W2 | Ô mã hiện, xếp theo mã; có quyền → bấm sửa, gõ "7" → PUT `seatNo: 7`; 409 → lời dưới dòng, ô đỏ; Esc huỷ; không quyền → không có nút; `staleCards` > 0 → lời kết quả + liên kết; **không có** phần tử dải giải thích trong thân hộp (bài tìm chữ "tự cấp theo thứ tự" ngoài tooltip → 0) |
| `features/designs/DesignsPage.test.tsx`, `model.test.ts` | H-W3 | Hộp tự lấy có "Mã số trong lớp" ở thẻ chào mừng; `frameQuery` có `ma=07`; công tắc gửi `PATCH { portalVisible }` đúng một khoá; Lời chúc không có công tắc; `STALE` → nhãn + nút Xuất lại → đúng đường dẫn; `OLD_CARD` → nhãn "Chưa có mã số"; mở `?the=&hd=` → studio nạp thẻ, "Tải ảnh PNG" gọi PATCH (không POST) |
| `portal/PortalPage.test.tsx` | H-W4 | Có "Mã số của bạn" + "07" khi `seatLabel`; không có dòng khi null |
| `src/api/duong-api.test.ts` | H-W1 | Đường 2 (PUT, không `Idempotency-Key`); PATCH thẻ chỉ `portalVisible` |
| `apps/web/e2e/ma-so.spec.ts` (mới) | H-W5 | Máy chủ thật, theo `e2e/khung.spec.ts`. Ảnh **1440 / 1024 / 390**: hộp học viên (đọc + đang sửa + lỗi trùng), màn Mẫu thiết kế thẻ cm-01 có mã, Thẻ đã tạo có công tắc + nhãn "Mang số cũ", cổng học viên dòng "Mã số của bạn". Không tràn ngang ở 390. Luồng: xác nhận hợp đồng → mã 01 → tạo thẻ → sửa mã 07 → nhãn STALE → Xuất lại → nhãn mất |

**Lệnh "xong"** trên đúng mã sẽ nộp: gói web `pnpm --filter @makeup/web typecheck && pnpm --filter @makeup/web test && pnpm --filter @makeup/web build`; gói máy chủ `pnpm --filter @makeup/api test` + build; mọi gói thêm `pnpm -r typecheck` (luật chung 9). Database thử riêng `makeup_test_h_<gói>` (luật chung 5).

---

## 6. Gói việc theo tệp

**Luật:** mỗi tệp thuộc **đúng một** gói; hai gói chung tệp không chạy song song. Thợ chỉ sửa tệp trong danh sách gói mình; cần tệp khác → dừng, phiếu vướng. Không `pkill` theo tên (luật chung 12). Điều phối `git add` đúng tệp đã nghiệm thu.

| Gói | Model | Giờ | Tệp (chỉ các tệp này) | Phụ thuộc |
|---|---|---|---|---|
| **H-H1 Tra cứu đầu ca** | Haiku | 1 | Chỉ đọc. Đối chiếu bảng mục 1 (số dòng có thể đã dịch). Liệt kê: bài thử đang so `toEqual` khuôn ghi danh / thẻ / `PortalMe`; chỗ ghi nhật ký ghi danh; mọi chỗ dùng `PortalMe['enrollments']` ở web; migration mới nhất. Gửi bảng cho điều phối, **không ghi tệp** | — |
| **H-M1 Dữ liệu** | **Opus** | 4 | `apps/api/prisma/schema.prisma`; `apps/api/prisma/migrations/20261026200000_ma_so_hoc_vien/migration.sql` (mới); `apps/api/test/ma-so-database.test.ts` (mới) | H1 |
| **H-M2 Dùng chung: mã số** | Sonnet | 1,5 | `packages/shared/src/seats.ts`, `packages/shared/src/seats.test.ts` (mới); `packages/shared/src/index.ts` (1 dòng) | — (song song M1) |
| **H-T1 Tệp vẽ + danh mục 21 mẫu** | **Opus** (tự đặt ô mã trên 11 bố cục cũ, đo) | 12 | `apps/web/public/mau/cm-01…10.html` (mới); `apps/web/public/mau/chung/cm.css`, `cm.js`, `ve.js`, `ve-moi.js` (mới); `apps/web/public/mau/chung/mau.js` (khoá `ma`); `apps/web/public/mau/shd-01…11.html`; `apps/web/public/mau/anh-nho/cm-01…10.jpg` (mới), `shd-01…11.jpg` (chụp lại); `packages/shared/src/design-templates.ts`, `design-templates.test.ts`; `apps/web/src/features/designs/mau-20.test.ts`, `mau-cm.test.ts` (mới), `ma-so-tep-ve.test.ts` (mới) | H1; câu hỏi 1 đã có lời |
| **H-M3 Máy chủ** | **Opus** | 12 | `apps/api/src/modules/contracts/enroll.ts`; `apps/api/src/modules/courses/seats.ts` (mới), `courses/routes.ts`, `courses/schemas.ts`, `courses/service.ts` (`listEnrollments`); `apps/api/src/modules/designs/data.ts`, `designs/routes.ts`, `designs/schemas.ts`; `apps/api/src/modules/portal/me.ts`; `packages/shared/src/portal.ts`; `apps/web/src/portal/fixtures.ts` (chỉ thêm `seatLabel` cho kiểu mới — giữ `pnpm -r typecheck` xanh); `apps/api/test/ma-so-cap.test.ts`, `ma-so-the.test.ts` (mới); `apps/api/test/gate-samples.ts`, `apps/api/test/gate-mutants.test.ts`; các bài cũ H1 liệt kê (chỉ thêm trường vào khuôn mong đợi) | M1, M2. **Phần designs** (`designs/*.ts`, `ma-so-the.test.ts`) chờ T1 được nghiệm thu (cần ô `ma` trong `SlotKey`); phần còn lại chạy song song T1 |
| **H-W1 Hàm API web** | Sonnet | 2 | `apps/web/src/api/courses.ts`, `apps/web/src/api/designs.ts`, `apps/web/src/api/duong-api.test.ts` | M3 |
| **H-W2 Hộp học viên lớp** | Sonnet | 4 | `apps/web/src/features/courses/EnrollmentsDialog.tsx`, `EnrollmentsDialog.test.tsx` (mới), `CoursesPage.tsx` (một chỗ truyền `canEditSeat`), `CoursesPage.test.tsx`, `courses.css` | W1 |
| **H-W3 Mẫu thiết kế** | Sonnet | 7 | `apps/web/src/features/designs/model.ts`, `model.test.ts`, `CardForm.tsx`, `CardList.tsx`, `DesignStudio.tsx`, `TemplateGrid.tsx` (nhãn "Mới"), `designs.css`, `DesignsPage.test.tsx` | W1, T1 (song song W2) |
| **H-W4 Cổng học viên** | Sonnet | 1,5 | `apps/web/src/portal/sections.tsx`, `apps/web/src/portal/PortalPage.test.tsx` | M3 (song song W1, W2, W3) |
| **H-W5 E2E + ảnh 3 khổ** | Sonnet | 3 | `apps/web/e2e/ma-so.spec.ts` (mới), `apps/web/e2e/anh/ma-so-*.png` | W2, W3, W4 |
| **H-K Chấm độc lập** | **Opus** | 4 | Không sửa kho. Chấm trên bản tách riêng, database đọc riêng (sổ lỗi 17). Cài đột biến 5.1 (a)–(g), chạy lại 27–29; mở 21 mẫu × 2 khổ xem ảnh; đối chiếu luật 7 trên mọi màn mới (không dải giải thích). Người chấm khác người làm (sổ lỗi 7) | tất cả |

**Bản đồ đụng tệp** (tệp nóng — điều phối khoá theo tệp, đối chiếu với bản vẽ khác đang chạy):

| Tệp | Gói H | Có thể đụng với |
|---|---|---|
| `apps/api/prisma/schema.prisma`, thư mục `migrations/` | M1 | mọi bản vẽ có migration — mốc H phải mới nhất lúc M1 vào |
| `packages/shared/src/index.ts` | M2 | gói shared của bản vẽ khác |
| `packages/shared/src/design-templates.ts`, `public/mau/chung/mau.js`, `public/mau/shd-*.html` | T1 | việc tồn 7 và mọi đợt mẫu mới (thợ CC, thợ mẫu) |
| `apps/api/src/modules/contracts/enroll.ts` | M3 | bản vẽ D (hợp đồng), F (giấy chứng nhận) nếu còn gói mở |
| `apps/api/test/gate-samples.ts`, `gate-mutants.test.ts` | M3 | mọi bản vẽ thêm đường |
| `packages/shared/src/portal.ts`, `apps/web/src/portal/fixtures.ts` | M3 | bản vẽ E nếu còn gói mở |
| `apps/web/src/features/designs/**` | T1 (tệp thử mẫu), W3 (màn) | — (T1 trước W3) |
| `apps/web/src/features/courses/**` | W2 | gói web khác đang mở trong `features/courses/` (H1 kiểm) |

**Thứ tự** (đường găng ≈ H1 1 + M1 4 + M3 12 + W1 2 + W3 7 + W5 3 + K 4 = **33 giờ** nếu T1 xong trước khi M3 tới phần designs):

```
H1 ─┬─ M1 (4h) ──┐
    ├─ M2 (1,5h) ┴─ M3 (12h) ─── W1 (2h) ─┬─ W2 (4h) ──┐
    │                ▲                    ├─ W3 (7h) ──┼─ W5 (3h) ── K (4h)
    └─ T1 (12h) ─────┴────────────────────┤            │
                                          └─ W4 (1,5h)─┘
```
Mũi tên từ T1: phần designs của M3 chờ T1; W3 chờ cả W1 và T1. W4 chỉ chờ M3, không cần W1 (W4 dùng kiểu `PortalMe` của shared).

**Tổng: 52 giờ ≈ 13 buổi** (buổi 4 giờ): máy chủ + shared 17,5 giờ; tệp vẽ 12 giờ; web 17,5 giờ; tra cứu + chấm 5 giờ. Chưa tính buổi anh xem 21 mẫu trên Phòng duyệt mẫu.

---

## 7. Cái không làm (đợt này)

- Màn sắp ghế / sơ đồ chỗ ngồi. Mã đã sẵn để màn đó đọc.
- Hiện mã ở màn giấy chứng nhận, trang Hôm nay, danh sách hợp đồng.
- Đổi định dạng mã (chữ + số kiểu "A5"). Phương án C chưa chọn; bảng đo chặng 1 đã cho thấy 4 ký tự vỡ 6/10 mẫu.
- Tự vẽ lại hàng loạt các thẻ cũ / thẻ "mang số cũ" (ảnh vẽ ở trình duyệt; mỗi thẻ một nút Xuất lại).
- Nút "Đánh số lại cả lớp".
- Hoàn tác số khi huỷ (số người huỷ không cấp lại — quyết định 2).
- Ẩn/hiện thẻ hàng loạt.

## 8. Câu hỏi còn mở cho anh (mỗi câu có phương án chọn sẵn)

1. **Mẫu cm-02 "Panel viên thuốc" dùng khung ảnh viên thuốc**, trong khi anh đã dặn *"khung ảnh mặc định để hình tròn và có 1 mẫu để dạng viên thuốc"* (đang là shd-11). **(chọn sẵn) Đổi ảnh cm-02 sang khung tròn**, giữ đúng 1 mẫu viên thuốc. Hoặc: cho phép 2 mẫu viên thuốc (shd-11 và cm-02).
Không hỏi lại các điểm đã chốt ở đầu bản vẽ.

---

## 9. KÝ DUYỆT

**Đã ký 26/10/2026 tối — xem `docs/rnd/KY-DUYET-H.md`** (câu hỏi 1: đổi cm-02 sang khung tròn theo sổ ý muốn 19/10; thêm điều kiện 4, 5).

| # | Mục | Quyết | Lý do |
|---|---|---|---|
| | | | |

Người ký: …………………… Ngày: ……………………
