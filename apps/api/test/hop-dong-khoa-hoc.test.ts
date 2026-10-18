// HỢP ĐỒNG KHOÁ HỌC (gói M4) + MẪU ĐIỀU KHOẢN / NỘI QUY (gói M5) — BAN-VE-C3-DAO-TAO mục 1.1, 1.2, 1.3.
// Khoá / lớp tạo thẳng bằng prisma (đường API khoá học do thợ S2 làm song song — KY-DUYET-C3 điều chỉnh 2).
// Tổ chức thử dùng gói KHÔNG GIỚI HẠN để assertQuota('students') không phụ thuộc bộ đếm của thợ M7.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getUsage } from '../src/lib/quota';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

afterAll(async () => {
  await db.$disconnect();
});

const idem = () => `k-${randomUUID()}`;

interface Academy {
  orgId: string;
  owner: TestUser;
}

async function academy(label: string, maxStudents: number | null = null): Promise<Academy> {
  const owner = await registerUser(app, `hdkh-chu-${label}`);
  const res = await request(app)
    .post('/api/v1/orgs')
    .set(bearer(owner))
    .send({ name: `Học viện ${label}`, slug: `hdkh-${label}-${randomUUID().slice(0, 8)}`, kind: 'ACADEMY' })
    .expect(201);
  const orgId = res.body.id as string;
  const plan = await db.subscriptionPlan.create({
    data: { code: `hdkh_${randomUUID().slice(0, 8)}`, name: `Gói HĐKH ${label}`, priceMonthly: 0n, features: [], maxStudents },
  });
  await db.organizationSubscription.create({
    data: { organizationId: orgId, planId: plan.id, startsAt: new Date(Date.now() - 60_000), endsAt: null, status: 'ACTIVE' },
  });
  return { orgId, owner };
}

async function course(a: Academy, data: { name: string; mode?: 'SINGLE_CLASS' | 'MULTI_CLASS'; fee?: bigint; deposit?: bigint }) {
  return db.course.create({
    data: {
      organizationId: a.orgId,
      code: `KH-${randomUUID().slice(0, 6)}`,
      name: data.name,
      mode: data.mode ?? 'MULTI_CLASS',
      tuitionFee: data.fee ?? 8_000_000n,
      depositAmount: data.deposit ?? 2_000_000n,
      defaultCapacity: 10,
      createdById: a.owner.id,
    },
  });
}

async function klass(a: Academy, courseId: string, name: string, capacity: number, status: 'OPEN' | 'CLOSED' = 'OPEN') {
  return db.courseClass.create({
    data: {
      organizationId: a.orgId,
      courseId,
      name,
      startDate: new Date('2027-01-05'),
      endDate: new Date('2027-03-05'),
      weekdays: [2, 4, 6],
      capacity,
      status,
      createdById: a.owner.id,
    },
  });
}

async function customer(a: Academy, name: string) {
  return (await db.customer.create({ data: { organizationId: a.orgId, fullName: name } })).id;
}

const cUrl = (orgId: string, rest = '') => `/api/v1/orgs/${orgId}/contracts${rest}`;
const tUrl = (orgId: string, rest = '') => `/api/v1/orgs/${orgId}/contract-texts${rest}`;

function createContract(u: TestUser, orgId: string, body: object) {
  return request(app).post(cUrl(orgId)).set(bearer(u)).set('idempotency-key', idem()).send(body);
}
function courseContract(a: Academy, customerId: string, classIds: string[], extra: object = {}) {
  return createContract(a.owner, a.orgId, { kind: 'COURSE', customerId, lines: classIds.map((courseClassId) => ({ kind: 'COURSE', courseClassId })), ...extra });
}
function setStatus(u: TestUser, orgId: string, id: string, to: string, reason?: string) {
  return request(app)
    .post(cUrl(orgId, `/${id}/status`))
    .set(bearer(u))
    .send({ to, ...(reason ? { reason } : {}) });
}
async function enrolled(classId: string) {
  return (await db.courseClass.findUniqueOrThrow({ where: { id: classId }, select: { enrolledCount: true } })).enrolledCount;
}
async function activeEnrollments(classId: string) {
  return db.enrollment.count({ where: { courseClassId: classId, status: 'ACTIVE' } });
}

let A: Academy;
let nail: Awaited<ReturnType<typeof course>>;
let single: Awaited<ReturnType<typeof course>>;

beforeAll(async () => {
  app = makeApp(deps);
  A = await academy('a');
  nail = await course(A, { name: 'Makeup nâng cao' });
  single = await course(A, { name: 'Trang điểm cá nhân', mode: 'SINGLE_CLASS', fee: 3_000_000n, deposit: 500_000n });
});

describe('lập hợp đồng khoá học', () => {
  it('kind COURSE: mã HĐKH-, dòng = tên khoá · tên lớp, học phí lúc thêm, số lượng 1, cọc gợi ý = cọc khoá; nháp KHÔNG giữ chỗ', async () => {
    const k1 = await klass(A, nail.id, 'K1', 8);
    const one = await klass(A, single.id, 'Trang điểm cá nhân', 5);
    const cust = await customer(A, 'Học viên Một');
    const c = (await courseContract(A, cust, [k1.id, one.id], { ownerMembershipId: undefined }).expect(201)).body;
    expect(c.code).toMatch(/^HĐKH-\d{6}$/);
    expect(c.kind).toBe('COURSE');
    expect(c.lines.map((l: { kind: string; name: string; unitPrice: number; quantity: number; courseClassId: string }) => [l.kind, l.name, l.unitPrice, l.quantity, l.courseClassId])).toEqual([
      ['COURSE', 'Makeup nâng cao · K1', 8_000_000, 1, k1.id],
      // Khoá Một lớp: tên lớp tự đặt bằng tên khoá, người dùng không thấy → chỉ tên khoá.
      ['COURSE', 'Trang điểm cá nhân', 3_000_000, 1, one.id],
    ]);
    expect(c.total).toBe(11_000_000);
    expect(c.depositRequired).toBe(2_500_000);
    expect(await enrolled(k1.id)).toBe(0);
    // Đổi học phí sau đó không đổi hợp đồng đã lập (dòng chép đơn giá lúc thêm).
    await db.course.update({ where: { id: nail.id }, data: { tuitionFee: 9_000_000n } });
    const again = (await request(app).get(cUrl(A.orgId, `/${c.id}`)).set(bearer(A.owner)).expect(200)).body;
    expect(again.lines[0].unitPrice).toBe(8_000_000);
    await db.course.update({ where: { id: nail.id }, data: { tuitionFee: 8_000_000n } });
    // Hai mã bộ đếm riêng: hợp đồng dịch vụ vẫn HD-.
    const svc = (await createContract(A.owner, A.orgId, { customerId: cust, lines: [{ kind: 'CUSTOM', name: 'Phí', unitPrice: 1000, quantity: 1 }] }).expect(201)).body;
    expect([svc.code.slice(0, 3), svc.kind]).toEqual(['HD-', 'SERVICE']);
  });

  it('người phụ trách: thành viên đang hoạt động; tổ chức khác = mã bịa (404 cùng lời); tạm khoá → 400', async () => {
    const k = await klass(A, nail.id, `PT-${randomUUID().slice(0, 4)}`, 5);
    const cust = await customer(A, 'Học viên PT');
    const staff = await registerUser(app, 'hdkh-tu-van');
    const m = await addMember(app, A.owner, A.orgId, staff, ['receptionist']);
    const ok = (await courseContract(A, cust, [k.id], { ownerMembershipId: m }).expect(201)).body;
    expect(ok.ownerMembershipId).toBe(m);
    const B = await academy(`pt-${randomUUID().slice(0, 4)}`);
    const bMember = await db.membership.findFirstOrThrow({ where: { organizationId: B.orgId } });
    const cross = await courseContract(A, cust, [k.id], { ownerMembershipId: bMember.id });
    const fake = await courseContract(A, cust, [k.id], { ownerMembershipId: randomUUID() });
    expect([cross.status, cross.body.error.message]).toEqual([404, fake.body.error.message]);
    await db.membership.update({ where: { id: m }, data: { status: 'SUSPENDED' } });
    const off = await courseContract(A, cust, [k.id], { ownerMembershipId: m });
    expect([off.status, off.body.error.message]).toEqual([400, 'Người phụ trách không còn hoạt động trong tổ chức']);
  });

  it('LUẬT TRỘN DÒNG: hợp đồng khoá học chỉ nhận COURSE + CUSTOM; hợp đồng dịch vụ không nhận COURSE (tạo, xem trước, thêm dòng, sửa nháp)', async () => {
    const k = await klass(A, nail.id, `TD-${randomUUID().slice(0, 4)}`, 5);
    const cust = await customer(A, 'Học viên trộn');
    const svc = await db.service.create({ data: { organizationId: A.orgId, code: `DV${randomUUID().slice(0, 4)}`, name: 'Makeup tiệc', kind: 'MAIN', durationMinutes: 60 } });
    // COURSE + CUSTOM (giáo trình) được.
    const mixed = (
      await courseContract(A, cust, [k.id], { lines: [{ kind: 'COURSE', courseClassId: k.id }, { kind: 'CUSTOM', name: 'Giáo trình', unitPrice: 300_000, quantity: 1 }] }).expect(201)
    ).body;
    expect(mixed.total).toBe(8_300_000);
    const courseWithService = { kind: 'COURSE', customerId: cust, lines: [{ kind: 'COURSE', courseClassId: k.id }, { kind: 'SERVICE', serviceId: svc.id, quantity: 1 }] };
    for (const r of [await createContract(A.owner, A.orgId, courseWithService), await request(app).post(cUrl(A.orgId, '/quote')).set(bearer(A.owner)).send(courseWithService)]) {
      expect(r.status).toBe(400);
      expect(r.body.error.message).toMatch(/^Hợp đồng khoá học không thêm được gói dịch vụ/);
    }
    const serviceWithCourse = { customerId: cust, lines: [{ kind: 'COURSE', courseClassId: k.id }] };
    const r2 = await createContract(A.owner, A.orgId, serviceWithCourse);
    expect([r2.status, r2.body.error.message]).toEqual([400, 'Hợp đồng dịch vụ không thêm được dòng khoá học — lập hợp đồng khoá học riêng']);
    // Thêm dòng / sửa nháp cũng đi qua cùng luật.
    const addSvc = await request(app).post(cUrl(A.orgId, `/${mixed.id}/lines`)).set(bearer(A.owner)).set('idempotency-key', idem()).send({ kind: 'SURCHARGE', serviceId: svc.id, quantity: 1 });
    expect([addSvc.status, addSvc.body.error.message]).toEqual([400, expect.stringMatching(/^Hợp đồng khoá học không thêm được gói dịch vụ/)]);
    const svcContract = (await createContract(A.owner, A.orgId, { customerId: cust, lines: [{ kind: 'CUSTOM', name: 'Phí', unitPrice: 1000, quantity: 1 }] }).expect(201)).body;
    const addCourse = await request(app).post(cUrl(A.orgId, `/${svcContract.id}/lines`)).set(bearer(A.owner)).set('idempotency-key', idem()).send({ kind: 'COURSE', courseClassId: k.id });
    expect(addCourse.status).toBe(400);
    const patchCourse = await request(app).patch(cUrl(A.orgId, `/${svcContract.id}`)).set(bearer(A.owner)).send({ lines: [{ kind: 'COURSE', courseClassId: k.id }] });
    expect(patchCourse.status).toBe(400);
    // Loại hợp đồng không đổi được sau khi tạo.
    const changeKind = await request(app).patch(cUrl(A.orgId, `/${mixed.id}`)).set(bearer(A.owner)).send({ kind: 'SERVICE' });
    expect([changeKind.status, changeKind.body.error.message]).toEqual([400, 'Dữ liệu gửi lên không hợp lệ']);
    expect(JSON.stringify(changeKind.body.error.details)).toContain('Không nhận trường: kind');
    // Một lớp chỉ một dòng trong cùng hợp đồng.
    const twice = await courseContract(A, cust, [k.id, k.id]);
    expect(twice.status).toBe(400);
    const addSame = await request(app).post(cUrl(A.orgId, `/${mixed.id}/lines`)).set(bearer(A.owner)).set('idempotency-key', idem()).send({ kind: 'COURSE', courseClassId: k.id });
    expect(addSame.status).toBe(400);
  });

  it('tổ chức chưa bật đào tạo (không phải ACADEMY): hợp đồng khoá học → 403 "Tổ chức chưa bật đào tạo"', async () => {
    const owner = await registerUser(app, 'hdkh-team');
    const orgId = await createOrg(app, owner, 'hdkh-team');
    const cust = (await db.customer.create({ data: { organizationId: orgId, fullName: 'Khách team' } })).id;
    const r = await createContract(owner, orgId, { kind: 'COURSE', customerId: cust, lines: [{ kind: 'CUSTOM', name: 'Phí', unitPrice: 1000, quantity: 1 }] });
    expect([r.status, r.body.error.message]).toEqual([403, 'Tổ chức chưa bật đào tạo']);
  });

  it('xem trước trả classes [{classId, seatsLeft, seatState}] theo seatState() dùng chung; lớp ĐẦY/ĐÓNG: xem trước không chặn, tạo/thêm dòng → 409 báo sớm', async () => {
    const almost = await klass(A, nail.id, `SD-${randomUUID().slice(0, 4)}`, 4);
    await db.courseClass.update({ where: { id: almost.id }, data: { enrolledCount: 3 } });
    const full = await klass(A, nail.id, `DAY-${randomUUID().slice(0, 4)}`, 2);
    await db.courseClass.update({ where: { id: full.id }, data: { enrolledCount: 2 } });
    const closed = await klass(A, nail.id, `DONG-${randomUUID().slice(0, 4)}`, 5, 'CLOSED');
    const cust = await customer(A, 'Học viên xem trước');
    const q = (
      await request(app)
        .post(cUrl(A.orgId, '/quote'))
        .set(bearer(A.owner))
        .send({ kind: 'COURSE', customerId: cust, lines: [almost.id, full.id, closed.id].map((courseClassId) => ({ kind: 'COURSE', courseClassId })) })
        .expect(200)
    ).body;
    expect(q.classes.map((c: { classId: string; seatsLeft: number; seatState: string; status: string }) => [c.classId, c.seatsLeft, c.seatState, c.status])).toEqual([
      [almost.id, 1, 'ALMOST_FULL', 'OPEN'],
      [full.id, 0, 'FULL', 'OPEN'],
      [closed.id, 5, 'AVAILABLE', 'CLOSED'],
    ]);
    const r = await courseContract(A, cust, [full.id]);
    expect([r.status, r.body.error.message]).toEqual([409, `Lớp ${full.name} đã đủ 2/2 học viên`]);
    expect(r.body.error.details).toMatchObject({ classId: full.id, seatsLeft: 0, seatState: 'FULL', reason: 'CLASS_FULL' });
    const ok = (await courseContract(A, cust, [almost.id]).expect(201)).body;
    for (const [cls, msg] of [
      [full, `Lớp ${full.name} đã đủ 2/2 học viên`],
      [closed, `Lớp ${closed.name} đã ngừng nhận ghi danh — chọn lớp khác`],
    ] as const) {
      const add = await request(app).post(cUrl(A.orgId, `/${ok.id}/lines`)).set(bearer(A.owner)).set('idempotency-key', idem()).send({ kind: 'COURSE', courseClassId: cls.id });
      expect([add.status, add.body.error.message]).toEqual([409, msg]);
    }
  });

  it('lớp của tổ chức khác = mã bịa (404 cùng lời)', async () => {
    const B = await academy(`lop-${randomUUID().slice(0, 4)}`);
    const bCourse = await course(B, { name: 'Khoá B' });
    const bClass = await klass(B, bCourse.id, 'B1', 5);
    const cust = await customer(A, 'Học viên chéo');
    const cross = await courseContract(A, cust, [bClass.id]);
    const fake = await courseContract(A, cust, [randomUUID()]);
    expect([cross.status, cross.body]).toEqual([fake.status, { error: { ...fake.body.error, requestId: cross.body.error.requestId } }]);
    expect(cross.status).toBe(404);
  });
});

describe('xác nhận: giữ chỗ, ghi danh — huỷ: trả chỗ', () => {
  it('xác nhận tạo ghi danh và trừ chỗ; lớp đầy lúc xác nhận → 409, hợp đồng vẫn nháp, không lớp nào bị trừ', async () => {
    const k = await klass(A, nail.id, `XN-${randomUUID().slice(0, 4)}`, 1);
    const other = await klass(A, nail.id, `XN2-${randomUUID().slice(0, 4)}`, 5);
    const c1 = (await courseContract(A, await customer(A, 'HV X1'), [k.id]).expect(201)).body;
    const c2 = (await courseContract(A, await customer(A, 'HV X2'), [other.id, k.id]).expect(201)).body;
    const ok = (await setStatus(A.owner, A.orgId, c1.id, 'CONFIRMED').expect(200)).body;
    expect(ok.enrollments).toEqual([expect.objectContaining({ courseClassId: k.id, contractLineId: c1.lines[0].id, status: 'ACTIVE' })]);
    expect(await enrolled(k.id)).toBe(1);
    const late = await setStatus(A.owner, A.orgId, c2.id, 'CONFIRMED');
    expect([late.status, late.body.error.message]).toEqual([409, `Lớp ${k.name} đã đủ 1/1 học viên`]);
    // Lớp kia đã được giữ chỗ trong CÙNG transaction → quay lui theo.
    expect([await enrolled(other.id), await enrolled(k.id)]).toEqual([0, 1]);
    const still = await db.contract.findUniqueOrThrow({ where: { id: c2.id } });
    expect(still.status).toBe('DRAFT');
    expect(await db.enrollment.count({ where: { contractId: c2.id } })).toBe(0);
  });

  it('BÀI ĐUA: hai xác nhận ĐỒNG THỜI vào chỗ cuối → đúng 1 thành công, 10/10 lần', async () => {
    const outcomes: string[] = [];
    let exactlyOne = 0;
    for (let i = 0; i < 10; i++) {
      const k = await klass(A, nail.id, `DUA-${i}-${randomUUID().slice(0, 4)}`, 2);
      // Chiếm trước 1/2 chỗ bằng một hợp đồng xác nhận thật → còn đúng chỗ cuối.
      const first = (await courseContract(A, await customer(A, `HV đua ${i}-0`), [k.id]).expect(201)).body;
      await setStatus(A.owner, A.orgId, first.id, 'CONFIRMED').expect(200);
      const x = (await courseContract(A, await customer(A, `HV đua ${i}-x`), [k.id]).expect(201)).body;
      const y = (await courseContract(A, await customer(A, `HV đua ${i}-y`), [k.id]).expect(201)).body;
      const [rx, ry] = await Promise.all([setStatus(A.owner, A.orgId, x.id, 'CONFIRMED'), setStatus(A.owner, A.orgId, y.id, 'CONFIRMED')]);
      const statuses = [rx.status, ry.status];
      const okCount = statuses.filter((s) => s === 200).length;
      const conflictMsg = [rx, ry].find((r) => r.status === 409)?.body.error.message;
      const [count, active] = [await enrolled(k.id), await activeEnrollments(k.id)];
      const good = okCount === 1 && statuses.includes(409) && conflictMsg === `Lớp ${k.name} đã đủ 2/2 học viên` && count === 2 && active === 2;
      if (good) exactlyOne++;
      outcomes.push(`${statuses.join('/')}${good ? '' : ` LỆCH(enrolled=${count}, active=${active})`}`);
    }
    const dist = outcomes.reduce<Record<string, number>>((m, o) => ({ ...m, [o]: (m[o] ?? 0) + 1 }), {});
    console.log(`[bài đua chỗ cuối] đúng 1 thành công: ${exactlyOne}/10; phân bố (người x / người y): ${JSON.stringify(dist)}`);
    expect(exactlyOne).toBe(10);
  });

  it('HUỶ HỢP ĐỒNG đã xác nhận → huỷ ghi danh, trả chỗ (cùng transaction); chỗ trả dùng lại được', async () => {
    const k = await klass(A, nail.id, `HUY-${randomUUID().slice(0, 4)}`, 1);
    const c = (await courseContract(A, await customer(A, 'HV huỷ'), [k.id]).expect(201)).body;
    await setStatus(A.owner, A.orgId, c.id, 'CONFIRMED').expect(200);
    expect(await enrolled(k.id)).toBe(1);
    const cancelled = (await setStatus(A.owner, A.orgId, c.id, 'CANCELLED', 'Học viên chuyển công tác').expect(200)).body;
    expect(cancelled.enrollments).toEqual([expect.objectContaining({ status: 'CANCELLED', cancelReason: 'Học viên chuyển công tác' })]);
    expect([await enrolled(k.id), await activeEnrollments(k.id)]).toEqual([0, 0]);
    const next = (await courseContract(A, await customer(A, 'HV thay'), [k.id]).expect(201)).body;
    await setStatus(A.owner, A.orgId, next.id, 'CONFIRMED').expect(200);
    expect(await enrolled(k.id)).toBe(1);
  });

  it('HUỶ DÒNG khoá học của hợp đồng đã xác nhận → huỷ ghi danh, trả chỗ; dòng khác giữ nguyên; tổng giảm', async () => {
    const k1 = await klass(A, nail.id, `HD1-${randomUUID().slice(0, 4)}`, 3);
    const k2 = await klass(A, nail.id, `HD2-${randomUUID().slice(0, 4)}`, 3);
    const c = (await courseContract(A, await customer(A, 'HV huỷ dòng'), [k1.id, k2.id]).expect(201)).body;
    await setStatus(A.owner, A.orgId, c.id, 'CONFIRMED').expect(200);
    expect([await enrolled(k1.id), await enrolled(k2.id)]).toEqual([1, 1]);
    const line1 = c.lines.find((l: { courseClassId: string }) => l.courseClassId === k1.id);
    const v = (await request(app).post(cUrl(A.orgId, `/${c.id}/lines/${line1.id}/void`)).set(bearer(A.owner)).send({ reason: 'Đổi sang khoá khác' }).expect(200)).body;
    expect(v.total).toBe(8_000_000);
    expect([await enrolled(k1.id), await enrolled(k2.id)]).toEqual([0, 1]);
    const es = await db.enrollment.findMany({ where: { contractId: c.id }, orderBy: { courseClassId: 'asc' }, select: { courseClassId: true, status: true } });
    expect(es.find((e) => e.courseClassId === k1.id)?.status).toBe('CANCELLED');
    expect(es.find((e) => e.courseClassId === k2.id)?.status).toBe('ACTIVE');
  });

  it('dòng khoá học thêm vào hợp đồng ĐÃ xác nhận → giữ chỗ + ghi danh ngay', async () => {
    const k1 = await klass(A, nail.id, `PS1-${randomUUID().slice(0, 4)}`, 3);
    const k2 = await klass(A, nail.id, `PS2-${randomUUID().slice(0, 4)}`, 3);
    const c = (await courseContract(A, await customer(A, 'HV phát sinh'), [k1.id]).expect(201)).body;
    await setStatus(A.owner, A.orgId, c.id, 'CONFIRMED').expect(200);
    const r = (await request(app).post(cUrl(A.orgId, `/${c.id}/lines`)).set(bearer(A.owner)).set('idempotency-key', idem()).send({ kind: 'COURSE', courseClassId: k2.id }).expect(201)).body;
    expect(r.enrollments.map((e: { courseClassId: string }) => e.courseClassId).sort()).toEqual([k1.id, k2.id].sort());
    expect(await enrolled(k2.id)).toBe(1);
  });

  it('GHI DANH TRÙNG một học viên một lớp (hai hợp đồng) → 409 "Học viên này đã ghi danh lớp …"; không trừ thêm chỗ', async () => {
    const k = await klass(A, nail.id, `TRUNG-${randomUUID().slice(0, 4)}`, 5);
    const cust = await customer(A, 'HV trùng');
    const c1 = (await courseContract(A, cust, [k.id]).expect(201)).body;
    const c2 = (await courseContract(A, cust, [k.id]).expect(201)).body;
    await setStatus(A.owner, A.orgId, c1.id, 'CONFIRMED').expect(200);
    const dup = await setStatus(A.owner, A.orgId, c2.id, 'CONFIRMED');
    expect([dup.status, dup.body.error.message]).toEqual([409, `Học viên này đã ghi danh lớp ${k.name} (hợp đồng ${c1.code})`]);
    expect([await enrolled(k.id), await activeEnrollments(k.id)]).toEqual([1, 1]);
    // Huỷ hợp đồng đầu → ghi danh lại được (chỉ chặn ghi danh còn hiệu lực).
    await setStatus(A.owner, A.orgId, c1.id, 'CANCELLED', 'Đổi hợp đồng').expect(200);
    await setStatus(A.owner, A.orgId, c2.id, 'CONFIRMED').expect(200);
    expect(await enrolled(k.id)).toBe(1);
  });

  it('giới hạn gói học viên: học viên MỚI vượt giới hạn → 409; học viên CŨ ghi thêm lớp vẫn được', async (ctx) => {
    const L = await academy(`qs-${randomUUID().slice(0, 4)}`, 1);
    try {
      await getUsage(db, L.orgId, 'students');
    } catch (err) {
      // Bộ đếm "students" thuộc gói M7 (lib/quota.ts — không phải tệp của thợ S3). Chưa có thì BỎ QUA có ghi lý do, không xanh giả.
      console.log(`[giới hạn học viên] bỏ qua: ${(err as Error).message}`);
      ctx.skip();
    }
    const co = await course(L, { name: 'Khoá L' });
    const [l1, l2] = [await klass(L, co.id, 'L1', 5), await klass(L, co.id, 'L2', 5)];
    const s1 = await customer(L, 'HV L1');
    const a = (await courseContract(L, s1, [l1.id]).expect(201)).body;
    await setStatus(L.owner, L.orgId, a.id, 'CONFIRMED').expect(200);
    const again = (await courseContract(L, s1, [l2.id]).expect(201)).body;
    await setStatus(L.owner, L.orgId, again.id, 'CONFIRMED').expect(200);
    const b = (await courseContract(L, await customer(L, 'HV L2'), [l1.id]).expect(201)).body;
    const over = await setStatus(L.owner, L.orgId, b.id, 'CONFIRMED');
    expect(over.status).toBe(409);
    expect(over.body.error.details).toMatchObject({ reason: 'QUOTA_EXCEEDED', kind: 'students' });
    expect(await enrolled(l1.id)).toBe(1);
  });

  it('GET /contracts lọc kind; mỗi dòng trả kind', async () => {
    const all = (await request(app).get(cUrl(A.orgId)).query({ pageSize: 100 }).set(bearer(A.owner)).expect(200)).body;
    const kinds = new Set(all.items.map((c: { kind: string }) => c.kind));
    expect(kinds).toEqual(new Set(['COURSE', 'SERVICE']));
    for (const kind of ['COURSE', 'SERVICE']) {
      const r = (await request(app).get(cUrl(A.orgId)).query({ kind, pageSize: 100 }).set(bearer(A.owner)).expect(200)).body;
      expect(r.items.length).toBeGreaterThan(0);
      expect(r.items.every((c: { kind: string; code: string }) => c.kind === kind && c.code.startsWith(kind === 'COURSE' ? 'HĐKH-' : 'HD-'))).toBe(true);
    }
    expect((await request(app).get(cUrl(A.orgId)).query({ kind: 'KHAC' }).set(bearer(A.owner))).status).toBe(400);
  });
});

describe('mẫu điều khoản / nội quy', () => {
  let T: Academy;
  let k: { id: string };
  beforeAll(async () => {
    T = await academy(`mau-${randomUUID().slice(0, 4)}`);
    const co = await course(T, { name: 'Khoá mẫu' });
    k = await klass(T, co.id, 'M1', 50);
  });
  const post = (u: TestUser, body: object) => request(app).post(tUrl(T.orgId)).set(bearer(u)).set('idempotency-key', idem()).send(body);
  const patch = (id: string, body: object) => request(app).patch(tUrl(T.orgId, `/${id}`)).set(bearer(T.owner)).send(body);

  it('sửa mẫu (body → phiên bản + 1) KHÔNG đổi điều khoản / nội quy đã chụp của hợp đồng đã xác nhận', async () => {
    const terms = (await post(T.owner, { kind: 'TERMS', appliesTo: [], name: 'Điều khoản chung', body: 'Điều 1. Bản một.', isDefault: true }).expect(201)).body;
    const rules = (await post(T.owner, { kind: 'RULES', appliesTo: ['COURSE'], name: 'Nội quy lớp', body: 'Đi học đúng giờ.', isDefault: true }).expect(201)).body;
    expect([terms.version, terms.isDefault, rules.appliesTo]).toEqual([1, true, ['COURSE']]);
    const c = (await courseContract(T, await customer(T, 'HV mẫu'), [k.id]).expect(201)).body;
    expect([c.terms, c.rules]).toEqual([null, null]);
    const confirmed = (await setStatus(T.owner, T.orgId, c.id, 'CONFIRMED').expect(200)).body;
    expect(confirmed).toMatchObject({
      terms: 'Điều 1. Bản một.',
      termsTemplateId: terms.id,
      termsTemplateVersion: 1,
      rules: 'Đi học đúng giờ.',
      rulesTemplateId: rules.id,
      rulesTemplateVersion: 1,
    });
    const edited = (await patch(terms.id, { body: 'Điều 1. Bản hai.' }).expect(200)).body;
    expect(edited.version).toBe(2);
    await patch(rules.id, { body: 'Đi học đúng giờ, tắt chuông.' }).expect(200);
    const after = (await request(app).get(cUrl(T.orgId, `/${c.id}`)).set(bearer(T.owner)).expect(200)).body;
    expect([after.terms, after.termsTemplateVersion, after.rules, after.rulesTemplateVersion]).toEqual(['Điều 1. Bản một.', 1, 'Đi học đúng giờ.', 1]);
    // Hợp đồng xác nhận SAU khi sửa chụp bản mới.
    const c2 = (await courseContract(T, await customer(T, 'HV mẫu 2'), [k.id]).expect(201)).body;
    const conf2 = (await setStatus(T.owner, T.orgId, c2.id, 'CONFIRMED').expect(200)).body;
    expect([conf2.terms, conf2.termsTemplateVersion, conf2.rulesTemplateVersion]).toEqual(['Điều 1. Bản hai.', 2, 2]);
    // Gửi lại đúng nội dung cũ: không tăng phiên bản.
    expect((await patch(terms.id, { body: 'Điều 1. Bản hai.' }).expect(200)).body.version).toBe(2);
    // Database cấm đổi bản chụp sau xác nhận.
    await expect(db.contract.update({ where: { id: c.id }, data: { terms: 'Sửa lén' } })).rejects.toThrow(/không được đổi khách, ngày, điều khoản/);
  });

  it('chọn mẫu cho hợp đồng: chụp đúng mẫu đã chọn; nội quy cho hợp đồng dịch vụ → 400; mẫu tổ chức khác = mã bịa; điều khoản tự nhập được giữ', async () => {
    const pick = (await post(T.owner, { kind: 'TERMS', appliesTo: ['COURSE'], name: 'Điều khoản riêng', body: 'Riêng cho lớp cuối tuần.' }).expect(201)).body;
    const c = (await courseContract(T, await customer(T, 'HV chọn'), [k.id], { termsTemplateId: pick.id }).expect(201)).body;
    expect([c.termsTemplateId, c.termsTemplateVersion]).toEqual([pick.id, 1]);
    // Mẫu sửa sau khi chọn, trước khi xác nhận → chụp bản MỚI NHẤT lúc xác nhận.
    await patch(pick.id, { body: 'Riêng cho lớp cuối tuần (bản 2).' }).expect(200);
    const conf = (await setStatus(T.owner, T.orgId, c.id, 'CONFIRMED').expect(200)).body;
    expect([conf.terms, conf.termsTemplateId, conf.termsTemplateVersion]).toEqual(['Riêng cho lớp cuối tuần (bản 2).', pick.id, 2]);
    const cust = await customer(T, 'Khách dịch vụ');
    const rulesTpl = await db.contractText.findFirstOrThrow({ where: { organizationId: T.orgId, kind: 'RULES' } });
    const svcRules = await createContract(T.owner, T.orgId, { customerId: cust, rulesTemplateId: rulesTpl.id, lines: [{ kind: 'CUSTOM', name: 'Phí', unitPrice: 1000, quantity: 1 }] });
    expect([svcRules.status, svcRules.body.error.message]).toEqual([400, 'Nội quy chỉ dùng cho hợp đồng khoá học']);
    // Mẫu chỉ cho khoá học chọn vào hợp đồng dịch vụ → 400.
    const wrongKind = await createContract(T.owner, T.orgId, { customerId: cust, termsTemplateId: pick.id, lines: [{ kind: 'CUSTOM', name: 'Phí', unitPrice: 1000, quantity: 1 }] });
    expect(wrongKind.status).toBe(400);
    const O = await academy(`mau-o-${randomUUID().slice(0, 4)}`);
    const oText = (await request(app).post(tUrl(O.orgId)).set(bearer(O.owner)).set('idempotency-key', idem()).send({ kind: 'TERMS', appliesTo: [], name: 'Của O', body: 'O' }).expect(201)).body;
    const cross = await courseContract(T, cust, [k.id], { termsTemplateId: oText.id });
    const fake = await courseContract(T, cust, [k.id], { termsTemplateId: randomUUID() });
    expect([cross.status, cross.body.error.message]).toEqual([404, fake.body.error.message]);
    // Hợp đồng dịch vụ tự nhập điều khoản: xác nhận giữ lời tự nhập dù tổ chức có mẫu mặc định (hành vi cũ không đổi).
    const manual = (await createContract(T.owner, T.orgId, { customerId: cust, terms: 'Tự nhập', lines: [{ kind: 'CUSTOM', name: 'Phí', unitPrice: 1000, quantity: 1 }] }).expect(201)).body;
    const mConf = (await setStatus(T.owner, T.orgId, manual.id, 'CONFIRMED').expect(200)).body;
    expect([mConf.terms, mConf.termsTemplateId, mConf.rules]).toEqual(['Tự nhập', null, null]);
    // Gửi cả mẫu lẫn lời tự nhập → 400.
    expect((await courseContract(T, cust, [k.id], { termsTemplateId: pick.id, terms: 'x' })).status).toBe(400);
  });

  it('mỗi (tổ chức, loại) tối đa 1 mặc định: đặt mặc định mới bỏ mặc định cũ cùng transaction; ngừng dùng mẫu mặc định → thôi mặc định', async () => {
    const first = (await post(T.owner, { kind: 'TERMS', appliesTo: [], name: 'MĐ 1', body: 'a', isDefault: true }).expect(201)).body;
    const second = (await post(T.owner, { kind: 'TERMS', appliesTo: [], name: 'MĐ 2', body: 'b', isDefault: true }).expect(201)).body;
    const defaults = async () => db.contractText.findMany({ where: { organizationId: T.orgId, kind: 'TERMS', isDefault: true }, select: { id: true } });
    expect((await defaults()).map((d) => d.id)).toEqual([second.id]);
    await patch(first.id, { isDefault: true }).expect(200);
    expect((await defaults()).map((d) => d.id)).toEqual([first.id]);
    // Đặt mặc định đồng thời từ hai mẫu: không lỗi trùng, cuối cùng đúng 1 mặc định.
    const [r1, r2] = await Promise.all([patch(first.id, { isDefault: true }), patch(second.id, { isDefault: true })]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(await defaults()).toHaveLength(1);
    // Nội quy mặc định không bị đụng.
    expect(await db.contractText.count({ where: { organizationId: T.orgId, kind: 'RULES', isDefault: true } })).toBe(1);
    const cur = (await defaults())[0]!.id;
    const off = (await patch(cur, { isActive: false }).expect(200)).body;
    expect([off.isActive, off.isDefault]).toEqual([false, false]);
    expect((await patch(cur, { isDefault: true })).status).toBe(400);
    const list = (await request(app).get(tUrl(T.orgId)).query({ kind: 'TERMS' }).set(bearer(T.owner)).expect(200)).body;
    expect(list.some((t: { id: string }) => t.id === cur)).toBe(false);
    const withOff = (await request(app).get(tUrl(T.orgId)).query({ kind: 'TERMS', includeInactive: 'true' }).set(bearer(T.owner)).expect(200)).body;
    expect(withOff.some((t: { id: string }) => t.id === cur)).toBe(true);
    const forService = (await request(app).get(tUrl(T.orgId)).query({ appliesTo: 'SERVICE' }).set(bearer(T.owner)).expect(200)).body;
    expect(forService.every((t: { appliesTo: string[] }) => t.appliesTo.length === 0 || t.appliesTo.includes('SERVICE'))).toBe(true);
  });

  it('PATCH một trường không đổi trường khác (bệnh zod .default ở PATCH)', async () => {
    const t = (await post(T.owner, { kind: 'RULES', appliesTo: ['COURSE'], name: 'Nội quy đủ', body: 'Nội dung đủ' }).expect(201)).body;
    const full = (await patch(t.id, { name: 'Nội quy đủ 2', body: 'Nội dung đủ 2', appliesTo: [], isDefault: true, isActive: true }).expect(200)).body;
    const one = (await patch(t.id, { name: 'Chỉ đổi tên' }).expect(200)).body;
    const { name: _n1, updatedAt: _u1, ...rest1 } = full;
    const { name: n2, updatedAt: _u2, ...rest2 } = one;
    expect(n2).toBe('Chỉ đổi tên');
    expect(rest2).toEqual(rest1);
    expect([one.version, one.isDefault, one.appliesTo, one.body]).toEqual([2, true, [], 'Nội dung đủ 2']);
  });

  it('quyền: contracts.read xem được; thiếu contracts.texts → 403 khi thêm / sửa', async () => {
    const recep = await registerUser(app, 'hdkh-le-tan');
    await addMember(app, T.owner, T.orgId, recep, ['receptionist']);
    await request(app).get(tUrl(T.orgId)).set(bearer(recep)).expect(200);
    const r = await post(recep, { kind: 'TERMS', appliesTo: [], name: 'X', body: 'Y' });
    expect(r.status).toBe(403);
    const any = await db.contractText.findFirstOrThrow({ where: { organizationId: T.orgId } });
    expect((await request(app).patch(tUrl(T.orgId, `/${any.id}`)).set(bearer(recep)).send({ name: 'Z' })).status).toBe(403);
  });
});

// Biên bản máy chủ lát 2, N7: sửa nháp hạ tổng xuống dưới số đã thu từng tạo "trả thừa" lách luật thu vượt.
describe('sửa nháp không được hạ tổng xuống dưới số đã thu (N7)', () => {
  it('thu đủ 1 triệu rồi sửa nháp xuống 200 nghìn → 409 kèm số đã thu và tổng mới; tăng tổng / sửa ghi chú vẫn được', async () => {
    const cust = await customer(A, 'Khách N7');
    const c = (await createContract(A.owner, A.orgId, { customerId: cust, lines: [{ kind: 'CUSTOM', name: 'Gói', unitPrice: 1_000_000, quantity: 1 }] }).expect(201)).body;
    await request(app).post(`/api/v1/orgs/${A.orgId}/contracts/${c.id}/payments`).set(bearer(A.owner)).set('idempotency-key', idem()).send({ method: 'CASH', amount: 1_000_000 }).expect(201);
    const lower = await request(app).patch(cUrl(A.orgId, `/${c.id}`)).set(bearer(A.owner)).send({ lines: [{ kind: 'CUSTOM', name: 'Gói', unitPrice: 200_000, quantity: 1 }] });
    expect(lower.status).toBe(409);
    expect(lower.body.error.details).toMatchObject({ reason: 'TOTAL_BELOW_PAID', paid: 1_000_000, newTotal: 200_000, total: 1_000_000 });
    const disc = await request(app).patch(cUrl(A.orgId, `/${c.id}`)).set(bearer(A.owner)).send({ discount: 1 });
    expect([disc.status, disc.body.error.details.newTotal]).toEqual([409, 999_999]);
    expect((await db.contract.findUniqueOrThrow({ where: { id: c.id } })).total).toBe(1_000_000n);
    await request(app).patch(cUrl(A.orgId, `/${c.id}`)).set(bearer(A.owner)).send({ notes: 'Ghi chú' }).expect(200);
    await request(app).patch(cUrl(A.orgId, `/${c.id}`)).set(bearer(A.owner)).send({ lines: [{ kind: 'CUSTOM', name: 'Gói', unitPrice: 1_500_000, quantity: 1 }] }).expect(200);
  });
});
