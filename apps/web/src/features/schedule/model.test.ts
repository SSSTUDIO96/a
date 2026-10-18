import { describe, expect, it } from 'vitest';
import { STATUS_TRANSITIONS } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type { Appointment, StaffMember } from '../../api/types';
import {
  axisHours,
  blockSpan,
  buildStaffLanes,
  cellKey,
  conflictMarks,
  conflictsOf,
  countByDay,
  dayPartOf,
  daysOf,
  DEFAULT_MODE,
  indexByCell,
  layoutLanes,
  MODE_OPTIONS,
  nextStatuses,
  toneOf,
  UNASSIGNED,
} from './model';
import { addDays, dayKeyOf, formatHours, hhmm, weekDays, weekLabel, weekRange, weekStartOf } from './time';

function appt(p: Partial<Appointment> & { id: string; startsAt: string; endsAt: string }): Appointment {
  return {
    code: `L-${p.id}`,
    kind: 'MAKEUP',
    title: null,
    status: 'CONFIRMED',
    customer: null,
    contract: null,
    contractLineId: null,
    travelBeforeMin: 0,
    travelAfterMin: 0,
    locationType: null,
    address: null,
    latitude: null,
    longitude: null,
    notes: null,
    cancelReason: null,
    staff: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...p,
  };
}

const staffOf = (membershipId: string, fullName = membershipId) => ({
  membershipId,
  fullName,
  role: 'PRIMARY' as const,
  blockStart: '',
  blockEnd: '',
  isBlocking: true,
});

function member(p: Partial<StaffMember> & { membershipId: string; displayName: string }): StaffMember {
  return {
    userId: `u-${p.membershipId}`,
    fullName: p.displayName,
    initials: 'XX',
    avatarUrl: null,
    phone: null,
    tier: null,
    isBookable: true,
    hasProfile: true,
    status: 'ACTIVE',
    roleKeys: ['artist'],
    ...p,
  };
}

describe('chế độ xem', () => {
  it('mặc định là C, đủ 3 chế độ theo thứ tự C · B · A', () => {
    expect(DEFAULT_MODE).toBe('C');
    expect(MODE_OPTIONS.map((o) => o.value)).toEqual(['C', 'B', 'A']);
    expect(MODE_OPTIONS.map((o) => o.label)).toEqual(['Thợ × ngày', 'Ngày', 'Cột thợ']);
  });
});

describe('giờ Việt Nam', () => {
  it('ngày và giờ hiển thị theo UTC+7, kể cả quanh nửa đêm UTC', () => {
    expect(dayKeyOf('2026-10-23T17:30:00.000Z')).toBe('2026-10-24');
    expect(hhmm('2026-10-23T21:30:00.000Z')).toBe('04:30');
  });

  it('tuần bắt đầu Thứ Hai; khoảng gọi máy chủ là [Thứ Hai 00:00, Thứ Hai sau 00:00) +07:00', () => {
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19');
    expect(weekDays('2026-10-21')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(weekRange('2026-10-24')).toEqual({ from: '2026-10-19T00:00:00+07:00', to: '2026-10-26T00:00:00+07:00' });
    expect(weekLabel('2026-10-21')).toBe('19 – 25/10/2026');
    expect(weekLabel('2026-10-01')).toBe('28/09 – 04/10/2026');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('số giờ có dấu phẩy thập phân', () => {
    expect(formatHours(270)).toBe('4,5 giờ');
    expect(formatHours(105)).toBe('1,75 giờ');
  });
});

describe('xếp ca vào ô (thợ × ngày)', () => {
  const list = [
    appt({ id: '1', startsAt: '2026-10-24T01:00:00+07:00', endsAt: '2026-10-24T03:00:00+07:00', staff: [staffOf('ha'), { ...staffOf('vy'), role: 'ASSIST' }] }),
    appt({ id: '2', startsAt: '2026-10-24T15:00:00+07:00', endsAt: '2026-10-24T16:00:00+07:00' }),
    // Ca qua đêm: 22:00 thứ Bảy → 02:00 Chủ nhật.
    appt({ id: '3', startsAt: '2026-10-24T22:00:00+07:00', endsAt: '2026-10-25T02:00:00+07:00', staff: [staffOf('ha')] }),
    // Kết thúc đúng 00:00 thì không sang ngày sau.
    appt({ id: '4', startsAt: '2026-10-24T20:00:00+07:00', endsAt: '2026-10-25T00:00:00+07:00', staff: [staffOf('anh')] }),
  ];

  it('ca 2 thợ nằm ở cả 2 hàng; ca chưa có thợ ở hàng "Chưa có thợ"; ca qua đêm nằm ở cả 2 ngày', () => {
    const cells = indexByCell(list);
    expect(cells.get(cellKey('ha', '2026-10-24'))?.map((a) => a.id)).toEqual(['1', '3']);
    expect(cells.get(cellKey('vy', '2026-10-24'))?.map((a) => a.id)).toEqual(['1']);
    expect(cells.get(cellKey(UNASSIGNED, '2026-10-24'))?.map((a) => a.id)).toEqual(['2']);
    expect(cells.get(cellKey('ha', '2026-10-25'))?.map((a) => a.id)).toEqual(['3']);
    expect(cells.get(cellKey('anh', '2026-10-25'))).toBeUndefined();
    expect(daysOf(list[3]!)).toEqual(['2026-10-24']);
  });

  it('đếm ca theo ngày không đếm lặp ca nhiều thợ', () => {
    const c = countByDay(list, weekDays('2026-10-24'));
    expect(c['2026-10-24']).toBe(4);
    expect(c['2026-10-25']).toBe(1);
  });
});

describe('xếp làn cho ca chồng giờ (chế độ A)', () => {
  const t = (h: number, m = 0) => Date.UTC(2026, 9, 24, h, m);

  it('3 ca chồng nhau → 3 làn; ca nối đuôi (kết thúc đúng lúc ca sau bắt đầu) dùng lại làn', () => {
    const lanes = layoutLanes([
      { id: 'a', start: t(4, 30), end: t(6, 30) },
      { id: 'b', start: t(6), end: t(7, 30) },
      { id: 'c', start: t(5), end: t(6, 15) },
      { id: 'd', start: t(7, 30), end: t(8) },
    ]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 3 });
    expect(lanes.get('c')).toEqual({ lane: 1, lanes: 3 });
    expect(lanes.get('b')).toEqual({ lane: 2, lanes: 3 });
    // d bắt đầu 07:30 = lúc b kết thúc → cụm mới, một làn, rộng hết cột.
    expect(lanes.get('d')).toEqual({ lane: 0, lanes: 1 });
  });

  it('ca dài bắc cầu hai ca ngắn rời nhau → cùng một cụm 2 làn', () => {
    const lanes = layoutLanes([
      { id: 'dai', start: t(4), end: t(12) },
      { id: 'sang', start: t(5), end: t(6) },
      { id: 'trua', start: t(10), end: t(11) },
    ]);
    expect(lanes.get('dai')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('sang')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('trua')).toEqual({ lane: 1, lanes: 2 });
  });

  it('khoảng bận gồm thời gian di chuyển; trục giờ nới khỏi 04–18 khi có ca ngoài khung', () => {
    const a = appt({ id: 'x', startsAt: '2026-10-24T19:00:00+07:00', endsAt: '2026-10-24T21:00:00+07:00', travelBeforeMin: 30, travelAfterMin: 45 });
    const s = blockSpan(a);
    expect(hhmm(s.start)).toBe('18:30');
    expect(hhmm(s.end)).toBe('21:45');
    expect(axisHours([s], '2026-10-24')).toEqual([4, 22]);
    expect(axisHours([], '2026-10-24')).toEqual([4, 18]);
  });
});

describe('hàng thợ theo quyền', () => {
  const staff = [
    member({ membershipId: 'ha', displayName: 'Thu Hà', tier: { id: 't1', name: 'Thợ chính', isActive: true } }),
    member({ membershipId: 'anh', displayName: 'Minh Anh' }),
    member({ membershipId: 'chu', displayName: 'Chủ studio', hasProfile: false, roleKeys: ['owner'] }),
    member({ membershipId: 'tat', displayName: 'Đã tắt', isBookable: false }),
  ];
  const list = [appt({ id: '1', startsAt: '2026-10-24T08:00:00+07:00', endsAt: '2026-10-24T09:00:00+07:00', staff: [staffOf('tat', 'Đã tắt')] })];

  it('schedule.read_own: chỉ một hàng là chính mình', () => {
    const lanes = buildStaffLanes({ staff, appointments: [], readAll: false, self: { membershipId: 'anh', name: 'Minh Anh' } });
    expect(lanes.map((l) => l.membershipId)).toEqual(['anh']);
  });

  it('schedule.read_own không có staff.read: hàng lấy tên tài khoản', () => {
    const lanes = buildStaffLanes({ staff: null, appointments: [], readAll: false, self: { membershipId: 'm9', name: 'Phạm Bảo Vy' } });
    expect(lanes).toEqual([{ membershipId: 'm9', name: 'Phạm Bảo Vy', avatarUrl: null, tierName: null }]);
  });

  it('schedule.read_all: thợ đang nhận lịch + người đang có ca (kể cả đã tắt nhận lịch); bỏ chủ studio không phải thợ', () => {
    const lanes = buildStaffLanes({ staff, appointments: list, readAll: true, self: { membershipId: 'chu', name: 'Chủ' } });
    expect(lanes.map((l) => l.membershipId)).toEqual(['ha', 'anh', 'tat']);
    expect(lanes[0]?.tierName).toBe('Thợ chính');
  });
});

describe('409 trùng lịch', () => {
  const conflict = {
    appointmentId: 'c1',
    code: 'L-0123',
    startsAt: '2026-10-24T06:00:00+07:00',
    endsAt: '2026-10-24T07:30:00+07:00',
    blockStart: '2026-10-24T06:00:00+07:00',
    blockEnd: '2026-10-24T07:30:00+07:00',
    membershipId: 'ha',
    staffName: 'Thu Hà',
  };

  it('đọc details.conflicts của 409; lỗi 409 khác và lỗi 400 trả null', () => {
    expect(conflictsOf(new ApiError('CONFLICT', 'Trùng lịch: Thu Hà đã có lịch L-0123', 409, 'r', { conflicts: [conflict] }))).toEqual([conflict]);
    expect(conflictsOf(new ApiError('CONFLICT', 'Không chuyển được', 409, 'r', { from: 'DRAFT', to: 'COMPLETED' }))).toBeNull();
    expect(conflictsOf(new ApiError('VALIDATION_FAILED', 'Sai', 400, 'r', { conflicts: [conflict] }))).toBeNull();
  });

  it('đánh dấu ô (thợ × ngày) và ca cần viền đỏ, đếm số ca trùng', () => {
    const m = conflictMarks([conflict, { ...conflict, membershipId: 'vy', staffName: 'Bảo Vy' }]);
    expect(m.count).toBe(1);
    expect(m.appointmentIds.has('c1')).toBe(true);
    expect([...m.cells.keys()].sort()).toEqual([cellKey('ha', '2026-10-24'), cellKey('vy', '2026-10-24')]);
    expect(conflictMarks(null).count).toBe(0);
  });
});

describe('linh tinh', () => {
  it('nút trạng thái lấy đúng bảng chuyển của packages/shared', () => {
    expect(nextStatuses('CONFIRMED')).toBe(STATUS_TRANSITIONS.CONFIRMED);
    expect(nextStatuses('COMPLETED')).toEqual([]);
  });

  it('buổi: sáng sớm < 07:00 ≤ buổi sáng < 12:00 ≤ buổi chiều', () => {
    const at = (t: string) => dayPartOf({ startsAt: `2026-10-24T${t}:00+07:00` }, '2026-10-24');
    expect([at('04:30'), at('06:59'), at('07:00'), at('11:59'), at('12:00'), at('19:00')]).toEqual([
      'early',
      'early',
      'morning',
      'morning',
      'afternoon',
      'afternoon',
    ]);
  });

  it('màu theo chữ trong tên ca', () => {
    expect(toneOf('Makeup ăn hỏi')).toBe('engagement');
    expect(toneOf('Gói Cưới Trọn Vẹn — Cô dâu')).toBe('bride');
    expect(toneOf('Makeup tiệc')).toBe('event');
    expect(toneOf(null)).toBe('other');
  });
});
