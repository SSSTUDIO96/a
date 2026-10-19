# Bản vẽ F: Giấy chứng nhận (chặng 2)

- Sản phẩm: Makeup Pro
- Ngày: 19/10/2026
- Người làm: Trung tâm R&D, chặng 2. Đây là bản vẽ thông số cho thợ, không còn là bày phương án.
- Quyết định gốc: docs/NHAT-KY-QUYET-DINH-THAY.md, dòng "19/10 chiều", mục Chứng chỉ (R&D-08). Trợ lý chọn thay anh Chiến, anh bác lúc nào cũng được.
- Đi kèm, bản vẽ này không chép lại:
  - /home/user/a/docs/rnd/BAO-CAO-RND-08-CHUNG-CHI.md: khảo sát, 3 phương án, đo tương phản.
  - /home/user/a/docs/rnd/v8-mau-chung-chi/cc-01.html … cc-10.html: 10 mẫu gốc của R&D.
  - /home/user/a/docs/rnd/v8-cap-chung-chi-A.html: bản mẫu luồng A, bấm thử được. Mở `#a-cap`, `#a-so`, `#a-m-ds`.
  - Ảnh: /home/user/a/docs/rnd/anh-rnd08/luong-a-*.png.

**Điều đã chốt (không bàn lại trong bản vẽ):**
- Luồng A: thẻ lớp đã kết thúc có nút "Cấp chứng nhận". Bấm vào ra danh sách cả lớp, tích sẵn hết. Chọn mẫu, xem trước từng người, rồi bấm "Cấp và in".
- Có "Sổ giấy chứng nhận" để in lại, cấp lại (khi sai tên), thu hồi.
- Hồ sơ học viên có nút "In lại".
- Đủ 10 mẫu, mã cc-01 … cc-10. Tiêu đề mọi mẫu là **"Giấy chứng nhận"**.
- Mẫu nào cũng có ảnh tròn. Học viên chưa có ảnh thì in chữ cái đầu.
- Số đánh theo năm, ví dụ CC-2026-0007. Cấp lại **giữ số cũ** và ghi thêm "bản cấp lại".
- Người cấp: chủ và quản lý. Quyền mới `certificates.issue` và `certificates.read`.
- Chỉ cấp khi lớp đã kết thúc. Học viên còn nợ học phí thì **cảnh báo, không chặn**.
- Không in sẵn chữ ký hay con dấu. Chưa làm xếp loại, chưa làm mã QR.
- In trên điện thoại: điện thoại tự làm tệp PDF (mỗi người một trang A4 ngang), rồi mở bảng Chia sẻ (In / Zalo / Lưu).

**Việc mới từ anh Chiến (điều phối chuyển 19/10):** nền và khung trang trí (R&D-07) phải áp được cho cả giấy chứng nhận. Bản vẽ này **chỉ chừa chỗ**:
- Bảng Certificate có sẵn cột kiểu nền và ảnh nền lúc cấp (mục 2.2).
- Trường nền của tổ chức chỉ ghi ở mục đề xuất, đánh dấu **chờ bản vẽ nền** (mục 2.6).
- Bản vẽ này **không** thiết kế bộ nền. Bộ nền có bản vẽ riêng sau khi R&D-07 xong vòng 2.

**Đọc theo thứ tự:**
- Mục 1: mã hiện có (đường dẫn kèm số dòng).
- Mục 2–4: database, danh mục dùng chung, máy chủ. Thợ máy chủ khởi công từ đây.
- Mục 5: 10 mẫu vào app.
- Mục 6–7: màn web, cách in và làm PDF.
- Mục 8: thư viện của người khác.
- Mục 9: bài thử.
- Mục 10: gói việc.
- Mục 11–12: cái không làm, câu hỏi còn mở.

**Quy ước (giống các bản vẽ C, C2, C3):**
- Mọi bảng có `organization_id`.
- Mọi khoá ngoại sang bảng của tổ chức là khoá kép `(id, organization_id)`.
- Mọi thay đổi ghi `writeAudit` trong cùng transaction.
- Ngày dạng `YYYY-MM-DD`. "Hôm nay" luôn tính theo múi giờ của tổ chức (`Organization.timezone`).
- Từ ngữ trên màn: luôn viết **"giấy chứng nhận"**, không viết "chứng chỉ". Mã kỹ thuật (bảng, quyền, đường API) giữ chữ `certificate`.

---

## 1. Mã hiện có đã tra (đường_dẫn:dòng)

Số dòng đọc lúc 19/10/2026, khoảng 04:00 giờ máy. `apps/api/prisma/schema.prisma` đang có thợ khác sửa: trong lúc tra, số dòng đã lệch 3 (thêm `password_changed_at`). Thợ tra lại theo **tên** model hoặc tên hàm, đừng tin số dòng cứng.

### 1.1 Khoá, lớp, ghi danh

| Cái gì | Ở đâu | Điều rút ra cho bản vẽ |
|---|---|---|
| `Course`: tên khoá, `mode` | apps/api/prisma/schema.prisma:1152-1184 | Lấy `name` chụp vào giấy |
| `CourseClass`: `endDate` | schema.prisma:1192 (`@db.Date`) | Điều kiện "đã kết thúc" = `endDate <= hôm nay` |
| `CourseClass.status` | schema.prisma:1200; enum `CourseClassStatus` :1120 (OPEN, CLOSED, CANCELLED) | **Không có** trạng thái "đã kết thúc", phải suy ra từ ngày. Lớp CANCELLED không được cấp |
| `CourseClass.instructorMembershipId` | schema.prisma:1201 | Lấy tên giảng viên cho chỗ ký 1 |
| `Enrollment` | schema.prisma:1226-1254; `customerId` :1233; `@@unique([id, organizationId])` | Chứng nhận gắn với **một lần ghi danh**. Chỉ ghi danh ACTIVE mới hiện trong danh sách cấp |
| Ghi danh chỉ bị đổi trạng thái, không đổi lớp hay khách | apps/api/src/modules/contracts/enroll.ts:169 (chỗ duy nhất `enrollment.update`) | Khoá ngoại sang ghi danh dùng `ON UPDATE RESTRICT` được, không vướng mã đang chạy |
| Một học viên một ghi danh còn hiệu lực mỗi lớp | migrations/20261018230000_dao_tao/migration.sql:446 (`enrollments_one_active`, chỉ mục duy nhất **một phần**, viết tay) | Tiền lệ chỉ mục một phần viết tay ngoài Prisma |
| Khoá dòng lớp | apps/api/src/modules/courses/service.ts:99-104 (`lockClass`, `SELECT … FOR UPDATE` theo id + tổ chức) | Cấp hàng loạt khoá dòng lớp trước để xếp hàng |
| Chặn tổ chức chưa bật đào tạo | courses/service.ts:83-88 (`assertAcademy` → 403 `ACADEMY_REQUIRED`) | Mọi đường giấy chứng nhận gọi hàm này đầu tiên |
| "Hôm nay" theo múi giờ tổ chức | apps/api/src/modules/courses/present.ts:22-24 (`todayIn`); `dateToWire` :13; `dateFromWire` :9 | Dùng lại, không viết hàm mới |
| Tên giảng viên | present.ts:104 (`classSelect.instructor`), :153-155 (`displayName ?? user.fullName`) | Chụp đúng cách hiển thị này |
| Hình mẫu đường API của lớp | apps/api/src/modules/courses/routes.ts:272-284 (`GET /classes/:classId/enrollments`) | Đường cấp đặt cạnh, cùng kiểu `/classes/:classId/...` |

### 1.2 Hợp đồng khoá học và tiền đã thu (để cảnh báo nợ)

| Cái gì | Ở đâu | Điều rút ra |
|---|---|---|
| `Contract.total`, `status` | schema.prisma:684, :688 | Nợ = `total − đã thu`, tính theo hợp đồng của ghi danh |
| `Payment`: `kind` RECEIPT/REFUND, `voidedAt` | schema.prisma:984-1010 (:989, :994) | Đã thu = Σ RECEIPT − Σ REFUND của phiếu chưa huỷ |
| Cách tính "đã thu" đang chạy | courses/service.ts:280-329 (`listEnrollments`): `groupBy` :298-308; ai được thấy tiền :296-297 | **Chép đúng luật**: chỉ ai có `contracts.read` hoặc `payments.read` mới thấy số tiền (biên bản lát 2, N5) |
| Tiến độ thu (đợt) | schema.prisma:950 (`PaymentInstallment`) | Không dùng: cảnh báo nợ chỉ theo tổng, không theo đợt |

### 1.3 Mẫu thiết kế, xuất ảnh

| Cái gì | Ở đâu | Điều rút ra |
|---|---|---|
| `DesignCard` + `snapshot Json` | schema.prisma:1320-1360 (`snapshot` :1340) | Giấy chứng nhận **không** là DesignCard: có số, thu hồi, cấp lại. Làm bảng riêng, chụp chữ bằng cột thật để tìm được trong sổ |
| Danh mục mẫu | packages/shared/src/design-templates.ts: `DesignKind` :6, `SLOT_SOURCES` :23-48, `DESIGN_SIZES` :55, `FONT_OVERRIDES` :58, `DesignTemplate` :66-83, `tpl()` :99-111 (khổ đang viết cứng `BOTH_SIZES` :110), `DESIGN_TEMPLATES` :123, `findDesignTemplate` :194 | Thêm loại `CERTIFICATE` và khổ `1754x1240`. **Thợ K3 đang sửa tệp này** |
| Nhãn loại thẻ dạng `Record<DesignKind, …>` | apps/api/src/modules/designs/data.ts:39; apps/web/src/features/designs/model.ts:28 | Thêm loại mới thì hai chỗ này phải thêm nhãn, nếu không kiểm tra kiểu đỏ |
| Loại thẻ máy chủ nhận khi tạo thẻ | apps/api/src/modules/designs/schemas.ts:6 (`DESIGN_CARD_KINDS` riêng, 3 loại) | Không đổi. Không tạo được DesignCard loại chứng nhận |
| Tab Mẫu thiết kế | web designs/model.ts:22-26 (`KIND_TABS`) | Không thêm tab: R&D-08 bỏ luồng B |
| Bộ vẽ PNG | apps/web/src/features/designs/exportPng.ts:23-57 (`renderTemplatePng`: iframe ngoài màn hình, gọi `window.MAU_XUAT_PNG()`, kiểm đúng kích thước); `downloadBlob` :60-70 | **Dùng lại nguyên hàm**, không chép |
| Bộ xuất trong tệp mẫu | apps/web/public/mau/chung/xuat.js (`MAU_XUAT_PNG`, html-to-image 1.11.13, giấy phép MIT ở chung/LICENSE-html-to-image.txt) | Mẫu chứng nhận có bộ xuất riêng `cc-xuat.js`, vì khung 1123×794 phải phóng lên 1754×1240 |
| Chế độ dữ liệu thật | apps/web/public/mau/chung/mau.js:1-16 (`?that=1`: ô thiếu để trống, không lấy chữ mẫu) | `cc.js` của app theo đúng luật này |
| Ảnh ký URL → blob cùng nguồn | apps/web/src/features/designs/useBlobUrl.ts:7-35 | html-to-image chỉ nhúng được ảnh cùng nguồn. Bản in làm y như vậy |
| Khung xem trước | web designs/PreviewFrame.tsx (iframe giữ px thật, thu nhỏ bằng transform) | Xem trước chứng nhận dùng cách này với khung 1123×794 |
| Phông | apps/web/public/mau/phong/phong.css (đủ 4 phông chữ ký và 3 phông chữ in, OFL 1.1) | **Không thêm tệp phông.** Riêng `--ky-co-2`: R&D-08 dùng 1.12, app đang để 1.05. Đặt lại trong `cc.css`, phạm vi `.cc`, không sửa phong.css |
| 10 mẫu gốc | docs/rnd/v8-mau-chung-chi/cc-NN.html, chung/cc.js (171 dòng), chung/cc.css (45 dòng) | Mẫu gốc in "CHỨNG CHỈ / Hoàn thành khoá học", "CHỨNG NHẬN / Tốt nghiệp", "Số chứng chỉ". **Phải đổi** (mục 5.3). Tham số `ngay` của R&D trùng nghĩa với ô `ngay` (ngày khai giảng) của danh mục, nên đổi tên thành `ncap` |

### 1.4 Hồ sơ thương hiệu (tên Giám đốc)

| Cái gì | Ở đâu | Điều rút ra |
|---|---|---|
| `OrganizationProfile` | schema.prisma:1075-1111; `brandName` bắt buộc; `logoFileId` :1091 | Thêm `cert_signer_name`, `cert_signer_title` |
| PUT ghi toàn bộ hồ sơ | apps/api/src/modules/profile/routes.ts:80-114; `toData` :13-37 liệt kê **từng trường** | Cột mới không bị PUT xoá, vì `toData` không nhắc tới |
| GET hồ sơ trả **mọi cột** (`...rest`) | profile/routes.ts:44-58 (`presentProfile`) | Thêm cột mà không bỏ ra thì bài "khớp hai đầu" của web đỏ ("thừa trường", apps/web/src/api/khop-kieu.ts:261; kiểu `BrandProfile` ở apps/web/src/api/types.ts:1310). **Phải bỏ hai cột này khỏi `presentProfile`** |
| Thân PUT là `strictObject` | profile/schemas.ts:81-109 | Không thêm hai trường vào thân PUT. Dùng đường riêng (mục 4.8) |
| Trang công khai liệt kê từng trường | profile/public.ts:117-141 | Không lộ tên Giám đốc ra web công khai. Không cần sửa |
| Ký URL ảnh | apps/api/src/modules/profile/images.ts:46-66 (`signImages`: chỉ tệp READY, chưa xoá, đúng tổ chức) | Dùng lại cho ảnh học viên, logo, ảnh nền |
| Xoá tệp là xoá mềm | apps/api/src/modules/files/routes.ts:98-124 | Khoá ngoại sang tệp không vướng xoá. Tệp đã xoá thì in ra chữ cái đầu hoặc bỏ logo |
| Ảnh học viên | schema.prisma:397 (`Customer.avatarFileId`) | Chụp mã tệp lúc cấp |

### 1.5 Quyền, vai trò, nhật ký

| Cái gì | Ở đâu | Điều rút ra |
|---|---|---|
| Danh mục quyền | packages/shared/src/permissions.ts:3-39 | Thêm 2 quyền |
| Vai trò mẫu | permissions.ts:61-107: owner/admin = mọi quyền :62-63, manager :64-74, receptionist :83-91, instructor :102-105 | Chủ, Quản trị tự có. Quản lý thêm cả hai quyền. Lễ tân và Giảng viên thêm `certificates.read` |
| Đồng bộ vai trò cho tổ chức cũ | apps/api/src/scripts/sync-system-roles.ts:15-77, chạy bằng `pnpm --filter @makeup/api db:sync-roles` (apps/api/package.json) | **Không sửa mã.** Lệnh tự chép quyền mới vào tổ chức cũ. Sau triển khai phải chạy (sổ lỗi 3) |
| Bài thử vai trò | apps/api/test/system-roles.test.ts (khớp N/9); packages/shared/src/permissions.test.ts:17-27 (bảng "ai giữ quyền nào") | Thêm dòng cho 2 quyền mới vào permissions.test.ts |
| Nhật ký | apps/api/src/lib/audit.ts:14-16 (`writeAudit(tx, …)`); `AuditLog` schema.prisma:226 | Ghi trong cùng transaction |
| Khai đường | apps/api/src/http/route.ts:90-144: đường tổ chức bắt buộc khai quyền; `idempotent` chỉ cho POST :113 | |
| Chống gửi trùng | apps/api/src/app.ts:146-149, `runIdempotent` :274 | Cấp hàng loạt và cấp lại khai `idempotent: true` |
| Đăng ký đường | app.ts:32-44 | Thêm `...certificateRoutes` |
| Bảng lỗi | apps/api/src/lib/errors.ts:1-21 | Dùng 400 / 403 / 404 / 409 có sẵn |
| Bộ đếm số tự tăng | `OrgCounter` schema.prisma:530; mẫu câu lệnh: courses/service.ts:168-183, contracts/routes.ts:72-84 (`INSERT … ON CONFLICT … DO UPDATE … RETURNING`, khoá dòng bộ đếm) | Số giấy chứng nhận dùng đúng câu này, khoá đếm `certificate:<năm>` |

### 1.6 Cửa gác và bài thử máy chủ

| Cái gì | Ở đâu | Điều rút ra |
|---|---|---|
| 10 phép của cửa gác | apps/api/test/gate.ts:47-50 | Đường mới tự vào diện kiểm |
| Dữ liệu dựng sẵn cho cửa gác | gate.ts:240-266 (khoá, lớp **năm 2027**, tức là chưa kết thúc), :277-282 (hợp đồng khoá học **nháp**, nên chưa có ghi danh), :296-337 (`ids`) | Phải thêm lớp đã kết thúc, hợp đồng đã xác nhận, 2 ghi danh, 1 giấy chứng nhận |
| Thiếu giá trị tham số thì cửa gác đỏ | gate.ts:351-357 | Thêm `certificateId` vào `ids` |
| Phép GIỮ: POST thân rỗng phải ra **400** | gate.ts:540-548 | Thân rỗng phải trượt ở bước kiểm zod, trước mọi kiểm nghiệp vụ |
| Mẫu thân, mẫu tham chiếu chéo | apps/api/test/gate-samples.ts: `SAMPLES` :7-61, `REF_SAMPLES` :70-, phần thẻ :213-226, `REF_VARIANTS` (`onCourseContract`) :240-246, `PARTIAL_SAMPLES` :252 | Thêm mẫu cho đường mới, có biến thể "lớp đã kết thúc" |
| Đột biến | apps/api/test/gate-mutants.test.ts (đột biến 1–14; mẫu thay handler ở :247-262) | Thêm đột biến 15–17 |

### 1.7 Bản in hiện có (bài học chồng trang)

| Cái gì | Ở đâu | Điều rút ra |
|---|---|---|
| CSS in hợp đồng | apps/web/src/features/contracts/contracts.css:249-279 | Nội dung in nằm trong lớp phủ `position: fixed` thì Chrome lặp nó ở mọi trang, gây chồng chữ, in thừa bản. Cách chữa: ẩn hẳn mọi thứ khác (`display: none`), đưa phần in về dòng chảy thường, không cắt, không fixed. **Giấy chứng nhận: vùng in gắn thẳng vào `body` qua portal, không bao giờ nằm trong hộp thoại** |
| Nút in | apps/web/src/features/contracts/ContractPrint.tsx:164-165 (`window.print()`) | Máy tính dùng hộp in. Điện thoại dùng PDF + Chia sẻ |
| Bài in thật bằng Chromium | apps/web/src/features/contracts/ContractPrint.pdf.test.ts (trang thử `__in-thu__/`, Vite + Playwright, Chromium ở `/opt/pw-browsers`, thiếu trình duyệt thì **đỏ**, không tự bỏ qua) | Bài đếm trang của giấy chứng nhận dựng y như vậy |
| Cửa gác nhanh luật in | apps/web/src/features/contracts/contracts-print-css.test.ts | Làm một tệp tương tự cho certificates.css |

### 1.8 Web: thẻ lớp, hồ sơ học viên, điều hướng

| Cái gì | Ở đâu |
|---|---|
| Thẻ lớp, khung nút | apps/web/src/features/courses/ClassCard.tsx: props :17-27, nút :83-120, `OffButton` (nút xám kèm lý do) |
| Nơi dựng thẻ lớp | apps/web/src/features/courses/CourseDetail.tsx:76-83 (khoá một lớp), :130-138 (nhiều lớp), :148-158 (lớp đã huỷ) |
| Quyền màn khoá học | apps/web/src/features/courses/logic.ts:26-48 (`CoursePerms`, `coursePerms`) |
| Hồ sơ khách / học viên | apps/web/src/features/customers/CustomerDetail.tsx:62-98 |
| Đường màn | apps/web/src/app/routes.tsx:94-97 (`dao-tao/*` dùng `params['*']` làm mã khoá, nên **không** nhét sổ vào dưới `dao-tao/`) |
| Mục điều hướng | apps/web/src/layout/nav.ts:97-98; bài kiểm thứ tự mục ở apps/web/src/layout/AppShell.test.tsx:427 |
| Hộp thoại | apps/web/src/ui/Dialog.tsx:9-31 (chỉ có `size` lg / sm) |
| "Hôm nay" theo múi giờ ở web | apps/web/src/features/customers/logic.ts:186 (mẫu `Intl.DateTimeFormat('en-CA', { timeZone })`) |

---

## 2. Dữ liệu

### 2.1 Nguyên tắc

- **Mỗi bản giấy chứng nhận là một dòng.** Cấp lại thì thu hồi dòng cũ và thêm dòng mới **cùng số**, với `reissue_no` tăng 1. Sổ thấy đủ lịch sử.
- **Chụp chữ bằng cột thật, không dùng Json:** tên học viên, khoá, lớp, giảng viên, người ký, tên trung tâm, ngày cấp. Lý do: sổ tìm theo tên được, CHECK kiểm được, in lại ra đúng như lúc cấp dù sau này đổi tên khoá hay tên người.
- **Chụp cả mã tệp** ảnh học viên, logo, ảnh nền lúc cấp. Khoá ngoại kép sang `stored_files`. Tệp bị xoá mềm thì khi in ảnh rơi về chữ cái đầu, logo bỏ trống.
- **Số:** `year` = năm của **ngày cấp**. `seq` lấy từ `org_counters`, khoá đếm `certificate:<year>`. Mã `CC-<year>-<seq 4 chữ số>`. Từ số 10000 trở đi thì in đủ chữ số, không cắt.
- **Không xoá, chỉ thu hồi.** Dòng đã cấp chỉ được chuyển sang REVOKED. Mọi cột khác đóng băng.
- **Một ghi danh tối đa một bản còn hiệu lực** (chỉ mục duy nhất một phần).
- **Một số chỉ có tối đa một bản còn hiệu lực.** Số đã thu hồi mà không cấp lại thì bỏ, không dùng cho người khác.

### 2.2 Prisma: bảng mới

```prisma
// ==================== GIẤY CHỨNG NHẬN (chỉ tổ chức ACADEMY — máy chủ chặn tổ chức khác) ====================

enum CertificateStatus {
  ISSUED
  // Đã thu hồi (sai tên → cấp lại; hoặc cấp nhầm). Dòng giữ nguyên trong sổ, không xoá.
  REVOKED
}

// Một bản giấy chứng nhận. Chữ in trên giấy CHỤP lúc cấp (cột *_name) — in lại ra y như cũ.
// Cấp lại: bản cũ → REVOKED, bản mới cùng (year, seq), reissue_no + 1, replaces_id = bản cũ.
// Chỉ mục duy nhất MỘT PHẦN và trigger viết tay trong migration 20261019150000_giay_chung_nhan (Prisma không tả được).
model Certificate {
  id               String            @id @default(uuid()) @db.Uuid
  organizationId   String            @map("organization_id") @db.Uuid
  enrollmentId     String            @map("enrollment_id") @db.Uuid
  // Chép từ ghi danh để lọc sổ theo lớp / học viên; khoá ngoại kép 4 cột bảo đảm khớp ghi danh.
  courseClassId    String            @map("course_class_id") @db.Uuid
  customerId       String            @map("customer_id") @db.Uuid
  // Số: năm của ngày cấp + số thứ tự trong năm theo tổ chức (org_counters 'certificate:<năm>').
  year             Int
  seq              Int
  // 0 = bản gốc; 1, 2… = bản cấp lại lần thứ mấy.
  reissueNo        Int               @default(0) @map("reissue_no")
  // "CC-2026-0007" (CHECK khớp year + seq).
  code             String
  issuedOn         DateTime          @map("issued_on") @db.Date
  // Ngày cấp lại (chỉ bản cấp lại) — in "bản cấp lại dd/mm/yyyy".
  reissuedOn       DateTime?         @map("reissued_on") @db.Date
  // Mẫu lúc cấp: cc-01..cc-10 + phiên bản bố cục.
  templateCode     String            @map("template_code")
  templateVersion  Int               @map("template_version")
  // "ky-1".."ky-4" hoặc null = phông theo mẫu.
  fontOverride     String?           @map("font_override")
  // CHỜ BẢN VẼ NỀN (R&D-07): kiểu nền / khung / ảnh nền LÚC CẤP. Đợt này máy chủ luôn ghi null.
  backgroundStyle  String?           @map("background_style")
  backgroundFileId String?           @map("background_file_id") @db.Uuid
  frameStyle       String?           @map("frame_style")
  // Bản chụp chữ lúc cấp.
  studentName      String            @map("student_name")
  courseName       String            @map("course_name")
  className        String            @map("class_name")
  instructorName   String?           @map("instructor_name")
  signerName       String?           @map("signer_name")
  signerTitle      String?           @map("signer_title")
  brandName        String            @map("brand_name")
  // Ảnh học viên / logo LÚC CẤP (tệp đã xoá mềm → in chữ cái đầu / bỏ logo).
  photoFileId      String?           @map("photo_file_id") @db.Uuid
  logoFileId       String?           @map("logo_file_id") @db.Uuid
  status           CertificateStatus @default(ISSUED)
  revokedAt        DateTime?         @map("revoked_at") @db.Timestamptz(3)
  revokeReason     String?           @map("revoke_reason")
  revokedById      String?           @map("revoked_by_id") @db.Uuid
  replacesId       String?           @map("replaces_id") @db.Uuid
  issuedById       String            @map("issued_by_id") @db.Uuid
  createdAt        DateTime          @default(now()) @map("created_at") @db.Timestamptz(3)

  organization   Organization  @relation(fields: [organizationId], references: [id], onDelete: Restrict, map: "certificates_org_fkey")
  // Khoá kép 4 cột: ghi danh thuộc CHÍNH tổ chức, CHÍNH lớp, CHÍNH khách đã chép. Ghi danh không được đổi lớp/khách.
  enrollment     Enrollment    @relation(fields: [enrollmentId, organizationId, courseClassId, customerId], references: [id, organizationId, courseClassId, customerId], onDelete: Restrict, onUpdate: Restrict, map: "certificates_enrollment_fkey")
  courseClass    CourseClass   @relation(fields: [courseClassId, organizationId], references: [id, organizationId], onDelete: Restrict, map: "certificates_class_fkey")
  customer       Customer      @relation(fields: [customerId, organizationId], references: [id, organizationId], onDelete: Restrict, map: "certificates_customer_fkey")
  photoFile      StoredFile?   @relation("CertificatePhoto", fields: [photoFileId, organizationId], references: [id, organizationId], onDelete: Restrict, map: "certificates_photo_fkey")
  logoFile       StoredFile?   @relation("CertificateLogo", fields: [logoFileId, organizationId], references: [id, organizationId], onDelete: Restrict, map: "certificates_logo_fkey")
  backgroundFile StoredFile?   @relation("CertificateBackground", fields: [backgroundFileId, organizationId], references: [id, organizationId], onDelete: Restrict, map: "certificates_background_fkey")
  // Bản cấp lại trỏ bản cũ CÙNG tổ chức, CÙNG ghi danh, CÙNG số.
  replaces       Certificate?  @relation("CertificateReissue", fields: [replacesId, organizationId, enrollmentId, year, seq], references: [id, organizationId, enrollmentId, year, seq], onDelete: Restrict, onUpdate: Restrict, map: "certificates_replaces_fkey")
  replacedBy     Certificate[] @relation("CertificateReissue")
  issuedBy       User          @relation("CertificateIssuedBy", fields: [issuedById], references: [id], onDelete: Restrict, map: "certificates_issued_by_fkey")
  revokedBy      User?         @relation("CertificateRevokedBy", fields: [revokedById], references: [id], onDelete: Restrict, map: "certificates_revoked_by_fkey")

  @@unique([id, organizationId], map: "certificates_id_org_key")
  // Đích của khoá ngoại "cấp lại" (replaces).
  @@unique([id, organizationId, enrollmentId, year, seq], map: "certificates_reissue_target_key")
  // Một số + một lần cấp lại = một dòng (số không dùng lại cho người khác: bản mới luôn reissue_no = 0).
  @@unique([organizationId, year, seq, reissueNo], map: "certificates_number_key")
  @@index([organizationId, courseClassId], map: "certificates_org_class_idx")
  @@index([organizationId, customerId], map: "certificates_org_customer_idx")
  @@index([organizationId, year, seq], map: "certificates_org_number_idx")
  @@map("certificates")
}
```

Tên ràng buộc đặt tay bằng `map:`. Tên tự sinh của Prisma cho khoá 4 cột dài quá 63 ký tự, mà Postgres sẽ cắt.

### 2.3 Prisma: sửa model đang có

```prisma
model OrganizationProfile {
  // … giữ nguyên các trường cũ …
  // Người ký thứ hai trên giấy chứng nhận (chỗ ký 2). Không lộ ra trang công khai, không trả trong GET /profile.
  certSignerName     String?   @map("cert_signer_name")
  // Trống = "Giám đốc trung tâm" (DEFAULT_SIGNER_TITLE ở packages/shared).
  certSignerTitle    String?   @map("cert_signer_title")
}

model Enrollment {
  // … giữ nguyên …
  certificates Certificate[]
  // Đích khoá ngoại 4 cột của certificates (id là khoá chính nên luôn duy nhất).
  @@unique([id, organizationId, courseClassId, customerId], map: "enrollments_cert_target_key")
}
```

Quan hệ ngược, mỗi dòng một trường:

| Model | Thêm |
|---|---|
| `Organization` | `certificates Certificate[]` |
| `CourseClass` | `certificates Certificate[]` |
| `Customer` | `certificates Certificate[]` |
| `User` | `certificatesIssued Certificate[] @relation("CertificateIssuedBy")`<br>`certificatesRevoked Certificate[] @relation("CertificateRevokedBy")` |
| `StoredFile` | `certificatePhotos Certificate[] @relation("CertificatePhoto")`<br>`certificateLogos Certificate[] @relation("CertificateLogo")`<br>`certificateBackgrounds Certificate[] @relation("CertificateBackground")` |

### 2.4 Migration `20261019150000_giay_chung_nhan` (MỘT tệp, SQL đầy đủ)

**Cách làm (sổ lỗi 14, 16, 22):**
1. Viết trọn tệp ở thư mục nháp, ngoài kho.
2. Áp thử bằng `pnpm --filter @makeup/api db:deploy-to <database makeup_test_…>`. Không bao giờ dùng `makeup_dev`.
3. Kiểm xong mới chuyển vào `apps/api/prisma/migrations/20261019150000_giay_chung_nhan/migration.sql` bằng **một** lệnh `mv`.
4. Đếm dòng vi phạm trước khi bật chốt:
   - Bảng mới: 0 dòng.
   - `organization_profiles`: 2 cột mới đều NULL, nên 0 dòng vi phạm.
   - Ghi số đếm vào báo cáo.

**Lưu ý thứ tự tên:** kho đã có `20261019160000_moc_doi_mat_khau` (thợ K6), nên tên `150000` đứng **trước** một migration đã có.
- Hai migration độc lập: K6 chỉ thêm cột `users.password_changed_at`.
- `prisma migrate deploy` vẫn áp được migration còn thiếu dù tên đứng trước.
- Thợ phải chạy `prisma migrate status` trên một database thử **đã áp 160000** rồi mới áp 150000, và ghi kết quả.
- Nếu điều phối muốn tránh hẳn chuyện thứ tự thì đổi tên thành `20261019170000_giay_chung_nhan` (câu hỏi mở số 6). Nội dung giữ nguyên.

```sql
-- Giấy chứng nhận (docs/rnd/BAN-VE-F-GIAY-CHUNG-NHAN.md mục 2).
-- Bảng mới + 2 cột hồ sơ cho phép NULL, không DEFAULT: không viết lại bảng cũ, không dòng cũ nào vi phạm chốt (đã đếm = 0).

-- ---------- Phần Prisma tả được ----------

CREATE TYPE "CertificateStatus" AS ENUM ('ISSUED', 'REVOKED');

ALTER TABLE "organization_profiles" ADD COLUMN "cert_signer_name" TEXT,
ADD COLUMN "cert_signer_title" TEXT;

CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "course_class_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "reissue_no" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT NOT NULL,
    "issued_on" DATE NOT NULL,
    "reissued_on" DATE,
    "template_code" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "font_override" TEXT,
    "background_style" TEXT,
    "background_file_id" UUID,
    "frame_style" TEXT,
    "student_name" TEXT NOT NULL,
    "course_name" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "instructor_name" TEXT,
    "signer_name" TEXT,
    "signer_title" TEXT,
    "brand_name" TEXT NOT NULL,
    "photo_file_id" UUID,
    "logo_file_id" UUID,
    "status" "CertificateStatus" NOT NULL DEFAULT 'ISSUED',
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" TEXT,
    "revoked_by_id" UUID,
    "replaces_id" UUID,
    "issued_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificates_id_org_key" ON "certificates"("id", "organization_id");
CREATE UNIQUE INDEX "certificates_reissue_target_key" ON "certificates"("id", "organization_id", "enrollment_id", "year", "seq");
CREATE UNIQUE INDEX "certificates_number_key" ON "certificates"("organization_id", "year", "seq", "reissue_no");
CREATE INDEX "certificates_org_class_idx" ON "certificates"("organization_id", "course_class_id");
CREATE INDEX "certificates_org_customer_idx" ON "certificates"("organization_id", "customer_id");
CREATE INDEX "certificates_org_number_idx" ON "certificates"("organization_id", "year", "seq");

CREATE UNIQUE INDEX "enrollments_cert_target_key" ON "enrollments"("id", "organization_id", "course_class_id", "customer_id");

ALTER TABLE "certificates" ADD CONSTRAINT "certificates_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_fkey" FOREIGN KEY ("enrollment_id", "organization_id", "course_class_id", "customer_id") REFERENCES "enrollments"("id", "organization_id", "course_class_id", "customer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_class_fkey" FOREIGN KEY ("course_class_id", "organization_id") REFERENCES "course_classes"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_customer_fkey" FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_photo_fkey" FOREIGN KEY ("photo_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_logo_fkey" FOREIGN KEY ("logo_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_background_fkey" FOREIGN KEY ("background_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_replaces_fkey" FOREIGN KEY ("replaces_id", "organization_id", "enrollment_id", "year", "seq") REFERENCES "certificates"("id", "organization_id", "enrollment_id", "year", "seq") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revoked_by_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Phần viết tay: chốt chặn (Prisma không tả được) ----------
-- Luật sổ lỗi 24: CHECK có cột cho phép NULL phải viết rõ IS NULL / IS NOT NULL ở từng vế — Postgres coi CHECK ra NULL là ĐẠT.

-- Số: năm hợp lý, khớp năm ngày cấp; mã khớp năm + số (4 chữ số, từ 10000 in đủ, không cắt).
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_number" CHECK (
  "year" BETWEEN 2000 AND 2999
  AND "seq" BETWEEN 1 AND 999999
  AND "reissue_no" BETWEEN 0 AND 999
  AND "year" = EXTRACT(YEAR FROM "issued_on")::int
  AND "code" = 'CC-' || "year"::text || '-' || CASE WHEN "seq" < 10000 THEN lpad("seq"::text, 4, '0') ELSE "seq"::text END
);

-- Trạng thái: đã cấp thì không có dấu vết thu hồi; đã thu hồi thì đủ lúc nào, lý do (không rỗng, ≤ 500), ai thu hồi.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_status" CHECK (
  ("status" = 'ISSUED' AND "revoked_at" IS NULL AND "revoke_reason" IS NULL AND "revoked_by_id" IS NULL)
  OR ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL AND "revoke_reason" IS NOT NULL
      AND char_length(btrim("revoke_reason")) BETWEEN 1 AND 500 AND "revoked_by_id" IS NOT NULL)
);

-- Cấp lại: bản gốc không trỏ ai, không có ngày cấp lại; bản cấp lại phải trỏ bản cũ và có ngày cấp lại ≥ ngày cấp.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_reissue" CHECK (
  ("reissue_no" = 0 AND "replaces_id" IS NULL AND "reissued_on" IS NULL)
  OR ("reissue_no" >= 1 AND "replaces_id" IS NOT NULL AND "reissued_on" IS NOT NULL AND "reissued_on" >= "issued_on")
);

-- Mẫu: chỉ mẫu giấy chứng nhận cc-NN; phông chỉ ky-1..ky-4 hoặc null.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_template" CHECK (
  "template_code" ~ '^cc-[0-9]{2}$'
  AND "template_version" >= 1
  AND ("font_override" IS NULL OR "font_override" IN ('ky-1', 'ky-2', 'ky-3', 'ky-4'))
);

-- Chỗ chừa cho bộ nền (CHỜ BẢN VẼ NỀN): khoá dạng chữ thường/số/:/-, ≤ 64 ký tự; có ảnh nền thì phải có kiểu nền.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_background" CHECK (
  ("background_style" IS NULL OR "background_style" ~ '^[a-z0-9][a-z0-9:-]{0,63}$')
  AND ("frame_style" IS NULL OR "frame_style" ~ '^[a-z0-9][a-z0-9:-]{0,63}$')
  AND ("background_file_id" IS NULL OR "background_style" IS NOT NULL)
);

-- Chữ chụp lúc cấp: không rỗng, độ dài có trần.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_texts" CHECK (
  char_length(btrim("student_name")) BETWEEN 1 AND 200
  AND char_length(btrim("course_name")) BETWEEN 1 AND 200
  AND char_length(btrim("class_name")) BETWEEN 1 AND 200
  AND char_length(btrim("brand_name")) BETWEEN 1 AND 200
  AND ("instructor_name" IS NULL OR char_length(btrim("instructor_name")) BETWEEN 1 AND 200)
  AND ("signer_name" IS NULL OR char_length(btrim("signer_name")) BETWEEN 1 AND 120)
  AND ("signer_title" IS NULL OR char_length(btrim("signer_title")) BETWEEN 1 AND 120)
);

ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_cert_signer" CHECK (
  ("cert_signer_name" IS NULL OR char_length(btrim("cert_signer_name")) BETWEEN 1 AND 120)
  AND ("cert_signer_title" IS NULL OR char_length(btrim("cert_signer_title")) BETWEEN 1 AND 120)
);

-- Một ghi danh tối đa một bản còn hiệu lực.
CREATE UNIQUE INDEX "certificates_one_issued_per_enrollment" ON "certificates" ("enrollment_id") WHERE "status" = 'ISSUED';
-- Một số tối đa một bản còn hiệu lực.
CREATE UNIQUE INDEX "certificates_code_issued" ON "certificates" ("organization_id", "year", "seq") WHERE "status" = 'ISSUED';
-- Mỗi bản bị cấp lại tối đa một lần (không rẽ nhánh).
CREATE UNIQUE INDEX "certificates_replaced_once" ON "certificates" ("replaces_id") WHERE "replaces_id" IS NOT NULL;

-- Thêm mới: lớp chưa huỷ và đã kết thúc trước/đúng ngày cấp; ngày cấp (và ngày cấp lại) không sau hôm nay theo múi giờ
-- tổ chức; ghi danh còn hiệu lực; cấp lại thì bản cũ đã thu hồi và số lần cấp lại tăng đúng 1.
-- Dùng IS DISTINCT FROM / IS NULL để giá trị NULL (dòng không tìm thấy) cũng bị chặn, không lọt như CHECK.
CREATE FUNCTION certificates_insert_guard() RETURNS trigger AS $$
DECLARE
  k_end date;
  k_status "CourseClassStatus";
  e_status "EnrollmentStatus";
  tz text;
  today date;
  p_status "CertificateStatus";
  p_reissue integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'ISSUED' THEN
    RAISE EXCEPTION 'Giấy chứng nhận mới phải ở trạng thái đã cấp'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  SELECT end_date, status INTO k_end, k_status FROM course_classes
    WHERE id = NEW.course_class_id AND organization_id = NEW.organization_id;
  IF k_end IS NULL OR k_status IS DISTINCT FROM 'OPEN' AND k_status IS DISTINCT FROM 'CLOSED' THEN
    RAISE EXCEPTION 'Lớp không tồn tại hoặc đã huỷ'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  IF NEW.issued_on < k_end THEN
    RAISE EXCEPTION 'Ngày cấp phải từ ngày kết thúc lớp (%) trở đi', k_end
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  SELECT timezone INTO tz FROM organizations WHERE id = NEW.organization_id;
  today := (now() AT TIME ZONE COALESCE(tz, 'Asia/Ho_Chi_Minh'))::date;
  IF NEW.issued_on > today OR (NEW.reissued_on IS NOT NULL AND NEW.reissued_on > today) THEN
    RAISE EXCEPTION 'Ngày cấp không được sau hôm nay'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  SELECT status INTO e_status FROM enrollments
    WHERE id = NEW.enrollment_id AND organization_id = NEW.organization_id;
  IF e_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Ghi danh không còn hiệu lực'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  IF NEW.replaces_id IS NOT NULL THEN
    SELECT status, reissue_no INTO p_status, p_reissue FROM certificates
      WHERE id = NEW.replaces_id AND organization_id = NEW.organization_id
      FOR UPDATE;
    IF p_status IS DISTINCT FROM 'REVOKED' OR p_reissue IS NULL OR NEW.reissue_no <> p_reissue + 1 THEN
      RAISE EXCEPTION 'Cấp lại phải từ bản đã thu hồi và số lần cấp lại tăng đúng 1'
        USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER certificates_insert_guard BEFORE INSERT ON "certificates"
  FOR EACH ROW EXECUTE FUNCTION certificates_insert_guard();

-- Sửa: chỉ được ISSUED → REVOKED (kèm revoked_at, revoke_reason, revoked_by_id). Mọi cột khác đóng băng; bản đã thu hồi
-- đóng băng hoàn toàn. So bằng jsonb trừ 4 cột được đổi — cột thêm sau này tự vào diện đóng băng.
CREATE FUNCTION certificates_update_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'REVOKED' THEN
    RAISE EXCEPTION 'Giấy chứng nhận đã thu hồi: không được thay đổi'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_update_guard';
  END IF;
  IF NEW.status IS DISTINCT FROM 'REVOKED' THEN
    RAISE EXCEPTION 'Giấy chứng nhận đã cấp: chỉ được thu hồi, không sửa'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_update_guard';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status', 'revoked_at', 'revoke_reason', 'revoked_by_id'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'revoked_at', 'revoke_reason', 'revoked_by_id']) THEN
    RAISE EXCEPTION 'Giấy chứng nhận đã cấp: số, tên, mẫu, ngày cấp không sửa được — dùng Cấp lại'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_update_guard';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER certificates_update_guard BEFORE UPDATE ON "certificates"
  FOR EACH ROW EXECUTE FUNCTION certificates_update_guard();

-- Sổ chỉ ghi thêm: không xoá.
CREATE FUNCTION certificates_no_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Sổ giấy chứng nhận chỉ ghi thêm, không xoá — dùng Thu hồi'
    USING ERRCODE = '23514', CONSTRAINT = 'certificates_no_delete';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER certificates_no_delete BEFORE DELETE ON "certificates"
  FOR EACH ROW EXECUTE FUNCTION certificates_no_delete();
```

**Đối chiếu với Prisma:**
- Áp xong, chạy `prisma migrate diff --from-schema-datasource` (database thử) `--to-schema-datamodel prisma/schema.prisma`.
- Phần Prisma tả được phải **khớp, không còn gì để đổi**.
- 3 chỉ mục một phần và 3 trigger nằm ngoài Prisma. Xử lý giống tiền lệ `enrollments_one_active`, ghi rõ trong báo cáo.

### 2.5 Thứ tự khoá (chống khoá chết, sổ lỗi 18)

Mọi đường ghi khoá theo **cùng một thứ tự**: dòng lớp (`course_classes … FOR UPDATE`), rồi dòng giấy chứng nhận, rồi dòng bộ đếm `org_counters`.
- Cấp hàng loạt: lớp, rồi bộ đếm.
- Cấp lại và thu hồi: lớp của bản đó, rồi dòng bản đó. Hai đường này không đụng bộ đếm, vì cấp lại giữ số cũ.
- Hai lớp khác nhau cấp cùng lúc chỉ xếp hàng ở dòng bộ đếm. Không tạo vòng chờ.

### 2.6 Đề xuất trường nền cho tổ chức (CHỜ BẢN VẼ NỀN, KHÔNG có trong migration này)

Tên theo đề xuất ở BAO-CAO-RND-07-NEN-HOA-VAN.md mục 9, để hai bản vẽ dùng chung một bộ tên.

| Bảng | Trường | Kiểu | Ghi chú | Trạng thái |
|---|---|---|---|---|
| `OrganizationProfile` | `certBackgroundStyle` → `cert_background_style` | `String?` | Kiểu nền mặc định cho giấy chứng nhận, ví dụ `"hv:damask:vua"`. Danh mục ở packages/shared | **chờ bản vẽ nền** |
| `OrganizationProfile` | `cardBackgroundFileId` → `card_background_file_id` | `String? @db.Uuid` | Ảnh nền của tổ chức (R&D-07 phương án 2). Dùng chung cho thẻ chào mừng và giấy chứng nhận, khoá ngoại kép | **chờ bản vẽ nền** |
| `OrganizationProfile` | `certFrameStyle` → `cert_frame_style` | `String?` | Khung mặc định | **chờ bản vẽ nền** |
| `Certificate` | `background_style`, `background_file_id`, `frame_style` | **đã có** trong migration này | Kiểu nền lúc cấp. In lại ra y hệt | Đợt này luôn NULL |

**Đợt này:**
- Máy chủ không nhận trường nền nào trong thân yêu cầu, và luôn ghi NULL.
- Tệp mẫu chừa sẵn tham số `nen=` và `khung=`, chưa dùng (mục 5.2).
- Khi bản vẽ nền xong: thêm trường vào thân cấp và cấp lại, rồi điền vào 3 cột đã có. **Không phải đổi bảng Certificate.**

---

## 3. Danh mục dùng chung (packages/shared)

### 3.1 Quyền (`packages/shared/src/permissions.ts`)

Thêm vào `PERMISSIONS`:

```ts
'certificates.read': 'Xem, in lại giấy chứng nhận',
'certificates.issue': 'Cấp, cấp lại, thu hồi giấy chứng nhận',
```

| Vai trò mẫu | `certificates.read` | `certificates.issue` |
|---|---|---|
| owner, admin | có (tự có, vì giữ mọi quyền) | có |
| manager | **thêm** | **thêm** |
| receptionist | **thêm** | không |
| instructor | **thêm** | không |
| accountant, artist, assistant, teaching_assistant | không | không |

- Sau triển khai **bắt buộc** chạy `pnpm --filter @makeup/api db:sync-roles`. Bản thật dùng `db:sync-roles:prod`.
- Ghi vào danh sách bước triển khai trong báo cáo gói.
- Không cần sửa `sync-system-roles.ts`.

### 3.2 Tệp mới `packages/shared/src/certificates.ts`

Tệp này **không** chạm `design-templates.ts`. Gói máy chủ chạy song song với thợ K3 được.

```ts
// Giấy chứng nhận — hằng số và hàm dùng chung cho máy chủ và web (BAN-VE-F-GIAY-CHUNG-NHAN).
export const CERTIFICATE_TITLE = 'Giấy chứng nhận';
export const DEFAULT_SIGNER_TITLE = 'Giám đốc trung tâm';
// Mã mẫu và phiên bản bố cục. Danh mục hiển thị (tên, phông, ô) nằm ở DESIGN_TEMPLATES (kind CERTIFICATE);
// bài thử design-templates.test.ts kiểm hai nơi khớp nhau.
export const CERTIFICATE_TEMPLATES = {
  'cc-01': { version: 1 }, 'cc-02': { version: 1 }, 'cc-03': { version: 1 }, 'cc-04': { version: 1 }, 'cc-05': { version: 1 },
  'cc-06': { version: 1 }, 'cc-07': { version: 1 }, 'cc-08': { version: 1 }, 'cc-09': { version: 1 }, 'cc-10': { version: 1 },
} as const;
export type CertificateTemplateCode = keyof typeof CERTIFICATE_TEMPLATES;
export const CERTIFICATE_TEMPLATE_CODES = Object.keys(CERTIFICATE_TEMPLATES) as CertificateTemplateCode[];
export function isCertificateTemplateCode(v: string): v is CertificateTemplateCode;
// Ảnh xuất: A4 ngang 150 dpi. Khung vẽ trong tệp mẫu: 1123×794 px (A4 ở 96 dpi).
export const CERTIFICATE_IMAGE = { width: 1754, height: 1240 } as const;
export const CERTIFICATE_FRAME = { width: 1123, height: 794 } as const;
// Trang PDF A4 ngang tính bằng point.
export const CERTIFICATE_PAGE_PT = { width: 841.89, height: 595.28 } as const;
export const CERTIFICATE_MAX_BATCH = 500; // = trần số học viên một lớp
export const CERTIFICATE_IDS_MAX = 50; // lọc sổ theo ids (in lại nhiều bản)
export function certificateCode(year: number, seq: number): string; // (2026, 7) → "CC-2026-0007"; (2026, 12345) → "CC-2026-12345"
export function certificateCounterKey(year: number): string; // "certificate:2026"
export const REISSUE_REASONS = ['Sai tên / sai dấu', 'Đổi mẫu', 'Khác'] as const;
```

Bài thử `certificates.test.ts` cùng thư mục:
- `certificateCode` ra đúng ở seq 1, 9999, 10000.
- `isCertificateTemplateCode('shd-01') === false`.
- Có đúng 10 mã.

Thêm `export * from './certificates';` vào `packages/shared/src/index.ts`.

### 3.3 Danh mục mẫu (`design-templates.ts`, sau khi K3 xong)

Gói T1 làm phần này.
- `export type DesignKind = 'WELCOME' | 'FEEDBACK' | 'GREETING' | 'CERTIFICATE';`
- `DESIGN_SIZES = ['1080x1350', '1080x1080', '1754x1240'] as const`.
- `tpl()` nhận thêm tham số `sizes` (mặc định `BOTH_SIZES`). Mẫu cc truyền `['1754x1240']`.
- Ô mới trong `SLOT_SOURCES`, đều `contract: 'COURSE'`:

| Khoá | label | from |
|---|---|---|
| `so` | Số giấy chứng nhận | `Certificate.code` |
| `ncap` | Ngày cấp | `Certificate.issuedOn` |
| `lai` | Ngày cấp lại | `Certificate.reissuedOn` (chỉ bản cấp lại) |
| `gd` | Người ký (Giám đốc) | `OrganizationProfile.certSignerName` (chụp vào `Certificate.signerName`) |
| `gdcv` | Chức danh người ký | `OrganizationProfile.certSignerTitle` (trống = "Giám đốc trung tâm") |

10 dòng mẫu:
- Ô chung của cả 10: `['logo', 'th', 'anh', 'ten', 'khoa', 'lop', 'so', 'ncap', 'lai', 'gv', 'gd', 'gdcv']`.
- `photos {0,0}`, `photoFrames 1`, `frameShape 'circle'`, `contractKinds ['COURSE']`.

| Mã | Tên | Phông | origin |
|---|---|---|---|
| cc-01 | Xanh đêm dải vàng | KY(1), CHAN_DAM, CHAN, SANS | HOC_TU_ANH |
| cc-02 | Đen nhung mảng đỏ | KY(2), CHAN_DAM, CHAN, SANS | HOC_TU_ANH |
| cc-03 | Trắng sóng đỏ vàng | KY(1), CHAN_DAM, CHAN, SANS | HOC_TU_ANH |
| cc-04 | Kem sóng chìm | KY(3), KY(4), CHAN_DAM, CHAN, SANS | HOC_TU_ANH |
| cc-05 | Hoa văn vàng cổ điển | KY(2), CHAN_DAM, CHAN, SANS | HOC_TU_ANH |
| cc-06 | Guilloche bạc | KY(4), CHAN_DAM, CHAN, SANS | TU_SANG_TAC |
| cc-07 | Hồng mận vàng hồng | KY(1), CHAN_DAM, CHAN, SANS | TU_SANG_TAC |
| cc-08 | Đen Art Deco | KY(2), CHAN_DAM, CHAN, SANS | TU_SANG_TAC |
| cc-09 | Ngà nguyệt quế | KY(3), KY(4), CHAN_DAM, CHAN, SANS | TU_SANG_TAC |
| cc-10 | Lục bảo khung vát | KY(1), CHAN_DAM, CHAN, SANS | TU_SANG_TAC |

Chỗ phải sửa theo vì kiểm tra kiểu: thêm `CERTIFICATE: 'giấy chứng nhận'` vào apps/api/src/modules/designs/data.ts:39, và `CERTIFICATE: 'Giấy chứng nhận'` vào apps/web/src/features/designs/model.ts:28. **Không** thêm vào `KIND_TABS`.

---

## 4. Máy chủ

Thư mục mới `apps/api/src/modules/certificates/`:
- `schemas.ts`: khuôn zod.
- `present.ts`: dạng trả về.
- `service.ts`: nghiệp vụ.
- `routes.ts`: mảng `certificateRoutes`, đăng ký ở app.ts.

Mọi đường đều:
- Scope `org`, tag `Giấy chứng nhận`.
- Gọi `assertAcademy` đầu tiên (403 "Tổ chức chưa bật đào tạo").
- Tra mọi mã theo `(id, organizationId)`. Mã của tổ chức khác trả **y hệt** mã bịa (sổ lỗi 12).

### 4.1 Bảng đường

| # | Phương thức + đường | Quyền | Chống gửi trùng | Việc |
|---|---|---|---|---|
| 1 | `GET /orgs/:orgId/classes/:classId/certificates` | certificates.read | – | Danh sách cấp của lớp, dùng cho hộp cấp và phần xem trước |
| 2 | `POST /orgs/:orgId/classes/:classId/certificates` | certificates.issue | **có** | Cấp hàng loạt |
| 3 | `GET /orgs/:orgId/certificates` | certificates.read | – | Sổ: lọc, phân trang. Cũng dùng cho hồ sơ học viên (`customerId`) và lấy URL ảnh mới trước khi in (`ids`) |
| 4 | `GET /orgs/:orgId/certificates/:certificateId` | certificates.read | – | Một bản |
| 5 | `POST /orgs/:orgId/certificates/:certificateId/reissue` | certificates.issue | **có** | Cấp lại, giữ số |
| 6 | `POST /orgs/:orgId/certificates/:certificateId/revoke` | certificates.issue | không (lần 2 ra 409) | Thu hồi |
| 7 | `GET /orgs/:orgId/profile/certificate` | org.read | – | Người ký đang đặt |
| 8 | `PUT /orgs/:orgId/profile/certificate` | org.update | – | Đặt người ký |

- Đường 7 và 8 nằm trong `profile/routes.ts`. Không gọi `assertAcademy`: hồ sơ thương hiệu có ở mọi loại tổ chức.
- Web chỉ hiện thẻ người ký cho tổ chức ACADEMY.
- **Không có đường "in" riêng.** Dữ liệu in là `CertificateView`, đã kèm URL ảnh ký có hạn. Máy chủ không vẽ gì, không lưu PDF hay PNG.

### 4.2 Dạng trả về

```ts
// Ảnh ký có hạn (profile/images.ts signImages: chỉ tệp READY, chưa xoá, đúng tổ chức; còn lại null).
type SignedImage = { url: string; expiresAt: string };
type SignedPhoto = SignedImage & { width: number | null; height: number | null }; // để web báo "ảnh nhỏ, in có thể mờ"

interface CertificateView {
  id: string;
  code: string;               // "CC-2026-0007"
  year: number; seq: number; reissueNo: number;
  status: 'ISSUED' | 'REVOKED';
  issuedOn: string;           // "YYYY-MM-DD"
  reissuedOn: string | null;
  templateCode: string; templateVersion: number;
  fontOverride: 'ky-1' | 'ky-2' | 'ky-3' | 'ky-4' | null;
  backgroundStyle: string | null; frameStyle: string | null; // chờ bản vẽ nền — đợt này luôn null
  studentName: string; courseName: string; className: string;
  instructorName: string | null; signerName: string | null; signerTitle: string | null; brandName: string;
  photo: SignedPhoto | null; logo: SignedImage | null; background: SignedImage | null;
  enrollmentId: string; courseClassId: string;
  customer: { id: string; fullName: string };   // tên HIỆN HÀNH (để hộp cấp lại điền sẵn)
  revokedAt: string | null; revokeReason: string | null;
  replacesId: string | null;
  replacedById: string | null;                  // bản cấp lại sau bản này (nếu có)
  issuedBy: { userId: string; name: string };
  createdAt: string;
}
```

Danh sách cấp của lớp (đường 1):

```ts
interface ClassCertificateRoster {
  class: { id: string; name: string; courseId: string; courseName: string; courseMode: 'SINGLE_CLASS' | 'MULTI_CLASS';
           startDate: string; endDate: string; status: 'OPEN' | 'CLOSED' | 'CANCELLED'; instructorName: string | null };
  today: string;                       // theo múi giờ tổ chức
  ended: boolean;                      // endDate <= today && status !== 'CANCELLED'
  defaultIssuedOn: string | null;      // = endDate khi ended, ngược lại null
  brandName: string;                   // profile.brandName ?? organization.name
  logo: SignedImage | null;
  signer: { name: string | null; title: string };  // title đã thay mặc định "Giám đốc trung tâm"
  nextNumber: { year: number; seq: number; code: string } | null; // DỰ KIẾN cho issuedOn (query) hoặc defaultIssuedOn; null khi chưa ended
  moneyVisible: boolean;               // contracts.read || payments.read
  items: Array<{
    enrollmentId: string; enrolledAt: string;
    customer: { id: string; fullName: string; photo: SignedPhoto | null };
    contract: { id: string; code: string; total: number | null; paid: number | null; debt: number | null }; // null khi !moneyVisible
    certificate: CertificateView | null;            // bản ISSUED hiện hành
    lastRevoked: { id: string; code: string; revokedAt: string; revokeReason: string } | null; // khi không có bản ISSUED mà có bản đã thu hồi
  }>;
}
```

### 4.3 Đường 1: danh sách cấp của lớp

- Query: `issuedOn?: YYYY-MM-DD`. Chỉ dùng để tính `nextNumber` theo năm của ngày đó.
- Trình tự:
  1. Tra lớp theo id và tổ chức. Không thấy thì 404 "Không tìm thấy lớp".
  2. Lấy ghi danh **ACTIVE** của lớp, xếp `enrolledAt asc, id asc` (giống listEnrollments).
  3. Lấy bản ISSUED theo ghi danh. Với ghi danh không có bản ISSUED, lấy bản REVOKED mới nhất.
  4. Tính tiền đã thu và nợ bằng **đúng** câu `groupBy` ở courses/service.ts:298-308. `debt = max(0, total − paid)`.
  5. `nextNumber`:
     - Đọc `org_counters` khoá `certificate:<năm>` (**chỉ đọc**, không khoá).
     - `seq = value + 1`, chưa có dòng thì 1. Đây là số dự kiến, không cam kết.
- Lớp chưa kết thúc vẫn trả 200 (`ended: false`). Web dựa vào đó tắt nút.
- Lớp CANCELLED cũng trả 200, kèm `ended: false`.

### 4.4 Đường 2: cấp hàng loạt

Thân (`strictObject`):

```ts
{
  enrollmentIds: z.array(z.uuid()).min(1).max(CERTIFICATE_MAX_BATCH)  // không trùng (refine → 400 "Học viên bị chọn trùng")
  templateCode: z.string().refine(isCertificateTemplateCode)         // lạ → 400 path templateCode "Không có mẫu giấy chứng nhận …"
  issuedOn: z.iso.date()
  fontOverride: z.enum(FONT_OVERRIDES).nullable().optional()
}
```

Thân rỗng `{}` phải ra 400 ở bước zod. Phép GIỮ của cửa gác đòi điều này.

Trình tự, tất cả trong **một** transaction, `timeout: 30_000`:
1. `assertAcademy`, lấy `timezone`.
2. `lockClass(tx, orgId, classId)`. Không thấy thì 404.
3. Lớp `CANCELLED` thì 409 "Lớp đã huỷ" (`details.reason: 'CLASS_CANCELLED'`).
4. `endDate > todayIn(tz)` thì 409 "Lớp kết thúc ngày dd/mm/yyyy — cấp được từ ngày đó" (`details: { reason: 'CLASS_NOT_ENDED', endDate }`).
5. Kiểm `issuedOn`:
   - `issuedOn < endDate`: 400 path `issuedOn` "Ngày cấp phải từ ngày kết thúc lớp (dd/mm/yyyy) trở đi".
   - `issuedOn > today`: 400 path `issuedOn` "Ngày cấp không được sau hôm nay".
6. Tra ghi danh `where { id in enrollmentIds, organizationId, courseClassId: classId }`. Gom lỗi theo từng phần tử (`throwIfIssues`, designs/data.ts:27-36):
   - Không thấy, kể cả ghi danh của lớp khác hay tổ chức khác: `enrollmentIds.i` "Không tìm thấy học viên này trong lớp". Lời **giống hệt nhau** cho cả ba trường hợp.
   - `status = CANCELLED`: `enrollmentIds.i` "Học viên … đã huỷ ghi danh".
7. Chuẩn bị dữ liệu chung:
   - `brandName = profile.brandName ?? org.name`.
   - `logoFileId` = logo của hồ sơ, chỉ khi tệp READY, ngược lại null.
   - `signerName` = `profile.certSignerName`.
   - `signerTitle` = `profile.certSignerTitle ?? DEFAULT_SIGNER_TITLE`.
   - `instructorName` = cách hiển thị ở present.ts:153-155.
   - `courseName`, `className` = tên hiện hành.
8. Duyệt ghi danh theo **thứ tự danh sách lớp** (`enrolledAt, id`), **không** theo thứ tự gửi lên:
   - Đã có bản ISSUED: đưa vào `existing`, không đổi gì. Mẫu cũ, số cũ giữ nguyên.
   - Chưa có:
     - Lấy số: `INSERT INTO org_counters … ('certificate:'||year) … RETURNING value`.
     - Tạo dòng: `photoFileId` = `customer.avatarFileId` nếu tệp READY, ngược lại null; `studentName = customer.fullName`; `templateVersion` lấy từ `CERTIFICATE_TEMPLATES`.
     - `writeAudit` action `certificate.issued`, entityType `certificate`, data `{ code, enrollmentId, customerId, classId, templateCode, issuedOn, debtAtIssue }`.
     - `debtAtIssue` chỉ để lưu vết trong nhật ký, không trả cho web.
9. Lỗi trùng khoá (`P2002`) ở `certificates_one_issued_per_enrollment` hoặc `certificates_code_issued` thì 409 "Vừa có người cấp cho học viên này — tải lại danh sách" (`details.reason: 'CERTIFICATE_RACE'`). Lưới cuối, bình thường không xảy ra vì đã khoá lớp.

Phản hồi 201:

```ts
{
  items: CertificateView[];   // mọi ghi danh đã gửi, theo thứ tự danh sách lớp (bản mới + bản đã có)
  issuedCount: number;
  existingCount: number;
  debtWarnings: Array<{ enrollmentId: string; customerName: string; contractCode: string; debt: number | null }>; // còn nợ; debt null khi !moneyVisible
}
```

- **Nợ không bao giờ chặn.**
- Cùng `Idempotency-Key`, cùng thân: trả lại đúng phản hồi lần đầu (app.ts `runIdempotent`).
- Khoá khác mà cùng học viên: thành `existing`, không sinh số mới.

### 4.5 Đường 3: sổ

Query:

```ts
{
  year?: z.coerce.number().int().min(2000).max(2999)
  q?: z.string().trim().max(100)                 // ILIKE trên code hoặc student_name
  classId?: z.uuid(); customerId?: z.uuid()
  status?: z.enum(['ISSUED', 'REVOKED'])
  ids?: chuỗi "uuid,uuid,…" ≤ CERTIFICATE_IDS_MAX // tách, kiểm từng uuid; sai → 400 path ids
  page: z.coerce.number().int().min(1).default(1)
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
}
```

- Luôn lọc `organizationId`.
- `classId` hay `customerId` của tổ chức khác: trả **danh sách rỗng**, giống mã bịa. Không trả 404.
- Thứ tự: `year desc, seq desc, reissueNo desc`.
- Phản hồi: `{ items: CertificateView[]; page; pageSize; total; years: number[] }`.
- `years` = các năm có giấy của tổ chức, giảm dần, để đổ ô chọn năm.

### 4.6 Đường 5: cấp lại (giữ số)

Thân:

```ts
{
  reason: z.string().trim().min(1).max(500)
  studentName: z.string().trim().min(1).max(120).optional()  // trống = tên hiện hành của khách
  templateCode: ….optional()                                  // trống = mẫu cũ
  fontOverride: z.enum(FONT_OVERRIDES).nullable().optional()  // không gửi = phông cũ
}
```

Trình tự trong một transaction:
1. Tra bản theo id và tổ chức. Không thấy thì 404 "Không tìm thấy giấy chứng nhận".
2. `lockClass` lớp của bản đó, rồi `SELECT … FROM certificates WHERE id AND organization_id FOR UPDATE`.
3. Kiểm trạng thái:
   - Bản không ở ISSUED: 409 "Bản này đã thu hồi — cấp lại từ bản đang hiệu lực" (`details: { reason: 'CERTIFICATE_REVOKED', replacedById }`).
   - Ghi danh không còn ACTIVE: 409 "Học viên đã huỷ ghi danh — không cấp lại được".
4. Thu hồi bản cũ: `status = REVOKED`, `revokedAt = now`, `revokeReason = reason`, `revokedById`.
5. Tạo bản mới:
   - Cùng `enrollmentId, year, seq, code, issuedOn`.
   - `reissueNo = cũ + 1`, `reissuedOn = todayIn(tz)`, `replacesId = cũ`.
   - Chụp lại chữ từ dữ liệu **hiện hành** (khoá, lớp, giảng viên, người ký, trung tâm, ảnh, logo). Tên học viên lấy `studentName` nếu có gửi.
6. Nhật ký: `certificate.revoked` cho bản cũ, `certificate.reissued` cho bản mới, data `{ code, replacesId, reason, studentNameBefore, studentNameAfter, templateBefore, templateAfter }`.

- Phản hồi 201: `CertificateView` của bản mới.
- **Không** sửa tên trong hồ sơ khách. Hộp cấp lại ghi rõ điều này.

### 4.7 Đường 6: thu hồi

- Thân: `{ reason: z.string().trim().min(1).max(500) }`.
- Khoá theo thứ tự như cấp lại.
- Bản đã REVOKED: 409 "Bản này đã thu hồi".
- Nhật ký: `certificate.revoked`.
- Phản hồi 200: `CertificateView`.
- Sau khi thu hồi, ghi danh không còn bản ISSUED. Lần cấp hàng loạt sau cho người này nhận **số mới** (`reissue_no = 0`). Số cũ bỏ.

### 4.8 Đường 7 và 8: người ký

- GET trả `{ hasProfile: boolean; signerName: string | null; signerTitle: string | null; defaultTitle: 'Giám đốc trung tâm' }`.
- PUT thân `strictObject`:
  ```ts
  { signerName: z.string().trim().min(1).max(120).nullable(),
    signerTitle: z.string().trim().min(1).max(120).nullable() }
  ```
  Hai khoá **bắt buộc có mặt**, được phép `null`. Thân rỗng ra 400.
- Chưa có hồ sơ: 409 "Lưu Hồ sơ thương hiệu (tên thương hiệu) trước" (`details.reason: 'PROFILE_REQUIRED'`).
- Ghi trong transaction có khoá như `lockProfile` (profile/routes.ts:60-63). Nhật ký `profile.certificate_signer_updated` ghi trước và sau.
- **Sửa `presentProfile`** (profile/routes.ts:44-58): bỏ `certSignerName`, `certSignerTitle` khỏi `...rest`. `auditValues` giữ nguyên, nên nhật ký PUT hồ sơ vẫn thấy hai cột.
- `toData` **không** thêm hai trường. PUT /profile không bao giờ xoá người ký.

### 4.9 Bảng lỗi

| Mã HTTP | `code` | Khi nào | Lời (tiếng Việt, đúng chữ) | `details` |
|---|---|---|---|---|
| 400 | VALIDATION_FAILED | thân sai, mẫu lạ, ngày cấp sai, ghi danh không thuộc lớp, ghi danh đã huỷ, `ids` sai | theo từng mục ở trên | `issues[]` đúng đường dẫn trường |
| 403 | FORBIDDEN | tổ chức không ACADEMY | "Tổ chức chưa bật đào tạo" | `reason: 'ACADEMY_REQUIRED'` |
| 403 | FORBIDDEN | thiếu quyền (lớp khai đường tự chặn) | lời chung của hệ thống | `required` |
| 404 | NOT_FOUND | lớp hoặc giấy không có, kể cả của tổ chức khác | "Không tìm thấy lớp" / "Không tìm thấy giấy chứng nhận" | – |
| 409 | CONFLICT | lớp chưa kết thúc | "Lớp kết thúc ngày dd/mm/yyyy — cấp được từ ngày đó" | `reason: 'CLASS_NOT_ENDED', endDate` |
| 409 | CONFLICT | lớp đã huỷ | "Lớp đã huỷ" | `reason: 'CLASS_CANCELLED'` |
| 409 | CONFLICT | cấp lại hoặc thu hồi bản đã thu hồi | "Bản này đã thu hồi…" | `reason: 'CERTIFICATE_REVOKED', replacedById` |
| 409 | CONFLICT | cấp lại khi ghi danh đã huỷ | "Học viên đã huỷ ghi danh — không cấp lại được" | `reason: 'ENROLLMENT_CANCELLED'` |
| 409 | CONFLICT | va chạm hiếm, lưới database | "Vừa có người cấp cho học viên này — tải lại danh sách" | `reason: 'CERTIFICATE_RACE'` |
| 409 | CONFLICT | PUT người ký khi chưa có hồ sơ | "Lưu Hồ sơ thương hiệu (tên thương hiệu) trước" | `reason: 'PROFILE_REQUIRED'` |
| 409 | CONFLICT | `Idempotency-Key` dùng lại với thân khác | lời sẵn có của app.ts | – |

Lỗi `23514` từ trigger `certificates_*` mà lọt tới (máy chủ đã kiểm trước nên không được xảy ra) thì để thành 500. Bài thử phải bảo đảm máy chủ chặn **trước** database.

---

## 5. Mười mẫu vào app (`apps/web/public/mau/`)

### 5.1 Tệp

| Tệp | Nguồn | Việc |
|---|---|---|
| `public/mau/cc-01.html` … `cc-10.html` | docs/rnd/v8-mau-chung-chi/cc-NN.html | Chép rồi sửa theo 5.3. `<link href="chung/cc.css">`, `<script src="chung/cc.js">` và `chung/html-to-image.js`, `chung/cc-xuat.js` |
| `public/mau/chung/cc.css` | docs/rnd/v8-mau-chung-chi/chung/cc.css | `@import url('../phong/phong.css')` (phông app, **không** chép phông mới). Thêm `.cc{--ky-co-2:1.12}`. Giữ khối `@media print` đổi chữ vàng sang màu đặc |
| `public/mau/chung/cc.js` | …/chung/cc.js | Viết lại theo 5.2: chế độ `that=1`, đổi khoá, bỏ `td`, bỏ `nhieu` khi `that=1` |
| `public/mau/chung/cc-xuat.js` | mới | `window.MAU_XUAT_PNG` theo 5.4 |
| `public/mau/chung/anh-hoc-vien.svg`, `logo-mau*.svg` | **đã có** trong public/mau/chung | Không chép |
| `public/mau/anh-nho/cc-01.jpg` … `cc-10.jpg` | mới | Ảnh thu nhỏ 480×339, JPEG chất lượng 80, ≤ 60 KB mỗi ảnh. Chụp bằng Playwright từ chính tệp mẫu, dữ liệu mẫu R&D. Dùng cho dải chọn mẫu |

### 5.2 Tham số đường dẫn của tệp mẫu

| Tham số | Nghĩa | Rỗng khi `that=1` |
|---|---|---|
| `that=1` | dữ liệu thật: ô thiếu để trống, không lấy chữ mẫu R&D | – |
| `xuat=1` | bỏ lề trang xem, `.cc` nằm ở (0,0), cỡ 1123×794 (cả khi xem trước lẫn khi xuất) | – |
| `th` | tên trung tâm | để trống |
| `logo` | URL blob logo | ẩn ô logo (đã có trong cc.js gốc) |
| `ten` | tên học viên (tự co một dòng, `data-fitw`) | để trống |
| `anh` | URL blob ảnh | khung tròn in chữ cái đầu của `ten` (`chuDau`). `ten` cũng trống thì để khung trống |
| `khoa`, `lop` | tên khoá, tên lớp | dòng "Đã hoàn thành khoá {khoa} · Lớp {lop}". **Bỏ "· Lớp …" khi `lop` trùng `khoa`** (khoá một lớp) hoặc `lop` trống. `khoa` trống thì cả dòng trống |
| `ncap` | ngày cấp `dd/mm/yyyy` | dòng "Ngày … tháng … năm …" trống, năm trên huy hiệu trống |
| `so` | số `CC-2026-0007` | dòng số trống |
| `lai` | ngày cấp lại `dd/mm/yyyy` | không có: bản gốc. Có thì dòng số thành "Số CC-2026-0007 · Bản cấp lại dd/mm/yyyy" |
| `gv`, `gd` | tên giảng viên, tên người ký 2 | để trống. Nhãn chức danh và đường kẻ ký tay vẫn hiện |
| `gdcv` | chức danh người ký 2 | giữ nhãn "Giám đốc trung tâm" in sẵn |
| `ky=1..4` | đổi phông tên học viên | phông theo mẫu |
| `nen`, `khung` | **chờ bản vẽ nền**: đọc rồi bỏ qua | – |

Khi `that=1`, cc.js đặt `document.body.dataset.ready = '1'` sau khi co chữ xong. Tham số `td` (sửa tiêu đề) **bỏ**: tiêu đề cố định.

### 5.3 Sửa chữ trên 10 mẫu (bắt buộc)

- Tiêu đề lớn của **cả 10 mẫu** là "GIẤY CHỨNG NHẬN". Mẫu 04 và 09 viết tay bằng phông chữ ký 4: "Giấy chứng nhận".
- Dòng phụ dưới tiêu đề: "Hoàn thành khoá học". Bỏ chữ "Tốt nghiệp" ở các mẫu đang có. Xem câu hỏi mở 4.
- Huy hiệu:
  - `data-vong` mặc định giữ "★ CHỨNG NHẬN ★".
  - `dong1` đổi từ "TỐT NGHIỆP" sang "HOÀN THÀNH".
  - `dong2` là năm của `ncap`.
- Nhãn "Số chứng chỉ" đổi thành "Số".
- Trong mọi tệp không còn chữ "chứng chỉ" hay "CHỨNG CHỈ". Bài thử kiểm bằng tìm chuỗi, không phân biệt hoa thường.
- "GIẤY CHỨNG NHẬN" dài hơn "CHỨNG CHỈ" (15 so với 9 ký tự):
  - Thêm `data-fitw` cho tiêu đề, hoặc hạ cỡ chữ.
  - Tiêu đề phải nằm trên **một dòng**, phần tràn ≤ 1 px, đo bằng Playwright ở cả 10 mẫu.
  - Tiêu đề không được đè ảnh, huy hiệu hay tên. Kiểm hình chữ nhật bao của các phần tử không giao nhau.
- Không đổi bố cục khác. Không thêm ô không có dữ liệu. Ảnh tròn giữ ở cả 10 mẫu, kể cả 03 và 05.
- Đo lại tương phản theo cách của R&D-08 mục 3.4 ở các ô chữ đã đổi. Ngưỡng: chữ thường ≥ 4,5:1, chữ to ≥ 3:1.

### 5.4 Xuất ảnh (`cc-xuat.js`)

```js
// Chụp .cc (khung 1123×794) thành PNG 1754×1240 (A4 ngang 150 dpi) bằng html-to-image (MIT, chung/html-to-image.js).
window.MAU_XUAT_PNG = async function () {
  await document.fonts.ready; /* chờ body.dataset.ready === '1' (tối đa 20 giây) */
  const c = document.querySelector('.cc');
  const opt = { width: 1123, height: 794, canvasWidth: 1123, canvasHeight: 794, pixelRatio: 1754 / 1123, cacheBust: false, backgroundColor: '#ffffff' };
  await window.htmlToImage.toBlob(c, opt);          // lần 1: nạp phông vào ảnh SVG
  const blob = await window.htmlToImage.toBlob(c, opt);
  if (!blob) throw new Error('Không vẽ được ảnh');
  return { blob, width: 1754, height: 1240 };
};
```

- Web gọi bằng `renderTemplatePng(src, '1754x1240')` có sẵn ở exportPng.ts:23. Iframe 1754×1240, `.cc` ở góc trên trái. Hàm tự kiểm ảnh ra đúng 1754×1240.
- **Độ nét:** bài thử T1-4 (mục 9) so ảnh html-to-image với ảnh chụp Playwright `deviceScaleFactor = 1754/1123`. Sai khác trung bình mỗi điểm ảnh phải ≤ 8/255.
- Nếu iPhone thật cho ảnh mờ (buổi thử thật), phương án dự phòng là vẽ mẫu thẳng ở 1754 px. Việc đó là một gói riêng, không làm trước.

---

## 6. Màn web

Thư mục mới `apps/web/src/features/certificates/`. Từ ngữ: "giấy chứng nhận"; nút ngắn "Cấp chứng nhận".

Ba khổ, theo đúng mốc bẻ của app (BAN-VE-C):

| Khổ | Bề ngang | Ảnh mẫu tham chiếu |
|---|---|---|
| máy tính | ≥ 1181 px, chụp ở 1440×900 | luong-a-cap-1440.png |
| máy tính bảng | 641–1180 px, chụp ở 1024×768 | – |
| điện thoại | ≤ 640 px, chụp ở 390×844 | luong-a-m-*-390.png |

### 6.1 Nút trên thẻ lớp

Sửa `ClassCard.tsx`. Thêm props:

```ts
// Có thì hiện nút "Cấp chứng nhận" (certificates.issue, tổ chức ACADEMY). today = "YYYY-MM-DD" theo múi giờ tổ chức.
onCertificates?: () => void;
today?: string;
```

| Tình trạng lớp | Có `certificates.issue` | Không có quyền |
|---|---|---|
| đã huỷ | không nút | không nút |
| chưa kết thúc (`endDate > today`) | `OffButton` "Cấp chứng nhận", lý do "Lớp kết thúc dd/mm/yyyy — cấp được từ ngày đó". Các nút cũ giữ nguyên | như cũ |
| đã kết thúc | nút **chính** "Cấp chứng nhận" (biểu tượng chứng nhận) **thay chỗ** nút "Ghi danh". Ghi danh ẩn | như cũ (Ghi danh theo luật cũ) |

- `CourseDetail.tsx` truyền `onCertificates` khi `perms.certIssue`, ở cả hai chỗ dựng thẻ (:76-83, :130-138). Danh sách lớp đã huỷ (:148-158) không truyền.
- `coursePerms` thêm `certIssue: has('certificates.issue')`, `certRead: has('certificates.read')`.
- `today` lấy bằng `todayInTz(org.timezone)` ở `features/certificates/logic.ts`. Cách tính giống customers/logic.ts:186. Múi giờ lấy từ phiên như các màn khác.
- Bấm nút thì `CoursesPage` mở `IssueDialog` với `classId`.

### 6.2 Hộp "Cấp giấy chứng nhận" (`IssueDialog.tsx`)

- Không dùng `Dialog size="lg"` (quá hẹp). Dùng `Dialog` với `className="gcn-dlg"`; `certificates.css` đặt `.ui-dialog.gcn-dlg{width:min(1200px,100%)}`.
- Điện thoại: tràn màn hình, `height: 100dvh`, bỏ bo góc.
- Dữ liệu từ đường 1. Tiêu đề hộp: "Cấp giấy chứng nhận". Dòng phụ: "{khoá} · {lớp} · kết thúc dd/mm/yyyy".

**Máy tính (≥ 1181):** hai cột `360px | 1fr`, như ảnh luong-a-cap-1440.png.

- **Cột trái "Học viên":**
  - Dòng đầu: ô "Chọn tất cả (n)" và chữ nhỏ "Học viên đã huỷ ghi danh không hiện ở đây".
  - Mỗi dòng có ô chọn, ảnh tròn (hoặc chữ cái đầu), tên, và dòng phụ:
    - chưa cấp: "Chưa cấp";
    - đã cấp: "Đã cấp · **CC-2026-0003**" kèm nhãn xanh "Đã cấp";
    - thu hồi mà chưa cấp lại: "Đã thu hồi CC-… · cấp sẽ nhận số mới".
  - Nhãn phụ trên dòng:
    - "chưa có ảnh — in chữ cái đầu" (màu cảnh báo), kèm liên kết "Thêm ảnh" mở `/{slug}/khach-hang/{id}` ở tab mới;
    - "ảnh nhỏ, in có thể mờ" khi `photo.width` hoặc `photo.height` < 500;
    - "Còn nợ 1.500.000 đ" (nhãn vàng) khi `moneyVisible && debt > 0`.
  - Tích sẵn: mọi dòng **trừ** dòng "đã thu hồi chưa cấp lại".
  - Bấm vào tên thì phần xem trước nhảy tới người đó.
- **Cột phải**, từ trên xuống:
  1. Thẻ "Mẫu giấy chứng nhận":
     - Dải ngang 10 ảnh thu nhỏ `anh-nho/cc-NN.jpg`, nhãn "NN · Tên mẫu". Tên lấy từ `DESIGN_TEMPLATES` loại CERTIFICATE.
     - Mặc định là mẫu dùng lần trước, nhớ trong `localStorage` khoá `gcn:mau:<orgId>` (bọc try/catch). Không có thì cc-01.
  2. Hàng cài đặt:
     - **Ngày cấp:** `DateInput`, min = endDate, max = today, mặc định `defaultIssuedOn`. Đổi sang năm khác thì tải lại đường 1 với `issuedOn` để cập nhật số dự kiến.
     - **Phông tên học viên:** "Theo mẫu (Chữ ký N)", Chữ ký 1–4.
     - **Số:** "Tự cấp: CC-2026-0008 → 0014 (dự kiến)" kèm `Tooltip` "Máy chủ đánh số khi bấm Cấp, nối tiếp theo năm. Người đã có giấy giữ số cũ."
     - **Người ký:** "{giảng viên hoặc 'chưa gán giảng viên'} · {Giám đốc hoặc 'chưa điền tên Giám đốc'}". Có `org.update` thì có liên kết "Sửa" sang `/{slug}/cai-dat/thuong-hieu`.
  3. Thẻ "Xem trước": `CertificatePreview` (6.3). Dưới là nút ‹ › và chữ "**2/8 · Lê Thị Mai**".
  4. Thanh tổng dính đáy hộp:
     - Chữ: "**Đã chọn 8 học viên** · 7 cấp mới + 1 in lại · 8 trang A4 ngang".
     - Nút chính "Cấp và in (8)". Khi 0 người mới thì nút đổi thành "In lại (n)".

**Máy tính bảng (641–1180):** như máy tính, cột trái 300px. Dải mẫu cuộn ngang. Hàng cài đặt xuống 2 cột.

**Điện thoại (≤ 640):** như ảnh luong-a-m-ds-390.png và luong-a-m-xem-390.png.
- Đầu hộp có `Segmented` hai bước: "Học viên (8)" | "Mẫu & xem trước".
- Bước 1 là danh sách học viên. Bước 2 gồm dải mẫu, cài đặt xếp dọc, và xem trước.
- Xem trước vuốt trái/phải bằng sự kiện con trỏ, ngưỡng 40 px, và có nút ‹ ›.
- Thanh "Cấp và in (8)" dính đáy, bề ngang đầy.

**Trạng thái khác:**

| Trạng thái | Hiện |
|---|---|
| Đang tải | khung xương (Skeleton) |
| Lỗi tải | dải lỗi kèm "Thử lại" |
| Lớp không có học viên đang học | EmptyState "Lớp này không có học viên đang học." Nút cấp tắt |
| `ended: false` (lớp vừa bị sửa ngày) | dải vàng "Lớp kết thúc dd/mm/yyyy — cấp được từ ngày đó". Nút tắt |

**Hộp xác nhận** (`ConfirmDialog`), chỉ khi có ít nhất 1 người cấp mới:
- Tiêu đề: "Cấp {k} giấy chứng nhận mới?"
- Thân:
  - "Số dự kiến **CC-2026-0008 → CC-2026-0014**, ngày cấp **20/12/2026**, mẫu **05 · Hoa văn vàng cổ điển**."
  - Nếu có người đã có giấy: "{m} học viên đã có giấy: in lại bản cũ (giữ số cũ, mẫu cũ)."
  - Nếu có nợ: dải vàng "{d} học viên còn nợ học phí (tổng {x} đ). Vẫn cấp được."
  - Dải vàng: "Đã cấp thì số và tên không sửa được. Tên sai: Sổ giấy chứng nhận → Cấp lại (giữ số cũ, ghi 'bản cấp lại')."
- Nút: "Huỷ" | "Cấp và mở bản in".

**Gửi đi:**
- Tạo `Idempotency-Key` khi mở hộp xác nhận.
- **Giữ nguyên** khoá đó khi bấm lại sau lỗi mạng.
- Tạo khoá mới khi đã thành công, hoặc khi đổi danh sách chọn, mẫu, ngày hay phông.

**Lỗi khi gửi:**
- 409 `CLASS_NOT_ENDED` hoặc `CLASS_CANCELLED`: dải lỗi với đúng lời máy chủ, rồi tải lại đường 1.
- 400 `issuedOn`: lỗi đặt dưới ô ngày.
- 400 `enrollmentIds.i`: tải lại danh sách và báo "Danh sách lớp vừa thay đổi".
- 409 `CERTIFICATE_RACE`: tải lại danh sách.

Thành công thì mở `PrintSheet` với `items` của phản hồi. Khi 0 người mới thì mở thẳng `PrintSheet` với các `certificate` của danh sách, **không gọi POST**.

### 6.3 Xem trước (`CertificatePreview.tsx`)

- Iframe `/mau/{cc}.html?{query}&xuat=1`, kích thước trong 1123×794. Thu nhỏ bằng `transform: scale(bề ngang khung / 1123)`, giống PreviewFrame.tsx.
- `query` dựng bằng `certificateFrameQuery()` (7.1).
  - Người **chưa cấp**: lấy dữ liệu từ danh sách lớp. `so` = số dự kiến theo vị trí người đó trong danh sách người mới. Trên khung ghi nhãn nhỏ "Số trên bản xem trước là số dự kiến".
  - Người **đã cấp**: dựng từ `CertificateView` (mẫu cũ). Kèm nhãn "Đã cấp · CC-… · in lại bản cũ".
- Ảnh và logo đi qua blob cùng nguồn, cùng cách useBlobUrl.ts.

### 6.4 Bản in (`PrintSheet.tsx`, dùng chung cho hộp cấp, sổ, hồ sơ học viên)

Đầu vào: `CertificateView[]` và tên tệp gốc (ví dụ `Giay-chung-nhan-K12-2026-12-20`).

| Bước | Hiện |
|---|---|
| Đang vẽ | "Đang vẽ 3/8 · Lê Thị Mai…", thanh tiến độ, nút "Dừng" |
| Lỗi vẽ một người | dòng đỏ "Không vẽ được giấy của X" kèm "Thử lại người này". Người khác vẫn xong |
| Xong | dải xanh. Nếu vừa cấp: "Đã cấp 7 giấy chứng nhận (CC-2026-0008 → 0014). Tệp PDF: 8 trang A4 ngang, mỗi học viên một trang." |

Lựa chọn khi xong, như ảnh luong-a-in-1440.png:
- **Máy tính và máy tính bảng (> 640):**
  1. "In ngay": "Mở hộp in của máy. Chọn khổ A4, hướng Ngang, lề Không." Chạy theo 7.4.
  2. "Tải PDF ({n} trang)", kèm tên tệp.
  3. Danh sách từng người, mỗi người có nút "Tải ảnh" (PNG 1754×1240, tên `GCN-CC-2026-0007-le-thi-mai.png`).
  4. Nếu máy có chia sẻ tệp (`navigator.canShare`): thêm "Chia sẻ PDF".
- **Điện thoại (≤ 640):** như ảnh luong-a-m-in-390.png.
  1. Nút chính "Chia sẻ PDF (In / Zalo / Lưu)". Chạy theo 7.3.
  2. "Tải PDF". Máy không có chia sẻ tệp thì đây là nút chính.
  3. Từng người "Lưu ảnh": chia sẻ PNG nếu được, ngược lại tải về.
  4. **Không** có "In ngay". Safari iPhone in sai khổ ngang (R&D-08 mục 5).

Chân hộp: "Xem sổ giấy chứng nhận" (sang `/{slug}/giay-chung-nhan?lop={classId}`) | "Xong".

### 6.5 Sổ giấy chứng nhận (`RegisterPage.tsx`)

**Đường và điều hướng:**
- Đường `/:orgSlug/giay-chung-nhan`.
- Mục điều hướng mới ngay sau `dao-tao`: `{ key: 'giay-chung-nhan', path: 'giay-chung-nhan', label: 'Giấy chứng nhận', shortLabel: 'Chứng nhận', icon: 'chung-nhan', permission: 'certificates.read', orgKinds: ['ACADEMY'] }`.
- Biểu tượng mới trong navIcons.tsx.
- Thanh dưới trên điện thoại không đổi. Mục mới nằm trong "Thêm".
- Sửa bài AppShell.test.tsx:427 thành `['bang-gia','khach-hang','nhan-su','bao-cao','giay-chung-nhan','mau-thiet-ke','cai-dat']`.

**Màn hình:**
- Đầu trang: "Giấy chứng nhận", dòng phụ "Sổ giấy chứng nhận của trung tâm".
- Hàng lọc: "Năm" (lấy từ `years`, mặc định năm nay), ô tìm "Tìm số hoặc tên học viên" (trễ 300 ms), "Trạng thái" (Tất cả / Hiệu lực / Đã thu hồi).
- `?lop=` trên đường dẫn thì hiện chip "Lớp {tên} ×".

**Máy tính:** bảng.

| Cột | Ghi chú |
|---|---|
| ô chọn | chỉ bản hiệu lực |
| Số | |
| Học viên | |
| Khoá · Lớp | |
| Ngày cấp | |
| Mẫu | |
| Trạng thái | "Hiệu lực" xanh; "Hiệu lực · bản cấp lại dd/mm/yyyy"; "Đã thu hồi" xám, tooltip lý do |
| thao tác | "In lại", menu ⋯ gồm "Cấp lại" và "Thu hồi" (chỉ khi có `certificates.issue`). Bản thu hồi không có thao tác |

- Chọn nhiều thì hiện thanh "In lại ({n})": lấy URL mới bằng `GET /certificates?ids=` từng lô 50, rồi mở `PrintSheet`.
- Phân trang 50 dòng.

**Máy tính bảng:** bỏ cột Mẫu, gộp Khoá · Lớp vào dưới tên.

**Điện thoại:** mỗi bản một thẻ, kiểu `m-cards` của bản mẫu luong-a-so-390.png. Thao tác nằm ở hàng nút cuối thẻ.

**Hộp "Cấp lại giấy chứng nhận CC-2026-0011"** (`ReissueDialog.tsx`):
- Ô "Lý do": chọn trong `REISSUE_REASONS`. Chọn "Khác" thì hiện ô chữ, bắt buộc, ≤ 500.
- Ô "Tên in trên giấy": điền sẵn `customer.fullName` hiện hành. Ghi chú: "Tên trong hồ sơ học viên không đổi theo — sửa hồ sơ nếu tên ở đó cũng sai."
- Ô "Mẫu" (mặc định mẫu cũ) và ô "Phông".
- Dải xám: "Bản CC-2026-0011 chuyển 'Đã thu hồi' (vẫn nằm trong sổ). Bản mới **giữ số CC-2026-0011**, in thêm 'Bản cấp lại {hôm nay}'."
- Nút "Cấp lại và in". Gửi đường 5 kèm `Idempotency-Key`, thành công thì mở `PrintSheet` với một bản.

**Hộp "Thu hồi"** (`RevokeDialog.tsx`, ConfirmDialog loại nguy hiểm):
- Câu: "Thu hồi CC-2026-0011? Số này không dùng lại. Giấy đã in coi như hết giá trị."
- Ô lý do bắt buộc, ≤ 500.

### 6.6 Hồ sơ học viên: nút "In lại" (`CustomerCertificatesCard.tsx`)

- Chèn vào `CustomerDetail.tsx` sau `CustomerContractsCard`.
- Chỉ khi tổ chức ACADEMY và có `certificates.read`. `CustomerPerms` thêm `certRead`.
- Gọi `GET /certificates?customerId=`. **0 bản thì ẩn thẻ.**
- Mỗi dòng: số, "{khoá} · {lớp}", ngày cấp, trạng thái, nút "In lại" (chỉ bản hiệu lực) mở `PrintSheet` một bản.
- Liên kết cuối thẻ "Xem trong sổ".

### 6.7 Người ký ở Hồ sơ thương hiệu (`CertificateSignerCard.tsx`)

- Chèn vào `BrandProfilePage.tsx`, chỉ với tổ chức ACADEMY.
- Thẻ "Giấy chứng nhận": "Tên Giám đốc (chỗ ký thứ hai)" và "Chức danh" (gợi ý "Giám đốc trung tâm"). Nút "Lưu" gọi đường 8.
- Không có `org.update` thì chỉ đọc.
- Chưa có hồ sơ: "Lưu hồ sơ thương hiệu trước".
- Không in sẵn ảnh chữ ký hay con dấu. Ghi chú nhỏ: "Giấy in ra để trống chỗ ký tay và đóng dấu."

---

## 7. In và làm PDF (kỹ thuật)

### 7.1 Dựng tham số (`features/certificates/frame.ts`)

```ts
export function certificateFrameQuery(v: {
  templateCode: string; studentName: string | null; courseName: string; className: string;
  instructorName: string | null; signerName: string | null; signerTitle: string | null; brandName: string;
  code: string | null; issuedOn: string | null; reissuedOn: string | null; fontOverride: string | null;
}, blobs: { photo: string | null; logo: string | null }): string
// that=1, xuat=1; ten, khoa, lop, gv, gd, gdcv, th, so; ncap/lai đổi YYYY-MM-DD → dd/mm/yyyy; anh/logo = URL blob;
// ky = số trong fontOverride. Ô null/rỗng KHÔNG đặt tham số (để tệp mẫu để trống, không bịa).
```

### 7.2 Vẽ từng người (`render.ts`)

1. Tải ảnh và logo về blob cùng nguồn, tối đa 4 cùng lúc.
   - Gặp 403 hay URL hết hạn: gọi `GET /certificates?ids=` lấy URL mới, thử lại **một** lần.
   - Vẫn hỏng: vẽ không ảnh. Tệp mẫu tự in chữ cái đầu. Báo dòng vàng "Không tải được ảnh của X — đã in chữ cái đầu".
2. Vẽ **lần lượt từng người**, không song song, để điện thoại khỏi hết bộ nhớ.
   - `renderTemplatePng('/mau/{cc}.html?' + query, '1754x1240')` từ designs/exportPng.ts.
3. Đổi PNG sang JPEG chất lượng 0,92: `createImageBitmap`, vẽ lên canvas 1754×1240 nền trắng, `toBlob('image/jpeg', 0.92)`.
   - **Chỉ giữ `Uint8Array` của JPEG** cho PDF.
   - PNG giữ lại để "Tải ảnh" là blob URL, thu hồi khi đóng hộp.
4. Dừng giữa chừng thì bỏ phần đã vẽ.

### 7.3 PDF và Chia sẻ (`pdf.ts`, `share.ts`)

```ts
const { PDFDocument } = await import('pdf-lib');  // tải động: tệp riêng, chỉ tải khi in
const pdf = await PDFDocument.create();
pdf.setTitle(`Giấy chứng nhận — ${className}`); pdf.setCreator('Makeup Pro');
for (const jpg of jpegs) {
  const img = await pdf.embedJpg(jpg);
  const page = pdf.addPage([CERTIFICATE_PAGE_PT.width, CERTIFICATE_PAGE_PT.height]);
  page.drawImage(img, { x: 0, y: 0, width: CERTIFICATE_PAGE_PT.width, height: CERTIFICATE_PAGE_PT.height });
}
const bytes = await pdf.save();
```

Chia sẻ:
- **Điều kiện sống còn:** `navigator.share` phải được gọi **ngay trong** hàm bấm, không có `await` nào đứng trước.
  - Safari iPhone chỉ cho mở bảng Chia sẻ trong lượt bấm của người dùng.
  - Làm PDF mất vài giây sẽ làm mất lượt bấm, và share báo `NotAllowedError`.
  - Vì vậy PDF phải làm **xong trước** (bước "Đang vẽ"). Nút "Chia sẻ PDF" chỉ hiện khi tệp đã sẵn.
- Cách gọi:
  ```ts
  const file = new File([bytes], `${base}.pdf`, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], title: 'Giấy chứng nhận' })
  ```
  - `AbortError` (người dùng tự đóng): im lặng.
  - `NotAllowedError` hay lỗi khác: hiện "Không mở được bảng Chia sẻ — bấm Tải PDF".
- Không có `canShare`: chỉ hiện "Tải PDF" (`downloadBlob`).

Kích thước tệp: khoảng 250–450 KB một trang JPEG, lớp 30 người khoảng 8–14 MB. Lớp trên 60 người thì dải vàng "Tệp lớn (~{x} MB), vẽ có thể mất vài phút".

### 7.4 In ngay trên máy tính (`PrintArea.tsx` + `certificates.css`)

- `PrintArea` gắn **thẳng vào `document.body`** bằng `createPortal`. Đây là bài học contracts.css: không in từ trong lớp phủ fixed.
- Mỗi người một `<div class="gcn-print-page"><img src={pngBlobUrl}></div>`.
- Trước khi gọi `window.print()`, chờ `img.decode()` cho mọi ảnh. Gỡ ở sự kiện `afterprint`.

```css
.gcn-print-root { display: none; }
@page gcn { size: A4 landscape; margin: 0; }
@media print {
  html:has(.gcn-print-root), body:has(.gcn-print-root) { height: auto !important; overflow: visible !important; background: #fff !important; }
  body:has(.gcn-print-root) > :not(.gcn-print-root) { display: none !important; }
  .gcn-print-root { display: block !important; position: static !important; }
  .gcn-print-page { page: gcn; width: 297mm; height: 209.5mm; overflow: hidden; break-after: page; break-inside: avoid; }
  .gcn-print-page:last-child { break-after: auto; }
  .gcn-print-page img { display: block; width: 297mm; height: 209.5mm; object-fit: fill; }
}
```

Chiều cao 209,5 mm (không phải 210) để Chrome không đẻ thêm trang trắng do làm tròn. Bài đếm trang (mục 9.3) là trọng tài.

### 7.5 Tên tệp

- PDF: `Giay-chung-nhan-{lop-khong-dau}-{issuedOn}.pdf`. In từ sổ, nhiều lớp: `Giay-chung-nhan-{yyyy-mm-dd hôm nay}.pdf`.
- PNG: `GCN-{code}-{ten-khong-dau}.png`.
- Bỏ dấu tiếng Việt bằng `normalize('NFD')`, đổi "đ" thành "d". Chỉ giữ `[a-z0-9-]`.

---

## 8. Món của người khác (thư viện, giấy phép, kích thước)

Đo ngày 19/10/2026 bằng `npm view` và `npm pack`, tệp nằm trong thư mục nháp của phiên.

| Món | Bản | Giấy phép | Kích thước | Dùng ở đâu | Ghi chú |
|---|---|---|---|---|---|
| **pdf-lib** (mới) | **1.17.1** (ghi đúng số, không dùng `^`) | MIT | `dist/pdf-lib.min.js` 525 KB, gzip **207 KB**. Gói giải nén 19 MB, phần lớn là bản đồ nguồn | Ghép JPEG thành PDF trong trình duyệt | Phát hành lần cuối 11/2021: ổn định nhưng không còn bảo trì tích cực. **Tải động**: tách tệp riêng, không vào tệp vào. Kiểm bằng `pnpm build`: tên tệp pdf-lib không nằm trong `index-*.js` |
| ↳ @pdf-lib/standard-fonts | 1.0.0 | MIT | (trong số trên) | phụ thuộc của pdf-lib | |
| ↳ @pdf-lib/upng | 1.0.1 | MIT | | phụ thuộc | |
| ↳ pako | 1.0.x (pdf-lib đòi `^1.0.11`) | MIT AND Zlib | | phụ thuộc (nén) | |
| ↳ tslib | 1.x (`^1.11.1`) | 0BSD | | phụ thuộc | |
| html-to-image | 1.11.13 (**đã có**, public/mau/chung/html-to-image.js) | MIT, tệp giấy phép ở chung/LICENSE-html-to-image.txt | – | Chụp mẫu thành PNG | Không thêm gì |
| Phông Send Flowers, Whisper, Oooh Baby, Waterfall, Playfair Display, Cormorant Garamond, Montserrat | **đã có** ở public/mau/phong | SIL OFL 1.1, tệp OFL-*.txt cùng thư mục | – | 10 mẫu | Không thêm tệp phông |

**Phương án dự phòng nếu không dùng pdf-lib:** tự viết bộ ghi PDF chỉ chứa ảnh JPEG (DCTDecode), khoảng 120 dòng, 0 phụ thuộc. Không chọn đợt này, vì tự viết bảng xref dễ sai mà không ai bắt. Chỉ cân nhắc khi bài in thật cho thấy pdf-lib có lỗi.

Kho chưa có tài liệu ghi món của người khác (đã tìm trong docs/: không thấy). Gói G0 tạo `docs/GHI-CHEP-MON-CUA-NGUOI-KHAC.md` từ bảng trên, cộng các món đang có (html-to-image, qrcode.js ở public/mau/chung, phông OFL). Bản vẽ này chỉ được ghi trong docs/rnd/ nên không tự tạo tệp đó.

---

## 9. Bài thử bắt buộc

Luật chung:
- Cửa gác nào chưa từng chuyển đỏ thì chưa được tin (sổ lỗi 2, 7).
- Bài đua đếm riêng từng kết cục: thắng / thua đúng 409 / lỗi khác. "Lỗi khác" phải bằng 0 (sổ lỗi 18).
- `pnpm test` của máy chủ chạy kiểm tra kiểu trước (sổ lỗi 9).
- "Xong" gồm cả `pnpm build` của api và web (sổ lỗi 1).

### 9.1 Máy chủ (`apps/api/test/`)

**`giay-chung-nhan.test.ts`** (qua API):

| # | Ca | Kỳ vọng |
|---|---|---|
| S1 | Tổ chức không ACADEMY gọi 6 đường certificates | 403 `ACADEMY_REQUIRED` cả 6 |
| S2 | Quyền: quản lý cấp được; lễ tân, giảng viên đọc được nhưng cấp ra 403; kế toán, thợ makeup đọc ra 403 | đúng từng ô của bảng 3.1 |
| S3 | Lớp kết thúc ngày mai | 409 `CLASS_NOT_ENDED`, `details.endDate` đúng |
| S4 | Lớp kết thúc **hôm nay** theo múi giờ tổ chức | cấp được |
| S5 | `issuedOn` trước endDate / sau hôm nay | 400 path `issuedOn` |
| S6 | Số: 3 người | `CC-YYYY-0001..0003` **theo thứ tự ghi danh** dù gửi ngược thứ tự |
| S6b | Lần cấp sau | tiếp `0004` |
| S6c | Ngày cấp năm sau | `CC-<năm sau>-0001` |
| S6d | Tổ chức khác | đếm độc lập |
| S7 | Gửi lại cùng `Idempotency-Key` | cùng phản hồi, số dòng không đổi |
| S7b | Khoá khác, cùng học viên | `existingCount` = số người, không có số mới |
| S8 | Ghi danh đã huỷ; ghi danh lớp khác; ghi danh tổ chức khác; mã bịa | 400. Ba trường hợp cuối có **lời giống hệt** |
| S9 | Học viên còn nợ | 201, `debtWarnings` có `debt`. Người thiếu quyền tiền: `debt: null`, `contract.total/paid/debt` null ở đường 1 |
| S10 | Đổi tên khách, khoá, lớp, giảng viên, Giám đốc sau khi cấp | GET đường 4 trả **y cũ** |
| S11 | Khách chưa có ảnh | `photo: null` |
| S11b | Ảnh xoá mềm sau khi cấp | `photo: null`, không lỗi |
| S12 | Cấp lại | `code` giữ nguyên, `reissueNo 1`, `reissuedOn` = hôm nay, bản cũ REVOKED có lý do, `studentName` mới. Cấp lại lần 2 từ bản mới ra `reissueNo 2` |
| S12b | Cấp lại bản đã thu hồi | 409 `CERTIFICATE_REVOKED` kèm `replacedById` |
| S13 | Thu hồi | lý do bắt buộc (400 khi thiếu); lần 2 ra 409; sau đó cấp hàng loạt cho người này nhận **số mới** |
| S14 | Sổ | lọc `year`, `q` (số và tên), `classId`, `customerId`, `status`, `ids` (> 50 thì 400); phân trang; `years` đúng |
| S15 | Nhật ký | đủ `certificate.issued` / `revoked` / `reissued`. Cài lỗi ném giữa transaction: 0 giấy, 0 nhật ký |
| S16 | Người ký | PUT chưa có hồ sơ ra 409; có hồ sơ thì lưu; GET /profile **không** có `certSigner*`; PUT /profile sau đó **không xoá** người ký; người cấp chụp đúng tên |
| S17 | Mẫu `cc-99`, `shd-01` | 400 path `templateCode` |
| S18 | `enrollmentIds` rỗng / trùng / 501 phần tử | 400 |
| S19 | Đồng bộ vai trò: tổ chức cũ có vai trò quản lý thiếu 2 quyền, chạy `syncSystemRoles` | đủ quyền, chạy lần 2 không đổi (bổ sung assert vào bài có sẵn bằng tệp mới, không sửa system-roles.test.ts) |

**`giay-chung-nhan-database.test.ts`** (ghi thẳng database bằng `$executeRaw`, đi vòng qua máy chủ, sổ lỗi 24):
- Mỗi ca dưới đây phải **bị chặn**, đồng thời một dòng đúng tương ứng phải **lọt** (vế GIỮ).
- **Cột cho phép NULL nào trong CHECK cũng có ca ghi NULL thẳng.**

| Nhóm | Ca phải bị chặn |
|---|---|
| Số | `code` không khớp `year` + `seq`; `year` khác năm `issued_on`; `seq = 0`; seq 10000 mà code cắt còn 4 chữ số |
| Trạng thái | REVOKED với `revoke_reason` NULL; REVOKED với lý do `'   '`; REVOKED với `revoked_by_id` NULL; REVOKED với `revoked_at` NULL; ISSUED có `revoked_at` |
| Cấp lại | `reissue_no 1` + `replaces_id` NULL; `reissue_no 1` + `reissued_on` NULL; `reissue_no 0` có `replaces_id`; `reissued_on < issued_on` |
| Nền | có `background_file_id`, `background_style` NULL |
| Mẫu | `template_code 'shd-01'`; `font_override 'ky-9'` |
| Chữ | `student_name '  '`; `instructor_name ''` |
| Duy nhất | 2 bản ISSUED cùng ghi danh; 2 bản ISSUED cùng (tổ chức, năm, seq), khác ghi danh |
| Khoá ngoại | cấp lại trỏ bản của ghi danh khác; trỏ bản khác số; ghi danh của lớp khác (khoá 4 cột); khách khác; tệp ảnh của tổ chức khác |
| Trigger | UPDATE đổi `student_name`; UPDATE REVOKED về ISSUED; UPDATE bản đã thu hồi; DELETE; `issued_on < end_date`; `issued_on` = ngày mai theo múi giờ tổ chức; lớp CANCELLED; ghi danh CANCELLED; cấp lại từ bản còn ISSUED; `reissue_no` nhảy 2 |

**`giay-chung-nhan-dua.test.ts`** (10 lượt mỗi ca, đếm kết cục):

| Ca | Kỳ vọng |
|---|---|
| Hai lệnh cấp hàng loạt cùng lớp, cùng học viên, khác khoá, chạy cùng lúc | cả hai 201; database đúng N bản; số không trùng; "lỗi khác" = 0 |
| Hai lớp khác nhau cấp cùng lúc | mọi `seq` duy nhất và liền nhau `1..N` |
| Cấp lại và thu hồi cùng một bản cùng lúc | một bên thắng, bên kia 409; "lỗi khác" = 0 |
| Cấp hàng loạt và cấp lại trên cùng ghi danh cùng lúc | "lỗi khác" = 0; luôn đúng 1 bản ISSUED |

### 9.2 Cửa gác (`gate.ts`, `gate-samples.ts`, `gate-mutants.test.ts`)

Dựng thêm trong `setupOrg`, sau phần khoá và lớp:

```ts
// Lớp đã kết thúc + 2 học viên đã ghi danh (hợp đồng khoá học XÁC NHẬN) + 1 giấy chứng nhận.
const endedClassId = await post(app, owner, `${o}/courses/${courseId}/classes`, { name: `K0 ${label}`, startDate: '2026-01-05', endDate: '2026-03-30', weekdays: [2] });
const customer2Id = await post(app, owner, `${o}/customers`, { fullName: `Học viên hai ${label}` });
// mỗi khách một hợp đồng COURSE lines [{ kind: 'COURSE', courseClassId: endedClassId }] → POST …/status { to: 'CONFIRMED' }
// enrollmentId, enrollment2Id ← GET /classes/:endedClassId/enrollments
const certificateId = (await postBody(app, owner, `${o}/classes/${endedClassId}/certificates`,
  { enrollmentIds: [enrollmentId], templateCode: 'cc-01', issuedOn: '2026-03-30' })).items[0].id;
```

Thêm vào `ids`: `endedClassId, customer2Id, enrollmentId, enrollment2Id, certificateId`.

`SAMPLES`:

```ts
'POST /orgs/:orgId/classes/:classId/certificates': (o) => ({ enrollmentIds: [o.ids.enrollment2Id], templateCode: 'cc-01', issuedOn: '2026-03-30' }),
'POST /orgs/:orgId/certificates/:certificateId/reissue': () => ({ reason: 'Thử cửa gác' }),
'POST /orgs/:orgId/certificates/:certificateId/revoke': () => ({ reason: 'Thử cửa gác' }),
'PUT /orgs/:orgId/profile/certificate': () => ({ signerName: 'Tên thử', signerTitle: null }),
```

`REF_SAMPLES`:

```ts
'GET /orgs/:orgId/certificates': [(o) => ({ classId: o.ids.endedClassId, customerId: o.ids.customerId }), (o) => ({ ids: o.ids.certificateId })],
```

`REF_VARIANTS`, cho đường cấp trên lớp **đã kết thúc**:

```ts
'POST /orgs/:orgId/classes/:classId/certificates': [{ pathIds: (o) => ({ classId: o.ids.endedClassId }),
  samples: [(o) => ({ enrollmentIds: [o.ids.enrollment2Id], templateCode: 'cc-01', issuedOn: '2026-03-30' })] }],
```

Yêu cầu:
- Cả 10 phép xanh 100%, mẫu số tăng đúng theo số đường mới. Ghi rõ mẫu số trước và sau (sổ lỗi 15).
- Phép GIỮ: 4 POST và 1 PUT với thân rỗng phải ra 400. 3 GET ra 200: đường 1 với lớp chưa kết thúc vẫn 200.

Đột biến mới trong `gate-mutants.test.ts`:

| # | Cài lỗi | Phép phải đỏ |
|---|---|---|
| 15 | `GET /certificates/:certificateId` tra chỉ theo id | crossId |
| 16 | Cấp hàng loạt tra ghi danh quên lọc tổ chức (nhận `enrollmentIds` của B) | crossRef |
| 17 | `GET /certificates` lọc `customerId` quên điều kiện tổ chức | crossRef hoặc leak |

### 9.3 Web

| Tệp | Ca |
|---|---|
| `courses/CoursesPage.test.tsx` (thêm ca) | Lớp chưa kết thúc: nút xám, tooltip đúng chữ. Đã kết thúc + quyền: nút chính, Ghi danh ẩn. Không quyền: không nút. Lớp huỷ: không nút |
| `certificates/IssueDialog.test.tsx` | Tích sẵn mọi ACTIVE trừ "đã thu hồi chưa cấp lại". Dòng đã cấp hiện số. Nhãn nợ chỉ khi `moneyVisible`. Đếm "7 cấp mới + 1 in lại". Hộp xác nhận có dải số. **Bấm lại sau lỗi mạng dùng lại cùng Idempotency-Key**. Đổi mẫu thì khoá mới. 409 `CLASS_NOT_ENDED` hiện đúng lời. 0 người mới thì không gọi POST. Điện thoại: hai bước Segmented |
| `certificates/frame.test.ts` | Ngày đổi `dd/mm/yyyy`; `lai` chỉ khi cấp lại; ô null không có tham số; `ky` |
| `certificates/pdf.test.ts` | 5 JPEG ra 5 trang, mỗi trang 841,89 × 595,28 (đọc lại bằng `PDFDocument.load`) |
| `certificates/share.test.ts` | Không có `canShare` thì chỉ có Tải PDF. `AbortError` im lặng. **`navigator.share` được gọi đồng bộ trong lượt bấm**: giả lập share ghi lại cờ "đang trong lượt bấm", kiểm bằng `fireEvent.click` mà không chờ |
| `certificates/certificates-print-css.test.ts` | Như contracts-print-css.test.ts: có `@page gcn` A4 landscape margin 0; ẩn mọi con khác của body; `.gcn-print-page` có `break-after: page`; không có `position: fixed` trong khối in |
| `certificates/PrintSheet.pdf.test.ts` (Chromium thật, như ContractPrint.pdf.test.ts; thiếu Chromium thì **đỏ**) | Trang thử `__in-thu__/index.html` vẽ **5 học viên** bằng mẫu **thật** cc-01 … cc-10 (Vite phục vụ public/mau), qua đúng `render.ts` + `pdf.ts`: **số trang PDF = 5**, khổ ngang, cho cả 10 mẫu. Đường "In ngay": `page.pdf()` của vùng in 5 ảnh ra **đúng 5 trang** A4 ngang, không trang trắng thừa. Có 1 người tên dài và 1 người không ảnh |
| `certificates/RegisterPage.test.tsx` | Lọc, chip lớp, chọn nhiều + In lại, hộp cấp lại điền sẵn tên hiện hành, thu hồi bắt lý do, ẩn ⋯ khi thiếu `certificates.issue` |
| `customers/…test.tsx` (tệp mới) | Thẻ ẩn khi 0 bản; In lại chỉ ở bản hiệu lực |
| `brand/…test.tsx` (tệp mới) | Thẻ người ký chỉ ở ACADEMY; chỉ đọc khi thiếu `org.update`; 409 `PROFILE_REQUIRED` hiện lời |
| `layout/AppShell.test.tsx` | Mục mới đúng chỗ, đúng quyền, chỉ ACADEMY |
| `api/certificates.test.ts` + `api/khop-chung-nhan.test.ts` | Từng hàm gọi đúng đường, phương thức, Idempotency-Key. Khớp hai đầu: kiểu `CertificateView`, `ClassCertificateRoster` so với phản hồi máy chủ thật (napKieu trỏ vào api/certificates.ts) |

**Mẫu** (gói T1, `designs/mau-cc.test.ts` + Playwright):

| # | Kiểm |
|---|---|
| T1-1 | 10 tệp có đủ `data-f` của 12 ô khai trong DESIGN_TEMPLATES |
| T1-2 | Không còn chuỗi "chứng chỉ" (không phân biệt hoa thường). Tiêu đề "GIẤY CHỨNG NHẬN" một dòng, tràn ≤ 1 px |
| T1-3 | `that=1` với tên "Tôn Nữ Hoàng Bảo Ngọc Phương Thảo": tên tràn ≤ 1 px. Không ảnh: hiện chữ cái đầu. Không logo: ô logo ẩn. `lop == khoa`: không có "· Lớp" |
| T1-4 | `MAU_XUAT_PNG` ra đúng 1754×1240. So ảnh chụp Playwright `deviceScaleFactor = 1754/1123`: sai khác trung bình ≤ 8/255 |
| T1-5 | Bộ kiểm danh mục: `DESIGN_TEMPLATES` loại CERTIFICATE đúng 10 mã = `CERTIFICATE_TEMPLATE_CODES`, `sizes = ['1754x1240']`, `frameShape 'circle'`. Sửa các con số trong design-templates.test.ts: 27 → 37 mẫu, tổng khung ảnh 34 → 44 |

Chụp ảnh 3 khổ (1440, 1024, 390) cho: hộp cấp (bước học viên, bước xem trước), xác nhận, bản in, sổ, thẻ hồ sơ, thẻ người ký. Đặt ở thư mục báo cáo của gói. Người chấm mở xem từng ảnh.

### 9.4 Đột biến bắt buộc (người làm phá thử, thợ chấm phá lại độc lập)

Phá rồi chạy lại. Bài ghi ở cột phải phải **đỏ**. Sửa lại thì xanh. Ghi số đo vào báo cáo.
- Database thử dùng một lần: `makeup_test_dotbien_<ngẫu nhiên>`, áp bằng `db:deploy-to`.
- **Không** đụng `makeup_dev`.

| # | Phá | Phải đỏ |
|---|---|---|
| M1 | Bỏ kiểm "lớp đã kết thúc" ở máy chủ | S3 (ra 500 do trigger, không phải 409) |
| M2 | Lấy số bằng `SELECT max(seq)+1`, không qua bộ đếm | bài đua ca 2 ("lỗi khác" > 0 hoặc trùng số) |
| M3 | Bỏ `lockClass` ở cấp hàng loạt | bài đua ca 1 |
| M4 | Database thử bỏ chỉ mục `certificates_one_issued_per_enrollment` | bài database "2 bản ISSUED cùng ghi danh" |
| M5 | Database thử viết CHECK cấp lại không có `IS NOT NULL` ở vế 2 | bài database ca NULL |
| M6 | `GET /certificates` quên `organizationId` | cửa gác leak |
| M7 | Cấp lại lấy số mới | S12 |
| M8 | Thêm `certSignerName: null` vào `toData` của PUT /profile | S16 |
| M9 | Bỏ `break-after: page` / đổi `@page` sang portrait | PrintSheet.pdf.test + print-css.test |
| M10 | `pdf.ts` bỏ trang cuối | pdf.test + PrintSheet.pdf.test (4 ≠ 5) |
| M11 | Đặt `await` trước `navigator.share` | share.test |
| M12 | Đổi tiêu đề một mẫu về "CHỨNG CHỈ" | T1-2 |
| M13 | Trả `contract.total` cho người thiếu quyền tiền | S9 |

---

## 10. Gói việc theo tệp

Luật:
- Không hai gói **cùng tệp** chạy song song.
- Gói đụng `apps/web/public/mau/**` hay `packages/shared/src/design-templates.ts` **chờ thợ K3 xong** và nộp báo cáo.
- Điều phối chỉ `git add` đúng danh sách tệp trong báo cáo của thợ đã xong (sổ lỗi 6, 23).
- Tắt máy chủ thử theo PID, **không** `pkill -f` (sổ lỗi 21).
- Mỗi gói kết thúc bằng: typecheck, test, build của phần mình. Lệnh và số đo ghi đầu báo cáo.

### 10.1 Danh sách gói

| Gói | Model | Giờ | Chờ | Tệp (chỉ gói này được sửa) |
|---|---|---|---|---|
| **G0** Tra lại trước khi khởi công + ghi món người khác | **Haiku** | 0,5 | – | Chỉ đọc mã. Tạo `docs/GHI-CHEP-MON-CUA-NGUOI-KHAC.md`. Tra lại số dòng ở mục 1 (schema.prisma đang lệch); xác nhận K3 đã xong; thử `pnpm add pdf-lib@1.17.1` chạy được qua proxy trong thư mục nháp; liệt kê migration mới nhất (đã có 160000) |
| **S1a** Database + danh mục quyền | **Opus** | 2,5 | G0 | `apps/api/prisma/schema.prisma`<br>`apps/api/prisma/migrations/20261019150000_giay_chung_nhan/migration.sql`<br>`packages/shared/src/permissions.ts`, `permissions.test.ts`<br>`packages/shared/src/certificates.ts`, `certificates.test.ts`<br>`packages/shared/src/index.ts`<br>`apps/api/test/giay-chung-nhan-database.test.ts` |
| **S1b** Máy chủ: 8 đường + bài thử + cửa gác | **Opus** | 6 | S1a | `apps/api/src/modules/certificates/*` (mới)<br>`apps/api/src/app.ts`<br>`apps/api/src/modules/profile/routes.ts`, `profile/schemas.ts`<br>`apps/api/test/giay-chung-nhan.test.ts`, `giay-chung-nhan-dua.test.ts`, `giay-chung-nhan-vai-tro.test.ts`<br>`apps/api/test/gate.ts`, `gate-samples.ts`, `gate-mutants.test.ts` |
| **T1** 10 mẫu vào app + danh mục | **Sonnet** | 6 | **K3 xong** + S1a (cần `certificates.ts`) | `apps/web/public/mau/cc-01..10.html`<br>`public/mau/chung/cc.js`, `cc.css`, `cc-xuat.js`<br>`public/mau/anh-nho/cc-01..10.jpg`<br>`packages/shared/src/design-templates.ts`, `design-templates.test.ts`<br>`apps/api/src/modules/designs/data.ts` (chỉ dòng KIND_LABEL)<br>`apps/web/src/features/designs/model.ts` (chỉ KIND_LABEL)<br>`apps/web/src/features/designs/mau-20.test.ts` (nếu đỏ vì mẫu mới)<br>`apps/web/src/features/designs/mau-cc.test.ts` (mới) |
| **W2** Web: lớp gọi API + bộ in | **Sonnet** | 6 | S1b + T1 | `apps/web/src/api/certificates.ts`, `certificates.test.ts`, `khop-chung-nhan.test.ts` (mới)<br>`apps/web/src/features/certificates/` gồm `logic.ts`, `frame.ts`, `render.ts`, `pdf.ts`, `share.ts`, `PrintSheet.tsx`, `PrintArea.tsx`, `CertificatePreview.tsx`, `certificates.css`, `__in-thu__/*` và các bài thử tương ứng<br>`apps/web/package.json`, `pnpm-lock.yaml` (thêm `pdf-lib` 1.17.1, **gói duy nhất đổi phụ thuộc**) |
| **W3a** Thẻ lớp + hộp cấp | **Sonnet** | 4 | W2 | `courses/ClassCard.tsx`, `CourseDetail.tsx`, `CoursesPage.tsx`, `logic.ts`, `courses.css`, `CoursesPage.test.tsx`<br>`features/certificates/IssueDialog.tsx`, `IssueDialog.test.tsx` (mới) |
| **W3b** Sổ + điều hướng | **Sonnet** | 4 | W2 | `features/certificates/RegisterPage.tsx`, `ReissueDialog.tsx`, `RevokeDialog.tsx`, `index.tsx`, `RegisterPage.test.tsx` (mới)<br>`apps/web/src/app/routes.tsx`<br>`apps/web/src/layout/nav.ts`, `navIcons.tsx`, `AppShell.test.tsx` |
| **W3c** Hồ sơ học viên + người ký | **Sonnet** | 2,5 | W2 | `customers/CustomerDetail.tsx`, `customers/logic.ts`, `customers/CustomerCertificatesCard.tsx` + test (mới)<br>`brand/BrandProfilePage.tsx`, `brand/CertificateSignerCard.tsx` + test (mới) |
| **C** Chấm độc lập | **Opus** (khác người làm) | 3 | W3a, W3b, W3c | Không sửa mã. Chạy lại toàn bộ trên **một bản đã build**, tách bộ đọc database riêng (sổ lỗi 17, 19). Phá lại M1–M13 theo cách của mình. Xem ảnh 3 khổ |
| **TT** Thử thật | người (anh Chiến) + trợ lý | 3 | C | iPhone (Safari), Android (Chrome), 1–2 máy in (AirPrint, Mopria), gửi PDF qua Zalo. Ghi: hướng ngang đúng không, chữ có nét không, mấy giây cho 8 và 30 người, cỡ tệp |

**Không đụng nhau:**
- W3a, W3b, W3c chạy **song song**. Mỗi gói một tập tệp riêng, cùng chỉ **nhập** từ `features/certificates/` của W2, không sửa tệp của W2.
- `features/certificates/index.tsx` chỉ W3b sửa. W3a nhập `IssueDialog` theo đường dẫn tệp.
- S1b và T1 có thể chạy song song: không chung tệp. `designs/data.ts` chỉ T1 sửa, S1b không chạm.

### 10.2 Thứ tự và tổng giờ

```
G0 ─► S1a ─► S1b ────────────────┐
         └► (chờ K3) T1 ─────────┴─► W2 ─► W3a ┐
                                        ├► W3b ┼─► C ─► TT
                                        └► W3c ┘
```

| Phần | Giờ |
|---|---|
| Thợ (G0 + S1a + S1b + T1 + W2 + W3a + W3b + W3c + C) | 0,5 + 2,5 + 6 + 6 + 6 + 4 + 4 + 2,5 + 3 = **34,5 giờ**, khoảng 9–10 buổi, khớp ước lượng R&D-08 mục 8 |
| Thử thật (TT) | **3 giờ**, cần anh Chiến |
| Đường găng khi chạy song song tối đa | G0 → S1a → S1b (hoặc T1 nếu K3 về muộn) → W2 → W3a → C, khoảng **22 giờ** |

### 10.3 Bước triển khai (ghi vào báo cáo S1a và S1b)

1. `pnpm --filter @makeup/api db:deploy` (bản thật: theo DEPLOYMENT.md).
2. `pnpm --filter @makeup/api db:sync-roles` (bản thật: `db:sync-roles:prod`). Nếu bỏ bước này, quản lý của tổ chức cũ không thấy nút (sổ lỗi 3).
3. Kiểm: `GET /api/v1/openapi.json` có 8 đường mới, kèm `x-permission` đúng.

---

## 11. Cái không làm (đợt này)

- Xếp loại (Giỏi/Khá), mã QR, trang tra cứu công khai.
- In sẵn ảnh chữ ký hay con dấu.
- Luồng B (cấp từ Mẫu thiết kế). Tab "Giấy chứng nhận" trong Mẫu thiết kế.
- Sửa tiêu đề giấy. Tuỳ chọn "ẩn ảnh" cho mẫu 03 và 05. Mẫu khung viên thuốc.
- Bộ nền và khung (R&D-07): chỉ chừa cột và tham số. Thiết kế ở bản vẽ nền.
- Cấp trước ngày kết thúc lớp. Chặn vì nợ.
- Tự thu hồi khi huỷ ghi danh. Giấy đã cấp giữ nguyên, muốn thu hồi thì bấm tay.
- Đếm "x/y đã cấp" trên thẻ lớp.
- Máy chủ vẽ, lưu PDF hoặc PNG. Gửi Zalo tự động. Cổng học viên tự tải giấy.
- Ghi nhật ký số lần in. Tải ảnh cả lớp thành một tệp zip. PDF dạng chữ vector.

## 12. Câu hỏi còn mở cho anh

1. **In lại dùng ảnh lúc cấp** (bản vẽ đang chọn, để in ra y hệt) hay ảnh mới nhất trong hồ sơ? Nếu chọn ảnh lúc cấp, muốn đổi ảnh thì phải Cấp lại (ghi "bản cấp lại").
2. **Lễ tân và Giảng viên được xem sổ và in lại** (không được cấp). Đúng ý anh không?
3. Dòng phụ dưới tiêu đề của cả 10 mẫu là **"Hoàn thành khoá học"**, bỏ chữ "tốt nghiệp". Được không?
4. Tên Giám đốc sửa ở Hồ sơ thương hiệu, **chỉ chủ và quản trị** sửa được (quản lý chỉ cấp). Được không?
5. Cần anh **một buổi thử thật**: iPhone, Android, máy in của studio, gửi Zalo.
6. (Cho điều phối) Đổi tên migration thành `20261019170000_giay_chung_nhan` để đứng sau migration 160000 đã có? Giữ 150000 vẫn chạy được, nhưng phải kiểm `migrate status`.
