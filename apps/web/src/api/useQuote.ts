import { useEffect, useRef, useState } from 'react';
import { quoteContract } from './contracts';
import { fieldErrors } from './errors';
import type { ContractBody, ContractQuote } from './types';

// Bảng tính xem trước hợp đồng (bản vẽ mục 4.3): đợi 300ms sau lần sửa cuối, huỷ yêu cầu cũ khi có thay đổi mới.
// Lỗi thì GIỮ bảng tính cũ (không xoá số đang hiện) và trả lỗi để hiện dưới ô.

export const QUOTE_DELAY_MS = 300;

export interface QuoteState {
  data: ContractQuote | null;
  error: unknown;
  // Lỗi 400 của schema: { đường_dẫn_đầy_đủ: lời } (vd "lines.0.travel.amount"), kèm cả khoá gốc ("lines").
  fieldErrors: Record<string, string>;
  // Lỗi 400/404 khi tính một dòng: máy chủ trả details.line = vị trí dòng (từ 0) trong lines.
  errorLine: number | null;
  loading: boolean;
}

export const INITIAL_QUOTE_STATE: QuoteState = { data: null, error: null, fieldErrors: {}, errorLine: null, loading: false };

export type QuoteFetcher = (body: ContractBody, signal: AbortSignal) => Promise<ContractQuote>;

export interface QuoteRunner {
  // Gọi mỗi lần thân hợp đồng đổi; null = chưa đủ dữ liệu để tính (không gọi máy chủ).
  request: (body: ContractBody | null) => void;
  dispose: () => void;
}

function lineOf(err: unknown): number | null {
  if (typeof err !== 'object' || err === null || !('details' in err)) return null;
  const d = (err as { details: unknown }).details;
  if (typeof d !== 'object' || d === null || !('line' in d)) return null;
  const line = (d as { line: unknown }).line;
  return typeof line === 'number' ? line : null;
}

// Phần lõi không phụ thuộc React — bài thử chạy được với đồng hồ giả.
export function createQuoteRunner(fetcher: QuoteFetcher, onChange: (s: QuoteState) => void, delayMs = QUOTE_DELAY_MS): QuoteRunner {
  let state = INITIAL_QUOTE_STATE;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: AbortController | null = null;
  let disposed = false;

  const set = (patch: Partial<QuoteState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    onChange(state);
  };

  // Kết quả của yêu cầu cũ không còn đúng với dữ liệu đang nhập — huỷ ngay khi có thay đổi mới.
  const cancelPending = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    inflight?.abort();
    inflight = null;
  };

  async function run(body: ContractBody) {
    const controller = new AbortController();
    inflight = controller;
    try {
      const data = await fetcher(body, controller.signal);
      if (controller.signal.aborted) return;
      set({ data, error: null, fieldErrors: {}, errorLine: null, loading: false });
    } catch (err) {
      // Yêu cầu bị chính runner huỷ: đã có yêu cầu mới thay, kết quả này bỏ đi là đúng.
      if (controller.signal.aborted) return;
      set({ error: err, fieldErrors: fieldErrors(err), errorLine: lineOf(err), loading: false });
    } finally {
      if (inflight === controller) inflight = null;
    }
  }

  return {
    request(body) {
      if (disposed) return;
      cancelPending();
      if (body === null) {
        set({ loading: false });
        return;
      }
      set({ loading: true });
      timer = setTimeout(() => {
        timer = null;
        void run(body);
      }, delayMs);
    },
    dispose() {
      cancelPending();
      disposed = true;
    },
  };
}

/**
 * Gọi POST /orgs/:orgId/contracts/quote mỗi khi `body` đổi (so theo nội dung JSON, không theo tham chiếu).
 * body = null: chưa đủ dữ liệu, không gọi.
 */
export function useQuote(orgId: string | null, body: ContractBody | null, delayMs = QUOTE_DELAY_MS): QuoteState {
  const [state, setState] = useState<QuoteState>(INITIAL_QUOTE_STATE);
  const runnerRef = useRef<QuoteRunner | null>(null);
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const key = orgId && body ? JSON.stringify(body) : null;

  useEffect(() => {
    if (!orgId) return undefined;
    const runner = createQuoteRunner((b, signal) => quoteContract(orgId, b, signal), setState, delayMs);
    runnerRef.current = runner;
    return () => {
      runner.dispose();
      if (runnerRef.current === runner) runnerRef.current = null;
    };
  }, [orgId, delayMs]);

  useEffect(() => {
    runnerRef.current?.request(key === null ? null : bodyRef.current);
  }, [key, orgId, delayMs]);

  return state;
}
