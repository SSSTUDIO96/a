import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { vndFromBigInt } from '@makeup/shared';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import {
  BoolQuery,
  Money,
  Name,
  OrgParams,
  decimalNumber,
  decimalToNumber,
  lockOrg,
  nonEmpty,
  strictBody,
} from './common';

const LocationParams = OrgParams.extend({ locationId: z.uuid() });

const Latitude = decimalNumber({ min: -90, max: 90, scale: 6, label: 'Vĩ độ' }).nullable();
const Longitude = decimalNumber({ min: -180, max: 180, scale: 6, label: 'Kinh độ' }).nullable();
const Address = z.string().trim().min(1, 'Địa chỉ không được để trống').max(500);

const locationSelect = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  isDefault: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StudioLocationSelect;

type LocationRow = Prisma.StudioLocationGetPayload<{ select: typeof locationSelect }>;

function presentLocation(l: LocationRow) {
  return { ...l, latitude: decimalToNumber(l.latitude), longitude: decimalToNumber(l.longitude) };
}

function toDecimal(v: number | null | undefined): Prisma.Decimal | null | undefined {
  if (v === undefined) return undefined;
  return v === null ? null : new Prisma.Decimal(String(v));
}

// Toạ độ đi theo cặp (để tính km); studio mặc định phải đang hoạt động.
function assertLocationState(s: { latitude: unknown; longitude: unknown; isDefault: boolean; isActive: boolean }) {
  if ((s.latitude === null) !== (s.longitude === null)) {
    throw new AppError('VALIDATION_FAILED', 'Vĩ độ và kinh độ phải nhập cùng nhau hoặc cùng để trống');
  }
  if (s.isDefault && !s.isActive) {
    throw new AppError('VALIDATION_FAILED', 'Studio mặc định phải đang hoạt động; hãy đặt studio khác làm mặc định trước');
  }
}

const TravelMode = z.enum(['FIXED', 'PER_KM', 'MANUAL'], { error: 'Cách tính phải là FIXED, PER_KM hoặc MANUAL' });

type PolicyRow = Prisma.TravelFeePolicyGetPayload<object>;

function policyValues(p: PolicyRow) {
  return {
    defaultMode: p.defaultMode,
    fixedAmount: vndFromBigInt(p.fixedAmount, 'phí cố định'),
    perKmAmount: vndFromBigInt(p.perKmAmount, 'đơn giá mỗi km'),
    freeKm: p.freeKm.toNumber(),
    minimumAmount: vndFromBigInt(p.minimumAmount, 'phí tối thiểu'),
    roundTrip: p.roundTrip,
  };
}

function presentPolicy(p: PolicyRow) {
  return { ...policyValues(p), updatedAt: p.updatedAt };
}

export const locationRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/studio-locations',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Danh sách studio/cửa hàng (điểm xuất phát tính km)',
    query: z.object({ isActive: BoolQuery.optional() }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const rows = await deps.db.studioLocation.findMany({
        where: { organizationId: o.id, ...(query.isActive !== undefined ? { isActive: query.isActive } : {}) },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }, { id: 'asc' }],
        select: locationSelect,
      });
      return { body: { items: rows.map(presentLocation) } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/studio-locations',
    idempotent: true,
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Thêm studio/cửa hàng; đặt mặc định thì bỏ mặc định ở studio khác',
    body: strictBody({
      name: Name,
      address: Address,
      latitude: Latitude.optional(),
      longitude: Longitude.optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const isDefault = body.isDefault ?? false;
      const isActive = body.isActive ?? true;
      assertLocationState({ latitude: body.latitude ?? null, longitude: body.longitude ?? null, isDefault, isActive });
      const row = await deps.db.$transaction(async (tx) => {
        await lockOrg(tx, o.id);
        if (isDefault) {
          await tx.studioLocation.updateMany({ where: { organizationId: o.id, isDefault: true }, data: { isDefault: false } });
        }
        const created = await tx.studioLocation.create({
          data: {
            organizationId: o.id,
            name: body.name,
            address: body.address,
            latitude: toDecimal(body.latitude ?? null),
            longitude: toDecimal(body.longitude ?? null),
            isDefault,
            isActive,
          },
          select: locationSelect,
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'studio.created',
          entityType: 'studio_location',
          entityId: created.id,
          data: body,
          requestId,
        });
        return created;
      });
      return { status: 201, body: presentLocation(row) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/studio-locations/:locationId',
    scope: 'org',
    permission: 'catalog.write',
    tag: 'Bảng giá',
    summary: 'Sửa studio/cửa hàng; đặt mặc định thì bỏ mặc định ở studio khác',
    params: LocationParams,
    body: strictBody({
      name: Name.optional(),
      address: Address.optional(),
      latitude: Latitude.optional(),
      longitude: Longitude.optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }).refine(nonEmpty, 'Không có gì để sửa'),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const row = await deps.db.$transaction(async (tx) => {
        await lockOrg(tx, o.id);
        const before = await tx.studioLocation.findFirst({
          where: { id: params.locationId, organizationId: o.id },
          select: locationSelect,
        });
        if (!before) throw new AppError('NOT_FOUND', 'Không tìm thấy studio');
        const next = {
          latitude: body.latitude === undefined ? decimalToNumber(before.latitude) : body.latitude,
          longitude: body.longitude === undefined ? decimalToNumber(before.longitude) : body.longitude,
          isDefault: body.isDefault ?? before.isDefault,
          isActive: body.isActive ?? before.isActive,
        };
        assertLocationState(next);
        if (body.isDefault === true && !before.isDefault) {
          await tx.studioLocation.updateMany({
            where: { organizationId: o.id, isDefault: true, id: { not: before.id } },
            data: { isDefault: false },
          });
        }
        const after = await tx.studioLocation.update({
          where: { id: before.id },
          data: {
            name: body.name,
            address: body.address,
            latitude: toDecimal(body.latitude),
            longitude: toDecimal(body.longitude),
            isDefault: body.isDefault,
            isActive: body.isActive,
          },
          select: locationSelect,
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'studio.updated',
          entityType: 'studio_location',
          entityId: before.id,
          data: {
            before: {
              name: before.name,
              address: before.address,
              latitude: decimalToNumber(before.latitude),
              longitude: decimalToNumber(before.longitude),
              isDefault: before.isDefault,
              isActive: before.isActive,
            },
            after: body,
          },
          requestId,
        });
        return after;
      });
      return { body: presentLocation(row) };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/travel-fee-policy',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Cách tính phí di chuyển mặc định của tổ chức',
    handler: async ({ deps, org }) => {
      const o = mustOrg(org);
      const policy = await deps.db.travelFeePolicy.findUnique({ where: { organizationId: o.id } });
      // Tổ chức tạo trước bản vẽ v2 mà chưa chạy đồng bộ thì báo rõ, không bịa cấu hình.
      if (!policy) throw new AppError('NOT_FOUND', 'Tổ chức chưa có cấu hình phí di chuyển');
      return { body: presentPolicy(policy) };
    },
  }),

  defineRoute({
    method: 'put',
    path: '/orgs/:orgId/travel-fee-policy',
    scope: 'org',
    permission: 'prices.write',
    tag: 'Bảng giá',
    summary: 'Ghi đè toàn bộ cách tính phí di chuyển (gửi đủ mọi trường)',
    body: strictBody({
      defaultMode: TravelMode,
      fixedAmount: Money,
      perKmAmount: Money,
      freeKm: decimalNumber({ min: 0, max: 99999.99, scale: 2, label: 'Số km miễn phí' }),
      minimumAmount: Money,
      roundTrip: z.boolean(),
    }),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const data = {
        defaultMode: body.defaultMode,
        fixedAmount: BigInt(body.fixedAmount),
        perKmAmount: BigInt(body.perKmAmount),
        freeKm: new Prisma.Decimal(String(body.freeKm)),
        minimumAmount: BigInt(body.minimumAmount),
        roundTrip: body.roundTrip,
      };
      const row = await deps.db.$transaction(async (tx) => {
        await lockOrg(tx, o.id);
        const before = await tx.travelFeePolicy.findUnique({ where: { organizationId: o.id } });
        const after = before
          ? await tx.travelFeePolicy.update({ where: { organizationId: o.id }, data })
          : await tx.travelFeePolicy.create({ data: { organizationId: o.id, ...data } });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'travel_policy.updated',
          entityType: 'travel_fee_policy',
          entityId: o.id,
          data: { before: before ? policyValues(before) : null, after: body },
          requestId,
        });
        return after;
      });
      return { body: presentPolicy(row) };
    },
  }),
];
