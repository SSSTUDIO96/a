# Báo cáo R&D 05 — Thông báo trong app · Loại sự kiện cho ca makeup

- Sản phẩm: Makeup Pro
- Người đọc: anh Chiến (chủ studio)
- Ngày: 19/10/2026
- Chặng: **1** theo luật của anh: 3 phương án mỗi đề tài, có ảnh thật. **Cố ý chưa làm bản vẽ thông số** (chặng 2). R&D chỉ đề xuất, **không chọn thay anh**.

---

## 0. Đọc nhanh

| Đề tài | R&D đề xuất | Một câu lý do | Cần anh quyết |
|---|---|---|---|
| 1. Thông báo | **B: trang "Hôm nay"** làm trước. Khi anh chọn được kênh gửi ra ngoài thì làm thêm **C: bản tin sáng**. A (chuông) để sau. | B rẻ nhất (khoảng 7–8 buổi), **không cần bảng dữ liệu mới, không cần việc chạy hẹn giờ, không tốn phí**. Nó tự tính từ dữ liệu đang có nên không bao giờ "báo sai, báo sót". | Có gửi ra **Zalo / SMS / Email** không, và gửi qua kênh nào. Cả ba đều tốn phí và phải làm thủ tục. Trang "Hôm nay" có thay Lịch làm trang mở đầu không. |
| 2. Loại sự kiện | **C: danh sách do studio tự đặt**, gắn ở **từng dòng** hợp đồng. Lịch có công tắc **"Tô màu: Sự kiện / Nhân vật"**. | Giống cách anh đã chọn cho Nhân vật và Bậc lương (studio tự đặt). Phân biệt được "Lễ vu quy sáng" với "Tiệc tối" trong **cùng một ngày**. Bấm "Nhân vật" là về đúng màu như hôm nay. | Chọn A, B hay C. Tên các loại sự kiện có sẵn. Lịch mở ra tô theo Sự kiện hay theo Nhân vật. |

Thuật ngữ, mỗi từ giải thích một lần:
- **Máy chủ**: phần mềm chạy trên mạng, nơi giữ dữ liệu của studio. **Web**: phần anh nhìn và bấm trên máy tính hoặc điện thoại.
- **Trường dữ liệu**: một ô thông tin mà máy chủ lưu lại, ví dụ "ngày sự kiện của hợp đồng". **Bảng**: một nhóm trường cùng loại, ví dụ bảng Hợp đồng.
- **Đường (API)**: cửa để web hỏi máy chủ lấy dữ liệu.
- **Việc chạy hẹn giờ**: máy chủ tự làm một việc vào giờ đã đặt, ví dụ 7:00 sáng mỗi ngày. Hiện máy chủ **chưa có** loại việc này.
- **Zalo OA**: tài khoản Zalo chính thức của doanh nghiệp. **ZNS**: dịch vụ gửi tin thông báo qua Zalo theo mẫu tin đã được Zalo duyệt, tính tiền theo từng tin.
- **SMS brandname**: tin nhắn điện thoại hiện tên thương hiệu (ví dụ CHIENMAKEUP) thay cho số máy. Phải đăng ký tên với nhà mạng.
- **Buổi**: một buổi làm việc, khoảng 4 giờ, của một thợ lập trình, đã tính cả viết bài thử. Mọi số buổi trong báo cáo là **ước lượng**, sai số khoảng ±30%.

## 1. Cách xem bản mẫu

Mở tệp bằng trình duyệt, không cần mạng.
- Thêm `#tên-màn` vào cuối đường dẫn để mở một màn. Không có `#` thì ra mục lục.
- Thêm `+f` (ví dụ `#a+f`) để hiện nhãn **trường dữ liệu**: nhãn **tím** là trường đã có ở máy chủ, nhãn **nâu** là trường MỚI do R&D đề xuất.
- Trên mọi ảnh, ô nào có **viền nâu nét đứt** là ô cần dữ liệu mới, máy chủ chưa có. R&D không vẽ ô đó như thể đã có.

| Tệp | Màn |
|---|---|
| /home/user/a/docs/rnd/v5-thong-bao.html | A: `#a`, `#a-tho`, `#a-cai-dat` · B: `#b`, `#b-tho` · C: `#c`, `#c-kenh`, `#c-cai-dat` |
| /home/user/a/docs/rnd/v5-su-kien.html | Trước: `#truoc-c`, `#truoc-b`, `#truoc-a`, `#truoc-hd` · A: `#a-c`, `#a-b`, `#a-a`, `#a-hd` · B: `#b-c`, `#b-b`, `#b-a`, `#b-hd` · C: `#c-c`, `#c-b`, `#c-a`, `#c-nv`, `#c-hd`, `#c-ds` |

**Dùng đúng design system đang chạy.** Tệp /home/user/a/docs/rnd/v5-chung/san-pham.css là **bản chép nguyên văn** các tệp kiểu của sản phẩm: `styles/tokens.css`, `base.css`, `ui/ui.css`, `ui/list.css`, `layout/layout.css`, `features/schedule/schedule.css`, `features/contracts/contracts.css`. Bản mẫu dùng lại đúng tên lớp của sản phẩm (thanh trái `sh-*`, Lịch `ws-*`, Hợp đồng `ct-*`, nút, thẻ, công tắc `ui-*`) và đúng phông Be Vietnam Pro (/home/user/a/docs/rnd/v4-chung/phong.css). Phần mới (chuông, ngăn kéo, bản tin, ô chọn sự kiện) nằm trong /home/user/a/docs/rnd/v5-chung/v5.css, và chỉ dùng màu có sẵn trong tokens.css. Lịch 3 chế độ được dựng bằng /home/user/a/docs/rnd/v5-chung/v5-lich.js, theo đúng cấu trúc của `WeekGridC`, `WeekGridCMobile`, `DayListB`, `StaffColumnsA`.

Ảnh nằm trong /home/user/a/docs/rnd/anh-rnd05/: **66 ảnh**, mỗi màn chụp ở khổ 1440 và 390, thêm 14 ảnh có nhãn trường (tên tệp có đuôi `-nhan-truong-1440`). Ảnh nặng nhất 399 KB. R&D đã **mở xem từng ảnh** và sửa các lỗi thấy được (mục 6).

Dữ liệu trong bản mẫu là dữ liệu minh hoạ: tuần 16–22/11/2026, hôm nay là Thứ Bảy 21/11 lúc 7:30, tổ chức loại ACADEMY (vừa làm makeup vừa đào tạo). Tên khách, tên thợ lấy theo dữ liệu thử trong các ảnh nghiệm thu, thêm vài tên bịa.

## 2. Đã học từ đâu

**Không mở được trang nào của Fresha, Vagaro, Square, Booksy.** Công cụ đọc trang báo `getaddrinfo ENOTFOUND`, còn lệnh tải trang qua cổng mạng bị chặn (`CONNECT tunnel failed, response 403`). R&D chỉ đọc được **đoạn trích của công cụ tìm kiếm**, và chỉ ghi lại điều mà đoạn trích nói.

| Nguồn | R&D thấy gì | Dùng thế nào |
|---|---|---|
| **Studio Pro của anh** (bản sao chỉ đọc mà R&D vòng 3 đã lấy: `/tmp/claude-0/-home-user/98e5e0bd-…/scratchpad/repos/ssaas`) | `components/NotificationCenter.tsx` + `contexts/NotificationContext.tsx`: có chuông, ngăn thông báo chia theo bộ phận (Sale, Lễ tân, Photo, Makeup, Chung), có lọc, có nút "Đọc tất cả". **Thông báo lưu ở bộ nhớ của trình duyệt** (`utils/tenantStorage.ts`, dùng `localStorage`), nên sang máy khác hay điện thoại khác là không thấy. | Phương án A học bố cục chuông và ngăn kéo, nhưng **lưu ở máy chủ** để mọi máy đều thấy. |
| Studio Pro · `pages/settings/components/ZaloAutomationSettings.tsx`, `data/settingsData.ts` | Có 9 "kịch bản" tin Zalo gửi **cho khách** (ví dụ "Nhắc lịch chụp (Trước 1 ngày)" lúc 09:00), soạn mẫu tin có chèn biến. Mặc định **"Thủ công (Nhắc NV)"**; muốn "Auto Zalo OA" thì phải nhập khoá API. `pages/api/webhooks/zalo.ts` ghi rõ "Mock Sending Reply". R&D **không thấy** đoạn mã nào gửi tin Zalo thật. | Bản tin của phương án C học cách soạn mẫu tin. R&D ghi rõ: muốn gửi Zalo thật thì phải có Zalo OA và mẫu tin được Zalo duyệt. |
| Studio Pro · `pages/overview/Overview.tsx` dòng 634–648 | Ô "Cảnh báo Vận hành (Cần xử lý ngay)": quá hạn trả ảnh, thiếu phân công Photo/Makeup. | Đây là gốc của phương án B (trang "Hôm nay"). |
| Studio Pro · `pages/schedule/components/BoardView.tsx` dòng 63–104, `ScheduleEventCard.tsx` dòng 11–30, `types.ts` dòng 540–541 | Tô màu lịch theo "Ngày Cưới", "Ngày Ăn hỏi" bằng cách **đoán từ chữ trong tên** (`title.includes('ăn hỏi')`). Gói có cấu trúc riêng ngày ăn hỏi và ngày cưới (`engagementDay`, `weddingDay`). | **Không** học cách đoán theo chữ, vì gõ sai chữ là ra sai màu. Sản phẩm của mình cũng đã cấm đoán theo chữ (`model.ts` dòng 21–22). Cả 3 phương án đều dùng **trường dữ liệu riêng**. |
| Studio Pro · `contexts/SettingsContext.tsx` dòng 125 | Danh sách nhóm dịch vụ studio tự đặt: Cưới Studio, Baby, Gia đình, Sinh nhật, Bầu, Concept, Couple, Kỷ yếu, Khác. | Ủng hộ phương án C (danh sách do studio tự đặt). |
| Fresha (đoạn trích tìm kiếm) — https://www.fresha.com/help-center/knowledge-base/personal-account/36-manage-your-personal-notifications | Mỗi nhân viên **tự chọn** nhận thông báo về "chỉ của mình" hay "cả nhóm", tích chọn từng loại (đặt lịch mới, xác nhận, dời lịch, khách không đến, huỷ). Có **email tóm tắt hằng ngày / tuần / tháng**. Thông báo về lịch hẹn cho nhân viên **hiện chỉ gửi qua email**. | A: mỗi người tự bật/tắt. C: bản tin hằng ngày. |
| Square Appointments (đoạn trích) — https://squareup.com/help/us/en/article/6729-manage-appointment-booking-notifications-and-reminders ; https://square.com/help/ca/en/article/5350-create-staff-member-profiles-for-square-appointments | Bật/tắt email và SMS **cho từng nhân viên**, có thể gửi kèm một bản cho chủ. Một bài trên diễn đàn (cũ) nói không có tin nhắc lịch qua SMS cho nhân viên. | A: bảng bật/tắt theo kênh. |
| Square (đoạn trích) — https://squareup.com/help/us/en/article/8442-set-up-calendar-view-filters-for-appointments | Lịch có mục "Color Code: **By Staff / By Service**" (tô màu theo nhân viên hoặc theo dịch vụ). Phải gán màu cho từng dịch vụ trước. | Phương án C: công tắc "Tô màu: Sự kiện / Nhân vật". |
| Vagaro (đoạn trích) — https://www.vagaro.com/en-au/pro/notifications | Nhắc lịch cho **khách** qua email/tin nhắn. Báo cho cơ sở khi có lịch mới đặt. Một trang so sánh có ghi "Color Codes/Icons" là tính năng của Vagaro. | **Chưa khảo sát được** cách Vagaro tô màu và thông báo cho nhân viên. Không dùng điểm nào cụ thể. |
| Booksy | Chỉ có một bài blog chung chung (https://biz.booksy.com/blog/worry-free-booking). | **Chưa khảo sát được Booksy.** |
| Phần mềm khác (đoạn trích) | Bookly: gửi **lịch làm việc trong ngày qua email** cho nhân viên (https://support.booking-wp-plugin.com/hc/en-us/articles/212411249). Phorest, Pabau: màu theo **nhóm dịch vụ**, các dịch vụ trong nhóm dùng chung màu đó. | Củng cố C (bản tin) và C (danh sách có màu). |
| Zalo ZNS (đoạn trích Infobip) — https://www.infobip.com/docs/zalo/compliance-guidelines.md | Tin một chiều, theo **mẫu đã được duyệt trước**. Người nhận phải đồng ý nhận tin và đã cho số điện thoại. | **Không tìm được bảng giá ZNS chính thức**, nên R&D không ghi con số nào. |
| SMS brandname (đoạn trích) — https://www.sapo.vn/blog/sms-brandname-la-gi | Phải đăng ký tên thương hiệu với nhà mạng, nộp giấy tờ pháp nhân, đăng ký mẫu nội dung. | **Không tìm được bảng giá chính thức.** |

## 3. Điều R&D tìm ra trong mã của mình (ảnh hưởng tới cả hai đề tài)

1. **Máy chủ chưa có gì cho thông báo**: không có bảng thông báo, không có việc chạy hẹn giờ, không có nhà cung cấp email (việc tồn số 19 đang chờ). PRD ghi module 12 "Thông báo — Nhắc lịch, báo thay đổi" là **chưa xếp mốc**.
2. **Dữ liệu để biết "việc cần làm" thì đã có đủ**:
   - Ca: `Appointment.startsAt`, `status`, `address`, `travelBeforeMin`, thợ ở `AppointmentStaff`.
   - Đợt thu: `PaymentInstallment.dueDate`, `amount`, `name`. Hàm có sẵn `allocateToInstallments` (packages/shared/src/payments.ts dòng 126) tính ra trạng thái Quá hạn / Đến hạn / Trả một phần.
   - Người nhắc đóng tiền: `Contract.ownerMembershipId` (schema ghi "Người phụ trách (tư vấn, nhắc đóng tiền)").
   - Hợp đồng mới xác nhận: `Contract.confirmedAt`. Người xác nhận: nhật ký `contract.status_changed`.
   - Học viên mới: `Enrollment.enrolledAt`.
   - Lớp sắp đầy: `CourseClass.enrolledCount / capacity`, hàm `seatState`, mốc 75% (`ALMOST_FULL_RATIO`).
   - Đổi hoặc huỷ ca: nhật ký `appointment.updated`, `appointment.status_changed`.
   Cái còn thiếu là **một đường gom lại** (trùng với việc tồn số 12: "đường liệt kê đợt chưa thu của mọi hợp đồng").
3. **Trường `Appointment.kind` (EventKind) đã có, nhưng là "loại lịch"** (Makeup / Buổi học / Nội bộ / Việc riêng / Khác), **không phải** ăn hỏi hay cưới. Vì vậy trường mới phải đặt tên khác, R&D đặt là **`occasion` ("dịp")**, để thợ lập trình không nhầm hai thứ với nhau.
4. **Màn lập hợp đồng trên web hiện chỉ cho MỘT ngày cho cả hợp đồng.** Mọi dòng đều lấy ngày sự kiện của hợp đồng (apps/web/src/features/contracts/model.ts dòng 359–360). Máy chủ thì đã cho mỗi dòng một ngày riêng. Vì vậy hôm nay studio phải tách ăn hỏi và cưới thành **2 hợp đồng**. Trong bản mẫu, chị Vũ Thị Hồng Nhung có HD-000001 cho ăn hỏi ngày 19/11 và HD-000008 cho cưới ngày 22/11. Điều này quyết định phương án A đủ dùng đến đâu (mục 5).
5. **Màu ca hôm nay theo nhân vật** (apps/web/src/features/schedule/model.ts dòng 20–58): 6 màu. Cô dâu hồng, Mẹ cô dâu tím, Phù dâu vàng nâu, Mẹ chú rể xanh lục, Chú rể xanh dương, Khách mời nâu xám. Ca không có nhân vật thì là "Khác", nền trắng.

## 4. Đề tài 1 — Thông báo

### 4.1 Phương án A — Chuông + ngăn kéo danh sách

| | |
|---|---|
| Ảnh | thong-bao-A-chuong-ngan-keo-chu-studio-1440 / -390 · thong-bao-A-chuong-ngan-keo-tho-1440 / -390 · thong-bao-A-cai-dat-cua-toi-1440 / -390 · bản có nhãn trường: -chu-studio-nhan-truong-1440, -cai-dat-cua-toi-nhan-truong-1440 |
| Ai nhận gì | **Chủ, Quản lý**: đợt thu quá hạn / đến hạn, ngày mai bao nhiêu ca và bao nhiêu ca chưa có thợ, hợp đồng mới xác nhận, học viên mới, lớp sắp đầy. **Lễ tân, Kế toán**: đợt thu của hợp đồng mình phụ trách (hoặc mọi hợp đồng, tuỳ người đó chọn). **Thợ**: ca của mình ngày mai, được phân ca mới, ca bị đổi giờ hoặc bị huỷ. **Giảng viên**: học viên mới, lớp sắp đầy. Ai thấy gì vẫn theo quyền đang có, ví dụ thợ không có quyền xem tiền nên không bao giờ nhận tin về tiền. |
| Ở đâu trên màn | Chuông có số đỏ (số tin chưa đọc) ở góc thanh trái trên máy tính, ở thanh trên trên điện thoại. Bấm chuông thì ngăn kéo trượt ra từ bên phải (điện thoại: phủ cả màn). Ngăn kéo chia "Chưa đọc / Đã đọc", có chip lọc Lịch · Thu tiền · Hợp đồng · Đào tạo. |
| Bấm vào đi đâu | Đợt thu → màn Thu tiền của hợp đồng đó. Ca → mở hộp ca trên Lịch, đúng ngày. Hợp đồng mới → hợp đồng. Học viên, lớp → màn lớp. |
| Tắt / bật | Mỗi người tự bật/tắt từng loại tin ở "Cài đặt › Thông báo của tôi", chọn báo trước bao lâu, chọn "chỉ hợp đồng tôi phụ trách" hay "mọi hợp đồng". Ba cột Zalo / SMS / Email để trống đến khi anh chọn nhà cung cấp. |
| Học từ | Studio Pro (chuông, ngăn kéo, lọc), Fresha (mỗi người tự chọn), Square (bật/tắt từng kênh cho từng người). |
| Ưu | Quen mắt. Báo được **"thay đổi"** (được phân ca, ca bị huỷ), đúng chữ "báo thay đổi" trong PRD. Có lịch sử 30 ngày. |
| Nhược | Phải có **bảng mới** và **việc chạy hẹn giờ** (để tạo tin "sắp đến hạn" vào 7:00). Tin đã gửi có thể **cũ đi**: ví dụ khách đã trả tiền mà tin "quá hạn" vẫn nằm đó. Số đỏ dễ thành thói quen bỏ qua. Không có kênh ngoài thì người không mở app vẫn không biết. |
| Công sức | Máy chủ **7–8 buổi**: bảng tin + bảng cài đặt (1), tạo tin ở 5 chỗ trong mã (2), việc chạy hẹn giờ + chống gửi trùng (2), đường đọc / đếm / đánh dấu đã đọc / cài đặt (1), bài thử theo quyền (1–2). Web **5 buổi**: chuông + đếm (hỏi máy chủ mỗi 60 giây) (1), ngăn kéo + lọc + bấm đi đúng chỗ (2), màn cài đặt (1), điện thoại + bài thử (1). **Tổng khoảng 12–13 buổi.** |
| Dịch vụ ngoài / phí | Trong app: **không tốn phí**. Cần chỗ chạy việc hẹn giờ trên Railway (đang dùng; R&D chưa kiểm gói hiện tại có tính thêm tiền không). |

### 4.2 Phương án B — Trang "Hôm nay" (việc cần làm)

| | |
|---|---|
| Ảnh | thong-bao-B-trang-hom-nay-chu-studio-1440 / -390 · thong-bao-B-trang-hom-nay-tho-1440 / -390 · bản có nhãn trường: -chu-studio-nhan-truong-1440, -tho-nhan-truong-1440 |
| Ai nhận gì | **Chủ, Quản lý** (đủ quyền): 4 ô số (ca hôm nay, ca ngày mai, đợt quá hạn, đến hạn 7 ngày). Thẻ "Cần làm ngay": tiền quá hạn, ca chưa có thợ, lớp sắp đầy. Thẻ "Thu tiền 7 ngày tới". Thẻ "Ngày mai": mỗi thợ mấy ca, mấy giờ. Thẻ "Mới trong 24 giờ": hợp đồng xác nhận, học viên ghi danh. **Lễ tân, Kế toán**: chỉ thấy các thẻ mà quyền của họ cho xem. **Thợ**: ca của mình hôm nay, ngày mai, 7 ngày tới, và ca mới được phân. |
| Ở đâu trên màn | Mục **"Hôm nay" ở đầu menu**, và là ô đầu của thanh dưới trên điện thoại. Mã sản phẩm đã chừa sẵn chỗ cho trang "Tổng quan" (apps/web/src/layout/nav.ts dòng 6). |
| Bấm vào đi đâu | Ngay trên dòng có nút làm việc luôn: **"Ghi phiếu thu"** mở form thu của đúng đợt đó, **"Phân thợ"** mở hộp chọn thợ của ca đó, **"Mở lớp"** mở màn lớp. Bấm vào chữ thì mở hợp đồng hoặc ca. |
| Tắt / bật | Không có "đã đọc". **Xong việc thì mục tự biến mất**: thu đủ tiền thì dòng quá hạn biến mất, phân thợ xong thì dòng thiếu thợ biến mất. Mỗi người thu gọn được từng thẻ (nhớ trên máy của người đó). Ai thấy thẻ nào là theo quyền, không cần màn cài đặt. |
| Học từ | Studio Pro "Cảnh báo Vận hành (Cần xử lý ngay)"; khối "Cần xử lý" đã có trong Lịch chế độ B của chính mình (apps/web/src/features/schedule/DayListB.tsx dòng 106–124). |
| Ưu | **Rẻ nhất.** Không có bảng mới, không có việc chạy hẹn giờ. Luôn **đúng với dữ liệu lúc mở trang**, không có tin cũ. Từ tin nhắc đến lúc làm xong chỉ 1–2 lần bấm. Máy nào, điện thoại nào cũng thấy giống nhau. Đường gom dữ liệu dùng lại được cho Thu tiền (việc tồn số 12) và cho phương án C. |
| Nhược | **Phải mở app mới thấy**, app không tự "gọi" ai. Không giữ lịch sử "ai báo gì lúc nào". Riêng ô "Mới được phân" của thợ cần biết giờ phân ca, mà máy chủ chưa lưu (có thể đọc tạm từ nhật ký). |
| Công sức | Máy chủ **3–4 buổi**: một đường `GET /orgs/:id/hom-nay` gom dữ liệu theo quyền, dùng lại `allocateToInstallments` và `seatState` (2–3), bài thử theo từng vai trò (1). Web **4 buổi**: trang mới + mục menu (2), các nút làm việc mở đúng hộp (1), điện thoại + bài thử (1). **Tổng khoảng 7–8 buổi.** |
| Dịch vụ ngoài / phí | **Không có.** |

### 4.3 Phương án C — Bản tin hằng ngày (tóm tắt buổi sáng)

| | |
|---|---|
| Ảnh | thong-bao-C-ban-tin-sang-trong-app-1440 / -390 · thong-bao-C-ban-tin-qua-email-zalo-sms-1440 / -390 (MINH HOẠ) · thong-bao-C-cai-dat-ban-tin-1440 / -390 · bản có nhãn trường: 3 ảnh -nhan-truong-1440 |
| Ai nhận gì | Mỗi người nhận **một** bản tin mỗi ngày, mặc định 7:00. Chủ / Quản lý: tiền, lịch hôm nay và ngày mai, ca thiếu thợ, hợp đồng và học viên mới, lớp sắp đầy. Lễ tân / Kế toán: tiền của hợp đồng mình phụ trách, ca thiếu thợ. Thợ: ca của mình hôm nay và ngày mai, có giờ, khách, địa chỉ. Giảng viên: học viên mới của lớp mình. **Không có gì mới thì không gửi.** |
| Ở đâu trên màn | Trong app: một dải hồng trên Lịch, bấm vào thì mở trang "Bản tin sáng". Ngoài app (khi anh bật): email, tin Zalo của Zalo OA studio, hoặc SMS. Ảnh `c-kenh` chỉ **minh hoạ** cùng một nội dung ở 3 kênh. |
| Bấm vào đi đâu | Trong app: mỗi dòng mở đúng hợp đồng, ca, lớp. Email và Zalo có nút "Mở Lịch / Xem chi tiết" dẫn về app. SMS có đường dẫn ngắn. |
| Tắt / bật | Chủ tài khoản đặt giờ gửi, vai trò nào nhận, gửi qua kênh nào (màn `c-cai-dat`). Mỗi người tự tắt được bản tin của mình. |
| Học từ | Fresha (email tóm tắt hằng ngày), Bookly (email lịch trong ngày cho nhân viên), Studio Pro (kịch bản "Nhắc lịch trước 1 ngày" có mẫu tin). |
| Ưu | **Đến tận tay người không mở app** (khi có kênh ngoài). Chỉ một tin mỗi ngày, không làm phiền. Hợp với thợ chỉ cần biết "mai mấy giờ, đi đâu". |
| Nhược | Chỉ đúng **tại giờ gửi**: khách trả tiền lúc 9:00 thì bản tin 7:00 vẫn ghi "quá hạn". Không báo được việc gấp xảy ra trong ngày. Bản tin trong app mà không có kênh ngoài thì cũng chỉ gần bằng B. |
| Công sức | Phần trong app: máy chủ 5–6 buổi (bảng cài đặt + bảng đã gửi (1), việc chạy 7:00 theo giờ VN, gom theo người, chống gửi 2 lần (2), nội dung theo vai trò (2, **giảm còn khoảng 1 nếu đã làm B** vì dùng lại đường gom của B), bài thử (1)). Web 3 buổi. **Tổng khoảng 8–9 buổi; khoảng 5–6 nếu làm sau B.** Mỗi kênh ngoài cộng thêm: **Email 2–3 buổi**, **Zalo ZNS 3–4 buổi**, **SMS 2–3 buổi**. Chưa tính thời gian chờ duyệt thủ tục. |
| Dịch vụ ngoài / phí | **Email**: cần nhà cung cấp gửi thư và tên miền gửi thư. Việc tồn số 19 (đặt lại mật khẩu qua email) cũng cần thứ này, nên làm một lần dùng chung. **Zalo**: cần Zalo OA đã xác thực, mẫu tin ZNS được Zalo duyệt, người nhận đồng ý và có số điện thoại (máy chủ đã có `StaffProfile.phone`, `User.phone`). **Tính tiền theo tin; R&D chưa có bảng giá chính thức.** **SMS brandname**: đăng ký tên với nhà mạng, nộp giấy tờ pháp nhân, duyệt mẫu nội dung. **Tính tiền theo tin; chưa có bảng giá.** Tin có dấu tiếng Việt thường tốn 2–3 tin SMS. **R&D không chọn thay anh.** |

### 4.4 Ô nào lấy từ dữ liệu nào (đề tài 1)

| Ô trên ảnh | Lấy từ | Có sẵn? |
|---|---|---|
| "Đợt 2 quá hạn 3 ngày · 2.000.000 ₫", "Hạn 18/11" | `PaymentInstallment.name`, `amount`, `dueDate` + `allocateToInstallments` (trạng thái OVERDUE) | Có |
| "phụ trách: Mai · 0901 222 333" | `Contract.ownerMembershipId` → `StaffProfile.displayName`, `phone` | Có |
| "HD-000004 · Đỗ Thanh Mai" | `Contract.code`, `Customer.fullName` | Có |
| "Ngày mai 9 ca · 1 ca chưa có thợ", "Linh 3 ca 05:00 · 13:00 · 17:30" | đếm `Appointment.startsAt`; `AppointmentStaff` (không có dòng nào = chưa có thợ) | Có |
| "Tại nhà khách – 25 Nguyễn Văn Cừ · đi trước 30 phút" | `Appointment.address`, `travelBeforeMin` | Có |
| "HD-000007 xác nhận · 3.200.000 ₫ · ngày sự kiện 22/11 · Mai xác nhận" | `Contract.confirmedAt`, `total`, `eventDate`; người xác nhận: `AuditLog` hành động `contract.status_changed` | Có |
| "Nguyễn Hải Yến ghi danh · Makeup cá nhân K12 · còn 3/12 chỗ" | `Enrollment.enrolledAt`, `Customer.fullName`, `CourseClass.name`, `enrolledCount`/`capacity` | Có |
| "Lớp sắp đầy 10/12" | `seatState` (mốc 75%) | Có |
| "Ca đã huỷ · lý do" | `Appointment.status = CANCELLED`, `cancelReason` | Có |
| Số đỏ trên chuông, chấm "chưa đọc", danh sách tin (A) | — | **Mới**: bảng `Notification` |
| Bật/tắt từng loại, "báo trước 1 ngày", "chỉ hợp đồng tôi phụ trách" (A) | — | **Mới**: bảng `NotificationPreference` |
| "Mới được phân · phân lúc 21:05 hôm qua" (B, thợ) | — | **Mới**: `AppointmentStaff.createdAt`, hoặc đọc nhật ký `appointment.updated` |
| "Bản tin 7:00 đã gửi cho 6 người", giờ gửi, vai trò nhận, kênh (C) | — | **Mới**: bảng `DigestSetting`, `DigestRun` |
| Email / Zalo / SMS (A, C) | — | **Mới**: cấu hình nhà cung cấp (giữ ở máy chủ, không lưu trong database), đồng ý nhận tin của từng người |

### 4.5 Đề xuất của R&D cho đề tài 1

**Làm B trước. Khi anh chọn được kênh ngoài thì làm C, dùng lại đường gom của B. A để sau, hoặc bỏ.**

Lý do:
1. B giải đúng việc anh nêu (ca sắp tới, tiền sắp đến hạn hoặc quá hạn, hợp đồng mới, học viên mới, lớp sắp đầy) mà **không cần dữ liệu mới, không cần việc chạy hẹn giờ, không tốn phí**. Khoảng 7–8 buổi.
2. B không bao giờ báo sai: mở trang lúc nào là đúng dữ liệu lúc đó. A và C đều có thể còn giữ tin "quá hạn" sau khi khách đã trả.
3. Đường gom của B cũng là đường mà màn Thu tiền đang thiếu (việc tồn số 12). Làm một lần, ba chỗ dùng.
4. Phần "báo thay đổi" cho thợ (ca bị huỷ, đổi giờ, phân ca mới) có thể thêm vào B một thẻ "Thay đổi 24 giờ qua", đọc từ nhật ký đang có, chỉ lọc ca của thợ đó. Không cần làm A.
5. Phải có kênh ngoài thì thông báo mới thật sự "tìm đến người". Kênh nào thì **anh quyết** (mục 7), vì tốn phí và phải làm thủ tục.

## 5. Đề tài 2 — Loại sự kiện cho ca makeup (việc tồn số 4)

Ảnh **TRƯỚC** (đúng như hôm nay, tô theo nhân vật): su-kien-TRUOC-lich-C-tuan, -lich-B-ngay, -lich-A-cot-tho, -lap-hop-dong, mỗi màn hai khổ 1440 và 390. Thêm su-kien-TRUOC-lich-C-tuan-nhan-truong-1440.

Ở mọi phương án, chữ trên ô ca đổi từ "Cô dâu cao cấp — Cô dâu" thành **"Cưới · Cô dâu"**: tên sự kiện đứng trước, nhân vật đứng sau. Vì vậy người mù màu vẫn đọc được sự kiện. Tên gói vẫn có trong hộp chi tiết ca. Đổi chữ như vậy hay giữ nguyên là **việc anh quyết**.

### 5.1 Phương án A — Một loại sự kiện cho cả hợp đồng (danh sách cố định)

| | |
|---|---|
| Ảnh | su-kien-A-lich-C-tuan, -lich-B-ngay, -lich-A-cot-tho, -lap-hop-dong (1440 và 390) · su-kien-A-lap-hop-dong-nhan-truong-1440 |
| Màn hợp đồng | Thêm hàng **"Sự kiện"** ngay dưới "Ngày sự kiện". Chọn một trong 6 nút: Ăn hỏi · Cưới · Ăn hỏi + cưới · Tiệc · Ngoại cảnh · Kỷ yếu. Thêm **1 lần bấm** cho mỗi hợp đồng. |
| Lịch | Mọi ca của hợp đồng có cùng màu. Ca tạo lẻ (không có hợp đồng) hiện "Chưa chọn sự kiện", nền trắng (ca 15:00 Thứ Bảy của Lê Phương Anh). |
| Màu theo nhân vật | **Mất.** Màu bây giờ là màu sự kiện; nhân vật chỉ còn trong chữ. Ai đã quen "hồng là cô dâu" sẽ thấy hồng là "Cưới" (cả mẹ cô dâu, phù dâu của đám cưới cũng hồng). |
| Học từ | Studio Pro (ngày ăn hỏi, ngày cưới gắn với hợp đồng hoặc gói), nhưng **không** đoán theo chữ. |
| Ưu | Rẻ nhất. Hợp với cách web đang chạy: mỗi hợp đồng một ngày, nên hầu hết hợp đồng chỉ có một sự kiện. |
| Nhược | Không tách được hai sự kiện **trong cùng một hợp đồng**. Ví dụ ca 17:30 "Dặm makeup" cho tiệc tối của chị Nhung vẫn hiện là "Cưới" (ảnh A-lich-A-cot-tho). Sau này nếu cho "trọn gói cưới hỏi" một hợp đồng nhiều ngày thì A hết dùng được. Danh sách cố định: muốn thêm "Lễ vu quy" hay "Thôi nôi" thì phải sửa mã. |
| Công sức | Máy chủ 1–2 buổi (thêm trường, nhận và trả trong API hợp đồng và lịch). Web 2–3 buổi (hàng chọn ở thẻ đầu, Lịch tô màu và chú thích, bài thử). **Khoảng 4–5 buổi.** |

### 5.2 Phương án B — Gắn ở từng dòng hợp đồng (danh sách cố định)

| | |
|---|---|
| Ảnh | su-kien-B-lich-C-tuan, -lich-B-ngay, -lich-A-cot-tho, -lap-hop-dong (1440 và 390) · su-kien-B-lich-B-ngay-nhan-truong-1440, su-kien-B-lap-hop-dong-nhan-truong-1440 |
| Màn hợp đồng | Mỗi thẻ dòng gói có hàng **"Sự kiện"**: Ăn hỏi · Cưới · Tiệc · Ngoại cảnh · Kỷ yếu · Khác. **Dòng mới tự lấy theo dòng bên trên**, nên thường chỉ phải bấm ở dòng đầu, rồi bấm lại ở dòng nào khác đi (ví dụ dòng "Dặm makeup" chọn Tiệc). Hộp tạo ca lẻ trên Lịch cũng có ô này. |
| Lịch | Ca 05:00–07:00 sáng của chị Nhung là "Cưới", ca 17:30 là "Tiệc". Ca lẻ của Lê Phương Anh là "Tiệc" (chọn trong hộp ca). |
| Màu theo nhân vật | **Mất**, giống A. |
| Ưu | Đúng ngay cả khi một hợp đồng có nhiều sự kiện trong ngày. Sau này cho mỗi dòng một ngày riêng (máy chủ đã cho phép) thì vẫn đúng, không phải làm lại. |
| Nhược | Thêm một hàng trên mỗi thẻ dòng, nên màn dài hơn (rõ nhất trên điện thoại: ảnh B-lap-hop-dong-390). Danh sách vẫn cố định. |
| Công sức | Máy chủ 2 buổi (trường ở dòng và ở ca, tự chép sang ca khi xác nhận và khi thêm dòng phát sinh). Web 4 buổi. **Khoảng 6 buổi.** |

### 5.3 Phương án C — Danh sách do studio tự đặt, gắn ở dòng, Lịch có công tắc tô màu

| | |
|---|---|
| Ảnh | su-kien-C-lich-C-tuan, -lich-B-ngay, -lich-A-cot-tho, **-lich-C-bat-to-theo-nhan-vat**, -lap-hop-dong, -cai-dat-loai-su-kien (1440 và 390) · bản có nhãn trường: -lich-C-tuan, -lap-hop-dong, -cai-dat-loai-su-kien (1440) |
| Màn hợp đồng | Hàng "Sự kiện" ở mỗi dòng là **ô chọn** lấy từ danh sách của studio, có chấm màu, kèm đường "Sửa danh sách". Dòng mới tự lấy theo dòng trên, giống B. |
| Cài đặt › Loại sự kiện | Studio tự thêm, đổi tên, chọn **1 trong 6 màu của Lịch**, kéo để đổi thứ tự, ẩn (ẩn không xoá các ca cũ). Mỗi loại ghi đang có bao nhiêu dòng hợp đồng dùng. Màn này giống màn Nhân vật của Bảng giá. Trong ví dụ studio đặt riêng "Lễ vu quy" cho buổi sáng, khác "Lễ cưới". |
| Lịch | Có công tắc **"Tô màu: Sự kiện / Nhân vật"** đặt cạnh nhóm nút chế độ. Bấm "Nhân vật" là về **đúng màu như hôm nay** (ảnh c-nv). |
| Màu theo nhân vật | **Giữ được**, chỉ cần bấm công tắc. Hai cách tô dùng chung 6 màu, nên một màu có hai nghĩa tuỳ công tắc đang bật bên nào. Chú thích bên dưới đổi theo công tắc. |
| Học từ | Square (tô theo nhân viên hoặc theo dịch vụ), Phorest và Pabau (màu đặt theo nhóm), Studio Pro (danh sách nhóm do studio tự đặt), và chính màn Nhân vật của mình. |
| Ưu | Studio gọi sự kiện theo cách của mình (vu quy, thành hôn, thôi nôi, pre-wedding…). Không mất màu nhân vật. Cùng kiểu với những thứ anh đã chọn trước đây (nhân vật, bậc lương do studio tự đặt). |
| Nhược | Đắt nhất. Thêm một màn cài đặt. Chỉ có 6 màu: loại thứ 7 trở đi phải dùng lại màu (giống việc tồn số 3). Có công tắc thì người dùng phải nhớ mình đang xem theo kiểu nào. |
| Công sức | Máy chủ 3 buổi (bảng mới + thêm/sửa/sắp xếp/ẩn + danh sách mặc định cho tổ chức mới, trường ở dòng và ở ca, chụp lại tên lúc lưu giống `subjectName`). Web 5–6 buổi (màn cài đặt, ô chọn ở dòng, Lịch + công tắc + chú thích, bài thử). **Khoảng 8–9 buổi.** |

### 5.4 Ô nào lấy từ dữ liệu nào (đề tài 2)

| Ô | Lấy từ | Có sẵn? |
|---|---|---|
| Giờ ca, tên khách, địa chỉ, thợ | `Appointment.startsAt/endsAt`, `Customer.fullName`, `Appointment.address`, `AppointmentStaff` | Có |
| Chữ nhân vật ("Cô dâu"), màu theo nhân vật (ảnh TRƯỚC, ảnh C-nv) | `ContractLine.subjectName` | Có |
| Khách hàng, Ngày sự kiện, Giờ, Thợ phụ trách trên màn hợp đồng | `Contract.customerId`, `eventDate`, `ContractLine.scheduledStart/End`, `ContractLineStaff` | Có |
| Hàng "Sự kiện" ở thẻ đầu + màu ca (A) | — | **Mới**: `Contract.occasion` |
| Hàng "Sự kiện" ở mỗi dòng + màu ca (B) | — | **Mới**: `ContractLine.occasion`, `Appointment.occasion` |
| Ô chọn sự kiện, màn Loại sự kiện, màu (C) | — | **Mới**: bảng `Occasion`, `ContractLine.occasionId` + `occasionName`, `Appointment.occasionId` |
| Công tắc "Tô màu" (C) | Chỉ là cách xem trên web, **không cần trường mới**. Có nhớ lựa chọn trên từng máy hay không là việc anh quyết (Lịch hiện **không** nhớ chế độ xem, theo quyết định cũ). | — |

### 5.5 Đề xuất của R&D cho đề tài 2

**C**, kèm danh sách mặc định cho tổ chức mới (Ăn hỏi, Lễ vu quy, Lễ cưới, Tiệc, Pre-wedding, Kỷ yếu; anh đổi được), và dòng mới tự lấy sự kiện của dòng trên.

Lý do:
1. Cùng kiểu với những gì anh đã chọn: nhân vật và bậc lương đều do studio tự đặt. Studio Pro của anh cũng để studio tự đặt nhóm dịch vụ.
2. Tô theo sự kiện mà không mất màu nhân vật. Hôm nay thợ đang nhìn màu để biết ca cô dâu hay ca mẹ cô dâu; với A và B, thông tin đó chỉ còn trong chữ.
3. Gắn ở dòng nên đúng cả khi trong một ngày có sáng vu quy, tối tiệc. Sau này mở "một hợp đồng nhiều ngày" (ăn hỏi + cưới) thì không phải làm lại.

**Nếu anh muốn nhanh và rẻ** thì A vẫn dùng được, vì web đang cho mỗi hợp đồng một ngày (mục 3, điểm 4). Đổi lại, A mất màu nhân vật và không tách được "tiệc tối" khỏi "cưới".

## 6. R&D đã tự soát và sửa gì

Đã mở xem cả 66 ảnh. Các lỗi thấy được đã sửa rồi chụp lại:
- Ngăn kéo thông báo: dòng tiêu đề và dòng mô tả cách nhau một khoảng trống, do biểu tượng chiếm cả hàng. Đã sửa cho biểu tượng trải dọc 3 hàng.
- Ảnh có ngăn kéo: chụp đúng khung màn hình, không kéo dài cả trang (nếu kéo dài thì ngăn kéo cao bất thường).
- Lịch chế độ A (cột thợ): khung tự cuộn làm mất phần chú thích màu. Riêng bản mẫu cho hiện trọn ngày; sản phẩm thật vẫn cuộn trong khung.
- Ngăn kéo của thợ: nền phía sau ban đầu là lịch cả studio, trong khi thợ chỉ có quyền xem lịch của mình (`schedule.read_own`). Đã lọc nền chỉ còn ca của Linh Trần. Sửa thêm một thẻ HTML bị thiếu làm vỡ hàng chip lọc.
- Điện thoại:
  - Cài đặt thông báo: ba cột Zalo, SMS, Email tràn ra ngoài, nên ẩn đi, chỉ giữ một dòng ghi chú.
  - Bản tin sáng: các dòng 2 cột bị bóp còn mỗi dòng một chữ.
  - Màn Loại sự kiện: nút "Thêm loại" đè lên dòng mô tả; bảng màu chen vào tên loại.
  - Thanh tổng hợp đồng: số tiền bị nút "Lưu nháp" đè. Đã đổi thành nút chữ "Lưu", giống sản phẩm thật.
- Cài đặt bản tin: cột "Bản tin gồm" lệch dòng, do một ô bảng bị đổi kiểu hiển thị. Nhãn trường ở mép phải tràn ra ngoài màn 1440.
- Số liệu: tổng hợp đồng đã cộng lại cho khớp (4.847.000 ₫). Thẻ "7 ngày tới" của thợ ghi 5 ca nhưng chỉ có 2 dòng, đã đổi thành "Sau đó · 7 ngày tới · 2 ca". Dải bản tin trước ghi "nhận qua email" trong khi email chưa có, đã sửa.

Chưa làm:
- Chế độ tối, vì sản phẩm cũng chưa có.
- Khổ máy tính bảng, vì phiếu chỉ đòi khổ 1440 và 390.
- Hiệu ứng rê chuột và kéo thả: bản mẫu là ảnh tĩnh.

## 7. Đề xuất trường mới (KHÔNG vẽ như thể đã có)

| Đề tài / phương án | Đề xuất | Ghi chú |
|---|---|---|
| 1-A | Bảng `Notification` (tổ chức, người nhận, loại, trỏ tới bản ghi nào, nội dung chụp lại, lúc tạo, lúc đọc), khoá chống trùng (loại + bản ghi + người nhận + ngày) | Giữ 30 ngày |
| 1-A | Bảng `NotificationPreference` (người, loại, kênh, bật/tắt, báo trước bao lâu, phạm vi "của tôi / tất cả") | |
| 1-A, 1-C | Việc chạy hẹn giờ trên máy chủ | Máy chủ chưa có |
| 1-B | Đường `GET /orgs/:id/hom-nay` (gom theo quyền) | Gộp với việc tồn số 12 |
| 1-B (thợ) | `AppointmentStaff.createdAt`, để biết "mới được phân lúc nào" | Hoặc đọc nhật ký |
| 1-C | Bảng `DigestSetting` (giờ gửi, vai trò nhận, kênh), `DigestRun` (đã gửi cho ai, ngày nào, kênh nào, kết quả) | |
| 1-A, 1-C (kênh ngoài) | Cấu hình nhà cung cấp email / Zalo OA / SMS (giữ ở máy chủ, không lưu trong database); người nhận đồng ý nhận tin; mã Zalo người dùng nếu dùng ZNS | Tốn phí, cần thủ tục |
| 2-A | `Contract.occasion` (danh sách cố định) | Đặt tên `occasion` để không nhầm với `Appointment.kind` |
| 2-B | `ContractLine.occasion`, `Appointment.occasion` (danh sách cố định + Khác) | |
| 2-C | Bảng `Occasion` (tổ chức, tên, màu 0–5, thứ tự, đang dùng; tên không trùng trong một tổ chức), `ContractLine.occasionId` + `occasionName` (chụp tên lúc lưu), `Appointment.occasionId`; danh sách mặc định trong packages/shared | Giống `MakeupSubject` |

## 8. Cần anh quyết

**Đề tài 1 — Thông báo**
1. Chọn A, B hay C. R&D đề xuất **B trước, rồi C**.
2. **Có gửi ra ngoài app không, và gửi qua kênh nào**: Email, Zalo (Zalo OA + ZNS) hay SMS brandname. Cả ba đều tốn phí và phải làm thủ tục. R&D chưa có bảng giá chính thức của Zalo ZNS và SMS brandname, nên **không chọn thay anh**. Riêng email thì việc đặt lại mật khẩu (việc tồn số 19) cũng cần, có thể làm chung.
3. Trang "Hôm nay" có **thay Lịch làm trang mở đầu** không, hay chỉ là một mục trong menu.
4. Nếu làm C: gửi lúc mấy giờ (bản mẫu để 7:00 sáng), và tối hôm trước có gửi thêm lịch ngày mai cho thợ không.

**Đề tài 2 — Loại sự kiện**
5. Chọn A, B hay C. R&D đề xuất **C**.
6. Tên các loại sự kiện có sẵn cho tổ chức mới.
7. Lịch mở ra tô theo **Sự kiện** hay theo **Nhân vật**. Có nhớ lựa chọn cho lần sau không.
8. Chữ trên ô ca đổi thành "Sự kiện · Nhân vật" (bỏ tên gói), hay giữ "Gói — Nhân vật".
9. Việc riêng, ngoài báo cáo này: có cho **một hợp đồng nhiều ngày** (trọn gói ăn hỏi + cưới) không. Hôm nay web chỉ cho một ngày cho mỗi hợp đồng.

## 9. Danh sách tệp đã nộp

- Báo cáo: /home/user/a/docs/rnd/BAO-CAO-RND-05-THONG-BAO-SU-KIEN.md
- Bản mẫu: /home/user/a/docs/rnd/v5-thong-bao.html, /home/user/a/docs/rnd/v5-su-kien.html
- Phần dùng chung: /home/user/a/docs/rnd/v5-chung/san-pham.css (bản chép kiểu của sản phẩm), /home/user/a/docs/rnd/v5-chung/v5.css, /home/user/a/docs/rnd/v5-chung/v5.js, /home/user/a/docs/rnd/v5-chung/v5-lich.js
- Ảnh (66 tệp, ≤ 400 KB mỗi tệp): /home/user/a/docs/rnd/anh-rnd05/
- R&D không sửa mã sản phẩm (apps/**, packages/**), không chạy git, không đụng makeup_dev. Bản sao Studio Pro chỉ được đọc.
