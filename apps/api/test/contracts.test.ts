// Module HỢP ĐỒNG: tính tiền, chốt giá, phí di chuyển, vòng đời, chống gửi trùng, cách ly tổ chức, quyền.
// Dịch vụ/gói/giá/studio tạo thẳng bằng deps.db vì module bảng giá đang làm song song.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;

afterAll(async () => {
  await deps.db.$disconnect();
});

interface Catalog {
  orgId: string;
  owner: TestUser;
  bridePkg: string;
  motherPkg: string;
  fullPkg: string;
  party: string;
  noPrice: string;
  hair: string;
  nail: string;
  lens: string;
  early: string;
  bride: string;
  mother: string;
  bridesmaid: string;
  guest: string;
  studio: string;
}

const idem = () => `k-${randomUUID()}`;

async function seed(label: string): Promise<Catalog> {
  const owner = await registerUser(app, `hd-chu-${label}`);
  const orgId = await createOrg(app, owner, `hd-${label}`);
  const db = deps.db;
  const price = (ref: { serviceId: string } | { packageId: string }, listPrice: bigint, salePrice: bigint | null = null) =>
    db.priceVersion.create({
      data: { organizationId: orgId, ...ref, listPrice, salePrice, effectiveFrom: new Date(Date.now() - 60_000), createdById: owner.id },
    });
  const svc = async (code: string, name: string, kind: 'MAIN' | 'ADDON' | 'SURCHARGE', p: bigint | null) => {
    const s = await db.service.create({ data: { organizationId: orgId, code, name, kind, durationMinutes: 60 } });
    if (p !== null) await price({ serviceId: s.id }, p);
    return s.id;
  };
  const subjects = await db.makeupSubject.findMany({ where: { organizationId: orgId } });
  const subject = (name: string) => {
    const s = subjects.find((x) => x.name === name);
    if (!s) throw new Error(`Thiếu nhân vật mặc định ${name}`);
    return s.id;
  };
  const bride = subject('Cô dâu');
  const party = await svc('MK-TIEC', 'Makeup tiệc', 'MAIN', 800_000n);
  const noPrice = await svc('MK-CHUAGIA', 'Makeup chưa có giá', 'MAIN', null);
  const hair = await svc('TOC', 'Làm tóc', 'ADDON', 300_000n);
  const nail = await svc('NAIL', 'Nail', 'ADDON', 150_000n);
  const lens = await svc('LENS', 'Lens', 'ADDON', 100_000n);
  const early = await svc('CA-SOM', 'Ca sớm trước 5h', 'SURCHARGE', 200_000n);
  const pkg = async (code: string, name: string, data: { subjectId?: string; locationTypes?: ('STUDIO' | 'CUSTOMER_HOME' | 'OTHER')[]; deposit: bigint }) =>
    db.servicePackage.create({
      data: {
        organizationId: orgId,
        code,
        name,
        durationMinutes: 120,
        depositAmount: data.deposit,
        subjectId: data.subjectId ?? null,
        locationTypes: data.locationTypes ?? [],
      },
    });
  const bridePkg = await pkg('CO-DAU', 'Gói cô dâu', { subjectId: bride, deposit: 1_000_000n });
  await price({ packageId: bridePkg.id }, 3_500_000n, 3_000_000n);
  const motherPkg = await pkg('ME', 'Gói makeup mẹ', { locationTypes: ['STUDIO', 'CUSTOMER_HOME'], deposit: 300_000n });
  await price({ packageId: motherPkg.id }, 1_200_000n);
  const fullPkg = await pkg('TRON-GOI', 'Gói cô dâu trọn gói', { subjectId: bride, deposit: 0n });
  await price({ packageId: fullPkg.id }, 5_000_000n);
  await db.packageItem.createMany({
    data: [
      { organizationId: orgId, packageId: fullPkg.id, serviceId: hair, isOptional: false },
      { organizationId: orgId, packageId: fullPkg.id, serviceId: nail, isOptional: true },
    ],
  });
  const studio = await db.studioLocation.create({
    data: { organizationId: orgId, name: 'Studio Quận 1', address: '1 Lê Lợi, Q1', isDefault: true },
  });
  await db.travelFeePolicy.update({
    where: { organizationId: orgId },
    data: { defaultMode: 'PER_KM', fixedAmount: 150_000n, perKmAmount: 5_000n, freeKm: 3, minimumAmount: 50_000n, roundTrip: true },
  });
  return {
    orgId,
    owner,
    bridePkg: bridePkg.id,
    motherPkg: motherPkg.id,
    fullPkg: fullPkg.id,
    party,
    noPrice,
    hair,
    nail,
    lens,
    early,
    bride,
    mother: subject('Mẹ cô dâu'),
    bridesmaid: subject('Phù dâu'),
    guest: subject('Khách mời'),
    studio: studio.id,
  };
}

let A: Catalog;
let B: Catalog;
let customerA: string;
let customerB: string;

async function newCustomer(orgId: string, fullName: string, phone: string) {
  const c = await deps.db.customer.create({ data: { organizationId: orgId, fullName, phone } });
  return c.id;
}

beforeAll(async () => {
  app = makeApp(deps);
  A = await seed('a');
  B = await seed('b');
  customerA = await newCustomer(A.orgId, 'Nguyễn Thị Hoa', '0912345678');
  customerB = await newCustomer(B.orgId, 'Trần Văn Bê', '0987654321');
});

const url = (orgId: string, rest = '') => `/api/v1/orgs/${orgId}/contracts${rest}`;

function create(u: TestUser, orgId: string, body: object, key = idem()) {
  return request(app).post(url(orgId)).set(bearer(u)).set('idempotency-key', key).send(body);
}

function quote(u: TestUser, orgId: string, body: object) {
  return request(app).post(url(orgId, '/quote')).set(bearer(u)).send(body);
}

function bigBody() {
  return {
    customerId: customerA,
    eventDate: '2026-12-20T00:00:00+07:00',
    notes: 'Đám cưới nhà hàng Riverside',
    discount: 200_000,
    lines: [
      {
        kind: 'PACKAGE',
        packageId: A.bridePkg,
        quantity: 1,
        locationType: 'CUSTOMER_HOME',
        address: '12 Nguyễn Huệ, Q1',
        latitude: 10.776889,
        longitude: 106.700806,
        scheduledStart: '2026-12-20T04:00:00+07:00',
        scheduledEnd: '2026-12-20T07:00:00+07:00',
        addons: [{ serviceId: A.lens, quantity: 1 }],
        travel: { mode: 'PER_KM', distanceKm: 12.35 },
      },
      {
        kind: 'PACKAGE',
        packageId: A.motherPkg,
        subjectId: A.mother,
        quantity: 2,
        locationType: 'STUDIO',
        lineDiscount: 100_000,
        addons: [
          { serviceId: A.hair, quantity: 2 },
          { serviceId: A.nail, quantity: 2 },
        ],
      },
      { kind: 'SERVICE', serviceId: A.party, subjectId: A.bridesmaid, quantity: 3, locationType: 'OTHER', travel: { mode: 'FIXED' } },
      {
        kind: 'SERVICE',
        serviceId: A.party,
        subjectId: A.guest,
        quantity: 1,
        locationType: 'CUSTOMER_HOME',
        travel: { mode: 'MANUAL', amount: 0, note: 'Nhà gần, miễn phí' },
      },
      { kind: 'SURCHARGE', serviceId: A.early, quantity: 1 },
      { kind: 'SURCHARGE', serviceId: A.early, quantity: 1, unitPrice: 250_000, note: 'Ca 4h sáng' },
      { kind: 'CUSTOM', name: 'Phí giữ váy qua đêm', unitPrice: 120_000, quantity: 1 },
    ],
  };
}

interface Line {
  id: string | null;
  kind: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineDiscount: number;
  lineTotal: number;
  priceVersionId: string | null;
  subjectName: string | null;
  studioLocationId: string | null;
  travelMode: string | null;
  distanceKm: number | null;
  perKmAmount: number | null;
  addedAfterConfirm: boolean;
  voidedAt: string | null;
  addons: Line[];
  travel: Line | null;
}

function stripIds(lines: Line[]): unknown {
  const one = (l: Line): unknown => {
    const { id: _id, addons, travel, ...rest } = l;
    return { ...rest, addons: addons?.map(one), travel: travel ? one(travel) : null };
  };
  return lines.map((l) => one(l as Line));
}

async function contractCount(orgId: string) {
  return deps.db.contract.count({ where: { organizationId: orgId } });
}

describe('lập hợp đồng nhiều gói, nhiều nhân vật, dịch vụ phụ, phụ phí, phí di chuyển', () => {
  it('tính đúng từng dòng và tổng; xem trước khớp từng đồng với hợp đồng tạo ra từ cùng body', async () => {
    const before = await contractCount(A.orgId);
    const q = await quote(A.owner, A.orgId, bigBody()).expect(200);
    expect(await contractCount(A.orgId)).toBe(before);

    const res = await create(A.owner, A.orgId, bigBody()).expect(201);
    const c = res.body;
    expect(c.code).toMatch(/^HD-\d{6}$/);
    expect(c.status).toBe('DRAFT');

    const [bride, mother, maids, guest, early, earlyOverride, custom] = c.lines as Line[];
    // Gói cô dâu: giá khuyến mại 3.000.000, nhân vật lấy từ gói; khứ hồi 12,35×2 − 3 = 21,7 km × 5.000 = 108.500 → 109.000
    expect(bride).toMatchObject({ kind: 'PACKAGE', unitPrice: 3_000_000, lineTotal: 3_000_000, subjectName: 'Cô dâu' });
    expect(bride!.addons.map((a) => [a.name, a.lineTotal])).toEqual([['Lens', 100_000]]);
    expect(bride!.travel).toMatchObject({ kind: 'TRAVEL', travelMode: 'PER_KM', distanceKm: 12.35, perKmAmount: 5_000, lineTotal: 109_000 });
    // Gói mẹ ×2 − giảm 100.000; tại studio mặc định; tóc ×2, nail ×2
    expect(mother).toMatchObject({ unitPrice: 1_200_000, quantity: 2, lineDiscount: 100_000, lineTotal: 2_300_000, subjectName: 'Mẹ cô dâu' });
    expect(mother!.studioLocationId).toBe(A.studio);
    expect(mother!.travel).toBeNull();
    expect(mother!.addons.map((a) => [a.name, a.quantity, a.lineTotal])).toEqual([
      ['Làm tóc', 2, 600_000],
      ['Nail', 2, 300_000],
    ]);
    expect(maids).toMatchObject({ kind: 'SERVICE', lineTotal: 2_400_000, subjectName: 'Phù dâu' });
    expect(maids!.travel).toMatchObject({ travelMode: 'FIXED', lineTotal: 150_000 });
    expect(guest!.travel).toMatchObject({ travelMode: 'MANUAL', lineTotal: 0 });
    expect(early).toMatchObject({ kind: 'SURCHARGE', unitPrice: 200_000 });
    expect(early!.priceVersionId).not.toBeNull();
    expect(earlyOverride).toMatchObject({ kind: 'SURCHARGE', unitPrice: 250_000, priceVersionId: null });
    expect(custom).toMatchObject({ kind: 'CUSTOM', name: 'Phí giữ váy qua đêm', lineTotal: 120_000, priceVersionId: null });

    expect(c.subtotal).toBe(10_329_000);
    expect(c.discount).toBe(200_000);
    expect(c.total).toBe(10_129_000);
    expect(c.travelTotal).toBe(259_000);
    // Cọc gợi ý = 1.000.000 (cô dâu) + 300.000 × 2 (mẹ)
    expect(c.depositRequired).toBe(1_600_000);
    expect(c.customer).toMatchObject({ id: customerA, fullName: 'Nguyễn Thị Hoa' });

    // Xem trước = hợp đồng, từng dòng, từng đồng.
    expect(q.body).toMatchObject({ subtotal: c.subtotal, discount: c.discount, total: c.total, travelTotal: c.travelTotal });
    expect(q.body.depositRequired).toBe(c.depositRequired);
    expect(stripIds(q.body.lines)).toEqual(stripIds(c.lines));

    // Database giữ đúng số dòng và tiền là BigInt khớp tổng.
    const rows = await deps.db.contractLine.findMany({ where: { contractId: c.id } });
    // 7 dòng gốc + 3 dịch vụ phụ + 3 phí di chuyển
    expect(rows).toHaveLength(13);
    expect(rows.reduce((s, r) => s + r.lineTotal, 0n)).toBe(10_329_000n);
  });

  it('đổi bảng giá sau khi tạo → hợp đồng giữ nguyên giá đã chốt', async () => {
    const body = { customerId: customerA, lines: [{ kind: 'PACKAGE', packageId: A.bridePkg, quantity: 1, locationType: 'STUDIO' }] };
    const c = (await create(A.owner, A.orgId, body).expect(201)).body;
    const oldVersion = c.lines[0].priceVersionId as string;
    await deps.db.priceVersion.create({
      data: { organizationId: A.orgId, packageId: A.bridePkg, listPrice: 4_000_000n, effectiveFrom: new Date(), createdById: A.owner.id },
    });
    const after = (await request(app).get(url(A.orgId, `/${c.id}`)).set(bearer(A.owner)).expect(200)).body;
    expect(after.lines[0]).toMatchObject({ unitPrice: 3_000_000, priceVersionId: oldVersion });
    expect(after.total).toBe(3_000_000);
    const q = (await quote(A.owner, A.orgId, body).expect(200)).body;
    expect(q.lines[0].unitPrice).toBe(4_000_000);
    // Trả giá về như cũ cho các bài sau.
    await deps.db.priceVersion.create({
      data: { organizationId: A.orgId, packageId: A.bridePkg, listPrice: 3_500_000n, salePrice: 3_000_000n, effectiveFrom: new Date(), createdById: A.owner.id },
    });
  });

  it('khách mới tạo ngay trong hợp đồng, số điện thoại chuẩn hoá; số sai → 400', async () => {
    const lines = [{ kind: 'CUSTOM', name: 'Tư vấn', unitPrice: 0, quantity: 1 }];
    const c = (await create(A.owner, A.orgId, { newCustomer: { fullName: 'Lê Thị Mới', phone: '+84 903 111 222' }, lines }).expect(201)).body;
    expect(c.customer).toMatchObject({ fullName: 'Lê Thị Mới', phone: '0903111222' });
    const bad = await create(A.owner, A.orgId, { newCustomer: { fullName: 'X', phone: '12345' }, lines });
    expect(bad.status).toBe(400);
    const both = await create(A.owner, A.orgId, { customerId: customerA, newCustomer: { fullName: 'X' }, lines });
    expect(both.status).toBe(400);
  });
});

describe('luật kiểm khi lập hợp đồng', () => {
  const base = () => ({ customerId: customerA, lines: [] as unknown[] });
  const cases: [string, () => unknown[], RegExp][] = [
    [
      'tại nhà mà thiếu phí di chuyển',
      () => [{ kind: 'SERVICE', serviceId: A.party, quantity: 1, locationType: 'CUSTOMER_HOME' }],
      /phải có phí di chuyển/,
    ],
    [
      'địa điểm khác mà thiếu phí di chuyển',
      () => [{ kind: 'PACKAGE', packageId: A.bridePkg, quantity: 1, locationType: 'OTHER' }],
      /phải có phí di chuyển/,
    ],
    [
      'studio kèm phí di chuyển',
      () => [{ kind: 'SERVICE', serviceId: A.party, quantity: 1, locationType: 'STUDIO', travel: { mode: 'FIXED' } }],
      /tại studio không tính phí di chuyển/,
    ],
    [
      'dịch vụ chính đưa vào dịch vụ phụ',
      () => [{ kind: 'PACKAGE', packageId: A.bridePkg, quantity: 1, addons: [{ serviceId: A.party, quantity: 1 }] }],
      /Makeup tiệc.*dịch vụ chính.*chỉ nhận dịch vụ phụ/,
    ],
    [
      'phụ phí đưa vào dòng dịch vụ chính',
      () => [{ kind: 'SERVICE', serviceId: A.early, quantity: 1 }],
      /Ca sớm.*phụ phí/,
    ],
    [
      'nhân vật sai gói',
      () => [{ kind: 'PACKAGE', packageId: A.bridePkg, subjectId: A.mother, quantity: 1 }],
      /Gói cô dâu" chỉ dành cho nhân vật "Cô dâu"/,
    ],
    [
      'địa điểm ngoài danh sách gói cho phép',
      () => [{ kind: 'PACKAGE', packageId: A.motherPkg, quantity: 1, locationType: 'OTHER', travel: { mode: 'FIXED' } }],
      /không áp dụng địa điểm OTHER/,
    ],
    [
      'gói giới hạn địa điểm mà không chọn',
      () => [{ kind: 'PACKAGE', packageId: A.motherPkg, quantity: 1 }],
      /phải chọn locationType/,
    ],
    [
      'dịch vụ chưa có giá',
      () => [{ kind: 'SERVICE', serviceId: A.noPrice, quantity: 1 }],
      /Makeup chưa có giá" chưa có giá hiệu lực/,
    ],
    [
      'dịch vụ phụ đã có sẵn trong gói',
      () => [{ kind: 'PACKAGE', packageId: A.fullPkg, quantity: 1, addons: [{ serviceId: A.hair, quantity: 1 }] }],
      /Làm tóc" đã có sẵn trong gói/,
    ],
    [
      'giảm giá dòng vượt thành tiền',
      () => [{ kind: 'SERVICE', serviceId: A.party, quantity: 1, lineDiscount: 800_001 }],
      /Giảm giá dòng/,
    ],
    [
      'ghi đè giá phụ phí không có ghi chú',
      () => [{ kind: 'SURCHARGE', serviceId: A.early, quantity: 1, unitPrice: 1 }],
      /./,
    ],
    [
      'phí di chuyển theo km quá 2 chữ số thập phân',
      () => [{ kind: 'SERVICE', serviceId: A.party, quantity: 1, locationType: 'OTHER', travel: { mode: 'PER_KM', distanceKm: 3.333 } }],
      /2 chữ số thập phân/,
    ],
    [
      'theo km mà thiếu số km',
      () => [{ kind: 'SERVICE', serviceId: A.party, quantity: 1, locationType: 'OTHER', travel: { mode: 'PER_KM' } }],
      /phải có số km/,
    ],
    [
      'nhập tay mà thiếu số tiền',
      () => [{ kind: 'SERVICE', serviceId: A.party, quantity: 1, locationType: 'OTHER', travel: { mode: 'MANUAL' } }],
      /nhập 0/,
    ],
    [
      'tiền lẻ đồng',
      () => [{ kind: 'CUSTOM', name: 'Lẻ', unitPrice: 1000.5, quantity: 1 }],
      /./,
    ],
    ['không có dòng nào', () => [], /./],
    [
      'có địa chỉ mà bỏ trống loại địa điểm',
      () => [{ kind: 'SERVICE', serviceId: A.party, quantity: 1, address: '12 Nguyễn Trãi, nhà khách' }],
      /Chọn địa điểm cho dòng có địa chỉ/,
    ],
    [
      'có toạ độ mà bỏ trống loại địa điểm',
      () => [{ kind: 'PACKAGE', packageId: A.bridePkg, quantity: 1, latitude: 10.77, longitude: 106.7 }],
      /Chọn địa điểm cho dòng có địa chỉ/,
    ],
  ];

  for (const [name, lines, msg] of cases) {
    it(`${name} → 400, không tạo gì`, async () => {
      const before = await contractCount(A.orgId);
      const body = { ...base(), lines: lines() };
      const res = await create(A.owner, A.orgId, body);
      expect(res.status, JSON.stringify(res.body)).toBe(400);
      expect(res.body.error.message).toMatch(msg);
      const q = await quote(A.owner, A.orgId, body);
      expect(q.status).toBe(400);
      expect(await contractCount(A.orgId)).toBe(before);
    });
  }

  it('giảm giá hợp đồng vượt tổng → 400; cọc gửi tay vượt tổng → 400', async () => {
    const lines = [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }];
    const r1 = await create(A.owner, A.orgId, { customerId: customerA, discount: 800_001, lines });
    expect(r1.status).toBe(400);
    expect(r1.body.error.message).toMatch(/Giảm giá hợp đồng/);
    const r2 = await create(A.owner, A.orgId, { customerId: customerA, depositRequired: 800_001, lines });
    expect(r2.status).toBe(400);
    expect(r2.body.error.message).toMatch(/Tiền cọc/);
    const ok = await create(A.owner, A.orgId, { customerId: customerA, depositRequired: 800_000, lines }).expect(201);
    expect(ok.body.depositRequired).toBe(800_000);
  });

  it('cọc gợi ý không vượt tổng khi giảm giá lớn', async () => {
    const lines = [{ kind: 'PACKAGE', packageId: A.bridePkg, quantity: 1 }];
    const c = (await create(A.owner, A.orgId, { customerId: customerA, discount: 2_500_000, lines }).expect(201)).body;
    expect(c.total).toBe(500_000);
    expect(c.depositRequired).toBe(500_000);
  });

  it('dịch vụ/gói ngừng hoạt động, nhân vật ẩn → 400', async () => {
    const svc = await deps.db.service.create({
      data: { organizationId: A.orgId, code: `NGUNG-${randomUUID().slice(0, 4)}`, name: 'Dịch vụ ngừng', kind: 'MAIN', durationMinutes: 30, isActive: false },
    });
    const r = await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: svc.id, quantity: 1 }] });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/ngừng hoạt động/);
    const subj = await deps.db.makeupSubject.create({ data: { organizationId: A.orgId, name: `Ẩn ${randomUUID().slice(0, 4)}`, isActive: false } });
    const r2 = await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, subjectId: subj.id, quantity: 1 }] });
    expect(r2.status).toBe(400);
  });
});

describe('vòng đời hợp đồng', () => {
  it('nháp sửa được dòng; xác nhận rồi chỉ sửa ghi chú; phụ phí phát sinh; huỷ dòng cha kéo dòng con; cọc bị hạ', async () => {
    const body = {
      customerId: customerA,
      depositRequired: 3_500_000,
      lines: [
        { kind: 'PACKAGE', packageId: A.bridePkg, quantity: 1, locationType: 'STUDIO' },
        { kind: 'SERVICE', serviceId: A.party, quantity: 1 },
      ],
    };
    const c = (await create(A.owner, A.orgId, body).expect(201)).body;
    expect(c.total).toBe(3_800_000);
    const patch = (b: object) => request(app).patch(url(A.orgId, `/${c.id}`)).set(bearer(A.owner)).send(b);

    // Nháp: thay toàn bộ dòng + giảm giá
    const p1 = await patch({
      discount: 100_000,
      depositRequired: 3_500_000,
      lines: [...body.lines, { kind: 'CUSTOM', name: 'Phụ kiện', unitPrice: 50_000, quantity: 2 }],
    }).expect(200);
    expect(p1.body).toMatchObject({ subtotal: 3_900_000, discount: 100_000, total: 3_800_000, depositRequired: 3_500_000 });
    expect(p1.body.lines).toHaveLength(3);
    // Nháp: đổi giảm giá làm tổng thấp hơn cọc hiện tại mà không gửi cọc mới → 400
    expect((await patch({ discount: 500_000 })).status).toBe(400);

    const status = (to: string, reason?: string) =>
      request(app).post(url(A.orgId, `/${c.id}/status`)).set(bearer(A.owner)).send({ to, ...(reason ? { reason } : {}) });
    const conf = await status('CONFIRMED').expect(200);
    expect(conf.body.status).toBe('CONFIRMED');
    expect(conf.body.confirmedAt).not.toBeNull();

    // Sau xác nhận: sửa dòng/tiền → 409, sửa ghi chú → 200
    const p2 = await patch({ lines: body.lines });
    expect(p2.status).toBe(409);
    expect((await patch({ discount: 0 })).status).toBe(409);
    expect((await patch({ notes: 'Khách đổi giờ', discount: 0 })).status).toBe(409);
    expect((await patch({ notes: 'Khách đổi giờ' }).expect(200)).body.notes).toBe('Khách đổi giờ');

    // Phụ phí phát sinh sau xác nhận
    const addKey = idem();
    const addLine = (b: object, key = idem()) =>
      request(app).post(url(A.orgId, `/${c.id}/lines`)).set(bearer(A.owner)).set('idempotency-key', key).send(b);
    const a1 = await addLine({ kind: 'SURCHARGE', serviceId: A.early, quantity: 1 }, addKey).expect(201);
    expect(a1.body.total).toBe(4_000_000);
    const added = (a1.body.lines as Line[]).at(-1)!;
    expect(added).toMatchObject({ kind: 'SURCHARGE', addedAfterConfirm: true });
    // Gửi lại cùng khoá → không thêm dòng thứ hai
    const again = await addLine({ kind: 'SURCHARGE', serviceId: A.early, quantity: 1 }, addKey).expect(201);
    expect(again.body.lines).toHaveLength(a1.body.lines.length);

    // Thêm dịch vụ có dịch vụ phụ + phí di chuyển rồi huỷ dòng cha
    const a2 = await addLine({
      kind: 'SERVICE',
      serviceId: A.party,
      subjectId: A.bridesmaid,
      quantity: 1,
      locationType: 'CUSTOMER_HOME',
      addons: [{ serviceId: A.hair, quantity: 1 }],
      travel: { mode: 'MANUAL', amount: 70_000 },
    }).expect(201);
    expect(a2.body.total).toBe(4_000_000 + 800_000 + 300_000 + 70_000);
    const parent = (a2.body.lines as Line[]).at(-1)!;
    expect(parent.addedAfterConfirm).toBe(true);
    expect(parent.addons[0]!.addedAfterConfirm).toBe(true);
    expect(parent.travel!.addedAfterConfirm).toBe(true);

    const voidLine = (lineId: string, reason?: string) =>
      request(app)
        .post(url(A.orgId, `/${c.id}/lines/${lineId}/void`))
        .set(bearer(A.owner))
        .send(reason === undefined ? {} : { reason });
    expect((await voidLine(parent.id!)).status).toBe(400);
    const v1 = await voidLine(parent.id!, 'Phù dâu huỷ').expect(200);
    const vp = (v1.body.lines as Line[]).find((l) => l.id === parent.id)!;
    expect(vp.voidedAt).not.toBeNull();
    expect(vp.addons[0]!.voidedAt).not.toBeNull();
    expect(vp.travel!.voidedAt).not.toBeNull();
    expect(v1.body.total).toBe(4_000_000);
    expect(v1.body.adjustments).toEqual([]);
    // Không xoá: dòng vẫn còn trong database
    expect(await deps.db.contractLine.count({ where: { contractId: c.id, voidedAt: { not: null } } })).toBe(3);
    expect((await voidLine(parent.id!, 'lần hai')).status).toBe(409);

    // Huỷ gói cô dâu → tổng 1.000.000 < cọc 3.500.000 → cọc hạ bằng tổng, ghi nhật ký
    const brideLine = (v1.body.lines as Line[])[0]!;
    const v2 = await voidLine(brideLine.id!, 'Cô dâu đổi ekip').expect(200);
    expect(v2.body).toMatchObject({ subtotal: 1_100_000, discount: 100_000, total: 1_000_000, depositRequired: 1_000_000 });
    expect(v2.body.adjustments).toEqual([{ field: 'depositRequired', from: 3_500_000, to: 1_000_000 }]);
    const audit = await deps.db.auditLog.findFirst({
      where: { organizationId: A.orgId, entityId: c.id, action: 'contract.line_voided' },
      orderBy: { createdAt: 'desc' },
    });
    expect(JSON.stringify(audit?.data)).toContain('"depositRequired"');

    // Hoàn thành → mọi thay đổi bị chặn
    await status('COMPLETED').expect(200);
    expect((await patch({ notes: 'x' })).status).toBe(409);
    expect((await addLine({ kind: 'CUSTOM', name: 'x', unitPrice: 1, quantity: 1 })).status).toBe(409);
    expect((await voidLine(added.id!, 'x')).status).toBe(409);
    expect((await status('CANCELLED', 'muộn')).status).toBe(409);
  });

  it('huỷ hợp đồng bắt buộc lý do; xác nhận cần ít nhất một dòng còn hiệu lực', async () => {
    const c = (
      await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] }).expect(201)
    ).body;
    const status = (b: object) => request(app).post(url(A.orgId, `/${c.id}/status`)).set(bearer(A.owner)).send(b);
    expect((await status({ to: 'COMPLETED' })).status).toBe(409);
    await request(app)
      .post(url(A.orgId, `/${c.id}/lines/${c.lines[0].id}/void`))
      .set(bearer(A.owner))
      .send({ reason: 'Khách đổi ý' })
      .expect(200);
    const r = await status({ to: 'CONFIRMED' });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toMatch(/chưa có dòng nào còn hiệu lực/);
    expect((await status({ to: 'CANCELLED' })).status).toBe(400);
    const done = await status({ to: 'CANCELLED', reason: 'Khách huỷ cưới' }).expect(200);
    expect(done.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Khách huỷ cưới' });
  });

  it('nháp đã có lịch gắn vào dòng → không thay toàn bộ dòng được; xem hợp đồng thấy lịch', async () => {
    const c = (
      await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] }).expect(201)
    ).body;
    const appt = await deps.db.appointment.create({
      data: {
        organizationId: A.orgId,
        code: `LH-T${randomUUID().slice(0, 6)}`,
        customerId: customerA,
        startsAt: new Date('2026-12-20T01:00:00Z'),
        endsAt: new Date('2026-12-20T03:00:00Z'),
        contractId: c.id,
        contractLineId: c.lines[0].id,
        createdById: A.owner.id,
      },
    });
    const detail = (await request(app).get(url(A.orgId, `/${c.id}`)).set(bearer(A.owner)).expect(200)).body;
    expect(detail.appointments).toEqual([expect.objectContaining({ id: appt.id, code: appt.code, status: 'DRAFT' })]);
    const r = await request(app)
      .patch(url(A.orgId, `/${c.id}`))
      .set(bearer(A.owner))
      .send({ lines: [{ kind: 'CUSTOM', name: 'x', unitPrice: 1, quantity: 1 }] });
    expect(r.status).toBe(409);
  });
});

describe('huỷ hợp đồng kéo theo lịch đã gắn', () => {
  async function confirmedContract() {
    const c = (
      await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] }).expect(201)
    ).body;
    await request(app).post(url(A.orgId, `/${c.id}/status`)).set(bearer(A.owner)).send({ to: 'CONFIRMED' }).expect(200);
    return c as { id: string; lines: Line[] };
  }

  async function appointment(c: { id: string; lines: Line[] }, status: 'CONFIRMED' | 'COMPLETED' | 'IN_PROGRESS', startsAt: Date) {
    const m = await deps.db.membership.findFirstOrThrow({ where: { organizationId: A.orgId, userId: A.owner.id } });
    const endsAt = new Date(startsAt.getTime() + 2 * 3_600_000);
    const a = await deps.db.appointment.create({
      data: {
        organizationId: A.orgId,
        code: `LH-G${randomUUID().slice(0, 6)}`,
        customerId: customerA,
        startsAt,
        endsAt,
        status,
        contractId: c.id,
        contractLineId: c.lines[0]!.id,
        createdById: A.owner.id,
      },
    });
    // Khoảng bận do database tự tính lại từ lịch.
    await deps.db.appointmentStaff.create({
      data: { organizationId: A.orgId, appointmentId: a.id, membershipId: m.id, blockStart: startsAt, blockEnd: endsAt, isBlocking: true },
    });
    return { appt: a, membershipId: m.id, endsAt };
  }

  const cancel = (contractId: string) =>
    request(app).post(url(A.orgId, `/${contractId}/status`)).set(bearer(A.owner)).send({ to: 'CANCELLED', reason: 'Khách huỷ cưới' });

  const bookSameSlot = (membershipId: string, startsAt: Date, endsAt: Date) =>
    request(app)
      .post(`/api/v1/orgs/${A.orgId}/appointments`)
      .set(bearer(A.owner))
      .set('idempotency-key', idem())
      .send({
        customerId: customerA,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: 'CONFIRMED',
        staff: [{ membershipId, role: 'PRIMARY' }],
      });

  it('lịch đã xác nhận bị huỷ và thợ được nhả giờ; lịch đã hoàn thành giữ nguyên', async () => {
    const c = await confirmedContract();
    const slot = new Date('2027-03-01T01:00:00Z');
    const live = await appointment(c, 'CONFIRMED', slot);
    const done = await appointment(c, 'COMPLETED', new Date('2027-03-02T01:00:00Z'));
    // Trước khi huỷ: giờ của thợ đang bị giữ.
    expect((await bookSameSlot(live.membershipId, slot, live.endsAt)).status).toBe(409);

    const res = await cancel(c.id).expect(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancelledAppointments).toEqual([expect.objectContaining({ id: live.appt.id, status: 'CANCELLED' })]);
    const after = await deps.db.appointment.findMany({ where: { contractId: c.id }, select: { id: true, status: true, cancelReason: true } });
    expect(after.find((a) => a.id === live.appt.id)).toMatchObject({ status: 'CANCELLED', cancelReason: 'Khách huỷ cưới' });
    expect(after.find((a) => a.id === done.appt.id)?.status).toBe('COMPLETED');

    // Sau khi huỷ: đặt lịch mới đúng giờ đó cho đúng thợ đó được.
    const rebook = await bookSameSlot(live.membershipId, slot, live.endsAt);
    expect(rebook.status, JSON.stringify(rebook.body)).toBe(201);
  });

  it('còn lịch đang làm → 409, hợp đồng và lịch không đổi gì', async () => {
    const c = await confirmedContract();
    const busy = await appointment(c, 'IN_PROGRESS', new Date('2027-03-03T01:00:00Z'));
    const other = await appointment(c, 'CONFIRMED', new Date('2027-03-04T01:00:00Z'));
    const res = await cancel(c.id);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Còn lịch đang thực hiện: .*Đang làm/);
    expect((await deps.db.contract.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('CONFIRMED');
    expect((await deps.db.appointment.findUniqueOrThrow({ where: { id: busy.appt.id } })).status).toBe('IN_PROGRESS');
    expect((await deps.db.appointment.findUniqueOrThrow({ where: { id: other.appt.id } })).status).toBe('CONFIRMED');
  });
});

describe('thợ phụ trách, cảnh báo trùng giờ, lên lịch khi xác nhận', () => {
  let m1: string;
  let m2: string;
  const at = (iso: string) => new Date(iso).toISOString();

  beforeAll(async () => {
    m1 = await addMember(app, A.owner, A.orgId, await registerUser(app, 'hd-tho-1'), ['artist']);
    m2 = await addMember(app, A.owner, A.orgId, await registerUser(app, 'hd-tho-2'), ['artist']);
  });

  const staffLine = (start: string | null, end: string | null, staff: { membershipId: string; role: string }[], extra: object = {}) => ({
    kind: 'SERVICE',
    serviceId: A.party,
    subjectId: A.bridesmaid,
    quantity: 1,
    locationType: 'STUDIO',
    ...(start ? { scheduledStart: start } : {}),
    ...(end ? { scheduledEnd: end } : {}),
    staff,
    ...extra,
  });

  const book = (membershipId: string, startsAt: string, endsAt: string) =>
    request(app)
      .post(`/api/v1/orgs/${A.orgId}/appointments`)
      .set(bearer(A.owner))
      .set('idempotency-key', idem())
      .send({ customerId: customerA, startsAt: at(startsAt), endsAt: at(endsAt), status: 'CONFIRMED', staff: [{ membershipId, role: 'PRIMARY' }] })
      .expect(201);

  const confirm = (id: string) => request(app).post(url(A.orgId, `/${id}/status`)).set(bearer(A.owner)).send({ to: 'CONFIRMED' });

  it('gán thợ chính + thợ phụ cho dòng; xem hợp đồng trả thợ kèm tên hiển thị, chữ viết tắt, bậc', async () => {
    const c = (
      await create(A.owner, A.orgId, {
        customerId: customerA,
        lines: [staffLine('2027-05-01T01:00:00Z', '2027-05-01T03:00:00Z', [{ membershipId: m2, role: 'ASSIST' }, { membershipId: m1, role: 'PRIMARY' }])],
      }).expect(201)
    ).body;
    const staff = c.lines[0].staff as { membershipId: string; role: string; displayName: string; initials: string; avatarUrl: null; tier: null }[];
    expect(staff.map((x) => [x.membershipId, x.role])).toEqual([
      [m1, 'PRIMARY'],
      [m2, 'ASSIST'],
    ]);
    expect(staff[0]).toMatchObject({ displayName: expect.stringContaining('hd-tho-1'), avatarUrl: null, tier: null });
    expect(staff[0]!.initials.length).toBeGreaterThan(0);
    expect(await deps.db.contractLineStaff.count({ where: { lineId: c.lines[0].id } })).toBe(2);
    const detail = (await request(app).get(url(A.orgId, `/${c.id}`)).set(bearer(A.owner)).expect(200)).body;
    expect(detail.lines[0].staff).toEqual(c.lines[0].staff);
  });

  it('thợ sai → 400: thiếu giờ, thợ tổ chức khác, mã bịa, hai thợ chính, quá số thợ, thợ tắt nhận lịch', async () => {
    const outsider = await deps.db.membership.findFirstOrThrow({ where: { organizationId: B.orgId } });
    const off = await addMember(app, A.owner, A.orgId, await registerUser(app, 'hd-tho-nghi'), ['artist']);
    await deps.db.staffProfile.create({ data: { organizationId: A.orgId, membershipId: off, isBookable: false } });
    const s = '2027-05-02T01:00:00Z';
    const e = '2027-05-02T03:00:00Z';
    const cases: [string, object, RegExp][] = [
      ['thiếu giờ', staffLine(null, null, [{ membershipId: m1, role: 'PRIMARY' }]), /phải có giờ bắt đầu và giờ kết thúc/],
      ['thợ tổ chức khác', staffLine(s, e, [{ membershipId: outsider.id, role: 'PRIMARY' }]), /không thuộc tổ chức/],
      ['mã bịa', staffLine(s, e, [{ membershipId: randomUUID(), role: 'PRIMARY' }]), /không thuộc tổ chức/],
      ['hai thợ chính', staffLine(s, e, [{ membershipId: m1, role: 'PRIMARY' }, { membershipId: m2, role: 'PRIMARY' }]), /tối đa một thợ chính/],
      [
        'quá số thợ (dịch vụ lẻ: 1 + 3)',
        staffLine(s, e, [m1, m2, off, A.studio, randomUUID()].map((membershipId) => ({ membershipId, role: 'ASSIST' }))),
        /tối đa 4 thợ/,
      ],
      ['thợ tắt nhận lịch', staffLine(s, e, [{ membershipId: off, role: 'PRIMARY' }]), /tắt nhận lịch/],
    ];
    const before = await contractCount(A.orgId);
    for (const [name, line, msg] of cases) {
      const body = { customerId: customerA, lines: [line] };
      const r = await create(A.owner, A.orgId, body);
      expect(r.status, `${name}: ${JSON.stringify(r.body)}`).toBe(400);
      expect(r.body.error.message, name).toMatch(msg);
      expect((await quote(A.owner, A.orgId, body)).status, name).toBe(400);
    }
    expect(await contractCount(A.orgId)).toBe(before);
  });

  it('xem trước cảnh báo OVERLAP / SAME_DAY / giữ chỗ ở hợp đồng nháp khác — không chặn lưu nháp', async () => {
    const appt = (await book(m1, '2027-05-10T01:00:00Z', '2027-05-10T03:00:00Z')).body;
    const q = async (start: string, end: string, membershipId: string) =>
      (
        await quote(A.owner, A.orgId, { customerId: customerA, lines: [staffLine(start, end, [{ membershipId, role: 'PRIMARY' }])] }).expect(200)
      ).body.lines[0].staffWarnings as { membershipId: string; level: string; overlaps: { code: string }[]; sameDay: { code: string }[]; draftHolds: unknown[] }[];

    const overlap = await q('2027-05-10T02:00:00Z', '2027-05-10T04:00:00Z', m1);
    expect(overlap).toHaveLength(1);
    expect(overlap[0]).toMatchObject({ membershipId: m1, level: 'OVERLAP' });
    expect(overlap[0]!.overlaps.map((x) => x.code)).toEqual([appt.code]);
    // 13:00–14:00 giờ Việt Nam cùng ngày với ca 08:00–10:00
    const sameDay = await q('2027-05-10T06:00:00Z', '2027-05-10T07:00:00Z', m1);
    expect(sameDay[0]).toMatchObject({ level: 'SAME_DAY' });
    expect(sameDay[0]!.sameDay.map((x) => x.code)).toEqual([appt.code]);
    expect(await q('2027-05-11T06:00:00Z', '2027-05-11T07:00:00Z', m1)).toEqual([]);
    expect(await q('2027-05-10T06:00:00Z', '2027-05-10T07:00:00Z', m2)).toEqual([]);

    // Lưu nháp trùng giờ vẫn được (chỉ cảnh báo); nháp đó giữ chỗ m2 → báo cho hợp đồng khác.
    const draft = (
      await create(A.owner, A.orgId, {
        customerId: customerA,
        lines: [staffLine('2027-05-10T02:00:00Z', '2027-05-10T04:00:00Z', [{ membershipId: m1, role: 'PRIMARY' }, { membershipId: m2, role: 'ASSIST' }])],
      }).expect(201)
    ).body;
    const w = draft.lines[0].staffWarnings as { membershipId: string; level: string }[];
    expect(w.map((x) => [x.membershipId, x.level])).toEqual([[m1, 'OVERLAP']]);
    const hold = await q('2027-05-10T03:00:00Z', '2027-05-10T05:00:00Z', m2);
    expect(hold[0]).toMatchObject({ membershipId: m2, level: 'OVERLAP' });
    expect(hold[0]!.draftHolds).toEqual([expect.objectContaining({ contractId: draft.id, overlaps: true })]);
  });

  it('xác nhận tạo đúng số lịch, đúng thợ, đúng giờ, đúng nơi; dòng không có thợ thì không tạo lịch', async () => {
    const c = (
      await create(A.owner, A.orgId, {
        customerId: customerA,
        lines: [
          staffLine('2027-06-01T01:00:00Z', '2027-06-01T03:00:00Z', [{ membershipId: m1, role: 'PRIMARY' }, { membershipId: m2, role: 'ASSIST' }]),
          staffLine('2027-06-01T04:00:00Z', '2027-06-01T05:00:00Z', [{ membershipId: m2, role: 'PRIMARY' }], {
            locationType: 'CUSTOMER_HOME',
            address: '5 Hai Bà Trưng',
            travel: { mode: 'MANUAL', amount: 0 },
            subjectId: A.guest,
          }),
          { kind: 'SERVICE', serviceId: A.party, quantity: 1, scheduledStart: '2027-06-01T06:00:00Z', scheduledEnd: '2027-06-01T07:00:00Z' },
        ],
      }).expect(201)
    ).body;
    const res = await confirm(c.id).expect(200);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.createdAppointments).toHaveLength(2);
    const appts = await deps.db.appointment.findMany({
      where: { contractId: c.id },
      include: { staff: { select: { membershipId: true, role: true, isBlocking: true } } },
      orderBy: { startsAt: 'asc' },
    });
    expect(appts).toHaveLength(2);
    expect(appts[0]).toMatchObject({
      status: 'CONFIRMED',
      kind: 'MAKEUP',
      customerId: customerA,
      contractLineId: c.lines[0].id,
      title: 'Makeup tiệc — Phù dâu',
      locationType: 'STUDIO',
    });
    expect(appts[0]!.startsAt.toISOString()).toBe('2027-06-01T01:00:00.000Z');
    expect(appts[0]!.staff.map((x) => [x.membershipId, x.role, x.isBlocking]).sort()).toEqual(
      [
        [m1, 'PRIMARY', true],
        [m2, 'ASSIST', true],
      ].sort(),
    );
    expect(appts[1]).toMatchObject({ contractLineId: c.lines[1].id, title: 'Makeup tiệc — Khách mời', locationType: 'CUSTOMER_HOME', address: '5 Hai Bà Trưng' });
    expect(appts[1]!.staff.map((x) => x.membershipId)).toEqual([m2]);
    // Lịch của chính hợp đồng không bị coi là trùng khi xem lại hợp đồng.
    const detail = (await request(app).get(url(A.orgId, `/${c.id}`)).set(bearer(A.owner)).expect(200)).body;
    expect(detail.lines[0].staffWarnings).toEqual([]);
    expect(detail.appointments).toHaveLength(2);
  });

  it('trùng giờ khi xác nhận → 409 kèm danh sách; hợp đồng vẫn nháp, không lịch nào được tạo', async () => {
    const busy = (await book(m1, '2027-06-10T01:00:00Z', '2027-06-10T03:00:00Z')).body;
    const c = (
      await create(A.owner, A.orgId, {
        customerId: customerA,
        lines: [
          staffLine('2027-06-10T05:00:00Z', '2027-06-10T06:00:00Z', [{ membershipId: m2, role: 'PRIMARY' }]),
          staffLine('2027-06-10T02:00:00Z', '2027-06-10T04:00:00Z', [{ membershipId: m1, role: 'PRIMARY' }]),
        ],
      }).expect(201)
    ).body;
    const r = await confirm(c.id);
    expect(r.status).toBe(409);
    expect(r.body.error.message).toMatch(/Trùng lịch/);
    expect(r.body.error.details.conflicts).toEqual([expect.objectContaining({ code: busy.code, membershipId: m1 })]);
    expect((await deps.db.contract.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('DRAFT');
    expect(await deps.db.appointment.count({ where: { contractId: c.id } })).toBe(0);
  });

  it('dòng có thợ mà thiếu giờ (dữ liệu ghi thẳng) → xác nhận 400 nêu tên dòng', async () => {
    const c = (
      await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] }).expect(201)
    ).body;
    await deps.db.contractLineStaff.create({ data: { organizationId: A.orgId, lineId: c.lines[0].id, membershipId: m1, role: 'PRIMARY' } });
    const r = await confirm(c.id);
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/Dòng "Makeup tiệc" có thợ phụ trách nhưng chưa có giờ làm/);
    expect((await deps.db.contract.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('DRAFT');
  });

  it('dòng phát sinh sau xác nhận có thợ + giờ → lên lịch ngay; sửa thợ dự kiến của dòng đã chốt bị database chặn', async () => {
    const c = (
      await create(A.owner, A.orgId, {
        customerId: customerA,
        lines: [staffLine('2027-07-01T01:00:00Z', '2027-07-01T02:00:00Z', [{ membershipId: m1, role: 'PRIMARY' }])],
      }).expect(201)
    ).body;
    await confirm(c.id).expect(200);
    const added = await request(app)
      .post(url(A.orgId, `/${c.id}/lines`))
      .set(bearer(A.owner))
      .set('idempotency-key', idem())
      .send(staffLine('2027-07-01T03:00:00Z', '2027-07-01T04:00:00Z', [{ membershipId: m2, role: 'PRIMARY' }]))
      .expect(201);
    expect(added.body.createdAppointments).toHaveLength(1);
    const newLine = (added.body.lines as Line[]).at(-1)!;
    expect(newLine.addedAfterConfirm).toBe(true);
    const appt = await deps.db.appointment.findFirstOrThrow({ where: { contractLineId: newLine.id }, include: { staff: true } });
    expect(appt.status).toBe('CONFIRMED');
    expect(appt.staff.map((x) => x.membershipId)).toEqual([m2]);

    // Dòng đã chốt: đổi/xoá/thêm thợ dự kiến ghi thẳng database → trigger chặn.
    const lineId = c.lines[0].id as string;
    const del = await deps.db.contractLineStaff.deleteMany({ where: { lineId } }).catch((e: unknown) => e);
    expect(String((del as Error).message)).toMatch(/đổi thợ ở màn Lịch/);
    const ins = await deps.db.contractLineStaff
      .create({ data: { organizationId: A.orgId, lineId, membershipId: m2, role: 'ASSIST' } })
      .catch((e: unknown) => e);
    expect(String((ins as Error).message)).toMatch(/đổi thợ ở màn Lịch/);
    const upd = await deps.db.contractLineStaff
      .update({ where: { lineId_membershipId: { lineId, membershipId: m1 } }, data: { role: 'ASSIST' } })
      .catch((e: unknown) => e);
    expect(String((upd as Error).message)).toMatch(/đổi thợ ở màn Lịch/);
  });
});

describe('danh sách hợp đồng', () => {
  it('lọc theo trạng thái, khách, mã, tên, số điện thoại, ngày sự kiện; tiền là số', async () => {
    const cust = await newCustomer(A.orgId, 'Phạm Lọc Thử', '0977000111');
    const lines = [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }];
    const c1 = (await create(A.owner, A.orgId, { customerId: cust, eventDate: '2027-01-10T00:00:00Z', lines }).expect(201)).body;
    const c2 = (await create(A.owner, A.orgId, { customerId: cust, eventDate: '2027-02-10T00:00:00Z', lines }).expect(201)).body;
    const list = (q: Record<string, string>) =>
      request(app).get(url(A.orgId)).query(q).set(bearer(A.owner)).expect(200);
    const byCust = (await list({ customerId: cust })).body;
    expect(byCust.total).toBe(2);
    expect(byCust.items[0].total).toBe(800_000);
    expect(byCust.items[0].customer.fullName).toBe('Phạm Lọc Thử');
    expect((await list({ q: c1.code })).body.items.map((i: { id: string }) => i.id)).toEqual([c1.id]);
    expect((await list({ q: 'lọc thử' })).body.total).toBe(2);
    expect((await list({ q: '+84 977 000 111' })).body.total).toBe(2);
    expect((await list({ customerId: cust, eventFrom: '2027-02-01T00:00:00Z' })).body.items.map((i: { id: string }) => i.id)).toEqual([c2.id]);
    expect((await list({ customerId: cust, eventTo: '2027-01-31T00:00:00Z' })).body.items.map((i: { id: string }) => i.id)).toEqual([c1.id]);
    expect((await list({ customerId: cust, status: 'CONFIRMED' })).body.total).toBe(0);
    const paged = (await list({ customerId: cust, pageSize: '1', page: '2' })).body;
    expect(paged).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(paged.items).toHaveLength(1);
  });
});

describe('chống gửi trùng và mã tuần tự', () => {
  it('gửi lại cùng Idempotency-Key → đúng một hợp đồng, cùng kết quả', async () => {
    const before = await contractCount(A.orgId);
    const key = idem();
    const body = { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] };
    const r1 = await create(A.owner, A.orgId, body, key).expect(201);
    const r2 = await create(A.owner, A.orgId, body, key).expect(201);
    expect(r2.body.id).toBe(r1.body.id);
    expect(r2.body.code).toBe(r1.body.code);
    expect(await contractCount(A.orgId)).toBe(before + 1);
    expect((await create(A.owner, A.orgId, body)).status).toBe(201);
    expect(await contractCount(A.orgId)).toBe(before + 2);
  });

  it('thiếu Idempotency-Key → 400', async () => {
    const res = await request(app)
      .post(url(A.orgId))
      .set(bearer(A.owner))
      .send({ customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('tạo đồng thời 6 hợp đồng ở tổ chức mới → mã HD-000001…HD-000006 không trùng, không sót', async () => {
    const C = await seed('dong-thoi');
    const cust = await newCustomer(C.orgId, 'Khách đồng thời', '0911222333');
    const body = { customerId: cust, lines: [{ kind: 'SERVICE', serviceId: C.party, quantity: 1 }] };
    const results = await Promise.all(Array.from({ length: 6 }, () => create(C.owner, C.orgId, body)));
    for (const r of results) expect(r.status, JSON.stringify(r.body)).toBe(201);
    const codes = results.map((r) => r.body.code as string).sort();
    expect(codes).toEqual(['HD-000001', 'HD-000002', 'HD-000003', 'HD-000004', 'HD-000005', 'HD-000006']);
  });
});

describe('cách ly tổ chức', () => {
  let contractA: { id: string; lines: Line[] };

  beforeAll(async () => {
    contractA = (
      await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] }).expect(201)
    ).body;
  });

  it('chủ B không xem/sửa được hợp đồng A (qua đường của B → 404, qua đường của A → 404)', async () => {
    const viaB = (rest: string) => url(B.orgId, rest);
    expect((await request(app).get(viaB(`/${contractA.id}`)).set(bearer(B.owner))).status).toBe(404);
    expect((await request(app).patch(viaB(`/${contractA.id}`)).set(bearer(B.owner)).send({ notes: 'x' })).status).toBe(404);
    expect((await request(app).post(viaB(`/${contractA.id}/status`)).set(bearer(B.owner)).send({ to: 'CONFIRMED' })).status).toBe(404);
    expect(
      (
        await request(app)
          .post(viaB(`/${contractA.id}/lines`))
          .set(bearer(B.owner))
          .set('idempotency-key', idem())
          .send({ kind: 'CUSTOM', name: 'x', unitPrice: 1, quantity: 1 })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(viaB(`/${contractA.id}/lines/${contractA.lines[0]!.id}/void`))
          .set(bearer(B.owner))
          .send({ reason: 'x' })
      ).status,
    ).toBe(404);
    expect((await request(app).get(url(A.orgId, `/${contractA.id}`)).set(bearer(B.owner))).status).toBe(404);
    const listB = (await request(app).get(url(B.orgId)).set(bearer(B.owner)).expect(200)).body;
    expect(listB.items.map((i: { id: string }) => i.id)).not.toContain(contractA.id);
    const after = await deps.db.contract.findUniqueOrThrow({ where: { id: contractA.id } });
    expect(after.status).toBe('DRAFT');
    expect(after.notes).toBeNull();
  });

  it('dòng của hợp đồng khác (cùng tổ chức) không huỷ được qua hợp đồng này → 404', async () => {
    const other = (
      await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] }).expect(201)
    ).body;
    const r = await request(app)
      .post(url(A.orgId, `/${contractA.id}/lines/${other.lines[0].id}/void`))
      .set(bearer(A.owner))
      .send({ reason: 'x' });
    expect(r.status).toBe(404);
  });

  it('A không dùng được gói, dịch vụ, dịch vụ phụ, nhân vật, studio, khách của B → 404', async () => {
    const before = await contractCount(A.orgId);
    const bodies: [string, object][] = [
      ['gói', { customerId: customerA, lines: [{ kind: 'PACKAGE', packageId: B.bridePkg, quantity: 1 }] }],
      ['dịch vụ', { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: B.party, quantity: 1 }] }],
      ['phụ phí', { customerId: customerA, lines: [{ kind: 'SURCHARGE', serviceId: B.early, quantity: 1 }] }],
      [
        'dịch vụ phụ',
        { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1, addons: [{ serviceId: B.hair, quantity: 1 }] }] },
      ],
      ['nhân vật', { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, subjectId: B.guest, quantity: 1 }] }],
      [
        'studio',
        { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1, locationType: 'STUDIO', studioLocationId: B.studio }] },
      ],
      ['khách', { customerId: customerB, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] }],
    ];
    for (const [what, body] of bodies) {
      const r = await create(A.owner, A.orgId, body);
      expect(r.status, `${what}: ${JSON.stringify(r.body)}`).toBe(404);
      expect((await quote(A.owner, A.orgId, body)).status, what).toBe(404);
    }
    expect(await contractCount(A.orgId)).toBe(before);
  });
});

describe('quyền', () => {
  let artist: TestUser;
  let receptionist: TestUser;
  let accountant: TestUser;

  beforeAll(async () => {
    artist = await registerUser(app, 'hd-tho');
    receptionist = await registerUser(app, 'hd-le-tan');
    accountant = await registerUser(app, 'hd-ke-toan');
    await addMember(app, A.owner, A.orgId, artist, ['artist']);
    await addMember(app, A.owner, A.orgId, receptionist, ['receptionist']);
    await addMember(app, A.owner, A.orgId, accountant, ['accountant']);
  });

  const body = () => ({ newCustomer: { fullName: 'Khách lễ tân', phone: '0933444555' }, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] });

  it('thợ makeup không có contracts.read → 403 ở xem danh sách, xem trước, tạo', async () => {
    expect((await request(app).get(url(A.orgId)).set(bearer(artist))).status).toBe(403);
    expect((await quote(artist, A.orgId, body())).status).toBe(403);
    expect((await create(artist, A.orgId, body())).status).toBe(403);
  });

  it('lễ tân tạo được hợp đồng (kể cả khách mới)', async () => {
    const r = await create(receptionist, A.orgId, body());
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.createdById).toBe(receptionist.id);
  });

  it('sau xác nhận: lễ tân không huỷ dòng / giảm giá dòng phát sinh được (403), quản lý được; ở nháp lễ tân huỷ dòng được', async () => {
    const manager = await registerUser(app, 'hd-quan-ly');
    await addMember(app, A.owner, A.orgId, manager, ['manager']);
    const lines = [
      { kind: 'SERVICE', serviceId: A.party, quantity: 1 },
      { kind: 'CUSTOM', name: 'Phụ kiện', unitPrice: 50_000, quantity: 1 },
    ];
    const voidAs = (u: TestUser, contractId: string, lineId: string) =>
      request(app).post(url(A.orgId, `/${contractId}/lines/${lineId}/void`)).set(bearer(u)).send({ reason: 'Khách bỏ' });

    // Nháp: lễ tân huỷ dòng được.
    const draft = (await create(receptionist, A.orgId, { customerId: customerA, lines }).expect(201)).body;
    await voidAs(receptionist, draft.id, draft.lines[1].id).expect(200);

    const c = (await create(receptionist, A.orgId, { customerId: customerA, lines }).expect(201)).body;
    await request(app).post(url(A.orgId, `/${c.id}/status`)).set(bearer(receptionist)).send({ to: 'CONFIRMED' }).expect(200);
    const denied = await voidAs(receptionist, c.id, c.lines[1].id);
    expect(denied.status).toBe(403);
    expect(denied.body.error.message).toMatch(/cần quyền điều chỉnh hợp đồng/);
    expect(denied.body.error.details).toEqual({ required: 'contracts.adjust' });
    const unchanged = await deps.db.contract.findUniqueOrThrow({ where: { id: c.id } });
    expect(unchanged.total).toBe(850_000n);

    // Phát sinh sau xác nhận: không giảm giá → lễ tân được; có giảm giá dòng → cần quyền điều chỉnh.
    const add = (u: TestUser, b: object) =>
      request(app).post(url(A.orgId, `/${c.id}/lines`)).set(bearer(u)).set('idempotency-key', idem()).send(b);
    await add(receptionist, { kind: 'SURCHARGE', serviceId: A.early, quantity: 1 }).expect(201);
    expect((await add(receptionist, { kind: 'SERVICE', serviceId: A.party, quantity: 1, lineDiscount: 100_000 })).status).toBe(403);
    await add(manager, { kind: 'SERVICE', serviceId: A.party, quantity: 1, lineDiscount: 100_000 }).expect(201);

    const ok = await voidAs(manager, c.id, c.lines[1].id).expect(200);
    expect(ok.body.total).toBe(800_000 + 200_000 + 700_000);
    const audit = await deps.db.auditLog.findFirst({
      where: { organizationId: A.orgId, entityId: c.id, action: 'contract.line_voided' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.actorUserId).toBe(manager.id);
    expect(audit?.data).toMatchObject({ contractStatus: 'CONFIRMED', actorRoles: ['manager'] });
  });

  it('kế toán xem được nhưng không tạo được', async () => {
    expect((await request(app).get(url(A.orgId)).set(bearer(accountant))).status).toBe(200);
    expect((await create(accountant, A.orgId, body())).status).toBe(403);
  });
});

describe('chốt chặn database', () => {
  it('ghi thẳng dòng có line_total sai công thức → database từ chối', async () => {
    const c = (
      await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] }).expect(201)
    ).body;
    // Dòng mới và tổng hợp đồng ghi cùng transaction (database đối chiếu tổng lúc commit).
    const row = (lineTotal: bigint) =>
      deps.db.$transaction(async (tx) => {
        const line = await tx.contractLine.create({
          data: {
            organizationId: A.orgId,
            contractId: c.id,
            kind: 'CUSTOM',
            name: 'Ghi thẳng',
            quantity: 2,
            unitPrice: 100_000n,
            lineDiscount: 10_000n,
            lineTotal,
            createdById: A.owner.id,
          },
        });
        await tx.contract.update({
          where: { id: c.id },
          data: { subtotal: { increment: lineTotal }, total: { increment: lineTotal } },
        });
        return line;
      });
    const err = await row(200_000n).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).toMatch(/contract_lines_money/);
    // Đúng công thức thì database nhận (để chắc phép thử trên không đỏ vì lý do khác).
    const ok = await row(190_000n);
    expect(ok.lineTotal).toBe(190_000n);
  });

  it('hợp đồng đã xác nhận: database chặn sửa/xoá thẳng dòng, chỉ cho đặt cột huỷ', async () => {
    const c = (
      await create(A.owner, A.orgId, { customerId: customerA, lines: [{ kind: 'SERVICE', serviceId: A.party, quantity: 1 }] }).expect(201)
    ).body;
    await request(app).post(url(A.orgId, `/${c.id}/status`)).set(bearer(A.owner)).send({ to: 'CONFIRMED' }).expect(200);
    const lineId = c.lines[0].id as string;
    const upd = await deps.db.contractLine.update({ where: { id: lineId }, data: { sortOrder: 99 } }).catch((e: unknown) => e);
    expect(String((upd as Error).message)).toMatch(/dòng đã chốt không được sửa/);
    const del = await deps.db.contractLine.delete({ where: { id: lineId } }).catch((e: unknown) => e);
    expect(String((del as Error).message)).toMatch(/không được xoá dòng/);
    const ok = await deps.db.$transaction(async (tx) => {
      const voided = await tx.contractLine.update({ where: { id: lineId }, data: { voidedAt: new Date(), voidReason: 'thử' } });
      await tx.contract.update({ where: { id: c.id }, data: { subtotal: 0n, total: 0n } });
      return voided;
    });
    expect(ok.voidedAt).not.toBeNull();
  });

  it('ghi thẳng hợp đồng có total ≠ subtotal − discount → database từ chối', async () => {
    const err = await deps.db.contract
      .create({
        data: {
          organizationId: A.orgId,
          code: `HD-T${randomUUID().slice(0, 6)}`,
          customerId: customerA,
          subtotal: 1_000n,
          discount: 100n,
          total: 1_000n,
          createdById: A.owner.id,
        },
      })
      .catch((e: unknown) => e);
    expect(String((err as Error).message)).toMatch(/contracts_money/);
  });
});
