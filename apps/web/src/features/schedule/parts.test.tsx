import { describe, expect, it } from 'vitest';
import type { Appointment } from '../../api/types';
import { apptTip } from './parts';

// apptTip ghép tên lớp qua lopLabel (certificates/logic.ts): tên "Lớp K13" không thành "Lớp Lớp K13", tên "K14" thành "Lớp K14".
function session(name: string): Appointment {
  return {
    id: 'bh',
    code: 'LH-1',
    kind: 'COURSE_SESSION',
    title: null,
    status: 'CONFIRMED',
    customer: null,
    contract: null,
    contractLineId: null,
    subjectName: null,
    quantity: null,
    courseClass: { id: 'k', name, courseId: 'c', courseName: 'Khoá' },
    sessionDate: '2026-10-21',
    startsAt: '2026-10-21T18:00:00+07:00',
    endsAt: '2026-10-21T20:00:00+07:00',
    travelBeforeMin: 0,
    travelAfterMin: 0,
    locationType: null,
    address: null,
    latitude: null,
    longitude: null,
    notes: null,
    cancelReason: null,
    occasion: null,
    staff: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('apptTip — nhãn lớp', () => {
  it('tên lớp đã có chữ "Lớp" giữ nguyên; chưa có thì thêm', () => {
    expect(apptTip(session('Lớp K13'))).toContain(' · Lớp K13 · ');
    expect(apptTip(session('Lớp K13'))).not.toContain('Lớp Lớp');
    expect(apptTip(session('K14'))).toContain(' · Lớp K14 · ');
  });
});
