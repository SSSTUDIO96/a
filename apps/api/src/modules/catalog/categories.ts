import { z } from 'zod';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { BoolQuery, Name, OrgParams, SortOrder, nonEmpty, strictBody, withUniqueMessage } from './common';

const CategoryParams = OrgParams.extend({ categoryId: z.uuid() });
const SubjectParams = OrgParams.extend({ subjectId: z.uuid() });

const NamedFields = { name: Name, sortOrder: SortOrder.optional(), isActive: z.boolean().optional() };
const NamedPatch = strictBody({ name: Name.optional(), sortOrder: SortOrder.optional(), isActive: z.boolean().optional() }).refine(
  nonEmpty,
  'Không có gì để sửa',
);

export const categoryRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/service-categories',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Danh sách danh mục dịch vụ',
    query: z.object({ isActive: BoolQuery.optional() }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const items = await deps.db.serviceCategory.findMany({
        where: { organizationId: o.id, ...(query.isActive !== undefined ? { isActive: query.isActive } : {}) },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        include: { _count: { select: { services: true } } },
      });
      return { body: { items: items.map(({ _count, ...c }) => ({ ...c, serviceCount: _count.services })) } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/service-categories',
    idempotent: true,
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Tạo danh mục dịch vụ',
    body: strictBody(NamedFields),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const created = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          const row = await tx.serviceCategory.create({ data: { organizationId: o.id, ...body } });
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: mustUser(userId),
            action: 'category.created',
            entityType: 'service_category',
            entityId: row.id,
            data: body,
            requestId,
          });
          return row;
        }),
        'Tên danh mục đã có trong tổ chức',
      );
      return { status: 201, body: created };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/service-categories/:categoryId',
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Đổi tên, thứ tự, bật/tắt danh mục dịch vụ',
    params: CategoryParams,
    body: NamedPatch,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const updated = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          const before = await tx.serviceCategory.findFirst({ where: { id: params.categoryId, organizationId: o.id } });
          if (!before) throw new AppError('NOT_FOUND', 'Không tìm thấy danh mục dịch vụ');
          const after = await tx.serviceCategory.update({ where: { id: before.id }, data: body });
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: mustUser(userId),
            action: 'category.updated',
            entityType: 'service_category',
            entityId: before.id,
            data: { before: { name: before.name, sortOrder: before.sortOrder, isActive: before.isActive }, after: body },
            requestId,
          });
          return after;
        }),
        'Tên danh mục đã có trong tổ chức',
      );
      return { body: updated };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/makeup-subjects',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Danh sách nhân vật makeup (cô dâu, mẹ cô dâu, phù dâu…)',
    query: z.object({ isActive: BoolQuery.optional() }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const items = await deps.db.makeupSubject.findMany({
        where: { organizationId: o.id, ...(query.isActive !== undefined ? { isActive: query.isActive } : {}) },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      });
      return { body: { items } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/makeup-subjects',
    idempotent: true,
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Thêm nhân vật makeup',
    body: strictBody(NamedFields),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const created = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          const row = await tx.makeupSubject.create({ data: { organizationId: o.id, ...body } });
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: mustUser(userId),
            action: 'subject.created',
            entityType: 'makeup_subject',
            entityId: row.id,
            data: body,
            requestId,
          });
          return row;
        }),
        'Tên nhân vật makeup đã có trong tổ chức',
      );
      return { status: 201, body: created };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/makeup-subjects/:subjectId',
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Đổi tên, thứ tự, bật/tắt nhân vật makeup',
    params: SubjectParams,
    body: NamedPatch,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const updated = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          const before = await tx.makeupSubject.findFirst({ where: { id: params.subjectId, organizationId: o.id } });
          if (!before) throw new AppError('NOT_FOUND', 'Không tìm thấy nhân vật makeup');
          const after = await tx.makeupSubject.update({ where: { id: before.id }, data: body });
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: mustUser(userId),
            action: 'subject.updated',
            entityType: 'makeup_subject',
            entityId: before.id,
            data: { before: { name: before.name, sortOrder: before.sortOrder, isActive: before.isActive }, after: body },
            requestId,
          });
          return after;
        }),
        'Tên nhân vật makeup đã có trong tổ chức',
      );
      return { body: updated };
    },
  }),
];
