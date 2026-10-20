// Chọn và gộp dữ liệu hiển thị từ PortalMe. KHÔNG tính tiền: Tổng / Đã đóng / Còn lại do máy chủ trả (summarizePayments),
// chỗ duy nhất có phép trừ là "còn thiếu" của MỘT đợt (số nguyên đồng: amount − paidAmount), nơi allocateToInstallments không trả riêng.
import type { PortalMe } from '@makeup/shared';
import { dayNumber, ymdInZone } from './time';

type Enrollment = PortalMe['enrollments'][number];
type Contract = PortalMe['contracts'][number];
type Installment = Contract['installments'][number];
type SessionRow = Enrollment['sessions'][number];

export interface NextSession {
  enrollment: Enrollment;
  session: SessionRow;
  /** Số thứ tự buổi trong lớp (không đếm buổi huỷ). */
  ordinal: number;
}

/** Buổi SCHEDULED gần nhất chưa kết thúc, trong mọi lớp. Không có buổi nào (lớp chưa sinh buổi học) → null: KHÔNG tự tính buổi dự kiến. */
export function nextSession(enrollments: Enrollment[], nowMs: number): NextSession | null {
  let best: NextSession | null = null;
  for (const e of enrollments) {
    if (e.classStatus === 'CANCELLED') continue;
    const live = e.sessions.filter((s) => s.status !== 'CANCELLED');
    for (const s of e.sessions) {
      if (s.status !== 'SCHEDULED' || Date.parse(s.endsAt) <= nowMs) continue;
      if (best === null || Date.parse(s.startsAt) < Date.parse(best.session.startsAt)) {
        const ordinal = live.filter((x) => Date.parse(x.startsAt) <= Date.parse(s.startsAt)).length;
        best = { enrollment: e, session: s, ordinal };
      }
    }
  }
  return best;
}

export type SessionBadge = 'cancelled' | 'past' | 'today' | null;

export function sessionBadge(s: SessionRow, nowMs: number, tz: string): SessionBadge {
  if (s.status === 'CANCELLED') return 'cancelled';
  if (s.status === 'DONE' || Date.parse(s.endsAt) <= nowMs) return 'past';
  return s.date === ymdInZone(new Date(nowMs), tz) ? 'today' : null;
}

/** Số ngày từ ngày `dueIso` (theo múi giờ trung tâm) tới hôm nay; âm = chưa tới hạn. */
export function daysPastDue(dueIso: string, nowMs: number, tz: string): number {
  return dayNumber(ymdInZone(new Date(nowMs), tz)) - dayNumber(ymdInZone(dueIso, tz));
}

/** Còn thiếu của một đợt (số nguyên đồng). */
export function installmentShortfall(i: Installment): number {
  return i.amount - i.paidAmount;
}

/** Tên khoá của hợp đồng (theo mã hợp đồng ở các ghi danh); không có ghi danh (đã huỷ ghi danh) → null. */
export function courseNameOfContract(me: PortalMe, code: string): string | null {
  return me.enrollments.find((e) => e.contractCode === code)?.courseName ?? null;
}

export function classStatusLabel(s: Enrollment['classStatus']): string {
  return s === 'OPEN' ? 'Đang học' : s === 'CLOSED' ? 'Đã kết thúc' : 'Lớp đã huỷ';
}

/** Chữ cái đầu của tên (cho ảnh đại diện chưa có ảnh). */
export function initialOf(name: string): string {
  const ch = [...name.trim()][0];
  return ch ? ch.toLocaleUpperCase('vi-VN') : '?';
}

/** Số điện thoại → chỉ chữ số (cho liên kết zalo.me). */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

export function mapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
