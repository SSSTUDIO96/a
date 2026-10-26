import { describe, expect, it } from 'vitest';
import { SAMPLE } from '../paper/sampleData';
import { termsChangedSincePrint } from './termsChanged';

// Cảnh báo lúc xác nhận: điều khoản sắp chụp khác bản đã in cho khách (bản vẽ G mục 2.5 rủi ro 4).
const last = SAMPLE.SERVICE.long;
const items = last.terms!.items;

describe('termsChangedSincePrint', () => {
  it('chưa có lần in nào → không cảnh báo', () => {
    expect(termsChangedSincePrint(null, { terms: 'Bất kỳ' })).toBe(false);
  });
  it('cùng chữ (danh sách đã tách) → không đổi', () => {
    expect(termsChangedSincePrint(last, { terms: items })).toBe(false);
  });
  it('cùng chữ dạng nội dung thô có số đầu dòng và dòng trống → không đổi', () => {
    const raw = items.map((t, i) => `${i + 1}. ${t}`).join('\r\n\r\n');
    expect(termsChangedSincePrint(last, { terms: raw })).toBe(false);
  });
  it('sửa một chữ trong một điều → đổi', () => {
    const edited = [...items];
    edited[2] = `${edited[2]} (đã sửa)`;
    expect(termsChangedSincePrint(last, { terms: edited })).toBe(true);
  });
  it('thêm hoặc bớt một điều → đổi', () => {
    expect(termsChangedSincePrint(last, { terms: [...items, 'Điều mới'] })).toBe(true);
    expect(termsChangedSincePrint(last, { terms: items.slice(1) })).toBe(true);
  });
  it('đổi thứ tự điều → đổi', () => {
    expect(termsChangedSincePrint(last, { terms: [...items].reverse() })).toBe(true);
  });
  it('lần in có điều khoản nhưng bản sắp chụp trống (và ngược lại) → đổi', () => {
    expect(termsChangedSincePrint(last, { terms: null })).toBe(true);
    expect(termsChangedSincePrint({ ...last, terms: null }, { terms: items })).toBe(true);
    expect(termsChangedSincePrint({ ...last, terms: null }, { terms: null })).toBe(false);
  });
  it('nội quy: chỉ so khi màn truyền vào (undefined = hợp đồng không có nội quy)', () => {
    const course = SAMPLE.COURSE.long;
    expect(termsChangedSincePrint(course, { terms: course.terms!.items })).toBe(false);
    expect(termsChangedSincePrint(course, { terms: course.terms!.items, rules: course.rules!.items })).toBe(false);
    expect(termsChangedSincePrint(course, { terms: course.terms!.items, rules: ['Nội quy khác'] })).toBe(true);
  });
});
