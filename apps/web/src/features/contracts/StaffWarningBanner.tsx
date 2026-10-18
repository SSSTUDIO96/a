import { Tooltip } from '../../ui';
import { IconClock, IconWarn } from './icons';
import { lastName, type LineWarning } from './model';

// Dải cảnh báo thợ trong thẻ dòng (bản vẽ 4.3): đỏ "Trùng giờ …" / vàng "{tên} có lịch trong ngày · n ca".
// Chi tiết (giờ, tên ca, khách) chỉ nằm trong tooltip "?".
export function StaffWarningBanner({ warnings, nameOf }: { warnings: LineWarning[]; nameOf: (membershipId: string) => string }) {
  if (warnings.length === 0) return null;
  return (
    <>
      {warnings.map((w) => {
        const name = nameOf(w.membershipId);
        const detail = w.ranges.map((r) => `${r.start}–${r.end}${r.label ? ` ${r.label}` : ''}`).join('; ');
        if (w.level === 'OVERLAP') {
          const hours = w.ranges.map((r) => `${r.start}–${r.end}`).join(', ');
          return (
            <div key={w.membershipId} className="ct-wb ct-wb--red" role="alert" data-muc="OVERLAP">
              <IconWarn />
              <span className="ct-wb__t">
                <b>Trùng giờ {hours}</b> — hợp đồng sẽ không xác nhận được
              </span>
              <Tooltip label={`Chi tiết trùng giờ của ${name}`} text={`${name} đã có: ${detail}. Đổi thợ hoặc đổi giờ.`} />
            </div>
          );
        }
        return (
          <div key={w.membershipId} className="ct-wb ct-wb--yel" role="status" data-muc="SAME_DAY">
            <IconClock />
            <span className="ct-wb__t">
              {lastName(name)} có lịch trong ngày · {w.count} ca
            </span>
            <Tooltip label={`Lịch trong ngày của ${name}`} text={`${detail}. Không trùng giờ, chỉ để biết.`} />
          </div>
        );
      })}
    </>
  );
}
