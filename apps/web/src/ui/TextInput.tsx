import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import { FieldShell, useFieldIds, type FieldMessages } from './Field';
import './ui.css';

export interface TextInputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'>, FieldMessages {
  size?: 'md' | 'sm';
  /** Căn phải (số). */
  align?: 'left' | 'right';
  /** Class cho khung ngoài (ô + dòng lỗi). */
  className?: string;
}

/** Ô chữ — cao 36 (sm 30), bo 8, đệm 0 10. Lỗi: viền --danger, dòng lỗi 12px ngay dưới. */
export function TextInput({
  size = 'md',
  align = 'left',
  error,
  hint,
  className,
  type = 'text',
  'aria-describedby': describedByProp,
  ...rest
}: TextInputProps) {
  const f = useFieldIds({ error, hint }, describedByProp);
  return (
    <FieldShell error={error} hint={hint} errorId={f.errorId} hintId={f.hintId} className={className}>
      <input
        type={type}
        className={cx('ui-input', size === 'sm' && 'ui-input--sm', align === 'right' && 'ui-input--right')}
        aria-invalid={f.invalid || undefined}
        aria-describedby={f.describedBy}
        {...rest}
      />
    </FieldShell>
  );
}
