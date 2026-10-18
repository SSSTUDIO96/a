// Tooltip — nơi đặt giải thích (luật bản vẽ: một dòng = nhãn + điều khiển; giải thích nằm trong "?").
// Mở khi rê chuột, khi có tiêu điểm bàn phím, hoặc khi chạm (điện thoại). Esc đóng.
// Khung 240px, đệm 8 10, chữ 12/1.45, hiện phía dưới, lệch trái −10px; tự kẹp trong màn hình để không tràn ngang.
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import './ui.css';

const WIDTH = 240;
const GAP = 8;
const EDGE = 8;

interface Position {
  top: number;
  left: number;
  width: number;
}

function place(anchor: HTMLElement, bubble: HTMLElement | null): Position {
  const r = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(WIDTH, vw - 2 * EDGE);
  const left = Math.min(Math.max(r.left - 10, EDGE), vw - width - EDGE);
  let top = r.bottom + GAP;
  const h = bubble?.offsetHeight ?? 0;
  // Luôn hiện phía dưới; chỉ lật lên khi phía dưới không đủ chỗ mà phía trên đủ.
  const anchorVisible = r.bottom > 0 && r.bottom <= vh;
  if (anchorVisible && h > 0 && top + h > vh - EDGE && r.top - GAP - h >= EDGE) top = r.top - GAP - h;
  // Toạ độ trong trang (position: absolute trên body) để cuộn trang không làm lệch.
  return { top: top + window.scrollY, left: left + window.scrollX, width };
}

export interface TooltipControl {
  /** Gắn vào phần tử neo (nút "?", ô nút chuyển bị khoá…). */
  anchorProps: {
    ref: (el: HTMLElement | null) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onClick: () => void;
    'aria-describedby': string;
  };
  /** Đặt cạnh phần tử neo: mô tả ẩn cho trình đọc màn hình + khung nổi khi mở. */
  node: ReactNode;
  open: boolean;
}

/** Hook dựng tooltip cho phần tử bất kỳ có thể nhận tiêu điểm. */
export function useTooltip(text: ReactNode, forceOpen?: boolean): TooltipControl {
  const id = useId();
  const descId = `${id}-mo-ta`;
  const anchorRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const open = forceOpen ?? ((hover || focus || pinned) && !dismissed);

  const reposition = useCallback(() => {
    if (anchorRef.current) setPos(place(anchorRef.current, bubbleRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  // Lần hai sau khi khung đã có chiều cao (để biết có cần lật lên không).
  useLayoutEffect(() => {
    if (!open || !bubbleRef.current || !anchorRef.current) return;
    const next = place(anchorRef.current, bubbleRef.current);
    setPos((p) => (p && p.top === next.top && p.left === next.left && p.width === next.width ? p : next));
  });

  useEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Esc đóng tooltip trước, không đóng hộp thoại chứa nó.
        e.stopPropagation();
        setDismissed(true);
        setPinned(false);
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (el && e.target instanceof Node && !el.contains(e.target)) setPinned(false);
    }
    el?.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      el?.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  const style: CSSProperties | undefined = pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden', top: 0, left: 0 };

  return {
    open,
    anchorProps: {
      ref: (el) => {
        anchorRef.current = el;
      },
      onMouseEnter: () => {
        setDismissed(false);
        setHover(true);
      },
      onMouseLeave: () => setHover(false),
      onFocus: () => {
        setDismissed(false);
        setFocus(true);
      },
      onBlur: () => {
        setFocus(false);
        setPinned(false);
      },
      onClick: () => {
        setDismissed(false);
        setPinned(true);
      },
      'aria-describedby': descId,
    },
    node: (
      <>
        <span id={descId} hidden>
          {text}
        </span>
        {open &&
          typeof document !== 'undefined' &&
          createPortal(
            <div ref={bubbleRef} role="tooltip" className="ui-tip-bubble" style={style}>
              {text}
            </div>,
            document.body,
          )}
      </>
    ),
  };
}

export interface TooltipProps {
  /** Nội dung giải thích. */
  text: ReactNode;
  /** Tên của nút "?" cho trình đọc màn hình. Mặc định "Giải thích". */
  label?: string;
  /** Ép mở (trang xem thử). */
  open?: boolean;
  className?: string;
}

/** Nút "?" — vòng 16px viền --faint, chữ "?" 10.5/700. */
export function Tooltip({ text, label = 'Giải thích', open, className }: TooltipProps) {
  const t = useTooltip(text, open);
  const { ref, ...handlers } = t.anchorProps;
  return (
    <>
      <button
        type="button"
        ref={ref}
        className={cx('ui-tip', className)}
        aria-label={label}
        aria-expanded={t.open}
        {...handlers}
      >
        ?
      </button>
      {t.node}
    </>
  );
}

export interface WithTooltipProps {
  text: ReactNode;
  children: ReactNode;
  open?: boolean;
  className?: string;
}

/**
 * Bọc một phần tử để hiện tooltip khi rê chuột/tiêu điểm (ví dụ tên đầy đủ bị cắt "…").
 * Phần tử bên trong nên nhận được tiêu điểm để người dùng bàn phím cũng xem được.
 */
export function WithTooltip({ text, children, open, className }: WithTooltipProps) {
  const t = useTooltip(text, open);
  const { ref, onMouseEnter, onMouseLeave, onFocus, onBlur } = t.anchorProps;
  return (
    <span
      ref={ref}
      className={cx('ui-tip-anchor', className)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {children}
      {t.node}
    </span>
  );
}
