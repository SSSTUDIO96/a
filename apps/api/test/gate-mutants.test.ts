// BẰNG CHỨNG CỬA GÁC KHÔNG MÙ: cài từng kiểu lỗi vào bảng route, cửa gác phải chuyển đỏ đúng phép kiểm.
// (Dựa trên bài "cửa gác mù" của thợ chấm mốc 2 — lỗi L4.)
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ALL_ROUTES } from '../src/app';
import { defineRoute, mustOrg, type AnyRoute } from '../src/http/route';
import { AppError } from '../src/lib/errors';
import { buildGateFixture, runIsolationGate, type GateReport } from './gate';
import { makeApp, makeDeps } from './helpers';
import { PARTIAL_SAMPLES, REF_SAMPLES, REF_VARIANTS, SAMPLES } from './gate-samples';
import { createApp } from '../src/app';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../src/http/middleware';
import { runPartialPatchGate } from './gate-partial';
import type { Db } from '../src/lib/prisma';

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
  const fx = await buildGateFixture(makeApp(deps), deps.db);
  return runIsolationGate(app, routes, fx, SAMPLES, REF_SAMPLES, REF_VARIANTS);
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

  it('Đột biến 10 — đường quản trị xác thực TRƯỚC (người chưa đăng nhập / thẻ rác nhận 401, đường bịa 404) → phép unauth và platform đỏ', async () => {
    // Dựng lại đúng hành vi cũ (biên bản máy chủ lát 2, lỗi M2) bằng một lớp chặn đứng trước app thật.
    const inner = createApp(deps);
    const outer = express();
    const router = express.Router();
    for (const r of ALL_ROUTES.filter((x) => x.path.startsWith('/platform/'))) {
      router[r.method](r.path, async (req: Request, res: Response, next: NextFunction) => {
        try {
          await authenticate(req, deps);
          next();
        } catch (err) {
          res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: (err as Error).message, requestId: String(res.locals.requestId ?? '') } });
        }
      });
    }
    outer.use('/api/v1', router);
    outer.use(inner);
    const fx = await buildGateFixture(makeApp(deps), deps.db);
    const r = await runIsolationGate(outer as unknown as ReturnType<typeof makeApp>, ALL_ROUTES, fx, SAMPLES, REF_SAMPLES, REF_VARIANTS);
    console.log(`[đột biến 10] unauth vi phạm: ${r.unauth.violations.length}/${r.unauth.total}; platform vi phạm: ${r.platform.violations.length}/${r.platform.total}`);
    expect(r.unauth.violations.some((v) => v.startsWith('GET /platform/stats (chưa đăng nhập) → 401'))).toBe(true);
    expect(r.platform.violations.some((v) => v.includes('(thẻ rác) → 401'))).toBe(true);
  });

  // Hai đột biến dưới: cài lại .default() vào thân PATCH (dựng thẳng đối tượng route, vượt chốt khởi động của defineRoute)
  // → vế CHẠY THẬT của cửa gác sửa một phần phải đỏ đúng đường (biên bản máy chủ lát 2, lỗi S1).
  async function partialGateOn(routes: AnyRoute[]) {
    const app = createApp(deps, routes);
    const fx = await buildGateFixture(makeApp(deps), deps.db);
    return runPartialPatchGate(app, deps.db, routes, fx, PARTIAL_SAMPLES);
  }

  it('Đột biến 11 — thân sửa danh mục có .default() (sortOrder 0, isActive true) → partialKeep đỏ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'patch' && r.path === '/orgs/:orgId/service-categories/:categoryId');
    if (!original) throw new Error('Không có route sửa danh mục');
    const body = z
      .object({ name: z.string().trim().min(1).max(120).optional(), sortOrder: z.number().int().min(0).default(0), isActive: z.boolean().default(true) })
      .partial();
    const r = await partialGateOn(replace({ ...original, body } as AnyRoute));
    console.log(`[đột biến 11] partialKeep vi phạm: ${r.partialKeep.violations.length}/${r.partialKeep.total}; partialStatic: ${r.partialStatic.violations.length}`);
    expect(r.partialKeep.violations.some((v) => v.startsWith('PATCH /orgs/:orgId/service-categories/:categoryId: gửi {name} → 2 trường'))).toBe(true);
  });

  it('Đột biến 12 — tái hiện S1: thân sửa gói = thân tạo gói .partial() (có .default) → partialKeep đỏ ở PATCH /platform/plans/:planId', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'patch' && r.path === '/platform/plans/:planId');
    if (!original) throw new Error('Không có route sửa gói');
    const Limit = z.number().int().min(0).nullable();
    const body = z
      .object({
        name: z.string().trim().min(1).max(60),
        priceMonthly: z.number().int().nonnegative(),
        maxStaff: Limit.default(null),
        maxAppointmentsPerMonth: Limit.default(null),
        maxStorageMb: Limit.default(null),
        maxStudents: Limit.default(null),
        maxCourses: Limit.default(null),
        customDomain: z.boolean().default(false),
        features: z.array(z.string()).default([]),
        isActive: z.boolean().default(true),
        sortOrder: z.number().int().min(0).default(0),
      })
      .partial();
    const r = await partialGateOn(replace({ ...original, body } as AnyRoute));
    const v = r.partialKeep.violations.find((x) => x.startsWith('PATCH /platform/plans/:planId'));
    console.log(`[đột biến 12] ${v ?? 'KHÔNG BẮT ĐƯỢC'}`);
    // 9 thông số (features đếm 2 lá: phần tử + độ dài) — đúng số đo của thợ chấm.
    expect(Number(/→ (\d+) trường KHÔNG gửi bị đổi/.exec(v ?? '')?.[1] ?? 0)).toBeGreaterThanOrEqual(9);
    expect(v).toContain('maxStaff 2→null');
  });
  // Hai đột biến dưới: chứng minh cửa gác KHÔNG MÙ với đường mới (khoá & lớp, thẻ thiết kế) — trước đây tổ chức thử là TEAM
  // (mọi đường khoá học trả 403) và trường MẢNG mã (photoFileIds) bị bỏ qua.
  it('Đột biến 13 — sửa lớp tra lớp chỉ theo id, quên lọc tổ chức → phép crossId đỏ ở PATCH /orgs/:orgId/classes/:classId', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'patch' && r.path === '/orgs/:orgId/classes/:classId');
    if (!original) throw new Error('Không có route sửa lớp');
    const mutant = { ...original, handler: async (ctx: Parameters<typeof original.handler>[0]) => {
      mustOrg(ctx.org);
      const params = ctx.params as { classId: string };
      const body = ctx.body as { note?: string | null };
      const k = await ctx.deps.db.courseClass.findFirst({ where: { id: params.classId } });
      if (!k) throw new AppError('NOT_FOUND', 'Không tìm thấy lớp');
      return { body: await ctx.deps.db.courseClass.update({ where: { id: k.id }, data: { note: body.note ?? k.note } }) };
    } } as AnyRoute;
    const r = await gateOn(replace(mutant));
    const hit = r.crossId.violations.filter((v) => v.startsWith('PATCH /orgs/:orgId/classes/:classId'));
    console.log(`[đột biến 13] crossId vi phạm: ${r.crossId.violations.length}/${r.crossId.total}: ${hit.join('; ')}`);
    expect(hit).toEqual(['PATCH /orgs/:orgId/classes/:classId với id của A → 200']);
  });

  it('Đột biến 14 — tạo thẻ kiểm ảnh mà quên lọc tổ chức (nhận ảnh của tổ chức khác trong photoFileIds) → phép crossRef đỏ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'post' && r.path === '/orgs/:orgId/design-cards');
    if (!original) throw new Error('Không có route tạo thẻ');
    // Tái hiện lỗi "checkFiles quên organizationId": bỏ điều kiện tổ chức khỏi MỌI câu tra tệp trong đường này.
    const mutant = { ...original, handler: async (ctx: Parameters<typeof original.handler>[0]) => {
      const db = ctx.deps.db.$extends({
        query: {
          storedFile: {
            findMany({ args, query }) {
              if (args.where) delete (args.where as { organizationId?: unknown }).organizationId;
              return query(args);
            },
          },
        },
      }) as unknown as Db;
      return original.handler({ ...ctx, deps: { ...ctx.deps, db } });
    } } as AnyRoute;
    const r = await gateOn(replace(mutant));
    const hit = r.crossRef.violations.filter((v) => v.startsWith('POST /orgs/:orgId/design-cards [photoFileIds[]'));
    console.log(`[đột biến 14] crossRef vi phạm: ${r.crossRef.violations.length}/${r.crossRef.total}: ${hit.join('; ')}`);
    expect(hit.length).toBeGreaterThan(0);
    expect(hit[0]).toContain('KHÁC phản hồi mã bịa');
  });
});
