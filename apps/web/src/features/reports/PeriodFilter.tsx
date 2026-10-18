import type { ReactNode } from 'react';
import { Card, Segmented, Select } from '../../ui';
import { convertPeriod, periodOptions, type Period, type PeriodKind } from './period';

export interface PeriodFilterProps {
  period: Period;
  onChange: (p: Period) => void;
  /** Bộ lọc thêm dưới kỳ (Sổ thu: Cách trả, Loại phiếu). */
  children?: ReactNode;
}

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'month', label: 'Tháng' },
  { value: 'quarter', label: 'Quý' },
  { value: 'year', label: 'Năm' },
];

// Thẻ "Bộ lọc" cột trái màn Báo cáo — Kỳ = Tháng · Quý · Năm + chọn kỳ cụ thể.
export function PeriodFilter({ period, onChange, children }: PeriodFilterProps) {
  const options = periodOptions(period.kind);
  // Kỳ đang xem có thể không nằm trong danh sách gợi ý (mở đường dẫn cũ) — vẫn hiện đúng kỳ đó.
  const all = options.some((o) => o.key === period.key) ? options : [period, ...options];
  return (
    <Card title="Bộ lọc" className="rp-filter">
      <div className="rp-grp" id="rp-ky">
        Kỳ
      </div>
      <Segmented<PeriodKind>
        size="sm"
        block
        aria-labelledby="rp-ky"
        options={KINDS}
        value={period.kind}
        onChange={(k) => onChange(convertPeriod(period, k))}
      />
      <Select
        className="rp-select"
        aria-label="Chọn kỳ"
        options={all.map((p) => ({ value: p.key, label: p.label }))}
        value={period.key}
        onChange={(e) => {
          const next = all.find((p) => p.key === e.target.value);
          if (next) onChange(next);
        }}
      />
      {children}
    </Card>
  );
}
