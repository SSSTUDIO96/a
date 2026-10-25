import { type LocalDate, type PrintLayout, formatLocalDate } from '@makeup/shared';

// Chân trang chạy theo từng bố cục bằng hộp lề của @page (Chrome / Edge; Safari không in — hộp In đã cảnh báo).
// Mọi chuỗi đưa vào CSS đi qua cssString() (L10): không để tên khách / mã hợp đồng thoát khỏi chuỗi CSS hay đóng thẻ <style>.

/** Bỏ xuống dòng, thoát `\` và `"`, bỏ `<` (chặn "</style>"). */
export function cssString(s: string): string {
  return s
    .replace(/[\r\n\u2028\u2029\f]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '');
}

export type PrintSourceKind = 'TEMPLATE' | 'PRIOR_CONFIG' | 'REPRINT';

/** Dấu lần in (hộp In gắn sau khi máy chủ ghi nhật ký). */
export interface PrintMark {
  printNo: number;
  printedOn: LocalDate;
  source: PrintSourceKind;
}

export function printMarkText(mark: PrintMark): string {
  const when = formatLocalDate(mark.printedOn);
  return mark.source === 'REPRINT' ? `In lại bản lần ${mark.printNo} · ${when}` : `In lần ${mark.printNo} · ${when}`;
}

/**
 * Lề @page (mm) và lề trong của tờ khi in, theo bố cục — NGUỒN SỰ THẬT là layout-N.css; print-css.test.ts đọc CSS và
 * kiểm bảng này khớp. `pad` = padding hai đầu của tờ khi in (mẫu 5 cần chỗ trống bên trong khung viền).
 */
export const PAGE_MM: Record<PrintLayout, { top: number; bottom: number; pad: number }> = {
  1: { top: 14, bottom: 16, pad: 0 },
  2: { top: 15, bottom: 17, pad: 0 },
  3: { top: 12, bottom: 15, pad: 0 },
  4: { top: 10, bottom: 12, pad: 0 },
  5: { top: 10, bottom: 13, pad: 5.5 },
};
export const A4_HEIGHT_MM = 297;

/** Chiều cao vùng chữ của MỘT trang A4 (mm) theo bố cục. */
export const PAGE_CONTENT_MM: Record<PrintLayout, number> = {
  1: A4_HEIGHT_MM - PAGE_MM[1].top - PAGE_MM[1].bottom - 2 * PAGE_MM[1].pad,
  2: A4_HEIGHT_MM - PAGE_MM[2].top - PAGE_MM[2].bottom - 2 * PAGE_MM[2].pad,
  3: A4_HEIGHT_MM - PAGE_MM[3].top - PAGE_MM[3].bottom - 2 * PAGE_MM[3].pad,
  4: A4_HEIGHT_MM - PAGE_MM[4].top - PAGE_MM[4].bottom - 2 * PAGE_MM[4].pad,
  5: A4_HEIGHT_MM - PAGE_MM[5].top - PAGE_MM[5].bottom - 2 * PAGE_MM[5].pad,
};

const PX_PER_MM = 96 / 25.4;

/** Số trang A4 ước tính từ chiều cao PHẦN CHỮ của tờ (px, đã trừ padding xem trước). Xem trước không chia trang. */
export function estimatePages(contentHeightPx: number, layout: PrintLayout): number {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx < 0) throw new RangeError(`Chiều cao tờ không hợp lệ: ${contentHeightPx}`);
  return Math.max(1, Math.ceil(contentHeightPx / (PAGE_CONTENT_MM[layout] * PX_PER_MM) - 1e-6));
}

export interface PageCssInput {
  layout: PrintLayout;
  code: string;
  draft: boolean;
  /** Khối `so-trang`: số hợp đồng + "Trang x / y". */
  pageNumbers: boolean;
  /** Khối `ky-nhay`: ô ký nháy A / B ở góc phải chân trang. */
  initials: boolean;
  printMark?: PrintMark;
}

/** `@page hdin-N { … }` chỉ mang NỘI DUNG chân trang; phông / màu / lề nằm ở layout-N.css. */
export function pageCss(i: PageCssInput): string {
  const left: string[] = [];
  if (i.pageNumbers) left.push(i.code);
  if (i.draft) left.push('BẢN NHÁP');
  if (i.printMark) left.push(printMarkText(i.printMark));
  const boxes: string[] = [];
  if (left.length) boxes.push(`@bottom-left { content: "${cssString(left.join(' · '))}"; }`);
  if (i.pageNumbers) boxes.push('@bottom-center { content: "Trang " counter(page) " / " counter(pages); }');
  if (i.initials) boxes.push(`@bottom-right { content: "${cssString('Ký nháy   A: ______   B: ______')}"; }`);
  return `@page hdin-${i.layout} { ${boxes.join(' ')} }`;
}
