# Biên bản nghiệm thu bản vẽ F: Giấy chứng nhận tốt nghiệp (bản `08de168`)

- **Ngày chấm:** 26/10/2026 (giờ máy khoảng 04:40–10:10 UTC). Phiên bị dừng 2 lần vì giới hạn phiên. Bản tách, nhật ký và database còn nguyên; máy chủ và preview mất khi dừng, tôi bật lại với PID mới (mục 7) rồi làm tiếp.
- **Người chấm:** thợ chấm độc lập (gói C, AI, Opus), không phải người làm. Tôi chỉ đo, phá thử trên bản tách và chụp ảnh.
  - Tôi **không** sửa mã sản phẩm, **không** chạy lệnh git ghi (chỉ `git worktree add/remove`).
  - Tôi **không** đụng `makeup_dev`, **không** `migrate reset`, **không** tắt tiến trình theo tên.
- **Bản được chấm:** commit `08de168` ("F-W3c xong"), bản tách `scratchpad/cham-f/wt`, cài riêng (`pnpm install --frozen-lockfile`, 12,9 giây), nên bộ đọc database (`prisma generate`) là của chính bản này (sổ lỗi 17).
  - Commit còn phần **dở** của bản vẽ G (gói G-M4 "lần in": `apps/api/src/modules/print/prints.ts`, `contract-print/**`). Bài đỏ thuộc G ghi riêng ở mục 1.2, **không** tính cho F.
  - Migration đúng tên `20261019210000_giay_chung_nhan` (đính chính bản vẽ, KY-DUYET-F câu 6).
- **Một bản build cho mọi phép đo** (sổ lỗi 19): `apps/api` build bằng `tsup` → máy chủ thật chạy `node dist/server.js`; `apps/web` build bằng `pnpm build` → `vite preview`. Bài thử chạy trên cùng mã nguồn đó.
- **Database thử** (đều `btree_gist`, áp bằng `pnpm --filter api db:deploy-to`, lần nào cũng "kiểm lại: khớp"):
  - `makeup_test_cham_f`: bài thử máy chủ, cửa gác, đột biến. **Đã xoá.**
  - `makeup_test_cham_f_khop`: bài web (khop-chung-nhan, khop-hop-dong). **Đã xoá.**
  - `makeup_test_cham_f_m4`, `_m5`: bản sao để phá ở mức database (M4, M5). **Đã xoá.**
  - `makeup_test_cham_f_dung`: app thật. **Còn giữ** (mục 6).
- **Biến môi trường:** mọi lệnh đặt rõ `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL` (hoặc `KHOP_CHUNG_NHAN_DATABASE_URL`, `KHOP_HOP_DONG_DATABASE_URL`) trỏ vào database thử. Bản tách không có tệp `.env`.
- **Ảnh:** 56 tệp ở `docs/nghiem-thu/bai-thu-ban-ve-f/`. 51 ảnh **khung nhìn** (`fullPage: false`, sổ lỗi 27) của app thật, 5 ảnh `pdf-*.jpg` là trang PDF thật đã xuất (pdftoppm). Tôi đã mở xem từng ảnh.
- **Nhật ký và mã đo:** `scratchpad/cham-f/log/` (mỗi lệnh một tệp), `scratchpad/cham-f/pw/` (`seed.mjs`, `lib.mjs`, `ui-cap.mjs`, `ui-man.mjs`, `ui-390.mjs`, `ui-sua.mjs`, `ui-30.mjs`, `ui-vaitro.mjs`, `ui-them-anh.mjs`, `pha.mjs`, `dua.mjs`, `idem2.mjs`), `scratchpad/cham-f/mutate.sh` + `mut/*.json` (đột biến), PDF ở `scratchpad/cham-f/out/` và `scratchpad/cham-f/gcn-out/`.

---

## 0. Kết luận ngắn cho anh Chiến

**ĐẠT có điều kiện.**

- **Phần cốt lõi chạy đúng và an toàn** trên app thật:
  - lớp kết thúc → "Cấp chứng nhận" → chọn mẫu → chọn nhiều học viên → xem trước → cấp → PDF A4 ngang, mỗi người một trang;
  - sổ: lọc, tìm, chọn nhiều in lại, cấp lại **giữ số**, thu hồi bắt lý do; hồ sơ học viên: In lại **ảnh lúc cấp**; thẻ người ký;
  - điện thoại: nút "Chia sẻ PDF (In / Zalo / Lưu)" gọi bảng chia sẻ **ngay trong lượt bấm**, không có "In ngay";
  - số giấy, tên, ngày trên PDF khớp database từng dòng; 51 số liền nhau, 0 trùng;
  - 40 lệnh cấp đua nhau: 0 lỗi lạ; tổ chức khác, lễ tân, kế toán, tổ chức không đào tạo đều bị chặn đúng.
- **Điều kiện (phải vá trước khi anh dùng thật):**
  - **T1. Chưa có chỗ gắn ảnh học viên trên web.** Mọi giấy sẽ in **chữ cái đầu** thay cho ảnh tròn. Nút "Thêm ảnh" trong hộp cấp mở hồ sơ khách, nhưng hồ sơ không có ô ảnh.
  - **T2. Mẫu 08:** dòng "· Bản cấp lại dd/mm/yyyy" in trên **dải nâu**, chữ khó đọc.
  - **T3. Hai lỗ bài thử:** đổi sang "in lại dùng ảnh mới" hoặc "thu hồi không ghi nhật ký" thì bài thử vẫn xanh. App hiện làm đúng cả hai, nhưng không có gì giữ.
  - **T4 (quy trình):** commit chấm còn dính việc dở của G nên cửa gác chạy không được nếu không tách G (sổ lỗi 19 tái phạm).

| Mục (bản vẽ) | ĐÚNG | ĐẠT | ĐẸP |
|---|---|---|---|
| 2. Dữ liệu: bảng, CHECK, 3 chỉ mục một phần, 3 trigger | Có | Có (database 28/28; M4, M5 đỏ) | — |
| 3. Quyền + danh mục dùng chung | Có | Có (shared 416/416; bảng vai trò đúng từng ô trên app thật) | — |
| 4. Máy chủ 8 đường | Có | Có (50/50; cửa gác 1464/1464 khi tách G) | — |
| 5. 16 mẫu | Có | Có (mau-cc 18/18; 16 mẫu in thật) | **Chưa** (T2 mẫu 08; L4) |
| 6.1–6.2 Thẻ lớp, hộp cấp, xem trước | Có | Có | Có (3 khổ, 0 tràn) |
| 6.4, 7 Bản in, PDF, chia sẻ | Có | Có (Chromium thật 21/21) | Có |
| 6.5 Sổ, cấp lại, thu hồi | Có | Có | Có (L2 nhỏ) |
| 6.6 Hồ sơ học viên: In lại | Có | Có (ảnh lúc cấp, đo thật) | Có |
| 6.7 Thẻ người ký | Có | Có | Có |
| Ảnh học viên ("Thêm ảnh") | **Không** (T1) | **Không** | — |

**Số tôi tự đo:**
- Bài thử F máy chủ **50/50**. Web F và liên quan **295/295** (gồm 21 bài Chromium thật). Shared **416/416**.
- Cửa gác 14 phép **1464/1464** (= mốc G-M3), sau khi tách 1 dòng của G-M4 dở.
- Đột biến: **29 lần phá**, bài thử bắt **27/29**. Lọt 2: N6, N8 (T3).
- App thật: tràn ngang **0/51** ảnh khung nhìn; lỗi JavaScript **0**; nút chết **1/24** ("Thêm ảnh", T1).
- Thời gian (máy build, Chromium headless): **8 người 22,4 giây** (máy đang chạy 2 bộ bài thử song song); **30 người 61,0 giây**, PDF 9,5 MB.

---

## 1. Bảng số đo

### 1.1 Bài thử tự động (bản tách `08de168`)

| # | Lệnh | Kết quả |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | Xanh, 12,9 giây. `prisma generate` từ schema của bản tách |
| 2 | Typecheck `packages/shared` | **0 lỗi** |
| 3 | Typecheck `apps/api` | **0 lỗi** |
| 4 | Typecheck `apps/web` | `tsconfig.json`: **0 lỗi**. `tsconfig.node.json`: **1 lỗi** ở `src/features/contract-print/paper/print.pdf.test.ts:192` (**G**, 1.2). **0 lỗi ở F** |
| 5 | Build `apps/api` (tsup) | Xanh |
| 6 | Build `apps/web` | Xanh (vite 6,7 giây). Cửa gác bí mật **307/307** tệp, 0 vi phạm. Cổng học viên 76,8/90 KB JS, 8,2/15 KB CSS |
| 6a | pdf-lib tách tệp (việc tồn 78) | **Đạt.** pdf-lib nằm ở tệp riêng `dist/assets/index-Dfy3yo0d.js`, chỉ `PrintSheet-*.js` tải nó bằng `import()` động. Tệp vào là `main-*.js`, không có pdf-lib. Lưu ý L6: tên tệp riêng lại bắt đầu bằng `index-` |
| 7 | `apps/api` `vitest run` cả bộ (`makeup_test_cham_f`) | **1027 qua / 1059** · 14 đỏ · 18 bỏ qua. 76 tệp: 74 xanh. 15 phút. **Toàn bộ 14 đỏ + 18 bỏ qua do G** (1.2): cửa gác không dựng được vì thiếu `:printId` |
| 7a | 4 tệp F | `giay-chung-nhan` **16/16** · `-database` **28/28** · `-dua` **4/4** · `-vai-tro` **2/2** = **50/50**. Chạy riêng lần 2 (vế GIỮ sau đột biến): 50/50, 57 giây |
| 7b | Bài liên quan | `system-roles` 2/2 · `profile` 14/14 · `mau-in` 54/54 |
| 8 | Cửa gác, **tách G-M4** (đặt `printModuleRoutes = [...templateRoutes]` ở `print/routes.ts:7` trong cùng một lệnh, trap khôi phục, so byte: khớp HEAD) | 3 tệp **49/49** (`tenant-isolation`, `gate-mutants`, `sua-mot-phan`). 14 phép: scope **127/127** · outsider **127/127** · noPerms **127/127** · unauth **140/140** · crossId **64/64** · leak **51/51** · refBase **57/57** · crossRef **155/155** · keep **127/127** · platform **40/40** · portalScope **5/5** · portalWall **426/426** · portalLeak **3/3** · portalProbe **15/15** = **1464/1464** (= mốc G-M3). Riêng 8 đường F ("F gốc"): scope 8/8 … crossRef 5/5, keep 8/8. Đột biến 15, 16, 17 của thợ: **đỏ cả 3**, vế GIỮ xanh. partialStatic 24/24 |
| 9 | `packages/shared` `vitest run` | **416/416** (12 tệp). `certificates.test` 13 · `permissions.test` 6 |
| 10 | `apps/web` `vitest run` cả bộ | **1817 qua / 1819** · 2 đỏ. 105 tệp: 104 xanh. 8 phút 16 giây. **2 đỏ thuộc G** (1.2) |
| 10a | Bài web F | `certificates/`: IssueDialog **18** · PrintSheet.pdf (**Chromium thật**) **21** · PrintSheet **8** · RegisterPage **37** · print-css **6** · frame **6** · logic **7** · pdf **2** · render **9** · share **4** = **118/118**. `api/certificates` **14/14** · `api/khop-chung-nhan` (máy chủ thật + database thử) **10/10** · CustomerCertificatesCard **29/29** · CertificateSignerCard **33/33** · `designs/mau-cc` **18/18** · AppShell **48/48** · CoursesPage **25/25** · `designs/` cả thư mục **77/77**. Cộng **295/295** (AppShell, CoursesPage gồm cả ca không phải F) |
| 10b | Số đo của bài Chromium thật (dữ liệu giả, 16 mẫu trộn) | 8 người: vẽ **10,9 giây** (1,36 giây/người), PDF 2,14 MB. 30 người: vẽ **40,5 giây** (1,35 giây/người), PDF 7,83 MB, 267 KB/trang. Ghép PDF 13 / 52 ms |

### 1.2 Bài đỏ không thuộc F

| Bài đỏ | Của gói | Vì sao |
|---|---|---|
| Typecheck web, 1 lỗi: `contract-print/paper/print.pdf.test.ts:192` (`FontFaceSet` không lặp được) | **G** (G-W2 dở) | `pnpm -r typecheck` của commit này **đỏ**. Không phải tệp F |
| `tenant-isolation.test.ts` (đỏ cả tệp, 18 bài bỏ qua) + 14 đột biến cũ trong `gate-mutants.test.ts` | **G** (G-M4 dở) | `Cửa gác chưa có giá trị cho :printId của GET /orgs/:orgId/contracts/:contractId/prints/:printId` (`test/gate.ts:493`). Đường "lần in" của G-M4 đã đăng ký (`print/routes.ts:7`) nhưng fixture cửa gác chưa có. Tách G thì 1464/1464 (dòng 8) |
| `src/api/khop-hop-dong.test.ts` (2 bài) | **G** | `putBrandProfile` trả thêm `representativeName`, `bankName`, `bankAccountNumber`, `bankAccountName` (thông tin hợp đồng G-M3) mà kiểu `BrandProfile` ở web chưa khai. Không có trường nào của F (không có `certSigner*`). Bài thứ hai đỏ theo (chưa gọi đủ hàm) |

### 1.3 Đột biến: 29 lần phá, bắt 27, lọt 2

**Cách làm (luật 11):**
- Danh sách là của tôi, **không** chép danh sách thợ.
- Mỗi lần dùng `scratchpad/cham-f/mutate.sh`: chép tệp gốc ra chỗ khác, thay chuỗi **đúng 1 lần**, chạy bài, rồi **trap khôi phục ngay trong cùng một lệnh** và so byte với HEAD. Cả 29 lần đều "khôi phục: khớp HEAD". Bản tách nằm trong thư mục nháp, không phải thư mục kho.
- M4, M5 phá trên **bản sao database** (`_m4` bỏ chỉ mục, `_m5` viết lại CHECK), không sửa migration.
- Nhật ký: `log/mut-<mã>.txt`, `log/dot-bien-api.txt`, `log/dot-bien-web.txt`, `log/mut-db-m4.txt`, `log/mut-db-m5.txt`.

**M1–M13 (theo bản vẽ, cách cài của tôi):**

| # | Tôi phá thế nào | Tệp | Kết quả |
|---|---|---|---|
| M1 | Điều kiện "lớp chưa kết thúc" thành `false` | api certificates/service.ts:317 | **Đỏ** 1/22 (S3: ra 500 thay 409) |
| M2 | Lấy số bằng `SELECT MAX(seq)+1` | service.ts:301-304 | **Đỏ** 2/22 (S6, đua ca 2) |
| M3 | Thay `lockClass` bằng đọc lớp không khoá | service.ts:313 | **Đỏ** 1/22 (đua ca 1) |
| M4 | Database bản sao: `DROP INDEX certificates_one_issued_per_enrollment` | database | **Đỏ** 2/28 |
| M5 | Database bản sao: CHECK `certificates_reissue` vế 2 bỏ `IS NOT NULL` | database | **Đỏ** 2/28 (bẫy NULL) |
| M6 | Sổ bỏ `organizationId` | service.ts:600-601 | **Đỏ** 2/34: S14 + cửa gác **crossRef 153/155**. Bản vẽ ghi "leak" nhưng leak vẫn 51/51; crossRef mới bắt |
| M7 | Cấp lại lấy **số mới** từ bộ đếm | service.ts:525-527 | **Đỏ** 4/22 |
| M8 | `toData` của PUT /profile thêm `certSignerName: null` | profile/routes.ts:15 | **Đỏ** 1/30 (S16) |
| M9a | Bỏ `break-after: page` | web certificates.css:13 | **Đỏ** 2/27 (print-css + Chromium "In ngay") |
| M9b | `@page` sang `portrait` | certificates.css:6 | **Đỏ** 2/27 |
| M10 | `pdf.ts` bỏ trang cuối | pdf.ts:18 | **Đỏ** 20/23 |
| M11 | `shareFile` thành `async`, chèn `await` trước `navigator.share` | share.ts:43-46 | **Đỏ** 1/4 |
| M12 | Tiêu đề mẫu 07 thành "Chứng chỉ" | public/mau/cc-07.html:35 | **Đỏ** 1/18 (T1-2) |
| M13 | Trả `contract.total` cho người thiếu quyền tiền | service.ts:282 | **Đỏ** 1/22 (S9) |

**Đột biến mới của tôi:**

| # | Phá | Tệp | Kết quả |
|---|---|---|---|
| N1 | **Đua cấp trùng số:** bộ đếm không tăng (`value = value`) | service.ts:303 | **Đỏ** 13/22 |
| N2 | **Cấp cho lớp đã huỷ:** bỏ kiểm `CANCELLED` | service.ts:314 | **Đỏ** 1/22 |
| N3 | **Cấp lại đổi ngày cấp** sang hôm nay (số giữ, ngày đổi) | service.ts:528 | **Đỏ** 1/22 |
| N4 | **Lộ giấy tổ chức khác:** bỏ lọc tổ chức khi có `?ids=` | service.ts:601 | **Đỏ** 1/34, **chỉ S14 bắt**. Cửa gác 1464/1464 **MÙ** (L3) |
| N5 | **Lễ tân cấp được:** đường cấp hàng loạt đòi `certificates.read` | certificates/routes.ts:58 | **Đỏ** 1/22 (S2) |
| N6 | **In lại dùng ảnh mới** của hồ sơ thay ảnh lúc cấp | certificates/present.ts:78, :117, :140 | **LỌT** (22/22 xanh). T3 |
| N7 | Nợ học phí **chặn** cấp | service.ts:425 | **Đỏ** 17/22 |
| N8 | Thu hồi (đường 6) **không ghi nhật ký** | service.ts:580-589 | **LỌT** (22/22 xanh). T3 |
| N9 | Tra ghi danh bỏ lọc lớp (giữ tổ chức): lấy ghi danh lớp khác | service.ts:326 | **Đỏ** 1/22 (S8) |
| N10 | Thu hồi không chặn bản đã thu hồi | service.ts:579 | **Đỏ** 2/22 |
| W1 | Tích sẵn cả người "đã thu hồi chưa cấp lại" | web IssueDialog.tsx:92 | **Đỏ** 13/18 |
| W2 | Mỗi lần bấm Cấp sinh khoá chống gửi trùng mới | IssueDialog.tsx:329 | **Đỏ** 1/18 |
| W3 | `frame.ts` luôn đặt `lai` (bản gốc cũng in "Bản cấp lại") | frame.ts:48 | **Đỏ** 2/15 |
| W4 | Sổ hiện "Cấp lại / Thu hồi" theo quyền đọc | RegisterPage.tsx:37 | **Đỏ** 3/37 |
| W5 | Tắt cảnh báo "ảnh nhỏ" | logic.ts:102 | **Đỏ** 2/25 |

**Kết luận: 29 lần phá, bài thử bắt 27/29.** Hai chỗ lọt và một chỗ cửa gác mù được ghi ở T3 và L3.

### 1.4 Đo trên app thật

**Cách chạy:**
- Máy chủ: `node dist/server.js`, cổng 4700, database `makeup_test_cham_f_dung`, kho tệp `scratchpad/cham-f/storage`.
- Web: `vite preview` của bản build, cổng 5700.
- Dữ liệu (`pw/seed.mjs`, gieo qua API thật):
  - "Chiến Makeup Academy" (ACADEMY), có logo, người ký "Nguyễn Văn Chiến", giảng viên "Nguyễn Thu Hà".
  - Lớp **K12** đã kết thúc 23/10, 8 học viên: 2 không ảnh, 1 tên dài "Tôn Nữ Hoàng Bảo Ngọc Phương Thảo", 2 còn nợ (1.500.000 và 11.000.000), 1 ảnh 300 px.
  - Lớp **K30**: 30 học viên. Lớp **K14** kết thúc **hôm nay**. Lớp **K13** chưa kết thúc. Một khoá "Một lớp".
  - Quản lý, lễ tân, kế toán, giảng viên.
  - Tổ chức **B** (ACADEMY khác, có 1 giấy) và **C** (TEAM).

| Hạng mục | Kết quả |
|---|---|
| **Tràn ngang cả trang** | **0/51** ảnh khung nhìn (1440, 1024, 390). Dò từng phần tử lố khung: chỉ có iframe vẽ ngầm đặt ở x = −20000 (cố ý, ngoài màn) |
| **Lỗi trang** | 0 lỗi JavaScript, 0 lỗi console |
| **Nút** | Đã bấm thật **24 loại nút**, 23 có tác dụng đúng: Cấp chứng nhận, ô mẫu, tên học viên (xem trước), ‹ ›, vuốt (chạm thật bằng CDP), 2 bước Segmented, Cấp và in, Huỷ, Cấp và mở bản in, Tải PDF, Tải ảnh, Lưu ảnh, In ngay, Chia sẻ PDF, In lại (thanh chọn, dòng, hồ sơ), ⋯ → Cấp lại / Thu hồi, Cấp lại và in, Giữ lại, Thu hồi, Lưu (người ký), Xong. **1 nút chết về chức năng: "Thêm ảnh"** (T1) |
| **Thời gian** (bấm "Cấp và mở bản in" tới khi nút Tải PDF hiện) | **8 người (K12): 22,4 giây**, đo khi máy đang chạy song song 2 bộ bài thử (tải cao). **30 người (K30): 61,0 giây** (máy gần rảnh, tải trung bình 2,7), PDF 30 trang 9,5 MB. In lại từ sổ: 8 bản **16,4 giây**; 16 bản (16 mẫu) **32,9 giây**; 2 bản 3,3–3,5 giây ở cả 3 khổ. 390: cấp 1 người tới khi PDF sẵn **2,1 giây** |
| **Cỡ tệp** | K12 8 trang **3,04 MB** (~370 KB/trang); K30 **9,5 MB** (~317 KB/trang); 1 trang 205–222 KB |
| **"In ngay"** (máy tính) | Vùng in gắn thẳng vào `BODY`, 8 trang; `page.pdf()` ra **8 trang 841,92 × 594,96 pt**, A4 ngang. `window.print` được gọi 1 lần |

---

## 2. Luồng anh Chiến trên app thật, đối chiếu database (SQL trong `BEGIN READ ONLY … ROLLBACK`)

1. **Thẻ lớp** (`cap-lop-chua-ket-thuc-1440`, `the-lop-*`):
   - K13 chưa kết thúc: nút "Cấp chứng nhận" xám, gợi ý đúng chữ "Lớp kết thúc 15/11/2026 — cấp được từ ngày đó", nút Ghi danh còn.
   - K12, K30, K14 (kết thúc hôm nay): nút chính "Cấp chứng nhận", **Ghi danh ẩn**.
2. **Hộp cấp K12** (`cap-hop-cap-1440`):
   - 8 dòng tích sẵn.
   - Nhãn đúng: "chưa có ảnh — in chữ cái đầu · Thêm ảnh" ở 2 người; "Còn nợ 1.500.000 ₫", "Còn nợ 11.000.000 ₫".
   - Số dự kiến "CC-2026-0001 → 0008". Người ký "Nguyễn Thu Hà · Nguyễn Văn Chiến · Sửa".
   - Bấm tên dài và người không ảnh: xem trước đúng (`cap-hop-cap-xem-truoc-ten-dai-1440`, `…-khong-anh-1440`).
   - Thanh tổng "Đã chọn 8 học viên · 8 cấp mới · 8 trang A4 ngang".
   - **Lệch:** người có ảnh 300×300 **không** có nhãn "ảnh nhỏ" (L1).
3. **Xác nhận** (`cap-xac-nhan-1440`): "Cấp 8 giấy chứng nhận mới?", dải số, ngày 23/10/2026, mẫu "05 · Hoa văn vàng cổ điển", dải vàng "2 học viên còn nợ học phí (tổng 12.500.000 ₫). Vẫn cấp được."
4. **Bản in** (`cap-dang-ve-1440`, `cap-ban-in-xong-1440`):
   - Thanh "Đang vẽ 1/8 · Lê Thị Mai…" kèm nút "Dừng".
   - Xong: "Đã cấp 8 giấy chứng nhận (CC-2026-0001 → 0008). Tệp PDF: 8 trang A4 ngang… (2,9 MB)".
   - Tệp `Giay-chung-nhan-lop-k12-2026-10-23.pdf`. Ảnh lẻ `GCN-CC-2026-0001-le-thi-mai.png`.
5. **PDF ↔ database:**
   - Trang 1–8 = CC-2026-0001…0008, đúng thứ tự ghi danh, đúng tên từng người.
   - "Ngày 23 tháng 10 năm 2026" = `issued_on 2026-10-23`.
   - Trang 3 và 8 in "NĐ", "HB" = `photo_file_id` NULL.
   - Người ký, giảng viên, trung tâm, lớp khớp các cột chụp (`pdf-k12-8-trang-cc05.jpg`).
6. **Hồ sơ học viên → In lại, ảnh lúc cấp:**
   - Tôi đổi ảnh hồ sơ Lê Thị Mai sang ảnh đỏ "ẢNH MỚI" (PATCH 200), rồi bấm "In lại CC-2026-0001".
   - PDF vẫn là **ảnh xanh "MAI" lúc cấp** (`pdf-in-lai-anh-luc-cap-va-cap-lai-cc08.jpg`, `ho-so-in-lai-1440`).
   - SQL: `photo_file_id` của giấy ≠ `avatar_file_id` hiện hành. Đúng KY-DUYET-F câu 1.
7. **Cấp lại** CC-2026-0008 (`cap-lai-dien-1440`, `cap-lai-ban-in-1440`):
   - Tên "Hoàng Gia Bảo Anh", mẫu 08.
   - Kết quả "Đã cấp lại CC-2026-0008, giữ nguyên số. Giấy ghi 'Bản cấp lại 26/10/2026'".
   - SQL: bản cũ `reissue_no 0` REVOKED, lý do "Sai tên / sai dấu"; bản mới `reissue_no 1`, cùng `issued_on`, `reissued_on 2026-10-26`.
   - **PDF mẫu 08: dòng "Bản cấp lại" nằm trên dải nâu (T2).**
8. **Thu hồi** CC-2026-0007:
   - Bấm Thu hồi khi chưa có lý do → "Nhập lý do thu hồi trước khi thu hồi."
   - Có lý do → dải "Đã thu hồi CC-2026-0007…" (`so-sau-cap-lai-thu-hoi-1440`).
   - Mở lại hộp cấp K12 (`hop-cap-sau-thu-hoi-1440`): Vũ Ngọc Ánh "Đã thu hồi CC-2026-0007 · cấp sẽ nhận số mới", **không** tích; 7 người "Đã cấp · CC-…"; nút "In lại (7)", không gọi POST.
9. **Sổ:**
   - Lọc "Đã thu hồi" ra đúng 2 bản kèm lý do.
   - Tìm "bảo anh" ra bản cấp lại; tìm "0002" ra CC-2026-0002.
   - `?lop=` hiện chip lớp. Chọn 2 → "In lại (2)" → PDF 2 trang (`so-chon-nhieu-*`, `so-ban-in-lai-*`).
10. **Người ký:** đổi "Nguyễn Trọng Chiến" → Lưu → GET trả đúng. Giấy cũ giữ "Nguyễn Văn Chiến" (bản chụp).
11. **K30, 30 người, mẫu 16** (`cap-30-xong-1440`): 61,0 giây, PDF 30 trang.
    - Rồi cấp lại 16 bản sang **16 mẫu khác nhau** (5 bản tên 42 ký tự "Tôn Nữ Hoàng Bảo Ngọc Phương Thảo Nguyên", 4 bản không ảnh), In lại cả 16 từ sổ (`pdf-cap-lai-mau-01-08.jpg`, `pdf-cap-lai-mau-09-16.jpg`).
12. **Điện thoại 390** (`hop-cap-*-390`, `xac-nhan-390`, `ban-in-dien-thoai-390`):
    - Segmented "Học viên (30) | Mẫu & xem trước"; vuốt chạm thật 1/30 → 2/30.
    - Lớp K14 kết thúc hôm nay cấp được (CC-2026-0009, ngày 26/10/2026).
    - Nút "Chia sẻ PDF (In / Zalo / Lưu)", "Tải PDF", "Lưu ảnh"; **không** có "In ngay".
    - `navigator.share` giả ghi `userActivation.isActive = true`, tệp `application/pdf` 221.663 byte.
13. **Vai trò trên màn** (`so-le-tan-1440`):
    - Lễ tân: thấy sổ, In lại; **không** có ⋯, **không** có nút cấp trên thẻ lớp.
    - Kế toán: không có mục "Giấy chứng nhận", vào thẳng đường dẫn thì "Bạn không có quyền xem giấy chứng nhận."
    - Quản lý: đủ.

**SQL cuối cùng (tổ chức A):**
- 69 dòng: 40 ISSUED, 29 REVOKED.
- ISSUED trùng ghi danh **0**, trùng số **0**.
- `seq` 1…51 liền, 51 số khác nhau = bộ đếm `certificate:2026` = **51**.
- Nhật ký: `certificate.issued` **51** (= số đã phát), `reissued` **18**, `revoked` **29** (= 18 qua cấp lại + 11 thu hồi tay).

---

## 3. Tự phá trên app thật (HTTP, `pw/pha.mjs`, `pw/dua.mjs`): 0 lọt

| # | Cách phá | Kết quả |
|---|---|---|
| P1 | Vai trò, 7 đường | Quản lý: đọc 200, cấp 201, cấp lại 201, sửa người ký **403**. Lễ tân và giảng viên: đọc 200, cấp / cấp lại / thu hồi / người ký **403**. Kế toán: mọi đường **403**. Đúng bảng 3.1 và KY-DUYET câu 2, 4 |
| P2 | A dùng mã của B | Một bản **404**; `?ids=` 0 dòng; `?customerId=` 0; `?classId=` 0; danh sách lớp B 404; cấp lại / thu hồi B 404; cấp với ghi danh B, mã bịa, ghi danh lớp khác: **400 cùng một lời** "Không tìm thấy học viên này trong lớp" |
| P3 | Tổ chức TEAM | 403 "Tổ chức chưa bật đào tạo" |
| P4 | Lớp chưa kết thúc / ngày cấp sai / mẫu lạ / thân rỗng | 409 `CLASS_NOT_ENDED` đúng lời; 400 `issuedOn` hai lời; `cc-99`, `shd-01` 400; `{}` 400 |
| P5 | **Đua cấp:** 5 vòng × 8 lệnh cùng lúc (4 cùng học viên lớp A + 4 cùng học viên lớp B, khoá khác nhau) | **40/40 là 201**, mỗi vòng đúng **2** bản mới, số 0012…0021 liền nhau, **lỗi khác 0** |
| P6 | Đua cấp lại + thu hồi + cấp lại cùng một bản | 1 thắng (200), 2 bên kia **409 `CERTIFICATE_REVOKED`**, lỗi khác 0 |
| P7 | Chống gửi trùng | Cùng khoá, cùng thân: 201 hai lần, **cùng nội dung**, không thêm dòng (chỉ thứ tự khoá JSON khác do jsonb, L7). Cùng khoá, khác thân: 409 |
| P8 | Thu hồi lý do "   "; `?ids=abc`; `?ids=` 51 mã | 400 / 400 / 400 |
| P9 | GET /profile lộ người ký? | Không có `certSigner*` |

---

## 4. PDF: 16 mẫu, mở từng trang (pdftoppm)

**Đã mở:**
- PDF thật của app: K12 8 trang (mẫu 05).
- PDF cấp lại 16 trang, **16 mẫu khác nhau** (01–16).
- PDF in lại hồ sơ và PDF cấp lại mẫu 08.
- PDF 30 trang của bài Chromium (16 mẫu trộn).
- Ảnh trang ở 50–200 dpi.

**Kết quả:**
- **A4 ngang:** mọi PDF 841,89 × 595,28 pt ("In ngay" 841,92 × 594,96).
- **Chữ có dấu:** đủ ở cả 16 mẫu ("GIẤY CHỨNG NHẬN", "HOÀN THÀNH KHOÁ HỌC", "Nguyễn", "Thuỳ", "Quỳnh", "Đức").
- **Chữ vàng:** không vỡ ở 01, 02, 04, 08, 11, 13, 15 (tiêu đề và tên vàng nét liền, không thành khối).
- **Tên dài 42 ký tự:** không tràn khung ở 01, 04, 07, 10, 13, 16. Tên xuống **2 dòng** ở nhiều mẫu (L4).
- **Không ảnh:** chữ cái đầu trong khung tròn ở 04, 08, 12, 16 (TN, DO, M1, TN) và trong PDF K12 (NĐ, HB).
- **Lỗi:** mẫu **08** bản cấp lại: "· BẢN CẤP LẠI 26/10/2026" trên dải nâu `#6B5A3A` (`pdf-dong-ban-cap-lai-cc16-dung-cc08-loi.jpg`, T2). Mẫu 16 cùng loại luật CSS nhưng dòng số không nằm trong khối đó nên **đúng**.

---

## 5. Lỗi (xếp theo mức)

**Nặng: không có.** Không có cách phá nào thành công. Dữ liệu nhất quán.

### Trung bình

**T1. Không gắn được ảnh học viên trên web. "Thêm ảnh" là ngõ cụt.**
- **Triệu chứng:**
  - Hộp cấp ghi "chưa có ảnh — in chữ cái đầu · Thêm ảnh". Bấm thì mở hồ sơ khách ở tab mới, nhưng hồ sơ và hộp Sửa **không có ô ảnh** (đếm `input[type=file]` / chữ "ảnh" = 0; `them-anh-ho-so-khach-1440`, `them-anh-hop-sua-khach-1440`).
  - Dữ liệu thật của anh sẽ in **chữ cái đầu cho mọi học viên**. 16 mẫu đã duyệt đều có ảnh tròn.
  - Trong buổi chấm, ảnh chỉ có vì tôi gieo bằng API.
- **Gốc:**
  - Máy chủ đã nhận `avatarFileId` (`apps/api/src/modules/schedule/customers.ts:195`).
  - Web chưa khai và chưa có màn: việc tồn **77** ghi "gói gắn ảnh học viên (W3c) phải thêm", W3c không làm.
  - Chỗ dẫn: `apps/web/src/features/certificates/IssueDialog.tsx:698-699`. Chỗ thiếu: `apps/web/src/features/customers/CustomerDetail.tsx`, `apps/web/src/api/types.ts` (CustomerUpdateInput).
- **Tái hiện:** app thật mục 6 → Đào tạo → Lớp K12 → Cấp chứng nhận → "Thêm ảnh" ở Nguyễn Văn Đức.
- **Cách chặn:** thêm ô "Ảnh học viên" (tải lên `CUSTOMER_AVATAR`, xem trước tròn) ở hồ sơ khách. Bài: hộp cấp → Thêm ảnh → tải ảnh → mở lại hộp cấp thì mất nhãn "chưa có ảnh".

**T2. Mẫu 08: dòng "Bản cấp lại" in trên dải nâu.**
- **Triệu chứng:** mọi bản cấp lại bằng mẫu 08 in "Số CC-… · Bản cấp lại dd/mm/yyyy" với nửa sau nằm trên khối nền nâu, chữ vàng nhạt trên nâu, khó đọc. Trên giấy in sẽ thấy như vết bẩn.
- **Gốc:** `apps/web/public/mau/cc-08.html:14` có `.c8 .day i{width:1px;height:16px;background:#6B5A3A}`, viết cho vạch ngăn `<i></i>`. Luật này trúng luôn `<i class="lai" data-f="lai">` ở `cc-08.html:47`.
- **Vì sao không bài nào bắt:** `designs/mau-cc.test.ts` T1-3 không thử tham số `lai`; bài Chromium chỉ vẽ bản gốc.
- **Tái hiện:** Sổ → ⋯ → Cấp lại → chọn mẫu 08 → Cấp lại và in → Tải PDF. Hoặc `/mau/cc-08.html?that=1&xuat=1&so=CC-2026-0008&lai=26/10/2026&ten=Thu`.
- **Cách chặn:** đổi luật thành `.c8 .day > i:not(.lai)`. Thêm vào mau-cc một phép: với `lai=` đặt, phần tử `.lai` của 16 mẫu có nền trong suốt.

**T3. Hai lỗ bài thử máy chủ (đột biến lọt).**
- **N6, "in lại dùng ảnh mới thay ảnh lúc cấp" lọt 22/22.**
  - KY-DUYET-F câu 1 là quyết định anh đã ký, nhưng không bài nào giữ.
  - `apps/api/test/giay-chung-nhan.test.ts:365` (`snap`) so tên, khoá, lớp, người ký, nhưng **không so ảnh**. S11b chỉ thử xoá mềm ảnh.
  - App hiện đúng (mục 2 bước 6).
  - Cách chặn: sau khi cấp, đổi `avatarFileId` của khách sang tệp khác, GET đường 4, kiểm `photo.url` vẫn ký từ tệp cũ (so mã tệp trong URL, hoặc so qua database `photo_file_id`).
- **N8, "thu hồi (đường 6) không ghi nhật ký" lọt.**
  - `giay-chung-nhan.test.ts:407` đếm `certificate.revoked` nhưng cả hai dòng đều đến từ **cấp lại**.
  - Cách chặn: sau "thu hồi" ở S13, kiểm có đúng 1 dòng `certificate.revoked` với `entityId` bản đó và `data.reason`.

**T4. (Quy trình, sổ lỗi 19 tái phạm) Commit chấm không chạy được cửa gác.**
- `08de168` mang theo đường "lần in" của G-M4 dở (`apps/api/src/modules/print/routes.ts:7` gộp `printRoutes`). Fixture cửa gác chưa có `:printId`, nên `tenant-isolation.test.ts` đỏ cả tệp, 14 đột biến cũ đỏ giả.
- Kèm: typecheck web đỏ 1 lỗi (G), `khop-hop-dong` đỏ 2 (G).
- Tôi phải tách 1 dòng (trap khôi phục) mới đo được 1464/1464.
- Cách chặn: điều phối giao chấm một commit đã qua `pnpm -r typecheck` + cửa gác, hoặc G-M4 phải thêm `printId` vào `buildGateFixture` cùng lúc đăng ký đường.

### Nhẹ

- **L1. Ngưỡng "ảnh nhỏ" là 300 px, bản vẽ ghi 500.** Bản vẽ 6.2 và R&D-08 mục "ảnh mờ khi in" ghi "< 500". `apps/web/src/features/certificates/logic.ts:102` (`SMALL_PHOTO_PX = 300`) và so `<`, nên ảnh 300×300 **không** bị báo (đo thật: Phạm Quỳnh Như không có nhãn). Nên đổi 500 hoặc ghi quyết định vào nhật ký.
- **L2. "Lớp Lớp K12".** Sổ thêm chữ "Lớp " trước tên lớp: `RegisterPage.tsx:630` (dòng phụ trong bảng), `:717` (chip "Lớp Lớp K12 ×"). Tên lớp thường đã có chữ "Lớp". Tương tự nhãn đọc màn hình `courses/ClassCard.tsx:60` ("Lớp Lớp K12"). Giấy in **không** bị (cc.js xử lý đúng).
- **L3. Cửa gác mù với `?ids=`.** `apps/api/test/gate-samples.ts:287` ghi rõ "mẫu ids không có trường …Id — chỉ chạy mẫu gốc". Đột biến N4 (lộ giấy tổ chức khác qua `ids`) chỉ bị S14 bắt, cửa gác 1464/1464 xanh. Nên cho crossRef thay giá trị `ids` bằng mã của tổ chức kia.
- **L4. Tên xuống 2 dòng.** Bản vẽ 5.2 ghi tên "tự co một dòng".
  - Thực tế tên dài xuống 2 dòng ở 01, 04, 05, 07, 10, 13, 16.
  - Mẫu 09 cả tên ngắn "Đinh Thị Học Viên 09" cũng xuống 2 dòng.
  - Không tràn, đọc rõ. Nên để anh Chiến xem ảnh `pdf-cap-lai-mau-*.jpg` và chọn.
- **L5. Cấp lại không gửi tên thì quay về tên hồ sơ.**
  - Đúng bản vẽ 4.6. Nhưng một bản **đã sửa tên** (vd. "Hoàng Gia Bảo Anh"), khi cấp lại chỉ để đổi mẫu, sẽ in lại tên hồ sơ cũ "Hoàng Gia Bảo" nếu người dùng không gõ lại (đo thật: CC-2026-0008 `reissue_no 2`).
  - Hộp cấp lại điền sẵn tên **hồ sơ** chứ không phải tên **đang in**. Nên điền sẵn `studentName` của bản đang hiệu lực khi lý do là "Đổi mẫu".
- **L6.** Tệp riêng của pdf-lib tên `index-*.js` (Vite đặt theo tệp vào của pdf-lib). Cách kiểm ở việc tồn 78 / bản vẽ mục 8 ("không nằm trong index-*.js") dễ đọc nhầm. Thực tế tách đúng. Nên kiểm bằng "tệp vào `main-*.js` không chứa `PDFDocument`".
- **L7.** Phản hồi chống gửi trùng phát lại có thứ tự khoá JSON khác lần đầu (lưu bằng jsonb). Nội dung giống hệt, vô hại.
- **L8 (đã có trong việc tồn, nhắc lại):** việc tồn 84 (2 bản nhãn trạng thái) còn nguyên; việc tồn 69, 70 không đổi ở commit này.

---

## 6. Anh Chiến dùng thật được chưa

**Phần cấp, sổ, in trên máy tính: dùng được ngay** trên máy anh (chạy theo `docs/CHAY-THU-TREN-MAY.md`).
- Cuối khoá: vào Đào tạo → lớp đã kết thúc → "Cấp chứng nhận" → chọn mẫu → bỏ tích ai không cấp → "Cấp và in" → "In ngay" (chọn A4, Ngang, lề Không) hoặc "Tải PDF".
- Học viên nợ học phí vẫn cấp được, có dải vàng nhắc.
- Sai tên: Giấy chứng nhận → ⋯ → Cấp lại (giữ số). Cấp nhầm: Thu hồi (bắt buộc lý do).

**Nhưng giấy sẽ in chữ cái đầu thay ảnh** cho tới khi thợ vá **T1** (khoảng nửa ngày: ô tải ảnh trong hồ sơ khách + 1 bài).
- Mẫu 08 không nên dùng cho **bản cấp lại** cho tới khi vá **T2** (1 dòng CSS + 1 phép kiểm).
- **T3** là thêm 2 bài thử, không đổi mã chạy.

**Buổi thử thật (gói TT), chờ anh:**
- iPhone (Safari) và Android (Chrome): "Chia sẻ PDF" mở được bảng In / Zalo / Lưu không. Ở máy thử, lời gọi chia sẻ nằm đúng trong lượt bấm, nhưng chưa có máy thật.
- Hướng ngang khi in qua AirPrint / Mopria. Chữ có nét không khi in thật: ảnh 150 dpi, chữ vàng.
- Thời gian 8 và 30 người trên điện thoại. Máy build đo 22 giây / 61 giây; điện thoại có thể chậm gấp 2–3 lần.
- Cỡ tệp gửi Zalo: 30 người khoảng 9,5 MB.
- Cần tên miền (việc tồn 1) để mở app trên điện thoại.

---

## 7. Còn giữ để tái hiện; đã dọn

**Database `makeup_test_cham_f_dung` (giữ):**
- Tổ chức A slug `cham-f-a-1792989836407`. Chủ `cham-f-a-chu-1792989836407@thu.local`. Mật khẩu thử và mã mọi thứ ở `scratchpad/cham-f/pw/seed.json`.
- Có B (`cham-f-b-…`) và C (TEAM).
- Ảnh nằm ở `scratchpad/cham-f/storage` (đặt `STORAGE_LOCAL_DIR` trỏ vào đó khi chạy lại).
- Có thêm một tổ chức "Học viện a" dở do lần gieo đầu hỏng giữa chừng (không ảnh hưởng).

**Chạy lại** (từ một bản tách mới của `08de168`, sau `pnpm install` và build):
```
DATABASE_URL=…_dung DIRECT_URL=…_dung NODE_ENV=development PORT=4700 MAIL_DRIVER=console \
  STORAGE_LOCAL_DIR=<scratchpad>/cham-f/storage WEB_APP_URL=http://localhost:5700 CORS_ORIGINS=http://localhost:5700 \
  AUTH_RATE_LIMIT_PER_MINUTE=1000 node apps/api/dist/server.js
API_DEV_TARGET=http://localhost:4700 apps/web/node_modules/.bin/vite preview --port 5700 --strictPort   # trong apps/web
```

**Đã dọn:**
- **Tiến trình, tắt theo PID của tôi:**
  - Lượt 1: API 4761, preview 5079 (mất khi phiên dừng).
  - Lượt 2: API 463, preview 464 (kèm tiến trình con esbuild 496).
  - Sau khi tắt, cổng 4700 và 5700 không còn nghe.
- **Bản tách:** 29 lần cài đột biến đều khôi phục khớp HEAD; trước khi gỡ, `git status` chỉ còn 5 tệp `.bat` lệch kiểu xuống dòng (như biên bản D, E). Đã gỡ bằng `git worktree remove --force`.
- **Database:** đã xoá `makeup_test_cham_f`, `_khop`, `_m4`, `_m5`. Giữ `makeup_test_cham_f_dung`.
