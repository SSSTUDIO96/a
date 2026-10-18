// Khoá & lớp (bản vẽ C3 mục 1.0–1.3, gói M3). Bài thử bắt buộc mục 3.1 M3 + chặn tổ chức không phải ACADEMY,
// sửa một phần, tình trạng chỗ 3 mức, huỷ lớp còn học viên, lưu trữ, chống gửi trùng, nhật ký trước → sau.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_ROUTES, createApp } from '../src/app';
import { courseRoutes } from '../src/modules/courses/routes';
import { addMember, bearer, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;
let ownerA: TestUser;
let ownerB: TestUser;
let ownerI: TestUser;
let readerA: TestUser;
let orgA: string;
let orgB: string;
let orgI: string;
let instructorA: string;
let locationA: string;
let groupA: string;
let groupB: string;
let locationB: string;
let instructorB: string;

type Body = Record<string, unknown>;
type ClassView = {
  id: string;
  courseId: string;
  name: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string | null;
  endTime: string | null;
  capacity: number;
  enrolledCount: number;
  seatsLeft: number;
  seatState: string;
  status: string;
  note: string | null;
  instructor: { membershipId: string; name: string } | null;
  location: { id: string; name: string; address: string } | null;
};
type Course = {
  id: string;
  code: string;
  name: string;
  mode: string;
  groupId: string | null;
  tuitionFee: number;
  depositAmount: number;
  defaultCapacity: number;
  sessionCount: number | null;
  sessionMinutes: number | null;
  description: string | null;
  sortOrder: number;
  archivedAt: string | null;
};

const url = (org: string, p: string) => `/api/v1/orgs/${org}${p}`;
const uniq = () => randomUUID().slice(0, 6).toUpperCase();

// Đường khoá & lớp chưa nằm trong ALL_ROUTES thì gắn thêm (điều phối đăng ký ở app.ts một lần).
const ROUTES = courseRoutes.every((r) => ALL_ROUTES.includes(r)) ? ALL_ROUTES : [...ALL_ROUTES, ...courseRoutes];

function call(u: TestUser, method: 'get' | 'post' | 'patch', path: string, body?: Body, key: string = randomUUID()) {
  const req = request(app)[method](path).set(bearer(u));
  if (method === 'get') return body ? req.query(body) : req;
  if (method === 'post') req.set('idempotency-key', key);
  return req.send(body ?? {});
}

async function academy(owner: TestUser, kind: 'ACADEMY' | 'INDIVIDUAL' = 'ACADEMY') {
  const res = await request(app)
    .post('/api/v1/orgs')
    .set(bearer(owner))
    .send({ name: `Trung tâm ${uniq()}`, slug: `tt-${randomUUID().slice(0, 8)}`, kind })
    .expect(201);
  const orgId = res.body.id as string;
  // Tổ chức không giới hạn: gói không đặt maxCourses (assertQuota trả ngay, không đếm).
  const plan = await db.subscriptionPlan.create({
    data: { code: `kh_${randomUUID().slice(0, 8)}`, name: 'Gói thử khoá học', priceMonthly: 0n, features: [] },
  });
  await db.organizationSubscription.create({
    data: { organizationId: orgId, planId: plan.id, startsAt: new Date(Date.now() - 86_400_000), endsAt: null, status: 'ACTIVE' },
  });
  return orgId;
}

const firstClass = (extra: Body = {}) => ({
  startDate: '2026-11-03',
  endDate: '2026-11-28',
  weekdays: [6, 2, 4],
  startTime: '18:00',
  endTime: '21:30',
  ...extra,
});

async function createCourse(u: TestUser, org: string, body: Body) {
  const res = await call(u, 'post', url(org, '/courses'), {
    name: `Khoá ${uniq()}`,
    tuitionFee: 6_500_000,
    defaultCapacity: 10,
    ...body,
  });
  if (res.status !== 201) throw new Error(`Tạo khoá thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as { course: Course; classes: ClassView[] };
}

async function single(org = orgA, u = ownerA, extra: Body = {}) {
  return createCourse(u, org, { mode: 'SINGLE_CLASS', firstClass: firstClass(), ...extra });
}

async function multi(org = orgA, u = ownerA, extra: Body = {}) {
  return createCourse(u, org, { mode: 'MULTI_CLASS', ...extra });
}

function openClass(courseId: string, extra: Body = {}, org = orgA, u = ownerA) {
  return call(u, 'post', url(org, `/courses/${courseId}/classes`), { name: `Lớp ${uniq()}`, ...firstClass(), ...extra });
}

async function setEnrolled(classId: string, n: number) {
  await db.courseClass.update({ where: { id: classId }, data: { enrolledCount: n } });
}

// Bỏ requestId và mã vừa gửi để so hai phản hồi lỗi.
function norm(body: unknown, sent: string[]) {
  let t = JSON.stringify(body);
  for (const s of sent) t = t.split(s).join('<MÃ>');
  return t.replace(/"requestId":"[^"]+"/g, '');
}

beforeAll(async () => {
  app = createApp(deps, ROUTES);
  ownerA = await registerUser(app, 'kh-chu-a');
  ownerB = await registerUser(app, 'kh-chu-b');
  ownerI = await registerUser(app, 'kh-chu-i');
  readerA = await registerUser(app, 'kh-gv-a');
  orgA = await academy(ownerA);
  orgB = await academy(ownerB);
  orgI = await academy(ownerI, 'INDIVIDUAL');
  instructorA = await addMember(app, ownerA, orgA, readerA, ['instructor']);
  const memB = await registerUser(app, 'kh-gv-b');
  instructorB = await addMember(app, ownerB, orgB, memB, ['instructor']);
  const locA = await call(ownerA, 'post', url(orgA, '/studio-locations'), { name: 'Cơ sở Cầu Giấy', address: 'Số 1 Cầu Giấy' }).expect(201);
  locationA = locA.body.id as string;
  const locB = await call(ownerB, 'post', url(orgB, '/studio-locations'), { name: 'Cơ sở B', address: 'Số 2 B' }).expect(201);
  locationB = locB.body.id as string;
  const gA = await call(ownerA, 'post', url(orgA, '/course-groups'), { name: `Nhóm ${uniq()}` });
  groupA = gA.body.id as string;
  const gB = await call(ownerB, 'post', url(orgB, '/course-groups'), { name: `Nhóm ${uniq()}` });
  groupB = gB.body.id as string;
});

afterAll(async () => {
  await db.$disconnect();
});

describe('Bật đào tạo: chỉ tổ chức ACADEMY', () => {
  it('tổ chức INDIVIDUAL gọi mọi nhóm đường → 403 "Tổ chức chưa bật đào tạo"', async () => {
    const calls = [
      call(ownerI, 'get', url(orgI, '/courses')),
      call(ownerI, 'get', url(orgI, '/course-groups')),
      call(ownerI, 'get', url(orgI, '/classes')),
      call(ownerI, 'post', url(orgI, '/course-groups'), { name: 'Nhóm thử' }),
      call(ownerI, 'post', url(orgI, '/courses'), { name: 'K', mode: 'MULTI_CLASS', tuitionFee: 1000, defaultCapacity: 5 }),
      call(ownerI, 'get', url(orgI, `/courses/${randomUUID()}`)),
      call(ownerI, 'patch', url(orgI, `/classes/${randomUUID()}`), { note: 'x' }),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Tổ chức chưa bật đào tạo');
    }
    expect(await db.course.count({ where: { organizationId: orgI } })).toBe(0);
    expect(await db.courseGroup.count({ where: { organizationId: orgI } })).toBe(0);
  });

  it('quyền: giảng viên đọc được, không sửa được (courses.write → 403)', async () => {
    await call(readerA, 'get', url(orgA, '/courses')).expect(200);
    const res = await call(readerA, 'post', url(orgA, '/course-groups'), { name: 'Không được' });
    expect(res.status).toBe(403);
    expect(res.body.error.details).toMatchObject({ required: 'courses.write' });
  });
});

describe('Tạo khoá', () => {
  it('Một lớp có firstClass → 201, đúng một lớp mang tên khoá, giờ HH:MM, ngày YYYY-MM-DD, tiền số nguyên', async () => {
    const res = await call(ownerA, 'post', url(orgA, '/courses'), {
      name: 'Makeup cá nhân cấp tốc',
      mode: 'SINGLE_CLASS',
      groupId: groupA,
      tuitionFee: 6_500_000,
      depositAmount: 2_000_000,
      defaultCapacity: 10,
      sessionCount: 12,
      sessionMinutes: 180,
      firstClass: firstClass({ instructorMembershipId: instructorA, studioLocationId: locationA }),
    });
    expect(res.status).toBe(201);
    const { course, classes } = res.body as { course: Course; classes: ClassView[] };
    expect(course).toMatchObject({
      name: 'Makeup cá nhân cấp tốc',
      mode: 'SINGLE_CLASS',
      groupId: groupA,
      tuitionFee: 6_500_000,
      depositAmount: 2_000_000,
      defaultCapacity: 10,
      sessionCount: 12,
      sessionMinutes: 180,
      archivedAt: null,
    });
    expect(course.code).toMatch(/^KH-\d{4}$/);
    expect(classes).toHaveLength(1);
    expect(classes[0]).toMatchObject({
      courseId: course.id,
      name: 'Makeup cá nhân cấp tốc',
      startDate: '2026-11-03',
      endDate: '2026-11-28',
      weekdays: [2, 4, 6],
      startTime: '18:00',
      endTime: '21:30',
      capacity: 10,
      enrolledCount: 0,
      seatsLeft: 10,
      seatState: 'AVAILABLE',
      status: 'OPEN',
      instructor: { membershipId: instructorA },
      location: { id: locationA, name: 'Cơ sở Cầu Giấy', address: 'Số 1 Cầu Giấy' },
    });
    const row = await db.courseClass.findUniqueOrThrow({ where: { id: classes[0]?.id } });
    expect(row.startMinute).toBe(1080);
    expect(row.endMinute).toBe(1290);
    const log = await db.auditLog.findFirst({ where: { organizationId: orgA, action: 'course.created', entityId: course.id } });
    expect(log).not.toBeNull();
  });

  it('Một lớp thiếu firstClass → 400 chỉ đúng trường firstClass; không tạo gì', async () => {
    const before = await db.course.count({ where: { organizationId: orgA } });
    const res = await call(ownerA, 'post', url(orgA, '/courses'), { name: 'Thiếu lớp', mode: 'SINGLE_CLASS', tuitionFee: 1000, defaultCapacity: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.issues.map((i: { path: string }) => i.path)).toContain('firstClass');
    expect(await db.course.count({ where: { organizationId: orgA } })).toBe(before);
  });

  it('Nhiều lớp: firstClass tuỳ chọn; có firstClass thì phải có tên lớp', async () => {
    const empty = await multi();
    expect(empty.classes).toEqual([]);
    const noName = await call(ownerA, 'post', url(orgA, '/courses'), {
      name: 'Nhiều lớp thiếu tên', mode: 'MULTI_CLASS', tuitionFee: 1000, defaultCapacity: 5, firstClass: firstClass(),
    });
    expect(noName.status).toBe(400);
    expect(noName.body.error.details.issues.map((i: { path: string }) => i.path)).toContain('firstClass.name');
    const withClass = await multi(orgA, ownerA, { firstClass: firstClass({ name: 'Nâng cao K1', capacity: 8 }) });
    expect(withClass.classes[0]).toMatchObject({ name: 'Nâng cao K1', capacity: 8 });
  });

  it('dữ liệu sai → 400: cọc > học phí, ngày kết thúc trước ngày bắt đầu, giờ kết thúc không sau giờ bắt đầu, thứ trùng', async () => {
    const base = { name: 'Sai', mode: 'SINGLE_CLASS', tuitionFee: 1000, defaultCapacity: 5 };
    const cases: [Body, string][] = [
      [{ ...base, depositAmount: 2000, firstClass: firstClass() }, 'depositAmount'],
      [{ ...base, firstClass: firstClass({ startDate: '2026-11-10', endDate: '2026-11-09' }) }, 'firstClass.endDate'],
      [{ ...base, firstClass: firstClass({ startTime: '18:00', endTime: '18:00' }) }, 'firstClass.endTime'],
      [{ ...base, firstClass: firstClass({ startTime: '18:00', endTime: undefined }) }, 'firstClass.endTime'],
      [{ ...base, firstClass: firstClass({ weekdays: [2, 2] }) }, 'firstClass.weekdays'],
      [{ ...base, firstClass: firstClass({ startTime: '18h' }) }, 'firstClass.startTime'],
    ];
    for (const [body, path] of cases) {
      const res = await call(ownerA, 'post', url(orgA, '/courses'), body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.details.issues.map((i: { path: string }) => i.path)).toContain(path);
    }
  });

  it('mã khoá tự sinh tăng dần; mã tự đặt trùng → 409', async () => {
    const a = await multi();
    const b = await multi();
    expect(Number(b.course.code.slice(3))).toBeGreaterThan(Number(a.course.code.slice(3)));
    const code = `NC-${uniq()}`;
    await multi(orgA, ownerA, { code });
    const dup = await call(ownerA, 'post', url(orgA, '/courses'), { name: 'Trùng mã', mode: 'MULTI_CLASS', tuitionFee: 1, defaultCapacity: 1, code });
    expect(dup.status).toBe(409);
  });

  it('POST tạo khoá chống gửi trùng: cùng Idempotency-Key → cùng khoá, không tạo bản thứ hai', async () => {
    const key = randomUUID();
    const body = { name: `Trùng khoá ${uniq()}`, mode: 'MULTI_CLASS', tuitionFee: 1000, defaultCapacity: 5 };
    const first = await call(ownerA, 'post', url(orgA, '/courses'), body, key);
    const again = await call(ownerA, 'post', url(orgA, '/courses'), body, key);
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body.course.id).toBe(first.body.course.id);
    expect(await db.course.count({ where: { organizationId: orgA, name: body.name } })).toBe(1);
  });
});

describe('Một lớp ↔ Nhiều lớp', () => {
  it('khoá Một lớp không mở được lớp 2 → 409; số lớp không đổi', async () => {
    const { course } = await single();
    const res = await openClass(course.id);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Khoá một lớp chỉ có một lớp — chuyển sang Nhiều lớp để mở thêm');
    expect(await db.courseClass.count({ where: { courseId: course.id } })).toBe(1);
  });

  it('đổi Một → Nhiều giữ nguyên id lớp và số đã ghi danh; firstClassName đổi tên lớp; sau đó mở được lớp 2', async () => {
    const { course, classes } = await single();
    const only = classes[0] as ClassView;
    await setEnrolled(only.id, 3);
    const res = await call(ownerA, 'patch', url(orgA, `/courses/${course.id}`), { mode: 'MULTI_CLASS', firstClassName: 'Cấp tốc K1' });
    expect(res.status).toBe(200);
    expect(res.body.course.mode).toBe('MULTI_CLASS');
    expect(res.body.classes).toHaveLength(1);
    expect(res.body.classes[0]).toMatchObject({ id: only.id, name: 'Cấp tốc K1', enrolledCount: 3 });
    const second = await openClass(course.id, { name: 'Cấp tốc K2' });
    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({ courseId: course.id, name: 'Cấp tốc K2', capacity: 10 });
  });

  it('đổi Nhiều → Một khi còn > 1 lớp chưa huỷ → 409; kiểu khoá giữ nguyên', async () => {
    const { course } = await multi();
    await openClass(course.id, { name: 'K1' }).expect(201);
    await openClass(course.id, { name: 'K2' }).expect(201);
    const res = await call(ownerA, 'patch', url(orgA, `/courses/${course.id}`), { mode: 'SINGLE_CLASS' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Khoá đang có 2 lớp — chỉ chuyển về Một lớp khi còn 1 lớp');
    expect((await db.course.findUniqueOrThrow({ where: { id: course.id } })).mode).toBe('MULTI_CLASS');
  });

  it('đổi Nhiều → Một khi còn đúng 1 lớp (lớp kia đã huỷ) → được; lớp mang tên khoá', async () => {
    const { course } = await multi(orgA, ownerA, { name: `Khoá về một ${uniq()}` });
    const k1 = await openClass(course.id, { name: 'K1' }).expect(201);
    const k2 = await openClass(course.id, { name: 'K2' }).expect(201);
    await call(ownerA, 'post', url(orgA, `/classes/${k2.body.id}/cancel`), { reason: 'Không đủ học viên' }).expect(200);
    const res = await call(ownerA, 'patch', url(orgA, `/courses/${course.id}`), { mode: 'SINGLE_CLASS' });
    expect(res.status).toBe(200);
    expect(res.body.course.mode).toBe('SINGLE_CLASS');
    const kept = (res.body.classes as ClassView[]).find((c) => c.id === k1.body.id);
    expect(kept?.name).toBe(course.name);
  });

  it('firstClassName chỉ dùng khi chuyển sang Nhiều lớp → 400', async () => {
    const { course } = await multi();
    const res = await call(ownerA, 'patch', url(orgA, `/courses/${course.id}`), { firstClassName: 'K9' });
    expect(res.status).toBe(400);
  });
});

describe('Số tối đa, huỷ lớp, lưu trữ', () => {
  it('giảm số tối đa dưới số đã ghi danh → 409, số tối đa giữ nguyên; bằng số đã ghi danh → được', async () => {
    const { course } = await multi();
    const k = await openClass(course.id, { capacity: 8 }).expect(201);
    await setEnrolled(k.body.id, 5);
    const res = await call(ownerA, 'patch', url(orgA, `/classes/${k.body.id}`), { capacity: 4 });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Lớp đã có 5 học viên — không đặt tối đa thấp hơn 5');
    expect((await db.courseClass.findUniqueOrThrow({ where: { id: k.body.id } })).capacity).toBe(8);
    const ok = await call(ownerA, 'patch', url(orgA, `/classes/${k.body.id}`), { capacity: 5 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ capacity: 5, seatsLeft: 0, seatState: 'FULL' });
  });

  it('huỷ lớp còn học viên → 409; lớp trống → huỷ được, ghi nhật ký có lý do', async () => {
    const { course } = await multi();
    const k = await openClass(course.id).expect(201);
    await setEnrolled(k.body.id, 2);
    const busy = await call(ownerA, 'post', url(orgA, `/classes/${k.body.id}/cancel`), { reason: 'Thử' });
    expect(busy.status).toBe(409);
    expect(busy.body.error.message).toBe('Lớp còn 2 học viên — chuyển hoặc huỷ ghi danh trước');
    await setEnrolled(k.body.id, 0);
    const done = await call(ownerA, 'post', url(orgA, `/classes/${k.body.id}/cancel`), { reason: 'Giảng viên ốm' });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('CANCELLED');
    const log = await db.auditLog.findFirstOrThrow({ where: { organizationId: orgA, action: 'course_class.cancelled', entityId: k.body.id } });
    expect(log.data).toMatchObject({ before: { status: 'OPEN' }, after: { status: 'CANCELLED' }, reason: 'Giảng viên ốm' });
    const again = await call(ownerA, 'post', url(orgA, `/classes/${k.body.id}/cancel`), { reason: 'Lần hai' });
    expect(again.status).toBe(409);
  });

  it('lưu trữ thay xoá: khoá vẫn còn, danh sách mặc định ẩn, includeArchived=true hiện; không mở lớp mới được', async () => {
    const { course } = await multi(orgA, ownerA, { name: `Lưu trữ ${uniq()}` });
    const res = await call(ownerA, 'post', url(orgA, `/courses/${course.id}/archive`), { reason: 'Ngừng dạy' });
    expect(res.status).toBe(200);
    expect(res.body.course.archivedAt).not.toBeNull();
    const list = await call(ownerA, 'get', url(orgA, '/courses')).expect(200);
    expect((list.body.items as Course[]).some((c) => c.id === course.id)).toBe(false);
    const all = await call(ownerA, 'get', url(orgA, '/courses'), { includeArchived: 'true' }).expect(200);
    expect((all.body.items as Course[]).some((c) => c.id === course.id)).toBe(true);
    expect(await db.course.count({ where: { id: course.id } })).toBe(1);
    expect((await openClass(course.id)).status).toBe(409);
    expect((await call(ownerA, 'post', url(orgA, `/courses/${course.id}/archive`), { reason: 'Lần hai' })).status).toBe(409);
  });
});

describe('Tình trạng chỗ (seatState dùng chung)', () => {
  it('đúng 3 mức: còn chỗ < 75%, sắp đầy ≥ 75%, hết chỗ = tối đa', async () => {
    const { course } = await multi();
    const k = await openClass(course.id, { capacity: 4 }).expect(201);
    const state = async (n: number) => {
      await setEnrolled(k.body.id, n);
      const res = await call(ownerA, 'get', url(orgA, `/courses/${course.id}`)).expect(200);
      const c = (res.body.classes as ClassView[]).find((x) => x.id === k.body.id);
      return [c?.seatState, c?.seatsLeft];
    };
    expect(await state(2)).toEqual(['AVAILABLE', 2]);
    expect(await state(3)).toEqual(['ALMOST_FULL', 1]);
    expect(await state(4)).toEqual(['FULL', 0]);
    const list = await call(ownerA, 'get', url(orgA, '/classes'), { courseId: course.id, hasSeats: 'true' }).expect(200);
    expect(list.body.items).toEqual([]);
    const summary = (await call(ownerA, 'get', url(orgA, '/courses')).expect(200)).body.items.find((c: Course) => c.id === course.id);
    expect(summary.classSummary).toMatchObject({ total: 1, open: 1, withSeats: 0 });
  });
});

describe('Sửa một phần: trường không gửi giữ nguyên', () => {
  it('PATCH khoá chỉ đổi tên → mọi trường khác giữ nguyên; nhật ký có trước → sau', async () => {
    const { course } = await multi(orgA, ownerA, {
      groupId: groupA, depositAmount: 500_000, sessionCount: 10, sessionMinutes: 120, description: 'Mô tả', sortOrder: 4,
    });
    const res = await call(ownerA, 'patch', url(orgA, `/courses/${course.id}`), { name: 'Tên mới hẳn' });
    expect(res.status).toBe(200);
    const { name: _n, ...rest } = course;
    const { name, updatedAt: _u, ...restAfter } = res.body.course as Course & { updatedAt: string };
    expect(name).toBe('Tên mới hẳn');
    const { updatedAt: _u0, ...restBefore } = rest as Course & { updatedAt: string };
    expect(restAfter).toEqual(restBefore);
    const log = await db.auditLog.findFirstOrThrow({ where: { organizationId: orgA, action: 'course.updated', entityId: course.id } });
    expect(log.data).toMatchObject({ before: { name: course.name, depositAmount: 500_000 }, after: { name: 'Tên mới hẳn', depositAmount: 500_000 } });
  });

  it('PATCH lớp chỉ đổi ghi chú → giờ, ngày, số tối đa, giảng viên, cơ sở giữ nguyên', async () => {
    const { course } = await multi();
    const k = await openClass(course.id, { capacity: 7, instructorMembershipId: instructorA, studioLocationId: locationA, note: 'cũ' }).expect(201);
    const res = await call(ownerA, 'patch', url(orgA, `/classes/${k.body.id}`), { note: 'mới' });
    expect(res.status).toBe(200);
    expect({ ...res.body, note: 'cũ' }).toEqual(k.body);
  });

  it('PATCH khoá Một lớp đổi tên → tên lớp đi theo tên khoá', async () => {
    const { course, classes } = await single();
    const res = await call(ownerA, 'patch', url(orgA, `/courses/${course.id}`), { name: 'Khoá đổi tên Một lớp' });
    expect(res.status).toBe(200);
    expect(res.body.classes[0]).toMatchObject({ id: classes[0]?.id, name: 'Khoá đổi tên Một lớp' });
  });

  it('PATCH nhóm chỉ đổi tên → thứ tự, ẩn/hiện giữ nguyên; danh sách nhóm đếm số khoá chưa lưu trữ', async () => {
    const g = await call(ownerA, 'post', url(orgA, '/course-groups'), { name: `Nhóm ${uniq()}`, sortOrder: 3 }).expect(201);
    await call(ownerA, 'patch', url(orgA, `/course-groups/${g.body.id}`), { isActive: false }).expect(200);
    const res = await call(ownerA, 'patch', url(orgA, `/course-groups/${g.body.id}`), { name: 'Nhóm đổi tên' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Nhóm đổi tên', sortOrder: 3, isActive: false });
    await multi(orgA, ownerA, { groupId: g.body.id });
    const archived = await multi(orgA, ownerA, { groupId: g.body.id });
    await call(ownerA, 'post', url(orgA, `/courses/${archived.course.id}/archive`), { reason: 'Thử' }).expect(200);
    const list = await call(ownerA, 'get', url(orgA, '/course-groups')).expect(200);
    expect(list.body.items.find((x: { id: string }) => x.id === g.body.id)).toMatchObject({ courseCount: 1 });
  });
});

describe('Cách ly tổ chức: mã của tổ chức khác → 404 giống mã bịa', () => {
  it('đường dẫn có id khoá / lớp / nhóm của A, gọi từ B → 404 như mã bịa; dữ liệu A không đổi', async () => {
    const { course, classes } = await single();
    const cls = classes[0] as ClassView;
    const pairs: [string, 'get' | 'post' | 'patch', (id: string) => string, Body | undefined][] = [
      [course.id, 'get', (id) => `/courses/${id}`, undefined],
      [course.id, 'patch', (id) => `/courses/${id}`, { name: 'Chiếm' }],
      [course.id, 'post', (id) => `/courses/${id}/archive`, { reason: 'Chiếm' }],
      [course.id, 'post', (id) => `/courses/${id}/classes`, { name: 'Chiếm', ...firstClass() }],
      [cls.id, 'patch', (id) => `/classes/${id}`, { note: 'Chiếm' }],
      [cls.id, 'post', (id) => `/classes/${id}/cancel`, { reason: 'Chiếm' }],
      [cls.id, 'get', (id) => `/classes/${id}/enrollments`, undefined],
      [groupA, 'patch', (id) => `/course-groups/${id}`, { name: 'Chiếm' }],
    ];
    for (const [id, method, path, body] of pairs) {
      const fake = randomUUID();
      const real = await call(ownerB, method, url(orgB, path(id)), body);
      const probe = await call(ownerB, method, url(orgB, path(fake)), body);
      expect(real.status, `${method} ${path('…')}`).toBe(404);
      expect(norm(real.body, [id])).toBe(norm(probe.body, [fake]));
    }
    const after = await db.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(after.name).toBe(course.name);
    expect(after.archivedAt).toBeNull();
    expect(await db.courseClass.count({ where: { courseId: course.id } })).toBe(1);
  });

  it('thân trỏ nhóm / giảng viên / cơ sở của A khi tạo, sửa ở B → 404 như mã bịa', async () => {
    const { course: courseB } = await multi(orgB, ownerB);
    const k = await openClass(courseB.id, {}, orgB, ownerB).expect(201);
    const cases: [string, 'post' | 'patch', string, (v: string) => Body][] = [
      [groupA, 'post', '/courses', (v) => ({ name: 'X', mode: 'MULTI_CLASS', tuitionFee: 1, defaultCapacity: 1, groupId: v })],
      [instructorA, 'post', '/courses', (v) => ({ name: 'X', mode: 'SINGLE_CLASS', tuitionFee: 1, defaultCapacity: 1, firstClass: firstClass({ instructorMembershipId: v }) })],
      [locationA, 'post', '/courses', (v) => ({ name: 'X', mode: 'SINGLE_CLASS', tuitionFee: 1, defaultCapacity: 1, firstClass: firstClass({ studioLocationId: v }) })],
      [groupA, 'patch', `/courses/${courseB.id}`, (v) => ({ groupId: v })],
      [instructorA, 'post', `/courses/${courseB.id}/classes`, (v) => ({ name: `L${uniq()}`, ...firstClass(), instructorMembershipId: v })],
      [locationA, 'post', `/courses/${courseB.id}/classes`, (v) => ({ name: `L${uniq()}`, ...firstClass(), studioLocationId: v })],
      [instructorA, 'patch', `/classes/${k.body.id}`, (v) => ({ instructorMembershipId: v })],
      [locationA, 'patch', `/classes/${k.body.id}`, (v) => ({ studioLocationId: v })],
    ];
    const countB = await db.course.count({ where: { organizationId: orgB } });
    for (const [id, method, path, body] of cases) {
      const fake = randomUUID();
      const real = await call(ownerB, method, url(orgB, path), body(id));
      const probe = await call(ownerB, method, url(orgB, path), body(fake));
      expect(real.status, `${method} ${path} ${JSON.stringify(body('…'))}`).toBe(404);
      expect(norm(real.body, [id])).toBe(norm(probe.body, [fake]));
    }
    expect(await db.course.count({ where: { organizationId: orgB } })).toBe(countB);
    const row = await db.courseClass.findUniqueOrThrow({ where: { id: k.body.id } });
    expect(row.instructorMembershipId).toBeNull();
    expect(row.studioLocationId).toBeNull();
    // Mẫu gốc dùng mã của chính B thì chạy được (phép trên không bị chặn sớm vì lý do khác).
    await call(ownerB, 'patch', url(orgB, `/classes/${k.body.id}`), { instructorMembershipId: instructorB, studioLocationId: locationB }).expect(200);
    await call(ownerB, 'patch', url(orgB, `/courses/${courseB.id}`), { groupId: groupB }).expect(200);
  });

  it('lọc danh sách bằng mã của A ở B → rỗng, giống mã bịa; danh sách B không chứa gì của A', async () => {
    const { course } = await single();
    const real = await call(ownerB, 'get', url(orgB, '/classes'), { courseId: course.id }).expect(200);
    expect(real.body.items).toEqual([]);
    const byGroup = await call(ownerB, 'get', url(orgB, '/courses'), { groupId: groupA }).expect(200);
    expect(byGroup.body.items).toEqual([]);
    const all = JSON.stringify((await call(ownerB, 'get', url(orgB, '/classes')).expect(200)).body);
    expect(all.includes(course.id)).toBe(false);
  });
});

describe('Danh sách lớp và học viên của lớp', () => {
  it('GET /classes lọc theo khoảng ngày, giảng viên; GET enrollments trả danh sách (rỗng khi chưa ai ghi danh)', async () => {
    const { course } = await multi();
    const k1 = await openClass(course.id, { name: 'Tháng 11', startDate: '2026-11-01', endDate: '2026-11-30', instructorMembershipId: instructorA }).expect(201);
    await openClass(course.id, { name: 'Tháng 1', startDate: '2027-01-05', endDate: '2027-01-30' }).expect(201);
    const nov = await call(ownerA, 'get', url(orgA, '/classes'), { courseId: course.id, from: '2026-11-15', to: '2026-12-15' }).expect(200);
    expect((nov.body.items as ClassView[]).map((c) => c.id)).toEqual([k1.body.id]);
    const byInstructor = await call(ownerA, 'get', url(orgA, '/classes'), { courseId: course.id, instructorId: instructorA }).expect(200);
    expect((byInstructor.body.items as ClassView[]).map((c) => c.id)).toEqual([k1.body.id]);
    const en = await call(readerA, 'get', url(orgA, `/classes/${k1.body.id}/enrollments`)).expect(200);
    expect(en.body.items).toEqual([]);
  });
});
