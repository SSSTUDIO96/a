// Bản vẽ E, gói E3 — VÀO cổng học viên (mục 4.2; bài thử 6.2 phần E3, tệp cong-hoc-vien-vao.test.ts, ca 1–14).
// Mỗi bài ghi BẮT (bắt một lỗi cụ thể) hoặc GIỮ (giữ một hành vi đã chốt). Đường dẫn tạo / thu hồi / chặn máy đi ĐƯỜNG THẬT
// của E4; mở / chuyển máy / thoát đi ĐƯỜNG THẬT của E3. Chỉ ghi thẳng database để giả thời gian (lùi mốc) hoặc trạng thái
// tổ chức.
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PORTAL_DENIED_MESSAGE,
  PORTAL_HANDOFF_MINUTES,
  PORTAL_SESSION_DAYS,
  PORTAL_SESSION_INVALID_MESSAGE,
} from '@makeup/shared';
import { createApp } from '../src/app';
import { createLogger } from '../src/lib/logger';
import { sha256Hex } from '../src/modules/portal/tokens';
import { bearer, type App } from './helpers';
import {
  api,
  claimPortal,
  createLink,
  IPHONE_SAFARI,
  makeApp,
  makePortalDeps,
  makeStudent,
  me,
  openOk,
  openPortal,
  portalCall,
  portalTokenOf,
  setupAcademy,
  type Academy,
  type Student,
} from './portal-helpers';

const deps = makePortalDeps();
let app: App;
let A: Academy;
let B: Academy;

beforeAll(async () => {
  app = makeApp(deps);
  A = await setupAcademy(app, deps, 'va');
  B = await setupAcademy(app, deps, 'vb');
});

afterAll(async () => {
  await deps.db.$disconnect();
});

const DAY_MS = 86_400_000;
const wrong = (s: Student) => String((Number(s.last4) + 1) % 10_000).padStart(4, '0');
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

async function studentWithLink(a: Academy, name = `Học viên ${randomUUID().slice(0, 6)}`) {
  const s = await makeStudent(deps, a, name);
  const key = await createLink(app, a, s.id);
  return { s, key };
}

const linkOf = (key: string) => deps.db.portalLink.findUniqueOrThrow({ where: { keyHash: sha256Hex(key) } });
const devicesOf = (customerId: string) => deps.db.portalDevice.count({ where: { customerId } });

// Lời chung đã bỏ requestId — so giữa các lần hỏng.
function deniedShape(res: Response) {
  const { requestId, ...rest } = res.body.error ?? {};
  expect(typeof requestId).toBe('string');
  return { status: res.status, body: { error: rest } };
}
// Tập tên header (bỏ những header đổi theo từng yêu cầu).
function headerNames(res: Response): string[] {
  return Object.keys(res.headers)
    .map((h) => h.toLowerCase())
    .filter((h) => !['date', 'x-request-id', 'etag', 'content-length'].includes(h) && !h.startsWith('ratelimit'))
    .sort();
}
const COMMON_DENIED = {
  status: 401,
  body: { error: { code: 'UNAUTHENTICATED', message: PORTAL_DENIED_MESSAGE, details: { reason: 'PORTAL_DENIED' } } },
};

async function timed(run: () => PromiseLike<Response>): Promise<{ res: Response; ms: number }> {
  const t = Date.now();
  const res = await run();
  return { res, ms: Date.now() - t };
}

async function revokeVia(a: Academy, customerId: string) {
  const r = await request(app).post(`${api(a)}/customers/${customerId}/portal/revoke`).set(bearer(a.owner)).send({ reason: 'Thử thu hồi' });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as { devicesEnded: number };
}
async function blockVia(a: Academy, deviceId: string) {
  const r = await request(app).post(`${api(a)}/portal-devices/${deviceId}/block`).set(bearer(a.owner)).send({ reason: 'Mất máy' });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}
const sessionOf = (token: string) => deps.db.portalSession.findUniqueOrThrow({ where: { tokenHash: sha256Hex(token) } });

describe('1. Mở đúng 4 số', () => {
  it('GIỮ: 201, cookie mp_portal=mpp_… Path=/api/v1/portal HttpOnly SameSite=Strict, thân CHỈ { ok: true }, no-store; /me 200', async () => {
    const { s, key } = await studentWithLink(A, 'Nguyễn Thị Mở Đúng');
    const res = await openPortal(app, key, s.last4);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['cache-control']).toBe('no-store');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/^mp_portal=mpp_[A-Za-z0-9_-]{43}; /);
    expect(cookies[0]).toContain('Path=/api/v1/portal');
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('SameSite=Strict');
    const token = portalTokenOf(res) ?? '';
    const page = await me(app, token);
    expect(page.status, JSON.stringify(page.body)).toBe(200);
    expect(page.body.student.fullName).toBe('Nguyễn Thị Mở Đúng');
    expect(page.body.device.label).toBe('iPhone · Safari');
    // Database chỉ giữ bản băm thẻ.
    expect((await sessionOf(token)).tokenHash).toBe(sha256Hex(token));
  });
});

describe('2. Chống dò: mọi lần hỏng cùng status, cùng thân, cùng bộ header, ≥ 290 ms', () => {
  it('BẮT: chìa bịa / sai 4 số / thu hồi / hết hạn / khoá / đủ 2 máy / mất SĐT / tổ chức khoá / thiếu X-Client → giống hệt nhau', async () => {
    const cases: { name: string; run: () => PromiseLike<Response> }[] = [];
    // chìa không có thật
    cases.push({ name: 'chìa bịa', run: () => openPortal(app, randomBytes(32).toString('base64url'), '1234') });
    // sai 4 số
    const w = await studentWithLink(A);
    cases.push({ name: 'sai 4 số', run: () => openPortal(app, w.key, wrong(w.s)) });
    // đã thu hồi
    const r = await studentWithLink(A);
    await revokeVia(A, r.s.id);
    cases.push({ name: 'thu hồi', run: () => openPortal(app, r.key, r.s.last4) });
    // hết hạn (chưa mở, lùi cả created_at lẫn expires_at)
    const e = await studentWithLink(A);
    await deps.db.$executeRaw`UPDATE portal_links SET created_at = now() - interval '8 days', expires_at = now() - interval '1 day' WHERE key_hash = ${sha256Hex(e.key)}`;
    cases.push({ name: 'hết hạn', run: () => openPortal(app, e.key, e.s.last4) });
    // đã khoá (sai đủ 5 lần qua đường thật)
    const l = await studentWithLink(A);
    for (let i = 0; i < 5; i++) expect((await openPortal(app, l.key, wrong(l.s))).status).toBe(401);
    cases.push({ name: 'khoá', run: () => openPortal(app, l.key, l.s.last4) });
    // đủ 2 máy
    const f = await studentWithLink(A);
    await openOk(app, f.key, f.s.last4);
    await openOk(app, f.key, f.s.last4, { ua: ANDROID });
    cases.push({ name: 'đủ 2 máy', run: () => openPortal(app, f.key, f.s.last4) });
    // khách đã xoá SĐT
    const n = await studentWithLink(A);
    await deps.db.customer.update({ where: { id: n.s.id }, data: { phone: null } });
    cases.push({ name: 'mất SĐT', run: () => openPortal(app, n.key, n.s.last4) });
    // thiếu X-Client (chìa thật, đúng 4 số)
    const x = await studentWithLink(A);
    cases.push({ name: 'thiếu X-Client', run: () => openPortal(app, x.key, x.s.last4, { headers: {} }) });
    cases.push({ name: 'X-Client sai', run: () => openPortal(app, x.key, x.s.last4, { headers: { 'x-client': 'web' } }) });
    // tổ chức bị khoá (tổ chức B, mở lại ngay sau)
    const o = await studentWithLink(B);
    cases.push({
      name: 'tổ chức khoá',
      run: async () => {
        await deps.db.organization.update({ where: { id: B.orgId }, data: { status: 'SUSPENDED' } });
        try {
          return await openPortal(app, o.key, o.s.last4);
        } finally {
          await deps.db.organization.update({ where: { id: B.orgId }, data: { status: 'ACTIVE' } });
        }
      },
    });

    const results: { name: string; res: Response; ms: number }[] = [];
    for (const c of cases) results.push({ name: c.name, ...(await timed(c.run)) });
    const headerSet = headerNames(results[0]!.res);
    for (const { name, res, ms } of results) {
      expect(deniedShape(res), name).toEqual(COMMON_DENIED);
      expect(headerNames(res), name).toEqual(headerSet);
      expect(res.headers['set-cookie'], name).toBeUndefined();
      expect(ms, name).toBeGreaterThanOrEqual(290);
    }
    expect(headerSet).toContain('cache-control');
    // Không ghi audit cho chìa bịa / thiếu X-Client; chìa thật thì có lý do đúng.
    const reasons = await deps.db.auditLog.findMany({
      where: { action: 'portal.open_rejected', entityId: { in: [await linkOf(r.key), await linkOf(e.key), await linkOf(f.key), await linkOf(n.key), await linkOf(x.key), await linkOf(o.key)].map((k) => k.id) } },
      select: { entityId: true, data: true },
    });
    const byLink = new Map(reasons.map((a) => [a.entityId, (a.data as { reason: string }).reason]));
    expect(byLink.get((await linkOf(r.key)).id)).toBe('REVOKED');
    expect(byLink.get((await linkOf(e.key)).id)).toBe('EXPIRED');
    expect(byLink.get((await linkOf(f.key)).id)).toBe('FULL');
    expect(byLink.get((await linkOf(n.key)).id)).toBe('NO_PHONE');
    expect(byLink.get((await linkOf(o.key)).id)).toBe('ORG_SUSPENDED');
    expect(byLink.has((await linkOf(x.key)).id)).toBe(false);
  });

  it('GIỮ: mở được cũng mất ≥ 290 ms (sàn thời gian áp cả lần thành công)', async () => {
    const { s, key } = await studentWithLink(A);
    const { res, ms } = await timed(() => openPortal(app, key, s.last4));
    expect(res.status).toBe(201);
    expect(ms).toBeGreaterThanOrEqual(290);
  });

  it('GIỮ: 4 số sai dạng → 400 (không phụ thuộc chìa có thật hay không, không lộ gì); chìa rỗng → 400', async () => {
    const { key } = await studentWithLink(A);
    for (const bad of ['123', '12345', 'abcd', '12 4']) {
      expect((await openPortal(app, key, bad)).status, bad).toBe(400);
      expect((await openPortal(app, randomBytes(32).toString('base64url'), bad)).status, bad).toBe(400);
    }
    expect((await openPortal(app, '', '1234')).status).toBe(400);
  });
});

describe('3. Bộ đếm sai và khoá', () => {
  it('BẮT: sai 4 lần rồi đúng → vào được, failed_attempts về 0', async () => {
    const { s, key } = await studentWithLink(A);
    for (let i = 0; i < 4; i++) expect((await openPortal(app, key, wrong(s))).status).toBe(401);
    expect((await linkOf(key)).failedAttempts).toBe(4);
    await openOk(app, key, s.last4);
    const link = await linkOf(key);
    expect([link.failedAttempts, link.lockedAt]).toEqual([0, null]);
  });

  it('BẮT: sai 5 lần → khoá (locked_at), đúng sau đó vẫn từ chối; GIỮ: máy mở trước khi khoá vẫn 200', async () => {
    const { s, key } = await studentWithLink(A);
    const before = await openOk(app, key, s.last4);
    for (let i = 0; i < 5; i++) expect((await openPortal(app, key, wrong(s))).status).toBe(401);
    const link = await linkOf(key);
    expect(link.failedAttempts).toBe(5);
    expect(link.lockedAt).not.toBeNull();
    expect(deniedShape(await openPortal(app, key, s.last4))).toEqual(COMMON_DENIED);
    expect((await me(app, before)).status).toBe(200);
    const locked = await deps.db.auditLog.count({ where: { action: 'portal.link_locked', entityId: link.id } });
    expect(locked).toBe(1);
  });
});

describe('4. Hết hạn 7 ngày chỉ áp cho đường dẫn chưa mở', () => {
  it('BẮT: chưa mở, quá hạn → từ chối; GIỮ: đã mở một máy, lùi quá 7 ngày → máy thứ hai vẫn vào được (ký duyệt E câu 1)', async () => {
    const fresh = await studentWithLink(A);
    await deps.db.$executeRaw`UPDATE portal_links SET created_at = now() - interval '8 days', expires_at = now() - interval '1 day' WHERE key_hash = ${sha256Hex(fresh.key)}`;
    expect(deniedShape(await openPortal(app, fresh.key, fresh.s.last4))).toEqual(COMMON_DENIED);

    const used = await studentWithLink(A);
    await openOk(app, used.key, used.s.last4);
    await deps.db.$executeRaw`UPDATE portal_links SET created_at = now() - interval '30 days', expires_at = now() - interval '23 days' WHERE key_hash = ${sha256Hex(used.key)}`;
    await openOk(app, used.key, used.s.last4, { ua: ANDROID });
    expect(await devicesOf(used.s.id)).toBe(2);
  });
});

describe('5. Tối đa 2 máy', () => {
  it('BẮT: máy 1, 2 vào được, máy 3 từ chối', async () => {
    const { s, key } = await studentWithLink(A);
    await openOk(app, key, s.last4);
    await openOk(app, key, s.last4, { ua: ANDROID });
    expect(deniedShape(await openPortal(app, key, s.last4))).toEqual(COMMON_DENIED);
    expect(await devicesOf(s.id)).toBe(2);
  });

  it('BẮT (ca đua): 5 yêu cầu đúng 4 số đồng thời → đúng 2 thành công, database đúng 2 máy', async () => {
    const { s, key } = await studentWithLink(A);
    const all = await Promise.all(Array.from({ length: 5 }, () => openPortal(app, key, s.last4)));
    const statuses = all.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 201, 401, 401, 401]);
    for (const r of all.filter((x) => x.status === 401)) expect(deniedShape(r)).toEqual(COMMON_DENIED);
    expect(await devicesOf(s.id)).toBe(2);
    expect(await deps.db.portalSession.count({ where: { customerId: s.id } })).toBe(2);
  });
});

describe('6. Một trình duyệt giữ một phiên', () => {
  it('GIỮ: đã có phiên → /me 200, không tạo máy; BẮT: gọi thẳng POST /portal/session lần nữa → phiên cũ của trình duyệt bị thu hồi', async () => {
    const { s, key } = await studentWithLink(A);
    const first = await openOk(app, key, s.last4);
    // Web gọi /me trước: có phiên → vào thẳng, không tốn suất.
    expect((await me(app, first)).status).toBe(200);
    expect(await devicesOf(s.id)).toBe(1);
    // Gọi thẳng POST /portal/session với cookie cũ.
    const second = await openOk(app, key, s.last4, { token: first });
    expect(second).not.toBe(first);
    expect((await sessionOf(first)).revokedAt).not.toBeNull();
    expect((await me(app, first)).status).toBe(401);
    expect((await me(app, second)).status).toBe(200);
    const live = await deps.db.portalSession.count({ where: { customerId: s.id, revokedAt: null } });
    expect(live).toBe(1);
  });
});

describe('7–8. Thu hồi, chặn máy, đường dẫn mới (đường thật của E4)', () => {
  it('BẮT: thu hồi → mọi máy 401 ở yêu cầu kế tiếp; đường dẫn → từ chối', async () => {
    const { s, key } = await studentWithLink(A);
    const t1 = await openOk(app, key, s.last4);
    const t2 = await openOk(app, key, s.last4, { ua: ANDROID });
    expect((await me(app, t1)).status).toBe(200);
    expect((await revokeVia(A, s.id)).devicesEnded).toBe(2);
    for (const t of [t1, t2]) {
      const r = await me(app, t);
      expect(r.status).toBe(401);
      expect(r.body.error.message).toBe(PORTAL_SESSION_INVALID_MESSAGE);
    }
    expect(deniedShape(await openPortal(app, key, s.last4))).toEqual(COMMON_DENIED);
  });

  it('BẮT: chặn một máy → máy đó 401, máy kia vẫn 200', async () => {
    const { s, key } = await studentWithLink(A);
    const t1 = await openOk(app, key, s.last4);
    const t2 = await openOk(app, key, s.last4, { ua: ANDROID });
    await blockVia(A, (await sessionOf(t1)).deviceId);
    expect((await me(app, t1)).status).toBe(401);
    expect((await me(app, t2)).status).toBe(200);
  });

  it('GIỮ: tạo đường dẫn mới → đường dẫn cũ từ chối, máy cũ vẫn 200; đường dẫn mới mở được', async () => {
    const { s, key } = await studentWithLink(A);
    const old = await openOk(app, key, s.last4);
    const key2 = await createLink(app, A, s.id);
    expect(deniedShape(await openPortal(app, key, s.last4))).toEqual(COMMON_DENIED);
    expect((await me(app, old)).status).toBe(200);
    await openOk(app, key2, s.last4, { ua: ANDROID });
  });
});

describe('9. Thoát khỏi máy này', () => {
  it('BẮT: DELETE → 204, xoá cookie, phiên 401, máy SIGNED_OUT; GIỮ: suất máy vẫn tính (máy thứ 3 vẫn bị từ chối)', async () => {
    const { s, key } = await studentWithLink(A);
    const t = await openOk(app, key, s.last4);
    const out = await portalCall(app, 'delete', '/session', t);
    expect(out.status).toBe(204);
    expect(out.headers['cache-control']).toBe('no-store');
    const cleared = (out.headers['set-cookie'] as unknown as string[])[0] ?? '';
    expect(cleared).toMatch(/^mp_portal=;/);
    expect(cleared).toContain('Path=/api/v1/portal');
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await me(app, t)).status).toBe(401);
    const dev = await deps.db.portalDevice.findFirstOrThrow({ where: { customerId: s.id } });
    expect([dev.endReason, dev.endedAt !== null, dev.endedById]).toEqual(['SIGNED_OUT', true, null]);
    // Thoát lần hai với phiên đã chết → 401 (không 500).
    expect((await portalCall(app, 'delete', '/session', t)).status).toBe(401);
    await openOk(app, key, s.last4, { ua: ANDROID });
    expect(deniedShape(await openPortal(app, key, s.last4))).toEqual(COMMON_DENIED);
  });
});

describe('10. Hạn phiên 90 ngày trượt', () => {
  it('BẮT: expires_at đã qua → 401', async () => {
    const { s, key } = await studentWithLink(A);
    const t = await openOk(app, key, s.last4);
    await deps.db.$executeRaw`UPDATE portal_sessions SET created_at = now() - interval '91 days', last_used_at = now() - interval '91 days', expires_at = now() - interval '1 minute' WHERE token_hash = ${sha256Hex(t)}`;
    expect((await me(app, t)).status).toBe(401);
  });

  it('GIỮ: last_used_at cũ hơn 60 phút → sau /me, expires_at ≈ now + 90 ngày; cookie đặt lại Max-Age 90 ngày', async () => {
    const { s, key } = await studentWithLink(A);
    const t = await openOk(app, key, s.last4);
    await deps.db.$executeRaw`UPDATE portal_sessions SET created_at = now() - interval '10 days', last_used_at = now() - interval '2 hours', expires_at = now() + interval '1 day' WHERE token_hash = ${sha256Hex(t)}`;
    const r = await me(app, t);
    expect(r.status).toBe(200);
    const sess = await sessionOf(t);
    expect(Math.abs(sess.expiresAt.getTime() - (Date.now() + PORTAL_SESSION_DAYS * DAY_MS))).toBeLessThan(60_000);
    const cookie = (r.headers['set-cookie'] as unknown as string[])[0] ?? '';
    expect(cookie).toContain(`mp_portal=${t}`);
    expect(cookie).toContain(`Max-Age=${PORTAL_SESSION_DAYS * 86_400}`);
  });
});

describe('11. Chuyển sang app bằng mã', () => {
  it('BẮT: mã → phiên mới cùng máy (devicesUsed không đổi); mã dùng lần 2 / quá 10 phút / máy đã chặn → lời chung', async () => {
    const { s, key } = await studentWithLink(A);
    const t = await openOk(app, key, s.last4);
    const h = await portalCall(app, 'post', '/session/handoff', t);
    expect(h.status, JSON.stringify(h.body)).toBe(201);
    expect(h.headers['cache-control']).toBe('no-store');
    expect(Object.keys(h.body).sort()).toEqual(['code', 'expiresAt']);
    expect(h.body.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    expect(Math.abs(new Date(h.body.expiresAt).getTime() - (Date.now() + PORTAL_HANDOFF_MINUTES * 60_000))).toBeLessThan(60_000);
    // Gõ thường, bỏ gạch vẫn khớp.
    const claimed = await claimPortal(app, (h.body.code as string).replace('-', '').toLowerCase());
    expect(claimed.status, JSON.stringify(claimed.body)).toBe(201);
    expect(claimed.body).toEqual({ ok: true });
    const t2 = portalTokenOf(claimed) ?? '';
    expect(t2).toMatch(/^mpp_/);
    expect((await sessionOf(t2)).deviceId).toBe((await sessionOf(t)).deviceId);
    expect((await me(app, t2)).status).toBe(200);
    expect((await me(app, t)).status).toBe(200);
    const view = await request(app).get(`${api(A)}/customers/${s.id}/portal`).set(bearer(A.owner)).expect(200);
    expect(view.body.link.devicesUsed).toBe(1);
    const dev = await deps.db.portalDevice.findFirstOrThrow({ where: { customerId: s.id } });
    expect([dev.handoffHash, dev.handoffExpiresAt]).toEqual([null, null]);

    // Dùng lần 2.
    const again = await timed(() => claimPortal(app, h.body.code));
    expect(deniedShape(again.res)).toEqual(COMMON_DENIED);
    expect(again.ms).toBeGreaterThanOrEqual(290);
    // Mã bịa.
    expect(deniedShape(await claimPortal(app, 'ABCD-EFGH'))).toEqual(COMMON_DENIED);
    // Quá 10 phút.
    const h2 = await portalCall(app, 'post', '/session/handoff', t);
    await deps.db.portalDevice.update({ where: { id: dev.id }, data: { handoffExpiresAt: new Date(Date.now() - 1000) } });
    expect(deniedShape(await claimPortal(app, h2.body.code))).toEqual(COMMON_DENIED);
    // Thiếu X-Client với mã còn hạn.
    const h3 = await portalCall(app, 'post', '/session/handoff', t);
    expect(deniedShape(await claimPortal(app, h3.body.code, { headers: {} }))).toEqual(COMMON_DENIED);
    // Máy đã chặn.
    await blockVia(A, dev.id);
    expect(deniedShape(await claimPortal(app, h3.body.code))).toEqual(COMMON_DENIED);
    // Bộ header giống hệt lời chung của POST /portal/session.
    const ref = await openPortal(app, randomBytes(32).toString('base64url'), '1234');
    expect(headerNames(again.res)).toEqual(headerNames(ref));
  });

  it('BẮT: phiên thứ 4 trên một máy → phiên dùng lâu nhất bị thu hồi', async () => {
    const { s, key } = await studentWithLink(A);
    const t0 = await openOk(app, key, s.last4);
    const tokens: string[] = [];
    for (let i = 0; i < 3; i++) {
      const h = await portalCall(app, 'post', '/session/handoff', t0);
      expect(h.status).toBe(201);
      const c = await claimPortal(app, h.body.code);
      expect(c.status).toBe(201);
      tokens.push(portalTokenOf(c) ?? '');
      if (i === 0) {
        // t0 phải là phiên "dùng lâu nhất": lùi last_used_at (vẫn trong 60 phút để /me không chạm mốc).
        await deps.db.$executeRaw`UPDATE portal_sessions SET last_used_at = now() - interval '30 minutes', created_at = now() - interval '30 minutes' WHERE token_hash = ${sha256Hex(t0)}`;
      }
    }
    expect((await me(app, t0)).status).toBe(401);
    for (const t of tokens) expect((await me(app, t)).status).toBe(200);
    const live = await deps.db.portalSession.count({ where: { customerId: s.id, revokedAt: null } });
    expect(live).toBe(3);
  });

  it('GIỮ: tạo mã khi phiên không hợp lệ → 401 (đường scope portal)', async () => {
    const r = await request(app).post('/api/v1/portal/session/handoff').set({ 'x-client': 'portal' });
    expect(r.status).toBe(401);
  });
});

describe('12. Tổ chức bị khoá', () => {
  it('BẮT: tổ chức SUSPENDED → /me 403; mở khoá → 200', async () => {
    const { s, key } = await studentWithLink(B);
    const t = await openOk(app, key, s.last4);
    await deps.db.organization.update({ where: { id: B.orgId }, data: { status: 'SUSPENDED' } });
    try {
      const r = await me(app, t);
      expect(r.status).toBe(403);
      expect(r.body.error.message).toBe('Trang học viên đang tạm đóng. Vui lòng liên hệ trung tâm.');
    } finally {
      await deps.db.organization.update({ where: { id: B.orgId }, data: { status: 'ACTIVE' } });
    }
    expect((await me(app, t)).status).toBe(200);
  });
});

describe('13. Không lộ chìa, thẻ, mã, 4 số', () => {
  it('BẮT: sau khi tạo, mở, chuyển máy: bảng cổng, audit, idempotency_keys và log không chứa chìa / mpp_ / mã / 4 số', async () => {
    const logs: string[] = [];
    const logged = { ...deps, logger: createLogger('debug', { write: (s: string) => void logs.push(s) }) };
    const lapp = createApp(logged);
    const s = await makeStudent(deps, A, 'Học viên Không Lộ');
    const created = await request(lapp).post(`${api(A)}/customers/${s.id}/portal/links`).set(bearer(A.owner)).send({ phoneConfirmed: true });
    expect(created.status).toBe(201);
    const key = created.body.key as string;
    expect((await openPortal(lapp, key, wrong(s))).status).toBe(401);
    const t = await openOk(lapp, key, s.last4);
    const h = await portalCall(lapp, 'post', '/session/handoff', t);
    const c = await claimPortal(lapp, h.body.code);
    expect(c.status).toBe(201);
    const t2 = portalTokenOf(c) ?? '';
    expect((await me(lapp, t2)).status).toBe(200);
    await portalCall(lapp, 'delete', '/session', t2);

    const dump = await deps.db.$queryRaw<{ t: string }[]>`
      SELECT row_to_json(x)::text AS t FROM portal_links x WHERE organization_id = ${A.orgId}::uuid
      UNION ALL SELECT row_to_json(x)::text FROM portal_devices x WHERE organization_id = ${A.orgId}::uuid
      UNION ALL SELECT row_to_json(x)::text FROM portal_sessions x WHERE organization_id = ${A.orgId}::uuid
      UNION ALL SELECT row_to_json(x)::text FROM audit_logs x WHERE organization_id = ${A.orgId}::uuid
      UNION ALL SELECT row_to_json(x)::text FROM idempotency_keys x WHERE organization_id = ${A.orgId}::uuid`;
    const db = dump.map((r) => r.t).join('\n');
    const logText = logs.join('\n');
    expect(logText.length).toBeGreaterThan(0);
    const code = h.body.code as string;
    const secrets = [key, t, t2, code, code.replace('-', ''), `"${s.last4}"`, `"${wrong(s)}"`];
    for (const sec of secrets) {
      expect(db.includes(sec), `database chứa ${sec.slice(0, 6)}…`).toBe(false);
      expect(logText.includes(sec), `log chứa ${sec.slice(0, 6)}…`).toBe(false);
    }
    expect(db).not.toMatch(/mpp_/);
    expect(logText).not.toMatch(/mpp_/);
    // Bản băm có trong database (chứng minh quét đúng chỗ).
    expect(db).toContain(sha256Hex(key));
  });
});

describe('14. Audit đủ sự kiện, actor null với sự kiện của học viên', () => {
  it('GIỮ: link_created, open_rejected, link_locked, device_added, handoff_created, handoff_claimed, signed_out, device_blocked, link_revoked', async () => {
    const start = new Date();
    // Khoá: sai 5 lần.
    const lk = await studentWithLink(A);
    for (let i = 0; i < 5; i++) await openPortal(app, lk.key, wrong(lk.s));
    // Đi trọn: mở 2 máy, chuyển máy, thoát, chặn, thu hồi.
    const { s, key } = await studentWithLink(A);
    const t1 = await openOk(app, key, s.last4);
    const t2 = await openOk(app, key, s.last4, { ua: ANDROID });
    const h = await portalCall(app, 'post', '/session/handoff', t1);
    expect((await claimPortal(app, h.body.code)).status).toBe(201);
    await portalCall(app, 'delete', '/session', t1);
    await blockVia(A, (await sessionOf(t2)).deviceId);
    await revokeVia(A, s.id);
    // Chìa bịa không ghi gì.
    const before = await deps.db.auditLog.count({ where: { action: 'portal.open_rejected' } });
    await openPortal(app, randomBytes(32).toString('base64url'), '1234');
    expect(await deps.db.auditLog.count({ where: { action: 'portal.open_rejected' } })).toBe(before);

    const rows = await deps.db.auditLog.findMany({
      where: { createdAt: { gte: start }, action: { startsWith: 'portal.' }, organizationId: A.orgId },
      select: { action: true, actorUserId: true, organizationId: true, entityType: true, data: true },
    });
    const actions = new Set(rows.map((r) => r.action));
    for (const a of [
      'portal.link_created',
      'portal.open_rejected',
      'portal.link_locked',
      'portal.device_added',
      'portal.handoff_created',
      'portal.handoff_claimed',
      'portal.signed_out',
      'portal.device_blocked',
      'portal.link_revoked',
    ]) {
      expect(actions.has(a), a).toBe(true);
    }
    const studentEvents = ['portal.open_rejected', 'portal.link_locked', 'portal.device_added', 'portal.handoff_created', 'portal.handoff_claimed', 'portal.signed_out'];
    for (const r of rows.filter((x) => studentEvents.includes(x.action))) {
      expect(r.actorUserId, r.action).toBeNull();
      expect(r.organizationId).toBe(A.orgId);
    }
    const added = rows.find((r) => r.action === 'portal.device_added');
    expect(added?.entityType).toBe('portal_device');
    expect(Object.keys(added?.data as object).sort()).toEqual(['customerId', 'label', 'linkId']);
    expect((added?.data as { label: string }).label).toBe('iPhone · Safari');
    for (const r of rows) expect(JSON.stringify(r.data)).not.toMatch(/mpp_|"last4"|"key"|"code"|Hash/);
    void IPHONE_SAFARI;
  });
});
