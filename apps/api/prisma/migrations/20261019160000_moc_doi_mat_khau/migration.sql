-- Mốc đổi mật khẩu (thợ K6). Thẻ truy cập cấp trước lần đổi/đặt lại mật khẩu phải chết ngay, không chờ hết 15 phút.
-- NULL = chưa đổi lần nào: dữ liệu cũ để NULL, KHÔNG điền ngược (điền now() sẽ đá văng mọi phiên đang dùng lúc triển khai).
-- Cột cho phép NULL, không DEFAULT → PostgreSQL chỉ sửa danh mục, không viết lại bảng, khoá rất ngắn.
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMPTZ(3);
