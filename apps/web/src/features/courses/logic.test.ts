import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import type { ClassView, Course } from '../../api/courses';
import {
  buildClassUpdate,
  buildCourseUpdate,
  buildCreateBody,
  calendarText,
  courseListSub,
  coursePerms,
  emptyCourseForm,
  mapServerErrors,
  nextClassName,
  scheduleText,
  seatInfo,
  sessionSyncLines,
  sessionText,
  validateCourseForm,
  withCourseCapacity,
  withCourseName,
} from './logic';

const T = '2026-10-18T03:00:00.000Z';
const course: Course = {
  id: 'k', code: 'KH-0001', name: 'Makeup Hàn Quốc', mode: 'SINGLE_CLASS', groupId: null, tuitionFee: 6_500_000, depositAmount: 0,
  defaultCapacity: 8, sessionCount: null, sessionMinutes: null, description: null, sortOrder: 0, archivedAt: null, createdAt: T, updatedAt: T,
};
const k: ClassView = {
  id: 'c', courseId: 'k', name: 'Makeup Hàn Quốc', startDate: '2026-11-15', endDate: '2026-12-02', weekdays: [1, 3], startTime: '18:00', endTime: '22:00',
  capacity: 8, enrolledCount: 5, seatsLeft: 3, seatState: 'AVAILABLE', status: 'OPEN', note: null, instructor: null, location: null, calendar: { total: 0, upcoming: 0 },
};

describe('seatInfo — dùng seatState() chung với máy chủ', () => {
  it('biên 0, 74%, 75%, 100% và vượt', () => {
    expect(seatInfo(0, 8)).toMatchObject({ state: 'AVAILABLE', label: 'còn 8 chỗ', tone: 'accent', percent: 0 });
    expect(seatInfo(74, 100)).toMatchObject({ state: 'AVAILABLE', label: 'còn 26 chỗ' });
    expect(seatInfo(75, 100)).toMatchObject({ state: 'ALMOST_FULL', label: 'Sắp đầy · còn 25', tone: 'warn' });
    expect(seatInfo(7, 8)).toMatchObject({ state: 'ALMOST_FULL', label: 'Sắp đầy · còn 1' });
    expect(seatInfo(8, 8)).toMatchObject({ state: 'FULL', label: 'Hết chỗ', tone: 'neutral', percent: 100 });
    expect(seatInfo(9, 8)).toMatchObject({ state: 'FULL', left: 0, percent: 100 });
  });
});

describe('chữ hiển thị', () => {
  it('dòng phụ danh sách: Một lớp "31/10–21/11 · 7/10 học viên", Nhiều lớp "3 lớp · 2 còn chỗ", chưa có lớp', () => {
    expect(courseListSub({ mode: 'SINGLE_CLASS', classSummary: { total: 1, open: 1, withSeats: 1, nextStartDate: null }, singleClass: { ...k, startDate: '2026-10-31', endDate: '2026-11-21', enrolledCount: 7, capacity: 10 } })).toBe('31/10–21/11 · 7/10 học viên');
    expect(courseListSub({ mode: 'MULTI_CLASS', classSummary: { total: 3, open: 3, withSeats: 2, nextStartDate: null }, singleClass: null })).toBe('3 lớp · 2 còn chỗ');
    expect(courseListSub({ mode: 'MULTI_CLASS', classSummary: { total: 0, open: 0, withSeats: 0, nextStartDate: null }, singleClass: null })).toBe('Chưa mở lớp');
    expect(courseListSub({ mode: 'SINGLE_CLASS', classSummary: { total: 0, open: 0, withSeats: 0, nextStartDate: null }, singleClass: null })).toBe('Chưa có lớp');
  });

  it('lịch học, số buổi', () => {
    expect(scheduleText({ weekdays: [7, 6], startTime: '08:30', endTime: '12:30' })).toBe('T7 · CN, 08:30–12:30');
    expect(scheduleText({ weekdays: [2], startTime: null, endTime: null })).toBe('T3');
    expect(sessionText({ sessionCount: 8, sessionMinutes: 240 })).toBe('8 buổi × 4 giờ');
    expect(sessionText({ sessionCount: 6, sessionMinutes: 90 })).toBe('6 buổi × 1 giờ 30 phút');
    expect(sessionText({ sessionCount: null, sessionMinutes: null })).toBeNull();
  });

  it('gợi ý tên lớp tiếp theo theo số K lớn nhất, bỏ qua tên đã dùng', () => {
    expect(nextClassName('Makeup nâng cao', [{ name: 'Nâng cao K1' }, { name: 'Nâng cao K3' }, { name: 'Nâng cao K2' }])).toBe('Nâng cao K4');
    expect(nextClassName('Makeup nâng cao', [])).toBe('Makeup nâng cao K1');
    expect(nextClassName('Makeup nâng cao', [{ name: 'Lớp sáng' }])).toBe('Makeup nâng cao K1');
  });

  it('quyền: courses.read / courses.write / contracts.write', () => {
    const p = coursePerms((x) => x === 'courses.read');
    expect(p).toEqual({ read: true, write: false, enroll: false, staff: false, locations: false, calendar: false });
    // Nút "Đưa lên Lịch": cần CẢ courses.write lẫn schedule.write (máy chủ kiểm cả hai).
    expect(coursePerms((x) => x === 'courses.write').calendar).toBe(false);
    expect(coursePerms((x) => x === 'schedule.write').calendar).toBe(false);
    expect(coursePerms((x) => x === 'courses.write' || x === 'schedule.write').calendar).toBe(true);
  });
});

describe('form khoá', () => {
  it('trống: lỗi đúng 4 ô bắt buộc + lịch học (Một lớp)', () => {
    expect(Object.keys(validateCourseForm(emptyCourseForm()))).toEqual(['name', 'tuitionFee', 'capacity', 'dates', 'weekdays']);
  });

  it('Nhiều lớp: thêm tên lớp và số tối đa của lớp; tên lớp và số tối đa đi theo khoá tới khi người dùng tự sửa', () => {
    let f = emptyCourseForm('MULTI_CLASS');
    expect(Object.keys(validateCourseForm(f))).toEqual(['name', 'tuitionFee', 'capacity', 'dates', 'weekdays', 'className', 'classCapacity']);
    f = withCourseCapacity(withCourseName(f, 'Nâng cao'), 8);
    expect([f.className, f.classCapacity]).toEqual(['Nâng cao K1', 8]);
    f = withCourseCapacity(withCourseName({ ...f, className: 'Lớp sáng', classNameTouched: true, classCapacity: 6, classCapacityTouched: true }, 'Nâng cao 2'), 10);
    expect([f.className, f.classCapacity]).toEqual(['Lớp sáng', 6]);
  });

  it('kiểm chéo: cọc ≤ học phí, ngày kết thúc ≥ ngày bắt đầu, giờ đi cặp và kết thúc sau bắt đầu, tối đa 1–500', () => {
    const f = { ...emptyCourseForm(), name: 'A', tuitionFee: 100, depositAmount: 200, capacity: 0, startDate: '2026-11-02', endDate: '2026-11-01', weekdays: [1], startTime: '18:00', endTime: null };
    expect(validateCourseForm(f)).toEqual({
      depositAmount: 'Cọc mặc định không được lớn hơn học phí',
      capacity: 'Số học viên tối đa ít nhất 1',
      dates: 'Ngày kết thúc phải từ ngày bắt đầu trở đi',
      time: 'Nhập đủ giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai',
    });
    expect(validateCourseForm({ ...f, depositAmount: 0, capacity: 501, endDate: '2026-11-02', endTime: '17:00' })).toEqual({
      capacity: 'Số học viên tối đa không quá 500',
      time: 'Giờ kết thúc phải sau giờ bắt đầu',
    });
  });

  it('thân tạo khoá Một lớp không có firstClass.name; bỏ trường trống', () => {
    const f = { ...emptyCourseForm(), name: ' Đi tiệc ', tuitionFee: 2_500_000, capacity: 10, startDate: '2026-10-31', endDate: '2026-11-21', weekdays: [5] };
    expect(buildCreateBody(f)).toEqual({
      name: 'Đi tiệc', mode: 'SINGLE_CLASS', tuitionFee: 2_500_000, defaultCapacity: 10,
      firstClass: { startDate: '2026-10-31', endDate: '2026-11-21', weekdays: [5], capacity: 10 },
    });
  });

  it('sửa: chỉ gửi trường đã đổi; Một → Nhiều gửi firstClassName; lớp: bỏ giờ gửi cả hai null', () => {
    const f = { ...emptyCourseForm('MULTI_CLASS'), name: 'Makeup Hàn Quốc', tuitionFee: 6_500_000, depositAmount: 0, capacity: 8, className: 'Hàn Quốc K1' };
    expect(buildCourseUpdate(course, f)).toEqual({ mode: 'MULTI_CLASS', firstClassName: 'Hàn Quốc K1' });
    expect(buildCourseUpdate(course, { ...f, mode: 'SINGLE_CLASS', tuitionFee: 7_000_000 })).toEqual({ tuitionFee: 7_000_000 });
    const s = { startDate: k.startDate, endDate: k.endDate, weekdays: [3, 1], startTime: null, endTime: null, instructorId: '', locationId: '', capacity: 6 };
    expect(buildClassUpdate(k, s)).toEqual({ startTime: null, endTime: null, capacity: 6 });
  });
});

describe('lỗi máy chủ → đúng ô', () => {
  const v400 = (issues: { path: string; message: string }[]) => new ApiError('VALIDATION_FAILED', 'Dữ liệu không hợp lệ', 400, 'r', { issues });
  it('400 tạo khoá: đường firstClass.* về ô lịch; capacity theo kiểu khoá', () => {
    const e = v400([
      { path: 'name', message: 'a' },
      { path: 'firstClass.name', message: 'b' },
      { path: 'firstClass.endDate', message: 'c' },
      { path: 'firstClass.weekdays.0', message: 'd' },
      { path: 'firstClass.capacity', message: 'e' },
      { path: 'defaultCapacity', message: 'f' },
      { path: 'firstClass.instructorMembershipId', message: 'g' },
      { path: 'firstClass', message: 'h' },
    ]);
    expect(mapServerErrors(e, 'course', false)).toEqual({ name: 'a', className: 'b', dates: 'c', weekdays: 'd', classCapacity: 'e', capacity: 'f', instructor: 'g', general: 'h' });
    expect(mapServerErrors(v400([{ path: 'firstClass.capacity', message: 'e' }]), 'course', true)).toEqual({ capacity: 'e' });
  });

  it('409 theo details.reason', () => {
    const c = (reason: string, msg: string) => new ApiError('CONFLICT', msg, 409, 'r', { reason });
    expect(mapServerErrors(c('CAPACITY_BELOW_ENROLLED', 'x'), 'class')).toEqual({ classCapacity: 'x' });
    expect(mapServerErrors(c('CAPACITY_BELOW_ENROLLED', 'x'), 'class', true)).toEqual({ capacity: 'x' });
    expect(mapServerErrors(c('SINGLE_MODE_NEEDS_ONE_CLASS', 'y'), 'course')).toEqual({ mode: 'y' });
    expect(mapServerErrors(c('SINGLE_CLASS', 'z'), 'class')).toEqual({ general: 'z' });
  });
});

describe('buổi học trên Lịch (việc tồn 6)', () => {
  const base = { status: 'OPEN' as const };
  it('BẮT: chữ trạng thái Lịch trên thẻ lớp', () => {
    expect(calendarText({ ...base, calendar: { total: 0, upcoming: 0 } })).toEqual({ label: 'Chưa lên Lịch', on: false });
    expect(calendarText({ ...base, calendar: { total: 8, upcoming: 6 } })).toEqual({ label: 'Đã lên Lịch · 6 buổi sắp tới', on: true });
    expect(calendarText({ ...base, calendar: { total: 8, upcoming: 0 } }).label).toBe('Đã lên Lịch · 8 buổi đã qua');
  });

  it('BẮT: dòng xem trước — thêm (khoảng ngày), đổi, huỷ, giữ, huỷ tay; không có gì đổi thì báo đã khớp', () => {
    const s = { create: 3, update: 1, cancel: 2, keep: 4, past: 1, skippedManual: ['2027-03-08'], firstNewDate: '2027-03-01', lastNewDate: '2027-03-15' };
    expect(sessionSyncLines(s)).toEqual([
      'Thêm 3 buổi học (01/03/2027 → 15/03/2027)',
      'Đổi giờ / giảng viên / nơi học của 1 buổi cho khớp lịch lớp',
      'Huỷ 2 buổi không còn trong lịch lớp',
      '4 buổi đã khớp lịch lớp — giữ nguyên',
      '1 buổi đã diễn ra — giữ nguyên',
      '1 buổi đã huỷ tay (08/03) — không thêm lại',
    ]);
    expect(sessionSyncLines({ ...s, create: 0, update: 0, cancel: 0, skippedManual: [] }).at(-1)).toBe('Lịch đã khớp lịch lớp — không cần cập nhật');
    expect(sessionSyncLines({ create: 0, update: 0, cancel: 0, keep: 0, past: 0, skippedManual: [], firstNewDate: null, lastNewDate: null })).toEqual([
      'Không còn buổi học nào từ hôm nay đến ngày kết thúc lớp',
    ]);
  });
});
