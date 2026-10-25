import { useMemo, type JSX } from 'react';
import type { ContractPrintData, ResolvedPrintConfig } from '@makeup/shared';
import { Layout1 } from './layouts/Layout1';
import { Layout2 } from './layouts/Layout2';
import { Layout3 } from './layouts/Layout3';
import { Layout4 } from './layouts/Layout4';
import { Layout5 } from './layouts/Layout5';
import { buildPaperModel, type PaperModel } from './model';
import { pageCss, type PrintMark } from './pageCss';
import './fonts.css';
import './paper.css';
import './layout-1.css';
import './layout-2.css';
import './layout-3.css';
import './layout-4.css';
import './layout-5.css';

export interface PrintPaperProps {
  data: ContractPrintData;
  config: ResolvedPrintConfig;
  /** URL ký của logo (không nằm trong bản chụp dữ liệu). null = không có logo. */
  logoUrl: string | null;
  /** Lần in + ngày in, gắn vào chân trang sau khi máy chủ ghi nhật ký. */
  printMark?: PrintMark;
}

const LAYOUTS: Record<number, (p: { m: PaperModel }) => JSX.Element> = {
  1: Layout1,
  2: Layout2,
  3: Layout3,
  4: Layout4,
  5: Layout5,
};

/**
 * Tờ in hợp đồng — 5 bố cục × 2 loại hợp đồng. Chỉ VẼ: nhận dữ liệu in + cấu hình đã gộp, không tính tiền, không đổi múi giờ.
 * Khổ thật 210 mm; xem trước thu phóng bằng PaperPreview, in bằng @page hdin-N của từng bố cục.
 */
export function PrintPaper({ data, config, logoUrl, printMark }: PrintPaperProps) {
  const m = useMemo(() => buildPaperModel(data, config, logoUrl), [data, config, logoUrl]);
  const Layout = LAYOUTS[m.layout];
  if (!Layout) throw new RangeError(`Chưa có bố cục ${m.layout}`);
  const css = pageCss({
    layout: m.layout,
    code: data.contract.code,
    draft: m.draft,
    pageNumbers: m.on('so-trang'),
    initials: m.on('ky-nhay'),
    printMark,
  });
  return (
    <>
      <style>{css}</style>
      <article className={`hdin-giay hdin-g${m.layout}`} aria-label="Bản in hợp đồng" data-kind={data.kind} data-status={data.contract.status}>
        <Layout m={m} />
      </article>
    </>
  );
}
