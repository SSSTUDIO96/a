// BÁO CÁO DOANH THU THEO LOẠI HỢP ĐỒNG / NHÓM KHOÁ / KHOÁ (gói M7) — BAN-VE-C3-DAO-TAO mục 1.5.
// GET /reports/revenue nhận thêm kind ('SERVICE' | 'COURSE') và groupBy 'kind' | 'courseGroup' | 'course' (giữ 'month', 'contract').
// Định nghĩa giữ nguyên (doanh số theo confirmed_at; đã thu = phiếu trong kỳ). Phép kiểm chính, TỪNG ĐỒNG:
//  (1) tổng(kind=SERVICE) + tổng(kind=COURSE) = tổng(không lọc), ở mọi trường tiền và số hợp đồng;
//  (2) cộng các dòng của mọi cách nhóm = tổng; tổng giống nhau ở mọi cách nhóm;
//  (3) tổng khớp với số tính ĐỘC LẬP từ bảng contracts + payments (prisma, không qua câu SQL của báo cáo);
//  (4) hợp đồng nhiều khoá chia theo thành tiền dòng khoá học (số tính tay), dòng đã huỷ không nhận tiền;
//  (5) không N+1: số câu SQL của một yêu cầu không đổi khi số hợp đồng / khoá tăng.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { splitByWeight } from '../src/modules/payments/reports';
import { bearer, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const base = makeDeps();
const db = new PrismaClient({ datasources: { db: { url: base.env.DATABASE_URL } }, log: [{ emit: 'event', level: 'query' }] });
const queries: string[] = [];
db.$on('query', (e) => queries.push(e.query));
const deps = { ...base, db };
let app: App;

afterAll(async () => {
  await db.$disconnect();
});

const idem = () => `bc-${randomUUID()}`;
const DAY = 24 * 60 * 60 * 1000;
const url = (orgId: string, rest: string) => `/api/v1/orgs/${orgId}${rest}`;
const MONEY = ['sales', 'depositRequired', 'depositOutstanding', 'outstanding', 'received', 'refunded', 'collected'] as const;
type Totals = Record<(typeof MONEY)[number] | 'contractCount', number>;

interface Academy {
  orgId: string;
  owner: TestUser;
}

async function academy(label: string): Promise<Academy> {
  const owner = await registerUser(app, `bc-${label}`);
  const res = await request(app)
    .post('/api/v1/orgs')
    .set(bearer(owner))
    .send({ name: `Học viện ${label}`, slug: `bc-${label}-${randomUUID().slice(0, 8)}`, kind: 'ACADEMY' })
    .expect(201);
  const orgId = res.body.id as string;
  const plan = await db.subscriptionPlan.create({ data: { code: `bc_${randomUUID().slice(0, 8)}`, name: 'Gói BC', priceMonthly: 0n, features: [] } });
  await db.organizationSubscription.create({ data: { organizationId: orgId, planId: plan.id, startsAt: new Date(Date.now() - 60_000), endsAt: null, status: 'ACTIVE' } });
  return { orgId, owner };
}

async function group(a: Academy, name: string, sortOrder: number) {
  return db.courseGroup.create({ data: { organizationId: a.orgId, name, sortOrder } });
}

async function course(a: Academy, name: string, fee: bigint, groupId: string | null, sortOrder = 0) {
  const co = await db.course.create({
    data: { organizationId: a.orgId, groupId, code: `KH-${randomUUID().slice(0, 6)}`, name, mode: 'MULTI_CLASS', tuitionFee: fee, defaultCapacity: 50, sortOrder, createdById: a.owner.id },
  });
  const cls = await db.courseClass.create({
    data: { organizationId: a.orgId, courseId: co.id, name: `${name} K1`, startDate: new Date('2027-01-04'), endDate: new Date('2027-03-04'), weekdays: [2, 4], capacity: 50, createdById: a.owner.id },
  });
  return { ...co, classId: cls.id };
}

async function contract(a: Academy, body: object) {
  const res = await request(app).post(url(a.orgId, '/contracts')).set(bearer(a.owner)).set('idempotency-key', idem()).send(body);
  if (res.status !== 201) throw new Error(`Tạo hợp đồng thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as { id: string; code: string };
}

async function customer(a: Academy, name: string) {
  return (await db.customer.create({ data: { organizationId: a.orgId, fullName: name } })).id;
}

async function status(a: Academy, id: string, to: 'CONFIRMED' | 'CANCELLED') {
  const res = await request(app)
    .post(url(a.orgId, `/contracts/${id}/status`))
    .set(bearer(a.owner))
    .send(to === 'CANCELLED' ? { to, reason: 'Khách huỷ' } : { to });
  if (res.status !== 200) throw new Error(`Đổi trạng thái thất bại ${res.status}: ${JSON.stringify(res.body)}`);
}

async function pay(a: Academy, id: string, amount: number, kind: 'RECEIPT' | 'REFUND' = 'RECEIPT') {
  const res = await request(app)
    .post(url(a.orgId, `/contracts/${id}/payments`))
    .set(bearer(a.owner))
    .set('idempotency-key', idem())
    .send({ kind, method: 'BANK_TRANSFER', amount });
  if (res.status !== 201) throw new Error(`Ghi phiếu thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as { id: string };
}

const courseLine = (classId: string) => ({ kind: 'COURSE', courseClassId: classId });
const custom = (name: string, unitPrice: number) => ({ kind: 'CUSTOM', name, unitPrice, quantity: 1 });

function report(a: Academy, q: Record<string, string>) {
  return request(app).get(url(a.orgId, '/reports/revenue')).query(q).set(bearer(a.owner));
}

// Số tính ĐỘC LẬP từ bảng (không qua SQL của báo cáo).
async function expectedTotals(orgId: string, from: Date, to: Date, kind?: 'SERVICE' | 'COURSE'): Promise<Totals> {
  const contracts = await db.contract.findMany({ where: { organizationId: orgId, ...(kind ? { kind } : {}) }, select: { id: true, status: true, confirmedAt: true, total: true, depositRequired: true } });
  const ids = new Set(contracts.map((c) => c.id));
  const payments = (await db.payment.findMany({ where: { organizationId: orgId, voidedAt: null } })).filter((p) => ids.has(p.contractId));
  const signed = (p: (typeof payments)[number]) => (p.kind === 'RECEIPT' ? p.amount : -p.amount);
  const booked = contracts.filter((c) => (c.status === 'CONFIRMED' || c.status === 'COMPLETED') && c.confirmedAt && c.confirmedAt >= from && c.confirmedAt < to);
  let sales = 0n;
  let dep = 0n;
  let depOut = 0n;
  let paid = 0n;
  for (const c of booked) {
    const p = payments.filter((x) => x.contractId === c.id).reduce((s, x) => s + signed(x), 0n);
    sales += c.total;
    dep += c.depositRequired;
    paid += p;
    depOut += c.depositRequired - p > 0n ? c.depositRequired - p : 0n;
  }
  const inPeriod = payments.filter((p) => p.receivedAt >= from && p.receivedAt < to);
  const received = inPeriod.filter((p) => p.kind === 'RECEIPT').reduce((s, p) => s + p.amount, 0n);
  const refunded = inPeriod.filter((p) => p.kind === 'REFUND').reduce((s, p) => s + p.amount, 0n);
  return {
    contractCount: booked.length,
    sales: Number(sales),
    depositRequired: Number(dep),
    depositOutstanding: Number(depOut),
    outstanding: Number(sales - paid),
    received: Number(received),
    refunded: Number(refunded),
    collected: Number(received - refunded),
  };
}

const sum = (rows: Record<string, unknown>[], k: string) => rows.reduce((s, r) => s + Number(r[k]), 0);

let A: Academy;
let K: Record<'k1' | 'k2' | 'k3' | 'k4', Awaited<ReturnType<typeof course>>>;
let G: Record<'g1' | 'g2', { id: string; name: string }>;
let from: string;
let to: string;

beforeAll(async () => {
  app = makeApp(deps);
  A = await academy('loai');
  G = { g1: await group(A, 'Trang điểm', 0), g2: await group(A, 'Làm tóc', 1) };
  K = {
    k1: await course(A, 'Makeup cá nhân', 7_000_001n, G.g1.id, 0),
    k2: await course(A, 'Makeup cô dâu', 3_333_333n, G.g1.id, 1),
    k3: await course(A, 'Búi tóc', 6_666_667n, G.g2.id, 0),
    k4: await course(A, 'Nối mi', 2_500_000n, null, 0),
  };
  // C1: một khoá + giáo trình, đã xác nhận, thu lẻ.
  const c1 = await contract(A, { kind: 'COURSE', customerId: await customer(A, 'HV 1'), depositRequired: 2_000_000, lines: [courseLine(K.k1.classId), custom('Giáo trình', 333_333)] });
  await status(A, c1.id, 'CONFIRMED');
  await pay(A, c1.id, 1_500_001);
  // C2: hai khoá khác nhóm (K2 trong G1, K3 trong G2), giảm 1.000.001 → chia 3.333.333 : 6.666.667 (tính tay ở dưới).
  const c2 = await contract(A, { kind: 'COURSE', customerId: await customer(A, 'HV 2'), discount: 1_000_001, depositRequired: 1_234_567, lines: [courseLine(K.k2.classId), courseLine(K.k3.classId)] });
  await status(A, c2.id, 'CONFIRMED');
  await pay(A, c2.id, 777_777);
  await pay(A, c2.id, 111_111, 'REFUND');
  // C3: khoá chưa xếp nhóm.
  const c3 = await contract(A, { kind: 'COURSE', customerId: await customer(A, 'HV 3'), lines: [courseLine(K.k4.classId)] });
  await status(A, c3.id, 'CONFIRMED');
  await pay(A, c3.id, 2_500_000);
  // C4: hợp đồng khoá học chỉ có dòng tự nhập → không chia được cho khoá nào.
  const c4 = await contract(A, { kind: 'COURSE', customerId: await customer(A, 'HV 4'), lines: [custom('Bộ cọ', 1_111_111)] });
  await status(A, c4.id, 'CONFIRMED');
  // C5: nháp có tiền trong kỳ (vào "đã thu", không vào doanh số).
  const c5 = await contract(A, { kind: 'COURSE', customerId: await customer(A, 'HV 5'), lines: [courseLine(K.k3.classId)] });
  await pay(A, c5.id, 300_003);
  // C6: K1 + K4, xác nhận rồi HUỶ dòng K4 → K4 không nhận tiền của C6.
  const c6 = await contract(A, { kind: 'COURSE', customerId: await customer(A, 'HV 6'), lines: [courseLine(K.k1.classId), courseLine(K.k4.classId)] });
  await status(A, c6.id, 'CONFIRMED');
  const k4Line = await db.contractLine.findFirstOrThrow({ where: { contractId: c6.id, courseClassId: K.k4.classId } });
  await request(app).post(url(A.orgId, `/contracts/${c6.id}/lines/${k4Line.id}/void`)).set(bearer(A.owner)).send({ reason: 'Học viên bỏ khoá nối mi' }).expect(200);
  await pay(A, c6.id, 999_999);
  // C7: khoá học huỷ sau khi thu, có hoàn.
  const c7 = await contract(A, { kind: 'COURSE', customerId: await customer(A, 'HV 7'), lines: [courseLine(K.k2.classId)] });
  await status(A, c7.id, 'CONFIRMED');
  await pay(A, c7.id, 1_000_000);
  await status(A, c7.id, 'CANCELLED');
  await pay(A, c7.id, 400_000, 'REFUND');
  // Dịch vụ: S1 xác nhận, S2 nháp có cọc.
  const s1 = await contract(A, { newCustomer: { fullName: 'Cô dâu' }, depositRequired: 3_000_000, lines: [custom('Gói cưới', 10_000_003)] });
  await status(A, s1.id, 'CONFIRMED');
  await pay(A, s1.id, 2_222_222);
  const s2 = await contract(A, { newCustomer: { fullName: 'Khách lẻ' }, lines: [custom('Makeup dự tiệc', 800_000)] });
  await pay(A, s2.id, 200_000);
  from = new Date(Date.now() - DAY).toISOString();
  to = new Date(Date.now() + DAY).toISOString();
});

describe('báo cáo doanh thu theo loại hợp đồng / nhóm khoá / khoá', () => {
  it('tách khoá học / dịch vụ CỘNG LẠI BẰNG TỔNG từng đồng; tổng khớp số tính độc lập; mọi cách nhóm cùng tổng', async () => {
    const totalsOf: Record<string, Totals> = {};
    for (const kind of [undefined, 'SERVICE', 'COURSE'] as const) {
      const expected = await expectedTotals(A.orgId, new Date(from), new Date(to), kind);
      for (const groupBy of ['month', 'contract', 'kind', 'courseGroup', 'course']) {
        const res = await report(A, { from, to, groupBy, ...(kind ? { kind } : {}) });
        expect(res.status, `${groupBy}/${kind}: ${JSON.stringify(res.body)}`).toBe(200);
        const body = res.body;
        expect(body.kind).toBe(kind ?? null);
        expect(body.totals, `${groupBy}/${kind ?? 'tất cả'}`).toEqual(expected);
        expect(body.totalsOverflow).toBe(false);
        expect(JSON.stringify(body)).not.toMatch(/lợi nhuận/i);
        if (groupBy === 'contract') {
          expect(sum(body.rows, 'paidInPeriod')).toBe(expected.collected);
          expect(body.rows.every((r: { kind: string }) => !kind || r.kind === kind)).toBe(true);
        } else {
          for (const k of MONEY) expect(sum(body.rows, k), `${groupBy}/${kind ?? 'tất cả'}: cộng dòng ${k}`).toBe(expected[k]);
        }
        if (groupBy === 'month' || groupBy === 'kind') expect(sum(body.rows, 'contractCount')).toBe(expected.contractCount);
      }
      totalsOf[kind ?? 'ALL'] = expected;
    }
    const all = totalsOf.ALL as Totals;
    const svc = totalsOf.SERVICE as Totals;
    const crs = totalsOf.COURSE as Totals;
    for (const k of [...MONEY, 'contractCount'] as const) expect(svc[k] + crs[k], `dịch vụ + khoá học = tổng: ${k}`).toBe(all[k]);
    console.log(
      `[báo cáo theo loại] doanh số: dịch vụ ${svc.sales} + khoá học ${crs.sales} = ${svc.sales + crs.sales} / tổng ${all.sales}; ` +
        `đã thu: ${svc.collected} + ${crs.collected} = ${svc.collected + crs.collected} / ${all.collected}; ` +
        `còn lại: ${svc.outstanding} + ${crs.outstanding} = ${svc.outstanding + crs.outstanding} / ${all.outstanding}`,
    );
    // Số tính tay (đề bài) — không chỉ "khớp chính mình".
    expect(svc.sales).toBe(10_000_003);
    expect(crs.sales).toBe(7_333_334 + 8_999_999 + 2_500_000 + 1_111_111 + 7_000_001);
    expect(crs.collected).toBe(1_500_001 + 777_777 - 111_111 + 2_500_000 + 300_003 + 999_999 + 1_000_000 - 400_000);
  });

  it('nhóm theo loại: luôn đủ 2 dòng SERVICE, COURSE (lọc kind thì chỉ dòng đó)', async () => {
    const all = (await report(A, { from, to, groupBy: 'kind' }).expect(200)).body;
    expect(all.rows.map((r: { kind: string }) => r.kind)).toEqual(['SERVICE', 'COURSE']);
    expect(all.rows[0]).toMatchObject({ contractCount: 1, sales: 10_000_003, received: 2_422_222 });
    const only = (await report(A, { from, to, groupBy: 'kind', kind: 'COURSE' }).expect(200)).body;
    expect(only.rows.map((r: { kind: string }) => r.kind)).toEqual(['COURSE']);
  });

  it('nhóm theo khoá: hợp đồng nhiều khoá chia theo thành tiền (tính tay), dòng đã huỷ không nhận tiền, khoá học không còn dòng khoá → COURSE_UNASSIGNED', async () => {
    const body = (await report(A, { from, to, groupBy: 'course' }).expect(200)).body;
    type Row = { segment: string; course: { id: string; name: string } | null; group: { id: string } | null } & Totals;
    const rows = body.rows as Row[];
    const of = (id: string) => rows.find((r) => r.course?.id === id) as Row;
    console.log(`[báo cáo theo khoá] ${rows.map((r) => `${r.segment}:${r.course?.name ?? '-'}=${r.sales}`).join('; ')}`);
    expect(body.allocation).toMatch(/chia cho các khoá theo thành tiền/);
    // Thứ tự: nhóm (sort) → khoá (sort), chưa xếp nhóm sau cùng, rồi COURSE_UNASSIGNED, SERVICE.
    expect(rows.map((r) => r.course?.id ?? r.segment)).toEqual([K.k1.id, K.k2.id, K.k3.id, K.k4.id, 'COURSE_UNASSIGNED', 'SERVICE']);
    // C2 (tính tay bằng phân số đúng): 8.999.999 đ chia 3.333.333 : 6.666.667 → K2 2.999.999,367; K3 5.999.999,633 →
    // phần nguyên 2.999.999 + 5.999.999, dư 1 đ về phần lẻ lớn hơn (K3) → K2 2.999.999, K3 6.000.000.
    // Cọc 1.234.567 → K2 411.522,29 → 411.522; K3 823.044,71 → 823.045.
    expect(of(K.k3.id)).toMatchObject({ contractCount: 1, sales: 6_000_000, depositRequired: 823_045, group: { id: G.g2.id } });
    // K2 = phần của C2 (C7 đã huỷ: không doanh số, chỉ có tiền thu/hoàn trong kỳ).
    expect(of(K.k2.id)).toMatchObject({ contractCount: 1, sales: 2_999_999, depositRequired: 411_522, received: 259_259 + 1_000_000, refunded: 37_037 + 400_000 });
    // K4: chỉ C3 (dòng K4 của C6 đã huỷ — không nhận tiền).
    expect(of(K.k4.id)).toMatchObject({ contractCount: 1, sales: 2_500_000, received: 2_500_000, group: null });
    // K1: C1 (7.333.334 gồm giáo trình) + C6 (7.000.001 sau khi huỷ dòng K4).
    expect(of(K.k1.id)).toMatchObject({ contractCount: 2, sales: 7_333_334 + 7_000_001, received: 1_500_001 + 999_999 });
    expect(rows.find((r) => r.segment === 'COURSE_UNASSIGNED')).toMatchObject({ course: null, contractCount: 1, sales: 1_111_111 });
    // Dòng thu của C2 cũng chia đúng tỷ lệ: 777.777 → 259.258,97 + 518.518,03 → 259.259 + 518.518;
    // hoàn 111.111 → 37.036,996 + 74.074,004 → 37.037 + 74.074.
    expect(of(K.k3.id)).toMatchObject({ received: 518_518 + 300_003, refunded: 74_074 });
  });

  it('nhóm theo nhóm khoá: Trang điểm → Làm tóc → Chưa xếp nhóm (group null) → COURSE_UNASSIGNED → SERVICE; cộng bằng tổng', async () => {
    const body = (await report(A, { from, to, groupBy: 'courseGroup', kind: 'COURSE' }).expect(200)).body;
    const rows = body.rows as ({ segment: string; group: { id: string; name: string } | null } & Totals)[];
    expect(rows.map((r) => `${r.segment}:${r.group?.name ?? '-'}`)).toEqual(['COURSE:Trang điểm', 'COURSE:Làm tóc', 'COURSE:-', 'COURSE_UNASSIGNED:-']);
    expect(rows[0]).toMatchObject({ sales: 7_333_334 + 7_000_001 + 2_999_999, contractCount: 3 });
    expect(rows[1]).toMatchObject({ sales: 6_000_000, contractCount: 1 });
    expect(rows.some((r) => 'course' in r)).toBe(false);
  });

  it('chia theo trọng số: tổng các phần đúng bằng số chia, phần lệch tỷ lệ chính xác < 1 đ; trọng số 0 → chia đều', () => {
    let worst = 0;
    for (let i = 0; i < 2000; i++) {
      const amount = BigInt(Math.floor(Math.random() * 2e11)) - (i % 7 === 0 ? 100_000_000_000n : 0n);
      const weights = Array.from({ length: 1 + (i % 5) }, () => BigInt(Math.floor(Math.random() * 1e10)));
      const parts = splitByWeight(amount, weights);
      expect(parts.reduce((s, p) => s + p, 0n)).toBe(amount);
      const W = weights.reduce((s, w) => s + w, 0n);
      parts.forEach((p, j) => {
        const exact = W > 0n ? (Number(amount) * Number(weights[j])) / Number(W) : Number(amount) / weights.length;
        worst = Math.max(worst, Math.abs(Number(p) - exact));
      });
    }
    console.log(`[chia theo trọng số] 2000 lần ngẫu nhiên: tổng khớp 2000/2000; lệch tỷ lệ lớn nhất ${worst.toFixed(4)} đ`);
    expect(worst).toBeLessThan(1.001);
    expect(splitByWeight(10n, [0n, 0n, 0n])).toEqual([4n, 3n, 3n]);
    expect(splitByWeight(8_999_999n, [3_333_333n, 6_666_667n])).toEqual([2_999_999n, 6_000_000n]);
  });

  it('kind / groupBy lạ → 400', async () => {
    expect((await report(A, { from, to, kind: 'KHAC' })).status).toBe(400);
    expect((await report(A, { from, to, groupBy: 'teacher' })).status).toBe(400);
    expect((await report(A, { from, to, groupBy: 'kind', kind: 'service' })).status).toBe(400);
  });

  it('không N+1: số câu SQL của groupBy=course / courseGroup / kind / contract không đổi khi có 1 hay 12 hợp đồng khoá học (6 khoá)', async () => {
    const small = await academy('n1-it');
    const big = await academy('n1-nhieu');
    const g = await group(big, 'Nhóm 1', 0);
    const sc = await course(small, 'Khoá nhỏ', 1_000_000n, null);
    await status(small, (await contract(small, { kind: 'COURSE', customerId: await customer(small, 'HV'), lines: [courseLine(sc.classId)] })).id, 'CONFIRMED');
    const bigCourses = [];
    for (let i = 0; i < 6; i++) bigCourses.push(await course(big, `Khoá ${i}`, BigInt(1_000_000 + i), i % 2 ? g.id : null, i));
    for (let i = 0; i < 12; i++) {
      const lines = [courseLine((bigCourses[i % 6] as { classId: string }).classId), courseLine((bigCourses[(i + 1) % 6] as { classId: string }).classId)];
      const c = await contract(big, { kind: 'COURSE', customerId: await customer(big, `HV ${i}`), lines });
      await status(big, c.id, 'CONFIRMED');
      await pay(big, c.id, 100_000 + i);
    }
    const measure = async (a: Academy, groupBy: string) => {
      queries.length = 0;
      const res = await report(a, { from, to: new Date(Date.now() + DAY).toISOString(), groupBy });
      expect(res.status).toBe(200);
      return { n: queries.length, rows: res.body.rows.length as number };
    };
    const lines: string[] = [];
    for (const groupBy of ['course', 'courseGroup', 'kind', 'contract', 'month']) {
      const s = await measure(small, groupBy);
      const b = await measure(big, groupBy);
      lines.push(`${groupBy}: ${s.n} câu (${s.rows} dòng) / ${b.n} câu (${b.rows} dòng)`);
      expect(b.n, groupBy).toBe(s.n);
    }
    console.log(`[đo N+1] 1 hợp đồng / 12 hợp đồng: ${lines.join('; ')}`);
  });
});
