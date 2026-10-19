// PHỤ PHÍ TỰ ĐỘNG — hàm thuần (bản vẽ D mục 2.4; ký duyệt D câu 5). Máy chủ là nơi DUY NHẤT tính
// (apps/api/src/modules/contracts/autoSurcharge.ts gọi các hàm ở đây); web không tự tính tiền phụ phí.
//
// Mọi hàm ở đây TẤT ĐỊNH: không đọc giờ hệ thống, không đọc múi giờ máy chạy — múi giờ tổ chức và thời điểm là tham số.
// Cùng đầu vào (kể cả đảo thứ tự mảng luật) → cùng kết quả.
//
// Luật khớp một dòng đặt chỗ khi MỌI điều kiện đã điền đều đúng (VÀ); trong nhóm "Ngày", thứ trong tuần và ngày cụ thể
// nối bằng HOẶC. Nhiều luật khớp: khác dịch vụ → cộng dồn; cùng dịch vụ → chỉ luật xếp trên (sortOrder, tên, id) thắng.
// Luật người lập đã bỏ ở dòng (dismissed) không bao giờ được chọn lại — và KHÔNG che luật khác.
import { computeLineTotal, ContractMathError } from './contract';
import type { Vnd } from './money';

// ---------- Ngày giờ theo múi giờ tổ chức ----------

const MINUTES_PER_DAY = 1440;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Bộ định dạng theo múi giờ (tạo Intl.DateTimeFormat tốn kém). Bộ nhớ đệm chỉ giữ đồ vật dựng từ tham số — không ảnh
// hưởng kết quả. Múi giờ sai → Intl ném RangeError ngay lần đầu.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let f = formatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timezone, f);
  }
  return f;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(instant: Date, timezone: string): ZonedParts {
  const parts = formatterFor(timezone).formatToParts(instant);
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Vài bản ICU cũ in "24" cho nửa đêm dù h23 — vẫn là đầu ngày đó.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

function assertInstant(instant: Date, fn: string): void {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new RangeError(`${fn}: thời điểm không hợp lệ: ${String(instant)}`);
  }
}

// Độ lệch (ms) của múi giờ tại một thời điểm: giờ địa phương − giờ UTC.
function tzOffsetMs(instant: Date, timezone: string): number {
  const p = zonedParts(instant, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// "2026-11-03" + 1080 phút theo múi giờ tổ chức → thời điểm UTC. 1440 phút = 0:00 ngày hôm sau.
// (Chuyển từ apps/api/src/modules/courses/sessions.ts — một bản duy nhất, sessions.ts nhập lại từ đây.)
export function zonedInstant(date: string, minute: number, timezone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(y, m - 1, d, 0, minute);
  const first = naive - tzOffsetMs(new Date(naive), timezone);
  // Lần hai cho múi giờ có giờ mùa hè (độ lệch ở thời điểm thật có thể khác lần đoán đầu).
  return new Date(naive - tzOffsetMs(new Date(first), timezone));
}

// Thứ ISO của ngày "YYYY-MM-DD" (ngày theo lịch, không múi giờ): 1 = Thứ Hai … 7 = Chủ nhật.
// Ngày sai dạng hoặc không có thật (2026-02-30) → RangeError, không âm thầm "không khớp".
export function isoWeekdayOf(date: string): number {
  const m = typeof date === 'string' ? DATE_RE.exec(date) : null;
  if (!m) throw new RangeError(`Ngày không đúng dạng YYYY-MM-DD: "${String(date)}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) {
    throw new RangeError(`Ngày không có thật: "${date}"`);
  }
  const w = t.getUTCDay();
  return w === 0 ? 7 : w;
}

// Ngày + phút (từ 0:00, giây bỏ) + thứ ISO của một thời điểm theo múi giờ tổ chức.
// 2026-12-31T17:30:00Z ở Asia/Ho_Chi_Minh → { date: '2027-01-01', minute: 30, weekday: 5 }.
export function localDateAndMinute(instant: Date, timezone: string): { date: string; minute: number; weekday: number } {
  assertInstant(instant, 'localDateAndMinute');
  const p = zonedParts(instant, timezone);
  const date = `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  return { date, minute: p.hour * 60 + p.minute, weekday: isoWeekdayOf(date) };
}

// ---------- Luật ----------

export interface RuleLike {
  id: string;
  name: string;
  serviceId: string;
  sortOrder: number;
  // Khung giờ BẮT ĐẦU, phút từ 0:00 theo múi giờ tổ chức. Cả hai null = không xét giờ. start > end = qua nửa đêm.
  startMinute: number | null;
  endMinute: number | null;
  // 1 = Thứ Hai … 7 = Chủ nhật. Rỗng = không xét thứ.
  weekdays: readonly number[];
  // "YYYY-MM-DD". Rỗng (cùng weekdays rỗng) = không xét ngày.
  dates: readonly string[];
  occasionIds: readonly string[];
  packageIds: readonly string[];
  subjectIds: readonly string[];
  // true: số lượng dòng tự thêm = số lượng dòng đặt chỗ (phù dâu × 2 → phụ phí × 2); false: luôn 1.
  perQuantity: boolean;
}

export interface LineFacts {
  // Ngày của dòng theo múi giờ tổ chức; null = không biết ngày (dòng chưa có giờ và hợp đồng chưa có ngày sự kiện).
  localDate: string | null;
  // Phút bắt đầu theo múi giờ tổ chức; null = dòng chưa có giờ.
  startMinute: number | null;
  occasionId: string | null;
  packageId: string | null;
  subjectId: string | null;
}

function assertMinute(value: number, min: number, max: number, what: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${what} phải là số nguyên ${min}–${max}, nhận: ${String(value)}`);
  }
}

// Khung giờ NỬA MỞ [start, end) theo phút trong ngày. start < end: start <= m < end. start > end (qua nửa đêm, ví dụ
// 22:00–04:00): m >= start || m < end. end = 1440 nghĩa là "đến hết 23:59". Khung không hợp lệ (start = end, ngoài
// 0–1439 / 1–1440) → RangeError: database đã chặn (CHECK surcharge_rules_window), gặp ở đây là lỗi lập trình.
export function inWindow(minute: number, start: number, end: number): boolean {
  assertMinute(minute, 0, MINUTES_PER_DAY - 1, 'Phút bắt đầu của dòng');
  assertMinute(start, 0, MINUTES_PER_DAY - 1, 'Giờ bắt đầu khung');
  assertMinute(end, 1, MINUTES_PER_DAY, 'Giờ kết thúc khung');
  if (start === end) throw new RangeError(`Khung giờ rỗng: bắt đầu = kết thúc = ${start}`);
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

function hasWindow(rule: Pick<RuleLike, 'startMinute' | 'endMinute'>): boolean {
  if (rule.startMinute === null && rule.endMinute === null) return false;
  if (rule.startMinute === null || rule.endMinute === null) {
    throw new RangeError('Khung giờ của luật phải có cả giờ bắt đầu và giờ kết thúc');
  }
  return true;
}

// Luật có ít nhất một điều kiện KÍCH HOẠT: khung giờ, thứ, ngày cụ thể hoặc loại sự kiện. Chỉ gói / nhân vật thì không
// phải phụ phí mà là giá (bản vẽ D 2.3 checkRuleShape). Máy chủ chặn lúc lưu; ruleMatches chặn thêm lần nữa lúc tính —
// luật không có điều kiện kích hoạt KHÔNG khớp dòng nào (không bao giờ tự thêm tiền vào mọi dòng).
export function ruleHasTrigger(
  rule: Pick<RuleLike, 'startMinute' | 'endMinute' | 'weekdays' | 'dates' | 'occasionIds'>,
): boolean {
  return hasWindow(rule) || rule.weekdays.length > 0 || rule.dates.length > 0 || rule.occasionIds.length > 0;
}

// Mọi điều kiện ĐÃ ĐIỀN đều phải đúng (VÀ); trong nhóm Ngày: thứ HOẶC ngày cụ thể.
export function ruleMatches(rule: RuleLike, line: LineFacts): boolean {
  if (!ruleHasTrigger(rule)) return false;
  // 1. Khung giờ: dòng chưa có giờ → không khớp.
  if (hasWindow(rule)) {
    if (line.startMinute === null) return false;
    if (!inWindow(line.startMinute, rule.startMinute as number, rule.endMinute as number)) return false;
  }
  // 2. Ngày: dòng không biết ngày → không khớp.
  if (rule.weekdays.length > 0 || rule.dates.length > 0) {
    if (line.localDate === null) return false;
    const weekday = isoWeekdayOf(line.localDate); // kiểm dạng ngày cả khi luật chỉ có ngày cụ thể
    const byDate = rule.dates.includes(line.localDate);
    const byWeekday = rule.weekdays.includes(weekday);
    if (!byDate && !byWeekday) return false;
  }
  // 3–5. Thuộc tập: giá trị null (chưa chọn sự kiện, dòng dịch vụ lẻ không có gói, chưa có nhân vật) → không khớp.
  if (rule.occasionIds.length > 0 && (line.occasionId === null || !rule.occasionIds.includes(line.occasionId))) return false;
  if (rule.packageIds.length > 0 && (line.packageId === null || !rule.packageIds.includes(line.packageId))) return false;
  if (rule.subjectIds.length > 0 && (line.subjectId === null || !rule.subjectIds.includes(line.subjectId))) return false;
  return true;
}

// So sánh chuỗi theo mã ký tự (không theo ngôn ngữ máy chạy — localeCompare đổi theo ICU/locale nên không tất định).
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Thứ tự luật: sortOrder nhỏ trước, rồi tên, rồi id. Luật đứng trước thắng khi cùng dịch vụ.
export function compareRules(a: Pick<RuleLike, 'sortOrder' | 'name' | 'id'>, b: Pick<RuleLike, 'sortOrder' | 'name' | 'id'>): number {
  return a.sortOrder - b.sortOrder || cmpStr(a.name, b.name) || cmpStr(a.id, b.id);
}

// Các luật KHỚP dòng, đã sắp (compareRules), đã khử trùng dịch vụ: mỗi serviceId chỉ luật đứng đầu vào `kept`, các luật
// cùng dịch vụ còn lại vào `shadowed` kèm luật thắng. Luật trong `dismissed` bị loại TRƯỚC khi khử trùng: không được
// chọn lại và không che luật khác (bỏ luật A thì luật B cùng dịch vụ — nếu khớp — được áp; người lập bỏ tiếp được).
// Cùng một id xuất hiện hai lần trong `rules` chỉ tính một lần.
export function pickSurchargeRules<R extends RuleLike>(
  rules: readonly R[],
  line: LineFacts,
  dismissed: ReadonlySet<string>,
): { kept: R[]; shadowed: { rule: R; by: R }[] } {
  const seenIds = new Set<string>();
  const matched: R[] = [];
  for (const r of [...rules].sort(compareRules)) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    if (dismissed.has(r.id)) continue;
    if (ruleMatches(r, line)) matched.push(r);
  }
  const winner = new Map<string, R>();
  const kept: R[] = [];
  const shadowed: { rule: R; by: R }[] = [];
  for (const r of matched) {
    const by = winner.get(r.serviceId);
    if (by) {
      shadowed.push({ rule: r, by });
    } else {
      winner.set(r.serviceId, r);
      kept.push(r);
    }
  }
  return { kept, shadowed };
}

// ---------- Số lượng và thành tiền của dòng tự thêm ----------

// Phần người lập đã sửa ở một dòng tự thêm (surchargeOverrides của bản vẽ D 2.4). Ghi chú không đụng tiền nên không ở đây.
export interface SurchargeOverrideAmount {
  quantity?: number;
  unitPrice?: Vnd;
}

function assertQuantity(q: number, what: string): void {
  if (!Number.isSafeInteger(q) || q < 1) {
    throw new ContractMathError(`${what} phải là số nguyên từ 1, nhận: ${String(q)}`);
  }
}

// Số lượng dòng tự thêm: người lập sửa thì theo số đã sửa; không thì perQuantity ? số lượng dòng đặt chỗ : 1.
// Số lượng dòng đặt chỗ / số đã sửa < 1 hoặc không nguyên → ContractMathError (máy chủ đổi thành 400), không làm tròn.
export function surchargeQuantity(perQuantity: boolean, lineQuantity: number, overrideQuantity?: number): number {
  assertQuantity(lineQuantity, 'Số lượng dòng đặt chỗ');
  if (overrideQuantity !== undefined) {
    assertQuantity(overrideQuantity, 'Số lượng phụ phí đã sửa');
    return overrideQuantity;
  }
  return perQuantity ? lineQuantity : 1;
}

export type AutoSurchargeAmount =
  | {
      ok: true;
      quantity: number;
      unitPrice: Vnd;
      lineTotal: Vnd;
      // Người lập có sửa số lượng hoặc giá.
      overridden: boolean;
      // Giá do người lập sửa (dòng lưu priceVersionId = null, bắt buộc ghi chú — máy chủ kiểm).
      priceOverridden: boolean;
    }
  | { ok: false; reason: 'NO_PRICE' };

// Thành tiền một dòng tự thêm. Giá: giá người lập sửa nếu có, không thì `listPrice` (giá hiện hành của dịch vụ phụ phí,
// đã qua vndFromBigInt); thiếu cả hai → { ok: false, reason: 'NO_PRICE' } (máy chủ bỏ qua luật, skipped NO_PRICE).
// Tiền là số nguyên đồng, KHÔNG làm tròn, KHÔNG kẹp trần: thành tiền = computeLineTotal(giá, số lượng, 0) — đúng hàm của
// mọi dòng hợp đồng (vượt số nguyên an toàn → ContractMathError). Vượt MAX_MONEY_VND trả nguyên số để máy chủ báo bằng
// assertLineCap (lời có tên dòng).
export function computeAutoSurcharge(input: {
  perQuantity: boolean;
  lineQuantity: number;
  listPrice: Vnd | null;
  override?: SurchargeOverrideAmount;
}): AutoSurchargeAmount {
  const quantity = surchargeQuantity(input.perQuantity, input.lineQuantity, input.override?.quantity);
  const priceOverridden = input.override?.unitPrice !== undefined;
  const unitPrice = priceOverridden ? (input.override?.unitPrice as Vnd) : input.listPrice;
  if (unitPrice === null) return { ok: false, reason: 'NO_PRICE' };
  return {
    ok: true,
    quantity,
    unitPrice,
    lineTotal: computeLineTotal(unitPrice, quantity, 0),
    overridden: priceOverridden || input.override?.quantity !== undefined,
    priceOverridden,
  };
}
