# Báo cáo R&D 02 — Bảng giá v2 và Lập hợp đồng

- Sản phẩm: Makeup Pro
- Người đọc: anh Chiến
- Ngày: 18/10/2026
- Chặng: 1 (vòng 2) → chuyển sang Chặng 2 cho phương án C

---

## 1. Kết luận

- **Anh đã chọn phương án C** ("C nhé", khi xem hộp chi tiết gói "Cô dâu – Ngày cưới").
- Điều phối quyết định thay (anh có thể bác): màn **Lập hợp đồng cũng theo C**, để Bảng giá và Hợp đồng chung một họ thiết kế.
- **Màn Lịch:** có đủ 3 chế độ — A (cột theo thợ), B (danh sách ca theo ngày), C (lưới tuần thợ × ngày). **Mặc định là C** (anh chốt).
- **Khung điều hướng của toàn app** theo phương án C:
  - máy tính và máy tính bảng: thanh bên trái;
  - điện thoại: thanh dưới 5 mục.
- Bản vẽ thông số cho Chặng 2: /home/user/a/docs/rnd/BAN-VE-C.md

## 2. Cách xem

Mở bằng trình duyệt, không cần mạng. Thêm `#…` vào cuối đường dẫn để mở đúng màn.

| Tệp | Các màn (thêm vào cuối đường dẫn) |
|---|---|
| /home/user/a/docs/rnd/v2-phuong-an-A.html | `#bang-gia`, `#bang-gia-goi`, `#bang-gia-phu`, `#bang-gia-dc`, `#bang-gia-nv`, `#hop-dong`, `#hop-dong-xn` |
| /home/user/a/docs/rnd/v2-phuong-an-B.html | như A, thêm `#hop-dong-b3` (bước 3) và `#hop-dong-b4` (bước 4) |
| **/home/user/a/docs/rnd/v2-phuong-an-C.html** (đã chọn) | `#bang-gia`, `#bang-gia-mo` (hộp chi tiết gói), `#bang-gia-goi` (chi tiết gói trên điện thoại), `#bang-gia-phu`, `#bang-gia-dc`, `#bang-gia-nv`, `#hop-dong`, `#hop-dong-chon` (ngăn chọn từ bảng giá trên điện thoại), `#hop-dong-xn` (đã xác nhận + phát sinh) |
| /home/user/a/docs/rnd/v2-lich-C-mobile.html | Đề xuất lịch C trên điện thoại (mục 8) |

**Ảnh:** /home/user/a/docs/rnd/anh/v2-phuong-an-{A,B,C}-{bang-gia,hop-dong}-{desktop,tablet,mobile}.png
- Ảnh chụp cả trang: khung nhìn được kéo cao bằng trang, nên thanh tổng tiền nằm đúng chỗ cuối trang.
- Có thêm ảnh phụ trong cùng thư mục: chi tiết gói, phí di chuyển, hợp đồng đã xác nhận, các bước B, ngăn chọn trên điện thoại.

## 3. Dữ liệu minh hoạ (giống nhau ở 3 phương án)

**Khách và hợp đồng**
- Khách: **Tôn Nữ Hoàng Bảo Ngọc Phương Thảo** — 0912 345 678.
- Hợp đồng HĐ-2026-0142, sự kiện Thứ Bảy 24/10/2026.

**Các dòng**

| Nhân vật | Gói | Nơi làm | Dịch vụ phụ đã tick | Thành tiền |
|---|---|---|---|---|
| Cô dâu | Cô dâu – Ngày cưới (2.700.000 ₫) | Tại nhà, Số 7 ngõ 128 Nguyễn Văn Cừ, Long Biên | Làm nail 250.000 ₫, Lens 100.000 ₫ | — |
| Mẹ cô dâu × 1 | Mẹ – Trang điểm nhẹ nhàng | Studio Chiến | Làm tóc 300.000 ₫ | 900.000 ₫ |
| Phù dâu × 2 | Phù dâu | Studio Chiến | Kẹp mi × 2 | 960.000 ₫ |

- **Phí di chuyển của cô dâu:** 12,35 km. Công thức 12,35 km × 2 chiều − 3 km miễn phí = 21,7 km × 10.000 ₫ = **217.000 ₫** (đúng công thức `computeTravelFee` trong /home/user/a/packages/shared/src/contract.ts).
- **Phụ phí cài sẵn:** "Ca sớm trước 5 giờ" 200.000 ₫.
- **Khoản tự đặt tên:** "Trang điểm lại giữa tiệc" 300.000 ₫.

**Tiền**
- Tạm tính 5.627.000 ₫, giảm 327.000 ₫, **tổng 5.300.000 ₫**.
- Cọc 1.000.000 ₫, gợi ý từ cọc mặc định của gói cô dâu.

**Sau khi xác nhận**
- Huỷ dòng Lens, lý do "Khách tự mang lens".
- Thêm phát sinh "Thêm người" 150.000 ₫.
- Tổng mới **5.350.000 ₫**.

**Bậc lương (tiền công thợ):**

| Bậc | Thợ thuộc bậc | Tiền công cho gói cưới |
|---|---|---|
| Thợ chính bậc 1 | Nguyễn Thu Hà, Trần Minh Anh | 700.000 ₫ |
| Thợ chính bậc 2 | Lê Ngọc Trâm | 550.000 ₫ |
| Thợ phụ | Phạm Bảo Vy, Đỗ Khánh Linh | chưa đặt |

## 4. Mỗi ô trên màn ứng với trường nào (đã đối chiếu dữ liệu thật)

Nguồn đối chiếu:
- /home/user/a/apps/api/prisma/schema.prisma
- các tệp /home/user/a/apps/api/src/modules/*/

Không màn nào trong ba phương án có ô nằm ngoài danh sách dưới đây.

| Màn / ô | Trường |
|---|---|
| Nhóm "Nhân vật" | `MakeupSubject.name, sortOrder, isActive` — `GET/POST/PATCH /orgs/:orgId/makeup-subjects` |
| Danh sách gói: tên, nơi làm (chữ ngắn), giá bán | `ServicePackage.name, locationTypes`, `currentPrice.unitPrice` — `GET /orgs/:orgId/packages` |
| Chi tiết gói — Thông tin & giá | `name, subjectId, durationMinutes, staffCount, depositAmount`; giá đổi bằng bản giá mới: `POST /packages/:id/prices {listPrice, salePrice, effectiveFrom}` |
| Chi tiết gói — Địa điểm cho phép | `ServicePackage.locationTypes[]` (rỗng = mọi nơi) |
| Chi tiết gói — Đã gồm / Dịch vụ phụ cho tick | `PackageItem{serviceId, quantity, isOptional}`. Máy chủ chỉ cho dịch vụ loại ADDON làm dòng tick. |
| Chi tiết gói — Tiền công thợ theo bậc | `GET/PUT /orgs/:orgId/packages/:packageId/pay-rates` → `items[{tier{name}, amount|null, staff[{displayName, avatarUrl, initials}]}]` |
| Dịch vụ phụ & phụ phí | `Service{kind ADDON|SURCHARGE, name, durationMinutes}` + giá hiện hành |
| Phí di chuyển | `TravelFeePolicy{defaultMode FIXED|PER_KM|MANUAL, fixedAmount, perKmAmount, freeKm, minimumAmount, roundTrip}` — `GET/PUT /orgs/:orgId/travel-fee-policy` |
| Studio / cửa hàng | `StudioLocation{name, address, isDefault}` |
| Hợp đồng — Khách | `customerId` hoặc `newCustomer{fullName, phone}` |
| Hợp đồng — Ngày sự kiện, Ghi chú | `eventDate`, `notes` |
| Dòng gói | `lines[]{kind PACKAGE, packageId, subjectId, quantity, locationType, studioLocationId, address, scheduledStart, scheduledEnd}` |
| Ô tick dịch vụ phụ | `lines[].addons[]{serviceId, quantity}` |
| Phí di chuyển của dòng | `lines[].travel{mode, distanceKm, amount}` |
| Phụ phí cài sẵn | dòng riêng `{kind SURCHARGE, serviceId, quantity}` |
| Khoản tự đặt tên | `{kind CUSTOM, name, unitPrice, quantity}` |
| Tạm tính / Giảm giá / Tổng / Cọc | `subtotal, discount, total, depositRequired` (`suggestedDeposit` cho tooltip gợi ý) — lấy từ `POST /orgs/:orgId/contracts/quote` mỗi lần đổi |
| Xác nhận | `POST /contracts/:id/status {to: CONFIRMED}` |
| Phát sinh | `POST /contracts/:id/lines` (máy chủ đánh dấu `addedAfterConfirm`) |
| Huỷ dòng | `POST /contracts/:id/lines/:lineId/void {reason}` |

**Hai chỗ R&D đã sửa lại cho đúng dữ liệu thật trong vòng này**
1. Bản nháp đầu đặt phụ phí "Ca sớm trước 5 giờ" ngay dưới gói cô dâu. API thật chỉ gắn **dịch vụ phụ và phí di chuyển** dưới gói. Phụ phí là dòng riêng của hợp đồng. Cả ba bản mẫu đã chuyển phụ phí về khối "Phụ phí & khoản khác", có ghi chú "Cô dâu bắt đầu 04:30".
2. Ở hợp đồng đã xác nhận, API cho **sửa ghi chú**, nên ô ghi chú vẫn sửa được. Các dòng thì khoá; mỗi dòng có nút "Huỷ dòng" (bắt buộc ghi lý do).

## 5. Học từ Studio Pro — form tạo hợp đồng thật

**Cách R&D chạy được form:** làm như vòng 1.
- Chép mã sang /tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/ssaas-run.
- Giả lập API ngay trong trình duyệt.
- Dựng lại CSS Tailwind từ chính mã nguồn.
- Không sửa mã của anh.

Ảnh đã chụp:
- /home/user/a/docs/rnd/tham-chieu/studio-pro-tao-hop-dong-trong-1440.png và …-390.png (form trống)
- /home/user/a/docs/rnd/tham-chieu/studio-pro-tao-hop-dong-them-dich-vu-1440.png và …-390.png (đã thêm "Trang điểm cô dâu (Lẻ)")
- /home/user/a/docs/rnd/tham-chieu/studio-pro-tao-hop-dong-tai-nha-them-nguoi-1440.png (chọn "Về nhà", thêm "Makeup Người nhà", mở khung phụ phí)

Mã nguồn đã đọc (thư mục /tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/repos/ssaas/pages/contracts/):
- components/CreateContractForm.tsx
- components/formSections/ServiceSelectionSection.tsx
- components/formSections/eventDay/MakeupFormSection.tsx

**Điều học được (đã đưa vào bản mẫu)**
- **Chọn "Tại Studio / Về nhà" ngay trong từng dịch vụ makeup**, rồi mới hiện ô km. Bản mẫu làm theo: ô di chuyển chỉ hiện khi chọn Tại nhà hoặc Nơi khác.
- **Đổi qua lại giữa "Số KM" và "nhập phí thủ công"** (link "(Hoặc nhập phí thủ công)"). Bản mẫu nâng thành 3 nút: Cố định / Theo km / Nhập tay.
- **Thêm người nhà dưới ca chính**, có lựa chọn địa điểm "Theo Makeup chính". Bản mẫu cho thêm nhiều nhân vật; R&D đề xuất thêm nút "Giống dòng trên" ở Chặng 2 (chỉ chép địa chỉ, không cần trường mới).
- **"Gói hỗ trợ X km, số km vượt…"** trong mã (`maxTravelDistance`): gói tự gánh vài km đầu. Hiện dữ liệu Makeup Pro chưa có trường này (xem mục 9).
- **Khung "Các khoản điều chỉnh / phụ phí"** có ô lý do. Bản mẫu chia hai: phụ phí cài sẵn, và khoản tự đặt tên.

**Điều Studio Pro đang làm dở (thấy trong ảnh)**
- **Hai chỗ tổng tiền lệch nhau.** Sau khi thêm "Makeup Người nhà" 300.000 ₫, thẻ dịch vụ vẫn ghi "Thành tiền 1.200.000 đ". Khung "Chi tiết thanh toán" bên dưới thì ghi 1.500.000 đ (ảnh …-tai-nha-them-nguoi-1440.png). Makeup Pro chỉ có **một** chỗ tổng, lấy từ máy chủ (`quote`), luôn hiện.
- **Chọn "Về nhà" mà ô km để trống, form không có dấu bắt buộc.** Makeup Pro: dòng tại nhà hoặc nơi khác **bắt buộc** có phí di chuyển; miễn phí thì Nhập tay 0 ₫.
- **Chọn một dịch vụ phải qua 3 ô chọn** (Nhóm → Thể loại → Gói) rồi bấm "Thêm dịch vụ". Bản C: bấm một lần vào gói ở cột bảng giá.
- **Trên điện thoại form dài 3.700 px, hộp lồng 3 tầng, không có tổng tiền dính đáy.** Phần "Hạng mục chính: Chưa có gói chụp nào được chọn" là của ảnh cưới, không liên quan makeup.
- **Một dòng chỉ có một số lượng.** Không chọn được "Phù dâu × 2" kèm "Kẹp mi × 2" như bản mẫu.

## 6. Ba phương án

### A — Tab nhóm trên + danh sách gọn + ngăn kéo bên phải; hợp đồng một trang kiểu hoá đơn

Ảnh:
- /home/user/a/docs/rnd/anh/v2-phuong-an-A-bang-gia-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-A-hop-dong-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-A-hop-dong-xac-nhan-desktop.png
- cùng các bản -tablet và -mobile

**Học từ:** hoá đơn và bảng tính quen thuộc; ngăn sửa bên phải giống danh mục dịch vụ Fresha (vòng 1, mục F5).

**Mạnh**
- Trên máy tính thấy toàn bộ hợp đồng dưới dạng bảng: Nội dung / Địa điểm / SL / Đơn giá / Thành tiền.
- Đối chiếu từng con số dễ.

**Yếu**
- Hợp đồng nhiều cột, trên điện thoại phải đổi sang dạng khác hẳn.
- Bảng giá trên điện thoại gần giống B.

**Hợp với:** người làm sổ sách, trung tâm có kế toán.

**Rủi ro:** bảng hoá đơn dễ phình cột lại, đúng kiểu anh đã bác.

### B — Mục trái theo nhóm + trang chi tiết riêng; hợp đồng 4 bước

Ảnh:
- /home/user/a/docs/rnd/anh/v2-phuong-an-B-bang-gia-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-B-bang-gia-chi-tiet-goi-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-B-hop-dong-desktop.png (bước 2: Dịch vụ)
- /home/user/a/docs/rnd/anh/v2-phuong-an-B-hop-dong-buoc-3-mobile.png (bước 3: Địa điểm & phí)
- /home/user/a/docs/rnd/anh/v2-phuong-an-B-hop-dong-buoc-4-desktop.png (bước 4: Xác nhận)
- /home/user/a/docs/rnd/anh/v2-phuong-an-B-hop-dong-xac-nhan-desktop.png

**Học từ:** quy trình tư vấn thật: khách → dịch vụ → nơi làm & phí → chốt.

**Mạnh**
- Mỗi màn ít việc, hợp điện thoại.
- Người mới không sót bước.

**Yếu**
- Sửa một con số phải lùi bước.
- Không thấy cùng lúc dịch vụ và địa điểm của một nhân vật.

**Hợp với:** thợ cá nhân tư vấn trên điện thoại.

**Rủi ro:** người quen việc thấy chậm.

### C — Thẻ theo nhân vật, bấm mở chi tiết; hợp đồng hai cột (ĐÃ CHỌN)

Ảnh:
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-chi-tiet-goi-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-chi-tiet-goi-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-phi-di-chuyen-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-chon-tu-bang-gia-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-xac-nhan-desktop.png

**Học từ**
- Khung menu nhóm con của Studio Pro (vòng 1).
- Cách gom "người nhà dưới ca chính" của Studio Pro (mục 5).

**Mạnh**
- Bảng giá xếp theo **nhân vật** — đúng cách anh gọi tên.
- Hợp đồng: bảng giá bên trái, bấm "+ giá" là thêm. Mỗi nhân vật một thẻ gồm: giờ, dịch vụ phụ tick, nơi làm, di chuyển, cộng tiền.
- Tổng luôn hiện ở đáy.
- Trên điện thoại, bảng giá mở thành ngăn kéo từ dưới lên.

**Yếu**
- Màn máy tính bảng hơi chật ở cột trái (320 px).
- Có ít gói thì danh sách bảng giá chừa khoảng trống phía dưới.

**Hợp với:** cả ba nhóm khách (thợ cá nhân, đội, trung tâm).

**Rủi ro:** thẻ nhân vật dài khi có 5–6 nhân vật. Chặng 2 cần nút thu gọn thẻ.

### So sánh ngắn

| | A | B | C |
|---|---|---|---|
| Nhóm bảng giá | Tab trên | Mục trái | Menu con bên trái (điện thoại: 4 nút chuyển) |
| Mở chi tiết gói | Ngăn kéo phải | Trang riêng | Hộp thoại (điện thoại: toàn màn) |
| Hợp đồng | Một trang hoá đơn | 4 bước | Hai cột: bảng giá + hợp đồng |
| Thêm gói vào hợp đồng | Nút "+ Thêm gói" rồi chọn | Chọn nhân vật rồi chọn gói | Bấm thẳng vào giá trong bảng giá |
| Tổng tiền | Thanh dính đáy | Thẻ "Tạm tính" bên phải + thanh đáy | Thanh dính đáy |
| Điện thoại | Đổi dạng thẻ | Hợp nhất | Ngăn kéo chọn từ dưới lên |

## 7. Đã đổi gì sau khi anh bác ("Rối quá…")

Ảnh trước, giữ nguyên để đối chiếu: /home/user/a/docs/rnd/anh/v2-truoc-khi-bac/

| Trước (anh bác) | Sau |
|---|---|
| Bảng "Gói theo nhân vật" **10 cột**: 3 cột ô tick địa điểm, thời lượng, số thợ, niêm yết, giá bán, cọc… | Danh sách chỉ có **tên gói · nơi làm (chữ ngắn, mờ) · giá bán**. Mọi thứ khác nằm trong chi tiết gói. |
| Mỗi gói thêm 2 dòng "Đã gồm" và "Cho tick" với **dãy ô tick** | Danh sách **không còn ô tick nào**. Ô tick chỉ có trong chi tiết gói, và tick được thật. |
| Dịch vụ phụ, Phụ phí, Phí di chuyển, Studio **dồn một trang dài** | Tách 4 nhóm: Gói theo nhân vật · Dịch vụ phụ & phụ phí · Phí di chuyển & studio · Nhân vật |
| Sửa gói lẫn trong danh sách | Chi tiết gói chia 5 nhóm có tiêu đề: **Thông tin & giá · Địa điểm cho phép · Đã gồm trong gói · Dịch vụ phụ cho tick · Tiền công thợ theo bậc**. Mỗi dòng = nhãn + điều khiển; giải thích nằm trong dấu ?. |
| Chưa có tiền công thợ | Nhóm **Tiền công thợ theo bậc**: tên bậc, chồng ảnh đại diện (chữ viết tắt khi chưa có ảnh), tên thợ, ô tiền. Ô trống ghi "Chưa đặt" = `amount: null`. |

Đối chiếu trước/sau:
- Phương án A:
  - trước: /home/user/a/docs/rnd/anh/v2-truoc-khi-bac/v2-phuong-an-A-bang-gia-desktop.png
  - sau: /home/user/a/docs/rnd/anh/v2-phuong-an-A-bang-gia-desktop.png
- Phương án B:
  - trước: /home/user/a/docs/rnd/anh/v2-truoc-khi-bac/v2-phuong-an-B-bang-gia-desktop.png
  - sau: /home/user/a/docs/rnd/anh/v2-phuong-an-B-bang-gia-desktop.png
  - chi tiết sau: /home/user/a/docs/rnd/anh/v2-phuong-an-B-bang-gia-chi-tiet-goi-desktop.png
- Phương án C:
  - trước: /home/user/a/docs/rnd/anh/v2-truoc-khi-bac/v2-phuong-an-C-bang-gia-desktop.png
  - sau: /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-desktop.png
  - chi tiết sau: /home/user/a/docs/rnd/anh/v2-phuong-an-C-bang-gia-chi-tiet-goi-desktop.png

**Lập hợp đồng soát lại theo cùng tiêu chí "không rối"**
- A: bỏ chữ "Dịch vụ phụ / Phụ phí" lặp ở mỗi dòng; bỏ 3 dòng "+ Phụ phí cho gói này".
- B: bước 3 bỏ danh sách 3 phụ phí lặp lại ở mỗi nhân vật; phụ phí gom về một khối.
- C: bỏ dòng chữ hướng dẫn trên đầu; bỏ dòng "Phụ phí" trong từng thẻ nhân vật.

**Chỗ vỡ R&D tự thấy khi mở ảnh và đã sửa trong vòng này**
- Thanh tổng tiền dính đè giữa ảnh chụp dài: đổi cách chụp.
- Thanh bên trái bị cụt khi trang dài: đổi cấu trúc khung.
- Tên khách dài bị cắt trong ô nhập: đổi thành thẻ khách, tên được xuống dòng.
- Nút "Xác nhận hợp đồng" tràn mép trên điện thoại: thanh đáy chỉ còn nút chính.
- Nhãn "Cách tính mặc định" bị nút chọn đè: trên điện thoại xếp nhãn trên, nút dưới.
- Ô chọn studio bị cắt địa chỉ: tên trong ô chọn, địa chỉ ghi dòng dưới.
- Chữ "phút" dính số trong ô thời lượng.
- Tiêu đề lưới lịch C trên điện thoại đè hàng Thứ Hai.

## 8. Lịch C làm mặc định trên điện thoại 390 px

Ảnh: /home/user/a/docs/rnd/anh/v2-lich-C-mobile.png — tệp mẫu /home/user/a/docs/rnd/v2-lich-C-mobile.html

**Vấn đề vòng 1:** lưới "hàng = thợ, cột = 7 ngày" phải vuốt ngang, mỗi màn chỉ thấy 2 ngày, còn hé mép cột Thứ Sáu.

**Đề xuất: giữ đúng ý "thợ × ngày" nhưng xoay trục trên điện thoại**
1. **Hàng = 7 ngày** (dọc, cuộn tự nhiên); **cột = thợ**. 4 thợ và cột "Chưa có thợ" vừa khít 390 px, không vuốt ngang. Mỗi ô ghi giờ bắt đầu, màu theo loại ca; tối đa 3 ca, thừa thì "+n".
2. **Ngày đang chọn tô nền.** Bên dưới lưới hiện danh sách ca của ngày đó (kiểu chế độ B), 4 ca đầu và "Xem cả ngày (11 ca)". Tên khách dài hiện đủ.
3. **Thanh chuyển chế độ:** Tuần (C, mặc định) · Ngày (B) · Cột thợ (A).
4. **Trên 5 thợ:** chỉ phần cột thợ cuộn ngang, dừng đúng mép cột (không hé nửa cột), cột ngày đứng yên.
5. **Cảnh báo trùng:** nhãn đỏ "1 trùng" cạnh tuần; ô có ca trùng viền đỏ. Xem lưu ý ở mục 9.

## 9. Đề xuất trường mới (không vẽ lên màn, chờ anh và đội máy chủ quyết)

| # | Đề xuất | Lý do |
|---|---|---|
| 1 | Một dòng phí di chuyển dùng chung cho **nhiều dòng cùng địa chỉ** (ví dụ cô dâu và mẹ cô dâu cùng làm tại nhà gái) | Luật hiện tại: mỗi dòng tại nhà phải có phí di chuyển riêng, nên đi một chuyến bị tính hai lần. Phải nhập tay 0 ₫ cho dòng thứ hai. |
| 2 | `ServicePackage.includedKm` — gói tự gánh vài km đầu | Studio Pro có "Gói hỗ trợ X km". Hiện chỉ có `freeKm` chung cho cả tổ chức. |
| 3 | Gắn phụ phí vào một nhân vật/dòng (cho `SURCHARGE` có `parentLineId`) | Hiện phụ phí là dòng riêng, phải ghi chú tay "Cô dâu bắt đầu 04:30". |
| 4 | Sổ thu tiền: đã thu cọc, còn lại, phương thức | Hợp đồng chỉ có `depositRequired`. Chưa có chỗ ghi "đã nhận cọc". PRD đã xếp vào module Tài chính. |
| 5 | `GET /appointments` trả thêm `displayName`, `avatarUrl`, `initials` của thợ (như `pay-rates`) | Lịch C cần ảnh hoặc chữ viết tắt của thợ. Hiện lịch chỉ trả `fullName`, phải ghép thêm từ `GET /staff`. |
| 6 | Kiểm trùng lịch: máy chủ **chặn hẳn** (409 CONFLICT, kèm danh sách ca trùng) chứ không lưu ca trùng | Màn lịch sẽ không bao giờ có hai ca chồng nhau đã lưu. Cảnh báo trùng xảy ra **lúc tạo/dời ca**: hiện hộp báo với ca bị trùng và nút đổi thợ. Ô đỏ trên lưới chỉ dùng cho ca đang kéo hoặc đang tạo. Đây không phải trường mới mà là chỗ bản mẫu vòng 1 cần hiểu lại; ghi để anh biết. |
| 7 | `newCustomer` khi lập hợp đồng chỉ nhận `fullName`, `phone` | Muốn ghi email hay ghi chú khách ngay lúc tư vấn thì cần mở rộng. Bản mẫu chỉ vẽ Họ tên + SĐT. |

## 10. Chưa làm được / chưa khảo sát được

- **Fresha, Vagaro:** vẫn không mở được, lý do như vòng 1 (proxy chặn 403, WebFetch lỗi DNS). Vòng này không thêm nguồn từ hai app đó.
- **Studio Pro:**
  - Không chọn được "Gói Combo" trong form tạo hợp đồng: ô "Gói/Sản phẩm" trống khi chọn thể loại "Cưới Studio" với dữ liệu mẫu. R&D chỉ chụp được luồng "Dịch vụ lẻ".
  - Không bấm "Tạo Hợp Đồng", vì không có máy chủ thật để lưu.
- **Đường `quote`:** chưa gọi thật, vì chưa chạy máy chủ cùng cơ sở dữ liệu. Số liệu trong bản mẫu là R&D tự tính theo đúng công thức trong /home/user/a/packages/shared/src/contract.ts: km × 2 chiều − `freeKm`, nhân `perKmAmount`, làm tròn lên bội 1.000 ₫, không thấp hơn `minimumAmount`. Bản nháp đầu vòng này trừ km miễn phí trước khi nhân 2 chiều (ra 187.000 ₫); đã sửa thành 217.000 ₫.
- **Ảnh đại diện thật của thợ:** không có ảnh (không tải được ảnh từ mạng), nên bản mẫu dùng chữ viết tắt. Đúng với luật "trống → chữ viết tắt" của `StaffProfile.avatarUrl`.
- **Máy tính bảng:** chưa chụp màn chi tiết gói của A và B; chỉ có C (…-chi-tiet-goi-tablet.png).

## 11. Bổ sung 18/10/2026 — Thợ phụ trách trong hợp đồng

**Câu hỏi của anh**
- "Chỗ này không gán cho nhân sự phụ trách hả?"
- "Và có cảnh báo nếu trùng giờ hoặc có lịch trong ngày hôm đó".

**Đã thêm vào bản mẫu C** (/home/user/a/docs/rnd/v2-phuong-an-C.html)
- **Hàng "Thợ phụ trách"** trong mỗi thẻ nhân vật, ngay dưới hàng "Giờ":
  - chồng ảnh đại diện, thợ chính có viền màu;
  - tên thợ;
  - nút "Đổi".
- **Dải cảnh báo trong thẻ:**
  - đỏ "Trùng giờ 05:00–06:30 — hợp đồng sẽ không xác nhận được";
  - vàng "Hà có lịch trong ngày · 1 ca";
  - chi tiết giờ nằm trong tooltip;
  - còn trùng giờ thì nút "Xác nhận hợp đồng" khoá.
- **Ô chọn thợ** (máy tính: hộp thoại; điện thoại: ngăn kéo từ dưới lên):
  - thợ xếp theo bậc;
  - mỗi thợ có nhãn: không nhãn (rảnh) / vàng "Có lịch trong ngày · n ca" (bấm mở xem giờ) / đỏ "Trùng giờ …" / xám "Giữ chỗ nháp";
  - thợ tắt nhận lịch thì mờ, không chọn được;
  - người được chọn có nút chuyển Chính / Phụ.
- **Hợp đồng đã xác nhận:** hàng thợ chỉ xem, có liên kết "Đổi ở Lịch".

**Ảnh**
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-tablet.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-chon-tho-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-chon-tho-mobile.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-xac-nhan-desktop.png
- /home/user/a/docs/rnd/anh/v2-phuong-an-C-hop-dong-xac-nhan-mobile.png

**Nguồn dữ liệu**
- Vẽ theo đặc tả điều phối: `lines[].staff[{membershipId, role}]`, `GET /orgs/:orgId/staff/availability`, `quote.staffWarnings`, và xác nhận trùng giờ → 409.
- **Lúc vẽ, mã máy chủ chưa có các đường và trường này.** Bản vẽ /home/user/a/docs/rnd/BAN-VE-C.md mục 4.3 đã ghi rõ để đối chiếu lại khi máy chủ xong.

**Còn mở:** hai bản mẫu A và B chưa thêm hàng thợ, vì anh đã chọn C.
