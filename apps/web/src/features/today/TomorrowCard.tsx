import type { TodayView } from '../../api/types';
import type { StaffNaming } from '../../ui/staffName';
import { Card, ListRow } from '../../ui';
import { dayLabel, groupByStaff, hhmm } from './model';
import { NoScheduleCard } from './NoScheduleCard';
import { EmptyLine, HeadLink, StaffAvatar, TruncatedNote } from './parts';

// Thẻ "Ngày mai · Thứ Hai 22/11 · N ca": ca của ngày mai gom theo thợ (ca chưa có thợ ở dòng "Chưa có thợ" cuối).
// N = counts.appointmentsTomorrow máy chủ đếm (ca nhiều thợ không bị đếm hai lần).
export function TomorrowCard({ view, orgSlug, naming }: { view: TodayView; orgSlug: string; naming: StaffNaming }) {
  const { appointments } = view;
  // Không có quyền xem lịch: máy chủ trả null → thay thẻ bằng lời báo (không hiện "0 ca").
  if (appointments === null || view.counts.appointmentsTomorrow === null) return <NoScheduleCard />;
  const groups = groupByStaff(appointments.tomorrow);
  return (
    <Card
      id="td-tomorrow"
      className="td-card"
      title={`Ngày mai · ${dayLabel(view.tomorrow)}`}
      subtitle={`${view.counts.appointmentsTomorrow} ca`}
      flush
      actions={<HeadLink to={`/${orgSlug}/lich?ngay=${view.tomorrow}`}>Mở Lịch</HeadLink>}
    >
      {groups.length === 0 && <EmptyLine>Ngày mai chưa có ca nào.</EmptyLine>}
      {groups.map((g) => (
        <ListRow
          key={g.membershipId ?? 'chua-co-tho'}
          className="td-row"
          leading={<StaffAvatar membershipId={g.membershipId} name={g.name} naming={naming} />}
          title={`${g.membershipId === null ? g.name : naming.shortName({ membershipId: g.membershipId, displayName: g.name })} · ${g.appointments.length} ca`}
          subtitle={g.appointments.map((a) => hhmm(a.startsAt, view.timezone)).join(' · ')}
        />
      ))}
      {appointments.truncated && <TruncatedNote>Chỉ hiện {appointments.tomorrow.length} ca đầu — xem đủ ở Lịch.</TruncatedNote>}
    </Card>
  );
}
