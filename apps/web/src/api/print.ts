import { api } from './client';
import { idSeg, orgPath, withQuery } from './org';
import type {
  ContractPrintResult,
  PrintCreateInput,
  PrintDataResult,
  PrintRecordView,
  PrintTemplateCreateInput,
  PrintTemplateListQuery,
  PrintTemplateUpdateInput,
  PrintTemplateView,
  Items,
} from './types';

// Mẫu in hợp đồng và nhật ký in: apps/api/src/modules/print/* (bản vẽ G mục 3.3 đường 1–7). Web không tự tính tiền, không tự
// ghép dữ liệu in: print-data trả sẵn dữ liệu (đã che theo quyền người xem) + mã băm để gửi lại khi ghi nhật ký in.
// Thông tin trên hợp đồng (người đại diện, ngân hàng) ghi ở profile.ts updateContractInfo.

// ---- Mẫu in (print/templates.ts) ----

// Đọc: contracts.read. Mặc định chỉ mẫu đang dùng (includeInactive: true để lấy cả mẫu ngừng dùng). Mẫu mặc định đứng đầu.
export function listPrintTemplates(orgId: string, query?: PrintTemplateListQuery, signal?: AbortSignal) {
  return api.get<Items<PrintTemplateView>>(withQuery(orgPath(orgId, '/print-templates'), query), signal);
}

export function getPrintTemplate(orgId: string, templateId: string, signal?: AbortSignal) {
  return api.get<PrintTemplateView>(orgPath(orgId, `/print-templates/${idSeg(templateId)}`), signal);
}

// Tạo mẫu: contracts.texts; CÓ Idempotency-Key (máy chủ idempotent: true).
export function createPrintTemplate(orgId: string, body: PrintTemplateCreateInput, idempotencyKey: string) {
  return api.create<PrintTemplateView>(orgPath(orgId, '/print-templates'), body, idempotencyKey);
}

// Sửa một phần: chỉ gửi trường đã đổi (blocks = thay toàn bộ bảng công tắc). Đổi nội dung in thì version + 1.
// Không có đường xoá: mẫu chỉ "ngừng dùng" (isActive: false). PATCH không có Idempotency-Key.
export function updatePrintTemplate(orgId: string, templateId: string, body: PrintTemplateUpdateInput) {
  return api.patch<PrintTemplateView>(orgPath(orgId, `/print-templates/${idSeg(templateId)}`), body);
}

// ---- Dữ liệu in và nhật ký in (print/prints.ts) ----

// Một đường trả đủ dữ liệu in đã tính sẵn, mã băm, URL logo ký mới, các mẫu dùng được, lần in gần nhất, cảnh báo.
export function getPrintData(orgId: string, contractId: string, signal?: AbortSignal) {
  return api.get<PrintDataResult>(orgPath(orgId, `/contracts/${idSeg(contractId)}/print-data`), signal);
}

// Bản chụp một lần in (cấu hình + dữ liệu, che thêm theo người xem) — xem trước khi in lại.
export function getContractPrint(orgId: string, contractId: string, printId: string, signal?: AbortSignal) {
  return api.get<ContractPrintResult>(orgPath(orgId, `/contracts/${idSeg(contractId)}/prints/${idSeg(printId)}`), signal);
}

// Ghi nhật ký in NGAY TRƯỚC khi mở hộp in của trình duyệt (contracts.read). CÓ Idempotency-Key (print/prints.ts: idempotent: true):
// sinh MỘT khoá cho mỗi lần bấm "In" và giữ khi thử lại — bấm hai lần / mạng gửi lại không ghi hai dòng nhật ký.
// 409 TEMPLATE_CHANGED / DATA_CHANGED / CONTRACT_CANCELLED: không ghi gì, không mở hộp in.
export function createContractPrint(orgId: string, contractId: string, body: PrintCreateInput, idempotencyKey: string) {
  return api.create<PrintRecordView>(orgPath(orgId, `/contracts/${idSeg(contractId)}/prints`), body, idempotencyKey);
}
