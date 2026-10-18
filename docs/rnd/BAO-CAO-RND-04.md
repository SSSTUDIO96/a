# Báo cáo R&D 04 — 5 màn chưa có bản vẽ

- Sản phẩm: Makeup Pro
- Người đọc: anh Chiến
- Ngày: 18/10/2026
- Người làm: Trung tâm R&D số 2
- Chặng: 1 (3 phương án mỗi màn, ảnh thật) **và** 2 (bản vẽ thông số: /home/user/a/docs/rnd/BAN-VE-C2.md)

---

## 1. Kết luận — R&D đã chọn thay anh

Anh đang ngủ và đã giao "Cứ làm toàn bộ hết đi", nên ở mỗi màn **R&D tự chọn một phương án** để thợ làm được ngay. **Đây là quyết định thay, anh bác được**: ảnh của cả 3 phương án vẫn giữ trong /home/user/a/docs/rnd/anh/, anh chỉ cần nói "màn X lấy A" là đổi.

| # | Màn | Chọn | Một câu lý do |
|---|---|---|---|
| 1 | Nhân sự & trả lương | **C** — hai cột | Màn "Tiền công theo gói" đúng lời anh tả: mỗi **cấp bậc** một hàng, có **ảnh và tên** thợ, rồi **ô nhập tiền**. Gán bậc chỉ 3 lần bấm. |
| 2 | Khách hàng | **C** — danh sách trái, hồ sơ phải | Tìm theo số điện thoại rồi thấy ngay hợp đồng và lịch của khách: 3 lần bấm, danh sách không mất. |
| 3 | Thu tiền (hợp đồng dịch vụ) | **A** — y khuôn Thu tiền đào tạo | Đúng yêu cầu "cùng một mẫu" với màn đào tạo R&D vòng 3 đã vẽ. Ít bấm nhất (5). |
| 4 | Hồ sơ thương hiệu & trang giới thiệu | **C** — sửa trái, xem trước phải | Gõ tới đâu thấy trang khách xem tới đó, không phải bấm "Xem trước". |
| 5 | Quản trị nền tảng SaaS | **B** — trang chủ việc cần làm | Anh nói "trang chủ để quản lý SaaS": mở ra là thấy ai sắp hết hạn, ai đang ân hạn, bấm "Gia hạn" ngay (3 lần bấm thay vì 6). |

Cả 5 màn đều cùng họ C: cùng màu, chữ, khung điều hướng của BAN-VE-C.md. Không màn nào có chữ "lợi nhuận". Trang quản trị không có mật khẩu dùng chung.

**Cần anh xem nhất** (theo thứ tự):
1. Màn 1: R&D **đoán** "giao diện trả lương của ssnew" (xem mục 3). Anh nhìn ảnh /home/user/a/docs/rnd/anh/v4-nhan-su-c-tien-cong-desktop.png xem có giống cái anh muốn không.
2. Màn 3: khuôn đào tạo (vòng 3) có 3 ô **chưa có dữ liệu** ở máy chủ ("Áp vào đợt", "Vào tài khoản", "Người thu"). Bản vẽ này **bỏ 3 ô đó** cho cả dịch vụ lẫn đào tạo, đến khi máy chủ thêm trường. Hàng đợi "Quá hạn / 7 ngày tới" cũng chưa làm được (cần đường mới) — tạm nhóm theo **ngày sự kiện**.
3. Màn 4: địa chỉ trang công khai đặt là `/trang/tên-studio`. Đội máy chủ phải cấm đặt tên tổ chức là `trang` trước khi phát hành (một dòng mã).

## 2. Cách xem

Mở bằng trình duyệt, không cần mạng. Thêm `#tên-màn` vào cuối đường dẫn. Không có `#` thì ra **mục lục** của tệp. Nút "Hiện trường dữ liệu" (góc phải dưới) dán nhãn tím lên từng ô, ghi ô đó đọc/ghi trường nào của máy chủ.

| Tệp | Màn trong tệp |
|---|---|
| /home/user/a/docs/rnd/v4-nhan-su.html | A: `#a`, `#a-ho-so`, `#a-tien-cong` · B: `#b`, `#b-tien-cong` · **C**: `#c`, `#c-m-tho`, `#c-ho-so`, `#c-bac`, `#c-them`, `#c-tien-cong`, `#c-tien-cong-ct`, `#c-tien-cong-xem`, `#c-trang-thai` |
| /home/user/a/docs/rnd/v4-khach-hang.html | A: `#a`, `#a-ct` · B: `#b`, `#b-ct` · **C**: `#c`, `#c-ct`, `#c-tim`, `#c-sua`, `#c-moi`, `#c-trang-thai` |
| /home/user/a/docs/rnd/v4-thu-tien.html | **A**: `#a`, `#a-ct`, `#a-tien-do`, `#a-lech`, `#a-hoan`, `#a-vuot`, `#a-huy`, `#so-thu`, `#doanh-thu`, `#trang-thai` · B: `#b`, `#b-thu` · C: `#c` |
| /home/user/a/docs/rnd/v4-thuong-hieu.html | A: `#a` · B: `#b`, `#b-xem` · **C**: `#c`, `#c-xem`, `#c-chua`, `#c-go` · trang công khai: `#trang`, `#trang-404` |
| /home/user/a/docs/rnd/v4-quan-tri.html | A: `#a`, `#a-ct` · **B**: `#b`, `#b-ds`, `#b-ct`, `#gia-han`, `#khoa`, `#b-goi`, `#goi-sua`, `#trang-thai`, `#khong-quyen` · C: `#c` |

Phần dùng chung của 5 tệp: /home/user/a/docs/rnd/v4-chung/ (`v4.css` token + component theo BAN-VE-C; `v4.js` khung; `phong/` phông Be Vietnam Pro tự chứa, giấy phép OFL kèm theo).

## 3. Đã học từ đâu (có nguồn thì ghi nguồn, không có thì nói thẳng)

### 3.1 Studio Pro của anh

Phiếu giao việc ghi "không có mã trong máy này". Thực tế R&D tìm thấy **bản sao chỉ-đọc** mà R&D vòng 3 đã lấy về trong thư mục nháp của phiên: `/tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/repos/ssaas` (và bản "STUDIO PRO 2026" ở `…/repos/Nguy-n-Tr-ng-Chi-n`). R&D **chỉ đọc**, không chạy, không sửa.

| Điều thấy | Ở đâu (trong bản sao) | Dùng thế nào |
|---|---|---|
| Quản lý cấp bậc: tên, **màu**, thứ tự lên/xuống | `pages/settings/components/RankManagerModal.tsx` dòng 58–128 | Hộp "Bậc lương": tên + thứ tự (kéo) + bật/tắt. **Không** có màu (máy chủ mình chưa có trường → đề xuất). |
| Tiền công theo cấp bậc nằm sâu trong Cài đặt lương, mở bằng nút "▶ Cấu hình Makeup theo cấp bậc", ghi "Để trống = dùng giá trị mặc định" | `pages/settings/components/SalarySettings.tsx` dòng 1189–1397 | Mình đưa ra **màn riêng** "Tiền công theo gói", 2 lần bấm từ menu. Giữ ý "để trống = chưa đặt". |
| "Lương Sản Phẩm": bảng Ngày · Hợp đồng · Công việc · Số tiền | `pages/personnel/components/ProductSalary.tsx` dòng 172–284 | Bảng lương tháng **chưa có** ở máy chủ mình → ghi đề xuất, không vẽ. |
| Bảng lương tổng hợp có ảnh + tên từng người | `pages/personnel/components/ConsolidatedPayroll.tsx` dòng 203 | Ảnh + tên trên mỗi hàng bậc. |
| Hồ sơ nhân viên: ảnh tròn lớn, bấm để đổi | `pages/personnel/components/EmployeeInfo.tsx` dòng 587–671 | Hộp "Hồ sơ thợ": ảnh tròn 72px + "Đổi ảnh". |
| Khách hàng: 2 tab "Khách tiềm năng / Danh sách", cột Hạng, Tổng chi tiêu, Số HĐ, Người phụ trách; chi tiết có "Lịch sử Hợp đồng" | `pages/customers/Customers.tsx` dòng 84–172, 564–733 | Giữ "lịch sử hợp đồng" trong hồ sơ khách. Các cột khác **chưa có trường** → đề xuất. |
| Thông tin studio: tên, mã số thuế, địa chỉ, SĐT, email, **link Google Map**, Facebook/Instagram/TikTok/Zalo, ngân hàng | `pages/settings/components/StudioInfoSettings.tsx` dòng 73–119 | Nhóm "Liên hệ" của hồ sơ thương hiệu. Map và ngân hàng chưa có trường → đề xuất. |
| Trang "SS PRO ADMIN": 4 tab (Tổ chức · Danh sách chờ · Bảng giá gói · Yêu cầu mật khẩu), bảng tổ chức 7 cột, **mật khẩu quản trị mặc định "123"**, nút đặt lại mật khẩu cho studio bằng hộp `prompt`, đổi mật khẩu Super Admin | `pages/saas/SaasDashboard.tsx` dòng 29–250, 293–375, 539, 1029 | Phương án A học bố cục tab + bảng. **Bỏ hết** phần mật khẩu (đúng lỗi số 6 đã ghi trong nhật ký). |

### 3.2 "ssnew" — không có trong máy, đây là suy luận

R&D **không có** mã, ảnh hay mô tả nào của "ssnew" (đã tìm chữ `ssnew` trong kho `a` và các bản sao Studio Pro trên máy: chỉ thấy trong sổ ý muốn, không có phần mềm nào tên đó). Màn "Tiền công theo gói" được **suy ra từ đúng câu anh nói**: *"để 1 gói thì sẽ trả đúng theo giao diện trả lương của ssnew là sẽ hiển thị cấp bậc kèm avatar tên rồi nhập số tiền"*:
- "1 gói" → mỗi lần xem tiền công của **một** gói (chọn gói ở cột trái).
- "hiển thị cấp bậc" → mỗi bậc một hàng, tên bậc chữ to.
- "kèm avatar tên" → dưới tên bậc là ảnh + tên **từng thợ** thuộc bậc (không dồn thành chồng ảnh, để nhìn ra ai).
- "rồi nhập số tiền" → ô tiền ở bên phải hàng.
Nếu ssnew làm khác (ví dụ mỗi **thợ** một hàng thay vì mỗi bậc), anh gửi ảnh, R&D vẽ lại. Máy chủ hiện lưu tiền công **theo bậc**, không theo từng người.

### 3.3 Fresha, Vagaro

Công cụ đọc trang (WebFetch) **không mở được** fresha.com (lỗi "getaddrinfo ENOTFOUND www.fresha.com"). R&D chỉ đọc được **đoạn trích của công cụ tìm kiếm**; không ghi điều gì đoạn trích không nói.

| Nguồn | Đoạn trích nói gì | Dùng thế nào |
|---|---|---|
| Fresha — Set up commissions for team members: https://www.fresha.com/help-center/knowledge-base/team/98-set-up-commissions-for-team-members | Hoa hồng đặt trong **hồ sơ từng nhân viên** (Pay → Commissions), mức cố định hoặc bậc thang theo doanh số; có thể chỉnh riêng từng dịch vụ; dịch vụ thêm (add-on) có mức riêng | Mình đặt theo **bậc × gói** (hợp studio nhiều thợ cùng tay nghề). Mức riêng từng thợ → đề xuất. Dịch vụ phụ có tiền công riêng: đã có (cột trái có nhóm "Dịch vụ phụ"). |
| Fresha — Create client profiles: https://www.fresha.com/help-center/knowledge-base/clients/320-create-client-profiles ; trang tính năng https://fresha.com/for-business/features | Thông tin liên hệ ở đầu hồ sơ, bấm số/email để liên hệ; xem lịch hẹn, bán hàng của khách; có báo trùng khách và gộp | Số điện thoại trong hồ sơ là liên kết gọi. Báo trùng số → đề xuất. |
| Fresha — Create your online profile: https://www.fresha.com/help-center/knowledge-base/online-presence/266-create-your-online-profile ; Update opening hours: https://www.fresha.com/help-center/knowledge-base/workspace-settings/588-update-your-business-opening-hours | Trang hồ sơ online: liên hệ, địa chỉ có ghim bản đồ, giờ mở cửa (chỉ để khách xem, không quyết định giờ đặt được), **ít nhất 3 ảnh cơ sở**, xuất bản xong ~15 phút mới hiện | Giờ làm việc ghi rõ "chỉ để khách xem, không chặn lịch". Album ảnh, bản đồ → đề xuất (máy chủ chưa có). |
| Vagaro (bài cho người chuyển từ Schedulicity): https://www.vagaro.com/en-au/learn/7-vagaro-reports-for-schedulicity-users | Xem lịch sử hẹn của khách: mở khách → tab Appointments, có lọc theo trạng thái, dịch vụ, thợ, ngày | Thẻ "Lịch makeup" trong hồ sơ khách. Lọc trong thẻ chưa vẽ (khách thường ít lịch). |

### 3.4 Phần mềm Việt Nam

**Chưa khảo sát được.** Tìm "phần mềm quản lý spa thu tiền công nợ khách hàng phiếu thu đặt cọc KiotViet" chỉ ra đoạn trích chung chung (KiotViet Salon quản lý lịch hẹn, giao dịch, doanh thu trên điện thoại — https://apps.apple.com/vn/app/id1593051989; bài MISA eShop về công nợ quá hạn — https://www.misaeshop.vn/22603/phan-mem-quan-ly-cong-no/). Không nguồn nào cho thấy màn thu cọc/thu đợt cụ thể. Phần thu tiền vì vậy **dựa trên** máy chủ của mình + khuôn đào tạo C (vòng 3) + Studio Pro (vòng 3 đã đọc `PaymentManagementModal.tsx`, `financialUtils.ts`).

### 3.5 Trang quản trị SaaS của sản phẩm khác

**Chưa khảo sát.** Phương án A học Studio Pro; B và C là suy luận từ những gì máy chủ trả (`/platform/stats` có sẵn "sắp hết hạn 30 ngày" và "doanh thu thuê bao dự kiến").

## 4. Ba phương án từng màn và số đo

**Cách đo**
- **Số lần bấm**: tính trên máy tính, từ khi đang ở một trang bất kỳ của app, tới lúc lưu xong. Không tính gõ phím; chuyển giữa các ô bằng phím Tab.
- **Số ô trên màn đầu**: máy đếm (Playwright) mọi thứ bấm/gõ được nằm trong khung 1440×900 đầu tiên, không tính thanh trái. Số càng lớn màn càng dày; không phải cứ ít là tốt.
- **Ảnh**: mỗi màn chính 3 khổ 1440 / 1024 / 390, tên `v4-{màn}-{mã}-{desktop|tablet|mobile}.png`. Mọi ảnh 390px đã kiểm: **không tràn ngang** (`scrollWidth = 390`). R&D đã mở từng ảnh ra xem và sửa các lỗi thấy được (mục 6).

### 4.1 Nhân sự & trả lương

| | A — Bảng nhân sự, chia tab | B — Cột theo bậc + ma trận | **C — Hai cột như Hợp đồng C** |
|---|---|---|---|
| Ảnh | v4-nhan-su-a-*, -a-ho-so-*, -a-tien-cong-* | v4-nhan-su-b-*, -b-tien-cong-* | v4-nhan-su-c-*, -c-tien-cong-*, -c-tien-cong-ct-*, -c-ho-so-*, -c-bac-*, -c-them-* |
| Đặt tiền công 1 gói cho mọi bậc | 6 bấm (tab, mở ô chọn gói, chọn gói…) | **4 bấm** | 5 bấm (gói kế tiếp: +3) |
| Gán bậc cho 1 thợ | 5 bấm (mở ngăn kéo, chọn, Lưu) | 4 bấm | **3 bấm** (ô chọn ngay trên dòng, lưu ngay, có Hoàn tác) |
| Ô trên màn đầu (thợ / tiền công) | 22 / 10 | 10 / **56** | 27 / 17 |
| Đúng lời anh "cấp bậc + avatar tên + nhập tiền" | có, nhưng phải chọn gói ở ô chọn | **không**: ảnh bị dồn thành chồng nhỏ ở đầu cột | **có**, nhìn thấy mọi gói bên trái |
| Máy chủ | đủ | **thiếu**: phải gọi 1 lần cho mỗi gói (10 gói = 10 lần) | đủ |
| Điện thoại | bảng thành thẻ | ma trận phải cuộn ngang trong thẻ | danh sách → màn con |

**Chọn C.** B nhanh nhất về số bấm nhưng ma trận 56 ô là đúng kiểu "rối" anh đã chê, mất ảnh + tên, và máy chủ chưa phục vụ được. C giữ đúng hình anh tả, cùng khuôn Bảng giá/Hợp đồng C.

### 4.2 Khách hàng

| | A — Bảng + trang chi tiết có tab | B — Thẻ + ngăn kéo phải | **C — Danh sách trái, hồ sơ phải** |
|---|---|---|---|
| Ảnh | v4-khach-hang-a-*, -a-ct-* | v4-khach-hang-b-*, -b-ct-* | v4-khach-hang-c-*, -c-ct-*, -c-tim-*, -c-sua-*, -c-moi-* |
| Tìm khách theo SĐT rồi xem hợp đồng | 4 bấm (thêm bấm tab) | 3 bấm | **3 bấm**, danh sách vẫn ở đó để xem khách kế (+1) |
| Thêm khách mới | 3 | 3 | 3 |
| Ô trên màn đầu | 12 | 10 | 16 |
| Thấy cùng lúc thông tin + hợp đồng + lịch | không (3 tab) | có (cuộn trong ngăn kéo) | **có** |

**Chọn C.** Lễ tân thường nghe điện thoại rồi tìm khách: C cho tìm và xem liên tục nhiều khách mà không đóng/mở gì.

### 4.3 Thu tiền hợp đồng dịch vụ

Cả 3 phương án **giữ khuôn đào tạo C** (thẻ đầu + 4 ô số + Tiến độ + Phiếu), chỉ khác chỗ đặt form ghi phiếu.

| | **A — Y khuôn đào tạo: form luôn mở ở dưới** | B — Nút "Thu" trên từng đợt, mở hộp thoại | C — Tab "Thu tiền" trong trang hợp đồng |
|---|---|---|---|
| Ảnh | v4-thu-tien-a-*, -a-ct-*, -a-tien-do-*, -a-lech-*, -a-hoan-*, -a-vuot-*, -a-huy-*, -so-thu-*, -doanh-thu-* | v4-thu-tien-b-*, -b-thu-* | v4-thu-tien-c-* |
| Ghi phiếu thu đợt kế tiếp | **5 bấm** (số tiền điền sẵn) | 6 | 6 |
| Lập tiến độ "Cọc + còn lại vào ngày sự kiện" | 6 | 6 | 7 |
| Ô trên màn đầu | 21 | 14 | 14 |
| Cùng mẫu với màn đào tạo | **y hệt** | gần | khác (không có cột trái) |

**Chọn A.** Phiếu giao việc đòi "dùng cùng một mẫu"; A là y mẫu, lại ít bấm nhất. Báo cáo Doanh thu và Sổ thu vẽ theo khuôn Thống kê C của vòng 3 (bộ lọc trái, số liệu phải), **bỏ** lọc "Loại hợp đồng / Nhóm khoá" vì máy chủ chưa có trường.

### 4.4 Hồ sơ thương hiệu & trang giới thiệu

| | A — Một cột dài, thanh lưu dính đáy | B — Chia tab, xem trước trong hộp | **C — Sửa trái, xem trước phải** |
|---|---|---|---|
| Ảnh | v4-thuong-hieu-a-* | v4-thuong-hieu-b-*, -b-xem-* | v4-thuong-hieu-c-*, -c-xem-*, -c-chua-*, -c-go-* ; trang khách: -trang-*, -trang-404-* |
| Sửa giờ làm một ngày rồi lưu | 3 | 4 | 3 |
| Xem trang khách thấy | +1 (mở tab mới) | +2 (mở, đóng hộp) | **0** (luôn hiện) |
| Ô trên màn đầu | 15 | 20 | 19 |

**Chọn C.** Chủ studio sửa giới thiệu để **khách đọc**; thấy ngay kết quả thì đỡ phải đoán. Trên điện thoại C thành 2 nút chuyển "Sửa hồ sơ · Xem trước".

### 4.5 Quản trị nền tảng SaaS

| | A — Giống SS Pro: tab + bảng + hộp chi tiết | **B — Trang chủ việc cần làm + danh sách hai cột** | C — Hai cột thuần |
|---|---|---|---|
| Ảnh | v4-quan-tri-a-*, -a-ct-* | v4-quan-tri-b-*, -b-ds-*, -b-ct-*, -gia-han-*, -khoa-*, -b-goi-*, -goi-sua-* | v4-quan-tri-c-* |
| Gia hạn 12 tháng cho tổ chức sắp hết hạn | 6 | **3** (bấm "Gia hạn" ngay trên trang chủ) | 6 |
| Tạm khoá có lý do | 3 + tìm | 3 + tìm | 3 + tìm |
| Ô trên màn đầu | 14 | 6 (trang chủ) / 19 (Tổ chức) | 19 |
| Trả lời "hôm nay phải làm gì" | phải lọc | **có sẵn** | phải bấm chip |

**Chọn B.** Đúng chữ "trang chủ" anh dùng, và việc chính của người quản trị là gia hạn đúng lúc. Từ Studio Pro chỉ giữ bố cục; **không** có đăng nhập riêng, mật khẩu chung, đổi/đặt lại mật khẩu hộ. Người thường mở `/quan-tri` thấy đúng màn "Không có trang này." như đường bịa (`#khong-quyen`).

## 5. Những gì chưa làm được (và vì sao)

1. **Hàng đợi "Quá hạn / 7 ngày tới / Sau đó" ở màn Thu tiền** — máy chủ không có đường liệt kê các đợt chưa thu của mọi hợp đồng. Tạm nhóm theo ngày sự kiện. Đề xuất `GET /payments/due` (BAN-VE-C2 mục 3.8).
2. **"Còn lại" trên từng dòng danh sách hợp đồng** (màn Thu tiền, màn Khách) — danh sách hợp đồng chưa trả số này.
3. **Lịch tạo lẻ của một khách** (không gắn hợp đồng) — chưa lọc lịch theo khách được.
4. **Khảo sát phần mềm Việt Nam và trang quản trị SaaS khác** — không mở được trang, chỉ có đoạn trích (mục 3.4, 3.5).
5. **Màn "Thành viên & vai trò"** (đổi vai trò, tạm khoá nhân sự) — không nằm trong 5 màn được giao; màn Nhân sự chỉ có "Thêm thợ".
6. **Chế độ tối** — BAN-VE-C đã để sau; vòng này cũng không vẽ.
7. **Ảnh tương tác thật** (rê chuột, kéo thả) — bản mẫu là ảnh tĩnh; hộp gợi ý biểu đồ được vẽ sẵn trong ảnh để thấy hình dáng.

## 6. R&D đã tự soát và sửa gì

Mở từng ảnh ra xem; các lỗi thấy được đã sửa trước khi chụp lại:
- Trình duyệt tự cuộn tới khu vực có `#tên-màn`, làm ảnh điện thoại hụt 64px đầu → đổi cách đặt tên khu vực.
- Ảnh đại diện vẽ bằng SVG không hiện (sai dấu nháy) → sửa.
- Ảnh chụp điện thoại có thanh dưới đè giữa trang → chụp với khung cao bằng cả trang.
- Màn Khách ở máy tính bảng: 2 thẻ Hợp đồng/Lịch đặt cạnh nhau bị bóp, chữ mã gãy dòng → xếp chồng dọc.
- Hộp "Khách mới": nhãn "Ghi chú" bị căn giữa do trùng tên lớp → sửa.
- Thu tiền điện thoại: 4 nút "Cách trả" tràn khỏi cột; tiêu đề thanh trên biến thành ô đen (trùng tên lớp với hộp gợi ý biểu đồ) → sửa.
- Doanh thu: hộp gợi ý biểu đồ thò ra ngoài màn 1440 → neo về phải; điện thoại ẩn; số liệu bị ẩn trên điện thoại → hiện bộ lọc trên, số liệu dưới.
- Hồ sơ thương hiệu điện thoại: 3 ô ảnh biến mất (trùng tên lớp với tiêu đề trang) và bị kéo giãn → sửa.
- Nhân sự máy tính bảng: nút "Hồ sơ" bị ẩn → hiện lại.
- Dữ liệu minh hoạ ma trận B: tiền công lớn hơn giá gói → sửa số.

Bảng màu biểu đồ (Doanh số `#A63D62`, Thực thu `#5B45A0`) đã chạy bộ kiểm màu: đạt cả với người mù màu (độ khác ΔE 11,8; ngưỡng 8).

## 7. Đề xuất trường mới (gom từ BAN-VE-C2, KHÔNG vẽ lên màn)

| Màn | Đề xuất | Vì sao |
|---|---|---|
| Nhân sự | Tiền công riêng từng thợ · đọc tiền công nhiều gói một lần · tên vai trò trong `/staff` · màu bậc · mời thợ chưa có tài khoản · bảng lương tháng · xem thợ đang tạm khoá | Fresha, Studio Pro có; ma trận B cần |
| Khách hàng | Lọc lịch theo khách · `paid/remaining` trong danh sách hợp đồng · ảnh khách · báo trùng số · địa chỉ, nguồn khách, hạng… · ẩn khách | Vagaro, Fresha, Studio Pro |
| Thu tiền | `GET /payments/due` · `Contract.kind` · áp vào đợt, vào tài khoản, người thu · ảnh minh chứng · lọc hợp đồng chưa có ngày sự kiện · xuất CSV phía máy chủ | khuôn đào tạo v3, Studio Pro |
| Thương hiệu | Album ảnh · link bản đồ · thẻ chia sẻ `og:` · nút đặt lịch · dọn ảnh mồ côi · tên miền riêng | Fresha, Studio Pro |
| Quản trị | Cờ `isPlatformAdmin` · số tổ chức mỗi gói · lý do khoá đọc lại được · nhật ký theo tổ chức · tiền thuê bao đã thu · đếm học viên/khoá | Studio Pro |

## 8. Bước tiếp theo

- Điều phối giao 7 gói mới (W8–W13, W10b) theo bảng **BAN-VE-C2 mục 6** — mỗi gói một thư mục `src/features/<tên>/**` và một tệp API mới, không giẫm nhau; các tệp chung (nav, routes, ui, org.ts) gom yêu cầu cho chủ tệp.
- Đội máy chủ: thêm `trang` vào danh sách tên cấm (trước khi dựng trang công khai).
- Điều phối nên chép 5 dòng "quyết định thay" ở mục 1 vào /home/user/a/docs/NHAT-KY-QUYET-DINH-THAY.md (R&D không tự sửa tệp đó).
