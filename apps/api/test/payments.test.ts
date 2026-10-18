// Module THU TIỀN: tiến độ thanh toán, phiếu thu/hoàn, huỷ phiếu, sổ thu, báo cáo doanh thu, cách ly tổ chức, quyền.
// Hợp đồng dựng qua API với dòng CUSTOM cho nhanh.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { vndOrNull } from '../src/modules/payments/common';
import { emptyBucket, presentBucket } from '../src/modules/payments/reports';
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

// Lùi ngày lập hợp đồng (dữ liệu thử): phiếu thu được trước ngày lập hợp đồng tối đa 1 ngày (N6).
async function backdateContract(contractId: string, days: number) {
  await deps.db.$executeRaw`UPDATE contracts SET created_at = now() - make_interval(days => ${days}::int) WHERE id = ${contractId}::uuid`;
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
    await backdateContract(c.id, 5);
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
    await backdateContract(c1.id, 41);
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

describe('sửa nghiệm thu máy chủ lát 2 — thu tiền', () => {
  it('M3 — một phiếu > 100 tỷ → 400, không ghi; đúng 100 tỷ (cho thu vượt + ghi chú) → được', async () => {
    const o = await newOrg('m3-tran');
    const c = await newContract(o, 1_000_000);
    const over = await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 100_000_000_001, allowOverpay: true, note: 'gõ thừa số 0' });
    console.log(`[M3] phiếu 100.000.000.001 đ → ${over.status} ${over.body.error?.details?.issues?.[0]?.message ?? ''}`);
    expect(over.status).toBe(400);
    const huge = await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 5_000_000_000_000_000, allowOverpay: true, note: 'tấn công' });
    expect(huge.status).toBe(400);
    expect(await deps.db.payment.count({ where: { contractId: c.id } })).toBe(0);
    await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 100_000_000_000, allowOverpay: true, note: 'trần' }).expect(201);
  });

  // Bài cũ ghi thẳng 2 phiếu 5 triệu tỷ để giả "dữ liệu cũ trước khi có trần". Từ migration 20261018250000_tran_so_tien
  // database cấm mọi số tiền > 100 tỷ nên không còn tạo được dòng đó (điều phối quyết P1). Ý của bài cũ giữ nguyên, tách ba:
  //  (a) hàm thuần vndOrNull / presentBucket: tổng vượt ngưỡng số nguyên an toàn → null, không ném lỗi;
  //  (b) đầu cuối trên database THẬT: 90.072 phiếu ĐÚNG trần 100 tỷ (hợp lệ) → tổng 9.007.200.000.000.000 > ngưỡng
  //      9.007.199.254.740.991 → sổ thu + báo cáo vẫn 200, tổng null + cờ totalsOverflow, danh sách phiếu vẫn đủ;
  //  (c) database chặn phiếu vượt trần khi ghi thẳng (lách máy chủ).
  it('M3 (a) — vndOrNull / presentBucket: vượt ngưỡng an toàn → null (không ném lỗi), đúng ngưỡng → số', () => {
    const SAFE = BigInt(Number.MAX_SAFE_INTEGER);
    expect(vndOrNull(SAFE)).toBe(Number.MAX_SAFE_INTEGER);
    expect(vndOrNull(SAFE + 1n)).toBeNull();
    expect(vndOrNull(-SAFE)).toBe(-Number.MAX_SAFE_INTEGER);
    expect(vndOrNull(-SAFE - 1n)).toBeNull();
    const b = { ...emptyBucket(), contractCount: 2, sales: 2_000_000n, paidToDate: 2n * SAFE, received: SAFE + 1_000n, refunded: 1_000n };
    const out = presentBucket(b);
    expect(out).toEqual({
      contractCount: 2,
      sales: 2_000_000,
      depositRequired: 0,
      depositOutstanding: 0,
      outstanding: null, // 2.000.000 − 2 × ngưỡng < −ngưỡng
      received: null,
      refunded: 1_000,
      collected: Number.MAX_SAFE_INTEGER, // (ngưỡng + 1.000) − 1.000: tổng gộp về lại trong ngưỡng thì vẫn là số
    });
  });

  it('M3 (b) — 90.072 phiếu đúng trần 100 tỷ (tổng vượt ngưỡng an toàn) → sổ thu + báo cáo 200, tổng null + cờ totalsOverflow, danh sách phiếu vẫn đủ', async () => {
    const o = await newOrg('m3-tong');
    const c1 = await newContract(o, 1_000_000);
    const c2 = await newContract(o, 1_000_000);
    const N = 90_072; // 90.072 × 100 tỷ = 9.007.200.000.000.000 > Number.MAX_SAFE_INTEGER
    expect(BigInt(N) * 100_000_000_000n > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(BigInt(N - 1) * 100_000_000_000n + 1_000n <= BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    await pay(o.owner, o.orgId, c2.id, { method: 'CASH', amount: 1_000 }).expect(201);
    // Ghi một lần bằng SQL (qua API sẽ mất hàng giờ). Mỗi phiếu đều hợp lệ (= trần) — database nhận.
    await deps.db.$executeRaw`
      INSERT INTO payments (id, organization_id, contract_id, code, kind, method, amount, received_at, note, created_by_id)
      SELECT gen_random_uuid(), ${o.orgId}::uuid, ${c1.id}::uuid, 'PT-TRAN-' || g, 'RECEIPT', 'CASH', 100000000000, now(), 'phiếu đúng trần', ${o.owner.id}::uuid
      FROM generate_series(1, ${N}::int) g`;
    const from = at(-DAY);
    const to = at(DAY);
    const get = (path: string, q: object) => request(app).get(api(o.orgId, path)).query({ from, to, ...q }).set(bearer(o.owner));
    const ledger = await get('/payments', {});
    const month = await get('/reports/revenue', { groupBy: 'month' });
    const byC = await get('/reports/revenue', { groupBy: 'contract' });
    const byKind = await get('/reports/revenue', { groupBy: 'kind' });
    console.log(`[M3] ${N + 1} phiếu, tổng vượt ngưỡng: sổ thu → ${ledger.status} (tổng ${ledger.body.total} phiếu, tổng thu ${ledger.body.totals?.received}); báo cáo tháng → ${month.status}; theo hợp đồng → ${byC.status}; theo loại → ${byKind.status}`);
    expect([ledger.status, month.status, byC.status, byKind.status]).toEqual([200, 200, 200, 200]);
    expect(ledger.body.total).toBe(N + 1);
    expect(ledger.body.items.length).toBeGreaterThan(0);
    expect(ledger.body.items.some((i: { amount: number }) => i.amount === 100_000_000_000)).toBe(true);
    expect(ledger.body.totals.received).toBeNull();
    expect(ledger.body.totalsOverflow).toBe(true);
    for (const r of [month, byKind]) {
      expect(r.body.totalsOverflow).toBe(true);
      expect(r.body.totals.received).toBeNull();
    }
    expect(byC.body.totalsOverflow).toBe(true);
    expect(byC.body.rows).toHaveLength(2);
    // Hợp đồng có tổng thu vượt ngưỡng → null; hợp đồng kia vẫn đọc được số của mình.
    const paidOf = (id: string) => byC.body.rows.find((r: { contractId: string }) => r.contractId === id)?.paid;
    expect(paidOf(c1.id)).toBeNull();
    expect(paidOf(c2.id)).toBe(1_000);
  });

  it('M3 (c) — ghi thẳng database một phiếu 100.000.000.001 đ (lách máy chủ) → database chặn (payments_amount_cap), không ghi', async () => {
    const o = await newOrg('m3-db');
    const c = await newContract(o, 1_000_000);
    const err = await deps.db.payment
      .create({ data: { organizationId: o.orgId, contractId: c.id, code: 'PT-VUOT', kind: 'RECEIPT', method: 'CASH', amount: 100_000_000_001n, receivedAt: new Date(), note: 'vượt trần', createdById: o.owner.id } })
      .catch((e: unknown) => e);
    expect(String(err)).toMatch(/payments_amount_cap/);
    expect(await deps.db.payment.count({ where: { contractId: c.id } })).toBe(0);
  });

  it('N5 — vai trò chỉ có payments.read (không có customers.read) → tiến độ thu tiền KHÔNG có SĐT khách; có customers.read → có', async () => {
    const o = await newOrg('n5');
    const res = await request(app)
      .post(api(o.orgId, '/contracts'))
      .set(bearer(o.owner))
      .set('idempotency-key', idem())
      .send({ newCustomer: { fullName: 'Khách có SĐT', phone: '0912345678' }, lines: [{ kind: 'CUSTOM', name: 'Gói', unitPrice: 1_000_000, quantity: 1 }] })
      .expect(201);
    await request(app).post(api(o.orgId, '/roles')).set(bearer(o.owner)).set('idempotency-key', idem()).send({ key: 'thu_ngan', name: 'Thu ngân', permissions: ['payments.read'] }).expect(201);
    const cashier = await registerUser(app, 'tt-n5-thu-ngan');
    await addMember(app, o.owner, o.orgId, cashier, ['thu_ngan']);
    const asCashier = await progress(cashier, o.orgId, res.body.id).expect(200);
    const asOwner = await progress(o.owner, o.orgId, res.body.id).expect(200);
    console.log(`[N5] thu ngân (không customers.read) thấy SĐT: ${JSON.stringify(asCashier.body).includes('0912345678')}; chủ thấy: ${asOwner.body.contract.customer.phone}`);
    expect(JSON.stringify(asCashier.body)).not.toContain('0912345678');
    expect(asCashier.body.contract.customer).toMatchObject({ fullName: 'Khách có SĐT', phone: null, phoneHidden: true });
    expect(asOwner.body.contract.customer).toMatchObject({ phone: '0912345678', phoneHidden: false });
    // Lập tiến độ (cũng trả tiến độ) — cùng luật: chủ có quyền khách thì thấy.
    const putRes = await plan(o.owner, o.orgId, res.body.id, [{ name: 'Một lần', dueDate: at(DAY), amount: 1_000_000 }]).expect(200);
    expect(putRes.body.contract.customer.phone).toBe('0912345678');
  });

  it('N6 — ngày thu trước ngày lập hợp đồng quá 1 ngày → 400 không ghi; trong 1 ngày → được; lùi > 24 giờ ghi nhật ký "backdated"', async () => {
    const o = await newOrg('n6');
    const c = await newContract(o, 10_000_000);
    const old = await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 1_000, receivedAt: '1990-01-01T00:00:00.000Z' });
    const twoDays = await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 1_000, receivedAt: at(-2 * DAY) });
    console.log(`[N6] lùi về 1990 → ${old.status}; lùi 2 ngày (hợp đồng lập hôm nay) → ${twoDays.status}`);
    expect([old.status, twoDays.status]).toEqual([400, 400]);
    expect(await deps.db.payment.count({ where: { contractId: c.id } })).toBe(0);
    const ok = await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 1_000, receivedAt: at(-23 * 60 * 60_000) }).expect(201);
    const fresh = await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 1_000 }).expect(201);
    await backdateContract(c.id, 10);
    const back = await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 1_000, receivedAt: at(-5 * DAY) }).expect(201);
    const logOf = async (id: string) => (await deps.db.auditLog.findFirst({ where: { entityId: id, action: 'payment.created' } }))?.data as Record<string, unknown>;
    expect((await logOf(back.body.id)).backdated).toMatchObject({ days: 5 });
    expect((await logOf(fresh.body.id)).backdated).toBeNull();
    expect((await logOf(ok.body.id)).backdated).toBeNull();
    // Tương lai quá 5 phút vẫn bị chặn như cũ.
    expect((await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 1_000, receivedAt: at(6 * 60_000) })).status).toBe(400);
  });

  it('P1 (GIỮ khoá chống đua) — 20 phiếu 100 nghìn gửi SONG SONG vào hợp đồng 1 triệu → tổng đã thu không vượt 1 triệu, đúng 10 qua', async () => {
    const o = await newOrg('p1-dua');
    const c = await newContract(o, 1_000_000);
    const results = await Promise.all(Array.from({ length: 20 }, () => pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 100_000 })));
    const ok = results.filter((r) => r.status === 201).length;
    const rows = await deps.db.payment.findMany({ where: { contractId: c.id, voidedAt: null } });
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    console.log(`[P1] 20 phiếu song song: qua ${ok}/20, tổng thu ${total} trên hợp đồng 1.000.000; còn lại trả ${[...new Set(results.filter((r) => r.status !== 201).map((r) => r.status))].join(',')}`);
    expect(total).toBeLessThanOrEqual(1_000_000);
    expect(ok).toBe(10);
    expect(total).toBe(1_000_000);
    const summary = (await progress(o.owner, o.orgId, c.id).expect(200)).body.summary;
    expect(summary.paid).toBe(1_000_000);
  });

  it('GIỮ (P3, P5, P6) — tháng báo cáo theo giờ VN; thu vượt ĐÚNG 1 đồng → 409; nhật ký phiếu có trước → sau', async () => {
    const o = await newOrg('p356');
    const c = await newContract(o, 1_000_000);
    await backdateContract(c.id, 120);
    // 31/8 17:30 UTC = 1/9 00:30 giờ VN → tháng 2026-09, không phải tháng 8.
    await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 100_000, receivedAt: '2026-08-31T17:30:00.000Z' }).expect(201);
    const rep = (await request(app).get(api(o.orgId, '/reports/revenue')).query({ from: '2026-07-31T17:00:00.000Z', to: '2026-09-30T17:00:00.000Z', groupBy: 'month' }).set(bearer(o.owner)).expect(200)).body;
    const byMonth = Object.fromEntries(rep.rows.map((r: { period: string; collected: number }) => [r.period, r.collected]));
    console.log(`[P3] phiếu 00:30 1/9 giờ VN → ${JSON.stringify(byMonth)}`);
    expect(byMonth).toEqual({ '2026-08': 0, '2026-09': 100_000 });
    // P5: còn phải thu 900.000 → thu 900.001 (vượt 1 đồng) → 409; đúng 900.000 → được.
    expect((await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 900_001 })).status).toBe(409);
    const exact = await pay(o.owner, o.orgId, c.id, { method: 'CASH', amount: 900_000 }).expect(201);
    // P6: nhật ký có số đã thu trước → sau.
    const log = await deps.db.auditLog.findFirst({ where: { entityId: exact.body.id, action: 'payment.created' } });
    expect(log?.data).toMatchObject({ before: { paid: 100_000, remaining: 900_000 }, after: { paid: 1_000_000, remaining: 0 } });
  });
});
