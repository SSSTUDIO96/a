import type { Permission } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import type { OrgContext } from '../../http/route';

export interface RoleLike {
  key: string;
  permissions: string[];
}

// Luật chống tự nâng quyền: không ai được trao quyền mình không có.
export function assertCanGrant(actor: OrgContext, roles: RoleLike[]): void {
  const missing = new Set<string>();
  for (const role of roles) {
    if (role.key === 'owner' && !actor.roleKeys.includes('owner')) {
      throw new AppError('FORBIDDEN', 'Chỉ chủ tài khoản mới trao được vai trò chủ tài khoản');
    }
    for (const p of role.permissions) {
      if (!actor.permissions.has(p as Permission)) missing.add(p);
    }
  }
  if (missing.size > 0) {
    throw new AppError('FORBIDDEN', 'Không thể trao quyền mà bạn không có', { missing: [...missing].sort() });
  }
}

// Người không phải chủ thì không được đụng vào thành viên đang giữ vai trò chủ.
export function assertCanTouchMember(actor: OrgContext, targetRoleKeys: string[]): void {
  if (targetRoleKeys.includes('owner') && !actor.roleKeys.includes('owner')) {
    throw new AppError('FORBIDDEN', 'Chỉ chủ tài khoản mới thay đổi được chủ tài khoản khác');
  }
}

// Tổ chức luôn phải còn ít nhất một chủ đang hoạt động.
export function assertKeepsAnOwner(activeOwnerCountAfter: number): void {
  if (activeOwnerCountAfter < 1) {
    throw new AppError('CONFLICT', 'Tổ chức phải còn ít nhất một chủ tài khoản');
  }
}
