import type { TodayView } from '../../api/types';
import { Card } from '../../ui';
import { money } from '../payments/money';
import { dueLabel, dueOnEventDay } from './model';
import { EmptyLine, HeadLink, ListRowLink, TruncatedNote } from './parts';

// Thẻ "Thu tiền 7 ngày tới · N đợt": đợt DUE / PARTIAL có hạn trong 7 ngày. Số đợt lấy từ counts máy chủ (đếm toàn bộ).
export function DueSoonCard({ view, orgSlug }: { view: TodayView; orgSlug: string }) {
  if (!view.installments) return null;
  const list = view.installments.dueSoon;
  const total = view.counts.dueSoon ? view.counts.dueSoon.count : list.length;
  return (
    <Card
      id="td-due"
      className="td-card"
      title="Thu tiền 7 ngày tới"
      subtitle={`${total} đợt`}
      flush
      actions={<HeadLink to={`/${orgSlug}/thu-tien`}>Mở Thu tiền</HeadLink>}
    >
      {list.length === 0 && <EmptyLine>Không có đợt nào đến hạn trong 7 ngày tới.</EmptyLine>}
      {list.map((i) => {
        const owner = i.owner ? ` · phụ trách ${i.owner.displayName}` : '';
        const eventDay = dueOnEventDay(i, view.timezone) ? ' (ngày sự kiện)' : '';
        const partial = i.status === 'PARTIAL' ? ' · đã thu một phần' : '';
        return (
          <ListRowLink
            key={i.installmentId}
            to={`/${orgSlug}/thu-tien/${i.contract.id}`}
            className="td-row"
            title={`${i.name} · ${i.contract.code} · ${i.customer.fullName}`}
            subtitle={`${dueLabel(i, view.timezone)}${eventDay}${owner}${partial}`}
            amount={money(i.outstanding)}
          />
        );
      })}
      {view.installments.truncated && <TruncatedNote>Chỉ hiện {list.length} dòng đầu — xem đủ ở Thu tiền.</TruncatedNote>}
    </Card>
  );
}
