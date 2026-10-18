# Bản mô tả sản phẩm (PRD) — Makeup Pro

Ngày viết: 18/10/2026. Người viết: AI (thợ tài liệu). Nguồn: mã trong kho, `docs/PROJECT_AUDIT.md`, `docs/NHAT-KY-QUYET-DINH-THAY.md`, lệnh giao việc của điều phối.

> **Lưu ý trước khi đọc:** bản yêu cầu gốc của anh Chiến (bản nói "13 module + app iPhone") **không nằm trong kho**. Danh sách module ở mục 3 được dựng lại từ những gì có trong kho và lệnh giao việc. Tên và số module cần anh Chiến hoặc điều phối đối chiếu với bản yêu cầu gốc rồi sửa cho khớp.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. PRD là gì, viết để làm gì
PRD là tờ giấy trả lời bốn câu: **làm cái gì, cho ai, làm theo thứ tự nào, và cái gì chưa làm.** Không có tờ này, thợ sẽ tự đoán, và mỗi thợ đoán một kiểu. Có tờ này, khi ai đó đòi thêm tính năng giữa chừng, anh chỉ cần hỏi: "nó nằm ở lát nào?"

### 2. Cách chia việc theo "lát"
Một **lát** là một phần sản phẩm làm trọn từ đầu đến cuối: dữ liệu, máy chủ, giao diện, bài thử, tài liệu. Xong lát nào thì dùng thật được lát đó. Không làm kiểu "xong hết phần máy chủ của 13 module rồi mới làm giao diện", vì như thế phải đợi rất lâu mới có cái để dùng thử.

| Luật chia lát | Vì sao |
|---|---|
| Mỗi lát phải có người dùng thật dùng được ngay | Biết sớm cái nào sai trước khi xây thêm lên trên |
| Lát sau chỉ dựa vào dữ liệu của lát trước, không dựa vào lời hứa | Tránh "chờ module kia xong mới chạy được" |
| Lát đầu chọn phần nhiều người dùng nhất mỗi ngày | Lịch và bảng giá là việc studio mở ra hằng ngày |
| Mỗi lát có danh sách "KHÔNG làm" viết rõ | Chặn việc phình ra giữa chừng |

### 3. Ba loại khách của một SaaS ngành làm đẹp
SaaS là phần mềm thuê theo tháng, chạy trên mạng, nhiều đơn vị dùng chung một hệ thống nhưng dữ liệu tách riêng.

| Loại | Đặc điểm | Cần gì nhất |
|---|---|---|
| Thợ cá nhân | Một người, tự nhận lịch, tự báo giá | Bảng giá gọn, lịch không bị trùng, ghi cọc |
| Đội / studio | Chủ + thợ chính + thợ phụ + lễ tân | Phân lịch cho thợ, phân quyền ai xem được gì |
| Trung tâm đào tạo | Giảng viên, trợ giảng, học viên | Lịch buổi học, quản lý học viên, cổng cho học viên |

Một người có thể thuộc **nhiều đơn vị** cùng lúc (thợ làm cho vài studio, giảng viên dạy vài trung tâm). Phần mềm phải cho một tài khoản đi vào nhiều đơn vị, mỗi đơn vị một bộ quyền riêng.

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Sản phẩm là gì
**Makeup Pro** là phần mềm quản lý cho ngành makeup Việt Nam, nhiều tổ chức dùng chung (gọi là "nhiều tổ chức" — mỗi studio là một tổ chức, dữ liệu tách nhau). Anh Chiến dùng cho studio ảnh cưới của mình, sau đó **bán quy trình và tài liệu** cho studio khác.

### 2. Cho ai — đã có trong dữ liệu
Ba loại tổ chức đã có sẵn trong cấu trúc dữ liệu (`apps/api/prisma/schema.prisma:20-24`): `INDIVIDUAL` (thợ cá nhân), `TEAM` (đội/studio), `ACADEMY` (trung tâm đào tạo). Một tài khoản tham gia nhiều tổ chức qua bảng `memberships`.

Vai trò mẫu được chép vào mỗi tổ chức lúc tạo (`packages/shared/src/permissions.ts:45-74`):

| Vai trò | Được làm gì (tóm tắt) |
|---|---|
| Chủ tài khoản, Quản trị | Mọi quyền. Chỉ chủ mới trao được vai trò chủ |
| Quản lý | Thêm/sửa nhân sự, bảng giá, đổi giá, khách hàng, lập và sửa hợp đồng, xem và sửa lịch cả tổ chức |
| Thợ makeup, Thợ phụ | Xem bảng giá, xem lịch mình được phân |
| Lễ tân | Khách hàng, lập và sửa hợp đồng, xem và sửa lịch cả tổ chức |
| Kế toán | Chỉ xem: nhật ký, bảng giá, khách, hợp đồng, lịch |
| Giảng viên | Xem bảng giá, lịch mình |
| Trợ giảng | Xem lịch mình |

Bảng trên đúng với mã đã lưu ở commit `f7b0805`. Lúc viết, mã đang sửa (chưa lưu) thêm quyền xem hồ sơ thợ và tiền công theo gói (`staff.*`, `payroll.*`) cho một số vai trò.

Phân quyền mẫu này do trợ lý tự chọn lúc 15:16 ngày 18/10/2026 khi anh Chiến vắng mặt. **Anh Chiến cần xem lại**, nhất là: thợ chính có cần thấy lịch của cả đội không.

### 3. Các module
Trạng thái thật xem ở `docs/PROGRESS.md`. Bảng dưới chỉ mô tả phạm vi.

| # | Module | Phạm vi | Bằng chứng trong kho |
|---|---|---|---|
| 1 | Tổ chức, nhân sự, vai trò, đăng nhập | Đăng ký, đăng nhập, tạo tổ chức, mời nhân sự, vai trò tuỳ chỉnh | `apps/api/src/modules/auth`, `modules/orgs` |
| 2 | Nhật ký thay đổi | Ghi ai làm gì lúc nào, không sửa không xoá được | bảng `audit_logs` |
| 3 | Bảng giá | Nhóm dịch vụ, dịch vụ chính / dịch vụ phụ (tóc, nail, lens…) / phụ phí cài sẵn, gói combo theo **nhân vật makeup** (cô dâu, mẹ, phù dâu…) và địa điểm cho phép, lịch sử giá, studio/cửa hàng, cách tính phí di chuyển | bảng `services`, `service_packages`, `price_versions`, `makeup_subjects`, `studio_locations`, `travel_fee_policies` |
| 4 | Khách hàng | Hồ sơ khách, số điện thoại | bảng `customers` |
| 5 | Hợp đồng | Một hợp đồng nhiều dòng: nhiều gói, dịch vụ phụ, phụ phí phát sinh, phí di chuyển; giá chốt lúc thêm dòng; sau khi xác nhận chỉ thêm dòng hoặc huỷ dòng có lý do | bảng `contracts`, `contract_lines`; anh Chiến yêu cầu ngày 18/10/2026 (`docs/SO-Y-MUON.md`) |
| 6 | Lịch makeup | Đặt lịch, phân thợ, chặn trùng giờ, thời gian di chuyển, trạng thái thực hiện; ba chế độ xem A/B/C, mặc định C | bảng `appointments`, `appointment_staff`; `docs/NHAT-KY-QUYET-DINH-THAY.md` dòng 15:24 |
| 7 | Tài chính | Thu cọc, thanh toán, sổ giao dịch; trạng thái thanh toán suy ra từ sổ | ghi chú trên `WorkStatus` trong `schema.prisma` |
| 8 | Website giới thiệu | Trang công khai của studio, đọc dịch vụ được đánh dấu công khai | cột `is_public` trên dịch vụ và gói |
| 9 | Đào tạo | Khoá học, buổi học, giảng viên, học viên | loại lịch `COURSE_SESSION`, vai trò giảng viên |
| 10 | Cổng học viên | Học viên đăng nhập xem lịch học, tài liệu | lệnh giao việc |
| 11 | File | Lưu ảnh, tài liệu (ảnh layout makeup, bản hợp đồng…) | lệnh giao việc |
| 12 | Thông báo | Nhắc lịch, báo thay đổi | lệnh giao việc |
| 13 | Thuê bao | Studio trả tiền thuê phần mềm theo gói | lệnh giao việc |
| — | App iPhone | Thợ xem lịch, nhận phân công trên điện thoại | lệnh giao việc |

Bảng trên có 13 dòng module + app iPhone. **Chưa chắc 13 dòng này trùng 13 module của bản yêu cầu gốc**: module hợp đồng là anh Chiến nhắn thêm giữa chừng ngày 18/10/2026, có thể bản yêu cầu gốc còn một module khác (ví dụ báo cáo, lương thưởng) mà kho không ghi. Cần đối chiếu.

### 4. Lộ trình theo lát
| Lát | Nội dung | Ai chọn, khi nào | Trạng thái |
|---|---|---|---|
| Nền móng | Module 1 + 2, cấu trúc dữ liệu Bảng giá + Hợp đồng + Lịch | — | Xong phần làm, đang nghiệm thu độc lập |
| **Lát 1** | **Bảng giá + Lịch makeup** (anh Chiến chọn ngày 18/10/2026). Cùng ngày anh nhắn thêm: nhân vật makeup, dịch vụ phụ, địa điểm, phí di chuyển và **tạo hợp đồng** → gộp vào lát 1. Khách hàng ở mức đủ để lập hợp đồng và đặt lịch | **Anh Chiến chọn ngày 18/10/2026** | Đang dựng |
| Lát 2 trở đi | Chưa chốt | Chờ anh Chiến | — |

Đề xuất thứ tự cho các lát sau (chỉ là đề xuất, **chưa ai chốt**), xếp theo cái nào cần dữ liệu của cái nào:
1. Tài chính — cần hợp đồng đã có giá chốt (lát 1 tạo ra).
2. Website giới thiệu — cần bảng giá có cờ công khai (lát 1 tạo ra).
3. Đào tạo + cổng học viên — dùng lại lịch (loại `COURSE_SESSION` đã có sẵn).
4. File, thông báo — phục vụ các module trên.
5. Thuê bao — cần khi bắt đầu bán cho studio khác.
6. App iPhone — sau khi lịch ổn định trên web.

### 5. Lát 1 làm gì
| Phần | Có trong lát 1 |
|---|---|
| Bảng giá | Nhóm dịch vụ; dịch vụ chính / dịch vụ phụ / phụ phí (mã, tên, thời lượng); gói combo (gồm dịch vụ nào, nhân vật áp dụng, địa điểm cho phép, số thợ, tiền cọc mặc định, điều khoản); đổi giá bằng cách thêm bản giá mới có ngày hiệu lực; danh sách studio/cửa hàng; cách tính phí di chuyển mặc định (cố định / theo km / nhập tay) |
| Hợp đồng | Chọn khách, thêm nhiều gói, tick dịch vụ phụ, thêm phụ phí (được ghi đè giá, bắt buộc ghi chú), phí di chuyển (tại nhà hoặc địa điểm khác **bắt buộc** có dòng phí, miễn phí thì nhập 0 đ; theo km thì làm tròn lên bội 1.000 đ). Giá chốt vào dòng hợp đồng lúc thêm. Sau khi xác nhận: chỉ thêm dòng phát sinh hoặc huỷ dòng có lý do |
| Lịch makeup | Lịch sinh từ hợp đồng hoặc tạo riêng; phân thợ chính/thợ phụ; phút di chuyển trước/sau; chặn trùng giờ thợ; đổi trạng thái (nháp → chờ xác nhận → đã xác nhận → đang làm → hoàn thành / huỷ / khách không đến) có lưu lịch sử; ba chế độ xem A (cột theo thợ), B (danh sách theo ngày), C (lưới tuần thợ × ngày), mở ra luôn là C. Lịch không giữ tiền |
| Chống gửi trùng | Bấm "Lưu" hai lần không tạo hai lịch |

Các luật nghiệp vụ trên lấy từ `docs/NHAT-KY-QUYET-DINH-THAY.md` (15:20–15:40) và `docs/SO-Y-MUON.md`.

### 6. KHÔNG làm ở bản đầu (lát 1)
| Không làm | Lý do / nguồn |
|---|---|
| Trạng thái thanh toán trên lịch | Quyết định 15:14 ngày 18/10/2026: thanh toán thuộc module tài chính, suy ra từ sổ giao dịch, không lưu ở bảng lịch |
| Thu tiền online, cổng thanh toán | Chưa có cổng thanh toán; thuộc module tài chính |
| Website giới thiệu, đào tạo, cổng học viên, file, thông báo, thuê bao | Ngoài lát 1 |
| App iPhone | Ngoài lát 1; chưa có tài khoản Apple Developer |
| Tính khoảng cách tự động theo bản đồ | Chưa có khoá Google Maps. Cột toạ độ đã có sẵn; số km và phút di chuyển nhập tay |
| Nhớ chế độ xem lịch người dùng chọn lần trước | Quyết định 15:40: mỗi lần mở lịch đều về chế độ C |
| Chặn trùng lịch của một thợ **giữa hai tổ chức khác nhau** | Chặn trùng tính theo tư cách thành viên trong từng tổ chức (xem `docs/DATABASE_SCHEMA.md`). Thợ làm cho hai studio có thể bị đặt trùng giờ ở hai nơi. Cần anh Chiến quyết có làm ở lát sau không |

Những thứ sau **chưa có và chưa ai quyết** có làm ở bản đầu hay không: quên mật khẩu / đặt lại mật khẩu, xác thực hai lớp, xuất/xoá dữ liệu cá nhân theo yêu cầu khách. Xem `docs/SECURITY.md`.
