import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { archiveCourse, cancelClass, getCourse, listCourseGroups, listCourses, type ClassView } from '../../api/courses';
import { errorKind } from '../../api/errors';
import { NotFoundView } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { usePermissions } from '../../layout/usePermissions';
import { Button, Card, ConfirmDialog, IconPlus, ListDetail, Skeleton } from '../../ui';
import { IssueDialog } from '../certificates/IssueDialog';
import { todayInTz } from '../certificates/logic';
import { useLoad, useOrgInfo } from '../staff/useOrgInfo';
import { ClassDialog, type ClassDialogTarget } from './ClassDialog';
import { CourseDetail } from './CourseDetail';
import { CourseDialog, type CourseDialogTarget } from './CourseDialog';
import { CourseList, groupCourses } from './CourseList';
import { EnrollmentsDialog } from './EnrollmentsDialog';
import { GroupsDialog } from './GroupsDialog';
import { SessionSyncDialog } from './SessionSyncDialog';
import { LoadError } from './LoadError';
import { certPerms, coursePerms } from './logic';
import { usePickers } from './usePickers';
import './courses.css';

// Màn Đào tạo — Khoá & lớp (bản vẽ C3 mục 2.1, 2.2; bản mẫu v3-dao-tao-C #khoa-hoc…#lop-moi).
// /dao-tao: danh sách + chi tiết khoá đầu danh sách (máy tính, máy tính bảng); điện thoại chỉ danh sách.
// /dao-tao/:courseId: chi tiết một khoá (điện thoại: màn con có ‹).

type Modal =
  | { kind: 'course'; target: CourseDialogTarget }
  | { kind: 'class'; target: ClassDialogTarget }
  | { kind: 'groups' }
  | { kind: 'students'; cls: ClassView; title: string }
  | { kind: 'archive' }
  | { kind: 'cancel-class'; cls: ClassView }
  | { kind: 'calendar'; cls: ClassView; title: string }
  | { kind: 'certificates'; cls: ClassView; title: string };

export function CoursesPage() {
  const params = useParams();
  const courseId = (params['*'] ?? '').split('/')[0] || undefined;
  const navigate = useNavigate();
  const org = useOrgInfo();
  const has = usePermissions();
  const perms = useMemo(() => coursePerms(has), [has]);
  const cert = useMemo(() => certPerms(has), [has]);
  const phone = useBreakpoint() === 'phone';
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [needPickers, setNeedPickers] = useState(false);

  const courses = useLoad((signal) => listCourses(org.orgId, undefined, signal).then((r) => r.items), [org.orgId]);
  const groups = useLoad((signal) => listCourseGroups(org.orgId, signal).then((r) => r.items), [org.orgId]);
  const groupList = useMemo(() => (groups.state.status === 'ready' ? groups.state.data : []), [groups.state]);
  const courseItems = courses.state.status === 'ready' ? courses.state.data : null;

  const firstId = useMemo(() => {
    if (!courseItems) return null;
    return groupCourses(courseItems, groupList)[0]?.items[0]?.id ?? null;
  }, [courseItems, groupList]);
  const isChild = courseId !== undefined;
  const selectedId = courseId ?? (phone ? null : firstId);

  const detail = useLoad(selectedId ? (signal) => getCourse(org.orgId, selectedId, signal) : null, [org.orgId, selectedId]);
  const detailData = detail.state.status === 'ready' && detail.state.data.course.id === selectedId ? detail.state.data : null;

  const pickers = usePickers(org.orgId, needPickers, { staff: perms.staff, locations: perms.locations });
  const open = useCallback((m: Modal) => {
    if (m.kind === 'course' || m.kind === 'class') setNeedPickers(true);
    setModal(m);
  }, []);
  const close = useCallback(() => setModal(null), []);
  const reloadAll = useCallback(() => {
    courses.reload();
    groups.reload();
    detail.reload();
  }, [courses, groups, detail]);

  // Ngày hôm nay theo múi giờ của tổ chức: thẻ lớp dựa vào đó để bật / tắt nút Cấp chứng nhận.
  const today = todayInTz(org.timezone);
  const listUrl = `/${org.slug}/dao-tao`;
  const addCourse = () => open({ kind: 'course', target: { kind: 'create' } });

  const headerActions = (
    <>
      {perms.write && (
        <>
          <Button onClick={() => open({ kind: 'groups' })}>Cài đặt nhóm</Button>
          <Button variant="primary" icon={<IconPlus />} onClick={addCourse}>
            Thêm khoá
          </Button>
        </>
      )}
    </>
  );
  const phoneAction = perms.write && !isChild ? <Button variant="primary" size="sm" icon={<IconPlus />} aria-label="Thêm khoá" onClick={addCourse} /> : undefined;

  const listError = courses.state.status === 'error' ? <LoadError error={courses.state.error} retry={courses.reload} /> : null;

  let detailNode;
  if (!selectedId) {
    detailNode = null;
  } else if (detail.state.status === 'error' && errorKind(detail.state.error) === 'not_found') {
    detailNode = <NotFoundView message="Không tìm thấy khoá học (có thể đã lưu trữ)." backTo={listUrl} />;
  } else if (detail.state.status === 'error' && !detailData) {
    detailNode = <LoadError error={detail.state.error} retry={detail.reload} />;
  } else if (!detailData) {
    detailNode = (
      <Card>
        <div role="status" aria-label="Đang tải khoá học" className="kc-skel">
          <Skeleton width="45%" height={20} />
          <Skeleton width="70%" />
          <Skeleton height={56} />
          <Skeleton height={96} />
        </div>
      </Card>
    );
  } else {
    const { course, classes } = detailData;
    detailNode = (
      <CourseDetail
        course={course}
        classes={classes}
        groups={groupList}
        perms={perms}
        onEdit={() => open({ kind: 'course', target: { kind: 'edit', course, classes } })}
        onToMulti={() => open({ kind: 'course', target: { kind: 'edit', course, classes, mode: 'MULTI_CLASS' } })}
        onOpenClass={() => open({ kind: 'class', target: { kind: 'create' } })}
        onEditClass={(cls) => open({ kind: 'class', target: { kind: 'edit', cls } })}
        onStudents={(cls) => open({ kind: 'students', cls, title: course.mode === 'SINGLE_CLASS' ? course.name : cls.name })}
        onCalendar={(cls, title) => open({ kind: 'calendar', cls, title })}
        onCertificates={cert.issue ? (cls, title) => open({ kind: 'certificates', cls, title }) : undefined}
        today={today}
      />
    );
  }

  const title = phone && isChild && detailData ? detailData.course.name : 'Khoá & lớp';

  return (
    <>
      <PageHeader title={title} backTo={phone && isChild ? listUrl : undefined} actions={headerActions} phoneAction={phoneAction} />
      <ListDetail
        mobileView={isChild ? 'detail' : 'list'}
        listLabel="Danh sách khoá học"
        detailLabel="Chi tiết khoá học"
        list={
          <CourseList
            slug={org.slug}
            courses={courseItems}
            groups={groupList}
            loading={courses.state.status === 'loading'}
            error={listError}
            q={q}
            onQ={setQ}
            filter={filter}
            onFilter={setFilter}
            selectedId={phone ? null : selectedId}
            canWrite={perms.write}
            onAdd={addCourse}
            groupsButton={
              phone && perms.write ? (
                <Button size="sm" variant="ghost" onClick={() => open({ kind: 'groups' })}>
                  Cài đặt nhóm
                </Button>
              ) : undefined
            }
          />
        }
        detail={detailNode}
      />

      {modal?.kind === 'course' && (
        <CourseDialog
          orgId={org.orgId}
          target={modal.target}
          groups={groupList}
          pickers={pickers}
          can={{ staff: perms.staff, locations: perms.locations }}
          onClose={close}
          onArchive={modal.target.kind === 'edit' ? () => setModal({ kind: 'archive' }) : undefined}
          onSaved={(id, created) => {
            close();
            reloadAll();
            if (created || id !== selectedId) navigate(`${listUrl}/${id}`);
          }}
        />
      )}
      {modal?.kind === 'class' && detailData && (
        <ClassDialog
          orgId={org.orgId}
          course={detailData.course}
          classes={detailData.classes}
          target={modal.target}
          pickers={pickers}
          can={{ staff: perms.staff, locations: perms.locations }}
          onClose={close}
          onStale={reloadAll}
          onCancelClass={modal.target.kind === 'edit' ? () => modal.target.kind === 'edit' && setModal({ kind: 'cancel-class', cls: modal.target.cls }) : undefined}
          onSaved={() => {
            close();
            reloadAll();
          }}
        />
      )}
      {modal?.kind === 'groups' && (
        <GroupsDialog orgId={org.orgId} groups={groupList} canWrite={perms.write} onClose={close} onChanged={reloadAll} />
      )}
      {modal?.kind === 'students' && <EnrollmentsDialog orgId={org.orgId} cls={modal.cls} title={modal.title} onClose={close} />}
      {modal?.kind === 'certificates' && (
        <IssueDialog orgId={org.orgId} slug={org.slug} classId={modal.cls.id} title={modal.title} canEditBrand={cert.brandEdit} onClose={close} />
      )}
      {modal?.kind === 'calendar' && <SessionSyncDialog orgId={org.orgId} cls={modal.cls} title={modal.title} onClose={close} onDone={detail.reload} />}
      <ConfirmDialog
        open={modal?.kind === 'archive'}
        onClose={close}
        title={detailData ? `Lưu trữ khoá ${detailData.course.name}?` : 'Lưu trữ khoá?'}
        message="Khoá lưu trữ ẩn khỏi danh sách và không mở lớp mới được. Học viên, lớp và hợp đồng đã có giữ nguyên."
        confirmLabel="Lưu trữ"
        cancelLabel="Giữ khoá"
        requireReason
        reasonMaxLength={500}
        reasonPlaceholder="Ví dụ: Ngừng mở khoá này"
        onConfirm={async (reason) => {
          if (!detailData) return;
          await archiveCourse(org.orgId, detailData.course.id, reason);
          close();
          courses.reload();
          groups.reload();
          navigate(listUrl);
        }}
      />
      <ConfirmDialog
        open={modal?.kind === 'cancel-class'}
        onClose={close}
        danger
        title={modal?.kind === 'cancel-class' ? `Huỷ lớp ${modal.cls.name}?` : 'Huỷ lớp?'}
        message="Lớp đã huỷ không nhận ghi danh và không sửa được nữa. Lớp còn học viên thì phải chuyển hoặc huỷ ghi danh trước. Buổi học chưa diễn ra trên Lịch huỷ theo; buổi đã qua giữ nguyên."
        confirmLabel="Huỷ lớp"
        cancelLabel="Giữ lớp"
        requireReason
        reasonMaxLength={500}
        reasonPlaceholder="Ví dụ: Không đủ học viên"
        onConfirm={async (reason) => {
          if (modal?.kind !== 'cancel-class') return;
          await cancelClass(org.orgId, modal.cls.id, reason);
          close();
          reloadAll();
        }}
      />
    </>
  );
}
