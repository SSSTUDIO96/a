import type { TodayView } from '../../api/types';
import { Card } from '../../ui';
import { money } from '../payments/money';
import { IconCap, IconDoc } from './icons';
import { dayMonth, localDateOf, sinceLabel } from './model';
import { EmptyLine, ListRowLink, RoundIcon } from './parts';

// Thẻ "Mới trong 24 giờ · N": hợp đồng mới xác nhận + học viên mới ghi danh, mới nhất trước. Thẻ thiếu quyền (null) không tính;
// cả hai null → không vẽ thẻ.
export function NewCard({ view, orgSlug }: { view: TodayView; orgSlug: string }) {
  if (!view.newContracts && !view.newEnrollments) return null;
  const items = [
    ...(view.newContracts ?? []).map((c) => ({ at: c.confirmedAt, kind: 'contract' as const, c })),
    ...(view.newEnrollments ?? []).map((e) => ({ at: e.enrolledAt, kind: 'enrollment' as const, e })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return (
    <Card id="td-new" className="td-card" title="Mới trong 24 giờ" subtitle={String(items.length)} flush>
      {items.length === 0 && <EmptyLine>Không có gì mới trong 24 giờ.</EmptyLine>}
      {items.map((it) => {
        if (it.kind === 'contract') {
          const c = it.c;
          const parts = [
            money(c.total),
            c.eventDate ? `ngày sự kiện ${dayMonth(localDateOf(c.eventDate, view.timezone))}` : null,
            sinceLabel(c.confirmedAt, view),
            c.confirmedBy?.fullName ?? null,
          ].filter(Boolean);
          return (
            <ListRowLink
              key={`c-${c.id}`}
              to={`/${orgSlug}/hop-dong/${c.id}`}
              className="td-row"
              leading={
                <RoundIcon tone="ok">
                  <IconDoc />
                </RoundIcon>
              }
              title={`${c.code} xác nhận · ${c.customerName}`}
              subtitle={parts.join(' · ')}
              trailing={<span className="td-open">Mở</span>}
            />
          );
        }
        const e = it.e;
        return (
          <ListRowLink
            key={`e-${e.id}`}
            to={`/${orgSlug}/dao-tao/${e.course.id}`}
            className="td-row"
            leading={
              <RoundIcon>
                <IconCap />
              </RoundIcon>
            }
            title={`${e.customer.fullName} ghi danh`}
            subtitle={`${e.courseClass.name} · còn ${e.capacity - e.enrolledCount}/${e.capacity} chỗ · ${sinceLabel(e.enrolledAt, view)}`}
            trailing={<span className="td-open">Mở</span>}
          />
        );
      })}
    </Card>
  );
}
