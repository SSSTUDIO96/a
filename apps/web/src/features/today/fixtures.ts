// Dữ liệu mẫu cho bài thử màn Hôm nay (giữ đúng hình TodayView của máy chủ). Hôm nay = Thứ Bảy 21/11/2026, 07:30 giờ Việt Nam.
import type { TodayAppointment, TodayClass, TodayContract, TodayEnrollment, TodayInstallment, TodayView } from '../../api/types';

export const TZ = 'Asia/Ho_Chi_Minh';

export function appt(over: Partial<TodayAppointment> = {}): TodayAppointment {
  return {
    id: 'ca-1',
    code: 'CA-000001',
    kind: 'MAKEUP',
    status: 'CONFIRMED',
    title: null,
    startsAt: '2026-11-21T08:00:00.000Z', // 15:00 giờ Việt Nam
    endsAt: '2026-11-21T09:00:00.000Z',
    travelBeforeMin: 0,
    customer: { id: 'k-1', fullName: 'Hoàng Minh Thư' },
    subjectName: 'Phù dâu',
    quantity: 1,
    occasion: null,
    locationType: 'STUDIO',
    address: null,
    contract: { id: 'hd-2', code: 'HD-000002' },
    courseClass: null,
    staff: [],
    ...over,
  };
}

export function inst(over: Partial<TodayInstallment> = {}): TodayInstallment {
  return {
    installmentId: 'dot-1',
    name: 'Đợt 2',
    dueDate: '2026-11-18T16:59:59.000Z', // hết ngày 18/11 giờ Việt Nam
    amount: 2_000_000,
    outstanding: 2_000_000,
    status: 'OVERDUE',
    overdueDays: 3,
    isDeposit: false,
    contract: { id: 'hd-4', code: 'HD-000004', eventDate: '2026-11-25T01:00:00.000Z' },
    customer: { id: 'k-4', fullName: 'Đỗ Thanh Mai', phone: '0901222333', phoneHidden: false },
    owner: { membershipId: 'm-mai', displayName: 'Mai' },
    ...over,
  };
}

export function contract(over: Partial<TodayContract> = {}): TodayContract {
  return {
    id: 'hd-7',
    code: 'HD-000007',
    kind: 'SERVICE',
    customerName: 'Ngô Thảo Vy',
    total: 3_200_000,
    eventDate: '2026-11-22T00:00:00.000Z',
    confirmedAt: '2026-11-20T13:14:00.000Z', // 20:14 hôm qua
    confirmedBy: { userId: 'u-1', fullName: 'Nguyễn Văn Chiến' },
    ...over,
  };
}

export function enrollment(over: Partial<TodayEnrollment> = {}): TodayEnrollment {
  return {
    id: 'gd-1',
    enrolledAt: '2026-11-20T12:40:00.000Z', // 19:40 hôm qua
    customer: { id: 'k-9', fullName: 'Nguyễn Hải Yến' },
    courseClass: { id: 'lop-1', name: 'K12' },
    course: { id: 'kh-1', name: 'Makeup cá nhân' },
    enrolledCount: 9,
    capacity: 12,
    ...over,
  };
}

export function klass(over: Partial<TodayClass> = {}): TodayClass {
  return { id: 'lop-5', name: 'Chuyên nghiệp K5', course: { id: 'kh-5', name: 'Chuyên nghiệp' }, startDate: '2026-12-01', enrolledCount: 10, capacity: 12, seatsLeft: 2, ...over };
}

/** Máy chủ trả cho chủ studio (ALL, đủ quyền), có dữ liệu. */
export function fullView(over: Partial<TodayView> = {}): TodayView {
  const mai = { membershipId: 'm-mai', displayName: 'Mai', role: 'PRIMARY' as const };
  const linh = { membershipId: 'm-linh', displayName: 'Linh Trần', role: 'PRIMARY' as const };
  const todayCa = appt({ id: 'ca-hn', staff: [{ membershipId: 'm-ha', displayName: 'Thu Hà', role: 'PRIMARY' }] });
  const tomorrow1 = appt({ id: 'ca-n1', startsAt: '2026-11-21T22:00:00.000Z', endsAt: '2026-11-21T23:00:00.000Z', staff: [linh] }); // 05:00 ngày 22/11
  const tomorrow2 = appt({ id: 'ca-n2', startsAt: '2026-11-22T06:00:00.000Z', endsAt: '2026-11-22T07:00:00.000Z', staff: [linh, mai] }); // 13:00
  const lone = appt({ id: 'ca-chua', startsAt: '2026-11-22T08:00:00.000Z', endsAt: '2026-11-22T09:00:00.000Z', staff: [], subjectName: 'Phù dâu' }); // 15:00 ngày 22/11, chưa có thợ
  return {
    generatedAt: '2026-11-21T00:30:00.000Z',
    timezone: TZ,
    today: '2026-11-21',
    tomorrow: '2026-11-22',
    scheduleScope: 'ALL',
    counts: {
      appointmentsToday: 1,
      appointmentsTomorrow: 3,
      unassignedSoon: 1,
      overdue: { count: 2, amount: 3_500_000 },
      dueSoon: { count: 1, amount: 1_500_000 },
    },
    appointments: { today: [todayCa], tomorrow: [tomorrow1, tomorrow2, lone], later: [], truncated: false },
    unassigned: [lone],
    installments: {
      overdue: [inst(), inst({ installmentId: 'dot-0', name: 'Còn lại', outstanding: 1_500_000, amount: 1_500_000, overdueDays: 4, dueDate: '2026-11-17T16:59:59.000Z', contract: { id: 'hd-3', code: 'HD-000003', eventDate: null }, customer: { id: 'k-3', fullName: 'Trần Bảo Ngọc', phone: null, phoneHidden: true }, owner: null })],
      dueSoon: [
        inst({
          installmentId: 'dot-9',
          name: 'Cọc',
          status: 'DUE',
          overdueDays: 0,
          outstanding: 1_500_000,
          amount: 1_500_000,
          dueDate: '2026-11-24T16:59:59.000Z', // hết ngày 24/11 (Thứ Ba)
          contract: { id: 'hd-9', code: 'HD-000009', eventDate: '2026-11-24T02:00:00.000Z' },
          customer: { id: 'k-9', fullName: 'Phan Thu Trang', phone: null, phoneHidden: false },
        }),
      ],
      truncated: false,
    },
    newContracts: [contract()],
    newEnrollments: [enrollment()],
    almostFullClasses: [klass()],
    ...over,
  };
}

/** Máy chủ trả khi tổ chức chưa có gì (mọi thẻ có quyền nhưng rỗng). */
export function emptyView(): TodayView {
  return fullView({
    counts: { appointmentsToday: 0, appointmentsTomorrow: 0, unassignedSoon: 0, overdue: { count: 0, amount: 0 }, dueSoon: { count: 0, amount: 0 } },
    appointments: { today: [], tomorrow: [], later: [], truncated: false },
    unassigned: [],
    installments: { overdue: [], dueSoon: [], truncated: false },
    newContracts: [],
    newEnrollments: [],
    almostFullClasses: [],
  });
}

/** Người xem không có quyền xem tiền: máy chủ trả null cho mọi thẻ tiền, hợp đồng, khoá học. */
export function noMoneyView(): TodayView {
  return fullView({
    counts: { ...fullView().counts, overdue: null, dueSoon: null },
    installments: null,
    newContracts: null,
    newEnrollments: null,
    almostFullClasses: null,
  });
}

/** Thợ: chỉ ca của mình. */
export function ownView(): TodayView {
  const me = { membershipId: 'm-linh', displayName: 'Linh Trần', role: 'PRIMARY' as const };
  return {
    generatedAt: '2026-11-21T00:30:00.000Z',
    timezone: TZ,
    today: '2026-11-21',
    tomorrow: '2026-11-22',
    scheduleScope: 'OWN',
    counts: { appointmentsToday: 0, appointmentsTomorrow: 2, unassignedSoon: null, overdue: null, dueSoon: null },
    appointments: {
      today: [],
      tomorrow: [
        appt({ id: 'ca-a', startsAt: '2026-11-21T22:00:00.000Z', endsAt: '2026-11-22T00:00:00.000Z', occasion: { id: 'sk-1', name: 'Cô dâu cao cấp', color: 'rose' }, subjectName: 'Cô dâu', locationType: 'CUSTOMER_HOME', address: '25 Nguyễn Văn Cừ', travelBeforeMin: 30, staff: [me] }),
        appt({ id: 'ca-b', startsAt: '2026-11-22T10:30:00.000Z', endsAt: '2026-11-22T11:30:00.000Z', occasion: null, subjectName: 'Dặm makeup', locationType: 'OTHER', address: 'Nhà hàng Riverside', staff: [me] }),
      ],
      later: [appt({ id: 'ca-c', startsAt: '2026-11-24T01:00:00.000Z', endsAt: '2026-11-24T02:00:00.000Z', subjectName: 'Cô dâu', customer: { id: 'k-2', fullName: 'Phan Thu Trang' }, staff: [me] })],
      truncated: false,
    },
    unassigned: null,
    installments: null,
    newContracts: null,
    newEnrollments: null,
    almostFullClasses: null,
  };
}

/** Vai trò tuỳ chỉnh thiếu cả schedule.read_all lẫn schedule.read_own (nhưng có quyền tiền): máy chủ trả ca = null. */
export function noScheduleView(): TodayView {
  const f = fullView();
  return {
    ...f,
    scheduleScope: null,
    counts: { appointmentsToday: null, appointmentsTomorrow: null, unassignedSoon: null, overdue: f.counts.overdue, dueSoon: f.counts.dueSoon },
    appointments: null,
    unassigned: null,
    newContracts: null,
    newEnrollments: null,
    almostFullClasses: null,
  };
}

/** Thiếu quyền lịch và mọi quyền khác: chỉ còn org.read. */
export function nothingView(): TodayView {
  const f = noScheduleView();
  return { ...f, counts: { ...f.counts, overdue: null, dueSoon: null }, installments: null };
}
