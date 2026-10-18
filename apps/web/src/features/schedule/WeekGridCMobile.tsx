// Chế độ C trên điện thoại (≤ 640px) — xoay trục: hàng = 7 ngày, cột = thợ. Bản mẫu docs/rnd/v2-lich-C-mobile.html.
// Ô ghi tối đa 3 giờ bắt đầu, thừa thì "+n". Ngày đang chọn tô nền; dưới lưới là danh sách ca của ngày đó (4 ca + "Xem cả ngày").
// Trên 5 cột (kể cả "Chưa có"): chỉ phần cột thợ cuộn ngang, dừng đúng mép cột (scroll-snap).
import { useState, type CSSProperties } from 'react';
import type { Appointment } from '../../api/types';
import { StatusTag } from '../../ui';
import { appointmentsOfDay, cellKey, countByDay, indexByCell, kindText, UNASSIGNED, type ConflictMarks, type StaffLane } from './model';
import { apptClasses, apptTip, cx, LaneAvatar, StaffAvatars, startLabel } from './parts';
import { dayKeyOf, dayNumber, ddmm, hhmm, isWeekend, weekDays, weekdayLong, weekdayShort, type DayKey } from './time';

const MAX_TIMES = 3;
const MAX_LIST = 4;
const MAX_COLS = 5;

function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  return words[words.length - 1] ?? name;
}

export function WeekGridCMobile({
  day,
  onSelectDay,
  lanes,
  showUnassigned,
  appointments,
  marks,
  onOpen,
}: {
  day: DayKey;
  onSelectDay: (d: DayKey) => void;
  lanes: StaffLane[];
  showUnassigned: boolean;
  appointments: Appointment[];
  marks: ConflictMarks;
  onOpen: (a: Appointment) => void;
}) {
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(null);
  const days = weekDays(day);
  const cells = indexByCell(appointments);
  const perDay = countByDay(appointments, days);
  const cols: (StaffLane | null)[] = [...lanes, ...(showUnassigned ? [null] : [])];
  const scrolls = cols.length > MAX_COLS;
  const style = { '--ws-cols': cols.length } as CSSProperties;

  const dayList = appointmentsOfDay(appointments, day);
  const unassigned = dayList.filter((a) => a.staff.length === 0).length;
  const expanded = expandedDay === day;
  const shown = expanded ? dayList : dayList.slice(0, MAX_LIST);

  return (
    <div data-testid="che-do-C-dien-thoai">
      <div className={cx('ws-cm', scrolls && 'is-scroll')} style={style} role="table" aria-label="Lịch tuần theo ngày và thợ">
        <div role="row" className="ws-cm__row">
          <div role="columnheader" className="ws-cm__corner" aria-label="Ngày" />
          {cols.map((lane) => (
            <div role="columnheader" key={lane?.membershipId ?? UNASSIGNED} className="ws-cm__sh">
              <LaneAvatar lane={lane} size="xs" />
              <span className="ws-cm__tn">{lane ? shortName(lane.name) : 'Chưa có'}</span>
            </div>
          ))}
        </div>
        {days.map((d) => (
          <div role="row" className="ws-cm__row" key={d}>
            <button
              type="button"
              role="rowheader"
              className={cx('ws-cm__dh', isWeekend(d) && 'is-we', d === day && 'is-sel')}
              aria-pressed={d === day}
              aria-label={`${weekdayLong(d)} ${ddmm(d)}, ${perDay[d] ?? 0} ca`}
              onClick={() => onSelectDay(d)}
            >
              <b>{weekdayShort(d)}</b>
              <span className="num">{dayNumber(d)}</span>
              <i>{perDay[d] ?? 0} ca</i>
            </button>
            {cols.map((lane) => {
              const k = cellKey(lane?.membershipId ?? UNASSIGNED, d);
              const list = cells.get(k) ?? [];
              const more = list.length - MAX_TIMES;
              return (
                <div role="cell" key={k} className={cx('ws-cm__cell', d === day && 'is-sel', marks.cells.has(k) && 'is-conf')} data-cell={k}>
                  {list.slice(0, MAX_TIMES).map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      className={cx('ws-pt', apptClasses(a, marks.appointmentIds.has(a.id)))}
                      title={apptTip(a)}
                      aria-label={apptTip(a)}
                      onClick={() => onOpen(a)}
                    >
                      <span className="num">{dayKeyOf(a.startsAt) === d ? hhmm(a.startsAt) : '…'}</span>
                    </button>
                  ))}
                  {more > 0 && (
                    <button type="button" className="ws-pt-more" onClick={() => onSelectDay(d)}>
                      +{more}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="ws-cm-day">
        <div className="ws-cm-day__h">
          <b>
            {weekdayLong(day)} {ddmm(day)}
          </b>
          <span>
            {dayList.length} ca{unassigned > 0 ? ` · ${unassigned} chưa có thợ` : ''}
          </span>
        </div>
        {dayList.length === 0 ? (
          <p className="ws-cm-day__empty">Không có ca nào trong ngày.</p>
        ) : (
          <div className="ws-cm-day__list">
            {shown.map((a) => (
              <MobileAgendaRow key={a.id} a={a} day={day} lanes={lanes} conflict={marks.appointmentIds.has(a.id)} onOpen={onOpen} />
            ))}
            {dayList.length > MAX_LIST && (
              <button type="button" className="ws-cm-day__all" onClick={() => setExpandedDay(expanded ? null : day)}>
                {expanded ? 'Thu gọn' : `Xem cả ngày (${dayList.length} ca)`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileAgendaRow({
  a,
  day,
  lanes,
  conflict,
  onOpen,
}: {
  a: Appointment;
  day: DayKey;
  lanes: StaffLane[];
  conflict: boolean;
  onOpen: (a: Appointment) => void;
}) {
  return (
    <button type="button" className={cx('ws-ag', apptClasses(a, conflict))} onClick={() => onOpen(a)}>
      <span className="ws-ag__tm num">
        {startLabel(a, day)}
        <small>{hhmm(a.endsAt)}</small>
      </span>
      <span className="ws-ag__main">
        <span className="ws-ag__kind">
          {kindText(a)}
          {conflict && <StatusTag tone="danger">Trùng giờ</StatusTag>}
        </span>
        <span className="ws-ag__kh">{a.customer?.fullName ?? (a.staff.length === 0 ? 'Chưa có thợ' : '')}</span>
      </span>
      <span className="ws-ag__who">
        <StaffAvatars a={a} lanes={lanes} size="sm" />
      </span>
    </button>
  );
}
