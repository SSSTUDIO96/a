// Bộ bắt lỗi trung tâm phải biến lỗi trùng lịch của database thành 409, không để lọt 500.
import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { isExclusionViolation } from '../src/http/middleware';
import { createOrg, makeApp, makeDeps, registerUser } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

async function setup() {
  const app = makeApp(deps);
  const owner = await registerUser(app, 'trung');
  const orgId = await createOrg(app, owner, 'trung-lich');
  const m = await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId } });
  const mk = (code: string) =>
    deps.db.appointment.create({
      data: {
        organizationId: orgId,
        code,
        startsAt: new Date('2026-11-01T01:00:00Z'),
        endsAt: new Date('2026-11-01T03:00:00Z'),
        status: 'CONFIRMED',
        createdById: owner.id,
      },
    });
  const a = await mk(`T-${randomUUID().slice(0, 6)}`);
  const b = await mk(`T-${randomUUID().slice(0, 6)}`);
  const block = (appointmentId: string) => ({
    organizationId: orgId,
    appointmentId,
    membershipId: m.id,
    blockStart: new Date('2026-11-01T01:00:00Z'),
    blockEnd: new Date('2026-11-01T03:00:00Z'),
    isBlocking: true,
  });
  await deps.db.appointmentStaff.create({ data: block(a.id) });
  return { orgId, b, block, m };
}

describe('nhận diện lỗi trùng lịch của database', () => {
  it('BẮT: ghi qua Prisma create bị database từ chối → nhận ra được', async () => {
    const { b, block } = await setup();
    const err = await deps.db.appointmentStaff.create({ data: block(b.id) }).catch((e: unknown) => e);
    expect(isExclusionViolation(err)).toBe(true);
  });

  it('BẮT: ghi qua câu lệnh SQL thô bị từ chối → nhận ra được', async () => {
    const { b, orgId, m } = await setup();
    const err = await deps.db
      .$executeRaw`INSERT INTO appointment_staff (organization_id, appointment_id, membership_id, role, block_start, block_end, is_blocking)
        VALUES (${orgId}::uuid, ${b.id}::uuid, ${m.id}::uuid, 'PRIMARY', '2026-11-01T02:00:00Z', '2026-11-01T04:00:00Z', true)`
      .catch((e: unknown) => e);
    expect(isExclusionViolation(err)).toBe(true);
  });

  it('GIỮ: lỗi trùng khoá thường (P2002) không bị nhận nhầm là trùng lịch', async () => {
    const email = `giu-${randomUUID().slice(0, 6)}@thu.local`;
    await deps.db.user.create({ data: { email, passwordHash: 'x', fullName: 'X' } });
    const err = await deps.db.user.create({ data: { email, passwordHash: 'x', fullName: 'X' } }).catch((e: unknown) => e);
    expect(isExclusionViolation(err)).toBe(false);
  });
});
