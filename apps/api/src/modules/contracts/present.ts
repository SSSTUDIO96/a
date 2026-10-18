import type { Prisma, TravelFeeMode as DbTravelFeeMode } from '@prisma/client';
import { vndFromBigInt, type Vnd } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { avatarSelect, resolveAvatarUrls, type AvatarSource } from '../files/service';
import { initialsOf } from '../staff/common';
import { staffAvailabilityTx, type AvailabilityShift, type DraftHold } from '../staff/availability';
import type { PlannedLine, Sheet, TravelBreakdown } from './sheet';

// Thợ phụ trách dự kiến của dòng, đủ để giao diện hiện ảnh/chữ viết tắt và bậc.
export interface StaffView {
  membershipId: string;
  role: 'PRIMARY' | 'ASSIST';
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  tier: { id: string; name: string } | null;
}

const staffMemberSelect = {
  id: true,
  user: { select: { fullName: true } },
  staffProfile: { select: { displayName: true, ...avatarSelect, tier: { select: { id: true, name: true } } } },
} satisfies Prisma.MembershipSelect;

type StaffMember = Prisma.MembershipGetPayload<{ select: typeof staffMemberSelect }>;
// Ảnh đại diện đã đổi sẵn thành URL ký có hạn lúc nạp (presentSheet chạy đồng bộ, không tự truy vấn được).
type ResolvedMember = StaffMember & { avatar: string | null };
export type StaffMap = Map<string, ResolvedMember>;
type AvatarOf = (p: AvatarSource | null | undefined) => string | null;

// Ảnh đại diện thợ trong hợp đồng đi qua đúng hàm dùng chung resolveAvatarUrls (modules/files) như danh sách thợ —
// không đọc thẳng avatar_url (từng lộ chuỗi tạm "file:<id>" thay vì URL ký).
function staffView(m: StaffMember, role: StaffView['role'], avatarOf: AvatarOf): StaffView {
  const displayName = m.staffProfile?.displayName ?? m.user.fullName;
  return {
    membershipId: m.id,
    role,
    displayName,
    avatarUrl: avatarOf(m.staffProfile),
    initials: initialsOf(displayName),
    tier: m.staffProfile?.tier ?? null,
  };
}

const byRole = (a: StaffView, b: StaffView) => (a.role === b.role ? 0 : a.role === 'PRIMARY' ? -1 : 1);

// Thông tin hiển thị cho các thợ của bảng tính chưa ghi (xem trước).
export async function loadStaffMap(db: Prisma.TransactionClient, orgId: string, sheet: Sheet): Promise<StaffMap> {
  const ids = [...new Set(sheet.lines.flatMap((l) => l.staff.map((s) => s.membershipId)))];
  if (ids.length === 0) return new Map();
  const rows = await db.membership.findMany({ where: { id: { in: ids }, organizationId: orgId }, select: staffMemberSelect });
  const avatarOf = await resolveAvatarUrls(
    db,
    orgId,
    rows.map((r) => r.staffProfile),
  );
  return new Map(rows.map((r) => [r.id, { ...r, avatar: avatarOf(r.staffProfile) }]));
}

// Cảnh báo lúc tư vấn (không chặn lưu nháp): thợ đã có ca trùng giờ, có ca khác trong ngày, hoặc đang được giữ ở hợp đồng nháp khác.
export interface StaffWarning {
  membershipId: string;
  // OVERLAP (đỏ, chặn xác nhận): trùng giờ với lịch ĐÃ chiếm giờ thật, hoặc với dòng khác của chính hợp đồng (sameContract).
  // SAME_DAY (vàng): có lịch thật khác trong cùng ngày.
  // DRAFT_HOLD (xám, KHÔNG chặn): thợ chỉ đang được giữ chỗ ở hợp đồng NHÁP khác — nháp không chiếm giờ (nhật ký quyết định
  // 15:14, nhắc lại 22:10; biên bản nghiệm thu web 2, T1). draftHolds[].overlaps cho biết trùng giờ hay chỉ cùng ngày.
  level: 'OVERLAP' | 'SAME_DAY' | 'DRAFT_HOLD';
  overlaps: AvailabilityShift[];
  sameDay: AvailabilityShift[];
  draftHolds: DraftHold[];
  // Trùng giờ với dòng KHÁC của CHÍNH hợp đồng này (một thợ ở hai dòng chồng giờ) — luôn mức OVERLAP (đỏ).
  sameContract: SameContractHit[];
}

export interface SameContractHit {
  // id dòng đã lưu; null ở bảng tính xem trước (dòng chưa có id).
  lineId: string | null;
  // Vị trí dòng gốc trong mảng `lines` của phản hồi (bắt đầu từ 0).
  lineIndex: number;
  lineName: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

export type WarningMap = Map<string, StaffWarning[]>;

interface WarnTarget {
  key: string;
  start: Date | null;
  end: Date | null;
  membershipIds: string[];
}

export async function staffWarnings(
  db: Prisma.TransactionClient,
  orgId: string,
  targets: WarnTarget[],
  exclude: { contractId?: string; appointmentIds?: string[] },
): Promise<WarningMap> {
  const out: WarningMap = new Map();
  for (const t of targets) {
    if (!t.start || !t.end || t.membershipIds.length === 0) continue;
    const items = await staffAvailabilityTx(db, orgId, {
      startsAt: t.start,
      endsAt: t.end,
      membershipIds: t.membershipIds,
      excludeContractId: exclude.contractId,
      excludeAppointmentIds: exclude.appointmentIds,
    });
    const warnings: StaffWarning[] = [];
    for (const a of items) {
      // Mức theo lịch THẬT; chỉ bị giữ chỗ ở hợp đồng nháp khác → DRAFT_HOLD (nhắc, không chặn — xác nhận vẫn được).
      const level = a.level !== 'FREE' ? a.level : a.draftHolds.length > 0 ? 'DRAFT_HOLD' : null;
      if (level) {
        warnings.push({ membershipId: a.membershipId, level, overlaps: a.overlaps, sameDay: a.sameDay, draftHolds: a.draftHolds, sameContract: [] });
      }
    }
    out.set(t.key, warnings);
  }
  return out;
}

interface IntraTarget extends WarnTarget {
  lineId: string | null;
  lineIndex: number;
  name: string;
}

// Trùng giờ GIỮA CÁC DÒNG của cùng hợp đồng: cùng thợ, hai khoảng [bắt đầu, kết thúc) giao nhau → OVERLAP ở CẢ HAI dòng.
// Gộp vào cảnh báo sẵn có của thợ đó (nâng mức lên OVERLAP) hoặc thêm cảnh báo mới.
export function addSameContractWarnings(warnings: WarningMap, targets: IntraTarget[]): WarningMap {
  const timed = targets.filter((t): t is IntraTarget & { start: Date; end: Date } => t.start !== null && t.end !== null);
  for (const a of timed) {
    for (const b of timed) {
      if (a === b || a.start >= b.end || b.start >= a.end) continue;
      for (const m of a.membershipIds) {
        if (!b.membershipIds.includes(m)) continue;
        const hit: SameContractHit = { lineId: b.lineId, lineIndex: b.lineIndex, lineName: b.name, scheduledStart: b.start, scheduledEnd: b.end };
        const list = warnings.get(a.key) ?? [];
        const w = list.find((x) => x.membershipId === m);
        if (w) {
          w.level = 'OVERLAP';
          w.sameContract.push(hit);
        } else {
          list.push({ membershipId: m, level: 'OVERLAP', overlaps: [], sameDay: [], draftHolds: [], sameContract: [hit] });
        }
        warnings.set(a.key, list);
      }
    }
  }
  return warnings;
}

// Cảnh báo của bảng tính xem trước. exclude: hợp đồng đang sửa (giữ chỗ nháp + lịch của chính nó không tính).
export async function sheetWarnings(
  db: Prisma.TransactionClient,
  orgId: string,
  sheet: Sheet,
  exclude: { contractId?: string; appointmentIds?: string[] } = {},
): Promise<WarningMap> {
  const targets = sheet.lines.map((l) => ({ key: l.id, start: l.scheduledStart, end: l.scheduledEnd, membershipIds: l.staff.map((s) => s.membershipId) }));
  const warnings = await staffWarnings(db, orgId, targets, exclude);
  const rootIndex = new Map(sheet.lines.filter((l) => l.parentLineId === null).map((l, i) => [l.id, i]));
  return addSameContractWarnings(
    warnings,
    sheet.lines.flatMap((l, i) => {
      const lineIndex = rootIndex.get(l.id);
      return lineIndex === undefined ? [] : [{ ...targets[i]!, lineId: null, lineIndex, name: l.name }];
    }),
  );
}

// Một dòng trả ra JSON: tiền là số nguyên đồng, km và toạ độ là số — không để BigInt/Decimal lọt ra.
export interface LineView {
  id: string | null;
  kind: PlannedLine['kind'];
  name: string;
  serviceId: string | null;
  packageId: string | null;
  priceVersionId: string | null;
  subjectId: string | null;
  subjectName: string | null;
  locationType: PlannedLine['locationType'];
  studioLocationId: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  quantity: number;
  unitPrice: Vnd;
  lineDiscount: Vnd;
  lineTotal: Vnd;
  // Theo enum database (đọc được cả cách tính mới như TIERED); dòng do module này tạo chỉ dùng FIXED/PER_KM/MANUAL.
  travelMode: DbTravelFeeMode | null;
  distanceKm: number | null;
  perKmAmount: Vnd | null;
  note: string | null;
  // Lớp của dòng khoá học (chỉ dòng COURSE).
  courseClassId: string | null;
  addedAfterConfirm: boolean;
  // Lúc thêm dòng (web ghi "Phát sinh {ngày}"); null ở bảng tính xem trước.
  createdAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  staff: StaffView[];
  staffWarnings: StaffWarning[];
  // Dòng TRAVEL: số liệu dựng dòng công thức km. Dòng đã lưu đọc từ số liệu đã chụp lúc lưu (migration
  // 20261018240000); dòng TRAVEL lưu trước đó không có số liệu chụp → null.
  travelBreakdown: TravelBreakdown | null;
}

export interface GroupedLine extends LineView {
  addons: LineView[];
  travel: LineView | null;
}

interface Keyed {
  key: string;
  parentKey: string | null;
  view: LineView;
}

function group(items: Keyed[]): GroupedLine[] {
  const roots = new Map<string, GroupedLine>();
  for (const it of items) {
    if (it.parentKey === null) roots.set(it.key, { ...it.view, addons: [], travel: null });
  }
  for (const it of items) {
    if (it.parentKey === null) continue;
    const parent = roots.get(it.parentKey);
    if (!parent) throw new Error(`Dòng ${it.key} trỏ tới dòng cha ${it.parentKey} không phải dòng gốc của hợp đồng`);
    if (it.view.kind === 'TRAVEL') {
      if (parent.travel) throw new Error(`Dòng ${it.parentKey} có hơn một dòng phí di chuyển`);
      parent.travel = it.view;
    } else {
      parent.addons.push(it.view);
    }
  }
  return [...roots.values()];
}

function plannedView(l: PlannedLine, staff: StaffMap, warnings: WarningMap): LineView {
  const { id: _id, parentLineId: _p, packageDeposit: _d, staff: assigned, ...rest } = l;
  const views = assigned.map((s) => {
    const m = staff.get(s.membershipId);
    // Thợ đã qua kiểm ở bảng tính; thiếu ở đây là lỗi lắp ráp, không đoán.
    if (!m) throw new Error(`Thiếu thông tin thợ ${s.membershipId} khi trình bày bảng tính`);
    return staffView(m, s.role, () => m.avatar);
  });
  return {
    ...rest,
    id: null,
    addedAfterConfirm: false,
    createdAt: null,
    voidedAt: null,
    voidReason: null,
    staff: views.sort(byRole),
    staffWarnings: warnings.get(l.id) ?? [],
  };
}

export function presentSheet(sheet: Sheet, staff: StaffMap, warnings: WarningMap) {
  return {
    lines: group(sheet.lines.map((l) => ({ key: l.id, parentKey: l.parentLineId, view: plannedView(l, staff, warnings) }))),
    travelTotal: sheet.travelTotal,
    subtotal: sheet.subtotal,
    discount: sheet.discount,
    total: sheet.total,
    depositRequired: sheet.depositRequired,
    suggestedDeposit: sheet.suggestedDeposit,
  };
}

const lineInclude = {
  plannedStaff: { select: { role: true, membership: { select: staffMemberSelect } } },
} satisfies Prisma.ContractLineInclude;

type LineRow = Prisma.ContractLineGetPayload<{ include: typeof lineInclude }>;

const num = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

// Dựng lại travelBreakdown từ số liệu đã chụp. round_trip luôn có ở dòng TRAVEL lưu từ migration 20261018240000 trở đi.
function savedBreakdown(r: LineRow): TravelBreakdown | null {
  if (r.kind !== 'TRAVEL' || r.roundTrip === null) return null;
  return {
    includedKm: num(r.includedKm),
    includedFrom: r.includedFrom === 'PACKAGE' || r.includedFrom === 'ORGANIZATION' ? r.includedFrom : null,
    excessKm: num(r.excessKm),
    chargedKm: num(r.chargedKm),
    roundTrip: r.roundTrip,
    tier:
      r.tierFromKm === null || r.tierAmount === null
        ? null
        : { fromKm: r.tierFromKm.toNumber(), toKm: num(r.tierToKm), amount: vndFromBigInt(r.tierAmount, 'phí theo bậc') },
  };
}

function rowView(r: LineRow, warnings: WarningMap, avatarOf: AvatarOf): LineView {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    serviceId: r.serviceId,
    packageId: r.packageId,
    priceVersionId: r.priceVersionId,
    subjectId: r.subjectId,
    subjectName: r.subjectName,
    locationType: r.locationType,
    studioLocationId: r.studioLocationId,
    address: r.address,
    latitude: r.latitude === null ? null : r.latitude.toNumber(),
    longitude: r.longitude === null ? null : r.longitude.toNumber(),
    scheduledStart: r.scheduledStart,
    scheduledEnd: r.scheduledEnd,
    quantity: r.quantity,
    unitPrice: vndFromBigInt(r.unitPrice, 'đơn giá'),
    lineDiscount: vndFromBigInt(r.lineDiscount, 'giảm giá dòng'),
    lineTotal: vndFromBigInt(r.lineTotal, 'thành tiền dòng'),
    travelMode: r.travelMode,
    distanceKm: r.distanceKm === null ? null : r.distanceKm.toNumber(),
    perKmAmount: r.perKmAmount === null ? null : vndFromBigInt(r.perKmAmount, 'đơn giá km'),
    note: r.note,
    courseClassId: r.courseClassId,
    addedAfterConfirm: r.addedAfterConfirm,
    createdAt: r.createdAt,
    voidedAt: r.voidedAt,
    voidReason: r.voidReason,
    staff: r.plannedStaff.map((s) => staffView(s.membership, s.role, avatarOf)).sort(byRole),
    staffWarnings: warnings.get(r.id) ?? [],
    travelBreakdown: savedBreakdown(r),
  };
}

export const contractSummarySelect = {
  id: true,
  code: true,
  kind: true,
  status: true,
  eventDate: true,
  subtotal: true,
  discount: true,
  total: true,
  depositRequired: true,
  confirmedAt: true,
  createdAt: true,
  customer: { select: { id: true, fullName: true, phone: true } },
} satisfies Prisma.ContractSelect;

type SummaryRow = Prisma.ContractGetPayload<{ select: typeof contractSummarySelect }>;

export function presentSummary(c: SummaryRow) {
  return {
    ...c,
    subtotal: vndFromBigInt(c.subtotal, 'tạm tính'),
    discount: vndFromBigInt(c.discount, 'giảm giá'),
    total: vndFromBigInt(c.total, 'tổng'),
    depositRequired: vndFromBigInt(c.depositRequired, 'tiền cọc'),
  };
}

// Hợp đồng đầy đủ: khách, các dòng (dịch vụ phụ và phí di chuyển gom dưới dòng cha, kể cả dòng đã huỷ), lịch đã gắn.
export async function loadContractDetail(db: Prisma.TransactionClient, orgId: string, contractId: string) {
  const c = await db.contract.findFirst({
    where: { id: contractId, organizationId: orgId },
    include: {
      customer: { select: { id: true, fullName: true, phone: true, email: true } },
      lines: { include: lineInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      appointments: {
        where: { organizationId: orgId },
        select: { id: true, code: true, startsAt: true, status: true, contractLineId: true },
        orderBy: { startsAt: 'asc' },
      },
      enrollments: {
        where: { organizationId: orgId },
        select: { id: true, contractLineId: true, courseClassId: true, status: true, enrolledAt: true, cancelledAt: true, cancelReason: true },
        orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
  if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng');
  // Ca và giữ chỗ của CHÍNH hợp đồng này không tính là cảnh báo; trùng giờ giữa hai dòng của chính nó thì có.
  const active = c.lines.filter((r) => r.voidedAt === null);
  const targets = active.map((r) => ({ key: r.id, start: r.scheduledStart, end: r.scheduledEnd, membershipIds: r.plannedStaff.map((s) => s.membership.id) }));
  const rootIndex = new Map(c.lines.filter((r) => r.parentLineId === null).map((r, i) => [r.id, i]));
  const warnings = addSameContractWarnings(
    await staffWarnings(db, orgId, targets, { contractId: c.id, appointmentIds: c.appointments.map((a) => a.id) }),
    active.flatMap((r, i) => {
      const lineIndex = rootIndex.get(r.id);
      return lineIndex === undefined ? [] : [{ ...targets[i]!, lineId: r.id, lineIndex, name: r.name }];
    }),
  );
  const avatarOf = await resolveAvatarUrls(
    db,
    orgId,
    c.lines.flatMap((r) => r.plannedStaff.map((s) => s.membership.staffProfile)),
  );
  const lines = group(c.lines.map((r) => ({ key: r.id, parentKey: r.parentLineId, view: rowView(r, warnings, avatarOf) })));
  const travelTotal = c.lines
    .filter((l) => l.kind === 'TRAVEL' && l.voidedAt === null)
    .reduce((s, l) => s + vndFromBigInt(l.lineTotal, 'phí di chuyển'), 0);
  return {
    id: c.id,
    code: c.code,
    kind: c.kind,
    status: c.status,
    ownerMembershipId: c.ownerMembershipId,
    eventDate: c.eventDate,
    subtotal: vndFromBigInt(c.subtotal, 'tạm tính'),
    discount: vndFromBigInt(c.discount, 'giảm giá'),
    total: vndFromBigInt(c.total, 'tổng'),
    depositRequired: vndFromBigInt(c.depositRequired, 'tiền cọc'),
    travelTotal,
    notes: c.notes,
    terms: c.terms,
    // Nội quy (chỉ hợp đồng khoá học) và mẫu đã chọn / đã chụp (id + phiên bản). Sau xác nhận: bản chụp, không đổi theo mẫu.
    rules: c.rules,
    termsTemplateId: c.termsTemplateId,
    termsTemplateVersion: c.termsTemplateVersion,
    rulesTemplateId: c.rulesTemplateId,
    rulesTemplateVersion: c.rulesTemplateVersion,
    cancelReason: c.cancelReason,
    confirmedAt: c.confirmedAt,
    createdById: c.createdById,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    customer: c.customer,
    lines,
    appointments: c.appointments,
    enrollments: c.enrollments,
  };
}
