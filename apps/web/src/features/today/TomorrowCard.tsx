import type { TodayView } from '../../api/types';
import { Card, ListRow } from '../../ui';
import { dayLabel, groupByStaff, hhmm } from './model';
import { EmptyLine, HeadLink, StaffAvatar, TruncatedNote } from './parts';

// Thẻ "Ngày mai · Thứ Hai 22/11 · N ca": ca của ngày mai gom theo thợ (ca chưa có thợ ở dòng "Chưa có thợ" cuối).
// N = counts.appointmentsTomorrow máy chủ đếm (ca nhiều thợ không bị đếm hai lần).
export function TomorrowCard({ view, orgSlug }: { view: TodayView; orgSlug: string }) {
  const groups = groupByStaff(view.appointments.tomorrow);
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
          leading={<StaffAvatar membershipId={g.membershipId} name={g.name} />}
          title={`${g.name} · ${g.appointments.length} ca`}
          subtitle={g.appointments.map((a) => hhmm(a.startsAt, view.timezone)).join(' · ')}
        />
      ))}
      {view.appointments.truncated && <TruncatedNote>Chỉ hiện {view.appointments.tomorrow.length} ca đầu — xem đủ ở Lịch.</TruncatedNote>}
    </Card>
  );
}
