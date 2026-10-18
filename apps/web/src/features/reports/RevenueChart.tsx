import { useState } from 'react';
import type { RevenueMonthRow } from '../../api/types';
import { Card, SkeletonText } from '../../ui';
import { money } from '../payments/money';
import { axisMax, MILLION } from './chartScale';

// Biểu đồ cột đôi "Doanh số và thực thu 6 tháng" (bản vẽ C2 mục 3.4). Một trục, đơn vị triệu đồng.
// Màu: Doanh số --kind-bride (#A63D62), Thực thu --kind-event (#5B45A0) — đã chạy bộ kiểm màu (mù màu ΔE 11,8: đạt).
// Rê chuột / tiêu điểm / chạm vào một tháng → dòng đọc số ở góc phải. Bảng ẩn bên dưới là bản xem dạng bảng (số đủ từng đồng).

function trieu(v: number | null): string {
  if (v === null) return '—';
  return (v / MILLION).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

const monthNo = (period: string) => Number(period.slice(5, 7));

export interface RevenueChartProps {
  rows: RevenueMonthRow[] | null;
  error?: string | null;
}

export function RevenueChart({ rows, error }: RevenueChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const shown = rows ?? [];
  const peak = Math.max(0, ...shown.flatMap((r) => [r.sales ?? 0, r.collected ?? 0]));
  const { max, step } = axisMax(peak);
  const ticks = [4, 3, 2, 1, 0].map((i) => i * step);
  const idx = active ?? shown.length - 1;
  const cur = shown[idx];
  const h = (v: number | null) => (v === null || v <= 0 ? 0 : (v / max) * 100);

  return (
    <Card title="Doanh số và thực thu 6 tháng" subtitle="triệu đồng" className="rp-chart-card">
      {error ? (
        <p className="rp-err" role="alert">
          {error}
        </p>
      ) : rows === null ? (
        <SkeletonText lines={4} widths={['90%', '70%', '80%', '60%']} label="Đang tải biểu đồ" />
      ) : (
        <div className="rp-chart">
          <div className="rp-chart__top">
            <span className="rp-lg">
              <i className="rp-sw rp-sw--sales" aria-hidden="true" />
              Doanh số
            </span>
            <span className="rp-lg">
              <i className="rp-sw rp-sw--paid" aria-hidden="true" />
              Thực thu
            </span>
            {cur && (
              <span className="rp-readout" aria-live="polite">
                Tháng {monthNo(cur.period)} · Doanh số {trieu(cur.sales)} tr · Thực thu {trieu(cur.collected)} tr
              </span>
            )}
          </div>
          <div className="rp-bars" onMouseLeave={() => setActive(null)}>
            <div className="rp-ax" aria-hidden="true">
              {ticks.map((t) => (
                <span key={t}>{trieu(t)}</span>
              ))}
            </div>
            <div className="rp-plot">
              {ticks.slice(0, 4).map((t) => (
                <span key={t} className="rp-gl" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden="true" />
              ))}
              {shown.map((r, i) => (
                <button
                  key={r.period}
                  type="button"
                  className={i === idx ? 'rp-g rp-g--on' : 'rp-g'}
                  aria-label={`Tháng ${monthNo(r.period)}/${r.period.slice(0, 4)}: doanh số ${money(r.sales)}, thực thu ${money(r.collected)}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  <i className="rp-bar rp-sw--sales" style={{ height: `${h(r.sales)}%` }} />
                  <i className="rp-bar rp-sw--paid" style={{ height: `${h(r.collected)}%` }} />
                </button>
              ))}
            </div>
          </div>
          <div className="rp-xl" aria-hidden="true">
            <span />
            {shown.map((r) => (
              <span key={r.period}>T{monthNo(r.period)}</span>
            ))}
          </div>
          <table className="sr-only">
            <caption>Doanh số và thực thu 6 tháng</caption>
            <thead>
              <tr>
                <th>Tháng</th>
                <th>Doanh số</th>
                <th>Thực thu</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.period}>
                  <td>{`${monthNo(r.period)}/${r.period.slice(0, 4)}`}</td>
                  <td>{money(r.sales)}</td>
                  <td>{money(r.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
