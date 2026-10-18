import { ApiError } from './api';

// Khớp luật của máy chủ (apps/api/src/modules/auth/routes.ts, orgs/routes.ts) để báo lỗi sớm, máy chủ vẫn kiểm lại.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,46})[a-z0-9]$/;
// Đường dẫn trùng tên trang của web sẽ che mất trang đó.
export const RESERVED_SLUGS = new Set(['dang-nhap', 'dang-ky', 'tao-to-chuc', 'api']);

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function checkEmail(v: string): string | undefined {
  const t = v.trim();
  if (!t) return 'Vui lòng nhập email';
  if (t.length > 254 || !EMAIL_RE.test(t)) return 'Email không hợp lệ';
  return undefined;
}

export function checkNewPassword(v: string): string | undefined {
  if (v.length < 10) return 'Mật khẩu tối thiểu 10 ký tự';
  if (new TextEncoder().encode(v).length > 72) return 'Mật khẩu quá dài (tối đa 72 byte, khoảng 24–72 ký tự tuỳ dấu)';
  return undefined;
}

export function checkRequired(v: string, label: string, max: number): string | undefined {
  const t = v.trim();
  if (!t) return `Vui lòng nhập ${label}`;
  if (t.length > max) return `${label[0]?.toUpperCase() ?? ''}${label.slice(1)} tối đa ${max} ký tự`;
  return undefined;
}

export function checkSlug(v: string): string | undefined {
  const t = v.trim().toLowerCase();
  if (!SLUG_RE.test(t)) return 'Đường dẫn chỉ gồm chữ thường không dấu, số, gạch ngang; 3–48 ký tự, không bắt đầu/kết thúc bằng gạch ngang';
  if (RESERVED_SLUGS.has(t)) return 'Đường dẫn này trùng tên một trang của hệ thống, vui lòng chọn tên khác';
  return undefined;
}

// "Studio Hoa Đào" → "studio-hoa-dao"
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

export function hasErrors<K extends string>(errors: FieldErrors<K>): boolean {
  return Object.values(errors).some(Boolean);
}

// Lỗi kiểm dữ liệu của máy chủ: details = { formErrors: string[], fieldErrors: { tên_ô: string[] } }.
export function serverFieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED') return out;
  const d = err.details;
  if (typeof d !== 'object' || d === null || !('fieldErrors' in d)) return out;
  const fe = (d as { fieldErrors: unknown }).fieldErrors;
  if (typeof fe !== 'object' || fe === null) return out;
  for (const [k, v] of Object.entries(fe)) {
    if (Array.isArray(v) && typeof v[0] === 'string') out[k] = v[0];
  }
  return out;
}
