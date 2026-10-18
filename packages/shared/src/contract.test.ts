import { describe, expect, it } from 'vitest';
import {
  canTransitionContract,
  computeContractTotals,
  computeLineTotal,
  computeSuggestedDeposit,
  computeTravelFee,
  ContractMathError,
  kmToCentiKm,
  type TravelPolicy,
} from './contract';

const policy: TravelPolicy = { fixedAmount: 200_000, perKmAmount: 5_000, freeKm: 0, minimumAmount: 0, roundTrip: false, tiers: [] };

describe('thành tiền dòng', () => {
  it('đơn giá × số lượng − giảm giá dòng', () => {
    expect(computeLineTotal(1_500_000, 2, 100_000)).toBe(2_900_000);
    expect(computeLineTotal(0, 1, 0)).toBe(0);
  });
  it('giảm giá đúng bằng thành tiền → 0', () => {
    expect(computeLineTotal(300_000, 1, 300_000)).toBe(0);
  });
  it('giảm giá vượt thành tiền → lỗi', () => {
    expect(() => computeLineTotal(300_000, 1, 300_001)).toThrow(ContractMathError);
  });
  it('số lượng 0, âm hoặc lẻ → lỗi', () => {
    expect(() => computeLineTotal(100_000, 0, 0)).toThrow(ContractMathError);
    expect(() => computeLineTotal(100_000, -1, 0)).toThrow(ContractMathError);
    expect(() => computeLineTotal(100_000, 1.5, 0)).toThrow(ContractMathError);
  });
  it('tiền lẻ đồng bị từ chối, không làm tròn', () => {
    expect(() => computeLineTotal(100_000.5, 1, 0)).toThrow(RangeError);
    expect(() => computeLineTotal(100_000, 1, 0.5)).toThrow(RangeError);
  });
  it('tiền âm bị từ chối', () => {
    expect(() => computeLineTotal(-1, 1, 0)).toThrow(ContractMathError);
  });
  it('vượt ngưỡng số nguyên an toàn → lỗi, không làm tròn', () => {
    expect(() => computeLineTotal(Number.MAX_SAFE_INTEGER, 2, 0)).toThrow(ContractMathError);
  });
});

describe('đổi km sang số nguyên', () => {
  it('2 chữ số thập phân ra đúng số nguyên', () => {
    expect(kmToCentiKm(12.35)).toBe(1235);
    expect(kmToCentiKm(0.1 + 0.2)).toBe(30);
    expect(kmToCentiKm(0)).toBe(0);
  });
  it('quá 2 chữ số thập phân, âm, vô cực → lỗi', () => {
    expect(() => kmToCentiKm(1.234)).toThrow(ContractMathError);
    expect(() => kmToCentiKm(-1)).toThrow(ContractMathError);
    expect(() => kmToCentiKm(Number.POSITIVE_INFINITY)).toThrow(ContractMathError);
    expect(() => kmToCentiKm(100_000)).toThrow(ContractMathError);
  });
});

describe('phí di chuyển', () => {
  it('cố định không có bán kính → đúng mức cài sẵn, không cần km', () => {
    expect(computeTravelFee(policy, { mode: 'FIXED' })).toEqual({
      amount: 200_000,
      mode: 'FIXED',
      distanceKm: null,
      perKmAmount: null,
      includedKm: 0,
      excessKm: null,
      chargedKm: null,
      roundTrip: false,
      tier: null,
    });
    expect(computeTravelFee(policy, { mode: 'FIXED', distanceKm: 7.5 })).toMatchObject({ amount: 200_000, distanceKm: 7.5, excessKm: 7.5 });
  });
  it('cố định khi tổ chức chưa cài mức → lỗi, không ngầm tính 0', () => {
    expect(() => computeTravelFee({ ...policy, fixedAmount: 0 }, { mode: 'FIXED' })).toThrow(ContractMathError);
  });
  it('theo km: 12,35 km × 5.000 = 61.750 → làm tròn lên 62.000', () => {
    expect(computeTravelFee(policy, { mode: 'PER_KM', distanceKm: 12.35 })).toEqual({
      amount: 62_000,
      mode: 'PER_KM',
      distanceKm: 12.35,
      perKmAmount: 5_000,
      includedKm: 0,
      excessKm: 12.35,
      chargedKm: 12.35,
      roundTrip: false,
      tier: null,
    });
  });
  it('theo km: tròn nghìn sẵn thì giữ nguyên', () => {
    expect(computeTravelFee(policy, { mode: 'PER_KM', distanceKm: 10 }).amount).toBe(50_000);
  });
  it('theo km: số lẻ nhỏ nhất vẫn làm tròn lên', () => {
    expect(computeTravelFee({ ...policy, perKmAmount: 1 }, { mode: 'PER_KM', distanceKm: 0.01 }).amount).toBe(1_000);
  });
  it('theo km: số thực kiểu 0,1 + 0,2 không làm lệch tiền', () => {
    expect(computeTravelFee({ ...policy, perKmAmount: 10_000 }, { mode: 'PER_KM', distanceKm: 0.1 + 0.2 }).amount).toBe(3_000);
  });
  it('theo km / theo bậc: thiếu số km → lỗi', () => {
    expect(() => computeTravelFee(policy, { mode: 'PER_KM' })).toThrow(ContractMathError);
    expect(() => computeTravelFee(policy, { mode: 'TIERED' })).toThrow(/phải có số km/);
  });
  it('theo km: 0 km → phí 0 dù có mức tối thiểu', () => {
    expect(computeTravelFee({ ...policy, minimumAmount: 100_000 }, { mode: 'PER_KM', distanceKm: 0 }).amount).toBe(0);
  });
  it('theo km: dưới hoặc đúng bán kính miễn phí chung → 0', () => {
    const p = { ...policy, freeKm: 5, minimumAmount: 100_000 };
    expect(computeTravelFee(p, { mode: 'PER_KM', distanceKm: 4.99 }).amount).toBe(0);
    expect(computeTravelFee(p, { mode: 'PER_KM', distanceKm: 5 })).toMatchObject({ amount: 0, includedKm: 5, excessKm: 0, chargedKm: 0 });
  });
  it('theo km: vượt bán kính chỉ tính phần vượt, không thấp hơn tối thiểu', () => {
    const p = { ...policy, freeKm: 5, minimumAmount: 30_000 };
    // 5,2 − 5 = 0,2 km × 5.000 = 1.000 → nâng lên tối thiểu 30.000
    expect(computeTravelFee(p, { mode: 'PER_KM', distanceKm: 5.2 }).amount).toBe(30_000);
    // 20 − 5 = 15 km × 5.000 = 75.000
    expect(computeTravelFee(p, { mode: 'PER_KM', distanceKm: 20 }).amount).toBe(75_000);
  });
  it('theo km: bán kính của gói thay cho bán kính chung — "12,35 km − 10 km miễn phí = 2,35 km × 10.000 ₫"', () => {
    const p = { ...policy, freeKm: 3, perKmAmount: 10_000 };
    expect(computeTravelFee(p, { mode: 'PER_KM', distanceKm: 12.35, includedKm: 10 })).toMatchObject({
      amount: 24_000,
      includedKm: 10,
      excessKm: 2.35,
      chargedKm: 2.35,
    });
    // Gói đặt bán kính 0 thì 0 là 0, không rơi về bán kính chung.
    expect(computeTravelFee(p, { mode: 'PER_KM', distanceKm: 2, includedKm: 0 }).amount).toBe(20_000);
  });
  it('theo km khứ hồi: (km − bán kính) × 2', () => {
    const p = { ...policy, roundTrip: true, freeKm: 3.5 };
    // (12,35 − 3,5) × 2 = 17,7 km × 5.000 = 88.500 → 89.000
    expect(computeTravelFee(p, { mode: 'PER_KM', distanceKm: 12.35 })).toMatchObject({
      amount: 89_000,
      excessKm: 8.85,
      chargedKm: 17.7,
      roundTrip: true,
    });
    expect(computeTravelFee(p, { mode: 'PER_KM', distanceKm: 3.5 }).amount).toBe(0);
    expect(computeTravelFee(p, { mode: 'PER_KM', distanceKm: 1.5 }).amount).toBe(0);
  });
  it('theo km khi tổ chức chưa cài đơn giá → lỗi', () => {
    expect(() => computeTravelFee({ ...policy, perKmAmount: 0 }, { mode: 'PER_KM', distanceKm: 3 })).toThrow(ContractMathError);
  });
  it('theo km: km quá 2 chữ số thập phân → lỗi', () => {
    expect(() => computeTravelFee(policy, { mode: 'PER_KM', distanceKm: 3.333 })).toThrow(ContractMathError);
  });
  it('cố định có bán kính: đúng bằng bán kính → 0, vừa vượt → đủ mức; thiếu km → lỗi', () => {
    const p = { ...policy, freeKm: 5 };
    expect(computeTravelFee(p, { mode: 'FIXED', distanceKm: 5 }).amount).toBe(0);
    expect(computeTravelFee(p, { mode: 'FIXED', distanceKm: 5.01 }).amount).toBe(200_000);
    expect(computeTravelFee(p, { mode: 'FIXED', distanceKm: 6, includedKm: 8 }).amount).toBe(0);
    expect(() => computeTravelFee(p, { mode: 'FIXED' })).toThrow(/Cần số km để xét bán kính miễn phí 5 km/);
  });
  describe('theo bậc khoảng cách', () => {
    const tiers = [
      { fromKm: 10, toKm: 20, amount: 200_000 },
      { fromKm: 20, toKm: 30, amount: 400_000 },
      { fromKm: 30, toKm: null, amount: 700_000 },
    ];
    const p = { ...policy, freeKm: 10, tiers, roundTrip: true };
    it('trong bán kính → 0, không cần bậc', () => {
      expect(computeTravelFee(p, { mode: 'TIERED', distanceKm: 10 })).toMatchObject({ amount: 0, tier: null, excessKm: 0 });
      expect(computeTravelFee({ ...p, tiers: [] }, { mode: 'TIERED', distanceKm: 3 }).amount).toBe(0);
    });
    it('vừa vượt bán kính → bậc đầu; khứ hồi không nhân bậc', () => {
      expect(computeTravelFee(p, { mode: 'TIERED', distanceKm: 10.01 })).toMatchObject({ amount: 200_000, tier: tiers[0], chargedKm: null });
    });
    it('đúng ranh giới hai bậc → bậc sau (khoảng nửa mở)', () => {
      expect(computeTravelFee(p, { mode: 'TIERED', distanceKm: 19.99 }).amount).toBe(200_000);
      expect(computeTravelFee(p, { mode: 'TIERED', distanceKm: 20 }).amount).toBe(400_000);
    });
    it('bậc cuối không có km kết thúc nhận mọi khoảng cách lớn hơn', () => {
      expect(computeTravelFee(p, { mode: 'TIERED', distanceKm: 30 }).tier).toEqual(tiers[2]);
      expect(computeTravelFee(p, { mode: 'TIERED', distanceKm: 999.5 }).amount).toBe(700_000);
    });
    it('không bậc nào khớp → lỗi nêu số km, không tự đoán', () => {
      const gap = { ...p, freeKm: 5, tiers: [tiers[0]!, tiers[1]!] };
      expect(() => computeTravelFee(gap, { mode: 'TIERED', distanceKm: 7.5 })).toThrow('Chưa có bậc phí cho khoảng cách 7.5 km');
      expect(() => computeTravelFee(gap, { mode: 'TIERED', distanceKm: 35 })).toThrow(/Chưa có bậc phí cho khoảng cách 35 km/);
    });
  });
  it('nhập tay: bắt buộc số tiền, cho phép 0 = miễn phí; không xét bán kính', () => {
    expect(computeTravelFee(policy, { mode: 'MANUAL', amount: 150_000 }).amount).toBe(150_000);
    expect(computeTravelFee({ ...policy, freeKm: 50 }, { mode: 'MANUAL', amount: 90_000, distanceKm: 3 })).toMatchObject({
      amount: 90_000,
      includedKm: null,
    });
    expect(computeTravelFee(policy, { mode: 'MANUAL', amount: 0 }).amount).toBe(0);
    expect(() => computeTravelFee(policy, { mode: 'MANUAL' })).toThrow(ContractMathError);
  });
  it('nhập tay: tiền lẻ hoặc âm bị từ chối', () => {
    expect(() => computeTravelFee(policy, { mode: 'MANUAL', amount: 1.5 })).toThrow(RangeError);
    expect(() => computeTravelFee(policy, { mode: 'MANUAL', amount: -1 })).toThrow(ContractMathError);
  });
  it('gửi số tiền khi không phải nhập tay → lỗi, không bỏ qua im lặng', () => {
    expect(() => computeTravelFee(policy, { mode: 'FIXED', amount: 1 })).toThrow(ContractMathError);
    expect(() => computeTravelFee(policy, { mode: 'PER_KM', distanceKm: 1, amount: 1 })).toThrow(ContractMathError);
    expect(() => computeTravelFee(policy, { mode: 'TIERED', distanceKm: 1, amount: 1 })).toThrow(ContractMathError);
  });
});

describe('tổng hợp đồng', () => {
  it('bỏ dòng đã huỷ, trừ giảm giá', () => {
    expect(
      computeContractTotals(
        [
          { lineTotal: 1_000_000, voided: false },
          { lineTotal: 500_000, voided: true },
          { lineTotal: 200_000, voided: false },
        ],
        100_000,
      ),
    ).toEqual({ subtotal: 1_200_000, total: 1_100_000 });
  });
  it('không có dòng → 0', () => {
    expect(computeContractTotals([], 0)).toEqual({ subtotal: 0, total: 0 });
  });
  it('giảm giá bằng tổng → 0; vượt tổng → lỗi', () => {
    expect(computeContractTotals([{ lineTotal: 300_000, voided: false }], 300_000).total).toBe(0);
    expect(() => computeContractTotals([{ lineTotal: 300_000, voided: false }], 300_001)).toThrow(ContractMathError);
  });
  it('giảm giá lẻ đồng → lỗi', () => {
    expect(() => computeContractTotals([{ lineTotal: 300_000, voided: false }], 0.5)).toThrow(RangeError);
  });
});

describe('cọc gợi ý', () => {
  it('cộng cọc các gói, không vượt tổng', () => {
    expect(computeSuggestedDeposit([500_000, 300_000], 2_000_000)).toBe(800_000);
    expect(computeSuggestedDeposit([500_000, 300_000], 600_000)).toBe(600_000);
    expect(computeSuggestedDeposit([], 600_000)).toBe(0);
  });
});

describe('chuyển trạng thái hợp đồng', () => {
  it('nháp → xác nhận/huỷ; xác nhận → hoàn thành/huỷ; kết thúc thì đứng yên', () => {
    expect(canTransitionContract('DRAFT', 'CONFIRMED')).toBe(true);
    expect(canTransitionContract('DRAFT', 'COMPLETED')).toBe(false);
    expect(canTransitionContract('CONFIRMED', 'COMPLETED')).toBe(true);
    expect(canTransitionContract('CONFIRMED', 'DRAFT')).toBe(false);
    expect(canTransitionContract('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransitionContract('CANCELLED', 'DRAFT')).toBe(false);
  });
});
