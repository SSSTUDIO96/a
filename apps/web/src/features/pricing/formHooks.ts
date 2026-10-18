import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { newIdempotencyKey } from '../../api/idempotency';

// Lỗi tự phát hiện của ô tiền / ô số (gõ chữ, số lẻ…): ghi lại theo khoá ô để chặn lưu cho tới khi sửa xong.
// `count` là số ô đang lỗi (có vẽ lại) — để form hiện nút "Huỷ" cả khi chỉ có ô đang gõ sai mà giá trị chưa đổi.
export function useInputErrors() {
  const map = useRef(new Map<string, string>());
  const [count, setCount] = useState(0);
  const report = useCallback((key: string, message: string | null) => {
    if (message) map.current.set(key, message);
    else map.current.delete(key);
    setCount(map.current.size);
  }, []);
  return useMemo(() => ({ report, any: () => map.current.size > 0, count }), [report, count]);
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

// Bản vẽ mục 5: lỗi 400 → cuộn tới ô lỗi đầu tiên. Chỉ chạy sau mỗi lần bấm Lưu bị lỗi (gọi `focusFirstError`),
// không chạy khi người dùng đang gõ sửa lỗi.
export function useFirstErrorFocus(container: RefObject<HTMLElement | null>) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt === 0) return;
    const el = container.current?.querySelector<HTMLElement>('[aria-invalid="true"], .pr-gerr, .pr-banner');
    if (!el) return;
    el.scrollIntoView?.({ block: 'center' });
    if (el.matches('input, select, textarea')) el.focus({ preventScroll: true });
  }, [container, attempt]);
  return useCallback(() => setAttempt((n) => n + 1), []);
}
