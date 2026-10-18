// Chế độ B — danh sách theo ngày. Bản mẫu docs/rnd/phuong-an-B.html.
// Dải 7 ngày (số ca) · chip lọc thợ · "Cần xử lý" (ca chưa có thợ) · danh sách chia buổi · máy tính: khung "Thợ trong ngày".
import { useState } from 'react';
import type { Appointment } from '../../api/types';
import { Button, Chip, IconWarn, WorkStatusTag } from '../../ui';
import { IconPerson } from './icons';
import {
  appointmentsOfDay,
  countByDay,
  DAY_PART_LABELS,
  dayLoad,
  dayPartOf,
  kindText,
  laneIdsOf,
  UNASSIGNED,
  type ConflictMarks,
  type DayPart,
  type StaffLane,
} from './model';
import { apptClasses, cx, LaneAvatar, placeText, StaffAvatars, staffNames, startLabel, timeRange } from './parts';
import { dayKeyOf, dayNumber, ddmm, formatHours, hhmm, isWeekend, weekDays, weekdayLong, weekdayShort, type DayKey } from './time';

const AXIS_FROM = 4;
const AXIS_TO = 18;

export function DayListB({
  day,
  onSelectDay,
  lanes,
  showUnassigned,
  appointments,
  marks,
  canWrite,
  showLoadPanel,
  onOpen,
  onAssign,
}: {
  day: DayKey;
  onSelectDay: (d: DayKey) => void;
  lanes: StaffLane[];
  showUnassigned: boolean;
  appointments: Appointment[];
  marks: ConflictMarks;
  canWrite: boolean;
  showLoadPanel: boolean;
  onOpen: (a: Appointment) => void;
  onAssign: (a: Appointment) => void;
}) {
  const [laneFilter, setLaneFilter] = useState<string | null>(null);
  const days = weekDays(day);
  const perDay = countByDay(appointments, days);
  const all = appointmentsOfDay(appointments, day);
  const filtered = laneFilter ? all.filter((a) => laneIdsOf(a).includes(laneFilter)) : all;
  const needStaff = all.filter((a) => a.staff.length === 0);
  const laneCount = (id: string) => all.filter((a) => laneIdsOf(a).includes(id)).length;
  const conflictDays = new Set(appointments.filter((a) => marks.appointmentIds.has(a.id)).map((a) => dayKeyOf(a.startsAt)));

  const parts: DayPart[] = ['early', 'morning', 'afternoon'];
  const grouped = parts
    .map((p) => ({ part: p, items: filtered.filter((a) => dayPartOf(a, day) === p) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className={cx('ws-b', showLoadPanel && 'has-panel')} data-testid="che-do-B">
      <div className="ws-b__main">
        <div className="ws-days" role="group" aria-label="Chọn ngày">
          {days.map((d) => (
            <button
              type="button"
              key={d}
              className={cx('ws-day', isWeekend(d) && 'is-we', d === day && 'is-on')}
              aria-pressed={d === day}
              aria-label={`${weekdayLong(d)} ${ddmm(d)}, ${perDay[d] ?? 0} ca`}
              onClick={() => onSelectDay(d)}
            >
              {conflictDays.has(d) && <i className="ws-day__dot" aria-hidden="true" />}
              <span className="ws-day__w">{weekdayShort(d)}</span>
              <span className="ws-day__n num">{dayNumber(d)}</span>
              <span className="ws-day__c">{perDay[d] ?? 0} ca</span>
            </button>
          ))}
        </div>

        {lanes.length + (showUnassigned ? 1 : 0) > 1 && (
          <div className="ws-filters" role="group" aria-label="Lọc theo thợ">
            <Chip selected={laneFilter === null} count={all.length} onClick={() => setLaneFilter(null)}>
              Tất cả
            </Chip>
            {lanes.map((l) => (
              <Chip key={l.membershipId} selected={laneFilter === l.membershipId} count={laneCount(l.membershipId)} onClick={() => setLaneFilter(l.membershipId)}>
                <LaneAvatar lane={l} size="xs" />
                {l.name}
              </Chip>
            ))}
            {showUnassigned && (
              <Chip selected={laneFilter === UNASSIGNED} count={laneCount(UNASSIGNED)} onClick={() => setLaneFilter(UNASSIGNED)}>
                <LaneAvatar lane={null} size="xs" />
                Chưa có thợ
              </Chip>
            )}
          </div>
        )}

        {needStaff.length > 0 && (
          <section className="ws-b__sec">
            <h3 className="ws-caps">Cần xử lý</h3>
            <div className="ws-todo">
              {needStaff.map((a) => (
                <div key={a.id} className="ws-task">
                  <IconPerson />
                  <button type="button" className="ws-task__t" onClick={() => onOpen(a)}>
                    <b>Chưa có thợ</b>
                    <span>{[startLabel(a, day), kindText(a), a.customer?.fullName].filter(Boolean).join(' · ')}</span>
                  </button>
                  {canWrite && (
                    <Button size="sm" onClick={() => onAssign(a)}>
                      Phân thợ
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 ? (
          <p className="ws-b__empty">Không có ca nào {laneFilter ? 'của thợ này ' : ''}trong ngày.</p>
        ) : (
          grouped.map((g) => (
            <section key={g.part} className="ws-b__sec">
              <h3 className="ws-caps">
                {DAY_PART_LABELS[g.part]} · {g.items.length} ca
              </h3>
              <div className="ws-agenda">
                {g.items.map((a) => {
                  const conflict = marks.appointmentIds.has(a.id);
                  return (
                    <button type="button" key={a.id} className={cx('ws-item', apptClasses(a, conflict))} onClick={() => onOpen(a)}>
                      <span className="ws-item__tm num">
                        {startLabel(a, day)}
                        <small>{hhmm(a.endsAt)}</small>
                      </span>
                      <span className="ws-item__main">
                        <span className="ws-item__sv">
                          {kindText(a)} <WorkStatusTag status={a.status} />
                        </span>
                        {a.customer && <span className="ws-item__kh">{a.customer.fullName}</span>}
                        {placeText(a) && <span className="ws-item__nc">{placeText(a)}</span>}
                        {conflict && (
                          <span className="ws-item__warn">
                            <IconWarn />
                            Trùng giờ {timeRange(a)}
                          </span>
                        )}
                      </span>
                      <span className="ws-item__who">
                        <StaffAvatars a={a} lanes={lanes} size="sm" />
                        <span className="ws-item__wn">{staffNames(a, lanes)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {showLoadPanel && (
        <aside className="ws-load" aria-label="Thợ trong ngày">
          <h3>Thợ trong ngày</h3>
          <p className="ws-load__sub">
            {weekdayLong(day)} {ddmm(day)} · {String(AXIS_FROM).padStart(2, '0')}:00 – {AXIS_TO}:00
          </p>
          {lanes.map((l) => {
            const load = dayLoad(appointments, l.membershipId, day);
            return (
              <div key={l.membershipId} className="ws-load__row">
                <LaneAvatar lane={l} />
                <div className="ws-load__body">
                  <div className="ws-load__nm">
                    {l.name}
                    <span>
                      {load.count} ca · {formatHours(load.minutes)}
                    </span>
                  </div>
                  <div className="ws-track" aria-hidden="true">
                    {load.bars.map((b) => {
                      const from = Math.max(b.startMin, AXIS_FROM * 60);
                      const to = Math.min(b.endMin, AXIS_TO * 60);
                      if (to <= from) return null;
                      const span = (AXIS_TO - AXIS_FROM) * 60;
                      return (
                        <i
                          key={b.id}
                          className={cx(`ws-tone-${b.tone}`, !b.blocking && 'is-off', marks.appointmentIds.has(b.id) && 'is-x')}
                          style={{ left: `${((from - AXIS_FROM * 60) / span) * 100}%`, width: `${((to - from) / span) * 100}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="ws-scale" aria-hidden="true">
            {[4, 8, 12, 16, 18].map((h) => (
              <span key={h} style={{ left: `${((h - AXIS_FROM) / (AXIS_TO - AXIS_FROM)) * 100}%` }}>
                {h}h
              </span>
            ))}
          </div>
          <div className="ws-load__sum">
            Tổng trong ngày
            <b>
              {all.length} ca{showUnassigned ? ` · ${needStaff.length} ca chưa có thợ` : ''}
            </b>
          </div>
        </aside>
      )}
    </div>
  );
}
