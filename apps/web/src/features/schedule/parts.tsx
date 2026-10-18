// Mảnh dùng chung giữa các chế độ của màn Lịch: ô ca, ảnh thợ, chú thích màu.
import { WORK_STATUS_LABELS } from '@makeup/shared';
import type { Appointment } from '../../api/types';
import { Avatar, AvatarStack, Tooltip, WithTooltip } from '../../ui';
import { isBlocking, kindText, TONE_LABELS, TONE_RULE_TIP, toneOf, UNASSIGNED, type StaffLane } from './model';
import { dayKeyOf, hhmm, type DayKey } from './time';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// Giờ bắt đầu hiện trên ô của ngày `day`. Ca qua đêm: ở ngày sau ghi "đến HH:MM".
export function startLabel(a: Pick<Appointment, 'startsAt' | 'endsAt'>, day: DayKey): string {
  return dayKeyOf(a.startsAt) === day ? hhmm(a.startsAt) : `đến ${hhmm(a.endsAt)}`;
}

export function timeRange(a: Pick<Appointment, 'startsAt' | 'endsAt'>): string {
  return `${hhmm(a.startsAt)}–${hhmm(a.endsAt)}`;
}

// Chữ tooltip đầy đủ của một ca (tên khách đầy đủ khi trên ô bị cắt "…").
export function apptTip(a: Appointment): string {
  const parts = [timeRange(a), kindText(a)];
  if (a.customer) parts.push(a.customer.fullName);
  if (a.staff.length === 0) parts.push('Chưa có thợ');
  parts.push(WORK_STATUS_LABELS[a.status]);
  return parts.join(' · ');
}

export function apptClasses(a: Appointment, conflict: boolean): string {
  return cx(
    `ws-tone-${toneOf(a.title)}`,
    a.staff.length === 0 && 'is-na',
    !isBlocking(a) && 'is-off',
    a.kind === 'PERSONAL_BLOCK' && 'is-block',
    conflict && 'is-x',
  );
}

// Ô ca của lưới C (máy tính, máy tính bảng): giờ bắt đầu đậm · loại · tên khách một dòng.
export function ApptChip({
  a,
  day,
  conflict,
  onOpen,
}: {
  a: Appointment;
  day: DayKey;
  conflict: boolean;
  onOpen: (a: Appointment) => void;
}) {
  return (
    <WithTooltip text={apptTip(a)} className="ws-chip-wrap">
      <button type="button" className={cx('ws-chip', apptClasses(a, conflict))} onClick={() => onOpen(a)} data-appt={a.id}>
        <span className="ws-chip__top">
          <b className="num">{startLabel(a, day)}</b>
          <span className="ws-chip__kind">{kindText(a)}</span>
        </span>
        {a.customer && <span className="ws-chip__who">{a.customer.fullName}</span>}
      </button>
    </WithTooltip>
  );
}

export function LaneAvatar({ lane, size = 'md' }: { lane: StaffLane | null; size?: 'md' | 'sm' | 'xs' }) {
  if (!lane || lane.membershipId === UNASSIGNED) {
    return (
      <span className={cx('ws-av-na', size !== 'md' && `ws-av-na--${size}`)} aria-hidden="true">
        ?
      </span>
    );
  }
  return <Avatar name={lane.name} initials={lane.initials} avatarUrl={lane.avatarUrl} colorKey={lane.membershipId} size={size} />;
}

export function Legend({ showUnassigned }: { showUnassigned: boolean }) {
  return (
    <div className="ws-legend">
      {(['bride', 'engagement', 'event', 'other'] as const).map((t) => (
        <span key={t} className={cx('ws-legend__i', `ws-tone-${t}`)}>
          <i aria-hidden="true" />
          {TONE_LABELS[t]}
        </span>
      ))}
      {showUnassigned && (
        <span className="ws-legend__i ws-legend__i--na">
          <i aria-hidden="true" />
          Chưa có thợ
        </span>
      )}
      <span className="ws-legend__i ws-legend__i--off">
        <i aria-hidden="true" />
        Không chặn lịch
      </span>
      <Tooltip text={`${TONE_RULE_TIP} Ca nháp, đã huỷ, khách không đến không giữ giờ của thợ nên vẽ mờ.`} label="Giải thích màu ca" />
    </div>
  );
}

// Ảnh thợ của một ca: lấy ảnh/chữ viết tắt từ danh sách thợ (GET /staff) khi có, không thì từ tên trong ca.
export function StaffAvatars({ a, lanes, size = 'sm' }: { a: Appointment; lanes: readonly StaffLane[]; size?: 'md' | 'sm' | 'xs' }) {
  if (a.staff.length === 0) return <LaneAvatar lane={null} size={size} />;
  const people = a.staff.map((s) => {
    const lane = lanes.find((l) => l.membershipId === s.membershipId);
    return { membershipId: s.membershipId, displayName: lane?.name ?? s.fullName, initials: lane?.initials, avatarUrl: lane?.avatarUrl ?? null };
  });
  return <AvatarStack people={people} size={size} max={2} />;
}

// Tên thợ của ca: "Thu Hà", nhiều thợ thì "Thu Hà (chính), Bảo Vy".
export function staffNames(a: Appointment, lanes: readonly StaffLane[]): string {
  if (a.staff.length === 0) return 'Chưa có thợ';
  const many = a.staff.length > 1;
  return a.staff
    .map((s) => {
      const name = lanes.find((l) => l.membershipId === s.membershipId)?.name ?? s.fullName;
      return many && s.role === 'PRIMARY' ? `${name} (chính)` : name;
    })
    .join(', ');
}

export const LOCATION_LABELS = { STUDIO: 'Tại studio', CUSTOMER_HOME: 'Tại nhà khách', OTHER: 'Nơi khác' } as const;

// "Tại nhà khách – 128 Nguyễn Văn Cừ, Long Biên"
export function placeText(a: Pick<Appointment, 'locationType' | 'address'>): string {
  const parts: string[] = [];
  if (a.locationType) parts.push(LOCATION_LABELS[a.locationType]);
  if (a.address) parts.push(a.address);
  return parts.join(' – ');
}
