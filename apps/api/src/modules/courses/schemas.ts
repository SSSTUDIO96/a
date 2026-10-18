// Thân / tham số của đường Khoá & lớp (bản vẽ C3 mục 1.3).
// Luật PATCH (sổ lỗi, lỗi S1 + http/partial.ts): KHÔNG dùng .default() ở thân sửa một phần — trường vắng mặt giữ nguyên.
// Giá trị mặc định khi TẠO được điền trong service.ts, không điền trong schema.
import { z } from 'zod';
import { COURSE_LIMITS, timeToMinutes } from '@makeup/shared';
import { BoolQuery, Code, Money, OrgParams, SearchQuery, SortOrder, nonEmpty, strictBody } from '../catalog/common';

export { OrgParams };
export const GroupParams = OrgParams.extend({ groupId: z.uuid() });
export const CourseParams = OrgParams.extend({ courseId: z.uuid() });
export const ClassParams = OrgParams.extend({ classId: z.uuid() });

// ---------- Mảnh dùng chung ----------

const GroupName = z.string().trim().min(1, 'Tên nhóm không được để trống').max(120, 'Tên nhóm tối đa 120 ký tự');
const CourseName = z
  .string()
  .trim()
  .min(1, 'Tên khoá không được để trống')
  .max(COURSE_LIMITS.nameMax, `Tên khoá tối đa ${COURSE_LIMITS.nameMax} ký tự`);
const ClassName = z.string().trim().min(1, 'Tên lớp không được để trống').max(COURSE_LIMITS.nameMax, `Tên lớp tối đa ${COURSE_LIMITS.nameMax} ký tự`);
const Description = z.string().trim().max(COURSE_LIMITS.descriptionMax, `Mô tả tối đa ${COURSE_LIMITS.descriptionMax} ký tự`);
const Note = z.string().trim().max(2000, 'Ghi chú tối đa 2000 ký tự');
const Reason = z.string().trim().min(1, 'Nhập lý do').max(500, 'Lý do tối đa 500 ký tự');

export const Capacity = z
  .number({ error: 'Số học viên tối đa phải là số' })
  .int('Số học viên tối đa phải là số nguyên')
  .min(COURSE_LIMITS.capacityMin, `Số học viên tối đa ít nhất ${COURSE_LIMITS.capacityMin}`)
  .max(COURSE_LIMITS.capacityMax, `Số học viên tối đa không quá ${COURSE_LIMITS.capacityMax}`);
const SessionCount = z
  .number({ error: 'Số buổi phải là số' })
  .int('Số buổi phải là số nguyên')
  .min(COURSE_LIMITS.sessionCountMin, `Số buổi ít nhất ${COURSE_LIMITS.sessionCountMin}`)
  .max(COURSE_LIMITS.sessionCountMax, `Số buổi không quá ${COURSE_LIMITS.sessionCountMax}`);
const SessionMinutes = z
  .number({ error: 'Số phút mỗi buổi phải là số' })
  .int('Số phút mỗi buổi phải là số nguyên')
  .min(COURSE_LIMITS.sessionMinutesMin, `Mỗi buổi ít nhất ${COURSE_LIMITS.sessionMinutesMin} phút`)
  .max(COURSE_LIMITS.sessionMinutesMax, `Mỗi buổi không quá ${COURSE_LIMITS.sessionMinutesMax} phút`);

// Ngày trên dây: "YYYY-MM-DD" (ngày lịch, không giờ, không múi giờ).
export const DateOnly = z.iso.date({ error: 'Ngày phải theo dạng YYYY-MM-DD, ví dụ 2026-11-03' });

// Giờ trên dây: "HH:MM" (00:00–24:00). Đổi sang phút bằng hàm dùng chung timeToMinutes.
export const TimeOfDay = z.string({ error: 'Giờ phải theo dạng HH:MM, ví dụ 18:00' }).refine((s) => {
  try {
    timeToMinutes(s);
    return true;
  } catch {
    return false;
  }
}, 'Giờ phải theo dạng HH:MM (00:00–24:00), ví dụ 18:00');

// Thứ trong tuần ISO: 1 = Thứ Hai … 7 = Chủ nhật; ít nhất 1 ngày, không trùng.
export const Weekdays = z
  .array(z.number({ error: 'Thứ phải là số 1–7' }).int('Thứ phải là số nguyên 1–7').min(1, 'Thứ chỉ nhận 1 (Thứ Hai) … 7 (Chủ nhật)').max(7, 'Thứ chỉ nhận 1 (Thứ Hai) … 7 (Chủ nhật)'), {
    error: 'Lịch học phải là danh sách thứ trong tuần',
  })
  .min(1, 'Chọn ít nhất một ngày trong tuần')
  .max(7, 'Tối đa 7 ngày trong tuần')
  .refine((a) => new Set(a).size === a.length, 'Ngày trong tuần bị trùng');

// Phần lịch của một lớp (dùng cho firstClass và mở lớp). Kiểm chéo trường (ngày kết thúc ≥ ngày bắt đầu, giờ đi cặp…)
// nằm ở service.ts để PATCH kiểm trên giá trị ĐÃ GỘP với bản đang lưu.
const ClassFields = {
  startDate: DateOnly,
  endDate: DateOnly,
  weekdays: Weekdays,
  startTime: TimeOfDay.optional(),
  endTime: TimeOfDay.optional(),
  // Bỏ trống = số tối đa mặc định của khoá.
  capacity: Capacity.optional(),
  instructorMembershipId: z.uuid().optional(),
  studioLocationId: z.uuid().optional(),
  note: Note.optional(),
};

// firstClass của khoá: Một lớp KHÔNG gửi name (máy chủ đặt bằng tên khoá); Nhiều lớp bắt buộc name — kiểm ở service.
export const FirstClassBody = strictBody({ name: ClassName.optional(), ...ClassFields });

// ---------- Nhóm khoá ----------

export const CreateGroupBody = strictBody({ name: GroupName, sortOrder: SortOrder.optional() });

export const UpdateGroupBody = strictBody({
  name: GroupName.optional(),
  sortOrder: SortOrder.optional(),
  isActive: z.boolean().optional(),
}).refine(nonEmpty, 'Không có gì để sửa');

// ---------- Khoá ----------

export const CourseMode = z.enum(['SINGLE_CLASS', 'MULTI_CLASS'], { error: 'Kiểu khoá phải là SINGLE_CLASS hoặc MULTI_CLASS' });

export const ListCoursesQuery = z.object({
  groupId: z.uuid().optional(),
  q: SearchQuery,
  includeArchived: BoolQuery.optional(),
});

export const CreateCourseBody = strictBody({
  name: CourseName,
  groupId: z.uuid().nullable().optional(),
  // Bỏ trống: máy chủ tự sinh KH-0001, KH-0002… theo tổ chức.
  code: Code.optional(),
  mode: CourseMode,
  tuitionFee: Money,
  depositAmount: Money.optional(),
  defaultCapacity: Capacity,
  sessionCount: SessionCount.nullable().optional(),
  sessionMinutes: SessionMinutes.nullable().optional(),
  description: Description.nullable().optional(),
  sortOrder: SortOrder.optional(),
  firstClass: FirstClassBody.optional(),
});

export const UpdateCourseBody = strictBody(
  {
    name: CourseName.optional(),
    groupId: z.uuid().nullable().optional(),
    code: Code.optional(),
    tuitionFee: Money.optional(),
    depositAmount: Money.optional(),
    defaultCapacity: Capacity.optional(),
    sessionCount: SessionCount.nullable().optional(),
    sessionMinutes: SessionMinutes.nullable().optional(),
    description: Description.nullable().optional(),
    sortOrder: SortOrder.optional(),
    mode: CourseMode.optional(),
    // Chỉ dùng khi chuyển Một lớp → Nhiều lớp: đặt tên cho lớp hiện có (giữ nguyên id, học viên, hợp đồng).
    firstClassName: ClassName.optional(),
  },
  'mở lớp mới dùng POST /courses/:courseId/classes',
).refine(nonEmpty, 'Không có gì để sửa');

export const ArchiveCourseBody = strictBody({ reason: Reason });

// ---------- Lớp ----------

export const CreateClassBody = strictBody({ name: ClassName, ...ClassFields });

export const UpdateClassBody = strictBody(
  {
    name: ClassName.optional(),
    startDate: DateOnly.optional(),
    endDate: DateOnly.optional(),
    weekdays: Weekdays.optional(),
    // null = bỏ giờ học (gửi cả hai cùng null).
    startTime: TimeOfDay.nullable().optional(),
    endTime: TimeOfDay.nullable().optional(),
    capacity: Capacity.optional(),
    instructorMembershipId: z.uuid().nullable().optional(),
    studioLocationId: z.uuid().nullable().optional(),
    // Huỷ lớp dùng POST /classes/:classId/cancel (cần lý do, chặn khi còn học viên).
    status: z.enum(['OPEN', 'CLOSED'], { error: 'Trạng thái chỉ nhận OPEN hoặc CLOSED — huỷ lớp dùng đường /cancel' }).optional(),
    note: Note.nullable().optional(),
  },
  'số đã ghi danh do máy chủ tự đếm',
).refine(nonEmpty, 'Không có gì để sửa');

export const CancelClassBody = strictBody({ reason: Reason });

export const ListClassesQuery = z.object({
  from: DateOnly.optional(),
  to: DateOnly.optional(),
  courseId: z.uuid().optional(),
  // true: chỉ lớp đang mở còn chỗ; false: chỉ lớp không nhận thêm (hết chỗ hoặc đã đóng).
  hasSeats: BoolQuery.optional(),
  instructorId: z.uuid().optional(),
  // Mặc định ẩn lớp đã huỷ và lớp của khoá đã lưu trữ.
  includeCancelled: BoolQuery.optional(),
});

export type CreateCourseInput = z.infer<typeof CreateCourseBody>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseBody>;
export type FirstClassInput = z.infer<typeof FirstClassBody>;
export type CreateClassInput = z.infer<typeof CreateClassBody>;
export type UpdateClassInput = z.infer<typeof UpdateClassBody>;
export type ListClassesInput = z.infer<typeof ListClassesQuery>;
