import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';

const OrgParams = z.object({ orgId: z.uuid() });
const TierParams = OrgParams.extend({ tierId: z.uuid() });
const TierName = z.string().trim().min(1).max(60);
const SortOrder = z.number().int().min(0).max(10_000);

const tierSelect = {
  id: true,
  name: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { profiles: { where: { membership: { status: 'ACTIVE' } } } } },
} satisfies Prisma.StaffTierSelect;

type TierRow = Prisma.StaffTierGetPayload<{ select: typeof tierSelect }>;

function presentTier({ _count, ...t }: TierRow) {
  return { ...t, staffCount: _count.profiles };
}

// Trùng tên không phân biệt hoa thường ("Bậc 1" và "bậc 1" là một). Database vẫn chặn trùng tuyệt đối khi đua nhau.
async function assertNameFree(tx: Prisma.TransactionClient, orgId: string, name: string, exceptId?: string) {
  const dup = await tx.staffTier.findFirst({
    where: {
      organizationId: orgId,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (dup) throw new AppError('CONFLICT', `Đã có bậc lương tên "${name}"`);
}

export const tierRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/staff-tiers',
    scope: 'org',
    permission: 'staff.read',
    tag: 'Nhân sự',
    summary: 'Danh sách bậc lương (cả bậc đã ẩn), kèm số thợ đang thuộc mỗi bậc',
    handler: async ({ deps, org }) => {
      const o = mustOrg(org);
      const rows = await deps.db.staffTier.findMany({
        where: { organizationId: o.id },
        select: tierSelect,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return { body: { items: rows.map(presentTier) } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/staff-tiers',
    scope: 'org',
    permission: 'staff.write',
    tag: 'Nhân sự',
    summary: 'Thêm bậc lương; không gửi sortOrder thì xếp cuối',
    body: z.object({ name: TierName, sortOrder: SortOrder.optional() }),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const tier = await deps.db.$transaction(async (tx) => {
        await assertNameFree(tx, o.id, body.name);
        let sortOrder = body.sortOrder;
        if (sortOrder === undefined) {
          const last = await tx.staffTier.aggregate({ where: { organizationId: o.id }, _max: { sortOrder: true } });
          sortOrder = last._max.sortOrder === null ? 0 : last._max.sortOrder + 1;
        }
        const created = await tx.staffTier.create({
          data: { organizationId: o.id, name: body.name, sortOrder },
          select: tierSelect,
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'staff_tier.created',
          entityType: 'staff_tier',
          entityId: created.id,
          data: { name: created.name, sortOrder: created.sortOrder },
          requestId,
        });
        return created;
      });
      return { status: 201, body: presentTier(tier) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/staff-tiers/:tierId',
    scope: 'org',
    permission: 'staff.write',
    tag: 'Nhân sự',
    summary: 'Đổi tên, thứ tự, ẩn/hiện bậc lương',
    params: TierParams,
    body: z
      .object({ name: TierName.optional(), sortOrder: SortOrder.optional(), isActive: z.boolean().optional() })
      .refine((b) => Object.keys(b).length > 0, 'Không có gì để sửa'),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const tier = await deps.db.$transaction(async (tx) => {
        const before = await tx.staffTier.findFirst({
          where: { id: params.tierId, organizationId: o.id },
          select: tierSelect,
        });
        if (!before) throw new AppError('NOT_FOUND', 'Không tìm thấy bậc lương');
        if (body.name !== undefined) await assertNameFree(tx, o.id, body.name, before.id);
        // Ẩn bậc khi còn thợ thì màn tiền công sẽ "mất" họ — bắt chuyển thợ sang bậc khác trước.
        if (body.isActive === false && before.isActive && before._count.profiles > 0) {
          throw new AppError(
            'CONFLICT',
            `Còn ${before._count.profiles} thợ đang thuộc bậc "${before.name}", hãy chuyển họ sang bậc khác trước khi ẩn`,
          );
        }
        const after = await tx.staffTier.update({ where: { id: before.id }, data: body, select: tierSelect });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'staff_tier.updated',
          entityType: 'staff_tier',
          entityId: before.id,
          data: { before: { name: before.name, sortOrder: before.sortOrder, isActive: before.isActive }, after: body },
          requestId,
        });
        return after;
      });
      return { body: presentTier(tier) };
    },
  }),
];
