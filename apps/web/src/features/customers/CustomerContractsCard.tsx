import { Link } from 'react-router';
import type { ContractDetail, ContractSummary } from '../../api/types';
import { ContractStatusTag, formatVnd, IconPlus, ListRowSkeleton } from '../../ui';
import { LoadErrorStrip } from '../staff/parts';
import { firstLineName, formatDateIn } from './logic';
import type { Loadable } from './useCustomerHistory';
import { CONTRACT_LIMIT } from './useCustomerHistory';

// Thẻ "Hợp đồng" của khách (C2 2.2, chỉ contracts.read): "{mã} · {tên dòng gói đầu}" · "Sự kiện dd/mm/yyyy" · tổng + trạng thái.
export interface CustomerContractsCardProps {
  slug: string;
  customerId: string;
  timezone: string;
  contracts: Loadable<{ items: ContractSummary[]; total: number }>;
  details: Loadable<Map<string, ContractDetail>> | null;
  canCreate: boolean;
  onRetry: () => void;
}

export function CustomerContractsCard({ slug, customerId, timezone, contracts, details, canCreate, onRetry }: CustomerContractsCardProps) {
  const total = contracts.status === 'ready' ? contracts.data.total : null;
  const createLink = canCreate ? (
    <Link className="ui-btn ui-btn--sm ui-btn--primary" to={`/${slug}/hop-dong/moi?customerId=${encodeURIComponent(customerId)}`}>
      <IconPlus />
      <span className="ui-btn__text">Lập hợp đồng</span>
    </Link>
  ) : null;
  const detailMap = details?.status === 'ready' ? details.data : null;

  let body;
  if (contracts.status === 'loading') body = <ListRowSkeleton rows={2} amount label="Đang tải hợp đồng" />;
  else if (contracts.status === 'error') body = <LoadErrorStrip error={contracts.error} retry={onRetry} />;
  else if (contracts.data.items.length === 0) body = <p className="kh-none">Chưa có hợp đồng.</p>;
  else
    body = (
      <>
        {contracts.data.items.map((c) => {
          const d = detailMap?.get(c.id);
          const line = d ? firstLineName(d) : null;
          return (
            <Link key={c.id} className="kh-ct" to={`/${slug}/hop-dong/${c.id}`}>
              <span className="kh-ct__main">
                <span className="kh-ct__title">{line ? `${c.code} · ${line}` : c.code}</span>
                <span className="kh-ct__sub">{c.eventDate ? `Sự kiện ${formatDateIn(c.eventDate, timezone)}` : 'Chưa có ngày sự kiện'}</span>
              </span>
              <span className="kh-ct__right">
                <span className="kh-ct__amt">{formatVnd(c.total)}</span>
                <ContractStatusTag status={c.status} />
              </span>
            </Link>
          );
        })}
        {contracts.data.total > CONTRACT_LIMIT && (
          <Link className="kh-ct-all" to={`/${slug}/hop-dong?customerId=${encodeURIComponent(customerId)}`}>
            {`Xem tất cả ${contracts.data.total} hợp đồng`}
          </Link>
        )}
      </>
    );

  return (
    <section className="ui-card kh-cts" aria-label="Hợp đồng của khách">
      <header className="ui-card__head">
        <h2 className="ui-card__title">Hợp đồng</h2>
        {total !== null && total > 0 && <span className="kh-count">{`${total} hợp đồng`}</span>}
        {createLink}
      </header>
      {body}
    </section>
  );
}
