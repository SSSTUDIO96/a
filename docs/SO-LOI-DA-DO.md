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

---

## Phần CỦA RIÊNG DỰ ÁN NÀY
- Lỗi 1: `apps/api/package.json` (script build cũ) → sửa sang `apps/api/tsup.config.ts`, commit `7572db8`.
- Lỗi 3: `apps/api/src/scripts/sync-system-roles.ts`, commit `0c55493`.
- Lỗi 4: `apps/api/test/global-setup.ts`.
- Lỗi 5: migration `20261018151403_bang_gia_lich`.
