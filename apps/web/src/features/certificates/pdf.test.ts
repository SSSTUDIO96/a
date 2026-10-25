import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { CERTIFICATE_PAGE_PT } from '@makeup/shared';
import { JPEG_1X1 } from './fixtures';
import { buildCertificatePdf } from './pdf';

describe('pdf.ts: ghép JPEG thành PDF A4 ngang', () => {
  it('5 JPEG ra 5 trang, mỗi trang 841,89 × 595,28 pt (đọc lại bằng PDFDocument.load)', async () => {
    const res = await buildCertificatePdf(Array.from({ length: 5 }, () => JPEG_1X1), 'Giấy chứng nhận — K12');
    expect(res.pageCount).toBe(5);
    const doc = await PDFDocument.load(res.bytes);
    expect(doc.getPageCount()).toBe(5);
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      expect(width).toBeCloseTo(CERTIFICATE_PAGE_PT.width, 2);
      expect(height).toBeCloseTo(CERTIFICATE_PAGE_PT.height, 2);
      expect(width).toBeGreaterThan(height);
    }
    expect(doc.getTitle()).toBe('Giấy chứng nhận — K12');
    expect(doc.getCreator()).toBe('Makeup Pro');
  });

  it('không có trang nào thì ném lỗi, không ra PDF rỗng', async () => {
    await expect(buildCertificatePdf([], 'x')).rejects.toThrow('Không có trang nào');
  });
});
