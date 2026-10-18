// Luật dùng chung cho khoá & lớp (BAN-VE-C3-DAO-TAO mục 1.1, 1.3). Máy chủ và web dùng CÙNG các hàm này.

// Giới hạn số khớp CHECK trong migration 20261018230000_dao_tao.
export const COURSE_LIMITS = {
  nameMax: 200,
  descriptionMax: 2000,
  capacityMin: 1,
  capacityMax: 500,
  sessionCountMin: 1,
  sessionCountMax: 365,
  sessionMinutesMin: 15,
  sessionMinutesMax: 720,
} as const;

// ---------- Tình trạng chỗ của lớp ----------

// Từ 75% số tối đa trở lên là "Sắp đầy".
export const ALMOST_FULL_RATIO = 0.75;

export const SEAT_STATES = ['AVAILABLE', 'ALMOST_FULL', 'FULL'] as const;
export type SeatState = (typeof SEAT_STATES)[number];

export const SEAT_STATE_LABELS: Record<SeatState, string> = {
  AVAILABLE: 'Còn chỗ',
  ALMOST_FULL: 'Sắp đầy',
  FULL: 'Hết chỗ',
};

// FULL khi đã ghi danh >= số tối đa; ALMOST_FULL khi đã ghi danh / số tối đa >= 0,75; còn lại AVAILABLE.
export function seatState(enrolledCount: number, capacity: number): SeatState {
  if (enrolledCount >= capacity) return 'FULL';
  if (enrolledCount >= capacity * ALMOST_FULL_RATIO) return 'ALMOST_FULL';
  return 'AVAILABLE';
}

export function seatsLeft(enrolledCount: number, capacity: number): number {
  return Math.max(0, capacity - enrolledCount);
}

// ---------- Thứ trong tuần (ISO: 1 = Thứ Hai … 7 = Chủ nhật) ----------

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };
export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ nhật',
};

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

// [6, 2, 4] → "T3 · T5 · T7" (sắp theo thứ trong tuần). Ném lỗi khi có số ngoài 1..7, trùng, hoặc rỗng.
export function weekdaysLabel(weekdays: readonly number[]): string {
  if (weekdays.length === 0) throw new Error('Lịch học phải có ít nhất một ngày trong tuần');
  for (const d of weekdays) {
    if (!isWeekday(d)) throw new Error(`Ngày trong tuần không hợp lệ: ${String(d)} (chỉ nhận 1 = Thứ Hai … 7 = Chủ nhật)`);
  }
  if (new Set(weekdays).size !== weekdays.length) throw new Error('Ngày trong tuần bị trùng');
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT[d as Weekday])
    .join(' · ');
}

// ---------- Giờ: phút từ 0:00 ↔ "HH:MM" ----------

// Phút tối đa là 1440 ("24:00") — chỉ dùng cho giờ kết thúc.
export const MAX_DAY_MINUTE = 1440;

// 1080 → "18:00"; 1440 → "24:00". Ném lỗi khi không phải số nguyên trong 0..1440.
export function minutesToTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_DAY_MINUTE) {
    throw new Error(`Số phút không hợp lệ: ${String(minutes)} (chỉ nhận số nguyên 0–1440)`);
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "18:00" → 1080; "24:00" → 1440. Đúng dạng HH:MM hai chữ số; sai dạng thì ném lỗi.
export function timeToMinutes(time: string): number {
  if (time === '24:00') return MAX_DAY_MINUTE;
  const m = typeof time === 'string' ? TIME_RE.exec(time) : null;
  if (!m) throw new Error(`Giờ không đúng dạng HH:MM (00:00–24:00): "${String(time)}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

// Lịch học hiển thị: "T2 · T4 · T6, 18:00–22:00" (không có giờ thì chỉ có thứ). Dùng cho ô `lich` của thẻ.
export function classScheduleLabel(
  weekdays: readonly number[],
  startMinute: number | null | undefined,
  endMinute: number | null | undefined,
): string {
  const days = weekdaysLabel(weekdays);
  if (startMinute == null || endMinute == null) return days;
  return `${days}, ${minutesToTime(startMinute)}–${minutesToTime(endMinute)}`;
}
