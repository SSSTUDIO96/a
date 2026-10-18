// Thanh công cụ lịch (bản vẽ C 4.1), từ trái sang: nhóm tuần "‹ 19 – 25/10/2026 › Hôm nay" · "+ Thêm lịch" ·
// nhãn đỏ "n ca trùng lịch" (chỉ khi đang có dải trùng lịch) · khoảng trống · nút chuyển chế độ · "Bộ lọc".
// Điện thoại (bản mẫu v2-lich-C-mobile): nút chuyển chế độ chia đều cả hàng ở trên; "+ Lịch" nằm ở thanh trên.
import { Button, IconBack, IconFilter, IconNext, IconPlus, IconWarn } from '../../ui';
import { ModeSwitch } from './ModeSwitch';
import type { ScheduleMode } from './model';
import { cx } from './parts';

export function Toolbar({
  mode,
  onMode,
  label,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  onToday,
  canAdd,
  onAdd,
  conflictCount,
  filterCount,
  onFilter,
  phone,
}: {
  mode: ScheduleMode;
  onMode: (m: ScheduleMode) => void;
  label: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  canAdd: boolean;
  onAdd: () => void;
  conflictCount: number;
  filterCount: number;
  onFilter: () => void;
  phone: boolean;
}) {
  const nav = (
    <div className="ws-pill">
      <Button variant="ghost" size="sm" icon={<IconBack />} aria-label={prevLabel} onClick={onPrev} />
      <span className="ws-pill__lbl num" aria-live="polite">
        {label}
      </span>
      <Button variant="ghost" size="sm" icon={<IconNext />} aria-label={nextLabel} onClick={onNext} />
      <button type="button" className="ws-pill__today" onClick={onToday}>
        Hôm nay
      </button>
    </div>
  );
  const conflict =
    conflictCount > 0 ? (
      <span className="ws-confl" role="status">
        <IconWarn />
        {phone ? `${conflictCount} trùng` : `${conflictCount} ca trùng lịch`}
      </span>
    ) : null;
  const filter = (
    <Button
      size={phone ? 'sm' : 'md'}
      icon={<IconFilter />}
      onClick={onFilter}
      aria-label={phone ? (filterCount > 0 ? `Bộ lọc, đang lọc ${filterCount}` : 'Bộ lọc') : undefined}
      className={cx(filterCount > 0 && 'ws-filter-on')}
    >
      {phone ? (filterCount > 0 ? String(filterCount) : undefined) : filterCount > 0 ? `Bộ lọc · ${filterCount}` : 'Bộ lọc'}
    </Button>
  );

  if (phone) {
    return (
      <div className="ws-tools ws-tools--phone">
        <ModeSwitch mode={mode} onMode={onMode} phone />
        <div className="ws-tools__row">
          {nav}
          {conflict}
          <span className="ws-sp" />
          {filter}
        </div>
      </div>
    );
  }
  return (
    <div className="ws-tools">
      {nav}
      {canAdd && (
        <Button variant="primary" icon={<IconPlus />} onClick={onAdd}>
          Thêm lịch
        </Button>
      )}
      {conflict}
      <span className="ws-sp" />
      <ModeSwitch mode={mode} onMode={onMode} phone={false} />
      {filter}
    </div>
  );
}
