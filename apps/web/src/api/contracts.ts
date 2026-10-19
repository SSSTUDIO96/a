import { api } from './client';
import { idSeg, orgPath, withQuery } from './org';
import type {
  ContractAddLineResult,
  ContractBody,
  ContractDetail,
  ContractQuoteBody,
  ContractLineInput,
  ContractListQuery,
  ContractQuote,
  ContractStatusInput,
  ContractStatusResult,
  ContractSummary,
  ContractText,
  ContractTextCreateInput,
  ContractTextListQuery,
  ContractTextUpdateInput,
  ContractUpdateInput,
  ContractVoidResult,
  Page,
  VoidLineInput,
} from './types';

// Hợp đồng: apps/api/src/modules/contracts/*. Giao diện không tự tính tiền — luôn lấy từ quote hoặc hợp đồng đã lưu.

// Xem trước bảng tính, không ghi gì. Cùng thân với lệnh tạo (+ excludeContractId khi sửa hợp đồng đã lưu).
// Huỷ được bằng signal (useQuote dùng).
// Phản hồi có autoSurcharge: phụ phí máy chủ tự thêm theo luật (applied), phần sửa bị bỏ (removed), luật khớp mà không
// sinh dòng (skipped). Dòng tự thêm nằm ở GroupedContractLine.surcharges. Thân dòng đặt chỗ nhận thêm occasionId,
// surchargeOverrides, dismissedRuleIds (types.ts PlacedLineFields); web không tự cộng tiền phụ phí.
export function quoteContract(orgId: string, body: ContractQuoteBody, signal?: AbortSignal) {
  return api.post<ContractQuote>(orgPath(orgId, '/contracts/quote'), body, { signal });
}

export function createContract(orgId: string, body: ContractBody, idempotencyKey: string) {
  return api.create<ContractDetail>(orgPath(orgId, '/contracts'), body, idempotencyKey);
}

export function listContracts(orgId: string, query?: ContractListQuery, signal?: AbortSignal) {
  return api.get<Page<ContractSummary>>(withQuery(orgPath(orgId, '/contracts'), query), signal);
}

export function getContract(orgId: string, contractId: string, signal?: AbortSignal) {
  return api.get<ContractDetail>(orgPath(orgId, `/contracts/${idSeg(contractId)}`), signal);
}

// Nháp: gửi lại toàn bộ lines; đã xác nhận: chỉ notes.
// Gửi lines → luật phụ phí chạy lại cho mọi dòng; không gửi lines → dòng giữ nguyên.
export function updateContract(orgId: string, contractId: string, input: ContractUpdateInput) {
  return api.patch<ContractDetail>(orgPath(orgId, `/contracts/${idSeg(contractId)}`), input);
}

// Thêm MỘT dòng (luật phụ phí chạy cho dòng mới); hợp đồng đã xác nhận thì là dòng phát sinh (dòng có thợ dự kiến → lịch tạo ngay, xem createdAppointments).
export function addContractLine(orgId: string, contractId: string, line: ContractLineInput, idempotencyKey: string) {
  return api.create<ContractAddLineResult>(orgPath(orgId, `/contracts/${idSeg(contractId)}/lines`), line, idempotencyKey);
}

// Huỷ dòng (kéo theo dịch vụ phụ, phí di chuyển của dòng). Không xoá; bắt buộc lý do.
export function voidContractLine(orgId: string, contractId: string, lineId: string, input: VoidLineInput) {
  return api.post<ContractVoidResult>(orgPath(orgId, `/contracts/${idSeg(contractId)}/lines/${idSeg(lineId)}/void`), input);
}

// Huỷ (bắt buộc reason) kéo theo huỷ các lịch đã gắn; xác nhận tạo lịch cho các dòng có thợ dự kiến.
export function changeContractStatus(orgId: string, contractId: string, input: ContractStatusInput) {
  return api.post<ContractStatusResult>(orgPath(orgId, `/contracts/${idSeg(contractId)}/status`), input);
}

// ---- Mẫu điều khoản / nội quy (contracts/texts.ts) ----
// Đọc: contracts.read (mặc định chỉ mẫu đang dùng). Thêm / sửa: contracts.texts. Sửa nội dung → phiên bản + 1; hợp đồng đã
// xác nhận giữ bản chụp, không đổi theo mẫu.
export function listContractTexts(orgId: string, query?: ContractTextListQuery, signal?: AbortSignal) {
  return api.get<ContractText[]>(withQuery(orgPath(orgId, '/contract-texts'), query), signal);
}

export function createContractText(orgId: string, input: ContractTextCreateInput, idempotencyKey: string) {
  return api.create<ContractText>(orgPath(orgId, '/contract-texts'), input, idempotencyKey);
}

export function updateContractText(orgId: string, textId: string, input: ContractTextUpdateInput) {
  return api.patch<ContractText>(orgPath(orgId, `/contract-texts/${idSeg(textId)}`), input);
}
