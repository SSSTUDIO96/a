// Chế độ A — một ngày, mỗi thợ một cột theo trục giờ. Bản mẫu docs/rnd/phuong-an-A.html.
// Trục 04:00–18:00 (nới ra khi có ca ngoài khung), 64px/giờ (điện thoại 60px/giờ). Ô ca đặt tuyệt đối theo startsAt/endsAt;
// thời gian di chuyển trước/sau vẽ sọc mảnh phía trên/dưới ô. Ca chồng giờ trong một cột xếp thành làn cạnh nhau.
import type { CSSProperties } from 'react';
import type { Appointment } from '../../api/types';
import { StatusTag } from '../../ui';
import { appointmentsOfDay, axisHours, blockSpan, dayLoad, kindText, laneIdsOf, laneShortNames, layoutLanes, UNASSIGNED, type ConflictMarks, type StaffLane } from './model';
import { apptClasses, apptTip, cx, LaneAvatar, placeText, timeRange, useSwatchOf } from './parts';
import { formatHours, minutesFromDayStart, type DayKey } from './time';

export function StaffColumnsA({
  day,
  lanes,
  showUnassigned,
  appointments,
  marks,
  hourPx,
  onOpen,
}: {
  day: DayKey;
  lanes: StaffLane[];
  showUnassigned: boolean;
  appointments: Appointment[];
  marks: ConflictMarks;
  hourPx: number;
  onOpen: (a: Appointment) => void;
}) {
  const swatchOfName = useSwatchOf();
  const dayItems = appointmentsOfDay(appointments, day);
  const [fromH, toH] = axisHours(dayItems.map(blockSpan), day);
  const hours = Array.from({ length: toH - fromH }, (_, i) => fromH + i);
  const cols: (StaffLane | null)[] = [...lanes, ...(showUnassigned ? [null] : [])];
  const short = laneShortNames(lanes);
  const height = (toH - fromH) * hourPx;
  const y = (min: number) => ((min - fromH * 60) / 60) * hourPx;
  const style = {
    '--ws-hour': `${hourPx}px`,
    gridTemplateColumns: `var(--ws-axis) ${lanes.map(() => 'minmax(160px, 1fr)').join(' ')}${showUnassigned ? ' minmax(150px, .8fr)' : ''}`,
  } as CSSProperties;

  return (
    <div className="ws-a" data-testid="che-do-A">
      <div className="ws-a__in" style={style} role="table" aria-label="Lịch trong ngày theo cột thợ">
        <div className="ws-a__corner" role="columnheader" aria-label="Giờ" />
        {cols.map((lane) => {
          const id = lane?.membershipId ?? UNASSIGNED;
          const load = dayLoad(appointments, id, day);
          return (
            <div key={id} role="columnheader" className={cx('ws-a__colh', !lane && 'is-na')}>
              <LaneAvatar lane={lane} />
              <span className="ws-a__who">
                <span className="ws-a__nm" title={lane?.name}>
                  {lane ? (short.get(lane.membershipId) ?? lane.name) : 'Chưa có thợ'}
                </span>
                <span className="ws-a__meta">
                  {load.count} ca{lane ? ` · ${formatHours(load.minutes)}` : ''}
                </span>
              </span>
            </div>
          );
        })}

        <div className="ws-a__axis" aria-hidden="true" style={{ height }}>
          {hours.map((h) => (
            <div key={h} className="num">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {cols.map((lane) => {
          const id = lane?.membershipId ?? UNASSIGNED;
          const items = dayItems.filter((a) => laneIdsOf(a).includes(id));
          const lanesOf = layoutLanes(items.map(blockSpan));
          return (
            <div key={id} role="cell" className={cx('ws-a__col', !lane && 'is-na')} style={{ height }} data-col={id}>
              {items.map((a) => {
                const pos = lanesOf.get(a.id) ?? { lane: 0, lanes: 1 };
                const s = blockSpan(a);
                const top = y(minutesFromDayStart(s.start, day));
                const bottom = y(minutesFromDayStart(s.end, day));
                const workTop = y(minutesFromDayStart(a.startsAt, day));
                const workBottom = y(minutesFromDayStart(a.endsAt, day));
                const clampTop = Math.max(0, top);
                const clampBottom = Math.min(height, bottom);
                const conflict = marks.appointmentIds.has(a.id);
                const box: CSSProperties = {
                  top: clampTop,
                  height: Math.max(22, clampBottom - clampTop),
                  left: `calc(${(pos.lane / pos.lanes) * 100}% + 4px)`,
                  width: `calc(${100 / pos.lanes}% - 8px)`,
                };
                const beforePx = Math.max(0, Math.min(workTop, clampBottom) - clampTop);
                const afterPx = Math.max(0, clampBottom - Math.max(workBottom, clampTop));
                return (
                  <button
                    type="button"
                    key={a.id}
                    className={cx('ws-ev', apptClasses(a, conflict, swatchOfName(a.subjectName)))}
                    style={box}
                    title={apptTip(a)}
                    onClick={() => onOpen(a)}
                    data-appt={a.id}
                  >
                    {beforePx > 0 && <span className="ws-ev__travel is-before" style={{ height: beforePx }} aria-hidden="true" />}
                    <span className="ws-ev__body" style={{ paddingTop: beforePx, paddingBottom: afterPx }}>
                      <span className="ws-ev__tm num">
                        {timeRange(a)}
                        {conflict && <StatusTag tone="danger">Trùng</StatusTag>}
                      </span>
                      <span className="ws-ev__sv">{kindText(a)}</span>
                      {a.customer && <span className="ws-ev__kh">{a.customer.fullName}</span>}
                      {placeText(a) && <span className="ws-ev__nc">{placeText(a)}</span>}
                    </span>
                    {afterPx > 0 && <span className="ws-ev__travel is-after" style={{ height: afterPx }} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
