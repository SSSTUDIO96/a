// Lỗi 23514 (vi phạm ràng buộc) từ database đi qua bộ bắt lỗi chung:
// - Hai trigger của migration đào tạo báo 23514 kèm TÊN ràng buộc course_classes_single_guard / courses_single_mode_guard và
//   lời tiếng Việt viết cho người dùng → 409 kèm ĐÚNG lời của database (giống P0001).
// - Mọi 23514 khác (CHECK thường) → giữ 400 lời chung.
// Đi trọn đường thật: route thử (createApp với bảng route riêng) ghi thẳng bằng Prisma để kích trigger.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { defineRoute } from '../src/http/route';
import { createOrg, makeApp, makeDeps, registerUser, type TestUser } from './helpers';

const deps = makeDeps();
let owner: TestUser;
let orgId: string;

beforeAll(async () => {
  const app = makeApp(deps);
  owner = await registerUser(app, 'rb-khoa');
  orgId = await createOrg(app, owner, 'rb-khoa');
});
afterAll(async () => {
  await deps.db.$disconnect();
});

const newCourse = (mode: 'SINGLE_CLASS' | 'MULTI_CLASS') =>
  deps.db.course.create({
    data: { organizationId: orgId, code: `K${randomUUID().slice(0, 6)}`, name: 'Khoá thử', mode, tuitionFee: 1_000_000n, defaultCapacity: 10, createdById: owner.id },
  });
const newClass = (courseId: string) =>
  deps.db.courseClass.create({
    data: { organizationId: orgId, courseId, name: `Lớp ${randomUUID().slice(0, 4)}`, startDate: new Date('2027-01-05'), endDate: new Date('2027-02-05'), weekdays: [2, 4], capacity: 10, createdById: owner.id },
  });

// App chỉ có một đường thử: chạy `work` rồi để lỗi đi qua bộ bắt lỗi chung.
function appRunning(work: () => Promise<unknown>) {
  return createApp(deps, [
    defineRoute({ method: 'post', path: '/thu-rang-buoc', scope: 'public', tag: 't', summary: 'thử', handler: async () => ({ body: await work() }) }),
  ]);
}

describe('23514 có tên ràng buộc của trigger đào tạo → 409 kèm lời database; 23514 khác → 400', () => {
  it('course_classes_single_guard: khoá Một lớp mở lớp thứ 2 → 409 "Khoá một lớp chỉ có một lớp…"', async () => {
    const c = await newCourse('SINGLE_CLASS');
    await newClass(c.id);
    const res = await request(appRunning(() => newClass(c.id))).post('/api/v1/thu-rang-buoc');
    console.log(`[23514] lớp thứ 2 của khoá Một lớp → ${res.status} "${res.body.error?.message}"`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: 'Khoá một lớp chỉ có một lớp — chuyển sang Nhiều lớp để mở thêm' });
    expect(await deps.db.courseClass.count({ where: { courseId: c.id } })).toBe(1);
  });

  it('courses_single_mode_guard: khoá Nhiều lớp có 2 lớp chuyển về Một lớp → 409 "Khoá đang có 2 lớp…"', async () => {
    const c = await newCourse('MULTI_CLASS');
    await newClass(c.id);
    await newClass(c.id);
    const res = await request(appRunning(() => deps.db.course.update({ where: { id: c.id }, data: { mode: 'SINGLE_CLASS' } }))).post('/api/v1/thu-rang-buoc');
    console.log(`[23514] chuyển khoá 2 lớp về Một lớp → ${res.status} "${res.body.error?.message}"`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: 'Khoá đang có 2 lớp — chỉ chuyển về Một lớp khi còn 1 lớp' });
    expect((await deps.db.course.findUniqueOrThrow({ where: { id: c.id } })).mode).toBe('MULTI_CLASS');
  });

  it('GIỮ: CHECK thường (sức chứa lớp 0) → 400 lời chung, không lộ tên ràng buộc', async () => {
    const c = await newCourse('MULTI_CLASS');
    const res = await request(
      appRunning(() =>
        deps.db.courseClass.create({
          data: { organizationId: orgId, courseId: c.id, name: 'Lớp', startDate: new Date('2027-01-05'), endDate: new Date('2027-02-05'), weekdays: [2], capacity: 0, createdById: owner.id },
        }),
      ),
    ).post('/api/v1/thu-rang-buoc');
    console.log(`[23514] CHECK sức chứa 0 → ${res.status} "${res.body.error?.message}"`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_FAILED', message: 'Dữ liệu vi phạm ràng buộc của hệ thống' });
    expect(JSON.stringify(res.body)).not.toContain('course_classes_capacity');
  });
});
