// BẰNG CHỨNG CỬA GÁC KHÔNG MÙ: cài từng kiểu lỗi vào bảng route, cửa gác phải chuyển đỏ đúng phép kiểm.
// (Dựa trên bài "cửa gác mù" của thợ chấm mốc 2 — lỗi L4.)
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ALL_ROUTES } from '../src/app';
import { defineRoute, mustOrg, type AnyRoute } from '../src/http/route';
import { AppError } from '../src/lib/errors';
import { buildGateFixture, GATE_CHECKS, runIsolationGate, type GateFixture, type GateReport } from './gate';
import { makeApp } from './helpers';
import { makePortalDeps } from './portal-helpers';
import { PARTIAL_SAMPLES, REF_SAMPLES, REF_VARIANTS, SAMPLES } from './gate-samples';
import { createApp } from '../src/app';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../src/http/middleware';
import { runPartialPatchGate } from './gate-partial';
import type { Db } from '../src/lib/prisma';
import { mustPortal, isPortalPath } from '../src/http/route';
import { phoneLast4 } from '../src/modules/portal/center';
import { sha256Hex } from '../src/modules/portal/tokens';

// Bộ đếm 'portal' nâng trần: mỗi lần dựng fixture + chạy cửa gác mở cổng / dò hàng chục lần (mặc định 10/phút/IP).
const deps = makePortalDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

function replace(m: AnyRoute): AnyRoute[] {
  const found = ALL_ROUTES.some((r) => r.method === m.method && r.path === m.path);
  if (!found) throw new Error(`Không có route ${m.method} ${m.path} để thay`);
  return ALL_ROUTES.map((r) => (r.method === m.method && r.path === m.path ? m : r));
}

// prepare: chỉnh dữ liệu fixture (bằng app THẬT, chưa cài lỗi) trước khi cửa gác chạy trên bảng route đã cài lỗi.
async function gateOn(routes: AnyRoute[], prepare?: (fx: GateFixture) => Promise<void>): Promise<GateReport> {
  const app = createApp(deps, routes);
  const fx = await buildGateFixture(makeApp(deps), deps.db);
  await prepare?.(fx);
  return runIsolationGate(app, routes, fx, SAMPLES, REF_SAMPLES, REF_VARIANTS);
}

// Đột biến "quên lọc tổ chức ở câu tra cứu": giữ nguyên xử lý của route thật, chỉ chạy nó trên một client database đã bị
// `$extends` gỡ điều kiện tổ chức khỏi đúng những câu được chọn (kể cả câu trong $transaction của client đó).
function onDb(method: AnyRoute['method'], path: string, wrap: (db: Db) => Db): AnyRoute {
  const original = ALL_ROUTES.find((r) => r.method === method && r.path === path);
  if (!original) throw new Error(`Không có route ${method} ${path} để cài lỗi`);
  return { ...original, handler: async (ctx: Parameters<typeof original.handler>[0]) =>
    original.handler({ ...ctx, deps: { ...ctx.deps, db: wrap(ctx.deps.db) } }) } as AnyRoute;
}

function replaceMany(mutants: AnyRoute[]): AnyRoute[] {
  let routes = ALL_ROUTES;
  for (const m of mutants) {
    if (!routes.some((r) => r.method === m.method && r.path === m.path)) throw new Error(`Không có route ${m.method} ${m.path} để thay`);
    routes = routes.map((r) => (r.method === m.method && r.path === m.path ? m : r));
  }
  return routes;
}

function dropOrg(where: unknown): void {
  if (where && typeof where === 'object') delete (where as { organizationId?: unknown }).organizationId;
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

  // Ba đột biến bản vẽ D mục 4.3 (gói M7): loại sự kiện, luật phụ phí ở dòng hợp đồng, trang Hôm nay.
  it('Đột biến D1 — GET /occasions quên organizationId trong where (trả loại sự kiện của mọi tổ chức) → phép leak đỏ', async () => {
    const mutant = onDb('get', '/orgs/:orgId/occasions', (db) =>
      db.$extends({
        query: {
          occasion: {
            findMany({ args, query }) {
              dropOrg(args.where);
              return query(args);
            },
          },
        },
      }) as unknown as Db,
    );
    const r = await gateOn(replace(mutant));
    const hit = r.leak.violations.filter((v) => v.startsWith('GET /orgs/:orgId/occasions '));
    console.log(`[đột biến D1] leak vi phạm: ${r.leak.violations.length}/${r.leak.total} (đạt ${r.leak.passed}/${r.leak.total}): ${hit.join('; ')}`);
    expect(hit.length).toBe(1);
    // Lộ đủ 7 mã loại sự kiện của A (6 loại cài sẵn + 1 loại fixture tạo), không chỉ "có lộ".
    expect(Number(/lộ (\d+) giá trị/.exec(hit[0] ?? '')?.[1] ?? 0)).toBeGreaterThanOrEqual(7);
  });

  it('Đột biến D2 — kiểm dismissedRuleIds / surchargeOverrides bằng findMany({ id: { in } }) không lọc tổ chức → phép crossRef đỏ', async () => {
    // Tái hiện lỗi ở checkLineRuleRefs (contracts/autoSurcharge.ts — chốt DUY NHẤT vì mảng dismissed không có khoá ngoại):
    // gỡ điều kiện tổ chức khỏi câu tra luật theo danh sách mã, ở MỌI đường nhận dòng đặt chỗ. Câu nạp luật đang bật
    // (where không có id.in) giữ nguyên.
    const wrap = (db: Db) =>
      db.$extends({
        query: {
          surchargeRule: {
            findMany({ args, query }) {
              const id = (args.where as { id?: unknown } | undefined)?.id;
              if (id && typeof id === 'object' && 'in' in id) dropOrg(args.where);
              return query(args);
            },
          },
        },
      }) as unknown as Db;
    const targets = [
      ['post', '/orgs/:orgId/contracts/quote'],
      ['post', '/orgs/:orgId/contracts'],
      ['patch', '/orgs/:orgId/contracts/:contractId'],
      ['post', '/orgs/:orgId/contracts/:contractId/lines'],
    ] as const;
    const r = await gateOn(replaceMany(targets.map(([m, p]) => onDb(m, p, wrap))));
    const hit = r.crossRef.violations.filter((v) => /dismissedRuleIds\[\]=mã của A\]/.test(v));
    console.log(`[đột biến D2] crossRef vi phạm: ${r.crossRef.violations.length}/${r.crossRef.total} (đạt ${r.crossRef.passed}/${r.crossRef.total}): ${hit.join('; ')}`);
    // Mỗi đường nhận dòng đặt chỗ đỏ ở đúng trường dismissedRuleIds[]: mã luật của A lọt → 2xx, mã bịa → 404.
    for (const [m, p] of targets) {
      const k = `${m.toUpperCase()} ${p} [`;
      expect(hit.some((v) => v.startsWith(k) && v.includes('KHÁC phản hồi mã bịa')), k).toBe(true);
    }
  });

  it('Đột biến D3 — GET /today đọc đợt thu không lọc tổ chức (đợt quá hạn của studio khác hiện ở thẻ Thu tiền) → phép leak đỏ', async () => {
    // Gỡ điều kiện tổ chức khỏi CẢ BA câu đọc đợt thu (groupBy đợt → hợp đồng theo danh sách mã → mọi đợt của các hợp đồng
    // đó) và câu cộng phiếu: chỉ phá câu groupBy thì mã ném lỗi "không đọc được hợp đồng" chứ không lộ (ghi chú thợ M6).
    // Câu đọc hợp đồng mới 24 giờ qua (where không có id.in) GIỮ lọc tổ chức — để chỗ lộ chỉ có thể là thẻ Thu tiền.
    const mutant = onDb('get', '/orgs/:orgId/today', (db) =>
      db.$extends({
        query: {
          paymentInstallment: {
            groupBy({ args, query }) {
              dropOrg(args.where);
              dropOrg((args.where as { contract?: unknown } | undefined)?.contract);
              return query(args);
            },
            findMany({ args, query }) {
              dropOrg(args.where);
              return query(args);
            },
          },
          contract: {
            findMany({ args, query }) {
              const id = (args.where as { id?: unknown } | undefined)?.id;
              if (id && typeof id === 'object' && 'in' in id) dropOrg(args.where);
              return query(args);
            },
          },
          payment: {
            groupBy({ args, query }) {
              dropOrg(args.where);
              return query(args);
            },
          },
        },
      }) as unknown as Db,
    );
    // Thẻ Thu tiền có trần (500 hợp đồng, 50 đợt mỗi danh sách, sắp theo hạn sớm nhất): database thử dùng lâu có thể có
    // hàng trăm đợt quá hạn của tổ chức khác xếp trước A. Dời đợt quá hạn của A về TRƯỚC mọi đợt đang có để phép đo không
    // phụ thuộc lượng dữ liệu cũ (đợt vẫn là đợt quá hạn thật của một hợp đồng đã xác nhận).
    const prepare = async (fx: GateFixture) => {
      const min = await deps.db.paymentInstallment.aggregate({ _min: { dueDate: true } });
      const earliest = min._min.dueDate;
      if (!earliest) throw new Error('Đột biến D3: database thử không có đợt thu nào — fixture chưa lập tiến độ');
      const first = await deps.db.paymentInstallment.findFirst({
        where: { organizationId: fx.a.orgId, contractId: fx.a.ids.todayContractId },
        orderBy: { dueDate: 'asc' },
        select: { id: true },
      });
      if (!first) throw new Error('Đột biến D3: hợp đồng Hôm nay của A không có đợt thu');
      await deps.db.paymentInstallment.update({ where: { id: first.id }, data: { dueDate: new Date(earliest.getTime() - 86_400_000) } });
    };
    const r = await gateOn(replace(mutant), prepare);
    const hit = r.leak.violations.filter((v) => v.startsWith('GET /orgs/:orgId/today '));
    console.log(`[đột biến D3] leak vi phạm: ${r.leak.violations.length}/${r.leak.total} (đạt ${r.leak.passed}/${r.leak.total}): ${hit.join('; ')}`);
    expect(hit.length).toBe(1);
  });
  // Ba đột biến bản vẽ F mục 9.2 (gói S1b): giấy chứng nhận. Cửa gác chạy trên ĐÚNG 8 đường của bản vẽ F (đã cài lỗi) —
  // fixture vẫn dựng bằng app thật đủ đường; thu hẹp bảng route để đo đúng chỗ và không phụ thuộc đường của gói khác.
  const CERT_ROUTES = new Set([
    'GET /orgs/:orgId/classes/:classId/certificates',
    'POST /orgs/:orgId/classes/:classId/certificates',
    'GET /orgs/:orgId/certificates',
    'GET /orgs/:orgId/certificates/:certificateId',
    'POST /orgs/:orgId/certificates/:certificateId/reissue',
    'POST /orgs/:orgId/certificates/:certificateId/revoke',
    'GET /orgs/:orgId/profile/certificate',
    'PUT /orgs/:orgId/profile/certificate',
  ]);
  const certOnly = (routes: AnyRoute[]) => {
    const kept = routes.filter((r) => CERT_ROUTES.has(`${r.method.toUpperCase()} ${r.path}`));
    if (kept.length !== CERT_ROUTES.size) throw new Error(`Bảng route có ${kept.length}/${CERT_ROUTES.size} đường giấy chứng nhận`);
    return kept;
  };

  it('Bản vẽ F — đường giấy chứng nhận chưa cài lỗi: cửa gác xanh trọn (vế GIỮ của ba đột biến dưới)', async () => {
    const r = await gateOn(certOnly(ALL_ROUTES));
    const bad = Object.entries(r).filter(([, c]) => c.violations.length > 0).map(([n, c]) => `${n}: ${c.violations.join('; ')}`);
    console.log(`[F gốc] ${Object.entries(r).map(([n, c]) => `${n} ${c.passed}/${c.total}`).join(', ')}`);
    expect(bad).toEqual([]);
    expect(r.crossId.total).toBe(5);
    expect(r.crossRef.total).toBe(5);
  });

  it('Đột biến 15 — GET /certificates/:certificateId tra chỉ theo id (quên tổ chức) → phép crossId đỏ', async () => {
    const mutant = onDb('get', '/orgs/:orgId/certificates/:certificateId', (db) =>
      db.$extends({
        query: {
          certificate: {
            findFirst({ args, query }) {
              dropOrg(args.where);
              return query(args);
            },
          },
        },
      }) as unknown as Db,
    );
    const r = await gateOn(certOnly(replace(mutant)));
    const hit = r.crossId.violations.filter((v) => v.startsWith('GET /orgs/:orgId/certificates/:certificateId '));
    console.log(`[đột biến 15] crossId vi phạm: ${r.crossId.violations.length}/${r.crossId.total}: ${hit.join('; ')}`);
    expect(hit).toEqual(['GET /orgs/:orgId/certificates/:certificateId với id của A → 200']);
  });

  it('Đột biến 16 — cấp hàng loạt tra ghi danh chỉ theo mã (quên tổ chức, kéo theo quên lớp) → phép crossRef đỏ ở enrollmentIds[]', async () => {
    // Chỉ bỏ organizationId thì điều kiện courseClassId (lớp đã khoá theo (id, tổ chức)) vẫn chặn — đã đo riêng, xanh.
    // Lỗi thật đáng sợ là tra ghi danh CHỈ theo danh sách mã: bỏ cả hai điều kiện.
    const mutant = onDb('post', '/orgs/:orgId/classes/:classId/certificates', (db) =>
      db.$extends({
        query: {
          enrollment: {
            findMany({ args, query }) {
              const id = (args.where as { id?: unknown } | undefined)?.id;
              if (id && typeof id === 'object' && 'in' in id) {
                dropOrg(args.where);
                delete (args.where as { courseClassId?: unknown }).courseClassId;
              }
              return query(args);
            },
          },
        },
      }) as unknown as Db,
    );
    const r = await gateOn(certOnly(replace(mutant)));
    const hit = r.crossRef.violations.filter((v) => v.startsWith('POST /orgs/:orgId/classes/:classId/certificates [enrollmentIds[]'));
    console.log(`[đột biến 16] crossRef vi phạm: ${r.crossRef.violations.length}/${r.crossRef.total}: ${hit.join('; ')}`);
    expect(hit.length).toBe(1);
    expect(hit[0]).toContain('KHÁC phản hồi mã bịa');
  });

  it('Đột biến 17 — GET /certificates lọc customerId mà quên điều kiện tổ chức → phép crossRef đỏ (lộ giấy của A)', async () => {
    const wrap = (db: Db) =>
      db.$extends({
        query: {
          certificate: {
            findMany({ args, query }) {
              if ((args.where as { customerId?: unknown } | undefined)?.customerId) dropOrg(args.where);
              return query(args);
            },
            count({ args, query }) {
              if ((args.where as { customerId?: unknown } | undefined)?.customerId) dropOrg(args.where);
              return query(args);
            },
          },
        },
      }) as unknown as Db;
    const r = await gateOn(certOnly(replace(onDb('get', '/orgs/:orgId/certificates', wrap))));
    const hit = r.crossRef.violations.filter((v) => v.startsWith('GET /orgs/:orgId/certificates [customerId'));
    console.log(`[đột biến 17] crossRef vi phạm: ${r.crossRef.violations.length}/${r.crossRef.total}; leak ${r.leak.violations.length}: ${hit.join('; ')}`);
    expect(hit.length).toBe(1);
    expect(hit[0]).toContain('KHÁC phản hồi mã bịa');
  });

  // Năm đột biến bản vẽ E mục 6.3 (gói E5), đánh số TIẾP SAU 17 (15–17 đã dùng cho giấy chứng nhận — nhật ký quyết định thay
  // 20/10, dòng E3): 18 ↔ bản vẽ 15, 19 ↔ 16, 20 ↔ 17, 21 ↔ 18, 22 ↔ 19. Cửa gác chạy trên ĐÚNG 11 đường cổng (5 đường học
  // viên + 6 đường trung tâm) — fixture vẫn dựng bằng app thật đủ đường.
  const PORTAL_CENTER_ROUTES = new Set([
    'GET /orgs/:orgId/customers/:customerId/portal',
    'POST /orgs/:orgId/customers/:customerId/portal/links',
    'POST /orgs/:orgId/customers/:customerId/portal/revoke',
    'POST /orgs/:orgId/portal-devices/:deviceId/block',
    'GET /orgs/:orgId/portal-settings',
    'PUT /orgs/:orgId/portal-settings',
  ]);
  const portalOnly = (routes: AnyRoute[], extra: string[] = []) => {
    const k = (r: AnyRoute) => `${r.method.toUpperCase()} ${r.path}`;
    const kept = routes.filter((r) => isPortalPath(r.path) || r.scope === 'portal' || PORTAL_CENTER_ROUTES.has(k(r)) || extra.includes(k(r)));
    const student = ALL_ROUTES.filter((r) => isPortalPath(r.path)).length;
    if (student !== 5) throw new Error(`Bảng route có ${student}/5 đường học viên`);
    if (kept.length !== 5 + PORTAL_CENTER_ROUTES.size + extra.length) throw new Error(`Bảng route có ${kept.length} đường cổng`);
    return kept;
  };
  const summary = (r: GateReport) => GATE_CHECKS.map((n) => `${n} ${r[n].passed}/${r[n].total}`).join(', ');

  it('Bản vẽ E — 11 đường cổng chưa cài lỗi: cửa gác 14 phép xanh trọn (vế GIỮ của năm đột biến dưới)', async () => {
    const r = await gateOn(portalOnly(ALL_ROUTES));
    const bad = GATE_CHECKS.filter((n) => r[n].violations.length > 0).map((n) => `${n}: ${r[n].violations.join('; ')}`);
    console.log(`[E gốc] ${summary(r)}`);
    expect(bad).toEqual([]);
    expect(r.portalScope.total).toBe(5);
    expect(r.portalLeak.total).toBe(3);
    expect(r.portalProbe.total).toBe(15);
    expect(r.crossId.total).toBe(4);
  });

  it('Đột biến 18 — đường cổng đọc học viên từ THÂN (body: { customerId }) → defineRoute ném lỗi; dựng thẳng thì portalScope đỏ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'post' && r.path === '/portal/session/handoff');
    if (!original) throw new Error('Không có route tạo mã chuyển máy');
    const body = z.object({ customerId: z.uuid() });
    expect(() => defineRoute({ ...original, body } as Parameters<typeof defineRoute>[0])).toThrow(/customerId/);
    // Dựng thẳng đối tượng (vượt chốt khởi động): học viên lấy từ thân thay vì từ phiên.
    const mutant = { ...original, body, handler: async (ctx: Parameters<typeof original.handler>[0]) =>
      original.handler({ ...ctx, portal: { ...mustPortal(ctx.portal), customerId: (ctx.body as { customerId: string }).customerId } }) } as AnyRoute;
    const r = await gateOn(portalOnly(replace(mutant)));
    const hit = r.portalScope.violations.filter((v) => v.startsWith('POST /portal/session/handoff:'));
    console.log(`[đột biến 18] portalScope vi phạm: ${r.portalScope.violations.length}/${r.portalScope.total}: ${hit.join('; ')}`);
    expect(hit.length).toBe(1);
    expect(hit[0]).toContain('customerId');
  });

  it('Đột biến 19 — /portal/me lọc thẻ thiết kế theo tổ chức, quên học viên → portalLeak đỏ (A1 thấy thẻ của A2)', async () => {
    const mutant = onDb('get', '/portal/me', (db) =>
      db.$extends({
        query: {
          designCard: {
            findMany({ args, query }) {
              if (args.where) delete (args.where as { customerId?: unknown }).customerId;
              return query(args);
            },
          },
        },
      }) as unknown as Db,
    );
    const r = await gateOn(portalOnly(replace(mutant)));
    const hit = r.portalLeak.violations.filter((v) => v.startsWith('GET /portal/me (A1)'));
    console.log(`[đột biến 19] portalLeak vi phạm: ${r.portalLeak.violations.length}/${r.portalLeak.total}: ${r.portalLeak.violations.join('; ')}`);
    expect(hit.length).toBe(1);
    expect(hit[0]).toContain('Lớp riêng A2');
  });

  it('Đột biến 20 — GET /orgs/:orgId/customers bị gắn nhầm scope "portal" (dựng thẳng) → portalWall và portalScope đỏ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'get' && r.path === '/orgs/:orgId/customers');
    if (!original) throw new Error('Không có route danh sách khách');
    const mutant = { ...original, scope: 'portal' } as AnyRoute;
    const r = await gateOn(portalOnly(replace(mutant), ['GET /orgs/:orgId/customers']));
    const wall = r.portalWall.violations.filter((v) => v.startsWith('GET /orgs/:orgId/customers ('));
    const scope = r.portalScope.violations.filter((v) => v.startsWith('GET /orgs/:orgId/customers:'));
    console.log(`[đột biến 20] portalWall vi phạm: ${r.portalWall.violations.length}/${r.portalWall.total}: ${wall.join('; ')}`);
    console.log(`[đột biến 20] portalScope vi phạm: ${r.portalScope.violations.length}/${r.portalScope.total}: ${scope.join('; ')}`);
    expect(wall.some((v) => v.includes('(cookie cổng + X-Client: portal)'))).toBe(true);
    expect(scope.length).toBe(1);
  });

  it('Đột biến 21 — mở bằng 4 số báo "Sai số điện thoại" / "Đường dẫn không tồn tại" (hai lời khác nhau) → portalProbe đỏ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'post' && r.path === '/portal/session');
    if (!original) throw new Error('Không có route mở cổng');
    const mutant = { ...original, handler: async (ctx: Parameters<typeof original.handler>[0]) => {
      try {
        return await original.handler(ctx);
      } catch (err) {
        const body = ctx.body as { key: string; last4: string };
        const link = await ctx.deps.db.portalLink.findUnique({ where: { keyHash: sha256Hex(body.key) }, select: { customer: { select: { phone: true } } } });
        if (!link) throw new AppError('UNAUTHENTICATED', 'Đường dẫn không tồn tại');
        if (phoneLast4(link.customer.phone) !== body.last4) throw new AppError('UNAUTHENTICATED', 'Sai số điện thoại');
        throw err;
      }
    } } as AnyRoute;
    const r = await gateOn(portalOnly(replace(mutant)));
    const hit = r.portalProbe.violations.filter((v) => v.startsWith('POST /portal/session ['));
    console.log(`[đột biến 21] portalProbe vi phạm: ${r.portalProbe.violations.length}/${r.portalProbe.total}: ${hit.join('; ')}`);
    expect(hit.some((v) => v.startsWith('POST /portal/session [sai 4 số]') && v.includes('KHÁC phản hồi "chìa không có"'))).toBe(true);
  });

  it('Đột biến 22 — /portal/me trả thêm Contract.notes (ghi chú nội bộ) → portalLeak đỏ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'get' && r.path === '/portal/me');
    if (!original) throw new Error('Không có route /portal/me');
    const mutant = { ...original, handler: async (ctx: Parameters<typeof original.handler>[0]) => {
      const res = await original.handler(ctx);
      const p = mustPortal(ctx.portal);
      const notes = await ctx.deps.db.contract.findMany({
        where: { organizationId: p.organizationId, customerId: p.customerId },
        select: { code: true, notes: true },
      });
      const body = res.body as { contracts: { code: string }[] };
      return { ...res, body: { ...body, contracts: body.contracts.map((c) => ({ ...c, notes: notes.find((n) => n.code === c.code)?.notes ?? null })) } };
    } } as AnyRoute;
    const r = await gateOn(portalOnly(replace(mutant)));
    console.log(`[đột biến 22] portalLeak vi phạm: ${r.portalLeak.violations.length}/${r.portalLeak.total}: ${r.portalLeak.violations.join('; ')}`);
    // Cả ba học viên: hợp đồng của chính mình mang ghi chú nội bộ (chuỗi bí mật BI-MAT-… của trung tâm).
    expect(r.portalLeak.violations.length).toBe(3);
    expect(r.portalLeak.violations.every((v) => v.includes('BI-MAT-'))).toBe(true);
  });
});
