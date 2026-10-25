import { useEffect, useRef, useState } from 'react';
import { CERTIFICATE_FRAME } from '@makeup/shared';
import { useBlobUrl } from '../designs/useBlobUrl';
import { certificateFrameSrc, type CertificateFrameInput } from './frame';
import './certificates.css';

// Xem trước một giấy (bản vẽ F mục 6.3): iframe /mau/{cc}.html?{query}&xuat=1 giữ đúng 1123×794 px bên trong,
// thu nhỏ bằng transform: scale(bề ngang khung / 1123) như designs/PreviewFrame.tsx. Ảnh và logo đi qua blob cùng nguồn.
// Người chưa cấp: nơi gọi truyền số dự kiến + `note`; người đã cấp: dựng từ CertificateView (frameInputOfView) + `badge`.

export interface PreviewImage {
  // Khoá ổn định (mã tệp): URL ký mới của cùng một tệp không tải lại.
  key: string;
  url: string;
}

export interface CertificatePreviewProps {
  input: CertificateFrameInput | null;
  photo: PreviewImage | null;
  logo: PreviewImage | null;
  title: string;
  // Nhãn nhỏ trên khung: "Đã cấp · CC-… · in lại bản cũ".
  badge?: string;
  // Dòng chú dưới khung: "Số trên bản xem trước là số dự kiến".
  note?: string;
}

export function CertificatePreview({ input, photo, logo, title, badge, note }: CertificatePreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const photoBlob = useBlobUrl(photo?.key ?? null, photo?.url ?? null);
  const logoBlob = useBlobUrl(logo?.key ?? null, logo?.url ?? null);
  const waitingImage = (photo !== null && photoBlob.url === null && !photoBlob.error) || (logo !== null && logoBlob.url === null && !logoBlob.error);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    setBoxWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Tải ảnh không được (photoBlob.error) → vẫn vẽ, không ảnh: tệp mẫu tự in chữ cái đầu.
  const src =
    input && !waitingImage
      ? certificateFrameSrc(input, { photo: photoBlob.error ? null : photoBlob.url, logo: logoBlob.error ? null : logoBlob.url })
      : null;

  useEffect(() => {
    setLoading(true);
  }, [src]);

  const { width, height } = CERTIFICATE_FRAME;
  const scale = boxWidth > 0 ? boxWidth / width : 0;
  return (
    <div>
      <div ref={boxRef} className="gcn-preview" style={{ height: scale ? Math.round(height * scale) : undefined, aspectRatio: scale ? undefined : `${width} / ${height}` }}>
        {src && (
          <div className="gcn-preview__stage" style={{ transform: `scale(${scale})` }}>
            <iframe title={title} src={src} className="gcn-preview__frame" tabIndex={-1} onLoad={() => setLoading(false)} />
          </div>
        )}
        {(loading || !src) && (
          <div className="gcn-preview__badge" role="status">
            {src ? 'Đang vẽ mẫu…' : 'Chọn học viên và mẫu để xem trước'}
          </div>
        )}
        {badge && !loading && src && <div className="gcn-preview__badge">{badge}</div>}
      </div>
      {note && <p className="gcn-preview__note">{note}</p>}
    </div>
  );
}
