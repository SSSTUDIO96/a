import type { CSSProperties } from 'react';
import { cx } from './cx';
import './ui.css';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Hình tròn (chỗ ảnh đại diện). */
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Khối chờ — nền --line-2, bo 6. Dùng lúc tải lần đầu thay cho vòng xoay giữa màn. */
export function Skeleton({ width = '100%', height = 14, circle, className, style }: SkeletonProps) {
  return (
    <span
      className={cx('ui-skel', className)}
      aria-hidden="true"
      style={{ width, height, borderRadius: circle ? '50%' : undefined, flex: 'none', ...style }}
    />
  );
}

export interface SkeletonTextProps {
  /** Số dòng; mỗi dòng cao đúng một dòng chữ (1em × 1.45) để bố cục không nhảy khi có dữ liệu. */
  lines?: number;
  /** Bề rộng từng dòng (lặp lại nếu ít hơn số dòng). */
  widths?: Array<number | string>;
  /** Cỡ chữ của nội dung thật (mặc định kế thừa). */
  fontSize?: number;
  /** Tên cho trình đọc màn hình. */
  label?: string;
  className?: string;
}

export function SkeletonText({ lines = 1, widths = ['100%'], fontSize, label = 'Đang tải', className }: SkeletonTextProps) {
  return (
    <span className={cx('ui-skel-group', className)} role="status" aria-label={label} style={{ fontSize }}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="ui-skel-line">
          <span className="ui-skel" style={{ width: widths[i % widths.length] }} />
        </span>
      ))}
    </span>
  );
}
