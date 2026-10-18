import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import type { ContractPayments } from '../../api/types';
import { buildPaymentInput, overpayDetails, prefillAmount } from './model';
import { money, paymentAmount } from './money';
import { addDays, daysBetween, dueDateIso, endOfDayIso, fmtDate, receivedAtIso, todayVn, vnDate } from './vnTime';

const base: ContractPayments = {
  contract: {
    id: 'hd-1',
    code: 'HD-000142',
    status: 'CONFIRMED',
    eventDate: '2026-10-24T01:00:00.000Z',
    confirmedAt: '2026-10-12T03:00:00.000Z',
    customer: { id: 'k1', fullName: 'Phương Thảo', phone: '0912345678' },
  },
  summary: { total: 5_300_000, depositRequired: 1_000_000, received: 1_000_000, refunded: 0, paid: 1_000_000, remaining: 4_300_000, overpaid: 0, depositOutstanding: 0 },
  installments: [],
  installmentsTotal: 0,
  scheduleDifference: null,
  payments: [],
};

describe('prefillAmount — số điền sẵn lấy từ máy chủ', () => {
  it('chưa lập tiến độ → summary.remaining', () => {
    expect(prefillAmount(base)).toBe(4_300_000);
  });
  it('chưa lập tiến độ, đã thu đủ/thừa → không điền', () => {
    expect(prefillAmount({ ...base, summary: { ...base.summary, remaining: -200_000, overpaid: 200_000 } })).toBeNull();
  });
  it('có tiến độ → outstanding của đợt chưa đủ có hạn sớm nhất', () => {
    const data: ContractPayments = {
      ...base,
      installments: [
        { id: 'i3', name: 'Đợt 2', dueDate: '2026-11-30T16:59:59.000Z', amount: 2_000_000, isDeposit: false, sortOrder: 2, paidAmount: 0, outstanding: 2_000_000, status: 'DUE' },
        { id: 'i1', name: 'Đặt cọc', dueDate: '2026-10-12T16:59:59.000Z', amount: 1_000_000, isDeposit: true, sortOrder: 0, paidAmount: 1_000_000, outstanding: 0, status: 'PAID' },
        { id: 'i2', name: 'Đợt 1', dueDate: '2026-10-24T16:59:59.000Z', amount: 2_300_000, isDeposit: false, sortOrder: 1, paidAmount: 500_000, outstanding: 1_800_000, status: 'PARTIAL' },
      ],
    };
    expect(prefillAmount(data)).toBe(1_800_000);
  });
});

describe('buildPaymentInput — kiểm form trước khi gửi', () => {
  const today = '2026-10-19';
  it('phiếu thu hôm nay: không gửi receivedAt, ghi chú cắt khoảng trắng', () => {
    const r = buildPaymentInput({ kind: 'RECEIPT', amount: 500_000, method: 'CASH', date: today, note: '  CK ' }, today);
    expect(r).toEqual({ ok: true, input: { kind: 'RECEIPT', method: 'CASH', amount: 500_000, note: 'CK' } });
  });
  it('ghi lùi ngày: receivedAt 12:00 giờ Việt Nam', () => {
    const r = buildPaymentInput({ kind: 'RECEIPT', amount: 1, method: 'CARD', date: '2026-10-17', note: '' }, today);
    expect(r.ok && r.input.receivedAt).toBe('2026-10-17T12:00:00+07:00');
  });
  it('thiếu số tiền, cách trả; ngày tương lai → lỗi theo ô', () => {
    const r = buildPaymentInput({ kind: 'RECEIPT', amount: null, method: null, date: '2026-10-20', note: '' }, today);
    expect(r).toEqual({
      ok: false,
      errors: { amount: 'Nhập số tiền lớn hơn 0.', method: 'Chọn cách trả.', receivedAt: 'Ngày thu không được ở tương lai.' },
    });
  });
  it('phiếu hoàn bắt buộc ghi chú (luật studio, giao diện bắt)', () => {
    const r = buildPaymentInput({ kind: 'REFUND', amount: 300_000, method: 'BANK_TRANSFER', date: today, note: ' ' }, today);
    expect(r).toEqual({ ok: false, errors: { note: 'Phiếu hoàn tiền phải ghi lý do hoàn.' } });
    const ok = buildPaymentInput({ kind: 'REFUND', amount: 300_000, method: 'BANK_TRANSFER', date: today, note: 'Bớt 1 phù dâu' }, today);
    expect(ok).toEqual({ ok: true, input: { kind: 'REFUND', method: 'BANK_TRANSFER', amount: 300_000, note: 'Bớt 1 phù dâu' } });
  });
});

describe('overpayDetails', () => {
  it('đọc details.overBy của 409 thu vượt; 409 khác → null', () => {
    const over = new ApiError('CONFLICT', 'Thu vượt', 409, 'r', { total: 5_300_000, paid: 5_300_000, remaining: 0, overBy: 200_000 });
    expect(overpayDetails(over)).toEqual({ overBy: 200_000, remaining: 0 });
    expect(overpayDetails(new ApiError('CONFLICT', 'Hợp đồng đã huỷ', 409, 'r'))).toBeNull();
    expect(overpayDetails(new ApiError('VALIDATION_FAILED', 'x', 400, 'r', { overBy: 1, remaining: 0 }))).toBeNull();
  });
});

describe('tiền và ngày giờ Việt Nam', () => {
  it('số âm dùng dấu "−", null → "—", phiếu hoàn có dấu trừ', () => {
    expect(money(-300_000)).toBe('−300.000 ₫');
    expect(money(null)).toBe('—');
    expect(money(0)).toBe('0 ₫');
    expect(paymentAmount('REFUND', 300_000)).toBe('−300.000 ₫');
    expect(paymentAmount('RECEIPT', 300_000)).toBe('300.000 ₫');
  });
  it('ngày theo giờ Việt Nam (UTC+7)', () => {
    expect(vnDate('2026-10-18T18:30:00Z')).toBe('2026-10-19');
    expect(todayVn(new Date('2026-10-18T16:59:59Z'))).toBe('2026-10-18');
    expect(fmtDate('2026-10-23T17:00:00Z')).toBe('24/10/2026');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysBetween('2026-10-19', '2026-10-24')).toBe(5);
    expect(endOfDayIso('2026-10-26')).toBe('2026-10-26T23:59:59.999+07:00');
    expect(dueDateIso('2026-10-24')).toBe('2026-10-24T23:59:59+07:00');
    expect(receivedAtIso('2026-10-24')).toBe('2026-10-24T12:00:00+07:00');
  });
});
