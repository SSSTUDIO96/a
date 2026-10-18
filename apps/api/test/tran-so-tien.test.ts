// MỘT trần cho mọi số tiền nhập tay (thợ chấm web 2, T6): bảng giá, phí di chuyển, tiền công theo bậc dùng CHUNG hằng với
// phiếu thu (lib/money.ts MAX_MONEY_VND = 100 tỷ đ). Biên: đúng trần qua; trần + 1 → 400 ở đúng trường, lời "Số tiền quá lớn (tối đa …)".
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MAX_MONEY_VND } from '../src/lib/money';
import { MAX_PAYMENT_AMOUNT } from '../src/modules/payments/schemas';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let owner: TestUser;
let orgId: string;
const CAP = 100_000_000_000;
const url = (p: string) => `/api/v1/orgs/${orgId}${p}`;
const idem = () => ({ 'idempotency-key': randomUUID() });
const code = () => `T${randomUUID().slice(0, 6).toUpperCase()}`;

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'tran-tien');
  orgId = await createOrg(app, owner, 'tran-tien');
});
afterAll(async () => {
  await deps.db.$disconnect();
});

// Lỗi phải nằm ĐÚNG trường và nói rõ trần.
function expectTooLarge(res: request.Response, path: string) {
  expect(res.status, JSON.stringify(res.body)).toBe(400);
  const issue = (res.body.error.details.issues as { path: string; message: string }[]).find((i) => i.path === path);
  expect(issue?.message, JSON.stringify(res.body.error.details.issues)).toBe('Số tiền quá lớn (tối đa 100.000.000.000 đ)');
}

describe('trần số tiền dùng chung', () => {
  it('một hằng duy nhất: thu tiền và bảng giá cùng 100 tỷ', () => {
    expect(MAX_MONEY_VND).toBe(CAP);
    expect(MAX_PAYMENT_AMOUNT).toBe(MAX_MONEY_VND);
  });

  it('dịch vụ: listPrice / salePrice — đúng trần qua, trần + 1 chặn', async () => {
    const ok = await request(app).post(url('/services')).set(bearer(owner)).set(idem()).send({ code: code(), name: 'Đúng trần', durationMinutes: 60, listPrice: CAP, salePrice: CAP });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expectTooLarge(await request(app).post(url('/services')).set(bearer(owner)).set(idem()).send({ code: code(), name: 'Vượt', durationMinutes: 60, listPrice: CAP + 1 }), 'listPrice');
    expectTooLarge(await request(app).post(url('/services')).set(bearer(owner)).set(idem()).send({ code: code(), name: 'Vượt', durationMinutes: 60, listPrice: 1, salePrice: CAP + 1 }), 'salePrice');
    // Giá 900 nghìn tỷ (tái hiện T6) → 400.
    expectTooLarge(await request(app).post(url(`/services/${ok.body.id}/prices`)).set(bearer(owner)).set(idem()).send({ listPrice: 900_000_000_000_000 }), 'listPrice');
    await request(app).post(url(`/services/${ok.body.id}/prices`)).set(bearer(owner)).set(idem()).send({ listPrice: CAP }).expect(201);
  });

  it('gói: listPrice / depositAmount', async () => {
    const ok = await request(app).post(url('/packages')).set(bearer(owner)).set(idem()).send({ code: code(), name: 'Gói trần', durationMinutes: 60, listPrice: CAP, depositAmount: CAP });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expectTooLarge(await request(app).post(url('/packages')).set(bearer(owner)).set(idem()).send({ code: code(), name: 'Gói vượt', durationMinutes: 60, listPrice: CAP + 1 }), 'listPrice');
    expectTooLarge(await request(app).patch(url(`/packages/${ok.body.id}`)).set(bearer(owner)).send({ depositAmount: CAP + 1 }), 'depositAmount');
  });

  it('phí di chuyển: các mức tiền và tiền của bậc km', async () => {
    const base = { defaultMode: 'TIERED', fixedAmount: CAP, perKmAmount: CAP, freeKm: 0, minimumAmount: CAP, roundTrip: false, tiers: [{ fromKm: 0, toKm: null, amount: CAP }] };
    const ok = await request(app).put(url('/travel-fee-policy')).set(bearer(owner)).send(base);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expectTooLarge(await request(app).put(url('/travel-fee-policy')).set(bearer(owner)).send({ ...base, fixedAmount: CAP + 1 }), 'fixedAmount');
    expectTooLarge(await request(app).put(url('/travel-fee-policy')).set(bearer(owner)).send({ ...base, tiers: [{ fromKm: 0, toKm: null, amount: CAP + 1 }] }), 'tiers.0.amount');
  });

  it('tiền công theo bậc (pay-rates): đúng trần qua, trần + 1 chặn', async () => {
    const tier = await request(app).post(url('/staff-tiers')).set(bearer(owner)).set(idem()).send({ name: `Bậc ${code()}` }).expect(201);
    const svc = await request(app).post(url('/services')).set(bearer(owner)).set(idem()).send({ code: code(), name: 'DV công', durationMinutes: 60, listPrice: 1000 }).expect(201);
    const put = (amount: number) => request(app).put(url(`/services/${svc.body.id}/pay-rates`)).set(bearer(owner)).send({ rates: [{ tierId: tier.body.id, amount }] });
    expect((await put(CAP)).status).toBe(200);
    expectTooLarge(await put(CAP + 1), 'rates.0.amount');
  });
});
