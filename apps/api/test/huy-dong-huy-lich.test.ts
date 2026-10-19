// N1 (biên bản nghiệm thu lần 4): huỷ một dòng của hợp đồng ĐÃ xác nhận thì ca của dòng đó vẫn nằm trên Lịch, vẫn
// "Đã xác nhận", vẫn giữ giờ của thợ, Lịch còn nhắc "Phân thợ". Gốc: POST …/contracts/:id/lines/:lineId/void
// (modules/contracts/routes.ts) đánh dấu dòng, trả chỗ khoá học, tính lại tiền nhưng không đụng bảng appointments.
// Sửa: huỷ dòng thì huỷ (KHÔNG xoá) mọi lịch chưa huỷ gắn dòng đó và các dòng con, cùng transaction, ghi nhật ký
// (modules/contracts/lineAppointments.ts — cùng luật với huỷ cả hợp đồng: lịch đang làm dở → 409, không đổi gì).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';
import { createAppointmentTx } from '../src/modules/schedule/service';

const deps = makeDeps();
const db = deps.db;
let app: App;

afterAll(async () => {
  await db.$disconnect();
});

const idem = () => `n1-${randomUUID()}`;
const url = (orgId: string, rest = '') => `/api/v1/orgs/${orgId}${rest}`;

let owner: TestUser;
let orgId: string;
let customerId: string;
let party: string;
let hair: string;
let artist: string;
let artist2: string;
let day = 0;

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'n1-chu');
  orgId = await createOrg(app, owner, 'n1');
  const at = new Date(Date.now() - 60_000);
  const svc = async (code: string, name: string, kind: 'MAIN' | 'ADDON', price: bigint) => {
    const s = await db.service.create({ data: { organizationId: orgId, code, name, kind, durationMinutes: 60 } });
    await db.priceVersion.create({ data: { organizationId: orgId, serviceId: s.id, listPrice: price, effectiveFrom: at, createdById: owner.id } });
    return s.id;
  };
  party = await svc('MK-TIEC', 'Makeup tiệc', 'MAIN', 800_000n);
  hair = await svc('TOC', 'Làm tóc', 'ADDON', 300_000n);
  await db.studioLocation.create({ data: { organizationId: orgId, name: 'Studio', address: '1 Lê Lợi', isDefault: true } });
  customerId = (await db.customer.create({ data: { organizationId: orgId, fullName: 'Hoàng Minh Thư' } })).id;
  artist = await addMember(app, owner, orgId, await registerUser(app, 'n1-tho'), ['artist']);
  artist2 = await addMember(app, owner, orgId, await registerUser(app, 'n1-tho2'), ['artist']);
});

// Mỗi hợp đồng một ngày riêng để các ca không trùng giờ thợ giữa các bài.
function slot(hourStart: number, hours = 1) {
  const d = new Date(Date.UTC(2027, 4, 1 + day));
  const s = new Date(d.getTime() + hourStart * 3_600_000);
  return { scheduledStart: s.toISOString(), scheduledEnd: new Date(s.getTime() + hours * 3_600_000).toISOString() };
}
const timed = (hourStart: number, extra: object = {}) => ({ kind: 'SERVICE', serviceId: party, quantity: 1, ...slot(hourStart), ...extra });

const create = (lines: object[]) =>
  request(app).post(url(orgId, '/contracts')).set(bearer(owner)).set('idempotency-key', idem()).send({ customerId, lines });
const confirm = (id: string) => request(app).post(url(orgId, `/contracts/${id}/status`)).set(bearer(owner)).send({ to: 'CONFIRMED' });
const voidLine = (id: string, lineId: string, reason = 'Khách bớt một người') =>
  request(app).post(url(orgId, `/contracts/${id}/lines/${lineId}/void`)).set(bearer(owner)).send({ reason });
const addLine = (id: string, line: object) =>
  request(app).post(url(orgId, `/contracts/${id}/lines`)).set(bearer(owner)).set('idempotency-key', idem()).send(line);
const apptStatus = (id: string, to: string, reason?: string) =>
  request(app).post(url(orgId, `/appointments/${id}/status`)).set(bearer(owner)).send({ to, ...(reason ? { reason } : {}) });

async function confirmed(lines: object[]) {
  day += 1;
  const c = (await create(lines).expect(201)).body;
  await confirm(c.id).expect(200);
  return c as { id: string; lines: { id: string }[] };
}

const apptOf = (lineId: string) => db.appointment.findMany({ where: { organizationId: orgId, contractLineId: lineId }, include: { staff: true } });

describe('N1 — BẮT: huỷ dòng của hợp đồng đã xác nhận thì huỷ ca của dòng', () => {
  it('bài tái hiện: hai dòng có giờ, huỷ dòng 2 → ca dòng 2 "Đã huỷ" (không xoá), ca dòng 1 giữ nguyên; tổng giảm đúng', async () => {
    const c = await confirmed([timed(1, { staff: [{ membershipId: artist }] }), timed(8)]);
    const [l1, l2] = c.lines;
    const [a1] = await apptOf(l1!.id);
    const [a2] = await apptOf(l2!.id);
    expect(a1!.status).toBe('CONFIRMED');
    expect(a2!.status).toBe('CONFIRMED');
    const before = await db.appointment.count({ where: { contractId: c.id } });
    const r = await voidLine(c.id, l2!.id);
    const after2 = await db.appointment.findUniqueOrThrow({ where: { id: a2!.id } });
    console.log(`[N1 huỷ dòng] void → ${r.status}; ca dòng đã huỷ: ${after2.status} ⇒ ${after2.status === 'CONFIRMED' ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
    expect(r.status).toBe(200);
    expect(after2.status).toBe('CANCELLED');
    expect(after2.cancelReason).toBe('Khách bớt một người');
    expect(await db.appointment.count({ where: { contractId: c.id } })).toBe(before); // huỷ, không xoá
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a1!.id } })).status).toBe('CONFIRMED');
    expect(r.body.total).toBe(800_000);
    // Chi tiết hợp đồng trả về cũng thấy ca đã huỷ.
    expect(r.body.appointments.find((a: { id: string }) => a.id === a2!.id).status).toBe('CANCELLED');
  });

  it('ca đã có thợ: huỷ dòng trả giờ của thợ (thôi chiếm giờ) — lập ca khác đúng giờ đó cho cùng thợ được', async () => {
    const c = await confirmed([timed(2, { staff: [{ membershipId: artist }] })]);
    // Thêm một dòng để hợp đồng còn dòng hiệu lực sau khi huỷ dòng đầu.
    await addLine(c.id, timed(10)).expect(201);
    const [a] = await apptOf(c.lines[0]!.id);
    expect(a!.staff.every((s) => s.isBlocking)).toBe(true);
    await voidLine(c.id, c.lines[0]!.id).expect(200);
    const staff = await db.appointmentStaff.findMany({ where: { appointmentId: a!.id } });
    expect(staff.length).toBe(1);
    expect(staff.every((s) => !s.isBlocking)).toBe(true);
    const again = await request(app)
      .post(url(orgId, '/appointments'))
      .set(bearer(owner))
      .set('idempotency-key', idem())
      .send({ kind: 'MAKEUP', title: 'Ca thay', customerId, startsAt: a!.startsAt.toISOString(), endsAt: a!.endsAt.toISOString(), staff: [{ membershipId: artist }], status: 'CONFIRMED' });
    expect(again.status).toBe(201);
  });

  it('nhật ký: lịch có lịch sử trạng thái + appointment.status_changed (via contract.line_voided); hợp đồng ghi cancelledAppointmentIds', async () => {
    const c = await confirmed([timed(1), timed(5)]);
    const [a] = await apptOf(c.lines[1]!.id);
    await voidLine(c.id, c.lines[1]!.id, 'Khách đổi ý').expect(200);
    const hist = await db.appointmentStatusHistory.findMany({ where: { appointmentId: a!.id }, orderBy: { changedAt: 'asc' } });
    expect(hist.at(-1)).toMatchObject({ fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', reason: 'Khách đổi ý', changedById: owner.id });
    const apptAudit = await db.auditLog.findFirst({ where: { organizationId: orgId, entityId: a!.id, action: 'appointment.status_changed' } });
    expect(apptAudit?.data).toMatchObject({ to: 'CANCELLED', via: 'contract.line_voided', contractId: c.id, contractLineId: c.lines[1]!.id });
    const cAudit = await db.auditLog.findFirst({ where: { organizationId: orgId, entityId: c.id, action: 'contract.line_voided' } });
    expect(cAudit?.data).toMatchObject({ cancelledAppointmentIds: [a!.id] });
  });

  it('dòng phát sinh thêm sau xác nhận (có lịch ngay) — huỷ dòng phát sinh thì huỷ ca của nó', async () => {
    const c = await confirmed([timed(1)]);
    const added = (await addLine(c.id, timed(15, { staff: [{ membershipId: artist2 }] })).expect(201)).body;
    expect(added.createdAppointments).toHaveLength(1);
    const newLine = added.createdAppointments[0].contractLineId ?? (await db.appointment.findUniqueOrThrow({ where: { id: added.createdAppointments[0].id } })).contractLineId;
    await voidLine(c.id, newLine).expect(200);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: added.createdAppointments[0].id } })).status).toBe('CANCELLED');
  });

  it('dòng con (dịch vụ phụ) có lịch gắn: huỷ dòng cha thì lịch của dòng con cũng huỷ', async () => {
    const c = await confirmed([timed(1), timed(5, { addons: [{ serviceId: hair, quantity: 1 }] })]);
    const parent = c.lines[1]!.id;
    const child = await db.contractLine.findFirstOrThrow({ where: { parentLineId: parent } });
    // Mã hiện tại không tự sinh lịch cho dòng con; dữ liệu lịch gắn dòng con vẫn hợp lệ ở database → phải huỷ theo.
    const childAppt = await db.$transaction((tx) =>
      createAppointmentTx(tx, { orgId, userId: owner.id, requestId: 'n1-child' }, {
        kind: 'MAKEUP',
        title: 'Làm tóc',
        customerId,
        contractId: c.id,
        contractLineId: child.id,
        startsAt: new Date(slot(7).scheduledStart),
        endsAt: new Date(slot(7).scheduledEnd),
        travelBeforeMin: 0,
        travelAfterMin: 0,
        locationType: 'STUDIO',
        address: null,
        latitude: null,
        longitude: null,
        staff: [],
        status: 'CONFIRMED',
      }),
    );
    await voidLine(c.id, parent).expect(200);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: childAppt.id } })).status).toBe('CANCELLED');
    expect((await db.contractLine.findUniqueOrThrow({ where: { id: child.id } })).voidedAt).not.toBeNull();
  });

  it('ca của dòng đang làm dở (IN_PROGRESS) → 409 nêu mã ca, KHÔNG đổi gì: dòng chưa huỷ, tổng giữ, ca giữ', async () => {
    const c = await confirmed([timed(1), timed(5)]);
    const [a] = await apptOf(c.lines[1]!.id);
    await apptStatus(a!.id, 'IN_PROGRESS').expect(200);
    const totalBefore = (await db.contract.findUniqueOrThrow({ where: { id: c.id } })).total;
    const r = await voidLine(c.id, c.lines[1]!.id);
    expect(r.status).toBe(409);
    expect(r.body.error.message).toBe(`Còn lịch đang thực hiện của dòng này: ${a!.code} (Đang làm) — xử lý xong lịch trước khi huỷ dòng`);
    expect(r.body.error.details).toEqual({ appointments: [{ id: a!.id, code: a!.code, status: 'IN_PROGRESS' }] });
    expect((await db.contractLine.findUniqueOrThrow({ where: { id: c.lines[1]!.id } })).voidedAt).toBeNull();
    expect((await db.contract.findUniqueOrThrow({ where: { id: c.id } })).total).toBe(totalBefore);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a!.id } })).status).toBe('IN_PROGRESS');
  });
});

describe('N1 — GIỮ: các trường hợp khác không đổi', () => {
  it('ca của dòng đã huỷ trước ở Lịch / đã hoàn thành: giữ nguyên, không ghi thêm lịch sử', async () => {
    const c = await confirmed([timed(1), timed(5), timed(9)]);
    const [cancelled] = await apptOf(c.lines[1]!.id);
    await apptStatus(cancelled!.id, 'CANCELLED', 'Huỷ ở Lịch trước').expect(200);
    const [done] = await apptOf(c.lines[2]!.id);
    await apptStatus(done!.id, 'IN_PROGRESS').expect(200);
    await apptStatus(done!.id, 'COMPLETED').expect(200);
    const histBefore = await db.appointmentStatusHistory.count({ where: { appointmentId: { in: [cancelled!.id, done!.id] } } });
    await voidLine(c.id, c.lines[1]!.id).expect(200);
    await voidLine(c.id, c.lines[2]!.id).expect(200);
    const a1 = await db.appointment.findUniqueOrThrow({ where: { id: cancelled!.id } });
    expect(a1).toMatchObject({ status: 'CANCELLED', cancelReason: 'Huỷ ở Lịch trước' });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: done!.id } })).status).toBe('COMPLETED');
    expect(await db.appointmentStatusHistory.count({ where: { appointmentId: { in: [cancelled!.id, done!.id] } } })).toBe(histBefore);
    // Ca của dòng còn lại không bị đụng.
    expect((await apptOf(c.lines[0]!.id))[0]!.status).toBe('CONFIRMED');
  });

  it('dòng không có lịch (dòng tự nhập) và hợp đồng nháp: huỷ dòng như cũ, không lịch nào đổi', async () => {
    day += 1;
    const draft = (await create([timed(1), { kind: 'CUSTOM', name: 'Phí giữ váy', unitPrice: 100_000, quantity: 1 }]).expect(201)).body;
    const r = await voidLine(draft.id, draft.lines[1].id);
    expect(r.status).toBe(200);
    expect(await db.appointment.count({ where: { contractId: draft.id } })).toBe(0);
    const c = await confirmed([timed(1), { kind: 'CUSTOM', name: 'Phí giữ váy', unitPrice: 100_000, quantity: 1 }]);
    await voidLine(c.id, c.lines[1]!.id).expect(200);
    expect((await apptOf(c.lines[0]!.id))[0]!.status).toBe('CONFIRMED');
  });

  it('huỷ cả hợp đồng sau khi đã huỷ một dòng: ca còn lại huỷ theo, ca đã huỷ theo dòng giữ lý do cũ', async () => {
    const c = await confirmed([timed(1), timed(5)]);
    const [a1] = await apptOf(c.lines[0]!.id);
    const [a2] = await apptOf(c.lines[1]!.id);
    await voidLine(c.id, c.lines[1]!.id, 'Bớt người').expect(200);
    const r = await request(app).post(url(orgId, `/contracts/${c.id}/status`)).set(bearer(owner)).send({ to: 'CANCELLED', reason: 'Khách huỷ cưới' });
    expect(r.status).toBe(200);
    expect(r.body.cancelledAppointments.map((x: { id: string }) => x.id)).toEqual([a1!.id]);
    expect(await db.appointment.findUniqueOrThrow({ where: { id: a2!.id } })).toMatchObject({ status: 'CANCELLED', cancelReason: 'Bớt người' });
  });
});
