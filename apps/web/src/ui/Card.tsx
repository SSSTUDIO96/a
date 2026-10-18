import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import './ui.css';

export interface CardProps extends Omit<ComponentPropsWithRef<'section'>, 'title'> {
  /** Tiêu đề thẻ h2 16/700. */
  title?: ReactNode;
  /** Chữ phụ cạnh tiêu đề (13px --faint), ví dụ "3 gói". */
  subtitle?: ReactNode;
  /** Nút bên phải đầu thẻ. */
  actions?: ReactNode;
  /** Chân thẻ nền --soft, ví dụ "Cộng cô dâu · 3.267.000 ₫". */
  footer?: ReactNode;
  /** Thân không đệm (danh sách dòng tự có đệm). */
  flush?: boolean;
  /** Cấp tiêu đề, mặc định h2. */
  headingLevel?: 2 | 3;
}

/** Thẻ — nền trắng, viền --line, bo 12, không đổ bóng. Đầu thẻ đệm 14 18, gạch dưới. */
export function Card({ title, subtitle, actions, footer, flush = false, headingLevel = 2, className, children, ...rest }: CardProps) {
  const H = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <section className={cx('ui-card', className)} {...rest}>
      {(title !== undefined || actions !== undefined) && (
        <header className="ui-card__head">
          <H className="ui-card__title">
            {title}
            {subtitle !== undefined && <span className="ui-card__sub">{subtitle}</span>}
          </H>
          {actions}
        </header>
      )}
      {children !== undefined && <div className={cx('ui-card__body', flush && 'ui-card__body--flush')}>{children}</div>}
      {footer !== undefined && <footer className="ui-card__foot">{footer}</footer>}
    </section>
  );
}
