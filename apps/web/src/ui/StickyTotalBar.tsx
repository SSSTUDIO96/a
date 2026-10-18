import type { ReactNode } from 'react';
import { cx } from './cx';
import { formatVnd, type Vnd } from './format';
import './ui.css';

export interface StickyTotalBarProps {
  /** Tổng lấy từ máy chủ (/contracts/quote) — giao diện không tự cộng. null = chưa có. */
  total: Vnd | null;
  /** Cọc cần thu. Bỏ trống thì không hiện ô "Cọc". */
  deposit?: Vnd | null;
  /** Đang chờ quote: số mờ opacity .5, giữ chỗ, không nhảy. */
  pending?: boolean;
  /** Nút bên phải, ví dụ [Lưu nháp] [Xác nhận hợp đồng]. Thêm class "ui-total__hide-phone" để ẩn trên điện thoại. */
  actions?: ReactNode;
  /** sticky (mặc định): dính đáy; điện thoại thì tràn mép, nằm trên thanh dưới (bottom: 64px). static: đứng yên. */
  position?: 'sticky' | 'static';
  className?: string;
}

const DASH = '—';

/** Thanh tổng tiền — đệm 12 18, bo 12. "Tổng" 18/700, "Cọc" 15/700, nút bên phải. */
export function StickyTotalBar({ total, deposit, pending = false, actions, position = 'sticky', className }: StickyTotalBarProps) {
  return (
    <div
      className={cx('ui-total', position === 'sticky' && 'ui-total--sticky', className)}
      aria-busy={pending || undefined}
      role="region"
      aria-label="Tổng tiền"
    >
      <div className="ui-total__sums" aria-live="polite">
        <span className="ui-total__item">
          Tổng<b className="ui-total__amt num">{total === null ? DASH : formatVnd(total)}</b>
        </span>
        {deposit !== undefined && (
          <span className="ui-total__item ui-total__item--dep">
            Cọc<b className="ui-total__amt num">{deposit === null ? DASH : formatVnd(deposit)}</b>
          </span>
        )}
      </div>
      {actions !== undefined && <div className="ui-total__actions">{actions}</div>}
    </div>
  );
}
