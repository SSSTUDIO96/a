import type { ClassView } from '../../api/courses';
import { Avatar, Button, IconCalendar, IconClock, StatusTag } from '../../ui';
import { IconPin, IconUsers } from './icons';
import { fullDate, scheduleText, seatInfo } from './logic';
import { OffButton } from './OffButton';
import { SeatBar, SeatTag } from './SeatTag';

// Thẻ lớp (bản vẽ C3 mục 2.1): ai, khi nào, ở đâu + thanh đầy + "x đã ghi danh / tối đa y" + nút Ghi danh.
// Ghi danh = lập hợp đồng khoá học — màn đó CHƯA có trên web, nên nút tắt kèm lý do (không làm giả).
export const ENROLL_SOON = 'Lập hợp đồng khoá học — sắp có';
export const FULL_REASON = 'Lớp đã đủ số học viên tối đa';
export const CLOSED_REASON = 'Lớp đã ngừng nhận ghi danh';

export interface ClassCardProps {
  cls: ClassView;
  // Tên hiện trên thẻ (khoá Một lớp: tên khoá).
  title: string;
  canEnroll: boolean;
  // Có thì hiện nút "Sửa" (courses.write).
  onEdit?: () => void;
  onStudents: () => void;
}

export function ClassCard({ cls, title, canEnroll, onEdit, onStudents }: ClassCardProps) {
  const seat = seatInfo(cls.enrolledCount, cls.capacity);
  const cancelled = cls.status === 'CANCELLED';
  const closed = cls.status === 'CLOSED';
  const state = cancelled ? 'cancelled' : seat.state === 'FULL' ? 'full' : 'open';
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
            <Avatar name={cls.instructor.name} colorKey={cls.instructor.membershipId} size="xs" />
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
          {canEnroll && !cancelled &&
            (seat.state === 'FULL' ? (
              <OffButton label="Hết chỗ" reason={FULL_REASON} />
            ) : closed ? (
              <OffButton label="Ghi danh" reason={CLOSED_REASON} variant="primary" />
            ) : (
              <OffButton label="Ghi danh" reason={ENROLL_SOON} variant="primary" />
            ))}
        </span>
      </div>
    </article>
  );
}
