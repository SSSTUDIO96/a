import { afterAll, describe, expect, it } from 'vitest';
import { SYSTEM_ROLE_KEYS, SYSTEM_ROLES } from '@makeup/shared';
import { syncSystemRoles } from '../src/scripts/sync-system-roles';
import { createOrg, makeApp, makeDeps, registerUser } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('đồng bộ vai trò hệ thống cho tổ chức cũ', () => {
  it('tổ chức tạo trước khi thêm quyền mới được bổ sung quyền; chạy lại không đổi gì', async () => {
    const app = makeApp(deps);
    const owner = await registerUser(app, 'cu');
    const orgId = await createOrg(app, owner, 'to-chuc-cu');
    // Giả lập tổ chức cũ: vai trò chủ chỉ còn quyền đời đầu, vai trò kế toán bị thiếu hẳn.
    await deps.db.role.updateMany({ where: { organizationId: orgId, key: 'owner' }, data: { permissions: ['org.read'] } });
    const accountant = await deps.db.role.findFirstOrThrow({ where: { organizationId: orgId, key: 'accountant' } });
    await deps.db.role.delete({ where: { id: accountant.id } });

    const first = await syncSystemRoles(deps.db);
    expect(first.rolesUpdated).toBeGreaterThanOrEqual(1);
    expect(first.rolesCreated).toBeGreaterThanOrEqual(1);

    const roles = await deps.db.role.findMany({ where: { organizationId: orgId, isSystem: true } });
    let matched = 0;
    for (const key of SYSTEM_ROLE_KEYS) {
      const row = roles.find((r) => r.key === key);
      if (row && [...row.permissions].sort().join() === [...SYSTEM_ROLES[key].permissions].sort().join()) matched++;
    }
    console.log(`[đồng bộ vai trò] khớp mẫu: ${matched}/${SYSTEM_ROLE_KEYS.length} vai trò`);
    expect(matched).toBe(SYSTEM_ROLE_KEYS.length);

    const second = await syncSystemRoles(deps.db);
    expect(second.rolesCreated + second.rolesUpdated).toBe(0);
  });
});

describe('đồng bộ dữ liệu mặc định cho tổ chức tạo trước khi có hợp đồng', () => {
  it('bổ sung cách tính phí di chuyển và bộ nhân vật mẫu; không thêm lại khi tổ chức đã có nhân vật', async () => {
    const app = makeApp(deps);
    const owner = await registerUser(app, 'cu-hd');
    const orgId = await createOrg(app, owner, 'to-chuc-cu-hd');
    const created = await deps.db.makeupSubject.count({ where: { organizationId: orgId } });
    expect(created).toBeGreaterThan(0);
    // Giả lập tổ chức cũ: chưa có phí di chuyển, chưa có nhân vật.
    await deps.db.travelFeePolicy.delete({ where: { organizationId: orgId } });
    await deps.db.makeupSubject.deleteMany({ where: { organizationId: orgId } });
    await syncSystemRoles(deps.db);
    expect(await deps.db.travelFeePolicy.count({ where: { organizationId: orgId } })).toBe(1);
    expect(await deps.db.makeupSubject.count({ where: { organizationId: orgId } })).toBe(created);
    // Chủ xoá bớt nhân vật → đồng bộ không thêm lại.
    const one = await deps.db.makeupSubject.findFirstOrThrow({ where: { organizationId: orgId } });
    await deps.db.makeupSubject.delete({ where: { id: one.id } });
    await syncSystemRoles(deps.db);
    expect(await deps.db.makeupSubject.count({ where: { organizationId: orgId } })).toBe(created - 1);
  });
});
