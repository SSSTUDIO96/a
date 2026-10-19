// Bản vẽ E, gói E2 — khung scope 'portal' (mục 4.1; bài thử 6.2 phần E2; chuỗi cấm 6.4 phần máy chủ).
// Tường chắn hai chiều chạy trên MỌI đường của bảng route (ALL_ROUTES), không liệt kê tay: thẻ/cookie học viên không qua
// được đường nhân viên, thẻ/cookie nhân viên không qua được đường cổng.
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { PORTAL_DENIED_MESSAGE, PORTAL_SESSION_DAYS, PORTAL_SESSION_INVALID_MESSAGE } from '@makeup/shared';
import { ALL_ROUTES, createApp } from '../src/app';
import { loadEnv } from '../src/env';
import { defineRoute, idFieldPaths, isPortalPath, mustPortal, PORTAL_PUBLIC_ROUTES, type AnyRoute, type Deps, type PortalContext } from '../src/http/route';
import { createLogger } from '../src/lib/logger';
import { authRoutes } from '../src/modules/auth/routes';
import { portalRoutes } from '../src/modules/portal/routes';
import { portalDeniedError } from '../src/modules/portal/auth';
import { CLEAR_PORTAL_COOKIE, PORTAL_COOKIE, PORTAL_COOKIE_PATH, portalCookie, readPortalCookie } from '../src/modules/portal/cookie';
import {
  HANDOFF_ALPHABET,
  hashHandoffCode,
  newHandoffCode,
  newLinkKey,
  newSessionToken,
  PORTAL_TOKEN_PATTERN,
  sha256Hex,
} from '../src/modules/portal/tokens';
import { createAcademyOrg, makeDeps, registerUser, type TestUser } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

const API_SRC = path.resolve(__dirname, '../src');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const noop = async () => ({ body: { ok: true } });

// Đường cổng THỬ (địa chỉ riêng, không trùng đường thật của E3): trả lại đúng ngữ cảnh máy chủ đưa cho handler.
const probeRoute = defineRoute({
  method: 'get',
  path: '/portal/thu-khung-e2',
  scope: 'portal',
  summary: 'Đường cổng thử của bài thử khung E2',
  tag: 'Thử',
  handler: async ({ portal, userId, org }) => ({ body: { portal: mustPortal(portal), userId, org } }),
});

// ---------- dựng dữ liệu: tổ chức ACADEMY, học viên, đường dẫn, máy, phiên (ghi thẳng Prisma, chỉ bản băm) ----------
interface World {
  owner: TestUser;
  orgId: string;
  customerId: string;
  linkId: string;
  deviceId: string;
  token: string;
  sessionId: string;
}

async function newSession(orgId: string, customerId: string, deviceId: string, extra: { createdAt?: Date; lastUsedAt?: Date; expiresAt?: Date } = {}) {
  const { token, hash } = newSessionToken();
  const now = Date.now();
  const s = await deps.db.portalSession.create({
    data: {
      organizationId: orgId,
      customerId,
      deviceId,
      tokenHash: hash,
      createdAt: extra.createdAt ?? new Date(now),
      lastUsedAt: extra.lastUsedAt ?? new Date(now),
      expiresAt: extra.expiresAt ?? new Date(now + PORTAL_SESSION_DAYS * 86_400_000),
    },
  });
  return { token, sessionId: s.id };
}

async function newDevice(orgId: string, customerId: string, linkId: string) {
  const d = await deps.db.portalDevice.create({ data: { organizationId: orgId, customerId, linkId, label: 'iPhone · Safari' } });
  return d.id;
}

async function buildWorld(label: string): Promise<World> {
  const app = createApp(deps);
  const owner = await registerUser(app, label);
  const orgId = await createAcademyOrg(app, owner, label);
  const customer = await deps.db.customer.create({ data: { organizationId: orgId, fullName: 'Tôn Nữ Phương Thảo', phone: '0901234567' } });
  const link = await deps.db.portalLink.create({
    data: {
      organizationId: orgId,
      customerId: customer.id,
      keyHash: newLinkKey().hash,
      createdById: owner.id,
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      firstOpenedAt: new Date(),
    },
  });
  const deviceId = await newDevice(orgId, customer.id, link.id);
  const { token, sessionId } = await newSession(orgId, customer.id, deviceId);
  return { owner, orgId, customerId: customer.id, linkId: link.id, deviceId, token, sessionId };
}

let w: World;
beforeAll(async () => {
  w = await buildWorld('e2-khung');
});

const portalGet = (app: ReturnType<typeof createApp>, url: string, token: string) =>
  request(app).get(`/api/v1${url}`).set('x-client', 'portal').set('cookie', `${PORTAL_COOKIE}=${token}`);

// Thân lỗi bỏ requestId; tập tên header bỏ các header thay đổi theo từng yêu cầu.
const bodyOf = (res: request.Response) => {
  const b = JSON.parse(JSON.stringify(res.body)) as { error?: { requestId?: string } };
  if (b.error) delete b.error.requestId;
  return JSON.stringify(b);
};
const VOLATILE = /^(date|x-request-id|ratelimit.*|etag|content-length)$/;
const headerNames = (res: request.Response) => Object.keys(res.headers).filter((h) => !VOLATILE.test(h)).sort().join(',');

// ======================================================================================================================
describe('defineRoute — luật scope portal (khởi động là ném lỗi)', () => {
  const base = { summary: 'thử', tag: 'Thử', handler: noop };
  const cases: { name: string; def: () => unknown; msg: RegExp }[] = [
    { name: 'scope portal có :id', def: () => defineRoute({ ...base, method: 'get', path: '/portal/hop-dong/:id', scope: 'portal' }), msg: /tham số đường dẫn/ },
    {
      name: 'scope portal có params',
      def: () => defineRoute({ ...base, method: 'get', path: '/portal/x', scope: 'portal', params: z.object({ a: z.string() }) }),
      msg: /params/,
    },
    {
      name: 'scope portal có query',
      def: () => defineRoute({ ...base, method: 'get', path: '/portal/me', scope: 'portal', query: z.object({ page: z.string().optional() }) }),
      msg: /query/,
    },
    {
      name: 'thân có customerId',
      def: () => defineRoute({ ...base, method: 'post', path: '/portal/x', scope: 'portal', body: z.object({ customerId: z.uuid() }) }),
      msg: /customerId/,
    },
    {
      name: 'thân có items[].contractIds (lồng trong mảng)',
      def: () =>
        defineRoute({ ...base, method: 'post', path: '/portal/x', scope: 'portal', body: z.object({ items: z.array(z.object({ contractIds: z.array(z.uuid()) })) }) }),
      msg: /items\[\]\.contractIds/,
    },
    {
      name: 'thân có trường Id trong union / record lồng sâu',
      def: () =>
        defineRoute({
          ...base,
          method: 'post',
          path: '/portal/x',
          scope: 'portal',
          body: z.object({ a: z.union([z.string(), z.object({ b: z.record(z.string(), z.object({ deviceId: z.string() })) })]) }),
        }),
      msg: /deviceId/,
    },
    {
      name: 'scope portal khai permission',
      def: () => defineRoute({ ...base, method: 'get', path: '/portal/x', scope: 'portal', permission: 'customers.read' }),
      msg: /không khai quyền/,
    },
    {
      name: 'scope portal khai idempotent',
      def: () => defineRoute({ ...base, method: 'post', path: '/portal/x', scope: 'portal', idempotent: true }),
      msg: /idempotent/,
    },
    { name: 'scope portal không bắt đầu /portal/', def: () => defineRoute({ ...base, method: 'get', path: '/hv/me', scope: 'portal' }), msg: /bắt đầu bằng \/portal\// },
    {
      name: 'public dưới /portal/ ngoài danh sách cho phép',
      def: () => defineRoute({ ...base, method: 'get', path: '/portal/me', scope: 'public', rateLimit: 'portal' }),
      msg: /PORTAL_PUBLIC_ROUTES/,
    },
    {
      name: 'public dưới /portal/ thiếu rateLimit portal',
      def: () => defineRoute({ ...base, method: 'post', path: '/portal/session', scope: 'public' }),
      msg: /rateLimit: 'portal'/,
    },
    {
      name: 'public dưới /portal/ khai rateLimit auth (không phải bộ đếm riêng)',
      def: () => defineRoute({ ...base, method: 'post', path: '/portal/session', scope: 'public', rateLimit: 'auth' }),
      msg: /rateLimit: 'portal'/,
    },
    {
      name: 'public dưới /portal/ có query (thẻ/chìa không đi qua query)',
      def: () =>
        defineRoute({ ...base, method: 'post', path: '/portal/session', scope: 'public', rateLimit: 'portal', query: z.object({ k: z.string() }) }),
      msg: /query/,
    },
    { name: 'scope org dưới /portal/', def: () => defineRoute({ ...base, method: 'get', path: '/portal/x', scope: 'org', permission: 'customers.read' }), msg: /\/portal\// },
    { name: 'scope auth dưới /portal/', def: () => defineRoute({ ...base, method: 'get', path: '/portal/x', scope: 'auth' }), msg: /scope "auth"/ },
    { name: 'scope platform dưới /portal/', def: () => defineRoute({ ...base, method: 'get', path: '/portal/x', scope: 'platform' }), msg: /\/portal\/|\/platform\// },
    { name: 'chữ hoa /Portal/ không lách được (Express không phân biệt hoa thường)', def: () => defineRoute({ ...base, method: 'get', path: '/Portal/me', scope: 'auth' }), msg: /\/portal\// },
  ];
  for (const c of cases) {
    it(`từ chối: ${c.name}`, () => {
      expect(c.def).toThrow(c.msg);
    });
  }

  it(`GIỮ: đường portal không tham số, thân không có mã; hai đường public cho phép có rateLimit portal`, () => {
    expect(() => defineRoute({ ...base, method: 'get', path: '/portal/me', scope: 'portal' })).not.toThrow();
    expect(() => defineRoute({ ...base, method: 'post', path: '/portal/session/handoff', scope: 'portal', body: z.object({ note: z.string() }) })).not.toThrow();
    for (const name of PORTAL_PUBLIC_ROUTES) {
      const [method, p] = name.split(' ') as [string, string];
      expect(() =>
        defineRoute({ ...base, method: method.toLowerCase() as 'post', path: p, scope: 'public', rateLimit: 'portal', body: z.object({ key: z.string(), last4: z.string() }) }),
      ).not.toThrow();
    }
    console.log(`[khung] defineRoute: ${cases.length}/${cases.length} cách khai sai bị từ chối; 4/4 cách khai đúng được nhận`);
  });

  it('idFieldPaths bắt trường mã ở mọi độ sâu; GIỮ: trường thường không bị bắt', () => {
    expect(idFieldPaths(z.object({ a: z.array(z.object({ b: z.object({ photoIds: z.array(z.string()) }) })) }))).toEqual(['a[].b.photoIds']);
    expect(idFieldPaths(z.object({ key: z.string(), last4: z.string(), code: z.string(), idea: z.string() }))).toEqual([]);
  });

  it('bảng route thật: mọi đường dưới /portal/ đều qua luật (đếm theo ĐỊA CHỈ lẫn NHÃN)', () => {
    const byPath = ALL_ROUTES.filter((r) => isPortalPath(r.path));
    const byScope = ALL_ROUTES.filter((r) => r.scope === 'portal');
    for (const r of byScope) expect(isPortalPath(r.path), `${r.method} ${r.path}`).toBe(true);
    for (const r of byPath) {
      const name = `${r.method.toUpperCase()} ${r.path}`;
      const ok =
        (r.scope === 'portal' && !r.path.includes(':') && !r.query && !r.params && idFieldPaths(r.body).length === 0) ||
        (r.scope === 'public' && (PORTAL_PUBLIC_ROUTES as readonly string[]).includes(name) && r.rateLimit === 'portal');
      expect(ok, name).toBe(true);
    }
    expect(portalRoutes.every((r) => ALL_ROUTES.includes(r))).toBe(true);
    console.log(`[khung] bảng route: ${byPath.length} đường dưới /portal/, ${byScope.length} đường scope portal (E3/E4 chưa điền)`);
  });
});

// ======================================================================================================================
describe('tường chắn hai chiều trên MỌI đường của bảng route', () => {
  const routes: AnyRoute[] = [...ALL_ROUTES, probeRoute];
  const app = createApp(deps, routes);
  const urlOf = (r: AnyRoute) => `/api/v1${r.path.replace(/:([A-Za-z]+)/g, () => randomUUID())}`;
  const send = (r: AnyRoute) => request(app)[r.method](urlOf(r));

  it('Bearer mpp_<43 ký tự> ở /auth/me → 401 "Thẻ đăng nhập không hợp lệ", KHÔNG truy vấn database nào', async () => {
    // Đếm MỌI lần đụng database (bọc deps.db bằng Proxy; không vá đối tượng Prisma thật — vá rồi trả lại làm hỏng delegate).
    const touched: string[] = [];
    const db = new Proxy(deps.db, {
      get(target, prop, recv) {
        if (typeof prop === 'string') touched.push(prop);
        return Reflect.get(target, prop, recv) as unknown;
      },
    });
    const counted = createApp({ ...deps, db }, ALL_ROUTES);
    const res = await request(counted).get('/api/v1/auth/me').set('authorization', `Bearer ${w.token}`).expect(401);
    expect(res.body.error.message).toBe('Thẻ đăng nhập không hợp lệ');
    expect(touched).toEqual([]);
    // GIỮ: thẻ nhân viên thật thì có tra database (bộ đếm hoạt động).
    await request(counted).get('/api/v1/auth/me').set('authorization', `Bearer ${w.owner.accessToken}`).expect(200);
    expect(touched).toContain('user');
  });

  it('đường nhân viên (auth/org/platform) × 2 cách cầm phiên cổng THẬT → 401 (platform: 404 giống hệt đường bịa)', async () => {
    const staff = routes.filter((r) => r.scope === 'auth' || r.scope === 'org' || r.scope === 'platform');
    const bogus = await request(app).get(`/api/v1/platform/khong-co-${randomUUID()}`).expect(404);
    let pass = 0;
    const fails: string[] = [];
    for (const r of staff) {
      const ways = [
        send(r).set('cookie', `${PORTAL_COOKIE}=${w.token}`).set('x-client', 'portal'),
        send(r).set('authorization', `Bearer ${w.token}`),
      ];
      for (const [i, q] of ways.entries()) {
        const res = await q;
        const ok =
          r.scope === 'platform'
            ? res.status === 404 && bodyOf(res) === bodyOf(bogus)
            : res.status === 401 && res.body?.error?.code === 'UNAUTHENTICATED';
        if (ok) pass++;
        else fails.push(`${r.method.toUpperCase()} ${r.path} cách ${i + 1} → ${res.status}`);
      }
    }
    console.log(`[khung] tường chắn — đường nhân viên từ chối phiên cổng: ${pass}/${staff.length * 2} (${staff.length} đường × 2 cách)`);
    expect(staff.length).toBeGreaterThan(50);
    expect(fails).toEqual([]);
  });

  it('đường cổng (scope portal) × 4 cách cầm sai → 401; GIỮ: đúng cách → 200', async () => {
    const portal = routes.filter((r) => r.scope === 'portal');
    // Thẻ nhân viên THẬT, refresh token THẬT (đăng nhập dạng web để có cookie mp_refresh).
    const login = await request(app).post('/api/v1/auth/login').set('x-client', 'web').send({ email: w.owner.email, password: w.owner.password }).expect(200);
    const refreshCookie = String(login.headers['set-cookie']).split(';')[0] ?? '';
    expect(refreshCookie).toMatch(/^mp_refresh=/);
    const staffJwt = login.body.accessToken as string;
    let pass = 0;
    const fails: string[] = [];
    for (const r of portal) {
      const ways = [
        send(r).set('authorization', `Bearer ${staffJwt}`).set('x-client', 'portal'),
        send(r).set('cookie', refreshCookie).set('x-client', 'web'),
        send(r).set('cookie', `${PORTAL_COOKIE}=${w.token}`),
        send(r).set('cookie', `${PORTAL_COOKIE}=${w.token}`).set('x-client', 'portal').set('authorization', `Bearer ${staffJwt}`),
      ];
      for (const [i, q] of ways.entries()) {
        const res = await q;
        if (res.status === 401 && res.body?.error?.code === 'UNAUTHENTICATED') pass++;
        else fails.push(`${r.method.toUpperCase()} ${r.path} cách ${i + 1} → ${res.status}`);
      }
    }
    console.log(`[khung] tường chắn — đường cổng từ chối thẻ nhân viên: ${pass}/${portal.length * 4} (${portal.length} đường × 4 cách)`);
    expect(portal.length).toBeGreaterThan(0);
    expect(fails).toEqual([]);
    // GIỮ: cookie cổng + X-Client: portal → vào được, ngữ cảnh lấy từ phiên, không có userId / org.
    const ok = await portalGet(app, '/portal/thu-khung-e2', w.token).expect(200);
    expect(ok.body).toEqual({
      portal: { organizationId: w.orgId, customerId: w.customerId, deviceId: w.deviceId, sessionId: w.sessionId } satisfies PortalContext,
      userId: null,
      org: null,
    });
  });
});

// ======================================================================================================================
describe('authenticatePortal — mỗi yêu cầu kiểm phiên, máy, tổ chức', () => {
  const app = createApp(deps, [probeRoute]);
  const URL = '/portal/thu-khung-e2';

  it('một lời chung: không cookie, có Authorization, thiếu X-Client, sai dạng, thẻ bịa, cookie hỏng → cùng 401, cùng thân, cùng header', async () => {
    const fake = newSessionToken().token;
    const reqs = [
      request(app).get(`/api/v1${URL}`).set('x-client', 'portal'),
      portalGet(app, URL, w.token).set('authorization', 'Bearer xyz'),
      request(app).get(`/api/v1${URL}`).set('cookie', `${PORTAL_COOKIE}=${w.token}`),
      portalGet(app, URL, 'mpp_ngan'),
      portalGet(app, URL, fake),
      portalGet(app, URL, '%E0%A4%A'),
      portalGet(app, URL, w.token).set('x-client', 'web'),
    ];
    const res = await Promise.all(reqs);
    for (const r of res) {
      expect(r.status).toBe(401);
      expect(r.headers['set-cookie']).toBeUndefined();
    }
    expect(new Set(res.map(bodyOf)).size).toBe(1);
    expect(new Set(res.map(headerNames)).size).toBe(1);
    expect(res[0]?.body.error).toMatchObject({ code: 'UNAUTHENTICATED', message: PORTAL_SESSION_INVALID_MESSAGE, details: { reason: 'PORTAL_SESSION_INVALID' } });
    console.log(`[khung] phiên hỏng: ${res.length}/${res.length} cách → một lời, một bộ header`);
  });

  it('phiên đã thu hồi → 401; máy đã kết thúc → 401; phiên hết hạn → 401; GIỮ: máy khác của cùng học viên vẫn 200', async () => {
    const x = await buildWorld('e2-vong-doi');
    const second = await newDevice(x.orgId, x.customerId, x.linkId);
    const s2 = await newSession(x.orgId, x.customerId, second);
    await portalGet(app, URL, x.token).expect(200);

    // Thu hồi phiên.
    const s1b = await newSession(x.orgId, x.customerId, x.deviceId);
    await portalGet(app, URL, s1b.token).expect(200);
    await deps.db.portalSession.update({ where: { id: s1b.sessionId }, data: { revokedAt: new Date() } });
    const revoked = await portalGet(app, URL, s1b.token).expect(401);
    expect(revoked.body.error.message).toBe(PORTAL_SESSION_INVALID_MESSAGE);

    // Máy kết thúc (học viên tự thoát): phiên CHƯA thu hồi vẫn bị từ chối vì máy đã kết thúc.
    await deps.db.portalDevice.update({ where: { id: x.deviceId }, data: { endedAt: new Date(), endReason: 'SIGNED_OUT' } });
    await portalGet(app, URL, x.token).expect(401);

    // Hết hạn.
    const old = new Date(Date.now() - 3 * 86_400_000);
    const s3 = await newSession(x.orgId, x.customerId, second, { createdAt: old, lastUsedAt: old, expiresAt: new Date(Date.now() - 1000) });
    await portalGet(app, URL, s3.token).expect(401);

    // GIỮ: máy thứ hai, phiên còn hạn.
    const ok = await portalGet(app, URL, s2.token).expect(200);
    expect(ok.body.portal).toEqual({ organizationId: x.orgId, customerId: x.customerId, deviceId: second, sessionId: s2.sessionId });
  });

  it('tổ chức bị khoá → 403 "Trang học viên đang tạm đóng"; mở khoá → 200', async () => {
    const x = await buildWorld('e2-khoa-to-chuc');
    await deps.db.organization.update({ where: { id: x.orgId }, data: { status: 'SUSPENDED' } });
    const res = await portalGet(app, URL, x.token).expect(403);
    expect(res.body.error.message).toBe('Trang học viên đang tạm đóng. Vui lòng liên hệ trung tâm.');
    await deps.db.organization.update({ where: { id: x.orgId }, data: { status: 'ACTIVE' } });
    await portalGet(app, URL, x.token).expect(200);
  });

  it('hết hạn trượt: last_used_at cũ hơn 60 phút → sau yêu cầu, expires_at ≈ now + 90 ngày, máy cập nhật last_seen_at; mới dùng thì KHÔNG ghi', async () => {
    const x = await buildWorld('e2-truot');
    const twoHours = new Date(Date.now() - 2 * 3_600_000);
    const s = await newSession(x.orgId, x.customerId, x.deviceId, { createdAt: twoHours, lastUsedAt: twoHours, expiresAt: new Date(Date.now() + 86_400_000) });
    await deps.db.portalDevice.update({ where: { id: x.deviceId }, data: { lastSeenAt: twoHours } });
    const before = Date.now();
    await portalGet(app, URL, s.token).expect(200);
    const row = await deps.db.portalSession.findUniqueOrThrow({ where: { id: s.sessionId } });
    const dev = await deps.db.portalDevice.findUniqueOrThrow({ where: { id: x.deviceId } });
    const want = before + PORTAL_SESSION_DAYS * 86_400_000;
    expect(Math.abs(row.expiresAt.getTime() - want)).toBeLessThan(10_000);
    expect(row.lastUsedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(dev.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    // GIỮ: vừa dùng (< 60 phút) → không ghi lại.
    const fresh = await deps.db.portalSession.findUniqueOrThrow({ where: { id: w.sessionId } });
    await portalGet(app, URL, w.token).expect(200);
    const after = await deps.db.portalSession.findUniqueOrThrow({ where: { id: w.sessionId } });
    expect(after.expiresAt.getTime()).toBe(fresh.expiresAt.getTime());
  });

  it('mustPortal: ngữ cảnh rỗng là lỗi lắp ráp', () => {
    expect(() => mustPortal(null)).toThrow(/lắp ráp/);
  });
});

// ======================================================================================================================
describe('giới hạn lượt — bộ đếm portal riêng', () => {
  const publicRoute = defineRoute({
    method: 'post',
    path: '/portal/session',
    scope: 'public',
    rateLimit: 'portal',
    summary: 'thử bộ đếm',
    tag: 'Thử',
    body: z.object({ key: z.string().min(1).max(200), last4: z.string().regex(/^\d{4}$/) }),
    handler: async () => {
      throw portalDeniedError();
    },
  });

  it('PORTAL_RATE_LIMIT_PER_MINUTE=2 → lần thứ 3 bị 429; bộ đếm đăng nhập nhân viên KHÔNG bị ăn', async () => {
    const d: Deps = { ...deps, env: loadEnv({ ...process.env, PORTAL_RATE_LIMIT_PER_MINUTE: '2', AUTH_RATE_LIMIT_PER_MINUTE: '2' }) };
    const app = createApp(d, [publicRoute, ...authRoutes]);
    const open = () => request(app).post('/api/v1/portal/session').set('x-client', 'portal').send({ key: 'k', last4: '1234' });
    await open().expect(401);
    await open().expect(401);
    const third = await open().expect(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
    // Đăng nhập nhân viên vẫn còn nguyên 2 lượt của nó.
    const login = () => request(app).post('/api/v1/auth/login').send({ email: 'khong-co@thu.local', password: 'sai-mat-khau-1' });
    await login().expect(401);
    await login().expect(401);
    await login().expect(429);
    console.log('[khung] bộ đếm portal: 2 lượt rồi 429; bộ đếm đăng nhập riêng: 2 lượt rồi 429');
  });

  it('một lời chung khi mở cổng hỏng (2.5): đúng mã, đúng lời, đúng details', async () => {
    const app = createApp(deps, [publicRoute]);
    const res = await request(app).post('/api/v1/portal/session').set('x-client', 'portal').send({ key: 'bia', last4: '0000' }).expect(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: PORTAL_DENIED_MESSAGE, details: { reason: 'PORTAL_DENIED' }, requestId: res.headers['x-request-id'] },
    });
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

// ======================================================================================================================
describe('thẻ, chìa, mã chỉ lưu bản băm', () => {
  it('chìa 43 ký tự base64url; thẻ mpp_ + 43; mã 8 ký tự bảng 31 dạng ABCD-EFGH; hash = sha256 hex, KHÁC bản rõ', () => {
    const k = newLinkKey();
    expect(k.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(k.hash).toBe(sha(k.key));
    const t = newSessionToken();
    expect(t.token).toMatch(PORTAL_TOKEN_PATTERN);
    expect(t.hash).toBe(sha(t.token));
    const c = newHandoffCode();
    expect(c.code).toMatch(new RegExp(`^[${HANDOFF_ALPHABET}]{4}-[${HANDOFF_ALPHABET}]{4}$`));
    expect(c.hash).toBe(sha(c.code.replace('-', '')));
    expect(hashHandoffCode(c.code.toLowerCase())).toBe(c.hash);
    for (const x of [k.hash, t.hash, c.hash]) expect(x).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set([k.key, t.token, c.code]).has(k.hash)).toBe(false);
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    // Không lặp, không lệch bảng chữ.
    const many = new Set(Array.from({ length: 300 }, () => newHandoffCode().code));
    expect(many.size).toBe(300);
    expect(new Set([...[...many].join('').replace(/-/g, '')]).size).toBeGreaterThan(25);
  });

  it('phiên trong database chỉ có bản băm; tra bằng bản rõ không ra', async () => {
    const row = await deps.db.portalSession.findUniqueOrThrow({ where: { id: w.sessionId } });
    expect(row.tokenHash).toBe(sha(w.token));
    expect(JSON.stringify(row)).not.toContain(w.token);
    expect(await deps.db.portalSession.findUnique({ where: { tokenHash: w.token } })).toBeNull();
  });
});

// ======================================================================================================================
describe('cookie mp_portal — cờ đúng bản vẽ', () => {
  const setRoute = defineRoute({
    method: 'post',
    path: '/portal/thu-cookie-e2',
    scope: 'portal',
    summary: 'thử cookie',
    tag: 'Thử',
    handler: async () => ({ body: { ok: true }, cookies: [portalCookie(newSessionToken().token)] }),
  });
  const clearRoute = defineRoute({
    method: 'delete',
    path: '/portal/thu-cookie-e2',
    scope: 'portal',
    summary: 'thử xoá cookie',
    tag: 'Thử',
    handler: async () => ({ cookies: [CLEAR_PORTAL_COOKIE] }),
  });

  it('đặt: mp_portal=mpp_…; Max-Age 90 ngày; Path=/api/v1/portal; HttpOnly; SameSite=Strict; không Secure ngoài production', async () => {
    const res = await request(createApp(deps, [setRoute])).post('/api/v1/portal/thu-cookie-e2').set('x-client', 'portal').set('cookie', `${PORTAL_COOKIE}=${w.token}`).expect(200);
    const c = String(res.headers['set-cookie']);
    expect(c).toMatch(/^mp_portal=mpp_[A-Za-z0-9_-]{43};/);
    expect(c).toContain(`Max-Age=${PORTAL_SESSION_DAYS * 86_400}`);
    expect(c).toContain(`Path=${PORTAL_COOKIE_PATH}`);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Strict');
    expect(c).not.toContain('Secure');
    expect(PORTAL_COOKIE_PATH).toBe('/api/v1/portal');
  });

  it('production → thêm Secure; xoá cookie cùng path', async () => {
    const prod: Deps = { ...deps, env: { ...deps.env, NODE_ENV: 'production' } };
    const set = await request(createApp(prod, [setRoute])).post('/api/v1/portal/thu-cookie-e2').set('x-client', 'portal').set('cookie', `${PORTAL_COOKIE}=${w.token}`).expect(200);
    expect(String(set.headers['set-cookie'])).toMatch(/; Secure/);
    const clear = await request(createApp(deps, [clearRoute])).delete('/api/v1/portal/thu-cookie-e2').set('x-client', 'portal').set('cookie', `${PORTAL_COOKIE}=${w.token}`).expect(204);
    const c = String(clear.headers['set-cookie']);
    expect(c).toMatch(/^mp_portal=;/);
    expect(c).toContain('Path=/api/v1/portal');
    expect(c).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('readPortalCookie: tách đúng giữa nhiều cookie; hỏng dạng → null, không ném', () => {
    const r = (cookie?: string) => ({ header: (n: string) => (n === 'cookie' ? cookie : undefined) }) as never;
    expect(readPortalCookie(r(`a=1; ${PORTAL_COOKIE}=mpp_x; mp_refresh=y`))).toBe('mpp_x');
    expect(readPortalCookie(r('mp_refresh=y'))).toBeNull();
    expect(readPortalCookie(r(undefined))).toBeNull();
    expect(readPortalCookie(r(`${PORTAL_COOKIE}=%E0%A4%A`))).toBeNull();
  });
});

// ======================================================================================================================
describe('logger không in thẻ, chìa, 4 số, mã, cookie', () => {
  it('quét toàn bộ log của các yêu cầu cổng + đường nhân viên: không có bí mật nào; GIỮ: log có ghi và có chỗ che', async () => {
    const lines: string[] = [];
    const logger = createLogger('trace', { write: (s: string) => void lines.push(s) });
    const d: Deps = { ...deps, logger };
    const secret = { key: newLinkKey().key, last4: '7395', code: newHandoffCode().code };
    let issued = '';
    const logRoute = defineRoute({
      method: 'post',
      path: '/portal/thu-log-e2',
      scope: 'portal',
      summary: 'thử log',
      tag: 'Thử',
      body: z.object({ key: z.string(), last4: z.string(), code: z.string() }),
      handler: async ({ body, deps: dd }) => {
        dd.logger.info({ body }, 'thân yêu cầu cổng (bài thử)');
        issued = newSessionToken().token;
        return { body: { ok: true }, cookies: [portalCookie(issued)] };
      },
    });
    const app = createApp(d, [logRoute, ...authRoutes]);
    await request(app).post('/api/v1/portal/thu-log-e2').set('x-client', 'portal').set('cookie', `${PORTAL_COOKIE}=${w.token}`).send(secret).expect(200);
    await request(app).post('/api/v1/portal/thu-log-e2').set('x-client', 'portal').set('authorization', `Bearer ${w.token}`).send(secret).expect(401);
    await request(app).get('/api/v1/auth/me').set('authorization', `Bearer ${w.token}`).set('cookie', `${PORTAL_COOKIE}=${w.token}`).expect(401);
    const text = lines.join('\n');
    expect(issued).toMatch(PORTAL_TOKEN_PATTERN);
    const leaks = [
      ['thẻ phiên', w.token],
      ['thẻ vừa cấp', issued],
      ['thân thẻ (bỏ mpp_)', w.token.slice(4)],
      ['chìa', secret.key],
      ['mã chuyển máy', secret.code],
      ['4 số', `"${secret.last4}"`],
    ].filter(([, v]) => text.includes(v as string));
    console.log(`[khung] quét log: ${lines.length} dòng, lộ ${leaks.length}/6 loại bí mật`);
    expect(leaks).toEqual([]);
    // GIỮ: log thật sự có ghi yêu cầu + thân, và đã che.
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(text).toContain('thân yêu cầu cổng (bài thử)');
    expect(text).toContain('[ẩn]');
    expect(text).toContain('/api/v1/portal/thu-log-e2');
  });

  it('che mã chuyển máy nhưng KHÔNG che err.code: lỗi Prisma P2002 vẫn hiện mã trong log "Lỗi không lường trước"', async () => {
    const lines: string[] = [];
    const logger = createLogger('trace', { write: (s: string) => void lines.push(s) });
    const code = newHandoffCode().code;
    const boom = defineRoute({
      method: 'post',
      path: '/portal/thu-loi-e2',
      scope: 'portal',
      summary: 'thử lỗi',
      tag: 'Thử',
      body: z.object({ code: z.string() }),
      handler: async ({ body, deps: dd }) => {
        dd.logger.info({ body, handoffCode: body.code, device: { handoffCode: body.code } }, 'mã chuyển máy (bài thử)');
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      },
    });
    const app = createApp({ ...deps, logger }, [boom]);
    await request(app).post('/api/v1/portal/thu-loi-e2').set('x-client', 'portal').set('cookie', `${PORTAL_COOKIE}=${w.token}`).send({ code }).expect(500);
    const text = lines.join('\n');
    const errLine = lines.find((l) => l.includes('Lỗi không lường trước'));
    expect(errLine, 'phải có dòng log lỗi').toBeDefined();
    expect(JSON.parse(errLine ?? '{}').err.code).toBe('P2002');
    expect(text).toContain('mã chuyển máy (bài thử)');
    expect(text.includes(code) || text.includes(code.replace('-', ''))).toBe(false);
    console.log(`[khung] log lỗi: err.code = ${JSON.parse(errLine ?? '{}').err.code}; mã chuyển máy lộ: ${text.includes(code) ? 1 : 0}/3 chỗ`);
  });
});

// ======================================================================================================================
describe('OpenAPI, biến môi trường, chuỗi cấm', () => {
  it('OpenAPI khai portalCookie; đường portal dùng portalCookie, không bearer', async () => {
    const res = await request(createApp(deps, [...ALL_ROUTES, probeRoute])).get('/api/v1/openapi.json').expect(200);
    expect(res.body.components.securitySchemes.portalCookie).toEqual({ type: 'apiKey', in: 'cookie', name: 'mp_portal' });
    expect(res.body.paths['/api/v1/portal/thu-khung-e2'].get.security).toEqual([{ portalCookie: [] }]);
    expect(res.body.paths['/api/v1/auth/me'].get.security).toEqual([{ bearer: [] }]);
  });

  it('PORTAL_RATE_LIMIT_PER_MINUTE: khai sai (0, chữ, dòng rỗng) → không khởi động, lỗi nêu tên biến; .env.example khai 10', () => {
    for (const bad of ['0', '-1', 'muoi', '', '2.5']) {
      expect(() => loadEnv({ ...process.env, PORTAL_RATE_LIMIT_PER_MINUTE: bad }), bad).toThrow(/PORTAL_RATE_LIMIT_PER_MINUTE/);
    }
    expect(loadEnv({ ...process.env, PORTAL_RATE_LIMIT_PER_MINUTE: '7' }).PORTAL_RATE_LIMIT_PER_MINUTE).toBe(7);
    const example = readFileSync(path.resolve(__dirname, '../.env.example'), 'utf8');
    expect(example).toMatch(/^PORTAL_RATE_LIMIT_PER_MINUTE=10$/m);
  });

  it('thiếu biến bắt buộc (JWT_ACCESS_SECRET, DATABASE_URL) → loadEnv ném lỗi có TÊN biến, không in giá trị', () => {
    const { JWT_ACCESS_SECRET: _j, ...noJwt } = process.env;
    expect(() => loadEnv(noJwt)).toThrow(/Cấu hình môi trường không hợp lệ.*JWT_ACCESS_SECRET/);
    const { DATABASE_URL: _d, ...noDb } = process.env;
    expect(() => loadEnv(noDb)).toThrow(/DATABASE_URL/);
    try {
      loadEnv({ ...process.env, JWT_ACCESS_SECRET: 'ngan-qua-bi-mat' });
    } catch (e) {
      expect(String(e)).toContain('JWT_ACCESS_SECRET');
      expect(String(e)).not.toContain('ngan-qua-bi-mat');
    }
  });

  // Bản vẽ E 2.2 luật 4, 6.4: không có chìa vượt quyền trong mã máy chủ.
  const FORBIDDEN = ['BYPASS', 'SUPER_ADMIN', 'accessToken='];
  const scan = (files: { name: string; text: string }[]) =>
    files.flatMap((f) => FORBIDDEN.filter((s) => f.text.includes(s)).map((s) => `${f.name}: ${s}`));
  const listFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = path.join(dir, n);
      return statSync(p).isDirectory() ? listFiles(p) : [p];
    });

  it('grep toàn văn apps/api/src: không BYPASS, SUPER_ADMIN, accessToken= ; vế đỏ: chuỗi cài vào thì bắt được', () => {
    const files = listFiles(API_SRC).map((p) => ({ name: path.relative(API_SRC, p), text: readFileSync(p, 'utf8') }));
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.name === path.join('modules', 'portal', 'auth.ts'))).toBe(true);
    const hits = scan(files);
    console.log(`[khung] chuỗi cấm: quét ${files.length} tệp apps/api/src, trúng ${hits.length}`);
    expect(hits).toEqual([]);
    expect(scan([{ name: 'gia.ts', text: "if (q.accessToken === 'SUPER_ADMIN_BYPASS') ok();\nurl + '?accessToken=' + t" }])).toHaveLength(3);
  });
});
