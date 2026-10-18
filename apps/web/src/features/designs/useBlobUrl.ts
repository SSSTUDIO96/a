import { useEffect, useState } from 'react';

// Ảnh từ máy chủ (URL ký, hạn 10 phút) đổi thành blob: URL cùng nguồn trước khi đưa vào tệp vẽ mẫu:
// - khung xem trước và bộ xuất ảnh không phụ thuộc hạn URL ký;
// - html-to-image nhúng được ảnh (blob cùng nguồn, không vướng CORS của kho tệp).
// `key` ổn định (mã tệp) để URL ký mới của cùng một tệp không tải lại. Tải không được → trả URL gốc + lỗi.
export function useBlobUrl(key: string | null, url: string | null): { url: string | null; error: boolean } {
  const [state, setState] = useState<{ key: string | null; url: string | null; error: boolean }>({ key: null, url: null, error: false });
  useEffect(() => {
    if (!key || !url) {
      setState({ key, url: null, error: false });
      return undefined;
    }
    let made: string | null = null;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((b) => {
        made = URL.createObjectURL(b);
        setState({ key, url: made, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, url, error: true });
      });
    return () => {
      controller.abort();
      if (made) URL.revokeObjectURL(made);
    };
    // URL ký đổi mà mã tệp giữ nguyên → không tải lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? { url: state.url, error: state.error } : { url: null, error: false };
}

// Giá trị trễ (gõ chữ không nạp lại khung xem trước mỗi phím).
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
