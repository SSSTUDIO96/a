// Kỳ báo cáo: Tháng · Quý · Năm, theo giờ Việt Nam. Máy chủ tính [from, to) nên `to` = đầu kỳ sau.
// Mã kỳ trong đường dẫn (?ky=): "2026-10" (tháng), "2026-Q4" (quý), "2026" (năm).

export type PeriodKind = 'month' | 'quarter' | 'year';

export interface Period {
  kind: PeriodKind;
  key: string;
  label: string;
  /** Đầu kỳ 00:00 +07:00. */
  from: string;
  /** Đầu kỳ sau 00:00 +07:00. */
  to: string;
  /** Tháng cuối của kỳ: năm, tháng (1–12). */
  lastMonth: { y: number; m: number };
}

const pad = (n: number) => String(n).padStart(2, '0');
const monthStart = (y: number, m: number) => {
  // m có thể vượt 12 → sang năm sau.
  const yy = y + Math.floor((m - 1) / 12);
  const mm = ((((m - 1) % 12) + 12) % 12) + 1;
  return `${yy}-${pad(mm)}-01T00:00:00+07:00`;
};

export function monthPeriod(y: number, m: number): Period {
  return { kind: 'month', key: `${y}-${pad(m)}`, label: `Tháng ${m}/${y}`, from: monthStart(y, m), to: monthStart(y, m + 1), lastMonth: { y, m } };
}

export function quarterPeriod(y: number, q: number): Period {
  const m = (q - 1) * 3 + 1;
  return { kind: 'quarter', key: `${y}-Q${q}`, label: `Quý ${q}/${y}`, from: monthStart(y, m), to: monthStart(y, m + 3), lastMonth: { y, m: m + 2 } };
}

export function yearPeriod(y: number): Period {
  return { kind: 'year', key: `${y}`, label: `Năm ${y}`, from: monthStart(y, 1), to: monthStart(y + 1, 1), lastMonth: { y, m: 12 } };
}

/** Năm, tháng hiện tại theo giờ Việt Nam. */
export function currentMonth(now: Date = new Date()): { y: number; m: number } {
  const d = new Date(now.getTime() + 7 * 3600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

/** Đọc mã kỳ; sai dạng → null (màn dùng tháng hiện tại và không đoán). */
export function parsePeriod(key: string | null): Period | null {
  if (!key) return null;
  let m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) {
    const mo = Number(m[2]);
    return mo >= 1 && mo <= 12 ? monthPeriod(Number(m[1]), mo) : null;
  }
  m = /^(\d{4})-Q([1-4])$/.exec(key);
  if (m) return quarterPeriod(Number(m[1]), Number(m[2]));
  m = /^(\d{4})$/.exec(key);
  if (m) return yearPeriod(Number(m[1]));
  return null;
}

/** Các kỳ cho ô chọn: mới nhất trước — 24 tháng, 8 quý, 5 năm gần đây (tính tới kỳ hiện tại). */
export function periodOptions(kind: PeriodKind, now: Date = new Date()): Period[] {
  const { y, m } = currentMonth(now);
  if (kind === 'month') return Array.from({ length: 24 }, (_, i) => monthPeriod(y + Math.floor((m - 1 - i) / 12), ((((m - 1 - i) % 12) + 12) % 12) + 1));
  if (kind === 'quarter') {
    const q = Math.floor((m - 1) / 3) + 1;
    return Array.from({ length: 8 }, (_, i) => {
      const idx = y * 4 + (q - 1) - i;
      return quarterPeriod(Math.floor(idx / 4), (idx % 4) + 1);
    });
  }
  return Array.from({ length: 5 }, (_, i) => yearPeriod(y - i));
}

/** Kỳ mặc định khi đổi loại kỳ: kỳ đang chứa tháng cuối của kỳ cũ. */
export function convertPeriod(p: Period, kind: PeriodKind): Period {
  const { y, m } = p.lastMonth;
  if (kind === 'month') return monthPeriod(y, m);
  if (kind === 'quarter') return quarterPeriod(y, Math.floor((m - 1) / 3) + 1);
  return yearPeriod(y);
}

/** 6 tháng gần nhất tính tới tháng cuối của kỳ: [from, to) cho biểu đồ (groupBy=month). */
export function sixMonthsTo(p: Period): { from: string; to: string } {
  const { y, m } = p.lastMonth;
  return { from: monthStart(y, m - 5), to: monthStart(y, m + 1) };
}
