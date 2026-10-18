import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { resolveCurrentPrice } from '../src/modules/catalog/prices';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let ownerA: TestUser;
let ownerB: TestUser;
let artistA: TestUser;
let catalogOnlyA: TestUser;
let orgA: string;
let orgB: string;

const url = (org: string, p: string) => `/api/v1/orgs/${org}${p}`;
const uniq = () => randomUUID().slice(0, 6).toUpperCase();
const idem = () => ({ 'idempotency-key': `k-${randomUUID()}` });

type Body = Record<string, unknown>;

async function newService(u: TestUser, org: string, extra: Body = {}) {
  const res = await request(app)
    .post(url(org, '/services'))
    .set(bearer(u))
    .send({ code: `DV-${uniq()}`, name: `Dịch vụ ${uniq()}`, durationMinutes: 60, listPrice: 1_000_000, ...extra });
  if (res.status !== 201) throw new Error(`Tạo dịch vụ thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as { id: string; code: string; kind: string; currentPrice: Body | null };
}

async function newPackage(u: TestUser, org: string, extra: Body = {}) {
  const res = await request(app)
    .post(url(org, '/packages'))
    .set(bearer(u))
    .send({ code: `GOI-${uniq()}`, name: `Gói ${uniq()}`, durationMinutes: 120, listPrice: 3_000_000, ...extra });
  if (res.status !== 201) throw new Error(`Tạo gói thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as { id: string };
}

function changePrice(u: TestUser, org: string, path: string, body: Body, headers: Record<string, string> = idem()) {
  return request(app).post(url(org, path)).set(bearer(u)).set(headers).send(body);
}

beforeAll(async () => {
  app = makeApp(deps);
  ownerA = await registerUser(app, 'chu-a');
  ownerB = await registerUser(app, 'chu-b');
  artistA = await registerUser(app, 'tho-a');
  catalogOnlyA = await registerUser(app, 'chi-sua-dv-a');
  orgA = await createOrg(app, ownerA, 'bang-gia-a');
  orgB = await createOrg(app, ownerB, 'bang-gia-b');
  await addMember(app, ownerA, orgA, artistA, ['artist']);
  await request(app)
    .post(url(orgA, '/roles'))
    .set(bearer(ownerA))
    .send({ key: 'chi_dich_vu', name: 'Chỉ sửa dịch vụ', permissions: ['catalog.read', 'catalog.write'] })
    .expect(201);
  await addMember(app, ownerA, orgA, catalogOnlyA, ['chi_dich_vu']);
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('danh mục dịch vụ', () => {
  it('tạo, trùng tên → 409, đổi tên/thứ tự/tắt, lọc theo hoạt động', async () => {
    const name = `Trang điểm ${uniq()}`;
    const c = await request(app).post(url(orgA, '/service-categories')).set(bearer(ownerA)).send({ name }).expect(201);
    const dup = await request(app).post(url(orgA, '/service-categories')).set(bearer(ownerA)).send({ name });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('Tên danh mục đã có trong tổ chức');
    const p = await request(app)
      .patch(url(orgA, `/service-categories/${c.body.id}`))
      .set(bearer(ownerA))
      .send({ name: `${name} mới`, sortOrder: 5, isActive: false })
      .expect(200);
    expect(p.body).toMatchObject({ name: `${name} mới`, sortOrder: 5, isActive: false });
    const active = await request(app).get(url(orgA, '/service-categories?isActive=true')).set(bearer(ownerA)).expect(200);
    expect(active.body.items.map((x: { id: string }) => x.id)).not.toContain(c.body.id);
    const inactive = await request(app).get(url(orgA, '/service-categories?isActive=false')).set(bearer(ownerA)).expect(200);
    expect(inactive.body.items.map((x: { id: string }) => x.id)).toContain(c.body.id);
  });

  it('PATCH rỗng → 400', async () => {
    const c = await request(app).post(url(orgA, '/service-categories')).set(bearer(ownerA)).send({ name: `DM ${uniq()}` }).expect(201);
    await request(app).patch(url(orgA, `/service-categories/${c.body.id}`)).set(bearer(ownerA)).send({}).expect(400);
  });
});

describe('dịch vụ', () => {
  it('tạo kèm giá đầu tiên; mã viết thường được đổi thành hoa; trùng mã → 409', async () => {
    const code = `mk-${uniq().toLowerCase()}`;
    const s = await newService(ownerA, orgA, { code, listPrice: 1_500_000 });
    expect(s.code).toBe(code.toUpperCase());
    expect(s.kind).toBe('MAIN');
    expect(s.currentPrice).toMatchObject({ listPrice: 1_500_000, salePrice: null, unitPrice: 1_500_000 });
    expect(typeof s.currentPrice?.effectiveFrom).toBe('string');
    const dup = await request(app)
      .post(url(orgA, '/services'))
      .set(bearer(ownerA))
      .send({ code: code.toUpperCase(), name: 'Khác', durationMinutes: 30, listPrice: 1 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('Mã dịch vụ đã có trong tổ chức');
    const versions = await deps.db.priceVersion.count({ where: { serviceId: s.id } });
    expect(versions).toBe(1);
  });

  it('cùng mã ở tổ chức khác thì được', async () => {
    const code = `CHUNG-${uniq()}`;
    await newService(ownerA, orgA, { code });
    await newService(ownerB, orgB, { code });
  });

  it('PATCH sửa thông tin; gửi giá vào PATCH → 400 nói rõ', async () => {
    const s = await newService(ownerA, orgA);
    const p = await request(app)
      .patch(url(orgA, `/services/${s.id}`))
      .set(bearer(ownerA))
      .send({ name: 'Makeup cô dâu', durationMinutes: 90, isPublic: true })
      .expect(200);
    expect(p.body).toMatchObject({ name: 'Makeup cô dâu', durationMinutes: 90, isPublic: true });
    expect(p.body.currentPrice.listPrice).toBe(1_000_000);
    const bad = await request(app).patch(url(orgA, `/services/${s.id}`)).set(bearer(ownerA)).send({ listPrice: 5 });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body.error.details)).toContain('Không nhận trường: listPrice');
  });

  it('lọc theo danh mục, hoạt động, loại, từ khoá (tên/mã); phân trang', async () => {
    const cat = await request(app).post(url(orgA, '/service-categories')).set(bearer(ownerA)).send({ name: `Lọc ${uniq()}` }).expect(201);
    const tag = uniq();
    const a = await newService(ownerA, orgA, { categoryId: cat.body.id, name: `Tóc cô dâu ${tag}` });
    const b = await newService(ownerA, orgA, { categoryId: cat.body.id, code: `NAIL-${tag}`, isActive: false });
    const c = await newService(ownerA, orgA, { categoryId: cat.body.id, kind: 'ADDON', name: `Lens ${tag}` });
    const byCat = await request(app).get(url(orgA, `/services?categoryId=${cat.body.id}`)).set(bearer(ownerA)).expect(200);
    expect(byCat.body.total).toBe(3);
    const active = await request(app)
      .get(url(orgA, `/services?categoryId=${cat.body.id}&isActive=true`))
      .set(bearer(ownerA))
      .expect(200);
    expect(active.body.items.map((x: { id: string }) => x.id).sort()).toEqual([a.id, c.id].sort());
    const byName = await request(app).get(url(orgA, `/services?q=${encodeURIComponent(`tóc cô dâu ${tag}`)}`)).set(bearer(ownerA)).expect(200);
    expect(byName.body.items.map((x: { id: string }) => x.id)).toEqual([a.id]);
    const byCode = await request(app).get(url(orgA, `/services?q=nail-${tag.toLowerCase()}`)).set(bearer(ownerA)).expect(200);
    expect(byCode.body.items.map((x: { id: string }) => x.id)).toEqual([b.id]);
    const addons = await request(app)
      .get(url(orgA, `/services?categoryId=${cat.body.id}&kind=ADDON`))
      .set(bearer(ownerA))
      .expect(200);
    expect(addons.body.items.map((x: { id: string; kind: string }) => [x.id, x.kind])).toEqual([[c.id, 'ADDON']]);
    const page2 = await request(app)
      .get(url(orgA, `/services?categoryId=${cat.body.id}&pageSize=2&page=2`))
      .set(bearer(ownerA))
      .expect(200);
    expect(page2.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(page2.body.items).toHaveLength(1);
    await request(app).get(url(orgA, '/services?kind=KHAC')).set(bearer(ownerA)).expect(400);
  });

  it('danh mục của tổ chức khác → 400', async () => {
    const catB = await request(app).post(url(orgB, '/service-categories')).set(bearer(ownerB)).send({ name: `B ${uniq()}` }).expect(201);
    const res = await request(app)
      .post(url(orgA, '/services'))
      .set(bearer(ownerA))
      .send({ code: `X-${uniq()}`, name: 'X', durationMinutes: 30, listPrice: 1, categoryId: catB.body.id });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Danh mục không tồn tại trong tổ chức');
  });

  it('dịch vụ phụ và phụ phí cũng có phiên bản giá', async () => {
    const addon = await newService(ownerA, orgA, { kind: 'ADDON', listPrice: 300_000 });
    const sur = await newService(ownerA, orgA, { kind: 'SURCHARGE', listPrice: 200_000 });
    await changePrice(ownerA, orgA, `/services/${addon.id}/prices`, { listPrice: 350_000 }).expect(201);
    await changePrice(ownerA, orgA, `/services/${sur.id}/prices`, { listPrice: 250_000 }).expect(201);
    const a = await request(app).get(url(orgA, `/services/${addon.id}`)).set(bearer(ownerA)).expect(200);
    const s = await request(app).get(url(orgA, `/services/${sur.id}`)).set(bearer(ownerA)).expect(200);
    expect([a.body.kind, a.body.currentPrice.unitPrice]).toEqual(['ADDON', 350_000]);
    expect([s.body.kind, s.body.currentPrice.unitPrice]).toEqual(['SURCHARGE', 250_000]);
  });
});

describe('phiên bản giá', () => {
  it('đổi giá → giá hiện hành đổi, lịch sử giữ đủ (mới nhất trước), nhật ký ghi giá cũ → giá mới và người đổi', async () => {
    const s = await newService(ownerA, orgA, { listPrice: 1_000_000 });
    const r = await changePrice(ownerA, orgA, `/services/${s.id}/prices`, { listPrice: 1_200_000, note: 'Tăng giá mùa cưới' }).expect(201);
    expect(r.body).toMatchObject({ listPrice: 1_200_000, unitPrice: 1_200_000, status: 'CURRENT', note: 'Tăng giá mùa cưới' });
    expect(r.body.createdBy.id).toBe(ownerA.id);
    const cur = await request(app).get(url(orgA, `/services/${s.id}`)).set(bearer(ownerA)).expect(200);
    expect(cur.body.currentPrice.listPrice).toBe(1_200_000);
    const hist = await request(app).get(url(orgA, `/services/${s.id}/prices`)).set(bearer(ownerA)).expect(200);
    expect(hist.body.total).toBe(2);
    expect(hist.body.items.map((v: { listPrice: number; status: string }) => [v.listPrice, v.status])).toEqual([
      [1_200_000, 'CURRENT'],
      [1_000_000, 'PAST'],
    ]);
    const logs = await request(app).get(url(orgA, '/audit-logs?pageSize=100')).set(bearer(ownerA)).expect(200);
    const log = logs.body.items.find(
      (l: { action: string; entityId: string; data: { after: { listPrice: number } } }) =>
        l.action === 'price.created' && l.entityId === s.id && l.data.after.listPrice === 1_200_000,
    );
    expect(log.actor.id).toBe(ownerA.id);
    expect(log.data.before).toMatchObject({ listPrice: 1_000_000, salePrice: null });
    expect(log.data.after).toMatchObject({ listPrice: 1_200_000, salePrice: null });
  });

  it('giá hẹn tương lai chưa áp dụng; đến ngày thì công thức tra giá trả giá mới', async () => {
    const s = await newService(ownerA, orgA, { listPrice: 1_000_000 });
    const future = new Date(Date.now() + 7 * 24 * 3600_000);
    const r = await changePrice(ownerA, orgA, `/services/${s.id}/prices`, {
      listPrice: 1_500_000,
      effectiveFrom: future.toISOString(),
    }).expect(201);
    expect(r.body.status).toBe('SCHEDULED');
    const cur = await request(app).get(url(orgA, `/services/${s.id}`)).set(bearer(ownerA)).expect(200);
    expect(cur.body.currentPrice.listPrice).toBe(1_000_000);
    const hist = await request(app).get(url(orgA, `/services/${s.id}/prices`)).set(bearer(ownerA)).expect(200);
    expect(hist.body.items.map((v: { status: string }) => v.status)).toEqual(['SCHEDULED', 'CURRENT']);
    const later = await resolveCurrentPrice(deps.db, orgA, { serviceId: s.id }, new Date(future.getTime() + 1000));
    expect(later?.listPrice).toBe(1_500_000n);
  });

  it('đặt giá lùi về quá khứ → 400', async () => {
    const s = await newService(ownerA, orgA);
    const res = await changePrice(ownerA, orgA, `/services/${s.id}/prices`, {
      listPrice: 900_000,
      effectiveFrom: new Date(Date.now() - 24 * 3600_000).toISOString(),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('quá khứ');
  });

  it('giá khuyến mại: giá áp dụng = giá khuyến mại; khuyến mại cao hơn niêm yết → 400', async () => {
    const s = await newService(ownerA, orgA, { listPrice: 1_000_000, salePrice: 800_000 });
    expect(s.currentPrice).toMatchObject({ listPrice: 1_000_000, salePrice: 800_000, unitPrice: 800_000 });
    const bad = await changePrice(ownerA, orgA, `/services/${s.id}/prices`, { listPrice: 1_000_000, salePrice: 1_100_000 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe('Giá khuyến mại không được lớn hơn giá niêm yết');
    const badCreate = await request(app)
      .post(url(orgA, '/services'))
      .set(bearer(ownerA))
      .send({ code: `KM-${uniq()}`, name: 'KM', durationMinutes: 30, listPrice: 100, salePrice: 101 });
    expect(badCreate.status).toBe(400);
    expect(badCreate.body.error.message).toBe('Giá khuyến mại không được lớn hơn giá niêm yết');
  });

  it('chống gửi trùng: thiếu Idempotency-Key → 400; gửi lại cùng khoá chỉ tạo một phiên bản', async () => {
    const s = await newService(ownerA, orgA);
    await changePrice(ownerA, orgA, `/services/${s.id}/prices`, { listPrice: 5 }, {}).expect(400);
    const headers = idem();
    const r1 = await changePrice(ownerA, orgA, `/services/${s.id}/prices`, { listPrice: 1_100_000 }, headers).expect(201);
    const r2 = await changePrice(ownerA, orgA, `/services/${s.id}/prices`, { listPrice: 1_100_000 }, headers).expect(201);
    expect(r2.body.id).toBe(r1.body.id);
    expect(await deps.db.priceVersion.count({ where: { serviceId: s.id } })).toBe(2);
  });

  it('số tiền lớn (2 tỷ, 9 nghìn tỷ) lưu/đọc đúng; số lẻ, số âm, chuỗi, vượt ngưỡng an toàn → 400', async () => {
    const s = await newService(ownerA, orgA, { listPrice: 2_000_000_000 });
    expect(s.currentPrice?.listPrice).toBe(2_000_000_000);
    await changePrice(ownerA, orgA, `/services/${s.id}/prices`, { listPrice: 9_000_000_000_000 }).expect(201);
    const cur = await request(app).get(url(orgA, `/services/${s.id}`)).set(bearer(ownerA)).expect(200);
    expect(cur.body.currentPrice.listPrice).toBe(9_000_000_000_000);
    const row = await deps.db.priceVersion.findFirstOrThrow({ where: { serviceId: s.id }, orderBy: { createdAt: 'desc' } });
    expect(row.listPrice).toBe(9_000_000_000_000n);
    for (const listPrice of [1500.5, -1, '1000', Number.MAX_SAFE_INTEGER + 1]) {
      const res = await changePrice(ownerA, orgA, `/services/${s.id}/prices`, { listPrice });
      expect(res.status, `listPrice=${String(listPrice)}`).toBe(400);
    }
    const odd = await request(app)
      .post(url(orgA, '/services'))
      .set(bearer(ownerA))
      .send({ code: `LE-${uniq()}`, name: 'Lẻ', durationMinutes: 30, listPrice: 1500.5 });
    expect(odd.status).toBe(400);
    expect(JSON.stringify(odd.body.error.details)).toContain('Số tiền phải là số nguyên đồng');
  });

  it('database từ chối sửa/xoá trực tiếp price_versions và giá khuyến mại cao hơn niêm yết', async () => {
    const s = await newService(ownerA, orgA);
    const v = await deps.db.priceVersion.findFirstOrThrow({ where: { serviceId: s.id } });
    await expect(deps.db.priceVersion.update({ where: { id: v.id }, data: { listPrice: 1n } })).rejects.toThrow(/chỉ được ghi thêm/);
    await expect(deps.db.priceVersion.delete({ where: { id: v.id } })).rejects.toThrow(/chỉ được ghi thêm/);
    await expect(
      deps.db.priceVersion.create({
        data: { organizationId: orgA, serviceId: s.id, listPrice: 100n, salePrice: 200n, effectiveFrom: new Date(), createdById: ownerA.id },
      }),
    ).rejects.toThrow(/price_versions_amounts/);
    const after = await deps.db.priceVersion.findUniqueOrThrow({ where: { id: v.id } });
    expect(after.listPrice).toBe(v.listPrice);
  });

  it('giá cả trang (một truy vấn) khớp công thức tra từng dịch vụ', async () => {
    const cat = await request(app).post(url(orgA, '/service-categories')).set(bearer(ownerA)).send({ name: `So ${uniq()}` }).expect(201);
    const s1 = await newService(ownerA, orgA, { categoryId: cat.body.id, listPrice: 100, salePrice: 90 });
    const s2 = await newService(ownerA, orgA, { categoryId: cat.body.id, listPrice: 200 });
    await changePrice(ownerA, orgA, `/services/${s2.id}/prices`, { listPrice: 250 }).expect(201);
    await changePrice(ownerA, orgA, `/services/${s1.id}/prices`, {
      listPrice: 999,
      effectiveFrom: new Date(Date.now() + 3600_000).toISOString(),
    }).expect(201);
    const list = await request(app).get(url(orgA, `/services?categoryId=${cat.body.id}`)).set(bearer(ownerA)).expect(200);
    expect(list.body.items).toHaveLength(2);
    for (const item of list.body.items as { id: string; currentPrice: { priceVersionId: string; unitPrice: number } }[]) {
      const one = await resolveCurrentPrice(deps.db, orgA, { serviceId: item.id });
      expect(item.currentPrice.priceVersionId).toBe(one?.priceVersionId);
      expect(BigInt(item.currentPrice.unitPrice)).toBe(one?.unitPrice);
    }
  });
});

describe('quyền', () => {
  it('thợ makeup (artist) xem được nhưng không sửa/đổi giá được (403)', async () => {
    const s = await newService(ownerA, orgA);
    const p = await newPackage(ownerA, orgA);
    await request(app).get(url(orgA, '/services')).set(bearer(artistA)).expect(200);
    await request(app).get(url(orgA, `/services/${s.id}/prices`)).set(bearer(artistA)).expect(200);
    await request(app).get(url(orgA, '/packages')).set(bearer(artistA)).expect(200);
    await request(app).get(url(orgA, '/travel-fee-policy')).set(bearer(artistA)).expect(200);
    const denied = [
      request(app).post(url(orgA, '/services')).set(bearer(artistA)).send({ code: 'X1', name: 'X', durationMinutes: 30, listPrice: 1 }),
      request(app).patch(url(orgA, `/services/${s.id}`)).set(bearer(artistA)).send({ name: 'Đổi' }),
      changePrice(artistA, orgA, `/services/${s.id}/prices`, { listPrice: 1 }),
      request(app).post(url(orgA, '/packages')).set(bearer(artistA)).send({ code: 'G1', name: 'G', durationMinutes: 30, listPrice: 1 }),
      request(app).patch(url(orgA, `/packages/${p.id}`)).set(bearer(artistA)).send({ name: 'Đổi' }),
      changePrice(artistA, orgA, `/packages/${p.id}/prices`, { listPrice: 1 }),
      request(app).post(url(orgA, '/service-categories')).set(bearer(artistA)).send({ name: 'X' }),
      request(app).post(url(orgA, '/makeup-subjects')).set(bearer(artistA)).send({ name: 'X' }),
      request(app).post(url(orgA, '/studio-locations')).set(bearer(artistA)).send({ name: 'X', address: 'Y' }),
      request(app)
        .put(url(orgA, '/travel-fee-policy'))
        .set(bearer(artistA))
        .send({ defaultMode: 'FIXED', fixedAmount: 1, perKmAmount: 0, freeKm: 0, minimumAmount: 0, roundTrip: false }),
    ];
    const statuses = (await Promise.all(denied)).map((r) => r.status);
    expect(statuses).toEqual(denied.map(() => 403));
    expect(await deps.db.priceVersion.count({ where: { serviceId: s.id } })).toBe(1);
  });

  it('có catalog.write nhưng thiếu prices.write: sửa được dịch vụ, không tạo được dịch vụ kèm giá', async () => {
    const s = await newService(ownerA, orgA);
    await request(app).patch(url(orgA, `/services/${s.id}`)).set(bearer(catalogOnlyA)).send({ name: 'Sửa được' }).expect(200);
    const res = await request(app)
      .post(url(orgA, '/services'))
      .set(bearer(catalogOnlyA))
      .send({ code: `Q-${uniq()}`, name: 'Q', durationMinutes: 30, listPrice: 1 });
    expect(res.status).toBe(403);
    expect(res.body.error.details.required).toBe('prices.write');
    await changePrice(catalogOnlyA, orgA, `/services/${s.id}/prices`, { listPrice: 1 }).expect(403);
  });
});

describe('cách ly tổ chức', () => {
  it('tổ chức B không thấy/không sửa được dịch vụ, gói, giá của A', async () => {
    const s = await newService(ownerA, orgA, { listPrice: 1_000_000 });
    const p = await newPackage(ownerA, orgA);
    const viaB = (path: string) => url(orgB, path);
    const results = await Promise.all([
      request(app).get(viaB(`/services/${s.id}`)).set(bearer(ownerB)),
      request(app).patch(viaB(`/services/${s.id}`)).set(bearer(ownerB)).send({ name: 'Chiếm' }),
      request(app).get(viaB(`/services/${s.id}/prices`)).set(bearer(ownerB)),
      changePrice(ownerB, orgB, `/services/${s.id}/prices`, { listPrice: 1 }),
      request(app).get(viaB(`/packages/${p.id}`)).set(bearer(ownerB)),
      request(app).patch(viaB(`/packages/${p.id}`)).set(bearer(ownerB)).send({ name: 'Chiếm' }),
      request(app).get(viaB(`/packages/${p.id}/prices`)).set(bearer(ownerB)),
      changePrice(ownerB, orgB, `/packages/${p.id}/prices`, { listPrice: 1 }),
      request(app).get(url(orgA, `/services/${s.id}`)).set(bearer(ownerB)),
    ]);
    expect(results.map((r) => r.status)).toEqual(results.map(() => 404));
    const listB = await request(app).get(viaB('/services?pageSize=100')).set(bearer(ownerB)).expect(200);
    expect(listB.body.items.map((x: { id: string }) => x.id)).not.toContain(s.id);
    const after = await request(app).get(url(orgA, `/services/${s.id}`)).set(bearer(ownerA)).expect(200);
    expect(after.body.currentPrice.listPrice).toBe(1_000_000);
    expect(await deps.db.priceVersion.count({ where: { serviceId: s.id } })).toBe(1);
  });

  it('gắn dịch vụ của B vào gói của A (và ngược lại) → 400', async () => {
    const sB = await newService(ownerB, orgB, { kind: 'ADDON' });
    const pA = await newPackage(ownerA, orgA);
    const res = await request(app)
      .patch(url(orgA, `/packages/${pA.id}`))
      .set(bearer(ownerA))
      .send({ items: [{ serviceId: sB.id, quantity: 1, isOptional: true }] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Có dịch vụ không tồn tại trong tổ chức');
    const create = await request(app)
      .post(url(orgA, '/packages'))
      .set(bearer(ownerA))
      .send({ code: `G-${uniq()}`, name: 'G', durationMinutes: 60, listPrice: 1, items: [{ serviceId: sB.id }] });
    expect(create.status).toBe(400);
    expect(await deps.db.packageItem.count({ where: { packageId: pA.id } })).toBe(0);
  });

  it('nhân vật, studio, cấu hình phí di chuyển của A: B không thấy, không sửa được', async () => {
    const subj = await request(app).post(url(orgA, '/makeup-subjects')).set(bearer(ownerA)).send({ name: `Mẹ ${uniq()}` }).expect(201);
    const loc = await request(app).post(url(orgA, '/studio-locations')).set(bearer(ownerA)).send({ name: 'Studio A', address: '1 Lê Lợi' }).expect(201);
    const r = await Promise.all([
      request(app).patch(url(orgB, `/makeup-subjects/${subj.body.id}`)).set(bearer(ownerB)).send({ name: 'Chiếm' }),
      request(app).patch(url(orgB, `/studio-locations/${loc.body.id}`)).set(bearer(ownerB)).send({ name: 'Chiếm' }),
      request(app).get(url(orgA, '/makeup-subjects')).set(bearer(ownerB)),
      request(app).get(url(orgA, '/studio-locations')).set(bearer(ownerB)),
      request(app).get(url(orgA, '/travel-fee-policy')).set(bearer(ownerB)),
      request(app)
        .put(url(orgA, '/travel-fee-policy'))
        .set(bearer(ownerB))
        .send({ defaultMode: 'FIXED', fixedAmount: 1, perKmAmount: 0, freeKm: 0, minimumAmount: 0, roundTrip: false }),
    ]);
    expect(r.map((x) => x.status)).toEqual(r.map(() => 404));
    const subjectsB = await request(app).get(url(orgB, '/makeup-subjects')).set(bearer(ownerB)).expect(200);
    expect(subjectsB.body.items.map((x: { id: string }) => x.id)).not.toContain(subj.body.id);
    const locsB = await request(app).get(url(orgB, '/studio-locations')).set(bearer(ownerB)).expect(200);
    expect(locsB.body.items.map((x: { id: string }) => x.id)).not.toContain(loc.body.id);
    // A đổi cấu hình phí không làm đổi cấu hình của B.
    await request(app)
      .put(url(orgA, '/travel-fee-policy'))
      .set(bearer(ownerA))
      .send({ defaultMode: 'FIXED', fixedAmount: 150_000, perKmAmount: 0, freeKm: 0, minimumAmount: 0, roundTrip: false })
      .expect(200);
    const polB = await request(app).get(url(orgB, '/travel-fee-policy')).set(bearer(ownerB)).expect(200);
    expect(polB.body).toMatchObject({ defaultMode: 'MANUAL', fixedAmount: 0 });
  });
});

describe('nhân vật makeup', () => {
  it('tổ chức mới có sẵn nhân vật mẫu; tạo, trùng tên → 409, sửa, lọc hoạt động', async () => {
    const list = await request(app).get(url(orgA, '/makeup-subjects')).set(bearer(artistA)).expect(200);
    expect(list.body.items.map((x: { name: string }) => x.name)).toContain('Cô dâu');
    const dupDefault = await request(app).post(url(orgA, '/makeup-subjects')).set(bearer(ownerA)).send({ name: 'Cô dâu' });
    expect(dupDefault.status).toBe(409);
    expect(dupDefault.body.error.message).toBe('Tên nhân vật makeup đã có trong tổ chức');
    const name = `Bé gái ${uniq()}`;
    const c = await request(app).post(url(orgA, '/makeup-subjects')).set(bearer(ownerA)).send({ name, sortOrder: 9 }).expect(201);
    await request(app).patch(url(orgA, `/makeup-subjects/${c.body.id}`)).set(bearer(ownerA)).send({ name: 'Cô dâu' }).expect(409);
    const p = await request(app)
      .patch(url(orgA, `/makeup-subjects/${c.body.id}`))
      .set(bearer(ownerA))
      .send({ name: `${name} 2`, isActive: false })
      .expect(200);
    expect(p.body).toMatchObject({ name: `${name} 2`, isActive: false, sortOrder: 9 });
    const active = await request(app).get(url(orgA, '/makeup-subjects?isActive=true')).set(bearer(ownerA)).expect(200);
    expect(active.body.items.map((x: { id: string }) => x.id)).not.toContain(c.body.id);
  });
});

describe('studio / cửa hàng', () => {
  it('chỉ một studio mặc định: đặt mặc định chỗ mới thì chỗ cũ tự bỏ', async () => {
    const owner = await registerUser(app, 'chu-studio');
    const org = await createOrg(app, owner, 'studio');
    const s1 = await request(app)
      .post(url(org, '/studio-locations'))
      .set(bearer(owner))
      .send({ name: 'Cơ sở 1', address: '12 Nguyễn Huệ, Q1', latitude: 10.776889, longitude: 106.700806, isDefault: true })
      .expect(201);
    expect(s1.body).toMatchObject({ isDefault: true, latitude: 10.776889, longitude: 106.700806 });
    const s2 = await request(app)
      .post(url(org, '/studio-locations'))
      .set(bearer(owner))
      .send({ name: 'Cơ sở 2', address: '5 Trần Phú', isDefault: true })
      .expect(201);
    const defaults = () => deps.db.studioLocation.findMany({ where: { organizationId: org, isDefault: true }, select: { id: true } });
    expect((await defaults()).map((x) => x.id)).toEqual([s2.body.id]);
    await request(app).patch(url(org, `/studio-locations/${s1.body.id}`)).set(bearer(owner)).send({ isDefault: true }).expect(200);
    expect((await defaults()).map((x) => x.id)).toEqual([s1.body.id]);
    const list = await request(app).get(url(org, '/studio-locations')).set(bearer(owner)).expect(200);
    expect(list.body.items[0].id).toBe(s1.body.id);
  });

  it('toạ độ thiếu một nửa, quá 6 số lẻ, ngoài phạm vi → 400; tắt studio mặc định → 400', async () => {
    const owner = await registerUser(app, 'chu-studio2');
    const org = await createOrg(app, owner, 'studio2');
    const post = (body: Body) => request(app).post(url(org, '/studio-locations')).set(bearer(owner)).send(body);
    expect((await post({ name: 'A', address: 'B', latitude: 10.5 })).status).toBe(400);
    expect((await post({ name: 'A', address: 'B', latitude: 10.1234567, longitude: 106 })).status).toBe(400);
    expect((await post({ name: 'A', address: 'B', latitude: 91, longitude: 106 })).status).toBe(400);
    const d = await post({ name: 'A', address: 'B', isDefault: true }).expect(201);
    const off = await request(app).patch(url(org, `/studio-locations/${d.body.id}`)).set(bearer(owner)).send({ isActive: false });
    expect(off.status).toBe(400);
    expect(off.body.error.message).toContain('Studio mặc định phải đang hoạt động');
  });
});

describe('cách tính phí di chuyển', () => {
  it('đọc mặc định, ghi đè đủ trường, nhật ký trước → sau', async () => {
    const owner = await registerUser(app, 'chu-phi');
    const org = await createOrg(app, owner, 'phi');
    const g = await request(app).get(url(org, '/travel-fee-policy')).set(bearer(owner)).expect(200);
    expect(g.body).toMatchObject({ defaultMode: 'MANUAL', fixedAmount: 0, perKmAmount: 0, freeKm: 0, minimumAmount: 0, roundTrip: false });
    const body = { defaultMode: 'PER_KM', fixedAmount: 0, perKmAmount: 7_000, freeKm: 2.5, minimumAmount: 50_000, roundTrip: true };
    const p = await request(app).put(url(org, '/travel-fee-policy')).set(bearer(owner)).send(body).expect(200);
    expect(p.body).toMatchObject(body);
    const g2 = await request(app).get(url(org, '/travel-fee-policy')).set(bearer(owner)).expect(200);
    await request(app).patch(url(org, '/travel-fee-policy')).set(bearer(owner)).send(body).expect(404);
    expect(g2.body).toMatchObject(body);
    const logs = await request(app).get(url(org, '/audit-logs')).set(bearer(owner)).expect(200);
    const log = logs.body.items.find((l: { action: string }) => l.action === 'travel_policy.updated');
    expect(log.actor.id).toBe(owner.id);
    expect(log.data.before).toMatchObject({ defaultMode: 'MANUAL', perKmAmount: 0 });
    expect(log.data.after).toMatchObject(body);
  });

  it('số âm, km quá 2 số lẻ, cách tính lạ, thiếu trường → 400', async () => {
    const base = { defaultMode: 'FIXED', fixedAmount: 100_000, perKmAmount: 0, freeKm: 0, minimumAmount: 0, roundTrip: false };
    const send = (b: Body) => request(app).put(url(orgA, '/travel-fee-policy')).set(bearer(ownerA)).send(b);
    const bad: Body[] = [
      { ...base, fixedAmount: -1 },
      { ...base, perKmAmount: 1.5 },
      { ...base, freeKm: -0.5 },
      { ...base, freeKm: 1.234 },
      { ...base, defaultMode: 'THEO_GIO' },
      { defaultMode: 'FIXED', fixedAmount: 1 },
    ];
    for (const b of bad) {
      const res = await send(b);
      expect(res.status, JSON.stringify(b)).toBe(400);
    }
  });
});

describe('gói dịch vụ', () => {
  it('gói có nhân vật, địa điểm, dịch vụ đã gồm và dịch vụ phụ tick thêm kèm giá hiện hành', async () => {
    const subj = await request(app).post(url(orgA, '/makeup-subjects')).set(bearer(ownerA)).send({ name: `Cô dâu Huế ${uniq()}` }).expect(201);
    const main = await newService(ownerA, orgA, { kind: 'MAIN', listPrice: 2_000_000 });
    const hair = await newService(ownerA, orgA, { kind: 'ADDON', listPrice: 500_000, salePrice: 400_000 });
    const lens = await newService(ownerA, orgA, { kind: 'ADDON', listPrice: 100_000 });
    const pkg = await request(app)
      .post(url(orgA, '/packages'))
      .set(bearer(ownerA))
      .send({
        code: `cd-${uniq().toLowerCase()}`,
        name: 'Gói cô dâu trọn ngày',
        durationMinutes: 240,
        staffCount: 2,
        depositAmount: 1_000_000,
        subjectId: subj.body.id,
        locationTypes: ['CUSTOMER_HOME', 'STUDIO', 'STUDIO'],
        listPrice: 5_000_000,
        salePrice: 4_500_000,
        items: [
          { serviceId: main.id, quantity: 1, isOptional: false },
          { serviceId: hair.id, quantity: 1, isOptional: false },
          { serviceId: lens.id, quantity: 2, isOptional: true },
        ],
      })
      .expect(201);
    expect(pkg.body).toMatchObject({
      depositAmount: 1_000_000,
      staffCount: 2,
      subject: { id: subj.body.id, name: subj.body.name },
      locationTypes: ['STUDIO', 'CUSTOMER_HOME'],
      currentPrice: { listPrice: 5_000_000, salePrice: 4_500_000, unitPrice: 4_500_000 },
    });
    const g = await request(app).get(url(orgA, `/packages/${pkg.body.id}`)).set(bearer(artistA)).expect(200);
    const items = g.body.items as { serviceId: string; isOptional: boolean; quantity: number; currentPrice: { unitPrice: number } }[];
    expect(items.map((i) => [i.serviceId, i.isOptional])).toEqual(
      expect.arrayContaining([
        [main.id, false],
        [hair.id, false],
        [lens.id, true],
      ]),
    );
    expect(items.find((i) => i.serviceId === lens.id)?.currentPrice.unitPrice).toBe(100_000);
    expect(items.find((i) => i.serviceId === hair.id)?.currentPrice.unitPrice).toBe(400_000);
    expect(items[items.length - 1]?.isOptional).toBe(true);

    const bySubject = await request(app).get(url(orgA, `/packages?subjectId=${subj.body.id}`)).set(bearer(ownerA)).expect(200);
    expect(bySubject.body.items.map((x: { id: string }) => x.id)).toEqual([pkg.body.id]);
    const other = await request(app)
      .get(url(orgA, `/packages?subjectId=${subj.body.id}&locationType=OTHER`))
      .set(bearer(ownerA))
      .expect(200);
    expect(other.body.total).toBe(0);
  });

  it('dịch vụ MAIN để làm tuỳ chọn tick → 400; phụ phí gộp vào gói → 400; dịch vụ trùng dòng → 400', async () => {
    const main = await newService(ownerA, orgA, { kind: 'MAIN' });
    const sur = await newService(ownerA, orgA, { kind: 'SURCHARGE' });
    const post = (items: Body[]) =>
      request(app)
        .post(url(orgA, '/packages'))
        .set(bearer(ownerA))
        .send({ code: `G-${uniq()}`, name: 'G', durationMinutes: 60, listPrice: 1, items });
    const r1 = await post([{ serviceId: main.id, isOptional: true }]);
    expect(r1.status).toBe(400);
    expect(r1.body.error.message).toContain('chỉ dịch vụ phụ (ADDON) mới được để tick thêm');
    const r2 = await post([{ serviceId: sur.id, isOptional: false }]);
    expect(r2.status).toBe(400);
    expect(r2.body.error.message).toContain('phụ phí');
    const r3 = await post([{ serviceId: main.id }, { serviceId: main.id, quantity: 2 }]);
    expect(r3.status).toBe(400);
  });

  it('nhân vật của tổ chức B hoặc đang tắt → 400; địa điểm lạ → 400; trùng mã gói → 409', async () => {
    const subjB = await request(app).post(url(orgB, '/makeup-subjects')).set(bearer(ownerB)).send({ name: `B ${uniq()}` }).expect(201);
    const rB = await request(app)
      .post(url(orgA, '/packages'))
      .set(bearer(ownerA))
      .send({ code: `G-${uniq()}`, name: 'G', durationMinutes: 60, listPrice: 1, subjectId: subjB.body.id });
    expect(rB.status).toBe(400);
    expect(rB.body.error.message).toBe('Nhân vật makeup không tồn tại trong tổ chức');
    const off = await request(app).post(url(orgA, '/makeup-subjects')).set(bearer(ownerA)).send({ name: `Tắt ${uniq()}`, isActive: false }).expect(201);
    const rOff = await request(app)
      .post(url(orgA, '/packages'))
      .set(bearer(ownerA))
      .send({ code: `G-${uniq()}`, name: 'G', durationMinutes: 60, listPrice: 1, subjectId: off.body.id });
    expect(rOff.status).toBe(400);
    expect(rOff.body.error.message).toBe('Nhân vật makeup đang ngừng hoạt động');
    const rLoc = await request(app)
      .post(url(orgA, '/packages'))
      .set(bearer(ownerA))
      .send({ code: `G-${uniq()}`, name: 'G', durationMinutes: 60, listPrice: 1, locationTypes: ['BAI_BIEN'] });
    expect(rLoc.status).toBe(400);
    const p = await newPackage(ownerA, orgA);
    const pk = await deps.db.servicePackage.findUniqueOrThrow({ where: { id: p.id } });
    const dup = await request(app)
      .post(url(orgA, '/packages'))
      .set(bearer(ownerA))
      .send({ code: pk.code, name: 'G', durationMinutes: 60, listPrice: 1 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('Mã gói đã có trong tổ chức');
  });

  it('PATCH items thay toàn bộ; đổi giá gói giữ lịch sử', async () => {
    const a = await newService(ownerA, orgA, { kind: 'MAIN' });
    const b = await newService(ownerA, orgA, { kind: 'ADDON' });
    const p = await newPackage(ownerA, orgA, { items: [{ serviceId: a.id }] });
    const r = await request(app)
      .patch(url(orgA, `/packages/${p.id}`))
      .set(bearer(ownerA))
      .send({ items: [{ serviceId: b.id, quantity: 3, isOptional: true }], locationTypes: [], subjectId: null })
      .expect(200);
    expect(r.body.items.map((i: { serviceId: string; quantity: number }) => [i.serviceId, i.quantity])).toEqual([[b.id, 3]]);
    expect(r.body.locationTypes).toEqual([]);
    await changePrice(ownerA, orgA, `/packages/${p.id}/prices`, { listPrice: 3_500_000, salePrice: 3_200_000 }).expect(201);
    const hist = await request(app).get(url(orgA, `/packages/${p.id}/prices`)).set(bearer(ownerA)).expect(200);
    expect(hist.body.items.map((v: { listPrice: number; unitPrice: number; status: string }) => [v.listPrice, v.unitPrice, v.status])).toEqual([
      [3_500_000, 3_200_000, 'CURRENT'],
      [3_000_000, 3_000_000, 'PAST'],
    ]);
    const bad = await request(app).patch(url(orgA, `/packages/${p.id}`)).set(bearer(ownerA)).send({ listPrice: 1 });
    expect(bad.status).toBe(400);
  });

  it('đổi loại dịch vụ phụ đang là dòng tick trong gói sang MAIN → 400', async () => {
    const addon = await newService(ownerA, orgA, { kind: 'ADDON' });
    await newPackage(ownerA, orgA, { items: [{ serviceId: addon.id, isOptional: true }] });
    const res = await request(app).patch(url(orgA, `/services/${addon.id}`)).set(bearer(ownerA)).send({ kind: 'MAIN' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Không đổi được loại');
  });
});
