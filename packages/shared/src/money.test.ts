import { describe, expect, it } from 'vitest';
import { assertVnd, formatVnd, vndFromBigInt } from './money';

describe('tiền VND', () => {
  it('nhận số nguyên đồng', () => {
    expect(assertVnd(1_500_000)).toBe(1_500_000);
  });
  it('từ chối số lẻ thay vì làm tròn', () => {
    expect(() => assertVnd(1500.5)).toThrow(RangeError);
  });
  it('từ chối chuỗi', () => {
    expect(() => assertVnd('1500000')).toThrow(RangeError);
  });
  it('BigInt vượt ngưỡng thì ném lỗi, không làm tròn im lặng', () => {
    expect(() => vndFromBigInt(2n ** 60n)).toThrow(RangeError);
    expect(vndFromBigInt(1_500_000n)).toBe(1_500_000);
  });
  it('định dạng kiểu Việt Nam', () => {
    expect(formatVnd(1_500_000)).toMatch(/^1\.500\.000 ₫$/);
  });
});
