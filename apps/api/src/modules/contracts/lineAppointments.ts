import { Prisma } from '@prisma/client';
import { canTransition, isTerminalStatus, WORK_STATUS_LABELS } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { appointmentInclude, applyStatusChangeTx, type TxCtx } from '../schedule/service';

// Biên bản nghiệm thu lần 4, N1: huỷ một dòng của hợp đồng đã xác nhận thì ca (lịch) gắn dòng đó — và các dòng con kéo
// theo — phải huỷ theo, trong CÙNG transaction với việc đánh dấu dòng. Trước đây đường huỷ dòng không đụng bảng lịch:
// ca vẫn "Đã xác nhận", vẫn giữ giờ của thợ, Lịch còn nhắc "Phân thợ".
// Cùng luật với huỷ cả hợp đồng (schedule/service.ts cancelAppointmentsOfContractTx), chỉ khác phạm vi là theo dòng:
//   - lịch còn huỷ được (nháp / chờ xác nhận / đã xác nhận) → "Đã huỷ" qua applyStatusChangeTx (ghi lịch sử trạng thái +
//     nhật ký appointment.status_changed, trả giờ của thợ) — KHÔNG xoá;
//   - lịch đang làm dở (không còn đường sang "Đã huỷ") → 409, KHÔNG đổi gì (cả transaction quay lui, dòng không bị huỷ);
//   - lịch đã ở trạng thái cuối (đã huỷ, hoàn thành, khách không đến) giữ nguyên.
export async function cancelAppointmentsOfLinesTx(
  tx: Prisma.TransactionClient,
  ctx: TxCtx,
  contractId: string,
  lineIds: string[],
  reason: string,
): Promise<string[]> {
  if (lineIds.length === 0) return [];
  if (reason.trim() === '') throw new AppError('VALIDATION_FAILED', 'Huỷ lịch phải ghi lý do');
  // Khoá các lịch của hợp đồng theo cùng thứ tự với cancelAppointmentsOfContractTx để hai lệnh không khoá chéo nhau.
  await tx.$queryRaw`SELECT id FROM appointments WHERE organization_id = ${ctx.orgId}::uuid AND contract_id = ${contractId}::uuid ORDER BY id FOR UPDATE`;
  const rows = await tx.appointment.findMany({
    where: { organizationId: ctx.orgId, contractId, contractLineId: { in: lineIds } },
    include: appointmentInclude,
    orderBy: { code: 'asc' },
  });
  const busy = rows.filter((r) => !isTerminalStatus(r.status) && !canTransition(r.status, 'CANCELLED'));
  if (busy.length > 0) {
    throw new AppError(
      'CONFLICT',
      `Còn lịch đang thực hiện của dòng này: ${busy.map((a) => `${a.code} (${WORK_STATUS_LABELS[a.status]})`).join(', ')} — xử lý xong lịch trước khi huỷ dòng`,
      { appointments: busy.map((a) => ({ id: a.id, code: a.code, status: a.status })) },
    );
  }
  const toCancel = rows.filter((r) => canTransition(r.status, 'CANCELLED'));
  for (const row of toCancel) {
    await applyStatusChangeTx(tx, ctx, row, 'CANCELLED', reason, {
      via: 'contract.line_voided',
      contractId,
      ...(row.contractLineId ? { contractLineId: row.contractLineId } : {}),
    });
  }
  return toCancel.map((r) => r.id);
}
