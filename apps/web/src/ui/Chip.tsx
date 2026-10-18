import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import './ui.css';

export interface ChipProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  selected?: boolean;
  /** Số đếm mờ bên phải, ví dụ số gói. */
  count?: ReactNode;
  children: ReactNode;
}

/** Chip bộ lọc — đệm 5 12, bo 999. Đang chọn: viền --accent, nền --accent-soft. */
export function Chip({ selected = false, count, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={selected} className={cx('ui-chip', className)} {...rest}>
      {children}
      {count !== undefined && <span className="ui-chip__count num">{count}</span>}
    </button>
  );
}
