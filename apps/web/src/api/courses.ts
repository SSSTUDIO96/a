import type { SeatState } from '@makeup/shared';
import { api } from './client';
import { idSeg, orgPath, withQuery } from './org';
import type { AppointmentConflict, ContractStatus, IsoDateTime, Items } from './types';

// Khoá & lớp (bản vẽ C3 mục 1.3): apps/api/src/modules/courses/{routes,schemas,present,service}.ts.
// Mọi đường cần tổ chức ACADEMY (khác → 403 "Tổ chức chưa bật đào tạo"); quyền courses.read / courses.write.
// Tiền: số nguyên đồng. Ngày: "YYYY-MM-DD". Giờ: "HH:MM". Thứ trong tuần: 1 = Thứ Hai … 7 = Chủ nhật.

export type CourseMode = 'SINGLE_CLASS' | 'MULTI_CLASS';
export type CourseClassStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type EnrollmentStatus = 'ACTIVE' | 'CANCELLED';
export type { SeatState };

// ---- Nhóm khoá (present.ts presentGroup) ----
export interface CourseGroup {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  // Số khoá chưa lưu trữ trong nhóm — chỉ có ở danh sách.
  courseCount?: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CourseGroupCreateInput {
  name: string;
  sortOrder?: number;
}

export interface CourseGroupUpdateInput {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// ---- Khoá (present.ts presentCourse) ----
export interface Course {
  id: string;
  code: string;
  name: string;
  mode: CourseMode;
  groupId: string | null;
  tuitionFee: number;
  depositAmount: number;
  defaultCapacity: number;
  sessionCount: number | null;
  sessionMinutes: number | null;
  description: string | null;
  sortOrder: number;
  archivedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ---- Lớp (present.ts presentClass = ClassView) ----
export interface ClassView {
  id: string;
  courseId: string;
  name: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string | null;
  endTime: string | null;
  capacity: number;
  enrolledCount: number;
  seatsLeft: number;
  seatState: SeatState;
  status: CourseClassStatus;
  note: string | null;
  instructor: { membershipId: string; name: string } | null;
  location: { id: string; name: string; address: string } | null;
  // Buổi học của lớp trên Lịch: total = buổi chưa huỷ, upcoming = trong đó buổi chưa diễn ra. Chưa đưa lên → 0 / 0.
  calendar: { total: number; upcoming: number };
}

// ---- Buổi học lên Lịch (POST /classes/:id/sessions/sync) ----
export interface SessionSyncSummary {
  create: number;
  update: number;
  cancel: number;
  // Buổi chưa diễn ra đã khớp lịch lớp.
  keep: number;
  // Buổi đã diễn ra (giữ nguyên).
  past: number;
  // Ngày có buổi bị huỷ tay — không sinh lại.
  skippedManual: string[];
  firstNewDate: string | null;
  lastNewDate: string | null;
}

export interface SessionSyncResult {
  dryRun: boolean;
  summary: SessionSyncSummary;
  // Chỉ có ở xem trước (dryRun); ghi thật mà trùng thì máy chủ trả 409 kèm details.conflicts.
  conflicts: AppointmentConflict[];
  class: ClassView;
}

// Tóm tắt lớp cho dòng danh sách (lớp đã huỷ không tính).
export interface ClassSummary {
  total: number;
  open: number;
  withSeats: number;
  nextStartDate: string | null;
}

// Dòng danh sách khoá: khoá Một lớp kèm luôn lớp duy nhất chưa huỷ (singleClass) để hiện "31/10–21/11 · 7/10 học viên".
export interface CourseListItem extends Course {
  classSummary: ClassSummary;
  singleClass: ClassView | null;
}

export interface CourseDetail {
  course: Course;
  classes: ClassView[];
}

export interface CourseListQuery {
  groupId?: string;
  q?: string;
  includeArchived?: boolean;
}

// Lịch của một lớp (firstClass, mở lớp). Bỏ trống capacity = số tối đa mặc định của khoá.
export interface ClassScheduleInput {
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime?: string;
  endTime?: string;
  capacity?: number;
  instructorMembershipId?: string;
  studioLocationId?: string;
  note?: string;
}

// Khoá Một lớp KHÔNG gửi name (máy chủ đặt bằng tên khoá); Nhiều lớp bắt buộc name.
export interface FirstClassInput extends ClassScheduleInput {
  name?: string;
}

export interface CourseCreateInput {
  name: string;
  groupId?: string | null;
  code?: string;
  mode: CourseMode;
  tuitionFee: number;
  depositAmount?: number;
  defaultCapacity: number;
  sessionCount?: number | null;
  sessionMinutes?: number | null;
  description?: string | null;
  sortOrder?: number;
  firstClass?: FirstClassInput;
}

// Trường không gửi giữ nguyên. firstClassName chỉ dùng khi chuyển Một lớp → Nhiều lớp (đặt tên lớp hiện có).
export interface CourseUpdateInput {
  name?: string;
  groupId?: string | null;
  code?: string;
  tuitionFee?: number;
  depositAmount?: number;
  defaultCapacity?: number;
  sessionCount?: number | null;
  sessionMinutes?: number | null;
  description?: string | null;
  sortOrder?: number;
  mode?: CourseMode;
  firstClassName?: string;
}

export interface ClassCreateInput extends ClassScheduleInput {
  name: string;
}

// null = bỏ giá trị (giờ học gửi cả hai cùng null). Huỷ lớp dùng cancelClass (cần lý do).
export interface ClassUpdateInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  weekdays?: number[];
  startTime?: string | null;
  endTime?: string | null;
  capacity?: number;
  instructorMembershipId?: string | null;
  studioLocationId?: string | null;
  status?: 'OPEN' | 'CLOSED';
  note?: string | null;
}

export interface ClassListQuery {
  from?: string;
  to?: string;
  courseId?: string;
  hasSeats?: boolean;
  instructorId?: string;
  includeCancelled?: boolean;
  includeArchived?: boolean;
}

export interface ClassListItem extends ClassView {
  course: { id: string; code: string; name: string; mode: CourseMode };
}

// Học viên của lớp. Số điện thoại cần customers.read (thiếu → phone null, phoneHidden true);
// tiền hợp đồng cần contracts.read hoặc payments.read (thiếu → total, paid null).
export interface Enrollment {
  id: string;
  customer: { id: string; fullName: string; phone: string | null; phoneHidden: boolean };
  contract: { id: string; code: string; status: ContractStatus; total: number | null; paid: number | null };
  status: EnrollmentStatus;
  enrolledAt: IsoDateTime;
  cancelledAt: IsoDateTime | null;
  cancelReason: string | null;
}

// ---- Nhóm khoá ----
export function listCourseGroups(orgId: string, signal?: AbortSignal) {
  return api.get<Items<CourseGroup>>(orgPath(orgId, '/course-groups'), signal);
}

export function createCourseGroup(orgId: string, input: CourseGroupCreateInput, idempotencyKey: string) {
  return api.create<CourseGroup>(orgPath(orgId, '/course-groups'), input, idempotencyKey);
}

export function updateCourseGroup(orgId: string, groupId: string, input: CourseGroupUpdateInput) {
  return api.patch<CourseGroup>(orgPath(orgId, `/course-groups/${idSeg(groupId)}`), input);
}

// ---- Khoá ----
export function listCourses(orgId: string, query?: CourseListQuery, signal?: AbortSignal) {
  return api.get<Items<CourseListItem>>(withQuery(orgPath(orgId, '/courses'), query), signal);
}

export function getCourse(orgId: string, courseId: string, signal?: AbortSignal) {
  return api.get<CourseDetail>(orgPath(orgId, `/courses/${idSeg(courseId)}`), signal);
}

// Khoá Một lớp: firstClass bắt buộc, không có name. Trả { course, classes } (201).
export function createCourse(orgId: string, input: CourseCreateInput, idempotencyKey: string) {
  return api.create<CourseDetail>(orgPath(orgId, '/courses'), input, idempotencyKey);
}

// Nhiều → Một khi còn > 1 lớp chưa huỷ: 409 details.reason 'SINGLE_MODE_NEEDS_ONE_CLASS'.
export function updateCourse(orgId: string, courseId: string, input: CourseUpdateInput) {
  return api.patch<CourseDetail>(orgPath(orgId, `/courses/${idSeg(courseId)}`), input);
}

// Lưu trữ thay cho xoá — bắt buộc lý do.
export function archiveCourse(orgId: string, courseId: string, reason: string) {
  return api.post<{ course: Course }>(orgPath(orgId, `/courses/${idSeg(courseId)}/archive`), { reason });
}

// ---- Lớp ----
// Khoá Một lớp → 409 details.reason 'SINGLE_CLASS'.
export function createClass(orgId: string, courseId: string, input: ClassCreateInput, idempotencyKey: string) {
  return api.create<ClassView>(orgPath(orgId, `/courses/${idSeg(courseId)}/classes`), input, idempotencyKey);
}

// Hạ số tối đa dưới số đã ghi danh → 409 details.reason 'CAPACITY_BELOW_ENROLLED'.
export function updateClass(orgId: string, classId: string, input: ClassUpdateInput) {
  return api.patch<ClassView>(orgPath(orgId, `/classes/${idSeg(classId)}`), input);
}

// Lớp còn học viên → 409 details.reason 'CLASS_HAS_STUDENTS'.
export function cancelClass(orgId: string, classId: string, reason: string) {
  return api.post<ClassView>(orgPath(orgId, `/classes/${idSeg(classId)}/cancel`), { reason });
}

export function listClasses(orgId: string, query?: ClassListQuery, signal?: AbortSignal) {
  return api.get<Items<ClassListItem>>(withQuery(orgPath(orgId, '/classes'), query), signal);
}

// dryRun = true: xem trước sẽ thêm / sửa / huỷ bao nhiêu buổi và trùng giờ với lịch nào (không ghi).
// Ghi thật: lớp chưa có giờ học → 409 'CLASS_NO_TIME'; quá 200 buổi → 409 'TOO_MANY_SESSIONS'; trùng giờ giảng viên → 409
// details.conflicts (AppointmentConflict[]). Cần courses.write và schedule.write.
export function syncClassSessions(orgId: string, classId: string, dryRun: boolean) {
  return api.post<SessionSyncResult>(orgPath(orgId, `/classes/${idSeg(classId)}/sessions/sync`), { dryRun });
}

export function listEnrollments(orgId: string, classId: string, signal?: AbortSignal) {
  return api.get<Items<Enrollment>>(orgPath(orgId, `/classes/${idSeg(classId)}/enrollments`), signal);
}
