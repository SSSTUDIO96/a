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
  size?: 'md' | 'sm';
  className?: string;
}

const ALLOWED_TYPING = /^[\d.,\s  ]*$/u;

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
  const text = draft ?? (value === null ? '' : formatDecimal(value, fractionDigits));

  function parse(raw: string): ParseResult<number | null> {
    if (isKm && decimals === undefined && max === undefined && min === undefined) return parseKm(raw);
    return parseDecimal(raw, { maxFractionDigits: fractionDigits, max: upper, min, unit });
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
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
    if (r.value !== value) onChange(r.value);
  }

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    if (draft === null) setDraft(value === null ? '' : formatDecimal(value, fractionDigits));
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
