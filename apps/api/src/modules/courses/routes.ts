// Khoá & lớp (bản vẽ C3 mục 1.3) — thợ gói M3 giữ thư mục này. Điều phối đăng ký mảng courseRoutes ở app.ts một lần.
// Mọi đường: tổ chức phải là ACADEMY (403 "Tổ chức chưa bật đào tạo"), quyền courses.read / courses.write.
import { defineRoute, mustOrg, mustUser, type AnyRoute, type HandlerCtx } from '../../http/route';
import {
  ArchiveCourseBody,
  CancelClassBody,
  ClassParams,
  CourseParams,
  CreateClassBody,
  CreateCourseBody,
  CreateGroupBody,
  GroupParams,
  ListClassesQuery,
  ListCoursesQuery,
  OrgParams,
  UpdateClassBody,
  UpdateCourseBody,
  UpdateGroupBody,
} from './schemas';
import {
  archiveCourse,
  assertAcademy,
  cancelClass,
  courseWithClasses,
  createClass,
  createCourse,
  createGroup,
  listClasses,
  listCourses,
  listEnrollments,
  listGroups,
  updateClass,
  updateCourse,
  updateGroup,
  type Actor,
} from './service';

const TAG = 'Khoá & lớp';

// Ngữ cảnh chung của mọi handler: chặn tổ chức chưa bật đào tạo TRƯỚC mọi tra cứu khác.
async function academy(ctx: Pick<HandlerCtx<unknown, unknown, unknown>, 'deps' | 'org' | 'userId' | 'requestId'>) {
  const o = mustOrg(ctx.org);
  const { timezone } = await assertAcademy(ctx.deps.db, o.id);
  const actor: Actor = { orgId: o.id, userId: mustUser(ctx.userId), requestId: ctx.requestId };
  return { o, actor, timezone };
}

export const courseRoutes: AnyRoute[] = [
  // ---------- Nhóm khoá ----------
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/course-groups',
    scope: 'org',
    permission: 'courses.read',
    tag: TAG,
    summary: 'Danh sách nhóm khoá (kèm số khoá chưa lưu trữ trong nhóm)',
    params: OrgParams,
    handler: async (ctx) => {
      const { o } = await academy(ctx);
      return { body: { items: await listGroups(ctx.deps.db, o.id) } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/course-groups',
    idempotent: true,
    scope: 'org',
    permission: 'courses.write',
    tag: TAG,
    summary: 'Thêm nhóm khoá (tên duy nhất trong tổ chức)',
    params: OrgParams,
    body: CreateGroupBody,
    handler: async (ctx) => {
      const { actor } = await academy(ctx);
      const group = await ctx.deps.db.$transaction((tx) => createGroup(tx, actor, ctx.body));
      return { status: 201, body: group };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/course-groups/:groupId',
    scope: 'org',
    permission: 'courses.write',
    tag: TAG,
    summary: 'Sửa nhóm khoá (đổi tên, thứ tự, ẩn/hiện — không xoá); trường không gửi giữ nguyên',
    params: GroupParams,
    body: UpdateGroupBody,
    handler: async (ctx) => {
      const { actor } = await academy(ctx);
      return { body: await ctx.deps.db.$transaction((tx) => updateGroup(tx, actor, ctx.params.groupId, ctx.body)) };
    },
  }),

  // ---------- Khoá ----------
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/courses',
    scope: 'org',
    permission: 'courses.read',
    tag: TAG,
    summary: 'Danh sách khoá (lọc nhóm, tìm tên/mã; mặc định ẩn khoá đã lưu trữ) kèm tóm tắt lớp',
    params: OrgParams,
    query: ListCoursesQuery,
    handler: async (ctx) => {
      const { o, timezone } = await academy(ctx);
      return { body: { items: await listCourses(ctx.deps.db, o.id, ctx.query, timezone) } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/courses',
    idempotent: true,
    scope: 'org',
    permission: 'courses.write',
    tag: TAG,
    summary: 'Thêm khoá; khoá Một lớp bắt buộc firstClass (tên lớp = tên khoá), Nhiều lớp thì firstClass tuỳ chọn và cần tên lớp',
    params: OrgParams,
    body: CreateCourseBody,
    handler: async (ctx) => {
      const { actor } = await academy(ctx);
      const result = await ctx.deps.db.$transaction((tx) => createCourse(tx, actor, ctx.body));
      return { status: 201, body: result };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/courses/:courseId',
    scope: 'org',
    permission: 'courses.read',
    tag: TAG,
    summary: 'Chi tiết khoá và các lớp (ClassView)',
    params: CourseParams,
    handler: async (ctx) => {
      const { o } = await academy(ctx);
      return { body: await courseWithClasses(ctx.deps.db, o.id, ctx.params.courseId) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/courses/:courseId',
    scope: 'org',
    permission: 'courses.write',
    tag: TAG,
    summary:
      'Sửa khoá; đổi Một lớp → Nhiều lớp giữ nguyên lớp hiện có (firstClassName để đặt tên), Nhiều → Một chỉ khi còn đúng 1 lớp chưa huỷ',
    params: CourseParams,
    body: UpdateCourseBody,
    handler: async (ctx) => {
      const { actor } = await academy(ctx);
      return { body: await ctx.deps.db.$transaction((tx) => updateCourse(tx, actor, ctx.params.courseId, ctx.body)) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/courses/:courseId/archive',
    scope: 'org',
    permission: 'courses.write',
    tag: TAG,
    summary: 'Lưu trữ khoá (thay cho xoá; cần lý do). Khoá đã lưu trữ ẩn khỏi danh sách, không mở lớp mới',
    params: CourseParams,
    body: ArchiveCourseBody,
    handler: async (ctx) => {
      const { actor } = await academy(ctx);
      return { body: await ctx.deps.db.$transaction((tx) => archiveCourse(tx, actor, ctx.params.courseId, ctx.body.reason)) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/courses/:courseId/classes',
    idempotent: true,
    scope: 'org',
    permission: 'courses.write',
    tag: TAG,
    summary: 'Mở lớp cho khoá Nhiều lớp (khoá Một lớp → 409); bỏ trống capacity = số tối đa mặc định của khoá',
    params: CourseParams,
    body: CreateClassBody,
    handler: async (ctx) => {
      const { actor } = await academy(ctx);
      const view = await ctx.deps.db.$transaction((tx) => createClass(tx, actor, ctx.params.courseId, ctx.body));
      return { status: 201, body: view };
    },
  }),

  // ---------- Lớp ----------
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/classes',
    scope: 'org',
    permission: 'courses.read',
    tag: TAG,
    summary: 'Danh sách lớp (lọc khoảng ngày, khoá, giảng viên, còn chỗ) — dùng cho ô chọn lớp ở hợp đồng và Lịch',
    params: OrgParams,
    query: ListClassesQuery,
    handler: async (ctx) => {
      const { o } = await academy(ctx);
      return { body: { items: await listClasses(ctx.deps.db, o.id, ctx.query) } };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/classes/:classId',
    scope: 'org',
    permission: 'courses.write',
    tag: TAG,
    summary: 'Sửa lớp (lịch, số tối đa — không thấp hơn số đã ghi danh, giảng viên, cơ sở, mở/đóng); trường không gửi giữ nguyên',
    params: ClassParams,
    body: UpdateClassBody,
    handler: async (ctx) => {
      const { actor } = await academy(ctx);
      return { body: await ctx.deps.db.$transaction((tx) => updateClass(tx, actor, ctx.params.classId, ctx.body)) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/classes/:classId/cancel',
    scope: 'org',
    permission: 'courses.write',
    tag: TAG,
    summary: 'Huỷ lớp (cần lý do); lớp còn học viên → 409',
    params: ClassParams,
    body: CancelClassBody,
    handler: async (ctx) => {
      const { actor } = await academy(ctx);
      return { body: await ctx.deps.db.$transaction((tx) => cancelClass(tx, actor, ctx.params.classId, ctx.body.reason)) };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/classes/:classId/enrollments',
    scope: 'org',
    permission: 'courses.read',
    tag: TAG,
    summary: 'Học viên của lớp (số điện thoại cần customers.read; tiền hợp đồng cần contracts.read hoặc payments.read)',
    params: ClassParams,
    handler: async (ctx) => {
      const { o } = await academy(ctx);
      return { body: { items: await listEnrollments(ctx.deps.db, o.id, ctx.params.classId, o) } };
    },
  }),
];
