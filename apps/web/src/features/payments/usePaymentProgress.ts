import { useCallback, useEffect, useRef, useState } from 'react';
import { getContractPayments } from '../../api/payments';
import type { ContractPayments, PaymentSummary } from '../../api/types';

// Tình hình thu tiền của MỘT hợp đồng (GET /contracts/:id/payments). Mọi con số lấy từ máy chủ:
// ghi/huỷ phiếu xong thì thay `summary` bằng số máy chủ trả ngay, rồi tải lại để có trạng thái đợt và danh sách phiếu mới.

export type ProgressState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: ContractPayments };

export function usePaymentProgress(orgId: string, contractId: string) {
  const [state, setState] = useState<ProgressState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    (initial: boolean): Promise<void> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      if (initial) setState({ status: 'loading' });
      else setRefreshing(true);
      return getContractPayments(orgId, contractId, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setState({ status: 'ready', data });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          // Tải lại thất bại khi đã có dữ liệu: giữ dữ liệu cũ (số đã thay bằng summary máy chủ trả), báo lỗi ở chỗ gọi.
          setState((s) => (initial || s.status !== 'ready' ? { status: 'error', error } : s));
          if (!initial) throw error;
        })
        .finally(() => {
          if (!controller.signal.aborted) setRefreshing(false);
        });
    },
    [orgId, contractId],
  );

  useEffect(() => {
    void load(true);
    return () => controllerRef.current?.abort();
  }, [load]);

  const reload = useCallback(() => load(false), [load]);
  const retry = useCallback(() => void load(true), [load]);

  // Thay toàn bộ (PUT tiến độ trả lại tình hình mới).
  const replace = useCallback((data: ContractPayments) => setState({ status: 'ready', data }), []);

  // Thay 4 ô số bằng summary máy chủ vừa trả (POST phiếu / huỷ phiếu).
  const applySummary = useCallback((summary: PaymentSummary) => {
    setState((s) => (s.status === 'ready' ? { status: 'ready', data: { ...s.data, summary } } : s));
  }, []);

  return { state, refreshing, reload, retry, replace, applySummary };
}
