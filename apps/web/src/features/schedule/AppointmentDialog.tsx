// Hộp thoại ca: xem chi tiết · sửa · tạo mới · đổi trạng thái · phân thợ. Bản vẽ C 4.1 "Tạo / sửa ca", luật 409.
// Tiền KHÔNG nằm ở lịch: ca gắn hợp đồng chỉ hiện liên kết sang hợp đồng (/:orgSlug/hop-dong/:id).
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router';
import { INITIAL_STATUSES, isTerminalStatus, MAX_TRAVEL_MIN, WORK_STATUS_LABELS, type WorkStatus } from '@makeup/shared';
import { errorKind, fieldErrors, userMessage } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { changeAppointmentStatus, createAppointment, listCustomers, updateAppointment } from '../../api/schedule';
import type {
  Appointment,
  AppointmentConflict,
  AppointmentCreateInput,
  AppointmentUpdateInput,
  Customer,
  InitialWorkStatus,
  LocationType,
  StaffMember,
  StaffRole,
} from '../../api/types';
import {
  Button,
  Checkbox,
  ContractStatusTag,
  DateInput,
  Dialog,
  Segmented,
  SettingRow,
  TextInput,
  Textarea,
  TimeInput,
  Tooltip,
  UnitInput,
  WorkStatusTag,
} from '../../ui';
import { ConflictBanner } from './ConflictBanner';
import { conflictsOf, isMakeupStaff, kindText, whoText, type ScheduleAccess, type StaffLane } from './model';
import { cx, LOCATION_LABELS, StaffAvatars, staffNames } from './parts';
import { StatusActions } from './StatusActions';
import { addDays, dayKeyOf, dayLabel, ddmm, formatDuration, hhmm, vnIso, weekdayLong, type DayKey } from './time';

export type DialogTarget =
  | { kind: 'view'; appointment: Appointment }
  | { kind: 'edit'; appointment: Appointment; focus?: 'staff' | 'time' }
  | { kind: 'create'; day: DayKey; laneId?: string };

interface StaffPick {
  membershipId: string;
  role: StaffRole;
}

interface FormState {
  title: string;
  day: DayKey;
  start: string;
  end: string;
  // T3: ca kết thúc hôm sau CHỈ khi người dùng tick rõ "Kết thúc hôm sau" — không tự đoán từ giờ ngược.
  nextDay: boolean;
  travelBefore: number | null;
  travelAfter: number | null;
  locationType: LocationType | null;
  address: string;
  notes: string;
  staff: StaffPick[];
  status: InitialWorkStatus;
  customer: Pick<Customer, 'id' | 'fullName' | 'phone'> | null;
  newCustomer: { fullName: string; phone: string } | null;
}

// Trạng thái ban đầu mặc định = mặc định của máy chủ (schedule/appointments.ts CreateBody: status default 'DRAFT').
const DEFAULT_INITIAL: InitialWorkStatus = 'DRAFT';

function formFrom(a: Appointment): FormState {
  return {
    title: a.title ?? '',
    day: dayKeyOf(a.startsAt),
    start: hhmm(a.startsAt),
    end: hhmm(a.endsAt),
    nextDay: dayKeyOf(a.endsAt) !== dayKeyOf(a.startsAt),
    travelBefore: a.travelBeforeMin,
    travelAfter: a.travelAfterMin,
    locationType: a.locationType,
    address: a.address ?? '',
    notes: a.notes ?? '',
    staff: a.staff.map((s) => ({ membershipId: s.membershipId, role: s.role })),
    status: DEFAULT_INITIAL,
    customer: a.customer,
    newCustomer: null,
  };
}

function emptyForm(day: DayKey, laneId?: string): FormState {
  return {
    title: '',
    day,
    start: '',
    end: '',
    nextDay: false,
    travelBefore: 0,
    travelAfter: 0,
    locationType: null,
    address: '',
    notes: '',
    staff: laneId ? [{ membershipId: laneId, role: 'PRIMARY' }] : [],
    status: DEFAULT_INITIAL,
    customer: null,
    newCustomer: null,
  };
}

// T3 (biên bản web 2 — sửa quyết định 7 cũ của thợ W6): giờ kết thúc ≤ giờ bắt đầu là LỖI, trừ khi người dùng tick
// "Kết thúc hôm sau". Trước đây màn tự hiểu là ca qua đêm → gõ nhầm 09:00 – 08:30 thành ca 23,5 giờ.
// Ca qua đêm tối đa 24 giờ (MAX_APPOINTMENT_MS của máy chủ) → khi đã tick, giờ kết thúc hôm sau không được muộn hơn giờ bắt đầu.
export const END_BEFORE_START = 'Giờ kết thúc phải sau giờ bắt đầu';
export const OVERNIGHT_TOO_LONG = 'Ca qua đêm tối đa 24 giờ — giờ kết thúc hôm sau phải sớm hơn hoặc bằng giờ bắt đầu';

const validDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const validTime = (t: string) => /^\d{2}:\d{2}$/.test(t);

export function timeOrderError(f: Pick<FormState, 'start' | 'end' | 'nextDay'>): string | null {
  if (!validTime(f.start) || !validTime(f.end)) return null;
  if (!f.nextDay && f.end <= f.start) return END_BEFORE_START;
  if (f.nextDay && f.end > f.start) return OVERNIGHT_TOO_LONG;
  return null;
}

export function timesOf(f: Pick<FormState, 'day' | 'start' | 'end' | 'nextDay'>): { startsAt: string; endsAt: string; endDay: DayKey } | null {
  if (!validDay(f.day) || !validTime(f.start) || !validTime(f.end) || timeOrderError(f)) return null;
  const endDay = f.nextDay ? addDays(f.day, 1) : f.day;
  return { startsAt: vnIso(f.day, f.start), endsAt: vnIso(endDay, f.end), endDay };
}

const sameStaff = (a: readonly StaffPick[], b: readonly StaffPick[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.membershipId === x.membershipId && y.role === x.role));

const nn = (s: string) => (s.trim() === '' ? null : s.trim());

export function AppointmentDialog({
  orgId,
  orgSlug,
  target,
  access,
  staffMembers,
  lanes,
  onClose,
  onSaved,
  onConflicts,
}: {
  orgId: string;
  orgSlug: string;
  target: DialogTarget;
  access: ScheduleAccess;
  staffMembers: StaffMember[] | null;
  lanes: StaffLane[];
  onClose: () => void;
  // Đã ghi xong (tạo, sửa, đổi trạng thái): tải lại lưới. `keepOpen` = ca sau khi ghi (để hộp ở lại chế độ xem).
  onSaved: (keepOpen: Appointment | null) => void;
  onConflicts: (conflicts: AppointmentConflict[] | null) => void;
}) {
  const initialMode = target.kind;
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>(initialMode);
  const [appt, setAppt] = useState<Appointment | null>(target.kind === 'create' ? null : target.appointment);
  const [form, setForm] = useState<FormState>(() => (target.kind === 'create' ? emptyForm(target.day, target.laneId) : formFrom(target.appointment)));
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState<WorkStatus | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<AppointmentConflict[] | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | undefined>(undefined);
  // Đổi mỗi lần hộp TỰ đặt lại form từ ca (Sửa, Đổi thợ/Đổi giờ) → ô phút bỏ chữ lỗi cũ dù số không đổi (N-J1).
  const [resetKey, setResetKey] = useState(0);
  const resetForm = (a: Appointment) => {
    setForm(formFrom(a));
    setResetKey((k) => k + 1);
  };
  const idemKey = useRef(newIdempotencyKey());
  const startRef = useRef<HTMLInputElement>(null);
  const staffRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'staff' | 'time' | null>(target.kind === 'edit' ? (target.focus ?? null) : null);

  const terminal = appt ? isTerminalStatus(appt.status) : false;
  // Buổi học sinh từ lớp: giờ / giảng viên / nơi học theo lịch lớp (sửa ở Khoá & lớp) — sửa tay ở đây sẽ bị lịch lớp ghi
  // đè khi đồng bộ, nên không mở nút "Sửa". Đổi trạng thái (bắt đầu, hoàn thành, huỷ một buổi) vẫn làm được.
  const fromClass = appt?.courseClass != null;
  const canEdit = access.write && !terminal && !fromClass;

  useEffect(() => {
    if (mode === 'view' || !pendingFocus.current) return;
    const which = pendingFocus.current;
    pendingFocus.current = null;
    // Đợi hộp thoại tự đặt tiêu điểm lần đầu xong rồi mới chuyển tiêu điểm tới ô cần đổi.
    const t = window.setTimeout(() => {
      if (which === 'time') startRef.current?.focus();
      else {
        staffRef.current?.scrollIntoView?.({ block: 'nearest' });
        staffRef.current?.querySelector<HTMLElement>('input,button')?.focus();
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [mode]);

  // Có dải trùng lịch hoặc lỗi chung: cuộn thân hộp về đầu để thấy dải (nút Lưu nằm ở chân, thân có thể đang cuộn xuống dưới).
  useEffect(() => {
    if (!conflicts && !general) return;
    const body = topRef.current?.parentElement;
    if (body) body.scrollTop = 0;
  }, [conflicts, general]);

  function setConflictState(list: AppointmentConflict[] | null, message?: string) {
    setConflicts(list);
    setConflictMessage(message);
    onConflicts(list);
  }

  function resetErrors() {
    setErrors({});
    setGeneral(null);
  }

  function handleError(err: unknown) {
    const list = conflictsOf(err);
    if (list) {
      // Máy chủ ghi tên tài khoản (staffName); màn dùng tên hiển thị của thợ như trên lưới.
      const named = list.map((c) => ({ ...c, staffName: lanes.find((l) => l.membershipId === c.membershipId)?.name ?? c.staffName }));
      setConflictState(named, userMessage(err));
      return;
    }
    const fe = fieldErrors(err);
    if (Object.keys(fe).length > 0) setErrors(fe);
    if (errorKind(err) !== 'validation' || Object.keys(fe).length === 0 || fe[''] !== undefined) setGeneral(userMessage(err));
  }

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  // Lỗi gõ của ô ngày/giờ (chữ chưa đọc được thành ngày/giờ) — chặn nút lưu.
  const inputErrors = useRef<Record<string, string | null>>({});
  const onInputError = (key: string, message: string | null) => {
    inputErrors.current[key] = message;
  };

  function goFix(which: 'staff' | 'time') {
    pendingFocus.current = which;
    if (mode === 'view') {
      if (appt) resetForm(appt);
      setMode('edit');
    } else {
      // Đã ở chế độ nhập: chạy lại hiệu ứng đặt tiêu điểm.
      const t = which === 'time' ? startRef.current : staffRef.current?.querySelector<HTMLElement>('input,button');
      if (which === 'staff') staffRef.current?.scrollIntoView?.({ block: 'nearest' });
      t?.focus();
      pendingFocus.current = null;
    }
  }

  async function save() {
    resetErrors();
    const times = timesOf(form);
    const local: Record<string, string> = {};
    // Ô ngày/giờ đang có chữ gõ sai: lỗi đã hiện dưới ô, không gửi.
    if (Object.values(inputErrors.current).some(Boolean)) return;
    if (!form.day) local.day = 'Chọn ngày';
    if (!form.start) local.startsAt = 'Chọn giờ bắt đầu';
    if (!form.end) local.endsAt = 'Chọn giờ kết thúc';
    const order = timeOrderError(form);
    if (order) local.endsAt = order;
    if (form.newCustomer && !form.newCustomer.fullName.trim()) local['newCustomer.fullName'] = 'Nhập họ tên khách';
    if (Object.keys(local).length > 0 || !times) {
      setErrors(local);
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        const body: AppointmentCreateInput = {
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          travelBeforeMin: form.travelBefore ?? 0,
          travelAfterMin: form.travelAfter ?? 0,
          staff: form.staff,
          status: form.status,
        };
        if (nn(form.title)) body.title = nn(form.title);
        if (form.locationType) body.locationType = form.locationType;
        if (nn(form.address)) body.address = nn(form.address);
        if (nn(form.notes)) body.notes = nn(form.notes);
        if (form.customer) body.customerId = form.customer.id;
        else if (form.newCustomer) body.newCustomer = { fullName: form.newCustomer.fullName.trim(), phone: nn(form.newCustomer.phone) };
        await createAppointment(orgId, body, idemKey.current);
        setConflictState(null);
        onSaved(null);
        onClose();
      } else if (appt) {
        const before = formFrom(appt);
        const body: AppointmentUpdateInput = {};
        if (Date.parse(times.startsAt) !== Date.parse(appt.startsAt) || Date.parse(times.endsAt) !== Date.parse(appt.endsAt)) {
          body.startsAt = times.startsAt;
          body.endsAt = times.endsAt;
        }
        if ((form.travelBefore ?? 0) !== appt.travelBeforeMin) body.travelBeforeMin = form.travelBefore ?? 0;
        if ((form.travelAfter ?? 0) !== appt.travelAfterMin) body.travelAfterMin = form.travelAfter ?? 0;
        if (form.locationType !== before.locationType) body.locationType = form.locationType;
        if (form.address.trim() !== before.address.trim()) body.address = nn(form.address);
        if (form.notes.trim() !== before.notes.trim()) body.notes = nn(form.notes);
        if (form.title.trim() !== before.title.trim()) body.title = nn(form.title);
        if (!sameStaff(form.staff, before.staff)) body.staff = form.staff;
        if (Object.keys(body).length === 0) {
          setMode('view');
          return;
        }
        const saved = await updateAppointment(orgId, appt.id, body);
        setConflictState(null);
        setAppt(saved);
        setMode('view');
        onSaved(saved);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(to: WorkStatus, reason?: string) {
    if (!appt) return;
    resetErrors();
    setStatusBusy(to);
    try {
      const saved = await changeAppointmentStatus(orgId, appt.id, reason ? { to, reason } : { to });
      setConflictState(null);
      setAppt(saved);
      onSaved(saved);
    } catch (err) {
      handleError(err);
    } finally {
      setStatusBusy(null);
    }
  }

  function close() {
    setConflictState(null);
    onClose();
  }

  const title =
    mode === 'create' ? 'Thêm lịch' : mode === 'edit' ? `Sửa lịch ${appt?.code ?? ''}` : ((appt ? whoText(appt) : null) ?? (appt ? kindText(appt) : ''));
  const eyebrow = appt ? `${appt.code} · ${kindText(appt)}` : undefined;

  const footer =
    mode === 'view' ? (
      <>
        <Button onClick={close}>Đóng</Button>
        {canEdit && (
          <Button
            variant="primary"
            onClick={() => {
              if (appt) resetForm(appt);
              resetErrors();
              setMode('edit');
            }}
          >
            Sửa
          </Button>
        )}
      </>
    ) : (
      <>
        <Button
          onClick={() => {
            resetErrors();
            if (mode === 'edit' && initialMode === 'view') {
              setConflictState(null);
              setMode('view');
            } else close();
          }}
        >
          Huỷ
        </Button>
        <Button variant="primary" loading={saving} onClick={() => void save()}>
          {mode === 'create' ? 'Lưu lịch' : 'Lưu'}
        </Button>
      </>
    );

  return (
    <Dialog open onClose={close} title={title} eyebrow={eyebrow} footer={footer} className="ws-dlg">
      <div ref={topRef} className="ws-dlg__top" aria-hidden="true" />
      {conflicts && (
        <ConflictBanner
          conflicts={conflicts}
          message={conflictMessage}
          onChangeStaff={access.write && !terminal ? () => goFix('staff') : undefined}
          onChangeTime={access.write && !terminal ? () => goFix('time') : undefined}
        />
      )}
      {general && (
        <div className="ws-err" role="alert">
          {general}
        </div>
      )}
      {mode === 'view' && appt ? (
        <ViewBody
          appt={appt}
          orgSlug={orgSlug}
          access={access}
          lanes={lanes}
          statusBusy={statusBusy}
          reasonError={errors.reason ?? null}
          onStatus={(to, reason) => void changeStatus(to, reason)}
        />
      ) : (
        <FormBody
          orgId={orgId}
          mode={mode === 'create' ? 'create' : 'edit'}
          appt={appt}
          form={form}
          update={update}
          errors={errors}
          access={access}
          staffMembers={staffMembers}
          lanes={lanes}
          startRef={startRef}
          staffRef={staffRef}
          onInputError={onInputError}
          resetKey={resetKey}
        />
      )}
    </Dialog>
  );
}

// ---------------- Xem chi tiết ----------------
function InfoRow({ label, tip, children }: { label: string; tip?: ReactNode; children: ReactNode }) {
  return (
    <div className="ws-info__row">
      <dt>
        {label}
        {tip !== undefined && <Tooltip text={tip} />}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function ViewBody({
  appt,
  orgSlug,
  access,
  lanes,
  statusBusy,
  reasonError,
  onStatus,
}: {
  appt: Appointment;
  orgSlug: string;
  access: ScheduleAccess;
  lanes: StaffLane[];
  statusBusy: WorkStatus | null;
  reasonError: string | null;
  onStatus: (to: WorkStatus, reason?: string) => void;
}) {
  const startDay = dayKeyOf(appt.startsAt);
  const endDay = dayKeyOf(appt.endsAt);
  const minutes = (Date.parse(appt.endsAt) - Date.parse(appt.startsAt)) / 60_000;
  return (
    <div className="ws-view">
      <dl className="ws-info">
        <InfoRow label="Trạng thái">
          <WorkStatusTag status={appt.status} />
        </InfoRow>
        <InfoRow label="Giờ">
          <span className="num">
            {dayLabel(startDay)} · {hhmm(appt.startsAt)}–{hhmm(appt.endsAt)}
            {endDay !== startDay ? ` (${weekdayLong(endDay)} ${ddmm(endDay)})` : ''}
          </span>{' '}
          <span className="ws-fx">{formatDuration(minutes)}</span>
        </InfoRow>
        {(appt.travelBeforeMin > 0 || appt.travelAfterMin > 0) && (
          <InfoRow label="Di chuyển" tip="Thời gian đi đường trước và sau ca, tính vào giờ bận của thợ khi kiểm trùng lịch.">
            <span className="num">
              {[
                appt.travelBeforeMin > 0 ? `trước ${formatDuration(appt.travelBeforeMin)}` : null,
                appt.travelAfterMin > 0 ? `sau ${formatDuration(appt.travelAfterMin)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </InfoRow>
        )}
        {appt.courseClass ? (
          <InfoRow label="Lớp" tip="Buổi học sinh từ lịch học của lớp. Đổi giờ, thứ học, giảng viên hay nơi học thì sửa lớp ở Khoá & lớp — các buổi chưa diễn ra đổi theo.">
            <span>
              <b className="ws-strong">{appt.courseClass.name}</b>
              <span className="ws-fx"> · {appt.courseClass.courseName}</span>{' '}
              <Link to={`/${orgSlug}/dao-tao/${encodeURIComponent(appt.courseClass.courseId)}`} className="ws-link">
                Mở khoá học
              </Link>
            </span>
          </InfoRow>
        ) : (
          <InfoRow label="Khách">
            {appt.customer ? (
              <span>
                <b className="ws-strong">{appt.customer.fullName}</b>
                {appt.customer.phone && <span className="ws-fx num"> · {appt.customer.phone}</span>}
              </span>
            ) : (
              <span className="ws-faint">Chưa gắn khách</span>
            )}
          </InfoRow>
        )}
        <InfoRow label={appt.courseClass ? 'Giảng viên' : 'Thợ'}>
          <span className="ws-info__staff">
            <StaffAvatars a={appt} size="sm" />
            <span className={cx(appt.staff.length === 0 && 'ws-warn-text')}>{staffNames(appt)}</span>
          </span>
        </InfoRow>
        {(appt.locationType || appt.address) && (
          <InfoRow label={appt.courseClass ? 'Nơi học' : 'Nơi làm'}>
            {appt.locationType ? LOCATION_LABELS[appt.locationType] : ''}
            {appt.address && <span className="ws-pre">{appt.locationType ? ' – ' : ''}{appt.address}</span>}
          </InfoRow>
        )}
        {appt.contract && (
          <InfoRow label="Hợp đồng" tip="Tiền của ca nằm ở hợp đồng; lịch không giữ tiền. Muốn đổi tiền thì mở hợp đồng.">
            <span className="ws-info__contract">
              {access.contractsRead ? (
                <Link to={`/${orgSlug}/hop-dong/${encodeURIComponent(appt.contract.id)}`} className="ws-link">
                  {appt.contract.code}
                </Link>
              ) : (
                <span>{appt.contract.code}</span>
              )}
              <ContractStatusTag status={appt.contract.status} />
            </span>
          </InfoRow>
        )}
        {appt.notes && (
          <InfoRow label="Ghi chú">
            <span className="ws-pre">{appt.notes}</span>
          </InfoRow>
        )}
        {appt.cancelReason && (
          <InfoRow label="Lý do huỷ">
            <span className="ws-pre">{appt.cancelReason}</span>
          </InfoRow>
        )}
      </dl>
      {access.write && (
        <section className="ws-view__status" aria-label="Đổi trạng thái">
          <StatusActions status={appt.status} busy={statusBusy} reasonError={reasonError} onChange={onStatus} />
        </section>
      )}
    </div>
  );
}

// ---------------- Nhập (tạo / sửa) ----------------
function FormBody({
  orgId,
  mode,
  appt,
  form,
  update,
  errors,
  access,
  staffMembers,
  lanes,
  startRef,
  staffRef,
  onInputError,
  resetKey,
}: {
  orgId: string;
  mode: 'create' | 'edit';
  appt: Appointment | null;
  form: FormState;
  update: (p: Partial<FormState>) => void;
  errors: Record<string, string>;
  access: ScheduleAccess;
  staffMembers: StaffMember[] | null;
  lanes: StaffLane[];
  startRef: RefObject<HTMLInputElement | null>;
  staffRef: RefObject<HTMLDivElement | null>;
  onInputError: (key: string, message: string | null) => void;
  resetKey: number;
}) {
  const times = timesOf(form);
  const overnight = times && times.endDay !== form.day;
  // T3: lỗi thứ tự giờ hiện NGAY dưới ô giờ kết thúc (không đợi bấm Lưu).
  const orderError = timeOrderError(form);
  return (
    <div className="ws-form">
      <div className="ws-form__col">
        <h3 className="ws-group">Thông tin ca</h3>
        {mode === 'create' ? (
          <CustomerField orgId={orgId} form={form} update={update} errors={errors} access={access} />
        ) : (
          <SettingRow label="Khách">
            <span className="ws-ro">{appt?.customer?.fullName ?? 'Chưa gắn khách'}</span>
          </SettingRow>
        )}
        <SettingRow label="Tên ca" htmlFor="ws-ten-ca" tip="Ví dụ: Makeup cô dâu (ngày cưới). Lịch sinh từ hợp đồng có sẵn tên gói và nhân vật.">
          <TextInput id="ws-ten-ca" value={form.title} maxLength={200} onChange={(e) => update({ title: e.target.value })} error={errors.title} />
        </SettingRow>
        <SettingRow label="Ngày" htmlFor="ws-ngay" required>
          <DateInput
            id="ws-ngay"
            value={form.day || null}
            onChange={(v) => update({ day: v ?? '' })}
            onInputError={(m) => onInputError('day', m)}
            error={errors.day}
          />
        </SettingRow>
        <SettingRow
          label="Giờ"
          required
          controlWidth={300}
          className="ws-row-wide ws-row-stack-phone"
          tip="Ca kéo qua nửa đêm: tick “Kết thúc hôm sau”. Không tick thì giờ kết thúc phải sau giờ bắt đầu."
        >
          <div className="ws-timebox">
            <div className="ws-times">
              <TimeInput
                ref={startRef}
                aria-label="Giờ bắt đầu"
                value={form.start || null}
                onChange={(v) => update({ start: v ?? '' })}
                onInputError={(m) => onInputError('start', m)}
                error={errors.startsAt}
              />
              <span aria-hidden="true">–</span>
              <TimeInput
                aria-label="Giờ kết thúc"
                value={form.end || null}
                onChange={(v) => update({ end: v ?? '' })}
                onInputError={(m) => onInputError('end', m)}
                error={orderError ?? errors.endsAt}
                hint={overnight ? `Kết thúc ${weekdayLong(times.endDay)} ${ddmm(times.endDay)}` : undefined}
              />
            </div>
            <Checkbox
              className="ws-nextday"
              label="Kết thúc hôm sau"
              checked={form.nextDay}
              onChange={(e) => update({ nextDay: e.target.checked })}
            />
          </div>
        </SettingRow>
        <SettingRow label="Di chuyển trước" tip="Thời gian đi đường tới chỗ khách, tính vào giờ bận của thợ khi kiểm trùng lịch.">
          <UnitInput
            aria-label="Di chuyển trước"
            unit="phút"
            min={0}
            max={MAX_TRAVEL_MIN}
            value={form.travelBefore}
            onChange={(v) => update({ travelBefore: v })}
            resetKey={resetKey}
            error={errors.travelBeforeMin}
          />
        </SettingRow>
        <SettingRow label="Di chuyển sau" tip="Thời gian đi đường sau khi xong ca, tính vào giờ bận của thợ.">
          <UnitInput
            aria-label="Di chuyển sau"
            unit="phút"
            min={0}
            max={MAX_TRAVEL_MIN}
            value={form.travelAfter}
            onChange={(v) => update({ travelAfter: v })}
            resetKey={resetKey}
            error={errors.travelAfterMin}
          />
        </SettingRow>
        <SettingRow label="Làm ở đâu" controlWidth={300} className="ws-row-wide">
          <Segmented<LocationType>
            aria-label="Làm ở đâu"
            size="sm"
            value={form.locationType}
            onChange={(v) => update({ locationType: v })}
            options={[
              { value: 'STUDIO', label: 'Studio' },
              { value: 'CUSTOMER_HOME', label: 'Tại nhà' },
              { value: 'OTHER', label: 'Nơi khác' },
            ]}
          />
        </SettingRow>
        {form.locationType && (
          <SettingRow label="Địa chỉ" htmlFor="ws-dia-chi" controlWidth={300} className="ws-row-wide">
            <Textarea id="ws-dia-chi" value={form.address} maxLength={500} onChange={(e) => update({ address: e.target.value })} error={errors.address} />
          </SettingRow>
        )}
        <SettingRow label="Ghi chú" htmlFor="ws-ghi-chu" stack>
          <Textarea id="ws-ghi-chu" value={form.notes} maxLength={2000} onChange={(e) => update({ notes: e.target.value })} error={errors.notes} />
        </SettingRow>
      </div>
      <div className="ws-form__col">
        <h3 className="ws-group">
          Thợ phụ trách
          <Tooltip text="Mỗi ca tối đa một thợ chính. Ca chưa có thợ nằm ở hàng “Chưa có thợ”. Máy chủ không cho lưu nếu thợ đã có ca chặn lịch trùng giờ." />
        </h3>
        <StaffChecklist refEl={staffRef} form={form} update={update} staffMembers={staffMembers} lanes={lanes} error={errors.staff} />
        {mode === 'create' && (
          <>
            <h3 className="ws-group">
              Trạng thái ban đầu
              <Tooltip text="Ca nháp chưa giữ giờ của thợ. Chờ xác nhận và Đã xác nhận giữ giờ của thợ và được kiểm trùng lịch." />
            </h3>
            <Segmented<InitialWorkStatus>
              aria-label="Trạng thái ban đầu"
              size="sm"
              value={form.status}
              onChange={(v) => update({ status: v })}
              options={INITIAL_STATUSES.map((s) => ({ value: s, label: WORK_STATUS_LABELS[s] }))}
            />
          </>
        )}
      </div>
    </div>
  );
}

function StaffChecklist({
  refEl,
  form,
  update,
  staffMembers,
  lanes,
  error,
}: {
  refEl: RefObject<HTMLDivElement | null>;
  form: FormState;
  update: (p: Partial<FormState>) => void;
  staffMembers: StaffMember[] | null;
  lanes: StaffLane[];
  error?: string;
}) {
  // Có GET /staff: thợ đang nhận lịch (và thợ đã phân sẵn ở ca). Không có: các hàng thợ đang hiện trên lịch.
  const options = useMemo(() => {
    const picked = new Set(form.staff.map((s) => s.membershipId));
    if (staffMembers) {
      // Cùng luật với hàng thợ của lưới (buildStaffLanes): thợ đang nhận lịch có hồ sơ thợ hoặc vai trò thợ.
      // Tổ chức chưa có ai như vậy (ví dụ studio một người) thì cho chọn mọi người đang nhận lịch.
      const bookable = staffMembers.filter((m) => m.isBookable);
      const makeup = bookable.filter((m) => isMakeupStaff(m));
      const base = makeup.length > 0 ? makeup : bookable;
      const ids = new Set(base.map((m) => m.membershipId));
      return staffMembers
        .filter((m) => ids.has(m.membershipId) || picked.has(m.membershipId))
        .map((m) => ({ id: m.membershipId, name: m.displayName, tier: m.tier?.name ?? null }));
    }
    return lanes.map((l) => ({ id: l.membershipId, name: l.name, tier: l.tierName }));
  }, [staffMembers, lanes, form.staff]);

  function toggle(id: string, on: boolean) {
    if (on) {
      const hasPrimary = form.staff.some((s) => s.role === 'PRIMARY');
      update({ staff: [...form.staff, { membershipId: id, role: hasPrimary ? 'ASSIST' : 'PRIMARY' }] });
    } else {
      update({ staff: form.staff.filter((s) => s.membershipId !== id) });
    }
  }

  function setRole(id: string, role: StaffRole) {
    update({
      staff: form.staff.map((s) =>
        s.membershipId === id ? { ...s, role } : role === 'PRIMARY' && s.role === 'PRIMARY' ? { ...s, role: 'ASSIST' } : s,
      ),
    });
  }

  return (
    <div className="ws-pick" ref={refEl}>
      {options.length === 0 && <p className="ws-faint">Chưa có thợ nào nhận lịch.</p>}
      {options.map((o) => {
        const pick = form.staff.find((s) => s.membershipId === o.id);
        return (
          <div key={o.id} className={cx('ws-pick__row', pick && 'is-on')}>
            <Checkbox
              label={o.name}
              trailing={o.tier ?? undefined}
              checked={Boolean(pick)}
              onChange={(e) => toggle(o.id, e.target.checked)}
            />
            {pick && (
              <Segmented<StaffRole>
                aria-label={`Vai của ${o.name}`}
                size="sm"
                value={pick.role}
                onChange={(r) => setRole(o.id, r)}
                options={[
                  { value: 'PRIMARY', label: 'Chính' },
                  { value: 'ASSIST', label: 'Phụ' },
                ]}
              />
            )}
          </div>
        );
      })}
      {error && (
        <div className="ui-field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function CustomerField({
  orgId,
  form,
  update,
  errors,
  access,
}: {
  orgId: string;
  form: FormState;
  update: (p: Partial<FormState>) => void;
  errors: Record<string, string>;
  access: ScheduleAccess;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!access.customersRead || form.customer || form.newCustomer || q.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      listCustomers(orgId, { q: q.trim(), pageSize: 5 }, controller.signal)
        .then((res) => {
          setResults(res.items);
          setSearchError(null);
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setSearchError(userMessage(err));
        });
    }, 300);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [orgId, q, access.customersRead, form.customer, form.newCustomer]);

  if (!access.customersRead && !access.customersWrite) return null;

  if (form.customer) {
    return (
      <SettingRow label="Khách" controlWidth={300} className="ws-row-wide">
        <div className="ws-kh">
          <span>
            <b className="ws-strong">{form.customer.fullName}</b>
            {form.customer.phone && <span className="ws-fx num"> · {form.customer.phone}</span>}
          </span>
          <Button size="sm" variant="ghost" onClick={() => update({ customer: null })}>
            Đổi
          </Button>
        </div>
      </SettingRow>
    );
  }

  if (form.newCustomer) {
    const nc = form.newCustomer;
    return (
      <>
        <SettingRow label="Họ tên khách" htmlFor="ws-kh-ten" required>
          <TextInput
            id="ws-kh-ten"
            value={nc.fullName}
            maxLength={120}
            onChange={(e) => update({ newCustomer: { ...nc, fullName: e.target.value } })}
            error={errors['newCustomer.fullName'] ?? errors.newCustomer}
          />
        </SettingRow>
        <SettingRow label="Số điện thoại" htmlFor="ws-kh-sdt">
          <TextInput
            id="ws-kh-sdt"
            type="tel"
            inputMode="tel"
            value={nc.phone}
            onChange={(e) => update({ newCustomer: { ...nc, phone: e.target.value } })}
            error={errors['newCustomer.phone']}
          />
        </SettingRow>
        {access.customersRead && (
          <div className="ws-form__link">
            <Button size="sm" variant="ghost" onClick={() => update({ newCustomer: null })}>
              Chọn khách có sẵn
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <SettingRow label="Khách" htmlFor="ws-kh-tim" controlWidth={300} className="ws-row-wide">
      <div className="ws-kh-find">
        {access.customersRead && (
          <TextInput
            id="ws-kh-tim"
            type="search"
            placeholder="Tìm theo tên hoặc SĐT"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            error={searchError}
            autoComplete="off"
          />
        )}
        {results.length > 0 && (
          <ul className="ws-kh-list" aria-label="Khách tìm thấy">
            {results.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => update({ customer: { id: c.id, fullName: c.fullName, phone: c.phone } })}>
                  <b>{c.fullName}</b>
                  {c.phone && <span className="ws-fx num">{c.phone}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {access.customersWrite && (
          <Button size="sm" variant="ghost" onClick={() => update({ newCustomer: { fullName: q.trim(), phone: '' } })}>
            + Khách mới
          </Button>
        )}
      </div>
    </SettingRow>
  );
}
