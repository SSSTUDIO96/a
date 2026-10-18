import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { FilePurpose, FileStatus } from '@prisma/client';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let ownerA: TestUser;
let ownerB: TestUser;
let artistA: TestUser;
let orgA: string;
let orgB: string;

type Body = Record<string, unknown>;
const url = (org: string, p: string) => `/api/v1/orgs/${org}${p}`;
const idem = () => ({ 'idempotency-key': `k-${randomUUID()}` });
const uniq = () => randomUUID().slice(0, 6).toUpperCase();
const site = (slug: string) => request(app).get(`/api/v1/public/sites/${slug}`);

async function slugOf(u: TestUser, org: string): Promise<string> {
  const r = await request(app).get(url(org, '')).set(bearer(u)).expect(200);
  return r.body.slug as string;
}

async function makeFile(org: string, u: TestUser, opts: { purpose?: FilePurpose; status?: FileStatus; mimeType?: string } = {}) {
  const purpose = opts.purpose ?? 'ORG_LOGO';
  const f = await deps.db.storedFile.create({
    data: {
      organizationId: org,
      purpose,
      storageKey: `org/${org}/${purpose.toLowerCase().replace(/_/g, '-')}/${randomUUID()}.png`,
      originalName: 'logo.png',
      mimeType: opts.mimeType ?? 'image/png',
      sizeBytes: 1234n,
      status: opts.status ?? 'READY',
      createdById: u.id,
    },
  });
  return f.id;
}

function putProfile(u: TestUser, org: string, body: Body) {
  return request(app).put(url(org, '/profile')).set(bearer(u)).send(body);
}

async function newService(u: TestUser, org: string, extra: Body = {}) {
  const r = await request(app)
    .post(url(org, '/services'))
    .set(bearer(u))
    .set(idem())
    .send({ code: `DV-${uniq()}`, name: `Dịch vụ ${uniq()}`, durationMinutes: 60, listPrice: 1_000_000, isPublic: true, ...extra });
  if (r.status !== 201) throw new Error(`Tạo dịch vụ thất bại ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body as { id: string; name: string };
}

async function freshPublishedOrg(label: string) {
  const owner = await registerUser(app, `chu-${label}`);
  const org = await createOrg(app, owner, label);
  await putProfile(owner, org, { brandName: `Thương hiệu ${label}` }).expect(200);
  await request(app).post(url(org, '/profile/publish')).set(bearer(owner)).set(idem()).expect(200);
  return { owner, org, slug: await slugOf(owner, org) };
}

function errShape(r: request.Response) {
  return { status: r.status, code: r.body?.error?.code, message: r.body?.error?.message, details: r.body?.error?.details };
}

beforeAll(async () => {
  app = makeApp(deps);
  ownerA = await registerUser(app, 'chu-hs-a');
  ownerB = await registerUser(app, 'chu-hs-b');
  artistA = await registerUser(app, 'tho-hs-a');
  orgA = await createOrg(app, ownerA, 'ho-so-a');
  orgB = await createOrg(app, ownerB, 'ho-so-b');
  await addMember(app, ownerA, orgA, artistA, ['artist']);
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('hồ sơ thương hiệu', () => {
  it('chưa có hồ sơ → hasProfile=false, không bịa dữ liệu', async () => {
    const owner = await registerUser(app, 'chu-trong');
    const org = await createOrg(app, owner, 'trong');
    const r = await request(app).get(url(org, '/profile')).set(bearer(owner)).expect(200);
    expect(r.body).toEqual({ hasProfile: false, profile: null });
  });

  it('ghi toàn bộ: chuẩn hoá số điện thoại, xếp giờ làm việc, ảnh trả URL ký; ghi lại xoá trường không gửi; nhật ký', async () => {
    const logo = await makeFile(orgA, ownerA);
    const cover = await makeFile(orgA, ownerA, { purpose: 'ALBUM_IMAGE' });
    const r = await putProfile(ownerA, orgA, {
      brandName: 'Linh Makeup',
      tagline: 'Trang điểm cô dâu tự nhiên',
      styles: ['Hàn Quốc', 'Tây'],
      phone: '+84 912 345 678',
      zalo: '0912 345 678',
      email: 'LienHe@Linh.VN',
      facebook: 'https://facebook.com/linhmakeup',
      logoFileId: logo,
      coverFileId: cover,
      workingHours: [
        { weekday: 2, open: '13:00', close: '20:00' },
        { weekday: 1, open: '08:00', close: '12:00' },
        { weekday: 2, open: '08:00', close: '12:00' },
      ],
      depositPolicy: 'Cọc 30% khi chốt lịch',
    }).expect(200);
    expect(r.body.hasProfile).toBe(true);
    expect(r.body.profile).toMatchObject({
      brandName: 'Linh Makeup',
      phone: '0912345678',
      zalo: '0912345678',
      email: 'lienhe@linh.vn',
      isPublished: false,
      publishedAt: null,
      workingHours: [
        { weekday: 1, open: '08:00', close: '12:00' },
        { weekday: 2, open: '08:00', close: '12:00' },
        { weekday: 2, open: '13:00', close: '20:00' },
      ],
    });
    expect(typeof r.body.profile.logo.url).toBe('string');
    expect(r.body.profile.avatar).toBeNull();
    const again = await putProfile(ownerA, orgA, { brandName: 'Linh Makeup Studio', logoFileId: logo }).expect(200);
    expect(again.body.profile).toMatchObject({ brandName: 'Linh Makeup Studio', phone: null, facebook: null, styles: [], workingHours: [] });
    expect(again.body.profile.cover).toBeNull();
    const logs = await request(app).get(url(orgA, '/audit-logs?pageSize=100')).set(bearer(ownerA)).expect(200);
    const upd = logs.body.items.find((l: { action: string }) => l.action === 'profile.updated');
    expect(upd.actor.id).toBe(ownerA.id);
    expect(upd.data.before).toMatchObject({ brandName: 'Linh Makeup', phone: '0912345678' });
    expect(upd.data.after).toMatchObject({ brandName: 'Linh Makeup Studio', phone: null });
    expect(logs.body.items.some((l: { action: string }) => l.action === 'profile.created')).toBe(true);
  });

  it('dữ liệu sai → 400: http thường, số điện thoại sai, giờ ngược, quá 2 ca, ca chồng, thứ 8, 24:00, thiếu tên, gửi isPublished', async () => {
    const bad: Body[] = [
      { brandName: 'X', facebook: 'http://facebook.com/x' },
      { brandName: 'X', website: 'javascript:alert(1)' },
      { brandName: 'X', phone: '12345' },
      { brandName: 'X', zalo: 'zalo-cua-toi' },
      { brandName: 'X', workingHours: [{ weekday: 1, open: '10:00', close: '09:00' }] },
      {
        brandName: 'X',
        workingHours: [
          { weekday: 3, open: '06:00', close: '08:00' },
          { weekday: 3, open: '09:00', close: '11:00' },
          { weekday: 3, open: '13:00', close: '15:00' },
        ],
      },
      {
        brandName: 'X',
        workingHours: [
          { weekday: 4, open: '08:00', close: '12:00' },
          { weekday: 4, open: '11:00', close: '15:00' },
        ],
      },
      { brandName: 'X', workingHours: [{ weekday: 8, open: '08:00', close: '09:00' }] },
      { brandName: 'X', workingHours: [{ weekday: 1, open: '08:00', close: '24:00' }] },
      { tagline: 'thiếu tên' },
      { brandName: '   ' },
      { brandName: 'X', isPublished: true },
    ];
    for (const b of bad) {
      const r = await putProfile(ownerA, orgA, b);
      expect(r.status, JSON.stringify(b)).toBe(400);
    }
  });

  it('ảnh: tệp chưa READY, sai mục đích, không phải ảnh → 400; ảnh của tổ chức khác trả GIỐNG HỆT mã bịa', async () => {
    const uploading = await makeFile(orgA, ownerA, { status: 'UPLOADING' });
    const r1 = await putProfile(ownerA, orgA, { brandName: 'X', logoFileId: uploading });
    expect(r1.status).toBe(400);
    expect(r1.body.error.message).toBe('Tệp logo chưa tải xong hoặc đã xoá');
    const album = await makeFile(orgA, ownerA, { purpose: 'ALBUM_IMAGE' });
    expect((await putProfile(ownerA, orgA, { brandName: 'X', logoFileId: album })).status).toBe(400);
    const pdf = await makeFile(orgA, ownerA, { purpose: 'ALBUM_IMAGE', mimeType: 'application/pdf' });
    expect((await putProfile(ownerA, orgA, { brandName: 'X', coverFileId: pdf })).status).toBe(400);
    const logoB = await makeFile(orgB, ownerB);
    const cross = await putProfile(ownerA, orgA, { brandName: 'X', logoFileId: logoB });
    const fake = await putProfile(ownerA, orgA, { brandName: 'X', logoFileId: randomUUID() });
    expect(errShape(cross)).toEqual(errShape(fake));
    expect(cross.status).toBe(400);
    // Lớp hai: khoá ngoại kép chặn ghi thẳng ảnh của tổ chức khác.
    await expect(
      deps.db.organizationProfile.upsert({
        where: { organizationId: orgA },
        create: { organizationId: orgA, brandName: 'X', logoFileId: logoB },
        update: { logoFileId: logoB },
      }),
    ).rejects.toThrow();
  });

  it('quyền: thợ makeup xem được, không sửa/xuất bản được; tổ chức B không xem/sửa được hồ sơ A', async () => {
    await request(app).get(url(orgA, '/profile')).set(bearer(artistA)).expect(200);
    await putProfile(artistA, orgA, { brandName: 'Chiếm' }).expect(403);
    await request(app).post(url(orgA, '/profile/publish')).set(bearer(artistA)).set(idem()).expect(403);
    await request(app).get(url(orgA, '/profile')).set(bearer(ownerB)).expect(404);
    await putProfile(ownerB, orgA, { brandName: 'Chiếm' }).expect(404);
    await request(app).post(url(orgA, '/profile/publish')).set(bearer(ownerB)).set(idem()).expect(404);
    await request(app).post(url(orgA, '/profile/unpublish')).set(bearer(ownerB)).set(idem()).expect(404);
    const row = await deps.db.organizationProfile.findUnique({ where: { organizationId: orgA } });
    expect(row?.brandName).not.toBe('Chiếm');
  });
});

describe('xuất bản và trang công khai', () => {
  it('chưa có hồ sơ thì không xuất bản được; chưa xuất bản → 404; xuất bản → thấy; gỡ → 404; nhật ký', async () => {
    const owner = await registerUser(app, 'chu-xb');
    const org = await createOrg(app, owner, 'xuat-ban');
    const slug = await slugOf(owner, org);
    const noProfile = await request(app).post(url(org, '/profile/publish')).set(bearer(owner)).set(idem());
    expect(noProfile.status).toBe(400);
    expect(noProfile.body.error.message).toContain('Chưa có hồ sơ');
    await putProfile(owner, org, { brandName: 'Mai Bridal' }).expect(200);
    await site(slug).expect(404);
    const pub = await request(app).post(url(org, '/profile/publish')).set(bearer(owner)).set(idem()).expect(200);
    expect(pub.body.profile.isPublished).toBe(true);
    expect(typeof pub.body.profile.publishedAt).toBe('string');
    const s = await site(slug).expect(200);
    expect(s.body.profile.brandName).toBe('Mai Bridal');
    expect(s.body.site.slug).toBe(slug);
    // Sửa hồ sơ không làm mất trạng thái xuất bản.
    await putProfile(owner, org, { brandName: 'Mai Bridal 2' }).expect(200);
    expect((await site(slug).expect(200)).body.profile.brandName).toBe('Mai Bridal 2');
    await request(app).post(url(org, '/profile/unpublish')).set(bearer(owner)).set(idem()).expect(200);
    await site(slug).expect(404);
    const logs = await request(app).get(url(org, '/audit-logs')).set(bearer(owner)).expect(200);
    const actions = logs.body.items.map((l: { action: string }) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['profile.published', 'profile.unpublished']));
  });

  it('slug bịa, slug sai dạng, chưa xuất bản, tổ chức bị khoá → 404 GIỐNG HỆT nhau', async () => {
    const live = await freshPublishedOrg('khoa');
    await site(live.slug).expect(200);
    const unpublished = await registerUser(app, 'chu-chua-xb');
    const orgU = await createOrg(app, unpublished, 'chua-xb');
    await putProfile(unpublished, orgU, { brandName: 'Chưa xuất bản' }).expect(200);
    await deps.db.organization.update({ where: { id: live.org }, data: { status: 'SUSPENDED' } });
    const shapes = [
      errShape(await site(live.slug)),
      errShape(await site(`khong-co-${randomUUID().slice(0, 8)}`)),
      errShape(await site('SAI DẠNG!!')),
      errShape(await site(await slugOf(unpublished, orgU))),
    ];
    expect(shapes[0]).toEqual({ status: 404, code: 'NOT_FOUND', message: 'Không tìm thấy trang giới thiệu', details: undefined });
    for (const s of shapes) expect(s).toEqual(shapes[0]);
  });

  it('chỉ hiện dịch vụ/gói đang hoạt động và công khai, kèm giá hiện hành, nhân vật, dịch vụ phụ tick, km miễn phí', async () => {
    const { owner, org, slug } = await freshPublishedOrg('noi-dung');
    const visible = await newService(owner, org, { listPrice: 1_500_000, salePrice: 1_200_000 });
    const hidden = await newService(owner, org, { isPublic: false });
    const inactive = await newService(owner, org, { isActive: false });
    const main = await newService(owner, org, { isPublic: false, name: 'Makeup cô dâu (gồm trong gói)' });
    const addonPub = await newService(owner, org, { kind: 'ADDON', listPrice: 300_000, name: 'Làm tóc' });
    const addonHidden = await newService(owner, org, { kind: 'ADDON', isPublic: false, name: 'Nail nội bộ' });
    const subj = await request(app).get(url(org, '/makeup-subjects')).set(bearer(owner)).expect(200);
    const bride = subj.body.items.find((s: { name: string }) => s.name === 'Cô dâu');
    await request(app)
      .put(url(org, '/travel-fee-policy'))
      .set(bearer(owner))
      .send({ defaultMode: 'PER_KM', fixedAmount: 0, perKmAmount: 5000, freeKm: 7.5, minimumAmount: 0, roundTrip: false, tiers: [] })
      .expect(200);
    const mkPkg = (extra: Body) =>
      request(app)
        .post(url(org, '/packages'))
        .set(bearer(owner))
        .set(idem())
        .send({ code: `G-${uniq()}`, name: `Gói ${uniq()}`, durationMinutes: 180, listPrice: 4_000_000, isPublic: true, ...extra })
        .expect(201);
    const pkg = await mkPkg({
      subjectId: bride.id,
      locationTypes: ['CUSTOMER_HOME'],
      items: [
        { serviceId: main.id, isOptional: false },
        { serviceId: addonPub.id, isOptional: true },
        { serviceId: addonHidden.id, isOptional: true },
      ],
    });
    const pkgKm = await mkPkg({ includedKm: 12 });
    const pkgHidden = await mkPkg({ isPublic: false });

    const s = await site(slug).expect(200);
    const serviceIds = s.body.services.map((x: { id: string }) => x.id);
    expect(serviceIds).toContain(visible.id);
    expect(serviceIds).toContain(addonPub.id);
    for (const id of [hidden.id, inactive.id, main.id, addonHidden.id]) expect(serviceIds).not.toContain(id);
    expect(s.body.services.find((x: { id: string }) => x.id === visible.id).price).toEqual({
      listPrice: 1_500_000,
      salePrice: 1_200_000,
      unitPrice: 1_200_000,
    });
    const pkgIds = s.body.packages.map((x: { id: string }) => x.id);
    expect(pkgIds).toEqual(expect.arrayContaining([pkg.body.id, pkgKm.body.id]));
    expect(pkgIds).not.toContain(pkgHidden.body.id);
    const p = s.body.packages.find((x: { id: string }) => x.id === pkg.body.id);
    expect(p).toMatchObject({
      subject: { id: bride.id, name: 'Cô dâu' },
      locationTypes: ['CUSTOMER_HOME'],
      includedKm: 7.5,
      price: { listPrice: 4_000_000, salePrice: null, unitPrice: 4_000_000 },
      included: [{ name: 'Makeup cô dâu (gồm trong gói)', quantity: 1 }],
      addons: [{ serviceId: addonPub.id, name: 'Làm tóc', quantity: 1, price: { unitPrice: 300_000 } }],
    });
    expect(s.body.packages.find((x: { id: string }) => x.id === pkgKm.body.id).includedKm).toBe(12);
    expect(s.body.subjects.map((x: { name: string }) => x.name)).toContain('Cô dâu');
    expect(s.body.travel).toEqual({ freeKm: 7.5 });
  });

  it('giá hẹn tương lai: web vẫn thấy giá cũ tới đúng giờ rồi mới đổi', async () => {
    const { owner, org, slug } = await freshPublishedOrg('gia-hen');
    const svc = await newService(owner, org, { listPrice: 1_000_000 });
    const at = new Date(Date.now() + 2500);
    await request(app)
      .post(url(org, `/services/${svc.id}/prices`))
      .set(bearer(owner))
      .set(idem())
      .send({ listPrice: 1_300_000, effectiveFrom: at.toISOString() })
      .expect(201);
    const priceNow = async () =>
      (await site(slug).expect(200)).body.services.find((x: { id: string }) => x.id === svc.id).price.listPrice as number;
    expect(await priceNow()).toBe(1_000_000);
    await new Promise((r) => setTimeout(r, Math.max(0, at.getTime() - Date.now()) + 200));
    expect(await priceNow()).toBe(1_300_000);
  });

  it('Cache-Control public 60 giây; ETag + If-None-Match → 304', async () => {
    const { slug } = await freshPublishedOrg('dem');
    const r = await site(slug).expect(200);
    expect(r.headers['cache-control']).toBe('public, max-age=60');
    const etag = r.headers.etag;
    expect(typeof etag).toBe('string');
    await site(slug).set('if-none-match', String(etag)).expect(304);
  });

  it('JSON công khai không chứa email chủ, mã thành viên, tiền công, cọc nội bộ, khách hàng', async () => {
    const { owner, org, slug } = await freshPublishedOrg('ri-ri');
    const artist = await registerUser(app, 'tho-ri-ri');
    const memberId = await addMember(app, owner, org, artist, ['artist']);
    const svc = await newService(owner, org);
    await request(app)
      .post(url(org, '/packages'))
      .set(bearer(owner))
      .set(idem())
      .send({ code: `G-${uniq()}`, name: 'Gói có cọc', durationMinutes: 60, listPrice: 2_000_000, depositAmount: 1_234_567, isPublic: true })
      .expect(201);
    const tier = await request(app).post(url(org, '/staff-tiers')).set(bearer(owner)).set(idem()).send({ name: `Bậc ${uniq()}` }).expect(201);
    await request(app)
      .put(url(org, `/services/${svc.id}/pay-rates`))
      .set(bearer(owner))
      .send({ rates: [{ tierId: tier.body.id, amount: 778_899 }] })
      .expect(200);
    const customerName = `Khách Bí Mật ${uniq()}`;
    await request(app)
      .post(url(org, '/customers'))
      .set(bearer(owner))
      .set(idem())
      .send({ fullName: customerName, phone: '0987654321' })
      .expect(201);
    const s = await site(slug).expect(200);
    const text = JSON.stringify(s.body);
    for (const secret of [owner.email, artist.email, memberId, artist.id, owner.id, org, tier.body.id, '778899', '1234567', customerName, '0987654321']) {
      expect(text, `lộ ${secret}`).not.toContain(secret);
    }
    expect(text).not.toMatch(/organizationId|membershipId|createdById|priceVersionId|storageKey|depositAmount/);
  });
});

describe('sửa nghiệm thu máy chủ lát 2 — trang công khai', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const stripId = (r: request.Response) => JSON.stringify({ ...r.body, error: { ...r.body.error, requestId: undefined } });

  it('N11 — thuê bao HUỶ, hoặc hết hạn QUÁ ân hạn → trang công khai 404 giống hệt slug bịa; còn ân hạn / chưa có thuê bao / đang hạn → 200', async () => {
    const plan = await deps.db.subscriptionPlan.create({ data: { code: `hs_${randomUUID().slice(0, 8)}`, name: 'Gói HS', priceMonthly: 0n, features: [] } });
    const fake = await site(`khong-co-${randomUUID().slice(0, 8)}`);
    const cases: [string, { status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED'; startsAt: Date; endsAt: Date | null } | null, number][] = [
      ['chưa có thuê bao', null, 200],
      ['đang hạn', { status: 'ACTIVE', startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + 30 * DAY) }, 200],
      ['hết hạn, còn ân hạn', { status: 'ACTIVE', startsAt: new Date(Date.now() - 40 * DAY), endsAt: new Date(Date.now() - 2 * DAY) }, 200],
      ['hết hạn quá ân hạn', { status: 'ACTIVE', startsAt: new Date(Date.now() - 60 * DAY), endsAt: new Date(Date.now() - 30 * DAY) }, 404],
      ['huỷ từ 30 ngày trước', { status: 'CANCELLED', startsAt: new Date(Date.now() - 30 * DAY), endsAt: null }, 404],
      ['EXPIRED ghi tay', { status: 'EXPIRED', startsAt: new Date(Date.now() - DAY), endsAt: null }, 404],
    ];
    const got: string[] = [];
    for (const [label, sub, want] of cases) {
      const { org, slug } = await freshPublishedOrg(`n11-${randomUUID().slice(0, 4)}`);
      if (sub) await deps.db.organizationSubscription.create({ data: { organizationId: org, planId: plan.id, ...sub } });
      const r = await site(slug);
      got.push(`${label} → ${r.status}`);
      expect(r.status, label).toBe(want);
      if (want === 404) expect(stripId(r)).toBe(stripId(fake));
    }
    console.log(`[N11] ${got.join('; ')}`);
  });

  it('GIỮ (A1) — ảnh logo/ảnh bìa đã XOÁ không còn hiện trên trang công khai (không URL ký, không mã tệp)', async () => {
    const { owner, org, slug } = await freshPublishedOrg(`a1-${randomUUID().slice(0, 4)}`);
    const logo = await makeFile(org, owner, { purpose: 'ORG_LOGO' });
    const cover = await makeFile(org, owner, { purpose: 'ALBUM_IMAGE' });
    await putProfile(owner, org, { brandName: 'Có ảnh', logoFileId: logo, coverFileId: cover }).expect(200);
    const before = (await site(slug).expect(200)).body.profile;
    expect(before.logo?.url).toBeTruthy();
    expect(before.cover?.url).toBeTruthy();
    await request(app).delete(url(org, `/files/${logo}`)).set(bearer(owner)).expect(204);
    const after = await site(slug).expect(200);
    console.log(`[A1] logo trước xoá: ${before.logo ? 'có' : 'không'}; sau xoá: ${after.body.profile.logo ? 'CÒN HIỆN' : 'đã ẩn'}; ảnh bìa (chưa xoá): ${after.body.profile.cover ? 'có' : 'không'}`);
    expect(after.body.profile.logo).toBeNull();
    expect(JSON.stringify(after.body)).not.toContain(logo);
    expect(after.body.profile.cover?.url).toBeTruthy();
  });

  it('GIỮ (A4, A6) — dịch vụ đã ngừng không hiện trong "gồm trong gói"; nhân vật đã ẩn không hiện', async () => {
    const { owner, org, slug } = await freshPublishedOrg(`a4-${randomUUID().slice(0, 4)}`);
    const keep = await newService(owner, org, { name: 'Dịch vụ còn bán' });
    const stop = await newService(owner, org, { name: 'Dịch vụ sắp ngừng' });
    const pkg = await request(app)
      .post(url(org, '/packages'))
      .set(bearer(owner))
      .set(idem())
      .send({ code: `G-${uniq()}`, name: 'Gói A4', durationMinutes: 120, listPrice: 2_000_000, isPublic: true, items: [{ serviceId: keep.id }, { serviceId: stop.id }] })
      .expect(201);
    const subj = await request(app).post(url(org, '/makeup-subjects')).set(bearer(owner)).set(idem()).send({ name: 'Nhân vật sắp ẩn' }).expect(201);
    const s1 = (await site(slug).expect(200)).body;
    expect(s1.packages.find((p: { id: string }) => p.id === pkg.body.id).included.map((i: { name: string }) => i.name).sort()).toEqual(['Dịch vụ còn bán', 'Dịch vụ sắp ngừng']);
    expect(s1.subjects.map((x: { name: string }) => x.name)).toContain('Nhân vật sắp ẩn');
    await request(app).patch(url(org, `/services/${stop.id}`)).set(bearer(owner)).send({ isActive: false }).expect(200);
    await request(app).patch(url(org, `/makeup-subjects/${subj.body.id}`)).set(bearer(owner)).send({ isActive: false }).expect(200);
    const s2 = (await site(slug).expect(200)).body;
    expect(s2.packages.find((p: { id: string }) => p.id === pkg.body.id).included.map((i: { name: string }) => i.name)).toEqual(['Dịch vụ còn bán']);
    expect(s2.subjects.map((x: { name: string }) => x.name)).not.toContain('Nhân vật sắp ẩn');
  });
});
