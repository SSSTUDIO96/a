// Xuất thẻ thành ảnh PNG ngay trong trình duyệt (C3 mục 2.6 "Xuất ảnh — web làm, không cần máy chủ vẽ"):
// 1) mở tệp vẽ public/mau/<mã>.html?<tham số> trong một iframe cùng nguồn, đặt ngoài màn hình, đúng kích thước khổ;
// 2) gọi window.MAU_XUAT_PNG() của trang mẫu — trang mẫu tự chụp #c bằng html-to-image 1.11.13 (MIT,
//    public/mau/chung/html-to-image.js), chỉ nhúng phông mà thẻ dùng;
// 3) kiểm ảnh ra đúng kích thước khổ đã chọn (1080×1350 hoặc 1080×1080), sai thì báo lỗi, không tải lên.
import { sizePixels } from './model';
import type { DesignSize } from '../../api/designs';

interface FrameWindow extends Window {
  MAU_XUAT_PNG?: () => Promise<{ blob: Blob; width: number; height: number }>;
}

const TIMEOUT_MS = 60_000;

async function pngSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== 'function') return null;
  const bmp = await createImageBitmap(blob);
  const out = { width: bmp.width, height: bmp.height };
  bmp.close();
  return out;
}

export async function renderTemplatePng(src: string, size: DesignSize): Promise<Blob> {
  const { width, height } = sizePixels(size);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.title = 'Vẽ ảnh thẻ';
  Object.assign(frame.style, { position: 'fixed', left: '-20000px', top: '0', width: `${width}px`, height: `${height}px`, border: '0' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error('Không mở được tệp vẽ mẫu.'));
    });
    frame.src = src;
    document.body.appendChild(frame);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Vẽ ảnh quá lâu. Vui lòng thử lại.')), TIMEOUT_MS);
    });
    await Promise.race([loaded, timeout]);
    const win = frame.contentWindow as FrameWindow | null;
    if (!win?.MAU_XUAT_PNG) throw new Error('Tệp vẽ mẫu chưa có bộ xuất ảnh.');
    const res = await Promise.race([win.MAU_XUAT_PNG(), timeout]);
    // Blob sinh trong iframe thuộc "thế giới JS" của iframe (instanceof Blob ở trang chính là false) → chép sang Blob
    // của trang chính trước khi băm SHA-256 / tải lên, và để iframe gỡ đi không kéo theo dữ liệu.
    const blob = new Blob([await res.blob.arrayBuffer()], { type: 'image/png' });
    const real = (await pngSize(blob)) ?? { width: res.width, height: res.height };
    if (real.width !== width || real.height !== height) {
      throw new Error(`Ảnh vẽ ra ${real.width}×${real.height}, khác khổ ${width}×${height}. Chưa tải lên.`);
    }
    return blob;
  } finally {
    if (timer) clearTimeout(timer);
    frame.remove();
  }
}

// Tải tệp về máy người dùng.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
