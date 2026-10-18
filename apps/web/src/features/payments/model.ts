import type { PaymentKind, PaymentMethod, Vnd } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type { ContractPayments, PaymentCreateInput } from '../../api/types';
import { receivedAtIso } from './vnTime';

// Luật của form ghi phiếu (bản vẽ C2 mục 3.2). Hàm thuần để thử không cần màn.

/**
 * Số tiền điền sẵn: phần còn thiếu của đợt chưa thu đủ có hạn sớm nhất; chưa lập tiến độ thì số còn lại (nếu > 0).
 * Cả hai số đều do máy chủ trả (installments[].outstanding, summary.remaining) — không tự tính.
 */
export function prefillAmount(data: ContractPayments): Vnd | null {
  if (data.installments.length > 0) {
    const open = data.installments.filter((i) => i.outstanding > 0);
    if (open.length === 0) return null;
    const first = open.reduce((a, b) => (new Date(b.dueDate).getTime() < new Date(a.dueDate).getTime() ? b : a));
    return first.outstanding;
  }
  return data.summary.remaining > 0 ? data.summary.remaining : null;
}

export interface PaymentFormValues {
  kind: PaymentKind;
  amount: Vnd | null;
  method: PaymentMethod | null;
  /** "YYYY-MM-DD" theo giờ Việt Nam. */
  date: string | null;
  note: string;
}

export type PaymentFormErrors = Partial<Record<'amount' | 'method' | 'receivedAt' | 'note', string>>;

/** Kiểm trước khi gửi. Trả lỗi theo ô, hoặc thân gửi máy chủ. */
export function buildPaymentInput(
  v: PaymentFormValues,
  today: string,
): { ok: true; input: PaymentCreateInput } | { ok: false; errors: PaymentFormErrors } {
  const errors: PaymentFormErrors = {};
  if (v.amount === null || v.amount <= 0) errors.amount = 'Nhập số tiền lớn hơn 0.';
  if (v.method === null) errors.method = 'Chọn cách trả.';
  if (v.date === null) errors.receivedAt = 'Chọn ngày thu.';
  else if (v.date > today) errors.receivedAt = 'Ngày thu không được ở tương lai.';
  const note = v.note.trim();
  // Luật studio: phiếu hoàn phải có lý do (máy chủ không bắt, giao diện bắt).
  if (v.kind === 'REFUND' && note === '') errors.note = 'Phiếu hoàn tiền phải ghi lý do hoàn.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const input: PaymentCreateInput = { kind: v.kind, method: v.method as PaymentMethod, amount: v.amount as Vnd };
  if (v.date !== null && v.date !== today) input.receivedAt = receivedAtIso(v.date);
  if (note !== '') input.note = note;
  return { ok: true, input };
}

/** 409 thu vượt: máy chủ gửi details { total, paid, remaining, overBy }. Không phải 409 này → null. */
export function overpayDetails(err: unknown): { overBy: Vnd; remaining: Vnd } | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const d = err.details as { overBy?: unknown; remaining?: unknown } | undefined;
  if (typeof d?.overBy !== 'number' || typeof d.remaining !== 'number') return null;
  return { overBy: d.overBy, remaining: d.remaining };
}
