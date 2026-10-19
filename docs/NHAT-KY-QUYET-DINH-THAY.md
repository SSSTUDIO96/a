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

| 17:05 | G1: huỷ hợp đồng mà lịch đã gắn vẫn giữ giờ thợ | Huỷ hợp đồng thì **huỷ luôn** các lịch chưa làm (nháp/chờ/đã xác nhận). Lịch **đang thực hiện** thì chặn huỷ hợp đồng (409). Lịch đã xong giữ nguyên. | Thợ không bị giữ giờ cho đơn đã huỷ; không xoá dấu vết việc đã làm | Được |
| 17:05 | G2: lễ tân đưa hợp đồng về 0 đ bằng giảm giá, huỷ được dòng hợp đồng đã xác nhận | Thêm quyền **"Điều chỉnh hợp đồng đã xác nhận"** (`contracts.adjust`). Chủ, quản trị, quản lý có; **lễ tân không**. Ở hợp đồng nháp, lễ tân vẫn giảm giá và huỷ dòng như cũ. | Tiền đã chốt với khách thì chỉ người có trách nhiệm mới được giảm | Được: thêm quyền cho lễ tân bằng vai trò tuỳ chỉnh |
| 17:05 | G3: kế toán đặt được tiền công thợ | Kế toán **chỉ xem** tiền công; chủ, quản trị đặt | Mức công là quyết định của chủ | Được |
| 17:05 | G4: hợp đồng nhận mọi dịch vụ phụ, không giới hạn theo danh sách tick của gói | **Giữ nguyên** như quyết định lúc 15:23 | Khách hay xin thêm món ngoài gói | — |
| 17:05 | G5: thợ xem được số điện thoại thợ khác | Số điện thoại **thợ** chỉ hiện với người có quyền sửa nhân sự. Số điện thoại **khách** trong lịch của thợ vẫn hiện, vì thợ cần gọi khách. | Bảo vệ thông tin cá nhân giữa nhân viên | Được |
| 17:10 | GitHub | Anh đã cài Claude GitHub App chỉ cho kho `a`. Đã đẩy nhánh `claude/nen-mong-makeup`. | — | — |

| 18:00 | Bán kính miễn phí khi tại nhà | Đặt theo từng gói, km **một chiều**; trống thì lấy mức chung của studio. Trong bán kính: 0 đ (trừ khi nhập tay). | Khách nói "nhà cách 12 km" là một chiều | Được |
| 18:00 | Phụ phí khi vượt bán kính | 4 hình thức: theo km vượt (khứ hồi nhân đôi cả bán kính), theo bậc khoảng cách, cố định, nhập tay. Không có bậc nào khớp thì báo lỗi, không tự đoán. | Đủ các cách studio hay dùng | Được |
| 18:05 | Thu cọc khi hợp đồng còn nháp | Để thợ G quyết và ghi lý do (khách hay chuyển cọc trước khi chốt) | — | Được |
| 18:05 | Quản trị nền tảng | Cấp quyền bằng lệnh chạy trên máy chủ, không qua trang web, không có mật khẩu chung. Người thường gọi đường quản trị nhận "không có đường này". | Sửa đúng lỗi số 6 của Studio Pro | Được |

| 18:20 | Thợ E hỏi: thợ makeup có thấy 3 mục điều hướng (Lịch, Hợp đồng, Khách) không | **Giữ nguyên** theo quyền hiện có; mục nào thiếu quyền thì ẩn | Ẩn theo quyền đã thống nhất ở khung C | Được |
| 18:40 | Phông viết tay | Tạm dùng phông miễn phí giấy phép OFL, chỉ giữ phông in đúng dấu tiếng Việt; phông là một biến thay được | Thư mục phông SS-Album ở ổ H: máy anh, phiên đám mây không đọc được | Được: thay khi anh tải tệp lên |
| 18:55 | Database thử `makeup_test_contract` thiếu chốt chặn | Xoá 2 bậc phí chồng nhau của tổ chức **thử**, áp lại chốt, sửa checksum | Chỉ dữ liệu thử, không đụng dữ liệu thật | Được |
| 19:05 | Cửa gác thêm phép `platform` | Người thường gọi trang quản trị nền tảng phải nhận 404 y hệt đường bịa; chọn đường theo địa chỉ `/platform/` | Đột biến 9 cho thấy chọn theo nhãn thì mù (sổ lỗi 15) | Được |
| 19:10 | Lưu bản chụp hiện trạng việc dở của thợ | Lưu, ghi rõ "CHƯA nghiệm thu" ở lời lưu | Máy đám mây có thể bị thu hồi khi lâu không dùng; mất việc của 6 thợ thì đắt hơn | Được: các bản lưu sau đè lên |
| 19:15 | Nghiệm thu web "đạt có điều kiện" | Giao 2 thợ sửa song song: máy chủ (T3, N2, N3, N4) và web (T2, N1, N5–N9); T1 đếm lại trên mã mới | Lỗi chia được theo tệp, không giẫm nhau | Được |

| 19:40 | Anh nhắn "Cứ làm toàn bộ hết đi khi nào xong báo tôi để tôi vào thao tác thực tế giờ tôi đi ngủ đây" và "Đẩy cho các thợ đi nhé" | Giao song song: W4 Bảng giá, W5 Hợp đồng, W6 Lịch (theo bản vẽ C đã ký); R&D số 2 vẽ 5 màn chưa có bản vẽ (Nhân sự & trả lương, Khách hàng, Thu tiền, Hồ sơ thương hiệu, Quản trị nền tảng) | Chia theo thư mục tính năng, không giẫm tệp | Được |
| 19:40 | Nối sẵn đường web cho W4–W6 | Điều phối tự sửa `src/app/routes.tsx` một lần, trỏ tới `src/features/{pricing,contracts,schedule}/index.tsx`; thợ chỉ giữ thư mục của mình | Ba thợ cùng cần sửa một tệp định tuyến → giẫm nhau | Được |
| 19:42 | Trung tâm đào tạo: chọn phương án nào | **C** (R&D đề xuất; cùng họ với lựa chọn "C nhé" của anh). Giữ ảnh A, B | Một họ thiết kế cho cả app | Được: R&D còn giữ A, B |
| 19:42 | Chọn mẫu chào mừng / Feedback nào | **Không chọn một**: app cho người dùng chọn trong toàn bộ bộ mẫu; mẫu là dữ liệu | Mỗi trung tâm một gu; anh chưa chọn | Được |
| 19:42 | Thanh dưới điện thoại | Tổ chức có đào tạo: Lịch · Hợp đồng · Thu tiền · Khoá học · Thêm. Tổ chức không đào tạo: giữ như bản vẽ C | Thợ makeup đơn lẻ không cần mục Khoá học | Được |
| 19:43 | 5 màn chưa có bản vẽ | R&D số 2 bày 3 phương án có ảnh rồi **tự chọn** phương án đề xuất và dựng bản vẽ thông số | Anh giao làm hết khi vắng; ảnh cả 3 vẫn giữ để anh xem lại | Được |
| 19:44 | "Thao tác thực tế" | Em làm tới mức chạy được đầy đủ trên máy đám mây, có bài thử và ảnh. **Không** tự đưa lên Vercel/Railway và không mua dịch vụ: phát hành nằm trong danh sách phải chờ anh. Sáng mai anh chọn: chạy trên máy anh, hay cho phép đưa lên mạng | Luật 10: phát hành và công khai phải dừng chờ anh | — |

| 20:30 | 5 màn mới (R&D số 2) | Nhân sự & trả lương **C** (hai cột; tiền công: bậc + ảnh + tên thợ + ô tiền), Khách hàng **C** (danh sách trái, hồ sơ phải), Thu tiền dịch vụ **A** (cùng khuôn thu tiền đào tạo), Hồ sơ thương hiệu **C** (sửa trái, xem trước phải), Quản trị nền tảng **B** (trang chủ việc cần làm). Ảnh cả 3 phương án giữ ở `docs/rnd/anh/v4-*` | Số lần bấm cho việc chính ít nhất, đúng lời anh tả màn trả lương | Được |
| 20:30 | Trang giới thiệu công khai | Đặt ở `/trang/:slug`; máy chủ cấm tổ chức đặt đường dẫn `trang` | Không đè đường của tổ chức | Được |
| 20:31 | Màu ca trên lịch | Tô theo **nhân vật makeup** của ca (dữ liệu thật); bỏ nhóm màu "Ăn hỏi", "Tiệc & sự kiện" của bản mẫu vì database không có loại sự kiện | Không đoán theo chữ trong tên ca | Được: thêm trường loại sự kiện nếu anh muốn |
| 20:31 | Ô ngày giờ | Mọi ô ngày hiện dd/mm/yyyy, giờ 24h, kể cả trình duyệt tiếng Anh | Tránh đặt nhầm ngày | Được |
| 20:32 | Thu cọc trước khi chốt — ngày thu | Không cho ghi ngày thu trước ngày lập hợp đồng quá 1 ngày; lùi ngày có nhật ký | Kỳ đã chốt không bị đổi số âm thầm | Được |
| 20:32 | Trang công khai khi thuê bao hết hạn | Quá thời gian ân hạn hoặc đã huỷ → ẩn trang (như chưa xuất bản) | Studio không trả tiền thì không quảng bá | Được |

| 21:30 | Khoá tổ chức nghĩa là gì | Giữ như máy chủ đang làm: **khoá = chặn hẳn** (thành viên không vào được). **Hết hạn quá ân hạn = chỉ đọc.** Đầu bài điều phối giao thợ màn quản trị ghi nhầm "khoá → chỉ đọc"; thợ phát hiện và làm đúng máy chủ | Hai trạng thái khác nhau, hai cách xử lý | Được (anh quyết, việc tồn 8) |
| 21:31 | Gom việc tồn | Tạo `docs/VIEC-TON.md`: mọi việc đã nêu chưa làm, tách mục "cần anh quyết" | Không để việc rơi giữa các báo cáo | — |

| 22:10 | Xác nhận hợp đồng chưa gán thợ (thợ chấm: lịch trống) | **Cho xác nhận**; mọi dòng có giờ đều sinh lịch, dòng chưa có thợ nằm ở hàng "Chưa có thợ"; web cảnh báo vàng | Studio hay chốt khách trước rồi mới xếp thợ; không được để mất lịch | Được |
| 22:10 | Giữ chỗ của hợp đồng nháp khác | Chỉ cảnh báo, **không** chặn xác nhận (đúng quyết định 15:14: nháp không chiếm giờ) | Màn và máy chủ phải cùng một luật | Được |
| 22:10 | Hai người cùng sửa một hợp đồng | Máy chủ kiểm phiên bản, lệch thì báo "vừa được người khác sửa" | Không xoá im lặng phần người kia vừa sửa | Được |
| 22:10 | Giờ kết thúc trước giờ bắt đầu ở Lịch | Báo lỗi, trừ khi người dùng bật "Kết thúc hôm sau" | Không tự đoán thành ca qua đêm | Được |
| 22:10 | Lễ tân huỷ hợp đồng đã xác nhận | Cần quyền "Điều chỉnh hợp đồng đã xác nhận" như huỷ dòng | Hai cửa cùng một luật | Được |
| 22:10 | Trần số tiền ở bảng giá | Cùng trần với phiếu thu | Một luật cho mọi số tiền | Được |

| 23:40 | Database thử mặc định `makeup_test` chứa dữ liệu thử cũ vượt trần 100 tỷ (9 dòng) | Dựng lại từ đầu (xoá database thử, tạo mới, áp đủ migration). **Chỉ database thử**, không đụng database phát triển hay dữ liệu thật | Để lệnh kiểm tra gốc chạy được với chốt trần tiền mới | Được: dữ liệu thử tự sinh lại khi chạy bài thử |
| 00:30 | Phụ phí (ví dụ phụ phí đi xa, phụ phí ngày lễ) không có thời lượng | Cho phép bỏ trống thời lượng — chỉ riêng loại phụ phí; gói chính và dịch vụ phụ vẫn bắt buộc. Phụ phí cũ đang mang số phút giả **không tự đổi** | Bỏ trống là "không áp dụng"; ghi 0 thì lẫn với "0 phút" | Được: một migration nới chốt |
| 00:30 | Đổi khách trên hợp đồng nháp khi đã có lịch hoặc thẻ thiết kế | Chặn, báo "khách đang được dùng" kèm số lượng | Lịch và thẻ đã chép khách cũ, đổi nửa vời sẽ lệch | Được |
| 01:40 | N2 của thợ chấm cuối: hợp đồng dịch vụ xác nhận được khi dòng chưa có giờ → không có ca trên Lịch | **Chặn xác nhận** khi còn dòng cần lên lịch mà chưa có giờ (máy chủ chặn, web khoá nút và chỉ dòng thiếu). Không chọn cách "mở khoá ô giờ sau khi chốt" | Giữ đúng luật 22:10 "hợp đồng đã chốt không được vắng mặt trên lịch"; chặn ở cửa vào đơn giản hơn mở thêm một đường sửa dòng đã chốt | Được: nới lại chỉ là bỏ một chốt |
| 01:40 | T3: giới hạn gói (số thành viên, lịch/tháng, dung lượng) chưa áp | **Không áp** đợt này, ghi việc tồn cho anh quyết | Luật 15 của anh: "Không dựng cửa chặn bản quyền, license … hộ tôi". Gói Dùng thử đang cho 1 thành viên — áp ngay sẽ chặn chính studio đang dùng thử | Được |
| 01:40 | T2: gói Dùng thử có 0 khoá học; chưa nạp gói thì lưu khoá học báo lỗi 500 | Giữ nguyên số của gói (việc thương mại của anh); chỉ sửa **lời báo và mã lỗi** cho rõ "gói chưa có khoá học, liên hệ để nâng gói" | Luật 15 | Được |
| 01:40 | T1: gợi ý tiến độ "Cọc + 2/3 đợt" cách nhau cố định 30 ngày, có đợt hạn sau ngày cưới | Chia đều các đợt từ hôm nay tới ngày sự kiện (khoá học: ngày kết thúc lớp); không có ngày thì giữ 30 ngày | Không đợt nào được hạn sau ngày cưới | Được |
| 01:40 | L5: gói mặc định tắt "hiện trên trang công khai" | Giữ nguyên, ghi việc tồn cho anh | Có thể là chủ ý: anh chọn gói nào lộ giá | Được |
| 09:30 | Tên ngắn của thợ trên lịch và hợp đồng | Studio đặt tên hiển thị thì dùng nguyên tên đó; chưa đặt thì lấy tiếng cuối của họ tên ("Nguyễn Thu Hà" → "Hà"). Chế độ lịch B (danh sách trong ngày) vẫn ghi tên đầy đủ vì đủ chỗ | Một người một tên trên mọi khổ màn | Được |
| 19/10 sáng | Việc tồn 2, 5, 8, 10b (anh nói "Làm hết đi") | Giữ phương án đang chạy: lịch mới tạo để **Nháp**; giảng viên xem **mọi lớp**; tổ chức bị khoá **chặn hẳn**; gói mới **không** tự hiện trên trang công khai | Đều là phương án đề xuất, lùi được bằng một chỗ sửa | Được |
| 19/10 sáng | Việc tồn 3, 6, 7 | Làm: thêm màu cho nhân vật thứ 7 trở đi; sinh buổi học lên Lịch theo lịch lớp; thêm mẫu chào mừng thứ 20 | Việc rõ, vào thẳng xưởng | Được |
| 19/10 sáng | Việc tồn 4 (loại sự kiện), thông báo, cổng học viên, app iPhone, nền hoa văn | Đi R&D trước, bày 3 phương án có ảnh; anh vắng thì trợ lý chọn 1 và vẫn xuất ảnh cả 3 | Việc mới có giao diện mới (luật 8) | Được |
| 19/10 sáng | Đặt lại mật khẩu qua email | Dựng sẵn với "người gửi thư" thay được: chạy thử thì in đường dẫn ra nhật ký máy chủ; gửi thư thật cần anh chọn dịch vụ email (có thể tốn phí) | Không tự mua dịch vụ trả phí | Được |
| 19/10 sáng | Việc tồn 9 (phông SS-Album), 10 (ảnh màn ssnew) | Chờ anh gửi tệp | Máy đám mây không đọc được ổ H: | — |
| 19/10 trưa | Buổi học lên Lịch cần đổi database (thêm liên kết ca ↔ lớp và ngày buổi học) | Duyệt migration `20261019120000_buoi_hoc_len_lich` theo đề xuất của thợ K2 | Không có liên kết thì không chặn được sinh trùng, không đổi/huỷ theo lớp được | Được: bỏ cột là lùi |
| 19/10 trưa | Buổi học tạo ở trạng thái nào | **Đã xác nhận** (giữ giờ giảng viên) — ngoại lệ có chủ đích so với "lịch mới để Nháp" vốn áp cho ca makeup tự tạo | Buổi học là lịch cố định của lớp; Nháp không giữ giờ thì ca makeup chen vào giờ dạy | Được |
| 19/10 trưa | Huỷ lớp khi có buổi đang diễn ra | Từ chối, báo rõ buổi nào | Giống cách huỷ hợp đồng đang làm | Được |
| 19/10 chiều | Anh nói "giao cho thợ sắp xếp làm giúp tôi đẩy nhanh tiến độ giúp tôi" khi 7 câu chọn còn treo | Trợ lý chọn theo đề xuất R&D để chạy tiếp (anh bác được bất cứ lúc nào): **Thông báo** = B trang "Hôm nay" trước, C bản tin trong app sau, chưa gửi Zalo/SMS/Email (tốn phí); **Loại sự kiện** = C danh sách studio tự đặt, gắn ở dòng, Lịch có công tắc Sự kiện/Nhân vật; **Phụ phí tự động** = có, dạng luật (khung giờ, ngày/ngày lễ, loại sự kiện) tự THÊM dòng gợi ý mà người lập xoá được; **Hợp đồng nhiều ngày** = có, mỗi dòng một ngày (máy chủ đã cho); **Cổng học viên** = B (đường dẫn Zalo + 4 số cuối SĐT, 2 máy, 7 ngày, sai 5 lần khoá, nhớ máy 90 ngày), học viên xem được ảnh Feedback của mình và số tài khoản trung tâm nếu trung tâm điền; **App iPhone** = web cài lên màn hình chính; **Nền** = chờ R&D-07 vòng 2 (nền ảnh + tấm giấy) rồi chốt | Luật 10: trợ lý được chọn 1 trong 3 phương án đã bày | Được: mỗi việc còn ở bước bản vẽ |
| 19/10 chiều | Chứng chỉ (R&D-08) | Luồng A + "Sổ chứng chỉ đã cấp" + nút In lại trong hồ sơ học viên; đủ 10 mẫu; tiêu đề **"Giấy chứng nhận"** (an toàn pháp lý hơn "chứng chỉ" khi trung tâm chưa có phép cấp văn bằng); mẫu nào cũng có ảnh tròn, chưa có ảnh thì in chữ cái đầu; số theo năm (CC-2026-0007), cấp lại giữ số cũ ghi "bản cấp lại"; người cấp: chủ và quản lý; chỉ cấp khi lớp kết thúc; còn nợ học phí thì **cảnh báo, không chặn**; không in sẵn chữ ký/con dấu; chưa làm xếp loại và mã QR | Theo đề xuất R&D-08 | Được |

**Cần anh xem lại nhất:** (1) cách anh vào thao tác thực tế (dòng 19:44): chạy trên máy anh hay cho phép đưa lên mạng; (2) phân quyền theo vai trò mẫu (dòng 15:16) — studio anh có thể muốn thợ chính thấy cả lịch của đội.
