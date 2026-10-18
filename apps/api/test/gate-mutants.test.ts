// BẰNG CHỨNG CỬA GÁC KHÔNG MÙ: cài từng kiểu lỗi vào bảng route, cửa gác phải chuyển đỏ đúng phép kiểm.
// (Dựa trên bài "cửa gác mù" của thợ chấm mốc 2 — lỗi L4.)
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ALL_ROUTES } from '../src/app';
import { defineRoute, mustOrg, type AnyRoute } from '../src/http/route';
import { AppError } from '../src/lib/errors';
import { buildGateFixture, runIsolationGate, type GateReport } from './gate';
import { makeApp, makeDeps } from './helpers';
import { REF_SAMPLES, SAMPLES } from './gate-samples';
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
  return runIsolationGate(app, routes, fx, SAMPLES, REF_SAMPLES);
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

  // Ba đột biến dưới đây: mã của tổ chức khác nằm trong THÂN hoặc THAM SỐ LỌC (biên bản lát 1, lỗi T3).
  it('Đột biến 6 — xem trước hợp đồng tra khách chỉ theo id (lộ tên khách studio khác) → phép crossRef đỏ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'post' && r.path === '/orgs/:orgId/contracts/quote');
    if (!original) throw new Error('Không có route quote');
    const mutant = { ...original, handler: async (ctx: Parameters<typeof original.handler>[0]) => {
      const body = ctx.body as { customerId?: string };
      if (body.customerId) {
        const c = await ctx.deps.db.customer.findFirst({ where: { id: body.customerId } });
        if (c) return { body: { customer: { id: c.id, fullName: c.fullName } } };
      }
      return original.handler(ctx);
    } } as AnyRoute;
    const r = await gateOn(replace(mutant));
    console.log(`[đột biến 6] crossRef vi phạm: ${r.crossRef.violations.length}/${r.crossRef.total}`);
    expect(r.crossRef.violations.some((v) => v.startsWith('POST /orgs/:orgId/contracts/quote [customerId'))).toBe(true);
  });

  it('Đột biến 7 — lọc danh sách hợp đồng theo customerId mà quên điều kiện tổ chức → phép crossRef đỏ', async () => {
    const mutant = defineRoute({
      method: 'get',
      path: '/orgs/:orgId/contracts',
      scope: 'org',
      permission: 'contracts.read',
      tag: 't',
      summary: 'ĐỘT BIẾN',
      query: z.object({ customerId: z.uuid().optional() }),
      handler: async ({ deps: d, query, org }) => {
        const o = mustOrg(org);
        const where = query.customerId ? { customerId: query.customerId } : { organizationId: o.id };
        return { body: { items: await d.db.contract.findMany({ where, select: { id: true, code: true } }) } };
      },
    });
    const r = await gateOn(replace(mutant));
    console.log(`[đột biến 7] crossRef vi phạm: ${r.crossRef.violations.length}/${r.crossRef.total}`);
    expect(r.crossRef.violations.some((v) => v.startsWith('GET /orgs/:orgId/contracts [customerId'))).toBe(true);
  });

  it('Đột biến 8 — báo "bậc thuộc tổ chức khác" khác với "không tồn tại" (lộ sự tồn tại) → phép crossRef đỏ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'patch' && r.path === '/orgs/:orgId/staff/:membershipId');
    if (!original) throw new Error('Không có route sửa hồ sơ thợ');
    const mutant = { ...original, handler: async (ctx: Parameters<typeof original.handler>[0]) => {
      const body = ctx.body as { tierId?: string | null };
      if (body.tierId) {
        const t = await ctx.deps.db.staffTier.findUnique({ where: { id: body.tierId } });
        if (t && t.organizationId !== mustOrg(ctx.org).id) throw new AppError('VALIDATION_FAILED', 'Bậc này thuộc tổ chức khác');
      }
      return original.handler(ctx);
    } } as AnyRoute;
    const r = await gateOn(replace(mutant));
    console.log(`[đột biến 8] crossRef vi phạm: ${r.crossRef.violations.length}/${r.crossRef.total}`);
    expect(r.crossRef.violations.some((v) => v.startsWith('PATCH /orgs/:orgId/staff/:membershipId [tierId'))).toBe(true);
  });

  it('Đột biến 9 — đường quản trị nền tảng lọt sang scope "auth" (ai đăng nhập cũng gọi được) → phép platform đỏ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'get' && r.path === '/platform/stats');
    if (!original) throw new Error('Không có route thống kê nền tảng');
    // Dựng thẳng đối tượng để vượt qua chốt của defineRoute — giả lập người sửa nhầm khung route.
    const mutant = { ...original, scope: 'auth' } as AnyRoute;
    const r = await gateOn(replace(mutant));
    console.log(`[đột biến 9] platform vi phạm: ${r.platform.violations.length}/${r.platform.total}`);
    expect(r.platform.violations.some((v) => v.startsWith('GET /platform/stats'))).toBe(true);
  });
});
