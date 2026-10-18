// Hồi quy cho biên bản nghiệm thu mốc 2 (thợ chấm độc lập, 18/10/2026). Mỗi ca mang mã lỗi trong biên bản.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let owner: TestUser, admin: TestUser, manager: TestUser, hr: TestUser, auditor: TestUser;
let orgId: string;
let adminMid: string, auditorMid: string;

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'nt-chu');
  admin = await registerUser(app, 'nt-qt');
  manager = await registerUser(app, 'nt-ql');
  hr = await registerUser(app, 'nt-ns');
  auditor = await registerUser(app, 'nt-kt');
  orgId = await createOrg(app, owner, 'nt-moc2');
  adminMid = await addMember(app, owner, orgId, admin, ['admin']);
  await addMember(app, owner, orgId, manager, ['manager']);
  // Vai trò tuỳ chỉnh "Nhân sự": được cho rời/đổi nhân sự nhưng không có quyền xem nhật ký.
  await request(app).post(`/api/v1/orgs/${orgId}/roles`).set(bearer(owner))
    .send({ key: 'nhan_su', name: 'Nhân sự', permissions: ['org.read', 'members.read', 'members.update', 'members.remove', 'roles.read', 'roles.manage'] })
    .expect(201);
  await addMember(app, owner, orgId, hr, ['nhan_su']);
  await request(app).post(`/api/v1/orgs/${orgId}/roles`).set(bearer(owner))
    .send({ key: 'ke_toan_truong', name: 'Kế toán trưởng', permissions: ['org.read', 'audit.read'] })
    .expect(201);
  auditorMid = await addMember(app, owner, orgId, auditor, ['ke_toan_truong']);
});
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('L1 — không đụng được người có quyền cao hơn mình', () => {
  it('quản lý không hạ được quản trị xuống thợ', async () => {
    const res = await request(app).patch(`/api/v1/orgs/${orgId}/members/${adminMid}`).set(bearer(manager)).send({ roleKeys: ['artist'] });
    expect(res.status).toBe(403);
  });
  it('quản lý không tạm khoá được quản trị', async () => {
    const res = await request(app).patch(`/api/v1/orgs/${orgId}/members/${adminMid}`).set(bearer(manager)).send({ status: 'SUSPENDED' });
    expect(res.status).toBe(403);
  });
  it('vai trò "Nhân sự" không cho quản trị rời tổ chức được', async () => {
    const res = await request(app).delete(`/api/v1/orgs/${orgId}/members/${adminMid}`).set(bearer(hr));
    expect(res.status).toBe(403);
  });
  it('vai trò "Nhân sự" không đụng được người giữ quyền nhật ký mà mình không có', async () => {
    const res = await request(app).patch(`/api/v1/orgs/${orgId}/members/${auditorMid}`).set(bearer(hr)).send({ status: 'SUSPENDED' });
    expect(res.status).toBe(403);
  });
  it('GIỮ: quản trị vẫn đổi được quản lý (có đủ quyền của quản lý)', async () => {
    const members = await request(app).get(`/api/v1/orgs/${orgId}/members?pageSize=100`).set(bearer(owner)).expect(200);
    const mgr = members.body.items.find((m: { user: { id: string } }) => m.user.id === manager.id);
    const res = await request(app).patch(`/api/v1/orgs/${orgId}/members/${mgr.id}`).set(bearer(admin)).send({ roleKeys: ['manager', 'artist'] });
    expect(res.status).toBe(200);
  });
});

describe('L2 — không tước được quyền khỏi vai trò mạnh hơn mình', () => {
  it('"Nhân sự" không bỏ được quyền xem nhật ký khỏi "Kế toán trưởng"', async () => {
    const roles = await request(app).get(`/api/v1/orgs/${orgId}/roles`).set(bearer(owner)).expect(200);
    const kt = roles.body.items.find((r: { key: string }) => r.key === 'ke_toan_truong');
    const res = await request(app).patch(`/api/v1/orgs/${orgId}/roles/${kt.id}`).set(bearer(hr)).send({ permissions: ['org.read'] });
    expect(res.status).toBe(403);
    const after = await deps.db.role.findUniqueOrThrow({ where: { id: kt.id } });
    expect(after.permissions).toContain('audit.read');
  });
});

describe('L3 — quyền tra lại sau khi khoá tổ chức', () => {
  it('người bị hạ quyền giữa chừng không trao quyền được nữa (đua 15 lượt)', async () => {
    const c = await registerUser(app, 'nt-dua');
    let accepted = 0;
    for (let i = 0; i < 15; i++) {
      const b = await registerUser(app, `nt-b${i}`);
      const bMid = await addMember(app, owner, orgId, b, ['admin']);
      const cMid = await addMember(app, owner, orgId, c, ['artist']).catch(async () => {
        const m = await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId, userId: c.id } });
        await request(app).patch(`/api/v1/orgs/${orgId}/members/${m.id}`).set(bearer(owner)).send({ roleKeys: ['artist'] }).expect(200);
        return m.id;
      });
      const [demote, grant] = await Promise.all([
        request(app).patch(`/api/v1/orgs/${orgId}/members/${bMid}`).set(bearer(owner)).send({ roleKeys: ['artist'] }),
        request(app).patch(`/api/v1/orgs/${orgId}/members/${cMid}`).set(bearer(b)).send({ roleKeys: ['admin'] }),
      ]);
      expect(demote.status).toBe(200);
      // Nếu lệnh trao quyền thắng thì nó phải chạy TRƯỚC lệnh hạ (khi B còn là quản trị) — hợp lệ.
      // Không được có trường hợp B đã bị hạ mà lệnh của B vẫn được chấp nhận.
      if (grant.status === 200) {
        accepted++;
        const logs = await deps.db.auditLog.findMany({
          where: { organizationId: orgId, entityId: { in: [bMid, cMid] }, action: 'member.updated' },
          orderBy: { createdAt: 'desc' },
          take: 2,
        });
        const grantLog = logs.find((l) => l.entityId === cMid);
        const demoteLog = logs.find((l) => l.entityId === bMid);
        expect(grantLog && demoteLog && grantLog.createdAt <= demoteLog.createdAt).toBe(true);
      } else {
        expect(grant.status).toBe(403);
      }
    }
    console.log(`[L3] lệnh của người đang bị hạ được chấp nhận (đúng thứ tự trước khi hạ): ${accepted}/15`);
  });
});

describe('L6, L9, L10, L11 — lỗi nhẹ', () => {
  it('L6: ký tự \\u0000 trong tên → 400, không phải 500', async () => {
    const res = await request(app).patch(`/api/v1/orgs/${orgId}`).set(bearer(owner))
      .set('content-type', 'application/json').send('{"name":"a\\u0000b"}');
    expect(res.status).toBe(400);
  });
  it('L6: thân yêu cầu > 100 KB → 400, không phải 500', async () => {
    const res = await request(app).patch(`/api/v1/orgs/${orgId}`).set(bearer(owner)).send({ name: 'x'.repeat(120_000) });
    expect(res.status).toBe(400);
  });
  it('L9: mật khẩu quá 72 byte bị từ chối khi đăng ký', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'dai@thu.local', password: 'ệ'.repeat(30), fullName: 'X' });
    expect(res.status).toBe(400);
  });
  it('L10: dùng lại thẻ đã đăng xuất không bị ghi là "phát hiện đánh cắp"', async () => {
    const u = await registerUser(app, 'nt-thoat');
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: u.refreshToken }).expect(204);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    const theft = await deps.db.auditLog.count({ where: { actorUserId: u.id, action: 'auth.refresh_reuse_detected' } });
    const logout = await deps.db.auditLog.count({ where: { actorUserId: u.id, action: 'auth.logout' } });
    expect({ theft, logout }).toEqual({ theft: 0, logout: 1 });
  });
  it('L11: đăng nhập đúng và sai đều có nhật ký', async () => {
    const u = await registerUser(app, 'nt-dn');
    await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'sai-mat-khau-9' }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
    const actions = (await deps.db.auditLog.findMany({ where: { actorUserId: u.id } })).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['auth.login_failed', 'auth.login']));
  });
  it('chủ có tài khoản bị khoá không được tính là chủ đang hoạt động', async () => {
    const o2 = await registerUser(app, 'nt-chu2');
    const org2 = await createOrg(app, o2, 'nt-khoa-chu');
    const o3 = await registerUser(app, 'nt-chu3');
    const m3 = await addMember(app, o2, org2, o3, ['owner']);
    await deps.db.user.update({ where: { id: o2.id }, data: { status: 'DISABLED' } });
    // o2 bị khoá → o3 là chủ hoạt động duy nhất → o3 không tự rời được.
    const res = await request(app).delete(`/api/v1/orgs/${org2}/members/${m3}`).set(bearer(o3));
    expect(res.status).toBe(409);
  });
});
