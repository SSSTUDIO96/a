// GIẤY CHỨNG NHẬN — vai trò mẫu (BAN-VE-F mục 9.1 ca S2, S19; KY-DUYET-F câu 2 và 4).
// Bảng mong đợi viết TAY theo bản vẽ mục 3.1 + ký duyệt (không suy từ SYSTEM_ROLES): danh mục vai trò đổi mà không
// sửa bảng này → đỏ.
//   xem (certificates.read): Chủ, Quản trị, Quản lý, Lễ tân, Giảng viên
//   cấp / cấp lại / thu hồi (certificates.issue): Chủ, Quản trị, Quản lý
//   sửa người ký (org.update): CHỈ Chủ và Quản trị
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { syncSystemRoles } from '../src/scripts/sync-system-roles';
import { addMember, bearer, createAcademyOrg, grantUnlimitedPlan, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;
beforeAll(() => {
  app = makeApp(deps);
});
afterAll(async () => {
  await db.$disconnect();
});

const idem = () => `k-${randomUUID()}`;
const ENDED = '2026-03-30';

type Role = 'owner' | 'admin' | 'manager' | 'receptionist' | 'instructor' | 'accountant' | 'artist' | 'assistant' | 'teaching_assistant';
const EXPECT: Record<Role, { read: boolean; issue: boolean; signer: boolean }> = {
  owner: { read: true, issue: true, signer: true },
  admin: { read: true, issue: true, signer: true },
  manager: { read: true, issue: true, signer: false },
  receptionist: { read: true, issue: false, signer: false },
  instructor: { read: true, issue: false, signer: false },
  accountant: { read: false, issue: false, signer: false },
  artist: { read: false, issue: false, signer: false },
  assistant: { read: false, issue: false, signer: false },
  teaching_assistant: { read: false, issue: false, signer: false },
};
const ROLES = Object.keys(EXPECT) as Role[];

describe('S2 — quyền theo từng vai trò mẫu', () => {
  it('đọc / cấp / cấp lại / thu hồi / sửa người ký đúng từng ô của bảng quyền', async () => {
    const owner = await registerUser(app, 'gcn-vt-chu');
    const orgId = await createAcademyOrg(app, owner, 'gcn-vt');
    await grantUnlimitedPlan(db, orgId);
    const api = (rest: string) => `/api/v1/orgs/${orgId}${rest}`;
    const postOwner = async (path: string, body: object) => {
      const r = await request(app).post(api(path)).set(bearer(owner)).set('idempotency-key', idem()).send(body);
      if (r.status !== 201 && r.status !== 200) throw new Error(`${path} → ${r.status} ${JSON.stringify(r.body)}`);
      return r.body;
    };
    await request(app).put(api('/profile')).set(bearer(owner)).send({ brandName: 'Học viện vai trò' }).expect(200);
    const created = await postOwner('/courses', {
      name: `Khoá ${randomUUID().slice(0, 6)}`,
      mode: 'MULTI_CLASS',
      tuitionFee: 1_000_000,
      defaultCapacity: 30,
      firstClass: { name: 'Lớp vai trò', startDate: '2026-02-01', endDate: ENDED, weekdays: [2] },
    });
    const classId = created.classes[0].id as string;
    // Mỗi vai trò một học viên + một giấy sẵn (chủ cấp) để thử đọc / cấp lại / thu hồi trên bản của riêng mình.
    const users = new Map<Role, TestUser>([['owner', owner]]);
    for (const role of ROLES.filter((r) => r !== 'owner')) {
      const u = await registerUser(app, `gcn-vt-${role}`);
      await addMember(app, owner, orgId, u, [role]);
      users.set(role, u);
    }
    const enr = new Map<Role, { forIssue: string; cert: string; cert2: string }>();
    for (const role of ROLES) {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const customerId = (await postOwner('/customers', { fullName: `${role} ${i}` })).id;
        const contractId = (await postOwner('/contracts', { kind: 'COURSE', customerId, lines: [{ kind: 'COURSE', courseClassId: classId }] })).id;
        await postOwner(`/contracts/${contractId}/status`, { to: 'CONFIRMED' });
        const list = await request(app).get(api(`/classes/${classId}/enrollments`)).set(bearer(owner)).expect(200);
        ids.push((list.body.items as { id: string; customer: { id: string } }[]).find((e) => e.customer.id === customerId)!.id);
      }
      const issued = await postOwner(`/classes/${classId}/certificates`, { enrollmentIds: [ids[1], ids[2]], templateCode: 'cc-02', issuedOn: ENDED });
      enr.set(role, { forIssue: ids[0]!, cert: issued.items[0].id, cert2: issued.items[1].id });
    }

    const table: string[] = [];
    let cells = 0;
    for (const role of ROLES) {
      const u = users.get(role)!;
      const e = enr.get(role)!;
      const want = EXPECT[role];
      const got = {
        roster: (await request(app).get(api(`/classes/${classId}/certificates`)).set(bearer(u))).status,
        register: (await request(app).get(api('/certificates')).set(bearer(u))).status,
        one: (await request(app).get(api(`/certificates/${e.cert}`)).set(bearer(u))).status,
        issue: (
          await request(app)
            .post(api(`/classes/${classId}/certificates`))
            .set(bearer(u))
            .set('idempotency-key', idem())
            .send({ enrollmentIds: [e.forIssue], templateCode: 'cc-01', issuedOn: ENDED })
        ).status,
        reissue: (await request(app).post(api(`/certificates/${e.cert}/reissue`)).set(bearer(u)).set('idempotency-key', idem()).send({ reason: 'Sai tên' })).status,
        revoke: (await request(app).post(api(`/certificates/${e.cert2}/revoke`)).set(bearer(u)).send({ reason: 'Nhầm' })).status,
        signerGet: (await request(app).get(api('/profile/certificate')).set(bearer(u))).status,
        signerPut: (await request(app).put(api('/profile/certificate')).set(bearer(u)).send({ signerName: `Ký ${role}`, signerTitle: null })).status,
      };
      const r = want.read ? 200 : 403;
      const expected = {
        roster: r,
        register: r,
        one: r,
        issue: want.issue ? 201 : 403,
        reissue: want.issue ? 201 : 403,
        revoke: want.issue ? 200 : 403,
        // Mọi vai trò mẫu đều có org.read.
        signerGet: 200,
        signerPut: want.signer ? 200 : 403,
      };
      table.push(`${role}: ${JSON.stringify(got)}`);
      expect(got, role).toEqual(expected);
      cells += Object.keys(expected).length;
    }
    console.log(`[vai trò giấy chứng nhận] khớp ${cells}/${ROLES.length * 8} ô\n${table.join('\n')}`);
    // Người không cấp được thì KHÔNG có dòng nào đổi: đúng 3 bản cấp mới (chủ, quản trị, quản lý).
    expect(await db.auditLog.count({ where: { organizationId: orgId, action: 'certificate.issued', actorUserId: { not: owner.id } } })).toBe(2);
    expect(await db.auditLog.count({ where: { organizationId: orgId, action: 'certificate.reissued' } })).toBe(3);
  });
});

describe('S19 — đồng bộ vai trò cho tổ chức cũ', () => {
  it('Quản lý / Lễ tân / Giảng viên thiếu quyền giấy chứng nhận → syncSystemRoles bổ sung; chạy lần 2 không đổi', async () => {
    const owner = await registerUser(app, 'gcn-dongbo');
    const orgId = await createAcademyOrg(app, owner, 'gcn-dongbo');
    const strip = ['certificates.read', 'certificates.issue'];
    for (const key of ['manager', 'receptionist', 'instructor']) {
      const r = await db.role.findFirstOrThrow({ where: { organizationId: orgId, key } });
      await db.role.update({ where: { id: r.id }, data: { permissions: r.permissions.filter((p) => !strip.includes(p)) } });
    }
    await syncSystemRoles(db);
    const roles = await db.role.findMany({ where: { organizationId: orgId, key: { in: ['manager', 'receptionist', 'instructor', 'accountant'] } } });
    const has = (key: string) => strip.filter((p) => roles.find((r) => r.key === key)!.permissions.includes(p));
    expect(has('manager')).toEqual(['certificates.read', 'certificates.issue']);
    expect(has('receptionist')).toEqual(['certificates.read']);
    expect(has('instructor')).toEqual(['certificates.read']);
    expect(has('accountant')).toEqual([]);
    const second = await syncSystemRoles(db);
    expect(second.rolesCreated + second.rolesUpdated).toBe(0);
  });
});
