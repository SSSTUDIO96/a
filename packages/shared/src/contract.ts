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

export const TRAVEL_FEE_MODES = ['FIXED', 'PER_KM', 'MANUAL', 'TIERED'] as const;
export type TravelFeeMode = (typeof TRAVEL_FEE_MODES)[number];

export const TRAVEL_FEE_MODE_LABELS: Record<TravelFeeMode, string> = {
  FIXED: 'cố định',
  PER_KM: 'theo km',
  MANUAL: 'nhập tay',
  TIERED: 'theo bậc khoảng cách',
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

// Bậc phí theo khoảng cách MỘT CHIỀU, khoảng nửa mở [fromKm, toKm); toKm null = từ fromKm trở lên.
export interface TravelTier {
  fromKm: number;
  toKm: number | null;
  amount: Vnd;
}

export interface TravelPolicy {
  fixedAmount: Vnd;
  perKmAmount: Vnd;
  // Bán kính miễn phí chung của tổ chức (km một chiều) — dùng khi gói không đặt bán kính riêng.
  freeKm: number;
  minimumAmount: Vnd;
  roundTrip: boolean;
  tiers: readonly TravelTier[];
}

export interface TravelFeeInput {
  mode: TravelFeeMode;
  distanceKm?: number;
  amount?: Vnd;
  // Bán kính miễn phí của gói (km một chiều); không gửi = theo freeKm của tổ chức.
  includedKm?: number;
}

export interface TravelFee {
  amount: Vnd;
  mode: TravelFeeMode;
  // Km một chiều khách báo (đã kiểm 2 chữ số thập phân); null nếu không gửi.
  distanceKm: number | null;
  // Đơn giá km đã dùng; chỉ có với PER_KM.
  perKmAmount: Vnd | null;
  // Bán kính miễn phí đã áp (km một chiều); null với nhập tay.
  includedKm: number | null;
  // Km vượt bán kính, MỘT CHIỀU; null khi không có số km hoặc nhập tay.
  excessKm: number | null;
  // Km tính tiền của PER_KM = km vượt × (khứ hồi ? 2 : 1); null với cách khác.
  chargedKm: number | null;
  roundTrip: boolean;
  // Bậc đã áp (chỉ TIERED, khi vượt bán kính).
  tier: TravelTier | null;
}

function findTier(tiers: readonly TravelTier[], distanceCenti: number): TravelTier | null {
  for (const t of tiers) {
    const from = kmToCentiKm(t.fromKm, 'Km bắt đầu của bậc');
    const to = t.toKm === null ? null : kmToCentiKm(t.toKm, 'Km kết thúc của bậc');
    if (distanceCenti >= from && (to === null || distanceCenti < to)) return t;
  }
  return null;
}

// Luật bán kính: khoảng cách một chiều ≤ bán kính miễn phí → 0 đ với mọi cách tính trừ nhập tay.
// PER_KM giữ quy ước cũ (làm tròn lên 1.000 đ, không thấp hơn mức tối thiểu) nhưng phần trừ đi là BÁN KÍNH
// (của gói, hoặc freeKm chung), và khứ hồi nhân đôi CẢ khoảng cách lẫn bán kính: (km − bán kính) × (khứ hồi ? 2 : 1).
export function computeTravelFee(policy: TravelPolicy, input: TravelFeeInput): TravelFee {
  const distanceCenti = input.distanceKm === undefined ? null : kmToCentiKm(input.distanceKm);
  const distanceKm = distanceCenti === null ? null : distanceCenti / 100;
  const base = { distanceKm, perKmAmount: null, includedKm: null, excessKm: null, chargedKm: null, roundTrip: policy.roundTrip, tier: null };
  if (input.mode === 'MANUAL') {
    if (input.amount === undefined) {
      throw new ContractMathError('Phí di chuyển nhập tay phải có số tiền (miễn phí thì nhập 0)');
    }
    return { ...base, amount: assertMoney(input.amount, 'Phí di chuyển'), mode: 'MANUAL' };
  }
  if (input.amount !== undefined) {
    throw new ContractMathError('Chỉ cách tính nhập tay mới gửi số tiền phí di chuyển');
  }
  const includedCenti = kmToCentiKm(input.includedKm ?? policy.freeKm, 'Bán kính miễn phí');
  const includedKm = includedCenti / 100;
  if (distanceCenti === null) {
    // Cố định không cần km khi không có bán kính miễn phí; có bán kính thì phải biết km mới xét được — không đoán.
    if (input.mode === 'FIXED' && includedCenti === 0) {
      return { ...base, includedKm, amount: fixedOf(policy), mode: 'FIXED' };
    }
    throw new ContractMathError(
      input.mode === 'FIXED'
        ? `Cần số km để xét bán kính miễn phí ${includedKm} km`
        : `Tính phí ${TRAVEL_FEE_MODE_LABELS[input.mode]} phải có số km`,
    );
  }
  const excessCenti = Math.max(0, distanceCenti - includedCenti);
  const inside = { ...base, includedKm, excessKm: excessCenti / 100 };
  if (input.mode === 'FIXED') {
    return { ...inside, amount: excessCenti === 0 ? 0 : fixedOf(policy), mode: 'FIXED' };
  }
  if (input.mode === 'TIERED') {
    if (excessCenti === 0) return { ...inside, amount: 0, mode: 'TIERED' };
    const tier = findTier(policy.tiers, distanceCenti);
    if (!tier) throw new ContractMathError(`Chưa có bậc phí cho khoảng cách ${distanceKm} km`);
    return { ...inside, amount: assertMoney(tier.amount, 'Phí theo bậc'), mode: 'TIERED', tier };
  }
  const perKm = assertMoney(policy.perKmAmount, 'Đơn giá km');
  if (perKm === 0) throw new ContractMathError('Tổ chức chưa cài đơn giá phí di chuyển theo km');
  const minimum = assertMoney(policy.minimumAmount, 'Phí di chuyển tối thiểu');
  const chargeable = excessCenti * (policy.roundTrip ? 2 : 1);
  const perKmBase = { ...inside, perKmAmount: perKm, chargedKm: chargeable / 100 };
  if (chargeable === 0) return { ...perKmBase, amount: 0, mode: 'PER_KM' };
  // tiền = (phần trăm km × đơn giá) / 100, làm tròn lên bội 1.000 đ — chia nguyên, không qua số thực.
  const raw = safeMul(chargeable, perKm, 'Phí di chuyển');
  const unit = 100 * TRAVEL_ROUNDING_VND;
  const rem = raw % unit;
  const rounded = ((raw - rem) / unit) * TRAVEL_ROUNDING_VND + (rem > 0 ? TRAVEL_ROUNDING_VND : 0);
  return { ...perKmBase, amount: Math.max(rounded, minimum), mode: 'PER_KM' };
}

function fixedOf(policy: TravelPolicy): Vnd {
  const fixed = assertMoney(policy.fixedAmount, 'Phí di chuyển cố định');
  if (fixed === 0) throw new ContractMathError('Tổ chức chưa cài mức phí di chuyển cố định');
  return fixed;
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
