import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { vndFromBigInt } from '@makeup/shared';
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
import { NewPriceBody } from './services';

const PackageParams = OrgParams.extend({ packageId: z.uuid() });

const LOCATION_TYPES = ['STUDIO', 'CUSTOMER_HOME', 'OTHER'] as const;
const LocationType = z.enum(LOCATION_TYPES, { error: 'Địa điểm phải là STUDIO, CUSTOMER_HOME hoặc OTHER' });
// Rỗng = không giới hạn địa điểm. Trùng thì gộp, lưu theo thứ tự cố định.
const LocationTypes = z
  .array(LocationType)
  .max(LOCATION_TYPES.length)
  .transform((arr) => LOCATION_TYPES.filter((t) => arr.includes(t)));

const PackageItems = z
  .array(
    strictBody({
      serviceId: z.uuid(),
      quantity: z.number().int('Số lượng phải là số nguyên').min(1).max(100).default(1),
      isOptional: z.boolean().default(false),
    }),
  )
  .max(50)
  .refine(
    (items) => new Set(items.map((i) => i.serviceId)).size === items.length,
    'Mỗi dịch vụ chỉ được một dòng trong gói (tăng số lượng thay vì lặp lại)',
  );

type PackageItemInput = z.infer<typeof PackageItems>[number];

const packageFields = {
  code: Code,
  name: Name,
  description: Description.optional(),
  durationMinutes: Duration,
  staffCount: z.number().int().min(1, 'Số người làm tối thiểu là 1').max(20),
  depositAmount: Money,
  subjectId: z.uuid().nullable(),
  locationTypes: LocationTypes,
  terms: z.string().trim().max(5000).nullable(),
  isActive: z.boolean(),
  isPublic: z.boolean(),
  sortOrder: SortOrder,
  items: PackageItems,
};

const packageSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  durationMinutes: true,
  staffCount: true,
  depositAmount: true,
  subjectId: true,
  locationTypes: true,
  terms: true,
  isActive: true,
  isPublic: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true, isActive: true } },
  items: {
    select: {
      serviceId: true,
      quantity: true,
      isOptional: true,
      service: { select: { id: true, code: true, name: true, kind: true, isActive: true } },
    },
    orderBy: [{ isOptional: 'asc' }, { service: { sortOrder: 'asc' } }, { service: { name: 'asc' } }],
  },
} satisfies Prisma.ServicePackageSelect;

type PackageRow = Prisma.ServicePackageGetPayload<{ select: typeof packageSelect }>;

// Giá gói và giá từng dịch vụ trong gói cho cả trang: hai truy vấn, không tra từng dòng.
async function presentPackages(db: Prisma.TransactionClient, organizationId: string, rows: PackageRow[]) {
  const serviceIds = [...new Set(rows.flatMap((r) => r.items.map((i) => i.serviceId)))];
  const [packagePrice, servicePrice] = await Promise.all([
    currentPricesFor(
      db,
      organizationId,
      'package',
      rows.map((r) => r.id),
    ),
    currentPricesFor(db, organizationId, 'service', serviceIds),
  ]);
  return rows.map((r) => ({
    ...r,
    depositAmount: vndFromBigInt(r.depositAmount, 'tiền cọc'),
    currentPrice: packagePrice(r.id),
    items: r.items.map((i) => ({ ...i, currentPrice: servicePrice(i.serviceId) })),
  }));
}

async function presentOne(db: Prisma.TransactionClient, organizationId: string, row: PackageRow) {
  const [p] = await presentPackages(db, organizationId, [row]);
  if (!p) throw new Error('presentPackages trả thiếu phần tử — lỗi lập trình');
  return p;
}

async function assertSubjectUsable(tx: Prisma.TransactionClient, organizationId: string, subjectId: string | null | undefined) {
  if (!subjectId) return;
  const s = await tx.makeupSubject.findFirst({ where: { id: subjectId, organizationId }, select: { isActive: true } });
  if (!s) throw new AppError('VALIDATION_FAILED', 'Nhân vật makeup không tồn tại trong tổ chức', { subjectId });
  if (!s.isActive) throw new AppError('VALIDATION_FAILED', 'Nhân vật makeup đang ngừng hoạt động', { subjectId });
}

// Dòng đã gồm trong giá gói: dịch vụ chính hoặc phụ. Dòng tick thêm: chỉ dịch vụ phụ (ADDON).
async function assertItemsValid(tx: Prisma.TransactionClient, organizationId: string, items: PackageItemInput[]) {
  if (items.length === 0) return;
  const ids = items.map((i) => i.serviceId);
  const services = await tx.service.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true, code: true, kind: true },
  });
  const byId = new Map(services.map((s) => [s.id, s]));
  const unknown = ids.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Có dịch vụ không tồn tại trong tổ chức', { unknown });
  }
  for (const item of items) {
    const s = byId.get(item.serviceId);
    if (!s) throw new Error('Thiếu dịch vụ đã kiểm — lỗi lập trình');
    if (item.isOptional && s.kind !== 'ADDON') {
      throw new AppError(
        'VALIDATION_FAILED',
        `Dịch vụ ${s.code} thuộc loại ${s.kind}; chỉ dịch vụ phụ (ADDON) mới được để tick thêm`,
        { serviceId: s.id, kind: s.kind },
      );
    }
    if (!item.isOptional && s.kind === 'SURCHARGE') {
      throw new AppError('VALIDATION_FAILED', `Dịch vụ ${s.code} là phụ phí (SURCHARGE), không gộp vào giá gói được`, {
        serviceId: s.id,
        kind: s.kind,
      });
    }
  }
}

async function replaceItems(tx: Prisma.TransactionClient, organizationId: string, packageId: string, items: PackageItemInput[]) {
  await tx.packageItem.deleteMany({ where: { organizationId, packageId } });
  if (items.length > 0) {
    await tx.packageItem.createMany({ data: items.map((i) => ({ organizationId, packageId, ...i })) });
  }
}

function auditItems(items: { serviceId: string; quantity: number; isOptional: boolean }[]) {
  return items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity, isOptional: i.isOptional }));
}

export const packageRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/packages',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Danh sách gói dịch vụ kèm giá gói và giá dịch vụ phụ',
    query: Paging.extend({
      isActive: BoolQuery.optional(),
      subjectId: z.uuid().optional(),
      locationType: LocationType.optional(),
      q: SearchQuery,
    }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const where: Prisma.ServicePackageWhereInput = {
        organizationId: o.id,
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { code: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.locationType
          ? { AND: [{ OR: [{ locationTypes: { has: query.locationType } }, { locationTypes: { isEmpty: true } }] }] }
          : {}),
      };
      const [total, rows] = await deps.db.$transaction([
        deps.db.servicePackage.count({ where }),
        deps.db.servicePackage.findMany({
          where,
          select: packageSelect,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);
      return {
        body: { items: await presentPackages(deps.db, o.id, rows), page: query.page, pageSize: query.pageSize, total },
      };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/packages',
    idempotent: true,
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Tạo gói dịch vụ kèm giá đầu tiên (cần thêm quyền prices.write)',
    body: strictBody({
      ...packageFields,
      staffCount: packageFields.staffCount.optional(),
      depositAmount: Money.optional(),
      subjectId: packageFields.subjectId.optional(),
      locationTypes: LocationTypes.default([]),
      terms: packageFields.terms.optional(),
      isActive: z.boolean().optional(),
      isPublic: z.boolean().optional(),
      sortOrder: SortOrder.optional(),
      items: PackageItems.default([]),
      listPrice: Money,
      salePrice: PriceInput.salePrice,
    }),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      assertCanSetPrice(o);
      const uid = mustUser(userId);
      const { listPrice, salePrice, items, depositAmount, ...fields } = body;
      const created = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          await assertSubjectUsable(tx, o.id, fields.subjectId);
          await assertItemsValid(tx, o.id, items);
          const row = await tx.servicePackage.create({
            data: {
              organizationId: o.id,
              ...fields,
              ...(depositAmount !== undefined ? { depositAmount: BigInt(depositAmount) } : {}),
            },
            select: { id: true },
          });
          await replaceItems(tx, o.id, row.id, items);
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: uid,
            action: 'package.created',
            entityType: 'package',
            entityId: row.id,
            data: { ...fields, depositAmount: depositAmount ?? 0, items: auditItems(items), listPrice, salePrice: salePrice ?? null },
            requestId,
          });
          await addPriceVersion(tx, {
            organizationId: o.id,
            owner: 'package',
            ownerId: row.id,
            price: { listPrice, salePrice, note: 'Giá khởi tạo' },
            actorUserId: uid,
            requestId,
            skipLock: true,
          });
          return tx.servicePackage.findUniqueOrThrow({ where: { id: row.id }, select: packageSelect });
        }),
        'Mã gói đã có trong tổ chức',
      );
      return { status: 201, body: await presentOne(deps.db, o.id, created) };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/packages/:packageId',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Xem một gói dịch vụ kèm giá',
    params: PackageParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      const row = await deps.db.servicePackage.findFirst({
        where: { id: params.packageId, organizationId: o.id },
        select: packageSelect,
      });
      if (!row) throw notFound('package');
      return { body: await presentOne(deps.db, o.id, row) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/packages/:packageId',
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Sửa gói dịch vụ; gửi items là thay toàn bộ danh sách dịch vụ trong gói (không đổi giá ở đây)',
    params: PackageParams,
    body: strictBody(
      {
        code: Code.optional(),
        name: Name.optional(),
        description: Description.optional(),
        durationMinutes: Duration.optional(),
        staffCount: packageFields.staffCount.optional(),
        depositAmount: Money.optional(),
        subjectId: packageFields.subjectId.optional(),
        locationTypes: LocationTypes.optional(),
        terms: packageFields.terms.optional(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        sortOrder: SortOrder.optional(),
        items: PackageItems.optional(),
      },
      'đổi giá dùng POST /packages/:packageId/prices',
    ).refine(nonEmpty, 'Không có gì để sửa'),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const { items, depositAmount, ...fields } = body;
      const updated = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          const before = await tx.servicePackage.findFirst({
            where: { id: params.packageId, organizationId: o.id },
            select: packageSelect,
          });
          if (!before) throw notFound('package');
          await assertSubjectUsable(tx, o.id, fields.subjectId);
          if (items) await assertItemsValid(tx, o.id, items);
          await tx.servicePackage.update({
            where: { id: before.id },
            data: { ...fields, ...(depositAmount !== undefined ? { depositAmount: BigInt(depositAmount) } : {}) },
          });
          if (items) await replaceItems(tx, o.id, before.id, items);
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: mustUser(userId),
            action: 'package.updated',
            entityType: 'package',
            entityId: before.id,
            data: {
              before: {
                code: before.code,
                name: before.name,
                description: before.description,
                durationMinutes: before.durationMinutes,
                staffCount: before.staffCount,
                depositAmount: vndFromBigInt(before.depositAmount, 'tiền cọc'),
                subjectId: before.subjectId,
                locationTypes: before.locationTypes,
                terms: before.terms,
                isActive: before.isActive,
                isPublic: before.isPublic,
                sortOrder: before.sortOrder,
                items: auditItems(before.items),
              },
              after: { ...fields, depositAmount, items: items ? auditItems(items) : undefined },
            },
            requestId,
          });
          return tx.servicePackage.findUniqueOrThrow({ where: { id: before.id }, select: packageSelect });
        }),
        'Mã gói đã có trong tổ chức',
      );
      return { body: await presentOne(deps.db, o.id, updated) };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/packages/:packageId/prices',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Lịch sử giá của gói, mới nhất trước',
    params: PackageParams,
    query: Paging,
    handler: async ({ deps, org, params, query }) => {
      const o = mustOrg(org);
      return { body: await listPriceHistory(deps.db, o.id, 'package', params.packageId, query) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/packages/:packageId/prices',
    scope: 'org',
    permission: 'prices.write',
    tag: 'Bảng giá',
    summary: 'Đổi giá gói (thêm phiên bản giá; có thể hẹn ngày áp dụng)',
    idempotent: true,
    params: PackageParams,
    body: NewPriceBody,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const version = await deps.db.$transaction((tx) =>
        addPriceVersionPresented(tx, {
          organizationId: o.id,
          owner: 'package',
          ownerId: params.packageId,
          price: body,
          actorUserId: mustUser(userId),
          requestId,
        }),
      );
      return { status: 201, body: version };
    },
  }),
];
