// Mẫu thiết kế và thẻ (bản vẽ C3 mục 1.3, 1.4) — thợ gói M6 giữ thư mục này. Điều phối đăng ký designRoutes một lần ở app.ts.
// Mẫu là DỮ LIỆU trong packages/shared (design-templates.ts), không nằm trong database.
// Lỗi dữ liệu (mẫu sai loại hợp đồng, sai số ảnh, ảnh không dùng được…) → 400 VALIDATION_FAILED có details.issues
// chỉ đúng trường (KY-DUYET-C3 điều chỉnh 1, không dùng 422).
// Mã của tổ chức khác trả GIỐNG HỆT mã bịa: hợp đồng / thẻ / câu chúc ở đường dẫn → 404; mã trong thân (ảnh, lớp) → 400
// cùng lời "Không tìm thấy …" ở đúng trường.
import type { Prisma } from '@prisma/client';
import { listDesignTemplates, phraseAppliesTo, type SlotKey } from '@makeup/shared';
import type { AnyRoute } from '../../http/route';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import {
  auditCard,
  buildSnapshot,
  cardInclude,
  checkFiles,
  checkKindFields,
  checkOverrides,
  checkPhotoCount,
  checkSize,
  checkTemplate,
  loadContract,
  loadDesignData,
  presentCards,
  presentDesignData,
  resolveClass,
  slotsToRefresh,
  throwIfIssues,
  type CardRow,
  type FieldIssue,
  type Snapshot,
} from './data';
import {
  CardCreateBody,
  CardListQuery,
  CardOutputBody,
  CardParams,
  CardPatchBody,
  ContractParams,
  DesignDataQuery,
  OrgParams,
  PhraseCreateBody,
  PhraseParams,
  PhrasePatchBody,
  PhraseQuery,
  TemplateQuery,
} from './schemas';

const TAG = 'Mẫu thiết kế';
type Tx = Prisma.TransactionClient;

const dateOrNull = (s: string | null | undefined) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
const ymdOrNull = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function presentPhrase(p: Prisma.GreetingPhraseGetPayload<object>) {
  return {
    id: p.id,
    name: p.name,
    appliesTo: p.appliesTo,
    title: p.title,
    body: p.body,
    sortOrder: p.sortOrder,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function auditPhrase(p: Prisma.GreetingPhraseGetPayload<object>) {
  const { organizationId: _o, createdAt: _c, updatedAt: _u, id: _i, ...rest } = p;
  return rest;
}

// Thẻ chưa xoá của tổ chức, khoá dòng để hai lần sửa cùng lúc không đè nhau. Mã của tổ chức khác = mã bịa → 404.
async function lockCard(tx: Tx, organizationId: string, cardId: string): Promise<CardRow> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM design_cards
    WHERE id = ${cardId}::uuid AND organization_id = ${organizationId}::uuid AND deleted_at IS NULL
    FOR UPDATE`;
  if (locked.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy thẻ');
  return tx.designCard.findUniqueOrThrow({ where: { id: cardId }, include: cardInclude });
}

async function present(db: Tx, organizationId: string, row: CardRow) {
  const [card] = await presentCards(db, organizationId, [row]);
  return card;
}

// ---------- Danh mục mẫu và giá trị ô ----------

const templateRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/design-templates',
    scope: 'org',
    permission: 'designs.read',
    tag: TAG,
    summary: 'Danh mục mẫu thiết kế (lọc theo loại thẻ, loại hợp đồng)',
    params: OrgParams,
    query: TemplateQuery,
    handler: async ({ query }) => ({ body: listDesignTemplates({ kind: query.kind, contractKind: query.contractKind }) }),
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/contracts/:contractId/design-data',
    scope: 'org',
    permission: 'designs.read',
    tag: TAG,
    summary: 'Giá trị các ô của mẫu lấy từ hợp đồng và hồ sơ thương hiệu (ô hợp đồng không có = null; ảnh là URL ký có hạn)',
    params: ContractParams,
    query: DesignDataQuery,
    handler: async ({ deps, org, params, query }) => {
      const o = mustOrg(org);
      const c = await loadContract(deps.db, o.id, params.contractId);
      const issues: FieldIssue[] = [];
      const classId = resolveClass(c, query.courseClassId, issues);
      throwIfIssues(issues);
      const data = await loadDesignData(deps.db, o.id, c, classId);
      return { body: await presentDesignData(deps.db, o.id, data) };
    },
  }),
];

// ---------- Câu chúc soạn sẵn ----------

const phraseRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/greeting-phrases',
    scope: 'org',
    permission: 'designs.read',
    tag: TAG,
    summary: 'Câu chúc soạn sẵn (lọc theo loại hợp đồng; mặc định chỉ câu đang dùng)',
    params: OrgParams,
    query: PhraseQuery,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const rows = await deps.db.greetingPhrase.findMany({
        where: { organizationId: o.id, ...(query.includeInactive === 'true' ? {} : { isActive: true }) },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      const kind = query.contractKind;
      return { body: rows.filter((p) => !kind || phraseAppliesTo(p.appliesTo, kind)).map(presentPhrase) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/greeting-phrases',
    scope: 'org',
    permission: 'designs.write',
    tag: TAG,
    summary: 'Thêm câu chúc soạn sẵn. Bắt buộc header Idempotency-Key',
    idempotent: true,
    params: OrgParams,
    body: PhraseCreateBody,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const created = await deps.db.$transaction(async (tx) => {
        const last = await tx.greetingPhrase.aggregate({ where: { organizationId: o.id }, _max: { sortOrder: true } });
        const row = await tx.greetingPhrase.create({
          data: {
            organizationId: o.id,
            name: body.name,
            appliesTo: body.appliesTo,
            title: body.title,
            body: body.body,
            sortOrder: body.sortOrder ?? (last._max.sortOrder ?? -1) + 1,
            isActive: body.isActive ?? true,
          },
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'greeting_phrase.created',
          entityType: 'greeting_phrase',
          entityId: row.id,
          data: auditPhrase(row),
          requestId,
        });
        return row;
      });
      return { status: 201, body: presentPhrase(created) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/greeting-phrases/:phraseId',
    scope: 'org',
    permission: 'designs.write',
    tag: TAG,
    summary: 'Sửa câu chúc soạn sẵn (trường không gửi giữ nguyên; ẩn bằng isActive=false)',
    params: PhraseParams,
    body: PhrasePatchBody,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const after = await deps.db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM greeting_phrases WHERE id = ${params.phraseId}::uuid AND organization_id = ${o.id}::uuid FOR UPDATE`;
        if (locked.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy câu chúc');
        const before = await tx.greetingPhrase.findUniqueOrThrow({ where: { id: params.phraseId } });
        const row = await tx.greetingPhrase.update({ where: { id: before.id }, data: body });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'greeting_phrase.updated',
          entityType: 'greeting_phrase',
          entityId: row.id,
          data: { before: auditPhrase(before), after: auditPhrase(row) },
          requestId,
        });
        return row;
      });
      return { body: presentPhrase(after) };
    },
  }),
];

// ---------- Thẻ ----------

async function writePhotos(tx: Tx, organizationId: string, cardId: string, fileIds: string[]) {
  await tx.designCardPhoto.deleteMany({ where: { cardId, organizationId } });
  if (fileIds.length > 0) {
    await tx.designCardPhoto.createMany({ data: fileIds.map((fileId, sortOrder) => ({ cardId, organizationId, fileId, sortOrder })) });
  }
}

const cardRoutes = [
  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/design-cards',
    scope: 'org',
    permission: 'designs.write',
    tag: TAG,
    summary: 'Tạo thẻ (chào mừng / feedback / lời chúc) từ một hợp đồng; snapshot = giá trị ô lúc tạo. Bắt buộc header Idempotency-Key',
    idempotent: true,
    params: OrgParams,
    body: CardCreateBody,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const row = await deps.db.$transaction(async (tx) => {
        const c = await loadContract(tx, o.id, body.contractId);
        const issues: FieldIssue[] = [];
        const photoFileIds = body.photoFileIds ?? [];
        const fields = {
          title: body.title ?? null,
          body: body.body ?? null,
          rating: body.rating ?? null,
          receivedAt: body.receivedAt ?? null,
          photoFileIds,
        };
        const t = checkTemplate(body.templateCode, body.kind, c.kind, issues);
        if (t) {
          checkPhotoCount(t, photoFileIds.length, issues);
          checkSize(t, body.size, issues);
          checkOverrides(t, c.kind, body.snapshot, issues);
        }
        checkKindFields(body.kind, fields, issues);
        const classId = resolveClass(c, body.courseClassId, issues);
        await checkFiles(tx, o.id, 'DESIGN_PHOTO', photoFileIds.map((id, i) => ({ path: `photoFileIds.${i}`, id })), issues);
        throwIfIssues(issues);
        if (!t) throw new Error('checkTemplate trả null mà không có lỗi');
        const data = await loadDesignData(tx, o.id, c, classId);
        const snapshot = buildSnapshot({
          template: t,
          contractKind: c.kind,
          base: {},
          data,
          refresh: new Set<SlotKey>(),
          overrides: body.snapshot,
          fields,
        });
        const card = await tx.designCard.create({
          data: {
            organizationId: o.id,
            kind: body.kind,
            templateCode: t.code,
            templateVersion: t.version,
            contractId: c.id,
            customerId: c.customerId,
            courseClassId: classId,
            title: fields.title,
            body: fields.body,
            rating: fields.rating,
            receivedAt: dateOrNull(fields.receivedAt),
            fontOverride: body.fontOverride ?? null,
            size: body.size,
            snapshot: snapshot as Prisma.InputJsonValue,
            createdById: uid,
          },
        });
        await writePhotos(tx, o.id, card.id, photoFileIds);
        const full = await tx.designCard.findUniqueOrThrow({ where: { id: card.id }, include: cardInclude });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'design_card.created',
          entityType: 'design_card',
          entityId: card.id,
          data: auditCard(full),
          requestId,
        });
        return full;
      });
      return { status: 201, body: await present(deps.db, o.id, row) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/design-cards/:cardId',
    scope: 'org',
    permission: 'designs.write',
    tag: TAG,
    summary: 'Sửa thẻ (trường không gửi giữ nguyên; không đổi loại thẻ, hợp đồng)',
    params: CardParams,
    body: CardPatchBody,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const row = await deps.db.$transaction(async (tx) => {
        const before = await lockCard(tx, o.id, params.cardId);
        const c = await loadContract(tx, o.id, before.contractId);
        const issues: FieldIssue[] = [];
        const oldPhotos = before.photos.map((p) => p.fileId);
        const photoFileIds = body.photoFileIds ?? oldPhotos;
        const has = <K extends keyof typeof body>(k: K) => Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined;
        const fields = {
          title: has('title') ? (body.title ?? null) : before.title,
          body: has('body') ? (body.body ?? null) : before.body,
          rating: has('rating') ? (body.rating ?? null) : before.rating,
          receivedAt: has('receivedAt') ? (body.receivedAt ?? null) : ymdOrNull(before.receivedAt),
          photoFileIds,
        };
        const code = body.templateCode ?? before.templateCode;
        const size = body.size ?? before.size;
        const t = checkTemplate(code, before.kind, c.kind, issues);
        if (t) {
          checkPhotoCount(t, photoFileIds.length, issues);
          checkSize(t, size, issues);
          checkOverrides(t, c.kind, body.snapshot, issues);
        }
        checkKindFields(before.kind, fields, issues);
        // courseClassId: null = về lớp mặc định của hợp đồng; vắng mặt = giữ lớp cũ.
        const classId = has('courseClassId') ? resolveClass(c, body.courseClassId, issues) : before.courseClassId;
        if (body.photoFileIds) {
          await checkFiles(tx, o.id, 'DESIGN_PHOTO', body.photoFileIds.map((id, i) => ({ path: `photoFileIds.${i}`, id })), issues);
        }
        throwIfIssues(issues);
        if (!t) throw new Error('checkTemplate trả null mà không có lỗi');
        const base = (before.snapshot ?? {}) as Snapshot;
        const refresh = slotsToRefresh(t, c.kind, base, classId !== before.courseClassId);
        const data = refresh.size > 0 ? await loadDesignData(tx, o.id, c, classId) : null;
        const snapshot = buildSnapshot({ template: t, contractKind: c.kind, base, data, refresh, overrides: body.snapshot, fields });
        await tx.designCard.update({
          where: { id: before.id },
          data: {
            templateCode: t.code,
            templateVersion: t.code === before.templateCode ? before.templateVersion : t.version,
            courseClassId: classId,
            title: fields.title,
            body: fields.body,
            rating: fields.rating,
            receivedAt: dateOrNull(fields.receivedAt),
            ...(has('fontOverride') ? { fontOverride: body.fontOverride ?? null } : {}),
            size,
            snapshot: snapshot as Prisma.InputJsonValue,
          },
        });
        if (body.photoFileIds) await writePhotos(tx, o.id, before.id, body.photoFileIds);
        const after = await tx.designCard.findUniqueOrThrow({ where: { id: before.id }, include: cardInclude });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'design_card.updated',
          entityType: 'design_card',
          entityId: before.id,
          data: { before: auditCard(before), after: auditCard(after) },
          requestId,
        });
        return after;
      });
      return { body: await present(deps.db, o.id, row) };
    },
  }),

  defineRoute({
    method: 'put',
    path: '/orgs/:orgId/design-cards/:cardId/output',
    scope: 'org',
    permission: 'designs.write',
    tag: TAG,
    summary: 'Gắn ảnh PNG đã xuất của thẻ (tệp tải lên qua /files, mục đích DESIGN_CARD)',
    params: CardParams,
    body: CardOutputBody,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const row = await deps.db.$transaction(async (tx) => {
        const before = await lockCard(tx, o.id, params.cardId);
        const issues: FieldIssue[] = [];
        await checkFiles(tx, o.id, 'DESIGN_CARD', [{ path: 'fileId', id: body.fileId }], issues);
        throwIfIssues(issues);
        await tx.designCard.update({ where: { id: before.id }, data: { outputFileId: body.fileId } });
        const after = await tx.designCard.findUniqueOrThrow({ where: { id: before.id }, include: cardInclude });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'design_card.output_set',
          entityType: 'design_card',
          entityId: before.id,
          data: { before: { outputFileId: before.outputFileId }, after: { outputFileId: after.outputFileId } },
          requestId,
        });
        return after;
      });
      return { body: await present(deps.db, o.id, row) };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/design-cards',
    scope: 'org',
    permission: 'designs.read',
    tag: TAG,
    summary: 'Thẻ đã tạo (lọc loại thẻ, hợp đồng, khách, khoảng thời gian tạo [from, to)); kèm ảnh và outputUrl ký có hạn',
    params: OrgParams,
    query: CardListQuery,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const where: Prisma.DesignCardWhereInput = {
        organizationId: o.id,
        deletedAt: null,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.contractId ? { contractId: query.contractId } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.from || query.to
          ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lt: new Date(query.to) } : {}) } }
          : {}),
      };
      const rows = await deps.db.designCard.findMany({ where, include: cardInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
      return { body: await presentCards(deps.db, o.id, rows) };
    },
  }),

  defineRoute({
    method: 'delete',
    path: '/orgs/:orgId/design-cards/:cardId',
    scope: 'org',
    permission: 'designs.write',
    tag: TAG,
    summary: 'Xoá thẻ (xoá mềm: đặt deletedAt, không hiện trong danh sách)',
    params: CardParams,
    handler: async ({ deps, org, params, userId, requestId }) => {
      const o = mustOrg(org);
      await deps.db.$transaction(async (tx) => {
        const before = await lockCard(tx, o.id, params.cardId);
        const deletedAt = new Date();
        await tx.designCard.update({ where: { id: before.id }, data: { deletedAt } });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'design_card.deleted',
          entityType: 'design_card',
          entityId: before.id,
          data: { ...auditCard(before), deletedAt: deletedAt.toISOString() },
          requestId,
        });
      });
      return { status: 204 };
    },
  }),
];

export const designRoutes: AnyRoute[] = [...templateRoutes, ...phraseRoutes, ...cardRoutes];
