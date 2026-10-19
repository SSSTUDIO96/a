# Báo cáo R&D 07: Nền và viền có hoa văn chìm cho mẫu thẻ

- Sản phẩm: Makeup Pro, phần Thiết kế thẻ (chào mừng / feedback / lời chúc)
- Người đọc: anh Chiến
- Ngày: 19/10/2026
- Chặng: 1 (trả lời, 3 phương án, ảnh thật)
- Câu anh hỏi (nguyên văn): *"Nền viền có thể dùng bằng ảnh khác có hoa văn họa tiết chìm được không?"*
- Anh dặn thêm cùng ngày: *"Tôi muốn khung ảnh mặc định để hình tròn và có 1 mẫu để dạng viên thuốc"*, *"Mẫu nào cũng phải có ảnh nhé"*. Mọi ảnh trong báo cáo này đều đã có ô ảnh học viên, khung tròn. Ảnh `pa1-la-canh-vien-thuoc.png` dùng khung viên thuốc.

---

## 1. Trả lời ngắn

**Được.** R&D đã làm thử trên đúng mẫu anh gửi (shd-01 "Thư mời kem": nền kem, viền vàng hai đường, logo chữ M). Có ba cách làm. Cả ba đều xuất ra ảnh PNG 1080×1350 thật, qua đúng bộ xuất ảnh app đang dùng. Trên mọi ảnh, chữ vẫn đọc rõ: **mọi dòng chữ đạt tương phản ≥ 4,5:1, có đo bằng máy, số ở mục 6**. Họa tiết **không đè lên ảnh, không đè lên tên chữ ký**.

| | Phương án | Một câu |
|---|---|---|
| **1** | Thư viện họa tiết dựng sẵn | App có sẵn 6 họa tiết chìm (damask, ren, lá cành, sóng nước, mây, hồi văn). Studio chọn trong ô **"Nền"**, có 3 nấc đậm nhạt. |
| **2** | Ảnh nền của studio | Studio tải **ảnh của mình** lên một lần, cả tổ chức dùng chung. App tự làm chìm, tự khoét chỗ ảnh và chữ ký, tự hạ độ đậm nếu chữ chưa đủ rõ. |
| **3** | Khung trang trí thay viền | Thay hai đường viền vàng bằng **khung hoa văn**: góc hoa hồng, ren răng cưa, hồi văn. Nền giữa vẫn trơn. |

**R&D đề xuất:** làm **1 + 2 chung một bộ máy**: ô "Nền" có 6 họa tiết dựng sẵn và một ô cuối "Ảnh của tôi". Phương án 3 để sau, chỉ áp cho vài mẫu có viền. Lý do ở mục 9.

## 2. Ảnh nên cho anh xem đầu tiên

1. **/home/user/a/docs/rnd/anh-rnd07/pa1-damask.png**: đúng tấm thẻ anh gửi, thêm ảnh tròn, nền damask chìm. Anh nhìn là biết "được" trông ra sao.
2. **/home/user/a/docs/rnd/anh-rnd07/pa2-truoc-sau.png**: trả lời đúng chữ "dùng bằng ảnh khác". Bên trái là ảnh tải lên, bên phải là thẻ app tự làm ra.
3. **/home/user/a/docs/rnd/anh-rnd07/pa3-goc-hoa.png**: hướng "viền" bằng ảnh hoa.
4. **/home/user/a/docs/rnd/anh-rnd07/pa1-la-canh-vien-thuoc.png**: khung ảnh viên thuốc trên nền hoa văn, theo lời anh dặn.

## 3. Mẫu thử

- **Mẫu gốc:** `apps/web/public/mau/shd-01.html` (mã `shd-01`, tên "Thư mời kem" trong `packages/shared/src/design-templates.ts`). Nền `#F5EFE4`, viền `#B8975A` hai đường (1,5 px và 0,75 px), logo vòng tròn chữ M, chữ ký phông "MP Viết tay 1".
- **Bản thử R&D:** `/home/user/a/docs/rnd/v7-nen-hoa-van/shd-01-hv.html`. Chữ, màu, phông và viền giữ nguyên như shd-01. Có thêm hai thứ:
  - **ô ảnh học viên khung tròn** (264 px, viền vàng mảnh cách 8 px, nhắc lại hai đường viền của thẻ). Tham số `?khunganh=vien-thuoc` đổi sang khung viên thuốc 214×318 px;
  - **lớp nền/viền thay thế** (`chung/nen.js` và `chung/hoa-van.js`).
- Nội dung đúng như ảnh anh gửi: *CHÀO MỪNG ĐẾN VỚI LỚP / MAKEUP CHUYÊN NGHIỆP / Lớp K12 · khai giảng 02.11.2026 / Thân gửi / Tôn Nữ Hoàng Bảo Ngọc Phương Thảo / Thân ái, Chiến Makeup Academy / THÁNG 11 · 2026 / 25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội*. Tên dài nhất này được cố ý giữ để thử chỗ chật nhất.
- Ảnh chân dung thử là `anh-hoc-vien.svg` có sẵn trong bộ mẫu (R&D tự vẽ, vòng 3).
- Thợ K3 đang sửa mẫu thật trong `public/mau` theo lời dặn "ảnh tròn". R&D **không đụng** vào đó, bản này chỉ để chụp ảnh và làm bản tham khảo bố cục.

Ảnh gốc để so: **/home/user/a/docs/rnd/anh-rnd07/00-mau-goc-shd01-anh-tron.png** (shd-01 thêm ảnh tròn, nền trơn, màu chữ cũ).

## 4. Ba phương án

### Phương án 1: Thư viện họa tiết dựng sẵn (chọn trong ô "Nền")

**Ảnh (PNG 1080×1350 thật):**

| Ảnh | Họa tiết | Độ đậm |
|---|---|---|
| /home/user/a/docs/rnd/anh-rnd07/pa1-damask.png | Damask cổ điển | 0,16 |
| /home/user/a/docs/rnd/anh-rnd07/pa1-ren.png | Ren lưới hoa | 0,13 |
| /home/user/a/docs/rnd/anh-rnd07/pa1-la-canh-vien-thuoc.png | Lá cành nét mảnh, **ảnh khung viên thuốc** | 0,20 |
| /home/user/a/docs/rnd/anh-rnd07/pa1-song-nuoc.png | Sóng nước Á Đông | 0,14 |
| /home/user/a/docs/rnd/anh-rnd07/pa1-may.png | Mây lành | 0,20 |
| /home/user/a/docs/rnd/anh-rnd07/pa1-bang-chon-nen.png | **Bảng chọn ô "Nền"** (mô phỏng màn chọn: Trơn + 6 họa tiết + "Ảnh của tôi", thanh 3 nấc) | |

**Cách chạy:**
- Họa tiết là hình vẽ bằng mã (SVG) do R&D viết, nằm trong `chung/hoa-van.js`. Mỗi họa tiết là một ô nhỏ, lặp ra kín thẻ, tô bằng màu vàng của chính mẫu (`#B8975A`). Độ đậm chỉ có **3 nấc cố định**: Nhạt 0,10, Vừa 0,13–0,20 tuỳ họa tiết, Đậm 0,24. Không có thanh kéo tự do.
- **Vùng an toàn**: phần tử nào gắn `data-an-toan` thì họa tiết được khoét sạch quanh nó, mép mờ dần. Áp cho ảnh học viên (cách 34 px), tên chữ ký (30 px) và chữ nhỏ dưới 24 px (14 px). Nhìn ảnh sẽ thấy quanh ảnh và quanh tên có "khoảng thở" sạch.
- Vì là hình vẽ bằng mã nên rất nhẹ, nét sắc ở mọi khổ (1080×1350 hay 1080×1080), đổi màu theo mẫu được (ví dụ mẫu đen vàng shd-02 thì vẽ họa tiết vàng trên đen).

**Ưu:**
- An toàn nhất: R&D đo trước từng họa tiết ở từng nấc, studio không thể làm hỏng thẻ.
- Không tốn chỗ lưu, không cần tải ảnh lên.
- Đổi màu theo từng mẫu.
- Không vướng bản quyền (R&D tự vẽ).

**Nhược:**
- Chỉ có những gì app có sẵn. Studio nào muốn "đúng hoa văn của mình" thì không được, phải dùng phương án 2.
- Họa tiết R&D vẽ ở mức "dùng được". Muốn sang như thiệp in thật thì nên có một người vẽ chỉnh nét 1 buổi.
- **Hồi văn làm nền phủ kín thì quá rối** (đã thử, không đưa vào ảnh). Hồi văn hợp làm khung hơn (phương án 3).

**Công sức:** khoảng **4–5 buổi** (1 buổi ≈ 4 giờ làm):

| Việc | Buổi |
|---|---|
| Đưa `hoa-van.js` và `nen.js` vào `public/mau/chung`, thêm tham số `?nen=&dam=` (đã có bản chạy được) | 1 |
| Ô "Nền" trong màn tạo thẻ (CardForm), xem trước, lưu lựa chọn | 1 |
| Máy chủ: trường mới, kiểm mã họa tiết bằng danh mục ở `packages/shared` (như `FONT_OVERRIDES`) | 0,5 |
| Gắn `data-an-toan` cho 26 mẫu, chạy bộ đo tự động trên cả 26 mẫu × 6 họa tiết × 2 khổ | 1,5–2 |
| (Nên có) người vẽ chỉnh nét họa tiết | 1 |

### Phương án 2: Studio tự tải ảnh nền lên (một lần cho cả tổ chức)

**Ảnh:**

| Ảnh | Nội dung |
|---|---|
| /home/user/a/docs/rnd/anh-rnd07/pa2-truoc-sau.png | **Trước → sau**: hai ảnh tải lên, bên cạnh là thẻ app tự làm |
| /home/user/a/docs/rnd/anh-rnd07/pa2-hoa-mau-nuoc.png | Ảnh tải lên là tranh hoa màu nước rực, được làm chìm ở độ đậm 0,24 |
| /home/user/a/docs/rnd/anh-rnd07/pa2-vai-ren.png | Ảnh tải lên là vải ren trắng trên nền be. App **tự đảo chiều** (ren trắng thành nét chìm), độ đậm 0,24 |
| /home/user/a/docs/rnd/anh-rnd07/pa2-vai-ren-doi-dam.png | **Ảnh cảnh báo**: studio đòi đậm 0,5, app tự hạ xuống 0,36 cho chữ đạt chuẩn. Chữ vẫn rõ nhưng quầng sáng quanh chữ thành **loang lổ**. Vì vậy nên khoá tối đa ở nấc "Đậm" 0,24 |

Hai ảnh "tải lên" là **ảnh giả lập do R&D tự vẽ** (`v7-nen-hoa-van/anh-tai-len-gia-lap/`). R&D không dùng ảnh mạng không rõ quyền. Chúng được chọn là hai loại ảnh khó: một ảnh rực màu nhiều chi tiết, một ảnh tương phản cao.

**Cách chạy** (trong `chung/nen.js`, hàm `veAnhNen`, chạy trên trình duyệt bằng canvas):
1. Phủ kín khổ thẻ (cắt giữa), làm mềm 1,5 px cho hết sạn ảnh chụp.
2. Bỏ màu, chỉ giữ độ sáng. Tự cân sáng (2%–98%). Nếu phần "đậm" chiếm quá nửa ảnh thì tự đảo chiều (ảnh ren trắng trên vải tối).
3. Tô lại bằng **hai màu của mẫu**: nền kem đi dần sang nâu vàng, tối đa 24% quãng đường giữa hai màu. Nhờ vậy ảnh hoa đỏ hồng vẫn ra tông kem vàng hợp mẫu.
4. Khoét vùng an toàn như phương án 1.
5. **Tự đo tương phản dưới từng dòng chữ.** Dòng nào chưa đạt 4,5:1 thì hạ độ đậm 15% và làm lại, tối đa 12 lần.

**Ưu:**
- Đúng câu anh hỏi: dùng **ảnh khác**, ảnh của chính studio (vải ren váy cưới, hoa văn thiệp của studio, ảnh hoa…).
- Mỗi studio có nền riêng không trùng ai.
- Tải một lần, mọi mẫu dùng chung. Mỗi mẫu tô theo màu của nó.
- Có lưới an toàn tự động nên ảnh xấu đến đâu chữ vẫn rõ.

**Nhược:**
- Kết quả phụ thuộc ảnh: ảnh mờ hoặc chi tiết to quá thì ra "vết loang" chứ không ra "hoa văn" (ảnh hoa màu nước đã hơi như vậy).
- Cần chỗ lưu ảnh và màn cài đặt.
- Bản quyền ảnh là việc của studio. Cần một dòng cam kết khi tải lên: "Ảnh này tôi có quyền dùng".
- Ảnh phải đi qua đường "tải về thành blob rồi đưa vào tệp vẽ" như logo đang đi (`logoUrl` → `useBlobUrl` → tham số đường dẫn). Nếu không, html-to-image không nhúng được ảnh khi xuất.
- Nền ảnh tối và mẫu đen vàng (shd-02, fb-05, lc-02) chưa thử.

**Công sức:** khoảng **4 buổi nếu làm sau phương án 1** (dùng chung vùng an toàn, ô "Nền", bộ đo); làm riêng thì khoảng 5–6 buổi:

| Việc | Buổi |
|---|---|
| Tải lên và lưu (dùng lại luồng tải logo của Hồ sơ thương hiệu), trường mới, loại tệp mới | 1 |
| Xử lý ảnh, tự đo và hạ độ đậm (đã có bản chạy được), đưa vào app, thử với mẫu nền tối | 1 |
| Màn cài đặt "Ảnh nền thẻ" trong Hồ sơ thương hiệu: xem trước trên 3 mẫu, nấc đậm | 1 |
| Thử 26 mẫu với 5–6 ảnh thật của studio, chỉnh ngưỡng | 1 |

### Phương án 3: Khung trang trí bằng ảnh thay hai đường viền

**Ảnh:**

| Ảnh | Khung |
|---|---|
| /home/user/a/docs/rnd/anh-rnd07/pa3-goc-hoa.png | Góc hoa hồng nét vàng, cánh hồng phấn nhạt, giữ một đường viền mảnh |
| /home/user/a/docs/rnd/anh-rnd07/pa3-khung-ren.png | Ren răng cưa chạy quanh thẻ, góc là bông ren |
| /home/user/a/docs/rnd/anh-rnd07/pa3-hoi-van.png | Dải hồi văn kiểu khung tranh Á Đông |
| /home/user/a/docs/rnd/anh-rnd07/pa3-goc-hoa-vuong.png | Góc hoa ở **khổ vuông 1080×1080**: khung tự co theo khổ, góc giữ nguyên, cạnh tự dài ra |

**Cách chạy:** khung được vẽ theo đúng khổ thẻ (`KHUNG` trong `chung/hoa-van.js`), nằm dưới lớp chữ. Góc giữ nguyên, cạnh chia đều số "răng" và số ô hồi văn nên cạnh nào cũng tròn ô, không bị cắt dở. Nền giữa thẻ vẫn trơn, nên chữ và ảnh **giữ y nguyên độ rõ của mẫu gốc** (bảng đo ở mục 6).

**Ưu:**
- Đẹp ngay, đúng chất thiệp cưới. Không đụng vùng chữ nên không phải đo nhiều.
- Có thể ghép với phương án 1 (khung ren và nền lá cành).

**Nhược:**
- Chỉ hợp các mẫu có viền khung (shd-01, fb-04, lc-01… cần rà). Mẫu ảnh phủ kín như fb-08 thì không dùng được.
- Nếu cho studio **tải khung PNG của mình** thì phải có cách cắt "9 lát" (góc giữ, cạnh kéo dài). Khung tải lên lại hay có góc to lấn vào chữ, phải đo từng cái. Việc này tốn hơn nhiều so với khung dựng sẵn.

**Công sức:** khung dựng sẵn **2–3 buổi** (3 khung đã vẽ; thêm trường, ô chọn, rà mẫu nào dùng được). Khung do studio tải lên tốn **thêm 2–3 buổi**.

## 5. So sánh nhanh

| | PA1 Thư viện | PA2 Ảnh studio | PA3 Khung |
|---|---|---|---|
| Đúng câu "dùng bằng ảnh khác" | Một phần (ảnh có sẵn) | **Đúng nhất** | Đúng phần "viền" |
| Chữ luôn rõ | Có (đo trước) | Có (tự đo khi vẽ) | Có (không đụng vùng chữ) |
| Studio làm hỏng thẻ được không | Không | Khó (có lưới an toàn) | Không (dựng sẵn) |
| Cần lưu ảnh | Không | Có | Không (dựng sẵn) |
| Công sức | 4–5 buổi | 4 buổi sau PA1 | 2–3 buổi |

## 6. Đo độ rõ của chữ (tương phản)

**Cách đo:** mỗi ảnh được xuất **hai lần** bằng `window.MAU_XUAT_PNG()` (html-to-image 1.11.13, đúng đường app xuất ảnh). Lần 1 là ảnh nộp. Lần 2 cho chữ trong suốt, bố cục giữ y nguyên, để thấy nền dưới chữ. Trong khung bao sát từng dòng chữ, máy tính tỉ lệ tương phản (công thức WCAG 2) giữa màu chữ và **từng điểm ảnh nền**. Số ghi là **điểm tệ nhất (1% điểm ảnh tệ nhất)**, không phải trung bình.

**Ngưỡng:** "chuẩn nhà" là **mọi dòng chữ ≥ 4,5:1**. Chuẩn này khắt khe hơn WCAG AA, vì WCAG chỉ đòi 3:1 cho chữ lớn. Bộ đo và kết quả đầy đủ nằm ở `/home/user/a/docs/rnd/v7-nen-hoa-van/do-kiem/` (`ket-qua.json`).

| Ảnh | Chữ nhỏ tệ nhất (≥ 4,5) | Chữ lớn tệ nhất (≥ 4,5) | Tên chữ ký | Vùng chữ ký: lệch màu tối đa / 99% điểm | Vòng 3–24 px quanh ảnh: lệch tối đa |
|---|---|---|---|---|---|
| 00 gốc, màu chữ cũ | **3,63 ✗** (dòng "Chào mừng đến với lớp") | 7,02 | 13,38 | 0 / 0 | 0 |
| gốc, màu chữ nhỏ đã sửa | 4,98 | 7,02 | 13,38 | 0 / 0 | 0 |
| pa1 damask | 4,98 | 6,14 | 13,38 | 7 / 0 | 6 |
| pa1 ren | 4,98 | 6,30 | 13,38 | 8 / 0 | 5 |
| pa1 lá cành + viên thuốc | 4,98 | 5,98 | 13,38 | 5 / 0 | 5 |
| pa1 sóng nước | 4,98 | 6,26 | 13,38 | 8 / 0 | 5 |
| pa1 mây | 4,98 | 5,99 | 13,38 | 6 / 0 | 7 |
| pa2 hoa màu nước (0,24) | 4,98 | 5,59 | 13,38 | 6 / 0 | 9 |
| pa2 vải ren (0,24) | 4,98 | 5,38 | 13,37 | 8 / 1 | 9 |
| pa2 vải ren, đòi 0,5 → tự hạ 0,36 | 4,98 | 4,66 | 13,28 | 12 / 1 | 14 |
| pa2 hoa, đòi 0,5 → tự hạ 0,43 | 4,98 | 4,64 | 13,38 | 10 / 0 | 15 |
| pa3 góc hoa, khung ren, hồi văn, góc hoa vuông | 4,98 | 7,02 | 13,38 | 0 / 0 | 0 |

Cách đọc cột "lệch màu" (thang 0–255 so với màu nền kem): 99% điểm ảnh trong vùng chữ ký lệch 0–1, tức **sạch hoàn toàn**. Vài điểm lệch 5–8 chỉ nằm ở mép ngoài khung bao, mắt thường không thấy. Vòng quanh ảnh cũng vậy. **Họa tiết không đè lên ảnh và chữ ký.**

**Phát hiện phụ (nên sửa ngay, không phụ thuộc phương án nào):** dòng nhỏ "CHÀO MỪNG ĐẾN VỚI LỚP" của shd-01 **hiện nay** màu `#8C7A5B` trên nền kem chỉ đạt **3,63:1**, dưới chuẩn, ngay cả khi chưa có hoa văn. Đổi sang `#7A6340` (cùng màu với dòng tên thương hiệu) thì đạt 4,98:1, nhìn gần như không khác. Đây là một dòng CSS trong `apps/web/public/mau/shd-01.html` (`.k1{… color:#8C7A5B …}`). Xin chuyển cho thợ K3 vì K3 đang sửa mẫu này. Lần đầu thử, dòng này cũng là dòng tụt dưới chuẩn khi phủ hoa văn. Vì vậy chữ nhỏ dưới 24 px giờ cũng được "lót nền sạch" 14 px.

## 7. Học từ đâu

- **Canva**: *chưa khảo sát trực tiếp được*. Máy chủ R&D không phân giải được tên miền canva.com. R&D chỉ đọc qua kết quả tìm kiếm và bài hướng dẫn bên thứ ba. Ghi nhận: Canva cho chọn nền từ thư viện hoặc dùng ảnh, chỉnh **Transparency** bằng thanh kéo tự do, và có **Brand Kit** (bản Pro) lưu màu, phông, logo cho cả thương hiệu. Nguồn: [thebudgetsavvybride.com — thiết kế thiệp cưới bằng Canva](https://thebudgetsavvybride.com/how-to-design-your-own-wedding-invitations-with-canva/), [brendacadman.com — Brand Kit cho wedding planner](https://brendacadman.com/canva-brand-kit-essentials-for-wedding-planners/), [trupeer.ai — làm nền trong suốt trong Canva](https://www.trupeer.ai/bg/tutorials/how-to-make-background-transparent-in-canva).
  - **Học được:** ý "một lần cho cả thương hiệu" (Brand Kit), từ đó ra phương án 2 lưu ở Hồ sơ thương hiệu.
  - **Làm khác:** Canva để người dùng kéo độ trong suốt tự do, nên rất dễ ra thẻ chữ chìm vào nền. Ta dùng 3 nấc, có vùng an toàn và tự đo.
- **Adobe Express**: *chưa khảo sát trực tiếp được* (helpx.adobe.com bị chặn). Theo kết quả tìm kiếm, ảnh có **Opacity** và **chế độ hoà trộn** (Multiply làm tối, Screen làm sáng) ở bảng thuộc tính. Cộng đồng có mẹo đặt nền ở chế độ Screen để làm nhạt. Nguồn: [adobe.com — Photo effects in Adobe Express](https://www.adobe.com/learn/express/web/photo-effects-express), [Adobe Community — Opacity slider and blend modes](https://community.adobe.com/t5/adobe-express-discussions/opacity-slider-and-blend-modes-is-gone/td-p/15187960).
  - **Học được:** "tô lại bằng hai màu" ở phương án 2 chính là phiên bản tự động của mẹo hoà trộn đó.
- **Thiệp cưới in (thiệp Việt và thiệp kiểu Âu)**: *suy luận từ hiểu biết chung, chưa khảo sát mẫu cụ thể*. Thiệp sang thường dùng hoa văn **cùng tông** (ép chìm, in nhũ nhạt) như damask, ren, lá cành, còn tên cô dâu chú rể nằm trên khoảng trống sạch. Viền thường là góc hoa hoặc ren răng cưa. Thiệp Á Đông dùng sóng nước, mây, hồi văn. Bộ 6 họa tiết và 3 khung chọn theo đúng nhóm này. Nguyên tắc "khoét sạch chỗ tên" cũng học từ đây.
- **Chuẩn đo tương phản**: công thức tỉ lệ tương phản WCAG 2.x (W3C), ngưỡng AA 4,5:1.

## 8. Nguồn họa tiết và giấy phép

- **Tất cả 6 họa tiết và 3 khung do R&D tự vẽ bằng mã SVG** trong `/home/user/a/docs/rnd/v7-nen-hoa-van/chung/hoa-van.js`. Không lấy ảnh hay mẫu nào trên mạng, nên studio dùng thương mại không vướng gì.
- Hai ảnh "studio tải lên" là ảnh giả lập R&D tự vẽ: `anh-tai-len-gia-lap/ve-anh-gia-lap.html` dựng bằng SVG rồi chụp ra JPG.
- Phông chữ: giữ bộ phông tạm của vòng 3 (Google Fonts, SIL OFL 1.1, giấy phép nằm cạnh tệp ở `v3-mau-chao-mung/phong/`). Bộ xuất ảnh: html-to-image 1.11.13 (MIT, có sẵn trong app).
- R&D không tải gì từ ngoài về. Không cần, vì tự vẽ đủ.

## 9. Đề xuất R&D

1. **Làm phương án 1 trước, phương án 2 ngay sau, chung một bộ máy** (`nen.js`: vùng an toàn, tự đo, 3 nấc). Trên màn, cả hai nằm trong **cùng một ô "Nền"** như ảnh `pa1-bang-chon-nen.png`: Trơn, 6 họa tiết, và ô cuối "Ảnh của tôi". Tổng khoảng **8–9 buổi**.
   - Phương án 1 là lưới an toàn, đẹp đều.
   - Phương án 2 trả lời đúng câu anh hỏi và làm studio khác biệt.
2. **Khoá độ đậm tối đa 0,24**, kể cả với ảnh studio. Ảnh `pa2-vai-ren-doi-dam.png` cho thấy đậm hơn thì chữ vẫn đạt chuẩn nhưng quầng sáng quanh chữ thành loang lổ, xấu.
3. **Phương án 3 để vòng sau**. Chỉ làm khung **dựng sẵn** (góc hoa, ren) cho vài mẫu có viền. Chưa cho tải khung PNG.
4. **Sửa ngay màu dòng chữ nhỏ của shd-01** (mục 6), không cần chờ phương án nào.
5. **Bỏ hồi văn khỏi danh sách nền**, chỉ giữ làm khung. Còn 5 họa tiết nền.
6. Việc **chặng 2** (nếu anh duyệt):
   - bản vẽ thông số ô "Nền" và màn "Ảnh nền thẻ";
   - rà 26 mẫu xem mẫu nào áp được nền hay khung;
   - thử mẫu nền tối (shd-02, fb-05, lc-02);
   - xin 5–6 ảnh thật của studio anh (vải ren, thiệp cũ) để thử phương án 2 thay cho ảnh giả lập.

### Đề xuất trường mới

Đã đọc `apps/api/prisma/schema.prisma`: `OrganizationProfile` (đang có `logoFileId`, `avatarFileId`, `coverFileId`), `DesignCard` (đang có `fontOverride`, `snapshot`), enum `FilePurpose`.

| Bảng | Trường đề xuất | Kiểu | Dùng cho | Ghi chú |
|---|---|---|---|---|
| `DesignCard` | `backgroundStyle` → `background_style` | `String?` | PA1 và PA2 | `null` = trơn; `"hv:damask:vua"`; `"anh-to-chuc:vua"`. Kiểm bằng danh mục ở `packages/shared` như `FONT_OVERRIDES`. |
| `DesignCard` | `backgroundFileId` → `background_file_id` | `String? @db.Uuid` | PA2 | Ảnh nền **đúng lúc xuất**, khoá ngoại kép (tệp, tổ chức) như `outputFileId`. Studio đổi ảnh nền sau này thì thẻ cũ tải lại vẫn y như cũ. |
| `DesignCard` | `frameStyle` → `frame_style` | `String?` | PA3 | `"goc-hoa"`, `"khung-ren"`, `"hoi-van"` |
| `DesignCard` | `photoShape` → `photo_shape` | `String?` | Lời dặn ảnh tròn / viên thuốc | `null` = tròn (mặc định), `"vien-thuoc"`. **Cần thống nhất với K3**, người đang sửa mẫu ảnh tròn. |
| `OrganizationProfile` | `cardBackgroundFileId` → `card_background_file_id` | `String? @db.Uuid` | PA2 | Ảnh nền thẻ của tổ chức (bản gốc). Quan hệ `"ProfileCardBackground"` với `StoredFile`, khoá ngoại kép như `logoFileId`. |
| `OrganizationProfile` | `cardBackgroundLevel` → `card_background_level` | `String?` | PA2 | Nấc mặc định `"nhat"`, `"vua"`, `"dam"` |
| `StoredFile` | `profileCardBackgrounds` và `designCardBackgrounds` | quan hệ ngược | PA2 | Theo đúng kiểu `profileLogos` |
| enum `FilePurpose` | `DESIGN_BACKGROUND` | giá trị mới | PA2 | (PA3 khung tải lên, nếu làm: `DESIGN_FRAME`) |
| `packages/shared` | `BACKGROUND_STYLES`, `FRAME_STYLES`; `DesignTemplate.backgroundOk: boolean` | mã | PA1–3 | Mẫu ảnh phủ kín (ví dụ fb-08) đặt `false` |

API thiết kế cần trả thêm `cardBackgroundUrl` (đường dẫn có hạn) bên cạnh `logoUrl`, rồi web đi đúng đường `useBlobUrl` như logo. Phần xử lý làm chìm chạy trong tệp vẽ (canvas), máy chủ không phải vẽ gì.

## 10. Giới hạn của lần thử này

- Mới thử trên **một mẫu** (shd-01), khổ 1080×1350, và một ảnh khổ vuông (góc hoa). 25 mẫu còn lại, nhất là mẫu nền tối, chưa thử.
- Ảnh "studio tải lên" là ảnh giả lập. Ảnh chân dung là hình vector có sẵn, không phải ảnh chụp thật.
- Ba ảnh vượt 600 KB nên đã nén về 256 màu cho vừa giới hạn: `pa2-vai-ren.png`, `pa2-vai-ren-doi-dam.png`, `pa2-truoc-sau.png`. Mọi số đo đều lấy trên **bản PNG gốc chưa nén**, bản xuất từ app.
- Hai ảnh tổng hợp `pa1-bang-chon-nen.png` và `pa2-truoc-sau.png` là trang trình bày (chụp phần tử bằng Playwright), không phải thẻ. Mọi ảnh thẻ khác đều xuất bằng `MAU_XUAT_PNG` như app.
- Bố cục có ảnh tròn là bản R&D. Bản chính thức do K3 làm trong `public/mau`.

## 11. Đường dẫn

- Báo cáo: `/home/user/a/docs/rnd/BAO-CAO-RND-07-NEN-HOA-VAN.md`
- Ảnh (15 PNG, mỗi ảnh ≤ 600 KB): `/home/user/a/docs/rnd/anh-rnd07/`
- Bản mẫu: `/home/user/a/docs/rnd/v7-nen-hoa-van/`
  - Mục lục: `index.html`
  - Mẫu thử: `shd-01-hv.html` (tham số ghi ở đầu `chung/nen.js`)
  - Thư viện họa tiết và khung: `chung/hoa-van.js`
  - Bộ dựng lớp nền, vùng an toàn, tự đo: `chung/nen.js`
  - Bảng chọn và trang trước/sau: `bang-chon-nen.html`, `pa2-truoc-sau.html`
  - Bộ chụp và đo: `do-kiem/`
- **Cách xem:** html-to-image cần chạy qua http, không chạy được bằng file://. Đứng ở `/home/user/a/docs/rnd`, chạy `python3 -m http.server 8707`, rồi mở `http://127.0.0.1:8707/v7-nen-hoa-van/`.
- **Cách chụp lại:**
  1. Tạo một thư mục nháp có hai thư mục con `goc/` và `nen/`.
  2. Chạy `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node <đường dẫn>/do-kiem/chup.js <đường dẫn>/do-kiem/cau-hinh.json`.
  3. Chạy `python3 <đường dẫn>/do-kiem/do.py`.
