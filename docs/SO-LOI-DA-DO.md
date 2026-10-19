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

### 14. Viết tệp migration làm hai lần, thợ khác áp đúng bản dở
- **Triệu chứng:** thợ hợp đồng báo database thử của mình thiếu các chốt chặn (khoá sổ thu tiền, chặn bậc phí chồng nhau…) dù tệp migration trong kho có đủ.
- **Gốc bệnh:** điều phối ghi tệp migration hai bước (phần bảng trước, phần chốt chặn viết tay sau). Giữa hai bước, thợ đang chạy bài thử đã tự áp migration — nhận bản chỉ có phần đầu. Công cụ coi như "đã áp", không bao giờ áp lại.
- **Số đo:** soát 1/1 database thử bị nhận bản thiếu (đã áp = 1, có chốt chặn = 0). Trong lúc thiếu chốt, bài thử đã ghi 2 bậc phí chồng nhau ([0–10) và [5–20) km) — đúng loại dữ liệu chốt chặn phải cấm. Muốn áp lại chốt phải dọn dữ liệu bẩn trước.
- **Cách chặn:** viết migration xong trọn vào tệp tạm ngoài kho, kiểm xong mới chuyển vào thư mục migrations bằng **một** lệnh. Khi nhiều thợ chạy song song, không bao giờ sửa dần một migration đã nằm trong thư mục.
- **Bài học cho studio khác:** chốt chặn thiếu dù chỉ vài phút là đủ để dữ liệu sai lọt vào, và chốt sau đó không tự dọn dữ liệu đã lọt.

### 15. Phép kiểm mới lọc đúng thứ nó cần bắt ra khỏi diện kiểm
- **Triệu chứng:** thêm phép kiểm "người thường gọi vào trang quản trị nền tảng phải nhận 404". Chạy thật: 24/24 xanh. Cài lỗi "đường quản trị khai nhầm thành đường thường" → phép vẫn xanh, vi phạm 0/21.
- **Gốc bệnh:** phép chọn đường để kiểm theo **nhãn khai báo** ("đây là đường quản trị"). Đường khai nhầm nhãn thì mất nhãn, tự rơi khỏi diện kiểm — đúng lỗi phép phải bắt. Mẫu số tụt từ 24 xuống 21 mà không ai để ý.
- **Cách chặn:** chọn theo **địa chỉ thật** (mọi đường bắt đầu bằng `/platform/`), không theo nhãn. Đo lại: cài lỗi → vi phạm 3/24, bản đúng → 24/24.
- **Bài học cho studio khác:** phép kiểm nào chọn đối tượng theo chính cái nhãn có thể sai, thì mù đúng với cái sai đó. Luôn cài lỗi thử, và xem cả **mẫu số** chứ không chỉ "đỏ hay xanh".

### 16. Lệnh áp migration "vào database tạm" lại đi vào database phát triển
- **Triệu chứng:** điều phối áp thử một migration vào database tạm bằng `DATABASE_URL=<tạm> prisma migrate deploy`. Công cụ báo "đã áp hết", nhưng database tạm có 0 bảng.
- **Gốc bệnh:** bản vẽ dữ liệu khai `directUrl = env("DIRECT_URL")`. Khi có `directUrl`, Prisma áp migration qua đường đó. Tệp `.env` trỏ `DIRECT_URL` về `makeup_dev`, nên migration chưa vào kho đã bị áp vào database phát triển. Cùng lệnh sai đã được điều phối chép vào đầu bài của 3 thợ màn hình.
- **Số đo:** 1 database bị áp nhầm (`makeup_dev`, chỉ dữ liệu thử): 2 migration, trong đó 1 migration chỉ thêm chỉ mục, chưa nằm trong kho. Đối chiếu checksum: bản đã áp nhầm khớp từng byte với tệp đưa vào kho sau đó, nên database không lệch. Bài thử tự động: 0 bị, vì đã đặt cả hai biến từ trước.
- **Cách chặn:** lệnh `pnpm db:deploy-to <đường_kết_nối>` đặt CẢ HAI biến, từ chối database không phải `makeup_test…` (trừ khi ghi cờ rõ), rồi đọc lại trạng thái trên chính database đích. Đã thử: vế BẮT (thiếu đường kết nối → từ chối; trỏ `makeup_dev` → từ chối) và vế GIỮ (database thử mới → áp 11/11, kiểm lại khớp).
- **Bài học cho studio khác:** một công cụ có hai chỗ khai "đi đâu" thì lệnh chỉ đổi một chỗ sẽ lặng lẽ đi về chỗ kia. Sau mỗi lệnh ghi dữ liệu, đếm lại trên đúng nơi mình nhắm, đừng tin câu "thành công".

### 17. Bài thử đỏ giả vì thợ khác "dựng lại bộ đọc database" giữa chừng
- **Triệu chứng:** thợ chấm chạy bài thử trên một bản cũ, được 315/316. Bài đỏ báo thiếu một cột mà bản đó không hề có.
- **Gốc bệnh:** mọi thợ dùng chung một thư mục thư viện. Đúng lúc thợ chấm đang chạy, một thợ khác chạy lệnh dựng lại bộ đọc database (`prisma generate`) theo bản vẽ dữ liệu MỚI. Bản cũ đang chấm liền đọc phải bộ của bản mới.
- **Số đo:** 1/316 đỏ giả. Thợ chấm tách một bộ đọc database riêng cho bản chấm thì được 316/316.
- **Cách chặn:** thợ chấm và người đo trên một bản cũ phải dùng bộ đọc database riêng của bản đó, không dùng chung với thư mục đang làm. Gặp bài đỏ lạ thì kiểm giờ sửa của bộ dùng chung trước khi kết luận.
- **Bài học cho studio khác:** khi nhiều người làm song song trên một máy, "đỏ" chưa chắc là lỗi của mã đang chấm. Phải chắc là đang đo đúng bản, rồi mới tin con số.

### 18. Bài thử "đếm bên thua" không đếm bên thua bị sập
- **Triệu chứng:** bài đua lịch (10 lượt hai người cùng dời lịch vào một giờ) khi chạy chung thỉnh thoảng ra 8/10 hoặc 9/10. Hai thợ đều cho là bài thử "phụ thuộc thời điểm".
- **Gốc bệnh:** thật ra là lỗi máy chủ. Hai lệnh đôi khi chờ nhau (khoá chết) ở bước database kiểm trùng lịch. Database huỷ một bên sau khoảng 1 giây, và bên đó nhận lỗi 500 "Máy chủ gặp lỗi". Bài thử chỉ tìm mã 409, nên đếm lượt đó là "không có bên thua" chứ không đếm là lỗi.
- **Số đo (thợ chấm độc lập):** 4 lần khoá chết trong nhật ký database của một thợ, khớp đúng giờ các lần 8/10. Trên máy thợ chấm, 21 lần chạy có 1 lần 9/10, nhật ký có đúng 1 lần khoá chết. Dựng khoá chết chắc chắn: 2/2 lần ra 500. Dữ liệu vẫn đúng: 0 lượt hai bên cùng thắng.
- **Cách chặn:** bài thử đua phải đếm riêng từng kết cục (thắng / thua đúng 409 / lỗi khác), và số "lỗi khác" phải bằng 0. Máy chủ: khoá theo thợ theo thứ tự cố định trước khi kiểm, cộng lưới an toàn đổi khoá chết thành 409 "thử lại".
- **Bài học cho studio khác:** kết quả "lúc được lúc không" không được ghi là "bài thử chập chờn" cho tới khi đào ra gốc. Lần này nó che một lỗi thật mà khách sẽ gặp đúng vào ngày đông lịch nhất.

### 19. Giao chấm một bản chụp việc dở — bản đó không build được
- **Triệu chứng:** thợ chấm nhận bản 193d6aa để chấm 3 màn đã xong. Bản đó không qua được bước build: thiếu 3 tệp (`staff/PayRatesScreen.tsx`, `staff/staff.css`, `platform/platform.css`) của các thợ khác đang làm dở.
- **Gốc bệnh:** điều phối lưu "bản chụp hiện trạng" gom cả việc dở của mọi thợ, để máy đám mây có bị thu hồi thì không mất việc. Rồi điều phối lấy luôn mã của bản chụp đó giao đi chấm, không chạy build trước. Bản chụp thì giữ được việc, nhưng không có gì bảo đảm nó chạy được.
- **Số đo:** typecheck đỏ 1 lỗi, build đỏ, 2 bộ bài thử không nạp được. Thợ chấm phải thay 3 tệp thiếu bằng mô-đun rỗng mới chấm tiếp được.
- **Cách chặn:** chỉ giao chấm một mã đã qua `pnpm build` và typecheck ngay trên đúng mã đó, chạy trong một bản tách riêng. Ghi lệnh và kết quả vào đầu bài giao chấm. Bản chụp việc dở ghi rõ "CHƯA nghiệm thu" và không bao giờ đem đi chấm.
- **Bài học cho studio khác:** "lưu cho khỏi mất" và "bản để nghiệm thu" là hai việc khác nhau. Lẫn hai thứ đó thì người chấm mất nửa buổi vào lỗi không phải của người được chấm.

### 20. "Sửa giá" xoá luôn 9 thông số khác của gói thuê bao
- **Triệu chứng (thợ chấm độc lập tìm ra):** quản trị viên chỉ sửa giá một gói thuê bao. Sau đó cả 9 thông số khác của gói bị đặt lại: mọi giới hạn thành "không giới hạn", gói đã ngừng bán được bật bán lại. Một studio đang bị chặn ở mức 2 nhân sự liền thêm được người.
- **Gốc bệnh:** thân yêu cầu "sửa một phần" được dựng bằng cách lấy khuôn của "tạo mới" rồi cho mọi trường thành tuỳ chọn. Khuôn tạo mới có giá trị mặc định, và công cụ kiểm dữ liệu (zod 4) vẫn điền mặc định vào những trường người dùng không gửi. Bài thử của thợ không thấy, vì nó gửi kèm đủ trường rồi chỉ kiểm hai trường vừa gửi.
- **Số đo:** 9/9 trường bị đổi trước khi sửa, 0/9 sau khi sửa. Soát cả máy chủ: có 37 chỗ dùng giá trị mặc định, chỉ đúng 1 chỗ mắc bệnh.
- **Cách chặn:** hai lớp chặn. (1) Lúc khởi động, máy chủ duyệt mọi đường sửa một phần; trường nào bị tự điền khi vắng mặt thì máy chủ từ chối khởi động. (2) Cửa gác "sửa một phần" chạy với mọi đường sửa: gửi đủ trường, rồi gửi đúng một trường, so mọi giá trị còn lại phải y nguyên. Đã thử: cài lại lỗi thì cả hai lớp đều bắt.
- **Bài học cho studio khác:** với mọi nút "sửa", phải thử kiểu "chỉ đổi một ô rồi xem các ô khác còn nguyên không". Lỗi loại này không làm sập gì, chỉ âm thầm đổi cài đặt — nên chỉ phép thử đúng kiểu đó mới thấy.

### 21. Tắt máy chủ của mình bằng lệnh "tắt theo tên" — có thể tắt luôn máy chủ của người khác
- **Triệu chứng:** một thợ tự khai đã tắt máy chủ thử bằng lệnh tắt mọi tiến trình khớp tên (`pkill -f "tsx src/server.ts"`). Lúc đó nhiều thợ khác cũng đang chạy máy chủ thử cùng tên.
- **Gốc bệnh:** đầu bài đã ghi "tắt theo PID, không dùng pkill -f", nhưng chỉ là chữ, không có gì chặn. Ngay ngày đầu, điều phối cũng từng tự tắt mất cửa sổ lệnh của chính mình theo đúng kiểu này.
- **Số đo:** chưa đo được thợ nào bị tắt nhầm. Thợ tự khai và tự kiểm: lúc kiểm, không còn máy chủ nào ở cổng 4000/4120.
- **Cách chặn:** mỗi thợ ghi PID ngay lúc bật máy chủ, và chỉ tắt đúng PID đó. Đầu bài mọi gói việc giữ câu "KHÔNG pkill -f". Đề xuất cho bộ luật: thêm cửa gác chặn lệnh `pkill -f` trong môi trường nhiều thợ.
- **Bài học cho studio khác:** khi nhiều người dùng chung một máy, lệnh "tắt mọi thứ tên X" là lệnh phá việc người khác, dù người gõ chỉ định dọn đồ của mình.

### 22. Thêm chốt mới vào database: dữ liệu cũ vi phạm làm hỏng lần nâng cấp
- **Triệu chứng:** thợ thêm chốt "mọi số tiền ≤ 100 tỷ đ" cho 22 cột tiền. Thử trên một database có dữ liệu cũ thì cả lần nâng cấp bị huỷ, vì 2 phiếu thu thử cũ ghi 5 triệu tỷ đ.
- **Gốc bệnh:** chốt mới kiểm cả dữ liệu đã có. Dữ liệu cũ do chính các bài thử trước tạo ra để thử lỗi "số khổng lồ". Đúng loại dữ liệu bẩn mà chốt mới sinh ra để cấm.
- **Số đo:** 19 database thử của các thợ còn chứa dòng vượt trần (từ 1 đến 53 dòng mỗi database). Database phát triển có 0 dòng. Nâng cấp trên các database đó sẽ dừng và đánh dấu "nâng cấp lỗi".
- **Cách chặn:** (1) Trước khi thêm chốt kiểm dữ liệu, đếm số dòng vi phạm trên đúng database sẽ nâng cấp. Database thật thì đếm và dọn có biên bản trước, không bao giờ để lần nâng cấp tự phát hiện. (2) Bài thử cố ý tạo dữ liệu bẩn phải tự dọn, hoặc chạy trên database riêng dùng một lần. (3) Nâng cấp đặt trong một giao dịch: lỗi thì huỷ sạch, không áp dở (đã kiểm: 0 chốt còn sót).
- **Bài học cho studio khác:** mỗi luật mới cho dữ liệu đều phải hỏi "dữ liệu đang có có vi phạm không, và ai dọn". Hỏi xong rồi mới bật luật.

---

## Phần CỦA RIÊNG DỰ ÁN NÀY
- Lỗi 1: `apps/api/package.json` (script build cũ) → sửa sang `apps/api/tsup.config.ts`, commit `7572db8`.
- Lỗi 3: `apps/api/src/scripts/sync-system-roles.ts`, commit `0c55493`.
- Lỗi 4: `apps/api/test/global-setup.ts`.
- Lỗi 5: migration `20261018151403_bang_gia_lich`.
- Lỗi 14: migration `20261018190000_tep_thu_tien_nen_tang`; database thử `makeup_test_contract` đã dọn 2 bậc chồng của tổ chức thử, áp `travel_tiers_no_overlap`, sửa checksum; `prisma migrate status` báo khớp 9/9.
- Lỗi 15: `apps/api/test/gate.ts` phép 9 `platform`, đột biến 9 trong `apps/api/test/gate-mutants.test.ts`.
- Lỗi 16: `apps/api/prisma/schema.prisma` (datasource directUrl), `apps/api/.env`, lệnh chặn `apps/api/scripts/deploy-to.mjs` (`pnpm db:deploy-to`).

## 23. Điều phối `git add -A` khi một thợ khác đang làm dở

- **Triệu chứng:** commit 745f454 ghi tên "W-HDKH" nhưng lẫn 5 tệp máy chủ dở dang của thợ V (migration phụ phí, schema.prisma, catalog/services.ts, profile/public.ts, bài thử) và vài tệp web thợ V/W-HDKH chưa chốt.
- **Gốc:** điều phối dùng `git add -A` sau khi thợ W-HDKH báo xong, quên rằng thợ V vẫn đang ghi tệp.
- **Hậu quả:** commit đó không nhất thiết build được ở phần máy chủ; không được dùng làm commit chấm.
- **Cách chặn:** khi còn thợ đang chạy, chỉ `git add` đúng danh sách tệp trong báo cáo của thợ đã xong (như commit 2f362c9 của thợ U). `git add -A` chỉ dùng cho bản chụp ghi rõ "WIP — CHƯA nghiệm thu".
- **Tái phạm 19/10/2026:** commit b0223d0 đặt tên "Sổ ý muốn: anh chê 11 mẫu chào mừng…" nhưng lẫn 4 tệp bài thử PWA dở của thợ E-W1 (InstallGuide.test.tsx, platform.test.ts, registerSW.test.ts, sw.test.ts) và ss-album.test.ts. Gốc giống hệt: gom cả cây khi thợ còn chạy. Chặn thêm: trước mỗi commit tên không có chữ "WIP", chạy `git diff --cached --stat` và đối từng tệp với danh sách định commit; lệch là bỏ ra.

## 24. Chốt CHECK của Postgres cho qua NULL — câu SQL điều phối đã duyệt có bẫy

- **Triệu chứng:** chốt `("duration_minutes" IS NULL AND "kind"='SURCHARGE') OR ("duration_minutes" > 0 AND "duration_minutes" <= 1440)` để lọt gói chính (MAIN) và dịch vụ phụ (ADDON) có thời lượng NULL. Bài thử ghi thẳng database của thợ V bắt được: 2/5 lần ghi sai lọt.
- **Gốc:** với MAIN mà NULL, vế 1 ra FALSE, vế 2 ra NULL (so sánh với NULL), nên FALSE OR NULL = NULL. Postgres coi CHECK ra NULL là **đạt**, không phải trượt.
- **Cách chặn:** mọi chốt CHECK có cột cho phép NULL phải viết rõ `IS NOT NULL` ở vế còn lại. Bài thử của chốt bắt buộc có ca ghi thẳng NULL vào database cho từng loại không được phép NULL, không chỉ thử qua API.
- **Bài giảng cho nghề:** người duyệt (điều phối) đã duyệt sai; thợ làm bài thử ghi thẳng database mới bắt được. Đây là lý do bài thử phải đi vòng qua lớp kiểm của máy chủ.

## 25. Làm đúng hướng dẫn mà máy chủ không chạy: lệnh chạy thử không đọc tệp `.env`

- **Triệu chứng:** người làm theo hướng dẫn tạo tệp `apps/api/.env` (địa chỉ database, khoá bí mật), rồi gõ các lệnh có sẵn tên: `pnpm --filter @makeup/api dev` (bật máy chủ), `platform:seed-plans` (nạp gói cước), `platform:grant-admin` (cấp quyền quản trị), `db:sync-roles`. Máy chủ dừng ngay với `Cấu hình môi trường không hợp lệ — NODE_ENV … DATABASE_URL … JWT_ACCESS_SECRET …`; ba lệnh kia báo `Thiếu DATABASE_URL`. Riêng lệnh áp migration (`db:deploy`) lại chạy được, nên người làm càng khó hiểu. Thợ Z gặp khi viết `docs/CHAY-THU-TREN-MAY.md` và phải né bằng một lệnh dài hơn.
- **Gốc:** dự án không dùng thư viện đọc `.env`. Chỉ các lệnh của Prisma (công cụ database) tự đọc tệp đó. Có thêm một bẫy làm lỗi "lúc được lúc không": thư viện Prisma tự nạp `.env` **chỉ khi tệp đã có mặt lúc nó được dựng** (`prisma generate`, chạy tự động lúc `pnpm install`). Chủ studio cài thư viện ở bước 2, tạo `.env` ở bước 4 → lệnh không đọc được. Máy thợ nào đã có `.env` từ trước khi cài → lệnh chạy được → không ai thấy lỗi, tài liệu cũ ghi lệnh sai mà không ai bắt.
- **Số đo (18/10/2026, bản lấy mã mới, database riêng `makeup_thu_z2`):** trước khi sửa, cả 4/4 lệnh hỏng như trên. Dựng lại Prisma khi chưa có `.env` → lệnh cũ hỏng; dựng khi đã có `.env` → lệnh cũ chạy: đúng hai trạng thái, đúng thứ tự cài. Sau khi sửa, 4/4 lệnh trần chạy được ở cả hai trạng thái: máy chủ trả `/health` `{"ok":true}`, nạp 6 gói, cấp/thu/cấp lại quyền quản trị, đồng bộ 1 tổ chức. Đã xem 27 lệnh trong 4 tệp `package.json` của kho, sửa 4.
- **Cách chặn:**
  1. Bốn lệnh chạy thử nay tự đọc `apps/api/.env` nếu có (cờ `--env-file-if-exists=.env` của Node 22, `apps/api/package.json`). **Biến đã đặt sẵn trong cửa sổ lệnh thắng dòng trong `.env`** (đo thật, kể cả biến đặt rỗng). Không có `.env` và không có biến → vẫn báo lỗi cấu hình rõ như cũ, kèm dòng `.env not found. Continuing without it.` — không chạy im lặng với cấu hình rỗng.
  2. Lệnh của bản thật (`start`, `…:prod`) **không** đổi: trên Railway biến lấy từ trang cài đặt của dịch vụ, không có tệp `.env`.
  3. Bài thử `apps/api/test/lenh-doc-env.test.ts`: lệnh `tsx` nào trong `package.json` thiếu cờ thì đỏ; lệnh bản thật lỡ có cờ thì đỏ; kiểm luôn hai hành vi trên của Node. Đã thử phá: bỏ cờ ở `platform:seed-plans` → đỏ; thêm cờ vào `start` → đỏ (2/2).
  4. Hướng dẫn (`docs/CHAY-THU-TREN-MAY.md`, `docs/BAN-GIAO-PHIEN.md` bước 4, `docs/DEPLOYMENT.md`) nay dùng đúng lệnh trần, đã chạy lại từng lệnh trước khi ghi.
- **Bài học cho studio khác:** hướng dẫn phải được chạy thử trên một máy **mới tinh** theo đúng thứ tự trong hướng dẫn. Máy của người viết thường "có sẵn đồ từ trước" nên lỗi thứ tự không lộ ra. Và khi phải né một lỗi trong hướng dẫn, ghi lại chỗ né rồi giao sửa tận gốc — đừng để cách né thành hướng dẫn chính thức.

## 26. Điều phối gửi việc nhầm thợ vì nhầm mã thợ

- **Triệu chứng:** hai tin giao thêm việc mẫu thiết kế ("mẫu nào cũng có ảnh, khung tròn, một mẫu viên thuốc"; sửa tương phản shd-01) gửi tới thợ K4 (tệp chạy Windows) thay vì thợ K3 (mẫu thiết kế). K4 đọc thấy ngoài phạm vi tệp của mình nên **không làm** và báo lại trong phiếu vướng — đúng luật. Việc của K3 bị trễ tới khi K4 nộp báo cáo.
- **Gốc:** điều phối gọi thợ bằng mã máy dài, chép mã từ danh sách 8 thợ giao cùng lúc mà không đối chiếu tên.
- **Cách chặn:** trước mỗi tin giao thêm việc, đối chiếu mã thợ với mô tả lúc giao (tên thợ + phạm vi tệp); câu đầu tin nhắn ghi rõ "Gửi thợ K3 (mẫu thiết kế)" để thợ nhận nhầm thấy ngay.
- **Bài giảng cho nghề:** thợ từ chối việc ngoài phạm vi tệp chính là cửa gác chặn được lỗi điều phối. Luật "mỗi thợ chỉ sửa tệp của mình" không chỉ tránh giẫm chân mà còn bắt được giao nhầm.

## 27. Ảnh chụp cả trang làm chủ studio tưởng giao diện lỗi

- **Triệu chứng:** anh Chiến thấy ảnh màn Lịch ở khổ điện thoại có thanh điều hướng dưới nằm giữa danh sách ca, đè lên thẻ ca, và báo "Lỗi giao diện này".
- **Gốc:** ảnh do thợ chụp bằng `fullPage: true`. Thanh dưới là `position: fixed; bottom: 0` (`apps/web/src/layout/layout.css:308-316`); khi chụp cả trang, Chromium vẽ phần tử cố định tại đáy khung nhìn đầu tiên (y = 844 − 64 = 780) rồi vẽ tiếp phần trang còn lại bên dưới, nên thanh lơ lửng giữa ảnh.
- **Số đo (thợ đào, app thật):** 390×844 và 375×667, ba chế độ Lịch, cuộn tới cuối: thanh dưới luôn sát đáy khung, chồng lấn 0 px, nội dung cuối cách thanh 22–25 px. Hợp đồng, Khách, Bảng giá cũng 0 px.
- **Cách chặn:** ảnh nộp cho anh Chiến hoặc dùng làm bằng chứng giao diện **phải là ảnh khung màn hình** (`fullPage: false`), cuộn từng đoạn nếu cần. Ảnh cả trang chỉ dùng nội bộ và phải ghi chữ "ảnh cả trang — thanh cố định hiện sai chỗ" ngay trên tên tệp.
- **Phát hiện kèm (lỗi thật, nhỏ):** mã chưa có `env(safe-area-inset-bottom)` cho thanh dưới; iPhone có thanh Home thì thanh dưới sát mép vuốt. Đã giao sửa.

## 28. Hết hạn mức tài khoản giữa chừng — 5 thợ dừng cùng lúc (19/10/2026)

- **Triệu chứng:** 5 thợ đang chạy (D-W1, D-W2, D-W4, D-M4, E1) cùng báo lỗi "Your organization has disabled Claude subscription access" (HTTP 403) và dừng giữa bước; máy khởi động lại.
- **Gốc:** hết hạn mức sử dụng trong ngày của tài khoản, không phải lỗi mã.
- **Hậu quả:** phần đang làm dở nằm trên đĩa, chưa ai kiểm; database thử và tiến trình chạy dở có thể mất; một migration đang viết ở thư mục nháp có thể mất.
- **Cách chặn / cách làm lại:** (1) chụp ngay một commit tên "WIP … CHƯA nghiệm thu" để không mất phần dở; (2) bật lại PostgreSQL; (3) đánh thức lại ĐÚNG thợ cũ (giữ trí nhớ việc đang làm), báo rõ nó dừng ở bước nào và phần nào đã/ chưa có trên đĩa — không giao thợ mới làm lại từ đầu; (4) migration luôn viết ở nháp rồi mv một lần (sổ lỗi M1), nên dừng giữa chừng không để lại thư mục nửa vời.
