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

---

## 3. Thu tiền hợp đồng dịch vụ — phương án A "Y khuôn Thu tiền đào tạo C" (quyết định thay)

Bản mẫu: /home/user/a/docs/rnd/v4-thu-tien.html — `#a`, `#a-ct`, `#a-tien-do`, `#a-lech`, `#a-hoan`, `#a-vuot`, `#a-huy`, `#so-thu`, `#doanh-thu`, `#trang-thai`.
Khuôn gốc phải giữ: /home/user/a/docs/rnd/v3-dao-tao-C.html `#thu-tien`, `#thong-ke` (ảnh /home/user/a/docs/rnd/anh/v3-dao-tao-C-thu-tien-desktop.png).

Ảnh (3 khổ): /home/user/a/docs/rnd/anh/v4-thu-tien-a-{desktop,tablet,mobile}.png, …-a-ct-…, …-a-tien-do-…, …-a-lech-…, …-a-hoan-…, …-a-vuot-…, …-a-huy-…, …-so-thu-…, …-doanh-thu-…, …-trang-thai-…; có nhãn trường: /home/user/a/docs/rnd/anh/v4-thu-tien-truong-a-desktop.png, /home/user/a/docs/rnd/anh/v4-thu-tien-truong-doanh-thu-desktop.png

### 3.0 Một khuôn cho hai loại hợp đồng — và chỗ khuôn đào tạo phải sửa theo

Màn này và màn Thu tiền đào tạo **dùng chung một bộ component** (`src/features/payments/**`). Khác nhau chỉ ở cột trái và dòng phụ của thẻ đầu. Khi đối chiếu với máy chủ thật, R&D thấy khuôn đào tạo (v3) có 3 ô **chưa có trường**: "Áp vào đợt", "Vào tài khoản", "Người thu". Ở bản vẽ này 3 ô đó **không vẽ** (đã ghi ở 3.8). Thợ dựng phần đào tạo sau này phải theo form ở 3.3, không theo ảnh v3, cho tới khi máy chủ có trường.

Cũng chưa có `Contract.kind`, nên **không có** chip "Khoá học / Dịch vụ makeup" và không có hàng đợi "Quá hạn / 7 ngày tới" theo hạn đợt (cần đường mới, 3.8-1). Cột trái tạm nhóm theo **ngày sự kiện** — dữ liệu có thật.

### 3.1 Đường và điều hướng

| Đường | Màn | Quyền |
|---|---|---|
| `/:orgSlug/thu-tien` | Thu tiền: danh sách + hợp đồng đầu danh sách | `payments.read` |
| `/:orgSlug/thu-tien/:contractId` | Thu tiền một hợp đồng (điện thoại: màn con) | `payments.read` |
| `/:orgSlug/bao-cao/doanh-thu` | Doanh thu | `reports.read` |
| `/:orgSlug/bao-cao/so-thu` | Sổ thu | `payments.read` |

- Thanh trái máy tính: "Hợp đồng" có menu con **Lập hợp đồng · Danh sách hợp đồng · Thu tiền** (giống v3). Mục mới **"Báo cáo"** có menu con **Doanh thu · Sổ thu**.
- `nav.ts` hiện chỉ cho một quyền mỗi mục → **yêu cầu W3**: cho mục và mục con khai quyền riêng; mục "Báo cáo" hiện khi có `reports.read` **hoặc** `payments.read` (lễ tân có `payments.read` mà không có `reports.read`: thấy Sổ thu, không thấy Doanh thu).
- Điện thoại (giữ thanh dưới đã ký ở BAN-VE-C 2.3): ô "Hợp đồng" mở trang có Segmented "Hợp đồng · Thu tiền"; "Báo cáo" nằm trong ngăn "Thêm". (R&D 03 đề xuất đưa "Thu tiền" xuống thanh dưới — đang chờ anh duyệt, bản vẽ này **không** đổi.)
- Từ trang hợp đồng đã xác nhận (W5): thêm liên kết "Thu tiền" → `/:orgSlug/thu-tien/:id` (yêu cầu W5).

### 3.2 Bố cục màn Thu tiền

ListDetail thường (380 | 1fr). Tiêu đề trang: "Thu tiền" + chữ phụ "hợp đồng dịch vụ makeup".

*Cột trái — thẻ "Hợp đồng cần thu"* (chữ phụ "hôm nay dd/mm/yyyy")
- Ô tìm "Tìm mã HĐ, tên khách, số điện thoại" → `GET /contracts?q=`.
- Segmented sm: **Đã xác nhận** (mặc định) · Nháp · Hoàn thành → tham số `status`. (Máy chủ cho thu cọc khi hợp đồng còn nháp.)
- Ba nhóm (ListGroupHeader + số dòng), mỗi nhóm một lần gọi `GET /contracts` với cùng `status`, `q`, `pageSize=50`:
  1. "Sự kiện 7 ngày tới": `eventFrom = hôm nay 00:00`, `eventTo = hôm nay + 7 ngày 23:59` (giờ Việt Nam, ISO kèm `+07:00`)
  2. "Sự kiện sau đó": `eventFrom = hôm nay + 8 ngày`
  3. "Đã qua ngày sự kiện": `eventTo = hôm qua 23:59`
  - Hợp đồng chưa có ngày sự kiện: nhóm 4 "Chưa có ngày sự kiện" — **máy chủ chưa lọc được `eventDate = null`** → không hiện nhóm này; ghi ở 3.8-3.
- Mỗi dòng (ListRow không ảnh): tên khách 14/600 xuống dòng · mã HĐ 12.5px · bên phải tổng hợp đồng 14/700 + nhãn xám "Sự kiện dd/mm". **Không** hiện "còn lại" (danh sách chưa trả số này — 3.8-2).

*Cột phải — 4 khối, từ trên xuống* (giống v3-C)
1. **Thẻ đầu**: StatusTag hợp đồng · tên khách 18/700; dòng phụ 12px "{mã} · Sự kiện dd/mm/yyyy · {SĐT} · Mở hợp đồng" (liên kết tới `/hop-dong/:id`). Dưới là **4 ô số** (lưới 4; máy tính bảng, điện thoại 2×2): Tổng · Cọc phải thu · Đã thu thực tế · **Còn lại** (ô nhấn: viền `--accent-line`, nền `--accent-soft`).
   - Ô Cọc phải thu: nếu `depositOutstanding > 0` thêm dòng 12px `--warn` "còn thiếu {số}".
   - Ô Còn lại: nếu `overpaid > 0` thì số hiện 0 ₫ và thêm dòng 12px "Khách trả thừa {overpaid}".
2. **Hai thẻ cạnh nhau** (máy tính bảng, điện thoại: chồng dọc):
   - **Tiến độ thanh toán**: nút ghost "Sửa tiến độ" (chỉ `payments.write`). Mỗi đợt: chấm tròn 12px (đã đủ: đặc `--ok`; còn lại: viền `--accent`; quá hạn: viền `--danger`) · tên 600 · "Hạn dd/mm/yyyy" 12px · bên phải số tiền 700 + StatusTag đợt (nhãn `INSTALLMENT_STATUS_LABELS`: Đã thu đủ = ok, Đã thu một phần = warn, Chưa đến hạn = xám, Quá hạn = danger). Đợt thu một phần ghi thêm 12px "đã thu {paidAmount}".
     - `scheduleDifference ≠ 0` (thêm phát sinh/huỷ dòng sau khi lập tiến độ): dải vàng trên đầu thẻ "Tổng hợp đồng đã đổi sau khi lập tiến độ: các đợt đang thiếu/thừa {|diff|}. Sửa tiến độ" (`#a-lech`).
     - Chưa lập tiến độ (`installments` rỗng): EmptyState "Chưa lập tiến độ thanh toán. Hợp đồng vẫn ghi phiếu thu được." + nút "Lập tiến độ".
   - **Phiếu đã ghi** (chữ phụ "n phiếu"): mỗi phiếu: "{mã} · dd/mm/yyyy · {cách trả}" 600 · dòng 12px "Ghi bởi {createdBy.fullName} · {ghi chú}" · bên phải số tiền 700 (phiếu hoàn: dấu "−" + nhãn warn "Hoàn") + nút ghost sm "Huỷ phiếu" (chỉ `payments.void`). Phiếu đã huỷ: chấm rỗng xám, chữ gạch ngang, nhãn đỏ "Đã huỷ: {voidReason}", không có nút. Xếp như máy chủ (ngày thu mới nhất trước).
3. **Thẻ "Ghi phiếu thu"** (luôn mở, như v3-C; chỉ `payments.write`; thiếu quyền thì ẩn cả thẻ):

| Dòng | Điều khiển | Trường gửi |
|---|---|---|
| Loại phiếu ? | Segmented Thu · Hoàn tiền (ô "Hoàn tiền" chỉ có khi `payments.void`; không có thì ẩn cả dòng) | `kind: 'RECEIPT' \| 'REFUND'` |
| Số tiền `*` ? | MoneyInput. **Điền sẵn** `outstanding` của đợt chưa đủ có hạn sớm nhất; không có tiến độ thì điền `remaining` (nếu > 0) | `amount` (số nguyên > 0) |
| Cách trả `*` | Segmented 4 ô Tiền mặt · Chuyển khoản · Quẹt thẻ · Khác (nhãn `PAYMENT_METHOD_LABELS`); dòng "wide" (điện thoại: nút xuống dòng dưới nhãn, rộng hết) | `method` |
| Ngày thu | ô ngày (mặc định hôm nay; không cho chọn ngày tương lai) | `receivedAt` (ISO kèm `+07:00`; để nguyên hôm nay thì không gửi) |
| Ghi chú | TextInput; ở chế độ Hoàn tiền: bắt buộc (luật studio — máy chủ không bắt, giao diện bắt) | `note` |

   Chân thẻ: "Lưu phiếu thu" / "Lưu phiếu hoàn" → `POST /contracts/:id/payments` + header `Idempotency-Key` (tạo mới sau mỗi lần lưu thành công). Thành công: thay 4 ô số bằng `summary` trả về, gọi lại `GET /contracts/:id/payments` để cập nhật đợt và phiếu, xoá form (giữ Cách trả vừa chọn).

### 3.3 Hộp thoại

*Sửa tiến độ* (`#a-tien-do`) — Dialog 720 (điện thoại: BottomSheet, bảng thành thẻ).
- Đầu: dòng phụ "{mã} · Tổng {total} · Cọc phải thu {depositRequired}", tiêu đề "Tiến độ thanh toán".
- Hàng nút "Chia gợi ý:" — **Cọc + còn lại vào ngày sự kiện** (`suggestInstallments(total, deposit, 1, hôm nay, số ngày tới sự kiện)`; không có ngày sự kiện thì ẩn nút này) · **Cọc + 2 đợt** · **Cọc + 3 đợt** (khoảng cách 30 ngày). Hàm có sẵn trong `@makeup/shared`.
- Bảng: Tên đợt (TextInput sm) · Hạn (ô ngày) · Số tiền (MoneyInput sm) · Đợt cọc (radio, tối đa 1) · nút ✕. Dưới: "+ Thêm đợt" (tối đa 24 — `MAX_INSTALLMENTS`) · bên phải "Tổng các đợt {số}".
- Giao diện kiểm trước bằng `checkInstallmentPlan` (shared): lệch tổng → dải đỏ đúng câu của hàm ("Tổng các đợt (…) phải bằng tổng hợp đồng (…): còn thiếu …") và **khoá** nút Lưu.
- Lưu → `PUT /contracts/:id/installments {installments:[{name, dueDate, amount, isDeposit}]}` (thay toàn bộ). Xoá hết đợt rồi lưu = bỏ tiến độ.

*Khách trả thừa?* (`#a-vuot`) — khi `POST …/payments` trả **409** có `details.overBy`.
- Dải vàng "Thu vượt tổng hợp đồng {overBy} (còn phải thu {remaining})." · Lý do `*` (Textarea). Nút: "Sửa lại số tiền" (đóng hộp, tiêu điểm ô Số tiền) · "Vẫn ghi phiếu" → gửi lại với **Idempotency-Key mới** (thân đã khác), thêm `allowOverpay: true` và `note`.

*Huỷ phiếu* (`#a-huy`) — ConfirmDialog 440: "Huỷ phiếu {mã}?" · câu giải thích "Phiếu không bị xoá: vẫn hiện trong sổ thu, gạch ngang, kèm lý do. Chỉ huỷ được một lần." · Lý do huỷ `*`. Nút "Giữ phiếu" · "Huỷ phiếu" → `POST /payments/:paymentId/void {reason}`.

### 3.4 Báo cáo › Doanh thu (`#doanh-thu`) — khuôn thống kê C của v3

ListDetail hẹp (300 | 1fr); điện thoại: bộ lọc ở trên, số liệu dưới (không tách màn).
- **Bộ lọc** (cột trái): Kỳ = Segmented Tháng · Quý · Năm + Select kỳ cụ thể → `from`, `to` (đầu kỳ 00:00 +07:00; `to` = đầu kỳ sau, vì máy chủ tính [from, to)). Năm = 12 tháng (≤ 366 ngày). **Không** có lọc "Loại hợp đồng/Nhóm khoá" (chưa có trường).
- **4 StatTile**: Doanh số ? (dưới: "{contractCount} hợp đồng") · Cọc phải thu ? (dưới, nếu > 0: "còn thiếu {depositOutstanding}" màu `--warn`) · Đã thu thực tế ? · **Còn lại** ? (highlight). Chữ trong 4 Tooltip **lấy nguyên từ `basis`** máy chủ trả (sales, depositRequired, collected, outstanding) — không tự viết.
- **Biểu đồ cột đôi 6 tháng** "Doanh số và thực thu 6 tháng" (đơn vị triệu đồng, 1 trục): gọi thêm `GET /reports/revenue?groupBy=month` cho 6 tháng gần nhất tính tới tháng đang chọn. Doanh số `#A63D62`, Thực thu `#5B45A0` (đã chạy bộ kiểm màu: đạt cả mù màu — ΔE 11,8). Cột rộng tối đa 26px, bo trên 4px, khe 2px giữa 2 cột. Chú giải ở trên; rê chuột/chạm vào một tháng hiện hộp "Tháng m · Doanh số x tr · Thực thu y tr". Bảng bên dưới là bản xem dạng bảng.
- **Bảng "Theo hợp đồng"** (`groupBy=contract`): Hợp đồng (mã 700 + tên khách 12px) · Xác nhận (dd/mm) · Tổng · Cọc · Đã thu · Thu trong kỳ · **Còn lại** (700). Dòng `bookedInPeriod = false`: chữ `--muted` + nhãn xám "Kỳ khác" (tooltip: "Chỉ có tiền thu/hoàn trong kỳ, doanh số tính ở kỳ khác"). Hợp đồng đã huỷ: Còn lại hiện "—" (máy chủ trả `null`). Số âm (hoàn nhiều hơn thu trong kỳ) hiện "−300.000 ₫". Máy tính bảng ẩn cột Xác nhận, Cọc; điện thoại thành thẻ.
- **Không có chữ "lợi nhuận"** ở bất cứ đâu.

### 3.5 Báo cáo › Sổ thu (`#so-thu`)

- Bộ lọc như Doanh thu + Chip "Cách trả" (Tất cả · 4 cách) → `method`; Chip "Loại phiếu" (Tất cả · Phiếu thu · Phiếu hoàn) → `kind`.
- 3 StatTile: Tổng thu (dưới "{receiptCount} phiếu") · Tổng hoàn ("{refundCount} phiếu") · **Thực thu** ? (highlight; tooltip "Thu trừ hoàn, không tính phiếu đã huỷ").
- Bảng: Ngày thu · Phiếu (mã; nhãn "Hoàn" / "Đã huỷ"; dòng 12px người ghi) · Hợp đồng · khách (liên kết tới `/thu-tien/:contractId`) · Cách trả (ẩn ở máy tính bảng) · Số tiền. Phiếu đã huỷ: cả dòng `--muted`, mã và số gạch ngang (vẫn hiện để đối soát). 50 dòng/trang, nút trang ở chân.
- Nút "Tải CSV" ở đầu trang: **tạo phía máy** từ các trang đã tải (không có đường xuất riêng). Nếu chưa tải hết trang thì tải nốt rồi mới xuất.

### 3.6 Ô ↔ trường

| Ô | Đọc | Ghi |
|---|---|---|
| Danh sách hợp đồng (trái) | `GET /contracts?status&q&eventFrom&eventTo&pageSize=50` → `items[{id, code, status, eventDate, total, customer{fullName, phone}}]` | — |
| Thẻ đầu + 4 ô số | `GET /contracts/:id/payments` → `contract{id, code, status, eventDate, confirmedAt, customer{id, fullName, phone}}`, `summary{total, depositRequired, received, refunded, paid, remaining, overpaid, depositOutstanding}` | — |
| Các đợt | `installments[{id, name, dueDate, amount, isDeposit, sortOrder, paidAmount, outstanding, status}]`, `installmentsTotal`, `scheduleDifference` | `PUT /contracts/:id/installments` |
| Phiếu | `payments[{id, code, kind, method, amount, receivedAt, note, voidedAt, voidReason, createdAt, createdBy{id, fullName}}]` | `POST /payments/:paymentId/void {reason}` |
| Form phiếu | — | `POST /contracts/:id/payments {kind, method, amount, receivedAt?, note?, allowOverpay?}` → trả `{…phiếu, contract, summary}` |
| Doanh thu | `GET /reports/revenue?from&to&groupBy=month\|contract` → `totals{contractCount, sales, depositRequired, depositOutstanding, outstanding, received, refunded, collected}`, `basis{…}`, `rows[]` | — |
| Sổ thu | `GET /payments?from&to&method&kind&contractId&page&pageSize` → `totals{received, receiptCount, refunded, refundCount, net}`, `items[{…phiếu, contract{id, code, customer{id, fullName}}}]`, `total` | — |

### 3.7 Trạng thái, lỗi, quyền

| Tình huống | Hiển thị |
|---|---|
| Tải lần đầu | Skeleton: 4 ô số (2 vạch mỗi ô), 2 thẻ 3 dòng |
| Nhóm trái rỗng | Ẩn nhóm. Cả 3 nhóm rỗng: EmptyState "Không có hợp đồng {trạng thái} nào." |
| 400 khi lưu phiếu/tiến độ | Lỗi dưới ô (đường dẫn trường trong lỗi), hoặc dải đỏ chữ máy chủ (lỗi từ `checkInstallmentPlan`) |
| 409 thu vượt | Hộp "Khách trả thừa?" |
| 409 hoàn vượt số đã thu / huỷ phiếu thu làm số đã thu âm / phiếu đã huỷ trước đó / hợp đồng đã huỷ (chỉ ghi được phiếu hoàn) / lập tiến độ cho hợp đồng đã huỷ | Dải đỏ trên thẻ liên quan, **đúng chữ máy chủ**; giữ dữ liệu đã nhập |
| 404 hợp đồng | EmptyState "Không tìm thấy hợp đồng" + "Về danh sách" |
| Mất mạng khi lưu | Dải vàng đầu trang, nút Lưu khoá; bấm lại dùng **cùng** Idempotency-Key (không sinh phiếu đôi) |

| Quyền | Hiện / bật |
|---|---|
| `payments.read` | Menu Thu tiền, màn Thu tiền (chỉ xem), Sổ thu |
| `payments.write` | Thẻ "Ghi phiếu thu", nút "Sửa tiến độ" / "Lập tiến độ" |
| `payments.void` | Ô "Hoàn tiền" trong Loại phiếu, nút "Huỷ phiếu" |
| `reports.read` | Doanh thu |
| `contracts.read` | Cột trái (danh sách hợp đồng). Không có thì cột trái là EmptyState "Bạn không có quyền xem danh sách hợp đồng" (vẫn mở được `/thu-tien/:id` qua liên kết) |

Theo vai trò mẫu: lễ tân ghi phiếu thu, không hoàn/huỷ, không xem Doanh thu. Kế toán: đủ (cả huỷ phiếu, doanh thu). Quản lý: đủ. Thợ: không thấy.

### 3.8 Đề xuất trường / đường mới (KHÔNG vẽ)

1. **Hàng đợi cần thu theo hạn đợt** `GET /payments/due?until=` → các đợt chưa thu đủ của mọi hợp đồng (Quá hạn / 7 ngày tới / Sau đó) — để có đúng hàng đợi như v3-C. Khi có: chỉ đổi phần nhóm của cột trái, khuôn giữ nguyên.
2. `GET /contracts` trả thêm `paid`, `remaining` (dùng chung với màn Khách hàng).
3. Lọc `eventDate = null` (`?noEventDate=true`) để hiện nhóm "Chưa có ngày sự kiện".
4. `Contract.kind` (khoá học / dịch vụ) — để có chip lọc và tách doanh thu theo loại như v3.
5. `Payment.installmentId` (áp vào đợt), `Payment.accountLabel` (vào tài khoản), `Payment.receivedByMembershipId` (người thu) — 3 ô của khuôn v3 chưa có trường.
6. Ảnh minh chứng chuyển khoản `Payment.proofFileId` (Studio Pro bắt buộc; anh chưa yêu cầu).
7. Đường xuất CSV/Excel sổ thu phía máy chủ (khi sổ dài).

### 3.9 Gói việc theo tệp

| Gói | Tệp sở hữu | Nội dung | Phụ thuộc |
|---|---|---|---|
| **W10 Thu tiền** | `src/features/payments/**`: `PaymentsPage.tsx`, `ContractQueue.tsx`, `PaymentPanel.tsx` (khối phải, **dùng lại cho đào tạo**), `SummaryTiles.tsx`, `InstallmentsCard.tsx`, `InstallmentsDialog.tsx`, `PaymentsCard.tsx`, `PaymentForm.tsx`, `OverpayDialog.tsx`, `VoidPaymentDialog.tsx`, `usePaymentProgress.ts`; **`src/api/payments.ts` (tệp mới)** | Mục 3.1–3.3 | Có sẵn `src/api/contracts.ts` (`listContracts`) |
| **W10b Báo cáo** | `src/features/reports/**`: `RevenuePage.tsx`, `RevenueTiles.tsx`, `RevenueChart.tsx`, `RevenueByContractTable.tsx`, `LedgerPage.tsx`, `LedgerTable.tsx`, `PeriodFilter.tsx`, `csv.ts`; **`src/api/reports.ts` (tệp mới)** | Mục 3.4–3.5 | `src/api/payments.ts` (chỉ import kiểu `PaymentView`) |
| Yêu cầu W3 | `nav.ts` (menu con Hợp đồng, mục Báo cáo, quyền theo mục con), `routes.tsx` (4 đường ở 3.1) | | |
| Yêu cầu W5 | Liên kết "Thu tiền" trong trang hợp đồng | | |

W10 và W10b chạy song song: W10b chỉ import kiểu từ `src/api/payments.ts`; nếu W10 chưa xong thì W10b tự khai kiểu tạm trong `src/api/reports.ts` rồi đổi sang import sau.

### 3.10 Hàm API web cần thêm

```ts
// src/api/payments.ts (mới, W10)
export type PaymentKind = 'RECEIPT' | 'REFUND';           // lấy từ @makeup/shared: PAYMENT_KINDS
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
export type InstallmentStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE';
export interface PaymentView { id: string; code: string; contractId: string; kind: PaymentKind; method: PaymentMethod; amount: Vnd; receivedAt: IsoDateTime; note: string | null; voidedAt: IsoDateTime | null; voidReason: string | null; createdAt: IsoDateTime; createdBy: { id: string; fullName: string } }
export interface PaymentSummary { total: Vnd; depositRequired: Vnd; received: Vnd; refunded: Vnd; paid: Vnd; remaining: Vnd; overpaid: Vnd; depositOutstanding: Vnd }
export interface InstallmentView { id: string; name: string; dueDate: IsoDateTime; amount: Vnd; isDeposit: boolean; sortOrder: number; paidAmount: Vnd; outstanding: Vnd; status: InstallmentStatus }
export interface PaymentProgress { contract: { id: string; code: string; status: ContractStatus; eventDate: IsoDateTime | null; confirmedAt: IsoDateTime | null; customer: { id: string; fullName: string; phone: string | null } }; summary: PaymentSummary; installments: InstallmentView[]; installmentsTotal: Vnd; scheduleDifference: Vnd | null; payments: PaymentView[] }
export interface InstallmentInput { name: string; dueDate: IsoDateTime; amount: Vnd; isDeposit?: boolean }
export interface PaymentInput { kind?: PaymentKind; method: PaymentMethod; amount: Vnd; receivedAt?: IsoDateTime; note?: string; allowOverpay?: boolean }
export interface PaymentResult extends PaymentView { contract: { id: string; code: string; status: ContractStatus }; summary: PaymentSummary }
export function getPaymentProgress(orgId: string, contractId: string, signal?: AbortSignal): Promise<PaymentProgress>;                  // GET  /contracts/:id/payments
export function putInstallments(orgId: string, contractId: string, installments: InstallmentInput[]): Promise<PaymentProgress>;          // PUT  /contracts/:id/installments
export function createPayment(orgId: string, contractId: string, input: PaymentInput, idempotencyKey: string): Promise<PaymentResult>;  // POST /contracts/:id/payments
export function voidPayment(orgId: string, paymentId: string, reason: string): Promise<PaymentResult>;                                  // POST /payments/:id/void
export interface LedgerQuery { from: IsoDateTime; to: IsoDateTime; method?: PaymentMethod; kind?: PaymentKind; contractId?: string; page?: number; pageSize?: number }
export interface Ledger { from: string; to: string; totals: { received: Vnd; receiptCount: number; refunded: Vnd; refundCount: number; net: Vnd }; items: (PaymentView & { contract: { id: string; code: string; customer: { id: string; fullName: string } } })[]; page: number; pageSize: number; total: number }
export function listPayments(orgId: string, query: LedgerQuery, signal?: AbortSignal): Promise<Ledger>;                                // GET  /payments

// src/api/reports.ts (mới, W10b)
export interface RevenueBucket { contractCount: number; sales: Vnd; depositRequired: Vnd; depositOutstanding: Vnd; outstanding: Vnd; received: Vnd; refunded: Vnd; collected: Vnd }
export interface RevenueByContractRow { contractId: string; code: string; status: ContractStatus; customer: { id: string; fullName: string }; confirmedAt: IsoDateTime | null; eventDate: IsoDateTime | null; bookedInPeriod: boolean; total: Vnd; depositRequired: Vnd; paid: Vnd; paidInPeriod: Vnd; remaining: Vnd | null; depositOutstanding: Vnd | null }
export interface RevenueReport<R> { from: string; to: string; groupBy: 'month' | 'contract'; basis: { sales: string; depositRequired: string; collected: string; outstanding: string }; totals: RevenueBucket; rows: R[] }
export function getRevenueByMonth(orgId: string, q: { from: IsoDateTime; to: IsoDateTime }, signal?: AbortSignal): Promise<RevenueReport<RevenueBucket & { period: string }>>;      // groupBy=month
export function getRevenueByContract(orgId: string, q: { from: IsoDateTime; to: IsoDateTime }, signal?: AbortSignal): Promise<RevenueReport<RevenueByContractRow>>;                // groupBy=contract
```

---

## 4. Hồ sơ thương hiệu & trang giới thiệu — phương án C "Sửa bên trái, xem trước bên phải" (quyết định thay)

Bản mẫu: /home/user/a/docs/rnd/v4-thuong-hieu.html — `#c`, `#c-xem`, `#c-chua`, `#c-go` (màn sửa) và `#trang`, `#trang-404` (trang công khai).

Ảnh (3 khổ): /home/user/a/docs/rnd/anh/v4-thuong-hieu-c-{desktop,tablet,mobile}.png, …-c-xem-…, …-c-chua-…, …-c-go-…, …-trang-{desktop,tablet,mobile}.png, …-trang-404-…; có nhãn trường: /home/user/a/docs/rnd/anh/v4-thuong-hieu-truong-c-desktop.png, /home/user/a/docs/rnd/anh/v4-thuong-hieu-truong-trang-desktop.png

### 4.1 Đường

| Đường | Màn | Ai vào |
|---|---|---|
| `/:orgSlug/cai-dat/thuong-hieu` | Sửa hồ sơ thương hiệu (mục con duy nhất của "Cài đặt" lúc này; vào `/cai-dat` thì chuyển thẳng tới đây) | `org.update` (mục "Cài đặt" đã có trong `nav.ts`) |
| `/trang/:slug` | Trang giới thiệu công khai | **mọi người, không cần đăng nhập** |

**Rủi ro trùng đường — cần máy chủ sửa trước khi phát hành:** web dùng `/:orgSlug/...`, nên `/trang/...` chỉ an toàn nếu không tổ chức nào được đặt đường dẫn `trang`. Danh sách cấm `RESERVED_SLUGS` (/home/user/a/apps/api/src/modules/orgs/routes.ts dòng 11) **chưa có** `trang` → đề xuất thêm (một dòng, việc của đội máy chủ). Khi chưa thêm, trang công khai của tổ chức có slug `trang` sẽ bị đè.

### 4.2 Bố cục màn sửa

- **Thanh xuất bản** (thẻ ngang trên cùng, đệm 12 18): StatusTag "Đang công khai từ dd/mm/yyyy" (ok) hoặc "Chưa xuất bản" (nháp) · đường dẫn "makeuppro.vn/trang/**{slug}**" 13px `--muted` (tên miền lấy từ cấu hình web, không cứng) · "Sao chép liên kết" · khi đang công khai: "Mở trang" (tab mới) + "Gỡ trang" (viền đỏ); khi chưa: "Xuất bản" (primary).
- **Thân hai cột**: `1fr | 420px` (máy tính bảng `1fr | 340px`), khe 20.
  - Trái: một thẻ form, 6 nhóm có tiêu đề nhóm (BAN-VE-C: 13/700, gạch dưới), dòng "wide" (nhãn | ô 360px).
  - Phải: khối **Xem trước** dính đầu (`top:16px`): hàng "Xem trước" + Segmented sm "Điện thoại · Máy tính" (đổi bề rộng khung: 375px hoặc 100% có thu nhỏ); khung viền `--line` bo 12, cao tối đa `100vh − 120px`, cuộn riêng, hiện component `SiteView` (4.4) **từ bản nháp đang sửa** — gõ tới đâu đổi tới đó.
  - Điện thoại: không có cột phải; đầu trang có Segmented 2 ô "Sửa hồ sơ · Xem trước" (`#c-xem`).
- **Thanh lưu dính đáy** (StickyTotalBar dùng lại): chỉ hiện khi có thay đổi: "Có thay đổi chưa lưu" · "Bỏ thay đổi" · **"Lưu hồ sơ"**. Khi trang chưa xuất bản thêm nút "Lưu và xuất bản" (PUT rồi POST publish).

*Các nhóm form*

| Nhóm | Dòng (nhãn → điều khiển) | Trường |
|---|---|---|
| Thương hiệu | Tên thương hiệu `*` → TextInput | `brandName` (1–120) |
| | Câu giới thiệu ngắn ? → TextInput | `tagline` (≤200) |
| | Giới thiệu → Textarea 3 dòng (nhãn trên) | `bio` (≤5000) |
| | Kinh nghiệm → TextInput | `experience` (≤2000) |
| | Phong cách ? → các Chip đang bật có "✕" + nút dashed "+ Thêm" (mở ô nhập nhỏ, Enter để thêm) | `styles[]` (≤20 mục, mỗi mục ≤50) |
| | Khu vực phục vụ → TextInput | `serviceArea` (≤500) |
| Ảnh ? | 3 ô ImageUpload: Logo (vuông 96) · Ảnh đại diện (tròn 96) · Ảnh bìa (ngang, phần còn lại) — mỗi ô: "Đổi"/"Tải ảnh", "Bỏ" | `logoFileId` (tải với `purpose=ORG_LOGO`, ≤2 MB) · `avatarFileId` và `coverFileId` (tải với `purpose=ALBUM_IMAGE`, ≤15 MB) |
| Liên hệ | Địa chỉ · Số điện thoại · Zalo ? · Email · Facebook · TikTok · Instagram · Website | `address, phone, zalo, email, facebook, tiktok, instagram, website` (mạng xã hội/website: chỉ `https://…`; Zalo: số hoặc `https://zalo.me/…`) |
| Giờ làm việc ? | 7 hàng Thứ Hai → Chủ nhật: tên thứ 84px · Switch (mở cửa) · ca 1 "08:00 – 12:00" (2 ô giờ sm 76px) · ca 2 nếu có · nút ghost "+ Ca 2" | `workingHours[{weekday 1–7, open 'HH:mm', close 'HH:mm'}]` (mỗi thứ ≤2 ca, đóng sau mở, không chồng) |
| Chính sách | Đặt lịch · Đặt cọc · Huỷ lịch → Textarea 2 dòng (nhãn trên) | `bookingPolicy, depositPolicy, cancellationPolicy` (≤5000) |
| Gói hiện trên trang ? | Mỗi gói đang bán: tên · giá 12.5px · Switch | `isPublic` của gói → **`PATCH /packages/:id {isPublic}` lưu ngay** (không chờ "Lưu hồ sơ"); chỉ `catalog.write`, thiếu quyền thì Switch khoá |

*Luật lưu*
- `PUT /profile` **ghi toàn bộ**: trường không gửi bị xoá trắng. Giao diện giữ bản nháp đầy đủ lấy từ `GET /profile` và **luôn gửi đủ 21 trường** (kể cả 3 `*FileId`). Không gửi `isPublished`/`publishedAt` (máy chủ từ chối trường lạ).
- Ảnh: chọn tệp → `uploadFile` (mục 0.3) → ghi `id` vào bản nháp → xem trước dùng `signedUrl` vừa nhận → bấm "Lưu hồ sơ" mới gắn. "Bỏ" = đặt `null`.
- URL ảnh có hạn 10 phút (`logo.expiresAt`…): khi quay lại tab mà đã quá hạn thì gọi lại `GET /profile` (chỉ thay URL, không đè bản nháp đang sửa).
- Rời trang khi còn thay đổi: ConfirmDialog "Bỏ thay đổi hồ sơ?".

*Xuất bản / gỡ*
- "Xuất bản" → `POST /profile/publish`. Chưa có hồ sơ hoặc tên trống → 400; giao diện chặn trước: nút khoá + tooltip "Lưu tên thương hiệu trước".
- "Gỡ trang" → ConfirmDialog (`#c-go`) "Gỡ trang giới thiệu? Khách mở liên kết sẽ thấy "Không tìm thấy trang giới thiệu". Hồ sơ vẫn giữ nguyên, xuất bản lại lúc nào cũng được." → `POST /profile/unpublish`.
- Chưa có hồ sơ (`hasProfile = false`, `#c-chua`): dải xám giải thích + EmptyState có một ô "Tên thương hiệu" và nút "Lưu và tiếp tục" (PUT chỉ với `brandName`), sau đó hiện form đầy đủ.

### 4.3 Trang công khai `/trang/:slug`

- Không có khung app (không thanh trái/dưới). Nền trắng, giữa trang rộng tối đa 1080px.
- Gọi `GET /public/sites/:slug` (không gửi thẻ đăng nhập; máy chủ cho trình duyệt giữ 60 giây). 404 → trang "Không tìm thấy trang giới thiệu" + "Liên kết có thể sai, hoặc studio đã gỡ trang." (`#trang-404`) — mọi lý do (sai slug, chưa xuất bản, tổ chức bị khoá) cùng một chữ, đúng như máy chủ.
- Bố cục theo **bề rộng khung chứa** (container query, để dùng lại được trong khung xem trước):
  - < 760px (điện thoại, khung xem trước): một cột: Ảnh bìa 150px → logo tròn 76 đè lên bìa −38px → tên 21/700 → câu giới thiệu → 2 nút "Gọi {SĐT}" (primary, `tel:`) · "Nhắn Zalo" (`https://zalo.me/{số}` hoặc liên kết có sẵn) → Bảng giá → Giới thiệu → Giờ làm việc → Chính sách → Liên hệ → chân "Trang tạo bằng Makeup Pro".
  - ≥ 760px: bìa 260px, logo 104; đầu trang thành hàng ngang (logo · tên + câu · 2 nút bên phải); thân 2 cột `1fr | 320px`: trái Bảng giá (thẻ gói 2 cột) + Giới thiệu; phải Giờ làm việc, Chính sách, Liên hệ.
- **Bảng giá**: nhóm theo `packages[].subject.name` (theo thứ tự `subjects[]`; gói không nhân vật vào nhóm "Gói khác" cuối). Thẻ gói: tên 15/700 · giá `price.unitPrice` 700 bên phải (nếu `salePrice` < `listPrice`: giá niêm yết gạch ngang 12px dưới) · dòng "{thời lượng} · {nơi làm}" · mỗi món `included[]` "✓ {tên} × {số}" · "Miễn phí di chuyển trong {includedKm} km" (chỉ khi gói cho làm tại nhà/nơi khác và `includedKm` có) · các nhãn "+ {dịch vụ phụ} {giá}" từ `addons[]`. Không có `price` (chưa đặt giá) → hiện "Liên hệ".
- Dịch vụ lẻ `services[]` (nếu có): nhóm "Dịch vụ lẻ" cuối Bảng giá, mỗi dòng tên · giá.
- Ô trống thì **ẩn cả mục** (ví dụ không có chính sách nào → không có mục Chính sách).
- Phần chia sẻ lên Zalo/Facebook cần thẻ `og:` do máy chủ in sẵn — web một trang không làm được (đề xuất 4.7-3).

### 4.4 Ô ↔ trường

| Ô | Đọc | Ghi |
|---|---|---|
| Mọi ô của form | `GET /profile` → `{hasProfile, profile: {brandName, tagline, bio, experience, styles, serviceArea, address, phone, email, zalo, facebook, instagram, tiktok, website, logoFileId, avatarFileId, coverFileId, workingHours, bookingPolicy, cancellationPolicy, depositPolicy, isPublished, publishedAt, updatedAt, logo{url,expiresAt}\|null, avatar…, cover…}}` | `PUT /profile` (đủ trường) |
| Trạng thái công khai | `isPublished`, `publishedAt` | `POST /profile/publish`, `POST /profile/unpublish` |
| Đường dẫn trang | `slug` của tổ chức (`GET /auth/me` → `organizations[].slug`) | — |
| Gói hiện trên trang | `GET /packages?isActive=true` → `id, name, isPublic, currentPrice.unitPrice` | `PATCH /packages/:id {isPublic}` |
| Trang công khai | `GET /public/sites/:slug` → `site{name, slug, timezone}`, `profile{…, logo, avatar, cover}`, `services[{id, kind, name, description, durationMinutes, category, price}]`, `packages[{id, name, description, durationMinutes, staffCount, subject, locationTypes, includedKm, terms, price{listPrice, salePrice, unitPrice}, included[{name, quantity}], addons[{serviceId, name, durationMinutes, quantity, price}]}]`, `subjects[]`, `travel{freeKm}` | — |

Khung xem trước ở màn sửa **dựng dữ liệu giống trang công khai từ bản nháp + `GET /packages`** (chỉ gói `isPublic`), nên có thể lệch nhẹ với trang thật (dịch vụ phụ không công khai, km miễn phí lấy mức chung). Nút "Mở trang" để xem bản thật.

### 4.5 Trạng thái, quyền

| Tình huống | Hiển thị |
|---|---|
| Tải lần đầu | Skeleton form (6 nhóm × 2 vạch) và khung xem trước xám |
| 400 (liên kết không https, số sai, giờ chồng) | Lỗi dưới đúng ô; giờ làm việc: lỗi dưới hàng thứ đó (máy chủ trả đường dẫn `[i, 'close']` hoặc câu "Thứ 3: ca … và ca … chồng nhau") |
| 400 ảnh (sai loại, quá dung lượng, không thuộc tổ chức) | Lỗi dưới ô ảnh, giữ ảnh cũ |
| 403 | Không vào được trang (menu "Cài đặt" ẩn khi thiếu `org.update`) |
| Mất mạng khi lưu | Dải vàng, giữ bản nháp |

| Quyền | Hiện / bật |
|---|---|
| `org.update` | Vào màn, sửa, xuất bản, gỡ |
| `files.write` | Nút tải/đổi ảnh (không có thì ô ảnh chỉ xem) |
| `catalog.read` / `catalog.write` | Nhóm "Gói hiện trên trang" (xem / bật tắt) |

### 4.6 Gói việc theo tệp

| Gói | Tệp sở hữu | Nội dung | Phụ thuộc |
|---|---|---|---|
| **W11 Thương hiệu** | `src/features/brand/**`: `BrandProfilePage.tsx`, `PublishBar.tsx`, `BrandForm.tsx`, `groups/IdentityGroup.tsx`, `groups/ImagesGroup.tsx`, `groups/ContactGroup.tsx`, `groups/WorkingHoursGroup.tsx`, `groups/PoliciesGroup.tsx`, `groups/PublicPackagesGroup.tsx`, `PreviewPane.tsx`, `draftToSite.ts`, `useProfileDraft.ts`; **`src/api/profile.ts` (mới)** | 4.2 | `src/api/files.ts` (W8), `SiteView` (W12), `src/api/catalog.ts` (`listPackages`, `updatePackage`) |
| **W12 Trang công khai** | `src/features/public-site/**`: `PublicSitePage.tsx`, `SiteView.tsx` (nhận `PublicSite`, không gọi API — để W11 dùng làm xem trước), `site.css`; **`src/api/publicSite.ts` (mới)** | 4.3 | — (làm trước hoặc song song W11; W11 dùng tạm khung rỗng nếu chưa có) |
| Yêu cầu W3 | `routes.tsx`: `/trang/:slug` (ngoài `RequireAuth`, **trước** `:orgSlug`), `cai-dat` → `cai-dat/thuong-hieu`; `nav.ts`: mục con "Hồ sơ thương hiệu" | | |
| Yêu cầu đội máy chủ | thêm `'trang'` vào `RESERVED_SLUGS` | | |

### 4.7 Đề xuất trường / đường mới (KHÔNG vẽ)

1. **Album ảnh** (Fresha bắt ít nhất 3 ảnh cơ sở khi tạo trang): `OrganizationProfile.galleryFileIds[]`.
2. **Liên kết bản đồ** (Studio Pro có ô "Link Google Map"): `OrganizationProfile.mapUrl`.
3. **Trang in sẵn thẻ `og:`** (ảnh, tên, câu giới thiệu) phía máy chủ để chia sẻ Zalo/Facebook hiện đẹp.
4. **Nút "Đặt lịch" trên trang công khai** — chưa có đường đặt lịch cho khách; anh chưa yêu cầu.
5. Dọn tệp ảnh đã tải mà không lưu hồ sơ (hiện để lại tệp mồ côi).
6. Tên miền riêng (gói thuê bao có cờ `customDomain` nhưng chưa có cấu hình).

### 4.8 Hàm API web cần thêm

```ts
// src/api/profile.ts (mới, W11)
export interface WorkingShift { weekday: 1|2|3|4|5|6|7; open: string; close: string }   // 'HH:mm'
export interface SignedImage { url: string; expiresAt: IsoDateTime }
export interface ProfileInput { brandName: string; tagline: string|null; bio: string|null; experience: string|null; styles: string[]; serviceArea: string|null; address: string|null; phone: string|null; email: string|null; zalo: string|null; facebook: string|null; instagram: string|null; tiktok: string|null; website: string|null; logoFileId: string|null; avatarFileId: string|null; coverFileId: string|null; workingHours: WorkingShift[]; bookingPolicy: string|null; cancellationPolicy: string|null; depositPolicy: string|null }
export interface BrandProfile extends ProfileInput { isPublished: boolean; publishedAt: IsoDateTime|null; updatedAt: IsoDateTime; logo: SignedImage|null; avatar: SignedImage|null; cover: SignedImage|null }
export type ProfileResult = { hasProfile: false; profile: null } | { hasProfile: true; profile: BrandProfile };
export function getProfile(orgId: string, signal?: AbortSignal): Promise<ProfileResult>;     // GET  /orgs/:orgId/profile
export function putProfile(orgId: string, input: ProfileInput): Promise<ProfileResult>;      // PUT  — luôn gửi đủ trường
export function publishProfile(orgId: string): Promise<ProfileResult>;                       // POST /profile/publish
export function unpublishProfile(orgId: string): Promise<ProfileResult>;                     // POST /profile/unpublish

// src/api/publicSite.ts (mới, W12) — gọi KHÔNG kèm thẻ đăng nhập, 401 không được kích hoạt "hết phiên"
export interface PublicPrice { listPrice: Vnd; salePrice: Vnd|null; unitPrice: Vnd }
export interface PublicSite { site: { name: string; slug: string; timezone: string }; profile: Omit<BrandProfile, 'isPublished'|'updatedAt'|'logoFileId'|'avatarFileId'|'coverFileId'>; services: { id: string; kind: ServiceKind; name: string; description: string|null; durationMinutes: number|null; category: string|null; price: PublicPrice|null }[]; packages: { id: string; name: string; description: string|null; durationMinutes: number; staffCount: number; subject: { id: string; name: string }|null; locationTypes: LocationType[]; includedKm: number|null; terms: string|null; price: PublicPrice|null; included: { name: string; quantity: number }[]; addons: { serviceId: string; name: string; durationMinutes: number|null; quantity: number; price: PublicPrice|null }[] }[]; subjects: { id: string; name: string }[]; travel: { freeKm: number|null } }
export function getPublicSite(slug: string, signal?: AbortSignal): Promise<PublicSite>;      // GET /public/sites/:slug
```
(Kiểu `durationMinutes`, `description` của gói/dịch vụ: thợ W12 đối chiếu lại `select` trong /home/user/a/apps/api/src/modules/profile/public.ts và schema.prisma — có thể null hay không.)

---

## 5. Quản trị nền tảng SaaS — phương án B "Trang chủ việc cần làm + danh sách hai cột" (quyết định thay)

Bản mẫu: /home/user/a/docs/rnd/v4-quan-tri.html — `#b`, `#b-ds`, `#b-ct`, `#gia-han`, `#khoa`, `#b-goi`, `#goi-sua`, `#trang-thai`, `#khong-quyen`.

Ảnh (3 khổ): /home/user/a/docs/rnd/anh/v4-quan-tri-b-{desktop,tablet,mobile}.png, …-b-ds-…, …-b-ct-…, …-gia-han-…, …-khoa-…, …-b-goi-…, …-goi-sua-…, …-trang-thai-…, …-khong-quyen-…; có nhãn trường: /home/user/a/docs/rnd/anh/v4-quan-tri-truong-b-desktop.png, /home/user/a/docs/rnd/anh/v4-quan-tri-truong-b-ds-desktop.png

### 5.1 Cách vào — không có mật khẩu dùng chung

- **Không** có trang đăng nhập riêng, **không** có mật khẩu chung, **không** có nút "đổi mật khẩu quản trị", **không** có nút "đặt lại mật khẩu cho chủ studio" (Studio Pro có cả 4 thứ này — đây là lỗi số 6 đã ghi; mình bỏ hết).
- Quyền quản trị nền tảng chỉ cấp bằng lệnh chạy trên máy chủ (`src/scripts/grant-platform-admin.ts`). Người được cấp **đăng nhập như mọi người** rồi mở `/quan-tri`.
- Web không biết trước ai là quản trị (`GET /auth/me` không có cờ): trang `/quan-tri` gọi `GET /platform/stats` trước.
  - 200 → hiện trang.
  - **404** → hiện **đúng màn "Không có trang này."** như đường bịa (`#khong-quyen`), không lộ là có trang quản trị. Không hiện chữ "bạn không có quyền".
- Không có liên kết tới `/quan-tri` ở bất kỳ đâu trong app của studio.
- `quan-tri` đã nằm trong `RESERVED_SLUGS` của máy chủ → không trùng đường tổ chức.

### 5.2 Đường và khung

| Đường | Màn |
|---|---|
| `/quan-tri` | Trang chủ (số liệu + việc cần làm) |
| `/quan-tri/to-chuc` | Tổ chức: danh sách + chi tiết tổ chức đầu danh sách |
| `/quan-tri/to-chuc/:organizationId` | Chi tiết một tổ chức (điện thoại: màn con) |
| `/quan-tri/goi-cuoc` | Gói cước + hạn mức |

Khung riêng `PlatformShell` (cùng token, khác menu): thanh trái 240 — tên "Quản trị nền tảng", người dùng + dòng "Quản trị nền tảng", 3 mục **Trang chủ · Tổ chức · Gói cước**. Máy tính bảng: 68px chỉ biểu tượng. Điện thoại: thanh dưới **3 ô** (không phải 5).

### 5.3 Trang chủ (`#b`)

- Tiêu đề "Trang chủ quản trị" + chữ phụ "số liệu lúc {generatedAt}".
- **4 StatTile**:
  1. Tổ chức: `organizations.total`; dưới "{byStatus.SUSPENDED} đang khoá".
  2. Đang dùng trả phí: `bySubscriptionStatus.ACTIVE`; dưới "{TRIAL} đang dùng thử".
  3. Sắp hết hạn 30 ngày (biến thể danger): `expiringIn30Days`; dưới "{EXPIRED} đã hết hạn · {PAST_DUE} chậm thanh toán".
  4. **Doanh thu thuê bao dự kiến/tháng** (highlight): `projectedMonthlyRevenue`; dưới "không phải tiền đã thu"; Tooltip = nguyên văn `projectedMonthlyRevenueNote`. **Không** gọi là doanh thu đã thu, không gọi là lợi nhuận.
- **Hai thẻ cạnh nhau** (máy tính bảng, điện thoại: chồng dọc):
  - "Sắp hết hạn · 30 ngày tới" + liên kết "Xem tất cả" (mở `/quan-tri/to-chuc?loc=sap-het-han`): `GET /platform/organizations?expiringWithinDays=30&pageSize=5`. Mỗi dòng: tên tổ chức 600 · dòng phụ "{tên gói} · StatusTag" · bên phải ngày hết hạn 700 + Button sm "Gia hạn" (mở hộp 5.5 cho tổ chức đó).
  - "Hết hạn, còn ân hạn" (chữ phụ "còn ghi được tới hết ân hạn"): `GET /platform/organizations?subscriptionStatus=EXPIRED&pageSize=20`, **lọc phía máy** `subscription.inGrace = true`. Mỗi dòng: tên · "Hết dd/mm · StatusTag" · bên phải "ân hạn đến **dd/mm**" (`graceEndsAt`) + "Gia hạn". Dưới cùng nhóm "Tổ chức mới 7 ngày qua": 5 dòng đầu của `GET /platform/organizations?pageSize=5` (máy chủ xếp mới tạo trước), lọc `createdAt` trong 7 ngày; mỗi dòng tên · gói · ngày tạo.

### 5.4 Tổ chức (`#b-ds`, `#b-ct`)

ListDetail thường (380 | 1fr).

*Cột trái*
- Ô tìm "Tên, đường dẫn hoặc email chủ" → `q` (đợi 300 ms).
- Hàng Chip cuộn ngang (một chip được chọn): Tất cả · Sắp hết hạn (`expiringWithinDays=30`) · Hết hạn (`subscriptionStatus=EXPIRED`) · Chậm thanh toán (`PAST_DUE`) · Dùng thử (`TRIAL`) · Đang khoá (`status=SUSPENDED`). Số đếm trong chip lấy từ `GET /platform/stats` (không gọi thêm).
- Select sm "Mọi gói cước" + các gói → `planCode`.
- Mỗi dòng: tên tổ chức 600 (+ nhãn đỏ "Đang khoá" nếu `status = SUSPENDED`) · dòng phụ "{slug} · {owner.email}" · bên phải StatusTag thuê bao + "đến dd/mm/yyyy" / "hết dd/mm/yyyy" 12px. 20 dòng/lần, "Xem thêm 20 tổ chức".

*Nhãn trạng thái thuê bao* (`subscriptionStatus` = trạng thái hiệu lực):

| Giá trị | Chữ | Màu StatusTag |
|---|---|---|
| `NONE` | Chưa có thuê bao | xám nháp |
| `TRIAL` | Dùng thử | accent |
| `ACTIVE` | Đang dùng | ok |
| `PAST_DUE` | Chậm thanh toán | warn |
| `EXPIRED` | Hết hạn | danger |
| `CANCELLED` | Đã huỷ | xám nháp |

*Cột phải — 4 thẻ*
1. **Đầu**: tên 16/700 · "/{slug} · {loại tổ chức} · tạo dd/mm/yyyy" (loại: INDIVIDUAL "Thợ cá nhân", TEAM "Đội / studio", ACADEMY "Trung tâm đào tạo") · StatusTag. Bảng nhãn–giá trị: Chủ tài khoản (mọi `owners[]`: tên · email) · Thành viên ("{memberCount} người đang hoạt động") · Trạng thái tổ chức (Hoạt động / nhãn "Đang khoá"). Chân thẻ: **"Đổi gói / gia hạn"** (primary) · **"Tạm khoá"** (viền đỏ) hoặc **"Mở khoá"** khi đang khoá.
   - `configError` có giá trị → dải đỏ trên đầu thẻ, chữ nguyên văn máy chủ.
2. **Thuê bao hiện hành**: Gói (`effectivePlan.plan.name` · giá/tháng; nếu `effectivePlan.source = 'default'` (chưa có thuê bao, áp gói mặc định) thì ghi thêm "(mặc định)") · Thời hạn (`startsAt → endsAt`, không hạn ghi "không thời hạn") · Ghi dữ liệu ? ("Được" / "Còn ân hạn đến dd/mm" / "Chỉ xem"; từ `writable`, `inGrace`, `graceEndsAt`; tooltip nói ân hạn `graceDays` ngày) · Ghi chú (`note`). Không có thuê bao: dòng `--muted` "Chưa có thuê bao — đang áp gói mặc định".
3. **Mức dùng so với gói**: 3 hàng (nhãn 150px · thanh 8px · "x / y" bên phải): Thành viên (`usage.staff` / `maxStaff`), Lịch tháng này (`usage.appointmentsThisMonth` / `maxAppointmentsPerMonth`), Dung lượng (`usage.storageMb` MB / `maxStorageMb`, đổi sang GB khi ≥ 1024). Thanh màu `--accent`; ≥ 90% đổi `--danger`. Giới hạn `null` → "x / Không giới hạn", không vẽ thanh. **Học viên, Khoá học không vẽ** (máy chủ trả `null` = chưa đếm được).
4. **Lịch sử thuê bao**: bảng Gói (+ nhãn "Hiện hành" nếu `isCurrent`) · Trạng thái · Thời hạn · Ghi chú (ẩn ở máy tính bảng). Dòng hiện hành tô `--accent-soft`.

### 5.5 Hộp thoại

*Đổi gói / gia hạn* (`#gia-han`) — Dialog 600.
- Dòng phụ "{tên tổ chức} · đang dùng {gói} đến {endsAt}".
- Gói cước (Select: `GET /platform/plans`, chỉ gói `isActive`, trừ gói `trial` luôn chọn được; mặc định = gói hiện tại) · Trạng thái (Segmented sm Dùng thử · **Đang dùng** · Chậm thanh toán; mặc định Đang dùng) · Bắt đầu ? (ô ngày; mặc định = `endsAt` hiện tại nếu còn hạn, không thì hôm nay; tooltip "Không được trước ngày bắt đầu của thuê bao mới nhất") · Thời hạn (Segmented sm **1 tháng · 3 · 6 · 12 tháng** · Đến ngày… · Không hạn) · dòng "Hết hạn" tính sẵn (chỉ đọc) · Ghi chú (Textarea, ≤500).
- Dải xám "Thêm một dòng thuê bao mới; dòng cũ giữ làm lịch sử."
- Lưu → `POST /platform/organizations/:organizationId/subscriptions {planId, status, startsAt, months}` (hoặc `endsAt` khi chọn "Đến ngày…", `endsAt: null` khi "Không hạn"). **Không gửi cả `months` lẫn `endsAt`.**

*Tạm khoá* (`#khoa`) — ConfirmDialog 460: "Tạm khoá {tên}?" · câu "Mọi thành viên không vào được tổ chức; trang giới thiệu công khai tắt. Dữ liệu giữ nguyên, mở khoá lúc nào cũng được." · Lý do `*` → `PATCH /platform/organizations/:id {status: 'SUSPENDED', reason}`. "Mở khoá" → hộp xác nhận ngắn, `{status: 'ACTIVE'}` (lý do tuỳ chọn).

*Gói cước* (`#b-goi`, `#goi-sua`) — lưới thẻ `repeat(auto-fill, minmax(250px, 1fr))`. Mỗi thẻ: tên + mã 12px · nhãn "Đang bán"/"Ngừng bán" · giá/tháng 20/700 · 5 dòng hạn mức (null = "Không giới hạn") + "Tên miền riêng: có/không" · các nhãn `features[]` · chân "Sửa". Nút "+ Gói mới" ở tiêu đề.
- Hộp Sửa/Tạo (Dialog 640): Mã gói (chỉ khi tạo; chữ thường không dấu, số, gạch dưới, 2–32 ký tự; khi sửa chỉ hiện ở dòng phụ "không đổi được") · Tên gói · Giá mỗi tháng (MoneyInput) · **dải vàng khi sửa giá**: "Đổi giá áp cho mọi thuê bao đang dùng gói này" · nhóm Giới hạn (2 cột; trống = không giới hạn): Thành viên, Lịch mỗi tháng, Dung lượng (MB), Học viên, Khoá học, Tên miền riêng (Switch) · nhóm Bày bán: Tính năng ghi trên gói (Chip + "Thêm", ≤50) · Đang bán (Switch) · Thứ tự.
- Tạo → `POST /platform/plans` (đủ trường); sửa → `PATCH /platform/plans/:planId` (chỉ trường đã đổi).
- Số tổ chức đang dùng gói (để ghi "42 tổ chức" trong dải vàng): **chưa có trường** → bản dựng ghi câu không có số (đề xuất 5.8-2).

### 5.6 Ô ↔ trường

| Ô | Đọc | Ghi |
|---|---|---|
| 4 ô số trang chủ, số trong chip | `GET /platform/stats` → `organizations{total, byStatus{ACTIVE, SUSPENDED}, bySubscriptionStatus{NONE, TRIAL, ACTIVE, PAST_DUE, EXPIRED, CANCELLED}}, expiringIn30Days, projectedMonthlyRevenue, projectedMonthlyRevenueNote, generatedAt` | — |
| Danh sách tổ chức | `GET /platform/organizations?page&pageSize&status&subscriptionStatus&planCode&expiringWithinDays&q` → `items[{id, name, slug, kind, status, createdAt, owner{id, fullName, email}\|null, subscriptionStatus, subscription{id, plan{id, code, name, priceMonthly}, status, startsAt, endsAt, effectiveStatus, graceEndsAt, inGrace, writable}\|null, memberCount, storageUsedBytes}]`, `total` | — |
| Chi tiết | `GET /platform/organizations/:id` → các cột tổ chức + `owners[], memberCount, storageUsedBytes, subscriptionStatus, currentSubscription{id, status, startsAt, endsAt, note, effectiveStatus, graceEndsAt, inGrace, writable}\|null, effectivePlan{source, plan{…}}\|null, configError, graceDays, usage{staff, appointmentsThisMonth, storageMb, students:null, courses:null}, subscriptions[{id, plan{id,code,name}, status, startsAt, endsAt, note, createdById, createdAt, isCurrent}]` | `PATCH /platform/organizations/:id {status, reason?}`; `POST …/subscriptions {planId, status?, startsAt?, endsAt?\|months?, note?}` |
| Gói cước | `GET /platform/plans` → `items[{id, code, name, priceMonthly, maxStaff, maxAppointmentsPerMonth, maxStorageMb, maxStudents, maxCourses, customDomain, features, isActive, sortOrder}]` | `POST /platform/plans`, `PATCH /platform/plans/:planId` |

### 5.7 Trạng thái

| Tình huống | Hiển thị |
|---|---|
| Đang kiểm quyền (`GET /platform/stats` chưa về) | Skeleton 4 ô số, **không** vẽ thanh trái (tránh lộ khung quản trị rồi mới giấu) |
| 404 ở bước kiểm quyền | Màn "Không có trang này." chung của app |
| 404 tổ chức / gói | EmptyState "Không tìm thấy tổ chức" + "Về danh sách" |
| 400 | Lỗi dưới ô (ví dụ "Ngày hết hạn phải sau ngày bắt đầu", "Mã gói: chữ thường không dấu…", "Nhập lý do tạm khoá") |
| 409 | Dải đỏ trong hộp, chữ máy chủ: "Ngày bắt đầu không được trước ngày bắt đầu của thuê bao mới nhất", "Gói này đã ngừng bán", "Mã gói đã có" |
| `configError` | Dải đỏ ở thẻ đầu chi tiết |

Quyền: chỉ có một mức — **là quản trị nền tảng hay không** (do máy chủ quyết qua 404). Không dùng danh mục quyền của tổ chức.

### 5.8 Đề xuất trường / đường mới (KHÔNG vẽ)

1. `GET /auth/me` trả cờ `isPlatformAdmin` — để không phải gọi thử (vẫn giữ 404 cho người thường).
2. Số tổ chức đang dùng mỗi gói (`plans[].subscriberCount`) — cho dải cảnh báo đổi giá.
3. Lý do tạm khoá đọc lại được trong chi tiết (hiện chỉ nằm ở nhật ký thay đổi): `suspendedReason`, `suspendedAt`.
4. Nhật ký thao tác của quản trị theo tổ chức (`GET /platform/organizations/:id/audit`).
5. Tiền thuê bao **đã thu thật** (sổ thu của nền tảng) — hiện chỉ có số dự kiến.
6. Danh sách chờ, yêu cầu khôi phục mật khẩu (Studio Pro có tab "Waiting List", "Yêu cầu mật khẩu") — khôi phục mật khẩu nên để người dùng tự làm qua email, không qua quản trị.
7. Đếm học viên, khoá học (`usage.students/courses`) khi có module đào tạo.

### 5.9 Gói việc theo tệp

| Gói | Tệp sở hữu | Nội dung | Phụ thuộc |
|---|---|---|---|
| **W13 Quản trị nền tảng** | `src/features/platform/**`: `PlatformGate.tsx` (gọi stats, 404 → NotFound), `PlatformShell.tsx`, `PlatformNav.ts`, `HomePage.tsx`, `StatTiles.tsx`, `ExpiringCard.tsx`, `GraceCard.tsx`, `OrganizationsPage.tsx`, `OrgList.tsx`, `OrgDetail.tsx`, `UsageBars.tsx`, `SubscriptionHistory.tsx`, `SubscriptionDialog.tsx`, `SuspendDialog.tsx`, `PlansPage.tsx`, `PlanDialog.tsx`, `labels.ts`; **`src/api/platform.ts` (mới)** | Mục 5 | Lõi `src/api/client.ts`. **Không** dùng `AppShell`/`nav.ts` của tổ chức. |
| Yêu cầu W3 | `routes.tsx`: nhánh `/quan-tri/*` trong `RequireAuth`, **ngoài** `:orgSlug`, phần tử `PlatformGate` | | |

### 5.10 Hàm API web cần thêm

```ts
// src/api/platform.ts (mới, W13) — đường KHÔNG có tiền tố /orgs/:orgId
export type EffectiveStatus = 'NONE' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELLED';
export type SubscriptionStatus = Exclude<EffectiveStatus, 'NONE'>;
export interface PlanView { id: string; code: string; name: string; priceMonthly: Vnd; maxStaff: number|null; maxAppointmentsPerMonth: number|null; maxStorageMb: number|null; maxStudents: number|null; maxCourses: number|null; customDomain: boolean; features: string[]; isActive: boolean; sortOrder: number; createdAt: IsoDateTime; updatedAt: IsoDateTime }
export interface PlatformStats { organizations: { total: number; byStatus: Record<'ACTIVE'|'SUSPENDED', number>; bySubscriptionStatus: Record<EffectiveStatus, number> }; expiringIn30Days: number; projectedMonthlyRevenue: Vnd; projectedMonthlyRevenueNote: string; generatedAt: IsoDateTime }
export interface OrgListItem { id: string; name: string; slug: string; kind: OrgKind; status: 'ACTIVE'|'SUSPENDED'; createdAt: IsoDateTime; owner: { id: string; fullName: string; email: string } | null; subscriptionStatus: EffectiveStatus; subscription: { id: string; plan: { id: string; code: string; name: string; priceMonthly: Vnd }; status: SubscriptionStatus; startsAt: IsoDateTime; endsAt: IsoDateTime|null; effectiveStatus: EffectiveStatus; graceEndsAt: IsoDateTime|null; inGrace: boolean; writable: boolean } | null; memberCount: number; storageUsedBytes: number }
export interface OrgListQuery { page?: number; pageSize?: number; status?: 'ACTIVE'|'SUSPENDED'; subscriptionStatus?: EffectiveStatus; planCode?: string; expiringWithinDays?: number; q?: string }
export interface OrgDetail { id: string; name: string; slug: string; kind: OrgKind; status: 'ACTIVE'|'SUSPENDED'; timezone: string; currency: string; createdAt: IsoDateTime; updatedAt: IsoDateTime; owners: { id: string; fullName: string; email: string }[]; memberCount: number; storageUsedBytes: number; subscriptionStatus: EffectiveStatus; currentSubscription: { id: string; status: SubscriptionStatus; startsAt: IsoDateTime; endsAt: IsoDateTime|null; note: string|null; effectiveStatus: EffectiveStatus; graceEndsAt: IsoDateTime|null; inGrace: boolean; writable: boolean } | null; effectivePlan: { source: 'subscription' | 'default'; plan: PlanView } | null; configError: string|null; graceDays: number; usage: { staff: number; appointmentsThisMonth: number; storageMb: number; students: null; courses: null }; subscriptions: { id: string; plan: { id: string; code: string; name: string }; status: SubscriptionStatus; startsAt: IsoDateTime; endsAt: IsoDateTime|null; note: string|null; createdById: string|null; createdAt: IsoDateTime; isCurrent: boolean }[] }
export interface SubscriptionInput { planId: string; status?: SubscriptionStatus; startsAt?: IsoDateTime; note?: string; months?: number; endsAt?: IsoDateTime | null }   // chỉ một trong months / endsAt
export type PlanInput = Omit<PlanView, 'id'|'createdAt'|'updatedAt'>;
export function getPlatformStats(signal?: AbortSignal): Promise<PlatformStats>;                                         // GET  /platform/stats (cũng là bước kiểm quyền)
export function listPlatformOrganizations(query?: OrgListQuery, signal?: AbortSignal): Promise<Page<OrgListItem>>;       // GET  /platform/organizations
export function getPlatformOrganization(organizationId: string, signal?: AbortSignal): Promise<OrgDetail>;               // GET  /platform/organizations/:id
export function addSubscription(organizationId: string, input: SubscriptionInput): Promise<unknown>;                    // POST /platform/organizations/:id/subscriptions → tải lại chi tiết
export function setOrganizationStatus(organizationId: string, input: { status: 'ACTIVE'|'SUSPENDED'; reason?: string }): Promise<unknown>; // PATCH
export function listPlans(signal?: AbortSignal): Promise<Items<PlanView>>;                                             // GET  /platform/plans
export function createPlan(input: PlanInput): Promise<PlanView>;                                                         // POST /platform/plans
export function updatePlan(planId: string, input: Partial<Omit<PlanInput, 'code'>>): Promise<PlanView>;                   // PATCH /platform/plans/:planId
```
(`OrgDetail` trả nguyên các cột bảng `organizations` — thợ W13 đối chiếu schema.prisma `model Organization`. `effectivePlan.source` là `'subscription' \| 'default'` — đã đối chiếu /home/user/a/apps/api/src/lib/quota.ts dòng 98.)

---

## 6. Thứ tự giao việc và tệp dùng chung (tổng hợp 5 màn)

**Gói mới, chạy song song được ngay (mỗi gói chỉ ghi vào thư mục của mình + tệp API mới của mình):**

| Gói | Thư mục | Tệp API mới | Có thể bắt đầu |
|---|---|---|---|
| W8 Nhân sự | `src/features/staff/**` | `src/api/files.ts` | ngay |
| W9 Khách hàng | `src/features/customers/**` | — | ngay |
| W10 Thu tiền | `src/features/payments/**` | `src/api/payments.ts` | ngay |
| W10b Báo cáo | `src/features/reports/**` | `src/api/reports.ts` | ngay (import kiểu từ payments.ts khi có) |
| W11 Thương hiệu | `src/features/brand/**` | `src/api/profile.ts` | ngay; phần ảnh chờ `files.ts` (W8), xem trước chờ `SiteView` (W12) |
| W12 Trang công khai | `src/features/public-site/**` | `src/api/publicSite.ts` | ngay |
| W13 Quản trị nền tảng | `src/features/platform/**` | `src/api/platform.ts` | ngay |

**Yêu cầu sửa tệp của người khác (chủ tệp làm, gom một lượt cho đỡ đụng):**

| Chủ tệp | Tệp | Thêm gì | Cho gói |
|---|---|---|---|
| W3 | `src/layout/nav.ts` | menu con Thợ makeup (2), Hợp đồng (3, có Thu tiền), mục mới Báo cáo (Doanh thu, Sổ thu) với quyền theo mục con, Cài đặt › Hồ sơ thương hiệu | W8, W10, W10b, W11 |
| W3 | `src/app/routes.tsx` | các đường ở 1.1, 2.1, 3.1, 4.1, 5.2; `/trang/:slug` và `/quan-tri/*` đặt **trước** `:orgSlug` | tất cả |
| W2 | `src/ui/*` | ListGroupHeader, ListRow, StatTile, PersonChip, ImageUpload, ConfirmDialog (mục 0.2) | tất cả |
| W1 | `src/api/org.ts` | `listRoles`, `addMember` | W8 |
| W5 | `src/features/contracts/**` | đọc `?customerId=`; liên kết "Thu tiền" ở hợp đồng đã xác nhận | W9, W10 |
| W6 | `src/features/schedule/**` | đọc `?ngay=&ca=` | W9 |
| Đội máy chủ | `apps/api/src/modules/orgs/routes.ts` | thêm `'trang'` vào `RESERVED_SLUGS` | W12 |

**W7 Kiểm thử giao diện** thêm vào `apps/web/e2e/**`: chụp 3 khổ (1440, 1024, 390) cho mọi màn ở mục 1–5, đặt cạnh ảnh `docs/rnd/anh/v4-*` tương ứng; kiểm `scrollWidth === innerWidth`; với Thu tiền kiểm 4 ô số khớp `summary` máy chủ; với Quản trị kiểm người thường mở `/quan-tri` thấy đúng màn "Không có trang này.".
