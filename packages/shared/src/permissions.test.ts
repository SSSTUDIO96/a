import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, PERMISSIONS, SYSTEM_ROLE_KEYS, SYSTEM_ROLES, isPermission, type Permission } from './permissions';

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
  it('quyền đào tạo / mẫu thiết kế đúng bảng vai trò mẫu (BAN-VE-C3 mục 1.3)', () => {
    const holders = (p: Permission) => SYSTEM_ROLE_KEYS.filter((k) => SYSTEM_ROLES[k].permissions.includes(p)).sort();
    expect(holders('courses.read')).toEqual(['accountant', 'admin', 'instructor', 'manager', 'owner', 'receptionist']);
    expect(holders('courses.write')).toEqual(['admin', 'manager', 'owner']);
    expect(holders('designs.read')).toEqual(['admin', 'instructor', 'manager', 'owner', 'receptionist']);
    expect(holders('designs.write')).toEqual(['admin', 'manager', 'owner', 'receptionist']);
    expect(holders('contracts.texts')).toEqual(['admin', 'manager', 'owner']);
    for (const p of ['courses.read', 'courses.write', 'designs.read', 'designs.write', 'contracts.texts'] as const) {
      expect(PERMISSIONS[p].length).toBeGreaterThan(0);
    }
  });
  it('vai trò mẫu không lặp quyền', () => {
    for (const k of SYSTEM_ROLE_KEYS) {
      const list = SYSTEM_ROLES[k].permissions;
      expect(new Set(list).size, k).toBe(list.length);
    }
  });
});
