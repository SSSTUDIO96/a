// Logic thuần của màn Hợp đồng (bản vẽ C mục 4.3): trạng thái nháp, dựng thân gửi máy chủ, kiểm thiếu dữ liệu,
// cảnh báo thợ 3 mức, quyền. KHÔNG tính tiền: mọi số tiền lấy từ máy chủ (quote hoặc hợp đồng đã lưu).
import { canTransitionContract, formatVnd, type Permission } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type {
  AppointmentConflict,
  AvailabilityShift,
  AutoSurchargeRemoved,
  AutoSurchargeReport,
  AutoSurchargeSkipped,
  ContractBody,
  ContractDetail,
  ContractLineInput,
  ContractLineView,
  ContractQuote,
  GroupedContractLine,
  StaffWarning,
  SurchargeOverrideInput,
  ContractStatus,
  ContractUpdateInput,
  DraftHold,
  LocationType,
  StaffRole,
  TravelFeeMode,
  TravelInput,
  Vnd,
} from '../../api/types';

// Kiểu chuẩn của lớp API, gom lại để các thẻ trong thư mục này nhập một chỗ.
export type { ContractDetail, ContractLineView, ContractQuote, GroupedContractLine, StaffWarning } from '../../api/types';

// Thợ dự kiến của dòng trong nháp (role luôn có, khác StaffAssignmentInput của API là role tuỳ chọn).
export interface StaffAssignment {
  membershipId: string;
  role: StaffRole;
}

// ---------------------------------------------------------------------------------------------
// Nhãn
export const LOCATION_ORDER: readonly LocationType[] = ['STUDIO', 'CUSTOMER_HOME', 'OTHER'];
export const LOCATION_LABEL: Record<LocationType, string> = { STUDIO: 'Studio', CUSTOMER_HOME: 'Tại nhà', OTHER: 'Nơi khác' };
export const TRAVEL_MODE_LABEL: Record<TravelFeeMode, string> = {
  FIXED: 'Cố định',
  PER_KM: 'Theo km',
  TIERED: 'Theo bậc',
  MANUAL: 'Nhập tay',
};

export function needsTravel(loc: LocationType | null): boolean {
  return loc === 'CUSTOMER_HOME' || loc === 'OTHER';
}

// ---------------------------------------------------------------------------------------------
// Nháp
export interface TravelDraft {
  mode: TravelFeeMode;
  distanceKm: number | null;
  amount: Vnd | null;
}

// Phần người lập sửa ở MỘT dòng phụ phí tự thêm (bản vẽ D 3.4). null = theo luật + bảng giá. Đơn giá có thì ghi chú bắt buộc.
export interface SurchargeOverrideDraft {
  ruleId: string;
  quantity: number | null;
  unitPrice: Vnd | null;
  note: string;
}

export interface PlacedDraft {
  key: string;
  kind: 'PACKAGE' | 'SERVICE';
  // packageId (gói) hoặc serviceId (dịch vụ lẻ, chỉ có khi mở hợp đồng do nơi khác lập).
  refId: string;
  name: string;
  subjectId: string | null;
  quantity: number;
  // "YYYY-MM-DD" ngày riêng của dòng; rỗng = theo ngày sự kiện của hợp đồng (bản vẽ D 3.4).
  date: string;
  // Loại sự kiện của dòng (Bảng giá → Loại sự kiện); null = chưa chọn.
  occasionId: string | null;
  // "HH:mm" theo múi giờ tổ chức; rỗng = chưa đặt.
  start: string;
  end: string;
  staff: StaffAssignment[];
  // Dịch vụ phụ đang tick; số lượng = số lượng dòng (bản vẽ: Phù dâu × 2 → Kẹp mi × 2).
  addonIds: string[];
  locationType: LocationType | null;
  studioLocationId: string | null;
  address: string;
  travel: TravelDraft;
  // Dòng phụ phí máy chủ tự thêm theo luật: phần người lập sửa, và luật đã bỏ ở dòng này (không tự thêm lại).
  surchargeOverrides: SurchargeOverrideDraft[];
  dismissedRuleIds: string[];
}

export interface SurchargeDraft {
  key: string;
  kind: 'SURCHARGE';
  serviceId: string;
  name: string;
  quantity: number;
  // null = theo bảng giá; có số = ghi đè giá (bắt buộc note).
  unitPrice: Vnd | null;
  note: string;
}

export interface CustomDraft {
  key: string;
  kind: 'CUSTOM';
  name: string;
  unitPrice: Vnd | null;
  quantity: number;
  note: string;
}

export type DraftLine = PlacedDraft | SurchargeDraft | CustomDraft;

export type CustomerDraft =
  | { kind: 'existing'; id: string; fullName: string; phone: string | null; email: string | null }
  | { kind: 'new'; fullName: string; phone: string };

export interface ContractDraft {
  customer: CustomerDraft | null;
  // "YYYY-MM-DD"; rỗng = chưa chọn.
  eventDate: string;
  discount: Vnd;
  // null = để máy chủ lấy cọc gợi ý.
  depositRequired: Vnd | null;
  notes: string;
  lines: DraftLine[];
}

export const EMPTY_DRAFT: ContractDraft = { customer: null, eventDate: '', discount: 0, depositRequired: null, notes: '', lines: [] };

let keySeq = 0;
export function newLineKey(): string {
  keySeq += 1;
  return `d${keySeq}`;
}

export function isPlaced(l: DraftLine): l is PlacedDraft {
  return l.kind === 'PACKAGE' || l.kind === 'SERVICE';
}

// ---------------------------------------------------------------------------------------------
// Giờ theo múi giờ tổ chức (máy chủ nhận ISO kèm độ lệch, ví dụ 2026-10-24T04:30:00+07:00).
function offsetOf(date: string, time: string, tz: string): string {
  const probe = new Date(`${date}T${time}:00Z`);
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = /GMT([+-]\d{2}:\d{2})/.exec(part ?? '');
  return m?.[1] ?? '+00:00';
}

export function zonedIso(date: string, time: string, tz: string): string {
  return `${date}T${time}:00${offsetOf(date, time, tz)}`;
}

export function timeOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export function dateOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

// "Thứ Bảy 24/10" — dòng phụ của ô chọn thợ.
export function weekdayShort(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const names = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return `${names[wd]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export function displayDate(iso: string | null, tz: string): string {
  if (!iso) return '';
  const [y, m, d] = dateOf(iso, tz).split('-');
  return `${d}/${m}/${y}`;
}

export function displayDateTime(iso: string, tz: string): string {
  return `${displayDate(iso, tz)} ${timeOf(iso, tz)}`;
}

/** Ngày dùng cho giờ của dòng: ngày riêng, không có thì ngày sự kiện (có thể rỗng). */
export function dayOfLine(l: Pick<PlacedDraft, 'date'>, eventDate: string): string {
  return l.date || eventDate;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// ---------------------------------------------------------------------------------------------
// Kiểm dữ liệu thiếu TRƯỚC khi gửi. Khoá lỗi theo đúng đường dẫn máy chủ dùng ("lines.0.travel.amount") để
// lỗi của máy chủ và lỗi tự kiểm cùng hiện dưới một ô.
export interface ValidateContext {
  // Bán kính miễn phí (km một chiều) áp cho dòng: includedKm của gói, không có thì freeKm của tổ chức.
  includedKmOf: (line: PlacedDraft) => number;
  // M1: tên nhân vật nếu nhân vật của dòng đang ẩn (Bảng giá → Nhân vật tắt), không thì null. Bỏ trống = không kiểm.
  hiddenSubjectName?: (subjectId: string | null) => string | null;
}

// M1: lời báo ở dòng mang nhân vật đang ẩn (máy chủ chặn đúng: contracts/sheet.ts loadSubject "Nhân vật … đang ẩn").
export function hiddenSubjectText(name: string): string {
  return `Nhân vật "${name}" đang ẩn ở Bảng giá → Nhân vật nên dòng này chưa tính được tiền và hợp đồng chưa lưu được. Bật lại nhân vật hoặc bỏ dòng này.`;
}

export const DATE_NEEDED_TEXT = 'Chọn ngày cho dòng hoặc ngày sự kiện của hợp đồng';

export function lineKey(i: number, field: string): string {
  return `lines.${i}.${field}`;
}

export function validateDraft(draft: ContractDraft, ctx: ValidateContext): Record<string, string> {
  const e: Record<string, string> = {};
  if (!draft.customer) e.customerId = 'Chọn khách hàng.';
  else if (draft.customer.kind === 'new' && draft.customer.fullName.trim() === '') e['newCustomer.fullName'] = 'Nhập họ tên khách.';
  if (draft.lines.length === 0) e.lines = 'Thêm ít nhất một gói hoặc một khoản.';
  draft.lines.forEach((l, i) => {
    if (isPlaced(l)) {
      const hidden = ctx.hiddenSubjectName?.(l.subjectId) ?? null;
      if (hidden) e[lineKey(i, 'subjectId')] = hiddenSubjectText(hidden);
      if (!l.locationType) e[lineKey(i, 'locationType')] = 'Chọn nơi làm.';
      if (needsTravel(l.locationType)) {
        const t = l.travel;
        if (t.mode === 'MANUAL' && t.amount === null) e[lineKey(i, 'travel.amount')] = 'Nhập số tiền (miễn phí ghi 0).';
        if ((t.mode === 'PER_KM' || t.mode === 'TIERED') && t.distanceKm === null) e[lineKey(i, 'travel.distanceKm')] = 'Nhập số km.';
        if (t.mode === 'FIXED' && t.distanceKm === null && ctx.includedKmOf(l) > 0) {
          e[lineKey(i, 'travel.distanceKm')] = 'Nhập số km để xét bán kính miễn phí.';
        }
      }
      if ((l.start === '') !== (l.end === '')) {
        e[lineKey(i, l.start === '' ? 'scheduledStart' : 'scheduledEnd')] = 'Nhập đủ giờ bắt đầu và kết thúc.';
      } else if (l.start !== '' && minutes(l.end) <= minutes(l.start)) {
        e[lineKey(i, 'scheduledEnd')] = 'Giờ kết thúc phải sau giờ bắt đầu.';
      }
      if (l.start !== '' && dayOfLine(l, draft.eventDate) === '') e[lineKey(i, 'date')] = DATE_NEEDED_TEXT;
      l.surchargeOverrides.forEach((o, k) => {
        if (o.unitPrice !== null && o.note.trim() === '') e[lineKey(i, `surchargeOverrides.${k}.note`)] = 'Ghi đè giá phải ghi lý do.';
      });
      if (l.staff.length > 0 && (l.start === '' || l.end === '')) e[lineKey(i, 'staff')] = 'Nhập giờ trước khi chọn thợ.';
    } else if (l.kind === 'SURCHARGE') {
      if (l.unitPrice !== null && l.note.trim() === '') e[lineKey(i, 'note')] = 'Ghi đè giá phải ghi lý do.';
    } else {
      if (l.name.trim() === '') e[lineKey(i, 'name')] = 'Nhập tên khoản.';
      if (l.unitPrice === null) e[lineKey(i, 'unitPrice')] = 'Nhập số tiền.';
    }
  });
  return e;
}

// ---------------------------------------------------------------------------------------------
// M1: nhân vật đang ẩn. Gói của nhân vật đang ẩn KHÔNG bày để chọn vào hợp đồng (máy chủ sẽ chặn khi lưu).
export interface SubjectState {
  id: string;
  name: string;
  isActive: boolean;
}

export function hiddenSubjectOf(subjectId: string | null, subjects: readonly SubjectState[]): SubjectState | null {
  if (!subjectId) return null;
  const s = subjects.find((x) => x.id === subjectId);
  return s && !s.isActive ? s : null;
}

/** Tách gói bán được / gói của nhân vật đang ẩn (theo danh sách nhân vật, hoặc subject.isActive máy chủ gửi kèm gói). */
export function splitPackagesBySubject<P extends { subjectId: string | null; subject?: { isActive: boolean } | null }>(
  packages: readonly P[],
  subjects: readonly SubjectState[],
): { shown: P[]; hidden: P[] } {
  const shown: P[] = [];
  const hidden: P[] = [];
  for (const p of packages) {
    if (p.subject?.isActive === false || hiddenSubjectOf(p.subjectId, subjects)) hidden.push(p);
    else shown.push(p);
  }
  return { shown, hidden };
}

// ---------------------------------------------------------------------------------------------
// M5 (biên bản nghiệm thu lại): GỐC — ContractEditor bỏ hẳn lời gọi quote khi validateDraft còn BẤT KỲ lỗi nào, kể cả lỗi
// chỉ về giờ của một dòng (có giờ bắt đầu, giờ kết thúc trống) → Tạm tính / Tổng / "Cộng …" của mọi dòng thành "—".
// Giờ không đổi tiền, nên bảng tính vẫn chạy: dòng có giờ chưa đủ / ngược / chưa có ngày sự kiện được gửi KHÔNG kèm giờ và
// thợ (máy chủ đòi giờ khi có thợ — sheet.ts checkStaff), lỗi giờ hiện ở đúng ô. Dòng của nhân vật đang ẩn (M1) bỏ khỏi
// bảng tính: các dòng khác vẫn có tiền, còn Tạm tính / Tổng chờ dòng đó được sửa (complete = false).
export interface QuotePlan {
  // Nháp đem đi tính; null = chưa tính được (lỗi làm đổi tiền: phí di chuyển thiếu số, chưa chọn nơi làm, thiếu khách…).
  draft: ContractDraft | null;
  // Vị trí dòng nháp → vị trí dòng trong bảng tính (null = dòng không đem đi tính).
  toQuote: (number | null)[];
  // Mọi dòng đều có trong bảng tính → Tạm tính / Tổng / cọc của bảng tính dùng được.
  complete: boolean;
}

const TIME_ONLY_FIELDS = new Set(['scheduledStart', 'scheduledEnd', 'staff', 'date']);

function timeUsable(l: PlacedDraft, eventDate: string): boolean {
  return dayOfLine(l, eventDate) !== '' && l.start !== '' && l.end !== '' && minutes(l.end) > minutes(l.start);
}

export function quotePlan(draft: ContractDraft, errors: Record<string, string>): QuotePlan {
  const skip = new Set<number>();
  for (const k of Object.keys(errors)) {
    const m = /^lines\.(\d+)\.subjectId$/.exec(k);
    if (m) skip.add(Number(m[1]));
  }
  const blocking = Object.keys(errors).some((k) => {
    if (k === 'eventDate') return false;
    const m = /^lines\.(\d+)\.(.+)$/.exec(k);
    if (!m) return true;
    return !skip.has(Number(m[1])) && !TIME_ONLY_FIELDS.has(m[2] ?? '');
  });
  const toQuote: (number | null)[] = [];
  const lines: DraftLine[] = [];
  draft.lines.forEach((l, i) => {
    if (skip.has(i)) {
      toQuote.push(null);
      return;
    }
    toQuote.push(lines.length);
    lines.push(isPlaced(l) && !timeUsable(l, draft.eventDate) ? { ...l, start: '', end: '', staff: [] } : l);
  });
  return { draft: blocking ? null : { ...draft, lines }, toQuote, complete: skip.size === 0 };
}

/** Kết quả theo vị trí dòng bảng tính → theo vị trí dòng nháp. */
export function viewsByDraft<T>(plan: QuotePlan, byQuote: readonly (T | null)[]): (T | null)[] {
  return plan.toQuote.map((q) => (q === null ? null : (byQuote[q] ?? null)));
}

/** Vị trí dòng máy chủ báo lỗi (details.line, theo bảng tính) → vị trí dòng nháp. */
export function draftIndexOfQuoteLine(plan: QuotePlan, q: number | null): number | null {
  if (q === null) return null;
  const i = plan.toQuote.indexOf(q);
  return i >= 0 ? i : null;
}

/** Khoá lỗi "lines.{vị trí bảng tính}.…" của máy chủ → "lines.{vị trí nháp}.…" để hiện dưới đúng ô. */
export function remapLineFields(fields: Record<string, string>, plan: QuotePlan): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    const m = /^lines\.(\d+)(\..*)?$/.exec(k);
    if (!m) {
      out[k] = v;
      continue;
    }
    const i = draftIndexOfQuoteLine(plan, Number(m[1]));
    if (i !== null) out[`lines.${i}${m[2] ?? ''}`] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Dựng thân gửi máy chủ (quote / tạo / sửa nháp / thêm phát sinh). Gọi sau khi validateDraft không còn lỗi.
type PlacedInput = Extract<ContractLineInput, { kind: 'PACKAGE' | 'SERVICE' }> & { staff?: StaffAssignment[] };

export function travelInput(t: TravelDraft): TravelInput {
  if (t.mode === 'MANUAL') return { mode: 'MANUAL', amount: t.amount ?? 0, ...(t.distanceKm !== null ? { distanceKm: t.distanceKm } : {}) };
  return { mode: t.mode, ...(t.distanceKm !== null ? { distanceKm: t.distanceKm } : {}) };
}

function overrideInput(o: SurchargeOverrideDraft): SurchargeOverrideInput {
  const note = o.note.trim();
  return {
    ruleId: o.ruleId,
    ...(o.quantity !== null ? { quantity: o.quantity } : {}),
    ...(o.unitPrice !== null ? { unitPrice: o.unitPrice } : {}),
    ...(note ? { note } : {}),
  };
}

export function lineInput(l: DraftLine, eventDate: string, tz: string): ContractLineInput {
  if (l.kind === 'SURCHARGE') {
    const note = l.note.trim();
    return {
      kind: 'SURCHARGE',
      serviceId: l.serviceId,
      quantity: l.quantity,
      ...(l.unitPrice !== null ? { unitPrice: l.unitPrice } : {}),
      ...(note ? { note } : {}),
    };
  }
  if (l.kind === 'CUSTOM') {
    const note = l.note.trim();
    return { kind: 'CUSTOM', name: l.name.trim(), unitPrice: l.unitPrice ?? 0, quantity: l.quantity, ...(note ? { note } : {}) };
  }
  const address = l.address.trim();
  const day = dayOfLine(l, eventDate);
  const overrides = l.surchargeOverrides.filter((o) => o.quantity !== null || o.unitPrice !== null);
  const base = {
    quantity: l.quantity,
    ...(l.subjectId ? { subjectId: l.subjectId } : {}),
    ...(l.locationType ? { locationType: l.locationType } : {}),
    ...(l.locationType === 'STUDIO' && l.studioLocationId ? { studioLocationId: l.studioLocationId } : {}),
    ...(needsTravel(l.locationType) && address ? { address } : {}),
    ...(l.occasionId ? { occasionId: l.occasionId } : {}),
    ...(l.start && l.end && day
      ? { scheduledStart: zonedIso(day, l.start, tz), scheduledEnd: zonedIso(day, l.end, tz) }
      : {}),
    ...(l.addonIds.length > 0 ? { addons: l.addonIds.map((serviceId) => ({ serviceId, quantity: l.quantity })) } : {}),
    ...(needsTravel(l.locationType) ? { travel: travelInput(l.travel) } : {}),
    ...(l.staff.length > 0 ? { staff: l.staff.map((s) => ({ membershipId: s.membershipId, role: s.role })) } : {}),
    ...(overrides.length > 0 ? { surchargeOverrides: overrides.map(overrideInput) } : {}),
    
  };
  const input: PlacedInput = l.kind === 'PACKAGE' ? { kind: 'PACKAGE', packageId: l.refId, ...base } : { kind: 'SERVICE', serviceId: l.refId, ...base };
  return input;
}

export function buildBody(draft: ContractDraft, tz: string): ContractBody | null {
  if (!draft.customer || draft.lines.length === 0) return null;
  const lines = draft.lines.map((l) => lineInput(l, draft.eventDate, tz));
  const fields = {
    ...(draft.eventDate ? { eventDate: zonedIso(draft.eventDate, '00:00', tz) } : {}),
    ...(draft.notes.trim() ? { notes: draft.notes } : {}),
    discount: draft.discount,
    ...(draft.depositRequired !== null ? { depositRequired: draft.depositRequired } : {}),
    lines,
  };
  if (draft.customer.kind === 'existing') return { customerId: draft.customer.id, ...fields };
  const phone = draft.customer.phone.trim();
  return { newCustomer: { fullName: draft.customer.fullName.trim(), ...(phone ? { phone } : {}) }, ...fields };
}

// Sửa nháp: gửi lại toàn bộ lines cùng discount, depositRequired, eventDate, notes (bản vẽ 4.3).
// expectedUpdatedAt ghép lúc gửi (ContractEditor withVersion) — chữ ký nháp không phụ thuộc phiên bản.
export type ContractPatchFields = Omit<ContractUpdateInput, 'expectedUpdatedAt'>;

export function patchBody(draft: ContractDraft, tz: string): ContractPatchFields {
  return {
    lines: draft.lines.map((l) => lineInput(l, draft.eventDate, tz)),
    discount: draft.discount,
    ...(draft.depositRequired !== null ? { depositRequired: draft.depositRequired } : {}),
    eventDate: draft.eventDate ? zonedIso(draft.eventDate, '00:00', tz) : null,
    notes: draft.notes.trim() ? draft.notes : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Hợp đồng đã lưu → nháp đang sửa.
// perQuantityOf(ruleId): luật tính theo số lượng dòng không; null = không biết luật (không có quyền đọc Bảng giá).
export interface PlacedFromViewOpts {
  // "YYYY-MM-DD" ngày sự kiện của hợp đồng; rỗng = chưa có.
  eventDate: string;
  perQuantityOf?: (ruleId: string) => boolean | null;
}

// Phần người lập đã sửa ở các dòng phụ phí tự thêm đã lưu: giá không trỏ phiên bản bảng giá = đã ghi đè; số lượng khác số
// mặc định của luật (perQuantity ? số lượng dòng : 1) = đã sửa. Không biết luật (Q ≠ 1) thì GIỮ số đã lưu như một phần sửa —
// không đoán số mặc định để khỏi đổi tiền lúc lưu lại.
export function overridesFromView(l: GroupedContractLine<string | null>, perQuantityOf?: (ruleId: string) => boolean | null): SurchargeOverrideDraft[] {
  const out: SurchargeOverrideDraft[] = [];
  for (const s of l.surcharges ?? []) {
    if (s.voidedAt || !s.surchargeRuleId) continue;
    const pq = perQuantityOf?.(s.surchargeRuleId) ?? null;
    const dflt = pq === null ? (l.quantity === 1 ? 1 : null) : pq ? l.quantity : 1;
    const quantity = dflt !== null && s.quantity === dflt ? null : s.quantity;
    const unitPrice = s.priceVersionId === null ? s.unitPrice : null;
    if (quantity === null && unitPrice === null) continue;
    out.push({ ruleId: s.surchargeRuleId, quantity, unitPrice, note: s.note ?? '' });
  }
  return out;
}

export function placedFromView(l: GroupedContractLine<string | null>, tz: string, opts: PlacedFromViewOpts): PlacedDraft {
  const t = l.travel;
  const day = l.scheduledStart ? dateOf(l.scheduledStart, tz) : '';
  return {
    key: l.id ?? newLineKey(),
    kind: l.kind === 'SERVICE' ? 'SERVICE' : 'PACKAGE',
    refId: (l.kind === 'SERVICE' ? l.serviceId : l.packageId) ?? '',
    name: l.name,
    subjectId: l.subjectId,
    quantity: l.quantity,
    date: day !== '' && day !== opts.eventDate ? day : '',
    occasionId: l.occasionId,
    start: l.scheduledStart ? timeOf(l.scheduledStart, tz) : '',
    end: l.scheduledEnd ? timeOf(l.scheduledEnd, tz) : '',
    staff: (l.staff ?? []).map((s) => ({ membershipId: s.membershipId, role: s.role })),
    addonIds: l.addons.filter((a) => !a.voidedAt && a.serviceId).map((a) => a.serviceId as string),
    locationType: l.locationType,
    studioLocationId: l.studioLocationId,
    address: l.address ?? '',
    travel: t
      ? { mode: t.travelMode ?? 'MANUAL', distanceKm: t.distanceKm, amount: t.travelMode === 'MANUAL' ? t.unitPrice : null }
      : { mode: 'PER_KM', distanceKm: null, amount: null },
    surchargeOverrides: overridesFromView(l, opts.perQuantityOf),
    dismissedRuleIds: [...l.dismissedRuleIds],
  };
}

export function draftFromDetail(d: ContractDetail, tz: string, perQuantityOf?: (ruleId: string) => boolean | null): ContractDraft {
  const lines: DraftLine[] = [];
  const eventDate = d.eventDate ? dateOf(d.eventDate, tz) : '';
  for (const l of d.lines) {
    if (l.voidedAt) continue;
    if (l.kind === 'PACKAGE' || l.kind === 'SERVICE') {
      lines.push({ ...placedFromView(l, tz, { eventDate, perQuantityOf }), key: newLineKey() });
    } else if (l.kind === 'SURCHARGE' && l.serviceId && !l.surchargeRuleId) {
      // Dòng phụ phí TỰ THÊM (có surchargeRuleId) là dòng con của dòng gói — không bao giờ thành dòng gốc nhập tay.
      lines.push({
        key: newLineKey(),
        kind: 'SURCHARGE',
        serviceId: l.serviceId,
        name: l.name,
        quantity: l.quantity,
        // Dòng phụ phí đã lưu không trỏ phiên bản giá = đã ghi đè giá.
        unitPrice: l.priceVersionId === null ? l.unitPrice : null,
        note: l.note ?? '',
      });
    } else if (l.kind === 'CUSTOM') {
      lines.push({ key: newLineKey(), kind: 'CUSTOM', name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, note: l.note ?? '' });
    }
  }
  return {
    customer: { kind: 'existing', id: d.customer.id, fullName: d.customer.fullName, phone: d.customer.phone, email: d.customer.email },
    eventDate,
    discount: d.discount,
    depositRequired: d.depositRequired,
    notes: d.notes ?? '',
    lines,
  };
}

// Kết quả quote chỉ dùng khi khớp đúng các dòng đang nhập (cùng số dòng, cùng loại, cùng gói/dịch vụ).
// Lệch (vừa thêm/bỏ dòng, quote chưa về) → coi như đang chờ, không gán nhầm số tiền sang dòng khác.
export function matchQuote(draft: ContractDraft, quote: ContractQuote | null): (GroupedContractLine<null> | null)[] {
  const none = draft.lines.map(() => null);
  if (!quote || quote.lines.length !== draft.lines.length) return none;
  const ok = draft.lines.every((l, i) => {
    const q = quote.lines[i];
    if (!q || q.kind !== l.kind) return false;
    if (l.kind === 'PACKAGE') return q.packageId === l.refId;
    if (l.kind === 'SERVICE') return q.serviceId === l.refId;
    if (l.kind === 'SURCHARGE') return q.serviceId === l.serviceId;
    return true;
  });
  return ok ? quote.lines : none;
}

// Cộng dòng (gói + dịch vụ phụ + phí di chuyển) — bản vẽ: "tổng lineTotal của dòng gói + addons + travel lấy từ quote".
export function groupTotal(l: GroupedContractLine<string | null>): Vnd {
  const live = (x: ContractLineView<string | null>) => (x.voidedAt ? 0 : x.lineTotal);
  return live(l) + l.addons.reduce((s, a) => s + live(a), 0) + (l.travel ? live(l.travel) : 0) + l.surcharges.reduce((s, a) => s + live(a), 0);
}

// ---------------------------------------------------------------------------------------------
// Cảnh báo thợ — rảnh (không dải) / vàng SAME_DAY "có lịch trong ngày" / xám-vàng DRAFT_HOLD "Giữ chỗ nháp ở HĐ-…"
// / đỏ OVERLAP "trùng giờ".
// Quyết định 15:14 (docs/NHAT-KY-QUYET-DINH-THAY.md): lịch nháp KHÔNG chiếm giờ thợ. Vì vậy giữ chỗ của hợp đồng NHÁP
// khác chỉ là nhãn để biết (DRAFT_HOLD), KHÔNG khoá nút Xác nhận (biên bản web 2, T1 — sửa quyết định 5 cũ của thợ W5).
// Đỏ chỉ khi trùng lịch ĐÃ chặn giờ (máy chủ trả trong overlaps) hoặc trùng giữa các dòng của chính hợp đồng này.
export interface WarnRange {
  start: string;
  end: string;
  // Chi tiết cho tooltip: "L-0001 · Makeup ăn hỏi · Vũ Hồng Nhung".
  label: string;
}

export type WarnLevel = 'OVERLAP' | 'DRAFT_HOLD' | 'SAME_DAY';

export interface LineWarning {
  membershipId: string;
  level: WarnLevel;
  // Khoảng trùng giờ (OVERLAP, DRAFT_HOLD) hoặc các ca trong ngày (SAME_DAY).
  ranges: WarnRange[];
  // Số ca trong ngày (SAME_DAY).
  count: number;
  // Mã các hợp đồng nháp đang giữ chỗ (DRAFT_HOLD), không trùng nhau.
  holdCodes?: string[];
  // DRAFT_HOLD mà không giữ chỗ nào trùng giờ (chỉ cùng ngày, khác giờ).
  holdSameDayOnly?: boolean;
}

const LEVEL_RANK: Record<WarnLevel, number> = { OVERLAP: 0, DRAFT_HOLD: 1, SAME_DAY: 2 };

function shiftLabel(s: AvailabilityShift): string {
  return [s.code, s.title, s.customerName].filter(Boolean).join(' · ');
}

function holdRange(h: DraftHold): WarnRange | null {
  if (!h.scheduledStart || !h.scheduledEnd) return null;
  return { start: h.scheduledStart, end: h.scheduledEnd, label: `${h.code} (nháp) · ${h.lineName}` };
}

/**
 * Cảnh báo máy chủ trả trong quote (quote gửi excludeContractId nên máy chủ đã bỏ giữ chỗ / lịch của CHÍNH hợp đồng
 * đang sửa), xếp mức theo quyết định 15:14:
 * - OVERLAP: trùng ca đã chặn giờ (overlaps) hoặc trùng giữa các dòng của chính hợp đồng này (sameContract, máy chủ so);
 * - DRAFT_HOLD: chỉ chồng giờ với giữ chỗ của hợp đồng NHÁP khác — nhãn để biết, không chặn;
 * - SAME_DAY: có ca / giữ chỗ khác cùng ngày.
 * KHÔNG dùng `w.level` của máy chủ (máy chủ từng gán OVERLAP cả khi chỉ có giữ chỗ nháp — T1).
 * `lineLabel(i, tên)`: nhãn của dòng thứ i để ghi "Dòng {nhân vật} của hợp đồng này".
 */
export function serverWarnings(list: StaffWarning[] | undefined, lineLabel: (index: number, name: string) => string = (_, n) => n): LineWarning[] {
  const out: LineWarning[] = [];
  for (const w of list ?? []) {
    const same = w.sameContract ?? [];
    const holds = w.draftHolds;
    const overlapHolds = holds.filter((h) => h.overlaps);
    // Đỏ: trùng lịch đã chiếm giờ / trùng dòng khác của hợp đồng này. Giữ chỗ nháp trùng giờ: xám. Có ca thật cùng ngày:
    // vàng (đếm cả giữ chỗ). Chỉ có giữ chỗ nháp cùng ngày khác giờ: xám "cùng ngày, khác giờ".
    const level: WarnLevel | null =
      w.overlaps.length > 0 || same.length > 0
        ? 'OVERLAP'
        : overlapHolds.length > 0
          ? 'DRAFT_HOLD'
          : w.sameDay.length > 0
            ? 'SAME_DAY'
            : holds.length > 0
              ? 'DRAFT_HOLD'
              : null;
    const shownHolds = overlapHolds.length > 0 ? overlapHolds : holds;
    if (!level) continue;
    const ranges =
      level === 'OVERLAP'
        ? [
            ...w.overlaps.map((s) => ({ start: s.startsAt, end: s.endsAt, label: shiftLabel(s) })),
            ...same.map((h) => ({ start: h.scheduledStart, end: h.scheduledEnd, label: `Dòng ${lineLabel(h.lineIndex, h.lineName)} của hợp đồng này` })),
          ]
        : level === 'DRAFT_HOLD'
          ? shownHolds.map(holdRange).filter((r): r is WarnRange => r !== null)
          : [...w.sameDay.map((s) => ({ start: s.startsAt, end: s.endsAt, label: shiftLabel(s) })), ...holds.map(holdRange).filter((r): r is WarnRange => r !== null)];
    out.push({
      membershipId: w.membershipId,
      level,
      ranges,
      count: w.sameDay.length + holds.length,
      ...(level === 'DRAFT_HOLD' ? { holdCodes: [...new Set(shownHolds.map((h) => h.code))], holdSameDayOnly: overlapHolds.length === 0 } : {}),
    });
  }
  return out;
}

function placedLabel(l: PlacedDraft, subjectName: (id: string | null) => string | null): string {
  return subjectName(l.subjectId) ?? l.name;
}

/** Cảnh báo để hiện: giờ "HH:mm" theo múi giờ tổ chức, mỗi thợ một dải, đỏ trước, rồi giữ chỗ nháp, rồi vàng. */
export function displayWarnings(server: LineWarning[], tz: string): LineWarning[] {
  return server
    .map((w) => ({ ...w, ranges: w.ranges.map((r) => ({ ...r, start: timeOf(r.start, tz), end: timeOf(r.end, tz) })) }))
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}

export function overlapLineCount(warnings: Map<string, LineWarning[]>): number {
  let n = 0;
  for (const list of warnings.values()) if (list.some((w) => w.level === 'OVERLAP')) n += 1;
  return n;
}

export function confirmBlockedReason(overlapLines: number): string | null {
  return overlapLines > 0 ? `Còn ${overlapLines} dòng thợ trùng giờ. Đổi thợ hoặc đổi giờ trước khi xác nhận.` : null;
}

// ---------------------------------------------------------------------------------------------
// S1 (biên bản web 2): xác nhận KHÔNG bị chặn khi dòng chưa có thợ — máy chủ sinh lịch cho MỌI dòng có giờ, dòng chưa
// có thợ thành lịch ở hàng "Chưa có thợ". Màn chỉ nhắc một dòng vàng ở thanh tổng.
export interface StaffGaps {
  // Dòng có giờ nhưng chưa có thợ → lịch không thợ.
  noStaff: number;
  // Dòng chưa có giờ → chưa lên lịch được.
  noTime: number;
}

export function staffGaps(draft: ContractDraft): StaffGaps {
  let noStaff = 0;
  let noTime = 0;
  for (const l of draft.lines) {
    if (!isPlaced(l)) continue;
    if (!l.start || !l.end) noTime += 1;
    else if (l.staff.length === 0) noStaff += 1;
  }
  return { noStaff, noTime };
}

// Chỉ phần "chưa có thợ" (nhắc, không chặn). Dòng chưa có giờ CHẶN xác nhận (N2) — dải hiện riêng từng dòng, xem
// linesWithoutTime / noTimeBlockedReason.
export function staffGapText(g: StaffGaps): string | null {
  return g.noStaff > 0 ? `${g.noStaff} dòng chưa có thợ — lịch sẽ nằm ở hàng Chưa có thợ` : null;
}

// ---------------------------------------------------------------------------------------------
// N2 (biên bản nghiệm thu cuối): hợp đồng DỊCH VỤ không xác nhận được khi còn dòng cần lên lịch (gói / dịch vụ) chưa đủ
// giờ bắt đầu và giờ kết thúc — hợp đồng đã chốt không được vắng mặt trên Lịch, và sau khi chốt ô giờ bị khoá.
// Máy chủ cũng chặn (thợ Y1); web chặn trước để chỉ đúng dòng. Không áp cho hợp đồng khoá học.
export interface NoTimeLine {
  // Vị trí trong draft.lines (trùng data-dong của thẻ dòng).
  index: number;
  // "Dòng 2 · Cô dâu · Trang điểm cô dâu"
  label: string;
}

export function linesWithoutTime(draft: ContractDraft, subjectName: (id: string | null) => string | null): NoTimeLine[] {
  const out: NoTimeLine[] = [];
  let pos = 0;
  draft.lines.forEach((l, i) => {
    if (!isPlaced(l)) return;
    pos += 1;
    if (l.start && l.end) return;
    const subject = subjectName(l.subjectId);
    out.push({ index: i, label: `Dòng ${pos} · ${subject && subject !== l.name ? `${subject} · ` : ''}${l.name}` });
  });
  return out;
}

export function noTimeBlockedReason(lines: NoTimeLine[]): string | null {
  if (lines.length === 0) return null;
  return `Còn ${lines.length} dòng chưa có giờ (${lines.map((l) => l.label).join('; ')}). Nhập giờ bắt đầu và giờ kết thúc rồi mới xác nhận được — hợp đồng đã chốt phải có lịch.`;
}

// Máy chủ chặn sinh lịch vì còn dòng cần lên lịch (PACKAGE/SERVICE chưa huỷ) thiếu giờ — cửa xác nhận hợp đồng và cửa
// thêm phát sinh (POST /contracts/:id/lines, khi đó lineIds là dòng vừa thêm đã bị quay lui).
// Hình dạng (apps/api/src/modules/contracts/routes.ts assertSchedulableLinesHaveTime): HTTP 409, code CONFLICT,
// details = { reason: 'LINES_MISSING_TIME', lineIds: string[] (theo thứ tự dòng),
//             lines: [{ id, name, subjectName, missing: ('scheduledStart' | 'scheduledEnd')[] }] }.
// Chỉ nhận ĐÚNG hình dạng này; lệch chỗ nào → null (không đoán, không đường lui im lặng). Bài khớp hai đầu:
// apps/web/src/api/khop-hop-dong.test.ts.
export const LINES_MISSING_TIME = 'LINES_MISSING_TIME';

export type MissingTimeField = 'scheduledStart' | 'scheduledEnd';

// Khai cục bộ (chưa có trong api/types.ts).
export interface MissingTimeLine {
  id: string;
  name: string;
  subjectName: string | null;
  missing: MissingTimeField[];
}

export interface MissingTimeError {
  lineIds: string[];
  lines: MissingTimeLine[];
}

function isMissingTimeLine(v: unknown): v is MissingTimeLine {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    (o.subjectName === null || typeof o.subjectName === 'string') &&
    Array.isArray(o.missing) &&
    o.missing.length > 0 &&
    o.missing.every((m) => m === 'scheduledStart' || m === 'scheduledEnd')
  );
}

export function missingTimeOf(err: unknown): MissingTimeError | null {
  if (!(err instanceof ApiError) || err.status !== 409 || err.code !== 'CONFLICT') return null;
  const d = err.details as { reason?: unknown; lineIds?: unknown; lines?: unknown } | null | undefined;
  if (!d || typeof d !== 'object' || d.reason !== LINES_MISSING_TIME) return null;
  const { lineIds, lines } = d;
  if (!Array.isArray(lineIds) || lineIds.length === 0 || !lineIds.every((x): x is string => typeof x === 'string' && x !== '')) return null;
  if (!Array.isArray(lines) || lines.length !== lineIds.length || !lines.every(isMissingTimeLine)) return null;
  if (lines.some((l, i) => l.id !== lineIds[i])) return null;
  return { lineIds, lines };
}

// "giờ bắt đầu và giờ kết thúc" / "giờ bắt đầu" / "giờ kết thúc"
export function missingTimeWhat(missing: readonly MissingTimeField[]): string {
  if (missing.includes('scheduledStart') && missing.includes('scheduledEnd')) return 'giờ bắt đầu và giờ kết thúc';
  return missing.includes('scheduledStart') ? 'giờ bắt đầu' : 'giờ kết thúc';
}

// "Phù dâu · Trang điểm nhẹ: chưa có giờ bắt đầu và giờ kết thúc"
export function missingTimeLabel(l: MissingTimeLine): string {
  return `${l.subjectName && l.subjectName !== l.name ? `${l.subjectName} · ` : ''}${l.name}: chưa có ${missingTimeWhat(l.missing)}`;
}

/**
 * Mã dòng máy chủ → vị trí trong draft.lines. Dòng gói/dịch vụ chưa huỷ của hợp đồng đã lưu theo đúng thứ tự của
 * nháp (draftFromDetail / lưu xong). Không tìm thấy hoặc số dòng lệch → index null (bản trên máy chủ đã khác).
 */
export function draftIndexesOfLineIds(
  saved: readonly Pick<GroupedContractLine<string | null>, 'id' | 'kind' | 'name' | 'voidedAt'>[],
  draft: ContractDraft,
  ids: readonly string[],
): { id: string; index: number | null; name: string | null }[] {
  const placedSaved = saved.filter((l) => !l.voidedAt && (l.kind === 'PACKAGE' || l.kind === 'SERVICE'));
  const placedDraft = draft.lines.flatMap((l, i) => (isPlaced(l) ? [i] : []));
  const aligned = placedSaved.length === placedDraft.length;
  return ids.map((id) => {
    const k = placedSaved.findIndex((l) => l.id === id);
    return { id, index: aligned && k >= 0 ? (placedDraft[k] ?? null) : null, name: k >= 0 ? (placedSaved[k]?.name ?? null) : null };
  });
}

// ---------------------------------------------------------------------------------------------
// L1 (biên bản nghiệm thu cuối): gõ giờ bắt đầu → giờ kết thúc tự điền = bắt đầu + thời lượng gói, khi ô kết thúc
// đang trống hoặc vẫn là giờ tự điền (bằng giờ bắt đầu CŨ + thời lượng). Giờ người dùng tự gõ khác đi thì giữ nguyên.
// Qua nửa đêm (hợp đồng không nhận giờ kết thúc trước giờ bắt đầu) → để trống cho người dùng tự nhập.
function plusMinutes(hhmm: string, minutes: number): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function autoEndTime(prevStart: string, nextStart: string, end: string, durationMinutes: number | null | undefined): string {
  if (!durationMinutes || durationMinutes <= 0) return end;
  const wasAuto = end === '' || (prevStart !== '' && end === plusMinutes(prevStart, durationMinutes));
  if (!wasAuto) return end;
  return nextStart ? (plusMinutes(nextStart, durationMinutes) ?? '') : '';
}

/** Sau khi xác nhận: đếm lịch máy chủ đã tạo (createdAppointments) và số lịch chưa có thợ (theo dòng của lịch). */
export function confirmResultText(res: Pick<ContractDetail, 'lines'> & { createdAppointments?: { contractLineId: string | null }[] }): string {
  const created = res.createdAppointments ?? [];
  if (created.length === 0) return 'Đã xác nhận hợp đồng. Không có lịch nào được tạo (chưa dòng nào có giờ).';
  const noStaff = created.filter((a) => {
    const l = res.lines.find((x) => x.id === a.contractLineId);
    return l !== undefined && (l.staff ?? []).length === 0;
  }).length;
  return `Đã xác nhận hợp đồng · đã tạo ${created.length} lịch${noStaff > 0 ? ` (${noStaff} lịch chưa có thợ — ở hàng Chưa có thợ)` : ''}.`;
}

// ---------------------------------------------------------------------------------------------
// T2 (biên bản web 2): PATCH hợp đồng gửi kèm expectedUpdatedAt; máy chủ trả 409 STALE_VERSION khi bản đã đổi.
export function isStaleVersion(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  return (err.details as { reason?: unknown } | undefined)?.reason === 'STALE_VERSION';
}

/** Những phần khác nhau giữa bản đang nhập và bản mới của máy chủ — để người dùng so trước khi chọn. */
export function draftDiffs(mine: ContractDraft, theirs: ContractDraft, tz: string): string[] {
  const out: string[] = [];
  const money = (v: Vnd | null) => (v === null ? 'theo gợi ý' : formatVnd(v));
  if (mine.discount !== theirs.discount) out.push(`Giảm giá: bản của bạn ${money(mine.discount)} · bản mới ${money(theirs.discount)}`);
  if (mine.depositRequired !== theirs.depositRequired) {
    out.push(`Cọc cần thu: bản của bạn ${money(mine.depositRequired)} · bản mới ${money(theirs.depositRequired)}`);
  }
  if (mine.eventDate !== theirs.eventDate) out.push('Ngày sự kiện');
  if (mine.notes.trim() !== theirs.notes.trim()) out.push('Ghi chú hợp đồng');
  const lines = (d: ContractDraft) => JSON.stringify(d.lines.map((l) => lineInput(l, d.eventDate, tz)));
  if (lines(mine) !== lines(theirs)) out.push('Các dòng (gói, giờ, thợ, nơi làm hoặc khoản khác)');
  return out;
}

// Nhãn dòng thêm sau khi xác nhận: "Phát sinh 20/10/2026" (createdAt của dòng; dòng cũ thiếu ngày → "Phát sinh").
export function addedLabel(l: { addedAfterConfirm: boolean; createdAt?: string | null }, tz: string): string | null {
  if (!l.addedAfterConfirm) return null;
  return l.createdAt ? `Phát sinh ${displayDate(l.createdAt, tz)}` : 'Phát sinh';
}

// Sửa nháp hạ tổng dưới số đã thu → 409 TOTAL_BELOW_PAID, details { paid, newTotal, total } — báo một dòng, tiền định dạng VN.
export function belowPaidText(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const d = err.details as { reason?: unknown; paid?: unknown; newTotal?: unknown } | undefined;
  if (d?.reason !== 'TOTAL_BELOW_PAID' || typeof d.paid !== 'number' || typeof d.newTotal !== 'number') return null;
  return `Hợp đồng đã thu ${formatVnd(d.paid)} — tổng mới ${formatVnd(d.newTotal)} thấp hơn số đã thu. Ghi phiếu hoàn tiền phần chênh trước, hoặc giữ tổng không thấp hơn số đã thu.`;
}

// ---------------------------------------------------------------------------------------------
// Đổi khách của hợp đồng NHÁP đã lưu (PATCH customerId — contracts/routes.ts checkCustomerChange).
// 409 CUSTOMER_IN_USE: details = { reason, appointments, designCards } — số lịch chưa huỷ / thẻ thiết kế chưa xoá đang
// chép khách hiện tại. 404: khách không thuộc tổ chức. 409 khác (đã xác nhận): lời máy chủ.
export function customerInUse(err: unknown): { appointments: number; designCards: number } | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const d = err.details as { reason?: unknown; appointments?: unknown; designCards?: unknown } | undefined;
  if (d?.reason !== 'CUSTOMER_IN_USE') return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return { appointments: n(d.appointments), designCards: n(d.designCards) };
}

export function customerChangeText(err: unknown): string {
  const used = customerInUse(err);
  if (used) {
    const parts = [used.appointments > 0 ? `${used.appointments} lịch` : null, used.designCards > 0 ? `${used.designCards} thẻ thiết kế` : null].filter(Boolean);
    const what = parts.length > 0 ? parts.join(' và ') : 'lịch hoặc thẻ thiết kế';
    const fix = [used.appointments > 0 ? 'huỷ lịch' : null, used.designCards > 0 ? 'xoá thẻ thiết kế' : null].filter(Boolean).join(' và ') || 'huỷ lịch / xoá thẻ';
    return `Chưa đổi được khách: hợp đồng đã có ${what} mang tên khách hiện tại. Muốn đổi, ${fix} trước.`;
  }
  if (err instanceof ApiError && err.status === 404) return 'Không tìm thấy khách này trong tổ chức. Chọn lại khách.';
  if (isStaleVersion(err)) return 'Hợp đồng vừa được người khác sửa — tải bản mới rồi đổi khách.';
  return err instanceof ApiError && err.message ? err.message : 'Chưa đổi được khách. Thử lại.';
}

// ---------------------------------------------------------------------------------------------
// N8: lời lỗi tiền của máy chủ in số thô "Giảm giá hợp đồng (99000000) lớn hơn tổng các dòng (1950000)" → định dạng
// tiền Việt và đặt dưới đúng ô (Giảm giá / Cọc cần thu). Chỉ đổi cách hiện số, không đổi nội dung.
export function prettyMoneyText(text: string): string {
  return text.replace(/\((\d{4,})\)/g, (_, n: string) => `(${formatVnd(Number(n))})`);
}

export function moneyFieldOf(err: unknown): { field: 'discount' | 'depositRequired'; message: string } | null {
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED') return null;
  const msg = err.message ?? '';
  if (/^Giảm giá hợp đồng/.test(msg)) return { field: 'discount', message: prettyMoneyText(msg) };
  if (/^Tiền cọc/.test(msg)) return { field: 'depositRequired', message: prettyMoneyText(msg) };
  return null;
}

// N7: lỗi "sai" (không phải "còn thiếu") hiện ngay khi gõ, không đợi bấm Lưu — giờ ngược, phí di chuyển còn thiếu số
// làm tiền hiện "—". M5: dòng mới có MỘT trong hai ô giờ cũng báo ngay dưới ô còn trống (tiền các dòng vẫn tính).
// M1: dòng mang nhân vật đang ẩn báo ngay. Lỗi "chưa nhập" khác vẫn đợi bấm Lưu.
export function liveErrors(local: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(local)) {
    if (/^lines\.\d+\.(travel\.|scheduledStart$|scheduledEnd$|subjectId$)/.test(k)) out[k] = v;
  }
  return out;
}

export function hiddenSubjectBlockedReason(lines: NoTimeLine[]): string | null {
  if (lines.length === 0) return null;
  return `Còn ${lines.length} dòng dùng nhân vật đang ẩn (${lines.map((l) => l.label).join('; ')}). Bật lại nhân vật ở Bảng giá → Nhân vật hoặc bỏ dòng rồi mới xác nhận được.`;
}

/** M1: các dòng mang nhân vật đang ẩn — "Dòng 2 · Mẹ cô dâu · Mẹ – Trang điểm nhẹ nhàng". */
export function linesWithHiddenSubject(draft: ContractDraft, errors: Record<string, string>, subjectName: (id: string | null) => string | null): NoTimeLine[] {
  const out: NoTimeLine[] = [];
  let pos = 0;
  draft.lines.forEach((l, i) => {
    if (!isPlaced(l)) return;
    pos += 1;
    if (!errors[lineKey(i, 'subjectId')]) return;
    const subject = subjectName(l.subjectId);
    out.push({ index: i, label: `Dòng ${pos} · ${subject && subject !== l.name ? `${subject} · ` : ''}${l.name}` });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Quyền → phần nào hiện / bật (bản vẽ C mục 6; máy chủ: contracts/routes.ts).
export interface ContractAbilities {
  canEdit: boolean;
  canConfirm: boolean;
  canAddExtra: boolean;
  canVoidLine: boolean;
  canEditNotes: boolean;
  canCancel: boolean;
  showCatalog: boolean;
  canPickStaff: boolean;
  canSearchCustomers: boolean;
  canCreateCustomer: boolean;
  // Liên kết "Thu tiền" (/:orgSlug/thu-tien/:id): hợp đồng đã xác nhận + quyền payments.read.
  canCollect: boolean;
}

export function contractAbilities(has: (p: Permission) => boolean, status: ContractStatus | null): ContractAbilities {
  const write = has('contracts.write');
  const draft = status === null || status === 'DRAFT';
  const confirmed = status === 'CONFIRMED';
  return {
    canEdit: write && draft,
    canConfirm: write && draft,
    canAddExtra: write && confirmed,
    // Sau xác nhận, huỷ dòng làm giảm tiền → máy chủ đòi thêm contracts.adjust.
    canVoidLine: write && confirmed && has('contracts.adjust'),
    canEditNotes: write && (draft || confirmed),
    // T4: huỷ hợp đồng ĐÃ xác nhận = giảm tiền về 0 → máy chủ đòi contracts.adjust như huỷ dòng (routes.ts assertCanAdjust).
    canCancel: write && status !== null && canTransitionContract(status, 'CANCELLED') && (!confirmed || has('contracts.adjust')),
    showCatalog: has('catalog.read') && write && (draft || confirmed),
    canPickStaff: has('staff.read') && write && draft,
    canSearchCustomers: has('customers.read'),
    canCreateCustomer: has('customers.write'),
    canCollect: confirmed && has('payments.read'),
  };
}

// ---------------------------------------------------------------------------------------------
// Lỗi máy chủ
export function conflictsOf(err: unknown): AppointmentConflict[] {
  if (!(err instanceof ApiError) || err.status !== 409) return [];
  const c = (err.details as { conflicts?: unknown } | undefined)?.conflicts;
  return Array.isArray(c) ? (c as AppointmentConflict[]) : [];
}

// Lỗi 400/404 tính một dòng: details.line = vị trí dòng (từ 0).
export function errorLineOf(err: unknown): number | null {
  if (!(err instanceof ApiError)) return null;
  const line = (err.details as { line?: unknown } | undefined)?.line;
  return typeof line === 'number' ? line : null;
}

// ---------------------------------------------------------------------------------------------
// Dòng công thức phí di chuyển — CHỈ ĐỂ HIỆN CHỮ, số liệu lấy nguyên từ travelBreakdown máy chủ trả (không tự tính).
function km(x: number): string {
  return x.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export function travelFormula(t: ContractLineView<string | null> | null): string | null {
  if (!t || t.travelMode === 'MANUAL' || !t.travelBreakdown) return null;
  const b = t.travelBreakdown;
  const inc = b.includedKm ?? 0;
  const free = `Miễn phí ${km(inc)} km${b.includedFrom === 'PACKAGE' ? ' (theo gói)' : ''}`;
  if (b.excessKm === null) return 'Phí cố định';
  if (b.excessKm === 0) return `Trong bán kính miễn phí ${km(inc)} km`;
  const over = inc > 0 ? `${free} · vượt ${km(b.excessKm)} km` : `${km(b.excessKm)} km`;
  if (t.travelMode === 'PER_KM' && b.chargedKm !== null && t.perKmAmount !== null) {
    return `${over}${b.roundTrip ? ' × 2 chiều' : ''} = ${km(b.chargedKm)} km × ${formatVnd(t.perKmAmount)}`;
  }
  if (t.travelMode === 'TIERED' && b.tier) {
    const tier = b.tier.toKm === null ? `từ ${km(b.tier.fromKm)} km` : `${km(b.tier.fromKm)}–${km(b.tier.toKm)} km`;
    return `${over} · bậc ${tier}`;
  }
  return `${over} · phí cố định`;
}

// ---------------------------------------------------------------------------------------------
// Dòng gói mới từ bảng giá: nhân vật của gói, 1 người, nơi làm đầu tiên gói cho phép (Studio mặc định),
// cách tính phí di chuyển theo cài đặt của tổ chức (defaultMode).
export function newPackageLine(
  pkg: { id: string; name: string; subjectId: string | null; locationTypes: readonly LocationType[] },
  defaultStudioId: string | null,
  defaultTravelMode: TravelFeeMode,
  // Dòng đặt chỗ ngay trên: dòng mới theo sự kiện và ngày của dòng đó (bản vẽ D 3.4).
  above?: Pick<PlacedDraft, 'occasionId' | 'date'> | null,
): PlacedDraft {
  const loc = LOCATION_ORDER.find((l) => pkg.locationTypes.length === 0 || pkg.locationTypes.includes(l)) ?? null;
  return {
    key: newLineKey(),
    kind: 'PACKAGE',
    refId: pkg.id,
    name: pkg.name,
    subjectId: pkg.subjectId,
    quantity: 1,
    date: above?.date ?? '',
    occasionId: above?.occasionId ?? null,
    start: '',
    end: '',
    staff: [],
    addonIds: [],
    locationType: loc,
    studioLocationId: loc === 'STUDIO' ? defaultStudioId : null,
    address: '',
    travel: { mode: defaultTravelMode, distanceKm: null, amount: null },
    surchargeOverrides: [],
    dismissedRuleIds: [],
  };
}

/** Thợ của các dòng KHÁC trong hợp đồng chồng giờ với dòng `key` — để ô chọn thợ ghi "Dòng Cô dâu của hợp đồng này". */
export function conflictsForLine(
  draft: ContractDraft,
  key: string,
  subjectName: (id: string | null) => string | null,
): Map<string, WarnRange[]> {
  const out = new Map<string, WarnRange[]>();
  const me = draft.lines.find((l): l is PlacedDraft => isPlaced(l) && l.key === key);
  if (!me || !me.start || !me.end) return out;
  const day = dayOfLine(me, draft.eventDate);
  for (const o of draft.lines) {
    if (!isPlaced(o) || o.key === key || !o.start || !o.end) continue;
    if (dayOfLine(o, draft.eventDate) !== day) continue;
    if (!(minutes(me.start) < minutes(o.end) && minutes(o.start) < minutes(me.end))) continue;
    for (const s of o.staff) {
      const list = out.get(s.membershipId) ?? [];
      list.push({ start: o.start, end: o.end, label: `Dòng ${placedLabel(o, subjectName)} của hợp đồng này` });
      out.set(s.membershipId, list);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Phụ phí tự thêm theo luật (bản vẽ D 3.4). Máy chủ là nơi DUY NHẤT tính: web chỉ đọc `autoSurcharge` của quote và các
// dòng con `surcharges` của dòng — không cộng, không nhân tiền phụ phí.

/** Lý do luật khớp mà không sinh dòng (quote.autoSurcharge.skipped). */
export function skippedText(s: Pick<AutoSurchargeSkipped, 'reason' | 'ruleName' | 'by'>): string {
  switch (s.reason) {
    case 'NO_PRICE':
      return `Luật "${s.ruleName}" khớp nhưng phụ phí chưa có giá — chưa thêm.`;
    case 'SERVICE_UNAVAILABLE':
      return `Luật "${s.ruleName}" khớp nhưng phụ phí đang ngừng — chưa thêm.`;
    case 'MANUAL_LINE_EXISTS':
      return `Luật "${s.ruleName}" khớp nhưng đã có dòng phụ phí cùng loại nhập tay — không tự thêm để khỏi thu hai lần.`;
    case 'SAME_SERVICE':
      return `Luật "${s.ruleName}" khớp nhưng cùng phụ phí với luật "${s.by ?? ''}" đứng trước — chỉ luật đứng đầu được thêm.`;
  }
}

/** Phần người lập sửa bị máy chủ bỏ (quote.autoSurcharge.removed). */
export function removedText(r: Pick<AutoSurchargeRemoved, 'reason' | 'ruleName'>): string {
  const why = r.reason === 'RULE_INACTIVE' ? 'luật đã tắt' : r.reason === 'SAME_SERVICE' ? 'luật khác cùng phụ phí đứng trước' : 'luật không còn khớp dòng này';
  return `Đã bỏ phần bạn sửa ở luật "${r.ruleName}" vì ${why}.`;
}

export interface AutoNotes {
  skipped: AutoSurchargeSkipped[];
  removed: AutoSurchargeRemoved[];
}

/** Ghi chú của máy chủ theo vị trí dòng NHÁP (quote.line là vị trí trong bảng tính). */
export function autoNotesByDraft(plan: QuotePlan, report: AutoSurchargeReport | null | undefined): Map<number, AutoNotes> {
  const out = new Map<number, AutoNotes>();
  if (!report) return out;
  const at = (q: number) => {
    const i = draftIndexOfQuoteLine(plan, q);
    if (i === null) return null;
    let n = out.get(i);
    if (!n) {
      n = { skipped: [], removed: [] };
      out.set(i, n);
    }
    return n;
  };
  for (const s of report.skipped) at(s.line)?.skipped.push(s);
  for (const r of report.removed) at(r.line)?.removed.push(r);
  return out;
}

/** "Cô dâu · Cô dâu cao cấp" — tên dòng trong thông báo. */
export function placedLineLabel(l: Pick<PlacedDraft, 'name'>, subject: string | null): string {
  return subject && subject !== l.name ? `${subject} · ${l.name}` : l.name;
}

export interface AppliedEntry {
  lineKey: string;
  ruleId: string;
  ruleName: string;
  serviceName: string;
  label: string;
}

/** Các luật máy chủ đã áp ở lần tính này, khoá "{khoá dòng nháp}|{mã luật}". */
export function appliedEntries(
  draft: ContractDraft,
  plan: QuotePlan,
  report: AutoSurchargeReport | null | undefined,
  subjectName: (id: string | null) => string | null,
): Map<string, AppliedEntry> {
  const out = new Map<string, AppliedEntry>();
  for (const a of report?.applied ?? []) {
    const i = draftIndexOfQuoteLine(plan, a.line);
    const l = i === null ? undefined : draft.lines[i];
    if (!l || !isPlaced(l)) continue;
    out.set(`${l.key}|${a.ruleId}`, { lineKey: l.key, ruleId: a.ruleId, ruleName: a.ruleName, serviceName: a.serviceName, label: placedLineLabel(l, subjectName(l.subjectId)) });
  }
  return out;
}

export interface ToastContext {
  // Dòng còn trong nháp không (người lập bỏ cả dòng thì không báo).
  lineExists: (lineKey: string) => boolean;
  // Người lập vừa bỏ luật này ở dòng (bấm ×) thì không báo lại điều họ tự làm.
  dismissed: (lineKey: string, ruleId: string) => boolean;
  report: AutoSurchargeReport | null | undefined;
}

/** So lần tính trước với lần này → câu thông báo (bản vẽ D 3.4 "Báo thay đổi"). Luật rơi vì bị bỏ qua (skipped) đã có dải vàng ở thẻ dòng. */
export function surchargeToasts(prev: ReadonlyMap<string, AppliedEntry>, next: ReadonlyMap<string, AppliedEntry>, ctx: ToastContext): string[] {
  const out: string[] = [];
  for (const [k, e] of next) {
    if (!prev.has(k)) out.push(`Đã tự thêm ${e.serviceName} cho dòng ${e.label} theo luật ${e.ruleName}`);
  }
  for (const [k, e] of prev) {
    if (next.has(k) || !ctx.lineExists(e.lineKey) || ctx.dismissed(e.lineKey, e.ruleId)) continue;
    const skipped = (ctx.report?.skipped ?? []).some((s) => s.ruleId === e.ruleId);
    if (skipped) continue;
    const inactive = (ctx.report?.removed ?? []).some((r) => r.ruleId === e.ruleId && r.reason === 'RULE_INACTIVE');
    out.push(`Đã bỏ ${e.serviceName} ở dòng ${e.label} vì ${inactive ? 'luật đã tắt' : 'không còn khớp luật'}`);
  }
  return out;
}

/** Số luật tự thêm trong bảng tính mà bản đã lưu chưa có (dải xanh khi mở nháp cũ). Bản lưu so theo mã luật của từng dòng gói. */
export function legacyAddedCount(saved: readonly GroupedContractLine<string | null>[], draft: ContractDraft, applied: ReadonlyMap<string, AppliedEntry>): number {
  const placedSaved = saved.filter((l) => !l.voidedAt && (l.kind === 'PACKAGE' || l.kind === 'SERVICE'));
  const placedDraft = draft.lines.filter(isPlaced);
  let n = 0;
  for (const e of applied.values()) {
    const k = placedDraft.findIndex((l) => l.key === e.lineKey);
    const had = k >= 0 && (placedSaved[k]?.surcharges ?? []).some((s) => !s.voidedAt && s.surchargeRuleId === e.ruleId);
    if (!had) n += 1;
  }
  return n;
}
