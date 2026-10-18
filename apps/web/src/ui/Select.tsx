import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import { FieldShell, useFieldIds, type FieldMessages } from './Field';
import './ui.css';

export interface SelectOption {
  value: string;
  /** Chữ ngắn. Thông tin phụ (địa chỉ…) không nhét vào đây mà đưa vào `hint`. */
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'size' | 'children'>, FieldMessages {
  options: readonly SelectOption[];
  size?: 'md' | 'sm';
  /** Dòng đầu khi chưa chọn, ví dụ "Chọn studio". */
  placeholder?: string;
  /** Thông tin phụ của mục đang chọn (dòng 12px bên dưới), ví dụ địa chỉ studio. */
  hint?: ReactNode;
  className?: string;
}

/** Ô chọn — cao 36 (sm 30). Dùng select gốc của trình duyệt để bàn phím và điện thoại chạy đúng. */
export function Select({
  options,
  size = 'md',
  placeholder,
  error,
  hint,
  className,
  'aria-describedby': describedByProp,
  ...rest
}: SelectProps) {
  const f = useFieldIds({ error, hint }, describedByProp);
  return (
    <FieldShell error={error} hint={hint} errorId={f.errorId} hintId={f.hintId} className={className}>
      <select
        className={cx('ui-input', 'ui-select', size === 'sm' && 'ui-input--sm')}
        aria-invalid={f.invalid || undefined}
        aria-describedby={f.describedBy}
        {...rest}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
