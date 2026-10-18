-- Ảnh đại diện thợ thành cột khoá ngoại thật (thay cho chuỗi tạm "file:<id>" trong avatar_url).

-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN     "avatar_file_id" UUID;

-- Chép dữ liệu: "file:<id>" → avatar_file_id, xoá chuỗi tạm ở avatar_url.
-- Chỉ chép tham chiếu đúng dạng UUID và trỏ vào tệp CÙNG tổ chức (mã cũ đã kiểm như vậy trước khi ghi);
-- dòng lạ (nếu có) giữ nguyên để không làm hỏng cả migration lúc triển khai — mã mới không bao giờ trả
-- giá trị avatar_url không phải http(s), nên dòng lạ chỉ hiện chữ viết tắt như trước.
UPDATE "staff_profiles" AS sp
SET "avatar_file_id" = substring(sp."avatar_url" from 6)::uuid,
    "avatar_url" = NULL
WHERE sp."avatar_url" LIKE 'file:%'
  AND substring(sp."avatar_url" from 6) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM "stored_files" f
    -- So bằng chữ (không ép ::uuid ở đây): Postgres không hứa thứ tự xét các vế AND, ép kiểu sớm sẽ ném lỗi với dòng lạ.
    WHERE f."id"::text = lower(substring(sp."avatar_url" from 6))
      AND f."organization_id" = sp."organization_id"
  );

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_avatar_file_id_organization_id_fkey" FOREIGN KEY ("avatar_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
