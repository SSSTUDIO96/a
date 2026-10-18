import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let ownerA: TestUser;
let artistA: TestUser;
let artist2A: TestUser;
let accountantA: TestUser;
let ownerB: TestUser;
let orgA: string;
let orgB: string;
let mArtist: string;
let mArtist2: string;
let mOwnerA: string;
let mB: string;

// Gói/dịch vụ tạo thẳng bằng prisma: module bảng giá do thợ khác làm song song.
async function makePackage(orgId: string, name = 'Gói cưới trọn ngày') {
  return deps.db.servicePackage.create({
    data: { organizationId: orgId, code: `G-${randomUUID().slice(0, 8)}`, name, durationMinutes: 240 },
  });
}

async function makeService(orgId: string, name = 'Makeup dự tiệc') {
  return deps.db.service.create({
    data: { organizationId: orgId, code: `DV-${randomUUID().slice(0, 8)}`, name, durationMinutes: 60 },
  });
}

async function makeTier(orgId: string, owner: TestUser, name: string, sortOrder?: number) {
  const res = await request(app)
    .post(`/api/v1/orgs/${orgId}/staff-tiers`)
    .set(bearer(owner))
    .set('Idempotency-Key', randomUUID())
    .send({ name, ...(sortOrder === undefined ? {} : { sortOrder }) });
  if (res.status !== 201) throw new Error(`Tạo bậc thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

// Ảnh PNG thật nhỏ (1×1) tự dựng trong bài thử, đủ chữ ký đầu tệp + IHDR + IDAT + IEND.
function tinyPng(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = (crcTable[(c ^ x) & 0xff] ?? 0) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function uploadAvatar(orgId: string, owner: TestUser, purpose = 'STAFF_AVATAR') {
  const res = await request(app)
    .post(`/api/v1/orgs/${orgId}/files`)
    .query({ purpose, name: 'anh.png' })
    .set(bearer(owner))
    .set('Idempotency-Key', randomUUID())
    .set('Content-Type', 'application/octet-stream')
    .send(tinyPng());
  if (res.status !== 201) throw new Error(`Tải ảnh thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

const SIGNED = expect.stringMatching(/\/api\/v1\/files\/raw\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

function patchStaff(orgId: string, user: TestUser, membershipId: string, body: Record<string, unknown>) {
  return request(app).patch(`/api/v1/orgs/${orgId}/staff/${membershipId}`).set(bearer(user)).send(body);
}

function putRates(orgId: string, user: TestUser, path: string, rates: { tierId: string; amount: number | null }[]) {
  return request(app).put(`/api/v1/orgs/${orgId}/${path}/pay-rates`).set(bearer(user)).send({ rates });
}

beforeAll(async () => {
  app = makeApp(deps);
  ownerA = await registerUser(app, 'chu-ns-a');
  artistA = await registerUser(app, 'tho-ns');
  artist2A = await registerUser(app, 'tho-ns-2');
  accountantA = await registerUser(app, 'ke-toan');
  ownerB = await registerUser(app, 'chu-ns-b');
  const artistB = await registerUser(app, 'tho-ns-b');
  orgA = await createOrg(app, ownerA, 'nhan-su-a');
  orgB = await createOrg(app, ownerB, 'nhan-su-b');
  mArtist = await addMember(app, ownerA, orgA, artistA, ['artist']);
  mArtist2 = await addMember(app, ownerA, orgA, artist2A, ['artist']);
  await addMember(app, ownerA, orgA, accountantA, ['accountant']);
  mB = await addMember(app, ownerB, orgB, artistB, ['artist']);
  const members = await request(app).get(`/api/v1/orgs/${orgA}/members`).set(bearer(ownerA)).expect(200);
  mOwnerA = members.body.items.find((m: { user: { id: string } }) => m.user.id === ownerA.id).id;
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('bậc lương', () => {
  it('thêm, xếp cuối khi không gửi thứ tự, đổi tên, trùng tên → 409', async () => {
    const org = await createOrg(app, ownerA, 'bac-crud');
    const t1 = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).set('Idempotency-Key', randomUUID()).send({ name: 'Thợ chính' }).expect(201);
    const t2 = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).set('Idempotency-Key', randomUUID()).send({ name: 'Thợ phụ' }).expect(201);
    expect(t1.body.sortOrder).toBe(0);
    expect(t2.body.sortOrder).toBe(1);
    expect(t1.body.staffCount).toBe(0);

    const dup = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).set('Idempotency-Key', randomUUID()).send({ name: 'thợ chính' });
    expect(dup.status).toBe(409);
    const renameDup = await request(app).patch(`/api/v1/orgs/${org}/staff-tiers/${t2.body.id}`).set(bearer(ownerA)).send({ name: 'Thợ chính' });
    expect(renameDup.status).toBe(409);

    const renamed = await request(app)
      .patch(`/api/v1/orgs/${org}/staff-tiers/${t2.body.id}`)
      .set(bearer(ownerA))
      .send({ name: 'Trợ lý', sortOrder: 5 })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Trợ lý', sortOrder: 5, isActive: true });

    const list = await request(app).get(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).expect(200);
    expect(list.body.items.map((t: { name: string }) => t.name)).toEqual(['Thợ chính', 'Trợ lý']);
    const audit = await deps.db.auditLog.count({ where: { organizationId: org, entityType: 'staff_tier' } });
    expect(audit).toBe(3);
  });

  it('chống gửi trùng: cùng khoá + cùng thân → cùng kết quả, 1 bậc; thiếu khoá → 400', async () => {
    const org = await createOrg(app, ownerA, 'bac-trung');
    const key = randomUUID();
    const first = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).set('Idempotency-Key', key).send({ name: 'Bậc A' });
    const again = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).set('Idempotency-Key', key).send({ name: 'Bậc A' });
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(await deps.db.staffTier.count({ where: { organizationId: org } })).toBe(1);
    const noKey = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).send({ name: 'Bậc B' });
    expect(noKey.status).toBe(400);
    expect(await deps.db.staffTier.count({ where: { organizationId: org } })).toBe(1);
  });

  it('thợ (chỉ staff.read) xem được bậc nhưng không thêm được → 403', async () => {
    expect((await request(app).get(`/api/v1/orgs/${orgA}/staff-tiers`).set(bearer(artistA))).status).toBe(200);
    expect((await request(app).post(`/api/v1/orgs/${orgA}/staff-tiers`).set(bearer(artistA)).set('Idempotency-Key', randomUUID()).send({ name: 'Lén' })).status).toBe(403);
  });
});

describe('hồ sơ thợ', () => {
  it('thành viên chưa có hồ sơ vẫn hiện, tên mặc định từ tài khoản', async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgA}/staff`).set(bearer(ownerA)).expect(200);
    const artist = res.body.items.find((s: { membershipId: string }) => s.membershipId === mArtist2);
    expect(artist).toMatchObject({
      displayName: 'Người thử tho-ns-2',
      initials: 'NT',
      avatarUrl: null,
      tier: null,
      isBookable: true,
      hasProfile: false,
      roleKeys: ['artist'],
    });
  });

  it('sửa hồ sơ: chuẩn hoá số, ảnh đại diện từ tệp đã tải (URL ký có hạn), gán bậc, bỏ bậc; ghi nhật ký trước → sau', async () => {
    const org = await createOrg(app, ownerA, 'ho-so');
    const tho = await registerUser(app, 'tho-ho-so');
    const m = await addMember(app, ownerA, org, tho, ['artist']);
    const tier = await makeTier(org, ownerA, 'Bậc 1');
    const avatar = await uploadAvatar(org, ownerA);
    const res = await patchStaff(org, ownerA, m, {
      displayName: 'Hoa Makeup',
      phone: '+84 912 345 678',
      avatarFileId: avatar,
      tierId: tier,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      displayName: 'Hoa Makeup',
      initials: 'HM',
      phone: '0912345678',
      avatarUrl: SIGNED,
      tier: { id: tier, name: 'Bậc 1' },
      hasProfile: true,
    });

    const filtered = await request(app).get(`/api/v1/orgs/${org}/staff`).query({ tierId: tier }).set(bearer(ownerA)).expect(200);
    expect(filtered.body.items.map((s: { membershipId: string }) => s.membershipId)).toEqual([m]);
    const byName = await request(app).get(`/api/v1/orgs/${org}/staff`).query({ q: 'hoa make' }).set(bearer(ownerA)).expect(200);
    expect(byName.body.items.map((s: { membershipId: string }) => s.membershipId)).toEqual([m]);

    const cleared = await patchStaff(org, ownerA, m, { tierId: null, isBookable: false });
    expect(cleared.status).toBe(200);
    expect(cleared.body.tier).toBeNull();
    expect(cleared.body.isBookable).toBe(false);

    const logs = await deps.db.auditLog.findMany({
      where: { organizationId: org, action: 'staff_profile.updated', entityId: m },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs).toHaveLength(2);
    expect(logs[0]?.data).toMatchObject({ before: null });
    expect(logs[1]?.data).toMatchObject({ before: { tierId: tier }, after: { tierId: null } });
  });

  it('dữ liệu sai → 400: ảnh http, số điện thoại sai, thân rỗng', async () => {
    expect((await patchStaff(orgA, ownerA, mArtist, { avatarUrl: 'https://x.vn/a.jpg' })).status).toBe(400);
    expect((await patchStaff(orgA, ownerA, mArtist, { avatarUrl: 'http://x.vn/a.jpg' })).status).toBe(400);
    expect((await patchStaff(orgA, ownerA, mArtist, { avatarUrl: 'không phải url' })).status).toBe(400);
    expect((await patchStaff(orgA, ownerA, mArtist, { phone: '123' })).status).toBe(400);
    expect((await patchStaff(orgA, ownerA, mArtist, {})).status).toBe(400);
  });

  it('không gán được bậc đang ẩn; ẩn bậc còn thợ → 409', async () => {
    const org = await createOrg(app, ownerA, 'an-bac');
    const tho = await registerUser(app, 'tho-an-bac');
    const m = await addMember(app, ownerA, org, tho, ['artist']);
    const busy = await makeTier(org, ownerA, 'Đang dùng');
    const spare = await makeTier(org, ownerA, 'Dự phòng');
    await patchStaff(org, ownerA, m, { tierId: busy }).expect(200);
    const hideBusy = await request(app).patch(`/api/v1/orgs/${org}/staff-tiers/${busy}`).set(bearer(ownerA)).send({ isActive: false });
    expect(hideBusy.status).toBe(409);
    await request(app).patch(`/api/v1/orgs/${org}/staff-tiers/${spare}`).set(bearer(ownerA)).send({ isActive: false }).expect(200);
    expect((await patchStaff(org, ownerA, m, { tierId: spare })).status).toBe(400);
  });

  it('thợ không sửa được hồ sơ → 403', async () => {
    expect((await patchStaff(orgA, artistA, mArtist, { displayName: 'Tự đổi' })).status).toBe(403);
  });
});

describe('tiền công theo bậc của một gói', () => {
  let tierChinh: string;
  let tierPhu: string;
  let tierTrong: string;
  let pkg: { id: string; name: string };
  let svc: { id: string };

  beforeAll(async () => {
    tierPhu = await makeTier(orgA, ownerA, 'Thợ phụ', 2);
    tierChinh = await makeTier(orgA, ownerA, 'Thợ chính', 1);
    tierTrong = await makeTier(orgA, ownerA, 'Bậc chưa có ai', 3);
    await patchStaff(orgA, ownerA, mArtist, { tierId: tierChinh, displayName: 'Lan Anh', avatarFileId: await uploadAvatar(orgA, ownerA) }).expect(200);
    await patchStaff(orgA, ownerA, mOwnerA, { tierId: tierChinh, displayName: 'Bảo Ngọc' }).expect(200);
    await patchStaff(orgA, ownerA, mArtist2, { tierId: tierPhu }).expect(200);
    pkg = await makePackage(orgA);
    svc = await makeService(orgA);
  });

  it('mọi bậc đang hoạt động theo thứ tự, thợ dưới đúng bậc, bậc chưa đặt tiền = null', async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgA}/packages/${pkg.id}/pay-rates`).set(bearer(ownerA)).expect(200);
    expect(res.body.owner).toEqual({ kind: 'package', id: pkg.id, name: pkg.name });
    expect(res.body.items.map((i: { tier: { name: string } }) => i.tier.name)).toEqual(['Thợ chính', 'Thợ phụ', 'Bậc chưa có ai']);
    const [chinh, phu, trong] = res.body.items;
    expect(chinh.amount).toBeNull();
    expect(chinh.staff).toEqual([
      { membershipId: mOwnerA, displayName: 'Bảo Ngọc', avatarUrl: null, initials: 'BN' },
      { membershipId: mArtist, displayName: 'Lan Anh', avatarUrl: SIGNED, initials: 'LA' },
    ]);
    expect(phu.staff.map((s: { membershipId: string }) => s.membershipId)).toEqual([mArtist2]);
    expect(trong.staff).toEqual([]);
    expect(trong.amount).toBeNull();
  });

  it('đặt nhiều bậc một lần, sửa, xoá; mỗi thay đổi một dòng nhật ký', async () => {
    const set = await putRates(orgA, ownerA, `packages/${pkg.id}`, [
      { tierId: tierChinh, amount: 1_500_000 },
      { tierId: tierPhu, amount: 700_000 },
    ]);
    expect(set.status).toBe(200);
    expect(set.body.items.map((i: { amount: number | null }) => i.amount)).toEqual([1_500_000, 700_000, null]);

    const edit = await putRates(orgA, ownerA, `packages/${pkg.id}`, [
      { tierId: tierChinh, amount: 1_800_000 },
      { tierId: tierPhu, amount: null },
      { tierId: tierTrong, amount: 0 },
    ]);
    expect(edit.status).toBe(200);
    expect(edit.body.items.map((i: { amount: number | null }) => i.amount)).toEqual([1_800_000, null, 0]);

    // Gửi lại đúng giá trị cũ thì không ghi gì thêm.
    await putRates(orgA, ownerA, `packages/${pkg.id}`, [{ tierId: tierChinh, amount: 1_800_000 }]).expect(200);

    const logs = await deps.db.auditLog.findMany({
      where: { organizationId: orgA, entityType: 'staff_pay_rate' },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => l.action)).toEqual(['pay_rate.set', 'pay_rate.set', 'pay_rate.set', 'pay_rate.deleted', 'pay_rate.set']);
    expect(logs[2]?.data).toMatchObject({ packageId: pkg.id, tierId: tierChinh, before: 1_500_000, after: 1_800_000 });
    expect(logs[3]?.data).toMatchObject({ tierId: tierPhu, before: 700_000, after: null });

    const rows = await deps.db.staffPayRate.findMany({ where: { packageId: pkg.id } });
    expect(rows.map((r) => r.amount).sort()).toEqual([0n, 1_800_000n]);
  });

  it('tiền công dịch vụ tách riêng với gói', async () => {
    await putRates(orgA, ownerA, `services/${svc.id}`, [{ tierId: tierPhu, amount: 300_000 }]).expect(200);
    const res = await request(app).get(`/api/v1/orgs/${orgA}/services/${svc.id}/pay-rates`).set(bearer(ownerA)).expect(200);
    expect(res.body.owner.kind).toBe('service');
    expect(res.body.items.map((i: { amount: number | null }) => i.amount)).toEqual([null, 300_000, null]);
  });

  it('một dòng hỏng thì cả lô không ghi (một transaction)', async () => {
    const fresh = await makePackage(orgA, 'Gói lô hỏng');
    const res = await putRates(orgA, ownerA, `packages/${fresh.id}`, [
      { tierId: tierChinh, amount: 1_000_000 },
      { tierId: randomUUID(), amount: 500_000 },
    ]);
    expect(res.status).toBe(400);
    expect(await deps.db.staffPayRate.count({ where: { packageId: fresh.id } })).toBe(0);
  });

  it('số tiền âm hoặc lẻ → 400; một bậc gửi hai lần → 400', async () => {
    expect((await putRates(orgA, ownerA, `packages/${pkg.id}`, [{ tierId: tierChinh, amount: -1 }])).status).toBe(400);
    expect((await putRates(orgA, ownerA, `packages/${pkg.id}`, [{ tierId: tierChinh, amount: 1000.5 }])).status).toBe(400);
    const twice = await putRates(orgA, ownerA, `packages/${pkg.id}`, [
      { tierId: tierChinh, amount: 1 },
      { tierId: tierChinh, amount: 2 },
    ]);
    expect(twice.status).toBe(400);
    const strAmount = await request(app)
      .put(`/api/v1/orgs/${orgA}/packages/${pkg.id}/pay-rates`)
      .set(bearer(ownerA))
      .send({ rates: [{ tierId: tierChinh, amount: '1000' }] });
    expect(strAmount.status).toBe(400);
  });

  it('thợ (staff.read, không payroll.read) → 403; kế toán chỉ xem (G3), chủ đặt được', async () => {
    expect((await request(app).get(`/api/v1/orgs/${orgA}/packages/${pkg.id}/pay-rates`).set(bearer(artistA))).status).toBe(403);
    expect((await putRates(orgA, artistA, `packages/${pkg.id}`, [{ tierId: tierChinh, amount: 1 }])).status).toBe(403);
    expect((await request(app).get(`/api/v1/orgs/${orgA}/packages/${pkg.id}/pay-rates`).set(bearer(accountantA))).status).toBe(200);
    expect((await putRates(orgA, accountantA, `packages/${pkg.id}`, [{ tierId: tierPhu, amount: 650_000 }])).status).toBe(403);
    const set = await putRates(orgA, ownerA, `packages/${pkg.id}`, [{ tierId: tierPhu, amount: 650_000 }]);
    expect(set.status).toBe(200);
    expect(set.body.items[1].amount).toBe(650_000);
  });

  it('CHECK database: một dòng có cả gói lẫn dịch vụ bị từ chối', async () => {
    await expect(
      deps.db.staffPayRate.create({
        data: { organizationId: orgA, packageId: pkg.id, serviceId: svc.id, tierId: tierChinh, amount: 1n, updatedById: ownerA.id },
      }),
    ).rejects.toThrow(/staff_pay_rates_one_owner/);
    await expect(
      deps.db.staffPayRate.create({
        data: { organizationId: orgA, tierId: tierChinh, amount: 1n, updatedById: ownerA.id },
      }),
    ).rejects.toThrow(/staff_pay_rates_one_owner/);
    const other = await makePackage(orgA, 'Gói kiểm CHECK tiền');
    await expect(
      deps.db.staffPayRate.create({
        data: { organizationId: orgA, packageId: other.id, tierId: tierChinh, amount: -1n, updatedById: ownerA.id },
      }),
    ).rejects.toThrow(/staff_pay_rates_amount/);
  });
});

describe('cách ly tổ chức', () => {
  let tierA: string;
  let tierB: string;
  let pkgA: { id: string };
  let svcA: { id: string };

  beforeAll(async () => {
    tierA = await makeTier(orgA, ownerA, 'Bậc riêng A');
    tierB = await makeTier(orgB, ownerB, 'Bậc riêng B');
    pkgA = await makePackage(orgA, 'Gói riêng A');
    svcA = await makeService(orgA, 'Dịch vụ riêng A');
  });

  it('B không xem/sửa được bậc của A', async () => {
    expect((await request(app).get(`/api/v1/orgs/${orgA}/staff-tiers`).set(bearer(ownerB))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/orgs/${orgB}/staff-tiers/${tierA}`).set(bearer(ownerB)).send({ name: 'Cướp' })).status).toBe(404);
    const list = await request(app).get(`/api/v1/orgs/${orgB}/staff-tiers`).set(bearer(ownerB)).expect(200);
    expect(list.body.items.map((t: { id: string }) => t.id)).toEqual([tierB]);
    expect((await deps.db.staffTier.findUniqueOrThrow({ where: { id: tierA } })).name).toBe('Bậc riêng A');
  });

  it('B không xem/sửa được hồ sơ thợ của A', async () => {
    const list = await request(app).get(`/api/v1/orgs/${orgB}/staff`).set(bearer(ownerB)).expect(200);
    expect(list.body.items.map((s: { membershipId: string }) => s.membershipId)).not.toContain(mArtist);
    expect((await patchStaff(orgB, ownerB, mArtist, { displayName: 'Cướp' })).status).toBe(404);
    expect((await patchStaff(orgA, ownerB, mArtist, { displayName: 'Cướp' })).status).toBe(404);
  });

  it('không gán được bậc của B cho thợ A', async () => {
    const res = await patchStaff(orgA, ownerA, mArtist, { tierId: tierB });
    expect(res.status).toBe(400);
    const p = await deps.db.staffProfile.findUniqueOrThrow({ where: { membershipId: mArtist } });
    expect(p.tierId).not.toBe(tierB);
  });

  it('B không xem/đặt được tiền công gói, dịch vụ của A; A không đặt được tiền cho bậc của B', async () => {
    expect((await request(app).get(`/api/v1/orgs/${orgB}/packages/${pkgA.id}/pay-rates`).set(bearer(ownerB))).status).toBe(404);
    expect((await request(app).get(`/api/v1/orgs/${orgB}/services/${svcA.id}/pay-rates`).set(bearer(ownerB))).status).toBe(404);
    expect((await request(app).get(`/api/v1/orgs/${orgA}/packages/${pkgA.id}/pay-rates`).set(bearer(ownerB))).status).toBe(404);
    expect((await putRates(orgB, ownerB, `packages/${pkgA.id}`, [{ tierId: tierB, amount: 1 }])).status).toBe(404);
    expect((await putRates(orgB, ownerB, `services/${svcA.id}`, [{ tierId: tierB, amount: 1 }])).status).toBe(404);
    const cross = await putRates(orgA, ownerA, `packages/${pkgA.id}`, [{ tierId: tierB, amount: 1 }]);
    expect(cross.status).toBe(400);
    expect(cross.body.error.details.tierIds).toEqual([tierB]);
    expect(await deps.db.staffPayRate.count({ where: { packageId: pkgA.id } })).toBe(0);
    // Màn tiền công của B không lộ thợ của A dưới bậc nào.
    const pkgB = await makePackage(orgB, 'Gói B');
    await patchStaff(orgB, ownerB, mB, { tierId: tierB }).expect(200);
    const sheetB = await request(app).get(`/api/v1/orgs/${orgB}/packages/${pkgB.id}/pay-rates`).set(bearer(ownerB)).expect(200);
    const ids = sheetB.body.items.flatMap((i: { staff: { membershipId: string }[] }) => i.staff.map((s) => s.membershipId));
    expect(ids).toEqual([mB]);
  });
});

describe('T2: thứ bậc khi sửa hồ sơ thợ, đổi bậc lương cần payroll.write', () => {
  let org: string;
  let owner: TestUser;
  let manager: TestUser;
  let admin: TestUser;
  let tho: TestUser;
  let mOwner: string;
  let mManager: string;
  let mAdmin: string;
  let mTho: string;
  let tierLow: string;
  let tierHigh: string;

  beforeAll(async () => {
    owner = await registerUser(app, 'chu-t2');
    manager = await registerUser(app, 'quan-ly-t2');
    admin = await registerUser(app, 'quan-tri-t2');
    tho = await registerUser(app, 'tho-t2');
    org = await createOrg(app, owner, 't2');
    mManager = await addMember(app, owner, org, manager, ['manager']);
    mAdmin = await addMember(app, owner, org, admin, ['admin']);
    mTho = await addMember(app, owner, org, tho, ['artist']);
    const members = await request(app).get(`/api/v1/orgs/${org}/members`).set(bearer(owner)).expect(200);
    mOwner = members.body.items.find((m: { user: { id: string } }) => m.user.id === owner.id).id;
    tierLow = await makeTier(org, owner, 'Bậc 1');
    tierHigh = await makeTier(org, owner, 'Bậc 5');
    await patchStaff(org, owner, mManager, { tierId: tierLow }).expect(200);
  });

  it('BẮT: quản lý không tự nâng bậc của mình (không có payroll.write)', async () => {
    const res = await patchStaff(org, manager, mManager, { tierId: tierHigh });
    expect(res.status).toBe(403);
    expect(res.body.error.details.required).toBe('payroll.write');
    const p = await deps.db.staffProfile.findUniqueOrThrow({ where: { membershipId: mManager } });
    expect(p.tierId).toBe(tierLow);
  });

  it('BẮT: quản lý không đổi bậc của thợ khác (bậc quyết định tiền công)', async () => {
    await patchStaff(org, owner, mTho, { tierId: tierLow }).expect(200);
    expect((await patchStaff(org, manager, mTho, { tierId: tierHigh })).status).toBe(403);
    expect((await patchStaff(org, manager, mTho, { tierId: null })).status).toBe(403);
    expect((await deps.db.staffProfile.findUniqueOrThrow({ where: { membershipId: mTho } })).tierId).toBe(tierLow);
  });

  it('BẮT: quản lý không sửa được hồ sơ chủ và quản trị', async () => {
    const onOwner = await patchStaff(org, manager, mOwner, { displayName: 'Bị đổi', isBookable: false });
    expect(onOwner.status).toBe(403);
    expect(await deps.db.staffProfile.findUnique({ where: { membershipId: mOwner } })).toBeNull();
    const onAdmin = await patchStaff(org, manager, mAdmin, { isBookable: false });
    expect(onAdmin.status).toBe(403);
    expect(onAdmin.body.error.details.missing).toContain('payroll.write');
  });

  it('BẮT: quản trị (có payroll.write, không phải chủ) không tự đổi bậc của mình', async () => {
    const res = await patchStaff(org, admin, mAdmin, { tierId: tierHigh });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('chính mình');
  });

  it('GIỮ: quản lý vẫn sửa hồ sơ thợ dưới quyền và tên của chính mình; gửi lại đúng bậc hiện tại không bị chặn', async () => {
    const res = await patchStaff(org, manager, mTho, { displayName: 'Thợ T2', isBookable: false, phone: '0912 111 222' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ displayName: 'Thợ T2', isBookable: false, phone: '0912111222' });
    const self = await patchStaff(org, manager, mManager, { displayName: 'Quản lý T2', tierId: tierLow });
    expect(self.status).toBe(200);
    expect(self.body.tier.id).toBe(tierLow);
  });

  it('GIỮ: quản trị đổi bậc của thợ; chủ tự đổi bậc của mình', async () => {
    const res = await patchStaff(org, admin, mTho, { tierId: tierHigh });
    expect(res.status).toBe(200);
    expect(res.body.tier.id).toBe(tierHigh);
    const self = await patchStaff(org, owner, mOwner, { tierId: tierHigh });
    expect(self.status).toBe(200);
  });

  it('BẮT: người vừa bị tước staff.write không sửa tiếp được (tra lại quyền trong transaction)', async () => {
    await request(app).patch(`/api/v1/orgs/${org}/members/${mManager}`).set(bearer(owner)).send({ roleKeys: ['artist'] }).expect(200);
    expect((await patchStaff(org, manager, mTho, { displayName: 'Sau khi bị hạ' })).status).toBe(403);
    await request(app).patch(`/api/v1/orgs/${org}/members/${mManager}`).set(bearer(owner)).send({ roleKeys: ['manager'] }).expect(200);
  });
});

describe('G5: số điện thoại thợ chỉ hiện cho người có staff.write', () => {
  let org: string;
  let owner: TestUser;
  let tho: TestUser;
  let leTan: TestUser;
  let mTho: string;

  beforeAll(async () => {
    owner = await registerUser(app, 'chu-g5');
    tho = await registerUser(app, 'tho-g5');
    leTan = await registerUser(app, 'le-tan-g5');
    org = await createOrg(app, owner, 'g5');
    mTho = await addMember(app, owner, org, tho, ['artist']);
    await addMember(app, owner, org, leTan, ['receptionist']);
    await patchStaff(org, owner, mTho, { phone: '0987 654 321' }).expect(200);
  });

  it('GIỮ: chủ (staff.write) thấy số và tìm được theo số', async () => {
    const res = await request(app).get(`/api/v1/orgs/${org}/staff`).set(bearer(owner)).expect(200);
    expect(res.body.items.find((s: { membershipId: string }) => s.membershipId === mTho).phone).toBe('0987654321');
    const byPhone = await request(app).get(`/api/v1/orgs/${org}/staff`).query({ q: '987654' }).set(bearer(owner)).expect(200);
    expect(byPhone.body.items.map((s: { membershipId: string }) => s.membershipId)).toEqual([mTho]);
  });

  it('BẮT: thợ và lễ tân (chỉ staff.read) nhận phone null, không dò được số qua ô tìm kiếm', async () => {
    for (const viewer of [tho, leTan]) {
      const res = await request(app).get(`/api/v1/orgs/${org}/staff`).set(bearer(viewer)).expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      for (const s of res.body.items) expect(s.phone).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain('0987654321');
      const probe = await request(app).get(`/api/v1/orgs/${org}/staff`).query({ q: '987654' }).set(bearer(viewer)).expect(200);
      expect(probe.body.items).toEqual([]);
    }
  });
});

describe('mức rảnh của thợ (trùng giờ / cùng ngày / rảnh)', () => {
  let org: string;
  let owner: TestUser;
  let t1: string;
  let t2: string;
  let t3: string;
  let t4: string;
  let t5: string;
  let apptT1: string;
  let draftContract: string;

  // Giờ Việt Nam (+07:00) — ngày D là 10/04/2031.
  const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`).toISOString();
  const D = '2031-04-10';

  async function appt(membershipId: string, date: string, from: string, to: string, extra: Record<string, unknown> = {}) {
    const res = await request(app)
      .post(`/api/v1/orgs/${org}/appointments`)
      .set(bearer(owner))
      .set('Idempotency-Key', randomUUID())
      .send({ startsAt: vn(date, from), endsAt: vn(date, to), status: 'CONFIRMED', staff: [{ membershipId }], ...extra });
    if (res.status !== 201) throw new Error(`Tạo lịch thất bại ${res.status}: ${JSON.stringify(res.body)}`);
    return res.body as { id: string; code: string };
  }

  function availability(user: TestUser, orgId: string, query: Record<string, string>) {
    return request(app).get(`/api/v1/orgs/${orgId}/staff/availability`).query(query).set(bearer(user));
  }

  type Item = { membershipId: string; level: string; overlaps: { code: string }[]; sameDay: { code: string }[]; draftHolds: { contractId: string; overlaps: boolean }[] };
  const byId = (items: Item[], id: string) => {
    const found = items.find((i) => i.membershipId === id);
    if (!found) throw new Error(`Không thấy thợ ${id} trong kết quả`);
    return found;
  };

  beforeAll(async () => {
    owner = await registerUser(app, 'chu-ranh');
    org = await createOrg(app, owner, 'ranh');
    const artist = async (label: string) => addMember(app, owner, org, await registerUser(app, label), ['artist']);
    t1 = await artist('tho-ranh-1');
    t2 = await artist('tho-ranh-2');
    t3 = await artist('tho-ranh-3');
    t4 = await artist('tho-ranh-4');
    t5 = await artist('tho-ranh-5');
    // t1: 8–10h + đi 60 phút → bận tới 11h.
    apptT1 = (await appt(t1, D, '08:00', '10:00', { travelAfterMin: 60 })).id;
    // t2: ca chiều cùng ngày.
    await appt(t2, D, '14:00', '15:00');
    // t3: 23:30 hôm trước và 01:00 hôm sau — theo giờ UTC hai ca này lại rơi vào "ngày khác"/"cùng ngày" nếu tính sai múi giờ.
    await appt(t3, '2031-04-09', '23:30', '23:59');
    await appt(t3, '2031-04-11', '01:00', '02:00');
    // t4: 06:00 sáng ngày D (theo UTC là 23:00 hôm trước) → vẫn cùng ngày theo giờ Việt Nam.
    await appt(t4, D, '06:00', '07:00');
    // t5: lịch nháp và lịch đã huỷ chồng giờ — không tính.
    await appt(t5, D, '10:00', '12:00', { status: 'DRAFT' });
    const cancelled = await appt(t5, D, '10:30', '11:30');
    await request(app)
      .post(`/api/v1/orgs/${org}/appointments/${cancelled.id}/status`)
      .set(bearer(owner))
      .send({ to: 'CANCELLED', reason: 'Khách huỷ' })
      .expect(200);
    // t5 đang được giữ chỗ ở một hợp đồng NHÁP khác, dòng 10–12h ngày D.
    const customer = await deps.db.customer.create({ data: { organizationId: org, fullName: 'Khách giữ chỗ' } });
    const contract = await deps.db.contract.create({
      data: { organizationId: org, code: `HD-${randomUUID().slice(0, 8)}`, customerId: customer.id, createdById: owner.id },
    });
    draftContract = contract.id;
    const line = await deps.db.contractLine.create({
      data: {
        organizationId: org,
        contractId: contract.id,
        kind: 'CUSTOM',
        name: 'Makeup cô dâu (giữ chỗ)',
        unitPrice: 0n,
        lineTotal: 0n,
        scheduledStart: new Date(vn(D, '10:00')),
        scheduledEnd: new Date(vn(D, '12:00')),
        createdById: owner.id,
      },
    });
    await deps.db.contractLineStaff.create({ data: { organizationId: org, lineId: line.id, membershipId: t5, role: 'PRIMARY' } });
  });

  it('trùng do thời gian di chuyển → OVERLAP kèm ca; cùng ngày khác giờ → SAME_DAY; ranh giới ngày theo giờ Việt Nam', async () => {
    const res = await availability(owner, org, { startsAt: vn(D, '10:30'), endsAt: vn(D, '11:30') });
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(res.body.dayStart).toBe(vn(D, '00:00'));
    const items = res.body.items as Item[];
    expect(byId(items, t1).level).toBe('OVERLAP');
    expect(byId(items, t1).overlaps).toHaveLength(1);
    expect(byId(items, t2).level).toBe('SAME_DAY');
    expect(byId(items, t2).sameDay).toHaveLength(1);
    expect(byId(items, t3).level).toBe('FREE');
    expect(byId(items, t3).sameDay).toEqual([]);
    expect(byId(items, t4).level).toBe('SAME_DAY');
  });

  it('lịch nháp/đã huỷ không tính; giữ chỗ ở hợp đồng nháp khác hiện trong draftHolds, không đổi mức', async () => {
    const res = await availability(owner, org, { startsAt: vn(D, '10:30'), endsAt: vn(D, '11:30') });
    const e = byId(res.body.items as Item[], t5);
    expect(e.level).toBe('FREE');
    expect(e.overlaps).toEqual([]);
    expect(e.draftHolds).toEqual([expect.objectContaining({ contractId: draftContract, overlaps: true, lineName: 'Makeup cô dâu (giữ chỗ)' })]);
    const own = await availability(owner, org, { startsAt: vn(D, '10:30'), endsAt: vn(D, '11:30'), excludeContractId: draftContract });
    expect(byId(own.body.items as Item[], t5).draftHolds).toEqual([]);
  });

  it('lọc theo thợ; bỏ qua chính lịch đang sửa (excludeAppointmentIds)', async () => {
    const res = await availability(owner, org, {
      startsAt: vn(D, '09:00'),
      endsAt: vn(D, '09:30'),
      membershipIds: `${t1},${t2}`,
      excludeAppointmentIds: apptT1,
    });
    expect(res.status).toBe(200);
    const items = res.body.items as Item[];
    expect(items.map((i) => i.membershipId).sort()).toEqual([t1, t2].sort());
    expect(byId(items, t1).level).toBe('FREE');
  });

  it('khung giờ sai → 400 (thiếu, kết thúc trước bắt đầu, quá 24 giờ, mã thợ sai)', async () => {
    expect((await availability(owner, org, { startsAt: vn(D, '10:00') })).status).toBe(400);
    expect((await availability(owner, org, { startsAt: vn(D, '10:00'), endsAt: vn(D, '09:00') })).status).toBe(400);
    expect((await availability(owner, org, { startsAt: vn(D, '10:00'), endsAt: vn('2031-04-11', '10:01') })).status).toBe(400);
    expect((await availability(owner, org, { startsAt: vn(D, '10:00'), endsAt: vn(D, '11:00'), membershipIds: 'abc' })).status).toBe(400);
  });

  it('tổ chức khác không thấy thợ và ca của tổ chức này', async () => {
    const q = { startsAt: vn(D, '10:30'), endsAt: vn(D, '11:30') };
    expect((await availability(ownerB, org, q)).status).toBe(404);
    const res = await availability(ownerB, orgB, { ...q, membershipIds: `${t1},${t5}`, excludeContractId: draftContract });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    const all = await availability(ownerB, orgB, q);
    const text = JSON.stringify(all.body);
    for (const id of [t1, t2, t3, t4, t5, apptT1, draftContract]) expect(text).not.toContain(id);
  });

  it('thợ (staff.read) xem được mức rảnh', async () => {
    const tho = await registerUser(app, 'tho-xem-ranh');
    await addMember(app, owner, org, tho, ['artist']);
    expect((await availability(tho, org, { startsAt: vn(D, '10:30'), endsAt: vn(D, '11:30') })).status).toBe(200);
  });
});

describe('ảnh đại diện thợ từ kho tệp', () => {
  it('BẮT: tệp không phải STAFF_AVATAR, tệp đã xoá, tệp của tổ chức khác, mã bịa → 400 cùng một lời báo', async () => {
    const album = await uploadAvatar(orgA, ownerA, 'ALBUM_IMAGE');
    const deleted = await uploadAvatar(orgA, ownerA);
    await request(app).delete(`/api/v1/orgs/${orgA}/files/${deleted}`).set(bearer(ownerA)).expect(204);
    const ofB = await uploadAvatar(orgB, ownerB);
    const messages = new Set<string>();
    for (const id of [album, deleted, ofB, randomUUID()]) {
      const res = await patchStaff(orgA, ownerA, mArtist2, { avatarFileId: id });
      expect(res.status).toBe(400);
      messages.add(res.body.error.message);
    }
    expect(messages.size).toBe(1);
  });

  it('GIỮ: gắn ảnh → danh sách thợ trả URL ký có hạn, đọc được ảnh; xoá tệp → avatarUrl null; bỏ ảnh bằng null', async () => {
    const avatar = await uploadAvatar(orgA, ownerA);
    await patchStaff(orgA, ownerA, mArtist2, { avatarFileId: avatar }).expect(200);
    const list = await request(app).get(`/api/v1/orgs/${orgA}/staff`).set(bearer(artistA)).expect(200);
    const row = list.body.items.find((s: { membershipId: string }) => s.membershipId === mArtist2);
    expect(row.avatarUrl).toEqual(SIGNED);
    const stored = await deps.db.staffProfile.findUniqueOrThrow({ where: { membershipId: mArtist2 } });
    expect(stored).toMatchObject({ avatarFileId: avatar, avatarUrl: null });
    await request(app).delete(`/api/v1/orgs/${orgA}/files/${avatar}`).set(bearer(ownerA)).expect(204);
    const after = await request(app).get(`/api/v1/orgs/${orgA}/staff`).set(bearer(ownerA)).expect(200);
    expect(after.body.items.find((s: { membershipId: string }) => s.membershipId === mArtist2).avatarUrl).toBeNull();
    const cleared = await patchStaff(orgA, ownerA, mArtist2, { avatarFileId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.avatarUrl).toBeNull();
  });
});
