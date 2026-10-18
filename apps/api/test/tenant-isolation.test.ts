// CỬA GÁC: mọi đường API thuộc tổ chức phải chặn người ngoài và người thiếu quyền.
// Danh sách đường lấy thẳng từ bảng route của app — thêm đường mới là tự vào diện kiểm tra.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_ROUTES } from '../src/app';
import type { AnyRoute } from '../src/http/route';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let ownerA: TestUser;
let ownerB: TestUser;
let noPermsA: TestUser;
let orgA: string;
let ids: Record<string, string>;

const orgRoutes = ALL_ROUTES.filter((r) => r.scope === 'org');
const authRoutes = ALL_ROUTES.filter((r) => r.scope === 'auth');

function fill(route: AnyRoute): string {
  return `/api/v1${route.path.replace(/:([A-Za-z]+)/g, (_m, name: string) => {
    const v = ids[name];
    if (!v) throw new Error(`Bài thử chưa có giá trị cho tham số :${name} của ${route.path}`);
    return v;
  })}`;
}

function call(route: AnyRoute, headers: Record<string, string>) {
  const req = request(app)[route.method](fill(route));
  for (const [k, v] of Object.entries(headers)) req.set(k, v);
  return route.method === 'get' || route.method === 'delete' ? req : req.send({});
}

beforeAll(async () => {
  app = makeApp(deps);
  ownerA = await registerUser(app, 'chu-a');
  ownerB = await registerUser(app, 'chu-b');
  noPermsA = await registerUser(app, 'khong-quyen-a');
  orgA = await createOrg(app, ownerA, 'to-chuc-a');
  await createOrg(app, ownerB, 'to-chuc-b');
  // Vai trò rỗng: là thành viên nhưng không có quyền nào.
  await request(app).post(`/api/v1/orgs/${orgA}/roles`).set(bearer(ownerA)).send({ key: 'rong', name: 'Rỗng', permissions: [] }).expect(201);
  const memberId = await addMember(app, ownerA, orgA, noPermsA, ['rong']);
  const roles = await request(app).get(`/api/v1/orgs/${orgA}/roles`).set(bearer(ownerA)).expect(200);
  const roleId = roles.body.items.find((r: { key: string }) => r.key === 'rong').id as string;
  ids = { orgId: orgA, membershipId: memberId, roleId };
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('cửa gác cách ly tổ chức', () => {
  it('có đường thuộc tổ chức để kiểm (mẫu số khác 0)', () => {
    expect(orgRoutes.length).toBeGreaterThan(0);
  });

  it('BẮT: người của tổ chức B gọi vào tổ chức A → 404, không lộ tổ chức có tồn tại', async () => {
    const leaks: string[] = [];
    for (const r of orgRoutes) {
      const res = await call(r, bearer(ownerB));
      if (res.status !== 404) leaks.push(`${r.method.toUpperCase()} ${r.path} → ${res.status}`);
    }
    console.log(`[cửa gác] người ngoài bị chặn: ${orgRoutes.length - leaks.length}/${orgRoutes.length} đường`);
    expect(leaks).toEqual([]);
  });

  it('BẮT: thành viên A không có quyền → 403 ở mọi đường', async () => {
    const leaks: string[] = [];
    for (const r of orgRoutes) {
      const res = await call(r, bearer(noPermsA));
      if (res.status !== 403) leaks.push(`${r.method.toUpperCase()} ${r.path} → ${res.status}`);
    }
    console.log(`[cửa gác] thiếu quyền bị chặn: ${orgRoutes.length - leaks.length}/${orgRoutes.length} đường`);
    expect(leaks).toEqual([]);
  });

  it('BẮT: không có thẻ đăng nhập → 401 ở mọi đường cần đăng nhập', async () => {
    const targets = [...orgRoutes, ...authRoutes];
    const leaks: string[] = [];
    for (const r of targets) {
      const res = await call(r, {});
      if (res.status !== 401) leaks.push(`${r.method.toUpperCase()} ${r.path} → ${res.status}`);
    }
    console.log(`[cửa gác] chưa đăng nhập bị chặn: ${targets.length - leaks.length}/${targets.length} đường`);
    expect(leaks).toEqual([]);
  });

  it('BẮT: thẻ giả ký bằng khoá khác → 401', async () => {
    const forged = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sai-chu-ky';
    const res = await request(app).get(`/api/v1/orgs/${orgA}`).set('authorization', forged);
    expect(res.status).toBe(401);
  });

  it('GIỮ: chủ tổ chức A đi qua cửa ở mọi đường (không bị 401/403/404-tổ chức)', async () => {
    const blocked: string[] = [];
    for (const r of orgRoutes) {
      const res = await call(r, bearer(ownerA));
      const orgNotFound = res.status === 404 && res.body?.error?.message === 'Không tìm thấy tổ chức';
      if (res.status === 401 || res.status === 403 || orgNotFound) {
        blocked.push(`${r.method.toUpperCase()} ${r.path} → ${res.status}`);
      }
    }
    console.log(`[cửa gác] chủ đi qua: ${orgRoutes.length - blocked.length}/${orgRoutes.length} đường`);
    expect(blocked).toEqual([]);
  });
});
