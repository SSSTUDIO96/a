import type { ReactNode } from 'react';
import { cx } from './cx';
import './list.css';

export interface ListGroupHeaderProps {
  /** Tên nhóm, ví dụ "Sự kiện 7 ngày tới" (hiện viết hoa bằng CSS, chữ gốc giữ nguyên cho trình đọc màn hình). */
  children: ReactNode;
  /** Bên phải: số dòng hoặc "{total} khách". */
  aside?: ReactNode;
  /** danger: nền --danger-bg, chữ --danger (ví dụ "Quá hạn"). */
  tone?: 'default' | 'danger';
  /** Cấp tiêu đề, mặc định h3 (trong Card có h2). */
  headingLevel?: 2 | 3 | 4;
  id?: string;
  className?: string;
}

/** Tiêu đề nhóm trong danh sách — đệm 12 16 6, chữ 11.5/700 viết hoa, giãn .05em, nền --soft, gạch dưới --line-2. */
export function ListGroupHeader({ children, aside, tone = 'default', headingLevel = 3, id, className }: ListGroupHeaderProps) {
  const H = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <H id={id} className={cx('ui-lgh', tone === 'danger' && 'ui-lgh--danger', className)}>
      <span className="ui-lgh__title">{children}</span>
      {aside !== undefined && aside !== null && <span className="ui-lgh__aside">{aside}</span>}
    </H>
  );
}
