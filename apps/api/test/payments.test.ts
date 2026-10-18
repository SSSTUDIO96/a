// Module THU TIỀN: tiến độ thanh toán, phiếu thu/hoàn, huỷ phiếu, sổ thu, báo cáo doanh thu, cách ly tổ chức, quyền.
// Hợp đồng dựng qua API với dòng CUSTOM cho nhanh.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;

afterAll(async () => {
  await deps.db.$disconnect();
});

const idem = () => `pt-${randomUUID()}`;
const DAY = 24 * 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

interface Org {
  orgId: string;
  owner: TestUser;
}

let A: Org;
let B: Org;
let accountant: TestUser;
let receptionist: TestUser;
let artist: TestUser;

async function newOrg(label: string): Promise<Org> {
  const owner = await registerUser(app, `tt-chu-${label}`);
  return { orgId: await createOrg(app, owner, `tt-${label}`), owner };
}

const api = (orgId: string, rest: string) => `/api/v1/orgs/${orgId}${rest}`;

async function newContract(o: Org, total: number, depositRequired = 0): Promise<{ id: string; code: string }> {
  const res = await request(app)
    .post(api(o.orgId, '/contracts'))
    .set(bearer(o.owner))
    .set('idempotency-key', idem())
    .send({ newCustomer: { fullName: 'Khách thu tiền' }, depositRequired, lines: [{ kind: 'CUSTOM', name: 'Gói makeup', unitPrice: total, quantity: 1 }] });
  if (res.status !== 201) throw new Error(`Tạo hợp đồng thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return { id: res.body.id, code: res.body.code };
}

async function setStatus(o: Org, contractId: string, to: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
  const res = await request(app)
    .post(api(o.orgId, `/contracts/${contractId}/status`))
    .set(bearer(o.owner))
    .send(to === 'CANCELLED' ? { to, reason: 'Khách huỷ' } : { to });
  if (res.status !== 200) throw new Error(`Đổi trạng thái thất bại ${res.status}: ${JSON.stringify(res.body)}`);
}

function pay(u: TestUser, orgId: string, contractId: string, body: object, key = idem()) {
  return request(app).post(api(orgId, `/contracts/${contractId}/payments`)).set(bearer(u)).set('idempotency-key', key).send(body);
}

function progress(u: TestUser, orgId: string, contractId: string) {
  return request(app).get(api(orgId, `/contracts/${contractId}/payments`)).set(bearer(u));
}

function plan(u: TestUser, orgId: string, contractId: string, installments: object[]) {
  return request(app).put(api(orgId, `/contracts/${contractId}/installments`)).set(bearer(u)).send({ installments });
}

function voidPayment(u: TestUser, orgId: string, paymentId: string, reason = 'Ghi nhầm') {
  return request(app).post(api(orgId, `/payments/${paymentId}/void`)).set(bearer(u)).send({ reason });
}

beforeAll(async () => {
  app = makeApp(deps);
  A = await newOrg('a');
  B = await newOrg('b');
  accountant = await registerUser(app, 'tt-ke-toan');
  receptionist = await registerUser(app, 'tt-le-tan');
  artist = await registerUser(app, 'tt-tho');
  await addMember(app, A.owner, A.orgId, accountant, ['accountant']);
  await addMember(app, A.owner, A.orgId, receptionist, ['receptionist']);
  await addMember(app, A.owner, A.orgId, artist, ['artist']);
});

describe('tiến độ thanh toán', () => {
  it('tổng các đợt lệch tổng hợp đồng → 400 nói rõ chênh bao nhiêu; không ghi gì', async () => {
    const c = await newContract(A, 10_000_000, 3_000_000);
    const short = await plan(A.owner, A.orgId, c.id, [
      { name: 'Đặt cọc', dueDate: at(DAY), amount: 3_000_000, isDeposit: true },
      { name: 'Đợt 1', dueDate: at(2 * DAY), amount: 6_500_000 },
    ]);
    expect(short.status).toBe(400);
    expect(short.body.error.message).toMatch(/còn thiếu 500\.000 ₫/);
    expect(short.body.error.details).toEqual({ contractTotal: 10_000_000, installmentsTotal: 9_500_000, difference: -500_000 });
    const over = await plan(A.owner, A.orgId, c.id, [{ name: 'Một lần', dueDate: at(DAY), amount: 10_000_001 }]);
    expect(over.status).toBe(400);
    expect(over.body.error.message).toMatch(/thừa 1 ₫/);
    const twoDeposits = await plan(A.owner, A.orgId, c.id, [
      { name: 'Cọc 1', dueDate: at(DAY), amount: 5_000_000, isDeposit: true },
      { name: 'Cọc 2', dueDate: at(DAY), amount: 5_000_000, isDeposit: true },
    ]);
    expect(twoDeposits.status).toBe(400);
    expect(twoDeposits.body.error.message).toMatch(/tối đa 1 đợt đặt cọc/);
    expect(await deps.db.paymentInstallment.count({ where: { contractId: c.id } })).toBe(0);
  });

  it('thay toàn bộ tiến độ: xếp theo hạn, nhật ký ghi trước → sau', async () => {
    const c = await newContract(A, 6_000_000);
    await plan(A.owner, A.orgId, c.id, [{ name: 'Một lần', dueDate: at(DAY), amount: 6_000_000 }]).expect(200);
    const res = await plan(A.owner, A.orgId, c.id, [
      { name: 'Đợt 2', dueDate: at(20 * DAY), amount: 2_000_000 },
      { name: 'Đặt cọc', dueDate: at(DAY), amount: 4_000_000, isDeposit: true },
    ]).expect(200);
    expect(res.body.installments.map((i: { name: string }) => i.name)).toEqual(['Đặt cọc', 'Đợt 2']);
    expect(res.body.scheduleDifference).toBe(0);
    expect(await deps.db.paymentInstallment.count({ where: { contractId: c.id } })).toBe(2);
    const audit = await deps.db.auditLog.findFirstOrThrow({
      where: { organizationId: A.orgId, entityId: c.id, action: 'payment.installments_replaced' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.data).toMatchObject({
      before: [{ name: 'Một lần', amount: 6_000_000 }],
      after: [{ name: 'Đặt cọc', amount: 4_000_000, isDeposit: true }, { name: 'Đợt 2', amount: 2_000_000 }],
    });
  });

  it('hợp đồng đã huỷ → 409', async () => {
    const c = await newContract(A, 1_000_000);
    await setStatus(A, c.id, 'CANCELLED');
    const res = await plan(A.owner, A.orgId, c.id, [{ name: 'Một lần', dueDate: at(DAY), amount: 1_000_000 }]);
    expect(res.status).toBe(409);
  });

  it('thu cọc rồi thu đợt → trạng thái từng đợt đúng theo thời gian (PAID / OVERDUE / PARTIAL / DUE)', async () => {
    const c = await newContract(A, 10_000_000, 3_000_000);
    await setStatus(A, c.id, 'CONFIRMED');
    await plan(A.owner, A.orgId, c.id, [
      { name: 'Đặt cọc', dueDate: at(-3 * DAY), amount: 3_000_000, isDeposit: true },
      { name: 'Đợt 1', dueDate: at(-1 * DAY), amount: 4_000_000 },
      { name: 'Đợt 2', dueDate: at(10 * DAY), amount: 3_000_000 },
    ]).expect(200);
    const states = async () =>
      ((await progress(A.owner, A.orgId, c.id).expect(200)).body.installments as { name: string; paidAmount: number; status: string }[]).map(
        (i) => [i.name, i.paidAmount, i.status],
      );
    expect(await states()).toEqual([
      ['Đặt cọc', 0, 'OVERDUE'],
      ['Đợt 1', 0, 'OVERDUE'],
      ['Đợt 2', 0, 'DUE'],
    ]);
    await pay(receptionist, A.orgId, c.id, { method: 'CASH', amount: 3_000_000, receivedAt: at(-3 * DAY), note: 'Cọc' }).expect(201);
    expect(await states()).toEqual([
      ['Đặt cọc', 3_000_000, 'PAID'],
      ['Đợt 1', 0, 'OVERDUE'],
      ['Đợt 2', 0, 'DUE'],
    ]);
    await pay(receptionist, A.orgId, c.id, { method: 'BANK_TRANSFER', amount: 2_000_000 }).expect(201);
    expect((await states())[1]).toEqual(['Đợt 1', 2_000_000, 'OVERDUE']);
    await pay(receptionist, A.orgId, c.id, { method: 'CARD', amount: 3_000_000 }).expect(201);
    expect(await states()).toEqual([
      ['Đặt cọc', 3_000_000, 'PAID'],
      ['Đợt 1', 4_000_000, 'PAID'],
      ['Đợt 2', 1_000_000, 'PARTIAL'],
    ]);
    const body = (await progress(A.owner, A.orgId, c.id).expect(200)).body;
    expect(body.summary).toEqual({
      total: 10_000_000,
      depositRequired: 3_000_000,
      received: 8_000_000,
      refunded: 0,
      paid: 8_000_000,
      remaining: 2_000_000,
      overpaid: 0,
      depositOutstanding: 0,
    });
    // Phiếu mới nhất trước, kèm người lập.
    expect(body.payments.map((p: { amount: number }) => p.amount)).toEqual([3_000_000, 2_000_000, 3_000_000]);
    expect(body.payments[0].createdBy).toEqual({ id: receptionist.id, fullName: 'Người thử tt-le-tan' });
    expect(body.payments[0].code).toMatch(/^PT-\d{6}$/);
  });
});

describe('phiếu thu, phiếu hoàn', () => {
  it('hoàn tiền cần payments.void: lễ tân → 403, kế toán → được; hoàn vượt số đã thu → 409', async () => {
    const c = await newContract(A, 5_000_000);
    await pay(receptionist, A.orgId, c.id, { method: 'CASH', amount: 2_000_000 }).expect(201);
    const denied = await pay(receptionist, A.orgId, c.id, { kind: 'REFUND', method: 'CASH', amount: 500_000 });
    expect(denied.status).toBe(403);
    expect(denied.body.error.details).toEqual({ required: 'payments.void' });
    const ok = await pay(accountant, A.orgId, c.id, { kind: 'REFUND', method: 'CASH', amount: 500_000, note: 'Bớt một người' }).expect(201);
    expect(ok.body.summary).toMatchObject({ paid: 1_500_000, refunded: 500_000 });
    const tooMuch = await pay(accountant, A.orgId, c.id, { kind: 'REFUND', method: 'CASH', amount: 1_500_001 });
    expect(tooMuch.status).toBe(409);
    expect(await deps.db.payment.count({ where: { contractId: c.id } })).toBe(2);
  });

  it('thu vượt tổng → 409; allowOverpay thiếu ghi chú → 400; có ghi chú → được và ghi nhật ký', async () => {
    const c = await newContract(A, 1_000_000);
    await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 800_000 }).expect(201);
    const over = await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 300_000 });
    expect(over.status).toBe(409);
    expect(over.body.error.details).toMatchObject({ overBy: 100_000, remaining: 200_000 });
    expect((await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 300_000, allowOverpay: true })).status).toBe(400);
    const ok = await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 300_000, allowOverpay: true, note: 'Khách boa thêm' }).expect(201);
    expect(ok.body.summary).toMatchObject({ paid: 1_100_000, remaining: -100_000, overpaid: 100_000 });
    const audit = await deps.db.auditLog.findFirstOrThrow({ where: { organizationId: A.orgId, entityId: ok.body.id, action: 'payment.created' } });
    expect(audit.data).toMatchObject({ overpay: { overBy: 100_000, note: 'Khách boa thêm' } });
  });

  it('hợp đồng nháp thu cọc được; hợp đồng đã huỷ chỉ cho hoàn tiền', async () => {
    const c = await newContract(A, 2_000_000, 500_000);
    const draft = await pay(A.owner, A.orgId, c.id, { method: 'BANK_TRANSFER', amount: 500_000, note: 'Cọc giữ lịch' }).expect(201);
    expect(draft.body.contract.status).toBe('DRAFT');
    expect(draft.body.summary.depositOutstanding).toBe(0);
    await setStatus(A, c.id, 'CANCELLED');
    expect((await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 1_000 })).status).toBe(409);
    await pay(A.owner, A.orgId, c.id, { kind: 'REFUND', method: 'BANK_TRANSFER', amount: 500_000, note: 'Trả cọc' }).expect(201);
  });

  it('ngày thu quá 5 phút tương lai → 400; số tiền lẻ/âm/0 → 400', async () => {
    const c = await newContract(A, 1_000_000);
    expect((await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 1_000, receivedAt: at(10 * 60_000) })).status).toBe(400);
    await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 1_000, receivedAt: at(2 * 60_000) }).expect(201);
    for (const amount of [0, -1, 10.5]) {
      expect((await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount })).status).toBe(400);
    }
  });

  it('gửi lại cùng Idempotency-Key → đúng một phiếu, cùng kết quả', async () => {
    const c = await newContract(A, 1_000_000);
    const key = idem();
    const body = { method: 'CASH', amount: 100_000 };
    const r1 = await pay(A.owner, A.orgId, c.id, body, key).expect(201);
    const r2 = await pay(A.owner, A.orgId, c.id, body, key).expect(201);
    expect(r2.body).toEqual(r1.body);
    expect(await deps.db.payment.count({ where: { contractId: c.id } })).toBe(1);
  });

  it('mã PT tuần tự, không trùng khi gửi đồng thời', async () => {
    const C = await newOrg('ma-pt');
    const contracts = await Promise.all(Array.from({ length: 4 }, () => newContract(C, 1_000_000)));
    const targets = [...contracts, ...contracts];
    const res = await Promise.all(targets.map((c) => pay(C.owner, C.orgId, c.id, { method: 'CASH', amount: 1_000 })));
    expect(res.map((r) => r.status)).toEqual(targets.map(() => 201));
    const codes = res.map((r) => r.body.code as string).sort();
    expect(codes).toEqual(Array.from({ length: 8 }, (_v, i) => `PT-${String(i + 1).padStart(6, '0')}`));
  });
});

describe('huỷ phiếu', () => {
  it('huỷ phiếu → tóm tắt đổi, nhật ký có lý do; huỷ lần hai → 409', async () => {
    const c = await newContract(A, 3_000_000);
    const p1 = (await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 1_000_000 }).expect(201)).body;
    await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 500_000 }).expect(201);
    const res = await voidPayment(accountant, A.orgId, p1.id, 'Ghi nhầm hợp đồng').expect(200);
    expect(res.body.voidReason).toBe('Ghi nhầm hợp đồng');
    expect(res.body.summary).toMatchObject({ paid: 500_000, remaining: 2_500_000 });
    expect((await progress(A.owner, A.orgId, c.id)).body.summary.paid).toBe(500_000);
    expect((await voidPayment(accountant, A.orgId, p1.id)).status).toBe(409);
    const audit = await deps.db.auditLog.findFirstOrThrow({ where: { organizationId: A.orgId, entityId: p1.id, action: 'payment.voided' } });
    expect(audit.data).toMatchObject({ reason: 'Ghi nhầm hợp đồng', before: { paid: 1_500_000 }, after: { paid: 500_000 } });
  });

  it('lễ tân không có payments.void → 403; huỷ phiếu thu làm số đã thu âm → 409', async () => {
    const c = await newContract(A, 3_000_000);
    const receipt = (await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 1_000_000 }).expect(201)).body;
    expect((await voidPayment(receptionist, A.orgId, receipt.id)).status).toBe(403);
    await pay(A.owner, A.orgId, c.id, { kind: 'REFUND', method: 'CASH', amount: 400_000 }).expect(201);
    const res = await voidPayment(A.owner, A.orgId, receipt.id);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/huỷ phiếu hoàn trước/);
  });

  it('sửa/xoá thẳng database phiếu đã ghi → trigger chặn', async () => {
    const c = await newContract(A, 3_000_000);
    const p = (await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 1_000_000 }).expect(201)).body;
    const upd = await deps.db.payment.update({ where: { id: p.id }, data: { amount: 1n } }).catch((e: unknown) => e);
    expect(String(upd)).toMatch(/không được sửa/);
    const del = await deps.db.payment.delete({ where: { id: p.id } }).catch((e: unknown) => e);
    expect(String(del)).toMatch(/không được xoá/);
    await voidPayment(A.owner, A.orgId, p.id).expect(200);
    const reason = await deps.db.payment.update({ where: { id: p.id }, data: { voidReason: 'Đổi lý do' } }).catch((e: unknown) => e);
    expect(String(reason)).toMatch(/không được sửa/);
    const row = await deps.db.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.amount).toBe(1_000_000n);
    expect(row.voidReason).toBe('Ghi nhầm');
  });
});

describe('sổ thu và báo cáo doanh thu', () => {
  it('khớp từng đồng với tổng các phiếu: theo tháng, theo hợp đồng, sổ thu', async () => {
    const R = await newOrg('bao-cao');
    const c1 = await newContract(R, 10_000_000, 3_000_000);
    const c2 = await newContract(R, 5_000_000, 1_000_000);
    const c3 = await newContract(R, 2_000_000);
    const c4 = await newContract(R, 4_000_000);
    await setStatus(R, c1.id, 'CONFIRMED');
    await setStatus(R, c2.id, 'CONFIRMED');
    await setStatus(R, c4.id, 'CONFIRMED');
    const p = (c: { id: string }, body: object) => pay(R.owner, R.orgId, c.id, body).expect(201);
    await p(c1, { method: 'CASH', amount: 2_000_000, receivedAt: at(-40 * DAY), note: 'Cọc trước kỳ' });
    await p(c1, { method: 'BANK_TRANSFER', amount: 1_234_567 });
    await p(c2, { method: 'CARD', amount: 300_001 });
    const voided = (await p(c2, { method: 'CASH', amount: 999_999 })).body;
    await voidPayment(R.owner, R.orgId, voided.id).expect(200);
    await p(c3, { method: 'CASH', amount: 500_000, note: 'Cọc nháp' });
    await p(c4, { method: 'CASH', amount: 1_000_000 });
    await setStatus(R, c4.id, 'CANCELLED');
    await p(c4, { kind: 'REFUND', method: 'CASH', amount: 400_000 });

    const from = at(-DAY);
    const to = at(DAY);
    // Tính độc lập từ database: thu − hoàn, bỏ phiếu huỷ, ngày thu trong [from, to).
    const rows = await deps.db.payment.findMany({
      where: { organizationId: R.orgId, voidedAt: null, receivedAt: { gte: new Date(from), lt: new Date(to) } },
    });
    const expectedCollected = rows.reduce((s, r) => s + (r.kind === 'RECEIPT' ? Number(r.amount) : -Number(r.amount)), 0);
    expect(expectedCollected).toBe(1_234_567 + 300_001 + 500_000 + 1_000_000 - 400_000);

    const month = (await request(app).get(api(R.orgId, '/reports/revenue')).query({ from, to, groupBy: 'month' }).set(bearer(R.owner)).expect(200)).body;
    expect(month.totals).toEqual({
      contractCount: 2,
      sales: 15_000_000,
      depositRequired: 4_000_000,
      // HD1 đã đủ cọc; HD2 còn thiếu 1.000.000 − 300.001.
      depositOutstanding: 0 + (1_000_000 - 300_001),
      outstanding: 15_000_000 - (2_000_000 + 1_234_567) - 300_001,
      received: 1_234_567 + 300_001 + 500_000 + 1_000_000,
      refunded: 400_000,
      collected: expectedCollected,
    });
    const sumRows = (key: string, list: Record<string, number>[]) => list.reduce((s, r) => s + (r[key] ?? 0), 0);
    for (const k of ['sales', 'depositRequired', 'collected', 'outstanding', 'received', 'refunded']) {
      expect(sumRows(k, month.rows)).toBe(month.totals[k]);
    }
    expect(JSON.stringify(month)).not.toMatch(/lợi nhuận/i);

    const byContract = (await request(app).get(api(R.orgId, '/reports/revenue')).query({ from, to, groupBy: 'contract' }).set(bearer(R.owner)).expect(200)).body;
    expect(byContract.totals).toEqual(month.totals);
    expect(sumRows('paidInPeriod', byContract.rows)).toBe(expectedCollected);
    const row = (code: string) => byContract.rows.find((r: { code: string }) => r.code === code);
    expect(row(c1.code)).toMatchObject({
      bookedInPeriod: true,
      total: 10_000_000,
      depositRequired: 3_000_000,
      paid: 3_234_567,
      paidInPeriod: 1_234_567,
      remaining: 6_765_433,
      customer: { fullName: 'Khách thu tiền' },
    });
    expect(row(c2.code)).toMatchObject({ bookedInPeriod: true, paid: 300_001, remaining: 4_699_999, depositOutstanding: 699_999 });
    expect(row(c3.code)).toMatchObject({ bookedInPeriod: false, status: 'DRAFT', paidInPeriod: 500_000 });
    expect(row(c4.code)).toMatchObject({ bookedInPeriod: false, status: 'CANCELLED', paid: 600_000, remaining: null });
    expect(byContract.rows).toHaveLength(4);

    const ledger = (await request(app).get(api(R.orgId, '/payments')).query({ from, to }).set(bearer(R.owner)).expect(200)).body;
    expect(ledger.totals.net).toBe(expectedCollected);
    expect(ledger.totals).toMatchObject({ refunded: 400_000, refundCount: 1, receiptCount: 4 });
    // Danh sách hiện cả phiếu đã huỷ (để đối soát) nhưng tổng không tính.
    expect(ledger.total).toBe(6);
    const filtered = (await request(app).get(api(R.orgId, '/payments')).query({ from, to, contractId: c2.id, method: 'CARD' }).set(bearer(R.owner)).expect(200)).body;
    expect(filtered.items.map((i: { amount: number }) => i.amount)).toEqual([300_001]);
    expect(filtered.items[0].contract).toMatchObject({ id: c2.id, code: c2.code });
  });

  it('kỳ thiếu from/to, ngược, hoặc quá 366 ngày → 400', async () => {
    const get = (path: string, q: object) => request(app).get(api(A.orgId, path)).query(q).set(bearer(A.owner));
    const now = Date.now();
    const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
    for (const path of ['/payments', '/reports/revenue']) {
      expect((await get(path, {})).status).toBe(400);
      expect((await get(path, { from: iso(0), to: iso(-DAY) })).status).toBe(400);
      expect((await get(path, { from: iso(-366 * DAY - 1), to: iso(0) })).status).toBe(400);
      expect((await get(path, { from: iso(-366 * DAY), to: iso(0) })).status).toBe(200);
    }
  });
});

describe('cách ly tổ chức và quyền', () => {
  let cA: { id: string; code: string };
  let paymentA: { id: string; code: string };

  beforeAll(async () => {
    cA = await newContract(A, 2_000_000);
    paymentA = (await pay(A.owner, A.orgId, cA.id, { method: 'CASH', amount: 700_000 }).expect(201)).body;
  });

  const strip = (body: unknown) => JSON.stringify(body).replace(/"requestId":"[^"]+"/g, '');

  it('chủ B không thấy/thu/huỷ được của A — phản hồi giống hệt mã bịa', async () => {
    const fake = randomUUID();
    const both = async (send: (id: string) => Promise<request.Response>) => {
      const real = await send(cA.id);
      const probe = await send(fake);
      expect(real.status).toBe(404);
      expect(strip(real.body)).toBe(strip(probe.body));
    };
    await both((id) => progress(B.owner, B.orgId, id));
    await both((id) => plan(B.owner, B.orgId, id, [{ name: 'x', dueDate: at(DAY), amount: 2_000_000 }]));
    await both((id) => pay(B.owner, B.orgId, id, { method: 'CASH', amount: 1_000 }));
    await both((id) => request(app).get(api(B.orgId, '/payments')).query({ from: at(-DAY), to: at(DAY), contractId: id }).set(bearer(B.owner)));
    const realVoid = await voidPayment(B.owner, B.orgId, paymentA.id);
    const fakeVoid = await voidPayment(B.owner, B.orgId, fake);
    expect(realVoid.status).toBe(404);
    expect(strip(realVoid.body)).toBe(strip(fakeVoid.body));
    // Qua đường dẫn của A → 404 (không phải thành viên).
    expect((await progress(B.owner, A.orgId, cA.id)).status).toBe(404);
    expect((await voidPayment(B.owner, A.orgId, paymentA.id)).status).toBe(404);
    // Sổ thu và báo cáo của B không có gì của A.
    const ledgerB = await request(app).get(api(B.orgId, '/payments')).query({ from: at(-DAY), to: at(DAY) }).set(bearer(B.owner)).expect(200);
    const reportB = await request(app).get(api(B.orgId, '/reports/revenue')).query({ from: at(-DAY), to: at(DAY), groupBy: 'contract' }).set(bearer(B.owner)).expect(200);
    for (const text of [JSON.stringify(ledgerB.body), JSON.stringify(reportB.body)]) {
      expect(text).not.toContain(cA.id);
      expect(text).not.toContain(paymentA.id);
    }
    // Dữ liệu A không đổi.
    const row = await deps.db.payment.findUniqueOrThrow({ where: { id: paymentA.id } });
    expect(row.voidedAt).toBeNull();
    expect(await deps.db.payment.count({ where: { contractId: cA.id } })).toBe(1);
    expect(await deps.db.paymentInstallment.count({ where: { contractId: cA.id } })).toBe(0);
  });

  it('thợ makeup → 403 ở mọi đường thu tiền; lễ tân không xem được báo cáo', async () => {
    const q = { from: at(-DAY), to: at(DAY) };
    expect((await progress(artist, A.orgId, cA.id)).status).toBe(403);
    expect((await plan(artist, A.orgId, cA.id, [{ name: 'x', dueDate: at(DAY), amount: 2_000_000 }])).status).toBe(403);
    expect((await pay(artist, A.orgId, cA.id, { method: 'CASH', amount: 1_000 })).status).toBe(403);
    expect((await voidPayment(artist, A.orgId, paymentA.id)).status).toBe(403);
    expect((await request(app).get(api(A.orgId, '/payments')).query(q).set(bearer(artist))).status).toBe(403);
    expect((await request(app).get(api(A.orgId, '/reports/revenue')).query(q).set(bearer(artist))).status).toBe(403);
    expect((await request(app).get(api(A.orgId, '/reports/revenue')).query(q).set(bearer(receptionist))).status).toBe(403);
    expect((await request(app).get(api(A.orgId, '/reports/revenue')).query(q).set(bearer(accountant))).status).toBe(200);
    expect(await deps.db.payment.count({ where: { contractId: cA.id } })).toBe(1);
  });
});
