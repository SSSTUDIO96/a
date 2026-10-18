import { z } from 'zod';
import { Prisma, type SubscriptionPlan } from '@prisma/client';
import { vndFromBigInt } from '@makeup/shared';
import { defineRoute, mustUser, type AnyRoute } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import {
  DEFAULT_PLAN_CODE,
  GRACE_DAYS,
  currentSubscriptionsSql,
  describeSubscription,
  effectiveStatusSql,
  expiringSql,
  getEffectivePlan,
  getUsage,
} from '../../lib/quota';

// Quản trị nền tảng (trang "SaaS" kiểu Studio Pro). Mọi đường scope 'platform':
// người không có tên trong platform_admins nhận 404 y hệt đường không tồn tại (xem app.ts).
// Quyền này chỉ cấp bằng script trên máy chủ (src/scripts/grant-platform-admin.ts) — không có API cấp quyền.
//
// Tham số đường dẫn đặt tên :organizationId (KHÔNG phải :orgId): cửa gác (test/gate.ts, luật 1) coi mọi đường có
// :orgId là đường thuộc tổ chức và đòi scope 'org'.

const TAG = 'Quản trị nền tảng';
const DAY_MS = 24 * 60 * 60 * 1000;

const Paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const OrganizationParams = z.object({ organizationId: z.uuid() });
const PlanParams = z.object({ planId: z.uuid() });
const EffectiveStatus = z.enum(['NONE', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED']);
const Money = z
  .number({ error: 'Số tiền phải là số' })
  .int('Số tiền phải là số nguyên đồng')
  .nonnegative('Số tiền không được âm')
  .max(Number.MAX_SAFE_INTEGER, 'Số tiền vượt ngưỡng cho phép');
const Limit = z.number().int('Giới hạn phải là số nguyên').min(0, 'Giới hạn không được âm').max(1_000_000_000).nullable();
const PlanCode = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{1,31}$/, 'Mã gói: chữ thường không dấu, số, gạch dưới; 2–32 ký tự');

// Chuỗi tìm kiếm đưa vào ILIKE: thoát ký tự đại diện để "%"/"_" người dùng gõ là chữ thường.
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function presentPlan(p: SubscriptionPlan) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    priceMonthly: vndFromBigInt(p.priceMonthly, 'giá gói'),
    maxStaff: p.maxStaff,
    maxAppointmentsPerMonth: p.maxAppointmentsPerMonth,
    maxStorageMb: p.maxStorageMb,
    maxStudents: p.maxStudents,
    maxCourses: p.maxCourses,
    customDomain: p.customDomain,
    features: p.features,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

interface CurrentRow {
  id: string;
  name: string;
  slug: string;
  kind: string;
  status: string;
  created_at: Date;
  sub_id: string | null;
  sub_status: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  plan_id: string | null;
  plan_code: string | null;
  plan_name: string | null;
  price_monthly: bigint | null;
  effective_status: string;
  total: number;
}

function presentCurrent(r: CurrentRow, now: Date) {
  if (!r.sub_id || !r.sub_status || !r.starts_at || !r.plan_id || !r.plan_code || !r.plan_name || r.price_monthly === null) {
    return null;
  }
  const state = describeSubscription({ status: r.sub_status as never, endsAt: r.ends_at }, now);
  return {
    id: r.sub_id,
    plan: { id: r.plan_id, code: r.plan_code, name: r.plan_name, priceMonthly: vndFromBigInt(r.price_monthly, 'giá gói') },
    status: r.sub_status,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    ...state,
  };
}

async function ownersOf(db: Prisma.TransactionClient, orgIds: string[]) {
  const rows = await db.membership.findMany({
    where: { organizationId: { in: orgIds }, status: 'ACTIVE', roles: { some: { role: { key: 'owner' } } } },
    select: { organizationId: true, user: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const map = new Map<string, { id: string; fullName: string; email: string }[]>();
  for (const r of rows) map.set(r.organizationId, [...(map.get(r.organizationId) ?? []), r.user]);
  return map;
}

async function countsOf(db: Prisma.TransactionClient, orgIds: string[]) {
  const [members, files] = await Promise.all([
    db.membership.groupBy({ by: ['organizationId'], where: { organizationId: { in: orgIds }, status: 'ACTIVE' }, _count: { _all: true } }),
    db.storedFile.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: orgIds }, status: { not: 'DELETED' } },
      _sum: { sizeBytes: true },
    }),
  ]);
  return {
    members: new Map(members.map((m) => [m.organizationId, m._count._all])),
    storage: new Map(files.map((f) => [f.organizationId, Number(f._sum.sizeBytes ?? 0n)])),
  };
}

async function findOrganization(db: Prisma.TransactionClient, id: string) {
  const org = await db.organization.findUnique({ where: { id } });
  if (!org) throw new AppError('NOT_FOUND', 'Không tìm thấy tổ chức');
  return org;
}

// Trường của gói, KHÔNG có giá trị mặc định: dùng chung cho tạo (thêm mặc định ở PlanBody) và sửa một phần (PlanPatchBody).
// Biên bản nghiệm thu máy chủ lát 2, lỗi S1: PATCH dùng PlanBody.partial() — zod 4 vẫn ĐIỀN .default() cho trường
// vắng mặt, nên chỉ sửa giá thì 9 thông số khác bị đặt về mặc định (xoá hết giới hạn, bật bán lại gói đã ngừng).
const planFields = {
  name: z.string().trim().min(1, 'Nhập tên gói').max(60),
  priceMonthly: Money,
  maxStaff: Limit,
  maxAppointmentsPerMonth: Limit,
  maxStorageMb: Limit,
  maxStudents: Limit,
  maxCourses: Limit,
  customDomain: z.boolean(),
  features: z.array(z.string().trim().min(1).max(64)).max(50),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1_000_000),
};

const PlanBody = z.object({
  code: PlanCode,
  ...planFields,
  maxStaff: planFields.maxStaff.default(null),
  maxAppointmentsPerMonth: planFields.maxAppointmentsPerMonth.default(null),
  maxStorageMb: planFields.maxStorageMb.default(null),
  maxStudents: planFields.maxStudents.default(null),
  maxCourses: planFields.maxCourses.default(null),
  customDomain: planFields.customDomain.default(false),
  features: planFields.features.default([]),
  isActive: planFields.isActive.default(true),
  sortOrder: planFields.sortOrder.default(0),
});

// Sửa một phần: chỉ trường được gửi bị đổi; KHÔNG có .default() (defineRoute từ chối PATCH có mặc định).
// Gửi "code" (mã gói không đổi được) hay trường lạ → 400 thay vì lặng lẽ bỏ qua.
const PlanPatchBody = z
  .strictObject(
    {
      name: planFields.name.optional(),
      priceMonthly: planFields.priceMonthly.optional(),
      maxStaff: planFields.maxStaff.optional(),
      maxAppointmentsPerMonth: planFields.maxAppointmentsPerMonth.optional(),
      maxStorageMb: planFields.maxStorageMb.optional(),
      maxStudents: planFields.maxStudents.optional(),
      maxCourses: planFields.maxCourses.optional(),
      customDomain: planFields.customDomain.optional(),
      features: planFields.features.optional(),
      isActive: planFields.isActive.optional(),
      sortOrder: planFields.sortOrder.optional(),
    },
    {
      error: (iss) =>
        iss.code === 'unrecognized_keys' ? `Không nhận trường: ${iss.keys.join(', ')} (mã gói không đổi được)` : undefined,
    },
  )
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Không có gì để sửa');

export const platformRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/platform/organizations',
    scope: 'platform',
    tag: TAG,
    summary: 'Danh sách tổ chức thuê (lọc trạng thái, gói, sắp hết hạn, tìm theo tên/đường dẫn/email chủ)',
    query: Paging.extend({
      status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
      subscriptionStatus: EffectiveStatus.optional(),
      planCode: z.string().trim().toLowerCase().max(32).optional(),
      expiringWithinDays: z.coerce.number().int().min(1).max(366).optional(),
      q: z.string().trim().max(100).optional(),
    }),
    handler: async ({ deps, query }) => {
      const now = new Date();
      const conds: Prisma.Sql[] = [];
      if (query.status) conds.push(Prisma.sql`status = ${query.status}`);
      if (query.subscriptionStatus) conds.push(Prisma.sql`effective_status = ${query.subscriptionStatus}`);
      if (query.planCode) conds.push(Prisma.sql`plan_code = ${query.planCode}`);
      if (query.expiringWithinDays) {
        const until = new Date(now.getTime() + query.expiringWithinDays * DAY_MS);
        conds.push(expiringSql(now, until));
      }
      if (query.q) {
        const like = likePattern(query.q);
        conds.push(Prisma.sql`(name ILIKE ${like} OR slug ILIKE ${like} OR EXISTS (
          SELECT 1 FROM memberships m
          JOIN membership_roles mr ON mr.membership_id = m.id
          JOIN roles r ON r.id = mr.role_id AND r.key = 'owner'
          JOIN users u ON u.id = m.user_id
          WHERE m.organization_id = eff.id AND m.status = 'ACTIVE' AND u.email ILIKE ${like}))`);
      }
      const where = conds.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;
      const rows = await deps.db.$queryRaw<CurrentRow[]>`
        WITH cur AS (${currentSubscriptionsSql(now)}),
             eff AS (SELECT cur.*, ${effectiveStatusSql(now)} AS effective_status FROM cur)
        SELECT eff.*, count(*) OVER ()::int AS total
        FROM eff ${where}
        ORDER BY created_at DESC, id
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
      let total = rows[0]?.total ?? 0;
      if (rows.length === 0 && query.page > 1) {
        // Trang vượt quá cuối: vẫn trả đúng tổng số.
        const c = await deps.db.$queryRaw<{ n: number }[]>`
          WITH cur AS (${currentSubscriptionsSql(now)}),
               eff AS (SELECT cur.*, ${effectiveStatusSql(now)} AS effective_status FROM cur)
          SELECT count(*)::int AS n FROM eff ${where}`;
        total = c[0]?.n ?? 0;
      }
      const ids = rows.map((r) => r.id);
      const [owners, counts] = await Promise.all([ownersOf(deps.db, ids), countsOf(deps.db, ids)]);
      const items = rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        kind: r.kind,
        status: r.status,
        createdAt: r.created_at,
        owner: owners.get(r.id)?.[0] ?? null,
        subscriptionStatus: r.effective_status,
        subscription: presentCurrent(r, now),
        memberCount: counts.members.get(r.id) ?? 0,
        storageUsedBytes: counts.storage.get(r.id) ?? 0,
      }));
      return { body: { items, page: query.page, pageSize: query.pageSize, total } };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/platform/organizations/:organizationId',
    scope: 'platform',
    tag: TAG,
    summary: 'Chi tiết tổ chức: chủ, thuê bao hiện hành, mức dùng so với giới hạn, lịch sử thuê bao',
    params: OrganizationParams,
    handler: async ({ deps, params }) => {
      const now = new Date();
      const org = await findOrganization(deps.db, params.organizationId);
      const [owners, counts, history] = await Promise.all([
        ownersOf(deps.db, [org.id]),
        countsOf(deps.db, [org.id]),
        deps.db.organizationSubscription.findMany({
          where: { organizationId: org.id },
          orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          include: { plan: { select: { id: true, code: true, name: true } } },
        }),
      ]);
      // Gói đang áp: chưa có thuê bao mà thiếu gói mặc định → báo rõ lỗi cấu hình ngay trên trang chi tiết thay vì 500.
      let effective: Awaited<ReturnType<typeof getEffectivePlan>> | null = null;
      let configError: string | null = null;
      try {
        effective = await getEffectivePlan(deps.db, org.id, now);
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        // Trang này chỉ quản trị nền tảng (người vận hành) xem được: hiện cả hướng dẫn sửa.
        configError = err.operatorHint ? `${err.message} ${err.operatorHint}` : err.message;
      }
      const current = effective?.current.hasSubscription ? effective.current : null;
      // Kỳ gia hạn nối tiếp xa nhất (cùng luật với "sắp hết hạn"): null = không có kỳ nối tiếp; renewedOpenEnded = nối tiếp không hạn.
      const cov = await deps.db.$queryRaw<{ ends_at: Date | null; coverage_end: Date | null }[]>`
        WITH cur AS (${currentSubscriptionsSql(now)}) SELECT ends_at, coverage_end FROM cur WHERE id = ${org.id}::uuid`;
      const endsAt = cov[0]?.ends_at ?? null;
      const coverageEnd = cov[0]?.coverage_end ?? null;
      // coverage_end NULL mà kỳ hiện hành có hạn ⇒ có kỳ nối tiếp không hạn.
      const renewedOpenEnded = endsAt !== null && coverageEnd === null;
      const renewedUntil = coverageEnd && endsAt && coverageEnd.getTime() > endsAt.getTime() ? coverageEnd : null;
      const [staff, appointmentsThisMonth, storageMb] = await Promise.all([
        getUsage(deps.db, org.id, 'staff', now),
        getUsage(deps.db, org.id, 'appointmentsPerMonth', now),
        getUsage(deps.db, org.id, 'storageMb', now),
      ]);
      return {
        body: {
          ...org,
          owners: owners.get(org.id) ?? [],
          memberCount: counts.members.get(org.id) ?? 0,
          storageUsedBytes: counts.storage.get(org.id) ?? 0,
          subscriptionStatus: current ? current.effectiveStatus : 'NONE',
          currentSubscription: current
            ? {
                id: current.subscription.id,
                status: current.subscription.status,
                startsAt: current.subscription.startsAt,
                endsAt: current.subscription.endsAt,
                note: current.subscription.note,
                effectiveStatus: current.effectiveStatus,
                graceEndsAt: current.graceEndsAt,
                inGrace: current.inGrace,
                writable: current.writable,
              }
            : null,
          effectivePlan: effective ? { source: effective.source, plan: presentPlan(effective.plan) } : null,
          configError,
          renewedUntil,
          renewedOpenEnded,
          graceDays: GRACE_DAYS,
          // Học viên / khoá học: chưa có module — null nghĩa là chưa đếm được.
          usage: { staff, appointmentsThisMonth, storageMb: Math.round(storageMb * 100) / 100, students: null, courses: null },
          subscriptions: history.map((s) => ({
            id: s.id,
            plan: s.plan,
            status: s.status,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            note: s.note,
            createdById: s.createdById,
            createdAt: s.createdAt,
            isCurrent: s.id === current?.subscription.id,
          })),
        },
      };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/platform/organizations/:organizationId/subscriptions',
    scope: 'platform',
    tag: TAG,
    summary: 'Đổi gói / gia hạn: thêm một dòng thuê bao mới (dòng cũ giữ nguyên làm lịch sử)',
    params: OrganizationParams,
    body: z
      .object({
        planId: z.uuid(),
        status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED']).default('ACTIVE'),
        startsAt: z.coerce.date().optional(),
        endsAt: z.coerce.date().nullable().optional(),
        months: z.number().int().min(1).max(120).optional(),
        note: z.string().trim().max(500).optional(),
        // Cố ý CẮT thuê bao đang hiệu lực: dòng mới kết thúc SỚM hơn dòng đang chạy (phần còn lại của dòng cũ sẽ mất).
        replaceCurrent: z.boolean().optional(),
      })
      .refine((b) => !(b.endsAt !== undefined && b.months !== undefined), 'Chỉ gửi một trong hai: endsAt hoặc months'),
    handler: async ({ deps, params, body, userId, requestId }) => {
      const actor = mustUser(userId);
      const row = await deps.db.$transaction(async (tx) => {
        // Khoá dòng tổ chức: hai lần đổi gói cùng lúc phải xếp hàng (luật startsAt không lùi bên dưới cần thế).
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM organizations WHERE id = ${params.organizationId}::uuid FOR UPDATE`;
        if (locked.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy tổ chức');
        const plan = await tx.subscriptionPlan.findUnique({ where: { id: body.planId } });
        if (!plan) throw new AppError('NOT_FOUND', 'Không tìm thấy gói');
        if (!plan.isActive && plan.code !== DEFAULT_PLAN_CODE) throw new AppError('CONFLICT', 'Gói này đã ngừng bán');
        const startsAt = body.startsAt ?? new Date();
        const endsAt =
          body.months !== undefined
            ? addMonths(startsAt, body.months)
            : body.endsAt === undefined
              ? null
              : body.endsAt;
        if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
          throw new AppError('VALIDATION_FAILED', 'Ngày hết hạn phải sau ngày bắt đầu', { fields: ['endsAt'] });
        }
        // Lịch sử chỉ đi tới: dòng mới không được bắt đầu trước dòng mới nhất đã có
        // (nếu không, "thuê bao hiện hành" sẽ nhảy ngược khó hiểu).
        const latest = await tx.organizationSubscription.findFirst({
          where: { organizationId: params.organizationId },
          orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, startsAt: true },
        });
        if (latest && startsAt.getTime() < latest.startsAt.getTime()) {
          throw new AppError('CONFLICT', 'Ngày bắt đầu không được trước ngày bắt đầu của thuê bao mới nhất', {
            latestStartsAt: latest.startsAt,
          });
        }
        // CHỒNG THỜI GIAN (biên bản máy chủ lát 2, N8): dòng bắt đầu sau thắng, nên một dòng ngắn thêm chồng lên kỳ đã trả
        // làm mất phần còn lại của kỳ đó (hết dòng ngắn là tổ chức bị chỉ đọc). Chặn khi dòng mới (đang có hiệu lực:
        // TRIAL/ACTIVE/PAST_DUE) kết thúc TRƯỚC dòng đang phủ thời điểm bắt đầu — trừ khi gửi replaceCurrent: true.
        // Vẫn cho: hẹn gia hạn nối tiếp (bắt đầu từ ngày hết hạn trở đi), đổi/nâng gói kéo dài bằng hoặc hơn, ghi dòng
        // huỷ/hết hạn (chủ ý chấm dứt). Kiểm trong transaction đã khoá dòng tổ chức nên hai lệnh cùng lúc xếp hàng.
        const covering = await tx.organizationSubscription.findFirst({
          where: { organizationId: params.organizationId, startsAt: { lte: startsAt } },
          orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          include: { plan: { select: { code: true } } },
        });
        const coveringLive =
          covering !== null &&
          (covering.status === 'TRIAL' || covering.status === 'ACTIVE' || covering.status === 'PAST_DUE') &&
          (covering.endsAt === null || covering.endsAt.getTime() > startsAt.getTime());
        const newLive = body.status === 'TRIAL' || body.status === 'ACTIVE' || body.status === 'PAST_DUE';
        const cutsShort =
          coveringLive && newLive && endsAt !== null && (covering.endsAt === null || endsAt.getTime() < covering.endsAt.getTime());
        if (cutsShort && !body.replaceCurrent) {
          throw new AppError(
            'CONFLICT',
            `Thuê bao chồng thời gian: dòng đang hiệu lực (gói ${covering.plan.code}, ` +
              `${covering.endsAt ? `tới ${covering.endsAt.toISOString().slice(0, 10)}` : 'không hạn'}) còn dài hơn dòng mới — ` +
              'phần còn lại của kỳ đó sẽ mất. Hẹn dòng mới bắt đầu từ ngày hết hạn của dòng cũ (gia hạn nối tiếp), ' +
              'cho dòng mới kết thúc không sớm hơn, hoặc gửi replaceCurrent: true nếu cố ý cắt.',
            { conflictingSubscriptionId: covering.id, conflictingEndsAt: covering.endsAt, renewFrom: covering.endsAt },
          );
        }
        const created = await tx.organizationSubscription.create({
          data: {
            organizationId: params.organizationId,
            planId: plan.id,
            status: body.status,
            startsAt,
            endsAt,
            note: body.note ?? null,
            createdById: actor,
          },
        });
        await writeAudit(tx, {
          organizationId: params.organizationId,
          actorUserId: actor,
          action: 'platform.subscription_added',
          entityType: 'organization_subscription',
          entityId: created.id,
          data: {
            planCode: plan.code,
            priceMonthly: vndFromBigInt(plan.priceMonthly, 'giá gói'),
            status: body.status,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt?.toISOString() ?? null,
            previousSubscriptionId: latest?.id ?? null,
            // Dòng mới đè lên dòng đang hiệu lực từ startsAt (và nếu cắt ngắn: phần còn lại bị bỏ, người quản trị đã xác nhận).
            supersedes: coveringLive && covering ? { id: covering.id, endsAt: covering.endsAt?.toISOString() ?? null, cutShort: cutsShort } : null,
            note: body.note ?? null,
          },
          requestId,
        });
        return created;
      });
      return { status: 201, body: { ...row, ...describeSubscription(row, new Date()) } };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/platform/organizations/:organizationId',
    scope: 'platform',
    tag: TAG,
    summary: 'Tạm khoá / mở khoá tổ chức (dữ liệu giữ nguyên)',
    params: OrganizationParams,
    body: z
      .object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().max(500).optional() })
      .refine((b) => b.status !== 'SUSPENDED' || (b.reason !== undefined && b.reason.length > 0), {
        message: 'Nhập lý do tạm khoá',
        path: ['reason'],
      }),
    handler: async ({ deps, params, body, userId, requestId }) => {
      const actor = mustUser(userId);
      const row = await deps.db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM organizations WHERE id = ${params.organizationId}::uuid FOR UPDATE`;
        if (locked.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy tổ chức');
        const before = await findOrganization(tx, params.organizationId);
        if (before.status === body.status) return before;
        const after = await tx.organization.update({ where: { id: before.id }, data: { status: body.status } });
        await writeAudit(tx, {
          organizationId: before.id,
          actorUserId: actor,
          action: body.status === 'SUSPENDED' ? 'platform.org_suspended' : 'platform.org_reactivated',
          entityType: 'organization',
          entityId: before.id,
          data: { before: { status: before.status }, after: { status: body.status }, reason: body.reason ?? null },
          requestId,
        });
        return after;
      });
      return { body: row };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/platform/plans',
    scope: 'platform',
    tag: TAG,
    summary: 'Danh sách gói thuê bao và giới hạn (null = không giới hạn)',
    handler: async ({ deps }) => {
      const rows = await deps.db.subscriptionPlan.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
      return { body: { items: rows.map(presentPlan) } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/platform/plans',
    scope: 'platform',
    tag: TAG,
    summary: 'Tạo gói thuê bao',
    body: PlanBody,
    handler: async ({ deps, body, userId, requestId }) => {
      const actor = mustUser(userId);
      const row = await deps.db.$transaction(async (tx) => {
        const taken = await tx.subscriptionPlan.findUnique({ where: { code: body.code }, select: { id: true } });
        if (taken) throw new AppError('CONFLICT', 'Mã gói đã có', { fields: ['code'] });
        const created = await tx.subscriptionPlan.create({ data: { ...body, priceMonthly: BigInt(body.priceMonthly) } });
        await writeAudit(tx, {
          organizationId: null,
          actorUserId: actor,
          action: 'platform.plan_created',
          entityType: 'subscription_plan',
          entityId: created.id,
          data: body,
          requestId,
        });
        return created;
      });
      return { status: 201, body: presentPlan(row) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/platform/plans/:planId',
    scope: 'platform',
    tag: TAG,
    summary: 'Sửa gói (mã gói không đổi được). Đổi giá áp cho mọi thuê bao đang dùng gói này.',
    params: PlanParams,
    body: PlanPatchBody,
    handler: async ({ deps, params, body, userId, requestId }) => {
      const actor = mustUser(userId);
      const row = await deps.db.$transaction(async (tx) => {
        const before = await tx.subscriptionPlan.findUnique({ where: { id: params.planId } });
        if (!before) throw new AppError('NOT_FOUND', 'Không tìm thấy gói');
        const { priceMonthly, ...rest } = body;
        const after = await tx.subscriptionPlan.update({
          where: { id: before.id },
          data: { ...rest, ...(priceMonthly !== undefined ? { priceMonthly: BigInt(priceMonthly) } : {}) },
        });
        await writeAudit(tx, {
          organizationId: null,
          actorUserId: actor,
          action: 'platform.plan_updated',
          entityType: 'subscription_plan',
          entityId: before.id,
          // Ghi cả trạng thái sau thật sự (không chỉ thân gửi lên) và danh sách trường đã gửi: nhìn nhật ký biết ngay đổi gì.
          data: {
            before: presentPlan(before),
            after: presentPlan(after),
            changedFields: Object.keys(body).filter((k) => body[k as keyof typeof body] !== undefined),
          } as unknown as Prisma.InputJsonValue,
          requestId,
        });
        return after;
      });
      return { body: presentPlan(row) };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/platform/stats',
    scope: 'platform',
    tag: TAG,
    summary: 'Thống kê: tổ chức theo trạng thái, sắp hết hạn 30 ngày, doanh thu thuê bao DỰ KIẾN theo tháng',
    handler: async ({ deps }) => {
      const now = new Date();
      const until = new Date(now.getTime() + 30 * DAY_MS);
      const rows = await deps.db.$queryRaw<
        { status: string; effective_status: string; n: number; expiring: number; revenue: bigint | null }[]
      >`
        WITH cur AS (${currentSubscriptionsSql(now)}),
             eff AS (SELECT cur.*, ${effectiveStatusSql(now)} AS effective_status FROM cur)
        SELECT status, effective_status, count(*)::int AS n,
               count(*) FILTER (WHERE ${expiringSql(now, until)})::int AS expiring,
               sum(price_monthly) FILTER (WHERE effective_status = 'ACTIVE' AND status = 'ACTIVE')::bigint AS revenue
        FROM eff GROUP BY status, effective_status`;
      const byStatus: Record<string, number> = { ACTIVE: 0, SUSPENDED: 0 };
      const bySubscriptionStatus: Record<string, number> = { NONE: 0, TRIAL: 0, ACTIVE: 0, PAST_DUE: 0, EXPIRED: 0, CANCELLED: 0 };
      let total = 0;
      let expiringIn30Days = 0;
      let revenue = 0n;
      for (const r of rows) {
        total += r.n;
        byStatus[r.status] = (byStatus[r.status] ?? 0) + r.n;
        bySubscriptionStatus[r.effective_status] = (bySubscriptionStatus[r.effective_status] ?? 0) + r.n;
        expiringIn30Days += r.expiring;
        revenue += r.revenue ?? 0n;
      }
      return {
        body: {
          organizations: { total, byStatus, bySubscriptionStatus },
          expiringIn30Days,
          projectedMonthlyRevenue: vndFromBigInt(revenue, 'doanh thu dự kiến'),
          projectedMonthlyRevenueNote:
            'Dự kiến: tổng giá/tháng HIỆN TẠI của gói ở các thuê bao đang ACTIVE (chưa quá hạn), KHÔNG tính tổ chức đang bị tạm khoá. Không phải tiền đã thu.',
          generatedAt: now,
        },
      };
    },
  }),
];

// Cộng tháng theo lịch (UTC); ngày 31 + 1 tháng → ngày cuối tháng sau, không tràn sang tháng kế.
function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
}
