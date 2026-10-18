// MẪU ĐIỀU KHOẢN / NỘI QUY (BAN-VE-C3-DAO-TAO mục 1.1 ContractText, 1.3; gói M5).
// - Sửa nội dung (body) → version + 1. Hợp đồng đã xác nhận giữ BẢN CHỤP (terms / rules + id + version) nên không đổi.
// - Mỗi (tổ chức, loại) tối đa một mẫu mặc định: đặt mặc định thì bỏ mặc định cũ trong CÙNG transaction, dưới khoá tư vấn
//   theo (tổ chức, loại) — hai lệnh đặt mặc định cùng lúc xếp hàng thay vì đụng index một phần contract_texts_one_default.
import { z } from 'zod';
import type { ContractKind, ContractText, ContractTextKind, Prisma } from '@prisma/client';
import { defineRoute, mustOrg, mustUser, type AnyRoute } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { CONTRACT_KINDS, OrgParams, type ContractKindKey } from './schemas';

type Tx = Prisma.TransactionClient;

const TAG = 'Mẫu điều khoản';
const TEXT_KINDS = ['TERMS', 'RULES'] as const;
const KIND_LABEL: Record<ContractTextKind, string> = { TERMS: 'điều khoản', RULES: 'nội quy' };

function strict<S extends z.ZodRawShape>(shape: S) {
  return z.strictObject(shape, {
    error: (iss) => (iss.code === 'unrecognized_keys' ? `Không nhận trường: ${iss.keys.join(', ')}` : undefined),
  });
}

const Name = z.string().trim().min(1, 'Tên mẫu không được để trống').max(200);
const Body = z.string().trim().min(1, 'Nội dung mẫu không được để trống').max(20_000, 'Nội dung mẫu tối đa 20000 ký tự');
// Rỗng = dùng cho cả hai loại hợp đồng.
const AppliesTo = z
  .array(z.enum(CONTRACT_KINDS))
  .max(2)
  .refine((a) => new Set(a).size === a.length, 'Loại hợp đồng áp dụng bị trùng');

export const TextCreateSchema = strict({
  kind: z.enum(TEXT_KINDS),
  appliesTo: AppliesTo,
  name: Name,
  body: Body,
  isDefault: z.boolean().optional(),
});

// Không có .default(): PATCH chỉ đổi đúng trường gửi lên (sổ lỗi: zod điền mặc định cho trường vắng mặt).
export const TextPatchSchema = strict({
  name: Name.optional(),
  body: Body.optional(),
  appliesTo: AppliesTo.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Không có gì để sửa')
  .refine((b) => !(b.isDefault === true && b.isActive === false), {
    message: 'Mẫu mặc định phải đang dùng — không đặt mặc định và ngừng dùng cùng lúc',
    path: ['isDefault'],
  });

const TextListQuery = z.object({
  kind: z.enum(TEXT_KINDS).optional(),
  // Lọc mẫu dùng được cho loại hợp đồng này (gồm cả mẫu áp dụng cho cả hai loại).
  appliesTo: z.enum(CONTRACT_KINDS).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

const TextParams = OrgParams.extend({ textId: z.uuid() });

const textSelect = {
  id: true,
  kind: true,
  appliesTo: true,
  name: true,
  body: true,
  version: true,
  isDefault: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ContractTextSelect;

type TextRow = Prisma.ContractTextGetPayload<{ select: typeof textSelect }>;

function present(t: TextRow) {
  return t;
}

const appliesFilter = (kind: ContractKindKey) => ({ OR: [{ appliesTo: { isEmpty: true } }, { appliesTo: { has: kind as ContractKind } }] });

async function lockDefaultSlot(tx: Tx, orgId: string, kind: ContractTextKind) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`contract_text_default:${orgId}:${kind}`}))::text`;
}

// Bỏ mặc định của các mẫu KHÁC cùng (tổ chức, loại). Trả id các mẫu bị bỏ để ghi nhật ký.
async function clearOtherDefaults(tx: Tx, orgId: string, kind: ContractTextKind, keepId: string | null): Promise<string[]> {
  const others = await tx.contractText.findMany({
    where: { organizationId: orgId, kind, isDefault: true, ...(keepId ? { id: { not: keepId } } : {}) },
    select: { id: true },
  });
  if (others.length > 0) {
    await tx.contractText.updateMany({ where: { id: { in: others.map((o) => o.id) }, organizationId: orgId }, data: { isDefault: false } });
  }
  return others.map((o) => o.id);
}

// ---------- Dùng cho module hợp đồng ----------

export interface ChosenText {
  id: string;
  version: number;
}

// Kiểm mẫu chọn cho hợp đồng: thuộc tổ chức (mã của tổ chức khác trả đúng lời như mã bịa), đúng loại, áp dụng cho loại
// hợp đồng, đang dùng.
export async function checkChosenText(
  db: Tx,
  orgId: string,
  textId: string,
  expected: ContractTextKind,
  contractKind: ContractKindKey,
): Promise<ChosenText> {
  const t = await db.contractText.findFirst({
    where: { id: textId, organizationId: orgId },
    select: { id: true, kind: true, name: true, appliesTo: true, isActive: true, version: true },
  });
  if (!t) throw new AppError('NOT_FOUND', `Không tìm thấy mẫu ${KIND_LABEL[expected]}`);
  if (t.kind !== expected) {
    throw new AppError('VALIDATION_FAILED', `Mẫu "${t.name}" là mẫu ${KIND_LABEL[t.kind]}, chỗ này cần mẫu ${KIND_LABEL[expected]}`);
  }
  if (expected === 'RULES' && contractKind !== 'COURSE') {
    throw new AppError('VALIDATION_FAILED', 'Nội quy chỉ dùng cho hợp đồng khoá học');
  }
  if (t.appliesTo.length > 0 && !t.appliesTo.includes(contractKind as ContractKind)) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Mẫu "${t.name}" chỉ dùng cho hợp đồng ${contractKind === 'COURSE' ? 'dịch vụ' : 'khoá học'}`,
    );
  }
  if (!t.isActive) throw new AppError('VALIDATION_FAILED', `Mẫu "${t.name}" đang ngừng dùng`);
  return { id: t.id, version: t.version };
}

export interface TextSnapshot {
  terms?: string;
  termsTemplateId?: string;
  termsTemplateVersion?: number;
  rules?: string;
  rulesTemplateId?: string;
  rulesTemplateVersion?: number;
}

// CHỤP lúc xác nhận (trong transaction xác nhận, khi hợp đồng còn là nháp):
// - Điều khoản: mẫu đã chọn (bản mới nhất); không chọn mẫu và không tự nhập → mẫu mặc định dùng được cho loại hợp đồng.
//   Đã tự nhập điều khoản (không chọn mẫu) → giữ nguyên lời tự nhập.
// - Nội quy (chỉ hợp đồng khoá học): mẫu đã chọn, không thì mẫu mặc định.
// Nội dung + id + phiên bản đọc từ CÙNG một dòng nên luôn khớp nhau. Sau đó trigger contracts_lock_after_confirm cấm đổi.
export async function snapshotTexts(
  tx: Tx,
  orgId: string,
  c: { kind: ContractKindKey; terms: string | null; termsTemplateId: string | null; rulesTemplateId: string | null },
): Promise<TextSnapshot> {
  const pick = async (kind: ContractTextKind, chosenId: string | null): Promise<ContractText | null> =>
    chosenId
      ? tx.contractText.findFirst({ where: { id: chosenId, organizationId: orgId } })
      : tx.contractText.findFirst({ where: { organizationId: orgId, kind, isDefault: true, isActive: true, ...appliesFilter(c.kind) } });
  const out: TextSnapshot = {};
  if (c.termsTemplateId || c.terms === null || c.terms.trim() === '') {
    const t = await pick('TERMS', c.termsTemplateId);
    if (t) Object.assign(out, { terms: t.body, termsTemplateId: t.id, termsTemplateVersion: t.version });
  }
  if (c.kind === 'COURSE') {
    const r = await pick('RULES', c.rulesTemplateId);
    if (r) Object.assign(out, { rules: r.body, rulesTemplateId: r.id, rulesTemplateVersion: r.version });
  }
  return out;
}

// ---------- Đường API ----------

export const contractTextRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/contract-texts',
    scope: 'org',
    permission: 'contracts.read',
    tag: TAG,
    summary: 'Danh sách mẫu điều khoản / nội quy (lọc loại mẫu, loại hợp đồng áp dụng; mặc định chỉ mẫu đang dùng)',
    query: TextListQuery,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const rows = await deps.db.contractText.findMany({
        where: {
          organizationId: o.id,
          ...(query.kind ? { kind: query.kind } : {}),
          ...(query.appliesTo ? appliesFilter(query.appliesTo) : {}),
          ...(query.includeInactive === 'true' ? {} : { isActive: true }),
        },
        select: textSelect,
        orderBy: [{ kind: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      });
      return { body: rows.map(present) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/contract-texts',
    scope: 'org',
    permission: 'contracts.texts',
    idempotent: true,
    tag: TAG,
    summary: 'Thêm mẫu điều khoản / nội quy (đặt mặc định thì bỏ mặc định cũ cùng loại)',
    body: TextCreateSchema,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const row = await deps.db.$transaction(async (tx) => {
        let unset: string[] = [];
        if (body.isDefault) {
          await lockDefaultSlot(tx, o.id, body.kind);
          unset = await clearOtherDefaults(tx, o.id, body.kind, null);
        }
        const t = await tx.contractText.create({
          data: {
            organizationId: o.id,
            kind: body.kind,
            appliesTo: body.appliesTo,
            name: body.name,
            body: body.body,
            isDefault: body.isDefault ?? false,
            updatedById: uid,
          },
          select: textSelect,
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'contract_text.created',
          entityType: 'contract_text',
          entityId: t.id,
          data: { kind: t.kind, name: t.name, appliesTo: t.appliesTo, isDefault: t.isDefault, version: t.version, unsetDefaultIds: unset },
          requestId,
        });
        return t;
      });
      return { status: 201, body: present(row) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/contract-texts/:textId',
    scope: 'org',
    permission: 'contracts.texts',
    tag: TAG,
    summary: 'Sửa mẫu: đổi nội dung thì phiên bản + 1 (hợp đồng đã xác nhận giữ bản chụp, không đổi)',
    params: TextParams,
    body: TextPatchSchema,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const row = await deps.db.$transaction(async (tx) => {
        // THỨ TỰ KHOÁ: khoá tư vấn "mặc định" TRƯỚC, khoá dòng mẫu SAU — giống lệnh thêm mẫu. Ngược lại thì hai lệnh đặt
        // mặc định cho hai mẫu cùng lúc khoá chéo nhau (mỗi bên giữ dòng mình, chờ dòng bên kia khi bỏ mặc định cũ).
        // Loại mẫu (kind) không đổi được nên đọc trước khi khoá là an toàn.
        if (body.isDefault === true) {
          const head = await tx.contractText.findFirst({ where: { id: params.textId, organizationId: o.id }, select: { kind: true } });
          if (!head) throw new AppError('NOT_FOUND', 'Không tìm thấy mẫu điều khoản / nội quy');
          await lockDefaultSlot(tx, o.id, head.kind);
        }
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM contract_texts WHERE id = ${params.textId}::uuid AND organization_id = ${o.id}::uuid FOR UPDATE`;
        if (locked.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy mẫu điều khoản / nội quy');
        const before = await tx.contractText.findUniqueOrThrow({ where: { id: params.textId } });
        if (body.isDefault === true && !(body.isActive ?? before.isActive)) {
          throw new AppError('VALIDATION_FAILED', 'Mẫu đang ngừng dùng không đặt làm mặc định được — bật lại mẫu trước', { fields: ['isDefault'] });
        }
        const bodyChanged = body.body !== undefined && body.body !== before.body;
        let unset: string[] = [];
        if (body.isDefault === true) unset = await clearOtherDefaults(tx, o.id, before.kind, before.id);
        // Ngừng dùng một mẫu mặc định → mẫu đó thôi là mặc định (mẫu mặc định phải đang dùng).
        const isDefault = body.isDefault ?? (body.isActive === false ? false : undefined);
        const t = await tx.contractText.update({
          where: { id: before.id },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(bodyChanged ? { body: body.body, version: { increment: 1 } } : {}),
            ...(body.appliesTo !== undefined ? { appliesTo: body.appliesTo } : {}),
            ...(isDefault !== undefined ? { isDefault } : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
            updatedById: uid,
          },
          select: textSelect,
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'contract_text.updated',
          entityType: 'contract_text',
          entityId: t.id,
          data: {
            before: { name: before.name, appliesTo: before.appliesTo, version: before.version, isDefault: before.isDefault, isActive: before.isActive },
            after: { name: t.name, appliesTo: t.appliesTo, version: t.version, isDefault: t.isDefault, isActive: t.isActive },
            bodyChanged,
            unsetDefaultIds: unset,
          },
          requestId,
        });
        return t;
      });
      return { body: present(row) };
    },
  }),
];
