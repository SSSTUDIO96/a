import { describe, expect, it } from 'vitest';
import { dayNumber, dm, dmy, hmInZone, partsInZone, weekdayDm, weekdayOfYmd, ymdInZone } from './time';
import { daysPastDue, nextSession } from './logic';
import { makeMe } from './fixtures';

describe('time: múi giờ trung tâm, không theo máy', () => {
  it('23:30 UTC ngày 10 = 06:30 ngày 11 ở Việt Nam, và còn ngày 10 ở UTC', () => {
    expect(ymdInZone('2026-11-10T23:30:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('2026-11-11');
    expect(ymdInZone('2026-11-10T23:30:00.000Z', 'UTC')).toBe('2026-11-10');
    expect(hmInZone('2026-11-10T11:00:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('18:00');
  });
  it('thứ trong tuần 1..7 (Chủ nhật = 7)', () => {
    expect(weekdayOfYmd('2026-11-10')).toBe(2);
    expect(weekdayOfYmd('2026-11-15')).toBe(7);
    expect(weekdayOfYmd('2027-03-01')).toBe(1);
    expect(partsInZone('2026-11-15T01:00:00.000Z', 'Asia/Ho_Chi_Minh').wd).toBe(7);
    expect(weekdayDm('2026-11-10')).toBe('Thứ Ba 10/11');
  });
  it('định dạng ngày; ngày hỏng → ném lỗi, múi giờ lạ → ném lỗi', () => {
    expect(dmy('2026-11-03')).toBe('03/11/2026');
    expect(dm('2026-11-03')).toBe('03/11');
    expect(() => dayNumber('11/03/2026')).toThrow();
    expect(() => ymdInZone('2026-11-10T00:00:00Z', 'Không/CóThật')).toThrow();
    expect(() => ymdInZone('không phải ngày', 'UTC')).toThrow();
  });
});

describe('logic', () => {
  it('daysPastDue: hạn 03/11 (giờ VN), hôm nay 10/11 → 7', () => {
    const now = Date.parse('2026-11-10T10:00:00Z');
    expect(daysPastDue('2026-11-02T17:00:00.000Z', now, 'Asia/Ho_Chi_Minh')).toBe(7);
    expect(daysPastDue('2026-11-16T17:00:00.000Z', now, 'Asia/Ho_Chi_Minh')).toBe(-7);
  });
  it('nextSession: bỏ buổi huỷ, buổi đã xong, buổi đã kết thúc; lớp huỷ không tính; không buổi → null', () => {
    const me = makeMe();
    const now = Date.parse(me.serverTime);
    expect(nextSession(me.enrollments, now)?.session.date).toBe('2026-11-10');
    expect(nextSession(me.enrollments, now)?.ordinal).toBe(2) // buổi 5/11 bị huỷ nên không đếm;
    expect(nextSession(me.enrollments, Date.parse('2026-11-10T16:00:00Z'))?.session.date).toBe('2026-11-12');
    expect(nextSession(me.enrollments, Date.parse('2026-12-01T00:00:00Z'))).toBeNull();
    me.enrollments[0]!.classStatus = 'CANCELLED';
    expect(nextSession(me.enrollments, now)).toBeNull();
    me.enrollments[0]!.classStatus = 'OPEN';
    me.enrollments[0]!.sessions = [];
    expect(nextSession(me.enrollments, now)).toBeNull();
  });
});
