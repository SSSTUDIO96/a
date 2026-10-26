// GIẤY CHỨNG NHẬN qua API (BAN-VE-F mục 9.1, ca S1, S3–S18; S2 + S19 ở giay-chung-nhan-vai-tro.test.ts; đua ở
// giay-chung-nhan-dua.test.ts). Dữ liệu dựng bằng đúng đường API thật (khoá, lớp, hợp đồng khoá học XÁC NHẬN → ghi danh).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { getStorage, LocalDiskDriver, verifyToken } from '../src/lib/storage';
import { todayIn } from '../src/modules/courses/present';
import type { Db } from '../src/lib/prisma';
import { addMember, bearer, createAcademyOrg, createOrg, grantUnlimitedPlan, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';
import { makePng } from './png';

const deps = makeDeps();
const db = deps.db;
let app: App;

beforeAll(() => {
  app = makeApp(deps);
});
afterAll(async () => {
  await db.$disconnect();
});

const idem = () => `k-${randomUUID()}`;
const api = (orgId: string, rest: string) => `/api/v1/orgs/${orgId}${rest}`;

// URL ký phải là vé của ĐÚNG tệp (giải vé bằng khoá ký của kho tệp → storageKey so với tệp trong database).
async function expectSignedFor(url: string | undefined, fileId: string, what: string) {
  expect(url, `${what}: có URL ảnh`).toMatch(/\/api\/v1\/files\/raw\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const s = getStorage();
  if (!(s instanceof LocalDiskDriver)) throw new Error('Bài thử cần driver đĩa cục bộ');
  const check = verifyToken(s.signingSecret, url!.split('/').pop() ?? '');
  const key = (await db.storedFile.findUniqueOrThrow({ where: { id: fileId } })).storageKey;
  expect(check.ok ? check.key : `vé hỏng: ${check.reason}`, `${what}: vé của đúng tệp ${fileId}`).toBe(key);
}

interface Org {
  orgId: string;
  owner: TestUser;
  tz: string;
}

function addDays(wire: string, n: number): string {
  const d = new Date(`${wire}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Múi giờ mà "hôm nay" KHÁC hôm nay theo UTC (UTC+14 hoặc UTC−11 — lúc nào cũng có ít nhất một): máy chủ tính theo UTC là đỏ.
function tzUnlikeUtc(): string {
  const utc = todayIn('UTC');
  const tz = ['Pacific/Kiritimati', 'Pacific/Pago_Pago'].find((z) => todayIn(z) !== utc);
  if (!tz) throw new Error('Không tìm được múi giờ lệch ngày với UTC');
  return tz;
}

async function academy(label: string, tz = 'Asia/Ho_Chi_Minh'): Promise<Org> {
  const owner = await registerUser(app, `gcn-${label}`);
  const orgId = await createAcademyOrg(app, owner, `gcn-${label}`);
  await grantUnlimitedPlan(db, orgId);
  if (tz !== 'Asia/Ho_Chi_Minh') {
    await request(app).patch(api(orgId, '')).set(bearer(owner)).send({ timezone: tz }).expect(200);
  }
  return { orgId, owner, tz };
}

async function post(a: Org, path: string, body: object, user: TestUser = a.owner) {
  return request(app).post(api(a.orgId, path)).set(bearer(user)).set('idempotency-key', idem()).send(body);
}

async function postOk(a: Org, path: string, body: object): Promise<Record<string, unknown>> {
  const res = await post(a, path, body);
  if (res.status !== 201 && res.status !== 200) throw new Error(`${path} → ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as Record<string, unknown>;
}

interface Klass {
  courseId: string;
  classId: string;
}

async function klass(a: Org, opts: { endDate: string; startDate?: string; instructorMembershipId?: string; fee?: number }): Promise<Klass> {
  const startDate = opts.startDate ?? addDays(opts.endDate, -30);
  const body = (await postOk(a, '/courses', {
    name: `Khoá ${randomUUID().slice(0, 6)}`,
    mode: 'MULTI_CLASS',
    tuitionFee: opts.fee ?? 5_000_000,
    defaultCapacity: 30,
    firstClass: {
      name: `Lớp ${randomUUID().slice(0, 6)}`,
      startDate,
      endDate: opts.endDate,
      weekdays: [2],
      ...(opts.instructorMembershipId ? { instructorMembershipId: opts.instructorMembershipId } : {}),
    },
  })) as { course: { id: string }; classes: { id: string }[] };
  return { courseId: body.course.id, classId: body.classes[0]!.id };
}

interface Student {
  customerId: string;
  contractId: string;
  enrollmentId: string;
  name: string;
}

async function enroll(a: Org, classId: string, name = `Học viên ${randomUUID().slice(0, 6)}`): Promise<Student> {
  const customerId = (await postOk(a, '/customers', { fullName: name })).id as string;
  const contractId = (await postOk(a, '/contracts', { kind: 'COURSE', customerId, lines: [{ kind: 'COURSE', courseClassId: classId }] })).id as string;
  await postOk(a, `/contracts/${contractId}/status`, { to: 'CONFIRMED' });
  const res = await request(app).get(api(a.orgId, `/classes/${classId}/enrollments`)).set(bearer(a.owner)).expect(200);
  const e = (res.body.items as { id: string; customer: { id: string } }[]).find((x) => x.customer.id === customerId);
  if (!e) throw new Error('Không thấy ghi danh vừa tạo');
  return { customerId, contractId, enrollmentId: e.id, name };
}

const issueBody = (enrollmentIds: string[], issuedOn: string, extra: object = {}) => ({ enrollmentIds, templateCode: 'cc-01', issuedOn, ...extra });

interface View {
  id: string;
  code: string;
  year: number;
  seq: number;
  reissueNo: number;
  status: string;
  issuedOn: string;
  reissuedOn: string | null;
  templateCode: string;
  studentName: string;
  courseName: string;
  className: string;
  instructorName: string | null;
  signerName: string | null;
  signerTitle: string | null;
  brandName: string;
  photo: { url: string; width: number | null; height: number | null } | null;
  enrollmentId: string;
  customer: { id: string; fullName: string };
  revokeReason: string | null;
  replacesId: string | null;
  replacedById: string | null;
}

const ENDED = '2026-03-30';

describe('S1 — tổ chức không ACADEMY', () => {
  it('6 đường giấy chứng nhận đều 403 ACADEMY_REQUIRED', async () => {
    const owner = await registerUser(app, 'gcn-team');
    const orgId = await createOrg(app, owner, 'gcn-team');
    const x = randomUUID();
    const calls = [
      request(app).get(api(orgId, `/classes/${x}/certificates`)).set(bearer(owner)),
      request(app).post(api(orgId, `/classes/${x}/certificates`)).set(bearer(owner)).set('idempotency-key', idem()).send(issueBody([randomUUID()], ENDED)),
      request(app).get(api(orgId, '/certificates')).set(bearer(owner)),
      request(app).get(api(orgId, `/certificates/${x}`)).set(bearer(owner)),
      request(app).post(api(orgId, `/certificates/${x}/reissue`)).set(bearer(owner)).set('idempotency-key', idem()).send({ reason: 'Sai tên' }),
      request(app).post(api(orgId, `/certificates/${x}/revoke`)).set(bearer(owner)).send({ reason: 'Nhầm' }),
    ];
    const res = await Promise.all(calls);
    expect(res.map((r) => r.status)).toEqual([403, 403, 403, 403, 403, 403]);
    for (const r of res) {
      expect(r.body.error.message).toBe('Tổ chức chưa bật đào tạo');
      expect(r.body.error.details.reason).toBe('ACADEMY_REQUIRED');
    }
  });
});

describe('S3–S5 — lớp đã kết thúc, ngày cấp, theo múi giờ tổ chức', () => {
  it('kết thúc ngày mai → 409 CLASS_NOT_ENDED; kết thúc hôm nay → cấp được; ngày cấp sai → 400 issuedOn', async () => {
    const tz = tzUnlikeUtc();
    const a = await academy('ngay', tz);
    const today = todayIn(tz);
    const tomorrow = addDays(today, 1);

    const k1 = await klass(a, { endDate: tomorrow });
    const s1 = await enroll(a, k1.classId);
    const r1 = await post(a, `/classes/${k1.classId}/certificates`, issueBody([s1.enrollmentId], today));
    expect(r1.status).toBe(409);
    expect(r1.body.error.details).toEqual({ reason: 'CLASS_NOT_ENDED', endDate: tomorrow });
    const [y, m, d] = tomorrow.split('-');
    expect(r1.body.error.message).toBe(`Lớp kết thúc ngày ${d}/${m}/${y} — cấp được từ ngày đó`);
    // Đường 1: lớp chưa kết thúc vẫn 200, ended false, không có số dự kiến.
    const roster1 = await request(app).get(api(a.orgId, `/classes/${k1.classId}/certificates`)).set(bearer(a.owner)).expect(200);
    expect(roster1.body.ended).toBe(false);
    expect(roster1.body.nextNumber).toBeNull();
    expect(roster1.body.today).toBe(today);

    const k2 = await klass(a, { endDate: today });
    const s2 = await enroll(a, k2.classId);
    const before = await post(a, `/classes/${k2.classId}/certificates`, issueBody([s2.enrollmentId], addDays(today, -1)));
    expect(before.status).toBe(400);
    expect(before.body.error.details.issues).toEqual([{ path: 'issuedOn', message: `Ngày cấp phải từ ngày kết thúc lớp (${today.split('-').reverse().join('/')}) trở đi` }]);
    const after = await post(a, `/classes/${k2.classId}/certificates`, issueBody([s2.enrollmentId], tomorrow));
    expect(after.status).toBe(400);
    expect(after.body.error.details.issues).toEqual([{ path: 'issuedOn', message: 'Ngày cấp không được sau hôm nay' }]);
    const ok = await post(a, `/classes/${k2.classId}/certificates`, issueBody([s2.enrollmentId], today));
    expect(ok.status).toBe(201);
    expect(ok.body.items[0].issuedOn).toBe(today);
    const roster2 = await request(app).get(api(a.orgId, `/classes/${k2.classId}/certificates`)).set(bearer(a.owner)).expect(200);
    expect(roster2.body.ended).toBe(true);
    expect(roster2.body.defaultIssuedOn).toBe(today);
  });

  it('lớp đã huỷ → 409 CLASS_CANCELLED (đường 1 vẫn 200, ended false)', async () => {
    const a = await academy('huy-lop');
    const k = await klass(a, { endDate: ENDED });
    await postOk(a, `/classes/${k.classId}/cancel`, { reason: 'Thử' });
    const res = await post(a, `/classes/${k.classId}/certificates`, issueBody([randomUUID()], ENDED));
    expect(res.status).toBe(409);
    expect(res.body.error.details.reason).toBe('CLASS_CANCELLED');
    const roster = await request(app).get(api(a.orgId, `/classes/${k.classId}/certificates`)).set(bearer(a.owner)).expect(200);
    expect(roster.body.ended).toBe(false);
  });
});

describe('S6 — số theo năm, theo thứ tự ghi danh, theo tổ chức', () => {
  it('0001..0003 theo thứ tự ghi danh dù gửi ngược; lần sau 0004; năm khác đếm riêng; tổ chức khác đếm riêng', async () => {
    const a = await academy('so');
    const k = await klass(a, { endDate: ENDED });
    const s = [await enroll(a, k.classId, 'An'), await enroll(a, k.classId, 'Bình'), await enroll(a, k.classId, 'Chi')];
    const roster0 = await request(app).get(api(a.orgId, `/classes/${k.classId}/certificates`)).set(bearer(a.owner)).expect(200);
    expect(roster0.body.nextNumber).toEqual({ year: 2026, seq: 1, code: 'CC-2026-0001' });
    const res = await post(a, `/classes/${k.classId}/certificates`, issueBody([s[2]!.enrollmentId, s[0]!.enrollmentId, s[1]!.enrollmentId], ENDED));
    expect(res.status).toBe(201);
    expect(res.body.issuedCount).toBe(3);
    expect(res.body.existingCount).toBe(0);
    const items = res.body.items as View[];
    expect(items.map((i) => [i.studentName, i.code])).toEqual([
      ['An', 'CC-2026-0001'],
      ['Bình', 'CC-2026-0002'],
      ['Chi', 'CC-2026-0003'],
    ]);
    // S6b
    const s4 = await enroll(a, k.classId, 'Dung');
    const next = await post(a, `/classes/${k.classId}/certificates`, issueBody([s4.enrollmentId], ENDED));
    expect((next.body.items as View[])[0]!.code).toBe('CC-2026-0004');
    // S6c: năm của NGÀY CẤP (lớp kết thúc cuối 2025, cấp ngày 31/12/2025).
    const k25 = await klass(a, { endDate: '2025-12-30' });
    const s25 = await enroll(a, k25.classId);
    const r25 = await post(a, `/classes/${k25.classId}/certificates`, issueBody([s25.enrollmentId], '2025-12-31'));
    expect((r25.body.items as View[])[0]!.code).toBe('CC-2025-0001');
    expect((r25.body.items as View[])[0]!.year).toBe(2025);
    // Số dự kiến của đường 1 theo năm của issuedOn truy vấn.
    const roster = await request(app).get(api(a.orgId, `/classes/${k.classId}/certificates?issuedOn=${ENDED}`)).set(bearer(a.owner)).expect(200);
    expect(roster.body.nextNumber).toEqual({ year: 2026, seq: 5, code: 'CC-2026-0005' });
    // S6d
    const b = await academy('so-b');
    const kb = await klass(b, { endDate: ENDED });
    const sb = await enroll(b, kb.classId);
    const rb = await post(b, `/classes/${kb.classId}/certificates`, issueBody([sb.enrollmentId], ENDED));
    expect((rb.body.items as View[])[0]!.code).toBe('CC-2026-0001');
  });
});

describe('S7 — chống gửi trùng', () => {
  it('cùng Idempotency-Key → cùng phản hồi, không thêm dòng; khoá khác cùng học viên → existing, không số mới', async () => {
    const a = await academy('idem');
    const k = await klass(a, { endDate: ENDED });
    const s = [await enroll(a, k.classId), await enroll(a, k.classId)];
    const key = idem();
    const body = issueBody(s.map((x) => x.enrollmentId), ENDED);
    const send = () => request(app).post(api(a.orgId, `/classes/${k.classId}/certificates`)).set(bearer(a.owner)).set('idempotency-key', key).send(body);
    const first = await send();
    expect(first.status).toBe(201);
    const count = await db.certificate.count({ where: { organizationId: a.orgId } });
    const again = await send();
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(await db.certificate.count({ where: { organizationId: a.orgId } })).toBe(count);
    const other = await post(a, `/classes/${k.classId}/certificates`, { ...body, templateCode: 'cc-05' });
    expect(other.status).toBe(201);
    expect(other.body.issuedCount).toBe(0);
    expect(other.body.existingCount).toBe(2);
    expect((other.body.items as View[]).map((i) => [i.code, i.templateCode])).toEqual(
      (first.body.items as View[]).map((i) => [i.code, 'cc-01']),
    );
    expect(await db.certificate.count({ where: { organizationId: a.orgId } })).toBe(count);
  });
});

describe('S8 — ghi danh không hợp lệ', () => {
  it('ghi danh đã huỷ → lời riêng; lớp khác, tổ chức khác, mã bịa → 400 lời GIỐNG HỆT nhau', async () => {
    const a = await academy('ghidanh');
    const k = await klass(a, { endDate: ENDED });
    const ok = await enroll(a, k.classId);
    const cancelled = await enroll(a, k.classId, 'Huỷ Ghi Danh');
    await postOk(a, `/contracts/${cancelled.contractId}/status`, { to: 'CANCELLED', reason: 'Thôi học' });
    const kOther = await klass(a, { endDate: ENDED });
    const otherClass = await enroll(a, kOther.classId);
    const b = await academy('ghidanh-b');
    const kb = await klass(b, { endDate: ENDED });
    const otherOrg = await enroll(b, kb.classId);

    const rCancel = await post(a, `/classes/${k.classId}/certificates`, issueBody([ok.enrollmentId, cancelled.enrollmentId], ENDED));
    expect(rCancel.status).toBe(400);
    expect(rCancel.body.error.details.issues).toEqual([{ path: 'enrollmentIds.1', message: 'Học viên Huỷ Ghi Danh đã huỷ ghi danh' }]);

    const bodies = [otherClass.enrollmentId, otherOrg.enrollmentId, randomUUID()].map((x) => issueBody([ok.enrollmentId, x], ENDED));
    const res = await Promise.all(bodies.map((bd) => post(a, `/classes/${k.classId}/certificates`, bd)));
    const norm = (r: request.Response) => JSON.stringify({ s: r.status, e: { ...r.body.error, requestId: undefined } });
    expect(res.map((r) => r.status)).toEqual([400, 400, 400]);
    expect(new Set(res.map(norm)).size).toBe(1);
    expect(res[0]!.body.error.details.issues).toEqual([{ path: 'enrollmentIds.1', message: 'Không tìm thấy học viên này trong lớp' }]);
    expect(await db.certificate.count({ where: { organizationId: a.orgId } })).toBe(0);
  });
});

describe('S9 — nợ học phí: cảnh báo, không chặn; tiền chỉ cho người có quyền', () => {
  it('201 kèm debtWarnings; người thiếu quyền tiền thấy debt null; đường 1 che total/paid/debt', async () => {
    const a = await academy('no');
    const k = await klass(a, { endDate: ENDED, fee: 5_000_000 });
    const owes = await enroll(a, k.classId, 'Còn Nợ');
    const paid = await enroll(a, k.classId, 'Đã Trả');
    const third = await enroll(a, k.classId, 'Người Ba');
    await postOk(a, `/contracts/${owes.contractId}/payments`, { method: 'CASH', amount: 2_000_000 });
    await postOk(a, `/contracts/${paid.contractId}/payments`, { method: 'CASH', amount: 5_000_000 });

    const roster = await request(app).get(api(a.orgId, `/classes/${k.classId}/certificates`)).set(bearer(a.owner)).expect(200);
    expect(roster.body.moneyVisible).toBe(true);
    const byName = new Map((roster.body.items as { customer: { fullName: string }; contract: unknown }[]).map((i) => [i.customer.fullName, i.contract]));
    expect(byName.get('Còn Nợ')).toMatchObject({ total: 5_000_000, paid: 2_000_000, debt: 3_000_000 });
    expect(byName.get('Đã Trả')).toMatchObject({ total: 5_000_000, paid: 5_000_000, debt: 0 });

    const res = await post(a, `/classes/${k.classId}/certificates`, issueBody([owes.enrollmentId, paid.enrollmentId], ENDED));
    expect(res.status).toBe(201);
    expect(res.body.issuedCount).toBe(2);
    expect(res.body.debtWarnings).toEqual([{ enrollmentId: owes.enrollmentId, customerName: 'Còn Nợ', contractCode: expect.any(String), debt: 3_000_000 }]);

    // Vai trò tự tạo: cấp được nhưng không có contracts.read / payments.read.
    const roleRes = await post(a, '/roles', { key: 'cap_gcn', name: 'Cấp giấy', permissions: ['org.read', 'certificates.read', 'certificates.issue'] });
    expect(roleRes.status).toBe(201);
    const issuer = await registerUser(app, 'gcn-cap');
    await addMember(app, a.owner, a.orgId, issuer, ['cap_gcn']);
    const r2 = await post(a, `/classes/${k.classId}/certificates`, issueBody([third.enrollmentId], ENDED), issuer);
    expect(r2.status).toBe(201);
    expect(r2.body.debtWarnings).toEqual([{ enrollmentId: third.enrollmentId, customerName: 'Người Ba', contractCode: expect.any(String), debt: null }]);
    const roster2 = await request(app).get(api(a.orgId, `/classes/${k.classId}/certificates`)).set(bearer(issuer)).expect(200);
    expect(roster2.body.moneyVisible).toBe(false);
    for (const i of roster2.body.items as { contract: Record<string, unknown> }[]) {
      expect([i.contract.total, i.contract.paid, i.contract.debt]).toEqual([null, null, null]);
    }
    // Nợ lúc cấp ghi trong nhật ký (lưu vết), không trả cho web.
    const log = await db.auditLog.findFirst({ where: { organizationId: a.orgId, action: 'certificate.issued', entityId: (res.body.items as View[])[0]!.id } });
    expect((log?.data as { debtAtIssue?: number }).debtAtIssue).toBe(3_000_000);
  });
});

describe('S10, S11 — bản chụp lúc cấp, ảnh', () => {
  it('đổi tên khách, khoá, lớp, giảng viên, Giám đốc sau khi cấp → GET trả y cũ; ảnh xoá mềm → photo null', async () => {
    const a = await academy('chup');
    const teacher = await registerUser(app, 'gcn-gv');
    const membershipId = await addMember(app, a.owner, a.orgId, teacher, ['instructor']);
    await request(app).patch(api(a.orgId, `/staff/${membershipId}`)).set(bearer(a.owner)).send({ displayName: 'Cô Lan' }).expect(200);
    await request(app).put(api(a.orgId, '/profile')).set(bearer(a.owner)).send({ brandName: 'Học viện Ánh' }).expect(200);
    await request(app).put(api(a.orgId, '/profile/certificate')).set(bearer(a.owner)).send({ signerName: 'Nguyễn Văn A', signerTitle: null }).expect(200);
    const k = await klass(a, { endDate: ENDED, instructorMembershipId: membershipId });
    const withPhoto = await enroll(a, k.classId, 'Có Ảnh');
    const noPhoto = await enroll(a, k.classId, 'Không Ảnh');
    const up = await request(app)
      .post(api(a.orgId, '/files?purpose=CUSTOMER_AVATAR&name=anh.png'))
      .set(bearer(a.owner))
      .set('idempotency-key', idem())
      .set('content-type', 'application/octet-stream')
      .send(makePng(4, 5));
    expect(up.status).toBe(201);
    await request(app).patch(api(a.orgId, `/customers/${withPhoto.customerId}`)).set(bearer(a.owner)).send({ avatarFileId: up.body.id }).expect(200);

    const res = await post(a, `/classes/${k.classId}/certificates`, issueBody([withPhoto.enrollmentId, noPhoto.enrollmentId], ENDED, { fontOverride: 'ky-2' }));
    expect(res.status).toBe(201);
    const [c1, c2] = res.body.items as View[];
    expect(c1!.photo).toMatchObject({ url: expect.any(String), width: 4, height: 5 });
    expect(c2!.photo).toBeNull();
    expect(c1).toMatchObject({ studentName: 'Có Ảnh', instructorName: 'Cô Lan', signerName: 'Nguyễn Văn A', signerTitle: 'Giám đốc trung tâm', brandName: 'Học viện Ánh' });
    const snap = (v: View) => [v.studentName, v.courseName, v.className, v.instructorName, v.signerName, v.signerTitle, v.brandName, v.code, v.issuedOn];
    const before = snap(c1!);

    await request(app).patch(api(a.orgId, `/customers/${withPhoto.customerId}`)).set(bearer(a.owner)).send({ fullName: 'Tên Mới' }).expect(200);
    await request(app).patch(api(a.orgId, `/courses/${k.courseId}`)).set(bearer(a.owner)).send({ name: 'Khoá đổi tên' }).expect(200);
    await request(app).patch(api(a.orgId, `/classes/${k.classId}`)).set(bearer(a.owner)).send({ name: 'Lớp đổi tên' }).expect(200);
    await request(app).patch(api(a.orgId, `/staff/${membershipId}`)).set(bearer(a.owner)).send({ displayName: 'Thầy Khác' }).expect(200);
    await request(app).put(api(a.orgId, '/profile/certificate')).set(bearer(a.owner)).send({ signerName: 'Người Khác', signerTitle: 'Hiệu trưởng' }).expect(200);
    await request(app).put(api(a.orgId, '/profile')).set(bearer(a.owner)).send({ brandName: 'Tên thương hiệu mới' }).expect(200);

    const got = await request(app).get(api(a.orgId, `/certificates/${c1!.id}`)).set(bearer(a.owner)).expect(200);
    expect(snap(got.body as View)).toEqual(before);
    expect((got.body as View).customer.fullName).toBe('Tên Mới');

    // N6 (nghiệm thu F, T3; KY-DUYET-F câu 1): ĐỔI ảnh hồ sơ sau khi cấp → GET một bản, GET sổ (?ids=, đường "In lại") và GET theo khách
    // vẫn trả ẢNH LÚC CẤP (tệp cũ, 4×5), không phải ảnh hiện hành của hồ sơ (tệp mới, 8×9).
    await expectSignedFor(c1!.photo?.url, up.body.id, 'lúc cấp');
    const up2 = await request(app)
      .post(api(a.orgId, '/files?purpose=CUSTOMER_AVATAR&name=anh-moi.png'))
      .set(bearer(a.owner))
      .set('idempotency-key', idem())
      .set('content-type', 'application/octet-stream')
      .send(makePng(8, 9));
    expect(up2.status).toBe(201);
    await request(app).patch(api(a.orgId, `/customers/${withPhoto.customerId}`)).set(bearer(a.owner)).send({ avatarFileId: up2.body.id }).expect(200);
    expect((await db.customer.findUniqueOrThrow({ where: { id: withPhoto.customerId } })).avatarFileId, 'hồ sơ đã đổi sang ảnh mới').toBe(up2.body.id);
    expect(up2.body.id).not.toBe(up.body.id);
    const swapped = await request(app).get(api(a.orgId, `/certificates/${c1!.id}`)).set(bearer(a.owner)).expect(200);
    expect((swapped.body as View).photo).toMatchObject({ width: 4, height: 5 });
    await expectSignedFor((swapped.body as View).photo?.url, up.body.id, 'GET một bản sau khi đổi ảnh hồ sơ');
    const byIds = await request(app).get(api(a.orgId, `/certificates?ids=${c1!.id}`)).set(bearer(a.owner)).expect(200);
    expect((byIds.body.items as View[]).map((v) => v.id)).toEqual([c1!.id]);
    await expectSignedFor((byIds.body.items as View[])[0]!.photo?.url, up.body.id, 'GET sổ ?ids= sau khi đổi ảnh hồ sơ');
    const byCustomer = await request(app).get(api(a.orgId, `/certificates?customerId=${withPhoto.customerId}`)).set(bearer(a.owner)).expect(200);
    await expectSignedFor((byCustomer.body.items as View[])[0]!.photo?.url, up.body.id, 'GET sổ ?customerId= sau khi đổi ảnh hồ sơ');

    // S11b: xoá mềm ảnh sau khi cấp → photo null, không lỗi.
    await request(app).delete(api(a.orgId, `/files/${up.body.id}`)).set(bearer(a.owner)).expect((r) => expect([200, 204]).toContain(r.status));
    const after = await request(app).get(api(a.orgId, `/certificates/${c1!.id}`)).set(bearer(a.owner)).expect(200);
    expect(after.body.photo).toBeNull();
  });
});

describe('S12, S13 — cấp lại giữ số, thu hồi', () => {
  it('cấp lại: giữ số, reissueNo tăng, bản cũ thu hồi có lý do; cấp lại bản đã thu hồi → 409 kèm replacedById', async () => {
    const a = await academy('caplai');
    const k = await klass(a, { endDate: ENDED });
    const s = await enroll(a, k.classId, 'Nguyen Thi Hoa');
    const first = ((await postOk(a, `/classes/${k.classId}/certificates`, issueBody([s.enrollmentId], ENDED))).items as View[])[0]!;
    const r1 = await post(a, `/certificates/${first.id}/reissue`, { reason: 'Sai tên / sai dấu', studentName: 'Nguyễn Thị Hoa', templateCode: 'cc-07' });
    expect(r1.status).toBe(201);
    const v1 = r1.body as View;
    expect(v1).toMatchObject({ code: first.code, seq: first.seq, year: first.year, reissueNo: 1, reissuedOn: todayIn(a.tz), issuedOn: ENDED, studentName: 'Nguyễn Thị Hoa', templateCode: 'cc-07', replacesId: first.id, status: 'ISSUED' });
    const old = await request(app).get(api(a.orgId, `/certificates/${first.id}`)).set(bearer(a.owner)).expect(200);
    expect(old.body).toMatchObject({ status: 'REVOKED', revokeReason: 'Sai tên / sai dấu', replacedById: v1.id });
    // Tên trong hồ sơ khách KHÔNG đổi.
    expect(old.body.customer.fullName).toBe('Nguyen Thi Hoa');
    const r2 = await post(a, `/certificates/${v1.id}/reissue`, { reason: 'Đổi mẫu' });
    expect(r2.status).toBe(201);
    expect(r2.body).toMatchObject({ code: first.code, reissueNo: 2, templateCode: 'cc-07', studentName: 'Nguyen Thi Hoa', replacesId: v1.id });
    // S12b
    const again = await post(a, `/certificates/${first.id}/reissue`, { reason: 'Thử lại' });
    expect(again.status).toBe(409);
    expect(again.body.error.details).toEqual({ reason: 'CERTIFICATE_REVOKED', replacedById: v1.id });
    expect(again.body.error.message).toBe('Bản này đã thu hồi — cấp lại từ bản đang hiệu lực');
    const audits = await db.auditLog.findMany({ where: { organizationId: a.orgId, entityType: 'certificate' }, select: { action: true } });
    expect(audits.map((x) => x.action).sort()).toEqual(['certificate.issued', 'certificate.reissued', 'certificate.reissued', 'certificate.revoked', 'certificate.revoked']);
  });

  it('cấp lại khi ghi danh đã huỷ / lớp dời ngày kết thúc / lớp đã huỷ → 409 lời rõ ràng (database cũng chặn, máy chủ chặn trước)', async () => {
    const a = await academy('caplai-chan');
    const k = await klass(a, { endDate: ENDED });
    const s1 = await enroll(a, k.classId);
    const s2 = await enroll(a, k.classId);
    const items = (await postOk(a, `/classes/${k.classId}/certificates`, issueBody([s1.enrollmentId, s2.enrollmentId], ENDED))).items as View[];
    await postOk(a, `/contracts/${s1.contractId}/status`, { to: 'CANCELLED', reason: 'Thôi học' });
    const r1 = await post(a, `/certificates/${items[0]!.id}/reissue`, { reason: 'Sai tên' });
    expect(r1.status).toBe(409);
    expect(r1.body.error).toMatchObject({ message: 'Học viên đã huỷ ghi danh — không cấp lại được', details: { reason: 'ENROLLMENT_CANCELLED' } });

    await db.courseClass.update({ where: { id: k.classId }, data: { endDate: new Date('2026-04-15T00:00:00.000Z') } });
    const r2 = await post(a, `/certificates/${items[1]!.id}/reissue`, { reason: 'Sai tên' });
    expect(r2.status).toBe(409);
    expect(r2.body.error.details).toMatchObject({ reason: 'CLASS_END_AFTER_ISSUE', endDate: '2026-04-15', issuedOn: ENDED });

    // Lớp chỉ huỷ được khi không còn ghi danh hiệu lực (CHECK course_classes_cancel_empty) → ca "lớp huỷ" luôn đi qua
    // "ghi danh đã huỷ" trước: vẫn 409 lời rõ ràng, không phải 400 lời chung của trigger.
    await db.courseClass.update({ where: { id: k.classId }, data: { endDate: new Date(`${ENDED}T00:00:00.000Z`) } });
    await postOk(a, `/contracts/${s2.contractId}/status`, { to: 'CANCELLED', reason: 'Thôi học' });
    await postOk(a, `/classes/${k.classId}/cancel`, { reason: 'Đóng lớp' });
    const r3 = await post(a, `/certificates/${items[1]!.id}/reissue`, { reason: 'Sai tên' });
    expect(r3.status).toBe(409);
    expect(r3.body.error.details).toEqual({ reason: 'ENROLLMENT_CANCELLED' });
    // Thu hồi vẫn được (giấy đã cấp không tự thu hồi khi huỷ ghi danh).
    const rv = await request(app).post(api(a.orgId, `/certificates/${items[0]!.id}/revoke`)).set(bearer(a.owner)).send({ reason: 'Huỷ ghi danh' });
    expect(rv.status).toBe(200);
  });

  it('thu hồi: lý do bắt buộc; lần hai 409; cấp hàng loạt sau đó nhận SỐ MỚI', async () => {
    const a = await academy('thuhoi');
    const k = await klass(a, { endDate: ENDED });
    const s = await enroll(a, k.classId);
    const c = ((await postOk(a, `/classes/${k.classId}/certificates`, issueBody([s.enrollmentId], ENDED))).items as View[])[0]!;
    const revoke = (body: object) => request(app).post(api(a.orgId, `/certificates/${c.id}/revoke`)).set(bearer(a.owner)).send(body);
    expect((await revoke({})).status).toBe(400);
    const blank = await revoke({ reason: '   ' });
    expect(blank.status).toBe(400);
    expect(blank.body.error.details.issues[0].path).toBe('reason');
    const ok = await revoke({ reason: 'Cấp nhầm' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'REVOKED', revokeReason: 'Cấp nhầm', code: 'CC-2026-0001' });
    // N8 (nghiệm thu F, T3): thu hồi TAY phải ghi nhật ký — ĐÚNG MỘT dòng certificate.revoked của bản này, kèm lý do và số giấy,
    // không phải dòng "via: reissue" của cấp lại (bản này chưa từng cấp lại).
    const logs = await db.auditLog.findMany({ where: { organizationId: a.orgId, entityType: 'certificate', entityId: c.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((x) => x.action), 'nhật ký của bản vừa thu hồi: cấp rồi thu hồi').toEqual(['certificate.issued', 'certificate.revoked']);
    expect(logs[1]).toMatchObject({ actorUserId: a.owner.id, data: { code: 'CC-2026-0001', reissueNo: 0, reason: 'Cấp nhầm', enrollmentId: s.enrollmentId } });
    expect((logs[1]!.data as Record<string, unknown>).via, 'thu hồi tay không mang dấu via').toBeUndefined();
    const twice = await revoke({ reason: 'Lần hai' });
    expect(twice.status).toBe(409);
    expect(twice.body.error).toMatchObject({ message: 'Bản này đã thu hồi', details: { reason: 'CERTIFICATE_REVOKED', replacedById: null } });
    expect(await db.auditLog.count({ where: { organizationId: a.orgId, action: 'certificate.revoked', entityId: c.id } }), 'thu hồi lần hai bị chặn không ghi thêm nhật ký').toBe(1);
    const roster = await request(app).get(api(a.orgId, `/classes/${k.classId}/certificates`)).set(bearer(a.owner)).expect(200);
    expect(roster.body.items[0].certificate).toBeNull();
    expect(roster.body.items[0].lastRevoked).toMatchObject({ id: c.id, code: 'CC-2026-0001', revokeReason: 'Cấp nhầm' });
    const fresh = ((await postOk(a, `/classes/${k.classId}/certificates`, issueBody([s.enrollmentId], ENDED))).items as View[])[0]!;
    expect(fresh).toMatchObject({ code: 'CC-2026-0002', reissueNo: 0, replacesId: null });
  });
});

describe('S14 — sổ', () => {
  it('lọc năm, q (số và tên), lớp, học viên, trạng thái, ids; phân trang; years; mã của tổ chức khác → rỗng', async () => {
    const a = await academy('so-sach');
    const k1 = await klass(a, { endDate: ENDED });
    const k2 = await klass(a, { endDate: '2025-12-30' });
    const x = await enroll(a, k1.classId, 'Trần Mai');
    const y = await enroll(a, k1.classId, 'Lê Cúc');
    const z = await enroll(a, k2.classId, 'Phạm Đào');
    const i1 = (await postOk(a, `/classes/${k1.classId}/certificates`, issueBody([x.enrollmentId, y.enrollmentId], ENDED))).items as View[];
    const i2 = (await postOk(a, `/classes/${k2.classId}/certificates`, issueBody([z.enrollmentId], '2025-12-31'))).items as View[];
    await request(app).post(api(a.orgId, `/certificates/${i1[1]!.id}/revoke`)).set(bearer(a.owner)).send({ reason: 'Nhầm' }).expect(200);
    const list = async (qs: string) => {
      const r = await request(app).get(api(a.orgId, `/certificates${qs}`)).set(bearer(a.owner));
      return r;
    };
    const all = await list('');
    expect(all.status).toBe(200);
    expect((all.body.items as View[]).map((v) => v.code)).toEqual(['CC-2026-0002', 'CC-2026-0001', 'CC-2025-0001']);
    expect(all.body).toMatchObject({ total: 3, page: 1, pageSize: 50, years: [2026, 2025] });
    expect((await list('?year=2025')).body.items.map((v: View) => v.code)).toEqual(['CC-2025-0001']);
    expect((await list('?q=cc-2026-0001')).body.items.map((v: View) => v.studentName)).toEqual(['Trần Mai']);
    expect((await list('?q=trần')).body.items.map((v: View) => v.code)).toEqual(['CC-2026-0001']);
    expect((await list(`?classId=${k2.classId}`)).body.items.map((v: View) => v.code)).toEqual(['CC-2025-0001']);
    expect((await list(`?customerId=${y.customerId}`)).body.items.map((v: View) => v.status)).toEqual(['REVOKED']);
    expect((await list('?status=ISSUED')).body.total).toBe(2);
    expect((await list(`?ids=${i1[0]!.id},${i2[0]!.id}`)).body.items.map((v: View) => v.code)).toEqual(['CC-2026-0001', 'CC-2025-0001']);
    const page2 = await list('?pageSize=1&page=2');
    expect(page2.body).toMatchObject({ total: 3, page: 2, pageSize: 1 });
    expect(page2.body.items.map((v: View) => v.code)).toEqual(['CC-2026-0001']);
    const tooMany = await list(`?ids=${Array.from({ length: 51 }, () => randomUUID()).join(',')}`);
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.details.issues[0].path).toBe('ids');
    expect((await list('?ids=khong-phai-uuid')).status).toBe(400);
    // Mã lớp / học viên / giấy của tổ chức khác: rỗng, giống mã bịa.
    const b = await academy('so-sach-b');
    const kb = await klass(b, { endDate: ENDED });
    const sb = await enroll(b, kb.classId);
    const ib = (await postOk(b, `/classes/${kb.classId}/certificates`, issueBody([sb.enrollmentId], ENDED))).items as View[];
    for (const qs of [`?classId=${kb.classId}`, `?customerId=${sb.customerId}`, `?ids=${ib[0]!.id}`, `?classId=${randomUUID()}`]) {
      const r = await list(qs);
      expect(r.body).toMatchObject({ items: [], total: 0 });
    }
  });

  it('mã giấy / mã lớp của tổ chức khác → 404 GIỐNG HỆT mã bịa (đọc, cấp lại, thu hồi, danh sách lớp)', async () => {
    const a = await academy('cheo-a');
    const b = await academy('cheo-b');
    const kb = await klass(b, { endDate: ENDED });
    const sb = await enroll(b, kb.classId);
    const cb = ((await postOk(b, `/classes/${kb.classId}/certificates`, issueBody([sb.enrollmentId], ENDED))).items as View[])[0]!;
    const fake = randomUUID();
    const norm = (r: request.Response, id: string) => JSON.stringify([r.status, r.body.error.code, r.body.error.message, r.body.error.details]).split(id).join('<MÃ>');
    for (const [method, path, body] of [
      ['get', (id: string) => `/certificates/${id}`, undefined],
      ['post', (id: string) => `/certificates/${id}/reissue`, { reason: 'x' }],
      ['post', (id: string) => `/certificates/${id}/revoke`, { reason: 'x' }],
      ['get', (id: string) => `/classes/${id}/certificates`, undefined],
      ['post', (id: string) => `/classes/${id}/certificates`, issueBody([sb.enrollmentId], ENDED)],
    ] as const) {
      const call = (id: string) => {
        const r = request(app)[method](api(a.orgId, path(id))).set(bearer(a.owner)).set('idempotency-key', idem());
        return body ? r.send(body) : r;
      };
      const real = path(cb.id).includes('/classes/') ? kb.classId : cb.id;
      const rReal = await call(real);
      const rFake = await call(fake);
      expect(rReal.status).toBe(404);
      expect(norm(rReal, real)).toBe(norm(rFake, fake));
    }
    // Bản của B không đổi.
    expect((await db.certificate.findUniqueOrThrow({ where: { id: cb.id } })).status).toBe('ISSUED');
  });
});

describe('S15 — nhật ký trong cùng transaction', () => {
  it('cài lỗi ném giữa transaction (lần ghi nhật ký thứ hai): 0 giấy, 0 nhật ký, số không bị tiêu', async () => {
    const a = await academy('loi-giua');
    const k = await klass(a, { endDate: ENDED });
    const s = [await enroll(a, k.classId), await enroll(a, k.classId), await enroll(a, k.classId)];
    let n = 0;
    const broken = db.$extends({
      query: {
        auditLog: {
          create({ args, query }) {
            if ((args.data as { action?: string }).action === 'certificate.issued' && ++n === 2) throw new Error('Lỗi cài giữa transaction');
            return query(args);
          },
        },
      },
    }) as unknown as Db;
    const bad = createApp({ ...deps, db: broken });
    const res = await request(bad)
      .post(api(a.orgId, `/classes/${k.classId}/certificates`))
      .set(bearer(a.owner))
      .set('idempotency-key', idem())
      .send(issueBody(s.map((x) => x.enrollmentId), ENDED));
    expect(res.status).toBe(500);
    expect(n).toBe(2);
    expect(await db.certificate.count({ where: { organizationId: a.orgId } })).toBe(0);
    expect(await db.auditLog.count({ where: { organizationId: a.orgId, entityType: 'certificate' } })).toBe(0);
    const ok = await post(a, `/classes/${k.classId}/certificates`, issueBody(s.map((x) => x.enrollmentId), ENDED));
    expect((ok.body.items as View[]).map((v) => v.code)).toEqual(['CC-2026-0001', 'CC-2026-0002', 'CC-2026-0003']);
    expect(await db.auditLog.count({ where: { organizationId: a.orgId, action: 'certificate.issued' } })).toBe(3);
  });
});

describe('S16 — người ký', () => {
  it('chưa có hồ sơ → 409; có hồ sơ thì lưu; GET /profile không có certSigner*; PUT /profile không xoá người ký', async () => {
    const a = await academy('nguoi-ky');
    const put = (body: object) => request(app).put(api(a.orgId, '/profile/certificate')).set(bearer(a.owner)).send(body);
    const none = await request(app).get(api(a.orgId, '/profile/certificate')).set(bearer(a.owner)).expect(200);
    expect(none.body).toEqual({ hasProfile: false, signerName: null, signerTitle: null, defaultTitle: 'Giám đốc trung tâm' });
    const early = await put({ signerName: 'Bà Hạnh', signerTitle: null });
    expect(early.status).toBe(409);
    expect(early.body.error).toMatchObject({ message: 'Lưu Hồ sơ thương hiệu (tên thương hiệu) trước', details: { reason: 'PROFILE_REQUIRED' } });
    expect((await put({})).status).toBe(400);
    expect((await put({ signerName: 'Bà Hạnh' })).status).toBe(400);
    expect((await put({ signerName: '  ', signerTitle: null })).status).toBe(400);
    await request(app).put(api(a.orgId, '/profile')).set(bearer(a.owner)).send({ brandName: 'Học viện Hạnh' }).expect(200);
    const saved = await put({ signerName: ' Bà Hạnh ', signerTitle: 'Giám đốc học thuật' });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ hasProfile: true, signerName: 'Bà Hạnh', signerTitle: 'Giám đốc học thuật', defaultTitle: 'Giám đốc trung tâm' });
    const prof = await request(app).get(api(a.orgId, '/profile')).set(bearer(a.owner)).expect(200);
    expect(Object.keys(prof.body.profile).filter((x) => x.startsWith('certSigner'))).toEqual([]);
    await request(app).put(api(a.orgId, '/profile')).set(bearer(a.owner)).send({ brandName: 'Học viện Hạnh 2' }).expect(200);
    const kept = await request(app).get(api(a.orgId, '/profile/certificate')).set(bearer(a.owner)).expect(200);
    expect(kept.body).toMatchObject({ signerName: 'Bà Hạnh', signerTitle: 'Giám đốc học thuật' });
    const log = await db.auditLog.findFirst({ where: { organizationId: a.orgId, action: 'profile.certificate_signer_updated' } });
    expect(log?.data).toEqual({ before: { signerName: null, signerTitle: null }, after: { signerName: 'Bà Hạnh', signerTitle: 'Giám đốc học thuật' } });
    const k = await klass(a, { endDate: ENDED });
    const s = await enroll(a, k.classId);
    const c = ((await postOk(a, `/classes/${k.classId}/certificates`, issueBody([s.enrollmentId], ENDED))).items as View[])[0]!;
    expect(c).toMatchObject({ signerName: 'Bà Hạnh', signerTitle: 'Giám đốc học thuật', brandName: 'Học viện Hạnh 2' });
  });
});

describe('S17, S18 — thân sai', () => {
  it('mẫu cc-99 / shd-01 → 400 templateCode; phông ngoài ky-1..4 → 400; enrollmentIds rỗng / trùng / 501 → 400', async () => {
    const a = await academy('than-sai');
    const k = await klass(a, { endDate: ENDED });
    const s = await enroll(a, k.classId);
    const send = (body: object) => post(a, `/classes/${k.classId}/certificates`, body);
    for (const templateCode of ['cc-99', 'shd-01', 'toString']) {
      const r = await send({ ...issueBody([s.enrollmentId], ENDED), templateCode });
      expect(r.status).toBe(400);
      expect(r.body.error.details.issues.map((i: { path: string }) => i.path)).toEqual(['templateCode']);
    }
    const font = await send(issueBody([s.enrollmentId], ENDED, { fontOverride: 'ky-5' }));
    expect(font.status).toBe(400);
    expect(font.body.error.details.issues[0].path).toBe('fontOverride');
    const empty = await send(issueBody([], ENDED));
    expect(empty.status).toBe(400);
    const dup = await send(issueBody([s.enrollmentId, s.enrollmentId], ENDED));
    expect(dup.status).toBe(400);
    expect(dup.body.error.details.issues[0].message).toBe('Học viên bị chọn trùng');
    const big = await send(issueBody(Array.from({ length: 501 }, () => randomUUID()), ENDED));
    expect(big.status).toBe(400);
    expect((await send({})).status).toBe(400);
    const reissueBad = await post(a, `/certificates/${randomUUID()}/reissue`, { reason: 'x', templateCode: 'cc-99' });
    expect(reissueBad.status).toBe(400);
    expect(await db.certificate.count({ where: { organizationId: a.orgId } })).toBe(0);
  });
});
