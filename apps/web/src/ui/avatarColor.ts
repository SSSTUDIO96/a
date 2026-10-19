// Phần thuần (không React, không CSS) của ảnh đại diện: màu theo khoá và chữ tắt.
// Tách khỏi Avatar.tsx để mã thuần (ui/staffName.ts, schedule/model.ts) và bài thử node (tsconfig.node.json, không bật jsx)
// dùng được mà không kéo theo tệp .tsx. Avatar.tsx nhập lại và xuất lại hai hàm này nên mọi chỗ import cũ vẫn chạy.
/** Băm chuỗi (kiểu 31·h + mã ký tự, số nguyên 32 bit không dấu), lấy dư 6 → chỉ số màu --av-0…--av-5. */
export function avatarColorIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return h % 6;
}

/**
 * Chữ viết tắt khi API không gửi — CHÉP ĐÚNG luật máy chủ (apps/api/src/modules/staff/common.ts:5-11, initialsOf):
 * chữ đầu của tiếng ĐẦU và tiếng CUỐI ("Trần Khánh Linh" → "TL"); một tiếng → một chữ ("Linh" → "L"); rỗng → "?".
 * Một người chỉ có một kiểu chữ tắt trên mọi màn, dù chữ đến từ máy chủ (initials) hay tính ở web (biên bản cuối L2).
 * Lấy theo điểm mã ([...w][0]) và viết hoa theo 'vi-VN' như máy chủ. features/customers/logic.ts có bản cùng luật.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return `${[...first][0] ?? ''}${last ? ([...last][0] ?? '') : ''}`.toLocaleUpperCase('vi-VN');
}
