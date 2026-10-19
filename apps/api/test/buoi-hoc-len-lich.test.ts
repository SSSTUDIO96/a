// BUỔI HỌC LÊN LỊCH (việc tồn 6, quyết định điều phối 19/10). Mỗi bài ghi BẮT (bắt một lỗi cụ thể) hoặc GIỮ (giữ một hành
// vi đã chốt). Đột biến từng chốt: /tmp/claude-0/.../scratchpad/k2/dot-bien.mjs — báo cáo K2 in bắt được/tổng.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { addMember, bearer, createAcademyOrg, grantUnlimitedPlan, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';
import {
  SYNC_CANCEL_REASON,
  classSessionDates,
  planSessions,
  zonedInstant,
} from '../src/modules/courses/sessions';
import type { AppointmentRow } from '../src/modules/schedule/service';

const deps = makeDeps();
let app: App;

interface Org {
  orgId: string;
  owner: TestUser;
  ownerMembershipId: string;
  instructor: TestUser;
  instructorId: string;
  instructor2Id: string;
  locationId: string;
  courseId: string;
}

interface Appt {
  id: string;
  code: string;
  kind: string;
  status: string;
  startsAt: string;
  endsAt: string;
  sessionDate: string | null;
  cancelReason: string | null;
  address: string | null;
  locationType: string | null;
  courseClass: { id: string; name: string; courseId: string; courseName: string } | null;
  staff: { membershipId: string; role: string; isBlocking: boolean }[];
}

const api = (o: Org) => `/api/v1/orgs/${o.orgId}`;

async function post(u: TestUser, url: string, body: unknown) {
  return request(app).post(url).set(bearer(u)).set('idempotency-key', randomUUID()).send(body as object);
}

async function listAppts(o: Org, from = '2027-02-25T00:00:00.000Z', to = '2027-04-20T00:00:00.000Z', who: TestUser = o.owner): Promise<Appt[]> {
  const res = await request(app).get(`${api(o)}/appointments`).query({ from, to }).set(bearer(who)).expect(200);
  return res.body.items as Appt[];
}

const sessionsOf = (items: Appt[], classId: string) => items.filter((a) => a.courseClass?.id === classId);
const live = (items: Appt[]) => items.filter((a) => a.status !== 'CANCELLED');

async function setupOrg(label: string): Promise<Org> {
  const owner = await registerUser(app, `bh-chu-${label}`);
  const instructor = await registerUser(app, `bh-gv-${label}`);
  const instructor2 = await registerUser(app, `bh-gv2-${label}`);
  const orgId = await createAcademyOrg(app, owner, `bh-${label}`);
  await grantUnlimitedPlan(deps.db, orgId);
  const instructorId = await addMember(app, owner, orgId, instructor, ['instructor']);
  const instructor2Id = await addMember(app, owner, orgId, instructor2, ['instructor']);
  const own = await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId, userId: owner.id }, select: { id: true } });
  const o = `/api/v1/orgs/${orgId}`;
  const loc = await post(owner, `${o}/studio-locations`, { name: `Studio ${label}`, address: '12 Hàng Bài, Hà Nội' });
  expect(loc.status).toBe(201);
  const course = await post(owner, `${o}/courses`, { name: `Khoá ${label}`, mode: 'MULTI_CLASS', tuitionFee: 5_000_000, defaultCapacity: 20 });
  expect(course.status).toBe(201);
  return {
    orgId,
    owner,
    ownerMembershipId: own.id,
    instructor,
    instructorId,
    instructor2Id,
    locationId: loc.body.id,
    courseId: course.body.course.id,
  };
}

// Lớp tháng 3/2027, Thứ Hai + Thứ Tư 18:00–20:00 (giờ Hà Nội = 11:00–13:00 UTC) → 8 buổi.
async function makeClass(o: Org, extra: Record<string, unknown> = {}) {
  const res = await post(o.owner, `${api(o)}/courses/${o.courseId}/classes`, {
    name: `Lớp ${randomUUID().slice(0, 6)}`,
    startDate: '2027-03-01',
    endDate: '2027-03-28',
    weekdays: [1, 3],
    startTime: '18:00',
    endTime: '20:00',
    instructorMembershipId: o.instructorId,
    studioLocationId: o.locationId,
    ...extra,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: string; name: string; calendar: { total: number; upcoming: number } };
}

// Giảng viên riêng cho một bài (các lớp mẫu cùng tháng 3 nên dùng chung giảng viên sẽ trùng giờ nhau).
async function newInstructor(o: Org): Promise<string> {
  const u = await registerUser(app, 'bh-gv-rieng');
  return addMember(app, o.owner, o.orgId, u, ['instructor']);
}

const sync = (o: Org, classId: string, dryRun: boolean, who: TestUser = o.owner) =>
  post(who, `${api(o)}/classes/${classId}/sessions/sync`, { dryRun });

const patchClass = (o: Org, classId: string, body: unknown) =>
  request(app).patch(`${api(o)}/classes/${classId}`).set(bearer(o.owner)).send(body as object);

const setStatus = (o: Org, id: string, to: string, reason?: string) => post(o.owner, `${api(o)}/appointments/${id}/status`, { to, reason });

let A: Org;
let B: Org;

beforeAll(async () => {
  app = makeApp(deps);
  A = await setupOrg('a');
  B = await setupOrg('b');
});

afterAll(async () => {
  await deps.db.$disconnect();
});

// ---------- Hàm thuần ----------

describe('Hàm thuần: ngày học, giờ theo múi giờ, kế hoạch', () => {
  it('GIỮ: 18:00 giờ Hà Nội = 11:00 UTC; 24:00 = 0:00 hôm sau', () => {
    expect(zonedInstant('2027-03-01', 1080, 'Asia/Ho_Chi_Minh').toISOString()).toBe('2027-03-01T11:00:00.000Z');
    expect(zonedInstant('2027-03-01', 1440, 'Asia/Ho_Chi_Minh').toISOString()).toBe('2027-03-01T17:00:00.000Z');
    // Múi giờ có giờ mùa hè: 9:00 ngày 1/7 ở New York = 13:00 UTC (EDT, −4).
    expect(zonedInstant('2027-07-01', 540, 'America/New_York').toISOString()).toBe('2027-07-01T13:00:00.000Z');
  });

  it('BẮT: ngày học theo thứ ISO (1 = Thứ Hai … 7 = Chủ nhật), cắt từ "hôm nay", gồm cả ngày kết thúc', () => {
    const k = { startDate: '2027-03-01', endDate: '2027-03-28', weekdays: [1, 3] };
    expect(classSessionDates(k, '2027-01-01')).toEqual([
      '2027-03-01', '2027-03-03', '2027-03-08', '2027-03-10', '2027-03-15', '2027-03-17', '2027-03-22', '2027-03-24',
    ]);
    expect(classSessionDates(k, '2027-03-16')).toEqual(['2027-03-17', '2027-03-22', '2027-03-24']);
    expect(classSessionDates({ startDate: '2027-03-01', endDate: '2027-03-07', weekdays: [7] }, '2027-01-01')).toEqual(['2027-03-07']);
  });

  it('GIỮ: buổi đã diễn ra không bị sửa/huỷ dù lịch lớp đổi; buổi huỷ tay không sinh lại; buổi máy huỷ được sinh lại', () => {
    const tz = 'Asia/Ho_Chi_Minh';
    const k = {
      startDate: new Date('2027-03-01T00:00:00Z'),
      endDate: new Date('2027-03-10T00:00:00Z'),
      weekdays: [1, 3],
      startMinute: 1080,
      endMinute: 1200,
      instructorMembershipId: null,
      studioLocation: null,
    };
    const row = (date: string, status: string, startsAt: string, cancelReason: string | null = null) =>
      ({
        id: randomUUID(),
        code: 'LH',
        sessionDate: new Date(`${date}T00:00:00Z`),
        status,
        startsAt: new Date(startsAt),
        endsAt: new Date(new Date(startsAt).getTime() + 3_600_000),
        cancelReason,
        title: null,
        locationType: null,
        address: null,
        staff: [],
      }) as unknown as AppointmentRow;
    const now = new Date('2027-03-04T00:00:00Z');
    const plan = planSessions(
      k,
      [
        row('2027-03-01', 'CONFIRMED', '2027-03-01T09:00:00Z'), // đã qua, lệch giờ → giữ nguyên
        row('2027-03-08', 'CANCELLED', '2027-03-08T11:00:00Z', 'Nghỉ lễ'), // huỷ tay → không sinh lại
        row('2027-03-10', 'CANCELLED', '2027-03-10T11:00:00Z', SYNC_CANCEL_REASON), // máy huỷ → sinh lại
        row('2027-03-05', 'CONFIRMED', '2027-03-05T11:00:00Z'), // Thứ Sáu: không còn trong lịch → huỷ
      ],
      tz,
      now,
    );
    expect(plan.past).toBe(1);
    expect(plan.update).toHaveLength(0);
    expect(plan.skippedManual).toEqual(['2027-03-08']);
    expect(plan.create.map((d) => d.sessionDate)).toEqual(['2027-03-10']);
    expect(plan.cancel.map((r) => dateOf(r))).toEqual(['2027-03-05']);
  });
});

const dateOf = (r: AppointmentRow) => r.sessionDate?.toISOString().slice(0, 10);

// ---------- Đưa lên Lịch ----------

describe('Đưa buổi học lên Lịch', () => {
  it('BẮT: xem trước (dryRun) không ghi gì; ghi thật sinh đủ 8 buổi đúng giờ, ĐÃ XÁC NHẬN, giữ giờ giảng viên', async () => {
    const k = await makeClass(A);
    expect(k.calendar).toEqual({ total: 0, upcoming: 0 });
    const dry = await sync(A, k.id, true);
    expect(dry.status, JSON.stringify(dry.body)).toBe(200);
    expect(dry.body.summary).toMatchObject({ create: 8, update: 0, cancel: 0, keep: 0, firstNewDate: '2027-03-01', lastNewDate: '2027-03-24' });
    expect(dry.body.conflicts).toEqual([]);
    expect(sessionsOf(await listAppts(A), k.id)).toHaveLength(0);

    const res = await sync(A, k.id, false);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.summary.create).toBe(8);
    expect(res.body.class.calendar).toEqual({ total: 8, upcoming: 8 });
    const items = sessionsOf(await listAppts(A), k.id);
    expect(items).toHaveLength(8);
    const first = items[0]!;
    expect(first).toMatchObject({
      kind: 'COURSE_SESSION',
      status: 'CONFIRMED',
      startsAt: '2027-03-01T11:00:00.000Z',
      endsAt: '2027-03-01T13:00:00.000Z',
      sessionDate: '2027-03-01',
      locationType: 'STUDIO',
      address: '12 Hàng Bài, Hà Nội',
    });
    expect(first.courseClass).toMatchObject({ id: k.id, name: k.name, courseId: A.courseId });
    expect(first.staff).toEqual([expect.objectContaining({ membershipId: A.instructorId, role: 'PRIMARY', isBlocking: true })]);
    expect(items.map((a) => a.sessionDate)).toEqual(['2027-03-01', '2027-03-03', '2027-03-08', '2027-03-10', '2027-03-15', '2027-03-17', '2027-03-22', '2027-03-24']);
  });

  it('BẮT: bấm lại không sinh trùng (idempotent); database chặn buổi thứ hai cùng lớp cùng ngày', async () => {
    const k = await makeClass(A, { instructorMembershipId: await newInstructor(A) });
    expect((await sync(A, k.id, false)).status).toBe(200);
    const again = await sync(A, k.id, false);
    expect(again.status).toBe(200);
    expect(again.body.summary).toMatchObject({ create: 0, update: 0, cancel: 0, keep: 8 });
    expect(sessionsOf(await listAppts(A), k.id)).toHaveLength(8);
    // Chốt cuối: chỉ mục duy nhất có điều kiện appointments_class_session_live_key.
    const one = await deps.db.appointment.findFirstOrThrow({ where: { courseClassId: k.id } });
    await expect(
      deps.db.appointment.create({
        data: {
          organizationId: A.orgId,
          code: `LH-TRUNG-${randomUUID().slice(0, 6)}`,
          kind: 'COURSE_SESSION',
          courseClassId: k.id,
          sessionDate: one.sessionDate,
          startsAt: one.startsAt,
          endsAt: one.endsAt,
          status: 'CONFIRMED',
          createdById: A.owner.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('BẮT: trùng giờ ca makeup của giảng viên → 409 kèm danh sách, KHÔNG sinh buổi nào; ca Nháp không chặn', async () => {
    const k = await makeClass(A, { startDate: '2027-04-05', endDate: '2027-04-18', weekdays: [1] });
    // Ca makeup đã xác nhận của giảng viên trùng buổi 12/4 (18:30–19:30 giờ Hà Nội).
    const mk = await post(A.owner, `${api(A)}/appointments`, {
      startsAt: '2027-04-12T11:30:00.000Z',
      endsAt: '2027-04-12T12:30:00.000Z',
      status: 'CONFIRMED',
      staff: [{ membershipId: A.instructorId, role: 'PRIMARY' }],
    });
    expect(mk.status, JSON.stringify(mk.body)).toBe(201);
    // Ca Nháp cùng giờ buổi 5/4 không chiếm giờ → không chặn.
    const draft = await post(A.owner, `${api(A)}/appointments`, {
      startsAt: '2027-04-05T11:30:00.000Z',
      endsAt: '2027-04-05T12:30:00.000Z',
      status: 'DRAFT',
      staff: [{ membershipId: A.instructorId, role: 'PRIMARY' }],
    });
    expect(draft.status).toBe(201);

    const dry = await sync(A, k.id, true);
    expect(dry.status).toBe(200);
    expect(dry.body.conflicts.map((c: { code: string }) => c.code)).toEqual([mk.body.code]);

    const res = await sync(A, k.id, false);
    expect(res.status).toBe(409);
    expect(res.body.error.details.conflicts.map((c: { code: string }) => c.code)).toEqual([mk.body.code]);
    expect(res.body.error.message).toContain(mk.body.code);
    expect(sessionsOf(await listAppts(A, '2027-04-01T00:00:00.000Z', '2027-04-30T00:00:00.000Z'), k.id)).toHaveLength(0);

    // Huỷ ca makeup → đưa lên được.
    expect((await setStatus(A, mk.body.id, 'CANCELLED', 'Khách đổi ngày')).status).toBe(200);
    expect((await sync(A, k.id, false)).status).toBe(200);
  });

  it('GIỮ: buổi học đã lên Lịch giữ giờ giảng viên — tạo ca makeup trùng giờ bị 409', async () => {
    const k = await makeClass(A, { startDate: '2027-05-03', endDate: '2027-05-09', weekdays: [1] });
    expect((await sync(A, k.id, false)).status).toBe(200);
    const mk = await post(A.owner, `${api(A)}/appointments`, {
      startsAt: '2027-05-03T12:00:00.000Z',
      endsAt: '2027-05-03T14:00:00.000Z',
      status: 'CONFIRMED',
      staff: [{ membershipId: A.instructorId, role: 'PRIMARY' }],
    });
    expect(mk.status).toBe(409);
    expect(mk.body.error.details.conflicts[0].membershipId).toBe(A.instructorId);
  });

  it('BẮT: lớp chưa có giờ học → 409 CLASS_NO_TIME; lớp quá 200 buổi → 409 TOO_MANY_SESSIONS (không ghi)', async () => {
    const noTime = await makeClass(A, { startTime: undefined, endTime: undefined });
    const r1 = await sync(A, noTime.id, false);
    expect(r1.status).toBe(409);
    expect(r1.body.error.details.reason).toBe('CLASS_NO_TIME');
    const big = await makeClass(A, { startDate: '2027-01-01', endDate: '2027-12-31', weekdays: [1, 2, 3, 4, 5, 6, 7], instructorMembershipId: undefined });
    const r2 = await sync(A, big.id, false);
    expect(r2.status).toBe(409);
    expect(r2.body.error.details.reason).toBe('TOO_MANY_SESSIONS');
    expect(await deps.db.appointment.count({ where: { courseClassId: big.id } })).toBe(0);
  });

  it('BẮT: thân rỗng → 400 (dryRun bắt buộc); có courses.write mà thiếu schedule.write → 403', async () => {
    const k = await makeClass(A);
    expect((await post(A.owner, `${api(A)}/classes/${k.id}/sessions/sync`, {})).status).toBe(400);
    const u = await registerUser(app, 'bh-khoa');
    const role = await post(A.owner, `${api(A)}/roles`, { key: `khoa${randomUUID().slice(0, 4)}`, name: 'Chỉ khoá', permissions: ['org.read', 'courses.read', 'courses.write'] });
    expect(role.status, JSON.stringify(role.body)).toBe(201);
    await addMember(app, A.owner, A.orgId, u, [role.body.key]);
    const res = await sync(A, k.id, false, u);
    expect(res.status).toBe(403);
    expect(res.body.error.details.required).toBe('schedule.write');
  });

  it('GIỮ: giảng viên (chỉ xem lịch mình) thấy buổi học mình dạy trên Lịch', async () => {
    const k = await makeClass(A, { startDate: '2027-06-07', endDate: '2027-06-13', weekdays: [1] });
    expect((await sync(A, k.id, false)).status).toBe(200);
    const mine = await listAppts(A, '2027-06-01T00:00:00.000Z', '2027-06-30T00:00:00.000Z', A.instructor);
    expect(sessionsOf(mine, k.id)).toHaveLength(1);
  });
});

// ---------- Sửa / huỷ lớp kéo buổi học theo ----------

describe('Đổi lịch lớp / huỷ lớp', () => {
  it('BẮT: đổi thứ học → buổi cũ chưa diễn ra huỷ (lý do máy), buổi mới thêm; buổi đang diễn ra giữ nguyên; đổi lại thì sinh lại', async () => {
    const k = await makeClass(A, { instructorMembershipId: await newInstructor(A) });
    expect((await sync(A, k.id, false)).status).toBe(200);
    const before = sessionsOf(await listAppts(A), k.id);
    const running = before[0]!; // 1/3 — coi như "đã diễn ra"
    expect((await setStatus(A, running.id, 'IN_PROGRESS')).status).toBe(200);

    const res = await patchClass(A, k.id, { weekdays: [2, 4] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = sessionsOf(await listAppts(A), k.id);
    const liveAfter = live(after);
    // 4 tuần × (Thứ Ba + Thứ Năm) = 8 buổi mới + buổi 1/3 đang diễn ra giữ nguyên.
    expect(liveAfter.map((a) => a.sessionDate).sort()).toEqual(
      ['2027-03-01', '2027-03-02', '2027-03-04', '2027-03-09', '2027-03-11', '2027-03-16', '2027-03-18', '2027-03-23', '2027-03-25'],
    );
    expect(after.find((a) => a.id === running.id)).toMatchObject({ status: 'IN_PROGRESS', startsAt: running.startsAt });
    const cancelled = after.filter((a) => a.status === 'CANCELLED');
    expect(cancelled).toHaveLength(7);
    expect(new Set(cancelled.map((a) => a.cancelReason))).toEqual(new Set([SYNC_CANCEL_REASON]));
    expect(res.body.calendar).toEqual({ total: 9, upcoming: 8 });

    // Đổi lại Thứ Hai + Thứ Tư: các ngày máy đã huỷ được sinh lại (không vướng chỉ mục duy nhất).
    expect((await patchClass(A, k.id, { weekdays: [1, 3] })).status).toBe(200);
    const back = live(sessionsOf(await listAppts(A), k.id));
    expect(back.map((a) => a.sessionDate).sort()).toEqual(['2027-03-01', '2027-03-03', '2027-03-08', '2027-03-10', '2027-03-15', '2027-03-17', '2027-03-22', '2027-03-24']);
  });

  it('BẮT: đổi giờ / giảng viên / cơ sở → buổi chưa diễn ra đổi theo', async () => {
    const k = await makeClass(A, { startDate: '2027-07-05', endDate: '2027-07-18', weekdays: [1] });
    expect((await sync(A, k.id, false)).status).toBe(200);
    const loc2 = await post(A.owner, `${api(A)}/studio-locations`, { name: `Studio 2 ${randomUUID().slice(0, 4)}`, address: '5 Lý Thường Kiệt' });
    const res = await patchClass(A, k.id, { startTime: '08:00', endTime: '10:30', instructorMembershipId: A.instructor2Id, studioLocationId: loc2.body.id });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const items = live(sessionsOf(await listAppts(A, '2027-07-01T00:00:00.000Z', '2027-07-31T00:00:00.000Z'), k.id));
    expect(items).toHaveLength(2);
    for (const a of items) {
      expect(a.startsAt.slice(11)).toBe('01:00:00.000Z');
      expect(a.endsAt.slice(11)).toBe('03:30:00.000Z');
      expect(a.staff.map((s) => s.membershipId)).toEqual([A.instructor2Id]);
      expect(a.address).toBe('5 Lý Thường Kiệt');
    }
  });

  it('BẮT: đổi lịch lớp trùng giờ ca makeup → 409, lớp và buổi học không đổi (lùi cả lệnh)', async () => {
    const k = await makeClass(A, { startDate: '2027-08-02', endDate: '2027-08-08', weekdays: [1] });
    expect((await sync(A, k.id, false)).status).toBe(200);
    const mk = await post(A.owner, `${api(A)}/appointments`, {
      startsAt: '2027-08-02T02:00:00.000Z',
      endsAt: '2027-08-02T03:00:00.000Z',
      status: 'CONFIRMED',
      staff: [{ membershipId: A.instructorId, role: 'PRIMARY' }],
    });
    expect(mk.status).toBe(201);
    const res = await patchClass(A, k.id, { startTime: '08:00', endTime: '10:00' });
    expect(res.status).toBe(409);
    expect(res.body.error.details.conflicts.map((c: { code: string }) => c.code)).toEqual([mk.body.code]);
    const cls = await deps.db.courseClass.findUniqueOrThrow({ where: { id: k.id } });
    expect(cls.startMinute).toBe(1080);
    const s = live(sessionsOf(await listAppts(A, '2027-08-01T00:00:00.000Z', '2027-08-10T00:00:00.000Z'), k.id));
    expect(s.map((a) => a.startsAt)).toEqual(['2027-08-02T11:00:00.000Z']);
  });

  it('GIỮ: bỏ trống giờ học khi còn buổi sắp tới → 409; lớp chưa từng lên Lịch thì bỏ trống được', async () => {
    const k = await makeClass(A, { startDate: '2027-09-06', endDate: '2027-09-12', weekdays: [1] });
    expect((await sync(A, k.id, false)).status).toBe(200);
    const r = await patchClass(A, k.id, { startTime: null, endTime: null });
    expect(r.status).toBe(409);
    expect(r.body.error.details.reason).toBe('CLASS_HAS_SESSIONS');
    const k2 = await makeClass(A, { startDate: '2027-09-06', endDate: '2027-09-12', weekdays: [1] });
    expect((await patchClass(A, k2.id, { startTime: null, endTime: null })).status).toBe(200);
  });

  it('BẮT: buổi huỷ tay (nghỉ lễ) không bị sinh lại khi bấm lại', async () => {
    const k = await makeClass(A, { startDate: '2027-10-04', endDate: '2027-10-17', weekdays: [1] });
    expect((await sync(A, k.id, false)).status).toBe(200);
    const s = sessionsOf(await listAppts(A, '2027-10-01T00:00:00.000Z', '2027-10-31T00:00:00.000Z'), k.id);
    expect((await setStatus(A, s[0]!.id, 'CANCELLED', 'Nghỉ lễ')).status).toBe(200);
    const again = await sync(A, k.id, false);
    expect(again.status).toBe(200);
    expect(again.body.summary).toMatchObject({ create: 0, skippedManual: ['2027-10-04'], keep: 1 });
    expect(live(sessionsOf(await listAppts(A, '2027-10-01T00:00:00.000Z', '2027-10-31T00:00:00.000Z'), k.id))).toHaveLength(1);
  });

  it('BẮT: huỷ lớp còn buổi đang diễn ra → 409 nêu rõ buổi; xong buổi thì huỷ được, buổi chưa diễn ra huỷ theo, buổi đã xong giữ nguyên', async () => {
    const k = await makeClass(A, { startDate: '2027-11-01', endDate: '2027-11-14', weekdays: [1] });
    expect((await sync(A, k.id, false)).status).toBe(200);
    const s = sessionsOf(await listAppts(A, '2027-10-25T00:00:00.000Z', '2027-11-30T00:00:00.000Z'), k.id);
    expect(s).toHaveLength(2);
    expect((await setStatus(A, s[0]!.id, 'IN_PROGRESS')).status).toBe(200);
    const r1 = await post(A.owner, `${api(A)}/classes/${k.id}/cancel`, { reason: 'Không đủ học viên' });
    expect(r1.status).toBe(409);
    expect(r1.body.error.details.reason).toBe('CLASS_SESSION_IN_PROGRESS');
    expect(r1.body.error.message).toContain(s[0]!.code);
    expect(r1.body.error.message).toContain('01/11/2027');
    expect((await deps.db.courseClass.findUniqueOrThrow({ where: { id: k.id } })).status).toBe('OPEN');
    expect((await deps.db.appointment.findUniqueOrThrow({ where: { id: s[1]!.id } })).status).toBe('CONFIRMED');

    expect((await setStatus(A, s[0]!.id, 'COMPLETED')).status).toBe(200);
    const r2 = await post(A.owner, `${api(A)}/classes/${k.id}/cancel`, { reason: 'Không đủ học viên' });
    expect(r2.status, JSON.stringify(r2.body)).toBe(200);
    expect(r2.body.calendar).toEqual({ total: 1, upcoming: 0 });
    const after = sessionsOf(await listAppts(A, '2027-10-25T00:00:00.000Z', '2027-11-30T00:00:00.000Z'), k.id);
    expect(after.find((a) => a.id === s[0]!.id)?.status).toBe('COMPLETED');
    expect(after.find((a) => a.id === s[1]!.id)).toMatchObject({ status: 'CANCELLED', cancelReason: 'Huỷ lớp: Không đủ học viên' });
    // Lớp đã huỷ không đưa lên Lịch được nữa.
    expect((await sync(A, k.id, false)).status).toBe(409);
  });
});

// ---------- Cách ly tổ chức ----------

describe('Cách ly tổ chức', () => {
  it('BẮT: tổ chức B không đưa được lớp của A lên Lịch (404 giống mã bịa) và không thấy buổi học của A', async () => {
    const k = await makeClass(A, { startDate: '2027-12-06', endDate: '2027-12-12', weekdays: [1] });
    const cross = await post(B.owner, `/api/v1/orgs/${B.orgId}/classes/${k.id}/sessions/sync`, { dryRun: false });
    const fake = await post(B.owner, `/api/v1/orgs/${B.orgId}/classes/${randomUUID()}/sessions/sync`, { dryRun: false });
    expect(cross.status).toBe(404);
    expect(fake.status).toBe(404);
    expect(cross.body.error.message).toBe(fake.body.error.message);
    expect(await deps.db.appointment.count({ where: { courseClassId: k.id } })).toBe(0);
    expect((await sync(A, k.id, false)).status).toBe(200);
    const seen = await listAppts(B, '2027-12-01T00:00:00.000Z', '2027-12-31T00:00:00.000Z');
    expect(JSON.stringify(seen)).not.toContain(k.id);
  });

  it('BẮT: database chặn buổi học của tổ chức B trỏ vào lớp của A; chặn lớp gắn vào ca không phải buổi học', async () => {
    const k = await makeClass(A, { startDate: '2027-12-13', endDate: '2027-12-19', weekdays: [1] });
    const base = {
      code: `LH-X-${randomUUID().slice(0, 6)}`,
      startsAt: new Date('2027-12-13T11:00:00Z'),
      endsAt: new Date('2027-12-13T13:00:00Z'),
      sessionDate: new Date('2027-12-13T00:00:00Z'),
      courseClassId: k.id,
      status: 'CONFIRMED' as const,
    };
    // Khoá ngoại kép (course_class_id, organization_id).
    await expect(
      deps.db.appointment.create({ data: { ...base, organizationId: B.orgId, kind: 'COURSE_SESSION', createdById: B.owner.id } }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    // CHECK appointments_class_session_pair: ca makeup không gắn lớp; có lớp phải có ngày.
    await expect(deps.db.appointment.create({ data: { ...base, organizationId: A.orgId, kind: 'MAKEUP', createdById: A.owner.id } })).rejects.toThrow(
      /appointments_class_session_pair/,
    );
    await expect(
      deps.db.appointment.create({ data: { ...base, sessionDate: null, organizationId: A.orgId, kind: 'COURSE_SESSION', createdById: A.owner.id } }),
    ).rejects.toThrow(/appointments_class_session_pair/);
  });
});
