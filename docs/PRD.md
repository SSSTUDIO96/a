# Bản mô tả sản phẩm (PRD) — Makeup Pro

Cập nhật: 18/10/2026. Người viết: AI (thợ tài liệu). **Đã đối chiếu với commit `634d6a3`** (17:00 UTC; mã giống hệt `bc9633a`, hai commit sau chỉ thêm sổ ghi). Nguồn: mã trong kho, `docs/BAN-GIAO-PHIEN.md`, `docs/SO-Y-MUON.md`, `docs/NHAT-KY-QUYET-DINH-THAY.md`, `docs/rnd/BAN-VE-C.md`.

> **Lưu ý:** bản yêu cầu gốc của anh Chiến (bản nói "13 module + app iPhone") **không nằm trong kho**. Danh sách module ở mục 3 dựng lại từ kho và từ lời anh trong `docs/SO-Y-MUON.md`. Cần đối chiếu với bản gốc.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. PRD dùng để làm gì
PRD trả lời bốn câu: **làm cái gì, cho ai, làm theo thứ tự nào, cái gì chưa làm.** Khi có người đòi thêm tính năng giữa chừng, chỉ cần hỏi: "nó nằm ở lát nào?"

### 2. Chia việc theo "lát"
Một **lát** là một phần sản phẩm làm trọn từ đầu đến cuối: dữ liệu, máy chủ, giao diện, bài thử, tài liệu. Xong lát nào thì dùng thật được lát đó.

| Luật chia lát | Vì sao |
|---|---|
| Mỗi lát phải có người dùng thật dùng được ngay | Biết sớm cái nào sai trước khi xây thêm |
| Lát sau dựa vào dữ liệu của lát trước, không dựa vào lời hứa | Tránh "chờ module kia xong mới chạy được" |
| Lát đầu chọn phần dùng nhiều nhất mỗi ngày | Lịch và bảng giá là việc studio mở ra hằng ngày |
| Mỗi lát có danh sách "KHÔNG làm" viết rõ | Chặn việc phình ra giữa chừng |
| Phần nào của bản yêu cầu chưa xếp mốc thì ghi "chưa xếp", không im lặng | Anh Chiến từng phải tự nhắc chuyện trang quản trị nền tảng (`docs/SO-Y-MUON.md`) |

### 3. Ba loại khách của một phần mềm thuê theo tháng ngành làm đẹp
| Loại | Đặc điểm | Cần gì nhất |
|---|---|---|
| Thợ cá nhân | Một người, tự nhận lịch, tự báo giá | Bảng giá gọn, lịch không trùng, ghi cọc |
| Đội / studio | Chủ + thợ chính + thợ phụ + lễ tân | Phân lịch cho thợ, phân quyền, trả công theo bậc |
| Trung tâm đào tạo | Giảng viên, trợ giảng, học viên | Khoá học, hợp đồng khoá học, thu tiền theo đợt, cổng học viên |

Một người có thể thuộc **nhiều đơn vị** cùng lúc. Phần mềm phải cho một tài khoản vào nhiều đơn vị, mỗi đơn vị một bộ quyền riêng.

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Sản phẩm là gì
**Makeup Pro** là phần mềm quản lý cho ngành makeup Việt Nam. Nhiều tổ chức dùng chung một hệ thống, dữ liệu tách nhau. Anh Chiến dùng cho studio ảnh cưới của mình, sau đó **bán quy trình và tài liệu** cho studio khác.

### 2. Cho ai — đã có trong dữ liệu
Ba loại tổ chức: `INDIVIDUAL` (thợ cá nhân), `TEAM` (đội/studio), `ACADEMY` (trung tâm đào tạo) (`apps/api/prisma/schema.prisma:20-24`). Một tài khoản tham gia nhiều tổ chức qua bảng `memberships`.

Vai trò mẫu chép vào mỗi tổ chức lúc tạo (`packages/shared/src/permissions.ts:56-95`):

| Vai trò | Được làm gì (tóm tắt) |
|---|---|
| Chủ tài khoản, Quản trị | Mọi quyền. Chỉ chủ mới trao được vai trò chủ |
| Quản lý | Nhân sự (trừ cho rời), bảng giá, đổi giá, khách, hợp đồng kể cả **điều chỉnh hợp đồng đã xác nhận**, lịch cả tổ chức, hồ sơ thợ, thu tiền, báo cáo, tệp. **Không** xem/đặt tiền công |
| Lễ tân | Khách, lập/sửa hợp đồng nháp, lịch cả tổ chức, ghi phiếu thu, tệp. **Không** điều chỉnh hợp đồng đã xác nhận, không huỷ phiếu thu |
| Kế toán | Xem nhật ký, bảng giá, khách, hợp đồng, lịch, hồ sơ thợ; **chỉ xem** tiền công; ghi và huỷ phiếu thu; báo cáo |
| Thợ makeup, Thợ phụ | Xem bảng giá, lịch mình được phân, hồ sơ thợ (không thấy số điện thoại thợ khác), xem tệp |
| Giảng viên | Xem bảng giá, lịch mình |
| Trợ giảng | Xem lịch mình |

Phân quyền mẫu do trợ lý chọn khi anh Chiến vắng (15:16 và G2, G3, G5 lúc 17:05 theo `docs/NHAT-KY-QUYET-DINH-THAY.md`). **Anh cần xem lại**, nhất là: thợ chính có cần thấy lịch cả đội không.

### 3. Các module
Trạng thái thật ở `docs/PROGRESS.md`.

| # | Module | Phạm vi | Nguồn yêu cầu |
|---|---|---|---|
| 1 | Tổ chức, nhân sự, vai trò, đăng nhập | Đăng ký, đăng nhập (app: thẻ trong thân; web: cookie), tạo tổ chức, thêm nhân sự, vai trò tuỳ chỉnh | Bản yêu cầu |
| 2 | Nhật ký thay đổi | Ai làm gì lúc nào; không sửa, không xoá được | Bản yêu cầu |
| 3 | Bảng giá | Nhóm dịch vụ; dịch vụ chính / dịch vụ phụ (tóc, nail, lens…) / phụ phí; gói theo **nhân vật makeup**, địa điểm cho phép, bán kính miễn phí; lịch sử giá; studio/cửa hàng; phí di chuyển 4 cách (cố định, theo km, nhập tay, theo bậc khoảng cách) | Anh Chiến, 18/10/2026 |
| 4 | Khách hàng | Hồ sơ khách, tìm theo tên/số điện thoại | Bản yêu cầu |
| 5 | Hợp đồng | Nhiều dòng: nhiều gói, dịch vụ phụ, phụ phí phát sinh, phí di chuyển; **thợ phụ trách** từng dòng với cảnh báo rảnh / có lịch trong ngày / trùng giờ; xác nhận thì tự lên lịch; sau xác nhận chỉ thêm dòng hoặc huỷ dòng có lý do | Anh Chiến, 18/10/2026 |
| 6 | Lịch makeup | Phân thợ, chặn trùng giờ gồm thời gian di chuyển, trạng thái thực hiện; 3 chế độ xem A/B/C, mặc định C | Bản yêu cầu + anh Chiến |
| 7 | Nhân sự & tiền công | Bậc lương, hồ sơ thợ (ảnh, tên hiển thị, có nhận lịch không), tiền công theo gói/dịch vụ theo bậc | Anh Chiến, 18/10/2026 |
| 8 | Thu tiền | Tiến độ thanh toán theo đợt, phiếu thu/phiếu hoàn chỉ ghi thêm, báo cáo doanh thu (cọc, còn lại, thực thu) | Anh Chiến (phần đào tạo), 18/10/2026 |
| 9 | Lưu trữ tệp | Ảnh đại diện thợ/khách, logo, album, tài liệu khoá học, bài nộp, thiệp chào mừng | Bản yêu cầu |
| 10 | Website giới thiệu | Trang công khai của studio, đọc dịch vụ và hồ sơ thương hiệu đã xuất bản | Bản yêu cầu |
| 11 | Đào tạo + cổng học viên | Khoá học theo nhóm của trung tâm; hợp đồng loại "khoá học"; nội quy; **20 mẫu thiệp chào mừng** có tên học viên, khoá, ảnh, thương hiệu | Anh Chiến, 18/10/2026 (mốc 7–9) |
| 12 | Thông báo | Nhắc lịch, báo thay đổi | Bản yêu cầu |
| 13 | Thuê bao + trang quản trị nền tảng | Gói thuê, hạn mức, trang quản trị cho chủ nền tảng "giống SS Pro", **không** dùng mật khẩu chung | Anh Chiến, 18/10/2026 (mốc 6) |
| — | App iPhone | Thợ xem lịch, nhận phân công | Bản yêu cầu |

**Chưa chắc 13 dòng này trùng 13 module của bản gốc.** Hợp đồng, tiền công, thu tiền, quản trị nền tảng, đào tạo là anh nhắn thêm trong ngày.

### 4. Lộ trình
| Mốc | Nội dung | Ai chọn, khi nào | Trạng thái (chi tiết: `docs/PROGRESS.md`) |
|---|---|---|---|
| 0 | Khảo sát | — | Xong |
| 1 | Bộ tài liệu | — | Đang cập nhật (lỗi N4) |
| 2 | Nền móng | — | Đạt có điều kiện (T3 đã sửa, N4 đang làm) |
| 3 | R&D giao diện | — | Vòng 1–2 xong, chọn C; vòng 3 (mẫu chào mừng) đang chạy |
| **4 — Lát 1** | **Bảng giá + Lịch makeup** (anh chọn), cùng ngày gộp thêm hợp đồng, thợ phụ trách, bậc lương | **Anh Chiến chọn ngày 18/10/2026** | Máy chủ đạt có điều kiện; web đang dựng (W0–W3 có mã, W4–W7 chưa) |
| 5 | Nghiệm thu lát 1 | — | Máy chủ đã chấm; web chưa |
| 6 | Trang quản trị nền tảng | Anh Chiến nhắn 18/10/2026 | Máy chủ có 8 đường (chưa có bài thử trong kho); giao diện chưa có, R&D chưa vẽ |
| 7–9 | Đào tạo: R&D → máy chủ → giao diện | Anh Chiến nhắn 18/10/2026 | R&D mẫu chào mừng đang chạy |
| Chưa xếp | Thông báo, website giới thiệu (giao diện), app iPhone | — | Chưa xếp mốc |

### 5. Lát 1 làm gì
| Phần | Có trong lát 1 |
|---|---|
| Bảng giá | Như module 3. Đổi giá = thêm bản giá có ngày hiệu lực |
| Hợp đồng | Như module 5. Tại nhà / địa điểm khác **bắt buộc** có dòng phí di chuyển (miễn phí nhập 0 đ); theo km làm tròn lên bội 1.000 đ; phụ phí được ghi đè giá kèm ghi chú; huỷ hợp đồng thì huỷ lịch chưa làm, lịch đang làm thì chặn huỷ |
| Lịch | Lịch sinh từ hợp đồng hoặc tạo riêng; thợ chính/phụ; phút di chuyển; chặn trùng; bảng chuyển trạng thái có lịch sử; lịch không giữ tiền |
| Nhân sự | Bậc lương, hồ sơ thợ, thợ tắt "nhận lịch" thì không được xếp, tiền công theo bậc |
| Chống gửi trùng | 12 đường tạo bắt buộc khoá chống gửi trùng (`docs/API_SPEC.md`) |

### 6. KHÔNG làm ở bản đầu (lát 1)
| Không làm | Lý do / nguồn |
|---|---|
| Trạng thái thanh toán trên lịch | Quyết định 15:14: suy ra từ sổ thu tiền |
| Thu tiền online qua cổng thanh toán | Chưa có cổng thanh toán. Bảng phiếu thu đã có, chưa có đường API |
| Tính km tự động theo bản đồ | Chưa có khoá Google Maps; số km nhập tay |
| Nhớ chế độ xem lịch lần trước | Quyết định 15:40: luôn mở chế độ C |
| Chặn trùng lịch của một thợ **giữa hai tổ chức** | Chặn trùng tính trong từng tổ chức (`docs/DATABASE_SCHEMA.md` mục 3.5). Chờ anh quyết |
| Hợp đồng nháp giữ chỗ thợ | Thợ dự kiến ở hợp đồng nháp chỉ hiện cảnh báo "đang được giữ ở hợp đồng nháp khác", không chặn |

Chưa có và **chưa ai quyết** làm trước khi bán hay không: quên mật khẩu, xác thực hai lớp, xuất/xoá dữ liệu cá nhân. Xem `docs/SECURITY.md`.
