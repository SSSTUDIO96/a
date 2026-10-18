// Nhãn, màu và cách định dạng dùng chung của trang quản trị nền tảng (bản vẽ C2 mục 5.4).
import type { OrgKind } from '../../api/auth';
import type { EffectiveStatus, SubscriptionStatus } from '../../api/platform';
import type { TagTone } from '../../ui';

export const SUBSCRIPTION_LABELS: Record<EffectiveStatus, string> = {
  NONE: 'Chưa có thuê bao',
  TRIAL: 'Dùng thử',
  ACTIVE: 'Đang dùng',
  PAST_DUE: 'Chậm thanh toán',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã huỷ',
};

export const SUBSCRIPTION_TONES: Record<EffectiveStatus, TagTone> = {
  NONE: 'draft',
  TRIAL: 'accent',
  ACTIVE: 'ok',
  PAST_DUE: 'warn',
  EXPIRED: 'danger',
  CANCELLED: 'draft',
};

// Trạng thái được chọn khi thêm dòng thuê bao (hộp Đổi gói / gia hạn).
export const NEW_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE'];

export const KIND_LABELS: Record<OrgKind, string> = {
  INDIVIDUAL: 'Thợ cá nhân',
  TEAM: 'Đội / studio',
  ACADEMY: 'Trung tâm đào tạo',
};

// Mã gói mặc định áp cho tổ chức chưa có thuê bao (apps/api/src/lib/quota.ts DEFAULT_PLAN_CODE): luôn chọn được
// khi đổi gói, kể cả đã ngừng bán.
export const DEFAULT_PLAN_CODE = 'trial';

// Ngày giờ hiện theo giờ Việt Nam (tổ chức mặc định Asia/Ho_Chi_Minh; trang quản trị xem nhiều tổ chức nên dùng một múi).
export const VN_TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 3600_000;

const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, day: '2-digit', month: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, hour: '2-digit', minute: '2-digit', hour12: false });

/** "2026-11-12T03:00:00Z" → "12/11/2026" (giờ Việt Nam). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d);
}

/** → "12/11" */
export function fmtShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : shortFmt.format(d);
}

/** → "18/10/2026 15:40" */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${dateFmt.format(d)} ${timeFmt.format(d)}`;
}

/** Ngày (YYYY-MM-DD) theo giờ Việt Nam của một thời điểm. */
export function vnDay(at: Date | string): string {
  const t = typeof at === 'string' ? new Date(at).getTime() : at.getTime();
  return new Date(t + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** "2026-11-12" → 00:00 giờ Việt Nam của ngày đó, dạng ISO có múi "+07:00". */
export function vnMidnightIso(day: string): string {
  return `${day}T00:00:00+07:00`;
}

/**
 * Cộng tháng theo lịch — CHÉP ĐÚNG luật máy chủ (apps/api/src/modules/platform/routes.ts addMonths, tính theo UTC;
 * ngày 31 + 1 tháng → ngày cuối tháng sau) để dòng "Hết hạn" xem trước khớp với điều máy chủ sẽ ghi.
 */
export function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
}

const intFmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

export const UNLIMITED = 'Không giới hạn';

/** Giới hạn gói: null = "Không giới hạn". */
export function fmtLimit(v: number | null): string {
  return v === null ? UNLIMITED : intFmt.format(v);
}

/** Dung lượng tính bằng MB → "412 MB" / "5 GB" (≥ 1024 MB đổi sang GB). null = "Không giới hạn". */
export function fmtMb(mb: number | null): string {
  if (mb === null) return UNLIMITED;
  if (mb >= 1024) return `${decFmt.format(mb / 1024)} GB`;
  return `${decFmt.format(mb)} MB`;
}

export function fmtInt(n: number): string {
  return intFmt.format(n);
}
