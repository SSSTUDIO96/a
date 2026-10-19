// LUẬT PHỤ PHÍ (bản vẽ D mục 2.3): khớp thì máy chủ tự thêm dòng SURCHARGE vào hợp đồng (contracts/autoSurcharge.ts).
// Cài luật = đụng tiền → cần prices.write (ký duyệt D câu 4). Không có đường xoá: dòng hợp đồng trỏ về luật — tắt bằng isActive.
// Sửa / tắt luật KHÔNG đổi hợp đồng đã lưu; hợp đồng nháp nhận luật mới ở lần lưu dòng kế tiếp.
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { timeToMinutes, vndFromBigInt, type Vnd } from '@makeup/shared';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { dateFromWire, dateToWire, timeToWire } from '../courses/present';
import { BoolQuery, OrgParams, SortOrder, lockOrg, nonEmpty, strictBody, withUniqueMessage } from './common';
import { resolveCurrentPrices } from './prices';

// Trần số luật ĐANG BẬT của một tổ chức (bật luật thứ 51 → 409).
export const MAX_ACTIVE_SURCHARGE_RULES = 50;

const RuleParams = OrgParams.extend({ surchargeRuleId: z.uuid() });

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Giờ theo dạng HH:MM, ví dụ 05:30');
const Day = z.iso.date({ error: 'Ngày theo dạng YYYY-MM-DD' });

const ruleFields = {
  name: z.string().trim().min(1, 'Tên luật không được để trống').max(120),
  serviceId: z.uuid(),
  startTime: HHMM.nullable().optional(), // null (PATCH) = bỏ khung giờ
  endTime: HHMM.nullable().optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  dates: z.array(Day).max(366).optional(),
  occasionIds: z.array(z.uuid()).max(50).optional(),
  packageIds: z.array(z.uuid()).max(100).optional(),
  subjectIds: z.array(z.uuid()).max(50).optional(),
  perQuantity: z.boolean().optional(), // KHÔNG .default(): mặc định ở database (true)
  note: z.string().trim().max(500).nullable().optional(),
  sortOrder: SortOrder.optional(),
  isActive: z.boolean().optional(),
};

// Phần điều kiện của luật — kiểm trên thân POST, và trên bản GHÉP (đang lưu + thân) của PATCH.
interface RuleShapeInput {
  startTime?: string | null;
  endTime?: string | null;
  weekdays?: readonly number[];
  dates?: readonly string[];
  occasionIds?: readonly string[];
  packageIds?: readonly string[];
  subjectIds?: readonly string[];
}

const NO_TRIGGER = 'Luật phải có ít nhất một điều kiện: khung giờ, ngày hoặc loại sự kiện';

function checkRuleShape(b: RuleShapeInput, ctx: z.RefinementCtx): void {
  const start = b.startTime ?? null;
  const end = b.endTime ?? null;
  if ((start === null) !== (end === null)) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Nhập cả giờ bắt đầu và giờ kết thúc của khung' });
  } else if (start !== null && end !== null) {
    if (start === '24:00') ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Giờ bắt đầu từ 00:00 đến 23:59' });
    if (start === end) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Giờ bắt đầu và kết thúc phải khác nhau' });
    // CHECK surcharge_rules_window: end_minute 1..1440 — nửa đêm ở đầu "đến" ghi 24:00.
    else if (end === '00:00') {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Giờ kết thúc từ 00:01 đến 24:00 — nửa đêm ghi 24:00' });
    }
  }
  for (const key of ['weekdays', 'dates', 'occasionIds', 'packageIds', 'subjectIds'] as const) {
    const arr = b[key] as readonly unknown[] | undefined;
    if (arr && new Set(arr).size !== arr.length) ctx.addIssue({ code: 'custom', path: [key], message: 'Có giá trị bị chọn trùng' });
  }
  const hasTrigger =
    start !== null || end !== null || (b.weekdays?.length ?? 0) > 0 || (b.dates?.length ?? 0) > 0 || (b.occasionIds?.length ?? 0) > 0;
  if (!hasTrigger) ctx.addIssue({ code: 'custom', path: ['startTime'], message: NO_TRIGGER });
}

export const RuleCreate = strictBody(ruleFields).superRefine(checkRuleShape);
// Mọi trường tuỳ chọn — viết rõ, không có hàm "partial" (zod 4 vẫn điền .default() trong .partial(): http/partial.ts).
export const RulePatch = strictBody({ ...ruleFields, name: ruleFields.name.optional(), serviceId: z.uuid().optional() }).refine(
  nonEmpty,
  'Không có gì để sửa',
);
// Kiểm lại bản ghép của PATCH: ném ZodError → 400 cùng dạng, cùng lời, cùng `path` với POST.
const MergedShape = z
  .object({
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    weekdays: z.array(z.number()),
    dates: z.array(z.string()),
    occasionIds: z.array(z.string()),
    packageIds: z.array(z.string()),
    subjectIds: z.array(z.string()),
  })
  .superRefine(checkRuleShape);

type RuleCreateBody = z.infer<typeof RuleCreate>;
type RulePatchBody = z.infer<typeof RulePatch>;

// ---------- Đọc ----------

const ruleInclude = {
  service: { select: { id: true, name: true, kind: true, isActive: true } },
  targets: { select: { occasionId: true, packageId: true, subjectId: true } },
  dates: { select: { day: true }, orderBy: { day: 'asc' } },
} satisfies Prisma.SurchargeRuleInclude;

type RuleRow = Prisma.SurchargeRuleGetPayload<{ include: typeof ruleInclude }>;

const ORDER: Prisma.SurchargeRuleOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];

const sortedIds = (xs: (string | null)[]) => xs.filter((x): x is string => x !== null).sort();

// Bản chụp luật (điều kiện đầy đủ) — dùng cho phản hồi và cho nhật ký { before, after }.
function snapshot(r: RuleRow) {
  return {
    name: r.name,
    serviceId: r.serviceId,
    startTime: timeToWire(r.startMinute),
    endTime: timeToWire(r.endMinute),
    weekdays: r.weekdays,
    dates: r.dates.map((d) => dateToWire(d.day)),
    occasionIds: sortedIds(r.targets.map((t) => t.occasionId)),
    packageIds: sortedIds(r.targets.map((t) => t.packageId)),
    subjectIds: sortedIds(r.targets.map((t) => t.subjectId)),
    perQuantity: r.perQuantity,
    note: r.note,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  };
}

export type SurchargeRuleStatus = 'OK' | 'SERVICE_INACTIVE' | 'SERVICE_NOT_SURCHARGE' | 'NO_PRICE';

// Vì sao luật đang không sinh dòng — tính lúc đọc (dịch vụ có thể đổi loại / ngừng / chưa có giá sau khi lưu luật).
function ruleStatus(service: RuleRow['service'], currentPrice: Vnd | null): SurchargeRuleStatus {
  if (!service.isActive) return 'SERVICE_INACTIVE';
  if (service.kind !== 'SURCHARGE') return 'SERVICE_NOT_SURCHARGE';
  if (currentPrice === null) return 'NO_PRICE';
  return 'OK';
}

// Trình bày cả trang: giá hiện hành MỘT câu cho mọi dịch vụ, số dòng đang dùng MỘT câu groupBy (không N+1).
async function present(db: Prisma.TransactionClient, organizationId: string, rows: RuleRow[]) {
  if (!organizationId) throw new Error('present luật phụ phí: thiếu organizationId');
  const ruleIds = rows.map((r) => r.id);
  const [prices, used] = await Promise.all([
    resolveCurrentPrices(db, organizationId, 'service', [...new Set(rows.map((r) => r.serviceId))]),
    ruleIds.length === 0
      ? Promise.resolve([])
      : db.contractLine.groupBy({
          by: ['surchargeRuleId'],
          where: { organizationId, surchargeRuleId: { in: ruleIds }, voidedAt: null },
          _count: { _all: true },
        }),
  ]);
  const usedBy = new Map(used.map((u) => [u.surchargeRuleId, u._count._all]));
  return rows.map((r) => {
    const price = prices.get(r.serviceId);
    const currentPrice = price ? vndFromBigInt(price.unitPrice, 'giá phụ phí') : null;
    return {
      id: r.id,
      ...snapshot(r),
      service: { ...r.service, currentPrice },
      status: ruleStatus(r.service, currentPrice),
      usedLineCount: usedBy.get(r.id) ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

async function loadRule(tx: Prisma.TransactionClient, organizationId: string, id: string): Promise<RuleRow> {
  const row = await tx.surchargeRule.findFirst({ where: { id, organizationId }, include: ruleInclude });
  if (!row) throw new AppError('NOT_FOUND', 'Không tìm thấy luật phụ phí');
  return row;
}

// ---------- Kiểm tham chiếu (thứ tự cố định để lời lỗi ổn định — bản vẽ D 2.3 bước 1–3) ----------

const KIND_LABEL: Record<string, string> = { MAIN: 'dịch vụ chính', ADDON: 'dịch vụ phụ' };

async function assertAllInOrg(
  find: (ids: string[]) => Promise<{ id: string }[]>,
  ids: readonly string[] | undefined,
  message: string,
): Promise<void> {
  if (!ids || ids.length === 0) return;
  const unique = [...new Set(ids)];
  const found = await find(unique);
  // Mã bịa và mã của tổ chức khác: cùng một lời 404.
  if (found.length !== unique.length) throw new AppError('NOT_FOUND', message);
}

async function assertRefs(
  tx: Prisma.TransactionClient,
  organizationId: string,
  b: Pick<RulePatchBody, 'serviceId' | 'occasionIds' | 'packageIds' | 'subjectIds'>,
): Promise<void> {
  if (b.serviceId !== undefined) {
    const svc = await tx.service.findFirst({
      where: { id: b.serviceId, organizationId },
      select: { name: true, kind: true, isActive: true },
    });
    if (!svc) throw new AppError('NOT_FOUND', 'Không tìm thấy dịch vụ');
    if (svc.kind !== 'SURCHARGE') {
      throw new AppError('VALIDATION_FAILED', `Dịch vụ "${svc.name}" là ${KIND_LABEL[svc.kind] ?? svc.kind} — luật chỉ nhận phụ phí`, {
        fields: ['serviceId'],
      });
    }
    if (!svc.isActive) {
      throw new AppError('VALIDATION_FAILED', `Phụ phí "${svc.name}" đang ngừng hoạt động`, { fields: ['serviceId'] });
    }
  }
  // Loại sự kiện đang ẩn vẫn nhận (luật cũ trỏ về loại đã ẩn không vỡ).
  await assertAllInOrg(
    (ids) => tx.occasion.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true } }),
    b.occasionIds,
    'Không tìm thấy loại sự kiện',
  );
  await assertAllInOrg(
    (ids) => tx.servicePackage.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true } }),
    b.packageIds,
    'Không tìm thấy gói dịch vụ',
  );
  await assertAllInOrg(
    (ids) => tx.makeupSubject.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true } }),
    b.subjectIds,
    'Không tìm thấy nhân vật makeup',
  );
}

async function assertActiveCap(tx: Prisma.TransactionClient, organizationId: string, exceptId: string | null): Promise<void> {
  const active = await tx.surchargeRule.count({
    where: { organizationId, isActive: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  if (active >= MAX_ACTIVE_SURCHARGE_RULES) {
    throw new AppError('CONFLICT', `Tối đa ${MAX_ACTIVE_SURCHARGE_RULES} luật đang bật`);
  }
}

// Xoá rồi ghi lại điều kiện "thuộc tập" / ngày — chỉ nhóm nào có trong thân (không gửi = giữ nguyên).
async function writeConditions(
  tx: Prisma.TransactionClient,
  organizationId: string,
  ruleId: string,
  b: Pick<RulePatchBody, 'dates' | 'occasionIds' | 'packageIds' | 'subjectIds'>,
): Promise<void> {
  const groups = [
    ['occasionId', b.occasionIds],
    ['packageId', b.packageIds],
    ['subjectId', b.subjectIds],
  ] as const;
  for (const [column, ids] of groups) {
    if (ids === undefined) continue;
    await tx.surchargeRuleTarget.deleteMany({ where: { organizationId, ruleId, [column]: { not: null } } });
    if (ids.length > 0) {
      await tx.surchargeRuleTarget.createMany({ data: ids.map((id) => ({ organizationId, ruleId, [column]: id })) });
    }
  }
  if (b.dates !== undefined) {
    await tx.surchargeRuleDate.deleteMany({ where: { organizationId, ruleId } });
    if (b.dates.length > 0) {
      await tx.surchargeRuleDate.createMany({ data: b.dates.map((d) => ({ organizationId, ruleId, day: dateFromWire(d) })) });
    }
  }
}

const minuteOf = (t: string | null | undefined): number | null => (t === null || t === undefined ? null : timeToMinutes(t));

const DUPLICATE_NAME = 'Tên luật đã có trong tổ chức';

export const surchargeRuleRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/surcharge-rules',
    scope: 'org',
    permission: 'catalog.read',
    tag: 'Bảng giá',
    summary: 'Danh sách luật phụ phí kèm phụ phí, giá hiện hành, tình trạng và số dòng đang dùng',
    query: z.object({ isActive: BoolQuery.optional() }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const rows = await deps.db.surchargeRule.findMany({
        where: { organizationId: o.id, ...(query.isActive !== undefined ? { isActive: query.isActive } : {}) },
        orderBy: ORDER,
        include: ruleInclude,
      });
      return { body: { items: await present(deps.db, o.id, rows) } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/surcharge-rules',
    idempotent: true,
    scope: 'org',
    permission: 'prices.write',
    tag: 'Bảng giá',
    summary: 'Thêm luật phụ phí (khớp thì hợp đồng tự thêm dòng phụ phí)',
    body: RuleCreate,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const view = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          // Khoá tổ chức: hai lần bật luật cùng lúc không vượt trần.
          await lockOrg(tx, o.id);
          await assertRefs(tx, o.id, body);
          if (body.isActive !== false) await assertActiveCap(tx, o.id, null);
          const b: RuleCreateBody = body;
          const row = await tx.surchargeRule.create({
            data: {
              organizationId: o.id,
              name: b.name,
              serviceId: b.serviceId,
              startMinute: minuteOf(b.startTime),
              endMinute: minuteOf(b.endTime),
              weekdays: b.weekdays,
              perQuantity: b.perQuantity,
              note: b.note,
              sortOrder: b.sortOrder,
              isActive: b.isActive,
              createdById: uid,
            },
            select: { id: true },
          });
          await writeConditions(tx, o.id, row.id, b);
          const after = await loadRule(tx, o.id, row.id);
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: uid,
            action: 'surcharge_rule.created',
            entityType: 'surcharge_rule',
            entityId: row.id,
            data: { before: null, after: snapshot(after) },
            requestId,
          });
          return (await present(tx, o.id, [after]))[0];
        }),
        DUPLICATE_NAME,
      );
      return { status: 201, body: view };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/surcharge-rules/:surchargeRuleId',
    scope: 'org',
    permission: 'prices.write',
    tag: 'Bảng giá',
    summary: 'Sửa / bật / tắt luật phụ phí (mảng gửi lên thay toàn bộ mảng cũ; không đổi hợp đồng đã lưu)',
    params: RuleParams,
    body: RulePatch,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const view = await withUniqueMessage(
        deps.db.$transaction(async (tx) => {
          await lockOrg(tx, o.id);
          const beforeRow = await loadRule(tx, o.id, params.surchargeRuleId);
          const before = snapshot(beforeRow);
          // Ghép bản đang lưu với thân rồi kiểm lại hình dạng (bỏ khung giờ khi không còn điều kiện nào → 400).
          const pick = <K extends keyof RulePatchBody & keyof typeof before>(k: K) => (body[k] !== undefined ? body[k] : before[k]);
          MergedShape.parse({
            startTime: pick('startTime'),
            endTime: pick('endTime'),
            weekdays: pick('weekdays'),
            dates: pick('dates'),
            occasionIds: pick('occasionIds'),
            packageIds: pick('packageIds'),
            subjectIds: pick('subjectIds'),
          });
          await assertRefs(tx, o.id, body);
          if (body.isActive === true) await assertActiveCap(tx, o.id, beforeRow.id);
          const windowSent = body.startTime !== undefined || body.endTime !== undefined;
          await tx.surchargeRule.update({
            where: { id: beforeRow.id },
            data: {
              name: body.name,
              serviceId: body.serviceId,
              ...(windowSent
                ? { startMinute: minuteOf(pick('startTime') as string | null), endMinute: minuteOf(pick('endTime') as string | null) }
                : {}),
              weekdays: body.weekdays,
              perQuantity: body.perQuantity,
              note: body.note,
              sortOrder: body.sortOrder,
              isActive: body.isActive,
            },
          });
          await writeConditions(tx, o.id, beforeRow.id, body);
          const afterRow = await loadRule(tx, o.id, beforeRow.id);
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: uid,
            action: 'surcharge_rule.updated',
            entityType: 'surcharge_rule',
            entityId: beforeRow.id,
            data: { before, after: snapshot(afterRow) },
            requestId,
          });
          return (await present(tx, o.id, [afterRow]))[0];
        }),
        DUPLICATE_NAME,
      );
      return { body: view };
    },
  }),
];
