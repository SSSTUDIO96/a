// Bản vẽ D mục 2.3 — LUẬT PHỤ PHÍ (gói M3): hình dạng luật (checkRuleShape) trên POST và trên bản ghép của PATCH,
// kiểm dịch vụ / loại / gói / nhân vật theo tổ chức (mã tổ chức khác = mã bịa), trần 50 luật bật, status, currentPrice,
// usedLineCount, quyền prices.write, cách ly tổ chức, nhật ký, không có đường xoá.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MAX_ACTIVE_SURCHARGE_RULES } from '../src/modules/catalog/surcharge-rules';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

interface Org {
  id: string;
  owner: TestUser;
  surcharge: string; // phụ phí có giá: niêm yết 300.000, khuyến mại 250.000
  noPrice: string; // phụ phí chưa có giá
  stopped: string; // phụ phí đang ngừng
  main: string; // dịch vụ chính
  addon: string; // dịch vụ phụ
  occasion: string;
  pkg: string;
  subject: string;
}

interface RuleView {
  id: string;
  name: string;
  serviceId: string;
  service: { id: string; name: string; kind: string; isActive: boolean; currentPrice: number | null };
  startTime: string | null;
  endTime: string | null;
  weekdays: number[];
  dates: string[];
  occasionIds: string[];
  packageIds: string[];
  subjectIds: string[];
  perQuantity: boolean;
  note: string | null;
  sortOrder: number;
  isActive: boolean;
  status: string;
  usedLineCount: number;
}

let A: Org;
let B: Org;
let managerA: TestUser;
let receptionA: TestUser;
let artistA: TestUser;
let tutorA: TestUser;

const url = (orgId: string, rest = '') => `/api/v1/orgs/${orgId}/surcharge-rules${rest}`;
const idem = () => `k-${randomUUID()}`;
const NO_TRIGGER = 'Luật phải có ít nhất một điều kiện: khung giờ, ngày hoặc loại sự kiện';
let seq = 0;
const ruleName = (p = 'Luật') => `${p} ${++seq}-${randomUUID().slice(0, 4)}`;

function post(u: TestUser, orgId: string, body: object, key = idem()) {
  return request(app).post(url(orgId)).set(bearer(u)).set('idempotency-key', key).send(body);
}
function patch(u: TestUser, orgId: string, id: string, body: object) {
  return request(app).patch(url(orgId, `/${id}`)).set(bearer(u)).send(body);
}
async function list(u: TestUser, orgId: string, query = ''): Promise<RuleView[]> {
  const res = await request(app).get(url(orgId, query)).set(bearer(u)).expect(200);
  return res.body.items as RuleView[];
}
async function make(o: Org, extra: object = {}): Promise<RuleView> {
  const res = await post(o.owner, o.id, { name: ruleName(), serviceId: o.surcharge, startTime: '04:00', endTime: '06:00', ...extra });
  if (res.status !== 201) throw new Error(`Tạo luật thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as RuleView;
}
function issuesOf(res: request.Response): { path: string; message: string }[] {
  return (res.body.error?.details?.issues ?? []) as { path: string; message: string }[];
}
function expectIssue(res: request.Response, path: string, message?: string) {
  expect(res.status, JSON.stringify(res.body)).toBe(400);
  const hit = issuesOf(res).find((i) => i.path === path && (message === undefined || i.message === message));
  expect(hit, `mong lỗi ở ô "${path}"${message ? ` "${message}"` : ''}, nhận ${JSON.stringify(issuesOf(res))}`).toBeTruthy();
}

async function service(o: { id: string; owner: TestUser }, body: object): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/orgs/${o.id}/services`)
    .set(bearer(o.owner))
    .set('idempotency-key', idem())
    .send({ code: `DV-${randomUUID().slice(0, 6)}`, ...body });
  if (res.status !== 201) throw new Error(`Tạo dịch vụ thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

async function seed(label: string): Promise<Org> {
  const owner = await registerUser(app, `lpp-${label}`);
  const id = await createOrg(app, owner, `lpp-${label}`);
  const o = { id, owner };
  const surcharge = await service(o, { name: `Phụ phí ca sớm ${label}`, kind: 'SURCHARGE', listPrice: 300_000, salePrice: 250_000 });
  const stopped = await service(o, { name: `Phụ phí ngừng ${label}`, kind: 'SURCHARGE', listPrice: 100_000, isActive: false });
  const main = await service(o, { name: `Makeup tiệc ${label}`, kind: 'MAIN', durationMinutes: 60, listPrice: 800_000 });
  const addon = await service(o, { name: `Làm tóc ${label}`, kind: 'ADDON', durationMinutes: 30, listPrice: 200_000 });
  const tag = randomUUID().slice(0, 6);
  // Phụ phí chưa có giá: đường tạo dịch vụ luôn kèm giá, nên ghi thẳng.
  const noPrice = (await db.service.create({ data: { organizationId: id, code: `NP-${tag}`, name: `Phụ phí chưa giá ${label}`, kind: 'SURCHARGE' } })).id;
  const pkg = (await db.servicePackage.create({ data: { organizationId: id, code: `GOI-${tag}`, name: `Gói cô dâu ${label}`, durationMinutes: 120 } })).id;
  const occasion = (await db.occasion.findFirstOrThrow({ where: { organizationId: id }, orderBy: { sortOrder: 'asc' } })).id;
  const subject = (await db.makeupSubject.findFirstOrThrow({ where: { organizationId: id }, orderBy: { sortOrder: 'asc' } })).id;
  return { id, owner, surcharge, noPrice, stopped, main, addon, occasion, pkg, subject };
}

beforeAll(async () => {
  app = makeApp(deps);
  A = await seed('a');
  B = await seed('b');
  managerA = await registerUser(app, 'lpp-quanly');
  await addMember(app, A.owner, A.id, managerA, ['manager']);
  receptionA = await registerUser(app, 'lpp-letan');
  await addMember(app, A.owner, A.id, receptionA, ['receptionist']);
  artistA = await registerUser(app, 'lpp-tho');
  await addMember(app, A.owner, A.id, artistA, ['artist']);
  tutorA = await registerUser(app, 'lpp-trogiang');
  await addMember(app, A.owner, A.id, tutorA, ['teaching_assistant']);
});

afterAll(async () => {
  await db.$disconnect();
});

describe('hình dạng luật (checkRuleShape)', () => {
  it('đủ mọi điều kiện → 201, phản hồi đúng khuôn SurchargeRuleView; ngày trả tăng dần', async () => {
    const r = await post(A.owner, A.id, {
      name: '  Ca đêm cuối tuần  ',
      serviceId: A.surcharge,
      startTime: '22:00',
      endTime: '04:00',
      weekdays: [6, 7],
      dates: ['2027-01-01', '2026-12-31'],
      occasionIds: [A.occasion],
      packageIds: [A.pkg],
      subjectIds: [A.subject],
      perQuantity: false,
      note: 'Ghi chú',
      sortOrder: 3,
      isActive: true,
    }).expect(201);
    expect(r.body).toMatchObject({
      name: 'Ca đêm cuối tuần',
      serviceId: A.surcharge,
      startTime: '22:00',
      endTime: '04:00',
      weekdays: [6, 7],
      dates: ['2026-12-31', '2027-01-01'],
      occasionIds: [A.occasion],
      packageIds: [A.pkg],
      subjectIds: [A.subject],
      perQuantity: false,
      note: 'Ghi chú',
      sortOrder: 3,
      isActive: true,
      status: 'OK',
      usedLineCount: 0,
    });
    expect(Object.keys(r.body).sort()).toEqual(
      ['createdAt', 'dates', 'endTime', 'id', 'isActive', 'name', 'note', 'occasionIds', 'packageIds', 'perQuantity', 'service', 'serviceId',
        'sortOrder', 'startTime', 'status', 'subjectIds', 'updatedAt', 'usedLineCount', 'weekdays'].sort(),
    );
    // Mặc định ở database: perQuantity = true, note = null, weekdays rỗng.
    const d = await make(A);
    expect(d).toMatchObject({ perQuantity: true, note: null, weekdays: [], dates: [], occasionIds: [], sortOrder: 0, isActive: true });
    // Khung kết thúc 24:00 (nửa đêm) hợp lệ.
    expect((await make(A, { startTime: '20:00', endTime: '24:00' })).endTime).toBe('24:00');
  });

  it('thiếu mọi điều kiện → 400 ô startTime; chỉ có gói / nhân vật → 400 cùng lời; mảng rỗng không tính là điều kiện', async () => {
    const base = { name: ruleName(), serviceId: A.surcharge };
    expectIssue(await post(A.owner, A.id, base), 'startTime', NO_TRIGGER);
    expectIssue(await post(A.owner, A.id, { ...base, packageIds: [A.pkg] }), 'startTime', NO_TRIGGER);
    expectIssue(await post(A.owner, A.id, { ...base, subjectIds: [A.subject], packageIds: [A.pkg] }), 'startTime', NO_TRIGGER);
    expectIssue(await post(A.owner, A.id, { ...base, weekdays: [], dates: [], occasionIds: [], startTime: null, endTime: null }), 'startTime', NO_TRIGGER);
    // Một điều kiện kích hoạt là đủ.
    for (const extra of [{ weekdays: [7] }, { dates: ['2027-04-30'] }, { occasionIds: [A.occasion] }]) {
      await post(A.owner, A.id, { ...base, name: ruleName(), ...extra }).expect(201);
    }
    expect(await db.surchargeRule.count({ where: { organizationId: A.id, name: base.name } })).toBe(0);
  });

  it('khung giờ sai → 400 đúng ô, lời tiếng Việt', async () => {
    const base = { name: ruleName(), serviceId: A.surcharge };
    expectIssue(await post(A.owner, A.id, { ...base, startTime: '04:00' }), 'endTime', 'Nhập cả giờ bắt đầu và giờ kết thúc của khung');
    expectIssue(await post(A.owner, A.id, { ...base, endTime: '06:00', weekdays: [1] }), 'endTime', 'Nhập cả giờ bắt đầu và giờ kết thúc của khung');
    expectIssue(await post(A.owner, A.id, { ...base, startTime: '05:00', endTime: '05:00' }), 'endTime', 'Giờ bắt đầu và kết thúc phải khác nhau');
    expectIssue(await post(A.owner, A.id, { ...base, startTime: '24:00', endTime: '06:00' }), 'startTime', 'Giờ bắt đầu từ 00:00 đến 23:59');
    expectIssue(await post(A.owner, A.id, { ...base, startTime: '22:00', endTime: '00:00' }), 'endTime');
    expectIssue(await post(A.owner, A.id, { ...base, startTime: '5:30', endTime: '06:00' }), 'startTime', 'Giờ theo dạng HH:MM, ví dụ 05:30');
    expectIssue(await post(A.owner, A.id, { ...base, startTime: '05:60', endTime: '06:00' }), 'startTime');
  });

  it('dữ liệu sai khác (zod) → 400 đúng ô: thứ 8, ngày sai dạng, trùng phần tử, mã không phải uuid, tên rỗng, ghi chú > 500, trường lạ', async () => {
    const base = { name: ruleName(), serviceId: A.surcharge, startTime: '04:00', endTime: '06:00' };
    expectIssue(await post(A.owner, A.id, { ...base, weekdays: [8] }), 'weekdays.0');
    expectIssue(await post(A.owner, A.id, { ...base, weekdays: [6, 6] }), 'weekdays', 'Có giá trị bị chọn trùng');
    expectIssue(await post(A.owner, A.id, { ...base, dates: ['2027-02-30'] }), 'dates.0', 'Ngày theo dạng YYYY-MM-DD');
    expectIssue(await post(A.owner, A.id, { ...base, dates: ['01/01/2027'] }), 'dates.0', 'Ngày theo dạng YYYY-MM-DD');
    expectIssue(await post(A.owner, A.id, { ...base, dates: ['2027-01-01', '2027-01-01'] }), 'dates', 'Có giá trị bị chọn trùng');
    expectIssue(await post(A.owner, A.id, { ...base, occasionIds: [A.occasion, A.occasion] }), 'occasionIds', 'Có giá trị bị chọn trùng');
    expectIssue(await post(A.owner, A.id, { ...base, packageIds: ['abc'] }), 'packageIds.0');
    expectIssue(await post(A.owner, A.id, { ...base, name: '   ' }), 'name', 'Tên luật không được để trống');
    expectIssue(await post(A.owner, A.id, { ...base, note: 'x'.repeat(501) }), 'note');
    expectIssue(await post(A.owner, A.id, { ...base, perQuantity: 'có' }), 'perQuantity');
    expectIssue(await post(A.owner, A.id, { startTime: '04:00', endTime: '06:00' }), 'serviceId');
    const strange = await post(A.owner, A.id, { ...base, organizationId: B.id });
    expect(strange.status).toBe(400);
    expect(JSON.stringify(strange.body)).toContain('Không nhận trường: organizationId');
    const all = JSON.stringify((await post(A.owner, A.id, { ...base, weekdays: [0] })).body);
    expect(all).not.toMatch(/Invalid|expected|Too (small|big)/);
    const noKey = await request(app).post(url(A.id)).set(bearer(A.owner)).send(base);
    expect(noKey.status).toBe(400);
    expect(await db.surchargeRule.count({ where: { organizationId: A.id, name: base.name } })).toBe(0);
  });
});

describe('dịch vụ, loại sự kiện, gói, nhân vật', () => {
  it('dịch vụ chính / phụ → 400 nói rõ; phụ phí ngừng → 400; phụ phí chưa có giá → được (status NO_PRICE)', async () => {
    const base = { name: ruleName(), startTime: '04:00', endTime: '06:00' };
    const m = await post(A.owner, A.id, { ...base, serviceId: A.main });
    expect(m.status).toBe(400);
    expect(m.body.error.message).toBe('Dịch vụ "Makeup tiệc a" là dịch vụ chính — luật chỉ nhận phụ phí');
    const a = await post(A.owner, A.id, { ...base, serviceId: A.addon });
    expect(a.status).toBe(400);
    expect(a.body.error.message).toBe('Dịch vụ "Làm tóc a" là dịch vụ phụ — luật chỉ nhận phụ phí');
    const s = await post(A.owner, A.id, { ...base, serviceId: A.stopped });
    expect(s.status).toBe(400);
    expect(s.body.error.message).toBe('Phụ phí "Phụ phí ngừng a" đang ngừng hoạt động');
    const np = await post(A.owner, A.id, { ...base, serviceId: A.noPrice }).expect(201);
    expect(np.body).toMatchObject({ status: 'NO_PRICE', service: { id: A.noPrice, kind: 'SURCHARGE', isActive: true, currentPrice: null } });
    // PATCH đổi sang dịch vụ chính cũng bị chặn, luật giữ nguyên.
    const p = await patch(A.owner, A.id, np.body.id, { serviceId: A.main });
    expect(p.status).toBe(400);
    expect((await db.surchargeRule.findUniqueOrThrow({ where: { id: np.body.id } })).serviceId).toBe(A.noPrice);
  });

  it('dịch vụ / loại sự kiện / gói / nhân vật của tổ chức KHÁC → 404 GIỐNG HỆT mã bịa (POST và PATCH); không ghi gì', async () => {
    const base = { name: ruleName(), serviceId: A.surcharge, startTime: '04:00', endTime: '06:00' };
    const rule = await make(A);
    const fields: [string, (id: string) => object, string, string][] = [
      ['serviceId', (id) => ({ serviceId: id }), B.surcharge, 'Không tìm thấy dịch vụ'],
      ['occasionIds', (id) => ({ occasionIds: [A.occasion, id] }), B.occasion, 'Không tìm thấy loại sự kiện'],
      ['packageIds', (id) => ({ packageIds: [id] }), B.pkg, 'Không tìm thấy gói dịch vụ'],
      ['subjectIds', (id) => ({ subjectIds: [id] }), B.subject, 'Không tìm thấy nhân vật makeup'],
    ];
    let same = 0;
    for (const [label, shape, foreign, message] of fields) {
      for (const send of [
        (id: string) => post(A.owner, A.id, { ...base, ...shape(id) }),
        (id: string) => patch(A.owner, A.id, rule.id, shape(id)),
      ]) {
        const cross = await send(foreign);
        const fake = await send(randomUUID());
        expect(cross.status, label).toBe(404);
        expect(cross.body.error.message, label).toBe(message);
        const strip = (r: request.Response) => ({ s: r.status, c: r.body.error.code, m: r.body.error.message, d: r.body.error.details ?? null });
        expect(strip(cross), label).toEqual(strip(fake));
        same++;
      }
    }
    console.log(`[luật phụ phí] mã tổ chức khác trả giống hệt mã bịa: ${same}/${fields.length * 2}`);
    expect(await db.surchargeRule.count({ where: { organizationId: A.id, name: base.name } })).toBe(0);
    expect((await list(A.owner, A.id)).find((r) => r.id === rule.id)).toMatchObject({ serviceId: A.surcharge, occasionIds: [], packageIds: [], subjectIds: [] });
    // Loại sự kiện đang ẩn vẫn nhận.
    await db.occasion.update({ where: { id: A.occasion }, data: { isActive: false } });
    try {
      await post(A.owner, A.id, { ...base, name: ruleName(), occasionIds: [A.occasion] }).expect(201);
    } finally {
      await db.occasion.update({ where: { id: A.occasion }, data: { isActive: true } });
    }
  });
});

describe(`trần ${MAX_ACTIVE_SURCHARGE_RULES} luật đang bật`, () => {
  it(`luật bật thứ ${MAX_ACTIVE_SURCHARGE_RULES + 1} → 409; luật tắt vẫn thêm được; PATCH bật → 409; PATCH luật đã bật với isActive: true → 200`, async () => {
    const o = await seed('tran');
    for (let i = 0; i < MAX_ACTIVE_SURCHARGE_RULES; i++) await make(o, { weekdays: [1 + (i % 7)] });
    const over = await post(o.owner, o.id, { name: ruleName(), serviceId: o.surcharge, weekdays: [1] });
    expect(over.status).toBe(409);
    expect(over.body.error.message).toBe(`Tối đa ${MAX_ACTIVE_SURCHARGE_RULES} luật đang bật`);
    const off = await make(o, { isActive: false });
    const on = await patch(o.owner, o.id, off.id, { isActive: true });
    expect(on.status).toBe(409);
    expect(on.body.error.message).toBe(`Tối đa ${MAX_ACTIVE_SURCHARGE_RULES} luật đang bật`);
    const active = (await list(o.owner, o.id, '?isActive=true'))[0]!;
    await patch(o.owner, o.id, active.id, { isActive: true, note: 'vẫn bật' }).expect(200);
    expect(await db.surchargeRule.count({ where: { organizationId: o.id, isActive: true } })).toBe(MAX_ACTIVE_SURCHARGE_RULES);
    // Tắt một luật thì bật được luật kia.
    await patch(o.owner, o.id, active.id, { isActive: false }).expect(200);
    await patch(o.owner, o.id, off.id, { isActive: true }).expect(200);
  });
});

describe('PATCH: ghép bản đang lưu với thân rồi kiểm', () => {
  it('bỏ khung giờ khi không còn điều kiện nào khác → 400; còn thứ trong tuần → 200; bỏ một đầu → 400 ô endTime', async () => {
    const only = await make(A, { packageIds: [A.pkg] });
    expectIssue(await patch(A.owner, A.id, only.id, { startTime: null, endTime: null }), 'startTime', NO_TRIGGER);
    expectIssue(await patch(A.owner, A.id, only.id, { startTime: null }), 'endTime', 'Nhập cả giờ bắt đầu và giờ kết thúc của khung');
    expectIssue(await patch(A.owner, A.id, only.id, { endTime: '04:00' }), 'endTime', 'Giờ bắt đầu và kết thúc phải khác nhau');
    expect((await list(A.owner, A.id)).find((r) => r.id === only.id)).toMatchObject({ startTime: '04:00', endTime: '06:00' });

    const withDay = await make(A, { weekdays: [6] });
    const r = await patch(A.owner, A.id, withDay.id, { startTime: null, endTime: null }).expect(200);
    expect(r.body).toMatchObject({ startTime: null, endTime: null, weekdays: [6] });
    // Bỏ nốt thứ → không còn điều kiện → 400.
    expectIssue(await patch(A.owner, A.id, withDay.id, { weekdays: [] }), 'startTime', NO_TRIGGER);
    // Đổi một đầu khung: đầu kia giữ nguyên.
    const w = await make(A);
    expect((await patch(A.owner, A.id, w.id, { endTime: '07:30' }).expect(200)).body).toMatchObject({ startTime: '04:00', endTime: '07:30' });
  });

  it('mảng gửi lên thay toàn bộ; không gửi = giữ nguyên; PATCH một trường giữ mọi trường khác; thân rỗng → 400', async () => {
    const r = await make(A, {
      weekdays: [6, 7],
      dates: ['2027-01-01'],
      occasionIds: [A.occasion],
      packageIds: [A.pkg],
      subjectIds: [A.subject],
      perQuantity: false,
      note: 'Cũ',
      sortOrder: 5,
    });
    const { id: _id, note: _note, updatedAt: _u, ...keep } = r as RuleView & { updatedAt: string };
    const n = await patch(A.owner, A.id, r.id, { note: 'Mới' }).expect(200);
    const { id: _id2, note, updatedAt: _u2, ...kept2 } = n.body as RuleView & { updatedAt: string };
    expect(note).toBe('Mới');
    expect(kept2).toEqual(keep);
    const occ2 = (await db.occasion.findFirstOrThrow({ where: { organizationId: A.id, id: { not: A.occasion } } })).id;
    const x = await patch(A.owner, A.id, r.id, { occasionIds: [occ2], dates: ['2027-09-02', '2027-04-30'], packageIds: [] }).expect(200);
    expect(x.body).toMatchObject({ occasionIds: [occ2], dates: ['2027-04-30', '2027-09-02'], packageIds: [], subjectIds: [A.subject], weekdays: [6, 7] });
    expect(await db.surchargeRuleTarget.count({ where: { ruleId: r.id } })).toBe(2);
    expect(await db.surchargeRuleDate.count({ where: { ruleId: r.id } })).toBe(2);
    expect((await patch(A.owner, A.id, r.id, { note: null }).expect(200)).body.note).toBeNull();
    const empty = await patch(A.owner, A.id, r.id, {});
    expect(empty.status).toBe(400);
    expect(JSON.stringify(empty.body)).toContain('Không có gì để sửa');
  });

  it('trùng tên → 409 "Tên luật đã có trong tổ chức" (POST và PATCH); tổ chức khác dùng cùng tên được', async () => {
    const r1 = await make(A);
    const r2 = await make(A);
    const dup = await post(A.owner, A.id, { name: r1.name, serviceId: A.surcharge, weekdays: [1] });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('Tên luật đã có trong tổ chức');
    const dup2 = await patch(A.owner, A.id, r2.id, { name: r1.name });
    expect(dup2.status).toBe(409);
    expect(dup2.body.error.message).toBe('Tên luật đã có trong tổ chức');
    await post(B.owner, B.id, { name: r1.name, serviceId: B.surcharge, weekdays: [1] }).expect(201);
  });
});

describe('status, currentPrice, usedLineCount', () => {
  it('status đúng 4 giá trị; currentPrice = giá áp dụng hiện hành (khuyến mại), giá hẹn tương lai chưa tính', async () => {
    const o = await seed('tt');
    const ok = await make(o);
    expect(ok).toMatchObject({ status: 'OK', service: { id: o.surcharge, kind: 'SURCHARGE', isActive: true, currentPrice: 250_000 } });
    // Giá hẹn tương lai không đổi currentPrice.
    await db.priceVersion.create({
      data: { organizationId: o.id, serviceId: o.surcharge, listPrice: 999_000n, effectiveFrom: new Date(Date.now() + 86_400_000), createdById: o.owner.id },
    });
    // Giá mới có hiệu lực ngay → currentPrice đổi theo.
    await request(app)
      .post(`/api/v1/orgs/${o.id}/services/${o.surcharge}/prices`)
      .set(bearer(o.owner))
      .set('idempotency-key', idem())
      .send({ listPrice: 280_000 })
      .expect(201);
    const noPrice = await make(o, { serviceId: o.noPrice });
    const sInactive = await service(o, { name: 'Phụ phí sẽ ngừng', kind: 'SURCHARGE', listPrice: 50_000 });
    const inactive = await make(o, { serviceId: sInactive });
    const sKind = await service(o, { name: 'Phụ phí sẽ đổi loại', kind: 'SURCHARGE', listPrice: 60_000 });
    const notSurcharge = await make(o, { serviceId: sKind });
    // Dịch vụ đổi sau khi lưu luật (database cho phép; máy chủ tính status lúc đọc).
    await db.service.update({ where: { id: sInactive }, data: { isActive: false } });
    await db.service.update({ where: { id: sKind }, data: { kind: 'ADDON', durationMinutes: 30 } });
    const byId = new Map((await list(o.owner, o.id)).map((r) => [r.id, r]));
    expect(byId.get(ok.id)).toMatchObject({ status: 'OK', service: { currentPrice: 280_000 } });
    expect(byId.get(noPrice.id)).toMatchObject({ status: 'NO_PRICE', service: { currentPrice: null } });
    expect(byId.get(inactive.id)).toMatchObject({ status: 'SERVICE_INACTIVE', service: { isActive: false, currentPrice: 50_000 } });
    expect(byId.get(notSurcharge.id)).toMatchObject({ status: 'SERVICE_NOT_SURCHARGE', service: { kind: 'ADDON' } });
    expect(new Set([...byId.values()].map((r) => r.status))).toEqual(new Set(['OK', 'NO_PRICE', 'SERVICE_INACTIVE', 'SERVICE_NOT_SURCHARGE']));
  });

  it('usedLineCount đếm dòng tự thêm CHƯA HUỶ; database chặn xoá luật đang được dòng dùng; không có đường xoá', async () => {
    const o = await seed('dung');
    const rule = await make(o);
    const other = await make(o);
    const tag = randomUUID().slice(0, 6);
    const customer = await db.customer.create({ data: { organizationId: o.id, fullName: `Khách ${tag}` } });
    const contract = await db.contract.create({ data: { organizationId: o.id, code: `HD-${tag}`, customerId: customer.id, createdById: o.owner.id } });
    const base = { organizationId: o.id, contractId: contract.id, unitPrice: 0n, lineTotal: 0n, createdById: o.owner.id };
    const parent = await db.contractLine.create({ data: { ...base, kind: 'PACKAGE', packageId: o.pkg, name: 'Gói' } });
    const auto = (voided: boolean) =>
      db.contractLine.create({
        data: {
          ...base,
          kind: 'SURCHARGE',
          serviceId: o.surcharge,
          parentLineId: parent.id,
          name: 'Phụ phí',
          surchargeRuleId: rule.id,
          surchargeRuleName: rule.name,
          ...(voided ? { voidedAt: new Date(), voidReason: 'Bỏ' } : {}),
        },
      });
    await auto(false);
    await auto(true);
    const byId = new Map((await list(o.owner, o.id)).map((r) => [r.id, r.usedLineCount]));
    expect(byId.get(rule.id)).toBe(1);
    expect(byId.get(other.id)).toBe(0);

    const del = await request(app).delete(url(o.id, `/${rule.id}`)).set(bearer(o.owner));
    expect(del.status).toBe(404);
    expect(del.body.error.message).toBe('Không có đường API này');
    await expect(db.surchargeRule.delete({ where: { id: rule.id } })).rejects.toThrow();
    expect(await db.surchargeRule.count({ where: { id: rule.id } })).toBe(1);
    // Sửa / tắt luật không đổi dòng hợp đồng đã lưu (tên luật chụp ở dòng).
    await patch(o.owner, o.id, rule.id, { name: 'Tên mới', isActive: false }).expect(200);
    const lines = await db.contractLine.findMany({ where: { surchargeRuleId: rule.id }, select: { surchargeRuleName: true } });
    expect(lines.every((l) => l.surchargeRuleName === rule.name)).toBe(true);
  });
});

describe('quyền và cách ly tổ chức', () => {
  it('Quản lý (prices.write) thêm / sửa được; Lễ tân (không prices.write) → 403; Thợ xem được, sửa → 403; Trợ giảng xem → 403', async () => {
    const r = await post(managerA, A.id, { name: ruleName('Quản lý'), serviceId: A.surcharge, weekdays: [7] }).expect(201);
    await patch(managerA, A.id, r.body.id, { note: 'Quản lý sửa' }).expect(200);
    const rec = await post(receptionA, A.id, { name: ruleName('Lễ tân'), serviceId: A.surcharge, weekdays: [7] });
    expect(rec.status).toBe(403);
    expect(rec.body.error.details).toMatchObject({ required: 'prices.write' });
    expect((await patch(receptionA, A.id, r.body.id, { note: 'Lễ tân sửa' })).status).toBe(403);
    expect((await list(receptionA, A.id)).some((x) => x.id === r.body.id)).toBe(true);
    expect((await list(artistA, A.id)).some((x) => x.id === r.body.id)).toBe(true);
    expect((await patch(artistA, A.id, r.body.id, { note: 'Thợ sửa' })).status).toBe(403);
    expect((await request(app).get(url(A.id)).set(bearer(tutorA))).status).toBe(403);
    expect((await request(app).get(url(A.id))).status).toBe(401);
    expect((await db.surchargeRule.findUniqueOrThrow({ where: { id: r.body.id } })).note).toBe('Quản lý sửa');
  });

  it('luật của tổ chức khác = mã bịa (404 giống hệt); người ngoài gọi đường của A → 404 tổ chức; GET không lộ luật của tổ chức khác', async () => {
    const aRule = await make(A);
    const bRule = await make(B);
    const cross = await patch(B.owner, B.id, aRule.id, { note: 'Chiếm' });
    const fake = await patch(B.owner, B.id, randomUUID(), { note: 'Chiếm' });
    expect(cross.status).toBe(404);
    expect(cross.body.error.message).toBe('Không tìm thấy luật phụ phí');
    expect({ c: cross.body.error.code, m: cross.body.error.message }).toEqual({ c: fake.body.error.code, m: fake.body.error.message });
    const outsider = await patch(B.owner, A.id, aRule.id, { note: 'Chiếm' });
    expect(outsider.status).toBe(404);
    expect(outsider.body.error.message).toBe('Không tìm thấy tổ chức');
    expect((await request(app).get(url(A.id)).set(bearer(B.owner))).status).toBe(404);
    expect((await post(B.owner, A.id, { name: ruleName(), serviceId: A.surcharge, weekdays: [1] })).status).toBe(404);
    const aIds = new Set((await list(A.owner, A.id)).map((r) => r.id));
    const bIds = (await list(B.owner, B.id)).map((r) => r.id);
    expect(bIds).toContain(bRule.id);
    expect(bIds.filter((id) => aIds.has(id))).toEqual([]);
    expect((await db.surchargeRule.findUniqueOrThrow({ where: { id: aRule.id } })).note).toBeNull();
  });
});

describe('nhật ký', () => {
  it('surcharge_rule.created / surcharge_rule.updated ghi { before, after } gồm cả mảng điều kiện', async () => {
    const o = await seed('nk');
    const r = await make(o, { occasionIds: [o.occasion], dates: ['2027-01-01'] });
    await patch(o.owner, o.id, r.id, { packageIds: [o.pkg], startTime: null, endTime: null }).expect(200);
    const logs = await db.auditLog.findMany({ where: { organizationId: o.id, entityType: 'surcharge_rule', entityId: r.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['surcharge_rule.created', 'surcharge_rule.updated']);
    expect(logs[0]!.actorUserId).toBe(o.owner.id);
    expect(logs[0]!.data).toMatchObject({ before: null, after: { name: r.name, startTime: '04:00', endTime: '06:00', occasionIds: [o.occasion], dates: ['2027-01-01'], packageIds: [] } });
    expect(logs[1]!.data).toMatchObject({
      before: { startTime: '04:00', endTime: '06:00', packageIds: [], occasionIds: [o.occasion] },
      after: { startTime: null, endTime: null, packageIds: [o.pkg], occasionIds: [o.occasion], dates: ['2027-01-01'] },
    });
  });
});
