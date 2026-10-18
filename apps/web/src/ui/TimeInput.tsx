// Ô giờ 24 giờ "HH:MM" — không phụ thuộc ngôn ngữ trình duyệt (ô <input type="time"> gốc hiện AM/PM trên trình duyệt
// tiếng Anh). Gõ tay được phút bất kỳ ("5:07", "0507", "5h30"); bảng chọn có cột giờ 00–23 và cột phút bước 5.
// Gõ sai thì báo lỗi có chữ, không tự đoán.
import { useEffect, useId, useRef, useState, type ChangeEvent, type ComponentPropsWithRef, type FocusEvent, type KeyboardEvent } from 'react';
import { cx } from './cx';
import { usePickerPopover } from './DateInput';
import { FieldShell, useFieldIds, type FieldMessages } from './Field';
import { IconClock } from './icons';
import './ui.css';
import './DateInput.css';

export type TimeParse = { ok: true; value: string | null } | { ok: false; error: string };

const pad = (n: number) => String(n).padStart(2, '0');

/** "5:00" → "05:00"; nhận "05:30", "5.30", "5h30", "5h", "0530", "530", "5" (giờ chẵn). Giờ 00–23, phút 00–59. */
export function parseTime(raw: string): TimeParse {
  const s = raw.trim().toLowerCase();
  if (s === '') return { ok: true, value: null };
  const m = /^(\d{1,2})(?:[:.h](\d{1,2})?)?$/.exec(s) ?? /^(\d{1,2})(\d{2})$/.exec(s);
  if (!m) return { ok: false, error: 'Gõ giờ theo dạng giờ:phút, ví dụ 05:30.' };
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (m[2] !== undefined && m[2].length === 1 && /[:.h]\d$/.test(s)) {
    return { ok: false, error: 'Phút phải có 2 chữ số, ví dụ 05:05.' };
  }
  if (h > 23 || min > 59) return { ok: false, error: `Không có giờ ${pad(h)}:${pad(min)} (từ 00:00 đến 23:59).` };
  return { ok: true, value: `${pad(h)}:${pad(min)}` };
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

type NativeInput = Omit<ComponentPropsWithRef<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'size'>;

export interface TimeInputProps extends NativeInput, FieldMessages {
  /** "HH:MM" (24 giờ) hoặc null. */
  value: string | null;
  /** Chỉ gọi khi chữ trong ô đọc được thành giờ hợp lệ (null khi xoá trắng). */
  onChange: (value: string | null) => void;
  onInputError?: (message: string | null) => void;
  size?: 'md' | 'sm';
  className?: string;
}

export function TimeInput({
  value,
  onChange,
  onInputError,
  size = 'md',
  error,
  hint,
  className,
  disabled,
  onBlur,
  'aria-describedby': describedByProp,
  ...rest
}: TimeInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const pop = usePickerPopover(wrapRef, 200);
  const popId = useId();
  const label = rest['aria-label'] ?? 'giờ';

  const reportRef = useRef(onInputError);
  useEffect(() => {
    reportRef.current = onInputError;
  });
  useEffect(() => {
    reportRef.current?.(localError);
  }, [localError]);

  const shownError = localError ?? error;
  const f = useFieldIds({ error: shownError, hint }, describedByProp);
  const text = draft ?? value ?? '';
  const [hh, mm] = value ? value.split(':') : [undefined, undefined];

  // Mở bảng: cuộn cột giờ tới giờ đang chọn (chưa có thì 08) — chỉ cuộn trong cột, không cuộn trang.
  useEffect(() => {
    if (!pop.open) return;
    const opt = pop.popRef.current?.querySelector<HTMLElement>('[data-start]');
    const col = opt?.parentElement;
    if (opt && col) col.scrollTop = opt.offsetTop - col.clientHeight / 2 + opt.offsetHeight / 2;
    opt?.focus({ preventScroll: true });
  }, [pop.open, pop.popRef]);

  function commit(next: string) {
    setDraft(null);
    setLocalError(null);
    if (next !== value) onChange(next);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (!/^[\d:.hH\s]*$/.test(raw)) {
      setLocalError('Chỉ gõ chữ số và dấu :.');
      return;
    }
    setDraft(raw);
    const r = parseTime(raw);
    if (r.ok) {
      setLocalError(null);
      if (r.value !== value) onChange(r.value);
    }
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    if (draft !== null) {
      const r = parseTime(draft);
      if (r.ok) setDraft(null);
      else setLocalError(r.error);
    }
    onBlur?.(e);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && draft !== null) {
      const r = parseTime(draft);
      if (!r.ok) {
        e.preventDefault();
        setLocalError(r.error);
      }
    } else if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      pop.setOpen(true);
    }
  }

  return (
    <FieldShell error={shownError} hint={hint} errorId={f.errorId} hintId={f.hintId} className={className}>
      <span className="ui-pickfield" ref={wrapRef}>
        <input
          {...rest}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="hh:mm"
          className={cx('ui-input', 'ui-pickfield__input', 'num', size === 'sm' && 'ui-input--sm')}
          aria-invalid={f.invalid || undefined}
          aria-describedby={f.describedBy}
          disabled={disabled}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="ui-pickfield__btn"
          aria-label={`Chọn ${label.toLocaleLowerCase('vi')}`}
          aria-expanded={pop.open}
          aria-controls={pop.open ? popId : undefined}
          disabled={disabled}
          onClick={() => pop.setOpen((v) => !v)}
        >
          <IconClock />
        </button>
        {pop.open && (
          <div ref={pop.popRef} id={popId} role="dialog" aria-label={`Chọn ${label.toLocaleLowerCase('vi')}`} className="ui-pick" style={pop.style}>
            <div className="ui-clock">
              <div className="ui-clock__col" role="group" aria-label="Giờ">
                {HOURS.map((h) => (
                  <button
                    type="button"
                    key={h}
                    className="ui-clock__opt num"
                    aria-pressed={h === hh}
                    data-start={h === (hh ?? '08') || undefined}
                    onClick={() => commit(`${h}:${mm ?? '00'}`)}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <div className="ui-clock__col" role="group" aria-label="Phút">
                {MINUTES.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className="ui-clock__opt num"
                    aria-pressed={m === mm}
                    onClick={() => {
                      commit(`${hh ?? '08'}:${m}`);
                      pop.setOpen(false);
                      wrapRef.current?.querySelector('input')?.focus();
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </span>
    </FieldShell>
  );
}
