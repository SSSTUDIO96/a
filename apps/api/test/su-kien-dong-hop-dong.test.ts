// Bản vẽ D mục 2.4 / 4.1 — SỰ KIỆN CỦA DÒNG + NGÀY CỦA DÒNG (gói M4): chọn loại sự kiện ở dòng đặt chỗ (mã + bản chụp
// tên), loại ẩn / mã lạ / mã tổ chức khác, dòng CUSTOM không nhận trường, hợp đồng nhiều ngày sinh ca đúng ngày.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { localDateAndMinute } from '@makeup/shared';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

interface Org {
  id: string;
  owner: TestUser;
  customer: string;
  party: string;
  occ: { id: string; name: string }[];
}

const idem = () => `k-${randomUUID()}`;

async function seed(label: string): Promise<Org> {
  const owner = await registerUser(app, `skd-${label}`);
  const id = await createOrg(app, owner, `skd-${label}`);
  const tag = randomUUID().slice(0, 6);
  const party = (await db.service.create({ data: { organizationId: id, code: `MK-${tag}`, name: 'Makeup tiệc', kind: 'MAIN', durationMinutes: 60 } })).id;
  await db.priceVersion.create({
    data: { organizationId: id, serviceId: party, listPrice: 800_000n, effectiveFrom: new Date(Date.now() - 60_000), createdById: owner.id },
  });
  const customer = (await db.customer.create({ data: { organizationId: id, fullName: `Khách ${tag}` } })).id;
  const occ = await db.occasion.findMany({ where: { organizationId: id }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } });
  return { id, owner, customer, party, occ };
}

let A: Org;
let B: Org;

beforeAll(async () => {
  app = makeApp(deps);
  A = await seed('a');
  B = await seed('b');
});

afterAll(async () => {
  await db.$disconnect();
});

const url = (o: Org, rest = '') => `/api/v1/orgs/${o.id}/contracts${rest}`;

function line(o: Org, start: string | null, extra: Record<string, unknown> = {}) {
  const times = start ? { scheduledStart: start, scheduledEnd: new Date(new Date(start).getTime() + 3_600_000).toISOString() } : {};
  return { kind: 'SERVICE', serviceId: o.party, quantity: 1, ...times, ...extra };
}
function create(o: Org, lines: object[], extra: object = {}) {
  return request(app).post(url(o)).set(bearer(o.owner)).set('idempotency-key', idem()).send({ customerId: o.customer, lines, ...extra });
}
function quote(o: Org, lines: object[]) {
  return request(app).post(url(o, '/quote')).set(bearer(o.owner)).send({ customerId: o.customer, lines });
}
function patchOccasion(o: Org, id: string, body: object) {
  return request(app).patch(`/api/v1/orgs/${o.id}/occasions/${id}`).set(bearer(o.owner)).send(body);
}

describe('sự kiện của dòng', () => {
  it('chọn loại → dòng lưu occasionId + occasionName (bản chụp); đổi tên loại sau → dòng giữ tên cũ; quote cũng trả tên', async () => {
    const occ = A.occ[0]!;
    const q = await quote(A, [line(A, '2026-11-10T09:00:00+07:00', { occasionId: occ.id })]);
    expect(q.status, JSON.stringify(q.body)).toBe(200);
    expect(q.body.lines[0]).toMatchObject({ occasionId: occ.id, occasionName: occ.name, surcharges: [] });

    const res = await create(A, [line(A, '2026-11-10T09:00:00+07:00', { occasionId: occ.id })]);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.lines[0]).toMatchObject({ occasionId: occ.id, occasionName: occ.name });
    const raw = await db.contractLine.findFirstOrThrow({ where: { contractId: res.body.id }, select: { occasionId: true, occasionName: true } });
    expect(raw).toEqual({ occasionId: occ.id, occasionName: occ.name });

    const renamed = `${occ.name} (đổi ${randomUUID().slice(0, 4)})`;
    await patchOccasion(A, occ.id, { name: renamed }).expect(200);
    const after = await request(app).get(url(A, `/${res.body.id}`)).set(bearer(A.owner)).expect(200);
    expect(after.body.lines[0]).toMatchObject({ occasionId: occ.id, occasionName: occ.name });
    // Dòng mới lấy tên mới.
    const fresh = await quote(A, [line(A, null, { occasionId: occ.id })]);
    expect(fresh.body.lines[0].occasionName).toBe(renamed);
  });

  it('loại đang ẩn → 400 "Loại sự kiện "X" đang ẩn"; mã bịa và mã tổ chức khác → 404 cùng lời', async () => {
    const hidden = A.occ[1]!;
    await patchOccasion(A, hidden.id, { isActive: false }).expect(200);
    const res = await quote(A, [line(A, null, { occasionId: hidden.id })]);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(`Loại sự kiện "${hidden.name}" đang ẩn`);
    expect(res.body.error.details).toEqual({ line: 0 });

    const strip = (r: request.Response) => {
      const { requestId: _r, ...e } = r.body.error;
      return `${r.status} ${JSON.stringify(e)}`;
    };
    const foreign = strip(await quote(A, [line(A, null, { occasionId: B.occ[0]!.id })]));
    const fake = strip(await quote(A, [line(A, null, { occasionId: randomUUID() })]));
    expect(foreign).toBe(fake);
    expect(foreign).toBe('404 {"code":"NOT_FOUND","message":"Không tìm thấy loại sự kiện","details":{"line":0}}');
  });

  it('dòng CUSTOM / SURCHARGE / COURSE gửi occasionId → 400 (không nhận trường)', async () => {
    const custom = await quote(A, [{ kind: 'CUSTOM', name: 'Phụ kiện', unitPrice: 100_000, quantity: 1, occasionId: A.occ[0]!.id }]);
    expect(custom.status).toBe(400);
    expect(JSON.stringify(custom.body)).toContain('Không nhận trường: occasionId');
    const sur = await quote(A, [{ kind: 'SURCHARGE', serviceId: A.party, quantity: 1, dismissedRuleIds: [] }]);
    expect(sur.status).toBe(400);
    expect(JSON.stringify(sur.body)).toContain('Không nhận trường: dismissedRuleIds');
  });
});

describe('hợp đồng nhiều ngày', () => {
  it('hai dòng hai ngày khác nhau → xác nhận sinh 2 ca đúng 2 ngày (theo múi giờ tổ chức)', async () => {
    const res = await create(
      A,
      [line(A, '2026-11-20T06:00:00+07:00', { occasionId: A.occ[0]!.id }), line(A, '2026-11-22T17:30:00Z', { occasionId: A.occ[2]!.id })],
      { eventDate: '2026-11-22T08:00:00+07:00' },
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const ok = await request(app).post(url(A, `/${res.body.id}/status`)).set(bearer(A.owner)).send({ to: 'CONFIRMED' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.createdAppointments).toHaveLength(2);
    const appts = await db.appointment.findMany({
      where: { organizationId: A.id, contractId: res.body.id },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true, contractLineId: true },
    });
    const days = appts.map((a) => localDateAndMinute(a.startsAt, 'Asia/Ho_Chi_Minh'));
    // 2026-11-22T17:30Z = 00:30 ngày 23/11 giờ VN.
    expect(days.map((d) => d.date)).toEqual(['2026-11-20', '2026-11-23']);
    expect(appts.map((a) => a.contractLineId)).toEqual([ok.body.lines[0].id, ok.body.lines[1].id]);
  });
});
