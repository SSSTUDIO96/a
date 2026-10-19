// Tên ngắn của thợ (biên bản nghiệm thu lại M3) — MỘT hàm cho mọi chỗ rút tên ngắn trên web.
//
// Máy chủ trả `displayName` = tên hiển thị studio đặt cho thợ, chưa đặt thì là họ tên (staff/common.ts presentStaff,
// schedule/service.ts presentAppointment), kèm `fullName` = họ tên tài khoản ở những chỗ có gửi.
// Luật:
// - Studio đã đặt tên hiển thị (khác họ tên) → dùng NGUYÊN tên hiển thị: "Linh Trần", "Hà Makeup", "Giang".
// - Chưa đặt (tên hiển thị trùng họ tên) → rút gọn họ tên thành tiếng cuối: "Nguyễn Thu Hà" → "Hà".
// - Không biết họ tên (chỗ máy chủ không gửi fullName) → không đoán: dùng nguyên tên hiển thị.
export interface StaffNameSource {
  displayName: string;
  // undefined / null = máy chủ không gửi họ tên ở chỗ này.
  fullName?: string | null;
}

const squash = (s: string) => s.trim().replace(/\s+/g, ' ');

export function staffShortName({ displayName, fullName }: StaffNameSource): string {
  const shown = squash(displayName);
  const full = fullName == null ? '' : squash(fullName);
  if (full === '') return shown;
  if (shown !== '' && shown !== full) return shown;
  const words = full.split(' ');
  return words[words.length - 1] ?? full;
}
