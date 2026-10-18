// Mảnh dùng chung giữa các chế độ của màn Lịch: ô ca, ảnh thợ, chú thích màu.
import { createContext, useContext } from 'react';
import { WORK_STATUS_LABELS } from '@makeup/shared';
import type { Appointment } from '../../api/types';
import { Avatar, AvatarStack, Tooltip, WithTooltip } from '../../ui';
import { isBlocking, kindLabel, kindText, quantityText, swatchOf, UNASSIGNED, type StaffLane, type Swatch } from './model';

// Danh sách nhân vật của tổ chức (thứ tự cố định) — để nhân vật tự thêm có màu ổn định. Màn cung cấp qua ngữ cảnh này.
export const OrgSubjectsContext = createContext<readonly string[]>([]);

export function useSwatchOf(): (subjectName: string | null) => Swatch {
  const subjects = useContext(OrgSubjectsContext);
  return (name) => swatchOf(name, subjects);
}
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
  if (a.subjectName) parts.push(a.subjectName);
  if (a.staff.length === 0) parts.push('Chưa có thợ');
  parts.push(WORK_STATUS_LABELS[a.status]);
  return parts.join(' · ');
}

export function apptClasses(a: Appointment, conflict: boolean, swatch: Swatch): string {
  return cx(
    `ws-sw-${swatch}`,
    a.staff.length === 0 && 'is-na',
    !isBlocking(a) && 'is-off',
    a.kind === 'PERSONAL_BLOCK' && 'is-block',
    conflict && 'is-x',
  );
}

// Chữ loại trên ô lưới C (ô hẹp, bản mẫu ghi "Tiệc", "Ăn hỏi"): bỏ chữ "Makeup" đứng đầu tên ca — app chỉ có ca makeup.
// Tên ca đầy đủ vẫn nằm trong tooltip và hộp chi tiết. KHÔNG kèm "× n": số lượng là thẻ riêng (ws-chip__qty) để không bị cắt.
export function chipKind(a: Pick<Appointment, 'title' | 'kind'>): string {
  const t = kindLabel(a).replace(/^makeup\s+/iu, '');
  return t.charAt(0).toLocaleUpperCase('vi') + t.slice(1);
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
  const swatchOfName = useSwatchOf();
  const qty = quantityText(a);
  return (
    <WithTooltip text={apptTip(a)} className="ws-chip-wrap">
      <button type="button" className={cx('ws-chip', apptClasses(a, conflict, swatchOfName(a.subjectName)))} onClick={() => onOpen(a)} data-appt={a.id}>
        <span className="ws-chip__top">
          <b className="num">{startLabel(a, day)}</b>
          <span className="ws-chip__kind">{chipKind(a)}</span>
          {qty && <span className="ws-chip__qty num">{qty}</span>}
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

export function Legend({ subjects, showUnassigned }: { subjects: { name: string | null; label: string }[]; showUnassigned: boolean }) {
  const swatchOfName = useSwatchOf();
  return (
    <div className="ws-legend" aria-label="Chú thích màu">
      {subjects.map((s) => (
        <span key={s.label} className={cx('ws-legend__i', `ws-sw-${swatchOfName(s.name)}`)}>
          <i aria-hidden="true" />
          {s.label}
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
      <Tooltip
        text="Màu theo nhân vật trên dòng hợp đồng gắn với ca. Ca không gắn nhân vật tô màu Khác. Ca nháp, đã huỷ, khách không đến không giữ giờ của thợ nên vẽ mờ."
        label="Giải thích màu ca"
      />
    </div>
  );
}

// Ảnh thợ của một ca: tên hiển thị và ảnh lấy thẳng từ ca (máy chủ gửi displayName, avatarUrl ký hạn 10 phút).
// Ca không mang initials → Avatar tự tính bằng initialsOf (ui/Avatar.tsx) — chép đúng luật máy chủ, và displayName của ca
// cùng nguồn với danh sách thợ (staffProfile.displayName ?? fullName) nên thẻ ca và đầu hàng ra cùng chữ (biên bản L2).
export function StaffAvatars({ a, size = 'sm' }: { a: Appointment; size?: 'md' | 'sm' | 'xs' }) {
  if (a.staff.length === 0) return <LaneAvatar lane={null} size={size} />;
  const people = a.staff.map((s) => ({ membershipId: s.membershipId, displayName: s.displayName, avatarUrl: s.avatarUrl }));
  return <AvatarStack people={people} size={size} max={2} />;
}

// Tên thợ của ca: "Thu Hà", nhiều thợ thì "Thu Hà (chính), Bảo Vy".
export function staffNames(a: Appointment): string {
  if (a.staff.length === 0) return 'Chưa có thợ';
  const many = a.staff.length > 1;
  return a.staff.map((s) => (many && s.role === 'PRIMARY' ? `${s.displayName} (chính)` : s.displayName)).join(', ');
}

export const LOCATION_LABELS = { STUDIO: 'Tại studio', CUSTOMER_HOME: 'Tại nhà khách', OTHER: 'Nơi khác' } as const;

// "Tại nhà khách – 128 Nguyễn Văn Cừ, Long Biên"
export function placeText(a: Pick<Appointment, 'locationType' | 'address'>): string {
  const parts: string[] = [];
  if (a.locationType) parts.push(LOCATION_LABELS[a.locationType]);
  if (a.address) parts.push(a.address);
  return parts.join(' – ');
}
