import { useEffect, useRef, useState } from 'react';
import type { DesignSize } from '../../api/designs';
import { sizePixels } from './model';

// Khung xem trước: nạp tệp vẽ public/mau/<mã>.html?<tham số> trong iframe cùng nguồn, thu nhỏ vừa bề ngang cột.
// Iframe giữ đúng 1080 px bên trong (mẫu vẽ theo px thật); chỉ phóng to/thu nhỏ bằng transform bên ngoài.
export function PreviewFrame({ src, size, title }: { src: string | null; size: DesignSize; title: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const { width, height } = sizePixels(size);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    setBoxWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
  }, [src]);

  const scale = boxWidth > 0 ? boxWidth / width : 0;
  return (
    <div ref={boxRef} className="mtk-frame" style={{ height: scale ? Math.round(height * scale) : undefined, aspectRatio: scale ? undefined : `${width} / ${height}` }}>
      {src && (
        <iframe
          key={size}
          title={title}
          src={src}
          className="mtk-frame__ifr"
          style={{ width, height, transform: `scale(${scale})` }}
          tabIndex={-1}
          onLoad={() => setLoading(false)}
        />
      )}
      {(loading || !src) && (
        <div className="mtk-frame__wait" role="status">
          {src ? 'Đang vẽ mẫu…' : 'Chọn hợp đồng và mẫu để xem trước'}
        </div>
      )}
    </div>
  );
}
