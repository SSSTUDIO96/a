import {
  formatLocalDate,
  formatVnd,
  type ContractPrintData,
  type LocalDate,
  type PrintCourse,
  type PrintLine,
  type PrintSubLine,
  type PrintTravel,
  type Vnd,
} from '@makeup/shared';

// Dòng dữ liệu in → hàng hiển thị chung cho 5 bố cục (R&D: hangDichVu() ở ban-in.js).
// LUẬT CỨNG: web KHÔNG cộng / nhân tiền. Mọi số tiền trên hàng (dg, giam, tt) là bản sao NGUYÊN VĂN số máy chủ đã tính
// trong PrintData; bài rows.test.ts kiểm từng hàng bằng toBe và quét mã nguồn không có phép tính tiền.

export interface PrintRow {
  /** 0 = dòng gốc, 1 = dòng con (dịch vụ phụ, phụ phí, phí di chuyển). */
  cap: 0 | 1;
  stt: number | null;
  ten: string;
  /** "phát sinh dd/mm" khi dòng thêm sau lúc xác nhận. */
  phatSinh: string | null;
  chiTiet: string[];
  sl: number;
  dg: Vnd;
  giam: Vnd;
  tt: Vnd;
}

export interface RowOptions {
  /** Khối `chi-tiet`: giờ, địa điểm / lịch học. */
  detail: boolean;
  /** Khối `tho`: tên thợ. */
  staff: boolean;
}

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'] as const;
const PLACE_NAMES = { STUDIO: 'Tại studio', CUSTOMER_HOME: 'Tại nhà khách', OTHER: 'Địa điểm khác' } as const;
// Thứ trong tuần của lớp: 1..7 (ISO, 7 = Chủ nhật) → nhãn ngắn.
const COURSE_WEEKDAY: Record<number, string> = { 1: '2', 2: '3', 3: '4', 4: '5', 5: '6', 6: '7', 7: 'CN' };

export function weekdayName(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}

/** "2026-12-12" → "12/12". */
export function dayMonth(date: LocalDate): string {
  return formatLocalDate(date).slice(0, 5);
}

/** Số thực (km) theo kiểu Việt Nam: 18,4. */
export function formatKm(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

/** [2,4,6] → "Thứ 3, 5, 7"; [7] → "Chủ nhật"; [1,7] → "Thứ 2, CN". */
export function courseWeekdays(days: readonly number[]): string {
  const tokens = days.map((d) => {
    const t = COURSE_WEEKDAY[d];
    if (t === undefined) throw new RangeError(`Thứ trong tuần của lớp phải từ 1 đến 7, nhận ${d}`);
    return t;
  });
  if (tokens.length === 1 && tokens[0] === 'CN') return 'Chủ nhật';
  return `Thứ ${tokens.join(', ')}`;
}

/** Hợp đồng có nhiều hơn một ngày (`date`) khác nhau giữa các dòng gốc → bản in hiện "dd/mm · HH:MM–HH:MM" cạnh dòng. */
export function isMultiDay(lines: readonly PrintLine[]): boolean {
  return new Set(lines.map((l) => l.date).filter((d): d is LocalDate => d !== null)).size > 1;
}

function hoursText(start: string | null, end: string | null): string | null {
  if (start && end) return `${start}–${end}`;
  return start ?? end;
}

// Giờ + ngày của dòng gốc.
//  - nhiều ngày: "dd/mm · HH:MM–HH:MM" (khối chi-tiet tắt thì chỉ còn "dd/mm" để các dòng vẫn phân biệt được ngày);
//  - một ngày:   "HH:MM–HH:MM · Thứ Bảy 12/12/2026" (chỉ khi khối chi-tiet bật).
function scheduleText(l: PrintLine, multiDay: boolean, detail: boolean): string | null {
  const hours = hoursText(l.startTime, l.endTime);
  if (multiDay) {
    if (l.date === null) return detail ? hours : null;
    return detail && hours ? `${dayMonth(l.date)} · ${hours}` : dayMonth(l.date);
  }
  if (!detail) return null;
  if (l.date === null) return hours;
  const day = `${weekdayName(l.date)} ${formatLocalDate(l.date)}`;
  return hours ? `${hours} · ${day}` : day;
}

function placeText(l: PrintLine): string | null {
  if (l.location === null) return null;
  const label = PLACE_NAMES[l.location.type];
  return l.location.text ? `${label}: ${l.location.text}` : label;
}

function staffText(l: PrintLine): string | null {
  const parts: string[] = [];
  if (l.staff.primary.length) parts.push(`Thợ chính: ${l.staff.primary.join(', ')}`);
  if (l.staff.assist.length) parts.push(`Thợ phụ: ${l.staff.assist.join(', ')}`);
  return parts.length ? parts.join(' · ') : null;
}

function courseLines(c: PrintCourse): string[] {
  const out = [`Lớp ${c.className} · ${formatLocalDate(c.startDate)} – ${formatLocalDate(c.endDate)}`];
  const when = [
    c.weekdays.length ? courseWeekdays(c.weekdays) : null,
    hoursText(c.startTime, c.endTime),
    c.sessionCount !== null ? `${c.sessionCount} buổi` : null,
  ].filter((x): x is string => x !== null);
  if (when.length) out.push(when.join(' · '));
  const who = [
    c.instructorName ? `Giảng viên: ${c.instructorName}` : null,
    c.location ? `Tại ${c.location.address || c.location.name}` : null,
  ].filter((x): x is string => x !== null);
  if (who.length) out.push(who.join(' · '));
  return out;
}

/** Công thức phí di chuyển: "18,4 km một chiều, gói miễn 10 km → vượt 8,4 km × 2 chiều = 16,8 km × 15.000 ₫". */
export function travelFormula(t: PrintTravel): string | null {
  const b = t.breakdown;
  if (t.distanceKm === null) return null;
  if (b && b.includedKm !== null && b.excessKm !== null && b.chargedKm !== null && t.perKmAmount !== null) {
    const who = b.includedFrom === 'ORGANIZATION' ? 'studio miễn' : 'gói miễn';
    return (
      `${formatKm(t.distanceKm)} km một chiều, ${who} ${formatKm(b.includedKm)} km → vượt ${formatKm(b.excessKm)} km` +
      `${b.roundTrip ? ' × 2 chiều' : ''} = ${formatKm(b.chargedKm)} km × ${formatVnd(t.perKmAmount)}`
    );
  }
  if (b?.tier) {
    const range = b.tier.toKm === null ? `từ ${formatKm(b.tier.fromKm)} km trở lên` : `${formatKm(b.tier.fromKm)}–${formatKm(b.tier.toKm)} km`;
    return `Quãng đường ${formatKm(t.distanceKm)} km, bậc ${range}`;
  }
  return `Quãng đường ${formatKm(t.distanceKm)} km`;
}

function addedText(s: Pick<PrintSubLine, 'addedAfterConfirm' | 'addedOn'>): string | null {
  if (!s.addedAfterConfirm) return null;
  return s.addedOn ? `phát sinh ${dayMonth(s.addedOn)}` : 'phát sinh';
}

function subRow(s: PrintSubLine, chiTiet: string[] = []): PrintRow {
  return { cap: 1, stt: null, ten: s.name, phatSinh: addedText(s), chiTiet, sl: s.quantity, dg: s.unitPrice, giam: s.lineDiscount, tt: s.lineTotal };
}

/**
 * Dòng gốc + dòng con (dịch vụ phụ → phụ phí → phí di chuyển) thành hàng in. Phụ phí in TÊN + số lượng + tiền, đúng
 * lineTotal máy chủ; KHÔNG in tên luật hay ghi chú ghi đè (PrintSubLine không có các trường đó — đính chính 25/10/2026 mục 5).
 */
export function buildRows(data: ContractPrintData, opts: RowOptions): PrintRow[] {
  const multiDay = isMultiDay(data.lines);
  const out: PrintRow[] = [];
  data.lines.forEach((l, i) => {
    const detail: string[] = [];
    if (l.course) {
      if (opts.detail) detail.push(...courseLines(l.course));
    } else {
      const when = scheduleText(l, multiDay, opts.detail);
      if (when) detail.push(when);
      const where = opts.detail ? placeText(l) : null;
      if (where) detail.push(where);
    }
    const who = opts.staff ? staffText(l) : null;
    if (who) detail.push(who);
    if (l.note) detail.push(l.note);
    out.push({
      cap: 0,
      stt: i + 1,
      ten: l.subjectName ? `${l.subjectName} — ${l.name}` : l.name,
      phatSinh: addedText(l),
      chiTiet: detail,
      sl: l.quantity,
      dg: l.unitPrice,
      giam: l.lineDiscount,
      tt: l.lineTotal,
    });
    for (const a of l.addons) out.push(subRow(a));
    for (const s of l.surcharges) out.push(subRow(s));
    if (l.travel) {
      const formula = opts.detail ? travelFormula(l.travel) : null;
      out.push(subRow(l.travel, formula ? [formula] : []));
    }
  });
  return out;
}
