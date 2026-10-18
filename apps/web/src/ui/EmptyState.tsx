import type { ReactNode } from 'react';
import { cx } from './cx';
import './ui.css';

export interface EmptyStateProps {
  /** Một dòng chữ --muted, ví dụ "Chưa có gói nào cho nhân vật này." */
  message: ReactNode;
  /** Một nút, ví dụ <Button variant="dashed" icon={<IconPlus />}>Thêm gói</Button>. */
  action?: ReactNode;
  className?: string;
}

/** Trạng thái rỗng — một dòng chữ + một nút, đặt sát nội dung (không bơ vơ giữa màn), không ảnh minh hoạ. */
export function EmptyState({ message, action, className }: EmptyStateProps) {
  return (
    <div className={cx('ui-empty', className)}>
      <p className="ui-empty__text">{message}</p>
      {action}
    </div>
  );
}
