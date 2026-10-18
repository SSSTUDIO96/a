import { api } from './client';
import type { OrganizationDetail } from './types';

// Đường thuộc tổ chức: /orgs/:orgId/... (orgId lấy từ tổ chức đang chọn trong phiên).
export function orgPath(orgId: string, path: string): string {
  if (!orgId) throw new Error('Thiếu orgId khi gọi đường thuộc tổ chức');
  return `/orgs/${encodeURIComponent(orgId)}${path}`;
}

export function idSeg(id: string): string {
  return encodeURIComponent(id);
}

type QueryValue = string | number | boolean | undefined;

// Bỏ tham số undefined; boolean gửi "true"/"false" (máy chủ đọc đúng dạng chuỗi này).
export function withQuery(path: string, query: object | undefined): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query as Record<string, QueryValue>)) {
    if (v === undefined) continue;
    params.append(k, String(v));
  }
  const s = params.toString();
  return s ? `${path}?${s}` : path;
}

// Thông tin tổ chức kèm quyền của chính mình (myPermissions) — khung điều hướng dùng để ẩn mục.
export function getOrganization(orgId: string, signal?: AbortSignal) {
  return api.get<OrganizationDetail>(orgPath(orgId, ''), signal);
}
