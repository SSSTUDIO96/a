# Biên bản nghiệm thu Web 2: Bảng giá · Hợp đồng · Lịch (+ ô nhập mới, khung điều hướng)

- **Ngày chấm:** 18/10/2026 (giờ máy UTC 18:35–19:20)
- **Người chấm:** thợ chấm độc lập (AI, không tham gia viết mã). Không sửa mã sản phẩm, không commit.
- **Bản được chấm:** commit `193d6aa`, worktree riêng (đã gỡ sau khi chấm).
- **Môi trường riêng:**
  - Bộ Prisma riêng: chép `@prisma/client` vào `apps/api/node_modules` của worktree rồi `prisma generate` (bộ dùng chung giữ nguyên giờ sửa 18:00:58, không bị ghi đè — sổ lỗi 17).
  - Database `makeup_test_cham_web2` (bật `btree_gist`), áp migration bằng `pnpm db:deploy-to` → "khớp" (sổ lỗi 16). Đã xoá sau khi chấm.
  - Máy chủ API cổng 4120 (đặt cả `DATABASE_URL` và `DIRECT_URL`); web = **bản build** + `vite preview` cổng 5190; Chromium ở `/opt/pw-browsers`.
- **Dùng thật như studio:** 1 chủ + 4 thợ (3 bậc) + lễ tân + kế toán; tạo bằng giao diện 8 dịch vụ (4 dịch vụ phụ, 2 phụ phí, 2 dịch vụ trong gói), 5 gói, chính sách phí km + 2 bậc khoảng cách + 2 studio; lập **11 hợp đồng** (tại nhà theo km, cố định, nơi khác nhập tay 0 đ, 2 dòng cùng hợp đồng, khoản tự đặt tên, phụ phí, giảm giá, cọc, thợ trùng giờ, thợ có lịch trong ngày, huỷ dòng, phát sinh, huỷ hợp đồng), xem lịch 3 chế độ ở 1440 / 1024 / 390, sửa ca, huỷ ca, tuần dày 38 ca.

---

## 0. Kết luận ngắn cho chủ studio

**KẾT LUẬN CHUNG: KHÔNG ĐẠT** — vì 2 lỗi nghiêm trọng. Phần nhìn thấy làm rất sát bản mẫu C và số tiền khớp tuyệt đối; nhưng có một lỗ làm **mất ca makeup khỏi lịch**, và bản lưu không build được.

**Đã làm chắc (đo được):**
- **Số tiền trên màn = số máy chủ: 114/114 ô** (7 hợp đồng × 3 khổ: tiền từng dòng, tạm tính, tổng, thanh tổng, cọc). Ví dụ phí km: 12,35 km, miễn 5 km theo gói, khứ hồi → 14,7 km × 10.000 = **147.000 ₫**, đúng công thức.
- **Hộp chi tiết gói đủ 5/5 nhóm, 19/19 ô của bản mẫu** — đúng chỗ anh từng nhắc "Thiếu vị trí địa điểm makeup kìa". Danh sách gói chỉ còn tên · nơi làm · giá, không ô tick (hết "Rối quá").
- **Cảnh báo thợ trùng giờ thật** (thợ đã có ca đã xác nhận): dải đỏ + khoá nút Xác nhận; **có lịch trong ngày**: dải vàng, vẫn xác nhận được. Đúng ý anh.
- **409 khi đua:** hợp đồng A đang mở, hợp đồng B chốt trước cùng thợ → bấm Xác nhận A: máy chủ từ chối, A vẫn là nháp, dải đỏ ghi đúng "Trần Khánh Linh đã có lịch LH-000005 10:30–11:30".
- **Bấm Xác nhận hai lần nhanh:** chỉ 1 lệnh gửi đi. **Mất mạng:** nút Lưu khoá, dải vàng báo, chữ đã gõ còn nguyên.
- **Lịch:** mở ra luôn là C; đủ 3 chế độ; tuần 38 ca không vỡ; 409 khi sửa ca giữ hộp, có nút "Đổi thợ / Đổi giờ", tô đỏ ô trùng.
- **Không tràn ngang** ở mọi màn đã thử (0 lỗi / 63 lần đo); **không chữ tiếng Anh**; trình duyệt en-US + múi giờ Mỹ vẫn hiện ngày dd/mm/yyyy, giờ 24h, tiền 3.197.000 ₫.
- **Quyền:** thợ gõ thẳng đường hợp đồng → "Bạn không có quyền xem hợp đồng."; kế toán chỉ xem; lễ tân không huỷ được dòng đã chốt; thợ chỉ thấy hàng của mình trên lịch.

**Phải sửa trước khi cho anh thao tác thật:**
1. **(Nghiêm trọng) Hợp đồng xác nhận được khi chưa gán thợ — và khi đó KHÔNG có ca nào trên Lịch**, kể cả hàng "Chưa có thợ". Khách đã chốt, đã cọc, mà lịch trống → dễ bỏ lỡ buổi cưới.
2. **(Nghiêm trọng) Commit `193d6aa` không build được, kiểm tra kiểu đỏ, 4 bài thử web đỏ, 2 bộ bài không nạp được** — thiếu 3 tệp của thợ khác (chưa đưa vào commit).
3. **(Trung bình)** Hai hợp đồng **nháp** cùng thợ cùng giờ thì cả hai bị khoá nút Xác nhận và hiện đỏ "hợp đồng sẽ không xác nhận được", trong khi máy chủ vẫn cho xác nhận (200). Ô chọn thợ thì lại ghi đúng nhãn xám "Giữ chỗ nháp".
4. **(Trung bình)** Hai thẻ trình duyệt cùng sửa một hợp đồng nháp: thẻ sau **xoá im lặng** giảm giá thẻ trước vừa lưu (100.000 → 0).
5. **(Trung bình)** Ở Lịch, gõ nhầm giờ kết thúc trước giờ bắt đầu (09:00 – 08:30) → lưu thành **ca 23,5 giờ** chiếm thợ tới sáng hôm sau.
6. **(Trung bình)** Lễ tân không huỷ được một dòng đã chốt (403) nhưng **huỷ được cả hợp đồng đã chốt** (200).
7. **(Trung bình)** Màu ca trên lịch vẫn **đoán theo chữ trong tên ca**, trái quyết định 20:31; máy chủ đã gửi tên nhân vật nhưng web chưa dùng (đây cũng là lý do bài "khớp hợp đồng" đỏ).
8. **(Trung bình)** Bảng giá nhận giá **900 nghìn tỷ** không hỏi lại (phiếu thu có trần 100 tỷ).

---

## 1. Bảng lệnh đã chạy và kết quả thật

| # | Lệnh (trong worktree `193d6aa`) | Kết quả thật |
|---|---|---|
| 1 | `apps/web: pnpm typecheck` | **ĐỎ**: `src/features/staff/StaffPage.tsx(4,32) TS2307 Cannot find module './PayRatesScreen'` |
| 2 | `apps/web: pnpm test` (`KHOP_HOP_DONG_DATABASE_URL` = database riêng) | **ĐỎ: 376/380 qua, 4 đỏ; 2 bộ không nạp được** (32 tệp: 28 qua, 4 hỏng). Chi tiết dòng 2a–2c |
| 2a | — 2 bộ không nạp | `AppShell.test.tsx`, `PricingPage.test.tsx`: "Failed to resolve import ./platform.css" (54 bài không chạy) |
| 2b | — `khop-hop-dong.test.ts` 9/12 | Kiểu khai trong `types.ts` lệch máy chủ: lịch thừa `staff[].displayName`, `staff[].avatarUrl`, `subjectName`; thu tiền thừa `customer.phoneHidden`; bài "đã gọi đủ hàm" đỏ theo |
| 2c | — `check-bundle-secrets.test.ts` 32/33 | Vế BẮT 32/32 xanh (kể cả khoá `AIza…`); vế GIỮ đỏ vì bản build hỏng (`Could not resolve "./PayRatesScreen"`) |
| 3 | `apps/web: pnpm build` | **ĐỎ** ngay bước `tsc` (lỗi dòng 1) |
| 4 | Thợ chấm build bằng cấu hình riêng `cham-nt/vite.cham.config.mjs` (thay 3 tệp thiếu bằng mô-đun rỗng lúc build, **không sửa tệp sản phẩm**) | Ra `index-*.js` 639,30 KB (gzip 198,16 KB). Cửa gác bí mật trên bản này: **13/13 tệp · 0 vi phạm** |
| 5 | Chạy lại 2 bộ không nạp với tệp thiếu thay rỗng (`cham-nt/vitest.cham.config.mjs`) | **53/54**: `PricingPage` 23/23; `AppShell` 30/31 — đỏ "Thu tiền": tiêu đề là "Thu tiền hợp đồng dịch vụ makeup", bài đòi "Thu tiền" (`AppShell.test.tsx:185`) |
| 6 | `apps/api: pnpm test` (`TEST_DATABASE_URL` = database riêng, bộ Prisma riêng) | **XANH**: `tsc` 0 lỗi; **397/397** (29/29 tệp). Cửa gác: scope 73/73, outsider 73/73, noPerms 73/73, unauth 83/83, crossId 36/36, leak 30/30, refBase 23/23, crossRef 54/54, keep 73/73, platform 40/40; sửa một phần 15/15; đột biến 12/12 đỏ đúng phép |
| 7 | Bài dùng thật của thợ chấm (Playwright, 36 kịch bản `e1…e36`) | Mục 3–5 |
| 8 | `node tai-hien.mjs` (bài tái hiện gộp) | **6/6 lỗi còn tái hiện** (mục 4) |

**Gốc của dòng 1–3:** 3 tệp được nhập nhưng không có trong commit: `apps/web/src/features/staff/PayRatesScreen.tsx`, `apps/web/src/features/staff/staff.css`, `apps/web/src/features/platform/platform.css`. Chúng chỉ vào kho ở commit sau (`f5031e6`, "WIP các thợ đang làm"). Commit `193d6aa` ghi "W5 Hợp đồng xong (39/39 bài màn)" — đúng cho riêng bài hợp đồng (16/16 + 23/23 xanh), nhưng toàn bộ web thì đỏ. Đây là đúng kiểu sổ lỗi 13 ("lưu khi bài thử đang đỏ").

---

## 2. Chấm ĐÚNG / ĐẠT / ĐẸP

| Màn | ĐÚNG (làm đúng việc hứa) | ĐẠT (đủ nhóm/ô như bản mẫu) | ĐẸP (không phá thứ khác) |
|---|---|---|---|
| **Bảng giá** | ✔ Lưu gói: PATCH → giá → tiền công, đúng thứ tự; giá bán > niêm yết báo "Giá khuyến mại không được lớn hơn giá niêm yết", giữ hộp. ✔ Chính sách đọc lại khớp 6/6 trường + 2 bậc. ✘ Nhận giá 900 nghìn tỷ (T7) | ✔ Hộp gói **5/5 nhóm, 19/19 ô** (+3 ô thêm có trường thật: Mã, Đang bán, Bán kính miễn phí). ✔ Dòng gói 3 thông tin, 0 ô tick. ✔ Phí di chuyển 6/6 dòng + bậc + studio. ✔ Điện thoại: nút chuyển 4 ô | ✔ 0 tràn ngang (15 lần đo). ✘ "Phụ phí ngày lễ · 1 phút" (N5) |
| **Hợp đồng** | ✔ **114/114 ô tiền khớp máy chủ**. ✔ Đỏ/vàng với ca thật đúng mức. ✔ 409 đúng luật. ✔ Bấm đúp = 1 lệnh. ✘ Xác nhận được khi chưa có thợ → 0 ca (S1). ✘ Giữ chỗ nháp chặn nhầm (T1). ✘ Hai thẻ ghi đè (T2). ✘ Lễ tân huỷ cả hợp đồng đã chốt (T4) | ✔ Thẻ dòng 7/7 hàng (đầu thẻ · Giờ · Thợ phụ trách · Dịch vụ phụ · Làm ở đâu · Di chuyển · Chân thẻ); thẻ tổng 5/5; thanh tổng; cột trái "Bảng giá" ↔ "Thêm phát sinh"; ngăn kéo đáy trên điện thoại | ✔ 0 tràn ngang (21 trang × 3 khổ). ✘ Mã "HD-/000001" bị bẻ dòng ở 1024 (N1). ✘ Khối khách sau lưu (N6). ✘ Số thô trong lời lỗi (N8) |
| **Lịch** | ✔ Mặc định C, không nhớ lựa chọn (đúng quyết định 15:40). ✔ 409 khi sửa ca: 4/4 việc của bản vẽ (giữ hộp, dải đỏ, viền đỏ ô, nút Đổi thợ/Đổi giờ). ✔ Huỷ ca bắt buộc lý do. ✔ Thợ chỉ thấy hàng mình. ✘ Giờ ngược → ca 23,5 giờ (T3). ✘ Màu đoán theo chữ (T5) | ✔ 3/3 chế độ; thanh công cụ 6/6 phần; C điện thoại xoay trục, "+2" khi > 3 ca; B có "Thợ trong ngày"; A trục 04:00–18:00. ✘ Thiếu mục con "Ngày nghỉ của thợ" (N10) | ✔ 0 tràn ngang trang (9 lần đo, tuần 38 ca). ✘ Tên thợ bẻ giữa chữ "Nguyễ / n Thu Hà" (N2); tên thợ cắt cụt ở lưới (N3) |
| **Ô nhập mới** (MoneyInput, UnitInput, DateInput, TimeInput) | ✔ Dán "2.500.000đ" → 2.500.000 ₫; "1,5tr", "-500000", 20 chữ số → báo lỗi, không nhận. ✔ km "12,5" nhận; "2.500" → "Dấu chấm dễ nhầm: gõ 2,5 hoặc 2500"; "2.5", "12,345", "100000" đều báo đúng. ✔ 29/02/2027, 31/04/2027, 00/01/2027 → "Không có ngày …"; 29/02/2028 nhận | ✔ | ✔ |
| **Khung điều hướng** | ✔ Ẩn mục theo quyền; thợ gõ thẳng đường → dải "Bạn không có quyền …" | ✘ Thiếu "Tổng quan" và menu con Lịch (N10) | ✔ 3 điểm gãy đúng; thanh dưới 5 ô |

---

## 3. Đếm từng nhóm/ô so với bản mẫu

**Hộp chi tiết gói** (so `docs/rnd/anh/v2-phuong-an-C-bang-gia-chi-tiet-goi-desktop.png`; mã `apps/web/src/features/pricing/PackageDialog.tsx`; đếm DOM ở 1440 / 1024 / 390 đều ra cùng số):

| Nhóm | Bản mẫu | Bản chấm | Ảnh |
|---|---|---|---|
| Thông tin & giá | 7 ô | 7/7 (+ Mã khi tạo, + Đang bán) | `anh/goi-sau-tao-1440.png` |
| Địa điểm cho phép | 3 ô | 3/3 (+ Bán kính miễn phí) | `anh/hop-goi-390-full.png` |
| Đã gồm trong gói | 2 dòng + nút | 2/2 + nút | `anh/hop-goi-390-cuoi.png` |
| Dịch vụ phụ cho tick | 4 ô | 4/4 (món đã gồm thì mờ, có "?") | như trên |
| Tiền công thợ theo bậc | 3 bậc | 3/3 (ảnh + tên bậc + tên thợ + ô tiền) | như trên |
| **Tổng** | **5 nhóm / 19 ô** | **5/5 nhóm, 19/19 ô** | |

**Lập hợp đồng** (so `v2-phuong-an-C-hop-dong-desktop.png`): thẻ đầu 3/3 (tiêu đề + trạng thái, khách, ngày); thẻ dòng 7/7 hàng; thẻ "Phụ phí & khoản khác" 2/2 nút; thẻ tổng 5/5; thanh tổng 4/4 (Tổng, Cọc, Lưu nháp, Xác nhận). Một chỗ khác bản mẫu: sau khi lưu, khối khách **không** đổi thành thẻ khách có nút "Đổi" (N6).

**Lịch C** (so `phuong-an-C-lich-desktop.png`): thanh công cụ 6/6; đầu cột ngày 3/3 (thứ · ngày · "n ca", T7/CN màu nhấn); hàng thợ 3/3 (ảnh · tên · "Bậc · n ca/tuần") + hàng "Chưa có thợ"; chú thích màu. Ô "Nghỉ phép" của bản mẫu: chưa có màn tạo ngày nghỉ (N10).

---

## 4. Lỗi đã tái hiện

Bài tái hiện gộp: `bai-thu/tai-hien.mjs` (in "LỖI CÒN"/"ĐÃ HẾT" cho từng mục). Lần chạy cuối:
```
T1 giữ chỗ nháp chặn nhầm: màn khoá=true, dải đỏ=true, máy chủ xác nhận → 200 ⇒ LỖI CÒN
NGHIÊM TRỌNG xác nhận không thợ: xác nhận → 200, số ca trên lịch = 0 ⇒ LỖI CÒN
T2 hai thẻ ghi đè: giảm giá sau thẻ 1 = 100000, sau thẻ 2 = 0 ⇒ LỖI CÒN
T3 giờ ngược ở Lịch: ca lưu dài 23.5 giờ ⇒ LỖI CÒN
T4 lễ tân: huỷ một dòng → 403, huỷ cả hợp đồng đã chốt → 200 ⇒ LỖI CÒN
T5 giá 900 nghìn tỷ → 201 ⇒ LỖI CÒN
```

### NGHIÊM TRỌNG

**S1. Hợp đồng xác nhận được khi dòng chưa có thợ, và khi đó không có ca nào trên Lịch**
- **Triệu chứng:** điện thoại 390, lập HD-000008 "Mẹ cô dâu" 15:00–16:00 ngày 24/11, **không chọn thợ**, nút "Xác nhận hợp đồng" vẫn bấm được → "Đã xác nhận". Lịch ngày 24/11: **0/1 ca** gắn hợp đồng này (lọc theo `contractId` cũng 0); hàng "Chưa có thợ" và khối "Cần xử lý" của chế độ B đều không thấy. Thẻ dòng chỉ ghi mờ "Chưa chọn".
- **Vì sao nghiêm trọng:** anh đã yêu cầu "Chỗ này không gán cho nhân sự phụ trách hả?" — sổ ý muốn ghi luật "ô nào sinh ra việc phải làm thì phải có người làm". Hiện tại một hợp đồng đã chốt (có thể đã thu cọc) có thể **biến mất khỏi lịch** mà không ai được báo.
- **Tái hiện:** `bai-thu/e35.mjs` (giao diện), mục "NGHIÊM TRỌNG" trong `bai-thu/tai-hien.mjs`. Ảnh: `anh/hd-moi-390-tai-nha.png` (chưa thợ, nút Xác nhận sáng), `anh/hd-xac-nhan-khong-tho-390.png` (đã xác nhận, "Chưa chọn").
- **Gốc:**
  - Web: `apps/web/src/features/contracts/ContractEditor.tsx` — `onConfirm` chỉ chặn khi có dòng trùng giờ (`if (blockedReason) return`, `blockedReason = confirmBlockedReason(overlapLineCount(warnings))`); `validateDraft` (`model.ts`) không đòi thợ.
  - Máy chủ: `apps/api/src/modules/contracts/routes.ts:567-569` "Xác nhận hợp đồng = lên lịch cho các dòng **có thợ**"; `sheet.ts:325` `if (staff.length === 0) return []`.
- **Hướng sửa (để chủ chọn):** hoặc bắt buộc mỗi dòng có thợ trước khi xác nhận, hoặc vẫn tạo ca không thợ để hiện ở hàng "Chưa có thợ" / "Cần xử lý".

**S2. Commit `193d6aa` không build được**
- Xem mục 1, dòng 1–3. Nếu đưa bản này lên Vercel thì bước build dừng ngay. Thợ chấm phải thay 3 tệp thiếu bằng mô-đun rỗng lúc build mới chấm được (không sửa tệp sản phẩm; cấu hình ở `bai-thu/vite.cham.config.mjs`).

### TRUNG BÌNH

**T1. Hợp đồng nháp khác "giữ chỗ" cùng thợ → màn khoá Xác nhận, trong khi máy chủ cho xác nhận**
- **Triệu chứng:** HD-000003 và HD-000004 (đều nháp) cùng Linh/Tú 06:00–08:00 ngày 21/11. Mở HD-000003: hai dải đỏ "Trùng giờ 06:00–08:00 — hợp đồng sẽ không xác nhận được", nút Xác nhận **khoá**. Cùng lúc, ô chọn thợ ghi nhãn xám "Giữ chỗ nháp" (đúng bản vẽ: "Chưa chặn lịch"). Gọi máy chủ xác nhận HD-000003 → **200**. Hai bản nháp khoá chéo nhau; một bản nháp bỏ quên đủ chặn mọi hợp đồng khác của thợ đó.
- **Tái hiện:** `bai-thu/e20.mjs`, mục T1 của `tai-hien.mjs`. Ảnh: `anh/loi-giu-cho-nhap-chan-xac-nhan.png`, `anh/loi-giu-cho-nhap-o-chon-tho.png` (hai chỗ nói ngược nhau trên cùng màn).
- **Gốc:** `apps/api/src/modules/contracts/present.ts:96-98` gán `level = 'OVERLAP'` khi chỉ có `draftHolds` trùng giờ; web gộp cảnh báo máy chủ (`ContractEditor.tsx`, `mergeWarnings`/`serverWarnings`) và coi mọi `OVERLAP` là chặn. Bản vẽ C mục 4.3: "Có `draftHolds` → nhãn xám 'Giữ chỗ nháp' … Chưa chặn lịch."

**T2. Hai thẻ trình duyệt cùng sửa một hợp đồng nháp: thẻ sau ghi đè im lặng**
- **Triệu chứng:** HD-000005 mở ở hai thẻ. Thẻ 1 đặt giảm giá 150.000, Lưu (máy chủ: 150.000). Thẻ 2 (vẫn bản cũ) chỉ sửa ghi chú, Lưu → máy chủ: giảm giá **0**, tổng về 1.950.000. Thẻ 2 không báo gì.
- **Tái hiện:** `bai-thu/e23.mjs`, mục T2 của `tai-hien.mjs`. Ảnh: `anh/hai-tab-tab2-sau-luu.png`.
- **Gốc:** `PATCH /contracts/:id` không kiểm phiên bản (`apps/api/src/modules/contracts/routes.ts:296+`, không có `updatedAt`/`If-Match`); web gửi lại toàn bộ hợp đồng (`ContractEditor.tsx`, `save()` → `patchBody(draft)`).

**T3. Lịch: giờ kết thúc trước giờ bắt đầu được lưu thành ca qua đêm**
- **Triệu chứng:** sửa LH-000002 thành 09:00 – 08:30 → chỉ có dòng chữ nhỏ "Kết thúc Chủ nhật 22/11", bấm Lưu → ca **23,5 giờ** (21/11 09:00 → 22/11 08:30), thợ Hà bị chiếm cả đêm. Ở màn Hợp đồng, cùng thao tác đó lại bị coi là lỗi ("Giờ kết thúc phải sau giờ bắt đầu") — hai màn cư xử khác nhau.
- **Tái hiện:** `bai-thu/e29.mjs`, mục T3 của `tai-hien.mjs`. Ảnh: `anh/lich-gio-nguoc-thanh-qua-dem.png`.
- **Gốc:** `apps/web/src/features/schedule/AppointmentDialog.tsx:106-109` (`endDay = f.end <= f.start ? addDays(f.day, 1) : f.day`). Đề xuất: hỏi lại khi ca dài quá vài giờ, hoặc chỉ cho qua đêm khi tick rõ.

**T4. Lễ tân huỷ được cả hợp đồng đã xác nhận**
- **Triệu chứng:** lễ tân huỷ một dòng của hợp đồng đã chốt → 403 "cần quyền điều chỉnh hợp đồng"; nhưng huỷ **cả** HD-000007 đã chốt → **200**. Màn hợp đồng đã chốt hiện nút "Huỷ hợp đồng" cho lễ tân (`anh/quyen-letan-hd1.png`). Quyết định G2 (17:05) nói "Tiền đã chốt với khách thì chỉ người có trách nhiệm mới được giảm" — huỷ cả hợp đồng là giảm về 0.
- **Tái hiện:** mục T4 của `tai-hien.mjs`.
- **Gốc:** `apps/api/src/modules/contracts/routes.ts:541+` (đổi trạng thái chỉ đòi `contracts.write`). **Cần chủ quyết** có cho lễ tân huỷ hợp đồng đã chốt hay không.

**T5. Màu ca đoán theo chữ trong tên ca; `types.ts` lệch máy chủ**
- **Triệu chứng:** "Mẹ cô dâu" tô màu Cô dâu, "Cô dâu – Lễ ăn hỏi" tô màu Ăn hỏi, gói "Makeup dự tiệc" của Phù dâu sẽ thành "Tiệc". Chú thích vẫn có "Ăn hỏi", "Tiệc & sự kiện". Quyết định 20:31 ghi rõ: tô theo **nhân vật**, bỏ hai nhóm màu kia, "không đoán theo chữ trong tên ca". Máy chủ đã gửi `subjectName` cho ca, nhưng `types.ts` chưa khai → bài "khớp hợp đồng" đỏ 3/12.
- **Ảnh:** `anh/lich-dày-C-1440.png`. **Gốc:** `apps/web/src/features/schedule/model.ts:31-40` (`toneOf(title)`), `parts.tsx:32, 87`.

**T6. Bảng giá nhận giá 900 nghìn tỷ không hỏi lại**
- **Triệu chứng:** hộp gói "Phù dâu", Giá niêm yết = 900.000.000.000.000 → Lưu, hộp đóng, giá mới có hiệu lực ngay (`listPrice 900000000000000`, trạng thái CURRENT). Phiếu thu thì có trần 100 tỷ ("kiểm lại số 0 gõ thừa"). Hợp đồng mới chọn gói này báo giá theo số đó (số lượng 11 thì máy chủ báo "Thành tiền dòng vượt ngưỡng"). Thợ chấm đã trả giá về 500.000.
- **Tái hiện:** `bai-thu/e34.mjs` (bản đầu), mục T5 của `tai-hien.mjs`. Ảnh: `anh/tan-cong-gia-ban-lon-hon.png` (vế đúng: giá bán > niêm yết bị chặn).
- **Gốc:** `apps/api/src/modules/catalog/services.ts` (`NewPriceBody` chỉ chặn ở `MAX_SAFE_INTEGER`); ô `MoneyInput` cũng chỉ chặn ở ngưỡng đó.

### NHẸ

- **N1. Mã hợp đồng bị bẻ dòng ở 1024:** "Hợp đồng HD- / 000001". Ảnh `anh/hd1-1024.png`. Tiêu đề thẻ đầu chưa `nowrap` cho mã.
- **N2. Tên thợ bẻ giữa chữ** trong hộp sửa ca khi đã chọn: "Nguyễ / n Thu / Hà" (cột tên bị nhóm nút "Chính/Phụ" và tên bậc ép). Ảnh `anh/lich-409-trung.png`, `anh/lich-gio-nguoc-thanh-qua-dem.png`.
- **N3. Lưới C cắt cụt tên thợ:** "Nguyễn Thu …" (1440), "Nguyễn T…" (1024); bản mẫu dùng tên ngắn "Thu Hà". Ảnh `anh/lich-1440.png`, `anh/lich-dày-C-1024.png`.
- **N4. Danh sách hợp đồng 1440:** cột ngày / tổng / trạng thái không thẳng hàng (lệch theo độ rộng nhãn). Ảnh `anh/hop-dong-ds-1440.png`.
- **N5. Phụ phí bắt buộc thời lượng ≥ 1 phút:** danh sách hiện "Phụ phí ngày lễ · 1 phút" — ô vô nghĩa với chủ studio. Gốc `apps/api/src/modules/catalog/common.ts:42` (`Duration.min(1)`), `apps/web/src/features/pricing/logic.ts:558`. Ảnh `anh/bang-gia-dich-vu-1440.png`.
- **N6. Khối khách sau lần lưu đầu:** vẫn là hai ô "Khách mới" sửa được + "Chọn khách có sẵn" (cả khi đã xác nhận). Sửa tên rồi Lưu → bị bỏ im lặng, tải lại vẫn tên cũ. Bản mẫu: sau khi có khách là thẻ khách có nút "Đổi". `bai-thu/e36.mjs`, ảnh `anh/hd-sau-luu-khoi-khach.png`.
- **N7. Lỗi chỉ hiện sau khi bấm Lưu:** giờ ngược, hoặc "Cố định" khi có bán kính miễn phí mà chưa nhập km → tiền hiện "—" mà không nói vì sao; lý do khoá nút "Chọn thợ" chỉ nằm trong `aria-label`. Ảnh `anh/tan-cong-gio-nguoc.png`, `anh/hd3-co-dinh-thieu-km.png`.
- **N8. Lời lỗi in số thô và nằm cuối trang:** "Giảm giá hợp đồng (99000000) lớn hơn tổng các dòng (1950000)"; "Tiền cọc (999999999) không được lớn hơn tổng hợp đồng (1950000)". Không hiện dưới ô Giảm giá như bản vẽ mục 5. Trong lúc đó thẻ tổng và thanh tổng giữ số của lần báo giá trước (1.500.000), trong khi thẻ dòng đã thành "—". Ảnh `anh/tan-cong-giam-qua-tong.png`.
- **N9. Danh sách thợ không thống nhất:** ô chọn thợ của hợp đồng có 7 người (gồm chủ, lễ tân, kế toán ở "Chưa xếp bậc"); lưới lịch và hộp sửa ca chỉ có 4 thợ có bậc. Ảnh `anh/kham-chon-tho-1440.png`, `anh/lich-sua-ca.png`.
- **N10. Khung:** thiếu "Tổng quan" và menu con "Xem lịch · Ngày nghỉ của thợ" (bản vẽ C mục 2.1); chưa có màn tạo ngày nghỉ nên lưới không có ô "Nghỉ phép" như bản mẫu.
- **N11. Ghi nhận (cần chủ quyết):** sửa giờ ca ở Lịch không đổi giờ trên dòng hợp đồng (HD-000002 vẫn ghi 08:00–09:00, ca đã là 09:00–10:00); huỷ ca của hợp đồng đã chốt không đổi gì ở hợp đồng; sau khi xác nhận, dòng công thức km biến mất.

### Nghi ngờ, chưa tái hiện

1. Gán chủ, lễ tân hay kế toán (không có bậc) làm thợ của dòng rồi xác nhận: ca có hiện trên lưới C không, khi lưới chỉ vẽ hàng cho 4 thợ có bậc? Chưa thử.
2. Ô tiền trong hộp gói khi dán bằng bàn phím thật (Ctrl+V) trên Safari/iOS — chỉ thử bằng sự kiện dán trên Chromium.

---

## 5. Đã tấn công nhưng KHÔNG phá được

- **Ô tiền** (dán): "2.500.000đ", "2.500.000 ₫" → 2.500.000 ₫; "1,5tr" → "Chỉ nhập chữ số."; "-500000" → "Số tiền không được âm."; 20 chữ số → "Số tiền quá lớn.". Giá trị không bị đổi ngầm.
- **Ô km** (bảng giá và hợp đồng): "12,5" nhận và tính đúng 150.000 ₫; "2.500" → "Dấu chấm dễ nhầm: gõ 2,5 hoặc 2500."; "2.5", "12,345", "100000" đều báo đúng chữ.
- **Ô ngày:** 29/02/2027, 31/04/2027, 00/01/2027 → "Không có ngày …"; "2027-03-01", "1/3/27" → hướng dẫn dạng dd/mm/yyyy; 29/02/2028 nhận.
- **Giờ ngược trong hợp đồng:** không chọn được thợ, không báo giá, không lưu được.
- **Gói chỉ làm ở studio:** nút "Tại nhà", "Nơi khác" khoá, có lý do.
- **Giá bán > giá niêm yết; cọc > tổng; giảm giá > tạm tính:** máy chủ chặn, hợp đồng không lưu.
- **Bấm Xác nhận hai lần nhanh + một lần ép:** 1 lệnh `POST …/status`.
- **Đua xác nhận (409):** A vẫn nháp, dải đỏ đúng mã ca và giờ, gọi lại báo giá → dòng hiện đỏ, nút khoá. Ảnh `anh/hd-409-khi-xac-nhan-1440.png`.
- **Mất mạng giữa lưu:** nút khoá, dải "Mất kết nối mạng…", chữ đang gõ còn nguyên khi có mạng lại. Ảnh `anh/mat-mang-khi-luu.png`.
- **Quyền gõ thẳng đường:** thợ → /hop-dong, /hop-dong/:id, /hop-dong/moi đều bị chặn kèm dải chữ; kế toán xem hợp đồng nhưng 0 ô nhập mở, 0 nút ghi, có thấy tiền công (đúng G3); lễ tân và thợ không thấy nhóm tiền công; bảng giá chỉ xem với 3 vai trò này (0 ô nhập mở, hộp gói chỉ có "Đóng"). Ảnh `anh/quyen-*.png`.
- **Bàn phím:** Tab tới dòng gói, Enter mở hộp, Esc đóng và trả tiêu điểm về đúng dòng; Tab tới "Thêm Phù dâu", Enter thêm dòng.
- **Trình duyệt en-US + múi giờ Mỹ:** ngày 21/11/2026, giờ 04:30, "Đã xác nhận · 19/10/2026 01:49" (theo giờ tổ chức), tiền 3.197.000 ₫, 0 chữ tiếng Anh.
- **Tên rất dài** (khách 90 ký tự, gói 80 ký tự): xuống dòng, không tràn, ở cả 3 khổ.
- **Tuần 38 ca:** C máy tính 38/38 ô ca; C điện thoại tối đa 3 giờ/ô + "+2"; B, A không vỡ; 0 tràn ngang trang.
- **Huỷ dòng đã chốt / phát sinh:** lý do bắt buộc; dòng huỷ gạch, "Đã huỷ: …", không tính tiền; phát sinh có nhãn; tổng 3.197.000 ₫ khớp máy chủ.

---

## 6. Kết luận từng màn

| Màn | Kết luận | Điều kiện |
|---|---|---|
| **Bảng giá** | **ĐẠT CÓ ĐIỀU KIỆN** | T6 (trần giá hoặc hỏi lại khi giá bất thường), N5 |
| **Hợp đồng** | **KHÔNG ĐẠT** | S1 (không để hợp đồng đã chốt mất khỏi lịch), T1 (giữ chỗ nháp chỉ là nhãn xám, không khoá), T2 (chống ghi đè giữa hai thẻ); nên sửa cùng T4, N1, N6–N8 |
| **Lịch** | **ĐẠT CÓ ĐIỀU KIỆN** | T3 (giờ ngược), T5 (màu theo nhân vật + khai `subjectName` trong `types.ts`); N2, N3 |
| **Ô nhập mới** (MoneyInput, UnitInput, DateInput, TimeInput, ListDetail) | **ĐẠT** | — |
| **Khung điều hướng** | **ĐẠT CÓ ĐIỀU KIỆN** | N10; bài AppShell "Thu tiền" phải xanh |
| **Chung (commit `193d6aa`)** | **KHÔNG ĐẠT** | S2: typecheck, vitest, build của web phải xanh trên đúng commit sẽ lưu (sổ lỗi 13); API đã xanh 397/397 |

---

## 7. Tệp bằng chứng

Thư mục: `/tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/cham-web2-bien-ban/`
- `anh/` — 115 ảnh. Thợ chấm đã mở xem các ảnh được dẫn trong biên bản.
- `bai-thu/` — các bài của thợ chấm:
  - `tai-hien.mjs`: bài tái hiện gộp 6 lỗi.
  - `e1…e36.mjs`: kịch bản dùng thật.
  - `h.mjs`, `hd.mjs`, `pkg.mjs`, `api.mjs`: tiện ích.
  - `seed-nguoi.mjs`, `seed-ca.mjs`: dựng người và lịch dày.
  - `vite.cham.config.mjs`, `vitest.cham.config.mjs`: thay 3 tệp thiếu bằng rỗng lúc build/chạy bài thử.
- `log/` — `api-test.txt` (397/397), `web-test.txt` (376/380), `web-typecheck.txt`, `web-build.txt`, `api-server.txt`, `web-preview.txt`.

**Chạy lại:**
1. Đặt `bai-thu/` vào `apps/web/cham-nt/` của một worktree `193d6aa` đã có `node_modules`.
2. Dựng máy chủ cổng 4120 và web: `vite preview --config cham-nt/vite.cham.config.mjs --port 5190`.
3. Chạy theo thứ tự:
   ```
   node cham-nt/seed-nguoi.mjs
   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node cham-nt/e3.mjs      # dịch vụ
   …e7.mjs, e8.mjs, e11.mjs, e12.mjs                                  # gói, phí di chuyển, studio
   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node cham-nt/tai-hien.mjs
   ```
