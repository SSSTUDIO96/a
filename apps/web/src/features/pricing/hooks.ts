import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useSession } from '../../app/session';
import { usePermissions } from '../../layout/usePermissions';
import { pricingPerms, type PricingPerms } from './logic';

// id tổ chức theo đường /:orgSlug (AppShell đã chặn đường của tổ chức không có trong phiên).
export function useOrgId(): string {
  const { orgSlug } = useParams();
  const { organizations } = useSession();
  const org = organizations.find((o) => o.slug === orgSlug);
  if (!org) throw new Error(`Không có tổ chức "${orgSlug ?? ''}" trong phiên — màn Bảng giá phải nằm trong AppShell`);
  return org.id;
}

export function usePricingPerms(): PricingPerms {
  const has = usePermissions();
  return useMemo(() => pricingPerms(has), [has]);
}

export type Resource<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

/**
 * Tải dữ liệu một lần theo `deps`, huỷ yêu cầu cũ khi deps đổi hoặc rời màn. reload() tải lại, giữ dữ liệu cũ trên màn
 * trong lúc chờ (không nháy khối chờ sau lần tải đầu).
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]): [Resource<T>, () => void] {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const controller = new AbortController();
    loadRef
      .current(controller.signal)
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
  return [state, reload];
}
