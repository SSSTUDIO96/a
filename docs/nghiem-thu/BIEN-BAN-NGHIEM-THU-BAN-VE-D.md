# Biên bản nghiệm thu bản vẽ D — Hôm nay · Loại sự kiện · Phụ phí tự động · Hợp đồng nhiều ngày (bản `ce33af0`)

- **Ngày chấm:** 20/10/2026, giờ máy khoảng 02:20–08:30 UTC (9:20–15:30 giờ Việt Nam).
  - Giữa chừng phiên bị dừng vì giới hạn phiên, máy khởi động lại.
  - Nhật ký, bản tách và database còn nguyên. Tôi bật lại máy chủ (PID mới, mục 6) rồi làm tiếp.
- **Người chấm:** thợ chấm độc lập (AI, Opus). Tôi chỉ đo, phá thử trên bản sao và chụp ảnh.
  - Tôi **không** sửa mã sản phẩm.
  - Tôi **không** chạy lệnh git ghi, chỉ `git worktree add/remove`.
  - Tôi **không** đụng `makeup_dev`, **không** chạy `migrate reset`, **không** dùng `pkill -f`.
- **Bản được chấm:** commit `ce33af0` (D-W3 xong), trong bản tách `scratchpad/cham-d/wt`.
  - Commit này còn chứa phần **dở** của bản vẽ E (cổng học viên) và bản vẽ F (giấy chứng nhận).
  - Bài đỏ thuộc hai phần đó ghi riêng ở mục 1.2 và **không** tính cho D.
- **Database thử.** Database nào cũng bật `btree_gist` và áp migration bằng `pnpm --filter api db:deploy-to`. Lần nào cũng báo "kiểm lại: khớp".
  - `makeup_test_cham_d`: bài thử máy chủ, cửa gác, đột biến. **Đã xoá.**
  - `makeup_test_cham_d_khop`: bài "khớp hai đầu" của web. **Đã xoá.**
  - `makeup_test_cham_d_dung`: chép từ `makeup_test_cham5_dung` (dữ liệu lần 5, có 11 hợp đồng lập **trước D**).
    - Trước khi nâng cấp tôi chạy câu đếm mục 1.5 của bản vẽ: bảng trùng tên **0**, cột trùng tên **0**.
    - Áp thêm 4 migration: 130000 của D và 3 migration của E/F.
    - Sau khi áp: 4/4 bảng mới, 5/5 cột mới, **0** dòng cũ bị đổi.
    - Chạy `db:sync-roles`: cài 6 loại sự kiện mặc định cho 2 tổ chức cũ. Chạy lần hai: 0 thay đổi.
    - **Còn giữ** database này để tái hiện.
- **Biến môi trường:** mọi lệnh chạy bài thử hay máy chủ đều đặt rõ `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL` trỏ vào database thử. Bản tách không có tệp `.env`.
- **Ảnh:**
  - 62 ảnh ở `docs/nghiem-thu/bai-thu-ban-ve-d/`.
  - Ảnh nào cũng là **ảnh khung nhìn** (`fullPage: false`, sổ lỗi 27). Tôi đã mở xem từng ảnh.
- **Nhật ký và mã đo:** `scratchpad/cham-d/log/`, `scratchpad/cham-d/pw/`.

---

## 0. Kết luận ngắn cho anh Chiến

**ĐẠT có điều kiện.**
- Mọi việc của bản vẽ D chạy đúng trên app thật.
- Tiền trên màn khớp database từng đồng.
- Hợp đồng cũ không đổi một đồng.
- Điều kiện: phải vá **2 lỗi trung bình**. Cả hai nằm ở **bài thử**, không phải ở app anh đang dùng:
  - **T1:** bài thử không canh được việc web tự tính tiền phụ phí. Tôi cài lỗi này 2 lần, bài thử lọt cả 2.
  - **T2:** bài "khớp hai đầu" của web chưa gọi 7 hàm Loại sự kiện / Luật phụ phí vào máy chủ thật, nên đang đỏ.

| Mục (bản vẽ mục 3) | ĐÚNG | ĐẠT | ĐẸP |
|---|---|---|---|
| 3.0 Điều hướng: Hôm nay là mục đầu thanh bên; trên điện thoại nằm trong ngăn "Thêm"; Lịch vẫn là trang mở đầu (ký duyệt câu 1) | Có | Có | Có |
| 3.1 Trang Hôm nay, giao diện chủ (ALL) và thợ (OWN) | Có | Có | Có (L3) |
| 3.2 Bảng giá › Loại sự kiện | Có | Có | Có (L1, L2) |
| 3.3 Bảng giá › Luật phụ phí | Có | Có | Có |
| 3.4 Lập hợp đồng: sự kiện, ngày riêng, phụ phí tự thêm, sửa giá, bỏ / áp lại | Có | Có | Có (L4, L5) |
| 3.5 Lịch: công tắc "Tô màu", mặc định "Nhân vật" | Có | Có | Có |
| Hợp đồng cũ trước D | Có | Có: không đổi một đồng | — |

**Bài thử tự động** (số tôi tự đo):
- Bài thử máy chủ của D: **121/121**.
- Cửa gác: **888/888**, đúng mốc ký duyệt. Phải gỡ 9 đường dở của E ra mới chạy được (mục 1.2).
- Đột biến có sẵn trong kho: **17/17** đỏ, gồm cả D1, D2, D3 của bản vẽ.
- Typecheck 3 gói: **0 lỗi**. Build web: **xanh**.

**Đột biến tôi tự cài: 19 lỗi, bài thử bắt được 17/19.** Hai lỗi lọt đều cùng một loại: **web tự tính tiền phụ phí** (T1).

**Đo trên app thật:**
- Tràn ngang: **0/25** lần đo.
- Nút chết: **0/101** nút.
- Lỗi JavaScript trên trang: **0**.

---

## 1. Bảng số đo

### 1.1 Bài thử tự động

| # | Lệnh (trong bản tách `ce33af0`) | Kết quả |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | Xanh, 9,4 giây |
| 2 | Typecheck `apps/api` | **0 lỗi** (32 giây) |
| 3 | Typecheck `packages/shared` | **0 lỗi** (4 giây) |
| 4 | Typecheck `apps/web` (cả `tsconfig.json` và `tsconfig.node.json`) | **0 lỗi** (23 giây) |
| 5 | `apps/api`: `vitest run` trên `makeup_test_cham_d` | **919/945** qua · 15 đỏ · 11 bỏ qua. 69 tệp: 66 xanh, 3 đỏ. 627 giây. **Cả 3 tệp đỏ không thuộc D** (xem 1.2). |
| 5a | 7 tệp bài thử của D | `hom-nay` 30/30 · `phu-phi-tu-dong` 27/27 · `hom-nay-su-kien-phu-phi-db` 27/27 · `luat-phu-phi` 15/15 · `loai-su-kien` 12/12 · `lich-su-kien` 6/6 · `su-kien-dong-hop-dong` 4/4. Cộng **121/121**. |
| 5b | Số đo in ra trong bài thử của D | Ghi thẳng database: "ca vi phạm bị chặn **87/87**; ca hợp lệ ghi được **59/59**". Chỉ mục **7/7**. Hôm nay không N+1: "5 hợp đồng: 24 câu; 50 hợp đồng: 24 câu". |
| 6 | Cửa gác 10 phép (`tenant-isolation.test.ts`), chạy trên bản sao đã gỡ 9 đường dở của E | scope **108/108** · outsider **108/108** · noPerms **108/108** · keep **108/108** · unauth **118/118** · crossId **53/53** · leak **43/43** · refBase **52/52** · crossRef **150/150** · platform **40/40**. Cộng **888/888**, đúng mốc ký duyệt (793 + 8 đường × các phép). |
| 6a | Cửa gác sửa một phần (`sua-mot-phan.test.ts`) | partialStatic **23/23** · partialKeep **23/23** · chạy thật đủ hai bước **23/23** đường PATCH |
| 6b | Đột biến có sẵn trong kho (`gate-mutants.test.ts`) | **17/17** đỏ. D1: leak 1/43 (GET /occasions lộ 7 giá trị của A). D2: crossRef 8/150 (`dismissedRuleIds` mã của A → 200/201, mã bịa → 404). D3: leak 1/43 (GET /today lộ 2 giá trị của A). |
| 7 | `packages/shared`: `vitest run` | **206/211**. 5 đỏ đều ở `design-templates` (F, mục 1.2). Của D: `surcharges` **66/66**, `occasions` **6/6**. |
| 8 | `apps/web`: `vitest run` (`KHOP_HOP_DONG_DATABASE_URL=…_khop`, `KHOP_PORT=4481`) | **1266/1269**. 76 tệp: 74 xanh. 126 giây. |
| 8a | Bài web của D | `TodayPage` 24/24 · `PricingPage` 60/60 · `ContractEditor` 78/78 · `SchedulePage` 40/40 · `today/swatches` 13/13 · `khop-kieu` 8/8 |
| 8b | 3 bài web đỏ | **1 bài của D** (T2). 2 bài của F (mục 1.2). |
| 9 | `apps/web`: `pnpm build` | **Xanh** (27 giây). Cửa gác bí mật: "đã quét 273/273 tệp · 0 vi phạm". check-portal-bundle: 0 vi phạm. |

Nhật ký: `log/tsc.txt`, `log/api-vitest.txt`, `log/gate-bo-E.txt`, `log/shared.txt`, `log/web-vitest-1.txt`, `log/web-build.txt`.

### 1.2 Bài đỏ không thuộc D (phần dở của gói khác trong cùng commit)

| Bài đỏ | Của gói | Vì sao |
|---|---|---|
| `apps/api/test/tenant-isolation.test.ts` (11 bài bỏ qua) và `gate-mutants.test.ts` (14 bài đỏ) | **E** (cổng học viên) | Commit có 9 đường mới của E chưa có mẫu cửa gác: `customers/:customerId/portal`, `…/portal/links`, `…/portal/revoke`, `portal-devices/:deviceId/block` ở `portal/center-routes.ts`; 5 đường `/portal/session…`, `/portal/me` ở `portal/student-routes.ts`. Lỗi in ra: "Cửa gác chưa có giá trị cho :deviceId của POST /orgs/:orgId/portal-devices/:deviceId/block". |
| `apps/api/test/designs.test.ts` (1 bài) | **F** (giấy chứng nhận) | Danh mục mẫu đã thêm 16 mẫu `cc-*`, bài thử vẫn chờ 27 mẫu |
| `packages/shared/src/design-templates.test.ts` (5 bài) | **F** | Cùng gốc với dòng trên |
| `apps/web/src/features/designs/mau-20.test.ts` (1 bài) | **F** | Mẫu `cc-*` chưa có ảnh nhỏ cho lưới |
| `apps/web/src/api/khop-hop-dong.test.ts` › "hồ sơ thương hiệu…" | **F** | Máy chủ trả thêm `certSignerName`, `certSignerTitle`. Kiểu `BrandProfile` ở `types.ts` chưa có hai trường này. |

**Cách tôi đo cửa gác cho D:**
- Tôi chép bản của commit `f0024d1` (mốc 888 của D-D1) đè lên `portal/center-routes.ts` và `portal/student-routes.ts`, **chỉ trong bản tách**. Typecheck vẫn 0 lỗi.
- Chạy cửa gác: được 888/888 như mục 1.1 dòng 6.
- Chấm xong tôi chép trả hai tệp gốc. `git status` của bản tách sạch, chỉ còn 5 tệp `.bat` lệch kiểu xuống dòng như lần 5.

### 1.3 Đột biến tôi tự cài

**Cách làm:**
- Danh sách đột biến là của riêng tôi, không lấy từ danh sách của thợ.
- Mỗi lần: cài một lỗi → chạy bài thử → chép tệp gốc trả lại (có so từng byte).
- Đột biến máy chủ chạy 7 tệp bài thử D cùng cửa gác (132 bài). Đột biến web chạy các thư mục `contracts`, `schedule`, `today`, `pricing`, `layout` (492 bài, trước khi phá đều xanh).
- Mã cài lỗi: `pw/dotbien.py`, `pw/mk-dotbien.py`. Kết quả: `log/dot-bien.txt`, `log/dotbien-*.txt`.

| # | Đột biến (vùng phủ) | Tệp | Kết quả |
|---|---|---|---|
| C01 | **Lọc tổ chức ở Loại sự kiện:** PATCH tìm loại chỉ theo id | catalog/occasions.ts:153 | **Đỏ** 4 bài. Cửa gác crossId 52/53. |
| C02 | **Lọc tổ chức ở Luật:** GET /surcharge-rules quên `organizationId` | catalog/surcharge-rules.ts:280 | **Đỏ** 3 bài. Cửa gác leak 42/43. |
| C03 | **Lọc tổ chức ở Luật (bảng tính):** `loadActiveRules` nạp luật của mọi tổ chức | contracts/autoSurcharge.ts:68 | **Đỏ** 6 bài (`phu-phi-tu-dong`). Cửa gác **không** thấy, xem ghi chú dưới bảng. |
| C04 | **Lọc tổ chức ở Hôm nay:** danh sách ca quên `organizationId` | today/collect.ts:138 | **Đỏ** 8 bài. Cửa gác leak 42/43. |
| C05 | **Tiền float:** thành tiền dòng tự thêm × 1,08 | shared/surcharges.ts | **Đỏ**: shared thêm 5 bài, máy chủ 10 bài |
| C06 | **Phụ phí tự thêm trùng:** bỏ chặn khi đã có dòng phụ phí nhập tay cùng loại (MANUAL_LINE_EXISTS) | autoSurcharge.ts:223 | **Đỏ** 3 bài |
| C07 | **Phụ phí trùng ở phát sinh:** thêm dòng sau xác nhận không xét dòng phụ phí nhập tay đã có | contracts/routes.ts:679 | **Đỏ** 1 bài |
| C08 | **Dismissed bị bỏ quên (máy chủ):** vẫn lưu danh sách luật đã bỏ, nhưng lúc tính lại bỏ qua danh sách đó | autoSurcharge.ts:215 | **Đỏ** 3 bài |
| C09 | **Dismissed bị bỏ quên (web):** mở lại nháp thì mất danh sách luật đã bỏ | web contracts/model.ts:492 | **Đỏ** 1 bài |
| C10 | **Hợp đồng đã xác nhận đổi tiền:** tắt luật thì huỷ mọi dòng tự thêm của luật, kể cả hợp đồng đã chốt | surcharge-rules.ts (sau `writeConditions`) | **Đỏ** 1 bài ("hợp đồng KHÔNG đổi một đồng") |
| C11 | **Hợp đồng cũ / nháp mở lại đổi tiền:** dòng tự thêm thành dòng phụ phí gốc → lưu lại thì thu 2 lần | web model.ts:503 | **Đỏ** 1 bài |
| C12 | **Múi giờ:** dòng chưa có giờ lấy ngày sự kiện theo UTC (20/11 thay vì 21/11) | autoSurcharge.ts:168 | **Đỏ** 1 bài |
| C13 | **Múi giờ:** "hôm nay" của trang Hôm nay tính theo UTC | today/collect.ts:90 | **Đỏ** 2 bài (ranh giới 00:00:30 giờ Việt Nam) |
| C14 | **Quyền tiền ở Hôm nay:** thẻ "Mới 24 giờ" (có tổng tiền) mở cho mọi người có `org.read` | today/collect.ts:289 | **Đỏ** 4 bài (thợ, giảng viên…) |
| C15 | **Quyền ở Hôm nay:** luôn trả SĐT khách | today/collect.ts:244 | **Đỏ** 1 bài |
| C16 | **Tiền ở Hôm nay:** cộng số tiền đợt thay vì số còn thiếu | today/collect.ts:265 | **Đỏ** 2 bài |
| C17 | **Màu lịch mặc định đổi** sang "Sự kiện" | web schedule/model.ts:107 | **Đỏ** 9 bài |
| C18 | **Web tự tính tiền phụ phí:** dòng tự thêm hiện đơn giá × số người của dòng, thay vì thành tiền máy chủ trả | web contracts/AutoSurchargeRows.tsx:57 | **Xanh: lọt** (T1) |
| C19 | **Web tự tính tiền phụ phí trong "Cộng {nhân vật}":** đơn giá × số người của dòng | web contracts/model.ts:548 | **Xanh: lọt** (T1) |

**Kết luận: bài thử bắt được 17/19 lần phá.**

**Về C03:** cửa gác không thấy lỗi này. Bài `phu-phi-tu-dong` đỏ được là nhờ luật của tổ chức khác "rơi" vào hợp đồng đang thử. Chưa có bài nào **chủ đích** tạo luật ở tổ chức A rồi lập báo giá ở tổ chức B (xem L6).

### 1.4 Đo trên app thật

App thật: máy chủ cổng 4480, bản build web (`vite preview`) cổng 5480, dữ liệu `makeup_test_cham_d_dung`. Tài khoản chủ `chien.chu@studio-thu.vn`, thợ `do.giang@studio-thu.vn`.

| Hạng mục | Kết quả |
|---|---|
| **Tràn ngang** | **0/25** lần đo. Đo các màn: Loại sự kiện ×3 khổ, Luật (danh sách + hộp) ×3, Lập hợp đồng ×3 (+1 lần đo luồng C), HĐ đã xác nhận ×3, Lịch tô sự kiện ×3, Hôm nay chủ/thợ ×3 khổ. |
| **Nút chết** | Bấm **101** nút trên 5 màn × 2 khổ (1440, 390): Hôm nay, Loại sự kiện, Luật phụ phí, Lịch, HĐ-000008. 7 nút "không thấy đổi", đều có lý do: 6 nút đang được chọn sẵn ("Nhân vật", "Tất cả", "Tuần", tab "Sự kiện", tab "Luật phí", ngày đang chọn), và "Làm mới" bấm trong cùng phút nên giờ cập nhật không đổi. **0 nút chết thật** (`log/nut.txt`). Nút đổi dữ liệu (ô màu, công tắc, ↑↓, kéo) đã thử riêng trong các luồng mục 2. |
| **Lỗi trang** | 0 lỗi JavaScript. Chỉ có 401 lúc mở trang khi chưa đăng nhập, đúng thiết kế. |

---

## 2. Luồng anh Chiến đi: đối chiếu màn hình với database (SQL chỉ đọc)

### 2.1 Bảng giá › Loại sự kiện (ảnh `A1`…`A7`)

Nhật ký: `log/a-su-kien.txt`.
- **Đổi màu "Tiệc" → Mận:** gửi đúng `PATCH {"color":"plum"}`. Database đổi `violet` → `plum`.
- **Ẩn "Kỷ yếu":** gửi `PATCH {"isActive":false}`. Database `is_active = false`. Ô chọn sự kiện ở hợp đồng không còn "Kỷ yếu".
- **Kéo "Lễ cưới" lên đầu (1440):** gửi `PUT /occasions/order` với **đủ 6 mã**. Thứ tự mới: Lễ cưới 0, Ăn hỏi 1, Lễ vu quy 2…
- **390, nút ↑ "Đưa Tiệc lên":** Tiệc từ vị trí 3 lên 2. 390 dùng ↑↓ thay tay nắm, 12 ô màu xuống 2 hàng 6×2, nút tròn "+" nổi.
- **Thêm loại trùng tên "Lễ cưới":** báo ngay dưới ô tên: "Tên loại sự kiện đã có trong tổ chức" (`A7-…-390`).
- **Đếm dòng đang dùng:** sau khi lập hợp đồng, màn ghi "2 dòng hợp đồng đang dùng" (Lễ cưới) và "3 dòng…" (Ăn hỏi). Khớp database.

### 2.2 Bảng giá › Luật phụ phí (ảnh `B0`…`B6`, `F2`)

Nhật ký: `log/b-luat.txt`. Tôi tạo 3 luật qua giao diện:

| Luật | Tôi nhập | Database |
|---|---|---|
| Ca sớm | Phụ phí sáng sớm 200.000 ₫ · giờ 00:00–05:00 · theo số người | `start 0, end 300, per_quantity true` |
| Cuối tuần | Phụ phí cuối tuần 250.000 ₫ · T7, CN · một lần mỗi dòng | `weekdays {6,7}, per_quantity false` |
| Tối muộn đến nửa đêm | Phụ phí ca tối muộn 150.000 ₫ · 20:00 → **gõ "00:00"** | `start 1200, end **1440**` |

Ghi chú về luật "Tối muộn đến nửa đêm":
- Ô "Đến" nhận nửa đêm là 00:00 rồi gửi máy chủ thành 24:00, đúng quyết định 19/10 tối (nhật ký quyết định dòng 98).
- Danh sách hiện "Giờ bắt đầu 20:00–24:00".

Các kiểm khác:
- **Lưu khi thiếu thông tin:** lỗi đặt đúng ô. "Nhập tên luật.", "Chọn phụ phí thu.", "Nhập giờ bắt đầu.", "Nhập giờ kết thúc.", "Chọn ít nhất một thứ hoặc một ngày." (ảnh `B6` ×3 khổ).
- **Tắt rồi bật lại luật "Cuối tuần":**
  - Nhật ký database ghi `surcharge_rule.updated` true → false → true.
  - Trong lúc luật tắt, HĐ-000008 (đã xác nhận) vẫn **4.650.000 ₫** và vẫn còn dòng "tự thêm theo luật Cuối tuần". Database không đổi.
- **Danh sách luật:** hiện "Đang dùng ở 3 / 1 / 1 dòng", khớp database.

### 2.3 Lập hợp đồng HĐ-000008 qua giao diện (ảnh `C1`…`C11`)

Nhật ký: `log/c-hop-dong.txt`. Khách Hoàng Minh Thư, ngày sự kiện **Thứ Bảy 21/11/2026**.

1. **Dòng 1 — Cô dâu cao cấp:** sự kiện Lễ cưới, 04:30–06:30. Máy tự thêm **Phụ phí sáng sớm 200.000** (luật Ca sớm) và **Phụ phí cuối tuần 250.000** (luật Cuối tuần).
2. **Dòng 2 — Phù dâu ×2:**
   - Sự kiện tự lấy **Lễ cưới** theo dòng trên.
   - Máy tự thêm sáng sớm **× 2 = 400.000** (theo số người) và cuối tuần **× 1 = 250.000** (một lần mỗi dòng).
3. **Dòng 3 — Phù dâu:** sự kiện Ăn hỏi, **ngày riêng 19/11** (Thứ Năm), 21:00–22:00.
   - Có chip vàng "Khác ngày sự kiện".
   - Máy tự thêm **ca tối muộn 150.000**.
   - Phụ phí cuối tuần (thêm lúc dòng còn ngày 21/11) tự rơi, kèm thông báo "Đã bỏ … vì không còn khớp luật". Đúng: dòng không còn ở cuối tuần.
4. **Sửa giá "Ca sớm" ở dòng 1 thành 150.000:**
   - Bấm Lưu khi chưa ghi lý do: báo "Ghi đè giá phải ghi lý do." (`C3`).
   - Ghi lý do "Khách quen, giảm phụ phí ca sớm" thì lưu được. Dòng có nhãn "· đã sửa giá" và hiện lý do.
5. **Bỏ "Cuối tuần" ở dòng 2:** hiện dòng mờ "Đã bỏ: Cuối tuần · Áp lại" (`C4`).
6. **Thanh tổng:** **4.650.000 ₫**, đúng bằng `quote.total`. Lưu nháp, rồi Xác nhận: "đã tạo 3 lịch".

**Database sau khi xác nhận:**

| Dòng | Số lượng × đơn giá | Thành tiền | Ghi chú database |
|---|---|---|---|
| Cô dâu cao cấp (Lễ cưới, 21/11 04:30) | 1 × 2.500.000 | 2.500.000 | `occasion_name` = Lễ cưới |
| └ Phụ phí sáng sớm | 1 × 150.000 | 150.000 | `price_version_id` NULL, có lý do, luật "Ca sớm" |
| └ Phụ phí cuối tuần | 1 × 250.000 | 250.000 | luật "Cuối tuần" |
| Phù dâu (Lễ cưới, 21/11 04:30) | 2 × 400.000 | 800.000 | `dismissed_surcharge_rule_ids` = {mã luật Cuối tuần} |
| └ Phụ phí sáng sớm | 2 × 200.000 | 400.000 | luật "Ca sớm" |
| Phù dâu (Ăn hỏi, **19/11 21:00**) | 1 × 400.000 | 400.000 | |
| └ Phụ phí ca tối muộn | 1 × 150.000 | 150.000 | luật "Tối muộn đến nửa đêm" |
| **Tổng** | | **4.650.000** | `contracts.subtotal = total = 4.650.000` = tổng các dòng = màn hình |

- **Lịch:** 3 ca. LH-000014 ngày **19/11** 21:00 (Ăn hỏi). LH-000012 và LH-000013 ngày **21/11** 04:30 (Lễ cưới). Đúng "hợp đồng nhiều ngày".
- **Nhật ký:** `contract.created` có `autoSurcharges` với mã dòng, mã luật và số tiền.
- **Hợp đồng thứ hai HĐ-000009** (dữ liệu cho trang Hôm nay), lập qua giao diện ngày 21/10:
  - Cô dâu 04:00 có thợ Giang: tự thêm sáng sớm 200.000.
  - Phù dâu **05:00**: **không** thêm. Đúng khung nửa mở [00:00, 05:00).
  - Tổng 3.100.000, khớp database.

### 2.4 Lịch tô màu theo sự kiện (ảnh `D1`…`D4`)

- **Mặc định:** "Nhân vật" ở cả 3 khổ. Mỗi lần mở trang mới đều về "Nhân vật" (không nhớ lựa chọn, đúng bản vẽ).
- **Bật "Sự kiện":**
  - Ca HĐ-000008 tô `rose` (Lễ cưới), chữ "Lễ cưới · Cô dâu", "Lễ cưới · Phù dâu × 2".
  - Ca 19/11 tô `amber`, chữ "Ăn hỏi · Phù dâu".
  - Ca của hợp đồng cũ tô `other` (trắng có viền).
  - Chú thích đổi thành: Ăn hỏi · Lễ cưới · Chưa chọn sự kiện · Chưa có thợ · Không chặn lịch.
- **390:** nút bảng màu mở ngăn kéo đáy hai lựa chọn (`D2`).
- **Hộp chi tiết ca LH-000012:** có dòng "Sự kiện: ● Lễ cưới" (`D4`).

### 2.5 Trang Hôm nay (ảnh `E0`…`E2`)

Nhật ký: `log/f-homnay.txt`. Giờ thử 14:16 ngày 20/10 (giờ Việt Nam).

Dữ liệu HĐ-000009 trong database: đợt Cọc 500.000 hạn 17/10, đã thu 200.000. Đợt 2 1.000.000 hạn 23/10. Đợt "Còn lại" 1.600.000 hạn 09/11.

| Ô / thẻ | Màn hình (giống nhau ở 1440, 1024, 390) | Database / API |
|---|---|---|
| Đợt thu quá hạn | 1 · **300.000 ₫** · "Hạn 17/10 (quá 3 ngày)" | 500.000 − 200.000 = 300.000; quá hạn 3 ngày |
| Đến hạn 7 ngày tới | 1 · **1.000.000 ₫** (Đợt 2, Thứ Sáu 23/10) | khớp. Đợt 09/11 nằm ngoài 7 ngày, không hiện: đúng |
| Ca ngày mai | 2 · "1 ca chưa có thợ" | LH-000015 (Giang), LH-000016 (chưa có thợ) |
| Cần làm ngay | Tiền quá hạn, có nút "Mở Thu tiền". Ca chưa có thợ, có nút "Phân thợ". | |
| Mới trong 24 giờ | HĐ-000009 3.100.000 · HĐ-000008 4.650.000 · HĐ-000007 2.500.000 | khớp `contracts.total` |
| **Thợ Giang (OWN)** | Không có 4 ô số. Chỉ 1 ca của mình: "04:00 Ăn hỏi · Cô dâu". Không có tiền, không có SĐT. | API: `installments`, `newContracts`, `unassigned` = **null** |

- **Điều hướng (ký duyệt D câu 1):**
  - Sau đăng nhập vẫn vào **Lịch**.
  - Máy tính: "Hôm nay" là mục đầu thanh bên.
  - Điện thoại: "Hôm nay" nằm trong ngăn "Thêm". Thanh dưới giữ nguyên: chủ thấy Lịch · Hợp đồng · Bảng giá · Khách · Thêm; thợ thấy Lịch · Bảng giá · Thêm.
- **Bố cục:**
  - 1024: một cột rộng **760 px**, thứ tự Cần làm ngay → Ngày mai → Thu tiền → Mới. Đúng bản vẽ.
  - 390: ô số 2×2, nút "Mở Thu tiền" / "Phân thợ" xuống hàng, cao ≥ 40 px.

### 2.6 Hợp đồng cũ trước D: mở ra không đổi tiền

Nhật ký: `log/g-cu.txt`.
- **Trước khi nâng cấp:** chụp lại tiền 11 hợp đồng (`log/tien-truoc-D.txt`) và băm toàn bộ dòng hợp đồng (md5 `04cb12f9…`).
- **Mở trên màn** HĐ-000001, HĐ-000002 (đã xác nhận) và HĐ-000004, HĐ-000005 (nháp cũ): **0** lần gọi ghi (PATCH/PUT/POST). Đã xác nhận thì không gọi cả báo giá.
- **Nháp cũ HĐ-000004** (Chủ nhật 22/11):
  - Hiện dải xanh "Luật phụ phí đã thêm 1 dòng — kiểm lại trước khi lưu."
  - Thanh tổng hiện số báo giá 650.000. Database **vẫn 400.000** vì chưa ai bấm Lưu.
  - Đúng ký duyệt D câu 6: lưu nháp lại thì luật mới chạy, có báo trước.
- **Sau toàn bộ các luồng** (lập 2 hợp đồng, tắt/bật luật, đổi màu, ẩn, đổi thứ tự):
  - Tiền 11 hợp đồng cũ: **trùng khớp** với bản chụp (diff rỗng).
  - md5 các dòng cũ vẫn `04cb12f9…`.
  - **Không một đồng nào đổi.**

---

## 3. Lỗi (xếp theo mức)

**Nặng: không có.**

### Trung bình

**T1. Bài thử không canh được việc "web tự tính tiền phụ phí". Đột biến C18 và C19 đều lọt.**
- **Bản vẽ yêu cầu:** "máy chủ tính, web không tự tính tiền" (mục 0, mục 3). Bài thử W3 phải có ca "web **không** tự cộng tiền phụ phí".
- **Hiện nay:** app đúng. Tiền dòng lấy `r.lineTotal` (`apps/web/src/features/contracts/AutoSurchargeRows.tsx:57`). "Cộng {nhân vật}" cộng `live(a)` (`apps/web/src/features/contracts/model.ts:548`).
- **Tái hiện:**
  1. Đổi `AutoSurchargeRows.tsx:57` thành `formatVnd(r.unitPrice * p.line.quantity)`. Với luật "Một lần mỗi dòng" ở dòng phù dâu ×2, màn sẽ hiện 500.000 thay vì 250.000.
  2. Hoặc đổi `model.ts:548` thành cộng `a.unitPrice * l.quantity`.
  3. Chạy `vitest run src/features/contracts …`: **492/492 vẫn xanh**.
- **Gốc:** dữ liệu mẫu trong `ContractEditor.test.tsx` / `model.test.ts` đều có `lineTotal = unitPrice × quantity` và số lượng dòng = 1. Nên số "tự tính" trùng với số máy chủ trả.
- **Cách chặn:** thêm 1 ca với phụ phí "một lần mỗi dòng" ở dòng số lượng 2, và 1 ca có `lineTotal` khác `unitPrice × quantity` (giá đã sửa). Kiểm chữ tiền trên màn và "Cộng …" bằng đúng `lineTotal` của máy chủ.

**T2. Bài "khớp hai đầu" của web chưa gọi 7 hàm Loại sự kiện / Luật phụ phí vào máy chủ thật. Bài đang đỏ.**
- **Triệu chứng:** `apps/web/src/api/khop-hop-dong.test.ts:830` "đã gọi đủ mọi hàm gọi của các module nghiệp vụ" đỏ. Danh sách hàm chưa gọi gồm:
  - `catalog.listOccasions`, `createOccasion`, `updateOccasion`, `reorderOccasions`;
  - `listSurchargeRules`, `createSurchargeRule`, `updateSurchargeRule`;
  - và 3 hàm hồ sơ thương hiệu. 3 hàm này không được gọi chỉ vì bài trước đó đỏ do F.
- **Gốc:** gói W0 thêm 7 hàm vào `apps/web/src/api/catalog.ts`. Nhưng chỉ `khop-kieu.test.ts` so khuôn bằng **bản ghi viết tay**. Bản vẽ 4.4 W0 đòi khuôn "khớp JSON máy chủ thật".
- **Tái hiện:** `KHOP_HOP_DONG_DATABASE_URL=…/makeup_test_x KHOP_PORT=4481 npx vitest run src/api/khop-hop-dong.test.ts`.
- **Ảnh hưởng:** app không lỗi, vì tôi đã gọi thật cả 7 hàm qua giao diện ở mục 2.1–2.2. Nhưng nếu máy chủ đổi tên trường của `OccasionView` / `SurchargeRuleView`, sẽ không bài nào bắt được.

### Nhẹ

- **L1. Thẻ Loại sự kiện và Luật phụ phí ở khổ 1024 rộng 820 px.** Bản vẽ 3.2 ghi "bảng rộng tối đa 760px". Lớp dùng chung `pr-narrow`. Trang Hôm nay thì đúng 760 px. Ảnh `A6-…-1024`, `B5-…-1024`.
- **L2. Ở 390, nút tròn "+ Thêm loại" nổi đè lên công tắc của hàng nằm dưới nó.** Hàng Pre-wedding trong `A4`, `A5`. Phải cuộn thêm mới bấm được công tắc đó.
- **L3. Hôm nay, giao diện thợ ở 1440:** lưới 2 cột xếp "Hôm nay | Sau đó" ở hàng trên, "Ngày mai" ở hàng dưới. Đọc theo hàng thì "Sau đó" đứng trước "Ngày mai". Bản vẽ 3.1 xếp Hôm nay → Ngày mai → Sau đó. Ảnh `E1-hom-nay-tho-1440`.
- **L4. Ở 390, thông báo "Đã tự thêm …" (5 giây) che nội dung.**
  - Hai thông báo xếp chồng cao khoảng 100 px, nằm trên dải vàng và thanh tổng.
  - Đo: khối phụ phí vừa thêm có đáy ở y = 844, thông báo ở y = 582–680. Điểm bấm cuối khối trúng **thanh dưới**.
  - Ảnh `C10-hd-moi-thong-bao-che-390`. Gốc: `.ct-toasts` trong `apps/web/src/features/contracts/contracts.css`.
- **L5. Ô giá trong hộp "Sửa phụ phí" ở 390 cắt chữ gợi ý** thành "Theo bảng giá 200.0…" (`C11`). Thông báo "Đã bỏ … ở dòng Phù dâu" không phân biệt được khi hợp đồng có 2 dòng cùng tên Phù dâu.
- **L6. Thiếu bài thử chủ đích cho C03** (bảng tính nạp luật của tổ chức khác). Hiện bài đỏ được là nhờ may: luật của bài khác "rơi" vào báo giá. Nên thêm ca: tổ chức A có luật khung giờ, tổ chức B báo giá đúng giờ đó → B không có dòng tự thêm.
- **L7. Chú thích cũ ở `apps/web/src/layout/nav.ts:50`** còn ghi "pending: màn /hom-nay thuộc gói W1 … xoá `pending: true`". Mục đã không còn cờ `pending`, chú thích đã lỗi thời.

---

## 4. Anh Chiến vào thao tác thật được chưa

**Được.** Phần bản vẽ D anh vào thao tác thật được ngay. Cụ thể:

1. **Loại sự kiện:** đổi màu, ẩn, đổi thứ tự (kéo trên máy tính, ↑↓ trên điện thoại) đều lưu đúng.
2. **Luật phụ phí:** "đến nửa đêm" anh gõ **00:00** ở ô "Đến", màn sẽ hiện 24:00. Tắt luật **không** làm đổi hợp đồng đã xác nhận.
3. **Lập hợp đồng:** chọn sự kiện, đặt ngày riêng từng dòng, phụ phí tự thêm đúng luật và đúng số người. Sửa giá bắt buộc ghi lý do. Bỏ / Áp lại được. Tổng trên màn bằng tổng trong database.
4. **Hợp đồng cũ:** không đổi một đồng. Riêng **hợp đồng nháp cũ**, khi anh mở ra sẽ thấy dải xanh "Luật phụ phí đã thêm N dòng". Nếu anh bấm **Lưu**, phụ phí sẽ vào hợp đồng. Không muốn thì bấm "×" bỏ dòng đó trước khi lưu.
5. **Lịch** mở ra vẫn tô theo Nhân vật như cũ. Muốn xem theo sự kiện thì bấm "Sự kiện" (mỗi lần mở lại phải bấm lại).
6. **Hôm nay:** trên máy tính bấm mục đầu thanh bên; trên điện thoại vào "Thêm" → "Hôm nay". Thợ chỉ thấy ca của mình, không thấy tiền.

**Trước khi đóng gói D,** thợ cần làm T1 và T2. Đây là việc ở bài thử, khoảng nửa ngày công, không đụng app. Hai lỗi đó không làm sai số tiền anh thấy hôm nay. Chỉ là nếu sau này có người sửa mã làm sai tiền phụ phí trên màn, bài thử sẽ không báo.

---

## 5. Còn giữ để tái hiện

- **Database `makeup_test_cham_d_dung`** (tài khoản `chien.chu@studio-thu.vn`, `do.giang@studio-thu.vn`):
  - 3 luật: Ca sớm, Cuối tuần, Tối muộn đến nửa đêm.
  - 2 dịch vụ phụ phí mới: Phụ phí cuối tuần, Phụ phí ca tối muộn.
  - HĐ-000008 (nhiều ngày, 4.650.000 ₫) và HĐ-000009 (Hôm nay, 3.100.000 ₫, đã thu 200.000).
  - Tiệc đã đổi sang màu Mận, Kỷ yếu đang ẩn.
- **Chạy lại app thật** (từ một bản tách của `ce33af0`):

  ```
  DATABASE_URL=… DIRECT_URL=… JWT_ACCESS_SECRET=<≥32 ký tự> PORT=4480 MAIL_DRIVER=console WEB_APP_URL=http://localhost:5480 CORS_ORIGINS=http://localhost:5480 npx tsx src/server.ts
  API_DEV_TARGET=http://localhost:4480 npx vite preview --port 5480 --strictPort
  ```
- **Mã đo** ở `scratchpad/cham-d/pw/`:
  - `a-su-kien.mjs`, `b-luat.mjs`, `c-hop-dong.mjs`, `d-lich.mjs`, `e-du-lieu.mjs`, `f-homnay.mjs`, `g-cu.mjs`, `h-anh.mjs`, `h2.mjs`: các luồng.
  - `nut.mjs`: nút chết.
  - `dotbien.py`, `mk-dotbien.py`, `dotbien.json`: đột biến.

## 6. Dọn

- **Tắt theo PID của tôi:**
  - Lần đầu: API 3076/3144 và web 3077. Mất khi máy khởi động lại.
  - Lần hai: API 610, 658 và con của nó; web 611, 657 và con của nó.
  - Sau khi tắt: cổng 4480 và 5480 không còn tiến trình nghe.
- **Bản tách:** đã gỡ bằng `git worktree remove --force`. Trước khi gỡ, `git status` chỉ còn 5 tệp `.bat` lệch kiểu xuống dòng.
- **Database:** đã xoá `makeup_test_cham_d` và `makeup_test_cham_d_khop`. Giữ `makeup_test_cham_d_dung`.
