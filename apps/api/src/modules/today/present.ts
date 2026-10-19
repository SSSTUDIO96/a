// Trang "Hôm nay" (bản vẽ D mục 2.6): dạng trả về + hàm đổi dòng database thành JSON thuần.
// Tiền: số nguyên đồng (Vnd), đọc từ BigInt qua vndFromBigInt — không số thực. Thời điểm: chuỗi ISO. Ngày: "YYYY-MM-DD".
import type { ContractKind, EventKind, LocationType, Prisma, StaffRole } from '@prisma/client';
import { isOccasionColor, seatsLeft, vndFromBigInt, type OccasionColor, type Vnd, type WorkStatus } from '@makeup/shared';
import { appointmentInclude } from '../schedule/service';
import { dateToWire } from '../courses/present';

// ---------- Dạng trả về ----------

export type ScheduleScope = 'ALL' | 'OWN';

export interface MoneyCount {
  count: number;
  // Tổng còn thiếu của các đợt đếm được.
  amount: Vnd;
}

export interface TodayAppointment {
  id: string;
  code: string;
  kind: EventKind;
  status: WorkStatus;
  title: string | null;
  startsAt: string;
  endsAt: string;
  travelBeforeMin: number;
  customer: { id: string; fullName: string } | null;
  subjectName: string | null;
  quantity: number | null;
  occasion: { id: string; name: string; color: OccasionColor } | null;
  locationType: LocationType | null;
  address: string | null;
  contract: { id: string; code: string } | null;
  courseClass: { id: string; name: string; courseId: string } | null;
  staff: { membershipId: string; displayName: string; role: StaffRole }[];
}

export interface TodayInstallment {
  installmentId: string;
  name: string;
  dueDate: string;
  amount: Vnd;
  outstanding: Vnd;
  status: 'OVERDUE' | 'DUE' | 'PARTIAL';
  // Số ngày lịch (theo múi giờ tổ chức) từ ngày hạn tới hôm nay; 0 khi chưa quá hạn.
  overdueDays: number;
  isDeposit: boolean;
  contract: { id: string; code: string; eventDate: string | null };
  customer: { id: string; fullName: string; phone: string | null; phoneHidden: boolean };
  owner: { membershipId: string; displayName: string } | null;
}

export interface TodayContract {
  id: string;
  code: string;
  kind: ContractKind;
  customerName: string;
  total: Vnd;
  eventDate: string | null;
  confirmedAt: string;
  confirmedBy: { userId: string; fullName: string } | null;
}

export interface TodayEnrollment {
  id: string;
  enrolledAt: string;
  customer: { id: string; fullName: string };
  courseClass: { id: string; name: string };
  course: { id: string; name: string };
  enrolledCount: number;
  capacity: number;
}

export interface TodayClass {
  id: string;
  name: string;
  course: { id: string; name: string };
  startDate: string;
  enrolledCount: number;
  capacity: number;
  seatsLeft: number;
}

// Thiếu quyền → trường là null (web ẩn thẻ); có quyền mà không có gì → mảng rỗng / số 0 thật.
export interface TodayView {
  generatedAt: string;
  timezone: string;
  today: string;
  tomorrow: string;
  // null khi người xem không có cả schedule.read_all lẫn schedule.read_own (chỉ vai trò tuỳ chỉnh) — xem phiếu vướng M6.
  scheduleScope: ScheduleScope | null;
  counts: {
    appointmentsToday: number | null;
    appointmentsTomorrow: number | null;
    unassignedSoon: number | null;
    overdue: MoneyCount | null;
    dueSoon: MoneyCount | null;
  };
  appointments: { today: TodayAppointment[]; tomorrow: TodayAppointment[]; later: TodayAppointment[]; truncated: boolean } | null;
  unassigned: TodayAppointment[] | null;
  installments: { overdue: TodayInstallment[]; dueSoon: TodayInstallment[]; truncated: boolean } | null;
  newContracts: TodayContract[] | null;
  newEnrollments: TodayEnrollment[] | null;
  almostFullClasses: TodayClass[] | null;
}

// ---------- Ca ----------

// Dùng lại appointmentInclude của Lịch (schedule/service.ts:58); riêng dòng hợp đồng đọc thêm loại sự kiện: tên = bản chụp
// trên dòng, màu = màu HIỆN TẠI của loại. Quan hệ dòng ↔ loại là khoá ngoại kép theo tổ chức (chỉ đọc loại của chính tổ chức).
export const todayAppointmentInclude = {
  ...appointmentInclude,
  contractLine: {
    select: { subjectName: true, quantity: true, occasionName: true, occasion: { select: { id: true, color: true } } },
  },
} satisfies Prisma.AppointmentInclude;

export type TodayAppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof todayAppointmentInclude }>;

function occasionOf(line: TodayAppointmentRow['contractLine']): TodayAppointment['occasion'] {
  if (!line?.occasion) return null;
  // CHECK contract_lines_occasion: có occasion_id thì có tên; CHECK occasions_color: màu thuộc 12 tên. Lệch là dữ liệu hỏng
  // → ném lỗi, không đoán tên / màu.
  if (line.occasionName === null) throw new Error(`Dòng hợp đồng có loại sự kiện ${line.occasion.id} nhưng thiếu tên chụp`);
  if (!isOccasionColor(line.occasion.color)) throw new Error(`Màu loại sự kiện không hợp lệ: ${line.occasion.color}`);
  return { id: line.occasion.id, name: line.occasionName, color: line.occasion.color };
}

export function presentTodayAppointment(a: TodayAppointmentRow): TodayAppointment {
  return {
    id: a.id,
    code: a.code,
    kind: a.kind,
    status: a.status,
    title: a.title,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    travelBeforeMin: a.travelBeforeMin,
    customer: a.customer ? { id: a.customer.id, fullName: a.customer.fullName } : null,
    subjectName: a.contractLine?.subjectName ?? null,
    quantity: a.contractLine?.quantity ?? null,
    occasion: occasionOf(a.contractLine),
    locationType: a.locationType,
    address: a.address,
    contract: a.contract ? { id: a.contract.id, code: a.contract.code } : null,
    courseClass: a.courseClass ? { id: a.courseClass.id, name: a.courseClass.name, courseId: a.courseClass.course.id } : null,
    staff: a.staff.map((s) => ({
      membershipId: s.membershipId,
      displayName: s.membership.staffProfile?.displayName ?? s.membership.user.fullName,
      role: s.role,
    })),
  };
}

// ---------- Đợt thu ----------

export const installmentContractSelect = {
  id: true,
  code: true,
  eventDate: true,
  total: true,
  depositRequired: true,
  ownerMembershipId: true,
  customer: { select: { id: true, fullName: true, phone: true } },
  owner: { select: { user: { select: { fullName: true } }, staffProfile: { select: { displayName: true } } } },
} satisfies Prisma.ContractSelect;

export type InstallmentContractRow = Prisma.ContractGetPayload<{ select: typeof installmentContractSelect }>;

export function presentTodayInstallment(
  it: { id: string; name: string; dueDate: Date; amount: Vnd; outstanding: Vnd; isDeposit: boolean; status: TodayInstallment['status'] },
  overdueDays: number,
  c: InstallmentContractRow,
  canSeePhone: boolean,
): TodayInstallment {
  return {
    installmentId: it.id,
    name: it.name,
    dueDate: it.dueDate.toISOString(),
    amount: it.amount,
    outstanding: it.outstanding,
    status: it.status,
    overdueDays,
    isDeposit: it.isDeposit,
    contract: { id: c.id, code: c.code, eventDate: c.eventDate ? c.eventDate.toISOString() : null },
    // Quyền thu tiền không kéo theo quyền xem liên lạc của khách (đúng luật payments/common.ts:82 loadProgress).
    customer: {
      id: c.customer.id,
      fullName: c.customer.fullName,
      phone: canSeePhone ? c.customer.phone : null,
      phoneHidden: !canSeePhone,
    },
    owner:
      c.owner && c.ownerMembershipId
        ? { membershipId: c.ownerMembershipId, displayName: c.owner.staffProfile?.displayName ?? c.owner.user.fullName }
        : null,
  };
}

// ---------- Hợp đồng mới, ghi danh mới, lớp sắp đầy ----------

export const newContractSelect = {
  id: true,
  code: true,
  kind: true,
  total: true,
  eventDate: true,
  confirmedAt: true,
  customer: { select: { fullName: true } },
} satisfies Prisma.ContractSelect;

export type NewContractRow = Prisma.ContractGetPayload<{ select: typeof newContractSelect }>;

export function presentTodayContract(c: NewContractRow, confirmedBy: TodayContract['confirmedBy']): TodayContract {
  // Lọc theo confirmed_at nên luôn có; thiếu là lỗi truy vấn, không bịa giờ.
  if (!c.confirmedAt) throw new Error(`Hợp đồng ${c.id} thiếu confirmedAt ở thẻ "Hợp đồng mới"`);
  return {
    id: c.id,
    code: c.code,
    kind: c.kind,
    customerName: c.customer.fullName,
    total: vndFromBigInt(c.total, 'tổng hợp đồng'),
    eventDate: c.eventDate ? c.eventDate.toISOString() : null,
    confirmedAt: c.confirmedAt.toISOString(),
    confirmedBy,
  };
}

export const newEnrollmentSelect = {
  id: true,
  enrolledAt: true,
  customer: { select: { id: true, fullName: true } },
  courseClass: {
    select: { id: true, name: true, enrolledCount: true, capacity: true, course: { select: { id: true, name: true } } },
  },
} satisfies Prisma.EnrollmentSelect;

export type NewEnrollmentRow = Prisma.EnrollmentGetPayload<{ select: typeof newEnrollmentSelect }>;

export function presentTodayEnrollment(e: NewEnrollmentRow): TodayEnrollment {
  return {
    id: e.id,
    enrolledAt: e.enrolledAt.toISOString(),
    customer: e.customer,
    courseClass: { id: e.courseClass.id, name: e.courseClass.name },
    course: e.courseClass.course,
    enrolledCount: e.courseClass.enrolledCount,
    capacity: e.courseClass.capacity,
  };
}

export const classSelect = {
  id: true,
  name: true,
  startDate: true,
  enrolledCount: true,
  capacity: true,
  course: { select: { id: true, name: true } },
} satisfies Prisma.CourseClassSelect;

export type ClassRow = Prisma.CourseClassGetPayload<{ select: typeof classSelect }>;

export function presentTodayClass(k: ClassRow): TodayClass {
  return {
    id: k.id,
    name: k.name,
    course: k.course,
    startDate: dateToWire(k.startDate),
    enrolledCount: k.enrolledCount,
    capacity: k.capacity,
    seatsLeft: seatsLeft(k.enrolledCount, k.capacity),
  };
}
