import type { EventKind, LocationType, Prisma, StaffRole } from '@prisma/client';
import {
  INITIAL_STATUSES,
  MAX_APPOINTMENT_MS,
  MAX_TRAVEL_MIN,
  STATUS_TRANSITIONS,
  WORK_STATUS_LABELS,
  canTransition,
  computeBlock,
  isBlockingStatus,
  isTerminalStatus,
  normalizeVnPhone,
  type WorkStatus,
} from '@makeup/shared';
import type { OrgContext } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';

export type InitialStatus = (typeof INITIAL_STATUSES)[number];

export interface StaffAssignment {
  membershipId: string;
  role: StaffRole;
}

export interface CreateAppointmentInput {
  kind: EventKind;
  title?: string | null;
  customerId?: string;
  newCustomer?: { fullName: string; phone?: string | null };
  contractId?: string;
  contractLineId?: string;
  startsAt: Date;
  endsAt: Date;
  travelBeforeMin: number;
  travelAfterMin: number;
  locationType?: LocationType | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  staff: StaffAssignment[];
  status: InitialStatus;
}

export interface TxCtx {
  orgId: string;
  userId: string;
  requestId: string;
}

export const appointmentInclude = {
  customer: { select: { id: true, fullName: true, phone: true } },
  contract: { select: { id: true, code: true, status: true } },
  staff: {
    select: {
      membershipId: true,
      role: true,
      blockStart: true,
      blockEnd: true,
      isBlocking: true,
      membership: { select: { user: { select: { fullName: true } } } },
    },
    orderBy: [{ role: 'asc' }, { membershipId: 'asc' }],
  },
} satisfies Prisma.AppointmentInclude;

export type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

const historySelect = {
  fromStatus: true,
  toStatus: true,
  reason: true,
  changedAt: true,
  changedById: true,
} satisfies Prisma.AppointmentStatusHistorySelect;

export type HistoryRow = Prisma.AppointmentStatusHistoryGetPayload<{ select: typeof historySelect }>;

// Trả về JSON thuần (chuỗi ISO, số) để kết quả lưu vào bảng chống gửi trùng giống hệt lần đầu.
export function presentAppointment(a: AppointmentRow, history?: HistoryRow[]) {
  return {
    id: a.id,
    code: a.code,
    kind: a.kind,
    title: a.title,
    status: a.status,
    customer: a.customer,
    contract: a.contract,
    contractLineId: a.contractLineId,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    travelBeforeMin: a.travelBeforeMin,
    travelAfterMin: a.travelAfterMin,
    locationType: a.locationType,
    address: a.address,
    latitude: a.latitude === null ? null : a.latitude.toNumber(),
    longitude: a.longitude === null ? null : a.longitude.toNumber(),
    notes: a.notes,
    cancelReason: a.cancelReason,
    staff: a.staff.map((s) => ({
      membershipId: s.membershipId,
      fullName: s.membership.user.fullName,
      role: s.role,
      blockStart: s.blockStart.toISOString(),
      blockEnd: s.blockEnd.toISOString(),
      isBlocking: s.isBlocking,
    })),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    ...(history
      ? {
          statusHistory: history.map((h) => ({
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            reason: h.reason,
            changedById: h.changedById,
            changedAt: h.changedAt.toISOString(),
          })),
        }
      : {}),
  };
}

export async function loadHistory(tx: Prisma.TransactionClient, orgId: string, appointmentId: string) {
  return tx.appointmentStatusHistory.findMany({
    where: { organizationId: orgId, appointmentId },
    select: historySelect,
    orderBy: { changedAt: 'asc' },
  });
}

// Người không có schedule.read_all chỉ thấy (và chỉ đụng được) lịch mình được phân.
export function visibleWhere(o: OrgContext): Prisma.AppointmentWhereInput {
  return o.permissions.has('schedule.read_all') ? {} : { staff: { some: { membershipId: o.membershipId } } };
}

// Khoá dòng lịch: hai thao tác sửa/chuyển trạng thái cùng lịch xếp hàng, không ghi đè nhau.
export async function lockAppointment(tx: Prisma.TransactionClient, o: OrgContext, appointmentId: string) {
  await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${appointmentId}::uuid AND organization_id = ${o.id}::uuid FOR UPDATE`;
  const row = await tx.appointment.findFirst({
    where: { id: appointmentId, organizationId: o.id, ...visibleWhere(o) },
    include: appointmentInclude,
  });
  if (!row) throw new AppError('NOT_FOUND', 'Không tìm thấy lịch');
  return row;
}

export function assertTimeRange(t: { startsAt: Date; endsAt: Date; travelBeforeMin: number; travelAfterMin: number }) {
  const span = t.endsAt.getTime() - t.startsAt.getTime();
  if (span <= 0) throw new AppError('VALIDATION_FAILED', 'Giờ kết thúc phải sau giờ bắt đầu');
  if (span > MAX_APPOINTMENT_MS) throw new AppError('VALIDATION_FAILED', 'Một lịch dài tối đa 24 giờ');
  for (const [field, v] of [
    ['travelBeforeMin', t.travelBeforeMin],
    ['travelAfterMin', t.travelAfterMin],
  ] as const) {
    if (!Number.isInteger(v) || v < 0 || v > MAX_TRAVEL_MIN) {
      throw new AppError('VALIDATION_FAILED', `Thời gian di chuyển phải từ 0 đến ${MAX_TRAVEL_MIN} phút`, { field });
    }
  }
}

function assertStaffShape(staff: StaffAssignment[]) {
  const ids = staff.map((s) => s.membershipId);
  if (new Set(ids).size !== ids.length) {
    throw new AppError('VALIDATION_FAILED', 'Một thợ chỉ được phân một lần trong một lịch');
  }
  if (staff.filter((s) => s.role === 'PRIMARY').length > 1) {
    throw new AppError('VALIDATION_FAILED', 'Mỗi lịch tối đa một thợ chính');
  }
}

// Database đã chặn phân thợ khác tổ chức bằng khoá ngoại kép; ở đây chặn thêm thợ đã tạm khoá / rời tổ chức.
export async function assertActiveStaff(tx: Prisma.TransactionClient, orgId: string, staff: StaffAssignment[]) {
  assertStaffShape(staff);
  if (staff.length === 0) return;
  const ids = staff.map((s) => s.membershipId);
  const found = await tx.membership.findMany({
    where: { id: { in: ids }, organizationId: orgId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    const ok = new Set(found.map((m) => m.id));
    throw new AppError('VALIDATION_FAILED', 'Có thợ không thuộc tổ chức hoặc không còn hoạt động', {
      membershipIds: ids.filter((id) => !ok.has(id)),
    });
  }
}

// Thợ đã tắt "nhận lịch" không được xếp vào lịch mới. Chưa có hồ sơ thợ = nhận lịch (khớp mặc định database).
export async function assertBookable(tx: Prisma.TransactionClient, orgId: string, membershipIds: string[]) {
  if (membershipIds.length === 0) return;
  const off = await tx.staffProfile.findMany({
    where: { organizationId: orgId, membershipId: { in: membershipIds }, isBookable: false },
    select: { membershipId: true },
  });
  if (off.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Có thợ đang tắt nhận lịch', {
      membershipIds: off.map((p) => p.membershipId),
    });
  }
}

// Truy vấn trước để báo trùng dễ đọc. Ràng buộc EXCLUDE ở database vẫn là chốt chặn cuối khi hai yêu cầu đua nhau.
export async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  orgId: string,
  membershipIds: string[],
  block: { blockStart: Date; blockEnd: Date },
  excludeAppointmentId?: string,
) {
  if (membershipIds.length === 0) return;
  const rows = await tx.appointmentStaff.findMany({
    where: {
      organizationId: orgId,
      membershipId: { in: membershipIds },
      isBlocking: true,
      blockStart: { lt: block.blockEnd },
      blockEnd: { gt: block.blockStart },
      ...(excludeAppointmentId ? { appointmentId: { not: excludeAppointmentId } } : {}),
    },
    select: {
      membershipId: true,
      blockStart: true,
      blockEnd: true,
      appointment: { select: { id: true, code: true, startsAt: true, endsAt: true } },
      membership: { select: { user: { select: { fullName: true } } } },
    },
    orderBy: { blockStart: 'asc' },
  });
  if (rows.length === 0) return;
  const conflicts = rows.map((r) => ({
    appointmentId: r.appointment.id,
    code: r.appointment.code,
    startsAt: r.appointment.startsAt.toISOString(),
    endsAt: r.appointment.endsAt.toISOString(),
    blockStart: r.blockStart.toISOString(),
    blockEnd: r.blockEnd.toISOString(),
    membershipId: r.membershipId,
    staffName: r.membership.user.fullName,
  }));
  const summary = conflicts.map((c) => `${c.staffName} đã có lịch ${c.code}`).join('; ');
  throw new AppError('CONFLICT', `Trùng lịch: ${summary}`, { conflicts });
}

// Mã lịch tuần tự theo tổ chức. Câu upsert khoá dòng bộ đếm nên hai yêu cầu đồng thời không lấy trùng số.
async function nextAppointmentCode(tx: Prisma.TransactionClient, orgId: string): Promise<string> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO org_counters (organization_id, key, value) VALUES (${orgId}::uuid, 'appointment', 1)
    ON CONFLICT (organization_id, key) DO UPDATE SET value = org_counters.value + 1
    RETURNING value`;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error('Bộ đếm mã lịch không trả về giá trị');
  return `LH-${String(value).padStart(6, '0')}`;
}

function normalizePhoneOrFail(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null || raw.trim() === '') return null;
  const phone = normalizeVnPhone(raw);
  if (!phone) throw new AppError('VALIDATION_FAILED', 'Số điện thoại không hợp lệ', { phone: raw });
  return phone;
}

async function resolveCustomer(tx: Prisma.TransactionClient, ctx: TxCtx, input: CreateAppointmentInput): Promise<string | null> {
  if (input.customerId && input.newCustomer) {
    throw new AppError('VALIDATION_FAILED', 'Chỉ chọn khách có sẵn hoặc tạo khách mới, không gửi cả hai');
  }
  if (input.contractLineId && !input.contractId) {
    throw new AppError('VALIDATION_FAILED', 'Gửi dòng hợp đồng thì phải gửi kèm hợp đồng');
  }
  let contract: { customerId: string; status: string } | null = null;
  if (input.contractId) {
    // Khoá chia sẻ: hợp đồng không bị huỷ giữa lúc đang gắn lịch vào.
    await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${input.contractId}::uuid AND organization_id = ${ctx.orgId}::uuid FOR SHARE`;
    contract = await tx.contract.findFirst({
      where: { id: input.contractId, organizationId: ctx.orgId },
      select: { customerId: true, status: true },
    });
    if (!contract) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng');
    if (contract.status === 'CANCELLED') throw new AppError('CONFLICT', 'Hợp đồng đã huỷ, không gắn lịch mới được');
    if (input.newCustomer) {
      throw new AppError('VALIDATION_FAILED', 'Lịch gắn hợp đồng dùng khách của hợp đồng, không tạo khách mới');
    }
    if (input.customerId && input.customerId !== contract.customerId) {
      throw new AppError('VALIDATION_FAILED', 'Khách của lịch khác khách của hợp đồng');
    }
  }
  if (input.contractLineId) {
    const line = await tx.contractLine.findFirst({
      where: { id: input.contractLineId, organizationId: ctx.orgId },
      select: { contractId: true, voidedAt: true },
    });
    if (!line || line.contractId !== input.contractId) {
      throw new AppError('VALIDATION_FAILED', 'Dòng hợp đồng không thuộc hợp đồng này');
    }
    if (line.voidedAt) throw new AppError('CONFLICT', 'Dòng hợp đồng đã huỷ, không gắn lịch được');
  }

  if (input.newCustomer) {
    const created = await tx.customer.create({
      data: {
        organizationId: ctx.orgId,
        fullName: input.newCustomer.fullName,
        phone: normalizePhoneOrFail(input.newCustomer.phone),
      },
    });
    await writeAudit(tx, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'customer.created',
      entityType: 'customer',
      entityId: created.id,
      data: { fullName: created.fullName, phone: created.phone, via: 'appointment' },
      requestId: ctx.requestId,
    });
    return created.id;
  }
  if (input.customerId) {
    const c = await tx.customer.findFirst({ where: { id: input.customerId, organizationId: ctx.orgId }, select: { id: true } });
    if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy khách hàng');
    return c.id;
  }
  return contract?.customerId ?? null;
}

// Lõi tạo lịch, dùng chung cho đường POST lịch và module hợp đồng. Phải gọi trong transaction của người gọi.
export async function createAppointmentTx(
  tx: Prisma.TransactionClient,
  ctx: TxCtx,
  input: CreateAppointmentInput,
): Promise<AppointmentRow> {
  if (!(INITIAL_STATUSES as readonly string[]).includes(input.status)) {
    throw new AppError('VALIDATION_FAILED', 'Lịch mới chỉ được ở trạng thái nháp, chờ xác nhận hoặc đã xác nhận');
  }
  assertTimeRange(input);
  await assertActiveStaff(tx, ctx.orgId, input.staff);
  await assertBookable(
    tx,
    ctx.orgId,
    input.staff.map((s) => s.membershipId),
  );
  const customerId = await resolveCustomer(tx, ctx, input);

  // Lấy số trước khi kiểm trùng: yêu cầu đến sau phải đợi khoá bộ đếm, nên khi kiểm sẽ thấy lịch vừa lưu.
  const code = await nextAppointmentCode(tx, ctx.orgId);
  const block = computeBlock(input);
  const isBlocking = isBlockingStatus(input.status);
  if (isBlocking) {
    await assertNoOverlap(
      tx,
      ctx.orgId,
      input.staff.map((s) => s.membershipId),
      block,
    );
  }

  const created = await tx.appointment.create({
    data: {
      organizationId: ctx.orgId,
      code,
      kind: input.kind,
      title: input.title ?? null,
      customerId,
      contractId: input.contractId ?? null,
      contractLineId: input.contractLineId ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      travelBeforeMin: input.travelBeforeMin,
      travelAfterMin: input.travelAfterMin,
      locationType: input.locationType ?? null,
      address: input.address ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      notes: input.notes ?? null,
      status: input.status,
      createdById: ctx.userId,
    },
  });
  if (input.staff.length > 0) {
    await tx.appointmentStaff.createMany({
      data: input.staff.map((s) => ({
        organizationId: ctx.orgId,
        appointmentId: created.id,
        membershipId: s.membershipId,
        role: s.role,
        blockStart: block.blockStart,
        blockEnd: block.blockEnd,
        isBlocking,
      })),
    });
  }
  await tx.appointmentStatusHistory.create({
    data: {
      organizationId: ctx.orgId,
      appointmentId: created.id,
      fromStatus: null,
      toStatus: input.status,
      changedById: ctx.userId,
    },
  });
  await writeAudit(tx, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    action: 'appointment.created',
    entityType: 'appointment',
    entityId: created.id,
    data: {
      code,
      status: input.status,
      startsAt: input.startsAt.toISOString(),
      endsAt: input.endsAt.toISOString(),
      customerId,
      contractId: input.contractId ?? null,
      staff: input.staff.map((s) => ({ membershipId: s.membershipId, role: s.role })),
    },
    requestId: ctx.requestId,
  });
  return tx.appointment.findUniqueOrThrow({ where: { id: created.id }, include: appointmentInclude });
}

// Chuyển trạng thái một lịch đã khoá: kiểm bảng chuyển, kiểm trùng khi lịch bắt đầu chiếm giờ,
// cập nhật isBlocking của thợ, ghi lịch sử trạng thái và nhật ký. Dùng chung cho đường API và huỷ theo hợp đồng.
export async function applyStatusChangeTx(
  tx: Prisma.TransactionClient,
  ctx: TxCtx,
  before: AppointmentRow,
  to: WorkStatus,
  reason: string | null,
  auditExtra?: Record<string, string>,
): Promise<void> {
  if (!canTransition(before.status, to)) {
    throw new AppError(
      'CONFLICT',
      `Không chuyển được lịch từ "${WORK_STATUS_LABELS[before.status]}" sang "${WORK_STATUS_LABELS[to]}"`,
      { from: before.status, to, allowed: STATUS_TRANSITIONS[before.status] },
    );
  }
  if (to === 'CANCELLED' && !reason) throw new AppError('VALIDATION_FAILED', 'Huỷ lịch phải ghi lý do');
  const wasBlocking = isBlockingStatus(before.status);
  const nowBlocking = isBlockingStatus(to);
  if (!wasBlocking && nowBlocking) {
    await assertNoOverlap(
      tx,
      ctx.orgId,
      before.staff.map((s) => s.membershipId),
      computeBlock(before),
      before.id,
    );
  }
  if (wasBlocking !== nowBlocking) {
    await tx.appointmentStaff.updateMany({
      where: { appointmentId: before.id, organizationId: ctx.orgId },
      data: { isBlocking: nowBlocking },
    });
  }
  await tx.appointment.update({
    where: { id: before.id },
    data: { status: to, ...(to === 'CANCELLED' ? { cancelReason: reason } : {}) },
  });
  await tx.appointmentStatusHistory.create({
    data: {
      organizationId: ctx.orgId,
      appointmentId: before.id,
      fromStatus: before.status,
      toStatus: to,
      reason,
      changedById: ctx.userId,
    },
  });
  await writeAudit(tx, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    action: 'appointment.status_changed',
    entityType: 'appointment',
    entityId: before.id,
    data: { code: before.code, from: before.status, to, reason, ...auditExtra },
    requestId: ctx.requestId,
  });
}

// Huỷ hợp đồng thì huỷ các lịch đã gắn. Lịch đang làm dở (không còn đường sang "Đã huỷ" theo bảng chuyển)
// trả về trong `blocking` và KHÔNG lịch nào bị đổi — bên hợp đồng từ chối huỷ, không để huỷ dở dang một nửa.
// Lịch đã ở trạng thái cuối giữ nguyên.
export async function cancelAppointmentsOfContractTx(
  tx: Prisma.TransactionClient,
  ctx: TxCtx,
  contractId: string,
  reason: string,
): Promise<{ cancelled: string[]; blocking: string[] }> {
  if (reason.trim() === '') throw new AppError('VALIDATION_FAILED', 'Huỷ lịch phải ghi lý do');
  await tx.$queryRaw`SELECT id FROM appointments WHERE organization_id = ${ctx.orgId}::uuid AND contract_id = ${contractId}::uuid ORDER BY id FOR UPDATE`;
  const rows = await tx.appointment.findMany({
    where: { organizationId: ctx.orgId, contractId },
    include: appointmentInclude,
    orderBy: { code: 'asc' },
  });
  const blocking = rows.filter((r) => !isTerminalStatus(r.status) && !canTransition(r.status, 'CANCELLED')).map((r) => r.id);
  if (blocking.length > 0) return { cancelled: [], blocking };
  const toCancel = rows.filter((r) => canTransition(r.status, 'CANCELLED'));
  for (const row of toCancel) {
    await applyStatusChangeTx(tx, ctx, row, 'CANCELLED', reason, { via: 'contract.cancelled', contractId });
  }
  return { cancelled: toCancel.map((r) => r.id), blocking: [] };
}
