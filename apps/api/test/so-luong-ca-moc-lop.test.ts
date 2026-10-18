// Hai phiếu vướng của thợ Y4 (thợ Y5 sửa):
//  L7 — mọi cửa trả lịch có thêm `quantity`: số lượng của dòng hợp đồng gắn với ca (phù dâu 2 người → 2), để màn Lịch ghi
//       "× 2". Ca không gắn dòng hợp đồng → null. Phủ 5/5 cửa trả lịch: POST tạo, GET một lịch, GET danh sách, PATCH sửa,
//       POST đổi trạng thái.
//  T1 — GET /contracts/:id/payments (và PUT tiến độ, cùng hàm loadProgress) trả `contract.courseEndDate`: ngày kết thúc lớp
//       MUỘN NHẤT của các dòng khoá học chưa huỷ, bỏ lớp đã huỷ; null nếu không có. Người chỉ có quyền thu tiền (không
//       contracts.read / courses.read) vẫn nhận được mốc này — trước đây web phải gọi thêm GET /contracts/:id + GET /classes
//       và rơi về 30 ngày/đợt khi bị 403.
// Cả hai: tổ chức khác không đọc được, không lộ giá trị của tổ chức kia.
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

const idem = () => randomUUID();

function at(day: number, hhmm: string) {
  return new Date(`2032-06-${String(day).padStart(2, '0')}T${hhmm}:00+07:00`).toISOString();
}

// ---------------------------------------------------------------- L7
describe('L7 — số lượng của dòng hợp đồng trong mọi phản hồi lịch', () => {
  let owner: TestUser;
  let orgId: string;
  let contractId: string;
  let lineQty2: string;
  let lineQty1: string;
  let otherOwner: TestUser;
  let otherOrgId: string;

  beforeAll(async () => {
    app = makeApp(deps);
    owner = await registerUser(app, 'y5-lich-chu');
    orgId = await createOrg(app, owner, 'y5-lich');
    otherOwner = await registerUser(app, 'y5-lich-chu-b');
    otherOrgId = await createOrg(app, otherOwner, 'y5-lich-b');
    const customer = await db.customer.create({ data: { organizationId: orgId, fullName: 'Khách phù dâu' } });
    const contract = await db.contract.create({
      data: { organizationId: orgId, code: `HD-${randomUUID().slice(0, 8)}`, customerId: customer.id, createdById: owner.id },
    });
    contractId = contract.id;
    const line = (quantity: number) =>
      db.contractLine.create({
        data: { organizationId: orgId, contractId, kind: 'CUSTOM', name: 'Makeup phù dâu', subjectName: 'Phù dâu', quantity, unitPrice: 0n, lineTotal: 0n, createdById: owner.id },
      });
    lineQty2 = (await line(2)).id;
    lineQty1 = (await line(1)).id;
  });

  const postAppt = (body: Record<string, unknown>) =>
    request(app).post(`/api/v1/orgs/${orgId}/appointments`).set(bearer(owner)).set('Idempotency-Key', idem()).send(body);

  it('BẮT: ca gắn dòng số lượng 2 → quantity = 2 ở cả 5 cửa trả lịch (5/5)', async () => {
    const seen: [string, unknown][] = [];
    const created = await postAppt({ startsAt: at(3, '06:00'), endsAt: at(3, '07:00'), contractId, contractLineId: lineQty2, status: 'DRAFT' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    seen.push(['POST tạo', created.body.quantity]);
    const id = created.body.id as string;

    const one = await request(app).get(`/api/v1/orgs/${orgId}/appointments/${id}`).set(bearer(owner)).expect(200);
    seen.push(['GET một lịch', one.body.quantity]);

    const list = await request(app)
      .get(`/api/v1/orgs/${orgId}/appointments`)
      .query({ from: at(3, '00:00'), to: at(3, '23:59') })
      .set(bearer(owner))
      .expect(200);
    seen.push(['GET danh sách', list.body.items.find((a: { id: string }) => a.id === id)?.quantity]);

    const patched = await request(app).patch(`/api/v1/orgs/${orgId}/appointments/${id}`).set(bearer(owner)).send({ notes: 'hai phù dâu' }).expect(200);
    seen.push(['PATCH sửa', patched.body.quantity]);

    const status = await request(app).post(`/api/v1/orgs/${orgId}/appointments/${id}/status`).set(bearer(owner)).send({ to: 'PENDING_CONFIRMATION' });
    expect(status.status, JSON.stringify(status.body)).toBe(200);
    seen.push(['POST đổi trạng thái', status.body.quantity]);

    const ok = seen.filter(([, q]) => q === 2).length;
    console.log(`[L7] cửa trả lịch có quantity = 2: ${ok}/${seen.length}`);
    expect(seen).toEqual([
      ['POST tạo', 2],
      ['GET một lịch', 2],
      ['GET danh sách', 2],
      ['PATCH sửa', 2],
      ['POST đổi trạng thái', 2],
    ]);
  });

  it('GIỮ: dòng số lượng 1 → quantity = 1; ca không gắn dòng hợp đồng → quantity = null (có trường, không đoán)', async () => {
    const q1 = await postAppt({ startsAt: at(4, '06:00'), endsAt: at(4, '07:00'), contractId, contractLineId: lineQty1, status: 'DRAFT' });
    expect(q1.status, JSON.stringify(q1.body)).toBe(201);
    expect(q1.body.quantity).toBe(1);

    // Gắn hợp đồng nhưng không gắn dòng, và ca tự do có tên "× 2": đều null.
    const noLine = await postAppt({ startsAt: at(4, '08:00'), endsAt: at(4, '09:00'), contractId, title: 'Phù dâu × 2', status: 'DRAFT' });
    expect(noLine.status, JSON.stringify(noLine.body)).toBe(201);
    expect(noLine.body).toHaveProperty('quantity', null);
    const free = await postAppt({ startsAt: at(4, '10:00'), endsAt: at(4, '11:00'), title: 'Việc riêng', status: 'DRAFT' });
    expect(free.status, JSON.stringify(free.body)).toBe(201);
    expect(free.body).toHaveProperty('quantity', null);

    const list = await request(app)
      .get(`/api/v1/orgs/${orgId}/appointments`)
      .query({ from: at(4, '00:00'), to: at(4, '23:59') })
      .set(bearer(owner))
      .expect(200);
    const byId = new Map(list.body.items.map((a: { id: string; quantity: unknown }) => [a.id, a.quantity]));
    expect([byId.get(q1.body.id), byId.get(noLine.body.id), byId.get(free.body.id)]).toEqual([1, null, null]);
  });

  it('GIỮ cách ly: tổ chức khác không xem được ca, không gắn được dòng của tổ chức này, danh sách của nó không có ca này', async () => {
    const created = await postAppt({ startsAt: at(5, '06:00'), endsAt: at(5, '07:00'), contractId, contractLineId: lineQty2, status: 'DRAFT' });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    const cross = await request(app).get(`/api/v1/orgs/${otherOrgId}/appointments/${id}`).set(bearer(otherOwner));
    expect(cross.status).toBe(404);
    expect(JSON.stringify(cross.body)).not.toContain(lineQty2);
    const theirs = await request(app)
      .get(`/api/v1/orgs/${otherOrgId}/appointments`)
      .query({ from: at(5, '00:00'), to: at(5, '23:59') })
      .set(bearer(otherOwner))
      .expect(200);
    expect(theirs.body.items).toEqual([]);
    // Gắn dòng (số lượng 2) của tổ chức A vào ca của tổ chức B → không thành.
    const borrow = await request(app)
      .post(`/api/v1/orgs/${otherOrgId}/appointments`)
      .set(bearer(otherOwner))
      .set('Idempotency-Key', idem())
      .send({ startsAt: at(5, '08:00'), endsAt: at(5, '09:00'), contractId, contractLineId: lineQty2, status: 'DRAFT' });
    expect([404, 400]).toContain(borrow.status);
    expect(borrow.body.quantity).toBeUndefined();
  });
});

// ---------------------------------------------------------------- T1
describe('T1 — ngày kết thúc lớp muộn nhất trong phản hồi tiến độ thu tiền', () => {
  interface Academy {
    orgId: string;
    owner: TestUser;
  }
  let A: Academy;
  let B: Academy;
  let courseContractId: string;
  let serviceContractId: string;
  let cashier: TestUser;
  let bCourseContractId: string;

  async function academy(label: string): Promise<Academy> {
    const owner = await registerUser(app, `y5-hv-${label}`);
    const orgId = await createAcademyOrg(app, owner, `y5-hv-${label}`);
    await grantUnlimitedPlan(db, orgId);
    return { orgId, owner };
  }

  async function klass(a: Academy, name: string, endDate: string) {
    const course = await db.course.create({
      data: {
        organizationId: a.orgId,
        code: `KH-${randomUUID().slice(0, 6)}`,
        name: `Khoá ${name}`,
        mode: 'MULTI_CLASS',
        tuitionFee: 4_000_000n,
        depositAmount: 1_000_000n,
        defaultCapacity: 10,
        createdById: a.owner.id,
      },
    });
    return db.courseClass.create({
      data: {
        organizationId: a.orgId,
        courseId: course.id,
        name,
        startDate: new Date('2032-09-01'),
        endDate: new Date(endDate),
        weekdays: [2, 4],
        capacity: 10,
        createdById: a.owner.id,
      },
    });
  }

  async function courseContract(a: Academy, classIds: string[]) {
    const customer = await db.customer.create({ data: { organizationId: a.orgId, fullName: `Học viên ${randomUUID().slice(0, 4)}` } });
    const res = await request(app)
      .post(`/api/v1/orgs/${a.orgId}/contracts`)
      .set(bearer(a.owner))
      .set('Idempotency-Key', idem())
      .send({ kind: 'COURSE', customerId: customer.id, lines: classIds.map((courseClassId) => ({ kind: 'COURSE', courseClassId })) });
    if (res.status !== 201) throw new Error(`Tạo hợp đồng khoá học thất bại ${res.status}: ${JSON.stringify(res.body)}`);
    return res.body as { id: string; lines: { id: string; courseClassId: string | null }[] };
  }

  const progressOf = (u: TestUser, orgId: string, contractId: string) =>
    request(app).get(`/api/v1/orgs/${orgId}/contracts/${contractId}/payments`).set(bearer(u));

  beforeAll(async () => {
    app = makeApp(deps);
    A = await academy('a');
    B = await academy('b');
    const k12 = await klass(A, 'K12', '2032-11-30');
    const k13 = await klass(A, 'K13', '2032-11-20');
    const cancelled = await klass(A, 'K-huy', '2033-03-01');
    const voidedLineClass = await klass(A, 'K-dong-huy', '2033-02-01');
    const c = await courseContract(A, [k12.id, k13.id, cancelled.id, voidedLineClass.id]);
    courseContractId = c.id;
    // Lớp đã huỷ và dòng đã huỷ kết thúc MUỘN HƠN K12: nếu bị tính, mốc sẽ sai.
    await db.courseClass.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } });
    const voided = c.lines.find((l) => l.courseClassId === voidedLineClass.id);
    if (!voided) throw new Error('Thiếu dòng của lớp K-dong-huy');
    // Huỷ dòng như hợp đồng điều chỉnh: dòng + tổng hợp đồng trong cùng transaction (database kiểm tổng khớp các dòng).
    await db.$transaction(async (tx) => {
      const line = await tx.contractLine.update({ where: { id: voided.id }, data: { voidedAt: new Date(), voidReason: 'Học viên đổi lớp' } });
      await tx.contract.update({
        where: { id: courseContractId },
        data: { subtotal: { decrement: line.lineTotal }, total: { decrement: line.lineTotal } },
      });
    });

    const customer = await db.customer.create({ data: { organizationId: A.orgId, fullName: 'Khách dịch vụ' } });
    serviceContractId = (
      await db.contract.create({ data: { organizationId: A.orgId, code: `HD-${randomUUID().slice(0, 8)}`, customerId: customer.id, createdById: A.owner.id } })
    ).id;

    // Vai trò chỉ thu tiền: không contracts.read, không courses.read.
    await request(app)
      .post(`/api/v1/orgs/${A.orgId}/roles`)
      .set(bearer(A.owner))
      .send({ key: 'chi_thu_tien', name: 'Chỉ thu tiền', permissions: ['org.read', 'payments.read', 'payments.write'] })
      .expect(201);
    cashier = await registerUser(app, 'y5-hv-thu-ngan');
    await addMember(app, A.owner, A.orgId, cashier, ['chi_thu_tien']);

    // Tổ chức B có lớp kết thúc muộn hơn mọi lớp của A.
    const bClass = await klass(B, 'B-K1', '2034-01-15');
    bCourseContractId = (await courseContract(B, [bClass.id])).id;
  });

  it('BẮT: hợp đồng khoá học → courseEndDate = ngày kết thúc lớp muộn nhất (bỏ lớp đã huỷ, bỏ dòng đã huỷ)', async () => {
    const res = await progressOf(A.owner, A.orgId, courseContractId).expect(200);
    expect(res.body.contract.courseEndDate).toBe('2032-11-30');
    expect(res.body.contract.eventDate).toBeNull();
  });

  it('BẮT: người chỉ có quyền thu tiền đọc được mốc (dù GET hợp đồng / GET lớp trả 403)', async () => {
    expect((await request(app).get(`/api/v1/orgs/${A.orgId}/contracts/${courseContractId}`).set(bearer(cashier))).status).toBe(403);
    expect((await request(app).get(`/api/v1/orgs/${A.orgId}/classes`).set(bearer(cashier))).status).toBe(403);
    const res = await progressOf(cashier, A.orgId, courseContractId).expect(200);
    expect(res.body.contract.courseEndDate).toBe('2032-11-30');
  });

  it('GIỮ: PUT tiến độ (cùng hàm loadProgress) cũng trả mốc; hợp đồng dịch vụ → null', async () => {
    const put = await request(app)
      .put(`/api/v1/orgs/${A.orgId}/contracts/${courseContractId}/installments`)
      .set(bearer(cashier))
      .send({ installments: [{ name: 'Một lần', dueDate: '2032-08-01T23:59:59+07:00', amount: (await progressOf(A.owner, A.orgId, courseContractId)).body.summary.total }] });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(put.body.contract.courseEndDate).toBe('2032-11-30');
    const svc = await progressOf(A.owner, A.orgId, serviceContractId).expect(200);
    expect(svc.body.contract).toHaveProperty('courseEndDate', null);
  });

  it('GIỮ: mọi lớp đã huỷ / mọi dòng đã huỷ → null', async () => {
    const only = await klass(A, `K-chi-huy-${randomUUID().slice(0, 4)}`, '2032-12-24');
    const c = await courseContract(A, [only.id]);
    expect((await progressOf(A.owner, A.orgId, c.id).expect(200)).body.contract.courseEndDate).toBe('2032-12-24');
    await db.courseClass.update({ where: { id: only.id }, data: { status: 'CANCELLED' } });
    expect((await progressOf(A.owner, A.orgId, c.id).expect(200)).body.contract.courseEndDate).toBeNull();
  });

  it('GIỮ cách ly: B không đọc được tiến độ hợp đồng của A (404, không lộ ngày); mốc của B chỉ theo lớp của B', async () => {
    const cross = await progressOf(B.owner, B.orgId, courseContractId);
    expect(cross.status).toBe(404);
    expect(JSON.stringify(cross.body)).not.toContain('2032-11-30');
    const crossOrg = await progressOf(B.owner, A.orgId, courseContractId);
    expect([403, 404]).toContain(crossOrg.status);
    expect(JSON.stringify(crossOrg.body)).not.toContain('2032-11-30');
    expect((await progressOf(B.owner, B.orgId, bCourseContractId).expect(200)).body.contract.courseEndDate).toBe('2034-01-15');
    expect((await progressOf(A.owner, A.orgId, courseContractId).expect(200)).body.contract.courseEndDate).toBe('2032-11-30');
  });
});
