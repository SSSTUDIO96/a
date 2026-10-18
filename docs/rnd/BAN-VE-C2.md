# Bản vẽ thông số C2 — 5 màn chưa có bản vẽ (Chặng 2)

- Người dùng bản vẽ: thợ dựng web React (apps/web).
- Người duyệt: anh Chiến. **Phương án được chọn ở mỗi màn là QUYẾT ĐỊNH THAY của R&D** (anh đang ngủ, đã giao "Cứ làm toàn bộ hết đi"). Anh bác được: ảnh của cả 3 phương án vẫn giữ, lý do chọn ở /home/user/a/docs/rnd/BAO-CAO-RND-04.md.
- Ngày: 18/10/2026. Viết theo thứ tự màn 1 → 5; màn nào xong là ghi ngay.
- Bản vẽ này **nối tiếp** /home/user/a/docs/rnd/BAN-VE-C.md: token màu/chữ/khoảng cách (mục 1), khung điều hướng (mục 2), component (mục 3), luật lỗi (mục 5) giữ nguyên. Chỗ nào ở đây khác BAN-VE-C thì ghi rõ "khác BAN-VE-C".

**Nguồn sự thật (khi mâu thuẫn, ưu tiên từ trên xuống)**
1. /home/user/a/apps/api/prisma/schema.prisma
2. /home/user/a/apps/api/src/modules/{staff,schedule,payments,profile,platform,files,orgs}/ — đường API và trường
3. /home/user/a/packages/shared/src/ (permissions.ts, payments.ts, money.ts)
4. Bản mẫu v4: /home/user/a/docs/rnd/v4-*.html (mở bằng trình duyệt, thêm `#tên-màn`; nút "Hiện trường dữ liệu" ở góc phải dưới hiện tên trường của từng ô)

**Luật chung thêm cho 5 màn này**
- Mỗi ô trên màn chỉ ra được trường nó đọc/ghi (bảng "Ô ↔ trường" của từng màn). Ô chưa có trường thì nằm ở mục "Đề xuất trường mới", **không vẽ, không dựng**.
- Danh sách chỉ bày tối đa 3–4 thông tin để nhận ra món (luật 7 đề xuất ở SO-Y-MUON.md).
- Không có chữ "lợi nhuận" ở bất kỳ màn nào.
- Điện thoại: không tràn ngang ở 390px; bài thử kiểm `scrollWidth === innerWidth`.

---

## 0. Phần dùng chung cho 5 màn

### 0.1 Bố cục hai cột (giống Hợp đồng C) — tên gọi trong bản vẽ: **ListDetail**

| Khổ | Cột trái | Khe | Hành vi |
|---|---|---|---|
| Máy tính ≥1181 | 380px (biến thể hẹp: 300px) | 20 | Cột trái dính đầu (`top:16px`, cao tối đa `100vh − 32px`, thân cuộn riêng) |
| Máy tính bảng 641–1180 | 320px (hẹp: 240px) | 14 | như trên |
| Điện thoại ≤640 | — | — | Màn danh sách là cột trái. Bấm một dòng → màn con chiếm hết bề ngang, thanh trên có nút ‹ quay lại. Dòng đang chọn **không** tô màu trên điện thoại. |

Đường dẫn: màn con trên điện thoại có đường riêng (ví dụ `/nhan-su/tien-cong/goi/:id`), để nút quay lại của trình duyệt đúng.

### 0.2 Component mới (bổ sung BAN-VE-C mục 3; chủ tệp: W2, thợ màn mở yêu cầu)

| Component | Kích thước | Ghi chú |
|---|---|---|
| **ListGroupHeader** | đệm 12 16 6, chữ 11.5/700 viết hoa, giãn .05em, nền `--soft`, gạch dưới `--line-2` | biến thể `danger` (nền `--danger-bg`, chữ `--danger`) |
| **ListRow** | đệm 11 16 (điện thoại 11 14); lưới `[avatar] 1fr auto` | tên 14/600 xuống dòng không cắt; dòng phụ 12.5px `--muted`; bên phải số tiền 14/700 hoặc nhãn. Đang chọn: nền `--accent-soft` + `inset 3px 0 0 var(--accent)` |
| **StatTile** | đệm 12 16, bo 12, viền `--line` | nhãn 12.5px `--muted` (+ Tooltip "?"); số 20/700 tabular (điện thoại 16). Biến thể `highlight` (viền `--accent-line`, nền `--accent-soft`), `danger` (số màu `--danger`). Lưới 4 ô; máy tính bảng và điện thoại 2×2 |
| **PersonChip** | Avatar 28 + tên 13/500, khe 6 | dùng trong hàng tiền công |
| **ImageUpload** | ô ảnh vuông/tròn/ngang + nút "Đổi ảnh" · "Bỏ ảnh" | đang tải: vòng xoay trên ảnh, nút khoá; lỗi 400 (sai loại/ quá dung lượng) hiện dưới ô |
| **ConfirmDialog** | Dialog rộng 440, có ô lý do (Textarea) khi `requireReason` | dùng cho huỷ phiếu, khoá tổ chức, gỡ trang |

### 0.3 Hàm API dùng chung (tệp mới, chưa có)

`src/api/files.ts` — **tệp mới, chủ: gói W8 (Nhân sự)**; gói Hồ sơ thương hiệu (W11) chỉ import.

```ts
export type FilePurpose = 'STAFF_AVATAR' | 'CUSTOMER_AVATAR' | 'ORG_LOGO' | 'ALBUM_IMAGE' | 'COURSE_RESOURCE' | 'SUBMISSION' | 'WELCOME_CARD' | 'OTHER';
export interface StoredFileView { id: string; purpose: FilePurpose; status: 'PENDING'|'READY'|'DELETED'; originalName: string; mimeType: string; sizeBytes: number; width: number|null; height: number|null; createdAt: string; signedUrl: string|null; signedUrlExpiresAt: string|null }
// THÂN là nội dung nhị phân của tệp (không multipart). Header Idempotency-Key bắt buộc; nên gửi x-content-sha256.
export function uploadFile(orgId: string, file: Blob, query: { purpose: FilePurpose; name: string }, idempotencyKey: string): Promise<StoredFileView>;
export function getFile(orgId: string, fileId: string, signal?: AbortSignal): Promise<StoredFileView>;
export function deleteFile(orgId: string, fileId: string): Promise<void>;
```
Giới hạn dung lượng (máy chủ kiểm, giao diện kiểm trước cho nhanh): ảnh đại diện thợ/khách 5 MB, logo 2 MB, ảnh album 15 MB. Chỉ nhận ảnh.

**Luật đặt kiểu dữ liệu để không giẫm nhau:** kiểu mới của màn nào đặt **ngay trong tệp API mới của màn đó** (ví dụ `src/api/payments.ts` tự khai `PaymentProgress`). Không thêm vào `src/api/types.ts` (tệp chung của W1, nhiều người sửa sẽ đụng nhau).

---

## 1. Nhân sự & trả lương — phương án C "Hai cột như Hợp đồng C" (quyết định thay)

Bản mẫu: /home/user/a/docs/rnd/v4-nhan-su.html — `#c`, `#c-m-tho`, `#c-ho-so`, `#c-bac`, `#c-them`, `#c-tien-cong`, `#c-tien-cong-ct`, `#c-tien-cong-xem`, `#c-trang-thai`.

Ảnh (3 khổ): /home/user/a/docs/rnd/anh/v4-nhan-su-c-{desktop,tablet,mobile}.png, …-c-tien-cong-{desktop,tablet,mobile}.png, …-c-tien-cong-ct-{desktop,tablet,mobile}.png, …-c-ho-so-…, …-c-bac-…, …-c-them-…, …-c-tien-cong-xem-…, …-c-trang-thai-… ; ảnh có nhãn trường: /home/user/a/docs/rnd/anh/v4-nhan-su-truong-c-tien-cong-desktop.png, /home/user/a/docs/rnd/anh/v4-nhan-su-truong-c-desktop.png

### 1.1 Đường và điều hướng

| Đường | Màn | Ghi chú |
|---|---|---|
| `/:orgSlug/nhan-su` | Thợ & bậc lương (mặc định) | mục "Thợ makeup" đã có trong `nav.ts` (quyền `staff.read`) |
| `/:orgSlug/nhan-su/bac/:tierId` | một bậc (điện thoại: màn con) | `tierId = 'chua-gan'` cho thợ chưa có bậc |
| `/:orgSlug/nhan-su/tien-cong` | Tiền công theo gói | chỉ hiện khi có `payroll.read` |
| `/:orgSlug/nhan-su/tien-cong/:loai/:id` | tiền công một gói (`loai = goi`) hoặc một dịch vụ phụ (`loai = dich-vu`) | máy tính: tô dòng bên trái; điện thoại: màn con |

- Menu con (thanh trái máy tính): **Thợ & bậc lương · Tiền công theo gói** → thêm `children` cho mục `nhan-su` trong `src/layout/nav.ts` (tệp của W3 — mở yêu cầu).
- Điện thoại: "Thợ makeup" nằm trong ngăn "Thêm" (BAN-VE-C 2.3). Đầu trang có **Segmented 2 ô** "Thợ & bậc lương · Tiền công theo gói" (giống `segm` của Bảng giá).

### 1.2 Màn "Thợ & bậc lương"

**Bố cục:** ListDetail biến thể hẹp (300 | 1fr; máy tính bảng 240 | 1fr).

*Cột trái — thẻ "Bậc lương"*
- Đầu thẻ: "Bậc lương" 16/700 · nút ghost "Sửa" (mở hộp thoại Bậc lương; chỉ khi có `staff.write`).
- Dòng "Tất cả thợ" (số = số thợ).
- Mỗi bậc một dòng: tên 14/600 · số thợ bên phải (`--faint`). Bậc đang ẩn: chữ `--faint`, thêm " · đang ẩn".
- Dòng "Chưa gán bậc" (chữ `--warn`), số = thợ có `tier = null`. Không có ai thì ẩn dòng này.
- Chân thẻ: Button dashed rộng hết "+ Thêm bậc lương" (chỉ `staff.write`) → mở hộp thoại Bậc lương, tiêu điểm vào ô "Tên bậc mới".

*Cột phải — thẻ danh sách thợ*
- Đầu thẻ: tên nhóm đang chọn · "n người đang làm" (`--faint`) · ô tìm cỡ sm rộng 220 (ẩn trên điện thoại; điện thoại tìm ở màn danh sách bậc).
- **Một dòng thợ** (lưới `32px | 1fr | 210px | auto`, đệm 12 18; máy tính bảng ô chọn 160px; điện thoại: ô chọn xuống dòng 2, kéo hết bề ngang):
  - Avatar 32 · tên 14/600 · dòng phụ 12.5px: tên vai trò; nếu `isBookable = false` thêm " · **tắt nhận lịch**" (màu `--warn`).
  - **Select bậc lương**: "Không có bậc" + các bậc đang dùng. **Đổi là lưu ngay** (`PATCH /staff/:membershipId {tierId}`), hiện dải nhỏ "Đã chuyển {tên} sang {bậc} · Hoàn tác" 6 giây; Hoàn tác = PATCH lại bậc cũ.
  - Button sm "Hồ sơ" → hộp thoại Hồ sơ thợ.
- Xếp thợ theo thứ tự máy chủ trả (ngày vào tổ chức).

*Hộp thoại "Hồ sơ thợ"* — Dialog rộng 560 (điện thoại: BottomSheet).
- Đầu: dòng phụ "{vai trò}" · tiêu đề "Hồ sơ thợ" · nút đóng.
- Khối ảnh: ImageUpload tròn 72 · tên 700 · "Tên tài khoản: {fullName}" 12px · "Đổi ảnh" / "Bỏ ảnh".
- Nhóm "Thông tin": Tên hiển thị ? (TextInput) · Số điện thoại ? (TextInput).
- Nhóm "Lương & lịch": Bậc lương (Select) · Nhận lịch ? (Switch).
- Chân: Huỷ · Lưu (`PATCH /staff/:membershipId`, chỉ gửi trường đã đổi).
- Đổi ảnh: chọn tệp → `uploadFile(purpose 'STAFF_AVATAR')` → giữ `id` trong bản nháp → bấm Lưu mới gửi `avatarFileId`. Bỏ ảnh = gửi `avatarFileId: null`. **Không gửi `avatarUrl`** (máy chủ từ chối).

*Hộp thoại "Bậc lương"* — Dialog 560.
- Mỗi bậc một hàng: tay kéo (đổi `sortOrder`) · TextInput tên · "n thợ" 12px · Switch "Đang dùng" (`isActive`).
- Hàng cuối: TextInput "Tên bậc mới, ví dụ: Thợ chính bậc 2" + Button "+ Thêm" → `POST /staff-tiers {name}` (header `Idempotency-Key`), thêm xong ở cuối danh sách.
- Lưu: chỉ gửi bậc đã đổi, mỗi bậc một `PATCH /staff-tiers/:tierId {name?, sortOrder?, isActive?}`. Lỗi bậc nào hiện dải đỏ ngay dưới hàng đó, các bậc khác vẫn lưu.

*Hộp thoại "Thêm thợ vào studio"* — Dialog 560 (chỉ `members.invite`).
- Dòng phụ: "Thợ phải tự đăng ký tài khoản Makeup Pro trước, rồi đưa email cho anh."
- Email tài khoản `*` (TextInput) · Vai trò `*` (Select; lấy `GET /roles` nếu có `roles.read`, không thì dùng tên vai trò hệ thống trong `SYSTEM_ROLES`).
- Thêm → `POST /members {email, roleKeys:[key]}`. Xong: đóng hộp, tải lại danh sách, tô dòng thợ mới, gợi ý "Mở Hồ sơ để gán bậc".

### 1.3 Màn "Tiền công theo gói" — đúng lời anh: *"hiển thị cấp bậc kèm avatar tên rồi nhập số tiền"*

**Bố cục:** ListDetail thường (380 | 1fr; máy tính bảng 320 | 1fr).

*Cột trái — chọn gói hoặc dịch vụ phụ*
- Ô tìm "Tìm gói, dịch vụ phụ" (lọc phía máy).
- Nhóm theo nhân vật: ListGroupHeader "Gói · {tên nhân vật}" theo `makeup-subjects.sortOrder`; gói không có nhân vật vào nhóm "Gói · Mọi nhân vật" (cuối).
- Nhóm "Dịch vụ phụ" (cuối cùng).
- Mỗi dòng: tên 14/600 · giá bán bên phải 14/700. **Không thêm gì khác** (không có trường "đã đặt mấy bậc" — xem đề xuất 1.8-2).
- Mở màn lần đầu: chọn sẵn gói đầu tiên (máy tính, máy tính bảng). Điện thoại: chỉ hiện danh sách.

*Cột phải — thẻ tiền công (component `PayRateSheet`)*
- Đầu thẻ: dòng phụ "Gói · {nhân vật}" (hoặc "Dịch vụ phụ") 12px · tên gói 17/700 · bên phải "Giá bán **2.700.000 ₫**" 13px (chỉ đọc, để chủ so tiền công với giá).
- **Mỗi bậc đang dùng một hàng** (xếp theo `tier.sortOrder`), lưới `1fr | 200px` (máy tính bảng 170; điện thoại 1 cột, ô tiền xuống dưới, rộng hết):
  - Dòng 1: tên bậc 15/700 · "n thợ" 12px `--muted`.
  - Dòng 2: các PersonChip (Avatar 28 + tên hiển thị) của mọi thợ thuộc bậc, tự xuống dòng. Bậc chưa có ai: chữ `--faint` "Chưa có thợ ở bậc này".
  - Bên phải: MoneyInput, trống hiện "Chưa đặt" và **viền nét đứt**; dưới ô 12px `--faint`: "Cập nhật dd/mm/yyyy" hoặc "Chưa đặt mức".
- Chân thẻ (nền `--soft`): chữ "Để trống = chưa đặt mức cho bậc đó" + Tooltip ("Gửi trống thì xoá mức cũ. Bậc đang ẩn không hiện ở đây. Thợ chưa gán bậc không nhận tiền công theo gói.") · Huỷ · **Lưu tiền công** (primary).
- Lưu: `PUT /packages/:packageId/pay-rates` (hoặc `/services/:serviceId/pay-rates`) với **chỉ các bậc đã đổi**: `{rates:[{tierId, amount|null}]}`. Máy chủ trả lại cả bảng → thay số trên màn.
- Đang có thay đổi chưa lưu mà bấm gói khác: ConfirmDialog "Bỏ thay đổi tiền công của {gói}?" (Ở lại · Bỏ thay đổi).
- Không có `payroll.write`: mọi ô khoá (nền `--soft`), ẩn nút Lưu, trên đầu thẻ có dải xám biểu tượng khoá "Bạn chỉ được xem tiền công. Chủ studio hoặc quản trị đặt mức." (`#c-tien-cong-xem`).

### 1.4 Ô ↔ trường

| Ô trên màn | Đọc | Ghi |
|---|---|---|
| Tên bậc, số thợ, đang ẩn | `GET /staff-tiers` → `items[{id, name, sortOrder, isActive, staffCount}]` | `POST /staff-tiers {name, sortOrder?}`; `PATCH /staff-tiers/:tierId {name?, sortOrder?, isActive?}` |
| Danh sách thợ (lọc theo bậc, tìm) | `GET /staff?tierId&q` → `items[{membershipId, fullName, displayName, initials, avatarUrl, phone, tier{id,name,isActive}, isBookable, hasProfile, status, roleKeys}]` | — |
| "Chưa gán bậc" (số và danh sách) | lọc `tier === null` từ `GET /staff` (không có tham số lọc riêng) | — |
| Ảnh đại diện | `avatarUrl` (URL ký có hạn 10 phút) | `POST /files?purpose=STAFF_AVATAR&name=` → `id` → `PATCH /staff/:id {avatarFileId}` |
| Tên hiển thị | `displayName` | `PATCH {displayName}` (null = dùng tên tài khoản) |
| Tên tài khoản (chỉ đọc) | `fullName` | — |
| Số điện thoại | `phone` (null nếu người xem thiếu `staff.write`) | `PATCH {phone}` |
| Bậc lương | `tier.id` | `PATCH {tierId}` (null = bỏ bậc) |
| Nhận lịch | `isBookable` | `PATCH {isBookable}` |
| Vai trò (dòng phụ) | `roleKeys` → tên từ `GET /roles` hoặc `SYSTEM_ROLES` | (đổi vai trò thuộc màn Thành viên — chưa vẽ) |
| Thêm thợ | — | `POST /members {email, roleKeys}` |
| Danh sách gói (cột trái) | `GET /packages?isActive=true` → `id, name, subjectId, currentPrice.unitPrice`; `GET /makeup-subjects` | — |
| Danh sách dịch vụ phụ | `GET /services?kind=ADDON&isActive=true` → `id, name, currentPrice.unitPrice` | — |
| Hàng tiền công | `GET /packages/:id/pay-rates` (hoặc `/services/:id/pay-rates`) → `{owner{kind,id,name}, items[{tier{id,name,sortOrder}, amount\|null, updatedAt\|null, staff[{membershipId, displayName, avatarUrl, initials}]}]}` | `PUT … {rates:[{tierId, amount\|null}]}` |

### 1.5 Trạng thái

| Tình huống | Hiển thị |
|---|---|
| Tải lần đầu | Skeleton: cột trái 6 dòng xám; cột phải 3 hàng (tròn 28 + vạch + ô 90×30) — `#c-trang-thai` |
| Chưa có bậc nào | Màn Tiền công: EmptyState "Chưa có bậc lương nào. Tạo bậc trước rồi mới đặt tiền công." + nút "Thêm bậc lương" (chỉ `staff.write`, không thì chỉ chữ) |
| Chưa có gói nào | Cột trái: EmptyState "Chưa có gói nào trong Bảng giá." + liên kết "Mở Bảng giá" |
| Lỗi mạng / 5xx | Dải đỏ trong thẻ "Không kết nối được máy chủ…" + nút "Thử lại"; giữ số đang gõ |
| 400 khi lưu tiền công | Lỗi dưới đúng ô (theo `tierId` trong `details.tierIds`) |
| 403 đổi bậc (thiếu `payroll.write` hoặc tự đổi bậc của mình) | Ô chọn quay về bậc cũ + dải đỏ nhỏ dưới dòng: chữ của máy chủ ("Đổi bậc lương cần quyền đặt tiền công" / "Không tự đổi bậc lương của chính mình được") |
| 404 thợ/gói (đã bị xoá ở máy khác) | EmptyState "Không tìm thấy …" + quay lại danh sách |
| 409 trùng tên bậc | Lỗi dưới ô tên: "Đã có bậc lương tên …" |
| 409 ẩn bậc còn thợ | Dải đỏ dưới hàng bậc: "Còn n thợ đang thuộc bậc … hãy chuyển họ sang bậc khác trước khi ẩn"; Switch quay về bật |
| 404 thêm thợ | Lỗi dưới ô email: "Chưa có tài khoản hoạt động với email này" |

### 1.6 Quyền → phần nào hiện

| Quyền | Hiện / bật |
|---|---|
| `staff.read` | Menu "Thợ makeup", màn Thợ & bậc lương (chỉ xem: ô chọn bậc hiện thành chữ) |
| `staff.write` | Nút "Sửa" bậc, "+ Thêm bậc lương", hộp Hồ sơ sửa được, cột số điện thoại có số |
| `staff.write` **và** `payroll.write` | Ô chọn bậc (trên dòng và trong Hồ sơ). Dòng của chính mình: khoá + tooltip "Không tự đổi bậc của mình" (trừ chủ tài khoản: vai trò `owner`) |
| `files.write` | Nút "Đổi ảnh" / "Bỏ ảnh" |
| `members.invite` | Nút "+ Thêm thợ" |
| `roles.read` | Ô Vai trò lấy từ `GET /roles` (không có thì chỉ vai trò hệ thống) |
| `payroll.read` | Mục con và màn "Tiền công theo gói" (chỉ xem) |
| `payroll.write` | Ô tiền công sửa được, nút "Lưu tiền công" |
| `catalog.read` | Cột trái của màn Tiền công (không có thì EmptyState "Bạn không có quyền xem Bảng giá") |

Theo vai trò mẫu: chủ/quản trị: đủ. Quản lý: sửa thợ, **không** đổi bậc (thiếu `payroll.write`), **không** thấy Tiền công. Kế toán: xem thợ + xem tiền công (chỉ đọc). Thợ makeup/thợ phụ: chỉ xem danh sách thợ, không thấy số điện thoại.

### 1.7 Gói việc theo tệp (chạy song song với các gói khác)

| Gói | Tệp sở hữu | Nội dung | Phụ thuộc |
|---|---|---|---|
| **W8 Nhân sự** | `src/features/staff/**`: `StaffPage.tsx` (khung, Segmented điện thoại), `TierList.tsx`, `StaffList.tsx`, `StaffRow.tsx`, `StaffProfileDialog.tsx`, `TierManagerDialog.tsx`, `AddStaffDialog.tsx`, `PayRatesPage.tsx`, `PayRateOwnerList.tsx`, `PayRateSheet.tsx`, `PayRateRow.tsx`, `useStaff.ts`, `usePayRates.ts`; **`src/api/files.ts` (tệp mới)** | Mục 1.2–1.6 | Có sẵn: `src/api/staff.ts` (đủ hàm tiers/staff/pay-rates), `src/api/catalog.ts` (listPackages, listServices, listMakeupSubjects) |
| Yêu cầu gửi W1 (`src/api/org.ts`) | thêm `listRoles`, `addMember` | chữ ký ở 1.9 | — |
| Yêu cầu gửi W3 (`src/layout/nav.ts`, `src/app/routes.tsx`) | `children` cho `nhan-su`; khai đường 1.1, thay `Placeholder` bằng `StaffPage` | | — |
| Yêu cầu gửi W2 (`src/ui/`) | ListGroupHeader, ListRow, PersonChip, ImageUpload, ConfirmDialog (mục 0.2) | | — |

`PayRateSheet` đặt trong `features/staff`. Hộp chi tiết gói của Bảng giá (W4, nhóm "Tiền công thợ theo bậc") **không** import chéo lúc này; khi cả hai xong, điều phối quyết có gộp không.

### 1.8 Đề xuất trường / đường mới (KHÔNG vẽ lên màn)

1. **Tiền công riêng cho một thợ** (ghi đè mức của bậc) — Fresha cho đặt hoa hồng riêng từng người. Cần `StaffPayRate.membershipId` (hoặc bảng riêng). Anh chưa yêu cầu.
2. **Đọc tiền công nhiều gói một lần** `GET /pay-rates?packageIds=…` — để cột trái hiện "đã đặt 3/4 bậc" và để làm được ma trận (phương án B). Hiện phải gọi từng gói.
3. `GET /staff` trả thêm **tên vai trò** (`roles[{key,name}]`) — để vai trò tuỳ chỉnh hiện đúng tên mà không cần `roles.read`.
4. **Màu bậc** (`StaffTier.color`) — Studio Pro có ô màu cho cấp bậc. Không vẽ vì anh chưa nhắc.
5. **Mời thợ chưa có tài khoản** (gửi lời mời qua email/Zalo, thợ bấm liên kết là vào). Máy chủ hiện chỉ thêm được tài khoản đã đăng ký.
6. **Bảng lương tháng** (cộng tiền công theo ca đã làm, như "Lương sản phẩm" của Studio Pro). Máy chủ chưa có phần tính; mốc sau.
7. `GET /staff?status=SUSPENDED` — xem thợ đang tạm khoá (hiện chỉ trả thợ đang hoạt động).

### 1.9 Hàm API web cần thêm

Đã có trong `src/api/staff.ts` (dùng lại, không sửa): `listStaffTiers`, `createStaffTier`, `updateStaffTier`, `listStaff`, `updateStaff`, `getPackagePayRates`, `putPackagePayRates`, `getServicePayRates`, `putServicePayRates`.

Cần thêm:
```ts
// src/api/files.ts (mới, W8) — xem mục 0.3
export function uploadFile(orgId: string, file: Blob, query: { purpose: FilePurpose; name: string }, idempotencyKey: string): Promise<StoredFileView>;

// src/api/org.ts (W1)
export interface RoleView { id: string; organizationId: string; key: string; name: string; isSystem: boolean; permissions: string[]; createdAt: string; updatedAt: string } // bản ghi Role trả nguyên
export function listRoles(orgId: string, signal?: AbortSignal): Promise<Items<RoleView>>;            // GET /orgs/:orgId/roles (quyền roles.read)
export interface MemberView { id: string; status: MembershipStatus; createdAt: string; user: { id: string; email: string; fullName: string }; roles: { id: string; key: string; name: string }[] }
export function addMember(orgId: string, input: { email: string; roleKeys: string[] }): Promise<MemberView>; // POST /orgs/:orgId/members (quyền members.invite)
```
(Đã đối chiếu `memberSelect` và đường `GET /roles` trong /home/user/a/apps/api/src/modules/orgs/routes.ts. `RoleView` trả nguyên bản ghi `Role` của Prisma — thợ W1 kiểm lại tên cột trong schema.prisma.)

---

## 2. Khách hàng — phương án C "Danh sách trái, hồ sơ phải" (quyết định thay)

Bản mẫu: /home/user/a/docs/rnd/v4-khach-hang.html — `#c`, `#c-ct`, `#c-tim`, `#c-sua`, `#c-moi`, `#c-trang-thai`.

Ảnh (3 khổ): /home/user/a/docs/rnd/anh/v4-khach-hang-c-{desktop,tablet,mobile}.png, …-c-ct-…, …-c-tim-…, …-c-sua-…, …-c-moi-…, …-c-trang-thai-…; có nhãn trường: /home/user/a/docs/rnd/anh/v4-khach-hang-truong-c-desktop.png

### 2.1 Đường và điều hướng

| Đường | Màn |
|---|---|
| `/:orgSlug/khach-hang` | Danh sách + hồ sơ khách đầu danh sách (máy tính, máy tính bảng); chỉ danh sách (điện thoại) |
| `/:orgSlug/khach-hang/:customerId` | Hồ sơ một khách (điện thoại: màn con có ‹) |

Mục "Khách hàng" đã có trong `nav.ts` (quyền `customers.read`, có ô ở thanh dưới điện thoại). Không có menu con.

### 2.2 Bố cục

ListDetail thường (380 | 1fr; máy tính bảng 320 | 1fr). Thanh tiêu đề: "Khách hàng" + nút chính "+ Khách mới" (chỉ `customers.write`). Điện thoại: nút "+" ở thanh trên.

*Cột trái*
- Ô tìm "Tìm theo tên hoặc số điện thoại": đợi 300 ms sau lần gõ cuối rồi gọi `GET /customers?q=` (máy chủ tự nhận: có từ 3 chữ số trở lên thì tìm cả số điện thoại; `+84…` được đổi về `0…`). Huỷ yêu cầu cũ khi có yêu cầu mới.
- ListGroupHeader: khi không tìm: "Mới thêm gần đây" · bên phải "{total} khách"; khi tìm: "Kết quả" · "{total} khách".
- Mỗi dòng (ListRow): Avatar chữ viết tắt (màu theo `id`, dãy màu BAN-VE-C 1.1) · họ tên 14/600 **xuống dòng, không cắt** · số điện thoại 12.5px bên phải (khách không có số: bỏ trống). Đúng 3 thông tin.
- Khi tìm theo số: phần số khớp in đậm.
- Cuối danh sách: Button rộng hết "Xem thêm 20 khách" (`page + 1`, nối vào danh sách). Hết thì ẩn.

*Cột phải — 3 thẻ xếp dọc (khe 16)*
1. **Thẻ Thông tin khách**
   - Đầu thẻ: Avatar 32 · họ tên 20/700 · nút "Sửa" (chỉ `customers.write`).
   - Bảng nhãn–giá trị 2 cột (nhãn 140px `--muted`; điện thoại: nhãn trên, giá trị dưới): Số điện thoại (liên kết `tel:`), Email, Ghi chú (giữ xuống dòng), Khách từ (`createdAt`, dd/mm/yyyy). Trống hiện "—".
   - **Sửa tại chỗ** (`#c-sua`): thẻ đổi thành form 4 dòng (Họ và tên `*` · Số điện thoại ? · Email · Ghi chú Textarea 3 dòng), chân thẻ Huỷ · Lưu. Lưu = `PATCH /customers/:id` chỉ trường đã đổi; xoá trắng ô = gửi `null`.
2. **Thẻ Hợp đồng** (chỉ `contracts.read`)
   - Đầu: "Hợp đồng" · "n hợp đồng" · Button sm primary "+ Lập hợp đồng" (chỉ `contracts.write`) → mở `/:orgSlug/hop-dong/moi?customerId={id}` (Lập hợp đồng điền sẵn khách — **yêu cầu gửi W5**).
   - Mỗi dòng: "{code} · {tên dòng gói đầu tiên}" 14/600 · "Sự kiện dd/mm/yyyy" 12.5px · bên phải tổng 14/700 + StatusTag hợp đồng. Bấm → `/:orgSlug/hop-dong/:id`. Xếp theo máy chủ (mới tạo trước).
   - Tên dòng gói chỉ có khi đã tải chi tiết (xem 2.4); chưa tải thì chỉ hiện mã.
3. **Thẻ Lịch makeup** (chỉ `contracts.read`) — tiêu đề phụ "từ các hợp đồng" + Tooltip "Chỉ hiện lịch gắn với hợp đồng của khách. Lịch tạo lẻ chưa lấy được theo khách."
   - Mỗi ca: cột giờ 86px (giờ 13/700, ngày 12px dưới) · tên dòng gói gắn ca 14/600 · "{mã lịch} · {mã HĐ}" 12.5px (không xuống dòng) · StatusTag lịch bên phải (điện thoại: nhãn xuống dưới).
   - Xếp: sắp tới trước (gần nhất trên cùng), rồi đã qua (mới nhất trên cùng).
   - Bấm một ca → `/:orgSlug/lich?ngay=yyyy-mm-dd&ca={appointmentId}` (mở Lịch đúng ngày, mở hộp chi tiết ca — **yêu cầu gửi W6** đọc 2 tham số này).

*Hộp thoại "Khách mới"* (Dialog 560; điện thoại BottomSheet)
- Họ và tên `*` · Số điện thoại · Email · Ghi chú (Textarea 2 dòng). Chân: Huỷ · Thêm khách.
- `POST /customers` + header `Idempotency-Key` (tạo mới mỗi lần mở hộp).
- Đang tìm mà không thấy, bấm "Thêm khách" trong EmptyState → hộp mở sẵn: chuỗi đang tìm là số → điền ô Số điện thoại; là chữ → điền ô Họ tên.
- Xong: đóng hộp, đưa khách mới lên đầu danh sách, mở hồ sơ.

### 2.3 Ô ↔ trường

| Ô | Đọc | Ghi |
|---|---|---|
| Danh sách, tổng số | `GET /customers?page&pageSize=20&q` → `{items[{id, fullName, phone, email, note, createdAt, updatedAt}], page, pageSize, total}` | — |
| Họ tên, SĐT, Email, Ghi chú | `GET /customers/:id` | `PATCH /customers/:id {fullName?, phone?, email?, note?}`; `POST /customers {fullName, phone?, email?, note?}` |
| Khách từ | `createdAt` | — |
| Hợp đồng của khách | `GET /contracts?customerId={id}&pageSize=10` → `items[{id, code, status, eventDate, total, depositRequired, confirmedAt, createdAt}]`, `total` | — |
| Tên dòng gói, lịch | `GET /contracts/:id` (cho từng hợp đồng ở trên) → `lines[{id, kind, name, …}]`, `appointments[{id, code, startsAt, status, contractLineId}]` | — |

### 2.4 Cách tải (để không chậm)

1. Mở hồ sơ: gọi song song `GET /customers/:id` và `GET /contracts?customerId&pageSize=10`.
2. Có danh sách hợp đồng: gọi song song `GET /contracts/:id` cho **tối đa 10** hợp đồng đó (khách thường có 1–3). Thẻ Lịch hiện Skeleton cho tới khi xong.
3. Khách có hơn 10 hợp đồng: cuối thẻ Hợp đồng có "Xem tất cả n hợp đồng" → `/:orgSlug/hop-dong?customerId=…`; thẻ Lịch ghi "Chỉ hiện lịch của 10 hợp đồng gần nhất".

### 2.5 Trạng thái

| Tình huống | Hiển thị |
|---|---|
| Tải lần đầu | Skeleton: 6 dòng (tròn 32 + 2 vạch) ở cột trái; thẻ phải 4 vạch |
| Chưa có khách | EmptyState "Chưa có khách nào. Khách cũng tự được thêm khi lập hợp đồng." + "Thêm khách" |
| Tìm không thấy | EmptyState "Không có khách nào khớp "…". Kiểm tra lại số hoặc thêm khách mới." + "Thêm khách "…"" |
| Khách chưa có hợp đồng | Thẻ Hợp đồng: một dòng `--muted` "Chưa có hợp đồng." + nút "+ Lập hợp đồng"; thẻ Lịch ẩn |
| 400 (số điện thoại, email sai) | Lỗi dưới ô (chữ máy chủ, ví dụ "Số điện thoại không hợp lệ (ví dụ đúng: 0912 345 678 hoặc +84 912 345 678)") |
| 403 `contracts.read` | Không gọi API hợp đồng, ẩn thẻ Hợp đồng và Lịch (không hiện dải đỏ) |
| 404 khách | EmptyState "Không tìm thấy khách hàng" + "Về danh sách" |
| Lỗi mạng | Dải đỏ đầu cột + "Thử lại"; form sửa giữ chữ đang gõ |

### 2.6 Quyền → phần nào hiện

| Quyền | Hiện / bật |
|---|---|
| `customers.read` | Menu, danh sách, thẻ Thông tin (chỉ xem) |
| `customers.write` | "+ Khách mới", "Sửa" |
| `contracts.read` | Thẻ Hợp đồng, thẻ Lịch makeup |
| `contracts.write` | "+ Lập hợp đồng" |

Theo vai trò mẫu: thợ makeup/thợ phụ **không** thấy menu Khách hàng (không có `customers.read`; số khách vẫn hiện trong ca của họ ở Lịch). Kế toán: xem, không sửa. Lễ tân: đủ.

### 2.7 Gói việc theo tệp

| Gói | Tệp sở hữu | Nội dung | Phụ thuộc |
|---|---|---|---|
| **W9 Khách hàng** | `src/features/customers/**`: `CustomersPage.tsx`, `CustomerList.tsx`, `CustomerRow.tsx`, `CustomerDetail.tsx`, `CustomerInfoCard.tsx`, `CustomerEditForm.tsx`, `NewCustomerDialog.tsx`, `CustomerContractsCard.tsx`, `CustomerAppointmentsCard.tsx`, `useCustomerHistory.ts` | Mục 2.2–2.6 | Có sẵn: `src/api/schedule.ts` (`listCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`), `src/api/contracts.ts` (`listContracts`, `getContract`). **Không cần hàm API mới.** |
| Yêu cầu W3 | `routes.tsx`: thay `Placeholder` của `khach-hang` bằng `CustomersPage`, thêm `khach-hang/:customerId` | | |
| Yêu cầu W5 | Lập hợp đồng đọc `?customerId=` để điền sẵn khách | | |
| Yêu cầu W6 | Lịch đọc `?ngay=&ca=` để mở đúng ca | | |

### 2.8 Đề xuất trường / đường mới (KHÔNG vẽ)

1. **Lọc lịch theo khách** `GET /appointments?customerId=` (hoặc `GET /customers/:id/history`) — để thấy cả lịch tạo lẻ không có hợp đồng, và bỏ được bước gọi chi tiết từng hợp đồng.
2. **Danh sách hợp đồng trả thêm** `paid`, `remaining` và tên dòng gói đầu tiên — dùng chung với màn Thu tiền (mục 3).
3. **Ảnh khách** `Customer.avatarFileId` — tệp mục đích `CUSTOMER_AVATAR` đã có nhưng bảng khách chưa có cột (R&D 03 cũng cần cho thẻ chào mừng).
4. **Cảnh báo trùng số điện thoại** khi thêm khách (máy chủ chưa kiểm). Fresha có bước gộp khách trùng.
5. Các ô Studio Pro có mà mình chưa có: địa chỉ, link Facebook/Zalo, nguồn khách, hạng khách, tổng chi tiêu, người phụ trách, tab "Khách tiềm năng". Anh chưa yêu cầu → không vẽ.
6. Ẩn/xoá khách (máy chủ chưa có đường).
