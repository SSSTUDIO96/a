// Nút đổi trạng thái lịch — chỉ hiện các bước có trong STATUS_TRANSITIONS (packages/shared, cùng bảng máy chủ dùng).
// Huỷ bắt buộc lý do: bấm "Huỷ lịch" mở ô lý do ngay dưới (không chồng thêm hộp thoại thứ hai).
import { useState } from 'react';
import type { WorkStatus } from '@makeup/shared';
import { Button, Textarea } from '../../ui';
import { cx } from './parts';
import { nextStatuses, TRANSITION_LABELS } from './model';

export function StatusActions({
  status,
  busy,
  disabled,
  reasonError,
  onChange,
}: {
  status: WorkStatus;
  busy: WorkStatus | null;
  disabled?: boolean;
  reasonError?: string | null;
  onChange: (to: WorkStatus, reason?: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const steps = nextStatuses(status);
  if (steps.length === 0) return null;

  return (
    <div className="ws-status">
      <div className="ws-status__btns">
        {steps.map((to) => (
          <Button
            key={to}
            size="sm"
            variant={to === 'CANCELLED' || to === 'NO_SHOW' ? 'default' : 'primary'}
            className={cx((to === 'CANCELLED' || to === 'NO_SHOW') && 'ws-btn-danger')}
            loading={busy === to}
            disabled={disabled || (busy !== null && busy !== to)}
            aria-expanded={to === 'CANCELLED' ? asking : undefined}
            onClick={() => {
              if (to === 'CANCELLED') setAsking((v) => !v);
              else onChange(to);
            }}
          >
            {TRANSITION_LABELS[to]}
          </Button>
        ))}
      </div>
      {asking && (
        <div className="ws-status__reason">
          <label htmlFor="ws-ly-do-huy" className="ws-label">
            Lý do huỷ<span className="ui-req" aria-label="bắt buộc">*</span>
          </label>
          <Textarea
            id="ws-ly-do-huy"
            value={reason}
            maxLength={500}
            onChange={(e) => {
              setReason(e.target.value);
              setLocalError(null);
            }}
            error={localError ?? reasonError}
          />
          <div className="ws-status__btns">
            <Button size="sm" onClick={() => setAsking(false)}>
              Thôi
            </Button>
            <Button
              size="sm"
              className="ws-btn-danger"
              loading={busy === 'CANCELLED'}
              disabled={disabled}
              onClick={() => {
                if (!reason.trim()) {
                  setLocalError('Huỷ lịch phải ghi lý do');
                  return;
                }
                onChange('CANCELLED', reason.trim());
              }}
            >
              Xác nhận huỷ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
