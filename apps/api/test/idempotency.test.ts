// Chống gửi trùng: cùng khoá chỉ là "gửi lại" khi cùng ĐƯỜNG DẪN THẬT và cùng nội dung.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let owner: TestUser;
let orgId: string;

async function newContract(): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/orgs/${orgId}/contracts`)
    .set(bearer(owner))
    .set('idempotency-key', `hd-${Math.random().toString(36).slice(2, 12)}`)
    .send({ newCustomer: { fullName: 'Khách thử' }, lines: [{ kind: 'CUSTOM', name: 'Phụ phí', unitPrice: 100000, quantity: 1 }] });
  if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'idem');
  orgId = await createOrg(app, owner, 'idem');
});
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('chống gửi trùng', () => {
  it('T1 — BẮT: cùng khoá + cùng nội dung nhưng vào hợp đồng KHÁC → 409, không báo thành công giả', async () => {
    const a = await newContract();
    const b = await newContract();
    const body = { kind: 'CUSTOM', name: 'Phát sinh', unitPrice: 50000, quantity: 1 };
    await request(app).post(`/api/v1/orgs/${orgId}/contracts/${a}/lines`).set(bearer(owner)).set('idempotency-key', 'khoa-chung-001').send(body).expect(201);
    const res = await request(app).post(`/api/v1/orgs/${orgId}/contracts/${b}/lines`).set(bearer(owner)).set('idempotency-key', 'khoa-chung-001').send(body);
    expect(res.status).toBe(409);
    const linesB = await deps.db.contractLine.count({ where: { contractId: b } });
    expect(linesB).toBe(1);
  });

  it('GIỮ: gửi lại đúng đường + đúng nội dung → cùng kết quả, chỉ một dòng được ghi', async () => {
    const a = await newContract();
    const body = { kind: 'CUSTOM', name: 'Phát sinh', unitPrice: 50000, quantity: 1 };
    const r1 = await request(app).post(`/api/v1/orgs/${orgId}/contracts/${a}/lines`).set(bearer(owner)).set('idempotency-key', 'khoa-gui-lai-01').send(body);
    const r2 = await request(app).post(`/api/v1/orgs/${orgId}/contracts/${a}/lines`).set(bearer(owner)).set('idempotency-key', 'khoa-gui-lai-01').send(body);
    expect(r2.status).toBe(r1.status);
    expect(r2.body).toEqual(r1.body);
    expect(await deps.db.contractLine.count({ where: { contractId: a } })).toBe(2);
  });

  it('khoá "đang xử lý" kẹt quá 2 phút (máy chủ chết giữa chừng) → được lấy lại, không 409 mãi', async () => {
    const a = await newContract();
    const userId = owner.id;
    await deps.db.idempotencyKey.create({
      data: {
        organizationId: orgId,
        userId,
        key: 'khoa-ket-0001',
        routeKey: `POST /api/v1/orgs/${orgId}/contracts/${a}/lines`,
        requestHash: 'x',
        responseStatus: 0,
        responseBody: {},
        createdAt: new Date(Date.now() - 5 * 60_000),
      },
    });
    // Nội dung khác hash 'x' → vẫn phải là 409 "khoá dùng cho yêu cầu khác", không được lấy lại.
    const body = { kind: 'CUSTOM', name: 'Phát sinh', unitPrice: 50000, quantity: 1 };
    const res = await request(app).post(`/api/v1/orgs/${orgId}/contracts/${a}/lines`).set(bearer(owner)).set('idempotency-key', 'khoa-ket-0001').send(body);
    expect(res.status).toBe(409);
    // Dòng kẹt đúng nội dung → lấy lại được.
    const { createHash } = await import('node:crypto');
    await deps.db.idempotencyKey.create({
      data: {
        organizationId: orgId,
        userId,
        key: 'khoa-ket-0002',
        routeKey: `POST /api/v1/orgs/${orgId}/contracts/${a}/lines`,
        requestHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
        responseStatus: 0,
        responseBody: {},
        createdAt: new Date(Date.now() - 5 * 60_000),
      },
    });
    const ok = await request(app).post(`/api/v1/orgs/${orgId}/contracts/${a}/lines`).set(bearer(owner)).set('idempotency-key', 'khoa-ket-0002').send(body);
    expect(ok.status).toBe(201);
  });
});
