import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import './ui.css';

/** danger: nút đỏ cho thao tác khó lùi (xoá, khoá, huỷ) — bản vẽ C2 mục 0.2 ConfirmDialog. */
export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'dashed' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Biểu tượng bên trái chữ. */
  icon?: ReactNode;
  /** Đang chạy: vòng xoay 16px thay biểu tượng, giữ chữ, tự khoá. */
  loading?: boolean;
  /** Kéo rộng hết hàng. */
  block?: boolean;
  /** Nút chỉ có biểu tượng thì bắt buộc truyền aria-label. */
  children?: ReactNode;
}

/**
 * Nút — bản vẽ C mục 3. md cao 36, sm cao 30, chỉ biểu tượng rộng 34.
 * Nút chỉ biểu tượng (không có children) phải có aria-label tiếng Việt, ví dụ "Đóng".
 */
export function Button({
  variant = 'default',
  size = 'md',
  icon,
  loading = false,
  block = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconOnly = children === undefined || children === null || children === false;
  return (
    <button
      type={type}
      className={cx(
        'ui-btn',
        variant !== 'default' && `ui-btn--${variant}`,
        size === 'sm' && 'ui-btn--sm',
        iconOnly && 'ui-btn--icon',
        block && 'ui-btn--block',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="ui-spinner" aria-hidden="true" /> : icon}
      {!iconOnly && <span className="ui-btn__text">{children}</span>}
      {loading && <span className="sr-only">Đang xử lý</span>}
    </button>
  );
}
