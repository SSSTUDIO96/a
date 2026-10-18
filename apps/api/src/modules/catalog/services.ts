import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import {
  BoolQuery,
  Code,
  Description,
  Duration,
  Money,
  Name,
  OrgParams,
  Paging,
  PriceInput,
  SearchQuery,
  SortOrder,
  addPriceVersion,
  addPriceVersionPresented,
  assertCanSetPrice,
  currentPricesFor,
  listPriceHistory,
  nonEmpty,
  notFound,
  strictBody,
  withUniqueMessage,
} from './common';

export const ServiceKind = z.enum(['MAIN', 'ADDON', 'SURCHARGE'], { error: 'Loại dịch vụ phải là MAIN, ADDON hoặc SURCHARGE' });

const ServiceParams = OrgParams.extend({ serviceId: z.uuid() });

const serviceFields = {
  kind: ServiceKind,
  code: Code,
  name: Name,
  description: Description,
  durationMinutes: Duration,
  categoryId: z.uuid().nullable(),
  isActive: z.boolean(),
  isPublic: z.boolean(),
  sortOrder: SortOrder,
};

export const NewPriceBody = strictBody({
  ...PriceInput,
  effectiveFrom: z.iso.datetime({ offset: true, error: 'Thời điểm hiệu lực phải theo ISO 8601, ví dụ 2026-12-01T00:00:00+07:00' }).optional(),
  note: z.string().trim().max(500).optional(),
});

const serviceSelect = {
  id: true,
  kind: true,
  code: true,
  name: true,
  description: true,
  durationMinutes: true,
  categoryId: true,
  isActive: true,
  isPublic: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.ServiceSelect;

async function assertCategoryInOrg(tx: Prisma.TransactionClient, organizationId: string, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const found = await tx.serviceCategory.findFirst({ where: { id: categoryId, organizationId }, select: { id: true } });
  if (!found) throw new AppError('VALIDATION_FAILED', 'Danh mục không tồn tại trong tổ chức', { categoryId });
}

// Dịch vụ đang nằm trong gói thì loại phải còn hợp với dòng gói: dòng tick thêm cần ADDON, dòng đã gồm cần MAIN/ADDON.
async function assertKindFitsPackages(tx: Prisma.TransactionClient, organizationId: string, serviceId: string, kind: string) {
  const used = await tx.packageItem.findMany({
    where: { organizationId, serviceId },
    select: { isOptional: true, package: { select: { code: true } } },
  });
  const broken = used.filter((u) => (u.isOptional ? kind !== 'ADDON' : kind === 'SURCHARGE'));
  if (broken.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Không đổi được loại: dịch vụ đang nằm trong gói với vai trò không hợp loại mới', {
      packages: broken.map((b) => b.package.code),
    });
  }
}

export const serviceRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/services',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Danh sách dịch vụ kèm giá hiện hành',
    query: Paging.extend({
      categoryId: z.uuid().optional(),
      kind: ServiceKind.optional(),
      isActive: BoolQuery.optional(),
      q: SearchQuery,
    }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const where: Prisma.ServiceWhereInput = {
        organizationId: o.id,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { code: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const [total, rows] = await deps.db.$transaction([
        deps.db.service.count({ where }),
        deps.db.service.findMany({
          where,
          select: serviceSelect,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);
      const priceOf = await currentPricesFor(
        deps.db,
        o.id,
        'service',
        rows.map((r) => r.id),
      );
      return {
        body: {
          items: rows.map((r) => ({ ...r, currentPrice: priceOf(r.id) })),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
      };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/services',
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Tạo dịch vụ kèm giá đầu tiên (cần thêm quyền prices.write)',
    body: strictBody({
      ...serviceFields,
      kind: ServiceKind.optional(),
      description: Description.optional(),
      categoryId: serviceFields.categoryId.optional(),
      isActive: serviceFields.isActive.optional(),
      isPublic: serviceFields.isPublic.optional(),
      sortOrder: SortOrder.optional(),
      listPrice: Money,
      salePrice: PriceInput.salePrice,
    }),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      assertCanSetPrice(o);
      const uid = mustUser(userId);
      const { listPrice, salePrice, ...fields } = body;
      const created = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          await assertCategoryInOrg(tx, o.id, fields.categoryId);
          const row = await tx.service.create({ data: { organizationId: o.id, ...fields }, select: { id: true } });
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: uid,
            action: 'service.created',
            entityType: 'service',
            entityId: row.id,
            data: { ...fields, listPrice, salePrice: salePrice ?? null },
            requestId,
          });
          await addPriceVersion(tx, {
            organizationId: o.id,
            owner: 'service',
            ownerId: row.id,
            price: { listPrice, salePrice, note: 'Giá khởi tạo' },
            actorUserId: uid,
            requestId,
            skipLock: true,
          });
          return tx.service.findUniqueOrThrow({ where: { id: row.id }, select: serviceSelect });
        }),
        'Mã dịch vụ đã có trong tổ chức',
      );
      const priceOf = await currentPricesFor(deps.db, o.id, 'service', [created.id]);
      return { status: 201, body: { ...created, currentPrice: priceOf(created.id) } };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/services/:serviceId',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Xem một dịch vụ kèm giá hiện hành',
    params: ServiceParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      const row = await deps.db.service.findFirst({
        where: { id: params.serviceId, organizationId: o.id },
        select: serviceSelect,
      });
      if (!row) throw notFound('service');
      const priceOf = await currentPricesFor(deps.db, o.id, 'service', [row.id]);
      return { body: { ...row, currentPrice: priceOf(row.id) } };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/services/:serviceId',
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Sửa thông tin dịch vụ (không đổi giá ở đây)',
    params: ServiceParams,
    body: strictBody(
      {
        kind: ServiceKind.optional(),
        code: Code.optional(),
        name: Name.optional(),
        description: Description.optional(),
        durationMinutes: Duration.optional(),
        categoryId: serviceFields.categoryId.optional(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        sortOrder: SortOrder.optional(),
      },
      'đổi giá dùng POST /services/:serviceId/prices',
    ).refine(nonEmpty, 'Không có gì để sửa'),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const updated = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          const before = await tx.service.findFirst({ where: { id: params.serviceId, organizationId: o.id } });
          if (!before) throw notFound('service');
          await assertCategoryInOrg(tx, o.id, body.categoryId);
          if (body.kind && body.kind !== before.kind) await assertKindFitsPackages(tx, o.id, before.id, body.kind);
          await tx.service.update({ where: { id: before.id }, data: body });
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: mustUser(userId),
            action: 'service.updated',
            entityType: 'service',
            entityId: before.id,
            data: {
              before: {
                kind: before.kind,
                code: before.code,
                name: before.name,
                description: before.description,
                durationMinutes: before.durationMinutes,
                categoryId: before.categoryId,
                isActive: before.isActive,
                isPublic: before.isPublic,
                sortOrder: before.sortOrder,
              },
              after: body,
            },
            requestId,
          });
          return tx.service.findUniqueOrThrow({ where: { id: before.id }, select: serviceSelect });
        }),
        'Mã dịch vụ đã có trong tổ chức',
      );
      const priceOf = await currentPricesFor(deps.db, o.id, 'service', [updated.id]);
      return { body: { ...updated, currentPrice: priceOf(updated.id) } };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/services/:serviceId/prices',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Lịch sử giá của dịch vụ, mới nhất trước',
    params: ServiceParams,
    query: Paging,
    handler: async ({ deps, org, params, query }) => {
      const o = mustOrg(org);
      return { body: await listPriceHistory(deps.db, o.id, 'service', params.serviceId, query) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/services/:serviceId/prices',
    scope: 'org',
    permission: 'prices.write',
    tag: 'Bảng giá',
    summary: 'Đổi giá dịch vụ (thêm phiên bản giá; có thể hẹn ngày áp dụng)',
    idempotent: true,
    params: ServiceParams,
    body: NewPriceBody,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const version = await deps.db.$transaction((tx) =>
        addPriceVersionPresented(tx, {
          organizationId: o.id,
          owner: 'service',
          ownerId: params.serviceId,
          price: body,
          actorUserId: mustUser(userId),
          requestId,
        }),
      );
      return { status: 201, body: version };
    },
  }),
];
