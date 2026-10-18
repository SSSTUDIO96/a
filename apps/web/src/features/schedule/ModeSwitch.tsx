// Nhóm nút chuyển chế độ: Thợ × ngày (C) · Ngày (B) · Cột thợ (A). Mặc định C — xem model.ts DEFAULT_MODE.
import { Segmented } from '../../ui';
import { MODE_OPTIONS, type ScheduleMode } from './model';

export function ModeSwitch({ mode, onMode, phone }: { mode: ScheduleMode; onMode: (m: ScheduleMode) => void; phone: boolean }) {
  return (
    <Segmented<ScheduleMode>
      aria-label="Chế độ xem lịch"
      size={phone ? 'md' : 'sm'}
      block={phone}
      value={mode}
      onChange={onMode}
      options={MODE_OPTIONS.map((o) => ({
        value: o.value,
        label: (
          <span title={o.tip} data-mode={o.value}>
            {phone ? o.short : o.label}
          </span>
        ),
      }))}
      className="ws-modes"
    />
  );
}
