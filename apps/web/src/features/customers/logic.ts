import { PORTAL_MAX_DEVICES, PORTAL_MAX_FAILED, PORTAL_WEB_PATH, type Permission, type PortalAdminView, type PortalDeviceStatus, type PortalLinkStatus } from '@makeup/shared';
import type { CertificateView } from '../../api/certificates';
import type { ContractDetail, Customer, CustomerCreateInput, CustomerUpdateInput, GroupedContractLine, WorkStatus } from '../../api/types';
import { viDate } from '../certificates/logic';

// Logic thuần của màn Khách hàng (C2 mục 2) — tách khỏi giao diện để thử bằng vitest.

export interface CustomerPerms {
  read: boolean;
  write: boolean;
  contractsRead: boolean;
  contractsWrite: boolean;
  // Thẻ Cổng học viên (bản vẽ E 5.2): xem, thu hồi, chặn máy.
  portalManage: boolean;
  // Tạo đường dẫn: portal.manage + người gửi tự xem được khách, hợp đồng, phiếu thu (ký duyệt E câu 3).
  portalSend: boolean;
  // Thẻ Giấy chứng nhận (bản vẽ F 6.6): xem danh sách giấy của học viên và In lại. Chỉ ACADEMY — card tự kiểm loại tổ chức.
  certRead: boolean;
  // Tải ảnh lên (ô ảnh ở form sửa khách): files.write.
  files: boolean;
}

// Quyền đòi thêm ngoài portal.manage khi tạo đường dẫn (máy chủ center.ts PORTAL_LINK_EXTRA_PERMISSIONS).
export const PORTAL_SEND_EXTRA_PERMISSIONS: readonly Permission[] = ['customers.read', 'contracts.read', 'payments.read'];

export function customerPerms(has: (p: Permission) => boolean): CustomerPerms {
  return {
    read: has('customers.read'),
    write: has('customers.write'),
    contractsRead: has('contracts.read'),
    contractsWrite: has('contracts.write'),
    portalManage: has('portal.manage'),
    portalSend: has('portal.manage') && PORTAL_SEND_EXTRA_PERMISSIONS.every((p) => has(p)),
    certRead: has('certificates.read'),
    files: has('files.write'),
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

// avatarFileId: mã tệp ảnh đang chọn trong form (null = đã bỏ ảnh, undefined = form không có ô ảnh → không gửi).
export function customerPatch(c: Customer, d: CustomerDraft, avatarFileId?: string | null): CustomerUpdateInput {
  const out: CustomerUpdateInput = {};
  if (d.fullName.trim() !== c.fullName) out.fullName = d.fullName.trim();
  // Số điện thoại: so theo chữ số (máy chủ chuẩn hoá), tránh gửi lại chỉ vì khác dấu cách.
  if (nul(d.phone) === null ? c.phone !== null : d.phone.replace(/\D/g, '') !== (c.phone ?? '')) out.phone = nul(d.phone);
  if (nul(d.email) !== c.email) out.email = nul(d.email);
  if (nul(d.note) !== c.note) out.note = nul(d.note);
  if (avatarFileId !== undefined && avatarFileId !== c.avatarFileId) out.avatarFileId = avatarFileId;
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

// ---------------- Thẻ Cổng học viên (bản vẽ E mục 5.2) ----------------
export type PortalTone = 'draft' | 'ok' | 'danger' | 'warn' | 'neutral';

// Nhãn trạng thái đường dẫn mới nhất; không có đường dẫn → "Chưa gửi".
export function portalLinkTag(link: PortalAdminView['link']): { label: string; tone: PortalTone } {
  if (!link) return { label: 'Chưa gửi', tone: 'neutral' };
  const by: Record<PortalLinkStatus, { label: string; tone: PortalTone }> = {
    ACTIVE: { label: 'Đang mở', tone: 'ok' },
    FULL: { label: `Đủ ${PORTAL_MAX_DEVICES} máy`, tone: 'warn' },
    REVOKED: { label: 'Đã thu hồi', tone: 'danger' },
    EXPIRED: { label: 'Hết hạn', tone: 'warn' },
    LOCKED: { label: 'Bị khoá', tone: 'danger' },
  };
  return by[link.status];
}

// Đường dẫn còn dùng để nhận máy mới (hoặc máy đã mở còn dùng) → nút "Tạo đường dẫn mới" phải hỏi lại.
export function portalLinkLive(link: PortalAdminView['link']): boolean {
  return link !== null && (link.status === 'ACTIVE' || link.status === 'FULL');
}

// Dòng giải thích dưới nhãn trạng thái ("Đã thu hồi" … "Bị khoá vì nhập sai 5 lần").
export function portalLinkNote(link: PortalAdminView['link'], timeZone: string, now: number): string {
  if (!link) return 'Chưa gửi đường dẫn cho học viên này.';
  const made = `Tạo ${formatPortalWhen(link.createdAt, timeZone, now)} bởi ${link.createdByName}`;
  switch (link.status) {
    case 'LOCKED':
      return `Bị khoá vì nhập sai ${PORTAL_MAX_FAILED} lần. ${made}.`;
    case 'REVOKED':
      return `Đã thu hồi. ${made}.`;
    case 'EXPIRED':
      return `Hết hạn ${formatPortalWhen(link.expiresAt, timeZone, now)}, chưa ai mở. ${made}.`;
    default:
      return link.firstOpenedAt !== null
        ? `${made} · mở lần đầu ${formatPortalWhen(link.firstOpenedAt, timeZone, now)}.`
        : `${made}, hết hạn ${formatPortalWhen(link.expiresAt, timeZone, now)} nếu chưa mở.`;
  }
}

export const PORTAL_DEVICE_STATUS_LABEL: Record<PortalDeviceStatus, string> = {
  ACTIVE: 'Đang dùng',
  BLOCKED: 'Đã chặn',
  SIGNED_OUT: 'Đã thoát',
  LINK_REVOKED: 'Đã thu hồi',
};

export const PORTAL_DEVICE_STATUS_TONE: Record<PortalDeviceStatus, PortalTone> = {
  ACTIVE: 'ok',
  BLOCKED: 'danger',
  SIGNED_OUT: 'draft',
  LINK_REVOKED: 'draft',
};

// "03/11 20:14" theo múi giờ tổ chức; cùng ngày với `now` → "hôm nay 07:52".
export function formatPortalWhen(iso: string, timeZone: string, now: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = formatTimeIn(iso, timeZone);
  if (dayKeyIn(iso, timeZone) === dayKeyIn(new Date(now).toISOString(), timeZone)) return `hôm nay ${time}`;
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit' }).format(d);
  return `${day} ${time}`;
}

// Đường dẫn gửi học viên: <origin>/hv#k=<chìa>. Chìa nằm sau # nên trình duyệt không gửi lên máy chủ.
export function portalUrl(origin: string, key: string): string {
  if (!key) throw new Error('portalUrl: thiếu chìa');
  return `${origin}${PORTAL_WEB_PATH}#k=${key}`;
}

// Lý do điền sẵn (nhân viên sửa được) và câu hậu quả của các hộp xác nhận. Mỗi câu một dòng, tối đa 90 ký tự.
export const PORTAL_REASON_BLOCK = 'Học viên báo mất máy';
export const PORTAL_REASON_REVOKE = 'Đường dẫn bị lộ';
export const PORTAL_CONSEQUENCE = {
  create: 'Đường dẫn cũ thôi nhận máy mới. Máy đã mở vẫn dùng được.',
  block: 'Máy này bị thoát ngay, không xem được trang học viên nữa.',
  revoke: 'Đường dẫn hết hiệu lực, mọi máy bị thoát ngay. Muốn vào lại phải tạo đường dẫn mới.',
} as const;
export const PORTAL_CONSEQUENCE_MAX = 90;

// ---------------- Thẻ Giấy chứng nhận (bản vẽ F mục 6.6) ----------------
export type CertTone = 'ok' | 'neutral';

// Nhãn trạng thái một giấy: "Hiệu lực" · "Hiệu lực · bản cấp lại dd/mm/yyyy" · "Đã thu hồi". Bản cấp lại thiếu ngày → ném lỗi (không bịa ngày).
export function certificateStatus(c: Pick<CertificateView, 'status' | 'reissueNo' | 'reissuedOn'>): { label: string; tone: CertTone } {
  if (c.status === 'REVOKED') return { label: 'Đã thu hồi', tone: 'neutral' };
  if (c.reissueNo > 0) {
    if (c.reissuedOn === null) throw new Error('Bản cấp lại thiếu ngày cấp lại (reissuedOn)');
    return { label: `Hiệu lực · bản cấp lại ${viDate(c.reissuedOn)}`, tone: 'ok' };
  }
  return { label: 'Hiệu lực', tone: 'ok' };
}

// Dòng chính "{khoá} · {lớp}" và dòng phụ "{số} · cấp dd/mm/yyyy".
export function certificateTitle(c: Pick<CertificateView, 'courseName' | 'className'>): string {
  return `${c.courseName} · ${c.className}`;
}

export function certificateSub(c: Pick<CertificateView, 'code' | 'issuedOn'>): string {
  return `${c.code} · cấp ${viDate(c.issuedOn)}`;
}

// Tên tệp / tiêu đề PDF khi In lại một giấy (cùng kiểu sổ: Giay-chung-nhan-CC-2026-0007).
export function certificatePrintNames(c: Pick<CertificateView, 'code'>): { baseName: string; pdfTitle: string } {
  return { baseName: `Giay-chung-nhan-${c.code}`, pdfTitle: `Giấy chứng nhận ${c.code}` };
}

// Liên kết "Xem trong sổ": sổ lọc theo học viên bằng ?khach=<customerId>.
export function certificateRegisterPath(slug: string, customerId: string): string {
  if (!slug || !customerId) throw new Error('certificateRegisterPath: thiếu slug hoặc mã học viên');
  return `/${slug}/giay-chung-nhan?khach=${encodeURIComponent(customerId)}`;
}
