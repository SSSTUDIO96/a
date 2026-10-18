import { assertVnd, formatVnd, type Vnd } from './money';

// Lỗi tính tiền thu do dữ liệu sai (tiến độ lệch tổng, hoàn vượt thu…). Máy chủ đổi thành 400.
export class PaymentMathError extends Error {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PaymentMathError';
  }
}

export const PAYMENT_KINDS = ['RECEIPT', 'REFUND'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];
export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = { RECEIPT: 'Phiếu thu', REFUND: 'Phiếu hoàn tiền' };

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  CARD: 'Quẹt thẻ',
  OTHER: 'Khác',
};

export const INSTALLMENT_STATUSES = ['PAID', 'PARTIAL', 'DUE', 'OVERDUE'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];
export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  PAID: 'Đã thu đủ',
  PARTIAL: 'Đã thu một phần',
  DUE: 'Chưa đến hạn',
  OVERDUE: 'Quá hạn',
};

export const MAX_INSTALLMENTS = 24;
export const MAX_SUGGESTED_INSTALLMENTS = 4;

function nonNegative(value: number, field: string): Vnd {
  assertVnd(value, field);
  if (value < 0) throw new PaymentMathError(`${field} không được âm`);
  return value;
}

function positive(value: number, field: string): Vnd {
  assertVnd(value, field);
  if (value <= 0) throw new PaymentMathError(`${field} phải lớn hơn 0`);
  return value;
}

function safeAdd(a: number, b: number, field: string): number {
  const r = a + b;
  if (!Number.isSafeInteger(r)) throw new PaymentMathError(`${field} vượt ngưỡng cho phép`);
  return r;
}

export interface PaymentLike {
  kind: PaymentKind;
  amount: Vnd;
  voided: boolean;
}

export interface PaymentSummary {
  total: Vnd;
  depositRequired: Vnd;
  // Tổng phiếu thu và phiếu hoàn còn hiệu lực (bỏ phiếu đã huỷ).
  received: Vnd;
  refunded: Vnd;
  // Thực thu = thu − hoàn.
  paid: Vnd;
  // total − paid; âm nghĩa là khách trả thừa (xem overpaid).
  remaining: Vnd;
  overpaid: Vnd;
  depositOutstanding: Vnd;
}

export function summarizePayments(contractTotal: Vnd, depositRequired: Vnd, payments: readonly PaymentLike[]): PaymentSummary {
  nonNegative(contractTotal, 'Tổng hợp đồng');
  nonNegative(depositRequired, 'Tiền cọc');
  let received = 0;
  let refunded = 0;
  for (const p of payments) {
    positive(p.amount, 'Số tiền phiếu');
    if (p.voided) continue;
    if (p.kind === 'RECEIPT') received = safeAdd(received, p.amount, 'Tổng thu');
    else refunded = safeAdd(refunded, p.amount, 'Tổng hoàn');
  }
  const paid = received - refunded;
  if (paid < 0) {
    throw new PaymentMathError(`Tổng hoàn (${formatVnd(refunded)}) vượt tổng thu (${formatVnd(received)})`, { received, refunded });
  }
  const remaining = contractTotal - paid;
  return {
    total: contractTotal,
    depositRequired,
    received,
    refunded,
    paid,
    remaining,
    overpaid: Math.max(0, -remaining),
    depositOutstanding: Math.max(0, depositRequired - paid),
  };
}

export interface InstallmentLike {
  id: string;
  dueDate: Date;
  amount: Vnd;
}

export type AllocatedInstallment<T extends InstallmentLike> = T & {
  paidAmount: Vnd;
  outstanding: Vnd;
  status: InstallmentStatus;
};

// Xếp các đợt theo hạn (cùng hạn giữ thứ tự gửi vào) — thứ tự này quyết định tiền đổ vào đợt nào trước.
export function sortInstallments<T extends { dueDate: Date }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.dueDate.getTime() - b.item.dueDate.getTime() || a.index - b.index)
    .map((x) => x.item);
}

// Tiền đã thu đổ dần vào đợt có hạn sớm nhất. Hạn là một thời điểm: qua thời điểm đó mà chưa đủ → quá hạn.
export function allocateToInstallments<T extends InstallmentLike>(installments: readonly T[], paid: Vnd, now: Date): AllocatedInstallment<T>[] {
  let pool = nonNegative(paid, 'Số đã thu');
  return sortInstallments(installments).map((it) => {
    positive(it.amount, `Số tiền đợt ${it.id}`);
    const paidAmount = Math.min(pool, it.amount);
    pool -= paidAmount;
    const status: InstallmentStatus =
      paidAmount === it.amount ? 'PAID' : it.dueDate.getTime() < now.getTime() ? 'OVERDUE' : paidAmount > 0 ? 'PARTIAL' : 'DUE';
    return { ...it, paidAmount, outstanding: it.amount - paidAmount, status };
  });
}

export interface InstallmentPlanItem {
  amount: Vnd;
  isDeposit: boolean;
}

// Luật một tiến độ hợp lệ: mỗi đợt > 0, tối đa một đợt cọc, tổng các đợt bằng ĐÚNG tổng hợp đồng.
export function checkInstallmentPlan(contractTotal: Vnd, items: readonly InstallmentPlanItem[]): void {
  nonNegative(contractTotal, 'Tổng hợp đồng');
  if (items.length > MAX_INSTALLMENTS) throw new PaymentMathError(`Tối đa ${MAX_INSTALLMENTS} đợt thanh toán`);
  let sum = 0;
  items.forEach((it, i) => {
    positive(it.amount, `Số tiền đợt ${i + 1}`);
    sum = safeAdd(sum, it.amount, 'Tổng các đợt');
  });
  const deposits = items.filter((it) => it.isDeposit).length;
  if (deposits > 1) throw new PaymentMathError(`Tiến độ chỉ được có tối đa 1 đợt đặt cọc (đang có ${deposits})`);
  const diff = sum - contractTotal;
  if (diff !== 0) {
    throw new PaymentMathError(
      `Tổng các đợt (${formatVnd(sum)}) phải bằng tổng hợp đồng (${formatVnd(contractTotal)}): ${
        diff < 0 ? `còn thiếu ${formatVnd(-diff)}` : `thừa ${formatVnd(diff)}`
      }`,
      { contractTotal, installmentsTotal: sum, difference: diff },
    );
  }
}

export interface SuggestedInstallment {
  name: string;
  dueDate: Date;
  amount: Vnd;
  isDeposit: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Gợi ý tiến độ: đợt "Đặt cọc" (nếu cọc > 0) rồi chia đều phần còn lại thành `count` đợt, đồng lẻ dồn đợt cuối.
// Đợt đầu tiên hạn firstDue, mỗi đợt sau cách đợt trước intervalDays ngày. Tổng luôn bằng đúng total.
export function suggestInstallments(total: Vnd, deposit: Vnd, count: number, firstDue: Date, intervalDays: number): SuggestedInstallment[] {
  nonNegative(total, 'Tổng hợp đồng');
  nonNegative(deposit, 'Tiền cọc');
  if (deposit > total) throw new PaymentMathError(`Tiền cọc (${formatVnd(deposit)}) lớn hơn tổng hợp đồng (${formatVnd(total)})`);
  if (!Number.isInteger(count) || count < 1 || count > MAX_SUGGESTED_INSTALLMENTS) {
    throw new PaymentMathError(`Số đợt phải từ 1 đến ${MAX_SUGGESTED_INSTALLMENTS}, nhận: ${count}`);
  }
  if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 366) {
    throw new PaymentMathError(`Khoảng cách giữa các đợt phải từ 1 đến 366 ngày, nhận: ${intervalDays}`);
  }
  if (Number.isNaN(firstDue.getTime())) throw new PaymentMathError('Hạn đợt đầu không hợp lệ');
  const out: SuggestedInstallment[] = [];
  const due = () => new Date(firstDue.getTime() + out.length * intervalDays * DAY_MS);
  if (deposit > 0) out.push({ name: 'Đặt cọc', dueDate: due(), amount: deposit, isDeposit: true });
  const rest = total - deposit;
  if (rest === 0) return out;
  if (rest < count) {
    throw new PaymentMathError(`Phần còn lại (${formatVnd(rest)}) không chia được thành ${count} đợt`);
  }
  const base = Math.floor(rest / count);
  for (let i = 1; i <= count; i++) {
    const amount = i === count ? rest - base * (count - 1) : base;
    out.push({ name: count === 1 ? 'Thanh toán còn lại' : `Đợt ${i}`, dueDate: due(), amount, isDeposit: false });
  }
  return out;
}
