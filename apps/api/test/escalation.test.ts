import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let owner: TestUser;
let admin: TestUser;
let manager: TestUser;
let artist: TestUser;
let orgId: string;
let ownerMemberId: string;
let managerMemberId: string;
let artistMemberId: string;

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'chu');
  admin = await registerUser(app, 'quan-tri');
  manager = await registerUser(app, 'quan-ly');
  artist = await registerUser(app, 'tho');
  orgId = await createOrg(app, owner, 'nang-quyen');
  await addMember(app, owner, orgId, admin, ['admin']);
  managerMemberId = await addMember(app, owner, orgId, manager, ['manager']);
  artistMemberId = await addMember(app, owner, orgId, artist, ['artist']);
  const members = await request(app).get(`/api/v1/orgs/${orgId}/members`).set(bearer(owner)).expect(200);
  ownerMemberId = members.body.items.find((m: { user: { id: string } }) => m.user.id === owner.id).id;
});
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('chống tự nâng quyền', () => {
  it('quản lý không tự nâng mình lên quản trị', async () => {
    const res = await request(app)
      .patch(`/api/v1/orgs/${orgId}/members/${managerMemberId}`)
      .set(bearer(manager))
      .send({ roleKeys: ['admin'] });
    expect(res.status).toBe(403);
    expect(res.body.error.details.missing).toContain('roles.manage');
  });

  it('quản lý không trao vai trò quản trị cho người khác', async () => {
    const res = await request(app)
      .patch(`/api/v1/orgs/${orgId}/members/${artistMemberId}`)
      .set(bearer(manager))
      .send({ roleKeys: ['admin'] });
    expect(res.status).toBe(403);
  });

  it('quản lý vẫn đổi được vai trò trong phạm vi quyền mình (vế GIỮ)', async () => {
    const res = await request(app)
      .patch(`/api/v1/orgs/${orgId}/members/${artistMemberId}`)
      .set(bearer(manager))
      .send({ roleKeys: ['artist', 'assistant'] });
    expect(res.status).toBe(200);
    expect(res.body.roles.map((r: { key: string }) => r.key).sort()).toEqual(['artist', 'assistant']);
  });

  it('quản trị (không phải chủ) không đụng được vào chủ', async () => {
    const res = await request(app)
      .patch(`/api/v1/orgs/${orgId}/members/${ownerMemberId}`)
      .set(bearer(admin))
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(403);
  });

  it('quản trị không trao được vai trò chủ', async () => {
    const res = await request(app)
      .patch(`/api/v1/orgs/${orgId}/members/${artistMemberId}`)
      .set(bearer(admin))
      .send({ roleKeys: ['owner'] });
    expect(res.status).toBe(403);
  });

  it('chủ cuối cùng không tự rời hay tự hạ quyền được', async () => {
    const leave = await request(app).delete(`/api/v1/orgs/${orgId}/members/${ownerMemberId}`).set(bearer(owner));
    expect(leave.status).toBe(409);
    const demote = await request(app)
      .patch(`/api/v1/orgs/${orgId}/members/${ownerMemberId}`)
      .set(bearer(owner))
      .send({ roleKeys: ['admin'] });
    expect(demote.status).toBe(409);
  });

  it('vai trò tuỳ chỉnh có quyền lạ bị từ chối', async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgId}/roles`)
      .set(bearer(owner))
      .send({ key: 'la', name: 'Lạ', permissions: ['finance.god_mode'] });
    expect(res.status).toBe(400);
    expect(res.body.error.details.unknown).toEqual(['finance.god_mode']);
  });

  it('không lấy được mã vai trò hệ thống làm vai trò tuỳ chỉnh', async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgId}/roles`)
      .set(bearer(owner))
      .send({ key: 'owner', name: 'Chủ giả', permissions: [] });
    expect(res.status).toBe(409);
  });

  it('vai trò hệ thống không sửa được', async () => {
    const roles = await request(app).get(`/api/v1/orgs/${orgId}/roles`).set(bearer(owner)).expect(200);
    const artistRole = roles.body.items.find((r: { key: string }) => r.key === 'artist');
    const res = await request(app)
      .patch(`/api/v1/orgs/${orgId}/roles/${artistRole.id}`)
      .set(bearer(owner))
      .send({ permissions: ['org.read', 'org.update'] });
    expect(res.status).toBe(403);
  });

  it('nhân sự bị tạm khoá mất quyền ngay ở yêu cầu kế tiếp', async () => {
    await request(app).get(`/api/v1/orgs/${orgId}`).set(bearer(artist)).expect(200);
    await request(app)
      .patch(`/api/v1/orgs/${orgId}/members/${artistMemberId}`)
      .set(bearer(owner))
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await request(app).get(`/api/v1/orgs/${orgId}`).set(bearer(artist)).expect(404);
  });

  it('mọi thay đổi trên đều để lại nhật ký', async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgId}/audit-logs?pageSize=100`).set(bearer(owner)).expect(200);
    const actions = res.body.items.map((i: { action: string }) => i.action);
    expect(actions).toContain('org.created');
    expect(actions).toContain('member.added');
    expect(actions).toContain('member.updated');
  });
});

describe('chốt chặn trong database (lớp thứ hai, không qua API)', () => {
  it('không gán được vai trò của tổ chức khác, kể cả ghi thẳng vào database', async () => {
    const other = await registerUser(app, 'chu-khac');
    const otherOrg = await createOrg(app, other, 'khac');
    const foreignRole = await deps.db.role.findFirstOrThrow({ where: { organizationId: otherOrg, key: 'owner' } });
    await expect(
      deps.db.membershipRole.create({
        data: { organizationId: orgId, membershipId: artistMemberId, roleId: foreignRole.id },
      }),
    ).rejects.toThrow();
  });

  it('nhật ký không sửa, không xoá được', async () => {
    const row = await deps.db.auditLog.findFirstOrThrow({ where: { organizationId: orgId } });
    await expect(deps.db.auditLog.update({ where: { id: row.id }, data: { action: 'sua-len' } })).rejects.toThrow(/chỉ được ghi thêm/);
    await expect(deps.db.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/chỉ được ghi thêm/);
  });

  it('email viết hoa bị database từ chối', async () => {
    await expect(
      deps.db.user.create({ data: { email: 'VietHoa@thu.local', passwordHash: 'x', fullName: 'X' } }),
    ).rejects.toThrow();
  });

  it('không xoá được tổ chức còn dữ liệu (không có xoá dây chuyền)', async () => {
    await expect(deps.db.organization.delete({ where: { id: orgId } })).rejects.toThrow();
  });
});
