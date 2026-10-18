// Ảnh đại diện thợ = cột avatar_file_id (khoá ngoại kép tới tệp cùng tổ chức), không còn chuỗi tạm "file:<id>".
// Phủ: khoá ngoại kép ở database, mọi cửa trả ảnh (danh sách thợ, hợp đồng xem trước/tạo/xem lại) trả URL ký có hạn
// của ĐÚNG tệp, ảnh https nhập tay cũ trả nguyên văn, chuỗi "file:" sót lại không bao giờ lộ ra.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { getStorage, LocalDiskDriver, verifyToken } from '../src/lib/storage';
import { makePng } from './png';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let ownerA: TestUser;
let ownerB: TestUser;
let orgA: string;
let orgB: string;
let mFile: string;
let mFile2: string;
let mHttps: string;
let mLeftover: string;
let avatarA: string;
let avatarA2: string;
let avatarB: string;

const LEGACY_HTTPS = 'https://cdn.example.vn/anh-cu.jpg';
const SIGNED = /\/api\/v1\/files\/raw\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

async function upload(orgId: string, owner: TestUser): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/orgs/${orgId}/files`)
    .query({ purpose: 'STAFF_AVATAR', name: 'anh.png' })
    .set(bearer(owner))
    .set('Idempotency-Key', randomUUID())
    .set('Content-Type', 'application/octet-stream')
    .send(makePng());
  if (res.status !== 201) throw new Error(`Tải ảnh thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

// URL ký phải là vé của ĐÚNG tệp: giải vé bằng khoá ký của kho tệp → storageKey (vé đã mã hoá từ khi sửa N3 lát 2,
// không đọc thô base64 được nữa).
function signedKeyOf(url: string): string {
  const s = getStorage();
  if (!(s instanceof LocalDiskDriver)) throw new Error('Bài thử cần driver đĩa cục bộ');
  const check = verifyToken(s.signingSecret, url.split('/').pop() ?? '');
  return check.ok ? check.key : `vé hỏng: ${check.reason}`;
}

async function storageKeyOf(fileId: string) {
  return (await deps.db.storedFile.findUniqueOrThrow({ where: { id: fileId } })).storageKey;
}

beforeAll(async () => {
  app = makeApp(deps);
  ownerA = await registerUser(app, 'chu-anh-a');
  ownerB = await registerUser(app, 'chu-anh-b');
  orgA = await createOrg(app, ownerA, 'anh-a');
  orgB = await createOrg(app, ownerB, 'anh-b');
  mFile = await addMember(app, ownerA, orgA, await registerUser(app, 'tho-anh-tep'), ['artist']);
  mFile2 = await addMember(app, ownerA, orgA, await registerUser(app, 'tho-anh-tep-2'), ['artist']);
  mHttps = await addMember(app, ownerA, orgA, await registerUser(app, 'tho-anh-https'), ['artist']);
  mLeftover = await addMember(app, ownerA, orgA, await registerUser(app, 'tho-anh-sot'), ['artist']);
  avatarA = await upload(orgA, ownerA);
  avatarA2 = await upload(orgA, ownerA);
  avatarB = await upload(orgB, ownerB);
  const patch = await request(app).patch(`/api/v1/orgs/${orgA}/staff/${mFile}`).set(bearer(ownerA)).send({ avatarFileId: avatarA });
  expect(patch.status, JSON.stringify(patch.body)).toBe(200);
  // Thợ thứ hai, ảnh KHÁC: bắt lỗi ký nhầm tệp giữa các thợ trong cùng một danh sách.
  await request(app).patch(`/api/v1/orgs/${orgA}/staff/${mFile2}`).set(bearer(ownerA)).send({ avatarFileId: avatarA2 }).expect(200);
  // Dữ liệu cũ ghi thẳng: ảnh https nhập tay trước khi có module tệp; chuỗi "file:" do máy chủ bản cũ ghi lúc chuyển phiên bản.
  await deps.db.staffProfile.create({ data: { membershipId: mHttps, organizationId: orgA, avatarUrl: LEGACY_HTTPS } });
  await deps.db.staffProfile.create({ data: { membershipId: mLeftover, organizationId: orgA, avatarUrl: `file:${avatarA}` } });
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('cột avatar_file_id', () => {
  it('PATCH lưu vào avatarFileId (không còn chuỗi "file:" trong avatar_url)', async () => {
    const row = await deps.db.staffProfile.findUniqueOrThrow({ where: { membershipId: mFile } });
    expect(row.avatarFileId).toBe(avatarA);
    expect(row.avatarUrl).toBeNull();
  });

  it('BẮT (database): ghi thẳng bằng prisma ảnh của tổ chức khác → khoá ngoại kép chặn (P2003), dữ liệu không đổi', async () => {
    const err = await deps.db.staffProfile
      .update({ where: { membershipId: mFile }, data: { avatarFileId: avatarB } })
      .then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((err as Prisma.PrismaClientKnownRequestError).code).toBe('P2003');
    const created = await deps.db.staffProfile
      .create({ data: { membershipId: await addMember(app, ownerA, orgA, await registerUser(app, 'tho-anh-la'), ['artist']), organizationId: orgA, avatarFileId: avatarB } })
      .then(() => null, (e: unknown) => e);
    expect((created as Prisma.PrismaClientKnownRequestError).code).toBe('P2003');
    expect((await deps.db.staffProfile.findUniqueOrThrow({ where: { membershipId: mFile } })).avatarFileId).toBe(avatarA);
  });

  it('BẮT (database): không xoá cứng được tệp đang làm ảnh đại diện (Restrict)', async () => {
    const err = await deps.db.storedFile.delete({ where: { id: avatarA } }).then(() => null, (e: unknown) => e);
    expect((err as Prisma.PrismaClientKnownRequestError).code).toBe('P2003');
  });

  it('danh sách thợ: tệp → URL ký đúng tệp; https cũ → nguyên văn; "file:" sót lại → null', async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgA}/staff`).set(bearer(ownerA)).expect(200);
    const by = (id: string) => res.body.items.find((s: { membershipId: string }) => s.membershipId === id);
    expect(by(mFile).avatarUrl).toMatch(SIGNED);
    expect(signedKeyOf(by(mFile).avatarUrl)).toBe(await storageKeyOf(avatarA));
    expect(signedKeyOf(by(mFile2).avatarUrl)).toBe(await storageKeyOf(avatarA2));
    expect(by(mHttps).avatarUrl).toBe(LEGACY_HTTPS);
    expect(by(mLeftover).avatarUrl).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('file:');
  });

  it('PATCH avatarFileId: null bỏ cả ảnh https cũ', async () => {
    const m = await addMember(app, ownerA, orgA, await registerUser(app, 'tho-anh-bo'), ['artist']);
    await deps.db.staffProfile.create({ data: { membershipId: m, organizationId: orgA, avatarUrl: LEGACY_HTTPS } });
    const res = await request(app).patch(`/api/v1/orgs/${orgA}/staff/${m}`).set(bearer(ownerA)).send({ avatarFileId: null });
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBeNull();
    expect(await deps.db.staffProfile.findUniqueOrThrow({ where: { membershipId: m } })).toMatchObject({ avatarUrl: null, avatarFileId: null });
  });
});

describe('hợp đồng trả ảnh thợ qua URL ký có hạn', () => {
  let serviceId: string;
  let subjectId: string;
  let customerId: string;

  beforeAll(async () => {
    const svc = await deps.db.service.create({ data: { organizationId: orgA, code: `ANH-${randomUUID().slice(0, 6)}`, name: 'Makeup tiệc', kind: 'MAIN', durationMinutes: 60 } });
    await deps.db.priceVersion.create({
      data: { organizationId: orgA, serviceId: svc.id, listPrice: 500_000n, effectiveFrom: new Date(Date.now() - 60_000), createdById: ownerA.id },
    });
    serviceId = svc.id;
    subjectId = (await deps.db.makeupSubject.findFirstOrThrow({ where: { organizationId: orgA } })).id;
    customerId = (await deps.db.customer.create({ data: { organizationId: orgA, fullName: 'Khách ảnh', phone: '0912000111' } })).id;
  });

  const body = () => ({
    customerId,
    lines: [
      {
        kind: 'SERVICE',
        serviceId,
        subjectId,
        quantity: 1,
        locationType: 'STUDIO',
        scheduledStart: '2027-06-01T01:00:00Z',
        scheduledEnd: '2027-06-01T02:00:00Z',
        staff: [
          { membershipId: mFile, role: 'PRIMARY' },
          { membershipId: mFile2, role: 'ASSIST' },
          { membershipId: mHttps, role: 'ASSIST' },
          { membershipId: mLeftover, role: 'ASSIST' },
        ],
      },
    ],
  });

  async function expectStaffAvatars(label: string, payload: { lines: { staff: { membershipId: string; avatarUrl: string | null }[] }[] }) {
    const staff = payload.lines[0]!.staff;
    const by = (id: string) => staff.find((s) => s.membershipId === id)!;
    expect(by(mFile).avatarUrl, label).toMatch(SIGNED);
    expect(signedKeyOf(by(mFile).avatarUrl!), label).toBe(await storageKeyOf(avatarA));
    expect(signedKeyOf(by(mFile2).avatarUrl!), label).toBe(await storageKeyOf(avatarA2));
    expect(by(mHttps).avatarUrl, label).toBe(LEGACY_HTTPS);
    expect(by(mLeftover).avatarUrl, label).toBeNull();
    expect(JSON.stringify(payload), label).not.toContain('file:');
  }

  it('xem trước (quote), tạo, xem lại: thợ có ảnh tệp → URL ký đúng tệp, không có chuỗi "file:"', async () => {
    const quote = await request(app).post(`/api/v1/orgs/${orgA}/contracts/quote`).set(bearer(ownerA)).send(body());
    expect(quote.status, JSON.stringify(quote.body)).toBe(200);
    await expectStaffAvatars('quote', quote.body);

    const created = await request(app).post(`/api/v1/orgs/${orgA}/contracts`).set(bearer(ownerA)).set('idempotency-key', randomUUID()).send(body());
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    await expectStaffAvatars('tạo', created.body);

    const detail = await request(app).get(`/api/v1/orgs/${orgA}/contracts/${created.body.id}`).set(bearer(ownerA)).expect(200);
    await expectStaffAvatars('xem lại', detail.body);
  });
});

// K-c (biên bản đợt sửa 1): ảnh đại diện thợ trỏ tới tệp ĐÃ XOÁ không được hiện ở BẤT KỲ cửa nào trả ảnh thợ.
// Trước khi xoá, mọi cửa phải có URL ký (để chắc bài đo được); sau khi xoá: không cửa nào còn URL đọc tệp.
describe('K-c — tệp ảnh đại diện đã xoá → avatarUrl null ở mọi cửa', () => {
  it('danh sách thợ, sửa hồ sơ thợ, bảng tiền công, mức rảnh, xem trước hợp đồng, tạo/xem lịch', async () => {
    const owner = await registerUser(app, 'chu-anh-kc');
    const org = await createOrg(app, owner, 'anh-kc');
    const m = await addMember(app, owner, org, await registerUser(app, 'tho-anh-kc'), ['artist']);
    const fileId = await upload(org, owner);
    const tier = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(owner)).set('idempotency-key', randomUUID()).send({ name: 'Bậc KC' }).expect(201);
    await request(app).patch(`/api/v1/orgs/${org}/staff/${m}`).set(bearer(owner)).send({ avatarFileId: fileId, tierId: tier.body.id }).expect(200);
    const svc = await request(app)
      .post(`/api/v1/orgs/${org}/services`)
      .set(bearer(owner))
      .set('idempotency-key', randomUUID())
      .send({ code: `KC${randomUUID().slice(0, 4)}`, name: 'Makeup KC', durationMinutes: 60, listPrice: 500_000 })
      .expect(201);
    const subjectId = (await deps.db.makeupSubject.findFirstOrThrow({ where: { organizationId: org } })).id;
    const customerId = (await deps.db.customer.create({ data: { organizationId: org, fullName: 'Khách KC' } })).id;
    const appt = await request(app)
      .post(`/api/v1/orgs/${org}/appointments`)
      .set(bearer(owner))
      .set('idempotency-key', randomUUID())
      .send({ customerId, startsAt: '2027-07-01T01:00:00.000Z', endsAt: '2027-07-01T02:00:00.000Z', status: 'DRAFT', staff: [{ membershipId: m, role: 'PRIMARY' }] })
      .expect(201);
    const doors: [string, () => Promise<request.Response>][] = [
      ['danh sách thợ', () => request(app).get(`/api/v1/orgs/${org}/staff`).set(bearer(owner))],
      ['sửa hồ sơ thợ', () => request(app).patch(`/api/v1/orgs/${org}/staff/${m}`).set(bearer(owner)).send({ displayName: `Thợ KC ${randomUUID().slice(0, 4)}` })],
      ['bảng tiền công', () => request(app).get(`/api/v1/orgs/${org}/services/${svc.body.id}/pay-rates`).set(bearer(owner))],
      ['mức rảnh', () => request(app).get(`/api/v1/orgs/${org}/staff/availability`).query({ startsAt: '2027-07-02T01:00:00.000Z', endsAt: '2027-07-02T02:00:00.000Z', membershipIds: m }).set(bearer(owner))],
      [
        'xem trước hợp đồng',
        () =>
          request(app)
            .post(`/api/v1/orgs/${org}/contracts/quote`)
            .set(bearer(owner))
            .send({ customerId, lines: [{ kind: 'SERVICE', serviceId: svc.body.id, subjectId, quantity: 1, locationType: 'STUDIO', scheduledStart: '2027-07-03T01:00:00Z', scheduledEnd: '2027-07-03T02:00:00Z', staff: [{ membershipId: m, role: 'PRIMARY' }] }] }),
      ],
      ['xem lịch', () => request(app).get(`/api/v1/orgs/${org}/appointments/${appt.body.id}`).set(bearer(owner))],
    ];
    const hasSigned = (r: request.Response) => JSON.stringify(r.body).includes('/api/v1/files/raw/');
    const before: string[] = [];
    for (const [label, call] of doors) {
      const r = await call();
      expect(r.status, `${label}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
      if (hasSigned(r)) before.push(label);
    }
    await request(app).delete(`/api/v1/orgs/${org}/files/${fileId}`).set(bearer(owner)).expect(204);
    const after: string[] = [];
    for (const [label, call] of doors) {
      const r = await call();
      expect(r.status, label).toBe(200);
      if (hasSigned(r)) after.push(label);
    }
    console.log(`[K-c] cửa có ảnh trước khi xoá: ${before.length}/${doors.length}; sau khi xoá còn hiện: ${after.length}/${doors.length} ${after.join(', ')}`);
    expect(before.length).toBe(doors.length);
    expect(after).toEqual([]);
  });
});
