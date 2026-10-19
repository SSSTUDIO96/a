import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar, ListRow, type ListRowProps } from '../../ui';
import type { StaffNaming } from '../../ui/staffName';

/** Liên kết trông như nút (ui-btn) — nút trong dòng danh sách là đường dẫn thật, bấm giữa mở tab mới được. */
export function LinkButton({ to, children, primary = false, label }: { to: string; children: ReactNode; primary?: boolean; label?: string }) {
  return (
    <Link to={to} className={`ui-btn ui-btn--sm td-btn${primary ? ' ui-btn--primary' : ''}`} aria-label={label}>
      <span className="ui-btn__text">{children}</span>
    </Link>
  );
}

/** Liên kết chữ ở đầu thẻ ("Mở Thu tiền", "Mở Lịch"). */
export function HeadLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="td-headlink">
      {children}
    </Link>
  );
}

/** Vòng tròn biểu tượng đứng đầu dòng. tone: danger cho tiền quá hạn. */
export function RoundIcon({ children, tone = 'default' }: { children?: ReactNode; tone?: 'default' | 'danger' | 'ok' | 'unknown' }) {
  return (
    <span className={`td-ico td-ico--${tone}`} aria-hidden="true">
      {children}
    </span>
  );
}

export function StaffAvatar({ membershipId, name, naming }: { membershipId: string | null; name: string; naming: StaffNaming }) {
  if (membershipId === null) return <RoundIcon tone="unknown">?</RoundIcon>;
  return <Avatar name={name} colorKey={naming.colorKey(membershipId)} />;
}

/** Dòng mờ cuối thẻ khi máy chủ cắt bớt danh sách. */
export function TruncatedNote({ children }: { children: ReactNode }) {
  return <p className="td-more">{children}</p>;
}

/** Một câu trong thẻ rỗng (có quyền xem mà không có gì). */
export function EmptyLine({ children, check = false }: { children: ReactNode; check?: boolean }) {
  return (
    <p className="td-none">
      {check && (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
      {children}
    </p>
  );
}

/** Dòng bấm được cả dòng: đường dẫn thật trong ứng dụng (không tải lại trang). */
export function ListRowLink({ to, ...rest }: ListRowProps & { to: string }) {
  return <ListRow {...rest} as={Link} linkProps={{ to }} />;
}
