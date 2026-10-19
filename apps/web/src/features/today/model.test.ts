import { describe, expect, it } from 'vitest';
import { appt, fullView, inst, TZ } from './fixtures';
import {
  dayLabel,
  dueLabel,
  dueOnEventDay,
  groupByDay,
  groupByStaff,
  hhmm,
  localDateOf,
  locationLine,
  needsCounts,
  nextAppointment,
  NO_STAFF_LABEL,
  pageTitle,
  scheduleLink,
  sinceLabel,
  swatchOf,
} from './model';

describe('nhãn ngày giờ theo múi giờ tổ chức', () => {
  it('tiêu đề trang theo ngày máy chủ trả', () => {
    expect(pageTitle('2026-11-21')).toBe('Hôm nay · Thứ Bảy 21/11');
    expect(dayLabel('2026-11-22')).toBe('Chủ nhật 22/11');
    expect(dayLabel('2026-11-23')).toBe('Thứ Hai 23/11');
  });
  it('giờ và ngày đổi theo múi giờ tổ chức, không theo máy chạy bài thử', () => {
    expect(hhmm('2026-11-21T08:00:00.000Z', TZ)).toBe('15:00');
    expect(hhmm('2026-11-21T08:00:00.000Z', 'UTC')).toBe('08:00');
    expect(localDateOf('2026-11-21T17:30:00.000Z', TZ)).toBe('2026-11-22');
    expect(localDateOf('2026-11-21T17:30:00.000Z', 'UTC')).toBe('2026-11-21');
  });
  it('thiếu múi giờ hoặc ngày sai thì ném lỗi, không đoán', () => {
    expect(() => hhmm('2026-11-21T08:00:00.000Z', '')).toThrow(/múi giờ/);
    expect(() => dayLabel('21/11/2026')).toThrow(/Ngày không hợp lệ/);
  });
  it('"hôm nay / hôm qua / dd/mm" so với ngày máy chủ', () => {
    const v = { timezone: TZ, today: '2026-11-21' };
    expect(sinceLabel('2026-11-20T13:14:00.000Z', v)).toBe('20:14 hôm qua');
    expect(sinceLabel('2026-11-21T02:05:00.000Z', v)).toBe('09:05 hôm nay');
    expect(sinceLabel('2026-11-18T02:05:00.000Z', v)).toBe('09:05 18/11');
    // Qua đầu tháng: hôm qua của 01/12 là 30/11.
    expect(sinceLabel('2026-11-30T10:00:00.000Z', { timezone: TZ, today: '2026-12-01' })).toBe('17:00 hôm qua');
  });
});

describe('ca kế tiếp, gom theo thợ / theo ngày', () => {
  it('ca kế tiếp là ca bắt đầu sớm nhất từ lúc máy chủ tạo số liệu; hết ca thì null', () => {
    const early = appt({ id: 'a', startsAt: '2026-11-20T23:00:00.000Z' }); // 06:00, đã qua so với 07:30
    const late = appt({ id: 'b', startsAt: '2026-11-21T08:00:00.000Z' });
    const later = appt({ id: 'c', startsAt: '2026-11-21T10:00:00.000Z' });
    const v = fullView({ appointments: { today: [later, early, late], tomorrow: [], later: [], truncated: false } });
    expect(nextAppointment(v)?.id).toBe('b');
    expect(nextAppointment(fullView({ appointments: { today: [early], tomorrow: [], later: [], truncated: false } }))).toBeNull();
  });
  it('gom ca theo thợ: ca nhiều thợ có mặt ở mỗi thợ; ca chưa có thợ ở nhóm "Chưa có thợ" CUỐI', () => {
    const v = fullView();
    const groups = groupByStaff(v.appointments?.tomorrow ?? []);
    expect(groups.map((g) => [g.name, g.appointments.map((a) => hhmm(a.startsAt, TZ))])).toEqual([
      ['Linh Trần', ['05:00', '13:00']],
      ['Mai', ['13:00']],
      [NO_STAFF_LABEL, ['15:00']],
    ]);
    expect(groups.at(-1)?.membershipId).toBeNull();
  });
  it('gom theo ngày: ngày sớm trước, trong ngày theo giờ; ngày tính theo múi giờ tổ chức', () => {
    const a = appt({ id: 'a', startsAt: '2026-11-24T01:00:00.000Z' });
    const b = appt({ id: 'b', startsAt: '2026-11-23T17:30:00.000Z' }); // 00:30 ngày 24/11 giờ Việt Nam
    const c = appt({ id: 'c', startsAt: '2026-11-28T22:30:00.000Z' }); // 05:30 ngày 29/11
    expect(groupByDay([c, a, b], TZ).map((g) => [g.date, g.appointments.map((x) => x.id)])).toEqual([
      ['2026-11-24', ['b', 'a']],
      ['2026-11-29', ['c']],
    ]);
  });
});

describe('nhãn đợt thu và nơi làm', () => {
  it('đợt quá hạn "Hạn 18/11 (quá 3 ngày)"; đợt chưa quá hạn "Hạn Thứ Ba 24/11"', () => {
    expect(dueLabel(inst(), TZ)).toBe('Hạn 18/11 (quá 3 ngày)');
    expect(dueLabel(inst({ status: 'DUE', overdueDays: 0, dueDate: '2026-11-24T16:59:59.000Z' }), TZ)).toBe('Hạn Thứ Ba 24/11');
  });
  it('"ngày sự kiện" khi hạn trùng ngày sự kiện (theo múi giờ tổ chức)', () => {
    const i = inst({ dueDate: '2026-11-24T16:59:59.000Z', contract: { id: 'h', code: 'H', eventDate: '2026-11-24T02:00:00.000Z' } });
    expect(dueOnEventDay(i, TZ)).toBe(true);
    expect(dueOnEventDay(inst({ contract: { id: 'h', code: 'H', eventDate: null } }), TZ)).toBe(false);
    expect(dueOnEventDay(inst({ contract: { id: 'h', code: 'H', eventDate: '2026-12-01T02:00:00.000Z' } }), TZ)).toBe(false);
  });
  it('nơi làm: "Tại nhà khách – địa chỉ · đi trước N phút"; thiếu phần nào bỏ phần đó', () => {
    expect(locationLine(appt({ locationType: 'CUSTOMER_HOME', address: '25 Nguyễn Văn Cừ', travelBeforeMin: 30 }))).toBe('Tại nhà khách – 25 Nguyễn Văn Cừ · đi trước 30 phút');
    expect(locationLine(appt({ locationType: 'STUDIO', address: null, travelBeforeMin: 0 }))).toBe('Tại studio');
    expect(locationLine(appt({ locationType: null, address: null, travelBeforeMin: 0 }))).toBe('');
  });
  it('màu ca theo sự kiện; chưa có sự kiện → trung tính', () => {
    expect(swatchOf(appt({ occasion: { id: 'o', name: 'Lễ cưới', color: 'plum' } }))).toBe('plum');
    expect(swatchOf(appt({ occasion: null }))).toBe('other');
  });
  it('đường tới ca trên Lịch', () => {
    expect(scheduleLink('hoa-dao', '2026-11-22', 'ca-1')).toBe('/hoa-dao/lich?ngay=2026-11-22&ca=ca-1');
  });
});

describe('số việc "Cần làm ngay"', () => {
  it('cộng số máy chủ đếm trên toàn bộ (không đếm phần được vẽ)', () => {
    const v = fullView({ counts: { ...fullView().counts, overdue: { count: 120, amount: 9_000_000 }, unassignedSoon: 70 } });
    expect(needsCounts(v)).toEqual({ overdue: 120, unassigned: 70, classes: 1, total: 191 });
  });
  it('thẻ thiếu quyền (null) không tính; cả ba null → không có thẻ', () => {
    const noMoney = fullView({ installments: null, counts: { ...fullView().counts, overdue: null, dueSoon: null } });
    expect(needsCounts(noMoney)).toEqual({ overdue: 0, unassigned: 1, classes: 1, total: 2 });
    const none = fullView({ installments: null, unassigned: null, almostFullClasses: null, counts: { ...fullView().counts, overdue: null, dueSoon: null, unassignedSoon: null } });
    expect(needsCounts(none)).toBeNull();
  });
});
