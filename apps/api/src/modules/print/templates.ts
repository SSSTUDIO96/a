// MẪU IN CỦA STUDIO (bản vẽ G mục 3.3 đường 1–4, 3.4 "Mẫu in"; gói G-M3).
// - Mẫu chỉ quyết định CÁCH TRÌNH BÀY (bố cục, khối bật/tắt, tiêu đề, chữ đầu/cuối). Không có đường xoá: nhật ký in trỏ tới
//   mẫu, nên mẫu chỉ "ngừng dùng".
// - Đổi layout / blocks / title / openingText / closingText ⇒ version + 1 (so sau khi chuẩn hoá: blocks sắp khoá, chữ đã
//   trim). Đổi tên, appliesTo, defaultFor, isActive không tăng; gửi lại đúng giá trị cũ không tăng (PATCH lặp lại idempotent).
//   Trigger print_templates_version_guard của database chặn nếu máy chủ quên tăng.
// - Mỗi loại hợp đồng có ĐÚNG MỘT mẫu mặc định: đặt mặc định thì bỏ cờ của mẫu đang giữ loại đó trong CÙNG transaction,
//   dưới khoá tư vấn print_template_default:{orgId} (lấy TRƯỚC khoá dòng mẫu — cùng thứ tự với contracts/texts.ts).
//   Không bỏ mặc định được (409 DEFAULT_REQUIRED). Lưới cuối: hai chỉ mục một phần print_templates_one_default_service /
//   _course CÙNG khoá organization_id — lỗi 23505 phải đọc CONSTRAINT_NAME mới biết loại nào (Prisma không trả tên chỉ mục,
//   NHAT-KY-QUYET-DINH-THAY 25/10 tối) → setDefaultFlags.
import { Prisma } from '@prisma/client';
import { checkTemplateText, PRINT_VARIABLES, type PrintVariableName } from '@makeup/shared';
import { defineRoute, mustOrg, mustUser, type AnyRoute } from '../../http/route';
import { pgErrorCode } from '../../http/middleware';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import {
  PRINT_KINDS,
  TemplateCreate,
  TemplateListQuery,
  TemplateParams,
  TemplatePatch,
  type PrintKind,
} from './schemas';

type Tx = Prisma.TransactionClient;

const TAG = 'Mẫu in hợp đồng';
export const TEMPLATE_NOT_FOUND = 'Không tìm thấy mẫu in';
export const KIND_LABEL: Record<PrintKind, string> = { SERVICE: 'dịch vụ', COURSE: 'khoá học' };
export const DEFAULT_REQUIRED_MESSAGE = 'Mỗi loại hợp đồng cần một mẫu mặc định — bật mặc định ở mẫu khác';
export const ACADEMY_REQUIRED_MESSAGE = 'Tổ chức chưa bật đào tạo — mẫu in chỉ dùng cho hợp đồng dịch vụ';

// Hai chỉ mục một phần "mỗi tổ chức một mặc định" (migration 20261019220000) → loại hợp đồng.
const DEFAULT_INDEX_KIND: Record<string, PrintKind> = {
  print_templates_one_default_service: 'SERVICE',
  print_templates_one_default_course: 'COURSE',
};

export const templateSelect = {
  id: true,
  name: true,
  layout: true,
  forService: true,
  forCourse: true,
  defaultService: true,
  defaultCourse: true,
  blocks: true,
  title: true,
  openingText: true,
  closingText: true,
  version: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PrintTemplateSelect;

export type TemplateRow = Prisma.PrintTemplateGetPayload<{ select: typeof templateSelect }>;

export interface TemplateUsage {
  printedContracts: number;
  lastPrintedAt: string | null;
}

export function kindsOf(t: { forService: boolean; forCourse: boolean }): PrintKind[] {
  return PRINT_KINDS.filter((k) => (k === 'SERVICE' ? t.forService : t.forCourse));
}

export function defaultsOf(t: { defaultService: boolean; defaultCourse: boolean }): PrintKind[] {
  return PRINT_KINDS.filter((k) => (k === 'SERVICE' ? t.defaultService : t.defaultCourse));
}

// blocks đã lưu (jsonb) → bản sắp khoá. Database chỉ nhận object có giá trị boolean (print_templates_blocks_shape); dữ liệu
// hỏng thì ném lỗi chứ không trả bừa.
function storedBlocks(raw: Prisma.JsonValue): Record<string, boolean> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('print_templates.blocks không phải object — dữ liệu hỏng');
  return sortBlocks(raw as Record<string, unknown>);
}

function sortBlocks(b: Record<string, unknown>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of Object.keys(b).sort()) {
    const v = b[k];
    if (typeof v !== 'boolean') throw new Error(`blocks["${k}"] không phải true/false — dữ liệu hỏng`);
    out[k] = v;
  }
  return out;
}

export function presentTemplate(t: TemplateRow, usage: TemplateUsage | undefined) {
  return {
    id: t.id,
    name: t.name,
    layout: t.layout,
    appliesTo: kindsOf(t),
    defaultFor: defaultsOf(t),
    blocks: storedBlocks(t.blocks),
    title: t.title,
    openingText: t.openingText,
    closingText: t.closingText,
    version: t.version,
    isActive: t.isActive,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    updatedBy: t.updatedBy,
    usage: usage ?? { printedContracts: 0, lastPrintedAt: null },
  };
}
export type PrintTemplateView = ReturnType<typeof presentTemplate>;

// Số hợp đồng đã in + lần in gần nhất của từng mẫu: MỘT câu GROUP BY template_id (index (organization_id, template_id)).
export async function loadUsage(db: Tx, orgId: string, templateId?: string): Promise<Map<string, TemplateUsage>> {
  const rows = await db.$queryRaw<{ template_id: string; n: number; last: Date | null }[]>`
    SELECT template_id::text AS template_id, COUNT(DISTINCT contract_id)::int AS n, MAX(printed_at) AS last
    FROM contract_prints
    WHERE organization_id = ${orgId}::uuid
      ${templateId ? Prisma.sql`AND template_id = ${templateId}::uuid` : Prisma.empty}
    GROUP BY template_id`;
  return new Map(rows.map((r) => [r.template_id, { printedContracts: r.n, lastPrintedAt: r.last ? r.last.toISOString() : null }]));
}

// Khoá tư vấn "mặc định mẫu in" của cả tổ chức — mọi lệnh đụng cờ mặc định (tạo, sửa, cài mẫu có sẵn) xếp hàng ở đây.
export async function lockPrintDefaults(tx: Tx, orgId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`print_template_default:${orgId}`}))::text`;
}

// Bỏ cờ mặc định các loại `kinds` của mọi mẫu KHÁC trong tổ chức. Trả id các mẫu bị bỏ (ghi nhật ký).
async function clearOtherDefaults(tx: Tx, orgId: string, kinds: PrintKind[], keepId: string): Promise<string[]> {
  const unset = new Set<string>();
  for (const k of kinds) {
    const flag = k === 'SERVICE' ? { defaultService: true } : { defaultCourse: true };
    const others = await tx.printTemplate.findMany({ where: { organizationId: orgId, id: { not: keepId }, ...flag }, select: { id: true } });
    if (others.length === 0) continue;
    await tx.printTemplate.updateMany({
      where: { organizationId: orgId, id: { in: others.map((o) => o.id) } },
      data: k === 'SERVICE' ? { defaultService: false } : { defaultCourse: false },
    });
    for (const o of others) unset.add(o.id);
  }
  return [...unset].sort();
}

// BẬT cờ mặc định `kinds` cho mẫu `templateId` (giữ cờ đang có). Chạy trong khối DO để lấy CONSTRAINT_NAME khi trùng
// mặc định (23505): hai chỉ mục một phần cùng khoá organization_id, Prisma chỉ trả "Key (organization_id)=(…)". Tên chỉ mục
// được ném lại trong DETAIL — Prisma 6.19 đưa DETAIL của lỗi 23505 vào meta.message (đo thật). Tham số truyền qua
// set_config(…, true) (chỉ sống trong transaction) vì khối DO không nhận tham số.
export async function setDefaultFlags(tx: Tx, orgId: string, templateId: string, kinds: PrintKind[]): Promise<void> {
  if (kinds.length === 0) throw new Error('setDefaultFlags: phải có ít nhất một loại hợp đồng');
  await tx.$queryRaw`SELECT set_config('makeup.mau_in_id', ${templateId}, true), set_config('makeup.mau_in_org', ${orgId}, true),
    set_config('makeup.mau_in_dv', ${String(kinds.includes('SERVICE'))}, true), set_config('makeup.mau_in_kh', ${String(kinds.includes('COURSE'))}, true)`;
  try {
    await tx.$executeRawUnsafe(`DO $mau_in$ DECLARE c text; BEGIN
      UPDATE print_templates
         SET default_service = default_service OR current_setting('makeup.mau_in_dv')::boolean,
             default_course  = default_course  OR current_setting('makeup.mau_in_kh')::boolean
       WHERE id = current_setting('makeup.mau_in_id')::uuid AND organization_id = current_setting('makeup.mau_in_org')::uuid;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS c = CONSTRAINT_NAME;
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'mau_in_mac_dinh_trung', DETAIL = c;
    END $mau_in$`);
  } catch (err) {
    throw defaultConflict(err) ?? err;
  }
}

// Lỗi 23505 của hai chỉ mục mặc định → 409 tiếng Việt nói đúng loại hợp đồng. Lỗi khác → null (để nguyên).
export function defaultConflict(err: unknown): AppError | null {
  if (pgErrorCode(err) !== '23505') return null;
  const meta = (err as { meta?: { message?: unknown } }).meta;
  const name = String(meta?.message ?? '');
  const kind: PrintKind | undefined = meta ? 'SERVICE' : undefined;
  if (!kind) return null;
  return new AppError(
    'CONFLICT',
    `Hợp đồng ${KIND_LABEL[kind]} vừa có mẫu in mặc định khác — tải lại danh sách mẫu rồi thử lại`,
    { reason: 'DEFAULT_TAKEN', kind },
  );
}

const usableVariables = (kinds: PrintKind[]) =>
  (Object.keys(PRINT_VARIABLES) as PrintVariableName[]).filter((v) => kinds.every((k) => (PRINT_VARIABLES[v] as readonly string[]).includes(k)));

// Ba ô chữ: biến lạ / biến sai loại → 400 chỉ đúng ô (fields), lời nói đúng biến.
const TEXT_FIELDS = ['title', 'openingText', 'closingText'] as const;
type TextField = (typeof TEXT_FIELDS)[number];

function assertTexts(values: Record<TextField, string | null>, kinds: PrintKind[]): void {
  const bad: { field: TextField; message: string }[] = [];
  for (const field of TEXT_FIELDS) {
    const text = values[field];
    if (text === null) continue;
    const r = checkTemplateText(text, kinds);
    if (r.unknown.length > 0) {
      const list = usableVariables(kinds).map((v) => `{${v}}`).join(', ');
      bad.push({ field, message: `Không có biến ${r.unknown.map((v) => `{${v}}`).join(', ')}. Biến dùng được: ${list}` });
    } else if (r.wrongKind.length > 0) {
      const w = r.wrongKind[0]!;
      const only = w.onlyFor.map((k) => KIND_LABEL[k]).join(', ');
      const missing = kinds.filter((k) => !w.onlyFor.includes(k)).map((k) => KIND_LABEL[k]).join(', ');
      bad.push({ field, message: `Biến {${w.name}} chỉ dùng cho hợp đồng ${only} — mẫu này dùng cho cả hợp đồng ${missing}` });
    }
  }
  if (bad.length > 0) {
    throw new AppError('VALIDATION_FAILED', bad[0]!.message, {
      fields: bad.map((b) => b.field),
      fieldErrors: Object.fromEntries(bad.map((b) => [b.field, [b.message]])),
    });
  }
}

async function assertKindsAllowed(tx: Tx, orgId: string, kinds: PrintKind[]): Promise<void> {
  if (!kinds.includes('COURSE')) return;
  const o = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { kind: true } });
  if (o.kind !== 'ACADEMY') throw new AppError('VALIDATION_FAILED', ACADEMY_REQUIRED_MESSAGE, { fields: ['appliesTo'] });
}

function assertDefaultsWithin(defaults: PrintKind[], kinds: PrintKind[]): void {
  const outside = defaults.filter((k) => !kinds.includes(k));
  if (outside.length > 0) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Mẫu không dùng cho hợp đồng ${outside.map((k) => KIND_LABEL[k]).join(', ')} nên không làm mặc định cho loại đó được`,
      { fields: ['defaultFor'] },
    );
  }
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function auditSnapshot(t: TemplateRow) {
  return {
    name: t.name,
    layout: t.layout,
    appliesTo: kindsOf(t),
    defaultFor: defaultsOf(t),
    blocks: storedBlocks(t.blocks),
    title: t.title,
    openingText: t.openingText,
    closingText: t.closingText,
    version: t.version,
    isActive: t.isActive,
  };
}

async function readOne(db: Tx, orgId: string, id: string) {
  const row = await db.printTemplate.findFirst({ where: { id, organizationId: orgId }, select: templateSelect });
  if (!row) throw new AppError('NOT_FOUND', TEMPLATE_NOT_FOUND);
  return row;
}

export const templateRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/print-templates',
    scope: 'org',
    permission: 'contracts.read',
    tag: TAG,
    summary: 'Danh sách mẫu in (lọc loại hợp đồng; mặc định chỉ mẫu đang dùng). Mẫu mặc định đứng đầu, rồi theo tên; kèm số lần dùng',
    query: TemplateListQuery,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const rows = await deps.db.printTemplate.findMany({
        where: {
          organizationId: o.id,
          ...(query.appliesTo === 'SERVICE' ? { forService: true } : query.appliesTo === 'COURSE' ? { forCourse: true } : {}),
          ...(query.includeInactive === 'true' ? {} : { isActive: true }),
        },
        select: templateSelect,
        orderBy:
          query.appliesTo === 'COURSE'
            ? [{ defaultCourse: 'desc' }, { name: 'asc' }, { id: 'asc' }]
            : [{ defaultService: 'desc' }, { defaultCourse: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      });
      const usage = await loadUsage(deps.db, o.id);
      return { body: { items: rows.map((r) => presentTemplate(r, usage.get(r.id))) } };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/print-templates/:templateId',
    scope: 'org',
    permission: 'contracts.read',
    tag: TAG,
    summary: 'Một mẫu in',
    params: TemplateParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      const row = await readOne(deps.db, o.id, params.templateId);
      const usage = await loadUsage(deps.db, o.id, row.id);
      return { body: presentTemplate(row, usage.get(row.id)) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/print-templates',
    scope: 'org',
    permission: 'contracts.texts',
    idempotent: true,
    tag: TAG,
    summary: 'Tạo mẫu in (đặt mặc định thì bỏ cờ mặc định của mẫu đang giữ loại đó)',
    body: TemplateCreate,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const defaultFor = body.defaultFor ?? [];
      assertDefaultsWithin(defaultFor, body.appliesTo);
      assertTexts({ title: body.title ?? null, openingText: body.openingText ?? null, closingText: body.closingText ?? null }, body.appliesTo);
      const row = await deps.db.$transaction(async (tx) => {
        await assertKindsAllowed(tx, o.id, body.appliesTo);
        if (defaultFor.length > 0) await lockPrintDefaults(tx, o.id);
        const created = await tx.printTemplate.create({
          data: {
            organizationId: o.id,
            name: body.name,
            layout: body.layout,
            forService: body.appliesTo.includes('SERVICE'),
            forCourse: body.appliesTo.includes('COURSE'),
            blocks: sortBlocks(body.blocks ?? {}),
            title: body.title ?? null,
            openingText: body.openingText ?? null,
            closingText: body.closingText ?? null,
            updatedById: uid,
          },
          select: { id: true },
        });
        let unset: string[] = [];
        if (defaultFor.length > 0) {
          unset = await clearOtherDefaults(tx, o.id, defaultFor, created.id);
          await setDefaultFlags(tx, o.id, created.id, defaultFor);
        }
        const t = await readOne(tx, o.id, created.id);
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'print_template.created',
          entityType: 'print_template',
          entityId: t.id,
          data: { before: null, after: auditSnapshot(t), versionBumped: false, unsetDefaultIds: unset },
          requestId,
        });
        return t;
      });
      return { status: 201, body: presentTemplate(row, undefined) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/print-templates/:templateId',
    scope: 'org',
    permission: 'contracts.texts',
    tag: TAG,
    summary: 'Sửa mẫu in một phần: đổi bố cục / khối / tiêu đề / chữ đầu, cuối thì phiên bản + 1; không bỏ được mặc định',
    params: TemplateParams,
    body: TemplatePatch,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const result = await deps.db.$transaction(async (tx) => {
        // THỨ TỰ KHOÁ: khoá tư vấn "mặc định" TRƯỚC, khoá dòng mẫu SAU (giống lệnh tạo) — ngược lại hai lệnh đặt mặc định
        // cho hai mẫu cùng lúc khoá chéo nhau (mỗi bên giữ dòng mình, chờ dòng bên kia khi bỏ cờ cũ).
        await lockPrintDefaults(tx, o.id);
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM print_templates WHERE id = ${params.templateId}::uuid AND organization_id = ${o.id}::uuid FOR UPDATE`;
        if (locked.length === 0) throw new AppError('NOT_FOUND', TEMPLATE_NOT_FOUND);
        const before = await readOne(tx, o.id, params.templateId);
        const curKinds = kindsOf(before);
        const curDefaults = defaultsOf(before);

        // Không bỏ mặc định được — kiểm TRƯỚC các luật khác (bỏ loại đang là mặc định khỏi appliesTo phải ra 409 này).
        const dropped =
          (body.defaultFor !== undefined && curDefaults.some((k) => !body.defaultFor!.includes(k))) ||
          (body.isActive === false && curDefaults.length > 0) ||
          (body.appliesTo !== undefined && curDefaults.some((k) => !body.appliesTo!.includes(k)));
        if (dropped) throw new AppError('CONFLICT', DEFAULT_REQUIRED_MESSAGE, { reason: 'DEFAULT_REQUIRED' });

        const nextKinds = body.appliesTo ?? curKinds;
        const nextDefaults = body.defaultFor ?? curDefaults;
        if (body.appliesTo !== undefined) await assertKindsAllowed(tx, o.id, nextKinds);
        assertDefaultsWithin(nextDefaults, nextKinds);
        const added = nextDefaults.filter((k) => !curDefaults.includes(k));
        const nextActive = body.isActive ?? before.isActive;
        if (added.length > 0 && !nextActive) {
          throw new AppError(
            'VALIDATION_FAILED',
            body.isActive === false
              ? 'Mẫu mặc định phải đang dùng — không đặt mặc định và ngừng dùng cùng lúc'
              : 'Mẫu đang ngừng dùng không đặt làm mặc định được — bật lại mẫu trước',
            { fields: ['defaultFor'] },
          );
        }
        const next = {
          layout: body.layout ?? before.layout,
          blocks: body.blocks !== undefined ? sortBlocks(body.blocks) : storedBlocks(before.blocks),
          title: body.title !== undefined ? body.title : before.title,
          openingText: body.openingText !== undefined ? body.openingText : before.openingText,
          closingText: body.closingText !== undefined ? body.closingText : before.closingText,
        };
        assertTexts(next, nextKinds);
        const versionBumped =
          next.layout !== before.layout ||
          !sameJson(next.blocks, storedBlocks(before.blocks)) ||
          next.title !== before.title ||
          next.openingText !== before.openingText ||
          next.closingText !== before.closingText;

        let unset: string[] = [];
        if (added.length > 0) unset = await clearOtherDefaults(tx, o.id, added, before.id);
        await tx.printTemplate.update({
          where: { id: before.id },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.appliesTo !== undefined ? { forService: nextKinds.includes('SERVICE'), forCourse: nextKinds.includes('COURSE') } : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
            ...(versionBumped ? { ...next, version: { increment: 1 } } : {}),
            updatedById: uid,
          },
        });
        if (added.length > 0) await setDefaultFlags(tx, o.id, before.id, added);
        const after = await readOne(tx, o.id, before.id);
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'print_template.updated',
          entityType: 'print_template',
          entityId: after.id,
          data: { before: auditSnapshot(before), after: auditSnapshot(after), versionBumped, unsetDefaultIds: unset },
          requestId,
        });
        return after;
      });
      const usage = await loadUsage(deps.db, o.id, result.id);
      return { body: presentTemplate(result, usage.get(result.id)) };
    },
  }),
];
