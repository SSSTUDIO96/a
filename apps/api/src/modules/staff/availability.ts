import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MAX_APPOINTMENT_MS } from '@makeup/shared';
import { defineRoute, mustOrg } from '../../http/route';
import { IsoTime } from '../schedule/appointments';
import { avatarSelect, resolveAvatarUrls } from '../files/service';
import { initialsOf } from './common';

// Cảnh báo khi chọn thợ: trùng giờ (OVERLAP), có lịch khác trong cùng ngày (SAME_DAY), hay rảnh (FREE).
export type AvailabilityLevel = 'OVERLAP' | 'SAME_DAY' | 'FREE';

export interface AvailabilityShift {
  appointmentId: string;
  code: string;
  status: string;
  startsAt: string;
  endsAt: string;
  // Khoảng bận đã gồm thời gian di chuyển.
  blockStart: string;
  blockEnd: string;
  title: string | null;
  customerName: string | null;
}

export interface DraftHold {
  contractId: string;
  code: string;
  lineId: string;
  lineName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  overlaps: boolean;
}

export interface StaffAvailability {
  membershipId: string;
  // Tên hiển thị (staffProfile.displayName ?? họ tên) và họ tên tài khoản — cùng nguồn staff/common.ts presentStaff.
  displayName: string;
  fullName: string;
  avatarUrl: string | null;
  initials: string;
  tier: { id: string; name: string } | null;
  isBookable: boolean;
  level: AvailabilityLevel;
  overlaps: AvailabilityShift[];
  sameDay: AvailabilityShift[];
  draftHolds: DraftHold[];
}

export interface AvailabilityInput {
  startsAt: Date;
  endsAt: Date;
  membershipIds?: string[];
  excludeAppointmentIds?: string[];
  excludeContractId?: string;
}

// Ranh giới "ngày" theo múi giờ của tổ chức, tính bằng Postgres (AT TIME ZONE) để đúng cả khi qua nửa đêm UTC.
// Khoảng chọn vắt qua nửa đêm địa phương thì "cùng ngày" gồm cả hai ngày.
async function localDayWindow(tx: Prisma.TransactionClient, orgId: string, startsAt: Date, endsAt: Date) {
  const rows = await tx.$queryRaw<{ day_start: Date; day_end: Date; timezone: string }[]>`
    SELECT (date_trunc('day', ${startsAt}::timestamptz AT TIME ZONE o.timezone) AT TIME ZONE o.timezone) AS day_start,
           ((date_trunc('day', (${endsAt}::timestamptz - interval '1 millisecond') AT TIME ZONE o.timezone) + interval '1 day')
             AT TIME ZONE o.timezone) AS day_end,
           o.timezone
    FROM organizations o WHERE o.id = ${orgId}::uuid`;
  const row = rows[0];
  if (!row) throw new Error(`Không tìm thấy tổ chức ${orgId} khi tính ngày địa phương`);
  return { dayStart: row.day_start, dayEnd: row.day_end, timezone: row.timezone };
}

const overlapsRange = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();

// Ba câu truy vấn cố định (thợ, ca đang chiếm giờ trong ngày, giữ chỗ ở hợp đồng nháp) rồi ghép trong bộ nhớ — không N+1.
export async function staffAvailabilityTx(
  tx: Prisma.TransactionClient,
  orgId: string,
  input: AvailabilityInput,
): Promise<StaffAvailability[]> {
  const window = await localDayWindow(tx, orgId, input.startsAt, input.endsAt);
  const members = await tx.membership.findMany({
    where: {
      organizationId: orgId,
      status: 'ACTIVE',
      ...(input.membershipIds ? { id: { in: input.membershipIds } } : {}),
    },
    select: {
      id: true,
      user: { select: { fullName: true } },
      staffProfile: {
        select: { displayName: true, ...avatarSelect, isBookable: true, tier: { select: { id: true, name: true } } },
      },
    },
  });
  const ids = members.map((m) => m.id);
  const [busy, holds] = await Promise.all([
    tx.appointmentStaff.findMany({
      where: {
        organizationId: orgId,
        membershipId: { in: ids },
        isBlocking: true,
        blockStart: { lt: window.dayEnd },
        blockEnd: { gt: window.dayStart },
        ...(input.excludeAppointmentIds?.length ? { appointmentId: { notIn: input.excludeAppointmentIds } } : {}),
      },
      select: {
        membershipId: true,
        blockStart: true,
        blockEnd: true,
        appointment: {
          select: {
            id: true,
            code: true,
            status: true,
            startsAt: true,
            endsAt: true,
            title: true,
            customer: { select: { fullName: true } },
          },
        },
      },
      orderBy: { blockStart: 'asc' },
    }),
    tx.contractLineStaff.findMany({
      where: {
        organizationId: orgId,
        membershipId: { in: ids },
        line: {
          voidedAt: null,
          contract: { status: 'DRAFT', ...(input.excludeContractId ? { id: { not: input.excludeContractId } } : {}) },
          OR: [
            { scheduledStart: { lt: window.dayEnd }, scheduledEnd: { gt: window.dayStart } },
            { scheduledEnd: null, scheduledStart: { gte: window.dayStart, lt: window.dayEnd } },
          ],
        },
      },
      select: {
        membershipId: true,
        line: {
          select: {
            id: true,
            name: true,
            scheduledStart: true,
            scheduledEnd: true,
            contract: { select: { id: true, code: true } },
          },
        },
      },
    }),
  ]);

  const avatarOf = await resolveAvatarUrls(
    tx,
    orgId,
    members.map((m) => m.staffProfile),
  );
  const result = new Map<string, StaffAvailability>();
  for (const m of members) {
    const p = m.staffProfile;
    const displayName = p?.displayName ?? m.user.fullName;
    result.set(m.id, {
      membershipId: m.id,
      displayName,
      fullName: m.user.fullName,
      avatarUrl: avatarOf(p),
      initials: initialsOf(displayName),
      tier: p?.tier ?? null,
      isBookable: p?.isBookable ?? true,
      level: 'FREE',
      overlaps: [],
      sameDay: [],
      draftHolds: [],
    });
  }
  for (const b of busy) {
    const entry = result.get(b.membershipId);
    if (!entry) continue;
    const a = b.appointment;
    const shift: AvailabilityShift = {
      appointmentId: a.id,
      code: a.code,
      status: a.status,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      blockStart: b.blockStart.toISOString(),
      blockEnd: b.blockEnd.toISOString(),
      title: a.title,
      customerName: a.customer?.fullName ?? null,
    };
    if (overlapsRange(b.blockStart, b.blockEnd, input.startsAt, input.endsAt)) {
      entry.overlaps.push(shift);
    } else if (overlapsRange(a.startsAt, a.endsAt, window.dayStart, window.dayEnd)) {
      // "Cùng ngày" xét giờ làm thật của ca, không xét thời gian di chuyển lấn sang ngày bên cạnh.
      entry.sameDay.push(shift);
    }
  }
  for (const h of holds) {
    const entry = result.get(h.membershipId);
    if (!entry) continue;
    const l = h.line;
    const start = l.scheduledStart;
    const overlaps =
      start !== null &&
      (l.scheduledEnd
        ? overlapsRange(start, l.scheduledEnd, input.startsAt, input.endsAt)
        : start.getTime() >= input.startsAt.getTime() && start.getTime() < input.endsAt.getTime());
    entry.draftHolds.push({
      contractId: l.contract.id,
      code: l.contract.code,
      lineId: l.id,
      lineName: l.name,
      scheduledStart: start ? start.toISOString() : null,
      scheduledEnd: l.scheduledEnd ? l.scheduledEnd.toISOString() : null,
      overlaps,
    });
  }
  const items = [...result.values()];
  for (const e of items) {
    e.level = e.overlaps.length > 0 ? 'OVERLAP' : e.sameDay.length > 0 ? 'SAME_DAY' : 'FREE';
    e.draftHolds.sort((x, y) => (x.scheduledStart ?? '').localeCompare(y.scheduledStart ?? ''));
  }
  return items.sort((x, y) => x.displayName.localeCompare(y.displayName, 'vi'));
}

// Danh sách mã: nhận "a,b" hoặc lặp tham số ?x=a&x=b.
const UuidList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.uuid()).min(1).max(100));

export const availabilityRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/staff/availability',
    scope: 'org',
    permission: 'staff.read',
    tag: 'Nhân sự',
    summary: 'Mức rảnh của thợ cho một khung giờ: trùng giờ / có lịch cùng ngày / rảnh, kèm giữ chỗ ở hợp đồng nháp khác',
    query: z
      .object({
        startsAt: IsoTime,
        endsAt: IsoTime,
        membershipIds: UuidList.optional(),
        excludeAppointmentIds: UuidList.optional(),
        excludeContractId: z.uuid().optional(),
      })
      .refine((q) => q.endsAt.getTime() > q.startsAt.getTime(), { message: '"endsAt" phải sau "startsAt"', path: ['endsAt'] })
      .refine((q) => q.endsAt.getTime() - q.startsAt.getTime() <= MAX_APPOINTMENT_MS, {
        message: 'Khung giờ tối đa 24 giờ',
        path: ['endsAt'],
      }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const window = await localDayWindow(deps.db, o.id, query.startsAt, query.endsAt);
      const items = await staffAvailabilityTx(deps.db, o.id, query);
      return {
        body: {
          startsAt: query.startsAt.toISOString(),
          endsAt: query.endsAt.toISOString(),
          dayStart: window.dayStart.toISOString(),
          dayEnd: window.dayEnd.toISOString(),
          timezone: window.timezone,
          items,
        },
      };
    },
  }),
];
