// Bản vẽ E mục 6.2 phần E4 — đường PHÍA TRUNG TÂM của cổng học viên (tạo / thu hồi đường dẫn, chặn máy, xem trạng thái)
// và cài đặt cổng (số tài khoản). Khi E3 chưa xong, máy và phiên dựng bằng ghi thẳng Prisma (chỉ bản băm); "phiên còn
// dùng được không" kiểm qua một đường cổng THỬ đi đúng authenticatePortal thật (cùng khuôn bài thử khung E2).
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PORTAL_SESSION_DAYS, SYSTEM_ROLE_KEYS, type SystemRoleKey } from '@makeup/shared';
import { ALL_ROUTES, createApp } from '../src/app';
import { defineRoute, mustPortal } from '../src/http/route';
import { PORTAL_COOKIE } from '../src/modules/portal/cookie';
import { newSessionToken } from '../src/modules/portal/tokens';
import { syncSystemRoles } from '../src/scripts/sync-system-roles';
import { addMember, bearer, createAcademyOrg, createOrg, makeDeps, registerUser, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;

// Đường cổng THỬ (địa chỉ riêng, không trùng đường thật của E3): 200 khi phiên còn sống, 401 khi đã bị chặn / thu hồi.
const probeRoute = defineRoute({
  method: 'get',
  path: '/portal/thu-e4',
  scope: 'portal',
  summary: 'Đường cổng thử của bài thử E4',
  tag: 'Thử',
  handler: async ({ portal }) => ({ body: { customerId: mustPortal(portal).customerId } }),
});
const app = createApp(deps, [...ALL_ROUTES, probeRoute]);

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const idem = () => ({ 'idempotency-key': `k-${randomUUID()}` });
const api = (orgId: string, p: string) => `/api/v1/orgs/${orgId}${p}`;
const probe = (token: string) =>
  request(app).get('/api/v1/portal/thu-e4').set('x-client', 'portal').set('cookie', `${PORTAL_COOKIE}=${token}`);
// Thân lỗi bỏ requestId (so "mã của tổ chức khác" với "mã bịa").
const errBody = (r: request.Response) => ({ status: r.status, code: r.body?.error?.code, message: r.body?.error?.message, details: r.body?.error?.details });

const ROLE_ORDER = SYSTEM_ROLE_KEYS.filter((k) => k !== 'owner');

interface OrgWorld {
  owner: TestUser;
  orgId: string;
  members: Record<Exclude<SystemRoleKey, 'owner'>, TestUser>;
}

let A: OrgWorld;
let B: { owner: TestUser; orgId: string };
let team: { owner: TestUser; orgId: string };
let noPayments: TestUser; // vai trò tuỳ chỉnh: portal.manage + customers.read + contracts.read, THIẾU payments.read
let noPortal: TestUser; // vai trò tuỳ chỉnh: đủ ba quyền xem nhưng THIẾU portal.manage

async function newCustomer(orgId: string, phone: string | null = '0901234567', fullName = 'Tôn Nữ Phương Thảo') {
  const c = await db.customer.create({ data: { organizationId: orgId, fullName, phone } });
  return c.id;
}

const createLink = (u: TestUser, orgId: string, customerId: string, body: object = { phoneConfirmed: true }) =>
  request(app).post(api(orgId, `/customers/${customerId}/portal/links`)).set(bearer(u)).send(body);
const getView = (u: TestUser, orgId: string, customerId: string) =>
  request(app).get(api(orgId, `/customers/${customerId}/portal`)).set(bearer(u));
const revoke = (u: TestUser, orgId: string, customerId: string, reason = 'Đường dẫn bị lộ') =>
  request(app).post(api(orgId, `/customers/${customerId}/portal/revoke`)).set(bearer(u)).send({ reason });
const block = (u: TestUser, orgId: string, deviceId: string, reason = 'Học viên báo mất máy') =>
  request(app).post(api(orgId, `/portal-devices/${deviceId}/block`)).set(bearer(u)).send({ reason });
const putSettings = (u: TestUser, orgId: string, body: object) =>
  request(app).put(api(orgId, '/portal-settings')).set(bearer(u)).send(body);

// Máy + phiên của học viên ghi thẳng Prisma (E3 chưa xong). Trigger database vẫn chặn quá 2 máy / máy đã kết thúc.
async function openDevice(orgId: string, customerId: string, linkId: string) {
  const d = await db.portalDevice.create({ data: { organizationId: orgId, customerId, linkId, label: 'iPhone · Safari' } });
  await db.portalLink.update({ where: { id: linkId }, data: { firstOpenedAt: new Date() } });
  const { token, hash } = newSessionToken();
  await db.portalSession.create({
    data: { organizationId: orgId, customerId, deviceId: d.id, tokenHash: hash, expiresAt: new Date(Date.now() + PORTAL_SESSION_DAYS * 86_400_000) },
  });
  return { deviceId: d.id, token };
}

async function liveLinkId(orgId: string, customerId: string): Promise<string> {
  const l = await db.portalLink.findFirstOrThrow({ where: { organizationId: orgId, customerId, revokedAt: null }, select: { id: true } });
  return l.id;
}

async function auditOf(orgId: string, action: string, entityId?: string) {
  return db.auditLog.findMany({ where: { organizationId: orgId, action, ...(entityId ? { entityId } : {}) }, orderBy: { createdAt: 'asc' } });
}

beforeAll(async () => {
  const owner = await registerUser(app, 'e4-chu-a');
  const orgId = await createAcademyOrg(app, owner, 'e4-a');
  const members = {} as OrgWorld['members'];
  for (const key of ROLE_ORDER) {
    const u = await registerUser(app, `e4-${key}`);
    await addMember(app, owner, orgId, u, [key]);
    members[key] = u;
  }
  A = { owner, orgId, members };
  for (const [key, perms, holder] of [
    ['thieu_thu', ['org.read', 'portal.manage', 'customers.read', 'contracts.read'], 'noPayments'],
    ['thieu_cong', ['org.read', 'customers.read', 'contracts.read', 'payments.read'], 'noPortal'],
  ] as const) {
    const roleKey = `${key}_${randomUUID().slice(0, 4)}`;
    await request(app).post(api(orgId, '/roles')).set(bearer(owner)).set(idem()).send({ key: roleKey, name: `Thử ${key}`, permissions: perms }).expect(201);
    const u = await registerUser(app, `e4-${key}`);
    await addMember(app, owner, orgId, u, [roleKey]);
    if (holder === 'noPayments') noPayments = u;
    else noPortal = u;
  }
  const ownerB = await registerUser(app, 'e4-chu-b');
  B = { owner: ownerB, orgId: await createAcademyOrg(app, ownerB, 'e4-b') };
  const ownerT = await registerUser(app, 'e4-chu-team');
  team = { owner: ownerT, orgId: await createOrg(app, ownerT, 'e4-team') };
});

afterAll(async () => {
  await db.$disconnect();
});

describe('E4 — tạo đường dẫn: chìa chỉ hiện một lần, database chỉ giữ bản băm', () => {
  it('201 + chìa 43 ký tự; database chỉ có sha256; GET không có chìa/bản băm; tạo lần 2 → link 1 REVOKED/REPLACED', async () => {
    const customerId = await newCustomer(A.orgId, '0912345678', 'Nguyễn Thị Mỹ Lệ');
    const r1 = await createLink(A.owner, A.orgId, customerId).expect(201);
    expect(r1.headers['cache-control']).toBe('no-store');
    const key1: string = r1.body.key;
    expect(key1).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r1.body.callName).toBe('Mỹ Lệ');
    expect(r1.body.centerName).toBe('Tổ chức e4-a');
    expect(Date.parse(r1.body.expiresAt) - Date.now()).toBeGreaterThan(7 * 86_400_000 - 60_000);
    expect(r1.body.view.link).toMatchObject({ status: 'ACTIVE', devicesUsed: 0, failedAttempts: 0, firstOpenedAt: null });
    expect(r1.body.view.phoneLast4).toBe('5678');
    expect(r1.body.view.limits).toEqual({ linkTtlDays: 7, maxDevices: 2, maxFailed: 5, rememberDays: 90 });

    // Database: đúng bản băm, không có bản rõ ở bất kỳ cột nào của bảng đường dẫn, nhật ký, kho chống gửi trùng.
    const link1 = await db.portalLink.findFirstOrThrow({ where: { organizationId: A.orgId, customerId } });
    expect(link1.keyHash).toBe(sha(key1));
    const rawLinks = await db.$queryRaw<{ t: string }[]>`SELECT row_to_json(l)::text AS t FROM portal_links l WHERE customer_id = ${customerId}::uuid`;
    const rawAudit = await db.$queryRaw<{ t: string }[]>`SELECT row_to_json(a)::text AS t FROM audit_logs a WHERE organization_id = ${A.orgId}::uuid`;
    const rawIdem = await db.$queryRaw<{ t: string }[]>`SELECT row_to_json(i)::text AS t FROM idempotency_keys i WHERE organization_id = ${A.orgId}::uuid`;
    for (const row of [...rawLinks, ...rawAudit, ...rawIdem]) expect(row.t).not.toContain(key1);
    for (const row of rawAudit) expect(row.t).not.toContain(sha(key1));

    // Lần hai (GET trạng thái): không có chìa, không có bản băm, không có tên trường băm.
    const v = await getView(A.owner, A.orgId, customerId).expect(200);
    const vText = JSON.stringify(v.body);
    expect(vText).not.toContain(key1);
    expect(vText).not.toContain(sha(key1));
    expect(vText).not.toMatch(/keyHash|tokenHash|handoffHash|"key"/);
    expect(v.body.link.createdByName).toBe('Người thử e4-chu-a');

    // Tạo lần 2: link 1 bị thu hồi lý do REPLACED, người thu hồi = người tạo; phản hồi lần 2 không chứa chìa 1.
    const r2 = await createLink(A.owner, A.orgId, customerId).expect(201);
    expect(r2.body.key).not.toBe(key1);
    expect(JSON.stringify(r2.body)).not.toContain(key1);
    const after1 = await db.portalLink.findUniqueOrThrow({ where: { id: link1.id } });
    expect(after1.revokeReason).toBe('REPLACED');
    expect(after1.revokedById).toBe(A.owner.id);
    expect(after1.revokedAt).not.toBeNull();
    const live = await db.portalLink.findMany({ where: { customerId, revokedAt: null } });
    expect(live).toHaveLength(1);
    expect(live[0]!.keyHash).toBe(sha(r2.body.key));

    // Audit: hai lần tạo, lần 2 có replacedLinkId; actor = người làm; không có chìa hay 4 số.
    const audits = await db.auditLog.findMany({ where: { organizationId: A.orgId, action: 'portal.link_created', data: { path: ['customerId'], equals: customerId } }, orderBy: { createdAt: 'asc' } });
    expect(audits).toHaveLength(2);
    expect(audits[0]!.actorUserId).toBe(A.owner.id);
    expect(audits[0]!.entityType).toBe('portal_link');
    expect(audits[0]!.entityId).toBe(link1.id);
    expect(audits[0]!.data).toMatchObject({ customerId, phoneConfirmed: true });
    expect(audits[1]!.data).toMatchObject({ replacedLinkId: link1.id });
    expect(JSON.stringify(audits.map((a) => a.data))).not.toMatch(/"(key|keyHash|last4|phone|phoneLast4)"/);
  });

  it('đường tạo KHÔNG khai idempotent: không cất phản hồi (chìa) vào idempotency_keys dù máy khách gửi Idempotency-Key', async () => {
    const customerId = await newCustomer(A.orgId);
    const k = `k-${randomUUID()}`;
    const r = await request(app).post(api(A.orgId, `/customers/${customerId}/portal/links`)).set(bearer(A.owner)).set('idempotency-key', k).send({ phoneConfirmed: true }).expect(201);
    const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM idempotency_keys WHERE key = ${k}`;
    expect(Number(rows[0]!.n)).toBe(0);
    expect(r.body.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('dữ liệu: thiếu / sai phoneConfirmed → 400; khách không có SĐT → 409; tổ chức TEAM → 403 ACADEMY_REQUIRED', async () => {
    const c = await newCustomer(A.orgId);
    await createLink(A.owner, A.orgId, c, {}).expect(400);
    await createLink(A.owner, A.orgId, c, { phoneConfirmed: false }).expect(400);
    const noPhone = await newCustomer(A.orgId, null);
    const r = await createLink(A.owner, A.orgId, noPhone).expect(409);
    expect(r.body.error.message).toBe('Học viên chưa có số điện thoại — thêm số trước khi gửi đường dẫn');
    const v = await getView(A.owner, A.orgId, noPhone).expect(200);
    expect(v.body.eligible).toEqual({ ok: false, reasons: ['NO_PHONE'] });
    expect(v.body.link).toBeNull();
    expect(await db.portalLink.count({ where: { customerId: noPhone } })).toBe(0);

    const tc = await newCustomer(team.orgId);
    for (const res of [
      await createLink(team.owner, team.orgId, tc),
      await getView(team.owner, team.orgId, tc),
      await revoke(team.owner, team.orgId, tc),
      await request(app).get(api(team.orgId, '/portal-settings')).set(bearer(team.owner)),
      await putSettings(team.owner, team.orgId, { bankName: null, bankAccountNo: null, bankAccountName: null }),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error.details).toEqual({ reason: 'ACADEMY_REQUIRED' });
    }
  });

  it('hasCourseContract: chỉ đếm hợp đồng khoá học đã xác nhận của chính học viên', async () => {
    const c = await newCustomer(A.orgId);
    const v = await getView(A.owner, A.orgId, c).expect(200);
    expect(v.body.hasCourseContract).toBe(false);
    expect(v.body.eligible).toEqual({ ok: true, reasons: [] });
  });
});

describe('E4 — quyền: gửi đường dẫn = Chủ, Quản trị, Quản lý, Lễ tân (ký duyệt câu 3)', () => {
  it('từng vai trò mẫu tạo đường dẫn; vai trò tuỳ chỉnh thiếu payments.read → 403 details.required', async () => {
    const c = await newCustomer(A.orgId);
    const allowed: string[] = [];
    const denied: string[] = [];
    await createLink(A.owner, A.orgId, c).expect(201);
    allowed.push('owner');
    for (const key of ROLE_ORDER) {
      const r = await createLink(A.members[key], A.orgId, c);
      if (r.status === 201) allowed.push(key);
      else {
        expect(r.status).toBe(403);
        denied.push(key);
      }
    }
    expect(allowed.sort()).toEqual(['admin', 'manager', 'owner', 'receptionist']);
    expect(denied.sort()).toEqual(['accountant', 'artist', 'assistant', 'instructor', 'teaching_assistant']);

    const r = await createLink(noPayments, A.orgId, c).expect(403);
    expect(r.body.error.details.required).toContain('payments.read');
    expect(r.body.error.details.required).not.toContain('contracts.read');
    const r2 = await createLink(noPortal, A.orgId, c).expect(403);
    expect(r2.body.error.details.required).toBe('portal.manage');
    // Người thiếu quyền không thấy trạng thái, không thu hồi, không chặn được.
    await getView(A.members.artist, A.orgId, c).expect(403);
    await revoke(A.members.instructor, A.orgId, c).expect(403);
  });
});

describe('E4 — cách ly tổ chức: khách / máy của tổ chức khác trả 404 giống mã bịa', () => {
  it('GET, tạo, thu hồi, chặn máy với mã của tổ chức B → cùng lỗi với mã bịa; dữ liệu B không đổi', async () => {
    const cB = await newCustomer(B.orgId);
    await createLink(B.owner, B.orgId, cB).expect(201);
    const linkB = await liveLinkId(B.orgId, cB);
    const devB = await openDevice(B.orgId, cB, linkB);
    const fake = randomUUID();

    const pairs: [request.Response, request.Response][] = [
      [await getView(A.owner, A.orgId, cB), await getView(A.owner, A.orgId, fake)],
      [await createLink(A.owner, A.orgId, cB), await createLink(A.owner, A.orgId, fake)],
      [await revoke(A.owner, A.orgId, cB), await revoke(A.owner, A.orgId, fake)],
      [await block(A.owner, A.orgId, devB.deviceId), await block(A.owner, A.orgId, fake)],
    ];
    for (const [cross, made] of pairs) {
      expect(cross.status).toBe(404);
      expect(errBody(cross)).toEqual(errBody(made));
    }
    // Không gì của B bị đụng: link vẫn sống, máy vẫn sống, phiên vẫn vào được.
    expect((await db.portalLink.findUniqueOrThrow({ where: { id: linkB } })).revokedAt).toBeNull();
    expect((await db.portalDevice.findUniqueOrThrow({ where: { id: devB.deviceId } })).endedAt).toBeNull();
    await probe(devB.token).expect(200);
    expect(await db.portalLink.count({ where: { organizationId: A.orgId, customerId: cB } })).toBe(0);
    // Chủ B gọi đường của tổ chức A → 404 (không phải thành viên).
    await getView(B.owner, A.orgId, cB).expect(404);
  });

  it('trạng thái chỉ liệt kê máy của đúng học viên đó', async () => {
    const c1 = await newCustomer(A.orgId);
    const c2 = await newCustomer(A.orgId);
    await createLink(A.owner, A.orgId, c1).expect(201);
    await createLink(A.owner, A.orgId, c2).expect(201);
    const d1 = await openDevice(A.orgId, c1, await liveLinkId(A.orgId, c1));
    const d2 = await openDevice(A.orgId, c2, await liveLinkId(A.orgId, c2));
    const v = await getView(A.owner, A.orgId, c1).expect(200);
    expect(v.body.devices.map((d: { id: string }) => d.id)).toEqual([d1.deviceId]);
    expect(JSON.stringify(v.body)).not.toContain(d2.deviceId);
  });
});

describe('E4 — máy: tối đa 2, thu hồi / chặn có hiệu lực ngay', () => {
  it('đủ 2 máy → FULL; máy thứ 3 bị database chặn; máy đã kết thúc vẫn tính suất', async () => {
    const c = await newCustomer(A.orgId);
    await createLink(A.owner, A.orgId, c).expect(201);
    const link = await liveLinkId(A.orgId, c);
    const d1 = await openDevice(A.orgId, c, link);
    let v = await getView(A.owner, A.orgId, c).expect(200);
    expect(v.body.link).toMatchObject({ status: 'ACTIVE', devicesUsed: 1 });
    await openDevice(A.orgId, c, link);
    v = await getView(A.owner, A.orgId, c).expect(200);
    expect(v.body.link).toMatchObject({ status: 'FULL', devicesUsed: 2 });
    await expect(openDevice(A.orgId, c, link)).rejects.toThrow(/tối đa 2 máy/);
    // Chặn một máy: suất vẫn tính (không lách giới hạn 2 bằng thoát rồi mở máy khác).
    await block(A.owner, A.orgId, d1.deviceId).expect(200);
    v = await getView(A.owner, A.orgId, c).expect(200);
    expect(v.body.link).toMatchObject({ status: 'FULL', devicesUsed: 2 });
  });

  it('trạng thái link: LOCKED, EXPIRED (chưa mở và quá hạn), đã mở thì không hết hạn', async () => {
    const c = await newCustomer(A.orgId);
    await createLink(A.owner, A.orgId, c).expect(201);
    const link = await liveLinkId(A.orgId, c);
    await db.$executeRaw`UPDATE portal_links SET created_at = now() - interval '8 days', expires_at = now() - interval '1 day' WHERE id = ${link}::uuid`;
    expect((await getView(A.owner, A.orgId, c).expect(200)).body.link.status).toBe('EXPIRED');
    await db.portalLink.update({ where: { id: link }, data: { firstOpenedAt: new Date() } });
    expect((await getView(A.owner, A.orgId, c).expect(200)).body.link.status).toBe('ACTIVE');
    await db.portalLink.update({ where: { id: link }, data: { failedAttempts: 5, lockedAt: new Date() } });
    const locked = (await getView(A.owner, A.orgId, c).expect(200)).body.link;
    expect(locked).toMatchObject({ status: 'LOCKED', failedAttempts: 5 });
  });

  it('tạo đường dẫn mới: máy cũ GIỮ NGUYÊN và phiên cũ vẫn vào được', async () => {
    const c = await newCustomer(A.orgId);
    await createLink(A.owner, A.orgId, c).expect(201);
    const old = await openDevice(A.orgId, c, await liveLinkId(A.orgId, c));
    await createLink(A.members.receptionist, A.orgId, c).expect(201);
    await probe(old.token).expect(200);
    expect((await db.portalDevice.findUniqueOrThrow({ where: { id: old.deviceId } })).endedAt).toBeNull();
  });

  it('thu hồi: mọi máy LINK_REVOKED (kể cả máy của link đã REPLACED), ended_by_id = người làm, phiên 401 ngay; audit có reason', async () => {
    const c = await newCustomer(A.orgId);
    await createLink(A.owner, A.orgId, c).expect(201);
    const d1 = await openDevice(A.orgId, c, await liveLinkId(A.orgId, c));
    await createLink(A.owner, A.orgId, c).expect(201);
    const link2 = await liveLinkId(A.orgId, c);
    const d2 = await openDevice(A.orgId, c, link2);
    await db.portalDevice.update({ where: { id: d2.deviceId }, data: { handoffHash: sha('ABCDEFGH'), handoffExpiresAt: new Date(Date.now() + 600_000) } });
    await probe(d1.token).expect(200);
    await probe(d2.token).expect(200);

    const actor = A.members.manager;
    const r = await revoke(actor, A.orgId, c, 'Đường dẫn bị lộ trong nhóm lớp').expect(200);
    expect(r.body.devicesEnded).toBe(2);
    expect(r.body.view.link.status).toBe('REVOKED');
    expect(r.body.view.devices.map((d: { status: string }) => d.status)).toEqual(['LINK_REVOKED', 'LINK_REVOKED']);
    expect(r.body.view.devices[0].endedByName).toBe('Người thử e4-manager');

    // Phiên đang mở bị chặn ở lần gọi kế.
    await probe(d1.token).expect(401);
    await probe(d2.token).expect(401);
    const devs = await db.portalDevice.findMany({ where: { customerId: c } });
    for (const d of devs) {
      expect(d.endReason).toBe('LINK_REVOKED');
      expect(d.endedById).toBe(actor.id);
      expect(d.endNote).toBe('Đường dẫn bị lộ trong nhóm lớp');
      expect(d.handoffHash).toBeNull();
    }
    expect(await db.portalSession.count({ where: { customerId: c, revokedAt: null } })).toBe(0);
    const l2 = await db.portalLink.findUniqueOrThrow({ where: { id: link2 } });
    expect(l2.revokeReason).toBe('REVOKED');
    expect(l2.revokedById).toBe(actor.id);

    const audits = await auditOf(A.orgId, 'portal.link_revoked', link2);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorUserId).toBe(actor.id);
    expect(audits[0]!.entityType).toBe('portal_link');
    expect(audits[0]!.data).toEqual({ customerId: c, reason: 'Đường dẫn bị lộ trong nhóm lớp', devicesEnded: 2 });

    // Thu hồi lần nữa (không còn link sống) → vẫn 200, đếm thật = 0.
    const again = await revoke(actor, A.orgId, c).expect(200);
    expect(again.body.devicesEnded).toBe(0);
    // Lý do trống → 400.
    await revoke(actor, A.orgId, c, '   ').expect(400);
  });

  it('chặn một máy: máy đó 401 ngay, máy kia vẫn 200; chặn lại → 409; audit portal.device_blocked', async () => {
    const c = await newCustomer(A.orgId);
    await createLink(A.owner, A.orgId, c).expect(201);
    const link = await liveLinkId(A.orgId, c);
    const d1 = await openDevice(A.orgId, c, link);
    const d2 = await openDevice(A.orgId, c, link);
    const actor = A.members.receptionist;
    const r = await block(actor, A.orgId, d1.deviceId, 'Học viên báo mất máy').expect(200);
    const shown = r.body.view.devices.find((d: { id: string }) => d.id === d1.deviceId);
    expect(shown).toMatchObject({ status: 'BLOCKED', endedByName: 'Người thử e4-receptionist' });
    await probe(d1.token).expect(401);
    await probe(d2.token).expect(200);
    const dev = await db.portalDevice.findUniqueOrThrow({ where: { id: d1.deviceId } });
    expect(dev).toMatchObject({ endReason: 'BLOCKED', endedById: actor.id, endNote: 'Học viên báo mất máy' });

    const again = await block(actor, A.orgId, d1.deviceId).expect(409);
    expect(again.body.error.message).toBe('Máy này đã bị chặn hoặc đã thoát');

    const audits = await auditOf(A.orgId, 'portal.device_blocked', d1.deviceId);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorUserId).toBe(actor.id);
    expect(audits[0]!.entityType).toBe('portal_device');
    expect(audits[0]!.data).toEqual({ customerId: c, reason: 'Học viên báo mất máy' });
    // Người thiếu portal.manage không chặn được.
    await block(A.members.accountant, A.orgId, d2.deviceId).expect(403);
  });
});

describe('E4 — cài đặt cổng: số tài khoản (đổi = Chủ, Quản trị)', () => {
  const good = { bankName: 'Vietcombank', bankAccountNo: '0123 456.789-0', bankAccountName: 'Nguyễn Thị Đào' };

  it('đổi số tài khoản: chỉ owner, admin; mọi vai trò mẫu khác 403 (và không ghi gì)', async () => {
    const owner = await registerUser(app, 'e4-st-chu');
    const orgId = await createAcademyOrg(app, owner, 'e4-st');
    const byRole: Record<string, TestUser> = { owner };
    for (const key of ROLE_ORDER) {
      const u = await registerUser(app, `e4-st-${key}`);
      await addMember(app, owner, orgId, u, [key]);
      byRole[key] = u;
    }
    const allowed: string[] = [];
    for (const [key, u] of Object.entries(byRole)) {
      const r = await putSettings(u, orgId, good);
      if (r.status === 200) allowed.push(key);
      else expect(r.status, key).toBe(403);
      // Mọi vai trò đọc được (org.read).
      await request(app).get(api(orgId, '/portal-settings')).set(bearer(u)).expect(200);
    }
    expect(allowed.sort()).toEqual(['admin', 'owner']);
    const audits = await auditOf(orgId, 'portal.settings_updated');
    expect(audits).toHaveLength(2);
    expect(new Set(audits.map((a) => a.actorUserId))).toEqual(new Set([owner.id, byRole.admin!.id]));
  });

  it('GET chưa có → null; PUT chuẩn hoá; thiếu khoá / lệch / số có chữ → 400; audit trước/sau; trang công khai không có số', async () => {
    const owner = await registerUser(app, 'e4-tk-chu');
    const orgId = await createAcademyOrg(app, owner, 'e4-tk');
    const empty = await request(app).get(api(orgId, '/portal-settings')).set(bearer(owner)).expect(200);
    expect(empty.body).toEqual({ bankName: null, bankAccountNo: null, bankAccountName: null, updatedAt: null });

    await putSettings(owner, orgId, {}).expect(400);
    await putSettings(owner, orgId, { bankName: 'Vietcombank', bankAccountNo: '0123456789' }).expect(400);
    const mixed = await putSettings(owner, orgId, { ...good, bankAccountName: null }).expect(400);
    expect(JSON.stringify(mixed.body)).toContain('Điền đủ ngân hàng, số tài khoản, chủ tài khoản — hoặc để trống cả ba');
    await putSettings(owner, orgId, { ...good, bankAccountNo: '0123ABC789' }).expect(400);
    await putSettings(owner, orgId, { ...good, bankAccountNo: '12345' }).expect(400);
    expect(await db.portalSettings.count({ where: { organizationId: orgId } })).toBe(0);

    const saved = await putSettings(owner, orgId, good).expect(200);
    expect(saved.body).toMatchObject({ bankName: 'Vietcombank', bankAccountNo: '01234567890', bankAccountName: 'NGUYEN THI DAO' });
    await putSettings(owner, orgId, { bankName: null, bankAccountNo: null, bankAccountName: null }).expect(200);
    await putSettings(owner, orgId, { ...good, bankAccountNo: '9876543210' }).expect(200);

    const audits = await auditOf(orgId, 'portal.settings_updated');
    expect(audits.map((a) => a.data)).toEqual([
      {
        before: { bankName: null, bankAccountNo: null, bankAccountName: null },
        after: { bankName: 'Vietcombank', bankAccountNo: '01234567890', bankAccountName: 'NGUYEN THI DAO' },
      },
      {
        before: { bankName: 'Vietcombank', bankAccountNo: '01234567890', bankAccountName: 'NGUYEN THI DAO' },
        after: { bankName: null, bankAccountNo: null, bankAccountName: null },
      },
      {
        before: { bankName: null, bankAccountNo: null, bankAccountName: null },
        after: { bankName: 'Vietcombank', bankAccountNo: '9876543210', bankAccountName: 'NGUYEN THI DAO' },
      },
    ]);
    for (const a of audits) {
      expect(a.entityType).toBe('portal_settings');
      expect(a.entityId).toBe(orgId);
      expect(a.actorUserId).toBe(owner.id);
    }

    // Trang công khai đã xuất bản không chứa số tài khoản / tên chủ tài khoản.
    await request(app).put(api(orgId, '/profile')).set(bearer(owner)).send({ brandName: 'Học viện thử E4' }).expect(200);
    await request(app).post(api(orgId, '/profile/publish')).set(bearer(owner)).set(idem()).expect(200);
    const { slug } = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { slug: true } });
    const site = await request(app).get(`/api/v1/public/sites/${slug}`).expect(200);
    const text = JSON.stringify(site.body);
    expect(text).toContain('Học viện thử E4');
    expect(text).not.toContain('9876543210');
    expect(text).not.toContain('NGUYEN THI DAO');
  });
});

describe('E4 — đồng bộ vai trò mẫu cho tổ chức cũ', () => {
  it('syncSystemRoles → manager và receptionist của tổ chức cũ có portal.manage', async () => {
    const owner = await registerUser(app, 'e4-cu');
    const orgId = await createAcademyOrg(app, owner, 'e4-cu');
    // Giả tổ chức tạo trước bản vẽ E: vai trò mẫu chưa có portal.manage.
    for (const key of ['manager', 'receptionist']) {
      const role = await db.role.findFirstOrThrow({ where: { organizationId: orgId, key } });
      await db.role.update({ where: { id: role.id }, data: { permissions: role.permissions.filter((p) => p !== 'portal.manage') } });
    }
    await syncSystemRoles(db);
    for (const key of ['manager', 'receptionist']) {
      const role = await db.role.findFirstOrThrow({ where: { organizationId: orgId, key } });
      expect(role.permissions, key).toContain('portal.manage');
    }
  });
});
