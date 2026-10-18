import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { newIdempotencyKey } from '../../api/idempotency';

// Lỗi gõ tự phát hiện của ô ngày / giờ / tiền / số (gõ chữ, ngày không có thật…): chặn lưu cho tới khi sửa xong.
export function useInputErrors() {
  const map = useRef(new Map<string, string>());
  const [count, setCount] = useState(0);
  const report = useCallback((key: string, message: string | null) => {
    if (message) map.current.set(key, message);
    else map.current.delete(key);
    setCount(map.current.size);
  }, []);
  return useMemo(() => ({ report, count }), [report, count]);
}

// Khoá chống gửi trùng: giữ nguyên khi bấm Lưu lại cùng nội dung (sau lỗi mạng), đổi khi nội dung đổi.
export function useStableKey() {
  const ref = useRef<{ content: string; key: string } | null>(null);
  return useCallback((content: string) => {
    if (!ref.current || ref.current.content !== content) ref.current = { content, key: newIdempotencyKey() };
    return ref.current.key;
  }, []);
}

// Sau mỗi lần bấm Lưu bị lỗi: cuộn tới lỗi đầu tiên trong hộp (bản vẽ C mục 5).
export function useFirstErrorFocus(container: RefObject<HTMLElement | null>) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt === 0) return;
    const el = container.current?.querySelector<HTMLElement>('.ui-field__error, .kc-general');
    el?.scrollIntoView?.({ block: 'center' });
  }, [container, attempt]);
  return useCallback(() => setAttempt((n) => n + 1), []);
}
