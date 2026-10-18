// Giờ hiển thị của màn Lịch: luôn theo giờ Việt Nam (Asia/Ho_Chi_Minh = UTC+7, không đổi giờ mùa hè).
// Làm bằng phép cộng lệch cố định để kết quả giống nhau trên mọi máy (máy chủ CI chạy UTC, trình duyệt chạy giờ khác...).

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
const OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Ngày theo lịch Việt Nam, dạng "YYYY-MM-DD".
export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

function toMs(t: string | number | Date): number {
  if (typeof t === 'number') return t;
  if (t instanceof Date) return t.getTime();
  return Date.parse(t);
}

// Đồng hồ treo tường Việt Nam: đọc các trường getUTC* của mốc đã cộng 7 giờ.
function wall(t: string | number | Date): Date {
  return new Date(toMs(t) + OFFSET_MS);
}

export function dayKeyOf(t: string | number | Date): DayKey {
  const w = wall(t);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`;
}

export function todayKey(now: number = Date.now()): DayKey {
  return dayKeyOf(now);
}

export function isDayKey(s: string | null | undefined): s is DayKey {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return dayKeyOf(dayStartMs(s)) === s;
}

function parts(k: DayKey): [number, number, number] {
  const [y, m, d] = k.split('-').map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

// Mốc 00:00 giờ Việt Nam của ngày k (ms, UTC).
export function dayStartMs(k: DayKey): number {
  const [y, m, d] = parts(k);
  return Date.UTC(y, m - 1, d) - OFFSET_MS;
}

export function addDays(k: DayKey, n: number): DayKey {
  return dayKeyOf(dayStartMs(k) + n * DAY_MS + DAY_MS / 2);
}

// 0 = Thứ Hai … 6 = Chủ nhật.
export function weekdayIndex(k: DayKey): number {
  const [y, m, d] = parts(k);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

// Tuần bắt đầu Thứ Hai (thói quen lịch làm việc ở Việt Nam; bản mẫu C: 19 – 25/10 là Thứ Hai → Chủ nhật).
export function weekStartOf(k: DayKey): DayKey {
  return addDays(k, -weekdayIndex(k));
}

export function weekDays(k: DayKey): DayKey[] {
  const start = weekStartOf(k);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isWeekend(k: DayKey): boolean {
  return weekdayIndex(k) >= 5;
}

export const WEEKDAY_LONG = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'] as const;
export const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

export function weekdayLong(k: DayKey): string {
  return WEEKDAY_LONG[weekdayIndex(k)] ?? '';
}

export function weekdayShort(k: DayKey): string {
  return WEEKDAY_SHORT[weekdayIndex(k)] ?? '';
}

export function dayNumber(k: DayKey): number {
  return parts(k)[2];
}

// "19/10"
export function ddmm(k: DayKey): string {
  const [, m, d] = parts(k);
  return `${pad(d)}/${pad(m)}`;
}

// "24/10/2026"
export function ddmmyyyy(k: DayKey): string {
  const [y] = parts(k);
  return `${ddmm(k)}/${y}`;
}

// "19 – 25/10/2026"; khác tháng: "28/09 – 04/10/2026"; khác năm: "29/12/2025 – 04/01/2026".
export function weekLabel(k: DayKey): string {
  const days = weekDays(k);
  const a = days[0]!;
  const b = days[6]!;
  const [ya, ma, da] = parts(a);
  const [yb, mb] = parts(b);
  if (ya !== yb) return `${ddmmyyyy(a)} – ${ddmmyyyy(b)}`;
  if (ma !== mb) return `${ddmm(a)} – ${ddmmyyyy(b)}`;
  return `${da} – ${ddmmyyyy(b)}`;
}

// "Thứ Bảy, 24/10/2026"
export function dayLabel(k: DayKey): string {
  return `${weekdayLong(k)}, ${ddmmyyyy(k)}`;
}

// "Tháng 10, 2026"
export function monthLabel(k: DayKey): string {
  const [y, m] = parts(k);
  return `Tháng ${m}, ${y}`;
}

// "06:30" theo giờ Việt Nam.
export function hhmm(t: string | number | Date): string {
  const w = wall(t);
  return `${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
}

// Số phút tính từ 00:00 của ngày k (có thể âm hoặc vượt 1440 với ca qua đêm).
export function minutesFromDayStart(t: string | number | Date, k: DayKey): number {
  return (toMs(t) - dayStartMs(k)) / 60_000;
}

// Mốc ISO kèm múi +07:00 cho máy chủ: "2026-10-24T06:30:00+07:00".
export function vnIso(k: DayKey, time: string): string {
  return `${k}T${time.length === 5 ? `${time}:00` : time}+07:00`;
}

// Khoảng gọi GET /appointments cho tuần chứa k: [Thứ Hai 00:00, Thứ Hai tuần sau 00:00) giờ Việt Nam.
export function weekRange(k: DayKey): { from: string; to: string } {
  const start = weekStartOf(k);
  return { from: vnIso(start, '00:00'), to: vnIso(addDays(start, 7), '00:00') };
}

// "4,5 giờ" · "1,75 giờ" · "3 giờ" (tối đa 2 chữ số lẻ, dấu phẩy thập phân).
export function formatHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 100) / 100;
  return `${h.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} giờ`;
}

// "1 giờ 30 phút", "45 phút", "2 giờ".
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} phút`;
  return r === 0 ? `${h} giờ` : `${h} giờ ${r} phút`;
}
