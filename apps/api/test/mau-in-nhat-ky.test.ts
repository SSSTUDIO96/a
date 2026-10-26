// Bản vẽ G mục 3.3 đường 6–7, 3.4 "Ghi nhật ký in", 3.5, 5.1 (gói G-M4) — nhật ký in CHỈ THÊM.
// - TEMPLATE: printNo 1, 2, 3. Sai expectedDataHash → 409 DATA_CHANGED, 0 dòng ghi. Sai phiên bản → 409 TEMPLATE_CHANGED.
//   Mẫu ngừng dùng, mẫu khác loại → 400. Hợp đồng huỷ → 409 CONTRACT_CANCELLED.
// - Chống trùng: gửi lại cùng khoá → cùng phản hồi, 1 dòng; cùng khoá khác thân → 409.
// - Hợp đồng đã in giữ đúng mẫu + phiên bản: sửa mẫu (đổi bố cục) sau khi in → PRIOR_CONFIG vẫn bố cục cũ + bản cũ; REPRINT
//   ra y hệt (data + data_hash giống hệt lần gốc) kể cả khi hợp đồng đã đổi.
// - REPRINT bởi người thiếu customers.read → không có SĐT, hash khác.
// - Mã của tổ chức khác / hợp đồng khác → 404 CÙNG LỜI với mã bịa (mẫu, lần in).
// - Đua: 10 POST đồng thời cùng hợp đồng → printNo 1..10, không trùng, không hở, lỗi khác = 0.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, bearer, createAcademyOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

type Body = Record<string, unknown>;
interface PrintView {
  id: string;
  printNo: number;
  source: string;
  basedOnPrintId: string | null;
  printedAt: string;
  printedBy: { id: string; fullName: string };
  templateId: string;
  templateName: string;
  templateVersion: number;
  layout: number;
  contractStatus: string;
}
interface Snapshot {
  print: PrintView;
  config: { layout: number; templateVersion: number; templateId: string; blocks: Record<string, boolean>; title: string };
  data: { customer: { phone: string | null; contactHidden: boolean }; contract: { notes: string | null } } & Record<string, unknown>;
  dataHash: string;
  logoUrl: string | null;
  warnings: { code: string }[];
}

const errOf = (b: unknown) => (b as { error: { code: string; message: string; details?: Record<string, unknown> } }).error;
const noReq = (b: unknown) => JSON.stringify(b).replace(/"requestId":"[^"]+"/g, '');

let owner: TestUser;
let noPhone: TestUser; // contracts.read + payments.read, KHÔNG customers.read
let org: string;
let customer: string;
let serviceTemplate: { id: string; version: number };
let courseTemplateId: string;

const base = (cid: string, o = org) => `/api/v1/orgs/${o}/contracts/${cid}`;

async function newContract(notes = 'Bản đầu'): Promise<string> {
  const r = await request(app)
    .post(`/api/v1/orgs/${org}/contracts`)
    .set(bearer(owner))
    .set('idempotency-key', randomUUID())
    .send({ customerId: customer, notes, lines: [{ kind: 'CUSTOM', name: 'Trang điểm tiệc', unitPrice: 900_000, quantity: 1 }] });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.id as string;
}

async function pd(u: TestUser, cid: string, o = org) {
  const r = await request(app).get(`${base(cid, o)}/print-data`).set(bearer(u));
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as { dataHash: string; printCount: number; lastPrint: (PrintView & { sameData: boolean }) | null; data: { contract: { updatedAt?: string } } };
}

function sendPrint(u: TestUser, cid: string, body: Body, key = randomUUID(), o = org) {
  return request(app).post(`${base(cid, o)}/prints`).set(bearer(u)).set('idempotency-key', key).send(body);
}

async function printOk(u: TestUser, cid: string, body: Body): Promise<PrintView> {
  const r = await sendPrint(u, cid, body);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as PrintView;
}

async function templateNow(id: string) {
  const r = await request(app).get(`/api/v1/orgs/${org}/print-templates/${id}`).set(bearer(owner)).expect(200);
  return r.body as { id: string; version: number; layout: number };
}

async function byTemplate(u: TestUser, cid: string, extra: Body = {}) {
  const t = await templateNow(serviceTemplate.id);
  return printOk(u, cid, { source: 'TEMPLATE', templateId: t.id, expectedTemplateVersion: t.version, expectedDataHash: (await pd(u, cid)).dataHash, ...extra });
}

async function snapshot(u: TestUser, cid: string, printId: string): Promise<Snapshot> {
  const r = await request(app).get(`${base(cid)}/prints/${printId}`).set(bearer(u));
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as Snapshot;
}

const rows = (cid: string) => db.contractPrint.count({ where: { contractId: cid } });

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'mink-chu');
  org = await createAcademyOrg(app, owner, 'mink');
  const role = await request(app)
    .post(`/api/v1/orgs/${org}/roles`)
    .set(bearer(owner))
    .set('idempotency-key', randomUUID())
    .send({ key: 'in_khong_sdt', name: 'In, không xem khách', permissions: ['contracts.read', 'payments.read'] });
  expect(role.status, JSON.stringify(role.body)).toBe(201);
  noPhone = await registerUser(app, 'mink-in');
  await addMember(app, owner, org, noPhone, ['in_khong_sdt']);
  const c = await request(app)
    .post(`/api/v1/orgs/${org}/customers`)
    .set(bearer(owner))
    .set('idempotency-key', randomUUID())
    .send({ fullName: 'Khách In', phone: '0911222333' });
  customer = c.body.id;
  const list = await request(app).get(`/api/v1/orgs/${org}/print-templates`).set(bearer(owner)).expect(200);
  const items = list.body.items as { id: string; version: number; defaultFor: string[] }[];
  const svc = items.find((t) => t.defaultFor.includes('SERVICE'))!;
  serviceTemplate = { id: svc.id, version: svc.version };
  courseTemplateId = items.find((t) => t.defaultFor.includes('COURSE'))!.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe('in theo mẫu (TEMPLATE)', () => {
  it('printNo 1, 2, 3; trả PrintRecordView; nhật ký contract.printed; print-data đếm số lần in + lần gần nhất', async () => {
    const cid = await newContract();
    const p1 = await byTemplate(owner, cid);
    const p2 = await byTemplate(owner, cid);
    const p3 = await byTemplate(owner, cid);
    console.log(`[nhật ký in] printNo ${[p1, p2, p3].map((p) => p.printNo).join(', ')}`);
    expect([p1.printNo, p2.printNo, p3.printNo]).toEqual([1, 2, 3]);
    expect(Object.keys(p1).sort()).toEqual(
      ['basedOnPrintId', 'contractStatus', 'id', 'layout', 'printNo', 'printedAt', 'printedBy', 'source', 'templateId', 'templateName', 'templateVersion'].sort(),
    );
    expect(p1).toMatchObject({ source: 'TEMPLATE', basedOnPrintId: null, templateId: serviceTemplate.id, layout: 2, contractStatus: 'DRAFT', printedBy: { id: owner.id } });
    expect(p1).not.toHaveProperty('data');
    const audits = await db.auditLog.findMany({ where: { organizationId: org, action: 'contract.printed', entityId: cid }, select: { data: true } });
    expect(audits).toHaveLength(3);
    expect(audits.map((a) => (a.data as { printNo: number }).printNo).sort()).toEqual([1, 2, 3]);
    const after = await pd(owner, cid);
    expect(after.printCount).toBe(3);
    expect(after.lastPrint).toMatchObject({ id: p3.id, printNo: 3, sameData: true });
    // Bản chụp lưu đúng dữ liệu đã in + cấu hình tường minh 21 khối.
    const s = await snapshot(owner, cid, p1.id);
    expect(Object.keys(s.config.blocks)).toHaveLength(21);
    expect(s.config).toMatchObject({ layout: 2, templateId: serviceTemplate.id });
    expect(s.dataHash).toBe(after.dataHash);
  });

  it('công tắc nhanh (blockOverrides) vào cấu hình đã chụp; REPRINT không nhận blockOverrides (400)', async () => {
    const cid = await newContract();
    const p = await byTemplate(owner, cid, { blockOverrides: { 'quoc-hieu': true, 'ghi-chu': false } });
    const s = await snapshot(owner, cid, p.id);
    expect(s.config.blocks['quoc-hieu']).toBe(true);
    expect(s.config.blocks['ghi-chu']).toBe(false);
    const r = await sendPrint(owner, cid, { source: 'REPRINT', basedOnPrintId: p.id, expectedDataHash: s.dataHash, blockOverrides: { tho: false } });
    expect(r.status).toBe(400);
    expect(await rows(cid)).toBe(1);
  });

  it('sai expectedDataHash → 409 DATA_CHANGED, 0 dòng ghi; sai phiên bản → 409 TEMPLATE_CHANGED', async () => {
    const cid = await newContract();
    const t = await templateNow(serviceTemplate.id);
    const stale = (await pd(owner, cid)).dataHash;
    await request(app).patch(base(cid)).set(bearer(owner)).send({ expectedUpdatedAt: (await request(app).get(base(cid)).set(bearer(owner))).body.updatedAt, notes: 'Đổi rồi' }).expect(200);
    const r1 = await sendPrint(owner, cid, { source: 'TEMPLATE', templateId: t.id, expectedTemplateVersion: t.version, expectedDataHash: stale });
    console.log(`[409] dữ liệu đổi → ${r1.status} ${errOf(r1.body).details?.reason}; dòng ghi ${await rows(cid)}`);
    expect(r1.status).toBe(409);
    expect(errOf(r1.body)).toMatchObject({ message: 'Hợp đồng vừa thay đổi — đã tải dữ liệu mới, xem lại rồi bấm In lần nữa', details: { reason: 'DATA_CHANGED' } });
    expect(await rows(cid)).toBe(0);
    const r2 = await sendPrint(owner, cid, { source: 'TEMPLATE', templateId: t.id, expectedTemplateVersion: t.version + 1, expectedDataHash: (await pd(owner, cid)).dataHash });
    expect(r2.status).toBe(409);
    expect(errOf(r2.body).details?.reason).toBe('TEMPLATE_CHANGED');
    expect(errOf(r2.body).message).toBe(`Mẫu in vừa được sửa (nay là bản v${t.version}) — xem lại bản in rồi bấm In lần nữa`);
    expect(await rows(cid)).toBe(0);
  });

  it('mẫu ngừng dùng → 400; mẫu chỉ cho khoá học → 400; hợp đồng huỷ → 409 CONTRACT_CANCELLED', async () => {
    const cid = await newContract();
    const hash = (await pd(owner, cid)).dataHash;
    const extra = await request(app)
      .post(`/api/v1/orgs/${org}/print-templates`)
      .set(bearer(owner))
      .set('idempotency-key', randomUUID())
      .send({ name: `Mẫu ngừng ${randomUUID().slice(0, 4)}`, layout: 3, appliesTo: ['SERVICE'] });
    expect(extra.status).toBe(201);
    await request(app).patch(`/api/v1/orgs/${org}/print-templates/${extra.body.id}`).set(bearer(owner)).send({ isActive: false }).expect(200);
    const off = await sendPrint(owner, cid, { source: 'TEMPLATE', templateId: extra.body.id, expectedTemplateVersion: 1, expectedDataHash: hash });
    expect(off.status).toBe(400);
    expect(errOf(off.body).message).toBe(`Mẫu in "${extra.body.name}" đang ngừng dùng`);
    const course = await sendPrint(owner, cid, { source: 'TEMPLATE', templateId: courseTemplateId, expectedTemplateVersion: 1, expectedDataHash: hash });
    expect(course.status).toBe(400);
    expect(errOf(course.body).message).toBe('Mẫu "Cổ điển có quốc hiệu" chỉ dùng cho hợp đồng khoá học');
    await request(app).post(`${base(cid)}/status`).set(bearer(owner)).set('idempotency-key', randomUUID()).send({ to: 'CANCELLED', reason: 'Khách huỷ' }).expect(200);
    const t = await templateNow(serviceTemplate.id);
    const cancelled = await sendPrint(owner, cid, { source: 'TEMPLATE', templateId: t.id, expectedTemplateVersion: t.version, expectedDataHash: (await pd(owner, cid)).dataHash });
    expect(cancelled.status).toBe(409);
    expect(errOf(cancelled.body)).toMatchObject({ message: 'Hợp đồng đã huỷ — không in', details: { reason: 'CONTRACT_CANCELLED' } });
    expect(await rows(cid)).toBe(0);
  });

  it('chống gửi trùng: cùng khoá → cùng phản hồi, 1 dòng; cùng khoá khác thân → 409', async () => {
    const cid = await newContract();
    const t = await templateNow(serviceTemplate.id);
    const body = { source: 'TEMPLATE', templateId: t.id, expectedTemplateVersion: t.version, expectedDataHash: (await pd(owner, cid)).dataHash };
    const key = randomUUID();
    const a = await sendPrint(owner, cid, body, key);
    const b = await sendPrint(owner, cid, body, key);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(await rows(cid)).toBe(1);
    const c = await sendPrint(owner, cid, { ...body, blockOverrides: { tho: false } }, key);
    expect(c.status).toBe(409);
    expect(await rows(cid)).toBe(1);
  });
});

describe('hợp đồng đã in giữ đúng mẫu + phiên bản', () => {
  it('sửa mẫu (đổi bố cục) sau khi in → PRIOR_CONFIG vẫn bố cục cũ + bản cũ; REPRINT ra y hệt (data + data_hash) dù hợp đồng đã đổi', async () => {
    // Mẫu riêng cho ca này (không đụng mẫu mặc định các ca khác dùng).
    const created = await request(app)
      .post(`/api/v1/orgs/${org}/print-templates`)
      .set(bearer(owner))
      .set('idempotency-key', randomUUID())
      .send({ name: `Mẫu giữ bản ${randomUUID().slice(0, 4)}`, layout: 2, appliesTo: ['SERVICE'], title: 'HỢP ĐỒNG BẢN CŨ' });
    expect(created.status).toBe(201);
    const tid = created.body.id as string;
    const cid = await newContract('Ghi chú lúc in');
    const first = await printOk(owner, cid, { source: 'TEMPLATE', templateId: tid, expectedTemplateVersion: 1, expectedDataHash: (await pd(owner, cid)).dataHash });
    const orig = await db.contractPrint.findUniqueOrThrow({ where: { id: first.id } });
    // Sửa mẫu: bố cục 2 → 3, tiêu đề mới ⇒ bản 2.
    const patched = await request(app).patch(`/api/v1/orgs/${org}/print-templates/${tid}`).set(bearer(owner)).send({ layout: 3, title: 'HỢP ĐỒNG BẢN MỚI' });
    expect(patched.body.version).toBe(2);
    // In theo mẫu với bản cũ → 409 (mẫu đã đổi).
    const stale = await sendPrint(owner, cid, { source: 'TEMPLATE', templateId: tid, expectedTemplateVersion: 1, expectedDataHash: (await pd(owner, cid)).dataHash });
    expect(errOf(stale.body).details?.reason).toBe('TEMPLATE_CHANGED');
    // Theo cấu hình lần trước: bố cục + bản + tiêu đề CŨ, dữ liệu mới.
    const prior = await printOk(owner, cid, { source: 'PRIOR_CONFIG', basedOnPrintId: first.id, expectedDataHash: (await pd(owner, cid)).dataHash });
    const ps = await snapshot(owner, cid, prior.id);
    console.log(`[giữ mẫu] mẫu nay v${patched.body.version} bố cục ${patched.body.layout}; PRIOR_CONFIG → v${prior.templateVersion} bố cục ${ps.config.layout} "${ps.config.title}"`);
    expect(prior).toMatchObject({ source: 'PRIOR_CONFIG', basedOnPrintId: first.id, templateId: tid, templateVersion: 1, layout: 2, printNo: 2 });
    expect(ps.config).toMatchObject({ layout: 2, templateVersion: 1, title: 'HỢP ĐỒNG BẢN CŨ' });
    // Hợp đồng đổi sau khi in.
    const cur = await request(app).get(base(cid)).set(bearer(owner));
    await request(app).patch(base(cid)).set(bearer(owner)).send({ expectedUpdatedAt: cur.body.updatedAt, notes: 'Ghi chú SAU khi in' }).expect(200);
    // In lại y hệt lần 1: cấu hình + dữ liệu đã chụp, không theo mẫu mới, không theo hợp đồng mới.
    const snap1 = await snapshot(owner, cid, first.id);
    expect(snap1.dataHash).toBe(orig.dataHash);
    expect(snap1.data.contract.notes).toBe('Ghi chú lúc in');
    expect((await pd(owner, cid)).lastPrint?.sameData).toBe(false);
    const again = await printOk(owner, cid, { source: 'REPRINT', basedOnPrintId: first.id, expectedDataHash: snap1.dataHash });
    const re = await db.contractPrint.findUniqueOrThrow({ where: { id: again.id } });
    expect(again).toMatchObject({ source: 'REPRINT', basedOnPrintId: first.id, templateVersion: 1, layout: 2, printNo: 3 });
    expect(re.dataHash).toBe(orig.dataHash);
    expect(re.data).toEqual(orig.data);
    expect(re.config).toEqual(orig.config);
    expect(re.templateVersion).toBe(orig.templateVersion);
    // Tên mẫu hiện tại (đã chụp tên trong config).
    expect(again.templateName).toBe(patched.body.name);
  });

  it('REPRINT bởi người thiếu customers.read → bản chụp che SĐT, hash khác lần gốc; gửi hash bản chưa che → 409', async () => {
    const cid = await newContract();
    const first = await byTemplate(owner, cid);
    const orig = await db.contractPrint.findUniqueOrThrow({ where: { id: first.id } });
    expect((orig.data as { customer: { phone: string } }).customer.phone).toBe('0911222333');
    const seen = await snapshot(noPhone, cid, first.id);
    expect(seen.data.customer).toMatchObject({ phone: null, contactHidden: true });
    expect(seen.dataHash).not.toBe(orig.dataHash);
    expect(seen.warnings.map((x) => x.code)).toContain('CONTACT_HIDDEN');
    const wrong = await sendPrint(noPhone, cid, { source: 'REPRINT', basedOnPrintId: first.id, expectedDataHash: orig.dataHash });
    expect(errOf(wrong.body).details?.reason).toBe('DATA_CHANGED');
    const re = await printOk(noPhone, cid, { source: 'REPRINT', basedOnPrintId: first.id, expectedDataHash: seen.dataHash });
    const row = await db.contractPrint.findUniqueOrThrow({ where: { id: re.id } });
    console.log(`[in lại che] gốc ${orig.dataHash.slice(0, 12)}, người thiếu customers.read ${row.dataHash.slice(0, 12)}`);
    expect((row.data as { customer: { phone: string | null } }).customer.phone).toBeNull();
    expect(row.dataHash).toBe(seen.dataHash);
    expect(row.dataHash).not.toBe(orig.dataHash);
    // Chủ xem lại bản đã che: vẫn che (maskPrintData chỉ che thêm, không mở).
    const ownerView = await snapshot(owner, cid, re.id);
    expect(ownerView.data.customer).toMatchObject({ phone: null, contactHidden: true });
  });
});

describe('cách ly: mã của tổ chức khác / hợp đồng khác → 404 cùng lời với mã bịa', () => {
  it('basedOnPrintId của hợp đồng khác, của tổ chức khác, mã bịa → 404 "Không tìm thấy lần in" giống hệt; mẫu của tổ chức khác → giống mã bịa', async () => {
    const c1 = await newContract();
    const c2 = await newContract();
    const p1 = await byTemplate(owner, c1);
    const hash2 = (await pd(owner, c2)).dataHash;
    const ownerB = await registerUser(app, 'mink-b');
    const orgB = await createAcademyOrg(app, ownerB, 'mink-b');
    const custB = await request(app).post(`/api/v1/orgs/${orgB}/customers`).set(bearer(ownerB)).set('idempotency-key', randomUUID()).send({ fullName: 'Khách B' });
    const cB = await request(app)
      .post(`/api/v1/orgs/${orgB}/contracts`)
      .set(bearer(ownerB))
      .set('idempotency-key', randomUUID())
      .send({ customerId: custB.body.id, lines: [{ kind: 'CUSTOM', name: 'B', unitPrice: 1000, quantity: 1 }] });
    const listB = await request(app).get(`/api/v1/orgs/${orgB}/print-templates?appliesTo=SERVICE`).set(bearer(ownerB));
    const tB = (listB.body.items as { id: string; version: number }[])[0]!;
    const pdB = await pd(ownerB, cB.body.id, orgB);
    const pB = await sendPrint(ownerB, cB.body.id, { source: 'TEMPLATE', templateId: tB.id, expectedTemplateVersion: tB.version, expectedDataHash: pdB.dataHash }, randomUUID(), orgB);
    expect(pB.status).toBe(201);

    for (const source of ['PRIOR_CONFIG', 'REPRINT'] as const) {
      const other = await sendPrint(owner, c2, { source, basedOnPrintId: p1.id, expectedDataHash: hash2 });
      const foreign = await sendPrint(owner, c2, { source, basedOnPrintId: pB.body.id, expectedDataHash: hash2 });
      const fake = await sendPrint(owner, c2, { source, basedOnPrintId: randomUUID(), expectedDataHash: hash2 });
      console.log(`[cách ly ${source}] hợp đồng khác ${other.status}, tổ chức khác ${foreign.status}, mã bịa ${fake.status}: ${errOf(fake.body).message}`);
      expect(fake.status).toBe(404);
      expect(errOf(fake.body).message).toBe('Không tìm thấy lần in');
      expect(noReq(other.body)).toBe(noReq(fake.body));
      expect(noReq(foreign.body)).toBe(noReq(fake.body));
      expect([other.status, foreign.status]).toEqual([404, 404]);
    }
    const t = await templateNow(serviceTemplate.id);
    const foreignT = await sendPrint(owner, c2, { source: 'TEMPLATE', templateId: tB.id, expectedTemplateVersion: tB.version, expectedDataHash: hash2 });
    const fakeT = await sendPrint(owner, c2, { source: 'TEMPLATE', templateId: randomUUID(), expectedTemplateVersion: t.version, expectedDataHash: hash2 });
    expect(foreignT.status).toBe(404);
    expect(errOf(foreignT.body).message).toBe('Không tìm thấy mẫu in');
    expect(noReq(foreignT.body)).toBe(noReq(fakeT.body));
    // Hợp đồng của tổ chức khác trên đường dẫn của tổ chức mình; lần in của hợp đồng khác qua đường 6.
    const crossC = await sendPrint(owner, cB.body.id, { source: 'TEMPLATE', templateId: t.id, expectedTemplateVersion: t.version, expectedDataHash: pdB.dataHash });
    expect([crossC.status, errOf(crossC.body).message]).toEqual([404, 'Không tìm thấy hợp đồng']);
    const view6 = await request(app).get(`${base(c2)}/prints/${p1.id}`).set(bearer(owner));
    const view6fake = await request(app).get(`${base(c2)}/prints/${randomUUID()}`).set(bearer(owner));
    expect(view6.status).toBe(404);
    expect(noReq(view6.body)).toBe(noReq(view6fake.body));
    expect(await rows(c2)).toBe(0);
    expect(await db.contractPrint.count({ where: { organizationId: orgB } })).toBe(1);
  });
});

describe('đua', () => {
  it('10 POST đồng thời cùng hợp đồng → printNo 1..10, không trùng, không hở, lỗi khác = 0', async () => {
    const cid = await newContract();
    const t = await templateNow(serviceTemplate.id);
    const body = { source: 'TEMPLATE', templateId: t.id, expectedTemplateVersion: t.version, expectedDataHash: (await pd(owner, cid)).dataHash };
    const res = await Promise.all(Array.from({ length: 10 }, () => sendPrint(owner, cid, body)));
    const ok = res.filter((r) => r.status === 201);
    const other = res.filter((r) => r.status !== 201);
    const nos = (await db.contractPrint.findMany({ where: { contractId: cid }, select: { printNo: true }, orderBy: { printNo: 'asc' } })).map((r) => r.printNo);
    console.log(`[đua] 201: ${ok.length}/10, lỗi khác: ${other.length} (${other.map((r) => r.status).join(',')}); printNo ${nos.join(',')}`);
    expect(other.length).toBe(0);
    expect(ok.length).toBe(10);
    expect(nos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ok.map((r) => r.body.printNo as number).sort((a, b) => a - b)).toEqual(nos);
  });
});

describe('nhật ký chỉ thêm', () => {
  it('database chặn UPDATE / DELETE dòng nhật ký in (trigger contract_prints_append_only)', async () => {
    const cid = await newContract();
    const p = await byTemplate(owner, cid);
    await expect(db.contractPrint.update({ where: { id: p.id }, data: { printNo: 99 } })).rejects.toThrow();
    await expect(db.contractPrint.delete({ where: { id: p.id } })).rejects.toThrow();
    expect(await rows(cid)).toBe(1);
  });
});
