import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { PrintLayout } from '@makeup/shared';
import { estimatePages } from './pageCss';

const PAPER_PX = 793.7; // 210 mm ở 96 dpi

/**
 * Vùng xem trước: tờ dựng ở khổ thật 210 mm, thu phóng bằng biến --hdin-zoom = bề rộng vùng chứa / 793,7 px (đo bằng
 * ResizeObserver; chỉ thu nhỏ, không phóng quá 1). Xem trước KHÔNG chia trang — chỉ ước số trang.
 */
export function PaperPreview({ layout, children, onPages }: { layout: PrintLayout; children: ReactNode; onPages?: (n: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const onPagesRef = useRef(onPages);
  onPagesRef.current = onPages;
  const [zoom, setZoom] = useState(1);
  const [pages, setPages] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setZoom(Math.min(1, Math.max(0.2, el.clientWidth / PAPER_PX)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('.hdin-giay');
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      // offsetHeight là chiều cao CHƯA thu phóng; trừ padding xem trước (= lề trang) để còn vùng chữ.
      const cs = getComputedStyle(el);
      const px = (v: string) => Number.parseFloat(v) || 0; // chuỗi rỗng (môi trường không có bố cục) = không có lề
      const inner = el.offsetHeight - px(cs.paddingTop) - px(cs.paddingBottom) - px(cs.borderTopWidth) - px(cs.borderBottomWidth);
      const n = estimatePages(Math.max(0, inner), layout);
      setPages(n);
      onPagesRef.current?.(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout, children]);

  return (
    <div className="hdin-prev" ref={box}>
      <div className="hdin-zoom" style={{ '--hdin-zoom': zoom } as CSSProperties}>
        {children}
      </div>
      {pages !== null && (
        <p className="hdin-prev-cap" data-pages={pages}>
          Khoảng {pages} trang A4 · số trang chính xác xem ở hộp in
        </p>
      )}
    </div>
  );
}
