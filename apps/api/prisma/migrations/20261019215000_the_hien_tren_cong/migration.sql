-- Thẻ thiết kế hiện trên cổng học viên (ký duyệt E câu 2; nhật ký quyết định thay 19/10 tối; gói E3).
-- Trung tâm ẩn được TỪNG thẻ Chào mừng / Feedback khỏi trang của học viên. Mặc định HIỆN: mọi thẻ đã có nhận true,
-- GET /portal/me chỉ trả thẻ portal_visible = true. Không đụng cột / ràng buộc nào khác.
ALTER TABLE "design_cards" ADD COLUMN "portal_visible" BOOLEAN NOT NULL DEFAULT true;
