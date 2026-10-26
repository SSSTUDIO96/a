// DỮ LIỆU IN + NHẬT KÝ IN (bản vẽ G mục 3.3 đường 5–7, 3.4 "Ghi nhật ký in", 3.5; gói G-M4).
// - Đường 5 GET …/print-data: MỘT đường trả đủ dữ liệu in đã tính sẵn (đọc trong một transaction chỉ đọc, ảnh chụp nhất quán).
// - Đường 6 GET …/prints/:printId: bản chụp của một lần in (cấu hình + dữ liệu đã che THÊM theo người xem).
// - Đường 7 POST …/prints: ghi nhật ký NGAY TRƯỚC khi mở hộp in của trình duyệt. Chỉ thêm (trigger contract_prints_append_only).
//   Dưới khoá tư vấn theo hợp đồng: printNo = MAX + 1 không trùng, không hở. Mã băm dữ liệu khác expectedDataHash → 409
//   DATA_CHANGED, KHÔNG ghi gì. Hợp đồng đã in giữ đúng mẫu + phiên bản: PRIOR_CONFIG / REPRINT lấy cấu hình đã CHỤP ở lần
//   in gốc (sửa mẫu sau đó không ảnh hưởng); REPRINT lấy cả dữ liệu đã chụp (che thêm theo người in).
// - Mọi câu lọc organizationId. Mã của tổ chức khác → 404 giống hệt mã bịa (hợp đồng / mẫu / lần in — sổ lỗi 12).
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  blockAppliesTo,
  isPrintLayout,
  isToggleBlockKey,
  PRINT_BLOCK_KEYS,
  PRINT_DATA_VERSION,
  resolvePrintConfig,
  type PrintBlockKey,
  type PrintBlockOverrides,
  type ResolvedPrintConfig,
} from '@makeup/shared';
import { defineRoute, mustOrg, mustUser, type AnyRoute } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { signImages } from '../profile/images';
import {
  buildPrintData,
  CONTRACT_NOT_FOUND,
  dataWarnings,
  hashPrintData,
  logoGoneWarning,
  maskPrintData,
  noProfileWarning,
  storedPrintData,
  type PrintViewer,
} from './data';
import { PrintCreate, type PrintKind } from './schemas';
import { KIND_LABEL, kindsOf, loadUsage, presentTemplate, TEMPLATE_NOT_FOUND, templateSelect } from './templates';

type Tx = Prisma.TransactionClient;

const TAG = 'In hợp đồng';
export const PRINT_NOT_FOUND = 'Không tìm thấy lần in';
const READ_TX = { isolationLevel: 'RepeatableRead' as const, timeout: 15_000 };
// Mười lần in cùng lúc một hợp đồng xếp hàng ở khoá tư vấn — chờ kết nối / chờ khoá đủ lâu.
const WRITE_TX = { maxWait: 20_000, timeout: 30_000 };

const ContractParams = z.object({ orgId: z.uuid(), contractId: z.uuid() });
const PrintParams = ContractParams.extend({ printId: z.uuid() });

// ---------- Trình bày ----------

const printSelect = {
  id: true,
  printNo: true,
  source: true,
  basedOnPrintId: true,
  printedAt: true,
  templateId: true,
  templateVersion: true,
  config: true,
  data: true,
  dataVersion: true,
  dataHash: true,
  contractStatus: true,
  printedBy: { select: { id: true, fullName: true } },
  template: { select: { name: true } },
} satisfies Prisma.ContractPrintSelect;

type PrintRow = Prisma.ContractPrintGetPayload<{ select: typeof printSelect }>;

// Cấu hình đã chụp (jsonb) → ResolvedPrintConfig. Máy chủ tự ghi nên hình dạng sai là dữ liệu hỏng → ném lỗi.
function storedConfig(raw: Prisma.JsonValue): ResolvedPrintConfig {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('contract_prints.config không phải object — dữ liệu hỏng');
  const c = raw as Record<string, unknown>;
  const blocks = c.blocks as Record<string, unknown> | null;
  if (!isPrintLayout(c.layout) || !blocks || typeof blocks !== 'object') throw new Error('contract_prints.config thiếu layout / blocks — dữ liệu hỏng');
  for (const k of PRINT_BLOCK_KEYS) if (typeof blocks[k] !== 'boolean') throw new Error(`contract_prints.config.blocks["${k}"] không phải true/false`);
  for (const k of ['templateId', 'templateName', 'title', 'openingText', 'closingText'] as const) {
    if (typeof c[k] !== 'string') throw new Error(`contract_prints.config.${k} không phải chuỗi`);
  }
  if (typeof c.templateVersion !== 'number') throw new Error('contract_prints.config.templateVersion không phải số');
  return raw as unknown as ResolvedPrintConfig;
}

function layoutOf(config: Prisma.JsonValue): number {
  return storedConfig(config).layout;
}

export function presentPrint(p: PrintRow) {
  return {
    id: p.id,
    printNo: p.printNo,
    source: p.source,
    basedOnPrintId: p.basedOnPrintId,
    printedAt: p.printedAt,
    printedBy: p.printedBy,
    templateId: p.templateId,
    // Tên HIỆN TẠI của mẫu (tên đã chụp nằm trong config.templateName).
    templateName: p.template.name,
    templateVersion: p.templateVersion,
    layout: layoutOf(p.config),
    contractStatus: p.contractStatus,
  };
}
export type PrintRecordView = ReturnType<typeof presentPrint>;

// Áp công tắc nhanh lên cấu hình đã chụp (PRIOR_CONFIG): chỉ khối bật/tắt được và thuộc loại hợp đồng; khối khác giữ nguyên.
function applyOverrides(config: ResolvedPrintConfig, kind: PrintKind, overrides: PrintBlockOverrides | undefined): ResolvedPrintConfig {
  if (!overrides) return config;
  const blocks = { ...config.blocks } as Record<PrintBlockKey, boolean>;
  for (const [k, v] of Object.entries(overrides)) {
    if (!isToggleBlockKey(k)) throw new Error(`Công tắc nhanh lạ "${k}" lọt qua khuôn`);
    if (v !== undefined && blockAppliesTo(k, kind)) blocks[k] = v;
  }
  return { ...config, blocks };
}

async function readPrint(db: Tx, orgId: string, contractId: string, printId: string): Promise<PrintRow> {
  const row = await db.contractPrint.findFirst({ where: { id: printId, contractId, organizationId: orgId }, select: printSelect });
  if (!row) throw new AppError('NOT_FOUND', PRINT_NOT_FOUND);
  return row;
}

async function assertContract(db: Tx, orgId: string, contractId: string) {
  const c = await db.contract.findFirst({ where: { id: contractId, organizationId: orgId }, select: { id: true, kind: true, status: true } });
  if (!c) throw new AppError('NOT_FOUND', CONTRACT_NOT_FOUND);
  return c;
}

// ---------- Đường ----------

export const printRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/contracts/:contractId/print-data',
    scope: 'org',
    permission: 'contracts.read',
    tag: TAG,
    summary: 'Dữ liệu in đã tính sẵn (che theo quyền người xem) + mã băm, URL logo, các mẫu dùng được, mẫu mặc định, lần in gần nhất, cảnh báo',
    params: ContractParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      const viewer: PrintViewer = { permissions: o.permissions };
      const out = await deps.db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const built = await buildPrintData(tx, o.id, params.contractId, viewer);
        const kind = built.contract.kind;
        const [templates, usage, last, printCount, sign] = await Promise.all([
          tx.printTemplate.findMany({
            where: { organizationId: o.id, isActive: true, ...(kind === 'SERVICE' ? { forService: true } : { forCourse: true }) },
            select: templateSelect,
            orderBy: kind === 'SERVICE' ? [{ defaultService: 'desc' }, { name: 'asc' }, { id: 'asc' }] : [{ defaultCourse: 'desc' }, { name: 'asc' }, { id: 'asc' }],
          }),
          loadUsage(tx, o.id),
          tx.contractPrint.findFirst({
            where: { contractId: built.contract.id, organizationId: o.id },
            select: printSelect,
            orderBy: { printNo: 'desc' },
          }),
          tx.contractPrint.count({ where: { contractId: built.contract.id, organizationId: o.id } }),
          signImages(tx, o.id, [built.data.studio.logoFileId]),
        ]);
        return { built, templates, usage, last, printCount, logo: sign(built.data.studio.logoFileId) };
      }, READ_TX);
      const { built, templates, usage, last, printCount, logo } = out;
      const dataHash = hashPrintData(built.data);
      const isDefault = (t: (typeof templates)[number]) => (built.contract.kind === 'SERVICE' ? t.defaultService : t.defaultCourse);
      return {
        body: {
          contract: built.contract,
          data: built.data,
          dataHash,
          logoUrl: logo?.url ?? null,
          logoUrlExpiresAt: logo?.expiresAt ?? null,
          templates: templates.map((t) => presentTemplate(t, usage.get(t.id))),
          defaultTemplateId: templates.find(isDefault)?.id ?? null,
          // sameData: dữ liệu lần đó (che theo NGƯỜI XEM HIỆN TẠI) có đúng bằng dữ liệu hiện tại không.
          lastPrint: last
            ? { ...presentPrint(last), sameData: hashPrintData(maskPrintData(storedPrintData(last.data, last.dataVersion), viewer)) === dataHash }
            : null,
          printCount,
          warnings: [...(built.hasProfile ? [] : [noProfileWarning()]), ...dataWarnings(built.data)],
        },
      };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/contracts/:contractId/prints/:printId',
    scope: 'org',
    permission: 'contracts.read',
    tag: TAG,
    summary: 'Bản chụp một lần in (cấu hình + dữ liệu đã in, che thêm theo người xem) — xem trước khi in lại',
    params: PrintParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      const viewer: PrintViewer = { permissions: o.permissions };
      const { row, sign } = await deps.db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await assertContract(tx, o.id, params.contractId);
        const p = await readPrint(tx, o.id, params.contractId, params.printId);
        const logoId = storedPrintData(p.data, p.dataVersion).studio.logoFileId;
        return { row: p, sign: await signImages(tx, o.id, [logoId]) };
      }, READ_TX);
      const data = maskPrintData(storedPrintData(row.data, row.dataVersion), viewer);
      const logo = sign(data.studio.logoFileId);
      return {
        body: {
          print: presentPrint(row),
          config: storedConfig(row.config),
          data,
          dataHash: hashPrintData(data),
          logoUrl: logo?.url ?? null,
          warnings: [...dataWarnings(data), ...(data.studio.logoFileId !== null && logo === null ? [logoGoneWarning()] : [])],
        },
      };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/contracts/:contractId/prints',
    scope: 'org',
    permission: 'contracts.read',
    idempotent: true,
    tag: TAG,
    summary: 'Ghi nhật ký một lần in (theo mẫu / theo cấu hình lần trước / in lại y hệt) ngay trước khi mở hộp in',
    params: ContractParams,
    body: PrintCreate,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const viewer: PrintViewer = { permissions: o.permissions };
      const row = await deps.db.$transaction(async (tx) => {
        // 1. Khoá tư vấn theo hợp đồng: các lần in cùng hợp đồng xếp hàng (printNo không trùng, không hở).
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`contract_print:${params.contractId}`}))::text`;
        // 2. Hợp đồng của CHÍNH tổ chức; đã huỷ thì không in.
        const c = await assertContract(tx, o.id, params.contractId);
        if (c.status === 'CANCELLED') throw new AppError('CONFLICT', 'Hợp đồng đã huỷ — không in', { reason: 'CONTRACT_CANCELLED' });
        const kind: PrintKind = c.kind;

        // 3. Cấu hình + dữ liệu theo nguồn.
        let config: ResolvedPrintConfig;
        let templateId: string;
        let templateVersion: number;
        let basedOnPrintId: string | null = null;
        let data;
        if (body.source === 'TEMPLATE') {
          const t = await tx.printTemplate.findFirst({ where: { id: body.templateId, organizationId: o.id }, select: templateSelect });
          if (!t) throw new AppError('NOT_FOUND', TEMPLATE_NOT_FOUND);
          if (!t.isActive) throw new AppError('VALIDATION_FAILED', `Mẫu in "${t.name}" đang ngừng dùng`, { fields: ['templateId'] });
          const kinds = kindsOf(t);
          if (!kinds.includes(kind)) {
            throw new AppError('VALIDATION_FAILED', `Mẫu "${t.name}" chỉ dùng cho hợp đồng ${kinds.map((k) => KIND_LABEL[k]).join(', ')}`, { fields: ['templateId'] });
          }
          if (t.version !== body.expectedTemplateVersion) {
            throw new AppError('CONFLICT', `Mẫu in vừa được sửa (nay là bản v${t.version}) — xem lại bản in rồi bấm In lần nữa`, {
              reason: 'TEMPLATE_CHANGED',
              templateVersion: t.version,
            });
          }
          config = resolvePrintConfig(t, kind, body.blockOverrides);
          templateId = t.id;
          templateVersion = t.version;
          data = (await buildPrintData(tx, o.id, c.id, viewer)).data;
        } else {
          const base = await readPrint(tx, o.id, c.id, body.basedOnPrintId);
          basedOnPrintId = base.id;
          templateId = base.templateId;
          templateVersion = base.templateVersion;
          if (body.source === 'PRIOR_CONFIG') {
            config = applyOverrides(storedConfig(base.config), kind, body.blockOverrides);
            data = (await buildPrintData(tx, o.id, c.id, viewer)).data;
          } else {
            config = storedConfig(base.config);
            data = maskPrintData(storedPrintData(base.data, base.dataVersion), viewer);
          }
        }

        // 4. Dữ liệu đã đổi so với bản người in đang xem → 409, không ghi gì.
        const dataHash = hashPrintData(data);
        if (dataHash !== body.expectedDataHash) {
          throw new AppError('CONFLICT', 'Hợp đồng vừa thay đổi — đã tải dữ liệu mới, xem lại rồi bấm In lần nữa', { reason: 'DATA_CHANGED' });
        }

        // 5. Lần in thứ mấy (dưới khoá ở bước 1) + chèn + nhật ký.
        const counted = await tx.$queryRaw<{ next: number }[]>`
          SELECT (COALESCE(MAX(print_no), 0) + 1)::int AS next FROM contract_prints
          WHERE contract_id = ${c.id}::uuid AND organization_id = ${o.id}::uuid`;
        const next = counted[0]?.next;
        if (!next) throw new Error('Không cấp được số lần in');
        const created = await tx.contractPrint.create({
          data: {
            organizationId: o.id,
            contractId: c.id,
            printNo: next,
            source: body.source,
            basedOnPrintId,
            templateId,
            templateVersion,
            config: config as unknown as Prisma.InputJsonValue,
            data: data as unknown as Prisma.InputJsonValue,
            dataVersion: PRINT_DATA_VERSION,
            dataHash,
            contractStatus: c.status,
            printedById: uid,
          },
          select: printSelect,
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'contract.printed',
          entityType: 'contract',
          entityId: c.id,
          data: { printNo: next, source: body.source, templateId, templateVersion, basedOnPrintId, dataHash },
          requestId,
        });
        return created;
      }, WRITE_TX);
      // Không trả lại dữ liệu: web đã có đúng dữ liệu đó (mã băm khớp).
      return { status: 201, body: presentPrint(row) };
    },
  }),
];
