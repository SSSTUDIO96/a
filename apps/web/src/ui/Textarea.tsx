import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import { FieldShell, useFieldIds, type FieldMessages } from './Field';
import './ui.css';

export interface TextareaProps extends ComponentPropsWithRef<'textarea'>, FieldMessages {
  size?: 'md' | 'sm';
  className?: string;
}

/** Ô nhiều dòng — cao tối thiểu 2 dòng, đệm 8 10, các trạng thái như TextInput. */
export function Textarea({
  size = 'md',
  error,
  hint,
  className,
  rows = 2,
  'aria-describedby': describedByProp,
  ...rest
}: TextareaProps) {
  const f = useFieldIds({ error, hint }, describedByProp);
  return (
    <FieldShell error={error} hint={hint} errorId={f.errorId} hintId={f.hintId} className={className}>
      <textarea
        rows={rows}
        className={cx('ui-input', 'ui-textarea', size === 'sm' && 'ui-input--sm')}
        aria-invalid={f.invalid || undefined}
        aria-describedby={f.describedBy}
        {...rest}
      />
    </FieldShell>
  );
}
