import { describe, expect, it } from 'vitest';
import { isBlockingStatus, STATUS_TRANSITIONS, WORK_STATUSES } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type { Appointment, StaffMember } from '../../api/types';
import {
  axisFromMinutes,
  axisHours,
  axisTicks,
  countByLane,
  countLive,
  dayLoad,
  isBlocking,
  isLive,
  loadAxisHours,
  needsStaff,
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
  kindLabel,
  kindText,
  laneShortNames,
  quantityText,
  layoutLanes,
  MODE_OPTIONS,
  nextStatuses,
  legendSubjects,
  isCourseSession,
  whoText,
  swatchOf,
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
    subjectName: null,
    quantity: null,
    courseClass: null,
    sessionDate: null,
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
  displayName: fullName,
  avatarUrl: null,
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

});

describe('màu ca theo nhân vật (subjectName)', () => {
  const ORG = ['Cô dâu', 'Chú rể', 'Mẹ cô dâu', 'Mẹ chú rể', 'Phù dâu', 'Khách mời', 'Bà nội', 'Em bé'];

  it('nhân vật cài sẵn có màu cố định, không phân biệt hoa thường và khoảng trắng', () => {
    expect(swatchOf('Cô dâu', ORG)).toBe('rose');
    expect(swatchOf(' cô dâu ', [])).toBe('rose');
    expect(swatchOf('Mẹ cô dâu', ORG)).toBe('violet');
    expect(swatchOf('Phù dâu', ORG)).toBe('amber');
    expect(swatchOf('Mẹ chú rể', ORG)).toBe('green');
    expect(swatchOf('Chú rể', ORG)).toBe('blue');
    expect(swatchOf('Khách mời', ORG)).toBe('taupe');
  });

  it('subjectName null hoặc rỗng → "Khác"; KHÔNG đoán theo chữ trong tên ca', () => {
    expect(swatchOf(null, ORG)).toBe('other');
    expect(swatchOf('  ', ORG)).toBe('other');
    // Tên ca có "cô dâu", "ăn hỏi" nhưng không có nhân vật → vẫn "Khác".
    const a = appt({ id: 'x', title: 'Makeup cô dâu ăn hỏi tiệc', startsAt: '2026-10-24T08:00:00+07:00', endsAt: '2026-10-24T09:00:00+07:00' });
    expect(swatchOf(a.subjectName, ORG)).toBe('other');
  });

  it('nhân vật tổ chức tự thêm: màu mới theo thứ tự trong danh sách của tổ chức (không trùng nhân vật cài sẵn); không có trong danh sách → cố định theo tên', () => {
    expect(swatchOf('Bà nội', ORG)).toBe('brick'); // nhân vật thứ 7: màu mới đầu tiên (trước đây trùng "Cô dâu")
    expect(swatchOf('Em bé', ORG)).toBe('petrol'); // thứ 8
    const lạ = swatchOf('Bạn thân cô dâu', ORG);
    expect(lạ).not.toBe('other');
    expect(swatchOf('Bạn thân cô dâu', [])).toBe(lạ);
  });

  it('chú thích màu: nhân vật thật có trong tuần theo thứ tự của tổ chức, cuối cùng là "Khác"', () => {
    const at = (id: string, subjectName: string | null) =>
      appt({ id, subjectName, startsAt: '2026-10-24T08:00:00+07:00', endsAt: '2026-10-24T09:00:00+07:00' });
    expect(legendSubjects([at('1', 'Phù dâu'), at('2', null), at('3', 'Cô dâu'), at('4', 'Cô dâu')], ORG)).toEqual([
      { name: 'Cô dâu', label: 'Cô dâu' },
      { name: 'Phù dâu', label: 'Phù dâu' },
      { name: null, label: 'Khác' },
    ]);
    expect(legendSubjects([at('1', 'Cô dâu')], ORG)).toEqual([{ name: 'Cô dâu', label: 'Cô dâu' }]);
  });

  it('hàng thợ lấy từ ca dùng displayName và avatarUrl của ca', () => {
    const a = appt({
      id: '1',
      startsAt: '2026-10-24T08:00:00+07:00',
      endsAt: '2026-10-24T09:00:00+07:00',
      staff: [{ ...staffOf('m9', 'Phạm Thị Bảo Vy'), displayName: 'Bảo Vy', avatarUrl: 'https://anh.test/vy.png' }],
    });
    const lanes = buildStaffLanes({ staff: null, appointments: [a], readAll: true, self: { membershipId: 'chu', name: 'Chủ' } });
    expect(lanes).toEqual([{ membershipId: 'm9', name: 'Bảo Vy', fullName: 'Phạm Thị Bảo Vy', avatarUrl: 'https://anh.test/vy.png', tierName: null }]);
  });
});

describe('N3 + M3: tên ngắn ở đầu hàng thợ = hàm chung staffShortName (+ trùng tên giữ tên đầy đủ)', () => {
  it('BẮT: chưa đặt tên hiển thị → tiếng cuối họ tên ("Nguyễn Thu Hà" → "Hà", không còn "Thu Hà"); đã đặt → nguyên tên hiển thị', () => {
    const m = laneShortNames([
      { membershipId: 'ha', name: 'Nguyễn Thu Hà', fullName: 'Nguyễn Thu Hà' },
      { membershipId: 'linh', name: 'Linh Trần', fullName: 'Trần Khánh Linh' },
      { membershipId: 'tu', name: 'Tú', fullName: 'Tú' },
    ]);
    expect(m.get('ha')).toBe('Hà');
    expect(m.get('linh')).toBe('Linh Trần');
    expect(m.get('tu')).toBe('Tú');
  });
  it('GIỮ: hai thợ trùng tên ngắn ("Linh") → giữ tên hiển thị đầy đủ cho cả hai; không biết họ tên → nguyên tên hiển thị', () => {
    const m = laneShortNames([
      { membershipId: 'b', name: 'Trần Khánh Linh', fullName: 'Trần Khánh Linh' },
      { membershipId: 'c', name: 'Lê Khánh Linh', fullName: 'Lê Khánh Linh' },
      { membershipId: 'd', name: 'Phạm Bảo Vy' },
    ]);
    expect(m.get('b')).toBe('Trần Khánh Linh');
    expect(m.get('c')).toBe('Lê Khánh Linh');
    expect(m.get('d')).toBe('Phạm Bảo Vy');
  });
  it('BẮT: hàng thợ mang họ tên từ danh sách thợ (kể cả thợ chưa có ca trong tuần) và từ ca', () => {
    const lanes = buildStaffLanes({
      staff: [member({ membershipId: 'ha', displayName: 'Nguyễn Thu Hà' }), member({ membershipId: 'linh', displayName: 'Linh Trần', fullName: 'Trần Khánh Linh' })],
      appointments: [appt({ id: '1', startsAt: '2026-10-24T08:00:00+07:00', endsAt: '2026-10-24T09:00:00+07:00', staff: [{ ...staffOf('vy', 'Phạm Bảo Vy'), displayName: 'Bảo Vy' }] })],
      readAll: true,
      self: { membershipId: 'chu', name: 'Chủ' },
    });
    expect(lanes.map((l) => [l.membershipId, l.fullName])).toEqual([
      ['ha', 'Nguyễn Thu Hà'],
      ['linh', 'Trần Khánh Linh'],
      ['vy', 'Phạm Bảo Vy'],
    ]);
    expect([...laneShortNames(lanes).values()]).toEqual(['Hà', 'Linh Trần', 'Bảo Vy']);
  });
  it('GIỮ: chỉ biết tên tài khoản (không danh sách thợ, không ca) → hàng không mang họ tên, không đoán tên ngắn', () => {
    const lanes = buildStaffLanes({ staff: null, appointments: [], readAll: false, self: { membershipId: 'm9', name: 'Phạm Bảo Vy' } });
    expect(lanes[0]?.fullName).toBeUndefined();
    expect(laneShortNames(lanes).get('m9')).toBe('Phạm Bảo Vy');
  });
});

describe('L7: "× n" theo số lượng dòng hợp đồng (kindText dùng chung mọi chế độ lịch)', () => {
  const base = { id: 'q', startsAt: '2026-10-21T02:00:00Z', endsAt: '2026-10-21T03:00:00Z' };
  it('BẮT: số lượng 2 → "tên ca × 2"; không có tên ca thì loại sự kiện + "× 3"', () => {
    expect(kindText(appt({ ...base, title: 'Makeup phù dâu', quantity: 2 }))).toBe('Makeup phù dâu × 2');
    expect(kindText(appt({ ...base, title: '  ', kind: 'MAKEUP', quantity: 3 }))).toBe('Makeup × 3');
  });
  it('GIỮ: số lượng 1 hoặc ca không gắn dòng hợp đồng (null) → không ghi gì thêm', () => {
    expect(kindText(appt({ ...base, title: 'Makeup cô dâu', quantity: 1 }))).toBe('Makeup cô dâu');
    expect(kindText(appt({ ...base, title: 'Makeup cô dâu', quantity: null }))).toBe('Makeup cô dâu');
    expect(kindText(appt({ ...base, title: null, kind: 'PERSONAL_BLOCK', quantity: null }))).toBe('Bận việc riêng');
  });
});

describe('L7: thẻ "× n" tách riêng cho ô ca hẹp (lưới C)', () => {
  const base = { id: 'q', startsAt: '2026-10-21T02:00:00Z', endsAt: '2026-10-21T03:00:00Z' };
  it('quantityText: 2 → "× 2"; 1 / null → null; kindLabel không kèm số lượng', () => {
    expect(quantityText(appt({ ...base, quantity: 2 }))).toBe('× 2');
    expect(quantityText(appt({ ...base, quantity: 1 }))).toBeNull();
    expect(quantityText(appt({ ...base, quantity: null }))).toBeNull();
    expect(kindLabel(appt({ ...base, title: 'Makeup phù dâu', quantity: 2 }))).toBe('Makeup phù dâu');
  });
});

describe('buổi học (việc tồn 6)', () => {
  it('BẮT: dòng "ai" là tên khách, buổi học là tên lớp; chú thích không gộp buổi học vào "Khác"; thanh tải trong ngày biết buổi học', () => {
    expect(whoText({ customer: { id: 'c', fullName: 'Lan', phone: null }, courseClass: null })).toBe('Lan');
    expect(whoText({ customer: null, courseClass: { id: 'k', name: 'K12 tối', courseId: 'c', courseName: 'Khoá' } })).toBe('K12 tối');
    expect(whoText({ customer: null, courseClass: null })).toBeNull();
    expect(legendSubjects([{ subjectName: null, kind: 'COURSE_SESSION' }])).toEqual([]);
    expect(legendSubjects([{ subjectName: null, kind: 'MAKEUP' }]).map((s) => s.label)).toEqual(['Khác']);
    expect(isCourseSession({ kind: 'COURSE_SESSION' })).toBe(true);
    expect(isCourseSession({ kind: 'MAKEUP' })).toBe(false);
  });
});

describe('K8: ca còn hiệu lực — một luật cho đếm và nhắc', () => {
  const day = '2026-10-21';
  const mk = (id: string, status: Appointment['status'], staff: Appointment['staff'] = [], h = 9) =>
    appt({ id, status, staff, startsAt: `2026-10-21T${String(h).padStart(2, '0')}:00:00+07:00`, endsAt: `2026-10-21T${String(h + 1).padStart(2, '0')}:00:00+07:00` });

  it('BẮT: isLive khớp isBlockingStatus của máy chủ ở MỌI trạng thái; huỷ, nháp, không đến thì không còn hiệu lực', () => {
    for (const st of WORK_STATUSES) expect(isLive({ status: st }), st).toBe(isBlockingStatus(st));
    expect(isLive({ status: 'CANCELLED' })).toBe(false);
    expect(isLive({ status: 'NO_SHOW' })).toBe(false);
    expect(isLive({ status: 'DRAFT' })).toBe(false);
    for (const st of ['PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const) expect(isLive({ status: st }), st).toBe(true);
    // Quy tắc nhớ: vẽ mờ ⇔ không đếm.
    for (const st of WORK_STATUSES) expect(isBlocking({ status: st })).toBe(isLive({ status: st }));
  });

  const list = [
    mk('ok', 'CONFIRMED', [staffOf('ha')]),
    mk('chua', 'PENDING_CONFIRMATION', [], 10),
    mk('huy', 'CANCELLED', [], 11),
    mk('huy2', 'CANCELLED', [staffOf('ha')], 12),
    mk('nhap', 'DRAFT', [], 13),
    mk('vang', 'NO_SHOW', [], 14),
  ];

  it('BẮT: needsStaff chỉ lấy ca còn hiệu lực chưa có thợ', () => {
    expect(needsStaff(list).map((a) => a.id)).toEqual(['chua']);
    expect(countLive(list)).toBe(2);
  });

  it('BẮT: countByDay và countByLane không đếm ca huỷ / nháp / không đến (ca vẫn ở indexByCell để vẽ mờ)', () => {
    expect(countByDay(list, [day])[day]).toBe(2);
    const lane = countByLane(list);
    expect(lane.get('ha')).toBe(1);
    expect(lane.get(UNASSIGNED)).toBe(1);
    expect(indexByCell(list).get(cellKey(UNASSIGNED, day))?.map((a) => a.id)).toEqual(['chua', 'huy', 'nhap', 'vang']);
  });

  it('BẮT: dayLoad — số ca và số giờ chỉ tính ca còn hiệu lực, thanh của ca huỷ vẫn có để vẽ mờ', () => {
    const ha = dayLoad(list, 'ha', day);
    expect(ha.count).toBe(1);
    expect(ha.minutes).toBe(60);
    expect(ha.bars.map((b) => b.id)).toEqual(['ok', 'huy2']);
    const na = dayLoad(list, UNASSIGNED, day);
    expect(na.count).toBe(1);
    expect(na.minutes).toBe(60);
    expect(na.bars).toHaveLength(4);
  });

  it('trục giờ B: tối thiểu 04–18, nới theo thanh sớm nhất / muộn nhất (làm tròn giờ), tối đa 00–24', () => {
    const load = (startMin: number, endMin: number) => ({ count: 1, minutes: 0, bars: [{ id: 'x', startMin, endMin, subjectName: null, blocking: true, course: false }] });
    expect(loadAxisHours([])).toEqual([4, 18]);
    expect(loadAxisHours([load(8 * 60, 9 * 60)])).toEqual([4, 18]);
    expect(loadAxisHours([load(18 * 60 + 30, 20 * 60 + 30)])).toEqual([4, 21]);
    expect(loadAxisHours([load(18 * 60, 18 * 60 + 1)])).toEqual([4, 19]);
    expect(loadAxisHours([load(2 * 60 + 15, 5 * 60)])).toEqual([2, 18]);
    expect(loadAxisHours([load(0, 90), load(22 * 60, 24 * 60)])).toEqual([0, 24]);
    // Ngoài ngày / rỗng thì bỏ qua.
    expect(axisFromMinutes([{ start: -300, end: 0 }, { start: 1440, end: 1500 }, { start: 600, end: 600 }])).toEqual([4, 18]);
    expect(axisFromMinutes([{ start: -300, end: 1700 }])).toEqual([0, 24]);
  });

  it('BẮT: ca qua nửa đêm 22:00→02:00 — mỗi ngày thấy phần của mình (22:00–24:00 hôm nay, 00:00–02:00 hôm sau)', () => {
    const night = appt({ id: 'dem', startsAt: '2026-10-21T22:00:00+07:00', endsAt: '2026-10-22T02:00:00+07:00', staff: [{ ...staffOf('ha'), blockStart: '2026-10-21T22:00:00+07:00', blockEnd: '2026-10-22T02:00:00+07:00' }] });
    const d1 = dayLoad([night], 'ha', '2026-10-21');
    expect(d1.bars[0]).toMatchObject({ startMin: 22 * 60, endMin: 24 * 60 });
    expect(d1.minutes).toBe(120);
    expect(loadAxisHours([d1])).toEqual([4, 24]);
    const d2 = dayLoad([night], 'ha', '2026-10-22');
    expect(d2.bars[0]).toMatchObject({ startMin: 0, endMin: 120 });
    expect(d2.minutes).toBe(120);
    expect(loadAxisHours([d2])).toEqual([0, 18]);
  });

  it('mốc chữ dưới trục: bội của 4 giờ + hai đầu, bỏ mốc giữa cách đầu mút < 2 giờ', () => {
    expect(axisTicks(4, 18)).toEqual([4, 8, 12, 16, 18]);
    expect(axisTicks(4, 21)).toEqual([4, 8, 12, 16, 21]);
    expect(axisTicks(4, 17)).toEqual([4, 8, 12, 17]);
    expect(axisTicks(0, 24)).toEqual([0, 4, 8, 12, 16, 20, 24]);
    expect(axisTicks(3, 18)).toEqual([3, 8, 12, 16, 18]);
    expect(axisTicks(7, 18)).toEqual([7, 12, 16, 18]);
  });
});
