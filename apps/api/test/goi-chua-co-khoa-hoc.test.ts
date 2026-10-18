// T2 (biên bản nghiệm thu cuối) — quyết định điều phối 01:40: GIỮ NGUYÊN số của gói (việc thương mại của chủ), chỉ sửa
// LỜI BÁO và MÃ LỖI.
//  (a) Hết giới hạn gói (kể cả gói có 0 khoá học như "Dùng thử"): 409 CONFLICT như mọi lỗi giới hạn gói của dự án,
//      lời tiếng Việt nói rõ "gói hiện tại chưa có khoá học — liên hệ để nâng gói"; details có tên giới hạn, đang dùng / tối đa.
//  (b) Hệ thống chưa cấu hình gói (tổ chức chưa có thuê bao, database chưa có gói mặc định 'trial'): KHÔNG còn 500 chung
//      chung. Lỗi có tên riêng PlanNotConfiguredError, mã NOT_CONFIGURED, HTTP 503 (dịch vụ chưa sẵn sàng vì cấu hình máy
//      chủ — không phải lỗi người dùng, không phải lỗi lập trình), log mức error cho người vận hành kèm lệnh sửa.
// Thử qua đường API thật ở CẢ HAI chỗ gọi assertQuota: tạo khoá (courses/service.ts) và xác nhận hợp đồng khoá học có học
// viên mới (contracts/enroll.ts).
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import type { Logger } from '../src/lib/logger';
import { TRIAL_PLAN } from '../src/scripts/seed-plans';
import { bearer, createAcademyOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;
let owner: TestUser;

afterAll(async () => {
  await db.$disconnect();
});

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 't2-chu');
});

const idem = () => `t2-${randomUUID()}`;
const postCourse = (a: App, orgId: string) =>
  request(a)
    .post(`/api/v1/orgs/${orgId}/courses`)
    .set(bearer(owner))
    .set('idempotency-key', idem())
    .send({ name: `Khoá ${randomUUID().slice(0, 6)}`, mode: 'MULTI_CLASS', tuitionFee: 5_000_000, defaultCapacity: 10 });

async function subscribe(orgId: string, limits: { maxCourses?: number | null; maxStudents?: number | null }, name = `Gói T2 ${randomUUID().slice(0, 4)}`) {
  const plan = await db.subscriptionPlan.create({ data: { code: `t2_${randomUUID().slice(0, 8)}`, name, priceMonthly: 0n, features: [], ...limits } });
  await db.organizationSubscription.create({ data: { organizationId: orgId, planId: plan.id, startsAt: new Date(Date.now() - 60_000), endsAt: null, status: 'ACTIVE' } });
  return plan;
}

// Gói 'trial' là trạng thái TOÀN CỤC của database: cất đi (đổi mã) trong lúc thử rồi trả lại đúng như cũ.
// Các tệp bài thử chạy tuần tự (vitest.config.ts fileParallelism: false) nên không đụng bài khác.
async function withTrial(state: 'missing' | 'seeded', fn: () => Promise<void>) {
  const stash = `trial_cat_${randomUUID().slice(0, 6)}`;
  const had = await db.subscriptionPlan.updateMany({ where: { code: 'trial' }, data: { code: stash } });
  try {
    if (state === 'seeded') {
      const { code, name, maxStaff, maxAppointmentsPerMonth, maxStorageMb, maxStudents, maxCourses, isActive } = TRIAL_PLAN;
      await db.subscriptionPlan.create({
        data: { code, name, maxStaff, maxAppointmentsPerMonth, maxStorageMb, maxStudents, maxCourses, isActive, priceMonthly: 0n, features: [] },
      });
    }
    await fn();
  } finally {
    await db.subscriptionPlan.deleteMany({ where: { code: 'trial' } });
    if (had.count > 0) await db.subscriptionPlan.updateMany({ where: { code: stash }, data: { code: 'trial' } });
  }
}

async function courseContract(orgId: string) {
  const course = await db.course.create({
    data: { organizationId: orgId, code: `KH-${randomUUID().slice(0, 6)}`, name: 'Khoá nền', mode: 'MULTI_CLASS', tuitionFee: 2_000_000n, defaultCapacity: 5, createdById: owner.id },
  });
  const cls = await db.courseClass.create({
    data: { organizationId: orgId, courseId: course.id, name: 'K1', startDate: new Date('2027-02-01'), endDate: new Date('2027-03-01'), weekdays: [2], capacity: 5, createdById: owner.id },
  });
  const customerId = (await db.customer.create({ data: { organizationId: orgId, fullName: 'Học viên T2' } })).id;
  const c = await request(app)
    .post(`/api/v1/orgs/${orgId}/contracts`)
    .set(bearer(owner))
    .set('idempotency-key', idem())
    .send({ kind: 'COURSE', customerId, lines: [{ kind: 'COURSE', courseClassId: cls.id }] })
    .expect(201);
  return c.body.id as string;
}
const confirm = (a: App, orgId: string, id: string) => request(a).post(`/api/v1/orgs/${orgId}/contracts/${id}/status`).set(bearer(owner)).send({ to: 'CONFIRMED' });

describe('T2 (a) — BẮT: gói không có / hết khoá học, học viên → 409 lời rõ, details đủ', () => {
  it('gói có 0 khoá học (thuê bao thật) → 409 "Gói … của tổ chức chưa có khoá học — liên hệ để nâng gói", không tạo khoá', async () => {
    const orgId = await createAcademyOrg(app, owner, 't2-goi0');
    const plan = await subscribe(orgId, { maxCourses: 0 }, 'Cơ bản');
    const r = await postCourse(app, orgId);
    console.log(`[T2 gói 0 khoá] lưu khoá → ${r.status} ${r.body.error?.message}`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CONFLICT');
    expect(r.body.error.message).toBe('Gói Cơ bản của tổ chức chưa có khoá học — liên hệ để nâng gói.');
    expect(r.body.error.details).toEqual({
      reason: 'QUOTA_EXCEEDED',
      kind: 'courses',
      limitName: 'khoá học',
      planCode: plan.code,
      planName: 'Cơ bản',
      limit: 0,
      used: 0,
      adding: 1,
    });
    expect(await db.course.count({ where: { organizationId: orgId } })).toBe(0);
  });

  it('chưa có thuê bao + database đã nạp gói "Dùng thử" (seed-plans --with-trial, maxCourses 0 giữ nguyên) → cùng lời rõ, 409', async () => {
    const orgId = await createAcademyOrg(app, owner, 't2-trial');
    await withTrial('seeded', async () => {
      const r = await postCourse(app, orgId);
      console.log(`[T2 gói Dùng thử] lưu khoá → ${r.status} ${r.body.error?.message} ⇒ ${/chưa có khoá học — liên hệ/.test(r.body.error?.message ?? '') ? 'ĐÃ HẾT' : 'LỖI CÒN'}`);
      expect([r.status, r.body.error.code, r.body.error.message]).toEqual([409, 'CONFLICT', 'Gói Dùng thử của tổ chức chưa có khoá học — liên hệ để nâng gói.']);
      expect(r.body.error.details).toMatchObject({ reason: 'QUOTA_EXCEEDED', kind: 'courses', planCode: 'trial', limit: 0, used: 0 });
      expect(TRIAL_PLAN.maxCourses).toBe(0); // số của gói không đổi (quyết định 01:40)
    });
  });

  it('chỗ gọi thứ hai — xác nhận hợp đồng khoá học, gói 0 học viên → 409 "chưa có học viên", hợp đồng vẫn nháp', async () => {
    const orgId = await createAcademyOrg(app, owner, 't2-hv0');
    await subscribe(orgId, { maxCourses: null, maxStudents: 0 }, 'Cơ bản');
    const id = await courseContract(orgId);
    const r = await confirm(app, orgId, id);
    expect([r.status, r.body.error.message]).toEqual([409, 'Gói Cơ bản của tổ chức chưa có học viên — liên hệ để nâng gói.']);
    expect(r.body.error.details).toMatchObject({ reason: 'QUOTA_EXCEEDED', kind: 'students', limitName: 'học viên', limit: 0, used: 1, adding: 0 });
    expect((await db.contract.findUniqueOrThrow({ where: { id } })).status).toBe('DRAFT');
  });
});

describe('T2 (b) — BẮT: hệ thống chưa cấu hình gói → 503 NOT_CONFIGURED, có log cho người vận hành', () => {
  it('chưa có thuê bao, chưa có gói "trial": lưu khoá → 503, lời người dùng rõ và không lộ lệnh; log error kèm lệnh sửa', async () => {
    const logs: { level: number; msg: string; code?: string; errorName?: string; operatorHint?: string; details?: unknown }[] = [];
    const logger = pino({ level: 'warn' }, { write: (s: string) => void logs.push(JSON.parse(s)) }) as unknown as Logger;
    const logged = createApp({ ...deps, logger });
    const orgId = await createAcademyOrg(app, owner, 't2-chuacauhinh');
    await withTrial('missing', async () => {
      const r = await postCourse(logged, orgId);
      console.log(`[T2 chưa cấu hình gói] lưu khoá → ${r.status} ${r.body.error?.code} ${r.body.error?.message} ⇒ ${r.status === 500 ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe('NOT_CONFIGURED');
      expect(r.body.error.message).toBe(
        'Tổ chức chưa được gán gói dịch vụ nên tạm thời chưa thêm mới được. Sự cố đã được ghi lại cho bộ phận vận hành — vui lòng liên hệ hỗ trợ.',
      );
      expect(r.body.error.details).toEqual({ reason: 'DEFAULT_PLAN_MISSING' });
      expect(JSON.stringify(r.body)).not.toMatch(/pnpm|seed|trial/);
      expect(await db.course.count({ where: { organizationId: orgId } })).toBe(0);
      const entry = logs.find((l) => l.level === 50 && l.code === 'NOT_CONFIGURED');
      expect(entry).toBeDefined();
      expect(entry!.errorName).toBe('PlanNotConfiguredError');
      expect(entry!.operatorHint).toContain(orgId);
      expect(entry!.operatorHint).toMatch(/pnpm --filter @makeup\/api platform:seed-plans -- --with-trial/);
      // Chỗ gọi thứ hai (xác nhận hợp đồng khoá học có học viên mới) cũng 503, hợp đồng vẫn nháp.
      const id = await courseContract(orgId);
      const c = await confirm(logged, orgId, id);
      expect([c.status, c.body.error.code, c.body.error.details?.reason]).toEqual([503, 'NOT_CONFIGURED', 'DEFAULT_PLAN_MISSING']);
      expect((await db.contract.findUniqueOrThrow({ where: { id } })).status).toBe('DRAFT');
    });
  });
});

describe('T2 — GIỮ', () => {
  it('gói còn chỗ → tạo được; giới hạn null = không giới hạn', async () => {
    const orgId = await createAcademyOrg(app, owner, 't2-con-cho');
    await subscribe(orgId, { maxCourses: 1 });
    expect((await postCourse(app, orgId)).status).toBe(201);
    const free = await createAcademyOrg(app, owner, 't2-khong-gh');
    await subscribe(free, { maxCourses: null });
    for (let i = 0; i < 3; i++) expect((await postCourse(app, free)).status).toBe(201);
  });
});
