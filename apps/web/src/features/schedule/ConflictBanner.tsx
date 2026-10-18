// Dải đỏ trùng lịch (bản vẽ C 4.1, luật 409): "Trùng lịch: Thu Hà đã có lịch L-0123 06:00–07:30" + nút "Đổi thợ", "Đổi giờ".
// Hộp thoại đang nhập giữ nguyên; lưới tô viền đỏ các ca trong danh sách (theo appointmentId).
import type { AppointmentConflict } from '../../api/types';
import { Button } from '../../ui';
import { IconWarn } from './icons';
import { hhmm } from './time';

export function conflictLine(c: AppointmentConflict): string {
  return `${c.staffName} đã có lịch ${c.code} ${hhmm(c.startsAt)}–${hhmm(c.endsAt)}`;
}

export function ConflictBanner({
  conflicts,
  message,
  onChangeStaff,
  onChangeTime,
}: {
  conflicts: readonly AppointmentConflict[];
  // Lời máy chủ khi danh sách rỗng (hai yêu cầu đua nhau, máy chủ chưa kịp tra lại).
  message?: string;
  onChangeStaff?: () => void;
  onChangeTime?: () => void;
}) {
  return (
    <div className="ws-conf" role="alert" data-testid="bang-trung-lich">
      <IconWarn />
      <div className="ws-conf__t">
        {conflicts.length === 0 ? (
          <span>{message ?? 'Trùng lịch.'}</span>
        ) : (
          conflicts.map((c) => (
            <span key={`${c.appointmentId}-${c.membershipId}`}>
              <b>Trùng lịch:</b> {conflictLine(c)}
            </span>
          ))
        )}
      </div>
      {(onChangeStaff || onChangeTime) && (
        <div className="ws-conf__acts">
          {onChangeStaff && (
            <Button size="sm" onClick={onChangeStaff}>
              Đổi thợ
            </Button>
          )}
          {onChangeTime && (
            <Button size="sm" onClick={onChangeTime}>
              Đổi giờ
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
