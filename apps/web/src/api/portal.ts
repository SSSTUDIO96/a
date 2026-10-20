import { PERMISSIONS, type PortalAdminView } from '@makeup/shared';
import { ApiError } from './errors';
import { api } from './client';
import { idSeg, orgPath } from './org';

// Cổng học viên, phía trung tâm (bản vẽ E mục 4.3, 4.4): apps/api/src/modules/portal/{center-routes,center,settings}.ts.
// Kiểu PortalAdminView dùng chung với máy chủ (packages/shared/src/portal.ts).
// Mọi đường này cần tổ chức ACADEMY (khác → 403 "Tổ chức chưa bật đào tạo").
// POST không gửi khoá chống gửi trùng: tạo đường dẫn KHÔNG khai idempotent (bản vẽ E 2.2 luật 5) vì kho chống trùng
// sẽ cất nguyên phản hồi, tức cất luôn chìa bản rõ.

export type { PortalAdminView };

export function getPortalAdmin(orgId: string, customerId: string, signal?: AbortSignal) {
  return api.get<PortalAdminView>(orgPath(orgId, `/customers/${idSeg(customerId)}/portal`), signal);
}

// 201. `key` chỉ có trong phản hồi này, một lần: nơi gọi giữ trong state của component, KHÔNG đưa vào URL / localStorage.
export interface CreatedPortalLink {
  key: string;
  expiresAt: string;
  callName: string;
  centerName: string;
  view: PortalAdminView;
}

export function createPortalLink(orgId: string, customerId: string) {
  return api.post<CreatedPortalLink>(orgPath(orgId, `/customers/${idSeg(customerId)}/portal/links`), { phoneConfirmed: true });
}

export function revokePortal(orgId: string, customerId: string, reason: string) {
  return api.post<{ devicesEnded: number; view: PortalAdminView }>(orgPath(orgId, `/customers/${idSeg(customerId)}/portal/revoke`), { reason });
}

// Trả view của học viên sở hữu máy.
export function blockPortalDevice(orgId: string, deviceId: string, reason: string) {
  return api.post<{ view: PortalAdminView }>(orgPath(orgId, `/portal-devices/${idSeg(deviceId)}/block`), { reason });
}

// ---- Cài đặt cổng (4.4) ----
export interface PortalSettings {
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  updatedAt: string | null;
}

export type PortalSettingsInput = Pick<PortalSettings, 'bankName' | 'bankAccountNo' | 'bankAccountName'>;

export function getPortalSettings(orgId: string, signal?: AbortSignal) {
  return api.get<PortalSettings>(orgPath(orgId, '/portal-settings'), signal);
}

// Bắt buộc đủ 3 khoá; đủ cả ba hoặc null cả ba.
export function putPortalSettings(orgId: string, input: PortalSettingsInput) {
  return api.put<PortalSettings>(orgPath(orgId, '/portal-settings'), input);
}

// ---- Lỗi thiếu quyền ----
// 403 có `details.required`: đường tạo đường dẫn trả MẢNG khoá quyền còn thiếu; middleware cũ trả CHUỖI (một khoá).
// Đọc được cả hai; khoá lạ giữ nguyên (không đoán), không có → [].
export function requiredPermissions(err: unknown): string[] {
  if (!(err instanceof ApiError) || err.status !== 403) return [];
  const req = (err.details as { required?: unknown } | undefined)?.required;
  if (typeof req === 'string') return req === '' ? [] : [req];
  if (Array.isArray(req)) return req.filter((p): p is string => typeof p === 'string' && p !== '');
  return [];
}

const PERMISSION_LABELS: Readonly<Record<string, string>> = PERMISSIONS;

// "Bạn không có quyền …. Còn thiếu: Xem khách hàng, Xem hợp đồng." — lời máy chủ + tên quyền tiếng Việt.
export function forbiddenMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.status !== 403) return null;
  const missing = requiredPermissions(err);
  if (missing.length === 0) return err.message;
  const names = missing.map((p) => PERMISSION_LABELS[p] ?? p);
  return `${err.message.replace(/[.\s]+$/, '')}. Còn thiếu quyền: ${names.join(', ')}.`;
}
