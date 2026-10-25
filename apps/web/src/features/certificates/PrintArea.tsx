import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './certificates.css';

// "In ngay" trên máy tính (bản vẽ F mục 7.4). Vùng in gắn THẲNG vào document.body bằng portal, không bao giờ nằm trong hộp
// thoại: bài học contracts.css — nội dung in nằm trong lớp phủ position: fixed thì Chrome lặp nó ở MỌI trang, chồng chữ, in thừa.
// Khi in, certificates.css ẩn mọi con khác của body và đưa vùng này về dòng chảy thường (mỗi giấy một trang A4 ngang, lề 0).

export interface PrintImage {
  key: string;
  url: string;
  alt: string;
}

// Chỉ dựng vùng in (không tự in) — trang in thử và bài thử dùng trực tiếp.
export function PrintPages({ images }: { images: PrintImage[] }) {
  return createPortal(
    <div className="gcn-print-root" data-testid="gcn-print-root">
      {images.map((im) => (
        <div className="gcn-print-page" key={im.key}>
          <img src={im.url} alt={im.alt} />
        </div>
      ))}
    </div>,
    document.body,
  );
}

export interface PrintAreaProps {
  images: PrintImage[];
  // Gọi khi hộp in đã đóng (sự kiện afterprint) — nơi gọi gỡ vùng in.
  onFinished: () => void;
}

// Dựng vùng in, chờ img.decode() cho mọi ảnh, gọi window.print(), gỡ ở afterprint.
export function PrintArea({ images, onFinished }: PrintAreaProps) {
  const done = useRef(onFinished);
  done.current = onFinished;
  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      window.removeEventListener('afterprint', finish);
      if (!cancelled) done.current();
    };
    window.addEventListener('afterprint', finish);
    const imgs = [...document.querySelectorAll<HTMLImageElement>('.gcn-print-root img')];
    void Promise.all(imgs.map((i) => i.decode().catch(() => undefined))).then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', finish);
    };
  }, []);
  return <PrintPages images={images} />;
}
