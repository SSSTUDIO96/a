// Bài thử hàm thuần phụ phí tự động (bản vẽ D mục 2.4, 4.1). Mỗi chốt có vế BẮT (phải từ chối / không khớp) và vế GIỮ
// (phải nhận / khớp). Đột biến từng chốt phải làm tệp này đỏ (gói M2, báo cáo).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractMathError } from './contract';
import { MAX_MONEY_VND } from './money';
import {
  compareRules,
  computeAutoSurcharge,
  inWindow,
  isoWeekdayOf,
  localDateAndMinute,
  pickSurchargeRules,
  ruleHasTrigger,
  ruleMatches,
  surchargeQuantity,
  zonedInstant,
  type LineFacts,
  type RuleLike,
} from './surcharges';

const HCM = 'Asia/Ho_Chi_Minh';
const BKK = 'Asia/Bangkok';
const hm = (h: number, m = 0) => h * 60 + m;

function rule(over: Partial<RuleLike> = {}): RuleLike {
  return {
    id: 'r-1',
    name: 'Luật',
    serviceId: 's-1',
    sortOrder: 0,
    startMinute: null,
    endMinute: null,
    weekdays: [],
    dates: [],
    occasionIds: [],
    packageIds: [],
    subjectIds: [],
    perQuantity: true,
    ...over,
  };
}

function line(over: Partial<LineFacts> = {}): LineFacts {
  return { localDate: '2026-11-04', startMinute: hm(9), occasionId: null, packageId: null, subjectId: null, ...over };
}

const NONE = new Set<string>();
const ids = (rs: readonly RuleLike[]) => rs.map((r) => r.id);

// ---------------------------------------------------------------------------------------------------------------
describe('inWindow — khung giờ nửa mở [start, end)', () => {
  it('GIỮ: 00:00–06:00 nhận 00:00 và 05:59', () => {
    expect(inWindow(0, 0, hm(6))).toBe(true);
    expect(inWindow(hm(5, 59), 0, hm(6))).toBe(true);
  });
  it('BẮT: 00:00–06:00 không nhận đúng 06:00, không nhận 23:59', () => {
    expect(inWindow(hm(6), 0, hm(6))).toBe(false);
    expect(inWindow(hm(23, 59), 0, hm(6))).toBe(false);
  });
  it('GIỮ: 22:00–24:00 nhận 22:00 và 23:59 (end = 1440 = hết ngày)', () => {
    expect(inWindow(hm(22), hm(22), 1440)).toBe(true);
    expect(inWindow(hm(23, 59), hm(22), 1440)).toBe(true);
  });
  it('BẮT: 22:00–24:00 không nhận 00:00 (sang ngày mới) và 21:59', () => {
    expect(inWindow(0, hm(22), 1440)).toBe(false);
    expect(inWindow(hm(21, 59), hm(22), 1440)).toBe(false);
  });
  it('GIỮ: khung qua nửa đêm 22:00–04:00 nhận 22:00, 23:30, 00:00, 03:00, 03:59', () => {
    for (const m of [hm(22), hm(23, 30), 0, hm(3), hm(3, 59)]) expect(inWindow(m, hm(22), hm(4))).toBe(true);
  });
  it('BẮT: khung qua nửa đêm 22:00–04:00 không nhận 04:00, 12:00, 21:59', () => {
    for (const m of [hm(4), hm(12), hm(21, 59)]) expect(inWindow(m, hm(22), hm(4))).toBe(false);
  });
  it('BẮT: khung rỗng / phút ngoài miền / không nguyên → RangeError (database đã chặn, gặp là lỗi lập trình)', () => {
    expect(() => inWindow(hm(5), hm(5), hm(5))).toThrow(RangeError);
    expect(() => inWindow(1440, 0, hm(6))).toThrow(RangeError);
    expect(() => inWindow(-1, 0, hm(6))).toThrow(RangeError);
    expect(() => inWindow(1.5, 0, hm(6))).toThrow(RangeError);
    expect(() => inWindow(0, 1440, hm(6))).toThrow(RangeError);
    expect(() => inWindow(0, 0, 0)).toThrow(RangeError);
    expect(() => inWindow(0, 0, 1441)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('localDateAndMinute — ngày + phút theo múi giờ tổ chức', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('GIỮ: 2026-12-31T17:30Z ở Hồ Chí Minh là 00:30 ngày 01/01/2027, Thứ Sáu', () => {
    expect(localDateAndMinute(new Date('2026-12-31T17:30:00Z'), HCM)).toEqual({ date: '2027-01-01', minute: 30, weekday: 5 });
  });
  it('GIỮ: biên nửa đêm — 16:59Z là 23:59 ngày 31/12; 17:00Z là 00:00 ngày 01/01', () => {
    expect(localDateAndMinute(new Date('2026-12-31T16:59:00Z'), HCM)).toEqual({ date: '2026-12-31', minute: 1439, weekday: 4 });
    expect(localDateAndMinute(new Date('2026-12-31T17:00:00Z'), HCM)).toEqual({ date: '2027-01-01', minute: 0, weekday: 5 });
  });
  it('GIỮ: giây bị bỏ, không làm tròn lên phút sau', () => {
    expect(localDateAndMinute(new Date('2026-12-31T16:59:59.999Z'), HCM)).toEqual({ date: '2026-12-31', minute: 1439, weekday: 4 });
  });
  it('GIỮ: múi giờ khác — Asia/Bangkok (+7), UTC, New York (giờ mùa hè), Tokyo', () => {
    const t = new Date('2026-12-31T17:30:00Z');
    expect(localDateAndMinute(t, BKK)).toEqual({ date: '2027-01-01', minute: 30, weekday: 5 });
    expect(localDateAndMinute(t, 'UTC')).toEqual({ date: '2026-12-31', minute: hm(17, 30), weekday: 4 });
    expect(localDateAndMinute(new Date('2027-07-01T03:15:00Z'), 'America/New_York')).toEqual({ date: '2027-06-30', minute: hm(23, 15), weekday: 3 });
    expect(localDateAndMinute(new Date('2027-01-15T03:15:00Z'), 'America/New_York')).toEqual({ date: '2027-01-14', minute: hm(22, 15), weekday: 4 });
    expect(localDateAndMinute(new Date('2026-12-31T15:00:00Z'), 'Asia/Tokyo')).toEqual({ date: '2027-01-01', minute: 0, weekday: 5 });
  });
  it('GIỮ: không đọc giờ hệ thống, không đọc múi giờ máy chạy', () => {
    const t = new Date('2026-12-31T17:30:00Z');
    const want = localDateAndMinute(t, HCM);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-15T12:00:00Z'));
    const oldTz = process.env.TZ;
    try {
      process.env.TZ = 'America/Los_Angeles';
      expect(localDateAndMinute(t, HCM)).toEqual(want);
      process.env.TZ = 'Pacific/Kiritimati';
      expect(localDateAndMinute(t, HCM)).toEqual(want);
    } finally {
      if (oldTz === undefined) delete process.env.TZ;
      else process.env.TZ = oldTz;
    }
  });
  it('BẮT: thời điểm không hợp lệ, múi giờ sai → RangeError', () => {
    expect(() => localDateAndMinute(new Date('không phải ngày'), HCM)).toThrow(/thời điểm không hợp lệ/);
    expect(() => localDateAndMinute(new Date('2026-12-31T17:30:00Z'), 'Asia/Khong_Co')).toThrow(RangeError);
  });
});

describe('zonedInstant — chuyển từ courses/sessions.ts, giữ đúng hành vi cũ', () => {
  it('GIỮ: các ca của bài thử buổi học (apps/api/test/buoi-hoc-len-lich.test.ts)', () => {
    expect(zonedInstant('2027-03-01', 1080, HCM).toISOString()).toBe('2027-03-01T11:00:00.000Z');
    expect(zonedInstant('2027-03-01', 1440, HCM).toISOString()).toBe('2027-03-01T17:00:00.000Z');
    expect(zonedInstant('2027-07-01', 540, 'America/New_York').toISOString()).toBe('2027-07-01T13:00:00.000Z');
  });
  it('GIỮ: ngày đổi giờ mùa hè (New York 14/03/2027, 02:00 nhảy lên 03:00) — cần lần đoán thứ hai', () => {
    expect(zonedInstant('2027-03-14', hm(4), 'America/New_York').toISOString()).toBe('2027-03-14T08:00:00.000Z');
    expect(zonedInstant('2027-03-14', hm(1), 'America/New_York').toISOString()).toBe('2027-03-14T06:00:00.000Z');
  });
  it('GIỮ: đi một vòng zonedInstant → localDateAndMinute trả lại đúng ngày + phút', () => {
    for (const tz of [HCM, BKK, 'UTC', 'America/New_York', 'Asia/Tokyo']) {
      for (const [d, m] of [['2027-01-01', 0], ['2026-12-31', 1439], ['2027-07-04', hm(5, 30)], ['2028-02-29', hm(12)]] as const) {
        const back = localDateAndMinute(zonedInstant(d, m, tz), tz);
        expect({ date: back.date, minute: back.minute }).toEqual({ date: d, minute: m });
      }
    }
  });
});

describe('isoWeekdayOf', () => {
  it('GIỮ: 1 = Thứ Hai … 7 = Chủ nhật', () => {
    expect(isoWeekdayOf('2026-10-19')).toBe(1);
    expect(isoWeekdayOf('2026-10-24')).toBe(6);
    expect(isoWeekdayOf('2026-10-25')).toBe(7);
    expect(isoWeekdayOf('2028-02-29')).toBe(2);
  });
  it('BẮT: sai dạng hoặc ngày không có thật → RangeError (không âm thầm "không khớp")', () => {
    for (const bad of ['2026-1-1', '2026-02-30', '2027-02-29', '2026-13-01', '', '2026-10-19T00:00']) {
      expect(() => isoWeekdayOf(bad)).toThrow(RangeError);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('ruleMatches — từng điều kiện', () => {
  // 2026-11-04 là Thứ Tư; 2027-01-01 Thứ Sáu; 2027-01-02 Thứ Bảy; 2027-01-03 Chủ nhật.
  it('BẮT: luật không có điều kiện kích hoạt (chỉ gói / nhân vật, hoặc trống) không khớp dòng nào', () => {
    expect(ruleMatches(rule(), line())).toBe(false);
    expect(ruleMatches(rule({ packageIds: ['p-1'], subjectIds: ['sub-1'] }), line({ packageId: 'p-1', subjectId: 'sub-1' }))).toBe(false);
    expect(ruleHasTrigger(rule({ packageIds: ['p-1'] }))).toBe(false);
  });
  it('GIỮ: mỗi loại điều kiện kích hoạt đều đủ làm luật hợp lệ', () => {
    expect(ruleHasTrigger(rule({ startMinute: 0, endMinute: hm(6) }))).toBe(true);
    expect(ruleHasTrigger(rule({ weekdays: [7] }))).toBe(true);
    expect(ruleHasTrigger(rule({ dates: ['2027-01-01'] }))).toBe(true);
    expect(ruleHasTrigger(rule({ occasionIds: ['o-1'] }))).toBe(true);
  });

  describe('khung giờ', () => {
    const early = rule({ startMinute: 0, endMinute: hm(6) });
    const night = rule({ startMinute: hm(22), endMinute: hm(4) });
    it('GIỮ: ca 00:00 và 05:59 khớp "trước 6:00"', () => {
      expect(ruleMatches(early, line({ startMinute: 0 }))).toBe(true);
      expect(ruleMatches(early, line({ startMinute: hm(5, 59) }))).toBe(true);
    });
    it('BẮT: ca đúng 06:00 không khớp "trước 6:00"', () => {
      expect(ruleMatches(early, line({ startMinute: hm(6) }))).toBe(false);
    });
    it('GIỮ: khung qua nửa đêm khớp 23:30 và 03:00', () => {
      expect(ruleMatches(night, line({ startMinute: hm(23, 30) }))).toBe(true);
      expect(ruleMatches(night, line({ startMinute: hm(3) }))).toBe(true);
    });
    it('BẮT: khung qua nửa đêm không khớp 12:00', () => {
      expect(ruleMatches(night, line({ startMinute: hm(12) }))).toBe(false);
    });
    it('BẮT: dòng chưa có giờ không khớp luật có khung giờ', () => {
      expect(ruleMatches(early, line({ startMinute: null }))).toBe(false);
      expect(ruleMatches(night, line({ startMinute: null }))).toBe(false);
    });
    it('BẮT: khung chỉ có một đầu → RangeError (database chặn bằng CHECK surcharge_rules_window)', () => {
      expect(() => ruleMatches(rule({ startMinute: 0 }), line())).toThrow(RangeError);
      expect(() => ruleMatches(rule({ endMinute: hm(6) }), line())).toThrow(RangeError);
    });
  });

  describe('ngày: thứ trong tuần HOẶC ngày cụ thể', () => {
    const weekend = rule({ weekdays: [6, 7] });
    const newYear = rule({ dates: ['2027-01-01'] });
    const holidayOrSunday = rule({ weekdays: [7], dates: ['2027-01-01'] });
    it('GIỮ: thứ trong tuần khớp', () => {
      expect(ruleMatches(weekend, line({ localDate: '2027-01-02' }))).toBe(true);
      expect(ruleMatches(weekend, line({ localDate: '2027-01-03' }))).toBe(true);
    });
    it('BẮT: thứ khác không khớp', () => {
      expect(ruleMatches(weekend, line({ localDate: '2027-01-01' }))).toBe(false);
    });
    it('GIỮ / BẮT: ngày cụ thể', () => {
      expect(ruleMatches(newYear, line({ localDate: '2027-01-01' }))).toBe(true);
      expect(ruleMatches(newYear, line({ localDate: '2027-01-02' }))).toBe(false);
      expect(ruleMatches(newYear, line({ localDate: '2026-01-01' }))).toBe(false);
    });
    it('GIỮ: ngày lễ (Thứ Sáu) khớp qua ngày cụ thể, Chủ nhật khớp qua thứ — HOẶC', () => {
      expect(ruleMatches(holidayOrSunday, line({ localDate: '2027-01-01' }))).toBe(true);
      expect(ruleMatches(holidayOrSunday, line({ localDate: '2027-01-03' }))).toBe(true);
    });
    it('GIỮ: ngày lễ trùng đúng thứ đã chọn vẫn khớp (một lần)', () => {
      const sundayHoliday = rule({ weekdays: [7], dates: ['2027-01-03'] });
      expect(ruleMatches(sundayHoliday, line({ localDate: '2027-01-03' }))).toBe(true);
      expect(pickSurchargeRules([sundayHoliday], line({ localDate: '2027-01-03' }), NONE).kept).toHaveLength(1);
    });
    it('BẮT: ngày không phải lễ, không phải thứ đã chọn → không khớp', () => {
      expect(ruleMatches(holidayOrSunday, line({ localDate: '2027-01-02' }))).toBe(false);
    });
    it('BẮT: dòng không biết ngày không khớp luật có điều kiện ngày', () => {
      expect(ruleMatches(weekend, line({ localDate: null }))).toBe(false);
      expect(ruleMatches(newYear, line({ localDate: null }))).toBe(false);
    });
    it('BẮT: ngày của dòng sai dạng → RangeError, kể cả luật chỉ có ngày cụ thể', () => {
      expect(() => ruleMatches(newYear, line({ localDate: '01/01/2027' }))).toThrow(RangeError);
    });
    it('GIỮ: ca qua nửa đêm theo múi giờ tổ chức (17:30Z = 00:30 01/01) khớp luật ngày 01/01', () => {
      const f = localDateAndMinute(new Date('2026-12-31T17:30:00Z'), HCM);
      expect(ruleMatches(newYear, line({ localDate: f.date, startMinute: f.minute }))).toBe(true);
      const g = localDateAndMinute(new Date('2026-12-31T16:30:00Z'), HCM); // 23:30 ngày 31/12
      expect(ruleMatches(newYear, line({ localDate: g.date, startMinute: g.minute }))).toBe(false);
    });
  });

  describe('thuộc tập: loại sự kiện, gói, nhân vật', () => {
    it('GIỮ / BẮT: loại sự kiện', () => {
      const r = rule({ occasionIds: ['o-cuoi', 'o-hoi'] });
      expect(ruleMatches(r, line({ occasionId: 'o-hoi' }))).toBe(true);
      expect(ruleMatches(r, line({ occasionId: 'o-tiec' }))).toBe(false);
      expect(ruleMatches(r, line({ occasionId: null }))).toBe(false);
    });
    it('GIỮ / BẮT: gói — dòng dịch vụ lẻ (packageId null) không khớp', () => {
      const r = rule({ weekdays: [3], packageIds: ['p-1'] });
      expect(ruleMatches(r, line({ packageId: 'p-1' }))).toBe(true);
      expect(ruleMatches(r, line({ packageId: 'p-2' }))).toBe(false);
      expect(ruleMatches(r, line({ packageId: null }))).toBe(false);
    });
    it('GIỮ / BẮT: nhân vật', () => {
      const r = rule({ weekdays: [3], subjectIds: ['sub-dau'] });
      expect(ruleMatches(r, line({ subjectId: 'sub-dau' }))).toBe(true);
      expect(ruleMatches(r, line({ subjectId: 'sub-re' }))).toBe(false);
      expect(ruleMatches(r, line({ subjectId: null }))).toBe(false);
    });
  });

  describe('nhóm điều kiện nối bằng VÀ', () => {
    const r = rule({
      startMinute: 0,
      endMinute: hm(6),
      weekdays: [6, 7],
      occasionIds: ['o-cuoi'],
      packageIds: ['p-1'],
      subjectIds: ['sub-dau'],
    });
    const all: LineFacts = { localDate: '2027-01-02', startMinute: hm(5), occasionId: 'o-cuoi', packageId: 'p-1', subjectId: 'sub-dau' };
    it('GIỮ: đủ mọi điều kiện → khớp', () => {
      expect(ruleMatches(r, all)).toBe(true);
    });
    it('BẮT: sai đúng MỘT điều kiện bất kỳ → không khớp', () => {
      expect(ruleMatches(r, { ...all, startMinute: hm(6) })).toBe(false);
      expect(ruleMatches(r, { ...all, localDate: '2027-01-01' })).toBe(false);
      expect(ruleMatches(r, { ...all, occasionId: 'o-hoi' })).toBe(false);
      expect(ruleMatches(r, { ...all, packageId: 'p-2' })).toBe(false);
      expect(ruleMatches(r, { ...all, subjectId: 'sub-re' })).toBe(false);
    });
    it('GIỮ: điều kiện không điền thì không xét (luật chỉ có khung giờ khớp mọi ngày, mọi sự kiện)', () => {
      const onlyWindow = rule({ startMinute: 0, endMinute: hm(6) });
      expect(ruleMatches(onlyWindow, { localDate: null, startMinute: hm(1), occasionId: null, packageId: null, subjectId: null })).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('compareRules / pickSurchargeRules — chọn luật khi nhiều luật cùng khớp', () => {
  const early = (over: Partial<RuleLike>) => rule({ startMinute: 0, endMinute: hm(6), ...over });
  const at5 = line({ startMinute: hm(5), localDate: '2027-01-01' });

  it('GIỮ: khác dịch vụ → cộng dồn, mỗi luật một dòng, theo thứ tự sortOrder', () => {
    const a = early({ id: 'a', name: 'Ca sớm', serviceId: 's-som', sortOrder: 2 });
    const b = rule({ id: 'b', name: 'Ngày lễ', serviceId: 's-le', sortOrder: 1, dates: ['2027-01-01'] });
    const { kept, shadowed } = pickSurchargeRules([a, b], at5, NONE);
    expect(ids(kept)).toEqual(['b', 'a']);
    expect(shadowed).toEqual([]);
  });

  it('BẮT: cùng dịch vụ → chỉ luật xếp trên sinh dòng, luật kia vào shadowed kèm luật thắng', () => {
    const a = early({ id: 'a', name: 'A', sortOrder: 5 });
    const b = rule({ id: 'b', name: 'B', sortOrder: 1, dates: ['2027-01-01'] });
    const { kept, shadowed } = pickSurchargeRules([a, b], at5, NONE);
    expect(ids(kept)).toEqual(['b']);
    expect(shadowed).toEqual([{ rule: a, by: b }]);
  });

  it('BẮT: ba luật cùng dịch vụ → 1 giữ, 2 bị che đều bởi luật đứng đầu', () => {
    const rs = [early({ id: 'x', name: 'X', sortOrder: 3 }), early({ id: 'y', name: 'Y', sortOrder: 1 }), early({ id: 'z', name: 'Z', sortOrder: 2 })];
    const { kept, shadowed } = pickSurchargeRules(rs, at5, NONE);
    expect(ids(kept)).toEqual(['y']);
    expect(shadowed.map((s) => [s.rule.id, s.by.id])).toEqual([['z', 'y'], ['x', 'y']]);
  });

  it('GIỮ: cùng sortOrder → tên nhỏ trước; cùng tên → id nhỏ trước (theo mã ký tự, không theo locale máy)', () => {
    expect(compareRules({ sortOrder: 0, name: 'B', id: '1' }, { sortOrder: 0, name: 'A', id: '2' })).toBeGreaterThan(0);
    expect(compareRules({ sortOrder: 0, name: 'A', id: '2' }, { sortOrder: 0, name: 'A', id: '1' })).toBeGreaterThan(0);
    expect(compareRules({ sortOrder: 1, name: 'A', id: '1' }, { sortOrder: 0, name: 'Z', id: '9' })).toBeGreaterThan(0);
    expect(compareRules({ sortOrder: 0, name: 'A', id: '1' }, { sortOrder: 0, name: 'A', id: '1' })).toBe(0);
    const n1 = early({ id: 'n1', name: 'Phụ phí B', sortOrder: 0 });
    const n2 = early({ id: 'n2', name: 'Phụ phí A', sortOrder: 0 });
    expect(ids(pickSurchargeRules([n1, n2], at5, NONE).kept)).toEqual(['n2']);
    const i1 = early({ id: 'id-b', name: 'Cùng tên', sortOrder: 0 });
    const i2 = early({ id: 'id-a', name: 'Cùng tên', sortOrder: 0 });
    expect(ids(pickSurchargeRules([i1, i2], at5, NONE).kept)).toEqual(['id-a']);
  });

  it('GIỮ: tất định — mọi hoán vị thứ tự đầu vào cho cùng kết quả', () => {
    const rs = [
      early({ id: 'a', name: 'A', serviceId: 's-1', sortOrder: 2 }),
      early({ id: 'b', name: 'B', serviceId: 's-1', sortOrder: 1 }),
      early({ id: 'c', name: 'C', serviceId: 's-2', sortOrder: 1 }),
      early({ id: 'd', name: 'C', serviceId: 's-2', sortOrder: 1 }),
      rule({ id: 'e', name: 'E', serviceId: 's-3', sortOrder: 0, weekdays: [1] }), // không khớp (Thứ Sáu)
    ];
    const want = pickSurchargeRules(rs, at5, NONE);
    expect(ids(want.kept)).toEqual(['b', 'c']);
    expect(want.shadowed.map((s) => [s.rule.id, s.by.id])).toEqual([['d', 'c'], ['a', 'b']]);
    const perms = (xs: RuleLike[]): RuleLike[][] =>
      xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
    for (const p of perms(rs)) expect(pickSurchargeRules(p, at5, NONE)).toEqual(want);
  });

  it('GIỮ: không đổi mảng đầu vào', () => {
    const rs = [early({ id: 'b', sortOrder: 2 }), early({ id: 'a', sortOrder: 1 })];
    const before = ids(rs);
    pickSurchargeRules(rs, at5, NONE);
    expect(ids(rs)).toEqual(before);
  });

  it('BẮT: luật không khớp không vào kept, cũng không vào shadowed', () => {
    const a = early({ id: 'a', sortOrder: 1 });
    const off = rule({ id: 'off', sortOrder: 0, weekdays: [1] });
    const { kept, shadowed } = pickSurchargeRules([a, off], at5, NONE);
    expect(ids(kept)).toEqual(['a']);
    expect(shadowed).toEqual([]);
  });

  it('BẮT: luật người lập đã bỏ không được chọn lại', () => {
    const a = early({ id: 'a', serviceId: 's-1' });
    const b = rule({ id: 'b', serviceId: 's-2', dates: ['2027-01-01'] });
    expect(ids(pickSurchargeRules([a, b], at5, new Set(['a'])).kept)).toEqual(['b']);
    expect(pickSurchargeRules([a], at5, new Set(['a']))).toEqual({ kept: [], shadowed: [] });
  });

  it('GIỮ: luật đã bỏ không che luật cùng dịch vụ xếp dưới — luật dưới được áp', () => {
    const top = early({ id: 'top', name: 'Trên', sortOrder: 0 });
    const low = early({ id: 'low', name: 'Dưới', sortOrder: 1 });
    const { kept, shadowed } = pickSurchargeRules([top, low], at5, new Set(['top']));
    expect(ids(kept)).toEqual(['low']);
    expect(shadowed).toEqual([]);
  });

  it('GIỮ: bỏ luật hiện không khớp — đổi giờ đi rồi đổi lại vẫn không tự thêm lại', () => {
    const a = early({ id: 'a' });
    const dismissed = new Set(['a']);
    expect(pickSurchargeRules([a], line({ startMinute: hm(9) }), dismissed).kept).toEqual([]);
    expect(pickSurchargeRules([a], line({ startMinute: hm(5) }), dismissed).kept).toEqual([]);
  });

  it('GIỮ: cùng id xuất hiện hai lần chỉ tính một lần (không tự che chính mình)', () => {
    const a = early({ id: 'a' });
    expect(pickSurchargeRules([a, { ...a }], at5, NONE)).toEqual({ kept: [a], shadowed: [] });
  });

  it('GIỮ: trả đúng đối tượng luật của người gọi (kiểu mở rộng giữ nguyên)', () => {
    const a = { ...early({ id: 'a' }), extra: 42 };
    const { kept } = pickSurchargeRules([a], at5, NONE);
    expect(kept[0]?.extra).toBe(42);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('surchargeQuantity — số lượng nhân theo dòng (ký duyệt D câu 5)', () => {
  it('GIỮ: perQuantity — phù dâu × 2 → phụ phí × 2; × 1 → × 1', () => {
    expect(surchargeQuantity(true, 2)).toBe(2);
    expect(surchargeQuantity(true, 1)).toBe(1);
  });
  it('GIỮ: không theo người → luôn 1', () => {
    expect(surchargeQuantity(false, 2)).toBe(1);
    expect(surchargeQuantity(false, 1)).toBe(1);
  });
  it('GIỮ: người lập sửa số lượng thì theo số đã sửa', () => {
    expect(surchargeQuantity(true, 2, 3)).toBe(3);
    expect(surchargeQuantity(false, 2, 1)).toBe(1);
  });
  it('BẮT: số lượng 0, âm, lẻ (dòng hoặc số đã sửa) → ContractMathError, không làm tròn', () => {
    for (const q of [0, -1, 1.5, Number.NaN]) {
      expect(() => surchargeQuantity(true, q)).toThrow(ContractMathError);
      expect(() => surchargeQuantity(false, q)).toThrow(ContractMathError);
      expect(() => surchargeQuantity(true, 2, q)).toThrow(ContractMathError);
    }
  });
});

describe('computeAutoSurcharge — thành tiền dòng tự thêm (số nguyên đồng, không làm tròn)', () => {
  it('GIỮ: giá bảng giá × số lượng dòng', () => {
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: 200_000 })).toEqual({
      ok: true,
      quantity: 2,
      unitPrice: 200_000,
      lineTotal: 400_000,
      overridden: false,
      priceOverridden: false,
    });
    expect(computeAutoSurcharge({ perQuantity: false, lineQuantity: 2, listPrice: 200_000 })).toMatchObject({ ok: true, quantity: 1, lineTotal: 200_000 });
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 1, listPrice: 200_000 })).toMatchObject({ ok: true, quantity: 1, lineTotal: 200_000 });
  });
  it('BẮT: số lượng dòng 0 → ContractMathError', () => {
    expect(() => computeAutoSurcharge({ perQuantity: true, lineQuantity: 0, listPrice: 200_000 })).toThrow(ContractMathError);
  });
  it('BẮT: thiếu giá → NO_PRICE (máy chủ bỏ qua luật, không chặn hợp đồng)', () => {
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: null })).toEqual({ ok: false, reason: 'NO_PRICE' });
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: null, override: { quantity: 1 } })).toEqual({
      ok: false,
      reason: 'NO_PRICE',
    });
  });
  it('GIỮ: giá 0 đồng là CÓ giá (khác thiếu giá)', () => {
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: 0 })).toMatchObject({ ok: true, unitPrice: 0, lineTotal: 0 });
  });
  it('GIỮ: thiếu giá bảng giá nhưng người lập sửa giá → dùng giá đã sửa', () => {
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: null, override: { unitPrice: 150_000 } })).toEqual({
      ok: true,
      quantity: 2,
      unitPrice: 150_000,
      lineTotal: 300_000,
      overridden: true,
      priceOverridden: true,
    });
  });
  it('GIỮ: giá đã sửa thắng giá bảng giá; sửa số lượng chỉ đổi số lượng', () => {
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: 200_000, override: { unitPrice: 0 } })).toMatchObject({
      unitPrice: 0,
      lineTotal: 0,
      priceOverridden: true,
    });
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: 200_000, override: { quantity: 3 } })).toEqual({
      ok: true,
      quantity: 3,
      unitPrice: 200_000,
      lineTotal: 600_000,
      overridden: true,
      priceOverridden: false,
    });
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: 200_000, override: {} })).toMatchObject({ overridden: false });
  });
  it('GIỮ: không làm tròn — 333.333 × 3 = 999.999 đúng từng đồng', () => {
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 3, listPrice: 333_333 })).toMatchObject({ lineTotal: 999_999 });
  });
  it('GIỮ: không kẹp trần — vượt MAX_MONEY_VND trả nguyên số để máy chủ báo bằng assertLineCap', () => {
    expect(computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: MAX_MONEY_VND })).toMatchObject({
      lineTotal: MAX_MONEY_VND * 2,
    });
  });
  it('BẮT: vượt số nguyên an toàn → ContractMathError (không làm tròn im lặng); giá lẻ / âm bị từ chối', () => {
    expect(() => computeAutoSurcharge({ perQuantity: true, lineQuantity: 2, listPrice: Number.MAX_SAFE_INTEGER })).toThrow(ContractMathError);
    expect(() => computeAutoSurcharge({ perQuantity: true, lineQuantity: 1, listPrice: 1000.5 })).toThrow(RangeError);
    expect(() => computeAutoSurcharge({ perQuantity: true, lineQuantity: 1, listPrice: -1 })).toThrow(ContractMathError);
    expect(() => computeAutoSurcharge({ perQuantity: true, lineQuantity: 1, listPrice: 1, override: { unitPrice: -5 } })).toThrow(ContractMathError);
  });
});
