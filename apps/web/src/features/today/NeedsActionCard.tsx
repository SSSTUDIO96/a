import type { TodayAppointment, TodayClass, TodayInstallment, TodayView } from '../../api/types';
import { Button, Card, ListGroupHeader, ListRow } from '../../ui';
import { money } from '../payments/money';
import { IconCash, IconSeat } from './icons';
import { dayLabel, dayMonth, dueLabel, hhmm, LOCATION_LABELS, localDateOf, needsCounts, scheduleLink, type TodayAccess } from './model';
import { EmptyLine, LinkButton, ListRowLink, RoundIcon, TruncatedNote } from './parts';
import { useCollapsed } from './useCollapsed';

// Thẻ "Cần làm ngay" (bản vẽ D 3.1): TIỀN QUÁ HẠN · CA CHƯA CÓ THỢ · LỚP SẮP ĐẦY. Nhóm thiếu quyền (null) không vẽ;
// nhóm có quyền mà trống thì ẩn khi nhóm khác có việc, cả ba trống → "Không có việc gấp.".
export function NeedsActionCard({ view, orgSlug, access }: { view: TodayView; orgSlug: string; access: TodayAccess }) {
  const [collapsed, toggle] = useCollapsed('can-lam');
  const n = needsCounts(view);
  if (!n) return null;
  const overdue = view.installments?.overdue ?? [];
  const unassigned = view.unassigned ?? [];
  const classes = view.almostFullClasses ?? [];
  return (
    <Card
      id="td-needs"
      className="td-card"
      title="Cần làm ngay"
      subtitle={n.total > 0 ? `${n.total} việc` : undefined}
      flush
      actions={
        n.total > 0 ? (
          <Button variant="ghost" size="sm" aria-expanded={!collapsed} aria-controls="td-needs-body" onClick={toggle}>
            {collapsed ? 'Mở rộng' : 'Thu gọn'}
          </Button>
        ) : undefined
      }
    >
      {n.total === 0 && <EmptyLine check>Không có việc gấp.</EmptyLine>}
      {n.total > 0 && !collapsed && (
        <div id="td-needs-body">
          {overdue.length > 0 && (
            <section aria-label="Tiền quá hạn">
              <ListGroupHeader tone="danger" aside={view.counts.overdue ? money(view.counts.overdue.amount) : undefined}>
                Tiền quá hạn
              </ListGroupHeader>
              {overdue.map((i) => (
                <OverdueRow key={i.installmentId} i={i} timezone={view.timezone} orgSlug={orgSlug} canCollect={access.paymentsWrite} />
              ))}
              {view.installments?.truncated && <TruncatedNote>Chỉ hiện {overdue.length} dòng đầu — xem đủ ở Thu tiền.</TruncatedNote>}
            </section>
          )}
          {unassigned.length > 0 && (
            <section aria-label="Ca chưa có thợ">
              <ListGroupHeader aside={n.unassigned}>Ca chưa có thợ</ListGroupHeader>
              {unassigned.map((a) => (
                <UnassignedRow key={a.id} a={a} view={view} orgSlug={orgSlug} canAssign={access.scheduleWrite} />
              ))}
              {n.unassigned > unassigned.length && <TruncatedNote>Chỉ hiện {unassigned.length} ca đầu — xem đủ ở Lịch.</TruncatedNote>}
            </section>
          )}
          {classes.length > 0 && (
            <section aria-label="Lớp sắp đầy">
              <ListGroupHeader aside={classes.length}>Lớp sắp đầy</ListGroupHeader>
              {classes.map((c) => (
                <ClassRow key={c.id} c={c} orgSlug={orgSlug} />
              ))}
            </section>
          )}
        </div>
      )}
    </Card>
  );
}

function OverdueRow({ i, timezone, orgSlug, canCollect }: { i: TodayInstallment; timezone: string; orgSlug: string; canCollect: boolean }) {
  const to = `/${orgSlug}/thu-tien/${i.contract.id}`;
  const owner = i.owner ? ` · phụ trách: ${i.owner.displayName}` : '';
  const phone = i.customer.phone ? ` · ${i.customer.phone}` : '';
  const common = {
    leading: (
      <RoundIcon tone="danger">
        <IconCash />
      </RoundIcon>
    ),
    title: `${i.name} · ${i.contract.code} · ${i.customer.fullName}`,
    subtitle: `${dueLabel(i, timezone)}${owner}${phone}`,
    amount: money(i.outstanding),
    className: 'td-row td-act',
  };
  return canCollect ? (
    <ListRow {...common} trailing={<LinkButton to={to} primary label={`Mở Thu tiền ${i.contract.code}`}>Mở Thu tiền</LinkButton>} />
  ) : (
    <ListRowLink {...common} to={to} />
  );
}

function UnassignedRow({ a, view, orgSlug, canAssign }: { a: TodayAppointment; view: TodayView; orgSlug: string; canAssign: boolean }) {
  const date = localDateOf(a.startsAt, view.timezone);
  const when = date === view.today ? 'Hôm nay' : date === view.tomorrow ? 'Ngày mai' : dayLabel(date);
  const title = [`${when} ${hhmm(a.startsAt, view.timezone)}`, a.subjectName, a.customer?.fullName].filter(Boolean).join(' · ');
  const where = a.locationType ? LOCATION_LABELS[a.locationType] : null;
  const subtitle = [a.contract?.code, where].filter(Boolean).join(' · ');
  const to = scheduleLink(orgSlug, date, a.id);
  const common = {
    leading: <RoundIcon tone="unknown">?</RoundIcon>,
    title,
    subtitle: subtitle || dayMonth(date),
    className: 'td-row td-act',
  };
  return canAssign ? (
    <ListRow {...common} trailing={<LinkButton to={to} label={`Phân thợ cho ca ${a.code}`}>Phân thợ</LinkButton>} />
  ) : (
    <ListRowLink {...common} to={to} />
  );
}

function ClassRow({ c, orgSlug }: { c: TodayClass; orgSlug: string }) {
  return (
    <ListRow
      className="td-row td-act"
      leading={
        <RoundIcon>
          <IconSeat />
        </RoundIcon>
      }
      title={`${c.name} · ${c.enrolledCount}/${c.capacity} chỗ`}
      subtitle={`Khai giảng ${dayMonth(c.startDate)} · còn ${c.seatsLeft} chỗ`}
      trailing={
        <LinkButton to={`/${orgSlug}/dao-tao/${c.course.id}`} label={`Mở lớp ${c.name}`}>
          Mở lớp
        </LinkButton>
      }
    />
  );
}
