import { describe, expect, it } from 'vitest';
import { formatVnd as sharedFormatVnd, MAX_DISTANCE_KM } from '@makeup/shared';
import { ERR_AMBIGUOUS_DOT, formatDecimal, formatKm, formatVnd, groupThousands, parseDecimal, parseKm, parseMoney } from './format';

describe('formatVnd', () => {
  it('dùng lại đúng hàm của @makeup/shared, không phải bản sao', () => {
    expect(formatVnd).toBe(sharedFormatVnd);
    expect(formatVnd(1_500_000)).toBe('1.500.000 ₫');
  });
});

describe('parseMoney', () => {
  it('đọc dấu chấm ngăn nghìn: "1.500.000" → 1500000', () => {
    expect(parseMoney('1.500.000')).toEqual({ ok: true, value: 1_500_000 });
  });
  it('đọc số liền và có đơn vị', () => {
    expect(parseMoney('1500000')).toEqual({ ok: true, value: 1_500_000 });
    expect(parseMoney('1.500.000 ₫')).toEqual({ ok: true, value: 1_500_000 });
    expect(parseMoney(' 250000đ ')).toEqual({ ok: true, value: 250_000 });
    expect(parseMoney('0')).toEqual({ ok: true, value: 0 });
  });
  it('chuỗi rỗng → null (chưa đặt)', () => {
    expect(parseMoney('')).toEqual({ ok: true, value: null });
    expect(parseMoney('   ')).toEqual({ ok: true, value: null });
  });
  it('"1,5" không phải tiền → lỗi', () => {
    const r = parseMoney('1,5');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/không có phần lẻ/);
  });
  it('dấu phẩy ngăn nghìn kiểu Anh → lỗi chỉ cách gõ đúng', () => {
    const r = parseMoney('1,500,000');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dấu chấm ngăn nghìn/);
  });
  it('dấu chấm sai nhóm ("1.5", "1.50.000") → lỗi, không đoán', () => {
    expect(parseMoney('1.5').ok).toBe(false);
    expect(parseMoney('1.50.000').ok).toBe(false);
  });
  it('số âm, chữ cái → lỗi', () => {
    const neg = parseMoney('-100.000');
    expect(neg.ok).toBe(false);
    if (!neg.ok) expect(neg.error).toMatch(/âm/);
    const letters = parseMoney('2 triệu');
    expect(letters.ok).toBe(false);
    if (!letters.ok) expect(letters.error).toMatch(/Chỉ nhập chữ số/);
  });
  it('giới hạn Number.MAX_SAFE_INTEGER', () => {
    expect(parseMoney(String(Number.MAX_SAFE_INTEGER))).toEqual({ ok: true, value: Number.MAX_SAFE_INTEGER });
    const r = parseMoney('9007199254740992');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/quá lớn/);
  });
});

describe('parseKm', () => {
  it('"12,35" → 12.35 (dấu phẩy thập phân)', () => {
    expect(parseKm('12,35')).toEqual({ ok: true, value: 12.35 });
  });
  it('số nguyên, một chữ số lẻ, có chữ km, dấu chấm ngăn nghìn', () => {
    expect(parseKm('12')).toEqual({ ok: true, value: 12 });
    expect(parseKm('3,5')).toEqual({ ok: true, value: 3.5 });
    expect(parseKm('12,35 km')).toEqual({ ok: true, value: 12.35 });
    expect(parseKm('1.234,5')).toEqual({ ok: true, value: 1234.5 });
    expect(parseKm(',5')).toEqual({ ok: true, value: 0.5 });
    expect(parseKm('12,')).toEqual({ ok: true, value: 12 });
  });
  it('không lệch số thực: 0,07 và 99.999,99 giữ đúng', () => {
    expect(parseKm('0,07')).toEqual({ ok: true, value: 0.07 });
    expect(parseKm('99.999,99')).toEqual({ ok: true, value: MAX_DISTANCE_KM });
  });
  it('tối đa 2 chữ số lẻ', () => {
    const r = parseKm('12,345');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Tối đa 2 chữ số/);
  });
  it('dấu chấm làm phần lẻ ("12.35") → lỗi chỉ dùng dấu phẩy', () => {
    const r = parseKm('12.35');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dấu phẩy/);
  });
  it('vượt 99.999,99 km → lỗi', () => {
    const r = parseKm('100000');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Tối đa 99.999,99 km.');
  });
  it('âm, chữ, hai dấu phẩy → lỗi; rỗng → null', () => {
    expect(parseKm('-3').ok).toBe(false);
    expect(parseKm('mười').ok).toBe(false);
    expect(parseKm('1,2,3').ok).toBe(false);
    expect(parseKm('')).toEqual({ ok: true, value: null });
  });
});

describe('parseDecimal (phút, lần)', () => {
  it('số nguyên: "1,5" → lỗi', () => {
    const r = parseDecimal('1,5', { maxFractionDigits: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/số nguyên/);
    expect(parseDecimal('150', { maxFractionDigits: 0 })).toEqual({ ok: true, value: 150 });
  });
  it('giới hạn min/max', () => {
    expect(parseDecimal('0', { maxFractionDigits: 0, min: 1 }).ok).toBe(false);
    expect(parseDecimal('21', { maxFractionDigits: 0, max: 20 }).ok).toBe(false);
  });
});

describe('formatKm, formatDecimal, groupThousands', () => {
  it('kiểu Việt', () => {
    expect(formatKm(12.35)).toBe('12,35 km');
    expect(formatKm(21.7)).toBe('21,7 km');
    expect(formatDecimal(99_999.99)).toBe('99.999,99');
    expect(groupThousands('1500000')).toBe('1.500.000');
    expect(groupThousands('0012')).toBe('12');
  });
});

describe('đầu vào mơ hồ → báo lỗi, không đoán (nghiệm thu web 1, N7)', () => {
  it('km: "2.500", "1.000", "12.500 km" không có dấu phẩy → lỗi "Dấu chấm dễ nhầm"', () => {
    for (const s of ['2.500', '1.000', '12.500 km', '100.000']) expect(parseKm(s), s).toEqual({ ok: false, error: ERR_AMBIGUOUS_DOT });
  });
  it('km: có dấu phẩy thì dấu chấm chắc chắn là ngăn nghìn: "1.234,5" → 1234.5; gõ liền "2500" → 2500', () => {
    expect(parseKm('1.234,5')).toEqual({ ok: true, value: 1234.5 });
    expect(parseKm('2500')).toEqual({ ok: true, value: 2500 });
  });
  it('tiền: nhóm đầu bắt đầu bằng 0 ("0.500") là mơ hồ → lỗi', () => {
    expect(parseMoney('0.500').ok).toBe(false);
    expect(parseMoney('500')).toEqual({ ok: true, value: 500 });
  });
  it('formatDecimal không ngăn nghìn (chữ trong ô đang sửa)', () => {
    expect(formatDecimal(2500, 2, false)).toBe('2500');
    expect(formatDecimal(1234.5, 2, false)).toBe('1234,5');
  });
});
