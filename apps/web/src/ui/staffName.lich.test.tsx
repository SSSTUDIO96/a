import { cleanup, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Appointment } from '../api/types';
import type { StaffMember } from '../api/types';
import { StaffColumnsA } from '../features/schedule/StaffColumnsA';
import { WeekGridC } from '../features/schedule/WeekGridC';
import { WeekGridCMobile } from '../features/schedule/WeekGridCMobile';
import { buildStaffLanes, conflictMarks } from '../features/schedule/model';

// Biên bản nghiệm thu lại M3 ở đầu cột lịch 390: "Linh Trần" (tên hiển thị studio đặt) từng ra "Trần".
function appt(id: string, staff: { membershipId: string; fullName: string; displayName: string }[]): Appointment {
  const start = '2026-10-21T06:00:00+07:00';
  const end = '2026-10-21T07:00:00+07:00';
  return {
    id,
    code: `L-${id}`,
    title: 'Makeup cô dâu',
    status: 'CONFIRMED',
    customer: { id: 'c', fullName: 'Khách', phone: null },
    contract: null,
    contractLineId: null,
    subjectName: null,
    quantity: null,
    startsAt: start,
    endsAt: end,
    travelBeforeMin: 0,
    travelAfterMin: 0,
    locationType: null,
    address: null,
    latitude: null,
    longitude: null,
    notes: null,
    cancelReason: null,
    staff: staff.map((s) => ({ ...s, avatarUrl: null, role: 'PRIMARY', blockStart: start, blockEnd: end, isBlocking: true })),
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  } as Appointment;
}

function member(membershipId: string, fullName: string, displayName = fullName): StaffMember {
  return {
    membershipId,
    userId: `u-${membershipId}`,
    fullName,
    displayName,
    initials: 'XX',
    avatarUrl: null,
    phone: null,
    tier: null,
    isBookable: true,
    hasProfile: true,
    status: 'ACTIVE',
    roleKeys: ['artist'],
  };
}

// Hàng thợ dựng đúng như màn Lịch (buildStaffLanes): danh sách thợ + ca trong tuần.
// - "Linh Trần" / họ tên "Trần Khánh Linh": studio đặt tên hiển thị, có ca.
// - "Nguyễn Thu Hà": chưa đặt tên hiển thị, KHÔNG có ca trong tuần (họ tên chỉ có ở danh sách thợ).
// - "Hà Makeup" / "Nguyễn Thị Hà": có ca. - "Đỗ Hương Giang": không có trong danh sách thợ, chỉ có ở ca.
const STAFF = [member('m-linh', 'Trần Khánh Linh', 'Linh Trần'), member('m-ha', 'Nguyễn Thu Hà'), member('m-hamk', 'Nguyễn Thị Hà', 'Hà Makeup')];
const APPTS = [
  appt('1', [{ membershipId: 'm-linh', fullName: 'Trần Khánh Linh', displayName: 'Linh Trần' }]),
  appt('2', [{ membershipId: 'm-hamk', fullName: 'Nguyễn Thị Hà', displayName: 'Hà Makeup' }]),
  appt('3', [{ membershipId: 'm-giang', fullName: 'Đỗ Hương Giang', displayName: 'Đỗ Hương Giang' }]),
];
const WANT = [
  ['Linh Trần', 'Linh Trần'],
  ['Hà', 'Nguyễn Thu Hà'],
  ['Hà Makeup', 'Hà Makeup'],
  ['Giang', 'Đỗ Hương Giang'],
];

const heads = (sel: string) => [...document.querySelectorAll(sel)].filter((el) => el.getAttribute('title')).map((el) => [el.textContent, el.getAttribute('title')]);

describe('M3: một người một tên ngắn ở lưới C 1440, lưới C 390 và cột thợ A', () => {
  const lanes = buildStaffLanes({ staff: STAFF, appointments: APPTS, readAll: true, self: { membershipId: 'chu', name: 'Chủ' } });
  const common = { lanes, showUnassigned: false, appointments: APPTS, marks: conflictMarks(null), onOpen: () => {} };

  it('BẮT: lưới C máy tính (trước đây "Thu Hà" — 2 tiếng cuối tên hiển thị)', () => {
    render(<WeekGridC day="2026-10-21" {...common} />);
    expect(heads('.ws-c__nm')).toEqual(WANT);
    cleanup();
  });

  it('BẮT: lưới C điện thoại — thợ chưa có ca trong tuần vẫn rút từ họ tên của hàng ("Hà", trước đây nguyên "Nguyễn Thu Hà")', () => {
    render(<WeekGridCMobile day="2026-10-21" onSelectDay={() => {}} {...common} />);
    expect(heads('.ws-cm__tn')).toEqual(WANT);
    cleanup();
  });

  it('BẮT: cột thợ A', () => {
    render(<StaffColumnsA day="2026-10-21" hourPx={56} {...common} />);
    expect(heads('.ws-a__nm')).toEqual(WANT);
    cleanup();
  });

  it('GIỮ: hai thợ chưa đặt tên hiển thị trùng tiếng cuối → cả 3 nơi cùng giữ tên đầy đủ', () => {
    const twin = buildStaffLanes({
      staff: [member('a', 'Trần Khánh Linh'), member('b', 'Lê Khánh Linh')],
      appointments: [],
      readAll: true,
      self: { membershipId: 'chu', name: 'Chủ' },
    });
    const props = { lanes: twin, showUnassigned: false, appointments: [], marks: conflictMarks(null), onOpen: () => {} };
    const want = [
      ['Trần Khánh Linh', 'Trần Khánh Linh'],
      ['Lê Khánh Linh', 'Lê Khánh Linh'],
    ];
    render(<WeekGridC day="2026-10-21" {...props} />);
    expect(heads('.ws-c__nm')).toEqual(want);
    cleanup();
    render(<WeekGridCMobile day="2026-10-21" onSelectDay={() => {}} {...props} />);
    expect(heads('.ws-cm__tn')).toEqual(want);
    cleanup();
    render(<StaffColumnsA day="2026-10-21" hourPx={56} {...props} />);
    expect(heads('.ws-a__nm')).toEqual(want);
  });
});
