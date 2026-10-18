import { api } from './client';
import type { OrgKind } from './auth';
import type { IsoDateTime, Items, Page, Vnd } from './types';

// Quản trị nền tảng (bản vẽ C2 mục 5.10): apps/api/src/modules/platform/routes.ts.
// Đường KHÔNG có tiền tố /orgs/:orgId. Người không phải quản trị nền tảng (kể cả chưa đăng nhập) nhận 404 y như
// đường bịa — web dùng GET /platform/stats làm bước kiểm quyền.
// Các POST ở đây không khai idempotent trên máy chủ (không thuộc tổ chức) nên không gửi Idempotency-Key;
// màn tự khoá nút trong lúc gửi để khỏi bấm hai lần.

export type EffectiveStatus = 'NONE' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELLED';
export type SubscriptionStatus = Exclude<EffectiveStatus, 'NONE'>;
export type OrgStatus = 'ACTIVE' | 'SUSPENDED';

export interface PlanView {
  id: string;
  code: string;
  name: string;
  priceMonthly: Vnd;
  // null = không giới hạn.
  maxStaff: number | null;
  maxAppointmentsPerMonth: number | null;
  maxStorageMb: number | null;
  maxStudents: number | null;
  maxCourses: number | null;
  customDomain: boolean;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface PlatformStats {
  organizations: {
    total: number;
    byStatus: Record<OrgStatus, number>;
    bySubscriptionStatus: Record<EffectiveStatus, number>;
  };
  expiringIn30Days: number;
  // DỰ KIẾN (giá/tháng hiện tại × thuê bao đang dùng) — KHÔNG phải tiền đã thu.
  projectedMonthlyRevenue: Vnd;
  projectedMonthlyRevenueNote: string;
  generatedAt: IsoDateTime;
}

export interface SubscriptionState {
  effectiveStatus: EffectiveStatus;
  graceEndsAt: IsoDateTime | null;
  inGrace: boolean;
  writable: boolean;
}

export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  kind: OrgKind;
  status: OrgStatus;
  createdAt: IsoDateTime;
  owner: { id: string; fullName: string; email: string } | null;
  subscriptionStatus: EffectiveStatus;
  subscription:
    | ({
        id: string;
        plan: { id: string; code: string; name: string; priceMonthly: Vnd };
        status: SubscriptionStatus;
        startsAt: IsoDateTime;
        endsAt: IsoDateTime | null;
      } & SubscriptionState)
    | null;
  memberCount: number;
  storageUsedBytes: number;
}

export interface OrgListQuery {
  page?: number;
  pageSize?: number;
  status?: OrgStatus;
  subscriptionStatus?: EffectiveStatus;
  planCode?: string;
  expiringWithinDays?: number;
  q?: string;
}

export interface OrgSubscriptionRow {
  id: string;
  plan: { id: string; code: string; name: string };
  status: SubscriptionStatus;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime | null;
  note: string | null;
  createdById: string | null;
  createdAt: IsoDateTime;
  isCurrent: boolean;
}

export interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  kind: OrgKind;
  status: OrgStatus;
  timezone: string;
  currency: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  owners: { id: string; fullName: string; email: string }[];
  memberCount: number;
  storageUsedBytes: number;
  subscriptionStatus: EffectiveStatus;
  currentSubscription:
    | ({ id: string; status: SubscriptionStatus; startsAt: IsoDateTime; endsAt: IsoDateTime | null; note: string | null } & SubscriptionState)
    | null;
  effectivePlan: { source: 'subscription' | 'default'; plan: PlanView } | null;
  // Lỗi cấu hình (ví dụ thiếu gói mặc định) — hiện nguyên văn ở thẻ đầu.
  configError: string | null;
  graceDays: number;
  // students / courses: null = chưa đếm được (chưa có module).
  usage: { staff: number; appointmentsThisMonth: number; storageMb: number; students: null; courses: null };
  subscriptions: OrgSubscriptionRow[];
}

// Chỉ MỘT trong months / endsAt (máy chủ từ chối gửi cả hai). endsAt: null = không hạn.
export type SubscriptionInput = {
  planId: string;
  status?: SubscriptionStatus;
  startsAt?: IsoDateTime;
  note?: string;
} & ({ months: number; endsAt?: never } | { endsAt: IsoDateTime | null; months?: never } | { months?: never; endsAt?: never });

export interface AddedSubscription extends SubscriptionState {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime | null;
  note: string | null;
}

export type PlanInput = Omit<PlanView, 'id' | 'createdAt' | 'updatedAt'>;
// Sửa gói: CHỈ gửi trường đã đổi (mã gói không đổi được — gửi "code" máy chủ trả 400).
export type PlanPatch = Partial<Omit<PlanInput, 'code'>>;

export interface OrgStatusInput {
  status: OrgStatus;
  // Bắt buộc khi khoá (máy chủ: "Nhập lý do tạm khoá").
  reason?: string;
}

function query(q: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

const id = (v: string) => encodeURIComponent(v);

// GET /platform/stats — cũng là bước kiểm quyền (404 = không phải quản trị nền tảng).
export function getPlatformStats(signal?: AbortSignal) {
  return api.get<PlatformStats>('/platform/stats', signal);
}

// GET /platform/organizations — máy chủ xếp tổ chức mới tạo trước.
export function listPlatformOrganizations(q: OrgListQuery = {}, signal?: AbortSignal) {
  return api.get<Page<OrgListItem>>(`/platform/organizations${query(q)}`, signal);
}

export function getPlatformOrganization(organizationId: string, signal?: AbortSignal) {
  return api.get<OrgDetail>(`/platform/organizations/${id(organizationId)}`, signal);
}

// Đổi gói / gia hạn = thêm một dòng thuê bao mới (dòng cũ giữ làm lịch sử). Xong thì tải lại chi tiết.
export function addSubscription(organizationId: string, input: SubscriptionInput) {
  return api.post<AddedSubscription>(`/platform/organizations/${id(organizationId)}/subscriptions`, input);
}

// Dòng tổ chức sau khi đổi (máy chủ trả nguyên bảng organizations — KHÔNG phải OrgDetail đầy đủ).
export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  kind: OrgKind;
  status: OrgStatus;
  timezone: string;
  currency: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// Tạm khoá (cần lý do) / mở khoá.
export function setOrganizationStatus(organizationId: string, input: OrgStatusInput) {
  return api.patch<OrganizationRow>(`/platform/organizations/${id(organizationId)}`, input);
}

export function listPlans(signal?: AbortSignal) {
  return api.get<Items<PlanView>>('/platform/plans', signal);
}

export function createPlan(input: PlanInput) {
  return api.post<PlanView>('/platform/plans', input);
}

export function updatePlan(planId: string, patch: PlanPatch) {
  return api.patch<PlanView>(`/platform/plans/${id(planId)}`, patch);
}
