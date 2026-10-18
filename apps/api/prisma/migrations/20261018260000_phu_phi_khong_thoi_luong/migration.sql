-- Phụ phí (services.kind = 'SURCHARGE': ca sớm, ngoài giờ, ngày lễ…) không có thời lượng: cho phép bỏ trống (NULL).
-- NULL nghĩa là "không áp dụng", KHÔNG phải 0 phút. Dịch vụ chính (MAIN) và dịch vụ phụ (ADDON) vẫn bắt buộc 1..1440 phút.
-- Máy chủ chặn cùng luật ở catalog/services.ts; chốt này chặn mọi đường còn lại (ghi thẳng database, mã viết sau quên kiểm).
--
-- Dữ liệu cũ: phụ phí tạo trước migration này đang mang số phút giả (web gửi 1 phút vì máy chủ cũ bắt buộc ≥ 1).
-- Migration KHÔNG đổi các dòng đó (vẫn hợp chốt mới vì 1..1440). Dọn hay không là việc của người vận hành.
--
-- Cột "kind" kiểu enum "ServiceKind" ('MAIN', 'ADDON', 'SURCHARGE') thêm ở 20261018152236_hop_dong_nhan_vat;
-- chốt cũ "services_duration_positive" ở 20261018151403_bang_gia_lich.

ALTER TABLE "services" ALTER COLUMN "duration_minutes" DROP NOT NULL;

ALTER TABLE "services" DROP CONSTRAINT "services_duration_positive";

-- Vế thứ hai PHẢI có "duration_minutes" IS NOT NULL: CHECK của Postgres chỉ chặn khi biểu thức ra FALSE, còn NULL thì
-- cho qua. Viết thiếu (... OR ("duration_minutes" > 0 AND "duration_minutes" <= 1440)) thì MAIN/ADDON có NULL cho ra
-- FALSE OR NULL = NULL → lọt chốt (bài thử test/phu-phi-khong-thoi-luong.test.ts bắt được trường hợp này).
ALTER TABLE "services" ADD CONSTRAINT "services_duration_positive" CHECK (
  ("duration_minutes" IS NULL AND "kind" = 'SURCHARGE')
  OR ("duration_minutes" IS NOT NULL AND "duration_minutes" > 0 AND "duration_minutes" <= 1440)
);
