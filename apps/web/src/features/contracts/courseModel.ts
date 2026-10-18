// Logic thuần của Hợp đồng khoá học (bản vẽ C3 mục 2.3): nháp, dựng thân gửi máy chủ, kiểm thiếu, tình trạng lớp, lỗi 409
// lớp vừa đầy, mẫu điều khoản / nội quy. KHÔNG tính tiền: mọi số tiền lấy từ máy chủ (quote hoặc hợp đồng đã lưu).
import { formatVnd } from '@makeup/shared';
import type { ClassListItem } from '../../api/courses';
import { ApiError } from '../../api/errors';
import type {
  ContractBody,
  ContractDetail,
  ContractKind,
  ContractLineInput,
  ContractQuote,
  ContractText,
  ContractTextKind,
  ContractUpdateInput,
  GroupedContractLine,
  Vnd,
} from '../../api/types';
import { newLineKey, type CustomDraft, type CustomerDraft } from './model';

export interface CourseLineDraft {
  key: string;
  kind: 'COURSE';
  courseId: string;
  courseName: string;
  // null = chưa chọn lớp.
  classId: string | null;
}

export type CourseDraftLine = CourseLineDraft | CustomDraft;

export interface CourseContractDraft {
  customer: CustomerDraft | null;
  ownerMembershipId: string | null;
  discount: Vnd;
  // null = để máy chủ lấy cọc gợi ý (cọc mặc định của khoá).
  depositRequired: Vnd | null;
  notes: string;
  // null = chưa chọn: lúc xác nhận máy chủ lấy mẫu mặc định.
  termsTemplateId: string | null;
  rulesTemplateId: string | null;
  lines: CourseDraftLine[];
}

export const EMPTY_COURSE_DRAFT: CourseContractDraft = {
  customer: null,
  ownerMembershipId: null,
  discount: 0,
  depositRequired: null,
  notes: '',
  termsTemplateId: null,
  rulesTemplateId: null,
  lines: [],
};

// ---------------------------------------------------------------------------------------------
// Loại hợp đồng trên đường dẫn: /hop-dong/moi?kind=COURSE (màn Khoá & lớp dẫn sang).
export function kindFromParam(raw: string | null): ContractKind | null {
  return raw === 'COURSE' || raw === 'SERVICE' ? raw : null;
}

export const KIND_LABEL: Record<ContractKind, string> = { COURSE: 'Khoá học', SERVICE: 'Dịch vụ makeup' };

// ---------------------------------------------------------------------------------------------
// Lớp chọn được hay không — theo trạng thái máy chủ trả (status, seatState của packages/shared).
export interface ClassChoice {
  disabled: boolean;
  // Lý do tắt (tooltip / chữ cạnh lớp); null khi chọn được.
  reason: string | null;
}

export function classChoice(c: Pick<ClassListItem, 'status' | 'seatState' | 'enrolledCount' | 'capacity'>): ClassChoice {
  if (c.status === 'CANCELLED') return { disabled: true, reason: 'Lớp đã huỷ' };
  if (c.status === 'CLOSED') return { disabled: true, reason: 'Lớp đã ngừng nhận ghi danh' };
  if (c.seatState === 'FULL') return { disabled: true, reason: `Lớp đã đủ ${c.enrolledCount}/${c.capacity} học viên` };
  return { disabled: false, reason: null };
}

// Dòng phụ của khoá ở cột trái: "2/3 lớp còn chỗ" (nhiều lớp) hoặc "31/10 · còn 3 chỗ" (một lớp).
export function courseSeatsText(classes: readonly ClassListItem[]): string {
  const live = classes.filter((c) => c.status !== 'CANCELLED');
  if (live.length === 0) return 'Chưa mở lớp';
  const open = live.filter((c) => !classChoice(c).disabled);
  if (live.length === 1) {
    const c = live[0] as ClassListItem;
    const d = /^\d{4}-(\d{2})-(\d{2})$/.exec(c.startDate);
    const day = d ? `${d[2]}/${d[1]}` : c.startDate;
    return open.length === 1 ? `${day} · còn ${c.seatsLeft} chỗ` : `${day} · ${classChoice(c).reason ?? ''}`;
  }
  return `${open.length}/${live.length} lớp còn chỗ`;
}

// ---------------------------------------------------------------------------------------------
// Kiểm thiếu trước khi gửi (máy chủ kiểm lại). Khoá lỗi theo đường dẫn máy chủ: lines.<i>.<trường>.
export function validateCourseDraft(d: CourseContractDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.customer) e.customerId = 'Chọn học viên.';
  else if (d.customer.kind === 'new' && d.customer.fullName.trim() === '') e['newCustomer.fullName'] = 'Nhập họ tên học viên.';
  if (!d.lines.some((l) => l.kind === 'COURSE')) e.lines = 'Chọn ít nhất một khoá học.';
  d.lines.forEach((l, i) => {
    if (l.kind === 'COURSE') {
      if (!l.classId) e[`lines.${i}.courseClassId`] = 'Chọn lớp.';
    } else {
      if (l.name.trim() === '') e[`lines.${i}.name`] = 'Nhập tên khoản.';
      if (l.unitPrice === null) e[`lines.${i}.unitPrice`] = 'Nhập số tiền.';
    }
  });
  return e;
}

export function courseLineInput(l: CourseDraftLine): ContractLineInput {
  if (l.kind === 'COURSE') return { kind: 'COURSE', courseClassId: l.classId ?? '' };
  const note = l.note.trim();
  return { kind: 'CUSTOM', name: l.name.trim(), unitPrice: l.unitPrice ?? 0, quantity: l.quantity, ...(note ? { note } : {}) };
}

export function buildCourseBody(d: CourseContractDraft): ContractBody | null {
  if (!d.customer || d.lines.length === 0) return null;
  const fields = {
    kind: 'COURSE' as const,
    ...(d.ownerMembershipId ? { ownerMembershipId: d.ownerMembershipId } : {}),
    ...(d.notes.trim() ? { notes: d.notes } : {}),
    ...(d.termsTemplateId ? { termsTemplateId: d.termsTemplateId } : {}),
    ...(d.rulesTemplateId ? { rulesTemplateId: d.rulesTemplateId } : {}),
    discount: d.discount,
    ...(d.depositRequired !== null ? { depositRequired: d.depositRequired } : {}),
    lines: d.lines.map(courseLineInput),
  };
  if (d.customer.kind === 'existing') return { customerId: d.customer.id, ...fields };
  const phone = d.customer.phone.trim();
  return { newCustomer: { fullName: d.customer.fullName.trim(), ...(phone ? { phone } : {}) }, ...fields };
}

// Sửa nháp: gửi lại toàn bộ dòng + tiền + mẫu. Người phụ trách chỉ đặt được lúc tạo (máy chủ chưa nhận sửa).
export type CoursePatchFields = Omit<ContractUpdateInput, 'expectedUpdatedAt'>;

export function coursePatchBody(d: CourseContractDraft): CoursePatchFields {
  return {
    lines: d.lines.map(courseLineInput),
    discount: d.discount,
    ...(d.depositRequired !== null ? { depositRequired: d.depositRequired } : {}),
    notes: d.notes.trim() ? d.notes : null,
    termsTemplateId: d.termsTemplateId,
    rulesTemplateId: d.rulesTemplateId,
  };
}

// Hợp đồng đã lưu → nháp. Khoá của dòng tra từ danh sách lớp (dòng chỉ mang courseClassId).
export function courseDraftFromDetail(d: ContractDetail, classes: readonly ClassListItem[]): CourseContractDraft {
  const lines: CourseDraftLine[] = [];
  for (const l of d.lines) {
    if (l.voidedAt) continue;
    if (l.kind === 'COURSE') {
      const cls = classes.find((c) => c.id === l.courseClassId);
      lines.push({
        key: newLineKey(),
        kind: 'COURSE',
        courseId: cls?.course.id ?? '',
        courseName: cls?.course.name ?? l.name,
        classId: l.courseClassId,
      });
    } else if (l.kind === 'CUSTOM') {
      lines.push({ key: newLineKey(), kind: 'CUSTOM', name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, note: l.note ?? '' });
    }
  }
  return {
    customer: { kind: 'existing', id: d.customer.id, fullName: d.customer.fullName, phone: d.customer.phone, email: d.customer.email },
    ownerMembershipId: d.ownerMembershipId,
    discount: d.discount,
    depositRequired: d.depositRequired,
    notes: d.notes ?? '',
    termsTemplateId: d.termsTemplateId,
    rulesTemplateId: d.rulesTemplateId,
    lines,
  };
}

// Quote chỉ dùng khi khớp đúng các dòng đang nhập (cùng số dòng, cùng loại, cùng lớp).
export function matchCourseQuote(d: CourseContractDraft, q: ContractQuote | null): (GroupedContractLine<null> | null)[] {
  const none = d.lines.map(() => null);
  if (!q || q.lines.length !== d.lines.length) return none;
  const ok = d.lines.every((l, i) => {
    const v = q.lines[i];
    if (!v || v.kind !== l.kind) return false;
    return l.kind === 'COURSE' ? v.courseClassId === l.classId : true;
  });
  return ok ? q.lines : none;
}

// ---------------------------------------------------------------------------------------------
// 409 lớp vừa đầy / ngừng nhận (contracts/enroll.ts seatConflict): details có classId, enrolledCount, capacity, reason.
export interface SeatConflict {
  classId: string | null;
  reason: string;
  message: string;
}

const SEAT_REASONS = new Set(['CLASS_FULL', 'CLASS_CLOSED', 'CLASS_CANCELLED']);

export function seatConflictOf(err: unknown): SeatConflict | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const d = err.details as { reason?: unknown; classId?: unknown } | undefined;
  if (!d || typeof d.reason !== 'string' || !SEAT_REASONS.has(d.reason)) return null;
  // Lời máy chủ: "Lớp K12 đã đủ 12/12 học viên" → thêm hướng xử lý.
  const base = err.message.replace(/ — chọn lớp khác$/, '');
  return { classId: typeof d.classId === 'string' ? d.classId : null, reason: d.reason, message: `${base} — chọn lớp khác` };
}

// Quote báo lớp đang chọn đã đầy / ngừng nhận (báo sớm; chốt thật ở bước xác nhận).
export function quoteSeatWarnings(q: ContractQuote | null): string[] {
  if (!q) return [];
  return q.classes.flatMap((c) => {
    if (c.status === 'CANCELLED') return [`Lớp ${c.name} đã huỷ — chọn lớp khác`];
    if (c.status === 'CLOSED') return [`Lớp ${c.name} đã ngừng nhận ghi danh — chọn lớp khác`];
    if (c.seatState === 'FULL') return [`Lớp ${c.name} đã đủ ${c.enrolledCount}/${c.capacity} học viên — chọn lớp khác`];
    return [];
  });
}

// ---------------------------------------------------------------------------------------------
// Mẫu điều khoản / nội quy.
export const TEXT_KIND_LABEL: Record<ContractTextKind, string> = { TERMS: 'Điều khoản', RULES: 'Nội quy' };

export function defaultText(texts: readonly ContractText[], kind: ContractTextKind): ContractText | null {
  return texts.find((t) => t.kind === kind && t.isDefault && t.isActive) ?? null;
}

// "Bản v3 · sửa 01/10/2026"
export function textVersionText(t: Pick<ContractText, 'version' | 'updatedAt'>, tz: string): string {
  const day = new Intl.DateTimeFormat('vi-VN', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(t.updatedAt));
  return `Bản v${t.version} · sửa ${day}`;
}

// Nội dung mẫu thành các đoạn để in (giữ xuống dòng của người soạn).
export function paragraphs(body: string | null): string[] {
  if (!body) return [];
  return body
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Câu báo sau khi xác nhận: số học viên đã ghi danh + tên lớp.
export function enrolledText(res: Pick<ContractDetail, 'enrollments' | 'lines'>): string {
  const active = res.enrollments.filter((e) => e.status === 'ACTIVE');
  if (active.length === 0) return 'Đã xác nhận hợp đồng.';
  const names = active.map((e) => res.lines.find((l) => l.id === e.contractLineId)?.name).filter(Boolean);
  return `Đã xác nhận và ghi danh vào ${names.length > 0 ? names.join(', ') : `${active.length} lớp`}. Nội dung điều khoản, nội quy đã được chụp vào hợp đồng.`;
}

export function moneyText(v: Vnd | null | undefined): string {
  return v === null || v === undefined ? '—' : formatVnd(v);
}
