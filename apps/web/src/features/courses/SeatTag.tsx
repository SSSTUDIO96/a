import { StatusTag } from '../../ui';
import { seatInfo } from './logic';

// Nhãn chỗ của lớp (bản vẽ C3 mục 2.1): còn chỗ · Sắp đầy · Hết chỗ — theo seatState() dùng chung với máy chủ.
export function SeatTag({ enrolledCount, capacity }: { enrolledCount: number; capacity: number }) {
  const s = seatInfo(enrolledCount, capacity);
  return (
    <StatusTag tone={s.tone} className="kc-seat" title={`${enrolledCount}/${capacity} học viên`}>
      {s.label}
    </StatusTag>
  );
}

// Thanh đầy: còn chỗ --accent, sắp đầy --warn, hết chỗ --faint.
export function SeatBar({ enrolledCount, capacity }: { enrolledCount: number; capacity: number }) {
  const s = seatInfo(enrolledCount, capacity);
  return (
    <div
      className={`kc-bar kc-bar--${s.state.toLowerCase().replace('_', '-')}`}
      role="meter"
      aria-label="Số đã ghi danh"
      aria-valuemin={0}
      aria-valuemax={capacity}
      aria-valuenow={Math.min(enrolledCount, capacity)}
      aria-valuetext={`${enrolledCount}/${capacity} học viên`}
    >
      <i style={{ width: `${s.percent}%` }} />
    </div>
  );
}
