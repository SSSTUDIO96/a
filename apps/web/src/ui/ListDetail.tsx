import type { ReactNode } from 'react';
import { cx } from './cx';
import './list.css';

export interface ListDetailProps {
  /** Cột trái: thường là một Card chứa ô tìm + các ListGroupHeader/ListRow. Thân Card tự cuộn riêng. */
  list: ReactNode;
  /** Cột phải: chi tiết món đang chọn (các thẻ xếp dọc, khe 16). */
  detail: ReactNode;
  /** normal: 380 | 1fr (máy tính bảng 320) · narrow: 300 | 1fr (máy tính bảng 240). */
  variant?: 'normal' | 'narrow';
  /**
   * Điện thoại (≤ 640px) chỉ hiện một cột: 'list' = màn danh sách, 'detail' = màn con.
   * Màn quyết định theo đường dẫn (màn con có đường riêng để nút quay lại của trình duyệt đúng).
   * Máy tính và máy tính bảng luôn hiện cả hai cột.
   */
  mobileView?: 'list' | 'detail';
  /** Mặc định true: cột trái dính đầu (top 16, cao tối đa 100vh − 32). */
  sticky?: boolean;
  /** Tên vùng danh sách cho trình đọc màn hình, ví dụ "Danh sách khách". */
  listLabel?: string;
  /** Tên vùng chi tiết cho trình đọc màn hình. */
  detailLabel?: string;
  className?: string;
}

/**
 * Bố cục hai cột "ListDetail" — bản vẽ C2 mục 0.1 (giống Hợp đồng C).
 * Máy tính ≥1181: cột trái 380 (hẹp 300), khe 20 · máy tính bảng: 320 (hẹp 240), khe 14 ·
 * điện thoại: một cột, `mobileView` chọn danh sách hay màn con; dòng đang chọn không tô màu.
 */
export function ListDetail({
  list,
  detail,
  variant = 'normal',
  mobileView = 'list',
  sticky = true,
  listLabel,
  detailLabel,
  className,
}: ListDetailProps) {
  return (
    <div
      className={cx('ui-ld', variant === 'narrow' && 'ui-ld--narrow', sticky && 'ui-ld--sticky', className)}
      data-mobile={mobileView}
    >
      <section className="ui-ld__list" aria-label={listLabel}>
        {list}
      </section>
      <section className="ui-ld__detail" aria-label={detailLabel}>
        {detail}
      </section>
    </div>
  );
}
