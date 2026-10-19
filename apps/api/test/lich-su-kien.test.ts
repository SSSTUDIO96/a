// Gói M5 (bản vẽ D mục 2.5): mọi cửa trả lịch có thêm `occasion: { id, name, color } | null`.
//  - name = BẢN CHỤP tên trên dòng hợp đồng (đổi tên loại sau → ca vẫn trả tên cũ);
//  - color = màu HIỆN TẠI của loại (đổi màu loại → ca trả màu mới);
//  - ca lẻ (không dòng) / dòng chưa chọn sự kiện → null;
//  - thợ chỉ có schedule.read_own đọc được occasion của ca MÌNH;
//  - không lộ sự kiện của tổ chức khác (khoá ngoại kép + lịch của tổ chức khác không có tên / mã / màu này);
//  - các trường cũ (subjectName, quantity, courseClass…) giữ nguyên hình dạng.
// Cửa trả lịch phủ ở đây (5/5): GET danh sách, GET một lịch, POST tạo, PATCH sửa, POST đổi trạng thái.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;

let app: App;
let owner: TestUser;
let orgId: string;
let artistA: TestUser; // thợ được phân vào ca có sự kiện
let artistB: TestUser; // thợ không được phân vào ca nào
let mA: string;
let mB: string;
let occId: string;
let contractId: string;
let lineWithOcc: string;
let lineNoOcc: string;
let subjectName: string;

let otherOwner: TestUser;
let otherOrgId: string;
let otherOccId: string;

const OCC_NAME = 'Ăn hỏi thử M5';
const SECRET_NAME = 'Sự kiện bí mật của tổ chức khác';

function at(day: number, hhmm: string) {
  return new Date(`2032-06-${String(day).padStart(2, '0')}T${hhmm}:00+07:00`).toISOString();
}

function postAppt(body: Record<string, unknown>, who = owner, org = orgId) {
  return request(app).post(`/api/v1/orgs/${org}/appointments`).set(bearer(who)).set('Idempotency-Key', randomUUID()).send(body);
}

function listDay(day: number, who = owner, org = orgId) {
  return request(app)
    .get(`/api/v1/orgs/${org}/appointments`)
    .query({ from: at(day, '00:00'), to: at(day, '23:59') })
    .set(bearer(who));
}

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'chu-lich-sk');
  orgId = await createOrg(app, owner, 'lich-sk');
  artistA = await registerUser(app, 'tho-sk-a');
  artistB = await registerUser(app, 'tho-sk-b');
  mA = await addMember(app, owner, orgId, artistA, ['artist']);
  mB = await addMember(app, owner, orgId, artistB, ['artist']);

  const customer = await db.customer.create({ data: { organizationId: orgId, fullName: 'Khách sự kiện' } });
  const subject = await db.makeupSubject.findFirstOrThrow({ where: { organizationId: orgId } });
  subjectName = subject.name;
  const occ = await db.occasion.create({ data: { organizationId: orgId, name: OCC_NAME, color: 'amber' } });
  occId = occ.id;
  const contract = await db.contract.create({
    data: { organizationId: orgId, code: `HD-${randomUUID().slice(0, 8)}`, customerId: customer.id, createdById: owner.id },
  });
  contractId = contract.id;
  const line = (extra: Record<string, unknown>) =>
    db.contractLine.create({
      data: { organizationId: orgId, contractId, kind: 'CUSTOM', name: 'Makeup', unitPrice: 0n, lineTotal: 0n, createdById: owner.id, ...extra },
    });
  // Dòng CUSTOM không được có sự kiện (CHECK contract_lines_occasion) → dòng có sự kiện là SERVICE.
  const service = await db.service.create({
    data: { organizationId: orgId, code: 'DV-M5', name: 'Dịch vụ thử M5', kind: 'MAIN', durationMinutes: 60 },
  });
  lineWithOcc = (
    await line({ kind: 'SERVICE', serviceId: service.id, subjectId: subject.id, subjectName: subject.name, occasionId: occ.id, occasionName: OCC_NAME })
  ).id;
  lineNoOcc = (await line({ kind: 'SERVICE', serviceId: service.id })).id;

  otherOwner = await registerUser(app, 'chu-khac-sk');
  otherOrgId = await createOrg(app, otherOwner, 'khac-sk');
  const other = await db.occasion.create({ data: { organizationId: otherOrgId, name: SECRET_NAME, color: 'plum' } });
  otherOccId = other.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe('occasion của ca (5 cửa trả lịch)', () => {
  it('ca sinh từ dòng có sự kiện → occasion { id, name, color } đúng ở cả 5 cửa; trường cũ giữ nguyên', async () => {
    const created = await postAppt({
      startsAt: at(3, '08:00'),
      endsAt: at(3, '09:00'),
      contractId,
      contractLineId: lineWithOcc,
      staff: [{ membershipId: mA, role: 'PRIMARY' }],
      status: 'DRAFT',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const want = { id: occId, name: OCC_NAME, color: 'amber' };
    expect(created.body.occasion).toEqual(want);
    // Các trường cũ không đổi hình dạng.
    expect(created.body.subjectName).toBe(subjectName);
    expect(created.body.quantity).toBe(1);
    expect(created.body.courseClass).toBeNull();
    expect(created.body.contractLineId).toBe(lineWithOcc);
    expect(Object.keys(created.body)).toEqual(
      expect.arrayContaining(['id', 'code', 'kind', 'status', 'customer', 'contract', 'subjectName', 'quantity', 'courseClass', 'sessionDate', 'staff', 'startsAt', 'endsAt']),
    );
    const id = created.body.id as string;

    const one = await request(app).get(`/api/v1/orgs/${orgId}/appointments/${id}`).set(bearer(owner)).expect(200);
    expect(one.body.occasion).toEqual(want);

    const list = await listDay(3).expect(200);
    const row = (list.body.items as { id: string; occasion: unknown }[]).find((r) => r.id === id);
    expect(row?.occasion).toEqual(want);

    const patched = await request(app)
      .patch(`/api/v1/orgs/${orgId}/appointments/${id}`)
      .set(bearer(owner))
      .send({ notes: 'ghi chú mới' })
      .expect(200);
    expect(patched.body.occasion).toEqual(want);

    const moved = await request(app)
      .post(`/api/v1/orgs/${orgId}/appointments/${id}/status`)
      .set(bearer(owner))
      .set('Idempotency-Key', randomUUID())
      .send({ to: 'CONFIRMED' });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(moved.body.occasion).toEqual(want);
  });

  it('đổi màu loại → ca trả màu MỚI; đổi tên loại → ca giữ tên bản chụp trên dòng', async () => {
    const created = await postAppt({
      startsAt: at(4, '08:00'),
      endsAt: at(4, '09:00'),
      contractId,
      contractLineId: lineWithOcc,
      staff: [{ membershipId: mA, role: 'PRIMARY' }],
      status: 'DRAFT',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.occasion.color).toBe('amber');
    try {
      await db.occasion.update({ where: { id: occId }, data: { color: 'petrol', name: 'Tên mới của loại' } });
      const one = await request(app).get(`/api/v1/orgs/${orgId}/appointments/${created.body.id}`).set(bearer(owner)).expect(200);
      expect(one.body.occasion).toEqual({ id: occId, name: OCC_NAME, color: 'petrol' });
      const list = await listDay(4).expect(200);
      const row = (list.body.items as { id: string; occasion: { color: string; name: string } }[]).find((r) => r.id === created.body.id);
      expect(row?.occasion).toEqual({ id: occId, name: OCC_NAME, color: 'petrol' });
    } finally {
      await db.occasion.update({ where: { id: occId }, data: { color: 'amber', name: OCC_NAME } });
    }
  });

  it('ca lẻ (không hợp đồng) và ca gắn dòng chưa chọn sự kiện → occasion = null', async () => {
    const solo = await postAppt({
      startsAt: at(5, '08:00'),
      endsAt: at(5, '09:00'),
      title: 'Ca lẻ',
      staff: [{ membershipId: mA, role: 'PRIMARY' }],
      status: 'DRAFT',
    });
    expect(solo.status, JSON.stringify(solo.body)).toBe(201);
    expect(solo.body.occasion).toBeNull();

    const noOcc = await postAppt({
      startsAt: at(5, '10:00'),
      endsAt: at(5, '11:00'),
      contractId,
      contractLineId: lineNoOcc,
      staff: [{ membershipId: mA, role: 'PRIMARY' }],
      status: 'DRAFT',
    });
    expect(noOcc.status, JSON.stringify(noOcc.body)).toBe(201);
    expect(noOcc.body.occasion).toBeNull();

    const list = await listDay(5).expect(200);
    const items = list.body.items as { id: string; occasion: unknown }[];
    expect(items.find((r) => r.id === solo.body.id)?.occasion).toBeNull();
    expect(items.find((r) => r.id === noOcc.body.id)?.occasion).toBeNull();
  });

  it('thợ (chỉ schedule.read_own) đọc được occasion của ca MÌNH; ca của thợ khác không hiện', async () => {
    const mine = await postAppt({
      startsAt: at(6, '08:00'),
      endsAt: at(6, '09:00'),
      contractId,
      contractLineId: lineWithOcc,
      staff: [{ membershipId: mA, role: 'PRIMARY' }],
      status: 'DRAFT',
    });
    expect(mine.status, JSON.stringify(mine.body)).toBe(201);

    const list = await listDay(6, artistA).expect(200);
    const row = (list.body.items as { id: string; occasion: unknown }[]).find((r) => r.id === mine.body.id);
    expect(row?.occasion).toEqual({ id: occId, name: OCC_NAME, color: 'amber' });
    const one = await request(app).get(`/api/v1/orgs/${orgId}/appointments/${mine.body.id}`).set(bearer(artistA)).expect(200);
    expect(one.body.occasion).toEqual({ id: occId, name: OCC_NAME, color: 'amber' });

    // Thợ B không được phân → không thấy ca (và không lộ sự kiện qua danh sách / xem một).
    const otherList = await listDay(6, artistB).expect(200);
    expect(JSON.stringify(otherList.body)).not.toContain(OCC_NAME);
    await request(app).get(`/api/v1/orgs/${orgId}/appointments/${mine.body.id}`).set(bearer(artistB)).expect(404);
  });
});

describe('cách ly tổ chức', () => {
  it('database chặn dòng hợp đồng trỏ loại sự kiện của tổ chức khác (khoá ngoại kép)', async () => {
    const customer = await db.customer.create({ data: { organizationId: orgId, fullName: 'Khách chéo' } });
    const contract = await db.contract.create({
      data: { organizationId: orgId, code: `HD-${randomUUID().slice(0, 8)}`, customerId: customer.id, createdById: owner.id },
    });
    const service = await db.service.findFirstOrThrow({ where: { organizationId: orgId } });
    await expect(
      db.contractLine.create({
        data: {
          organizationId: orgId,
          contractId: contract.id,
          kind: 'SERVICE',
          serviceId: service.id,
          name: 'Dòng chéo',
          unitPrice: 0n,
          lineTotal: 0n,
          createdById: owner.id,
          occasionId: otherOccId,
          occasionName: SECRET_NAME,
        },
      }),
    ).rejects.toThrow();
  });

  it('lịch của tổ chức khác không chứa sự kiện của tổ chức này, và ngược lại; ca tổ chức này không đọc được từ tổ chức khác', async () => {
    const mineAppt = await postAppt({
      startsAt: at(7, '08:00'),
      endsAt: at(7, '09:00'),
      contractId,
      contractLineId: lineWithOcc,
      staff: [{ membershipId: mA, role: 'PRIMARY' }],
      status: 'DRAFT',
    });
    expect(mineAppt.status, JSON.stringify(mineAppt.body)).toBe(201);

    // Tổ chức khác tạo ca lẻ cùng ngày.
    const otherMember = await db.membership.findFirstOrThrow({ where: { organizationId: otherOrgId, userId: otherOwner.id } });
    const theirs = await postAppt(
      { startsAt: at(7, '08:00'), endsAt: at(7, '09:00'), title: 'Ca tổ chức khác', staff: [{ membershipId: otherMember.id, role: 'PRIMARY' }], status: 'DRAFT' },
      otherOwner,
      otherOrgId,
    );
    expect(theirs.status, JSON.stringify(theirs.body)).toBe(201);
    expect(theirs.body.occasion).toBeNull();

    const theirList = await listDay(7, otherOwner, otherOrgId).expect(200);
    const text = JSON.stringify(theirList.body);
    expect(text).not.toContain(OCC_NAME);
    expect(text).not.toContain(occId);
    expect(text).not.toContain(SECRET_NAME);

    const myList = await listDay(7).expect(200);
    const mine = JSON.stringify(myList.body);
    expect(mine).not.toContain(SECRET_NAME);
    expect(mine).not.toContain(otherOccId);

    // Đọc ca của tổ chức này bằng đường của tổ chức khác → không thấy.
    await request(app).get(`/api/v1/orgs/${otherOrgId}/appointments/${mineAppt.body.id}`).set(bearer(otherOwner)).expect(404);
    // Chủ tổ chức khác gọi đường tổ chức này → bị chặn.
    const cross = await request(app).get(`/api/v1/orgs/${orgId}/appointments/${mineAppt.body.id}`).set(bearer(otherOwner));
    expect([403, 404]).toContain(cross.status);
    expect(JSON.stringify(cross.body)).not.toContain(OCC_NAME);
  });
});
