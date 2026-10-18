import { useId } from 'react';
import type { PayRateRow as Row, Vnd } from '../../api/types';
import { MoneyInput, PersonChip, PersonChipList } from '../../ui';

// Một hàng tiền công (C2 1.3): tên bậc · "n thợ" / các PersonChip của thợ thuộc bậc / ô tiền + "Cập nhật dd/mm/yyyy".
export interface PayRateRowProps {
  row: Row;
  value: Vnd | null;
  readOnly: boolean;
  disabled: boolean;
  error: string | null;
  updatedText: string;
  onChange: (v: Vnd | null) => void;
  onInputError: (msg: string | null) => void;
}

export function PayRateRow({ row, value, readOnly, disabled, error, updatedText, onChange, onInputError }: PayRateRowProps) {
  const nameId = useId();
  const noteId = useId();
  return (
    <div className="st-pr" role="group" aria-labelledby={nameId}>
      <div className="st-pr__who">
        <div className="st-pr__tier">
          <span id={nameId}>{row.tier.name}</span> <span className="st-pr__n">{`${row.staff.length} thợ`}</span>
        </div>
        {row.staff.length > 0 ? (
          <PersonChipList label={`Thợ ở bậc ${row.tier.name}`}>
            {row.staff.map((s) => (
              <PersonChip key={s.membershipId} name={s.displayName} avatarUrl={s.avatarUrl} initials={s.initials} colorKey={s.membershipId} />
            ))}
          </PersonChipList>
        ) : (
          <span className="st-pr__none">Chưa có thợ ở bậc này</span>
        )}
      </div>
      <div className="st-pr__in">
        <MoneyInput
          className={value === null ? 'st-pr__money st-pr__money--unset' : 'st-pr__money'}
          aria-label={`Tiền công bậc ${row.tier.name}`}
          aria-describedby={noteId}
          placeholder="Chưa đặt"
          value={value}
          disabled={readOnly || disabled}
          error={error}
          onChange={onChange}
          onInputError={onInputError}
        />
        <small id={noteId} className="st-pr__note">
          {updatedText}
        </small>
      </div>
    </div>
  );
}
