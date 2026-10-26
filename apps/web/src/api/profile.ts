import { api, apiRequest } from './client';
import { orgPath } from './org';
import type { BrandProfileInput, BrandProfileResult, ContractInfoInput, PublicSite } from './types';

// Hồ sơ thương hiệu và trang giới thiệu công khai: apps/api/src/modules/profile/*.

export function getBrandProfile(orgId: string, signal?: AbortSignal) {
  return api.get<BrandProfileResult>(orgPath(orgId, '/profile'), signal);
}

// Ghi TOÀN BỘ hồ sơ (trường không gửi = để trống) — gửi lại đủ các trường đang có.
export function putBrandProfile(orgId: string, input: BrandProfileInput) {
  return api.put<BrandProfileResult>(orgPath(orgId, '/profile'), input);
}

// Thông tin trên hợp đồng: người đại diện + ngân hàng (cần org.update). PUT ghi TOÀN BỘ 5 trường — gửi đủ cả năm khoá, null = để trống;
// PUT /profile không đụng 5 trường này. Chưa có hồ sơ thương hiệu → 409 PROFILE_REQUIRED. Không Idempotency-Key (PUT).
export function updateContractInfo(orgId: string, body: ContractInfoInput) {
  return api.put<BrandProfileResult>(orgPath(orgId, '/profile/contract-info'), body);
}

// Xuất bản / gỡ trang giới thiệu. Gọi lại khi đã ở trạng thái đó thì máy chủ trả nguyên hồ sơ.
export function publishBrandProfile(orgId: string) {
  return api.post<BrandProfileResult>(orgPath(orgId, '/profile/publish'), undefined);
}

export function unpublishBrandProfile(orgId: string) {
  return api.post<BrandProfileResult>(orgPath(orgId, '/profile/unpublish'), undefined);
}

// Trang giới thiệu đã xuất bản (không cần đăng nhập). Slug sai, chưa xuất bản hay tổ chức bị khoá đều là 404.
export function getPublicSite(slug: string, signal?: AbortSignal) {
  return apiRequest<PublicSite>('GET', `/public/sites/${encodeURIComponent(slug)}`, { auth: false, signal });
}
