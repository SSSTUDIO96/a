import { cx } from './cx';
import './ui.css';

export interface QtyProps {
  value: number;
  onChange: (value: number) => void;
  /** Mặc định 1. */
  min?: number;
  /** Mặc định 1000. */
  max?: number;
  size?: 'md' | 'sm';
  disabled?: boolean;
  /** Tên đọc cho trình đọc màn hình, ví dụ "Số người". */
  label?: string;
  className?: string;
}

/** Ô số lượng (− số +) — cao 28–32, nút nền --soft. Chạm 1 hoặc 1000 thì khoá nút tương ứng. */
export function Qty({ value, onChange, min = 1, max = 1000, size = 'md', disabled, label = 'Số lượng', className }: QtyProps) {
  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;
  return (
    <span
      className={cx('ui-qty', size === 'sm' && 'ui-qty--sm', disabled && 'ui-qty--disabled', className)}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className="ui-qty__btn"
        aria-label={`Giảm ${label.toLowerCase()}`}
        disabled={!canDec}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="ui-qty__val" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="ui-qty__btn"
        aria-label={`Tăng ${label.toLowerCase()}`}
        disabled={!canInc}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </span>
  );
}
