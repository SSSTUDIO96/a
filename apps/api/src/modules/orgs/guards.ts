import type { Permission } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import type { OrgContext } from '../../http/route';

export interface RoleLike {
  key: string;
  permissions: string[];
}

function missingFrom(actor: OrgContext, roles: RoleLike[]): string[] {
  const missing = new Set<string>();
  for (const role of roles) {
    for (const p of role.permissions) {
      if (!actor.permissions.has(p as Permission)) missing.add(p);
    }
  }
  return [...missing].sort();
}

// Luật chống tự nâng quyền: không ai được trao quyền mình không có.
export function assertCanGrant(actor: OrgContext, roles: RoleLike[]): void {
  if (roles.some((r) => r.key === 'owner') && !actor.roleKeys.includes('owner')) {
    throw new AppError('FORBIDDEN', 'Chỉ chủ tài khoản mới trao được vai trò chủ tài khoản');
  }
  const missing = missingFrom(actor, roles);
  if (missing.length > 0) {
    throw new AppError('FORBIDDEN', 'Không thể trao quyền mà bạn không có', { missing });
  }
}

// Luật thứ bậc: không ai đổi vai trò, khoá hay cho rời một người đang giữ quyền mà mình không có.
// (Trước đây chỉ che vai trò "chủ" — quản lý vẫn hạ được quản trị. Biên bản nghiệm thu mốc 2, lỗi L1.)
export function assertCanTouchMember(actor: OrgContext, targetRoles: RoleLike[]): void {
  if (targetRoles.some((r) => r.key === 'owner') && !actor.roleKeys.includes('owner')) {
    throw new AppError('FORBIDDEN', 'Chỉ chủ tài khoản mới thay đổi được chủ tài khoản khác');
  }
  const missing = missingFrom(actor, targetRoles);
  if (missing.length > 0) {
    throw new AppError('FORBIDDEN', 'Không thể thay đổi người đang giữ quyền mà bạn không có', { missing });
  }
}

// Sửa một vai trò = vừa trao quyền mới, vừa tước quyền cũ của mọi người đang giữ nó:
// người sửa phải có đủ cả quyền cũ lẫn quyền mới. (Biên bản nghiệm thu mốc 2, lỗi L2.)
export function assertCanEditRole(actor: OrgContext, before: RoleLike, after: RoleLike): void {
  assertCanGrant(actor, [before, after]);
}

// Tổ chức luôn phải còn ít nhất một chủ đang hoạt động.
export function assertKeepsAnOwner(activeOwnerCountAfter: number): void {
  if (activeOwnerCountAfter < 1) {
    throw new AppError('CONFLICT', 'Tổ chức phải còn ít nhất một chủ tài khoản');
  }
}
