import type { Prisma } from '@prisma/client';
import { checkInstallmentPlan, formatVnd, sortInstallments, vndFromBigInt } from '@makeup/shared';
import { defineRoute, mustOrg, mustUser, type AnyRoute } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { contractSummary, loadProgress, lockContract, paymentMath, paymentSelect, presentPayment, TAG, vnd, vndOrNull, type Tx } from './common';
import { ContractParams, InstallmentsBodySchema, LedgerQuery, PaymentBodySchema, PaymentParams, VoidPaymentBodySchema } from './schemas';
import { reportRoutes } from './reports';

// Cho ghi ngày thu lệch đồng hồ máy chủ tối đa 5 phút về tương lai (đồng hồ máy lễ tân chạy nhanh).
const FUTURE_TOLERANCE_MS = 5 * 60_000;
// Ngày thu được trước ngày lập hợp đồng tối đa 1 ngày (cọc nhận hôm trước, hôm sau mới nhập hợp đồng). Lùi xa hơn là ghi
// sai ngày và làm đổi số "đã thu" của kỳ đã qua (biên bản máy chủ lát 2, N6).
const BEFORE_CONTRACT_TOLERANCE_MS = 24 * 60 * 60_000;
// Ghi lùi quá mốc này thì nhật ký đánh dấu "ghi lùi ngày" kèm số ngày lùi.
const BACKDATE_NOTICE_MS = 24 * 60 * 60_000;

// Mã PT-000001 tuần tự theo tổ chức; câu lệnh khoá dòng bộ đếm nên gửi đồng thời không trùng mã.
async function nextPaymentCode(tx: Tx, orgId: string): Promise<string> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO org_counters (organization_id, key, value) VALUES (${orgId}::uuid, 'payment', 1)
    ON CONFLICT (organization_id, key) DO UPDATE SET value = org_counters.value + 1
    RETURNING value`;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error('Bộ đếm mã phiếu thu không trả giá trị');
  return `PT-${String(value).padStart(6, '0')}`;
}

const installmentAuditView = (rows: { name: string; dueDate: Date; amount: bigint | number; isDeposit: boolean }[]) =>
  rows.map((r) => ({
    name: r.name,
    dueDate: r.dueDate.toISOString(),
    amount: typeof r.amount === 'bigint' ? vndFromBigInt(r.amount, 'số tiền đợt') : r.amount,
    isDeposit: r.isDeposit,
  }));

const contractPaymentRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/contracts/:contractId/payments',
    scope: 'org',
    permission: 'payments.read',
    tag: TAG,
    summary: 'Tình hình thu tiền của hợp đồng: tiến độ (trạng thái từng đợt), phiếu thu/hoàn, tóm tắt cọc – đã thu – còn lại',
    params: ContractParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      return { body: await loadProgress(deps.db, o.id, params.contractId, new Date(), o) };
    },
  }),

  defineRoute({
    method: 'put',
    path: '/orgs/:orgId/contracts/:contractId/installments',
    scope: 'org',
    permission: 'payments.write',
    tag: TAG,
    summary: 'Thay toàn bộ tiến độ thanh toán (tổng các đợt phải bằng tổng hợp đồng, tối đa 1 đợt cọc)',
    params: ContractParams,
    body: InstallmentsBodySchema,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const progress = await deps.db.$transaction(async (tx) => {
        const c = await lockContract(tx, o.id, params.contractId);
        if (c.status === 'CANCELLED') {
          throw new AppError('CONFLICT', 'Hợp đồng đã huỷ — không lập tiến độ thanh toán được');
        }
        paymentMath(() => checkInstallmentPlan(vnd(c.total, 'tổng hợp đồng'), body.installments));
        const before = await tx.paymentInstallment.findMany({
          where: { contractId: c.id, organizationId: o.id },
          select: { name: true, dueDate: true, amount: true, isDeposit: true },
          orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
        });
        const next = sortInstallments(body.installments.map((i) => ({ ...i, dueDate: new Date(i.dueDate) })));
        await tx.paymentInstallment.deleteMany({ where: { contractId: c.id, organizationId: o.id } });
        if (next.length > 0) {
          await tx.paymentInstallment.createMany({
            data: next.map((i, index) => ({
              organizationId: o.id,
              contractId: c.id,
              name: i.name,
              dueDate: i.dueDate,
              amount: BigInt(i.amount),
              isDeposit: i.isDeposit,
              sortOrder: index,
            })),
          });
        }
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'payment.installments_replaced',
          entityType: 'contract',
          entityId: c.id,
          data: { code: c.code, before: installmentAuditView(before), after: installmentAuditView(next) },
          requestId,
        });
        return loadProgress(tx, o.id, c.id, new Date(), o);
      });
      return { body: progress };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/contracts/:contractId/payments',
    scope: 'org',
    permission: 'payments.write',
    idempotent: true,
    tag: TAG,
    summary: 'Ghi phiếu thu (hoặc phiếu hoàn tiền — cần quyền huỷ phiếu); mã PT-000001 theo tổ chức',
    params: ContractParams,
    body: PaymentBodySchema,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      if (body.kind === 'REFUND' && !o.permissions.has('payments.void')) {
        throw new AppError('FORBIDDEN', 'Ghi phiếu hoàn tiền cần quyền huỷ phiếu thu / hoàn tiền', { required: 'payments.void' });
      }
      const now = new Date();
      const receivedAt = body.receivedAt ? new Date(body.receivedAt) : now;
      if (receivedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
        throw new AppError('VALIDATION_FAILED', 'Ngày thu không được ở tương lai');
      }
      const result = await deps.db.$transaction(async (tx) => {
        const c = await lockContract(tx, o.id, params.contractId);
        if (receivedAt.getTime() < c.createdAt.getTime() - BEFORE_CONTRACT_TOLERANCE_MS) {
          throw new AppError(
            'VALIDATION_FAILED',
            `Ngày thu không được trước ngày lập hợp đồng ${c.code} quá 1 ngày (hợp đồng lập ${c.createdAt.toISOString()})`,
            { fields: ['receivedAt'], contractCreatedAt: c.createdAt },
          );
        }
        if (c.status === 'CANCELLED' && body.kind === 'RECEIPT') {
          throw new AppError('CONFLICT', 'Hợp đồng đã huỷ — chỉ ghi được phiếu hoàn tiền');
        }
        const before = await contractSummary(tx, o.id, c);
        let overBy = 0;
        if (body.kind === 'REFUND' && body.amount > before.paid) {
          throw new AppError(
            'CONFLICT',
            `Số hoàn (${formatVnd(body.amount)}) vượt số đã thu của hợp đồng (${formatVnd(before.paid)})`,
            { paid: before.paid, amount: body.amount },
          );
        }
        if (body.kind === 'RECEIPT') {
          overBy = before.paid + body.amount - before.total;
          if (overBy > 0 && !body.allowOverpay) {
            throw new AppError(
              'CONFLICT',
              `Thu vượt tổng hợp đồng ${formatVnd(overBy)} (còn phải thu ${formatVnd(Math.max(0, before.remaining))}). ` +
                'Nếu đúng là khách trả thừa, gửi lại kèm allowOverpay: true và ghi chú',
              { total: before.total, paid: before.paid, remaining: before.remaining, overBy },
            );
          }
        }
        const code = await nextPaymentCode(tx, o.id);
        const p = await tx.payment.create({
          data: {
            organizationId: o.id,
            contractId: c.id,
            code,
            kind: body.kind,
            method: body.method,
            amount: BigInt(body.amount),
            receivedAt,
            note: body.note ?? null,
            createdById: uid,
          },
          select: paymentSelect,
        });
        const after = await contractSummary(tx, o.id, c);
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'payment.created',
          entityType: 'payment',
          entityId: p.id,
          data: {
            code,
            contractId: c.id,
            contractCode: c.code,
            contractStatus: c.status,
            kind: body.kind,
            method: body.method,
            amount: body.amount,
            receivedAt: receivedAt.toISOString(),
            note: body.note ?? null,
            overpay: overBy > 0 ? { overBy, note: body.note ?? null } : null,
            backdated:
              now.getTime() - receivedAt.getTime() > BACKDATE_NOTICE_MS
                ? { recordedAt: now.toISOString(), days: Math.floor((now.getTime() - receivedAt.getTime()) / (24 * 60 * 60_000)) }
                : null,
            before: { paid: before.paid, remaining: before.remaining },
            after: { paid: after.paid, remaining: after.remaining },
          },
          requestId,
        });
        return { ...presentPayment(p), contract: { id: c.id, code: c.code, status: c.status }, summary: after };
      });
      return { status: 201, body: result };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/payments/:paymentId/void',
    scope: 'org',
    permission: 'payments.void',
    tag: TAG,
    summary: 'Huỷ phiếu thu/hoàn (không xoá, bắt buộc lý do, chỉ huỷ được một lần)',
    params: PaymentParams,
    body: VoidPaymentBodySchema,
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const result = await deps.db.$transaction(async (tx) => {
        const found = await tx.payment.findFirst({
          where: { id: params.paymentId, organizationId: o.id },
          select: { contractId: true },
        });
        if (!found) throw new AppError('NOT_FOUND', 'Không tìm thấy phiếu thu');
        const c = await lockContract(tx, o.id, found.contractId);
        // Đọc lại sau khi khoá hợp đồng: yêu cầu huỷ đồng thời đã xong thì thấy ngay.
        const p = await tx.payment.findFirstOrThrow({ where: { id: params.paymentId, organizationId: o.id }, select: paymentSelect });
        if (p.voidedAt) throw new AppError('CONFLICT', `Phiếu ${p.code} đã huỷ trước đó`);
        const before = await contractSummary(tx, o.id, c);
        const amount = vnd(p.amount, 'số tiền phiếu');
        if (p.kind === 'RECEIPT' && amount > before.paid) {
          throw new AppError(
            'CONFLICT',
            `Huỷ phiếu ${p.code} làm số đã thu âm vì hợp đồng đã có phiếu hoàn — huỷ phiếu hoàn trước`,
            { paid: before.paid, amount },
          );
        }
        const done = await tx.payment.updateMany({
          where: { id: p.id, organizationId: o.id, voidedAt: null },
          data: { voidedAt: new Date(), voidReason: body.reason },
        });
        if (done.count !== 1) throw new AppError('CONFLICT', `Phiếu ${p.code} đã huỷ trước đó`);
        const after = await contractSummary(tx, o.id, c);
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: uid,
          action: 'payment.voided',
          entityType: 'payment',
          entityId: p.id,
          data: {
            code: p.code,
            contractId: c.id,
            contractCode: c.code,
            kind: p.kind,
            amount,
            reason: body.reason,
            before: { paid: before.paid, remaining: before.remaining },
            after: { paid: after.paid, remaining: after.remaining },
          },
          requestId,
        });
        const updated = await tx.payment.findUniqueOrThrow({ where: { id: p.id }, select: paymentSelect });
        return { ...presentPayment(updated), contract: { id: c.id, code: c.code, status: c.status }, summary: after };
      });
      return { body: result };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/payments',
    scope: 'org',
    permission: 'payments.read',
    tag: TAG,
    summary: 'Sổ thu theo kỳ [from, to) (tối đa 366 ngày): lọc hình thức, loại phiếu, hợp đồng; tổng thu/hoàn trong kỳ',
    query: LedgerQuery,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      if (query.contractId) {
        const c = await deps.db.contract.findFirst({ where: { id: query.contractId, organizationId: o.id }, select: { id: true } });
        if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng');
      }
      const where: Prisma.PaymentWhereInput = {
        organizationId: o.id,
        receivedAt: { gte: new Date(query.from), lt: new Date(query.to) },
        ...(query.method ? { method: query.method } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.contractId ? { contractId: query.contractId } : {}),
      };
      const [count, sums, rows] = await deps.db.$transaction([
        deps.db.payment.count({ where }),
        deps.db.payment.groupBy({ by: ['kind'], where: { ...where, voidedAt: null }, orderBy: { kind: 'asc' }, _sum: { amount: true }, _count: { _all: true } }),
        deps.db.payment.findMany({
          where,
          select: { ...paymentSelect, contract: { select: { id: true, code: true, customer: { select: { id: true, fullName: true } } } } },
          orderBy: [{ receivedAt: 'desc' }, { code: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);
      const sumOf = (kind: 'RECEIPT' | 'REFUND') => {
        const g = sums.find((s) => s.kind === kind);
        return { amount: g?._sum?.amount ?? 0n, count: typeof g?._count === 'object' ? g._count._all : 0 };
      };
      const receivedRaw = sumOf('RECEIPT');
      const refundedRaw = sumOf('REFUND');
      // Tổng vượt ngưỡng (dữ liệu cũ trước khi có trần 100 tỷ/phiếu): tổng = null + cờ, danh sách phiếu vẫn trả đủ.
      const received = { amount: vndOrNull(receivedRaw.amount), count: receivedRaw.count };
      const refunded = { amount: vndOrNull(refundedRaw.amount), count: refundedRaw.count };
      const net = vndOrNull(receivedRaw.amount - refundedRaw.amount);
      const totalsOverflow = received.amount === null || refunded.amount === null || net === null;
      return {
        body: {
          from: query.from,
          to: query.to,
          // Tổng chỉ tính phiếu còn hiệu lực; danh sách vẫn hiện phiếu đã huỷ (có voidedAt) để đối soát.
          totals: {
            received: received.amount,
            receiptCount: received.count,
            refunded: refunded.amount,
            refundCount: refunded.count,
            net,
          },
          totalsOverflow,
          items: rows.map((r) => ({ ...presentPayment(r), contract: r.contract })),
          page: query.page,
          pageSize: query.pageSize,
          total: count,
        },
      };
    },
  }),
];

export const paymentRoutes: AnyRoute[] = [...contractPaymentRoutes, ...reportRoutes];
