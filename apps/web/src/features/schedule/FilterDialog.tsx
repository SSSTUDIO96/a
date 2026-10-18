// "Bộ lọc" của thanh công cụ: lọc theo thợ (membershipId — chỉ người xem cả đội) và trạng thái (status). Máy chủ lọc.
import { useState } from 'react';
import { WORK_STATUSES, WORK_STATUS_LABELS, type WorkStatus } from '@makeup/shared';
import { Button, Dialog, Select, SettingRow } from '../../ui';
import type { StaffLane } from './model';
import type { ScheduleFilter } from './useScheduleData';

export function FilterDialog({
  value,
  lanes,
  canFilterStaff,
  onApply,
  onClose,
}: {
  value: ScheduleFilter;
  lanes: StaffLane[];
  canFilterStaff: boolean;
  onApply: (f: ScheduleFilter) => void;
  onClose: () => void;
}) {
  const [membershipId, setMembershipId] = useState(value.membershipId ?? '');
  const [status, setStatus] = useState<string>(value.status ?? '');
  return (
    <Dialog
      open
      size="sm"
      title="Bộ lọc"
      onClose={onClose}
      footer={
        <>
          <Button
            onClick={() => {
              onApply({});
              onClose();
            }}
          >
            Bỏ lọc
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const next: ScheduleFilter = {};
              if (canFilterStaff && membershipId) next.membershipId = membershipId;
              if (status) next.status = status as WorkStatus;
              onApply(next);
              onClose();
            }}
          >
            Áp dụng
          </Button>
        </>
      }
    >
      {canFilterStaff && (
        <SettingRow label="Thợ" htmlFor="ws-loc-tho">
          <Select
            id="ws-loc-tho"
            value={membershipId}
            onChange={(e) => setMembershipId(e.target.value)}
            options={[{ value: '', label: 'Tất cả thợ' }, ...lanes.map((l) => ({ value: l.membershipId, label: l.name }))]}
          />
        </SettingRow>
      )}
      <SettingRow label="Trạng thái" htmlFor="ws-loc-tt">
        <Select
          id="ws-loc-tt"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[{ value: '', label: 'Mọi trạng thái' }, ...WORK_STATUSES.map((s) => ({ value: s, label: WORK_STATUS_LABELS[s] }))]}
        />
      </SettingRow>
    </Dialog>
  );
}
