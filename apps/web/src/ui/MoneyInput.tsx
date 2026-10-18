import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentPropsWithRef,
  type FocusEvent,
} from 'react';
import { cx } from './cx';
import { FieldShell, useFieldIds, type FieldMessages } from './Field';
import { formatVnd, groupThousands, parseMoney, type Vnd } from './format';
import { caretAfterDigits, digitsBefore, useCaret } from './useCaret';
import './ui.css';

type NativeInput = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'size' | 'inputMode' | 'ref'
>;

export interface MoneyInputProps extends NativeInput, FieldMessages {
  /** Số nguyên đồng; null = chưa đặt (hiện chữ gợi ý). */
  value: Vnd | null;
  /** Chỉ gọi khi ô đọc được một số tiền hợp lệ (hoặc null khi xoá trắng). */
  onChange: (value: Vnd | null) => void;
  /** Báo lỗi tự phát hiện khi gõ (âm, lẻ, quá lớn, chữ) để form chặn lưu; null khi hết lỗi. */
  onInputError?: (message: string | null) => void;
  /** Giới hạn trên (tính cả), tuỳ chọn. */
  max?: Vnd;
  size?: 'md' | 'sm';
  className?: string;
}

const ALLOWED_TYPING = /^[\d.,\s  ₫đĐ-]*$/u;
const ERR_LETTERS = 'Chỉ nhập chữ số.';

function displayOf(value: Vnd | null, focused: boolean): string {
  if (value === null) return '';
  return focused ? groupThousands(String(value)) : formatVnd(value);
}

/**
 * Ô tiền — như TextInput, căn phải. Rời ô: "1.500.000 ₫". Đang gõ: bỏ " ₫", chỉ nhận chữ số,
 * tự chèn dấu chấm ngăn nghìn. Giá trị trả ra là số nguyên đồng.
 * Lỗi: âm, có phần lẻ ("1,5"), vượt Number.MAX_SAFE_INTEGER, dán chữ.
 */
export function MoneyInput({
  value,
  onChange,
  onInputError,
  max,
  size = 'md',
  error,
  hint,
  className,
  placeholder,
  onFocus,
  onBlur,
  onPaste,
  'aria-describedby': describedByProp,
  ...rest
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const setCaret = useCaret(inputRef);
  const [focused, setFocused] = useState(false);
  // Chữ đang hiện khi có lỗi tự phát hiện hoặc đang gõ; null = hiện theo `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const reportRef = useRef(onInputError);
  useEffect(() => {
    reportRef.current = onInputError;
  });
  const lastReported = useRef<string | null>(null);
  useEffect(() => {
    if (lastReported.current !== localError) {
      lastReported.current = localError;
      reportRef.current?.(localError);
    }
  }, [localError]);

  const shownError = localError ?? error;
  const f = useFieldIds({ error: shownError, hint }, describedByProp);
  const text = draft ?? displayOf(value, focused);

  function accept(next: Vnd | null, nextText: string) {
    if (next !== null && max !== undefined && next > max) {
      setDraft(nextText);
      setLocalError(`Tối đa ${formatVnd(max)}.`);
      return;
    }
    setDraft(nextText);
    setLocalError(null);
    if (next !== value) onChange(next);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    if (!ALLOWED_TYPING.test(raw)) {
      // Không nhận chữ cái: giữ nguyên ô, báo lỗi.
      setLocalError(ERR_LETTERS);
      setCaret(Math.max(0, caret - (raw.length - text.length)));
      return;
    }
    const trimmed = raw.replace(/[\s  ₫đĐ]/gu, '');
    if (/^-/.test(trimmed) || trimmed.includes(',')) {
      // Âm hoặc có phần lẻ: giữ đúng chữ người dùng gõ để họ thấy chỗ sai.
      const r = parseMoney(trimmed);
      setDraft(raw);
      setLocalError(r.ok ? null : r.error);
      return;
    }
    const digits = trimmed.replace(/\./g, '');
    if (digits === '') {
      setCaret(0);
      accept(null, '');
      return;
    }
    const grouped = groupThousands(digits);
    setCaret(caretAfterDigits(grouped, digitsBefore(raw, caret) - (digits.length - digits.replace(/^0+(?=\d)/, '').length)));
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) {
      setDraft(grouped);
      setLocalError('Số tiền quá lớn.');
      return;
    }
    accept(n, grouped);
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    onPaste?.(e);
    if (e.defaultPrevented) return;
    const pasted = e.clipboardData.getData('text');
    const el = e.currentTarget;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    // Dán thay cả ô (hoặc ô trống): đọc chặt bằng parseMoney — "1.5" hay "1,5" là lỗi, không đoán.
    if (start === 0 && end === text.length) {
      e.preventDefault();
      const r = parseMoney(pasted);
      if (!r.ok) {
        setLocalError(r.error);
        return;
      }
      const nextText = r.value === null ? '' : groupThousands(String(r.value));
      setCaret(nextText.length);
      accept(r.value, nextText);
    }
    // Dán vào giữa: để handleChange xử lý như gõ.
  }

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    setFocused(true);
    if (draft === null) setDraft(displayOf(value, true));
    onFocus?.(e);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    setFocused(false);
    // Hết lỗi thì hiện lại theo `value` (kèm " ₫"); còn lỗi thì giữ chữ đang gõ.
    if (!localError) setDraft(null);
    onBlur?.(e);
  }

  return (
    <FieldShell error={shownError} hint={hint} errorId={f.errorId} hintId={f.hintId} className={className}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cx('ui-input', 'ui-input--right', size === 'sm' && 'ui-input--sm')}
        value={text}
        placeholder={placeholder}
        aria-invalid={f.invalid || undefined}
        aria-describedby={f.describedBy}
        onChange={handleChange}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...rest}
      />
    </FieldShell>
  );
}
