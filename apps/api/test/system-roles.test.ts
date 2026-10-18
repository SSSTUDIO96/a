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
