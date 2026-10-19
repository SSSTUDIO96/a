import { useCallback, useEffect, useRef, useState } from 'react';
import { getToday } from '../../api/today';
import type { TodayView } from '../../api/types';

// Tải GET /today. Tải lại khi bấm "Làm mới" và khi trang được mở lại (tab hiện lại sau khi ẩn). Số liệu cũ vẫn hiện trong
// lúc tải lại; tải lại hỏng thì giữ số cũ và báo `refreshError` (không xoá màn đang đọc).
export type TodayState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; view: TodayView };

export function useToday(orgId: string) {
  const [state, setState] = useState<TodayState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(
    (initial: boolean) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      if (initial) {
        hasDataRef.current = false;
        setRefreshing(false);
        setState({ status: 'loading' });
      } else setRefreshing(true);
      setRefreshError(null);
      getToday(orgId, controller.signal)
        .then((view) => {
          if (controller.signal.aborted) return;
          hasDataRef.current = true;
          setState({ status: 'ready', view });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (initial || !hasDataRef.current) setState({ status: 'error', error });
          else setRefreshError(error);
        })
        .finally(() => {
          if (!controller.signal.aborted) setRefreshing(false);
        });
    },
    [orgId],
  );

  useEffect(() => {
    load(true);
    return () => controllerRef.current?.abort();
  }, [load]);

  // Mở lại trang (tab hiện lại): lấy số liệu mới, không nháy khối chờ.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const reload = useCallback(() => load(false), [load]);
  const retry = useCallback(() => load(true), [load]);
  return { state, refreshing, refreshError, reload, retry };
}
