import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let ownerA: TestUser;
let artist1: TestUser;
let artist2: TestUser;
let suspended: TestUser;
let ownerB: TestUser;
let orgA: string;
let orgB: string;
let m1: string;
let m2: string;
let mSuspended: string;
let mB: string;

// Mỗi bài thử dùng một ngày riêng trong tương lai xa để các khoảng bận không dính nhau.
function at(day: number, hhmm: string) {
  return new Date(`2031-03-${String(day).padStart(2, '0')}T${hhmm}:00+07:00`).toISOString();
}

function newKey() {
  return `k-${randomUUID()}`;
}

function postAppt(orgId: string, user: TestUser, body: Record<string, unknown>, key = newKey()) {
  return request(app).post(`/api/v1/orgs/${orgId}/appointments`).set(bearer(user)).set('Idempotency-Key', key).send(body);
}

function setStatus(orgId: string, user: TestUser, id: string, body: Record<string, unknown>) {
  return request(app).post(`/api/v1/orgs/${orgId}/appointments/${id}/status`).set(bearer(user)).send(body);
}

function slot(day: number, from: string, to: string, staff: { membershipId: string; role?: string }[], extra: Record<string, unknown> = {}) {
  return { startsAt: at(day, from), endsAt: at(day, to), staff, status: 'CONFIRMED', ...extra };
}

async function makeCustomer(orgId: string, owner: TestUser, fullName = 'Khách thử') {
  const res = await request(app).post(`/api/v1/orgs/${orgId}/customers`).set(bearer(owner)).send({ fullName }).expect(201);
  return res.body.id as string;
}

async function makeContract(orgId: string, customerId: string, createdById: string, status: 'DRAFT' | 'CANCELLED' = 'DRAFT') {
  return deps.db.contract.create({
    data: {
      organizationId: orgId,
      code: `HD-${randomUUID().slice(0, 8)}`,
      customerId,
      createdById,
      status,
      ...(status === 'CANCELLED' ? { cancelReason: 'Khách đổi ý' } : {}),
    },
  });
}

async function makeContractLine(orgId: string, contractId: string, createdById: string) {
  return deps.db.contractLine.create({
    data: { organizationId: orgId, contractId, kind: 'CUSTOM', name: 'Dòng thử', unitPrice: 0n, lineTotal: 0n, createdById },
  });
}

beforeAll(async () => {
  app = makeApp(deps);
  ownerA = await registerUser(app, 'chu-lich-a');
  artist1 = await registerUser(app, 'tho-1');
  artist2 = await registerUser(app, 'tho-2');
  suspended = await registerUser(app, 'tho-khoa');
  ownerB = await registerUser(app, 'chu-lich-b');
  const artistB = await registerUser(app, 'tho-b');
  orgA = await createOrg(app, ownerA, 'lich-a');
  orgB = await createOrg(app, ownerB, 'lich-b');
  m1 = await addMember(app, ownerA, orgA, artist1, ['artist']);
  m2 = await addMember(app, ownerA, orgA, artist2, ['artist']);
  mSuspended = await addMember(app, ownerA, orgA, suspended, ['artist']);
  await request(app).patch(`/api/v1/orgs/${orgA}/members/${mSuspended}`).set(bearer(ownerA)).send({ status: 'SUSPENDED' }).expect(200);
  mB = await addMember(app, ownerB, orgB, artistB, ['artist']);
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('khách hàng', () => {
  it('chuẩn hoá số điện thoại, tìm theo tên hoặc số', async () => {
    const created = await request(app)
      .post(`/api/v1/orgs/${orgA}/customers`)
      .set(bearer(ownerA))
      .send({ fullName: 'Nguyễn Thị Hoa', phone: '+84 912 345 678' })
      .expect(201);
    expect(created.body.phone).toBe('0912345678');

    const byPhone = await request(app).get(`/api/v1/orgs/${orgA}/customers`).query({ q: '0912 345' }).set(bearer(ownerA)).expect(200);
    expect(byPhone.body.items.map((c: { id: string }) => c.id)).toContain(created.body.id);
    const byIntl = await request(app).get(`/api/v1/orgs/${orgA}/customers`).query({ q: '+84912' }).set(bearer(ownerA)).expect(200);
    expect(byIntl.body.items.map((c: { id: string }) => c.id)).toContain(created.body.id);
    const byName = await request(app).get(`/api/v1/orgs/${orgA}/customers`).query({ q: 'thị hoa' }).set(bearer(ownerA)).expect(200);
    expect(byName.body.items.map((c: { id: string }) => c.id)).toContain(created.body.id);

    const patched = await request(app)
      .patch(`/api/v1/orgs/${orgA}/customers/${created.body.id}`)
      .set(bearer(ownerA))
      .send({ phone: '0383.456.789' })
      .expect(200);
    expect(patched.body.phone).toBe('0383456789');
    const audit = await deps.db.auditLog.count({ where: { organizationId: orgA, entityId: created.body.id } });
    expect(audit).toBe(2);
  });

  it('số điện thoại sai định dạng → 400', async () => {
    const res = await request(app).post(`/api/v1/orgs/${orgA}/customers`).set(bearer(ownerA)).send({ fullName: 'X', phone: '12345' });
    expect(res.status).toBe(400);
  });

  it('tổ chức B không xem/sửa được khách của A', async () => {
    const id = await makeCustomer(orgA, ownerA, 'Khách riêng A');
    expect((await request(app).get(`/api/v1/orgs/${orgA}/customers/${id}`).set(bearer(ownerB))).status).toBe(404);
    expect((await request(app).get(`/api/v1/orgs/${orgB}/customers/${id}`).set(bearer(ownerB))).status).toBe(404);
    expect(
      (await request(app).patch(`/api/v1/orgs/${orgB}/customers/${id}`).set(bearer(ownerB)).send({ fullName: 'Đổi' })).status,
    ).toBe(404);
    const list = await request(app).get(`/api/v1/orgs/${orgB}/customers`).query({ q: 'Khách riêng A' }).set(bearer(ownerB)).expect(200);
    expect(list.body.items).toEqual([]);
  });
});

describe('tạo lịch', () => {
  it('tạo kèm khách mới, sinh mã, ghi lịch sử trạng thái và nhật ký', async () => {
    const res = await postAppt(orgA, ownerA, {
      ...slot(1, '08:00', '10:00', [{ membershipId: m1, role: 'PRIMARY' }]),
      newCustomer: { fullName: 'Cô dâu Lan', phone: '0912 000 111' },
      travelBeforeMin: 30,
      travelAfterMin: 45,
      locationType: 'CUSTOMER_HOME',
      address: '12 Lê Lợi, Q1',
      latitude: 10.776889,
      longitude: 106.700806,
    });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^LH-\d{6}$/);
    expect(res.body.customer).toMatchObject({ fullName: 'Cô dâu Lan', phone: '0912000111' });
    expect(res.body.latitude).toBe(10.776889);
    expect(res.body.locationType).toBe('CUSTOMER_HOME');
    expect(res.body.staff).toHaveLength(1);
    expect(res.body.staff[0]).toMatchObject({ membershipId: m1, role: 'PRIMARY', isBlocking: true });
    expect(res.body.staff[0].blockStart).toBe(new Date(at(1, '07:30')).toISOString());
    expect(res.body.staff[0].blockEnd).toBe(new Date(at(1, '10:45')).toISOString());
    expect(res.body.statusHistory).toEqual([expect.objectContaining({ fromStatus: null, toStatus: 'CONFIRMED' })]);
    expect('subtotal' in res.body).toBe(false);
    const audit = await deps.db.auditLog.findFirst({ where: { organizationId: orgA, entityId: res.body.id, action: 'appointment.created' } });
    expect(audit).not.toBeNull();
  });

  it('giờ sai → 400 (kết thúc trước bắt đầu, dài quá 24h, di chuyển quá 600 phút)', async () => {
    expect((await postAppt(orgA, ownerA, slot(2, '10:00', '09:00', []))).status).toBe(400);
    expect((await postAppt(orgA, ownerA, { startsAt: at(2, '08:00'), endsAt: at(3, '09:00'), staff: [] })).status).toBe(400);
    expect((await postAppt(orgA, ownerA, { ...slot(2, '08:00', '09:00', []), travelBeforeMin: 601 })).status).toBe(400);
  });

  it('tối đa một thợ chính; thợ đã tạm khoá không phân được', async () => {
    const two = await postAppt(orgA, ownerA, slot(2, '08:00', '09:00', [{ membershipId: m1 }, { membershipId: m2 }]));
    expect(two.status).toBe(400);
    const off = await postAppt(orgA, ownerA, slot(2, '08:00', '09:00', [{ membershipId: mSuspended }]));
    expect(off.status).toBe(400);
    expect(off.body.error.details.membershipIds).toEqual([mSuspended]);
  });

  it('thợ phụ không có quyền tạo lịch → 403', async () => {
    expect((await postAppt(orgA, artist1, slot(2, '08:00', '09:00', []))).status).toBe(403);
  });
});

describe('chặn trùng lịch', () => {
  it('cùng thợ trùng giờ → 409 kèm danh sách lịch trùng', async () => {
    const first = await postAppt(orgA, ownerA, slot(5, '08:00', '10:00', [{ membershipId: m1 }]));
    expect(first.status).toBe(201);
    const clash = await postAppt(orgA, ownerA, slot(5, '09:00', '11:00', [{ membershipId: m1 }]));
    expect(clash.status).toBe(409);
    expect(clash.body.error.details.conflicts).toEqual([
      expect.objectContaining({ code: first.body.code, membershipId: m1, staffName: 'Người thử tho-1' }),
    ]);
    expect(clash.body.error.message).toContain(first.body.code);
  });

  it('trùng do thời gian di chuyển: A 8–10h + đi 60 phút, B 10h30 → 409', async () => {
    const a = await postAppt(orgA, ownerA, { ...slot(6, '08:00', '10:00', [{ membershipId: m2 }]), travelAfterMin: 60 });
    expect(a.status).toBe(201);
    const b = await postAppt(orgA, ownerA, slot(6, '10:30', '12:00', [{ membershipId: m2 }]));
    expect(b.status).toBe(409);
    // Nối đuôi đúng lúc hết thời gian di chuyển thì được.
    const c = await postAppt(orgA, ownerA, slot(6, '11:00', '12:00', [{ membershipId: m2 }]));
    expect(c.status).toBe(201);
  });

  it('khác thợ cùng giờ → được', async () => {
    expect((await postAppt(orgA, ownerA, slot(7, '08:00', '10:00', [{ membershipId: m1 }]))).status).toBe(201);
    expect((await postAppt(orgA, ownerA, slot(7, '08:00', '10:00', [{ membershipId: m2 }]))).status).toBe(201);
  });

  it('lịch nháp không chiếm giờ; chuyển sang đã xác nhận mà trùng → 409; huỷ lịch kia thì nhả giờ', async () => {
    const confirmed = await postAppt(orgA, ownerA, slot(8, '08:00', '10:00', [{ membershipId: m1 }]));
    expect(confirmed.status).toBe(201);
    const draft = await postAppt(orgA, ownerA, { ...slot(8, '09:00', '11:00', [{ membershipId: m1 }]), status: 'DRAFT' });
    expect(draft.status).toBe(201);
    expect(draft.body.staff[0].isBlocking).toBe(false);

    const up = await setStatus(orgA, ownerA, draft.body.id, { to: 'CONFIRMED' });
    expect(up.status).toBe(409);
    expect(up.body.error.details.conflicts[0].code).toBe(confirmed.body.code);

    const noReason = await setStatus(orgA, ownerA, confirmed.body.id, { to: 'CANCELLED' });
    expect(noReason.status).toBe(400);
    const cancel = await setStatus(orgA, ownerA, confirmed.body.id, { to: 'CANCELLED', reason: 'Khách dời ngày' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.cancelReason).toBe('Khách dời ngày');
    expect(cancel.body.staff[0].isBlocking).toBe(false);

    const retry = await setStatus(orgA, ownerA, draft.body.id, { to: 'CONFIRMED' });
    expect(retry.status).toBe(200);
    expect(retry.body.staff[0].isBlocking).toBe(true);
    expect(retry.body.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual(['DRAFT', 'CONFIRMED']);
    const audit = await deps.db.auditLog.count({
      where: { organizationId: orgA, entityId: draft.body.id, action: 'appointment.status_changed' },
    });
    expect(audit).toBe(1);
  });

  it('hai yêu cầu đồng thời cùng thợ cùng giờ (khoá khác nhau) → đúng 1 thành công, 1 cái 409, không 500', async () => {
    const body = slot(9, '14:00', '16:00', [{ membershipId: m2 }]);
    const results = await Promise.all([postAppt(orgA, ownerA, body), postAppt(orgA, ownerA, body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const n = await deps.db.appointmentStaff.count({
      where: { organizationId: orgA, membershipId: m2, isBlocking: true, blockStart: new Date(at(9, '14:00')) },
    });
    expect(n).toBe(1);
  });

  it('đua nhau nhiều yêu cầu cùng lúc vẫn chỉ 1 lịch lọt', async () => {
    const body = slot(9, '18:00', '19:00', [{ membershipId: m1 }]);
    const results = await Promise.all(Array.from({ length: 5 }, () => postAppt(orgA, ownerA, body)));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
  });
});

describe('sửa lịch', () => {
  it('đổi giờ phải kiểm trùng; đổi được khi không trùng và khoảng bận đi theo', async () => {
    const a = await postAppt(orgA, ownerA, slot(10, '08:00', '10:00', [{ membershipId: m1 }]));
    const b = await postAppt(orgA, ownerA, slot(10, '13:00', '14:00', [{ membershipId: m1 }]));
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const clash = await request(app)
      .patch(`/api/v1/orgs/${orgA}/appointments/${b.body.id}`)
      .set(bearer(ownerA))
      .send({ startsAt: at(10, '09:00') });
    expect(clash.status).toBe(409);
    expect(clash.body.error.details.conflicts[0].code).toBe(a.body.code);

    const moved = await request(app)
      .patch(`/api/v1/orgs/${orgA}/appointments/${b.body.id}`)
      .set(bearer(ownerA))
      .send({ startsAt: at(10, '15:00'), endsAt: at(10, '16:00'), travelBeforeMin: 30, notes: 'Đổi giờ theo khách' });
    expect(moved.status).toBe(200);
    expect(moved.body.staff[0].blockStart).toBe(new Date(at(10, '14:30')).toISOString());
    expect(moved.body.notes).toBe('Đổi giờ theo khách');

    // Tự sửa chính mình (không đổi khoảng thời gian chồng lên chính nó) không bị coi là trùng.
    const self = await request(app)
      .patch(`/api/v1/orgs/${orgA}/appointments/${a.body.id}`)
      .set(bearer(ownerA))
      .send({ endsAt: at(10, '10:30') });
    expect(self.status).toBe(200);
  });

  it('đổi thợ phải kiểm trùng với lịch của thợ mới', async () => {
    const busy = await postAppt(orgA, ownerA, slot(11, '08:00', '10:00', [{ membershipId: m2 }]));
    const mine = await postAppt(orgA, ownerA, slot(11, '08:00', '10:00', [{ membershipId: m1 }]));
    expect(busy.status).toBe(201);
    expect(mine.status).toBe(201);
    const swap = await request(app)
      .patch(`/api/v1/orgs/${orgA}/appointments/${mine.body.id}`)
      .set(bearer(ownerA))
      .send({ staff: [{ membershipId: m2, role: 'PRIMARY' }] });
    expect(swap.status).toBe(409);
    const assist = await request(app)
      .patch(`/api/v1/orgs/${orgA}/appointments/${mine.body.id}`)
      .set(bearer(ownerA))
      .send({ staff: [{ membershipId: m1, role: 'ASSIST' }] });
    expect(assist.status).toBe(200);
    expect(assist.body.staff[0].role).toBe('ASSIST');
  });

  it('lịch đã huỷ không sửa được → 409', async () => {
    const a = await postAppt(orgA, ownerA, slot(12, '08:00', '09:00', [{ membershipId: m1 }]));
    await setStatus(orgA, ownerA, a.body.id, { to: 'CANCELLED', reason: 'Huỷ thử' }).expect(200);
    const res = await request(app).patch(`/api/v1/orgs/${orgA}/appointments/${a.body.id}`).set(bearer(ownerA)).send({ notes: 'x' });
    expect(res.status).toBe(409);
  });
});

describe('bảng chuyển trạng thái', () => {
  it('chuyển sai bảng → 409, đúng bảng → 200 tới hoàn thành', async () => {
    const a = await postAppt(orgA, ownerA, { ...slot(13, '08:00', '09:00', [{ membershipId: m1 }]), status: 'DRAFT' });
    expect((await setStatus(orgA, ownerA, a.body.id, { to: 'COMPLETED' })).status).toBe(409);
    expect((await setStatus(orgA, ownerA, a.body.id, { to: 'IN_PROGRESS' })).status).toBe(409);
    for (const to of ['PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED']) {
      expect((await setStatus(orgA, ownerA, a.body.id, { to })).status).toBe(200);
    }
    const back = await setStatus(orgA, ownerA, a.body.id, { to: 'CANCELLED', reason: 'muộn rồi' });
    expect(back.status).toBe(409);
    expect(back.body.error.details.allowed).toEqual([]);
  });
});

describe('chống gửi trùng và mã lịch', () => {
  it('gửi lại cùng Idempotency-Key → cùng kết quả, chỉ 1 lịch; cùng khoá khác nội dung → 409', async () => {
    const key = newKey();
    const body = slot(14, '08:00', '09:00', [{ membershipId: m1 }], { notes: 'gửi trùng' });
    const first = await postAppt(orgA, ownerA, body, key);
    const again = await postAppt(orgA, ownerA, body, key);
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(await deps.db.appointment.count({ where: { organizationId: orgA, notes: 'gửi trùng' } })).toBe(1);

    const other = await postAppt(orgA, ownerA, { ...body, notes: 'nội dung khác' }, key);
    expect(other.status).toBe(409);
  });

  it('thiếu Idempotency-Key → 400', async () => {
    const res = await request(app).post(`/api/v1/orgs/${orgA}/appointments`).set(bearer(ownerA)).send(slot(14, '10:00', '11:00', []));
    expect(res.status).toBe(400);
  });

  it('mã lịch tuần tự, không trùng khi tạo đồng thời', async () => {
    const org = await createOrg(app, ownerA, 'ma-lich');
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => postAppt(org, ownerA, { ...slot(15, '08:00', '09:00', []), status: 'DRAFT', title: `Lịch ${i}` })),
    );
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(201));
    const codes = results.map((r) => r.body.code as string).sort();
    expect(codes).toEqual(['LH-000001', 'LH-000002', 'LH-000003', 'LH-000004', 'LH-000005', 'LH-000006']);
  });
});

describe('quyền xem lịch', () => {
  let a1: string;
  let a2: string;
  beforeAll(async () => {
    a1 = (await postAppt(orgA, ownerA, slot(20, '08:00', '09:00', [{ membershipId: m1 }]))).body.id;
    a2 = (await postAppt(orgA, ownerA, slot(20, '08:00', '09:00', [{ membershipId: m2 }]))).body.id;
  });

  it('from/to bắt buộc, tối đa 62 ngày', async () => {
    const base = `/api/v1/orgs/${orgA}/appointments`;
    expect((await request(app).get(base).set(bearer(ownerA))).status).toBe(400);
    expect((await request(app).get(base).query({ from: at(20, '00:00') }).set(bearer(ownerA))).status).toBe(400);
    expect(
      (await request(app).get(base).query({ from: '2031-01-01T00:00:00Z', to: '2031-03-05T00:00:00Z' }).set(bearer(ownerA))).status,
    ).toBe(400);
    expect((await request(app).get(base).query({ from: at(21, '00:00'), to: at(20, '00:00') }).set(bearer(ownerA))).status).toBe(400);
  });

  it('chủ thấy cả hai; thợ chỉ thấy lịch mình', async () => {
    const q = { from: at(20, '00:00'), to: at(21, '00:00') };
    const all = await request(app).get(`/api/v1/orgs/${orgA}/appointments`).query(q).set(bearer(ownerA)).expect(200);
    expect(all.body.items.map((x: { id: string }) => x.id).sort()).toEqual([a1, a2].sort());
    const filtered = await request(app).get(`/api/v1/orgs/${orgA}/appointments`).query({ ...q, membershipId: m2 }).set(bearer(ownerA)).expect(200);
    expect(filtered.body.items.map((x: { id: string }) => x.id)).toEqual([a2]);

    const mine = await request(app).get(`/api/v1/orgs/${orgA}/appointments`).query(q).set(bearer(artist1)).expect(200);
    expect(mine.body.items.map((x: { id: string }) => x.id)).toEqual([a1]);
    const peek = await request(app).get(`/api/v1/orgs/${orgA}/appointments`).query({ ...q, membershipId: m2 }).set(bearer(artist1));
    expect(peek.status).toBe(403);
    expect((await request(app).get(`/api/v1/orgs/${orgA}/appointments/${a1}`).set(bearer(artist1))).status).toBe(200);
    expect((await request(app).get(`/api/v1/orgs/${orgA}/appointments/${a2}`).set(bearer(artist1))).status).toBe(404);
  });
});

describe('cách ly tổ chức', () => {
  let apptA: string;
  beforeAll(async () => {
    apptA = (await postAppt(orgA, ownerA, slot(22, '08:00', '09:00', [{ membershipId: m1 }]))).body.id;
  });

  it('tổ chức B không xem/sửa/chuyển trạng thái được lịch của A', async () => {
    expect((await request(app).get(`/api/v1/orgs/${orgA}/appointments/${apptA}`).set(bearer(ownerB))).status).toBe(404);
    expect((await request(app).get(`/api/v1/orgs/${orgB}/appointments/${apptA}`).set(bearer(ownerB))).status).toBe(404);
    expect(
      (await request(app).patch(`/api/v1/orgs/${orgB}/appointments/${apptA}`).set(bearer(ownerB)).send({ notes: 'x' })).status,
    ).toBe(404);
    expect((await setStatus(orgB, ownerB, apptA, { to: 'CANCELLED', reason: 'phá' })).status).toBe(404);
    const list = await request(app)
      .get(`/api/v1/orgs/${orgB}/appointments`)
      .query({ from: at(22, '00:00'), to: at(23, '00:00') })
      .set(bearer(ownerB))
      .expect(200);
    expect(list.body.items).toEqual([]);
  });

  it('không dùng được khách của A trong lịch của B', async () => {
    const customerA = await makeCustomer(orgA, ownerA);
    const res = await postAppt(orgB, ownerB, { ...slot(22, '08:00', '09:00', []), customerId: customerA });
    expect(res.status).toBe(404);
  });

  it('không phân được thợ của B vào lịch A', async () => {
    const res = await postAppt(orgA, ownerA, slot(22, '10:00', '11:00', [{ membershipId: mB }]));
    expect(res.status).toBe(400);
    expect(res.body.error.details.membershipIds).toEqual([mB]);
    const patch = await request(app)
      .patch(`/api/v1/orgs/${orgA}/appointments/${apptA}`)
      .set(bearer(ownerA))
      .send({ staff: [{ membershipId: mB, role: 'PRIMARY' }] });
    expect(patch.status).toBe(400);
  });
});

describe('lịch gắn hợp đồng', () => {
  it('tự lấy khách của hợp đồng; lọc danh sách theo hợp đồng', async () => {
    const customerId = await makeCustomer(orgA, ownerA, 'Khách hợp đồng');
    const contract = await makeContract(orgA, customerId, ownerA.id);
    const line = await makeContractLine(orgA, contract.id, ownerA.id);
    const res = await postAppt(orgA, ownerA, {
      ...slot(25, '08:00', '09:00', [{ membershipId: m1 }]),
      contractId: contract.id,
      contractLineId: line.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.customer.id).toBe(customerId);
    expect(res.body.contract).toMatchObject({ id: contract.id, code: contract.code });
    expect(res.body.contractLineId).toBe(line.id);

    const list = await request(app)
      .get(`/api/v1/orgs/${orgA}/appointments`)
      .query({ from: at(1, '00:00'), to: at(31, '00:00'), contractId: contract.id })
      .set(bearer(ownerA))
      .expect(200);
    expect(list.body.items.map((x: { id: string }) => x.id)).toEqual([res.body.id]);
  });

  it('dòng hợp đồng không thuộc hợp đồng → 400; khách khác khách hợp đồng → 400', async () => {
    const c1 = await makeContract(orgA, await makeCustomer(orgA, ownerA), ownerA.id);
    const c2 = await makeContract(orgA, await makeCustomer(orgA, ownerA), ownerA.id);
    const lineOfC2 = await makeContractLine(orgA, c2.id, ownerA.id);
    const wrongLine = await postAppt(orgA, ownerA, { ...slot(26, '08:00', '09:00', []), contractId: c1.id, contractLineId: lineOfC2.id });
    expect(wrongLine.status).toBe(400);
    const lineOnly = await postAppt(orgA, ownerA, { ...slot(26, '08:00', '09:00', []), contractLineId: lineOfC2.id });
    expect(lineOnly.status).toBe(400);
    const wrongCustomer = await postAppt(orgA, ownerA, {
      ...slot(26, '08:00', '09:00', []),
      contractId: c1.id,
      customerId: c2.customerId,
    });
    expect(wrongCustomer.status).toBe(400);
  });

  it('hợp đồng đã huỷ → 409; hợp đồng của tổ chức B → 404', async () => {
    const cancelled = await makeContract(orgA, await makeCustomer(orgA, ownerA), ownerA.id, 'CANCELLED');
    expect((await postAppt(orgA, ownerA, { ...slot(27, '08:00', '09:00', []), contractId: cancelled.id })).status).toBe(409);
    const contractB = await makeContract(orgB, await makeCustomer(orgB, ownerB), ownerB.id);
    expect((await postAppt(orgA, ownerA, { ...slot(27, '08:00', '09:00', []), contractId: contractB.id })).status).toBe(404);
  });
});
