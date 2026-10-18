# Nhật ký quyết định thay anh Chiến

Anh Chiến nhắn lúc khoảng 15:13 UTC ngày 18/10/2026: *"Tự làm vào chia giao cho các thợ phụ trách để đẩy nhanh tiến độ cho tôi tôi về ngủ đừng hỏi hoặc đợi gì ở tôi"*. Từ lúc đó, trợ lý tự quyết những việc dưới đây. Giờ ghi theo UTC (Việt Nam = UTC+7).

| Giờ (UTC) | Việc | Quyết gì | Vì sao | Lùi được không |
|---|---|---|---|---|
| 15:02 | Phiên bản Prisma | Dùng Prisma 6.19.3, chưa lên 7.x | Bản 6 đã dùng ổn ở Studio Pro. Bản 7 đổi cách kết nối, rủi ro chưa đo. | Được: nâng cấp có chủ đích sau |
| 15:09 | Database cho bài thử | Chỉ áp migration (`migrate deploy`), không xoá trắng database | Prisma chặn AI chạy lệnh xoá trắng. Không lách bằng đồng ý giả. | Được |
| 15:14 | Trạng thái thanh toán của lịch | Không lưu ở bảng lịch; sẽ suy ra từ sổ giao dịch khi làm module tài chính | Tách hẳn trạng thái thực hiện và thanh toán, như bản yêu cầu đòi | Được: thêm cột sau |
| 15:14 | Lịch nháp có chiếm giờ thợ không | Không. Từ "chờ xác nhận" trở lên mới chiếm giờ. Huỷ hoặc khách không đến thì nhả giờ. | Nháp là bản đang soạn, chưa hứa với khách | Được: đổi một dòng điều kiện |
| 15:15 | Chống gửi trùng | Bắt buộc header Idempotency-Key cho các đường POST tạo lịch | Bấm "Lưu" hai lần hoặc mạng gửi lại không được tạo hai lịch | Được |
| 15:16 | Quyền theo vai trò mẫu | Thợ makeup và thợ phụ chỉ xem lịch mình được phân. Lễ tân tạo và sửa lịch, khách hàng. Kế toán chỉ xem. | Thói quen studio thường gặp; chủ tự tạo vai trò tuỳ chỉnh nếu khác | Được: sửa mẫu, chạy lệnh đồng bộ |
| 15:17 | Vai trò hệ thống | Không cho sửa. Khi danh mục quyền đổi, chạy `db:sync-roles` để tổ chức cũ được bổ sung | Tổ chức cũ thiếu quyền mới là lỗi thật (xem sổ lỗi, mục 3) | Được |
| 15:18 | Chia thợ | 3 thợ chạy song song theo tệp: Bảng giá / Khách + Lịch / Tài liệu | Ba nhóm tệp không giẫm nhau; tệp dùng chung điều phối sửa trước | — |

| 15:20 | Yêu cầu mới về hợp đồng (anh nhắn giữa chừng) | Dừng thợ A và B, vẽ lại dữ liệu (bản v2): tiền chỉ nằm ở hợp đồng; lịch chỉ giữ giờ, thợ, địa điểm | Một công thức tiền duy nhất. Lịch giữ tiền song song với hợp đồng sẽ lệch nhau | Được: migration mới, dữ liệu thật chưa có |
| 15:21 | Bỏ bảng `appointment_items` và các cột tiền của lịch | Xoá bằng migration mới, không sửa migration cũ | Chỉ có dữ liệu thử trên máy đám mây | Được |
| 15:22 | Tại nhà / địa điểm khác | Bắt buộc có dòng phí di chuyển; miễn phí thì nhập tay 0 đ | Theo ý anh "nếu có tích … thì sẽ tính phí"; không cho quên im lặng | Được |
| 15:22 | Làm tròn phí theo km | Làm tròn **lên** bội 1.000 đ, không thấp hơn mức tối thiểu | Thói quen báo giá VND; tránh số lẻ trăm đồng | Được: đổi một hàm |
| 15:22 | Khứ hồi | Chỉ nhân đôi số km (cách tính theo km). Phí cố định không nhân đôi. | Phí cố định thường đã là trọn gói đi về | Được |
| 15:23 | Dịch vụ phụ trong hợp đồng | Được tick mọi dịch vụ phụ đang bán của tổ chức. Danh sách tick của gói chỉ là gợi ý hiện sẵn. | Khách hay xin thêm món ngoài gói | Được |
| 15:23 | Phụ phí cài sẵn | Cho ghi đè giá khi lập hợp đồng, bắt buộc ghi chú | "Phụ phí phát sinh" mỗi khách một khác | Được |
| 15:24 | Màn lịch | ~~Chọn phương án B của R&D. Kiểu cột theo thợ (A) làm chế độ phụ trên máy tính.~~ **ANH ĐÃ BÁC** ngày 18/10/2026: *"Cho phép hiển thị cả 3 chế độ và mặc định hiển thị là chế độ C"*. Đã sửa: lịch có đủ 3 chế độ A/B/C, mở ra luôn là C. | (lý do cũ: B không phải vuốt ngang trên điện thoại) | Đã lùi |
| 15:40 | Khung điều hướng | Thanh bên trái trên máy tính và máy tính bảng (giống C và Studio Pro), thanh dưới trên điện thoại | Mặc định là C, khung của C quen với người dùng Studio Pro | Được |
| 15:40 | Nhớ chế độ xem người dùng chọn lần trước | **Không** nhớ: mỗi lần mở lịch đều về C | Anh nói "mặc định hiển thị là chế độ C"; tự nhớ là thêm việc chưa ai yêu cầu | Được: thêm sau nếu anh muốn |
| 15:24 | Màn bảng giá | Chưa chọn. Giao R&D vòng 2 (Bảng giá v2 + Lập hợp đồng). | Yêu cầu mới làm ba bản vòng 1 lỗi thời; bản A tự thêm ô không ai yêu cầu | — |

| 16:25 | Màn Lập hợp đồng | Theo phương án C, như bảng giá anh vừa chọn ("C nhé") | Cùng một họ thiết kế; câu "C nhé" không nói riêng màn nào | Được: R&D còn giữ bản A, B |
| 16:20 | Refresh token cho trang web | Chỉ nằm trong cookie httpOnly (SameSite=Strict, chỉ đường /api/v1/auth). Web phải gửi header `X-Client: web`. App điện thoại vẫn nhận trong thân như cũ. | Mã độc chèn vào trang không lấy trộm được thẻ dài hạn | Được |
| 16:20 | Tên miền web và API | Web gọi `/api` trên **cùng tên miền**; Vercel chuyển tiếp sang máy chủ Railway | Cookie an toàn nhất khi cùng tên miền; không cần mở CORS cho trình duyệt | Được: đổi cấu hình triển khai |

**Cần anh xem lại nhất:** phân quyền theo vai trò mẫu (dòng 15:16). Studio anh có thể muốn thợ chính thấy cả lịch của đội.
