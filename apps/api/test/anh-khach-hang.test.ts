// Ảnh khách hàng: PATCH /orgs/:orgId/customers/:customerId nhận avatarFileId (uuid | null, tuỳ chọn — vắng mặt = giữ nguyên).
// GET danh sách / chi tiết trả avatarUrl ký có hạn qua resolveAvatarUrls (modules/files), một câu truy vấn cho cả danh sách.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getStorage, LocalDiskDriver, verifyToken } from '../src/lib/storage';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';
import { makePng } from './png';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

const SIGNED = /\/api\/v1\/files\/raw\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const INVALID = 'Ảnh khách không hợp lệ: cần tệp ảnh khách hàng đã tải xong của tổ chức';

let app: App;
let ownerA: TestUser;
let ownerB: TestUser;
let orgA: string;
let orgB: string;

async function upload(orgId: string, owner: TestUser, purpose = 'CUSTOMER_AVATAR'): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/orgs/${orgId}/files`)
    .query({ purpose, name: 'anh.png' })
    .set(bearer(owner))
    .set('Idempotency-Key', randomUUID())
    .set('Content-Type', 'application/octet-stream')
    .send(makePng());
  if (res.status !== 201) throw new Error(`Tải ảnh thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

async function newCustomer(name: string): Promise<string> {
  const r = await request(app).post(`/api/v1/orgs/${orgA}/customers`).set(bearer(ownerA)).set('Idempotency-Key', randomUUID()).send({ fullName: name, note: 'ghi chú gốc' });
  expect(r.status).toBe(201);
  expect(r.body).toMatchObject({ avatarFileId: null, avatarUrl: null });
  return r.body.id as string;
}

const patch = (id: string, body: object) => request(app).patch(`/api/v1/orgs/${orgA}/customers/${id}`).set(bearer(ownerA)).send(body);
const getOne = (id: string) => request(app).get(`/api/v1/orgs/${orgA}/customers/${id}`).set(bearer(ownerA));

// URL ký phải là vé của ĐÚNG tệp (giải vé bằng khoá ký của kho tệp → storageKey).
async function expectSignedFor(url: string | null, fileId: string) {
  expect(url).toMatch(SIGNED);
  const s = getStorage();
  if (!(s instanceof LocalDiskDriver)) throw new Error('Bài thử cần driver đĩa cục bộ');
  const check = verifyToken(s.signingSecret, url!.split('/').pop() ?? '');
  const key = (await deps.db.storedFile.findUniqueOrThrow({ where: { id: fileId } })).storageKey;
  expect(check.ok ? check.key : `vé hỏng: ${check.reason}`).toBe(key);
}

beforeAll(async () => {
  app = makeApp(deps);
  ownerA = await registerUser(app, 'anh-khach-a');
  ownerB = await registerUser(app, 'anh-khach-b');
  orgA = await createOrg(app, ownerA, 'anh-khach-a');
  orgB = await createOrg(app, ownerB, 'anh-khach-b');
});

describe('ảnh khách hàng', () => {
  it('gán ảnh → PATCH, GET chi tiết và GET danh sách đều trả avatarUrl ký đúng tệp; không lộ chuỗi "file:"', async () => {
    const id = await newCustomer('Khách có ảnh');
    const fileId = await upload(orgA, ownerA);
    const r = await patch(id, { avatarFileId: fileId });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.avatarFileId).toBe(fileId);
    await expectSignedFor(r.body.avatarUrl, fileId);
    const one = await getOne(id);
    await expectSignedFor(one.body.avatarUrl, fileId);
    const list = await request(app).get(`/api/v1/orgs/${orgA}/customers`).query({ q: 'Khách có ảnh' }).set(bearer(ownerA));
    expect(list.status).toBe(200);
    const row = list.body.items.find((x: { id: string }) => x.id === id);
    await expectSignedFor(row.avatarUrl, fileId);
    expect(JSON.stringify(list.body)).not.toContain('file:');
  });

  it('bỏ ảnh (null) → avatarUrl null; PATCH một trường khác KHÔNG đổi ảnh (vắng mặt = giữ nguyên)', async () => {
    const id = await newCustomer('Khách đổi ảnh');
    const fileId = await upload(orgA, ownerA);
    await patch(id, { avatarFileId: fileId }).expect(200);
    const other = await patch(id, { note: 'chỉ sửa ghi chú' });
    expect(other.status).toBe(200);
    expect(other.body.avatarFileId).toBe(fileId);
    await expectSignedFor(other.body.avatarUrl, fileId);
    expect(other.body).toMatchObject({ fullName: 'Khách đổi ảnh', note: 'chỉ sửa ghi chú' });
    const off = await patch(id, { avatarFileId: null });
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ avatarFileId: null, avatarUrl: null, note: 'chỉ sửa ghi chú' });
    expect((await deps.db.customer.findUniqueOrThrow({ where: { id } })).avatarFileId).toBeNull();
  });

  it('tệp của tổ chức khác, mã bịa, tệp sai mục đích, tệp đã xoá → 400 ở avatarFileId, CÙNG một lời; ảnh cũ giữ nguyên', async () => {
    const id = await newCustomer('Khách chặn ảnh');
    const keep = await upload(orgA, ownerA);
    await patch(id, { avatarFileId: keep }).expect(200);
    const foreign = await upload(orgB, ownerB);
    const wrongPurpose = await upload(orgA, ownerA, 'STAFF_AVATAR');
    const deleted = await upload(orgA, ownerA);
    await request(app).delete(`/api/v1/orgs/${orgA}/files/${deleted}`).set(bearer(ownerA)).expect(204);
    const fake = randomUUID();
    const norm = (r: request.Response, sent: string) => JSON.stringify(r.body.error).split(sent).join('<MÃ>').replace(/"requestId":"[^"]+"/, '');
    const results: [string, request.Response][] = [];
    for (const [label, fid] of [
      ['tổ chức khác', foreign],
      ['mã bịa', fake],
      ['sai mục đích', wrongPurpose],
      ['đã xoá', deleted],
    ] as const) {
      const r = await patch(id, { avatarFileId: fid });
      expect(r.status, label).toBe(400);
      expect(r.body.error.message, label).toBe(INVALID);
      expect(r.body.error.details.field, label).toBe('avatarFileId');
      results.push([fid, r]);
    }
    // Tệp thật của tổ chức khác và mã bịa: phản hồi giống hệt (sau khi che mã vừa gửi) — không lộ "tệp đó có tồn tại".
    expect(norm(results[0]![1], foreign)).toBe(norm(results[1]![1], fake));
    const after = await getOne(id);
    expect(after.body.avatarFileId).toBe(keep);
    await expectSignedFor(after.body.avatarUrl, keep);
  });

  it('tệp đang gắn bị xoá sau đó → GET chi tiết và danh sách trả avatarUrl null (không lỗi, không URL chết)', async () => {
    const id = await newCustomer('Khách ảnh bị xoá');
    const fileId = await upload(orgA, ownerA);
    await patch(id, { avatarFileId: fileId }).expect(200);
    await request(app).delete(`/api/v1/orgs/${orgA}/files/${fileId}`).set(bearer(ownerA)).expect(204);
    const one = await getOne(id);
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ avatarFileId: fileId, avatarUrl: null });
    const list = await request(app).get(`/api/v1/orgs/${orgA}/customers`).query({ q: 'Khách ảnh bị xoá' }).set(bearer(ownerA));
    expect(list.body.items.find((x: { id: string }) => x.id === id).avatarUrl).toBeNull();
  });

  it('danh sách nhiều khách có ảnh: MỘT câu truy vấn tệp cho cả trang (không N+1)', async () => {
    const tag = `Khách loạt ${randomUUID().slice(0, 6)}`;
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = await newCustomer(`${tag} ${i}`);
      await patch(id, { avatarFileId: await upload(orgA, ownerA) }).expect(200);
      ids.push(id);
    }
    const fileQueries = async () => {
      // Đếm số lần đọc bảng tệp: bọc findMany của storedFile trên đúng client mà app dùng.
      let n = 0;
      const orig = deps.db.storedFile.findMany.bind(deps.db.storedFile);
      (deps.db.storedFile as unknown as { findMany: typeof orig }).findMany = ((args: Parameters<typeof orig>[0]) => {
        n++;
        return orig(args);
      }) as typeof orig;
      try {
        const list = await request(app).get(`/api/v1/orgs/${orgA}/customers`).query({ q: tag }).set(bearer(ownerA));
        expect(list.status).toBe(200);
        expect(list.body.items).toHaveLength(4);
        for (const row of list.body.items) expect(row.avatarUrl).toMatch(SIGNED);
      } finally {
        (deps.db.storedFile as unknown as { findMany: typeof orig }).findMany = orig;
      }
      return n;
    };
    expect(await fileQueries()).toBe(1);
  });
});
