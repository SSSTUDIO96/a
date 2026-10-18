import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { cx } from './cx';
import { IconClose } from './icons';
import { useModalBehavior } from './useModalBehavior';
import './ui.css';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Mặc định true: bấm nền tối thì đóng (ngăn kéo chỉ để chọn, không giữ dữ liệu nhập). */
  closeOnOverlay?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Ngăn kéo đáy (điện thoại) — cao tối đa 78%, bo trên 16, vạch kéo 40×4.
 * Esc đóng, nhốt tiêu điểm như Dialog.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnOverlay = true,
  initialFocusRef,
  className,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalBehavior(open, panelRef, onClose, initialFocusRef);
  if (!open) return null;
  return createPortal(
    <div
      className="ui-sheet-overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx('ui-sheet', className)}
      >
        <div className="ui-sheet__grab" aria-hidden="true" />
        <div className="ui-sheet__head">
          <h2 id={titleId} className="ui-sheet__title">
            {title}
          </h2>
          <Button variant="ghost" size="sm" icon={<IconClose />} aria-label="Đóng" onClick={onClose} />
        </div>
        <div className="ui-sheet__body">{children}</div>
        {footer !== undefined && <div className="ui-sheet__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
