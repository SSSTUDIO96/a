import { Link } from 'react-router';
import type { TodayAppointment, TodayView } from '../../api/types';
import { Card, WorkStatusTag } from '../../ui';
import { dayLabel, eventLine, groupByDay, hhmm, localDateOf, locationLine, scheduleLink, swatchOf } from './model';
import { EmptyLine, HeadLink, TruncatedNote } from './parts';

// Giao diện "OWN" (thợ, giảng viên, trợ giảng — chỉ có schedule.read_own): ba thẻ ca của mình, không có 4 ô số.
// Máy chủ đã lọc chỉ ca có mình; web không lọc lại.
export function MyDayCards({ view, orgSlug }: { view: TodayView; orgSlug: string }) {
  const { appointments, counts, timezone } = view;
  const later = groupByDay(appointments.later, timezone);
  return (
    <div className="td-grid td-grid--own">
      <div className="td-col">
        <Card id="td-today" className="td-card" title="Hôm nay" subtitle={counts.appointmentsToday === 0 ? 'không có ca' : `${counts.appointmentsToday} ca`} flush>
          {appointments.today.length === 0 && <EmptyLine check>Bạn không có ca nào hôm nay.</EmptyLine>}
          {appointments.today.map((a) => (
            <CaRow key={a.id} a={a} view={view} orgSlug={orgSlug} />
          ))}
        </Card>
        <Card
          id="td-tomorrow"
          className="td-card"
          title={`Ngày mai · ${dayLabel(view.tomorrow)}`}
          subtitle={`${counts.appointmentsTomorrow} ca`}
          flush
          actions={<HeadLink to={`/${orgSlug}/lich?ngay=${view.tomorrow}`}>Mở Lịch</HeadLink>}
        >
          {appointments.tomorrow.length === 0 && <EmptyLine>Ngày mai bạn không có ca nào.</EmptyLine>}
          {appointments.tomorrow.map((a) => (
            <CaRow key={a.id} a={a} view={view} orgSlug={orgSlug} />
          ))}
        </Card>
      </div>
      <div className="td-col">
        <Card id="td-later" className="td-card" title="Sau đó · 7 ngày tới" subtitle={`${appointments.later.length} ca`} flush>
          {later.length === 0 && <EmptyLine>Bạn chưa có ca nào trong 7 ngày tới.</EmptyLine>}
          {later.map((g) => (
            <div key={g.date} className="td-day">
              <h3 className="td-day__title">
                {dayLabel(g.date)} · {g.appointments.length} ca
              </h3>
              {g.appointments.map((a) => (
                <Link key={a.id} to={scheduleLink(orgSlug, g.date, a.id)} className="td-day__line">
                  {laterLine(a, timezone)}
                </Link>
              ))}
            </div>
          ))}
          {appointments.truncated && <TruncatedNote>Chỉ hiện những ca đầu — xem đủ ở Lịch.</TruncatedNote>}
        </Card>
      </div>
    </div>
  );
}

// "08:00 Cô dâu · Phan Thu Trang": giờ, nhân vật (thiếu thì tiêu đề ca), khách.
function laterLine(a: TodayAppointment, timezone: string): string {
  const head = [hhmm(a.startsAt, timezone), a.subjectName ?? a.title].filter(Boolean).join(' ');
  return a.customer ? `${head} · ${a.customer.fullName}` : head;
}

// Dòng ca: giờ bắt đầu đậm / giờ kết thúc mờ · "{sự kiện} · {nhân vật}" theo màu sự kiện · khách · nơi làm · nhãn trạng thái.
function CaRow({ a, view, orgSlug }: { a: TodayAppointment; view: TodayView; orgSlug: string }) {
  const date = localDateOf(a.startsAt, view.timezone);
  const place = locationLine(a);
  return (
    <Link to={scheduleLink(orgSlug, date, a.id)} className={`td-ca td-sw-${swatchOf(a)}`}>
      <span className="td-ca__time">
        <b>{hhmm(a.startsAt, view.timezone)}</b>
        <span>{hhmm(a.endsAt, view.timezone)}</span>
      </span>
      <span className="td-ca__body">
        <span className="td-ca__event">{eventLine(a)}</span>
        {a.customer && <span className="td-ca__cust">{a.customer.fullName}</span>}
        {place && <span className="td-ca__place">{place}</span>}
      </span>
      <WorkStatusTag status={a.status} />
    </Link>
  );
}
