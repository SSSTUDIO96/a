import { MoneyInput, Segmented, UnitInput, formatVnd, type SegmentedOption } from '../../ui';
import type { TravelFeeMode } from '../../api/types';
import { TRAVEL_MODE_LABEL, travelFormula, type ContractLineView, type TravelDraft } from './model';

// Hàng "Di chuyển *" của dòng làm tại nhà / nơi khác (bản vẽ 4.3). Số tiền bên phải và dòng công thức lấy từ quote.
export interface TravelControlProps {
  value: TravelDraft;
  onChange: (v: TravelDraft) => void;
  // Tổ chức có cài bậc phí theo khoảng cách thì mới bày "Theo bậc".
  hasTiers: boolean;
  // Bán kính miễn phí > 0: cách Cố định cũng cần số km để xét.
  fixedNeedsKm: boolean;
  quoteTravel: ContractLineView<string | null> | null;
  disabled: boolean;
  errors: { distanceKm?: string; amount?: string; line?: string };
  idPrefix: string;
  resetKey?: number;
}

export function TravelControl({ value, onChange, hasTiers, fixedNeedsKm, quoteTravel, disabled, errors, idPrefix, resetKey }: TravelControlProps) {
  const modes: TravelFeeMode[] = ['FIXED', 'PER_KM', ...(hasTiers || value.mode === 'TIERED' ? (['TIERED'] as const) : []), 'MANUAL'];
  const options: SegmentedOption<TravelFeeMode>[] = modes.map((m) => ({ value: m, label: TRAVEL_MODE_LABEL[m] }));
  const showKm = value.mode === 'PER_KM' || value.mode === 'TIERED' || (value.mode === 'FIXED' && (fixedNeedsKm || value.distanceKm !== null));
  const formula = travelFormula(quoteTravel);
  return (
    <div className="ct-dcr">
      <div className="ct-fl">
        <Segmented
          size="sm"
          aria-label="Cách tính phí di chuyển"
          options={options}
          value={value.mode}
          disabled={disabled}
          onChange={(mode) => onChange({ ...value, mode, amount: mode === 'MANUAL' ? value.amount : null })}
        />
        {showKm && (
          <UnitInput
            id={`${idPrefix}-km`}
            className="ct-km"
            size="sm"
            unit="km"
            aria-label="Số km một chiều"
            value={value.distanceKm}
            onChange={(distanceKm) => onChange({ ...value, distanceKm })}
            resetKey={resetKey}
            disabled={disabled}
            error={errors.distanceKm}
          />
        )}
        {value.mode === 'MANUAL' && (
          <MoneyInput
            id={`${idPrefix}-tien`}
            className="ct-manual"
            size="sm"
            aria-label="Phí di chuyển nhập tay"
            value={value.amount}
            onChange={(amount) => onChange({ ...value, amount })}
            resetKey={resetKey}
            disabled={disabled}
            error={errors.amount}
          />
        )}
        <b className="ct-amt ct-num ct-pend">{quoteTravel ? formatVnd(quoteTravel.lineTotal) : '—'}</b>
      </div>
      {formula && <div className="ct-fx ct-pend">{formula}</div>}
      {errors.line && <div className="ct-err">{errors.line}</div>}
    </div>
  );
}
