# Bản vẽ G — tra lại đầu ca (gói G-H1)

- Ngày kiểm: 25/10/2026. Chỉ đọc, không ghi tệp trong kho, chỉ dùng lệnh git đọc.
- HEAD lúc bắt đầu: `5bedc31`. HEAD lúc kiểm xong: `635998a`. Ba commit WIP giữa chừng (`103e456`, `70543b7`, `635998a`) chỉ đụng `apps/api/test/gate-mutants.test.ts` trong các vùng đã kiểm. Các dòng ghi dưới đây đúng với HEAD `635998a`.
- Lúc kết thúc, cây làm việc có 1 tệp sửa đổi không thuộc vùng kiểm: `apps/web/src/features/certificates/PrintSheet.pdf.test.ts`.
- Giờ git là +0000, giờ Việt Nam là +7. "Từ 19/10" tính theo giờ Việt Nam tức là từ 17:00 UTC ngày 18/10.
- Ký hiệu: ✓ = đúng dòng và đúng nội dung; ~ = đúng nội dung nhưng lệch dòng hoặc thiếu đường dẫn; ✗ = sai dòng, và nội dung đã đổi (ghi rõ).

---

## 1. Đối chiếu bảng mục 1 của bản vẽ G

### 1.1 Tờ in hợp đồng khoá học và luật in

| Bản vẽ ghi | Dòng thật | Trạng thái |
|---|---|---|
| `ContractPrint.tsx:25` props | 25 `export interface ContractPaperProps` | ✓ |
| `:44` tờ giấy | 44 `export function ContractPaper` | ✓ |
| `:48` chỉ in tên tổ chức viết hoa | 48 `p.orgName.toUpperCase()` | ✓ |
| `:113` tách điều khoản, bỏ số đầu dòng | 113 chỉ là lời gọi `paragraphs(t.body)`. Bỏ số đầu dòng nằm ở 114 `replace(/^\d+[.)]\s*/, '')`. Việc tách dòng nằm ở `courseModel.ts:234` (`export function paragraphs`), không nằm trong `ContractPrint.tsx` | ~ lệch dòng, và thiếu tệp `courseModel.ts:234` |
| `:124` chỗ ký | 124 `<div className="ct-paper__sign">` | ✓ |
| `:153` ContractPrintDialog | 153 `export function ContractPrintDialog` | ✓ |
| `:164` nút gọi `window.print()` | 164 `onClick={() => window.print()}`. Nhãn nút không kiểm lại | ✓ dòng |
| `contracts.css:218-221` hộp thoại và tờ trên màn | 218 `.ui-dialog.ct-print-dlg`, 221 `.ct-paper` | ✓ |
| `:245` điện thoại | 245 `.ct-paper { padding: 20px 16px; … }` trong media query | ✓ |
| `:250-256` chú thích N1 | 250 "In: chỉ tờ hợp đồng…", 255 "Chỉ áp khi trang có .ct-print-dlg", 256 `*/` | ✓ |
| `:257` `@page hop-dong` | 257 `@page hop-dong { size: A4; margin: 16mm 15mm; }` | ✓ |
| `:258-279` `@media print` | 258 `@media print {`, luật cuối ở 277 | ✓ |
| `contracts-print-css.test.ts:48-82` | 48 `describe('N1: …')`, 82 đóng khối | ✓ |
| `ContractPrint.pdf.test.ts:122`, `:135` | 122 và 135 là các `it(…)` | ✓ |
| `__in-thu__/main.tsx`, `index.html` | Tồn tại | ✓ |

### 1.2 Màn hợp đồng dịch vụ (`ContractEditor.tsx`)

| Bản vẽ ghi | Dòng thật | Trạng thái |
|---|---|---|
| `:145` component | 145 là dòng trống. `export function ContractEditor` ở 154 | ✗ lệch dòng |
| `:492` `save` | 492 là lệnh focus trong hàm khác. `async function save()` ở 584 | ✗ lệch dòng |
| `:720` thanh nút | 720 là `}`. Thanh nút lưu ("Lưu nháp" / "Lưu" trên điện thoại) ở khoảng 812–830 | ✗ lệch dòng |
| `:774` PageHeader `phoneAction` | 774 là một `.filter(...)` của dòng. PageHeader ở 705 và 867; `phoneAction` ở 868 | ✗ lệch dòng |
| `:782-799` đầu thẻ (Thu tiền, Huỷ) | Nút "Thu tiền" ở 883, 936; "Huỷ hợp đồng" ở 888, 941 (đầu thẻ ở khoảng 880–945) | ✗ lệch dòng |
| Chưa có nút In | Đúng. Không có `ContractPrint` / `printOpen` trong `ContractEditor.tsx` | ✓ nội dung |

### 1.3 Màn hợp đồng khoá học (`CourseContractEditor.tsx`)

| Bản vẽ ghi | Dòng thật | Trạng thái |
|---|---|---|
| `:17` import | 17 `import { ContractPrintDialog, … } from './ContractPrint'` | ✓ |
| `:100` `printOpen` | 100 | ✓ |
| `:433-464` ghép dữ liệu in ở web | 433 "---- Bản in ----", 464 `printDate` | ✓ |
| `:515` nút | 515 `const printButton` | ✓ |
| `:725` `ContractTextsCard` | 725 | ✓ |
| `:786-804` hộp in | 786 `<ContractPrintDialog`, 804 `/>` | ✓ |

### 1.4 Thẻ điều khoản, nháp, mẫu điều khoản

| Bản vẽ ghi | Dòng thật | Trạng thái |
|---|---|---|
| `ContractTexts.tsx:31`, `:48-50`, `:179` | 31 `ContractTextsCardProps`, 48 `ContractTextsCard`, 50 `kinds`, 179 `TextsManager` | ✓ |
| `courseModel.ts:39` `termsTemplateId` | 39 | ✓ |
| `model.ts` không có `termsTemplateId` | 0 kết quả | ✓ |
| `apps/api/src/modules/contracts/schemas.ts:91-95`, `:132-135` | 91–95 là `phone` và `ContractKindKey`. `termsTemplateId` thân tạo ở 109, điều kiện `termsOrTemplate` ở 116–122, thân sửa ở 149. `ContractPatchSchema` ở 135 | ✗ lệch dòng |
| `routes.ts:137-145` | Hàm xử lý mẫu điều khoản ở 130–145 (`checkChosenText` ở 140, 145) | ~ lệch nhẹ |
| `schema.prisma:1262-1288` mẫu điều khoản có phiên bản | Model `ContractText` ở 1424–1453 (`version` ở 1433, `isDefault` ở 1435) | ✗ lệch dòng |
| `texts.ts:85-99`, `:152-171`, `:258-267` | 85 `lockDefaultSlot`, 152 `snapshotTexts`, 258 thứ tự khoá | ✓ |
| Index `contract_texts_one_default`, migration `20261018230000_dao_tao` dòng 525 | 525 | ✓ |

### 1.5 Hợp đồng đã xác nhận, khách, dòng hợp đồng, tiền, lớp học

| Bản vẽ ghi | Dòng thật | Trạng thái |
|---|---|---|
| `schema.prisma:691-698` trigger xác nhận | 691–698 nay là `SurchargeRuleDate`. Trigger `contracts_lock_after_confirm` nằm trong migration `20261018230000_dao_tao` dòng 471–501 (không nằm trong schema) | ✗ sai tệp và dòng. Trigger ✓ ở 471–501 |
| `schema.prisma:388-412` khách | Model `Customer` ở 411–442. Nội dung đúng: có `phone`; chưa có `idNumber`, `address` | ✗ lệch dòng, nội dung ✓ |
| `schema.prisma:728-801` dòng hợp đồng | 728–801 nay là enum và `TravelFee*`. `Contract` ở 798–852, `ContractLine` ở 853–947 | ✗ lệch dòng |
| `present.ts:178-215` `LineView`, `:267`, `:367` | 178 `export interface LineView`, 367 `confirmedAt: true` | ✓ |
| `packages/shared/src/payments.ts:77`, `:126` | 77 `summarizePayments`, 126 `allocateToInstallments` | ✓ |
| `payments/common.ts:82`, `:146-147` | 82 `loadProgress`, 146–147 `phoneHidden` | ✓ |
| `schema.prisma:1152-1225` lớp học | Model `CourseClass` ở 1340–1381 (`weekdays` 1349, `startMinute` 1351). Nội dung ✓ | ✗ lệch dòng |

### 1.6 Hồ sơ thương hiệu, cửa gác, quy ước, điều hướng

| Bản vẽ ghi | Dòng thật | Trạng thái |
|---|---|---|
| `schema.prisma:1075-1112` hồ sơ thương hiệu | 1075–1112 nay nằm trong `StoredFile` và `PaymentInstallment`. `OrganizationProfile` ở 1225–1267 | ✗ lệch dòng |
| `profile/routes.ts:13-37` `toData` | `toData` ở 14, kết thúc 37 | ✓ |
| `profile/routes.ts:67` GET | GET là `defineRoute({ method: 'get', path: '/orgs/:orgId/profile' })` ở 138–140 | ✗ lệch dòng |
| `profile/routes.ts:81` PUT | PUT ở 152–154. Dòng 81 là chú thích về người ký chứng chỉ | ✗ lệch dòng |
| `profile/schemas.ts:81` `ProfileBody` | 81 | ✓ |
| `public.ts:118-130` chọn từng trường | Đường dẫn đầy đủ là `apps/api/src/modules/profile/public.ts`. Khối `profile: { brandName … }` ở 118–130 | ~ thiếu đường dẫn |
| Nội dung "chưa có người đại diện, tài khoản ngân hàng" | Vẫn đúng: không có `representativeName` trong schema | ✓ |
| `apps/api/src/http/route.ts:97-106` (PATCH không được có `.default()`) | Chốt nằm ở 190–197 (`if (def.method === 'patch')`, thông báo "Bỏ .default() trong thân sửa một phần") | ✗ lệch dòng |
| `apps/api/src/http/partial.ts:52` | 52 `fieldsFilledWhenMissing` | ✓ |
| `apps/api/test/gate-partial.ts:122` | 122 `runPartialPatchGate` | ✓ |
| `route.ts:113` chống gửi trùng chỉ cho POST | Chốt nằm ở 211 ("chống gửi trùng chỉ dùng cho POST"). `new-org` ở 93 | ✗ lệch dòng |
| `schema.prisma:542-559` `IdempotencyKey` | Model `IdempotencyKey` ở 571–592 | ✗ lệch dòng |
| `apps/api/test/gate.ts:47-50` (10 phép kiểm) | `GateCheck` ở 47–50. Danh sách phép `GATE_CHECKS` ở 54–69 có **14 phép** (không phải 10). E5 đã xanh 14/14 | ✗ đổi nội dung: 10 → 14 |
| `gate.ts:178-339` fixture | `:178` là `setupOrg` (đúng theo bản vẽ D). Các dòng sau không kiểm lại | ~ |
| `gate.ts:233` không tạo hồ sơ thương hiệu | 233 là `endsAt`. Câu "KHÔNG tạo sẵn hồ sơ thương hiệu" ở 253 | ✗ lệch dòng, nội dung ✓ |
| `gate-samples.ts:7` `SAMPLES` | 7 | ✓ |
| `gate-samples.ts:79`, `:231`, `:252` (REF_SAMPLES, REF_VARIANTS, PARTIAL_SAMPLES) | 79 là hàm `packageLine`. `REF_SAMPLES` ở 111, `REF_VARIANTS` ở 296, `PARTIAL_SAMPLES` ở 324 | ✗ lệch dòng |
| `gate-mutants.test.ts:35-250`, "13 đột biến" | Dòng 35 `createApp` ✓. Số đột biến thực tế là **25** (`it('Đột biến …')`: 1–22, D1, D2, D3), đếm ở cả `5bedc31` và `635998a`. Đột biến 12 ở 250 | ✗ đổi nội dung: 13 → 25 |
| `nav.ts:31` luật hiện, `:99-107` | 31 là kiểu `icon: NavIconName`. Mục Cài đặt ở 112–123: `permission: 'org.update'` ở 117; con "Hồ sơ thương hiệu" ở 119; con "Cổng học viên" (`org.update`, tạm) ở 121 | ✗ lệch dòng, và đổi nội dung (có thêm con) |
| `routes.tsx:98-99` điều hướng Cài đặt | 98–99 là route `dao-tao`. Route Cài đặt ở 102–105: `cai-dat` (Navigate tới `thuong-hieu`), `cai-dat/thuong-hieu`, `cai-dat/cong-hoc-vien`, `cai-dat/cai-app` | ✗ sai dòng |
| `docs/SO-LOI-DA-DO.md` lỗi 24 (chốt CHECK cho qua NULL) | `## 24.` ở dòng 159. Lỗi 25 ở 166 | ✓ |
| `docs/NHAT-KY-QUYET-DINH-THAY.md:95` | 95 có dòng "19/10 chiều \| Mẫu in hợp đồng (R&D-09)" | ✓ |
| `ban-in.js:22-44` (KHOI), `:46` (MAC_DINH_TAT), `:66-91` (đọc số tiền) | 22, 44, 46 khớp. `bangChu` ở 67 | ✓ |
| "Đọc số tiền thành chữ chưa có trong sản phẩm" | Đúng: không có hàm đọc số tiền trong `packages/shared`, `apps/web/src`, `apps/api/src` (các khớp "bằng chữ" chỉ là chú thích hoặc thông báo) | ✓ |

### 1.7 Phông

| Bản vẽ ghi | Thực tế | Trạng thái |
|---|---|---|
| Be Vietnam Pro ở `apps/web/public/fonts/` | Có `apps/web/public/fonts/be-vietnam-pro/` (kèm `OFL.txt`, `NGUON.txt`) | ✓ |
| Cormorant Garamond ở `apps/web/public/mau/phong/` | Có `CormorantGaramond-VF.ttf`, `CormorantGaramond-Italic-VF.ttf`, `OFL-cormorantgaramond.txt` (OFL 1.1, theo tệp). Được theo dõi bởi git | ✓ |
| **"Lora chưa có trong app (R&D có ở `docs/rnd/v9-mau-in/phong/`)"** | **SAI.** Đã có ở `apps/web/public/mau/phong/ss-album/lora/`: `Lora-VF.woff2`, `Lora-Italic-VF.woff2`, `OFL.txt`. Đăng ký trong `ss-album/ss-album.css` dòng 50–52 với họ **'SSA Lora'**. Theo dõi bởi git (commit `f1c307e`) | ✗ đổi nội dung |

**Hệ quả với G-W2:** bản vẽ G định tạo `apps/web/public/fonts/lora/**`, như vậy có hai bản Lora. Điều phối cần quyết: dùng lại `ss-album/lora` (họ `SSA Lora`) hoặc đặt bản thứ hai.

---

## 2. Mọi chỗ nhập / dùng `ContractPrint`, `ct-paper`, `ct-print-dlg`, `__in-thu__`, `@page hop-dong` trong `apps/web/src`

| Tệp:dòng | Dùng gì |
|---|---|
| `apps/web/src/features/contracts/ContractPrint.tsx:4` | import `paragraphs` từ `courseModel` |
| `ContractPrint.tsx:25`, `:44`, `:46-47`, `:48`, `:50-51`, `:57`, `:74-80`, `:86-94`, `:100`, `:108-114`, `:124`, `:140`, `:147`, `:153`, `:160`, `:164`, `:170-171` | định nghĩa `ContractPaper`, `ContractPrintDialog`; class `ct-paper*`, `ct-print-dlg`; nút `window.print()` |
| `apps/web/src/features/contracts/CourseContractEditor.tsx:17` | import `ContractPrintDialog` |
| `CourseContractEditor.tsx:100` | state `printOpen` |
| `CourseContractEditor.tsx:433-464` | ghép dữ liệu in ở web |
| `CourseContractEditor.tsx:515` | `printButton` |
| `CourseContractEditor.tsx:786-804` | `<ContractPrintDialog>` |
| `apps/web/src/features/contracts/__in-thu__/main.tsx:1-7`, `:37` | import `../ContractPrint`, dựng `<ContractPrintDialog>` |
| `apps/web/src/features/contracts/__in-thu__/index.html:9` | chú thích bài `ContractPrint.pdf.test.ts` |
| `apps/web/src/features/contracts/ContractPrint.pdf.test.ts:9`, `:20`, `:61`, `:89`, `:103-104`, `:108-109`, `:116`, `:122`, `:135` | `HARNESS` trỏ tới `__in-thu__`; `.ct-paper`, `.ct-print-dlg`, `.ct-paper__ol`, `.ct-paper__sign`; `preferCSSPageSize` theo `@page hop-dong` |
| `apps/web/src/features/contracts/contracts-print-css.test.ts:5-6`, `:48-82` (`:49`, `:51`, `:59`, `:64-65`, `:70-73`, `:78-81`) | bài kiểm luật in: `@page hop-dong`, `.ct-print-dlg`, `.ct-paper`, các khối `break-inside` |
| `apps/web/src/features/contracts/contracts.css:218-221`, `:245`, `:250-257`, `:258-279` | toàn bộ luật `.ct-paper*`, `.ct-print-dlg`, `@page hop-dong` |
| `apps/web/src/ui/staffName.test.ts:163`, `:224` | biểu thức loại trừ `__in-thu__\|__xem-thu__` khi quét tệp `.tsx`. Không dùng `ContractPrint` |
| `apps/web/src/features/certificates/PrintSheet.pdf.test.ts:12-13`, `:21` | dùng `__in-thu__` riêng của gói F (chứng chỉ). Chú thích nhắc `ContractPrint.pdf.test.ts`. Không liên quan đến G-W5 |

Ghi chú:
- Chỗ G-W5 phải xoá hoặc gỡ: `ContractPrint.tsx`, `ContractPrint.pdf.test.ts`, `contracts-print-css.test.ts`, `__in-thu__/`, toàn bộ luật ở `contracts.css:218-279`, và các import/nút ở `CourseContractEditor.tsx` (17, 100, 515, 786–804).
- `ContractEditor.tsx` (màn dịch vụ) không có chỗ nào dùng in hiện nay. G-W5 phải thêm mới.
- Không có chỗ nào ngoài `features/contracts` dùng các ký hiệu này trong `apps/web/src` (trừ bộ lọc ở `staffName.test.ts` và `certificates`).

---

## 3. Bản vẽ D đã đụng tệp nào trong `apps/web/src/features/contracts/**`

### 3.1 Commit có nhãn D (xác nhận từ thông điệp commit)

| Commit | Giờ (UTC) | Nhãn trong thông điệp | Tệp |
|---|---|---|---|
| `0925f41` | 19/10 21:13 | `F-S1a, D-W3, D-M7, E2` | `AutoSurchargeRows.tsx` (mới), `OccasionPicker.tsx` (mới), `model.ts` |
| `ab05469` | 20/10 02:12 | `F-S1b, D-W3, F-T1, E4, E3` | `ContractEditor.tsx`, `ContractEditor.test.tsx`, `PackageLineCard.tsx`, `ExtraPackageDialog.tsx`, `contracts.css` |
| `9703bd6` | 25/10 13:15 | `E5, F-W2, thợ sửa sau chấm D` | `model.test.ts`, `ContractEditor.test.tsx` |
| `5bedc31` | 25/10 13:34 | `Sửa sau chấm bản vẽ D: T1, T2, L6, L1, L2, L3, L4` | `contracts.css` (+7) |

### 3.2 So với danh sách W3 của bản vẽ D (dòng 967)

Bản vẽ D khai báo W3 đụng: `model.ts`, `model.test.ts`, `PackageLineCard.tsx`, `OccasionPicker.tsx` (mới), `AutoSurchargeRows.tsx` (mới), `ContractEditor.tsx`, `ContractEditor.test.tsx`, `ContractPrint.tsx`, `useContractCatalog.ts`, `contracts.css`.

| Tệp trong danh sách W3 | Đã đụng? | Ghi chú |
|---|---|---|
| `model.ts` | Có | `0925f41` (D-W3) |
| `model.test.ts` | Có | `9703bd6` |
| `PackageLineCard.tsx` | Có | `ab05469` (D-W3) |
| `OccasionPicker.tsx` | Có (mới) | `0925f41` (D-W3) |
| `AutoSurchargeRows.tsx` | Có (mới) | `0925f41` (D-W3, D-M7) |
| `ContractEditor.tsx` | Có | `ab05469` (D-W3) |
| `ContractEditor.test.tsx` | Có | `ab05469`, `9703bd6` |
| `ContractPrint.tsx` | **Chưa** | Không có commit nào của D. Có một commit khác chạm tệp này: `0a1d8b5` (nhãn W-HDKH, khoá học). Khớp với ghi chú của bạn: D chỉ đụng khoá học |
| `useContractCatalog.ts` | Có, nhưng không nhãn D | `9379681` (WIP các thợ) |
| `contracts.css` | Có | `5bedc31`, `ab05469` |

**Tệp D đã đụng nhưng không có trong danh sách W3:** `ExtraPackageDialog.tsx` (`ab05469`, nhãn D-W3). Cần điều phối xác nhận.

### 3.3 Tệp contracts khác đã đổi từ 19/10 (giờ Việt Nam) nhưng không mang nhãn D

Các tệp này do W1, W3, Y, W-PP, W-HDKH, E, F, PH, R&D 05–09 hoặc WIP chung gây ra. Các nhãn "W1", "W3" trong `b989657`, `f2c5ee9` và `da0cb73` **không khớp** với bản vẽ D (W1 của D là màn Hôm nay). Cần xác nhận người làm.

- `CatalogPicker.tsx`, `CustomerBlock.tsx`, `ExtraDialog.tsx`, `ExtrasCard.tsx`, `TotalsCard.tsx`, `TravelControl.tsx`, `VoidLineDialog.tsx`, `StaffRow.tsx`, `StaffPicker.tsx`, `StaffPicker.tenNgan.test.tsx`, `StaffWarningBanner.tsx`, `ContractList.tsx`, `ContractList.test.tsx`, `ContractKindRouter.tsx`, `icons.tsx`, `useStaffAvailability.ts`
- Màn khoá học (nhãn W-HDKH, `0a1d8b5`, `745f454`, `6a6df30`): `CourseContractEditor.tsx`, `CourseContractEditor.test.tsx`, `CourseInstallments.tsx`, `CourseLineCard.tsx`, `CoursePicker.tsx`, `courseModel.ts`, `ContractPrint.tsx`, `ContractTexts.tsx`, `useCourseCatalog.ts`, `index.tsx`
- Bài in N1 (`b989657`, nhãn W1): `ContractPrint.pdf.test.ts`, `contracts-print-css.test.ts`, `__in-thu__/index.html`, `__in-thu__/main.tsx`. Bộ luật in N1 đã vào kho từ chặng 1 nhưng được gộp vào một commit có nhãn W1.

### 3.4 Chồng lấn với gói G-W5

G-W5 đụng: `ContractEditor.tsx`, `CourseContractEditor.tsx`, `model.ts`, `model.test.ts`, `ContractEditor.test.tsx`, `CourseContractEditor.test.tsx`, `contracts.css`, và xoá `ContractPrint.tsx`, `ContractPrint.pdf.test.ts`, `contracts-print-css.test.ts`, `__in-thu__/`, cùng `apps/web/src/api/khop-hop-dong.test.ts`.

- **Chồng với D (đã đụng):** `ContractEditor.tsx`, `ContractEditor.test.tsx`, `model.ts`, `model.test.ts`, `contracts.css`. Đây là 5 trên 7 tệp G-W5 sửa.
- **Chồng với D (khai báo):** `ContractPrint.tsx` (G-W5 xoá, D-W3 khai báo sẽ sửa). Hiện chưa có commit D nào đụng.
- **Chồng với thợ khác đang làm khoá học:** `CourseContractEditor.tsx`, `CourseContractEditor.test.tsx`, `courseModel.ts`, `ContractTexts.tsx`, `ContractPrint.tsx` (nhãn W-HDKH).
- **Không chồng:** `ExtraPackageDialog.tsx` và các tệp Staff* (G-W5 không đụng).

### 3.5 Khoảng trống của bản vẽ G: phần D giao cho G (mục 3.4 của bản vẽ D)

Bản vẽ D, dòng 836, ghi: "bản in **không** in chữ luật (khách không cần), chỉ in tên phụ phí và tiền. Ngày của dòng in cạnh giờ khi hợp đồng có hơn một ngày." **Bản vẽ D không ghi chữ "giao cho bản vẽ G".** Đối chiếu bản vẽ G thì chưa có quy tắc này:

1. **Dòng phụ phí tự thêm không có chỗ trong dữ liệu in của G.** Bản vẽ D định nghĩa dòng tự thêm là dòng con `SURCHARGE` (có `surchargeRuleId`) của dòng đặt chỗ. Bản vẽ G `PrintLine` chỉ có `addons: PrintSubLine[]` (ghi "ADDON chưa huỷ") và `travel`. Cần quyết: đưa vào `addons`, hay thêm nhóm `surcharges`. Chỗ này thuộc G-M3 / G-M4.
2. **Ngày riêng của dòng:** `PrintLine.date` có (bản vẽ G dòng 539), nhưng không có quy tắc "in ngày cạnh giờ khi hợp đồng có hơn một ngày". Chỗ này thuộc G-W2 (bộ vẽ, khối `chi-tiet`).
3. **Không in chữ luật:** bản vẽ G không có quy tắc nào về việc ẩn "tự thêm theo luật …". Chỗ này thuộc G-M4 hoặc G-W2.

Gợi ý: thêm ba quy tắc trên vào bản vẽ G (mục 2.2 và bài thử G-M4 / G-W2), trước khi G-W5 chạy.

---

## 4. Migration

- Các migration gần nhất (thư mục `apps/api/prisma/migrations`, 22 mục): `20261018230000_dao_tao`, `20261019110000_dat_lai_mat_khau`, `20261019120000_buoi_hoc_len_lich`, `20261019130000_hom_nay_su_kien_phu_phi`, `20261019160000_moc_doi_mat_khau`, `20261019200000_cong_hoc_vien`, `20261019210000_giay_chung_nhan`, **`20261019215000_the_hien_tren_cong`** (mới nhất).
- **`20261019220000_mau_in_hop_dong` chưa tồn tại** và đứng sau mọi migration hiện có. Mốc đúng.
- `20261019170000` **không** tồn tại (nên không đụng hàng).
- Bản vẽ G vẫn ghi **`20261019170000`** ở 3 chỗ: dòng 179 (mục 2.3), dòng 1038 (gói G-M1), dòng 1078 (điều phối). Ký duyệt đè ghi `20261019220000`, nhưng bản vẽ chưa được sửa. Cần sửa cả 3 chỗ trước khi G-M1 chạy.
- `20261019215000_the_hien_tren_cong` không được ký duyệt G nhắc tới (không tìm thấy tên này trong `docs/`). Không chặn G, vì 220000 vẫn đứng sau.
- Mốc ký duyệt G ghi "sau K6 160000, E 200000, F 210000". Các mốc này tồn tại: `20261019160000_moc_doi_mat_khau`, `20261019200000_cong_hoc_vien`, `20261019210000_giay_chung_nhan`.

---

## 5. GHI-CHEP-MON-CUA-NGUOI-KHAC.md: mục đã ghi về Lora và Cormorant

| Phông | Mục đã ghi | Ghi chú |
|---|---|---|
| Lora | Dòng 56 (bảng nhóm A, ss-album), dòng 80 ("tên dành riêng" của Lora dùng đúng bản gốc) | Có giấy phép. Có tệp `OFL.txt` |
| Cormorant Garamond | Dòng 70 (đã có sẵn trong app), dòng 93 (chữ nghiêng), dòng 75–76 (điều kiện OFL) | Có giấy phép `phong/OFL-cormorantgaramond.txt` |
| Ghi chú "dùng cho mẫu in hợp đồng (mẫu 1 và 5)" theo ký duyệt G câu 5 | **Chưa có** | Cần thêm một dòng nếu muốn đúng ký duyệt |

---

## 6. Kết luận nhanh

- **Sai dòng:** khoảng 35 chỗ trong bảng mục 1 (ContractEditor, schema.prisma, schemas.ts, route.ts, gate, nav/routes, profile routes). Đây là bản vẽ cũ, không phải lỗi mã.
- **Đổi nội dung:** Lora đã có trong app (`ss-album/lora`); phép cửa gác 10 → 14; đột biến 13 → 25; nav Cài đặt có thêm con "Cổng học viên".
- **Thiếu trong bản vẽ G:** ba quy tắc in dòng phụ phí tự thêm và ngày riêng của dòng (mục 3.5).
- **Migration:** `20261019170000` vẫn ghi ở 3 chỗ trong bản vẽ G, cần đổi sang `20261019220000`.
- **Chồng lấn với D:** `ContractEditor.tsx`, `ContractEditor.test.tsx`, `model.ts`, `model.test.ts`, `contracts.css` đã đụng bởi D (5 trên 7 tệp G-W5). `ExtraPackageDialog.tsx` D đã đụng nhưng không có trong danh sách W3.
