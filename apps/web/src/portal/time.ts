// Ngày giờ theo múi giờ của TRUNG TÂM (PortalMe.timezone), không theo máy học viên. Không thêm thư viện ngày (bản vẽ E mục 5.1).
// Chỉ dùng Intl. Múi giờ lạ → ném lỗi (RangeError của Intl), không đoán.

export interface DayParts {
  y: number;
  m: number;
  d: number;
  /** 1 = Thứ Hai … 7 = Chủ nhật (cùng quy ước Course.weekdays). */
  wd: number;
  hh: number;
  mm: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function partsInZone(at: Date | string, tz: string): DayParts {
  const date = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) throw new RangeError(`Thời điểm không hợp lệ: ${String(at)}`);
  const get: Record<string, string> = {};
  for (const p of formatterFor(tz).formatToParts(date)) get[p.type] = p.value;
  const wd = WEEKDAY_INDEX[get.weekday ?? ''];
  if (wd === undefined) throw new RangeError(`Không đọc được thứ trong tuần: ${get.weekday ?? '(trống)'}`);
  return { y: Number(get.year), m: Number(get.month), d: Number(get.day), wd, hh: Number(get.hour), mm: Number(get.minute) };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' của một thời điểm theo múi giờ trung tâm. */
export function ymdInZone(at: Date | string, tz: string): string {
  const p = partsInZone(at, tz);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

/** 'YYYY-MM-DD' → số ngày liên tục (UTC), để lấy hiệu hai ngày mà không dính giờ mùa hè. */
export function dayNumber(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) throw new RangeError(`Ngày không đúng dạng YYYY-MM-DD: ${ymd}`);
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

export const WEEKDAY_NAME: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ nhật',
};

/** Thứ của một ngày 'YYYY-MM-DD' (1 = Thứ Hai … 7 = Chủ nhật). */
export function weekdayOfYmd(ymd: string): number {
  const n = dayNumber(ymd);
  // 1970-01-01 là Thứ Năm (4).
  return ((((n + 3) % 7) + 7) % 7) + 1;
}

/** '2026-11-03' → '03/11/2026'. */
export function dmy(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) throw new RangeError(`Ngày không đúng dạng YYYY-MM-DD: ${ymd}`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** '2026-11-03' → '03/11'. */
export function dm(ymd: string): string {
  return dmy(ymd).slice(0, 5);
}

/** Thời điểm → '03/11/2026' theo múi giờ trung tâm. */
export function dmyInZone(at: Date | string, tz: string): string {
  return dmy(ymdInZone(at, tz));
}

/** Thời điểm → '18:00' theo múi giờ trung tâm. */
export function hmInZone(at: Date | string, tz: string): string {
  const p = partsInZone(at, tz);
  return `${pad2(p.hh)}:${pad2(p.mm)}`;
}

/** '2026-11-03' → 'Thứ Ba 03/11'. */
export function weekdayDm(ymd: string): string {
  return `${WEEKDAY_NAME[weekdayOfYmd(ymd)]} ${dm(ymd)}`;
}
