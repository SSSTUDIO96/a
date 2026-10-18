// Hành vi chung của Dialog và BottomSheet: nhốt tiêu điểm (Tab / Shift+Tab vòng trong hộp), Esc đóng,
// khoá cuộn trang phía sau, trả tiêu điểm về nút đã mở khi đóng.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true',
  );
}

// Hộp đang mở, hộp mở sau cùng ở cuối: chỉ hộp trên cùng giữ tiêu điểm.
const stack: HTMLElement[] = [];
let savedOverflow = '';

export function useModalBehavior(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Tiêu điểm đầu: ô được chỉ định → ô nhập đầu tiên trong thân → chính hộp (đọc tiêu đề).
    const first =
      initialFocusRef?.current ??
      panel.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
    (first ?? panel).focus();

    if (stack.length === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    stack.push(panel);

    function onKeyDown(e: KeyboardEvent) {
      if (!panel) return;
      if (e.key === 'Escape') {
        // Chỉ hộp trên cùng đóng: hộp con mở sau sẽ chặn sự kiện trước.
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === firstEl || active === panel || !panel.contains(active)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (active === lastEl || !panel.contains(active)) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    // Tiêu điểm lọt ra ngoài (bấm chuột vào chỗ khác, trình đọc màn hình) → kéo về hộp.
    function onFocusIn(e: FocusEvent) {
      if (!panel || stack[stack.length - 1] !== panel) return;
      if (e.target instanceof Node && !panel.contains(e.target)) {
        const items = focusableIn(panel);
        (items[0] ?? panel).focus();
      }
    }

    panel.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      const i = stack.lastIndexOf(panel);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) document.body.style.overflow = savedOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open, panelRef, initialFocusRef]);
}
