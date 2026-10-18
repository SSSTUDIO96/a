import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { cx } from './cx';
import { IconClose } from './icons';
import { useModalBehavior } from './useModalBehavior';
import './ui.css';

export interface DialogProps {
  open: boolean;
  /** Gọi khi bấm ✕, "Huỷ", Esc (hoặc bấm nền nếu closeOnOverlay). */
  onClose: () => void;
  title: ReactNode;
  /** Dòng nhỏ trên tiêu đề, ví dụ "Cô dâu · G-CD01". */
  eyebrow?: ReactNode;
  children: ReactNode;
  /**
   * Chân hộp dính đáy. Mặc định: "Huỷ" + nút chính (nếu có primaryLabel).
   * Truyền ReactNode để tự dựng chân; null để bỏ chân.
   */
  footer?: ReactNode | null;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  cancelLabel?: string;
  /** lg: rộng min(980px, 100%) · sm: min(440px, 100%) cho hộp hỏi lý do. */
  size?: 'lg' | 'sm';
  /** Mặc định false: bấm ra ngoài không đóng để khỏi mất dữ liệu đang nhập. */
  closeOnOverlay?: boolean;
  /** Ô nhận tiêu điểm khi mở (mặc định: ô nhập đầu tiên, hoặc phần tử có data-autofocus). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Hộp thoại (máy tính, máy tính bảng) — rộng min(980px, 100%), cao tối đa 100vh − 48px, bo 14.
 * Đầu đệm 16 22 · thân cuộn riêng · chân dính đáy. Esc đóng, nhốt tiêu điểm, trả tiêu điểm khi đóng.
 * Điện thoại: thành trang toàn màn.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  primaryLabel,
  onPrimary,
  primaryLoading,
  primaryDisabled,
  cancelLabel = 'Huỷ',
  size = 'lg',
  closeOnOverlay = false,
  initialFocusRef,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalBehavior(open, panelRef, onClose, initialFocusRef);
  if (!open) return null;

  const defaultFooter =
    footer === undefined ? (
      <>
        <Button onClick={onClose}>{cancelLabel}</Button>
        {primaryLabel && (
          <Button variant="primary" onClick={onPrimary} loading={primaryLoading} disabled={primaryDisabled}>
            {primaryLabel}
          </Button>
        )}
      </>
    ) : (
      footer
    );

  return createPortal(
    <div
      className="ui-overlay"
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
        className={cx('ui-dialog', size === 'sm' && 'ui-dialog--sm', className)}
      >
        <div className="ui-dialog__head">
          <div className="ui-dialog__titles">
            {eyebrow !== undefined && <div className="ui-dialog__eyebrow">{eyebrow}</div>}
            <h2 id={titleId} className="ui-dialog__title">
              {title}
            </h2>
          </div>
          <Button variant="ghost" size="sm" icon={<IconClose />} aria-label="Đóng" onClick={onClose} />
        </div>
        <div className="ui-dialog__body">{children}</div>
        {defaultFooter !== null && <div className="ui-dialog__foot">{defaultFooter}</div>}
      </div>
    </div>,
    document.body,
  );
}
