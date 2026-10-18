import type { ElementType, MouseEvent, ReactNode } from 'react';
import { cx } from './cx';
import { Skeleton, SkeletonText } from './Skeleton';
import './list.css';

export interface ListRowProps {
  /** Tên 14/600 — xuống dòng, không cắt. */
  title: ReactNode;
  /** Dòng phụ 12.5px --muted (mã HĐ, vai trò...). */
  subtitle?: ReactNode;
  /** Cột đầu: Avatar / AvatarStack. Bỏ trống = dòng không ảnh. */
  leading?: ReactNode;
  /** Số tiền bên phải 14/700, không xuống dòng. */
  amount?: ReactNode;
  /** Bên phải, dưới số tiền: nhãn (StatusTag) hoặc số đếm (--faint). */
  trailing?: ReactNode;
  /** Đang chọn: nền --accent-soft + viền trong trái 3px --accent (điện thoại trong ListDetail: không tô). */
  selected?: boolean;
  /** Khoá: không bấm được, chữ --faint. */
  disabled?: boolean;
  /** Màu tên: warn (ví dụ "Chưa gán bậc"), faint (bậc đang ẩn). */
  tone?: 'default' | 'warn' | 'faint';
  /** Lỗi của riêng dòng (ví dụ "Không tải được"): thay dòng phụ, chữ --danger. */
  error?: string | null;
  /** Bấm dòng. Có onClick mà không có href/as → <button>. */
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  /** Có href → <a>. */
  href?: string;
  /**
   * Thẻ tuỳ chọn, ví dụ Link của react-router: `as={Link} linkProps={{ to: '/khach-hang/k1' }}`.
   * Phần tử này nhận className, aria-current, onClick và children.
   */
  as?: ElementType;
  linkProps?: Record<string, unknown>;
  /** Tên cho trình đọc màn hình khi nội dung dòng chưa đủ rõ. */
  'aria-label'?: string;
  className?: string;
  /** Chỉ cho trang xem thử. */
  'data-demo'?: 'hover' | 'focus';
}

/**
 * Dòng danh sách — bản vẽ C2 mục 0.2. Đệm 11 16 (điện thoại 11 14); lưới [ảnh] 1fr auto.
 * Bấm được khi có onClick / href / as; Enter (và Space với nút) mở như bấm chuột.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  amount,
  trailing,
  selected = false,
  disabled = false,
  tone = 'default',
  error,
  onClick,
  href,
  as,
  linkProps,
  'aria-label': ariaLabel,
  className,
  'data-demo': demo,
}: ListRowProps) {
  const hasRight = amount !== undefined || trailing !== undefined;
  const interactive = Boolean(onClick || href || as);
  const cls = cx(
    'ui-lrow',
    leading === undefined && 'ui-lrow--noav',
    !hasRight && 'ui-lrow--noright',
    interactive && 'ui-lrow--action',
    selected && 'ui-lrow--sel',
    disabled && 'ui-lrow--disabled',
    tone !== 'default' && `ui-lrow--${tone}`,
    error && 'ui-lrow--error',
    className,
  );

  const content = (
    <>
      {leading !== undefined && <span className="ui-lrow__lead">{leading}</span>}
      <span className="ui-lrow__text">
        <span className="ui-lrow__title">{title}</span>
        {error ? (
          <span className="ui-lrow__sub" role="alert">
            {error}
          </span>
        ) : (
          subtitle !== undefined && <span className="ui-lrow__sub">{subtitle}</span>
        )}
      </span>
      {hasRight && (
        <span className="ui-lrow__right">
          {amount !== undefined && <span className="ui-lrow__amt">{amount}</span>}
          {trailing !== undefined && <span className="ui-lrow__trail">{trailing}</span>}
        </span>
      )}
    </>
  );

  const current = selected ? ('true' as const) : undefined;

  if (!interactive) {
    return (
      <div className={cls} aria-label={ariaLabel} aria-disabled={disabled || undefined} data-demo={demo}>
        {content}
      </div>
    );
  }

  if (as || href) {
    const Tag: ElementType = as ?? 'a';
    return (
      <Tag
        {...linkProps}
        href={as ? undefined : disabled ? undefined : href}
        className={cls}
        aria-current={current}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : undefined}
        data-demo={demo}
        onClick={(e: MouseEvent<HTMLElement>) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
      >
        {content}
      </Tag>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      aria-current={current}
      aria-label={ariaLabel}
      disabled={disabled}
      data-demo={demo}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export interface ListRowSkeletonProps {
  /** Số dòng chờ, mặc định 3. */
  rows?: number;
  /** Có chỗ ảnh đại diện ở đầu dòng. */
  avatar?: boolean;
  /** Có số tiền bên phải. */
  amount?: boolean;
  label?: string;
}

/** Dòng chờ lúc tải lần đầu — giữ đúng chiều cao ListRow để bố cục không nhảy. */
export function ListRowSkeleton({ rows = 3, avatar = false, amount = false, label = 'Đang tải danh sách' }: ListRowSkeletonProps) {
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cx('ui-lrow', 'ui-lrow--loading', !avatar && 'ui-lrow--noav', !amount && 'ui-lrow--noright')}
          aria-hidden="true"
        >
          {avatar && (
            <span className="ui-lrow__lead">
              <Skeleton circle width={32} height={32} />
            </span>
          )}
          <span className="ui-lrow__text">
            <SkeletonText lines={1} widths={[i % 2 ? '55%' : '70%']} label="" />
            <SkeletonText lines={1} widths={['35%']} fontSize={12.5} label="" />
          </span>
          {amount && <Skeleton width={84} height={14} />}
        </div>
      ))}
    </div>
  );
}
