import { z } from 'zod';
import { MAX_INSTALLMENTS, PAYMENT_KINDS, PAYMENT_METHODS } from '@makeup/shared';

// Không âm thầm bỏ trường lạ: gửi nhầm thì báo rõ (cùng mẫu với module hợp đồng).
function strict<S extends z.ZodRawShape>(shape: S) {
  return z.strictObject(shape, {
    error: (iss) => (iss.code === 'unrecognized_keys' ? `Không nhận trường: ${iss.keys.join(', ')}` : undefined),
  });
}

const Amount = z
  .number({ error: 'Số tiền phải là số' })
  .int('Số tiền phải là số nguyên đồng, không có phần lẻ')
  .positive('Số tiền phải lớn hơn 0')
  .max(Number.MAX_SAFE_INTEGER, 'Số tiền vượt ngưỡng cho phép');

const DateTime = z.iso.datetime({ offset: true, error: 'Thời gian phải theo dạng ISO 8601, ví dụ 2026-11-01T08:00:00+07:00' });
const Note = z.string().trim().min(1).max(1000);

export const OrgParams = z.object({ orgId: z.uuid() });
export const ContractParams = OrgParams.extend({ contractId: z.uuid() });
export const PaymentParams = OrgParams.extend({ paymentId: z.uuid() });

const InstallmentInput = strict({
  name: z.string().trim().min(1, 'Tên đợt không được để trống').max(120),
  dueDate: DateTime,
  amount: Amount,
  isDeposit: z.boolean().default(false),
});

export const InstallmentsBodySchema = strict({
  installments: z.array(InstallmentInput).max(MAX_INSTALLMENTS, `Tối đa ${MAX_INSTALLMENTS} đợt thanh toán`),
});

export const PaymentBodySchema = strict({
  kind: z.enum(PAYMENT_KINDS).default('RECEIPT'),
  method: z.enum(PAYMENT_METHODS),
  amount: Amount,
  receivedAt: DateTime.optional(),
  note: Note.optional(),
  allowOverpay: z.boolean().optional(),
}).refine((b) => !b.allowOverpay || b.note !== undefined, {
  message: 'Cho thu vượt tổng hợp đồng phải kèm ghi chú lý do',
  path: ['note'],
});

export const VoidPaymentBodySchema = strict({ reason: z.string().trim().min(1, 'Phải nêu lý do huỷ phiếu').max(1000) });

// Kỳ báo cáo [from, to): tính cả from, không tính to.
export const MAX_PERIOD_DAYS = 366;
const Period = {
  from: DateTime,
  to: DateTime,
};
function checkPeriod(q: { from: string; to: string }, ctx: z.RefinementCtx) {
  const ms = new Date(q.to).getTime() - new Date(q.from).getTime();
  if (ms <= 0) ctx.addIssue({ code: 'custom', message: 'Thời điểm kết thúc (to) phải sau thời điểm bắt đầu (from)', path: ['to'] });
  else if (ms > MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000) {
    ctx.addIssue({ code: 'custom', message: `Kỳ xem tối đa ${MAX_PERIOD_DAYS} ngày`, path: ['to'] });
  }
}

export const LedgerQuery = z
  .object({
    ...Period,
    method: z.enum(PAYMENT_METHODS).optional(),
    kind: z.enum(PAYMENT_KINDS).optional(),
    contractId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .superRefine(checkPeriod);

export const RevenueQuery = z
  .object({
    ...Period,
    groupBy: z.enum(['month', 'contract']).default('month'),
  })
  .superRefine(checkPeriod);
