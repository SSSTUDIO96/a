import { api } from './client';
import type { IsoDateTime, Items, MembershipStatus, OrganizationDetail } from './types';

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

// ---- Vai trò, thành viên (C2 mục 1.9 — màn Thợ makeup) ----

// GET /orgs/:orgId/roles trả nguyên bản ghi Role (schema.prisma model Role).
export interface RoleView {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  isSystem: boolean;
  // Khoá quyền (packages/shared PERMISSIONS).
  permissions: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// orgs/routes.ts — memberSelect + presentMember.
export interface MemberView {
  id: string;
  status: MembershipStatus;
  createdAt: IsoDateTime;
  user: { id: string; email: string; fullName: string };
  roles: { id: string; key: string; name: string }[];
}

export interface AddMemberInput {
  email: string;
  roleKeys: string[];
}

// Danh sách vai trò của tổ chức (quyền roles.read).
export function listRoles(orgId: string, signal?: AbortSignal) {
  return api.get<Items<RoleView>>(orgPath(orgId, '/roles'), signal);
}

// Thêm một tài khoản ĐÃ đăng ký vào tổ chức (quyền members.invite). Máy chủ không đòi Idempotency-Key:
// gửi lại lần hai nhận 409 "Người này đã là thành viên của tổ chức".
// 404: chưa có tài khoản hoạt động với email này; 400: vai trò không có trong tổ chức.
export function addMember(orgId: string, input: AddMemberInput) {
  return api.post<MemberView>(orgPath(orgId, '/members'), input);
}
