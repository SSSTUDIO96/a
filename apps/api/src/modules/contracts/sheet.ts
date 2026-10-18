import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  computeContractTotals,
  computeLineTotal,
  computeSuggestedDeposit,
  computeTravelFee,
  ContractMathError,
  TRAVEL_FEE_MODE_LABELS,
  vndFromBigInt,
  type TravelFeeMode,
  type Vnd,
} from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { resolveCurrentPrice, type PriceRef } from '../catalog/prices';
import type { LineInput, PlacedLineInput, TravelInput } from './schemas';

type Tx = Prisma.TransactionClient;
type LineKind = 'PACKAGE' | 'SERVICE' | 'ADDON' | 'SURCHARGE' | 'TRAVEL' | 'CUSTOM';
type LocationType = 'STUDIO' | 'CUSTOMER_HOME' | 'OTHER';

// Một dòng đã tính xong, chưa ghi. id sinh sẵn để dòng con trỏ được về dòng cha trong cùng một lần ghi.
export interface PlannedLine {
  id: string;
  parentLineId: string | null;
  kind: LineKind;
  serviceId: string | null;
  packageId: string | null;
  priceVersionId: string | null;
  subjectId: string | null;
  subjectName: string | null;
  name: string;
  locationType: LocationType | null;
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
  travelMode: TravelFeeMode | null;
  distanceKm: number | null;
  perKmAmount: Vnd | null;
  note: string | null;
  // Cọc mặc định của gói × số lượng (chỉ dòng gói), dùng cho cọc gợi ý.
  packageDeposit: Vnd;
}

// Đổi lỗi tính tiền của @makeup/shared thành 400 có lời rõ; lỗi khác ném nguyên.
export function money<T>(work: () => T, details?: unknown): T {
  try {
    return work();
  } catch (err) {
    if (err instanceof ContractMathError) throw new AppError('VALIDATION_FAILED', err.message, details);
    throw err;
  }
}

function bad(message: string, line: number): AppError {
  return new AppError('VALIDATION_FAILED', message, { line });
}

function missing(what: string, line: number): AppError {
  return new AppError('NOT_FOUND', `Không tìm thấy ${what}`, { line });
}

const KIND_LABEL: Record<'MAIN' | 'ADDON' | 'SURCHARGE', string> = {
  MAIN: 'dịch vụ chính',
  ADDON: 'dịch vụ phụ',
  SURCHARGE: 'phụ phí',
};

function blank(): Omit<PlannedLine, 'kind' | 'name' | 'quantity' | 'unitPrice' | 'lineDiscount' | 'lineTotal'> {
  return {
    id: randomUUID(),
    parentLineId: null,
    serviceId: null,
    packageId: null,
    priceVersionId: null,
    subjectId: null,
    subjectName: null,
    locationType: null,
    studioLocationId: null,
    address: null,
    latitude: null,
    longitude: null,
    scheduledStart: null,
    scheduledEnd: null,
    travelMode: null,
    distanceKm: null,
    perKmAmount: null,
    note: null,
    packageDeposit: 0,
  };
}

async function priceOf(tx: Tx, orgId: string, ref: PriceRef, label: string, at: Date, line: number) {
  const p = await resolveCurrentPrice(tx, orgId, ref, at);
  if (!p) throw bad(`${label} chưa có giá hiệu lực — đặt giá trong bảng giá trước khi lập hợp đồng`, line);
  return { priceVersionId: p.priceVersionId, unitPrice: vndFromBigInt(p.unitPrice, `giá ${label}`) };
}

async function loadService(tx: Tx, orgId: string, serviceId: string, expected: 'MAIN' | 'ADDON' | 'SURCHARGE', line: number) {
  const s = await tx.service.findFirst({
    where: { id: serviceId, organizationId: orgId },
    select: { id: true, name: true, kind: true, isActive: true },
  });
  if (!s) throw missing('dịch vụ', line);
  if (s.kind !== expected) {
    throw bad(`Dịch vụ "${s.name}" là ${KIND_LABEL[s.kind]}, chỗ này chỉ nhận ${KIND_LABEL[expected]}`, line);
  }
  if (!s.isActive) throw bad(`Dịch vụ "${s.name}" đang ngừng hoạt động`, line);
  return s;
}

async function loadSubject(tx: Tx, orgId: string, subjectId: string, line: number) {
  const s = await tx.makeupSubject.findFirst({
    where: { id: subjectId, organizationId: orgId },
    select: { id: true, name: true, isActive: true },
  });
  if (!s) throw missing('nhân vật makeup', line);
  if (!s.isActive) throw bad(`Nhân vật "${s.name}" đang ẩn`, line);
  return s;
}

export interface TravelPolicyNumbers {
  fixedAmount: Vnd;
  perKmAmount: Vnd;
  freeKm: number;
  minimumAmount: Vnd;
  roundTrip: boolean;
}

export async function loadTravelPolicy(tx: Tx, orgId: string): Promise<TravelPolicyNumbers> {
  const p = await tx.travelFeePolicy.findUnique({ where: { organizationId: orgId } });
  // Tổ chức nào cũng được tạo kèm cài đặt phí di chuyển; thiếu là dữ liệu hỏng, không đoán.
  if (!p) throw new Error(`Tổ chức ${orgId} thiếu cài đặt phí di chuyển`);
  return {
    fixedAmount: vndFromBigInt(p.fixedAmount, 'phí cố định'),
    perKmAmount: vndFromBigInt(p.perKmAmount, 'đơn giá km'),
    freeKm: p.freeKm.toNumber(),
    minimumAmount: vndFromBigInt(p.minimumAmount, 'phí tối thiểu'),
    roundTrip: p.roundTrip,
  };
}

interface Ctx {
  tx: Tx;
  orgId: string;
  at: Date;
  policy: () => Promise<TravelPolicyNumbers>;
}

async function planPlaced(ctx: Ctx, input: PlacedLineInput, line: number): Promise<PlannedLine[]> {
  const { tx, orgId, at } = ctx;
  let main: PlannedLine;
  let allowedLocations: LocationType[] = [];
  let includedServiceIds = new Set<string>();
  let pkgSubject: { id: string } | null = null;

  if (input.kind === 'PACKAGE') {
    const pkg = await tx.servicePackage.findFirst({
      where: { id: input.packageId, organizationId: orgId },
      select: {
        id: true,
        name: true,
        isActive: true,
        depositAmount: true,
        subjectId: true,
        locationTypes: true,
        items: { where: { isOptional: false }, select: { serviceId: true } },
      },
    });
    if (!pkg) throw missing('gói dịch vụ', line);
    if (!pkg.isActive) throw bad(`Gói "${pkg.name}" đang ngừng hoạt động`, line);
    const price = await priceOf(tx, orgId, { packageId: pkg.id }, `Gói "${pkg.name}"`, at, line);
    const lineDiscount = input.lineDiscount ?? 0;
    main = {
      ...blank(),
      kind: 'PACKAGE',
      packageId: pkg.id,
      name: pkg.name,
      quantity: input.quantity,
      ...price,
      lineDiscount,
      lineTotal: money(() => computeLineTotal(price.unitPrice, input.quantity, lineDiscount), { line }),
      packageDeposit: money(() => computeLineTotal(vndFromBigInt(pkg.depositAmount, 'cọc gói'), input.quantity, 0), { line }),
    };
    allowedLocations = pkg.locationTypes;
    includedServiceIds = new Set(pkg.items.map((i) => i.serviceId));
    pkgSubject = pkg.subjectId ? { id: pkg.subjectId } : null;
    if (pkg.subjectId && input.subjectId && input.subjectId !== pkg.subjectId) {
      const want = await tx.makeupSubject.findFirst({
        where: { id: pkg.subjectId, organizationId: orgId },
        select: { name: true },
      });
      throw bad(`Gói "${pkg.name}" chỉ dành cho nhân vật "${want?.name ?? pkg.subjectId}"`, line);
    }
  } else {
    const svc = await loadService(tx, orgId, input.serviceId, 'MAIN', line);
    const price = await priceOf(tx, orgId, { serviceId: svc.id }, `Dịch vụ "${svc.name}"`, at, line);
    const lineDiscount = input.lineDiscount ?? 0;
    main = {
      ...blank(),
      kind: 'SERVICE',
      serviceId: svc.id,
      name: svc.name,
      quantity: input.quantity,
      ...price,
      lineDiscount,
      lineTotal: money(() => computeLineTotal(price.unitPrice, input.quantity, lineDiscount), { line }),
    };
  }

  const subjectId = input.subjectId ?? pkgSubject?.id;
  if (subjectId) {
    const s = await loadSubject(tx, orgId, subjectId, line);
    main.subjectId = s.id;
    main.subjectName = s.name;
  }

  // Địa điểm và phí di chuyển.
  const loc = input.locationType;
  if (allowedLocations.length > 0) {
    if (!loc) throw bad(`Gói "${main.name}" giới hạn địa điểm — phải chọn locationType (${allowedLocations.join(', ')})`, line);
    if (!allowedLocations.includes(loc)) {
      throw bad(`Gói "${main.name}" không áp dụng địa điểm ${loc}; chỉ nhận: ${allowedLocations.join(', ')}`, line);
    }
  }
  if (input.studioLocationId && loc !== 'STUDIO') throw bad('Chỉ chọn studio khi địa điểm là STUDIO', line);
  // Có địa chỉ/toạ độ mà không chọn loại địa điểm thì không biết có tính phí di chuyển không — bắt chọn, không đoán.
  if (!loc && (input.address !== undefined || input.latitude !== undefined || input.longitude !== undefined)) {
    throw bad(`Chọn địa điểm cho dòng có địa chỉ "${main.name}" (STUDIO, CUSTOMER_HOME hoặc OTHER)`, line);
  }
  if (input.travel && loc !== 'CUSTOMER_HOME' && loc !== 'OTHER') {
    throw bad(
      loc === 'STUDIO'
        ? `Dòng "${main.name}" làm tại studio không tính phí di chuyển`
        : `Dòng "${main.name}" có phí di chuyển thì phải chọn địa điểm CUSTOMER_HOME hoặc OTHER`,
      line,
    );
  }
  if ((loc === 'CUSTOMER_HOME' || loc === 'OTHER') && !input.travel) {
    throw bad(
      `Dòng "${main.name}" làm tại nhà khách/địa điểm khác phải có phí di chuyển (miễn phí: chọn MANUAL với amount 0)`,
      line,
    );
  }
  if (loc === 'STUDIO') {
    const studio = input.studioLocationId
      ? await tx.studioLocation.findFirst({ where: { id: input.studioLocationId, organizationId: orgId } })
      : await tx.studioLocation.findFirst({ where: { organizationId: orgId, isDefault: true, isActive: true } });
    if (input.studioLocationId && !studio) throw missing('studio', line);
    if (studio && !studio.isActive) throw bad(`Studio "${studio.name}" đang ngừng hoạt động`, line);
    main.studioLocationId = studio?.id ?? null;
  }
  main.locationType = loc ?? null;
  main.address = input.address ?? null;
  main.latitude = input.latitude ?? null;
  main.longitude = input.longitude ?? null;
  main.scheduledStart = input.scheduledStart ? new Date(input.scheduledStart) : null;
  main.scheduledEnd = input.scheduledEnd ? new Date(input.scheduledEnd) : null;
  if (main.scheduledStart && main.scheduledEnd && main.scheduledEnd <= main.scheduledStart) {
    throw bad('Giờ kết thúc phải sau giờ bắt đầu', line);
  }
  main.note = input.note ?? null;

  const out: PlannedLine[] = [main];
  for (const a of input.addons ?? []) {
    const svc = await loadService(tx, orgId, a.serviceId, 'ADDON', line);
    if (includedServiceIds.has(svc.id)) {
      throw bad(`Dịch vụ phụ "${svc.name}" đã có sẵn trong gói "${main.name}" — không tính thêm lần nữa`, line);
    }
    const price = await priceOf(tx, orgId, { serviceId: svc.id }, `Dịch vụ phụ "${svc.name}"`, at, line);
    out.push({
      ...blank(),
      parentLineId: main.id,
      kind: 'ADDON',
      serviceId: svc.id,
      name: svc.name,
      quantity: a.quantity,
      ...price,
      lineDiscount: 0,
      lineTotal: money(() => computeLineTotal(price.unitPrice, a.quantity, 0), { line }),
    });
  }
  if (input.travel) out.push(await planTravel(ctx, main, input.travel, line));
  return out;
}

async function planTravel(ctx: Ctx, parent: PlannedLine, travel: TravelInput, line: number): Promise<PlannedLine> {
  const policy = await ctx.policy();
  const fee = money(() => computeTravelFee(policy, travel), { line });
  return {
    ...blank(),
    parentLineId: parent.id,
    kind: 'TRAVEL',
    name: `Phí di chuyển (${TRAVEL_FEE_MODE_LABELS[fee.mode]})`,
    quantity: 1,
    unitPrice: fee.amount,
    lineDiscount: 0,
    lineTotal: fee.amount,
    travelMode: fee.mode,
    distanceKm: fee.distanceKm,
    perKmAmount: fee.perKmAmount,
    note: travel.note ?? null,
  };
}

async function planOne(ctx: Ctx, input: LineInput, line: number): Promise<PlannedLine[]> {
  switch (input.kind) {
    case 'PACKAGE':
    case 'SERVICE':
      return planPlaced(ctx, input, line);
    case 'SURCHARGE': {
      const svc = await loadService(ctx.tx, ctx.orgId, input.serviceId, 'SURCHARGE', line);
      // Ghi đè giá thì không trỏ về phiên bản giá (giá dòng không đến từ bảng giá); lý do nằm ở ghi chú.
      const price =
        input.unitPrice === undefined
          ? await priceOf(ctx.tx, ctx.orgId, { serviceId: svc.id }, `Phụ phí "${svc.name}"`, ctx.at, line)
          : { priceVersionId: null, unitPrice: input.unitPrice };
      return [
        {
          ...blank(),
          kind: 'SURCHARGE',
          serviceId: svc.id,
          name: svc.name,
          quantity: input.quantity,
          ...price,
          lineDiscount: 0,
          lineTotal: money(() => computeLineTotal(price.unitPrice, input.quantity, 0), { line }),
          note: input.note ?? null,
        },
      ];
    }
    case 'CUSTOM':
      return [
        {
          ...blank(),
          kind: 'CUSTOM',
          name: input.name,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          lineDiscount: 0,
          lineTotal: money(() => computeLineTotal(input.unitPrice, input.quantity, 0), { line }),
          note: input.note ?? null,
        },
      ];
  }
}

// Tính các dòng từ dữ liệu nhập: kiểm tham chiếu thuộc tổ chức, chốt giá hiện hành, sinh dòng dịch vụ phụ và phí di chuyển.
// `line` trong lỗi là vị trí dòng (bắt đầu từ 0) trong mảng gửi lên.
export async function planLines(tx: Tx, orgId: string, inputs: LineInput[], at: Date, firstIndex = 0): Promise<PlannedLine[]> {
  let cached: TravelPolicyNumbers | null = null;
  const ctx: Ctx = {
    tx,
    orgId,
    at,
    policy: async () => (cached ??= await loadTravelPolicy(tx, orgId)),
  };
  const out: PlannedLine[] = [];
  for (const [i, input] of inputs.entries()) out.push(...(await planOne(ctx, input, firstIndex + i)));
  return out;
}

export interface Sheet {
  lines: PlannedLine[];
  travelTotal: Vnd;
  subtotal: Vnd;
  discount: Vnd;
  total: Vnd;
  depositRequired: Vnd;
  suggestedDeposit: Vnd;
}

// HÀM DỰNG BẢNG TÍNH DUY NHẤT: xem trước (quote), tạo và thay toàn bộ dòng khi sửa nháp đều gọi hàm này.
export async function buildSheet(
  tx: Tx,
  orgId: string,
  input: { lines: LineInput[]; discount: Vnd; depositRequired?: Vnd },
  at: Date,
): Promise<Sheet> {
  const lines = await planLines(tx, orgId, input.lines, at);
  const { subtotal, total } = money(() =>
    computeContractTotals(
      lines.map((l) => ({ lineTotal: l.lineTotal, voided: false })),
      input.discount,
    ),
  );
  const suggestedDeposit = money(() =>
    computeSuggestedDeposit(
      lines.map((l) => l.packageDeposit),
      total,
    ),
  );
  if (input.depositRequired !== undefined && input.depositRequired > total) {
    throw new AppError('VALIDATION_FAILED', `Tiền cọc (${input.depositRequired}) không được lớn hơn tổng hợp đồng (${total})`);
  }
  const travelTotal = lines.filter((l) => l.kind === 'TRAVEL').reduce((s, l) => s + l.lineTotal, 0);
  return {
    lines,
    travelTotal,
    subtotal,
    discount: input.discount,
    total,
    depositRequired: input.depositRequired ?? suggestedDeposit,
    suggestedDeposit,
  };
}

// Ghi các dòng đã tính vào database bằng một lệnh; dòng cha đứng trước dòng con trong mảng.
export async function insertLines(
  tx: Tx,
  args: { orgId: string; contractId: string; userId: string; lines: PlannedLine[]; firstSort: number; addedAfterConfirm: boolean },
) {
  if (args.lines.length === 0) return;
  await tx.contractLine.createMany({
    data: args.lines.map((l, i) => ({
      id: l.id,
      organizationId: args.orgId,
      contractId: args.contractId,
      parentLineId: l.parentLineId,
      kind: l.kind,
      serviceId: l.serviceId,
      packageId: l.packageId,
      priceVersionId: l.priceVersionId,
      subjectId: l.subjectId,
      subjectName: l.subjectName,
      name: l.name,
      locationType: l.locationType,
      studioLocationId: l.studioLocationId,
      address: l.address,
      latitude: l.latitude === null ? null : new Prisma.Decimal(l.latitude),
      longitude: l.longitude === null ? null : new Prisma.Decimal(l.longitude),
      scheduledStart: l.scheduledStart,
      scheduledEnd: l.scheduledEnd,
      quantity: l.quantity,
      unitPrice: BigInt(l.unitPrice),
      lineDiscount: BigInt(l.lineDiscount),
      lineTotal: BigInt(l.lineTotal),
      travelMode: l.travelMode,
      distanceKm: l.distanceKm === null ? null : new Prisma.Decimal(l.distanceKm.toFixed(2)),
      perKmAmount: l.perKmAmount === null ? null : BigInt(l.perKmAmount),
      note: l.note,
      sortOrder: args.firstSort + i,
      addedAfterConfirm: args.addedAfterConfirm,
      createdById: args.userId,
    })),
  });
}
