// Giữ con trỏ đúng chỗ sau khi ô tự chèn/bỏ dấu chấm ngăn nghìn: đếm số chữ số đứng trước con trỏ.
import { useLayoutEffect, useRef, type RefObject } from 'react';

export function digitsBefore(text: string, caret: number): number {
  let n = 0;
  for (let i = 0; i < caret && i < text.length; i += 1) if (/\d/.test(text[i]!)) n += 1;
  return n;
}

export function caretAfterDigits(text: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i]!)) {
      n += 1;
      if (n === digitCount) return i + 1;
    }
  }
  return text.length;
}

/** Trả hàm hẹn đặt con trỏ; vị trí được áp sau lần vẽ kế tiếp. */
export function useCaret(inputRef: RefObject<HTMLInputElement | null>) {
  const pending = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (pending.current !== null && el && document.activeElement === el) {
      el.setSelectionRange(pending.current, pending.current);
    }
    pending.current = null;
  });
  return (pos: number) => {
    pending.current = pos;
  };
}
