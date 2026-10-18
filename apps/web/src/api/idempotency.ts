// Khoá chống gửi trùng cho POST tạo dữ liệu (máy chủ nhận 8–128 ký tự chữ, số, - hoặc _).
// Sinh MỘT lần cho mỗi lần bấm nút; client.ts giữ nguyên khoá khi tự gửi lại sau refresh.
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
