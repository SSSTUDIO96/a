# Báo cáo R&D 01 — Ba phương án giao diện cho Bảng giá và Lịch makeup

- Sản phẩm: Makeup Pro (phần mềm cho thợ makeup, đội makeup, trung tâm dạy makeup)
- Người đọc: anh Chiến
- Chặng: 1/4 — bày phương án để anh chọn. Chưa có bản vẽ thông số chi tiết.
- Ngày lập: 18/10/2026

---

## 1. Tóm tắt cho anh

- R&D dựng **ba bản mẫu khác nhau về cách bày**, mỗi bản có đủ hai màn Bảng giá và Lịch makeup:
  - **A — Cột theo thợ**: mỗi thợ một cột, trục giờ dọc. Học từ Fresha và Vagaro.
  - **B — Danh sách theo ngày, ưu tiên điện thoại**: chọn ngày ở dải 7 ngày, các ca xếp thành danh sách theo giờ. Ca trùng và ca chưa có thợ được gom lên đầu. Học từ chế độ "Agenda" của Vagaro.
  - **C — Lưới tuần thợ × ngày**: hàng là thợ, cột là 7 ngày trong tuần. Khung giống Studio Pro của anh.
- Cả ba bản dùng **chung dữ liệu và chung màu**. Khác nhau nằm ở cách bày, không nằm ở màu.
- **Đề xuất của R&D: Phương án B.** Lý do ở mục 7.
- **Nói thẳng về nguồn:**
  - Studio Pro: R&D chạy được app thật và chụp 10 ảnh.
  - Fresha và Vagaro: **không mở được trang nào và không chụp được ảnh nào**. Mạng của môi trường làm việc chặn hai trang này. R&D chỉ đọc được các trích đoạn mà công cụ tìm kiếm trả về từ trang trợ giúp của họ. Mọi điều R&D ghi là "học từ Fresha/Vagaro" đều kèm đường dẫn và ghi rõ mức tin cậy.

## 2. Cách xem bản mẫu

Mở trực tiếp bằng trình duyệt (Chrome, Safari). Tệp không cần mạng.

| Phương án | Tệp | Màn Lịch | Màn Bảng giá |
|---|---|---|---|
| A | /home/user/a/docs/rnd/phuong-an-A.html | thêm `#lich` vào cuối đường dẫn | thêm `#bang-gia` vào cuối đường dẫn |
| B | /home/user/a/docs/rnd/phuong-an-B.html | `#lich` | `#bang-gia` |
| C | /home/user/a/docs/rnd/phuong-an-C.html | `#lich` | `#bang-gia` |

- Trong bản mẫu, anh có thể bấm menu để chuyển giữa hai màn.
- Thu hẹp cửa sổ trình duyệt để xem bố cục máy tính bảng và điện thoại.
- Di chuột vào dấu **?** cạnh nhãn để xem giải thích (tooltip).

Ảnh chụp sẵn (màn hình đầu tiên, chưa cuộn) nằm ở /home/user/a/docs/rnd/anh/, gồm 18 ảnh:
phuong-an-{A,B,C}-{lich,bang-gia}-{desktop,tablet,mobile}.png.
- desktop = máy tính 1440×900
- tablet = máy tính bảng 1024×768
- mobile = điện thoại 390×844

Thêm một ảnh kiểm tra tooltip: /home/user/a/docs/rnd/anh/phuong-an-A-bang-gia-desktop-tooltip.png

### Dữ liệu minh hoạ dùng chung

- **Thợ:** Nguyễn Thu Hà, Trần Minh Anh, Lê Ngọc Trâm (thợ chính); Phạm Bảo Vy (thợ phụ).
- **Ngày minh hoạ:** Thứ Bảy 24/10/2026, có 11 ca.
- **Ca trùng lịch:** Thu Hà làm "Makeup cô dâu" cho khách 04:30–06:30, đồng thời làm "Makeup ăn hỏi" cho Lê Thị Lan 06:00–07:30. Hai ca chồng nhau 30 phút.
- **Tên khách dài để thử tràn chữ:** "Tôn Nữ Hoàng Bảo Ngọc Phương Thảo".
- **Ca chưa có thợ:** Makeup tiệc 15:00 cho Trịnh Minh Châu.

**Dịch vụ lẻ**

| Dịch vụ | Giá |
|---|---|
| Makeup cô dâu (ngày cưới) | 2.500.000 ₫ |
| Makeup ăn hỏi | 1.500.000 ₫ |
| Makeup cô dâu chụp ảnh cưới | 1.200.000 ₫ |
| Làm tóc cô dâu | 800.000 ₫ |
| Makeup tiệc | 600.000 ₫ |
| Makeup mẹ cô dâu / chú rể | 500.000 ₫ |
| Makeup kỷ yếu | 350.000 ₫ |
| Makeup chú rể | 200.000 ₫ |

**Gói makeup**

| Gói | Giá gói | Cộng giá lẻ |
|---|---|---|
| Gói Cưới Trọn Vẹn | 4.300.000 ₫ | 5.600.000 ₫ |
| Gói Ăn Hỏi Gia Đình | 2.900.000 ₫ | 3.300.000 ₫ |
| Gói Tiệc Nhóm 5 Người | 2.500.000 ₫ | 3.000.000 ₫ |

**Phụ phí:** đi xa trên 10 km 300.000 ₫; ca sớm trước 5 giờ 200.000 ₫.

---

## 3. Những gì đã khảo sát được

### 3.1. Studio Pro của anh — khảo sát thật (chạy app, chụp ảnh, đọc mã)

**Cách R&D chạy được app.** R&D không sửa mã của anh.
- Đã chép mã sang /tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/ssaas-run, chạy `npm install` rồi chạy Vite ở cổng 5199.
- App chỉ vào được chế độ studio khi chạy dưới tên miền phụ. R&D dùng `demo.localhost`.
- App cần máy chủ API dùng cơ sở dữ liệu PostgreSQL, môi trường này không có. R&D giả lập API ngay trong trình duyệt Playwright:
  - đăng nhập bằng hồ sơ "Nguyễn Trọng Chiến – Giám Đốc" lấy từ dữ liệu mẫu có sẵn trong /tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/repos/ssaas/data/personnelData.ts;
  - bơm vào 4 ca lịch thử.
- **Bảng giá** trong ảnh là dữ liệu mẫu có sẵn trong mã của anh (thư mục data/pricing).
- **4 ca lịch** trong ảnh là dữ liệu R&D bơm vào, không phải lịch thật của studio.

Ảnh đã chụp, nằm trong /home/user/a/docs/rnd/tham-chieu/:

| Ảnh | Nhìn thấy gì |
|---|---|
| /home/user/a/docs/rnd/tham-chieu/studio-pro-lich-thang-board-1440.png | Lịch mặc định là lưới **tháng**. Mỗi ô ngày gom ca thành một nhãn theo loại kèm số đếm (ví dụ "Khác 4"). Muốn biết ai làm giờ nào phải bấm vào ô. |
| /home/user/a/docs/rnd/tham-chieu/studio-pro-lich-chi-tiet-ngay-1440.png | Hộp chi tiết ngày: danh sách ca, mỗi ca có giờ, tên ca, địa điểm, "MAKEUP: tên thợ". |
| /home/user/a/docs/rnd/tham-chieu/studio-pro-lich-dang-list-1440.png | Dạng "List": thẻ ca xếp ngang theo ngày. |
| /home/user/a/docs/rnd/tham-chieu/studio-pro-lich-thang-board-390.png | Trên điện thoại, lưới tháng 7 cột bị ép: nhãn ca chỉ còn "K 4", thanh công cụ tràn, nút "List" bị che. |
| /home/user/a/docs/rnd/tham-chieu/studio-pro-lich-dang-list-390.png, /home/user/a/docs/rnd/tham-chieu/studio-pro-lich-chi-tiet-ngay-390.png | Hai màn trên ở khổ điện thoại. |
| /home/user/a/docs/rnd/tham-chieu/studio-pro-bang-gia-dich-vu-le-1440.png | Bảng dịch vụ lẻ có các cột: Giá thu khách, Lương (CT / Free), Lương Học viên (70%), Địa điểm, Thời gian, Thao tác. Giá gắn liền với tiền công thợ. |
| /home/user/a/docs/rnd/tham-chieu/studio-pro-bang-gia-dich-vu-le-390.png | Trên điện thoại, bảng bị ép: tên dịch vụ bẻ thành 4 dòng, các cột bên phải bị cắt mất. |
| /home/user/a/docs/rnd/tham-chieu/studio-pro-bang-gia-goi-combo-1440.png | Gói combo bày thành thẻ giá theo nhóm (Cưới Studio, Baby, Gia đình…), có giá gạch và danh sách quyền lợi. |
| /home/user/a/docs/rnd/tham-chieu/studio-pro-bang-gia-goi-combo-390.png | Trên điện thoại, 4 nút "Xem Web Khách / Lương & Thưởng / Thanh toán / Thêm Gói Mới" đè lên tiêu đề bảng giá. |

**Phát hiện quan trọng về cảnh báo trùng lịch:**
- Trong ảnh, thợ "Sam Nguyễn" có hai ca chồng giờ: 05:00–07:30 và 06:30–08:00. **Màn lịch hiện hai ca bình thường, không có cảnh báo nào.**
- Đọc mã thì thấy cảnh báo trùng chỉ nằm trong form hợp đồng, tệp /tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/repos/ssaas/components/StaffConflictAlert.tsx. Tệp này được dùng trong MakeupFormSection.tsx và PhotographyFormSection.tsx.
- Cảnh báo đó **so theo ngày, không so theo giờ**. Thợ có hai ca cùng ngày là bị báo, kể cả khi hai ca cách nhau cả buổi. Hai ca chồng giờ thật thì màn lịch không báo.
- Với nghề makeup cưới (ca 4–7 giờ sáng thường dồn vào nhau), Makeup Pro cần kiểm tra trùng **theo giờ, và hiện ngay trên màn lịch**.

Mã liên quan khác:
- /tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/repos/ssaas/pages/schedule/Schedule.tsx: hai chế độ 'list' và 'board', mặc định 'board'.
- /tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/repos/ssaas/pages/pricing/components/SingleServices.tsx: cột "Lương Học viên" tính theo % cài trong Nhân sự, mặc định 70%.

### 3.2. Fresha — chỉ khảo sát gián tiếp (trích đoạn tìm kiếm). Không có ảnh.

- R&D không mở được trang nào của fresha.com:
  - Playwright bị proxy trả lỗi 403;
  - WebFetch báo "getaddrinfo ENOTFOUND www.fresha.com".
- Các điều dưới đây lấy từ trích đoạn mà WebSearch trả về cho từng trang. **Mức tin cậy: trung bình.** Đúng là trang trợ giúp chính thức, nhưng R&D chưa tự đọc toàn trang và chưa thấy giao diện.

| # | Điều đọc được | Nguồn |
|---|---|---|
| F1 | Lịch hẹn hiện trong cột của thợ (và cột tài nguyên). Ngày quá kín thì hiện vài lịch đầu, phần còn lại gom vào nút "+X more", bấm vào thì mở lịch lọc riêng thợ đó. Có bộ lọc "Scheduled team" (chỉ thợ có ca) và "All team". | https://www.fresha.com/help-center/knowledge-base/calendar/16-manage-your-calendar-display-settings- |
| F2 | Lọc lịch theo kênh, trạng thái thanh toán, dịch vụ, thợ được khách yêu cầu. Lưu bộ lọc thành mẫu. Chỉnh độ phóng và khoảng chia ô thời gian. | https://www.fresha.com/help-center/knowledge-base/calendar/290-customize-your-calendar-view-1 |
| F3 | Ca làm lặp lại của thợ (theo tuần, đến 4 tuần). Giờ làm hiện lên lịch. | https://www.fresha.com/help-center/knowledge-base/calendar/252-schedule-and-update-team-shifts |
| F4 | Lịch có các chế độ Ngày, 3 ngày, Tuần, Tháng. Có ô chọn thợ/tài nguyên trên thanh công cụ. Đổi thứ tự cột thợ bằng kéo-thả. Trích đoạn trỏ tới hai trang bên cạnh, R&D chưa xác định được câu nào thuộc trang nào. | https://www.fresha.com/help-center/knowledge-base/calendar/260-create-appointments-1 và https://www.fresha.com/help-center/academy/run-your-business/schedule-appointments/lessons/100252 |
| F5 | Thêm dịch vụ: Danh mục → Thực đơn dịch vụ → Thêm → Dịch vụ đơn. Mỗi dịch vụ đặt giá, thời lượng và cách hiện trên lịch. | https://www.fresha.com/help-center/knowledge-base/catalog/284-create-services-1 |
| F6 | Dịch vụ có biến thể giá. Đặt giá và thời lượng khác nhau theo thợ hoặc theo chi nhánh. | https://fresha.com/help-center/knowledge-base/catalog |
| F7 | Gói (package): thêm quyền lợi (dịch vụ, sản phẩm, giảm giá), đặt giá tổng và thời hạn sử dụng. Bật/tắt bán online. | https://www.fresha.com/help-center/knowledge-base/memberships-packages-and-gift-cards/102134-create-a-package |

### 3.3. Vagaro — chỉ khảo sát gián tiếp (trích đoạn tìm kiếm). Không có ảnh.

- R&D không mở được trang nào:
  - Playwright bị proxy trả lỗi 403;
  - WebFetch báo "getaddrinfo ENOTFOUND" với www.vagaro.com và apps.apple.com.
- **Mức tin cậy:** trung bình với trang support.vagaro.com và vagaro.com; thấp với mô tả trên kho ứng dụng.

| # | Điều đọc được | Nguồn |
|---|---|---|
| V1 | Lịch có các chế độ Ngày, Tuần, Tháng và **Agenda**. Agenda là danh sách lịch hẹn của nhiều thợ và tài nguyên trong một danh sách. | https://support.vagaro.com/hc/en-us/articles/360054177294-Switch-to-Calendar-Day-Week-Month-or-Agenda-View |
| V2 | Xem lịch nhiều thợ cạnh nhau. Trên máy tính: Tuần/Tháng tối đa 10 lịch; Ngày/Agenda không giới hạn. Có danh sách "In Today" gồm các thợ có giờ làm hôm đó. | https://support.vagaro.com/hc/en-us/articles/27836631668379-View-Employee-and-Resource-Calendars |
| V3 | Kéo-thả lịch hẹn sang ô khác để dời lịch. Dời cùng lúc nhiều lịch của một khách trong ngày. | https://support.vagaro.com/hc/en-us/articles/115004152733-Reschedule-a-Customer-s-Appointment |
| V4 | Lịch mới ra ngày 2/3/2026: đổi thợ/đổi ngày nhanh, cập nhật tức thời, thanh toán ngay từ lịch, có chủ đề giao diện. | https://www.vagaro.com/en-au/pro/updates/updated-calendar |
| V5 | Thêm dịch vụ: chọn loại mục là nhóm, dịch vụ, combo (bundle) hoặc dịch vụ kèm (add-on). | https://www.vagaro.com/learn/the-quickstart-guide-to-vagaro |
| V6 | Giá combo có thể tự tính theo giá riêng của từng thợ ("Employee Pricing"). | https://www.vagaro.com/pro/updates/dynamic-pricing |
| V7 | Dịch vụ kèm có thể dài 0 phút. Chuyển một dịch vụ thành dịch vụ kèm. | https://www.vagaro.com/learn/beauty/add-value-add-ons-salon-barbershop |
| V8 | Mô tả app cho biết có thể đặt chồng 2–3 lịch khi cần. Mức tin cậy thấp: chỉ là tóm tắt kết quả tìm kiếm của trang kho ứng dụng. | https://apps.apple.com/us/app/vagaro-pro/id346778559 |

---

## 4. Phương án A — Cột theo thợ (học từ Fresha, Vagaro)

Ảnh:
- /home/user/a/docs/rnd/anh/phuong-an-A-lich-desktop.png
- /home/user/a/docs/rnd/anh/phuong-an-A-lich-tablet.png
- /home/user/a/docs/rnd/anh/phuong-an-A-lich-mobile.png
- /home/user/a/docs/rnd/anh/phuong-an-A-bang-gia-desktop.png
- /home/user/a/docs/rnd/anh/phuong-an-A-bang-gia-tablet.png
- /home/user/a/docs/rnd/anh/phuong-an-A-bang-gia-mobile.png

**Cách bày**
- **Lịch:**
  - Trục giờ 04:00–18:00 chạy dọc. Mỗi thợ một cột, đầu cột ghi số ca và số giờ trong ngày.
  - Cột cuối là "Chưa có thợ", có nút "Phân thợ".
  - Giờ thợ không làm được tô sọc.
  - Hai ca trùng nằm cạnh nhau trong cùng cột, viền đỏ, gắn nhãn "Trùng". Một dải đỏ phía trên ghi "Trùng lịch: Thu Hà có 2 ca chồng nhau 06:00–06:30", có nút "Đổi thợ".
  - Cột có ca trùng tự nới rộng để đọc được chữ.
- **Bảng giá:** ba vùng.
  - Bên trái: danh mục (Cô dâu, Ăn hỏi, Tiệc & sự kiện, Phụ phí, Gói makeup).
  - Ở giữa: danh sách dịch vụ.
  - Bên phải: ngăn "Sửa dịch vụ". Mỗi dòng gồm nhãn và ô điều khiển, giải thích nằm trong dấu ?. Ngăn có "Giá theo bậc thợ" (thợ chính / thợ phụ), "Thời gian dọn đồ", "Cho khách đặt online", "Đặt cọc".

**Học từ đâu**
- Cột theo thợ, lọc thợ, chế độ Ngày / 3 ngày / Tuần: Fresha F1, F4 và Vagaro V2.
- Giá khác nhau theo thợ: Fresha F6 và Vagaro V6.
- Bố cục danh mục dịch vụ: Fresha F5.
- Lưu ý: hình dáng cụ thể của màn Fresha/Vagaro (vị trí nút, cỡ chữ) **R&D chưa thấy tận mắt**. Bố cục trong bản mẫu là R&D suy ra từ mô tả chữ.

**Điểm mạnh**
- Chủ studio nhìn một lần là thấy cả đội: ai rảnh, ai kín, ca trùng nằm ở đâu.
- Phân thợ trực quan: ca chưa có thợ nằm ngay cạnh các cột thợ.
- Bảng giá có ngăn sửa cố định: sửa giá không phải rời danh sách.

**Điểm yếu**
- Trên điện thoại chỉ thấy khoảng 1,5 cột thợ, phải vuốt ngang để xem thợ khác (ảnh mobile).
- Ca ngắn 45 phút chỉ đủ chỗ ghi giờ và tên dịch vụ. Tên khách phải chạm vào ca mới thấy.
- Từ 6–7 thợ trở lên thì cột hẹp lại, tên dài bị cắt.

**Hợp với ai:** đội makeup 3–6 thợ, chủ ngồi máy tính hoặc máy tính bảng để điều phối.

**Rủi ro**
- Thợ cá nhân (chỉ 1 cột) dùng thì màn trống nhiều.
- Trung tâm dạy có nhiều học viên thì cột tăng nhanh, khó bày.
- Kéo-thả để đổi thợ (Vagaro V3) tốn công làm, và dễ lỗi trên điện thoại.

## 5. Phương án B — Danh sách theo ngày, ưu tiên điện thoại (học từ chế độ Agenda của Vagaro)

Ảnh:
- /home/user/a/docs/rnd/anh/phuong-an-B-lich-desktop.png
- /home/user/a/docs/rnd/anh/phuong-an-B-lich-tablet.png
- /home/user/a/docs/rnd/anh/phuong-an-B-lich-mobile.png
- /home/user/a/docs/rnd/anh/phuong-an-B-bang-gia-desktop.png
- /home/user/a/docs/rnd/anh/phuong-an-B-bang-gia-tablet.png
- /home/user/a/docs/rnd/anh/phuong-an-B-bang-gia-mobile.png

**Cách bày**
- **Lịch:**
  - Dải 7 ngày: mỗi ngày ghi số ca, chấm đỏ nếu có ca trùng.
  - Hàng chip lọc thợ, mỗi chip kèm số ca.
  - Khối **"Cần xử lý"** đứng đầu: thẻ đỏ "Trùng lịch – Thu Hà" có nút "Đổi thợ", thẻ vàng "Chưa có thợ" có nút "Phân thợ".
  - Bên dưới là danh sách ca theo giờ, chia "Sáng sớm / Buổi sáng / Buổi chiều". Mỗi ca ghi tên dịch vụ, tên khách (tên dài được xuống dòng, không bị cắt), địa điểm và thợ. Ca trùng có thêm dòng "Trùng giờ với ca 06:00–07:30".
  - Trên máy tính có thêm ô bên phải **"Thợ trong ngày"**: mỗi thợ một thanh thời gian 4h–18h, đoạn trùng tô đỏ. Màn rộng nhờ đó không bị trống.
- **Bảng giá:**
  - Máy tính: hai cột. Trái là dịch vụ lẻ theo nhóm; bấm một dòng thì mở rộng ngay tại chỗ thành các dòng nhãn + điều khiển (Giá, Thời lượng, Thời gian di chuyển, Nhận đặt online). Phải là thẻ gói makeup (các dịch vụ trong gói, giá lẻ gạch, "khách tiết kiệm 1.300.000 ₫") và phụ phí.
  - Điện thoại: ba nút chuyển "Dịch vụ lẻ / Gói makeup / Phụ phí" và nút "+".

**Học từ đâu**
- Danh sách lịch hẹn của nhiều thợ trong một danh sách: Vagaro V1.
- Danh sách thợ có giờ làm trong ngày: Vagaro V2 ("In Today"). R&D vẽ thêm thanh thời gian.
- Gói gồm nhiều dịch vụ, có giá tổng: Fresha F7 và Vagaro V5.
- Khối "Cần xử lý" là ý của R&D, không lấy từ app nào. Lý do có khối này: Studio Pro không báo trùng trên màn lịch (mục 3.1).

**Điểm mạnh**
- Cùng một cách bày chạy được ở cả 3 khổ màn, không phải vuốt ngang.
- Thợ đi làm tại nhà khách mở điện thoại là thấy ngay ca kế tiếp và địa chỉ.
- Việc cần xử lý (trùng lịch, chưa có thợ) hiện **bằng chữ, ở đầu màn**, không phải dò bằng mắt.
- Tên khách dài hiện đủ.
- Dùng được cho cả 1 thợ lẫn 20 thợ: chỉ là danh sách dài hơn, cộng chip lọc.

**Điểm yếu**
- Không thấy "hình dáng" cả ngày như cột thợ. Muốn biết thợ rảnh khoảng nào phải nhìn ô "Thợ trong ngày", mà ô này chỉ có trên máy tính và máy tính bảng.
- Ngày cao điểm 20–30 ca thì danh sách dài, phải cuộn.
- Bảng giá mở rộng tại chỗ: nhiều dòng mở cùng lúc sẽ rối. Cần quy định chỉ mở một dòng mỗi lần.

**Hợp với ai:** thợ cá nhân và đội nhỏ dùng điện thoại là chính. Trung tâm dạy dùng được nhờ chip lọc theo thợ/học viên.

**Rủi ro**
- Chủ đội lớn quen nhìn lưới có thể thấy thiếu "toàn cảnh".
- Dải 7 ngày trên điện thoại chỉ vừa khi mỗi ô rất hẹp. Chữ "11 ca" đã ở mức nhỏ nhất đọc được.

## 6. Phương án C — Lưới tuần thợ × ngày (gần Studio Pro)

Ảnh:
- /home/user/a/docs/rnd/anh/phuong-an-C-lich-desktop.png
- /home/user/a/docs/rnd/anh/phuong-an-C-lich-tablet.png
- /home/user/a/docs/rnd/anh/phuong-an-C-lich-mobile.png
- /home/user/a/docs/rnd/anh/phuong-an-C-bang-gia-desktop.png
- /home/user/a/docs/rnd/anh/phuong-an-C-bang-gia-tablet.png
- /home/user/a/docs/rnd/anh/phuong-an-C-bang-gia-mobile.png

**Cách bày**
- **Khung giống Studio Pro:** thanh bên có nhóm menu con (Lịch makeup → Xem lịch / Ngày nghỉ của thợ; Bảng giá → Dịch vụ lẻ / Gói makeup / Phụ phí), tiêu đề lớn, thẻ có tab, thanh công cụ "‹ 19 – 25/10/2026 › Hôm nay", nút "Thêm lịch", nút chuyển chế độ xem, "Bộ lọc". Thứ Bảy và Chủ nhật tô màu như Studio Pro.
- **Lịch:**
  - Thay lưới tháng bằng **lưới tuần thợ × ngày**: hàng là thợ (cộng một hàng "Chưa có thợ"), cột là 7 ngày.
  - Mỗi ô liệt kê các ca của thợ đó trong ngày đó: giờ, loại, tên khách.
  - Ô có ca trùng viền đỏ và ghi "Trùng 06:00–06:30". Nút đỏ "1 ca trùng lịch" nằm trên thanh công cụ.
  - Ngày nghỉ của thợ tô sọc.
  - Trên điện thoại, lưới tự cuộn tới ngày có ca trùng.
- **Bảng giá:**
  - Máy tính và máy tính bảng: bảng giống Studio Pro (Tên dịch vụ, Thời lượng, Giá thu khách, Tiền công thợ, Nơi làm, Sửa/Xoá). Bên dưới là ba thẻ gói makeup có giá gạch và "Tiền công thợ" của cả gói.
  - Điện thoại: bảng chuyển thành danh sách hai dòng (tên + giá; thời lượng · nơi làm · công thợ). Studio Pro hiện đang vỡ ở khổ này (mục 3.1).

**Học từ đâu**
- Studio Pro (ảnh thật ở mục 3.1): khung menu, tab trong thẻ, thanh công cụ, cột tiền công thợ cạnh giá.
- Xem nhiều thợ cùng lúc theo tuần: Vagaro V2 (Tuần tối đa 10 lịch).

**Điểm mạnh**
- Đội của anh đang dùng Studio Pro nên gần như không phải học lại.
- Thấy cả tuần cùng lúc: hợp để chia thợ cho mùa cưới (nhìn ra ai đã kín Thứ Bảy, Chủ nhật).
- Bảng giá kèm tiền công thợ: hợp với cách trả lương theo ca của studio và trung tâm có học viên.

**Điểm yếu**
- Trong một ô không thấy độ dài ca. Hai ca 04:30 và 06:00 trông như nối nhau, phải đọc chữ "Trùng" mới biết.
- Trên điện thoại chỉ thấy 2 ngày, phải vuốt ngang. Ở cuối vùng cuộn còn hé một mép cột của ngày trước.
- Ô cuối tuần có 3–4 ca thì hàng cao lên, cả bảng dài theo.

**Hợp với ai:** studio và trung tâm cần lên kế hoạch theo tuần, người điều phối ngồi máy tính.

**Rủi ro**
- Dễ bị coi là "Studio Pro đổi tên". Nếu giữ nguyên thói quen cũ, cũng sẽ giữ nguyên chỗ yếu cũ: không báo trùng theo giờ, vỡ trên điện thoại.

---

## 7. So sánh ngắn

| Tiêu chí | A — Cột theo thợ | B — Danh sách theo ngày | C — Lưới tuần thợ × ngày |
|---|---|---|---|
| Lịch bày theo | Giờ (dọc) × thợ (ngang), 1 ngày | Danh sách ca theo giờ, 1 ngày | Thợ × 7 ngày |
| Thấy ca trùng | Bằng hình: hai ca đỏ nằm cạnh nhau, có dải cảnh báo | Bằng chữ: khối "Cần xử lý" ở đầu, dòng đỏ trong ca | Ô đỏ, nút đếm số ca trùng |
| Phân thợ ca trống | Cột "Chưa có thợ" | Thẻ vàng + nút ngay trên ca | Hàng "Chưa có thợ" |
| Điện thoại 390 px | Vuốt ngang, khoảng 1,5 thợ/màn | Đủ, không vuốt ngang | Vuốt ngang, 2 ngày/màn |
| Máy tính 1440 px | Đầy màn, rõ nhất | Hai cột: danh sách + "Thợ trong ngày" | Đầy màn, thấy cả tuần |
| Số thợ dùng được | 2–6 | 1–20 (dùng chip lọc) | 2–8 |
| Bảng giá | Danh mục + danh sách + ngăn sửa | Danh sách mở rộng tại chỗ + thẻ gói | Bảng + thẻ gói, có tiền công thợ |
| Gần Studio Pro | Ít | Ít | Nhiều |
| Hợp nhất với | Đội 3–6 thợ, máy tính | Thợ cá nhân, đội nhỏ, dùng điện thoại | Studio/trung tâm lên lịch theo tuần |

## 8. Đề xuất của R&D: Phương án B

**Lý do chọn B**
1. **Khách hàng của Makeup Pro chủ yếu cầm điện thoại.** Thợ makeup đi ca sáng sớm tại nhà cô dâu không mở máy tính. B là phương án duy nhất trong ba bản không phải vuốt ngang ở khổ 390 px (so ba ảnh *-lich-mobile.png).
2. **Bài toán gốc là cảnh báo trùng lịch.** Studio Pro hiện không báo trên màn lịch (mục 3.1). B đưa việc trùng và việc chưa có thợ lên đầu màn, viết bằng chữ, kèm nút xử lý. Người không rành máy tính cũng hiểu ngay.
3. **Một cách bày dùng được cho cả ba nhóm khách:** thợ cá nhân (một danh sách), đội (chip lọc thợ và ô "Thợ trong ngày"), trung tâm (lọc theo thợ/học viên). A và C hợp với đội nhưng thợ cá nhân dùng thì màn trống.
4. **Tên khách dài hiện đủ.** A và C buộc phải cắt chữ.

**Điều kiện kèm theo, sẽ chốt ở Chặng 2**
- Mượn từ C: cột "Tiền công thợ" trong bảng giá và nhóm menu con quen thuộc, để đội của anh chuyển sang không bỡ ngỡ.
- Mượn từ A: giữ ô "Thợ trong ngày" (thanh thời gian theo thợ) trên máy tính. Nếu sau này đội lớn cần, thêm chế độ xem cột theo thợ làm chế độ phụ, không làm chế độ chính.
- Chỉ cho mở một dòng dịch vụ một lúc ở bảng giá.

## 9. Những gì chưa khảo sát được (và lý do)

| Hạng mục | Lý do | Ảnh hưởng |
|---|---|---|
| Ảnh chụp giao diện thật của Fresha | Playwright bị proxy trả 403 với fresha.com; WebFetch báo "getaddrinfo ENOTFOUND". Đã thử www.fresha.com và fresha.com. | Bố cục A là suy ra từ mô tả chữ, chưa đối chiếu hình. |
| Ảnh chụp giao diện thật của Vagaro, kể cả trang Vagaro Pro trên kho ứng dụng | Cùng lý do; đã thử www.vagaro.com và apps.apple.com. | Bố cục B là suy ra từ mô tả "Agenda", chưa đối chiếu hình. |
| Trang đặt lịch công khai của một salon trên Fresha/Vagaro | Không truy cập được tên miền. | Chưa có tham chiếu cho trang khách tự đặt lịch. |
| Fresha báo đặt chồng lịch cho cùng thợ thế nào | Tìm kiếm không ra tài liệu Fresha về việc này (kết quả chỉ có Square, Timely… là app khác). | Cách báo trùng trong cả ba bản mẫu là thiết kế của R&D. |
| Bảng màu trạng thái lịch hẹn của Vagaro | Biết có bài "Calendar Icons and Appointment Status Colors Legend" nhưng không đọc được nội dung. | Màu theo loại dịch vụ là R&D tự đặt. |
| Vagaro: chỗ bật/tắt cho phép đặt chồng; chỗ nhập giá và thời lượng dịch vụ | Không tìm thấy trang trợ giúp tương ứng. | Chưa rõ. |
| Fresha/Vagaro trên điện thoại | Không có tài liệu nào mô tả bố cục app điện thoại. | Bố cục điện thoại của cả ba phương án là R&D tự dựng. |
| Studio Pro với dữ liệu thật | Máy chủ API cần PostgreSQL, môi trường không có. Lịch trong ảnh là 4 ca R&D bơm vào. | Ảnh đúng giao diện nhưng không đúng dữ liệu thật của studio. |
| Studio Pro: ảnh nền bảng giá combo, phông chữ Be Vietnam Pro, Tailwind gốc | Ảnh và phông từ mạng ngoài bị chặn. R&D dựng lại CSS Tailwind 3.4.17 từ chính mã nguồn để thay bản CDN. | Khung combo thành màu xám; chữ dùng phông thay thế; màu và khoảng cách có thể lệch nhỏ so với bản anh đang chạy. |
| Ý kiến của thợ makeup thật | Chưa nằm trong Chặng 1. | Nên hỏi 2–3 thợ trước khi chốt ở Chặng 2. |

## 10. Chỗ vỡ R&D tự thấy khi mở ảnh, và đã sửa

**Phương án A**
- Thanh công cụ máy tính bị xuống 2 dòng. Đã bỏ chú giải màu khỏi thanh.
- Cột có ca trùng quá hẹp, chữ bị cắt còn "Make...". Cột này giờ tự nới rộng.
- Hàng chip danh mục ở máy tính bảng bị xén mất nửa dưới. Đã sửa.
- Nhãn cột "Chưa phân thợ" bị cắt. Đổi thành "Chưa có thợ".
- Trên điện thoại, nút "Thêm" đứng một mình giữa khoảng trống. Đã chuyển lên thanh trên cùng.
- Ô ca ngắn bị cắt nửa dòng tên khách. Ô ngắn giờ chỉ hiện 1 dòng.
- Tooltip bị cắt còn 1 dòng. Giờ tự xuống dòng và hiện phía dưới dấu ?.

**Phương án B**
- Màn điện thoại tràn ngang 352 px. Đã sửa.
- Nút tròn "+" che nút "Lưu". Đổi thành nút "+" nằm cạnh thanh chuyển tab.
- Nhãn "Cho khách đặt online" bị xuống dòng. Đổi thành "Nhận đặt online".
- Đề mục "Sáng sớm" dính sát khối "Cần xử lý". Đã thêm khoảng cách.

**Phương án C**
- Tên khách dài đẩy lưới tuần rộng ra, che mất Thứ Sáu đến Chủ nhật (đúng ngày có ca trùng). Đã khoá độ rộng cột.
- Trên điện thoại, lịch mở ra ở Thứ Hai nên không thấy ca trùng. Lưới giờ tự cuộn tới ngày có ca trùng.
- Gói makeup bị đẩy khỏi màn đầu. Đã thu gọn khoảng cách trong bảng.

**Chỗ còn biết mà chưa xử lý**
- A trên điện thoại vẫn phải vuốt ngang.
- C trên điện thoại còn hé mép cột Thứ Sáu.
- Ảnh chụp chỉ là màn hình đầu tiên, phần dưới phải cuộn mới thấy (mở tệp HTML để xem đủ).

## 11. Danh sách tệp

- Bản mẫu:
  - /home/user/a/docs/rnd/phuong-an-A.html
  - /home/user/a/docs/rnd/phuong-an-B.html
  - /home/user/a/docs/rnd/phuong-an-C.html
- Ảnh bản mẫu: /home/user/a/docs/rnd/anh/ (18 ảnh theo 3 khổ, cộng 1 ảnh tooltip)
- Ảnh tham chiếu Studio Pro: /home/user/a/docs/rnd/tham-chieu/ (10 ảnh)
- Báo cáo này: /home/user/a/docs/rnd/BAO-CAO-RND-01.md
