import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { IconBack } from '../ui';

// Thanh trên điện thoại — bản vẽ C mục 2.2: [‹ quay lại] · tiêu đề 16/700 một dòng · [một nút bên phải].
export function TopBar({ title, backTo, action }: { title: ReactNode; backTo?: string; action?: ReactNode }) {
  return (
    <header className="sh-top">
      {backTo ? (
        <Link to={backTo} className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon sh-top__back" aria-label="Quay lại">
          <IconBack />
        </Link>
      ) : null}
      <span className="sh-top__title">{title}</span>
      {action}
    </header>
  );
}
