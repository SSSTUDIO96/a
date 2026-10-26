import { describe, expect, it } from 'vitest';
import { PRINT_LAYOUTS } from '@makeup/shared';
import { A4_HEIGHT_MM, PAGE_CONTENT_MM, estimatePages, pageCss, printMarkText } from './pageCss';

const PX_PER_MM = 96 / 25.4;

describe('pageCss: chân trang theo bố cục', () => {
  const base = { layout: 1 as const, code: 'HĐDV-000128', draft: false, pageNumbers: true, initials: true };

  it('đủ ba hộp lề: số hợp đồng (trái), "Trang x / y" (giữa), ô ký nháy (phải)', () => {
    const css = pageCss(base);
    expect(css).toBe(
      '@page hdin-1 { @bottom-left { content: "HĐDV-000128"; } @bottom-center { content: "Trang " counter(page) " / " counter(pages); } @bottom-right { content: "Ký nháy   A: ______   B: ______"; } }',
    );
  });

  it('tắt số trang và ký nháy: không còn hộp nào; bản nháp luôn ghi BẢN NHÁP dù tắt số trang', () => {
    expect(pageCss({ ...base, pageNumbers: false, initials: false })).toBe('@page hdin-1 {  }');
    expect(pageCss({ ...base, pageNumbers: false, initials: false, draft: true })).toBe('@page hdin-1 { @bottom-left { content: "BẢN NHÁP"; } }');
    expect(pageCss({ ...base, draft: true })).toContain('content: "HĐDV-000128 · BẢN NHÁP"');
  });

  it('dấu lần in: "In lần k · dd/mm/yyyy" và "In lại bản lần k"', () => {
    expect(printMarkText({ printNo: 3, printedOn: '2026-10-25', source: 'TEMPLATE' })).toBe('In lần 3 · 25/10/2026');
    expect(printMarkText({ printNo: 3, printedOn: '2026-10-25', source: 'PRIOR_CONFIG' })).toBe('In lần 3 · 25/10/2026');
    expect(printMarkText({ printNo: 2, printedOn: '2026-10-25', source: 'REPRINT' })).toBe('In lại bản lần 2 · 25/10/2026');
    expect(pageCss({ ...base, printMark: { printNo: 3, printedOn: '2026-10-25', source: 'TEMPLATE' } })).toContain('"HĐDV-000128 · In lần 3 · 25/10/2026"');
  });

  it('mã hợp đồng lạ không thoát khỏi chuỗi CSS', () => {
    const css = pageCss({ ...base, code: 'A"; } body { display:none } /*', draft: false });
    expect(css).toContain('content: "A\\"; } body { display:none } /*"');
    expect(css.match(/@page/g)).toHaveLength(1);
  });

  it('ngày dấu in sai dạng → ném lỗi (không in "undefined")', () => {
    expect(() => printMarkText({ printNo: 1, printedOn: '25/10/2026', source: 'TEMPLATE' })).toThrow();
  });
});

describe('estimatePages: ước số trang từ chiều cao vùng chữ', () => {
  it('đúng biên: vừa một trang → 1; hơn một chút → 2; ba trang', () => {
    for (const n of PRINT_LAYOUTS) {
      const page = PAGE_CONTENT_MM[n] * PX_PER_MM;
      expect(estimatePages(page * 0.5, n)).toBe(1);
      expect(estimatePages(page, n)).toBe(1);
      expect(estimatePages(page + 5, n)).toBe(2);
      expect(estimatePages(page * 2 + 5, n)).toBe(3);
    }
  });
  it('rỗng → 1 trang; chiều cao âm hoặc không phải số → ném lỗi', () => {
    expect(estimatePages(0, 2)).toBe(1);
    expect(() => estimatePages(-1, 2)).toThrow(RangeError);
    expect(() => estimatePages(Number.NaN, 2)).toThrow(RangeError);
  });
  it('vùng chữ một trang A4 nhỏ hơn 297 mm và lớn hơn 250 mm ở mọi bố cục', () => {
    for (const n of PRINT_LAYOUTS) {
      expect(PAGE_CONTENT_MM[n]).toBeLessThan(A4_HEIGHT_MM);
      expect(PAGE_CONTENT_MM[n]).toBeGreaterThan(250);
    }
  });
});
