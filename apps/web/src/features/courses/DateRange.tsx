import { DateInput, TimeInput } from '../../ui';

// Hai ô ngày "bắt đầu → kết thúc" và hai ô giờ "từ – đến" (bản vẽ C3 mục 2.2). Lỗi chung hiện ngay dưới cặp ô.
export function DateRange({
  start,
  end,
  onChange,
  error,
  onInputError,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  error?: string;
  onInputError: (key: 'start' | 'end', message: string | null) => void;
}) {
  return (
    <div className="ui-field kc-range-field">
      <div className="kc-range">
        <DateInput
          value={start}
          aria-label="Ngày bắt đầu"
          aria-invalid={error ? true : undefined}
          onChange={(v) => onChange(v, end)}
          onInputError={(m) => onInputError('start', m)}
        />
        <span className="kc-range__sep" aria-hidden="true">
          →
        </span>
        <DateInput
          value={end}
          aria-label="Ngày kết thúc"
          aria-invalid={error ? true : undefined}
          onChange={(v) => onChange(start, v)}
          onInputError={(m) => onInputError('end', m)}
        />
      </div>
      {error && (
        <div className="ui-field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export function TimeRange({
  start,
  end,
  onChange,
  error,
  onInputError,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  error?: string;
  onInputError: (key: 'start' | 'end', message: string | null) => void;
}) {
  return (
    <div className="ui-field kc-range-field">
      <div className="kc-range">
        <TimeInput
          value={start}
          aria-label="Giờ bắt đầu"
          aria-invalid={error ? true : undefined}
          onChange={(v) => onChange(v, end)}
          onInputError={(m) => onInputError('start', m)}
        />
        <span className="kc-range__sep" aria-hidden="true">
          –
        </span>
        <TimeInput
          value={end}
          aria-label="Giờ kết thúc"
          aria-invalid={error ? true : undefined}
          onChange={(v) => onChange(start, v)}
          onInputError={(m) => onInputError('end', m)}
        />
      </div>
      {error && (
        <div className="ui-field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
