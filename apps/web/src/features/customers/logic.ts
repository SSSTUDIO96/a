import type { Permission } from '@makeup/shared';
import type { ContractDetail, Customer, CustomerCreateInput, CustomerUpdateInput, GroupedContractLine, WorkStatus } from '../../api/types';

// Logic thuần của màn Khách hàng (C2 mục 2) — tách khỏi giao diện để thử bằng vitest.

export interface CustomerPerms {
  read: boolean;
  write: boolean;
  contractsRead: boolean;
  contractsWrite: boolean;
}

export function customerPerms(has: (p: Permission) => boolean): CustomerPerms {
  return {
    read: has('customers.read'),
    write: has('customers.write'),
    contractsRead: has('contracts.read'),
    contractsWrite: has('contracts.write'),
  };
}

// Chữ viết tắt như máy chủ làm cho thợ (staff/common.ts initialsOf): chữ đầu của từ đầu và từ cuối
// ("Nguyễn Thị Mai" → "NM"), để ảnh chữ của khách và của thợ theo cùng một luật.
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return `${[...first][0] ?? ''}${last ? ([...last][0] ?? '') : ''}`.toLocaleUpperCase('vi-VN');
}

// ---------------- Số điện thoại ----------------
// Máy chủ lưu 0xxxxxxxxx (10 số) → hiện "0912 345 678". Số lạ để nguyên.
export function formatPhone(phone: string): string {
  return /^0\d{9}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : phone;
}

// Phần số của chuỗi tìm, đổi +84/84… về 0 như máy chủ (schedule/customers.ts phoneFragment). < 3 chữ số → null.
export function phoneQueryDigits(q: string): string | null {
  let digits = q.replace(/\D/g, '');
  if (q.trim().startsWith('+84') || (digits.startsWith('84') && digits.length >= 11)) digits = `0${digits.slice(2)}`;
  return digits.length >= 3 ? digits : null;
}

// Chuỗi tìm "là số" (để điền sẵn ô Số điện thoại khi thêm khách): chỉ chữ số, dấu cách, + . - ( ).
export function looksLikePhone(q: string): boolean {
  const t = q.trim();
  return t !== '' && /^[\d\s+().-]+$/.test(t) && /\d/.test(t);
}

export interface PhonePart {
  text: string;
  match: boolean;
}

// Số điện thoại đã định dạng, tách phần khớp với chuỗi tìm (in đậm). Không khớp → một phần thường.
export function highlightPhone(phone: string, q: string): PhonePart[] {
  const shown = formatPhone(phone);
  const digits = phoneQueryDigits(q);
  if (!digits) return [{ text: shown, match: false }];
  const start = phone.indexOf(digits);
  if (start < 0) return [{ text: shown, match: false }];
  const end = start + digits.length;
  // Đổi vị trí theo chữ số sang vị trí trong chuỗi đã chèn dấu cách.
  let seen = 0;
  let a = -1;
  let b = shown.length;
  for (let i = 0; i < shown.length; i += 1) {
    if (!/\d/.test(shown[i] ?? '')) continue;
    if (seen === start && a < 0) a = i;
    seen += 1;
    if (seen === end) {
      b = i + 1;
      break;
    }
  }
  if (a < 0) return [{ text: shown, match: false }];
  const parts: PhonePart[] = [];
  if (a > 0) parts.push({ text: shown.slice(0, a), match: false });
  parts.push({ text: shown.slice(a, b), match: true });
  if (b < shown.length) parts.push({ text: shown.slice(b), match: false });
  return parts;
}

// Hộp "Khách mới" mở từ "Thêm khách "…"" khi tìm không thấy: số → ô Số điện thoại; chữ → ô Họ tên.
export function prefillFromQuery(q: string): CustomerCreateInput {
  const t = q.trim();
  if (!t) return { fullName: '' };
  return looksLikePhone(t) ? { fullName: '', phone: t } : { fullName: t };
}

// ---------------- Sửa / thêm: chỉ gửi trường đã đổi, xoá trắng = null ----------------
export interface CustomerDraft {
  fullName: string;
  phone: string;
  email: string;
  note: string;
}

export function draftOf(c: Customer | CustomerCreateInput): CustomerDraft {
  return { fullName: c.fullName, phone: c.phone ?? '', email: c.email ?? '', note: c.note ?? '' };
}

const nul = (s: string) => (s.trim() === '' ? null : s.trim());

export function customerPatch(c: Customer, d: CustomerDraft): CustomerUpdateInput {
  const out: CustomerUpdateInput = {};
  if (d.fullName.trim() !== c.fullName) out.fullName = d.fullName.trim();
  // Số điện thoại: so theo chữ số (máy chủ chuẩn hoá), tránh gửi lại chỉ vì khác dấu cách.
  if (nul(d.phone) === null ? c.phone !== null : d.phone.replace(/\D/g, '') !== (c.phone ?? '')) out.phone = nul(d.phone);
  if (nul(d.email) !== c.email) out.email = nul(d.email);
  if (nul(d.note) !== c.note) out.note = nul(d.note);
  return out;
}

export function createInput(d: CustomerDraft): CustomerCreateInput {
  const out: CustomerCreateInput = { fullName: d.fullName.trim() };
  if (nul(d.phone) !== null) out.phone = nul(d.phone);
  if (nul(d.email) !== null) out.email = nul(d.email);
  if (nul(d.note) !== null) out.note = nul(d.note);
  return out;
}

// ---------------- Hợp đồng, lịch ----------------
function allLines(lines: readonly GroupedContractLine[]) {
  return lines.flatMap((l) => [l, ...l.addons, ...(l.travel ? [l.travel] : [])]);
}

// "{code} · {tên dòng gói đầu tiên}" — dòng gói chưa huỷ, không có thì dòng đầu.
export function firstLineName(d: ContractDetail): string | null {
  const live = d.lines.filter((l) => !l.voidedAt);
  return (live.find((l) => l.kind === 'PACKAGE') ?? live[0] ?? d.lines[0])?.name ?? null;
}

export interface AppointmentItem {
  id: string;
  code: string;
  startsAt: string;
  status: WorkStatus;
  lineName: string | null;
  contractId: string;
  contractCode: string;
}

export function appointmentsOf(details: readonly ContractDetail[]): AppointmentItem[] {
  const out: AppointmentItem[] = [];
  for (const d of details) {
    const names = new Map(allLines(d.lines).map((l) => [l.id, l.name]));
    for (const a of d.appointments) {
      out.push({
        id: a.id,
        code: a.code,
        startsAt: a.startsAt,
        status: a.status,
        lineName: a.contractLineId ? (names.get(a.contractLineId) ?? null) : null,
        contractId: d.id,
        contractCode: d.code,
      });
    }
  }
  return out;
}

// Sắp tới trước (gần nhất trên cùng), rồi đã qua (mới nhất trên cùng) — C2 2.2.
export function sortAppointments(items: readonly AppointmentItem[], now: number): AppointmentItem[] {
  const t = (a: AppointmentItem) => Date.parse(a.startsAt);
  const upcoming = items.filter((a) => t(a) >= now).sort((a, b) => t(a) - t(b));
  const past = items.filter((a) => t(a) < now).sort((a, b) => t(b) - t(a));
  return [...upcoming, ...past];
}

// ---------------- Ngày giờ theo múi giờ tổ chức ----------------
export function formatDateIn(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function formatTimeIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

// "YYYY-MM-DD" theo múi giờ tổ chức — tham số ?ngay= của màn Lịch.
export function dayKeyIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
