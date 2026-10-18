import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
import { cx } from './cx';
import './list.css';

export interface PersonChipProps {
  /** Tên hiển thị (displayName). */
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  /** Khoá chọn màu ảnh chữ viết tắt — membershipId. */
  colorKey?: string;
  /** Mờ đi (thợ tắt nhận lịch, đã nghỉ...). */
  disabled?: boolean;
  className?: string;
}

/** Người dạng viên: Avatar 28 + tên 13/500, khe 6 — dùng trong hàng tiền công (bản vẽ C2 mục 0.2). */
export function PersonChip({ name, avatarUrl, initials, colorKey, disabled = false, className }: PersonChipProps) {
  return (
    <span className={cx('ui-pchip', disabled && 'ui-pchip--disabled', className)} aria-disabled={disabled || undefined}>
      <Avatar name={name} avatarUrl={avatarUrl} initials={initials} colorKey={colorKey} size="sm" />
      <span className="ui-pchip__name" aria-hidden="true">
        {name}
      </span>
    </span>
  );
}

export interface PersonChipListProps {
  children: ReactNode;
  /** Tên nhóm cho trình đọc màn hình, ví dụ "Thợ ở bậc Thợ chính". */
  label?: string;
  className?: string;
}

/** Hàng PersonChip tự xuống dòng. */
export function PersonChipList({ children, label, className }: PersonChipListProps) {
  return (
    <span className={cx('ui-pchips', className)} role="group" aria-label={label}>
      {children}
    </span>
  );
}
