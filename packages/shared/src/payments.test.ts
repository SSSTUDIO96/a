import { describe, expect, it } from 'vitest';
import {
  allocateToInstallments,
  checkInstallmentPlan,
  PaymentMathError,
  suggestInstallments,
  summarizePayments,
  type PaymentLike,
} from './payments';

const r = (amount: number, voided = false): PaymentLike => ({ kind: 'RECEIPT', amount, voided });
const f = (amount: number, voided = false): PaymentLike => ({ kind: 'REFUND', amount, voided });

describe('summarizePayments', () => {
  it('chưa có phiếu nào: còn lại = tổng, cọc còn thiếu = cọc', () => {
    expect(summarizePayments(10_000_000, 3_000_000, [])).toEqual({
      total: 10_000_000,
      depositRequired: 3_000_000,
      received: 0,
      refunded: 0,
      paid: 0,
      remaining: 10_000_000,
      overpaid: 0,
      depositOutstanding: 3_000_000,
    });
  });

  it('thu − hoàn, bỏ phiếu đã huỷ', () => {
    const s = summarizePayments(10_000_000, 3_000_000, [r(3_000_000), r(2_000_000), r(9_999_999, true), f(500_000), f(1, true)]);
    expect(s).toMatchObject({ received: 5_000_000, refunded: 500_000, paid: 4_500_000, remaining: 5_500_000, overpaid: 0, depositOutstanding: 0 });
  });

  it('thu thiếu cọc: cọc còn thiếu đúng phần chênh', () => {
    expect(summarizePayments(10_000_000, 3_000_000, [r(1_000_001)]).depositOutstanding).toBe(1_999_999);
  });

  it('thu đúng bằng tổng: còn lại 0, không trả thừa', () => {
    expect(summarizePayments(1_000, 0, [r(1_000)])).toMatchObject({ remaining: 0, overpaid: 0 });
  });

  it('trả thừa: còn lại âm và báo riêng số thừa', () => {
    expect(summarizePayments(1_000, 0, [r(1_250)])).toMatchObject({ paid: 1_250, remaining: -250, overpaid: 250 });
  });

  it('hoàn vượt thu → lỗi, không trả số âm', () => {
    expect(() => summarizePayments(1_000, 0, [r(100), f(101)])).toThrow(PaymentMathError);
    // Huỷ phiếu thu làm hoàn vượt thu cũng bị bắt.
    expect(() => summarizePayments(1_000, 0, [r(100, true), f(100)])).toThrow(PaymentMathError);
  });

  it('số tiền sai (lẻ, âm, 0) → lỗi', () => {
    expect(() => summarizePayments(1_000, 0, [r(0)])).toThrow(PaymentMathError);
    expect(() => summarizePayments(1_000, 0, [r(-5)])).toThrow(PaymentMathError);
    expect(() => summarizePayments(1_000, 0, [r(1.5)])).toThrow(RangeError);
    expect(() => summarizePayments(-1, 0, [])).toThrow(PaymentMathError);
    expect(() => summarizePayments(1_000, -1, [])).toThrow(PaymentMathError);
  });
});

describe('allocateToInstallments', () => {
  const day = (d: number) => new Date(Date.UTC(2026, 10, d));
  const plan = [
    { id: 'coc', dueDate: day(1), amount: 3_000_000 },
    { id: 'd1', dueDate: day(10), amount: 4_000_000 },
    { id: 'd2', dueDate: day(20), amount: 3_000_000 },
  ];
  const statuses = (paid: number, now: Date) => allocateToInstallments(plan, paid, now).map((x) => [x.id, x.paidAmount, x.status]);

  it('chưa thu, chưa đến hạn → DUE hết', () => {
    expect(statuses(0, day(1))).toEqual([
      ['coc', 0, 'DUE'],
      ['d1', 0, 'DUE'],
      ['d2', 0, 'DUE'],
    ]);
  });

  it('đúng thời điểm hạn chưa tính là quá hạn; qua 1 ms thì quá hạn', () => {
    expect(statuses(0, day(1))[0]).toEqual(['coc', 0, 'DUE']);
    expect(statuses(0, new Date(day(1).getTime() + 1))[0]).toEqual(['coc', 0, 'OVERDUE']);
  });

  it('tiền đổ vào đợt sớm nhất trước: đủ cọc + một phần đợt 1', () => {
    expect(statuses(5_000_000, day(5))).toEqual([
      ['coc', 3_000_000, 'PAID'],
      ['d1', 2_000_000, 'PARTIAL'],
      ['d2', 0, 'DUE'],
    ]);
  });

  it('quá hạn mà mới thu một phần → OVERDUE (không phải PARTIAL)', () => {
    expect(statuses(5_000_000, day(15))[1]).toEqual(['d1', 2_000_000, 'OVERDUE']);
  });

  it('đã thu đủ thì quá hạn vẫn là PAID', () => {
    expect(statuses(7_000_000, day(25)).slice(0, 2)).toEqual([
      ['coc', 3_000_000, 'PAID'],
      ['d1', 4_000_000, 'PAID'],
    ]);
  });

  it('thu thừa: mọi đợt PAID, phần thừa không đổ vào đâu', () => {
    const out = allocateToInstallments(plan, 99_000_000, day(1));
    expect(out.every((x) => x.status === 'PAID' && x.outstanding === 0)).toBe(true);
  });

  it('đầu vào lộn xộn được xếp theo hạn; cùng hạn giữ thứ tự gửi', () => {
    const mixed = [plan[2]!, { id: 'cung-han', dueDate: day(1), amount: 1_000 }, plan[0]!];
    expect(allocateToInstallments(mixed, 1_500, day(1)).map((x) => [x.id, x.paidAmount])).toEqual([
      ['cung-han', 1_000],
      ['coc', 500],
      ['d2', 0],
    ]);
  });

  it('không có đợt → danh sách rỗng; số đã thu âm → lỗi', () => {
    expect(allocateToInstallments([], 100, day(1))).toEqual([]);
    expect(() => allocateToInstallments(plan, -1, day(1))).toThrow(PaymentMathError);
  });
});

describe('checkInstallmentPlan', () => {
  it('tổng khớp, một đợt cọc → hợp lệ', () => {
    expect(() =>
      checkInstallmentPlan(10_000, [
        { amount: 3_000, isDeposit: true },
        { amount: 7_000, isDeposit: false },
      ]),
    ).not.toThrow();
  });

  it('thiếu / thừa → nói rõ chênh bao nhiêu', () => {
    try {
      checkInstallmentPlan(10_000, [{ amount: 9_000, isDeposit: false }]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(PaymentMathError);
      expect((e as PaymentMathError).message).toMatch(/còn thiếu 1\.000 ₫/);
      expect((e as PaymentMathError).details).toEqual({ contractTotal: 10_000, installmentsTotal: 9_000, difference: -1_000 });
    }
    expect(() => checkInstallmentPlan(10_000, [{ amount: 10_001, isDeposit: false }])).toThrow(/thừa 1 ₫/);
  });

  it('hai đợt cọc, đợt 0 đồng → lỗi; tổng 0 với danh sách rỗng hợp lệ', () => {
    expect(() =>
      checkInstallmentPlan(2, [
        { amount: 1, isDeposit: true },
        { amount: 1, isDeposit: true },
      ]),
    ).toThrow(/tối đa 1 đợt đặt cọc/);
    expect(() => checkInstallmentPlan(1, [{ amount: 0, isDeposit: false }])).toThrow(PaymentMathError);
    expect(() => checkInstallmentPlan(0, [])).not.toThrow();
    expect(() => checkInstallmentPlan(1, [])).toThrow(/còn thiếu/);
  });
});

describe('suggestInstallments', () => {
  const first = new Date('2026-11-01T00:00:00.000Z');
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

  it('cọc + 3 đợt chia đều, đồng lẻ dồn đợt cuối, tổng đúng bằng total', () => {
    const out = suggestInstallments(10_000_000, 3_000_000, 3, first, 7);
    expect(out.map((x) => [x.name, x.amount, x.isDeposit, x.dueDate.toISOString()])).toEqual([
      ['Đặt cọc', 3_000_000, true, '2026-11-01T00:00:00.000Z'],
      ['Đợt 1', 2_333_333, false, '2026-11-08T00:00:00.000Z'],
      ['Đợt 2', 2_333_333, false, '2026-11-15T00:00:00.000Z'],
      ['Đợt 3', 2_333_334, false, '2026-11-22T00:00:00.000Z'],
    ]);
    expect(sum(out)).toBe(10_000_000);
  });

  it('không cọc: đợt đầu hạn firstDue; 1 đợt gọi là "Thanh toán còn lại"', () => {
    expect(suggestInstallments(5_000, 0, 1, first, 30)).toEqual([{ name: 'Thanh toán còn lại', dueDate: first, amount: 5_000, isDeposit: false }]);
  });

  it('cọc bằng tổng → chỉ một đợt cọc; tổng 0 → không đợt nào', () => {
    expect(suggestInstallments(5_000, 5_000, 4, first, 30).map((x) => x.name)).toEqual(['Đặt cọc']);
    expect(suggestInstallments(0, 0, 2, first, 30)).toEqual([]);
  });

  it('4 đợt là tối đa; tổng luôn khớp với nhiều số lẻ', () => {
    for (const total of [1_000_003, 7, 999_999_999]) {
      const out = suggestInstallments(total, 1, 4, first, 1);
      expect(sum(out)).toBe(total);
      expect(() => checkInstallmentPlan(total, out)).not.toThrow();
    }
  });

  it('biên sai → lỗi rõ ràng, không đoán', () => {
    expect(() => suggestInstallments(1_000, 0, 0, first, 7)).toThrow(/từ 1 đến 4/);
    expect(() => suggestInstallments(1_000, 0, 5, first, 7)).toThrow(/từ 1 đến 4/);
    expect(() => suggestInstallments(1_000, 0, 2.5, first, 7)).toThrow(PaymentMathError);
    expect(() => suggestInstallments(1_000, 0, 2, first, 0)).toThrow(/ngày/);
    expect(() => suggestInstallments(1_000, 1_001, 2, first, 7)).toThrow(/lớn hơn tổng/);
    expect(() => suggestInstallments(3, 0, 4, first, 7)).toThrow(/không chia được/);
    expect(() => suggestInstallments(1_000, 0, 2, new Date('x'), 7)).toThrow(/không hợp lệ/);
  });
});
