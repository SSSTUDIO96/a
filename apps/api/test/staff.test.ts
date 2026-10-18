import { randomUUID } from 'node:crypto';
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
    .send({ name, ...(sortOrder === undefined ? {} : { sortOrder }) });
  if (res.status !== 201) throw new Error(`Tạo bậc thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

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
    const t1 = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).send({ name: 'Thợ chính' }).expect(201);
    const t2 = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).send({ name: 'Thợ phụ' }).expect(201);
    expect(t1.body.sortOrder).toBe(0);
    expect(t2.body.sortOrder).toBe(1);
    expect(t1.body.staffCount).toBe(0);

    const dup = await request(app).post(`/api/v1/orgs/${org}/staff-tiers`).set(bearer(ownerA)).send({ name: 'thợ chính' });
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

  it('thợ (chỉ staff.read) xem được bậc nhưng không thêm được → 403', async () => {
    expect((await request(app).get(`/api/v1/orgs/${orgA}/staff-tiers`).set(bearer(artistA))).status).toBe(200);
    expect((await request(app).post(`/api/v1/orgs/${orgA}/staff-tiers`).set(bearer(artistA)).send({ name: 'Lén' })).status).toBe(403);
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

  it('sửa hồ sơ: chuẩn hoá số, ảnh https, gán bậc, bỏ bậc; ghi nhật ký trước → sau', async () => {
    const org = await createOrg(app, ownerA, 'ho-so');
    const tho = await registerUser(app, 'tho-ho-so');
    const m = await addMember(app, ownerA, org, tho, ['artist']);
    const tier = await makeTier(org, ownerA, 'Bậc 1');
    const res = await patchStaff(org, ownerA, m, {
      displayName: 'Hoa Makeup',
      phone: '+84 912 345 678',
      avatarUrl: 'https://cdn.example.vn/a.jpg',
      tierId: tier,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      displayName: 'Hoa Makeup',
      initials: 'HM',
      phone: '0912345678',
      avatarUrl: 'https://cdn.example.vn/a.jpg',
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
    await patchStaff(orgA, ownerA, mArtist, { tierId: tierChinh, displayName: 'Lan Anh', avatarUrl: 'https://cdn.example.vn/lan.jpg' }).expect(200);
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
      { membershipId: mArtist, displayName: 'Lan Anh', avatarUrl: 'https://cdn.example.vn/lan.jpg', initials: 'LA' },
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

  it('thợ (staff.read, không payroll.read) → 403; kế toán xem và đặt được', async () => {
    expect((await request(app).get(`/api/v1/orgs/${orgA}/packages/${pkg.id}/pay-rates`).set(bearer(artistA))).status).toBe(403);
    expect((await putRates(orgA, artistA, `packages/${pkg.id}`, [{ tierId: tierChinh, amount: 1 }])).status).toBe(403);
    expect((await request(app).get(`/api/v1/orgs/${orgA}/packages/${pkg.id}/pay-rates`).set(bearer(accountantA))).status).toBe(200);
    const set = await putRates(orgA, accountantA, `packages/${pkg.id}`, [{ tierId: tierPhu, amount: 650_000 }]);
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
