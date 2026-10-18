// Thư mục ảnh do e2e chụp. Mặc định: e2e/anh-chay/ (đã có trong .gitignore) — chạy e2e KHÔNG ghi đè ảnh tài liệu
// đang được git theo dõi ở e2e/anh/ (nghiệm thu web 1, N9).
// Muốn cập nhật ảnh tài liệu có chủ ý: E2E_ANH_DIR=e2e/anh pnpm e2e, rồi xem lại từng ảnh trước khi commit.
export const SHOTS = process.env.E2E_ANH_DIR ?? 'e2e/anh-chay';
