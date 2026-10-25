import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import type { ClassView } from '../../api/courses';
import { Avatar, Button, IconCalendar, IconClock, StatusTag } from '../../ui';
import { IconPin, IconUsers } from './icons';
import { calendarText, certNotEndedReason, fullDate, isClassEnded, NO_TIME_REASON, scheduleText, seatInfo } from './logic';
import { OffButton } from './OffButton';
import { SeatBar, SeatTag } from './SeatTag';
import { staffInitials, useCurrentOrgStaffNaming } from '../staff/useStaffNaming';

// Thẻ lớp (bản vẽ C3 mục 2.1): ai, khi nào, ở đâu + thanh đầy + "x đã ghi danh / tối đa y" + nút Ghi danh.
// Ghi danh = mở Lập hợp đồng khoá học, chọn sẵn lớp: /:orgSlug/hop-dong/moi?kind=COURSE&classId=<id> (cần contracts.write).
export const ENROLL_TIP = 'Lập hợp đồng khoá học, chọn sẵn lớp này';
export const FULL_REASON = 'Lớp đã đủ số học viên tối đa';
export const CLOSED_REASON = 'Lớp đã ngừng nhận ghi danh';

// Biểu tượng giấy chứng nhận (chưa có trong ui/icons; nét 18px như icons.tsx của màn).
function IconCertificate() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8" />
      <path d="M7.5 8.5h9M7.5 11.5h5" />
      <path d="M9 16v4l3-1.8 3 1.8v-4" />
    </svg>
  );
}

export interface ClassCardProps {
  cls: ClassView;
  // Tên hiện trên thẻ (khoá Một lớp: tên khoá).
  title: string;
  canEnroll: boolean;
  // Có thì hiện nút "Sửa" (courses.write).
  onEdit?: () => void;
  onStudents: () => void;
  // Có thì hiện nút "Đưa lên Lịch" / "Cập nhật Lịch" (courses.write + schedule.write).
  onCalendar?: () => void;
  // Có thì hiện nút "Cấp chứng nhận" (certificates.issue, bản vẽ F mục 6.1). Phải kèm `today` ("YYYY-MM-DD" theo múi giờ tổ chức):
  // lớp chưa kết thúc → nút tắt kèm lý do; đã kết thúc → nút chính, thay chỗ nút Ghi danh. Lớp đã huỷ không có nút.
  onCertificates?: () => void;
  today?: string;
}

export function ClassCard({ cls, title, canEnroll, onEdit, onStudents, onCalendar, onCertificates, today }: ClassCardProps) {
  if (onCertificates && today === undefined) throw new Error('ClassCard: có onCertificates thì phải truyền today (ngày hôm nay theo múi giờ tổ chức)');
  const { orgSlug } = useParams();
  const seat = seatInfo(cls.enrolledCount, cls.capacity);
  // L2: màu + chữ tắt ảnh giảng viên qua sổ thợ chung (ui/staffName.ts) — cùng màu với Thợ makeup, Lịch.
  const inst = cls.instructor;
  const shownStaff = useMemo(() => (inst ? [{ membershipId: inst.membershipId, displayName: inst.name }] : []), [inst]);
  const naming = useCurrentOrgStaffNaming(shownStaff);
  const cancelled = cls.status === 'CANCELLED';
  const closed = cls.status === 'CLOSED';
  const state = cancelled ? 'cancelled' : seat.state === 'FULL' ? 'full' : 'open';
  const cal = calendarText(cls);
  const hasTime = cls.startTime !== null && cls.endTime !== null;
  const calLabel = cls.calendar.total === 0 ? 'Đưa lên Lịch' : 'Cập nhật Lịch';
  const certMode = onCertificates && !cancelled && today !== undefined ? (isClassEnded(cls.endDate, today) ? 'ready' : 'wait') : null;
  return (
    <article className={`kc-class kc-class--${state}`} aria-label={`Lớp ${title}`}>
      <div className="kc-class__t">
        <b className="kc-class__name">{title}</b>
        {cancelled ? <StatusTag tone="danger">Đã huỷ</StatusTag> : <SeatTag enrolledCount={cls.enrolledCount} capacity={cls.capacity} />}
        {closed && <StatusTag tone="neutral">Ngừng nhận ghi danh</StatusTag>}
      </div>
      <div className="kc-who">
        <span>
          <IconCalendar />
          {fullDate(cls.startDate)} → {fullDate(cls.endDate)}
        </span>
        <span>
          <IconClock />
          {scheduleText(cls)}
        </span>
        {cls.instructor ? (
          <span>
            <Avatar name={cls.instructor.name} initials={staffInitials({ displayName: cls.instructor.name })} colorKey={naming.colorKey(cls.instructor.membershipId)} size="xs" />
            {cls.instructor.name}
          </span>
        ) : (
          <span className="kc-who__none">Chưa gán giảng viên</span>
        )}
        {cls.location ? (
          <span title={cls.location.address}>
            <IconPin />
            {cls.location.name}
          </span>
        ) : (
          <span className="kc-who__none">
            <IconPin />
            Chưa chọn nơi học
          </span>
        )}
      </div>
      <SeatBar enrolledCount={cls.enrolledCount} capacity={cls.capacity} />
      <div className={`kc-cal${cal.on ? ' is-on' : ''}`}>
        <IconCalendar />
        <span>{cal.label}</span>
      </div>
      <div className="kc-class__act">
        <span className="kc-class__count">
          <b className="num">{cls.enrolledCount}</b> đã ghi danh / tối đa <b className="num">{cls.capacity}</b>
        </span>
        <span className="kc-class__btns">
          <Button size="sm" variant="ghost" icon={<IconUsers />} onClick={onStudents}>
            Học viên
          </Button>
          {onEdit && !cancelled && (
            <Button size="sm" onClick={onEdit}>
              Sửa
            </Button>
          )}
          {onCalendar &&
            !cancelled &&
            (hasTime ? (
              <Button size="sm" onClick={onCalendar} title="Đưa các buổi học của lớp lên Lịch theo thứ và giờ học — bấm lại không sinh trùng">
                {calLabel}
              </Button>
            ) : (
              <OffButton label={calLabel} reason={NO_TIME_REASON} />
            ))}
          {certMode === 'wait' && <OffButton label="Cấp chứng nhận" reason={certNotEndedReason(cls.endDate)} />}
          {certMode === 'ready' && (
            <Button size="sm" variant="primary" icon={<IconCertificate />} onClick={onCertificates}>
              Cấp chứng nhận
            </Button>
          )}
          {canEnroll && !cancelled && certMode !== 'ready' &&
            (seat.state === 'FULL' ? (
              <OffButton label="Hết chỗ" reason={FULL_REASON} />
            ) : closed ? (
              <OffButton label="Ghi danh" reason={CLOSED_REASON} variant="primary" />
            ) : (
              <Link
                className="ui-btn ui-btn--primary ui-btn--sm"
                style={{ textDecoration: 'none' }}
                to={`/${orgSlug ?? ''}/hop-dong/moi?kind=COURSE&classId=${encodeURIComponent(cls.id)}`}
                title={ENROLL_TIP}
              >
                <span className="ui-btn__text">Ghi danh</span>
              </Link>
            ))}
        </span>
      </div>
    </article>
  );
}
