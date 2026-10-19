// Luật thuần của màn Khoá & lớp (bản vẽ C3 mục 2.1, 2.2): chữ dòng danh sách, nhãn chỗ, kiểm form, dựng thân gửi máy chủ,
// ánh xạ lỗi máy chủ về đúng ô. Không gọi máy chủ, không đụng React — bài thử gọi thẳng.
import {
  COURSE_LIMITS,
  seatState,
  seatsLeft,
  weekdaysLabel,
  type Permission,
  type SeatState,
} from '@makeup/shared';
import { ApiError, fieldErrors } from '../../api/errors';
import type {
  ClassCreateInput,
  ClassUpdateInput,
  ClassView,
  Course,
  CourseCreateInput,
  CourseListItem,
  CourseMode,
  CourseUpdateInput,
  SessionSyncSummary,
} from '../../api/courses';

// ---------- Quyền ----------

export interface CoursePerms {
  read: boolean;
  // Thêm / sửa khoá, nhóm, mở / sửa / huỷ lớp.
  write: boolean;
  // Nút "Ghi danh" (lập hợp đồng khoá học) — bản vẽ 2.1: cần contracts.write.
  enroll: boolean;
  // Ô chọn giảng viên đọc danh sách thợ (staff.read); ô "Ở đâu" đọc cơ sở (catalog.read).
  staff: boolean;
  locations: boolean;
  // Nút "Đưa buổi học lên Lịch" ở thẻ lớp: máy chủ cần cả courses.write và schedule.write.
  calendar: boolean;
}

export function coursePerms(has: (p: Permission) => boolean): CoursePerms {
  return {
    read: has('courses.read'),
    write: has('courses.write'),
    enroll: has('contracts.write'),
    staff: has('staff.read'),
    locations: has('catalog.read'),
    calendar: has('courses.write') && has('schedule.write'),
  };
}

// ---------- Buổi học trên Lịch (việc tồn 6) ----------

export const NO_TIME_REASON = 'Lớp chưa có giờ học — sửa lớp, nhập giờ học rồi mới đưa buổi học lên Lịch';

// Trạng thái Lịch trên thẻ lớp: "Chưa lên Lịch" / "Đã lên Lịch · 6 buổi sắp tới" / "Đã lên Lịch · các buổi đã qua".
export function calendarText(k: Pick<ClassView, 'calendar' | 'status'>): { label: string; on: boolean } {
  const { total, upcoming } = k.calendar;
  if (total === 0) return { label: 'Chưa lên Lịch', on: false };
  if (upcoming === 0) return { label: k.status === 'CANCELLED' ? `Đã lên Lịch ${total} buổi (đã huỷ lớp)` : `Đã lên Lịch · ${total} buổi đã qua`, on: true };
  return { label: `Đã lên Lịch · ${upcoming} buổi sắp tới`, on: true };
}

// Các dòng xem trước của hộp "Đưa buổi học lên Lịch".
export function sessionSyncLines(s: SessionSyncSummary): string[] {
  const out: string[] = [];
  if (s.create > 0) {
    const range = s.firstNewDate && s.lastNewDate ? (s.firstNewDate === s.lastNewDate ? ` (${fullDate(s.firstNewDate)})` : ` (${fullDate(s.firstNewDate)} → ${fullDate(s.lastNewDate)})`) : '';
    out.push(`Thêm ${s.create} buổi học${range}`);
  }
  if (s.update > 0) out.push(`Đổi giờ / giảng viên / nơi học của ${s.update} buổi cho khớp lịch lớp`);
  if (s.cancel > 0) out.push(`Huỷ ${s.cancel} buổi không còn trong lịch lớp`);
  if (s.keep > 0) out.push(`${s.keep} buổi đã khớp lịch lớp — giữ nguyên`);
  if (s.past > 0) out.push(`${s.past} buổi đã diễn ra — giữ nguyên`);
  if (s.skippedManual.length > 0) out.push(`${s.skippedManual.length} buổi đã huỷ tay (${s.skippedManual.map(dayMonth).join(', ')}) — không thêm lại`);
  if (s.create + s.update + s.cancel === 0 && s.keep + s.past === 0) out.push('Không còn buổi học nào từ hôm nay đến ngày kết thúc lớp');
  else if (s.create + s.update + s.cancel === 0) out.push('Lịch đã khớp lịch lớp — không cần cập nhật');
  return out;
}

// ---------- Chữ hiển thị ----------

export const MODE_LABEL: Record<CourseMode, string> = { SINGLE_CLASS: 'Một lớp', MULTI_CLASS: 'Nhiều lớp' };

// "2026-10-31" → "31/10".
export function dayMonth(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[1]}` : iso;
}

// "2026-10-31" → "31/10/2026".
export function fullDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Dòng phụ của khoá trong danh sách (sau nhãn Một lớp / Nhiều lớp).
// Một lớp: "31/10–21/11 · 7/10 học viên". Nhiều lớp: "3 lớp · 2 còn chỗ".
export function courseListSub(c: Pick<CourseListItem, 'mode' | 'classSummary' | 'singleClass'>): string {
  if (c.mode === 'SINGLE_CLASS') {
    const k = c.singleClass;
    if (!k) return 'Chưa có lớp';
    return `${dayMonth(k.startDate)}–${dayMonth(k.endDate)} · ${k.enrolledCount}/${k.capacity} học viên`;
  }
  const s = c.classSummary;
  if (s.total === 0) return 'Chưa mở lớp';
  return `${s.total} lớp · ${s.withSeats} còn chỗ`;
}

// Lịch học: "T2 · T4, 18:00–22:00" (không giờ thì chỉ có thứ).
export function scheduleText(k: Pick<ClassView, 'weekdays' | 'startTime' | 'endTime'>): string {
  let days: string;
  try {
    days = weekdaysLabel(k.weekdays);
  } catch {
    days = '—';
  }
  return k.startTime && k.endTime ? `${days}, ${k.startTime}–${k.endTime}` : days;
}

// "8 buổi × 4 giờ"; thiếu số buổi → null (màn hiện "Chưa đặt").
export function sessionText(c: Pick<Course, 'sessionCount' | 'sessionMinutes'>): string | null {
  if (c.sessionCount == null) return null;
  if (c.sessionMinutes == null) return `${c.sessionCount} buổi`;
  return `${c.sessionCount} buổi × ${durationText(c.sessionMinutes)}`;
}

export function durationText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

// Nhãn chỗ theo seatState dùng chung (packages/shared). Tính lại từ số đã ghi danh / số tối đa — đúng hàm máy chủ dùng.
export interface SeatInfo {
  state: SeatState;
  left: number;
  label: string;
  tone: 'accent' | 'warn' | 'neutral';
  // Phần trăm thanh đầy (0–100).
  percent: number;
}

export function seatInfo(enrolledCount: number, capacity: number): SeatInfo {
  const state = seatState(enrolledCount, capacity);
  const left = seatsLeft(enrolledCount, capacity);
  const percent = capacity > 0 ? Math.min(100, Math.round((enrolledCount / capacity) * 100)) : 100;
  if (state === 'FULL') return { state, left, label: 'Hết chỗ', tone: 'neutral', percent };
  if (state === 'ALMOST_FULL') return { state, left, label: `Sắp đầy · còn ${left}`, tone: 'warn', percent };
  return { state, left, label: `còn ${left} chỗ`, tone: 'accent', percent };
}

// Gợi ý tên lớp tiếp theo: lớp đã có "Nâng cao K3" → "Nâng cao K4". Chưa có lớp kiểu "… K<số>" → "<tên khoá> K<n+1>".
// Tên đã dùng (kể cả lớp đã huỷ — máy chủ giữ tên duy nhất trong khoá) thì tăng tiếp.
export function nextClassName(courseName: string, classes: readonly Pick<ClassView, 'name'>[]): string {
  let prefix = courseName.trim();
  let max = 0;
  for (const k of classes) {
    const m = /^(.*?)\s*K(\d+)$/i.exec(k.name.trim());
    if (m && Number(m[2]) >= max) {
      max = Number(m[2]);
      prefix = (m[1] ?? '').trim() || prefix;
    }
  }
  const taken = new Set(classes.map((k) => k.name.trim().toLocaleLowerCase('vi')));
  let n = max + 1;
  if (max === 0) n = 1;
  let name = `${prefix} K${n}`;
  while (taken.has(name.toLocaleLowerCase('vi'))) {
    n += 1;
    name = `${prefix} K${n}`;
  }
  return name;
}

// Lớp còn hoạt động (chưa huỷ) — khoá Một lớp có đúng 1 lớp như vậy.
export function liveClasses(classes: readonly ClassView[]): ClassView[] {
  return classes.filter((k) => k.status !== 'CANCELLED');
}

// ---------- Form khoá ----------

export type FieldKey =
  | 'mode'
  | 'name'
  | 'groupId'
  | 'tuitionFee'
  | 'depositAmount'
  | 'capacity'
  | 'session'
  | 'description'
  | 'className'
  | 'dates'
  | 'weekdays'
  | 'time'
  | 'classCapacity'
  | 'instructor'
  | 'location'
  | 'status';

export type FormErrors = Partial<Record<FieldKey | 'general', string>>;

export interface ScheduleFields {
  startDate: string | null;
  endDate: string | null;
  weekdays: number[];
  startTime: string | null;
  endTime: string | null;
  instructorId: string;
  locationId: string;
}

export interface CourseForm extends ScheduleFields {
  mode: CourseMode;
  name: string;
  groupId: string;
  tuitionFee: number | null;
  depositAmount: number | null;
  // Số học viên tối đa: Một lớp = số tối đa của lớp; Nhiều lớp = số mặc định của khoá.
  capacity: number | null;
  sessionCount: number | null;
  sessionMinutes: number | null;
  description: string;
  // Nhiều lớp: tên lớp đầu tiên (thêm) / tên lớp hiện có khi chuyển Một → Nhiều (sửa). Tự theo tên khoá tới khi người dùng gõ.
  className: string;
  classNameTouched: boolean;
  // Nhiều lớp (thêm): số tối đa của lớp đầu tiên — lấy sẵn từ khoá tới khi người dùng sửa.
  classCapacity: number | null;
  classCapacityTouched: boolean;
}

export function emptyCourseForm(mode: CourseMode = 'SINGLE_CLASS'): CourseForm {
  return {
    mode,
    name: '',
    groupId: '',
    tuitionFee: null,
    depositAmount: null,
    capacity: null,
    sessionCount: null,
    sessionMinutes: null,
    description: '',
    className: '',
    classNameTouched: false,
    classCapacity: null,
    classCapacityTouched: false,
    startDate: null,
    endDate: null,
    weekdays: [],
    startTime: null,
    endTime: null,
    instructorId: '',
    locationId: '',
  };
}

// Form sửa khoá từ dữ liệu máy chủ. Khoá Một lớp: phần lịch lấy từ lớp duy nhất chưa huỷ.
export function courseToForm(course: Course, classes: readonly ClassView[]): CourseForm {
  const only = course.mode === 'SINGLE_CLASS' ? liveClasses(classes)[0] : undefined;
  return {
    ...emptyCourseForm(course.mode),
    name: course.name,
    groupId: course.groupId ?? '',
    tuitionFee: course.tuitionFee,
    depositAmount: course.depositAmount,
    capacity: only ? only.capacity : course.defaultCapacity,
    sessionCount: course.sessionCount,
    sessionMinutes: course.sessionMinutes,
    description: course.description ?? '',
    className: `${course.name} K1`,
    ...(only ? classToSchedule(only) : {}),
  };
}

export function classToSchedule(k: ClassView): ScheduleFields {
  return {
    startDate: k.startDate,
    endDate: k.endDate,
    weekdays: [...k.weekdays].sort((a, b) => a - b),
    startTime: k.startTime,
    endTime: k.endTime,
    instructorId: k.instructor?.membershipId ?? '',
    locationId: k.location?.id ?? '',
  };
}

// Đổi tên khoá / số tối đa của khoá thì tên lớp và số tối đa của lớp đi theo — tới khi người dùng tự sửa ô đó.
export function withCourseName(f: CourseForm, name: string): CourseForm {
  return { ...f, name, className: f.classNameTouched ? f.className : name.trim() ? `${name.trim()} K1` : '' };
}

export function withCourseCapacity(f: CourseForm, capacity: number | null): CourseForm {
  return { ...f, capacity, classCapacity: f.classCapacityTouched ? f.classCapacity : capacity };
}

function checkCapacity(v: number | null, label: string): string | undefined {
  if (v === null) return `Nhập ${label}`;
  if (!Number.isInteger(v) || v < COURSE_LIMITS.capacityMin) return `${capitalize(label)} ít nhất ${COURSE_LIMITS.capacityMin}`;
  if (v > COURSE_LIMITS.capacityMax) return `${capitalize(label)} không quá ${COURSE_LIMITS.capacityMax}`;
  return undefined;
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('vi') + s.slice(1);
}

// Kiểm phần lịch (bản vẽ 2.2 "Kiểm ở web trước khi gửi"): ngày kết thúc ≥ ngày bắt đầu, ít nhất 1 thứ, giờ kết thúc sau giờ bắt đầu.
export function validateSchedule(s: ScheduleFields): FormErrors {
  const e: FormErrors = {};
  if (!s.startDate || !s.endDate) e.dates = 'Nhập ngày bắt đầu và ngày kết thúc';
  else if (s.endDate < s.startDate) e.dates = 'Ngày kết thúc phải từ ngày bắt đầu trở đi';
  if (s.weekdays.length === 0) e.weekdays = 'Chọn ít nhất một ngày trong tuần';
  if ((s.startTime === null) !== (s.endTime === null)) e.time = 'Nhập đủ giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai';
  else if (s.startTime && s.endTime && s.endTime <= s.startTime) e.time = 'Giờ kết thúc phải sau giờ bắt đầu';
  return e;
}

export interface CourseFormContext {
  // Đang sửa khoá có sẵn (không phải thêm mới).
  editing: boolean;
  // Khoá đang sửa là khoá Một lớp (có phần lịch của lớp duy nhất).
  wasSingle?: boolean;
}

// Kiểm cả form. Bốn ô bắt buộc của anh Chiến: tên, thời gian, học phí, số học viên tối đa (+ kiểu khoá luôn có giá trị).
export function validateCourseForm(f: CourseForm, ctx: CourseFormContext = { editing: false }): FormErrors {
  const e: FormErrors = {};
  const name = f.name.trim();
  if (!name) e.name = 'Nhập tên khoá';
  else if (name.length > COURSE_LIMITS.nameMax) e.name = `Tên khoá tối đa ${COURSE_LIMITS.nameMax} ký tự`;
  if (f.tuitionFee === null) e.tuitionFee = 'Nhập học phí';
  if (f.tuitionFee !== null && f.depositAmount !== null && f.depositAmount > f.tuitionFee) {
    e.depositAmount = 'Cọc mặc định không được lớn hơn học phí';
  }
  const cap = checkCapacity(f.capacity, 'số học viên tối đa');
  if (cap) e.capacity = cap;
  if (f.sessionCount !== null && (f.sessionCount < COURSE_LIMITS.sessionCountMin || f.sessionCount > COURSE_LIMITS.sessionCountMax)) {
    e.session = `Số buổi từ ${COURSE_LIMITS.sessionCountMin} đến ${COURSE_LIMITS.sessionCountMax}`;
  } else if (f.sessionMinutes !== null && (f.sessionMinutes < COURSE_LIMITS.sessionMinutesMin || f.sessionMinutes > COURSE_LIMITS.sessionMinutesMax)) {
    e.session = `Mỗi buổi từ ${COURSE_LIMITS.sessionMinutesMin} đến ${COURSE_LIMITS.sessionMinutesMax} phút`;
  } else if (f.sessionMinutes !== null && f.sessionCount === null) {
    e.session = 'Nhập số buổi trước khi nhập số phút mỗi buổi';
  }
  if (f.description.trim().length > COURSE_LIMITS.descriptionMax) e.description = `Mô tả tối đa ${COURSE_LIMITS.descriptionMax} ký tự`;

  // Phần lịch: thêm khoá (cả hai kiểu đều nhập lớp đầu tiên) hoặc sửa khoá đang là Một lớp.
  const hasSchedule = !ctx.editing || ctx.wasSingle === true;
  if (hasSchedule) Object.assign(e, validateSchedule(f));
  // Tên lớp: thêm khoá Nhiều lớp (lớp đầu tiên) hoặc chuyển Một → Nhiều (đặt tên lớp hiện có).
  const needsClassName = f.mode === 'MULTI_CLASS' && (!ctx.editing || ctx.wasSingle === true);
  if (needsClassName) {
    const cn = f.className.trim();
    if (!cn) e.className = 'Nhập tên lớp, ví dụ "Nâng cao K1"';
    else if (cn.length > COURSE_LIMITS.nameMax) e.className = `Tên lớp tối đa ${COURSE_LIMITS.nameMax} ký tự`;
  }
  if (!ctx.editing && f.mode === 'MULTI_CLASS') {
    const cc = checkCapacity(f.classCapacity, 'số tối đa của lớp');
    if (cc) e.classCapacity = cc;
  }
  return e;
}

const sortDays = (w: readonly number[]) => [...w].sort((a, b) => a - b);

// Thân POST /courses. Một lớp: firstClass không có name, capacity = số tối đa. Nhiều lớp: firstClass có name và số tối đa riêng.
export function buildCreateBody(f: CourseForm): CourseCreateInput {
  const single = f.mode === 'SINGLE_CLASS';
  const body: CourseCreateInput = {
    name: f.name.trim(),
    mode: f.mode,
    tuitionFee: f.tuitionFee ?? 0,
    defaultCapacity: f.capacity ?? 0,
  };
  if (f.groupId) body.groupId = f.groupId;
  if (f.depositAmount !== null) body.depositAmount = f.depositAmount;
  if (f.sessionCount !== null) body.sessionCount = f.sessionCount;
  if (f.sessionMinutes !== null) body.sessionMinutes = f.sessionMinutes;
  if (f.description.trim()) body.description = f.description.trim();
  body.firstClass = {
    ...(single ? {} : { name: f.className.trim() }),
    startDate: f.startDate ?? '',
    endDate: f.endDate ?? '',
    weekdays: sortDays(f.weekdays),
    ...(f.startTime && f.endTime ? { startTime: f.startTime, endTime: f.endTime } : {}),
    capacity: (single ? f.capacity : f.classCapacity) ?? 0,
    ...(f.instructorId ? { instructorMembershipId: f.instructorId } : {}),
    ...(f.locationId ? { studioLocationId: f.locationId } : {}),
  };
  return body;
}

// Thân PATCH /courses/:id — chỉ trường đã đổi. Chuyển Một → Nhiều gửi kèm firstClassName (lớp hiện có giữ nguyên id).
export function buildCourseUpdate(course: Course, f: CourseForm): CourseUpdateInput {
  const out: CourseUpdateInput = {};
  const name = f.name.trim();
  if (name !== course.name) out.name = name;
  const groupId = f.groupId || null;
  if (groupId !== course.groupId) out.groupId = groupId;
  if (f.tuitionFee !== null && f.tuitionFee !== course.tuitionFee) out.tuitionFee = f.tuitionFee;
  const deposit = f.depositAmount ?? 0;
  if (deposit !== course.depositAmount) out.depositAmount = deposit;
  if (f.capacity !== null && f.capacity !== course.defaultCapacity) out.defaultCapacity = f.capacity;
  if (f.sessionCount !== course.sessionCount) out.sessionCount = f.sessionCount;
  if (f.sessionMinutes !== course.sessionMinutes) out.sessionMinutes = f.sessionMinutes;
  const desc = f.description.trim() || null;
  if (desc !== course.description) out.description = desc;
  if (f.mode !== course.mode) {
    out.mode = f.mode;
    if (course.mode === 'SINGLE_CLASS' && f.mode === 'MULTI_CLASS') out.firstClassName = f.className.trim();
  }
  return out;
}

// Thân PATCH /classes/:id từ phần lịch (+ số tối đa, tên) — chỉ trường đã đổi.
export function buildClassUpdate(
  k: ClassView,
  s: ScheduleFields & { capacity: number | null; name?: string; status?: 'OPEN' | 'CLOSED' },
): ClassUpdateInput {
  const out: ClassUpdateInput = {};
  if (s.name !== undefined && s.name.trim() !== k.name) out.name = s.name.trim();
  if (s.startDate && s.startDate !== k.startDate) out.startDate = s.startDate;
  if (s.endDate && s.endDate !== k.endDate) out.endDate = s.endDate;
  const days = sortDays(s.weekdays);
  if (days.join(',') !== sortDays(k.weekdays).join(',')) out.weekdays = days;
  if (s.startTime !== k.startTime || s.endTime !== k.endTime) {
    out.startTime = s.startTime;
    out.endTime = s.endTime;
  }
  if (s.capacity !== null && s.capacity !== k.capacity) out.capacity = s.capacity;
  const ins = s.instructorId || null;
  if (ins !== (k.instructor?.membershipId ?? null)) out.instructorMembershipId = ins;
  const loc = s.locationId || null;
  if (loc !== (k.location?.id ?? null)) out.studioLocationId = loc;
  if (s.status !== undefined && k.status !== 'CANCELLED' && s.status !== k.status) out.status = s.status;
  return out;
}

// Thân POST /courses/:id/classes.
export function buildClassCreate(s: ScheduleFields & { name: string; capacity: number | null }): ClassCreateInput {
  return {
    name: s.name.trim(),
    startDate: s.startDate ?? '',
    endDate: s.endDate ?? '',
    weekdays: sortDays(s.weekdays),
    ...(s.startTime && s.endTime ? { startTime: s.startTime, endTime: s.endTime } : {}),
    ...(s.capacity !== null ? { capacity: s.capacity } : {}),
    ...(s.instructorId ? { instructorMembershipId: s.instructorId } : {}),
    ...(s.locationId ? { studioLocationId: s.locationId } : {}),
  };
}

// ---------- Lỗi máy chủ → đúng ô ----------

// where: 'course' (form khoá), 'class' (form lớp). single: khoá Một lớp (số tối đa của lớp nằm ở ô "Số học viên tối đa").
export function mapServerErrors(err: unknown, where: 'course' | 'class', single = false): FormErrors {
  const out: FormErrors = {};
  const fe = fieldErrors(err);
  const put = (k: FieldKey | 'general', msg: string) => {
    if (out[k] === undefined) out[k] = msg;
  };
  for (const [path, msg] of Object.entries(fe)) {
    const p = path.replace(/^firstClass\./, '');
    const fromFirst = path.startsWith('firstClass.');
    const leaf = p.split('.')[0] ?? p;
    if (path === 'firstClass') put('general', msg);
    else if (leaf === 'name' && (fromFirst || where === 'class')) put('className', msg);
    else if (leaf === 'name') put('name', msg);
    else if (leaf === 'firstClassName') put('className', msg);
    else if (leaf === 'groupId') put('groupId', msg);
    else if (leaf === 'tuitionFee') put('tuitionFee', msg);
    else if (leaf === 'depositAmount') put('depositAmount', msg);
    else if (leaf === 'defaultCapacity') put('capacity', msg);
    else if (leaf === 'sessionCount' || leaf === 'sessionMinutes') put('session', msg);
    else if (leaf === 'description') put('description', msg);
    else if (leaf === 'startDate' || leaf === 'endDate') put('dates', msg);
    else if (leaf === 'weekdays') put('weekdays', msg);
    else if (leaf === 'startTime' || leaf === 'endTime') put('time', msg);
    else if (leaf === 'capacity') put(where === 'class' && !single ? 'classCapacity' : single || !fromFirst ? 'capacity' : 'classCapacity', msg);
    else if (leaf === 'instructorMembershipId') put('instructor', msg);
    else if (leaf === 'studioLocationId') put('location', msg);
    else if (leaf === 'status') put('status', msg);
    else if (leaf === 'mode') put('mode', msg);
    else put('general', msg);
  }
  if (err instanceof ApiError && Object.keys(out).length === 0) {
    const reason = conflictReason(err);
    if (reason === 'CAPACITY_BELOW_ENROLLED') put(where === 'class' && !single ? 'classCapacity' : 'capacity', err.message);
    else if (reason === 'SINGLE_MODE_NEEDS_ONE_CLASS') put('mode', err.message);
    else put('general', err.message);
  }
  return out;
}

// details.reason của 409 (SINGLE_CLASS, SINGLE_MODE_NEEDS_ONE_CLASS, CAPACITY_BELOW_ENROLLED, CLASS_HAS_STUDENTS…).
export function conflictReason(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const r = (err.details as { reason?: unknown } | undefined)?.reason;
  return typeof r === 'string' ? r : null;
}

// Có lỗi nào không (bỏ khoá undefined).
export function hasErrors(e: FormErrors): boolean {
  return Object.values(e).some((v) => v !== undefined);
}
