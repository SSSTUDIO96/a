# Sổ lỗi đã đo — bài giảng cho studio khác

Mỗi lỗi ghi đủ: triệu chứng · gốc bệnh · số đo · cách chặn. Lỗi thật là bài học đắt nhất, vì studio khác sẽ vấp đúng chỗ đó.

---

## Phần CỦA NGHỀ

### 1. Bài thử qua hết, nhưng bản chạy thật không build được
- **Triệu chứng:** 35/35 bài thử qua. Lệnh đóng gói bản chạy thật báo `Unknown option --noExternal`, không ra tệp nào.
- **Gốc bệnh:** bài thử chạy thẳng trên mã nguồn, không đi qua bước đóng gói, nên không bao giờ chạm tới câu lệnh đóng gói viết sai.
- **Số đo:** bài thử 35/35 qua; build 0/1.
- **Cách chặn:** "xong" phải gồm cả build ra tệp thật, khởi động bản build và gọi thử. Sau khi sửa: 8/8 lần gọi thử đúng.
- **Bài học cho studio khác:** đừng nhận "bài thử xanh" làm bằng chứng xong. Bắt thợ bật app thật lên cho anh xem.

### 2. Bài thử qua ngay lần đầu thì phải nghi thước đo bị mù
- **Cách làm:** cố ý phá hai chỗ trong mã rồi chạy lại cửa gác cách ly tổ chức.
- **Số đo:** bỏ kiểm quyền → "thiếu quyền bị chặn" rơi từ 10/10 xuống 0/10. Tra thành viên không theo tổ chức → "người ngoài bị chặn" rơi từ 10/10 xuống 0/10.
- **Kết luận:** cửa gác không mù. Thước nào chưa từng chuyển đỏ thì chưa được tin.

### 3. Thêm quyền mới, tổ chức cũ không tự có
- **Triệu chứng:** sau khi thêm quyền Bảng giá và Lịch vào danh mục, chủ của tổ chức tạo trước đó vẫn không có quyền này.
- **Gốc bệnh:** vai trò mẫu được **chép** vào từng tổ chức lúc tạo. Sửa mẫu chỉ có tác dụng với tổ chức tạo sau.
- **Số đo:** tổ chức thử trên máy đám mây: 9/9 vai trò hệ thống lệch mẫu trước khi đồng bộ, 0 lệch sau khi đồng bộ.
- **Cách chặn:** lệnh `db:sync-roles` chạy sau mỗi lần triển khai. Bài thử `test/system-roles.test.ts` in "khớp mẫu N/9" và kiểm tra chạy lần hai không đổi gì.
- **Bài học:** sửa khâu nhập không tự chữa dữ liệu đã nhập. Mỗi lần đổi luật phải hỏi: bản ghi cũ có cần sửa theo không?

### 4. Công cụ database chặn AI xoá trắng database
- **Triệu chứng:** lệnh `prisma migrate reset` từ chối chạy khi phát hiện người gọi là AI. Nó đòi chép nguyên văn lời đồng ý của chủ.
- **Cách xử lý đúng:** không lách bằng lời đồng ý giả. Đổi thiết kế: bài thử chỉ áp migration (không xoá gì), mỗi bài thử tự tạo tài khoản và tổ chức có mã ngẫu nhiên nên không cần xoá dữ liệu cũ.
- **Bài học:** gặp rào an toàn thì sửa quy trình cho khỏi cần vượt rào, đừng tìm cách trèo qua.

### 5. Lệnh bật tiện ích database cần quyền quản trị cao nhất
- **Triệu chứng:** ràng buộc chặn trùng lịch cần tiện ích `btree_gist`. Tài khoản ứng dụng không đủ quyền bật nó.
- **Cách chặn:** bật tiện ích trước bằng tài khoản quản trị database (trên Supabase: trang quản trị → Database → Extensions). Đã ghi vào thứ tự triển khai.

### 6. Lệnh "gom tất cả" lưu cả việc thợ khác đang làm dở
- **Triệu chứng:** bản lưu đầu tiên gom vài ảnh R&D đang chụp dở.
- **Cách chặn:** khi nhiều thợ chạy song song, điều phối chỉ lưu theo đúng đường dẫn tệp đã nghiệm thu, không dùng `git add -A`.

### 7. Cửa gác "phá thử 2 lần đều đỏ" mà vẫn mù với 3 kiểu lỗi (thợ chấm độc lập tìm ra)
- **Triệu chứng:** cửa gác cách ly in 10/10 ở mọi phép. Thợ chấm cài 3 lỗi thật vào mã thì cửa gác vẫn xanh: quên lọc theo tổ chức trong câu tra cứu, đường khai sai loại, phần xử lý hỏng hẳn.
- **Gốc bệnh:** người làm tự chọn cách phá thử, nên chỉ phá đúng những chỗ mình đã nghĩ tới. Cửa gác chỉ kiểm lớp cửa vào, không kiểm phần bên trong.
- **Cách chặn:** dựng lại cửa gác với 7 phép: loại đường, người ngoài, thiếu quyền, chưa đăng nhập, **id chéo tổ chức**, **rò dữ liệu**, **giữ đúng nghĩa**. Kèm `test/gate-mutants.test.ts`: cài 5 kiểu lỗi, cửa gác phải đỏ đúng phép.
- **Bài học cho studio khác:** người làm không được tự chấm, kể cả khi đã "tự phá thử". Thợ chấm khác người làm mới nghĩ ra cách phá người làm không nghĩ tới.

### 8. Quản lý hạ được quản trị (lỗi nghiêm trọng, thợ chấm tìm ra)
- **Gốc bệnh:** luật thứ bậc chỉ bảo vệ vai trò "chủ". Mọi vai trò khác không được che.
- **Cách chặn:** không ai đổi, khoá hay cho rời người đang giữ quyền mình không có. Sửa một vai trò thì phải có đủ cả quyền cũ lẫn quyền mới. Quyền được tra lại **sau** khi khoá dữ liệu tổ chức. Số đo đua 15 lượt: mọi lệnh được chấp nhận đều chạy trước lệnh hạ quyền (3/15), không lệnh nào lọt sau.

### 9. Bài thử xanh trong khi mã thiếu hẳn một hàm
- **Triệu chứng:** điều phối thay một đoạn mã "từ mốc này tới hết tệp", làm mất luôn hàm nằm phía sau. Bài thử vẫn 10/10, chỉ kiểm tra kiểu mới báo lỗi.
- **Gốc bệnh:** công cụ chạy bài thử bỏ qua kiểm tra kiểu.
- **Cách chặn:** lệnh `pnpm test` của máy chủ chạy kiểm tra kiểu trước, đỏ thì không chạy bài thử.

### 10. Ràng buộc database bắt được mã ghi thiếu dữ liệu
- **Triệu chứng:** thợ bảng giá thấy 4 bài đổi thẻ đăng nhập trả 500 khi chạy toàn bộ.
- **Gốc bệnh:** database của thợ nhận ràng buộc mới "thu hồi thì phải có lý do", trong khi mã của thợ vẫn là bản cũ không ghi lý do.
- **Kết luận:** đây không phải lỗi của ràng buộc. Ràng buộc đã chặn đúng một đường ghi thiếu dữ liệu. Chạy lại sau khi đồng bộ: 10/10.

### 11. Thay chữ bằng lệnh tự động: dấu ngoặc kép bị chèn sai (2 lần)
- **Triệu chứng:** sau khi sửa bản vẽ dữ liệu bằng lệnh tự động, Prisma báo "dòng không hợp lệ". Ra là dấu `"` bị biến thành `\"`.
- **Cách chặn:** sau mỗi lần sửa bằng lệnh tự động, chạy kiểm tra hợp lệ ngay; dò toàn tệp xem còn dấu `\` nào không.

### 12. Thước đo "không lộ dữ liệu" đặt sai tiêu chí, đỏ nhầm 23 chỗ
- **Triệu chứng:** phép kiểm tham chiếu chéo mới báo 23 vi phạm. Phần lớn là "lộ 1 giá trị của A" trong câu báo lỗi 400.
- **Gốc bệnh:** giá trị bị coi là "lộ" chính là mã người gửi vừa đưa lên; máy chủ chỉ nhắc lại trong câu báo lỗi. Thước đếm nhầm việc *nhắc lại điều người hỏi đã biết* thành *lộ dữ liệu*.
- **Tiêu chí đúng:** gửi mã thật của tổ chức khác, rồi gửi một mã bịa không tồn tại. Hai phản hồi phải **giống hệt nhau**. Khác nhau nghĩa là máy chủ để lộ "bản ghi kia có tồn tại", dù không trả dữ liệu nào.
- **Chứng minh thước mới không mù:** cài 3 lỗi (xem trước lộ khách, lọc danh sách quên tổ chức, báo "thuộc tổ chức khác" thay vì "không tìm thấy"). Cả 3 bị bắt.
- **Bài học cho studio khác:** đổi tiêu chí của thước theo hướng *nới* thì bắt buộc cài lỗi để chứng minh thước vẫn bắt được. Nới mà không chứng minh là tự che lỗi của mình.

### 13. Lưu bản khi bài thử đang đỏ
- **Triệu chứng:** điều phối chạy "bài thử rồi lưu" trong một chuỗi lệnh. Bài thử web báo 2 bài đỏ nhưng lệnh lưu vẫn chạy. Lời ghi bản lưu còn chép số "147 bài" của thợ, không phải số điều phối tự đo.
- **Đo lại:** trên đúng bản đã lưu (bung ra thư mục riêng), web đạt 119 + 28 = 147/147. Hai bài đỏ chỉ do phần thợ khác đang làm dở trong thư mục làm việc. Mã đã lưu không lỗi. Quy trình thì sai.
- **Cách chặn:** lưu chỉ được chạy khi lệnh bài thử thoát mã 0 (nối bằng `&&`, không lọc kết quả qua `grep` trước đó). Số ghi trong lời lưu phải là số tự đo trên đúng bản sắp lưu.

---

## Phần CỦA RIÊNG DỰ ÁN NÀY
- Lỗi 1: `apps/api/package.json` (script build cũ) → sửa sang `apps/api/tsup.config.ts`, commit `7572db8`.
- Lỗi 3: `apps/api/src/scripts/sync-system-roles.ts`, commit `0c55493`.
- Lỗi 4: `apps/api/test/global-setup.ts`.
- Lỗi 5: migration `20261018151403_bang_gia_lich`.
