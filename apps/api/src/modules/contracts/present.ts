import type { Prisma } from '@prisma/client';
import { vndFromBigInt, type Vnd } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import type { PlannedLine, Sheet } from './sheet';

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
  travelMode: PlannedLine['travelMode'];
  distanceKm: number | null;
  perKmAmount: Vnd | null;
  note: string | null;
  addedAfterConfirm: boolean;
  voidedAt: Date | null;
  voidReason: string | null;
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

function plannedView(l: PlannedLine): LineView {
  const { id: _id, parentLineId: _p, packageDeposit: _d, ...rest } = l;
  return { ...rest, id: null, addedAfterConfirm: false, voidedAt: null, voidReason: null };
}

export function presentSheet(sheet: Sheet) {
  return {
    lines: group(sheet.lines.map((l) => ({ key: l.id, parentKey: l.parentLineId, view: plannedView(l) }))),
    travelTotal: sheet.travelTotal,
    subtotal: sheet.subtotal,
    discount: sheet.discount,
    total: sheet.total,
    depositRequired: sheet.depositRequired,
    suggestedDeposit: sheet.suggestedDeposit,
  };
}

type LineRow = Prisma.ContractLineGetPayload<object>;

function rowView(r: LineRow): LineView {
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
      lines: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      appointments: {
        where: { organizationId: orgId },
        select: { id: true, code: true, startsAt: true, status: true, contractLineId: true },
        orderBy: { startsAt: 'asc' },
      },
    },
  });
  if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng');
  const lines = group(c.lines.map((r) => ({ key: r.id, parentKey: r.parentLineId, view: rowView(r) })));
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
