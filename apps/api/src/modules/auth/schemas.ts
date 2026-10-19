import { z } from 'zod';

// Luật email / mật khẩu dùng chung cho đăng ký, đăng nhập và đặt lại mật khẩu.
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Email không hợp lệ' }).max(254));
// bcrypt chỉ dùng 72 byte đầu: mật khẩu dài hơn sẽ bị cắt âm thầm, nên chặn ngay ở cửa (biên bản mốc 2, L9).
export const Password = z
  .string()
  .min(10, 'Mật khẩu tối thiểu 10 ký tự')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Mật khẩu tối đa 72 byte (khoảng 24–72 ký tự tuỳ dấu)');
