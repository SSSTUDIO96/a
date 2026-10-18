import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';
import { Skeleton } from './Skeleton';
import { Tooltip } from './Tooltip';
import './list.css';

export interface StatTileProps {
  /** Nhãn 12.5px --muted, ví dụ "Đã thu thực tế". */
  label: ReactNode;
  /** Số 20/700 tabular (điện thoại 16), ví dụ formatVnd(1_000_000). */
  value: ReactNode;
  /** Chữ trong Tooltip "?" cạnh nhãn (màn Doanh thu: lấy nguyên `basis` máy chủ trả, không tự viết). */
  tip?: ReactNode;
  /** Dòng nhỏ dưới số, 12px --faint, ví dụ "12 hợp đồng". */
  note?: ReactNode;
  noteTone?: 'default' | 'warn' | 'danger';
  /** highlight: viền --accent-line, nền --accent-soft · danger: số màu --danger. */
  variant?: 'default' | 'highlight' | 'danger';
  /** Đang tải: khối chờ thay số, giữ chiều cao. */
  loading?: boolean;
  /** Không tải được số: hiện "—" mờ, viền --danger-line, lý do ở dòng nhỏ. */
  error?: string | null;
  className?: string;
}

/** Ô số — bản vẽ C2 mục 0.2. Đệm 12 16, bo 12, viền --line. */
export function StatTile({
  label,
  value,
  tip,
  note,
  noteTone = 'default',
  variant = 'default',
  loading = false,
  error,
  className,
}: StatTileProps) {
  return (
    <div
      className={cx('ui-stat', variant !== 'default' && `ui-stat--${variant}`, error && 'ui-stat--error', className)}
      aria-busy={loading || undefined}
    >
      <span className="ui-stat__label">
        {label}
        {tip !== undefined && <Tooltip text={tip} />}
      </span>
      <b className="ui-stat__value">
        {loading ? (
          <>
            <Skeleton width="70%" height={18} />
            <span className="sr-only">Đang tải</span>
          </>
        ) : error ? (
          '—'
        ) : (
          value
        )}
      </b>
      {error ? (
        <span className="ui-stat__note ui-stat__note--danger" role="alert">
          {error}
        </span>
      ) : (
        note !== undefined &&
        !loading && (
          <span className={cx('ui-stat__note', noteTone !== 'default' && `ui-stat__note--${noteTone}`)}>{note}</span>
        )
      )}
    </div>
  );
}

export interface StatGridProps {
  children: ReactNode;
  /** Số cột trên máy tính (mặc định 4). Máy tính bảng và điện thoại luôn 2 cột (2×2). */
  columns?: 2 | 3 | 4;
  /** Tên nhóm cho trình đọc màn hình, ví dụ "Số liệu tháng 10". */
  label?: string;
  className?: string;
}

/** Lưới ô số: 4 ô trên máy tính; máy tính bảng và điện thoại 2×2. */
export function StatGrid({ children, columns = 4, label, className }: StatGridProps) {
  return (
    <div
      className={cx('ui-stats', className)}
      role="group"
      aria-label={label}
      style={{ '--stat-cols': columns } as CSSProperties}
    >
      {children}
    </div>
  );
}
