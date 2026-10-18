// HẠN MỨC ĐÀO TẠO (gói M7) — BAN-VE-C3-DAO-TAO mục 1.0: bộ đếm của getUsage/assertQuota (lib/quota.ts)
//  - courses  = số khoá học chưa lưu trữ (archived_at IS NULL) của tổ chức;
//  - students = số KHÁCH KHÁC NHAU đang có ghi danh ACTIVE trong tổ chức.
// Lời gọi assertQuota('courses') (modules/courses, lúc tạo khoá) và assertQuota('students') (modules/contracts/enroll.ts,
// lúc xác nhận hợp đồng khoá học có học viên mới) là của thợ khác — ở đây thử qua đúng đường API thật.
// Bài đua: 10 lượt, mỗi lượt 2 yêu cầu đồng thời vào chỗ cuối; đếm riêng thắng / 409 hạn mức / lỗi khác (sổ lỗi 18).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getUsage } from '../src/lib/quota';
import { bearer, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

afterAll(async () => {
  await db.$disconnect();
});

beforeAll(() => {
  app = makeApp(deps);
});

const idem = () => `hm-${randomUUID()}`;
const url = (orgId: string, rest: string) => `/api/v1/orgs/${orgId}${rest}`;

interface Academy {
  orgId: string;
  owner: TestUser;
  planName: string;
}

async function academy(label: string, limits: { maxCourses?: number | null; maxStudents?: number | null }): Promise<Academy> {
  const owner = await registerUser(app, `hm-${label}`);
  const res = await request(app)
    .post('/api/v1/orgs')
    .set(bearer(owner))
    .send({ name: `Học viện ${label}`, slug: `hm-${label}-${randomUUID().slice(0, 8)}`, kind: 'ACADEMY' })
    .expect(201);
  const orgId = res.body.id as string;
  const planName = `Gói HM ${randomUUID().slice(0, 4)}`;
  const plan = await db.subscriptionPlan.create({
    data: { code: `hm_${randomUUID().slice(0, 8)}`, name: planName, priceMonthly: 0n, features: [], ...limits },
  });
  await db.organizationSubscription.create({
    data: { organizationId: orgId, planId: plan.id, startsAt: new Date(Date.now() - 60_000), endsAt: null, status: 'ACTIVE' },
  });
  return { orgId, owner, planName };
}

function postCourse(a: Academy, name = `Khoá ${randomUUID().slice(0, 6)}`) {
  return request(app)
    .post(url(a.orgId, '/courses'))
    .set(bearer(a.owner))
    .set('idempotency-key', idem())
    .send({ name, mode: 'MULTI_CLASS', tuitionFee: 5_000_000, defaultCapacity: 10 });
}

// Khoá / lớp / khách ghi thẳng database (đề bài cho phép) — để bài hạn mức học viên không phụ thuộc giới hạn khoá.
async function dbCourse(a: Academy, archived = false) {
  return db.course.create({
    data: {
      organizationId: a.orgId,
      code: `KH-${randomUUID().slice(0, 6)}`,
      name: `Khoá ${randomUUID().slice(0, 6)}`,
      mode: 'MULTI_CLASS',
      tuitionFee: 4_000_000n,
      defaultCapacity: 10,
      archivedAt: archived ? new Date() : null,
      createdById: a.owner.id,
    },
  });
}

async function dbClass(a: Academy, courseId: string, capacity = 10) {
  return db.courseClass.create({
    data: {
      organizationId: a.orgId,
      courseId,
      name: `Lớp ${randomUUID().slice(0, 6)}`,
      startDate: new Date('2027-02-01'),
      endDate: new Date('2027-04-01'),
      weekdays: [2, 4],
      capacity,
      createdById: a.owner.id,
    },
  });
}

async function dbCustomer(a: Academy, name: string) {
  return (await db.customer.create({ data: { organizationId: a.orgId, fullName: name } })).id;
}

async function draftCourseContract(a: Academy, customerId: string, classId: string) {
  const res = await request(app)
    .post(url(a.orgId, '/contracts'))
    .set(bearer(a.owner))
    .set('idempotency-key', idem())
    .send({ kind: 'COURSE', customerId, lines: [{ kind: 'COURSE', courseClassId: classId }] });
  if (res.status !== 201) throw new Error(`Tạo hợp đồng khoá học thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as { id: string; code: string };
}

function confirm(a: Academy, contractId: string) {
  return request(app).post(url(a.orgId, `/contracts/${contractId}/status`)).set(bearer(a.owner)).send({ to: 'CONFIRMED' });
}

type Outcome = 'win' | 'quota' | 'other';
function outcome(res: { status: number; body: { error?: { details?: { reason?: string; kind?: string } } } }, kind: string, okStatus: number): Outcome {
  if (res.status === okStatus) return 'win';
  if (res.status === 409 && res.body.error?.details?.reason === 'QUOTA_EXCEEDED' && res.body.error.details.kind === kind) return 'quota';
  return 'other';
}

describe('bộ đếm courses / students (getUsage)', () => {
  it('courses = khoá chưa lưu trữ của CHÍNH tổ chức; students = khách khác nhau có ghi danh ACTIVE', async () => {
    const A = await academy('dem-a', {});
    const B = await academy('dem-b', {});
    expect(await getUsage(db, A.orgId, 'courses')).toBe(0);
    expect(await getUsage(db, A.orgId, 'students')).toBe(0);
    const k1 = await dbCourse(A);
    const k2 = await dbCourse(A);
    await dbCourse(A, true); // đã lưu trữ — không tính
    await dbCourse(B); // tổ chức khác — không tính
    const [l1, l2, l3] = [await dbClass(A, k1.id), await dbClass(A, k1.id), await dbClass(A, k2.id)];
    const lB = await dbClass(B, (await dbCourse(B)).id);
    expect(await getUsage(db, A.orgId, 'courses')).toBe(2);
    expect(await getUsage(db, B.orgId, 'courses')).toBe(2);

    // Khách 1 học 2 lớp (đếm 1), khách 2 ghi danh rồi huỷ (không đếm), khách 3 một lớp (đếm 1).
    const [s1, s2, s3] = [await dbCustomer(A, 'HV 1'), await dbCustomer(A, 'HV 2'), await dbCustomer(A, 'HV 3')];
    for (const [s, l] of [[s1, l1], [s1, l3], [s2, l2], [s3, l2]] as const) {
      const c = await draftCourseContract(A, s, l.id);
      await confirm(A, c.id).expect(200);
    }
    const sB = await dbCustomer(B, 'HV B');
    await confirm(B, (await draftCourseContract(B, sB, lB.id)).id).expect(200);
    expect(await getUsage(db, A.orgId, 'students')).toBe(3);
    const s2Contract = await db.enrollment.findFirstOrThrow({ where: { organizationId: A.orgId, customerId: s2 }, select: { contractId: true } });
    await request(app)
      .post(url(A.orgId, `/contracts/${s2Contract.contractId}/status`))
      .set(bearer(A.owner))
      .send({ to: 'CANCELLED', reason: 'Học viên xin rút' })
      .expect(200);
    const counted = await getUsage(db, A.orgId, 'students');
    const activeRows = await db.enrollment.count({ where: { organizationId: A.orgId, status: 'ACTIVE' } });
    console.log(`[hạn mức] học viện A: khoá chưa lưu trữ ${await getUsage(db, A.orgId, 'courses')}/3 khoá; học viên ${counted} (ghi danh ACTIVE ${activeRows} dòng); học viện B: học viên ${await getUsage(db, B.orgId, 'students')}`);
    expect(activeRows).toBe(3); // s1×2 + s3
    expect(counted).toBe(2); // s1, s3 — khác nhau
    expect(await getUsage(db, B.orgId, 'students')).toBe(1);
  });
});

describe('giới hạn khoá học (maxCourses) qua POST /courses', () => {
  it('gói maxCourses = 1: khoá thứ 2 → 409 lời rõ; lưu trữ khoá cũ thì mở được khoá mới', async () => {
    const A = await academy('kh1', { maxCourses: 1 });
    const first = await postCourse(A, 'Khoá cơ bản');
    expect(first.status).toBe(201);
    const second = await postCourse(A, 'Khoá nâng cao');
    console.log(`[hạn mức khoá] khoá thứ 2 → ${second.status} ${second.body.error?.message}`);
    expect(second.status).toBe(409);
    expect(second.body.error.message).toBe(`Đã đạt giới hạn gói ${A.planName}: tối đa 1 khoá học (đang dùng 1). Nâng gói để thêm.`);
    expect(second.body.error.details).toMatchObject({ reason: 'QUOTA_EXCEEDED', kind: 'courses', limit: 1, used: 1, adding: 1 });
    expect(await db.course.count({ where: { organizationId: A.orgId } })).toBe(1);
    await request(app)
      .post(url(A.orgId, `/courses/${first.body.course.id}/archive`))
      .set(bearer(A.owner))
      .send({ reason: 'Ngừng mở' })
      .expect(200);
    expect((await postCourse(A, 'Khoá nâng cao')).status).toBe(201);
  });

  it('đua 10 lượt: 2 yêu cầu tạo khoá đồng thời khi còn 1 chỗ → đúng 1 qua mỗi lượt, 0 lỗi khác', async () => {
    const tally = { win: 0, quota: 0, other: 0 };
    let exact = 0;
    for (let round = 0; round < 10; round++) {
      const A = await academy(`dua-kh-${round}`, { maxCourses: 2 });
      expect((await postCourse(A)).status).toBe(201);
      const res = await Promise.all([postCourse(A), postCourse(A)]);
      const outs = res.map((r) => outcome(r, 'courses', 201));
      for (const o of outs) tally[o] += 1;
      const n = await db.course.count({ where: { organizationId: A.orgId, archivedAt: null } });
      if (outs.filter((o) => o === 'win').length === 1 && n === 2) exact += 1;
      else console.log(`[đua khoá] lượt ${round}: ${res.map((r) => `${r.status} ${JSON.stringify(r.body.error ?? '')}`).join(' | ')}; số khoá ${n}`);
    }
    console.log(`[đua khoá] đúng 1 thắng: ${exact}/10; thắng ${tally.win}, 409 hạn mức ${tally.quota}, lỗi khác ${tally.other}`);
    expect(tally).toEqual({ win: 10, quota: 10, other: 0 });
    expect(exact).toBe(10);
  });
});

describe('giới hạn học viên (maxStudents) lúc xác nhận hợp đồng khoá học', () => {
  it('gói maxStudents = 1: học viên thứ 2 → 409, không giữ chỗ, không ghi danh; học viên cũ học thêm lớp vẫn được', async () => {
    const A = await academy('hv1', { maxStudents: 1 });
    const k = await dbCourse(A);
    const [l1, l2] = [await dbClass(A, k.id), await dbClass(A, k.id)];
    const s1 = await dbCustomer(A, 'Học viên một');
    const s2 = await dbCustomer(A, 'Học viên hai');
    await confirm(A, (await draftCourseContract(A, s1, l1.id)).id).expect(200);
    const c2 = await draftCourseContract(A, s2, l1.id);
    const over = await confirm(A, c2.id);
    console.log(`[hạn mức học viên] học viên thứ 2 → ${over.status} ${over.body.error?.message}`);
    expect(over.status).toBe(409);
    expect(over.body.error.message).toBe(`Đã đạt giới hạn gói ${A.planName}: tối đa 1 học viên (đang dùng 2). Nâng gói để thêm.`);
    expect(over.body.error.details).toMatchObject({ reason: 'QUOTA_EXCEEDED', kind: 'students', limit: 1 });
    const cls = await db.courseClass.findUniqueOrThrow({ where: { id: l1.id }, select: { enrolledCount: true } });
    expect(cls.enrolledCount).toBe(1);
    expect(await db.enrollment.count({ where: { organizationId: A.orgId, customerId: s2 } })).toBe(0);
    expect((await db.contract.findUniqueOrThrow({ where: { id: c2.id }, select: { status: true } })).status).toBe('DRAFT');
    // Học viên đã có không tốn thêm chỗ.
    await confirm(A, (await draftCourseContract(A, s1, l2.id)).id).expect(200);
    expect(await getUsage(db, A.orgId, 'students')).toBe(1);
  });

  it('đua 10 lượt: 2 học viên mới xác nhận đồng thời (khác lớp, khác khoá) khi còn 1 chỗ → đúng 1 qua, 0 lỗi khác', async () => {
    const tally = { win: 0, quota: 0, other: 0 };
    let exact = 0;
    for (let round = 0; round < 10; round++) {
      const A = await academy(`dua-hv-${round}`, { maxStudents: 1 });
      // Khác lớp, khác khoá: không có khoá dòng lớp chung — chỉ còn khoá hạn mức xếp hàng hai yêu cầu.
      const [ka, kb] = [await dbCourse(A), await dbCourse(A)];
      const [la, lb] = [await dbClass(A, ka.id), await dbClass(A, kb.id)];
      const ca = await draftCourseContract(A, await dbCustomer(A, `HV A${round}`), la.id);
      const cb = await draftCourseContract(A, await dbCustomer(A, `HV B${round}`), lb.id);
      const res = await Promise.all([confirm(A, ca.id), confirm(A, cb.id)]);
      const outs = res.map((r) => outcome(r, 'students', 200));
      for (const o of outs) tally[o] += 1;
      const n = await getUsage(db, A.orgId, 'students');
      if (outs.filter((o) => o === 'win').length === 1 && n === 1) exact += 1;
      else console.log(`[đua học viên] lượt ${round}: ${res.map((r) => `${r.status} ${JSON.stringify(r.body.error ?? '')}`).join(' | ')}; học viên ${n}`);
    }
    console.log(`[đua học viên] đúng 1 thắng: ${exact}/10; thắng ${tally.win}, 409 hạn mức ${tally.quota}, lỗi khác ${tally.other}`);
    expect(tally).toEqual({ win: 10, quota: 10, other: 0 });
    expect(exact).toBe(10);
  });
});
