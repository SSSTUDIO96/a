import { useCallback, useRef } from 'react';
import { newIdempotencyKey } from '../../api/idempotency';

/**
 * Khoá chống gửi trùng GIỮ qua các lần bấm lại cho tới khi thành công.
 * Máy chủ nhận lại cùng khoá + cùng nội dung → trả lại đúng kết quả cũ (không tạo trùng); cùng khoá khác nội dung → 409.
 * Nên: gửi lại đúng nội dung đã gửi (bấm lại sau lỗi mạng) → dùng lại khoá cũ; nội dung khác → khoá mới.
 * `keyFor(payload)` nhận đúng thân sẽ gửi; `reset()` gọi khi đã xong hẳn.
 */
export function useRetainedIdempotencyKey() {
  const held = useRef<{ key: string; payload: string } | null>(null);

  const keyFor = useCallback((payload: unknown): string => {
    const fingerprint = JSON.stringify(payload);
    if (held.current?.payload !== fingerprint) held.current = { key: newIdempotencyKey(), payload: fingerprint };
    return held.current.key;
  }, []);

  const reset = useCallback(() => {
    held.current = null;
  }, []);

  return { keyFor, reset };
}
