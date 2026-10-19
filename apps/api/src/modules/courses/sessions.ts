// BUỔI HỌC LÊN LỊCH (việc tồn 6, quyết định điều phối 19/10; bản vẽ C3 mục 4). Mỗi buổi học là một Appointment
// kind = COURSE_SESSION trỏ về lớp (course_class_id) + ngày học (session_date, theo múi giờ tổ chức).
//
// Quyết định (đã duyệt):
// - Sinh bằng nút "Đưa buổi học lên Lịch" trên thẻ lớp (POST /classes/:classId/sessions/sync) — KHÔNG tự sinh khi tạo lớp:
//   bỏ nút là lùi xong, không có dữ liệu sinh ngầm. Lớp ĐÃ đưa lên Lịch thì sửa lớp / huỷ lớp tự kéo các buổi chưa diễn
//   ra theo, trong CÙNG transaction.
// - Bấm lại không sinh trùng: tính tập ngày mong muốn rồi so với buổi đang có — thiếu thì thêm, lệch thì sửa, thừa thì huỷ,
//   khớp thì để nguyên. Chốt cuối ở database: chỉ mục duy nhất có điều kiện appointments_class_session_live_key.
// - NGOẠI LỆ CÓ CHỦ ĐÍCH so với luật "lịch mới để Nháp" (quyết định 19/10 sáng): buổi học tạo ở trạng thái ĐÃ XÁC NHẬN để
//   GIỮ GIỜ giảng viên (Nháp không chiếm giờ). Luật Nháp áp cho ca makeup người dùng tự tạo; buổi học là lịch cố định
//   của lớp. (Điều phối duyệt V2.)
// - Trùng giờ với lịch khác của giảng viên (ca makeup, lớp khác): đúng luật trùng giờ hiện có — 409 kèm details.conflicts,
//   làm tất cả hoặc không làm gì (không sinh một nửa).
// - Buổi đã diễn ra (đã bắt đầu, hoặc đã sang Đang làm / Hoàn thành / Không đến) giữ nguyên.
// - Buổi bị huỷ TAY (lý do khác câu máy tự ghi khi lịch lớp đổi) thì bấm lại KHÔNG sinh lại ngày đó (ví dụ nghỉ lễ).
// - Huỷ lớp khi còn buổi Đang diễn ra → 409, nói rõ buổi nào (điều phối duyệt V3).
import type { LocationType } from '@prisma/client';
import { canTransition, type WorkStatus } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import {
  appointmentInclude,
  applyStatusChangeTx,
  createAppointmentTx,
  findOverlaps,
  overlapError,
  rescheduleAppointmentTx,
  type AppointmentRow,
  type OverlapConflict,
  type StaffAssignment,
} from '../schedule/service';
import { dateFromWire, dateToWire, todayIn, type ClassRow } from './present';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

interface Actor {
  orgId: string;
  userId: string;
  requestId: string;
}

// Lý do máy tự ghi khi huỷ buổi vì lịch lớp đổi — ngày bị huỷ bằng lý do này được sinh lại nếu lịch lớp thêm lại ngày đó.
export const SYNC_CANCEL_REASON = 'Lịch học của lớp đã đổi — buổi này không còn trong lịch';
// Trần số buổi một lần đưa lên Lịch (giữ transaction ngắn).
export const SESSION_SYNC_LIMIT = 200;
// Trạng thái còn "chưa diễn ra" (còn sửa / huỷ theo lớp được).
const NOT_STARTED: readonly WorkStatus[] = ['DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED'];

// ---------- Ngày giờ ----------

// Độ lệch (ms) của múi giờ tại một thời điểm: giờ địa phương − giờ UTC.
function tzOffsetMs(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// "2026-11-03" + 1080 phút theo múi giờ tổ chức → thời điểm UTC. 1440 phút = 0:00 ngày hôm sau.
export function zonedInstant(date: string, minute: number, timezone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(y, m - 1, d, 0, minute);
  const first = naive - tzOffsetMs(new Date(naive), timezone);
  // Lần hai cho múi giờ có giờ mùa hè (độ lệch ở thời điểm thật có thể khác lần đoán đầu).
  return new Date(naive - tzOffsetMs(new Date(first), timezone));
}

// Thứ ISO của một ngày "YYYY-MM-DD": 1 = Thứ Hai … 7 = Chủ nhật.
function isoWeekday(date: string): number {
  const w = dateFromWire(date).getUTCDay();
  return w === 0 ? 7 : w;
}

function addDays(date: string, n: number): string {
  return dateToWire(new Date(dateFromWire(date).getTime() + n * 86_400_000));
}

// Các ngày học của lớp trong [max(startDate, fromDate), endDate], theo thứ trong tuần.
export function classSessionDates(k: { startDate: string; endDate: string; weekdays: readonly number[] }, fromDate: string): string[] {
  const out: string[] = [];
  const want = new Set(k.weekdays);
  for (let d = k.startDate > fromDate ? k.startDate : fromDate; d <= k.endDate; d = addDays(d, 1)) {
    if (want.has(isoWeekday(d))) out.push(d);
  }
  return out;
}

// ---------- Kế hoạch đồng bộ ----------

export interface DesiredSession {
  sessionDate: string;
  startsAt: Date;
  endsAt: Date;
  // Luôn null: tên lớp hiển thị qua quan hệ courseClass (đổi tên lớp / tên khoá Một lớp không làm buổi học mang tên cũ).
  title: null;
  staff: StaffAssignment[];
  locationType: LocationType | null;
  address: string | null;
}

export interface SessionPlan {
  create: DesiredSession[];
  update: { row: AppointmentRow; desired: DesiredSession }[];
  cancel: AppointmentRow[];
  // Buổi chưa diễn ra đã khớp lịch lớp.
  keep: number;
  // Buổi đã diễn ra (giữ nguyên).
  past: number;
  // Ngày bị huỷ tay — không sinh lại.
  skippedManual: string[];
}

export function isUpcomingSession(a: { startsAt: Date; status: WorkStatus }, now: Date): boolean {
  return a.startsAt.getTime() > now.getTime() && NOT_STARTED.includes(a.status);
}

type ClassForPlan = Pick<ClassRow, 'startDate' | 'endDate' | 'weekdays' | 'startMinute' | 'endMinute' | 'instructorMembershipId' | 'studioLocation'>;

function desiredFor(k: ClassForPlan, date: string, timezone: string): DesiredSession {
  if (k.startMinute === null || k.endMinute === null) throw new Error('desiredFor: lớp chưa có giờ học');
  return {
    sessionDate: date,
    startsAt: zonedInstant(date, k.startMinute, timezone),
    endsAt: zonedInstant(date, k.endMinute, timezone),
    title: null,
    staff: k.instructorMembershipId ? [{ membershipId: k.instructorMembershipId, role: 'PRIMARY' }] : [],
    locationType: k.studioLocation ? 'STUDIO' : null,
    address: k.studioLocation?.address ?? null,
  };
}

function matches(row: AppointmentRow, d: DesiredSession): boolean {
  const staffKey = (s: { membershipId: string; role: string }[]) =>
    s
      .map((x) => `${x.membershipId}:${x.role}`)
      .sort()
      .join(',');
  return (
    row.startsAt.getTime() === d.startsAt.getTime() &&
    row.endsAt.getTime() === d.endsAt.getTime() &&
    row.title === d.title &&
    row.locationType === d.locationType &&
    row.address === d.address &&
    staffKey(row.staff) === staffKey(d.staff)
  );
}

// Thuần (không đọc database): so buổi đang có của lớp với lịch lớp.
export function planSessions(k: ClassForPlan, rows: AppointmentRow[], timezone: string, now: Date): SessionPlan {
  const plan: SessionPlan = { create: [], update: [], cancel: [], keep: 0, past: 0, skippedManual: [] };
  const hasTime = k.startMinute !== null && k.endMinute !== null;
  const wanted = new Map<string, DesiredSession>();
  if (hasTime) {
    const dates = classSessionDates(
      { startDate: dateToWire(k.startDate), endDate: dateToWire(k.endDate), weekdays: k.weekdays },
      todayIn(timezone, now),
    );
    for (const date of dates) {
      const d = desiredFor(k, date, timezone);
      if (d.startsAt.getTime() > now.getTime()) wanted.set(date, d);
    }
  }
  const liveDates = new Set<string>();
  const manualCancelled = new Set<string>();
  for (const row of rows) {
    const date = row.sessionDate ? dateToWire(row.sessionDate) : null;
    if (!date) continue;
    if (row.status === 'CANCELLED') {
      if (row.cancelReason !== SYNC_CANCEL_REASON) manualCancelled.add(date);
      continue;
    }
    liveDates.add(date);
    if (!isUpcomingSession(row, now)) {
      plan.past++;
      continue;
    }
    const d = wanted.get(date);
    if (!d) plan.cancel.push(row);
    else if (matches(row, d)) plan.keep++;
    else plan.update.push({ row, desired: d });
  }
  for (const [date, d] of wanted) {
    if (liveDates.has(date)) continue;
    if (manualCancelled.has(date)) plan.skippedManual.push(date);
    else plan.create.push(d);
  }
  plan.create.sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
  return plan;
}

// ---------- Đọc / khoá ----------

// Khoá MỌI buổi của lớp (thứ tự id cố định) rồi đọc. Người gọi đã khoá dòng lớp.
async function lockSessions(tx: Tx, orgId: string, classId: string): Promise<AppointmentRow[]> {
  await tx.$queryRaw`SELECT id FROM appointments WHERE organization_id = ${orgId}::uuid AND course_class_id = ${classId}::uuid ORDER BY id FOR UPDATE`;
  return tx.appointment.findMany({
    where: { organizationId: orgId, courseClassId: classId },
    include: appointmentInclude,
    orderBy: [{ startsAt: 'asc' }, { code: 'asc' }],
  });
}

export interface CalendarSummary {
  // Buổi chưa huỷ đang có trên Lịch.
  total: number;
  // Trong đó, buổi chưa diễn ra.
  upcoming: number;
}

// Tóm tắt buổi học trên Lịch của nhiều lớp — HAI câu truy vấn cho cả danh sách, không N+1.
export async function calendarSummaries(db: Tx, orgId: string, classIds: string[], now: Date = new Date()): Promise<Map<string, CalendarSummary>> {
  const out = new Map<string, CalendarSummary>(classIds.map((id) => [id, { total: 0, upcoming: 0 }]));
  if (classIds.length === 0) return out;
  const base = { organizationId: orgId, courseClassId: { in: classIds }, status: { not: 'CANCELLED' as const } };
  const [all, upcoming] = await Promise.all([
    db.appointment.groupBy({ by: ['courseClassId'], where: base, _count: { _all: true } }),
    db.appointment.groupBy({
      by: ['courseClassId'],
      where: { ...base, status: { in: [...NOT_STARTED] }, startsAt: { gt: now } },
      _count: { _all: true },
    }),
  ]);
  for (const r of all) if (r.courseClassId) out.get(r.courseClassId)!.total = r._count._all;
  for (const r of upcoming) if (r.courseClassId) out.get(r.courseClassId)!.upcoming = r._count._all;
  return out;
}

// ---------- Áp kế hoạch ----------

export interface SyncSummary {
  create: number;
  update: number;
  cancel: number;
  keep: number;
  past: number;
  skippedManual: string[];
  // Ngày buổi đầu / cuối sẽ thêm (để hộp xác nhận ghi "từ … đến …"); không thêm buổi nào → null.
  firstNewDate: string | null;
  lastNewDate: string | null;
}

function summarize(plan: SessionPlan): SyncSummary {
  return {
    create: plan.create.length,
    update: plan.update.length,
    cancel: plan.cancel.length,
    keep: plan.keep,
    past: plan.past,
    skippedManual: plan.skippedManual,
    firstNewDate: plan.create[0]?.sessionDate ?? null,
    lastNewDate: plan.create.at(-1)?.sessionDate ?? null,
  };
}

// Kiểm trùng TRƯỚC cho cả kế hoạch để báo một lần đủ danh sách (bước ghi vẫn kiểm lại dưới khoá thợ; ràng buộc EXCLUDE
// là chốt cuối). Buổi của cùng lớp khác ngày nên không trùng nhau.
async function planConflicts(tx: Tx, orgId: string, plan: SessionPlan): Promise<OverlapConflict[]> {
  const out: OverlapConflict[] = [];
  const seen = new Set<string>();
  const items = [
    ...plan.create.map((d) => ({ d, exclude: undefined as string | undefined })),
    ...plan.update.map((u) => ({ d: u.desired, exclude: u.row.id })),
  ];
  for (const { d, exclude } of items) {
    if (d.staff.length === 0) continue;
    const found = await findOverlaps(
      tx,
      orgId,
      d.staff.map((s) => s.membershipId),
      { blockStart: d.startsAt, blockEnd: d.endsAt },
      exclude,
    );
    for (const c of found) {
      const k = `${c.appointmentId}:${c.membershipId}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(c);
      }
    }
  }
  return out;
}

// Thứ tự ghi: huỷ → thêm → sửa. Thêm đi qua createAppointmentTx (bộ đếm mã lịch rồi khoá tổ chức 'exclusive'); sửa đi
// SAU thêm với khoá 'exclusive' — đi trước thì transaction cầm khoá tổ chức rồi mới xin bộ đếm, ngược thứ tự với lệnh
// tạo lịch khác (bộ đếm → khoá tổ chức) → có thể khoá chết.
async function applyPlan(tx: Tx, a: Actor, classId: string, plan: SessionPlan, cancelReason: string): Promise<void> {
  const ctx = { orgId: a.orgId, userId: a.userId, requestId: a.requestId };
  for (const row of plan.cancel) {
    await applyStatusChangeTx(tx, ctx, row, 'CANCELLED', cancelReason, { via: 'course_class.sessions', courseClassId: classId });
  }
  for (const d of plan.create) {
    await createAppointmentTx(tx, ctx, {
      kind: 'COURSE_SESSION',
      title: d.title,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      travelBeforeMin: 0,
      travelAfterMin: 0,
      locationType: d.locationType,
      address: d.address,
      staff: d.staff,
      // NGOẠI LỆ "lịch mới để Nháp": buổi học giữ giờ giảng viên (xem đầu tệp).
      status: 'CONFIRMED',
      courseClassId: classId,
      sessionDate: dateFromWire(d.sessionDate),
    });
  }
  for (const u of plan.update) {
    await rescheduleAppointmentTx(tx, ctx, u.row, u.desired, 'exclusive', { via: 'course_class.sessions', courseClassId: classId });
  }
}

// Đồng bộ buổi học của một lớp ĐÃ KHOÁ (người gọi khoá dòng lớp). dryRun: chỉ trả kế hoạch + danh sách trùng, không ghi.
export async function syncClassSessions(
  tx: Tx,
  a: Actor,
  k: ClassRow,
  timezone: string,
  opts: { dryRun: boolean; now?: Date; via: string },
): Promise<{ summary: SyncSummary; conflicts: OverlapConflict[] }> {
  const now = opts.now ?? new Date();
  if (k.status === 'CANCELLED') throw new AppError('CONFLICT', 'Lớp đã huỷ — không đưa buổi học lên Lịch được', { reason: 'CLASS_CANCELLED' });
  if (k.startMinute === null || k.endMinute === null) {
    throw new AppError('CONFLICT', 'Lớp chưa có giờ học — nhập giờ học trước khi đưa buổi học lên Lịch', { reason: 'CLASS_NO_TIME' });
  }
  const rows = await lockSessions(tx, a.orgId, k.id);
  const plan = planSessions(k, rows, timezone, now);
  if (plan.create.length > SESSION_SYNC_LIMIT) {
    throw new AppError('CONFLICT', `Lớp có ${plan.create.length} buổi cần đưa lên Lịch — tối đa ${SESSION_SYNC_LIMIT} buổi mỗi lần, thu ngắn khoảng ngày của lớp`, {
      reason: 'TOO_MANY_SESSIONS',
      count: plan.create.length,
      limit: SESSION_SYNC_LIMIT,
    });
  }
  const conflicts = await planConflicts(tx, a.orgId, plan);
  const summary = summarize(plan);
  if (opts.dryRun) return { summary, conflicts };
  if (conflicts.length > 0) throw overlapError(conflicts);
  const changed = plan.create.length + plan.update.length + plan.cancel.length;
  if (changed > 0) {
    await applyPlan(tx, a, k.id, plan, SYNC_CANCEL_REASON);
    await writeAudit(tx, {
      organizationId: a.orgId,
      actorUserId: a.userId,
      action: 'course_class.sessions_synced',
      entityType: 'course_class',
      entityId: k.id,
      data: { via: opts.via, create: summary.create, update: summary.update, cancel: summary.cancel, keep: summary.keep, past: summary.past },
      requestId: a.requestId,
    });
  }
  return { summary, conflicts: [] };
}

// Lớp đã từng đưa buổi học lên Lịch (còn ít nhất một buổi, kể cả đã huỷ)?
export async function hasSessions(tx: Tx, orgId: string, classId: string): Promise<boolean> {
  return (await tx.appointment.count({ where: { organizationId: orgId, courseClassId: classId } })) > 0;
}

// Sau khi sửa lớp: lớp đã đưa lên Lịch thì kéo buổi chưa diễn ra theo lịch mới (làm tất cả hoặc không — trùng → 409 và
// lệnh sửa lớp lùi cả). Lớp bỏ trống giờ học khi còn buổi chưa diễn ra → 409 (không tự huỷ hàng loạt).
export async function followClassUpdate(tx: Tx, a: Actor, k: ClassRow, timezone: string): Promise<void> {
  if (!(await hasSessions(tx, a.orgId, k.id))) return;
  if (k.startMinute === null || k.endMinute === null) {
    const upcoming = (await lockSessions(tx, a.orgId, k.id)).filter((r) => isUpcomingSession(r, new Date()));
    if (upcoming.length > 0) {
      throw new AppError('CONFLICT', `Lớp còn ${upcoming.length} buổi học sắp tới trên Lịch — không bỏ trống giờ học được`, {
        reason: 'CLASS_HAS_SESSIONS',
        upcoming: upcoming.length,
      });
    }
    return;
  }
  await syncClassSessions(tx, a, k, timezone, { dryRun: false, via: 'course_class.updated' });
}

function sessionLabel(r: AppointmentRow, timezone: string): string {
  const d = r.sessionDate ? dateToWire(r.sessionDate) : todayIn(timezone, r.startsAt);
  const [y, m, day] = d.split('-');
  return `${r.code} (${day}/${m}/${y})`;
}

// Huỷ lớp: buổi chưa diễn ra huỷ theo (lý do "Huỷ lớp: …"); buổi đã qua giữ nguyên. Còn buổi Đang diễn ra → 409 nêu rõ
// buổi nào, KHÔNG buổi nào bị đổi (giống huỷ hợp đồng).
export async function cancelClassSessions(tx: Tx, a: Actor, classId: string, reason: string, timezone: string, now: Date = new Date()): Promise<number> {
  const rows = await lockSessions(tx, a.orgId, classId);
  const running = rows.filter((r) => r.status === 'IN_PROGRESS');
  if (running.length > 0) {
    throw new AppError(
      'CONFLICT',
      `Lớp đang có buổi học đang diễn ra: ${running.map((r) => sessionLabel(r, timezone)).join(', ')} — kết thúc buổi đó trước khi huỷ lớp`,
      {
        reason: 'CLASS_SESSION_IN_PROGRESS',
        sessions: running.map((r) => ({ appointmentId: r.id, code: r.code, sessionDate: r.sessionDate ? dateToWire(r.sessionDate) : null })),
      },
    );
  }
  const toCancel = rows.filter((r) => isUpcomingSession(r, now) && canTransition(r.status, 'CANCELLED'));
  const ctx = { orgId: a.orgId, userId: a.userId, requestId: a.requestId };
  for (const row of toCancel) {
    await applyStatusChangeTx(tx, ctx, row, 'CANCELLED', `Huỷ lớp: ${reason}`, { via: 'course_class.cancelled', courseClassId: classId });
  }
  return toCancel.length;
}
