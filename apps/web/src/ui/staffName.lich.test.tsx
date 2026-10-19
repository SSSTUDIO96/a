import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Appointment } from '../api/types';
import { WeekGridCMobile } from '../features/schedule/WeekGridCMobile';
import { conflictMarks } from '../features/schedule/model';

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

describe('M3: tên ngắn đầu cột lịch tuần trên điện thoại', () => {
  it('tên hiển thị studio đặt → nguyên tên; chưa đặt → tiếng cuối của họ tên; không biết họ tên → nguyên tên hiển thị', () => {
    render(
      <WeekGridCMobile
        day="2026-10-21"
        onSelectDay={() => {}}
        lanes={[
          { membershipId: 'm-linh', name: 'Linh Trần', avatarUrl: null, tierName: null },
          { membershipId: 'm-ha', name: 'Hà Makeup', avatarUrl: null, tierName: null },
          { membershipId: 'm-giang', name: 'Đỗ Hương Giang', avatarUrl: null, tierName: null },
          { membershipId: 'm-vy', name: 'Phạm Tường Vy', avatarUrl: null, tierName: null },
        ]}
        showUnassigned={false}
        appointments={[
          appt('1', [{ membershipId: 'm-linh', fullName: 'Trần Khánh Linh', displayName: 'Linh Trần' }]),
          appt('2', [{ membershipId: 'm-ha', fullName: 'Nguyễn Thu Hà', displayName: 'Hà Makeup' }]),
          appt('3', [{ membershipId: 'm-giang', fullName: 'Đỗ Hương Giang', displayName: 'Đỗ Hương Giang' }]),
        ]}
        marks={conflictMarks(null)}
        onOpen={() => {}}
      />,
    );
    const heads = [...document.querySelectorAll('.ws-cm__tn')].map((el) => [el.textContent, el.getAttribute('title')]);
    expect(heads).toEqual([
      ['Linh Trần', 'Linh Trần'],
      ['Hà Makeup', 'Hà Makeup'],
      ['Giang', 'Đỗ Hương Giang'],
      // Thợ chưa có ca trong tuần: làn không mang họ tên → không đoán.
      ['Phạm Tường Vy', 'Phạm Tường Vy'],
    ]);
  });
});
