import { assertVnd, type Vnd } from './money';

// Lỗi tính tiền hợp đồng do dữ liệu nhập sai (giảm giá vượt thành tiền, thiếu số km…). Máy chủ đổi thành 400.
export class ContractMathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractMathError';
  }
}

export const CONTRACT_STATUSES = ['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
};

// Bảng chuyển trạng thái hợp đồng — máy chủ và giao diện cùng đọc.
export const CONTRACT_STATUS_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionContract(from: ContractStatus, to: ContractStatus): boolean {
  return CONTRACT_STATUS_TRANSITIONS[from].includes(to);
}

export const TRAVEL_FEE_MODES = ['FIXED', 'PER_KM', 'MANUAL'] as const;
export type TravelFeeMode = (typeof TRAVEL_FEE_MODES)[number];

export const TRAVEL_FEE_MODE_LABELS: Record<TravelFeeMode, string> = {
  FIXED: 'cố định',
  PER_KM: 'theo km',
  MANUAL: 'nhập tay',
};

// Số km lưu Decimal(7,2) → tối đa 99.999,99 km, 2 chữ số thập phân.
export const MAX_DISTANCE_KM = 99_999.99;

// Phí theo km làm tròn lên bội số này.
export const TRAVEL_ROUNDING_VND = 1_000;

function assertMoney(value: number, field: string): Vnd {
  assertVnd(value, field);
  if (value < 0) throw new ContractMathError(`${field} không được âm`);
  return value;
}

function safeMul(a: number, b: number, field: string): number {
  const r = a * b;
  if (!Number.isSafeInteger(r)) throw new ContractMathError(`${field} vượt ngưỡng cho phép`);
  return r;
}

// Đổi km sang số nguyên phần trăm km (10 m) để mọi phép tính tiền là phép tính số nguyên.
export function kmToCentiKm(km: number, field = 'Số km'): number {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) {
    throw new ContractMathError(`${field} phải là số không âm`);
  }
  if (km > MAX_DISTANCE_KM) throw new ContractMathError(`${field} tối đa ${MAX_DISTANCE_KM} km`);
  const centi = Math.round(km * 100);
  if (Math.abs(centi - km * 100) > 1e-6) {
    throw new ContractMathError(`${field} chỉ được tối đa 2 chữ số thập phân, nhận: ${km}`);
  }
  return centi;
}

export function computeLineTotal(unitPrice: Vnd, quantity: number, lineDiscount: Vnd): Vnd {
  assertMoney(unitPrice, 'Đơn giá');
  assertMoney(lineDiscount, 'Giảm giá dòng');
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new ContractMathError(`Số lượng phải là số nguyên từ 1, nhận: ${quantity}`);
  }
  const gross = safeMul(unitPrice, quantity, 'Thành tiền dòng');
  if (lineDiscount > gross) {
    throw new ContractMathError(`Giảm giá dòng (${lineDiscount}) lớn hơn thành tiền (${gross})`);
  }
  return gross - lineDiscount;
}

export interface TravelPolicy {
  fixedAmount: Vnd;
  perKmAmount: Vnd;
  freeKm: number;
  minimumAmount: Vnd;
  roundTrip: boolean;
}

export interface TravelFeeInput {
  mode: TravelFeeMode;
  distanceKm?: number;
  amount?: Vnd;
}

export interface TravelFee {
  amount: Vnd;
  mode: TravelFeeMode;
  // Km một chiều khách báo (đã kiểm 2 chữ số thập phân); null nếu không gửi.
  distanceKm: number | null;
  // Đơn giá km đã dùng; chỉ có với PER_KM.
  perKmAmount: Vnd | null;
}

export function computeTravelFee(policy: TravelPolicy, input: TravelFeeInput): TravelFee {
  const distanceCenti = input.distanceKm === undefined ? null : kmToCentiKm(input.distanceKm);
  const distanceKm = distanceCenti === null ? null : distanceCenti / 100;
  if (input.mode === 'MANUAL') {
    if (input.amount === undefined) {
      throw new ContractMathError('Phí di chuyển nhập tay phải có số tiền (miễn phí thì nhập 0)');
    }
    return { amount: assertMoney(input.amount, 'Phí di chuyển'), mode: 'MANUAL', distanceKm, perKmAmount: null };
  }
  if (input.amount !== undefined) {
    throw new ContractMathError('Chỉ cách tính nhập tay mới gửi số tiền phí di chuyển');
  }
  if (input.mode === 'FIXED') {
    const fixed = assertMoney(policy.fixedAmount, 'Phí di chuyển cố định');
    if (fixed === 0) throw new ContractMathError('Tổ chức chưa cài mức phí di chuyển cố định');
    return { amount: fixed, mode: 'FIXED', distanceKm, perKmAmount: null };
  }
  if (distanceCenti === null) throw new ContractMathError('Tính phí theo km phải có số km');
  const perKm = assertMoney(policy.perKmAmount, 'Đơn giá km');
  if (perKm === 0) throw new ContractMathError('Tổ chức chưa cài đơn giá phí di chuyển theo km');
  const minimum = assertMoney(policy.minimumAmount, 'Phí di chuyển tối thiểu');
  const freeCenti = kmToCentiKm(policy.freeKm, 'Số km miễn phí');
  const chargeable = Math.max(0, distanceCenti * (policy.roundTrip ? 2 : 1) - freeCenti);
  if (chargeable === 0) return { amount: 0, mode: 'PER_KM', distanceKm, perKmAmount: perKm };
  // tiền = (phần trăm km × đơn giá) / 100, làm tròn lên bội 1.000 đ — chia nguyên, không qua số thực.
  const raw = safeMul(chargeable, perKm, 'Phí di chuyển');
  const unit = 100 * TRAVEL_ROUNDING_VND;
  const rem = raw % unit;
  const rounded = ((raw - rem) / unit) * TRAVEL_ROUNDING_VND + (rem > 0 ? TRAVEL_ROUNDING_VND : 0);
  return { amount: Math.max(rounded, minimum), mode: 'PER_KM', distanceKm, perKmAmount: perKm };
}

export interface TotalsLine {
  lineTotal: Vnd;
  voided: boolean;
}

export function computeContractTotals(lines: readonly TotalsLine[], discount: Vnd): { subtotal: Vnd; total: Vnd } {
  assertMoney(discount, 'Giảm giá hợp đồng');
  let subtotal = 0;
  for (const l of lines) {
    assertMoney(l.lineTotal, 'Thành tiền dòng');
    if (l.voided) continue;
    subtotal += l.lineTotal;
    if (!Number.isSafeInteger(subtotal)) throw new ContractMathError('Tổng hợp đồng vượt ngưỡng cho phép');
  }
  if (discount > subtotal) {
    throw new ContractMathError(`Giảm giá hợp đồng (${discount}) lớn hơn tổng các dòng (${subtotal})`);
  }
  return { subtotal, total: subtotal - discount };
}

// Cọc gợi ý = tổng cọc mặc định của các gói (cọc gói × số lượng), không vượt tổng hợp đồng.
export function computeSuggestedDeposit(packageDeposits: readonly Vnd[], total: Vnd): Vnd {
  assertMoney(total, 'Tổng hợp đồng');
  let sum = 0;
  for (const d of packageDeposits) {
    sum += assertMoney(d, 'Tiền cọc gói');
    if (!Number.isSafeInteger(sum)) throw new ContractMathError('Tiền cọc vượt ngưỡng cho phép');
  }
  return Math.min(sum, total);
}
