// N2 (biên bản nghiệm thu cuối) — quyết định điều phối 01:40: CHẶN xác nhận khi còn dòng CẦN LÊN LỊCH mà thiếu giờ.
// Trước khi sửa: hợp đồng dịch vụ 1 dòng gói, không giờ, không thợ → xác nhận 200 "Không có lịch nào được tạo", Lịch 0 ca,
// và ô giờ của dòng đã chốt bị khoá vĩnh viễn (gốc: modules/contracts/routes.ts createLineAppointments chỉ lấy dòng có giờ
// HOẶC có thợ, dòng không cả hai bị bỏ qua im lặng).
// "Dòng cần lên lịch" theo mã hiện có = dòng chưa huỷ loại PACKAGE / SERVICE (loại dòng duy nhất mang giờ, nơi, thợ —
// contracts/schemas.ts `placement`). Phụ phí (SURCHARGE), dòng tự nhập (CUSTOM), dịch vụ phụ / phí di chuyển (dòng con) và
// dòng khoá học (COURSE) không lên lịch → không áp. Luật S1 (nhật ký 22:10) giữ nguyên: dòng có giờ mà chưa thợ vẫn sinh lịch.
// Mọi cửa sinh lịch từ hợp đồng đều qua createLineAppointments: (1) POST …/status to=CONFIRMED, (2) POST …/lines vào hợp
// đồng ĐÃ xác nhận. Hai cửa cùng một luật, cùng một hình dạng lỗi:
//   409 CONFLICT, details = { reason: 'LINES_MISSING_TIME', lineIds: string[], lines: [{ id, name, subjectName, missing }] }.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createAcademyOrg, createOrg, grantUnlimitedPlan, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

afterAll(async () => {
  await db.$disconnect();
});

const idem = () => `n2-${randomUUID()}`;
const url = (orgId: string, rest = '') => `/api/v1/orgs/${orgId}/contracts${rest}`;

let owner: TestUser;
let orgId: string;
let customerId: string;
let pkg: string;
let party: string;
let early: string;
let bridesmaid: string;
let artist: string;

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'n2-chu');
  orgId = await createOrg(app, owner, 'n2');
  const at = new Date(Date.now() - 60_000);
  const svc = async (code: string, name: string, kind: 'MAIN' | 'SURCHARGE', price: bigint) => {
    const s = await db.service.create({ data: { organizationId: orgId, code, name, kind, durationMinutes: 60 } });
    await db.priceVersion.create({ data: { organizationId: orgId, serviceId: s.id, listPrice: price, effectiveFrom: at, createdById: owner.id } });
    return s.id;
  };
  party = await svc('MK-TIEC', 'Makeup tiệc', 'MAIN', 800_000n);
  early = await svc('CA-SOM', 'Ca sớm', 'SURCHARGE', 200_000n);
  const p = await db.servicePackage.create({
    data: { organizationId: orgId, code: 'PHU-DAU', name: 'Gói phù dâu', durationMinutes: 120, depositAmount: 0n, locationTypes: [] },
  });
  await db.priceVersion.create({ data: { organizationId: orgId, packageId: p.id, listPrice: 1_000_000n, effectiveFrom: at, createdById: owner.id } });
  pkg = p.id;
  await db.studioLocation.create({ data: { organizationId: orgId, name: 'Studio', address: '1 Lê Lợi', isDefault: true } });
  const subjects = await db.makeupSubject.findMany({ where: { organizationId: orgId } });
  bridesmaid = subjects.find((s) => s.name === 'Phù dâu')!.id;
  customerId = (await db.customer.create({ data: { organizationId: orgId, fullName: 'Hoàng Minh Thư' } })).id;
  artist = await addMember(app, owner, orgId, await registerUser(app, 'n2-tho'), ['artist']);
});

const create = (body: object) => request(app).post(url(orgId)).set(bearer(owner)).set('idempotency-key', idem()).send({ customerId, ...body });
const confirm = (id: string) => request(app).post(url(orgId, `/${id}/status`)).set(bearer(owner)).send({ to: 'CONFIRMED' });
const addLine = (id: string, line: object) => request(app).post(url(orgId, `/${id}/lines`)).set(bearer(owner)).set('idempotency-key', idem()).send(line);
const timed = (start: string, end: string, extra: object = {}) => ({ kind: 'SERVICE', serviceId: party, quantity: 1, scheduledStart: start, scheduledEnd: end, ...extra });

// Ảnh chụp mọi thứ một lần xác nhận có thể đổi: hợp đồng, dòng, lịch, ghi danh, nhật ký.
async function snapshot(contractId: string) {
  const c = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  return {
    status: c.status,
    confirmedAt: c.confirmedAt,
    updatedAt: c.updatedAt.toISOString(),
    total: c.total,
    termsTemplateId: c.termsTemplateId,
    lines: await db.contractLine.count({ where: { contractId } }),
    appointments: await db.appointment.count({ where: { contractId } }),
    audits: await db.auditLog.count({ where: { organizationId: orgId, entityId: contractId } }),
  };
}

describe('N2 — BẮT: xác nhận khi dòng cần lên lịch thiếu giờ', () => {
  it('bài tái hiện của thợ chấm: 1 dòng gói Phù dâu, không giờ, không thợ → 409 LINES_MISSING_TIME, database không đổi gì', async () => {
    const c = (await create({ eventDate: '2026-12-06T00:00:00+07:00', lines: [{ kind: 'PACKAGE', packageId: pkg, subjectId: bridesmaid, quantity: 1 }] }).expect(201)).body;
    const before = await snapshot(c.id);
    const r = await confirm(c.id);
    const after = await snapshot(c.id);
    console.log(`[N2 xác nhận không giờ] xác nhận → ${r.status} ${r.body.error?.message ?? ''}; lịch ${after.appointments} ⇒ ${r.status === 200 ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CONFLICT');
    expect(r.body.error.message).toBe(
      'Dòng "Gói phù dâu — Phù dâu" chưa có giờ bắt đầu và giờ kết thúc — nhập giờ cho mọi dòng trước khi xác nhận hợp đồng',
    );
    expect(r.body.error.details).toEqual({
      reason: 'LINES_MISSING_TIME',
      lineIds: [c.lines[0].id],
      lines: [{ id: c.lines[0].id, name: 'Gói phù dâu', subjectName: 'Phù dâu', missing: ['scheduledStart', 'scheduledEnd'] }],
    });
    expect(after).toEqual(before);
    expect(after.status).toBe('DRAFT');
  });

  it('nhiều dòng: chỉ liệt kê đúng dòng PACKAGE/SERVICE thiếu giờ (theo thứ tự dòng), nêu thiếu trường nào; dòng có giờ cũng KHÔNG sinh lịch (quay lui)', async () => {
    const c = (
      await create({
        lines: [
          timed('2027-03-01T01:00:00Z', '2027-03-01T02:00:00Z'),
          { kind: 'SERVICE', serviceId: party, subjectId: bridesmaid, quantity: 1 },
          { kind: 'SURCHARGE', serviceId: early, quantity: 1 },
          { kind: 'CUSTOM', name: 'Phí giữ váy', unitPrice: 100_000, quantity: 1 },
          { kind: 'SERVICE', serviceId: party, quantity: 1, scheduledStart: '2027-03-01T05:00:00Z' },
        ],
      }).expect(201)
    ).body;
    const before = await snapshot(c.id);
    const r = await confirm(c.id);
    expect(r.status).toBe(409);
    expect(r.body.error.message).toBe(
      '2 dòng chưa có đủ giờ bắt đầu và giờ kết thúc: "Makeup tiệc — Phù dâu", "Makeup tiệc" — nhập giờ cho mọi dòng trước khi xác nhận hợp đồng',
    );
    expect(r.body.error.details).toEqual({
      reason: 'LINES_MISSING_TIME',
      lineIds: [c.lines[1].id, c.lines[4].id],
      lines: [
        { id: c.lines[1].id, name: 'Makeup tiệc', subjectName: 'Phù dâu', missing: ['scheduledStart', 'scheduledEnd'] },
        { id: c.lines[4].id, name: 'Makeup tiệc', subjectName: null, missing: ['scheduledEnd'] },
      ],
    });
    expect(await snapshot(c.id)).toEqual(before);
  });

  it('dòng có thợ mà thiếu giờ (dữ liệu ghi thẳng) → cùng luật, cùng hình dạng lỗi 409', async () => {
    const c = (await create({ lines: [{ kind: 'SERVICE', serviceId: party, quantity: 1 }] }).expect(201)).body;
    await db.contractLineStaff.create({ data: { organizationId: orgId, lineId: c.lines[0].id, membershipId: artist, role: 'PRIMARY' } });
    const r = await confirm(c.id);
    expect(r.status).toBe(409);
    expect(r.body.error.details).toMatchObject({ reason: 'LINES_MISSING_TIME', lineIds: [c.lines[0].id] });
    expect((await snapshot(c.id)).status).toBe('DRAFT');
  });

  it('cửa thứ hai — thêm dòng phát sinh vào hợp đồng ĐÃ xác nhận mà thiếu giờ → 409 cùng hình dạng, không thêm dòng, không đổi tiền', async () => {
    const c = (await create({ lines: [timed('2027-03-02T01:00:00Z', '2027-03-02T02:00:00Z')] }).expect(201)).body;
    await confirm(c.id).expect(200);
    const before = await snapshot(c.id);
    const none = await addLine(c.id, { kind: 'PACKAGE', packageId: pkg, subjectId: bridesmaid, quantity: 1 });
    console.log(`[N2 phát sinh không giờ] thêm dòng → ${none.status} ⇒ ${none.status === 201 ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
    expect(none.status).toBe(409);
    expect(none.body.error.message).toBe(
      'Dòng "Gói phù dâu — Phù dâu" chưa có giờ bắt đầu và giờ kết thúc — nhập giờ cho dòng phát sinh trước khi thêm vào hợp đồng đã xác nhận',
    );
    expect(none.body.error.details).toMatchObject({
      reason: 'LINES_MISSING_TIME',
      lines: [{ name: 'Gói phù dâu', subjectName: 'Phù dâu', missing: ['scheduledStart', 'scheduledEnd'] }],
    });
    expect(none.body.error.details.lineIds).toHaveLength(1);
    const half = await addLine(c.id, { kind: 'SERVICE', serviceId: party, quantity: 1, scheduledStart: '2027-03-02T05:00:00Z' });
    expect(half.status).toBe(409);
    expect(half.body.error.details.lines[0].missing).toEqual(['scheduledEnd']);
    expect(await snapshot(c.id)).toEqual(before);
  });
});

describe('N2 — GIỮ: những gì không được chặn', () => {
  it('mọi dòng PACKAGE/SERVICE có giờ (một dòng chưa thợ — S1), phụ phí và dòng tự nhập không giờ → xác nhận 200, mỗi dòng có giờ một lịch', async () => {
    const c = (
      await create({
        lines: [
          timed('2027-04-01T01:00:00Z', '2027-04-01T02:00:00Z', { staff: [{ membershipId: artist, role: 'PRIMARY' }] }),
          { kind: 'PACKAGE', packageId: pkg, quantity: 1, scheduledStart: '2027-04-01T03:00:00Z', scheduledEnd: '2027-04-01T05:00:00Z' },
          { kind: 'SURCHARGE', serviceId: early, quantity: 1 },
          { kind: 'CUSTOM', name: 'Phí giữ váy', unitPrice: 100_000, quantity: 1 },
        ],
      }).expect(201)
    ).body;
    const r = await confirm(c.id).expect(200);
    expect(r.body.status).toBe('CONFIRMED');
    expect(r.body.createdAppointments).toHaveLength(2);
    const appts = await db.appointment.findMany({ where: { contractId: c.id }, include: { staff: true }, orderBy: { startsAt: 'asc' } });
    expect(appts.map((a) => [a.contractLineId, a.staff.length])).toEqual([
      [c.lines[0].id, 1],
      [c.lines[1].id, 0],
    ]);
    // Phát sinh phụ phí (không lên lịch) vào hợp đồng đã xác nhận: không bị luật giờ chặn.
    await addLine(c.id, { kind: 'SURCHARGE', serviceId: early, quantity: 1 }).expect(201);
    await addLine(c.id, { kind: 'CUSTOM', name: 'Phụ kiện', unitPrice: 50_000, quantity: 1 }).expect(201);
  });

  it('dòng thiếu giờ đã HUỶ trước khi xác nhận không chặn', async () => {
    const c = (
      await create({ lines: [timed('2027-04-02T01:00:00Z', '2027-04-02T02:00:00Z'), { kind: 'SERVICE', serviceId: party, quantity: 1 }] }).expect(201)
    ).body;
    await request(app).post(url(orgId, `/${c.id}/lines/${c.lines[1].id}/void`)).set(bearer(owner)).send({ reason: 'Khách bỏ' }).expect(200);
    const r = await confirm(c.id).expect(200);
    expect(r.body.createdAppointments).toHaveLength(1);
  });

  it('hợp đồng KHOÁ HỌC (dòng COURSE không có giờ) xác nhận như cũ — luật không áp', async () => {
    const aOwner = await registerUser(app, 'n2-hv');
    const aOrg = await createAcademyOrg(app, aOwner, 'n2-hv');
    await grantUnlimitedPlan(db, aOrg);
    const course = await db.course.create({
      data: { organizationId: aOrg, code: `KH-${randomUUID().slice(0, 6)}`, name: 'Khoá cơ bản', mode: 'MULTI_CLASS', tuitionFee: 3_000_000n, defaultCapacity: 5, createdById: aOwner.id },
    });
    const cls = await db.courseClass.create({
      data: { organizationId: aOrg, courseId: course.id, name: 'K1', startDate: new Date('2027-02-01'), endDate: new Date('2027-03-01'), weekdays: [2], capacity: 5, createdById: aOwner.id },
    });
    const student = (await db.customer.create({ data: { organizationId: aOrg, fullName: 'Học viên' } })).id;
    const c = (
      await request(app)
        .post(url(aOrg))
        .set(bearer(aOwner))
        .set('idempotency-key', idem())
        .send({ kind: 'COURSE', customerId: student, lines: [{ kind: 'COURSE', courseClassId: cls.id }, { kind: 'CUSTOM', name: 'Giáo trình', unitPrice: 100_000, quantity: 1 }] })
        .expect(201)
    ).body;
    const r = await request(app).post(url(aOrg, `/${c.id}/status`)).set(bearer(aOwner)).send({ to: 'CONFIRMED' });
    expect([r.status, r.body.status]).toEqual([200, 'CONFIRMED']);
  });

  it('hợp đồng đã xác nhận CŨ có dòng thiếu giờ (dữ liệu trước bản sửa): không tự đổi; vẫn thêm phát sinh có giờ được; chủ sửa được bằng (a) gắn lịch cho dòng ở Lịch, hoặc (b) huỷ dòng + thêm phát sinh có giờ', async () => {
    const c = (
      await create({ lines: [{ kind: 'PACKAGE', packageId: pkg, subjectId: bridesmaid, quantity: 1 }, { kind: 'SERVICE', serviceId: party, quantity: 1 }] }).expect(201)
    ).body;
    // Mô phỏng hợp đồng đã chốt bằng bản cũ (trước khi có chốt chặn): ghi thẳng trạng thái.
    await db.contract.update({ where: { id: c.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
    // Phát sinh có giờ: chỉ xét dòng MỚI, dòng cũ thiếu giờ không chặn.
    const add = await addLine(c.id, timed('2027-05-01T01:00:00Z', '2027-05-01T02:00:00Z'));
    expect(add.status).toBe(201);
    expect(add.body.createdAppointments).toHaveLength(1);
    // (a) Không đổi tiền: tạo lịch ở màn Lịch gắn đúng dòng (contractId + contractLineId).
    const appt = await request(app)
      .post(`/api/v1/orgs/${orgId}/appointments`)
      .set(bearer(owner))
      .set('idempotency-key', idem())
      .send({
        contractId: c.id,
        contractLineId: c.lines[0].id,
        customerId,
        startsAt: '2027-05-01T03:00:00.000Z',
        endsAt: '2027-05-01T05:00:00.000Z',
        status: 'CONFIRMED',
      });
    expect(appt.status).toBe(201);
    expect(appt.body.contractLineId).toBe(c.lines[0].id);
    // (b) Huỷ dòng (cần contracts.adjust) rồi thêm phát sinh có giờ → lên lịch ngay.
    await request(app).post(url(orgId, `/${c.id}/lines/${c.lines[1].id}/void`)).set(bearer(owner)).send({ reason: 'Nhập lại có giờ' }).expect(200);
    const again = await addLine(c.id, timed('2027-05-01T06:00:00Z', '2027-05-01T07:00:00Z'));
    expect(again.status).toBe(201);
    expect(again.body.createdAppointments).toHaveLength(1);
    expect(await db.appointment.count({ where: { contractId: c.id, status: 'CONFIRMED' } })).toBe(3);
  });
});
