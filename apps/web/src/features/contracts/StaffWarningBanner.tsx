import { Tooltip } from '../../ui';
import { IconClock, IconWarn } from './icons';
import type { StaffNameSource, StaffNaming } from '../../ui/staffName';
import type { LineWarning } from './model';

// Dải cảnh báo thợ trong thẻ dòng (bản vẽ 4.3): đỏ "Trùng giờ …" / xám "Giữ chỗ nháp ở HĐ-…" (không chặn, quyết định
// 15:14) / vàng "{tên} có lịch trong ngày · n ca".
// Chi tiết (giờ, tên ca, khách) chỉ nằm trong tooltip "?".
// personOf: tên hiển thị + họ tên của thợ (máy chủ gửi cả hai ở thợ của hợp đồng và ô chọn thợ) → tên ngắn theo hàm chung.
// naming: sổ thợ của màn (R2) — hai thợ trùng tên ngắn thì dải cảnh báo ghi tên đầy đủ, đúng như hàng thợ và Lịch.
export function StaffWarningBanner({
  warnings,
  personOf,
  naming,
}: {
  warnings: LineWarning[];
  personOf: (membershipId: string) => StaffNameSource;
  naming: StaffNaming;
}) {
  if (warnings.length === 0) return null;
  return (
    <>
      {warnings.map((w) => {
        const person = personOf(w.membershipId);
        const name = person.displayName;
        // Tên ngắn theo hàm chung (M3 + R2): như staffShortName, trùng tên ngắn với người khác trong sổ → tên đầy đủ.
        const short = naming.shortName({ ...person, membershipId: w.membershipId });
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
        if (w.level === 'DRAFT_HOLD') {
          const codes = (w.holdCodes ?? []).join(', ');
          return (
            <div key={w.membershipId} className="ct-wb ct-wb--hold" role="status" data-muc="DRAFT_HOLD">
              <IconClock />
              <span className="ct-wb__t">
                {short} · Giữ chỗ nháp ở {codes}
                {w.holdSameDayOnly ? ' · cùng ngày, khác giờ' : ''}
              </span>
              <Tooltip
                label={`Giữ chỗ nháp của ${name}`}
                text={`${detail}. Hợp đồng kia còn là nháp nên chưa chặn lịch — vẫn xác nhận được. Hợp đồng nào xác nhận sau sẽ bị máy chủ báo trùng.`}
              />
            </div>
          );
        }
        return (
          <div key={w.membershipId} className="ct-wb ct-wb--yel" role="status" data-muc="SAME_DAY">
            <IconClock />
            <span className="ct-wb__t">
              {short} có lịch trong ngày · {w.count} ca
            </span>
            <Tooltip label={`Lịch trong ngày của ${name}`} text={`${detail}. Không trùng giờ, chỉ để biết.`} />
          </div>
        );
      })}
    </>
  );
}
