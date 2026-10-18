// Định dạng và đọc số theo kiểu Việt Nam: dấu chấm ngăn nghìn, dấu phẩy thập phân.
// Tiền là số nguyên đồng (Vnd, packages/shared/src/money.ts). formatVnd dùng lại đúng bản của @makeup/shared.
import { MAX_DISTANCE_KM, type Vnd } from '@makeup/shared';

export { formatVnd } from '@makeup/shared';
export type { Vnd } from '@makeup/shared';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): ParseResult<T> => ({ ok: true, value });
const fail = <T>(error: string): ParseResult<T> => ({ ok: false, error });

// Khoảng trắng thường, khoảng trắng không ngắt (Intl hay chèn) và khoảng trắng hẹp.
const SPACES = /[\s  ]/g;

export const ERR_SPACE_IN_NUMBER = 'Có dấu cách xen giữa chữ số: gõ liền, ví dụ 2500.';

// Một khoảng trắng (thường, không ngắt, hẹp) — dùng trong regex dựng sẵn bên dưới.
const SP = '[\\s\u00a0\u202f]';
const DIGIT_RUN_WITH_SPACES = new RegExp(`\\d+(?:${SP}+\\d+)+`, 'gu');
const SPACE_GROUPED = new RegExp(`^[1-9]\\d{0,2}(?:${SP}\\d{3})+$`, 'u');

/**
 * Bỏ khoảng trắng trước khi đọc số. Khoảng trắng ở hai đầu hay cạnh đơn vị ("12,5 km", "1.500.000 ₫") thì bỏ thoải mái;
 * khoảng trắng XEN GIỮA chữ số chỉ nhận khi là ngăn nghìn đúng nhóm 3 ("2 500", "1 500 000") — "1 5" là gõ nhầm,
 * không lặng lẽ ghép thành 15. Trả null khi có khoảng trắng sai chỗ.
 */
function stripSpaces(input: string): string | null {
  for (const run of input.match(DIGIT_RUN_WITH_SPACES) ?? []) {
    if (!SPACE_GROUPED.test(run)) return null;
  }
  return input.replace(SPACES, '');
}

/** Chữ số có dấu chấm ngăn nghìn đúng nhóm 3 ("1.500.000") hoặc liền ("1500000"). */
function readGroupedInteger(text: string): string | null {
  if (/^\d+$/.test(text)) return text;
  // Nhóm đầu không bắt đầu bằng 0: "0.500" dễ là số thập phân viết kiểu Anh → không đoán.
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(text)) return text.replace(/\./g, '');
  return null;
}

/**
 * Đọc số tiền người dùng gõ hoặc dán. Chuỗi rỗng → null (chưa đặt).
 * Nhận: "1.500.000", "1500000", "1.500.000 ₫", "1500000đ".
 * Báo lỗi: chữ cái, số âm, phần lẻ ("1,5"), sai nhóm dấu chấm ("1.5"), vượt Number.MAX_SAFE_INTEGER.
 */
export function parseMoney(input: string): ParseResult<Vnd | null> {
  const stripped = stripSpaces(input);
  if (stripped === null) return fail(ERR_SPACE_IN_NUMBER);
  let text = stripped;
  if (text === '') return ok(null);
  text = text.replace(/(₫|đ|Đ|vnđ|VNĐ|vnd|VND)$/u, '');
  if (text === '') return fail('Nhập số tiền bằng chữ số.');
  if (/^[-−]/.test(text)) return fail('Số tiền không được âm.');
  if (/[^\d.,]/.test(text)) return fail('Chỉ nhập chữ số.');
  if (/^\d{1,3}(,\d{3})+$/.test(text)) return fail('Dùng dấu chấm ngăn nghìn, ví dụ 1.500.000.');
  if (text.includes(',')) return fail('Tiền là số nguyên đồng, không có phần lẻ.');
  const digits = readGroupedInteger(text);
  if (digits === null) return fail('Dấu chấm chỉ dùng ngăn nghìn, ví dụ 1.500.000.');
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return fail('Số tiền quá lớn.');
  return ok(value);
}

export const ERR_AMBIGUOUS_DOT = 'Dấu chấm dễ nhầm: gõ 2,5 hoặc 2500.';

export interface DecimalRules {
  /** Số chữ số lẻ tối đa sau dấu phẩy (0 = chỉ số nguyên). */
  maxFractionDigits: number;
  /** Giá trị lớn nhất (tính cả), mặc định không giới hạn ngoài số an toàn. */
  max?: number;
  /** Giá trị nhỏ nhất (tính cả), mặc định 0. */
  min?: number;
  /** Đơn vị được phép gõ kèm ở cuối, ví dụ "km". */
  unit?: string;
}

/**
 * Đọc số thập phân kiểu Việt: dấu phẩy là phần lẻ, dấu chấm ngăn nghìn.
 * "12,35" → 12.35 · "1.234,5" → 1234.5 · "12.35" → lỗi (dấu chấm sai chỗ).
 * Kết quả tính qua số nguyên (phần trăm) nên không lệch kiểu 12.349999.
 */
export function parseDecimal(input: string, rules: DecimalRules): ParseResult<number | null> {
  const stripped = stripSpaces(input);
  if (stripped === null) return fail(ERR_SPACE_IN_NUMBER);
  let text = stripped;
  if (text === '') return ok(null);
  if (rules.unit && text.toLowerCase().endsWith(rules.unit.toLowerCase())) {
    text = text.slice(0, -rules.unit.length);
  }
  if (/^[-−]/.test(text)) return fail('Không được nhập số âm.');
  if (/[^\d.,]/.test(text)) return fail('Chỉ nhập chữ số.');
  const parts = text.split(',');
  if (parts.length > 2) return fail('Chỉ một dấu phẩy cho phần lẻ.');
  const [intRaw = '', fracRaw = ''] = parts;
  if (parts.length === 2 && rules.maxFractionDigits === 0) return fail('Chỉ nhập số nguyên.');
  if (fracRaw.includes('.')) return fail('Dấu chấm chỉ dùng ngăn nghìn.');
  if (fracRaw.length > rules.maxFractionDigits) {
    return fail(`Tối đa ${rules.maxFractionDigits} chữ số sau dấu phẩy.`);
  }
  // Ô có phần lẻ (km): "2.500" không có dấu phẩy là mơ hồ — 2,5 km viết kiểu Anh hay 2500 km? Không đoán, báo lỗi.
  // Có dấu phẩy ("1.234,5") thì dấu chấm chắc chắn là ngăn nghìn.
  if (rules.maxFractionDigits > 0 && parts.length === 1 && intRaw.includes('.') && readGroupedInteger(intRaw) !== null) {
    return fail(ERR_AMBIGUOUS_DOT);
  }
  const intDigits = intRaw === '' ? (fracRaw === '' ? null : '0') : readGroupedInteger(intRaw);
  if (intDigits === null) {
    return fail(
      rules.maxFractionDigits > 0
        ? 'Phần lẻ dùng dấu phẩy, ví dụ 12,35.'
        : 'Dấu chấm chỉ dùng ngăn nghìn.',
    );
  }
  const scale = 10 ** rules.maxFractionDigits;
  const scaled = Number(intDigits) * scale + Number(fracRaw.padEnd(rules.maxFractionDigits, '0') || '0');
  if (!Number.isSafeInteger(scaled)) return fail('Số quá lớn.');
  const value = scaled / scale;
  const min = rules.min ?? 0;
  if (value < min) return fail(`Nhỏ nhất ${formatDecimal(min, rules.maxFractionDigits)}.`);
  if (rules.max !== undefined && value > rules.max) {
    return fail(`Tối đa ${formatDecimal(rules.max, rules.maxFractionDigits)}${rules.unit ? ` ${rules.unit}` : ''}.`);
  }
  return ok(value);
}

/** Đọc số km: dấu phẩy thập phân, tối đa 2 chữ số lẻ, tối đa 99.999,99 (MAX_DISTANCE_KM). */
export function parseKm(input: string): ParseResult<number | null> {
  return parseDecimal(input, { maxFractionDigits: 2, max: MAX_DISTANCE_KM, unit: 'km' });
}

/**
 * 1234.5 → "1.234,5" (dấu chấm ngăn nghìn, dấu phẩy thập phân).
 * grouping=false → "1234,5": dùng cho chữ trong ô đang sửa, để không tự sinh dạng mơ hồ "2.500".
 */
export function formatDecimal(value: number, maxFractionDigits = 2, grouping = true): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: maxFractionDigits, useGrouping: grouping });
}

/**
 * 12.35 → "12,35 km" · 2500 → "2500 km" · 12345.6 → "12345,6 km".
 * KHÔNG ngăn nghìn bằng dấu chấm: "2.500 km" là đúng dạng mơ hồ mà ô km (parseKm) từ chối, nên chữ app in ra
 * phải đọc lại được — parseKm(formatKm(x)) === x (format.test.ts, "vòng in → đọc"). km tối đa 5 chữ số nên vẫn dễ đọc.
 */
export function formatKm(km: number): string {
  return `${formatDecimal(km, 2, false)} km`;
}

/** Chèn dấu chấm ngăn nghìn vào dãy chữ số: "1500000" → "1.500.000". */
export function groupThousands(digits: string): string {
  const clean = digits.replace(/^0+(?=\d)/, '');
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
