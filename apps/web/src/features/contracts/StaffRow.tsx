import { Link } from 'react-router';
import { Avatar, Button, Tooltip, WithTooltip } from '../../ui';
import type { StaffNaming } from '../../ui/staffName';
import type { StaffAssignment } from './model';

export interface StaffPerson extends StaffAssignment {
  displayName: string;
  // Họ tên tài khoản (máy chủ gửi ở thợ của hợp đồng và ô chọn thợ). Thiếu → tên ngắn = nguyên tên hiển thị, không đoán.
  fullName?: string | null;
  initials?: string;
  avatarUrl?: string | null;
}

export interface StaffRowProps {
  people: StaffPerson[];
  // Nháp: nút "Đổi"/"Chọn thợ". Đã xác nhận: liên kết "Đổi ở Lịch" (hoặc không gì nếu dòng chưa có lịch).
  mode: 'edit' | 'locked' | 'view';
  onPick?: () => void;
  // Lý do không mở được ô chọn (chưa có giờ…) — nút khoá, lý do ở tooltip.
  pickBlockedReason?: string | null;
  scheduleHref?: string | null;
  error?: string;
  // R2/R4: tên ngắn (đã xử lý trùng) và màu ảnh đại diện theo sổ thợ của màn — cùng hàm với Lịch (ui/staffName.ts).
  naming: StaffNaming;
}

const TIP = 'Dấu viền màu = thợ chính. Thợ phụ đi kèm hỗ trợ. Khi xác nhận hợp đồng, máy sẽ tạo lịch cho các thợ này.';

// Hàng "Thợ phụ trách" của thẻ dòng (bản vẽ 4.3, bổ sung 18/10/2026).
export function StaffRow({ people, mode, onPick, pickBlockedReason, scheduleHref, error, naming }: StaffRowProps) {
  const many = people.length > 1;
  const names = people.map((p) => `${naming.shortName(p)}${many && p.role === 'PRIMARY' ? ' (chính)' : ''}`).join(', ');
  return (
    <div className="ct-rw">
      <span className="ct-rw__l">
        Thợ phụ trách
        <Tooltip text={TIP} />
      </span>
      <div className="ct-dcr">
        <div className="ct-fl">
          {people.length > 0 && (
            <span className="ct-avs" role="group" aria-label={people.map((p) => `${p.displayName} (${p.role === 'PRIMARY' ? 'thợ chính' : 'thợ phụ'})`).join(', ')}>
              {people.map((p) => (
                <Avatar
                  key={p.membershipId}
                  size="sm"
                  name={`${p.displayName} · ${p.role === 'PRIMARY' ? 'thợ chính' : 'thợ phụ'}`}
                  initials={p.initials}
                  avatarUrl={p.avatarUrl}
                  colorKey={naming.colorKey(p.membershipId)}
                  className={p.role === 'PRIMARY' ? 'ct-av--chinh' : undefined}
                />
              ))}
            </span>
          )}
          <span className="ct-tn">{people.length > 0 ? names : <span className="ct-faint">Chưa chọn</span>}</span>
          <span className="ct-fl__grow" />
          {mode === 'edit' &&
            (pickBlockedReason ? (
              <WithTooltip text={pickBlockedReason}>
                <Button size="sm" disabled aria-label={`${people.length ? 'Đổi' : 'Chọn thợ'} — ${pickBlockedReason}`}>
                  {people.length ? 'Đổi' : 'Chọn thợ'}
                </Button>
              </WithTooltip>
            ) : (
              <Button size="sm" onClick={onPick}>
                {people.length ? 'Đổi' : 'Chọn thợ'}
              </Button>
            ))}
          {mode === 'locked' && scheduleHref && (
            <Link className="ct-lnk" to={scheduleHref} title="Thợ của hợp đồng đã xác nhận được đổi ở màn Lịch">
              Đổi ở Lịch
            </Link>
          )}
        </div>
        {error ? (
          <div className="ct-err">{error}</div>
        ) : (
          // N7: lý do khoá nút chọn thợ hiện thành chữ, không chỉ nằm trong aria-label / tooltip.
          mode === 'edit' && pickBlockedReason && <div className="ct-fx" data-o="ly-do-khoa-tho">{pickBlockedReason}</div>
        )}
      </div>
    </div>
  );
}
