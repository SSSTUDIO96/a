import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import { StatusTag } from './StatusTag';
import './ui.css';

export interface CheckChipProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size' | 'children'> {
  label: ReactNode;
  /** Chữ giá, ví dụ "+250.000 ₫" (màu --muted). */
  price?: ReactNode;
  /** Đã huỷ: gạch ngang, chữ --faint, kèm nhãn đỏ "Đã huỷ: lý do". Không bấm được. */
  voidReason?: string;
  className?: string;
}

/**
 * Ô tick dạng viên (dịch vụ phụ) — cao 28, đệm 4 10 4 8, bo 999.
 * Bật: nền --accent-soft, viền --accent-line. Khoá: nền trắng, chữ --muted.
 */
export function CheckChip({ label, price, voidReason, className, disabled, checked, ...rest }: CheckChipProps) {
  const voided = voidReason !== undefined;
  const chip = (
    <label
      className={cx(
        'ui-ckchip',
        checked && !voided && 'ui-ckchip--on',
        disabled && !voided && 'ui-ckchip--disabled',
        voided && 'ui-ckchip--void',
        className,
      )}
    >
      <input type="checkbox" checked={voided ? false : checked} disabled={disabled || voided} {...rest} />
      <span className="ui-ckchip__name">{label}</span>
      {price !== undefined && <span className="ui-ckchip__price num">{price}</span>}
    </label>
  );
  if (!voided) return chip;
  return (
    <span className="ui-ckchip-wrap">
      {chip}
      <StatusTag tone="danger">Đã huỷ: {voidReason}</StatusTag>
    </span>
  );
}
