# Bản vẽ G — Mẫu in hợp đồng (R&D-09, chặng 2)

> **ĐÍNH CHÍNH 25/10/2026 (điều phối, sau gói G-H1 tra lại — bản gốc bên dưới GIỮ NGUYÊN; chỗ nào đá nhau thì theo đính chính này):**
> 1. Migration: **`20261019220000_mau_in_hop_dong`** (ký duyệt G). Mọi chỗ ghi 20261019170000 (dòng ~179, ~1038, ~1078) đọc là 220000. Mới nhất hiện có: 20261019215000_the_hien_tren_cong.
> 2. Số dòng đã lệch sau bản vẽ D, E, F: dùng bảng tra lại `docs/rnd/BAN-VE-G-TRA-LAI-H1.md` (~35 dòng lệch; routes.tsx Cài đặt ở 102–105; nav.ts Cài đặt 112–123; ContractEditor.tsx chưa có nút In).
> 3. Phông Lora **ĐÃ CÓ** trong app: `apps/web/public/mau/phong/ss-album/lora/` (Lora-VF.woff2, Lora-Italic-VF.woff2, OFL.txt), họ `'SSA Lora'` ở ss-album.css:50–52. Gói G-W2 **dùng lại bản này**, KHÔNG tạo bản thứ hai ở `public/fonts/lora/` (luật 6: cấm bản sao). Thêm dòng "dùng cho mẫu in hợp đồng 1 và 5" vào `docs/GHI-CHEP-MON-CUA-NGUOI-KHAC.md` ở mục Lora/Cormorant.
> 4. Cửa gác hiện có **14 phép** (1420/1420 sau gói E5) và gate-mutants đã dùng tới số 22 (+ D1–D3): đường mới của G thêm mẫu vào 14 phép; đột biến mới đánh số TIẾP sau số lớn nhất hiện có.
> 5. **Bổ sung từ bản vẽ D mục 3.4** (phụ phí tự động — bản vẽ D giao phần in cho G): `PrintLine` thêm trường **`surcharges: PrintSubLine[]`** = các dòng con SURCHARGE chưa huỷ của dòng gốc (dòng tự thêm theo luật VÀ dòng nhập tay gắn vào dòng gốc). Bản in hiện **tên + số lượng + tiền** (lấy đúng `lineTotal` máy chủ), **KHÔNG in tên luật / chữ "tự thêm theo luật"**, không in ghi chú ghi đè giá. Hợp đồng có các dòng khác ngày nhau (nhiều hơn một `date` khác nhau): in ngày của dòng cạnh giờ (`dd/mm · HH:MM–HH:MM`); hợp đồng một ngày giữ như cũ. Gói G-M4 (dữ liệu in) trả `surcharges`; G-W2 (bộ vẽ 5 bố cục) vẽ; bài thử: tổng các dòng in = `money.subtotal` (máy chủ), có ca phù dâu × 2 + phụ phí × 2.
> 6. `ExtraPackageDialog.tsx` đã được bản vẽ D gói W3 sửa (điều phối cho phép 20/10) — gói G-W5 gộp trên bản hiện tại, không lùi.


- Sản phẩm: Makeup Pro. Ngày 19/10/2026. Người viết: Trung tâm R&D. Người đọc: điều phối, các thợ, thợ chấm.
- Phương án: **PA1 — chọn 1 trong 5 bố cục + bật/tắt từng khối + sửa chữ đầu/cuối**, lưu thành "Mẫu in của studio". Trợ lý chọn thay anh Chiến (`docs/NHAT-KY-QUYET-DINH-THAY.md:95`).
- Quyết định đã chốt, thợ không bàn lại:
  - Studio có nhiều mẫu in. Mỗi loại hợp đồng có đúng một mẫu mặc định.
  - Mẫu mặc định: hợp đồng dịch vụ dùng **mẫu 2 Hiện đại**, hợp đồng khoá học dùng **mẫu 1 Cổ điển có quốc hiệu**.
  - Hợp đồng đã in thì giữ đúng mẫu và số bản đã in. Mọi lần in đều ghi vào nhật ký in.
  - **Áp cho cả hai loại hợp đồng** (dịch vụ và khoá học). Anh Chiến dặn: *"Tất cả các tính năng tạo hợp đồng của khóa học và hợp đồng dịch vụ đều có tính năng in nhé"*.
  - In được trên điện thoại.
- Tài liệu đi kèm, bản vẽ này không chép lại:
  - Báo cáo chặng 1: `/home/user/a/docs/rnd/BAO-CAO-RND-09-MAU-IN-HOP-DONG.md`.
  - 5 mẫu in chạy được: `/home/user/a/docs/rnd/v9-mau-in/` (`chung/ban-in.js`, `chung/ban-in.css`, `chung/du-lieu.js`, `mau-1-co-dien.css` … `mau-5-sang-trong.css`, `kiem-in-thu.js`).
  - Bản mẫu màn hình: `/home/user/a/docs/rnd/v9-pa1-chon-bo-cuc.html`.
  - Ảnh: `/home/user/a/docs/rnd/anh-rnd09/` gồm `pa1-quan-ly-*`, `pa1-sua-*`, `pa1-in-*` (khổ 1440 và 390) và 31 trang in `mau*-trang-*.png`.

Đọc theo thứ tự: mục 1 (hiện trạng) → 2 (dữ liệu) → 3 (máy chủ) → 4 (web) → 5 (bài thử) → 6 (gói việc) → 7, 8.

Quy ước chung, giống các bản vẽ C:
- Tiền là `BigInt`, đơn vị **đồng**. Web **không tự tính tiền**: chỉ định dạng số máy chủ trả về.
- Mọi bảng mới có `organization_id`. Mọi khoá ngoại sang bảng của tổ chức là **khoá kép** `(id, organization_id)`.
- Mỗi lần ghi dữ liệu gọi `writeAudit` trong cùng transaction.
- Thân PATCH **không có** `.default()`. Nếu có, máy chủ từ chối khởi động (`apps/api/src/http/route.ts:97`).
- Mọi CHECK có cột cho phép NULL phải viết rõ `IS NULL` / `IS NOT NULL` ở từng vế (`docs/SO-LOI-DA-DO.md` lỗi 24). Mục 2.4 ghi từng chỗ dễ mắc bẫy.

---

## 1. Hiện trạng mã (đã tra, đúng đến 19/10/2026)

| Việc | Hiện trạng | Đường dẫn:dòng |
|---|---|---|
| Tờ in hợp đồng khoá học | Có. Component `ContractPaper` nhận props, **web tự ghép** dòng, tiền, điều khoản | `apps/web/src/features/contracts/ContractPrint.tsx:25` (props), `:44` (tờ giấy), `:48` (chỉ in tên tổ chức viết hoa), `:113` (tách điều khoản, bỏ số đầu dòng), `:124` (chỗ ký), `:153` (`ContractPrintDialog`), `:164` (nút "In / Lưu PDF" gọi `window.print()`) |
| Luật in (CSS) | `@page hop-dong` A4, lề 16/15 mm. `@media print` ẩn màn ứng dụng, đưa lớp phủ và hộp thoại về dòng chảy thường, không ngắt giữa dòng bảng, điều khoản, chỗ ký | `apps/web/src/features/contracts/contracts.css:218-221` (hộp thoại + tờ trên màn), `:245` (điện thoại), `:250-256` (chú thích N1), `:257` (`@page`), `:258-279` (`@media print`) |
| Bài thử luật in | Bài kiểm luật CSS, không cần trình duyệt | `apps/web/src/features/contracts/contracts-print-css.test.ts:48-82` |
| Bài in PDF thật | Chromium `page.pdf`: bản ngắn ra 1 trang; bản 45 điều đủ trang, không lặp, không cắt. Trang in thử dựng bằng Vite | `apps/web/src/features/contracts/ContractPrint.pdf.test.ts:122`, `:135`; `apps/web/src/features/contracts/__in-thu__/main.tsx`, `index.html` |
| Màn hợp đồng **dịch vụ** | **Chưa có nút In**, chưa có thẻ chọn điều khoản. Nút ở đầu thẻ: trạng thái, "Thu tiền", "Huỷ hợp đồng" | `apps/web/src/features/contracts/ContractEditor.tsx:145` (component), `:492` (`save`), `:720` (thanh nút), `:774` (`PageHeader`, `phoneAction`), `:782-799` (đầu thẻ) |
| Màn hợp đồng **khoá học** | Có nút "Xem bản in" / "Bản in" và thẻ chọn điều khoản | `apps/web/src/features/contracts/CourseContractEditor.tsx:17` (nhập), `:100` (`printOpen`), `:433-464` (ghép dữ liệu in **ở web**), `:515` (nút), `:725` (`ContractTextsCard`), `:786-804` (hộp in) |
| Thẻ chọn điều khoản | Dùng chung, đã nhận `contractKind = SERVICE` (chỉ hiện Điều khoản) | `apps/web/src/features/contracts/ContractTexts.tsx:31`, `:48-50`, `:179` (`TextsManager`) |
| Nháp dịch vụ chưa có trường mẫu điều khoản | `termsTemplateId` mới có ở model khoá học | `apps/web/src/features/contracts/courseModel.ts:39`; `model.ts` không có |
| Máy chủ nhận mẫu điều khoản cho cả hai loại | `termsTemplateId` / `rulesTemplateId` ở thân tạo và sửa | `apps/api/src/modules/contracts/schemas.ts:91-95`, `:132-135`; `apps/api/src/modules/contracts/routes.ts:137-145` |
| Mẫu điều khoản có phiên bản | Sửa nội dung thì `version + 1`. Mỗi (tổ chức, loại) có tối đa 1 mặc định, giữ bằng khoá tư vấn và index một phần. **Chỉ lưu số bản, không lưu nội dung các bản cũ** | `apps/api/prisma/schema.prisma:1262-1288`; `apps/api/src/modules/contracts/texts.ts:85-99` (khoá + bỏ mặc định cũ), `:152-171` (chụp lúc xác nhận), `:258-267` (thứ tự khoá); index `contract_texts_one_default` ở `apps/api/prisma/migrations/20261018230000_dao_tao/migration.sql:525` |
| Hợp đồng đã xác nhận giữ bản chụp điều khoản | Có. Trigger cấm đổi `terms`, `rules`, id + bản mẫu sau xác nhận | `schema.prisma:691-698`; `migrations/20261018230000_dao_tao/migration.sql:471-501` |
| Hồ sơ thương hiệu | Có tên, khẩu hiệu, địa chỉ, SĐT, email, website, logo. **Chưa có** người đại diện, tài khoản ngân hàng. PUT ghi toàn bộ, nhưng chỉ ghi các trường liệt kê trong `toData` | `schema.prisma:1075-1112`; `apps/api/src/modules/profile/routes.ts:13-37` (`toData`), `:67` (GET), `:81` (PUT); `schemas.ts:81` (`ProfileBody`). Trang công khai chọn **từng trường** (`public.ts:118-130`) |
| Khách | Có họ tên, SĐT, email. **Chưa có** địa chỉ, CCCD | `schema.prisma:388-412` |
| Dữ liệu dòng hợp đồng | Nhân vật, giờ, nơi làm, thợ, dịch vụ phụ, phí di chuyển (đã chụp số km) | `schema.prisma:728-801`; `apps/api/src/modules/contracts/present.ts:178-215` (`LineView`), `:267`, `:367` (`loadContractDetail`) |
| Tiền đã thu, đợt | Hàm tính dùng chung `summarizePayments`, `allocateToInstallments`. SĐT khách chỉ trả cho người có `customers.read` | `packages/shared/src/payments.ts:77`, `:126`; `apps/api/src/modules/payments/common.ts:82` (`loadProgress`), `:146-147` (`phoneHidden`) |
| Lớp học | Tên lớp, ngày, thứ, phút bắt đầu/kết thúc, giảng viên, cơ sở; số buổi ở khoá | `schema.prisma:1152-1225` |
| Đọc số tiền thành chữ | **Chưa có** trong sản phẩm. Bản R&D có `bangChu` | `docs/rnd/v9-mau-in/chung/ban-in.js:66-91` |
| Cửa gác cách ly | 10 phép kiểm. Fixture tạo đủ mọi loại tài nguyên. **Không tạo sẵn hồ sơ thương hiệu** | `apps/api/test/gate.ts:47-50` (phép), `:178-339` (fixture), `:233` (không hồ sơ) |
| Mẫu cho cửa gác | `SAMPLES`, `REF_SAMPLES`, `REF_VARIANTS`, `PARTIAL_SAMPLES` | `apps/api/test/gate-samples.ts:7`, `:79`, `:231`, `:252` |
| Cửa gác sửa một phần (startup) | `defineRoute` từ chối khởi động nếu thân PATCH có `.default()` / `.prefault()` / `.catch()` | `apps/api/src/http/route.ts:97-106`; `apps/api/src/http/partial.ts:52`; bài `test/gate-partial.ts:122` |
| Đột biến cửa gác | 13 đột biến, mỗi cái phải làm đỏ đúng phép | `apps/api/test/gate-mutants.test.ts:35-250` |
| Chống gửi trùng | Chỉ dùng cho POST. Lưu nguyên phản hồi lần đầu | `apps/api/src/http/route.ts:113`; `schema.prisma:542-559` |
| Điều hướng Cài đặt | Mục cha cần `org.update`, chỉ có con "Hồ sơ thương hiệu". Mục cha cũng hiện khi người dùng thấy được một mục con | `apps/web/src/layout/nav.ts:31` (luật hiện), `:99-107`; `apps/web/src/app/routes.tsx:98-99` |
| Phông có sẵn | Be Vietnam Pro (`apps/web/public/fonts/`), Cormorant Garamond OFL (`apps/web/public/mau/phong/`). **Lora chưa có** trong app (R&D có: `docs/rnd/v9-mau-in/phong/`) | |

**Ba điều thợ phải biết trước khi khởi công:**
1. Bản in hiện tại do **web tự ghép** số liệu (`CourseContractEditor.tsx:433-464`). Bản vẽ này chuyển phần ghép sang **máy chủ**. Web chỉ vẽ, không tính tiền.
2. Luật in N1 chỉ áp khi trang có `.ct-print-dlg`. Bộ vẽ mới dùng tên lớp riêng `.hdin-…`, nên **chạy song song** với bản cũ. Bản cũ chỉ bị xoá ở gói G-W5.
3. Bố cục R&D dùng tên lớp chung chung (`.giay`, `.bang`, `.ky`…). Khi đưa vào app phải thêm tiền tố `hdin-` (mục 4.3).

---

## 2. Dữ liệu

### 2.1 Thay đổi tổng quát

| Bảng | Mới / sửa | Mục đích |
|---|---|---|
| `print_templates` (`PrintTemplate`) | mới | Mẫu in của studio: bố cục, khối bật/tắt, chữ đầu/cuối, mặc định theo loại hợp đồng, số bản |
| `contract_prints` (`ContractPrint`) | mới | Nhật ký in, chỉ ghi thêm. Mỗi lần in lưu: hợp đồng, mẫu + số bản, **bản chụp cấu hình đã dùng**, **bản chụp dữ liệu đã in**, mã băm, người in, lúc in, lần thứ mấy |
| `organization_profiles` | thêm 5 cột | Người đại diện + chức vụ; ngân hàng, số tài khoản, chủ tài khoản. **Đã duyệt** trong báo cáo |
| `customers` | **không đổi** | CCCD và địa chỉ khách chỉ là **đề xuất**, chờ anh duyệt vì là dữ liệu cá nhân (mục 2.6). Khối "CCCD + địa chỉ khách" vẫn in được: in dòng chấm để điền tay |
| `contract_texts` | **không đổi** | Không cần lưu nội dung các bản điều khoản cũ. Lý do ở mục 2.5 |

### 2.2 Prisma (thêm vào `apps/api/prisma/schema.prisma`)

```prisma
// Nguồn của một lần in (bản vẽ G mục 3.4):
// TEMPLATE     = mẫu in hiện hành + dữ liệu hiện tại
// PRIOR_CONFIG = cấu hình đã chụp ở một lần in trước + dữ liệu hiện tại (giữ đúng mẫu & số bản đã in)
// REPRINT      = in lại y hệt một lần in trước (cấu hình + dữ liệu đã chụp)
enum PrintSource {
  TEMPLATE
  PRIOR_CONFIG
  REPRINT
}

// Mẫu in của studio (R&D-09 PA1). Chỉ quyết định CÁCH TRÌNH BÀY; thông tin studio lấy từ hồ sơ thương hiệu,
// điều khoản lấy từ mẫu điều khoản / bản chụp của hợp đồng.
// blocks: { "<khoá khối>": true|false } — CHỈ các khối bật/tắt được; khoá vắng mặt = mặc định của bố cục.
// title / openingText / closingText: NULL = chữ mặc định theo loại hợp đồng (packages/shared/src/print.ts).
// Đổi layout/blocks/title/openingText/closingText ⇒ version + 1 (trigger print_templates_version_guard chặn quên tăng).
// Mỗi loại hợp đồng có đúng một mẫu mặc định (index một phần + máy chủ cấm bỏ mặc định).
model PrintTemplate {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  name           String
  layout         Int
  forService     Boolean  @map("for_service")
  forCourse      Boolean  @map("for_course")
  defaultService Boolean  @default(false) @map("default_service")
  defaultCourse  Boolean  @default(false) @map("default_course")
  blocks         Json     @default("{}")
  title          String?
  openingText    String?  @map("opening_text")
  closingText    String?  @map("closing_text")
  version        Int      @default(1)
  isActive       Boolean  @default(true) @map("is_active")
  // NULL = mẫu có sẵn do hệ thống tạo (migration / lúc tạo tổ chức).
  updatedById    String?  @map("updated_by_id") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  updatedBy    User?           @relation("PrintTemplateUpdatedBy", fields: [updatedById], references: [id], onDelete: Restrict)
  prints       ContractPrint[]

  @@unique([id, organizationId])
  @@index([organizationId])
  @@map("print_templates")
}

// Nhật ký in: CHỈ GHI THÊM (trigger contract_prints_append_only). Lưu bản chụp cấu hình + dữ liệu đúng như đã in
// (đã che theo quyền người in) để in lại ra y hệt, kể cả khi mẫu, hồ sơ thương hiệu, tiền đã thu thay đổi.
model ContractPrint {
  id              String         @id @default(uuid()) @db.Uuid
  organizationId  String         @map("organization_id") @db.Uuid
  contractId      String         @map("contract_id") @db.Uuid
  // Lần in thứ mấy của hợp đồng (1, 2, 3…), cấp dưới khoá tư vấn theo hợp đồng.
  printNo         Int            @map("print_no")
  source          PrintSource
  // Lần in làm gốc (PRIOR_CONFIG, REPRINT) — cùng hợp đồng (khoá kép với contract_id).
  basedOnPrintId  String?        @map("based_on_print_id") @db.Uuid
  templateId      String         @map("template_id") @db.Uuid
  templateVersion Int            @map("template_version")
  // ResolvedPrintConfig (packages/shared/src/print.ts) — mọi khối ghi tường minh, chữ đã thay mặc định.
  config          Json
  // ContractPrintData phiên bản data_version, đúng như đã in (đã che theo quyền người in).
  data            Json
  dataVersion     Int            @default(1) @map("data_version")
  // sha256 hex của JSON dữ liệu đã sắp khoá (stableJson).
  dataHash        String         @map("data_hash")
  contractStatus  ContractStatus @map("contract_status")
  printedById     String         @map("printed_by_id") @db.Uuid
  printedAt       DateTime       @default(now()) @map("printed_at") @db.Timestamptz(3)

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  contract     Contract        @relation(fields: [contractId, organizationId], references: [id, organizationId], onDelete: Restrict)
  template     PrintTemplate   @relation(fields: [templateId, organizationId], references: [id, organizationId], onDelete: Restrict)
  basedOn      ContractPrint?  @relation("PrintBasedOn", fields: [basedOnPrintId, contractId], references: [id, contractId], onDelete: Restrict)
  derived      ContractPrint[] @relation("PrintBasedOn")
  printedBy    User            @relation("ContractPrintedBy", fields: [printedById], references: [id], onDelete: Restrict)

  @@unique([id, organizationId])
  @@unique([id, contractId])
  @@unique([contractId, printNo])
  @@index([organizationId, templateId])
  @@map("contract_prints")
}
```

Thêm vào model có sẵn:
- `Organization`: `printTemplates PrintTemplate[]`, `contractPrints ContractPrint[]`.
- `User`: `printTemplatesUpdated PrintTemplate[] @relation("PrintTemplateUpdatedBy")`, `contractPrints ContractPrint[] @relation("ContractPrintedBy")`.
- `Contract`: `prints ContractPrint[]`.
- `OrganizationProfile`:

```prisma
  // Thông tin trên hợp đồng (bản vẽ G). CHỈ ghi bằng PUT /profile/contract-info — PUT /profile không đụng (toData không liệt kê).
  representativeName  String? @map("representative_name")
  representativeTitle String? @map("representative_title")
  // Ba trường ngân hàng: có cả ba hoặc trống cả ba (CHECK organization_profiles_bank_all_or_none).
  bankName            String? @map("bank_name")
  bankAccountNumber   String? @map("bank_account_number")
  bankAccountName     String? @map("bank_account_name")
```

### 2.3 Migration — MỘT tệp `apps/api/prisma/migrations/20261019170000_mau_in_hop_dong/migration.sql`

Viết **trọn** vào tệp tạm ngoài kho. Kiểm xong mới chuyển vào thư mục migrations bằng **một** lệnh (sổ lỗi 14). Chỉ áp vào database `makeup_test_…` bằng `pnpm db:deploy-to` (sổ lỗi 16). **Không đụng `makeup_dev`.**

```sql
-- Mẫu in hợp đồng (bản vẽ G — R&D-09 PA1).
-- Gồm: bảng mẫu in, nhật ký in, 5 trường "thông tin trên hợp đồng" của hồ sơ thương hiệu, chốt viết tay, mẫu mặc định.
-- Dữ liệu cũ: hai bảng mới chưa có dòng nào; 5 cột mới ở dòng cũ đều NULL, nên mọi CHECK mới đều đạt (sổ lỗi 22: 0 dòng vi phạm).

-- CreateEnum
CREATE TYPE "PrintSource" AS ENUM ('TEMPLATE', 'PRIOR_CONFIG', 'REPRINT');

-- AlterTable
ALTER TABLE "organization_profiles"
  ADD COLUMN "representative_name" TEXT,
  ADD COLUMN "representative_title" TEXT,
  ADD COLUMN "bank_name" TEXT,
  ADD COLUMN "bank_account_number" TEXT,
  ADD COLUMN "bank_account_name" TEXT;

-- CreateTable
CREATE TABLE "print_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "layout" INTEGER NOT NULL,
    "for_service" BOOLEAN NOT NULL,
    "for_course" BOOLEAN NOT NULL,
    "default_service" BOOLEAN NOT NULL DEFAULT false,
    "default_course" BOOLEAN NOT NULL DEFAULT false,
    "blocks" JSONB NOT NULL DEFAULT '{}',
    "title" TEXT,
    "opening_text" TEXT,
    "closing_text" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "print_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_prints" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "print_no" INTEGER NOT NULL,
    "source" "PrintSource" NOT NULL,
    "based_on_print_id" UUID,
    "template_id" UUID NOT NULL,
    "template_version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "data_version" INTEGER NOT NULL DEFAULT 1,
    "data_hash" TEXT NOT NULL,
    "contract_status" "ContractStatus" NOT NULL,
    "printed_by_id" UUID NOT NULL,
    "printed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_prints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "print_templates_organization_id_idx" ON "print_templates"("organization_id");
CREATE UNIQUE INDEX "print_templates_id_organization_id_key" ON "print_templates"("id", "organization_id");
CREATE INDEX "contract_prints_organization_id_template_id_idx" ON "contract_prints"("organization_id", "template_id");
CREATE UNIQUE INDEX "contract_prints_id_organization_id_key" ON "contract_prints"("id", "organization_id");
CREATE UNIQUE INDEX "contract_prints_id_contract_id_key" ON "contract_prints"("id", "contract_id");
CREATE UNIQUE INDEX "contract_prints_contract_id_print_no_key" ON "contract_prints"("contract_id", "print_no");

-- AddForeignKey
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Khoá kép: database chặn ghi nhật ký in của hợp đồng tổ chức khác / mẫu của tổ chức khác.
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_contract_id_organization_id_fkey" FOREIGN KEY ("contract_id", "organization_id") REFERENCES "contracts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_template_id_organization_id_fkey" FOREIGN KEY ("template_id", "organization_id") REFERENCES "print_templates"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Khoá kép theo HỢP ĐỒNG: lần in làm gốc phải cùng hợp đồng.
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_based_on_print_id_contract_id_fkey" FOREIGN KEY ("based_on_print_id", "contract_id") REFERENCES "contract_prints"("id", "contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_printed_by_id_fkey" FOREIGN KEY ("printed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================================================
-- CHỐT VIẾT TAY (Prisma không sinh). Sổ lỗi 24: CHECK ra NULL được coi là ĐẠT.
-- Cột cho phép NULL: luôn mở đầu bằng "cột IS NULL OR …" hoặc viết rõ IS NOT NULL.
-- Biểu thức JSON (->>, jsonb_typeof) trả NULL khi thiếu khoá: luôn bọc COALESCE(…, '') rồi mới so.
-- =====================================================================================================

-- ---------- Hồ sơ thương hiệu: người đại diện, tài khoản ngân hàng ----------
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_representative_name_len"
  CHECK ("representative_name" IS NULL OR char_length(btrim("representative_name")) BETWEEN 1 AND 120);
-- Có chức vụ thì phải có tên người đại diện.
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_representative_title"
  CHECK ("representative_title" IS NULL
         OR ("representative_name" IS NOT NULL AND char_length(btrim("representative_title")) BETWEEN 1 AND 80));
-- Ba trường ngân hàng: đủ cả ba hoặc trống cả ba (IS NULL / IS NOT NULL không bao giờ ra NULL).
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_bank_all_or_none"
  CHECK (("bank_name" IS NULL AND "bank_account_number" IS NULL AND "bank_account_name" IS NULL)
      OR ("bank_name" IS NOT NULL AND "bank_account_number" IS NOT NULL AND "bank_account_name" IS NOT NULL));
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_bank_name_len"
  CHECK ("bank_name" IS NULL OR char_length(btrim("bank_name")) BETWEEN 2 AND 120);
-- Số tài khoản đã chuẩn hoá ở máy chủ: bỏ khoảng trắng, viết hoa.
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_bank_account_number_format"
  CHECK ("bank_account_number" IS NULL OR "bank_account_number" ~ '^[0-9A-Z]{4,30}$');
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_bank_account_name_len"
  CHECK ("bank_account_name" IS NULL OR char_length(btrim("bank_account_name")) BETWEEN 2 AND 120);

-- ---------- Mẫu in ----------
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_layout" CHECK ("layout" BETWEEN 1 AND 5);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_applies" CHECK ("for_service" OR "for_course");
-- Mẫu mặc định của một loại phải dùng cho loại đó và đang dùng (các cột đều NOT NULL — không có bẫy NULL).
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_default_service"
  CHECK (NOT "default_service" OR ("for_service" AND "is_active"));
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_default_course"
  CHECK (NOT "default_course" OR ("for_course" AND "is_active"));
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_name_len"
  CHECK (char_length(btrim("name")) BETWEEN 1 AND 120);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_title_len"
  CHECK ("title" IS NULL OR char_length(btrim("title")) BETWEEN 1 AND 160);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_opening_len"
  CHECK ("opening_text" IS NULL OR char_length(btrim("opening_text")) BETWEEN 1 AND 2000);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_closing_len"
  CHECK ("closing_text" IS NULL OR char_length(btrim("closing_text")) BETWEEN 1 AND 2000);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_version" CHECK ("version" >= 1);
-- blocks là object, mọi giá trị là true/false (null, chuỗi, số đều bị chặn). Khoá hợp lệ do máy chủ kiểm (danh mục ở shared).
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_blocks_shape"
  CHECK (jsonb_typeof("blocks") = 'object'
         AND NOT jsonb_path_exists("blocks", '$.* ? (@.type() != "boolean")'));
-- Mỗi tổ chức tối đa một mẫu mặc định cho mỗi loại hợp đồng.
CREATE UNIQUE INDEX "print_templates_one_default_service" ON "print_templates" ("organization_id") WHERE "default_service";
CREATE UNIQUE INDEX "print_templates_one_default_course" ON "print_templates" ("organization_id") WHERE "default_course";

-- Đổi nội dung in mà quên tăng phiên bản → bản in cũ "v3" không còn nghĩa là một thứ cố định. Database chặn.
CREATE FUNCTION print_templates_version_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."organization_id" <> OLD."organization_id" THEN
    RAISE EXCEPTION 'Mẫu in không được đổi tổ chức';
  END IF;
  IF NEW."version" < OLD."version" THEN
    RAISE EXCEPTION 'Mẫu in không được giảm phiên bản';
  END IF;
  IF (NEW."layout", NEW."blocks", NEW."title", NEW."opening_text", NEW."closing_text")
       IS DISTINCT FROM (OLD."layout", OLD."blocks", OLD."title", OLD."opening_text", OLD."closing_text")
     AND NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'Mẫu in đổi nội dung in thì phiên bản phải tăng';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER print_templates_version_guard BEFORE UPDATE ON "print_templates"
  FOR EACH ROW EXECUTE FUNCTION print_templates_version_guard();

-- ---------- Nhật ký in ----------
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_print_no" CHECK ("print_no" >= 1);
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_template_version" CHECK ("template_version" >= 1);
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_data_version" CHECK ("data_version" >= 1);
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_data_hash" CHECK ("data_hash" ~ '^[0-9a-f]{64}$');
-- TEMPLATE không có gốc; PRIOR_CONFIG / REPRINT bắt buộc có gốc (vế nào cũng viết rõ IS NULL / IS NOT NULL).
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_source_base"
  CHECK (("source" = 'TEMPLATE' AND "based_on_print_id" IS NULL)
      OR ("source" IN ('PRIOR_CONFIG', 'REPRINT') AND "based_on_print_id" IS NOT NULL));
-- Không tự trỏ vào chính mình (khoá ngoại kiểm cuối câu lệnh nên tự trỏ sẽ lọt nếu không chặn).
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_not_self"
  CHECK ("based_on_print_id" IS NULL OR "based_on_print_id" <> "id");
-- Hình dạng tối thiểu của bản chụp. COALESCE: khoá vắng mặt → '' → trượt (không để NULL lọt).
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_snapshot_shape"
  CHECK (jsonb_typeof("config") = 'object'
     AND jsonb_typeof("data") = 'object'
     AND COALESCE("config"->>'layout', '') IN ('1', '2', '3', '4', '5')
     AND COALESCE(jsonb_typeof("config"->'blocks'), '') = 'object'
     AND COALESCE("data"->>'kind', '') IN ('SERVICE', 'COURSE'));

CREATE FUNCTION contract_prints_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'contract_prints chỉ được ghi thêm, không được %', TG_OP;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER contract_prints_append_only BEFORE UPDATE OR DELETE ON "contract_prints"
  FOR EACH ROW EXECUTE FUNCTION contract_prints_block_mutation();

-- ---------- Mẫu mặc định cho tổ chức đã có (chạy lại không nhân đôi) ----------
-- Dịch vụ: mọi tổ chức (tổ chức đào tạo cũng lập được hợp đồng dịch vụ). Khoá học: chỉ ACADEMY.
-- blocks '{}' và chữ NULL = theo mặc định của bố cục (mẫu 1 bật quốc hiệu; mẫu 2 tắt quốc hiệu + ký nháy).
-- SEED BEGIN
INSERT INTO "print_templates" ("id", "organization_id", "name", "layout", "for_service", "for_course",
  "default_service", "default_course", "blocks", "version", "is_active", "updated_by_id", "created_at", "updated_at")
SELECT gen_random_uuid(), o."id", 'Hiện đại', 2, true, false, true, false, '{}'::jsonb, 1, true, NULL, now(), now()
FROM "organizations" o
WHERE NOT EXISTS (SELECT 1 FROM "print_templates" p WHERE p."organization_id" = o."id" AND p."default_service");

INSERT INTO "print_templates" ("id", "organization_id", "name", "layout", "for_service", "for_course",
  "default_service", "default_course", "blocks", "version", "is_active", "updated_by_id", "created_at", "updated_at")
SELECT gen_random_uuid(), o."id", 'Cổ điển có quốc hiệu', 1, false, true, false, true, '{}'::jsonb, 1, true, NULL, now(), now()
FROM "organizations" o
WHERE o."kind" = 'ACADEMY'
  AND NOT EXISTS (SELECT 1 FROM "print_templates" p WHERE p."organization_id" = o."id" AND p."default_course");
-- SEED END
```

R&D đã chạy thử phần SQL này ngày 19/10/2026 trên database tạm `makeup_test_g_rnd_tmp`, đã xoá sau khi thử. Database này chỉ có bảng giả tối thiểu cho `organizations`, `users`, `contracts`, `organization_profiles`. Kết quả:
- Migration áp sạch. Đoạn seed ra đúng 2 mẫu cho tổ chức ACADEMY và 1 mẫu cho tổ chức INDIVIDUAL. Chạy lại seed không nhân đôi.
- **25/25** ca sai bị chặn. **4/4** ca hợp lệ ghi được: dòng nhật ký hợp lệ; đổi tên mẫu không tăng bản; đổi `blocks` có tăng bản; hồ sơ đủ ba trường ngân hàng.
- Đột biến "bỏ COALESCE ở `contract_prints_snapshot_shape`": dòng `config = '{}'` **lọt 1/1**. Đây là bằng chứng bẫy NULL ở bảng 2.4 có thật.

Gói G-M1 vẫn phải đo lại trên schema thật.

Kiểm migration (gói G-M1 phải nộp số đo):
- Áp sạch trên database thử mới, và trên database thử **có dữ liệu cũ** (bản sao của `makeup_test_contract` hoặc database của cửa gác).
- Đếm: số tổ chức = số mẫu dịch vụ mặc định; số tổ chức ACADEMY = số mẫu khoá học mặc định.
- `prisma migrate diff --from-migrations … --to-schema-datamodel …` (shadow là `makeup_test_g_shadow`) chỉ được còn khác ở các chốt viết tay ở trên (CHECK, index một phần, trigger), giống các migration trước.

### 2.4 Bảng kiểm "bẫy NULL" — mỗi dòng phải có một bài **ghi thẳng database** (không qua API)

| Chốt | Ca phải bị chặn | Vì sao dễ lọt |
|---|---|---|
| `contract_prints_source_base` | `source = 'REPRINT'`, `based_on_print_id = NULL` | Vế "có gốc" phải viết `IS NOT NULL`. Nếu thay bằng một phép so sánh với cột (ví dụ `based_on_print_id <> id`) thì NULL làm cả vế ra NULL, và CHECK cho qua |
| `contract_prints_snapshot_shape` | `config = '{}'` (thiếu `layout`), `config = '{"layout":2}'` (thiếu `blocks`), `data = '{}'` | `->>` trả NULL, `NULL IN (…)` ra NULL. Bỏ COALESCE là lọt |
| `organization_profiles_representative_title` | có chức vụ, tên = NULL | Vế phải phải có `IS NOT NULL` |
| `organization_profiles_bank_all_or_none` | chỉ có `bank_name` | Chỉ dùng `IS NULL` / `IS NOT NULL`. Viết `bank_name <> ''` thì NULL ra NULL và lọt |
| `print_templates_blocks_shape` | `{"tho": null}`, `{"tho": "yes"}`, `[]` | `null` là kiểu `"null"`, không phải boolean, nên phải bị chặn |
| `print_templates_title_len` | `title = '   '` | `btrim` |

### 2.5 Có cần lưu nội dung các bản điều khoản cũ không? — **Không. Lý do:**

1. Hợp đồng **đã xác nhận**: điều khoản và nội quy đã được chụp vào `contracts.terms` / `contracts.rules`. Trigger `contracts_lock_after_confirm` cấm đổi (`migrations/20261018230000_dao_tao/migration.sql:471-501`). In lại bao nhiêu lần cũng ra đúng chữ đó.
2. Hợp đồng **nháp đã in**: mỗi lần in lưu bản chụp dữ liệu `contract_prints.data`, gồm cả **chữ điều khoản đã in**. "In lại y hệt" (REPRINT) đọc từ đây. Mẫu điều khoản sửa sau đó cũng không ảnh hưởng.
3. Hồ sơ thương hiệu đổi (địa chỉ, ngân hàng) cũng nằm trong bản chụp. Vì thế **không cần lưu tệp PDF** (rủi ro 3 của báo cáo). Còn hai chỗ chưa y hệt:
   - **Logo:** bản chụp lưu `logoFileId`. Nếu tệp logo cũ đã bị xoá thì bản in lại không có logo.
   - **Phông chữ:** do app cung cấp lúc in.

   Hộp in ghi rõ hai điều này.
4. Còn một rủi ro: in **nháp**, khách ký, rồi mẫu điều khoản bị sửa trước khi bấm "Xác nhận". Lúc đó bản chụp lúc xác nhận sẽ lấy chữ mới. Cách xử lý ở web (G-W3): khi xác nhận một hợp đồng đã in, nếu điều khoản lúc in khác điều khoản sẽ chụp thì hiện cảnh báo. Máy chủ **không** chặn.

### 2.6 Đề xuất chờ anh duyệt — **KHÔNG làm trong bản vẽ này**

`Customer.address` (≤ 500 ký tự) và `Customer.idNumber` (CCCD, 12 chữ số, `^[0-9]{12}$`) là **dữ liệu cá nhân**. Nếu anh duyệt:
- Làm bằng một migration riêng, sau migration này.
- Chỉ người có `customers.read` mới xem được, giống SĐT.
- Thêm vào nhật ký sửa khách.
- Bản in hiện CCCD và địa chỉ trong khối `giay-to`.

Khi chưa duyệt: khối `giay-to` in dòng chấm "………" để điền tay. Bố cục giữ nguyên chỗ, nên lúc thêm trường không phải sửa bố cục.

---

## 3. Máy chủ (`apps/api`)

### 3.1 Danh mục dùng chung — `packages/shared/src/print.ts` (mới)

Danh mục là **mã nguồn**, không nằm trong database, giống `design-templates.ts`. Máy chủ dùng nó để kiểm dữ liệu gửi lên, web dùng để vẽ.

```ts
export const PRINT_LAYOUTS = [1, 2, 3, 4, 5] as const;
export type PrintLayout = (typeof PRINT_LAYOUTS)[number];
export const PRINT_LAYOUT_NAMES: Record<PrintLayout, string> = {
  1: 'Cổ điển trang trọng', 2: 'Hiện đại tối giản', 3: 'Bảng kẻ đầy đủ', 4: 'Gọn một trang', 5: 'Sang trọng viền & logo lớn',
};

// Khối LUÔN CÓ (không có công tắc): tiêu đề + số, bảng dịch vụ/khoá học, tổng tiền, chỗ ký.
export const ALWAYS_ON_BLOCKS = ['tieu-de', 'dich-vu', 'tien', 'chu-ky'] as const;
// Khối bật/tắt được — đúng khoá của R&D (docs/rnd/v9-mau-in/chung/ban-in.js:22-44). kinds: loại hợp đồng có khối này.
export const TOGGLE_BLOCKS = {
  'quoc-hieu':    { label: 'Quốc hiệu – tiêu ngữ',            hint: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM…',      kinds: ['SERVICE', 'COURSE'] },
  'dau-trang':    { label: 'Đầu trang',                        hint: 'Logo, tên, địa chỉ, SĐT — Hồ sơ thương hiệu', kinds: ['SERVICE', 'COURSE'] },
  'hai-ben':      { label: 'Thông tin hai bên',                hint: 'Bên A studio · Bên B khách',               kinds: ['SERVICE', 'COURSE'] },
  'giay-to':      { label: 'CCCD + địa chỉ khách',             hint: 'Chưa có dữ liệu thì in dòng chấm để điền tay', kinds: ['SERVICE', 'COURSE'] },
  'chu-dau':      { label: 'Chữ mở đầu',                       hint: '',                                         kinds: ['SERVICE', 'COURSE'] },
  'chi-tiet':     { label: 'Giờ, địa điểm / lịch học',         hint: '05:00–07:30 · Tại nhà khách: …',           kinds: ['SERVICE', 'COURSE'] },
  'tho':          { label: 'Tên thợ',                          hint: 'Thợ chính / thợ phụ',                      kinds: ['SERVICE'] },
  'bang-chu':     { label: 'Số tiền bằng chữ',                 hint: '“Bảy triệu một trăm năm mươi hai nghìn đồng”', kinds: ['SERVICE', 'COURSE'] },
  'tien-do':      { label: 'Tiến độ thanh toán',               hint: 'Các đợt + hạn + đã thu',                   kinds: ['SERVICE', 'COURSE'] },
  'da-thu':       { label: 'Phiếu thu đã nhận',                hint: 'Mã phiếu, ngày, hình thức',                kinds: ['SERVICE', 'COURSE'] },
  'chuyen-khoan': { label: 'Tài khoản chuyển khoản',           hint: 'Nhập ở Thông tin trên hợp đồng',           kinds: ['SERVICE', 'COURSE'] },
  'dieu-khoan':   { label: 'Điều khoản',                       hint: 'Bản chụp lúc xác nhận',                    kinds: ['SERVICE', 'COURSE'] },
  'noi-quy':      { label: 'Nội quy',                          hint: 'Bản chụp lúc xác nhận',                    kinds: ['COURSE'] },
  'ghi-chu':      { label: 'Ghi chú hợp đồng',                 hint: '',                                         kinds: ['SERVICE', 'COURSE'] },
  'chu-cuoi':     { label: 'Chữ kết thúc',                     hint: '',                                         kinds: ['SERVICE', 'COURSE'] },
  'ky-nhay':      { label: 'Ô ký nháy cuối mỗi trang',         hint: 'Ký nháy A ___ B ___ (Safari không in)',    kinds: ['SERVICE', 'COURSE'] },
  'so-trang':     { label: 'Số hợp đồng + số trang cuối trang', hint: 'HĐDV-000128 · Trang 1/2 (Safari không in)', kinds: ['SERVICE', 'COURSE'] },
} as const;
export type ToggleBlockKey = keyof typeof TOGGLE_BLOCKS;
export type PrintBlockKey = ToggleBlockKey | (typeof ALWAYS_ON_BLOCKS)[number];

// Khối TẮT sẵn theo bố cục (R&D MAC_DINH_TAT, ban-in.js:46).
export const LAYOUT_DEFAULT_OFF: Record<PrintLayout, readonly ToggleBlockKey[]> = {
  1: [], 2: ['quoc-hieu', 'ky-nhay'], 3: ['quoc-hieu'], 4: ['quoc-hieu', 'ky-nhay', 'giay-to'], 5: ['quoc-hieu', 'ky-nhay'],
};

export const DEFAULT_PRINT_TITLE: Record<ContractKind, string> = {
  SERVICE: 'HỢP ĐỒNG DỊCH VỤ TRANG ĐIỂM', COURSE: 'HỢP ĐỒNG ĐÀO TẠO',
};
export const DEFAULT_OPENING_TEXT: Record<ContractKind, string> = {
  SERVICE: 'Hai bên thoả thuận ký hợp đồng dịch vụ trang điểm cho sự kiện ngày {Ngày sự kiện} với các nội dung sau:',
  COURSE: 'Hai bên thoả thuận ký hợp đồng đào tạo khoá {Tên khoá}, lớp {Tên lớp}, khai giảng ngày {Ngày khai giảng} với các nội dung sau:',
};
export const DEFAULT_CLOSING_TEXT = 'Hợp đồng có hiệu lực từ ngày ký, lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.';

// Biến chèn trong ba ô chữ. kinds: biến dùng được cho loại hợp đồng nào.
export const PRINT_VARIABLES = {
  'Tên studio': ['SERVICE', 'COURSE'], 'Địa chỉ studio': ['SERVICE', 'COURSE'], 'SĐT studio': ['SERVICE', 'COURSE'],
  'Người đại diện': ['SERVICE', 'COURSE'], 'Tên khách': ['SERVICE', 'COURSE'], 'SĐT khách': ['SERVICE', 'COURSE'],
  'Mã hợp đồng': ['SERVICE', 'COURSE'], 'Ngày lập': ['SERVICE', 'COURSE'], 'Tổng tiền': ['SERVICE', 'COURSE'],
  'Tổng tiền bằng chữ': ['SERVICE', 'COURSE'], 'Tiền cọc': ['SERVICE', 'COURSE'], 'Đã thu': ['SERVICE', 'COURSE'],
  'Còn lại': ['SERVICE', 'COURSE'], 'Ngày sự kiện': ['SERVICE'],
  'Tên khoá': ['COURSE'], 'Tên lớp': ['COURSE'], 'Ngày khai giảng': ['COURSE'],
} as const satisfies Record<string, readonly ContractKind[]>;
```

Hàm trong cùng tệp. Mỗi hàm có bài thử ở `print.test.ts`.

| Hàm | Việc | Ca thử bắt buộc |
|---|---|---|
| `vndInWords(n: Vnd): string` | Đọc số tiền thành chữ, viết hoa chữ đầu, có "đồng" ở cuối. Thuật toán đúng như `bangChu` của R&D. Đọc nhóm nghìn ở giữa là "không trăm linh…". Số không nguyên, số âm, số > `MAX_MONEY_VND` thì ném lỗi | 0 → "Không đồng"; 5; 11 → "Mười một đồng"; 14 → "Mười bốn đồng"; 15 → "Mười lăm đồng"; 21 → "Hai mươi mốt đồng"; 24 → "Hai mươi tư đồng"; 25; 44 → "Bốn mươi tư đồng"; 105 → "Một trăm linh năm đồng"; 110; 1 000; 1 010 → "Một nghìn không trăm mười đồng"; 1 000 001 → "Một triệu không trăm linh một đồng"; 2 005 000 → "Hai triệu không trăm linh năm nghìn đồng"; **7 152 000 → "Bảy triệu một trăm năm mươi hai nghìn đồng"**; **15 200 000 → "Mười lăm triệu hai trăm nghìn đồng"**; 1 500 000 000 → "Một tỷ năm trăm triệu đồng"; 100 000 000 000 → "Một trăm tỷ đồng"; −1, 1.5, 100 000 000 001 → ném lỗi |
| `splitClauses(body: string \| null): string[]` | Tách theo dòng, bỏ dòng trống, bỏ số đầu dòng `^\d+[.)]\s*`. Giống `ContractPrint.tsx:113` | dòng trống, `\r\n`, "12) …", số giữa câu được giữ |
| `variablesIn(text): string[]` | Tên các biến dạng `{…}` (không lồng nhau) | |
| `checkTemplateText(text, kinds): { unknown: string[]; wrongKind: { name: string; onlyFor: ContractKind[] }[] }` | Biến lạ, hoặc biến không dùng được cho **mọi** loại trong `kinds` | `{Tên lớp}` với `['SERVICE','COURSE']` → wrongKind |
| `resolvePrintConfig(t, kind, overrides?)` → `ResolvedPrintConfig` | Gộp mặc định bố cục + `blocks` + `overrides`. Khối luôn có = true. Khối không thuộc loại hợp đồng = false. Chữ NULL thay bằng mặc định theo loại | Mẫu 2 không có blocks → `quoc-hieu` = false. Mẫu 1 → true. `noi-quy` của dịch vụ = false |
| `variableValues(d: ContractPrintData): Record<string, string>` | Giá trị từng biến, đã định dạng. Giá trị bị che hoặc không có → "……" | SĐT bị che → "……" |
| `fillVariables(text, values): Segment[]` | Trả các đoạn `{ text }` / `{ variable, value }` để web vẽ thành **chữ thường**, không qua HTML. Biến lạ giữ nguyên chữ `{…}` | |
| `formatLocalDate(iso)`, `longLocalDate(iso)` | "19/10/2026", "ngày 19 tháng 10 năm 2026" | |

```ts
export interface ResolvedPrintConfig {
  templateId: string; templateName: string; templateVersion: number;
  layout: PrintLayout;
  blocks: Record<PrintBlockKey, boolean>;   // đủ 21 khoá, tường minh
  title: string; openingText: string; closingText: string;
}
```

Dữ liệu in, phiên bản 1. Máy chủ dựng, web chỉ vẽ:

```ts
export const PRINT_DATA_VERSION = 1;
export type LocalDate = string;   // 'YYYY-MM-DD' theo múi giờ tổ chức
export type LocalTime = string;   // 'HH:mm'

export interface ContractPrintData {
  version: 1;
  kind: ContractKind;
  contract: { code: string; status: ContractStatus; issuedOn: LocalDate /* confirmedAt ?? createdAt */; eventDate: LocalDate | null; notes: string | null };
  studio: {
    name: string;                       // brandName của hồ sơ; chưa có hồ sơ → Organization.name
    tagline: string | null; address: string | null; phone: string | null; email: string | null; website: string | null;
    logoFileId: string | null;          // URL ký KHÔNG nằm trong bản chụp (hết hạn) — trả riêng ở logoUrl
    representative: { name: string; title: string | null } | null;
    bank: { bankName: string; accountNumber: string; accountName: string } | null;
  };
  customer: { fullName: string; phone: string | null; email: string | null; contactHidden: boolean };
  lines: PrintLine[];                   // dòng GỐC chưa huỷ, theo sort_order, created_at
  money: { subtotal: Vnd; discount: Vnd; total: Vnd; totalInWords: string; depositRequired: Vnd; depositInWords: string; travelTotal: Vnd };
  payments: PrintPayments | null;       // null ⇔ paymentsHidden
  paymentsHidden: boolean;
  terms: PrintText | null;
  rules: PrintText | null;              // chỉ COURSE
}
export interface PrintLine {
  kind: 'PACKAGE' | 'SERVICE' | 'SURCHARGE' | 'CUSTOM' | 'COURSE';
  name: string; subjectName: string | null; quantity: number; unitPrice: Vnd; lineDiscount: Vnd; lineTotal: Vnd;
  date: LocalDate | null; startTime: LocalTime | null; endTime: LocalTime | null;
  location: { type: 'STUDIO' | 'CUSTOMER_HOME' | 'OTHER'; text: string | null } | null;  // STUDIO: "tên cơ sở — địa chỉ"
  note: string | null;
  staff: { primary: string[]; assist: string[] };
  addedAfterConfirm: boolean; addedOn: LocalDate | null;     // "phát sinh dd/mm" trên bản in
  addons: PrintSubLine[];                                     // ADDON chưa huỷ
  travel: PrintTravel | null;                                 // TRAVEL chưa huỷ
  course: PrintCourse | null;                                 // chỉ dòng COURSE
}
export interface PrintSubLine { name: string; quantity: number; unitPrice: Vnd; lineDiscount: Vnd; lineTotal: Vnd; addedAfterConfirm: boolean; addedOn: LocalDate | null }
export interface PrintTravel extends PrintSubLine {
  mode: string | null; distanceKm: number | null; perKmAmount: Vnd | null;
  breakdown: { includedKm: number | null; includedFrom: 'PACKAGE' | 'ORGANIZATION' | null; excessKm: number | null; chargedKm: number | null; roundTrip: boolean;
               tier: { fromKm: number; toKm: number | null; amount: Vnd } | null } | null;
}
export interface PrintCourse {
  courseName: string; className: string; startDate: LocalDate; endDate: LocalDate; weekdays: number[];
  startTime: LocalTime | null; endTime: LocalTime | null; sessionCount: number | null;
  instructorName: string | null; location: { name: string; address: string } | null;
}
export interface PrintPayments {
  installments: { name: string; dueDate: LocalDate; amount: Vnd; isDeposit: boolean; paid: Vnd; state: 'PAID' | 'PARTIAL' | 'UNPAID' }[];
  receipts: { code: string; kind: 'RECEIPT' | 'REFUND'; method: PaymentMethod; amount: Vnd; receivedOn: LocalDate }[];  // chưa huỷ
  paid: Vnd; remaining: Vnd; remainingInWords: string;
  scheduleDifference: Vnd | null;      // Σ đợt − tổng (giống loadProgress); ≠ 0 → cảnh báo
}
export interface PrintText { title: string; items: string[]; source: { name: string; version: number } | null; snapshot: boolean }
```

Ghi chú về dữ liệu in:
- Trạng thái đợt chỉ có **ba giá trị**: `PAID`, `PARTIAL`, `UNPAID`. Không dùng "quá hạn", để dữ liệu không đổi theo giờ (mã băm không tự đổi lúc qua nửa đêm). `paid` của từng đợt lấy từ `allocateToInstallments`.
- Khoảng cách km để kiểu `number`. Tiền luôn là số nguyên đồng.
- Thêm `permissions.ts`: đổi nhãn `contracts.texts` thành `'Sửa mẫu điều khoản, nội quy, mẫu in hợp đồng'`. **Không thêm quyền mới**, nên không phải chạy `db:sync-roles` (sổ lỗi 3).

### 3.2 Module mới `apps/api/src/modules/print/`

| Tệp | Nội dung |
|---|---|
| `schemas.ts` | Khuôn zod (mục 3.3) |
| `templates.ts` | Đường mẫu in + `presentTemplate` + khoá mặc định |
| `seed.ts` | `seedDefaultPrintTemplates(tx, orgId, kind)`. Gọi trong transaction tạo tổ chức (`apps/api/src/modules/orgs/routes.ts`, cạnh `seedDefaultGreetingPhrases`). Chạy lại không nhân đôi, khoá dòng tổ chức giống `designs/seed.ts` |
| `data.ts` | `buildPrintData(tx, orgId, contractId, viewer)`, `maskPrintData(data, viewer)`, `stableJson`, `hashPrintData` |
| `prints.ts` | Đường `print-data`, `prints` |
| `routes.ts` | `export const printModuleRoutes = [...templateRoutes, ...printRoutes]`, đăng ký ở `src/app.ts` |

Thêm ở `apps/api/src/modules/profile/`: đường `PUT /orgs/:orgId/profile/contract-info` (`routes.ts`) và khuôn `ContractInfoBody` (`schemas.ts`).

### 3.3 Đường API

| # | Đường | Quyền | Chống trùng | Việc |
|---|---|---|---|---|
| 1 | `GET /orgs/:orgId/print-templates?appliesTo=SERVICE\|COURSE&includeInactive=true` | `contracts.read` | — | Danh sách mẫu: mặc định trước, rồi theo tên. Kèm số lượng dùng |
| 2 | `GET /orgs/:orgId/print-templates/:templateId` | `contracts.read` | — | Một mẫu |
| 3 | `POST /orgs/:orgId/print-templates` | `contracts.texts` | **có** | Tạo mẫu |
| 4 | `PATCH /orgs/:orgId/print-templates/:templateId` | `contracts.texts` | (PATCH) | Sửa một phần. Đổi nội dung in thì `version + 1` |
| 5 | `GET /orgs/:orgId/contracts/:contractId/print-data` | `contracts.read` | — | **Một đường trả đủ dữ liệu in đã tính sẵn**: dữ liệu (đã có tiền bằng chữ), mã băm, URL logo, các mẫu dùng được, mẫu mặc định, lần in gần nhất, số lần in, cảnh báo |
| 6 | `GET /orgs/:orgId/contracts/:contractId/prints/:printId` | `contracts.read` | — | Bản chụp của một lần in (cấu hình + dữ liệu đã che theo người xem), để xem trước khi in lại |
| 7 | `POST /orgs/:orgId/contracts/:contractId/prints` | `contracts.read` | **có** | Ghi nhật ký **ngay trước khi** mở hộp in của trình duyệt |
| 8 | `PUT /orgs/:orgId/profile/contract-info` | `org.update` | (PUT ghi toàn bộ 5 trường) | Người đại diện + ngân hàng |

Không có đường xoá. Mẫu chỉ "ngừng dùng", vì nhật ký in trỏ tới mẫu.

Ghi nhật ký in chỉ cần `contracts.read`. Lý do: ai xem được hợp đồng thì đã có thể in từ trình duyệt. Nhật ký là để biết ai in, không phải để cấm in.

**Khuôn thân (zod 4)** — không dùng `.default()` ở bất kỳ đâu:

```ts
const Kind = z.enum(['SERVICE', 'COURSE']);
const Kinds = z.array(Kind).min(1, 'Chọn ít nhất một loại hợp đồng').max(2)
  .refine((a) => new Set(a).size === a.length, 'Loại hợp đồng bị trùng');
// zod 4: z.record(z.enum(...)) là VÉT CẠN (bắt đủ mọi khoá) — phải dùng z.partialRecord.
const Blocks = z.partialRecord(z.enum(TOGGLE_KEYS), z.boolean(), {
  error: (iss) => (iss.code === 'invalid_key' ? 'Không có khối này (hoặc khối luôn có, không tắt được)' : undefined),
});
const Layout = z.number().int().min(1).max(5);
const Title = z.string().trim().min(1).max(160).nullable();
const Para = z.string().trim().min(1).max(2000).nullable();

export const TemplateCreate = strict({
  name: z.string().trim().min(1, 'Tên mẫu không được để trống').max(120),
  layout: Layout, appliesTo: Kinds,
  blocks: Blocks.optional(), title: Title.optional(), openingText: Para.optional(), closingText: Para.optional(),
  defaultFor: z.array(Kind).max(2).optional(),
});
export const TemplatePatch = strict({
  name: z.string().trim().min(1).max(120).optional(), layout: Layout.optional(), appliesTo: Kinds.optional(),
  blocks: Blocks.optional(),        // gửi blocks = THAY toàn bộ bảng công tắc (không trộn)
  title: Title.optional(), openingText: Para.optional(), closingText: Para.optional(),
  defaultFor: z.array(Kind).max(2).optional(), isActive: z.boolean().optional(),
}).refine((b) => Object.values(b).some((v) => v !== undefined), 'Không có gì để sửa');

const Hash = z.string().regex(/^[0-9a-f]{64}$/, 'Mã băm dữ liệu in không hợp lệ');
export const PrintCreate = z.discriminatedUnion('source', [
  strict({ source: z.literal('TEMPLATE'), templateId: z.uuid(), expectedTemplateVersion: z.number().int().min(1), blockOverrides: Blocks.optional(), expectedDataHash: Hash }),
  strict({ source: z.literal('PRIOR_CONFIG'), basedOnPrintId: z.uuid(), blockOverrides: Blocks.optional(), expectedDataHash: Hash }),
  strict({ source: z.literal('REPRINT'), basedOnPrintId: z.uuid(), expectedDataHash: Hash }),   // in lại y hệt: KHÔNG nhận blockOverrides
]);

export const ContractInfoBody = strict({     // PUT: đủ 5 khoá, giá trị null = để trống
  representativeName: z.string().trim().min(1).max(120).nullable(),
  representativeTitle: z.string().trim().min(1).max(80).nullable(),
  bankName: z.string().trim().min(2).max(120).nullable(),
  bankAccountNumber: z.string().transform((s) => s.replace(/\s+/g, '').toUpperCase())
    .pipe(z.string().regex(/^[0-9A-Z]{4,30}$/, 'Số tài khoản chỉ gồm chữ số / chữ cái, 4–30 ký tự')).nullable(),
  bankAccountName: z.string().trim().min(2).max(120).nullable(),
}).superRefine(/* đủ ba trường ngân hàng hoặc trống cả ba; có chức vụ thì phải có tên */);
```

**Trả về — `PrintTemplateView`:**

```ts
{ id, name, layout, appliesTo: ContractKind[], defaultFor: ContractKind[],
  blocks: Partial<Record<ToggleBlockKey, boolean>>,   // đúng như đã lưu
  title, openingText, closingText,                    // null = mặc định
  version, isActive, createdAt, updatedAt,
  updatedBy: { id, fullName } | null,                 // null = mẫu có sẵn
  usage: { printedContracts: number, lastPrintedAt: string | null } }
```

`usage` đếm bằng một câu `GROUP BY template_id`, dùng index `(organization_id, template_id)`. Không truy vấn từng dòng.

**Trả về — `print-data` (đường 5):**

```ts
{ contract: { id, code, kind, status, updatedAt },
  data: ContractPrintData, dataHash: string,
  logoUrl: string | null, logoUrlExpiresAt: string | null,   // ký mới mỗi lần đọc (signImages của profile/images.ts)
  templates: PrintTemplateView[],                            // đang dùng + dùng được cho loại này; mặc định đứng đầu
  defaultTemplateId: string | null,
  lastPrint: (PrintRecordView & { sameData: boolean }) | null,  // sameData: hash dữ liệu lần đó (che theo NGƯỜI XEM HIỆN TẠI) = dataHash
  printCount: number,
  warnings: { code: PrintWarningCode; message: string }[] }
```

Mã cảnh báo:
- `NO_PROFILE`: chưa có hồ sơ thương hiệu. Tên lấy theo tên tổ chức, không có logo và địa chỉ.
- `NO_REPRESENTATIVE`
- `NO_BANK`
- `CONTACT_HIDDEN`: bạn không có quyền xem SĐT và email khách, nên chỗ đó in "……".
- `PAYMENTS_HIDDEN`: bạn không có quyền xem thu tiền, nên không in tiến độ và phiếu thu.
- `NO_TERMS`
- `NO_INSTALLMENTS`
- `SCHEDULE_DIFFERENCE`: tổng các đợt khác tổng hợp đồng.
- `DRAFT`: hợp đồng nháp, bản in ghi "BẢN NHÁP".
- `LOGO_GONE`: logo của lần in trước đã bị xoá. Chỉ dùng ở đường 6.

`PrintRecordView`:

```ts
{ id, printNo, source, basedOnPrintId, printedAt, printedBy: { id, fullName },
  templateId, templateName /* tên HIỆN TẠI */, templateVersion, layout /* từ config */, contractStatus }
```

Đường 6 trả `{ print: PrintRecordView, config: ResolvedPrintConfig, data, dataHash, logoUrl, warnings }`. Trong đó `data` đã che thêm theo người xem, và `dataHash` là mã băm của bản đã che đó.

### 3.4 Luật xử lý

**Dựng dữ liệu (`buildPrintData`)** — đọc trong **một** transaction chỉ đọc. Gồm:
- hợp đồng; dòng có thợ (tên hiển thị); lớp, khoá, giảng viên, cơ sở;
- phiếu thu và đợt (chỉ khi có `payments.read`);
- mẫu điều khoản đang chọn (chỉ hợp đồng nháp);
- hồ sơ thương hiệu; múi giờ tổ chức.

Luật:
- Mọi câu truy vấn lọc theo `organizationId`. Hợp đồng không thuộc tổ chức thì trả **404 "Không tìm thấy hợp đồng"**, đúng lời của `loadContractDetail` (`present.ts:367`).
- Không lấy dòng đã huỷ. Tiền lấy **thẳng từ hợp đồng**, không cộng lại ở đây: `subtotal`, `discount`, `total`, `depositRequired`. Bài thử kiểm Σ `lineTotal` các dòng in (cả dịch vụ phụ và phí di chuyển) = `subtotal`.
- `paid` = `summarizePayments(...).paid`. Đợt lấy từ `allocateToInstallments`. Giống `loadProgress` (`payments/common.ts:121-135`).
- Điều khoản:
  - Hợp đồng **nháp**: theo thứ tự ưu tiên — mẫu đang chọn (bản mới nhất) → điều khoản tự nhập `contracts.terms` → mẫu mặc định dùng được cho loại hợp đồng. Ghi `snapshot: false`.
  - Hợp đồng **đã xác nhận**: lấy `contracts.terms` / `rules`. Tên mẫu tra theo `termsTemplateId`, bản lấy từ `termsTemplateVersion`. Ghi `snapshot: true`.
- Ngày giờ đổi sang **múi giờ tổ chức** ở máy chủ (`Organization.timezone`). Web không tự đổi múi giờ.
- **Che theo quyền người xem:**
  - Không có `customers.read`: `phone` = null, `email` = null, `contactHidden` = true.
  - Không có `payments.read`: `payments` = null, `paymentsHidden` = true.
  - `maskPrintData` **chỉ che thêm, không bao giờ mở**. Áp cả cho bản chụp của lần in trước (đường 6, và lúc REPRINT).
- `dataHash = sha256(stableJson(data))`. `stableJson` sắp khoá đối tượng theo thứ tự chữ, đệ quy; mảng giữ nguyên thứ tự. Không dùng `JSON.stringify` thẳng trên đối tượng dựng từ hàng database.

**Ghi nhật ký in (đường 7)** — trong **một** transaction:
1. Khoá tư vấn `pg_advisory_xact_lock(hashtext('contract_print:' || contractId))`.
2. Đọc hợp đồng theo `(id, organizationId)`. Không có → 404. `CANCELLED` → **409** `reason: CONTRACT_CANCELLED`.
3. Theo nguồn in:
   - `TEMPLATE`: đọc mẫu `(templateId, organizationId)`. Không có → 404 "Không tìm thấy mẫu in". Lời báo phải **giống hệt** khi gửi mã bịa (sổ lỗi 12). Ngừng dùng → 400. Không dùng cho loại hợp đồng này → 400. `version ≠ expectedTemplateVersion` → **409** `TEMPLATE_CHANGED`. Cấu hình = `resolvePrintConfig(mẫu, kind, blockOverrides)`. Dữ liệu = dựng mới.
   - `PRIOR_CONFIG`: đọc lần in gốc `(basedOnPrintId, contractId, organizationId)`. Không có → 404 "Không tìm thấy lần in". Cấu hình = `config` của lần đó, áp thêm `blockOverrides`. `template_id` và `template_version` lấy của lần đó. Dữ liệu = dựng mới.
   - `REPRINT`: lần in gốc như trên. Cấu hình = `config` của lần đó, không đổi. Dữ liệu = `maskPrintData(data của lần đó, người in)`.
4. `hash(dữ liệu) ≠ expectedDataHash` → **409** `DATA_CHANGED`. **Không ghi gì.**
5. `printNo = COALESCE(MAX(print_no), 0) + 1`. Chèn dòng. `writeAudit('contract.printed', { printNo, source, templateId, templateVersion, basedOnPrintId, dataHash })`.
6. Trả **201** `PrintRecordView`. Không trả lại dữ liệu: web đã có đúng dữ liệu đó, vì mã băm đã khớp. Bảng `idempotency_keys` vì thế không phải lưu bản chụp lớn.

**Mẫu in (đường 3, 4)** — một khoá tư vấn cho cả tổ chức `print_template_default:{orgId}`. Lấy khoá **trước** khoá dòng mẫu (`SELECT … FOR UPDATE`), giống thứ tự khoá ở `texts.ts:258-267`. Luật:
- `appliesTo` có `COURSE` mà tổ chức không phải `ACADEMY` → 400 "Tổ chức chưa bật đào tạo — mẫu in chỉ dùng cho hợp đồng dịch vụ".
- `defaultFor` phải nằm trong `appliesTo` (giá trị mới hoặc giá trị đang lưu). Đặt mặc định cho loại K thì bỏ cờ mặc định của mẫu đang giữ K, **cùng transaction**, ghi id các mẫu bị bỏ vào nhật ký.
- **Không bỏ mặc định được.** Các trường hợp sau đều trả 409 `DEFAULT_REQUIRED`, kèm lời "Mỗi loại hợp đồng cần một mẫu mặc định — bật mặc định ở mẫu khác":
  - `defaultFor` thiếu một loại mà mẫu đang là mặc định;
  - `isActive: false` ở mẫu đang là mặc định;
  - `appliesTo` bỏ đi loại mà mẫu đang là mặc định.
- Ba ô chữ: `checkTemplateText` theo `appliesTo` (giá trị mới hoặc đang lưu). Có biến lạ → 400, chỉ đúng ô (`fields: ['openingText']`), lời "Không có biến {X}. Biến dùng được: …". Biến sai loại → 400 "Biến {Tên lớp} chỉ dùng cho hợp đồng khoá học — mẫu này dùng cho cả hợp đồng dịch vụ".
- `version + 1` **chỉ khi** `layout`, `blocks`, `title`, `openingText` hoặc `closingText` khác giá trị đang lưu. So sau khi chuẩn hoá: `blocks` sắp khoá, chữ đã trim. Đổi tên, `appliesTo`, `defaultFor`, `isActive` thì không tăng. Gửi lại đúng giá trị cũ thì không tăng: PATCH lặp lại là idempotent.
- `writeAudit('print_template.created' | 'print_template.updated', { before, after, versionBumped, unsetDefaultIds })`.

**Thông tin trên hợp đồng (đường 8):**
- Khoá dòng tổ chức, giống `lockProfile` (`profile/routes.ts:61`).
- Chưa có hồ sơ → **409** `PROFILE_REQUIRED` "Chưa có hồ sơ thương hiệu — lưu hồ sơ ở Cài đặt › Hồ sơ thương hiệu trước". Không tự tạo hồ sơ: cửa gác cần tổ chức không có hồ sơ (`gate.ts:233`).
- Chỉ cập nhật 5 cột này. `writeAudit('profile.contract_info_updated', { before, after })`.
- Trả về giống `GET /profile`: 5 trường mới tự đi theo, vì `presentProfile` trải cả dòng (`profile/routes.ts:43-57`).
- **`PUT /profile` không được xoá 5 trường này.** `toData` không liệt kê chúng, nên phải có bài thử giữ nguyên.
- Trang công khai không được lộ 5 trường này. Phải có bài thử.

### 3.5 Bảng lỗi

| Tình huống | HTTP | `reason` | Lời (tiếng Việt, hiện cho người dùng) |
|---|---|---|---|
| Hợp đồng không có / của tổ chức khác | 404 | — | Không tìm thấy hợp đồng |
| Mẫu không có / của tổ chức khác (cùng một lời) | 404 | — | Không tìm thấy mẫu in |
| Lần in gốc không có / thuộc hợp đồng khác | 404 | — | Không tìm thấy lần in |
| Mẫu ngừng dùng (khi in) | 400 | — | Mẫu in "{tên}" đang ngừng dùng |
| Mẫu không dùng cho loại này | 400 | — | Mẫu "{tên}" chỉ dùng cho hợp đồng {loại} |
| Mẫu vừa được sửa | 409 | `TEMPLATE_CHANGED` | Mẫu in vừa được sửa (nay là bản v{n}) — xem lại bản in rồi bấm In lần nữa |
| Dữ liệu hợp đồng vừa đổi | 409 | `DATA_CHANGED` | Hợp đồng vừa thay đổi — đã tải dữ liệu mới, xem lại rồi bấm In lần nữa |
| Hợp đồng đã huỷ | 409 | `CONTRACT_CANCELLED` | Hợp đồng đã huỷ — không in |
| Khối lạ / khối luôn có | 400 | — | Không có khối này (hoặc khối luôn có, không tắt được) |
| Biến lạ / sai loại | 400 | — | xem 3.4 |
| Khoá học ở tổ chức chưa bật đào tạo | 400 | — | Tổ chức chưa bật đào tạo — mẫu in chỉ dùng cho hợp đồng dịch vụ |
| Bỏ / ngừng dùng mẫu mặc định | 409 | `DEFAULT_REQUIRED` | xem 3.4 |
| Thông tin hợp đồng khi chưa có hồ sơ | 409 | `PROFILE_REQUIRED` | xem 3.4 |
| Ngân hàng thiếu một trong ba trường | 400 | — | Nhập đủ ngân hàng, số tài khoản, chủ tài khoản (hoặc để trống cả ba) |
| Thiếu `Idempotency-Key` ở đường 3, 7 | 400 | — | (lời có sẵn của middleware) |
| Cùng khoá, khác thân | 409 | — | (lời có sẵn) |

Lỗi trigger và CHECK của database **không được** để lộ nguyên văn cho người dùng (VIEC-TON 22). Mọi đường ghi phải kiểm ở máy chủ trước. Database chỉ là lưới an toàn.

---

## 4. Web (`apps/web`)

### 4.1 Hàm API — `src/api/print.ts` (mới)

- `listPrintTemplates(orgId, q?, signal?)`
- `getPrintTemplate(orgId, id, signal?)`
- `createPrintTemplate(orgId, body, idempotencyKey)`
- `updatePrintTemplate(orgId, id, body)`
- `getPrintData(orgId, contractId, signal?)`
- `getContractPrint(orgId, contractId, printId, signal?)`
- `createContractPrint(orgId, contractId, body, idempotencyKey)`

Ở `src/api/profile.ts` thêm `updateContractInfo(orgId, body)`.

Ở `src/api/types.ts`:
- `BrandProfile` thêm 5 trường;
- xuất lại các kiểu `ContractPrintData`, `ResolvedPrintConfig`… từ `@makeup/shared`;
- thêm `PrintTemplateView`, `PrintRecordView`, `PrintDataResult`.

Bài `duong-api.test.ts` và `khop-hop-dong.test.ts` thêm đủ các hàm và khuôn mới.

### 4.2 Nút In ở **cả hai** loại hợp đồng — `features/contract-print/dialog/PrintButton.tsx`

```ts
interface PrintButtonProps {
  orgId: string; tz: string; contractId: string | null;
  status: ContractStatus | null;
  needsSave: boolean;                         // chưa lưu, hoặc nháp có thay đổi chưa lưu
  ensureSaved: () => Promise<string | null>;  // lưu nháp; trả id hợp đồng, null = lưu hỏng (màn tự báo lỗi)
  canManageTemplates: boolean;                // has('contracts.texts') → liên kết "Sửa mẫu in" trong hộp
  phone: boolean; size: 'sm' | 'md';
}
```

- Chữ trên nút:
  - Máy tính: "In hợp đồng". Có thay đổi chưa lưu: "Lưu nháp & in".
  - Điện thoại: "In". Có thay đổi chưa lưu: "Lưu & in".
- Hợp đồng `CANCELLED`: nút tắt, chú thích "Hợp đồng đã huỷ — không in".
- Bấm khi `needsSave`: gọi `ensureSaved()`. Được id thì mở hộp in. Không được thì không mở.

Chỗ đặt nút (gói G-W5):
- **Dịch vụ** (`ContractEditor.tsx`):
  - Máy tính và máy tính bảng: ở `actions` của thẻ đầu (`:782-799`), xếp theo thứ tự: trạng thái, **In hợp đồng**, Thu tiền, Huỷ hợp đồng.
  - Điện thoại: trong `phoneAction` của `PageHeader` (`:774`), cạnh nhãn trạng thái, cỡ `sm`.
- **Khoá học** (`CourseContractEditor.tsx`): thay `printButton` (`:515-519`) và `ContractPrintDialog` (`:786-804`) bằng `PrintButton`, giữ nguyên chỗ cũ.

### 4.3 Bộ vẽ bản in dùng chung 5 bố cục — `features/contract-print/paper/`

Nguồn: chuyển `docs/rnd/v9-mau-in/chung/ban-in.js` (hàm `mau1` … `mau5`) và 5 tệp CSS sang React. **Giữ đúng hình dáng** của 31 ảnh `anh-rnd09/mau*-trang-*.png`.

| Tệp | Việc |
|---|---|
| `PrintPaper.tsx` | Nhận `{ data, config, logoUrl, printMark?: { printNo, printedOn, source } }`. Chọn `Layout1` … `Layout5`. Gắn `<style>` chân trang từ `pageCss()` |
| `layouts/Layout{1..5}.tsx` | Mỗi tệp là một bố cục. Chỉ đọc `data` + `config`. **Không cộng trừ tiền** |
| `parts.tsx` | Mảnh dùng chung: đầu trang studio, hai bên, bảng dòng, khung tổng, tiến độ, phiếu thu, chuyển khoản, điều khoản, chỗ ký, chữ có biến (`fillVariables` → `<span className="hdin-bien">`) |
| `rows.ts` | Dòng in → hàng hiển thị: `{ cap: 0 \| 1, stt, ten, chiTiet[], sl, dg, giam, tt }`. Lấy từ `hangDichVu()` của R&D. Chuỗi công thức km: "18,4 km một chiều, gói miễn 10 km → vượt 8,4 km × 2 chiều = 16,8 km × 15.000 ₫" |
| `pageCss.ts` | Chân trang theo từng bố cục: `@page hdin-N { @bottom-left { content: "…" } @bottom-center { content: "Trang " counter(page) " / " counter(pages) } @bottom-right { … ký nháy … } }`. Mọi chuỗi đưa vào CSS phải đi qua `cssString()`: bỏ xuống dòng, thoát `\` và `"`, bỏ `<` |
| `PrintFrame.tsx` | Khung hộp thoại để in: `<Dialog className="hdin-dlg">` + vùng xem trước có thu phóng. Dùng **Dialog ở mọi khổ, không dùng BottomSheet**, vì luật in dựa vào `.ui-overlay > .ui-dialog` |
| `usePaperReady.ts` | Chờ `document.fonts.ready` và `img.decode()` của logo, rồi mới cho bấm In. Logo hỏng thì ẩn |
| `paper.css` | Phần chung (`ban-in.css` đổi `.giay` → `.hdin-giay`) + luật in L1–L10 (mục 4.6) |
| `layout-1.css` … `layout-5.css` | Đổi `.gN` → `.hdin-gN`, `@page mN` → `@page hdin-N`. Lớp bên trong vẫn nằm dưới `.hdin-gN` |
| `fonts.css` | `@font-face` "MP Lora" (`/fonts/lora/*.ttf`) và "MP Cormorant" (`/mau/phong/CormorantGaramond-*.ttf`), `font-display: block` |
| `sampleData.ts` | Chuyển từ `chung/du-lieu.js`, đúng kiểu `ContractPrintData`: `SAMPLE.SERVICE.long` (HĐDV-000128, tổng 7.152.000 ₫), `.short`, `SAMPLE.COURSE.long` (HĐKH-000046, 45 điều + 8 nội quy, 15.200.000 ₫), `.short`, và `SAMPLE.SERVICE.longTable` (**40 dòng**, để thử chân bảng không lặp ở mẫu 3) |
| `__in-thu__/index.html`, `main.tsx` | Trang in thử: `?bo-cuc=1..5&loai=SERVICE\|COURSE&ban=long\|short\|longTable&tat=khoi,…`. Dựng `PrintFrame` + `PrintPaper` thật. Màn giả `.in-thu-man` phía sau phải ẩn khi in |

Tài sản tĩnh:
- `apps/web/public/fonts/lora/`: chép 4 tệp `.ttf` và `Lora-OFL.txt` từ `docs/rnd/v9-mau-in/phong/`.
- `apps/web/public/mau-in/bo-cuc-{1..5}.png`: ảnh thu nhỏ rộng 240 px, làm từ `anh-rnd09/mau{N}-dich-vu-ngan-trang-1.png` bằng `convert … -resize 240x`.

**Xem trước trên màn:**
- Tờ giấy dựng ở khổ thật 210 mm. Thu phóng bằng biến `--hdin-zoom` = bề rộng vùng chứa / 793,7 px, đo bằng `ResizeObserver`.
- Luật `zoom: var(--hdin-zoom)` chỉ nằm trong `@media screen`. **Không** dùng `calc(100vw / 210mm)`: phép chia hai độ dài chưa chạy trên mọi trình duyệt.
- Trên màn, tờ có `padding` bằng lề `@page` để trông như trang giấy. Khi in, `padding` = 0.
- Số trang ước tính = trần(chiều cao tờ / chiều cao vùng chữ của bố cục). Hằng số `PAGE_CONTENT_MM[N]` lấy từ lề `@page` của từng bố cục; bài `print-css.test.ts` kiểm hằng số khớp CSS. Màn ghi "Khoảng N trang A4". Xem trước **không chia trang** (mục 7).

### 4.4 Hộp "In hợp đồng" — `features/contract-print/dialog/PrintDialog.tsx`

Bản mẫu: ảnh `anh-rnd09/pa1-in-1440.png`, `pa1-in-390.png`.

**Tải:** gọi `getPrintData`. Nếu có `lastPrint` thì gọi song song `getContractPrint(lastPrint.id)`.

**Lựa chọn** (radio), chọn sẵn theo hàm thuần `defaultChoice()` (có bài thử):

| Tình huống | Chọn sẵn |
|---|---|
| Đã xác nhận / hoàn thành, **có** lần in, dữ liệu không đổi (`sameData`) | REPRINT lần in gần nhất |
| Đã xác nhận / hoàn thành, có lần in, dữ liệu **đã đổi** | PRIOR_CONFIG lần in gần nhất |
| Nháp có lần in | TEMPLATE, dùng mẫu của lần in trước (nếu còn dùng được), không thì mẫu mặc định |
| Chưa in lần nào | TEMPLATE mẫu mặc định |
| Không có mẫu nào | Báo "Chưa có mẫu in cho loại hợp đồng này". Nếu có `canManageTemplates` thì kèm liên kết "Cài đặt › Mẫu in hợp đồng" |

Các dòng lựa chọn:
1. Chỉ có khi đã in. **"Giữ mẫu đã in — {tên mẫu} · bản v{n}"**, dòng phụ "Lần in {k}: {dd/mm/yyyy hh:mm} · {người in}".
   - Khi dữ liệu đã đổi, có thêm công tắc **"In lại y hệt bản đã in"** (bật = REPRINT, tắt = PRIOR_CONFIG). Dưới công tắc là danh sách thay đổi từ `printDiff(cũ, mới)`, ví dụ: "Tổng 7.152.000 ₫ → 7.452.000 ₫", "Đã thu thêm 2.000.000 ₫", "Thêm 1 dòng phát sinh", "Điều khoản đổi".
   - Khi dữ liệu không đổi, không có công tắc.
2. Mỗi mẫu đang dùng: "{tên} · bản v{n}", kèm nhãn "Mặc định" nếu là mặc định. Dòng phụ "Bố cục {N} · {tên bố cục}". Nếu là mẫu của lần in trước nhưng đã có bản mới hơn thì thêm "Đã sửa từ v{cũ} lên v{mới} sau lần in trước".

Bên dưới, ẩn khi chọn REPRINT, có ba công tắc nhanh. Chúng đổi `blockOverrides`, chỉ cho lần in này, không sửa mẫu:
- "Kèm phiếu thu đã nhận" (`da-thu`);
- "Tài khoản chuyển khoản" (`chuyen-khoan`). Tắt và có chú thích khi chưa nhập ngân hàng;
- "Ô ký nháy cuối mỗi trang" (`ky-nhay`).

Cảnh báo lấy từ `warnings` của máy chủ. Trên Safari (iPhone, Mac), khi `ky-nhay` hoặc `so-trang` đang bật, thêm câu: "Safari không in số trang và ô ký nháy ở chân trang".

**Xem trước:** `PrintPaper` của lựa chọn hiện tại.
- REPRINT: dữ liệu và cấu hình đã chụp.
- PRIOR_CONFIG: cấu hình đã chụp + dữ liệu hiện tại + công tắc nhanh.
- TEMPLATE: `resolvePrintConfig(mẫu, loại, công tắc)` + dữ liệu hiện tại.

**Bấm "In / Lưu PDF"** (điện thoại: "In / PDF"):
1. Gọi `createContractPrint` với nguồn đã chọn và `expectedDataHash` của dữ liệu đang xem. Với TEMPLATE, gửi thêm `expectedTemplateVersion`. Mỗi lần bấm dùng một `Idempotency-Key` mới, nhưng khi đang chờ thì nút bị khoá: không gửi hai lần.
2. Gặp 409 `DATA_CHANGED` hoặc `TEMPLATE_CHANGED`: tải lại `print-data`, hiện dải vàng với lời của máy chủ, **không** mở hộp in.
3. Được 201: gắn `printMark` (lần in, ngày) vào chân trang. Dùng `flushSync`, chờ một khung hình, rồi gọi `window.print()`.
4. Sau đó hộp chuyển sang trạng thái "Đã ghi lần in thứ {k}". Có nút phụ "Hộp in không hiện? Mở lại", nút này chỉ gọi `window.print()`, **không** ghi thêm nhật ký.

Các trạng thái khác:
- Mất mạng: nút In tắt, ghi "Cần mạng để ghi nhật ký in".
- Đang chờ phông và ảnh (`usePaperReady`): nút ghi "Đang chuẩn bị bản in…".
- Lỗi 404 / 403: hiện lời của máy chủ.

**Bố cục theo ba khổ:**
- **1440:** Dialog `lg`, rộng 960. Xem trước bên trái (cột co giãn), lựa chọn bên phải rộng 300. Chân hộp: "Đóng", "In / Lưu PDF".
- **1024:** như 1440, cột lựa chọn 280, vùng xem trước thu nhỏ theo bề ngang.
- **390:** Dialog tràn màn. Xem trước ở trên (thu nhỏ vừa bề ngang, cao tối đa 60 vh, cuộn được). Lựa chọn ở dưới. Chân hộp dính đáy có "In / PDF". **Không tràn ngang.**

**In trên điện thoại:**
- iPhone: hộp in AirPrint. Lưu PDF bằng cách bấm "Chia sẻ" trong xem trước in.
- Android Chrome: in, rồi chọn "Lưu dưới dạng PDF".
- App đã thêm ra màn hình chính trên iPhone (`navigator.standalone`) có thể không mở được hộp in. Lúc đó hiện câu "Mở bằng Safari để in" kèm nút chép đường dẫn. **Phải thử máy thật** (mục 8).

**Cảnh báo khi xác nhận** (rủi ro 4 ở mục 2.5): `PrintButton` cung cấp hàm thuần `termsChangedSincePrint(lastPrintData, currentTerms)`. Gói G-W5 gọi hàm này trong luồng "Xác nhận hợp đồng" của cả hai màn. Nếu khác thì hỏi lại: "Điều khoản sẽ chụp khác bản đã in cho khách — vẫn xác nhận?".

### 4.5 Màn Cài đặt › Mẫu in hợp đồng — `features/contract-print/settings/`

Đường đi:
- `/:orgSlug/cai-dat/mau-in`: danh sách.
- `/:orgSlug/cai-dat/mau-in/moi?bo-cuc=N&loai=SERVICE|COURSE`: tạo mẫu.
- `/:orgSlug/cai-dat/mau-in/:templateId`: sửa mẫu.

Điều hướng (`layout/nav.ts`):
- Thêm mục con `{ key: 'mau-in', path: 'cai-dat/mau-in', label: 'Mẫu in hợp đồng', permission: 'contracts.texts' }`.
- Mục con "Hồ sơ thương hiệu" ghi rõ `permission: 'org.update'`.
- `cai-dat` (chỉ mục) đổi từ `Navigate to "thuong-hieu"` sang `NavSectionHome navKey="cai-dat"` (`routes.tsx:98`). Như vậy quản lý (có `contracts.texts`, không có `org.update`) vào đúng "Mẫu in", không gặp trang 403.

**Màn danh sách** (ảnh `pa1-quan-ly-*`):
- Tiêu đề "Mẫu in hợp đồng", dòng phụ "Mẫu nào dùng khi bấm In ở hợp đồng". Nút "Tạo mẫu in" mở mẫu mới theo bố cục 2.
- Thẻ **"Thông tin trên hợp đồng"** (`ContractInfoCard`):
  - Hiện người đại diện, chức vụ, ngân hàng, số tài khoản, chủ tài khoản. Ô trống ghi "Chưa nhập".
  - Nút "Sửa" (chỉ khi có `org.update`) mở `ContractInfoDialog`. Dialog lưu bằng `updateContractInfo`. Lỗi 409 `PROFILE_REQUIRED` thì hiện liên kết "Hồ sơ thương hiệu".
  - Câu nhỏ: "Logo, tên, địa chỉ, SĐT lấy từ Hồ sơ thương hiệu."
- Nhóm **"Hợp đồng dịch vụ"** (n mẫu) và **"Hợp đồng khoá học"** (chỉ tổ chức ACADEMY). Mỗi dòng (`ListRow`) gồm: ảnh `bo-cuc-N.png`, tên, nhãn "Mặc định", nhãn "bản v{n}", dòng phụ "Bố cục N · {tên bố cục} · đã in {k} hợp đồng". Mẫu dùng cho cả hai loại hiện ở cả hai nhóm.
- Công tắc "Hiện mẫu ngừng dùng".
- Thẻ **"5 bố cục có sẵn"**: 5 ảnh thu nhỏ. Bấm một ảnh thì mở mẫu mới theo bố cục đó.

**Màn sửa** (ảnh `pa1-sua-1440.png`):
- **Đầu màn:** tên mẫu, nhãn "Mặc định · dịch vụ", nhãn "đang là bản v{n}". Hai nút "Huỷ" và "Lưu". Nếu thay đổi chạm vào nội dung in thì nút ghi "Lưu thành bản v{n+1}".
- **Thẻ "Mẫu":**
  - Tên mẫu.
  - "Dùng cho": Segmented Dịch vụ / Khoá học / Cả hai. Hai lựa chọn sau chỉ có ở tổ chức ACADEMY.
  - Công tắc "Mặc định cho hợp đồng dịch vụ" (và khoá học, nếu áp dụng). Công tắc đang bật thì **khoá**, có chú thích "Muốn đổi mặc định: bật ở mẫu khác".
  - Công tắc "Đang dùng". Khoá khi mẫu đang là mặc định.
- **Thẻ "Bố cục":** 5 ảnh, chọn một.
- **Thẻ "Khối hiện trên bản in":** công tắc cho các khối thuộc loại đang chọn (lấy từ `TOGGLE_BLOCKS`, có `label` + `hint`). Nhãn "điền tay" ở `giay-to`. Nhãn "chưa nhập" ở `chuyen-khoan` khi chưa có ngân hàng. Cuối thẻ là 4 khối luôn có, chữ xám "luôn có".
- **Thẻ "Chữ trên bản in":**
  - Tiêu đề (`TextInput`). Để trống = dùng mặc định, ô chờ hiện chữ mặc định.
  - Chữ mở đầu và chữ kết thúc (`Textarea`). Dưới mỗi ô có chip biến. Bấm chip thì chèn biến vào chỗ con trỏ. Chỉ hiện biến dùng được cho `appliesTo`.
  - Lỗi biến hiện ngay dưới ô, kiểm bằng `checkTemplateText` ở web. Lỗi 400 của máy chủ gắn đúng ô.
- **Xem trước:**
  - 1440 và 1024: cột phải, dính khi cuộn.
  - 390: nút "Xem trước" mở Dialog tràn màn.
  - Dữ liệu là `sampleData`, phần studio thay bằng hồ sơ thật (`GET /profile`). Có Segmented "Dịch vụ / Khoá học" khi mẫu dùng cho cả hai, và "Bản dài / ngắn". Dưới vùng xem trước ghi "Khoảng N trang A4".
- Mẫu đã có lần in: hiện dải vàng "Lưu là tạo bản v{n+1}. {k} hợp đồng đã in bằng bản cũ vẫn in lại đúng như cũ; hợp đồng in sau dùng bản mới."
- **Chỉ gửi trường đã đổi** (PATCH một phần). Rời màn khi chưa lưu thì `ConfirmDialog`. Lỗi 409 `DEFAULT_REQUIRED` thì hiện ngay dưới công tắc tương ứng.
- **390:** các thẻ xếp dọc. Thanh dính đáy có "Xem trước" và "Lưu". Không tràn ngang.

### 4.6 Luật in phải giữ — mỗi luật có bài thử ở cột phải

| # | Luật | Nguồn | Bài thử |
|---|---|---|---|
| L1 | Khi có `.hdin-dlg`: ẩn mọi phần tử khác trong `body` (`display: none`, không chỉ làm vô hình). Lớp phủ và hộp thoại về `position: static`, không cắt chiều cao, không cuộn trong. Đầu và chân hộp thoại ẩn | N1, `contracts.css:258-279` | `print-css.test.ts` + PDF (`appVisible`, `fixedAncestor`, `clippingAncestor`) |
| L2 | Không ngắt giữa dòng bảng, điều khoản, chỗ ký, khung tổng, khối hai bên, khối chuyển khoản | N1 + `ban-in.css` (luật print) | `print-css.test.ts` |
| L3 | **Dấu tiếng Việt rơi** (lỗi R&D 1): mọi tiêu đề mục (`h2` mọi bố cục, `.dieu`, `.h`) có `padding-top ≥ 0,8 mm` | báo cáo mục 4, lỗi 1 | `print-css.test.ts` (duyệt từng `layout-N.css`) + PDF (không có mẩu chữ lẻ 1–2 ký tự viết hoa) |
| L4 | **Dòng tổng không lặp** (lỗi R&D 2): `tfoot { display: table-row-group }`; `thead { display: table-header-group }` (đầu bảng lặp là có chủ đích) | lỗi 2 | `print-css.test.ts` + PDF (mẫu 3, bảng 40 dòng: "Tổng cộng" có **đúng 1 lần**) |
| L5 | **Tiêu đề mồ côi** (lỗi R&D 3): `h2::after { content: ""; display: block; height: 14mm; margin-bottom: -14mm }` + `break-after: avoid` + `break-inside: avoid` | lỗi 3 | `print-css.test.ts` + PDF (dòng chữ cuối mỗi trang không phải tiêu đề mục nào) |
| L6 | **Khung viền mẫu 5** (lỗi R&D 4): phần tử `fixed` duy nhất được phép là `.hdin-khung-trang`. Nó rỗng, có `aria-hidden`, chỉ `display: block` khi in. Chân trang dùng hộp lề `@page` | lỗi 4 | PDF: không có khối fixed **chứa chữ**; `.hdin-khung-trang` không có chữ |
| L7 | Mỗi bố cục: `@page hdin-N { size: A4; margin: … }` và `.hdin-gN { page: hdin-N }`. `PAGE_CONTENT_MM` khớp lề | R&D `mau-N.css` | `print-css.test.ts` + PDF (khổ 595 × 842 pt) |
| L8 | `print-color-adjust: exact`. `zoom` xem trước chỉ trong `@media screen`; khi in `zoom: 1` | | `print-css.test.ts` |
| L9 | Phông `font-display: block`. Chỉ bấm In được khi phông và logo đã sẵn sàng | | `PrintDialog.test.tsx` (nút tắt khi chưa sẵn sàng) |
| L10 | Không dùng `dangerouslySetInnerHTML`. Chuỗi đưa vào CSS chân trang đi qua `cssString()` | | `PrintPaper.test.tsx` (tên khách `<b>x</b>` ra **chữ**; mã có `"` và `\` được thoát) + `grep` trong bài thử |

---

## 5. Bài thử bắt buộc, cửa gác, đột biến

### 5.1 Máy chủ

| Tệp | Gói | Ca bắt buộc (mỗi ca nộp số đo "đạt x/y") |
|---|---|---|
| `test/mau-in-database.test.ts` (mới) | G-M1 | Ghi thẳng database, từng dòng ở bảng 2.4 + các chốt còn lại. Default trùng cùng tổ chức bị chặn, khác tổ chức thì được. `blocks` sai kiểu. `layout` 0 và 6. Trigger phiên bản: đổi `layout` không tăng → chặn; giảm phiên bản → chặn; chỉ đổi tên không tăng → được. Nhật ký: UPDATE và DELETE → chặn. Khoá kép: mẫu của tổ chức B gắn vào hợp đồng của A → chặn; `based_on_print_id` của hợp đồng khác → chặn; tự trỏ → chặn; trùng `(contract_id, print_no)` → chặn. Hồ sơ: chỉ `bank_name` → chặn; số tài khoản có khoảng trắng hoặc chữ thường → chặn; chức vụ thiếu tên → chặn. **Đoạn SEED** (đọc giữa `-- SEED BEGIN` và `-- SEED END` trong `migration.sql`) chạy trong transaction, trên tổ chức ACADEMY và INDIVIDUAL tạo thẳng bằng SQL: ra 2 dòng và 1 dòng; chạy lần hai vẫn vậy |
| `test/mau-in-mau.test.ts` (mới) | G-M3 | Tạo tổ chức thì có mẫu: INDIVIDUAL có 1 mẫu (dịch vụ, bố cục 2); ACADEMY có 2 (thêm khoá học, bố cục 1). Tạo, sửa, danh sách. `version` chỉ tăng khi đổi nội dung in; PATCH lặp lại không tăng. Chuyển mặc định: mẫu cũ mất cờ trong cùng transaction. Ba ca 409 `DEFAULT_REQUIRED`. Khoá học ở tổ chức không đào tạo → 400. Khối lạ, khối luôn có → 400. Biến lạ, biến sai loại → 400 đúng ô. **Đua:** 10 lượt, hai PATCH cùng đặt mặc định dịch vụ cho hai mẫu. Đếm riêng từng kết cục (sổ lỗi 18): lỗi khác = 0; sau mỗi lượt có **đúng 1** mặc định |
| `test/thong-tin-hop-dong.test.ts` (mới) | G-M3 | 409 `PROFILE_REQUIRED` khi chưa có hồ sơ. Ba trường ngân hàng phải đủ hoặc trống cả ba. Chuẩn hoá số tài khoản. **`PUT /profile` sau đó giữ nguyên 5 trường.** Trang công khai `/public/...` **không** có 5 trường này. Có ghi nhật ký |
| `test/mau-in-du-lieu.test.ts` (mới) | G-M4 | Hợp đồng dịch vụ có gói + dịch vụ phụ + phí di chuyển + phụ phí + giảm giá + 1 dòng đã huỷ. Kiểm: Σ `lineTotal` dòng in = `money.subtotal` = `contracts.subtotal`; `total` = `subtotal − discount`; dòng huỷ không có mặt; `totalInWords` = `vndInWords(total)`; `paid` = phiếu thu − phiếu hoàn chưa huỷ; tổng `paid` các đợt = min(đã thu, Σ đợt). Nháp: điều khoản là mẫu mới nhất, `snapshot: false`. Đã xác nhận rồi **sửa mẫu điều khoản** → điều khoản vẫn là bản chụp cũ + bản cũ. Hợp đồng khoá học có `course` (lớp, thứ, giờ, giảng viên, cơ sở) và `rules`. Che theo quyền: vai trò chỉ có `contracts.read` → `contactHidden`, `paymentsHidden`, cả hai đúng null. Cảnh báo `NO_PROFILE` ở tổ chức chưa có hồ sơ; có hồ sơ + logo → `logoUrl`. Hai lần GET cùng `dataHash`; thêm một phiếu thu → `dataHash` đổi |
| `test/mau-in-nhat-ky.test.ts` (mới) | G-M4 | TEMPLATE: `printNo` 1, 2, 3. Sai `expectedDataHash` → 409 `DATA_CHANGED`, **0 dòng ghi**. Sai phiên bản → 409 `TEMPLATE_CHANGED`. Mẫu ngừng dùng, mẫu khác loại → 400. Hợp đồng huỷ → 409. **Chống trùng:** gửi lại cùng khoá → cùng phản hồi, 1 dòng; cùng khoá khác thân → 409. PRIOR_CONFIG: sửa mẫu (đổi bố cục) rồi in theo lần trước → `config.layout` = bố cục **cũ**, `templateVersion` = bản cũ. REPRINT cùng người → `data` và `data_hash` giống hệt lần gốc. REPRINT bởi người thiếu `customers.read` → không có SĐT, hash khác. `basedOnPrintId` của hợp đồng khác → 404, **cùng lời** với mã bịa. **Đua:** 10 POST đồng thời cùng hợp đồng → `printNo` 1..10, không trùng, không hở, lỗi khác = 0 |

**Cửa gác** — gói G-M3 cho đường mẫu in, gói G-M4 cho đường in:

`test/gate.ts` (`setupOrg`, thêm vào `ids`):
- `templateId`: mẫu dịch vụ mặc định, đọc qua `GET /print-templates?appliesTo=SERVICE`.
- `courseTemplateId`: mẫu khoá học mặc định.
- `printId`: một lần in TEMPLATE của `contractId`. Đọc `print-data` lấy `dataHash` và phiên bản, rồi POST.

`test/gate-samples.ts`:
- `SAMPLES['PATCH /orgs/:orgId/print-templates/:templateId'] = () => ({ name: 'Đổi tên thử' })`
- `SAMPLES['POST /orgs/:orgId/contracts/:contractId/prints']`: mẫu bất đồng bộ. Đọc `print-data` của **hợp đồng trong đường dẫn** bằng chủ của tổ chức sở hữu hợp đồng đó, giống cách làm của `currentVersion`, rồi gửi `{ source: 'TEMPLATE', templateId, expectedTemplateVersion, expectedDataHash }`.
- `REF_SAMPLES['POST /orgs/:orgId/contracts/:contractId/prints']`: ba mẫu.
  - `TEMPLATE` với `templateId`;
  - `PRIOR_CONFIG` với `basedOnPrintId: o.ids.printId`;
  - `REPRINT` với `basedOnPrintId`.

  Mẫu tự đọc mã băm hiện hành bằng chủ của `self`, để mẫu gốc (refBase) ra 201.
- `REF_SAMPLES['GET /orgs/:orgId/print-templates']`: không có trường `…Id`, không cần.
- `PARTIAL_SAMPLES['PATCH /orgs/:orgId/print-templates/:templateId']`:
  - `full`: `{ name: 'Mẫu đủ', layout: 4, appliesTo: ['SERVICE','COURSE'], blocks: { 'ky-nhay': true, 'giay-to': true }, title: 'TIÊU ĐỀ ĐỦ', openingText: 'Mở đầu {Tên khách}', closingText: 'Kết thúc', defaultFor: ['SERVICE'], isActive: true }`
  - `one`: `{ name: 'Mẫu đổi tên' }`
  - `derived`: `{ version: 'tăng khi đổi nội dung in', usage: 'đếm từ nhật ký in', updatedBy: 'người sửa' }`

**Đột biến** (`test/gate-mutants.test.ts`, đánh số tiếp từ 14):
- **14** — `print-data` tra hợp đồng chỉ theo `id`, quên lọc tổ chức → phép `crossId` đỏ.
- **15** — POST `prints` tra mẫu chỉ theo `templateId` → phép `crossRef` đỏ.
- **16** — POST `prints` báo "lần in thuộc hợp đồng khác" khác với lời "không tìm thấy" → phép `crossRef` đỏ (lộ sự tồn tại).
- **17** — thân PATCH mẫu in có `blocks: Blocks.default({})` → `defineRoute` từ chối khởi động. Thêm ca dựng bằng `.partial()` của thân tạo có `.default()` → phép `partialKeep` đỏ.
- **18** — danh sách mẫu quên lọc tổ chức → phép `leak` đỏ.

**Đột biến cài tay** — thợ chấm cài vào bản tách riêng, không nằm trong kho. Nộp tên bài thử chuyển đỏ:
- (a) bỏ `maskPrintData` → `mau-in-du-lieu` (che theo quyền) đỏ;
- (b) bỏ COALESCE ở `contract_prints_snapshot_shape` → `mau-in-database` (config thiếu layout) đỏ;
- (c) bỏ khoá tư vấn khi cấp `printNo` → bài đua 10 POST đỏ (trùng hoặc lỗi 500);
- (d) quên `version + 1` khi đổi `blocks` → `mau-in-mau` đỏ **và** trigger báo lỗi;
- (e) dựng dữ liệu bằng `JSON.stringify` không sắp khoá → bài "hai GET cùng hash" phải vẫn xanh. Nếu vẫn xanh thì ghi rõ là đột biến này **không bị bắt**. Không được nới bài để giả là bắt được (sổ lỗi 12).

### 5.2 Web

| Tệp | Gói | Ca bắt buộc |
|---|---|---|
| `packages/shared/src/print.test.ts` | G-M2 | Bảng `vndInWords` ở 3.1; `splitClauses`; `checkTemplateText`; `resolvePrintConfig` cho 5 bố cục × 2 loại; `variableValues` khi bị che |
| `paper/rows.test.ts` | G-W2 | Mọi số tiền trên hàng in **đúng bằng** số trong `data` (không cộng lại); thợ chính/phụ; công thức km |
| `paper/PrintPaper.test.tsx` (jsdom) | G-W2 | 5 bố cục × 2 loại dựng được. Tắt từng khối → chữ đặc trưng của khối biến mất (ví dụ "CỘNG HOÀ XÃ HỘI" khi tắt `quoc-hieu`). 4 khối luôn có thì luôn có. `contactHidden` → "……". `paymentsHidden` → không có "Tiến độ thanh toán", không có "Đã thu". Biến được thay. L10 |
| `paper/print-css.test.ts` | G-W2 | Chuyển từ `contracts-print-css.test.ts` + L1–L8 cho `paper.css` và 5 tệp `layout-N.css` |
| `paper/print.pdf.test.ts` | G-W2 | Chromium `page.pdf({ preferCSSPageSize: true, printBackground: true })` trên `__in-thu__`: **5 bố cục × 2 loại × 2 bản = 20 PDF**, cộng mẫu 3 bảng 40 dòng, cộng mỗi bố cục một bản tắt hết khối bật/tắt được. Mỗi PDF kiểm theo `kiem-in-thu.js`: A4; bản ngắn **đúng 1 trang**; bản dài trong khoảng [cần, cần + 1] trang; tiêu đề đúng 1 lần; mỗi điều khoản và nội quy đúng 1 lần; có tổng tiền và tiền bằng chữ (khi bật); không khối fixed chứa chữ; không khối bị cắt; không trang gần trống; không mẩu chữ lẻ; chữ cuối trang không phải tiêu đề mục; màn ứng dụng và đầu/chân hộp thoại ẩn; **mẫu 4 dịch vụ dài = 1 trang** (đúng số đo R&D). Cần Chromium (`/opt/pw-browsers`) và `pdftotext`/`pdfinfo` (`/usr/bin`). Thiếu thì báo đỏ kèm cách cài, **không tự bỏ qua**. Đặt `timeout` đủ cho khoảng 30 lần in |
| `dialog/printDiff.test.ts`, `dialog/defaultChoice.test.ts` | G-W3 | Bảng 4.4 |
| `dialog/PrintDialog.test.tsx` | G-W3 | Thân POST đúng cho từng nguồn. 409 → tải lại, **không** gọi `window.print`. 201 → gọi `window.print` **sau** khi có phản hồi, đúng 1 lần. Nút "Mở lại" không POST. Mất mạng → nút tắt. REPRINT ẩn công tắc nhanh. Phông chưa sẵn sàng → nút tắt |
| `settings/*.test.tsx` | G-W4 | Nhóm theo loại; nhóm khoá học chỉ có ở ACADEMY; nhãn mặc định; không tắt được mặc định; lỗi biến hiện dưới ô; **PATCH chỉ gửi trường đã đổi**; nhãn "Lưu thành bản v{n+1}" chỉ hiện khi đổi nội dung in; thẻ Thông tin trên hợp đồng (quyền `org.update`, 409 `PROFILE_REQUIRED`) |
| `src/api/duong-api.test.ts`, `khop-hop-dong.test.ts` | G-W1 | Đủ 8 đường; khớp kiểu với máy chủ thật |
| `features/contracts/*.test.tsx` | G-W5 | Màn dịch vụ có nút In ở cả 3 khổ; "Lưu nháp & in" gọi lưu trước rồi mới mở hộp; hợp đồng huỷ có nút tắt; thẻ điều khoản ở màn dịch vụ gửi `termsTemplateId`; màn khoá học không còn `ContractPrintDialog` |
| `e2e/mau-in.spec.ts` | G-W6 | Máy chủ thật, theo `e2e/khung.spec.ts`. Ảnh **3 khổ 1440 / 1024 / 390** của: danh sách mẫu, màn sửa, hộp In (dịch vụ và khoá học). Không tràn ngang ở 390. Bấm In (thay `window.print` bằng hàm đếm) → một dòng nhật ký mới, lần in hiện trên hộp |

**Lệnh "xong"** cho mọi gói web (sổ lỗi 1, 13, 19), chạy trên **đúng mã sẽ nộp**: `pnpm --filter @makeup/web typecheck && pnpm --filter @makeup/web test && pnpm --filter @makeup/web build`. Gói máy chủ: `pnpm --filter @makeup/api test` (đã gồm kiểm kiểu) và build. Ghi lệnh + kết quả vào báo cáo.

---

## 6. Gói việc theo tệp

**Luật:** hai gói **không** được chạy song song nếu chung một tệp. Thợ chỉ sửa tệp trong danh sách của gói mình. Thợ không tắt máy chủ bằng `pkill -f` (sổ lỗi 21). Điều phối chỉ `git add` đúng các tệp đã nghiệm thu (sổ lỗi 6, 23).

| Gói | Model | Giờ | Tệp (chỉ các tệp này) | Phụ thuộc |
|---|---|---|---|---|
| **G-H1 Tra cứu đầu ca** | Haiku | 1 | Chỉ đọc. Đối chiếu lại bảng mục 1 (số dòng có thể đã dịch). Liệt kê mọi chỗ nhập `ContractPrint`, `ct-paper`, `ct-print-dlg`, `__in-thu__`. Kiểm bản vẽ D đã đụng tệp nào trong `features/contracts/**`. Gửi bảng cho điều phối, **không ghi tệp** | — |
| **G-M1 Dữ liệu** | **Opus** | 4 | `apps/api/prisma/schema.prisma`; `apps/api/prisma/migrations/20261019170000_mau_in_hop_dong/migration.sql`; `apps/api/test/mau-in-database.test.ts` | H1 |
| **G-M2 Danh mục dùng chung + tiền bằng chữ** | **Opus** | 4 | `packages/shared/src/print.ts`, `packages/shared/src/print.test.ts` (mới); `packages/shared/src/index.ts` (1 dòng); `packages/shared/src/permissions.ts` (nhãn `contracts.texts`) | — (song song M1) |
| **G-M3 Máy chủ mẫu in + thông tin hợp đồng** | **Opus** | 8 | `apps/api/src/modules/print/{schemas,templates,seed,routes}.ts` (mới); `apps/api/src/app.ts`; `apps/api/src/modules/orgs/routes.ts` (gọi seed); `apps/api/src/modules/profile/{routes,schemas}.ts`; `apps/api/test/mau-in-mau.test.ts`, `apps/api/test/thong-tin-hop-dong.test.ts` (mới); `apps/api/test/gate.ts`, `apps/api/test/gate-samples.ts` (phần mẫu in) | M1, M2 |
| **G-M4 Dữ liệu in + nhật ký in** | **Opus** | 10 | `apps/api/src/modules/print/{data,prints}.ts` (mới), `apps/api/src/modules/print/routes.ts`; `apps/api/test/mau-in-du-lieu.test.ts`, `apps/api/test/mau-in-nhat-ky.test.ts` (mới); `apps/api/test/gate.ts`, `apps/api/test/gate-samples.ts`, `apps/api/test/gate-mutants.test.ts` | M3 (nối tiếp, chung `routes.ts` và các tệp gate) |
| **G-W1 Hàm API web** | Sonnet | 3 | `apps/web/src/api/print.ts` (mới); `apps/web/src/api/profile.ts`; `apps/web/src/api/types.ts`; `apps/web/src/api/duong-api.test.ts`; `apps/web/src/api/khop-hop-dong.test.ts` | M4 |
| **G-W2 Bộ vẽ 5 bố cục + luật in + bài PDF** | Sonnet | 14 | `apps/web/src/features/contract-print/paper/**` (mới, gồm `__in-thu__/`); `apps/web/public/fonts/lora/**`, `apps/web/public/mau-in/bo-cuc-{1..5}.png` (mới) | M2 (song song M3, M4) |
| **G-W3 Hộp In + nút In** | Sonnet | 6 | `apps/web/src/features/contract-print/dialog/**` (mới) | W1, W2 |
| **G-W4 Cài đặt › Mẫu in** | Sonnet | 12 | `apps/web/src/features/contract-print/settings/**` (mới); `apps/web/src/features/contract-print/index.tsx` (mới); `apps/web/src/app/routes.tsx`; `apps/web/src/layout/nav.ts` (+ bài nav nếu có) | W1, W2 (song song W3) |
| **G-W5 Gắn vào màn hợp đồng** — **gói DUY NHẤT đụng `features/contracts/**`** | Sonnet | 6 | `apps/web/src/features/contracts/ContractEditor.tsx`, `CourseContractEditor.tsx`, `model.ts`, `model.test.ts`, `ContractEditor.test.tsx`, `CourseContractEditor.test.tsx`, `contracts.css` (xoá luật `.ct-paper*`, `.ct-print-dlg`, `@page hop-dong`); **xoá** `ContractPrint.tsx`, `ContractPrint.pdf.test.ts`, `contracts-print-css.test.ts`, `__in-thu__/` (luật và bài đã chuyển sang `contract-print/paper`, bản mới phải xanh trước khi xoá); `apps/web/src/api/khop-hop-dong.test.ts` (nếu `draftFromDetail` đổi) | W3, **và theo thứ tự với bản vẽ D** (dưới) |
| **G-W6 E2E + ảnh 3 khổ** | Sonnet | 3 | `apps/web/e2e/mau-in.spec.ts` (mới), `apps/web/e2e/anh/mau-in-*.png` | W4, W5 |
| **G-K Chấm độc lập** | **Opus** | 4 | Không sửa kho. Chấm trên bản tách riêng, bộ đọc database riêng (sổ lỗi 17). Cài đột biến 5.1 (a–e) và gỡ từng luật L3, L4, L5 ở 5.2, nộp bài nào chuyển đỏ. Người chấm phải khác người làm (sổ lỗi 7) | tất cả |

**Tổng: 75 giờ ≈ 19 buổi** (buổi = 4 giờ):
- máy chủ + shared 26 giờ;
- web 44 giờ;
- tra cứu và chấm 5 giờ.

Báo cáo chặng 1 ước 17–18 buổi. Bản vẽ này cộng thêm các phần thiết kế mới:
- in theo cấu hình đã chụp;
- công tắc nhanh lúc in;
- thẻ "Thông tin trên hợp đồng";
- bộ thử bảng dài;
- buổi chấm độc lập.

Chưa tính buổi anh thử in trên máy thật.

**Thứ tự** (đường găng ≈ 44 giờ ≈ 11 buổi lịch nếu có 2–3 thợ chạy song song):

```
H1 ─┬─ M1 ──┐
    └─ M2 ──┼─ M3 ── M4 ── W1 ─┬─ W3 ─┐
            └─ W2 (14h) ───────┴─ W4 ─┼─ W5* ── W6 ── K
                                       │
* W5 chờ thêm cổng "bản vẽ D" ─────────┘
```

**Phối hợp với bản vẽ D (màn lập hợp đồng):**
1. Chỉ **G-W5** đụng `apps/web/src/features/contracts/**`. Các gói G khác nằm trong `features/contract-print/**`, `src/api/print.ts`, `apps/api/src/modules/print/**`. Mọi gói G trừ W5 chạy được **cùng lúc** với gói màn hình của D.
2. Đề xuất thứ tự: **gói màn lập hợp đồng của D đi trước và được nghiệm thu, rồi mới đến G-W5.** G-W5 nhỏ (6 giờ) và được thiết kế để gắn vào ít chỗ nhất: một component `PrintButton` tự tải dữ liệu, ba chỗ đặt nút, thêm `termsTemplateId` vào model dịch vụ. Nếu D chưa khởi công lúc W3 xong thì W5 được đi trước, và D làm trên bản đã có nút In. Tuyệt đối **không** để hai gói chạy cùng lúc.
3. Các tệp nóng khác, có thể chung với gói máy chủ hoặc web của D. Điều phối khoá theo tệp:
   - `apps/api/prisma/schema.prisma` và thư mục migrations (M1). Migration của D phải mang mốc **sau** `20261019170000` nếu tạo sau.
   - `apps/api/src/app.ts` (M3).
   - `apps/api/test/gate.ts`, `gate-samples.ts`, `gate-mutants.test.ts` (M3 → M4).
   - `packages/shared/src/index.ts` (M2).
   - `apps/web/src/api/types.ts`, `duong-api.test.ts`, `khop-hop-dong.test.ts` (W1, W5).
   - `apps/web/src/app/routes.tsx`, `apps/web/src/layout/nav.ts` (W4).
4. Nếu D đổi khuôn dữ liệu hợp đồng (trường mới cần in, ví dụ "lý do giảm") thì thêm vào `ContractPrintData` ở **phiên bản 2**, tăng `PRINT_DATA_VERSION`. Bản chụp cũ (v1) vẫn vẽ được: bộ vẽ đọc `data.version`.

---

## 7. Cái không làm (đợt này)

- PA2 (đổi thứ tự khối, cài đặt từng khối) và PA3 (văn bản tự do, nhập tệp Word). Ô `blocks` dạng JSON đã đủ để nâng lên PA2 mà không đổi bảng.
- Máy chủ tạo PDF, hoặc lưu tệp PDF đã in. Thay bằng bản chụp cấu hình + dữ liệu (mục 2.5).
- Mã QR chuyển khoản (VietQR). Cần mã BIN ngân hàng và danh sách ngân hàng.
- Lưu CCCD và địa chỉ khách (chờ duyệt, mục 2.6). Mã số thuế studio.
- Chia trang trong xem trước. Chỉ ước số trang; số trang chính xác xem ở hộp in của máy.
- Nút "Tải PDF" riêng. Gộp vào "In / Lưu PDF", vì trình duyệt lưu PDF ngay trong hộp in.
- In hợp đồng đã huỷ, in hàng loạt, khổ A5 / K80.
- Màn lịch sử phiên bản mẫu và khôi phục bản cũ. Bản cũ chỉ sống trong nhật ký in.
- Xoá mẫu in (chỉ ngừng dùng).
- Màn "Mẫu điều khoản" trong Cài đặt. Vẫn là hộp "Quản lý mẫu" ở màn hợp đồng.
- Sửa màn Hồ sơ thương hiệu (`features/brand/**`). Ô người đại diện và ngân hàng nằm ở màn Mẫu in.
- Nhãn "Đã in" trong danh sách hợp đồng.

## 8. Câu hỏi còn mở cho anh

1. **CCCD + địa chỉ khách:** có cho lưu không? Đây là dữ liệu cá nhân. Đề xuất: chỉ người xem được SĐT khách mới xem được. Khi chưa có, bản in để dòng chấm để điền tay.
2. **Mã QR chuyển khoản** trên bản in: có cần không? Nếu có, anh chọn ngân hàng từ danh sách.
3. **Quốc hiệu cho hợp đồng dịch vụ:** mẫu 2 tắt sẵn. Anh muốn bật sẵn không?
4. Bản **nháp** in ra ghi "BẢN NHÁP" ở cạnh số hợp đồng và chân trang. Giữ như vậy được không?
5. Đóng gói phông **Lora + Cormorant** (miễn phí, giấy phép OFL) cho mẫu 1 và mẫu 5: đồng ý không?
6. Cần **một iPhone và một máy Android** của studio, khoảng 1 buổi, để in thử thật. Kiểm số trang, ô ký nháy, khung viền, và in từ app đã thêm ra màn hình chính.
7. Ảnh màn mẫu in của **ssnew**: vẫn chưa có.
8. Tiền bằng chữ đọc "**linh**" ("hai triệu không trăm linh năm nghìn") hay "**lẻ**"? Mặc định là "linh".
