// Logic thuần của màn Hợp đồng (bản vẽ C mục 4.3): trạng thái nháp, dựng thân gửi máy chủ, kiểm thiếu dữ liệu,
// cảnh báo thợ 3 mức, quyền. KHÔNG tính tiền: mọi số tiền lấy từ máy chủ (quote hoặc hợp đồng đã lưu).
import { canTransitionContract, formatVnd, type Permission } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type {
  AppointmentConflict,
  AvailabilityShift,
  ContractBody,
  ContractDetail,
  ContractLineInput,
  ContractLineView,
  ContractQuote,
  GroupedContractLine,
  StaffWarning,
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

export interface PlacedDraft {
  key: string;
  kind: 'PACKAGE' | 'SERVICE';
  // packageId (gói) hoặc serviceId (dịch vụ lẻ, chỉ có khi mở hợp đồng do nơi khác lập).
  refId: string;
  name: string;
  subjectId: string | null;
  quantity: number;
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
}

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
      if (l.start !== '' && draft.eventDate === '') e.eventDate = 'Chọn ngày sự kiện để đặt giờ.';
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
// Dựng thân gửi máy chủ (quote / tạo / sửa nháp / thêm phát sinh). Gọi sau khi validateDraft không còn lỗi.
type PlacedInput = Extract<ContractLineInput, { kind: 'PACKAGE' | 'SERVICE' }> & { staff?: StaffAssignment[] };

export function travelInput(t: TravelDraft): TravelInput {
  if (t.mode === 'MANUAL') return { mode: 'MANUAL', amount: t.amount ?? 0, ...(t.distanceKm !== null ? { distanceKm: t.distanceKm } : {}) };
  return { mode: t.mode, ...(t.distanceKm !== null ? { distanceKm: t.distanceKm } : {}) };
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
  const base = {
    quantity: l.quantity,
    ...(l.subjectId ? { subjectId: l.subjectId } : {}),
    ...(l.locationType ? { locationType: l.locationType } : {}),
    ...(l.locationType === 'STUDIO' && l.studioLocationId ? { studioLocationId: l.studioLocationId } : {}),
    ...(needsTravel(l.locationType) && address ? { address } : {}),
    ...(l.start && l.end && eventDate
      ? { scheduledStart: zonedIso(eventDate, l.start, tz), scheduledEnd: zonedIso(eventDate, l.end, tz) }
      : {}),
    ...(l.addonIds.length > 0 ? { addons: l.addonIds.map((serviceId) => ({ serviceId, quantity: l.quantity })) } : {}),
    ...(needsTravel(l.locationType) ? { travel: travelInput(l.travel) } : {}),
    ...(l.staff.length > 0 ? { staff: l.staff.map((s) => ({ membershipId: s.membershipId, role: s.role })) } : {}),
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
export function patchBody(draft: ContractDraft, tz: string): ContractUpdateInput {
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
export function placedFromView(l: GroupedContractLine<string | null>, tz: string): PlacedDraft {
  const t = l.travel;
  return {
    key: l.id ?? newLineKey(),
    kind: l.kind === 'SERVICE' ? 'SERVICE' : 'PACKAGE',
    refId: (l.kind === 'SERVICE' ? l.serviceId : l.packageId) ?? '',
    name: l.name,
    subjectId: l.subjectId,
    quantity: l.quantity,
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
  };
}

export function draftFromDetail(d: ContractDetail, tz: string): ContractDraft {
  const lines: DraftLine[] = [];
  for (const l of d.lines) {
    if (l.voidedAt) continue;
    if (l.kind === 'PACKAGE' || l.kind === 'SERVICE') {
      lines.push({ ...placedFromView(l, tz), key: newLineKey() });
    } else if (l.kind === 'SURCHARGE' && l.serviceId) {
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
    eventDate: d.eventDate ? dateOf(d.eventDate, tz) : '',
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
  return live(l) + l.addons.reduce((s, a) => s + live(a), 0) + (l.travel ? live(l.travel) : 0);
}

// ---------------------------------------------------------------------------------------------
// Cảnh báo thợ — 3 mức: rảnh (không dải) / vàng SAME_DAY "có lịch trong ngày" / đỏ OVERLAP "trùng giờ".
export interface WarnRange {
  start: string;
  end: string;
  // Chi tiết cho tooltip: "L-0001 · Makeup ăn hỏi · Vũ Hồng Nhung".
  label: string;
}

export interface LineWarning {
  membershipId: string;
  level: 'OVERLAP' | 'SAME_DAY';
  // Khoảng trùng giờ (OVERLAP) hoặc các ca trong ngày (SAME_DAY).
  ranges: WarnRange[];
  // Số ca trong ngày (SAME_DAY).
  count: number;
}

function shiftLabel(s: AvailabilityShift): string {
  return [s.code, s.title, s.customerName].filter(Boolean).join(' · ');
}

function holdRange(h: DraftHold): WarnRange | null {
  if (!h.scheduledStart || !h.scheduledEnd) return null;
  return { start: h.scheduledStart, end: h.scheduledEnd, label: `${h.code} (nháp) · ${h.lineName}` };
}

/**
 * Cảnh báo máy chủ trả trong quote, bỏ phần giữ chỗ của CHÍNH hợp đồng đang sửa (quote chưa nhận excludeContractId nên
 * hợp đồng nháp đã lưu tự thấy mình là "giữ chỗ nháp"), rồi xếp lại mức đúng luật máy chủ (present.ts staffWarnings).
 */
export function serverWarnings(list: StaffWarning[] | undefined, selfContractId: string | null): LineWarning[] {
  const out: LineWarning[] = [];
  for (const w of list ?? []) {
    const holds = w.draftHolds.filter((h) => h.contractId !== selfContractId);
    const overlapHolds = holds.filter((h) => h.overlaps);
    const level: LineWarning['level'] | null =
      w.overlaps.length > 0 || overlapHolds.length > 0 ? 'OVERLAP' : w.sameDay.length > 0 || holds.length > 0 ? 'SAME_DAY' : null;
    if (!level) continue;
    const ranges =
      level === 'OVERLAP'
        ? [
            ...w.overlaps.map((s) => ({ start: s.startsAt, end: s.endsAt, label: shiftLabel(s) })),
            ...overlapHolds.map(holdRange).filter((r): r is WarnRange => r !== null),
          ]
        : [...w.sameDay.map((s) => ({ start: s.startsAt, end: s.endsAt, label: shiftLabel(s) })), ...holds.map(holdRange).filter((r): r is WarnRange => r !== null)];
    out.push({ membershipId: w.membershipId, level, ranges, count: w.sameDay.length + holds.length });
  }
  return out;
}

export interface LocalOverlap {
  membershipId: string;
  otherKey: string;
  otherLabel: string;
  start: string;
  end: string;
}

function placedLabel(l: PlacedDraft, subjectName: (id: string | null) => string | null): string {
  return subjectName(l.subjectId) ?? l.name;
}

/**
 * Thợ bị gán cho hai dòng chồng giờ TRONG CHÍNH hợp đồng này (vd cô dâu 04:30–07:00 và mẹ 05:00–05:45).
 * Máy chủ chỉ phát hiện lúc xác nhận (409), quote chưa báo — giao diện tự so khoảng giờ (không liên quan tiền).
 * Trả về theo khoá dòng; start/end là "HH:mm" của dòng kia.
 */
export function localOverlaps(draft: ContractDraft, subjectName: (id: string | null) => string | null): Map<string, LocalOverlap[]> {
  const out = new Map<string, LocalOverlap[]>();
  const placed = draft.lines.filter(isPlaced).filter((l) => l.start && l.end && minutes(l.end) > minutes(l.start));
  for (const a of placed) {
    for (const b of placed) {
      if (a === b) continue;
      if (!(minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end))) continue;
      for (const s of a.staff) {
        if (!b.staff.some((x) => x.membershipId === s.membershipId)) continue;
        const list = out.get(a.key) ?? [];
        list.push({ membershipId: s.membershipId, otherKey: b.key, otherLabel: `Dòng ${placedLabel(b, subjectName)} của hợp đồng này`, start: b.start, end: b.end });
        out.set(a.key, list);
      }
    }
  }
  return out;
}

/** Gộp cảnh báo máy chủ và trùng giờ trong hợp đồng; mỗi thợ một dải, đỏ thắng vàng. Khoảng giờ trả "HH:mm". */
export function mergeWarnings(server: LineWarning[], local: LocalOverlap[], tz: string): LineWarning[] {
  const byStaff = new Map<string, LineWarning>();
  for (const w of server) {
    byStaff.set(w.membershipId, { ...w, ranges: w.ranges.map((r) => ({ ...r, start: timeOf(r.start, tz), end: timeOf(r.end, tz) })) });
  }
  for (const o of local) {
    const prev = byStaff.get(o.membershipId);
    const range = { start: o.start, end: o.end, label: o.otherLabel };
    if (!prev || prev.level === 'SAME_DAY') byStaff.set(o.membershipId, { membershipId: o.membershipId, level: 'OVERLAP', ranges: [range], count: 0 });
    else prev.ranges.push(range);
  }
  return [...byStaff.values()].sort((a, b) => (a.level === b.level ? 0 : a.level === 'OVERLAP' ? -1 : 1));
}

export function overlapLineCount(warnings: Map<string, LineWarning[]>): number {
  let n = 0;
  for (const list of warnings.values()) if (list.some((w) => w.level === 'OVERLAP')) n += 1;
  return n;
}

export function confirmBlockedReason(overlapLines: number): string | null {
  return overlapLines > 0 ? `Còn ${overlapLines} dòng thợ trùng giờ. Đổi thợ hoặc đổi giờ trước khi xác nhận.` : null;
}

// Tên rút gọn trên hàng thợ: hai tiếng cuối ("Nguyễn Thu Hà" → "Thu Hà").
export function shortName(full: string): string {
  return full.trim().split(/\s+/).slice(-2).join(' ');
}

export function lastName(full: string): string {
  return full.trim().split(/\s+/).pop() ?? full;
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
    canCancel: write && status !== null && canTransitionContract(status, 'CANCELLED'),
    showCatalog: has('catalog.read') && write && (draft || confirmed),
    canPickStaff: has('staff.read') && write && draft,
    canSearchCustomers: has('customers.read'),
    canCreateCustomer: has('customers.write'),
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
): PlacedDraft {
  const loc = LOCATION_ORDER.find((l) => pkg.locationTypes.length === 0 || pkg.locationTypes.includes(l)) ?? null;
  return {
    key: newLineKey(),
    kind: 'PACKAGE',
    refId: pkg.id,
    name: pkg.name,
    subjectId: pkg.subjectId,
    quantity: 1,
    start: '',
    end: '',
    staff: [],
    addonIds: [],
    locationType: loc,
    studioLocationId: loc === 'STUDIO' ? defaultStudioId : null,
    address: '',
    travel: { mode: defaultTravelMode, distanceKm: null, amount: null },
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
  for (const o of draft.lines) {
    if (!isPlaced(o) || o.key === key || !o.start || !o.end) continue;
    if (!(minutes(me.start) < minutes(o.end) && minutes(o.start) < minutes(me.end))) continue;
    for (const s of o.staff) {
      const list = out.get(s.membershipId) ?? [];
      list.push({ start: o.start, end: o.end, label: `Dòng ${placedLabel(o, subjectName)} của hợp đồng này` });
      out.set(s.membershipId, list);
    }
  }
  return out;
}
