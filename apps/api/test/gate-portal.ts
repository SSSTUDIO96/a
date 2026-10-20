// CỬA GÁC — PHẦN CỔNG HỌC VIÊN (bản vẽ E mục 6.3, gói E5). Không phải bài thử (không có it/describe).
// - seedPortal: mỗi tổ chức thử có một học viên đã mở cổng THẬT (đường E4 tạo đường dẫn, đường E3 mở bằng 4 số) — cho phép
//   cũ có giá trị :deviceId, và cho tường chắn có phiên cổng thật để cầm sai chỗ.
// - buildPortalWorld: A1, A2 cùng lớp ở tổ chức A, T1 ở tổ chức B (như bản vẽ E 6.2 E3 mục 2) + bộ đầu vào hỏng cho phép dò.
// - runPortalChecks: bốn phép mới portalScope, portalWall, portalLeak, portalProbe (GateReport 10 → 14 phép).
// Bài học Studio Pro (bản vẽ E 2.8) → phép nào chuyển đỏ nếu tái phạm:
//   1. tra hợp đồng ở máy khách trên TOÀN BỘ danh sách → portalScope (đường cổng không tham số, không trường mã) + portalLeak;
//   2. hai lời báo khác nhau → dò được mã có thật                                   → portalProbe;
//   3. mã vượt quyền qua query (?accessToken=SUPER_ADMIN_BYPASS)                       → portalScope (đường cổng không có
//      query) + portalWall cách cầm "thẻ qua query" (thẻ THẬT đặt trên địa chỉ không mở được đường nào).
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { isPortalPath, PORTAL_PUBLIC_ROUTES, type AnyRoute, type Deps } from '../src/http/route';
import type { Db } from '../src/lib/prisma';
import { newHandoffCode, newLinkKey } from '../src/modules/portal/tokens';
import type { GateCheck, GateFixture, GateOrg, GateReport } from './gate';
import { bearer, type App, type TestUser } from './helpers';
import {
  claimPortal,
  createLink,
  enroll,
  makeClass,
  openOk,
  PORTAL_HDR,
  portalTokenOf,
  receipt,
  seedCard,
  uniquePhone,
  uuidsIn,
  type Academy,
} from './portal-helpers';

// Phiên cổng THẬT của học viên mẫu trong một tổ chức thử.
export interface GatePortal {
  // Giá trị header Cookie: "mp_portal=<thẻ>".
  cookie: string;
  token: string;
}

export interface PortalViewer {
  name: string;
  token: string;
  // GIỮ: phải có trong phản hồi của chính mình (mã hợp đồng, tên).
  own: string[];
  // Bí mật của người khác + ghi chú nội bộ + SĐT/email: không được có.
  forbidden: string[];
}

export interface PortalProbeInput {
  name: string;
  body: Record<string, string>;
  // Header gửi kèm (rỗng = thiếu X-Client).
  headers: Record<string, string>;
}

export interface PortalWorld {
  viewers: PortalViewer[];
  probes: {
    session: { denied: PortalProbeInput[]; keep: PortalProbeInput };
    // Mã cho vế "thiếu X-Client" và GIỮ được tạo LÚC CHẠY phép (mã sống 10 phút) bằng phiên của máy này.
    claim: { denied: PortalProbeInput[]; handoffToken: string };
  };
}

// Công cụ của gate.ts truyền vào (tránh nhập vòng tròn gate.ts ↔ gate-portal.ts).
export interface GateTools {
  key: (r: AnyRoute) => string;
  fill: (r: AnyRoute, ids: Record<string, string>) => string;
  send: (app: App, r: AnyRoute, path: string, headers: Record<string, string>, body: unknown) => Promise<request.Response>;
  record: (c: GateCheck, ok: boolean, what: string) => void;
  refFieldPaths: (r: AnyRoute) => string[];
  // So một đường /platform/ với một đường bịa cùng phương thức, cùng header, cùng chuỗi truy vấn.
  sameAsFakePlatform: (r: AnyRoute, headers: Record<string, string>, search?: string) => Promise<{ ok: boolean; status: number; same: boolean; biaStatus: number }>;
}

const api = (orgId: string) => `/api/v1/orgs/${orgId}`;

function must(res: request.Response, status: number, what: string): request.Response {
  if (res.status !== status) throw new Error(`Cửa gác cổng: ${what} → ${res.status} (cần ${status}): ${JSON.stringify(res.body)}`);
  return res;
}

async function newCustomer(app: App, owner: TestUser, orgId: string, fullName: string, note: string | null) {
  const phone = uniquePhone();
  const res = must(
    await request(app).post(`${api(orgId)}/customers`).set(bearer(owner)).set('idempotency-key', randomUUID()).send({ fullName, phone, note }),
    201,
    `tạo khách ${fullName}`,
  );
  const id = (res.body as { id?: string }).id;
  if (!id) throw new Error(`Cửa gác cổng: tạo khách ${fullName} không trả id`);
  return { id, fullName, phone, last4: phone.slice(-4) };
}

// Máy của học viên, mới nhất trước (đọc qua đường E4 GET …/portal).
async function devicesOf(app: App, owner: TestUser, orgId: string, customerId: string): Promise<string[]> {
  const res = must(await request(app).get(`${api(orgId)}/customers/${customerId}/portal`).set(bearer(owner)), 200, 'đọc trạng thái cổng');
  const devices = (res.body as { devices?: { id: string }[] }).devices;
  if (!devices) throw new Error(`Cửa gác cổng: trạng thái cổng không có devices: ${JSON.stringify(res.body)}`);
  return devices.map((d) => d.id);
}

async function handoff(app: App, token: string): Promise<request.Response> {
  return request(app).post('/api/v1/portal/session/handoff').set(PORTAL_HDR).set('cookie', `mp_portal=${token}`);
}

async function handoffCode(app: App, token: string): Promise<string> {
  const res = must(await handoff(app, token), 201, 'tạo mã chuyển máy');
  const code = (res.body as { code?: string }).code;
  if (!code) throw new Error('Cửa gác cổng: tạo mã chuyển máy không trả code');
  return code;
}

// Gọi trong setupOrg (gate.ts): khách có SĐT → đường dẫn (E4) → mở bằng 4 số (E3) → mã máy (đọc qua E4).
export async function seedPortal(
  app: App,
  org: { orgId: string; owner: TestUser; label: string },
): Promise<{ ids: { portalCustomerId: string; deviceId: string }; portal: GatePortal }> {
  const c = await newCustomer(app, org.owner, org.orgId, `Học viên cổng ${org.label} ${randomUUID().slice(0, 6)}`, null);
  const key = await createLink(app, { orgId: org.orgId, owner: org.owner } as Academy, c.id);
  const token = await openOk(app, key, c.last4);
  const [deviceId, ...rest] = await devicesOf(app, org.owner, org.orgId, c.id);
  if (!deviceId || rest.length !== 0) throw new Error(`Cửa gác cổng: học viên mẫu ${org.label} phải có đúng 1 máy`);
  return { ids: { portalCustomerId: c.id, deviceId }, portal: { cookie: `mp_portal=${token}`, token } };
}

// Tổ chức thử của cửa gác dưới dạng Academy của portal-helpers (dùng lại makeClass / enroll / receipt / seedCard).
// Giảng viên = thành viên `noPerms` (lớp K1 của fixture cũng dùng người này); SĐT giảng viên là bí mật học viên không được thấy.
async function academyOf(db: Db, o: GateOrg, label: string): Promise<Academy> {
  const instructorPhone = uniquePhone();
  const membershipId = o.ids.membershipId!;
  await db.staffProfile.upsert({
    where: { membershipId },
    create: { membershipId, organizationId: o.orgId, displayName: `Cô ${label}`, phone: instructorPhone },
    update: { phone: instructorPhone },
  });
  return {
    label,
    orgId: o.orgId,
    owner: o.owner,
    instructor: o.noPerms,
    instructorMembershipId: membershipId,
    locationId: o.ids.locationId!,
    courseId: o.ids.courseId!,
    secret: `BI-MAT-${randomUUID()}`,
    instructorPhone,
  };
}

// Học viên ghi danh (hợp đồng khoá học ĐÃ XÁC NHẬN, ghi chú nội bộ chứa bí mật) + một phiếu thu (ghi chú bí mật).
async function student(app: App, a: Academy, name: string, classId: string) {
  const c = await newCustomer(app, a.owner, a.orgId, `${name} ${randomUUID().slice(0, 6)}`, `${a.secret}-ghi-chu-khach`);
  const contract = await enroll(app, a, c.id, classId);
  const pay = await receipt(app, a, contract.id, 100_000);
  return { ...c, contractId: contract.id, contractCode: contract.code, receiptCode: pay.code };
}

const otherDigits = (last4: string) => String((Number(last4) + 1) % 10_000).padStart(4, '0');

// Thế giới học viên cho portalLeak + bộ đầu vào hỏng cho portalProbe. db: ghi thẳng những trạng thái không có đường API
// (đường dẫn hết hạn, đã khoá, mã chuyển máy hết hạn; thẻ thiết kế đã xuất ảnh).
export async function buildPortalWorld(app: App, db: Db, fx: { a: GateOrg; b: GateOrg }): Promise<PortalWorld> {
  const deps = { db } as Deps; // seedCard chỉ dùng deps.db
  const A = await academyOf(db, fx.a, 'A');
  const B = await academyOf(db, fx.b, 'B');

  // ---- portalLeak: A1, A2 CÙNG LỚP ở A; A2 học thêm một lớp riêng (tên lớp riêng là chuyện của A2); T1 ở B.
  const shared = await makeClass(app, A, `Lớp chung ${randomUUID().slice(0, 6)}`);
  const privateA2 = await makeClass(app, A, `Lớp riêng A2 ${randomUUID().slice(0, 6)}`);
  const classB = await makeClass(app, B, `Lớp B ${randomUUID().slice(0, 6)}`);
  const a1 = await student(app, A, 'Học viên A1', shared.id);
  const a2 = await student(app, A, 'Học viên A2', shared.id);
  const a2more = await enroll(app, A, a2.id, privateA2.id);
  const t1 = await student(app, B, 'Học viên T1', classB.id);
  // Thẻ đã xuất ảnh: A1 một thẻ chào mừng ở lớp chung; A2 một thẻ khen ở LỚP RIÊNG (A1 thấy là lộ tên lớp riêng của A2).
  await seedCard(deps, A, { customerId: a1.id, contractId: a1.contractId, courseClassId: shared.id }, 'WELCOME');
  await seedCard(deps, A, { customerId: a2.id, contractId: a2more.id, courseClassId: privateA2.id }, 'FEEDBACK');
  await seedCard(deps, B, { customerId: t1.id, contractId: t1.contractId, courseClassId: classB.id }, 'WELCOME');
  const open = async (a: Academy, s: { id: string; last4: string }) => openOk(app, await createLink(app, a, s.id), s.last4);
  const everyone = [
    A.secret,
    B.secret,
    A.instructorPhone,
    B.instructorPhone,
    fx.a.owner.email,
    fx.b.owner.email,
    fx.a.noPerms.email,
    fx.b.noPerms.email,
    a1.phone,
    a2.phone,
    t1.phone,
  ];
  const viewers: PortalViewer[] = [
    {
      name: 'A1',
      token: await open(A, a1),
      own: [a1.fullName, a1.contractCode],
      // Mã hợp đồng / phiếu chỉ so trong CÙNG tổ chức (mã đánh số theo tổ chức nên A và B có thể trùng nhau).
      forbidden: [...everyone, a2.fullName, a2.contractCode, a2more.code, a2.receiptCode, privateA2.name, t1.fullName, classB.name],
    },
    {
      name: 'A2',
      token: await open(A, a2),
      own: [a2.fullName, a2.contractCode, a2more.code],
      forbidden: [...everyone, a1.fullName, a1.contractCode, a1.receiptCode, t1.fullName, classB.name],
    },
    {
      name: 'T1',
      token: await open(B, t1),
      own: [t1.fullName, t1.contractCode],
      forbidden: [...everyone, a1.fullName, a2.fullName, shared.name, privateA2.name],
    },
  ];

  // ---- portalProbe, mở bằng đường dẫn: mỗi trạng thái hỏng một học viên riêng ở A.
  const p = async (name: string) => newCustomer(app, A.owner, A.orgId, `Dò ${name} ${randomUUID().slice(0, 6)}`, null);
  const live = await p('sống');
  const liveKey = await createLink(app, A, live.id);
  const revoked = await p('thu hồi');
  const revokedKey = await createLink(app, A, revoked.id);
  must(
    await request(app).post(`${api(A.orgId)}/customers/${revoked.id}/portal/revoke`).set(bearer(A.owner)).send({ reason: 'Thử cửa gác' }),
    200,
    'thu hồi đường dẫn mẫu',
  );
  const expired = await p('hết hạn');
  const expiredKey = await createLink(app, A, expired.id);
  const day = 86_400_000;
  const exp = await db.portalLink.updateMany({
    where: { organizationId: A.orgId, customerId: expired.id, revokedAt: null },
    data: { createdAt: new Date(Date.now() - 8 * day), expiresAt: new Date(Date.now() - day) },
  });
  const locked = await p('khoá');
  const lockedKey = await createLink(app, A, locked.id);
  const lk = await db.portalLink.updateMany({
    where: { organizationId: A.orgId, customerId: locked.id, revokedAt: null },
    data: { failedAttempts: 5, lockedAt: new Date() },
  });
  if (exp.count !== 1 || lk.count !== 1) throw new Error('Cửa gác cổng: không đặt được trạng thái hết hạn / đã khoá');
  const full = await p('đủ máy');
  const fullKey = await createLink(app, A, full.id);
  const t1Full = await openOk(app, fullKey, full.last4);
  const t2Full = await openOk(app, fullKey, full.last4);
  const noPhone = await p('xoá số');
  const noPhoneKey = await createLink(app, A, noPhone.id);
  must(await request(app).patch(`${api(A.orgId)}/customers/${noPhone.id}`).set(bearer(A.owner)).send({ phone: null }), 200, 'xoá SĐT khách mẫu');

  // ---- portalProbe, nhận phiên bằng mã chuyển máy (hai máy của học viên "đủ máy"; mới nhất trước → [máy 2, máy 1]).
  const [device2, device1] = await devicesOf(app, A.owner, A.orgId, full.id);
  if (!device1 || !device2) throw new Error('Cửa gác cổng: học viên "đủ máy" phải có 2 máy');
  const usedCode = await handoffCode(app, t1Full);
  must(await claimPortal(app, usedCode), 201, 'nhận phiên bằng mã (để mã thành "đã dùng")');
  const blockedCode = await handoffCode(app, t1Full);
  must(
    await request(app).post(`${api(A.orgId)}/portal-devices/${device1}/block`).set(bearer(A.owner)).send({ reason: 'Thử cửa gác' }),
    200,
    'chặn máy mẫu',
  );
  const expiredCode = await handoffCode(app, t2Full);
  const ex = await db.portalDevice.updateMany({
    where: { id: device2, organizationId: A.orgId, handoffHash: { not: null } },
    data: { handoffExpiresAt: new Date(Date.now() - 60_000) },
  });
  if (ex.count !== 1) throw new Error('Cửa gác cổng: không đặt được mã chuyển máy hết hạn');

  const H = { ...PORTAL_HDR };
  return {
    viewers,
    probes: {
      session: {
        denied: [
          { name: 'chìa không có', body: { key: newLinkKey().key, last4: live.last4 }, headers: H },
          { name: 'sai 4 số', body: { key: liveKey, last4: otherDigits(live.last4) }, headers: H },
          { name: 'đường dẫn đã thu hồi', body: { key: revokedKey, last4: revoked.last4 }, headers: H },
          { name: 'đường dẫn hết hạn', body: { key: expiredKey, last4: expired.last4 }, headers: H },
          { name: 'đường dẫn đã khoá', body: { key: lockedKey, last4: locked.last4 }, headers: H },
          { name: 'đủ 2 máy', body: { key: fullKey, last4: full.last4 }, headers: H },
          { name: 'khách đã xoá số điện thoại', body: { key: noPhoneKey, last4: noPhone.last4 }, headers: H },
          { name: 'thiếu X-Client', body: { key: liveKey, last4: live.last4 }, headers: {} },
        ],
        keep: { name: 'đúng chìa, đúng 4 số', body: { key: liveKey, last4: live.last4 }, headers: H },
      },
      claim: {
        denied: [
          { name: 'mã bịa', body: { code: newHandoffCode().code }, headers: H },
          { name: 'mã đã dùng', body: { code: usedCode }, headers: H },
          { name: 'mã hết hạn', body: { code: expiredCode }, headers: H },
          { name: 'mã của máy đã chặn', body: { code: blockedCode }, headers: H },
        ],
        handoffToken: t2Full,
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------

const VOLATILE_HEADER = /^(date|x-request-id|ratelimit.*|etag|content-length)$/;
// Dạng so sánh của một phản hồi: mã, thân bỏ requestId, tập tên header bỏ header đổi theo từng yêu cầu (bản vẽ E 6.2 E3 mục 2).
function shapeOf(res: request.Response): string {
  const body = JSON.parse(JSON.stringify(res.body ?? null)) as { error?: { requestId?: string } } | null;
  if (body?.error) delete body.error.requestId;
  const headers = Object.keys(res.headers).filter((h) => !VOLATILE_HEADER.test(h)).sort();
  return JSON.stringify({ status: res.status, body, headers });
}

const setsPortalCookie = (res: request.Response) => (portalTokenOf(res) ?? '') !== '';

export async function runPortalChecks(app: App, routes: AnyRoute[], fx: GateFixture, report: GateReport, t: GateTools): Promise<void> {
  const { key, record } = t;
  const isPortalRoute = (r: AnyRoute) => isPortalPath(r.path) || r.scope === 'portal';
  const publicAllowed = PORTAL_PUBLIC_ROUTES as readonly string[];

  // 11. portalScope — chọn theo ĐỊA CHỈ (/portal/…) VÀ theo NHÃN (scope 'portal'): đường cổng không có tham số, không query,
  //     không trường …Id(s); public dưới /portal/ chỉ là hai đường cho phép, có bộ đếm 'portal'.
  for (const r of routes.filter(isPortalRoute)) {
    const bad: string[] = [];
    if (r.scope === 'portal') {
      if (!r.path.startsWith('/portal/')) bad.push('scope portal nhưng địa chỉ không dưới /portal/');
      const ids = t.refFieldPaths(r);
      if (ids.length > 0) bad.push(`có trường mã ${ids.join(', ')} (học viên phải lấy từ phiên)`);
    } else if (r.scope === 'public') {
      if (!publicAllowed.includes(key(r))) bad.push('public ngoài danh sách cho phép');
      if (r.rateLimit !== 'portal') bad.push(`rateLimit=${r.rateLimit ?? 'không có'} (cần 'portal')`);
    } else {
      bad.push(`scope "${r.scope}" dưới /portal/`);
    }
    if (r.path.includes(':')) bad.push('có tham số đường dẫn');
    if (r.params) bad.push('khai params');
    if (r.query) bad.push('khai query');
    record(report.portalScope, bad.length === 0, `${key(r)}: ${bad.join('; ')}`);
  }

  // 12. portalWall — tường chắn hai chiều (bản vẽ E 2.3) bằng phiên cổng THẬT của A và thẻ nhân viên THẬT của chủ A.
  //     Đường nhân viên chọn theo ĐỊA CHỈ (không dưới /portal/): đường bị gắn nhầm nhãn 'portal' vẫn vào diện kiểm.
  const portalA = fx.a.portal;
  const staffJwt = fx.a.owner.accessToken;
  const staffRoutes = routes.filter((r) => !isPortalPath(r.path) && (r.scope !== 'public' || r.path.startsWith('/platform/')));
  const staffWays: [string, Record<string, string>, string][] = [
    ['cookie cổng + X-Client: portal', { cookie: portalA.cookie, 'x-client': 'portal' }, ''],
    ['Bearer thẻ cổng mpp_', { authorization: `Bearer ${portalA.token}` }, ''],
    // Studio Pro lỗi 3: thẻ (thật) đặt trên địa chỉ.
    ['thẻ nhân viên qua query ?accessToken=', {}, `?accessToken=${encodeURIComponent(staffJwt)}`],
  ];
  for (const r of staffRoutes) {
    for (const [way, headers, search] of staffWays) {
      if (r.path.startsWith('/platform/')) {
        const c = await t.sameAsFakePlatform(r, headers, search);
        record(report.portalWall, c.ok, `${key(r)} (${way}) → ${c.status}${c.same ? '' : `, KHÁC đường bịa (${c.biaStatus})`}`);
        continue;
      }
      const res = await t.send(app, r, `${t.fill(r, fx.a.ids)}${search}`, headers, {});
      record(report.portalWall, res.status === 401, `${key(r)} (${way}) → ${res.status}`);
    }
  }
  const portalRoutes = routes.filter((r) => r.scope === 'portal' || (isPortalPath(r.path) && r.scope !== 'public'));
  const portalWays: [string, Record<string, string>, string][] = [
    ['Bearer thẻ nhân viên chủ A', { authorization: `Bearer ${staffJwt}`, 'x-client': 'portal' }, ''],
    ['cookie mp_refresh + X-Client: web', { cookie: `mp_refresh=${fx.a.owner.refreshToken}`, 'x-client': 'web' }, ''],
    ['cookie cổng thiếu X-Client', { cookie: portalA.cookie }, ''],
    ['cookie cổng kèm Authorization', { cookie: portalA.cookie, 'x-client': 'portal', authorization: `Bearer ${staffJwt}` }, ''],
    // Studio Pro lỗi 3: thẻ cổng (thật) đặt trên địa chỉ thay cho cookie.
    ['thẻ cổng qua query ?accessToken=', { 'x-client': 'portal' }, `?accessToken=${encodeURIComponent(portalA.token)}`],
  ];
  for (const r of portalRoutes) {
    for (const [way, headers, search] of portalWays) {
      const res = await t.send(app, r, `${t.fill(r, fx.a.ids)}${search}`, headers, {});
      record(report.portalWall, res.status === 401, `${key(r)} (${way}) → ${res.status}`);
    }
  }

  // 13. portalLeak — mọi đường cổng GET × phiên A1, A2, T1: không bí mật của người khác / ghi chú nội bộ / SĐT / email,
  //     không UUID (bỏ trường …Url); GIỮ: 200 và có mã hợp đồng + tên của chính mình.
  for (const r of routes.filter((x) => x.scope === 'portal' && x.method === 'get' && isPortalPath(x.path))) {
    for (const v of fx.portal.viewers) {
      const res = await t.send(app, r, `/api/v1${r.path}`, { ...PORTAL_HDR, cookie: `mp_portal=${v.token}` }, {});
      const text = JSON.stringify(res.body ?? '');
      const leaked = v.forbidden.filter((s) => text.includes(s));
      const uuids = uuidsIn(res.body);
      const missing = v.own.filter((s) => !text.includes(s));
      record(
        report.portalLeak,
        res.status === 200 && leaked.length === 0 && uuids.length === 0 && missing.length === 0,
        `${key(r)} (${v.name}) → ${res.status}, lộ ${leaked.length} giá trị [${leaked.map((s) => s.slice(0, 40)).join(' | ')}], ` +
          `${uuids.length} UUID, thiếu ${missing.length} giá trị của chính mình`,
      );
    }
  }

  // 14. portalProbe — mọi đường public dưới /portal/: bộ đầu vào hỏng → 401 GIỐNG HỆT nhau (mã, thân trừ requestId, tập
  //     tên header), không đặt cookie; GIỮ: đầu vào đúng → 201 + cookie. Đường public mới chưa có bộ đầu vào → vi phạm.
  for (const r of routes.filter((x) => x.scope === 'public' && isPortalPath(x.path))) {
    const k = key(r);
    const url = `/api/v1${r.path}`;
    const call = (i: PortalProbeInput) => t.send(app, r, url, { ...i.headers, 'user-agent': 'Mozilla/5.0 (iPhone) Safari' }, i.body);
    const compare = async (inputs: PortalProbeInput[], ref: { name: string; shape: string } | null) => {
      let base = ref;
      for (const i of inputs) {
        const res = await call(i);
        const shape = shapeOf(res);
        base ??= { name: i.name, shape };
        const same = shape === base.shape;
        record(
          report.portalProbe,
          res.status === 401 && !setsPortalCookie(res) && same,
          `${k} [${i.name}] → ${res.status}${same ? '' : `, KHÁC phản hồi "${base.name}": ${JSON.stringify(res.body).slice(0, 120)}`}`,
        );
      }
      return base;
    };
    const keep = async (i: PortalProbeInput) => {
      const res = await call(i);
      record(report.portalProbe, res.status === 201 && setsPortalCookie(res), `${k} [GIỮ: ${i.name}] → ${res.status} (cần 201 + cookie)`);
    };
    if (k === 'POST /portal/session') {
      await compare(fx.portal.probes.session.denied, null);
      await keep(fx.portal.probes.session.keep);
    } else if (k === 'POST /portal/session/claim') {
      const c = fx.portal.probes.claim;
      const ref = await compare(c.denied, null);
      // Mã còn sống tạo NGAY lúc này (ghi đè mã hết hạn của cùng máy — vì vậy chạy sau bộ trên).
      const res = await handoff(app, c.handoffToken);
      const code = (res.body as { code?: string }).code;
      if (res.status !== 201 || !code) {
        record(report.portalProbe, false, `${k}: không tạo được mã chuyển máy cho vế GIỮ → ${res.status}`);
        continue;
      }
      await compare([{ name: 'thiếu X-Client', body: { code }, headers: {} }], ref);
      await keep({ name: 'mã còn sống', body: { code }, headers: { ...PORTAL_HDR } });
    } else {
      record(report.portalProbe, false, `${k}: đường public dưới /portal/ chưa có bộ đầu vào hỏng trong gate-portal.ts`);
    }
  }
}
