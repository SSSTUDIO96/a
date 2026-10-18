import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { AppError } from '../src/lib/errors';
import {
  EXPIRED_MESSAGE,
  GRACE_DAYS,
  assertQuota,
  assertWritable,
  currentSubscriptionsSql,
  describeSubscription,
  effectiveStatusSql,
  getCurrentSubscription,
  getEffectivePlan,
  getUsage,
} from '../src/lib/quota';
import { addMember, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;
let owner: TestUser;
const DAY = 24 * 60 * 60 * 1000;

async function plan(limits: Partial<Prisma.SubscriptionPlanCreateInput> = {}) {
  return db.subscriptionPlan.create({
    data: { code: `q_${randomUUID().slice(0, 8)}`, name: `Gói Q${randomUUID().slice(0, 4)}`, priceMonthly: 0n, features: [], ...limits },
  });
}

async function sub(orgId: string, planId: string, startsAt: Date, endsAt: Date | null, status: Prisma.OrganizationSubscriptionCreateInput['status'] = 'ACTIVE') {
  return db.organizationSubscription.create({ data: { organizationId: orgId, planId, startsAt, endsAt, status } });
}

async function caught(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('Mong đợi lỗi nhưng không có');
}

// Chạy trong transaction rồi HUỶ — dùng để thử trạng thái toàn cục (gói 'trial') mà không để lại dấu vết.
class Rollback extends Error {}
async function inRolledBackTx(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  await expect(
    db.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'quota-chu');
});

afterAll(async () => {
  await db.$disconnect();
});

describe('Trạng thái hiệu lực (hàm thuần)', () => {
  const now = new Date('2026-10-18T05:00:00Z');
  const at = (days: number) => new Date(now.getTime() + days * DAY);
  it('còn hạn / không hạn → giữ trạng thái đã ghi, được ghi', () => {
    expect(describeSubscription({ status: 'ACTIVE', endsAt: at(1) }, now)).toMatchObject({ effectiveStatus: 'ACTIVE', writable: true, inGrace: false });
    expect(describeSubscription({ status: 'TRIAL', endsAt: null }, now)).toMatchObject({ effectiveStatus: 'TRIAL', writable: true, graceEndsAt: null });
  });
  it('đúng mốc endsAt → EXPIRED nhưng còn ân hạn; hết ân hạn → chỉ đọc', () => {
    expect(describeSubscription({ status: 'ACTIVE', endsAt: now }, now)).toMatchObject({ effectiveStatus: 'EXPIRED', writable: true, inGrace: true });
    expect(describeSubscription({ status: 'ACTIVE', endsAt: at(-GRACE_DAYS + 0.01) }, now)).toMatchObject({ writable: true });
    expect(describeSubscription({ status: 'ACTIVE', endsAt: at(-GRACE_DAYS) }, now)).toMatchObject({ effectiveStatus: 'EXPIRED', writable: false, inGrace: false });
  });
  it('EXPIRED / CANCELLED ghi tay → chỉ đọc ngay, không ân hạn', () => {
    expect(describeSubscription({ status: 'CANCELLED', endsAt: at(30) }, now)).toMatchObject({ effectiveStatus: 'CANCELLED', writable: false });
    expect(describeSubscription({ status: 'EXPIRED', endsAt: null }, now)).toMatchObject({ effectiveStatus: 'EXPIRED', writable: false });
  });
});

describe('Thuê bao hiện hành', () => {
  it('chưa có dòng nào → báo rõ "chưa có thuê bao"; dòng tương lai chưa tính; dòng mới nhất có startsAt ≤ now thắng', async () => {
    const orgId = await createOrg(app, owner, 'quota-ht');
    expect(await getCurrentSubscription(db, orgId)).toEqual({ hasSubscription: false });
    const p1 = await plan();
    const p2 = await plan();
    const future = await sub(orgId, p2.id, new Date(Date.now() + 5 * DAY), null);
    expect((await getCurrentSubscription(db, orgId)).hasSubscription).toBe(false);
    const old = await sub(orgId, p1.id, new Date(Date.now() - 20 * DAY), new Date(Date.now() + 10 * DAY));
    const newer = await sub(orgId, p2.id, new Date(Date.now() - 2 * DAY), null);
    const cur = await getCurrentSubscription(db, orgId);
    expect(cur.hasSubscription && cur.subscription.id).toBe(newer.id);
    const later = await getCurrentSubscription(db, orgId, new Date(Date.now() + 6 * DAY));
    expect(later.hasSubscription && later.subscription.id).toBe(future.id);
    expect(old.id).not.toBe(newer.id);
  });

  it('câu SQL lọc ra cùng trạng thái hiệu lực với hàm TypeScript', async () => {
    const p = await plan();
    const now = new Date();
    const cases: [string, Date | null, Prisma.OrganizationSubscriptionCreateInput['status'] | null][] = [
      ['NONE', null, null],
      ['ACTIVE', new Date(now.getTime() + DAY), 'ACTIVE'],
      ['EXPIRED', new Date(now.getTime() - DAY), 'ACTIVE'],
      ['EXPIRED', new Date(now.getTime() - 30 * DAY), 'PAST_DUE'],
      ['CANCELLED', new Date(now.getTime() + DAY), 'CANCELLED'],
      ['TRIAL', null, 'TRIAL'],
    ];
    const ids: string[] = [];
    for (const [, endsAt, status] of cases) {
      const orgId = await createOrg(app, owner, 'quota-sql');
      ids.push(orgId);
      if (status) await sub(orgId, p.id, new Date(now.getTime() - 60 * DAY), endsAt, status);
    }
    const rows = await db.$queryRaw<{ id: string; effective_status: string }[]>`
      WITH cur AS (${currentSubscriptionsSql(now)})
      SELECT id, ${effectiveStatusSql(now)} AS effective_status FROM cur WHERE id IN (${Prisma.join(ids.map((i) => Prisma.sql`${i}::uuid`))})`;
    for (const [i, orgId] of ids.entries()) {
      const sqlStatus = rows.find((r) => r.id === orgId)?.effective_status;
      const ts = await getCurrentSubscription(db, orgId, now);
      expect(sqlStatus).toBe(ts.hasSubscription ? ts.effectiveStatus : 'NONE');
      expect(sqlStatus).toBe(cases[i]?.[0]);
    }
  });
});

describe('assertWritable — hết hạn chỉ cho đọc, không xoá dữ liệu', () => {
  it('quá ân hạn → 403 lời rõ ràng; trong ân hạn → được ghi; dữ liệu vẫn còn nguyên', async () => {
    const orgId = await createOrg(app, owner, 'quota-het');
    const p = await plan({ maxStaff: null });
    await sub(orgId, p.id, new Date(Date.now() - 60 * DAY), new Date(Date.now() - 2 * DAY));
    await assertWritable(db, orgId); // còn ân hạn
    await assertQuota(db, orgId, 'staff');
    // Tổ chức khác: thuê bao đã quá hạn hơn GRACE_DAYS.
    const o2 = await createOrg(app, owner, 'quota-het2');
    await sub(o2, p.id, new Date(Date.now() - 60 * DAY), new Date(Date.now() - (GRACE_DAYS + 1) * DAY));
    const err = await caught(assertWritable(db, o2));
    expect(err.status).toBe(403);
    expect(err.message).toBe(EXPIRED_MESSAGE);
    const viaQuota = await caught(db.$transaction((tx) => assertQuota(tx, o2, 'staff')));
    expect(viaQuota.status).toBe(403);
    // Không xoá gì: tổ chức, thành viên, thuê bao vẫn đủ.
    expect(await db.organization.count({ where: { id: o2 } })).toBe(1);
    expect(await db.membership.count({ where: { organizationId: o2 } })).toBe(1);
    expect(await db.organizationSubscription.count({ where: { organizationId: o2 } })).toBe(1);
  });

  it('gia hạn (thêm dòng mới) → ghi lại được', async () => {
    const orgId = await createOrg(app, owner, 'quota-giahan');
    const p = await plan();
    await sub(orgId, p.id, new Date(Date.now() - 60 * DAY), new Date(Date.now() - 30 * DAY));
    expect((await caught(assertWritable(db, orgId))).status).toBe(403);
    await sub(orgId, p.id, new Date(Date.now() - 1000), new Date(Date.now() + 30 * DAY));
    await assertWritable(db, orgId);
  });
});

describe('assertQuota', () => {
  it('vượt số nhân sự → 409 CONFLICT "Đã đạt giới hạn gói …"', async () => {
    const orgId = await createOrg(app, owner, 'quota-ns');
    const p = await plan({ maxStaff: 2 });
    await sub(orgId, p.id, new Date(Date.now() - DAY), null);
    await db.$transaction((tx) => assertQuota(tx, orgId, 'staff')); // chủ = 1, thêm 1 → 2: được
    await addMember(app, owner, orgId, await registerUser(app, 'quota-ns-tv'), ['artist']);
    expect(await getUsage(db, orgId, 'staff')).toBe(2);
    const err = await caught(db.$transaction((tx) => assertQuota(tx, orgId, 'staff')));
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toMatch(new RegExp(`^Đã đạt giới hạn gói ${p.name}: tối đa 2 nhân sự`));
    expect(err.details).toMatchObject({ kind: 'staff', limit: 2, used: 2, adding: 1 });
  });

  it('giới hạn null = không giới hạn', async () => {
    const orgId = await createOrg(app, owner, 'quota-null');
    const p = await plan({ maxStaff: null, maxStudents: null });
    await sub(orgId, p.id, new Date(Date.now() - DAY), null);
    await assertQuota(db, orgId, 'staff', 10_000);
    await assertQuota(db, orgId, 'students', 10_000);
  });

  it('dung lượng (MB lẻ) và số lịch trong tháng', async () => {
    const orgId = await createOrg(app, owner, 'quota-dl');
    const p = await plan({ maxStorageMb: 1, maxAppointmentsPerMonth: 1 });
    await sub(orgId, p.id, new Date(Date.now() - DAY), null);
    await db.storedFile.create({
      data: { organizationId: orgId, purpose: 'OTHER', storageKey: `k/${randomUUID()}`, originalName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 700n * 1024n, createdById: owner.id },
    });
    await assertQuota(db, orgId, 'storageMb', (300 * 1024) / (1024 * 1024));
    expect((await caught(assertQuota(db, orgId, 'storageMb', (400 * 1024) / (1024 * 1024)))).status).toBe(409);
    await assertQuota(db, orgId, 'appointmentsPerMonth');
    await db.appointment.create({
      data: { organizationId: orgId, code: `L-${randomUUID().slice(0, 6)}`, kind: 'MAKEUP', startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + DAY + 3600_000), status: 'DRAFT', createdById: owner.id },
    });
    expect(await getUsage(db, orgId, 'appointmentsPerMonth')).toBe(1);
    expect((await caught(assertQuota(db, orgId, 'appointmentsPerMonth'))).status).toBe(409);
  });

  // Trước gói M7 bài này khẳng định "chưa có bộ đếm → lỗi lắp ráp". Nay đã có bộ đếm (BAN-VE-C3 mục 1.0): khẳng định nó
  // ĐẾM THẬT (không âm thầm trả 0, không ném lỗi). Phủ đủ hơn ở test/han-muc-dao-tao.test.ts (API, đua 10 lượt).
  it('học viên / khoá học có giới hạn → đếm thật: khoá chưa lưu trữ, khách khác nhau có ghi danh ACTIVE', async () => {
    const orgId = await createOrg(app, owner, 'quota-hv');
    const p = await plan({ maxStudents: 1, maxCourses: 1 });
    await sub(orgId, p.id, new Date(Date.now() - DAY), null);
    await assertQuota(db, orgId, 'students');
    await assertQuota(db, orgId, 'courses');
    await db.course.create({
      data: { organizationId: orgId, code: `KH-${randomUUID().slice(0, 6)}`, name: 'Khoá Q', mode: 'MULTI_CLASS', tuitionFee: 1_000n, defaultCapacity: 5, createdById: owner.id },
    });
    expect(await getUsage(db, orgId, 'courses')).toBe(1);
    const err = await caught(assertQuota(db, orgId, 'courses'));
    expect(err.status).toBe(409);
    expect(err.details).toMatchObject({ reason: 'QUOTA_EXCEEDED', kind: 'courses', limit: 1, used: 1 });
    expect(await getUsage(db, orgId, 'students')).toBe(0);
    await assertQuota(db, orgId, 'students');
  });

  it('hai yêu cầu thêm cùng lúc khi còn 1 chỗ → chỉ một yêu cầu qua', async () => {
    const orgId = await createOrg(app, owner, 'quota-dua');
    const p = await plan({ maxStaff: 2 });
    await sub(orgId, p.id, new Date(Date.now() - DAY), null);
    const users = await Promise.all([registerUser(app, 'quota-dua1'), registerUser(app, 'quota-dua2')]);
    const results = await Promise.allSettled(
      users.map((u) =>
        db.$transaction(async (tx) => {
          await assertQuota(tx, orgId, 'staff');
          await new Promise((r) => setTimeout(r, 150));
          await tx.membership.create({ data: { organizationId: orgId, userId: u.id } });
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await getUsage(db, orgId, 'staff')).toBe(2);
  });

  it('chưa có thuê bao: không có gói "trial" → lỗi cấu hình rõ ràng; có gói "trial" → áp giới hạn của nó', async () => {
    const orgId = await createOrg(app, owner, 'quota-trial');
    await inRolledBackTx(async (tx) => {
      // Cất gói 'trial' (nếu có) đi trong transaction sẽ huỷ.
      await tx.subscriptionPlan.updateMany({ where: { code: 'trial' }, data: { code: `trial_cat_${randomUUID().slice(0, 6)}` } });
      const err = await caught(assertQuota(tx, orgId, 'staff'));
      expect(err.code).toBe('INTERNAL');
      // N10 (biên bản máy chủ lát 2): lời cho người dùng studio KHÔNG chứa lệnh vận hành; lệnh nằm ở operatorHint (log máy chủ).
      expect(err.message).toBe('Hệ thống chưa cấu hình gói dịch vụ cho tổ chức này. Vui lòng liên hệ bộ phận hỗ trợ.');
      expect(err.message).not.toMatch(/pnpm|seed|trial/);
      expect(JSON.stringify(err.details ?? null)).not.toMatch(/pnpm/);
      expect(err.operatorHint).toMatch(/pnpm --filter @makeup\/api platform:seed-plans -- --with-trial/);
      await assertWritable(tx, orgId); // chưa có thuê bao: không phải "hết hạn"
      await tx.subscriptionPlan.create({ data: { code: 'trial', name: 'Dùng thử', priceMonthly: 0n, features: [], maxStaff: 1, isActive: false } });
      const eff = await getEffectivePlan(tx, orgId);
      expect(eff.source).toBe('default');
      const full = await caught(assertQuota(tx, orgId, 'staff'));
      expect(full.status).toBe(409);
      expect(full.message).toMatch(/^Đã đạt giới hạn gói Dùng thử: tối đa 1 nhân sự/);
    });
  });
});

// GIỮ NGHĨA ba cách đếm "đang dùng bao nhiêu" (biên bản máy chủ lát 2, mục 4: đột biến Q1–Q3 làm bài thử cũ vẫn xanh).
describe('getUsage — giữ đúng định nghĩa từng cách đếm', () => {
  it('Q1 nhân sự: tính ACTIVE + SUSPENDED, KHÔNG tính người đã rời (REMOVED)', async () => {
    const orgId = await createOrg(app, owner, 'quota-q1');
    const a = await registerUser(app, 'quota-q1a');
    const b = await registerUser(app, 'quota-q1b');
    const c = await registerUser(app, 'quota-q1c');
    await addMember(app, owner, orgId, a, ['artist']);
    await addMember(app, owner, orgId, b, ['artist']);
    await addMember(app, owner, orgId, c, ['artist']);
    expect(await getUsage(db, orgId, 'staff')).toBe(4);
    await db.membership.updateMany({ where: { organizationId: orgId, userId: b.id }, data: { status: 'SUSPENDED' } });
    await db.membership.updateMany({ where: { organizationId: orgId, userId: c.id }, data: { status: 'REMOVED' } });
    const used = await getUsage(db, orgId, 'staff');
    console.log(`[Q1] chủ + 1 đang làm + 1 tạm khoá + 1 đã rời → đếm ${used} (đúng 3)`);
    expect(used).toBe(3);
    // Hệ quả lên hạn mức: gói 3 người, người đã rời không giữ chỗ → còn 0 chỗ; gói 4 người → còn 1 chỗ.
    const p3 = await plan({ maxStaff: 4 });
    await sub(orgId, p3.id, new Date(Date.now() - DAY), null);
    await db.$transaction((tx) => assertQuota(tx, orgId, 'staff'));
  });

  it('Q2 dung lượng: tính tệp UPLOADING + READY, KHÔNG tính tệp đã xoá (DELETED)', async () => {
    const orgId = await createOrg(app, owner, 'quota-q2');
    const mk = (status: 'UPLOADING' | 'READY' | 'DELETED', mb: number) =>
      db.storedFile.create({
        data: {
          organizationId: orgId,
          purpose: 'OTHER',
          storageKey: `k/${randomUUID()}`,
          originalName: 'a.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: BigInt(mb * 1024 * 1024),
          status,
          ...(status === 'DELETED' ? { deletedAt: new Date() } : {}),
          createdById: owner.id,
        },
      });
    await mk('READY', 2);
    await mk('UPLOADING', 1);
    await mk('DELETED', 5);
    const used = await getUsage(db, orgId, 'storageMb');
    console.log(`[Q2] READY 2 MB + UPLOADING 1 MB + DELETED 5 MB → đếm ${used} MB (đúng 3)`);
    expect(used).toBe(3);
  });

  it('Q3 lịch trong tháng: đầu tháng tính theo MÚI GIỜ TỔ CHỨC — lịch tạo 23:50 ngày 31/10 giờ VN thuộc tháng 10, 00:10 ngày 1/11 thuộc tháng 11', async () => {
    const orgId = await createOrg(app, owner, 'quota-q3');
    await db.organization.update({ where: { id: orgId }, data: { timezone: 'Asia/Ho_Chi_Minh' } });
    const appt = (createdAt: Date) =>
      db.appointment.create({
        data: {
          organizationId: orgId,
          code: `L-${randomUUID().slice(0, 6)}`,
          kind: 'MAKEUP',
          startsAt: new Date('2026-12-01T01:00:00Z'),
          endsAt: new Date('2026-12-01T02:00:00Z'),
          status: 'DRAFT',
          createdById: owner.id,
          createdAt,
        },
      });
    await appt(new Date('2026-10-31T16:50:00Z')); // 23:50 ngày 31/10 giờ VN → tháng 10
    await appt(new Date('2026-10-31T17:10:00Z')); // 00:10 ngày 1/11 giờ VN → tháng 11
    const nov = await getUsage(db, orgId, 'appointmentsPerMonth', new Date('2026-10-31T17:30:00Z')); // 00:30 ngày 1/11 giờ VN
    const endNov = await getUsage(db, orgId, 'appointmentsPerMonth', new Date('2026-11-30T16:59:00Z')); // 23:59 ngày 30/11 giờ VN
    console.log(`[Q3] lúc 00:30 1/11 (VN) đếm ${nov} (đúng 1); lúc 23:59 30/11 (VN) đếm ${endNov} (đúng 1)`);
    expect(nov).toBe(1);
    expect(endNov).toBe(1);
  });
});
