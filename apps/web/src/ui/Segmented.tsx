import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';
import { useTooltip } from './Tooltip';
import './ui.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Ô không cho chọn: chữ #CFC7C1 trên nền sọc. */
  disabled?: boolean;
  /** Lý do không cho chọn, hiện ở tooltip, ví dụ "Gói này không làm tại nhà". */
  disabledReason?: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Tên nhóm cho trình đọc màn hình, ví dụ "Làm ở đâu". */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  size?: 'md' | 'sm';
  /** Khoá cả nhóm: ô đang chọn giữ màu, các ô khác thành sọc. */
  disabled?: boolean;
  /** Chia đều hết bề ngang (nhóm nút chuyển trên điện thoại). */
  block?: boolean;
  /** Trang xem thử: ép trạng thái tĩnh cho một ô. */
  demo?: { value: T; state: 'hover' | 'focus' };
  className?: string;
}

/**
 * Nhóm nút chuyển — ô cao 34 (sm 28), viền ngoài --line, bo 8, ô cách nhau bằng viền 1px.
 * Đang chọn: nền --accent-soft, chữ --accent/600.
 * Bàn phím: Tab vào nhóm, mũi tên trái/phải đi giữa các ô (kể cả ô bị khoá để đọc lý do), Space/Enter chọn.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  block = false,
  demo,
  className,
  ...aria
}: SegmentedProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const tabStop = options.some((o) => o.value === value) ? value : (options.find((o) => !o.disabled)?.value ?? options[0]?.value);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % buttons.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    if (next >= 0) {
      e.preventDefault();
      buttons[next]?.focus();
    }
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-disabled={disabled || undefined}
      className={cx('ui-seg', size === 'sm' && 'ui-seg--sm', block && 'ui-seg--block', disabled && 'ui-seg--disabled', className)}
      onKeyDown={onKeyDown}
      {...aria}
    >
      {options.map((o) => (
        <SegOption
          key={o.value}
          option={o}
          checked={o.value === value}
          locked={disabled || Boolean(o.disabled)}
          tabbable={o.value === tabStop}
          demo={demo?.value === o.value ? demo.state : undefined}
          onSelect={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}

function SegOption<T extends string>({
  option,
  checked,
  locked,
  tabbable,
  demo,
  onSelect,
}: {
  option: SegmentedOption<T>;
  checked: boolean;
  locked: boolean;
  tabbable: boolean;
  demo?: 'hover' | 'focus';
  onSelect: () => void;
}) {
  const reason = locked && !checked ? option.disabledReason : undefined;
  const tip = useTooltip(reason ?? '', reason ? undefined : false);
  const { ref, onClick: pinTip, ...tipHandlers } = tip.anchorProps;
  return (
    <>
      <button
        type="button"
        role="radio"
        ref={ref}
        aria-checked={checked}
        aria-disabled={locked || undefined}
        tabIndex={tabbable ? 0 : -1}
        className="ui-seg__opt"
        data-demo={demo}
        onClick={() => {
          if (reason) pinTip(); // chạm trên điện thoại: hiện lý do
          else if (!locked && !checked) onSelect();
        }}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !locked && !checked) {
            e.preventDefault();
            onSelect();
          }
        }}
        {...(reason ? tipHandlers : {})}
      >
        {option.label}
      </button>
      {reason && tip.node}
    </>
  );
}
