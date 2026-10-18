import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { newIdempotencyKey } from '../../api/idempotency';
import type { FormErrors } from './logic';

// Lỗi tự phát hiện của ô tiền / ô số (gõ chữ, số lẻ…): ghi lại theo khoá ô để chặn lưu cho tới khi sửa xong.
export function useInputErrors() {
  const map = useRef(new Map<string, string>());
  const report = useCallback((key: string, message: string | null) => {
    if (message) map.current.set(key, message);
    else map.current.delete(key);
  }, []);
  return useMemo(() => ({ report, any: () => map.current.size > 0 }), [report]);
}

// Khoá chống gửi trùng: giữ nguyên cho cùng một nội dung (bấm Lưu lại sau lỗi mạng), đổi khi nội dung đổi.
export function useStableKey() {
  const ref = useRef<{ content: string; key: string } | null>(null);
  return useMemo(
    () => ({
      get(content: string): string {
        if (!ref.current || ref.current.content !== content) ref.current = { content, key: newIdempotencyKey() };
        return ref.current.key;
      },
    }),
    [],
  );
}

// Bản vẽ mục 5: lỗi 400 → cuộn tới ô lỗi đầu tiên.
export function useFirstErrorFocus(container: RefObject<HTMLElement | null>, errors: FormErrors) {
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const el = container.current?.querySelector<HTMLElement>('[aria-invalid="true"], .pr-gerr, .pr-banner');
    if (!el) return;
    el.scrollIntoView?.({ block: 'center' });
    if (el.matches('input, select, textarea')) el.focus({ preventScroll: true });
  }, [container, errors]);
}
