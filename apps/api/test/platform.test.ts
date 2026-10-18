import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { platformRoutes } from '../src/modules/platform/routes';
import type { AnyRoute } from '../src/http/route';
import { grantPlatformAdmin } from '../src/scripts/grant-platform-admin';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let admin: TestUser;
let owner: TestUser;
let member: TestUser;
let orgId: string;
let planId: string;

const DAY = 24 * 60 * 60 * 1000;

async function makePlan(price: number, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/platform/plans')
    .set(bearer(admin))
    .send({ code: `thu_${randomUUID().slice(0, 8)}`, name: 'Gói thử', priceMonthly: price, ...extra });
  if (res.status !== 201) throw new Error(`Tạo gói thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as { id: string; code: string; name: string };
}

async function addSub(org: string, body: Record<string, unknown>) {
  const res = await request(app).post(`/api/v1/platform/organizations/${org}/subscriptions`).set(bearer(admin)).send(body);
  if (res.status !== 201) throw new Error(`Thêm thuê bao thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as { id: string };
}

function fill(r: AnyRoute, ids: Record<string, string>) {
  return `/api/v1${r.path.replace(/:([A-Za-z]+)/g, (_m, n: string) => {
    const v = ids[n];
    if (!v) throw new Error(`Thiếu giá trị cho :${n}`);
    return v;
  })}`;
}

function send(r: AnyRoute, path: string, headers: Record<string, string>) {
  const req = request(app)[r.method](path);
  for (const [k, v] of Object.entries(headers)) req.set(k, v);
  return r.method === 'get' || r.method === 'delete' ? req : req.send({});
}

// Bỏ requestId (mỗi yêu cầu một mã) rồi so phần còn lại của thân trả về.
function withoutRequestId(body: { error?: Record<string, unknown> }) {
  const { requestId: _drop, ...rest } = body.error ?? {};
  return rest;
}

beforeAll(async () => {
  app = makeApp(deps);
  admin = await registerUser(app, 'qtnt');
  owner = await registerUser(app, 'qtnt-chu');
  member = await registerUser(app, 'qtnt-tv');
  orgId = await createOrg(app, owner, 'qtnt');
  await addMember(app, owner, orgId, member, ['artist']);
  const g = await grantPlatformAdmin(deps.db, admin.email);
  expect(g.changed).toBe(true);
  planId = (await makePlan(100000)).id;
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('Cửa vào quản trị nền tảng', () => {
  it('có đủ đường API đã giao', () => {
    const keys = platformRoutes.map((r) => `${r.method.toUpperCase()} ${r.path}`).sort();
    expect(keys).toEqual(
      [
        'GET /platform/organizations',
        'GET /platform/organizations/:organizationId',
        'POST /platform/organizations/:organizationId/subscriptions',
        'PATCH /platform/organizations/:organizationId',
        'GET /platform/plans',
        'POST /platform/plans',
        'PATCH /platform/plans/:planId',
        'GET /platform/stats',
      ].sort(),
    );
    for (const r of platformRoutes) expect(r.scope).toBe('platform');
  });

  it('người thường (kể cả chủ tổ chức) gọi mọi đường /platform → 404 y hệt đường bịa', async () => {
    const ids = { organizationId: orgId, planId };
    for (const u of [owner, member]) {
      for (const r of platformRoutes) {
        const res = await send(r, fill(r, ids), bearer(u));
        const fake = await send(r, `/api/v1/platform/duong-bia-${randomUUID().slice(0, 6)}`, bearer(u));
        expect(fake.status, `đường bịa ${r.method}`).toBe(404);
        expect(res.status, `${r.method} ${r.path}`).toBe(404);
        expect(withoutRequestId(res.body), `${r.method} ${r.path}`).toEqual(withoutRequestId(fake.body));
        expect(res.headers['content-type']).toBe(fake.headers['content-type']);
      }
    }
    // Không lộ dữ liệu, không đổi gì.
    const org = await deps.db.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.status).toBe('ACTIVE');
    expect(await deps.db.organizationSubscription.count({ where: { organizationId: orgId } })).toBe(0);
  });

  // Trước đây đòi 401 — chính bài thử ép hành vi làm lộ đường quản trị (biên bản máy chủ lát 2, M2). Nay: 404 như đường bịa.
  it('chưa đăng nhập → 404 "Không có đường API này" ở mọi đường /platform (không lộ đường có thật)', async () => {
    const ids = { organizationId: orgId, planId };
    for (const r of platformRoutes) {
      const res = await send(r, fill(r, ids), {});
      expect(res.status, `${r.method} ${r.path}`).toBe(404);
      expect(res.body.error.message).toBe('Không có đường API này');
    }
  });

  it('người được cấp qua script vào được; thu quyền → lại 404; cấp/thu đều ghi nhật ký (không thuộc tổ chức)', async () => {
    const u = await registerUser(app, 'qtnt-cap');
    await request(app).get('/api/v1/platform/stats').set(bearer(u)).expect(404);
    const g = await grantPlatformAdmin(deps.db, u.email.toUpperCase());
    expect(g).toMatchObject({ userId: u.id, changed: true });
    expect((await grantPlatformAdmin(deps.db, u.email)).changed).toBe(false);
    await request(app).get('/api/v1/platform/stats').set(bearer(u)).expect(200);
    await request(app).get('/api/v1/platform/organizations').set(bearer(u)).expect(200);
    await grantPlatformAdmin(deps.db, u.email, { revoke: true });
    await request(app).get('/api/v1/platform/stats').set(bearer(u)).expect(404);
    const logs = await deps.db.auditLog.findMany({ where: { entityType: 'platform_admin', entityId: u.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['platform_admin.granted', 'platform_admin.revoked']);
    for (const l of logs) expect(l.organizationId).toBeNull();
  });

  it('script từ chối email chưa đăng ký', async () => {
    await expect(grantPlatformAdmin(deps.db, `khong-co-${randomUUID()}@thu.local`)).rejects.toThrow(/Chưa có tài khoản/);
  });
});

describe('Thuê bao', () => {
  it('đổi gói thêm dòng mới, dòng cũ không đổi; ghi nhật ký vào tổ chức bị tác động', async () => {
    const o = await createOrg(app, owner, 'qtnt-goi');
    const p2 = await makePlan(300000);
    const first = await addSub(o, { planId, months: 1, startsAt: new Date(Date.now() - 10 * DAY).toISOString() });
    const before = await deps.db.organizationSubscription.findUniqueOrThrow({ where: { id: first.id } });
    const second = await addSub(o, { planId: p2.id, months: 12, note: 'Nâng gói' });
    const after = await deps.db.organizationSubscription.findUniqueOrThrow({ where: { id: first.id } });
    expect(after).toEqual(before);
    expect(await deps.db.organizationSubscription.count({ where: { organizationId: o } })).toBe(2);

    const detail = await request(app).get(`/api/v1/platform/organizations/${o}`).set(bearer(admin)).expect(200);
    expect(detail.body.currentSubscription.id).toBe(second.id);
    expect(detail.body.effectivePlan.plan.code).toBe(p2.code);
    expect(detail.body.subscriptions.map((s: { id: string }) => s.id)).toEqual([second.id, first.id]);
    expect(detail.body.owners[0].email).toBe(owner.email);

    const logs = await deps.db.auditLog.findMany({ where: { action: 'platform.subscription_added', organizationId: o } });
    expect(logs).toHaveLength(2);
    for (const l of logs) expect(l.actorUserId).toBe(admin.id);
  });

  it('không cho dòng mới bắt đầu trước dòng mới nhất; endsAt phải sau startsAt', async () => {
    const o = await createOrg(app, owner, 'qtnt-lui');
    await addSub(o, { planId, months: 1 });
    const back = await request(app)
      .post(`/api/v1/platform/organizations/${o}/subscriptions`)
      .set(bearer(admin))
      .send({ planId, startsAt: new Date(Date.now() - 5 * DAY).toISOString(), months: 1 });
    expect(back.status).toBe(409);
    const bad = await request(app)
      .post(`/api/v1/platform/organizations/${o}/subscriptions`)
      .set(bearer(admin))
      .send({ planId, startsAt: new Date(Date.now() + DAY).toISOString(), endsAt: new Date().toISOString() });
    expect(bad.status).toBe(400);
    const missing = await request(app)
      .post(`/api/v1/platform/organizations/${randomUUID()}/subscriptions`)
      .set(bearer(admin))
      .send({ planId, months: 1 });
    expect(missing.status).toBe(404);
  });
});

describe('Tạm khoá tổ chức', () => {
  it('khoá → thành viên và chủ nhận 403 "Tổ chức đang bị tạm khoá"; mở khoá → vào lại được', async () => {
    const o = await createOrg(app, owner, 'qtnt-khoa');
    await addMember(app, owner, o, member, ['artist']);
    const noReason = await request(app).patch(`/api/v1/platform/organizations/${o}`).set(bearer(admin)).send({ status: 'SUSPENDED' });
    expect(noReason.status).toBe(400);
    await request(app)
      .patch(`/api/v1/platform/organizations/${o}`)
      .set(bearer(admin))
      .send({ status: 'SUSPENDED', reason: 'Chưa thanh toán' })
      .expect(200);
    for (const u of [owner, member]) {
      const res = await request(app).get(`/api/v1/orgs/${o}`).set(bearer(u));
      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe('Tổ chức đang bị tạm khoá');
    }
    await request(app).patch(`/api/v1/platform/organizations/${o}`).set(bearer(admin)).send({ status: 'ACTIVE' }).expect(200);
    await request(app).get(`/api/v1/orgs/${o}`).set(bearer(member)).expect(200);
    const logs = await deps.db.auditLog.findMany({ where: { organizationId: o, action: { startsWith: 'platform.org_' } }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['platform.org_suspended', 'platform.org_reactivated']);
    expect(logs[0]?.actorUserId).toBe(admin.id);
    expect(logs[0]?.data).toMatchObject({ reason: 'Chưa thanh toán' });
  });
});

describe('Gói', () => {
  it('tạo gói với giới hạn null = không giới hạn; sửa giá; trùng mã → 409; ghi nhật ký', async () => {
    const code = `goi_${randomUUID().slice(0, 8)}`;
    const created = await request(app)
      .post('/api/v1/platform/plans')
      .set(bearer(admin))
      .send({ code, name: 'Team', priceMonthly: 500000, maxStaff: 15, maxStorageMb: null });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code, priceMonthly: 500000, maxStaff: 15, maxStorageMb: null, maxCourses: null });
    const dup = await request(app).post('/api/v1/platform/plans').set(bearer(admin)).send({ code, name: 'X', priceMonthly: 0 });
    expect(dup.status).toBe(409);
    const neg = await request(app).post('/api/v1/platform/plans').set(bearer(admin)).send({ code: `${code}x`, name: 'X', priceMonthly: -1 });
    expect(neg.status).toBe(400);
    const upd = await request(app)
      .patch(`/api/v1/platform/plans/${created.body.id}`)
      .set(bearer(admin))
      .send({ priceMonthly: 650000, maxStaff: null });
    expect(upd.status).toBe(200);
    expect(upd.body).toMatchObject({ code, priceMonthly: 650000, maxStaff: null });
    const list = await request(app).get('/api/v1/platform/plans').set(bearer(admin)).expect(200);
    expect(list.body.items.some((p: { id: string }) => p.id === created.body.id)).toBe(true);
    const logs = await deps.db.auditLog.findMany({ where: { entityId: created.body.id } });
    expect(logs.map((l) => l.action).sort()).toEqual(['platform.plan_created', 'platform.plan_updated']);
  });
});

describe('Danh sách và thống kê', () => {
  it('lọc theo trạng thái hiệu lực, gói, sắp hết hạn, tìm theo email chủ; thống kê đúng số', async () => {
    const statsBefore = (await request(app).get('/api/v1/platform/stats').set(bearer(admin)).expect(200)).body;
    const price = 123457;
    const plan = await makePlan(price);
    const boss = await registerUser(app, `qtnt-sep-${randomUUID().slice(0, 4)}`);
    const active = await createOrg(app, boss, 'qtnt-hd');
    const soon = await createOrg(app, boss, 'qtnt-sap');
    const expired = await createOrg(app, boss, 'qtnt-het');
    const none = await createOrg(app, boss, 'qtnt-chua');
    const suspended = await createOrg(app, boss, 'qtnt-tk');
    await addSub(active, { planId: plan.id, startsAt: new Date(Date.now() - DAY).toISOString(), endsAt: new Date(Date.now() + 60 * DAY).toISOString() });
    await addSub(soon, { planId: plan.id, startsAt: new Date(Date.now() - DAY).toISOString(), endsAt: new Date(Date.now() + 10 * DAY).toISOString() });
    // Ghi ACTIVE nhưng đã quá hạn → hiệu lực EXPIRED, không tính doanh thu.
    await addSub(expired, { planId: plan.id, startsAt: new Date(Date.now() - 40 * DAY).toISOString(), endsAt: new Date(Date.now() - 10 * DAY).toISOString() });
    await addSub(suspended, { planId: plan.id, status: 'TRIAL', endsAt: new Date(Date.now() + 20 * DAY).toISOString() });
    await request(app).patch(`/api/v1/platform/organizations/${suspended}`).set(bearer(admin)).send({ status: 'SUSPENDED', reason: 'thử' }).expect(200);

    const list = async (q: Record<string, string>) => {
      const res = await request(app).get('/api/v1/platform/organizations').set(bearer(admin)).query({ q: boss.email, pageSize: '100', ...q }).expect(200);
      return (res.body.items as { id: string }[]).map((i) => i.id).sort();
    };
    expect(await list({})).toEqual([active, soon, expired, none, suspended].sort());
    expect(await list({ subscriptionStatus: 'EXPIRED' })).toEqual([expired]);
    expect(await list({ subscriptionStatus: 'NONE' })).toEqual([none]);
    expect(await list({ subscriptionStatus: 'ACTIVE' })).toEqual([active, soon].sort());
    expect(await list({ status: 'SUSPENDED' })).toEqual([suspended]);
    expect(await list({ planCode: plan.code })).toEqual([active, soon, expired, suspended].sort());
    expect(await list({ expiringWithinDays: '30' })).toEqual([soon, suspended].sort());
    expect(await list({ expiringWithinDays: '15' })).toEqual([soon]);
    expect(await list({ q: '100%_khong_co' })).toEqual([]);

    const page = await request(app).get('/api/v1/platform/organizations').set(bearer(admin)).query({ q: boss.email, pageSize: '2', page: '1' }).expect(200);
    expect(page.body.total).toBe(5);
    expect(page.body.items).toHaveLength(2);
    const row = (await request(app).get('/api/v1/platform/organizations').set(bearer(admin)).query({ q: boss.email, subscriptionStatus: 'EXPIRED' }).expect(200)).body.items[0];
    expect(row).toMatchObject({
      id: expired,
      owner: { email: boss.email },
      subscriptionStatus: 'EXPIRED',
      memberCount: 1,
      storageUsedBytes: 0,
      subscription: { status: 'ACTIVE', effectiveStatus: 'EXPIRED', writable: false, plan: { code: plan.code, priceMonthly: price } },
    });

    const statsAfter = (await request(app).get('/api/v1/platform/stats').set(bearer(admin)).expect(200)).body;
    const d = (path: (s: typeof statsAfter) => number) => path(statsAfter) - path(statsBefore);
    expect(d((s) => s.organizations.total)).toBe(5);
    expect(d((s) => s.organizations.byStatus.SUSPENDED)).toBe(1);
    expect(d((s) => s.organizations.byStatus.ACTIVE)).toBe(4);
    expect(d((s) => s.organizations.bySubscriptionStatus.ACTIVE)).toBe(2);
    expect(d((s) => s.organizations.bySubscriptionStatus.EXPIRED)).toBe(1);
    expect(d((s) => s.organizations.bySubscriptionStatus.NONE)).toBe(1);
    expect(d((s) => s.organizations.bySubscriptionStatus.TRIAL)).toBe(1);
    expect(d((s) => s.expiringIn30Days)).toBe(2); // soon (10 ngày) + suspended (TRIAL còn 20 ngày)
    expect(d((s) => s.projectedMonthlyRevenue)).toBe(2 * price);
    expect(statsAfter.projectedMonthlyRevenueNote).toMatch(/Dự kiến/);
  });
});

describe('Sửa nghiệm thu máy chủ lát 2', () => {
  it('S1 — PATCH gói chỉ gửi priceMonthly → 9 thông số khác GIỮ NGUYÊN; tổ chức ở giới hạn 2 nhân sự vẫn bị chặn sau khi đổi giá', async () => {
    const created = await request(app)
      .post('/api/v1/platform/plans')
      .set(bearer(admin))
      .send({ code: `s1_${randomUUID().slice(0, 8)}`, name: 'Gói nhỏ', priceMonthly: 99_000, maxStaff: 2, maxAppointmentsPerMonth: 30, maxStorageMb: 500, maxStudents: 0, maxCourses: 0, customDomain: true, features: ['web'], isActive: false, sortOrder: 7 })
      .expect(201);
    const upd = await request(app).patch(`/api/v1/platform/plans/${created.body.id}`).set(bearer(admin)).send({ priceMonthly: 129_000 }).expect(200);
    const keys = ['maxStaff', 'maxAppointmentsPerMonth', 'maxStorageMb', 'maxStudents', 'maxCourses', 'customDomain', 'features', 'isActive', 'sortOrder', 'name', 'code'];
    const changed = keys.filter((k) => JSON.stringify(created.body[k]) !== JSON.stringify(upd.body[k]));
    console.log(`[S1] PATCH {priceMonthly} → trường không gửi bị đổi: ${changed.length}/${keys.length}`);
    expect(changed).toEqual([]);
    expect(upd.body.priceMonthly).toBe(129_000);
    // Đọc lại từ database, không chỉ tin phản hồi.
    const row = await deps.db.subscriptionPlan.findUniqueOrThrow({ where: { id: created.body.id } });
    expect({ maxStaff: row.maxStaff, isActive: row.isActive, features: row.features, sortOrder: row.sortOrder }).toEqual({ maxStaff: 2, isActive: false, features: ['web'], sortOrder: 7 });
    // Nhật ký ghi trạng thái sau THẬT và đúng danh sách trường đã gửi.
    const log = await deps.db.auditLog.findFirst({ where: { entityId: created.body.id, action: 'platform.plan_updated' } });
    expect(log?.data).toMatchObject({ before: { priceMonthly: 99_000, maxStaff: 2 }, after: { priceMonthly: 129_000, maxStaff: 2, isActive: false }, changedFields: ['priceMonthly'] });
    // Mã gói không đổi được: gửi code → 400 (trước đây lặng lẽ bỏ qua). Thân rỗng → 400.
    expect((await request(app).patch(`/api/v1/platform/plans/${created.body.id}`).set(bearer(admin)).send({ code: 'doi_ma' })).status).toBe(400);
    expect((await request(app).patch(`/api/v1/platform/plans/${created.body.id}`).set(bearer(admin)).send({})).status).toBe(400);
  });

  it('M2 — người CHƯA đăng nhập / thẻ rác gọi đường /platform/ thật → 404 GIỐNG HỆT đường bịa (không phân biệt được 0/8)', async () => {
    const strip = (b: { error?: Record<string, unknown> }) => JSON.stringify(withoutRequestId(b));
    let distinct = 0;
    for (const r of platformRoutes) {
      for (const headers of [{}, { authorization: 'Bearer rac' }] as Record<string, string>[]) {
        const real = await send(r, fill(r, { organizationId: randomUUID(), planId: randomUUID() }), headers);
        const fake = await send(r, `/api/v1/platform/bia-${randomUUID()}`, headers);
        if (real.status !== 404 || real.status !== fake.status || strip(real.body) !== strip(fake.body)) distinct++;
      }
    }
    console.log(`[M2] chưa đăng nhập + thẻ rác: phân biệt được ${distinct}/${platformRoutes.length * 2}`);
    expect(distinct).toBe(0);
    // GIỮ: quản trị nền tảng vẫn dùng được.
    await request(app).get('/api/v1/platform/stats').set(bearer(admin)).expect(200);
  });

  it('N8 — thuê bao 1 năm đã trả + dòng ngắn chồng lên → 409, không ghi; cố ý cắt (replaceCurrent) → được, nhật ký ghi rõ; hẹn gia hạn nối tiếp → được', async () => {
    const o = await createOrg(app, owner, 'qtnt-chong');
    const now = Date.now();
    const year = await addSub(o, { planId, status: 'ACTIVE', startsAt: new Date(now - 10 * DAY).toISOString(), endsAt: new Date(now + 355 * DAY).toISOString() });
    const short = await request(app)
      .post(`/api/v1/platform/organizations/${o}/subscriptions`)
      .set(bearer(admin))
      .send({ planId, status: 'TRIAL', startsAt: new Date(now - 5 * DAY).toISOString(), endsAt: new Date(now - DAY).toISOString() });
    console.log(`[N8] dòng ngắn chồng lên năm đã trả → ${short.status} ${short.body.error?.message?.slice(0, 60)}`);
    expect(short.status).toBe(409);
    expect(short.body.error.details).toMatchObject({ conflictingSubscriptionId: year.id });
    expect(await deps.db.organizationSubscription.count({ where: { organizationId: o } })).toBe(1);
    // Đổi gói giữa kỳ mà dòng mới ngắn hơn: cũng 409 nếu không xác nhận cắt.
    const p2 = await makePlan(200_000);
    const mid = await request(app).post(`/api/v1/platform/organizations/${o}/subscriptions`).set(bearer(admin)).send({ planId: p2.id, months: 1 });
    expect(mid.status).toBe(409);
    // Nâng gói kéo dài hơn kỳ cũ: được (dòng mới đè từ hôm nay).
    const up = await addSub(o, { planId: p2.id, months: 13 });
    // Hẹn gia hạn NỐI TIẾP (bắt đầu đúng ngày hết hạn): được.
    const upRow = await deps.db.organizationSubscription.findUniqueOrThrow({ where: { id: up.id } });
    await addSub(o, { planId, startsAt: upRow.endsAt?.toISOString(), months: 12 });
    // Cố ý cắt: replaceCurrent → được, nhật ký ghi cutShort.
    const o2 = await createOrg(app, owner, 'qtnt-cat');
    await addSub(o2, { planId, months: 12 });
    const cut = await addSub(o2, { planId: p2.id, months: 1, replaceCurrent: true, note: 'Khách xin đổi gói, hoàn tiền phần còn lại' });
    const log = await deps.db.auditLog.findFirst({ where: { entityId: cut.id, action: 'platform.subscription_added' } });
    expect(log?.data).toMatchObject({ supersedes: { cutShort: true } });
    // Ghi dòng HUỶ (chủ ý chấm dứt) không bị chặn.
    await addSub(o2, { planId, status: 'CANCELLED', note: 'Chấm dứt' });
  });

  it('N9 — doanh thu dự kiến KHÔNG cộng tổ chức đang bị tạm khoá; ghi chú nói rõ', async () => {
    const o = await createOrg(app, owner, 'qtnt-dt');
    const p = await makePlan(777_777);
    await addSub(o, { planId: p.id, months: 1 });
    const s1 = (await request(app).get('/api/v1/platform/stats').set(bearer(admin)).expect(200)).body;
    await request(app).patch(`/api/v1/platform/organizations/${o}`).set(bearer(admin)).send({ status: 'SUSPENDED', reason: 'thử' }).expect(200);
    const s2 = (await request(app).get('/api/v1/platform/stats').set(bearer(admin)).expect(200)).body;
    console.log(`[N9] doanh thu dự kiến trước khoá ${s1.projectedMonthlyRevenue}, sau khoá ${s2.projectedMonthlyRevenue}`);
    expect(s1.projectedMonthlyRevenue - s2.projectedMonthlyRevenue).toBe(777_777);
    expect(s2.projectedMonthlyRevenueNote).toMatch(/tạm khoá/);
  });

  it('GIỮ (Q5) — ô tìm kiếm coi % và _ là chữ thường, không phải ký tự đại diện', async () => {
    const u = randomUUID().slice(0, 6);
    const boss = await registerUser(app, `qtnt-q5-${u}`);
    const o = await createOrg(app, boss, `qtnt-q5-${u}`);
    await deps.db.organization.update({ where: { id: o }, data: { name: `Studio 50AXgiam-${u}` } });
    const find = async (q: string) =>
      ((await request(app).get('/api/v1/platform/organizations').set(bearer(admin)).query({ q, pageSize: '100' }).expect(200)).body.items as { id: string }[]).map((i) => i.id);
    expect(await find(`50AXgiam-${u}`)).toEqual([o]);
    // Không thoát ký tự đại diện thì "%" khớp "A", "_" khớp "X" → tìm ra nhầm.
    expect(await find(`50%Xgiam-${u}`)).toEqual([]);
    expect(await find(`50A_giam-${u}`)).toEqual([]);
  });
});
