import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import './ui.css';

export interface SwitchProps extends Omit<ComponentPropsWithRef<'button'>, 'onChange' | 'children' | 'role'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Bắt buộc có tên đọc được nếu không có <label htmlFor> bên ngoài, ví dụ "Tính cả chiều về". */
  'aria-label'?: string;
}

/** Công tắc — 38×22, núm 16. Tắt #D9D2CD, bật --accent. Bấm hoặc Space/Enter để đổi. */
export function Switch({ checked, onChange, className, disabled, onClick, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx('ui-switch', className)}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onChange(!checked);
      }}
      {...rest}
    />
  );
}
