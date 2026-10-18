import { createHash } from 'node:crypto';
import { Prisma, type EventKind, type LocationType, type StaffRole } from '@prisma/client';
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
import { isStaffOverlapViolation, pgErrorCode } from '../../http/middleware';
import { avatarSelect, resolveAvatarUrls, type AvatarSource } from '../files/service';

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
  // Nhân vật makeup của ca = bản chụp tên nhân vật trên dòng hợp đồng gắn với ca (giống hợp đồng hiển thị).
  contractLine: { select: { subjectName: true } },
  staff: {
    select: {
      membershipId: true,
      role: true,
      blockStart: true,
      blockEnd: true,
      isBlocking: true,
      membership: {
        select: { user: { select: { fullName: true } }, staffProfile: { select: { displayName: true, ...avatarSelect } } },
      },
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

export type AvatarOf = (p: AvatarSource | null | undefined) => string | null;

// Ảnh đại diện thợ của các ca, đổi thành URL ký có hạn qua đúng hàm dùng chung resolveAvatarUrls (modules/files):
// MỘT câu truy vấn tệp cho cả danh sách ca, không N+1.
export function avatarsOfAppointments(db: Prisma.TransactionClient, orgId: string, rows: AppointmentRow[]): Promise<AvatarOf> {
  return resolveAvatarUrls(
    db,
    orgId,
    rows.flatMap((r) => r.staff.map((s) => s.membership.staffProfile)),
  );
}

// MỌI cửa trả lịch (danh sách, xem, tạo, sửa, đổi trạng thái) đi qua đây hoặc presentAppointmentList.
export async function presentAppointmentOne(db: Prisma.TransactionClient, orgId: string, row: AppointmentRow, history?: HistoryRow[]) {
  return presentAppointment(row, await avatarsOfAppointments(db, orgId, [row]), history);
}

export async function presentAppointmentList(db: Prisma.TransactionClient, orgId: string, rows: AppointmentRow[]) {
  const avatarOf = await avatarsOfAppointments(db, orgId, rows);
  return rows.map((r) => presentAppointment(r, avatarOf));
}

// Trả về JSON thuần (chuỗi ISO, số) để kết quả lưu vào bảng chống gửi trùng giống hệt lần đầu.
export function presentAppointment(a: AppointmentRow, avatarOf: AvatarOf, history?: HistoryRow[]) {
  return {
    id: a.id,
    code: a.code,
    kind: a.kind,
    title: a.title,
    status: a.status,
    customer: a.customer,
    contract: a.contract,
    contractLineId: a.contractLineId,
    // Ca không gắn dòng hợp đồng → null (không đoán theo tên ca).
    subjectName: a.contractLine?.subjectName ?? null,
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
      displayName: s.membership.staffProfile?.displayName ?? s.membership.user.fullName,
      avatarUrl: avatarOf(s.membership.staffProfile),
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

export interface OverlapConflict {
  appointmentId: string;
  code: string;
  startsAt: string;
  endsAt: string;
  blockStart: string;
  blockEnd: string;
  membershipId: string;
  staffName: string;
}

// Các khoảng bận đang chồng lên khoảng [blockStart, blockEnd) của các thợ cho trước (trừ chính lịch đang sửa).
export async function findOverlaps(
  tx: Prisma.TransactionClient,
  orgId: string,
  membershipIds: string[],
  block: { blockStart: Date; blockEnd: Date },
  excludeAppointmentId?: string,
): Promise<OverlapConflict[]> {
  if (membershipIds.length === 0) return [];
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
  return rows.map((r) => ({
    appointmentId: r.appointment.id,
    code: r.appointment.code,
    startsAt: r.appointment.startsAt.toISOString(),
    endsAt: r.appointment.endsAt.toISOString(),
    blockStart: r.blockStart.toISOString(),
    blockEnd: r.blockEnd.toISOString(),
    membershipId: r.membershipId,
    staffName: r.membership.user.fullName,
  }));
}

// Lỗi 409 trùng lịch: LUÔN kèm details.conflicts (web types.ts hứa như vậy).
export function overlapError(conflicts: OverlapConflict[]): AppError {
  if (conflicts.length === 0) {
    return new AppError('CONFLICT', 'Trùng lịch: vừa có lịch khác chen vào giờ này, vui lòng tải lại lịch rồi thử lại', { conflicts });
  }
  const summary = conflicts.map((c) => `${c.staffName} đã có lịch ${c.code}`).join('; ');
  return new AppError('CONFLICT', `Trùng lịch: ${summary}`, { conflicts });
}

// Truy vấn trước để báo trùng dễ đọc. Ràng buộc EXCLUDE ở database vẫn là chốt chặn cuối khi hai yêu cầu đua nhau
// (bọc phần ghi bằng guardOverlap để lỗi của chốt cuối cũng kèm danh sách lịch trùng).
export async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  orgId: string,
  membershipIds: string[],
  block: { blockStart: Date; blockEnd: Date },
  excludeAppointmentId?: string,
) {
  const conflicts = await findOverlaps(tx, orgId, membershipIds, block, excludeAppointmentId);
  if (conflicts.length > 0) throw overlapError(conflicts);
}

// KHOÁ THỢ (biên bản nghiệm thu đợt sửa 1, T-I1). Gốc khoá chết: một lệnh ghi lịch ghi khoảng bận của thợ HAI lần trong
// cùng transaction — câu ghi appointment_staff, rồi trigger appointments_sync_staff_block của câu UPDATE appointments
// ghi lại lần nữa. Ràng buộc EXCLUDE appointment_staff_no_overlap phải CHỜ dòng chưa commit của bên kia, nên hai lệnh
// cùng giờ cùng thợ mỗi bên giữ một dòng mới và chờ dòng của bên kia → PostgreSQL huỷ một bên với 40P01.
// Chữa ở gốc: mọi cửa ghi có thể chạm ràng buộc xin khoá tư vấn TRƯỚC bước kiểm trước, theo thứ tự cố định:
//   1) khoá tổ chức — 'shared' cho cửa ghi một lịch (sửa, đổi trạng thái), 'exclusive' cho createAppointmentTx;
//   2) khoá từng thợ (tổ chức, membershipId), xếp tăng dần theo giá trị khoá.
// Hai lệnh ghi cùng thợ vì thế xếp hàng: bên sau chỉ chạy bước kiểm trước khi bên trước đã commit, thấy lịch của bên
// trước và trả 409 kèm danh sách — ràng buộc EXCLUDE không còn phải chờ ai.
// Vì sao tạo lịch giữ khoá tổ chức 'exclusive': module hợp đồng gọi createAppointmentTx NHIỀU lần trong một
// transaction (mỗi dòng có thợ một lịch), nên khoá thợ của nó không xếp được theo một thứ tự chung (dòng 1 thợ B, dòng 2
// thợ A). Giữ khoá tổ chức độc quyền thì không ai khác đang cầm khoá thợ nào của tổ chức (ai cầm khoá thợ cũng cầm khoá
// tổ chức 'shared'), nên thứ tự khoá thợ bên trong không còn gây vòng chờ. Các lệnh tạo lịch vốn đã xếp hàng theo tổ
// chức ở bộ đếm mã lịch (nextAppointmentCode), nên không mất thêm độ song song nào.
// Lưu ý cho người viết cửa mới: một transaction đã cầm 'shared' thì KHÔNG được xin 'exclusive' sau đó (hai bên cùng
// nâng khoá sẽ chờ nhau).
function scheduleLockKey(text: string): bigint {
  return createHash('sha256').update(text).digest().readBigInt64BE(0);
}

export async function lockStaffSchedule(
  tx: Prisma.TransactionClient,
  orgId: string,
  membershipIds: string[],
  mode: 'shared' | 'exclusive',
): Promise<void> {
  if (membershipIds.length === 0) return;
  const orgKey = scheduleLockKey(`lich-to-chuc:${orgId}`);
  if (mode === 'exclusive') await tx.$executeRaw`SELECT pg_advisory_xact_lock(${orgKey}::bigint)`;
  else await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${orgKey}::bigint)`;
  // Xếp theo chính giá trị khoá (không theo chuỗi id): hai thợ trùng khoá băm vẫn giữ một thứ tự chung, không vòng chờ.
  const keys = [...new Set(membershipIds.map((id) => scheduleLockKey(`lich-tho:${orgId}:${id}`)))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const key of keys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key}::bigint)`;
}

// Khoá chết (40P01) / lỗi tuần tự hoá (40001). Prisma 6.19 gói lỗi này trong transaction tương tác thành P2034.
export function isWriteConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') return true;
  const code = pgErrorCode(err);
  return code === '40P01' || code === '40001';
}

// Bọc các câu ghi có thể chạm ràng buộc EXCLUDE (phân thợ, đổi giờ, đổi trạng thái sang chiếm giờ).
// Hai yêu cầu đua nhau: bước kiểm trước của bên thua không thấy lịch chưa commit của bên thắng, nên database chặn.
// Khi đó quay về điểm lưu (transaction vẫn dùng được) rồi TRA LẠI: lúc này lịch bên thắng đã commit nên thấy được,
// và lỗi 409 kèm đủ danh sách như đường kiểm trước (biên bản nghiệm thu web 1, N4).
// LƯỚI AN TOÀN khoá chết (T-I1): mọi cửa của module lịch đã xin khoá thợ nên không còn khoá chết giữa chúng; lưới này
// dành cho bên ghi không xin khoá thợ (script, module khác sau này). Gặp 40P01: quay về điểm lưu rồi GHI LẠI ĐÚNG MỘT LẦN.
// Không tra lại ngay, vì lúc đó bên kia thường CHƯA commit (nó vừa được nhả khỏi vòng chờ) — tra ngay sẽ không thấy lịch
// nào, ra 409 rỗng. Ghi lại thì chính ràng buộc EXCLUDE chờ bên kia kết thúc rồi trả lời dứt khoát: bên kia commit →
// 23P01 → tra lại thấy lịch → 409 kèm danh sách; bên kia lui → ghi được → 200. Khoá chết lần hai (hiếm) → tra lại và trả
// 409 với những gì thấy được (conflicts vẫn là mảng), không thử nữa để yêu cầu không treo lâu.
export async function guardOverlap<T>(
  tx: Prisma.TransactionClient,
  check: { orgId: string; membershipIds: string[]; block: { blockStart: Date; blockEnd: Date }; excludeAppointmentId?: string },
  write: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    await tx.$executeRaw`SAVEPOINT chan_trung_lich`;
    try {
      const result = await write();
      await tx.$executeRaw`RELEASE SAVEPOINT chan_trung_lich`;
      return result;
    } catch (err) {
      const deadlock = isWriteConflict(err);
      if (!deadlock && !isStaffOverlapViolation(err)) throw err;
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT chan_trung_lich`;
      await tx.$executeRaw`RELEASE SAVEPOINT chan_trung_lich`;
      if (deadlock && attempt === 1) continue;
      throw overlapError(await findOverlaps(tx, check.orgId, check.membershipIds, check.block, check.excludeAppointmentId));
    }
  }
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
    // Khoá thợ trước bước kiểm (T-I1). 'exclusive': module hợp đồng gọi hàm này nhiều lần trong một transaction.
    await lockStaffSchedule(
      tx,
      ctx.orgId,
      input.staff.map((s) => s.membershipId),
      'exclusive',
    );
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
    const membershipIds = input.staff.map((s) => s.membershipId);
    await guardOverlap(tx, { orgId: ctx.orgId, membershipIds, block }, () =>
      tx.appointmentStaff.createMany({
        data: input.staff.map((s) => ({
          organizationId: ctx.orgId,
          appointmentId: created.id,
          membershipId: s.membershipId,
          role: s.role,
          blockStart: block.blockStart,
          blockEnd: block.blockEnd,
          isBlocking,
        })),
      }),
    );
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
  const check = {
    orgId: ctx.orgId,
    membershipIds: before.staff.map((s) => s.membershipId),
    block: computeBlock(before),
    excludeAppointmentId: before.id,
  };
  const startsBlocking = !wasBlocking && nowBlocking;
  if (startsBlocking) {
    await lockStaffSchedule(tx, check.orgId, check.membershipIds, 'shared'); // khoá thợ trước bước kiểm (T-I1)
    await assertNoOverlap(tx, check.orgId, check.membershipIds, check.block, check.excludeAppointmentId);
  }
  const write = async () => {
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
  };
  // Chỉ lúc lịch bắt đầu chiếm giờ mới có thể chạm ràng buộc EXCLUDE.
  if (startsBlocking) await guardOverlap(tx, check, write);
  else await write();
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
