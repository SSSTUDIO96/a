// Phiếu vướng P2, P3 (màn Lịch): mọi cửa trả lịch có thêm
//  - subjectName: tên nhân vật makeup lấy từ dòng hợp đồng gắn với ca (ContractLine.subjectName); ca không gắn → null;
//  - staff[].displayName, staff[].avatarUrl: ảnh thợ là URL ký có hạn của ĐÚNG tệp, qua resolveAvatarUrls (modules/files),
//    một câu truy vấn tệp cho cả danh sách (không N+1).
// Cửa trả lịch phủ ở đây (5/5): GET danh sách, GET một lịch, POST tạo, PATCH sửa, POST đổi trạng thái.
// Đo N+1: PrismaClient bật log truy vấn (emit: 'event'), đếm số câu SQL của MỘT yêu cầu GET danh sách khi khoảng xem có
// 1 ca so với 50 ca (mỗi ca 2 thợ có ảnh tệp) — phải bằng nhau, và đúng 1 câu đọc bảng stored_files.
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { getStorage, LocalDiskDriver, verifyToken } from '../src/lib/storage';
import { makePng } from './png';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const base = makeDeps();
const db = new PrismaClient({ datasources: { db: { url: base.env.DATABASE_URL } }, log: [{ emit: 'event', level: 'query' }] });
const queries: string[] = [];
db.$on('query', (e) => queries.push(e.query));
const deps = { ...base, db };

let app: App;
let owner: TestUser;
let orgId: string;
let mA: string; // ảnh tệp A, có tên hiển thị riêng
let mB: string; // ảnh tệp B (khác A)
let mNone: string; // chưa có hồ sơ thợ: không ảnh, tên hiển thị = họ tên tài khoản
let artistNoneName: string;
let fileA: string;
let fileB: string;
let contractId: string;
let lineWithSubject: string;
let lineNoSubject: string;
let subjectName: string;

const SIGNED = /\/api\/v1\/files\/raw\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const DISPLAY_A = 'Bé Na Makeup';

function at(day: number, hhmm: string) {
  return new Date(`2032-05-${String(day).padStart(2, '0')}T${hhmm}:00+07:00`).toISOString();
}

// URL ký phải là vé của ĐÚNG tệp: giải vé bằng chính khoá ký của kho tệp (vé đã mã hoá, không đọc thô được) → storageKey.
function signedKeyOf(url: string): string {
  const s = getStorage();
  if (!(s instanceof LocalDiskDriver)) throw new Error('Bài thử cần driver đĩa cục bộ');
  const check = verifyToken(s.signingSecret, url.split('/').pop() ?? '');
  return check.ok ? check.key : `vé hỏng: ${check.reason}`;
}

async function storageKeyOf(fileId: string) {
  return (await db.storedFile.findUniqueOrThrow({ where: { id: fileId } })).storageKey;
}

async function upload(png: Buffer): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/orgs/${orgId}/files`)
    .query({ purpose: 'STAFF_AVATAR', name: 'anh.png' })
    .set(bearer(owner))
    .set('Idempotency-Key', randomUUID())
    .set('Content-Type', 'application/octet-stream')
    .send(png);
  if (res.status !== 201) throw new Error(`Tải ảnh thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

function postAppt(body: Record<string, unknown>) {
  return request(app).post(`/api/v1/orgs/${orgId}/appointments`).set(bearer(owner)).set('Idempotency-Key', randomUUID()).send(body);
}

const twoStaff = () => [
  { membershipId: mA, role: 'PRIMARY' },
  { membershipId: mB, role: 'ASSIST' },
];

interface StaffOut {
  membershipId: string;
  fullName: string;
  displayName: string;
  avatarUrl: string | null;
}

async function expectStaffAvatars(staff: StaffOut[]) {
  const by = (id: string) => staff.find((s) => s.membershipId === id);
  expect(by(mA)?.avatarUrl).toMatch(SIGNED);
  expect(signedKeyOf(by(mA)?.avatarUrl ?? '')).toBe(await storageKeyOf(fileA));
  expect(by(mB)?.avatarUrl).toMatch(SIGNED);
  expect(signedKeyOf(by(mB)?.avatarUrl ?? '')).toBe(await storageKeyOf(fileB));
  expect(by(mA)?.displayName).toBe(DISPLAY_A);
}

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'chu-lich-nv');
  orgId = await createOrg(app, owner, 'lich-nv');
  mA = await addMember(app, owner, orgId, await registerUser(app, 'tho-nv-a'), ['artist']);
  mB = await addMember(app, owner, orgId, await registerUser(app, 'tho-nv-b'), ['artist']);
  const none = await registerUser(app, 'tho-nv-khong-anh');
  artistNoneName = 'Người thử tho-nv-khong-anh';
  mNone = await addMember(app, owner, orgId, none, ['artist']);
  // Hai ảnh khác nội dung: tải URL về so mã băm phân biệt được tệp A với B.
  fileA = await upload(makePng(2, 3));
  fileB = await upload(makePng(4, 5));
  await request(app).patch(`/api/v1/orgs/${orgId}/staff/${mA}`).set(bearer(owner)).send({ avatarFileId: fileA }).expect(200);
  await request(app).patch(`/api/v1/orgs/${orgId}/staff/${mB}`).set(bearer(owner)).send({ avatarFileId: fileB }).expect(200);
  await db.staffProfile.update({ where: { membershipId: mA }, data: { displayName: DISPLAY_A } });

  const customer = await db.customer.create({ data: { organizationId: orgId, fullName: 'Khách nhân vật' } });
  const subject = await db.makeupSubject.findFirstOrThrow({ where: { organizationId: orgId } });
  subjectName = subject.name;
  const contract = await db.contract.create({
    data: { organizationId: orgId, code: `HD-${randomUUID().slice(0, 8)}`, customerId: customer.id, createdById: owner.id },
  });
  contractId = contract.id;
  const line = (extra: Record<string, unknown>) =>
    db.contractLine.create({
      data: { organizationId: orgId, contractId, kind: 'CUSTOM', name: 'Makeup', unitPrice: 0n, lineTotal: 0n, createdById: owner.id, ...extra },
    });
  lineWithSubject = (await line({ subjectId: subject.id, subjectName: subject.name })).id;
  lineNoSubject = (await line({})).id;
});

afterAll(async () => {
  await db.$disconnect();
  await base.db.$disconnect();
});

describe('subjectName của ca', () => {
  it('ca gắn dòng hợp đồng có nhân vật → subjectName đúng ở cả 5 cửa (tạo, xem, danh sách, sửa, đổi trạng thái); sửa và đổi trạng thái cũng trả ảnh ký', async () => {
    const created = await postAppt({
      startsAt: at(3, '08:00'),
      endsAt: at(3, '09:00'),
      contractId,
      contractLineId: lineWithSubject,
      staff: twoStaff(),
      status: 'DRAFT',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.subjectName).toBe(subjectName);
    const id = created.body.id as string;

    const one = await request(app).get(`/api/v1/orgs/${orgId}/appointments/${id}`).set(bearer(owner)).expect(200);
    expect(one.body.subjectName).toBe(subjectName);

    const list = await request(app)
      .get(`/api/v1/orgs/${orgId}/appointments`)
      .query({ from: at(3, '00:00'), to: at(3, '23:59') })
      .set(bearer(owner))
      .expect(200);
    expect(list.body.items.find((a: { id: string }) => a.id === id).subjectName).toBe(subjectName);

    const patched = await request(app).patch(`/api/v1/orgs/${orgId}/appointments/${id}`).set(bearer(owner)).send({ notes: 'đổi ghi chú' }).expect(200);
    expect(patched.body.subjectName).toBe(subjectName);
    await expectStaffAvatars(patched.body.staff);

    const status = await request(app).post(`/api/v1/orgs/${orgId}/appointments/${id}/status`).set(bearer(owner)).send({ to: 'PENDING_CONFIRMATION' });
    expect(status.status, JSON.stringify(status.body)).toBe(200);
    expect(status.body.subjectName).toBe(subjectName);
    await expectStaffAvatars(status.body.staff);
  });

  it('ca không gắn hợp đồng → null, KHÔNG đoán theo tên ca (dù tên ca chứa tên nhân vật)', async () => {
    const created = await postAppt({ startsAt: at(4, '08:00'), endsAt: at(4, '09:00'), title: subjectName, staff: [{ membershipId: mA }], status: 'DRAFT' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toHaveProperty('subjectName', null);
    const one = await request(app).get(`/api/v1/orgs/${orgId}/appointments/${created.body.id}`).set(bearer(owner)).expect(200);
    expect(one.body).toHaveProperty('subjectName', null);
  });

  it('ca gắn dòng hợp đồng chưa chọn nhân vật → null', async () => {
    const created = await postAppt({
      startsAt: at(5, '08:00'),
      endsAt: at(5, '09:00'),
      title: subjectName,
      contractId,
      contractLineId: lineNoSubject,
      status: 'DRAFT',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toHaveProperty('subjectName', null);
  });
});

describe('ảnh và tên hiển thị thợ trong ca', () => {
  it('thợ có ảnh tệp → URL ký đúng tệp của từng thợ; tên hiển thị theo hồ sơ thợ; thợ chưa có hồ sơ → avatarUrl null, displayName = họ tên', async () => {
    const created = await postAppt({
      startsAt: at(6, '08:00'),
      endsAt: at(6, '09:00'),
      staff: [...twoStaff(), { membershipId: mNone, role: 'ASSIST' }],
      status: 'DRAFT',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    await expectStaffAvatars(created.body.staff);
    const none = created.body.staff.find((s: StaffOut) => s.membershipId === mNone);
    expect(none).toMatchObject({ avatarUrl: null, displayName: artistNoneName, fullName: artistNoneName });
    expect(JSON.stringify(created.body)).not.toContain('file:');
    // URL ký mở được và phát ĐÚNG nội dung tệp của từng thợ.
    for (const [m, f] of [
      [mA, fileA],
      [mB, fileB],
    ] as const) {
      const url = created.body.staff.find((s: StaffOut) => s.membershipId === m).avatarUrl as string;
      const raw = await request(app).get(url).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(raw.status).toBe(200);
      expect(createHash('sha256').update(raw.body as Buffer).digest('hex')).toBe((await db.storedFile.findUniqueOrThrow({ where: { id: f } })).sha256);
    }

    const one = await request(app).get(`/api/v1/orgs/${orgId}/appointments/${created.body.id}`).set(bearer(owner)).expect(200);
    await expectStaffAvatars(one.body.staff);

    const list = await request(app)
      .get(`/api/v1/orgs/${orgId}/appointments`)
      .query({ from: at(6, '00:00'), to: at(6, '23:59') })
      .set(bearer(owner))
      .expect(200);
    await expectStaffAvatars(list.body.items.find((a: { id: string }) => a.id === created.body.id).staff);
  });
});

describe('danh sách lịch không N+1', () => {
  const ONE_DAY = 10;
  const MANY_DAY = 11;
  const MANY = 50;

  beforeAll(async () => {
    // Lịch nháp không chiếm giờ nên cùng thợ đặt chồng giờ được; mỗi ca 2 thợ có ảnh tệp + gắn dòng hợp đồng.
    const body = (day: number) => ({
      startsAt: at(day, '08:00'),
      endsAt: at(day, '09:00'),
      contractId,
      contractLineId: lineWithSubject,
      staff: twoStaff(),
      status: 'DRAFT',
    });
    expect((await postAppt(body(ONE_DAY))).status).toBe(201);
    for (let i = 0; i < MANY; i++) expect((await postAppt(body(MANY_DAY))).status).toBe(201);
  });

  async function measure(day: number) {
    queries.length = 0;
    const res = await request(app)
      .get(`/api/v1/orgs/${orgId}/appointments`)
      .query({ from: at(day, '00:00'), to: at(day, '23:59') })
      .set(bearer(owner))
      .expect(200);
    const sql = [...queries];
    return { items: res.body.items as { subjectName: string | null; staff: StaffOut[] }[], total: sql.length, files: sql.filter((q) => q.includes('"stored_files"')).length };
  }

  it(`số câu SQL của GET danh sách với 1 ca bằng với ${MANY} ca; đúng 1 câu đọc stored_files`, async () => {
    const one = await measure(ONE_DAY);
    const many = await measure(MANY_DAY);
    expect(one.items).toHaveLength(1);
    expect(many.items).toHaveLength(MANY);
    console.info(`[đo N+1] GET danh sách: 1 ca → ${one.total} câu SQL (${one.files} câu stored_files); ${MANY} ca → ${many.total} câu SQL (${many.files} câu stored_files)`);
    expect(many.total).toBe(one.total);
    expect(one.files).toBe(1);
    expect(many.files).toBe(1);
    // Kết quả vẫn đúng ở danh sách lớn.
    for (const a of many.items) {
      expect(a.subjectName).toBe(subjectName);
      await expectStaffAvatars(a.staff);
    }
  });
});
