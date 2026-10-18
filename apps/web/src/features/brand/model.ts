// Bản nháp hồ sơ thương hiệu và các phép đổi thuần (không gọi API) — bản vẽ C2 mục 4.2, 4.4, 4.5.
// PUT /profile GHI TOÀN BỘ: luôn gửi đủ 21 trường (kể cả 3 *FileId), không gửi isPublished/publishedAt.
import { ApiError, validationIssues } from '../../api/errors';
import type { BrandProfile, BrandProfileInput, WorkingShift } from '../../api/types';

export type ImageSlot = 'logo' | 'avatar' | 'cover';
export const IMAGE_SLOTS: readonly ImageSlot[] = ['logo', 'avatar', 'cover'];

export interface DraftImage {
  fileId: string;
  // URL ký có hạn (10 phút); null = tệp chưa sẵn sàng / đã xoá theo máy chủ.
  url: string | null;
  expiresAt: string | null;
}

export interface ShiftDraft {
  open: string | null;
  close: string | null;
}

export interface DayDraft {
  open: boolean;
  // Giữ cả khi tắt "mở cửa" để bật lại không mất giờ đã gõ; chỉ ngày mở mới được gửi.
  shifts: ShiftDraft[];
}

export const TEXT_FIELDS = [
  'brandName',
  'tagline',
  'bio',
  'experience',
  'serviceArea',
  'address',
  'phone',
  'email',
  'zalo',
  'facebook',
  'instagram',
  'tiktok',
  'website',
  'bookingPolicy',
  'cancellationPolicy',
  'depositPolicy',
] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

export type Draft = Record<TextField, string> & {
  styles: string[];
  images: Record<ImageSlot, DraftImage | null>;
  // 7 phần tử: thứ Hai (weekday 1) … Chủ nhật (7).
  days: DayDraft[];
};

export const MAX_SHIFTS_PER_DAY = 2;
export const MAX_STYLES = 20;
export const MAX_STYLE_LENGTH = 50;

// Giới hạn độ dài theo máy chủ (profile/schemas.ts) — đặt maxLength cho ô, máy chủ vẫn là chốt.
export const MAX_LENGTH: Record<TextField, number> = {
  brandName: 120,
  tagline: 200,
  bio: 5000,
  experience: 2000,
  serviceArea: 500,
  address: 500,
  phone: 30,
  email: 254,
  zalo: 500,
  facebook: 500,
  instagram: 500,
  tiktok: 500,
  website: 500,
  bookingPolicy: 5000,
  cancellationPolicy: 5000,
  depositPolicy: 5000,
};

function emptyDays(): DayDraft[] {
  return Array.from({ length: 7 }, () => ({ open: false, shifts: [] }));
}

export function emptyDraft(): Draft {
  const text = Object.fromEntries(TEXT_FIELDS.map((f) => [f, ''])) as Record<TextField, string>;
  return { ...text, styles: [], images: { logo: null, avatar: null, cover: null }, days: emptyDays() };
}

export function daysFromShifts(shifts: readonly WorkingShift[]): DayDraft[] {
  const days = emptyDays();
  for (const s of [...shifts].sort((a, b) => a.weekday - b.weekday || a.open.localeCompare(b.open))) {
    const d = days[s.weekday - 1];
    if (!d) continue;
    d.open = true;
    d.shifts.push({ open: s.open, close: s.close });
  }
  return days;
}

export function draftFromProfile(p: BrandProfile): Draft {
  const text = Object.fromEntries(TEXT_FIELDS.map((f) => [f, p[f] ?? ''])) as Record<TextField, string>;
  const img = (fileId: string | null, signed: BrandProfile['logo']): DraftImage | null =>
    fileId ? { fileId, url: signed?.url ?? null, expiresAt: signed?.expiresAt ?? null } : null;
  return {
    ...text,
    styles: [...p.styles],
    images: { logo: img(p.logoFileId, p.logo), avatar: img(p.avatarFileId, p.avatar), cover: img(p.coverFileId, p.cover) },
    days: daysFromShifts(p.workingHours),
  };
}

const nullable = (v: string): string | null => {
  const t = v.trim();
  return t === '' ? null : t;
};

// Ca đã gửi → (thứ, vị trí ca trong ngày): để đặt lỗi "workingHours.3.close" của máy chủ dưới đúng hàng.
export interface SentShift {
  weekday: number;
  shiftIndex: number;
}

export function shiftsOf(days: readonly DayDraft[]): { shifts: WorkingShift[]; sent: SentShift[] } {
  const shifts: WorkingShift[] = [];
  const sent: SentShift[] = [];
  days.forEach((d, i) => {
    if (!d.open) return;
    d.shifts.forEach((s, k) => {
      if (s.open === null || s.close === null) return;
      shifts.push({ weekday: i + 1, open: s.open, close: s.close });
      sent.push({ weekday: i + 1, shiftIndex: k });
    });
  });
  return { shifts, sent };
}

// Thân PUT: đủ 21 trường.
export function toInput(d: Draft): { input: Required<BrandProfileInput>; sent: SentShift[] } {
  const { shifts, sent } = shiftsOf(d.days);
  const input: Required<BrandProfileInput> = {
    brandName: d.brandName.trim(),
    tagline: nullable(d.tagline),
    bio: nullable(d.bio),
    experience: nullable(d.experience),
    styles: d.styles,
    serviceArea: nullable(d.serviceArea),
    address: nullable(d.address),
    phone: nullable(d.phone),
    email: nullable(d.email),
    zalo: nullable(d.zalo),
    facebook: nullable(d.facebook),
    instagram: nullable(d.instagram),
    tiktok: nullable(d.tiktok),
    website: nullable(d.website),
    logoFileId: d.images.logo?.fileId ?? null,
    avatarFileId: d.images.avatar?.fileId ?? null,
    coverFileId: d.images.cover?.fileId ?? null,
    workingHours: shifts,
    bookingPolicy: nullable(d.bookingPolicy),
    cancellationPolicy: nullable(d.cancellationPolicy),
    depositPolicy: nullable(d.depositPolicy),
  };
  return { input, sent };
}

// Có thay đổi chưa lưu: so thân PUT (URL ảnh hay ngày tắt còn giữ giờ không tính).
export function sameInput(a: Draft, b: Draft): boolean {
  return JSON.stringify(toInput(a).input) === JSON.stringify(toInput(b).input);
}

// Khoá lỗi: tên trường (brandName, instagram, logoFileId, styles…), "hours.N" (N = 1…7), "workingHours" (chung), "_form".
export type FormErrors = Record<string, string>;

export function hoursKey(weekday: number): string {
  return `hours.${weekday}`;
}

// Kiểm trước khi gửi những gì máy chủ không nhận được ở dạng thiếu: tên trống, ca chưa đủ giờ.
// Luật chồng giờ, đóng sau mở, liên kết https, số điện thoại: để máy chủ kiểm (một nguồn luật).
export function validateDraft(d: Draft): FormErrors {
  const errors: FormErrors = {};
  if (d.brandName.trim() === '') errors.brandName = 'Tên thương hiệu không được để trống';
  d.days.forEach((day, i) => {
    if (!day.open) return;
    if (day.shifts.some((s) => s.open === null || s.close === null)) errors[hoursKey(i + 1)] = 'Nhập đủ giờ mở và giờ đóng của ca';
  });
  return errors;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase('vi') + s.slice(1) : s;
}

// Lỗi 400 của PUT /profile → lời dưới đúng ô.
export function mapSaveError(err: unknown, sent: readonly SentShift[]): FormErrors {
  const out: FormErrors = {};
  const put = (k: string, m: string) => {
    if (out[k] === undefined) out[k] = m;
  };
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED') return out;
  for (const issue of validationIssues(err)) {
    const [field, second] = issue.path.split('.');
    if (!field) continue;
    if (field === 'workingHours') {
      const at = second !== undefined && /^\d+$/.test(second) ? sent[Number(second)] : undefined;
      if (at) {
        put(hoursKey(at.weekday), issue.message.replace(/^Thứ \d:\s*/, '').replace(/^./, (c) => c.toLocaleUpperCase('vi')));
        continue;
      }
      const m = /^Thứ ([1-7]):\s*(.*)$/.exec(issue.message);
      if (m && m[1] && m[2] !== undefined) put(hoursKey(Number(m[1])), capitalize(m[2]));
      else put('workingHours', issue.message);
      continue;
    }
    put(field, issue.message);
  }
  // Lỗi ảnh (profile/images.ts): details = { field: 'logoFileId' | 'avatarFileId' | 'coverFileId' }.
  const f = (err.details as { field?: unknown } | undefined)?.field;
  if (typeof f === 'string') put(f, err.message);
  if (Object.keys(out).length === 0) put('_form', err.message);
  return out;
}

// Ô ảnh nào đã quá hạn URL (hoặc sắp quá trong 30 giây).
export function expiredSlots(images: Draft['images'], now: number = Date.now()): ImageSlot[] {
  return IMAGE_SLOTS.filter((s) => {
    const im = images[s];
    if (!im || !im.expiresAt) return false;
    return Date.parse(im.expiresAt) - 30_000 <= now;
  });
}

// Thêm một phong cách: trả lời lỗi (chữ) hoặc danh sách mới.
export function addStyle(styles: readonly string[], raw: string): { ok: true; styles: string[] } | { ok: false; error: string } {
  const v = raw.trim().replace(/\s+/g, ' ');
  if (v === '') return { ok: false, error: 'Nhập tên phong cách' };
  if (v.length > MAX_STYLE_LENGTH) return { ok: false, error: `Tối đa ${MAX_STYLE_LENGTH} ký tự` };
  if (styles.length >= MAX_STYLES) return { ok: false, error: `Tối đa ${MAX_STYLES} phong cách` };
  if (styles.some((s) => s.toLocaleLowerCase('vi') === v.toLocaleLowerCase('vi'))) return { ok: false, error: 'Đã có phong cách này' };
  return { ok: true, styles: [...styles, v] };
}
