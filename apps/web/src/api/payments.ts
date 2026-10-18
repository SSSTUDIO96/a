import { api } from './client';
import { idSeg, orgPath, withQuery } from './org';
import type {
  ContractPayments,
  InstallmentsInput,
  PaymentCreateInput,
  PaymentLedger,
  PaymentLedgerQuery,
  PaymentResult,
  RevenueQuery,
  RevenueReport,
  VoidPaymentInput,
} from './types';

// Thu tiền, tiến độ thanh toán, sổ thu, báo cáo doanh số: apps/api/src/modules/payments/*.
// Giao diện không tự cộng tiền — tóm tắt (summary) và trạng thái từng đợt luôn lấy từ máy chủ.

// Tình hình thu tiền của hợp đồng: tiến độ, phiếu thu/hoàn, tóm tắt cọc – đã thu – còn lại.
export function getContractPayments(orgId: string, contractId: string, signal?: AbortSignal) {
  return api.get<ContractPayments>(orgPath(orgId, `/contracts/${idSeg(contractId)}/payments`), signal);
}

// Thay toàn bộ tiến độ thanh toán; trả lại tình hình thu tiền mới.
export function putInstallments(orgId: string, contractId: string, input: InstallmentsInput) {
  return api.put<ContractPayments>(orgPath(orgId, `/contracts/${idSeg(contractId)}/installments`), input);
}

// Ghi phiếu thu (hoặc phiếu hoàn). Bắt buộc khoá chống gửi trùng: bấm hai lần không thành hai phiếu.
export function createPayment(orgId: string, contractId: string, input: PaymentCreateInput, idempotencyKey: string) {
  return api.create<PaymentResult>(orgPath(orgId, `/contracts/${idSeg(contractId)}/payments`), input, idempotencyKey);
}

// Huỷ phiếu (không xoá, bắt buộc lý do, chỉ một lần).
export function voidPayment(orgId: string, paymentId: string, input: VoidPaymentInput) {
  return api.post<PaymentResult>(orgPath(orgId, `/payments/${idSeg(paymentId)}/void`), input);
}

// Sổ thu theo kỳ [from, to).
export function listPayments(orgId: string, query: PaymentLedgerQuery, signal?: AbortSignal) {
  return api.get<PaymentLedger>(withQuery(orgPath(orgId, '/payments'), query), signal);
}

// Báo cáo doanh số theo tháng hoặc theo hợp đồng (quyền reports.read). Phân biệt bằng report.groupBy.
export function getRevenueReport(orgId: string, query: RevenueQuery, signal?: AbortSignal) {
  return api.get<RevenueReport>(withQuery(orgPath(orgId, '/reports/revenue'), query), signal);
}
