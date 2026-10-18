// Chế độ C — lưới tuần thợ × ngày (máy tính, máy tính bảng). Bản mẫu docs/rnd/phuong-an-C.html.
import type { Appointment } from '../../api/types';
import { IconWarn } from '../../ui';
import { cellKey, countByDay, countByLane, indexByCell, laneShortNames, UNASSIGNED, type ConflictMarks, type StaffLane } from './model';
import { ApptChip, cx, LaneAvatar } from './parts';
import { ddmm, hhmm, isWeekend, todayKey, weekDays, weekdayLong, type DayKey } from './time';

export interface WeekGridProps {
  day: DayKey;
  lanes: StaffLane[];
  showUnassigned: boolean;
  appointments: Appointment[];
  marks: ConflictMarks;
  onOpen: (a: Appointment) => void;
}

export function WeekGridC({ day, lanes, showUnassigned, appointments, marks, onOpen }: WeekGridProps) {
  const days = weekDays(day);
  const cells = indexByCell(appointments);
  const perDay = countByDay(appointments, days);
  const perLane = countByLane(appointments);
  const today = todayKey();
  const rows: (StaffLane | null)[] = [...lanes, ...(showUnassigned ? [null] : [])];
  const short = laneShortNames(lanes);

  return (
    <div className="ws-c" data-testid="che-do-C">
      <div className="ws-c__grid" role="table" aria-label="Lịch tuần theo thợ">
        <div role="row" className="ws-c__row">
          <div role="columnheader" className="ws-c__corner">
            Thợ
          </div>
          {days.map((d) => (
            <div role="columnheader" key={d} className={cx('ws-c__dh', isWeekend(d) && 'is-we', d === today && 'is-today')}>
              <span className="ws-c__wd">{weekdayLong(d)}</span>
              <span className="ws-c__dm num">{ddmm(d)}</span>
              <span className="ws-c__cnt">{perDay[d] ?? 0} ca</span>
            </div>
          ))}
        </div>
        {rows.map((lane) => {
          const laneId = lane?.membershipId ?? UNASSIGNED;
          const n = perLane.get(laneId) ?? 0;
          return (
            <div role="row" className="ws-c__row" key={laneId}>
              <div role="rowheader" className={cx('ws-c__rh', !lane && 'is-na')}>
                <LaneAvatar lane={lane} />
                <span className="ws-c__who">
                  <span className="ws-c__nm" title={lane?.name}>
                    {lane ? (short.get(lane.membershipId) ?? lane.name) : 'Chưa có thợ'}
                  </span>
                  {/* Bậc thợ và số ca mỗi thứ một dòng, "2 ca/tuần" không bao giờ bị bẻ giữa chừng (biên bản L3). */}
                  {lane?.tierName && <span className="ws-c__meta">{lane.tierName}</span>}
                  <span className="ws-c__meta ws-nb">{n} ca/tuần</span>
                </span>
              </div>
              {days.map((d) => {
                const k = cellKey(laneId, d);
                const list = cells.get(k) ?? [];
                const flagged = marks.cells.get(k);
                return (
                  <div role="cell" key={d} className={cx('ws-c__cell', isWeekend(d) && 'is-we', flagged && 'is-conf')} data-cell={k}>
                    {flagged && (
                      <span className="ws-cflag">
                        <IconWarn />
                        Trùng {flagged.map((c) => `${hhmm(c.blockStart)}–${hhmm(c.blockEnd)}`).join(', ')}
                      </span>
                    )}
                    {list.map((a) => (
                      <ApptChip key={a.id} a={a} day={d} conflict={marks.appointmentIds.has(a.id)} onOpen={onOpen} />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
