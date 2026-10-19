// LOẠI SỰ KIỆN (bản vẽ D mục 2.2): ăn hỏi, lễ vu quy, lễ cưới… — studio tự đặt, gắn ở DÒNG hợp đồng.
// Kiểu đường giống nhân vật makeup (categories.ts). Không có đường xoá (dòng hợp đồng trỏ về loại) — ẩn bằng isActive.
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { DEFAULT_OCCASIONS, MAX_OCCASIONS, OCCASION_COLORS } from '@makeup/shared';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { BoolQuery, OrgParams, SortOrder, lockOrg, nonEmpty, strictBody, withUniqueMessage } from './common';

const OccasionParams = OrgParams.extend({ occasionId: z.uuid() });

const OccasionName = z.string().trim().min(1, 'Tên không được để trống').max(60);
const OccasionColor = z.enum(OCCASION_COLORS, { error: 'Màu phải là một trong 12 màu của Lịch' });

const OccasionCreate = strictBody({
  name: OccasionName,
  color: OccasionColor,
  sortOrder: SortOrder.optional(),
  isActive: z.boolean().optional(),
});
// Sửa một phần: KHÔNG .default() (chốt khởi động ở http/route.ts bắt); mặc định nằm ở database.
const OccasionPatch = strictBody({
  name: OccasionName.optional(),
  color: OccasionColor.optional(),
  sortOrder: SortOrder.optional(),
  isActive: z.boolean().optional(),
}).refine(nonEmpty, 'Không có gì để sửa');
const OccasionOrder = strictBody({ occasionIds: z.array(z.uuid()).min(1).max(MAX_OCCASIONS) });

const DUPLICATE_NAME = 'Tên loại sự kiện đã có trong tổ chức';
const NOT_FOUND = 'Không tìm thấy loại sự kiện';
// Cùng MỘT lời cho mã trùng, thiếu, thừa, mã bịa, mã của tổ chức khác — không lộ mã nào có thật ở tổ chức khác.
export const ORDER_MISMATCH = 'Danh sách phải gồm đủ mọi loại sự kiện của tổ chức, mỗi loại một lần';

const occasionSelect = {
  id: true,
  name: true,
  color: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OccasionSelect;

type OccasionRow = Prisma.OccasionGetPayload<{ select: typeof occasionSelect }>;

const ORDER: Prisma.OccasionOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];

// Số dòng hợp đồng CHƯA HUỶ đang dùng từng loại — một câu groupBy cho cả trang (không N+1).
async function lineCounts(db: Prisma.TransactionClient, organizationId: string, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const rows = await db.contractLine.groupBy({
    by: ['occasionId'],
    where: { organizationId, occasionId: { in: ids }, voidedAt: null },
    _count: { _all: true },
  });
  for (const r of rows) if (r.occasionId) map.set(r.occasionId, r._count._all);
  return map;
}

async function present(db: Prisma.TransactionClient, organizationId: string, rows: OccasionRow[]) {
  const counts = await lineCounts(
    db,
    organizationId,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({ ...r, lineCount: counts.get(r.id) ?? 0 }));
}

async function listOccasions(db: Prisma.TransactionClient, organizationId: string, isActive?: boolean) {
  const rows = await db.occasion.findMany({
    where: { organizationId, ...(isActive !== undefined ? { isActive } : {}) },
    orderBy: ORDER,
    select: occasionSelect,
  });
  return present(db, organizationId, rows);
}

// Bộ 6 loại mặc định — dùng chung cho tạo tổ chức (orgs/routes.ts) và bù cho tổ chức cũ (sync-system-roles.ts).
export async function seedDefaultOccasions(tx: Prisma.TransactionClient, organizationId: string): Promise<void> {
  if (!organizationId) throw new Error('seedDefaultOccasions: thiếu organizationId');
  await tx.occasion.createMany({
    data: DEFAULT_OCCASIONS.map((o, i) => ({ organizationId, name: o.name, color: o.color, sortOrder: i })),
  });
}

export const occasionRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/occasions',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Danh sách loại sự kiện (ăn hỏi, lễ vu quy, lễ cưới…) kèm số dòng hợp đồng đang dùng',
    query: z.object({ isActive: BoolQuery.optional() }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      return { body: { items: await listOccasions(deps.db, o.id, query.isActive) } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/occasions',
    idempotent: true,
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Thêm loại sự kiện',
    body: OccasionCreate,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const created = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          // Khoá tổ chức: hai lần thêm cùng lúc không vượt trần.
          await lockOrg(tx, o.id);
          const count = await tx.occasion.count({ where: { organizationId: o.id } });
          if (count >= MAX_OCCASIONS) throw new AppError('CONFLICT', `Tối đa ${MAX_OCCASIONS} loại sự kiện`);
          const row = await tx.occasion.create({ data: { organizationId: o.id, ...body }, select: occasionSelect });
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: mustUser(userId),
            action: 'occasion.created',
            entityType: 'occasion',
            entityId: row.id,
            data: body,
            requestId,
          });
          return row;
        }),
        DUPLICATE_NAME,
      );
      return { status: 201, body: { ...created, lineCount: 0 } };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/occasions/:occasionId',
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Đổi tên, màu, thứ tự, ẩn/hiện loại sự kiện (không đổi dòng hợp đồng đã lưu)',
    params: OccasionParams,
    body: OccasionPatch,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const updated = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          const before = await tx.occasion.findFirst({
            where: { id: params.occasionId, organizationId: o.id },
            select: occasionSelect,
          });
          if (!before) throw new AppError('NOT_FOUND', NOT_FOUND);
          const after = await tx.occasion.update({ where: { id: before.id }, data: body, select: occasionSelect });
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: mustUser(userId),
            action: 'occasion.updated',
            entityType: 'occasion',
            entityId: before.id,
            data: {
              before: { name: before.name, color: before.color, sortOrder: before.sortOrder, isActive: before.isActive },
              after: body,
            },
            requestId,
          });
          return (await present(tx, o.id, [after]))[0];
        }),
        DUPLICATE_NAME,
      );
      return { body: updated };
    },
  }),

  defineRoute({
    method: 'put',
    path: '/orgs/:orgId/occasions/order',
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Đổi thứ tự loại sự kiện: gửi đủ mọi loại của tổ chức, mỗi loại một lần; thứ tự = vị trí trong danh sách',
    body: OccasionOrder,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const items = await deps.db.$transaction(async (tx) => {
        await lockOrg(tx, o.id);
        // So với tập của CHÍNH tổ chức: mã của tổ chức khác không bao giờ khớp.
        const current = await tx.occasion.findMany({ where: { organizationId: o.id }, orderBy: ORDER, select: { id: true } });
        const own = new Set(current.map((r) => r.id));
        const sent = body.occasionIds;
        const sameSet = sent.length === own.size && new Set(sent).size === sent.length && sent.every((id) => own.has(id));
        if (!sameSet) throw new AppError('VALIDATION_FAILED', ORDER_MISMATCH);
        for (const [i, id] of sent.entries()) {
          await tx.occasion.updateMany({ where: { id, organizationId: o.id }, data: { sortOrder: i } });
        }
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'occasion.reordered',
          entityType: 'occasion',
          data: { before: current.map((r) => r.id), after: sent },
          requestId,
        });
        return listOccasions(tx, o.id);
      });
      return { body: { items } };
    },
  }),
];
