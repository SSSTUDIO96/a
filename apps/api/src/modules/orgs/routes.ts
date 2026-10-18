import { z } from 'zod';
import { DEFAULT_MAKEUP_SUBJECTS, isPermission, SYSTEM_ROLE_KEYS, SYSTEM_ROLES } from '@makeup/shared';
import type { Prisma } from '@prisma/client';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { assertCanEditRole, assertCanGrant, assertCanTouchMember, assertKeepsAnOwner } from './guards';
import { lockOrgAndRecheck } from '../../http/middleware';

const Slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]{1,46})[a-z0-9]$/, 'Đường dẫn chỉ gồm chữ thường không dấu, số, gạch ngang; 3–48 ký tự');
const Timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Múi giờ không hợp lệ');
const Paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const OrgParams = z.object({ orgId: z.uuid() });
const MemberParams = OrgParams.extend({ membershipId: z.uuid() });
const RoleParams = OrgParams.extend({ roleId: z.uuid() });
const RoleKeys = z.array(z.string().min(1).max(32)).min(1).max(10);

// Chủ "đang hoạt động" = thành viên ACTIVE, tài khoản ACTIVE, giữ vai trò owner.
async function countActiveOwners(tx: Prisma.TransactionClient, orgId: string) {
  return tx.membership.count({
    where: {
      organizationId: orgId,
      status: 'ACTIVE',
      user: { status: 'ACTIVE' },
      roles: { some: { role: { key: 'owner' } } },
    },
  });
}

async function rolesOfMember(tx: Prisma.TransactionClient, membershipId: string) {
  const rows = await tx.membershipRole.findMany({
    where: { membershipId },
    select: { role: { select: { key: true, permissions: true } } },
  });
  return rows.map((r) => r.role);
}

async function loadRolesByKeys(tx: Prisma.TransactionClient, orgId: string, keys: string[]) {
  const unique = [...new Set(keys)];
  const roles = await tx.role.findMany({ where: { organizationId: orgId, key: { in: unique } } });
  if (roles.length !== unique.length) {
    const found = new Set(roles.map((r) => r.key));
    throw new AppError('VALIDATION_FAILED', 'Có vai trò không tồn tại trong tổ chức', {
      unknown: unique.filter((k) => !found.has(k)),
    });
  }
  return roles;
}

const memberSelect = {
  id: true,
  status: true,
  createdAt: true,
  user: { select: { id: true, email: true, fullName: true } },
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
} satisfies Prisma.MembershipSelect;

type MemberRow = Prisma.MembershipGetPayload<{ select: typeof memberSelect }>;

function presentMember(m: MemberRow) {
  return { ...m, roles: m.roles.map((r) => r.role) };
}

export const orgRoutes = [
  defineRoute({
    method: 'post',
    path: '/orgs',
    scope: 'auth',
    tag: 'Tổ chức',
    summary: 'Tạo tổ chức mới; người tạo thành chủ tài khoản',
    body: z.object({
      name: z.string().trim().min(1).max(120),
      slug: Slug,
      kind: z.enum(['INDIVIDUAL', 'TEAM', 'ACADEMY']),
    }),
    handler: async ({ deps, body, userId, requestId }) => {
      const uid = mustUser(userId);
      const org = await deps.db.$transaction(async (tx) => {
        const created = await tx.organization.create({ data: body });
        for (const key of SYSTEM_ROLE_KEYS) {
          const tpl = SYSTEM_ROLES[key];
          await tx.role.create({
            data: { organizationId: created.id, key, name: tpl.name, isSystem: true, permissions: tpl.permissions },
          });
        }
        const owner = await tx.role.findUniqueOrThrow({
          where: { organizationId_key: { organizationId: created.id, key: 'owner' } },
        });
        await tx.makeupSubject.createMany({
          data: DEFAULT_MAKEUP_SUBJECTS.map((name, i) => ({ organizationId: created.id, name, sortOrder: i })),
        });
        await tx.travelFeePolicy.create({ data: { organizationId: created.id } });
        const membership = await tx.membership.create({ data: { organizationId: created.id, userId: uid } });
        await tx.membershipRole.create({
          data: { organizationId: created.id, membershipId: membership.id, roleId: owner.id },
        });
        await writeAudit(tx, {
          organizationId: created.id,
          actorUserId: uid,
          action: 'org.created',
          entityType: 'organization',
          entityId: created.id,
          data: body,
          requestId,
        });
        return created;
      });
      return { status: 201, body: org };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId',
    scope: 'org',
    permission: 'org.read',
    tag: 'Tổ chức',
    summary: 'Xem thông tin tổ chức',
    handler: async ({ deps, org }) => {
      const o = mustOrg(org);
      const row = await deps.db.organization.findUniqueOrThrow({ where: { id: o.id } });
      return { body: { ...row, myRoles: o.roleKeys, myPermissions: [...o.permissions].sort() } };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId',
    scope: 'org',
    permission: 'org.update',
    tag: 'Tổ chức',
    summary: 'Sửa tên, múi giờ tổ chức',
    body: z
      .object({ name: z.string().trim().min(1).max(120).optional(), timezone: Timezone.optional() })
      .refine((b) => Object.keys(b).length > 0, 'Không có gì để sửa'),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const row = await deps.db.$transaction(async (tx) => {
        await lockOrgAndRecheck(tx, o, 'org.update');
        const before = await tx.organization.findUniqueOrThrow({ where: { id: o.id } });
        const after = await tx.organization.update({ where: { id: o.id }, data: body });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'org.updated',
          entityType: 'organization',
          entityId: o.id,
          data: { before: { name: before.name, timezone: before.timezone }, after: body },
          requestId,
        });
        return after;
      });
      return { body: row };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/members',
    scope: 'org',
    permission: 'members.read',
    tag: 'Nhân sự',
    summary: 'Danh sách nhân sự',
    query: Paging.extend({ status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']).optional() }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const where = { organizationId: o.id, ...(query.status ? { status: query.status } : {}) };
      const [total, rows] = await deps.db.$transaction([
        deps.db.membership.count({ where }),
        deps.db.membership.findMany({
          where,
          select: memberSelect,
          orderBy: { createdAt: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);
      return { body: { items: rows.map(presentMember), page: query.page, pageSize: query.pageSize, total } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/members',
    scope: 'org',
    permission: 'members.invite',
    tag: 'Nhân sự',
    summary: 'Thêm một tài khoản đã đăng ký vào tổ chức',
    body: z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), roleKeys: RoleKeys }),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const member = await deps.db.$transaction(async (tx) => {
        const actor = await lockOrgAndRecheck(tx, o, 'members.invite');
        const user = await tx.user.findUnique({ where: { email: body.email }, select: { id: true, status: true } });
        if (!user || user.status !== 'ACTIVE') {
          throw new AppError('NOT_FOUND', 'Chưa có tài khoản hoạt động với email này');
        }
        const roles = await loadRolesByKeys(tx, o.id, body.roleKeys);
        assertCanGrant(actor, roles);
        const existing = await tx.membership.findUnique({
          where: { organizationId_userId: { organizationId: o.id, userId: user.id } },
        });
        if (existing && existing.status !== 'REMOVED') {
          throw new AppError('CONFLICT', 'Người này đã là thành viên của tổ chức');
        }
        const membership = existing
          ? await tx.membership.update({ where: { id: existing.id }, data: { status: 'ACTIVE' } })
          : await tx.membership.create({ data: { organizationId: o.id, userId: user.id } });
        await tx.membershipRole.deleteMany({ where: { membershipId: membership.id } });
        await tx.membershipRole.createMany({
          data: roles.map((r) => ({ organizationId: o.id, membershipId: membership.id, roleId: r.id })),
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: existing ? 'member.readded' : 'member.added',
          entityType: 'membership',
          entityId: membership.id,
          data: { userId: user.id, roleKeys: roles.map((r) => r.key) },
          requestId,
        });
        return tx.membership.findUniqueOrThrow({ where: { id: membership.id }, select: memberSelect });
      });
      return { status: 201, body: presentMember(member) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/members/:membershipId',
    scope: 'org',
    permission: 'members.update',
    tag: 'Nhân sự',
    summary: 'Đổi vai trò hoặc tạm khoá nhân sự',
    params: MemberParams,
    body: z
      .object({ roleKeys: RoleKeys.optional(), status: z.enum(['ACTIVE', 'SUSPENDED']).optional() })
      .refine((b) => b.roleKeys !== undefined || b.status !== undefined, 'Không có gì để sửa'),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const member = await deps.db.$transaction(async (tx) => {
        const actor = await lockOrgAndRecheck(tx, o, 'members.update');
        const target = await tx.membership.findFirst({
          where: { id: params.membershipId, organizationId: o.id, status: { not: 'REMOVED' } },
          select: memberSelect,
        });
        if (!target) throw new AppError('NOT_FOUND', 'Không tìm thấy nhân sự');
        const beforeKeys = target.roles.map((r) => r.role.key);
        assertCanTouchMember(actor, await rolesOfMember(tx, target.id));
        if (body.roleKeys) {
          const roles = await loadRolesByKeys(tx, o.id, body.roleKeys);
          assertCanGrant(actor, roles);
          await tx.membershipRole.deleteMany({ where: { membershipId: target.id } });
          await tx.membershipRole.createMany({
            data: roles.map((r) => ({ organizationId: o.id, membershipId: target.id, roleId: r.id })),
          });
        }
        if (body.status) {
          await tx.membership.update({ where: { id: target.id }, data: { status: body.status } });
        }
        assertKeepsAnOwner(await countActiveOwners(tx, o.id));
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'member.updated',
          entityType: 'membership',
          entityId: target.id,
          data: { before: { roleKeys: beforeKeys, status: target.status }, after: body },
          requestId,
        });
        return tx.membership.findUniqueOrThrow({ where: { id: target.id }, select: memberSelect });
      });
      return { body: presentMember(member) };
    },
  }),

  defineRoute({
    method: 'delete',
    path: '/orgs/:orgId/members/:membershipId',
    scope: 'org',
    permission: 'members.remove',
    tag: 'Nhân sự',
    summary: 'Cho nhân sự rời tổ chức (giữ lịch sử, không xoá dữ liệu)',
    params: MemberParams,
    handler: async ({ deps, org, params, userId, requestId }) => {
      const o = mustOrg(org);
      await deps.db.$transaction(async (tx) => {
        const actor = await lockOrgAndRecheck(tx, o, 'members.remove');
        const target = await tx.membership.findFirst({
          where: { id: params.membershipId, organizationId: o.id, status: { not: 'REMOVED' } },
          select: memberSelect,
        });
        if (!target) throw new AppError('NOT_FOUND', 'Không tìm thấy nhân sự');
        assertCanTouchMember(actor, await rolesOfMember(tx, target.id));
        await tx.membership.update({ where: { id: target.id }, data: { status: 'REMOVED' } });
        assertKeepsAnOwner(await countActiveOwners(tx, o.id));
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'member.removed',
          entityType: 'membership',
          entityId: target.id,
          data: { userId: target.user.id, roleKeys: target.roles.map((r) => r.role.key) },
          requestId,
        });
      });
      return { status: 204 };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/roles',
    scope: 'org',
    permission: 'roles.read',
    tag: 'Vai trò',
    summary: 'Danh sách vai trò của tổ chức',
    handler: async ({ deps, org }) => {
      const o = mustOrg(org);
      const items = await deps.db.role.findMany({
        where: { organizationId: o.id },
        orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      });
      return { body: { items } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/roles',
    scope: 'org',
    permission: 'roles.manage',
    tag: 'Vai trò',
    summary: 'Tạo vai trò tuỳ chỉnh',
    body: z.object({
      key: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/, 'Mã vai trò: chữ thường không dấu, số, gạch dưới'),
      name: z.string().trim().min(1).max(60),
      permissions: z.array(z.string()).max(200),
    }),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      if ((SYSTEM_ROLE_KEYS as string[]).includes(body.key)) {
        throw new AppError('CONFLICT', 'Mã này dành cho vai trò hệ thống');
      }
      const permissions = normalizePermissions(body.permissions);
      const role = await deps.db.$transaction(async (tx) => {
        const actor = await lockOrgAndRecheck(tx, o, 'roles.manage');
        assertCanGrant(actor, [{ key: body.key, permissions }]);
        const created = await tx.role.create({
          data: { organizationId: o.id, key: body.key, name: body.name, permissions },
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'role.created',
          entityType: 'role',
          entityId: created.id,
          data: { key: body.key, permissions },
          requestId,
        });
        return created;
      });
      return { status: 201, body: role };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/roles/:roleId',
    scope: 'org',
    permission: 'roles.manage',
    tag: 'Vai trò',
    summary: 'Sửa vai trò tuỳ chỉnh',
    params: RoleParams,
    body: z
      .object({ name: z.string().trim().min(1).max(60).optional(), permissions: z.array(z.string()).max(200).optional() })
      .refine((b) => b.name !== undefined || b.permissions !== undefined, 'Không có gì để sửa'),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const permissions = body.permissions ? normalizePermissions(body.permissions) : undefined;
      const role = await deps.db.$transaction(async (tx) => {
        const actor = await lockOrgAndRecheck(tx, o, 'roles.manage');
        const target = await tx.role.findFirst({ where: { id: params.roleId, organizationId: o.id } });
        if (!target) throw new AppError('NOT_FOUND', 'Không tìm thấy vai trò');
        if (target.isSystem) throw new AppError('FORBIDDEN', 'Vai trò hệ thống không sửa được');
        assertCanEditRole(actor, target, { key: target.key, permissions: permissions ?? target.permissions });
        const updated = await tx.role.update({
          where: { id: target.id },
          data: { ...(body.name ? { name: body.name } : {}), ...(permissions ? { permissions } : {}) },
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'role.updated',
          entityType: 'role',
          entityId: target.id,
          data: { before: { name: target.name, permissions: target.permissions }, after: { name: body.name, permissions } },
          requestId,
        });
        return updated;
      });
      return { body: role };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/audit-logs',
    scope: 'org',
    permission: 'audit.read',
    tag: 'Nhật ký',
    summary: 'Nhật ký thay đổi của tổ chức, mới nhất trước',
    query: Paging,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const where = { organizationId: o.id };
      const [total, items] = await deps.db.$transaction([
        deps.db.auditLog.count({ where }),
        deps.db.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            data: true,
            createdAt: true,
            actor: { select: { id: true, fullName: true } },
          },
        }),
      ]);
      return { body: { items, page: query.page, pageSize: query.pageSize, total } };
    },
  }),
];

function normalizePermissions(raw: string[]): string[] {
  const unknown = raw.filter((p) => !isPermission(p));
  if (unknown.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Có quyền không tồn tại', { unknown });
  }
  return [...new Set(raw)].sort();
}
