import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type FocusEvent,
} from 'react';
import { MAX_DISTANCE_KM } from '@makeup/shared';
import { cx } from './cx';
import { FieldShell, useFieldIds, type FieldMessages } from './Field';
import { formatDecimal, parseDecimal, parseKm, type ParseResult } from './format';
import './ui.css';

type NativeInput = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'size' | 'inputMode' | 'ref' | 'min' | 'max'
>;

export interface UnitInputProps extends NativeInput, FieldMessages {
  value: number | null;
  /** Chỉ gọi khi ô đọc được số hợp lệ (null khi xoá trắng). */
  onChange: (value: number | null) => void;
  /** Hậu tố ở mép phải: "km", "phút", "lần". */
  unit: string;
  /** Số chữ số lẻ tối đa. Mặc định: km → 2, đơn vị khác → 0 (số nguyên). */
  decimals?: number;
  /** Mặc định: km → 99.999,99 (MAX_DISTANCE_KM). */
  max?: number;
  min?: number;
  onInputError?: (message: string | null) => void;
  /**
   * Đổi giá trị này mỗi lần form TỰ đặt lại giá trị cho ô (nút "Huỷ thay đổi", tải lại dữ liệu) → ô bỏ chữ đang gõ và lỗi
   * tự phát hiện, hiện theo `value` — kể cả khi `value` bằng đúng số cũ (lúc đó `value` không đổi nên ô không tự biết).
   */
  resetKey?: string | number;
  size?: 'md' | 'sm';
  className?: string;
}

const ALLOWED_TYPING = /^[\d.,\s  ]*$/u;

/** Bỏ đơn vị gõ/dán kèm ở cuối ("12,5 km", "12,5KM") — hậu tố đã hiện sẵn ở mép phải. */
function stripUnit(raw: string, unit: string): string {
  const u = unit.trim();
  if (!u) return raw;
  const tail = raw.replace(/[\s\u00a0\u202f]+$/u, '');
  return tail.toLowerCase().endsWith(u.toLowerCase()) ? tail.slice(0, -u.length).replace(/[\s\u00a0\u202f]+$/u, '') : raw;
}

/**
 * Ô số có đơn vị — như TextInput, căn phải, hậu tố 13px --faint ở mép phải (đệm phải 46).
 * km: dấu phẩy thập phân ("12,35"), tối đa 2 chữ số lẻ, tối đa 99.999,99.
 */
export function UnitInput({
  value,
  onChange,
  unit,
  decimals,
  max,
  min,
  onInputError,
  resetKey,
  size = 'md',
  error,
  hint,
  className,
  onFocus,
  onBlur,
  'aria-describedby': describedByProp,
  ...rest
}: UnitInputProps) {
  const isKm = unit === 'km';
  const fractionDigits = decimals ?? (isKm ? 2 : 0);
  const upper = max ?? (isKm ? MAX_DISTANCE_KM : undefined);

  const [draft, setDraft] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  // Như MoneyInput: form đặt giá trị mới từ ngoài (hoặc đổi `resetKey` khi đặt lại đúng số cũ) → bỏ chữ đang gõ và lỗi cũ.
  const [knownValue, setKnownValue] = useState<number | null>(value);
  const [knownResetKey, setKnownResetKey] = useState(resetKey);
  if (!Object.is(value, knownValue) || !Object.is(resetKey, knownResetKey)) {
    setKnownValue(value);
    setKnownResetKey(resetKey);
    setDraft(null);
    setLocalError(null);
  }

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
  // Ô bị gỡ khỏi form (xoá bậc, đóng nhóm) khi đang báo lỗi → báo hết lỗi, kẻo form bị chặn lưu mãi vì một ô không còn nữa.
  useEffect(
    () => () => {
      if (lastReported.current !== null) {
        lastReported.current = null;
        reportRef.current?.(null);
      }
    },
    [],
  );

  const valueRef = useRef(value);
  valueRef.current = value;

  const shownError = localError ?? error;
  const f = useFieldIds({ error: shownError, hint }, describedByProp);
  // Ô có phần lẻ (km): rời ô hiện KHÔNG ngăn nghìn, đúng như formatKm ("2500", "12345,6") — "2.500" là dạng mơ hồ ô km
  // từ chối, nên chữ chép từ ô này dán sang ô km khác vẫn đọc được. Ô số nguyên (phút, lần) thì "1.440" không mơ hồ, giữ ngăn nghìn.
  const text = draft ?? (value === null ? '' : formatDecimal(value, fractionDigits, fractionDigits === 0));

  function parse(raw: string): ParseResult<number | null> {
    if (isKm && decimals === undefined && max === undefined && min === undefined) return parseKm(raw);
    return parseDecimal(raw, { maxFractionDigits: fractionDigits, max: upper, min, unit });
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = stripUnit(e.target.value, unit);
    if (!ALLOWED_TYPING.test(raw)) {
      setLocalError('Chỉ nhập chữ số.');
      return;
    }
    setDraft(raw);
    const r = parse(raw);
    if (!r.ok) {
      setLocalError(r.error);
      return;
    }
    setLocalError(null);
    if (r.value !== value) {
      setKnownValue(r.value);
      onChange(r.value);
    }
  }

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    // Đang sửa: không chèn dấu chấm ngăn nghìn ("2500", không phải "2.500") để chữ trong ô không tự thành dạng mơ hồ.
    // Đổi chữ ở microtask và giữ "chọn hết" — cùng lý do như MoneyInput (input.select() gọi focus giữa chừng).
    if (draft === null) {
      const el = e.currentTarget;
      const before = el.value;
      queueMicrotask(() => {
        if (document.activeElement !== el || el.value !== before) return;
        const v = valueRef.current;
        const next = v === null ? '' : formatDecimal(v, fractionDigits, false);
        if (el.value !== next) {
          const all = el.value.length > 0 && el.selectionStart === 0 && (el.selectionEnd ?? 0) >= el.value.length;
          el.value = next;
          if (all) el.setSelectionRange(0, next.length);
        }
        setDraft((d) => d ?? next);
      });
    }
    onFocus?.(e);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    if (!localError) setDraft(null);
    onBlur?.(e);
  }

  return (
    <FieldShell error={shownError} hint={hint} errorId={f.errorId} hintId={f.hintId} className={className}>
      <span className="ui-unit">
        <input
          type="text"
          inputMode={fractionDigits > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          className={cx('ui-input', 'ui-input--right', size === 'sm' && 'ui-input--sm')}
          value={text}
          aria-invalid={f.invalid || undefined}
          aria-describedby={f.describedBy}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />
        <b className="ui-unit__suffix" aria-hidden="true">
          {unit}
        </b>
      </span>
    </FieldShell>
  );
}
