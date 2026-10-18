import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { vndFromBigInt } from '@makeup/shared';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { avatarSelect, resolveAvatarUrls } from '../files/service';
import { initialsOf } from './common';

// Tiền công theo bậc cho MỘT gói hoặc MỘT dịch vụ. Màn hình: mỗi bậc một hàng — ảnh + tên các thợ thuộc bậc — ô nhập tiền.
type OwnerKind = 'package' | 'service';

interface Owner {
  kind: OwnerKind;
  id: string;
  name: string;
}

function ownerWhere(owner: Owner): { packageId: string } | { serviceId: string } {
  return owner.kind === 'package' ? { packageId: owner.id } : { serviceId: owner.id };
}

// Khoá dòng gói/dịch vụ: hai người cùng sửa tiền công của một gói xếp hàng, không đụng khoá duy nhất.
async function loadOwner(
  tx: Prisma.TransactionClient,
  orgId: string,
  kind: OwnerKind,
  id: string,
  lock: boolean,
): Promise<Owner> {
  if (kind === 'package') {
    if (lock) await tx.$queryRaw`SELECT id FROM service_packages WHERE id = ${id}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`;
    const p = await tx.servicePackage.findFirst({ where: { id, organizationId: orgId }, select: { id: true, name: true } });
    if (!p) throw new AppError('NOT_FOUND', 'Không tìm thấy gói');
    return { kind, id: p.id, name: p.name };
  }
  if (lock) await tx.$queryRaw`SELECT id FROM services WHERE id = ${id}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`;
  const s = await tx.service.findFirst({ where: { id, organizationId: orgId }, select: { id: true, name: true } });
  if (!s) throw new AppError('NOT_FOUND', 'Không tìm thấy dịch vụ');
  return { kind, id: s.id, name: s.name };
}

// Ba câu truy vấn cố định (bậc, mức công, hồ sơ thợ) rồi ghép trong bộ nhớ — không N+1 theo số bậc.
async function buildSheet(tx: Prisma.TransactionClient, orgId: string, owner: Owner) {
  const [tiers, rates, profiles] = await Promise.all([
    tx.staffTier.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    tx.staffPayRate.findMany({
      where: { organizationId: orgId, ...ownerWhere(owner) },
      select: { tierId: true, amount: true, updatedAt: true },
    }),
    tx.staffProfile.findMany({
      where: { organizationId: orgId, tierId: { not: null }, tier: { isActive: true }, membership: { status: 'ACTIVE' } },
      select: {
        membershipId: true,
        tierId: true,
        displayName: true,
        ...avatarSelect,
        membership: { select: { user: { select: { fullName: true } } } },
      },
    }),
  ]);
  const rateByTier = new Map(rates.map((r) => [r.tierId, r]));
  const avatarOf = await resolveAvatarUrls(
    tx,
    orgId,
    profiles,
  );
  const staffByTier = new Map<string, { membershipId: string; displayName: string; avatarUrl: string | null; initials: string }[]>();
  for (const p of profiles) {
    if (!p.tierId) continue;
    const displayName = p.displayName ?? p.membership.user.fullName;
    const list = staffByTier.get(p.tierId) ?? [];
    list.push({ membershipId: p.membershipId, displayName, avatarUrl: avatarOf(p), initials: initialsOf(displayName) });
    staffByTier.set(p.tierId, list);
  }
  return {
    owner: { kind: owner.kind, id: owner.id, name: owner.name },
    items: tiers.map((t) => {
      const rate = rateByTier.get(t.id);
      return {
        tier: { id: t.id, name: t.name, sortOrder: t.sortOrder },
        amount: rate ? vndFromBigInt(rate.amount, `tiền công bậc ${t.name}`) : null,
        updatedAt: rate ? rate.updatedAt.toISOString() : null,
        staff: (staffByTier.get(t.id) ?? []).sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi')),
      };
    }),
  };
}

const RatesBody = z.object({
  rates: z
    .array(
      z.object({
        tierId: z.uuid(),
        // Số nguyên đồng ≥ 0; null = xoá mức công của bậc này.
        amount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
      }),
    )
    .min(1)
    .max(100)
    .refine((r) => new Set(r.map((x) => x.tierId)).size === r.length, 'Mỗi bậc chỉ được gửi một lần'),
});

const PackageParams = z.object({ orgId: z.uuid(), packageId: z.uuid() });
const ServiceParams = z.object({ orgId: z.uuid(), serviceId: z.uuid() });

function buildPayRateRoutes<P extends z.ZodType<{ orgId: string }>>(
  kind: OwnerKind,
  Params: P,
  ownerIdOf: (p: z.infer<P>) => string,
) {
  const segment = kind === 'package' ? 'packages' : 'services';
  const idParam = kind === 'package' ? 'packageId' : 'serviceId';
  const label = kind === 'package' ? 'gói' : 'dịch vụ';

  return [
    defineRoute({
      method: 'get',
      path: `/orgs/:orgId/${segment}/:${idParam}/pay-rates`,
      scope: 'org',
      permission: 'payroll.read',
      tag: 'Tiền công',
      summary: `Tiền công theo bậc của một ${label}: mọi bậc đang hoạt động, thợ thuộc mỗi bậc, số tiền (null = chưa đặt)`,
      params: Params,
      handler: async ({ deps, org, params }) => {
        const o = mustOrg(org);
        const owner = await loadOwner(deps.db, o.id, kind, ownerIdOf(params), false);
        return { body: await buildSheet(deps.db, o.id, owner) };
      },
    }),

    defineRoute({
      method: 'put',
      path: `/orgs/:orgId/${segment}/:${idParam}/pay-rates`,
      scope: 'org',
      permission: 'payroll.write',
      tag: 'Tiền công',
      summary: `Đặt tiền công nhiều bậc cùng lúc cho một ${label} (amount null = xoá mức); bậc không gửi giữ nguyên`,
      params: Params,
      body: RatesBody,
      handler: async ({ deps, org, params, body, userId, requestId }) => {
        const o = mustOrg(org);
        const uid = mustUser(userId);
        const sheet = await deps.db.$transaction(async (tx) => {
          const owner = await loadOwner(tx, o.id, kind, ownerIdOf(params), true);
          const tierIds = body.rates.map((r) => r.tierId);
          const tiers = await tx.staffTier.findMany({
            where: { id: { in: tierIds }, organizationId: o.id },
            select: { id: true, name: true, isActive: true },
          });
          const tierById = new Map(tiers.map((t) => [t.id, t]));
          const unknown = tierIds.filter((id) => !tierById.has(id));
          if (unknown.length > 0) {
            throw new AppError('VALIDATION_FAILED', 'Có bậc lương không thuộc tổ chức', { tierIds: unknown });
          }
          const hidden = body.rates.filter((r) => r.amount !== null && tierById.get(r.tierId)?.isActive === false);
          if (hidden.length > 0) {
            throw new AppError('VALIDATION_FAILED', 'Có bậc lương đang ẩn, không đặt tiền công được', {
              tierIds: hidden.map((r) => r.tierId),
            });
          }
          const existing = await tx.staffPayRate.findMany({
            where: { organizationId: o.id, ...ownerWhere(owner), tierId: { in: tierIds } },
            select: { id: true, tierId: true, amount: true },
          });
          const existingByTier = new Map(existing.map((r) => [r.tierId, r]));

          for (const r of body.rates) {
            const prev = existingByTier.get(r.tierId);
            const tierName = tierById.get(r.tierId)?.name ?? '';
            const before = prev ? vndFromBigInt(prev.amount) : null;
            if (before === r.amount) continue;
            let entityId: string;
            if (r.amount === null) {
              if (!prev) continue;
              await tx.staffPayRate.delete({ where: { id: prev.id } });
              entityId = prev.id;
            } else if (prev) {
              await tx.staffPayRate.update({ where: { id: prev.id }, data: { amount: BigInt(r.amount), updatedById: uid } });
              entityId = prev.id;
            } else {
              const created = await tx.staffPayRate.create({
                data: { organizationId: o.id, ...ownerWhere(owner), tierId: r.tierId, amount: BigInt(r.amount), updatedById: uid },
                select: { id: true },
              });
              entityId = created.id;
            }
            await writeAudit(tx, {
              organizationId: o.id,
              actorUserId: uid,
              action: r.amount === null ? 'pay_rate.deleted' : 'pay_rate.set',
              entityType: 'staff_pay_rate',
              entityId,
              data: { [idParam]: owner.id, ownerName: owner.name, tierId: r.tierId, tierName, before, after: r.amount },
              requestId,
            });
          }
          return buildSheet(tx, o.id, owner);
        });
        return { body: sheet };
      },
    }),
  ];
}

export const payRateRoutes = [
  ...buildPayRateRoutes('package', PackageParams, (p) => p.packageId),
  ...buildPayRateRoutes('service', ServiceParams, (p) => p.serviceId),
];
