import { api } from './client';
import { idSeg, orgPath, withQuery } from './org';
import type { IsoDateTime } from './types';

// Giấy chứng nhận (bản vẽ F mục 4): apps/api/src/modules/certificates/{routes,schemas,present,service}.ts,
// người ký ở apps/api/src/modules/profile/routes.ts (đường /profile/certificate).
// Mọi đường giấy chứng nhận cần tổ chức ACADEMY (khác → 403 "Tổ chức chưa bật đào tạo"); quyền certificates.read / .issue.
// Ngày: "YYYY-MM-DD". Tiền: số nguyên đồng. Không có đường "in": dữ liệu in là CertificateView (đã kèm URL ảnh ký có hạn,
// 10 phút) — web tự vẽ ảnh rồi làm PDF (features/certificates/render.ts, pdf.ts).

export type CertificateStatus = 'ISSUED' | 'REVOKED';
// Phông chữ ký đổi tên học viên: máy chủ chỉ nhận 4 giá trị này (CHECK của database).
export type CertificateFont = 'ky-1' | 'ky-2' | 'ky-3' | 'ky-4';

// Ảnh ký có hạn: chỉ tệp đã xong, chưa xoá, đúng tổ chức; còn lại null.
export interface SignedImage {
  url: string;
  expiresAt: IsoDateTime;
}

export interface SignedPhoto extends SignedImage {
  // Để báo "ảnh nhỏ, in có thể mờ".
  width: number | null;
  height: number | null;
}

export interface CertificateView {
  id: string;
  // "CC-2026-0007"
  code: string;
  year: number;
  seq: number;
  // 0 = bản gốc; cấp lại giữ số và tăng số này.
  reissueNo: number;
  status: CertificateStatus;
  issuedOn: string;
  reissuedOn: string | null;
  templateCode: string;
  templateVersion: number;
  fontOverride: CertificateFont | null;
  // Chờ bản vẽ nền: đợt này luôn null.
  backgroundStyle: string | null;
  frameStyle: string | null;
  // Chữ in trên giấy là BẢN CHỤP lúc cấp (in lại ra y hệt).
  studentName: string;
  courseName: string;
  className: string;
  instructorName: string | null;
  signerName: string | null;
  signerTitle: string | null;
  brandName: string;
  photo: SignedPhoto | null;
  logo: SignedImage | null;
  background: SignedImage | null;
  enrollmentId: string;
  courseClassId: string;
  // Tên HIỆN HÀNH của khách (hộp cấp lại điền sẵn) — khác studentName khi khách đã đổi tên.
  customer: { id: string; fullName: string };
  revokedAt: IsoDateTime | null;
  revokeReason: string | null;
  replacesId: string | null;
  replacedById: string | null;
  issuedBy: { userId: string; name: string };
  createdAt: IsoDateTime;
}

// ---- Đường 1: danh sách cấp của lớp ----

export interface RosterItem {
  enrollmentId: string;
  enrolledAt: IsoDateTime;
  customer: { id: string; fullName: string; photo: SignedPhoto | null };
  // Tiền chỉ có khi moneyVisible (contracts.read hoặc payments.read); không thì total / paid / debt là null.
  contract: { id: string; code: string; total: number | null; paid: number | null; debt: number | null };
  // Bản ISSUED hiện hành.
  certificate: CertificateView | null;
  // Khi không có bản ISSUED mà có bản đã thu hồi.
  lastRevoked: { id: string; code: string; revokedAt: IsoDateTime; revokeReason: string } | null;
}

export interface ClassCertificateRoster {
  class: {
    id: string;
    name: string;
    courseId: string;
    courseName: string;
    courseMode: 'SINGLE_CLASS' | 'MULTI_CLASS';
    startDate: string;
    endDate: string;
    status: 'OPEN' | 'CLOSED' | 'CANCELLED';
    instructorName: string | null;
  };
  // Theo múi giờ của tổ chức.
  today: string;
  ended: boolean;
  defaultIssuedOn: string | null;
  brandName: string;
  logo: SignedImage | null;
  signer: { name: string | null; title: string };
  // Số DỰ KIẾN (không cam kết); null khi lớp chưa kết thúc.
  nextNumber: { year: number; seq: number; code: string } | null;
  moneyVisible: boolean;
  items: RosterItem[];
}

export interface RosterQuery {
  issuedOn?: string;
}

export function getClassCertificateRoster(orgId: string, classId: string, query: RosterQuery = {}, signal?: AbortSignal) {
  return api.get<ClassCertificateRoster>(orgPath(orgId, withQuery(`/classes/${idSeg(classId)}/certificates`, query)), signal);
}

// ---- Đường 2: cấp hàng loạt ----

export interface IssueInput {
  enrollmentIds: string[];
  templateCode: string;
  issuedOn: string;
  // Không gửi / null = phông theo mẫu.
  fontOverride?: CertificateFont | null;
}

export interface DebtWarning {
  enrollmentId: string;
  customerName: string;
  contractCode: string;
  // null khi người xem không có quyền thấy tiền.
  debt: number | null;
}

export interface IssueResult {
  // Mọi ghi danh đã gửi, theo thứ tự danh sách lớp (bản mới + bản đã có).
  items: CertificateView[];
  issuedCount: number;
  existingCount: number;
  debtWarnings: DebtWarning[];
}

// Cùng khoá + cùng thân → máy chủ trả lại đúng phản hồi lần đầu. Nơi bấm nút sinh khoá MỘT lần, đổi mẫu/ngày thì khoá mới.
export function issueCertificates(orgId: string, classId: string, body: IssueInput, idempotencyKey: string) {
  return api.create<IssueResult>(orgPath(orgId, `/classes/${idSeg(classId)}/certificates`), body, idempotencyKey);
}

// ---- Đường 3: sổ ----

export interface CertificateListQuery {
  year?: number;
  // Tìm theo số hoặc tên học viên.
  q?: string;
  classId?: string;
  customerId?: string;
  status?: CertificateStatus;
  // Lấy lại đúng các giấy này (URL ảnh mới trước khi in). Tối đa 50.
  ids?: string[];
  page?: number;
  pageSize?: number;
}

export interface CertificatePage {
  items: CertificateView[];
  page: number;
  pageSize: number;
  total: number;
  // Các năm có giấy của tổ chức, giảm dần.
  years: number[];
}

export function listCertificates(orgId: string, query: CertificateListQuery = {}, signal?: AbortSignal) {
  const { ids, ...rest } = query;
  return api.get<CertificatePage>(orgPath(orgId, withQuery('/certificates', { ...rest, ids: ids ? ids.join(',') : undefined })), signal);
}

// ---- Đường 4: một bản ----

export function getCertificate(orgId: string, certificateId: string, signal?: AbortSignal) {
  return api.get<CertificateView>(orgPath(orgId, `/certificates/${idSeg(certificateId)}`), signal);
}

// ---- Đường 5: cấp lại (giữ số) ----

export interface ReissueInput {
  reason: string;
  // Trống = tên hiện hành của khách. KHÔNG sửa tên trong hồ sơ khách.
  studentName?: string;
  // Trống = mẫu cũ.
  templateCode?: string;
  // Không gửi = phông cũ; null = phông theo mẫu.
  fontOverride?: CertificateFont | null;
}

export function reissueCertificate(orgId: string, certificateId: string, body: ReissueInput, idempotencyKey: string) {
  return api.create<CertificateView>(orgPath(orgId, `/certificates/${idSeg(certificateId)}/reissue`), body, idempotencyKey);
}

// ---- Đường 6: thu hồi ----

export interface RevokeInput {
  reason: string;
}

// Không khai chống gửi trùng: thu hồi lần hai ra 409.
export function revokeCertificate(orgId: string, certificateId: string, body: RevokeInput) {
  return api.post<CertificateView>(orgPath(orgId, `/certificates/${idSeg(certificateId)}/revoke`), body);
}

// ---- Đường 7 và 8: người ký thứ hai ----

export interface CertificateSigner {
  hasProfile: boolean;
  signerName: string | null;
  signerTitle: string | null;
  // "Giám đốc trung tâm" — dùng khi chức danh để trống.
  defaultTitle: string;
}

export interface CertificateSignerInput {
  // Hai khoá bắt buộc có mặt, được phép null.
  signerName: string | null;
  signerTitle: string | null;
}

export function getCertificateSigner(orgId: string, signal?: AbortSignal) {
  return api.get<CertificateSigner>(orgPath(orgId, '/profile/certificate'), signal);
}

// Chưa có hồ sơ thương hiệu → 409 (details.reason PROFILE_REQUIRED).
export function putCertificateSigner(orgId: string, body: CertificateSignerInput) {
  return api.put<CertificateSigner>(orgPath(orgId, '/profile/certificate'), body);
}
