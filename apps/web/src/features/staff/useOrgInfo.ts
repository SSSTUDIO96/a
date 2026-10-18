import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useSession } from '../../app/session';
import { usePermissionsContext } from '../../layout/usePermissions';

// Tổ chức đang mở theo /:orgSlug (AppShell đã chặn tổ chức không có trong phiên) + người đang xem.
export interface OrgInfo {
  orgId: string;
  slug: string;
  // Dòng "của chính mình" trên danh sách thợ.
  membershipId: string;
  roleKeys: string[];
  timezone: string;
}

export function useOrgInfo(): OrgInfo {
  const { orgSlug } = useParams();
  const { organizations } = useSession();
  const perms = usePermissionsContext();
  const org = organizations.find((o) => o.slug === orgSlug);
  if (!org) throw new Error(`Không có tổ chức "${orgSlug ?? ''}" trong phiên — màn phải nằm trong AppShell`);
  const detail = perms.state.status === 'ready' ? perms.state.org : null;
  const roleKeys = useMemo(() => detail?.myRoles ?? org.roles.map((r) => r.key), [detail, org.roles]);
  return {
    orgId: org.id,
    slug: org.slug,
    membershipId: org.membershipId,
    roleKeys,
    timezone: detail?.timezone ?? 'Asia/Ho_Chi_Minh',
  };
}

export type Loadable<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

/**
 * Tải theo `deps`, huỷ yêu cầu cũ khi deps đổi hoặc rời màn. reload() tải lại và GIỮ dữ liệu cũ trên màn trong lúc chờ.
 * set() thay dữ liệu tại chỗ (sau khi lưu, máy chủ trả bản mới).
 */
export function useLoad<T>(load: ((signal: AbortSignal) => Promise<T>) | null, deps: readonly unknown[]) {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const fn = loadRef.current;
    if (!fn) return undefined;
    const controller = new AbortController();
    fn(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const set = useCallback((fn: (prev: T) => T) => {
    setState((s) => (s.status === 'ready' ? { status: 'ready', data: fn(s.data) } : s));
  }, []);
  const reset = useCallback(() => setState({ status: 'loading' }), []);
  return { state, reload, set, reset };
}
