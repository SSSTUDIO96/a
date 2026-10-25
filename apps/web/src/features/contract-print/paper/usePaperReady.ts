import { useEffect, useState } from 'react';

export interface PaperReady {
  /** Phông đã tải xong và logo đã giải mã (hoặc hỏng → ẩn). Chỉ lúc này mới cho bấm In (L9). */
  ready: boolean;
  /** Logo dùng được. false = ẩn logo (tải hỏng). */
  logoOk: boolean;
  /** Họ phông tải lỗi (nếu có) — hộp In có thể cảnh báo. */
  fontsFailed: string[];
}

const FONT_WAIT_MS = 8000;

/**
 * Chờ `document.fonts.ready` và `img.decode()` của logo rồi mới báo sẵn sàng. Phông dùng `font-display: block` nên in
 * trước khi tải xong sẽ ra chữ trống. Quá FONT_WAIT_MS vẫn chưa xong → báo sẵn sàng kèm danh sách phông lỗi (không treo nút).
 */
export function usePaperReady(logoUrl: string | null): PaperReady {
  const [state, setState] = useState<{ key: string | null; value: PaperReady } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const done = (value: PaperReady) => {
      if (!cancelled) setState({ key: logoUrl, value });
    };
    const fontsDone: Promise<string[]> = (async () => {
      const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
      if (!fonts) return [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<'timeout'>((res) => {
        timer = setTimeout(() => res('timeout'), FONT_WAIT_MS);
      });
      const r = await Promise.race([fonts.ready.then(() => 'ok' as const), timeout]);
      clearTimeout(timer);
      const failed = [...fonts].filter((f) => f.status === 'error').map((f) => f.family);
      return r === 'timeout' ? [...failed, 'quá thời gian chờ phông'] : failed;
    })();
    const logoDone: Promise<boolean> = (async () => {
      if (!logoUrl) return true;
      try {
        const img = new Image();
        img.src = logoUrl;
        await img.decode();
        return true;
      } catch {
        return false;
      }
    })();
    void Promise.all([fontsDone, logoDone]).then(([fontsFailed, logoOk]) => done({ ready: true, logoOk, fontsFailed }));
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);
  // Đổi logo → chưa sẵn sàng cho tới khi chạy xong lần mới.
  if (state === null || state.key !== logoUrl) return { ready: false, logoOk: logoUrl === null, fontsFailed: [] };
  return state.value;
}
