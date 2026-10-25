import { CERTIFICATE_PAGE_PT } from '@makeup/shared';

// Ghép ảnh JPEG của từng giấy thành MỘT tệp PDF nhiều trang A4 NGANG (bản vẽ F mục 7.3): mỗi trang là một ảnh phủ kín trang.
// pdf-lib 1.17.1 (MIT) tải ĐỘNG: thành tệp riêng, chỉ tải khi in (không vào tệp vào của app).

export interface PdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

export async function buildCertificatePdf(jpegs: Uint8Array[], title: string): Promise<PdfResult> {
  if (jpegs.length === 0) throw new Error('Không có trang nào để làm PDF');
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('Makeup Pro');
  pdf.setProducer('Makeup Pro');
  for (const jpg of jpegs) {
    const img = await pdf.embedJpg(jpg);
    const page = pdf.addPage([CERTIFICATE_PAGE_PT.width, CERTIFICATE_PAGE_PT.height]);
    page.drawImage(img, { x: 0, y: 0, width: CERTIFICATE_PAGE_PT.width, height: CERTIFICATE_PAGE_PT.height });
  }
  const bytes = await pdf.save();
  return { bytes, pageCount: jpegs.length };
}
