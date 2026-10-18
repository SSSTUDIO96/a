import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  INITIAL_STATUSES,
  MAX_TRAVEL_MIN,
  WORK_STATUSES,
  WORK_STATUS_LABELS,
  computeBlock,
  isBlockingStatus,
  isTerminalStatus,
} from '@makeup/shared';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { Phone } from './customers';
import {
  appointmentInclude,
  applyStatusChangeTx,
  assertActiveStaff,
  assertBookable,
  assertNoOverlap,
  assertTimeRange,
  createAppointmentTx,
  guardOverlap,
  loadHistory,
  lockAppointment,
  lockStaffSchedule,
  presentAppointmentList,
  presentAppointmentOne,
  visibleWhere,
} from './service';

const MAX_RANGE_DAYS = 62;

export const IsoTime = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
const OrgParams = z.object({ orgId: z.uuid() });
const AppointmentParams = OrgParams.extend({ appointmentId: z.uuid() });
const TravelMin = z.number().int().min(0).max(MAX_TRAVEL_MIN);
const LocationTypeSchema = z.enum(['STUDIO', 'CUSTOMER_HOME', 'OTHER']);
const Staff = z
  .array(z.object({ membershipId: z.uuid(), role: z.enum(['PRIMARY', 'ASSIST']).default('PRIMARY') }))
  .max(10)
  .refine((s) => s.filter((x) => x.role === 'PRIMARY').length <= 1, 'Mỗi lịch tối đa một thợ chính')
  .refine((s) => new Set(s.map((x) => x.membershipId)).size === s.length, 'Một thợ chỉ được phân một lần trong một lịch');
const Place = {
  locationType: LocationTypeSchema.nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
};

const CreateBody = z
  .object({
    kind: z.enum(['MAKEUP', 'COURSE_SESSION', 'INTERNAL', 'PERSONAL_BLOCK', 'OTHER']).default('MAKEUP'),
    customerId: z.uuid().optional(),
    newCustomer: z.object({ fullName: z.string().trim().min(1).max(120), phone: Phone.nullable().optional() }).optional(),
    contractId: z.uuid().optional(),
    contractLineId: z.uuid().optional(),
    startsAt: IsoTime,
    endsAt: IsoTime,
    travelBeforeMin: TravelMin.default(0),
    travelAfterMin: TravelMin.default(0),
    ...Place,
    staff: Staff.default([]),
    status: z.enum(INITIAL_STATUSES).default('DRAFT'),
  })
  .refine((b) => !(b.customerId && b.newCustomer), 'Chỉ chọn khách có sẵn hoặc tạo khách mới, không gửi cả hai');

const ListQuery = z
  .object({
    from: IsoTime,
    to: IsoTime,
    membershipId: z.uuid().optional(),
    contractId: z.uuid().optional(),
    status: z.enum(WORK_STATUSES).optional(),
  })
  .refine((q) => q.to.getTime() > q.from.getTime(), { message: '"to" phải sau "from"', path: ['to'] })
  .refine((q) => q.to.getTime() - q.from.getTime() <= MAX_RANGE_DAYS * 86_400_000, {
    message: `Khoảng xem tối đa ${MAX_RANGE_DAYS} ngày`,
    path: ['to'],
  });

const PatchBody = z
  .object({
    startsAt: IsoTime.optional(),
    endsAt: IsoTime.optional(),
    travelBeforeMin: TravelMin.optional(),
    travelAfterMin: TravelMin.optional(),
    ...Place,
    staff: Staff.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'Không có gì để sửa');

const StatusBody = z
  .object({ to: z.enum(WORK_STATUSES), reason: z.string().trim().min(1).max(500).optional() })
  .refine((b) => b.to !== 'CANCELLED' || b.reason !== undefined, {
    message: 'Huỷ lịch phải ghi lý do',
    path: ['reason'],
  });

export const appointmentRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/appointments',
    scope: 'org',
    permission: 'schedule.read_own',
    tag: 'Lịch',
    summary: `Lịch trong khoảng from–to (bắt buộc, tối đa ${MAX_RANGE_DAYS} ngày); người chỉ có read_own thấy lịch mình`,
    query: ListQuery,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const readAll = o.permissions.has('schedule.read_all');
      if (!readAll && query.membershipId && query.membershipId !== o.membershipId) {
        throw new AppError('FORBIDDEN', 'Bạn chỉ xem được lịch của chính mình', { required: 'schedule.read_all' });
      }
      const staffFilter = readAll ? query.membershipId : o.membershipId;
      const where: Prisma.AppointmentWhereInput = {
        organizationId: o.id,
        startsAt: { lt: query.to },
        endsAt: { gt: query.from },
        ...(staffFilter ? { staff: { some: { membershipId: staffFilter } } } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.contractId ? { contractId: query.contractId } : {}),
      };
      const rows = await deps.db.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: [{ startsAt: 'asc' }, { code: 'asc' }],
      });
      return {
        body: { items: await presentAppointmentList(deps.db, o.id, rows), from: query.from.toISOString(), to: query.to.toISOString() },
      };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/appointments',
    scope: 'org',
    permission: 'schedule.write',
    tag: 'Lịch',
    summary: 'Tạo lịch; kiểm trùng giờ của thợ (cả thời gian di chuyển). Bắt buộc header Idempotency-Key',
    idempotent: true,
    body: CreateBody,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      if (body.newCustomer && !o.permissions.has('customers.write')) {
        throw new AppError('FORBIDDEN', 'Bạn không có quyền thêm khách hàng', { required: 'customers.write' });
      }
      const ctx = { orgId: o.id, userId: mustUser(userId), requestId };
      const row = await deps.db.$transaction((tx) => createAppointmentTx(tx, ctx, body));
      return { status: 201, body: await presentAppointmentOne(deps.db, o.id, row, await loadHistory(deps.db, o.id, row.id)) };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/appointments/:appointmentId',
    scope: 'org',
    permission: 'schedule.read_own',
    tag: 'Lịch',
    summary: 'Xem một lịch kèm lịch sử trạng thái',
    params: AppointmentParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      const row = await deps.db.appointment.findFirst({
        where: { id: params.appointmentId, organizationId: o.id, ...visibleWhere(o) },
        include: appointmentInclude,
      });
      if (!row) throw new AppError('NOT_FOUND', 'Không tìm thấy lịch');
      return { body: await presentAppointmentOne(deps.db, o.id, row, await loadHistory(deps.db, o.id, row.id)) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/appointments/:appointmentId',
    scope: 'org',
    permission: 'schedule.write',
    tag: 'Lịch',
    summary: 'Đổi giờ, thời gian di chuyển, địa điểm, ghi chú, thợ',
    params: AppointmentParams,
    body: PatchBody,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const row = await deps.db.$transaction(async (tx) => {
        const before = await lockAppointment(tx, o, params.appointmentId);
        if (isTerminalStatus(before.status)) {
          throw new AppError('CONFLICT', `Lịch ${WORK_STATUS_LABELS[before.status].toLowerCase()} không sửa được`);
        }
        const time = {
          startsAt: body.startsAt ?? before.startsAt,
          endsAt: body.endsAt ?? before.endsAt,
          travelBeforeMin: body.travelBeforeMin ?? before.travelBeforeMin,
          travelAfterMin: body.travelAfterMin ?? before.travelAfterMin,
        };
        assertTimeRange(time);
        const timeChanged =
          time.startsAt.getTime() !== before.startsAt.getTime() ||
          time.endsAt.getTime() !== before.endsAt.getTime() ||
          time.travelBeforeMin !== before.travelBeforeMin ||
          time.travelAfterMin !== before.travelAfterMin;
        const block = computeBlock(time);
        const isBlocking = isBlockingStatus(before.status);
        const staff = body.staff ?? before.staff.map((s) => ({ membershipId: s.membershipId, role: s.role }));

        if (body.staff) {
          await assertActiveStaff(tx, o.id, body.staff);
          // Thợ đã tắt nhận lịch không được thêm vào lịch; thợ đã phân từ trước thì giữ nguyên.
          const kept = new Set(before.staff.map((s) => s.membershipId));
          await assertBookable(
            tx,
            o.id,
            body.staff.map((s) => s.membershipId).filter((id) => !kept.has(id)),
          );
        }
        const check = { orgId: o.id, membershipIds: staff.map((s) => s.membershipId), block, excludeAppointmentId: before.id };
        const mayOverlap = isBlocking && (timeChanged || body.staff !== undefined);
        if (mayOverlap) {
          // Khoá thợ (thợ SAU khi sửa) trước bước kiểm: hai lệnh ghi cùng thợ xếp hàng, không khoá chết (T-I1).
          await lockStaffSchedule(tx, check.orgId, check.membershipIds, 'shared');
          await assertNoOverlap(tx, check.orgId, check.membershipIds, check.block, check.excludeAppointmentId);
        }
        const write = async () => {
          if (body.staff) {
            await tx.appointmentStaff.deleteMany({ where: { appointmentId: before.id, organizationId: o.id } });
            if (body.staff.length > 0) {
              await tx.appointmentStaff.createMany({
                data: body.staff.map((s) => ({
                  organizationId: o.id,
                  appointmentId: before.id,
                  membershipId: s.membershipId,
                  role: s.role,
                  blockStart: block.blockStart,
                  blockEnd: block.blockEnd,
                  isBlocking,
                })),
              });
            }
          } else if (timeChanged) {
            await tx.appointmentStaff.updateMany({
              where: { appointmentId: before.id, organizationId: o.id },
              data: { blockStart: block.blockStart, blockEnd: block.blockEnd },
            });
          }
          const { staff: _staff, ...fields } = body;
          // Trigger của database tính lại khoảng bận của thợ theo giờ mới ở câu này — chỗ hay chạm ràng buộc EXCLUDE nhất.
          await tx.appointment.update({ where: { id: before.id }, data: fields });
        };
        // Bước kiểm trước có thể không thấy lịch của yêu cầu đua đang ghi dở; database chặn thì tra lại để kèm danh sách.
        if (mayOverlap) await guardOverlap(tx, check, write);
        else await write();
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'appointment.updated',
          entityType: 'appointment',
          entityId: before.id,
          data: {
            code: before.code,
            before: {
              startsAt: before.startsAt.toISOString(),
              endsAt: before.endsAt.toISOString(),
              travelBeforeMin: before.travelBeforeMin,
              travelAfterMin: before.travelAfterMin,
              staff: before.staff.map((s) => ({ membershipId: s.membershipId, role: s.role })),
            },
            after: {
              startsAt: time.startsAt.toISOString(),
              endsAt: time.endsAt.toISOString(),
              travelBeforeMin: time.travelBeforeMin,
              travelAfterMin: time.travelAfterMin,
              staff,
              changed: Object.keys(body),
            },
          },
          requestId,
        });
        return tx.appointment.findUniqueOrThrow({ where: { id: before.id }, include: appointmentInclude });
      });
      return { body: await presentAppointmentOne(deps.db, o.id, row, await loadHistory(deps.db, o.id, row.id)) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/appointments/:appointmentId/status',
    scope: 'org',
    permission: 'schedule.write',
    tag: 'Lịch',
    summary: 'Chuyển trạng thái lịch theo bảng chuyển trạng thái; huỷ phải ghi lý do',
    params: AppointmentParams,
    body: StatusBody,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const row = await deps.db.$transaction(async (tx) => {
        const before = await lockAppointment(tx, o, params.appointmentId);
        await applyStatusChangeTx(tx, { orgId: o.id, userId: uid, requestId }, before, body.to, body.reason ?? null);
        return tx.appointment.findUniqueOrThrow({ where: { id: before.id }, include: appointmentInclude });
      });
      return { body: await presentAppointmentOne(deps.db, o.id, row, await loadHistory(deps.db, o.id, row.id)) };
    },
  }),
];
