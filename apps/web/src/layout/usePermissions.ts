import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Permission } from '@makeup/shared';
import { getOrganization } from '../api/org';
import type { OrganizationDetail } from '../api/types';

// Quyền của người đang xem trong tổ chức đang mở — lấy từ GET /orgs/:orgId (myPermissions), tra lại mỗi lần đổi tổ chức.
// Chỉ dùng để ẨN phần không được dùng; máy chủ vẫn kiểm quyền ở từng yêu cầu.

export type PermissionsState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; org: OrganizationDetail; permissions: ReadonlySet<string> };

export interface PermissionsValue {
  state: PermissionsState;
  // Chưa tải xong hoặc lỗi → false (ẩn hết, không lộ mục rồi mới giấu).
  has: (p: Permission) => boolean;
  reload: () => void;
}

const PermissionsContext = createContext<PermissionsValue | null>(null);

export function permissionsValue(state: PermissionsState, reload: () => void = () => undefined): PermissionsValue {
  return {
    state,
    has: (p) => state.status === 'ready' && state.permissions.has(p),
    reload,
  };
}

export function PermissionsProvider({ orgId, children }: { orgId: string; children: ReactNode }) {
  const [state, setState] = useState<PermissionsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    getOrganization(orgId, controller.signal)
      .then((org) => setState({ status: 'ready', org, permissions: new Set(org.myPermissions) }))
      .catch((error: unknown) => {
        // Rời tổ chức / đổi tổ chức giữa chừng: yêu cầu cũ bị huỷ, không cập nhật trạng thái.
        if (controller.signal.aborted) return;
        setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, attempt]);

  const value = useMemo(() => permissionsValue(state, () => setAttempt((n) => n + 1)), [state]);
  return createElement(PermissionsContext.Provider, { value }, children);
}

// Cho bài thử và trang xem thử: cấp sẵn danh sách quyền, không gọi máy chủ.
export function StaticPermissionsProvider({ value, children }: { value: PermissionsValue; children: ReactNode }) {
  return createElement(PermissionsContext.Provider, { value }, children);
}

export function usePermissionsContext(): PermissionsValue {
  const v = useContext(PermissionsContext);
  if (!v) throw new Error('usePermissions phải dùng bên trong PermissionsProvider');
  return v;
}

// has(p): người đang xem có quyền p trong tổ chức đang mở không.
export function usePermissions(): PermissionsValue['has'] {
  return usePermissionsContext().has;
}
