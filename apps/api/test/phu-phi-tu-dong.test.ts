// Bản vẽ D mục 2.4 / 4.1 — PHỤ PHÍ TỰ ĐỘNG (gói M4). Luật tạo qua đường /surcharge-rules (gói M3); hợp đồng đi qua
// đường API thật (quote / tạo / sửa nháp / thêm dòng / huỷ dòng / xác nhận). Máy chủ là nơi DUY NHẤT tính phụ phí.
// Tổ chức thử ở múi giờ mặc định Asia/Ho_Chi_Minh (+07:00). Mỗi ca dùng một tổ chức riêng để luật không lẫn nhau.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MAX_MONEY_VND } from '@makeup/shared';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

afterAll(async () => {
  await db.$disconnect();
});

beforeAll(() => {
  app = makeApp(deps);
});

interface Org {
  id: string;
  owner: TestUser;
  customer: string;
  party: string; // dịch vụ chính 800.000
  early: string; // phụ phí "Ca sớm" 200.000
  holiday: string; // phụ phí "Ngày lễ" 500.000
  night: string; // phụ phí "Ca đêm" 300.000
  noPrice: string; // phụ phí chưa có giá
  bridePkg: string; // gói cô dâu 3.000.000 (nhân vật Cô dâu)
  otherPkg: string; // gói khác 1.200.000
  occ1: string;
  occ2: string;
  bride: string;
  bridesmaid: string;
}

const idem = () => `k-${randomUUID()}`;
let seq = 0;

async function seed(label = 'pp'): Promise<Org> {
  const owner = await registerUser(app, `pptd-${label}`);
  const id = await createOrg(app, owner, `pptd-${label}`);
  const tag = `${++seq}-${randomUUID().slice(0, 4)}`;
  const price = (ref: { serviceId: string } | { packageId: string }, listPrice: bigint) =>
    db.priceVersion.create({
      data: { organizationId: id, ...ref, listPrice, effectiveFrom: new Date(Date.now() - 60_000), createdById: owner.id },
    });
  const svc = async (code: string, name: string, kind: 'MAIN' | 'SURCHARGE', p: bigint | null) => {
    const s = await db.service.create({ data: { organizationId: id, code: `${code}-${tag}`, name, kind, durationMinutes: 60 } });
    if (p !== null) await price({ serviceId: s.id }, p);
    return s.id;
  };
  const subjects = await db.makeupSubject.findMany({ where: { organizationId: id } });
  const subject = (name: string) => subjects.find((s) => s.name === name)!.id;
  const bride = subject('Cô dâu');
  const pkg = async (code: string, name: string, subjectId: string | null, p: bigint) => {
    const k = await db.servicePackage.create({
      data: { organizationId: id, code: `${code}-${tag}`, name, durationMinutes: 120, subjectId },
    });
    await price({ packageId: k.id }, p);
    return k.id;
  };
  const occasions = await db.occasion.findMany({ where: { organizationId: id }, orderBy: { sortOrder: 'asc' } });
  const customer = (await db.customer.create({ data: { organizationId: id, fullName: `Khách ${tag}` } })).id;
  return {
    id,
    owner,
    customer,
    party: await svc('MK', 'Makeup tiệc', 'MAIN', 800_000n),
    early: await svc('SOM', 'Ca sớm', 'SURCHARGE', 200_000n),
    holiday: await svc('LE', 'Ngày lễ', 'SURCHARGE', 500_000n),
    night: await svc('DEM', 'Ca đêm', 'SURCHARGE', 300_000n),
    noPrice: await svc('CHUAGIA', 'Phụ phí chưa giá', 'SURCHARGE', null),
    bridePkg: await pkg('CODAU', 'Gói cô dâu', bride, 3_000_000n),
    otherPkg: await pkg('KHAC', 'Gói khác', null, 1_200_000n),
    occ1: occasions[0]!.id,
    occ2: occasions[1]!.id,
    bride,
    bridesmaid: subject('Phù dâu'),
  };
}

async function rule(o: Org, body: Record<string, unknown>): Promise<{ id: string; name: string }> {
  const res = await request(app)
    .post(`/api/v1/orgs/${o.id}/surcharge-rules`)
    .set(bearer(o.owner))
    .set('idempotency-key', idem())
    .send({ name: `Luật ${++seq}`, serviceId: o.early, ...body });
  if (res.status !== 201) throw new Error(`Tạo luật thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return { id: res.body.id, name: res.body.name };
}

function patchRule(o: Org, id: string, body: object) {
  return request(app).patch(`/api/v1/orgs/${o.id}/surcharge-rules/${id}`).set(bearer(o.owner)).send(body);
}

// Dòng dịch vụ lẻ bắt đầu lúc `start` (ISO có múi giờ), dài 1 giờ.
function svcLine(o: Org, start: string | null, extra: Record<string, unknown> = {}) {
  const times = start ? { scheduledStart: start, scheduledEnd: new Date(new Date(start).getTime() + 3_600_000).toISOString() } : {};
  return { kind: 'SERVICE', serviceId: o.party, quantity: 1, ...times, ...extra };
}

function pkgLine(o: Org, packageId: string, start: string | null, extra: Record<string, unknown> = {}) {
  const times = start ? { scheduledStart: start, scheduledEnd: new Date(new Date(start).getTime() + 7_200_000).toISOString() } : {};
  return { kind: 'PACKAGE', packageId, quantity: 1, ...times, ...extra };
}

const url = (o: Org, rest = '') => `/api/v1/orgs/${o.id}/contracts${rest}`;

function quote(o: Org, lines: object[], extra: object = {}) {
  return request(app).post(url(o, '/quote')).set(bearer(o.owner)).send({ customerId: o.customer, lines, ...extra });
}
async function quoteOk(o: Org, lines: object[], extra: object = {}) {
  const res = await quote(o, lines, extra);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}
function create(o: Org, lines: object[], extra: object = {}) {
  return request(app).post(url(o)).set(bearer(o.owner)).set('idempotency-key', idem()).send({ customerId: o.customer, lines, ...extra });
}
async function createOk(o: Org, lines: object[], extra: object = {}) {
  const res = await create(o, lines, extra);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}
function patch(o: Org, c: { id: string; updatedAt: string }, body: object) {
  return request(app).patch(url(o, `/${c.id}`)).set(bearer(o.owner)).send({ expectedUpdatedAt: c.updatedAt, ...body });
}
async function getC(o: Org, id: string) {
  const res = await request(app).get(url(o, `/${id}`)).set(bearer(o.owner)).expect(200);
  return res.body;
}
async function confirm(o: Org, id: string) {
  const res = await request(app).post(url(o, `/${id}/status`)).set(bearer(o.owner)).send({ to: 'CONFIRMED' });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

// Số dòng phụ phí tự thêm của dòng gốc thứ i trong bảng tính / hợp đồng.
const autoOf = (body: { lines: { surcharges: { surchargeRuleId: string | null; name: string; lineTotal: number; quantity: number }[] }[] }, i = 0) =>
  body.lines[i]!.surcharges;

// ---------- Bảng "khớp / không khớp" qua quote ----------

describe('khớp / không khớp (qua quote)', () => {
  let o: Org;
  beforeAll(async () => {
    o = await seed('khop');
  });

  async function hits(lines: object[], extra: object = {}): Promise<string[]> {
    const q = await quoteOk(o, lines, extra);
    return q.autoSurcharge.applied.map((a: { ruleName: string }) => a.ruleName);
  }

  it('khung giờ nửa mở [00:00, 06:00): 05:59 khớp, 06:00 KHÔNG; khung qua nửa đêm 22:00–04:00: 23:30 và 03:00 khớp, 12:00 không', async () => {
    const early = await rule(o, { name: 'Trước 6h', startTime: '00:00', endTime: '06:00' });
    const night = await rule(o, { name: 'Đêm', serviceId: o.night, startTime: '22:00', endTime: '04:00' });
    const table: [string, string[]][] = [
      ['2026-11-10T05:59:00+07:00', ['Trước 6h']],
      ['2026-11-10T06:00:00+07:00', []],
      ['2026-11-10T23:30:00+07:00', ['Đêm']],
      ['2026-11-10T03:00:00+07:00', ['Trước 6h', 'Đêm']],
      ['2026-11-10T12:00:00+07:00', []],
    ];
    const got: string[] = [];
    for (const [start, want] of table) {
      const h = await hits([svcLine(o, start)]);
      got.push(`${start}→${h.join('+') || '∅'}`);
      expect(h.sort(), start).toEqual([...want].sort());
    }
    console.log(`[phụ phí] khung giờ: ${got.join(' | ')}`);
    await patchRule(o, early.id, { isActive: false }).expect(200);
    await patchRule(o, night.id, { isActive: false }).expect(200);
  });

  it('ngày theo MÚI GIỜ TỔ CHỨC: 2026-12-31T17:30Z = 00:30 ngày 01/01 (giờ VN) → khớp luật ngày 01/01; 16:30Z (23:30 ngày 31/12) → không', async () => {
    const r = await rule(o, { name: 'Tết dương', serviceId: o.holiday, dates: ['2027-01-01'] });
    expect(await hits([svcLine(o, '2026-12-31T17:30:00Z')])).toEqual(['Tết dương']);
    expect(await hits([svcLine(o, '2026-12-31T16:30:00Z')])).toEqual([]);
    await patchRule(o, r.id, { isActive: false }).expect(200);
  });

  it('thứ trong tuần HOẶC ngày cụ thể: Chủ nhật 15/11 khớp, thứ Tư 11/11 (ngày cụ thể) khớp, thứ Hai 16/11 không', async () => {
    const r = await rule(o, { name: 'CN hoặc 11/11', serviceId: o.holiday, weekdays: [7], dates: ['2026-11-11'] });
    expect(await hits([svcLine(o, '2026-11-15T10:00:00+07:00')])).toEqual(['CN hoặc 11/11']);
    expect(await hits([svcLine(o, '2026-11-11T10:00:00+07:00')])).toEqual(['CN hoặc 11/11']);
    expect(await hits([svcLine(o, '2026-11-16T10:00:00+07:00')])).toEqual([]);
    await patchRule(o, r.id, { isActive: false }).expect(200);
  });

  it('loại sự kiện; gói; nhân vật — mỗi điều kiện đã điền đều phải đúng (VÀ)', async () => {
    const byOcc = await rule(o, { name: 'Theo sự kiện', serviceId: o.holiday, occasionIds: [o.occ1] });
    expect(await hits([svcLine(o, '2026-11-10T10:00:00+07:00', { occasionId: o.occ1 })])).toEqual(['Theo sự kiện']);
    expect(await hits([svcLine(o, '2026-11-10T10:00:00+07:00', { occasionId: o.occ2 })])).toEqual([]);
    expect(await hits([svcLine(o, '2026-11-10T10:00:00+07:00')])).toEqual([]);
    await patchRule(o, byOcc.id, { isActive: false }).expect(200);

    const byPkg = await rule(o, { name: 'Sự kiện + gói', serviceId: o.holiday, occasionIds: [o.occ1], packageIds: [o.otherPkg] });
    expect(await hits([pkgLine(o, o.otherPkg, null, { occasionId: o.occ1 })])).toEqual(['Sự kiện + gói']);
    expect(await hits([pkgLine(o, o.bridePkg, null, { occasionId: o.occ1 })])).toEqual([]);
    // Dòng dịch vụ lẻ không có gói → không khớp điều kiện gói.
    expect(await hits([svcLine(o, null, { occasionId: o.occ1 })])).toEqual([]);
    await patchRule(o, byPkg.id, { isActive: false }).expect(200);

    const bySubject = await rule(o, { name: 'Sự kiện + phù dâu', serviceId: o.holiday, occasionIds: [o.occ1], subjectIds: [o.bridesmaid] });
    expect(await hits([svcLine(o, null, { occasionId: o.occ1, subjectId: o.bridesmaid })])).toEqual(['Sự kiện + phù dâu']);
    expect(await hits([svcLine(o, null, { occasionId: o.occ1, subjectId: o.bride })])).toEqual([]);
    // Gói cô dâu mang sẵn nhân vật Cô dâu → không khớp nhân vật Phù dâu.
    expect(await hits([pkgLine(o, o.bridePkg, null, { occasionId: o.occ1 })])).toEqual([]);
    await patchRule(o, bySubject.id, { isActive: false }).expect(200);
  });

  it('dòng chưa có giờ lấy NGÀY SỰ KIỆN của hợp đồng; luật có khung giờ không khớp dòng chưa có giờ', async () => {
    const byDate = await rule(o, { name: 'Ngày 20/11', serviceId: o.holiday, dates: ['2026-11-20'] });
    const win = await rule(o, { name: 'Khung giờ', serviceId: o.night, startTime: '00:00', endTime: '24:00' });
    expect(await hits([svcLine(o, null)], { eventDate: '2026-11-20T09:00:00+07:00' })).toEqual(['Ngày 20/11']);
    // 2026-11-19T18:00Z = 01:00 ngày 20/11 giờ VN.
    expect(await hits([svcLine(o, null)], { eventDate: '2026-11-19T18:00:00Z' })).toEqual(['Ngày 20/11']);
    expect(await hits([svcLine(o, null)], { eventDate: '2026-11-21T09:00:00+07:00' })).toEqual([]);
    expect(await hits([svcLine(o, null)])).toEqual([]);
    await patchRule(o, byDate.id, { isActive: false }).expect(200);
    await patchRule(o, win.id, { isActive: false }).expect(200);
  });
});

// ---------- Nhiều luật, số lượng, giá ----------

describe('nhiều luật, số lượng, giá', () => {
  it('hai luật khác dịch vụ → 2 dòng (cộng dồn); hai luật cùng dịch vụ → 1 dòng của luật sortOrder nhỏ, kia SAME_SERVICE', async () => {
    const o = await seed('nhieu');
    await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00', sortOrder: 5 });
    await rule(o, { name: 'Lễ', serviceId: o.holiday, dates: ['2026-11-10'] });
    const q1 = await quoteOk(o, [svcLine(o, '2026-11-10T05:00:00+07:00')]);
    expect(autoOf(q1).map((l) => l.name).sort()).toEqual(['Ca sớm', 'Ngày lễ']);
    expect(q1.subtotal).toBe(800_000 + 200_000 + 500_000);

    // Cùng dịch vụ "Ca sớm", sortOrder 1 < 5 → luật mới thắng.
    await rule(o, { name: 'Sớm thứ Ba', weekdays: [2], sortOrder: 1 });
    const q2 = await quoteOk(o, [svcLine(o, '2026-11-10T05:00:00+07:00')]);
    const auto = autoOf(q2);
    expect(auto.filter((l) => l.name === 'Ca sớm')).toHaveLength(1);
    expect(auto.find((l) => l.name === 'Ca sớm')!.surchargeRuleId).toBe(q2.autoSurcharge.applied.find((a: { ruleName: string }) => a.ruleName === 'Sớm thứ Ba').ruleId);
    expect(q2.autoSurcharge.skipped).toEqual([expect.objectContaining({ line: 0, ruleName: 'Sớm', reason: 'SAME_SERVICE', by: 'Sớm thứ Ba' })]);
    expect(q2.subtotal).toBe(800_000 + 200_000 + 500_000);
  });

  it('perQuantity true: phù dâu × 2 → phụ phí × 2; perQuantity false → × 1', async () => {
    const o = await seed('sl');
    await rule(o, { name: 'Theo người', dates: ['2026-11-10'] });
    await rule(o, { name: 'Một lần', serviceId: o.holiday, dates: ['2026-11-10'], perQuantity: false });
    const q = await quoteOk(o, [svcLine(o, '2026-11-10T09:00:00+07:00', { quantity: 2 })]);
    const by = Object.fromEntries(autoOf(q).map((l) => [l.name, l]));
    expect(by['Ca sớm']).toMatchObject({ quantity: 2, unitPrice: 200_000, lineTotal: 400_000 });
    expect(by['Ngày lễ']).toMatchObject({ quantity: 1, unitPrice: 500_000, lineTotal: 500_000 });
    expect(q.subtotal).toBe(1_600_000 + 400_000 + 500_000);
  });

  it('phụ phí chưa có giá → không thêm, skipped NO_PRICE, hợp đồng vẫn tạo được', async () => {
    const o = await seed('chuagia');
    await rule(o, { name: 'Chưa giá', serviceId: o.noPrice, dates: ['2026-11-10'] });
    const lines = [svcLine(o, '2026-11-10T09:00:00+07:00')];
    const q = await quoteOk(o, lines);
    expect(autoOf(q)).toEqual([]);
    expect(q.autoSurcharge.skipped).toEqual([expect.objectContaining({ ruleName: 'Chưa giá', reason: 'NO_PRICE' })]);
    const c = await createOk(o, lines);
    expect(c.subtotal).toBe(800_000);
  });

  it('dịch vụ của luật đã ngừng → bỏ qua SERVICE_UNAVAILABLE, không chặn hợp đồng', async () => {
    const o = await seed('ngung');
    await rule(o, { name: 'Lễ', serviceId: o.holiday, dates: ['2026-11-10'] });
    await db.service.update({ where: { id: o.holiday }, data: { isActive: false } });
    const q = await quoteOk(o, [svcLine(o, '2026-11-10T09:00:00+07:00')]);
    expect(autoOf(q)).toEqual([]);
    expect(q.autoSurcharge.skipped).toEqual([expect.objectContaining({ reason: 'SERVICE_UNAVAILABLE' })]);
  });

  it('có dòng phụ phí NHẬP TAY cùng dịch vụ → MANUAL_LINE_EXISTS, không thu hai lần', async () => {
    const o = await seed('nhaptay');
    await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const lines = [svcLine(o, '2026-11-10T05:00:00+07:00'), { kind: 'SURCHARGE', serviceId: o.early, quantity: 1 }];
    const q = await quoteOk(o, lines);
    expect(autoOf(q)).toEqual([]);
    expect(q.autoSurcharge.skipped).toEqual([expect.objectContaining({ line: 0, reason: 'MANUAL_LINE_EXISTS' })]);
    expect(q.subtotal).toBe(1_000_000);
  });

  it('ghi đè giá thiếu ghi chú → 400; có ghi chú → priceVersionId null, giá đã sửa, overridden; sửa số lượng', async () => {
    const o = await seed('ghide');
    const r = await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const at = '2026-11-10T05:00:00+07:00';
    const bad = await quote(o, [svcLine(o, at, { surchargeOverrides: [{ ruleId: r.id, unitPrice: 50_000 }] })]);
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain('Ghi đè giá phụ phí phải kèm ghi chú lý do');
    const c = await createOk(o, [svcLine(o, at, { surchargeOverrides: [{ ruleId: r.id, unitPrice: 50_000, note: 'Khách quen', quantity: 3 }] })]);
    const s = autoOf(c)[0]! as unknown as Record<string, unknown>;
    expect(s).toMatchObject({ priceVersionId: null, unitPrice: 50_000, quantity: 3, lineTotal: 150_000, note: 'Khách quen', surchargeRuleId: r.id, surchargeRuleName: 'Sớm' });
    const q = await quoteOk(o, [svcLine(o, at, { surchargeOverrides: [{ ruleId: r.id, quantity: 2 }] })]);
    expect(q.autoSurcharge.applied[0]).toMatchObject({ quantity: 2, lineTotal: 400_000, overridden: true });
    expect(autoOf(q)[0]).toMatchObject({ unitPrice: 200_000 });
    expect((autoOf(q)[0] as unknown as { priceVersionId: string | null }).priceVersionId).not.toBeNull();
  });

  it('đổi giờ để hết khớp → dòng tự thêm mất, phần sửa vào removed NO_LONGER_MATCHES; luật tắt → RULE_INACTIVE', async () => {
    const o = await seed('removed');
    const r = await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const ov = { surchargeOverrides: [{ ruleId: r.id, quantity: 2 }] };
    const q = await quoteOk(o, [svcLine(o, '2026-11-10T09:00:00+07:00', ov)]);
    expect(autoOf(q)).toEqual([]);
    expect(q.autoSurcharge.removed).toEqual([{ line: 0, ruleId: r.id, ruleName: 'Sớm', reason: 'NO_LONGER_MATCHES' }]);
    await patchRule(o, r.id, { isActive: false }).expect(200);
    const q2 = await quoteOk(o, [svcLine(o, '2026-11-10T05:00:00+07:00', ov)]);
    expect(autoOf(q2)).toEqual([]);
    expect(q2.autoSurcharge.removed).toEqual([{ line: 0, ruleId: r.id, ruleName: 'Sớm', reason: 'RULE_INACTIVE' }]);
  });

  it('một luật vừa bỏ vừa sửa → 400; sửa hai lần cùng luật → 400', async () => {
    const o = await seed('trung');
    const r = await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const at = '2026-11-10T05:00:00+07:00';
    const both = await quote(o, [svcLine(o, at, { dismissedRuleIds: [r.id], surchargeOverrides: [{ ruleId: r.id, quantity: 2 }] })]);
    expect(both.status).toBe(400);
    expect(both.body.error.message).toBe('Luật "Sớm" vừa bị bỏ vừa được sửa ở cùng một dòng');
    const twice = await quote(o, [svcLine(o, at, { surchargeOverrides: [{ ruleId: r.id, quantity: 2 }, { ruleId: r.id, quantity: 3 }] })]);
    expect(twice.status).toBe(400);
  });

  it('giá × số lượng vượt MAX_MONEY_VND → 400 lời có tên dòng', async () => {
    const o = await seed('tran');
    await db.priceVersion.create({
      data: { organizationId: o.id, serviceId: o.holiday, listPrice: BigInt(MAX_MONEY_VND), effectiveFrom: new Date(Date.now() - 30_000), createdById: o.owner.id },
    });
    await rule(o, { name: 'Lễ', serviceId: o.holiday, dates: ['2026-11-10'] });
    const res = await quote(o, [svcLine(o, '2026-11-10T09:00:00+07:00', { quantity: 2 })]);
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error.message).toContain('Thành tiền dòng "Ngày lễ" quá lớn');
    expect(res.body.error.details).toMatchObject({ line: 0, field: 'lineTotal' });
  });

  it('tổng = cộng mọi dòng (kể cả dòng tự thêm) — so subtotal của database, tiền là số nguyên', async () => {
    const o = await seed('tong');
    await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    await rule(o, { name: 'Lễ', serviceId: o.holiday, dates: ['2026-11-10'], perQuantity: false });
    const c = await createOk(o, [svcLine(o, '2026-11-10T05:00:00+07:00', { quantity: 3 }), pkgLine(o, o.otherPkg, '2026-11-10T08:00:00+07:00')], {
      discount: 100_000,
    });
    const row = await db.contract.findUniqueOrThrow({ where: { id: c.id }, select: { subtotal: true, total: true } });
    const lines = await db.contractLine.findMany({ where: { contractId: c.id }, select: { lineTotal: true, surchargeRuleId: true } });
    const sum = lines.reduce((s, l) => s + l.lineTotal, 0n);
    expect(lines.filter((l) => l.surchargeRuleId !== null)).toHaveLength(3); // dòng 0: Sớm + Lễ; dòng 1: Lễ
    expect(row.subtotal).toBe(sum);
    expect(row.subtotal).toBe(2_400_000n + 600_000n + 500_000n + 1_200_000n + 500_000n);
    expect(row.total).toBe(row.subtotal - 100_000n);
    expect(Number.isInteger(c.subtotal)).toBe(true);
  });

  it('hai lần quote liên tiếp cùng thân → cùng kết quả', async () => {
    const o = await seed('tatdinh');
    await rule(o, { name: 'B cùng dịch vụ', weekdays: [2] });
    await rule(o, { name: 'A cùng dịch vụ', startTime: '00:00', endTime: '06:00' });
    await rule(o, { name: 'Lễ', serviceId: o.holiday, dates: ['2026-11-10'] });
    const lines = [svcLine(o, '2026-11-10T05:00:00+07:00', { quantity: 2 }), pkgLine(o, o.bridePkg, null)];
    const q1 = await quoteOk(o, lines, { eventDate: '2026-11-10T08:00:00+07:00' });
    const q2 = await quoteOk(o, lines, { eventDate: '2026-11-10T08:00:00+07:00' });
    expect(q2).toEqual(q1);
    // Cùng sortOrder → thắng theo tên: "A cùng dịch vụ".
    expect(q1.autoSurcharge.skipped).toEqual([expect.objectContaining({ ruleName: 'B cùng dịch vụ', by: 'A cùng dịch vụ' })]);
  });
});

// ---------- Bỏ (dismissed) ----------

describe('bỏ dòng tự thêm (dismissedRuleIds)', () => {
  it('bỏ → không thêm; lưu lại luật đã bỏ; đổi giờ đi rồi đổi lại (gửi lại đúng dữ liệu đã lưu) → vẫn KHÔNG thêm', async () => {
    const o = await seed('bo');
    const r = await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const early = '2026-11-10T05:00:00+07:00';
    const q = await quoteOk(o, [svcLine(o, early, { dismissedRuleIds: [r.id] })]);
    expect(autoOf(q)).toEqual([]);
    expect(q.lines[0].dismissedRuleIds).toEqual([r.id]);

    let c = await createOk(o, [svcLine(o, early)]);
    expect(autoOf(c)).toHaveLength(1);
    // Người lập bỏ dòng tự thêm.
    let res = await patch(o, c, { lines: [svcLine(o, early, { dismissedRuleIds: [r.id] })] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    c = res.body;
    expect(autoOf(c)).toEqual([]);
    // Đổi giờ đi (không khớp) — web dựng lại dòng từ dữ liệu ĐÃ LƯU (dismissedRuleIds của dòng).
    res = await patch(o, c, { lines: [svcLine(o, '2026-11-10T09:00:00+07:00', { dismissedRuleIds: c.lines[0].dismissedRuleIds })] });
    expect(res.status).toBe(200);
    c = res.body;
    expect(c.lines[0].dismissedRuleIds).toEqual([r.id]);
    // Đổi lại giờ khớp.
    res = await patch(o, c, { lines: [svcLine(o, early, { dismissedRuleIds: c.lines[0].dismissedRuleIds })] });
    expect(res.status).toBe(200);
    c = res.body;
    expect(autoOf(c)).toEqual([]);
    expect(c.subtotal).toBe(800_000);
    const raw = await db.contractLine.findMany({ where: { contractId: c.id }, select: { dismissedSurchargeRuleIds: true, kind: true } });
    expect(raw).toEqual([{ kind: 'SERVICE', dismissedSurchargeRuleIds: [r.id] }]);
    // "Áp lại" = bỏ khỏi mảng → dòng tự thêm trở lại.
    res = await patch(o, c, { lines: [svcLine(o, early, { dismissedRuleIds: [] })] });
    expect(autoOf(res.body)).toHaveLength(1);
  });

  it('bỏ luật A thì luật B cùng dịch vụ (nếu khớp) được áp', async () => {
    const o = await seed('bo2');
    const a = await rule(o, { name: 'A', startTime: '00:00', endTime: '06:00', sortOrder: 1 });
    await rule(o, { name: 'B', weekdays: [2], sortOrder: 2 });
    const q = await quoteOk(o, [svcLine(o, '2026-11-10T05:00:00+07:00', { dismissedRuleIds: [a.id] })]);
    expect(q.autoSurcharge.applied.map((x: { ruleName: string }) => x.ruleName)).toEqual(['B']);
  });
});

// ---------- Cách ly tổ chức ----------

describe('cách ly tổ chức: mã luật của tổ chức khác = mã bịa', () => {
  it('dismissedRuleIds / surchargeOverrides mang mã luật tổ chức khác → 404 CÙNG lời với mã bịa', async () => {
    const o = await seed('cl-a');
    const other = await seed('cl-b');
    const foreign = await rule(other, { name: 'Luật B', startTime: '00:00', endTime: '06:00' });
    const fake = randomUUID();
    const at = '2026-11-10T05:00:00+07:00';
    const results: string[] = [];
    for (const extra of [
      { dismissedRuleIds: [foreign.id] },
      { dismissedRuleIds: [fake] },
      { surchargeOverrides: [{ ruleId: foreign.id, quantity: 2 }] },
      { surchargeOverrides: [{ ruleId: fake, quantity: 2 }] },
    ]) {
      const res = await quote(o, [svcLine(o, at, extra)]);
      const { requestId: _r, ...error } = res.body.error;
      results.push(`${res.status} ${JSON.stringify(error)}`);
    }
    expect(results[0]).toBe(results[1]);
    expect(results[2]).toBe(results[3]);
    expect(results[0]).toBe(results[2]);
    expect(results[0]).toBe('404 {"code":"NOT_FOUND","message":"Không tìm thấy luật phụ phí","details":{"line":0}}');
    // Tạo hợp đồng cũng chặn như vậy (không lưu mã lạ vào mảng không có khoá ngoại).
    expect((await create(o, [svcLine(o, at, { dismissedRuleIds: [foreign.id] })])).status).toBe(404);
  });

  it('luật của tổ chức khác KHÔNG bao giờ sinh dòng ở tổ chức này', async () => {
    const o = await seed('cl-c');
    const other = await seed('cl-d');
    await rule(other, { name: 'Luật B', startTime: '00:00', endTime: '06:00' });
    const q = await quoteOk(o, [svcLine(o, '2026-11-10T05:00:00+07:00')]);
    expect(q.autoSurcharge).toEqual({ applied: [], removed: [], skipped: [] });
  });
});

// ---------- Vòng đời ----------

describe('vòng đời hợp đồng', () => {
  it('đã xác nhận: sửa / tắt luật, đổi giá phụ phí → hợp đồng KHÔNG đổi một đồng; PATCH dòng → 409; database khoá dòng', async () => {
    const o = await seed('xn');
    const r = await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const c = await createOk(o, [svcLine(o, '2026-11-10T05:00:00+07:00', { quantity: 2 })]);
    expect(autoOf(c)[0]).toMatchObject({ lineTotal: 400_000 });
    const confirmed = await confirm(o, c.id);
    const before = await getC(o, c.id);
    await patchRule(o, r.id, { startTime: '07:00', endTime: '08:00' }).expect(200);
    await request(app)
      .post(`/api/v1/orgs/${o.id}/services/${o.early}/prices`)
      .set(bearer(o.owner))
      .set('idempotency-key', idem())
      .send({ listPrice: 999_000 })
      .expect(201);
    await patchRule(o, r.id, { isActive: false }).expect(200);
    await rule(o, { name: 'Lễ mới', serviceId: o.holiday, dates: ['2026-11-10'] });
    const after = await getC(o, c.id);
    expect(after).toEqual(before);
    expect(after.subtotal).toBe(2_000_000);
    const res = await patch(o, confirmed, { lines: [svcLine(o, '2026-11-10T05:00:00+07:00')] });
    expect(res.status).toBe(409);
    // Trigger khoá dòng sau xác nhận: 5 cột mới cũng nằm trong diện khoá.
    const autoId = after.lines[0].surcharges[0].id as string;
    await expect(db.contractLine.update({ where: { id: autoId }, data: { surchargeRuleName: 'đổi' } })).rejects.toThrow();
    await expect(db.contractLine.update({ where: { id: after.lines[0].id }, data: { occasionId: o.occ1, occasionName: 'x' } })).rejects.toThrow();
  });

  it('thêm dòng phát sinh sau xác nhận khớp luật → dòng tự thêm addedAfterConfirm = true; chỉ dòng chính sinh ca', async () => {
    const o = await seed('ps');
    const c = await createOk(o, [svcLine(o, '2026-11-10T09:00:00+07:00')]);
    await confirm(o, c.id);
    await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const res = await request(app)
      .post(url(o, `/${c.id}/lines`))
      .set(bearer(o.owner))
      .set('idempotency-key', idem())
      .send(svcLine(o, '2026-11-11T05:00:00+07:00'));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const added = res.body.lines[1];
    expect(added.addedAfterConfirm).toBe(true);
    expect(added.surcharges).toHaveLength(1);
    expect(added.surcharges[0]).toMatchObject({ addedAfterConfirm: true, surchargeRuleName: 'Sớm', lineTotal: 200_000 });
    expect(res.body.createdAppointments).toHaveLength(1);
    expect(res.body.subtotal).toBe(800_000 * 2 + 200_000);
    const audit = await db.auditLog.findFirstOrThrow({ where: { organizationId: o.id, action: 'contract.line_added' } });
    expect((audit.data as { autoSurcharges: unknown[] }).autoSurcharges).toEqual([
      { lineId: added.surcharges[0].id, parentLineId: added.id, ruleId: added.surcharges[0].surchargeRuleId, amount: 200_000 },
    ]);
  });

  it('thêm dòng vào hợp đồng đã có phụ phí nhập tay cùng dịch vụ → không tự thêm (MANUAL_LINE_EXISTS)', async () => {
    const o = await seed('ps2');
    const c = await createOk(o, [svcLine(o, '2026-11-10T09:00:00+07:00'), { kind: 'SURCHARGE', serviceId: o.early, quantity: 1 }]);
    await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const res = await request(app)
      .post(url(o, `/${c.id}/lines`))
      .set(bearer(o.owner))
      .set('idempotency-key', idem())
      .send(svcLine(o, '2026-11-11T05:00:00+07:00'));
    expect(res.status).toBe(201);
    expect(res.body.lines.flatMap((l: { surcharges: unknown[] }) => l.surcharges)).toEqual([]);
    expect(res.body.subtotal).toBe(800_000 * 2 + 200_000);
  });

  it('huỷ dòng gói → dòng tự thêm huỷ theo', async () => {
    const o = await seed('huy');
    await rule(o, { name: 'Lễ', serviceId: o.holiday, dates: ['2026-11-10'] });
    const c = await createOk(o, [pkgLine(o, o.otherPkg, '2026-11-10T09:00:00+07:00'), svcLine(o, '2026-11-12T09:00:00+07:00')]);
    expect(c.subtotal).toBe(1_200_000 + 500_000 + 800_000);
    const res = await request(app)
      .post(url(o, `/${c.id}/lines/${c.lines[0].id}/void`))
      .set(bearer(o.owner))
      .send({ reason: 'Khách bỏ' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.lines[0].surcharges[0].voidedAt).not.toBeNull();
    expect(res.body.subtotal).toBe(800_000);
  });

  it('nháp tạo TRƯỚC khi có luật: PATCH lines → nhận dòng tự thêm (chủ đích, ký duyệt D câu 6); nhật ký ghi autoSurcharges', async () => {
    const o = await seed('nhapcu');
    const c = await createOk(o, [svcLine(o, '2026-11-10T05:00:00+07:00')]);
    expect(c.subtotal).toBe(800_000);
    const r = await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const res = await patch(o, c, { lines: [svcLine(o, '2026-11-10T05:00:00+07:00')] });
    expect(res.status).toBe(200);
    expect(autoOf(res.body)).toHaveLength(1);
    expect(res.body.subtotal).toBe(1_000_000);
    const audit = await db.auditLog.findFirstOrThrow({ where: { organizationId: o.id, action: 'contract.updated' } });
    expect((audit.data as { autoSurcharges: { ruleId: string; amount: number }[] }).autoSurcharges).toEqual([
      expect.objectContaining({ ruleId: r.id, amount: 200_000 }),
    ]);
  });

  it('một luật tối đa MỘT dòng tự thêm chưa huỷ trên một dòng gốc (database chặn dòng thứ hai)', async () => {
    const o = await seed('motdong');
    await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });
    const c = await createOk(o, [svcLine(o, '2026-11-10T05:00:00+07:00', { quantity: 2 })]);
    const auto = await db.contractLine.findFirstOrThrow({ where: { contractId: c.id, surchargeRuleId: { not: null } } });
    const { id: _id, createdAt: _c, ...copy } = auto;
    await expect(db.contractLine.create({ data: { ...copy, sortOrder: 99 } })).rejects.toThrow(/contract_lines_one_auto_per_rule|Unique/);
    const groups = await db.contractLine.groupBy({
      by: ['parentLineId', 'surchargeRuleId'],
      where: { organizationId: o.id, surchargeRuleId: { not: null }, voidedAt: null },
      _count: { _all: true },
    });
    expect(groups.every((g) => g._count._all === 1)).toBe(true);
  });
});

// ---------- Hợp đồng cũ (trước bản vẽ D) ----------

describe('hợp đồng cũ (các cột mới NULL / rỗng): mở / sửa / báo giá không đổi số tiền', () => {
  it('nháp cũ có phụ phí nhập tay + luật mới cùng dịch vụ; nháp cũ không khớp luật; hợp đồng cũ đã xác nhận', async () => {
    const o = await seed('cu');
    const at = '2026-11-10T05:00:00+07:00';
    const manualLines = [svcLine(o, at), { kind: 'SURCHARGE', serviceId: o.early, quantity: 1 }];
    const old1 = await createOk(o, manualLines);
    const old2 = await createOk(o, [svcLine(o, '2026-11-10T09:00:00+07:00')]);
    const old3 = await createOk(o, [svcLine(o, at)]);
    await confirm(o, old3.id);
    // Dữ liệu trước D: 5 cột mới trống.
    const raw = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM contract_lines
      WHERE contract_id IN (${old1.id}::uuid, ${old2.id}::uuid, ${old3.id}::uuid)
        AND (occasion_id IS NOT NULL OR occasion_name IS NOT NULL OR surcharge_rule_id IS NOT NULL
             OR surcharge_rule_name IS NOT NULL OR cardinality(dismissed_surcharge_rule_ids) > 0)`;
    expect(raw[0]!.n).toBe(0n);
    const snap = async (id: string) => {
      const d = await getC(o, id);
      return { subtotal: d.subtotal, total: d.total, lines: d.lines.map((l: { lineTotal: number; surcharges: unknown[] }) => [l.lineTotal, l.surcharges.length]) };
    };
    const before = [await snap(old1.id), await snap(old2.id), await snap(old3.id)];

    // Luật mới cùng dịch vụ với dòng nhập tay của nháp cũ 1, khung giờ khớp dòng của nháp cũ 1 và hợp đồng đã xác nhận.
    await rule(o, { name: 'Sớm', startTime: '00:00', endTime: '06:00' });

    // Mở: không đổi.
    expect([await snap(old1.id), await snap(old2.id), await snap(old3.id)]).toEqual(before);
    // Báo giá với đúng dòng đã lưu: không đổi (nhập tay cùng dịch vụ → không thu hai lần).
    expect((await quoteOk(o, manualLines)).subtotal).toBe(before[0]!.subtotal);
    // Sửa không gửi lines (ghi chú): không chạy luật.
    let d1 = await getC(o, old1.id);
    let res = await patch(o, d1, { notes: 'ghi chú mới' });
    expect(res.status).toBe(200);
    expect(await snap(old1.id)).toEqual(before[0]);
    // Sửa có lines (gửi lại đúng dòng đã lưu): không đổi tiền.
    d1 = await getC(o, old1.id);
    res = await patch(o, d1, { lines: manualLines });
    expect(res.status).toBe(200);
    expect(await snap(old1.id)).toEqual(before[0]);
    const d2 = await getC(o, old2.id);
    res = await patch(o, d2, { lines: [svcLine(o, '2026-11-10T09:00:00+07:00')] });
    expect(res.status).toBe(200);
    expect(await snap(old2.id)).toEqual(before[1]);
    // Đã xác nhận: không bao giờ bị luật chạm.
    expect(await snap(old3.id)).toEqual(before[2]);
    // Hình dạng cũ giữ nguyên, chỉ thêm trường mới.
    const v = (await getC(o, old2.id)).lines[0];
    expect(v).toMatchObject({ addons: [], travel: null, surcharges: [], occasionId: null, occasionName: null, surchargeRuleId: null, surchargeRuleName: null, dismissedRuleIds: [] });
    for (const k of ['id', 'kind', 'name', 'serviceId', 'packageId', 'priceVersionId', 'unitPrice', 'lineDiscount', 'lineTotal', 'staff', 'staffWarnings', 'travelBreakdown']) {
      expect(v).toHaveProperty(k);
    }
  });
});

// ---------- Cô lập tổ chức của bảng tính (biên bản nghiệm thu D, L6) ----------
// Bảng tính hợp đồng chỉ nạp luật của CHÍNH tổ chức (autoSurcharge.ts loadActiveRules). Trước đây chỉ bài khác "rơi" luật vào
// báo giá mới làm bài đỏ; ca này tạo chủ đích: tổ chức A có luật khung giờ, tổ chức B báo giá đúng giờ đó.
describe('cô lập tổ chức: luật của tổ chức khác không bao giờ vào bảng tính', () => {
  it('A có luật khung giờ 00:00–06:00; B báo giá lúc 05:00 → B không có dòng tự thêm (quote, tạo, sửa nháp), A vẫn có', async () => {
    const a = await seed('cl-a');
    const b = await seed('cl-b');
    await rule(a, { name: 'Sớm của A', startTime: '00:00', endTime: '06:00' });
    const lúc = '2026-11-10T05:00:00+07:00';

    // Đối chứng: A báo giá đúng giờ đó thì có (nếu không, ca này không chứng minh gì).
    const qa = await quoteOk(a, [svcLine(a, lúc)]);
    expect(qa.autoSurcharge.applied.map((x: { ruleName: string }) => x.ruleName)).toEqual(['Sớm của A']);
    expect(autoOf(qa)).toHaveLength(1);

    // B: không luật nào → báo giá không có dòng tự thêm, tổng chỉ là tiền dịch vụ chính.
    const qb = await quoteOk(b, [svcLine(b, lúc)]);
    expect(qb.autoSurcharge).toEqual({ applied: [], removed: [], skipped: [] });
    expect(autoOf(qb)).toEqual([]);
    expect(qb.subtotal).toBe(800_000);

    // Hợp đồng thật của B (tạo rồi sửa nháp có gửi lines) cũng không thu thêm đồng nào.
    const made = await createOk(b, [svcLine(b, lúc)]);
    expect(autoOf(made)).toEqual([]);
    expect(made.subtotal).toBe(800_000);
    const res = await patch(b, made, { lines: [svcLine(b, lúc)] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(autoOf(res.body)).toEqual([]);
    expect((await getC(b, made.id)).subtotal).toBe(800_000);
  });

  it('B có luật RIÊNG khác khung giờ: B chỉ thấy luật của B, A chỉ thấy luật của A (không trộn hai chiều)', async () => {
    const a = await seed('cl-c');
    const b = await seed('cl-d');
    await rule(a, { name: 'Sớm của A', startTime: '00:00', endTime: '06:00' });
    await rule(b, { name: 'Tối của B', serviceId: b.night, startTime: '20:00', endTime: '23:00' });
    // Luật lạ lọt vào còn lộ ra ở `skipped` (dịch vụ của luật không thuộc tổ chức) nên kiểm cả skipped / removed, không chỉ applied.
    const hits = async (o: Org, start: string) => {
      const r = (await quoteOk(o, [svcLine(o, start)])).autoSurcharge as { applied: { ruleName: string }[]; removed: unknown[]; skipped: unknown[] };
      expect(r.removed).toEqual([]);
      expect(r.skipped).toEqual([]);
      return r.applied.map((x) => x.ruleName);
    };
    expect(await hits(a, '2026-11-10T05:00:00+07:00')).toEqual(['Sớm của A']);
    expect(await hits(a, '2026-11-10T21:00:00+07:00')).toEqual([]);
    expect(await hits(b, '2026-11-10T05:00:00+07:00')).toEqual([]);
    expect(await hits(b, '2026-11-10T21:00:00+07:00')).toEqual(['Tối của B']);
  });
});
