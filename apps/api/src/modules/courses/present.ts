// Dạng trả về của khoá, lớp, nhóm (bản vẽ C3 mục 1.3). Tiền: số nguyên đồng; ngày "YYYY-MM-DD"; giờ "HH:MM".
// Tình trạng chỗ tính bằng ĐÚNG hàm dùng chung với web (seatState / seatsLeft trong @makeup/shared).
import type { Prisma } from '@prisma/client';
import { minutesToTime, seatState, seatsLeft, vndFromBigInt } from '@makeup/shared';

// ---------- Ngày / giờ ----------

// "2026-11-03" → Date 00:00 UTC (cột @db.Date chỉ giữ phần ngày).
export function dateFromWire(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function dateToWire(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function timeToWire(minutes: number | null): string | null {
  return minutes === null ? null : minutesToTime(minutes);
}

// Ngày hôm nay theo múi giờ của tổ chức, dạng "YYYY-MM-DD".
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// ---------- Nhóm ----------

export const groupSelect = {
  id: true,
  name: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CourseGroupSelect;

export type GroupRow = Prisma.CourseGroupGetPayload<{ select: typeof groupSelect }>;

export function presentGroup(g: GroupRow, courseCount?: number) {
  return { ...g, ...(courseCount === undefined ? {} : { courseCount }) };
}

// ---------- Khoá ----------

export const courseSelect = {
  id: true,
  code: true,
  name: true,
  mode: true,
  groupId: true,
  tuitionFee: true,
  depositAmount: true,
  defaultCapacity: true,
  sessionCount: true,
  sessionMinutes: true,
  description: true,
  sortOrder: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CourseSelect;

export type CourseRow = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;

// Giá trị nghiệp vụ của khoá (không có mốc giờ hệ thống) — dùng cho phản hồi và nhật ký trước → sau.
export function courseValues(c: CourseRow) {
  return {
    code: c.code,
    name: c.name,
    mode: c.mode,
    groupId: c.groupId,
    tuitionFee: vndFromBigInt(c.tuitionFee, 'học phí'),
    depositAmount: vndFromBigInt(c.depositAmount, 'cọc mặc định'),
    defaultCapacity: c.defaultCapacity,
    sessionCount: c.sessionCount,
    sessionMinutes: c.sessionMinutes,
    description: c.description,
    sortOrder: c.sortOrder,
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
  };
}

export function presentCourse(c: CourseRow) {
  return { id: c.id, ...courseValues(c), createdAt: c.createdAt, updatedAt: c.updatedAt };
}

// ---------- Lớp ----------

export const classSelect = {
  id: true,
  courseId: true,
  name: true,
  startDate: true,
  endDate: true,
  weekdays: true,
  startMinute: true,
  endMinute: true,
  capacity: true,
  enrolledCount: true,
  status: true,
  note: true,
  instructorMembershipId: true,
  studioLocationId: true,
  instructor: { select: { id: true, user: { select: { fullName: true } }, staffProfile: { select: { displayName: true } } } },
  studioLocation: { select: { id: true, name: true, address: true } },
} satisfies Prisma.CourseClassSelect;

export type ClassRow = Prisma.CourseClassGetPayload<{ select: typeof classSelect }>;

// Giá trị nghiệp vụ của lớp (dạng trên dây) — dùng cho nhật ký trước → sau.
export function classValues(k: ClassRow) {
  return {
    name: k.name,
    startDate: dateToWire(k.startDate),
    endDate: dateToWire(k.endDate),
    weekdays: [...k.weekdays].sort((a, b) => a - b),
    startTime: timeToWire(k.startMinute),
    endTime: timeToWire(k.endMinute),
    capacity: k.capacity,
    status: k.status,
    instructorMembershipId: k.instructorMembershipId,
    studioLocationId: k.studioLocationId,
    note: k.note,
  };
}

// ClassView (bản vẽ C3 mục 1.3).
export function presentClass(k: ClassRow) {
  const v = classValues(k);
  return {
    id: k.id,
    courseId: k.courseId,
    name: v.name,
    startDate: v.startDate,
    endDate: v.endDate,
    weekdays: v.weekdays,
    startTime: v.startTime,
    endTime: v.endTime,
    capacity: k.capacity,
    enrolledCount: k.enrolledCount,
    seatsLeft: seatsLeft(k.enrolledCount, k.capacity),
    seatState: seatState(k.enrolledCount, k.capacity),
    status: k.status,
    note: k.note,
    instructor: k.instructor
      ? { membershipId: k.instructor.id, name: k.instructor.staffProfile?.displayName ?? k.instructor.user.fullName }
      : null,
    location: k.studioLocation ? { id: k.studioLocation.id, name: k.studioLocation.name, address: k.studioLocation.address } : null,
  };
}

export type ClassView = ReturnType<typeof presentClass>;

// Lớp còn nhận ghi danh: đang mở và chưa đủ số tối đa.
export function hasSeats(k: { status: string; enrolledCount: number; capacity: number }): boolean {
  return k.status === 'OPEN' && k.enrolledCount < k.capacity;
}

// Tóm tắt lớp của một khoá cho danh sách khoá (lớp đã huỷ không tính).
export function classSummary(classes: { status: string; enrolledCount: number; capacity: number; startDate: Date }[], today: string) {
  const live = classes.filter((k) => k.status !== 'CANCELLED');
  const upcoming = live
    .filter((k) => k.status === 'OPEN' && dateToWire(k.startDate) >= today)
    .map((k) => dateToWire(k.startDate))
    .sort();
  return {
    total: live.length,
    open: live.filter((k) => k.status === 'OPEN').length,
    withSeats: live.filter(hasSeats).length,
    nextStartDate: upcoming[0] ?? null,
  };
}
