import { useCallback, useRef } from 'react';
import { newIdempotencyKey } from '../../api/idempotency';

/**
 * Khoá chống gửi trùng (Idempotency-Key) giữ qua các lần bấm lại cho tới khi lưu thành công.
 * Gửi lại ĐÚNG thân cũ (bấm lại sau mất mạng) → dùng lại khoá cũ: máy chủ trả lại phiếu đã ghi, không sinh phiếu đôi.
 * Thân khác (đổi số tiền, thêm allowOverpay + ghi chú) → khoá mới. `reset()` sau khi lưu thành công.
 */
export function useRetainedKey() {
  const held = useRef<{ key: string; payload: string } | null>(null);
  const keyFor = useCallback((payload: unknown): string => {
    const fp = JSON.stringify(payload);
    if (held.current?.payload !== fp) held.current = { key: newIdempotencyKey(), payload: fp };
    return held.current.key;
  }, []);
  const reset = useCallback(() => {
    held.current = null;
  }, []);
  return { keyFor, reset };
}
