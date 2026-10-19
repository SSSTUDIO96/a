// Cửa vào gói W6 Lịch (bản vẽ C mục 4.1). Thợ W6 giữ toàn bộ thư mục này; routes.tsx chỉ nhập từ tệp này.
// Ba chế độ: C (lưới tuần thợ × ngày, MẶC ĐỊNH mỗi lần mở) · B (danh sách theo ngày) · A (cột theo thợ, một ngày).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { errorKind, userMessage } from '../../api/errors';
import { getAppointment } from '../../api/schedule';
import type { Appointment, AppointmentConflict } from '../../api/types';
import { useSession } from '../../app/session';
import { ForbiddenBanner } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { usePermissions } from '../../layout/usePermissions';
import { Button, EmptyState, IconPlus, Skeleton } from '../../ui';
import { AppointmentDialog, type DialogTarget } from './AppointmentDialog';
import { DayListB } from './DayListB';
import { FilterDialog } from './FilterDialog';
import { accessFrom, buildStaffLanes, conflictMarks, lanesRoster, DEFAULT_MODE, legendSubjects, type ScheduleAccess, type ScheduleMode } from './model';
import { cx, Legend, OrgSubjectsContext, StaffNamingContext } from './parts';
import { staffNaming } from '../../ui/staffName';
import { StaffColumnsA } from './StaffColumnsA';
import { addDays, dayKeyOf, dayLabel, isDayKey, todayKey, weekLabel, type DayKey } from './time';
import { Toolbar } from './Toolbar';
import { useOrgSubjects, useStaffList, useWeekAppointments, type ScheduleFilter } from './useScheduleData';
import { WeekGridC } from './WeekGridC';
import { WeekGridCMobile } from './WeekGridCMobile';
import './schedule.css';

export function SchedulePage() {
  const { orgSlug } = useParams();
  const { organizations, user } = useSession();
  const has = usePermissions();
  const org = organizations.find((o) => o.slug === orgSlug);
  const access = useMemo(() => accessFrom(has), [has]);
  const membershipId = org?.membershipId ?? '';
  const fullName = user?.fullName ?? '';
  const self = useMemo(() => ({ membershipId, name: fullName }), [membershipId, fullName]);
  if (!org || !user) return null;
  return <ScheduleScreen orgId={org.id} orgSlug={org.slug} self={self} access={access} />;
}

export function ScheduleScreen({
  orgId,
  orgSlug,
  self,
  access,
}: {
  orgId: string;
  orgSlug: string;
  self: { membershipId: string; name: string };
  access: ScheduleAccess;
}) {
  const [params, setParams] = useSearchParams();
  const bp = useBreakpoint();
  const phone = bp === 'phone';
  // Mặc định C mỗi lần mở màn — không nhớ lựa chọn lần trước (quyết định của anh Chiến, đè lên chữ "lưu localStorage" ở bản vẽ).
  const [mode, setMode] = useState<ScheduleMode>(DEFAULT_MODE);
  const [day, setDay] = useState<DayKey>(() => {
    const q = params.get('ngay');
    return isDayKey(q) ? q : todayKey();
  });
  const [filter, setFilter] = useState<ScheduleFilter>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [dialogSeq, setDialogSeq] = useState(0);
  const [conflicts, setConflicts] = useState<AppointmentConflict[] | null>(null);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);

  const { state, reload } = useWeekAppointments(orgId, day, filter, access.readAll);
  const staff = useStaffList(orgId, access.staffRead);
  const orgSubjects = useOrgSubjects(orgId, access.catalogRead);
  const appointments = useMemo(() => (state.status === 'ready' ? state.items : []), [state]);
  const allLanes = useMemo(
    () => buildStaffLanes({ staff, appointments, readAll: access.readAll, self }),
    [staff, appointments, access.readAll, self],
  );
  // R2/R4: tên ngắn + màu ảnh thợ xét trên sổ thợ (danh sách thợ của tổ chức ∪ thợ của các ca), TRƯỚC bộ lọc thợ.
  const naming = useMemo(() => staffNaming(lanesRoster(staff, allLanes)), [staff, allLanes]);
  const lanes = filter.membershipId ? allLanes.filter((l) => l.membershipId === filter.membershipId) : allLanes;
  const showUnassigned = access.readAll && !filter.membershipId;
  const marks = useMemo(() => conflictMarks(conflicts), [conflicts]);

  const openDialog = useCallback((t: DialogTarget) => {
    setDialog(t);
    setDialogSeq((n) => n + 1);
  }, []);
  const openCreate = useCallback(() => openDialog({ kind: 'create', day }), [openDialog, day]);
  const openView = useCallback((a: Appointment) => openDialog({ kind: 'view', appointment: a }), [openDialog]);
  const openAssign = useCallback((a: Appointment) => openDialog({ kind: 'edit', appointment: a, focus: 'staff' }), [openDialog]);

  // Liên kết sâu ?ca=<id> (ví dụ "Đổi ở Lịch" từ hợp đồng đã xác nhận): mở đúng tuần và đúng ca.
  const deepId = params.get('ca');
  useEffect(() => {
    if (!deepId) return undefined;
    const controller = new AbortController();
    getAppointment(orgId, deepId, controller.signal)
      .then((a) => {
        setDay(dayKeyOf(a.startsAt));
        openDialog({ kind: 'view', appointment: a });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setDeepLinkError(userMessage(err));
      });
    return () => controller.abort();
  }, [orgId, deepId, openDialog]);

  const phoneAction = useMemo(
    () =>
      access.write ? (
        <Button variant="primary" size="sm" icon={<IconPlus />} onClick={openCreate}>
          Lịch
        </Button>
      ) : undefined,
    [access.write, openCreate],
  );

  const step = mode === 'A' ? 1 : 7;
  const navLabel = mode === 'A' ? dayLabel(day) : weekLabel(day);
  const filterCount = (filter.membershipId ? 1 : 0) + (filter.status ? 1 : 0);

  let body;
  if (state.status === 'loading') body = <GridSkeleton />;
  else if (state.status === 'error') {
    body =
      errorKind(state.error) === 'forbidden' ? (
        <ForbiddenBanner>{userMessage(state.error)}</ForbiddenBanner>
      ) : (
        <EmptyState message={`Không tải được lịch. ${userMessage(state.error)}`} action={<Button onClick={reload}>Thử lại</Button>} />
      );
  } else if (mode === 'C') {
    body = phone ? (
      <WeekGridCMobile day={day} onSelectDay={setDay} lanes={lanes} showUnassigned={showUnassigned} appointments={appointments} marks={marks} onOpen={openView} />
    ) : (
      <WeekGridC day={day} lanes={lanes} showUnassigned={showUnassigned} appointments={appointments} marks={marks} onOpen={openView} />
    );
  } else if (mode === 'B') {
    body = (
      <DayListB
        day={day}
        onSelectDay={setDay}
        lanes={lanes}
        showUnassigned={showUnassigned}
        appointments={appointments}
        marks={marks}
        canWrite={access.write}
        showLoadPanel={!phone}
        onOpen={openView}
        onAssign={openAssign}
      />
    );
  } else {
    body = (
      <StaffColumnsA
        day={day}
        lanes={lanes}
        showUnassigned={showUnassigned}
        appointments={appointments}
        marks={marks}
        hourPx={phone ? 60 : 64}
        onOpen={openView}
      />
    );
  }

  return (
    <OrgSubjectsContext.Provider value={orgSubjects}>
      <StaffNamingContext.Provider value={naming}>
      <div className={cx('ws', `ws--${mode}`)} data-mode={mode}>
        <PageHeader title="Lịch makeup" phoneAction={phoneAction} />
        {deepLinkError && (
          <div className="ws-err" role="alert">
            {deepLinkError}{' '}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDeepLinkError(null);
                params.delete('ca');
                setParams(params, { replace: true });
              }}
            >
              Đóng
            </Button>
          </div>
        )}
        <section className="ws-panel" aria-label="Lịch makeup">
          <Toolbar
            mode={mode}
            onMode={setMode}
            label={navLabel}
            prevLabel={mode === 'A' ? 'Ngày trước' : 'Tuần trước'}
            nextLabel={mode === 'A' ? 'Ngày sau' : 'Tuần sau'}
            onPrev={() => setDay((d) => addDays(d, -step))}
            onNext={() => setDay((d) => addDays(d, step))}
            onToday={() => setDay(todayKey())}
            canAdd={access.write}
            onAdd={openCreate}
            conflictCount={marks.count}
            filterCount={filterCount}
            onFilter={() => setFilterOpen(true)}
            phone={phone}
          />
          <div className="ws-body">{body}</div>
          {mode === 'C' && !phone && state.status === 'ready' && <Legend subjects={legendSubjects(appointments, orgSubjects)} showUnassigned={showUnassigned} />}
        </section>

        {filterOpen && (
          <FilterDialog value={filter} lanes={allLanes} canFilterStaff={access.readAll} onApply={setFilter} onClose={() => setFilterOpen(false)} />
        )}
        {dialog && (
          <AppointmentDialog
            key={dialogSeq}
            orgId={orgId}
            orgSlug={orgSlug}
            target={dialog}
            access={access}
            staffMembers={staff}
            lanes={allLanes}
            onClose={() => {
              setDialog(null);
              setConflicts(null);
              if (deepId) {
                params.delete('ca');
                setParams(params, { replace: true });
              }
            }}
            onSaved={() => reload()}
            onConflicts={setConflicts}
          />
        )}
      </div>
      </StaffNamingContext.Provider>
    </OrgSubjectsContext.Provider>
  );
}

// Tải lần đầu: khối chờ đúng bố cục lưới (hàng thợ × 7 ngày), không vòng xoay giữa màn.
function GridSkeleton() {
  return (
    <div className="ws-skel" role="status" aria-label="Đang tải lịch">
      {Array.from({ length: 4 }, (_, r) => (
        <div key={r} className="ws-skel__row">
          <Skeleton width={120} height={32} />
          {Array.from({ length: 7 }, (_, c) => (
            <Skeleton key={c} height={44} />
          ))}
        </div>
      ))}
    </div>
  );
}
