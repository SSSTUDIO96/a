// BÀI TẤN CÔNG CỦA THỢ CHẤM — LÁT 2, MODULE THU TIỀN (packages/shared/src/payments.ts, modules/payments).
// Quy ước: "LỖI:" xanh = lỗi có thật; "CHẶN:" xanh = đòn bị chặn; "GHI NHẬN:" xanh = hành vi có thật, chủ quyết.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from '../test/helpers';

const deps = makeDeps();
let app: App;
const idem = () => `c2-${randomUUID()}`;
interface Org {
  orgId: string;
  owner: TestUser;
}
let A: Org;
let B: Org;
let receptionist: TestUser;

const api = (orgId: string, rest: string) => `/api/v1/orgs/${orgId}${rest}`;

async function newOrg(label: string): Promise<Org> {
  const owner = await registerUser(app, `c2-tt-${label}`);
  return { orgId: await createOrg(app, owner, `c2-tt-${label}`), owner };
}

async function newContract(o: Org, total: number, depositRequired = 0) {
  const res = await request(app)
    .post(api(o.orgId, '/contracts'))
    .set(bearer(o.owner))
    .set('idempotency-key', idem())
    .send({ newCustomer: { fullName: 'Khách chấm', phone: '0912345678' }, depositRequired, lines: [{ kind: 'CUSTOM', name: 'Gói', unitPrice: total, quantity: 1 }] });
  if (res.status !== 201) throw new Error(`Tạo hợp đồng ${res.status}: ${JSON.stringify(res.body)}`);
  return { id: res.body.id as string, code: res.body.code as string };
}

async function setStatus(o: Org, contractId: string, to: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
  const res = await request(app)
    .post(api(o.orgId, `/contracts/${contractId}/status`))
    .set(bearer(o.owner))
    .send(to === 'CANCELLED' ? { to, reason: 'Khách huỷ' } : { to });
  if (res.status !== 200) throw new Error(`Đổi trạng thái ${res.status}: ${JSON.stringify(res.body)}`);
}

const pay = (u: TestUser, orgId: string, contractId: string, body: object, key = idem()) =>
  request(app).post(api(orgId, `/contracts/${contractId}/payments`)).set(bearer(u)).set('idempotency-key', key).send(body);
const voidP = (u: TestUser, orgId: string, paymentId: string, reason = 'Ghi nhầm') =>
  request(app).post(api(orgId, `/payments/${paymentId}/void`)).set(bearer(u)).send({ reason });
const progress = (u: TestUser, orgId: string, contractId: string) => request(app).get(api(orgId, `/contracts/${contractId}/payments`)).set(bearer(u));
const report = (o: Org, q: Record<string, string>) => request(app).get(api(o.orgId, '/reports/revenue')).set(bearer(o.owner)).query(q);
const ledger = (o: Org, q: Record<string, string>) => request(app).get(api(o.orgId, '/payments')).set(bearer(o.owner)).query(q);

beforeAll(async () => {
  app = makeApp(deps);
  A = await newOrg('a');
  B = await newOrg('b');
  receptionist = await registerUser(app, 'c2-tt-lt');
  await addMember(app, A.owner, A.orgId, receptionist, ['receptionist']);
});
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('P-1 số tiền bất thường', () => {
  it('CHẶN: âm, 0, lẻ, chuỗi, NaN-dạng-chuỗi, 1e20, MAX_SAFE+1, số mũ 1e3 dạng chuỗi → 400; không ghi phiếu', async () => {
    const c = await newContract(A, 1_000_000);
    const bad: unknown[] = [-1, 0, 1.5, 0.1, '1000', 'NaN', 1e20, Number.MAX_SAFE_INTEGER + 1, '1e3', null, true, [1000]];
    let blocked = 0;
    for (const amount of bad) {
      const r = await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount });
      if (r.status === 400) blocked++;
    }
    console.log(`[P-1] số tiền sai bị chặn: ${blocked}/${bad.length}`);
    expect(blocked).toBe(bad.length);
    expect(await deps.db.payment.count({ where: { contractId: c.id } })).toBe(0);
  });

  it('CHẶN: tiến độ có đợt âm/0/lẻ/tổng lệch 1 đồng → 400', async () => {
    const c = await newContract(A, 1_000_000);
    const d = new Date(Date.now() + 86_400_000).toISOString();
    const plans = [
      [{ name: 'a', dueDate: d, amount: -1 }, { name: 'b', dueDate: d, amount: 1_000_001 }],
      [{ name: 'a', dueDate: d, amount: 0 }, { name: 'b', dueDate: d, amount: 1_000_000 }],
      [{ name: 'a', dueDate: d, amount: 999_999.5 }, { name: 'b', dueDate: d, amount: 0.5 }],
      [{ name: 'a', dueDate: d, amount: 999_999 }],
    ];
    let blocked = 0;
    for (const installments of plans) {
      const r = await request(app).put(api(A.orgId, `/contracts/${c.id}/installments`)).set(bearer(A.owner)).send({ installments });
      if (r.status === 400) blocked++;
    }
    console.log(`[P-1] tiến độ sai bị chặn: ${blocked}/${plans.length}`);
    expect(blocked).toBe(plans.length);
  });

  it('LỖI: phiếu thu cực lớn hợp lệ (cho thu vượt + ghi chú) ở 2 hợp đồng → báo cáo doanh thu và sổ thu của CẢ TỔ CHỨC trả 500', async () => {
    const R = await newOrg('cuc-lon');
    const c1 = await newContract(R, 1_000_000);
    const c2 = await newContract(R, 1_000_000);
    const huge = 5_000_000_000_000_000; // 5 triệu tỷ — gõ thừa số 0
    const p1 = await pay(R.owner, R.orgId, c1.id, { method: 'CASH', amount: huge, allowOverpay: true, note: 'gõ nhầm' });
    const p2 = await pay(R.owner, R.orgId, c2.id, { method: 'CASH', amount: huge, allowOverpay: true, note: 'gõ nhầm' });
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 86_400_000).toISOString();
    const rep = await report(R, { from, to });
    const led = await ledger(R, { from, to });
    console.log(`[P-1] 2 phiếu ${huge} → ${p1.status}/${p2.status}; báo cáo → ${rep.status}; sổ thu → ${led.status}`);
    expect([p1.status, p2.status]).toEqual([201, 201]);
    expect(rep.status).toBe(500);
    expect(led.status).toBe(500);
    // Huỷ một phiếu thì báo cáo sống lại — thiệt hại là "mất báo cáo" chứ không phải mất số liệu.
    await voidP(R.owner, R.orgId, p2.body.id).expect(200);
    expect((await report(R, { from, to })).status).toBe(200);
  });
});

describe('P-2 thu vượt, hoàn vượt, huỷ hai lần', () => {
  it('CHẶN: thu vượt 1 đồng → 409; hoàn vượt 1 đồng → 409; huỷ phiếu 2 lần → 409', async () => {
    const c = await newContract(A, 1_000_000);
    const r1 = await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 600_000 });
    const over = await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 400_001 });
    const refOver = await pay(A.owner, A.orgId, c.id, { kind: 'REFUND', method: 'CASH', amount: 600_001 });
    const v1 = await voidP(A.owner, A.orgId, r1.body.id);
    const v2 = await voidP(A.owner, A.orgId, r1.body.id);
    console.log(`[P-2] thu vượt → ${over.status}; hoàn vượt → ${refOver.status}; huỷ lần 1 → ${v1.status}, lần 2 → ${v2.status}`);
    expect([over.status, refOver.status, v1.status, v2.status]).toEqual([409, 409, 200, 409]);
  });

  it('GHI NHẬN: hợp đồng nháp thu đủ 1 tr rồi sửa nháp xuống 200 nghìn → khách "trả thừa" 800 nghìn mà không cần allowOverpay/ghi chú', async () => {
    const c = await newContract(A, 1_000_000);
    await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 1_000_000 }).expect(201);
    const patch = await request(app)
      .patch(api(A.orgId, `/contracts/${c.id}`))
      .set(bearer(A.owner))
      .send({ lines: [{ kind: 'CUSTOM', name: 'Gói rẻ', unitPrice: 200_000, quantity: 1 }] });
    const pr = await progress(A.owner, A.orgId, c.id);
    console.log(`[P-2] sửa nháp sau khi thu → ${patch.status}; tóm tắt: paid=${pr.body.summary?.paid} total=${pr.body.summary?.total} overpaid=${pr.body.summary?.overpaid}`);
    expect(patch.status).toBe(200);
    expect(pr.body.summary.overpaid).toBe(800_000);
  });
});

describe('P-3 đua nhau', () => {
  it('CHẶN: 20 phiếu thu 100 nghìn song song vào hợp đồng 1 tr → đúng 10 qua, tổng thu = 1 tr, mã PT không trùng', async () => {
    const R = await newOrg('dua-thu');
    const c = await newContract(R, 1_000_000);
    const res = await Promise.all(Array.from({ length: 20 }, () => pay(R.owner, R.orgId, c.id, { method: 'CASH', amount: 100_000 })));
    const ok = res.filter((r) => r.status === 201);
    const codes = new Set(ok.map((r) => r.body.code));
    const sum = (await deps.db.payment.aggregate({ where: { contractId: c.id, voidedAt: null }, _sum: { amount: true } }))._sum.amount;
    const others = res.filter((r) => r.status !== 201).map((r) => r.status);
    console.log(`[P-3] thu song song: qua ${ok.length}/20, mã khác nhau ${codes.size}, tổng ${sum}, còn lại trả ${JSON.stringify([...new Set(others)])}`);
    expect(ok.length).toBe(10);
    expect(codes.size).toBe(10);
    expect(sum).toBe(1_000_000n);
  });

  it('CHẶN: 20 phiếu hoàn 100 nghìn song song khi đã thu 1 tr → đúng 10 qua, số đã thu không âm', async () => {
    const R = await newOrg('dua-hoan');
    const c = await newContract(R, 1_000_000);
    await pay(R.owner, R.orgId, c.id, { method: 'CASH', amount: 1_000_000 }).expect(201);
    const res = await Promise.all(Array.from({ length: 20 }, () => pay(R.owner, R.orgId, c.id, { kind: 'REFUND', method: 'CASH', amount: 100_000 })));
    const ok = res.filter((r) => r.status === 201).length;
    const pr = await progress(R.owner, R.orgId, c.id);
    console.log(`[P-3] hoàn song song: qua ${ok}/20; paid sau cùng = ${pr.body.summary.paid}`);
    expect(ok).toBe(10);
    expect(pr.body.summary.paid).toBe(0);
  });

  it('CHẶN: 15 lệnh huỷ cùng một phiếu song song → đúng 1 qua, 1 dòng nhật ký', async () => {
    const R = await newOrg('dua-huy');
    const c = await newContract(R, 1_000_000);
    const p = await pay(R.owner, R.orgId, c.id, { method: 'CASH', amount: 500_000 }).expect(201);
    const res = await Promise.all(Array.from({ length: 15 }, () => voidP(R.owner, R.orgId, p.body.id)));
    const ok = res.filter((r) => r.status === 200).length;
    const logs = await deps.db.auditLog.count({ where: { entityId: p.body.id, action: 'payment.voided' } });
    console.log(`[P-3] huỷ song song: qua ${ok}/15, nhật ký huỷ ${logs}`);
    expect(ok).toBe(1);
    expect(logs).toBe(1);
  });

  it('CHẶN: song song "huỷ phiếu thu" và "huỷ phiếu hoàn" + thêm hoàn (10 vòng) → số đã thu không bao giờ âm', async () => {
    let negative = 0;
    for (let i = 0; i < 10; i++) {
      const R = await newOrg(`dua-tron-${i}`);
      const c = await newContract(R, 1_000_000);
      const rc = await pay(R.owner, R.orgId, c.id, { method: 'CASH', amount: 1_000_000 }).expect(201);
      const rf = await pay(R.owner, R.orgId, c.id, { kind: 'REFUND', method: 'CASH', amount: 300_000 }).expect(201);
      await Promise.all([
        voidP(R.owner, R.orgId, rc.body.id),
        voidP(R.owner, R.orgId, rf.body.id),
        pay(R.owner, R.orgId, c.id, { kind: 'REFUND', method: 'CASH', amount: 700_000 }),
      ]);
      const rows = await deps.db.payment.findMany({ where: { contractId: c.id, voidedAt: null } });
      const paid = rows.reduce((s, r) => s + (r.kind === 'RECEIPT' ? Number(r.amount) : -Number(r.amount)), 0);
      if (paid < 0) negative++;
    }
    console.log(`[P-3] vòng đua trộn có số đã thu âm: ${negative}/10`);
    expect(negative).toBe(0);
  });

  it('CHẶN: 20 phiếu song song rải trên 5 hợp đồng → 20 mã PT liên tục, không trùng, không hở', async () => {
    const R = await newOrg('dua-ma');
    const cs = await Promise.all(Array.from({ length: 5 }, () => newContract(R, 10_000_000)));
    const res = await Promise.all(Array.from({ length: 20 }, (_v, i) => pay(R.owner, R.orgId, (cs[i % 5] as { id: string }).id, { method: 'CASH', amount: 1_000 })));
    const codes = res.map((r) => r.body.code as string).sort();
    const expected = Array.from({ length: 20 }, (_v, i) => `PT-${String(i + 1).padStart(6, '0')}`);
    console.log(`[P-3] mã PT: ${res.filter((r) => r.status === 201).length}/20 qua, khớp dãy 1..20: ${JSON.stringify(codes) === JSON.stringify(expected)}`);
    expect(codes).toEqual(expected);
  });
});

describe('P-4 báo cáo: phiếu huỷ, hợp đồng nháp, giờ Việt Nam', () => {
  it('phiếu huỷ không tính; hợp đồng nháp không vào doanh số nhưng tiền thu của nó VÀO "đã thu thực tế"; phiếu 00:30 giờ VN ngày 1/9 vào tháng 9', async () => {
    const R = await newOrg('bao-cao');
    const draft = await newContract(R, 2_000_000);
    const conf = await newContract(R, 3_000_000, 1_000_000);
    await setStatus(R, conf.id, 'CONFIRMED');
    // Phiếu ngày cũ: tháng 8/2026 theo UTC nhưng đã sang 1/9 theo giờ VN.
    const edge = '2026-08-31T17:30:00Z'; // = 01/09/2026 00:30 giờ VN
    const pEdge = await pay(R.owner, R.orgId, conf.id, { method: 'CASH', amount: 700_000, receivedAt: edge });
    const pDraft = await pay(R.owner, R.orgId, draft.id, { method: 'CASH', amount: 500_000, receivedAt: '2026-09-10T10:00:00+07:00' });
    const pVoid = await pay(R.owner, R.orgId, conf.id, { method: 'CASH', amount: 111_000, receivedAt: '2026-09-11T10:00:00+07:00' });
    await voidP(R.owner, R.orgId, pVoid.body.id).expect(200);
    expect([pEdge.status, pDraft.status, pVoid.status]).toEqual([201, 201, 201]);
    const rep = await report(R, { from: '2026-08-01T00:00:00+07:00', to: '2026-10-01T00:00:00+07:00' });
    const m = Object.fromEntries((rep.body.rows as { period: string; collected: number }[]).map((r) => [r.period, r.collected]));
    console.log(`[P-4] đã thu theo tháng: ${JSON.stringify(m)}; tổng đã thu ${rep.body.totals.collected}; doanh số (chỉ xác nhận trong kỳ) ${rep.body.totals.sales}`);
    expect(m['2026-08']).toBe(0);
    expect(m['2026-09']).toBe(1_200_000); // 700k (mốc giờ VN) + 500k của hợp đồng NHÁP; 111k đã huỷ không tính
    // Hợp đồng conf xác nhận hôm nay (ngoài kỳ 8–9) → doanh số kỳ này 0.
    expect(rep.body.totals.sales).toBe(0);
    const led = await ledger(R, { from: '2026-09-01T00:00:00+07:00', to: '2026-10-01T00:00:00+07:00' });
    console.log(`[P-4] sổ thu tháng 9: tổng thu ${led.body.totals.received}, số phiếu hiện ${led.body.items.length} (gồm cả phiếu huỷ để đối soát)`);
    expect(led.body.totals.received).toBe(1_200_000);
    expect(led.body.items.length).toBe(3);
  });

  it('GHI NHẬN: phiếu thu ghi lùi ngày tuỳ ý (năm 1990, trước cả khi lập hợp đồng) → được; số "đã thu" của kỳ đã qua đổi theo', async () => {
    const R = await newOrg('lui-ngay');
    const c = await newContract(R, 1_000_000);
    const old = await pay(R.owner, R.orgId, c.id, { method: 'CASH', amount: 100_000, receivedAt: '1990-01-01T08:00:00+07:00' });
    const lastMonth = await pay(R.owner, R.orgId, c.id, { method: 'CASH', amount: 200_000, receivedAt: new Date(Date.now() - 40 * 86_400_000).toISOString() });
    console.log(`[P-4] lùi về 1990 → ${old.status}; lùi 40 ngày → ${lastMonth.status}`);
    expect(old.status).toBe(201);
    expect(lastMonth.status).toBe(201);
  });

  it('CHẶN: hợp đồng đã xác nhận rồi HUỶ → ra khỏi doanh số; tiền đã thu vẫn trong "đã thu"; theo hợp đồng thì remaining = null', async () => {
    const R = await newOrg('huy-hd');
    const c = await newContract(R, 4_000_000);
    await setStatus(R, c.id, 'CONFIRMED');
    await pay(R.owner, R.orgId, c.id, { method: 'CASH', amount: 1_000_000 }).expect(201);
    await setStatus(R, c.id, 'CANCELLED');
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 86_400_000).toISOString();
    const byMonth = await report(R, { from, to });
    const byContract = await report(R, { from, to, groupBy: 'contract' });
    console.log(`[P-4] HĐ huỷ: doanh số ${byMonth.body.totals.sales}, đã thu ${byMonth.body.totals.collected}, dòng HĐ remaining=${byContract.body.rows[0]?.remaining}`);
    expect(byMonth.body.totals.sales).toBe(0);
    expect(byMonth.body.totals.collected).toBe(1_000_000);
    expect(byContract.body.rows[0].remaining).toBeNull();
  });
});

describe('P-5 cách ly tổ chức', () => {
  it('CHẶN: chủ B dùng mã hợp đồng/phiếu của A ở đường, thân và tham số lọc → phản hồi GIỐNG HỆT mã bịa (5/5 cặp)', async () => {
    const c = await newContract(A, 1_000_000);
    const p = await pay(A.owner, A.orgId, c.id, { method: 'CASH', amount: 100_000 }).expect(201);
    const fake = randomUUID();
    const strip = (r: request.Response) => JSON.stringify({ s: r.status, c: r.body?.error?.code, m: r.body?.error?.message, d: r.body?.error?.details });
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 86_400_000).toISOString();
    const pairs: [request.Response, request.Response][] = [
      [await progress(B.owner, B.orgId, c.id), await progress(B.owner, B.orgId, fake)],
      [await pay(B.owner, B.orgId, c.id, { method: 'CASH', amount: 1 }), await pay(B.owner, B.orgId, fake, { method: 'CASH', amount: 1 })],
      [await voidP(B.owner, B.orgId, p.body.id), await voidP(B.owner, B.orgId, fake)],
      [await ledger(B, { from, to, contractId: c.id }), await ledger(B, { from, to, contractId: fake })],
      [
        await request(app).put(api(B.orgId, `/contracts/${c.id}/installments`)).set(bearer(B.owner)).send({ installments: [] }),
        await request(app).put(api(B.orgId, `/contracts/${fake}/installments`)).set(bearer(B.owner)).send({ installments: [] }),
      ],
    ];
    const same = pairs.filter(([a, b]) => strip(a) === strip(b) && a.status === 404).length;
    console.log(`[P-5] cặp (mã thật của A, mã bịa) giống hệt và 404: ${same}/${pairs.length}`);
    expect(same).toBe(pairs.length);
    const after = await deps.db.payment.findUniqueOrThrow({ where: { id: p.body.id } });
    expect(after.voidedAt).toBeNull();
  });

  it('GHI NHẬN: vai trò tự tạo chỉ có payments.read (không có customers.read) vẫn thấy tên + số điện thoại khách qua tiến độ thu tiền', async () => {
    const c = await newContract(A, 1_000_000);
    const thuNgan = await registerUser(app, 'c2-tt-thungan');
    await request(app).post(api(A.orgId, '/roles')).set(bearer(A.owner)).send({ key: 'thu_ngan', name: 'Thu ngân', permissions: ['org.read', 'payments.read'] }).expect(201);
    await addMember(app, A.owner, A.orgId, thuNgan, ['thu_ngan']);
    const r = await progress(thuNgan, A.orgId, c.id);
    const cust = await request(app).get(api(A.orgId, '/customers')).set(bearer(thuNgan));
    console.log(`[P-5] thu ngân xem danh sách khách → ${cust.status}; xem tiến độ → ${r.status}, SĐT khách lộ ra: ${r.body?.contract?.customer?.phone ?? 'không có'}`);
    expect(cust.status).toBe(403);
    expect(r.body.contract.customer.phone).toBe('0912345678');
  });
});

describe('P-6 nhật ký trước → sau', () => {
  it('CHẶN: ghi phiếu, huỷ phiếu, thay tiến độ đều có trước → sau; hoàn tiền có kind REFUND', async () => {
    const c = await newContract(A, 1_000_000);
    const p = await pay(A.owner, A.orgId, c.id, { method: 'BANK_TRANSFER', amount: 400_000, note: 'CK' }).expect(201);
    const rf = await pay(A.owner, A.orgId, c.id, { kind: 'REFUND', method: 'CASH', amount: 100_000 }).expect(201);
    await voidP(A.owner, A.orgId, rf.body.id, 'Hoàn nhầm').expect(200);
    const d = new Date(Date.now() + 86_400_000).toISOString();
    await request(app).put(api(A.orgId, `/contracts/${c.id}/installments`)).set(bearer(A.owner)).send({ installments: [{ name: 'Một đợt', dueDate: d, amount: 1_000_000 }] }).expect(200);
    const logs = await deps.db.auditLog.findMany({ where: { organizationId: A.orgId, OR: [{ entityId: { in: [p.body.id, rf.body.id] } }, { entityId: c.id, action: 'payment.installments_replaced' }] } });
    const has = (action: string, pred: (d: Record<string, unknown>) => boolean) => logs.some((l) => l.action === action && pred(l.data as Record<string, unknown>));
    const checks = [
      has('payment.created', (d) => (d.before as { paid: number }).paid === 0 && (d.after as { paid: number }).paid === 400_000 && d.method === 'BANK_TRANSFER'),
      has('payment.created', (d) => d.kind === 'REFUND' && (d.after as { paid: number }).paid === 300_000),
      has('payment.voided', (d) => d.reason === 'Hoàn nhầm' && (d.before as { paid: number }).paid === 300_000 && (d.after as { paid: number }).paid === 400_000),
      has('payment.installments_replaced', (d) => Array.isArray(d.before) && (d.before as unknown[]).length === 0 && (d.after as { amount: number }[])[0]?.amount === 1_000_000),
    ];
    console.log(`[P-6] nhật ký đủ trước → sau: ${checks.filter(Boolean).length}/${checks.length}`);
    expect(checks.every(Boolean)).toBe(true);
  });
});
