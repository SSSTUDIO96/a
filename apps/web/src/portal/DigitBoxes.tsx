import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

export const DIGITS = 4;

interface Props {
  /** Chuỗi chữ số đang nhập, tối đa 4 ký tự. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Viền đỏ khi vừa nhập sai. */
  invalid?: boolean;
  /** Mô tả gắn với ô (dải lỗi), để trình đọc màn hình đọc cùng ô. */
  describedBy?: string;
}

const onlyDigits = (s: string) => s.replace(/\D/g, '').slice(0, DIGITS);

/** 4 ô số: bàn phím số, tự nhảy ô, xoá lùi về ô trước, dán 4 số được. */
export function DigitBoxes({ value, onChange, disabled, invalid, describedBy }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(DIGITS - 1, i))]?.focus();
  const chars = Array.from({ length: DIGITS }, (_, i) => value[i] ?? '');

  const setAt = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') {
      onChange(value.slice(0, i) + value.slice(i + 1));
      return;
    }
    // Nhiều chữ số vào cùng lúc (gợi ý của bàn phím, tự điền): trải sang các ô sau.
    const next = onlyDigits(value.slice(0, i) + digits + value.slice(i + 1));
    onChange(next);
    focusAt(Math.min(i + digits.length, DIGITS - 1));
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && chars[i] === '' && i > 0) {
      e.preventDefault();
      onChange(value.slice(0, i - 1) + value.slice(i));
      focusAt(i - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(i + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = onlyDigits(e.clipboardData.getData('text'));
    if (digits === '') return;
    e.preventDefault();
    onChange(digits);
    focusAt(Math.min(digits.length, DIGITS - 1));
  };

  return (
    <div className="pt-digits" role="group" aria-label="4 số cuối số điện thoại">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={invalid ? 'pt-digit pt-digit--bad' : 'pt-digit'}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          maxLength={DIGITS}
          aria-label={`Số thứ ${i + 1} trong 4 số cuối`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={c}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
