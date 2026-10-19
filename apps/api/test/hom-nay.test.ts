// Bản vẽ D mục 2.6 + 4.1 (gói M6): GET /orgs/:orgId/today — trang "Hôm nay".
// - Quyền: vào bằng org.read; TỪNG THẺ theo quyền (thiếu quyền → null); mỗi vai trò mẫu đúng tập null / không null.
// - Cách ly: không lộ dữ liệu tổ chức khác; người ngoài / tổ chức khác → 404; chưa đăng nhập → 401.
// - Ngày theo MÚI GIỜ TỔ CHỨC: ranh giới 23:59 / 00:00 giờ Việt Nam; cùng thời điểm ở tổ chức UTC rơi vào ngày khác.
// - Ca huỷ / vắng mặt không đếm. Ngày không có gì → mảng rỗng thật, số 0 thật, không lỗi.
// - Đợt thu: PARTIAL / thu đủ biến mất / quá hạn đúng overdueDays theo múi giờ / hợp đồng nháp, huỷ không hiện; SĐT theo customers.read.
// - Số câu truy vấn không tăng theo số hợp đồng (5 vs 50).
// Phần dữ liệu theo ngày cố định gọi thẳng collectToday (đúng hàm đường gọi) với `now` cố định; phần quyền / cách ly đi qua HTTP.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaClient, type EventKind, type WorkStatus, type ContractStatus } from '@prisma/client';
import { zonedInstant } from '@makeup/shared';
import { loadOrgContext } from '../src/http/middleware';
import { collectToday, todayClock } from '../src/modules/today/collect';
import type { TodayView } from '../src/modules/today/present';
import { addMember, bearer, createAcademyOrg, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
const VN = 'Asia/Ho_Chi_Minh';

let app: App;
let owner: TestUser;

afterAll(async () => {
  await db.$disconnect();
});

// "2031-03-10" + "23:59" giờ Việt Nam → thời điểm.
function vn(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+07:00`);
}

interface Fx {
  orgId: string;
  userId: string;
  customerId: string;
}

async function fixture(label: string, kind: 'TEAM' | 'ACADEMY' = 'TEAM', timezone?: string): Promise<Fx> {
  const orgId = kind === 'ACADEMY' ? await createAcademyOrg(app, owner, label) : await createOrg(app, owner, label);
  if (timezone) await db.organization.update({ where: { id: orgId }, data: { timezone } });
  const customer = await db.customer.create({ data: { organizationId: orgId, fullName: `Khách ${label}`, phone: '0901234567' } });
  return { orgId, userId: owner.id, customerId: customer.id };
}

async function appt(
  fx: Fx,
  o: { startsAt: Date; minutes?: number; kind?: EventKind; status?: WorkStatus; staff?: string[]; contractId?: string; contractLineId?: string },
) {
  const endsAt = new Date(o.startsAt.getTime() + (o.minutes ?? 30) * 60_000);
  const a = await db.appointment.create({
    data: {
      organizationId: fx.orgId,
      code: `LH-${randomUUID().slice(0, 8)}`,
      kind: o.kind ?? 'MAKEUP',
      status: o.status ?? 'CONFIRMED',
      customerId: fx.customerId,
      startsAt: o.startsAt,
      endsAt,
      createdById: fx.userId,
      contractId: o.contractId ?? null,
      contractLineId: o.contractLineId ?? null,
    },
  });
  for (const [i, m] of (o.staff ?? []).entries()) {
    await db.appointmentStaff.create({
      data: {
        organizationId: fx.orgId,
        appointmentId: a.id,
        membershipId: m,
        role: i === 0 ? 'PRIMARY' : 'ASSIST',
        blockStart: o.startsAt,
        blockEnd: endsAt,
        isBlocking: false,
      },
    });
  }
  return a.id;
}

// Database bắt tổng hợp đồng = tổng dòng (trigger trì hoãn tới cuối transaction): tạo nháp + một dòng CUSTOM đúng tổng
// trong cùng transaction, rồi mới chuyển trạng thái (trigger khoá chỉ chặn khi trạng thái CŨ đã rời nháp).
async function contract(fx: Fx, o: { status: ContractStatus; total: bigint; confirmedAt?: Date | null; eventDate?: Date | null; owner?: string }) {
  return db.$transaction(async (tx) => {
    const c = await tx.contract.create({
      data: {
        organizationId: fx.orgId,
        code: `HD-${randomUUID().slice(0, 8)}`,
        customerId: fx.customerId,
        createdById: fx.userId,
        status: 'DRAFT',
        subtotal: o.total,
        total: o.total,
        eventDate: o.eventDate ?? null,
        ownerMembershipId: o.owner ?? null,
      },
    });
    await tx.contractLine.create({
      data: { organizationId: fx.orgId, contractId: c.id, kind: 'CUSTOM', name: 'Trọn gói', unitPrice: o.total, lineTotal: o.total, createdById: fx.userId },
    });
    if (o.status !== 'DRAFT') {
      await tx.contract.update({ where: { id: c.id }, data: { status: o.status, confirmedAt: o.confirmedAt ?? null, ...(o.status === 'CANCELLED' ? { cancelReason: 'Khách huỷ' } : {}) } });
    }
    return c.id;
  });
}

async function installment(fx: Fx, contractId: string, name: string, dueDate: Date, amount: bigint, sortOrder: number, isDeposit = false) {
  const i = await db.paymentInstallment.create({
    data: { organizationId: fx.orgId, contractId, name, dueDate, amount, sortOrder, isDeposit },
  });
  return i.id;
}

async function payment(fx: Fx, contractId: string, amount: bigint, o: { kind?: 'RECEIPT' | 'REFUND'; voided?: boolean; at?: Date } = {}) {
  await db.payment.create({
    data: {
      organizationId: fx.orgId,
      contractId,
      code: `PT-${randomUUID().slice(0, 8)}`,
      kind: o.kind ?? 'RECEIPT',
      method: 'CASH',
      amount,
      receivedAt: o.at ?? new Date('2031-01-01T00:00:00Z'),
      createdById: fx.userId,
      ...(o.voided ? { voidedAt: new Date('2031-01-02T00:00:00Z'), voidReason: 'Ghi nhầm' } : {}),
    },
  });
}

async function ownerMembership(orgId: string) {
  return (await db.membership.findUniqueOrThrow({ where: { organizationId_userId: { organizationId: orgId, userId: owner.id } } })).id;
}

// Gọi đúng hàm đường gọi, với quyền tra thật từ database và `now` cố định.
async function viewAt(orgId: string, userId: string, now: Date, client = db): Promise<TodayView> {
  const org = await loadOrgContext(db, userId, orgId, 'org.read');
  const row = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { timezone: true, kind: true } });
  return collectToday(client, { org, timezone: row.timezone, orgKind: row.kind, now });
}

const ids = (xs: { id: string }[] | null | undefined) => (xs ?? []).map((x) => x.id);

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'm6-chu');
});

// ================================================================================================================
describe('ranh giới ngày theo múi giờ tổ chức (23:59 / 00:00 giờ Việt Nam)', () => {
  const D = '2031-03-10';
  let fx: Fx;
  let utcFx: Fx;
  const a: Record<string, string> = {};

  beforeAll(async () => {
    fx = await fixture('m6-ranh-gioi');
    a.prevLast = await appt(fx, { startsAt: vn('2031-03-09', '23:59'), minutes: 1 });
    a.dFirst = await appt(fx, { startsAt: vn(D, '00:00') });
    a.dLast = await appt(fx, { startsAt: vn(D, '23:59'), minutes: 1 });
    a.nextFirst = await appt(fx, { startsAt: vn('2031-03-11', '00:00') });
    a.nextLast = await appt(fx, { startsAt: vn('2031-03-11', '23:59'), minutes: 1 });
    a.d2 = await appt(fx, { startsAt: vn('2031-03-12', '00:00') });
    a.d8Last = await appt(fx, { startsAt: vn('2031-03-17', '23:59'), minutes: 1 });
    a.d8 = await appt(fx, { startsAt: vn('2031-03-18', '00:00') });
    // Cùng các thời điểm ở một tổ chức múi giờ UTC: 00:00 giờ VN = 17:00 UTC hôm trước.
    utcFx = await fixture('m6-utc', 'TEAM', 'UTC');
    a.utcDFirst = await appt(utcFx, { startsAt: vn(D, '00:00') });
    a.utcDLast = await appt(utcFx, { startsAt: vn(D, '23:59'), minutes: 1 });
  });

  it('now = 23:59:30 ngày D (giờ VN): Hôm nay = [D 00:00, D 23:59]; Ngày mai bắt đầu đúng D+1 00:00; Sau đó tới hết D+7', async () => {
    const v = await viewAt(fx.orgId, owner.id, new Date(vn(D, '23:59').getTime() + 30_000));
    expect(v.timezone).toBe(VN);
    expect(v.today).toBe(D);
    expect(v.tomorrow).toBe('2031-03-11');
    expect(ids(v.appointments?.today)).toEqual([a.dFirst, a.dLast]);
    expect(ids(v.appointments?.tomorrow)).toEqual([a.nextFirst, a.nextLast]);
    expect(ids(v.appointments?.later)).toEqual([a.d2, a.d8Last]);
    expect(v.counts.appointmentsToday).toBe(2);
    expect(v.counts.appointmentsTomorrow).toBe(2);
  });

  it('now = 00:00:30 ngày D+1 (giờ VN): "hôm nay" lật sang D+1, ca 23:59 ngày D không còn ở Hôm nay', async () => {
    const v = await viewAt(fx.orgId, owner.id, new Date(vn('2031-03-11', '00:00').getTime() + 30_000));
    expect(v.today).toBe('2031-03-11');
    expect(ids(v.appointments?.today)).toEqual([a.nextFirst, a.nextLast]);
    expect(ids(v.appointments?.tomorrow)).toEqual([a.d2]);
    expect(ids(v.appointments?.later)).toEqual([a.d8Last, a.d8]);
  });

  it('cùng thời điểm, tổ chức múi giờ UTC: ca 00:00 giờ VN ngày D thuộc ngày D−1 theo UTC', async () => {
    // now = D 12:00 UTC → hôm nay (UTC) = D: [D 00:00Z, D+1 00:00Z). 00:00 VN ngày D = D−1 17:00Z → không thuộc hôm nay.
    const v = await viewAt(utcFx.orgId, owner.id, new Date(`${D}T12:00:00Z`));
    expect(v.timezone).toBe('UTC');
    expect(v.today).toBe(D);
    expect(ids(v.appointments?.today)).toEqual([a.utcDLast]);
    expect(ids(v.appointments?.today)).not.toContain(a.utcDFirst);
  });

  it('hàm mốc dùng zonedInstant của shared: dayStart(D) giờ VN = D−1 17:00Z', () => {
    const c = todayClock(VN, vn(D, '08:00'));
    expect(c.todayStart.toISOString()).toBe('2031-03-09T17:00:00.000Z');
    expect(c.todayStart.getTime()).toBe(zonedInstant(D, 0, VN).getTime());
    expect(c.weekEnd.toISOString()).toBe('2031-03-17T17:00:00.000Z');
  });
});

// ================================================================================================================
describe('ca huỷ / vắng mặt không đếm; mọi kind đều hiện', () => {
  it('CANCELLED và NO_SHOW không có trong danh sách lẫn số đếm; INTERNAL, COURSE_SESSION… vẫn hiện', async () => {
    const fx = await fixture('m6-huy');
    const D = '2031-04-02';
    const ok = await appt(fx, { startsAt: vn(D, '09:00') });
    const internal = await appt(fx, { startsAt: vn(D, '10:00'), kind: 'INTERNAL', status: 'PENDING_CONFIRMATION' });
    const done = await appt(fx, { startsAt: vn(D, '11:00'), status: 'COMPLETED' });
    const cancelled = await appt(fx, { startsAt: vn(D, '12:00'), status: 'CANCELLED' });
    const noShow = await appt(fx, { startsAt: vn(D, '13:00'), status: 'NO_SHOW' });
    const cancelledTomorrow = await appt(fx, { startsAt: vn('2031-04-03', '09:00'), status: 'CANCELLED' });
    const v = await viewAt(fx.orgId, owner.id, vn(D, '08:00'));
    expect(ids(v.appointments?.today)).toEqual([ok, internal, done]);
    expect(v.counts.appointmentsToday).toBe(3);
    expect(v.counts.appointmentsTomorrow).toBe(0);
    const all = [...ids(v.appointments?.today), ...ids(v.appointments?.tomorrow), ...ids(v.appointments?.later)];
    for (const x of [cancelled, noShow, cancelledTomorrow]) expect(all).not.toContain(x);
  });
});

// ================================================================================================================
describe('mẫu số rỗng: ngày không có gì → rỗng thật, không lỗi, không bịa số', () => {
  it('tổ chức mới không có dữ liệu (chủ, đủ quyền): mảng rỗng, số 0, tiền 0, truncated false', async () => {
    const fx = await fixture('m6-rong');
    const v = await viewAt(fx.orgId, owner.id, vn('2031-05-05', '10:00'));
    expect(v.scheduleScope).toBe('ALL');
    expect(v.appointments).toEqual({ today: [], tomorrow: [], later: [], truncated: false });
    expect(v.counts).toEqual({
      appointmentsToday: 0,
      appointmentsTomorrow: 0,
      unassignedSoon: 0,
      overdue: { count: 0, amount: 0 },
      dueSoon: { count: 0, amount: 0 },
    });
    expect(v.unassigned).toEqual([]);
    expect(v.installments).toEqual({ overdue: [], dueSoon: [], truncated: false });
    expect(v.newContracts).toEqual([]);
    // Tổ chức TEAM: thẻ đào tạo là null (không phải mảng rỗng).
    expect(v.newEnrollments).toBeNull();
    expect(v.almostFullClasses).toBeNull();
  });

  it('có ca nhưng ở ngày khác (xa hơn 7 ngày / đã qua): hôm nay vẫn rỗng thật, số 0', async () => {
    const fx = await fixture('m6-rong-2');
    await appt(fx, { startsAt: vn('2031-05-01', '09:00') });
    await appt(fx, { startsAt: vn('2031-05-20', '09:00') });
    const v = await viewAt(fx.orgId, owner.id, vn('2031-05-05', '10:00'));
    expect(v.appointments).toEqual({ today: [], tomorrow: [], later: [], truncated: false });
    expect(v.counts.appointmentsToday).toBe(0);
  });

  it('qua HTTP: tổ chức rỗng trả 200 với đúng các mảng rỗng', async () => {
    const fx = await fixture('m6-rong-http');
    const res = await request(app).get(`/api/v1/orgs/${fx.orgId}/today`).set(bearer(owner)).expect(200);
    expect(res.body.appointments.today).toEqual([]);
    expect(res.body.installments).toEqual({ overdue: [], dueSoon: [], truncated: false });
    expect(res.body.counts.overdue).toEqual({ count: 0, amount: 0 });
  });
});

// ================================================================================================================
describe('ca: loại sự kiện, nhân vật, thợ', () => {
  it('ca sinh từ dòng có sự kiện trả occasion { tên chụp trên dòng, màu HIỆN TẠI của loại }; ca lẻ → null', async () => {
    const fx = await fixture('m6-su-kien');
    const me = await ownerMembership(fx.orgId);
    const tag = randomUUID().slice(0, 6);
    const service = await db.service.create({ data: { organizationId: fx.orgId, kind: 'MAIN', code: `DV-${tag}`, name: `Trang điểm ${tag}`, durationMinutes: 60 } });
    const occasion = await db.occasion.create({ data: { organizationId: fx.orgId, name: `Lễ cưới ${tag}`, color: 'rose' } });
    const cid = await contract(fx, { status: 'DRAFT', total: 0n });
    const line = await db.contractLine.create({
      data: {
        organizationId: fx.orgId,
        contractId: cid,
        kind: 'SERVICE',
        serviceId: service.id,
        name: 'Trang điểm cô dâu',
        subjectName: 'Phù dâu',
        quantity: 2,
        unitPrice: 0n,
        lineTotal: 0n,
        createdById: owner.id,
        occasionId: occasion.id,
        occasionName: `Lễ cưới ${tag}`,
      },
    });
    const D = '2031-12-05';
    const withOcc = await appt(fx, { startsAt: vn(D, '08:00'), contractId: cid, contractLineId: line.id, staff: [me] });
    const loose = await appt(fx, { startsAt: vn(D, '10:00') });
    // Đổi tên + màu loại sau: tên giữ bản chụp trên dòng, màu theo loại hiện tại.
    await db.occasion.update({ where: { id: occasion.id }, data: { name: `Đổi tên ${tag}`, color: 'petrol' } });
    const v = await viewAt(fx.orgId, owner.id, vn(D, '07:00'));
    const byId = new Map((v.appointments?.today ?? []).map((x) => [x.id, x]));
    expect(byId.get(withOcc)).toMatchObject({
      occasion: { id: occasion.id, name: `Lễ cưới ${tag}`, color: 'petrol' },
      subjectName: 'Phù dâu',
      quantity: 2,
      contract: { id: cid },
    });
    expect(byId.get(withOcc)?.staff).toEqual([{ membershipId: me, displayName: 'Người thử m6-chu', role: 'PRIMARY' }]);
    expect(byId.get(loose)).toMatchObject({ occasion: null, subjectName: null, quantity: null, contract: null, staff: [] });
  });
});

// ================================================================================================================
describe('ca chưa có thợ', () => {
  it('chỉ MAKEUP, chỉ chờ xác nhận / đã xác nhận, chỉ trong [now, dayStart(today+8)), chỉ ca không có thợ', async () => {
    const fx = await fixture('m6-chua-tho');
    const tho = await addMember(app, owner, fx.orgId, await registerUser(app, 'm6-tho-ct'), ['artist']);
    const D = '2031-06-10';
    const now = vn(D, '10:00');
    const yes1 = await appt(fx, { startsAt: vn(D, '11:00'), status: 'PENDING_CONFIRMATION' });
    const yes2 = await appt(fx, { startsAt: vn('2031-06-17', '23:59'), minutes: 1 });
    await appt(fx, { startsAt: vn(D, '09:00') }); // đã qua so với now
    await appt(fx, { startsAt: vn('2031-06-18', '00:00') }); // dayStart(today+8) — ngoài
    await appt(fx, { startsAt: vn(D, '12:00'), kind: 'INTERNAL' });
    await appt(fx, { startsAt: vn(D, '13:00'), status: 'DRAFT' });
    await appt(fx, { startsAt: vn(D, '14:00'), status: 'CANCELLED' });
    await appt(fx, { startsAt: vn(D, '15:00'), staff: [tho] });
    const v = await viewAt(fx.orgId, owner.id, now);
    expect(ids(v.unassigned)).toEqual([yes1, yes2]);
    expect(v.counts.unassignedSoon).toBe(2);
  });
});

// ================================================================================================================
describe('đợt thu: trạng thái bằng summarizePayments + allocateToInstallments, tiền số nguyên', () => {
  const D = '2031-07-15';
  const now = vn(D, '09:00');
  let fx: Fx;
  const c: Record<string, string> = {};
  const inst: Record<string, string> = {};

  beforeAll(async () => {
    fx = await fixture('m6-dot');
    const me = await ownerMembership(fx.orgId);
    // Hợp đồng 1: 10tr; cọc 3tr hạn D−3 (quá hạn 3 ngày), đợt 2 4tr hạn D+2, đợt 3 3tr hạn D+20 (ngoài 7 ngày).
    // Đã thu 2tr + một phiếu 5tr ĐÃ HUỶ (không tính) → cọc còn thiếu 1tr.
    c.one = await contract(fx, { status: 'CONFIRMED', total: 10_000_000n, eventDate: vn('2031-08-01', '08:00'), owner: me });
    inst.deposit = await installment(fx, c.one, 'Cọc', vn('2031-07-12', '17:00'), 3_000_000n, 0, true);
    inst.second = await installment(fx, c.one, 'Đợt 2', vn('2031-07-17', '17:00'), 4_000_000n, 1);
    inst.third = await installment(fx, c.one, 'Đợt 3', vn('2031-08-04', '17:00'), 3_000_000n, 2);
    await payment(fx, c.one, 2_000_000n);
    await payment(fx, c.one, 5_000_000n, { voided: true });
    // Hợp đồng 2 (COMPLETED): thu 1,5tr cho đợt 2tr hạn D+1 → PARTIAL còn 500k.
    c.partial = await contract(fx, { status: 'COMPLETED', total: 2_000_000n });
    inst.partial = await installment(fx, c.partial, 'Một lần', vn('2031-07-16', '12:00'), 2_000_000n, 0);
    await payment(fx, c.partial, 1_500_000n);
    // Hợp đồng 3: thu đủ (thu 3tr, hoàn 1tr, thu thêm 1tr = 3tr thực thu) → biến khỏi danh sách.
    c.paid = await contract(fx, { status: 'CONFIRMED', total: 3_000_000n });
    inst.paid = await installment(fx, c.paid, 'Một lần', vn('2031-07-10', '12:00'), 3_000_000n, 0);
    await payment(fx, c.paid, 3_000_000n);
    await payment(fx, c.paid, 1_000_000n, { kind: 'REFUND' });
    await payment(fx, c.paid, 1_000_000n);
    // Hợp đồng nháp / huỷ có đợt quá hạn → KHÔNG hiện.
    c.draft = await contract(fx, { status: 'DRAFT', total: 1_000_000n });
    inst.draft = await installment(fx, c.draft, 'Nháp', vn('2031-07-01', '12:00'), 1_000_000n, 0);
    c.cancelled = await contract(fx, { status: 'CANCELLED', total: 1_000_000n });
    inst.cancelled = await installment(fx, c.cancelled, 'Huỷ', vn('2031-07-01', '12:00'), 1_000_000n, 0);
    // Quá hạn theo MÚI GIỜ: hạn 23:30 ngày D−1 giờ VN; now 00:30 ngày D giờ VN → 1 ngày (theo UTC sẽ là 0).
    c.tz = await contract(fx, { status: 'CONFIRMED', total: 700_000n });
    inst.tz = await installment(fx, c.tz, 'Sát nửa đêm', vn('2031-07-14', '23:30'), 700_000n, 0);
  });

  it('quá hạn / sắp tới hạn đúng đợt, đúng còn thiếu, đúng tổng; thu đủ biến mất; nháp / huỷ không hiện', async () => {
    const v = await viewAt(fx.orgId, owner.id, now);
    const ov = v.installments?.overdue ?? [];
    const ds = v.installments?.dueSoon ?? [];
    expect(ov.map((x) => x.installmentId)).toEqual([inst.deposit, inst.tz]);
    expect(ds.map((x) => x.installmentId)).toEqual([inst.partial, inst.second]);
    const dep = ov[0]!;
    expect(dep).toMatchObject({ status: 'OVERDUE', amount: 3_000_000, outstanding: 1_000_000, overdueDays: 3, isDeposit: true, name: 'Cọc' });
    expect(dep.contract.id).toBe(c.one);
    expect(dep.owner?.membershipId).toBeTruthy();
    expect(dep.customer).toMatchObject({ phone: '0901234567', phoneHidden: false });
    expect(ds[0]).toMatchObject({ status: 'PARTIAL', amount: 2_000_000, outstanding: 500_000, overdueDays: 0 });
    expect(ds[1]).toMatchObject({ status: 'DUE', amount: 4_000_000, outstanding: 4_000_000, overdueDays: 0 });
    const all = [...ov, ...ds].map((x) => x.installmentId);
    for (const x of [inst.third, inst.paid, inst.draft, inst.cancelled]) expect(all).not.toContain(x);
    expect(v.counts.overdue).toEqual({ count: 2, amount: 1_700_000 });
    expect(v.counts.dueSoon).toEqual({ count: 2, amount: 4_500_000 });
    for (const x of [v.counts.overdue!.amount, v.counts.dueSoon!.amount, ...[...ov, ...ds].flatMap((i) => [i.amount, i.outstanding])]) {
      expect(Number.isSafeInteger(x)).toBe(true);
    }
  });

  it('overdueDays tính theo ngày lịch giờ VN (hạn 23:30 hôm trước, now 00:30 → 1 ngày)', async () => {
    const v = await viewAt(fx.orgId, owner.id, vn(D, '00:30'));
    const tz = (v.installments?.overdue ?? []).find((x) => x.installmentId === inst.tz);
    expect(tz?.overdueDays).toBe(1);
  });
});

// ================================================================================================================
describe('hợp đồng mới 24 giờ qua', () => {
  it('xác nhận 1 giờ trước hiện kèm người xác nhận (nhật ký); 25 giờ trước không; nháp không', async () => {
    const fx = await fixture('m6-hd-moi');
    const now = vn('2031-09-01', '10:00');
    const fresh = await contract(fx, { status: 'CONFIRMED', total: 5_000_000n, confirmedAt: new Date(now.getTime() - 3_600_000) });
    await db.auditLog.create({
      data: { organizationId: fx.orgId, actorUserId: owner.id, action: 'contract.status_changed', entityType: 'contract', entityId: fresh, data: { from: 'DRAFT', to: 'CONFIRMED' } },
    });
    const old = await contract(fx, { status: 'CONFIRMED', total: 1_000_000n, confirmedAt: new Date(now.getTime() - 25 * 3_600_000) });
    const draft = await contract(fx, { status: 'DRAFT', total: 1_000_000n });
    const v = await viewAt(fx.orgId, owner.id, now);
    expect(ids(v.newContracts)).toEqual([fresh]);
    expect(v.newContracts?.[0]).toMatchObject({ total: 5_000_000, kind: 'SERVICE', customerName: 'Khách m6-hd-moi' });
    expect(v.newContracts?.[0]?.confirmedBy).toEqual({ userId: owner.id, fullName: 'Người thử m6-chu' });
    expect(ids(v.newContracts)).not.toContain(old);
    expect(ids(v.newContracts)).not.toContain(draft);
  });
});

// ================================================================================================================
describe('đào tạo: chỉ tổ chức ACADEMY', () => {
  it('lớp 9/12 hiện, 8/12 không, 12/12 không; lớp đã kết thúc không; ghi danh 24 giờ qua hiện', async () => {
    const fx = await fixture('m6-hoc', 'ACADEMY');
    const course = await db.course.create({
      data: {
        organizationId: fx.orgId,
        code: `KH-${randomUUID().slice(0, 6)}`,
        name: `Khoá ${randomUUID().slice(0, 6)}`,
        mode: 'MULTI_CLASS',
        tuitionFee: 5_000_000n,
        defaultCapacity: 12,
        sessionCount: 10,
        sessionMinutes: 120,
        createdById: owner.id,
      },
    });
    const mk = (name: string, enrolled: number, start: string, end: string) =>
      db.courseClass.create({
        data: {
          organizationId: fx.orgId,
          courseId: course.id,
          name,
          startDate: new Date(`${start}T00:00:00Z`),
          endDate: new Date(`${end}T00:00:00Z`),
          weekdays: [1],
          capacity: 12,
          enrolledCount: enrolled,
          createdById: owner.id,
        },
      });
    const nine = await mk('Lớp 9', 9, '2031-10-01', '2031-11-01');
    const eight = await mk('Lớp 8', 8, '2031-10-01', '2031-11-01');
    const full = await mk('Lớp 12', 12, '2031-10-01', '2031-11-01');
    const ended = await mk('Lớp cũ 9', 9, '2031-08-01', '2031-09-01');
    const v = await viewAt(fx.orgId, owner.id, vn('2031-09-20', '10:00'));
    expect(ids(v.almostFullClasses)).toEqual([nine.id]);
    expect(v.almostFullClasses?.[0]).toMatchObject({ enrolledCount: 9, capacity: 12, seatsLeft: 3, startDate: '2031-10-01' });
    for (const x of [eight.id, full.id, ended.id]) expect(ids(v.almostFullClasses)).not.toContain(x);
    expect(v.newEnrollments).toEqual([]);
  });
});

// ================================================================================================================
describe('quyền theo vai trò mẫu (qua HTTP) + SĐT theo customers.read', () => {
  let fx: Fx;
  let academy: Fx;
  const users: Record<string, TestUser> = {};
  const mem: Record<string, string> = {};
  const a: Record<string, string> = {};
  let overdueInst: string;

  beforeAll(async () => {
    fx = await fixture('m6-vai-tro');
    for (const [label, roles] of [
      ['manager', ['manager']],
      ['receptionist', ['receptionist']],
      ['accountant', ['accountant']],
      ['artist', ['artist']],
      ['artist2', ['artist']],
      ['instructor', ['instructor']],
      ['teaching_assistant', ['teaching_assistant']],
    ] as const) {
      users[label] = await registerUser(app, `m6-${label}`);
      mem[label] = await addMember(app, owner, fx.orgId, users[label]!, [...roles]);
    }
    // Vai trò tuỳ chỉnh: như Kế toán nhưng BỎ customers.read → phoneHidden.
    const acc = await db.role.findFirstOrThrow({ where: { organizationId: fx.orgId, key: 'accountant' } });
    await db.role.create({
      data: { organizationId: fx.orgId, key: 'ke_toan_kin', name: 'Kế toán không xem khách', permissions: acc.permissions.filter((p) => p !== 'customers.read') },
    });
    users.custom = await registerUser(app, 'm6-ke-toan-kin');
    mem.custom = await addMember(app, owner, fx.orgId, users.custom, ['ke_toan_kin']);
    // Vai trò tuỳ chỉnh chỉ có org.read (không xem lịch).
    await db.role.create({ data: { organizationId: fx.orgId, key: 'chi_vao', name: 'Chỉ vào', permissions: ['org.read'] } });
    users.bare = await registerUser(app, 'm6-chi-vao');
    mem.bare = await addMember(app, owner, fx.orgId, users.bare, ['chi_vao']);

    const clock = todayClock(VN, new Date());
    const at = (date: string, minute: number) => zonedInstant(date, minute, VN);
    a.mine = await appt(fx, { startsAt: at(clock.today, 12 * 60), staff: [mem.artist!] });
    a.other = await appt(fx, { startsAt: at(clock.today, 14 * 60), staff: [mem.artist2!] });
    a.mineTomorrow = await appt(fx, { startsAt: at(clock.tomorrow, 9 * 60), staff: [mem.artist!, mem.artist2!] });
    a.cancelledMine = await appt(fx, { startsAt: at(clock.today, 16 * 60), staff: [mem.artist!], status: 'CANCELLED' });
    a.unassigned = await appt(fx, { startsAt: at(clock.tomorrow, 10 * 60), status: 'PENDING_CONFIRMATION' });
    const c1 = await contract(fx, { status: 'CONFIRMED', total: 2_000_000n, confirmedAt: new Date(Date.now() - 3_600_000) });
    overdueInst = await installment(fx, c1, 'Cọc', new Date(Date.now() - 2 * 86_400_000), 2_000_000n, 0, true);

    academy = await fixture('m6-vai-tro-hoc', 'ACADEMY');
    for (const label of ['instructor', 'teaching_assistant']) {
      await addMember(app, owner, academy.orgId, users[label]!, [label]);
    }
  });

  const get = (u: TestUser, orgId = fx.orgId) => request(app).get(`/api/v1/orgs/${orgId}/today`).set(bearer(u));

  type Shape = { scope: 'ALL' | 'OWN' | null; unassigned: boolean; installments: boolean; newContracts: boolean; phone: boolean | null };
  const table: Record<string, Shape> = {
    owner: { scope: 'ALL', unassigned: true, installments: true, newContracts: true, phone: true },
    manager: { scope: 'ALL', unassigned: true, installments: true, newContracts: true, phone: true },
    receptionist: { scope: 'ALL', unassigned: true, installments: true, newContracts: true, phone: true },
    accountant: { scope: 'ALL', unassigned: true, installments: true, newContracts: true, phone: true },
    artist: { scope: 'OWN', unassigned: false, installments: false, newContracts: false, phone: null },
    instructor: { scope: 'OWN', unassigned: false, installments: false, newContracts: false, phone: null },
    teaching_assistant: { scope: 'OWN', unassigned: false, installments: false, newContracts: false, phone: null },
    custom: { scope: 'ALL', unassigned: true, installments: true, newContracts: true, phone: false },
  };

  for (const [label, want] of Object.entries(table)) {
    it(`${label}: đúng tập trường null / không null`, async () => {
      const u = label === 'owner' ? owner : users[label]!;
      const res = await get(u).expect(200);
      const v = res.body as TodayView;
      expect(v.scheduleScope).toBe(want.scope);
      expect(v.appointments).not.toBeNull();
      expect(v.unassigned === null).toBe(!want.unassigned);
      expect(v.counts.unassignedSoon === null).toBe(!want.unassigned);
      expect(v.installments === null).toBe(!want.installments);
      expect(v.counts.overdue === null).toBe(!want.installments);
      expect(v.counts.dueSoon === null).toBe(!want.installments);
      expect(v.newContracts === null).toBe(!want.newContracts);
      // Tổ chức TEAM: thẻ đào tạo luôn null, kể cả người có courses.read.
      expect(v.newEnrollments).toBeNull();
      expect(v.almostFullClasses).toBeNull();
      if (want.installments) {
        const it0 = v.installments!.overdue.find((x) => x.installmentId === overdueInst);
        expect(it0).toBeDefined();
        expect(it0!.customer.phone).toBe(want.phone ? '0901234567' : null);
        expect(it0!.customer.phoneHidden).toBe(!want.phone);
        // Người không có quyền tiền không thấy MỘT số tiền nào: kiểm ngược lại ở ca thợ dưới.
      } else {
        const text = JSON.stringify(v);
        expect(text).not.toContain(overdueInst);
        expect(text).not.toContain('"amount"');
        expect(text).not.toContain('"outstanding"');
        expect(text).not.toContain('"total"');
      }
      if (want.scope === 'ALL') {
        expect(ids(v.appointments!.today)).toEqual(expect.arrayContaining([a.mine, a.other]));
        expect(ids(v.unassigned)).toContain(a.unassigned);
      }
      const all = [...ids(v.appointments!.today), ...ids(v.appointments!.tomorrow), ...ids(v.appointments!.later)];
      expect(all).not.toContain(a.cancelledMine);
    });
  }

  it('thợ chỉ thấy ca có mình (hôm nay + ngày mai), số đếm cũng chỉ của mình', async () => {
    const v = (await get(users.artist!).expect(200)).body as TodayView;
    expect(ids(v.appointments!.today)).toEqual([a.mine]);
    expect(ids(v.appointments!.tomorrow)).toEqual([a.mineTomorrow]);
    expect(v.counts.appointmentsToday).toBe(1);
    expect(v.counts.appointmentsTomorrow).toBe(1);
    const v2 = (await get(users.artist2!).expect(200)).body as TodayView;
    expect(ids(v2.appointments!.today)).toEqual([a.other]);
    expect(ids(v2.appointments!.tomorrow)).toEqual([a.mineTomorrow]);
  });

  it('vai trò tuỳ chỉnh không có quyền xem lịch: thẻ ca là null (không trả mảng rỗng bịa)', async () => {
    const v = (await get(users.bare!).expect(200)).body as TodayView;
    expect(v.scheduleScope).toBeNull();
    expect(v.appointments).toBeNull();
    expect(v.counts.appointmentsToday).toBeNull();
    expect(v.counts.appointmentsTomorrow).toBeNull();
    expect(v.unassigned).toBeNull();
    expect(v.installments).toBeNull();
    expect(v.newContracts).toBeNull();
  });

  it('tổ chức ACADEMY: Giảng viên (courses.read) thấy thẻ đào tạo, Trợ giảng (không courses.read) thì null', async () => {
    const vi = (await get(users.instructor!, academy.orgId).expect(200)).body as TodayView;
    expect(vi.newEnrollments).toEqual([]);
    expect(vi.almostFullClasses).toEqual([]);
    const vt = (await get(users.teaching_assistant!, academy.orgId).expect(200)).body as TodayView;
    expect(vt.newEnrollments).toBeNull();
    expect(vt.almostFullClasses).toBeNull();
  });

  it('thiếu org.read → 403 (vai trò tuỳ chỉnh không quyền nào)', async () => {
    await db.role.create({ data: { organizationId: fx.orgId, key: 'khong_gi', name: 'Không gì', permissions: [] } });
    const u = await registerUser(app, 'm6-khong-gi');
    await addMember(app, owner, fx.orgId, u, ['khong_gi']);
    const res = await get(u).expect(403);
    expect(res.body.error?.code ?? res.body.code).toBe('FORBIDDEN');
  });
});

// ================================================================================================================
describe('cách ly tổ chức', () => {
  let A: Fx;
  let B: Fx;
  let ownerB: TestUser;
  const bIds: string[] = [];

  beforeAll(async () => {
    A = await fixture('m6-cach-ly-a');
    ownerB = await registerUser(app, 'm6-chu-b');
    const orgB = await createOrg(app, ownerB, 'm6-cach-ly-b');
    const custB = await db.customer.create({ data: { organizationId: orgB, fullName: 'Khách B', phone: '0912345678' } });
    B = { orgId: orgB, userId: ownerB.id, customerId: custB.id };
    const clock = todayClock(VN, new Date());
    bIds.push(await appt(B, { startsAt: zonedInstant(clock.today, 13 * 60, VN) }));
    bIds.push(await appt(B, { startsAt: zonedInstant(clock.tomorrow, 11 * 60, VN), status: 'PENDING_CONFIRMATION' }));
    const cB = await contract(B, { status: 'CONFIRMED', total: 9_000_000n, confirmedAt: new Date(Date.now() - 600_000) });
    bIds.push(cB);
    bIds.push(await installment(B, cB, 'Cọc B', new Date(Date.now() - 86_400_000), 9_000_000n, 0, true));
    // A có một ca để chắc chắn danh sách không rỗng vì lý do khác.
    await appt(A, { startsAt: zonedInstant(clock.today, 13 * 60, VN) });
  });

  it('chủ A đọc /today của A: không có mã nào của B, không có SĐT của B, tiền chỉ của A', async () => {
    const res = await request(app).get(`/api/v1/orgs/${A.orgId}/today`).set(bearer(owner)).expect(200);
    const text = JSON.stringify(res.body);
    for (const id of bIds) expect(text).not.toContain(id);
    expect(text).not.toContain('0912345678');
    expect(res.body.counts.overdue).toEqual({ count: 0, amount: 0 });
    expect(res.body.appointments.today).toHaveLength(1);
  });

  it('chủ B đọc /today của A → 404 giống tổ chức bịa; chủ A đọc /today của B → 404', async () => {
    const r1 = await request(app).get(`/api/v1/orgs/${A.orgId}/today`).set(bearer(ownerB)).expect(404);
    const r2 = await request(app).get(`/api/v1/orgs/${randomUUID()}/today`).set(bearer(ownerB)).expect(404);
    const strip = (b: { error: Record<string, unknown> }) => ({ ...b.error, requestId: undefined });
    expect(strip(r1.body)).toEqual(strip(r2.body));
    await request(app).get(`/api/v1/orgs/${B.orgId}/today`).set(bearer(owner)).expect(404);
  });

  it('chưa đăng nhập → 401', async () => {
    await request(app).get(`/api/v1/orgs/${A.orgId}/today`).expect(401);
  });
});

// ================================================================================================================
describe('số câu truy vấn không tăng theo số hợp đồng / số ca (không N+1)', () => {
  it('5 hợp đồng và 50 hợp đồng (mỗi hợp đồng 2 đợt + 1 phiếu + 1 ca có thợ) → cùng số câu', async () => {
    const queries: string[] = [];
    const qdb = new PrismaClient({ datasources: { db: { url: deps.env.DATABASE_URL } }, log: [{ emit: 'event', level: 'query' }] });
    qdb.$on('query', (e) => queries.push(e.query));
    const D = '2031-11-11';
    const now = vn(D, '09:00');
    const build = async (label: string, n: number) => {
      const fx = await fixture(label);
      const me = await ownerMembership(fx.orgId);
      for (let i = 0; i < n; i++) {
        const cid = await contract(fx, { status: 'CONFIRMED', total: 2_000_000n, confirmedAt: new Date(now.getTime() - 3_600_000), owner: me });
        await installment(fx, cid, 'Cọc', vn('2031-11-01', '12:00'), 1_000_000n, 0, true);
        await installment(fx, cid, 'Đợt 2', vn('2031-11-13', '12:00'), 1_000_000n, 1);
        await payment(fx, cid, 300_000n);
        await appt(fx, { startsAt: new Date(vn(D, '00:00').getTime() + i * 20 * 60_000), minutes: 15, staff: [me], contractId: cid });
      }
      return fx;
    };
    const small = await build('m6-n1-5', 5);
    const big = await build('m6-n1-50', 50);
    try {
      await viewAt(small.orgId, owner.id, now, qdb); // làm nóng
      queries.length = 0;
      const vs = await viewAt(small.orgId, owner.id, now, qdb);
      const nSmall = queries.length;
      queries.length = 0;
      const vb = await viewAt(big.orgId, owner.id, now, qdb);
      const nBig = queries.length;
      console.log(`[hôm nay — N+1] 5 hợp đồng: ${nSmall} câu; 50 hợp đồng: ${nBig} câu`);
      expect(vs.installments?.overdue).toHaveLength(5);
      expect(vb.installments?.overdue).toHaveLength(50);
      expect(vb.counts.overdue).toEqual({ count: 50, amount: 50 * 700_000 });
      expect(vb.appointments?.today).toHaveLength(50);
      expect(nBig).toBe(nSmall);
    } finally {
      await qdb.$disconnect();
    }
  });
});
