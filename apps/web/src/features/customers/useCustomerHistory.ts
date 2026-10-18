import { useCallback, useEffect, useRef, useState } from 'react';
import { getContract, listContracts } from '../../api/contracts';
import { getCustomer, listCustomers } from '../../api/schedule';
import type { ContractDetail, ContractSummary, Customer } from '../../api/types';

export type Loadable<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;
// Tối đa 10 hợp đồng gần nhất mỗi khách (C2 2.4).
export const CONTRACT_LIMIT = 10;

// ---------------- Danh sách khách: tìm sau 300 ms, huỷ yêu cầu cũ, "Xem thêm 20 khách" ----------------
export interface CustomerListState {
  status: 'loading' | 'ready' | 'error';
  items: Customer[];
  total: number;
  page: number;
  // Chuỗi tìm của dữ liệu đang hiện (để in đậm phần số khớp đúng với kết quả).
  q: string;
  error: unknown;
  loadingMore: boolean;
  moreError: unknown;
}

export function useCustomerList(orgId: string, q: string) {
  const [state, setState] = useState<CustomerListState>({ status: 'loading', items: [], total: 0, page: 1, q: '', error: null, loadingMore: false, moreError: null });
  const [attempt, setAttempt] = useState(0);
  const moreCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    const text = q.trim();
    const controller = new AbortController();
    moreCtrl.current?.abort();
    const run = () => {
      listCustomers(orgId, { page: 1, pageSize: PAGE_SIZE, q: text || undefined }, controller.signal)
        .then((r) => setState({ status: 'ready', items: r.items, total: r.total, page: 1, q: text, error: null, loadingMore: false, moreError: null }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setState((s) => ({ ...s, status: 'error', error }));
        });
    };
    // Lần đầu (chưa tìm) gọi ngay; đang gõ thì đợi 300 ms sau lần gõ cuối.
    const t = setTimeout(run, text ? SEARCH_DELAY_MS : 0);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [orgId, q, attempt]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const loadMore = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'ready' || s.loadingMore) return;
    const controller = new AbortController();
    moreCtrl.current = controller;
    const page = s.page + 1;
    setState((cur) => ({ ...cur, loadingMore: true, moreError: null }));
    listCustomers(orgId, { page, pageSize: PAGE_SIZE, q: s.q || undefined }, controller.signal)
      .then((r) =>
        setState((cur) => {
          if (cur.q !== s.q) return cur;
          const seen = new Set(cur.items.map((c) => c.id));
          return { ...cur, items: [...cur.items, ...r.items.filter((c) => !seen.has(c.id))], total: r.total, page, loadingMore: false };
        }),
      )
      .catch((moreError: unknown) => {
        if (!controller.signal.aborted) setState((cur) => ({ ...cur, loadingMore: false, moreError }));
      });
  }, [orgId]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // Khách vừa thêm lên đầu; khách vừa sửa thay tại chỗ.
  const prepend = useCallback((c: Customer) => setState((s) => ({ ...s, items: [c, ...s.items.filter((x) => x.id !== c.id)], total: s.total + 1 })), []);
  const replace = useCallback((c: Customer) => setState((s) => ({ ...s, items: s.items.map((x) => (x.id === c.id ? c : x)) })), []);
  return { state, loadMore, retry, prepend, replace };
}

// ---------------- Hồ sơ một khách ----------------
export interface CustomerHistory {
  // null = không có quyền contracts.read hoặc máy chủ trả 403 → ẩn thẻ Hợp đồng và Lịch (không hiện dải đỏ).
  contracts: Loadable<{ items: ContractSummary[]; total: number }> | null;
  // Chi tiết tối đa 10 hợp đồng (tên dòng gói, lịch).
  details: Loadable<Map<string, ContractDetail>> | null;
}

export function useCustomerHistory(orgId: string, customerId: string | null, contractsRead: boolean) {
  const [customer, setCustomer] = useState<Loadable<Customer>>({ status: 'loading' });
  const [history, setHistory] = useState<CustomerHistory>({ contracts: null, details: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!customerId) return undefined;
    const controller = new AbortController();
    const signal = controller.signal;
    setCustomer({ status: 'loading' });
    setHistory({ contracts: contractsRead ? { status: 'loading' } : null, details: contractsRead ? { status: 'loading' } : null });
    // Gọi song song: khách + danh sách hợp đồng (C2 2.4 bước 1).
    getCustomer(orgId, customerId, signal)
      .then((c) => setCustomer({ status: 'ready', data: c }))
      .catch((error: unknown) => {
        if (!signal.aborted) setCustomer({ status: 'error', error });
      });
    if (contractsRead) {
      listContracts(orgId, { customerId, pageSize: CONTRACT_LIMIT }, signal)
        .then(async (r) => {
          if (signal.aborted) return;
          setHistory({ contracts: { status: 'ready', data: { items: r.items, total: r.total } }, details: { status: 'loading' } });
          // Bước 2: chi tiết từng hợp đồng song song (khách thường có 1–3).
          const settled = await Promise.allSettled(r.items.slice(0, CONTRACT_LIMIT).map((c) => getContract(orgId, c.id, signal)));
          if (signal.aborted) return;
          const map = new Map<string, ContractDetail>();
          let firstError: unknown = null;
          for (const s of settled) {
            if (s.status === 'fulfilled') map.set(s.value.id, s.value);
            else firstError ??= s.reason;
          }
          setHistory((h) => ({ ...h, details: firstError !== null && map.size === 0 && r.items.length > 0 ? { status: 'error', error: firstError } : { status: 'ready', data: map } }));
        })
        .catch((error: unknown) => {
          if (signal.aborted) return;
          // 403: ẩn thẻ, không báo lỗi.
          const status = (error as { status?: number }).status;
          if (status === 403) setHistory({ contracts: null, details: null });
          else setHistory({ contracts: { status: 'error', error }, details: null });
        });
    }
    return () => controller.abort();
  }, [orgId, customerId, contractsRead, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const setCustomerData = useCallback((c: Customer) => setCustomer({ status: 'ready', data: c }), []);
  return { customer, history, retry, setCustomerData };
}
