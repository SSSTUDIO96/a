// Ô ngày kiểu Việt Nam — hiện và gõ dd/mm/yyyy, không phụ thuộc ngôn ngữ trình duyệt (ô <input type="date"> gốc
// hiện MM/DD/YYYY trên trình duyệt tiếng Anh, dễ đặt nhầm ngày). Giá trị ra/vào là "YYYY-MM-DD".
// Gõ sai thì báo lỗi có chữ, không tự đoán. Nút lịch bên phải mở bảng chọn ngày (tuần bắt đầu Thứ Hai).
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { cx } from './cx';
import { FieldShell, useFieldIds, type FieldMessages } from './Field';
import { IconBack, IconCalendar, IconNext } from './icons';
import './ui.css';
import './DateInput.css';

// ---------------- Đọc / ghi chữ ngày ----------------
export type DateParse = { ok: true; value: string | null } | { ok: false; error: string };

const pad = (n: number) => String(n).padStart(2, '0');

export function isRealDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "24/10/2026" (cũng nhận dấu . hoặc -, ngày/tháng 1 chữ số, hoặc 8 chữ số liền "24102026") → "2026-10-24". */
export function parseVnDate(raw: string): DateParse {
  const s = raw.trim();
  if (s === '') return { ok: true, value: null };
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(s);
  if (!m) return { ok: false, error: 'Gõ ngày theo dạng ngày/tháng/năm, ví dụ 24/10/2026.' };
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!isRealDate(y, mo, d)) return { ok: false, error: `Không có ngày ${pad(d)}/${pad(mo)}/${y}.` };
  return { ok: true, value: `${y}-${pad(mo)}-${pad(d)}` };
}

/** "2026-10-24" → "24/10/2026"; chuỗi không đúng dạng → "". */
export function formatVnDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// ---------------- Bảng nổi dùng chung cho DateInput và TimeInput ----------------
// Bảng nằm TRONG cây DOM của ô (không cổng ra body) để Dialog không kéo tiêu điểm về; dùng position: fixed
// theo toạ độ ô nên không bị thân hộp thoại (overflow: auto) cắt. Esc đóng bảng trước khi tới Dialog.
export function usePickerPopover(anchorRef: RefObject<HTMLElement | null>, width: number) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const popRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(width, vw - 16);
    const left = Math.min(Math.max(8, r.right - w), vw - w - 8);
    const h = popRef.current?.offsetHeight ?? 0;
    const below = r.bottom + 6;
    const top = h > 0 && below + h > vh - 8 && r.top - 6 - h >= 8 ? r.top - 6 - h : below;
    setStyle({ position: 'fixed', top, left, width: w });
  }, [anchorRef, width]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onScroll = () => place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !anchorRef.current?.contains(t)) setOpen(false);
    };
    const pop = popRef.current;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        setOpen(false);
        anchorRef.current?.querySelector<HTMLElement>('button')?.focus();
      }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('pointerdown', onDown);
    pop?.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('pointerdown', onDown);
      pop?.removeEventListener('keydown', onKey);
    };
  }, [open, place, anchorRef]);

  return { open, setOpen, style, popRef };
}

// ---------------- Lịch tháng ----------------
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function todayIso(): string {
  // Ngày hôm nay theo giờ Việt Nam (UTC+7) — đánh dấu ô "hôm nay" trong bảng.
  const w = new Date(Date.now() + 7 * 3600_000);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`;
}

function monthDays(y: number, m: number): (string | null)[] {
  const first = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= count; d += 1) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function MonthPicker({ value, onPick }: { value: string | null; onPick: (iso: string) => void }) {
  const base = value ?? todayIso();
  const [ym, setYm] = useState<[number, number]>([Number(base.slice(0, 4)), Number(base.slice(5, 7))]);
  const [y, m] = ym;
  const today = todayIso();
  const shift = (n: number) => {
    const t = y * 12 + (m - 1) + n;
    setYm([Math.floor(t / 12), (t % 12) + 1]);
  };
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (gridRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? gridRef.current?.querySelector<HTMLElement>('button'))?.focus();
  }, []);
  return (
    <>
      <div className="ui-pick__head">
        <button type="button" className="ui-pick__nav" aria-label="Tháng trước" onClick={() => shift(-1)}>
          <IconBack />
        </button>
        <b>
          Tháng {m}, {y}
        </b>
        <button type="button" className="ui-pick__nav" aria-label="Tháng sau" onClick={() => shift(1)}>
          <IconNext />
        </button>
      </div>
      <div className="ui-cal" ref={gridRef}>
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={cx('ui-cal__wd', i >= 5 && 'is-we')} aria-hidden="true">
            {w}
          </span>
        ))}
        {monthDays(y, m).map((iso, i) =>
          iso ? (
            <button
              type="button"
              key={iso}
              className={cx('ui-cal__d', iso === today && 'is-today')}
              aria-pressed={iso === value}
              aria-label={formatVnDate(iso)}
              onClick={() => onPick(iso)}
            >
              {Number(iso.slice(8))}
            </button>
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
    </>
  );
}

// ---------------- Ô ngày ----------------
type NativeInput = Omit<ComponentPropsWithRef<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'size'>;

export interface DateInputProps extends NativeInput, FieldMessages {
  /** "YYYY-MM-DD" hoặc null (trống). */
  value: string | null;
  /** Chỉ gọi khi chữ trong ô đọc được thành ngày có thật (null khi xoá trắng). */
  onChange: (value: string | null) => void;
  /** Báo lỗi gõ của ô (để form khoá nút lưu), null khi hết lỗi. */
  onInputError?: (message: string | null) => void;
  size?: 'md' | 'sm';
  className?: string;
}

export function DateInput({
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
}: DateInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const pop = usePickerPopover(wrapRef, 280);
  const popId = useId();

  const reportRef = useRef(onInputError);
  useEffect(() => {
    reportRef.current = onInputError;
  });
  useEffect(() => {
    reportRef.current?.(localError);
  }, [localError]);

  const shownError = localError ?? error;
  const f = useFieldIds({ error: shownError, hint }, describedByProp);
  const text = draft ?? formatVnDate(value);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (!/^[\d/.\-\s]*$/.test(raw)) {
      setLocalError('Chỉ gõ chữ số và dấu /.');
      return;
    }
    setDraft(raw);
    const r = parseVnDate(raw);
    if (r.ok) {
      setLocalError(null);
      if (r.value !== value) onChange(r.value);
    }
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    if (draft !== null) {
      const r = parseVnDate(draft);
      if (r.ok) setDraft(null);
      else setLocalError(r.error);
    }
    onBlur?.(e);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && draft !== null) {
      const r = parseVnDate(draft);
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
          placeholder="dd/mm/yyyy"
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
          aria-label="Mở lịch chọn ngày"
          aria-expanded={pop.open}
          aria-controls={pop.open ? popId : undefined}
          disabled={disabled}
          onClick={() => pop.setOpen((v) => !v)}
        >
          <IconCalendar />
        </button>
        {pop.open && (
          <div ref={pop.popRef} id={popId} role="dialog" aria-label="Chọn ngày" className="ui-pick" style={pop.style}>
            <MonthPicker
              value={value}
              onPick={(iso) => {
                setDraft(null);
                setLocalError(null);
                if (iso !== value) onChange(iso);
                pop.setOpen(false);
                wrapRef.current?.querySelector('input')?.focus();
              }}
            />
          </div>
        )}
      </span>
    </FieldShell>
  );
}
