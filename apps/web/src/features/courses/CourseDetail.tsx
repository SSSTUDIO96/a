import type { ClassView, Course, CourseGroup } from '../../api/courses';
import { Button, Card, EmptyState, formatVnd, IconPlus, StatGrid, StatTile, StatusTag, Tooltip } from '../../ui';
import { ClassCard } from './ClassCard';
import { dayMonth, liveClasses, sessionText } from './logic';
import { ModeTag } from './ModeTag';
import type { CoursePerms } from './logic';

// Cột phải (bản vẽ C3 mục 2.1): thẻ đầu khoá (nhãn nhóm, nhãn kiểu, tên, Sửa, 4 ô số) + lớp.
// Một lớp: Học phí · Cọc mặc định · Thời gian · Số học viên tối đa; một thẻ lớp + nút "Chuyển sang nhiều lớp".
// Nhiều lớp: Học phí · Cọc mặc định · Số buổi · Tối đa mặc định; thẻ "Lịch khai giảng" + nút "Mở lớp".

export interface CourseDetailProps {
  course: Course;
  classes: ClassView[];
  groups: CourseGroup[];
  perms: CoursePerms;
  onEdit: () => void;
  onToMulti: () => void;
  onOpenClass: () => void;
  onEditClass: (k: ClassView) => void;
  onStudents: (k: ClassView) => void;
  // Nút "Đưa lên Lịch" ở thẻ lớp (hiện khi perms.calendar). title = tên hiện trên thẻ.
  onCalendar?: (k: ClassView, title: string) => void;
  // Nút "Cấp chứng nhận" ở thẻ lớp (màn chỉ truyền khi có certificates.issue). today = "YYYY-MM-DD" theo múi giờ tổ chức; bắt buộc đi cùng onCertificates.
  onCertificates?: (k: ClassView, title: string) => void;
  today?: string;
}

export function CourseDetail({ course, classes, groups, perms, onEdit, onToMulti, onOpenClass, onEditClass, onStudents, onCalendar, onCertificates, today }: CourseDetailProps) {
  const group = groups.find((g) => g.id === course.groupId);
  const single = course.mode === 'SINGLE_CLASS';
  const live = liveClasses(classes);
  const cancelled = classes.filter((k) => k.status === 'CANCELLED');
  const only = single ? live[0] : undefined;
  const session = sessionText(course);

  const head = (
    <section className="ui-card kc-head" aria-label={`Khoá ${course.name}`}>
      <div className="kc-head__top">
        <span className="kc-head__tags">
          <StatusTag tone="accent">{group ? group.name : 'Chưa xếp nhóm'}</StatusTag>
          <ModeTag mode={course.mode} />
        </span>
        <h2 className="kc-head__name">{course.name}</h2>
        {perms.write && (
          <Button size="sm" onClick={onEdit}>
            Sửa
          </Button>
        )}
      </div>
      <p className="kc-head__sub">
        {course.code}
        {course.description ? ` · ${course.description}` : ''}
      </p>
      <StatGrid label="Thông tin khoá" className="kc-facts">
        <StatTile label="Học phí" value={formatVnd(course.tuitionFee)} />
        <StatTile label="Cọc mặc định" value={formatVnd(course.depositAmount)} />
        {single ? (
          <>
            <StatTile label="Thời gian" value={only ? `${dayMonth(only.startDate)} → ${dayMonth(only.endDate)}` : 'Chưa có lớp'} />
            <StatTile label="Số học viên tối đa" value={only ? String(only.capacity) : String(course.defaultCapacity)} />
          </>
        ) : (
          <>
            <StatTile label="Số buổi" value={session ?? 'Chưa đặt'} />
            <StatTile label="Tối đa mặc định" tip="Gợi ý sẵn khi mở lớp mới; mỗi lớp sửa riêng được." value={`${course.defaultCapacity} học viên`} />
          </>
        )}
      </StatGrid>
    </section>
  );

  if (single) {
    return (
      <>
        {head}
        <Card title="Học viên & lịch học" className="kc-classes">
          {only ? (
            <ClassCard
              cls={only}
              title={course.name}
              canEnroll={perms.enroll}
              onEdit={perms.write ? onEdit : undefined}
              onStudents={() => onStudents(only)}
              onCalendar={perms.calendar && onCalendar ? () => onCalendar(only, course.name) : undefined}
              onCertificates={onCertificates ? () => onCertificates(only, course.name) : undefined}
              today={today}
            />
          ) : (
            <EmptyState message="Lớp của khoá này đã huỷ." />
          )}
          {perms.write && (
            <div className="kc-tomulti">
              <Button size="sm" variant="ghost" className="kc-link" onClick={onToMulti}>
                Chuyển sang nhiều lớp
              </Button>
              <Tooltip text="Khoá một lớp: thời gian, lịch học và số tối đa nằm ngay trong khoá. Chuyển sang nhiều lớp: lớp hiện tại thành lớp đầu tiên, giữ nguyên học viên và hợp đồng, rồi mở thêm lớp K2, K3…" />
            </div>
          )}
          {cancelled.length > 0 && <CancelledList classes={cancelled} title={course.name} onStudents={onStudents} />}
        </Card>
      </>
    );
  }

  return (
    <>
      {head}
      <Card
        title="Lịch khai giảng"
        subtitle={`${live.length} lớp`}
        className="kc-classes"
        actions={
          perms.write ? (
            <Button size="sm" icon={<IconPlus />} onClick={onOpenClass}>
              Mở lớp
            </Button>
          ) : undefined
        }
      >
        {live.length === 0 ? (
          <EmptyState
            message="Chưa mở lớp nào."
            action={
              perms.write ? (
                <Button variant="dashed" size="sm" icon={<IconPlus />} onClick={onOpenClass}>
                  Mở lớp
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="kc-class-list">
            {live.map((k) => (
              <ClassCard
                key={k.id}
                cls={k}
                title={k.name}
                canEnroll={perms.enroll}
                onEdit={perms.write ? () => onEditClass(k) : undefined}
                onStudents={() => onStudents(k)}
                onCalendar={perms.calendar && onCalendar ? () => onCalendar(k, k.name) : undefined}
                onCertificates={onCertificates ? () => onCertificates(k, k.name) : undefined}
                today={today}
              />
            ))}
          </div>
        )}
        {cancelled.length > 0 && <CancelledList classes={cancelled} onStudents={onStudents} />}
      </Card>
    </>
  );
}

function CancelledList({ classes, title, onStudents }: { classes: ClassView[]; title?: string; onStudents: (k: ClassView) => void }) {
  return (
    <details className="kc-cancelled">
      <summary>Lớp đã huỷ ({classes.length})</summary>
      <div className="kc-class-list">
        {classes.map((k) => (
          <ClassCard key={k.id} cls={k} title={title ?? k.name} canEnroll={false} onStudents={() => onStudents(k)} />
        ))}
      </div>
    </details>
  );
}
