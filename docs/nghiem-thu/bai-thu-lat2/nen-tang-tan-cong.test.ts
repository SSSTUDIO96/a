// BÀI TẤN CÔNG CỦA THỢ CHẤM — LÁT 2, QUẢN TRỊ NỀN TẢNG + HẠN MỨC GÓI (modules/platform, lib/quota.ts).
// Quy ước: "LỖI:" xanh = lỗi có thật; "CHẶN:" xanh = đòn bị chặn; "GHI NHẬN:" xanh = hành vi có thật, chủ quyết.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_ROUTES } from '../src/app';
import { assertQuota, assertWritable, describeSubscription, getCurrentSubscription, GRACE_DAYS } from '../src/lib/quota';
import { grantPlatformAdmin } from '../src/scripts/grant-platform-admin';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from '../test/helpers';

const deps = makeDeps();
let app: App;
let admin: TestUser;
let normal: TestUser;
const DAY = 86_400_000;

beforeAll(async () => {
  app = makeApp(deps);
  admin = await registerUser(app, 'c2-nt-admin');
  normal = await registerUser(app, 'c2-nt-thuong');
  await grantPlatformAdmin(deps.db, admin.email);
});
afterAll(async () => {
  await deps.db.$disconnect();
});

const platformRoutes = ALL_ROUTES.filter((r) => r.path.startsWith('/platform/'));
const fill = (p: string) => p.replace(':organizationId', randomUUID()).replace(':planId', randomUUID());

function send(method: string, path: string, headers: Record<string, string> = {}) {
  const r = (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](`/api/v1${path}`);
  for (const [k, v] of Object.entries(headers)) r.set(k, v);
  return method === 'get' ? r : r.send({});
}

describe('PL-1 dò đường /platform/', () => {
  it('CHẶN: người đã đăng nhập (không có quyền) → 404 giống hệt đường bịa ở mọi đường', async () => {
    let same = 0;
    for (const r of platformRoutes) {
      const real = await send(r.method, fill(r.path), bearer(normal));
      const fake = await send(r.method, `/platform/bia-${randomUUID()}`, bearer(normal));
      if (real.status === 404 && real.body.error.message === fake.body.error.message) same++;
    }
    console.log(`[PL-1] đã đăng nhập: giống đường bịa ${same}/${platformRoutes.length}`);
    expect(same).toBe(platformRoutes.length);
  });

  it('LỖI: người CHƯA đăng nhập (hoặc thẻ rác) phân biệt được đường thật (401) với đường bịa (404) ở mọi đường', async () => {
    let distinct = 0;
    let distinctJunk = 0;
    for (const r of platformRoutes) {
      const real = await send(r.method, fill(r.path));
      const fake = await send(r.method, `/platform/bia-${randomUUID()}`);
      if (real.status !== fake.status) distinct++;
      const realJ = await send(r.method, fill(r.path), { authorization: 'Bearer rac' });
      const fakeJ = await send(r.method, `/platform/bia-${randomUUID()}`, { authorization: 'Bearer rac' });
      if (realJ.status !== fakeJ.status) distinctJunk++;
    }
    console.log(`[PL-1] chưa đăng nhập: phân biệt được ${distinct}/${platformRoutes.length}; thẻ rác: ${distinctJunk}/${platformRoutes.length} (thật 401, bịa 404)`);
    expect(distinct).toBe(platformRoutes.length);
  });

  it('LỖI: tài liệu OpenAPI công khai (không cần đăng nhập) liệt kê đủ đường /platform/ kèm thân yêu cầu', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    const listed = Object.keys(res.body.paths).filter((p) => p.startsWith('/api/v1/platform/'));
    const ops = listed.reduce((n, p) => n + Object.keys(res.body.paths[p]).length, 0);
    console.log(`[PL-1] /api/v1/openapi.json (không đăng nhập) → ${res.status}; liệt kê ${ops}/${platformRoutes.length} thao tác /platform/: ${listed.join(', ')}`);
    expect(res.status).toBe(200);
    expect(ops).toBe(platformRoutes.length);
  });
});

describe('PL-2 sửa giá gói', () => {
  it('LỖI: PATCH chỉ đổi giá → mọi giới hạn bị XOÁ về "không giới hạn", gói đã ngừng bán bật lại, tính năng/tên miền/sắp xếp về mặc định', async () => {
    const code = `c2_${randomUUID().slice(0, 8)}`;
    const created = await request(app)
      .post('/api/v1/platform/plans')
      .set(bearer(admin))
      .send({ code, name: 'Gói nhỏ', priceMonthly: 99_000, maxStaff: 2, maxAppointmentsPerMonth: 30, maxStorageMb: 500, maxStudents: 0, maxCourses: 0, customDomain: true, features: ['web'], isActive: false, sortOrder: 7 });
    expect(created.status).toBe(201);
    const upd = await request(app).patch(`/api/v1/platform/plans/${created.body.id}`).set(bearer(admin)).send({ priceMonthly: 129_000 });
    const after = upd.body;
    const fields: [string, unknown, unknown][] = [
      ['maxStaff', 2, after.maxStaff],
      ['maxAppointmentsPerMonth', 30, after.maxAppointmentsPerMonth],
      ['maxStorageMb', 500, after.maxStorageMb],
      ['maxStudents', 0, after.maxStudents],
      ['maxCourses', 0, after.maxCourses],
      ['customDomain', true, after.customDomain],
      ['features', ['web'], after.features],
      ['isActive', false, after.isActive],
      ['sortOrder', 7, after.sortOrder],
    ];
    const changed = fields.filter(([, was, now]) => JSON.stringify(was) !== JSON.stringify(now));
    console.log(`[PL-2] PATCH {priceMonthly} → ${upd.status}; trường KHÔNG được gửi mà bị đổi: ${changed.length}/${fields.length}: ${changed.map(([k, was, now]) => `${k} ${JSON.stringify(was)}→${JSON.stringify(now)}`).join(', ')}`);
    expect(upd.status).toBe(200);
    expect(changed.length).toBe(fields.length);
  });

  it('LỖI (hệ quả): tổ chức đang ở giới hạn 2 nhân sự — sau khi chỉ sửa GIÁ gói, assertQuota cho thêm người không giới hạn', async () => {
    const code = `c2q_${randomUUID().slice(0, 8)}`;
    const plan = await request(app).post('/api/v1/platform/plans').set(bearer(admin)).send({ code, name: 'Hai người', priceMonthly: 1, maxStaff: 2 });
    const owner = await registerUser(app, 'c2-nt-q');
    const orgId = await createOrg(app, owner, 'c2-nt-q');
    await addMember(app, owner, orgId, await registerUser(app, 'c2-nt-q2'), ['artist']);
    await request(app).post(`/api/v1/platform/organizations/${orgId}/subscriptions`).set(bearer(admin)).send({ planId: plan.body.id, months: 1 }).expect(201);
    const before = await deps.db.$transaction((tx) => assertQuota(tx, orgId, 'staff')).then(() => 'qua', (e: Error) => `chặn: ${e.message.slice(0, 40)}`);
    await request(app).patch(`/api/v1/platform/plans/${plan.body.id}`).set(bearer(admin)).send({ priceMonthly: 2 }).expect(200);
    const after = await deps.db.$transaction((tx) => assertQuota(tx, orgId, 'staff')).then(() => 'qua', (e: Error) => `chặn: ${e.message.slice(0, 40)}`);
    console.log(`[PL-2] thêm người thứ 3: trước khi sửa giá → ${before}; sau khi sửa giá → ${after}`);
    expect(before.startsWith('chặn')).toBe(true);
    expect(after).toBe('qua');
  });
});

describe('PL-3 thuê bao chồng thời gian, hết hạn, ân hạn', () => {
  async function newOrgWithPlan() {
    const owner = await registerUser(app, 'c2-nt-tb');
    const orgId = await createOrg(app, owner, 'c2-nt-tb');
    const plan = await request(app).post('/api/v1/platform/plans').set(bearer(admin)).send({ code: `c2t_${randomUUID().slice(0, 8)}`, name: 'Năm', priceMonthly: 1_000_000 });
    return { owner, orgId, planId: plan.body.id as string };
  }
  const sub = (orgId: string, body: object) => request(app).post(`/api/v1/platform/organizations/${orgId}/subscriptions`).set(bearer(admin)).send(body);

  it('GHI NHẬN: thuê bao 1 năm đã trả, rồi thêm dòng dùng thử ngắn chồng lên → dòng ngắn thắng; 8 ngày sau hết hạn tổ chức bị CHỈ ĐỌC dù năm đã trả còn 347 ngày', async () => {
    const { orgId, planId } = await newOrgWithPlan();
    const now = Date.now();
    const y = await sub(orgId, { planId, status: 'ACTIVE', startsAt: new Date(now - 10 * DAY).toISOString(), endsAt: new Date(now + 355 * DAY).toISOString() });
    const t = await sub(orgId, { planId, status: 'TRIAL', startsAt: new Date(now - 5 * DAY).toISOString(), endsAt: new Date(now - 1 * DAY).toISOString() });
    const cur = await getCurrentSubscription(deps.db, orgId, new Date(now));
    const later = new Date(now + 7 * DAY);
    const verdict = await assertWritable(deps.db, orgId, later).then(() => 'được ghi', (e: Error) => `chỉ đọc (${e.message})`);
    console.log(`[PL-3] thêm dòng chồng → ${y.status}/${t.status}; hiện hành = ${cur.hasSubscription ? `${cur.subscription.status} hết ${cur.subscription.endsAt?.toISOString().slice(0, 10)}` : 'không'}; sau 7 ngày: ${verdict}`);
    expect([y.status, t.status]).toEqual([201, 201]);
    expect(verdict.startsWith('chỉ đọc')).toBe(true);
  });

  it('GHI NHẬN: đã đặt lịch gia hạn bắt đầu tương lai thì KHÔNG đổi gói ngay hôm nay được (409)', async () => {
    const { orgId, planId } = await newOrgWithPlan();
    await sub(orgId, { planId, startsAt: new Date(Date.now() + 30 * DAY).toISOString(), months: 12 }).expect(201);
    const now = await sub(orgId, { planId, months: 1 });
    console.log(`[PL-3] đổi gói hôm nay khi đã có dòng tương lai → ${now.status} ${now.body.error?.message}`);
    expect(now.status).toBe(409);
  });

  it('CHẶN: mốc ân hạn — hết hạn 7 ngày trừ 1 giây vẫn ghi được; đúng 7 ngày → chỉ đọc; EXPIRED ghi tay → chỉ đọc ngay', () => {
    const now = new Date();
    const a = describeSubscription({ status: 'ACTIVE', endsAt: new Date(now.getTime() - GRACE_DAYS * DAY + 1000) }, now);
    const b = describeSubscription({ status: 'ACTIVE', endsAt: new Date(now.getTime() - GRACE_DAYS * DAY) }, now);
    const c = describeSubscription({ status: 'EXPIRED', endsAt: new Date(now.getTime() + 30 * DAY) }, now);
    console.log(`[PL-3] ân hạn: còn 1 giây → writable=${a.writable}; đúng mốc → ${b.writable}; EXPIRED ghi tay → ${c.writable}`);
    expect([a.writable, b.writable, c.writable]).toEqual([true, false, false]);
  });

  it('CHẶN: endsAt ≤ startsAt, months + endsAt cùng lúc, gói không có, tổ chức bịa → bị từ chối, không ghi dòng nào', async () => {
    const { orgId, planId } = await newOrgWithPlan();
    const t0 = new Date().toISOString();
    const res = [
      await sub(orgId, { planId, startsAt: t0, endsAt: t0 }),
      await sub(orgId, { planId, months: 1, endsAt: new Date(Date.now() + DAY).toISOString() }),
      await sub(orgId, { planId: randomUUID() }),
      await request(app).post(`/api/v1/platform/organizations/${randomUUID()}/subscriptions`).set(bearer(admin)).send({ planId }),
      await sub(orgId, { planId, months: 0 }),
      await sub(orgId, { planId, months: 1.5 }),
    ];
    const n = await deps.db.organizationSubscription.count({ where: { organizationId: orgId } });
    console.log(`[PL-3] dữ liệu sai thuê bao: ${res.map((r) => r.status).join(', ')}; dòng đã ghi ${n}`);
    expect(res.every((r) => r.status >= 400 && r.status < 500)).toBe(true);
    expect(n).toBe(0);
  });
});

describe('PL-4 tạm khoá và thống kê', () => {
  it('CHẶN: tạm khoá ghi nhật ký trước → sau + lý do', async () => {
    const owner = await registerUser(app, 'c2-nt-khoa');
    const orgId = await createOrg(app, owner, 'c2-nt-khoa');
    const r = await request(app).patch(`/api/v1/platform/organizations/${orgId}`).set(bearer(admin)).send({ status: 'SUSPENDED', reason: 'Nợ phí' });
    const log = await deps.db.auditLog.findFirst({ where: { organizationId: orgId, action: 'platform.org_suspended' } });
    console.log(`[PL-4] khoá → ${r.status}; nhật ký: ${JSON.stringify(log?.data)}`);
    expect(r.status).toBe(200);
    expect(log?.data).toMatchObject({ before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED' }, reason: 'Nợ phí' });
  });

  it('GHI NHẬN: "doanh thu thuê bao dự kiến" vẫn cộng tiền của tổ chức ĐANG BỊ KHOÁ', async () => {
    const owner = await registerUser(app, 'c2-nt-dt');
    const orgId = await createOrg(app, owner, 'c2-nt-dt');
    const plan = await request(app).post('/api/v1/platform/plans').set(bearer(admin)).send({ code: `c2d_${randomUUID().slice(0, 8)}`, name: 'DT', priceMonthly: 777_777 });
    await request(app).post(`/api/v1/platform/organizations/${orgId}/subscriptions`).set(bearer(admin)).send({ planId: plan.body.id, months: 1 }).expect(201);
    const s1 = (await request(app).get('/api/v1/platform/stats').set(bearer(admin))).body.projectedMonthlyRevenue;
    await request(app).patch(`/api/v1/platform/organizations/${orgId}`).set(bearer(admin)).send({ status: 'SUSPENDED', reason: 'thử' }).expect(200);
    const s2 = (await request(app).get('/api/v1/platform/stats').set(bearer(admin))).body.projectedMonthlyRevenue;
    console.log(`[PL-4] doanh thu dự kiến trước khoá ${s1}, sau khoá ${s2} (chênh ${s1 - s2})`);
    expect(s2).toBe(s1);
  });
});

describe('PL-5 hạn mức (hàm, chưa gắn module nào)', () => {
  it('GHI NHẬN: tổ chức chưa có thuê bao + hệ thống chưa có gói "trial" → assertQuota ném lỗi 500 kèm hướng dẫn lệnh vận hành (người dùng studio sẽ đọc thấy)', async () => {
    const trial = await deps.db.subscriptionPlan.findUnique({ where: { code: 'trial' } });
    const owner = await registerUser(app, 'c2-nt-trial');
    const orgId = await createOrg(app, owner, 'c2-nt-trial');
    const r = await deps.db.$transaction((tx) => assertQuota(tx, orgId, 'staff')).then(() => null, (e: { status?: number; message: string }) => e);
    console.log(`[PL-5] có gói trial sẵn: ${!!trial}; kết quả: ${r ? `${r.status} "${r.message}"` : 'qua'}`);
    if (!trial) {
      expect(r?.status).toBe(500);
      expect(r?.message).toContain('pnpm');
    }
  });
});
