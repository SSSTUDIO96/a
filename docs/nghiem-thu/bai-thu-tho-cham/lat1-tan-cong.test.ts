// BÀI THỬ CỦA THỢ CHẤM — LÁT 1 (bảng giá, khách + lịch, hợp đồng, nhân sự & bậc lương).
// Quy ước như mốc 2: "LỖI:" xanh = lỗi có thật; "CHẶN:" xanh = đòn bị chặn; "GHI NHẬN:" xanh = hành vi có thật, cần chủ quyết.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from '../test/helpers';

const deps = makeDeps();
let app: App;

const idem = () => `nt-${randomUUID()}`;

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
function call(u: TestUser, method: Method, path: string, body?: unknown, key: string | null = idem()) {
  const r = request(app)[method](`/api/v1${path}`).set(bearer(u));
  if (key && method !== 'get') r.set('idempotency-key', key);
  if (method === 'get') return body ? r.query(body as Record<string, string>) : r;
  return body === undefined ? r : r.send(body as object);
}
async function ok(u: TestUser, method: Method, path: string, body?: unknown) {
  const res = await call(u, method, path, body);
  if (res.status >= 300) throw new Error(`${method.toUpperCase()} ${path} → ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

interface Org {
  orgId: string;
  o: string;
  owner: TestUser;
  manager: TestUser;
  artist: TestUser;
  receptionist: TestUser;
  accountant: TestUser;
  ownerMid: string;
  managerMid: string;
  artistMid: string;
  receptionistMid: string;
  main: string;
  hair: string;
  nail: string;
  early: string;
  pkg: string;
  bride: string;
  studio: string;
  customer: string;
  tierLow: string;
  tierHigh: string;
  category: string;
}

async function seedOrg(label: string): Promise<Org> {
  const owner = await registerUser(app, `l1-chu-${label}`);
  const manager = await registerUser(app, `l1-ql-${label}`);
  const artist = await registerUser(app, `l1-tho-${label}`);
  const receptionist = await registerUser(app, `l1-lt-${label}`);
  const accountant = await registerUser(app, `l1-kt-${label}`);
  const orgId = await createOrg(app, owner, `l1-${label}`);
  const o = `/orgs/${orgId}`;
  const managerMid = await addMember(app, owner, orgId, manager, ['manager']);
  const artistMid = await addMember(app, owner, orgId, artist, ['artist']);
  const receptionistMid = await addMember(app, owner, orgId, receptionist, ['receptionist']);
  await addMember(app, owner, orgId, accountant, ['accountant']);
  const members = await ok(owner, 'get', `${o}/members`, { pageSize: '100' });
  const ownerMid = members.items.find((m: { user: { id: string } }) => m.user.id === owner.id).id;
  const category = (await ok(owner, 'post', `${o}/service-categories`, { name: `Nhóm ${label}` })).id;
  const svc = async (code: string, kind: string, listPrice: number) =>
    (await ok(owner, 'post', `${o}/services`, { code, name: code, kind, durationMinutes: 60, listPrice })).id as string;
  const main = await svc('MK', 'MAIN', 800_000);
  const hair = await svc('TOC', 'ADDON', 300_000);
  const nail = await svc('NAIL', 'ADDON', 150_000);
  const early = await svc('CA-SOM', 'SURCHARGE', 200_000);
  const subjects = await ok(owner, 'get', `${o}/makeup-subjects`);
  const list = (Array.isArray(subjects) ? subjects : subjects.items) as { id: string; name: string }[];
  const bride = list.find((s) => s.name === 'Cô dâu')!.id;
  const pkg = (
    await ok(owner, 'post', `${o}/packages`, {
      code: 'CO-DAU',
      name: 'Gói cô dâu',
      durationMinutes: 120,
      depositAmount: 1_000_000,
      subjectId: bride,
      listPrice: 3_500_000,
      salePrice: 3_000_000,
    })
  ).id;
  const studio = (await ok(owner, 'post', `${o}/studio-locations`, { name: 'Studio Q1', address: '1 Lê Lợi', isDefault: true })).id;
  await ok(owner, 'put', `${o}/travel-fee-policy`, {
    defaultMode: 'PER_KM',
    fixedAmount: 150_000,
    perKmAmount: 5_000,
    freeKm: 3,
    minimumAmount: 0,
    roundTrip: true,
  });
  const customer = (await ok(owner, 'post', `${o}/customers`, { fullName: `Khách ${label}`, phone: '0912345678' })).id;
  const tierLow = (await ok(owner, 'post', `${o}/staff-tiers`, { name: 'Bậc 1' })).id;
  const tierHigh = (await ok(owner, 'post', `${o}/staff-tiers`, { name: 'Bậc 5' })).id;
  return {
    orgId, o, owner, manager, artist, receptionist, accountant, ownerMid, managerMid, artistMid, receptionistMid,
    main, hair, nail, early, pkg, bride, studio, customer, tierLow, tierHigh, category,
  };
}

let A: Org;
let B: Org;

beforeAll(async () => {
  app = makeApp(deps);
  A = await seedOrg('a');
  B = await seedOrg('b');
});
afterAll(async () => {
  await deps.db.$disconnect();
});

const simpleContract = (X: Org, extra: Record<string, unknown> = {}) => ({
  customerId: X.customer,
  lines: [{ kind: 'SERVICE', serviceId: X.main, quantity: 1, locationType: 'STUDIO' }],
  ...extra,
});

let slot = 0;
// Mỗi bài một ngày riêng (năm 2027) để không đụng lịch của bài khác.
function day(h: number, m = 0) {
  const d = new Date(Date.UTC(2027, 0, 1 + slot, h, m));
  return d.toISOString();
}

describe('1. Gắn tài nguyên của tổ chức khác qua THÂN yêu cầu', () => {
  it('CHẶN: hợp đồng của B không dùng được khách, gói, dịch vụ, dịch vụ phụ, phụ phí, nhân vật, studio của A', async () => {
    const base = { customerId: B.customer };
    const cases: [string, unknown][] = [
      ['customerId', { customerId: A.customer, lines: [{ kind: 'SERVICE', serviceId: B.main, quantity: 1 }] }],
      ['packageId', { ...base, lines: [{ kind: 'PACKAGE', packageId: A.pkg, quantity: 1 }] }],
      ['serviceId', { ...base, lines: [{ kind: 'SERVICE', serviceId: A.main, quantity: 1 }] }],
      ['addon', { ...base, lines: [{ kind: 'SERVICE', serviceId: B.main, quantity: 1, addons: [{ serviceId: A.hair, quantity: 1 }] }] }],
      ['surcharge', { ...base, lines: [{ kind: 'SURCHARGE', serviceId: A.early, quantity: 1 }] }],
      ['subjectId', { ...base, lines: [{ kind: 'SERVICE', serviceId: B.main, quantity: 1, subjectId: A.bride }] }],
      ['studioLocationId', { ...base, lines: [{ kind: 'SERVICE', serviceId: B.main, quantity: 1, locationType: 'STUDIO', studioLocationId: A.studio }] }],
    ];
    const got: Record<string, number> = {};
    for (const [name, body] of cases) {
      const q = await call(B.owner, 'post', `${B.o}/contracts/quote`, body);
      const c = await call(B.owner, 'post', `${B.o}/contracts`, body);
      got[name] = c.status;
      expect(q.status, `quote ${name}`).toBe(404);
      expect(JSON.stringify(q.body) + JSON.stringify(c.body)).not.toContain('Khách a');
    }
    expect(got).toEqual({ customerId: 404, packageId: 404, serviceId: 404, addon: 404, surcharge: 404, subjectId: 404, studioLocationId: 404 });
  });

  it('CHẶN: lịch của B không gắn được khách, hợp đồng, dòng hợp đồng, thợ của A', async () => {
    slot++;
    const cA = await ok(A.owner, 'post', `${A.o}/contracts`, simpleContract(A));
    const cB = await ok(B.owner, 'post', `${B.o}/contracts`, simpleContract(B));
    const t = { startsAt: day(1), endsAt: day(2) };
    const r1 = await call(B.owner, 'post', `${B.o}/appointments`, { ...t, customerId: A.customer });
    const r2 = await call(B.owner, 'post', `${B.o}/appointments`, { ...t, contractId: cA.id });
    const r3 = await call(B.owner, 'post', `${B.o}/appointments`, { ...t, contractId: cB.id, contractLineId: cA.lines[0].id });
    const r4 = await call(B.owner, 'post', `${B.o}/appointments`, { ...t, staff: [{ membershipId: A.artistMid, role: 'PRIMARY' }] });
    const own = await ok(B.owner, 'post', `${B.o}/appointments`, { ...t, status: 'DRAFT' });
    const r5 = await call(B.owner, 'patch', `${B.o}/appointments/${own.id}`, { staff: [{ membershipId: A.artistMid, role: 'PRIMARY' }] });
    expect([r1.status, r2.status, r3.status, r4.status, r5.status]).toEqual([404, 404, 400, 400, 400]);
  });

  it('CHẶN: gói, dịch vụ, hồ sơ thợ, tiền công của B không trỏ được sang dịch vụ, nhân vật, danh mục, bậc của A', async () => {
    const p1 = await call(B.owner, 'post', `${B.o}/packages`, { code: 'X1', name: 'X1', durationMinutes: 60, listPrice: 1, items: [{ serviceId: A.hair }] });
    const p2 = await call(B.owner, 'post', `${B.o}/packages`, { code: 'X2', name: 'X2', durationMinutes: 60, listPrice: 1, subjectId: A.bride });
    const p3 = await call(B.owner, 'patch', `${B.o}/packages/${B.pkg}`, { items: [{ serviceId: A.nail, isOptional: true }] });
    const s1 = await call(B.owner, 'post', `${B.o}/services`, { code: 'X3', name: 'X3', durationMinutes: 60, listPrice: 1, categoryId: A.category });
    const st = await call(B.owner, 'patch', `${B.o}/staff/${B.artistMid}`, { tierId: A.tierHigh });
    const pr = await call(B.owner, 'put', `${B.o}/packages/${B.pkg}/pay-rates`, { rates: [{ tierId: A.tierHigh, amount: 1 }] });
    expect([p1.status, p2.status, p3.status, s1.status, st.status, pr.status]).toEqual([400, 400, 400, 400, 400, 400]);
  });

  it('CHẶN: lọc danh sách của B bằng id của A không lộ gì của A', async () => {
    const c = await call(B.owner, 'get', `${B.o}/contracts`, { customerId: A.customer });
    const a = await call(B.owner, 'get', `${B.o}/appointments`, { from: '2027-01-01T00:00:00Z', to: '2027-02-28T00:00:00Z', membershipId: A.artistMid });
    expect([c.status, a.status]).toEqual([200, 200]);
    expect(c.body.items).toEqual([]);
    expect(a.body.items).toEqual([]);
  });
});

describe('2. Tiền', () => {
  it('CHẶN: số lẻ, số âm, chuỗi, số mũ, số quá lớn, giảm giá/cọc vượt tổng → 400, không 500', async () => {
    const line = (o: Record<string, unknown>) => ({ customerId: A.customer, lines: [{ kind: 'CUSTOM', name: 'X', quantity: 1, unitPrice: 1000, ...o }] });
    const bodies: [string, unknown][] = [
      ['đơn giá lẻ', line({ unitPrice: 1000.5 })],
      ['đơn giá âm', line({ unitPrice: -1 })],
      ['đơn giá chuỗi', line({ unitPrice: '1000' })],
      ['đơn giá 1e21', line({ unitPrice: 1e21 })],
      ['số lượng lẻ', line({ quantity: 1.5 })],
      ['số lượng 0', line({ quantity: 0 })],
      ['vượt số nguyên an toàn', line({ unitPrice: Number.MAX_SAFE_INTEGER, quantity: 2 })],
      ['giảm giá > tổng', { ...line({}), discount: 1001 }],
      ['cọc > tổng', { ...line({}), depositRequired: 1001 }],
      ['giảm giá dòng > thành tiền', { customerId: A.customer, lines: [{ kind: 'SERVICE', serviceId: A.main, quantity: 1, lineDiscount: 800_001 }] }],
      ['phụ phí ghi đè thiếu lý do', { customerId: A.customer, lines: [{ kind: 'SURCHARGE', serviceId: A.early, quantity: 1, unitPrice: 0 }] }],
      ['km 3 chữ số lẻ', { customerId: A.customer, lines: [{ kind: 'SERVICE', serviceId: A.main, quantity: 1, locationType: 'CUSTOMER_HOME', travel: { mode: 'PER_KM', distanceKm: 2.005 } }] }],
      ['km khổng lồ', { customerId: A.customer, lines: [{ kind: 'SERVICE', serviceId: A.main, quantity: 1, locationType: 'CUSTOMER_HOME', travel: { mode: 'PER_KM', distanceKm: 1e9 } }] }],
      ['nhập tay thiếu số tiền', { customerId: A.customer, lines: [{ kind: 'SERVICE', serviceId: A.main, quantity: 1, locationType: 'OTHER', travel: { mode: 'MANUAL' } }] }],
      ['theo km gửi kèm số tiền', { customerId: A.customer, lines: [{ kind: 'SERVICE', serviceId: A.main, quantity: 1, locationType: 'OTHER', travel: { mode: 'PER_KM', distanceKm: 5, amount: 0 } }] }],
      ['tại nhà thiếu phí di chuyển', { customerId: A.customer, lines: [{ kind: 'SERVICE', serviceId: A.main, quantity: 1, locationType: 'CUSTOMER_HOME' }] }],
      ['tại studio có phí di chuyển', { customerId: A.customer, lines: [{ kind: 'SERVICE', serviceId: A.main, quantity: 1, locationType: 'STUDIO', travel: { mode: 'MANUAL', amount: 0 } }] }],
    ];
    const bad: string[] = [];
    for (const [name, body] of bodies) {
      const r = await call(A.owner, 'post', `${A.o}/contracts`, body);
      if (r.status !== 400) bad.push(`${name} → ${r.status}`);
    }
    expect(bad).toEqual([]);
  });

  it('CHẶN: thêm dòng làm tổng vượt ngưỡng số nguyên an toàn → 400, hợp đồng giữ nguyên', async () => {
    const c = await ok(A.owner, 'post', `${A.o}/contracts`, {
      customerId: A.customer,
      lines: [{ kind: 'CUSTOM', name: 'Rất đắt', quantity: 1, unitPrice: Number.MAX_SAFE_INTEGER }],
    });
    const r = await call(A.owner, 'post', `${A.o}/contracts/${c.id}/lines`, { kind: 'CUSTOM', name: 'Thêm 1đ', quantity: 1, unitPrice: 1 });
    expect(r.status).toBe(400);
    const after = await ok(A.owner, 'get', `${A.o}/contracts/${c.id}`);
    expect(after.total).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('CHẶN: phí di chuyển 3 cách tính đúng từng đồng; xem trước = hợp đồng tạo từ cùng thân', async () => {
    const body = {
      customerId: A.customer,
      discount: 123_000,
      lines: [
        // Theo km: 3,33 km × 2 chiều = 6,66 km − 3 km miễn = 3,66 km × 5.000 = 18.300 → làm tròn lên 19.000
        { kind: 'PACKAGE', packageId: A.pkg, quantity: 1, locationType: 'CUSTOMER_HOME', address: 'Nhà cô dâu', travel: { mode: 'PER_KM', distanceKm: 3.33 }, addons: [{ serviceId: A.hair, quantity: 2 }] },
        { kind: 'SERVICE', serviceId: A.main, quantity: 2, locationType: 'OTHER', travel: { mode: 'FIXED' }, lineDiscount: 50_000 },
        { kind: 'SERVICE', serviceId: A.main, quantity: 1, locationType: 'OTHER', travel: { mode: 'MANUAL', amount: 0, note: 'Miễn phí' } },
        { kind: 'SURCHARGE', serviceId: A.early, quantity: 1, unitPrice: 250_000, note: 'Ca 4h sáng' },
        { kind: 'CUSTOM', name: 'Thuê váy', quantity: 1, unitPrice: 777_777 },
      ],
    };
    const q = await ok(A.owner, 'post', `${A.o}/contracts/quote`, body);
    const c = await ok(A.owner, 'post', `${A.o}/contracts`, body);
    // 3.000.000 + 600.000 + 19.000 + (1.600.000 − 50.000) + 150.000 + 800.000 + 0 + 250.000 + 777.777
    const expected = 3_000_000 + 600_000 + 19_000 + 1_550_000 + 150_000 + 800_000 + 0 + 250_000 + 777_777;
    expect(q.subtotal).toBe(expected);
    expect(c.subtotal).toBe(expected);
    expect(c.total).toBe(expected - 123_000);
    expect(q.total).toBe(c.total);
    expect(q.depositRequired).toBe(c.depositRequired);
    expect(c.depositRequired).toBe(1_000_000);
  });

  it('LỖI (nhẹ): dòng có địa chỉ nhà khách nhưng bỏ trống locationType → không bắt phí di chuyển', async () => {
    const r = await call(A.owner, 'post', `${A.o}/contracts`, {
      customerId: A.customer,
      lines: [{ kind: 'SERVICE', serviceId: A.main, quantity: 1, address: '12 Nguyễn Trãi, nhà khách' }],
    });
    expect(r.status).toBe(201);
    expect(r.body.lines.some((l: { kind: string }) => l.kind === 'TRAVEL')).toBe(false);
  });
});

describe('3. Trùng lịch', () => {
  const appt = (X: Org, s: string, e: string, extra: Record<string, unknown> = {}) => ({
    startsAt: s,
    endsAt: e,
    status: 'CONFIRMED',
    staff: [{ membershipId: X.artistMid, role: 'PRIMARY' }],
    ...extra,
  });

  it('CHẶN: trùng do thời gian di chuyển → 409; sát mép (hết bận đúng lúc bắt đầu) → được', async () => {
    slot++;
    await ok(A.owner, 'post', `${A.o}/appointments`, appt(A, day(2), day(4), { travelAfterMin: 60 }));
    const clash = await call(A.owner, 'post', `${A.o}/appointments`, appt(A, day(4, 30), day(5)));
    const clashBefore = await call(A.owner, 'post', `${A.o}/appointments`, appt(A, day(6), day(7), { travelBeforeMin: 61 }));
    const edge = await call(A.owner, 'post', `${A.o}/appointments`, appt(A, day(5), day(6)));
    expect([clash.status, clashBefore.status, edge.status]).toEqual([409, 409, 201]);
  });

  it('CHẶN: 8 yêu cầu tạo lịch cùng giờ cùng thợ gửi đồng thời → đúng 1 lịch', async () => {
    slot++;
    const rs = await Promise.all(Array.from({ length: 8 }, () => call(A.owner, 'post', `${A.o}/appointments`, appt(A, day(8), day(9)))));
    const codes = rs.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201).length).toBe(1);
    expect(codes.filter((c) => c === 409).length).toBe(7);
  });

  it('CHẶN: hai lịch khác nhau cùng bị dời vào một giờ đồng thời → một cái 409, không 500', async () => {
    slot++;
    const a1 = await ok(A.owner, 'post', `${A.o}/appointments`, appt(A, day(1), day(2)));
    const a2 = await ok(A.owner, 'post', `${A.o}/appointments`, appt(A, day(3), day(4)));
    const target = { startsAt: day(10), endsAt: day(11) };
    const [x, y] = await Promise.all([
      call(A.owner, 'patch', `${A.o}/appointments/${a1.id}`, target),
      call(A.owner, 'patch', `${A.o}/appointments/${a2.id}`, target),
    ]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
  });

  it('CHẶN: lịch nháp chồng giờ được lưu, nhưng xác nhận thì 409; huỷ xong giờ được giải phóng', async () => {
    slot++;
    const first = await ok(A.owner, 'post', `${A.o}/appointments`, appt(A, day(1), day(3)));
    const draft = await ok(A.owner, 'post', `${A.o}/appointments`, appt(A, day(2), day(4), { status: 'DRAFT' }));
    const confirm = await call(A.owner, 'post', `${A.o}/appointments/${draft.id}/status`, { to: 'CONFIRMED' });
    expect(confirm.status).toBe(409);
    await ok(A.owner, 'post', `${A.o}/appointments/${first.id}/status`, { to: 'CANCELLED', reason: 'Khách huỷ' });
    const again = await call(A.owner, 'post', `${A.o}/appointments/${draft.id}/status`, { to: 'CONFIRMED' });
    expect(again.status).toBe(200);
  });

  it('LỖI (nhẹ): thợ đã tắt "nhận lịch" (isBookable=false) vẫn bị xếp lịch bình thường', async () => {
    slot++;
    const u = await registerUser(app, 'l1-khong-nhan');
    const mid = await addMember(app, A.owner, A.orgId, u, ['artist']);
    await ok(A.owner, 'patch', `${A.o}/staff/${mid}`, { isBookable: false });
    const r = await call(A.owner, 'post', `${A.o}/appointments`, {
      startsAt: day(1), endsAt: day(2), status: 'CONFIRMED', staff: [{ membershipId: mid, role: 'PRIMARY' }],
    });
    expect(r.status).toBe(201);
  });

  it('GHI NHẬN: huỷ hợp đồng không huỷ lịch đã gắn — thợ vẫn bị giữ giờ', async () => {
    slot++;
    const c = await ok(A.owner, 'post', `${A.o}/contracts`, simpleContract(A));
    await ok(A.owner, 'post', `${A.o}/contracts/${c.id}/status`, { to: 'CONFIRMED' });
    const a = await ok(A.owner, 'post', `${A.o}/appointments`, appt(A, day(1), day(2), { contractId: c.id, contractLineId: c.lines[0].id }));
    await ok(A.owner, 'post', `${A.o}/contracts/${c.id}/status`, { to: 'CANCELLED', reason: 'Khách huỷ cưới' });
    const after = await ok(A.owner, 'get', `${A.o}/appointments/${a.id}`);
    expect(after.status).toBe('CONFIRMED');
    const other = await call(A.owner, 'post', `${A.o}/appointments`, appt(A, day(1), day(2)));
    expect(other.status).toBe(409);
  });
});

describe('4. Sửa hợp đồng sau khi xác nhận', () => {
  it('CHẶN: mọi đường API đổi tiền/điều khoản của hợp đồng đã xác nhận đều bị chặn, trừ thêm dòng / huỷ dòng có lý do', async () => {
    const c = await ok(A.owner, 'post', `${A.o}/contracts`, simpleContract(A));
    await ok(A.owner, 'post', `${A.o}/contracts/${c.id}/status`, { to: 'CONFIRMED' });
    const p = `${A.o}/contracts/${c.id}`;
    const rs = [
      await call(A.owner, 'patch', p, { discount: 1 }),
      await call(A.owner, 'patch', p, { depositRequired: 0 }),
      await call(A.owner, 'patch', p, { terms: 'mới' }),
      await call(A.owner, 'patch', p, { eventDate: '2027-05-01T00:00:00+07:00' }),
      await call(A.owner, 'patch', p, { lines: [{ kind: 'CUSTOM', name: 'X', quantity: 1, unitPrice: 1 }] }),
      await call(A.owner, 'post', `${p}/status`, { to: 'DRAFT' }),
      await call(A.owner, 'post', `${p}/lines/${c.lines[0].id}/void`, {}),
      await call(A.owner, 'patch', p, { notes: 'ghi chú', subtotal: 0 }),
    ];
    expect(rs.map((r) => r.status)).toEqual([409, 409, 409, 409, 409, 409, 400, 400]);
    const notes = await call(A.owner, 'patch', p, { notes: 'ghi chú được sửa' });
    expect(notes.status).toBe(200);
    const added = await call(A.owner, 'post', `${p}/lines`, { kind: 'CUSTOM', name: 'Phát sinh', quantity: 1, unitPrice: 100_000 });
    expect(added.status).toBe(201);
    expect(added.body.total).toBe(900_000);
  });

  it('LỖI (nhẹ, lớp database): đổi thẳng trạng thái về DRAFT thì khoá dòng hết tác dụng; tổng tiền hợp đồng đã xác nhận sửa thẳng được', async () => {
    const c = await ok(A.owner, 'post', `${A.o}/contracts`, simpleContract(A));
    await ok(A.owner, 'post', `${A.o}/contracts/${c.id}/status`, { to: 'CONFIRMED' });
    // Đổi tổng (vẫn đúng công thức total = subtotal − discount) trên hợp đồng ĐÃ XÁC NHẬN: database cho qua.
    await deps.db.$executeRaw`UPDATE contracts SET subtotal = 1, total = 1, deposit_required = 0 WHERE id = ${c.id}::uuid`;
    // Hạ trạng thái về nháp rồi sửa giá dòng: database cho qua.
    await deps.db.$executeRaw`UPDATE contracts SET status = 'DRAFT' WHERE id = ${c.id}::uuid`;
    await deps.db.$executeRaw`UPDATE contract_lines SET unit_price = 1, line_total = 1 WHERE contract_id = ${c.id}::uuid`;
    await deps.db.$executeRaw`UPDATE contracts SET status = 'CONFIRMED' WHERE id = ${c.id}::uuid`;
    const after = await ok(A.owner, 'get', `${A.o}/contracts/${c.id}`);
    expect(after.status).toBe('CONFIRMED');
    expect(after.total).toBe(1);
    expect(after.lines[0].unitPrice).toBe(1);
  });
});

describe('5. Chống gửi trùng (Idempotency-Key)', () => {
  it('CHẶN: cùng khoá, cùng thân gửi đồng thời → đúng một dòng phát sinh', async () => {
    const c = await ok(A.owner, 'post', `${A.o}/contracts`, simpleContract(A));
    const key = idem();
    const body = { kind: 'CUSTOM', name: 'Phát sinh', quantity: 1, unitPrice: 1000 };
    const rs = await Promise.all(Array.from({ length: 5 }, () => call(A.owner, 'post', `${A.o}/contracts/${c.id}/lines`, body, key)));
    const after = await ok(A.owner, 'get', `${A.o}/contracts/${c.id}`);
    expect(after.lines.filter((l: { name: string }) => l.name === 'Phát sinh').length).toBe(1);
    expect(rs.every((r) => r.status === 201 || r.status === 409)).toBe(true);
  });

  it('LỖI: cùng khoá + cùng thân nhưng KHÁC hợp đồng → trả 201 với kết quả của hợp đồng đầu, hợp đồng thứ hai không được thêm dòng', async () => {
    const c1 = await ok(A.owner, 'post', `${A.o}/contracts`, simpleContract(A));
    const c2 = await ok(A.owner, 'post', `${A.o}/contracts`, simpleContract(A));
    const key = idem();
    const body = { kind: 'CUSTOM', name: 'Phát sinh trang điểm thêm', quantity: 1, unitPrice: 500_000 };
    const r1 = await call(A.owner, 'post', `${A.o}/contracts/${c1.id}/lines`, body, key);
    const r2 = await call(A.owner, 'post', `${A.o}/contracts/${c2.id}/lines`, body, key);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(r2.body.id).toBe(c1.id); // trả nhầm hợp đồng
    const after2 = await ok(A.owner, 'get', `${A.o}/contracts/${c2.id}`);
    expect(after2.total).toBe(800_000); // dòng 500.000 không được thêm
  });

  it('LỖI: cùng khoá + cùng giá nhưng KHÁC dịch vụ → dịch vụ thứ hai không được đổi giá mà vẫn báo 201', async () => {
    const key = idem();
    const r1 = await call(A.owner, 'post', `${A.o}/services/${A.hair}/prices`, { listPrice: 999_000 }, key);
    const r2 = await call(A.owner, 'post', `${A.o}/services/${A.nail}/prices`, { listPrice: 999_000 }, key);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    const nail = await ok(A.owner, 'get', `${A.o}/services/${A.nail}`);
    expect(nail.currentPrice.listPrice).toBe(150_000);
  });
});

describe('6. Quyền theo vai trò mẫu', () => {
  it('LỖI: Quản lý (không có quyền tiền công) tự nâng bậc lương của CHÍNH mình', async () => {
    const r = await call(A.manager, 'patch', `${A.o}/staff/${A.managerMid}`, { tierId: A.tierHigh });
    expect(r.status).toBe(200);
    expect(r.body.tier.id).toBe(A.tierHigh);
    const pay = await call(A.manager, 'get', `${A.o}/packages/${A.pkg}/pay-rates`);
    expect(pay.status).toBe(403); // không được xem tiền công, nhưng đổi được bậc của mình
  });

  it('LỖI: Quản lý đổi bậc lương, tắt "nhận lịch" của Chủ tài khoản (không có luật thứ bậc ở hồ sơ thợ)', async () => {
    const r = await call(A.manager, 'patch', `${A.o}/staff/${A.ownerMid}`, { tierId: A.tierLow, isBookable: false, displayName: 'Bị đổi tên' });
    expect(r.status).toBe(200);
    expect(r.body.isBookable).toBe(false);
  });

  it('CHẶN: Thợ makeup chỉ thấy lịch mình; không xem hợp đồng, khách, tiền công; không sửa lịch', async () => {
    slot++;
    const mine = await ok(A.owner, 'post', `${A.o}/appointments`, { startsAt: day(1), endsAt: day(2), staff: [{ membershipId: A.artistMid }] });
    const other = await ok(A.owner, 'post', `${A.o}/appointments`, { startsAt: day(1), endsAt: day(2), staff: [{ membershipId: A.receptionistMid }] });
    const list = await ok(A.artist, 'get', `${A.o}/appointments`, { from: day(0), to: day(23) });
    expect(list.items.map((x: { id: string }) => x.id)).toEqual([mine.id]);
    const rs = [
      await call(A.artist, 'get', `${A.o}/appointments/${other.id}`),
      await call(A.artist, 'get', `${A.o}/appointments`, { from: day(0), to: day(23), membershipId: A.receptionistMid }),
      await call(A.artist, 'get', `${A.o}/contracts`),
      await call(A.artist, 'get', `${A.o}/customers`),
      await call(A.artist, 'get', `${A.o}/packages/${A.pkg}/pay-rates`),
      await call(A.artist, 'patch', `${A.o}/appointments/${mine.id}`, { notes: 'x' }),
      await call(A.artist, 'post', `${A.o}/contracts/quote`, simpleContract(A)),
    ];
    expect(rs.map((r) => r.status)).toEqual([404, 403, 403, 403, 403, 403, 403]);
  });

  it('CHẶN: Lễ tân lập hợp đồng được nhưng không đổi giá, không đặt phí di chuyển, không đặt tiền công', async () => {
    const c = await call(A.receptionist, 'post', `${A.o}/contracts`, simpleContract(A));
    const rs = [
      await call(A.receptionist, 'post', `${A.o}/services/${A.main}/prices`, { listPrice: 1 }),
      await call(A.receptionist, 'put', `${A.o}/travel-fee-policy`, { defaultMode: 'FIXED', fixedAmount: 0, perKmAmount: 0, freeKm: 0, minimumAmount: 0, roundTrip: false }),
      await call(A.receptionist, 'put', `${A.o}/packages/${A.pkg}/pay-rates`, { rates: [{ tierId: A.tierLow, amount: 1 }] }),
      await call(A.receptionist, 'patch', `${A.o}/staff/${A.receptionistMid}`, { tierId: A.tierHigh }),
    ];
    expect([c.status, ...rs.map((r) => r.status)]).toEqual([201, 403, 403, 403, 403]);
  });

  it('GHI NHẬN: Lễ tân (không có quyền đổi giá) vẫn hạ hợp đồng về 0 đ bằng giảm giá dòng + giảm giá hợp đồng, và huỷ dòng của hợp đồng đã xác nhận', async () => {
    const c = await call(A.receptionist, 'post', `${A.o}/contracts`, {
      customerId: A.customer,
      discount: 0,
      lines: [{ kind: 'PACKAGE', packageId: A.pkg, quantity: 1, lineDiscount: 3_000_000 }],
    });
    expect(c.status).toBe(201);
    expect(c.body.total).toBe(0);
    const c2 = await ok(A.owner, 'post', `${A.o}/contracts`, simpleContract(A));
    await ok(A.owner, 'post', `${A.o}/contracts/${c2.id}/status`, { to: 'CONFIRMED' });
    const v = await call(A.receptionist, 'post', `${A.o}/contracts/${c2.id}/lines/${c2.lines[0].id}/void`, { reason: 'Lễ tân huỷ' });
    expect(v.status).toBe(200);
    expect(v.body.total).toBe(0);
  });

  it('GHI NHẬN: Kế toán đặt được tiền công (payroll.write) trong khi docs/PRD.md ghi "Kế toán: chỉ xem"', async () => {
    const r = await call(A.accountant, 'put', `${A.o}/packages/${A.pkg}/pay-rates`, { rates: [{ tierId: A.tierLow, amount: 200_000 }] });
    expect(r.status).toBe(200);
    const c = await call(A.accountant, 'post', `${A.o}/contracts`, simpleContract(A));
    expect(c.status).toBe(403);
  });
});

describe('7. Tiền công theo bậc', () => {
  it('CHẶN: đặt, sửa, xoá mức; số lẻ/âm/chuỗi → 400; bậc đang ẩn → 400; thợ hiện dưới bậc', async () => {
    const t = (await ok(A.owner, 'post', `${A.o}/staff-tiers`, { name: `Bậc thử ${randomUUID().slice(0, 4)}` })).id;
    await ok(A.owner, 'patch', `${A.o}/staff/${A.artistMid}`, { tierId: t });
    const p = `${A.o}/services/${A.main}/pay-rates`;
    const set = await ok(A.owner, 'put', p, { rates: [{ tierId: t, amount: 350_000 }] });
    const row = set.items.find((i: { tier: { id: string } }) => i.tier.id === t);
    expect(row.amount).toBe(350_000);
    expect(row.staff.map((s: { membershipId: string }) => s.membershipId)).toContain(A.artistMid);
    const bad = [
      await call(A.owner, 'put', p, { rates: [{ tierId: t, amount: 1.5 }] }),
      await call(A.owner, 'put', p, { rates: [{ tierId: t, amount: -1 }] }),
      await call(A.owner, 'put', p, { rates: [{ tierId: t, amount: '1' }] }),
      await call(A.owner, 'put', p, { rates: [{ tierId: t, amount: 1 }, { tierId: t, amount: 2 }] }),
    ];
    expect(bad.map((r) => r.status)).toEqual([400, 400, 400, 400]);
    const del = await ok(A.owner, 'put', p, { rates: [{ tierId: t, amount: null }] });
    expect(del.items.find((i: { tier: { id: string } }) => i.tier.id === t).amount).toBeNull();
    // Ẩn bậc còn thợ → 409; chuyển thợ đi rồi ẩn → đặt tiền công cho bậc ẩn → 400
    expect((await call(A.owner, 'patch', `${A.o}/staff-tiers/${t}`, { isActive: false })).status).toBe(409);
    await ok(A.owner, 'patch', `${A.o}/staff/${A.artistMid}`, { tierId: null });
    await ok(A.owner, 'patch', `${A.o}/staff-tiers/${t}`, { isActive: false });
    expect((await call(A.owner, 'put', p, { rates: [{ tierId: t, amount: 1 }] })).status).toBe(400);
  });
});

describe('8. Dữ liệu xấu ở tham số truy vấn', () => {
  it('CHẶN: ký tự rỗng trong ô tìm kiếm → 400, không 500', async () => {
    const r1 = await call(A.owner, 'get', `${A.o}/customers?q=a%00b`);
    const r2 = await call(A.owner, 'get', `${A.o}/contracts?q=a%00b`);
    const r3 = await call(A.owner, 'get', `${A.o}/staff?q=a%00b`);
    expect([r1.status, r2.status, r3.status].every((s) => s === 400 || s === 200)).toBe(true);
    expect([r1.status, r2.status, r3.status]).not.toContain(500);
  });
});
