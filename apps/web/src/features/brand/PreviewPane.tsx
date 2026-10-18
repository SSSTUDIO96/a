import { useLayoutEffect, useRef, useState } from 'react';
import { Segmented, Tooltip } from '../../ui';
import { SiteView, type SiteViewData } from '../public-site';

type Mode = 'phone' | 'desktop';
const PHONE_WIDTH = 375;
const DESKTOP_WIDTH = 1080;

// Khối "Xem trước" bên phải: CHÍNH component SiteView của trang công khai, dữ liệu từ bản nháp đang sửa (gõ tới đâu đổi tới đó).
// "Điện thoại": khung 375px. "Máy tính": dựng ở 1080px rồi thu nhỏ cho vừa cột.
// compact (điện thoại): không có thanh chọn khổ, khung chiếm hết bề ngang.
export function PreviewPane({ data, compact = false }: { data: SiteViewData; compact?: boolean }) {
  const [chosen, setMode] = useState<Mode>('phone');
  const mode: Mode = compact ? 'phone' : chosen;
  return (
    <aside className={compact ? 'br-pvw br-pvw--compact' : 'br-pvw'} aria-label="Xem trước trang giới thiệu">
      {!compact && <div className="br-pvw__bar">
        <b>Xem trước</b>
        <Tooltip text="Dựng từ bản nháp đang sửa và các gói đang bật hiện trên trang — có thể lệch nhẹ với trang thật (dịch vụ phụ, dịch vụ lẻ). Bấm Mở trang để xem bản thật." />
        <span className="br-sp" />
        <Segmented<Mode>
          size="sm"
          aria-label="Khổ xem trước"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'phone', label: 'Điện thoại' },
            { value: 'desktop', label: 'Máy tính' },
          ]}
          className="br-pvw__mode"
        />
      </div>}
      <div className="br-pvw__frame" data-mode={mode}>
        {mode === 'phone' ? (
          <div className="br-pvw__phone" style={compact ? undefined : { maxWidth: PHONE_WIDTH }}>
            <SiteView data={data} embedded />
          </div>
        ) : (
          <ScaledSite data={data} />
        )}
      </div>
    </aside>
  );
}

function ScaledSite({ data }: { data: SiteViewData }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;
    const measure = () => {
      const scale = Math.min(1, outer.clientWidth / DESKTOP_WIDTH) || 1;
      setBox({ scale, height: inner.offsetHeight * scale });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="br-pvw__scaled" style={{ height: box.height || undefined }}>
      <div ref={innerRef} style={{ width: DESKTOP_WIDTH, transform: `scale(${box.scale})`, transformOrigin: 'top left' }}>
        <SiteView data={data} embedded />
      </div>
    </div>
  );
}
