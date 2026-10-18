// Khung chung cho ô nhập: điều khiển + dòng lỗi 12px --danger ngay dưới (hoặc dòng gợi ý 12px --muted).
import { useId, type ReactNode } from 'react';
import { cx } from './cx';
import './ui.css';

export interface FieldMessages {
  /** Lỗi hiện ngay dưới ô; có lỗi thì ô viền --danger và aria-invalid. */
  error?: string | null;
  /** Thông tin phụ 12px dưới ô (ví dụ địa chỉ studio). Lỗi được ưu tiên. */
  hint?: ReactNode;
}

/** Tạo id cho dòng lỗi/gợi ý và aria-describedby đã gộp. */
export function useFieldIds(messages: FieldMessages, describedBy?: string) {
  const base = useId();
  const errorId = `${base}-loi`;
  const hintId = `${base}-goi-y`;
  const ids = [describedBy, messages.error ? errorId : null, !messages.error && messages.hint ? hintId : null]
    .filter(Boolean)
    .join(' ');
  return { errorId, hintId, describedBy: ids || undefined, invalid: Boolean(messages.error) };
}

export function FieldShell({
  error,
  hint,
  errorId,
  hintId,
  className,
  children,
}: FieldMessages & { errorId: string; hintId: string; className?: string; children: ReactNode }) {
  return (
    <div className={cx('ui-field', className)}>
      {children}
      {error ? (
        <div id={errorId} className="ui-field__error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div id={hintId} className="ui-field__hint">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
