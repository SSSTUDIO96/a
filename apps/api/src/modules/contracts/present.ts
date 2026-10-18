import type { Prisma, TravelFeeMode as DbTravelFeeMode } from '@prisma/client';
import { vndFromBigInt, type Vnd } from '@makeup/shared';
import { AppError } from '../../lib/errors';
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
  staffProfile: { select: { displayName: true, avatarUrl: true, tier: { select: { id: true, name: true } } } },
} satisfies Prisma.MembershipSelect;

type StaffMember = Prisma.MembershipGetPayload<{ select: typeof staffMemberSelect }>;
export type StaffMap = Map<string, StaffMember>;

function staffView(m: StaffMember, role: StaffView['role']): StaffView {
  const displayName = m.staffProfile?.displayName ?? m.user.fullName;
  return {
    membershipId: m.id,
    role,
    displayName,
    avatarUrl: m.staffProfile?.avatarUrl ?? null,
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
  return new Map(rows.map((r) => [r.id, r]));
}

// Cảnh báo lúc tư vấn (không chặn lưu nháp): thợ đã có ca trùng giờ, có ca khác trong ngày, hoặc đang được giữ ở hợp đồng nháp khác.
export interface StaffWarning {
  membershipId: string;
  level: 'OVERLAP' | 'SAME_DAY';
  overlaps: AvailabilityShift[];
  sameDay: AvailabilityShift[];
  draftHolds: DraftHold[];
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
      // Chỉ bị giữ chỗ ở hợp đồng nháp khác cũng cảnh báo: trùng giờ → OVERLAP, cùng ngày → SAME_DAY.
      const level =
        a.level !== 'FREE' ? a.level : a.draftHolds.some((h) => h.overlaps) ? 'OVERLAP' : a.draftHolds.length > 0 ? 'SAME_DAY' : null;
      if (level) warnings.push({ membershipId: a.membershipId, level, overlaps: a.overlaps, sameDay: a.sameDay, draftHolds: a.draftHolds });
    }
    out.set(t.key, warnings);
  }
  return out;
}

export function sheetWarnings(db: Prisma.TransactionClient, orgId: string, sheet: Sheet): Promise<WarningMap> {
  return staffWarnings(
    db,
    orgId,
    sheet.lines.map((l) => ({ key: l.id, start: l.scheduledStart, end: l.scheduledEnd, membershipIds: l.staff.map((s) => s.membershipId) })),
    {},
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
  addedAfterConfirm: boolean;
  voidedAt: Date | null;
  voidReason: string | null;
  staff: StaffView[];
  staffWarnings: StaffWarning[];
  // Chỉ bảng tính (xem trước) có; dòng đã lưu trả null vì database chưa lưu bán kính/bậc đã dùng.
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
    return staffView(m, s.role);
  });
  return {
    ...rest,
    id: null,
    addedAfterConfirm: false,
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

function rowView(r: LineRow, warnings: WarningMap): LineView {
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
    addedAfterConfirm: r.addedAfterConfirm,
    voidedAt: r.voidedAt,
    voidReason: r.voidReason,
    staff: r.plannedStaff.map((s) => staffView(s.membership, s.role)).sort(byRole),
    staffWarnings: warnings.get(r.id) ?? [],
    travelBreakdown: null,
  };
}

export const contractSummarySelect = {
  id: true,
  code: true,
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
    },
  });
  if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng');
  // Ca và giữ chỗ của CHÍNH hợp đồng này không tính là cảnh báo.
  const warnings = await staffWarnings(
    db,
    orgId,
    c.lines
      .filter((r) => r.voidedAt === null)
      .map((r) => ({ key: r.id, start: r.scheduledStart, end: r.scheduledEnd, membershipIds: r.plannedStaff.map((s) => s.membership.id) })),
    { contractId: c.id, appointmentIds: c.appointments.map((a) => a.id) },
  );
  const lines = group(c.lines.map((r) => ({ key: r.id, parentKey: r.parentLineId, view: rowView(r, warnings) })));
  const travelTotal = c.lines
    .filter((l) => l.kind === 'TRAVEL' && l.voidedAt === null)
    .reduce((s, l) => s + vndFromBigInt(l.lineTotal, 'phí di chuyển'), 0);
  return {
    id: c.id,
    code: c.code,
    status: c.status,
    eventDate: c.eventDate,
    subtotal: vndFromBigInt(c.subtotal, 'tạm tính'),
    discount: vndFromBigInt(c.discount, 'giảm giá'),
    total: vndFromBigInt(c.total, 'tổng'),
    depositRequired: vndFromBigInt(c.depositRequired, 'tiền cọc'),
    travelTotal,
    notes: c.notes,
    terms: c.terms,
    cancelReason: c.cancelReason,
    confirmedAt: c.confirmedAt,
    createdById: c.createdById,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    customer: c.customer,
    lines,
    appointments: c.appointments,
  };
}
