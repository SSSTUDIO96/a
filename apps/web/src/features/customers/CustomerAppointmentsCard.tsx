import { Link } from 'react-router';
import type { ContractDetail } from '../../api/types';
import { ListRowSkeleton, Tooltip, WorkStatusTag } from '../../ui';
import { LoadErrorStrip } from '../staff/parts';
import { appointmentsOf, dayKeyIn, formatDateIn, formatTimeIn, sortAppointments } from './logic';
import type { Loadable } from './useCustomerHistory';

// Thẻ "Lịch makeup" (C2 2.2, chỉ contracts.read) — lịch gắn với hợp đồng của khách. Bấm một ca → mở Lịch đúng ngày, đúng ca.
export interface CustomerAppointmentsCardProps {
  slug: string;
  timezone: string;
  details: Loadable<Map<string, ContractDetail>>;
  // Khách có hơn 10 hợp đồng → ghi rõ chỉ hiện lịch của 10 hợp đồng gần nhất.
  truncated: boolean;
  onRetry: () => void;
  now?: number;
}

export function CustomerAppointmentsCard({ slug, timezone, details, truncated, onRetry, now = Date.now() }: CustomerAppointmentsCardProps) {
  let body;
  if (details.status === 'loading') body = <ListRowSkeleton rows={3} label="Đang tải lịch makeup" />;
  else if (details.status === 'error') body = <LoadErrorStrip error={details.error} retry={onRetry} />;
  else {
    const items = sortAppointments(appointmentsOf([...details.data.values()]), now);
    body =
      items.length === 0 ? (
        <p className="kh-none">Chưa có lịch makeup.</p>
      ) : (
        items.map((a) => (
          <Link key={a.id} className="kh-ap" to={`/${slug}/lich?ngay=${dayKeyIn(a.startsAt, timezone)}&ca=${encodeURIComponent(a.id)}`}>
            <span className="kh-ap__when">
              <b>{formatTimeIn(a.startsAt, timezone)}</b>
              <span>{formatDateIn(a.startsAt, timezone)}</span>
            </span>
            <span className="kh-ap__main">
              <span className="kh-ap__title">{a.lineName ?? a.code}</span>
              <span className="kh-ap__sub">{`${a.code} · ${a.contractCode}`}</span>
            </span>
            <span className="kh-ap__tag">
              <WorkStatusTag status={a.status} />
            </span>
          </Link>
        ))
      );
  }
  return (
    <section className="ui-card kh-aps" aria-label="Lịch makeup của khách">
      <header className="ui-card__head">
        <h2 className="ui-card__title">Lịch makeup</h2>
        <span className="kh-count">từ các hợp đồng</span>
        <Tooltip text="Chỉ hiện lịch gắn với hợp đồng của khách. Lịch tạo lẻ chưa lấy được theo khách." />
      </header>
      {truncated && <p className="kh-none">Chỉ hiện lịch của 10 hợp đồng gần nhất.</p>}
      {body}
    </section>
  );
}
