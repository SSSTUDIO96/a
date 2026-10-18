import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, SYSTEM_ROLES, isPermission } from './permissions';

describe('danh mục quyền', () => {
  it('mọi quyền trong vai trò mẫu đều có trong danh mục', () => {
    const used = Object.values(SYSTEM_ROLES).flatMap((r) => r.permissions);
    const unknown = used.filter((p) => !isPermission(p));
    expect(unknown).toEqual([]);
  });
  it('khoá lạ không được coi là quyền', () => {
    expect(isPermission('finance.god_mode')).toBe(false);
    expect(isPermission('toString')).toBe(false);
  });
  it('chủ tài khoản giữ đủ quyền', () => {
    expect(new Set(SYSTEM_ROLES.owner.permissions)).toEqual(new Set(ALL_PERMISSIONS));
  });
});
