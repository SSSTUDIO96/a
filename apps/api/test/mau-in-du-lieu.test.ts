// Bản vẽ G mục 3.3 đường 5 (GET …/print-data), 3.4 "Dựng dữ liệu", 5.1 (gói G-M4) + đính chính 25/10/2026 mục 5.
// - Dữ liệu in là bản chụp đúng ContractPrintData; tiền là số nguyên lấy từ cột database (Σ lineTotal các dòng in =
//   money.subtotal = contracts.subtotal; total = subtotal − discount); dòng huỷ không có mặt; tiền bằng chữ.
// - Phụ phí (đính chính 5): dòng con SURCHARGE chưa huỷ (tự thêm theo luật) nằm ở surcharges của dòng gốc — tên + số lượng
//   + tiền đúng lineTotal máy chủ, KHÔNG mang tên luật / ghi chú; ca phù dâu × 2 → phụ phí × 2; hợp đồng nhiều ngày có date.
// - Thu tiền: paid = thu − hoàn chưa huỷ; Σ paid các đợt = min(đã thu, Σ đợt); trạng thái đợt PAID / PARTIAL / UNPAID.
// - Điều khoản: nháp = mẫu bản mới nhất (snapshot false); đã xác nhận rồi sửa mẫu → vẫn bản chụp cũ + bản cũ.
// - Khoá học: course (lớp, thứ, giờ, giảng viên, cơ sở) + rules (nội quy).
// - Che theo quyền: chỉ contracts.read → contactHidden + paymentsHidden, cả hai đúng null.
// - NO_PROFILE; có hồ sơ + logo → logoUrl. Hai GET cùng dataHash; thêm phiếu thu → dataHash đổi.
// - Mã hợp đồng của tổ chức khác → 404 giống hệt mã bịa.
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vndInWords, type ContractPrintData, type PrintLine, type PrintSubLine } from '@makeup/shared';
import { hashPrintData, stableJson } from '../src/modules/print/data';
import { addMember, bearer, createAcademyOrg, grantUnlimitedPlan, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';
import { makePng } from './png';

const deps = makeDeps();
const db = deps.db;
let app: App;

type Body = Record<string, unknown>;
interface PrintDataRes {
  contract: { id: string; code: string; kind: string; status: string; updatedAt: string };
  data: ContractPrintData;
  dataHash: string;
  logoUrl: string | null;
  logoUrlExpiresAt: string | null;
  templates: { id: string; defaultFor: string[] }[];
  defaultTemplateId: string | null;
  lastPrint: unknown;
  printCount: number;
  warnings: { code: string; message: string }[];
}

const idem = () => ({ 'idempotency-key': randomUUID() });
const errOf = (b: unknown) => (b as { error: { code: string; message: string; details?: Record<string, unknown> } }).error;
const noReq = (b: unknown) => JSON.stringify(b).replace(/"requestId":"[^"]+"/g, '');

async function post(u: TestUser, path: string, body: Body, want = 201) {
  const r = await request(app).post(`/api/v1${path}`).set(bearer(u)).set(idem()).send(body);
  expect(r.status, `${path}: ${JSON.stringify(r.body)}`).toBe(want);
  return r.body;
}
async function put(u: TestUser, path: string, body: Body) {
  const r = await request(app).put(`/api/v1${path}`).set(bearer(u)).send(body);
  expect(r.status, `${path}: ${JSON.stringify(r.body)}`).toBe(200);
  return r.body;
}
async function printData(u: TestUser, org: string, contractId: string): Promise<PrintDataRes> {
  const r = await request(app).get(`/api/v1/orgs/${org}/contracts/${contractId}/print-data`).set(bearer(u));
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as PrintDataRes;
}

// Mọi số trong dữ liệu in phải là số nguyên, trừ km (distanceKm, includedKm, excessKm, chargedKm, fromKm, toKm).
const KM_KEYS = new Set(['distanceKm', 'includedKm', 'excessKm', 'chargedKm', 'fromKm', 'toKm']);
function nonIntegerMoney(v: unknown, path = ''): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => nonIntegerMoney(x, `${path}[${i}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => (KM_KEYS.has(k) ? [] : nonIntegerMoney(x, `${path}.${k}`)));
  return typeof v === 'number' && !Number.isInteger(v) ? [path] : [];
}

const subTotal = (s: PrintSubLine[]) => s.reduce((a, x) => a + x.lineTotal, 0);
const printedSum = (lines: PrintLine[]) =>
  lines.reduce((a, l) => a + l.lineTotal + subTotal(l.addons) + subTotal(l.surcharges) + (l.travel?.lineTotal ?? 0), 0);

const DATA_KEYS = ['contract', 'customer', 'kind', 'lines', 'money', 'payments', 'paymentsHidden', 'rules', 'studio', 'terms', 'version'];
const LINE_KEYS = [
  'addedAfterConfirm', 'addedOn', 'addons', 'course', 'date', 'endTime', 'kind', 'lineDiscount', 'lineTotal', 'location', 'name',
  'note', 'quantity', 'staff', 'startTime', 'subjectName', 'surcharges', 'travel', 'unitPrice',
];
const SUB_KEYS = ['addedAfterConfirm', 'addedOn', 'lineDiscount', 'lineTotal', 'name', 'quantity', 'unitPrice'];

interface World {
  org: string;
  owner: TestUser;
  limited: TestUser; // chỉ contracts.read
  customer: string;
  pkg: string;
  main: string;
  addon: string;
  holiday: string;
  location: string;
  bridesmaid: string;
  bride: string;
  primary: string;
  assist: string;
  ruleName: string;
}

let w: World;

async function seedWorld(): Promise<World> {
  const owner = await registerUser(app, 'midl-chu');
  const org = await createAcademyOrg(app, owner, 'midl');
  await grantUnlimitedPlan(db, org);
  const tag = randomUUID().slice(0, 6);
  const price = (ref: { serviceId: string } | { packageId: string }, listPrice: bigint) =>
    db.priceVersion.create({ data: { organizationId: org, ...ref, listPrice, effectiveFrom: new Date(Date.now() - 60_000), createdById: owner.id } });
  const svc = async (code: string, name: string, kind: 'MAIN' | 'ADDON' | 'SURCHARGE', p: bigint) => {
    const s = await db.service.create({ data: { organizationId: org, code: `${code}-${tag}`, name, kind, durationMinutes: 60 } });
    await price({ serviceId: s.id }, p);
    return s.id;
  };
  const subjects = await db.makeupSubject.findMany({ where: { organizationId: org } });
  const subject = (n: string) => subjects.find((s) => s.name === n)!.id;
  const pk = await db.servicePackage.create({ data: { organizationId: org, code: `GOI-${tag}`, name: 'Gói cô dâu', durationMinutes: 120, subjectId: subject('Cô dâu') } });
  await price({ packageId: pk.id }, 3_000_000n);
  const early = await svc('SOM', 'Phụ phí ca sớm', 'SURCHARGE', 200_000n);
  const ruleName = `Luật bí mật ${tag}`;
  await post(owner, `/orgs/${org}/surcharge-rules`, { name: ruleName, serviceId: early, startTime: '04:00', endTime: '06:00' });
  const location = (await post(owner, `/orgs/${org}/studio-locations`, { name: 'Studio Phố Huế', address: 'Số 9 Phố Huế, Hà Nội' })).id as string;
  const customer = (await post(owner, `/orgs/${org}/customers`, { fullName: 'Nguyễn Thị Hoa', phone: '0912345678', email: 'hoa@thu.local' })).id as string;
  // Thợ: tên hiển thị studio đặt.
  const staffUser = async (label: string, display: string) => {
    const u = await registerUser(app, label);
    const m = await addMember(app, owner, org, u, ['artist']);
    const r = await request(app).patch(`/api/v1/orgs/${org}/staff/${m}`).set(bearer(owner)).send({ displayName: display });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return m;
  };
  const role = await post(owner, `/orgs/${org}/roles`, { key: 'chi_xem_hd', name: 'Chỉ xem hợp đồng', permissions: ['contracts.read'] });
  expect(role.id).toBeTruthy();
  const limited = await registerUser(app, 'midl-xem');
  await addMember(app, owner, org, limited, ['chi_xem_hd']);
  return {
    org,
    owner,
    limited,
    customer,
    pkg: pk.id,
    main: await svc('MK', 'Makeup tiệc', 'MAIN', 800_000n),
    addon: await svc('MI', 'Dán mi', 'ADDON', 100_000n),
    holiday: await svc('LE', 'Phụ phí ngày lễ', 'SURCHARGE', 500_000n),
    location,
    bridesmaid: subject('Phù dâu'),
    bride: subject('Cô dâu'),
    primary: await staffUser('midl-tho1', 'Thợ Lan'),
    assist: await staffUser('midl-tho2', 'Thợ Mai'),
    ruleName,
  };
}

// Hợp đồng dịch vụ đủ loại dòng: gói (studio, dịch vụ phụ, thợ chính + phụ, 05:00 ngày 10/11 → phụ phí ca sớm × 1),
// dịch vụ phù dâu × 2 (tại nhà, phí di chuyển, 05:30 ngày 11/11 → phụ phí ca sớm × 2), phụ phí ngày lễ nhập tay,
// một dòng tự do bị huỷ; giảm giá 100.000.
async function serviceContract(extra: Body = {}) {
  const c = await post(w.owner, `/orgs/${w.org}/contracts`, {
    customerId: w.customer,
    discount: 100_000,
    notes: 'Ghi chú hợp đồng',
    lines: [
      {
        kind: 'PACKAGE',
        packageId: w.pkg,
        quantity: 1,
        subjectId: w.bride,
        locationType: 'STUDIO',
        studioLocationId: w.location,
        scheduledStart: '2026-11-10T05:00:00+07:00',
        scheduledEnd: '2026-11-10T07:00:00+07:00',
        addons: [{ serviceId: w.addon, quantity: 1 }],
        staff: [
          { membershipId: w.primary, role: 'PRIMARY' },
          { membershipId: w.assist, role: 'ASSIST' },
        ],
      },
      {
        kind: 'SERVICE',
        serviceId: w.main,
        quantity: 2,
        subjectId: w.bridesmaid,
        locationType: 'CUSTOMER_HOME',
        address: 'Số 1 Tràng Tiền, Hà Nội',
        scheduledStart: '2026-11-11T05:30:00+07:00',
        scheduledEnd: '2026-11-11T06:30:00+07:00',
        travel: { mode: 'MANUAL', distanceKm: 12.5, amount: 150_000 },
      },
      { kind: 'SURCHARGE', serviceId: w.holiday, quantity: 1 },
      { kind: 'CUSTOM', name: 'Phụ kiện bị huỷ', unitPrice: 50_000, quantity: 1 },
    ],
    ...extra,
  });
  const custom = (c.lines as { id: string; name: string }[]).find((l) => l.name === 'Phụ kiện bị huỷ')!;
  await post(w.owner, `/orgs/${w.org}/contracts/${c.id}/lines/${custom.id}/void`, { reason: 'Khách không lấy' }, 200);
  return c.id as string;
}

beforeAll(async () => {
  app = makeApp(deps);
  w = await seedWorld();
});

afterAll(async () => {
  await db.$disconnect();
});

describe('dữ liệu in hợp đồng dịch vụ — tiền, dòng, phụ phí, nhiều ngày', () => {
  it('đúng khuôn ContractPrintData; Σ lineTotal dòng in = money.subtotal = contracts.subtotal; total = subtotal − discount; dòng huỷ vắng mặt', async () => {
    const id = await serviceContract();
    const r = await printData(w.owner, w.org, id);
    const d = r.data;
    const row = await db.contract.findUniqueOrThrow({ where: { id }, select: { subtotal: true, discount: true, total: true, depositRequired: true } });
    const sum = printedSum(d.lines);
    console.log(`[dữ liệu in] Σ dòng in ${sum} = subtotal ${d.money.subtotal} = cột ${row.subtotal}; total ${d.money.total}; dòng gốc ${d.lines.length}`);
    expect(Object.keys(d).sort()).toEqual(DATA_KEYS);
    expect(d.version).toBe(1);
    expect(d.kind).toBe('SERVICE');
    for (const l of d.lines) {
      expect(Object.keys(l).sort()).toEqual(LINE_KEYS);
      for (const s of [...l.addons, ...l.surcharges]) expect(Object.keys(s).sort()).toEqual(SUB_KEYS);
    }
    expect(sum).toBe(d.money.subtotal);
    expect(d.money.subtotal).toBe(Number(row.subtotal));
    expect(d.money.discount).toBe(100_000);
    expect(d.money.total).toBe(Number(row.total));
    expect(d.money.total).toBe(d.money.subtotal - d.money.discount);
    expect(d.money.depositRequired).toBe(Number(row.depositRequired));
    expect(d.money.totalInWords).toBe(vndInWords(d.money.total));
    expect(d.money.depositInWords).toBe(vndInWords(d.money.depositRequired));
    expect(d.money.travelTotal).toBe(150_000);
    expect(nonIntegerMoney(d)).toEqual([]);
    expect(d.lines.map((l) => l.kind)).toEqual(['PACKAGE', 'SERVICE', 'SURCHARGE']);
    expect(JSON.stringify(d)).not.toContain('Phụ kiện bị huỷ');
    expect(d.contract.notes).toBe('Ghi chú hợp đồng');
    expect(r.contract).toMatchObject({ id, kind: 'SERVICE', status: 'DRAFT' });
  });

  it('phù dâu × 2 + phụ phí × 2: dòng con SURCHARGE ở surcharges, tiền đúng lineTotal máy chủ, không tên luật / ghi chú; nhiều ngày có date + giờ', async () => {
    const id = await serviceContract();
    const d = (await printData(w.owner, w.org, id)).data;
    const [pkg, maid, manual] = d.lines as [PrintLine, PrintLine, PrintLine];
    const dbSur = await db.contractLine.findMany({
      where: { contractId: id, kind: 'SURCHARGE', parentLineId: { not: null }, voidedAt: null },
      select: { name: true, quantity: true, unitPrice: true, lineTotal: true, surchargeRuleName: true, parentLineId: true },
    });
    console.log(`[phụ phí] dòng con trong database: ${dbSur.map((s) => `${s.name} ×${s.quantity} = ${s.lineTotal}`).join('; ')}`);
    expect(maid).toMatchObject({ kind: 'SERVICE', subjectName: 'Phù dâu', quantity: 2, unitPrice: 800_000, lineTotal: 1_600_000 });
    expect(maid.surcharges).toEqual([
      { name: 'Phụ phí ca sớm', quantity: 2, unitPrice: 200_000, lineDiscount: 0, lineTotal: 400_000, addedAfterConfirm: false, addedOn: null },
    ]);
    expect(pkg.surcharges).toEqual([
      { name: 'Phụ phí ca sớm', quantity: 1, unitPrice: 200_000, lineDiscount: 0, lineTotal: 200_000, addedAfterConfirm: false, addedOn: null },
    ]);
    // Tiền phụ phí in = đúng cột line_total của database (không tính lại).
    expect([...pkg.surcharges, ...maid.surcharges].map((s) => s.lineTotal).sort()).toEqual(dbSur.map((s) => Number(s.lineTotal)).sort());
    expect(dbSur.every((s) => s.surchargeRuleName === w.ruleName)).toBe(true);
    expect(JSON.stringify(d)).not.toContain(w.ruleName);
    expect(JSON.stringify(d)).not.toContain('tự thêm theo luật');
    // Phụ phí nhập tay ở dòng gốc riêng.
    expect(manual).toMatchObject({ kind: 'SURCHARGE', name: 'Phụ phí ngày lễ', lineTotal: 500_000, surcharges: [], addons: [], travel: null });
    // Dịch vụ phụ, phí di chuyển, thợ, nơi làm.
    expect(pkg.addons).toEqual([{ name: 'Dán mi', quantity: 1, unitPrice: 100_000, lineDiscount: 0, lineTotal: 100_000, addedAfterConfirm: false, addedOn: null }]);
    expect(pkg.staff).toEqual({ primary: ['Thợ Lan'], assist: ['Thợ Mai'] });
    expect(pkg.location).toEqual({ type: 'STUDIO', text: 'Studio Phố Huế — Số 9 Phố Huế, Hà Nội' });
    expect(maid.location).toEqual({ type: 'CUSTOMER_HOME', text: 'Số 1 Tràng Tiền, Hà Nội' });
    expect(maid.travel).toMatchObject({ mode: 'MANUAL', distanceKm: 12.5, lineTotal: 150_000 });
    // Nhiều ngày: date của từng dòng theo múi giờ tổ chức (Asia/Ho_Chi_Minh).
    expect([pkg.date, pkg.startTime, pkg.endTime]).toEqual(['2026-11-10', '05:00', '07:00']);
    expect([maid.date, maid.startTime, maid.endTime]).toEqual(['2026-11-11', '05:30', '06:30']);
    expect(new Set(d.lines.map((l) => l.date).filter(Boolean)).size).toBe(2);
    expect(manual.date).toBeNull();
  });

  it('dòng phát sinh sau xác nhận: addedAfterConfirm + addedOn (ngày theo múi giờ tổ chức); Σ vẫn = subtotal', async () => {
    const c = await post(w.owner, `/orgs/${w.org}/contracts`, {
      customerId: w.customer,
      lines: [{ kind: 'CUSTOM', name: 'Trang điểm thử', unitPrice: 300_000, quantity: 1 }],
    });
    await post(w.owner, `/orgs/${w.org}/contracts/${c.id}/status`, { to: 'CONFIRMED' }, 200);
    await post(w.owner, `/orgs/${w.org}/contracts/${c.id}/lines`, { kind: 'CUSTOM', name: 'Phát sinh', unitPrice: 70_000, quantity: 2 });
    const d = (await printData(w.owner, w.org, c.id)).data;
    const added = d.lines.find((l) => l.name === 'Phát sinh')!;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    expect(added).toMatchObject({ addedAfterConfirm: true, addedOn: today, lineTotal: 140_000 });
    expect(printedSum(d.lines)).toBe(d.money.subtotal);
    expect(d.money.subtotal).toBe(440_000);
  });
});

describe('thu tiền trên bản in', () => {
  it('paid = thu − hoàn chưa huỷ; Σ paid các đợt = min(đã thu, Σ đợt); trạng thái PAID / PARTIAL / UNPAID; phiếu huỷ vắng mặt', async () => {
    const id = await serviceContract();
    const total = (await printData(w.owner, w.org, id)).data.money.total;
    await put(w.owner, `/orgs/${w.org}/contracts/${id}/installments`, {
      installments: [
        { name: 'Đặt cọc', dueDate: '2026-11-01T00:00:00.000Z', amount: 1_000_000, isDeposit: true },
        { name: 'Đợt 2', dueDate: '2026-11-05T00:00:00.000Z', amount: 1_000_000, isDeposit: false },
        { name: 'Còn lại', dueDate: '2026-11-10T00:00:00.000Z', amount: total - 2_000_000, isDeposit: false },
      ],
    });
    await post(w.owner, `/orgs/${w.org}/contracts/${id}/payments`, { method: 'CASH', amount: 1_200_000 });
    const voided = await post(w.owner, `/orgs/${w.org}/contracts/${id}/payments`, { method: 'BANK_TRANSFER', amount: 900_000 });
    await post(w.owner, `/orgs/${w.org}/payments/${voided.id}/void`, { reason: 'Ghi nhầm' }, 200);
    await post(w.owner, `/orgs/${w.org}/contracts/${id}/payments`, { method: 'CASH', amount: 200_000, kind: 'REFUND' });
    const p = (await printData(w.owner, w.org, id)).data.payments!;
    const sumPaid = p.installments.reduce((a, i) => a + i.paid, 0);
    const sumAmount = p.installments.reduce((a, i) => a + i.amount, 0);
    console.log(`[thu tiền] đã thu ${p.paid}, Σ đợt ${sumAmount}, Σ paid đợt ${sumPaid}, trạng thái ${p.installments.map((i) => i.state).join('/')}`);
    expect(p.paid).toBe(1_000_000);
    expect(sumPaid).toBe(Math.min(p.paid, sumAmount));
    expect(p.installments.map((i) => [i.name, i.paid, i.state])).toEqual([
      ['Đặt cọc', 1_000_000, 'PAID'],
      ['Đợt 2', 0, 'UNPAID'],
      ['Còn lại', 0, 'UNPAID'],
    ]);
    expect(p.installments[0]).toMatchObject({ dueDate: '2026-11-01', isDeposit: true });
    expect(p.receipts.map((x) => [x.kind, x.amount])).toEqual([
      ['RECEIPT', 1_200_000],
      ['REFUND', 200_000],
    ]);
    expect(p.remaining).toBe(total - 1_000_000);
    expect(p.remainingInWords).toBe(vndInWords(total - 1_000_000));
    expect(p.scheduleDifference).toBe(0);
    // Thêm 300.000 → đợt 2 thu một phần.
    await post(w.owner, `/orgs/${w.org}/contracts/${id}/payments`, { method: 'CASH', amount: 300_000 });
    const p2 = (await printData(w.owner, w.org, id)).data.payments!;
    expect(p2.installments.map((i) => i.state)).toEqual(['PAID', 'PARTIAL', 'UNPAID']);
    expect(p2.installments[1]!.paid).toBe(300_000);
  });

  it('hai GET cùng dataHash (= sha256 của JSON sắp khoá); thêm một phiếu thu → dataHash đổi', async () => {
    const id = await serviceContract();
    const a = await printData(w.owner, w.org, id);
    const b = await printData(w.owner, w.org, id);
    expect(a.dataHash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.dataHash).toBe(a.dataHash);
    expect(hashPrintData(a.data)).toBe(a.dataHash);
    expect(createHash('sha256').update(stableJson(a.data)).digest('hex')).toBe(a.dataHash);
    // stableJson không phụ thuộc thứ tự khoá.
    const reversed = Object.fromEntries(Object.entries(a.data).reverse()) as unknown as ContractPrintData;
    expect(hashPrintData(reversed)).toBe(a.dataHash);
    await post(w.owner, `/orgs/${w.org}/contracts/${id}/payments`, { method: 'CASH', amount: 10_000 });
    const c = await printData(w.owner, w.org, id);
    console.log(`[mã băm] trước ${a.dataHash.slice(0, 12)} = ${b.dataHash.slice(0, 12)}; sau phiếu thu ${c.dataHash.slice(0, 12)}`);
    expect(c.dataHash).not.toBe(a.dataHash);
  });
});

describe('điều khoản: nháp theo mẫu mới nhất, đã xác nhận giữ bản chụp', () => {
  it('nháp: mẫu đang chọn bản mới nhất, snapshot false; sửa mẫu → bản in nháp đổi theo', async () => {
    const t = await post(w.owner, `/orgs/${w.org}/contract-texts`, { kind: 'TERMS', appliesTo: ['SERVICE'], name: 'Điều khoản DV', body: '1. Điều A\n2) Điều B' });
    const c = await post(w.owner, `/orgs/${w.org}/contracts`, {
      customerId: w.customer,
      termsTemplateId: t.id,
      lines: [{ kind: 'CUSTOM', name: 'Trang điểm', unitPrice: 300_000, quantity: 1 }],
    });
    expect((await printData(w.owner, w.org, c.id)).data.terms).toEqual({
      title: 'Điều khoản',
      items: ['Điều A', 'Điều B'],
      source: { name: 'Điều khoản DV', version: 1 },
      snapshot: false,
    });
    const r = await request(app).patch(`/api/v1/orgs/${w.org}/contract-texts/${t.id}`).set(bearer(w.owner)).send({ body: 'Điều A mới\nĐiều C' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const after = (await printData(w.owner, w.org, c.id)).data.terms;
    expect(after).toEqual({ title: 'Điều khoản', items: ['Điều A mới', 'Điều C'], source: { name: 'Điều khoản DV', version: 2 }, snapshot: false });
  });

  it('đã xác nhận rồi sửa mẫu điều khoản → điều khoản vẫn bản chụp cũ + bản cũ, snapshot true', async () => {
    const t = await post(w.owner, `/orgs/${w.org}/contract-texts`, { kind: 'TERMS', appliesTo: [], name: 'Điều khoản chung', body: 'Điều cũ 1\nĐiều cũ 2' });
    const c = await post(w.owner, `/orgs/${w.org}/contracts`, {
      customerId: w.customer,
      termsTemplateId: t.id,
      lines: [{ kind: 'CUSTOM', name: 'Trang điểm', unitPrice: 300_000, quantity: 1 }],
    });
    await post(w.owner, `/orgs/${w.org}/contracts/${c.id}/status`, { to: 'CONFIRMED' }, 200);
    const r = await request(app).patch(`/api/v1/orgs/${w.org}/contract-texts/${t.id}`).set(bearer(w.owner)).send({ body: 'Điều MỚI' });
    expect(r.status).toBe(200);
    const pd = await printData(w.owner, w.org, c.id);
    expect(pd.data.terms).toEqual({ title: 'Điều khoản', items: ['Điều cũ 1', 'Điều cũ 2'], source: { name: 'Điều khoản chung', version: 1 }, snapshot: true });
    expect(pd.data.contract.status).toBe('CONFIRMED');
    expect(pd.warnings.map((x) => x.code)).not.toContain('DRAFT');
  });
});

describe('hợp đồng khoá học: lớp + nội quy', () => {
  it('course (khoá, lớp, ngày, thứ, giờ, số buổi, giảng viên, cơ sở) + rules; nháp snapshot false, xác nhận snapshot true', async () => {
    const instructor = await registerUser(app, 'midl-gv');
    const gv = await addMember(app, w.owner, w.org, instructor, ['instructor']);
    await request(app).patch(`/api/v1/orgs/${w.org}/staff/${gv}`).set(bearer(w.owner)).send({ displayName: 'Cô Hằng' }).expect(200);
    const created = await post(w.owner, `/orgs/${w.org}/courses`, {
      name: 'Makeup cá nhân',
      mode: 'MULTI_CLASS',
      tuitionFee: 5_000_000,
      defaultCapacity: 20,
      sessionCount: 12,
      firstClass: {
        name: 'K15',
        startDate: '2027-02-01',
        endDate: '2027-04-01',
        weekdays: [4, 2],
        startTime: '18:00',
        endTime: '21:00',
        instructorMembershipId: gv,
        studioLocationId: w.location,
      },
    });
    const classId = created.classes[0].id as string;
    const rules = await post(w.owner, `/orgs/${w.org}/contract-texts`, { kind: 'RULES', appliesTo: ['COURSE'], name: 'Nội quy lớp', body: 'Đi học đúng giờ\nKhông quay phim' });
    const c = await post(w.owner, `/orgs/${w.org}/contracts`, {
      kind: 'COURSE',
      customerId: w.customer,
      rulesTemplateId: rules.id,
      lines: [{ kind: 'COURSE', courseClassId: classId }],
    });
    const d = (await printData(w.owner, w.org, c.id)).data;
    expect(d.kind).toBe('COURSE');
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]!.course).toEqual({
      courseName: 'Makeup cá nhân',
      className: 'K15',
      startDate: '2027-02-01',
      endDate: '2027-04-01',
      weekdays: [2, 4],
      startTime: '18:00',
      endTime: '21:00',
      sessionCount: 12,
      instructorName: 'Cô Hằng',
      location: { name: 'Studio Phố Huế', address: 'Số 9 Phố Huế, Hà Nội' },
    });
    expect(d.lines[0]).toMatchObject({ kind: 'COURSE', lineTotal: 5_000_000 });
    expect(d.rules).toEqual({ title: 'Nội quy', items: ['Đi học đúng giờ', 'Không quay phim'], source: { name: 'Nội quy lớp', version: 1 }, snapshot: false });
    expect(printedSum(d.lines)).toBe(d.money.subtotal);
    await post(w.owner, `/orgs/${w.org}/contracts/${c.id}/status`, { to: 'CONFIRMED' }, 200);
    await request(app).patch(`/api/v1/orgs/${w.org}/contract-texts/${rules.id}`).set(bearer(w.owner)).send({ body: 'Nội quy mới' }).expect(200);
    const d2 = (await printData(w.owner, w.org, c.id)).data;
    expect(d2.rules).toEqual({ title: 'Nội quy', items: ['Đi học đúng giờ', 'Không quay phim'], source: { name: 'Nội quy lớp', version: 1 }, snapshot: true });
  });

  it('hợp đồng dịch vụ không có nội quy (rules null)', async () => {
    const id = await serviceContract();
    expect((await printData(w.owner, w.org, id)).data.rules).toBeNull();
  });
});

describe('che theo quyền người xem', () => {
  it('chỉ contracts.read → contactHidden, paymentsHidden; SĐT, email, payments đều null; chủ thấy đủ', async () => {
    const id = await serviceContract();
    await post(w.owner, `/orgs/${w.org}/contracts/${id}/payments`, { method: 'CASH', amount: 100_000 });
    const full = await printData(w.owner, w.org, id);
    const lim = await printData(w.limited, w.org, id);
    console.log(`[che] chủ: SĐT ${full.data.customer.phone}, phiếu ${full.data.payments?.receipts.length}; chỉ xem: ${JSON.stringify(lim.data.customer)}, payments ${lim.data.payments}`);
    expect(full.data.customer).toEqual({ fullName: 'Nguyễn Thị Hoa', phone: '0912345678', email: 'hoa@thu.local', contactHidden: false });
    expect(full.data.paymentsHidden).toBe(false);
    expect(full.data.payments?.paid).toBe(100_000);
    expect(lim.data.customer).toEqual({ fullName: 'Nguyễn Thị Hoa', phone: null, email: null, contactHidden: true });
    expect(lim.data.payments).toBeNull();
    expect(lim.data.paymentsHidden).toBe(true);
    expect(JSON.stringify(lim)).not.toContain('0912345678');
    expect(JSON.stringify(lim)).not.toContain('hoa@thu.local');
    expect(lim.warnings.map((x) => x.code)).toEqual(expect.arrayContaining(['CONTACT_HIDDEN', 'PAYMENTS_HIDDEN']));
    expect(full.warnings.map((x) => x.code)).not.toContain('CONTACT_HIDDEN');
    expect(lim.dataHash).not.toBe(full.dataHash);
    // Tiền hợp đồng vẫn in đủ cho người chỉ xem hợp đồng.
    expect(lim.data.money).toEqual(full.data.money);
  });
});

describe('hồ sơ thương hiệu, logo, cảnh báo', () => {
  it('chưa có hồ sơ → NO_PROFILE, tên theo tổ chức, không logo; có hồ sơ + logo + thông tin hợp đồng → logoUrl, người đại diện, ngân hàng', async () => {
    const owner = await registerUser(app, 'midl-hs');
    const org = await createAcademyOrg(app, owner, 'midl-hs');
    const cust = (await post(owner, `/orgs/${org}/customers`, { fullName: 'Khách HS' })).id;
    const c = await post(owner, `/orgs/${org}/contracts`, { customerId: cust, lines: [{ kind: 'CUSTOM', name: 'Dịch vụ', unitPrice: 100_000, quantity: 1 }] });
    const before = await printData(owner, org, c.id);
    const orgRow = await db.organization.findUniqueOrThrow({ where: { id: org }, select: { name: true } });
    expect(before.warnings.map((x) => x.code)).toEqual(expect.arrayContaining(['NO_PROFILE', 'NO_REPRESENTATIVE', 'NO_BANK', 'NO_TERMS', 'NO_INSTALLMENTS', 'DRAFT']));
    expect(before.data.studio).toMatchObject({ name: orgRow.name, logoFileId: null, address: null, representative: null, bank: null });
    expect(before.logoUrl).toBeNull();
    // Mẫu dùng được: mẫu dịch vụ mặc định cài sẵn đứng đầu.
    expect(before.defaultTemplateId).toBe(before.templates[0]!.id);
    expect(before.templates.every((t) => t.defaultFor.length === 0 || t.defaultFor.includes('SERVICE'))).toBe(true);
    expect(before.printCount).toBe(0);
    expect(before.lastPrint).toBeNull();

    const up = await request(app)
      .post(`/api/v1/orgs/${org}/files?purpose=ORG_LOGO&name=logo.png`)
      .set(bearer(owner))
      .set(idem())
      .set('content-type', 'application/octet-stream')
      .send(makePng());
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    await put(owner, `/orgs/${org}/profile`, { brandName: 'Hoa Makeup', tagline: 'Đẹp tự nhiên', address: 'Số 2 Hàng Bài', phone: '0987654321', logoFileId: up.body.id });
    await put(owner, `/orgs/${org}/profile/contract-info`, {
      representativeName: 'Trần Văn Chiến',
      representativeTitle: 'Chủ studio',
      bankName: 'Vietcombank',
      bankAccountNumber: '0123 4567 89',
      bankAccountName: 'TRAN VAN CHIEN',
    });
    const after = await printData(owner, org, c.id);
    expect(after.warnings.map((x) => x.code)).not.toEqual(expect.arrayContaining(['NO_PROFILE']));
    expect(after.warnings.map((x) => x.code)).not.toContain('NO_BANK');
    expect(after.data.studio).toEqual({
      name: 'Hoa Makeup',
      tagline: 'Đẹp tự nhiên',
      address: 'Số 2 Hàng Bài',
      phone: '0987654321',
      email: null,
      website: null,
      logoFileId: up.body.id,
      representative: { name: 'Trần Văn Chiến', title: 'Chủ studio' },
      bank: { bankName: 'Vietcombank', accountNumber: '0123456789', accountName: 'TRAN VAN CHIEN' },
    });
    expect(after.logoUrl).toMatch(/\/files\/raw\//);
    expect(after.logoUrlExpiresAt).not.toBeNull();
    // URL ký KHÔNG nằm trong dữ liệu chụp (hết hạn).
    expect(JSON.stringify(after.data)).not.toContain(after.logoUrl!);
  });
});

describe('cách ly tổ chức', () => {
  it('hợp đồng của tổ chức khác → 404 "Không tìm thấy hợp đồng", giống hệt mã bịa; người ngoài gọi vào tổ chức → 404', async () => {
    const id = await serviceContract();
    const ownerB = await registerUser(app, 'midl-b');
    const orgB = await createAcademyOrg(app, ownerB, 'midl-b');
    const cross = await request(app).get(`/api/v1/orgs/${orgB}/contracts/${id}/print-data`).set(bearer(ownerB));
    const fake = await request(app).get(`/api/v1/orgs/${orgB}/contracts/${randomUUID()}/print-data`).set(bearer(ownerB));
    console.log(`[cách ly] mã của A → ${cross.status} ${errOf(cross.body).message}; mã bịa → ${fake.status}`);
    expect(cross.status).toBe(404);
    expect(errOf(cross.body).message).toBe('Không tìm thấy hợp đồng');
    expect(noReq(cross.body)).toBe(noReq(fake.body));
    const outsider = await request(app).get(`/api/v1/orgs/${w.org}/contracts/${id}/print-data`).set(bearer(ownerB));
    expect(outsider.status).toBe(404);
  });
});
