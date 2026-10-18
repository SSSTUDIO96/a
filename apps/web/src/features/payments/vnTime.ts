// Ngày giờ theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè) — cùng mốc máy chủ dùng cho báo cáo (payments/reports.ts).
// Ngày ở giao diện là chuỗi "YYYY-MM-DD"; gửi máy chủ dạng ISO kèm "+07:00".

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Ngày (YYYY-MM-DD) theo giờ Việt Nam của một thời điểm. */
export function vnDate(at: Date | string | number): string {
  const d = new Date(new Date(at).getTime() + VN_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function todayVn(now: Date = new Date()): string {
  return vnDate(now);
}

/** Cộng n ngày vào "YYYY-MM-DD". */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Số ngày từ a tới b (cả hai "YYYY-MM-DD"). */
export function daysBetween(a: string, b: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / DAY_MS);
}

/** Đầu ngày (00:00) giờ Việt Nam, dạng ISO kèm +07:00. */
export function startOfDayIso(date: string): string {
  return `${date}T00:00:00+07:00`;
}

/** Cuối ngày (23:59:59.999) giờ Việt Nam. Máy chủ lọc eventTo bằng "≤" nên lấy cả ngày. */
export function endOfDayIso(date: string): string {
  return `${date}T23:59:59.999+07:00`;
}

/**
 * Hạn một đợt thanh toán: hết ngày đó (23:59:59 giờ Việt Nam).
 * Máy chủ coi đợt quá hạn khi hạn < bây giờ — đặt hạn 00:00 thì đợt "hạn hôm nay" thành quá hạn ngay buổi sáng.
 */
export function dueDateIso(date: string): string {
  return `${date}T23:59:59+07:00`;
}

/**
 * Ngày thu ghi lùi: 12:00 trưa ngày đó (giờ Việt Nam) — giữa ngày nên không lệch sang ngày/tháng khác ở bất kỳ múi nào.
 * Ngày thu là hôm nay thì không gửi (máy chủ lấy đúng giờ ghi).
 */
export function receivedAtIso(date: string): string {
  return `${date}T12:00:00+07:00`;
}

/** "24/10/2026" */
export function fmtDate(at: string | Date | null | undefined): string {
  if (!at) return '';
  const [y, m, d] = vnDate(at).split('-');
  return `${d}/${m}/${y}`;
}

/** "24/10" */
export function fmtDayMonth(at: string | Date | null | undefined): string {
  if (!at) return '';
  const [, m, d] = vnDate(at).split('-');
  return `${d}/${m}`;
}

/** "YYYY-MM-DD" → "24/10/2026" */
export function fmtIsoDay(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}
