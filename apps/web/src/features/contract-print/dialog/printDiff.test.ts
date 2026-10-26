import { describe, expect, it } from 'vitest';
import type { ContractPrintData, PrintLine } from '@makeup/shared';
import { SAMPLE } from '../paper/sampleData';
import { printDiff } from './printDiff';

// Danh sách thay đổi giữa dữ liệu lần in trước và dữ liệu hiện tại (công tắc "In lại y hệt bản đã in").
const base = (): ContractPrintData => structuredClone(SAMPLE.SERVICE.long);
const withPayments = (d: ContractPrintData, paid: number): ContractPrintData => {
  if (!d.payments) throw new Error('mẫu thiếu payments');
  return { ...d, payments: { ...d.payments, paid, remaining: d.money.total - paid } };
};

describe('printDiff', () => {
  it('hai bản giống hệt → không có thay đổi', () => {
    expect(printDiff(base(), base())).toEqual([]);
  });
  it('đổi tổng tiền → "Tổng a → b"', () => {
    const now = base();
    now.money = { ...now.money, total: now.money.total + 300_000 };
    const out = printDiff(base(), now);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^Tổng 7\.152\.000 ₫ → 7\.452\.000 ₫$/);
  });
  it('thu thêm tiền → "Đã thu thêm X"; thu giảm (hoàn) → "Đã thu giảm X"', () => {
    const old = withPayments(base(), 3_000_000);
    expect(printDiff(old, withPayments(base(), 5_000_000))).toEqual(['Đã thu thêm 2.000.000 ₫']);
    expect(printDiff(withPayments(base(), 5_000_000), old)).toEqual(['Đã thu giảm 2.000.000 ₫']);
  });
  it('thêm dòng phát sinh sau xác nhận → "Thêm N dòng phát sinh"', () => {
    const now = base();
    const extra = { ...now.lines[0]!, addedAfterConfirm: true, addedOn: '2026-10-24' } satisfies PrintLine;
    now.lines = [...now.lines, extra];
    expect(printDiff(base(), now)).toEqual(['Thêm 1 dòng phát sinh']);
  });
  it('điều khoản đổi, nội quy đổi', () => {
    const now = base();
    now.terms = { title: 'Điều khoản', items: ['Điều mới'], source: null, snapshot: false };
    expect(printDiff(base(), now)).toEqual(['Điều khoản đổi']);
    const course = structuredClone(SAMPLE.COURSE.long);
    const course2 = structuredClone(SAMPLE.COURSE.long);
    course2.rules = course2.rules ? { ...course2.rules, items: [...course2.rules.items, 'Nội quy thêm'] } : null;
    expect(printDiff(course, course2)).toEqual(['Nội quy đổi']);
  });
  it('quyền thu tiền đổi (payments null ↔ có) được nói rõ, không bịa số', () => {
    const now = { ...base(), payments: null, paymentsHidden: true };
    expect(printDiff(base(), now)).toEqual(['Phần thu tiền nay bị ẩn theo quyền của bạn']);
  });
  it('khác nhau ở chỗ chưa có câu riêng vẫn không được trả rỗng', () => {
    const now = base();
    now.contract = { ...now.contract, issuedOn: '2026-01-01' };
    expect(printDiff(base(), now)).toEqual(['Dữ liệu hợp đồng có thay đổi nhỏ']);
  });
});
