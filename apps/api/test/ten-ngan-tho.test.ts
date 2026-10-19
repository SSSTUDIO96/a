// M3 (biên bản nghiệm thu lại): thợ trong hợp đồng (StaffView) và ô chọn thợ (StaffAvailability) gửi kèm HỌ TÊN
// (user.fullName) bên cạnh tên hiển thị — cùng nguồn staff/common.ts presentStaff — để web rút tên ngắn bằng một hàm chung
// (apps/web/src/ui/staffName.ts) mà không phải đoán. Kèm cách ly: tổ chức khác không thấy họ tên thợ của tổ chức này.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;

// Đăng ký với HỌ TÊN chọn sẵn (registerUser luôn đặt "Người thử …").
async function registerNamed(fullName: string): Promise<TestUser> {
  const email = `ten-ngan-${randomUUID().slice(0, 8)}@thu.local`;
  const password = 'mat-khau-thu-123';
  const res = await request(app).post('/api/v1/auth/register').send({ email, password, fullName }).expect(201);
  return { id: res.body.user.id, email, password, accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
}

const tag = randomUUID().slice(0, 6);
const LINH_FULL = `Trần Khánh Linh ${tag}`;
const HA_FULL = `Nguyễn Thu Hà ${tag}`;

let ownerA: TestUser;
let ownerB: TestUser;
let orgA: string;
let orgB: string;
let linh: string;
let ha: string;
let contractA: string;

const START = '2031-05-10T01:00:00.000Z';
const END = '2031-05-10T02:00:00.000Z';
// Dịch vụ có giá + nhân vật + studio mặc định của từng tổ chức (dòng có thợ phải là dòng dịch vụ/gói).
const catalog = new Map<string, { serviceId: string; subjectId: string }>();
async function seedCatalog(orgId: string, owner: TestUser) {
  const db = deps.db;
  const svc = await db.service.create({ data: { organizationId: orgId, code: 'MK-TIEC', name: 'Makeup tiệc', kind: 'MAIN', durationMinutes: 60 } });
  await db.priceVersion.create({
    data: { organizationId: orgId, serviceId: svc.id, listPrice: 800_000n, effectiveFrom: new Date(Date.now() - 60_000), createdById: owner.id },
  });
  await db.studioLocation.create({ data: { organizationId: orgId, name: 'Studio', address: '1 Lê Lợi', isDefault: true } });
  const subject = await db.makeupSubject.findFirstOrThrow({ where: { organizationId: orgId, name: 'Phù dâu' } });
  catalog.set(orgId, { serviceId: svc.id, subjectId: subject.id });
}
const lineWith = (orgId: string, staff: { membershipId: string; role: 'PRIMARY' | 'ASSIST' }[]) => ({
  kind: 'SERVICE',
  serviceId: catalog.get(orgId)!.serviceId,
  subjectId: catalog.get(orgId)!.subjectId,
  quantity: 1,
  locationType: 'STUDIO',
  scheduledStart: START,
  scheduledEnd: END,
  staff,
});
const availability = (user: TestUser, orgId: string, query: Record<string, string>) =>
  request(app).get(`/api/v1/orgs/${orgId}/staff/availability`).query(query).set(bearer(user));

type Person = { membershipId: string; displayName: string; fullName: string };

beforeAll(async () => {
  app = makeApp(deps);
  ownerA = await registerUser(app, 'ten-ngan-chu-a');
  ownerB = await registerUser(app, 'ten-ngan-chu-b');
  orgA = await createOrg(app, ownerA, 'ten-ngan-a');
  orgB = await createOrg(app, ownerB, 'ten-ngan-b');
  await seedCatalog(orgA, ownerA);
  await seedCatalog(orgB, ownerB);
  linh = await addMember(app, ownerA, orgA, await registerNamed(LINH_FULL), ['artist']);
  ha = await addMember(app, ownerA, orgA, await registerNamed(HA_FULL), ['artist']);
  // Linh: studio đặt tên hiển thị khác họ tên. Hà: chưa đặt (tên hiển thị = họ tên).
  await request(app).patch(`/api/v1/orgs/${orgA}/staff/${linh}`).set(bearer(ownerA)).send({ displayName: 'Linh Trần' }).expect(200);
  const created = await request(app)
    .post(`/api/v1/orgs/${orgA}/contracts`)
    .set(bearer(ownerA))
    .set('idempotency-key', randomUUID())
    .send({
      newCustomer: { fullName: 'Khách tên ngắn', phone: '0933000111' },
      lines: [lineWith(orgA, [{ membershipId: linh, role: 'PRIMARY' }, { membershipId: ha, role: 'ASSIST' }])],
    });
  if (created.status !== 201) throw new Error(`Tạo hợp đồng thất bại ${created.status}: ${JSON.stringify(created.body)}`);
  contractA = created.body.id as string;
});

afterAll(async () => {
  await deps.db.$disconnect();
});

const WANT: [string, string, string][] = [];
beforeAll(() => {
  WANT.push([linh, 'Linh Trần', LINH_FULL], [ha, HA_FULL, HA_FULL]);
});
const triples = (people: Person[]) =>
  people.map((p) => [p.membershipId, p.displayName, p.fullName]).sort((x, y) => String(x[0]).localeCompare(String(y[0])));
const sorted = () => [...WANT].sort((x, y) => x[0].localeCompare(y[0]));

describe('M3: máy chủ gửi họ tên kèm tên hiển thị', () => {
  it('BẮT: ô chọn thợ (GET staff/availability) — mỗi thợ có displayName và fullName (họ tên tài khoản)', async () => {
    const res = await availability(ownerA, orgA, { startsAt: START, endsAt: END, membershipIds: `${linh},${ha}` });
    expect(res.status).toBe(200);
    expect(triples(res.body.items as Person[])).toEqual(sorted());
  });

  it('BẮT: bảng tính xem trước (POST contracts/quote) — thợ của dòng có fullName', async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgA}/contracts/quote`)
      .set(bearer(ownerA))
      .send({ newCustomer: { fullName: 'Khách xem trước', phone: '0933000222' }, lines: [lineWith(orgA, [{ membershipId: linh, role: 'PRIMARY' }, { membershipId: ha, role: 'ASSIST' }])] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(triples(res.body.lines[0].staff as Person[])).toEqual(sorted());
  });

  it('BẮT: hợp đồng đã lưu (GET contracts/:id) — thợ của dòng có fullName; GIỮ: tên hiển thị và chữ viết tắt như cũ', async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgA}/contracts/${contractA}`).set(bearer(ownerA));
    expect(res.status).toBe(200);
    const staff = res.body.lines[0].staff as (Person & { initials: string; role: string })[];
    expect(triples(staff)).toEqual(sorted());
    expect(staff.find((s) => s.membershipId === linh)).toMatchObject({ role: 'PRIMARY', initials: 'LT' });
    // Chữ viết tắt vẫn tính từ tên hiển thị (không đổi theo họ tên): "Nguyễn Thu Hà <tag>" → N + chữ đầu của tag.
    expect(staff.find((s) => s.membershipId === ha)?.initials).toBe(`N${tag[0]!.toUpperCase()}`);
  });

  it('GIỮ: danh sách thợ (GET staff) vẫn cùng nguồn — displayName/fullName khớp hai chỗ mới', async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgA}/staff`).set(bearer(ownerA));
    expect(res.status).toBe(200);
    const mine = (res.body.items as Person[]).filter((p) => p.membershipId === linh || p.membershipId === ha);
    expect(triples(mine)).toEqual(sorted());
  });
});

describe('M3: cách ly — tổ chức B không thấy họ tên thợ của A', () => {
  it('BẮT: B hỏi ô chọn thợ của B với mã thợ của A → rỗng, không lộ họ tên; hỏi thẳng tổ chức A → 404', async () => {
    const q = { startsAt: START, endsAt: END };
    expect((await availability(ownerB, orgA, q)).status).toBe(404);
    const own = await availability(ownerB, orgB, { ...q, membershipIds: `${linh},${ha}` });
    expect(own.status).toBe(200);
    expect(own.body.items).toEqual([]);
    const all = await availability(ownerB, orgB, q);
    const text = JSON.stringify(all.body);
    for (const s of [LINH_FULL, HA_FULL, linh, ha]) expect(text).not.toContain(s);
  });

  it('BẮT: B xem trước hợp đồng của B gắn thợ của A → 4xx, không lộ họ tên; B đọc hợp đồng của A → 404', async () => {
    const quote = await request(app)
      .post(`/api/v1/orgs/${orgB}/contracts/quote`)
      .set(bearer(ownerB))
      .send({ newCustomer: { fullName: 'Khách B', phone: '0933000333' }, lines: [lineWith(orgB, [{ membershipId: linh, role: 'PRIMARY' }])] });
    expect(quote.status).toBeGreaterThanOrEqual(400);
    expect(quote.status).toBeLessThan(500);
    const detail = await request(app).get(`/api/v1/orgs/${orgB}/contracts/${contractA}`).set(bearer(ownerB));
    expect(detail.status).toBe(404);
    for (const body of [quote.body, detail.body]) {
      const text = JSON.stringify(body);
      for (const s of [LINH_FULL, HA_FULL]) expect(text).not.toContain(s);
    }
  });
});
