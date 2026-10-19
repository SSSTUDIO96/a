// Gom dữ liệu trang "Hôm nay" (bản vẽ D mục 2.6). Hàm thuần nhận `db` + ngữ cảnh (tổ chức, quyền, múi giờ, `now`) —
// dùng lại được cho bản tin C và màn Thu tiền / việc tồn 12. Mọi câu đều lọc `organizationId`; số câu truy vấn KHÔNG tăng
// theo số hợp đồng / số ca (không N+1).
import type { OrganizationKind, Prisma } from '@prisma/client';
import {
  allocateToInstallments,
  localDateAndMinute,
  seatState,
  summarizePayments,
  vndFromBigInt,
  zonedInstant,
  type PaymentLike,
} from '@makeup/shared';
import type { OrgContext } from '../../http/route';
import { visibleWhere } from '../schedule/service';
import { dateFromWire, dateToWire, todayIn } from '../courses/present';
import { paymentMath } from '../payments/common';
import {
  classSelect,
  installmentContractSelect,
  newContractSelect,
  newEnrollmentSelect,
  presentTodayAppointment,
  presentTodayClass,
  presentTodayContract,
  presentTodayEnrollment,
  presentTodayInstallment,
  todayAppointmentInclude,
  type InstallmentContractRow,
  type MoneyCount,
  type ScheduleScope,
  type TodayAppointment,
  type TodayContract,
  type TodayInstallment,
  type TodayView,
} from './present';

export type Db = Prisma.TransactionClient;

// Trần mỗi thẻ (bản vẽ D mục 2.6, cột "Trần").
export const TODAY_LIMITS = {
  appointmentsPerList: 200,
  unassigned: 50,
  installmentsPerList: 50,
  installmentContracts: 500,
  newContracts: 20,
  newEnrollments: 20,
  almostFullClasses: 20,
} as const;

const DAY_MS = 86_400_000;
const HOURS_24_MS = 24 * 60 * 60_000;

export interface TodayCtx {
  org: OrgContext;
  timezone: string;
  orgKind: OrganizationKind;
  // Một mốc duy nhất cho cả yêu cầu.
  now: Date;
}

// ---------- Mốc thời gian ----------

// Cộng n ngày lịch vào "YYYY-MM-DD" (không múi giờ).
export function addDays(date: string, n: number): string {
  return dateToWire(new Date(dateFromWire(date).getTime() + n * DAY_MS));
}

// Số ngày lịch từ `from` tới `to` ("YYYY-MM-DD"), âm khi `to` trước `from`.
function daysBetween(from: string, to: string): number {
  return Math.round((dateFromWire(to).getTime() - dateFromWire(from).getTime()) / DAY_MS);
}

export interface TodayClock {
  now: Date;
  timezone: string;
  today: string;
  tomorrow: string;
  // [todayStart, tomorrowStart) = Hôm nay; [tomorrowStart, laterStart) = Ngày mai; [laterStart, weekEnd) = Sau đó.
  todayStart: Date;
  tomorrowStart: Date;
  laterStart: Date;
  // dayStart(today + 8): mốc "7 ngày tới".
  weekEnd: Date;
  // now − 24 giờ.
  since24h: Date;
}

export function todayClock(timezone: string, now: Date): TodayClock {
  const today = todayIn(timezone, now);
  const dayStart = (n: number) => zonedInstant(addDays(today, n), 0, timezone);
  return {
    now,
    timezone,
    today,
    tomorrow: addDays(today, 1),
    todayStart: dayStart(0),
    tomorrowStart: dayStart(1),
    laterStart: dayStart(2),
    weekEnd: dayStart(8),
    since24h: new Date(now.getTime() - HOURS_24_MS),
  };
}

// ---------- Ca ----------

const HIDDEN_STATUSES = ['CANCELLED', 'NO_SHOW'] as const;

export function scheduleScopeOf(org: OrgContext): ScheduleScope | null {
  if (org.permissions.has('schedule.read_all')) return 'ALL';
  if (org.permissions.has('schedule.read_own')) return 'OWN';
  return null;
}

async function listAppointments(db: Db, where: Prisma.AppointmentWhereInput, take: number) {
  return db.appointment.findMany({
    where,
    include: todayAppointmentInclude,
    orderBy: [{ startsAt: 'asc' }, { code: 'asc' }],
    take,
  });
}

interface AppointmentCards {
  today: TodayAppointment[];
  tomorrow: TodayAppointment[];
  later: TodayAppointment[];
  truncated: boolean;
  countToday: number;
  countTomorrow: number;
}

async function collectAppointments(db: Db, ctx: TodayCtx, clock: TodayClock): Promise<AppointmentCards | null> {
  if (scheduleScopeOf(ctx.org) === null) return null;
  const cap = TODAY_LIMITS.appointmentsPerList;
  // Lọc "chỉ ca có mình" bằng ĐÚNG hàm của Lịch (schedule/service.ts visibleWhere — như appointments.ts:115-121).
  const base: Prisma.AppointmentWhereInput = {
    organizationId: ctx.org.id,
    status: { notIn: [...HIDDEN_STATUSES] },
    ...visibleWhere(ctx.org),
  };
  const inRange = (from: Date, to: Date): Prisma.AppointmentWhereInput => ({ ...base, startsAt: { gte: from, lt: to } });
  const [today, tomorrow, later, countToday, countTomorrow] = await Promise.all([
    listAppointments(db, inRange(clock.todayStart, clock.tomorrowStart), cap + 1),
    listAppointments(db, inRange(clock.tomorrowStart, clock.laterStart), cap + 1),
    listAppointments(db, inRange(clock.laterStart, clock.weekEnd), cap + 1),
    db.appointment.count({ where: inRange(clock.todayStart, clock.tomorrowStart) }),
    db.appointment.count({ where: inRange(clock.tomorrowStart, clock.laterStart) }),
  ]);
  return {
    today: today.slice(0, cap).map(presentTodayAppointment),
    tomorrow: tomorrow.slice(0, cap).map(presentTodayAppointment),
    later: later.slice(0, cap).map(presentTodayAppointment),
    truncated: today.length > cap || tomorrow.length > cap || later.length > cap,
    countToday,
    countTomorrow,
  };
}

async function collectUnassigned(db: Db, ctx: TodayCtx, clock: TodayClock): Promise<{ items: TodayAppointment[]; count: number } | null> {
  if (!ctx.org.permissions.has('schedule.read_all')) return null;
  const where: Prisma.AppointmentWhereInput = {
    organizationId: ctx.org.id,
    kind: 'MAKEUP',
    status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] },
    startsAt: { gte: clock.now, lt: clock.weekEnd },
    staff: { none: {} },
  };
  const [rows, count] = await Promise.all([
    listAppointments(db, where, TODAY_LIMITS.unassigned),
    db.appointment.count({ where }),
  ]);
  return { items: rows.map(presentTodayAppointment), count };
}

// ---------- Đợt thu ----------

interface InstallmentCards {
  overdue: TodayInstallment[];
  dueSoon: TodayInstallment[];
  truncated: boolean;
  overdueCount: MoneyCount;
  dueSoonCount: MoneyCount;
}

const COUNTED_CONTRACT_STATUSES = ['CONFIRMED', 'COMPLETED'] as const;

async function collectInstallments(db: Db, ctx: TodayCtx, clock: TodayClock): Promise<InstallmentCards | null> {
  if (!ctx.org.permissions.has('payments.read')) return null;
  const orgId = ctx.org.id;
  const maxContracts = TODAY_LIMITS.installmentContracts;

  // 1. Hợp đồng (của tổ chức, đã xác nhận / hoàn thành) có ít nhất một đợt hạn < dayStart(today + 8); sắp theo hạn sớm nhất.
  const groups = await db.paymentInstallment.groupBy({
    by: ['contractId'],
    where: {
      organizationId: orgId,
      dueDate: { lt: clock.weekEnd },
      contract: { organizationId: orgId, status: { in: [...COUNTED_CONTRACT_STATUSES] } },
    },
    _min: { dueDate: true },
    orderBy: [{ _min: { dueDate: 'asc' } }, { contractId: 'asc' }],
    take: maxContracts + 1,
  });
  const truncated = groups.length > maxContracts;
  const contractIds = groups.slice(0, maxContracts).map((g) => g.contractId);
  if (contractIds.length === 0) {
    return { overdue: [], dueSoon: [], truncated: false, overdueCount: { count: 0, amount: 0 }, dueSoonCount: { count: 0, amount: 0 } };
  }

  // 2. Một câu đọc mọi đợt, một câu đọc hợp đồng, một câu groupBy phiếu (theo loại, bỏ phiếu đã huỷ).
  const [contracts, installments, sums] = await Promise.all([
    db.contract.findMany({ where: { id: { in: contractIds }, organizationId: orgId }, select: installmentContractSelect }),
    db.paymentInstallment.findMany({
      where: { contractId: { in: contractIds }, organizationId: orgId },
      select: { id: true, contractId: true, name: true, dueDate: true, amount: true, isDeposit: true },
      // Cùng thứ tự với loadProgress (payments/common.ts) để đợt cùng hạn đổ tiền như màn Thu tiền.
      orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }],
    }),
    db.payment.groupBy({
      by: ['contractId', 'kind'],
      where: { contractId: { in: contractIds }, organizationId: orgId, voidedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const contractById = new Map<string, InstallmentContractRow>(contracts.map((c) => [c.id, c]));
  const paymentsByContract = new Map<string, PaymentLike[]>();
  for (const s of sums) {
    const sum = s._sum.amount;
    if (sum === null || sum === 0n) continue;
    const list = paymentsByContract.get(s.contractId) ?? [];
    list.push({ kind: s.kind, amount: vndFromBigInt(sum, 'tổng phiếu'), voided: false });
    paymentsByContract.set(s.contractId, list);
  }
  const installmentsByContract = new Map<string, typeof installments>();
  for (const i of installments) {
    const list = installmentsByContract.get(i.contractId) ?? [];
    list.push(i);
    installmentsByContract.set(i.contractId, list);
  }

  // 3. Trạng thái từng đợt = đúng hai hàm của màn Thu tiền (summarizePayments + allocateToInstallments).
  const canSeePhone = ctx.org.permissions.has('customers.read');
  const overdue: { due: number; view: TodayInstallment }[] = [];
  const dueSoon: { due: number; view: TodayInstallment }[] = [];
  let overdueAmount = 0n;
  let dueSoonAmount = 0n;
  for (const contractId of contractIds) {
    const c = contractById.get(contractId);
    if (!c) throw new Error(`Hợp đồng ${contractId} có đợt thu nhưng không đọc được`);
    const summary = paymentMath(() =>
      summarizePayments(
        vndFromBigInt(c.total, 'tổng hợp đồng'),
        vndFromBigInt(c.depositRequired, 'tiền cọc'),
        paymentsByContract.get(contractId) ?? [],
      ),
    );
    const rows = (installmentsByContract.get(contractId) ?? []).map((i) => ({ ...i, amount: vndFromBigInt(i.amount, 'số tiền đợt') }));
    const allocated = paymentMath(() => allocateToInstallments(rows, summary.paid, clock.now));
    for (const it of allocated) {
      if (it.status === 'OVERDUE') {
        const days = Math.max(0, daysBetween(localDateAndMinute(it.dueDate, clock.timezone).date, clock.today));
        overdue.push({ due: it.dueDate.getTime(), view: presentTodayInstallment({ ...it, status: 'OVERDUE' }, days, c, canSeePhone) });
        overdueAmount += BigInt(it.outstanding);
      } else if ((it.status === 'DUE' || it.status === 'PARTIAL') && it.dueDate.getTime() < clock.weekEnd.getTime()) {
        dueSoon.push({ due: it.dueDate.getTime(), view: presentTodayInstallment({ ...it, status: it.status }, 0, c, canSeePhone) });
        dueSoonAmount += BigInt(it.outstanding);
      }
    }
  }
  const byDue = (a: { due: number; view: TodayInstallment }, b: { due: number; view: TodayInstallment }) =>
    a.due - b.due || a.view.contract.code.localeCompare(b.view.contract.code) || a.view.installmentId.localeCompare(b.view.installmentId);
  overdue.sort(byDue);
  dueSoon.sort(byDue);
  const cap = TODAY_LIMITS.installmentsPerList;
  return {
    overdue: overdue.slice(0, cap).map((x) => x.view),
    dueSoon: dueSoon.slice(0, cap).map((x) => x.view),
    truncated,
    overdueCount: { count: overdue.length, amount: vndFromBigInt(overdueAmount, 'tổng quá hạn') },
    dueSoonCount: { count: dueSoon.length, amount: vndFromBigInt(dueSoonAmount, 'tổng sắp tới hạn') },
  };
}

// ---------- Hợp đồng mới (24 giờ qua) ----------

async function collectNewContracts(db: Db, ctx: TodayCtx, clock: TodayClock): Promise<TodayContract[] | null> {
  if (!ctx.org.permissions.has('contracts.read')) return null;
  const orgId = ctx.org.id;
  const rows = await db.contract.findMany({
    where: { organizationId: orgId, status: { in: [...COUNTED_CONTRACT_STATUSES] }, confirmedAt: { gte: clock.since24h } },
    select: newContractSelect,
    orderBy: [{ confirmedAt: 'desc' }, { code: 'desc' }],
    take: TODAY_LIMITS.newContracts,
  });
  if (rows.length === 0) return [];
  // Người xác nhận = nhật ký contract.status_changed với to = CONFIRMED (bản ghi mới nhất của mỗi hợp đồng).
  const logs = await db.auditLog.findMany({
    where: {
      organizationId: orgId,
      action: 'contract.status_changed',
      entityType: 'contract',
      entityId: { in: rows.map((r) => r.id) },
      data: { path: ['to'], equals: 'CONFIRMED' },
    },
    select: { entityId: true, actor: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const confirmer = new Map<string, TodayContract['confirmedBy']>();
  for (const l of logs) {
    if (l.entityId === null || confirmer.has(l.entityId)) continue;
    confirmer.set(l.entityId, l.actor ? { userId: l.actor.id, fullName: l.actor.fullName } : null);
  }
  return rows.map((r) => presentTodayContract(r, confirmer.get(r.id) ?? null));
}

// ---------- Đào tạo (chỉ tổ chức ACADEMY) ----------

function seesCourses(ctx: TodayCtx): boolean {
  return ctx.orgKind === 'ACADEMY' && ctx.org.permissions.has('courses.read');
}

async function collectNewEnrollments(db: Db, ctx: TodayCtx, clock: TodayClock) {
  if (!seesCourses(ctx)) return null;
  const rows = await db.enrollment.findMany({
    where: { organizationId: ctx.org.id, status: 'ACTIVE', enrolledAt: { gte: clock.since24h } },
    select: newEnrollmentSelect,
    orderBy: [{ enrolledAt: 'desc' }, { id: 'asc' }],
    take: TODAY_LIMITS.newEnrollments,
  });
  return rows.map(presentTodayEnrollment);
}

async function collectAlmostFullClasses(db: Db, ctx: TodayCtx, clock: TodayClock) {
  if (!seesCourses(ctx)) return null;
  // Lớp đang mở, chưa kết thúc; "sắp đầy" quyết bằng đúng seatState dùng chung với web (không chép tỉ lệ 0,75 vào SQL).
  const rows = await db.courseClass.findMany({
    where: { organizationId: ctx.org.id, status: 'OPEN', endDate: { gte: dateFromWire(clock.today) } },
    select: classSelect,
    orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
  });
  return rows
    .filter((k) => seatState(k.enrolledCount, k.capacity) === 'ALMOST_FULL')
    .slice(0, TODAY_LIMITS.almostFullClasses)
    .map(presentTodayClass);
}

// ---------- Ghép ----------

export async function collectToday(db: Db, ctx: TodayCtx): Promise<TodayView> {
  if (!ctx.timezone) throw new Error('collectToday: thiếu múi giờ tổ chức');
  if (!(ctx.now instanceof Date) || Number.isNaN(ctx.now.getTime())) throw new Error('collectToday: mốc thời gian không hợp lệ');
  const clock = todayClock(ctx.timezone, ctx.now);
  const [appointments, unassigned, installments, newContracts, newEnrollments, almostFullClasses] = await Promise.all([
    collectAppointments(db, ctx, clock),
    collectUnassigned(db, ctx, clock),
    collectInstallments(db, ctx, clock),
    collectNewContracts(db, ctx, clock),
    collectNewEnrollments(db, ctx, clock),
    collectAlmostFullClasses(db, ctx, clock),
  ]);
  return {
    generatedAt: clock.now.toISOString(),
    timezone: clock.timezone,
    today: clock.today,
    tomorrow: clock.tomorrow,
    scheduleScope: scheduleScopeOf(ctx.org),
    counts: {
      appointmentsToday: appointments ? appointments.countToday : null,
      appointmentsTomorrow: appointments ? appointments.countTomorrow : null,
      unassignedSoon: unassigned ? unassigned.count : null,
      overdue: installments ? installments.overdueCount : null,
      dueSoon: installments ? installments.dueSoonCount : null,
    },
    appointments: appointments
      ? { today: appointments.today, tomorrow: appointments.tomorrow, later: appointments.later, truncated: appointments.truncated }
      : null,
    unassigned: unassigned ? unassigned.items : null,
    installments: installments
      ? { overdue: installments.overdue, dueSoon: installments.dueSoon, truncated: installments.truncated }
      : null,
    newContracts,
    newEnrollments,
    almostFullClasses,
  };
}
