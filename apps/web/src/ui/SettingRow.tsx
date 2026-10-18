import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';
import { Tooltip } from './Tooltip';
import './ui.css';

export interface SettingRowProps {
  /** Nhãn 14/500. */
  label: ReactNode;
  /** id của điều khiển để bấm nhãn là vào ô. */
  htmlFor?: string;
  /** Giải thích — hiện trong tooltip "?" sau nhãn, không viết ra màn. */
  tip?: ReactNode;
  /** Dấu * đỏ bắt buộc. */
  required?: boolean;
  /** Bề rộng tối đa cột điều khiển. Mặc định 220px (điện thoại 160px). */
  controlWidth?: number;
  /** Nhãn trên, điều khiển dưới (ví dụ Ghi chú trên điện thoại). */
  stack?: boolean;
  className?: string;
  children: ReactNode;
}

/** Một dòng cài đặt = nhãn + điều khiển. Đệm 10 trên dưới, chia bằng đường --line-2. */
export function SettingRow({ label, htmlFor, tip, required, controlWidth, stack, className, children }: SettingRowProps) {
  const style = controlWidth ? ({ '--row-ctl': `${controlWidth}px` } as CSSProperties) : undefined;
  const Label = htmlFor ? 'label' : 'span';
  return (
    <div className={cx('ui-row', stack && 'ui-row--stack', className)} style={style}>
      <div className="ui-row__label">
        <Label htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="ui-req" aria-label="bắt buộc">
              *
            </span>
          )}
        </Label>
        {tip !== undefined && <Tooltip text={tip} />}
      </div>
      <div className="ui-row__ctl">{children}</div>
    </div>
  );
}
