# Bản vẽ F — bảng tra lại đường_dẫn:dòng (gói G0, 19/10/2026 tối)

Thợ G0 (chỉ đọc mã) đo lại mục 1 của `BAN-VE-F-GIAY-CHUNG-NHAN.md` trên mã sau khi bản vẽ D, E1, K6 đã vào `schema.prisma`. Thợ thi công dùng cột "Dòng thật".

| Bản vẽ ghi | Dòng thật | Ghi chú |
|---|---|---|
| schema Course 1152-1184 | 1291-1322 | đúng nội dung |
| CourseClass endDate 1192 / status 1200 / instructorMembershipId 1201 | 1331 / 1339 / 1340 | đúng |
| enum CourseClassStatus 1120 | 1259-1264 | đúng |
| Enrollment 1226-1254; customerId 1233 | 1365-1393; 1372 | đúng |
| enroll.ts:169; migration 20261018230000_dao_tao …:446 | không đổi | đúng |
| courses/service.ts lockClass 99-104, assertAcademy 83-88, listEnrollments 280-329 | 99-104, 83-88, 280-327 | đúng |
| present.ts todayIn 22-24, dateToWire 13, dateFromWire 9, displayName 153-155 | không đổi (displayName 154) | đúng |
| Contract total/status 684/688 | 804/800 | lệch |
| Payment 984-1010; kind 989; voidedAt 994 | 1123-1146; 1128; 1133 | lệch |
| PaymentInstallment 950 | 1087 | lệch |
| DesignCard 1320-1360; snapshot 1340 | 1461-1500; 1481 | lệch |
| OrganizationProfile 1075-1111; logoFileId 1091 | 1214-1249; 1230 | lệch |
| Customer.avatarFileId 397 | 415 | lệch |
| AuditLog 226 / OrgCounter 530 | 242 / 552 | lệch |
| design-templates.ts FONT_OVERRIDES 58 / DesignTemplate 66-83 / tpl 99-111 / BOTH_SIZES 110 / DESIGN_TEMPLATES 123 / findDesignTemplate 194 | 61 / 69-86 / 102-114 / 113 / 126 / 197 | lệch +3 |
| profile/schemas.ts 81-109; profile/images.ts 46-66; files/routes.ts 98-124 | 81-111; 46-64; 98-126 | cuối lệch |
| **apps/web/src/api/types.ts BrandProfile 1310** | **1564** | SAI DÒNG (1310 nay là FilePurpose) |
| permissions.ts PERMISSIONS 3-39; owner/admin 62-63, manager 64-74, receptionist 83-91, instructor 102-105; SYSTEM_ROLES 61-107 | 3-41; 64-65, 66-77, 86-95, 106-109; 63-111 | lệch +2..+4 |
| app.ts runIdempotent 274 | 277 | lệch |
| contracts/routes.ts 72-84 | nextContractCode 76-84 | lệch đầu |
| gate.ts ids 296-337 | bắt đầu 301 | lệch đầu |
| gate-samples.ts REF_SAMPLES 70; REF_VARIANTS 240 | 80; 231 | lệch |
| **apps/web/src/layout/nav.ts 97-98 (mục Đào tạo)** | **109** | SAI DÒNG |
| R&D cc-01..cc-10; cc.js 171 dòng; cc.css 45 dòng | cc-01..cc-16; 339 dòng; 52 dòng | cập nhật theo đính chính |

Các mục còn lại của mục 1 (exportPng.ts, mau.js, PreviewFrame, profile/routes.ts, public.ts, sync-system-roles.ts, audit.ts, route.ts, errors.ts, gate.ts phần còn lại, gate-mutants 1–14, contracts.css, ContractPrint.tsx, ClassCard, CourseDetail, CustomerDetail, routes.tsx, Dialog): **không đổi**.

**Điều kiện đã xác nhận:** K3 xong về mã (commit 901062f, 27 mẫu khung tròn, shd-11 viên thuốc). Chưa có khoá quyền certificates nào; chưa có `packages/shared/src/certificates.ts`. Migration mới nhất: `20261019200000_cong_hoc_vien`; `20261019210000_giay_chung_nhan` chưa có.

**pdf-lib 1.17.1:** MIT; phụ thuộc @pdf-lib/standard-fonts 1.0.0 (MIT), @pdf-lib/upng 1.0.1 (MIT), pako 1.0.11 (MIT AND Zlib), tslib 1.14.1 (0BSD); bản min 525 KB (~207 KB gzip), không có fetch/XMLHttpRequest. Cài qua proxy được.
