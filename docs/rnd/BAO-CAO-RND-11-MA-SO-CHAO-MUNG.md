# R&D-11 chặng 1 — Mã số học viên trên thẻ chào mừng

*26/10/2026 · Trung tâm R&D · viết cho anh Chiến đọc*

Anh yêu cầu ngày 19/10/2026: *"Thẻ chào mừng sẽ có mã số tương ứng để sau sắp xếp ghế hoặc vị trí"*. Sổ ý muốn (docs/SO-Y-MUON.md dòng 44) đã chốt: **mã số là dữ liệu của học viên trong lớp, thẻ chỉ in lại mã đó, sau này màn sắp ghế đọc cùng mã**. Việc tồn 55 (docs/VIEC-TON.md dòng 75) đã ghi 4 ý: tự cấp theo thứ tự ghi danh (01, 02…), sửa tay được, không trùng trong một lớp, thẻ chào mừng hiện mã.

Chặng 1 bày **3 phương án có ảnh thật** để anh chọn. Thông số chi tiết (tên cột, cách khoá, bài thử) để sang chặng 2, sau khi anh chọn.

**Đề xuất của R&D: Phương án A — số theo thứ tự ghi danh, giữ nguyên mãi.** Lý do bằng số ở mục 5.

---

## 1. Hiện trạng (tra trong mã nguồn)

**Học viên trong lớp lưu ở đâu.** Mỗi lần một học viên vào một lớp, app tạo một dòng trong bảng *Ghi danh* (`Enrollment`, apps/api/prisma/schema.prisma:1397–1431). Dòng này sinh ra **đúng lúc hợp đồng khoá học được xác nhận**; hợp đồng nháp chưa giữ chỗ (apps/api/src/modules/contracts/routes.ts:873, enroll.ts:1–2). Mỗi dòng ghi danh có giờ ghi danh (`enrolledAt`, schema.prisma:1406) và trạng thái *đang học / đã huỷ*.
- Một người chỉ có **một** ghi danh còn hiệu lực trong một lớp. Database tự chặn trường hợp trùng (migrations/20261018230000_dao_tao/migration.sql:446).
- Danh sách "Học viên lớp …" xếp theo giờ ghi danh (apps/api/src/modules/courses/service.ts:294). Màn hiện danh sách là apps/web/src/features/courses/EnrollmentsDialog.tsx:12–93; hiện **chưa có cột mã**.
- Hiện **chưa có trường mã số nào** (tìm `seatCode` / `seat_code` / `ma_so` trong apps và packages: 0 kết quả). Cần thêm một trường mới vào dòng ghi danh, ở cả 3 phương án.
- Lớp nhận tối đa **500** học viên (packages/shared/src/courses.ts:8), vậy mã có thể dài tới 3 chữ số.

**Thẻ chào mừng lấy dữ liệu từ đâu.** Mỗi ô trên thẻ (tên, khoá, lớp, ngày khai giảng…) có một "nguồn" khai ở một chỗ duy nhất: `SLOT_SOURCES`, packages/shared/src/design-templates.ts:25–56. **Chưa có ô mã số.** Máy chủ gom các giá trị này trong apps/api/src/modules/designs/data.ts:182–261.
- Lúc xuất ảnh, app **chụp lại** mọi giá trị thành một bản ghi cố định gọi là *snapshot*, nghĩa là "bản chụp giá trị lúc xuất", lưu ở schema.prisma:1517. Ảnh PNG đã xuất cũng lưu riêng (schema.prisma:1518).
- Khi sửa thẻ, app giữ giá trị cũ của bản chụp. App chỉ lấy lại dữ liệu mới khi người dùng đổi lớp (data.ts:161, 324–371).
- **Hệ quả cho mã số:** nếu mã của một học viên đổi sau khi thẻ đã xuất, ảnh cũ vẫn in số cũ. Trang học viên (cổng) cũng hiện đúng ảnh PNG cũ đó (apps/api/src/modules/portal/me.ts:135–148).

**Ô chọn mẫu đang liệt kê mẫu nào.** Ô chọn mẫu chào mừng đọc danh mục `DESIGN_TEMPLATES` (apps/web/src/features/designs/TemplateGrid.tsx:24–26, model.ts:56–69). Hiện có **11 mẫu**, shd-01 đến shd-11 (design-templates.ts:149–174).

| Đếm | Số |
|---|---|
| Mẫu chào mừng trong ô chọn của app | 11 (shd-01…11) |
| Tệp vẽ chào mừng trong apps/web/public/mau | 11 shd, **0 mẫu cm** |
| Mẫu mới anh đã duyệt hướng (docs/rnd/v10-chao-mung/cm-01…10.html) | 10, **chưa vào app** |
| Mẫu cm đã có ô mã số (`data-seat`, đổi số bằng `?ma=`) | 10/10 (v10-chao-mung/chung/cm.js:2–12) |
| Mẫu shd cũ có ô mã số | 0/11 |

**Việc đi kèm (b), việc tồn 73.** Cột "ẩn/hiện trên trang học viên" (`portalVisible`, schema.prisma:1521) đã có. Trang học viên đã lọc theo cột này (portal/me.ts:141). Nhưng còn thiếu hai thứ:
- Máy chủ chưa nhận lệnh đổi cột (danh sách trường được sửa ở apps/api/src/modules/designs/schemas.ts:94–107 không có `portalVisible`).
- Màn "Thẻ đã tạo" chỉ có nút Tải ảnh và Xoá (apps/web/src/features/designs/CardList.tsx:86–95).

## 2. Bốn tình huống mã số — mỗi phương án xử lý thế nào

"Chuyển lớp" trong app hiện nay **không phải một nút riêng**. Chuyển lớp gồm hai bước: huỷ dòng khoá học cũ (huỷ ghi danh lớp cũ, contracts/routes.ts:783) rồi thêm dòng khoá học mới vào hợp đồng đã xác nhận (ghi danh lớp mới, routes.ts:706–713).

"Đua" là khi hai nhân viên cùng xác nhận hai hợp đồng vào cùng một lớp trong cùng một giây. Hiện app đã xếp hàng hai lệnh này. Câu lệnh "giữ chỗ" khoá dòng lớp cho tới khi xong, nên người sau phải chờ người trước (contracts/enroll.ts:3–5, 108–111). App đang dựa vào khoá này để không vượt sĩ số.

| | **A. Số theo thứ tự ghi danh, giữ nguyên** | **B. Đánh số theo tên khi chốt danh sách** | **C. Trung tâm tự đặt mã, app gợi ý** |
|---|---|---|---|
| Một câu | Hợp đồng xác nhận là có số kế tiếp (01, 02…). Số không bao giờ đổi, sửa tay được. | Trước ngày chốt chưa ai có số. Bấm "Chốt & đánh số" thì app cấp 01–N theo thứ tự a, b, c của tên. | Mã là chữ ngắn tối đa 3 ký tự (07, A5, B12). Trung tâm đặt cho khớp sơ đồ ghế thật; app gợi ý mã còn trống. |
| Cấp lúc nào | Lúc ghi danh (hợp đồng xác nhận), tự động | Lúc bấm "Chốt & đánh số". Ai ghi danh sau ngày chốt nhận số tiếp theo (N+1). | Lúc người dùng gõ hoặc bấm "Đặt nhanh theo hàng ghế". Để trống thì app gợi ý. |
| Huỷ ghi danh | Số để trống, **không cấp lại** (lớp có thể thiếu số 03) | Trước chốt: không có số. Sau chốt: số để trống. | Mã được **nhả ra**, người khác dùng lại ngay |
| Huỷ rồi ghi danh lại cùng lớp | Nhận số mới cuối hàng | Sau chốt: số N+1 | Gợi ý mã trống nhỏ nhất |
| Chuyển lớp | Lớp cũ: số nằm lại trên dòng đã huỷ. Lớp mới: số cuối hàng. | Lớp mới chưa chốt: chưa có số. Đã chốt: N+1. | Lớp mới: ô trống kèm gợi ý |
| Hai người ghi danh cùng lúc | **An toàn.** Số được cấp ngay trong câu lệnh giữ chỗ đang khoá dòng lớp, không cần khoá mới. | Ghi danh: như A. Chốt cùng lúc với một ghi danh mới: cùng khoá dòng lớp nên xếp hàng. | Gợi ý **không giữ chỗ**: hai người gõ cùng mã gợi ý thì database chặn người sau, báo lỗi tiếng Việt. |
| Hai nhân viên sửa tay cùng một mã | Database chặn người sau ("Mã 02 đã có: Lê Thị Mai") | Như A | Như A |

*Phần "an toàn" là suy luận từ mã nguồn (enroll.ts:3–5, 108–111). Chặng 2 sẽ có bài thử đua thật.*

## 3. Học từ đâu

Máy chủ đám mây **không mở được trang web bên ngoài**: trình lấy trang báo lỗi tên miền, proxy từ chối kết nối tới thuvienphapluat.vn. R&D chỉ đọc được **trích đoạn kết quả tìm kiếm**, chưa mở trang gốc. Mỗi nguồn dưới đây ghi rõ mức đã kiểm.

1. **Số báo danh kỳ thi tốt nghiệp THPT** (Bộ GD&ĐT, Quy chế thi kèm Thông tư 24/2024/TT-BGDĐT, Điều 22; bản cũ là Thông tư 15/2020, Điều 9). Trích đoạn: *"Lập danh sách tất cả thí sinh ĐKDT tại Điểm thi theo thứ tự a, b, c,... của tên thí sinh để gắn số báo danh"*. Số báo danh gồm mã hội đồng 2 chữ số và 6 chữ số tăng dần, không trùng. Nguồn: [thuvienphapluat.vn — số báo danh 2025](https://thuvienphapluat.vn/hoi-dap-phap-luat/khi-nao-co-so-bao-danh-thi-thpt-quoc-gia-2025-138053644.html). → **Học cho phương án B.** Điểm quan trọng: họ đánh số **một lần, sau khi đóng đăng ký**, không đánh lại khi có người mới. *Chưa mở được văn bản gốc.*
2. **SMAS (Viettel, sổ điểm điện tử trường học)** có nút "Thay đổi STT" trong hồ sơ học sinh, tức số thứ tự học sinh sửa tay được. Nguồn: [hoatieu.vn — cách xếp thứ tự học sinh trong SMAS](https://hoatieu.vn/bieu-mau/cach-xep-thu-tu-hoc-sinh-trong-smas-173325). → **Học cho ý "sửa tay được"** (cả 3 phương án). *Chưa khảo sát được SMAS có tự đánh lại số khi thêm học sinh hay không; trích đoạn không nói.*
3. **Eventbrite (bán vé sự kiện, chỗ ngồi đặt trước).** Ghế chọn trên **sơ đồ ghế riêng**: người tổ chức tự gán ghế, người mua tự chọn, hoặc máy chọn "chỗ tốt nhất còn lại". Ghế của đơn bỏ dở thì trả lại. Nguồn: [Eventbrite — trang hỗ trợ reserved seating](https://eventbrite.com/support/articleredirect?anum=9933), [blog Eventbrite về reserved seating](https://www.eventbrite.com/blog/?p=49582). → **Học cho phương án C** (mã theo ghế, nhả ghế khi huỷ). Cũng rút ra rằng **ghế là một lớp riêng**, tách khỏi số nhận diện người tham dự. *Bài hỗ trợ là bản cũ, chưa mở được.*
4. **Zola (công cụ sơ đồ bàn tiệc cưới):** kéo thả khách vào từng bàn, sửa bàn sau được, xuất PDF/Excel. Nguồn: [zola.com — seating chart](https://zola.com/wedding-planning/seating-chart). → Cùng kết luận với nguồn 3: **sắp chỗ là việc làm sau, trên một sơ đồ riêng.** Hợp với ý anh "để sau sắp xếp ghế".
5. **Cvent (phần mềm hội nghị):** in **mã xác nhận đăng ký** thành mã QR trên thẻ đeo của khách. Nguồn: [Cvent community — QR codes for check-in](https://community.cvent.com/discussion/qr-codes-used-for-registrant-check-in). → Thẻ in lại **số nhận diện cấp lúc đăng ký**, không in số ghế. Hợp với phương án A. *Chưa khảo sát được Cvent có tái dùng số hay không.*
6. **Trong chính app:** số giấy chứng nhận dùng bộ đếm không bao giờ lùi, không tái dùng (apps/api/src/modules/certificates/service.ts:296–307). Mã khoá học KH-0001… cũng vậy (courses/service.ts:168–182). Phương án A đi đúng cách app đang đánh số.

## 4. Ba phương án — ảnh thật

Ảnh nằm ở `docs/rnd/anh-rnd11/`, chụp khung nhìn (không chụp cả trang dài) ở khổ 1440 (máy tính) và 390 (điện thoại). R&D đã mở xem từng ảnh. Bản mẫu chạy được nằm ở `docs/rnd/v11-ma-so/` (mở bằng máy chủ tĩnh từ gốc kho; mỗi tệp có mục lục và nút "Hiện trường dữ liệu").
- Thẻ chào mừng trong ảnh là **tệp vẽ thật** của 10 mẫu mới (`docs/rnd/v10-chao-mung/cm-NN.html?ma=…`), nhúng vào màn Mẫu thiết kế.
- R&D dùng mẫu cm chứ không dùng mẫu trong `apps/web/public/mau`: thư mục đó chỉ có 11 mẫu shd, và cả 11 đều chưa có ô mã (0/11).
- Dữ liệu học viên trong ảnh là dữ liệu mẫu. Lớp K12 có 10 người ghi danh; Ánh Dương huỷ ngày 12/10 để đổi sang K13.

### A. Số theo thứ tự ghi danh, giữ nguyên (`v11-ma-so/pa-A-co-dinh.html`)
- (i) Chỗ xem/sửa mã — hộp "Học viên lớp K12", cột mã bên trái, bấm vào mã để sửa:
  - `pa-A-lop-1440.png`, `pa-A-lop-390.png`
  - Sửa trùng thì báo lỗi; số 03 của người huỷ để trống: `pa-A-lop-sua-1440.png`, `pa-A-lop-sua-390.png`
- (ii) Thẻ cm-01 hiện **SỐ 07** (Vũ Thu Trang, người ghi danh thứ 7); ô "Mã số trong lớp" trong cột Nội dung:
  - `pa-A-the-1440.png`, `pa-A-the-390.png`, `pa-A-the-390-o-ma.png`
- (iii) **Được:**
  - 0 bấm thêm cho mỗi học viên.
  - Số không đổi, nên thẻ đã xuất và trang học viên **không bao giờ lệch** vì người khác huỷ hay ghi danh thêm.
  - Khớp 4/4 ý của việc tồn 55.
  - Chống đua bằng khoá có sẵn.

  **Mất:** dãy số có lỗ (03 trống) và không theo thứ tự tên.

  **Rủi ro dữ liệu:** thấp. Chỉ khi **sửa tay** một mã đã in thì thẻ cũ mang số cũ (xem câu hỏi 3).

### B. Đánh số theo tên khi chốt danh sách (`v11-ma-so/pa-B-theo-ten.html`)
- (i) Chỗ xem/sửa mã:
  - Trước khi chốt (chưa ai có số, nút "Chốt & đánh số theo tên"): `pa-B-chua-chot-1440.png`
  - Sau khi chốt (01–09 theo tên): `pa-B-lop-1440.png`, `pa-B-lop-390.png`
  - Người ghi danh sau ngày chốt nhận 10: `pa-B-lop-cuoi-1440.png`, `pa-B-lop-cuoi-390.png`
  - Bấm "Đánh số lại theo tên", hiện số cũ → số mới: `pa-B-lai-1440.png`
- (ii) Thẻ cm-04 hiện **SỐ 08** (Trang đứng thứ 8 theo tên): `pa-B-the-1440.png`, `pa-B-the-390.png`, `pa-B-the-390-o-ma.png`
- (iii) **Được:** danh sách nhìn quen như sổ điểm danh trường học, tra theo tên dễ.

  **Mất:**
  - Thêm 1 bấm mỗi lớp.
  - Thẻ chào mừng làm **trước ngày chốt** không có mã. Thẻ thường làm ngay khi học viên ghi danh, nên trong ví dụ 9/9 thẻ làm sớm phải xuất lại.
  - Đánh số lại khi có thêm một người tên "Hà" làm **8/9 người đã có số bị đổi số**.

  **Rủi ro dữ liệu:** cao. Mỗi lần đánh số lại, mọi thẻ đã xuất và mọi ảnh trên trang học viên mang số sai cho tới khi xuất lại. Chỉ khớp 3/4 ý việc tồn 55 (không "tự cấp theo thứ tự ghi danh").

### C. Trung tâm tự đặt mã, app gợi ý (`v11-ma-so/pa-C-tu-dat.html`)
- (i) Chỗ xem/sửa mã — bảng mã sửa trực tiếp, thêm thanh "Đặt nhanh theo hàng ghế" (A1–A4, B1–B4…), người chưa có mã có gợi ý A5:
  - `pa-C-lop-1440.png`, `pa-C-lop-390.png`
  - Gõ trùng B2 thì báo lỗi; người huỷ đã nhả A5: `pa-C-lop-loi-1440.png`, `pa-C-lop-loi-390.png`
- (ii) Thẻ cm-03 hiện **SỐ B2**: `pa-C-the-1440.png`, `pa-C-the-390.png`, `pa-C-the-390-o-ma.png`
- (iii) **Được:** mã khớp ngay chỗ ngồi thật (hàng B, ghế 2).

  **Mất:**
  - Thêm việc đặt mã cho từng lớp.
  - Mã chữ không vừa mọi mẫu, theo bảng đo `do-do-dai-ma-1440.png` (trang `v11-ma-so/do-do-dai-ma.html`, 60 ô cắt từ tệp vẽ thật):

    | Mã thử | Kết quả trên 10 mẫu cm |
    |---|---|
    | "07", "123", "B3" | vừa 10/10 |
    | "A12" | chạm viền 1/10 |
    | "M12" | chạm viền 4/10 |
    | "A-07" (4 ký tự) | **vỡ 6/10** (cm-01, 03, 05, 06, 07, 09) |

    Vậy phải giới hạn 3 ký tự và làm thêm phần co chữ cho cả 21 mẫu.
  - Mã thành số ghế, nên đổi chỗ ngồi là đổi mã và đổi thẻ. Ở nguồn 3 và 4, sắp ghế là một lớp riêng.

  **Rủi ro dữ liệu:** trung bình. Mã được nhả ra rồi dùng lại, nên **hai thẻ cùng số có thể cùng lưu hành**: thẻ của người đã huỷ và thẻ của người mới. Khớp 3/4 ý việc tồn 55 (thiếu "tự cấp theo thứ tự ghi danh"), và mã không còn dạng 01, 02.

### Đi kèm, chung cho cả 3 phương án (`v11-ma-so/chung-mau-va-an-hien.html`)
- (a) Ô chọn mẫu chào mừng có **21 mẫu**, đúng tổng sổ ý muốn dòng 43 đã chốt (11 + 10). 10 mẫu mới xếp trước, gắn nhãn "Mới": `chung-21-mau-1440.png`, `chung-21-mau-390.png`.
  - Muốn đưa vào app phải chép 10 tệp vẽ cùng phần chung sang `public/mau`, thêm 10 ảnh nhỏ vào `public/mau/anh-nho`, và thêm 10 dòng vào danh mục mẫu.
  - 11 mẫu cũ cũng phải thêm ô mã (sổ ý muốn dòng 44).
- (b) Màn "Thẻ đã tạo" có công tắc **"Hiện trên trang học viên"** cho thẻ Chào mừng và Feedback. Lời chúc không hiện trên trang học viên nên không có công tắc. Ảnh: `chung-an-hien-1440.png`, `chung-an-hien-390.png`.

## 5. Đề xuất của R&D: Phương án A

| Thước đo | A | B | C |
|---|---|---|---|
| Bấm thêm để có mã | 0 / học viên | 1 / lớp | 0 nếu nhận gợi ý; có thêm việc đặt theo ghế |
| Người đã có số bị đổi số khi lớp thêm 1 người (ví dụ K12) | **0/9** | 8/9 (nếu đánh lại) | 0/9 |
| Thẻ phải xuất lại khi có người huỷ hoặc ghi danh thêm | **0** | tất cả thẻ làm trước chốt / sau mỗi lần đánh lại | 0, nhưng mã có thể trùng với thẻ của người đã huỷ |
| Mã vừa ô trên 10 mẫu mới (đo) | 10/10 (01–999) | 10/10 | vỡ 6/10 nếu 4 ký tự |
| Khớp 4 ý của việc tồn 55 | **4/4** | 3/4 | 3/4 (mã không còn dạng 01, 02) |
| Chống đua | dùng khoá có sẵn | dùng khoá có sẵn | gợi ý không giữ chỗ, dựa vào database chặn |

A là phương án duy nhất mà **số in trên thẻ không bao giờ sai** vì hành động của người khác. Đây là điều quan trọng nhất, vì thẻ đã xuất thành ảnh PNG và đã gửi cho học viên. Sau này, màn sắp ghế sẽ gán mã → vị trí trên một sơ đồ riêng, giống cách Eventbrite và Zola tách ghế khỏi số nhận diện. Như vậy đổi chỗ ngồi không cần đổi mã hay in lại thẻ.

## 6. Câu hỏi cho anh Chiến (mỗi câu đã chọn sẵn một đáp án, anh chỉ cần đồng ý hoặc đổi)

1. **Chọn cách cấp mã số?**
   - **(chọn sẵn) A — số theo thứ tự ghi danh, giữ nguyên**
   - B — đánh số theo tên khi chốt
   - C — trung tâm tự đặt mã
2. **Học viên huỷ rồi ghi danh lại cùng lớp, hoặc chuyển sang lớp khác, thì mã thế nào?**
   - **(chọn sẵn) Nhận số mới ở cuối hàng; số cũ để trống**
   - Lấy lại đúng số cũ nếu số đó còn trống
3. **Khi anh sửa tay mã của một học viên đã có thẻ chào mừng xuất ảnh?**
   - **(chọn sẵn) App đánh dấu thẻ đó "mang số cũ — cần xuất lại" ở màn Thẻ đã tạo**
   - Không làm gì, anh tự nhớ xuất lại
4. **Mã số có hiện cho học viên trên trang học viên không** (dòng "Mã số của bạn: 07" cạnh thẻ chào mừng)?
   - **(chọn sẵn) Có**
   - Không, chỉ in trên thẻ

*Không hỏi lại các điểm sổ ý muốn và ký duyệt đã chốt:*
- *mã là dữ liệu của học viên trong lớp (dòng 44);*
- *21 mẫu chào mừng, 11 cũ + 10 mới (dòng 43);*
- *mọi mẫu chào mừng có ô mã (dòng 44);*
- *thẻ mặc định hiện trên trang học viên (ký duyệt E câu 2).*
