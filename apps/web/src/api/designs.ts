import type { ContractKindKey, DesignKind, DesignSize, DesignTemplate, FontOverride, SlotKey } from '@makeup/shared';
import { api } from './client';
import { uploadFile } from './files';
import { idSeg, orgPath, withQuery } from './org';
import type { ContractStatus, FilePurpose, IsoDateTime, Page, StoredFileView } from './types';

// Mẫu thiết kế và thẻ (chào mừng / feedback / lời chúc): apps/api/src/modules/designs/* — bản vẽ C3 mục 1.3, 1.4.
// Danh mục mẫu là dữ liệu dùng chung (packages/shared design-templates.ts); máy chủ trả đúng các mục đó.
// Các đường GET ở đây trả MẢNG (không bọc { items }).

export type { ContractKindKey, DesignKind, DesignSize, DesignTemplate, FontOverride, SlotKey };

// GET /contracts/:contractId/design-data — giá trị ô lấy từ hợp đồng và hồ sơ thương hiệu. Ô hợp đồng không có = null.
// Ngày (ngay, nkt, nsk) dạng YYYY-MM-DD; logoUrl, anhUrl là URL ký có hạn 10 phút (signedUrlExpiresAt).
export interface DesignData {
  contractKind: ContractKindKey;
  courseClassId: string | null;
  th: string | null;
  diachi: string | null;
  sdt: string | null;
  web: string | null;
  ten: string | null;
  khoa: string | null;
  lop: string | null;
  ngay: string | null;
  nkt: string | null;
  lich: string | null;
  gv: string | null;
  nv: string | null;
  goi: string | null;
  nsk: string | null;
  logoUrl: string | null;
  anhUrl: string | null;
  signedUrlExpiresAt: IsoDateTime | null;
}

// GreetingPhrase — câu chúc soạn sẵn. appliesTo rỗng = dùng cho cả hai loại hợp đồng.
export interface GreetingPhrase {
  id: string;
  name: string;
  appliesTo: ContractKindKey[];
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface GreetingPhraseInput {
  name: string;
  appliesTo: ContractKindKey[];
  title: string;
  body: string;
  sortOrder?: number;
  isActive?: boolean;
}
export type GreetingPhrasePatch = Partial<GreetingPhraseInput>;

// Giá trị đã điền lúc tạo thẻ (khoá SLOT_SOURCES). Ô ảnh lưu MÃ TỆP, không lưu URL.
export type DesignSnapshot = Partial<Record<SlotKey, string | number | null>>;

export interface DesignCardPhoto {
  sortOrder: number;
  fileId: string;
  signedUrl: string | null;
  signedUrlExpiresAt: IsoDateTime | null;
}

// designs/data.ts — presentCards.
export interface DesignCard {
  id: string;
  kind: DesignKind;
  templateCode: string;
  templateVersion: number;
  contractId: string;
  contract: { id: string; code: string; kind: ContractKindKey };
  customerId: string;
  customer: { id: string; fullName: string };
  courseClassId: string | null;
  title: string | null;
  body: string | null;
  rating: number | null;
  // YYYY-MM-DD
  receivedAt: string | null;
  fontOverride: FontOverride | null;
  size: DesignSize;
  snapshot: DesignSnapshot;
  photos: DesignCardPhoto[];
  outputFileId: string | null;
  outputUrl: string | null;
  outputUrlExpiresAt: IsoDateTime | null;
  createdById: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DesignCardCreateInput {
  kind: DesignKind;
  templateCode: string;
  contractId: string;
  courseClassId?: string;
  title?: string | null;
  body?: string | null;
  rating?: number | null;
  // YYYY-MM-DD
  receivedAt?: string | null;
  photoFileIds?: string[];
  fontOverride?: FontOverride | null;
  size: DesignSize;
  // Ghi đè ô CHỮ lấy từ dữ liệu (máy chủ kiểm khoá thuộc mẫu).
  snapshot?: Record<string, string | null>;
}

export type DesignCardPatch = Partial<Omit<DesignCardCreateInput, 'kind' | 'contractId' | 'courseClassId'>> & {
  courseClassId?: string | null;
};

export interface DesignCardListQuery {
  kind?: DesignKind;
  contractId?: string;
  customerId?: string;
  from?: IsoDateTime;
  to?: IsoDateTime;
}

// Hợp đồng nguồn của thẻ: GET /contracts (presentSummary) có `kind`, lọc được theo ?kind=.
export interface SourceContract {
  id: string;
  code: string;
  kind: ContractKindKey;
  status: ContractStatus;
  eventDate: IsoDateTime | null;
  createdAt: IsoDateTime;
  customer: { id: string; fullName: string; phone: string | null };
}

export interface SourceContractQuery {
  kind?: ContractKindKey;
  q?: string;
  page?: number;
  pageSize?: number;
}

// ---- Danh mục mẫu, giá trị ô ----

export function listDesignTemplates(orgId: string, query: { kind?: DesignKind; contractKind?: ContractKindKey } = {}, signal?: AbortSignal) {
  return api.get<DesignTemplate[]>(withQuery(orgPath(orgId, '/design-templates'), query), signal);
}

// courseClassId: hợp đồng khoá học nhiều lớp — chọn lớp; bỏ trống = lớp của dòng khoá học đầu tiên.
export function getDesignData(orgId: string, contractId: string, query: { courseClassId?: string } = {}, signal?: AbortSignal) {
  return api.get<DesignData>(withQuery(orgPath(orgId, `/contracts/${idSeg(contractId)}/design-data`), query), signal);
}

export function listSourceContracts(orgId: string, query: SourceContractQuery = {}, signal?: AbortSignal) {
  return api.get<Page<SourceContract>>(withQuery(orgPath(orgId, '/contracts'), query), signal);
}

// ---- Câu chúc soạn sẵn ----

// Mặc định máy chủ chỉ trả câu đang dùng; màn quản lý gửi includeInactive để thấy cả câu đã ẩn.
export function listGreetingPhrases(orgId: string, query: { contractKind?: ContractKindKey; includeInactive?: boolean } = {}, signal?: AbortSignal) {
  return api.get<GreetingPhrase[]>(withQuery(orgPath(orgId, '/greeting-phrases'), query), signal);
}

export function createGreetingPhrase(orgId: string, input: GreetingPhraseInput, idempotencyKey: string) {
  return api.create<GreetingPhrase>(orgPath(orgId, '/greeting-phrases'), input, idempotencyKey);
}

export function updateGreetingPhrase(orgId: string, phraseId: string, patch: GreetingPhrasePatch) {
  return api.patch<GreetingPhrase>(orgPath(orgId, `/greeting-phrases/${idSeg(phraseId)}`), patch);
}

// ---- Thẻ ----

export function createDesignCard(orgId: string, input: DesignCardCreateInput, idempotencyKey: string) {
  return api.create<DesignCard>(orgPath(orgId, '/design-cards'), input, idempotencyKey);
}

export function updateDesignCard(orgId: string, cardId: string, patch: DesignCardPatch) {
  return api.patch<DesignCard>(orgPath(orgId, `/design-cards/${idSeg(cardId)}`), patch);
}

// Gắn ảnh PNG đã xuất (tệp tải lên với purpose DESIGN_CARD).
export function setDesignCardOutput(orgId: string, cardId: string, fileId: string) {
  return api.put<DesignCard>(orgPath(orgId, `/design-cards/${idSeg(cardId)}/output`), { fileId });
}

export function listDesignCards(orgId: string, query: DesignCardListQuery = {}, signal?: AbortSignal) {
  return api.get<DesignCard[]>(withQuery(orgPath(orgId, '/design-cards'), query), signal);
}

// Xoá mềm; máy chủ trả 204.
export function deleteDesignCard(orgId: string, cardId: string) {
  return api.delete<void>(orgPath(orgId, `/design-cards/${idSeg(cardId)}`));
}

// ---- Tải ảnh của thẻ ----

// Mục đích tệp của thẻ (schema.prisma FilePurpose: DESIGN_PHOTO, DESIGN_CARD — bản vẽ C3 mục 1.1).
export type DesignFilePurpose = Extract<FilePurpose, 'DESIGN_PHOTO' | 'DESIGN_CARD'>;

// DESIGN_PHOTO: ảnh người dùng tải lên cho thẻ; DESIGN_CARD: ảnh PNG đã xuất.
export function uploadDesignFile(orgId: string, purpose: DesignFilePurpose, name: string, data: Blob, idempotencyKey: string) {
  return uploadFile(orgId, { purpose, name, data }, idempotencyKey);
}

// Thẻ chào mừng: "Đổi ảnh" học viên = cập nhật Customer.avatarFileId (C3 mục 1.3, PATCH /customers/:id đã có).
// Ảnh tải lên với purpose CUSTOMER_AVATAR. Kiểu CustomerUpdateInput ở types.ts chưa có avatarFileId nên gọi thẳng ở đây.
export function setCustomerAvatar(orgId: string, customerId: string, avatarFileId: string | null) {
  return api.patch<{ id: string; avatarFileId: string | null }>(orgPath(orgId, `/customers/${idSeg(customerId)}`), { avatarFileId });
}

export type { StoredFileView };
