// BẰNG CHỨNG CỬA GÁC KHÔNG MÙ: cài từng kiểu lỗi vào bảng route, cửa gác phải chuyển đỏ đúng phép kiểm.
// (Dựa trên bài "cửa gác mù" của thợ chấm mốc 2 — lỗi L4.)
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ALL_ROUTES } from '../src/app';
import { defineRoute, mustOrg, type AnyRoute } from '../src/http/route';
import { AppError } from '../src/lib/errors';
import { buildGateFixture, runIsolationGate, type GateReport } from './gate';
import { makeApp, makeDeps } from './helpers';
import { SAMPLES } from './tenant-isolation.test';
import { createApp } from '../src/app';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

function replace(m: AnyRoute): AnyRoute[] {
  const found = ALL_ROUTES.some((r) => r.method === m.method && r.path === m.path);
  if (!found) throw new Error(`Không có route ${m.method} ${m.path} để thay`);
  return ALL_ROUTES.map((r) => (r.method === m.method && r.path === m.path ? m : r));
}

async function gateOn(routes: AnyRoute[]): Promise<GateReport> {
  const app = createApp(deps, routes);
  const fx = await buildGateFixture(makeApp(deps));
  return runIsolationGate(app, routes, fx, SAMPLES);
}

describe('cửa gác chuyển đỏ với từng kiểu lỗi', () => {
  it('Đột biến 1 — tra vai trò chỉ theo id, quên lọc tổ chức → phép crossId đỏ', async () => {
    const mutant = defineRoute({
      method: 'patch',
      path: '/orgs/:orgId/roles/:roleId',
      scope: 'org',
      permission: 'roles.manage',
      tag: 't',
      summary: 'ĐỘT BIẾN',
      params: z.object({ orgId: z.uuid(), roleId: z.uuid() }),
      body: z.object({ name: z.string().min(1) }),
      handler: async ({ deps: d, params, body, org }) => {
        mustOrg(org);
        const target = await d.db.role.findFirst({ where: { id: params.roleId } });
        if (!target) throw new AppError('NOT_FOUND', 'Không tìm thấy vai trò');
        return { body: await d.db.role.update({ where: { id: target.id }, data: { name: body.name } }) };
      },
    });
    const r = await gateOn(replace(mutant));
    console.log(`[đột biến 1] crossId vi phạm: ${r.crossId.violations.length}/${r.crossId.total}`);
    expect(r.crossId.violations.length).toBeGreaterThan(0);
  });

  it('Đột biến 2 — đường dưới /orgs/:orgId khai scope "auth" → defineRoute từ chối ngay', () => {
    expect(() =>
      defineRoute({ method: 'get', path: '/orgs/:orgId/xuat', scope: 'auth', tag: 't', summary: 's', handler: async () => ({}) }),
    ).toThrow(/không khai scope "org"/);
  });

  it('Đột biến 3 — xử lý hỏng hẳn (luôn 404) → phép keep đỏ', async () => {
    const mutant = defineRoute({
      method: 'get',
      path: '/orgs/:orgId/members',
      scope: 'org',
      permission: 'members.read',
      tag: 't',
      summary: 'ĐỘT BIẾN',
      handler: async () => {
        throw new AppError('NOT_FOUND', 'Không tìm thấy nhân sự');
      },
    });
    const r = await gateOn(replace(mutant));
    console.log(`[đột biến 3] keep vi phạm: ${r.keep.violations.length}/${r.keep.total}`);
    expect(r.keep.violations.length).toBeGreaterThan(0);
  });

  it('Đột biến 4 — danh sách quên lọc tổ chức (trả nhân sự mọi tổ chức) → phép leak đỏ', async () => {
    const mutant = defineRoute({
      method: 'get',
      path: '/orgs/:orgId/members',
      scope: 'org',
      permission: 'members.read',
      tag: 't',
      summary: 'ĐỘT BIẾN',
      handler: async ({ deps: d }) => ({
        body: await d.db.membership.findMany({ select: { id: true, user: { select: { email: true } } } }),
      }),
    });
    const r = await gateOn(replace(mutant));
    console.log(`[đột biến 4] leak vi phạm: ${r.leak.violations.length}/${r.leak.total}`);
    expect(r.leak.violations.length).toBeGreaterThan(0);
  });

  it('Đột biến 5 — xử lý ném lỗi 500 khi gửi thân rỗng → phép keep đỏ', async () => {
    const mutant = defineRoute({
      method: 'patch',
      path: '/orgs/:orgId',
      scope: 'org',
      permission: 'org.update',
      tag: 't',
      summary: 'ĐỘT BIẾN',
      handler: async () => {
        throw new Error('hỏng');
      },
    });
    const r = await gateOn(replace(mutant));
    expect(r.keep.violations.some((v) => v.includes('PATCH /orgs/:orgId →'))).toBe(true);
  });
});
