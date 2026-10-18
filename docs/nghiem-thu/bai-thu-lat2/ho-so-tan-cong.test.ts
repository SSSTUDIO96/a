// BÀI TẤN CÔNG CỦA THỢ CHẤM — LÁT 2, HỒ SƠ THƯƠNG HIỆU + TRANG CÔNG KHAI (modules/profile).
// Quy ước: "LỖI:" xanh = lỗi có thật; "CHẶN:" xanh = đòn bị chặn; "GHI NHẬN:" xanh = hành vi có thật, chủ quyết.
import { randomUUID } from 'node:crypto';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { RAW_ROUTE, rawFileHandler } from '../src/modules/files/raw';
import { grantPlatformAdmin } from '../src/scripts/grant-platform-admin';
import { makePng } from '../test/png';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from '../test/helpers';

const deps = makeDeps();
let app: App;
const outer = express();
outer.get(RAW_ROUTE, rawFileHandler(deps));
const idem = () => ({ 'idempotency-key': `c2-${randomUUID()}` });
const uniq = () => randomUUID().slice(0, 6).toUpperCase();
const url = (org: string, p: string) => `/api/v1/orgs/${org}${p}`;
const site = (slug: string) => request(app).get(`/api/v1/public/sites/${slug}`);

async function slugOf(u: TestUser, org: string) {
  return (await request(app).get(url(org, '')).set(bearer(u)).expect(200)).body.slug as string;
}
async function uploadLogo(u: TestUser, org: string) {
  const r = await request(outer)
    .post(url(org, '/files'))
    .query({ purpose: 'ORG_LOGO', name: 'logo.png' })
    .set(bearer(u))
    .set(idem())
    .set('Content-Type', 'application/octet-stream')
    .send(makePng(3, 3));
  if (r.status !== 201) throw new Error(`upload ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.id as string;
}

beforeAll(async () => {
  app = makeApp(deps);
  outer.use(app);
});
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('H-1 trang công khai lộ dữ liệu nội bộ', () => {
  it('CHẶN + GHI NHẬN: quét JSON công khai của một studio có đủ dữ liệu nội bộ', async () => {
    const owner = await registerUser(app, 'c2-hs-chu');
    const org = await createOrg(app, owner, 'c2-hs');
    const artist = await registerUser(app, 'c2-hs-tho');
    const mid = await addMember(app, owner, org, artist, ['artist']);
    await request(app).patch(url(org, `/staff/${mid}`)).set(bearer(owner)).send({ phone: '0977111222' }).expect(200);
    const svcHidden = await request(app).post(url(org, '/services')).set(bearer(owner)).set(idem())
      .send({ code: `DV-${uniq()}`, name: 'Dịch vụ nội bộ KHÔNG công khai', durationMinutes: 30, listPrice: 314_159, isPublic: false }).expect(201);
    const svc = await request(app).post(url(org, '/services')).set(bearer(owner)).set(idem())
      .send({ code: `DV-${uniq()}`, name: 'Makeup công khai', durationMinutes: 60, listPrice: 1_500_000, isPublic: true }).expect(201);
    await request(app).post(url(org, '/packages')).set(bearer(owner)).set(idem())
      .send({ code: `G-${uniq()}`, name: 'Gói cưới', durationMinutes: 120, listPrice: 5_000_000, depositAmount: 2_345_678, isPublic: true,
        items: [{ serviceId: svcHidden.body.id, isOptional: false }, { serviceId: svc.body.id, isOptional: false }] }).expect(201);
    const tier = await request(app).post(url(org, '/staff-tiers')).set(bearer(owner)).set(idem()).send({ name: `Bậc ${uniq()}` }).expect(201);
    await request(app).put(url(org, `/services/${svc.body.id}/pay-rates`)).set(bearer(owner)).send({ rates: [{ tierId: tier.body.id, amount: 456_789 }] }).expect(200);
    const cust = await request(app).post(url(org, '/customers')).set(bearer(owner)).set(idem()).send({ fullName: `Khách Kín ${uniq()}`, phone: '0966333444' }).expect(201);
    const contract = await request(app).post(url(org, '/contracts')).set(bearer(owner)).set(idem())
      .send({ customerId: cust.body.id, depositRequired: 765_432, lines: [{ kind: 'CUSTOM', name: 'Gói riêng', unitPrice: 8_765_432, quantity: 1 }] }).expect(201);
    const logo = await uploadLogo(owner, org);
    await request(app).put(url(org, '/profile')).set(bearer(owner)).send({ brandName: 'Studio Chấm', logoFileId: logo, phone: '0901234567', email: 'lienhe@studio.vn' }).expect(200);
    await request(app).post(url(org, '/profile/publish')).set(bearer(owner)).expect(200);
    const s = await site(await slugOf(owner, org)).expect(200);
    const text = JSON.stringify(s.body);
    const secrets: [string, string][] = [
      ['email chủ', owner.email],
      ['email thợ', artist.email],
      ['SĐT thợ', '0977111222'],
      ['SĐT khách', '0966333444'],
      ['tên khách', cust.body.fullName],
      ['cọc nội bộ của gói', '2345678'],
      ['tiền công', '456789'],
      ['tổng hợp đồng', '8765432'],
      ['cọc hợp đồng', '765432'],
      ['giá dịch vụ không công khai', '314159'],
      ['mã thành viên', mid],
      ['mã bậc lương', tier.body.id],
      ['mã hợp đồng', String(contract.body.id)],
      ['mã tổ chức (chữ thường)', org],
    ];
    const leaked = secrets.filter(([, v]) => text.includes(v));
    for (const [k, v] of leaked) { const i = text.indexOf(v); console.log(`[H-1] ngữ cảnh "${k}": …${text.slice(Math.max(0, i - 80), i + 40)}…`); }
    // Vé ảnh: phần trước dấu chấm là base64 của "khoá lưu trữ|hạn".
    const logoUrl: string = s.body.profile.logo?.url ?? '';
    const decoded = Buffer.from((logoUrl.split('/').pop() ?? '').split('.')[0] ?? '', 'base64url').toString('utf8');
    const nonPublicName = text.includes('Dịch vụ nội bộ KHÔNG công khai');
    console.log(`[H-1] bí mật lộ ra ở dạng chữ: ${leaked.length}/${secrets.length}${leaked.length ? ` (${leaked.map(([k]) => k).join(', ')})` : ''}`);
    console.log(`[H-1] vé ảnh logo giải base64 → "${decoded.replace(/\|\d+$/, '|<hạn>')}" (chứa mã tổ chức: ${decoded.includes(org)})`);
    console.log(`[H-1] tên dịch vụ KHÔNG công khai hiện trong mục "gồm trong gói": ${nonPublicName}`);
    expect(leaked).toEqual([]);
    expect(decoded).toContain(org);
    expect(nonPublicName).toBe(true);
  });
});

describe('H-2 trang không được hiện', () => {
  it('CHẶN: chưa xuất bản, đã gỡ, tổ chức bị khoá, slug viết hoa/thừa ký tự/bịa → 404 giống hệt nhau', async () => {
    const owner = await registerUser(app, 'c2-hs-an');
    const org = await createOrg(app, owner, 'c2-hs-an');
    const slug = await slugOf(owner, org);
    await request(app).put(url(org, '/profile')).set(bearer(owner)).send({ brandName: 'Ẩn' }).expect(200);
    const shape = (r: request.Response) => JSON.stringify({ s: r.status, c: r.body.error?.code, m: r.body.error?.message, d: r.body.error?.details });
    const unpublished = await site(slug);
    await request(app).post(url(org, '/profile/publish')).set(bearer(owner)).expect(200);
    const upper = await site(slug.toUpperCase());
    await request(app).post(url(org, '/profile/unpublish')).set(bearer(owner)).expect(200);
    const unpub2 = await site(slug);
    await request(app).post(url(org, '/profile/publish')).set(bearer(owner)).expect(200);
    await deps.db.organization.update({ where: { id: org }, data: { status: 'SUSPENDED' } });
    const suspended = await site(slug);
    const fake = await site(`bia-${randomUUID().slice(0, 8)}`);
    const weird = await site(`${slug}%20`);
    const results = [unpublished, unpub2, suspended, weird];
    const same = results.filter((r) => shape(r) === shape(fake)).length;
    console.log(`[H-2] giống hệt slug bịa: ${same}/${results.length}; slug VIẾT HOA khi đã xuất bản → ${upper.status}`);
    expect(same).toBe(results.length);
  });

  it('GHI NHẬN: thuê bao đã HUỶ/HẾT HẠN quá ân hạn → trang công khai vẫn hiện bình thường', async () => {
    const admin = await registerUser(app, 'c2-hs-admin');
    await grantPlatformAdmin(deps.db, admin.email);
    const owner = await registerUser(app, 'c2-hs-het');
    const org = await createOrg(app, owner, 'c2-hs-het');
    await request(app).put(url(org, '/profile')).set(bearer(owner)).send({ brandName: 'Hết hạn' }).expect(200);
    await request(app).post(url(org, '/profile/publish')).set(bearer(owner)).expect(200);
    const plan = await request(app).post('/api/v1/platform/plans').set(bearer(admin)).send({ code: `c2h_${uniq().toLowerCase()}`, name: 'P', priceMonthly: 1 });
    await request(app).post(`/api/v1/platform/organizations/${org}/subscriptions`).set(bearer(admin))
      .send({ planId: plan.body.id, status: 'CANCELLED', startsAt: new Date(Date.now() - 60 * 86_400_000).toISOString(), endsAt: new Date(Date.now() - 30 * 86_400_000).toISOString() }).expect(201);
    const r = await site(await slugOf(owner, org));
    console.log(`[H-2] thuê bao CANCELLED từ 30 ngày trước → trang công khai ${r.status}`);
    expect(r.status).toBe(200);
  });
});

describe('H-3 cách ly + quyền', () => {
  it('CHẶN: chủ B gắn logo/ảnh bìa bằng mã tệp của A → lời báo GIỐNG HỆT mã bịa; database không đổi', async () => {
    const oa = await registerUser(app, 'c2-hs-a');
    const orgA = await createOrg(app, oa, 'c2-hs-a');
    const ob = await registerUser(app, 'c2-hs-b');
    const orgB = await createOrg(app, ob, 'c2-hs-b');
    const fileA = await uploadLogo(oa, orgA);
    const shape = (r: request.Response) => JSON.stringify({ s: r.status, c: r.body.error?.code, m: r.body.error?.message, d: r.body.error?.details });
    let same = 0;
    for (const field of ['logoFileId', 'avatarFileId', 'coverFileId']) {
      const real = await request(app).put(url(orgB, '/profile')).set(bearer(ob)).send({ brandName: 'B', [field]: fileA });
      const fake = await request(app).put(url(orgB, '/profile')).set(bearer(ob)).send({ brandName: 'B', [field]: randomUUID() });
      if (shape(real) === shape(fake) && real.status === 400) same++;
    }
    console.log(`[H-3] mã tệp A vs mã bịa giống hệt: ${same}/3`);
    expect(same).toBe(3);
    expect(await deps.db.organizationProfile.findUnique({ where: { organizationId: orgB } })).toBeNull();
  });

  it('CHẶN: thợ (org.read) không sửa/xuất bản được; lễ tân cũng không (thiếu org.update)', async () => {
    const o = await registerUser(app, 'c2-hs-q');
    const org = await createOrg(app, o, 'c2-hs-q');
    const artist = await registerUser(app, 'c2-hs-q-tho');
    const rec = await registerUser(app, 'c2-hs-q-lt');
    await addMember(app, o, org, artist, ['artist']);
    await addMember(app, o, org, rec, ['receptionist']);
    const st = [
      (await request(app).put(url(org, '/profile')).set(bearer(artist)).send({ brandName: 'x' })).status,
      (await request(app).post(url(org, '/profile/publish')).set(bearer(artist))).status,
      (await request(app).put(url(org, '/profile')).set(bearer(rec)).send({ brandName: 'x' })).status,
      (await request(app).post(url(org, '/profile/publish')).set(bearer(rec))).status,
    ];
    console.log(`[H-3] thợ/lễ tân sửa, xuất bản → ${st.join(', ')}`);
    expect(st).toEqual([403, 403, 403, 403]);
  });
});

describe('H-4 nhật ký trước → sau', () => {
  it('CHẶN: tạo, sửa (có giá trị cũ), xuất bản, gỡ đều có nhật ký; xuất bản lần 2 không ghi trùng', async () => {
    const o = await registerUser(app, 'c2-hs-nk');
    const org = await createOrg(app, o, 'c2-hs-nk');
    await request(app).put(url(org, '/profile')).set(bearer(o)).send({ brandName: 'Tên cũ', phone: '0901111222' }).expect(200);
    await request(app).put(url(org, '/profile')).set(bearer(o)).send({ brandName: 'Tên mới' }).expect(200);
    await request(app).post(url(org, '/profile/publish')).set(bearer(o)).expect(200);
    await request(app).post(url(org, '/profile/publish')).set(bearer(o)).expect(200);
    await request(app).post(url(org, '/profile/unpublish')).set(bearer(o)).expect(200);
    const logs = await deps.db.auditLog.findMany({ where: { organizationId: org, entityType: 'organization_profile' }, orderBy: { createdAt: 'asc' } });
    const upd = logs.find((l) => l.action === 'profile.updated')?.data as { before?: { brandName?: string; phone?: string }; after?: { brandName?: string; phone?: string | null } } | undefined;
    const actions = logs.map((l) => l.action);
    console.log(`[H-4] hành động: ${actions.join(', ')}; sửa: ${upd?.before?.brandName}/${upd?.before?.phone} → ${upd?.after?.brandName}/${upd?.after?.phone}`);
    expect(actions).toEqual(['profile.created', 'profile.updated', 'profile.published', 'profile.unpublished']);
    expect(upd?.before).toMatchObject({ brandName: 'Tên cũ', phone: '0901111222' });
    expect(upd?.after).toMatchObject({ brandName: 'Tên mới', phone: null });
  });
});
