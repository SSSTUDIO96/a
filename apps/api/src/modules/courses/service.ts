// Nghiệp vụ Khoá & lớp (bản vẽ C3 mục 1.0–1.3). Mọi tra cứu theo (id, tổ chức): mã của tổ chức khác trả đúng lỗi
// như mã bịa (404). Mọi thay đổi ghi nhật ký trước → sau trong CÙNG transaction.
// Database là lưới cuối (CHECK, trigger course_classes_single_guard / courses_single_mode_guard); máy chủ kiểm TRƯỚC,
// dưới khoá dòng, để người dùng nhận 409 kèm lời rõ ràng thay vì lỗi ràng buộc.
import { Prisma } from '@prisma/client';
import { timeToMinutes, type Permission } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { assertQuota } from '../../lib/quota';
import {
  classSelect,
  classSummary,
  classValues,
  courseSelect,
  courseValues,
  dateFromWire,
  groupSelect,
  hasSeats,
  presentClass,
  presentCourse,
  presentGroup,
  todayIn,
  type ClassRow,
  type CourseRow,
} from './present';
import type {
  CreateClassInput,
  CreateCourseInput,
  FirstClassInput,
  ListClassesInput,
  UpdateClassInput,
  UpdateCourseInput,
} from './schemas';

type Tx = Prisma.TransactionClient;

export interface Actor {
  orgId: string;
  userId: string;
  requestId: string;
}

export const ACADEMY_REQUIRED_MESSAGE = 'Tổ chức chưa bật đào tạo';
export const SINGLE_CLASS_MESSAGE = 'Khoá một lớp chỉ có một lớp — chuyển sang Nhiều lớp để mở thêm';

// ---------- Lỗi ----------

// Lỗi dữ liệu 400 cùng dạng lỗi zod (details.issues chỉ đúng trường) để web đặt lỗi đúng ô.
export function fieldError(path: string, message: string): AppError {
  const root = path.split('.')[0] ?? path;
  return new AppError('VALIDATION_FAILED', message, {
    formErrors: [],
    fieldErrors: { [root]: [message] },
    issues: [{ path, message }],
  });
}

const notFound = {
  course: () => new AppError('NOT_FOUND', 'Không tìm thấy khoá học'),
  class: () => new AppError('NOT_FOUND', 'Không tìm thấy lớp'),
  group: () => new AppError('NOT_FOUND', 'Không tìm thấy nhóm khoá'),
  instructor: () => new AppError('NOT_FOUND', 'Không tìm thấy giảng viên'),
  location: () => new AppError('NOT_FOUND', 'Không tìm thấy cơ sở'),
};

// Đổi lỗi trùng khoá duy nhất thành 409 có lời rõ ràng; lỗi khác ném nguyên.
async function uniqueOr409<T>(work: Promise<T>, message: string): Promise<T> {
  try {
    return await work;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('CONFLICT', message, { fields: err.meta?.target });
    }
    throw err;
  }
}

// ---------- Bật đào tạo ----------

// Mọi đường /course-groups, /courses, /classes: tổ chức phải là ACADEMY (bản vẽ C3 mục 1.0). Trả múi giờ để tính "hôm nay".
export async function assertAcademy(db: Tx, orgId: string): Promise<{ timezone: string }> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { kind: true, timezone: true } });
  if (!org) throw new AppError('NOT_FOUND', 'Không tìm thấy tổ chức');
  if (org.kind !== 'ACADEMY') throw new AppError('FORBIDDEN', ACADEMY_REQUIRED_MESSAGE, { reason: 'ACADEMY_REQUIRED' });
  return { timezone: org.timezone };
}

// ---------- Khoá dòng + tra cứu theo tổ chức ----------

async function lockCourse(tx: Tx, orgId: string, courseId: string): Promise<CourseRow> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM courses WHERE id = ${courseId}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound.course();
  return tx.course.findUniqueOrThrow({ where: { id: courseId }, select: courseSelect });
}

async function lockClass(tx: Tx, orgId: string, classId: string): Promise<ClassRow> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM course_classes WHERE id = ${classId}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound.class();
  return tx.courseClass.findUniqueOrThrow({ where: { id: classId }, select: classSelect });
}

async function assertGroup(tx: Tx, orgId: string, groupId: string): Promise<void> {
  const g = await tx.courseGroup.findFirst({ where: { id: groupId, organizationId: orgId }, select: { id: true } });
  if (!g) throw notFound.group();
}

async function assertInstructor(tx: Tx, orgId: string, membershipId: string, path: string): Promise<void> {
  const m = await tx.membership.findFirst({ where: { id: membershipId, organizationId: orgId }, select: { status: true } });
  if (!m) throw notFound.instructor();
  if (m.status !== 'ACTIVE') throw fieldError(path, 'Giảng viên không còn hoạt động trong tổ chức');
}

async function assertLocation(tx: Tx, orgId: string, locationId: string, path: string): Promise<void> {
  const l = await tx.studioLocation.findFirst({ where: { id: locationId, organizationId: orgId }, select: { isActive: true } });
  if (!l) throw notFound.location();
  if (!l.isActive) throw fieldError(path, 'Cơ sở đã ngừng hoạt động');
}

// Kiểm mọi mã tham chiếu của một lớp (chỉ những mã có giá trị và khác bản đang lưu).
async function assertClassRefs(
  tx: Tx,
  orgId: string,
  refs: { instructorMembershipId?: string | null; studioLocationId?: string | null },
  prefix: string,
  current?: { instructorMembershipId: string | null; studioLocationId: string | null },
): Promise<void> {
  const { instructorMembershipId: ins, studioLocationId: loc } = refs;
  if (ins && ins !== current?.instructorMembershipId) await assertInstructor(tx, orgId, ins, `${prefix}instructorMembershipId`);
  if (loc && loc !== current?.studioLocationId) await assertLocation(tx, orgId, loc, `${prefix}studioLocationId`);
}

// ---------- Lịch học của lớp ----------

interface Schedule {
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
}

// Kiểm chéo trường của lịch (trên giá trị đã gộp) và đổi giờ → phút. Lời báo khớp CHECK của migration đào tạo.
export function scheduleMinutes(s: Schedule, prefix: string): { startMinute: number | null; endMinute: number | null } {
  if (s.endDate < s.startDate) throw fieldError(`${prefix}endDate`, 'Ngày kết thúc phải từ ngày bắt đầu trở đi');
  if ((s.startTime === null) !== (s.endTime === null)) {
    const missing = s.startTime === null ? 'startTime' : 'endTime';
    throw fieldError(`${prefix}${missing}`, 'Giờ học nhập đủ cả giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai');
  }
  if (s.startTime === null || s.endTime === null) return { startMinute: null, endMinute: null };
  const startMinute = timeToMinutes(s.startTime);
  const endMinute = timeToMinutes(s.endTime);
  if (startMinute > 1439) throw fieldError(`${prefix}startTime`, 'Giờ bắt đầu không được là 24:00');
  if (endMinute <= startMinute) throw fieldError(`${prefix}endTime`, 'Giờ kết thúc phải sau giờ bắt đầu');
  return { startMinute, endMinute };
}

const sortWeekdays = (w: number[]) => [...w].sort((a, b) => a - b);

function assertDeposit(tuitionFee: number, depositAmount: number, path: string): void {
  if (depositAmount > tuitionFee) throw fieldError(path, 'Cọc mặc định không được lớn hơn học phí');
}

// ---------- Mã khoá tự sinh ----------

// KH-0001, KH-0002… theo tổ chức (bộ đếm org_counters khoá 'course', câu lệnh khoá dòng bộ đếm nên gửi đồng thời không
// trùng). Mã tự sinh trùng mã người dùng đã tự đặt thì lấy số kế tiếp.
async function nextCourseCode(tx: Tx, orgId: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const rows = await tx.$queryRaw<{ value: number }[]>`
      INSERT INTO org_counters (organization_id, key, value) VALUES (${orgId}::uuid, 'course', 1)
      ON CONFLICT (organization_id, key) DO UPDATE SET value = org_counters.value + 1
      RETURNING value`;
    const value = rows[0]?.value;
    if (value === undefined) throw new Error('Bộ đếm mã khoá học không trả giá trị');
    const code = `KH-${String(value).padStart(4, '0')}`;
    const taken = await tx.course.findFirst({ where: { organizationId: orgId, code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error('Không sinh được mã khoá học sau 100 lần thử — kiểm bộ đếm org_counters');
}

// ---------- Đọc ----------

const classOrder = [{ startDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] satisfies Prisma.CourseClassOrderByWithRelationInput[];

async function classesOf(db: Tx, orgId: string, courseId: string) {
  const rows = await db.courseClass.findMany({ where: { organizationId: orgId, courseId }, select: classSelect, orderBy: classOrder });
  return rows.map(presentClass);
}

export async function courseWithClasses(db: Tx, orgId: string, courseId: string) {
  const course = await db.course.findFirst({ where: { id: courseId, organizationId: orgId }, select: courseSelect });
  if (!course) throw notFound.course();
  return { course: presentCourse(course), classes: await classesOf(db, orgId, courseId) };
}

export async function listGroups(db: Tx, orgId: string) {
  const [groups, counts] = await Promise.all([
    db.courseGroup.findMany({
      where: { organizationId: orgId },
      select: groupSelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    }),
    db.course.groupBy({ by: ['groupId'], where: { organizationId: orgId, archivedAt: null, groupId: { not: null } }, _count: { _all: true } }),
  ]);
  const byGroup = new Map(counts.map((c) => [c.groupId, c._count._all]));
  return groups.map((g) => presentGroup(g, byGroup.get(g.id) ?? 0));
}

export async function listCourses(
  db: Tx,
  orgId: string,
  q: { groupId?: string; q?: string; includeArchived?: boolean },
  timezone: string,
) {
  const search = q.q?.trim();
  const courses = await db.course.findMany({
    where: {
      organizationId: orgId,
      ...(q.groupId ? { groupId: q.groupId } : {}),
      ...(q.includeArchived ? {} : { archivedAt: null }),
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] }
        : {}),
    },
    select: courseSelect,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  });
  const classes = courses.length
    ? await db.courseClass.findMany({
        where: { organizationId: orgId, courseId: { in: courses.map((c) => c.id) } },
        select: classSelect,
        orderBy: classOrder,
      })
    : [];
  const byCourse = new Map<string, ClassRow[]>();
  for (const k of classes) byCourse.set(k.courseId, [...(byCourse.get(k.courseId) ?? []), k]);
  const today = todayIn(timezone);
  return courses.map((c) => {
    const own = byCourse.get(c.id) ?? [];
    // Khoá Một lớp: kèm luôn lớp duy nhất chưa huỷ để dòng danh sách hiện "31/10–21/11 · 7/10 học viên".
    const live = c.mode === 'SINGLE_CLASS' ? own.find((k) => k.status !== 'CANCELLED') : undefined;
    return {
      ...presentCourse(c),
      classSummary: classSummary(own, today),
      singleClass: live ? presentClass(live) : null,
    };
  });
}

export async function listClasses(db: Tx, orgId: string, q: ListClassesInput) {
  if (q.from && q.to && q.to < q.from) throw fieldError('to', 'Ngày kết thúc khoảng lọc phải từ ngày bắt đầu trở đi');
  const rows = await db.courseClass.findMany({
    where: {
      organizationId: orgId,
      ...(q.courseId ? { courseId: q.courseId } : {}),
      ...(q.instructorId ? { instructorMembershipId: q.instructorId } : {}),
      ...(q.includeCancelled ? {} : { status: { not: 'CANCELLED' } }),
      ...(q.includeArchived ? {} : { course: { archivedAt: null } }),
      // Lớp giao với khoảng [from, to].
      ...(q.from ? { endDate: { gte: dateFromWire(q.from) } } : {}),
      ...(q.to ? { startDate: { lte: dateFromWire(q.to) } } : {}),
    },
    select: { ...classSelect, course: { select: { id: true, code: true, name: true, mode: true } } },
    orderBy: classOrder,
  });
  return rows
    .filter((k) => q.hasSeats === undefined || hasSeats(k) === q.hasSeats)
    .map((k) => ({ ...presentClass(k), course: k.course }));
}

// Học viên của lớp. Số điện thoại khách chỉ trả cho người có quyền xem khách (customers.read); tiền hợp đồng chỉ trả
// cho người xem được hợp đồng hoặc thu tiền (contracts.read / payments.read) — courses.read của giảng viên không kéo
// theo hai quyền này (cùng luật biên bản máy chủ lát 2, N5).
export async function listEnrollments(db: Tx, orgId: string, classId: string, viewer: { permissions: ReadonlySet<Permission> }) {
  const k = await db.courseClass.findFirst({ where: { id: classId, organizationId: orgId }, select: { id: true } });
  if (!k) throw notFound.class();
  const rows = await db.enrollment.findMany({
    where: { organizationId: orgId, courseClassId: classId },
    select: {
      id: true,
      status: true,
      enrolledAt: true,
      cancelledAt: true,
      cancelReason: true,
      customer: { select: { id: true, fullName: true, phone: true } },
      contract: { select: { id: true, code: true, status: true, total: true } },
    },
    orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }],
  });
  const showPhone = viewer.permissions.has('customers.read');
  const showMoney = viewer.permissions.has('contracts.read') || viewer.permissions.has('payments.read');
  const paid = new Map<string, bigint>();
  if (showMoney && rows.length > 0) {
    const sums = await db.payment.groupBy({
      by: ['contractId', 'kind'],
      where: { organizationId: orgId, contractId: { in: [...new Set(rows.map((r) => r.contract.id))] }, voidedAt: null },
      _sum: { amount: true },
    });
    for (const s of sums) {
      const amount = s._sum.amount ?? 0n;
      paid.set(s.contractId, (paid.get(s.contractId) ?? 0n) + (s.kind === 'RECEIPT' ? amount : -amount));
    }
  }
  return rows.map((r) => ({
    id: r.id,
    customer: showPhone
      ? { ...r.customer, phoneHidden: false }
      : { id: r.customer.id, fullName: r.customer.fullName, phone: null, phoneHidden: true },
    contract: {
      id: r.contract.id,
      code: r.contract.code,
      status: r.contract.status,
      total: showMoney ? Number(r.contract.total) : null,
      paid: showMoney ? Number(paid.get(r.contract.id) ?? 0n) : null,
    },
    status: r.status,
    enrolledAt: r.enrolledAt,
    cancelledAt: r.cancelledAt,
    cancelReason: r.cancelReason,
  }));
}

// ---------- Nhóm khoá ----------

export async function createGroup(tx: Tx, a: Actor, body: { name: string; sortOrder?: number }) {
  const created = await uniqueOr409(
    tx.courseGroup.create({
      data: { organizationId: a.orgId, name: body.name, sortOrder: body.sortOrder ?? 0 },
      select: groupSelect,
    }),
    `Đã có nhóm khoá tên "${body.name}"`,
  );
  await writeAudit(tx, {
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: 'course_group.created',
    entityType: 'course_group',
    entityId: created.id,
    data: { before: null, after: { name: created.name, sortOrder: created.sortOrder, isActive: created.isActive } },
    requestId: a.requestId,
  });
  return presentGroup(created);
}

export async function updateGroup(tx: Tx, a: Actor, groupId: string, body: { name?: string; sortOrder?: number; isActive?: boolean }) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM course_groups WHERE id = ${groupId}::uuid AND organization_id = ${a.orgId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound.group();
  const before = await tx.courseGroup.findUniqueOrThrow({ where: { id: groupId }, select: groupSelect });
  const after = await uniqueOr409(
    tx.courseGroup.update({
      where: { id: groupId },
      data: { name: body.name, sortOrder: body.sortOrder, isActive: body.isActive },
      select: groupSelect,
    }),
    `Đã có nhóm khoá tên "${body.name ?? ''}"`,
  );
  const values = (g: typeof before) => ({ name: g.name, sortOrder: g.sortOrder, isActive: g.isActive });
  await writeAudit(tx, {
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: 'course_group.updated',
    entityType: 'course_group',
    entityId: groupId,
    data: { before: values(before), after: values(after) },
    requestId: a.requestId,
  });
  return presentGroup(after);
}

// ---------- Khoá ----------

// Kiểm thân tạo khoá trước khi mở transaction (lỗi dữ liệu thuần, không cần database).
function checkCreateCourse(body: CreateCourseInput): { minutes: ReturnType<typeof scheduleMinutes> | null } {
  assertDeposit(body.tuitionFee, body.depositAmount ?? 0, 'depositAmount');
  const fc = body.firstClass;
  if (body.mode === 'SINGLE_CLASS') {
    if (!fc) throw fieldError('firstClass', 'Khoá Một lớp phải nhập thời gian, lịch học và số học viên tối đa của lớp');
    if (fc.name !== undefined) throw fieldError('firstClass.name', 'Khoá Một lớp tự lấy tên khoá làm tên lớp — bỏ trường name');
  } else if (fc && fc.name === undefined) {
    throw fieldError('firstClass.name', 'Nhập tên lớp đầu tiên, ví dụ "Nâng cao K1"');
  }
  if (!fc) return { minutes: null };
  return { minutes: scheduleMinutes(scheduleOf(fc), 'firstClass.') };
}

function scheduleOf(c: { startDate: string; endDate: string; startTime?: string | null; endTime?: string | null }): Schedule {
  return { startDate: c.startDate, endDate: c.endDate, startTime: c.startTime ?? null, endTime: c.endTime ?? null };
}

function classCreateData(
  a: Actor,
  courseId: string,
  name: string,
  c: FirstClassInput | CreateClassInput,
  minutes: { startMinute: number | null; endMinute: number | null },
  defaultCapacity: number,
): Prisma.CourseClassUncheckedCreateInput {
  return {
    organizationId: a.orgId,
    courseId,
    name,
    startDate: dateFromWire(c.startDate),
    endDate: dateFromWire(c.endDate),
    weekdays: sortWeekdays(c.weekdays),
    startMinute: minutes.startMinute,
    endMinute: minutes.endMinute,
    capacity: c.capacity ?? defaultCapacity,
    instructorMembershipId: c.instructorMembershipId ?? null,
    studioLocationId: c.studioLocationId ?? null,
    note: c.note ?? null,
    createdById: a.userId,
  };
}

export async function createCourse(tx: Tx, a: Actor, body: CreateCourseInput) {
  const { minutes } = checkCreateCourse(body);
  await assertQuota(tx, a.orgId, 'courses');
  if (body.groupId) await assertGroup(tx, a.orgId, body.groupId);
  if (body.firstClass) await assertClassRefs(tx, a.orgId, body.firstClass, 'firstClass.');
  const code = body.code ?? (await nextCourseCode(tx, a.orgId));
  const course = await uniqueOr409(
    tx.course.create({
      data: {
        organizationId: a.orgId,
        groupId: body.groupId ?? null,
        code,
        name: body.name,
        mode: body.mode,
        tuitionFee: BigInt(body.tuitionFee),
        depositAmount: BigInt(body.depositAmount ?? 0),
        defaultCapacity: body.defaultCapacity,
        sessionCount: body.sessionCount ?? null,
        sessionMinutes: body.sessionMinutes ?? null,
        description: body.description ?? null,
        sortOrder: body.sortOrder ?? 0,
        createdById: a.userId,
      },
      select: courseSelect,
    }),
    `Mã khoá "${code}" đã có trong tổ chức`,
  );
  let firstClass: ClassRow | null = null;
  if (body.firstClass && minutes) {
    const name = body.mode === 'SINGLE_CLASS' ? course.name : (body.firstClass.name ?? course.name);
    firstClass = await tx.courseClass.create({
      data: classCreateData(a, course.id, name, body.firstClass, minutes, course.defaultCapacity),
      select: classSelect,
    });
  }
  await writeAudit(tx, {
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: 'course.created',
    entityType: 'course',
    entityId: course.id,
    data: {
      before: null,
      after: { ...courseValues(course), firstClass: firstClass ? { id: firstClass.id, ...classValues(firstClass) } : null },
    },
    requestId: a.requestId,
  });
  return { course: presentCourse(course), classes: firstClass ? [presentClass(firstClass)] : [] };
}

function liveClasses(tx: Tx, orgId: string, courseId: string) {
  return tx.courseClass.findMany({
    where: { organizationId: orgId, courseId, status: { not: 'CANCELLED' } },
    select: { id: true, name: true },
    orderBy: classOrder,
  });
}

export async function updateCourse(tx: Tx, a: Actor, courseId: string, body: UpdateCourseInput) {
  const before = await lockCourse(tx, a.orgId, courseId);
  if (before.archivedAt) throw new AppError('CONFLICT', 'Khoá đã lưu trữ — không sửa được');
  const nextMode = body.mode ?? before.mode;
  const toMulti = before.mode === 'SINGLE_CLASS' && nextMode === 'MULTI_CLASS';
  if (body.firstClassName !== undefined && !toMulti) {
    throw fieldError('firstClassName', 'Chỉ đặt tên lớp khi chuyển khoá Một lớp sang Nhiều lớp');
  }
  const tuitionFee = body.tuitionFee ?? Number(before.tuitionFee);
  const depositAmount = body.depositAmount ?? Number(before.depositAmount);
  assertDeposit(tuitionFee, depositAmount, body.depositAmount !== undefined ? 'depositAmount' : 'tuitionFee');
  if (body.groupId && body.groupId !== before.groupId) await assertGroup(tx, a.orgId, body.groupId);

  const live = await liveClasses(tx, a.orgId, courseId);
  // Nhiều lớp → Một lớp: chỉ khi còn ĐÚNG 1 lớp chưa huỷ (khoá dòng khoá học ở trên: không ai mở thêm lớp xen giữa).
  if (before.mode === 'MULTI_CLASS' && nextMode === 'SINGLE_CLASS' && live.length !== 1) {
    throw new AppError(
      'CONFLICT',
      live.length === 0
        ? 'Khoá chưa có lớp nào chưa huỷ — chỉ chuyển về Một lớp khi còn 1 lớp'
        : `Khoá đang có ${live.length} lớp — chỉ chuyển về Một lớp khi còn 1 lớp`,
      { reason: 'SINGLE_MODE_NEEDS_ONE_CLASS', liveClasses: live.length },
    );
  }

  const after = await uniqueOr409(
    tx.course.update({
      where: { id: courseId },
      data: {
        name: body.name,
        groupId: body.groupId,
        code: body.code,
        tuitionFee: body.tuitionFee === undefined ? undefined : BigInt(body.tuitionFee),
        depositAmount: body.depositAmount === undefined ? undefined : BigInt(body.depositAmount),
        defaultCapacity: body.defaultCapacity,
        sessionCount: body.sessionCount,
        sessionMinutes: body.sessionMinutes,
        description: body.description,
        sortOrder: body.sortOrder,
        mode: body.mode,
      },
      select: courseSelect,
    }),
    `Mã khoá "${body.code ?? ''}" đã có trong tổ chức`,
  );

  // Đổi tên lớp đi kèm: Một → Nhiều có firstClassName; khoá (sau khi sửa) là Một lớp thì lớp duy nhất mang tên khoá.
  // Lớp giữ nguyên id, học viên, hợp đồng — không xoá, không chép.
  const only = live[0];
  const rename = toMulti ? body.firstClassName : nextMode === 'SINGLE_CLASS' ? after.name : undefined;
  let classRenamed: { id: string; from: string; to: string } | null = null;
  if (only && live.length === 1 && rename !== undefined && rename !== only.name) {
    await uniqueOr409(
      tx.courseClass.update({ where: { id: only.id }, data: { name: rename } }),
      `Khoá đã có lớp tên "${rename}" (kể cả lớp đã huỷ) — chọn tên khác`,
    );
    classRenamed = { id: only.id, from: only.name, to: rename };
  }
  await writeAudit(tx, {
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: 'course.updated',
    entityType: 'course',
    entityId: courseId,
    data: { before: courseValues(before), after: courseValues(after), classRenamed },
    requestId: a.requestId,
  });
  return { course: presentCourse(after), classes: await classesOf(tx, a.orgId, courseId) };
}

export async function archiveCourse(tx: Tx, a: Actor, courseId: string, reason: string) {
  const before = await lockCourse(tx, a.orgId, courseId);
  if (before.archivedAt) throw new AppError('CONFLICT', 'Khoá đã lưu trữ');
  const after = await tx.course.update({ where: { id: courseId }, data: { archivedAt: new Date() }, select: courseSelect });
  await writeAudit(tx, {
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: 'course.archived',
    entityType: 'course',
    entityId: courseId,
    data: { before: { archivedAt: null }, after: { archivedAt: courseValues(after).archivedAt }, reason },
    requestId: a.requestId,
  });
  return { course: presentCourse(after) };
}

// ---------- Lớp ----------

export async function createClass(tx: Tx, a: Actor, courseId: string, body: CreateClassInput) {
  const minutes = scheduleMinutes(scheduleOf(body), '');
  const course = await lockCourse(tx, a.orgId, courseId);
  if (course.archivedAt) throw new AppError('CONFLICT', 'Khoá đã lưu trữ — không mở lớp mới');
  if (course.mode === 'SINGLE_CLASS') throw new AppError('CONFLICT', SINGLE_CLASS_MESSAGE, { reason: 'SINGLE_CLASS' });
  await assertClassRefs(tx, a.orgId, body, '');
  const created = await uniqueOr409(
    tx.courseClass.create({ data: classCreateData(a, courseId, body.name, body, minutes, course.defaultCapacity), select: classSelect }),
    `Khoá đã có lớp tên "${body.name}" — chọn tên khác`,
  );
  await writeAudit(tx, {
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: 'course_class.created',
    entityType: 'course_class',
    entityId: created.id,
    data: { courseId, before: null, after: classValues(created) },
    requestId: a.requestId,
  });
  return presentClass(created);
}

export async function updateClass(tx: Tx, a: Actor, classId: string, body: UpdateClassInput) {
  const before = await lockClass(tx, a.orgId, classId);
  if (before.status === 'CANCELLED') throw new AppError('CONFLICT', 'Lớp đã huỷ — không sửa được');
  if (body.name !== undefined) {
    const course = await tx.course.findUniqueOrThrow({ where: { id: before.courseId }, select: { mode: true } });
    if (course.mode === 'SINGLE_CLASS' && body.name !== before.name) {
      throw fieldError('name', 'Lớp của khoá Một lớp mang tên khoá — đổi tên khoá để đổi tên lớp');
    }
  }
  const cur = classValues(before);
  const minutes = scheduleMinutes(
    {
      startDate: body.startDate ?? cur.startDate,
      endDate: body.endDate ?? cur.endDate,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
    },
    '',
  );
  // Hạ số tối đa xuống dưới số đã ghi danh (khoá dòng lớp ở trên: lệnh ghi danh đồng thời phải xếp hàng).
  if (body.capacity !== undefined && body.capacity < before.enrolledCount) {
    throw new AppError('CONFLICT', `Lớp đã có ${before.enrolledCount} học viên — không đặt tối đa thấp hơn ${before.enrolledCount}`, {
      reason: 'CAPACITY_BELOW_ENROLLED',
      enrolledCount: before.enrolledCount,
    });
  }
  await assertClassRefs(tx, a.orgId, body, '', before);
  const timeTouched = body.startTime !== undefined || body.endTime !== undefined;
  const after = await uniqueOr409(
    tx.courseClass.update({
      where: { id: classId },
      data: {
        name: body.name,
        startDate: body.startDate === undefined ? undefined : dateFromWire(body.startDate),
        endDate: body.endDate === undefined ? undefined : dateFromWire(body.endDate),
        weekdays: body.weekdays === undefined ? undefined : sortWeekdays(body.weekdays),
        startMinute: timeTouched ? minutes.startMinute : undefined,
        endMinute: timeTouched ? minutes.endMinute : undefined,
        capacity: body.capacity,
        instructorMembershipId: body.instructorMembershipId,
        studioLocationId: body.studioLocationId,
        status: body.status,
        note: body.note,
      },
      select: classSelect,
    }),
    `Khoá đã có lớp tên "${body.name ?? ''}" — chọn tên khác`,
  );
  await writeAudit(tx, {
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: 'course_class.updated',
    entityType: 'course_class',
    entityId: classId,
    data: { courseId: before.courseId, before: cur, after: classValues(after) },
    requestId: a.requestId,
  });
  return presentClass(after);
}

export async function cancelClass(tx: Tx, a: Actor, classId: string, reason: string) {
  const before = await lockClass(tx, a.orgId, classId);
  if (before.status === 'CANCELLED') throw new AppError('CONFLICT', 'Lớp đã huỷ');
  const active = await tx.enrollment.count({ where: { organizationId: a.orgId, courseClassId: classId, status: 'ACTIVE' } });
  const students = Math.max(before.enrolledCount, active);
  if (students > 0) {
    throw new AppError('CONFLICT', `Lớp còn ${students} học viên — chuyển hoặc huỷ ghi danh trước`, {
      reason: 'CLASS_HAS_STUDENTS',
      enrolledCount: students,
    });
  }
  const after = await tx.courseClass.update({ where: { id: classId }, data: { status: 'CANCELLED' }, select: classSelect });
  await writeAudit(tx, {
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: 'course_class.cancelled',
    entityType: 'course_class',
    entityId: classId,
    data: { courseId: before.courseId, before: { status: before.status }, after: { status: after.status }, reason },
    requestId: a.requestId,
  });
  return presentClass(after);
}
