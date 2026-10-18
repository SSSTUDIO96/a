// THỢ CHẤM: chứng minh cửa gác test/tenant-isolation.test.ts KHÔNG bắt được ba kiểu lỗi.
// Cách làm: chạy ĐÚNG logic của cửa gác (chép nguyên hàm fill/call và 4 phép kiểm) lên một bảng route
// có cài sẵn lỗi ("route đột biến"). Nếu cửa gác vẫn xanh trong khi lỗi khai thác được → cửa gác mù với kiểu lỗi đó.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { createApp, ALL_ROUTES } from '../src/app';
import { defineRoute, mustOrg, mustUser, type AnyRoute } from '../src/http/route';
import { AppError } from '../src/lib/errors';
import { addMember, bearer, createOrg, makeDeps, registerUser, type TestUser } from '../test/helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

// Đột biến 1: sửa vai trò nhưng tra vai trò CHỈ theo id, quên điều kiện organizationId (lỗi IDOR kinh điển).
const mutantPatchRole = defineRoute({
  method: 'patch',
  path: '/orgs/:orgId/roles/:roleId',
  scope: 'org',
  permission: 'roles.manage',
  tag: 'Vai trò',
  summary: 'ĐỘT BIẾN',
  params: z.object({ orgId: z.uuid(), roleId: z.uuid() }),
  body: z.object({ name: z.string().min(1) }),
  handler: async ({ deps: d, params, body, org }) => {
    mustOrg(org);
    const target = await d.db.role.findFirst({ where: { id: params.roleId } }); // ← thiếu organizationId
    if (!target) throw new AppError('NOT_FOUND', 'Không tìm thấy vai trò');
    const updated = await d.db.role.update({ where: { id: target.id }, data: { name: body.name } });
    return { body: updated };
  },
});

// Đột biến 2: đường nằm dưới /orgs/:orgId nhưng khai scope "auth" — defineRoute cho qua, cửa gác lọc theo scope nên bỏ sót.
const mutantAuthUnderOrg = defineRoute({
  method: 'get',
  path: '/orgs/:orgId/xuat-danh-sach',
  scope: 'auth',
  tag: 'Nhân sự',
  summary: 'ĐỘT BIẾN',
  handler: async ({ deps: d, req, userId }) => {
    mustUser(userId);
    const rows = await d.db.membership.findMany({ where: { organizationId: String(req.params.orgId) }, select: { user: { select: { email: true } } } });
    return { body: rows };
  },
});

// Đột biến 3: handler hỏng hoàn toàn (luôn trả "không tìm thấy nhân sự") — vế GIỮ vẫn tính là "đi qua".
const mutantBroken = defineRoute({
  method: 'get',
  path: '/orgs/:orgId/members',
  scope: 'org',
  permission: 'members.read',
  tag: 'Nhân sự',
  summary: 'ĐỘT BIẾN',
  handler: async () => {
    throw new AppError('NOT_FOUND', 'Không tìm thấy nhân sự');
  },
});

function replace(routes: AnyRoute[], m: AnyRoute): AnyRoute[] {
  return routes.map((r) => (r.method === m.method && r.path === m.path ? m : r));
}
const MUTANT_ROUTES = [...replace(replace(ALL_ROUTES, mutantPatchRole), mutantBroken), mutantAuthUnderOrg];

// ===== Chép nguyên logic cửa gác =====
type App = ReturnType<typeof createApp>;
let app: App;
let ownerA: TestUser, ownerB: TestUser, noPermsA: TestUser;
let orgA: string, orgB: string;
let ids: Record<string, string>;
const orgRoutes = MUTANT_ROUTES.filter((r) => r.scope === 'org');
const authRoutes = MUTANT_ROUTES.filter((r) => r.scope === 'auth');
function fill(route: AnyRoute): string {
  return `/api/v1${route.path.replace(/:([A-Za-z]+)/g, (_m, name: string) => ids[name]!)}`;
}
function call(route: AnyRoute, headers: Record<string, string>) {
  const req = request(app)[route.method](fill(route));
  for (const [k, v] of Object.entries(headers)) req.set(k, v);
  return route.method === 'get' || route.method === 'delete' ? req : req.send({});
}

beforeAll(async () => {
  app = createApp(deps, MUTANT_ROUTES);
  ownerA = await registerUser(app, 'mu-chu-a');
  ownerB = await registerUser(app, 'mu-chu-b');
  noPermsA = await registerUser(app, 'mu-khong-quyen');
  orgA = await createOrg(app, ownerA, 'mu-a');
  orgB = await createOrg(app, ownerB, 'mu-b');
  await request(app).post(`/api/v1/orgs/${orgA}/roles`).set(bearer(ownerA)).send({ key: 'rong', name: 'Rỗng', permissions: [] }).expect(201);
  const memberId = await addMember(app, ownerA, orgA, noPermsA, ['rong']);
  const roles = await request(app).get(`/api/v1/orgs/${orgA}/roles`).set(bearer(ownerA)).expect(200);
  const roleId = roles.body.items.find((r: { key: string }) => r.key === 'rong').id as string;
  ids = { orgId: orgA, membershipId: memberId, roleId };
});

describe('cửa gác chạy trên bảng route có cài lỗi', () => {
  it('cửa gác vẫn XANH ở cả 4 phép kiểm', async () => {
    const outsider: string[] = [], noperm: string[] = [], unauth: string[] = [], keep: string[] = [];
    // Đúng thứ tự của cửa gác gốc: người ngoài → thiếu quyền → chưa đăng nhập → chủ.
    for (const r of orgRoutes) {
      const a = await call(r, bearer(ownerB));
      if (a.status !== 404) outsider.push(r.path);
    }
    for (const r of orgRoutes) {
      const b = await call(r, bearer(noPermsA));
      if (b.status !== 403) noperm.push(r.path);
    }
    for (const r of [...orgRoutes, ...authRoutes]) {
      const c = await call(r, {});
      if (c.status !== 401) unauth.push(r.path);
    }
    for (const r of orgRoutes) {
      const d = await call(r, bearer(ownerA));
      const orgNotFound = d.status === 404 && d.body?.error?.message === 'Không tìm thấy tổ chức';
      if (d.status === 401 || d.status === 403 || orgNotFound) keep.push(r.path);
    }
    expect({ outsider, noperm, unauth, keep }).toEqual({ outsider: [], noperm: [], unauth: [], keep: [] });
  });

  it('…trong khi Đột biến 1 cho chủ B sửa vai trò của tổ chức A (qua orgId của B)', async () => {
    const res = await request(app).patch(`/api/v1/orgs/${orgB}/roles/${ids.roleId}`).set(bearer(ownerB)).send({ name: 'B đã sửa' });
    expect(res.status).toBe(200);
    const row = await deps.db.role.findUniqueOrThrow({ where: { id: ids.roleId! } });
    expect(row.organizationId).toBe(orgA);
    expect(row.name).toBe('B đã sửa');
  });

  it('…và Đột biến 2 cho người ngoài lấy email toàn bộ nhân sự tổ chức A', async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgA}/xuat-danh-sach`).set(bearer(ownerB));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(ownerA.email);
  });

  it('…và Đột biến 3 (danh sách nhân sự hỏng hẳn) vẫn được tính là "chủ đi qua"', async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgA}/members`).set(bearer(ownerA));
    expect(res.status).toBe(404);
  });
});
