import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import type { ContractBody, ContractQuote } from './types';
import { createQuoteRunner, type QuoteState } from './useQuote';

const body = (n: number): ContractBody => ({
  newCustomer: { fullName: 'Lan' },
  lines: [{ kind: 'CUSTOM', name: 'Dòng', unitPrice: n, quantity: 1 }],
});

const quote = (total: number): ContractQuote => ({
  kind: 'SERVICE',
  classes: [],
  lines: [],
  travelTotal: 0,
  subtotal: total,
  discount: 0,
  total,
  depositRequired: 0,
  suggestedDeposit: 0,
  autoSurcharge: { applied: [], removed: [], skipped: [] },
});

interface Call {
  body: ContractBody;
  signal: AbortSignal;
  resolve: (q: ContractQuote) => void;
  reject: (e: unknown) => void;
}

function setup() {
  const calls: Call[] = [];
  const states: QuoteState[] = [];
  const fetcher = vi.fn(
    (b: ContractBody, signal: AbortSignal) =>
      new Promise<ContractQuote>((resolve, reject) => {
        calls.push({ body: b, signal, resolve, reject });
      }),
  );
  const runner = createQuoteRunner(fetcher, (s) => states.push(s));
  const last = () => states[states.length - 1];
  return { calls, states, fetcher, runner, last };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useQuote — lõi đợi 300ms và huỷ yêu cầu cũ', () => {
  it('gõ liên tiếp 5 lần trong 300ms chỉ gọi máy chủ MỘT lần, với thân cuối cùng', async () => {
    const { calls, fetcher, runner, last } = setup();
    for (let i = 1; i <= 5; i++) {
      runner.request(body(i * 1000));
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(last()?.loading).toBe(true);
    await vi.advanceTimersByTimeAsync(299);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(calls[0]?.body).toEqual(body(5000));
    calls[0]?.resolve(quote(5000));
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toMatchObject({ data: quote(5000), loading: false, error: null });
  });

  it('chưa đủ 300ms kể từ lần sửa cuối thì chưa gọi', async () => {
    const { fetcher, runner } = setup();
    runner.request(body(1));
    await vi.advanceTimersByTimeAsync(299);
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('sửa tiếp khi yêu cầu cũ đang chạy → yêu cầu cũ bị huỷ (AbortController), kết quả cũ không đè số mới', async () => {
    const { calls, runner, last } = setup();
    runner.request(body(1));
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(1);
    runner.request(body(2));
    expect(calls[0]?.signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.signal.aborted).toBe(false);
    calls[1]?.resolve(quote(2));
    // Yêu cầu cũ trả về muộn: bị bỏ qua.
    calls[0]?.resolve(quote(1));
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.data).toEqual(quote(2));
  });

  it('lỗi 400 giữ bảng tính cũ, trả lỗi trường và vị trí dòng lỗi', async () => {
    const { calls, runner, last } = setup();
    runner.request(body(1));
    await vi.advanceTimersByTimeAsync(300);
    calls[0]?.resolve(quote(1));
    await vi.advanceTimersByTimeAsync(0);

    runner.request(body(2));
    await vi.advanceTimersByTimeAsync(300);
    calls[1]?.reject(
      new ApiError('VALIDATION_FAILED', 'Dữ liệu gửi lên không hợp lệ', 400, 'r1', {
        formErrors: [],
        fieldErrors: { lines: ['Số tiền không được âm'] },
        issues: [{ path: 'lines.0.travel.amount', message: 'Số tiền không được âm' }],
      }),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toMatchObject({
      data: quote(1),
      loading: false,
      fieldErrors: { 'lines.0.travel.amount': 'Số tiền không được âm', lines: 'Số tiền không được âm' },
      errorLine: null,
    });
    expect(last()?.error).toBeInstanceOf(ApiError);

    runner.request(body(3));
    await vi.advanceTimersByTimeAsync(300);
    calls[2]?.reject(new ApiError('VALIDATION_FAILED', 'Chỉ chọn studio khi địa điểm là STUDIO', 400, 'r2', { line: 0 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toMatchObject({ data: quote(1), errorLine: 0, fieldErrors: {} });

    // Sửa đúng lại thì xoá lỗi.
    runner.request(body(4));
    await vi.advanceTimersByTimeAsync(300);
    calls[3]?.resolve(quote(4));
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toMatchObject({ data: quote(4), error: null, errorLine: null, fieldErrors: {} });
  });

  it('body = null (chưa đủ dữ liệu) thì không gọi và huỷ yêu cầu đang chờ', async () => {
    const { calls, fetcher, runner, last } = setup();
    runner.request(body(1));
    await vi.advanceTimersByTimeAsync(300);
    runner.request(null);
    expect(calls[0]?.signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(last()?.loading).toBe(false);
  });

  it('dispose (rời màn) huỷ yêu cầu đang chạy và không cập nhật trạng thái nữa', async () => {
    const { calls, runner, states } = setup();
    runner.request(body(1));
    await vi.advanceTimersByTimeAsync(300);
    const before = states.length;
    runner.dispose();
    expect(calls[0]?.signal.aborted).toBe(true);
    calls[0]?.resolve(quote(1));
    await vi.advanceTimersByTimeAsync(0);
    expect(states.length).toBe(before);
  });
});

describe('useQuote — nối với quoteContract thật (fetch giả lập)', () => {
  it('gửi POST /contracts/quote kèm signal; yêu cầu cũ bị huỷ thật ở tầng fetch', async () => {
    const { quoteContract } = await import('./contracts');
    const { setAccessToken } = await import('./client');
    setAccessToken('tok');
    const signals: (AbortSignal | null | undefined)[] = [];
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            urls.push(String(input));
            signals.push(init?.signal);
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Đã huỷ', 'AbortError')));
            setTimeout(() => resolve(new Response(JSON.stringify(quote(9)), { status: 200 })), 1000);
          }),
      ),
    );
    const states: QuoteState[] = [];
    const runner = createQuoteRunner((b, s) => quoteContract('org-1', b, s), (s) => states.push(s));
    runner.request(body(1));
    await vi.advanceTimersByTimeAsync(300);
    runner.request(body(2));
    await vi.advanceTimersByTimeAsync(300);
    expect(urls).toEqual(['/api/v1/orgs/org-1/contracts/quote', '/api/v1/orgs/org-1/contracts/quote']);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(states[states.length - 1]).toMatchObject({ data: quote(9), error: null, loading: false });
    vi.unstubAllGlobals();
    setAccessToken(null);
  });
});
