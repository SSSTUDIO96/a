# Bản vẽ thông số — Phương án C (Chặng 2)

- Người dùng bản vẽ: thợ dựng web React.
- Người duyệt: anh Chiến.
- Ngày: 18/10/2026.

**Nguồn sự thật (khi có chỗ mâu thuẫn, thứ tự ưu tiên từ trên xuống)**
1. /home/user/a/apps/api/prisma/schema.prisma
2. /home/user/a/apps/api/src/modules/*/ (đường API, kiểu dữ liệu gửi và nhận)
3. /home/user/a/packages/shared/src/ (công thức tiền, phí di chuyển, bảng chuyển trạng thái, nhãn tiếng Việt)
4. Bản mẫu:
   - /home/user/a/docs/rnd/v2-phuong-an-C.html (Bảng giá, Hợp đồng, khung)
   - /home/user/a/docs/rnd/phuong-an-C.html, /home/user/a/docs/rnd/phuong-an-A.html, /home/user/a/docs/rnd/phuong-an-B.html (3 chế độ lịch, vòng 1)
   - /home/user/a/docs/rnd/v2-lich-C-mobile.html (lịch C trên điện thoại)

**Luật chung, áp dụng cho mọi màn**
- Một dòng cài đặt = **nhãn + điều khiển**. Giải thích nằm trong tooltip "?".
- Mọi chữ trên màn là tiếng Việt có dấu.
- Không gradient trang trí. Không đổ bóng cho thẻ.
- Không bày ô nào không có trường dữ liệu tương ứng.
- Không đặt ô tick trong danh sách chỉ để xem. Cái gì bày ra thì phải bấm được.
- **Tiền:**
  - Là số nguyên đồng, kiểu `Vnd = number` (packages/shared/src/money.ts).
  - Hiện theo dạng `1.500.000 ₫`, dùng `formatVnd`.
  - Giao diện **không tự tính tổng hợp đồng**: luôn lấy từ máy chủ (`/contracts/quote`).

---

## 1. Design tokens (giá trị lấy đúng từ v2-phuong-an-C.html)

### 1.1 Màu — đặt tên biến CSS y như dưới

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bg` | `#F6F4F2` | Nền trang |
| `--surface` | `#FFFFFF` | Thẻ, thanh bên, thanh trên, thanh dưới |
| `--line` | `#E9E3DE` | Viền thẻ, viền ô nhập, đường chia lớn |
| `--line-2` | `#F2EDE9` | Đường chia giữa các dòng trong thẻ |
| `--soft` | `#FBFAF9` | Nền ô bị khoá, chân thẻ, tiêu đề cột |
| `--text` | `#221C19` | Chữ chính |
| `--muted` | `#716862` | Chữ phụ, nhãn |
| `--faint` | `#A39A94` | Chữ mờ (nơi làm trong danh sách, giá gạch) |
| `--accent` | `#A63D62` | Màu thương hiệu: nút chính, mục đang chọn |
| `--accent-soft` | `#F7E8EE` | Nền mục đang chọn, nền ô tick đang bật |
| `--accent-line` | `#E7B8C9` | Viền nút nét đứt, viền ô tick đang bật |
| `--ok` / `--ok-bg` | `#2F7D72` / `#E6F3F0` | Trạng thái "Đã xác nhận", dải khoá dòng |
| `--warn` / `--warn-bg` / `--warn-line` | `#8A5A00` / `#FFF6E0` / `#EED6A0` | Nhãn "Phát sinh", ca chưa có thợ |
| `--danger` / `--danger-bg` / `--danger-line` | `#B42318` / `#FEF0EE` / `#F3B8B0` | Trùng lịch, đã huỷ, lỗi, dấu `*` bắt buộc |
| Màu loại ca: Cô dâu | chữ/viền `#A63D62`, nền `#FBEDF2` | Ô ca trên lịch |
| Màu loại ca: Ăn hỏi | chữ/viền `#9A5B0F`, nền `#FDF2E2` | Ô ca trên lịch |
| Màu loại ca: Tiệc & sự kiện | chữ/viền `#5B45A0`, nền `#F0ECFA` | Ô ca trên lịch |
| Nền tooltip | `#2A2220`, chữ `#FFFFFF` | Tooltip "?" |
| Lớp phủ hộp thoại | `rgba(34,28,25,.42)` | Hộp thoại |
| Lớp phủ ngăn kéo đáy | `rgba(34,28,25,.45)` | Ngăn kéo trên điện thoại |
| Sọc "không làm được" | `repeating-linear-gradient(135deg,#F4F1EE 0 6px,#FAF8F6 6px 12px)` | Ô nghỉ trên lịch, nút địa điểm bị khoá. Đây là hoạ tiết sọc, không phải gradient trang trí. |

Màu cho ảnh đại diện chữ viết tắt (khi `avatarUrl` trống):
- Chọn theo `membershipId` (băm chuỗi, lấy dư 6) trong dãy `#A63D62 #5B45A0 #2F7D72 #9A5B0F #7A6A62 #3D6A9A`.
- Chữ trắng.

**Chế độ tối:** bản mẫu chưa có. Đề xuất để sau lát 1, không làm ở Chặng 2.

### 1.2 Chữ

- **Phông:** `"Be Vietnam Pro", Inter, "Segoe UI", Roboto, Arial, sans-serif`. Tự chứa phông Be Vietnam Pro trong `apps/web/public/fonts`, không gọi Google Fonts lúc chạy.
- **Số tiền, giờ, km:** `font-variant-numeric: tabular-nums; white-space: nowrap`.

| Vai | Cỡ / độ đậm / dòng | Ghi chú |
|---|---|---|
| Thân | 14px / 400 / 1.45 | |
| Tiêu đề trang `h1` | 24px / 700 | Máy tính bảng 21px. Điện thoại: ẩn, dùng tiêu đề thanh trên 16px / 700 |
| Tiêu đề thẻ `h2` | 16px / 700 | Thẻ nhân vật 15px |
| Tiêu đề nhóm trong chi tiết gói | 13px / 700, gạch chân 1px `--line` | |
| Tiêu đề nhóm trong danh sách (tên nhân vật, "GÓI", "PHỤ PHÍ CÀI SẴN") | 11.5–12px / 700, viết hoa, giãn chữ .05em | màu `--accent` hoặc `--muted` |
| Nhãn dòng cài đặt | 14px / 500 | |
| Chữ phụ (`fx`) | 12px / 400, `--muted` | |
| Nhãn nhỏ (`tag`) | 11.5px / 600 | |
| Tổng tiền ở thanh đáy | 18px / 700 | Điện thoại 16px |
| Tổng trong thẻ tổng | 18px / 700 | |

### 1.3 Khoảng cách, bo góc, đổ bóng

- **Thang khoảng cách (px):** 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 24 · 28.
  - Lề trang: máy tính 24 trên / 28 hai bên; máy tính bảng 20; điện thoại 12.
  - Khe giữa các thẻ: 12–16. Khe giữa hai cột: 20 (máy tính bảng 14).
  - Đệm trong thẻ: 16–18 ngang, 10–14 dọc.
  - Dòng cài đặt: 10px trên dưới, chia bằng đường `--line-2`.
- **Bo góc:**
  - Thẻ: 12px. Hộp thoại: 14px. Ngăn kéo đáy: 16px (chỉ hai góc trên).
  - Nút và ô nhập: 8px. Nhóm nút chuyển: 10px ngoài, 7px trong.
  - Chip và nhãn: 999px. Ô ca trên lịch: 4–6px. Tooltip: 6px.
- **Đổ bóng:** không có.
  - Mục đang chọn dùng viền trong: `box-shadow: inset 3px 0 0 var(--accent)` (dòng danh sách), hoặc `0 0 0 1px var(--line)` (nút chuyển đang bật).
  - Ô có ca trùng: `outline: 2px solid var(--danger); outline-offset: -2px`.

### 1.4 Điểm gãy

| Tên | Bề rộng | Khung |
|---|---|---|
| Máy tính | ≥ 1181px | Thanh trái 240px, có chữ và menu con |
| Máy tính bảng | 641–1180px | Thanh trái 68px, chỉ biểu tượng, ẩn menu con |
| Điện thoại | ≤ 640px | Ẩn thanh trái; thanh trên 54px; thanh dưới 64px cố định |

Đã kiểm ở 1440×900, 1024×768, 390×844. Không màn nào được tràn ngang ở 390px; bài thử tự động phải kiểm `scrollWidth === innerWidth`.

---

## 2. Khung điều hướng

### 2.1 Thanh trái (máy tính, máy tính bảng)

- Nền `--surface`, viền phải 1px `--line`.
- **Cột thanh trái kéo hết chiều cao trang. Phần ruột dính đầu** (`position: sticky; top: 0; max-height: 100vh`).
- Từ trên xuống:
  1. Logo + "Makeup Pro": 17px / 700, màu `--accent`, đệm 18×20, gạch dưới.
  2. Người dùng: ảnh đại diện 32px, tên, vai trò 12px. Lấy từ `GET /auth/me`.
  3. Menu (đệm 12, khe 2):
     - Tổng quan
     - **Lịch makeup** (menu con: Xem lịch · Ngày nghỉ của thợ)
     - **Hợp đồng** (Lập hợp đồng · Danh sách hợp đồng)
     - **Bảng giá** (Gói theo nhân vật · Dịch vụ phụ & phụ phí · Phí di chuyển & studio · Nhân vật)
     - Khách hàng
     - Thợ makeup
     - Báo cáo
- **Mục menu:**
  - Cao 40px (đệm 10×12), bo 8, biểu tượng 18px, chữ 14px / 500 màu `--muted`.
  - Đang chọn: nền `--accent`, chữ trắng.
  - Menu con chỉ hiện dưới mục đang chọn: thụt 22px, viền trái 1px, chữ 13.5px. Mục con đang chọn: nền `--accent-soft`, chữ `--accent` / 600.
- **Máy tính bảng:** chỉ biểu tượng, căn giữa, bề rộng 68px. Tên mục hiện ở tooltip.
- **Ẩn mục theo quyền** (bảng quyền ở mục 6): không có `contracts.read` thì ẩn Hợp đồng; không có `catalog.read` thì ẩn Bảng giá.

### 2.2 Thanh trên (điện thoại)

- Cao 54px, dính đầu, nền trắng, gạch dưới.
- Gồm: [nút ‹ quay lại, khi ở màn con] · tiêu đề 16px / 700 (một dòng, cắt "…") · [một nút hành động bên phải, ví dụ "+ Gói", hoặc nhãn trạng thái "Nháp"].

### 2.3 Thanh dưới (điện thoại)

- Cố định đáy, cao 64px, 5 ô đều nhau: **Lịch · Hợp đồng · Bảng giá · Khách · Thêm**.
- Mỗi ô: biểu tượng 18px trên, chữ 11px dưới.
- Đang chọn: màu `--accent` / 600.
- "Thêm" mở danh sách: Tổng quan, Thợ makeup, Báo cáo, Cài đặt, Đăng xuất.
- Trang có thanh tổng tiền: thanh tổng nằm **trên** thanh dưới (`bottom: 64px`), thân trang chừa đệm dưới 84px.

---

## 3. Component dùng chung

Thư mục `apps/web/src/ui/`. Mọi component nhận `disabled`; component nhập liệu nhận thêm `error?: string`.

**Ghi chú về trạng thái**
- Bản mẫu chỉ vẽ trạng thái mặc định và khoá.
- Các trạng thái hover / focus / lỗi / đang tải dưới đây là **bản vẽ bổ sung**: giữ đúng token, không thêm màu mới.
- Quy ước tiêu điểm bàn phím chung: `outline: 2px solid var(--accent); outline-offset: 2px`, chỉ khi `:focus-visible`.

| Component | Kích thước | Mặc định | Hover | Focus | Khoá | Lỗi | Đang tải |
|---|---|---|---|---|---|---|---|
| **Button** (`variant: default \| primary \| ghost \| dashed`, `size: md \| sm`, `icon?`) | md cao 36, đệm 0 14; sm cao 30, đệm 0 10, chữ 13; icon-only rộng 34 | default: nền trắng, viền `--line`. primary: nền và viền `--accent`, chữ trắng. ghost: không nền, không viền, chữ `--accent`. dashed: viền nét đứt `--accent-line`, nền `#FFFCFD`, chữ `--accent` | default: viền `#D8CFC9`. primary: nền `#8F3354`. ghost: nền `--accent-soft` | vòng tiêu điểm chung | `opacity .5; cursor not-allowed` | — | vòng xoay 16px thay biểu tượng, giữ chữ, tự khoá |
| **TextInput** | cao 36 (sm 30), bo 8, đệm 0 10 | viền `--line`, nền trắng | viền `#D8CFC9` | viền `--accent`, vòng `0 0 0 3px var(--accent-soft)` | nền `--soft`, chữ `--muted` | viền `--danger`; dòng lỗi 12px `--danger` ngay dưới | — |
| **Textarea** | cao tối thiểu 2 dòng, đệm 8 10 | như TextInput | | | | | |
| **MoneyInput** (`value: Vnd \| null`) | như TextInput, căn phải | hiện `1.500.000 ₫`; chỉ nhận chữ số, tự chèn dấu chấm; `null` hiện chữ gợi ý (ví dụ "Chưa đặt", "Không giảm") | | khi gõ bỏ " ₫" | | âm, lẻ, vượt `Number.MAX_SAFE_INTEGER` → lỗi | |
| **UnitInput** (km, phút, lần) | như TextInput; hậu tố 13px `--faint` ở mép phải, đệm phải 46 | km: dấu phẩy thập phân, tối đa 2 chữ số lẻ, tối đa 99.999,99 (`MAX_DISTANCE_KM`) | | | | | |
| **Select** | cao 36 (sm 30) | chữ ngắn; thông tin phụ (địa chỉ) ghi dòng 12px bên dưới, không nhét vào ô chọn | | | | | |
| **Checkbox** | ô 16px, `accent-color: var(--accent)`, nhãn 14 / 500, khe 8 | | | | nhãn `--muted` | | |
| **CheckChip** (ô tick dạng viên, dùng cho dịch vụ phụ) | cao 28, đệm 4 10 4 8, bo 999 | viền `--line` | | | nền trắng, chữ `--muted` | | |
| ↳ CheckChip đang bật | | nền `--accent-soft`, viền `--accent-line`; kèm giá `+250.000 ₫` màu `--muted` | | | | | |
| ↳ CheckChip đã huỷ | | gạch ngang, chữ `--faint`, kèm nhãn đỏ "Đã huỷ: lý do" | | | | | |
| **Switch** | 38×22, núm 16 | tắt `#D9D2CD`, bật `--accent` | | | | | |
| **Segmented** (nhóm nút chuyển) | ô cao 34 (sm 28), viền ngoài `--line`, bo 8, ô cách nhau bằng viền 1px | đang chọn: nền `--accent-soft`, chữ `--accent` / 600 | | | ô không cho chọn: chữ `#CFC7C1` trên nền sọc, tooltip nói lý do | | |
| **Qty** (− số +) | cao 28–32, nút 28–32 nền `--soft` | | | | | dưới 1 hoặc trên 1000 → khoá nút | |
| **Card** | nền trắng, viền `--line`, bo 12 | tiêu đề: đệm 14 18, gạch dưới | | | | | |
| **Dialog** (máy tính, máy tính bảng) | rộng `min(980px, 100%)`, cao tối đa `100vh − 48px`, bo 14 | đầu (đệm 16 22) · thân cuộn riêng · chân dính đáy với "Huỷ" và nút chính | | Esc đóng, nhốt tiêu điểm | | | |
| **BottomSheet** (điện thoại) | cao tối đa 78%, bo trên 16, vạch kéo 40×4 | | | | | | |
| **Tooltip "?"** | vòng 16px viền `--faint`, chữ "?" 10.5px / 700 | khung 240px, đệm 8 10, chữ 12px / 1.45, hiện **phía dưới**, lệch trái −10px, tự xuống dòng | hiện khi rê chuột | hiện khi tiêu điểm | | | |
| **Avatar** | 32px (sm 28, nhỏ 22), tròn, chữ 12 / 700 trắng | có `avatarUrl` thì hiện ảnh, không có thì hiện `initials` | | | | | |
| **AvatarStack** | viền trắng 2px, chồng −8px, tối đa 3 rồi "+n" | | | | | | |
| **StatusTag** | đệm 2 8, bo 999, chữ 11.5 / 600 | xem bảng màu ngay dưới | | | | | |
| **Chip** (bộ lọc) | đệm 5 12, bo 999 | đang chọn: viền `--accent`, nền `--accent-soft` | | | | | |
| **StickyTotalBar** | đệm 12 18, bo 12; điện thoại: tràn mép, không bo, `bottom: 64px` | "Tổng" 18 / 700, "Cọc" 15 / 700, nút bên phải | | | | | khi đang chờ `quote`: số mờ `opacity .5`, không nhảy chỗ |
| **EmptyState** | — | một dòng chữ `--muted` + một nút; không dùng ảnh minh hoạ | | | | | |
| **Skeleton** | khối `--line-2`, bo 6 | thay nội dung lúc tải lần đầu, giữ đúng chiều cao dòng | | | | | |

**Màu của StatusTag** (nhãn tiếng Việt lấy từ `CONTRACT_STATUS_LABELS` và `WORK_STATUS_LABELS` trong packages/shared):

| Nhóm | Trạng thái | Nền / chữ |
|---|---|---|
| Hợp đồng | Nháp | `#EFEBE8` / `--muted` |
| Hợp đồng | Đã xác nhận | `--ok-bg` / `--ok` |
| Hợp đồng | Hoàn thành | `--ok-bg` / `--ok` |
| Hợp đồng | Đã huỷ | `--danger-bg` / `--danger` |
| Lịch | Chờ xác nhận | `--warn-bg` / `--warn` |
| Lịch | Đang làm | `--accent-soft` / `--accent` |
| Lịch | Khách không đến | `--danger-bg` / `--danger` |
| Nhãn khác | Phát sinh | `--warn-bg` / `--warn` |
| Nhãn khác | Phụ phí, Tự đặt tên | `--line-2` / `--muted` |
| Nhãn khác | Tên nhân vật | `--accent-soft` / `--accent` |

---

## 4. Từng màn

Ký hiệu dùng trong các bảng: **Đ** = đọc, **G** = ghi.

Mọi đường API có tiền tố `/orgs/:orgId`; `orgId` lấy từ tổ chức đang chọn trong `GET /auth/me`.

### 4.1 Lịch makeup — 3 chế độ, mặc định C

**Dữ liệu chung của màn**

| Việc | Đường API | Trường |
|---|---|---|
| Lấy ca (khoảng xem tối đa 62 ngày) | Đ `GET /appointments?from&to[&membershipId&status]` | `id, code, kind, title, status, customer{…}, contract{…}, contractLineId, startsAt, endsAt, travelBeforeMin, travelAfterMin, locationType, address, notes, staff[{membershipId, fullName, role PRIMARY\|ASSIST, blockStart, blockEnd, isBlocking}]` |
| Lấy thợ (hàng hoặc cột) | Đ `GET /staff` | ảnh và chữ viết tắt lấy từ `displayName, avatarUrl, tierId` (ghép theo `membershipId`) |

**Thanh công cụ** — từ trái sang:
- Nhóm tuần "‹ 19 – 25/10/2026 › Hôm nay" (nền `--soft`, bo 10).
- Nút chính "+ Thêm lịch".
- Nhãn đỏ "n ca trùng lịch" — chỉ khi có xung đột đang mở (xem cảnh báo trùng bên dưới).
- Khoảng trống.
- Nhóm nút chuyển chế độ: **Thợ × ngày (C)** · Ngày (B) · Cột thợ (A).
- Nút "Bộ lọc" (lọc `membershipId`, `status`).
- Chế độ đang chọn lưu ở `localStorage` theo người dùng; thiếu thì dùng C.

**C — lưới tuần thợ × ngày (mặc định)**
- Bản mẫu máy tính: /home/user/a/docs/rnd/phuong-an-C.html. Ảnh: /home/user/a/docs/rnd/anh/phuong-an-C-lich-desktop.png
- **Lưới:**
  - Máy tính: cột tên thợ 168px + 7 cột `minmax(118px, 1fr)`.
  - Máy tính bảng: cột tên thợ 132px + 7 cột `minmax(0, 1fr)`; ô ca ẩn chữ loại, chỉ còn giờ và tên khách.
- **Đầu cột ngày:** thứ (11.5px viết hoa) · ngày/tháng · "n ca". Thứ Bảy và Chủ nhật màu `--accent`.
- **Hàng:** mỗi thợ một hàng (avatar 32, tên, "Bậc · n ca/tuần"), cuối cùng là hàng "Chưa có thợ" (avatar viền nét đứt).
- **Ô:**
  - Liệt kê ca của thợ đó trong ngày: giờ bắt đầu đậm, loại, tên khách một dòng, cắt "…". Tên đầy đủ hiện ở tooltip.
  - Ô ngày nghỉ: sọc, chữ "Nghỉ phép".
  - Bấm vào ca → hộp thoại chi tiết ca.
- **Điện thoại 390px** — theo /home/user/a/docs/rnd/v2-lich-C-mobile.html, ảnh /home/user/a/docs/rnd/anh/v2-lich-C-mobile.png:
  - **Xoay trục:** hàng = 7 ngày (cột ngày rộng 50px), cột = thợ (chia đều, tối đa 5 cột kể cả "Chưa có").
  - Ô ghi tối đa 3 giờ bắt đầu, thừa thì "+n".
  - Ngày đang chọn tô nền; dưới lưới là danh sách ca của ngày đó (4 ca + "Xem cả ngày").
  - Có trên 5 thợ: chỉ phần cột thợ cuộn ngang, `scroll-snap-type: x mandatory`, dừng đúng mép cột.

**B — danh sách theo ngày**
- Bản mẫu: /home/user/a/docs/rnd/phuong-an-B.html
- Gồm: dải 7 ngày (số ca mỗi ngày) · chip lọc thợ · khối "Cần xử lý" (ca chưa có thợ = `staff` rỗng) · danh sách chia "Sáng sớm / Buổi sáng / Buổi chiều".
- Mỗi ca: giờ bắt đầu và kết thúc, loại ca, tên khách (xuống dòng, không cắt), địa chỉ, thợ.
- Máy tính có thêm ô "Thợ trong ngày": thanh thời gian 4h–18h, vẽ từ `blockStart`–`blockEnd`.

**A — cột theo thợ**
- Bản mẫu: /home/user/a/docs/rnd/phuong-an-A.html
- Trục giờ dọc 04:00–18:00: 64px/giờ (điện thoại 60px/giờ), cột giờ rộng 56px (điện thoại 44px).
- Cột thợ `minmax(160px, 1fr)`; cột "Chưa có thợ" `minmax(150px, .8fr)`.
- Ô ca đặt tuyệt đối theo `startsAt/endsAt`. Phần `travelBeforeMin/AfterMin` vẽ sọc mảnh ở trên và dưới ô.

**Cảnh báo trùng lịch — luật đúng theo máy chủ**
- Máy chủ **không cho lưu** hai ca chồng nhau của cùng một thợ (`assertNoOverlap` cộng ràng buộc EXCLUDE). Khi tạo hoặc dời ca bị trùng, máy chủ trả **409 `CONFLICT`** kèm `details.conflicts[{appointmentId, code, startsAt, endsAt, blockStart, blockEnd, membershipId, staffName}]`.
- Giao diện xử lý như sau:
  1. Giữ nguyên hộp thoại đang nhập.
  2. Hiện dải đỏ "Trùng lịch: Thu Hà đã có lịch L-0123 06:00–07:30".
  3. Trên lưới, tô viền đỏ ô của ca bị trùng (theo `appointmentId`).
  4. Đưa ra nút "Đổi thợ" và "Đổi giờ".
- Nhãn "n ca trùng lịch" trên thanh công cụ chỉ hiện khi đang có dải đỏ này.
- Ca không chặn lịch (`isBlocking = false`, ví dụ đã huỷ) vẫn có thể nằm chồng giờ; vẽ mờ `opacity .5`, không báo đỏ.

**Tạo / sửa ca**

| Việc | Đường API |
|---|---|
| Tạo ca | G `POST /appointments`, bắt buộc header `Idempotency-Key` (8–128 ký tự, tạo mới mỗi lần mở hộp thoại) |
| Sửa ca | G `PATCH /appointments/:id` |
| Đổi trạng thái | G `POST /appointments/:id/status {to, reason}`; huỷ bắt buộc `reason` |

- Trường gửi khi tạo: `startsAt, endsAt, travelBeforeMin, travelAfterMin, locationType, address, notes, title, staff[{membershipId, role}], customerId | newCustomer{fullName, phone}, contractId, contractLineId`.
- Nút chuyển trạng thái chỉ hiện các bước cho phép trong `STATUS_TRANSITIONS`.

### 4.2 Bảng giá

Bản mẫu: /home/user/a/docs/rnd/v2-phuong-an-C.html, các màn `#bang-gia`, `#bang-gia-mo`, `#bang-gia-goi`, `#bang-gia-phu`, `#bang-gia-dc`, `#bang-gia-nv`.

Ảnh:
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-chi-tiet-goi-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-chi-tiet-goi-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-phi-di-chuyen-desktop.png

**Chia nhóm**
- Máy tính và máy tính bảng: 4 mục con của "Bảng giá" ở thanh trái.
- Điện thoại: nhóm nút chuyển 4 ô ở đầu trang: Gói · Dịch vụ phụ · Di chuyển · Nhân vật.

**(a) Gói theo nhân vật — lưới thẻ**
- Lưới `repeat(auto-fill, minmax(320px, 1fr))`, khe 16. Điện thoại: 1 cột, khe 12.
- **Mỗi thẻ là một nhân vật:**
  - Đầu thẻ: tên nhân vật 15 / 700 · "n gói" · nút "+" (tạo gói với `subjectId` sẵn).
  - Thân thẻ: các dòng gói.
- **Một dòng gói chỉ có:** tên gói 14 / 600 · nơi làm (chữ ngắn 12.5px `--faint`) · giá bán 14 / 700 căn phải, tối thiểu 92px.
  - Nơi làm: đủ 3 loại thì ghi "Mọi nơi", không thì "Studio · Tại nhà".
  - Điện thoại: nơi làm xuống dòng dưới tên.
  - **Không ô tick, không cột thừa.**
- Thẻ "Mọi nhân vật" chứa gói có `subjectId = null`.
- Cuối lưới: ô nét đứt "+ Thêm nhân vật".

| Ô | Đường API | Trường |
|---|---|---|
| Danh sách gói | Đ `GET /packages?isActive=true` | `id, name, subjectId, locationTypes[], currentPrice{unitPrice, listPrice, salePrice}` |
| Tên nhân vật | Đ `GET /makeup-subjects` | `id, name, sortOrder, isActive` |

**Hộp thoại chi tiết gói**
- Máy tính: hộp thoại 2 cột. Máy tính bảng: hộp thoại 1 cột. Điện thoại: trang toàn màn, có nút ‹.
- Đầu hộp: "Nhân vật · Mã" 12px, tên gói 18 / 700, nút đóng.
- Chân hộp: "Huỷ" · "Lưu".

| Nhóm | Dòng (nhãn → điều khiển) | Đọc | Ghi |
|---|---|---|---|
| **Thông tin & giá** | Tên gói → TextInput | `name` | `PATCH /packages/:id {name}` |
| | Nhân vật ? → Select ("Mọi nhân vật" = null) | `subjectId` | `{subjectId}` |
| | Thời lượng → UnitInput "phút" | `durationMinutes` | `{durationMinutes}` |
| | Số thợ → TextInput số (1–20) | `staffCount` | `{staffCount}` |
| | Giá niêm yết → MoneyInput | `currentPrice.listPrice` | **`POST /packages/:id/prices {listPrice, salePrice, effectiveFrom}`** — quyền `prices.write`. Đổi giá = thêm phiên bản, không sửa giá cũ. |
| | Giá bán ? → MoneyInput (trống = "Không giảm") | `currentPrice.salePrice` | như trên; máy chủ báo lỗi nếu giá bán > giá niêm yết |
| | Cọc mặc định → MoneyInput | `depositAmount` | `{depositAmount}` |
| **Địa điểm cho phép** | 3 Checkbox: Tại studio / cửa hàng · Tại nhà khách ? · Địa điểm khác ? | `locationTypes[]` (rỗng = mọi nơi) | `{locationTypes}` |
| **Đã gồm trong gói** | Mỗi dịch vụ → UnitInput "lần"; nút "+ Thêm dịch vụ" | `items[]` có `isOptional = false` | `PATCH {items}` — **gửi lại toàn bộ** `items[{serviceId, quantity, isOptional}]` |
| **Dịch vụ phụ cho tick** ? | Checkbox mỗi dịch vụ phụ, giá bên phải | danh sách `GET /services?kind=ADDON`; đang tick = có trong `items` với `isOptional = true` | cùng `PATCH {items}`. Chỉ dịch vụ `kind ADDON` được làm dòng tick. |
| **Tiền công thợ theo bậc** ? | Mỗi bậc: AvatarStack + tên bậc 14 / 600 + tên thợ (12px, cách bằng dấu phẩy) → MoneyInput ("Chưa đặt" khi null) | `GET /packages/:id/pay-rates` → `items[{tier{id,name,sortOrder}, amount\|null, updatedAt, staff[{membershipId, displayName, avatarUrl, initials}]}]` | `PUT /packages/:id/pay-rates [{tierId, amount\|null}]` — quyền `payroll.write`; không có quyền thì ẩn cả nhóm |

**Lưu hộp thoại**
- Gọi lần lượt và chỉ gọi khi có thay đổi: `PATCH /packages/:id` → `POST /prices` → `PUT /pay-rates`.
- Một bước lỗi thì giữ hộp thoại mở, hiện lỗi ngay dưới ô liên quan, các bước đã xong không gửi lại.

**(b) Dịch vụ phụ & phụ phí**
- Thẻ danh sách, hai tiêu đề nhóm: "Dịch vụ phụ ?" và "Phụ phí cài sẵn".
- Mỗi dòng: tên · thời lượng · giá. Bấm dòng → hộp thoại dịch vụ.
  - Các dòng: Tên, Mã, Thời lượng, Giá niêm yết, Giá bán, Tiền công thợ theo bậc (`/services/:id/pay-rates`).

| Việc | Đường API |
|---|---|
| Đọc | Đ `GET /services?kind=ADDON\|SURCHARGE` |
| Sửa thông tin | G `PATCH /services/:id` |
| Đổi giá | `POST /services/:id/prices` |

**(c) Phí di chuyển & studio** — hai thẻ cạnh nhau (điện thoại: chồng dọc).

| Dòng | Đọc / ghi |
|---|---|
| Cách tính mặc định ? → Segmented Cố định / Theo km / Nhập tay | `defaultMode` |
| Mức cố định mỗi lần đi → MoneyInput | `fixedAmount` |
| Đơn giá mỗi km → MoneyInput | `perKmAmount` |
| Số km miễn phí ? → UnitInput km | `freeKm` |
| Phí tối thiểu ? → MoneyInput | `minimumAmount` |
| Tính cả chiều về → Switch | `roundTrip` |

- Đường API: `GET /travel-fee-policy` / **`PUT /travel-fee-policy` gửi đủ 6 trường** (quyền `prices.write`).
- **Studio / cửa hàng ?:**
  - Mỗi dòng: radio "mặc định" (`isDefault`) · tên (`name`) · địa chỉ 12px (`address`).
  - Nút "+ Thêm studio / cửa hàng".
  - Đường API: `GET/POST/PATCH /studio-locations`.

**(d) Nhân vật**
- Mỗi dòng: tên · "n gói" · Switch đang dùng (`isActive`). Kéo để đổi thứ tự (`sortOrder`).
- Đường API: `GET/POST/PATCH /makeup-subjects`.

### 4.3 Lập hợp đồng

Bản mẫu: `#hop-dong`, `#hop-dong-chon`, `#hop-dong-xn`.

Ảnh:
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-tablet.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-chon-tu-bang-gia-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-xac-nhan-desktop.png

**Bố cục**
- Máy tính: hai cột `400px | 1fr`, khe 20. Máy tính bảng: `320px | 1fr`, khe 14.
- **Cột trái "Bảng giá"** dính đầu (`top: 16px`, cao tối đa `100vh − 32px`, thân cuộn riêng).
- **Điện thoại:** ẩn cột trái. Nút nét đứt "+ Thêm từ bảng giá" mở **BottomSheet** có cùng nội dung.

**Cột trái — chọn từ bảng giá**

| Phần | Nội dung | Nguồn |
|---|---|---|
| Ô tìm | TextInput "Tìm gói, dịch vụ, phụ phí" | lọc phía máy, hoặc `?q=` |
| Chip nhân vật | Tất cả · từng nhân vật có gói · Mọi nhân vật | `GET /makeup-subjects` |
| Mục GÓI | Mỗi gói: tên 14 / 600, "nhân vật · nơi làm" 12px, nút "+ 2.700.000 ₫". Gói đã có trong hợp đồng ghi thêm "✓ Đã có trong hợp đồng" (vẫn bấm được: thêm thêm một dòng) | `GET /packages?isActive=true` |
| Mục PHỤ PHÍ CÀI SẴN | Tên · giá · nút "+" | `GET /services?kind=SURCHARGE` |
| Khoản tự đặt tên | Nút "+ Thêm" | — |

**Cột phải — hợp đồng, từ trên xuống**

*Thẻ đầu*
- "Lập hợp đồng {code}" + StatusTag. Mã HĐ chỉ có sau lần lưu đầu; trước đó ghi "Lập hợp đồng mới".
- **Khách hàng:** thẻ khách — tên xuống dòng, không cắt; "SĐT · email" 12px; nút "Đổi".
  - Chưa chọn khách: ô tìm theo tên hoặc SĐT (`GET /customers?q=`) + "Khách mới" (form 2 dòng: Họ tên, Số điện thoại).
  - Gửi lên: `customerId` hoặc `newCustomer{fullName, phone}`.
- **Ngày sự kiện:** ô ngày, rộng tối đa 240px → `eventDate` (ISO kèm `+07:00`).

*Mỗi dòng gói = một thẻ nhân vật*

| Phần | Điều khiển | Trường gửi `lines[i]` |
|---|---|---|
| Đầu thẻ | nhãn nhân vật · tên gói · Qty · nút ✕ bỏ dòng | `kind: 'PACKAGE', packageId, subjectId` (mặc định lấy `subjectId` của gói, đổi được), `quantity` |
| Giờ | 2 ô giờ "04:30 – 07:00" + chữ "1 × 2.700.000 ₫" | `scheduledStart, scheduledEnd` (ghép với `eventDate`) |
| **Thợ phụ trách** ? *(bổ sung 18/10/2026)* | AvatarStack thợ đã chọn (thợ chính có viền màu) · tên rút gọn (nhiều thợ thì thêm "(chính)") · nút "Đổi" / "Chọn thợ" mở StaffPicker. Ngay dưới hàng là StaffWarningBanner nếu có cảnh báo. | `staff[{membershipId, role PRIMARY\|ASSIST}]` |
| Dịch vụ phụ | CheckChip cho từng dịch vụ trong `items` có `isOptional = true`, kèm "+giá". Số lượng mặc định bằng số lượng dòng (Phù dâu × 2 → Kẹp mi × 2) | `addons[{serviceId, quantity}]` |
| Làm ở đâu | Segmented Studio / Tại nhà / Nơi khác. Loại gói không cho phép thì khoá, tooltip "Gói này không làm …" | `locationType` |
| ↳ Studio | Select tên studio + địa chỉ 12px dưới | `studioLocationId` |
| ↳ Tại nhà, Nơi khác | Textarea địa chỉ 2 dòng | `address` |
| Di chuyển `*` ? (chỉ khi Tại nhà hoặc Nơi khác; **bắt buộc**) | Segmented Cố định / Theo km / Nhập tay (mặc định `defaultMode`) · ô km (Theo km) hoặc MoneyInput (Nhập tay) · số tiền căn phải · dòng công thức 12px | `travel{mode, distanceKm?, amount?}`. Nhập tay bắt buộc `amount` (miễn phí = 0). Cố định và Theo km **không gửi** `amount`. |
| Chân thẻ | "Cộng {nhân vật}" · số tiền | tổng `lineTotal` của dòng gói + addons + travel lấy từ `quote` |

**Thợ phụ trách và cảnh báo trùng giờ** *(bổ sung 18/10/2026)*

Ghi theo đặc tả điều phối gửi. Lúc vẽ, mã máy chủ **chưa có** các đường và trường này; khi máy chủ xong phải đối chiếu lại tên trường.

Bản mẫu: `#hop-dong` (hàng thợ và dải cảnh báo), `#hop-dong-tho` (ô chọn thợ), `#hop-dong-xn` (đã xác nhận).

Ảnh:
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-tablet.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-chon-tho-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-chon-tho-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-xac-nhan-desktop.png

*Hàng "Thợ phụ trách"* — nằm ngay dưới hàng "Giờ"; cột nhãn rộng 118px.
- Avatar 28px. Thợ chính có viền `box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--accent)`.
- Tooltip "?" giải thích viền màu và việc tạo lịch khi xác nhận.
- Chưa chọn thợ: chữ "Chưa chọn" màu `--faint` + nút "Chọn thợ".

*StaffWarningBanner* — trong thẻ dòng, lề 0 16 10.
- Nguồn: `quote.staffWarnings` của dòng đó.
- Mỗi cảnh báo một dải, chữ 13px, bo 8. Chi tiết (giờ, tên ca, khách) nằm trong tooltip "?". Không viết thêm chữ khác.

| Mức | Màu | Chữ trên dải |
|---|---|---|
| `OVERLAP` | đỏ: `--danger-bg` / `--danger-line` / `--danger` | biểu tượng cảnh báo · "**Trùng giờ 05:00–06:30** — hợp đồng sẽ không xác nhận được" |
| `SAME_DAY` | vàng: `--warn-bg` / `--warn-line` / `--warn` | biểu tượng đồng hồ · "{tên} có lịch trong ngày · n ca" |

- Còn ít nhất một dải đỏ: nút "Xác nhận hợp đồng" ở thanh tổng bị **khoá**, tooltip "Còn n dòng thợ trùng giờ. Đổi thợ hoặc đổi giờ trước khi xác nhận."
- Máy chủ vẫn là chốt chặn cuối: nếu trả **409** khi xác nhận, hợp đồng vẫn ở trạng thái nháp. Giao diện gọi lại `quote` rồi hiện dải đỏ ở đúng dòng.

*StaffPicker* — máy tính và máy tính bảng: Dialog rộng `min(560px, 100%)`; điện thoại: BottomSheet.
- **Đầu hộp:** "Chọn thợ phụ trách" + dòng phụ "{nhân vật} · {giờ} · {ngày}".
- **Thân hộp:** thợ nhóm theo **bậc** (tiêu đề nhóm viết hoa 11.5px trên nền `--soft`, xếp theo `tier.sortOrder`).
- **Mỗi dòng thợ** (đệm 10 18):
  - Checkbox · Avatar 28 · tên 14 / 600 · hàng nhãn trạng thái.
  - Dòng đang chọn: nền `--accent-soft`, bên phải có Segmented "Chính / Phụ" (`role`). Mỗi dòng gói tối đa một thợ chính.
- **Nhãn trạng thái:**

| Tình trạng | Nhãn |
|---|---|
| `FREE` | không nhãn |
| `SAME_DAY` | nhãn vàng "Có lịch trong ngày · n ca". Bấm vào thì mở ra danh sách giờ, 12px. |
| `OVERLAP` | nhãn đỏ "Trùng giờ 05:00–06:30" + tooltip chi tiết. **Vẫn chọn được**: chủ studio có thể đang định đổi giờ ca kia. Cảnh báo sẽ hiện trong thẻ dòng. |
| Có `draftHolds` | thêm nhãn xám "Giữ chỗ nháp", tooltip "Đang nằm trong một hợp đồng nháp khác cùng giờ. Chưa chặn lịch." |
| `isBookable = false` | nhãn xám "Tắt nhận lịch". Checkbox khoá, cả dòng mờ. |

- **Chân hộp:** "Huỷ" · "Chọn". Bấm "Chọn" ghi `staff` vào dòng rồi gọi lại `quote`.

| Ô | Đường API | Trường |
|---|---|---|
| Danh sách thợ và tình trạng | Đ `GET /orgs/:orgId/staff/availability?startsAt&endsAt&excludeContractId` (`startsAt/endsAt` = `scheduledStart/End` của dòng; `excludeContractId` = hợp đồng đang sửa, khi đã có id) | mỗi thợ `{displayName, avatarUrl, initials, tier, isBookable, level OVERLAP\|SAME_DAY\|FREE, overlaps[], sameDay[], draftHolds[]}` |
| Thợ đã chọn | G trong thân `POST /contracts` / `PATCH /contracts/:id` / `POST /contracts/quote` | `lines[i].staff[{membershipId, role}]` |
| Dải cảnh báo trong thẻ | Đ `POST /contracts/quote` | `staffWarnings` theo dòng |
| Xác nhận | G `POST /contracts/:id/status {to: 'CONFIRMED'}` | Máy chủ tạo lịch cho các thợ. Trùng giờ → 409, hợp đồng vẫn `DRAFT`. |

- Thợ trùng giờ **trong chính hợp đồng này** (ví dụ cùng một thợ được gán cho dòng cô dâu 04:30–07:00 và dòng mẹ 05:00–05:45) cũng hiện là `OVERLAP`. Ô chọn ghi "Dòng Cô dâu của hợp đồng này" trong tooltip.
- *Hợp đồng đã xác nhận:* hàng thợ **chỉ xem**. Thay nút "Đổi" bằng liên kết "Đổi ở Lịch", mở màn Lịch đúng ca đó (thợ của ca đã tạo đổi bằng `PATCH /appointments/:id {staff}`). Không hiện dải cảnh báo.

**Dòng công thức Theo km**
- Hiện theo `computeTravelFee` (/home/user/a/packages/shared/src/contract.ts): `{km} km × 2 chiều − {freeKm} km miễn phí = {km tính tiền} km × {perKmAmount}`.
- Làm tròn **lên** bội 1.000 ₫, không thấp hơn `minimumAmount` (trừ khi km tính tiền = 0).
- Ví dụ: 12,35 km → 21,7 km → **217.000 ₫**.
- Giao diện chỉ dùng công thức này để **hiện chữ**. Số tiền lấy từ `quote`.

*Thẻ "Phụ phí & khoản khác"*

| Loại dòng | Hiện | Trường gửi |
|---|---|---|
| Phụ phí | nhãn "Phụ phí" + tên + ghi chú | `{kind: 'SURCHARGE', serviceId, quantity, note?}`. Muốn sửa giá thì gửi `unitPrice`, **bắt buộc kèm `note`** lý do. |
| Tự đặt tên | nhãn "Tự đặt tên" + tên + số tiền | `{kind: 'CUSTOM', name, unitPrice, quantity, note?}` |
| Phát sinh (sau xác nhận) | nhãn "Phát sinh {ngày}" | máy chủ trả `addedAfterConfirm = true` |

- Cuối thẻ: hai nút ghost "+ Phụ phí cài sẵn", "+ Khoản tự đặt tên".
- **Phụ phí không gắn dưới gói.** API không có dòng cha cho SURCHARGE.

*Thẻ tổng*

| Dòng | Điều khiển | Trường |
|---|---|---|
| Tạm tính | chữ, căn phải | `subtotal` |
| Giảm giá ? | MoneyInput | `discount`. Máy chủ báo lỗi nếu lớn hơn tạm tính. |
| **Tổng** | 18 / 700 | `total` |
| Cọc cần thu ? | MoneyInput; tooltip ghi "Gợi ý: {suggestedDeposit}" | `depositRequired` |
| Ghi chú hợp đồng | Textarea (nhãn trên, ô dưới, trên điện thoại) | `notes` |

*Thanh tổng dính đáy:* "Tổng 5.300.000 ₫ · Cọc 1.000.000 ₫" · [Lưu nháp] · [Xác nhận hợp đồng].

**Bảng tính tức thời**
- Mọi thay đổi gọi `POST /contracts/quote` với đúng thân như lúc tạo (`ContractBody`). Đợi 300ms sau lần gõ cuối; huỷ yêu cầu cũ khi có yêu cầu mới.
- Máy chủ trả `{lines[] (đã gom addons[] và travel dưới dòng cha), travelTotal, subtotal, discount, total, depositRequired, suggestedDeposit}`.
- Đang chờ thì số mờ đi, không nhảy chỗ.
- `quote` lỗi 400 thì hiện lỗi ngay dưới ô liên quan (dựa theo đường dẫn trường trong lỗi), giữ số cũ.

**Lưu và chuyển trạng thái**

| Việc | Đường API |
|---|---|
| Lưu nháp lần đầu | G `POST /contracts` + header `Idempotency-Key` (một khoá cho mỗi lần mở màn lập mới) |
| Lưu nháp các lần sau | G `PATCH /contracts/:id` — **gửi lại toàn bộ `lines`** cùng `discount, depositRequired, eventDate, notes` |
| Xác nhận | G `POST /contracts/:id/status {to: 'CONFIRMED'}` |
| Huỷ hợp đồng | `{to: 'CANCELLED', reason}` — bắt buộc lý do |

- Nút chuyển trạng thái chỉ hiện các bước có trong `CONTRACT_STATUS_TRANSITIONS`.

**Hợp đồng đã xác nhận** (`#hop-dong-xn`)
- Dải xanh "Dòng đã chốt. Chỉ thêm phát sinh hoặc huỷ dòng kèm lý do."
- Mọi điều khiển của dòng **khoá**. Đầu thẻ có biểu tượng khoá, "n người", nút ghost "Huỷ dòng".
  - Bấm "Huỷ dòng" → hộp thoại nhỏ có ô lý do bắt buộc → `POST /contracts/:id/lines/:lineId/void {reason}`.
  - Máy chủ huỷ kéo theo dịch vụ phụ và phí di chuyển của dòng đó.
- Dòng đã huỷ: gạch ngang, nhãn đỏ "Đã huỷ: {voidReason}", không tính vào tổng.
- **Ghi chú vẫn sửa được:** `PATCH {notes}`, đúng luật máy chủ.
- Cột trái đổi tên thành "Thêm phát sinh". Bấm một mục → `POST /contracts/:id/lines` với **một** dòng (`LineInput`, kèm addons/travel nếu là gói).
- Thanh đáy chỉ còn nút "+ Phát sinh".

**Danh sách hợp đồng** (mục con)
- `GET /contracts?page&pageSize&status&customerId&q&eventFrom&eventTo`.
- Mỗi dòng: mã · khách · ngày sự kiện · tổng · StatusTag.
- Không vẽ ở Chặng 1; dựng theo mẫu danh sách gọn (mục 4.2a).

---

## 5. Luật xử lý lỗi và tải

| Tình huống | Hiển thị |
|---|---|
| Tải lần đầu | Skeleton đúng bố cục, không dùng vòng xoay giữa màn |
| 400 lỗi nhập | Lỗi dưới ô (12px `--danger`), cuộn tới ô lỗi đầu tiên |
| 401 | Về màn đăng nhập (`POST /auth/refresh` trước một lần) |
| 403 | Ẩn nút từ đầu theo quyền. Nếu vẫn gặp: dải đỏ "Bạn không có quyền …" |
| 404 | EmptyState "Không tìm thấy …" + nút quay lại |
| 409 `CONFLICT` | Lịch: dải trùng lịch (mục 4.1). Hợp đồng: thông báo của máy chủ, giữ dữ liệu đã nhập |
| Mất mạng | Dải `--warn-bg` trên đầu thân trang; nút lưu khoá |

---

## 6. Quyền → phần nào hiện

| Quyền | Hiện / bật |
|---|---|
| `catalog.read` | Menu Bảng giá, cột "Bảng giá" ở hợp đồng |
| `catalog.write` | Sửa gói, dịch vụ, nhân vật, studio |
| `prices.write` | Ô giá niêm yết, giá bán; thẻ Phí di chuyển (ghi) |
| `payroll.read` / `payroll.write` | Nhóm "Tiền công thợ theo bậc" (xem / sửa) |
| `contracts.read` | Menu Hợp đồng, `quote` |
| `contracts.write` | Lưu, xác nhận, phát sinh, huỷ dòng |
| `customers.read` / `customers.write` | Tìm khách / Khách mới |
| `schedule.read_own` | Lịch (người chỉ có quyền này chỉ thấy ca của mình) |
| `schedule.write` | Thêm, sửa, dời ca |
| `staff.read` | Hàng hoặc cột thợ, avatar; ô chọn thợ trong hợp đồng (bổ sung 18/10/2026) |

---

## 7. Chia gói việc theo tệp

Thư mục gốc: `apps/web/` — React 18 + TypeScript + Vite. Dùng chung kiểu dữ liệu và hàm từ `@makeup/shared`.

Mỗi gói chỉ ghi vào nhóm tệp của mình. Tệp dùng chung (`src/ui/index.ts`, `src/app/routes.tsx`) chỉ do gói sở hữu ghi; gói khác mở yêu cầu cho chủ tệp.

| Gói | Tệp sở hữu | Nội dung | Phụ thuộc |
|---|---|---|---|
| **W0 Nền** | `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `public/fonts/*`, `src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`, `src/styles/tokens.css`, `src/styles/base.css` | Dự án, phông tự chứa, token mục 1 (y nguyên tên biến), khung định tuyến rỗng (`/lich`, `/hop-dong`, `/hop-dong/:id`, `/bang-gia/:nhom`) | — |
| **W1 Gọi API** | `src/api/client.ts`, `src/api/errors.ts`, `src/api/idempotency.ts`, `src/api/auth.ts`, `src/api/catalog.ts`, `src/api/contracts.ts`, `src/api/schedule.ts`, `src/api/staff.ts`, `src/api/types.ts` | fetch kèm token và `orgId`; ánh xạ lỗi 400/401/403/404/409; một hàm cho mỗi đường ở mục 4, kể cả `GET /staff/availability` (bổ sung 18/10/2026); `useQuote` (đợi 300ms, huỷ yêu cầu cũ) | W0 |
| **W2 Component** | `src/ui/*.tsx` (Button, TextInput, Textarea, MoneyInput, UnitInput, Select, Checkbox, CheckChip, Switch, Segmented, Qty, Card, Dialog, BottomSheet, Tooltip, Avatar, AvatarStack, StatusTag, Chip, StickyTotalBar, EmptyState, Skeleton), `src/ui/index.ts`, `src/ui/format.ts` (`formatVnd`, `formatKm`, `parseMoney`, `parseKm`) | Mục 3, đủ 6 trạng thái; bài thử cho MoneyInput/UnitInput (dấu chấm, dấu phẩy, giới hạn) | W0 |
| **W3 Khung** | `src/layout/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `BottomNav.tsx`, `PageHeader.tsx`, `nav.ts`, `usePermissions.ts` | Mục 2, ẩn mục theo quyền (mục 6), 3 điểm gãy | W1, W2 |
| **W4 Bảng giá** | `src/features/pricing/**` (PricingPage, SubjectCards, PackageRow, PackageDialog, groups/InfoPriceGroup, LocationsGroup, IncludedGroup, AddonsGroup, PayRatesGroup, ServicesPage, ServiceDialog, TravelPage, StudioLocations, SubjectsPage) | Mục 4.2 | W3 |
| **W5 Hợp đồng** | `src/features/contracts/**` (ContractEditor, CatalogPicker, PickerSheet, CustomerBlock, PackageLineCard, TravelControl, ExtrasCard, TotalsCard, VoidLineDialog, ConfirmedBanner, ContractList) — *bổ sung 18/10/2026:* `src/features/contracts/StaffRow.tsx`, `StaffPicker.tsx`, `StaffWarningBanner.tsx`, `useStaffAvailability.ts` | Mục 4.3, gồm phần "Thợ phụ trách và cảnh báo trùng giờ". **Không** nhập tệp của W4: phần chọn từ bảng giá tự đọc `src/api/catalog.ts`. Hàm gọi `GET /staff/availability` đặt trong `src/api/staff.ts` (tệp của W1; W5 mở yêu cầu cho W1 thêm). | W3 (song song với W4); `useStaffAvailability` cần W1 thêm hàm gọi API |
| **W6 Lịch** | `src/features/schedule/**` (SchedulePage, Toolbar, ModeSwitch, WeekGridC, WeekGridCMobile, DayListB, StaffColumnsA, AppointmentDialog, ConflictBanner, StatusActions) | Mục 4.1; mặc định C; luật 409 | W3 (song song với W4, W5) |
| **W7 Kiểm thử giao diện** | `apps/web/e2e/**` (Playwright) | Chụp 3 khổ (1440, 1024, 390) cho mọi màn; kiểm không tràn ngang; so khớp số tiền với `quote` | W4, W5, W6 |

**Thứ tự chạy:** W0 → (W1 và W2 song song) → W3 → (W4, W5, W6 song song) → W7.

**Mốc nghiệm thu mỗi gói**
- Ảnh chụp 3 khổ đặt cạnh ảnh bản mẫu tương ứng trong /home/user/a/docs/rnd/anh/.
- Chủ studio duyệt bằng mắt.

---

## 8. Việc còn mở (chờ anh Chiến hoặc đội máy chủ)

Chi tiết lý do ở /home/user/a/docs/rnd/BAO-CAO-RND-02.md, mục 9.

1. Phí di chuyển dùng chung cho nhiều dòng cùng địa chỉ.
2. `ServicePackage.includedKm`.
3. Phụ phí gắn vào một nhân vật.
4. Sổ thu cọc.
5. `GET /appointments` trả thêm avatar và chữ viết tắt của thợ.
6. `newCustomer` nhận thêm email và ghi chú.

---

## 9. Ký duyệt của điều phối (kiến trúc sư trưởng) — 18/10/2026

Bản vẽ được **duyệt có điều chỉnh**. Ba điều chỉnh dưới đây đè lên chữ ở mục 7; giữ nguyên chữ cũ phía trên để thấy đã đổi gì.

| # | Bản vẽ ghi | Điều chỉnh | Vì sao |
|---|---|---|---|
| 1 | React 18 | **React 19** | Phiếu móng web (thợ E) đã ghim React 19; React 19 đã ổn định. Dùng hai bản trong một dự án là sai. |
| 2 | Đường `/lich`, `/hop-dong`, `/bang-gia/:nhom` | **`/:orgSlug/lich`, `/:orgSlug/hop-dong`, `/:orgSlug/hop-dong/:id`, `/:orgSlug/bang-gia/:nhom`** | Một người làm cho nhiều tổ chức; đường dẫn phải nói rõ đang ở tổ chức nào. Thêm `/dang-nhap`, `/dang-ky`, `/tao-to-chuc`. |
| 3 | W0 gồm cả khung dự án lẫn định kiểu; W1 gồm lõi gọi API | W0 và lõi W1 (`src/api/client.ts`, `errors.ts`, `idempotency.ts`, `auth.ts`, `src/app/session.tsx`, `routes.tsx`) do **thợ E** làm trước. Phần định kiểu của W0 (`src/styles/*`, `public/fonts/*`) gộp vào **W2**. Phần còn lại của W1 (`catalog.ts`, `contracts.ts`, `schedule.ts`, `staff.ts`, `types.ts`) làm sau, dựa trên lõi của E. | Thợ E đã bắt đầu trước khi có bản vẽ. Chia lại theo tệp để không ai giẫm lên tệp của người khác. |

**Thứ tự chạy sau ký:** E (móng + lõi W1) → (W1-phần còn lại và W2 song song) → W3 → (W4, W5, W6 song song) → W7.

**Nguồn bên thứ ba đi vào bản phát hành** (ghi chép theo luật 15): phông chữ Be Vietnam Pro tự chứa trong `public/fonts` (giấy phép SIL Open Font License 1.1, phải kèm tệp giấy phép trong thư mục phông).
