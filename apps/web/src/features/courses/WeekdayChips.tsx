import { WEEKDAYS, WEEKDAY_NAMES, WEEKDAY_SHORT } from '@makeup/shared';
import { Chip } from '../../ui';

// Chip T2 … CN (ISO: 1 = Thứ Hai … 7 = Chủ nhật). Bấm để bật / tắt; giá trị luôn sắp theo thứ trong tuần.
export function WeekdayChips({
  value,
  onChange,
  error,
  labelledBy,
}: {
  value: readonly number[];
  onChange: (days: number[]) => void;
  error?: string;
  labelledBy?: string;
}) {
  return (
    <div className="ui-field kc-wd-field">
      <div className="kc-wd" role="group" aria-labelledby={labelledBy} aria-invalid={error ? true : undefined}>
        {WEEKDAYS.map((d) => {
          const on = value.includes(d);
          return (
            <Chip
              key={d}
              selected={on}
              aria-label={WEEKDAY_NAMES[d]}
              onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b))}
            >
              {WEEKDAY_SHORT[d]}
            </Chip>
          );
        })}
      </div>
      {error && (
        <div className="ui-field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
