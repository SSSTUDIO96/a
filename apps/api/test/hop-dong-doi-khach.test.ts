// PATCH HỢP ĐỒNG NHÁP NHẬN customerId (phiếu vướng của thợ web T): đổi khách khi còn nháp.
//  - khách thuộc tổ chức → 200, phản hồi + database mang khách mới, nhật ký contract.updated ghi trước → sau;
//  - mã của tổ chức khác → 404 GIỐNG HỆT mã bịa (không lộ tổ chức kia có khách này), không ghi gì;
//  - hợp đồng đã xác nhận → 409 (lệnh trên còn trường khác cũng 409), khách không đổi;
//  - bắt buộc expectedUpdatedAt (thợ S3): thiếu → 400, bản cũ → 409 STALE_VERSION;
//  - gửi lại đúng khách hiện tại: 200, không đổi;
//  - đã có lịch (chưa huỷ) hoặc thẻ thiết kế (chưa xoá) chép khách cũ → 409 CUSTOMER_IN_USE (quyết định của thợ U).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;
let owner: TestUser;
let ownerB: TestUser;
let orgA: string;
let orgB: string;
let cust1: string;
let cust2: string;
let custB: string;

afterAll(async () => {
  await db.$disconnect();
});

const api = (orgId: string, p: string) => `/api/v1/orgs/${orgId}${p}`;

async function newCustomer(u: TestUser, orgId: string, fullName: string): Promise<string> {
  const r = await request(app).post(api(orgId, '/customers')).set(bearer(u)).set('idempotency-key', randomUUID()).send({ fullName });
  expect(r.status).toBe(201);
  return r.body.id as string;
}

async function newContract(customerId: string): Promise<{ id: string; updatedAt: string }> {
  const r = await request(app)
    .post(api(orgA, '/contracts'))
    .set(bearer(owner))
    .set('idempotency-key', randomUUID())
    .send({ customerId, lines: [{ kind: 'CUSTOM', name: 'Makeup thử', unitPrice: 500_000, quantity: 1 }] });
  expect(r.status).toBe(201);
  return { id: r.body.id, updatedAt: r.body.updatedAt };
}

const version = async (id: string) => (await request(app).get(api(orgA, `/contracts/${id}`)).set(bearer(owner)).expect(200)).body.updatedAt as string;
const patch = (id: string, body: object) => request(app).patch(api(orgA, `/contracts/${id}`)).set(bearer(owner)).send(body);
const customerOf = async (id: string) => (await db.contract.findUniqueOrThrow({ where: { id } })).customerId;
const audits = (id: string) => db.auditLog.findMany({ where: { entityId: id, action: 'contract.updated' }, orderBy: { createdAt: 'asc' } });

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'dk-chu-a');
  orgA = await createOrg(app, owner, 'dk-a');
  ownerB = await registerUser(app, 'dk-chu-b');
  orgB = await createOrg(app, ownerB, 'dk-b');
  cust1 = await newCustomer(owner, orgA, 'Khách Một');
  cust2 = await newCustomer(owner, orgA, 'Khách Hai');
  custB = await newCustomer(ownerB, orgB, 'Khách của B');
});

describe('PATCH hợp đồng nháp: đổi khách (customerId)', () => {
  it('nháp + khách cùng tổ chức → 200; phản hồi, database và nhật ký (trước → sau) đều mang khách mới', async () => {
    const c = await newContract(cust1);
    const r = await patch(c.id, { expectedUpdatedAt: c.updatedAt, customerId: cust2 });
    expect(r.status).toBe(200);
    expect(r.body.customer).toMatchObject({ id: cust2, fullName: 'Khách Hai' });
    expect(r.body.updatedAt).not.toBe(c.updatedAt);
    expect(await customerOf(c.id)).toBe(cust2);
    const log = await audits(c.id);
    expect(log).toHaveLength(1);
    const data = log[0]!.data as { before: { customerId: string }; after: { customerId?: string } };
    expect([data.before.customerId, data.after.customerId]).toEqual([cust1, cust2]);
    // Tiền và dòng không bị đụng.
    expect([r.body.total, r.body.lines.length]).toEqual([500_000, 1]);
  });

  it('mã khách của tổ chức khác → 404 GIỐNG HỆT mã bịa; khách, phiên bản, nhật ký không đổi', async () => {
    const c = await newContract(cust1);
    const other = await patch(c.id, { expectedUpdatedAt: c.updatedAt, customerId: custB });
    const fake = await patch(c.id, { expectedUpdatedAt: c.updatedAt, customerId: randomUUID() });
    expect([other.status, fake.status]).toEqual([404, 404]);
    const norm = (b: unknown) => JSON.stringify(b).replace(/"requestId":"[^"]+"/, '');
    expect(norm(other.body)).toBe(norm(fake.body));
    expect(other.body.error.message).toBe('Không tìm thấy khách hàng');
    expect(JSON.stringify(other.body)).not.toContain(custB);
    expect(await customerOf(c.id)).toBe(cust1);
    expect(await version(c.id)).toBe(c.updatedAt);
    expect(await audits(c.id)).toHaveLength(0);
  });

  it('hợp đồng đã xác nhận → 409 (kể cả gửi kèm ghi chú); khách không đổi', async () => {
    const c = await newContract(cust1);
    await request(app).post(api(orgA, `/contracts/${c.id}/status`)).set(bearer(owner)).send({ to: 'CONFIRMED' }).expect(200);
    const v = await version(c.id);
    const r = await patch(c.id, { expectedUpdatedAt: v, customerId: cust2 });
    expect(r.status).toBe(409);
    expect(r.body.error.details.fields).toEqual(['customerId']);
    const withNote = await patch(c.id, { expectedUpdatedAt: v, customerId: cust2, notes: 'đổi khách' });
    expect(withNote.status).toBe(409);
    expect(await customerOf(c.id)).toBe(cust1);
    // Ghi chú một mình vẫn sửa được sau xác nhận (luật cũ giữ nguyên).
    expect((await patch(c.id, { expectedUpdatedAt: v, notes: 'chỉ ghi chú' })).status).toBe(200);
  });

  it('bắt buộc expectedUpdatedAt: thiếu → 400; bản cũ → 409 STALE_VERSION, khách không đổi', async () => {
    const c = await newContract(cust1);
    expect((await patch(c.id, { customerId: cust2 })).status).toBe(400);
    await patch(c.id, { expectedUpdatedAt: c.updatedAt, notes: 'người khác vừa sửa' }).expect(200);
    const stale = await patch(c.id, { expectedUpdatedAt: c.updatedAt, customerId: cust2 });
    expect([stale.status, stale.body.error.details.reason]).toEqual([409, 'STALE_VERSION']);
    expect(await customerOf(c.id)).toBe(cust1);
  });

  it('customerId không phải uuid → 400 đúng trường', async () => {
    const c = await newContract(cust1);
    const r = await patch(c.id, { expectedUpdatedAt: c.updatedAt, customerId: 'khong-phai-uuid' });
    expect(r.status).toBe(400);
    expect(r.body.error.details.issues.map((i: { path: string }) => i.path)).toContain('customerId');
  });

  it('gửi lại đúng khách hiện tại → 200, khách giữ nguyên, nhật ký không ghi "sau" đổi khách', async () => {
    const c = await newContract(cust1);
    const r = await patch(c.id, { expectedUpdatedAt: c.updatedAt, customerId: cust1 });
    expect(r.status).toBe(200);
    expect(r.body.customer.id).toBe(cust1);
    const data = (await audits(c.id))[0]!.data as { after: { customerId?: string } };
    expect(data.after.customerId).toBeUndefined();
  });

  it('đã có lịch gắn hợp đồng (chưa huỷ) → 409 CUSTOMER_IN_USE; huỷ lịch rồi đổi được', async () => {
    const c = await newContract(cust1);
    const appt = await request(app)
      .post(api(orgA, '/appointments'))
      .set(bearer(owner))
      .set('idempotency-key', randomUUID())
      .send({ customerId: cust1, contractId: c.id, startsAt: '2027-05-01T01:00:00.000Z', endsAt: '2027-05-01T02:00:00.000Z', status: 'DRAFT', staff: [] });
    expect(appt.status).toBe(201);
    const v = await version(c.id);
    const r = await patch(c.id, { expectedUpdatedAt: v, customerId: cust2 });
    expect(r.status).toBe(409);
    expect(r.body.error.details).toMatchObject({ reason: 'CUSTOMER_IN_USE', appointments: 1, designCards: 0 });
    expect(await customerOf(c.id)).toBe(cust1);
    await request(app)
      .post(api(orgA, `/appointments/${appt.body.id}/status`))
      .set(bearer(owner))
      .send({ to: 'CANCELLED', reason: 'Đổi khách' })
      .expect(200);
    const ok = await patch(c.id, { expectedUpdatedAt: await version(c.id), customerId: cust2 });
    expect(ok.status).toBe(200);
    expect(await customerOf(c.id)).toBe(cust2);
  });

  it('đã có thẻ thiết kế (chưa xoá) chép khách cũ → 409 CUSTOMER_IN_USE; thẻ đã xoá không chặn', async () => {
    const c = await newContract(cust1);
    const card = await db.designCard.create({
      data: {
        organizationId: orgA,
        kind: 'FEEDBACK',
        templateCode: 'fb-01',
        templateVersion: 1,
        contractId: c.id,
        customerId: cust1,
        body: 'Lời khen mẫu',
        size: '1080x1350',
        snapshot: {},
        createdById: owner.id,
      },
    });
    const r = await patch(c.id, { expectedUpdatedAt: c.updatedAt, customerId: cust2 });
    expect([r.status, r.body.error.details.reason, r.body.error.details.designCards]).toEqual([409, 'CUSTOMER_IN_USE', 1]);
    await db.designCard.update({ where: { id: card.id }, data: { deletedAt: new Date() } });
    expect((await patch(c.id, { expectedUpdatedAt: c.updatedAt, customerId: cust2 })).status).toBe(200);
  });

  it('người của tổ chức B gọi vào hợp đồng của A → 404 (cách ly giữ nguyên)', async () => {
    const c = await newContract(cust1);
    const r = await request(app).patch(api(orgB, `/contracts/${c.id}`)).set(bearer(ownerB)).send({ expectedUpdatedAt: c.updatedAt, customerId: custB });
    expect(r.status).toBe(404);
    expect(await customerOf(c.id)).toBe(cust1);
  });
});
