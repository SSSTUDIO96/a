import { Prisma } from '@prisma/client';
import {
  canTransitionContract,
  computeContractTotals,
  CONTRACT_STATUS_LABELS,
  formatVnd,
  normalizeVnPhone,
  vndFromBigInt,
  WORK_STATUS_LABELS,
  type ContractStatus,
  type Vnd,
} from '@makeup/shared';
import { defineRoute, mustOrg, mustUser, type AnyRoute, type OrgContext } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import {
  ContractBodySchema,
  ContractParams,
  ContractPatchSchema,
  LineInputSchema,
  LineParams,
  ListQuery,
  QuoteBodySchema,
  StatusBodySchema,
  VoidBodySchema,
  type ContractBody,
  type ContractKindKey,
} from './schemas';
import { buildSheet, insertLines, money, planLines } from './sheet';
import { contractSummarySelect, loadContractDetail, loadStaffMap, presentSheet, presentSummary, sheetWarnings } from './present';
import { classSeats, enrollContractLines, releaseEnrollments } from './enroll';
import { checkChosenText, contractTextRoutes, snapshotTexts } from './texts';
import { cancelAppointmentsOfContractTx, createAppointmentTx, type TxCtx } from '../schedule/service';
import { contractSummary as paymentSummary } from '../payments/common';

type Tx = Prisma.TransactionClient;

const TAG = 'Hợp đồng';
// Lập hợp đồng nhiều dòng chạy nhiều truy vấn trong một transaction; 5 giây mặc định của Prisma là sát.
const TX_OPTS = { timeout: 15_000 };

type CustomerChoice = { existingId: string } | { fullName: string; phone: string | null };

// Kiểm phần khách hàng mà không ghi gì — dùng chung cho xem trước và tạo.
async function checkCustomer(db: Tx, orgId: string, body: ContractBody): Promise<CustomerChoice> {
  if (body.customerId) {
    const c = await db.customer.findFirst({ where: { id: body.customerId, organizationId: orgId }, select: { id: true } });
    if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy khách hàng');
    return { existingId: c.id };
  }
  if (!body.newCustomer) throw new Error('Thiếu khách hàng sau khi schema đã kiểm — lỗi lắp ráp');
  const raw = body.newCustomer.phone;
  const phone = raw === undefined ? null : normalizeVnPhone(raw);
  if (raw !== undefined && phone === null) {
    throw new AppError('VALIDATION_FAILED', `Số điện thoại khách không hợp lệ: ${raw}`);
  }
  return { fullName: body.newCustomer.fullName, phone };
}

// Tạo khách mới ngay trong hợp đồng là thêm khách hàng: cần cả quyền customers.write.
function assertCanCreateCustomer(o: OrgContext): void {
  if (!o.permissions.has('customers.write')) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền thêm khách hàng mới', { required: 'customers.write' });
  }
}

// Mã tuần tự theo tổ chức; câu lệnh khoá dòng bộ đếm nên gửi đồng thời không trùng mã.
// Hợp đồng dịch vụ: HD-000001 (bộ đếm 'contract'). Hợp đồng khoá học: HĐKH-000001 (bộ đếm riêng 'contract_course').
const CODE_FORMAT: Record<ContractKindKey, { key: string; prefix: string }> = {
  SERVICE: { key: 'contract', prefix: 'HD-' },
  COURSE: { key: 'contract_course', prefix: 'HĐKH-' },
};

async function nextContractCode(tx: Tx, orgId: string, kind: ContractKindKey): Promise<string> {
  const { key, prefix } = CODE_FORMAT[kind];
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO org_counters (organization_id, key, value) VALUES (${orgId}::uuid, ${key}, 1)
    ON CONFLICT (organization_id, key) DO UPDATE SET value = org_counters.value + 1
    RETURNING value`;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error('Bộ đếm mã hợp đồng không trả giá trị');
  return `${prefix}${String(value).padStart(6, '0')}`;
}

// Hợp đồng khoá học chỉ ở tổ chức đã bật đào tạo (Organization.kind = ACADEMY) — BAN-VE-C3 mục 1.0.
async function assertKindEnabled(db: Tx, orgId: string, kind: ContractKindKey): Promise<void> {
  if (kind !== 'COURSE') return;
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { kind: true } });
  if (org.kind !== 'ACADEMY') throw new AppError('FORBIDDEN', 'Tổ chức chưa bật đào tạo', { reason: 'ACADEMY_REQUIRED' });
}

// Người phụ trách: thành viên ĐANG HOẠT ĐỘNG của tổ chức. Mã của tổ chức khác trả đúng lời như mã bịa.
async function checkOwner(db: Tx, orgId: string, membershipId: string): Promise<string> {
  const m = await db.membership.findFirst({ where: { id: membershipId, organizationId: orgId }, select: { id: true, status: true } });
  if (!m) throw new AppError('NOT_FOUND', 'Không tìm thấy người phụ trách');
  if (m.status !== 'ACTIVE') throw new AppError('VALIDATION_FAILED', 'Người phụ trách không còn hoạt động trong tổ chức');
  return m.id;
}

// Mẫu điều khoản / nội quy chọn cho hợp đồng nháp: lưu id + phiên bản lúc chọn; lúc xác nhận chụp bản mới nhất.
async function chooseTexts(
  db: Tx,
  orgId: string,
  kind: ContractKindKey,
  input: { termsTemplateId?: string | null; rulesTemplateId?: string | null },
) {
  const out: {
    termsTemplateId?: string | null;
    termsTemplateVersion?: number | null;
    rulesTemplateId?: string | null;
    rulesTemplateVersion?: number | null;
  } = {};
  if (input.termsTemplateId === null) Object.assign(out, { termsTemplateId: null, termsTemplateVersion: null });
  else if (input.termsTemplateId) {
    const t = await checkChosenText(db, orgId, input.termsTemplateId, 'TERMS', kind);
    Object.assign(out, { termsTemplateId: t.id, termsTemplateVersion: t.version });
  }
  if (input.rulesTemplateId === null) Object.assign(out, { rulesTemplateId: null, rulesTemplateVersion: null });
  else if (input.rulesTemplateId) {
    const r = await checkChosenText(db, orgId, input.rulesTemplateId, 'RULES', kind);
    Object.assign(out, { rulesTemplateId: r.id, rulesTemplateVersion: r.version });
  }
  return out;
}

// Sửa nháp HẠ TỔNG xuống dưới số đã thu → 409 (biên bản máy chủ lát 2, N7). Trước đây máy chủ lặng lẽ ghi khách
// "trả thừa", lách luật "thu vượt phải có allowOverpay + ghi chú". Tiền đã thu ra khỏi sổ phải đi qua phiếu hoàn tiền
// (quyền huỷ phiếu / hoàn tiền) hoặc huỷ dòng có lý do — không đi qua lệnh sửa nháp không có lý do.
async function assertNotBelowPaid(tx: Tx, orgId: string, c: { id: string; total: bigint; depositRequired: bigint }, newTotal: Vnd) {
  const oldTotal = vnd(c.total, 'tổng');
  if (newTotal >= oldTotal) return;
  const { paid } = await paymentSummary(tx, orgId, c);
  if (newTotal < paid) {
    throw new AppError(
      'CONFLICT',
      `Hợp đồng đã thu ${formatVnd(paid)} — tổng mới ${formatVnd(newTotal)} thấp hơn số đã thu. ` +
        'Ghi phiếu hoàn tiền phần chênh trước, hoặc giữ tổng không thấp hơn số đã thu',
      { reason: 'TOTAL_BELOW_PAID', paid, newTotal, total: oldTotal },
    );
  }
}

// Khoá dòng hợp đồng: các thay đổi cùng hợp đồng xếp hàng nên tổng tiền không bị ghi đè lẫn nhau.
async function lockContract(tx: Tx, orgId: string, contractId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM contracts WHERE id = ${contractId}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng');
  return tx.contract.findUniqueOrThrow({ where: { id: contractId } });
}

function assertNotClosed(status: ContractStatus): void {
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    throw new AppError('CONFLICT', `Hợp đồng đã ${CONTRACT_STATUS_LABELS[status].toLowerCase()} — không thay đổi được`);
  }
}

// Sau xác nhận, việc làm GIẢM tiền (huỷ dòng, giảm giá) cần quyền điều chỉnh riêng; nháp chỉ cần contracts.write.
function assertCanAdjust(o: OrgContext, status: ContractStatus, action: string): void {
  if (status === 'CONFIRMED' && !o.permissions.has('contracts.adjust')) {
    throw new AppError('FORBIDDEN', `Hợp đồng đã xác nhận: ${action} cần quyền điều chỉnh hợp đồng`, {
      required: 'contracts.adjust',
    });
  }
}

// Dòng chưa huỷ có thợ dự kiến → một lịch đã xác nhận cho đúng thợ, đúng giờ, đúng nơi. Trùng giờ thì module lịch
// ném 409 kèm danh sách và cả transaction quay lui (hợp đồng giữ nguyên trạng thái cũ).
async function createLineAppointments(tx: Tx, ctx: TxCtx, contract: { id: string; customerId: string }, onlyLineIds?: string[]) {
  const lines = await tx.contractLine.findMany({
    where: {
      contractId: contract.id,
      organizationId: ctx.orgId,
      voidedAt: null,
      plannedStaff: { some: {} },
      ...(onlyLineIds ? { id: { in: onlyLineIds } } : {}),
    },
    include: { plannedStaff: { select: { membershipId: true, role: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const created: string[] = [];
  for (const l of lines) {
    if (!l.scheduledStart || !l.scheduledEnd) {
      throw new AppError('VALIDATION_FAILED', `Dòng "${l.name}" có thợ phụ trách nhưng chưa có giờ làm — thêm giờ trước khi xác nhận`, {
        lineId: l.id,
      });
    }
    const appt = await createAppointmentTx(tx, ctx, {
      kind: 'MAKEUP',
      title: l.subjectName ? `${l.name} — ${l.subjectName}` : l.name,
      customerId: contract.customerId,
      contractId: contract.id,
      contractLineId: l.id,
      startsAt: l.scheduledStart,
      endsAt: l.scheduledEnd,
      travelBeforeMin: 0,
      travelAfterMin: 0,
      locationType: l.locationType,
      address: l.address,
      latitude: l.latitude === null ? null : l.latitude.toNumber(),
      longitude: l.longitude === null ? null : l.longitude.toNumber(),
      staff: l.plannedStaff,
      status: 'CONFIRMED',
    });
    created.push(appt.id);
  }
  return created;
}

function pickAppointments<T extends { id: string }>(all: T[], ids: string[]): T[] {
  const set = new Set(ids);
  return all.filter((a) => set.has(a.id));
}

async function lineTotals(tx: Tx, orgId: string, contractId: string) {
  const rows = await tx.contractLine.findMany({
    where: { contractId, organizationId: orgId },
    select: { lineTotal: true, voidedAt: true },
  });
  return rows.map((r) => ({ lineTotal: vndFromBigInt(r.lineTotal, 'thành tiền dòng'), voided: r.voidedAt !== null }));
}

function vnd(v: bigint, field: string): Vnd {
  return vndFromBigInt(v, field);
}

export const contractRoutes: AnyRoute[] = [
  ...contractTextRoutes,
  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/contracts/quote',
    scope: 'org',
    permission: 'contracts.read',
    tag: TAG,
    summary: 'Xem trước bảng tính hợp đồng (không ghi gì) — cùng công thức với lệnh tạo',
    body: QuoteBodySchema,
    handler: async ({ deps, org, body }) => {
      const o = mustOrg(org);
      await assertKindEnabled(deps.db, o.id, body.kind);
      await checkCustomer(deps.db, o.id, body);
      if (body.ownerMembershipId) await checkOwner(deps.db, o.id, body.ownerMembershipId);
      await chooseTexts(deps.db, o.id, body.kind, body);
      // Hợp đồng đang sửa: giữ chỗ nháp và lịch của CHÍNH nó không tính là cảnh báo thợ.
      let exclude: { contractId?: string; appointmentIds?: string[] } = {};
      if (body.excludeContractId) {
        const self = await deps.db.contract.findFirst({
          where: { id: body.excludeContractId, organizationId: o.id },
          select: { id: true, appointments: { where: { organizationId: o.id }, select: { id: true } } },
        });
        if (!self) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng đang sửa');
        exclude = { contractId: self.id, appointmentIds: self.appointments.map((a) => a.id) };
      }
      // Xem trước không chặn lớp hết chỗ: trả classes[] để web báo lớp vừa đầy (chốt thật ở bước xác nhận).
      const sheet = await buildSheet(deps.db, o.id, body, new Date(), { kind: body.kind, seatCheck: false });
      const [staff, warnings, classes] = await Promise.all([
        loadStaffMap(deps.db, o.id, sheet),
        sheetWarnings(deps.db, o.id, sheet, exclude),
        classSeats(
          deps.db,
          o.id,
          sheet.lines.flatMap((l) => (l.courseClassId ? [l.courseClassId] : [])),
        ),
      ]);
      return { body: { ...presentSheet(sheet, staff, warnings), kind: body.kind, classes } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/contracts',
    scope: 'org',
    permission: 'contracts.write',
    idempotent: true,
    tag: TAG,
    summary: 'Lập hợp đồng: nhiều gói/dịch vụ, nhân vật, dịch vụ phụ, phụ phí, phí di chuyển',
    body: ContractBodySchema,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      if (body.newCustomer) assertCanCreateCustomer(o);
      const at = new Date();
      const detail = await deps.db.$transaction(async (tx) => {
        await assertKindEnabled(tx, o.id, body.kind);
        const choice = await checkCustomer(tx, o.id, body);
        const ownerMembershipId = body.ownerMembershipId ? await checkOwner(tx, o.id, body.ownerMembershipId) : null;
        const texts = await chooseTexts(tx, o.id, body.kind, body);
        const sheet = await buildSheet(tx, o.id, body, at, { kind: body.kind, seatCheck: true });
        const customerId =
          'existingId' in choice
            ? choice.existingId
            : (await tx.customer.create({ data: { organizationId: o.id, fullName: choice.fullName, phone: choice.phone } })).id;
        const code = await nextContractCode(tx, o.id, body.kind);
        const contract = await tx.contract.create({
          data: {
            organizationId: o.id,
            code,
            kind: body.kind,
            ownerMembershipId,
            ...texts,
            customerId,
            eventDate: body.eventDate ? new Date(body.eventDate) : null,
            notes: body.notes ?? null,
            terms: body.terms ?? null,
            subtotal: BigInt(sheet.subtotal),
            discount: BigInt(sheet.discount),
            total: BigInt(sheet.total),
            depositRequired: BigInt(sheet.depositRequired),
            createdById: uid,
          },
        });
        await insertLines(tx, { orgId: o.id, contractId: contract.id, userId: uid, lines: sheet.lines, firstSort: 0, addedAfterConfirm: false });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'contract.created',
          entityType: 'contract',
          entityId: contract.id,
          data: {
            code,
            kind: body.kind,
            customerId,
            ownerMembershipId,
            termsTemplateId: texts.termsTemplateId ?? null,
            rulesTemplateId: texts.rulesTemplateId ?? null,
            newCustomer: !('existingId' in choice),
            lineCount: sheet.lines.length,
            subtotal: sheet.subtotal,
            discount: sheet.discount,
            total: sheet.total,
            depositRequired: sheet.depositRequired,
          },
          requestId,
        });
        return loadContractDetail(tx, o.id, contract.id);
      }, TX_OPTS);
      return { status: 201, body: detail };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/contracts',
    scope: 'org',
    permission: 'contracts.read',
    tag: TAG,
    summary: 'Danh sách hợp đồng (lọc trạng thái, khách, ngày sự kiện, tìm theo mã/tên/số điện thoại)',
    query: ListQuery,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const q = query.q && query.q.length > 0 ? query.q : undefined;
      const phone = q ? normalizeVnPhone(q) : null;
      const where: Prisma.ContractWhereInput = {
        organizationId: o.id,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.eventFrom || query.eventTo
          ? {
              eventDate: {
                ...(query.eventFrom ? { gte: new Date(query.eventFrom) } : {}),
                ...(query.eventTo ? { lte: new Date(query.eventTo) } : {}),
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { customer: { fullName: { contains: q, mode: 'insensitive' } } },
                { customer: { phone: { contains: phone ?? q } } },
              ],
            }
          : {}),
      };
      const [total, rows] = await deps.db.$transaction([
        deps.db.contract.count({ where }),
        deps.db.contract.findMany({
          where,
          select: contractSummarySelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);
      return { body: { items: rows.map(presentSummary), page: query.page, pageSize: query.pageSize, total } };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/contracts/:contractId',
    scope: 'org',
    permission: 'contracts.read',
    tag: TAG,
    summary: 'Xem hợp đồng: khách, các dòng (dịch vụ phụ, phí di chuyển gom dưới dòng cha), lịch đã gắn',
    params: ContractParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      return { body: await loadContractDetail(deps.db, o.id, params.contractId) };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/contracts/:contractId',
    scope: 'org',
    permission: 'contracts.write',
    tag: TAG,
    summary: 'Sửa hợp đồng: nháp sửa được mọi thứ (thay toàn bộ dòng); đã xác nhận chỉ sửa ghi chú',
    params: ContractParams,
    body: ContractPatchSchema,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const detail = await deps.db.$transaction(async (tx) => {
        const c = await lockContract(tx, o.id, params.contractId);
        assertNotClosed(c.status);
        const before = {
          subtotal: vnd(c.subtotal, 'tạm tính'),
          discount: vnd(c.discount, 'giảm giá'),
          total: vnd(c.total, 'tổng'),
          depositRequired: vnd(c.depositRequired, 'tiền cọc'),
          eventDate: c.eventDate?.toISOString() ?? null,
        };
        const textChanges = {
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.terms !== undefined ? { terms: body.terms } : {}),
        };
        let nextMoney: { subtotal: Vnd; discount: Vnd; total: Vnd; depositRequired: Vnd } | null = null;
        let textChoice: Awaited<ReturnType<typeof chooseTexts>> = {};
        if (c.status === 'CONFIRMED') {
          const others = (['lines', 'discount', 'depositRequired', 'eventDate', 'terms', 'termsTemplateId', 'rulesTemplateId'] as const).filter(
            (k) => body[k] !== undefined,
          );
          if (others.length > 0) {
            throw new AppError(
              'CONFLICT',
              'Hợp đồng đã xác nhận chỉ sửa được ghi chú. Muốn đổi tiền: thêm dòng phát sinh hoặc huỷ dòng có lý do',
              { fields: others },
            );
          }
        } else {
          textChoice = await chooseTexts(tx, o.id, c.kind, body);
          // Thao tác sau thắng: chọn mẫu điều khoản thì bỏ lời tự nhập; tự nhập điều khoản thì bỏ mẫu đã chọn.
          if (typeof body.termsTemplateId === 'string' && body.terms === undefined) Object.assign(textChanges, { terms: null });
          if (typeof body.terms === 'string' && body.termsTemplateId === undefined) {
            Object.assign(textChoice, { termsTemplateId: null, termsTemplateVersion: null });
          }
          const discount = body.discount ?? before.discount;
          if (body.lines) {
            const linked = await tx.appointment.count({
              where: { organizationId: o.id, contractId: c.id, contractLineId: { not: null } },
            });
            if (linked > 0) {
              throw new AppError('CONFLICT', 'Đã có lịch gắn vào dòng của hợp đồng — huỷ từng dòng thay vì thay toàn bộ');
            }
            const sheet = await buildSheet(
              tx,
              o.id,
              { lines: body.lines, discount, depositRequired: body.depositRequired },
              new Date(),
              { kind: c.kind, seatCheck: true },
            );
            // Hợp đồng nháp chưa hứa với khách: thay dòng là xoá dòng cũ (dòng con trước, dòng cha sau).
            await tx.contractLine.deleteMany({ where: { contractId: c.id, organizationId: o.id, parentLineId: { not: null } } });
            await tx.contractLine.deleteMany({ where: { contractId: c.id, organizationId: o.id } });
            await insertLines(tx, { orgId: o.id, contractId: c.id, userId: uid, lines: sheet.lines, firstSort: 0, addedAfterConfirm: false });
            nextMoney = { subtotal: sheet.subtotal, discount, total: sheet.total, depositRequired: sheet.depositRequired };
          } else if (body.discount !== undefined || body.depositRequired !== undefined) {
            const { subtotal, total } = await recompute(tx, o.id, c.id, discount);
            const depositRequired = body.depositRequired ?? before.depositRequired;
            if (depositRequired > total) {
              throw new AppError(
                'VALIDATION_FAILED',
                body.depositRequired !== undefined
                  ? `Tiền cọc (${depositRequired}) không được lớn hơn tổng hợp đồng (${total})`
                  : `Tiền cọc hiện tại (${depositRequired}) lớn hơn tổng mới (${total}) — gửi kèm depositRequired mới`,
              );
            }
            nextMoney = { subtotal, discount, total, depositRequired };
          }
          if (nextMoney) await assertNotBelowPaid(tx, o.id, c, nextMoney.total);
        }
        await tx.contract.update({
          where: { id: c.id },
          data: {
            ...textChanges,
            ...textChoice,
            ...(body.eventDate !== undefined ? { eventDate: body.eventDate === null ? null : new Date(body.eventDate) } : {}),
            ...(nextMoney
              ? {
                  subtotal: BigInt(nextMoney.subtotal),
                  discount: BigInt(nextMoney.discount),
                  total: BigInt(nextMoney.total),
                  depositRequired: BigInt(nextMoney.depositRequired),
                }
              : {}),
          },
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'contract.updated',
          entityType: 'contract',
          entityId: c.id,
          data: {
            before,
            after: { ...nextMoney, eventDate: body.eventDate, ...textChanges, ...textChoice },
            linesReplaced: body.lines !== undefined,
          },
          requestId,
        });
        return loadContractDetail(tx, o.id, c.id);
      }, TX_OPTS);
      return { body: detail };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/contracts/:contractId/lines',
    scope: 'org',
    permission: 'contracts.write',
    idempotent: true,
    tag: TAG,
    summary: 'Thêm một dòng (kèm dịch vụ phụ, phí di chuyển); hợp đồng đã xác nhận thì là phụ phí phát sinh',
    params: ContractParams,
    body: LineInputSchema,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const detail = await deps.db.$transaction(async (tx) => {
        const c = await lockContract(tx, o.id, params.contractId);
        assertNotClosed(c.status);
        if ((body.kind === 'PACKAGE' || body.kind === 'SERVICE') && (body.lineDiscount ?? 0) > 0) {
          assertCanAdjust(o, c.status, 'giảm giá dòng phát sinh');
        }
        const planned = await planLines(tx, o.id, [body], new Date(), { kind: c.kind, seatCheck: true });
        const newClassIds = planned.flatMap((l) => (l.courseClassId ? [l.courseClassId] : []));
        if (newClassIds.length > 0) {
          const same = await tx.contractLine.findFirst({
            where: { contractId: c.id, organizationId: o.id, voidedAt: null, courseClassId: { in: newClassIds } },
            select: { name: true },
          });
          if (same) {
            throw new AppError('VALIDATION_FAILED', `Hợp đồng đã có dòng "${same.name}" — mỗi lớp chỉ một dòng`, { line: 0 });
          }
        }
        const last = await tx.contractLine.aggregate({
          where: { contractId: c.id, organizationId: o.id },
          _max: { sortOrder: true },
        });
        const addedAfterConfirm = c.status === 'CONFIRMED';
        await insertLines(tx, {
          orgId: o.id,
          contractId: c.id,
          userId: uid,
          lines: planned,
          firstSort: (last._max.sortOrder ?? -1) + 1,
          addedAfterConfirm,
        });
        const { subtotal, total } = await recompute(tx, o.id, c.id, vnd(c.discount, 'giảm giá'));
        await tx.contract.update({ where: { id: c.id }, data: { subtotal: BigInt(subtotal), total: BigInt(total) } });
        // Dòng khoá học thêm vào hợp đồng ĐÃ xác nhận → giữ chỗ + ghi danh ngay, cùng transaction (nháp không giữ chỗ).
        const enrollmentIds = addedAfterConfirm
          ? await enrollContractLines(
              tx,
              o.id,
              c,
              planned.map((l) => l.id),
            )
          : [];
        // Dòng phát sinh sau xác nhận có thợ + giờ → lên lịch ngay.
        const createdAppointmentIds = addedAfterConfirm
          ? await createLineAppointments(
              tx,
              { orgId: o.id, userId: uid, requestId },
              c,
              planned.map((l) => l.id),
            )
          : [];
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'contract.line_added',
          entityType: 'contract',
          entityId: c.id,
          data: {
            lineIds: planned.map((l) => l.id),
            addedAfterConfirm,
            createdAppointmentIds,
            enrollmentIds,
            actorRoles: o.roleKeys,
            amount: planned.reduce((s, l) => s + l.lineTotal, 0),
            before: { subtotal: vnd(c.subtotal, 'tạm tính'), total: vnd(c.total, 'tổng') },
            after: { subtotal, total },
          },
          requestId,
        });
        const full = await loadContractDetail(tx, o.id, c.id);
        return { ...full, createdAppointments: pickAppointments(full.appointments, createdAppointmentIds) };
      }, TX_OPTS);
      return { status: 201, body: detail };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/contracts/:contractId/lines/:lineId/void',
    scope: 'org',
    permission: 'contracts.write',
    tag: TAG,
    summary: 'Huỷ một dòng (kéo theo dịch vụ phụ, phí di chuyển của dòng đó) — không xoá, bắt buộc lý do',
    params: LineParams,
    body: VoidBodySchema,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const detail = await deps.db.$transaction(async (tx) => {
        const c = await lockContract(tx, o.id, params.contractId);
        assertNotClosed(c.status);
        const line = await tx.contractLine.findFirst({
          where: { id: params.lineId, contractId: c.id, organizationId: o.id },
          select: { id: true, name: true, voidedAt: true },
        });
        if (!line) throw new AppError('NOT_FOUND', 'Không tìm thấy dòng hợp đồng');
        if (line.voidedAt) throw new AppError('CONFLICT', `Dòng "${line.name}" đã huỷ trước đó`);
        assertCanAdjust(o, c.status, `huỷ dòng "${line.name}"`);
        const children = await tx.contractLine.findMany({
          where: { parentLineId: line.id, organizationId: o.id, voidedAt: null },
          select: { id: true },
        });
        const voidedIds = [line.id, ...children.map((ch) => ch.id)];
        await tx.contractLine.updateMany({
          where: { id: { in: voidedIds }, organizationId: o.id },
          data: { voidedAt: new Date(), voidReason: body.reason },
        });
        // Huỷ dòng khoá học của hợp đồng đã xác nhận → huỷ ghi danh, trả chỗ (cùng transaction).
        const released = await releaseEnrollments(tx, o.id, { contractId: c.id, lineIds: voidedIds }, body.reason);
        // Huỷ dòng làm tổng giảm: giảm giá và cọc không được vượt tổng mới → hạ xuống và ghi nhật ký.
        const oldDiscount = vnd(c.discount, 'giảm giá');
        const oldDeposit = vnd(c.depositRequired, 'tiền cọc');
        const rows = await lineTotals(tx, o.id, c.id);
        const { subtotal: rawSubtotal } = money(() => computeContractTotals(rows, 0));
        const discount = Math.min(oldDiscount, rawSubtotal);
        const { subtotal, total } = money(() => computeContractTotals(rows, discount));
        const depositRequired = Math.min(oldDeposit, total);
        const adjustments = [
          ...(discount !== oldDiscount ? [{ field: 'discount', from: oldDiscount, to: discount }] : []),
          ...(depositRequired !== oldDeposit ? [{ field: 'depositRequired', from: oldDeposit, to: depositRequired }] : []),
        ];
        await tx.contract.update({
          where: { id: c.id },
          data: {
            subtotal: BigInt(subtotal),
            discount: BigInt(discount),
            total: BigInt(total),
            depositRequired: BigInt(depositRequired),
          },
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'contract.line_voided',
          entityType: 'contract',
          entityId: c.id,
          data: {
            lineId: line.id,
            voidedLineIds: voidedIds,
            releasedEnrollmentIds: released.map((e) => e.id),
            reason: body.reason,
            contractStatus: c.status,
            actorRoles: o.roleKeys,
            before: { subtotal: vnd(c.subtotal, 'tạm tính'), total: vnd(c.total, 'tổng') },
            after: { subtotal, total },
            adjustments,
          },
          requestId,
        });
        return { ...(await loadContractDetail(tx, o.id, c.id)), adjustments };
      }, TX_OPTS);
      return { body: detail };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/contracts/:contractId/status',
    scope: 'org',
    permission: 'contracts.write',
    tag: TAG,
    summary: 'Đổi trạng thái hợp đồng: nháp → xác nhận/huỷ; xác nhận → hoàn thành/huỷ (huỷ bắt buộc lý do)',
    params: ContractParams,
    body: StatusBodySchema,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const detail = await deps.db.$transaction(async (tx) => {
        const c = await lockContract(tx, o.id, params.contractId);
        if (!canTransitionContract(c.status, body.to)) {
          throw new AppError(
            'CONFLICT',
            `Không chuyển được hợp đồng từ "${CONTRACT_STATUS_LABELS[c.status]}" sang "${CONTRACT_STATUS_LABELS[body.to]}"`,
          );
        }
        if (body.to === 'CANCELLED' && !body.reason) {
          throw new AppError('VALIDATION_FAILED', 'Huỷ hợp đồng phải nêu lý do');
        }
        if (body.to === 'CONFIRMED') {
          const active = await tx.contractLine.count({ where: { contractId: c.id, organizationId: o.id, voidedAt: null } });
          if (active === 0) throw new AppError('CONFLICT', 'Hợp đồng chưa có dòng nào còn hiệu lực — không xác nhận được');
        }
        // Xác nhận hợp đồng khoá học = giữ chỗ + ghi danh từng dòng COURSE + giới hạn học viên; chụp điều khoản / nội quy.
        // Mọi bước cùng transaction: một lớp vừa đầy → 409, hợp đồng giữ nguyên nháp, không lớp nào bị trừ chỗ.
        const enrollmentIds = body.to === 'CONFIRMED' ? await enrollContractLines(tx, o.id, c) : [];
        const snapshot = body.to === 'CONFIRMED' ? ({} as Record<string, never>) : {};
        // Xác nhận hợp đồng = lên lịch cho các dòng có thợ, trong cùng transaction.
        const createdAppointmentIds =
          body.to === 'CONFIRMED' ? await createLineAppointments(tx, { orgId: o.id, userId: uid, requestId }, c) : [];
        // Huỷ hợp đồng → huỷ ghi danh, trả chỗ.
        const released = body.to === 'CANCELLED' && body.reason ? await releaseEnrollments(tx, o.id, { contractId: c.id }, body.reason) : [];
        // Huỷ hợp đồng thì huỷ luôn các lịch đã gắn, trong cùng transaction; còn lịch đang làm thì không huỷ gì cả.
        let cancelledIds: string[] = [];
        if (body.to === 'CANCELLED' && body.reason) {
          const r = await cancelAppointmentsOfContractTx(tx, { orgId: o.id, userId: uid, requestId }, c.id, body.reason);
          if (r.blocking.length > 0) {
            const busy = await tx.appointment.findMany({
              where: { id: { in: r.blocking }, organizationId: o.id },
              select: { id: true, code: true, status: true },
              orderBy: { code: 'asc' },
            });
            throw new AppError(
              'CONFLICT',
              `Còn lịch đang thực hiện: ${busy.map((a) => `${a.code} (${WORK_STATUS_LABELS[a.status]})`).join(', ')} — xử lý xong lịch trước khi huỷ hợp đồng`,
              { appointments: busy },
            );
          }
          cancelledIds = r.cancelled;
        }
        await tx.contract.update({
          where: { id: c.id },
          data: {
            status: body.to,
            ...snapshot,
            ...(body.to === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
            ...(body.to === 'CANCELLED' ? { cancelReason: body.reason } : {}),
          },
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'contract.status_changed',
          entityType: 'contract',
          entityId: c.id,
          data: {
            from: c.status,
            to: body.to,
            reason: body.reason ?? null,
            cancelledAppointmentIds: cancelledIds,
            createdAppointmentIds,
            enrollmentIds,
            releasedEnrollmentIds: released.map((e) => e.id),
            snapshot: {
              termsTemplateId: snapshot.termsTemplateId ?? null,
              termsTemplateVersion: snapshot.termsTemplateVersion ?? null,
              rulesTemplateId: snapshot.rulesTemplateId ?? null,
              rulesTemplateVersion: snapshot.rulesTemplateVersion ?? null,
            },
          },
          requestId,
        });
        const full = await loadContractDetail(tx, o.id, c.id);
        return {
          ...full,
          cancelledAppointments: pickAppointments(full.appointments, cancelledIds),
          createdAppointments: pickAppointments(full.appointments, createdAppointmentIds),
        };
      }, TX_OPTS);
      return { body: detail };
    },
  }),
];

async function recompute(tx: Tx, orgId: string, contractId: string, discount: Vnd) {
  const rows = await lineTotals(tx, orgId, contractId);
  return money(() => computeContractTotals(rows, discount));
}
