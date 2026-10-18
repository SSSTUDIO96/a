import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import { FieldShell, useFieldIds } from './Field';
import './ui.css';

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size'> {
  label: ReactNode;
  /** Nội dung bên phải nhãn, ví dụ giá "250.000 ₫" (màu --muted). */
  trailing?: ReactNode;
  /** Tooltip "?" đặt ngay sau nhãn — đặt ngoài <label> để bấm "?" không đổi ô tick. */
  tip?: ReactNode;
  error?: string | null;
  className?: string;
}

/** Ô tick — ô 16px, accent-color --accent, nhãn 14/500, khe 8. Khoá: nhãn --muted. */
export function Checkbox({
  label,
  trailing,
  tip,
  error,
  className,
  disabled,
  'aria-describedby': describedByProp,
  ...rest
}: CheckboxProps) {
  const f = useFieldIds({ error }, describedByProp);
  return (
    <FieldShell error={error} errorId={f.errorId} hintId={f.hintId} className={className}>
      <span className="ui-check-row">
        <label className={cx('ui-check', disabled && 'ui-check--disabled', trailing !== undefined && 'ui-check--grow')}>
          <input
            type="checkbox"
            disabled={disabled}
            aria-invalid={f.invalid || undefined}
            aria-describedby={f.describedBy}
            {...rest}
          />
          <span className="ui-check__label">{label}</span>
          {trailing !== undefined && <span className="ui-check__trail num">{trailing}</span>}
        </label>
        {tip}
      </span>
    </FieldShell>
  );
}
