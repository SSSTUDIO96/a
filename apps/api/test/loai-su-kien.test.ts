// Bản vẽ D mục 2.2 — LOẠI SỰ KIỆN (gói M3): cài sẵn 6 loại, bù cho tổ chức cũ, trùng tên, trần 50, sửa một phần,
// đổi thứ tự (cùng MỘT lời cho mọi danh sách sai), lineCount, quyền, cách ly tổ chức, nhật ký, không có đường xoá.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DEFAULT_OCCASIONS, MAX_OCCASIONS } from '@makeup/shared';
import { syncSystemRoles } from '../src/scripts/sync-system-roles';
import { ORDER_MISMATCH } from '../src/modules/catalog/occasions';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

interface Org {
  id: string;
  owner: TestUser;
}
let A: Org;
let B: Org;
let artistA: TestUser; // chỉ catalog.read
let tutorA: TestUser; // Trợ giảng: không có catalog.read

interface OccasionView {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  lineCount: number;
  createdAt: string;
  updatedAt: string;
}

const url = (orgId: string, rest = '') => `/api/v1/orgs/${orgId}/occasions${rest}`;
const idem = () => `k-${randomUUID()}`;

function post(u: TestUser, orgId: string, body: object, key = idem()) {
  return request(app).post(url(orgId)).set(bearer(u)).set('idempotency-key', key).send(body);
}
function patch(u: TestUser, orgId: string, id: string, body: object) {
  return request(app).patch(url(orgId, `/${id}`)).set(bearer(u)).send(body);
}
function putOrder(u: TestUser, orgId: string, occasionIds: unknown) {
  return request(app).put(url(orgId, '/order')).set(bearer(u)).send({ occasionIds });
}
async function list(u: TestUser, orgId: string, query = ''): Promise<OccasionView[]> {
  const res = await request(app).get(url(orgId, query)).set(bearer(u)).expect(200);
  return res.body.items as OccasionView[];
}

async function newOrg(label: string): Promise<Org> {
  const owner = await registerUser(app, `lsk-${label}`);
  return { id: await createOrg(app, owner, `lsk-${label}`), owner };
}

beforeAll(async () => {
  app = makeApp(deps);
  A = await newOrg('a');
  B = await newOrg('b');
  artistA = await registerUser(app, 'lsk-tho');
  await addMember(app, A.owner, A.id, artistA, ['artist']);
  tutorA = await registerUser(app, 'lsk-trogiang');
  await addMember(app, A.owner, A.id, tutorA, ['teaching_assistant']);
});

afterAll(async () => {
  await db.$disconnect();
});

describe('cài sẵn 6 loại sự kiện', () => {
  it('tổ chức mới có đúng 6 loại mặc định, đúng tên, đúng màu, đúng thứ tự, đang bật, chưa dòng nào dùng', async () => {
    const items = await list(A.owner, A.id);
    expect(items.map((o) => ({ name: o.name, color: o.color, sortOrder: o.sortOrder, isActive: o.isActive, lineCount: o.lineCount }))).toEqual(
      DEFAULT_OCCASIONS.map((d, i) => ({ name: d.name, color: d.color, sortOrder: i, isActive: true, lineCount: 0 })),
    );
    // Phản hồi đúng khuôn OccasionView — không lộ organizationId.
    expect(Object.keys(items[0]!).sort()).toEqual(['color', 'createdAt', 'id', 'isActive', 'lineCount', 'name', 'sortOrder', 'updatedAt']);
  });

  it('sync-system-roles bù 6 loại cho tổ chức 0 loại (ghi +occasions); chạy lần hai không thêm; tổ chức đã có loại không bị thêm', async () => {
    const old = await newOrg('cu');
    await db.occasion.deleteMany({ where: { organizationId: old.id } }); // giả lập tổ chức tạo trước bản vẽ D
    const kept = await newOrg('da-co');
    // Tổ chức đã tự đổi bộ loại: chỉ còn 1 loại → không được bù.
    const keptIds = (await list(kept.owner, kept.id)).map((o) => o.id);
    await db.occasion.deleteMany({ where: { organizationId: kept.id, id: { in: keptIds.slice(1) } } });

    const first = await syncSystemRoles(db);
    expect(first.occasionSetsSeeded).toBeGreaterThanOrEqual(1);
    const seeded = await list(old.owner, old.id);
    expect(seeded.map((o) => [o.name, o.color, o.sortOrder])).toEqual(DEFAULT_OCCASIONS.map((d, i) => [d.name, d.color, i]));
    expect(await db.occasion.count({ where: { organizationId: kept.id } })).toBe(1);
    const log = await db.auditLog.findFirstOrThrow({
      where: { organizationId: old.id, action: 'role.system_synced' },
      orderBy: { createdAt: 'desc' },
    });
    expect((log.data as { changes: string[] }).changes).toContain('+occasions');

    const second = await syncSystemRoles(db);
    expect(second.occasionSetsSeeded).toBe(0);
    expect(await db.occasion.count({ where: { organizationId: old.id } })).toBe(DEFAULT_OCCASIONS.length);
  });
});

describe('thêm / sửa', () => {
  it('thêm → 201 OccasionView; trùng tên (kể cả thừa khoảng trắng) → 409 đúng lời; tổ chức khác dùng cùng tên được', async () => {
    const r = await post(A.owner, A.id, { name: 'Tiệc tất niên', color: 'brick' }).expect(201);
    expect(r.body).toMatchObject({ name: 'Tiệc tất niên', color: 'brick', sortOrder: 0, isActive: true, lineCount: 0 });
    const dup = await post(A.owner, A.id, { name: '  Tiệc tất niên ', color: 'rose' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('Tên loại sự kiện đã có trong tổ chức');
    await post(B.owner, B.id, { name: 'Tiệc tất niên', color: 'plum' }).expect(201);
  });

  it('dữ liệu sai → 400 tiếng Việt đúng ô: màu ngoài 12 màu, tên rỗng, tên > 60 ký tự, trường lạ, thiếu màu, thiếu khoá chống gửi trùng', async () => {
    const cases: [object, string][] = [
      [{ name: 'X1', color: 'red' }, 'color'],
      [{ name: '   ', color: 'rose' }, 'name'],
      [{ name: 'ễ'.repeat(61), color: 'rose' }, 'name'],
      [{ name: 'X2' }, 'color'],
      [{ name: 'X3', color: 'rose', sortOrder: -1 }, 'sortOrder'],
    ];
    for (const [body, path] of cases) {
      const res = await post(A.owner, A.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      const issues = res.body.error.details.issues as { path: string; message: string }[];
      expect(issues.map((i) => i.path)).toContain(path);
      expect(JSON.stringify(issues)).not.toMatch(/Invalid|expected|Too (small|big)/);
    }
    const strange = await post(A.owner, A.id, { name: 'X4', color: 'rose', organizationId: B.id });
    expect(strange.status).toBe(400);
    expect(JSON.stringify(strange.body)).toContain('Không nhận trường: organizationId');
    const noKey = await request(app).post(url(A.id)).set(bearer(A.owner)).send({ name: 'X5', color: 'rose' });
    expect(noKey.status).toBe(400);
    expect(noKey.body.error.message).toMatch(/Idempotency-Key/);
    expect(await db.occasion.count({ where: { organizationId: A.id, name: { in: ['X1', 'X2', 'X3', 'X4', 'X5'] } } })).toBe(0);
  });

  it('gửi lại cùng khoá chống gửi trùng → cùng kết quả, chỉ một dòng', async () => {
    const key = idem();
    const r1 = await post(A.owner, A.id, { name: 'Sinh nhật', color: 'olive' }, key).expect(201);
    const r2 = await post(A.owner, A.id, { name: 'Sinh nhật', color: 'olive' }, key).expect(201);
    expect(r2.body.id).toBe(r1.body.id);
    expect(await db.occasion.count({ where: { organizationId: A.id, name: 'Sinh nhật' } })).toBe(1);
  });

  it('PATCH một trường giữ nguyên các trường khác; thân rỗng → 400 "Không có gì để sửa"; trùng tên → 409', async () => {
    const created = (await post(A.owner, A.id, { name: 'Lễ báo hỷ', color: 'forest', sortOrder: 9, isActive: true }).expect(201)).body as OccasionView;
    const r = await patch(A.owner, A.id, created.id, { color: 'petrol' }).expect(200);
    expect(r.body).toMatchObject({ id: created.id, name: 'Lễ báo hỷ', color: 'petrol', sortOrder: 9, isActive: true, lineCount: 0 });
    const r2 = await patch(A.owner, A.id, created.id, { isActive: false }).expect(200);
    expect(r2.body).toMatchObject({ name: 'Lễ báo hỷ', color: 'petrol', sortOrder: 9, isActive: false });
    // Ẩn rồi lọc theo isActive.
    expect((await list(A.owner, A.id, '?isActive=false')).map((o) => o.id)).toContain(created.id);
    expect((await list(A.owner, A.id, '?isActive=true')).map((o) => o.id)).not.toContain(created.id);

    const empty = await patch(A.owner, A.id, created.id, {});
    expect(empty.status).toBe(400);
    expect(JSON.stringify(empty.body)).toContain('Không có gì để sửa');
    const dup = await patch(A.owner, A.id, created.id, { name: 'Lễ cưới' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('Tên loại sự kiện đã có trong tổ chức');
    const bad = await patch(A.owner, A.id, created.id, { color: 'Rose' });
    expect(bad.status).toBe(400);
  });

  it(`quá ${MAX_OCCASIONS} loại → 409 "Tối đa ${MAX_OCCASIONS} loại sự kiện"; không ghi thêm`, async () => {
    const org = await newOrg('tran');
    const have = (await list(org.owner, org.id)).length;
    for (let i = have; i < MAX_OCCASIONS; i++) await post(org.owner, org.id, { name: `Loại ${i}`, color: 'blue' }).expect(201);
    const over = await post(org.owner, org.id, { name: 'Loại thừa', color: 'blue' });
    expect(over.status).toBe(409);
    expect(over.body.error.message).toBe(`Tối đa ${MAX_OCCASIONS} loại sự kiện`);
    expect(await db.occasion.count({ where: { organizationId: org.id } })).toBe(MAX_OCCASIONS);
  });
});

describe('đổi thứ tự (PUT /occasions/order)', () => {
  it('đủ danh sách → 200, sortOrder = vị trí; thiếu / thừa / trùng / mã bịa / mã của tổ chức khác → CÙNG 400 CÙNG lời, không đổi gì', async () => {
    const org = await newOrg('thu-tu');
    const other = await list(B.owner, B.id);
    const ids = (await list(org.owner, org.id)).map((o) => o.id);
    const reversed = [...ids].reverse();
    const ok = await putOrder(org.owner, org.id, reversed).expect(200);
    expect((ok.body.items as OccasionView[]).map((o) => [o.id, o.sortOrder])).toEqual(reversed.map((id, i) => [id, i]));

    const bad: [string, string[]][] = [
      ['thiếu một loại', reversed.slice(1)],
      ['thừa mã bịa', [...reversed, randomUUID()]],
      ['trùng một loại (đủ độ dài)', [...reversed.slice(0, -1), reversed[0]!]],
      ['thay một loại bằng mã bịa', [...reversed.slice(0, -1), randomUUID()]],
      ['thay một loại bằng mã của tổ chức khác', [...reversed.slice(0, -1), other[0]!.id]],
      ['thừa mã của tổ chức khác', [...reversed, other[0]!.id]],
    ];
    const answers = new Set<string>();
    for (const [label, body] of bad) {
      const res = await putOrder(org.owner, org.id, body);
      expect(res.status, label).toBe(400);
      expect(res.body.error.message, label).toBe(ORDER_MISMATCH);
      answers.add(JSON.stringify({ s: res.status, c: res.body.error.code, m: res.body.error.message, d: res.body.error.details ?? null }));
    }
    expect(answers.size).toBe(1);
    // Không đổi thứ tự của tổ chức mình, không đụng tổ chức khác.
    expect((await list(org.owner, org.id)).map((o) => o.id)).toEqual(reversed);
    expect((await list(B.owner, B.id)).map((o) => [o.id, o.sortOrder])).toEqual(other.map((o) => [o.id, o.sortOrder]));
    // Danh sách rỗng / không phải uuid → 400 do zod.
    expect((await putOrder(org.owner, org.id, [])).status).toBe(400);
    expect((await putOrder(org.owner, org.id, ['abc'])).status).toBe(400);
  });
});

describe('lineCount', () => {
  it('đếm dòng hợp đồng CHƯA HUỶ có occasion_id; bỏ dòng đã huỷ; không đếm dòng của loại khác / tổ chức khác', async () => {
    const org = await newOrg('dem');
    const [wedding, party] = await list(org.owner, org.id);
    const tag = randomUUID().slice(0, 6);
    const pkg = await db.servicePackage.create({ data: { organizationId: org.id, code: `GOI-${tag}`, name: `Gói ${tag}`, durationMinutes: 60 } });
    const customer = await db.customer.create({ data: { organizationId: org.id, fullName: `Khách ${tag}` } });
    const contract = await db.contract.create({ data: { organizationId: org.id, code: `HD-${tag}`, customerId: customer.id, createdById: org.owner.id } });
    const line = (occ: OccasionView, voided = false) =>
      db.contractLine.create({
        data: {
          organizationId: org.id,
          contractId: contract.id,
          kind: 'PACKAGE',
          packageId: pkg.id,
          name: 'Dòng thử',
          unitPrice: 0n,
          lineTotal: 0n,
          createdById: org.owner.id,
          occasionId: occ.id,
          occasionName: occ.name,
          ...(voided ? { voidedAt: new Date(), voidReason: 'Khách đổi ý' } : {}),
        },
      });
    await line(wedding!);
    await line(wedding!);
    await line(wedding!, true);
    await line(party!);
    const counts = new Map((await list(org.owner, org.id)).map((o) => [o.id, o.lineCount]));
    expect(counts.get(wedding!.id)).toBe(2);
    expect(counts.get(party!.id)).toBe(1);
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(3);
    // PATCH trả lineCount thật; đổi tên không đổi bản chụp tên ở dòng hợp đồng.
    const r = await patch(org.owner, org.id, wedding!.id, { name: 'Ăn hỏi (đổi tên)' }).expect(200);
    expect(r.body.lineCount).toBe(2);
    const names = await db.contractLine.findMany({ where: { contractId: contract.id, occasionId: wedding!.id }, select: { occasionName: true } });
    expect(names.every((n) => n.occasionName === wedding!.name)).toBe(true);

    // Không có đường xoá; database chặn xoá loại đang được dòng hợp đồng dùng (khoá ngoại RESTRICT).
    const del = await request(app).delete(url(org.id, `/${wedding!.id}`)).set(bearer(org.owner));
    expect(del.status).toBe(404);
    expect(del.body.error.message).toBe('Không có đường API này');
    await expect(db.occasion.delete({ where: { id: wedding!.id } })).rejects.toThrow();
    expect(await db.occasion.count({ where: { id: wedding!.id } })).toBe(1);
  });
});

describe('quyền và cách ly tổ chức', () => {
  it('thợ (chỉ catalog.read) xem được; POST / PATCH / PUT → 403 và không đổi gì; trợ giảng (không catalog.read) GET → 403', async () => {
    const items = await list(artistA, A.id);
    expect(items.length).toBeGreaterThanOrEqual(DEFAULT_OCCASIONS.length);
    const p = await post(artistA, A.id, { name: 'Thợ thêm', color: 'rose' });
    expect(p.status).toBe(403);
    expect(p.body.error.details).toMatchObject({ required: 'catalog.write' });
    expect((await patch(artistA, A.id, items[0]!.id, { name: 'Thợ sửa' })).status).toBe(403);
    expect((await putOrder(artistA, A.id, items.map((o) => o.id))).status).toBe(403);
    expect((await request(app).get(url(A.id)).set(bearer(tutorA))).status).toBe(403);
    expect(await db.occasion.count({ where: { organizationId: A.id, name: { in: ['Thợ thêm', 'Thợ sửa'] } } })).toBe(0);
    expect((await request(app).get(url(A.id))).status).toBe(401);
  });

  it('mã loại của tổ chức khác = mã bịa: PATCH qua tổ chức mình → 404 giống hệt; người ngoài gọi đường của A → 404 tổ chức; GET không lộ', async () => {
    const aItem = (await list(A.owner, A.id))[0]!;
    const cross = await patch(B.owner, B.id, aItem.id, { name: 'Chiếm' });
    const fake = await patch(B.owner, B.id, randomUUID(), { name: 'Chiếm' });
    expect(cross.status).toBe(404);
    expect(cross.body.error.message).toBe('Không tìm thấy loại sự kiện');
    expect({ c: cross.body.error.code, m: cross.body.error.message }).toEqual({ c: fake.body.error.code, m: fake.body.error.message });

    const outsider = await patch(B.owner, A.id, aItem.id, { name: 'Chiếm' });
    expect(outsider.status).toBe(404);
    expect(outsider.body.error.message).toBe('Không tìm thấy tổ chức');
    expect((await request(app).get(url(A.id)).set(bearer(B.owner))).status).toBe(404);
    expect((await post(B.owner, A.id, { name: 'Chen', color: 'rose' })).status).toBe(404);

    const bIds = new Set((await list(B.owner, B.id)).map((o) => o.id));
    const aIds = (await list(A.owner, A.id)).map((o) => o.id);
    expect(aIds.filter((id) => bIds.has(id))).toEqual([]);
    expect((await db.occasion.findUniqueOrThrow({ where: { id: aItem.id } })).name).toBe(aItem.name);
  });
});

describe('nhật ký', () => {
  it('có đủ occasion.created (data = thân), occasion.updated ({ before, after }), occasion.reordered ({ before: id[], after: id[] })', async () => {
    const org = await newOrg('nk');
    const c = (await post(org.owner, org.id, { name: 'Thôi nôi', color: 'brown' }).expect(201)).body as OccasionView;
    await patch(org.owner, org.id, c.id, { color: 'plum' }).expect(200);
    const ids = (await list(org.owner, org.id)).map((o) => o.id);
    await putOrder(org.owner, org.id, [...ids].reverse()).expect(200);
    const logs = await db.auditLog.findMany({ where: { organizationId: org.id, entityType: 'occasion' }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['occasion.created', 'occasion.updated', 'occasion.reordered']);
    expect(logs[0]).toMatchObject({ entityId: c.id, actorUserId: org.owner.id, data: { name: 'Thôi nôi', color: 'brown' } });
    expect(logs[1]!.data).toEqual({ before: { name: 'Thôi nôi', color: 'brown', sortOrder: 0, isActive: true }, after: { color: 'plum' } });
    expect(logs[2]!.data).toEqual({ before: ids, after: [...ids].reverse() });
  });
});
